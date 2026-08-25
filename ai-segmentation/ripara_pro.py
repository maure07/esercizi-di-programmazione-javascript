"""
ripara_pro.py
Riparazione PROFESSIONALE per modelli generati dall'AI, che tipicamente sono:
  - aperti (buchi, bordi liberi)
  - non-manifold (spigoli condivisi da 3+ facce)
  - pieni di micro-triangoli degeneri e vertici doppi quasi coincidenti
  - con GUSCI INTERNI (i "vuoti" dentro) che rovinano booleane e stampa

Catena di attrezzi (dal piu' delicato al piu' deciso), pensata per NON perdere
qualita': si interviene solo dove serve e si tiene la geometria originale.

  1. pymeshlab (motore di MeshLab): salda i vertici quasi coincidenti, elimina
     facce doppie/degeneri, ripara spigoli e vertici non-manifold, chiude i buchi.
  2. rimozione dei gusci interni: tiene solo le superfici che stanno davvero
     "fuori", buttando via il vuoto interno tipico dei modelli AI.
  3. manifold3d (booleane esatte, stesso approccio di Blender/OpenSCAD): unisce
     i pezzi rimasti in UN solido esatto e garantito manifold.
  4. se qualcosa va storto, si ripiega su una ricostruzione a voxel + riproiezione
     sulla superficie originale (chiusa per costruzione, dettagli mantenuti).

Input:  vertices (N,3), faces (M,3)
Output: dict con vertices, faces, log, watertight, ...
"""
import sys
import time

import numpy as np


# ---------------------------------------------------------------------------
# utilita'
# ---------------------------------------------------------------------------
def _to_trimesh(vertices, faces):
    import trimesh
    return trimesh.Trimesh(
        vertices=np.asarray(vertices, dtype=np.float64),
        faces=np.asarray(faces, dtype=np.int64),
        process=False,
    )


def _diagonal(vertices):
    v = np.asarray(vertices, dtype=np.float64)
    if len(v) == 0:
        return 1.0
    d = float(np.linalg.norm(v.max(axis=0) - v.min(axis=0)))
    return d if d > 0 else 1.0


# ---------------------------------------------------------------------------
# 1. passata pymeshlab (motore MeshLab)
# ---------------------------------------------------------------------------
def _passo(testo):
    """Scrive nella finestra nera del companion, subito.

    Segnalato dall'uso: "sta sempre li' a girare senza fare nulla". Il resoconto
    dei passi c'era gia', ma tornava tutto INSIEME alla fine: mentre il lavoro e'
    in corso non si vedeva niente, e una riparazione lenta era
    indistinguibile da una piantata. Adesso ogni passo si annuncia quando
    comincia e dice quanto ci ha messo quando finisce, cosi' la finestra nera fa
    da barra di avanzamento e si sa SEMPRE dove si e' fermata.
    """
    print(testo, file=sys.stderr, flush=True)


_FILTRI = None


def _filtri_disponibili():
    """I filtri che questa copia di MeshLab ha DAVVERO.

    Non e' scontato, ed e' costato caro. MeshLab carica i filtri come plugin, e
    un plugin che non si carica sparisce senza far rumore: qui dentro, per
    esempio, `filter_meshing` non parte e con lui se ne va
    `meshing_close_holes`, cioe' PROPRIO il passo che chiude i buchi.
    Chiedendo un filtro che non c'e', pymeshlab alza un'eccezione con scritto
    "Filter does not exists" - che finiva in una riga di log fra le altre. Il
    risultato: il passo che chiude i buchi non veniva eseguito, il modello
    restava aperto, e niente lo diceva. Segnalato dall'uso come "non sembra
    chiudere bene", e aveva ragione.
    """
    global _FILTRI
    if _FILTRI is None:
        import pymeshlab
        try:
            _FILTRI = set(pymeshlab.filter_list())
        except Exception:
            # versione che non sa elencarli: si prova e basta, come prima
            _FILTRI = set()
    return _FILTRI


