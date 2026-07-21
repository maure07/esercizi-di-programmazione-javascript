"""
segmenta_ai.py  —  MOTORE AI (SAM multi-vista), usa la GPU (RTX 3060)

Idea: rende il modello da tante angolazioni, su ogni immagine fa girare
"Segment Anything" (SAM) che trova le regioni coerenti, poi RIPROIETTA le maschere
sul 3D leggendo un buffer con l'ID di ogni triangolo. Le facce che finiscono
spesso nella stessa maschera (viste diverse) diventano la stessa parte. Alla fine
si raggruppa nel numero di parti richiesto.

Funziona anche su modelli SENZA colore (SAM lavora sull'ombreggiatura/forma).

Dipendenze (installate da install_ai.bat):
    torch (con CUDA), segment-anything, pyrender, pillow, scikit-learn
    + il checkpoint del modello SAM (sam_vit_b_01ec64.pth)

NOTA: questo motore va collaudato la prima volta sul PC con la GPU. Se qualcosa
non va, il server ripiega automaticamente sul motore geometrico.
"""
import os
import numpy as np

_MODEL_PATH = os.environ.get("SAM_CHECKPOINT", os.path.join(os.path.dirname(__file__), "models", "sam_vit_b_01ec64.pth"))
_MODEL_TYPE = os.environ.get("SAM_MODEL_TYPE", "vit_b")


def is_available():
    """True solo se torch+CUDA, SAM, pyrender e il checkpoint ci sono."""
    try:
        import torch
        import segment_anything  # noqa: F401
        import pyrender  # noqa: F401
        if not torch.cuda.is_available():
            return False
        return os.path.exists(_MODEL_PATH)
    except Exception:
        return False


def _camera_poses(n_views, radius):
    """n_views telecamere distribuite su una sfera che guardano l'origine."""
    poses = []
    golden = np.pi * (3 - np.sqrt(5))
    for i in range(n_views):
        y = 1 - (i / max(1, n_views - 1)) * 2
        r = np.sqrt(max(0.0, 1 - y * y))
        theta = golden * i
        dir_ = np.array([np.cos(theta) * r, y, np.sin(theta) * r])
        eye = dir_ * radius
        # matrice look-at (verso l'origine)
        f = -dir_ / (np.linalg.norm(dir_) + 1e-9)
        up = np.array([0, 1, 0.0])
        if abs(f[1]) > 0.99:
            up = np.array([0, 0, 1.0])
        s = np.cross(f, up); s /= np.linalg.norm(s) + 1e-9
        u = np.cross(s, f)
        M = np.eye(4)
        M[:3, 0] = s; M[:3, 1] = u; M[:3, 2] = -f; M[:3, 3] = eye
        poses.append(M)
    return poses


def _render_views(vertices, faces, n_views=12, res=1024):
    """Per ogni vista restituisce (immagine_shaded RGB, buffer_id_faccia)."""
    import trimesh
    import pyrender

    mesh_t = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    center = mesh_t.bounds.mean(axis=0)
    mesh_t.apply_translation(-center)
    radius = float(np.linalg.norm(mesh_t.extents)) * 1.1 + 1e-6

    # mesh ombreggiata (grigia) per SAM
    shaded = pyrender.Mesh.from_trimesh(mesh_t, smooth=False)

    # mesh con ID faccia codificato nel colore (unlit): ogni faccia 3 vertici unici
    fid = np.arange(len(faces))
    col = np.empty((len(faces), 3), dtype=np.uint8)
    col[:, 0] = (fid & 255)
    col[:, 1] = ((fid >> 8) & 255)
    col[:, 2] = ((fid >> 16) & 255)
    vcol = np.repeat(col, 3, axis=0)
    tv = mesh_t.vertices[mesh_t.faces].reshape(-1, 3)
    tf = np.arange(len(tv)).reshape(-1, 3)
    id_trim = trimesh.Trimesh(vertices=tv, faces=tf, process=False)
    id_trim.visual.vertex_colors = np.concatenate([vcol, np.full((len(vcol), 1), 255, np.uint8)], axis=1)
    id_mesh = pyrender.Mesh.from_trimesh(id_trim, smooth=False)

    r = pyrender.OffscreenRenderer(res, res)
    cam = pyrender.PerspectiveCamera(yfov=np.pi / 3.0)
    poses = _camera_poses(n_views, radius / np.tan(np.pi / 6.0))
    out = []
    for pose in poses:
        sc = pyrender.Scene(bg_color=[0, 0, 0, 0], ambient_light=[0.4, 0.4, 0.4])
        sc.add(shaded)
        sc.add(cam, pose=pose)
        light = pyrender.DirectionalLight(color=[1, 1, 1], intensity=3.0)
        sc.add(light, pose=pose)
        color, _ = r.render(sc)

        sc2 = pyrender.Scene(bg_color=[0, 0, 0, 0], ambient_light=[1, 1, 1])
        sc2.add(id_mesh)
        sc2.add(cam, pose=pose)
        idimg, _ = r.render(sc2, flags=pyrender.RenderFlags.FLAT)
        face_id = idimg[:, :, 0].astype(np.int64) | (idimg[:, :, 1].astype(np.int64) << 8) | (idimg[:, :, 2].astype(np.int64) << 16)
        # sfondo (nero) -> -1
        bg = (idimg.sum(axis=2) == 0)
        face_id[bg] = -1
        out.append((color, face_id))
    r.delete()
    return out


