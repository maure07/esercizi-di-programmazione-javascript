"""
taglia_pro.py
Tagli e booleane ESATTE con manifold3d (lo stesso tipo di motore usato dalle
booleane "exact" di Blender/OpenSCAD): niente superfici sporche, niente buchi,
niente facce compenetrate. Il risultato e' garantito manifold per costruzione.

In piu' mette IN AUTOMATICO il connettore: un perno QUADRATO su un pezzo e il
foro corrispondente (con gioco di accoppiamento) sulla controparte, cosi' i due
pezzi si incastrano e si allineano da soli.

Funzione principale:
    taglia_con_piano(vertices, faces, punto, normale, ...)
      -> { "a": {...}, "b": {...} }   due solidi chiusi, gia' con perno e foro
"""
import numpy as np


# ---------------------------------------------------------------------------
# utilita' geometriche
# ---------------------------------------------------------------------------
def _normalizza(v):
    v = np.asarray(v, dtype=np.float64)
    n = float(np.linalg.norm(v))
    return v / n if n > 1e-12 else np.array([0.0, 0.0, 1.0])


def _base_da_normale(n):
    """Base ortonormale (u, v, n) con n come terzo asse."""
    n = _normalizza(n)
    tmp = np.array([0.0, 0.0, 1.0])
    if abs(float(np.dot(tmp, n))) > 0.9:
        tmp = np.array([1.0, 0.0, 0.0])
    u = _normalizza(np.cross(tmp, n))
    v = np.cross(n, u)
    return u, v, n


def _manifold(V, F):
    from manifold3d import Manifold, Mesh
    return Manifold(Mesh(
        vert_properties=np.asarray(V, dtype=np.float32),
        tri_verts=np.asarray(F, dtype=np.uint32),
    ))


def _to_arrays(mm):
    m = mm.to_mesh()
    V = np.asarray(m.vert_properties[:, :3], dtype=np.float64)
    F = np.asarray(m.tri_verts, dtype=np.int64)
    return V, F


def _cubo(dimensioni, centro, u, v, n):
    """Cubo/parallelepipedo orientato: dimensioni lungo (u, v, n), centrato su `centro`."""
    from manifold3d import Manifold
    c = Manifold.cube(list(np.asarray(dimensioni, dtype=float)), center=True)
    # matrice 3x4 (rotazione + traslazione) accettata da transform
    M = np.zeros((3, 4), dtype=float)
    M[:, 0] = u
    M[:, 1] = v
    M[:, 2] = n
    M[:, 3] = centro
    return c.transform(M)


# ---------------------------------------------------------------------------
# sezione del taglio: dove mettere il connettore e quanto grande
# ---------------------------------------------------------------------------
def _sezione(V, F, punto, normale, tolleranza):
    """Centroide e mezze-estensioni (lungo u, v) della faccia di taglio."""
    u, v, n = _base_da_normale(normale)
    P = np.asarray(V, dtype=np.float64)
    d = (P - np.asarray(punto, dtype=float)) @ n
    vicini = P[np.abs(d) <= tolleranza]
    if len(vicini) < 3:
        # ripiego: usa tutto il modello proiettato
        vicini = P
    cu = vicini @ u
    cv = vicini @ v
    centro = (
        np.asarray(punto, dtype=float)
        + u * (0.5 * (cu.min() + cu.max()))
        + v * (0.5 * (cv.min() + cv.max()))
    )
    # riporta il centro esattamente sul piano di taglio
    centro = centro - n * float((centro - np.asarray(punto, dtype=float)) @ n)
    est_u = 0.5 * float(cu.max() - cu.min())
    est_v = 0.5 * float(cv.max() - cv.min())
    return centro, est_u, est_v, (u, v, n)


