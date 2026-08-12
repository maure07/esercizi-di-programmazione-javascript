# Correggi & Segmenta — l'app in breve, e perché la faccia di taglio non è ancora come Bing

---

## 1. L'applicazione, in breve

**A cosa serve.** Prendere un modello 3D generato dall'AI (tipo Meshy), ripararlo, e
**dividerlo in pezzi stampabili separatamente**, ognuno di un colore solo, per una stampante
senza cambio-filamento (Anycubic Kobra X, PLA, ugello 0,4, layer 0,2). I pezzi devono poi
**incastrarsi fra loro** senza colla dove possibile.

**Com'è fatta.** Due pezzi che lavorano insieme:

| | Cos'è | Dove gira |
|---|---|---|
| **`Correggi e Segmenta.html`** | Un unico file HTML: interfaccia, visualizzatore 3D, parser STL/OBJ, riparazione, segmentazione, export | Nel browser, anche offline |
| **`ai-segmentation`** (companion) | Un piccolo server Python locale (Flask, porta 8760) | Sul PC, finestra nera, `avvia.bat` |

L'HTML fa tutto il lavoro leggero e l'interfaccia. Il companion fa i **tagli esatti**, perché
servono le *booleane* (manifold3d) e i calcoli di geometria (trimesh, numpy) che nel browser
non ci sono.

**Il giro di lavoro.**

1. **Apri** il modello → l'app dice quanto è messo male (buchi, triangoli doppi, normali
   girate, scala sbagliata).
2. **Ripara** → chiude i buchi, salda i vertici, rimette a posto le normali, rende il pezzo
   *chiuso* (watertight), che è la condizione per stampare e per tagliare.
3. **Segmenta** → automatica (per colore della texture, per forma, o le due insieme) oppure
   **salti tutto e tagli a mano tu**.
4. **Taglia** → tre strumenti:
   - **Pennello**: dipingi la zona col dito/mouse.
   - **Clic magico**: un clic e la selezione si allarga da sola fermandosi alle pieghe.
   - **Lazo**: cerchi la zona; con l'opzione "passante" prende anche quello che sta dietro.

   Poi due pulsanti: **Taglia col PIANO** (taglio dritto, ignora la forma della selezione,
   giusto per dividere in due un arto) e **Taglia SULLA SELEZIONE** (segue esattamente il
   contorno che hai disegnato).
5. **Come si uniscono i pezzi** → menu a sei voci: *decidi tu* / *a NOCCIOLO* /
   *a NOCCIOLO, contorno ovale* / *a NOCCIOLO, contorno esatto* / *a PERNO* /
   *niente aggancio*.
6. **Stampa** → riepilogo filamenti, vista esplosa, appoggio sul piano, export ZIP con uno
   STL per pezzo.

---

## 2. Il problema: perché non viene come l'esempio di Bing

### 2.1 Cosa fa Bing, e cosa vuoi tu

Nella foto del coniglio: hanno preso il muso, ne hanno fatto **un solido pieno**, e l'hanno
**sottratto dalla testa**. Il risultato:

- il muso è un **blocco** (non un guscio),
- la sede nella testa è una **tasca dal contorno semplice e liscio**,
- la superficie dove i due pezzi si toccano è **regolare**: un fondo piano e pareti pulite.

Tu vuoi la stessa cosa sulla coscia: la macchia che selezioni diventa un blocco spesso metà
gamba, con una **faccia piatta** su cui appoggiarlo al piatto della stampante.

### 2.2 Cosa faceva l'app quando è nato questo documento (versione `nocciolo-piatto-19`)

1. Calcola `n` = la direzione verso cui **guarda** la macchia (somma delle normali dei
   triangoli selezionati).
2. **Trascina** la pelle selezionata lungo `-n`, tutta della stessa quantità → un **prisma**
   che attraversa il modello.
3. `Blocco = Prisma ∩ Modello` → tutta la carne sotto la macchia.
4. Misura con dei **raggi** quanto è spesso il modello lì sotto, e taglia il blocco con un
   **piano** a metà di quello spessore.
5. La sede nell'altro pezzo è lo stesso solido, un filo più largo e un filo più fondo.

**Misurato, il piano c'è davvero**: la faccia di taglio sta in una fetta spessa **0,000013
unità** (cioè è un piano esatto); col taglio normale la faccia più piana del pezzo era spessa
**72**. Il pezzo passa da 15,4 a 31,7 di spessore, i due pezzi restano chiusi, e non si perde
volume (0,05%).

**Quindi il piano non manca.** Manca dell'altro.

### 2.3 Le quattro ragioni per cui *sembra* ancora sminchiato

#### a) Le pareti seguono il contorno grezzo della selezione — è questa la differenza vera

