# Il nocciolo su un modello SALVATO LONTANO DALL'ORIGINE.
#
# Segnalato dall'uso e trovato col modello vero (una testa ritagliata da una
# scena piu' grande, con le coordinate fra -209 e -128 lungo la direzione di
# taglio). Il piano che sega la faccia piatta veniva costruito come un blocco
# enorme messo attorno all'ORIGINE degli assi: su un modello lontano da zero
# non lo sfiorava nemmeno, l'intersezione veniva vuota, e il nocciolo falliva
# senza dire perche' - usciva il taglio normale, cioe' la buccia.
#
# Qui si prende una sfera e la si sposta lontano: se il nocciolo dipende da
# DOVE sta il modello invece che da com'e' fatto, si vede subito.
import sys, os
import numpy as np
import trimesh

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'ai-segmentation'))
import taglia_pro


def prova(distanza):
    m = trimesh.creation.icosphere(subdivisions=4, radius=50.0)
    m.apply_translation([distanza, -distanza * 0.7, distanza * 1.3])
    V = np.asarray(m.vertices, dtype=np.float64)
    F = np.asarray(m.faces, dtype=np.int64)
    C = V[F].mean(axis=1)
    centro = V.mean(axis=0)
    # una macchia tonda su un fianco della sfera
    punta = centro + np.array([0.0, -50.0, 0.0])
    d = np.linalg.norm(C - punta, axis=1)
    sel = sorted(int(x) for x in np.where(d < 20.0)[0])
    r = taglia_pro.taglia_sulla_selezione(V, F, sel, gioco=0.15,
                                          incastro_modo="nocciolo", profondita_nocciolo=0.5)
    Va = np.asarray(r["a"]["vertices"]); Fa = np.asarray(r["a"]["faces"])
    ma = trimesh.Trimesh(vertices=Va, faces=Fa, process=False)
    fatto = any("Taglio A NOCCIOLO" in x for x in r["log"])
    mis = ma.bounds[1] - ma.bounds[0]
    print(f"a {distanza:6.0f} dall'origine: nocciolo={fatto}, "
          f"pezzo {mis[0]:.1f}x{mis[1]:.1f}x{mis[2]:.1f} mm, "
          f"{ma.volume/1000:.2f} cm3, chiuso={ma.is_watertight}")
    return {"nocciolo": fatto, "volume": ma.volume, "spessore": float(np.min(mis))}


vicino = prova(0.0)
lontano = prova(400.0)

# Il risultato non deve dipendere da dove sta il modello nello spazio: stesso
# pezzo, stesso volume. Prima, a 400 di distanza, usciva la buccia.
ok = (vicino["nocciolo"] and lontano["nocciolo"]
      and 0.9 < lontano["volume"] / max(vicino["volume"], 1e-9) < 1.1
      and lontano["spessore"] > 5.0)
print("\nRISULTATO:", "IL NOCCIOLO NON DIPENDE DALLA POSIZIONE" if ok
      else "IL NOCCIOLO CAMBIA A SECONDA DI DOVE STA IL MODELLO")
sys.exit(0 if ok else 1)
