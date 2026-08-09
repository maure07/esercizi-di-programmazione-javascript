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
VERSIONE = "taglio-gonnella-12"


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


# ---------------------------------------------------------------------------
# TAGLIO ESATTAMENTE SULLA SELEZIONE
# ---------------------------------------------------------------------------
# Sia il piano che il telo sono superfici che ARRIVANO DA FUORI: hanno un loro
# contorno (infinito il piano, quadrato il telo) e dove quel contorno sborda
# oltre la zona scelta taglia comunque, lasciando lamelle piatte estranee -
# le linguette rettangolari che comparivano attorno allo strappo.
#
# Qui invece non si usa nessuna superficie esterna: si prendono i triangoli
# selezionati cosi' come sono, si trova l'anello di spigoli dove finisce la
# selezione, e si chiude quell'anello con un tappo. Lo stesso tappo (girato al
# rovescio) chiude anche il pezzo che resta. Risultato: il taglio corre
# ESATTAMENTE dove finisce la selezione, i due pezzi combaciano perche'
# condividono lo stesso tappo, e nessuna lamella estranea puo' comparire.
def _area2(a, b, c):
    """Doppia area con segno del triangolo a-b-c nel piano (prodotto vettore in
    due dimensioni). Scritta a mano perche' numpy 2 non accetta piu' np.cross
    su vettori a due componenti."""
    return float((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))


def _ordina_anello(anello):
    """Mette in fila gli spigoli di un anello: v0 -> v1 -> v2 -> ... -> v0.

    Restituisce la lista dei vertici in ordine, oppure None se l'anello non e'
    un giro semplice (un vertice con piu' di due spigoli, o piu' giri separati
    finiti nello stesso gruppo).
    """
    succ = {}
    for a, b in anello:
        if a in succ:
            return None          # diramazione: non e' un giro semplice
        succ[a] = b
    if len(succ) != len(anello):
        return None
    partenza = next(iter(succ))
    giro = [partenza]
    v = succ[partenza]
    while v != partenza:
        if v not in succ or len(giro) > len(anello):
            return None
        giro.append(v)
        v = succ[v]
    return giro if len(giro) == len(anello) else None


def _orecchie_3d(P3, n):
    """Chiude un contorno storto senza proiettarlo su un piano.

    Il ritaglio a orecchie normale lavora sul contorno schiacciato su un piano;
    se il contorno e' molto ondulato (una macchia su una coscia tonda) la
    proiezione si accavalla e non si riesce a chiudere. Si finiva allora sul
    tappo a raggiera, quei triangoli lunghi che partono tutti da un punto e che
    sul pezzo si vedono benissimo. Qui invece si sceglie ogni volta l'angolo
    piu' "compatto" da staccare, lavorando direttamente in tre dimensioni: i
    triangoli vengono corti e larghi, e la faccia di taglio resta pulita.
    """
    m = len(P3)
    if m < 3:
        return None
    resto = list(range(m))
    tri = []
    while len(resto) > 3:
        k_migliore, punteggio_migliore = -1, -1.0
        k_ripiego, punteggio_ripiego = -1, -1.0
        q = len(resto)
        for k in range(q):
            i0, i1, i2 = resto[(k - 1) % q], resto[k], resto[(k + 1) % q]
            a, b, c = P3[i0], P3[i1], P3[i2]
            area = float(np.cross(b - a, c - a) @ n)
            per2 = (float(np.dot(b - a, b - a)) + float(np.dot(c - b, c - b))
                    + float(np.dot(a - c, a - c)))
            if per2 <= 0:
                continue
            if area > 1e-12 and area / per2 > punteggio_migliore:
                punteggio_migliore, k_migliore = area / per2, k
            if abs(area) / per2 > punteggio_ripiego:
                punteggio_ripiego, k_ripiego = abs(area) / per2, k
        # Se nessun angolo e' sporgente (contorno tutto rientrante rispetto al
        # piano medio) si stacca comunque il piu' compatto: meglio un triangolo
        # un po' storto che il tappo a raggiera, che si vede sul pezzo.
        if k_migliore < 0:
            k_migliore = k_ripiego
        if k_migliore < 0:
            return None
        q = len(resto)
        tri.append((resto[(k_migliore - 1) % q], resto[k_migliore], resto[(k_migliore + 1) % q]))
        resto.pop(k_migliore)
    tri.append((resto[0], resto[1], resto[2]))
    return tri


