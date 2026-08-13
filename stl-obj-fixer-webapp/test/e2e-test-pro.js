const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('dialog', async (d) => { console.log('  [avviso app]', d.message().split('\n')[0]); await d.accept(); });
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);

  // carica un modello ROTTO (sfera con buchi + guscio interno)
  await p.setInputFiles('#fileInput', [`${dir}/rotta.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });
  await p.waitForTimeout(300);

  // --- 1. RIPARAZIONE PRO ---
  await p.click('#stepChip2'); await p.waitForTimeout(200);
  await p.click('#repairProBtn');
  await p.waitForFunction(() => {
    const t = document.getElementById('repairReport').textContent || '';
    return t.includes('Riparazione PRO');
  }, { timeout: 60000 });
  const rep = await p.evaluate(() => ({
    txt: document.getElementById('repairReport').textContent,
    info: window.__repairedInfo ? window.__repairedInfo() : null,
  }));
  console.log('RIPARAZIONE PRO ->', JSON.stringify(rep.info));
  const riparataOk = rep.info && rep.info.watertight === true;

  // --- 2. segmenta, poi TAGLIO PRO con connettore ---
  await p.click('#toSegmentBtn2'); await p.waitForTimeout(200);
  await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 30000 });
  await p.waitForTimeout(300);

  await p.click('#cutToggleBtn'); await p.waitForTimeout(200);
  await p.click('#cutToolPlaneBtn'); await p.waitForTimeout(300);

  const prima = await p.evaluate(() => window.__partsInfo().length);
  await p.click('#planeCutProBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForFunction((n) => {
    const info = window.__partsInfo();
    return info && info.length > n;
  }, prima, { timeout: 60000 });
  await p.waitForTimeout(400);
  const parti = await p.evaluate(() => window.__partsInfo());
  console.log('TAGLIO PRO -> parti:', JSON.stringify(parti));

  const perno = parti.find((x) => x.name.includes('perno'));
  const foro = parti.find((x) => x.name.includes('foro'));
  const tagliOk = !!perno && !!foro && perno.wt === true && foro.wt === true;

  await p.screenshot({ path: `${dir}/pro-shot.png` });
  await b.close();
  const ok = riparataOk && tagliOk && errs.length === 0;
  if (errs.length) console.log('errori console:', errs);
  console.log('\nriparata chiusa:', riparataOk, '| perno+foro chiusi:', tagliOk);
  console.log(ok ? 'RISULTATO: TEST PRO SUPERATO' : 'RISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
