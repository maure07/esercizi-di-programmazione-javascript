const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const dir = require('path').join(__dirname, 'modelli');
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 850 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto('http://127.0.0.1:8973/index.html');
  await page.waitForTimeout(300);

  const stlPath = `${dir}/cubo_con_buco.stl`;
  await page.setInputFiles('#fileInput', [stlPath]);
  await page.waitForSelector('#toSegmentBtn', { timeout: 30000 });
  await page.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 15000 });
  await page.waitForTimeout(300);

  const cardCount = await page.$$eval('#partsList .part-card', (els) => els.length);
  const logText = await page.textContent('#log');
  const statsText = await page.$eval('#partsList .part-stats', (e) => e.textContent.trim());
  const modeInfo = await page.textContent('#warnings');

  console.log('cardCount:', cardCount);
  console.log('logText:', logText);
  console.log('statsText:', statsText);
  console.log('modeInfo:', modeInfo);

  const holeClosed = /Chiusi 1 buchi/.test(logText);
  const watertightNow = /solido chiuso/.test(statsText);
  const volumeApprox1000 = /1[.,]0 cm/.test(statsText) || /999/.test(statsText);

  // --- interazione: toggle visibilita' ---
  const visBtn = await page.$('.visibility-toggle');
  const wasActive = await visBtn.evaluate((b) => b.classList.contains('active'));
  await visBtn.click();
  await page.waitForTimeout(100);
  const isActiveNow = await visBtn.evaluate((b) => b.classList.contains('active'));

  // --- interazione: escludi dall'export ---
  const excludeBtn = await page.$('.exclude-btn');
  await excludeBtn.click();
  await page.waitForTimeout(100);
  const exportDisabledAfterExclude = await page.$eval('#exportZipBtn', (b) => b.disabled);
  await excludeBtn.click(); // re-includi
  const exportDisabledAfterReinclude = await page.$eval('#exportZipBtn', (b) => b.disabled);

  // --- download singola parte ---
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('.part-actions button:has-text("STL")'),
  ]);
  const singleStlPath = `${dir}/single-part.stl`;
  await download.saveAs(singleStlPath);

  await browser.close();

  console.log('holeClosed:', holeClosed);
  console.log('watertightNow:', watertightNow);
  console.log('volumeApprox1000:', volumeApprox1000);
  console.log('toggle visibilita: era attivo?', wasActive, '-> ora attivo?', isActiveNow);
  console.log('export disabilitato dopo esclusione unica parte:', exportDisabledAfterExclude);
  console.log('export riabilitato dopo re-inclusione:', !exportDisabledAfterReinclude);
  console.log('consoleErrors:', consoleErrors);

  const ok = holeClosed && watertightNow && cardCount === 1 && wasActive && !isActiveNow
    && exportDisabledAfterExclude === true && exportDisabledAfterReinclude === false
    && consoleErrors.length === 0;

  console.log(ok ? '\nRISULTATO: TEST E2E-2 SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  if (!ok) process.exitCode = 1;
})();