def _cicli_anello(anello):
    """Spezza un contorno RAMIFICATO in piu' giri semplici.

    _ordina_anello si arrende appena un vertice ha due strade: succedeva su
    contorni che si toccano da soli, e si ripiegava sul tappo a raggiera, che
    sul pezzo si vede eccome. Qui invece si percorrono gli spigoli consumandoli:
    dove ci sono piu' strade se ne prende una qualsiasi, e alla fine si hanno
    piu' giri chiusi, ognuno richiudibile a orecchie.
    """
    da_fare = {}
    for a, b in anello:
        da_fare.setdefault(a, []).append(b)
    cicli = []
    for partenza in list(da_fare.keys()):
        while da_fare.get(partenza):
            giro = [partenza]
            v = da_fare[partenza].pop()
            guardia = 0
            while v != partenza and guardia <= len(anello):
                guardia += 1
                if not da_fare.get(v):
                    giro = None
                    break
                giro.append(v)
                v = da_fare[v].pop()
            if giro and len(giro) >= 3 and v == partenza:
                cicli.append(giro)
            elif giro is None:
                continue
    return cicli


def _ritaglia_orecchie(P2):
    """Triangola un poligono piano (anche rientrante) tagliando le "orecchie".

    Il ventaglio verso il centro, che si usava prima, va bene solo per i
    contorni convessi: su un contorno rientrante (un polso, una piega, un orlo
    strappato) alcuni triangoli finiscono FUORI dal contorno e sul pezzo
    stampato si vede una sporgenza a raggiera. Qui invece si stacca ogni volta
    un "orecchio" — un angolo sporgente senza altri punti dentro — e i triangoli
    restano per costruzione dentro al contorno.

    P2: punti (n,2) del contorno in ordine. Torna la lista di terne di indici
    nell'ordine dato, oppure None se non ce la fa (contorno che si accavalla).
    """
    n = len(P2)
    if n < 3:
        return None
    # Verso: se il poligono gira in senso orario lo si SPECCHIA (si ribalta una
    # coordinata) invece di leggerlo al contrario. Leggendolo al contrario i
    # triangoli uscivano avvolti al rovescio rispetto agli spigoli del contorno,
    # e il pezzo che resta non si chiudeva piu'. Specchiandolo l'ordine dei
    # vertici resta quello del giro, quindi il tappo combacia sempre.
    area2 = float(np.sum(P2[:, 0] * np.roll(P2[:, 1], -1) - np.roll(P2[:, 0], -1) * P2[:, 1]))
    if area2 < 0:
        P2 = P2 * np.array([1.0, -1.0])
    resto = list(range(n))
    tri = []
    giri_a_vuoto = 0
    while len(resto) > 3 and giri_a_vuoto <= len(resto):
        m = len(resto)
        preso = False
        for k in range(m):
            i0, i1, i2 = resto[(k - 1) % m], resto[k], resto[(k + 1) % m]
            a, b, c = P2[i0], P2[i1], P2[i2]
            cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if cr <= 1e-12:
                continue                     # angolo rientrante: non e' un orecchio
            altri = [j for j in resto if j not in (i0, i1, i2)]
            if altri:
                Q = P2[altri]
                d1 = (b[0] - a[0]) * (Q[:, 1] - a[1]) - (b[1] - a[1]) * (Q[:, 0] - a[0])
                d2 = (c[0] - b[0]) * (Q[:, 1] - b[1]) - (c[1] - b[1]) * (Q[:, 0] - b[0])
                d3 = (a[0] - c[0]) * (Q[:, 1] - c[1]) - (a[1] - c[1]) * (Q[:, 0] - c[0])
                if np.any((d1 >= 0) & (d2 >= 0) & (d3 >= 0)):
                    continue                 # c'e' dentro un altro punto del contorno
            tri.append((i0, i1, i2))
            resto.pop(k)
            preso = True
            giri_a_vuoto = 0
            break
        if not preso:
            giri_a_vuoto += 1
            break
    if len(resto) != 3:
        return None
    tri.append((resto[0], resto[1], resto[2]))
    return tri


def _gruppi_di_bordo(F, sel):
    """Spigoli dove la selezione confina col resto, raggruppati per anello.

    NON serve ordinarli: il tappo e' un ventaglio verso il centro, quindi
    conta solo sapere QUALI spigoli stanno sullo stesso anello. Ordinarli era
    fragile (bastava un vertice con due diramazioni per spezzare l'anello in
    venti frammenti); raggrupparli con union-find non sbaglia mai.
    """
    tutti = set()
    for f in range(len(F)):
        a, b, c = int(F[f][0]), int(F[f][1]), int(F[f][2])
        tutti.add((a, b)); tutti.add((b, c)); tutti.add((c, a))
    da_sel = set()
    for f in sel:
        a, b, c = int(F[f][0]), int(F[f][1]), int(F[f][2])
        da_sel.add((a, b)); da_sel.add((b, c)); da_sel.add((c, a))
    # spigolo di confine: la selezione lo percorre in un verso e un triangolo
    # NON selezionato nell'altro. Il controllo su `tutti` esclude i bordi aperti
    # del modello stesso (dove il verso opposto non esiste affatto): quelli non
    # sono confini della selezione e includerli rovinava il tappo.
    bordo = [e for e in da_sel if (e[1], e[0]) in tutti and (e[1], e[0]) not in da_sel]
    if not bordo:
        return []
    padre = {}
    def trova(x):
        padre.setdefault(x, x)
        while padre[x] != x:
            padre[x] = padre[padre[x]]
            x = padre[x]
        return x
    def unisci(x, y):
        rx, ry = trova(x), trova(y)
        if rx != ry:
            padre[rx] = ry
    for a, b in bordo:
        unisci(a, b)
    gruppi = {}
    for e in bordo:
        gruppi.setdefault(trova(e[0]), []).append(e)
    # gli anelli veri hanno almeno 3 spigoli; i frammenti minuscoli si scartano
    return [g for g in gruppi.values() if len(g) >= 3]


