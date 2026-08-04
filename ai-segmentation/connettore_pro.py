"""
connettore_pro.py
Perno + foro AUTOMATICI fra due pezzi, con booleane ESATTE (manifold3d).

Perche' serviva rifarlo: la versione precedente ricostruiva l'INTERO pezzo su
una griglia a voxel per aggiungere il perno. Anche alla massima qualita' questo
ri-approssima tutta la superficie e il modello si rovina. Qui invece la
booleana tocca solo il volume del perno e del foro: tutto il resto della mesh
resta identico, triangolo per triangolo.

E' anche AUTOMATICO: non si sceglie un punto a mano. Si trova da soli il punto
dove i due pezzi si toccano davvero (la faccia di taglio), e li' si mette il
perno, orientato perpendicolare a quella faccia.
"""
import numpy as np


def _manifold(V, F):
    from manifold3d import Manifold, Mesh
    return Manifold(Mesh(
        vert_properties=np.asarray(V, dtype=np.float32),
        tri_verts=np.asarray(F, dtype=np.uint32)))


def _to_arrays(mm):
    m = mm.to_mesh()
    return (np.asarray(m.vert_properties[:, :3], dtype=np.float64),
            np.asarray(m.tri_verts, dtype=np.int64))


def _base_da_normale(n):
    n = np.asarray(n, dtype=np.float64)
    n = n / (np.linalg.norm(n) or 1.0)
    tmp = np.array([0.0, 0.0, 1.0])
    if abs(float(np.dot(tmp, n))) > 0.9:
        tmp = np.array([1.0, 0.0, 0.0])
    u = np.cross(tmp, n); u /= (np.linalg.norm(u) or 1.0)
    v = np.cross(n, u)
    return u, v, n


def _cubo(dimensioni, centro, u, v, n):
    from manifold3d import Manifold
    c = Manifold.cube(list(np.asarray(dimensioni, dtype=float)), center=True)
    M = np.zeros((3, 4), dtype=float)
    M[:, 0] = u; M[:, 1] = v; M[:, 2] = n; M[:, 3] = centro
    return c.transform(M)


def trova_contatto(vA, fA, vB, fB, tolleranza=None):
    """Dove si toccano i due pezzi: centro della zona di contatto e direzione
    perpendicolare ad essa (rivolta da A verso B)."""
    import trimesh
    A = trimesh.Trimesh(vertices=np.asarray(vA, dtype=np.float64),
                        faces=np.asarray(fA, dtype=np.int64), process=False)
    B = trimesh.Trimesh(vertices=np.asarray(vB, dtype=np.float64),
                        faces=np.asarray(fB, dtype=np.int64), process=False)
    if tolleranza is None:
        diag = float(np.linalg.norm(A.extents)) or 1.0
        tolleranza = diag * 0.02

    centri = A.triangles_center
    # Distanza di ogni triangolo di A dalla superficie di B. Il metodo preciso
    # di trimesh richiede la libreria 'rtree'; se manca si usa la distanza dai
    # VERTICI di B, che per trovare la zona di contatto va benissimo. Cosi' una
    # libreria assente non blocca la funzione.
    distanza = None
    try:
        from trimesh.proximity import closest_point
        _, distanza, _ = closest_point(B, centri)
    except Exception as e:
        try:
            from scipy.spatial import cKDTree
            distanza, _ = cKDTree(np.asarray(B.vertices)).query(centri, k=1)
        except Exception:
            raise ValueError("non riesco a misurare la distanza fra i pezzi: %s" % e)
    tocca = distanza <= tolleranza
    if not tocca.any():
        # allarga finche' non si trova qualcosa
        for k in (2.0, 4.0, 8.0):
            tocca = distanza <= tolleranza * k
            if tocca.any():
                break
    if not tocca.any():
        raise ValueError("i due pezzi non si toccano da nessuna parte")

    aree = A.area_faces[tocca]
    centro = np.average(centri[tocca], axis=0, weights=aree)
    # direzione: perpendicolare media della zona di contatto, rivolta verso B
    nrm = np.average(A.face_normals[tocca], axis=0, weights=aree)
    if np.linalg.norm(nrm) < 1e-9:
        nrm = B.bounds.mean(axis=0) - A.bounds.mean(axis=0)
    nrm = nrm / (np.linalg.norm(nrm) or 1.0)
    verso = B.bounds.mean(axis=0) - centro
    if float(np.dot(nrm, verso)) < 0:
        nrm = -nrm

    # quanto e' larga la zona di contatto (serve a dimensionare il perno)
    u, v, _ = _base_da_normale(nrm)
    pc = centri[tocca]
    larghezza = min(float(np.ptp(pc @ u)), float(np.ptp(pc @ v)))
    return centro, nrm, larghezza, int(tocca.sum())


def connetti(vA, fA, vB, fB, gioco=0.20, lato=None, profondita=None):
    """Mette perno su A e foro su B nel punto dove si toccano.

    Restituisce i due pezzi aggiornati. Il resto della mesh non viene toccato:
    la booleana e' esatta, non c'e' nessuna ricostruzione a voxel.
    """
    log = []
    centro, nrm, larghezza, n_facce = trova_contatto(vA, fA, vB, fB)
    log.append("Zona di contatto trovata su %d triangoli, larga %.1f mm"
               % (n_facce, larghezza))

    A = _manifold(vA, fA)
    B = _manifold(vB, fB)
    if A.status().name != "NoError" or B.status().name != "NoError":
        raise ValueError("un pezzo non e' un solido valido: passalo prima "
                         "dalla Riparazione PRO")
    volA0, volB0 = A.volume(), B.volume()

    if lato is None:
        lato = float(np.clip(0.35 * larghezza, 2.0, 10.0))
    if profondita is None:
        profondita = float(np.clip(0.9 * lato, 1.5, 8.0))
    log.append("Perno quadrato lato %.2f mm, profondita' %.2f mm, gioco %.2f mm"
               % (lato, profondita, gioco))

    u, v, n = _base_da_normale(nrm)
    # il perno affonda in A e sporge dentro B, cosi' resta ben attaccato
    dentro = profondita * 0.8
    h = dentro + profondita
    centro_perno = centro + n * (profondita - dentro) * 0.5
    perno = _cubo([lato, lato, h], centro_perno, u, v, n)
    foro = _cubo([lato + 2 * gioco, lato + 2 * gioco, h + gioco],
                 centro_perno + n * (gioco * 0.5), u, v, n)

    A2 = A + perno
    B2 = B - foro
    if A2.status().name != "NoError" or B2.status().name != "NoError":
        raise ValueError("la booleana del connettore non e' riuscita")

    log.append("Volumi: A %.1f -> %.1f (perno), B %.1f -> %.1f (foro)"
               % (volA0, A2.volume(), volB0, B2.volume()))
    va, fa = _to_arrays(A2)
    vb, fb = _to_arrays(B2)
    return {
        "a": {"vertices": va, "faces": fa},
        "b": {"vertices": vb, "faces": fb},
        "log": log,
        "connettore": {"lato": lato, "profondita": profondita, "gioco": gioco,
                       "centro": centro.tolist(), "direzione": n.tolist()},
    }
