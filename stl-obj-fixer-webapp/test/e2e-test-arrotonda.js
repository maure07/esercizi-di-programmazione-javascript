// Le due migliorie chieste dopo il primo taglio riuscito:
//
//  1. girare attorno al pezzo MENTRE si seleziona, tenendo premuto Shift col
//     tasto sinistro. Prima bisognava zoomare indietro, cercare un punto vuoto
//     dello sfondo, girare e rizoomare: una manovra a ogni cambio di lato.
//     Il rischio da controllare e' l'opposto: che Shift+trascina, oltre a
//     girare, sporchi la selezione. Deve girare e basta.
//
//  2. l'arrotondamento del bordo. Il vecchio smusso guardava un triangolo alla
//     volta: toglieva i dentini ma lasciava le gobbe larghe, per questo il
//     contorno sembrava ancora seguire le righe della mesh. Qui si misura la
//     ruvidezza come figura (perimetro diviso quello del cerchio di pari area):
//     e' il numero che vede le gobbe, e deve scendere.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  if (!fs.existsSync(path.join(__dirname, 'modelli', 'goku_vero.stl'))) {
    console.log('SALTATO: manca modelli/goku_vero.stl (vedi test/LEGGIMI.md)');
    process.exitCode = 0;
    return;
  }
  const dir = path.join(__dirname, 'modelli');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1300, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', async (d) => { await d.accept(); });
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(400);
  await p.setInputFiles('#fileInput', [`${dir}/goku_vero.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 60000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.waitForTimeout(300);
  await p.click('#saltaSegmBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 120000 });
  await p.waitForTimeout(500);
  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);

  // --- 1) Shift + tasto sinistro gira la telecamera --------------------------
  // si punta il centro del viewer, cioe' SOPRA il modello: e' proprio il caso
  // in cui prima non si poteva girare perche' il tocco veniva preso per una
  // pennellata.
  await p.evaluate(() => window.__selBox([60, -120, 500], [230, 60, 700]));
  const selPrima = await p.evaluate(() => window.__denti().facce);
  const camPrima = await p.evaluate(() => window.__viewerCam());
  const tgPrima = await p.evaluate(() => window.__viewerTarget());
  const box = await p.locator('#viewer').boundingBox();
  const cx = Math.round(box.x + box.width / 2), cy = Math.round(box.y + box.height / 2);
  await p.keyboard.down('Shift');
  await p.mouse.move(cx, cy);
  await p.mouse.down({ button: 'left' });
  for (let i = 1; i <= 10; i++) await p.mouse.move(cx + i * 12, cy + i * 3);
  await p.mouse.up({ button: 'left' });
  await p.keyboard.up('Shift');
  await p.waitForTimeout(300);
  const camDopo = await p.evaluate(() => window.__viewerCam());
  const selDopo = await p.evaluate(() => window.__denti().facce);
  const spostamento = Math.hypot(
    camDopo[0] - camPrima[0], camDopo[1] - camPrima[1], camDopo[2] - camPrima[2]);
  // la camera deve essersi mossa davvero, e la selezione deve essere intatta
  const okGiro = spostamento > 1 && selDopo === selPrima;
  console.log('Shift+sinistro: camera spostata di', spostamento.toFixed(1),
    '| selezione', selPrima, '->', selDopo, '-> ok:', okGiro);

  // il trascinamento con Shift non deve nemmeno spostare il centro della vista
  // (quello e' il tasto destro): se sposta invece di girare, la manovra non
  // serve a niente perche' il pezzo esce dall'inquadratura
  const tgDopo = await p.evaluate(() => window.__viewerTarget());
  const scarto = Math.hypot(
    tgDopo[0] - tgPrima[0], tgDopo[1] - tgPrima[1], tgDopo[2] - tgPrima[2]);
  const okNonSposta = scarto < 1e-6;
  console.log('centro della vista fermo:', scarto.toFixed(6), '-> ok:', okNonSposta);

  // --- 2) arrotondamento del bordo ------------------------------------------
  // Banco di prova: si parte da una macchia pulita, la si sporca in modo
  // ripetibile (dado con seme fisso, come una mano che sbava dipingendo) e si
  // guarda quanto il bordo torna disteso. La ruvidezza si legge come
  // "perimetro diviso quello di un cerchio di pari area": 1 e' un cerchio,
  // piu' sale piu' il contorno serpeggia.
  const banco = async (forza) => p.evaluate((q) => {
    window.__resetSel();
    window.__applicaSelTest(600, 25);
    window.__sporcaSelezione(35, 7);
    const sporca = window.__bordoRuvido();
    const sporcaDenti = window.__denti();
    const t0 = performance.now();
    window.__arrotonda(q);
    return { sporca, sporcaDenti, ms: performance.now() - t0, dopo: window.__bordoRuvido(), denti: window.__denti() };
  }, forza);

  const b0 = await banco(0);      // solo lo smusso fine di prima
  const b12 = await banco(12);    // il valore che trova impostato chi apre l'app
  console.log('ruvidezza: macchia sporcata', b0.sporca.indice.toFixed(2),
    '| solo smusso fine', b0.dopo.indice.toFixed(2),
    '| arrotondata 12%', b12.dopo.indice.toFixed(2),
    '(' + b12.ms.toFixed(0) + ' ms)');
  console.log('dentini: sporcata', b0.sporcaDenti.denti, '-> smusso fine', b0.denti.denti, '-> 12%', b12.denti.denti);

  // Il punto della richiesta: il vecchio smusso lasciava le gobbe, il nuovo no.
  const okMeglio = b12.dopo.indice < b0.dopo.indice * 0.75;
  // niente dentini rimasti, ne' con l'uno ne' con l'altro
  const okDenti = b0.sporcaDenti.denti > 0 && b12.denti.denti === 0;
  // si smussa il contorno, non si ridimensiona la macchia
  const varArea = (b12.dopo.area - b0.sporca.area) / b0.sporca.area;
  const okArea = Math.abs(varArea) < 0.15;
  console.log('variazione area:', (100 * varArea).toFixed(1) + '%');
  // e non deve metterci un'eternita' a ogni pennellata
  const okTempo = b12.ms < 1500;
  console.log('tempo:', b12.ms.toFixed(0), 'ms -> ok:', okTempo);

  // alzando il cursore si deve arrotondare di piu' (o almeno non di meno)
  const b20 = await banco(20);
  const okCursore = b20.dopo.indice <= b12.dopo.indice + 0.05;
  console.log('al 20%:', b20.dopo.indice.toFixed(2), '-> non peggio del 12%:', okCursore);
  // a 0 il cursore deve davvero lasciare stare il contorno
  const okZero = b0.dopo.indice > b12.dopo.indice;

  // il cursore e il pulsante devono esistere davvero nel pannello
  const okUi = await p.evaluate(() => !!document.getElementById('arrotondaForza')
    && !!document.getElementById('arrotondaBtn')
    && document.getElementById('arrotondaForza').value === '12');

  await b.close();
  const ok = okGiro && okNonSposta && okMeglio && okDenti && okArea && okCursore
    && okZero && okTempo && okUi && errs.length === 0;
  if (errs.length) console.log('errori JS:', errs);
  if (!ok) {
    console.log('controlli falliti:', Object.entries({
      okGiro, okNonSposta, okMeglio, okDenti, okArea, okCursore, okZero, okTempo, okUi,
    }).filter(([, v]) => !v).map(([k]) => k).join(', ') || '(nessuno: errori JS)');
  }
  console.log(ok ? '\nRISULTATO: GIRO CON SHIFT E ARROTONDAMENTO OK'
    : '\nRISULTATO: GIRO CON SHIFT O ARROTONDAMENTO NON FUNZIONANO');
  process.exitCode = ok ? 0 : 1;
})();
