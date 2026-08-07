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
VERSIONE = "taglio-locale-3"


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
# taglio + connettore quadrato automatico
# ---------------------------------------------------------------------------
def taglia_con_piano(vertices, faces, punto, normale,
                     connettore=True, gioco=0.20, lato=None, profondita=None,
                     n_connettori=1, sel_min=None, sel_max=None,
                     scala_connettore=1.0):
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
    A = solido_da_tagliare.trim_by_plane(list(n), offset)        # lato +normale
    B = solido_da_tagliare.trim_by_plane(list(-n), -offset)      # lato -normale

    if (A.volume() <= 0 or B.volume() <= 0) and resto is not None:
        # la scatola locale non stava a cavallo del piano: niente taglio
        # locale valido, si ripiega sul piano infinito su tutto il pezzo
        log.append("Taglio locale non a cavallo del piano, ripiego sul piano su tutto il pezzo")
        resto = None
        regione = None
        solido_da_tagliare = solido
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
