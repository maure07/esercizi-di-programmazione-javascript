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
    import rilievi
    RILIEVI_AVAILABLE = True
except Exception as _e:
    rilievi = None
    RILIEVI_AVAILABLE = False
    print("Rilevamento dettagli non disponibile:", _e, file=sys.stderr)

try:
    import connettore_pro
    CONN_AVAILABLE = True
except Exception as _e:
    connettore_pro = None
    CONN_AVAILABLE = False
    print("Connettore PRO non disponibile:", _e, file=sys.stderr)

try:
    import taglia_pro
    TAGLIA_AVAILABLE = True
except Exception as _e:
    taglia_pro = None
    TAGLIA_AVAILABLE = False
    print("Booleane PRO non disponibili:", _e, file=sys.stderr)

app = Flask(__name__)


def _leggi_mesh(data):
    """Legge vertici e facce accettando due formati:
      - a terne:  [[x,y,z], ...]           (vecchio)
      - piatto:   [x,y,z,x,y,z, ...]       (nuovo, molto piu' leggero)
    Il formato piatto evita al browser di creare centinaia di migliaia di
    piccoli array: su un modello da 800.000 triangoli e' la differenza fra
    far respirare il PC e farlo inginocchiare.
    """
    v = data["vertices"]
    f = data["faces"]
    piatto_v = len(v) == 0 or not isinstance(v[0], (list, tuple))
    piatto_f = len(f) == 0 or not isinstance(f[0], (list, tuple))
    vertices = np.asarray(v, dtype=np.float64)
    faces = np.asarray(f, dtype=np.int64)
    if piatto_v:
        vertices = vertices.reshape(-1, 3)
    if piatto_f:
        faces = faces.reshape(-1, 3)
    return vertices, faces


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
        "dettagli_rilievo": RILIEVI_AVAILABLE,
        "connettore_pro": CONN_AVAILABLE,
        "coperta": TAGLIA_AVAILABLE and hasattr(taglia_pro, "taglia_con_coperta"),
        "taglia_pro_versione": getattr(taglia_pro, "VERSIONE", None) if TAGLIA_AVAILABLE else None,
    })