def pulisci_meshlab(vertices, faces, merge_frac=2e-4, max_hole_edges=600, log=None):
    """Salda micro-gap, toglie degeneri/doppioni, ripara non-manifold, chiude buchi."""
    import pymeshlab
    log = log if log is not None else []

    ms = pymeshlab.MeshSet()
    ms.add_mesh(pymeshlab.Mesh(
        vertex_matrix=np.asarray(vertices, dtype=np.float64),
        face_matrix=np.asarray(faces, dtype=np.int32),
    ), "m")

    diag = _diagonal(vertices)
    n0 = ms.current_mesh().face_number()

    disponibili = _filtri_disponibili()

    def scegli(*nomi):
        """Il primo nome che questa MeshLab conosce davvero.

        I nomi dei filtri cambiano da una versione all'altra, e un plugin non
        caricato li fa sparire del tutto. None = nessuno di questi c'e'.
        """
        if not disponibili:
            return nomi[0]        # non so elencarli: provo il primo, come prima
        for n in nomi:
            if n in disponibili:
                return n
        return None

    def run(name, **kw):
        if name is None:
            return False
        _passo(f"   ... {name}")
        _t = time.time()
        try:
            ms.apply_filter(name, **kw)
            _passo(f"       fatto in {time.time() - _t:.1f} s")
            return True
        except Exception as e:  # filtro non disponibile / non applicabile
            log.append(f"({name} saltato: {e})")
            _passo(f"       saltato ({str(e).splitlines()[0][:60]})")
            return False

    # vertici quasi coincidenti -> stessi vertici (chiude i "micro triangoli aperti")
    run("meshing_merge_close_vertices",
        threshold=pymeshlab.PercentageValue(merge_frac * 100.0))
    run("meshing_remove_duplicate_vertices")
    run("meshing_remove_duplicate_faces")
    run("meshing_remove_null_faces")          # facce ad area zero
    run("meshing_remove_unreferenced_vertices")
    # non-manifold: prima gli spigoli, poi i vertici
    run("meshing_repair_non_manifold_edges", method='Remove Faces')
    run("meshing_repair_non_manifold_vertices")
    run("meshing_remove_unreferenced_vertices")
    # chiusura buchi (solo quelli ragionevoli: un buco enorme e' meglio lasciarlo
    # al passo successivo che ragiona sul solido)
    # QUANTO GRANDI I BUCHI DA TAPPARE. Su una mesh decimata e piena di
    # aperture questo filtro puo' macinare per minuti: e' l'unico passo qui
    # dentro il cui costo cresce con la SCOMPOSIZIONE del bordo, non con i
    # triangoli. Sui modelli grossi si tappano solo i buchi piccoli e i grandi
    # si lasciano al passo dopo, che ragiona sul solido ed e' molto piu' rapido.
    # NIENTE TETTO QUI. Ci avevo messo un limite sui modelli grossi temendo che
    # questo filtro macinasse: misurato poi sul PC dell'uso, su 764.000
    # triangoli costa 0,3 secondi. Il limite invece lasciava buchi aperti, e un
    # modello che resta aperto finisce sul ripiego a VOXEL, che su quella
    # stazza dura minuti. Meglio tappare qui, dove costa niente.
    nome_buchi = scegli("meshing_close_holes", "close_holes")
    if nome_buchi is None:
        log.append("Questa MeshLab non ha il filtro che chiude i buchi "
                   "(il plugin 'filter_meshing' non si e' caricato): i buchi "
                   "li tappo con l'altro motore.")
        _passo("   ... il filtro dei buchi qui non c'e': li tappo con trimesh")
    buchi_chiusi = run(nome_buchi, maxholesize=int(max_hole_edges),
                       newfaceselected=False, selfintersection=False)

    m = ms.current_mesh()
    V = np.asarray(m.vertex_matrix(), dtype=np.float64)
    F = np.asarray(m.face_matrix(), dtype=np.int64)

    # SE MESHLAB NON HA POTUTO CHIUDERE I BUCHI, li chiude trimesh.
    # Non e' bravo uguale - tira una membrana piatta sul giro del buco invece di
    # seguire la curvatura - ma un buco tappato cosi' e' quello che decide se il
    # modello si chiude o no, e il passo dopo lavora solo sui solidi chiusi.
    # Prima, senza quel filtro, il buco restava li' e tutta la catena finiva sul
    # "non sono riuscito a chiuderlo".
    if not buchi_chiusi:
        _t = time.time()
        try:
            mm = _to_trimesh(V, F)
            if not mm.is_watertight:
                mm.fill_holes()
                V = np.asarray(mm.vertices, dtype=np.float64)
                F = np.asarray(mm.faces, dtype=np.int64)
                log.append(f"Buchi tappati con trimesh: {len(F)} facce")
                _passo(f"       buchi tappati con trimesh in {time.time() - _t:.1f} s")
        except Exception as e:
            log.append(f"(tappatura buchi con trimesh saltata: {e})")
            _passo(f"       tappatura con trimesh saltata ({str(e)[:50]})")

    log.append(f"MeshLab: {n0} -> {len(F)} facce (saldature, degeneri, non-manifold, buchi)")
    return V, F