# ---------------------------------------------------------------------------
# taglio + connettore quadrato automatico
# ---------------------------------------------------------------------------
def taglia_con_piano(vertices, faces, punto, normale,
                     connettore=True, gioco=0.20, lato=None, profondita=None,
                     n_connettori=1):
    """Taglia il solido con un piano e mette perno quadrato + foro.

    punto, normale : piano di taglio
    gioco          : gioco di accoppiamento per lato, in mm (0.2 va bene per PLA/FDM)
    lato           : lato del perno quadrato in mm (auto se None)
    profondita     : quanto sporge il perno in mm (auto se None)
    n_connettori   : 1 = uno centrale; 2 = due affiancati (contro la rotazione)

    Ritorna {"a": {...}, "b": {...}, "log": [...]}
      a = lato dalla parte della normale (ha il PERNO)
      b = lato opposto (ha il FORO)
    """
    log = []
    V = np.asarray(vertices, dtype=np.float64)
    F = np.asarray(faces, dtype=np.int64)
    n = _normalizza(normale)
    punto = np.asarray(punto, dtype=np.float64)
    offset = float(np.dot(punto, n))

    solido = _manifold(V, F)
    if solido.status().name != "NoError":
        raise ValueError(
            "Il modello non e' un solido valido: passalo prima dalla riparazione."
        )
    vol0 = solido.volume()

    # --- taglio esatto ---
    A = solido.trim_by_plane(list(n), offset)        # lato +normale
    B = solido.trim_by_plane(list(-n), -offset)      # lato -normale
    log.append(f"Taglio esatto: volume {vol0:.1f} -> A {A.volume():.1f} + B {B.volume():.1f}")

    if A.volume() <= 0 or B.volume() <= 0:
        raise ValueError("Il piano non taglia il modello in due parti.")

    if not connettore:
        va, fa = _to_arrays(A)
        vb, fb = _to_arrays(B)
        return {"a": _pack(va, fa), "b": _pack(vb, fb), "log": log}

    # --- misura della faccia di taglio ---
    diag = float(np.linalg.norm(V.max(axis=0) - V.min(axis=0))) or 1.0
    centro, est_u, est_v, (u, v, nn) = _sezione(V, F, punto, n, tolleranza=diag * 0.01)
    minore = 2.0 * min(est_u, est_v)

    if lato is None:
        # perno grande abbastanza da tenere, piccolo abbastanza da entrare
        lato = float(np.clip(0.28 * minore, 2.0, 10.0))
    if profondita is None:
        profondita = float(np.clip(0.9 * lato, 1.5, 8.0))
    log.append(
        f"Connettore quadrato automatico: lato {lato:.2f} mm, "
        f"profondita' {profondita:.2f} mm, gioco {gioco:.2f} mm"
    )

    # posizioni dei perni sulla faccia di taglio
    if n_connettori <= 1:
        centri = [centro]
    else:
        passo = max(lato * 1.6, min(est_u, est_v))
        centri = [centro + u * passo, centro - u * passo]

    from manifold3d import Manifold
    perni = []
    fori = []
    for c in centri:
        # il perno appartiene ad A: sporge dal piano verso il lato di B
        # (lungo -n), con un pelo di incastro dentro A per fondersi bene
        incastro = 0.15 * profondita
        h = profondita + incastro
        centro_perno = c - nn * (profondita * 0.5) + nn * (incastro * 0.5)
        perni.append(_cubo([lato, lato, h], centro_perno, u, v, nn))
        # il foro e' il perno maggiorato del gioco su ogni lato
        h_foro = h + gioco
        centro_foro = c - nn * (profondita * 0.5) + nn * (incastro * 0.5) - nn * (gioco * 0.5)
        fori.append(_cubo(
            [lato + 2 * gioco, lato + 2 * gioco, h_foro], centro_foro, u, v, nn
        ))

    # --- booleane esatte ---
    for p in perni:
        A = A + p          # unione: il perno diventa parte di A
    for f in fori:
        B = B - f          # differenza: il foro viene scavato in B

    if A.status().name != "NoError" or B.status().name != "NoError":
        raise ValueError("La booleana del connettore non e' riuscita.")

    log.append(f"Con connettore: A {A.volume():.1f} (perno), B {B.volume():.1f} (foro)")
    va, fa = _to_arrays(A)
    vb, fb = _to_arrays(B)
    return {
        "a": _pack(va, fa),
        "b": _pack(vb, fb),
        "log": log,
        "connettore": {"lato": lato, "profondita": profondita, "gioco": gioco,
                       "n": len(centri)},
    }


def _pack(V, F):
    import trimesh
    m = trimesh.Trimesh(vertices=V, faces=F, process=False)
    return {
        "vertices": V,
        "faces": F,
        "watertight": bool(m.is_watertight),
        "volume": float(m.volume),
    }


# ---------------------------------------------------------------------------
# booleana generica fra due solidi (utile per unire/sottrarre parti)
# ---------------------------------------------------------------------------
def booleana(v1, f1, v2, f2, operazione="unione"):
    a = _manifold(v1, f1)
    b = _manifold(v2, f2)
    if operazione in ("unione", "union", "+"):
        r = a + b
    elif operazione in ("differenza", "difference", "-"):
        r = a - b
    elif operazione in ("intersezione", "intersection", "&"):
        r = a ^ b
    else:
        raise ValueError("operazione sconosciuta: " + str(operazione))
    if r.status().name != "NoError":
        raise ValueError("booleana fallita: " + r.status().name)
    V, F = _to_arrays(r)
    return _pack(V, F)
