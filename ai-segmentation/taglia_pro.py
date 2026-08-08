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

# Marcatore di versione: serve SOLO a capire, guardando il log del taglio
# o /health, se il companion in esecuzione e' quello aggiornato (taglio
# LOCALE alla selezione) o una copia vecchia rimasta avviata da prima.
VERSIONE = "taglio-bordo-4"


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
    # (u, v, n) e' una terna ortonormale, quindi un punto si ricostruisce come
    # u*(p@u) + v*(p@v) + n*(p@n). Il centro del connettore deve stare NEL
    # MEZZO della faccia di taglio (componenti u,v al centro della sezione) e
    # SUL piano di taglio (componente n uguale a quella del punto del piano).
    #
    # Prima qui si scriveva "punto + u*mezzo_u + v*mezzo_v": si SOMMAVANO le
    # componenti u,v invece di sostituirle, e `punto` le sue componenti u,v
    # ce le ha gia'. Su un modello lontano dall'origine (le coordinate di un
    # STL sono spesso centinaia di mm) il perno finiva spostato di altrettanti
    # millimetri fuori dal pezzo: il "cubo sospeso per aria".
    p_arr = np.asarray(punto, dtype=float)
    centro = (
        u * (0.5 * (cu.min() + cu.max()))
        + v * (0.5 * (cv.min() + cv.max()))
        + n * float(p_arr @ n)
    )
    est_u = 0.5 * float(cu.max() - cu.min())
    est_v = 0.5 * float(cv.max() - cv.min())
    return centro, est_u, est_v, (u, v, n)



# ---------------------------------------------------------------------------
# superficie di taglio che SEGUE IL BORDO della selezione
# ---------------------------------------------------------------------------
# Il piano medio va benissimo quando il bordo e' un anello piatto (una caviglia
# dentro uno stivale). Ma se il bordo e' ondulato o strappato - la gamba che
# esce da un pantalone rotto - il piano medio non gli somiglia per niente: il
# taglio passa dove capita e fa scempio. Qui invece si costruisce un telo che
# passa per il bordo VERO: stessa idea della coperta, ma disegnata in automatico
# sulla selezione dell'utente invece che a mano.
def _superficie_dal_bordo(bordo, punto, normale, margine=1.18, lato_griglia=18):
    u, v, n = _base_da_normale(normale)
    P = np.asarray(bordo, dtype=np.float64).reshape(-1, 3)
    p0 = np.asarray(punto, dtype=np.float64)
    d = P - p0
    a = d @ u
    b = d @ v
    h = d @ n                      # quanto il bordo si scosta dal piano medio
    ca, cb = 0.5 * (a.min() + a.max()), 0.5 * (b.min() + b.max())
    ra = max(0.5 * (a.max() - a.min()), 1e-6) * margine
    rb = max(0.5 * (b.max() - b.min()), 1e-6) * margine
    M = int(lato_griglia)
    ga = np.linspace(ca - ra, ca + ra, M)
    gb = np.linspace(cb - rb, cb + rb, M)
    # ogni nodo del telo prende l'altezza dei punti di bordo che ha vicino
    # (peso gaussiano): il telo si appoggia sul bordo e si distende dove il
    # bordo non c'e'
    sigma2 = (0.28 * max(ra, rb)) ** 2
    fitta = np.empty((M, M, 3), dtype=np.float64)
    for i in range(M):
        da = ga[i] - a
        for j in range(M):
            db = gb[j] - b
            w = np.exp(-(da * da + db * db) / (2.0 * sigma2)) + 1e-12
            hh = float((w * h).sum() / w.sum())
            fitta[i, j] = p0 + u * ga[i] + v * gb[j] + n * hh
    return fitta


def _quanto_e_storto(bordo, punto, normale):
    """Quanto il bordo si discosta dall'essere piatto, in frazione della sua
    larghezza. ~0 = anello piatto (il piano va benissimo), grande = ondulato."""
    u, v, n = _base_da_normale(normale)
    P = np.asarray(bordo, dtype=np.float64).reshape(-1, 3)
    d = P - np.asarray(punto, dtype=np.float64)
    h = d @ n
    larghezza = max(float((d @ u).max() - (d @ u).min()),
                    float((d @ v).max() - (d @ v).min()), 1e-9)
    return float(h.std() / larghezza)


