// L'undo deve tornare indietro UN TAGLIO ALLA VOLTA, non riportare tutto
// all'inizio. Si fanno tre tagli e si annulla tre volte contando i pezzi.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('dialog', async (d) => { await d.accept(); });
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/gamba_strappo.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 30000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 40000 });
  await p.waitForTimeout(400);
  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);

  const conteggi = [await p.evaluate(() => window.__partsInfo().length)];
  const fette = [[-45,-45,-140,45,45,-90], [-45,-45,-90,45,45,-40], [-45,-45,-40,45,45,10]];
  for (const f of fette) {
    const n = await p.evaluate((v) => window.__selBox([v[0],v[1],v[2]], [v[3],v[4],v[5]]), f);
    if (!n) { console.log('selezione vuota per', f); continue; }
    const prima = conteggi[conteggi.length - 1];
    await p.click('#cutFlatProBtn', { timeout: 120000, noWaitAfter: true });
    await p.waitForFunction((k) => window.__partsInfo().length > k, prima, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(800);
    conteggi.push(await p.evaluate(() => window.__partsInfo().length));
  }
  console.log('pezzi dopo ogni taglio:', conteggi.join(' -> '));
  console.log('voci nella storia:', await p.evaluate(() => window.__storiaParti()));

  const indietro = [];
  for (let i = 0; i < 3; i++) {
    await p.click('#undoPartiBtn');
    await p.waitForTimeout(500);
    indietro.push(await p.evaluate(() => window.__partsInfo().length));
  }
  console.log('pezzi dopo ogni annulla:', indietro.join(' -> '));
  await b.close();
  // annullando si devono ripercorrere all'indietro gli stessi numeri
  const atteso = conteggi.slice(0, -1).reverse();
  const ok = JSON.stringify(indietro) === JSON.stringify(atteso) && errs.length === 0;
  console.log('atteso:', atteso.join(' -> '), '| ottenuto:', indietro.join(' -> '));
  if (errs.length) console.log(errs);
  console.log(ok ? '\nRISULTATO: ANNULLA PASSO PASSO OK' : '\nRISULTATO: ANNULLA NON VA PASSO PASSO');
  process.exitCode = ok ? 0 : 1;
})();
