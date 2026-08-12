"""Simula il PC dell'utente: trimesh installato ma rtree NO.
E' la trappola che ha tenuto fermo il nocciolo per giorni — qui rtree c'era,
quindi i test passavano sempre e il difetto non si vedeva."""
import sys, os, builtins, time
_vero = builtins.__import__
def _finto(nome, *a, **k):
    if nome == 'rtree' or nome.startswith('rtree.'):
        raise ImportError("No module named 'rtree'")
    return _vero(nome, *a, **k)
builtins.__import__ = _finto
for m in list(sys.modules):
    if m.startswith('rtree'):
        del sys.modules[m]
# il motore sta due cartelle sopra: niente percorsi assoluti
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'ai-segmentation'))
import numpy as np, trimesh, taglia_pro as tp
try:
    import rtree
    print('ATTENZIONE: rtree ancora importabile, la prova non vale'); sys.exit(2)
except ImportError:
    pass
m = trimesh.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modelli', 'goku_vero.stl')); m.merge_vertices()
V, F = np.asarray(m.vertices), np.asarray(m.faces)
C = V[F].mean(axis=1); N = m.face_normals
zmin, zmax = float(V[:,2].min()), float(V[:,2].max())
z0, z1 = zmin+0.30*(zmax-zmin), zmin+0.40*(zmax-zmin)
fascia = (C[:,2]>z0)&(C[:,2]<z1); xm = float(np.median(C[fascia][:,0]))
sel = np.where(fascia&(C[:,0]>xm)&((N@np.array([0.,-1.,0.]))>0.55))[0]
t = time.time()
r = tp.taglia_sulla_selezione(V, F, sel, connettore=True, gioco=0.20,
                              appiattisci='auto', incastro_modo='nocciolo')
a = trimesh.Trimesh(vertices=r['a']['vertices'], faces=r['a']['faces'], process=False)
b = trimesh.Trimesh(vertices=r['b']['vertices'], faces=r['b']['faces'], process=False)
sp = 4*abs(a.volume)/(a.area or 1)
err = 100*abs(abs(a.volume)+abs(b.volume)-abs(m.volume))/abs(m.volume)
piatto = any('FACCIA PIATTA' in l for l in r['log'])
print(f"SENZA rtree -> faccia piatta: {'SI' if piatto else 'NO'}, spessore {sp:.1f}, "
      f"chiusi {a.is_watertight}/{b.is_watertight}, volume mancante {err:.2f}%, {time.time()-t:.0f}s")
for l in r['log']:
    if any(k in l for k in ('diagnostica','NOCCIOLO','non riesco','rtree')):
        print('  ', l[:170])
ok = piatto and a.is_watertight and b.is_watertight and err < 1.0
print('ESITO:', 'OK' if ok else 'FALLITO')
sys.exit(0 if ok else 1)
