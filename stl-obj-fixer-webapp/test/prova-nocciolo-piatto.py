"""Il fondo del nocciolo deve essere PIANO. Si misura cosi': si prende la
faccia di dietro (i triangoli che guardano dalla parte opposta alla macchia) e
si guarda quanto si scostano dal loro piano medio. Zero = piano perfetto."""
import sys
sys.path.insert(0, '../../ai-segmentation')
import numpy as np, trimesh, taglia_pro

SCR = '/home/user/esercizi-di-programmazione-javascript/stl-obj-fixer-webapp/test/modelli'
m = trimesh.load(SCR + '/goku_vero.stl'); m.merge_vertices()
V, F = np.asarray(m.vertices), np.asarray(m.faces)
C = V[F].mean(axis=1)

# la stessa macchia sulla coscia che usa il test dell'app
mn, mx = np.array([60., -120., 500.]), np.array([230., 60., 700.])
sel = np.where(np.all((C > mn) & (C < mx), axis=1))[0]
print('selezione:', len(sel), 'triangoli')

T = V[F[sel]]
nf = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
n = nf.sum(axis=0); n = n / np.linalg.norm(n)
print('la macchia guarda verso', np.round(n, 2).tolist())


def planarita(mesh, verso):
    """scostamento dal piano medio dei triangoli che guardano verso -verso"""
    nrm = mesh.face_normals
    retro = np.where(nrm @ verso < -0.85)[0]
    if not len(retro):
        return None
    P = mesh.vertices[mesh.faces[retro]].reshape(-1, 3)
    q = P @ verso
    return float(q.max() - q.min()), len(retro), float(mesh.area_faces[retro].sum())


for modo in ('nocciolo',):
    r = taglia_pro.taglia_sulla_selezione(V, F, sel, connettore=True, gioco=0.20,
                                          appiattisci='auto', incastro_modo=modo)
    ma = trimesh.Trimesh(vertices=r['a']['vertices'], faces=r['a']['faces'], process=False)
    mb = trimesh.Trimesh(vertices=r['b']['vertices'], faces=r['b']['faces'], process=False)
    sp = 4.0 * abs(float(ma.volume)) / (float(ma.area) or 1.0)
    err = 100.0 * abs(abs(ma.volume) + abs(mb.volume) - abs(m.volume)) / abs(m.volume)
    pl = planarita(ma, n)
    print(f'\n[{modo}] spessore {sp:.1f}, chiusi {ma.is_watertight}/{mb.is_watertight}, '
          f'volume mancante {err:.2f}%')
    if pl:
        print(f'        fondo: {pl[1]} triangoli, area {pl[2]:.0f}, '
              f'ONDULAZIONE {pl[0]:.2f} unita  ({"PIANO" if pl[0] < 1.0 else "STORTO"})')
    else:
        print('        nessuna faccia di dietro riconoscibile')
    for l in r['log']:
        if any(k in l for k in ('NOCCIOLO', 'Nocciolo', 'ATTENZIONE', 'nocciolo')):
            print('   ·', l[:200])
    ma.export(SCR + '/nocciolo-A.stl'); mb.export(SCR + '/nocciolo-B.stl')
