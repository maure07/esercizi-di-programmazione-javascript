# Correggi & Segmenta — piano completo per ricostruire l'applicazione

Questo documento serve come **prompt di partenza** per far ricostruire l'app da zero.
Contiene: cosa deve fare, com'è fatta, gli algoritmi difficili, e soprattutto
**l'elenco degli errori già commessi e pagati**, con la causa vera e la correzione.
Quella lista è la parte più preziosa: senza, si rifanno gli stessi sbagli uno per uno.

Scrivi tutto — interfaccia, commenti nel codice, messaggi di errore — **in italiano**.
L'utente non è un programmatore: è un tecnico di stampa 3D.

---

## 1. Cosa deve fare

Un modello 3D generato da **Meshy** (STL/OBJ, tipicamente 300–400 mila triangoli,
colorato o no) va stampato su una **Anycubic Kobra X**: ugello 0,4 mm, strato 0,2 mm,
PLA, **una bobina alla volta, senza AMS**.

Quindi il modello va **diviso in pezzi**, dove ogni pezzo è di **un colore solo** e
sta nel volume di stampa. I pezzi devono:

- essere **solidi chiusi** (watertight), altrimenti lo slicer non li accetta;
- **combaciare esattamente** dove sono stati tagliati;
- avere un **perno quadrato** su un pezzo e il **foro corrispondente** sull'altro,
  con gioco di accoppiamento, così si incastrano e si allineano da soli.

L'utente deve poter scegliere **a mano** dove tagliare: la divisione automatica non
azzecca quasi mai i pezzi che servono davvero (una mano, una ciocca di capelli,
una cintura).

---

## 2. Architettura: due pezzi

### a) La web app — **un solo file HTML**

Deve funzionare aprendo un file da desktop (`file:///C:/Users/.../Correggi e Segmenta.html`),
senza server, senza installazione, senza connessione. Tutto dentro: three.js, CSS, JS.

In sviluppo si lavora su file separati e si costruisce il file unico con uno script
`build-artifact.js` che incolla dentro `index.html` i vari `js/*.js` e `vendor/three.min.js`.
**Non usare moduli ES, import, bundler, npm run**: solo `<script>` concatenati che
espongono oggetti globali.

### b) Il companion — Python locale sul PC

Un piccolo server Flask su `127.0.0.1:8760` che la pagina chiama in `fetch`.
Serve perché le operazioni booleane esatte in JavaScript non esistono.
Si avvia con un `avvia.bat`; l'utente lo lascia aperto in una finestra nera.

Dipendenze: `numpy`, `trimesh`, `manifold3d`, `flask`. Le booleane esatte le fa
**manifold3d** (lo stesso tipo di motore delle booleane "exact" di Blender/OpenSCAD):
garantisce risultati manifold per costruzione.

**Il companion deve avere un marcatore di versione** (`VERSIONE = "..."` in
`taglia_pro.py`, esposto da `/health`) e la pagina deve avere la stessa stringa e
**avvisare se non coincidono**. Motivo: l'utente lascerà aperta una finestra nera
vecchia e passerete ore a inseguire bug già corretti.
**Scrivi la versione anche sotto al titolo dell'app**, visibile: da uno screenshot
si deve capire subito quale build sta girando.

---

## 3. Convenzioni non negoziabili

| Regola | Perché |
|---|---|
| **Asse verticale = Z**, non Y | Gli STL nascono per la stampa 3D, dove Z è l'altezza. Con l'orbita Y-up di three.js il modello appare sdraiato e le viste numeriche mostrano il taglio sbagliato. |
| Tutto in italiano | L'utente legge i messaggi e i log. |
| Commenti che spiegano **perché**, non cosa | Il codice è pieno di scelte contro-intuitive: senza il perché, il primo che passa le "semplifica" e riporta i bug. |
| Ogni operazione scrive un **log leggibile** sul pezzo | È l'unico modo di capire cosa è successo quando l'utente manda una foto. |
| Nessun ripiego silenzioso | Se un algoritmo fallisce e ne parte un altro, **dillo con un avviso e col motivo**. |

