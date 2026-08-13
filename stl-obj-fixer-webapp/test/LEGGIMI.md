# Batteria di prova

Come si lancia, da dentro questa cartella:

```
bash regress.sh
```

Monta il file unico dai sorgenti (`build-artifact.js`), apre un server di
prova sulla porta 8973 e fa girare tutti i test uno per uno. Alla fine
stampa quanti sono verdi e quanti rossi.

## Cosa serve

- **node** con Playwright e un Chromium (i test aprono un browser vero e
  guardano il risultato: e' l'unico modo per accorgersi che una selezione
  prende il pezzo sbagliato).
- **il companion acceso** (`ai-segmentation/avvia.bat`, oppure
  `python3 server.py`) per i test del taglio: senza, il taglio non parte e
  quei test falliscono senza che ci sia niente di rotto nell'app. E'
  l'inciampo piu' frequente.

## Il modello grande

Otto test lavorano su `modelli/goku_vero.stl`, un personaggio da 395.000
triangoli. Non e' nel repository perche' pesa 19 MB. Senza quel file quei
test si **saltano da soli** scrivendolo a schermo, invece di fallire.

Serve perche' i difetti veri saltano fuori solo sui modelli veri: su un cubo
di dodici triangoli il taglio a nocciolo riesce sempre. Se ne hai uno di
dimensioni simili, mettilo li' con quel nome e la batteria lo usa.

## Come si misura l'arrotondamento del bordo

`e2e-test-arrotonda.js` non si limita a guardare se la selezione cambia:
prende una macchia pulita, la **sporca di proposito** con un dado a seme
fisso (`window.__sporcaSelezione`) e misura poi quanto il contorno torna
disteso. Il numero e' `perimetro / perimetro del cerchio di pari area`:
vale 1 per un cerchio e sale quando il bordo serpeggia.

Serve perche' il conteggio dei "dentini" da un triangolo, che si usava
prima, non vedeva il difetto di cui si parlava: le **gobbe larghe**
lasciavano il bordo bitorzoluto pur avendo zero dentini.

## `tolti/`

Test di comandi che sono stati rimossi dal pannello perche' facevano
doppione. Non sono stati cancellati: i motori dietro ci sono ancora, e se un
giorno tornasse un modo per richiamarli quei test tornano buoni cosi' come
sono. Il perche' di ognuno e' scritto in `tolti/LEGGIMI.txt`.

## Le prove in Python

`prova-*.py` provano il motore del taglio senza passare dal browser: sono
piu' rapide quando si sta lavorando sulla geometria. `prova-senza-rtree.py`
in particolare finge un PC **senza la libreria rtree**, che e' opzionale e
sul computer di chi usa l'app non c'era: quella mancanza aveva tenuto fermo
il taglio a nocciolo per giorni mentre qui i test passavano tutti.
