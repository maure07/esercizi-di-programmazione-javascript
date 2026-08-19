# GUARDARE IL PEZZO, non solo misurarlo.
#
# Serve a farsi una foto di un modello (e, colorandone i triangoli, di quello
# che un motore ci ha trovato sopra) senza aprire il browser e senza installare
# motori 3D: bastano numpy, trimesh e PIL. E' una proiezione ortografica con
# z-buffer scritta a mano, una quarantina di righe.
#
# Non e' un vezzo: e' lo strumento che ha fatto scoprire, sul pezzo vero, che i
# 14 "dettagli" che l'app proponeva erano riccioli e ciuffi e non occhi e
# sopracciglia. I numeri dicevano che le zone erano piccole e compatte, e la
# cosa tornava; la foto ha detto in un colpo che erano quelle sbagliate.
#
# Uso:   python3 guarda-modello.py modello.stl cartella_dove_salvare
# oppure, da un altro script:
#        from guarda_modello import rendi
#        rendi(V, F, direzione=(0,-1,0), su=(0,0,1), colori=col).save("x.png")

import sys, numpy as np, trimesh
from PIL import Image

def rendi(V, F, direzione, su, larghezza=520, colori=None):
    n = np.asarray(direzione, float); n /= np.linalg.norm(n)
    u = np.cross(su, n); u /= np.linalg.norm(u)
    v = np.cross(n, u)
    P = np.stack([V @ u, V @ v, V @ n], axis=1)
    mn, mx = P.min(axis=0), P.max(axis=0)
    scala = (larghezza - 20) / max(mx[0]-mn[0], mx[1]-mn[1])
    W = int((mx[0]-mn[0])*scala)+20; H = int((mx[1]-mn[1])*scala)+20
    px = ((P[:,0]-mn[0])*scala+10).astype(int)
    py = (H - ((P[:,1]-mn[1])*scala+10)).astype(int)
    zb = np.full((H+1, W+1), -1e18); img = np.zeros((H+1, W+1, 3), np.uint8)
    T = V[F]
    nf = np.cross(T[:,1]-T[:,0], T[:,2]-T[:,0])
    nf /= (np.linalg.norm(nf, axis=1, keepdims=True)+1e-12)
    luce = np.clip(nf @ n, 0, 1)*0.75 + 0.25
    ordine = np.argsort(P[F].mean(axis=1)[:,2])
    for t in ordine:
        a,b,c = F[t]
        xs = [px[a],px[b],px[c]]; ys=[py[a],py[b],py[c]]
        x0,x1 = max(0,min(xs)), min(W,max(xs)); y0,y1 = max(0,min(ys)), min(H,max(ys))
        if x1<x0 or y1<y0: continue
        z = P[F[t],2].mean()
        base = np.array([210,205,200]) if colori is None else np.array(colori[t])
        col = (base*luce[t]).astype(np.uint8)
        blocco = zb[y0:y1+1, x0:x1+1]
        m = blocco < z
        blocco[m] = z
        img[y0:y1+1, x0:x1+1][m] = col
    return Image.fromarray(img)

if __name__ == "__main__":
    m = trimesh.load(sys.argv[1])
    V=np.asarray(m.vertices); F=np.asarray(m.faces)
    V = V - V.mean(axis=0)
    viste = {"fronte":( 0,-1, 0), "retro":( 0, 1, 0), "destra":( 1, 0, 0), "sinistra":(-1,0,0)}
    for nome, dirz in viste.items():
        rendi(V, F, dirz, (0,0,1)).save(f"{sys.argv[2]}/{nome}.png")
        print(nome, "fatto")
