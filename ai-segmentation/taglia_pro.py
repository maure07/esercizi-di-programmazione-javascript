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
VERSIONE = "zone-somma-36"


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


def _gruppi_spigoli(F):
    """Gli spigoli della mesh, raggruppati.

    Restituisce, per ogni spigolo distinto: la faccia che lo usa, da che parte
    lo percorre, e dove cominciano e finiscono le sue occorrenze. Tutto con
    numpy e un ordinamento, senza dizionari: su un modello da tre milioni di
    triangoli la differenza fra i due modi e' fra due secondi e un minuto.
    """
    n = len(F)
    E = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]], axis=0)
    facce = np.tile(np.arange(n, dtype=np.int64), 3)
    lo = np.minimum(E[:, 0], E[:, 1])
    hi = np.maximum(E[:, 0], E[:, 1])
    verso = E[:, 0] < E[:, 1]            # True se la faccia va da lo verso hi
    ordine = np.lexsort((hi, lo))
    lo, hi, facce, verso = lo[ordine], hi[ordine], facce[ordine], verso[ordine]
    # inizio di ogni gruppo di spigoli uguali
    nuovo = np.empty(len(lo), dtype=bool)
    nuovo[0] = True
    nuovo[1:] = (lo[1:] != lo[:-1]) | (hi[1:] != hi[:-1])
    inizi = np.flatnonzero(nuovo)
    quanti = np.diff(np.append(inizi, len(lo)))
    return lo, hi, facce, verso, inizi, quanti


def _togli_spigoli_multipli(V, F):
    """Butta via le facce di troppo sugli spigoli divisi da PIU' di due facce.

    E' il difetto del modello segnalato: "spigoli doppi 727", nessun buco. Un
    solo spigolo con tre facce basta a far rifiutare tutta la mesh, e nel
    resoconto usciva solo un secco "NotManifold". Di ogni spigolo affollato si
    tengono le due facce piu' grandi (le altre sono quasi sempre schegge o
    copie sovrapposte) e si scartano le altre.
    """
    _lo, _hi, facce, _verso, inizi, quanti = _gruppi_spigoli(F)
    affollati = np.flatnonzero(quanti > 2)
    if not len(affollati):
        return F, 0
    T = V[F]
    aree = 0.5 * np.linalg.norm(
        np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]), axis=1)
    da_togliere = set()
    for i in affollati:
        s = int(inizi[i])
        cand = [int(x) for x in facce[s:s + int(quanti[i])] if int(x) not in da_togliere]
        if len(cand) <= 2:
            continue
        cand.sort(key=lambda f: -aree[f])
        da_togliere.update(cand[2:])
    if not da_togliere:
        return F, 0
    tieni = np.ones(len(F), dtype=bool)
    tieni[sorted(da_togliere)] = False
    return F[tieni], len(da_togliere)


def _versi_coerenti(F):
    """Gira tutte le facce nello stesso verso.

    Due facce che si dividono uno spigolo sono d'accordo se lo percorrono in
    direzioni opposte (come due mattonelle affiancate). Si parte da una faccia,
    si passa ai vicini e si gira chi non e' d'accordo, finche' non si e' visto
    tutto. Serve perche' manifold3d rifiuta una superficie con le facce
    mescolate, e i modelli usciti dall'IA le hanno spesso cosi'.

    trimesh avrebbe `repair.fix_winding`, ma si appoggia a networkx, che sul PC
    di chi usa l'app non c'e': la stessa storia di rtree. Quindi a mano.
    """
    n = len(F)
    _lo, _hi, facce, verso, inizi, quanti = _gruppi_spigoli(F)
    # coppie di facce che condividono uno spigolo "sano" (esattamente due)
    coppie = np.flatnonzero(quanti == 2)
    if not len(coppie):
        return F, 0
    s = inizi[coppie]
    f1, f2 = facce[s], facce[s + 1]
    v1, v2 = verso[s], verso[s + 1]
    daccordo = v1 != v2               # versi opposti = d'accordo
    # elenco dei vicini, in forma compatta (chi comincia dove)
    a = np.concatenate([f1, f2])
    b = np.concatenate([f2, f1])
    d = np.concatenate([daccordo, daccordo])
    ordine = np.argsort(a, kind="stable")
    a, b, d = a[ordine], b[ordine], d[ordine]
    inizio = np.searchsorted(a, np.arange(n + 1))

    gira = np.zeros(n, dtype=bool)
    visto = np.zeros(n, dtype=bool)
    for partenza in range(n):
        if visto[partenza]:
            continue
        visto[partenza] = True
        pila = [partenza]
        while pila:
            f = pila.pop()
            for k in range(inizio[f], inizio[f + 1]):
                g = int(b[k])
                if visto[g]:
                    continue
                visto[g] = True
                gira[g] = gira[f] if d[k] else (not gira[f])
                pila.append(g)
    quante = int(gira.sum())
    if quante == 0:
        return F, 0
    F = F.copy()
    F[gira] = F[gira][:, ::-1]
    return F, quante


def _tappa_buchi(V, F):
    """Chiude le aperture cucendo un ventaglio di triangoli su ogni giro di bordo.

    Il bordo e' fatto dagli spigoli usati da una faccia sola. Si mettono in
    fila fino a chiudere il giro e si riempie con un ventaglio che parte dal
    centro del giro. E' lo stesso lavoro che l'app fa gia' nel browser quando
    "solidifica", rifatto qui perche' il taglio gira dall'altra parte.
    """
    lo, hi, facce, verso, inizi, quanti = _gruppi_spigoli(F)
    soli = np.flatnonzero(quanti == 1)
    if not len(soli):
        return V, F, 0
    s = inizi[soli]
    # lo spigolo nel verso in cui lo percorre la sua unica faccia: e' quel verso
    # che dice da che parte guarda il buco, e quindi come girare le toppe
    da = np.where(verso[s], lo[s], hi[s])
    a = np.where(verso[s], hi[s], lo[s])
    # Si seguono i giri consumando gli SPIGOLI, non segnando i vertici: un
    # vertice puo' stare su due giri diversi (o due volte sullo stesso, dove il
    # bordo si strozza), e segnando i vertici il giro si interrompeva a meta'.
    # Era per questo che al primo tentativo restavano aperti meta' dei bordi.
    aperti = {}
    rimasti = 0
    for x, y in zip(da.tolist(), a.tolist()):
        aperti.setdefault(int(x), []).append(int(y))
        rimasti += 1

    nuove = []
    nuovi_punti = []
    partenze = [k for k, v in aperti.items() if v]
    for partenza in partenze:
        while aperti.get(partenza):
            giro = []
            cur = partenza
            for _ in range(rimasti + 1):
                uscite = aperti.get(cur)
                if not uscite:
                    break
                giro.append(cur)
                cur = uscite.pop()
                if cur == partenza:
                    break
            if len(giro) < 3:
                continue
            centro = V[giro].mean(axis=0)
            ic = len(V) + len(nuovi_punti)
            nuovi_punti.append(centro)
            for k in range(len(giro)):
                a_, b_ = giro[k], giro[(k + 1) % len(giro)]
                nuove.append([b_, a_, ic])   # verso opposto al bordo: chiude in fuori
    if not nuove:
        return V, F, 0
    V2 = np.vstack([V, np.asarray(nuovi_punti, dtype=np.float64)])
    F2 = np.vstack([F, np.asarray(nuove, dtype=np.int64)])
    return V2, F2, len(nuove)


