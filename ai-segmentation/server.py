"""
server.py
Companion di segmentazione che gira in locale sul PC e usa l'hardware
(CPU per il motore geometrico, GPU per il motore AI). L'app web
"Correggi & Segmenta" gli manda la mesh e riceve un'etichetta di parte per ogni
triangolo. Nessun dato esce dal tuo computer.

Avvio:  python server.py           (porta 8760)
Salute: GET  http://127.0.0.1:8760/health
Segmenta: POST http://127.0.0.1:8760/segment
          { "vertices": [[x,y,z],...], "faces": [[a,b,c],...],
            "target_parts": 8, "engine": "auto" }
      ->  { "labels": [...per faccia...], "engine_used": "geometria|ai" }
"""
import sys
import json
import numpy as np
from flask import Flask, request, jsonify

sys.path.insert(0, ".")
import segmenta_geometria as geo

try:
    import segmenta_ai as ai  # opzionale: presente solo dopo aver installato l'AI
    AI_AVAILABLE = ai.is_available()
except Exception:
    ai = None
    AI_AVAILABLE = False

# riparazione professionale (pymeshlab) e booleane esatte (manifold3d)
try:
    import ripara_pro
    RIPARA_AVAILABLE = True
except Exception as _e:
    ripara_pro = None
    RIPARA_AVAILABLE = False
    print("Riparazione PRO non disponibile:", _e, file=sys.stderr)

try:
    import taglia_pro
    TAGLIA_AVAILABLE = True
except Exception as _e:
    taglia_pro = None
    TAGLIA_AVAILABLE = False
    print("Booleane PRO non disponibili:", _e, file=sys.stderr)

app = Flask(__name__)


@app.after_request
def cors(resp):
    # l'app gira come file locale (origine "null"): permetti la chiamata
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
    return resp


@app.route("/", methods=["GET"])
def home():
    # pagina di conferma: se apri l'indirizzo nel browser vedi che il
    # companion e' attivo (non e' qui che si usa l'app, e' solo il servizio)
    motore = "AI (GPU) + geometria" if AI_AVAILABLE else "geometria (motore base)"
    return (
        "<!doctype html><meta charset='utf-8'>"
        "<title>Companion attivo</title>"
        "<div style='font-family:system-ui;max-width:640px;margin:60px auto;"
        "padding:0 20px;line-height:1.5'>"
        "<h1 style='color:#2e7d32'>&#10003; Companion di segmentazione attivo</h1>"
        "<p>Il servizio locale sta girando correttamente su "
        "<b>http://127.0.0.1:8760</b>.</p>"
        "<p>Motore disponibile: <b>" + motore + "</b></p>"
        "<p style='background:#eef;padding:14px;border-radius:8px'>"
        "Questa pagina serve solo a confermare che tutto funziona.<br>"
        "Per usare l'app apri il file <b>stl-obj-fixer.html</b>, carica il "
        "modello, vai su <b>3&middot;Segmenta</b> e premi "
        "<b>&#129504; Segmenta con AI (PC locale)</b>.</p>"
        "<p style='color:#888'>Lascia questa finestra (e la finestra nera) "
        "aperta mentre usi l'app.</p></div>"
    )


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "engines": ["geometria"] + (["ai"] if AI_AVAILABLE else []),
        "ai_available": AI_AVAILABLE,
        "ripara_pro": RIPARA_AVAILABLE,
        "booleane_pro": TAGLIA_AVAILABLE,
    })


@app.route("/ripara", methods=["POST", "OPTIONS"])
def ripara():
    """Riparazione professionale: MeshLab + rimozione gusci interni + solido esatto."""
    if request.method == "OPTIONS":
        return ("", 204)
    if not RIPARA_AVAILABLE:
        return jsonify({"error": "Riparazione PRO non installata (serve install_pro.bat)"}), 501
    data = request.get_json(force=True)
    vertices = np.asarray(data["vertices"], dtype=np.float64)
    faces = np.asarray(data["faces"], dtype=np.int64)
    aggressivita = data.get("aggressivita", "auto")
    try:
        r = ripara_pro.ripara(vertices, faces, aggressivita=aggressivita)
    except Exception as e:
        print("riparazione fallita:", e, file=sys.stderr)
        return jsonify({"error": str(e)}), 500
    return jsonify({
        "vertices": r["vertices"].tolist(),
        "faces": r["faces"].tolist(),
        "watertight": r["watertight"],
        "volume": r["volume"],
        "log": r["log"],
    })


@app.route("/taglia", methods=["POST", "OPTIONS"])
def taglia():
    """Taglio con piano + connettore quadrato automatico (perno + foro), booleane esatte."""
    if request.method == "OPTIONS":
        return ("", 204)
    if not TAGLIA_AVAILABLE:
        return jsonify({"error": "Booleane PRO non installate (serve install_pro.bat)"}), 501
    data = request.get_json(force=True)
    vertices = np.asarray(data["vertices"], dtype=np.float64)
    faces = np.asarray(data["faces"], dtype=np.int64)
    try:
        r = taglia_pro.taglia_con_piano(
            vertices, faces,
            punto=data["punto"], normale=data["normale"],
            connettore=bool(data.get("connettore", True)),
            gioco=float(data.get("gioco", 0.20)),
            lato=data.get("lato"),
            profondita=data.get("profondita"),
            n_connettori=int(data.get("n_connettori", 1)),
        )
    except Exception as e:
        print("taglio fallito:", e, file=sys.stderr)
        return jsonify({"error": str(e)}), 500

    def pack(p):
        return {
            "vertices": np.asarray(p["vertices"]).tolist(),
            "faces": np.asarray(p["faces"]).tolist(),
            "watertight": p["watertight"],
            "volume": p["volume"],
        }

    return jsonify({
        "a": pack(r["a"]), "b": pack(r["b"]),
        "log": r["log"], "connettore": r.get("connettore"),
    })


@app.route("/segment", methods=["POST", "OPTIONS"])
def segment():
    if request.method == "OPTIONS":
        return ("", 204)
    data = request.get_json(force=True)
    vertices = np.asarray(data["vertices"], dtype=np.float64)
    faces = np.asarray(data["faces"], dtype=np.int64)
    target = int(data.get("target_parts", 8))
    engine = data.get("engine", "auto")

    use_ai = engine == "ai" or (engine == "auto" and AI_AVAILABLE)
    if use_ai and AI_AVAILABLE:
        try:
            labels = ai.segment(vertices, faces, target_parts=target)
            return jsonify({"labels": np.asarray(labels, dtype=int).tolist(), "engine_used": "ai"})
        except Exception as e:
            # se l'AI fallisce, non lasciare l'utente a piedi: usa la geometria
            print("AI fallita, uso geometria:", e, file=sys.stderr)

    labels = geo.segment(vertices, faces, target_parts=target)
    return jsonify({"labels": np.asarray(labels, dtype=int).tolist(), "engine_used": "geometria"})


if __name__ == "__main__":
    port = 8760
    print("Companion di segmentazione avviato su http://127.0.0.1:%d" % port)
    print("Motore AI:      ", "DISPONIBILE (GPU)" if AI_AVAILABLE else "non installato (uso geometria)")
    print("Riparazione PRO:", "DISPONIBILE (MeshLab)" if RIPARA_AVAILABLE else "non installata (install_pro.bat)")
    print("Booleane PRO:   ", "DISPONIBILI (manifold3d)" if TAGLIA_AVAILABLE else "non installate (install_pro.bat)")
    app.run(host="127.0.0.1", port=port, threaded=True)
