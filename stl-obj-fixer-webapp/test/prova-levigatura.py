# Misura la levigatura del contorno su tre casi:
#  - cilindro RADO: l'anello di taglio e' un cerchio "buono", non deve stringersi
#  - sfera fitta: contorno con dentini piccoli
#  - scalinatura finta: anello a zig-zag, deve venire dritto
import sys, os, numpy as np, trimesh
# il motore sta due cartelle sopra: niente percorsi assoluti
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'ai-segmentation'))
import taglia_pro as tp

def prova(nome, m, quota):
    V = np.asarray(m.vertices, dtype=np.float64)
    F = np.asarray(m.faces, dtype=np.int64)
    cen = V[F].mean(axis=1)
    sel = [i for i in range(len(F)) if cen[i][2] > quota]
    if not sel or len(sel) == len(F):
        print(nome, 'selezione vuota'); return
    vol0 = float(m.volume)
    try:
        r = tp.taglia_sulla_selezione(V.copy(), F.copy(), sel, connettore=False)
    except Exception as e:
        print(nome, 'ERRORE', e); return
    a, b = r['a'], r['b']
    ma = trimesh.Trimesh(np.asarray(a['vertices']), np.asarray(a['faces']), process=False)
    mb = trimesh.Trimesh(np.asarray(b['vertices']), np.asarray(b['faces']), process=False)
    tot = float(ma.volume) + float(mb.volume)
    err = abs(tot - vol0) / vol0 * 100.0
    mosso = [l for l in r['log'] if 'levigato' in l]
    print(f"{nome}: volume {vol0:.1f} -> {tot:.1f} (errore {err:.3f}%), "
          f"chiusi {ma.is_watertight}/{mb.is_watertight}; " + (mosso[0] if mosso else 'nessuno spostamento'))

prova('cilindro rado  ', trimesh.creation.cylinder(radius=20, height=100, sections=16), 10)
prova('cilindro fitto ', trimesh.creation.cylinder(radius=20, height=100, sections=64), 10)
prova('sfera fitta    ', trimesh.creation.icosphere(subdivisions=4, radius=30), 5)
prova('sfera fittissima', trimesh.creation.icosphere(subdivisions=5, radius=30), 5)
prova('scatola        ', trimesh.creation.box(extents=[40, 40, 100]), 10)