# ---------------------------------------------------------------------------
# taglio + connettore quadrato automatico
# ---------------------------------------------------------------------------
def taglia_con_piano(vertices, faces, punto, normale,
                     connettore=True, gioco=0.20, lato=None, profondita=None,
                     n_connettori=1, sel_min=None, sel_max=None,
                     scala_connettore=1.0, bordo=None):
    """Taglia il solido con un piano e mette perno quadrato + foro.

    punto, normale : piano di taglio
    gioco          : gioco di accoppiamento per lato, in mm (0.2 va bene per PLA/FDM)
    lato           : lato del perno quadrato in mm (auto se None)
    profondita     : quanto sporge il perno in mm (auto se None)
    n_connettori   : 1 = uno centrale; 2 = due affiancati (contro la rotazione)
    sel_min/sel_max: bounding box (world) della zona selezionata dall'utente.
                     Se presente, il taglio viene LIMITATO a quella zona (piu'
                     un margine), invece di tagliare col piano infinito tutto
                     il pezzo: selezionare una mano non deve tranciare anche
                     il busto solo perche' il piano, esteso all'infinito,
                     passa pure di la'.

    Ritorna {"a": {...}, "b": {...}, "log": [...]}
      a = lato dalla parte della normale (ha il PERNO)
      b = lato opposto (ha il FORO)
    """
    log = [f"[{VERSIONE}]"]
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
    diag_tot = float(np.linalg.norm(V.max(axis=0) - V.min(axis=0))) or 1.0

    # --- prova a limitare il taglio alla zona selezionata ---
    # Si racchiude la selezione in una scatola (bbox + margine) e si opera
    # SOLO li' dentro: il resto del pezzo (resto = solido - scatola) non
    # viene nemmeno toccato dal piano. Se qualcosa non torna (scatola
    # degenere, taglio locale che non produce due pezzi...) si ripiega sul
    # vecchio comportamento: piano infinito su tutto il pezzo.
    resto = None
    regione = None
    if sel_min is not None and sel_max is not None:
        try:
            bmin = np.asarray(sel_min, dtype=np.float64)
            bmax = np.asarray(sel_max, dtype=np.float64)
            dim_sel = bmax - bmin
            if np.all(dim_sel >= 0):
                margine = np.maximum(0.2 * dim_sel, 2.0)
                centro_box = (bmin + bmax) / 2.0
                dim_box = dim_sel + 2 * margine
                scatola = _cubo(dim_box, centro_box, [1.0, 0, 0], [0, 1.0, 0], [0, 0, 1.0])
                candidato_regione = solido ^ scatola   # intersezione
                candidato_resto = solido - scatola     # differenza
                vol_reg = candidato_regione.volume()
                vol_resto = candidato_resto.volume()
                # la scatola deve contenere davvero solo una parte del pezzo,
                # altrimenti tanto vale il taglio globale
                if vol_reg > vol0 * 1e-4 and vol_resto > vol0 * 1e-4:
                    regione = candidato_regione
                    resto = candidato_resto
        except Exception as e:
            log.append(f"(taglio locale non riuscito, uso il piano su tutto: {e})")
            resto = None
            regione = None

    solido_da_tagliare = regione if regione is not None else solido

    # --- taglio esatto ---
    # Se il bordo della selezione e' un anello piatto (una caviglia dentro uno
    # stivale) il piano e' perfetto e si usa quello. Se invece e' ondulato o
    # strappato (una gamba che esce da un pantalone rotto) il piano medio non
    # gli somiglia e il taglio farebbe scempio: li' si usa un telo che passa
    # per il bordo vero.
    telo = None
    if bordo is not None and len(np.asarray(bordo).reshape(-1, 3)) >= 8:
        try:
            storto = _quanto_e_storto(bordo, punto, n)
            log.append(f"Bordo della selezione: scostamento dal piano {storto * 100:.1f}% della larghezza")
            # Soglia tarata su casi reali: una caviglia dentro uno stivale
            # misura ~27% (il piano ci sta benissimo, e la faccia esce piatta
            # come serve per la stampa), un orlo strappato ~56% (li' il piano
            # fa scempio). Il 40% li separa: si resta sul piano finche' e'
            # ragionevole, si passa al telo solo quando il bordo e' davvero
            # frastagliato.
            if storto > 0.40:
                fitta = _superficie_dal_bordo(bordo, punto, n)
                candidato = _solido_da_coperta(fitta, n, diag_tot * 2.0)
                if candidato.status().name == "NoError":
                    telo = candidato
                    log.append("Bordo ondulato: taglio con un telo che lo segue, non col piano medio")
                else:
                    log.append("(telo dal bordo non valido, uso il piano medio)")
        except Exception as e:
            log.append(f"(telo dal bordo non riuscito, uso il piano medio: {e})")

    if telo is not None:
        A = solido_da_tagliare - telo      # lato +normale (la selezione)
        B = solido_da_tagliare ^ telo      # lato opposto
    else:
        A = solido_da_tagliare.trim_by_plane(list(n), offset)        # lato +normale
        B = solido_da_tagliare.trim_by_plane(list(-n), -offset)      # lato -normale

    if (A.volume() <= 0 or B.volume() <= 0) and resto is not None:
        # la scatola locale non stava a cavallo del piano: niente taglio
        # locale valido, si ripiega sul piano infinito su tutto il pezzo
        log.append("Taglio locale non a cavallo del piano, ripiego sul piano su tutto il pezzo")
        resto = None
        regione = None
        solido_da_tagliare = solido
        if telo is not None:
            A = solido_da_tagliare - telo
            B = solido_da_tagliare ^ telo
        else:
            A = solido_da_tagliare.trim_by_plane(list(n), offset)
            B = solido_da_tagliare.trim_by_plane(list(-n), -offset)

    if A.volume() <= 0 or B.volume() <= 0:
        raise ValueError("Il piano non taglia il modello in due parti.")

    # --- scarta i frammenti estranei finiti nel pezzo staccato ---
    # La scatola della zona selezionata e' un parallelepipedo: oltre alla mano
    # puo' contenere pezzi di roba VICINA ma non attaccata (es. un lembo di
    # pantalone che passa li' accanto). Quei pezzi finiscono nel solido A e si
    # staccano insieme alla mano, come coriandoli. Qui si tiene di A solo il
    # blocco attaccato alla zona voluta (quello di volume maggiore) e si
    # restituiscono gli altri al pezzo grande.
    if resto is not None:
        try:
            blocchi = A.decompose()
            if len(blocchi) > 1:
                blocchi = sorted(blocchi, key=lambda m: m.volume(), reverse=True)
                scartati = blocchi[1:]
                A = blocchi[0]
                for s in scartati:
                    resto = resto + s
                log.append(
                    f"Scartati {len(scartati)} frammenti estranei dal pezzo staccato "
                    f"(rimessi nel pezzo grande)"
                )
        except Exception as e:
            log.append(f"(controllo frammenti non riuscito: {e})")

    if resto is not None:
        log.append(
            f"Taglio LOCALE (solo zona selezionata): volume {vol0:.1f} -> "
            f"resto {resto.volume():.1f} + regione {A.volume() + B.volume():.1f}"
        )
    else:
        log.append(f"Taglio esatto su tutto il pezzo: volume {vol0:.1f} -> A {A.volume():.1f} + B {B.volume():.1f}")

    if not connettore:
        if resto is not None:
            B = resto + B
        va, fa = _to_arrays(A)
        vb, fb = _to_arrays(B)
        return {"a": _pack(va, fa), "b": _pack(vb, fb), "log": log}

    # --- misura della faccia di taglio ---
    # se il taglio e' locale, si usano solo i vertici della regione: cosi' la
    # dimensione del connettore riflette lo spessore vero del punto tagliato
    # (il polso), non l'ingombro di tutto il pezzo (il busto)
    if resto is not None:
        V_sez, F_sez = _to_arrays(solido_da_tagliare)
    else:
        V_sez, F_sez = V, F
    diag = float(np.linalg.norm(V_sez.max(axis=0) - V_sez.min(axis=0))) or 1.0
    centro, est_u, est_v, (u, v, nn) = _sezione(V_sez, F_sez, punto, n, tolleranza=diag * 0.01)
    minore = 2.0 * min(est_u, est_v)

    if lato is None:
        # perno grande abbastanza da tenere, piccolo abbastanza da entrare
        # Il tetto era 10 mm fisso: su una faccia di taglio larga (un polso da
        # 100 mm, o un modello grande) veniva fuori un perno minuscolo, che non
        # tiene e si vede appena. Ora il tetto sale insieme alla faccia di
        # taglio: resta comunque una frazione di essa, mai un perno piu' largo
        # del pezzo su cui deve stare.
        lato = float(np.clip(0.28 * minore, 2.0, max(10.0, 0.45 * minore)))
    if profondita is None:
        # anche la profondita' seguiva un tetto fisso (8 mm): con un perno piu'
        # grande resterebbe un dentino appena accennato, che non guida l'incastro
        profondita = float(np.clip(0.9 * lato, 1.5, max(8.0, 0.9 * lato)))
    # manopola "Grandezza perno": moltiplica la misura automatica
    if scala_connettore and scala_connettore != 1.0:
        lato = float(lato * scala_connettore)
        profondita = float(profondita * scala_connettore)
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

    # se il taglio era locale, si ricuce B (la parte col foro, lato -normale)
    # col resto del pezzo che non era mai stato toccato
    if resto is not None:
        B = resto + B
        if B.status().name != "NoError":
            raise ValueError("La ricucitura col resto del pezzo non e' riuscita.")

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