@app.route("/ripara", methods=["POST", "OPTIONS"])
def ripara():
    """Riparazione professionale: MeshLab + rimozione gusci interni + solido esatto."""
    if request.method == "OPTIONS":
        return ("", 204)
    if not RIPARA_AVAILABLE:
        return jsonify({"error": "Riparazione PRO non installata (serve install_pro.bat)"}), 501
    data = request.get_json(force=True)
    vertices, faces = _leggi_mesh(data)
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
    vertices, faces = _leggi_mesh(data)
    try:
        r = taglia_pro.taglia_con_piano(
            vertices, faces,
            punto=data["punto"], normale=data["normale"],
            connettore=bool(data.get("connettore", True)),
            gioco=float(data.get("gioco", 0.20)),
            lato=data.get("lato"),
            profondita=data.get("profondita"),
            n_connettori=int(data.get("n_connettori", 1)),
            sel_min=data.get("selMin"),
            sel_max=data.get("selMax"),
            scala_connettore=float(data.get("scala_connettore", 1.0)),
            bordo=data.get("bordo"),
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


@app.route("/taglia_coperta", methods=["POST", "OPTIONS"])
def taglia_coperta():
    """Taglio con la COPERTA: superficie finita e deformabile invece del piano
    infinito. Taglia solo dove il telo passa davvero."""
    if request.method == "OPTIONS":
        return ("", 204)
    if not TAGLIA_AVAILABLE:
        return jsonify({"error": "Booleane PRO non installate (serve install_pro.bat)"}), 501
    data = request.get_json(force=True)
    vertices, faces = _leggi_mesh(data)
    griglia = np.asarray(data["griglia"], dtype=np.float64)
    if griglia.ndim == 1:
        lato_n = int(round((len(griglia) / 3) ** 0.5))
        griglia = griglia.reshape(lato_n, lato_n, 3)
    try:
        r = taglia_pro.taglia_con_coperta(
            vertices, faces, griglia,
            connettore=bool(data.get("connettore", True)),
            gioco=float(data.get("gioco", 0.20)),
            scala_connettore=float(data.get("scala_connettore", 1.0)),
        )
    except Exception as e:
        print("taglio con coperta fallito:", e, file=sys.stderr)
        return jsonify({"error": str(e)}), 500

    def pack(p):
        return {
            "vertices": np.asarray(p["vertices"]).tolist(),
            "faces": np.asarray(p["faces"]).tolist(),
            "watertight": p["watertight"],
            "volume": p["volume"],
        }

    return jsonify({"a": pack(r["a"]), "b": pack(r["b"]),
                    "log": r["log"], "connettore": r.get("connettore")})


@app.route("/connettore", methods=["POST", "OPTIONS"])
def connettore():
    """Perno + foro AUTOMATICI fra due pezzi, con booleane esatte.
    Non ricostruisce nulla: il resto della mesh resta identico."""
    if request.method == "OPTIONS":
        return ("", 204)
    if not CONN_AVAILABLE:
        return jsonify({"error": "Connettore PRO non installato (serve install_pro.bat)"}), 501
    data = request.get_json(force=True)
    va = np.asarray(data["a"]["vertices"], dtype=np.float64)
    fa = np.asarray(data["a"]["faces"], dtype=np.int64)
    vb = np.asarray(data["b"]["vertices"], dtype=np.float64)
    fb = np.asarray(data["b"]["faces"], dtype=np.int64)
    if va.ndim == 1: va = va.reshape(-1, 3)
    if fa.ndim == 1: fa = fa.reshape(-1, 3)
    if vb.ndim == 1: vb = vb.reshape(-1, 3)
    if fb.ndim == 1: fb = fb.reshape(-1, 3)
    try:
        r = connettore_pro.connetti(
            va, fa, vb, fb,
            gioco=float(data.get("gioco", 0.20)),
            lato=data.get("lato"), profondita=data.get("profondita"))
    except Exception as e:
        print("connettore fallito:", e, file=sys.stderr)
        return jsonify({"error": str(e)}), 500
    return jsonify({
        "a": {"vertices": r["a"]["vertices"].ravel().tolist(),
              "faces": r["a"]["faces"].ravel().tolist()},
        "b": {"vertices": r["b"]["vertices"].ravel().tolist(),
              "faces": r["b"]["faces"].ravel().tolist()},
        "log": r["log"], "connettore": r["connettore"],
    })


@app.route("/segment", methods=["POST", "OPTIONS"])
def segment():
    if request.method == "OPTIONS":
        return ("", 204)
    data = request.get_json(force=True)
    vertices, faces = _leggi_mesh(data)
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
    usato = "geometria"
    note = []

    # DETTAGLI IN RILIEVO: sopracciglia, occhi, labbra... cioe' i dettagli
    # morbidi che la segmentazione per pieghe non vede (non hanno spigoli).
    # Si aggiungono SOPRA, senza rovinare le parti grosse gia' trovate.
    if RILIEVI_AVAILABLE and data.get("dettagli", True):
        try:
            labels, info = rilievi.unisci_a_geometria(
                labels, vertices, faces,
                max_dettagli=int(data.get("max_dettagli", 8)),
                sensibilita=float(data.get("sensibilita_dettagli", 5)),
            )
            n = info.get("dettagli_aggiunti", 0)
            if n:
                usato = "geometria+dettagli"
                note.append(
                    f"{n} dettagli in rilievo separati (occhi, bottoni, placche). "
                    "Se ne ha presi troppi o troppo pochi, regola la sensibilita'. "
                    "I rilievi bassi quanto le ondulazioni della superficie "
                    "(spesso le sopracciglia sottili) vanno presi col pennello.")
        except Exception as e:
            print("rilievi falliti:", e, file=sys.stderr)

    return jsonify({
        "labels": np.asarray(labels, dtype=int).tolist(),
        "engine_used": usato,
        "note": note,
    })


if __name__ == "__main__":
    port = 8760
    print("Companion di segmentazione avviato su http://127.0.0.1:%d" % port)
    print("Motore AI:      ", "DISPONIBILE (GPU)" if AI_AVAILABLE else "non installato (uso geometria)")
    print("Riparazione PRO:", "DISPONIBILE (MeshLab)" if RIPARA_AVAILABLE else "non installata (install_pro.bat)")
    print("Booleane PRO:   ", "DISPONIBILI (manifold3d)" if TAGLIA_AVAILABLE else "non installate (install_pro.bat)")
    print("Connettore auto:", "ATTIVO (perno+foro esatti)" if CONN_AVAILABLE else "non disponibile")
    print("Dettagli rilievo:", "ATTIVO (sopracciglia, occhi...)" if RILIEVI_AVAILABLE else "non disponibile")
    app.run(host="127.0.0.1", port=port, threaded=True)