# ---------------------------------------------------------------------------
# 2. rimozione dei gusci interni ("vuoti" dentro il modello)
# ---------------------------------------------------------------------------
def togli_gusci_interni(vertices, faces, log=None):
    """Tiene solo i corpi che NON stanno dentro un altro corpo.

    I modelli AI hanno spesso superfici interne (occhi dentro la testa, gusci
    doppi): per la stampa e per le booleane sono spazzatura. Un corpo e'
    considerato interno se il suo centro sta dentro un corpo piu' grande.
    """
    import trimesh
    log = log if log is not None else []
    mesh = _to_trimesh(vertices, faces)
    try:
        bodies = mesh.split(only_watertight=False)
    except Exception:
        bodies = [mesh]
    if len(bodies) <= 1:
        return vertices, faces

    # ordina per volume "di ingombro" decrescente
    def size(b):
        e = b.bounds[1] - b.bounds[0]
        return float(e[0] * e[1] * e[2])

    bodies = sorted(bodies, key=size, reverse=True)
    tenuti = []
    for i, b in enumerate(bodies):
        interno = False
        centro = b.bounds.mean(axis=0).reshape(1, 3)
        for j, big in enumerate(bodies[:i]):
            if size(big) <= size(b):
                continue
            # dentro il bounding box del corpo piu' grande?
            lo, hi = big.bounds
            if not np.all((centro[0] >= lo) & (centro[0] <= hi)):
                continue
            try:
                if big.is_watertight and bool(big.contains(centro)[0]):
                    interno = True
                    break
            except Exception:
                pass
            # ripiego: se e' contenuto nel bbox ed e' molto piu' piccolo, e'
            # quasi certamente un guscio interno
            if size(b) < 0.6 * size(big) and np.all((b.bounds[0] >= lo) & (b.bounds[1] <= hi)):
                interno = True
                break
        if not interno:
            tenuti.append(b)

    if len(tenuti) < len(bodies):
        log.append(f"Gusci interni rimossi: {len(bodies) - len(tenuti)} (vuoti dentro il modello)")
    if not tenuti:
        return vertices, faces
    out = trimesh.util.concatenate(tenuti)
    return np.asarray(out.vertices), np.asarray(out.faces)


# ---------------------------------------------------------------------------
# 3. solido esatto con manifold3d
# ---------------------------------------------------------------------------
def _manifold_da_mesh(V, F):
    from manifold3d import Manifold, Mesh
    mm = Manifold(Mesh(
        vert_properties=np.asarray(V, dtype=np.float32),
        tri_verts=np.asarray(F, dtype=np.uint32),
    ))
    return mm


