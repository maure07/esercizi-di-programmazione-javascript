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