def taglia_sulla_selezione(vertices, faces, selezione, connettore=True, gioco=0.20,
                           lato=None, profondita=None, scala_connettore=1.0,
                           appiattisci=True):
    """Stacca ESATTAMENTE i triangoli selezionati, chiudendo entrambi i pezzi
    con un tappo sull'anello di bordo.

    selezione   : indici dei triangoli scelti dall'utente
    appiattisci : porta i vertici dell'anello sul loro piano medio, cosi' la
                  faccia di taglio esce piatta (comoda da stampare). Lo
                  spostamento e' identico sui due pezzi, quindi combaciano
                  comunque. Se l'anello e' molto storto si rinuncia, per non
                  deformare il modello.
    """
    log = [f"[{VERSIONE}] taglio esattamente sulla selezione"]
    import trimesh
    V = np.asarray(vertices, dtype=np.float64).copy()
    F = np.asarray(faces, dtype=np.int64)
    sel = set(int(x) for x in np.asarray(selezione).ravel())
    if not sel or len(sel) >= len(F):
        raise ValueError("La selezione e' vuota, o copre tutto il pezzo.")

    # SALDATURA dei vertici doppi. Negli STL ogni triangolo porta i suoi tre
    # vertici per conto proprio: due triangoli adiacenti non condividono nulla,
    # quindi "spigolo di confine" non vorrebbe dire niente e ogni triangolo
    # sembrerebbe un'isola. Saldare rimappa solo gli INDICI: numero e ordine
    # dei triangoli non cambiano, quindi gli indici della selezione restano validi.
    # ...ma si salda SOLO se serve, e solo se non fa danni. Su una mesh che
    # arriva da una booleana i vertici sono gia' condivisi, e forzare la
    # saldatura fondeva punti vicini ma distinti creando triangoli di area
    # nulla: 64 su 624, con i pezzi che si aprivano proprio dove li avevamo
    # chiusi. Si controlla prima se i triangoli condividono gia' gli spigoli.
    def _spigoli(FF):
        e = set()
        for f in range(len(FF)):
            a, b, c = int(FF[f][0]), int(FF[f][1]), int(FF[f][2])
            e.add((a, b)); e.add((b, c)); e.add((c, a))
        return e
    def _degeneri(FF):
        return sum(1 for f in FF if len({int(f[0]), int(f[1]), int(f[2])}) < 3)
    sp = _spigoli(F)
    orfani = sum(1 for (a, b) in sp if (b, a) not in sp)
    if orfani > len(sp) * 0.2:
        _t = trimesh.Trimesh(vertices=V, faces=F, process=False)
        _t.merge_vertices()
        F2 = np.asarray(_t.faces, dtype=np.int64)
        if len(F2) == len(F) and _degeneri(F2) == 0:
            V = np.asarray(_t.vertices, dtype=np.float64).copy()
            F = F2
            log.append(f"Vertici saldati: {len(V)} vertici per {len(F)} triangoli")
        else:
            log.append("(saldatura scartata: avrebbe creato triangoli di area nulla)")
    else:
        log.append(f"Vertici gia' condivisi ({len(V)} per {len(F)} triangoli): niente saldatura")

    # DENTI E INTACCATURE. Il contorno della selezione, seguendo gli spigoli dei
    # triangoli, produce linguette sottili attaccate per un filo e intaccature
    # profonde un triangolo. Sono proprio i "denti" che si vedono sul pezzo
    # staccato: in stampa si spezzano e in assemblaggio danno fastidio.
    # Si tolgono con due regole semplici, ripetute qualche volta:
    #   - un triangolo selezionato attaccato al resto della selezione da un solo
    #     lato e' una linguetta: si scarta;
    #   - un triangolo NON selezionato circondato su due lati dalla selezione e'
    #     un'intaccatura: si prende.
    vicini_faccia = {}
    _lato = {}
    for f in range(len(F)):
        a, b, c = int(F[f][0]), int(F[f][1]), int(F[f][2])
        for e in ((a, b), (b, c), (c, a)):
            k = (min(e), max(e))
            _lato.setdefault(k, []).append(f)
    for k, ff in _lato.items():
        if len(ff) == 2:
            vicini_faccia.setdefault(ff[0], []).append(ff[1])
            vicini_faccia.setdefault(ff[1], []).append(ff[0])
    for _ in range(3):
        togli = {f for f in sel if sum(1 for g in vicini_faccia.get(f, []) if g in sel) <= 1}
        # tre vicini su tre, non due: con due la regola contagia tutto il
        # pezzo (su una mesh chiusa quasi ogni triangolo finisce per averne
        # due selezionati) e la selezione cresce fino a coprire il modello
        metti = {f for f in range(len(F)) if f not in sel
                 and len(vicini_faccia.get(f, [])) == 3
                 and sum(1 for g in vicini_faccia[f] if g in sel) == 3}
        if not togli and not metti:
            break
        sel -= togli
        sel |= metti
    log.append(f"Contorno ripulito da denti e intaccature: {len(sel)} triangoli selezionati")

    # PUNTI PIZZICATI. Se il contorno della selezione si tocca da solo, in quel
    # vertice passa due volte (grado 4 invece di 2) e nessun tappo puo' chiuderlo:
    # il raggio verso il centro del tappo verrebbe usato da quattro triangoli
    # invece di due. Succede spesso su un orlo strappato, dove il bordo serpeggia.
    # Si scioglie il pizzico prendendo nella selezione tutti i triangoli attorno
    # a quel vertice: le due passate si fondono in una e il contorno torna semplice.
    from collections import Counter
    per_vertice = {}
    for f in range(len(F)):
        for k in range(3):
            per_vertice.setdefault(int(F[f][k]), []).append(f)
    for giro in range(8):
        anelli = _gruppi_di_bordo(F, sel)
        grado = Counter()
        for gr in anelli:
            for a, b in gr:
                grado[a] += 1
                grado[b] += 1
        pizzicati = [v for v, c in grado.items() if c != 2]
        if not pizzicati:
            break
        for v in pizzicati:
            for f in per_vertice.get(v, []):
                sel.add(f)
        log.append(f"Sciolti {len(pizzicati)} punti pizzicati sul contorno "
                   f"(la selezione si toccava da sola)")
        if len(sel) >= len(F):
            raise ValueError("La selezione, allargata per sciogliere i pizzichi, copre tutto il pezzo.")

    anelli = _gruppi_di_bordo(F, sel)
    if not anelli:
        raise ValueError("Non trovo il bordo della selezione: prova a chiudere i buchi nella zona scelta.")
    log.append(f"Bordo della selezione: {len(anelli)} anello/i, "
               + ", ".join(str(len(a)) for a in anelli) + " spigoli")

    facce_a = [F[f] for f in sorted(sel)]
    facce_b = [F[f] for f in range(len(F)) if f not in sel]
    diag = float(np.linalg.norm(V.max(axis=0) - V.min(axis=0))) or 1.0

    # LEVIGATURA DEL CONTORNO. Il taglio corre lungo gli spigoli dei triangoli,
    # quindi il bordo esce a scalini: e' il "rumore" che si vede sul pezzo
    # staccato. I tagli col piano erano lisci perche' il piano attraversa i
    # triangoli invece di aggirarli. Qui si ottiene lo stesso effetto
    # rilassando l'anello: ogni vertice del contorno si sposta verso la meta'
    # dei suoi due vicini sull'anello, e la sega diventa una curva.
    # Il contorno pero' vive sulla PELLE del modello: se lo si lascia libero,
    # raddrizzandosi affonda nella parete e assottiglia il pezzo (su un
    # cilindro rado si perdeva il 2% di volume). Quindi ogni spostamento viene
    # schiacciato sul piano tangente alla superficie: la linea di taglio
    # scivola sulla pelle come una matita, senza scavarla.
    # I vertici spostati sono gli stessi per i due pezzi, quindi le facce
    # continuano a combaciare esattamente.
    nf = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    normali_v = np.zeros_like(V)
    for k in range(3):
        np.add.at(normali_v, F[:, k], nf)
    ln = np.linalg.norm(normali_v, axis=1)
    normali_v[ln > 1e-12] /= ln[ln > 1e-12][:, None]

    # Per ogni vertice: distanza dal vertice piu' vicino con cui condivide un
    # triangolo. Serve a non far scavalcare un vertice ai suoi compagni mentre
    # il contorno si liscia: se un punto del bordo scivola piu' di cosi', i
    # triangoli che gli stanno attorno si allungano in schegge, ed e' la
    # "frangia sporca" che si vede attorno alla faccia di taglio.
    _dmin = {}
    for f in F:
        a, b, c = int(f[0]), int(f[1]), int(f[2])
        for x, y in ((a, b), (b, c), (c, a)):
            d = float(np.linalg.norm(V[x] - V[y]))
            if d <= 0:
                continue
            if x not in _dmin or d < _dmin[x]:
                _dmin[x] = d
            if y not in _dmin or d < _dmin[y]:
                _dmin[y] = d

    def _leviga_anello(anello, giri=12, lam=0.35, tetto_assoluto=None):
        vicini = {}
        for x, y in anello:
            vicini.setdefault(x, []).append(y)
            vicini.setdefault(y, []).append(x)
        punti = [v for v, n in vicini.items() if len(n) == 2]
        if len(punti) < 6:
            return 0.0, 0.0, 0.0
        # tetto allo spostamento: una frazione della distanza tipica fra due
        # vertici dell'anello. Serve a togliere i dentini SENZA rimpicciolire
        # il contorno: un rilassamento libero tira ogni punto verso il centro
        # e a furia di giri l'anello si stringe fino a collassare.
        # Tetto LOCALE, vertice per vertice: la media generale non va bene
        # perche' su una mesh rada l'anello puo' contenere spigoli lunghissimi
        # (il fianco di un cilindro alto e' un solo quadrato: la diagonale
        # misura quanto tutto il pezzo) e un tetto medio permetterebbe
        # spostamenti enormi, fino a far collassare il contorno.
        tetti = {}
        for v in punti:
            x, y = vicini[v]
            # 1,5 spigoli, non 0,4: la scalinatura da togliere e' alta quanto
            # UNO spigolo, quindi con un tetto sotto l'unita' il contorno non
            # riesce nemmeno a raddrizzarsi. Su una mesh fitta (spigoli da un
            # millimetro) il vecchio tetto lasciava spostare 0,27 mm: la sega
            # restava tale e quale.
            t = 1.5 * min(float(np.linalg.norm(V[v] - V[x])),
                          float(np.linalg.norm(V[v] - V[y])))
            # ...ma MAI oltre la meta' della distanza dal vertice piu' vicino
            # con cui condivide un triangolo. Oltre quel limite il punto
            # scavalca i suoi compagni e i triangoli attorno si allungano in
            # schegge: e' la frangia sporca che restava attorno alla faccia di
            # taglio (spostamenti fino a 5,5 mm su triangoli da un millimetro).
            if v in _dmin:
                t = min(t, 0.5 * _dmin[v])
            # ...e comunque mai piu' di una frazione minuscola del modello:
            # i dentini da togliere sono piccoli per definizione, quindi un
            # tetto assoluto non toglie nulla di utile ma impedisce che su una
            # mesh rada il contorno venga tirato via di decine di millimetri.
            tetti[v] = min(t, tetto_assoluto) if tetto_assoluto else t
        p0 = {v: V[v].copy() for v in punti}
        zero = np.zeros(3)

        def _seghettatura():
            # quanto ogni punto sporge rispetto alla meta' dei suoi due vicini,
            # in proporzione alla lunghezza tipica degli spigoli: 0 = filo
            # dritto, ~1 = zig-zag da un vertice all'altro.
            s = l = 0.0
            for v in punti:
                x, y = vicini[v]
                s += float(np.linalg.norm(0.5 * (V[x] + V[y]) - V[v]))
                l += 0.5 * (float(np.linalg.norm(V[v] - V[x]))
                            + float(np.linalg.norm(V[v] - V[y])))
            return s / l if l else 0.0

        prima = _seghettatura()
        for _ in range(giri):
            # Spostamento laplaciano grezzo: ogni punto verso la meta' dei suoi
            # due vicini. Preso cosi' com'e' toglie i dentini ma stringe anche
            # le curve buone (un anello circolare si accartoccia verso il
            # centro giro dopo giro).
            d = {}
            for v in punti:
                x, y = vicini[v]
                d[v] = 0.5 * (V[x] + V[y]) - V[v]
            # Si tiene solo la parte "a scatti": si calcola la media dello
            # spostamento sui vicini e la si sottrae. Su una curva regolare
            # i vicini spingono tutti nello stesso verso, la media e' uguale
            # allo spostamento e non resta nulla: la curva non si stringe. Su
            # una scalinatura i vicini spingono a zig-zag, la media si annulla
            # e lo spostamento resta intero: i dentini vengono via.
            media = dict(d)
            for _ in range(2):
                media = {v: 0.5 * (media[v] + 0.5 * (media.get(vicini[v][0], zero)
                                                     + media.get(vicini[v][1], zero)))
                         for v in punti}
            nuovi = {}
            for v in punti:
                passo = lam * (d[v] - media[v])
                n = normali_v[v]
                passo = passo - n * float(passo @ n)   # scivola, non affonda
                nuovi[v] = V[v] + passo
            for v, p in nuovi.items():
                s = p - p0[v]
                n = float(np.linalg.norm(s))
                t = tetti[v]
                V[v] = p0[v] + s * (t / n) if n > t else p
        return (max(float(np.linalg.norm(V[v] - p0[v])) for v in punti),
                prima, _seghettatura())

    normali_tappo = []
    centri_tappo = []
    for anello in anelli:
        mosso, segh0, segh1 = _leviga_anello(anello, tetto_assoluto=0.005 * diag)
        if mosso > 0:
            log.append(f"Contorno levigato: seghettatura da {segh0:.2f} a {segh1:.2f} "
                       f"(0 = filo dritto), spostamento massimo {mosso:.2f} mm")
        vs = sorted({a for e in anello for a in e})
        P = V[vs]
        centro = P.mean(axis=0)
        # piano medio dell'anello (autovettore piu' piccolo della dispersione)
        D = P - centro
        M = D.T @ D
        val, vec = np.linalg.eigh(M)
        n_an = vec[:, 0]
        scarto = float(np.sqrt(max(val[0], 0.0) / max(len(P), 1)))
        larghezza = float(np.linalg.norm(P.max(axis=0) - P.min(axis=0))) or 1.0
        # appiattisci solo se l'anello e' GIA' quasi piatto: se e' molto storto
        # (un orlo strappato) schiacciarlo deformerebbe il modello a vista
        # ...e solo se schiacciandolo nessun vertice finisce SOPRA un altro.
        # L'anello di confine spesso zigzaga fra due quote (i triangoli del
        # fianco si alternano): appiattendolo, due vertici alla stessa
        # posizione angolare ma altezza diversa cadono nello stesso punto, e
        # da li' nascono triangoli di area nulla e buchi nel pezzo.
        # FACCIA DI TAGLIO PIATTA SENZA TOCCARE LA PELLE.
        # Prima si tiravano i vertici del contorno sul piano medio: la faccia
        # veniva piatta, ma quei vertici stanno sulla PELLE del modello e su un
        # contorno curvo restava un gradino ben visibile (la "sporgenza").
        # Ora la pelle non si tocca: si aggiunge una GONNELLA interna che porta
        # il contorno vero fino al piano, e li' si chiude con un disco piatto.
        # La gonnella sta dentro al pezzo, quindi non si vede; la faccia che si
        # appoggia sul piatto della stampante e' piana davvero; e i due pezzi
        # condividono gonnella e disco, quindi combaciano al millesimo.
        giro = _ordina_anello(anello)
        if giro is None:
            giro = _cicli_anello(anello)
        else:
            giro = [giro]
        u_an = np.cross(n_an, [0.0, 0.0, 1.0])
        if np.linalg.norm(u_an) < 1e-9:
            u_an = np.cross(n_an, [0.0, 1.0, 0.0])
        u_an = _normalizza(u_an)
        v_an = np.cross(n_an, u_an)
        fatto = False
        if giro:
            # il piano si mette dalla parte del pezzo staccato piu' lontana,
            # cosi' la gonnella non sbuca fuori dalla pelle
            quote = (V[[k for c in giro for k in c]] - centro) @ n_an
            piano_q = float(np.median(quote))
            nuovi_tri_a, nuovi_tri_b = [], []
            V_extra = []
            base = len(V)
            aree_tot = []
            ok = True
            for ciclo in giro:
                if len(ciclo) < 3:
                    ok = False
                    break
                Pg = V[ciclo]
                # proiezione sul piano (quota comune), in coordinate del piano
                proj = Pg - np.outer((Pg - centro) @ n_an - piano_q, n_an)
                P2 = np.column_stack([(proj - centro) @ u_an, (proj - centro) @ v_an])
                tri2 = _ritaglia_orecchie(P2)
                if tri2 is None:
                    ok = False
                    break
                idx_piano = [base + len(V_extra) + i for i in range(len(ciclo))]
                V_extra.extend(list(proj))
                # gonnella: ogni spigolo del contorno sale al suo gemello sul piano
                n_c = len(ciclo)
                for i in range(n_c):
                    a, b = ciclo[i], ciclo[(i + 1) % n_c]
                    a2, b2 = idx_piano[i], idx_piano[(i + 1) % n_c]
                    if a2 != a:
                        nuovi_tri_b.append([a, b, b2]); nuovi_tri_a.append([b2, b, a])
                        nuovi_tri_b.append([a, b2, a2]); nuovi_tri_a.append([a2, b2, a])
                # disco piatto
                for i0, i1, i2 in tri2:
                    A, B, C = idx_piano[i0], idx_piano[i1], idx_piano[i2]
                    nuovi_tri_b.append([A, B, C]); nuovi_tri_a.append([C, B, A])
                aree_tot.append((sum(0.5 * abs(_area2(P2[i0], P2[i1], P2[i2])) for i0, i1, i2 in tri2),
                                 P2, tri2, idx_piano))
            if ok and aree_tot:
                V = np.vstack([V, np.asarray(V_extra, dtype=np.float64)]) if V_extra else V
                facce_a.extend(nuovi_tri_a)
                facce_b.extend(nuovi_tri_b)
                salita = float(np.max(np.abs(quote - piano_q)))
                log.append(f"Faccia di taglio PIATTA con gonnella interna: {len(giro)} contorno/i, "
                           f"la pelle non viene toccata (dislivello colmato {salita:.1f} mm)")
                # connettore al centro del disco piu' grande
                _, P2m, tri2m, idxm = max(aree_tot, key=lambda t: t[0])
                aree = [0.5 * abs(_area2(P2m[i0], P2m[i1], P2m[i2])) for i0, i1, i2 in tri2m]
                i_max = int(np.argmax(aree))
                centri_tappo.append(np.mean(V[[idxm[k] for k in tri2m[i_max]]], axis=0))
                fatto = True
        if not fatto and giro:
            # La faccia piatta non e' possibile (il contorno, schiacciato sul
            # piano, si accavalla): si chiude il contorno COM'E', in tre
            # dimensioni. Non e' piatta, ma niente raggiera.
            n_tri = 0
            for ciclo in giro:
                if len(ciclo) < 3:
                    continue
                t3 = _orecchie_3d(V[ciclo], n_an)
                if t3 is None:
                    n_tri = 0
                    break
                for i0, i1, i2 in t3:
                    a, b, c = ciclo[i0], ciclo[i1], ciclo[i2]
                    facce_a.append([c, b, a])
                    facce_b.append([a, b, c])
                n_tri += len(t3)
            if n_tri:
                log.append(f"Contorno troppo ondulato per una faccia piatta: chiuso "
                           f"seguendolo com'e' ({n_tri} triangoli, niente raggiera)")
                centri_tappo.append(centro)
                fatto = True
        if not fatto:
            ic = len(V)
            V = np.vstack([V, centro])
            for a, b in anello:
                facce_a.append([b, a, ic])
                facce_b.append([a, b, ic])
            log.append("Tappo del taglio a raggiera (contorno non richiudibile altrimenti)")
            centri_tappo.append(centro)
        normali_tappo.append(n_an)

    # process=False di proposito: i due pezzi li abbiamo costruiti con la
    # topologia giusta (ogni spigolo esattamente due facce). Lasciando fare a
    # trimesh la fusione dei vertici, due punti vicini verrebbero uniti e il
    # pezzo si aprirebbe proprio dove l'avevamo chiuso.
    ma = trimesh.Trimesh(vertices=V, faces=np.asarray(facce_a, dtype=np.int64), process=False)
    mb = trimesh.Trimesh(vertices=V, faces=np.asarray(facce_b, dtype=np.int64), process=False)
    ma.remove_unreferenced_vertices()
    mb.remove_unreferenced_vertices()
    log.append(f"Pezzo staccato: {len(ma.faces)} facce, chiuso={ma.is_watertight}; "
               f"resto: {len(mb.faces)} facce, chiuso={mb.is_watertight}")
    if not (ma.is_watertight and mb.is_watertight):
        # Quasi chiusi: capita che resti un pizzico isolato che il giro di
        # scioglimento non ha sciolto. Tappare quei pochi buchi e' meglio che
        # buttare via un taglio per il resto corretto.
        for m_ in (ma, mb):
            if not m_.is_watertight:
                try:
                    m_.fill_holes()
                except Exception:
                    pass
        if ma.is_watertight and mb.is_watertight:
            log.append("Chiusi alcuni buchi residui sul contorno")
    # Il taglio si giudica da QUANTO e' malmesso, non dal semplice si/no di
    # is_watertight: se il pezzo di partenza aveva gia' un paio di spigoli
    # difettosi, quelli restano nel pezzo che avanza e non sono colpa del
    # taglio. Buttare via un taglio per il resto corretto sarebbe assurdo:
    # l'app segnala gia' da sola i pezzi non perfettamente chiusi.
    if not (ma.is_watertight and mb.is_watertight):
        def _malformati(FF):
            c = {}
            for f in FF:
                for e in ((int(f[0]), int(f[1])), (int(f[1]), int(f[2])), (int(f[2]), int(f[0]))):
                    k = (min(e), max(e))
                    c[k] = c.get(k, 0) + 1
            return sum(1 for v in c.values() if v != 2), len(c)
        ba, ta = _malformati(np.asarray(facce_a))
        bb, tb = _malformati(np.asarray(facce_b))
        # tollera qualche spigolo difettoso ereditato dal pezzo di partenza
        if ba <= max(2, ta // 200) and bb <= max(2, tb // 200):
            log.append(f"Taglio riuscito; restano {ba + bb} spigoli difettosi "
                       "(erano gia' nel pezzo di partenza)")
        else:
            raise ValueError(
                "Il contorno della selezione e' troppo intricato per tagliarci sopra. "
                f"Staccato: {ba}/{ta} spigoli mal formati; resto: {bb}/{tb}; "
                f"anelli={[len(x) for x in anelli]}; selezione={len(sel)}/{len(F)} triangoli"
            )

    if not connettore:
        return {"a": _pack(np.asarray(ma.vertices), np.asarray(ma.faces)),
                "b": _pack(np.asarray(mb.vertices), np.asarray(mb.faces)), "log": log}

    # connettore sul tappo piu' grande, lungo la sua normale
    i_big = int(np.argmax([len(a) for a in anelli]))
    n_c = _normalizza(normali_tappo[i_big])
    centro = np.asarray(centri_tappo[i_big], dtype=np.float64)
    # la normale deve puntare dal resto VERSO il pezzo staccato
    if float((np.asarray(ma.vertices).mean(axis=0) - centro) @ n_c) < 0:
        n_c = -n_c
    u, v, nn = _base_da_normale(n_c)
    Pan = np.asarray([V[a] for e in anelli[i_big] for a in e], dtype=np.float64)
    minore = 2.0 * min(0.5 * float((Pan @ u).max() - (Pan @ u).min()),
                       0.5 * float((Pan @ v).max() - (Pan @ v).min()))
    # Il perno va misurato anche sullo SPESSORE del pezzo staccato, non solo
    # sull'ampiezza dell'anello di taglio: una ciocca di capelli ha un anello
    # largo ma e' sottile, e un perno tarato sull'anello la sfonda da parte a
    # parte rovinando il modello.
    # Lo spessore NON si puo' leggere dalla scatola che contiene il pezzo: una
    # ciocca ricurva sta in una scatola da 121 mm pur essendo spessa 30. Si usa
    # anche il rapporto fra volume e superficie, che per una lastra vale meta'
    # dello spessore e non si lascia ingannare dalla curvatura (misurato sul
    # modello vero: ciocca scatola 121 mm, volume/superficie 30 mm; gamba
    # scatola 307 mm, volume/superficie 110 mm — cioe' lo spessore giusto).
    dim_pezzo = np.asarray(ma.bounds[1]) - np.asarray(ma.bounds[0])
    area = float(ma.area) or 1.0
    spessore = min(float(dim_pezzo.min()), 4.0 * abs(float(ma.volume)) / area)
    # Un perno non deve mai superare un terzo dello spessore, altrimenti sfonda
    # il pezzo. Sotto una certa misura pero' non e' nemmeno stampabile (con un
    # ugello da 0,4 servono almeno un paio di millimetri): su un pezzo troppo
    # sottile e' meglio NON metterlo e dirlo, che metterne uno che rovina il
    # modello. Prima un `max(4.0, ...)` scavalcava il limite e su una lamina da
    # 1,7 mm usciva comunque un perno da 4 mm.
    tetto = 0.33 * spessore
    if lato is None and profondita is None and tetto < 2.0:
        log.append(f"Pezzo staccato spesso solo {spessore:.1f} mm: niente perno "
                   "(sarebbe piu' grosso del pezzo). I due pezzi combaciano "
                   "comunque: si uniscono con la colla.")
        va, fa = np.asarray(ma.vertices), np.asarray(ma.faces)
        vb, fb = np.asarray(mb.vertices), np.asarray(mb.faces)
        return {"a": _pack(va, fa), "b": _pack(vb, fb), "log": log}
    if lato is None:
        lato = float(np.clip(0.28 * minore, 2.0, max(2.0, min(0.45 * minore, tetto))))
    if profondita is None:
        profondita = float(np.clip(0.9 * lato, 1.5, max(1.5, min(0.9 * lato, tetto))))
    if scala_connettore and scala_connettore != 1.0:
        lato *= scala_connettore
        profondita *= scala_connettore
    log.append(f"Pezzo staccato spesso {spessore:.1f} mm: perno limitato a "
               f"lato {lato:.1f} mm, profondita' {profondita:.1f} mm")

    A = _manifold(np.asarray(ma.vertices), np.asarray(ma.faces))
    B = _manifold(np.asarray(mb.vertices), np.asarray(mb.faces))
    if A.status().name != "NoError" or B.status().name != "NoError":
        log.append("(pezzi non validi per la booleana: consegnati senza connettore)")
        return {"a": _pack(np.asarray(ma.vertices), np.asarray(ma.faces)),
                "b": _pack(np.asarray(mb.vertices), np.asarray(mb.faces)), "log": log}
    incastro = 0.15 * profondita
    h = profondita + incastro
    c_perno = centro - nn * (profondita * 0.5) + nn * (incastro * 0.5)
    A = A + _cubo([lato, lato, h], c_perno, u, v, nn)
    B = B - _cubo([lato + 2 * gioco, lato + 2 * gioco, h + gioco],
                  c_perno - nn * (gioco * 0.5), u, v, nn)
    if A.status().name != "NoError" or B.status().name != "NoError":
        raise ValueError("La booleana del connettore non e' riuscita.")
    log.append(f"Connettore: lato {lato:.2f} mm, profondita' {profondita:.2f} mm, gioco {gioco:.2f} mm")
    va, fa = _to_arrays(A)
    vb, fb = _to_arrays(B)
    return {"a": _pack(va, fa), "b": _pack(vb, fb), "log": log,
            "connettore": {"lato": lato, "profondita": profondita, "gioco": gioco, "n": 1}}
