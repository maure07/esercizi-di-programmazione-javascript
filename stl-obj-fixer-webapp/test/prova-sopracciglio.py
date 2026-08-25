# Il nocciolo su un RILIEVO APPOGGIATO, tipo un sopracciglio.
#
# Segnalato dall'uso: sullo stesso modello il nocciolo riesce sugli occhi ma
# sul sopracciglio stacca solo la buccia. Nei modelli fatti dall'IA sopracciglia
# e ciglia sono quasi sempre una scaglia a parte, appoggiata sulla fronte e non
# saldata: un corpo staccato spesso due o tre millimetri.
#
# Se il motore, per decidere quanto affondare, guarda solo il corpo su cui
# poggia la selezione, misura lo spessore della scaglia e non quello della
# testa sotto: meta' di 2 mm fa 1 mm, cioe' la buccia. Il nocciolo di un
# sopracciglio deve invece affondare NELLA FRONTE, se no non c'e' niente da
# incastrare.
#
# Qui si costruisce esattamente quella situazione e si controllano le due cose
# che contano: che il pezzo staccato sia spesso, e che il posto dove infilarlo
# venga scavato nella testa.
import sys, os
import numpy as np
import trimesh

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'ai-segmentation'))
import taglia_pro


SPESSORE_SCAGLIA = 2.2


def testa_con_sopracciglio(raggio=50.0):
    """Una testa, e appoggiata sopra una scaglia sottile che non la tocca.

    La scaglia e' una lastrina: larga e lunga come un sopracciglio, spessa due
    millimetri, messa appena fuori dalla superficie. E' un solido chiuso a se',
    esattamente come sono sopracciglia e ciglia nei modelli fatti dall'IA.
    """
    testa = trimesh.creation.icosphere(subdivisions=4, radius=raggio)
    scaglia = trimesh.creation.box(extents=[18.0, SPESSORE_SCAGLIA, 6.0])
    # piu' triangoli: una lastrina da 12 facce non e' una selezione realistica
    for _ in range(4):
        scaglia = scaglia.subdivide()
    # la si porta sulla fronte, appena staccata dalla pelle
    scaglia.apply_translation([0.0, -(raggio + SPESSORE_SCAGLIA / 2 + 0.4), 16.0])
    V = np.vstack([np.asarray(testa.vertices), np.asarray(scaglia.vertices)])
    F = np.vstack([np.asarray(testa.faces),
                   np.asarray(scaglia.faces) + len(testa.vertices)])
    return (np.asarray(V, dtype=np.float64), np.asarray(F, dtype=np.int64),
            len(testa.faces))


def macchia_sulla_scaglia(V, F, prima_faccia_scaglia):
    """La faccia esterna della scaglia: e' quello che si selezionerebbe a mano
    passando il pennello sul sopracciglio."""
    sel = set()
    for i in range(prima_faccia_scaglia, len(F)):
        c = V[F[i]].mean(axis=0)
        if c[1] < -(50.0 + 0.4 + SPESSORE_SCAGLIA * 0.75):
            sel.add(int(i))
    return sel


def prova(nome, V, F, sel, modo="nocciolo"):
    try:
        esito = taglia_pro.taglia_sulla_selezione(
            V, F, sorted(sel), gioco=0.15,
            incastro_modo=modo, profondita_nocciolo=0.5)
    except Exception as e:
        print(f"{nome}: ECCEZIONE {type(e).__name__}: {e}")
        return None
    if esito is None:
        print(f"{nome}: nessun risultato")
        return None
    log = esito.get("log", [])
    Va = np.asarray(esito["a"]["vertices"]); Fa = np.asarray(esito["a"]["faces"])
    Vb = np.asarray(esito["b"]["vertices"]); Fb = np.asarray(esito["b"]["faces"])
    ma = trimesh.Trimesh(vertices=Va, faces=Fa, process=False)
    mb = trimesh.Trimesh(vertices=Vb, faces=Fb, process=False)
    mis = ma.bounds[1] - ma.bounds[0]
    print(f"{nome}: staccato {len(Fa)} facce, {mis[0]:.1f}x{mis[1]:.1f}x{mis[2]:.1f} mm, "
          f"volume {ma.volume / 1000:.3f} cm3")
    for r in log:
        if any(k in r for k in ("NOCCIOLO", "nocciolo", "spesso", "rimesso a posto",
                                "profond", "perno", "ATTENZIONE")):
            print("   ", r[:150])
    return {"spessore": float(np.min(mis)), "volume_a": ma.volume,
            "volume_b": mb.volume, "facce": len(Fa), "log": log}


V, F, nTesta = testa_con_sopracciglio()
sel = macchia_sulla_scaglia(V, F, nTesta)
print(f"testa {nTesta} facce + scaglia {len(F) - nTesta} facce; "
      f"selezionati {len(sel)} triangoli di scaglia")
volume_testa = trimesh.creation.icosphere(subdivisions=4, radius=50.0).volume

r = prova("SOPRACCIGLIO", V, F, sel)

print()
ok = r is not None
if ok:
    # 1) il pezzo staccato dev'essere un BLOCCHETTO, non la scaglia da 2 mm
    spesso = r["spessore"] > 4.0
    print(f"pezzo staccato spesso {r['spessore']:.1f} mm "
          f"(la sola scaglia ne farebbe ~1.8) "
          "-> " + ("ok" if spesso else "NO: e' la buccia"))
    # 2) e nella testa dev'essere rimasto il posto dove infilarlo: se la sede
    #    non viene scavata, il pezzo non entra da nessuna parte
    scavato = r["volume_b"] < volume_testa
    print(f"volume del resto {r['volume_b']/1000:.1f} cm3 contro i "
          f"{volume_testa/1000:.1f} della testa intera -> "
          + ("ok, la sede e' scavata" if scavato else "NO: nessuna sede"))
    ok = spesso and scavato
print("\nRISULTATO:", "NOCCIOLO OK SUL RILIEVO APPOGGIATO" if ok
      else "SUL RILIEVO APPOGGIATO ESCE ANCORA LA BUCCIA")
sys.exit(0 if ok else 1)