def solido_esatto(vertices, faces, log=None):
    """Unisce i corpi in UN solido esatto e manifold. None se non ci riesce."""
    import trimesh
    from manifold3d import Manifold
    log = log if log is not None else []
    mesh = _to_trimesh(vertices, faces)
    try:
        bodies = mesh.split(only_watertight=False)
    except Exception:
        bodies = [mesh]
    if len(bodies) == 0:
        bodies = [mesh]

    # Sotto questa taglia un corpo e' una briciola (una scaglia staccata, un
    # triangolo orfano): quelle si buttano e va bene cosi'. Sopra, e' un PEZZO
    # del modello e non si butta in silenzio.
    soglia_pezzo = max(50, int(0.005 * len(mesh.faces)))

    solidi = []
    persi = briciole = riparati = 0
    for b in bodies:
        mm = None
        try:
            mm = _manifold_da_mesh(b.vertices, b.faces)
            if mm.status().name != "NoError" or mm.volume() <= 0:
                mm = None
        except Exception:
            mm = None
        if mm is None and len(b.faces) >= soglia_pezzo:
            # UN PEZZO NON SI BUTTA VIA IN SILENZIO. Prima un corpo che non
            # passava veniva scartato e basta: il modello tornava indietro senza
            # quel pezzo, e se erano parecchi non si chiudeva piu' niente ne' si
            # capiva perche'. Si prova la scaletta che CONSERVA i triangoli - la
            # stessa che rimette in piedi i pezzi per il nocciolo - e solo se
            # fallisce anche lei il pezzo resta fuori, ma scritto nel resoconto.
            try:
                import taglia_pro
                mm2, _ = taglia_pro._manifold_solido(
                    np.asarray(b.vertices), np.asarray(b.faces), [], "pezzo")
                if mm2 is not None and mm2.status().name == "NoError" and mm2.volume() > 0:
                    mm = mm2
                    riparati += 1
            except Exception:
                mm = None
        if mm is None:
            if len(b.faces) >= soglia_pezzo:
                persi += 1
            else:
                briciole += 1
            continue
        solidi.append(mm)

    if riparati:
        log.append(f"{riparati} pezzi rimessi in piedi conservando i triangoli")
    if briciole:
        log.append(f"Briciole scartate: {briciole} (scaglie staccate, sotto {soglia_pezzo} facce)")
    if persi:
        log.append(f"ATTENZIONE: {persi} pezzi grossi non si sono potuti chiudere e sono "
                   f"rimasti FUORI dal solido. Se al modello manca qualcosa, e' questo.")
        _passo(f"   attenzione: {persi} pezzi grossi restano fuori dal solido")
    if not solidi:
        return None

    acc = solidi[0]
    for s in solidi[1:]:
        try:
            acc = acc + s          # unione booleana ESATTA
        except Exception:
            continue
    if acc.status().name != "NoError":
        return None
    out = acc.to_mesh()
    V = np.asarray(out.vert_properties[:, :3], dtype=np.float64)
    F = np.asarray(out.tri_verts, dtype=np.int64)
    log.append(f"manifold3d: solido esatto, {len(F)} facce, volume {acc.volume():.1f}")
    return V, F


