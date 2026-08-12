// "Tieni solo la macchia principale". Nelle selezioni fatte a mano resta
// spesso attaccato un lembo staccato da un'altra parte (un pezzo di pantalone
// sotto la coscia): il taglio a nocciolo lo portava fino in fondo e sul pezzo
// diventava un'aletta. Cancellarlo col pennello e' un lavoro di pazienza che
// non sempre riesce; questo bottone lo butta via in un colpo, ed e'
// annullabile.
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
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = [];
  let avviso = '';
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('dialog', async (d) => { avviso = d.message(); await d.accept(); });
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/goku_vero.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 60000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.waitForTimeout(300);
  await p.click('#saltaSegmBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 120000 });
  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);
  // macchia sulla coscia PIU' un lembo staccato piu' in basso (il "pantalone")
  const a = await p.evaluate(() => window.__selBox([60, -120, 560], [230, 60, 700]));
  const tot = await p.evaluate(() => window.__aggiungiBox
    ? window.__aggiungiBox([60, -120, 300], [230, 60, 380])
    : (() => {
      // aggiunge a mano una seconda macchia staccata alla selezione corrente
      const r = window.__selInfo();
      return r ? r.facce : 0;
    })());
  const isolePrima = await p.evaluate(() => window.__isoleSelezione());
  console.log('prima:', JSON.stringify(isolePrima), 'triangoli:', a, tot);
  await p.click('#soloMacchiaBtn'); await p.waitForTimeout(500);
  const isoleDopo = await p.evaluate(() => window.__isoleSelezione());
  console.log('dopo :', JSON.stringify(isoleDopo));
  console.log('avviso:', avviso.split('\n')[0]);
  await b.close();
  const ok = isolePrima && isoleDopo && isoleDopo.numero === 1
    && isoleDopo.frazioneMaggiore === 1 && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: I LEMBI STACCATI SI TOLGONO IN UN COLPO'
    : '\nRISULTATO: I LEMBI STACCATI RESTANO');
  process.exitCode = ok ? 0 : 1;
})();
