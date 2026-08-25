# Punto sicuro a cui tornare

Questo file serve a una cosa sola: sapere **a quale versione tornare** se una
modifica successiva rompe qualcosa.

## Il punto

- **commit**: `d46cf2f`
- **ramo**: `claude/3d-model-segmentation-app-fjcmds`
- **versione**: app `pannello-sobrio-27`, cartella `ai-segmentation`
  `pannello-sobrio-27`

Cosa c'era di funzionante a quel punto: taglio a nocciolo con la faccia
piatta e il contorno liscio, sede ricavata dal pezzo (niente materiale che
sparisce), raggi calcolati senza la libreria `rtree`, cursore della
profondita' del nocciolo, arrotondamento della selezione, ridimensionamento
X/Y/Z, interfaccia scura a tre colonne con i dati della mesh a sinistra.

## Come si torna indietro

Da dentro la cartella del progetto:

```
git checkout d46cf2f -- stl-obj-fixer-webapp ai-segmentation
```

Questo riporta indietro **solo i file dell'app**, lasciando stare il resto e
senza cancellare niente della cronologia. Poi si rimonta il file unico:

```
cd stl-obj-fixer-webapp/test && node build-artifact.js
```

Se invece serve tornare indietro con tutto il progetto:

```
git revert --no-commit d46cf2f..HEAD && git commit
```

Anche questo non cancella niente: aggiunge un commit che disfa, e si puo'
disfare a sua volta.

## Perche' non c'e' un'etichetta git

Le etichette (`git tag`) qui non si possono spedire al server: il tentativo
viene rifiutato. Percio' il punto di ritorno e' scritto qui, in un file che
viaggia col progetto.
