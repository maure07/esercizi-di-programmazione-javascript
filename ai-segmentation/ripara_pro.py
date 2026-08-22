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

    def run(name, **kw):
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
    _limite = int(max_hole_edges)
    if n0 > 400000:
        _limite = min(_limite, 120)
        log.append(f"Modello grosso ({n0} facce): tappo solo i buchi fino a "
                   f"{_limite} spigoli, i piu' grandi li chiude il passo dopo.")
    run("meshing_close_holes", maxholesize=_limite,
        newfaceselected=False, selfintersection=False)

    m = ms.current_mesh()
    V = np.asarray(m.vertex_matrix(), dtype=np.float64)
    F = np.asarray(m.face_matrix(), dtype=np.int64)
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

    solidi = []
    for b in bodies:
        try:
            mm = _manifold_da_mesh(b.vertices, b.faces)
            if mm.status().name == "NoError" and mm.volume() > 0:
                solidi.append(mm)
        except Exception:
            continue
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
    log = log if log is not None else []
    import trimesh
    mesh = _to_trimesh(vertices, faces)
    diag = _diagonal(vertices)
    pitch = diag / float(risoluzione)
    vg = mesh.voxelized(pitch=pitch).fill()
    out = vg.marching_cubes
    out.merge_vertices()
    # riproiezione sulla superficie originale: recupera i dettagli e le facce
    # piatte che la voxelizzazione aveva arrotondato
    try:
        import trimesh.proximity as prox
        vicino, dist, _ = prox.closest_point(mesh, out.vertices)
        limite = pitch * 1.5
        usa = dist < limite
        V = np.asarray(out.vertices, dtype=np.float64).copy()
        V[usa] = vicino[usa]
        out = trimesh.Trimesh(vertices=V, faces=out.faces, process=False)
    except Exception as e:
        log.append(f"(riproiezione saltata: {e})")
    log.append(f"Ricostruzione a voxel {risoluzione}^3 + riproiezione: {len(out.faces)} facce")
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
    V = np.asarray(vertices, dtype=np.float64)
    F = np.asarray(faces, dtype=np.int64)
    _passo(f"\n=== RIPARAZIONE di {len(F)} triangoli ===")
    m0 = _to_trimesh(V, F)
    log.append(f"Ingresso: {len(F)} facce, chiusa={m0.is_watertight}, corpi={_corpi(m0)}")
    _passo(f"   ingresso: chiusa={m0.is_watertight}, corpi={_corpi(m0)}")

    if aggressivita == "voxel":
        V, F = voxel_fallback(V, F, risoluzione_voxel, log)
        return _risultato(V, F, log)

    # 1. pulizia MeshLab (sempre: e' quella che salva i micro-triangoli)
    try:
        _passo("-> 1 di 3: pulizia MeshLab")
        _t = time.time()
        V, F = pulisci_meshlab(V, F, log=log)
        _passo(f"   1 di 3: pulizia MeshLab: {time.time() - _t:.1f} s")
    except Exception as e:
        log.append(f"MeshLab non disponibile ({e}), proseguo")

    if aggressivita == "leggera":
        return _risultato(V, F, log)

    # 2. via i gusci interni
    try:
        _passo("-> 2 di 3: via i gusci interni")
        _t = time.time()
        V, F = togli_gusci_interni(V, F, log=log)
        _passo(f"   2 di 3: via i gusci interni: {time.time() - _t:.1f} s")
    except Exception as e:
        log.append(f"(gusci interni: {e})")

    # 3. solido esatto
    try:
        _passo("-> 3 di 3: solido esatto")
        _t = time.time()
        res = solido_esatto(V, F, log=log)
        _passo(f"   3 di 3: solido esatto: {time.time() - _t:.1f} s")
        if res is not None:
            V2, F2 = res
            m2 = _to_trimesh(V2, F2)
            if m2.is_watertight and len(F2) > 0:
                return _risultato(V2, F2, log)
            log.append("manifold3d non ha dato un solido chiuso, provo i voxel")
    except Exception as e:
        log.append(f"(manifold3d: {e})")

    # 4. ripiego voxel
    m = _to_trimesh(V, F)
    if not m.is_watertight:
        try:
            _passo("-> ripiego sui VOXEL (e' il passo lento: puo' volerci qualche minuto)")
            _t = time.time()
            V, F = voxel_fallback(V, F, risoluzione_voxel, log)
            _passo(f"   voxel: {time.time() - _t:.1f} s")
        except Exception as e:
            log.append(f"(voxel: {e})")
    _passo(f"=== FINITO in {time.time() - _t0:.1f} s ===")
    return _risultato(V, F, log)


def _corpi(m):
    try:
        return m.body_count
    except Exception:
        return -1


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