---

## 4. La web app: moduli e flusso

Circa 8.700 righe in tutto.

| File | Righe | Responsabilità |
|---|---|---|
| `index.html` | ~840 | struttura, CSS, tutti i pannelli |
| `js/parsers.js` | ~240 | lettura STL binario/ASCII, OBJ, MTL |
| `js/geometry-core.js` | ~1160 | `MeshCore`: saldatura vertici, mappa spigoli, riparazione, statistiche, scala |
| `js/segmentation.js` | ~980 | `Segmentation.buildParts`: divisione per colore (k-means), per forma (crescita di regioni sui solchi), combinata, o **nessuna** |
| `js/voxel.js` | ~510 | `Voxel`: ricostruzione solida a voxel per i casi disperati |
| `js/texture.js` | ~140 | campionamento colore da texture PNG |
| `js/export.js` | ~160 | esportazione STL per pezzo, ZIP, progetto |
| `js/viewer.js` | ~850 | visualizzatore three.js: orbita Z-up, selezione, **identificazione triangoli via GPU** |
| `js/app.js` | ~3800 | orchestrazione, tutti gli strumenti, chiamate al companion |

### Flusso a passi

1. **Apri modello** → analisi (triangoli, buchi, dimensioni, scala reale in cm)
2. **Riparazione** (in pagina o "Riparazione PRO" sul companion)
3. **Segmentazione**: automatica (colore / forma / combinata) **oppure "✋ Salta: taglio tutto a mano io"**
   che tiene il modello come pezzo unico e apre subito gli strumenti manuali.
   *Non obbligare a passare dalla segmentazione automatica: quasi mai produce i pezzi voluti.*
4. **Ritaglio manuale** e tagli
5. **Stampa**: riepilogo bobine, vista esplosa, appoggio sul piano, export

---

## 5. Gli strumenti di selezione

### Pennello
Trascini sul modello e dipingi di giallo i triangoli. Raggio regolabile, "Rimuovi" fa da gomma.

### "Un clic = tutta la zona" (selezione magica)
Dal punto toccato la selezione cresce sulla superficie e **si ferma sulle pieghe concave**.
Implementata come Dijkstra sul grafo delle facce, dove il costo è la **profondità di valle**
(concavità) e si tiene il massimo lungo il cammino.

Due tarature imparate a caro prezzo:
- La soglia va calcolata sulla **mediana della concavità del modello**, non su un numero fisso:
  così funziona uguale su mesh fitte o rade.
- Serve un **raggio morbido**: oltre una certa distanza dal punto cliccato si somma un costo
  che cresce col quadrato dell'eccesso. Senza, su una superficie liscia senza pieghe la
  selezione cresce fino a mezzo modello. Il raggio è stretto se il pezzo è grande quanto
  tutto il modello (blocco composito), largo se il pezzo è già una zona isolata.

### Lazo
Metti punti attorno alla zona, il cappio si chiude, la zona dentro viene selezionata.
**È lo strumento più difficile: leggi il capitolo 7.**

### Taglio dritto (piano)
Un piano rosso orientabile liberamente (inclina/gira, posizione), per fette nette.

---

## 6. Il motore di taglio (`taglia_pro.py`, ~1350 righe)

È il cuore. Funzione principale:
`taglia_sulla_selezione(vertices, faces, selezione, connettore, gioco, lato, profondita, scala_connettore, appiattisci)`

### L'idea

Non usare superfici esterne (piani, scatole, teli) per tagliare: **sbordano** e tranciano
roba non selezionata. Invece:

1. Prendi i triangoli selezionati **così come sono**.
2. Trova l'**anello di spigoli** dove la selezione confina col resto.
3. **Chiudi quell'anello con un tappo**, e usa lo **stesso tappo girato al rovescio** per
   chiudere il pezzo che resta.

Risultato: il taglio corre esattamente dove finisce la selezione, e i due pezzi combaciano
perché condividono la stessa superficie di taglio.