def _manifold_solido(V, F, log=None, etichetta="modello"):
    """Un Manifold pronto per le booleane, riparando quel che serve.

    manifold3d pretende una superficie CHIUSA, con ogni spigolo diviso da
    esattamente due triangoli e tutte le facce girate nello stesso verso. I
    modelli usciti dall'IA spesso non lo sono: pezzi separati, facce doppie,
    buchi, versi mescolati. Prima bastava questo per far rifiutare il nocciolo
    senza nemmeno provarci - il resoconto diceva "modello NotManifold" e si
    ripiegava sul perno, lasciando in mano una scaglia.

    Qui invece si prova a rimettere a posto, un gradino alla volta, dal meno
    invasivo al piu' invasivo, e si dice sempre cosa e' stato fatto: sono
    modifiche al modello, non deve scoprirle dopo guardando il pezzo storto.
    """
    import trimesh

    def prova(M):
        if M is None or len(M.faces) == 0:
            return None
        m = _manifold(np.asarray(M.vertices), np.asarray(M.faces))
        return m if m.status().name == "NoError" else None

    def ripulisci(M):
        M.update_faces(M.nondegenerate_faces())
        M.update_faces(M.unique_faces())
        M.remove_unreferenced_vertices()
        return M

    M = ripulisci(trimesh.Trimesh(vertices=np.asarray(V, dtype=np.float64),
                                  faces=np.asarray(F, dtype=np.int64), process=True))
    m = prova(M)
    if m is not None:
        return m, None

    fatti = []
    Vx = np.asarray(M.vertices, dtype=np.float64)
    Fx = np.asarray(M.faces, dtype=np.int64)

    def riprova(Vy, Fy):
        m = _manifold(Vy, Fy)
        return m if m.status().name == "NoError" else None

    # 1) spigoli divisi da piu' di due facce: si buttano le schegge di troppo.
    #    E' il difetto del modello segnalato ("spigoli doppi 727").
    Fx, tolte = _togli_spigoli_multipli(Vx, Fx)
    if tolte:
        fatti.append(f"{tolte} facce di troppo su spigoli affollati")
        m = riprova(Vx, Fx)
        if m is not None:
            return m, ", ".join(fatti)

    # 2) facce girate a caso: si mettono tutte nello stesso verso. E' la
    #    correzione piu' innocua, non sposta un solo vertice.
    Fx, girate = _versi_coerenti(Fx)
    if girate:
        fatti.append(f"{girate} facce rigirate nel verso giusto")
        m = riprova(Vx, Fx)
        if m is not None:
            return m, ", ".join(fatti)

    # 3) buchi: si tappano. Cambia la geometria, ma solo mettendo il coperchio
    #    a un'apertura che comunque non si potrebbe stampare.
    Vx, Fx, toppe = _tappa_buchi(Vx, Fx)
    if toppe:
        fatti.append(f"{toppe} triangoli per chiudere i buchi")
        Fx, _g2 = _versi_coerenti(Fx)
        m = riprova(Vx, Fx)
        if m is not None:
            return m, ", ".join(fatti)

    M = ripulisci(trimesh.Trimesh(vertices=Vx, faces=Fx, process=True))

    # 3) ultimo gradino: si guardano i pezzi staccati uno per uno, si prova a
    #    chiudere ognuno, e si tengono quelli che diventano solidi buoni. Qui
    #    si puo' PERDERE della roba, quindi si conta quanta e si scrive.
    try:
        corpi = M.split(only_watertight=False)
        buoni, persi = [], 0
        for c in corpi:
            c = ripulisci(c)
            Vc = np.asarray(c.vertices, dtype=np.float64)
            Fc = np.asarray(c.faces, dtype=np.int64)
            Fc, _ = _versi_coerenti(Fc)
            Vc, Fc, _ = _tappa_buchi(Vc, Fc)
            Fc, _ = _versi_coerenti(Fc)
            mm = riprova(Vc, Fc)
            if mm is None:
                mm = prova(c)
            if mm is not None:
                buoni.append(mm)
            else:
                persi += len(c.faces)
        if buoni:
            uni = buoni[0]
            for x in buoni[1:]:
                uni = uni + x
            if uni.status().name == "NoError":
                fatti.append(f"tenuti {len(buoni)} corpi su {len(corpi)}")
                if persi and log is not None:
                    log.append(f"ATTENZIONE: per rendere il {etichetta} lavorabile ho dovuto "
                               f"scartare {persi} triangoli che non si chiudevano in nessun modo. "
                               f"Se noti che manca un pezzo, passa prima da \"Ripara e solidifica\".")
                return uni, ", ".join(fatti)
    except Exception:
        pass

    return None, ", ".join(fatti) if fatti else None


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

    solido, _rip = _manifold_solido(V, F, log)
    if _rip and solido is not None:
        log.append(f"Il modello non era lavorabile cosi' com'era: l'ho rimesso "
                   f"a posto ({_rip}).")
    if solido is None:
        raise ValueError(
            "Il modello non e' un solido valido, e non ci sono riuscito nemmeno "
            "riparandolo qui: ho provato a togliere le facce di troppo sugli "
            "spigoli affollati, a rigirare le facce nel verso giusto e a tappare "
            "i buchi. Passa da \"Ripara e solidifica\" allo step 2, oppure usa "
            "\"Riparazione PRO (PC locale)\", e riprova."
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

    solido, _rip = _manifold_solido(V, F, log)
    if _rip and solido is not None:
        log.append(f"Il modello non era lavorabile cosi' com'era: l'ho rimesso "
                   f"a posto ({_rip}).")
    if solido is None:
        raise ValueError("Il modello non e' un solido valido, e non ci sono riuscito "
                         "nemmeno riparandolo qui. Passa da \"Ripara e solidifica\".")
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


def _controllore_pelle(V_orig, F_orig, scatola, margine):
    """Restituisce una funzione che dice quanto dei punti dati sta FUORI dal
    modello di partenza.

    Serve a impedire che il tappo del taglio buchi la pelle. Non basta guardare
    i VERTICI del tappo: un disco piatto largo può avere tutti i vertici dentro
    e sfondare comunque in mezzo, dove il modello si incurva. Misurato sul
    modello vero: guardando i soli vertici la sporgenza risultava 0,05 mm,
    campionando anche l'interno delle facce risultava 5,2 mm.

    Per non pagare una ricerca sull'intero modello (400.000 triangoli) si lavora
    su una porzione locale: solo i triangoli attorno alla zona di taglio.
    """
    import trimesh
    lo = np.asarray(scatola[0], dtype=np.float64) - margine
    hi = np.asarray(scatola[1], dtype=np.float64) + margine
    C = V_orig[F_orig].mean(axis=1)
    vicine = np.all((C >= lo) & (C <= hi), axis=1)
    if not vicine.any():
        return None
    Fl = F_orig[vicine]
    usati = np.unique(Fl)
    rimappa = {int(v): i for i, v in enumerate(usati)}
    Fl2 = np.vectorize(rimappa.__getitem__)(Fl)
    patch = trimesh.Trimesh(vertices=V_orig[usati], faces=Fl2, process=False)
    normali = np.asarray(patch.face_normals, dtype=np.float64)

    def quanto_fuori(punti):
        P = np.asarray(punti, dtype=np.float64).reshape(-1, 3)
        if not len(P):
            return 0, 0.0
        try:
            vicino, _, tri = trimesh.proximity.closest_point(patch, P)
        except Exception:
            # `closest_point` si appoggia a rtree, che e' una libreria in piu' e
            # sul PC di chi usa l'app puo' non esserci. Questo controllo e' solo
            # una MISURA di quanto il tappo sporge: la garanzia vera che i pezzi
            # restino dentro alla pelle la da' la booleana di ritaglio, piu'
            # sotto. Meglio rinunciare alla misura che far saltare tutto il
            # taglio per una libreria mancante.
            return None
        # segno: se il punto sta dalla parte della normale, e' fuori dal solido
        fuori = np.einsum('ij,ij->i', P - vicino, normali[tri])
        pos = fuori[fuori > 0]
        return int(len(pos)), float(pos.max()) if len(pos) else 0.0

    return quanto_fuori


def _campiona_facce(V, facce, per_faccia=3):
    """Punti sparsi sulle facce date: baricentro e punti a meta' strada verso i
    vertici. Serve a controllare anche l'INTERNO delle facce, non solo i bordi."""
    if not facce:
        return np.zeros((0, 3))
    T = V[np.asarray(facce, dtype=np.int64)]
    g = T.mean(axis=1)
    if per_faccia <= 1:
        return g
    pezzi = [g]
    for k in range(min(per_faccia - 1, 3)):
        pezzi.append(0.5 * (g + T[:, k]))
    return np.vstack(pezzi)


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


# ---------------------------------------------------------------------------
# TAGLIO A FUSTELLA
# ---------------------------------------------------------------------------
# Perche' serve. Chiudere l'anello di bordo con un tappo funziona benissimo
# quando la selezione GIRA ATTORNO a qualcosa (una ciocca di capelli, una
# cintura, un polso): li' il contorno e' un anello attorno a un collo e
# chiuderlo produce un solido vero. Ma quando si dipinge una MACCHIA SU UN LATO
# — per esempio una zona sulla coscia — il contorno e' appoggiato sulla
# superficie, e chiuderlo produce per forza una BUCCIA. Misurato sul modello
# vero: un pezzo grande 172x176x203 unita' con uno spessore vero di 15,7 unita',
# cioe' 1,6 mm su una stampa da 20 cm. Da li' viene tutto il resto: niente
# perno (sarebbe piu' grosso del pezzo), faccia di taglio sproporzionata,
# bordo che si sbriciola.
#
# La fustella fa invece quello che uno si aspetta: prende il contorno disegnato,
# lo estrude attraverso il modello come lo stampo di un biscotto, e interseca.
# Il pezzo esce solido, con i fianchi esattamente sul contorno scelto.
def _solido_fustella(giri, centro, u, v, n, lunghezza):
    """Costruisce il solido-fustella: il contorno estruso lungo n, da una parte
    e dall'altra, abbastanza da attraversare tutto il modello."""
    Vs, Fs = [], []
    for ciclo in giri:
        if len(ciclo) < 3:
            continue
        P3 = np.asarray(ciclo, dtype=np.float64)
        P2 = np.column_stack([(P3 - centro) @ u, (P3 - centro) @ v])
        tri = _ritaglia_orecchie(P2)
        if tri is None:
            continue
        m = len(P2)
        b = len(Vs)
        for q in (-lunghezza, lunghezza):
            for i in range(m):
                Vs.append(centro + u * P2[i, 0] + v * P2[i, 1] + n * q)
        # tappi: sotto al rovescio, sopra dritto
        for i0, i1, i2 in tri:
            Fs.append([b + i0, b + i2, b + i1])
            Fs.append([b + m + i0, b + m + i1, b + m + i2])
        # fianchi
        for i in range(m):
            j = (i + 1) % m
            Fs.append([b + i, b + j, b + m + j])
            Fs.append([b + i, b + m + j, b + m + i])
    if not Fs:
        return None
    return np.asarray(Vs, dtype=np.float64), np.asarray(Fs, dtype=np.int64)


def taglia_a_fustella(V, F, sel, anelli, log):
    """Stacca il volume sotto la selezione estrudendone il contorno.

    Torna (mesh_a, mesh_b) oppure None se non ce la fa.
    """
    import trimesh
    giri = []
    for anello in anelli:
        g = _ordina_anello(anello)
        giri.extend([g] if g is not None else _cicli_anello(anello))
    giri = [[V[k] for k in g] for g in giri if g is not None and len(g) >= 3]
    if not giri:
        return None
    P = np.vstack([np.asarray(g) for g in giri])
    centro = P.mean(axis=0)
    D = P - centro
    val, vec = np.linalg.eigh(D.T @ D)
    n = _normalizza(vec[:, 0])          # normale del piano medio del contorno
    u = _normalizza(np.cross(n, [0.0, 0.0, 1.0]) if abs(n[2]) < 0.9
                    else np.cross(n, [1.0, 0.0, 0.0]))
    v = np.cross(n, u)
    diag = float(np.linalg.norm(V.max(axis=0) - V.min(axis=0))) or 1.0
    fu = _solido_fustella(giri, centro, u, v, n, 1.2 * diag)
    if fu is None:
        return None
    Vf, Ff = fu
    Orig, _riparato = _manifold_solido(V, F, log)
    if _riparato:
        log.append(f"Il modello non era lavorabile cosi' com'era: l'ho rimesso "
                   f"a posto ({_riparato})." if Orig is not None else
                   f"Ho provato a rimettere a posto il modello ({_riparato}) ma non e' bastato.")
    Fust = _manifold(Vf, Ff)
    if Orig is None or Fust.status().name != "NoError":
        log.append(f"(fustella non utilizzabile: modello "
                   f"{'irrecuperabile' if Orig is None else Orig.status().name}, "
                   f"fustella {Fust.status().name})")
        return None
    A = Orig ^ Fust
    if A.status().name != "NoError":
        return None
    # se la fustella ha preso piu' blocchi staccati (il tubo attraversa anche
    # roba lontana), si tiene solo quello che sta sotto la selezione
    pezzi = A.decompose()
    if len(pezzi) > 1:
        # si tiene il blocco PIU' GROSSO, non il piu' vicino: il centro della
        # selezione sta sulla pelle, e li' vicino ci sono spesso schegge sottili
        # che vincerebbero il confronto lasciando un pezzo da niente.
        migliore, vmax = None, -1.0
        for pz in pezzi:
            vp, fp = _to_arrays(pz)
            if not len(fp):
                continue
            vol = abs(float(trimesh.Trimesh(vertices=vp, faces=fp, process=False).volume))
            if vol > vmax:
                vmax, migliore = vol, pz
        if migliore is None:
            return None
        A = migliore
        log.append(f"La fustella attraversava {len(pezzi)} blocchi: tenuto quello sotto la selezione")
    B = Orig - A
    if B.status().name != "NoError":
        return None
    va, fa = _to_arrays(A)
    vb, fb = _to_arrays(B)
    if not len(fa) or not len(fb):
        return None
    ma = trimesh.Trimesh(vertices=va, faces=fa, process=False)
    mb = trimesh.Trimesh(vertices=vb, faces=fb, process=False)
    log.append("Taglio A FUSTELLA: il contorno che hai disegnato e' stato estruso "
               "attraverso il modello, cosi' il pezzo esce solido invece che una buccia")
    return ma, mb


# ---------------------------------------------------------------------------
# TAGLIO A NOCCIOLO (incastro a sede, senza perno)
# ---------------------------------------------------------------------------
# L'idea arriva da come sono fatti i pupazzi stampati bene: il musetto non e'
# tenuto da un perno, e' un blocchetto che entra in una SEDE scavata nella
# testa, della sua identica forma. Si posiziona da solo e non scivola.
#
# Da noi risolve il caso che non veniva: una macchia dipinta sul fianco di una
# coscia, chiusa col tappo, dava una buccia da 1,6 mm — troppo sottile perfino
# per metterci il perno. Qui invece la pelle selezionata viene portata verso
# l'interno dello spessore scelto e chiusa di lato: il pezzo esce un solido
# vero, la pelle esterna resta intatta al millesimo, e nell'altro pezzo si
# scava la sede corrispondente.
def _nocciolo(V, F, sel, anelli, profondita, ritiro, normali_v):
    """Costruisce il solido "nocciolo": la pelle selezionata + la stessa pelle
    spostata all'interno di `profondita`, chiuse da una parete sul contorno.

    ritiro : di quanto stringere il nocciolo (gioco di accoppiamento). Zero per
             scavare la sede, il gioco vero per il pezzo che ci deve entrare.
    """
    facce = [F[f] for f in sorted(sel)]
    usati = sorted({int(x) for f in facce for x in f})
    interno = {v: i for i, v in enumerate(usati)}
    n_u = len(usati)
    # vertici del contorno: li si stringe anche di lato, verso il centro della
    # macchia, altrimenti il pezzo entrerebbe nella sede solo a martellate
    bordo = {int(a) for anello in anelli for e in anello for a in e}
    centro_patch = V[usati].mean(axis=0)
    Vn = [V[v] for v in usati]                      # pelle esterna
    for v in usati:
        nv = normali_v[v]
        p = V[v] - nv * profondita
        if ritiro > 0:
            verso = centro_patch - V[v]
            verso = verso - nv * float(verso @ nv)   # solo di lato, non in fuori
            ln = float(np.linalg.norm(verso))
            if ln > 1e-9:
                p = p + verso * (ritiro / ln)
                if v in bordo:
                    pass
        Vn.append(p)
    Vn = np.asarray(Vn, dtype=np.float64)
    Fn = []
    for f in facce:                                  # pelle esterna, come sta
        a, b, c = interno[int(f[0])], interno[int(f[1])], interno[int(f[2])]
        Fn.append([a, b, c])
        Fn.append([n_u + c, n_u + b, n_u + a])       # schiena, al rovescio
    for anello in anelli:                            # parete laterale
        for a, b in anello:
            ia, ib = interno[int(a)], interno[int(b)]
            Fn.append([ib, ia, n_u + ia])
            Fn.append([ib, n_u + ia, n_u + ib])
    return Vn, np.asarray(Fn, dtype=np.int64)


def _prisma_selezione(V, F, sel, anelli, n, lunghezza, dilata=0.0):
    """Solido ottenuto TRASCINANDO la pelle selezionata lungo -n, dritto.

    E' il pezzo chiave del nocciolo a fondo piatto. Rispetto al vecchio
    nocciolo (che copiava la pelle spostandola lungo la normale di ogni
    vertice) qui lo spostamento e' UGUALE per tutti: la faccia di dietro nasce
    dritta invece di ripetere le gobbe della pelle, e soprattutto le normali
    non si incrociano piu' — erano loro a produrre quelle punte sul fondo.

    dilata : allarga il contorno di lato (per scavare la sede un filo piu'
             larga del pezzo che ci deve entrare). La pelle davanti NON si
             tocca mai: quella e' la superficie del modello.
    """
    facce = [F[f] for f in sorted(sel)]
    usati = sorted({int(x) for f in facce for x in f})
    idx = {v: i for i, v in enumerate(usati)}
    nu = len(usati)
    P = V[usati].astype(np.float64).copy()
    if dilata > 0:
        bordo = {int(a) for anello in anelli for e in anello for a in e}
        centro = P.mean(axis=0)
        for v in usati:
            if v not in bordo:
                continue
            d = V[v] - centro
            d = d - n * float(d @ n)        # solo di lato, non lungo il trascinamento
            ln = float(np.linalg.norm(d))
            if ln > 1e-9:
                P[idx[v]] = V[v] + d * (dilata / ln)
    Vn = np.vstack([P, P - n * lunghezza])
    Fn = []
    for f in facce:
        a, b, c = idx[int(f[0])], idx[int(f[1])], idx[int(f[2])]
        Fn.append([a, b, c])
        Fn.append([nu + c, nu + b, nu + a])      # fondo, al rovescio
    for anello in anelli:
        for a, b in anello:
            ia, ib = idx[int(a)], idx[int(b)]
            Fn.append([ib, ia, nu + ia])
            Fn.append([ib, nu + ia, nu + ib])
    return Vn, np.asarray(Fn, dtype=np.int64)


def _inviluppo_convesso(P):
    """Inviluppo convesso di una nuvola di punti 2D (catena monotona).
    Scritto a mano per non dipendere da scipy, che sul PC potrebbe non esserci."""
    pts = sorted({(float(a), float(b)) for a, b in P})
    if len(pts) < 3:
        return np.asarray(pts, dtype=np.float64)

    def croce(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    basso = []
    for p in pts:
        while len(basso) >= 2 and croce(basso[-2], basso[-1], p) <= 0:
            basso.pop()
        basso.append(p)
    alto = []
    for p in reversed(pts):
        while len(alto) >= 2 and croce(alto[-2], alto[-1], p) <= 0:
            alto.pop()
        alto.append(p)
    return np.asarray(basso[:-1] + alto[:-1], dtype=np.float64)


def _ricampiona(poly, k):
    """Ridistribuisce i punti di un contorno chiuso a passo costante."""
    chiusa = np.vstack([poly, poly[:1]])
    d = np.linalg.norm(np.diff(chiusa, axis=0), axis=1)
    s = np.concatenate([[0.0], np.cumsum(d)])
    if s[-1] <= 1e-12:
        return poly
    t = np.linspace(0.0, s[-1], k, endpoint=False)
    return np.column_stack([np.interp(t, s, chiusa[:, 0]),
                            np.interp(t, s, chiusa[:, 1])])


def _contorno_semplice(P2, lati=128, giri=8, dilata=0.0):
    """Contorno LISCIO attorno a una macchia, guardata da dritto.

    E' la differenza fra il nostro taglio e quello del coniglio di Bing: li'
    la tasca ha un contorno semplice, da noi seguiva il bordo grezzo della
    selezione, che cammina sugli spigoli dei triangoli. Su un modello da
    395.000 triangoli quel bordo e' una sega con centinaia di denti, e sono i
    denti a far sembrare storto un pezzo che ha il fondo perfettamente piano.

    Si prende l'inviluppo convesso della macchia schiacciata sul piano di
    taglio, lo si ricampiona a passo costante e lo si arrotonda; poi lo si
    riapre quel tanto che basta perche' contenga di nuovo tutta la macchia
    (arrotondare stringe, e un contorno che stringe taglierebbe via pezzi di
    quello che hai scelto).
    """
    H = _inviluppo_convesso(P2)
    if len(H) < 3:
        return None
    R = _ricampiona(H, max(lati, 16))
    S = R.copy()
    for _ in range(giri):
        S = 0.5 * S + 0.25 * np.roll(S, 1, axis=0) + 0.25 * np.roll(S, -1, axis=0)
    c = S.mean(axis=0)
    rs = np.linalg.norm(S - c, axis=1)
    rr = np.linalg.norm(R - c, axis=1)
    buoni = rs > 1e-9
    if buoni.any():
        k = float(np.max(rr[buoni] / rs[buoni]))
        S = c + (S - c) * max(1.0, k)
    if dilata:
        rs = np.linalg.norm(S - c, axis=1)
        rs[rs < 1e-9] = 1.0
        S = c + (S - c) * (1.0 + dilata / rs)[:, None]
    return S


def _area_poligono(P):
    """Area (col segno) di un poligono chiuso, formula del laccio di scarpa."""
    if P is None or len(P) < 3:
        return 0.0
    x, y = np.asarray(P)[:, 0], np.asarray(P)[:, 1]
    return 0.5 * float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))


