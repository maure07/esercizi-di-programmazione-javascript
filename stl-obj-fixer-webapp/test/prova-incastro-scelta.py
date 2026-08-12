"""
Prova la manopola "Come si uniscono i pezzi" sul Goku vero.

Due selezioni, quattro modi ciascuna:
  - MACCHIA sulla coscia (quella che in automatico diventa un nocciolo)
  - ANELLO attorno alla coscia (quella che in automatico prende il perno)

Quello che si vuole vedere:
  auto      -> macchia = nocciolo, anello = perno            (come prima)
  nocciolo  -> nocciolo in tutti e due i casi, se riesce      (l'ordine vince)
  perno     -> mai nocciolo, nemmeno sulla macchia
  niente    -> nessun aggancio, ma i due pezzi restano chiusi
"""
import sys, time
sys.path.insert(0, '../../ai-segmentation')
import numpy as np
import trimesh
import taglia_pro

SCR = '/home/user/esercizi-di-programmazione-javascript/stl-obj-fixer-webapp/test/modelli'
m = trimesh.load(SCR + '/goku_vero.stl')
m.merge_vertices()
V, F = np.asarray(m.vertices), np.asarray(m.faces)
print('Goku:', len(F), 'triangoli, altezza', round(float(m.extents[2]), 1))

C = V[F].mean(axis=1)
N = m.face_normals

zmin, zmax = float(V[:, 2].min()), float(V[:, 2].max())
# coscia destra: fascia in quota, meta' del modello in x
z0, z1 = zmin + 0.30 * (zmax - zmin), zmin + 0.40 * (zmax - zmin)
fascia = (C[:, 2] > z0) & (C[:, 2] < z1)
xm = float(np.median(C[fascia][:, 0]))

# MACCHIA: solo i triangoli della fascia che guardano in avanti (verso -y o +y,
# a seconda di com'e' orientato il modello) -> selezione tutta da un lato
verso = np.array([0.0, -1.0, 0.0])
macchia = np.where(fascia & (C[:, 0] > xm) & (N @ verso > 0.55))[0]
# ANELLO: tutta la fascia da un lato, senza filtro di normale -> avvolge
anello = np.where(fascia & (C[:, 0] > xm))[0]

for nome, sel in (('MACCHIA sulla coscia', macchia), ('ANELLO sulla coscia', anello)):
    print(f'\n{"="*70}\n{nome}: {len(sel)} triangoli')
    for modo in ('auto', 'nocciolo', 'perno', 'niente'):
        t = time.time()
        try:
            r = taglia_pro.taglia_sulla_selezione(
                V, F, sel, connettore=True, gioco=0.20,
                appiattisci='auto', incastro_modo=modo)
        except Exception as e:
            print(f'  [{modo:9s}] FALLITO: {e}')
            continue
        ma = trimesh.Trimesh(vertices=r['a']['vertices'], faces=r['a']['faces'], process=False)
        mb = trimesh.Trimesh(vertices=r['b']['vertices'], faces=r['b']['faces'], process=False)
        sp = 4.0 * abs(float(ma.volume)) / (float(ma.area) or 1.0)
        noc = any('Nocciolo accettato' in l for l in r['log'])
        perno = any('Connettore:' in l for l in r['log'])
        err = 100.0 * abs(abs(ma.volume) + abs(mb.volume) - abs(m.volume)) / abs(m.volume)
        print(f'  [{modo:9s}] nocciolo={"SI" if noc else "no":2s} perno={"SI" if perno else "no":2s} '
              f'spessore={sp:6.1f} chiusi={ma.is_watertight}/{mb.is_watertight} '
              f'errore_volume={err:.2f}%  ({time.time()-t:.0f}s)')
        for l in r['log']:
            if any(k in l for k in ('NOCCIOLO', 'Nocciolo', 'aggancio', 'perno', 'Connettore',
                                    'richiesto', 'buccia')):
                print('        ·', l)