# ---------------------------------------------------------------------------
# TAGLIO CON LA "COPERTA": superficie di taglio FINITA e deformabile
# ---------------------------------------------------------------------------
# Un piano di taglio e' infinito: per staccare un polso taglia anche tutto
# quello che incontra per strada. La coperta invece e' un telo con un
# perimetro: taglia solo dove il telo passa davvero. L'utente ne sposta le
# maniglie per piegarlo e per stringerne il contorno.
#
# Il telo da solo non puo' tagliare (non e' un solido): lo si trasforma in un
# solido chiuso spingendone una copia lontano lungo la normale media e
# cucendo i bordi. Quel solido e' il "sotto"; il resto e' il "sopra".
def _catmull(p0, p1, p2, p3, t):
    t2 = t * t
    t3 = t2 * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t
                  + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                  + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


def _infittisci(griglia, passo):
    """Da una griglia di maniglie NxN a una superficie liscia che passa
    ESATTAMENTE per tutte le maniglie (Catmull-Rom nelle due direzioni)."""
    G = np.asarray(griglia, dtype=np.float64)
    N = G.shape[0]
    # bordi ripetuti: servono i due punti "fuori" per la curva agli estremi
    E = np.empty((N + 2, N + 2, 3), dtype=np.float64)
    E[1:-1, 1:-1] = G
    E[0, 1:-1] = G[0] + (G[0] - G[1])
    E[-1, 1:-1] = G[-1] + (G[-1] - G[-2])
    E[:, 0] = E[:, 1] + (E[:, 1] - E[:, 2])
    E[:, -1] = E[:, -2] + (E[:, -2] - E[:, -3])

    M = (N - 1) * passo + 1
    fitta = np.empty((M, M, 3), dtype=np.float64)
    for a in range(M):
        i = min(a // passo, N - 2)
        tu = (a - i * passo) / passo
        for b in range(M):
            j = min(b // passo, N - 2)
            tv = (b - j * passo) / passo
            colonne = [_catmull(E[i + k, j], E[i + k, j + 1], E[i + k, j + 2], E[i + k, j + 3], tv)
                       for k in range(4)]
            fitta[a, b] = _catmull(colonne[0], colonne[1], colonne[2], colonne[3], tu)
    return fitta


def _solido_da_coperta(fitta, normale, profondita):
    """Chiude il telo in un solido: telo + copia spinta lontano + bordi cuciti."""
    M = fitta.shape[0]
    sotto = fitta - np.asarray(normale, dtype=np.float64) * profondita
    V = np.concatenate([fitta.reshape(-1, 3), sotto.reshape(-1, 3)], axis=0)
    top = M * M

    def idx(i, j):
        return i * M + j

    T = []
    for i in range(M - 1):
        for j in range(M - 1):
            a, b, c, d = idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)
            T.append([a, b, c]); T.append([a, c, d])                       # faccia del telo
            T.append([a + top, c + top, b + top])                          # faccia opposta
            T.append([a + top, d + top, c + top])
    bordo = ([(i, 0) for i in range(M - 1)]
             + [(M - 1, j) for j in range(M - 1)]
             + [(M - 1 - i, M - 1) for i in range(M - 1)]
             + [(0, M - 1 - j) for j in range(M - 1)])
    for k in range(len(bordo)):
        i1, j1 = bordo[k]
        i2, j2 = bordo[(k + 1) % len(bordo)]
        a, b = idx(i1, j1), idx(i2, j2)
        T.append([a, b + top, b]); T.append([a, a + top, b + top])
    return _manifold(V, np.asarray(T, dtype=np.int64))


def taglia_con_coperta(vertices, faces, griglia, connettore=True, gioco=0.20,
                       lato=None, profondita=None, scala_connettore=1.0, passo=6):
    """Taglia il solido con una superficie finita e deformabile (la coperta).

    griglia : NxNx3, le maniglie spostate dall'utente
    Ritorna {"a": sopra (col PERNO), "b": sotto (col FORO), "log": [...]}
    """
    log = [f"[{VERSIONE}] taglio con la coperta"]
    V = np.asarray(vertices, dtype=np.float64)
    F = np.asarray(faces, dtype=np.int64)
    G = np.asarray(griglia, dtype=np.float64)
    if G.ndim != 3 or G.shape[0] != G.shape[1] or G.shape[2] != 3:
        raise ValueError("La coperta deve essere una griglia NxNx3.")

    solido = _manifold(V, F)
    if solido.status().name != "NoError":
        raise ValueError("Il modello non e' un solido valido: passalo prima dalla riparazione.")
    vol0 = solido.volume()
    diag = float(np.linalg.norm(V.max(axis=0) - V.min(axis=0))) or 1.0

    fitta = _infittisci(G, passo)
    # normale media del telo, dalle diagonali dei suoi quadretti
    du = fitta[-1, :, :].mean(axis=0) - fitta[0, :, :].mean(axis=0)
    dv = fitta[:, -1, :].mean(axis=0) - fitta[:, 0, :].mean(axis=0)
    n = _normalizza(np.cross(du, dv))

    coperta = _solido_da_coperta(fitta, n, diag * 2.0)
    if coperta.status().name != "NoError":
        raise ValueError("La coperta e' piegata troppo su se stessa: raddrizza qualche maniglia.")

    A = solido - coperta      # sopra il telo (dalla parte della normale)
    B = solido ^ coperta      # sotto il telo
    if A.volume() <= 0 or B.volume() <= 0:
        raise ValueError("La coperta non separa il pezzo: allargala o spostala perche' lo attraversi tutto.")
    log.append(f"Taglio con la coperta: volume {vol0:.1f} -> sopra {A.volume():.1f} + sotto {B.volume():.1f}")

    # frammenti staccati per sbaglio: tornano al pezzo grande
    try:
        blocchi = B.decompose()
        if len(blocchi) > 1:
            blocchi = sorted(blocchi, key=lambda m: m.volume(), reverse=True)
            for s in blocchi[1:]:
                A = A + s
            B = blocchi[0]
            log.append(f"Scartati {len(blocchi) - 1} frammenti estranei dal pezzo staccato")
    except Exception as e:
        log.append(f"(controllo frammenti non riuscito: {e})")

    if not connettore:
        va, fa = _to_arrays(A)
        vb, fb = _to_arrays(B)
        return {"a": _pack(va, fa), "b": _pack(vb, fb), "log": log}

    # connettore al centro del telo, lungo la sua normale media
    centro = fitta.reshape(-1, 3).mean(axis=0)
    u, v, nn = _base_da_normale(n)
    piatto = fitta.reshape(-1, 3)
    est_u = 0.5 * float((piatto @ u).max() - (piatto @ u).min())
    est_v = 0.5 * float((piatto @ v).max() - (piatto @ v).min())
    minore = 2.0 * min(est_u, est_v)
    if lato is None:
        lato = float(np.clip(0.28 * minore, 2.0, max(10.0, 0.45 * minore)))
    if profondita is None:
        profondita = float(np.clip(0.9 * lato, 1.5, max(8.0, 0.9 * lato)))
    if scala_connettore and scala_connettore != 1.0:
        lato *= scala_connettore
        profondita *= scala_connettore

    incastro = 0.15 * profondita
    h = profondita + incastro
    c_perno = centro - nn * (profondita * 0.5) + nn * (incastro * 0.5)
    perno = _cubo([lato, lato, h], c_perno, u, v, nn)
    c_foro = c_perno - nn * (gioco * 0.5)
    foro = _cubo([lato + 2 * gioco, lato + 2 * gioco, h + gioco], c_foro, u, v, nn)
    A = A + perno
    B = B - foro
    if A.status().name != "NoError" or B.status().name != "NoError":
        raise ValueError("La booleana del connettore non e' riuscita.")
    log.append(f"Connettore: lato {lato:.2f} mm, profondita' {profondita:.2f} mm, gioco {gioco:.2f} mm")

    va, fa = _to_arrays(A)
    vb, fb = _to_arrays(B)
    return {"a": _pack(va, fa), "b": _pack(vb, fb), "log": log,
            "connettore": {"lato": lato, "profondita": profondita, "gioco": gioco, "n": 1}}