def _poligono_semplice(P):
    """Il contorno si taglia da solo? Un poligono che si incrocia non puo'
    diventare una fustella: manifold3d lo rifiuta e si perde il taglio."""
    k = len(P)
    if k < 4:
        return True

    def _incrocia(a, b, c, d):
        def _o(p, q, r):
            w = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
            return 0 if abs(w) < 1e-12 else (1 if w > 0 else -1)
        return (_o(a, b, c) != _o(a, b, d)) and (_o(c, d, a) != _o(c, d, b))

    for i in range(k):
        a, b = P[i], P[(i + 1) % k]
        for j in range(i + 2, k):
            if i == 0 and j == k - 1:
                continue                    # lati adiacenti attorno alla chiusura
            if _incrocia(a, b, P[j], P[(j + 1) % k]):
                return False
    return True


def _chaikin(P, giri=3):
    """Smussa un poligono chiuso tagliandone gli angoli (Chaikin). A differenza
    della media mobile NON schiaccia le rientranze: serve per le selezioni a
    mezzaluna o a elle, dove l'inviluppo convesso prenderebbe troppo."""
    Q = np.asarray(P, dtype=np.float64)
    for _ in range(giri):
        A = Q
        B = np.roll(Q, -1, axis=0)
        Q = np.empty((2 * len(A), 2), dtype=np.float64)
        Q[0::2] = 0.75 * A + 0.25 * B
        Q[1::2] = 0.25 * A + 0.75 * B
        if len(Q) > 512:
            break
    return Q


def _contorno_morbido(P2, lati=128, dilata=0.0):
    """Contorno CONCAVO ammorbidito: parte dal bordo vero della selezione
    (gia' proiettato e messo in fila) e ne toglie i denti, senza chiudere le
    rientranze. Se il bordo proiettato si incrocia da solo — capita quando la
    selezione gira attorno al modello — restituisce None e si ripiega
    sull'inviluppo convesso."""
    if P2 is None or len(P2) < 8:
        return None
    R = _ricampiona(np.asarray(P2, dtype=np.float64), max(lati, 32))
    if not _poligono_semplice(R):
        return None
    S = _ricampiona(_chaikin(R, 3), max(lati, 32))
    if not _poligono_semplice(S):
        return None
    if dilata:
        c = S.mean(axis=0)
        rs = np.linalg.norm(S - c, axis=1)
        rs[rs < 1e-9] = 1.0
        S = c + (S - c) * (1.0 + dilata / rs)[:, None]
        if not _poligono_semplice(S):
            return None
    return S