### I passi, in ordine

1. **Saldatura vertici** — solo se serve (più del 20% di spigoli orfani) e solo se non
   produce facce degeneri. `merge_vertices()` di trimesh su una mesh già saldata crea
   triangoli di area nulla e apre il pezzo.
2. **Pulizia morfologica del contorno**, ripetuta 3 volte:
   - togli i triangoli selezionati attaccati al resto da **un solo lato** (linguette);
   - prendi i triangoli non selezionati circondati **su tre lati su tre** (intaccature).
   *Con "due lati" invece di tre la regola contagia tutta la mesh: su una superficie chiusa
   quasi ogni triangolo finisce per averne due selezionati.*
3. **Scioglimento dei pizzichi** — vertici di bordo con grado ≠ 2 (la selezione si tocca da
   sola): si aggiungono tutte le facce attorno finché il grado torna 2. Senza, nessun tappo
   è possibile.
4. **Raggruppamento degli spigoli di bordo** con **union-find**, non con incatenamento
   ordinato: bastava un vertice con due diramazioni per spezzare l'anello in venti frammenti.
   Uno spigolo è di confine se la selezione lo percorre in un verso e un triangolo **non**
   selezionato nell'altro (il controllo esclude i bordi aperti del modello).
5. **Levigatura del contorno** (vedi sotto)
6. **Tappo** (vedi sotto)
7. **Connettore** perno+foro con manifold3d

### Levigatura del contorno

Il taglio corre lungo gli spigoli dei triangoli, quindi il bordo esce a scalini. Si rilassa
l'anello, ma con tre accorgimenti che sono tutti necessari:

- **Passa-alto, non laplaciano semplice**: si calcola lo spostamento laplaciano, poi si
  sottrae la sua media sui vicini. Su una curva regolare i vicini spingono tutti nello stesso
  verso, la media è uguale allo spostamento e non resta nulla → la curva **non si stringe**.
  Su una scalinatura la media si annulla e lo spostamento resta intero → i dentini vanno via.
  *(Il laplaciano semplice accartoccia l'anello; Taubin l'ho provato e collassava.)*
- **Scivola sulla pelle**: ogni spostamento viene proiettato sul piano tangente alla
  superficie. Senza, il contorno raddrizzandosi affonda nella parete e assottiglia il pezzo
  (misurato: **2,3% di volume perso** su un cilindro rado; con la proiezione: **0,000%**).
- **Tetto locale allo spostamento**: 1,5 volte lo spigolo più corto dei due vicini
  sull'anello, **e mai più della distanza dal vertice più vicino con cui condivide un
  triangolo**, e comunque mai più dello 0,5% della diagonale del modello.

Parametri buoni: 24 giri, lambda 0,42. Risultato misurato su modello reale: seghettatura
del contorno da **0,45 a 0,09** (0 = filo dritto, 1 = zig-zag da un vertice all'altro).
**Sotto 0,09 non si scende**: è il limite della triangolazione di partenza.

### Il tappo — tre strade, in ordine

1. **Faccia piatta con gonnella interna** (quando il contorno è già quasi piano):
   non si tocca la pelle. Si aggiunge una **gonnella** che porta il contorno vero fino al
   piano medio, e lì si chiude con un **disco piatto ritagliato a orecchie**. La gonnella sta
   dentro al pezzo, quindi non si vede; la faccia d'appoggio è piana davvero; i due pezzi
   condividono gonnella e disco, quindi combaciano.
2. **Contorno seguito com'è** (quando il contorno è ondulato): triangolazione **a orecchie in
   tre dimensioni**, scegliendo ogni volta l'angolo più compatto (massimo rapporto
   area/perimetro²). Niente proiezione, quindi funziona anche se schiacciato sul piano il
   contorno si accavallerebbe.
3. **Ventaglio verso il centro**: ultima spiaggia. **Da evitare**: produce triangoli lunghi
   che partono tutti da un punto e sul pezzo stampato **si vedono benissimo**.

