const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/index.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/sfera.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 20000 });
  const before = await p.evaluate(() => window.__partsInfo());

  await p.click('#cutToggleBtn'); await p.waitForTimeout(100);
  await p.click('#cutToolPlaneBtn'); await p.waitForTimeout(150);
  const planeVisible = await p.$eval('#planeControls', (e) => e.style.display !== 'none');
  // taglia a metà lungo Z
  await p.click('#planeAxisZ');
  await p.evaluate(() => { const s = document.getElementById('planePos'); s.value = 50; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('#planeCutBtn');
  await p.waitForFunction(() => { const o = document.getElementById('loadingOverlay'); return o && !o.classList.contains('visible'); }, { timeout: 30000 });
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => window.__partsInfo());
  console.log('prima:', JSON.stringify(before), '\ndopo :', JSON.stringify(after));

  const split = after.length === before.length + 1; // 1 pezzo -> 2
  const bothClosed = after.every((x) => x.wt);
  console.log('pannello piano visibile:', planeVisible, '| si e\' diviso in 2:', split, '| entrambe chiuse:', bothClosed, '| errori:', errs.length);
  await b.close();
  const ok = planeVisible && split && bothClosed && errs.length === 0;
  console.log(ok ? '\nRISULTATO: TEST TAGLIO PIANO SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