def _prisma_da_contorno(S2, u, v, n, q_alto, q_basso):
    """Fustella dritta: il contorno 2D esteso fra due quote lungo n."""
    k = len(S2)
    if k < 3 or q_alto <= q_basso:
        return None
    # verso antiorario nel piano (u, v): serve perche' le facce guardino fuori
    area2 = float(np.sum(S2[:, 0] * np.roll(S2[:, 1], -1) - np.roll(S2[:, 0], -1) * S2[:, 1]))
    if area2 < 0:
        S2 = S2[::-1].copy()
    su = np.outer(S2[:, 0], u) + np.outer(S2[:, 1], v)
    sopra = su + n * q_alto
    sotto = su + n * q_basso
    c2 = S2.mean(axis=0)
    cs = c2[0] * u + c2[1] * v
    V = np.vstack([sopra, sotto, (cs + n * q_alto)[None, :], (cs + n * q_basso)[None, :]])
    ct, cb = 2 * k, 2 * k + 1
    Fc = []
    for i in range(k):
        j = (i + 1) % k
        Fc.append([ct, i, j])                       # tappo sopra
        Fc.append([cb, k + j, k + i])               # tappo sotto
        Fc.append([i, k + i, k + j])                # parete
        Fc.append([i, k + j, j])
    return V, np.asarray(Fc, dtype=np.int64)


def _semispazio(n, quota, taglia, centro=None):
    """Blocco enorme che tiene tutto quello che sta OLTRE il piano x·n = quota
    (cioe' dalla parte di n). Serve a segare il nocciolo con una faccia piana.

    `centro` e' un punto qualsiasi del modello, e non e' un dettaglio: senza,
    il blocco veniva costruito attorno all'ORIGINE degli assi. Su un modello
    salvato lontano dallo zero - il caso di una testa ritagliata da una scena
    piu' grande - il blocco non arrivava nemmeno a sfiorarlo, l'intersezione
    veniva vuota e il nocciolo falliva senza un motivo visibile. Misurato:
    modello fra -209 e -128 lungo n, piano a -160, e semispazio ^ modello = 0.
    """
    u, v, nn = _base_da_normale(n)
    w = 4.0 * taglia
    n = np.asarray(n, dtype=np.float64)
    # posizione LUNGO n data dalla quota; di traverso si sta dove sta il modello
    fianco = np.zeros(3, dtype=float)
    if centro is not None:
        c = np.asarray(centro, dtype=np.float64)
        fianco = c - float(c @ n) * n
    return _cubo([w, w, w], fianco + n * (quota + w * 0.5), u, v, nn)


def _solo_con_la_pelle(solido, punti, tol, quota_minima=0.10):
    """Fra i tocchi separati tiene SOLO quelli che poggiano sulla pelle scelta.

    Il prisma del nocciolo scende dritto dentro il modello e si porta via tutto
    quello che incontra nella sua colonna: sotto una macchia sulla coscia
    c'e' anche il bordo del pantalone, che finisce nel pezzo staccato come un
    lembo a parte. Non e' un errore della selezione — la selezione e' giusta —
    ed e' per questo che pulirla a mano non serviva a niente: quel lembo
    nasceva dopo, dalla booleana.

    Si tiene un tocco solo se una fetta consistente dei punti della pelle
    scelta ci poggia sopra: il blocco vero ce li ha quasi tutti, il lembo di
    pantalone nessuno.
    """
    try:
        pezzi = [p for p in solido.decompose() if p.status().name == "NoError"]
    except Exception:
        pezzi = []
    if len(pezzi) <= 1:
        return solido, len(pezzi) or 1
    P = np.asarray(punti, dtype=np.float64)
    if len(P) > 300:
        P = P[np.linspace(0, len(P) - 1, 300).astype(int)]
    if not len(P):
        return solido, len(pezzi)
    p2 = (P * P).sum(axis=1)
    tenuti = []
    for p in pezzi:
        try:
            Vc, Fc = _to_arrays(p)
        except Exception:
            continue
        if not len(Fc):
            continue
        vicino = np.full(len(P), np.inf)
        for i in range(0, len(Vc), 4000):
            B = Vc[i:i + 4000]
            d2 = p2[:, None] + (B * B).sum(axis=1)[None, :] - 2.0 * (P @ B.T)
            vicino = np.minimum(vicino, d2.min(axis=1))
        if float((vicino < tol * tol).mean()) >= quota_minima:
            tenuti.append(p)
    if not tenuti:
        return solido, len(pezzi)
    fuso = tenuti[0]
    for p in tenuti[1:]:
        fuso = fuso + p
    if fuso.status().name != "NoError":
        return solido, len(pezzi)
    return fuso, len(pezzi)


def _senza_briciole(solido, quota_minima=0.05):
    """Butta via i tocchi minuscoli di una booleana.

    Il prisma che scende dalla selezione sfiora la pelle di striscio lungo il
    contorno e produce decine di schegge da pochi millesimi di volume (su una
    coscia: 117 tocchi, di cui uno da 6,5 milioni e tutti gli altri sotto
    settecento). Sono loro le bavette e le punte che si vedevano sul pezzo.
    Si tengono solo i tocchi che valgono almeno una frazione del piu' grosso,
    cosi' una selezione fatta apposta in due parti resta in due parti.
    """
    try:
        pezzi = [p for p in solido.decompose() if p.status().name == "NoError"]
    except Exception:
        pezzi = []
    if len(pezzi) <= 1:
        return solido
    voli = [abs(float(p.volume())) for p in pezzi]
    massimo = max(voli) or 1.0
    tenuti = [p for p, v in zip(pezzi, voli) if v >= quota_minima * massimo]
    if not tenuti:
        return solido
    fuso = tenuti[0]
    for p in tenuti[1:]:
        fuso = fuso + p
    return fuso if fuso.status().name == "NoError" else solido


def _spessore_sotto(Vb, Fb, punti, n, eps, salto=0.0):
    """Quanto e' spesso il modello sotto la macchia: si sparano dei raggi
    dalla pelle verso l'interno e si guarda dove escono dall'altra parte.

    Serve perche' il prisma della selezione ATTRAVERSA tutto il personaggio:
    misurando l'ingombro del solido tagliato si ottiene la larghezza del
    bacino (288) invece dello spessore della coscia (~100), e la faccia
    piatta finiva a meta' del corpo.

    I raggi sono scritti QUI, a mano, e non chiesti a trimesh. Il suo motore
    di raggi si appoggia a `rtree`, che e' una libreria in piu' e sul PC di chi
    usa l'app non c'era: la misura falliva con "No module named 'rtree'", il
    nocciolo si arrendeva in silenzio e usciva il taglio normale col perno —
    per giorni, mentre qui i test passavano perche' rtree era installato.
    Una funzione che sta in venti righe non vale una dipendenza che puo'
    mancare.

    Si tira contro il SOLIDO GIA' RITAGLIATO sotto la macchia (poche migliaia
    di triangoli), non contro tutto il modello: cosi' anche a forza bruta
    e' questione di un attimo.
    """
    Vb = np.asarray(Vb, dtype=np.float64)
    Fb = np.asarray(Fb, dtype=np.int64)
    if not len(Fb) or not len(punti):
        return None
    d = -np.asarray(n, dtype=np.float64)
    v0 = Vb[Fb[:, 0]]
    e1 = Vb[Fb[:, 1]] - v0
    e2 = Vb[Fb[:, 2]] - v0
    # con una direzione sola questi non cambiano da raggio a raggio
    h = np.cross(np.broadcast_to(d, e2.shape), e2)
    a = np.einsum('ij,ij->i', e1, h)
    vale = np.abs(a) > 1e-12
    inv = np.zeros(len(Fb), dtype=np.float64)
    inv[vale] = 1.0 / a[vale]
    distanze = []
    for p in np.asarray(punti, dtype=np.float64):
        s = p - v0
        u = inv * np.einsum('ij,ij->i', s, h)
        q = np.cross(s, e1)
        v = inv * (q @ d)
        t = inv * np.einsum('ij,ij->i', e2, q)
        buoni = vale & (u >= -1e-9) & (v >= -1e-9) & (u + v <= 1.0 + 1e-9) & (t > eps)
        if not buoni.any():
            continue
        # NON ci si ferma alla prima uscita. Un sopracciglio, una ciglia, una
        # borchia sono spesso una scaglia a se' appoggiata sulla pelle e non
        # saldata: fermandosi li' si misurano i due millimetri della scaglia
        # invece della testa che ha sotto, e il "nocciolo" veniva fuori una
        # buccia da un millimetro. Se subito dopo l'uscita ricomincia altra
        # roba, e lo stacco e' solo un'unghia (`salto`), si tira dritto: e'
        # materiale su cui il blocchetto si deve appoggiare. Se invece il
        # vuoto e' largo, li' il modello finisce davvero e ci si ferma.
        ts = np.sort(t[buoni])
        fine = float(ts[0])
        if salto and salto > 0:
            for k in range(1, len(ts)):
                if float(ts[k]) - fine > salto:
                    break
                fine = float(ts[k])
        distanze.append(fine)
    if not distanze:
        return None
    return float(np.median(distanze))


def _strati_sotto(Vb, Fb, punti, n, eps):
    """Cosa incontra un raggio che entra dalla macchia: dove finisce il primo
    strato, dove ricomincia il secondo e dove finisce.

    Serve per i rilievi appoggiati (sopracciglia, ciglia, borchie). Li' fra la
    scaglia e il corpo c'e' ARIA, e sapere solo "quanto e' spesso" non basta:
    un piano a meta' di scaglia+aria taglia ancora dentro l'aria e restituisce
    la scaglia intera, cioe' la buccia. Bisogna sapere a che profondita'
    ricomincia la carne, per andarle dentro.
    """
    Vb = np.asarray(Vb, dtype=np.float64)
    Fb = np.asarray(Fb, dtype=np.int64)
    if not len(Fb) or not len(punti):
        return None
    d = -np.asarray(n, dtype=np.float64)
    v0 = Vb[Fb[:, 0]]
    e1 = Vb[Fb[:, 1]] - v0
    e2 = Vb[Fb[:, 2]] - v0
    h = np.cross(np.broadcast_to(d, e2.shape), e2)
    a = np.einsum('ij,ij->i', e1, h)
    vale = np.abs(a) > 1e-12
    inv = np.zeros(len(Fb), dtype=np.float64)
    inv[vale] = 1.0 / a[vale]
    fine1, inizio2, fine2 = [], [], []
    for p in np.asarray(punti, dtype=np.float64):
        s = p - v0
        u = inv * np.einsum('ij,ij->i', s, h)
        q = np.cross(s, e1)
        v = inv * (q @ d)
        t = inv * np.einsum('ij,ij->i', e2, q)
        buoni = vale & (u >= -1e-9) & (v >= -1e-9) & (u + v <= 1.0 + 1e-9) & (t > eps)
        if not buoni.any():
            continue
        ts = np.sort(t[buoni])
        # si accorpano le distanze quasi uguali (facce doppie, spigoli)
        gruppi = [float(ts[0])]
        for x in ts[1:]:
            if float(x) - gruppi[-1] > 10 * eps:
                gruppi.append(float(x))
        fine1.append(gruppi[0])
        if len(gruppi) >= 2:
            inizio2.append(gruppi[1])
        if len(gruppi) >= 3:
            fine2.append(gruppi[2])
    if not fine1:
        return None
    return {
        "fine1": float(np.median(fine1)),
        "inizio2": float(np.median(inizio2)) if inizio2 else None,
        "fine2": float(np.median(fine2)) if fine2 else None,
    }