Il prisma ha come sezione **il contorno esatto della tua selezione**. Ma quel contorno
cammina sugli **spigoli dei triangoli**, e il modello ne ha 395.000: il bordo è una **sega
tridimensionale con centinaia di denti**, che va su e giù seguendo la pelle.

Nell'esempio di Bing il contorno della tasca è un **ovale pulito**. Nel nostro è un
merletto.

Risultato: fondo piatto perfetto, **ma pareti frastagliate**. E siccome le pareti sono la
parte che si vede di più girando il pezzo, l'impressione è che sia tutto storto.

> **Qui c'è una contraddizione di fondo:** *"segui esattamente la mia selezione"* e
> *"dammi una faccia liscia come Bing"* sono due richieste che si combattono. Bing ha
> scelto la seconda: ha **rinunciato** al contorno esatto e ha usato una forma semplice.

#### b) Dove la pelle è quasi parallela al trascinamento, escono delle alette

Al bordo della macchia la superficie si gira e diventa quasi parallela alla direzione `-n`.
Lì il prisma la **rasenta** invece di attraversarla, e l'intersezione produce **linguette
sottili** attaccate al blocco. Sono le "ali" che si vedono nelle foto.

Le schegge *staccate* le butto già via (misurato: la booleana produceva 117 tocchi separati,
uno da 6,5 milioni di volume e tutti gli altri sotto 700 — tengo solo quelli che valgono
almeno il 5% del più grosso). Ma le linguette **attaccate** al blocco restano, perché
buttarle via vorrebbe dire bucare il pezzo.

#### c) I solchi del modello interrompono la faccia piatta

Dove il personaggio ha una piega dentro la macchia (la riga del gluteo, un solco muscolare),
il piano **esce dalla pelle** e rientra: la faccia piatta si spezza in due o tre isole con dei
vuoti in mezzo. Non è un difetto del calcolo — è il modello che lì è concavo — ma a vederlo
sembra un buco.

#### d) Quello che vedi per primo è la pelle, non la faccia piatta

Quando l'app ti mostra il pezzo staccato, l'angolo di partenza guarda la **pelle esterna**,
che è curva per definizione. La faccia piatta sta **dall'altra parte**. Nella tua ultima foto
si vede proprio il lato pelle.

*Come controllare*: isola il pezzo, premi **2** (retro) o gira finché non vedi una superficie
**di un grigio/verde uniforme, senza sfumature**. Se non la trovi, allora il problema è vero.

### 2.4 Prima di tutto: sei sicuro di girare la versione nuova?

Due controlli da dieci secondi, perché se il companion è vecchio il motore è quello di prima
e nessuna di queste spiegazioni vale:

1. **Sotto il titolo** dell'app deve esserci scritto `app nocciolo-liscio-21`
   (era `nocciolo-piatto-19` quando questo documento è nato: i capitoli 4 e 5 raccontano
   cosa è cambiato da allora).
2. **Nel resoconto del pezzo** deve comparire la riga
   *"Taglio A NOCCIOLO con la **FACCIA PIATTA e CONTORNO LISCIO**"*.
   Se invece leggi *"la zona scelta diventa un blocchetto spesso … (affondato …)"* senza
   "FACCIA PIATTA", stai usando il **vecchio nocciolo a guscio** — quello che copiava la pelle
   curva, ed è normale che venga ondulato.
3. Se leggi *"ATTENZIONE: qui il nocciolo SVUOTA il pezzo"*, la selezione **gira attorno** al
   modello: per quella zona il nocciolo non è lo strumento giusto, ci vuole il perno.

Vanno aggiornati **tutti e due** i file insieme: l'HTML **e** la cartella `ai-segmentation`
(chiudere la finestra nera, sostituire la cartella, riavviare `avvia.bat`).

---

## 3. La soluzione: rendere liscio il contorno della tasca

La correzione che manca è una sola, e attacca la causa **(a)**, che è quella grossa.

**Adesso**: la sezione del prisma è il contorno esatto della selezione (un merletto 3D).

**Dopo**: si prendono tutti i punti della selezione, si **schiacciano sul piano di taglio**
(cioè si guarda la macchia da dritto, lungo `n`), e si costruisce attorno a loro un
**contorno semplice e liscio** — l'inviluppo convesso, oppure lo stesso contorno ammorbidito
con qualche passata di lisciatura. **Quello** diventa la sezione del prisma.

Il pezzo che ne esce ha:

- davanti la **pelle originale del modello**, intatta (questo non cambia: è la superficie che
  si vede a modello montato);
- di lato **pareti dritte e lisce**, come una fustella;
- dietro la **faccia piana** su cui appoggiarlo.

