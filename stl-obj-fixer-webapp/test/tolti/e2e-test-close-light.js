const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 850 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

  await page.goto('http://127.0.0.1:8973/index.html');
  await page.waitForTimeout(300);
  const dir = require('path').join(__dirname, 'modelli');

  // cubo con un buco: la chiusura leggera deve chiuderlo mantenendo i triangoli
  await page.setInputFiles('#fileInput', [`${dir}/cubo_con_buco.stl`]);
  await page.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });
  await page.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 20000 });

  const before = await page.evaluate(() => window.__partsInfo());
  await page.click('#closeLightBtn');
  await page.waitForFunction(() => { const o = document.getElementById('loadingOverlay'); return o && !o.classList.contains('visible'); }, { timeout: 30000 });
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => window.__partsInfo());
  console.log('prima:', JSON.stringify(before), '\ndopo :', JSON.stringify(after));

  const allClosed = after.every((p) => p.wt);
  // il dettaglio si mantiene: il n. di triangoli resta nello stesso ordine di
  // grandezza (la chiusura leggera aggiunge solo qualche triangolo-toppa),
  // NON esplode come farebbe la ricostruzione a voxel
  const detailKept = after.every((p, i) => p.tris <= before[i].tris * 1.5 + 50);
  console.log('tutti chiusi:', allClosed, '| dettaglio mantenuto (triangoli ~uguali):', detailKept);
  console.log('consoleErrors:', errs);
  await browser.close();

  const ok = allClosed && detailKept && errs.length === 0;
  console.log(ok ? '\nRISULTATO: TEST CHIUSURA LEGGERA SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