def segment(vertices, faces, target_parts=8, n_views=12, work_faces=6000):
    import torch
    import trimesh
    from segment_anything import sam_model_registry, SamAutomaticMaskGenerator
    from sklearn.cluster import AgglomerativeClustering

    vertices_full = np.asarray(vertices, dtype=np.float64)
    faces_full = np.asarray(faces, dtype=np.int64)
    nF_full = len(faces_full)

    # DECIMAZIONE: SAM+affinita' lavorano su una mesh piu' leggera (la matrice
    # di affinita' e' O(facce^2)); poi le etichette si trasferiscono alla mesh
    # piena per faccia piu' vicina. Indispensabile sui modelli densi (800k tri).
    full_mesh = trimesh.Trimesh(vertices=vertices_full, faces=faces_full, process=False)
    if nF_full > work_faces:
        try:
            work = full_mesh.simplify_quadric_decimation(work_faces)
        except Exception:
            work = full_mesh
    else:
        work = full_mesh
    vertices = np.asarray(work.vertices, dtype=np.float64)
    faces = np.asarray(work.faces, dtype=np.int64)
    nF = len(faces)

    sam = sam_model_registry[_MODEL_TYPE](checkpoint=_MODEL_PATH).to("cuda")
    gen = SamAutomaticMaskGenerator(sam, points_per_side=24)

    # affinita' tra facce: quante volte finiscono nella stessa maschera
    aff = np.zeros((nF, nF), dtype=np.float32)
    seen = np.zeros(nF, dtype=np.float32)

    for color, face_id in _render_views(vertices, faces, n_views=n_views):
        masks = gen.generate(color[:, :, :3])
        for m in masks:
            seg = m["segmentation"]
            fids = face_id[seg]
            fids = fids[fids >= 0]
            if len(fids) < 3:
                continue
            uniq = np.unique(fids)
            seen[uniq] += 1
            # incrementa l'affinita' tra tutte le facce di questa maschera
            aff[np.ix_(uniq, uniq)] += 1.0

    # facce mai viste: attaccale via geometria alla fine
    np.fill_diagonal(aff, 0)
    denom = np.maximum(seen[:, None] + seen[None, :], 1.0)
    affn = aff / denom  # normalizza

    # distanza = 1 - affinita'; clustering agglomerativo al numero di parti
    dist = 1.0 - affn
    np.fill_diagonal(dist, 0)
    k = max(1, min(target_parts, nF))
    cl = AgglomerativeClustering(n_clusters=k, metric="precomputed", linkage="average")
    labels = cl.fit_predict(dist)

    # facce non viste (seen==0): assegnale alla parte del vicino piu' votato
    import trimesh
    mt = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    adj = mt.face_adjacency
    for _ in range(6):
        unseen = np.where(seen == 0)[0]
        if len(unseen) == 0:
            break
        changed = False
        us = set(unseen.tolist())
        for a, b in adj:
            if a in us and b not in us:
                labels[a] = labels[b]; seen[a] = 1e-6; us.discard(a); changed = True
            elif b in us and a not in us:
                labels[b] = labels[a]; seen[b] = 1e-6; us.discard(b); changed = True
        if not changed:
            break

    labels = labels.astype(np.int64)

    # trasferimento alla mesh PIENA: ogni faccia originale prende l'etichetta
    # della faccia lavorata piu' vicina (per baricentro)
    if nF != nF_full:
        from scipy.spatial import cKDTree
        work_centroids = np.asarray(work.triangles_center)
        full_centroids = np.asarray(full_mesh.triangles_center)
        tree = cKDTree(work_centroids)
        _, idx = tree.query(full_centroids, k=1)
        labels = labels[idx]

    return labels.astype(np.int64)
