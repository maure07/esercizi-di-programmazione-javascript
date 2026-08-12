"""Quale profondita' da' il nocciolo piu' spesso? Sweep su una macchia grande
e su una piccola, per capire se 0.22*larghezza e' la regola giusta."""
import sys, time
sys.path.insert(0, '../../ai-segmentation')
import numpy as np, trimesh, taglia_pro

SCR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modelli')
m = trimesh.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modelli') + '/goku_vero.stl'); m.merge_vertices()
V, F = np.asarray(m.vertices), np.asarray(m.faces)
C = V[F].mean(axis=1); N = m.face_normals
zmin, zmax = float(V[:, 2].min()), float(V[:, 2].max())


def selezione(frac0, frac1, soglia):
    z0, z1 = zmin + frac0 * (zmax - zmin), zmin + frac1 * (zmax - zmin)
    fascia = (C[:, 2] > z0) & (C[:, 2] < z1)
    xm = float(np.median(C[fascia][:, 0]))
    return np.where(fascia & (C[:, 0] > xm) & (N @ np.array([0., -1., 0.]) > soglia))[0]


casi = [('macchia GRANDE (coscia)', selezione(0.30, 0.40, 0.55)),
        ('macchia PICCOLA (coscia)', selezione(0.33, 0.365, 0.70))]

for nome, sel in casi:
    # ricostruisco quello che vede taglia_sulla_selezione: anelli + normali
    log = []
    print(f'\n{"="*72}\n{nome}: {len(sel)} triangoli')
    # taglio normale, per avere il termine di paragone
    r = taglia_pro.taglia_sulla_selezione(V, F, sel, connettore=False,
                                          appiattisci='mai', incastro_modo='niente')
    ma = trimesh.Trimesh(vertices=r['a']['vertices'], faces=r['a']['faces'], process=False)
    sp0 = 4.0 * abs(float(ma.volume)) / (float(ma.area) or 1.0)
    gr = float(np.sort(np.asarray(ma.extents))[1])
    print(f'  taglio normale: spessore {sp0:.1f}, larghezza(2a dim) {gr:.0f}, '
          f'volume {abs(ma.volume):.0f}')
    # ora provo diverse profondita' passando dal motore interno
    Vw, Fw, selw, anelli, nv = taglia_pro._preparativi_nocciolo(V, F, sel)
    for k in (0.02, 0.04, 0.06, 0.09, 0.13, 0.18, 0.22, 0.30):
        p = k * gr
        t = time.time()
        out = taglia_pro.taglia_a_nocciolo(Vw, Fw, selw, anelli, [], p, 0.20, nv)
        if out is None:
            print(f'    k={k:.2f} p={p:6.1f} -> fallito ({time.time()-t:.0f}s)')
            continue
        a, b = out
        sp = 4.0 * abs(float(a.volume)) / (float(a.area) or 1.0)
        print(f'    k={k:.2f} p={p:6.1f} -> spessore {sp:6.1f} '
              f'({"MEGLIO" if sp > sp0 else "peggio"}), vol {abs(a.volume):8.0f}, '
              f'chiusi {a.is_watertight}/{b.is_watertight} ({time.time()-t:.0f}s)')