def taglia_a_nocciolo_piatto(V, F, sel, anelli, log, gioco, frazione=0.5,
                             contorno="liscio"):
    """Nocciolo con la FACCIA DI TAGLIO PIANA.

    Il pezzo che si stacca e': la pelle originale davanti (intatta), una faccia
    piatta dietro, e le pareti che scendono dritte. In pratica si affetta la
    coscia: se la gamba li' e' spessa 4 cm, il pezzo viene spesso 2
    (`frazione`), togliendo materiale alla gamba. Nel resto del modello si
    scava la sede corrispondente, un filo piu' larga.

    contorno : "liscio" -> le pareti seguono un contorno semplice e arrotondato
                           (come la tasca del coniglio di Bing). Il pezzo prende
                           un filo di materiale in piu' di quello selezionato,
                           ma non ha piu' il bordo a merletto ne' le alette.
               "esatto" -> le pareti seguono il bordo della selezione, dente per
                           dente. Massima fedelta', peggior aspetto.
    """
    import trimesh
    T = V[F[sorted(sel)]]
    nf = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    n = _normalizza(nf.sum(axis=0))          # da che parte "guarda" la macchia
    diag = float(np.linalg.norm(V.max(axis=0) - V.min(axis=0))) or 1.0
    L = 3.0 * diag                            # abbastanza per uscire dall'altra parte

    Orig, _riparato = _manifold_solido(V, F, log)
    if _riparato and Orig is not None:
        log.append(f"Il modello non era lavorabile cosi' com'era: l'ho rimesso a posto "
                   f"({_riparato}) e il nocciolo si puo' fare lo stesso.")
    elif _riparato:
        log.append(f"Ho provato a rimettere a posto il modello ({_riparato}) ma non e' bastato.")

    # il contorno della macchia, guardata da dritto
    _pm = V[sorted({int(x) for f in F[sorted(sel)] for x in f})]
    u_, v_, _ = _base_da_normale(n)
    P2 = np.column_stack([_pm @ u_, _pm @ v_])
    q_alto = float((_pm @ n).max()) + 0.05 * diag
    q_basso = float((V @ n).min()) - 0.05 * diag

    # il bordo VERO della selezione, messo in fila e schiacciato sul piano:
    # serve sia al contorno morbido sia al confronto di area nel resoconto
    B2 = None
    if anelli:
        _giro = _ordina_anello(max(anelli, key=len))
        if _giro and len(_giro) >= 8:
            _bp = V[[int(x) for x in _giro]]
            B2 = np.column_stack([_bp @ u_, _bp @ v_])
    log.append(f"[diagnostica] macchia: {len(sel)} triangoli, {len(_pm)} vertici; "
               f"bordo proiettato: {0 if B2 is None else len(B2)} punti; "
               f"area del contorno grezzo {abs(_area_poligono(B2)):.0f}")

    def _profilo(dil):
        """Il contorno 2D da usare come sezione della fustella."""
        if contorno == "morbido":
            S = _contorno_morbido(B2, dilata=dil)
            if S is not None:
                return S, "morbido"
            log.append("[diagnostica] contorno morbido scartato (il bordo "
                       "proiettato si incrocia): passo all'inviluppo")
        if contorno in ("liscio", "morbido"):
            S = _contorno_semplice(P2, dilata=dil)
            if S is not None:
                return S, "liscio"
        return None, "esatto"

    def _fustella(dil):
        S, come = _profilo(dil)
        if S is not None:
            pf = _prisma_da_contorno(S, u_, v_, n, q_alto, q_basso)
            if pf is not None:
                m = _manifold(pf[0], pf[1])
                if m.status().name == "NoError" and abs(float(m.volume())) > 1e-9:
                    if dil == 0.0:
                        log.append(f"[diagnostica] contorno {come}: {len(S)} punti, "
                                   f"area {abs(_area_poligono(S)):.0f}")
                    return m
                log.append(f"[diagnostica] fustella {come} non valida "
                           f"({m.status().name}): ripiego sul contorno grezzo")
        Vx, Fx = _prisma_selezione(V, F, sel, anelli, n, L, dil)
        m = _manifold(Vx, Fx)
        return m if m.status().name == "NoError" else None

    Pr = _fustella(0.0)
    if Orig is None or Pr is None:
        log.append("(nocciolo piatto non utilizzabile: "
                   + ("non sono riuscito a rendere il modello lavorabile nemmeno "
                      "riparandolo" if Orig is None else "non riesco a ricavare il "
                      "contorno da questa selezione") + ")")
        return None

    Blocco = Pr ^ Orig                        # tutta la carne sotto la macchia
    if Blocco.status().name != "NoError":
        return None

    # QUANTO FONDO. Non si puo' misurare l'ingombro del blocco: il prisma esce
    # dall'altra parte del personaggio e quello che si misura e' la larghezza
    # del bacino, non lo spessore della coscia. Si spara una manciata di raggi
    # dalla macchia verso l'interno e si prende la prima uscita.
    # ...e i raggi si sparano SOLO dai triangoli che guardano dritti come la
    # macchia. Quelli sul fianco escono subito perche' rasentano la pelle, e
    # tirano giu' la misura: sulla coscia facevano venire il pezzo fondo 8
    # invece di una quarantina.
    _tf = V[F[sorted(sel)]]
    _nfv = np.cross(_tf[:, 1] - _tf[:, 0], _tf[:, 2] - _tf[:, 0])
    _ln = np.linalg.norm(_nfv, axis=1)
    _ln[_ln < 1e-12] = 1.0
    _dritti = np.where((_nfv / _ln[:, None]) @ n > 0.7)[0]
    if len(_dritti) < 8:
        _dritti = np.arange(len(_tf))
    campione = _tf[_dritti].mean(axis=1)
    if len(campione) > 200:
        campione = campione[np.linspace(0, len(campione) - 1, 200).astype(int)]
    # I raggi si tirano contro il BLOCCO gia' ritagliato sotto la macchia, non
    # contro tutto il modello: sono qualche migliaio di triangoli invece di
    # quattrocentomila, e la misura resta la stessa perche' il blocco e'
    # proprio la carne che si vuole misurare.
    _vb, _fb = _to_arrays(Blocco)
    _eps = 1e-4 * diag
    campione = campione - n * _eps      # stacca l'origine dalla pelle
    spess = _spessore_sotto(_vb, _fb, campione, n, _eps)
    if spess is None or spess <= 1e-6:
        log.append(f"(nocciolo piatto: non riesco a misurare quanto e' spesso il "
                   f"modello sotto la macchia: {len(campione)} raggi contro "
                   f"{len(_fb)} triangoli, nessuna uscita trovata)")
        return None
    # LA ZONA E' UNA SCAGLIA APPOGGIATA? Sopracciglia, ciglia, borchie, toppe:
    # nei modelli fatti dall'IA sono quasi sempre un corpo a se', spesso due
    # millimetri, posato sulla pelle e non saldato. Misurando fino alla prima
    # uscita si trovano quei due millimetri, se ne prende meta', e il
    # "blocchetto" viene fuori una buccia da un millimetro: e' esattamente il
    # caso segnalato, il nocciolo che riesce sugli occhi e fallisce sul
    # sopracciglio. Se lo spessore trovato e' ridicolo rispetto a quanto e'
    # larga la zona, si rimisura scavalcando il vuoto e appoggiandosi a quello
    # che c'e' sotto - la fronte - che e' dove il blocchetto deve affondare.
    _lu0 = float(P2[:, 0].max() - P2[:, 0].min())
    _lv0 = float(P2[:, 1].max() - P2[:, 1].min())
    _stretta = max(min(_lu0, _lv0), 1e-9)
    _fondo_forzato = None
    if frazione * spess < 0.25 * _stretta:
        _st = _strati_sotto(_vb, _fb, campione, n, _eps)
        if _st and _st["inizio2"] is not None and _st["inizio2"] > spess * 1.02:
            _sotto = ((_st["fine2"] - _st["inizio2"]) if _st["fine2"] is not None
                      else _stretta)
            # si entra nella carne sotto quel tanto che basta a fare un incastro:
            # una frazione della larghezza della zona, non meta' della testa
            _morso = min(frazione * _sotto, 0.5 * _stretta)
            _fondo_forzato = _st["inizio2"] + max(_morso, 0.15 * _stretta)
            log.append(f"La zona scelta e' un rilievo APPOGGIATO, spesso appena "
                       f"{spess:.1f} mm, e sotto ha {_st['inizio2'] - spess:.1f} mm di "
                       f"vuoto: da solo darebbe una buccia. Il blocchetto affonda "
                       f"{_fondo_forzato - _st['inizio2']:.1f} mm dentro quello che c'e' "
                       f"sotto, cosi' ha una sede in cui infilarsi.")

    # TETTO alla profondita'. Scavalcando gli stacchi, sotto una scaglia da due
    # millimetri si trova tutta la testa: meta' di quella farebbe un chiodo da
    # cinque centimetri sotto un sopracciglio lungo diciotto millimetri. Un
    # blocchetto piu' profondo che largo, oltre a essere assurdo da guardare,
    # non si stampa e non si infila. Quindi non va mai oltre la propria
    # larghezza (la misura piu' stretta della macchia, guardata da dritto).
    _tetto = 1.2 * _stretta
    _voluta = frazione * spess
    profonda = min(_voluta, _tetto)
    if _fondo_forzato is not None:
        # sul rilievo appoggiato comanda il fondo trovato sotto il vuoto: il
        # tetto della larghezza qui non si applica, se no il piano resterebbe
        # in mezzo all'aria e tornerebbe fuori la buccia
        profonda = _fondo_forzato
    if profonda < _voluta * 0.999:
        log.append(f"Profondita' tenuta a {profonda:.1f} mm invece di {_voluta:.1f}: "
                   f"la zona scelta e' larga {_stretta:.1f} mm, e un blocchetto "
                   f"piu' profondo che largo non si stampa e non si infila.")
    alto = float((V[sorted({int(x) for f in F[sorted(sel)] for x in f})] @ n).max())
    quota = alto - profonda                   # dove passa la faccia piatta

    # I punti della PELLE SCELTA: servono a riconoscere, fra i tocchi che la
    # booleana tira fuori, quali sono davvero il pezzo che hai selezionato e
    # quali invece sono roba finita per caso nella colonna del prisma (sotto
    # una macchia sulla coscia ci passa anche il bordo del pantalone).
    _pelle = _tf.mean(axis=1)
    if len(_pelle) > 300:
        _pelle = _pelle[np.linspace(0, len(_pelle) - 1, 300).astype(int)]
    _tol = 0.01 * diag

    _tagliato = Blocco ^ _semispazio(n, quota, diag, centro=V.mean(axis=0))
    if _fondo_forzato is not None:
        # Rilievo appoggiato: il secondo corpo NON poggia sulla pelle scelta -
        # c'e' il vuoto in mezzo - ma e' proprio la carne in cui il blocchetto
        # deve affondare. Scartandolo si tornava alla buccia. Il prisma e' gia'
        # stretto sul contorno della zona, quindi qui non entra roba di passaggio.
        A, _corpi = _tagliato, 1
    else:
        A, _corpi = _solo_con_la_pelle(_tagliato, _pelle, _tol)
    A = _senza_briciole(A)
    _corpi_dopo = 1
    try:
        _corpi_dopo = len(list(A.decompose()))
    except Exception:
        pass
    log.append(f"[diagnostica] spessore stimato {spess:.1f}, piano a quota "
               f"{quota:.1f} (cioe' {frazione * spess:.1f} sotto la pelle); "
               f"corpi dopo la booleana {_corpi}, tenuti quelli che poggiano "
               f"sulla pelle scelta: {_corpi_dopo}")

    # LA SEDE SI RICAVA DAL PEZZO, non da una seconda booleana per conto suo.
    # Calcolandole separate le due potevano non combaciare: la sede prendeva un
    # tocco (il bordo del pantalone sotto la coscia) che il pezzo non aveva, e
    # quel materiale spariva — un buco nel modello che nessuno aveva chiesto.
    # Cosi' invece la sede e' il pezzo stesso strisciato all'indietro di un
    # gioco: e' garantito che contenga il pezzo e niente di piu', quindi
    # l'unico materiale che si perde e' la fettina di gioco in fondo alla
    # tasca, che e' esattamente quella che serve perche' il pezzo ci entri.
    try:
        Sede = A + A.translate(list(-np.asarray(n, dtype=float) * gioco))
    except Exception as _e:
        log.append(f"(sede non ricavabile dal pezzo: {_e}; uso il pezzo com'e')")
        Sede = A
    if Sede.status().name != "NoError":
        Sede = A
    B = Orig - Sede
    if A.status().name != "NoError" or B.status().name != "NoError":
        return None
    va, fa = _to_arrays(A)
    vb, fb = _to_arrays(B)
    if not len(fa) or not len(fb):
        return None
    ma = trimesh.Trimesh(vertices=va, faces=fa, process=False)
    mb = trimesh.Trimesh(vertices=vb, faces=fb, process=False)
    return ma, mb


