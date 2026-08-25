"""Macchia pulita sulla coscia (come quella che si ottiene col clic magico),
taglio a nocciolo, esporta i due pezzi per guardarli."""
import sys
import os
sys.path.insert(0, '../../ai-segmentation')
import numpy as np, trimesh, taglia_pro

SCR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modelli')
m = trimesh.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modelli') + '/goku_vero.stl'); m.merge_vertices()
V, F = np.asarray(m.vertices), np.asarray(m.faces)
C = V[F].mean(axis=1); N = m.face_normals
zmin, zmax = float(V[:, 2].min()), float(V[:, 2].max())

z0, z1 = zmin + 0.30 * (zmax - zmin), zmin + 0.40 * (zmax - zmin)
fascia = (C[:, 2] > z0) & (C[:, 2] < z1)
xm = float(np.median(C[fascia][:, 0]))
verso = np.array([0.0, -1.0, 0.0])
sel = np.where(fascia & (C[:, 0] > xm) & (N @ verso > 0.55))[0]
print('macchia:', len(sel), 'triangoli')

r = taglia_pro.taglia_sulla_selezione(V, F, sel, connettore=True, gioco=0.20,
                                      appiattisci='auto', incastro_modo='nocciolo')
ma = trimesh.Trimesh(vertices=r['a']['vertices'], faces=r['a']['faces'], process=False)
mb = trimesh.Trimesh(vertices=r['b']['vertices'], faces=r['b']['faces'], process=False)
print('pezzo:', len(ma.faces), 'facce, chiuso', ma.is_watertight,
      '| resto:', len(mb.faces), 'facce, chiuso', mb.is_watertight)
print('volume mancante: %.2f%%' % (100 * abs(abs(ma.volume) + abs(mb.volume) - abs(m.volume)) / abs(m.volume)))
for l in r['log']:
    if any(k in l for k in ('NOCCIOLO', 'nocciolo', 'ATTENZIONE')):
        print('  ·', l[:220])

T = V[F[sel]]
nf = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
n = nf.sum(axis=0); n /= np.linalg.norm(n)
nrm = ma.face_normals
piatti = np.where(nrm @ n < -0.98)[0]
retro = np.where(nrm @ n < -0.3)[0]
ap = float(ma.area_faces[piatti].sum()); ar = float(ma.area_faces[retro].sum())
print(f'faccia di taglio piana: area {ap:.0f} su {ar:.0f} rivolta all\'indietro '
      f'({100*ap/max(ar,1):.0f}%)')
q = (ma.triangles.mean(axis=1) @ n)[piatti]
if len(q):
    print(f'   e sta tutta su una quota sola: da {q.min():.1f} a {q.max():.1f}')
ma.export(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modelli') + '/macchia-A.stl'); mb.export(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modelli') + '/macchia-B.stl')
print('esportati macchia-A.stl e macchia-B.stl')
