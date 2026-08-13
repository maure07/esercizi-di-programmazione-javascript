// I due tagli devono essere distinguibili: chi ha dipinto una zona non deve
// finire per sbaglio sul taglio col piano, che passa dritto e la ignora.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const avvisi = [];
  p.on('dialog', async (d) => { avvisi.push(d.message()); await d.dismiss().catch(() => d.accept()); });
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/gamba_strappo.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 30000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 40000 });
  await p.waitForTimeout(400);

  const nomi = await p.evaluate(() => ({
    piano: document.getElementById('planeCutProBtn').textContent.trim(),
    selezione: document.getElementById('cutFlatProBtn').textContent.trim(),
    versione: document.getElementById('versioneApp').textContent.trim(),
  }));
  console.log('pulsante piano    :', nomi.piano);
  console.log('pulsante selezione:', nomi.selezione);
  console.log('versione mostrata :', nomi.versione);

  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);
  const n = await p.evaluate(() => window.__selBox([-45, -45, -140], [45, 45, -60]));
  console.log('triangoli selezionati:', n);

  // col disegno fatto, si passa al "Taglio dritto": il taglio col piano deve
  // CHIEDERE conferma prima di ignorare la selezione
  const prima = await p.evaluate(() => window.__partsInfo().length);
  await p.click('#cutToolPlaneBtn'); await p.waitForTimeout(600);
  const selRimasta = await p.evaluate(() => { const s = window.__selInfo(); return s ? s.facce : 0; });
  console.log('selezione dopo aver rifiutato il cambio strumento:', selRimasta);
  const dopo = await p.evaluate(() => window.__partsInfo().length);
  const chiesto = avvisi.some((m) => /NON segue il contorno/.test(m));
  console.log('ha avvisato al cambio strumento:', chiesto, '| niente taglio:', dopo === prima,
    '| selezione conservata:', selRimasta === n);
  avvisi.forEach((m) => console.log('   avviso:', m.split('\n')[0]));

  await b.close();
  const nomiChiari = /SULLA SELEZIONE/.test(nomi.selezione) && /PIANO/.test(nomi.piano)
    && !/PRO/.test(nomi.piano);
  // Serve che la versione ci sia e sia leggibile da uno screenshot, NON che si
  // chiami in un modo preciso: legarlo al nome di turno faceva fallire il test
  // a ogni cambio di versione, senza che niente fosse rotto davvero.
  const versioneVisibile = /^app \S{4,}/.test(nomi.versione);
  console.log('nomi non ambigui:', nomiChiari, '| versione visibile:', versioneVisibile);
  if (errs.length) console.log('errori:', errs);
  const ok = nomiChiari && versioneVisibile && chiesto && dopo === prima
    && selRimasta === n && errs.length === 0;
  console.log(ok ? '\nRISULTATO: I DUE TAGLI SONO DISTINGUIBILI' : '\nRISULTATO: SI PUO ANCORA SBAGLIARE PULSANTE');
  process.exitCode = ok ? 0 : 1;
})();
