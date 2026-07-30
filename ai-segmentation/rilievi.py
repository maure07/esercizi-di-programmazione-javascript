"""
rilievi.py
Trova i DETTAGLI IN RILIEVO su una superficie: sopracciglia, occhi, labbra,
bottoni, decorazioni... cioe' proprio le parti che la segmentazione "per pieghe"
si perde, perche' su questi dettagli la superficie NON ha spigoli netti: sale e
scende in modo morbido.

Idea (classica e robusta): si costruisce una versione LEVIGATA del modello, che
e' come sarebbe la testa "liscia" senza i dettagli. La differenza fra il modello
vero e quello levigato, misurata lungo la normale, e' l'ALTEZZA DEL RILIEVO.
Dove questa altezza supera una soglia, c'e' un dettaglio: lo si isola e diventa
un pezzo a se'.

Funziona anche su modelli senza colore, ed e' insensibile al fatto che il
dettaglio abbia bordi netti o sfumati.
"""
import numpy as np


def _componenti_facce(mesh, mask):
    """Componenti connesse fra le facce selezionate da `mask` (bool per faccia)."""
    import collections
    idx = np.where(mask)[0]
    if len(idx) == 0:
        return []
    sel = set(int(i) for i in idx)
    # adiacenza faccia-faccia limitata alle facce selezionate
    vicini = collections.defaultdict(list)
    adj = mesh.face_adjacency
    for a, b in adj:
        a = int(a); b = int(b)
        if a in sel and b in sel:
            vicini[a].append(b)
            vicini[b].append(a)
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
                if n not in viste:
                    viste.add(n); pila.append(n); gruppo.append(n)
        fuori.append(np.array(gruppo, dtype=np.int64))
    return fuori


def _cresci_isteresi(mesh, hf, alta, bassa):
    """Parte dalle facce sopra la soglia ALTA e si allarga, seguendo i vicini,
    a tutte quelle collegate che stanno sopra la soglia BASSA.
    Cosi' si prende il dettaglio INTERO e non solo la sua punta."""
    import collections
    forte = hf > alta
    debole = hf > bassa
    if not forte.any():
        return forte
    vicini = collections.defaultdict(list)
    for a, b in mesh.face_adjacency:
        a = int(a); b = int(b)
        vicini[a].append(b)
        vicini[b].append(a)
    dentro = forte.copy()
    pila = [int(i) for i in np.where(forte)[0]]
    while pila:
        f = pila.pop()
        for n in vicini.get(f, ()):
            if debole[n] and not dentro[n]:
                dentro[n] = True
                pila.append(n)
    return dentro


def altezza_rilievo(mesh, passate=None):
    """Altezza del rilievo per ogni vertice (positiva = sporge).

    Si usa il levigamento di TAUBIN, non quello laplaciano semplice: Taubin
    leviga SENZA restringere il modello. E' fondamentale, perche' con il
    laplaciano il restringimento generale si somma al rilievo e falsa la
    misura, nascondendo proprio i dettagli bassi come le sopracciglia.

    passate: quanto levigare per ottenere la superficie "di base".
             Se None, si adatta alla densita' della mesh.
    """
    import trimesh
    V = np.asarray(mesh.vertices, dtype=np.float64)
    if passate is None:
        # per cancellare un dettaglio largo ~10% della diagonale servono
        # circa (larghezza / lato_spigolo)^2 passate
        diag = float(np.linalg.norm(V.max(axis=0) - V.min(axis=0))) or 1.0
        lato = float(np.mean(mesh.edges_unique_length)) or (diag / 100.0)
        passate = int(np.clip((0.10 * diag / max(lato, 1e-9)) ** 2 * 2.0, 120, 400))

    base = mesh.copy()
    trimesh.smoothing.filter_taubin(base, iterations=int(passate))

    Nb = np.asarray(base.vertex_normals, dtype=np.float64)
    delta = V - np.asarray(base.vertices, dtype=np.float64)
    h = np.einsum("ij,ij->i", delta, Nb)   # componente lungo la normale
    return h, int(passate)