Prima di triangolare, l'anello va **messo in fila**. Se ha diramazioni, non arrendersi:
spezzarlo in **più giri semplici** consumando gli spigoli.

### La scelta piatta/fedele — lascia decidere l'utente

La faccia piatta **si paga in materiale**: la gonnella riempie tutto lo spazio fra il contorno
e il piano. Su un contorno già piano non costa nulla; su uno ondulato (misurato: 14% di
scostamento su una macchia su una coscia) quel riempimento è un blocco che snatura il pezzo.

**Non decidere tu.** Metti un menu a tre voci:
- *solo dove costa poco* (predefinito): piatta sotto il 2% di scostamento, fedele sopra
- *sempre*: faccia d'appoggio piana garantita, a costo di materiale
- *mai*: massima fedeltà al modello

### Il connettore

Perno quadrato su un pezzo, foro con gioco (0,2 mm per PLA/FDM) sull'altro, via booleane
manifold3d. Due regole imparate:

- **Il perno va misurato sullo SPESSORE del pezzo staccato**, non sull'ampiezza dell'anello.
  E lo spessore **non si legge dalla scatola** che contiene il pezzo: una ciocca ricurva sta
  in una scatola da 121 mm pur essendo spessa 30. Usa `min(lato minore della scatola,
  4·volume/superficie)`, che per una lastra vale lo spessore e non si lascia ingannare dalla
  curvatura. Il perno non supera **un terzo** dello spessore.
- **Se un terzo dello spessore non arriva a 2 mm, NON mettere il perno** e scrivilo:
  sarebbe più grosso del pezzo. I due pezzi combaciano lo stesso e si incollano.

---

## 7. Il Lazo (il pezzo più insidioso)

Il cappio è disegnato **sullo schermo**, ma il modello è solido: dentro al perimetro finisce
anche tutto quello che sta **dietro**. Quattro problemi, tutti da risolvere insieme:

### a) I punti devono poter stare FUORI dal modello
Ancorare i punti alla superficie col raycast e **scartare i tocchi che non colpiscono il
modello** rende il lazo inutilizzabile: per circondare una cintura o un polso servono per
forza punti ai lati, sullo sfondo. Senza, il cappio si schiaccia in una striscia sulla
superficie — ed è la causa numero uno di "il lazo prende solo una riga".

Soluzione: se il tocco cade sul modello, ancoralo alla superficie; se cade sullo sfondo,
ancoralo a un **piano che guarda la camera** passante per l'ultimo punto messo. Così restano
punti 3D e il cappio segue il modello quando lo giri.

### b) Quali triangoli si vedono davvero: chiedilo alla scheda video
Confrontare le distanze (mappa di profondità vs distanza del centro triangolo) **non funziona**:
su 325.000 triangoli i triangoli sono **più piccoli di un pixel**, e solo ~42.000 riescono a
occupare un pixel. Tutti gli altri venivano scambiati per coperti e buttati via — da lì la
selezione a strisce frastagliate.

Soluzione giusta: **identificazione per colore**. Si disegna la scena in un render target
scrivendo al posto del colore il **numero di ogni triangolo** (attributo `Uint8Array`
normalizzato a 3 byte, numerazione continua fra i pezzi con intervalli per tornare indietro),
poi si rileggono i pixel del rettangolo del cappio. È la stessa domanda che si fa la scheda
video per decidere cosa disegnare, quindi la risposta non può sbagliare. ~250 ms a schermo
intero su 400.000 triangoli.

### c) Dai triangoli visti ci si allarga per contatto, ma solo dentro al cappio
Così si prende anche il **retro** della zona scelta (che non si vede) e ci si ferma dove il
cappio taglia. Il corpo dietro non viene raggiunto: è attaccato solo attraverso il braccio,
che esce dal cappio.

