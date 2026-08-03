"""
prova_ai_finta.py
Esegue TUTTO il percorso del motore AI su questa macchina, sostituendo con
finti le tre cose che richiedono la scheda video: PyTorch, SAM e il renderer.
Serve a scoprire qui gli errori di programmazione (variabili sbagliate, indici
fuori posto) invece di scoprirli sul PC dell'utente a meta' elaborazione.

Uso:  python prova_ai_finta.py
"""
import sys
import types
import numpy as np


# --------------------------------------------------------------------------
# finti moduli: torch, segment_anything
# --------------------------------------------------------------------------
def _installa_finti():
    torch = types.ModuleType("torch")

    class _Props:
        total_memory = 8 * 1024 ** 3

    class _Cuda:
        @staticmethod
        def is_available():
            return True

        @staticmethod
        def get_device_properties(i):
            return _Props()

        @staticmethod
        def empty_cache():
            pass

        @staticmethod
        def set_per_process_memory_fraction(f, d):
            pass

    class _Inference:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    class _Tensor:                 # scipy interroga torch.Tensor: serve esistere
        pass

    torch.Tensor = _Tensor
    torch.cuda = _Cuda()
    torch.inference_mode = lambda: _Inference()
    sys.modules["torch"] = torch

    sa = types.ModuleType("segment_anything")

    class _FintoSam:
        def to(self, dev):
            return self

    class _Generatore:
        def __init__(self, sam, points_per_side=16, points_per_batch=None):
            self.n = points_per_side

        def generate(self, img):
            """Maschere finte come quelle vere di SAM: una che copre TUTTO
            l'oggetto (inutile, va scartata) piu' alcune che ritagliano parti."""
            h, w = img.shape[:2]
            fuori = []
            tutta = np.ones((h, w), dtype=bool)
            fuori.append({"segmentation": tutta})       # quella che rovina tutto
            for k in range(4):
                m = np.zeros((h, w), dtype=bool)
                m[k * h // 4:(k + 1) * h // 4, :] = True
                fuori.append({"segmentation": m})
            return fuori

    sa.sam_model_registry = {"vit_b": lambda checkpoint=None: _FintoSam()}
    sa.SamAutomaticMaskGenerator = _Generatore
    sys.modules["segment_anything"] = sa


def _finte_viste(vertices, faces, n_views=12, res=256):
    """Sostituisce il renderer: immagine grigia + buffer con gli id delle facce.
    Mette apposta qualche id FUORI INTERVALLO, come fa il renderer vero quando
    sfuma i colori sui bordi: serve a verificare che vengano scartati."""
    # Il renderer vero disegna facce VICINE in pixel vicini: le maschere di SAM
    # raccolgono quindi gruppi di facce coerenti. Qui si imita quel
    # comportamento assegnando gli identificativi a fasce, altrimenti si
    # otterrebbe rumore e nessun raggruppamento avrebbe senso.
    nF = len(faces)
    for _ in range(n_views):
        color = np.full((res, res, 3), 128, dtype=np.uint8)
        righe = (np.arange(res) * nF // res).reshape(-1, 1)
        face_id = np.repeat(righe, res, axis=1).astype(np.int64)
        face_id += (np.arange(res) % max(1, nF // res)).reshape(1, -1)
        face_id = np.clip(face_id, 0, nF - 1)
        # sporca il bordo con identificativi inventati, come fa quello vero
        # quando sfuma i colori: devono venire scartati
        face_id[0, :] = nF + 12
        face_id[-1, :] = nF + 3
        yield color, face_id


def main():
    _installa_finti()
    import trimesh
    import segmenta_ai

    # niente file del modello SAM su disco: si salta il controllo
    segmenta_ai._MODEL_PATH = "finto.pth"
    segmenta_ai._render_views = _finte_viste

    for nome, m in [
        ("piccola (5.120 facce)", trimesh.creation.icosphere(subdivisions=4)),
        ("grande (327.680 facce)", trimesh.creation.icosphere(subdivisions=7)),
    ]:
        print("\n=== %s ===" % nome)
        etichette = segmenta_ai.segment(
            np.asarray(m.vertices), np.asarray(m.faces),
            target_parts=6, n_views=4)
        etichette = np.asarray(etichette)
        assert len(etichette) == len(m.faces), \
            "attese %d etichette, ottenute %d" % (len(m.faces), len(etichette))
        assert etichette.min() >= 0, "etichette negative"
        print("  OK: %d etichette, %d parti distinte"
              % (len(etichette), len(set(etichette.tolist()))))

    # --- la rete di sicurezza deve scattare quando l'AI non legge le facce ---
    print("\n=== caso limite: il renderer non produce identificativi validi ===")

    def _viste_rotte(vertices, faces, n_views=12, res=256):
        nF = len(faces)
        for _ in range(n_views):
            color = np.full((res, res, 3), 128, dtype=np.uint8)
            # tutti gli identificativi fuori intervallo, come se il renderer
            # alterasse i colori che li trasportano
            face_id = np.full((res, res), nF + 500, dtype=np.int64)
            yield color, face_id

    segmenta_ai._render_views = _viste_rotte
    m = trimesh.creation.icosphere(subdivisions=4)
    try:
        segmenta_ai.segment(np.asarray(m.vertices), np.asarray(m.faces),
                            target_parts=6, n_views=3)
        print("  ERRORE: doveva rifiutarsi, invece ha restituito un risultato")
        raise SystemExit(1)
    except RuntimeError as e:
        print("  OK: si e' fermata dicendo ->", e)

    print("\nRISULTATO: PERCORSO AI COMPLETO SENZA ERRORI")


if __name__ == "__main__":
    main()