# ---------------------------------------------------------------------------
# 4. ripiego a voxel (sempre chiuso) con riproiezione sull'originale
# ---------------------------------------------------------------------------
def voxel_fallback(vertices, faces, risoluzione=256, log=None):
    """Ultimo ripiego: si riempie il modello di cubetti e se ne ricava la pelle.

    E' il passo piu' caro di tutta la catena, e finora era anche il piu' muto:
    segnalato dall'uso, "sta ancora andando" con la finestra nera ferma sulla
    riga dei voxel. Adesso ogni pezzo si annuncia e si cronometra, e i due piu'
    esosi hanno un freno.
    """
    log = log if log is not None else []
    import trimesh
    mesh = _to_trimesh(vertices, faces)
    diag = _diagonal(vertices)
    pitch = diag / float(risoluzione)

    _passo(f"   voxel: riempio la griglia ({risoluzione}^3)")
    _t = time.time()
    vg = mesh.voxelized(pitch=pitch).fill()
    _passo(f"      griglia riempita in {time.time() - _t:.1f} s")

    _t = time.time()
    out = vg.marching_cubes
    out.merge_vertices()
    _passo(f"      pelle ricavata in {time.time() - _t:.1f} s ({len(out.faces)} facce)")

    # RIPROIEZIONE sulla superficie originale: recupera i dettagli e le facce
    # piatte che la voxelizzazione aveva arrotondato. Costa una ricerca del
    # punto piu' vicino PER OGNI VERTICE, sulla mesh di partenza: su un modello
    # da tre quarti di milione di triangoli e' il pezzo che fa aspettare i
    # minuti. Sopra una certa stazza si rinuncia e lo si DICE: meglio un pezzo
    # un filo arrotondato ma pronto, che una rotellina che gira.
    # La riproiezione NON si salta piu'. L'avevo tolta sui modelli grossi per
    # far prima, e il risultato e' stato un modello rovinato: e' proprio lei a
    # rimettere i dettagli che i cubetti avevano mangiato. Adesso ai voxel ci si
    # arriva solo se li chiedi tu, e se li chiedi vuol dire che sei disposto ad
    # aspettare: allora si fa il lavoro per intero.
    if True:
        try:
            import trimesh.proximity as prox
            _passo("   voxel: rimetto i dettagli sulla pelle ricostruita")
            _t = time.time()
            vicino, dist, _ = prox.closest_point(mesh, out.vertices)
            limite = pitch * 1.5
            usa = dist < limite
            V = np.asarray(out.vertices, dtype=np.float64).copy()
            V[usa] = vicino[usa]
            out = trimesh.Trimesh(vertices=V, faces=out.faces, process=False)
            _passo(f"      dettagli rimessi in {time.time() - _t:.1f} s")
        except Exception as e:
            log.append(f"(riproiezione saltata: {e})")
            _passo(f"      riproiezione saltata ({str(e)[:50]})")
    log.append(f"Ricostruzione a voxel {risoluzione}^3: {len(out.faces)} facce")
    return np.asarray(out.vertices), np.asarray(out.faces)


