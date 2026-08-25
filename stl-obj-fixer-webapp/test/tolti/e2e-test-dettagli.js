const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/funko.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 30000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.waitForTimeout(300);
  await p.click('#segmentAiBtn');
  await p.waitForSelector('#partsList .part-card', { timeout: 120000 });
  await p.waitForTimeout(500);
  const parti = await p.evaluate(() => window.__partsInfo());
  const warn = await p.evaluate(() => document.getElementById('warnings').textContent);
  console.log('parti:', parti.length);
  parti.forEach(x => console.log('   ', x.name, x.tris, 'tri'));
  console.log('note:', warn.replace(/\s+/g,' ').slice(0,200));
  await p.screenshot({ path: `${dir}/dettagli-shot.png` });
  await b.close();
  // deve trovare pochi pezzi sensati, NON un casino di macchie
  const ok = parti.length >= 2 && parti.length <= 8 && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: DETTAGLI SENSATI - OK' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
