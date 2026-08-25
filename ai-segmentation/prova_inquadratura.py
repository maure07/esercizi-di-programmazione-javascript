import sys; sys.path.insert(0,"/home/user/esercizi-di-programmazione-javascript/ai-segmentation")
import numpy as np, trimesh, segmenta_ai as sa

# figura con proporzioni tipo Goku
m = trimesh.creation.box(extents=[0.8, 2.0, 0.5])
m = trimesh.util.concatenate([m, trimesh.creation.icosphere(radius=0.45).apply_translation([0,1.3,0])])
V = np.asarray(m.vertices); V = V - m.bounds.mean(axis=0)
yfov = np.pi/3
res = 1024

def copertura(dist):
    poses = sa._camera_poses(12, dist)
    fr = []
    for M in poses:
        Rm = M[:3,:3]; eye = M[:3,3]
        # porta i vertici nel sistema della camera (guarda lungo -Z)
        P = (V - eye) @ Rm
        z = -P[:,2]
        ok = z > 1e-6
        if not ok.any(): continue
        x = P[ok,0]/z[ok]/np.tan(yfov/2)
        y = P[ok,1]/z[ok]/np.tan(yfov/2)
        dentro = (np.abs(x)<=1)&(np.abs(y)<=1)
        # frazione del semilato occupata
        est = max(np.abs(x).max(), np.abs(y).max())
        fr.append((est, dentro.mean()))
    est = np.mean([f[0] for f in fr]); vis = np.mean([f[1] for f in fr])
    return est, vis

R = np.linalg.norm(V, axis=1).max()
vecchia = np.linalg.norm(m.extents)*1.1/np.tan(yfov/2)
nuova   = R/np.sin(yfov/2)*1.06
for nome, d in [("PRIMA", vecchia), ("ORA", nuova)]:
    est, vis = copertura(d)
    print(f"{nome:6s} distanza {d:5.2f} -> il modello occupa il {100*est:5.1f}% del semilato, "
          f"{100*vis:5.1f}% dei vertici dentro l'inquadratura")
    print(f"        area sull'immagine: circa {100*(est**2)*0.6:4.1f}%  ->  "
          f"punti utili su una griglia 32x32: circa {int(32*32*(est**2)*0.6)}")
