# Come si lavora su questo progetto

## I test si fanno con il contagocce

Chiesto esplicitamente, e vale da adesso in poi: **eseguire meno test possibile.**
Ogni giro di test brucia contesto, e la maggior parte di quei giri non ha mai
trovato niente.

Regole, in ordine:

1. **Mai la batteria completa** (`test/regress.sh`) di propria iniziativa. Solo se
   viene chiesta.
2. **Un test si lancia per riprodurre un difetto segnalato**, prima di toccare il
   codice, e poi una volta sola per far vedere che è passato. Fine. È così che sono
   usciti i due difetti dei tagli: il test ha mostrato la causa vera al primo colpo.
3. **Non si rilancia un test per "confermare"** qualcosa che è già passato, e non si
   rilanciano i test vicini "per sicurezza" dopo una modifica che non li tocca.
4. **Niente sweep di parametri**: provare dieci soglie una dopo l'altra costa più di
   quanto renda. Si misura una volta la grandezza che conta e si ragiona su quella.
5. Prima di scrivere un modello di prova a tavolino, **chiedere il pezzo vero**. Il
   modello sintetico si comporta diversamente da quello scolpito da un'IA — è già
   costato due volte (vedi il commento in `test/fai-testa-capelli.py`).

## Occhi e sopracciglia: cosa si è già misurato

Sul pezzo vero (una testa Funko da 313.000 triangoli, mandata dall'uso) —
misurato, non supposto:

- **le sopracciglia non sporgono.** Lo stacco rispetto alla fronte liscia è di
  **0,05 mm**. Quello che si vede è il loro *contorno*. Un rilevatore di rilievi
  non può trovarle: non c'è niente da trovare, e alzare la sensibilità non serve;
- il "rumore di fondo" con cui il rilevatore decide vale **1,24 mm**, e lo
  fissano i riccioli. Gli occhi arrivano a 1,8 volte, i riccioli a 2,1: la soglia
  più bassa che si può chiedere oggi è 2,2. Ecco perché non trova quasi niente;
- calcolare quella soglia **nel vicinato** invece che su tutto non basta: i
  riccioli pendono davanti alla fronte, quindi anche una finestra piccola attorno
  a un sopracciglio pesca dentro i capelli;
- a prenderli è invece il motore delle **pieghe**, abbassandogli le soglie
  (`creasePercentile` 0,35 · `minCreaseAngleDeg` 2 · `minRegionAreaFrac` 0,0002):
  così vengono fuori tutti e due gli occhi, tutte e due le sopracciglia e il naso.
  **Quello che resta da risolvere** è distinguerli dai riccioli, che con quelle
  soglie escono anche loro e sono altrettanto piccoli e compatti. Provato a
  sceglierli per compattezza: non basta, un ricciolo annodato è compatto quanto
  un occhio.

`test/guarda-modello.py` fa la foto di un modello colorandone i triangoli: è
così che si è visto che i "dettagli" proposti erano riccioli. **Guardare, non
solo misurare.**

## Chi legge

Chi usa questo programma è un tecnico della stampa 3D, non un programmatore.
**Interfaccia, messaggi, commenti nel codice e risposte: tutto in italiano.**
I messaggi d'errore devono dire cosa fare, non cosa è andato storto.

## Le due metà devono combaciare

`stl-obj-fixer-webapp/js/app.js` (`TAGLIA_PRO_VERSIONE_ATTESA`) e
`ai-segmentation/taglia_pro.py` (`VERSIONE`) si alzano **insieme**, e solo quando si
tocca il motore del taglio. `test/build-artifact.js` si rifiuta di montare il file
unico se non combaciano.

## Cosa non si tocca

- **Il perno sui pezzi sottili**: se il pezzo staccato è troppo sottile per reggerlo,
  niente perno — i due pezzi si incollano. Deciso così, va lasciato com'è.
- **La cartella `venv`** non si copia mai da un computer all'altro: dentro ci sono
  percorsi assoluti. `install_base.bat` se ne accorge da solo e la rifà.
