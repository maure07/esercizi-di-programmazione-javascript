// LE ZONE PROPOSTE.
//
// La segmentazione automatica, prima, decideva: spezzava il modello e ti
// metteva davanti il risultato. Adesso propone e basta: colora le zone, tu ne
// scegli una, quella diventa la selezione gialla di sempre e da li' vale tutto
// quello che c'era gia'.
//
// Le tre cose che devono essere vere, in ordine di importanza:
//   1. le zone si vedono (elenco pieno, colorate sul modello);
//   2. cliccandone una diventa DAVVERO la selezione, con gli stessi triangoli;
//   3. la selezione resta MODIFICABILE - se il pennello non ci lavora sopra,
//      la preselezione non serve a niente: sarebbe di nuovo il computer che
//      decide.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const dir = path.join(__dirname, 'modelli');
  const modello = fs.existsSync(path.join(dir, 'goku_vero.stl')) ? 'goku_vero.stl' : null;
  if (!modello) {
    console.log('SALTATO: manca modelli/goku_vero.stl (vedi test/LEGGIMI.md)');
    process.exitCode = 0;
    return;
  }
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1300, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', async (d) => { await d.accept(); });
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(400);
  await p.setInputFiles('#fileInput', [`${dir}/${modello}`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 120000 });
  await p.click('#toSegmentBtn', { timeout: 180000, noWaitAfter: true }); await p.waitForTimeout(300);
  await p.click('#saltaSegmBtn', { timeout: 180000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 180000 });
  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);

  // --- 1) le zone si vedono ---
  const zoneVisibiliPrima = await p.evaluate(() => window.__zoneMostrate());
  await p.click('#zoneProponiBtn', { timeout: 300000, noWaitAfter: true });
  await p.waitForFunction(() => document.querySelectorAll('#zoneElenco .zona-riga').length > 0,
    null, { timeout: 300000 });
  const righe = await p.evaluate(() => document.querySelectorAll('#zoneElenco .zona-riga').length);
  const zoneVisibili = await p.evaluate(() => window.__zoneMostrate());
  console.log('zone proposte:', righe, '| mesh colorate nel viewer:', zoneVisibili,
    '(prima:', zoneVisibiliPrima + ')');
  const okProposte = righe >= 2 && zoneVisibili === righe;

  // ogni zona deve avere il SUO colore: se fossero tutte uguali l'elenco non
  // servirebbe a distinguerle sul modello
  const colori = await p.evaluate(() => [...document.querySelectorAll('#zoneElenco .zona-riga span')]
    .map((s) => s.style.background).filter((x) => x.startsWith('rgb')));
  const okColori = new Set(colori).size === colori.length && colori.length === righe;
  console.log('colori tutti diversi:', okColori);

  // --- 2) la zona diventa la selezione ---
  const attesi = await p.evaluate(() => window.__zoneFacce(1).length);
  await p.evaluate(() => document.querySelectorAll('#zoneElenco .zona-riga')[1].click());
  await p.waitForTimeout(600);
  const selezionati = await p.evaluate(() => window.__denti().facce);
  // l'arrotondamento del bordo si applica anche qui, quindi il numero non e'
  // identico: deve essere lo stesso ordine di grandezza, non lo stesso numero
  const okDiventa = selezionati > 0 && Math.abs(selezionati - attesi) / attesi < 0.2;
  console.log('zona 2:', attesi, 'triangoli -> selezione', selezionati, '-> ok:', okDiventa);

  // --- 2b) piu' zone si SOMMANO, e si tolgono riCLICCANDO ---
  // E' il caso vero segnalato: una cuffia viene proposta in tre pezzi, e senza
  // poterli sommare bisognerebbe ridisegnarla a mano - cioe' rifare a mano
  // proprio il lavoro che la preselezione doveva risparmiare.
  const attesi3 = await p.evaluate(() => window.__zoneFacce(2).length);
  await p.evaluate(() => document.querySelectorAll('#zoneElenco .zona-riga')[2].click());
  await p.waitForTimeout(600);
  const unite = await p.evaluate(() => window.__denti().facce);
  const spunte = await p.evaluate(() => document.body.innerText.match(/2 zone prese/) ? 2 : 0);
  const okSomma = unite > selezionati && Math.abs(unite - (selezionati + attesi3)) / (selezionati + attesi3) < 0.15;
  console.log('unione:', selezionati, '+', attesi3, '->', unite,
    '| riepilogo dice 2 zone:', spunte === 2, '-> ok:', okSomma);
  // riclic sulla stessa: deve tornare indietro, se no l'interruttore va in un verso solo
  await p.evaluate(() => document.querySelectorAll('#zoneElenco .zona-riga')[2].click());
  await p.waitForTimeout(600);
  const tolta = await p.evaluate(() => window.__denti().facce);
  const okToglie = Math.abs(tolta - selezionati) / selezionati < 0.1;
  console.log('dopo il riclic:', unite, '->', tolta, '(era', selezionati + ') -> ok:', okToglie);

  // --- 3) e resta modificabile ---
  const prima = tolta;
  await p.evaluate(() => window.__pennelloVicino());
  await p.waitForTimeout(400);
  const dopo = await p.evaluate(() => window.__denti().facce);
  const okModificabile = dopo !== prima;
  console.log('dopo una pennellata:', prima, '->', dopo, '-> modificabile:', okModificabile);

  // "Togli i colori" deve pulire davvero, se no restano macchie sul modello
  await p.click('#zoneViaBtn');
  await p.waitForTimeout(300);
  const okPulito = (await p.evaluate(() => window.__zoneMostrate())) === 0;
  console.log('dopo "Togli i colori":', okPulito);

  await b.close();
  const ok = okProposte && okColori && okDiventa && okSomma && okToglie
    && okModificabile && okPulito && errs.length === 0;
  if (errs.length) console.log('errori JS:', errs);
  if (!ok) {
    console.log('controlli falliti:', Object.entries({
      okProposte, okColori, okDiventa, okSomma, okToglie, okModificabile, okPulito,
    }).filter(([, v]) => !v).map(([k]) => k).join(', ') || '(nessuno: errori JS)');
  }
  console.log(ok ? '\nRISULTATO: ZONE PROPOSTE OK' : '\nRISULTATO: LE ZONE PROPOSTE NON FUNZIONANO');
  process.exitCode = ok ? 0 : 1;
})();