def trova_rilievi(vertices, faces, soglia_mm=None, soglia_rel=0.28,
                  bassa_rel=0.20, area_min_frac=0.0006, area_max_frac=0.16,
                  max_pezzi=12, passate=None):
    """Restituisce una lista di gruppi di facce, uno per ogni dettaglio in rilievo.

    soglia_mm  : altezza minima del rilievo in mm (se None si ricava dai dati)
    soglia_rel : in automatico, frazione del rilievo massimo trovato
    area_*_frac: scarta i pezzi troppo piccoli (rumore) o troppo grandi (il corpo)
    """
    import trimesh
    mesh = trimesh.Trimesh(
        vertices=np.asarray(vertices, dtype=np.float64),
        faces=np.asarray(faces, dtype=np.int64), process=False)

    h, passate_usate = altezza_rilievo(mesh, passate=passate)
    # altezza per faccia
    hf = h[mesh.faces].mean(axis=1)

    if soglia_mm is None:
        positivi = hf[hf > 0]
        if len(positivi) == 0:
            return [], {"passate": passate_usate, "soglia": 0.0, "max": 0.0}
        # il 99.5° percentile evita che un singolo picco sballi la soglia
        picco = float(np.percentile(positivi, 99.5))
        soglia = max(picco * soglia_rel, 1e-6)
    else:
        soglia = float(soglia_mm)
        picco = float(hf.max())

    aree = mesh.area_faces
    area_tot = float(aree.sum()) or 1.0

    # DOPPIA SOGLIA (isteresi): partiamo dalle facce che sporgono di sicuro
    # (soglia alta) e ci allarghiamo a quelle collegate che sporgono anche solo
    # un po' (soglia bassa). Senza questo si prenderebbe solo la punta del
    # rilievo e il taglio verrebbe piu' piccolo del dettaglio vero.
    mask = _cresci_isteresi(mesh, hf, alta=soglia, bassa=soglia * bassa_rel)

    gruppi = []
    for g in _componenti_facce(mesh, mask):
        a = float(aree[g].sum()) / area_tot
        if a < area_min_frac or a > area_max_frac:
            continue
        gruppi.append((float(hf[g].mean()) * a, g))   # punteggio: alto e grande
    gruppi.sort(key=lambda t: -t[0])
    gruppi = [g for _, g in gruppi[:max_pezzi]]
    info = {"passate": passate_usate, "soglia": soglia, "max": picco,
            "trovati": len(gruppi)}
    return gruppi, info


def unisci_a_geometria(labels_geo, vertices, faces, max_dettagli=8, **kw):
    """Mette i dettagli in rilievo SOPRA la segmentazione per pieghe.

    La segmentazione per pieghe azzecca le parti grosse (testa, braccia, scarpe)
    ma si perde i dettagli morbidi appoggiati sulla superficie (sopracciglia,
    occhi, labbra). Qui li ritagliamo e diventano pezzi a se', lasciando intatto
    il resto.
    """
    labels = np.asarray(labels_geo, dtype=np.int64).copy()
    gruppi, info = trova_rilievi(vertices, faces, max_pezzi=max_dettagli, **kw)
    prossima = int(labels.max()) + 1 if len(labels) else 0
    for g in gruppi:
        labels[g] = prossima
        prossima += 1
    info["dettagli_aggiunti"] = len(gruppi)
    return labels, info


def segmenta_con_rilievi(vertices, faces, target_parts=8, **kw):
    """Etichette per faccia: 0 = corpo, 1..n = i dettagli in rilievo trovati.

    Pensata per essere unita alla segmentazione per pieghe: qui prendiamo i
    dettagli morbidi che quella si perde.
    """
    faces = np.asarray(faces, dtype=np.int64)
    labels = np.zeros(len(faces), dtype=np.int64)
    gruppi, info = trova_rilievi(vertices, faces, max_pezzi=max(1, target_parts - 1), **kw)
    for i, g in enumerate(gruppi):
        labels[g] = i + 1
    return labels, info
