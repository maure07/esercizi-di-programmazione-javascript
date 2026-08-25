"""
segmenta_geometria.py
Motore di segmentazione GEOMETRICA (per forma) che gira in locale sul PC.
Usa trimesh per una topologia robusta: cresce le regioni attraverso gli spigoli
piatti/convessi e taglia lungo le pieghe CONCAVE marcate (dove tipicamente un
pezzo incontra l'altro), poi consolida i frammenti e fonde fino al numero di
parti richiesto. E' la base "senza GPU": affidabile e immediata. Il motore AImo
(SAM multi-vista) si aggiunge sopra questa stessa interfaccia.

Input:  vertices (N,3), faces (M,3), target_parts
Output: labels (M,) int  -> etichetta di parte per ogni triangolo
"""
import numpy as np


def _union_find(n):
    parent = np.arange(n)

    def find(x):
        root = x
        while parent[root] != root:
            root = parent[root]
        while parent[x] != root:
            parent[x], x = root, parent[x]
        return root

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra
        return ra

    return find, union


def segment(vertices, faces, target_parts=8, crease_percentile=0.55,
            min_crease_deg=4.0, max_crease_deg=35.0, min_region_area_frac=0.002,
            ripulisci=True, passate_ripulitura=None):
    import trimesh
    faces = np.asarray(faces, dtype=np.int64)
    vertices = np.asarray(vertices, dtype=np.float64)
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    nF = len(faces)
    if nF == 0:
        return np.zeros(0, dtype=np.int64)

    # RIPULITURA DAL RUMORE prima di cercare le pieghe.
    # I modelli generati dall'AI hanno la superficie increspata a livello di
    # singolo triangolo. Quelle increspature sembrano pieghe: misurato su un
    # modello di prova, angoli diedri concavi fino a 78 gradi dove la forma e'
    # in realta' liscia. Senza questo passaggio la segmentazione spezzetta il
    # modello in chiazze a caso. Si leviga una COPIA (Taubin, che non
    # restringe) solo per misurare gli angoli: le etichette restano sui
    # triangoli originali, quindi non si perde nessun dettaglio.
    geo = mesh
    if ripulisci:
        if passate_ripulitura is None:
            passate_ripulitura = 12
        try:
            pulita = mesh.copy()
            trimesh.smoothing.filter_taubin(pulita, iterations=int(passate_ripulitura))
            geo = pulita
        except Exception:
            geo = mesh

    fn = geo.face_normals
    areas = mesh.area_faces
    total_area = float(areas.sum()) or 1.0
    centroids = mesh.triangles_center

    adj = mesh.face_adjacency                 # (E,2) coppie di facce
    if len(adj) == 0:
        return np.zeros(nF, dtype=np.int64)
    angles = geo.face_adjacency_angles         # angolo diedro (rad), sulla copia pulita
    convex = geo.face_adjacency_convex         # True se convesso
    # lunghezza dello spigolo condiviso
    edges = mesh.face_adjacency_edges
    elen = np.linalg.norm(vertices[edges[:, 0]] - vertices[edges[:, 1]], axis=1)

    concave = ~convex
    # soglia adattiva sulla distribuzione degli angoli concavi
    conc_ang = angles[concave]
    thr = np.deg2rad(max_crease_deg)
    if len(conc_ang) > 0:
        p = np.quantile(conc_ang, crease_percentile)
        thr = min(np.deg2rad(max_crease_deg), max(np.deg2rad(min_crease_deg), p * 0.9))

    is_cut = concave & (angles >= thr)

    find, union = _union_find(nF)
    for k in range(len(adj)):
        if not is_cut[k]:
            union(int(adj[k, 0]), int(adj[k, 1]))

    def region_areas():
        r = np.array([find(i) for i in range(nF)])
        out = {}
        for i in range(nF):
            out[r[i]] = out.get(r[i], 0.0) + areas[i]
        return r, out

    min_area = total_area * min_region_area_frac

    # assorbi i frammenti piccoli nel vicino con cui condividono piu' confine
    cut_idx = np.where(is_cut)[0]
    for _ in range(8):
        r, ra = region_areas()
        neigh = {}
        for k in cut_idx:
            a, b = find(int(adj[k, 0])), find(int(adj[k, 1]))
            if a == b:
                continue
            if ra.get(a, 0) < min_area:
                neigh.setdefault(a, {}); neigh[a][b] = neigh[a].get(b, 0.0) + elen[k]
            if ra.get(b, 0) < min_area:
                neigh.setdefault(b, {}); neigh[b][a] = neigh[b].get(a, 0.0) + elen[k]
        changed = False
        for small, m in neigh.items():
            if find(small) != small:
                continue
            best = max(m, key=m.get)
            union(find(best), small)
            changed = True
        if not changed:
            break

    # fondi lungo i confini piu' DEBOLI (poca concavita' x poca lunghezza) fino
    # a scendere al numero di parti richiesto
    pair = {}
    for k in cut_idx:
        a, b = find(int(adj[k, 0])), find(int(adj[k, 1]))
        if a == b:
            continue
        key = (a, b) if a < b else (b, a)
        d = pair.setdefault(key, [0.0, 0.0, 0])   # sum(1-cos), sumLen, n  (usiamo angolo)
        d[0] += angles[k]
        d[1] += elen[k]
        d[2] += 1
    pairs = []
    for (a, b), (sang, slen, n) in pair.items():
        strength = (sang / n) * np.sqrt(slen)
        pairs.append((strength, a, b))
    pairs.sort()
    r = np.array([find(i) for i in range(nF)])
    region_count = len(np.unique(r))
    for strength, a, b in pairs:
        if region_count <= target_parts:
            break
        ra, rb = find(a), find(b)
        if ra == rb:
            continue
        union(ra, rb)
        region_count -= 1

    # etichette finali 0..k-1 ordinate per area decrescente
    r = np.array([find(i) for i in range(nF)])
    roots, inv = np.unique(r, return_inverse=True)
    root_area = np.zeros(len(roots))
    np.add.at(root_area, inv, areas)
    order = np.argsort(-root_area)
    remap = np.empty(len(roots), dtype=np.int64)
    remap[order] = np.arange(len(roots))
    return remap[inv]
