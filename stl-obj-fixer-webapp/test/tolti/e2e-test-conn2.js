const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('dialog', async (d) => { console.log('  [avviso]', d.message().split('\n')[0]); await d.accept(); });
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  // due cubi impilati: si toccano su una faccia ORIZZONTALE
  await p.setInputFiles('#fileInput', [`${dir}/due_cubi.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 30000 });
  await p.waitForTimeout(400);

  const prima = await p.evaluate(() => window.__partsInfo().map(x => x.vol));
  const volPrima = await p.evaluate(() => window.__partsVolumes ? window.__partsVolumes() : null);
  console.log('volumi prima:', JSON.stringify(volPrima));

  // attiva i connettori e tocca il punto di contatto fra i due cubi
  await p.click('#connectorToggleBtn'); await p.waitForTimeout(300);
  const box = await (await p.$('#viewer')).boundingBox();
  // tocca vicino alla giunzione (il cubetto sopra sta in alto)
  await p.mouse.click(box.x + box.width/2, box.y + box.height*0.42);
  await p.waitForTimeout(4000);
  const volDopo = await p.evaluate(() => window.__partsVolumes ? window.__partsVolumes() : null);
  console.log('volumi dopo: ', JSON.stringify(volDopo));

  await b.close();
  if (!volPrima || !volDopo) { console.log('accessore volumi mancante'); process.exitCode = 1; return; }
  // un pezzo deve essere CRESCIUTO (perno) e uno CALATO (foro)
  let cresciuto = false, calato = false;
  for (let i = 0; i < Math.min(volPrima.length, volDopo.length); i++) {
    if (volDopo[i] > volPrima[i] * 1.002) cresciuto = true;
    if (volDopo[i] < volPrima[i] * 0.998) calato = true;
  }
  console.log('un pezzo e cresciuto (perno):', cresciuto, '| uno e calato (foro):', calato);
  const ok = cresciuto && calato && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: CONNETTORE FUNZIONANTE' : '\nRISULTATO: CONNETTORE NON FUNZIONA');
  process.exitCode = ok ? 0 : 1;
})();