def taglia_a_nocciolo(V, F, sel, anelli, log, profondita, gioco, normali_v):
    """Stacca la zona selezionata come nocciolo e ne scava la sede nel resto."""
    import trimesh
    Vp, Fp = _nocciolo(V, F, sel, anelli, profondita, gioco, normali_v)
    Vs, Fs = _nocciolo(V, F, sel, anelli, profondita, 0.0, normali_v)
    Orig, _riparato = _manifold_solido(V, F, log)
    if _riparato:
        log.append(f"Il modello non era lavorabile cosi' com'era: l'ho rimesso "
                   f"a posto ({_riparato})." if Orig is not None else
                   f"Ho provato a rimettere a posto il modello ({_riparato}) ma non e' bastato.")
    Pezzo = _manifold(Vp, Fp)
    Sede = _manifold(Vs, Fs)
    if Orig is None or any(x.status().name != "NoError" for x in (Pezzo, Sede)):
        log.append(f"(nocciolo non utilizzabile: modello "
                   f"{'irrecuperabile' if Orig is None else Orig.status().name}, "
                   f"pezzo {Pezzo.status().name}, sede {Sede.status().name})")
        return None
    A = Pezzo ^ Orig                 # il nocciolo non puo' uscire dal modello
    B = Orig - Sede
    if A.status().name != "NoError" or B.status().name != "NoError":
        return None
    va, fa = _to_arrays(A)
    vb, fb = _to_arrays(B)
    if not len(fa) or not len(fb):
        return None
    ma = trimesh.Trimesh(vertices=va, faces=fa, process=False)
    mb = trimesh.Trimesh(vertices=vb, faces=fb, process=False)
    # Il resoconto lo scrive chi chiama: qui si prova piu' di una profondita' e
    # una riga per tentativo sarebbe solo confusione.
    return ma, mb


