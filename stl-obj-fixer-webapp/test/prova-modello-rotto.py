# Il nocciolo su un modello NON MANIFOLD.
#
# Segnalato dall'uso: su un modello il taglio a nocciolo staccava solo una
# scaglia da 1,6 mm invece del blocchetto. Il resoconto diceva
# "(nocciolo piatto non utilizzabile: modello NotManifold)": il motore vedeva
# una mesh che manifold3d non accetta e si arrendeva prima ancora di provarci,
# ripiegando sul taglio normale.
#
# Qui si rifanno gli stessi difetti a tavolino - buchi, facce girate al
# contrario, pezzetti staccati - e si controlla che adesso il nocciolo esca
# lo stesso e sia un BLOCCHETTO, non una buccia.
import sys, os
import numpy as np
import trimesh

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'ai-segmentation'))
import taglia_pro


def sfera(suddivisioni=4, raggio=50.0):
    m = trimesh.creation.icosphere(subdivisions=suddivisioni, radius=raggio)
    return np.asarray(m.vertices, dtype=np.float64), np.asarray(m.faces, dtype=np.int64)


def rompi(V, F, seme=3):
    """Gli stessi guai del modello vero: un buco, facce girate, un pezzo a parte."""
    rng = np.random.default_rng(seme)
    F = F.copy()
    # 1) buco: si tolgono venti triangoli lontani dalla zona che taglieremo
    lontane = [i for i in range(len(F)) if V[F[i]].mean(axis=0)[2] < -30][:20]
    F = np.delete(F, lontane, axis=0)
    # 2) facce girate al contrario, sparse
    giro = rng.choice(len(F), size=len(F) // 20, replace=False)
    F[giro] = F[giro][:, ::-1]
    # 3) un pezzetto staccato che galleggia dentro il modello (tipo un occhio)
    occhio = trimesh.creation.icosphere(subdivisions=2, radius=6.0)
    occhio.apply_translation([0, 0, 10])
    V2 = np.vstack([V, np.asarray(occhio.vertices)])
    F2 = np.vstack([F, np.asarray(occhio.faces) + len(V)])
    return V2, F2


def macchia(V, F, centro, raggio):
    """I triangoli attorno a un punto: la selezione a mano, in piccolo."""
    C = V[F].mean(axis=1)
    d = np.linalg.norm(C - np.asarray(centro), axis=1)
    return set(int(i) for i in np.where(d < raggio)[0])


def prova(nome, V, F):
    sel = macchia(V, F, [0, -50, 0], 18.0)
    try:
        esito = taglia_pro.taglia_sulla_selezione(
            V, F, sorted(sel), gioco=0.15,
            incastro_modo="nocciolo", profondita_nocciolo=0.5)
    except Exception as e:
        print(f"{nome}: ECCEZIONE {type(e).__name__}: {e}")
        return None
    if esito is None:
        print(f"{nome}: nessun risultato")
        return None
    log = esito.get("log", [])
    # "a" e' il pezzo staccato (il nocciolo), "b" il resto
    Va = np.asarray(esito["a"]["vertices"]); Fa = np.asarray(esito["a"]["faces"])
    ma = trimesh.Trimesh(vertices=Va, faces=Fa, process=False)
    mis = ma.bounds[1] - ma.bounds[0]
    print(f"{nome}: pezzo staccato {len(Fa)} facce, "
          f"{mis[0]:.1f}x{mis[1]:.1f}x{mis[2]:.1f} mm, "
          f"volume {ma.volume / 1000:.2f} cm3, chiuso={ma.is_watertight}")
    for r in log:
        if any(k in r for k in ("NOCCIOLO", "nocciolo", "rimesso a posto",
                                "ATTENZIONE", "non utilizzabile", "perno")):
            print("   ", r[:150])
    return {"facce": len(Fa), "spessore": float(np.min(mis)), "volume": ma.volume,
            "selezionati": len(sel)}


V, F = sfera()
print(f"sfera sana: {len(F)} triangoli, manifold =",
      taglia_pro._manifold(V, F).status().name)
sano = prova("SANA   ", V, F)

Vr, Fr = rompi(V, F)
mr = taglia_pro._manifold(Vr, Fr)
print(f"\nsfera rotta: {len(Fr)} triangoli, manifold = {mr.status().name}")
rotto = prova("ROTTA  ", Vr, Fr)

print()
ok = True
if rotto is None:
    print("ESITO: sul modello rotto il taglio non produce niente")
    ok = False
else:
    # il difetto segnalato: veniva fuori una buccia spessa quanto niente, con
    # tanti triangoli quanti la selezione. Un blocchetto vero e' spesso.
    spesso = rotto["spessore"] > 5.0
    print(f"il pezzo staccato e' spesso {rotto['spessore']:.1f} mm "
          f"(dev'essere > 5, era 1.6 sul modello vero) -> {'ok' if spesso else 'NO'}")
    ok = ok and spesso
    if sano is not None:
        simile = 0.5 < rotto["volume"] / max(sano["volume"], 1e-9) < 2.0
        print(f"volume rispetto al modello sano: "
              f"{rotto['volume'] / max(sano['volume'], 1e-9):.2f}x -> {'ok' if simile else 'NO'}")
        ok = ok and simile
print("\nRISULTATO:", "NOCCIOLO OK ANCHE SUL MODELLO ROTTO" if ok
      else "IL NOCCIOLO NON REGGE IL MODELLO ROTTO")
sys.exit(0 if ok else 1)
