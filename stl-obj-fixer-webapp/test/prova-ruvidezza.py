# Quanto e' seghettato il contorno del taglio, prima e dopo la levigatura.
# Ruvidezza = quanto ogni vertice del bordo sporge rispetto alla meta' dei suoi
# due vicini, in proporzione alla lunghezza tipica degli spigoli.
import sys, os, numpy as np, trimesh
# il motore sta due cartelle sopra: niente percorsi assoluti
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'ai-segmentation'))
import taglia_pro as tp

def ruvidezza(m):
    V = np.asarray(m.vertices); F = np.asarray(m.faces)
    conta = {}
    for f in F:
        for a, b in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])):
            k = (min(a, b), max(a, b)); conta[k] = conta.get(k, 0) + 1
    bordo = [k for k, c in conta.items() if c == 1]
    if not bordo: return None
    vic = {}
    for a, b in bordo:
        vic.setdefault(a, []).append(b); vic.setdefault(b, []).append(a)
    pt = [v for v, n in vic.items() if len(n) == 2]
    if len(pt) < 6: return None
    L = np.mean([np.linalg.norm(V[a] - V[b]) for a, b in bordo])
    d = [np.linalg.norm(0.5 * (V[vic[v][0]] + V[vic[v][1]]) - V[v]) for v in pt]
    return float(np.mean(d) / L)

def prova(nome, m, quota):
    V = np.asarray(m.vertices, float); F = np.asarray(m.faces, np.int64)
    cen = V[F].mean(axis=1)
    sel = [i for i in range(len(F)) if cen[i][2] > quota]
    if not sel or len(sel) == len(F): print(nome, 'sel vuota'); return
    out = []
    for etichetta, giri in (('grezzo', 0), ('levigato', None)):
        orig = tp.taglia_sulla_selezione
        import types
        # per il caso "grezzo" azzero i giri monkeypatchando il modulo
        if giri == 0:
            src_giri = tp.taglia_sulla_selezione
        r = tp.taglia_sulla_selezione(V.copy(), F.copy(), sel, connettore=False,
                                      appiattisci=False) if giri is None else None
        if r is None:
            r = _senza_levigatura(V, F, sel)
        ma = trimesh.Trimesh(np.asarray(r['a']['vertices']), np.asarray(r['a']['faces']), process=False)
        out.append((etichetta, ruvidezza(trimesh.Trimesh(
            np.asarray(r['a']['vertices']), np.asarray(r['a']['faces']), process=False))))
    print(nome, out)

def _senza_levigatura(V, F, sel):
    # ricava il pezzo A senza toccare il bordo: solo le facce selezionate
    return {'a': {'vertices': V.tolist(), 'faces': [F[i].tolist() for i in sel]},
            'b': {'vertices': V.tolist(), 'faces': []}, 'log': []}

prova('cilindro rado   ', trimesh.creation.cylinder(radius=20, height=100, sections=16), 10)
prova('cilindro fitto  ', trimesh.creation.cylinder(radius=20, height=100, sections=96), 10)
prova('sfera fitta     ', trimesh.creation.icosphere(subdivisions=4, radius=30), 5)
prova('sfera fittissima', trimesh.creation.icosphere(subdivisions=5, radius=30), 5)