def taglia_sulla_selezione(vertices, faces, selezione, connettore=True, gioco=0.20,
                           lato=None, profondita=None, scala_connettore=1.0,
                           appiattisci=True, incastro_modo="auto",
                           profondita_nocciolo=0.5):
    """Stacca ESATTAMENTE i triangoli selezionati, chiudendo entrambi i pezzi
    con un tappo sull'anello di bordo.

    selezione   : indici dei triangoli scelti dall'utente
    appiattisci : porta i vertici dell'anello sul loro piano medio, cosi' la
                  faccia di taglio esce piatta (comoda da stampare). Lo
                  spostamento e' identico sui due pezzi, quindi combaciano
                  comunque. Se l'anello e' molto storto si rinuncia, per non
                  deformare il modello.
    incastro_modo : come si uniscono i due pezzi.
                  "auto"     decide l'app (nocciolo dove il pezzo verrebbe una
                             buccia, perno altrove);
                  "nocciolo" lo chiedi tu: la zona scelta diventa un blocchetto
                             e nell'altro pezzo se ne scava la sede;
                  "perno"    mai nocciolo, sempre e solo il perno quadro;
                  "niente"   nessun aggancio, i pezzi si incollano.
    profondita_nocciolo : quanto affonda il nocciolo, come frazione dello
                  spessore del modello sotto la macchia. 0,5 = meta' (il
                  predefinito: gamba spessa 4 cm, pezzo spesso 2). Piu' basso
                  = pezzo piu' sottile e sede meno profonda.
    """
    log = [f"[{VERSIONE}] taglio esattamente sulla selezione"]
    import trimesh
    V = np.asarray(vertices, dtype=np.float64).copy()
    F = np.asarray(faces, dtype=np.int64)
    # copia intatta del modello di partenza: serve per controllare che il tappo
    # del taglio non vada a bucare la pelle (vedi _controllore_pelle)
    V_orig = np.asarray(vertices, dtype=np.float64).copy()
    F_orig = np.asarray(faces, dtype=np.int64).copy()
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

    def _leviga_anello(anello, giri=24, lam=0.42, tetto_assoluto=None):
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
            # schegge. Il limite e' UNA volta quella distanza, non meta':
            # misurato, stringerlo a meta' non migliorava la chiusura dei pezzi
            # e lasciava il contorno piu' seghettato (0,16 invece di 0,09).
            if v in _dmin:
                t = min(t, 1.0 * _dmin[v])
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

    # costruito al primo bisogno: dice se un punto sta fuori dalla pelle
    quanto_fuori = None
    niente_perno = False   # col nocciolo l'incastro c'e' gia'
    tappo_a = []          # facce aggiunte come tappo (per il controllo sporgenze)
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
        # ...ma la faccia piatta SI PAGA IN MATERIALE. La gonnella riempie tutto
        # lo spazio fra il contorno vero e il piano: se il contorno e' ondulato
        # (una macchia su una coscia tonda: 14% di scostamento) quel riempimento
        # e' un blocco che si vede e snatura il pezzo. Quindi la faccia piatta
        # si fa solo quando costa poco, cioe' quando il contorno e' gia' quasi
        # piano; altrimenti si resta FEDELI al modello e si chiude il contorno
        # com'e'. Misurato sul modello vero: capelli e cintura stanno sotto
        # l'1%, la macchia sulla coscia al 14%.
        storto = scarto / larghezza
        # appiattisci: "mai" | "auto" (solo dove costa poco) | "sempre"
        modo = appiattisci
        if modo is True:
            modo = 'auto'
        elif modo is False:
            modo = 'mai'
        vuole_piatta = (modo == 'sempre') or (modo == 'auto' and storto < 0.02)
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
        if giro and not vuole_piatta:
            log.append(
                f"Contorno ondulato ({100 * storto:.1f}%): taglio FEDELE al modello. Una faccia "
                "piatta qui vorrebbe dire riempire di materiale fino al piano; se la preferisci "
                "lo stesso, metti \"Faccia di taglio piatta\" su SEMPRE."
                if modo == 'auto' else
                "Faccia piatta non richiesta: il taglio segue il contorno com'e'")
        if giro and vuole_piatta:
            # DOVE METTERE IL PIANO. Il disco piatto e la gonnella non devono
            # bucare la pelle del modello. Col piano alla quota MEDIA dell'anello
            # meta' della gonnella sale verso l'esterno e sbuca fuori: misurato
            # sul modello vero, 993 punti su 3000 fuori dal solido, fino a 5,2 mm
            # in stampa. Si parte quindi dalla quota piu' INTERNA dell'anello
            # (cosi' ogni tratto di gonnella scende dentro al pezzo) e, se il
            # controllo trova ancora una compenetrazione, si scende ancora,
            # fino a un massimo di 10 tentativi.
            vs_giro = [k for c in giro for k in c]
            # verso l'esterno del pezzo, letto dalle normali dei vertici di bordo
            n_est = normali_v[vs_giro].sum(axis=0)
            segno = 1.0 if float(n_est @ n_an) >= 0 else -1.0
            n_dir = segno * n_an          # +n_dir = fuori dal pezzo
            qs = (V[vs_giro] - centro) @ n_dir
            spessore_anello = float(qs.max() - qs.min()) or 1.0
            passo = 0.35 * spessore_anello
            if quanto_fuori is None:
                scatola = (V[vs_giro].min(axis=0), V[vs_giro].max(axis=0))
                quanto_fuori = _controllore_pelle(V_orig, F_orig, scatola,
                                                  margine=0.5 * spessore_anello + 0.02 * diag)

            def costruisci(q_dir):
                """Prova a costruire il tappo col piano a quota q_dir (misurata
                lungo n_dir). Torna None se il contorno non si richiude."""
                tri_a, tri_b, extra, aree = [], [], [], []
                base_l = len(V)
                for ciclo in giro:
                    if len(ciclo) < 3:
                        return None
                    Pg = V[ciclo]
                    proj = Pg - np.outer((Pg - centro) @ n_dir - q_dir, n_dir)
                    P2 = np.column_stack([(proj - centro) @ u_an, (proj - centro) @ v_an])
                    t2 = _ritaglia_orecchie(P2)
                    if t2 is None:
                        return None
                    idx_p = [base_l + len(extra) + i for i in range(len(ciclo))]
                    extra.extend(list(proj))
                    n_c = len(ciclo)
                    for i in range(n_c):
                        a, b = ciclo[i], ciclo[(i + 1) % n_c]
                        a2, b2 = idx_p[i], idx_p[(i + 1) % n_c]
                        tri_b.append([a, b, b2]); tri_a.append([b2, b, a])
                        tri_b.append([a, b2, a2]); tri_a.append([a2, b2, a])
                    for i0, i1, i2 in t2:
                        A, B, C = idx_p[i0], idx_p[i1], idx_p[i2]
                        tri_b.append([A, B, C]); tri_a.append([C, B, A])
                    aree.append((sum(0.5 * abs(_area2(P2[a], P2[b], P2[c])) for a, b, c in t2),
                                 P2, t2, idx_p))
                return tri_a, tri_b, extra, aree

            # Candidati: si parte dalla quota piu' INTERNA dell'anello e si
            # scende a piccoli passi; come ultima carta si prova anche la quota
            # media, che a volte e' l'unica dove il contorno schiacciato non si
            # accavalla. Tanto quello che dovesse sporgere lo toglie poi il
            # ritaglio booleano dentro al modello.
            candidati = [float(qs.min()) - k * passo for k in range(9)]
            candidati.append(float(np.median(qs)))
            migliore = None
            tentativi = 0
            for k, q_try in enumerate(candidati):   # fail-safe: max 10 tentativi
                fatto_k = costruisci(q_try)
                if fatto_k is None:
                    continue
                tentativi = k + 1
                tri_a, tri_b, extra, aree = fatto_k
                if quanto_fuori is None:
                    migliore = (0, 0.0, q_try, fatto_k)
                    break
                Vp = np.vstack([V, np.asarray(extra, dtype=np.float64)]) if extra else V
                _misura = quanto_fuori(_campiona_facce(Vp, tri_b))
                if _misura is None:
                    # niente rtree sul PC: si rinuncia a scegliere il piano
                    # sulla sporgenza e si tiene il primo, tanto le sporgenze le
                    # toglie comunque la booleana di ritaglio piu' sotto
                    quanto_fuori = None
                    migliore = (0, 0.0, q_try, fatto_k)
                    break
                n_fuori, sporgenza = _misura
                if migliore is None or n_fuori < migliore[0]:
                    migliore = (n_fuori, sporgenza, q_try, fatto_k)
                if n_fuori == 0:
                    break

            if migliore is not None:
                n_fuori, sporgenza, q_scelto, (tri_a, tri_b, extra, aree) = migliore
                if extra:
                    V = np.vstack([V, np.asarray(extra, dtype=np.float64)])
                facce_a.extend(tri_a); tappo_a.extend(tri_a)
                facce_b.extend(tri_b)
                salita = float(np.max(np.abs(qs - q_scelto)))
                affondo = float(qs.min() - q_scelto)
                if n_fuori == 0:
                    log.append(f"Faccia di taglio PIATTA: {len(giro)} contorno/i, verificata "
                               f"dentro la pelle del modello (dislivello colmato {salita:.1f} mm"
                               + (f", piano abbassato di {affondo:.1f} mm in {tentativi} tentativi"
                                  if affondo > 1e-9 else "") + ")")
                else:
                    log.append(f"Faccia di taglio PIATTA: {len(giro)} contorno/i. Dopo {tentativi} "
                               f"tentativi il piano migliore sporge ancora di {sporgenza:.1f} mm in "
                               f"{n_fuori} punti: quel poco viene tolto dal ritaglio dentro al "
                               "modello, qui sotto.")
                _, P2m, tri2m, idxm = max(aree, key=lambda t: t[0])
                ar = [0.5 * abs(_area2(P2m[a], P2m[b], P2m[c])) for a, b, c in tri2m]
                centri_tappo.append(np.mean(V[[idxm[k] for k in tri2m[int(np.argmax(ar))]]], axis=0))
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
                    facce_a.append([c, b, a]); tappo_a.append([c, b, a])
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
                facce_a.append([b, a, ic]); tappo_a.append([b, a, ic])
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

    # IL PEZZO NON PUO' USCIRE DAL MODELLO.
    # Il tappo e' una superficie tesa sul contorno del taglio: se il contorno e'
    # ondulato, in mezzo si gonfia e BUCA la pelle. Misurato sul modello vero:
    # fino a 3,6 mm fuori dal solido, ben visibile sul pezzo. Spostare il piano
    # a tentativi non basta (scendendo troppo si esce dall'altra parte).
    # Qui invece la garanzia e' esatta: si intersecano i pezzi col modello di
    # partenza. Quello che sporgeva viene tagliato via dalla pelle stessa, e il
    # resto e' esattamente il complemento, quindi i due pezzi continuano a
    # combaciare e la loro somma resta il modello.
    serve_ritaglio = True
    try:
        if tappo_a:
            # su un tappo da decine di migliaia di triangoli il controllo
            # costerebbe piu' del taglio: ne basta un campione sparso
            Ta = np.asarray(tappo_a, dtype=np.int64)
            if len(Ta) > 400:
                passo_c = max(1, len(Ta) // 400)
                Ta = Ta[::passo_c]
            scat = (V[Ta.ravel()].min(axis=0), V[Ta.ravel()].max(axis=0))
            controllo = _controllore_pelle(V_orig, F_orig, scat, margine=0.02 * diag)
            # `controllo` restituisce None quando manca rtree sul PC: e' una
            # misura in piu', non una garanzia, e va saltata senza far saltare
            # il resto (prima si provava a spacchettare None e il resoconto
            # finiva con "cannot unpack non-iterable NoneType object").
            _mis = controllo(_campiona_facce(V, Ta.tolist())) if controllo is not None else None
            if _mis is not None:
                n_f, sp = _mis
                # tolleranza: sotto un millesimo della diagonale e' rumore numerico
                serve_ritaglio = n_f > 0 and sp > 0.001 * diag
                log.append(f"Controllo sporgenze del tappo: {n_f} punti oltre la pelle"
                           + (f", fino a {sp:.2f} mm" if n_f else "")
                           + ("" if serve_ritaglio else " (entro tolleranza, niente da ritagliare)"))
    except Exception as e:
        log.append(f"(controllo sporgenze non eseguito: {e})")
    try:
        if not serve_ritaglio:
            raise StopIteration
        # il modello di partenza va passato SALDATO: negli STL ogni triangolo ha
        # i suoi vertici per conto proprio e manifold3d rifiuta una mesh che
        # topologicamente e' fatta di 400.000 pezzi staccati
        Orig, _rip = _manifold_solido(V_orig, F_orig, log, "modello")
        Am = _manifold(np.asarray(ma.vertices), np.asarray(ma.faces))
        if Orig is None or Am.status().name != "NoError":
            log.append(f"(controllo delle sporgenze saltato: modello "
                       f"{'irrecuperabile' if Orig is None else 'ok'}, "
                       f"pezzo {Am.status().name})")
        if Orig is not None and Am.status().name == "NoError":
            Ac = Am ^ Orig                    # solo la parte dentro al modello
            Bc = Orig - Ac                    # il complemento esatto
            if Ac.status().name == "NoError" and Bc.status().name == "NoError":
                va, fa_ = _to_arrays(Ac)
                vb, fb_ = _to_arrays(Bc)
                if len(fa_) and len(fb_):
                    ma = trimesh.Trimesh(vertices=va, faces=fa_, process=False)
                    mb = trimesh.Trimesh(vertices=vb, faces=fb_, process=False)
                    log.append("Pezzi ritagliati dentro il modello di partenza: "
                               "niente sporgenze fuori dalla pelle")
    except StopIteration:
        pass
    except Exception as e:
        log.append(f"(controllo delle sporgenze non riuscito: {e}; pezzi consegnati come sono)")
    # BUCCIA? Se il pezzo staccato e' un foglio (spessore vero minuscolo rispetto
    # alla sua estensione) vuol dire che la selezione era una macchia su un lato
    # e non un anello attorno a qualcosa: chiuderla col tappo produce una buccia,
    # inutile da stampare e troppo sottile per il perno. In quel caso si rifa'
    # il taglio con la FUSTELLA, che porta via il volume sotto la selezione.
    try:
        _sp = 4.0 * abs(float(ma.volume)) / (float(ma.area) or 1.0)
        _gr = float(np.sort(np.asarray(ma.extents))[1])       # seconda dimensione
        # quanto la selezione "guarda tutta da una parte": 1 = macchia piatta su
        # un fianco, 0 = avvolge il pezzo. Misurato: macchia sulla coscia 0,41;
        # capelli 0,28; cintura 0,08. Da sola non basta, ma insieme allo
        # spessore separa nettamente la buccia dal blocco vero.
        _T = V[F[sorted(sel)]]
        _nf = np.cross(_T[:, 1] - _T[:, 0], _T[:, 2] - _T[:, 0])
        _dir = float(np.linalg.norm(_nf.sum(axis=0)) / (np.linalg.norm(_nf, axis=1).sum() or 1.0))
        # Il nocciolo puo' essere CHIESTO ("nocciolo") o VIETATO ("perno",
        # "niente"). In automatico parte solo dove il pezzo verrebbe una buccia.
        # Prima esisteva solo l'automatico e non c'era modo di chiederlo: chi
        # voleva l'incastro a sede su una zona un po' piu' spessa non aveva
        # nessun bottone da premere.
        _chiesto = incastro_modo in ("nocciolo", "nocciolo_esatto", "nocciolo_ovale")
        # "liscio" = contorno semplice e arrotondato, come la tasca del coniglio
        # di Bing; "esatto" = dente per dente come l'hai disegnato.
        # Il predefinito e' il contorno SMUSSATO, non l'inviluppo convesso.
        # Misurato sulla macchia della coscia: il contorno vero copre un'area di
        # 18.780, quello smussato 18.728 (praticamente identico, ma senza i
        # denti), l'inviluppo convesso 48.842 — quasi il triplo di materiale
        # portato via al modello. L'inviluppo resta come scelta esplicita, per
        # chi vuole una tasca semplicissima, e come ripiego automatico quando il
        # contorno vero non si puo' usare.
        _cont = {"nocciolo_esatto": "esatto",
                 "nocciolo_ovale": "liscio"}.get(incastro_modo, "morbido")
        _vietato = incastro_modo in ("perno", "niente")
        _buccia = (_gr > 0 and _sp < 0.12 * _gr and _dir > 0.35)
        if not _vietato and (_chiesto or _buccia):
            if _chiesto:
                log.append("Incastro A NOCCIOLO richiesto da te: la zona scelta "
                           "diventa un blocchetto e nell'altro pezzo se ne scava "
                           "la sede.")
            else:
                log.append(f"Il pezzo verrebbe una buccia (spessa {_sp:.1f} mm su "
                           f"{_gr:.0f} mm di larghezza, selezione tutta da un lato "
                           f"{_dir:.2f}): rifaccio il taglio a nocciolo")
            # PROFONDITA' DEL NOCCIOLO: non si indovina, si prova.
            # Prima era un numero solo (0,22 volte la larghezza della macchia) e
            # su una macchia larga sbagliava di brutto: spingendo la pelle verso
            # l'interno di mezza larghezza, su una superficie curva la pelle
            # spostata si incrocia con se' stessa e quel che resta dopo il
            # ritaglio dentro al modello e' piu' SOTTILE del taglio normale
            # (misurato sulla coscia: 10,6 mm invece di 17,0, cioe' il nocciolo
            # veniva scartato proprio dove serviva).
            # Anche in millimetri fissi sarebbe sbagliato: le unita' del modello
            # non sono millimetri di stampa (su questo Goku ce ne vogliono quasi
            # dieci per un millimetro stampato).
            # Quindi se ne provano poche, ben distanziate, e si tiene quella che
            # da' il blocchetto piu' spesso. Costa qualche secondo in piu' e
            # toglie di mezzo una costante da tarare a mano.
            _fu, _sp2, _pv, _piatto = None, -1.0, 0.0, False
            _muto = []          # i tentativi non devono riempire il resoconto
            # PRIMA il nocciolo a FONDO PIATTO: la pelle davanti resta quella
            # del modello, dietro c'e' un piano, le pareti scendono dritte.
            # E' quello giusto da stampare, e non ha le punte che faceva il
            # vecchio (che copiava la pelle curva e incrociava le normali).
            # La diagnostica del fondo piatto va tenuta da parte: se il nocciolo
            # viene accettato la si rimette nel resoconto (serve a capire cosa
            # ha deciso il motore senza dover leggere il codice), se viene
            # scartato non deve sporcare la relazione di un taglio normale.
            _diag = []
            _pi = taglia_a_nocciolo_piatto(V, F, sel, anelli, _diag, gioco,
                                           frazione=float(profondita_nocciolo),
                                           contorno=_cont)
            _muto.extend(l for l in _diag if not l.startswith("[diagnostica]"))
            # Se il nocciolo l'hai chiesto TU, la diagnostica va nel resoconto
            # comunque, riuscito o no: e' l'unico modo per capire da lontano
            # perche' e' venuto quello che e' venuto.
            if _chiesto:
                log.extend(_diag)
            if _pi is not None:
                _fu = _pi
                _sp2 = 4.0 * abs(float(_pi[0].volume)) / (float(_pi[0].area) or 1.0)
                _piatto = True
            # QUANDO LO CHIEDI TU, NIENTE RIPIEGHI DI NASCOSTO.
            # Il vecchio nocciolo a guscio (pelle copiata e spinta in dentro
            # lungo le normali) e' proprio quello che faceva le costine radiali
            # sul bordo e il fondo ondulato. Prima veniva ripescato ogni volta
            # che il fondo piatto usciva piu' sottile del taglio normale: chi
            # sceglieva "a NOCCIOLO" nel menu si ritrovava in mano il pezzo
            # vecchio senza che niente glielo dicesse, e sembrava che la
            # correzione non fosse mai stata fatta.
            # Adesso il guscio resta solo per la scelta AUTOMATICA. Se lo hai
            # chiesto tu: o esce il fondo piatto, o te lo dico e si fa il taglio
            # normale col perno.
            if _fu is None and _chiesto:
                log.append("Il nocciolo a faccia piatta non e' riuscito su questa "
                           "selezione (vedi le righe di diagnostica qui sopra). "
                           "NON ripiego sul vecchio nocciolo a guscio, che darebbe "
                           "il bordo a costine: faccio il taglio normale col perno.")
            elif not _chiesto and (_fu is None or _sp2 <= _sp):
                for _k in (0.05, 0.10, 0.18, 0.30):
                    _p = _k * _gr
                    _try = taglia_a_nocciolo(V, F, sel, anelli, _muto, _p, gioco, normali_v)
                    if _try is None:
                        continue
                    _s = 4.0 * abs(float(_try[0].volume)) / (float(_try[0].area) or 1.0)
                    if _s > _sp2:
                        _fu, _sp2, _pv, _piatto = _try, _s, _p, False
            if _fu is not None:
                # Se l'hai chiesto tu si tiene comunque, purche' i due pezzi
                # siano chiusi: sei tu a sapere come lo vuoi stampare. In
                # automatico invece si tiene solo se migliora DAVVERO (non per
                # un pelo: rifare il taglio in un altro modo per guadagnare
                # mezzo millimetro non vale il rischio).
                _sano = bool(_fu[0].is_watertight and _fu[1].is_watertight)
                _ok = (_sp2 > 1.05 * _sp) if not _chiesto else _sano
                if _ok:
                    ma, mb = _fu
                    niente_perno = True
                    if _piatto:
                        _tit = {
                            "liscio": "Taglio A NOCCIOLO con la FACCIA PIATTA e CONTORNO OVALE",
                            "morbido": "Taglio A NOCCIOLO con la FACCIA PIATTA e CONTORNO LISCIO",
                        }.get(_cont, "Taglio A NOCCIOLO con la FACCIA PIATTA e CONTORNO ESATTO")
                        _dic = {
                            "liscio": "un ovale che racchiude tutta la zona scelta "
                                      "(tasca semplicissima, ma porta via piu' materiale)",
                            "morbido": "il tuo contorno smussato: stessa forma e "
                                       "stessa area di quello che hai scelto, "
                                       "senza i denti dei triangoli",
                        }.get(_cont, "il contorno che hai scelto, dente per dente")
                        if not _chiesto:
                            log.extend(_diag)     # se l'hai chiesto tu e' gia' scritta sopra
                        log.append(
                            f"{_tit}: davanti resta "
                            f"la pelle del modello, dietro c'e' un piano e le pareti "
                            f"scendono dritte seguendo {_dic}. Il "
                            f"blocchetto viene spesso {_sp2:.1f} invece di {_sp:.1f} "
                            f"(meta' dello spessore del modello li' sotto) e "
                            f"nell'altro pezzo si scava la sua sede, con {gioco:.2f} "
                            f"di gioco. Si incastra da solo: niente perno. "
                            f"Stampa il pezzo con la faccia piatta appoggiata al piatto.")
                    else:
                        log.append(
                            f"Taglio A NOCCIOLO: la zona scelta diventa un blocchetto "
                            f"spesso {_sp2:.1f} mm invece di {_sp:.1f} (affondato "
                            f"{_pv:.1f} mm, profondita' scelta provandone quattro) e "
                            f"nell'altro pezzo si scava la sua sede, con {gioco:.2f} mm "
                            f"di gioco. Si incastra da solo: niente perno.")
                    if _sp2 < _sp:
                        # Succede quando la selezione AVVOLGE il pezzo invece di
                        # essere una macchia su un lato: il nocciolo e' un guscio
                        # spinto in dentro, e su un anello diventa un manicotto
                        # vuoto. Misurato sulla coscia: 32 mm invece di 106.
                        log.append(
                            "ATTENZIONE: qui il nocciolo SVUOTA il pezzo, non lo "
                            "ingrossa. La zona che hai scelto gira attorno al "
                            "modello, e per una zona cosi' va meglio il perno: "
                            "rimetti \"decidi tu\" e rifai il taglio.")
                elif _chiesto:
                    log.append(f"Nocciolo scartato: i due pezzi non venivano chiusi "
                               f"({_fu[0].is_watertight}/{_fu[1].is_watertight}). "
                               f"Taglio normale col perno.")
                else:
                    log.append(f"Nocciolo scartato: non migliora ({_sp2:.1f} mm "
                               f"invece di {_sp:.1f}). Taglio normale col perno.")
            elif _chiesto:
                if _muto:
                    log.append(_muto[0])
                log.append("Nocciolo non riuscito su questa selezione: taglio "
                           "normale col perno. Se la zona scelta e' un anello "
                           "attorno a un arto il nocciolo non serve, serve il perno.")
            else:
                # ripiego: la vecchia fustella
                _fu2 = taglia_a_fustella(V, F, sel, anelli, log)
                if _fu2 is not None:
                    _sp3 = 4.0 * abs(float(_fu2[0].volume)) / (float(_fu2[0].area) or 1.0)
                    if _sp3 > _sp:
                        ma, mb = _fu2
                        log.append(f"Fustella accettata: spessore da {_sp:.1f} a {_sp3:.1f} mm")
                    else:
                        log.append("Il contorno che hai disegnato serpeggia troppo per essere "
                                   "estruso: per dividere un arto conviene il taglio col PIANO.")
    except Exception as _e:
        log.append(f"(controllo buccia non eseguito: {_e})")

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
            FF = np.asarray(FF, dtype=np.int64)
            if not len(FF):
                return 0, 0
            _l, _h, _f, _v, _i, qu = _gruppi_spigoli(FF)
            return int((qu != 2).sum()), int(len(qu))
        ba, ta = _malformati(facce_a)
        bb, tb = _malformati(facce_b)
        # Il metro di giudizio e' il pezzo DI PARTENZA, non la perfezione. Un
        # modello uscito dall'IA arriva gia' con migliaia di spigoli difettosi:
        # quelli finiscono nel pezzo che avanza e non sono colpa del taglio.
        # Pretendendo che il resto fosse sano si buttava via un taglio in cui il
        # pezzo staccato era perfetto (0 difetti su 1779) solo perche' il resto
        # si portava dietro i 6510 guasti che aveva gia' prima. Qui si guarda se
        # il taglio ha PEGGIORATO le cose, che e' l'unica cosa di cui risponde.
        b0, t0 = _malformati(F)
        tolleranza = max(2, (ta + tb) // 200)
        if (ba + bb) <= b0 + tolleranza:
            log.append(f"Taglio riuscito; restano {ba + bb} spigoli difettosi "
                       f"(il pezzo di partenza ne aveva gia' {b0})")
        else:
            raise ValueError(
                "Il taglio ha lasciato piu' guasti di quanti ne trovasse. "
                f"Prima: {b0}/{t0} spigoli mal formati. Dopo: staccato {ba}/{ta}, "
                f"resto {bb}/{tb}; anelli={[len(x) for x in anelli]}; "
                f"selezione={len(sel)}/{len(F)} triangoli"
            )

    if not connettore or incastro_modo == "niente":
        if incastro_modo == "niente":
            log.append("Nessun aggancio (l'hai chiesto tu): le due facce "
                       "combaciano, si uniscono con la colla.")
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
    if niente_perno:
        log.append("Nessun perno: il pezzo si incastra da solo nella sua sede.")
        return {"a": _pack(np.asarray(ma.vertices), np.asarray(ma.faces)),
                "b": _pack(np.asarray(mb.vertices), np.asarray(mb.faces)), "log": log}
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
