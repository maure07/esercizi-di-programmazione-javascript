# Una testa con i CAPELLI A CIOCCHE, per provare la preselezione.
#
# Segnalato dall'uso: la divisione automatica trova gli occhi ma spacca i
# capelli in sette o otto zone. I capelli sono un blocco solo: si stampano di
# un colore e basta. Il difetto e' che la divisione taglia lungo le pieghe, e
# fra una ciocca e l'altra di pieghe ce ne sono tante - solo che sono solchi
# POCO profondi rispetto all'attaccatura dei capelli sulla fronte.
#
# Qui si costruisce quella situazione: una testa con otto ciocche saldate
# sopra (solchi leggeri fra l'una e l'altra, gradino netto sulla fronte) e due
# occhi appoggiati come corpi staccati, che nei modelli fatti dall'IA e' come
# stanno quasi sempre.
#
# QUELLO CHE QUESTO MODELLO NON RIESCE A RIPRODURRE, e va detto perche' non ci
# si perda tempo un'altra volta. Sul pezzo vero il rilevatore dei rilievi del
# companion trova gli occhi e dimentica le sopracciglia. Qui invece le
# sopracciglia le prende il motore delle PIEGHE del browser, perche' il rilievo
# costruito a tavolino ha lo spigolo netto tutto attorno, mentre quello
# scolpito da un'IA sfuma nella fronte.
#
# Misurato sul rilevatore dei rilievi, con questa testa: l'altezza del rilievo
# degli occhi sta a +1,8 volte il rumore di fondo (passa la soglia), quella
# delle sopracciglia a -3,8 (non passa a nessuna sensibilita'). La soglia e'
# calcolata su TUTTO il modello insieme: la massa di capelli, che e' tutta
# bitorzoluta, alza il livello del rumore e i dettagli fini sulla faccia liscia
# non ci arrivano piu'. Provato anche a calcolarla nel vicinato invece che su
# tutto: non basta.
#
# Si rifa' cosi':      python3 fai-testa-capelli.py modelli/testa_capelli.stl
import sys, math
import numpy as np
import trimesh

R = 40.0

def ciocca(angolo):
    """Una ciocca: un cilindro schiacciato, appoggiato sulla calotta."""
    c = trimesh.creation.cylinder(radius=6.5, height=R * 1.75, sections=24)
    c.apply_scale([1.0, 0.62, 1.0])                 # schiacciata: forma a ciocca
    c.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    c.apply_transform(trimesh.transformations.rotation_matrix(angolo, [0, 0, 1]))
    # spinta in fuori quanto basta perche' sporga dalla testa senza staccarsi
    c.apply_translation([0, 0, R * 0.42])
    return c

testa = trimesh.creation.icosphere(subdivisions=4, radius=R)
capelli = testa
for k in range(8):
    capelli = trimesh.boolean.union([capelli, ciocca(math.pi * k / 8)])
capelli = trimesh.Trimesh(vertices=capelli.vertices, faces=capelli.faces, process=True)

# LE SOPRACCIGLIA: due strisce sottili e allungate, SALDATE alla fronte.
# Sono il caso difficile, ed e' quello segnalato ("sopracciglia dimenticate"):
# non sono corpi a se' come gli occhi, sono rilievi bassi; e soprattutto sono
# LUNGHE E STRETTE, mentre i filtri del rilevatore scartano le zone poco
# compatte scambiandole per sbavature.
#
# Il rilievo dev'essere alto UGUALE dappertutto, se no non e' un sopracciglio:
# una scatola dritta appoggiata su una testa tonda sporge al centro e sprofonda
# ai lati, e allora non si sta piu' provando quello che si vuole provare.
# Quindi si prende una sfera un po' piu' grande della testa e se ne ritaglia il
# pezzetto che serve: quello che resta e' un guscio spesso 1,5 mm che segue la
# curva della fronte.
SPESSORE_SOPR = 1.5
for lato in (-1, 1):
    guscio = trimesh.creation.icosphere(subdivisions=5, radius=R + SPESSORE_SOPR)
    sagoma = trimesh.creation.box(extents=[16.0, 2 * R, 3.2])
    sagoma.apply_translation([lato * 12.0, -R, 13.5])
    s = trimesh.boolean.intersection([guscio, sagoma])
    capelli = trimesh.boolean.union([capelli, s])
capelli = trimesh.Trimesh(vertices=capelli.vertices, faces=capelli.faces, process=True)

# gli occhi: due palline appoggiate sulla faccia, NON saldate
occhi = []
for lato in (-1, 1):
    o = trimesh.creation.icosphere(subdivisions=3, radius=5.0)
    o.apply_translation([lato * 12.0, -R * 0.93, 6.0])
    occhi.append(o)

V = [np.asarray(capelli.vertices)]
F = [np.asarray(capelli.faces)]
n = len(capelli.vertices)
for o in occhi:
    V.append(np.asarray(o.vertices))
    F.append(np.asarray(o.faces) + n)
    n += len(o.vertices)

m = trimesh.Trimesh(vertices=np.vstack(V), faces=np.vstack(F), process=False)
m.export(sys.argv[1])
print(f"{len(m.faces)} triangoli, {m.body_count} corpi -> {sys.argv[1]}")