### d) Tieni solo quello che hai cerchiato, non quello che il cappio sfiora
Un cappio attorno a una cintura passa per forza **sopra le braccia**, e le braccia finiscono
dentro al perimetro: venivano selezionate anche loro, in due macchie ai lati.
Soluzione: si divide la selezione in isole e si tengono solo quelle che toccano il **"cuore"**
del cappio (il perimetro ristretto al 55% verso il centro). La zona voluta sta al centro; le
braccia lo attraversano di striscio al bordo.

### Prestazioni
Non chiamare `projectToScreen` per ogni triangolo (rimisura il riquadro della pagina ogni
volta). Fai una **proiezione in blocco**: matrice vista-proiezione calcolata una volta, poi
si macinano i punti di fila. Il lazo completo su 400.000 triangoli sta in **~150 ms**.

### Un limite da dichiarare
Il ritaglio lavora su **un pezzo per volta**. Se il cappio ne abbraccia più d'uno (una cintura
spesso è divisa fra la fascia e la gonna) **dillo all'utente** e nomina i pezzi rimasti fuori,
suggerendo di unirli prima.

---

## 8. Le trappole già pagate

Ognuna di queste è costata ore. Sono in ordine di quanto fanno male.

| # | Sintomo | Causa vera | Correzione |
|---|---|---|---|
| 1 | **Ogni taglio ignora la selezione e taglia dritto** | `np.cross` su vettori a **due** componenti: numpy 2 non lo accetta più. Il taglio andava in eccezione e l'app ripiegava sul piano. | Prodotto vettore 2D scritto a mano. **Esegui i test con gli avvisi di deprecazione trattati come errori**, altrimenti passano sulla tua macchina e falliscono su quella dell'utente. |
| 2 | L'utente usa lo strumento sbagliato | Due pulsanti: "Taglio **PRO** + connettore" (piano, ignora la selezione) e "Taglia PIATTO" (segue la selezione). "PRO" suona come il migliore. | Nomi che dicono cosa fanno: **"Taglia SULLA SELEZIONE"** (primario, verde) e **"Taglia col PIANO"** (secondario, grigio). |
| 3 | "Il piano ignora la mia selezione" | Passando allo strumento piano la selezione veniva **cancellata**. Non la ignorava: non c'era più. | Chiedi conferma prima di cambiare strumento con una selezione attiva. |
| 4 | Taglio a metà del corpo selezionando una mano | Il piano medio veniva orientato da centroide-selezione meno centroide-resto: **33° di errore** misurati. | Piano dall'**autovettore più piccolo** della dispersione dell'anello di bordo (Jacobi su matrice 3×3). |
| 5 | "Cubo sospeso per aria" | Nel calcolo del centro del connettore si **sommavano** le componenti u,v invece di sostituirle; su un modello lontano dall'origine il perno finiva a centinaia di mm fuori. | `centro = u·(centro_u) + v·(centro_v) + n·(punto·n)` |
| 6 | Perno che sfonda il pezzo | Spessore letto dalla scatola contenitrice. | `min(scatola, 4·V/A)`; niente perno sotto i 2 mm utili. |
| 7 | Sporgenza a raggiera sul pezzo | Tappo a ventaglio dal centro: su un contorno rientrante i triangoli escono dal pezzo. | Ritaglio a orecchie (2D se il contorno si proietta bene, altrimenti 3D). |
| 8 | Gradino visibile sulla pelle attorno al taglio | Per la faccia piatta si tiravano i vertici del contorno sul piano medio — ma stanno sulla **pelle**. | **Gonnella interna**: la pelle non si tocca. |
| 9 | Contorno seghettato | Tetto allo spostamento troppo stretto (avevo stretto a metà distanza credendo servisse alla chiusura: **misurato, non serviva**). | Tetto a una volta la distanza, 24 giri. Da 0,16 a 0,09. |
| 10 | Il pezzo si apre dopo il taglio | `merge_vertices()` creava 64 facce degeneri su 624. | Saldare solo se serve e solo se non produce degeneri. |
| 11 | La selezione copre tutto il pezzo | Regola morfologica "riempi se ha ≥2 vicini selezionati": contagia tutta la mesh. | Esattamente 3 su 3. |
| 12 | Anello spezzato in 20 frammenti | Incatenamento ordinato degli spigoli, fragile. | Union-find. |
| 13 | Il taglio non trova il bordo | La selezione copre **tutto** il pezzo: non esiste contorno. | Fermati e dillo, invece di ripiegare sul piano (che trancia il modello a metà). |
| 14 | Modello sdraiato di lato, viste sbagliate | Orbita Y-up su un modello Z-up. | Camera Z-up. |
| 15 | Faccia di taglio che sembra ondulata a schermo pur essendo piatta | `computeVertexNormals()` media fra **tutte** le facce attorno a un vertice, anche oltre gli spigoli vivi. | Normali che rispettano gli spigoli (soglia 35°). |