# ---------------------------------------------------------------------------
# pipeline completa
# ---------------------------------------------------------------------------
def ripara(vertices, faces, aggressivita="auto", risoluzione_voxel=256):
    """Ripara una mesh AI restituendo un solido chiuso e manifold.

    aggressivita: 'leggera' = solo MeshLab (massima fedelta')
                  'auto'    = MeshLab -> gusci interni -> manifold3d -> (voxel)
                  'voxel'   = forza la ricostruzione a voxel
    """
    log = []
    _t0 = time.time()
    # Quanto e' costato ogni passo. Finisce nel resoconto che si legge nell'app:
    # "un po' lenta" da solo non si puo' inseguire, il tempo va misurato sul PC
    # di chi aspetta, non sul mio.
    tempi = []
    V = np.asarray(vertices, dtype=np.float64)
    F = np.asarray(faces, dtype=np.int64)
    _passo(f"\n=== RIPARAZIONE di {len(F)} triangoli ===")
    m0 = _to_trimesh(V, F)
    log.append(f"Ingresso: {len(F)} facce, chiusa={m0.is_watertight}, corpi={_corpi(m0)}")
    _passo(f"   ingresso: chiusa={m0.is_watertight}, corpi={_corpi(m0)}")

    if aggressivita == "voxel":
        V, F = voxel_fallback(V, F, risoluzione_voxel, log)
        _tempi(log, tempi, _t0)
        return _risultato(V, F, log)

    # 1. pulizia MeshLab (sempre: e' quella che salva i micro-triangoli)
    try:
        _passo("-> 1 di 3: pulizia MeshLab")
        _t = time.time()
        V, F = pulisci_meshlab(V, F, log=log)
        tempi.append(("MeshLab", time.time() - _t))
        _passo(f"   1 di 3: pulizia MeshLab: {time.time() - _t:.1f} s")
    except Exception as e:
        log.append(f"MeshLab non disponibile ({e}), proseguo")

    if aggressivita == "leggera":
        _tempi(log, tempi, _t0)
        return _risultato(V, F, log)

    # 2. via i gusci interni
    try:
        _passo("-> 2 di 3: via i gusci interni")
        _t = time.time()
        V, F = togli_gusci_interni(V, F, log=log)
        tempi.append(("gusci interni", time.time() - _t))
        _passo(f"   2 di 3: via i gusci interni: {time.time() - _t:.1f} s")
    except Exception as e:
        log.append(f"(gusci interni: {e})")

    # 3. solido esatto
    try:
        _passo("-> 3 di 3: solido esatto")
        _t = time.time()
        res = solido_esatto(V, F, log=log)
        tempi.append(("solido esatto", time.time() - _t))
        _passo(f"   3 di 3: solido esatto: {time.time() - _t:.1f} s")
        if res is not None:
            V2, F2 = res
            m2 = _to_trimesh(V2, F2)
            if m2.is_watertight and len(F2) > 0:
                _tempi(log, tempi, _t0)
                return _risultato(V2, F2, log)
            log.append("manifold3d non ha dato un solido chiuso, provo i voxel")
    except Exception as e:
        log.append(f"(manifold3d: {e})")

    # 3-bis. LA SCALETTA CHE NON ROVINA NIENTE.
    #
    # Segnalato dall'uso: con i voxel "fa subito ma rovina tutto" - 764.570
    # triangoli diventati 197.968 e la faccia a gradini. Giusto: la
    # ricostruzione a voxel butta via la geometria e la rifa' a cubetti, e su
    # una testa scolpita e' un disastro. Ai voxel non ci si deve arrivare.
    #
    # Nel motore del taglio c'e' gia' una scaletta di riparazione che invece i
    # triangoli LI TIENE: toglie le facce di troppo sugli spigoli affollati,
    # rigira quelle al contrario, tappa i buchi. E' quella che ha rimesso in
    # piedi il nocciolo sui modelli rotti. Si prova quella, prima.
    m = _to_trimesh(V, F)
    if not m.is_watertight:
        _passo("-> non e' ancora chiuso: provo la riparazione che conserva i triangoli")
        _t = time.time()
        try:
            import taglia_pro
            _diag = []
            _sol, _rip = taglia_pro._manifold_solido(V, F, _diag, "modello")
            if _sol is not None:
                _out = _sol.to_mesh()
                V4 = np.asarray(_out.vert_properties[:, :3], dtype=np.float64)
                F4 = np.asarray(_out.tri_verts, dtype=np.int64)
                if _to_trimesh(V4, F4).is_watertight and len(F4) > 0:
                    if _rip:
                        log.append(f"Chiuso conservando i triangoli ({_rip}): niente voxel.")
                    else:
                        log.append("Chiuso conservando i triangoli: niente voxel.")
                    _passo(f"   riuscito in {time.time() - _t:.1f} s, {len(F4)} facce: niente voxel")
                    _passo(f"=== FINITO in {time.time() - _t0:.1f} s ===")
                    _tempi(log, tempi, _t0)
                    return _risultato(V4, F4, log)
        except Exception as e:
            log.append(f"(riparazione che conserva i triangoli: {e})")
        _passo(f"   non e' bastata ({time.time() - _t:.1f} s)")

    # 3-ter. UN ULTIMO TENTATIVO A BUON MERCATO prima dei voxel.
    # Il ripiego a voxel su un modello grosso e' il passo piu' caro di tutta la
    # catena: costruisce una griglia da milioni di celle e poi riproietta ogni
    # vertice sulla superficie di partenza. Se quello che manca sono solo
    # qualche buco rimasto aperto, tapparli con trimesh e riprovare il solido
    # esatto costa un secondo e fa risparmiare minuti.
    m = _to_trimesh(V, F)
    if not m.is_watertight:
        _passo("-> il modello non e' ancora chiuso: provo a tappare i buchi rimasti")
        _t = time.time()
        try:
            m2 = m.copy()
            m2.fill_holes()
            if m2.is_watertight or len(m2.faces) != len(m.faces):
                res = solido_esatto(np.asarray(m2.vertices), np.asarray(m2.faces), log=log)
                if res is not None:
                    V3, F3 = res
                    if _to_trimesh(V3, F3).is_watertight:
                        log.append("Chiuso tappando i buchi rimasti: niente voxel.")
                        _passo(f"   riuscito in {time.time() - _t:.1f} s: niente voxel")
                        _passo(f"=== FINITO in {time.time() - _t0:.1f} s ===")
                        _tempi(log, tempi, _t0)
                        return _risultato(V3, F3, log)
        except Exception as e:
            log.append(f"(tappatura buchi: {e})")
        _passo(f"   non e' bastato ({time.time() - _t:.1f} s)")

    # 4. I VOXEL SOLO SE LI CHIEDI TU.
    #
    # Prima partivano da soli quando il modello non si chiudeva, e chi premeva
    # "Ripara" si ritrovava in mano un altro modello: la testa scolpita tornava
    # indietro a gradini, da 764.570 triangoli a 197.968. Un pezzo aperto ma
    # integro e' quasi sempre meglio di un pezzo chiuso e rovinato - e il taglio
    # sa gia' rimettere a posto quel che gli serve da solo. Quindi qui ci si
    # ferma, si dice com'e' andata, e i voxel restano a disposizione come scelta
    # esplicita (aggressivita="voxel").
    m = _to_trimesh(V, F)
    if not m.is_watertight:
        log.append("NON sono riuscito a chiuderlo del tutto senza rifare la "
                   "geometria da capo. Ti lascio il modello RIPULITO e integro: "
                   "per tagliare va benissimo lo stesso. Se ti serve chiuso a "
                   "ogni costo, usa \"Chiudi per forza (a voxel)\" - ma i "
                   "dettagli si arrotondano e i triangoli si rifanno da zero.")
        _passo("-> non si chiude senza rifare la geometria: mi fermo qui e lo dico "
               "(i voxel rovinerebbero i dettagli, si chiedono a parte)")
        _passo(f"=== FINITO in {time.time() - _t0:.1f} s ===")
        _tempi(log, tempi, _t0)
        return _risultato(V, F, log)
    _passo(f"=== FINITO in {time.time() - _t0:.1f} s ===")
    _tempi(log, tempi, _t0)
    return _risultato(V, F, log)


def _corpi(m):
    try:
        return m.body_count
    except Exception:
        return -1


def _tempi(log, tempi, _t0):
    """La riga dei tempi, in fondo al resoconto.

    Serve a rispondere a "e' lenta" con un numero invece che con un'idea: si
    legge nell'app, sul PC di chi ha aspettato."""
    if tempi:
        log.append("Tempi: " + " \u00b7 ".join(f"{n} {s:.1f}s" for n, s in tempi)
                   + f" \u00b7 totale {time.time() - _t0:.1f}s")


def _risultato(V, F, log):
    m = _to_trimesh(V, F)
    wt = bool(m.is_watertight)
    log.append(f"Uscita: {len(F)} facce, chiusa={wt}, corpi={_corpi(m)}, volume={m.volume:.1f}")
    return {
        "vertices": np.asarray(V, dtype=np.float64),
        "faces": np.asarray(F, dtype=np.int64),
        "watertight": wt,
        "volume": float(m.volume),
        "log": log,
    }