Cioè esattamente la forma di Bing.

**Il prezzo da pagare, detto chiaro**: il pezzo prenderà **un po' più di materiale** di quello
che hai selezionato — il contorno liscio è più largo del merletto. È lo stesso prezzo che ha
pagato chi ha fatto il coniglio. In cambio: pareti pulite, niente alette, e il pezzo entra
nella sua sede in un verso solo.

**Dove non si può usare**: se la selezione **gira attorno** al modello (una cintura, un
anello attorno alla coscia), schiacciarla su un piano non ha senso — quella è roba da taglio
col PIANO più perno, e l'app lo dice già da sola.

---

## 4. Fatto: versione `nocciolo-liscio-20`

La correzione del punto 3 è stata implementata e misurata.

**Cosa fa adesso il taglio a nocciolo**, passo per passo:

1. `n` = direzione verso cui guarda la macchia.
2. Tutti i punti della macchia vengono **schiacciati sul piano di taglio** (guardati da
   dritto, lungo `n`).
3. Si calcola il loro **inviluppo convesso**, lo si ricampiona a passo costante su 128 punti
   e lo si **arrotonda** con 8 passate di lisciatura.
4. Arrotondare *stringe* il contorno, e un contorno che stringe taglierebbe via pezzi di
   quello che hai scelto: quindi lo si **riapre** quel tanto che basta perché contenga di
   nuovo tutta la macchia.
5. Quel contorno diventa la sezione di una **fustella dritta**, che viene intersecata col
   modello e segata dal piano a metà spessore.

**Misurato sulla stessa macchia sulla coscia:**

| | contorno esatto (prima) | contorno liscio (adesso) |
|---|---|---|
| faccia di taglio piana | 18% della superficie del pezzo | **26%** |
| scostamento dal piano | 0,00001 | 0,00001 |
| spessore del pezzo | 39,5 | **52,4** |
| buchi nella faccia piatta | sì (i solchi la spezzavano) | **no, è una macchia sola** |
| pezzi chiusi | sì | sì |
| volume perso | 0,00% | 0,00% |

---

## 5. Correzione della correzione: `nocciolo-liscio-21`

Aggiungendo i log di diagnostica è saltato fuori un difetto della scelta fatta al capitolo 4.
**L'inviluppo convesso porta via troppo materiale.** Misurato sulla stessa macchia della
coscia, guardando l'area del contorno schiacciato sul piano di taglio:

| contorno | area | denti sul bordo |
|---|---|---|
| grezzo (bordo vero della selezione) | 18.780 | **sì, centinaia** |
| **smussato** (bordo vero + Chaikin) | **18.728** | no |
| ovale (inviluppo convesso) | 48.842 | no |

L'inviluppo prende **quasi il triplo** dell'area: su una coscia vuol dire mangiarsi mezzo
fianco. Il contorno **smussato** ottiene lo stesso risultato estetico (niente denti) con la
**stessa area** di quello che hai scelto (−0,3%).

**Come si fa lo smussato**, senza nessuna libreria in più:

1. si prende l'anello di bordo **vero** della selezione, messo in fila (`_ordina_anello`);
2. lo si proietta sul piano di taglio;
3. si controlla che non si **incroci da solo** (se lo fa — succede quando la selezione gira
   attorno al modello — si ripiega sull'inviluppo convesso);
4. si smussa con **Chaikin** (taglia gli angoli: a differenza della media mobile **non**
   chiude le rientranze, quindi una mezzaluna resta una mezzaluna);
5. si ricampiona a 128 punti e si ricontrolla che sia ancora semplice.

Altra conferma dai log: il numero di corpi prodotti dalla booleana passa da **5** col
contorno grezzo a **1** con quello smussato. Le briciole erano proprio i denti.

**Nel menu** «Come si uniscono i pezzi» ci sono adesso sei voci: *decidi tu* /
**a NOCCIOLO** (contorno smussato — il predefinito) / *a NOCCIOLO, contorno ovale* /
*a NOCCIOLO, contorno esatto* / *a PERNO* / *niente aggancio*.

**Log di diagnostica** nel resoconto di ogni taglio a nocciolo:

```
[diagnostica] macchia: 4650 triangoli, 2847 vertici; bordo proiettato: 342 punti;
              area del contorno grezzo 18780
[diagnostica] contorno morbido: 128 punti, area 18728
[diagnostica] spessore stimato 196.2, piano a quota -61.6 (cioe' 98.1 sotto la pelle);
              corpi dopo la booleana 1, dopo il filtro delle briciole 1
```

---

*Documento generato per il progetto Correggi & Segmenta — versione motore `nocciolo-liscio-21`.*
