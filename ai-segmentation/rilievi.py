"""
rilievi.py
Trova i DETTAGLI IN RILIEVO su una superficie: occhi, bottoni, decorazioni,
placche... cioe' i dettagli morbidi che la segmentazione "per pieghe" si perde,
perche' non hanno spigoli netti.

COME FUNZIONA (e perche' cosi')
I modelli generati dall'AI hanno la superficie ONDULATA: un rumore di qualche
decimo di mm sparso ovunque. Un rilevatore ingenuo scambia quel rumore per
dettagli e riempie il modello di macchie. Per evitarlo si lavora a SCALE FISICHE
controllate, in millimetri:

  1. si fa la media delle posizioni entro un raggio piccolo (R1): toglie il
     rumore fine ma tiene i dettagli;
  2. si fa la media entro un raggio grande (R2): e' la superficie "di base",
     cioe' come sarebbe senza dettagli;
  3. la differenza fra le due, misurata lungo la normale, e' l'altezza del
     dettaglio;
  4. si sottrae la media locale di quella misura: cosi' si toglie l'effetto
     della CURVATURA (una testa tonda sporge ovunque, e senza questo passaggio
     sembrerebbe tutta un dettaglio). E' il passaggio che fa la differenza:
     misurato sul modello di prova, il contrasto degli occhi passa da 1.5x a 6x.

Infine si tengono solo le zone COMPATTE e di dimensione plausibile: il rumore
produce chiazze sfilacciate, un occhio produce una macchia tonda.

LIMITE, detto chiaramente: se un dettaglio e' basso quanto il rumore della
superficie (tipico delle sopracciglia sottili, ~0.7mm su un rumore di ~0.6mm)
non e' distinguibile per via geometrica. Per quelli conviene il pennello.
"""
import numpy as np


# ---------------------------------------------------------------------------
# misura dell'altezza del rilievo
# ---------------------------------------------------------------------------
def altezza_rilievo(mesh, raggio_fine=None, raggio_base=None):
    """Altezza del rilievo per vertice, a scale fisiche controllate (mm).

    raggio_fine: sotto questa dimensione e' rumore da ignorare
    raggio_base: sopra questa dimensione e' forma generale, non dettaglio
    """
    from scipy.spatial import cKDTree
    V = np.asarray(mesh.vertices, dtype=np.float64)
    Nrm = np.asarray(mesh.vertex_normals, dtype=np.float64)
    diag = float(np.linalg.norm(V.max(axis=0) - V.min(axis=0))) or 1.0
    if raggio_fine is None:
        raggio_fine = 0.015 * diag
    if raggio_base is None:
        raggio_base = 0.10 * diag

    tree = cKDTree(V)
    vic_fine = tree.query_ball_point(V, raggio_fine)
    vic_base = tree.query_ball_point(V, raggio_base)

    def media(A, vicini):
        out = np.empty((len(V),) + A.shape[1:], dtype=np.float64)
        for i, ii in enumerate(vicini):
            out[i] = A[ii].mean(axis=0) if len(ii) else A[i]
        return out

    fine = media(V, vic_fine)
    base = media(V, vic_base)
    h = np.einsum("ij,ij->i", fine - base, Nrm)
    # togli la curvatura: quel che resta e' solo lo scarto LOCALE
    h = h - media(h.reshape(-1, 1), vic_base).ravel()
    return h, {"raggio_fine": raggio_fine, "raggio_base": raggio_base}


# ---------------------------------------------------------------------------
# raggruppamento in zone
# ---------------------------------------------------------------------------
def _vicini_facce(mesh):
    import collections
    v = collections.defaultdict(list)
    for a, b in mesh.face_adjacency:
        a = int(a); b = int(b)
        v[a].append(b); v[b].append(a)
    return v


def _cresci_isteresi(vicini, hf, alta, bassa):
    """Parte dalle facce sopra la soglia ALTA e si allarga ai vicini collegati
    sopra la soglia BASSA: cosi' si prende il dettaglio intero, non la punta."""
    forte = hf > alta
    debole = hf > bassa
    if not forte.any():
        return forte
    dentro = forte.copy()
    pila = [int(i) for i in np.where(forte)[0]]
    while pila:
        f = pila.pop()
        for n in vicini.get(f, ()):
            if debole[n] and not dentro[n]:
                dentro[n] = True
                pila.append(n)
    return dentro


def _componenti(vicini, mask):
    idx = np.where(mask)[0]
    viste = set()
    fuori = []
    for s in idx:
        s = int(s)
        if s in viste:
            continue
        pila = [s]; viste.add(s); gruppo = [s]
        while pila:
            f = pila.pop()
            for n in vicini.get(f, ()):
                if mask[n] and n not in viste:
                    viste.add(n); pila.append(n); gruppo.append(n)
        fuori.append(np.array(gruppo, dtype=np.int64))
    return fuori


def _compattezza(mesh, gruppo):
    """1 = macchia tonda e compatta, verso 0 = chiazza sfilacciata.
    Rapporto fra l'area del gruppo e l'area del cerchio che lo contiene."""
    C = mesh.triangles_center[gruppo]
    area = float(mesh.area_faces[gruppo].sum())
    centro = C.mean(axis=0)
    r = float(np.linalg.norm(C - centro, axis=1).max())
    if r <= 1e-9:
        return 0.0
    return float(np.clip(area / (np.pi * r * r), 0.0, 1.0))


