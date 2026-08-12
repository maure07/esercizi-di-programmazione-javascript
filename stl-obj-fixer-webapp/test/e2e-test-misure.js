// Le misure del pezzo in millimetri, e l'arrotondamento della selezione.
// Sono le due aggiunte chieste dopo che il taglio ha cominciato a funzionare:
// poter dire "questo pezzo deve essere alto tanto" senza passare da un fattore
// di scala astratto, e non dover rifinire a mano un bordo a dentini.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  // Questo test usa goku_vero.stl, che pesa 19 MB e sta fuori dal
  // repository: senza, si salta invece di fallire.
  if (!require('fs').existsSync(require('path').join(__dirname, 'modelli', 'goku_vero.stl'))) {
    console.log('SALTATO: manca modelli/goku_vero.stl (vedi test/LEGGIMI.md)');
    process.exitCode = 0;
    return;
  }
  const dir = require('path').join(__dirname, 'modelli');
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

  // --- misure ------------------------------------------------------------
  const nome = (await p.evaluate(() => window.__partsInfo()))[0].name;
  const prima = await p.evaluate((n) => window.__misureParte(n), nome);
  // dimezza la Z tenendo fermi X e Y
  const dopo = await p.evaluate((n) => window.__ridimensiona(n, [1, 1, 0.5]), nome);
  const okMisure = dopo && Math.abs(dopo[2] / prima[2] - 0.5) < 0.01
    && Math.abs(dopo[0] / prima[0] - 1) < 0.01
    && Math.abs(dopo[1] / prima[1] - 1) < 0.01;
  console.log('misure prima:', prima.map((x) => x.toFixed(1)).join(' x '));
  console.log('misure dopo :', dopo.map((x) => x.toFixed(1)).join(' x '), '-> ok:', okMisure);
  // la scheda deve mostrare le misure aggiornate, non quelle vecchie
  const inCard = await p.evaluate(() => {
    const i = document.querySelectorAll('.misure-riga input');
    return i.length === 3 ? [...i].map((x) => parseFloat(x.value)) : null;
  });
  const okCard = inCard && Math.abs(inCard[2] - dopo[2]) < 0.2;
  console.log('scheda:', inCard, '-> ok:', okCard);

  // --- arrotondamento ----------------------------------------------------
  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);
  await p.evaluate(() => window.__selBox([60, -120, 500], [230, 60, 700]));
  const d0 = await p.evaluate(() => window.__denti());
  await p.evaluate(() => window.__arrotonda(3));
  const d1 = await p.evaluate(() => window.__denti());
  console.log('denti prima:', d0.denti, 'su', d0.bordo, 'di bordo | dopo:', d1.denti);
  // i denti spariscono e la macchia non si allarga in modo apprezzabile
  const okSmusso = d0.denti > 0 && d1.denti === 0
    && Math.abs(d1.facce - d0.facce) / d0.facce < 0.05;
  console.log('crescita selezione:', (100 * (d1.facce - d0.facce) / d0.facce).toFixed(2) + '%');

  await b.close();
  const ok = okMisure && okCard && okSmusso && errs.length === 0;
  if (errs.length) console.log('errori JS:', errs);
  console.log(ok ? '\nRISULTATO: MISURE E ARROTONDAMENTO OK'
    : '\nRISULTATO: MISURE O ARROTONDAMENTO NON FUNZIONANO');
  process.exitCode = ok ? 0 : 1;
})();
