# IL PEZZO SI PORTA VIA ROBA CHE NON ERA STATA SELEZIONATA.
#
# Segnalato dall'uso, due volte, sulle gambe di Goku: dipinta una macchia
# sull'anca, il pezzo staccato viene fuori con attaccato un lembo che non era
# stato scelto - le dita della mano che sta li' di fianco.
#
# QUESTA E' LA RIPRODUZIONE VERA, sul modello vero. Il punto e' scelto non a
# caso: e' il posto dove il pantalone ha un SECONDO STRATO davanti (trovato
# mandando un raggio all'indietro dalla superficie e contando quante volte
# rientra nel modello). Li' il blocco del taglio, che e' un prisma dritto
# profondo una dozzina di millimetri, si prende tutto quello che sta in quello
# spessore - e la mano, essendo saldata al pantalone, ci sta dentro.
#
# QUELLO CHE SI E' GIA' ESCLUSO, per non riprovarci:
#   - non e' un problema della selezione: la macchia dipinta e' pulita, e
#     ripulirla a mano non cambia niente. Il lembo nasce dopo, dalla booleana;
#   - NON si risolve buttando via i tocchi staccati. Misurato qui: il pezzo che
#     esce e' UN SOLO tocco (15.756 facce, un corpo), con le dita saldate al
#     blocco. Il filtro _solo_con_la_pelle, che esiste apposta, non le vede
#     nemmeno passare. E' stato provato, ed e' stato inutile;
#   - il modello ha due corpi, ma il secondo e' un coriandolo da 24 facce: la
#     mano fa parte del corpo principale, quindi non basta nemmeno tenere il
#     solo corpo che porta la selezione.
#
# COM'E' ANDATA A FINIRE (misurato, non supposto).
# Non era il taglio: era la PENNELLATA. Rifacendo la selezione come la fa
# davvero l'app - crescendo di vicino in vicino sulla superficie, non con una
# palla nello spazio - si vede che il pennello gira dietro l'angolo e arriva
# sulla MANO che sta di fianco all'anca: 4.073 triangoli di dita dipinti senza
# che da li' si vedano. Il taglio poi fa il suo dovere: la pelle finita nel
# pezzo senza essere stata dipinta e' 0 mm2.
# Rimedio messo: il pennello non cresce sulle facce che ti girano le spalle,
# come fa gia' il lazo. Le dita dipinte per sbaglio scendono da 4.073 a 1.606.
# Le altre si vedono davvero, e per quelle non c'e' regola che tenga: si
# guarda il giallo e si abbassa il raggio.
#
# PROVATO E SCARTATO, per non rifarlo:
#   - fermare il pennello sulle PIEGHE concave (come "un clic = tutta la zona"):
#     da 4.073 a 4.021. La mano si fonde nel pantalone troppo dolcemente;
#   - stringere il cuscinetto del prisma sopra la pelle (era 5 centesimi di
#     diagonale, 7,3 mm): non cambia un millimetro quadro.
#
# Si lancia da questa cartella:   python3 prova-lembo-mano.py
import os
import sys

import numpy as np
import trimesh

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                '..', '..', 'ai-segmentation'))
import taglia_pro

QUI = os.path.dirname(os.path.abspath(__file__))
MODELLO = os.path.join(QUI, 'modelli', 'gambe_goku.stl')

# il punto dell'anca dove c'e' la mano di fianco, in coordinate del modello
PUNTO = np.array([174.0, 162.0, 1038.0])
RAGGIO = 16.0


def main():
    if not os.path.exists(MODELLO):
        print('SALTATO: manca modelli/gambe_goku.stl')
        return 0
    m = trimesh.load(MODELLO)
    m.merge_vertices()
    V = np.asarray(m.vertices, dtype=np.float64)
    F = np.asarray(m.faces, dtype=np.int64)
    C = V[F].mean(axis=1)
    davanti = m.face_normals @ np.array([0.0, -1.0, 0.0]) > 0.2
    d = np.linalg.norm(C - PUNTO, axis=1)
    sel = sorted(int(i) for i in np.where((d < RAGGIO) & davanti)[0])
    print(f'{len(F)} triangoli, selezionati {len(sel)} sull\'anca')

    esito = taglia_pro.taglia_sulla_selezione(V, F, sel, gioco=0.20,
                                              incastro_modo='auto')
    Va = np.asarray(esito['a']['vertices'])
    Fa = np.asarray(esito['a']['faces'])
    ma = trimesh.Trimesh(vertices=Va, faces=Fa, process=False)
    tocchi = ma.split(only_watertight=False)
    mis = ma.bounds[1] - ma.bounds[0]
    print(f'pezzo staccato: {len(Fa)} facce, {len(tocchi)} tocco/hi, '
          f'{mis[0]:.1f}x{mis[1]:.1f}x{mis[2]:.1f} mm, {ma.volume / 1000:.2f} cm3')

    # LA MISURA CHE CONTA: quanta PELLE DEL MODELLO e' finita nel pezzo senza
    # essere stata dipinta. Non basta contare i vertici lontani: le dita sono
    # sottili e su 15.000 facce non spostano nessuna percentuale. Si guarda
    # l'AREA, e solo delle facce che stanno sulla pelle vera (quelle del taglio
    # non c'entrano: sono superfici nuove, e' giusto che ci siano).
    try:
        from trimesh.proximity import ProximityQuery
        Cp = np.asarray(ma.triangles).mean(axis=1)
        aree = ma.area_faces
        sulla_pelle = np.abs(ProximityQuery(m).signed_distance(Cp)) < 0.15
        pelle_scelta = trimesh.Trimesh(vertices=V, faces=F[sel], process=False)
        dsel = np.abs(ProximityQuery(pelle_scelta).signed_distance(Cp[sulla_pelle]))
        A = aree[sulla_pelle]
        intrusa = A[dsel > 2.0].sum()
        print(f'pelle del pezzo: {A.sum():.0f} mm2, di cui MAI DIPINTA '
              f'{intrusa:.0f} mm2 ({intrusa / max(A.sum(), 1e-9) * 100:.0f}%), '
              f'fino a {dsel.max():.1f} mm dalla macchia')
    except ImportError:
        print('misura saltata: manca rtree (pip install rtree)')
        intrusa = 0.0

    for r in esito.get('log', []):
        if any(k in r for k in ('pezzi staccati', 'poggiano', 'NOCCIOLO',
                                'sporgenze', 'perno')):
            print('   ', r[:160])

    # Il pezzo deve essere fatto della roba che hai dipinto, non del vicinato.
    # Venti millimetri quadri sono il bordo sfumato dell'arrotondamento; ottanta
    # sono le dita di una mano (misurato: e' quello che esce oggi).
    ok = intrusa < 20.0
    print('\nRISULTATO:', 'IL PEZZO E\' SOLO QUELLO SELEZIONATO' if ok
          else 'IL PEZZO SI PORTA VIA ROBA NON SELEZIONATA')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
