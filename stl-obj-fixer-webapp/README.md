# Correggi & Segmenta STL/OBJ

Web app gratuita, senza installazione, per preparare alla stampa 3D i modelli
generati da IA (es. per Funko Pop personalizzati): ripara la mesh, la rende
solida (chiude i buchi tipici degli export IA) e la **divide automaticamente
in parti stampabili separate** (per colore/materiale) così puoi stampare ogni
parte in PLA singolo colore senza bisogno di AMS/multi-color, risparmiando
filamento e tempo.

Funziona interamente **nel browser del telefono**: nessun file lascia il tuo
dispositivo, non serve un PC, non serve installare nulla.

## Come si usa (da telefono)

1. Apri `index.html` (vedi sotto come ospitarlo per averne un link).
2. Tocca **"Apri modello"** e scegli il file:
   - un `.stl`, oppure
   - un `.obj` **+** il suo `.mtl` (selezionali insieme nel selettore file) —
     consigliato, perché è così che l'app rileva i colori/materiali e riesce
     a separare le parti (cappello, capelli, occhi, sopracciglia, ecc.).
3. L'app ripara la mesh, la chiude e la segmenta automaticamente. Nel
   pannello sotto al modello 3D trovi l'elenco delle parti trovate, con
   colore, dimensioni, peso stimato in PLA e stato ("solido chiuso" o no).
4. Rinomina le parti se vuoi, escludi quelle che non ti servono, poi tocca
   **"Scarica tutte le parti (ZIP)"** (oppure scarica un singolo STL per
   parte). Nello ZIP trovi un file `.stl` per ogni parte, pronto per lo
   slicer della tua Kobra X.

Nella cartella `esempio/` c'è un piccolo modello di prova (`funko_esempio.obj`
+ `.mtl`) con "testa" e "cappello" già colorati diversamente, utile per
provare subito l'app prima di caricare un tuo modello vero.

## Come funziona la segmentazione automatica

Non esiste un'IA "pronta all'uso" in grado di riconoscere semanticamente
cappello/capelli/occhi su un modello 3D qualsiasi: quella è ricerca allo stato
dell'arte, non un componente disponibile da integrare in un'app. Questo
strumento usa invece un approccio affidabile e verificabile:

- **Se il modello ha colori/materiali diversi per parte** (frequente nei
  modelli generati da tool IA image-to-3D, sia come materiali OBJ sia come
  colore-per-vertice): ogni colore/materiale diventa una parte separata,
  **anche se nel file la mesh è tutta saldata in un unico blocco continuo** —
  il taglio avviene esattamente al confine del colore.
- **Se il modello non ha nessuna informazione di colore** (es. un STL puro):
  l'app può separare solo pezzi già geometricamente **disgiunti** nel file
  (shell separate che si toccano/si sovrappongono senza essere saldate). Un
  singolo blocco fuso monocromatico non può essere diviso in automatico: te
  lo segnala con un avviso. In quel caso serve una versione colorata dello
  stesso modello (spesso scaricabile dallo stesso generatore IA) oppure un
  taglio manuale con un altro strumento.

## Cosa fa la riparazione

- Salda i vertici duplicati (cuce le cuciture separate dall'export).
- Rimuove i triangoli degeneri.
- Rende coerente l'orientamento delle normali (necessario per una stampa
  corretta) su ogni parte.
- Individua i bordi aperti (buchi) e li richiude con una toppa triangolata:
  è la parte di "solidificazione" — trasforma una shell aperta (tipica dei
  modelli IA, non stampabile) in un solido chiuso ("watertight").

Non fa invece offset/spessore-pareti automatico: se un pezzo isolato risulta
davvero a spessore zero su tutta la superficie (raro, diverso dal caso "shell
con qualche buco"), questo strumento non lo risolve.

## Come ospitarla per avere un link fisso (facoltativo)

Il modo più semplice, fattibile interamente da telefono via browser:

1. Vai sul repository GitHub → **Settings → Pages**.
2. In "Build and deployment" scegli **Deploy from a branch**, branch
   `main`/`master` (o quello in cui hai questa cartella), cartella `/root`.
3. GitHub ti darà un URL tipo `https://<utente>.github.io/<repo>/stl-obj-fixer-webapp/`
   da salvare tra i preferiti sul telefono: da lì in poi è la tua "app"
   sempre pronta, senza reinstallare nulla.

In alternativa puoi aprire `index.html` anche direttamente dal file system
del telefono (senza hosting), ma un link web è più comodo da usare ogni
giorno.

## Note tecniche

- Nessuna dipendenza da installare: `three.js` è incluso in `vendor/`,
  parser STL/OBJ/MTL, motore di riparazione mesh, segmentazione ed export
  ZIP sono scritti da zero in JavaScript puro (vedi `js/`).
- `js/geometry-core.js` è testabile in isolamento con Node (nessuna API
  browser), utile se vuoi estendere/validare la logica di riparazione.