# ---------------------------------------------------------------------------
# rilevatore
# ---------------------------------------------------------------------------
def trova_rilievi(mesh_o_vertici, faces=None, sensibilita=5,
                  area_min_frac=0.0008, area_max_frac=0.06,
                  compattezza_min=0.30, max_pezzi=8,
                  raggio_fine=None, raggio_base=None):
    """Zone in rilievo, come liste di indici di faccia.

    sensibilita: 1 = solo rilievi molto marcati (prudente)
                 10 = prende anche i rilievi appena accennati (rischia il rumore)
    """
    import trimesh
    if faces is None:
        mesh = mesh_o_vertici
    else:
        mesh = trimesh.Trimesh(
            vertices=np.asarray(mesh_o_vertici, dtype=np.float64),
            faces=np.asarray(faces, dtype=np.int64), process=False)

    h, info = altezza_rilievo(mesh, raggio_fine, raggio_base)
    hf = h[mesh.faces].mean(axis=1)

    # soglia in "quante volte il rumore di fondo": robusta perche' basata sulla
    # deviazione mediana assoluta, che non si fa sballare dai dettagli stessi
    mad = float(np.median(np.abs(hf - np.median(hf)))) or 1e-9
    rumore = 1.4826 * mad
    s = float(np.clip(sensibilita, 1, 10))
    volte = 6.0 - 0.42 * (s - 1)          # sens 1 -> 6.0x rumore, sens 10 -> 2.2x
    alta = np.median(hf) + volte * rumore
    bassa = np.median(hf) + (volte * 0.45) * rumore

    vicini = _vicini_facce(mesh)
    mask = _cresci_isteresi(vicini, hf, alta, bassa)

    aree = mesh.area_faces
    area_tot = float(aree.sum()) or 1.0
    candidati = []
    for g in _componenti(vicini, mask):
        frac = float(aree[g].sum()) / area_tot
        if frac < area_min_frac or frac > area_max_frac:
            continue
        comp = _compattezza(mesh, g)
        if comp < compattezza_min:
            continue                       # chiazza sfilacciata = rumore
        punteggio = float(hf[g].mean()) * comp
        candidati.append((punteggio, g))
    candidati.sort(key=lambda t: -t[0])
    gruppi = [g for _, g in candidati[:max_pezzi]]

    info.update({"rumore_stimato": rumore, "soglia": float(alta),
                 "sensibilita": s, "trovati": len(gruppi)})
    return gruppi, info


def trova_rilievi_multiscala(vertices, faces, sensibilita=5, max_pezzi=8,
                             scale=(0.07, 0.13, 0.22), **kw):
    """Cerca i dettagli a PIU' SCALE e unisce i risultati.

    Serve perche' un dettaglio si vede solo se il raggio di analisi e' piu'
    grande del dettaglio stesso: un occhio piccolo e uno grande hanno bisogno
    di raggi diversi. Le zone che si sovrappongono fra scale diverse vengono
    tenute una volta sola (vince quella trovata alla scala piu' fine).
    """
    import trimesh
    V = np.asarray(vertices, dtype=np.float64)
    F = np.asarray(faces, dtype=np.int64)
    mesh = trimesh.Trimesh(vertices=V, faces=F, process=False)
    diag = float(np.linalg.norm(V.max(axis=0) - V.min(axis=0))) or 1.0

    presi = np.zeros(len(F), dtype=bool)
    gruppi = []
    info_tot = {"scale": [], "trovati": 0}
    for sc in scale:
        try:
            g, info = trova_rilievi(
                mesh, None, sensibilita=sensibilita, max_pezzi=max_pezzi,
                raggio_base=sc * diag, **kw)
        except Exception:
            continue
        nuovi = 0
        for gr in g:
            # scarta se si sovrappone parecchio a una zona gia' presa
            if presi[gr].mean() > 0.35:
                continue
            presi[gr] = True
            gruppi.append(gr)
            nuovi += 1
        info_tot["scale"].append({"raggio_base": round(sc * diag, 2), "nuovi": nuovi})
        if len(gruppi) >= max_pezzi:
            break
    info_tot["trovati"] = len(gruppi)
    return gruppi[:max_pezzi], info_tot


def unisci_a_geometria(labels_geo, vertices, faces, max_dettagli=8, **kw):
    """Mette i dettagli in rilievo SOPRA la segmentazione per pieghe, senza
    toccare le parti grosse gia' trovate."""
    labels = np.asarray(labels_geo, dtype=np.int64).copy()
    gruppi, info = trova_rilievi_multiscala(vertices, faces, max_pezzi=max_dettagli, **kw)
    prossima = int(labels.max()) + 1 if len(labels) else 0
    for g in gruppi:
        labels[g] = prossima
        prossima += 1
    info["dettagli_aggiunti"] = len(gruppi)
    return labels, info


def segmenta_con_rilievi(vertices, faces, target_parts=8, **kw):
    """Etichette per faccia: 0 = corpo, 1..n = dettagli in rilievo."""
    faces = np.asarray(faces, dtype=np.int64)
    labels = np.zeros(len(faces), dtype=np.int64)
    gruppi, info = trova_rilievi_multiscala(
        vertices, faces, max_pezzi=max(1, target_parts - 1), **kw)
    for i, g in enumerate(gruppi):
        labels[g] = i + 1
    return labels, info
