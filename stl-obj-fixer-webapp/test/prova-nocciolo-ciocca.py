"""La buccia vera: la ciocca appoggiata sulla testa. E' il caso per cui il
nocciolo esiste. Controlla che l'automatico continui a farlo scattare anche
dopo il cambio di profondita', e che i quattro modi diano quel che promettono."""
import sys
import os
sys.path.insert(0, '../../ai-segmentation')
import numpy as np, trimesh, taglia_pro

SCR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modelli')
m = trimesh.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modelli') + '/ciocca_su_testa.stl'); m.merge_vertices()
V, F = np.asarray(m.vertices), np.asarray(m.faces)
C = V[F].mean(axis=1)
print('ciocca_su_testa:', len(F), 'triangoli, ingombro', np.round(m.extents, 1).tolist())

# la ciocca sta in alto: prendo i triangoli sopra la testa, che e' la macchia
# sottile classica
z = C[:, 2]
sel = np.where(z > np.percentile(z, 82))[0]
print('selezione:', len(sel), 'triangoli')

ok = True
for modo in ('auto', 'nocciolo', 'perno', 'niente'):
    try:
        r = taglia_pro.taglia_sulla_selezione(V, F, sel, connettore=True, gioco=0.20,
                                              appiattisci='auto', incastro_modo=modo)
    except Exception as e:
        print(f'  [{modo:9s}] FALLITO: {e}'); ok = False; continue
    ma = trimesh.Trimesh(vertices=r['a']['vertices'], faces=r['a']['faces'], process=False)
    mb = trimesh.Trimesh(vertices=r['b']['vertices'], faces=r['b']['faces'], process=False)
    noc = any('Taglio A NOCCIOLO' in l for l in r['log'])
    perno = any('Connettore:' in l for l in r['log'])
    sp = 4.0 * abs(float(ma.volume)) / (float(ma.area) or 1.0)
    err = 100.0 * abs(abs(ma.volume) + abs(mb.volume) - abs(m.volume)) / abs(m.volume)
    print(f'  [{modo:9s}] nocciolo={"SI" if noc else "no":2s} perno={"SI" if perno else "no":2s} '
          f'spessore={sp:6.2f} chiusi={ma.is_watertight}/{mb.is_watertight} err_vol={err:.2f}%')
    for l in r['log']:
        if any(k in l for k in ('NOCCIOLO', 'Nocciolo', 'ATTENZIONE', 'aggancio', 'buccia')):
            print('        ·', l)
    # quel che ci si aspetta da ogni modo
    if modo == 'perno' and noc:
        print('        !! ERRORE: modo "perno" ma ha fatto il nocciolo'); ok = False
    if modo == 'niente' and perno:
        print('        !! ERRORE: modo "niente" ma ha messo il perno'); ok = False
    if not (ma.is_watertight and mb.is_watertight):
        print('        !! ERRORE: pezzi non chiusi'); ok = False
    if err > 1.0:
        print('        !! ERRORE: volume perso/aggiunto'); ok = False
print('ESITO:', 'OK' if ok else 'FALLITO')
sys.exit(0 if ok else 1)
