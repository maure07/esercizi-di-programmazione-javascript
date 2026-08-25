const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const dir = require('path').join(__dirname, 'modelli');
  // carico il bundle STANDALONE (quello consegnato all'utente)
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);

  // due cubi impilati: il motore geometria deve trovare 2 parti
  await p.setInputFiles('#fileInput', [`${dir}/due_cubi.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.waitForTimeout(200);

  // controlla che il pulsante AI esista
  const hasBtn = await p.$('#segmentAiBtn');
  console.log('pulsante "Segmenta con AI" presente:', !!hasBtn);

  // clic sul companion locale
  await p.click('#segmentAiBtn');
  // aspetta che compaiano le parti (round trip su 127.0.0.1:8760)
  await p.waitForSelector('#partsList .part-card', { timeout: 30000 });
  const nParts = await p.evaluate(() => document.querySelectorAll('#partsList .part-card').length);
  const info = await p.evaluate(() => (window.__partsInfo ? window.__partsInfo() : null));
  console.log('parti dal companion:', nParts, '| info:', JSON.stringify(info));

  await b.close();
  const ok = hasBtn && nParts >= 2 && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: TEST COMPANION AI SUPERATO' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
