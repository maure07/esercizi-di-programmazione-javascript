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


def _riduci_a_griglia(vertices, faces, obiettivo_facce):
    """Riduzione dei triangoli SENZA dipendenze esterne (raggruppamento su
    griglia): i vertici vicini vengono fusi in uno solo e i triangoli che
    collassano vengono buttati. Non e' raffinata come una decimazione a
    quadriche, ma qui serve solo a dare a SAM una mesh leggera su cui
    ragionare: le etichette vengono poi riportate sulla mesh piena.
    Soprattutto: funziona sempre, e quindi non si rischia piu' di ritrovarsi
    con la mesh intera e un'allocazione da terabyte.
    """
    V = np.asarray(vertices, dtype=np.float64)
    F = np.asarray(faces, dtype=np.int64)
    nF = len(F)
    if nF <= obiettivo_facce:
        return V, F
    lo = V.min(axis=0); hi = V.max(axis=0)
    diag = float(np.linalg.norm(hi - lo)) or 1.0
    # parti da una griglia proporzionale al numero di facce desiderate e
    # stringi finche' non si scende sotto l'obiettivo
    n = max(8, int(round((obiettivo_facce * 2.0) ** (1.0 / 3.0) * 3)))
    for _ in range(24):
        passo = diag / n
        chiavi = np.floor((V - lo) / passo).astype(np.int64)
        _, inv = np.unique(chiavi, axis=0, return_inverse=True)
        # posizione media di ogni cella
        nuovo_n = int(inv.max()) + 1
        somma = np.zeros((nuovo_n, 3)); conta = np.zeros(nuovo_n)
        np.add.at(somma, inv, V); np.add.at(conta, inv, 1.0)
        NV = somma / np.maximum(conta, 1)[:, None]
        NF = inv[F]
        # butta i triangoli degeneri (due o tre vertici finiti nella stessa cella)
        ok = (NF[:, 0] != NF[:, 1]) & (NF[:, 1] != NF[:, 2]) & (NF[:, 0] != NF[:, 2])
        NF = NF[ok]
        # e i doppioni
        if len(NF):
            NF = np.unique(np.sort(NF, axis=1), axis=0)
        if len(NF) <= obiettivo_facce or n <= 8:
            return NV, NF
        n = max(8, int(n * 0.75))
    return NV, NF


def _riduci_mesh(full_mesh, obiettivo_facce):
    """Prova le riduzioni buone; se non ci sono, usa quella a griglia.
    Non ritorna MAI la mesh intera: e' proprio quello che causava il crash."""
    import trimesh
    V = np.asarray(full_mesh.vertices, dtype=np.float64)
    F = np.asarray(full_mesh.faces, dtype=np.int64)
    if len(F) <= obiettivo_facce:
        return V, F
    # 1) decimazione a quadriche di trimesh (serve 'fast_simplification')
    for kw in ({"face_count": int(obiettivo_facce)}, {"percent": float(obiettivo_facce) / len(F)}):
        try:
            r = full_mesh.simplify_quadric_decimation(**kw)
            if 0 < len(r.faces) <= obiettivo_facce * 1.5:
                return np.asarray(r.vertices, dtype=np.float64), np.asarray(r.faces, dtype=np.int64)
        except Exception:
            pass
    # 2) open3d, se c'e'
    try:
        import open3d as o3d
        m = o3d.geometry.TriangleMesh(
            o3d.utility.Vector3dVector(V), o3d.utility.Vector3iVector(F))
        m = m.simplify_quadric_decimation(int(obiettivo_facce))
        NF = np.asarray(m.triangles, dtype=np.int64)
        if 0 < len(NF) <= obiettivo_facce * 1.5:
            return np.asarray(m.vertices, dtype=np.float64), NF
    except Exception:
        pass
    # 3) ripiego che funziona sempre
    return _riduci_a_griglia(V, F, obiettivo_facce)


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
    vertices, faces = _riduci_mesh(full_mesh, work_faces)
    nF = len(faces)
    print(f"[AI] mesh ridotta da {nF_full} a {nF} facce per l'analisi", flush=True)

    # BARRIERA DI SICUREZZA: la tabella delle affinita' occupa facce^2 x 4 byte.
    # Prima qui si arrivava a chiedere 2.41 TiB (con 813.448 facce) e il PC
    # andava in crisi. Ora si controlla PRIMA di allocare: se non ci sta in un
    # tetto ragionevole, si stringe ancora la mesh invece di provarci e morire.
    TETTO_GB = 1.5
    while nF > 1 and (nF * nF * 4) / (1024 ** 3) > TETTO_GB:
        nuovo = int(nF * 0.7)
        print(f"[AI] {nF} facce chiederebbero {(nF*nF*4)/(1024**3):.1f} GB: riduco a {nuovo}", flush=True)
        vertices, faces = _riduci_a_griglia(vertices, faces, nuovo)
        if len(faces) >= nF:      # non sta scendendo: fermati qui
            break
        nF = len(faces)

    # --- GPU: consumo di memoria video tenuto sotto controllo ---
    # Su una scheda da 8 GB, SAM con troppi punti per immagine in un colpo solo
    # riempie la memoria video e fa cadere tutto. Si limita quanti punti vengono
    # elaborati insieme (points_per_batch): il risultato e' identico, cambia solo
    # che il lavoro viene fatto a scaglioni. In piu' si dice a PyTorch di non
    # superare una quota della scheda, e si libera la memoria dopo ogni vista.
    libera_gb = 8.0
    try:
        libera_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    except Exception:
        pass
    if libera_gb <= 9:            # 8 GB (es. RTX 3060): vai leggero
        punti_lato, punti_lotto = 16, 32
    else:
        punti_lato, punti_lotto = 24, 64
    try:
        # non usare piu' dell'80% della scheda: lascia respirare Windows
        torch.cuda.set_per_process_memory_fraction(0.8, 0)
    except Exception:
        pass
    print(f"[AI] scheda video da {libera_gb:.1f} GB -> {punti_lato}x{punti_lato} punti, "
          f"lotti da {punti_lotto}", flush=True)

    sam = sam_model_registry[_MODEL_TYPE](checkpoint=_MODEL_PATH).to("cuda")
    try:
        gen = SamAutomaticMaskGenerator(sam, points_per_side=punti_lato,
                                        points_per_batch=punti_lotto)
    except TypeError:             # versioni piu' vecchie senza points_per_batch
        gen = SamAutomaticMaskGenerator(sam, points_per_side=punti_lato)

    # affinita' tra facce: quante volte finiscono nella stessa maschera
    aff = np.zeros((nF, nF), dtype=np.float32)
    seen = np.zeros(nF, dtype=np.float32)

    for iv, (color, face_id) in enumerate(_render_views(vertices, faces, n_views=n_views)):
        with torch.inference_mode():     # niente gradienti: meta' memoria video
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
        del masks
        try:
            torch.cuda.empty_cache()     # restituisci la memoria video tra una vista e l'altra
        except Exception:
            pass
        print(f"[AI] vista {iv + 1}/{n_views}", flush=True)

    # il modello non serve piu': libera subito la scheda
    try:
        del gen, sam
        torch.cuda.empty_cache()
    except Exception:
        pass

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
