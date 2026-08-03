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
            """Maschere finte: fasce orizzontali dell'immagine."""
            h, w = img.shape[:2]
            fuori = []
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
    nF = len(faces)
    rng = np.random.default_rng(0)
    for _ in range(n_views):
        color = np.full((res, res, 3), 128, dtype=np.uint8)
        face_id = rng.integers(-1, nF, size=(res, res)).astype(np.int64)
        # sporca il bordo con id inventati, come il renderer vero
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

    print("\nRISULTATO: PERCORSO AI COMPLETO SENZA ERRORI")


if __name__ == "__main__":
    main()