---

## 9. Metodo di lavoro (questa parte conta quanto il codice)

### Test end-to-end veri
**42 test Playwright** che guidano il file HTML costruito, servito da
`python3 -m http.server`, con il companion vero acceso. Ogni test carica un modello,
fa clic sui pulsanti veri e verifica il risultato. Niente unit test sui pezzetti: i bug
stavano tutti nelle giunzioni.

Nel codice metti **accessi di sola lettura** per i test (`window.__partsInfo()`,
`window.__selInfo()`, `window.__selBox()`, `window.__isoleSelezione()`, …).

### Misura, non dedurre
Ogni affermazione su "ora è meglio" deve avere un numero:
- **seghettatura** del contorno = quanto ogni punto sporge rispetto alla metà dei suoi due
  vicini, in proporzione alla lunghezza degli spigoli (0 = filo dritto)
- **errore di volume** = |vol(A) + vol(B) − vol(originale)| / vol(originale)
- **schegge** = triangoli con `4√3·area / (a²+b²+c²) < 0,05`
- **quanto sporge fuori dal modello** = distanza con segno dei vertici dal solido originale

E converti sempre in **millimetri di stampa**: un difetto di 0,09 spigoli su un modello alto
1899 unità stampato a 20 cm vale 0,03 mm, contro un ugello da 0,4. Molte "cose da sistemare"
sono sotto la risoluzione della stampante, e dirlo con i numeri fa risparmiare giorni.

### Guarda le immagini
Quando l'utente dice "fa schifo", **fai uno screenshot del risultato e guardalo**. Tre bug
grossi (le braccia prese dal lazo, la raggiera, il materiale aggiunto) sono saltati fuori solo
guardando, mai dai numeri.

### Fixture: usa il file vero
I modelli di prova inventati (cubi, sfere, cilindri) servono per i casi limite, ma i bug veri
escono solo sul modello Meshy reale: 395.106 triangoli, superficie increspata, spigolo tipico
3,3 unità su 1899 di altezza.

---

## 10. Ordine consigliato di costruzione

1. Parser STL/OBJ + visualizzatore Z-up + statistiche → **si vede qualcosa**
2. Riparazione e chiusura buchi → i pezzi diventano stampabili
3. Segmentazione automatica **e il pulsante per saltarla**
4. Pennello + "un clic = tutta la zona" + Annulla
5. Companion Flask + `/health` + marcatore di versione
6. **Taglio sulla selezione** (capitolo 6) — è metà del lavoro, prenditi il tempo
7. Connettore perno/foro
8. Lazo (capitolo 7) — l'altra metà
9. Menù Stampa: bobine, esplosa, appoggio, export ZIP e progetto
10. Suite Playwright, che va fatta crescere **insieme** al codice, non alla fine

---

## 11. Come parlare all'utente

- Ogni operazione lascia un **resoconto leggibile** sul pezzo, in italiano, con i numeri.
- Se qualcosa fallisce e parte un ripiego, **avviso in chiaro col motivo**.
- Prima di un'operazione che rischia di rovinare il modello (selezione sproporzionata,
  cambio strumento che perde la selezione, taglio dritto con una selezione attiva),
  **chiedi conferma**.
- La versione dell'app è scritta sotto al titolo, sempre.
