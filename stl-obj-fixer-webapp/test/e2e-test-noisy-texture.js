const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 850 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto('http://127.0.0.1:8973/index.html');
  await page.waitForTimeout(300);

  const dir = require('path').join(__dirname, 'modelli');
  await page.setInputFiles('#fileInput', [
    `${dir}/texture_fixture_noisy.obj`,
    `${dir}/texture_fixture_noisy.mtl`,
    `${dir}/texture_noisy.png`,
  ]);
  await page.waitForSelector('#toSegmentBtn', { timeout: 30000 });
  await page.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 15000 });
  await page.waitForTimeout(400);

  const cardCount = await page.$$eval('#partsList .part-card', (els) => els.length);
  const partsTitle = await page.textContent('#partsTitle');
  const statsTexts = await page.$$eval('#partsList .part-stats', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));

  console.log('partsTitle:', partsTitle);
  console.log('cardCount:', cardCount);
  console.log('statsTexts:', statsTexts);
  console.log('consoleErrors:', consoleErrors);

  await browser.close();

  // con la texture rumorosa (30% di pixel "sporchi") il modello (2 cubi,
  // testa+cappello) deve restare a 2 parti pulite, non frammentarsi in
  // decine/centinaia di micro-parti come accadeva prima della sfocatura.
  const ok = cardCount <= 4 && consoleErrors.length === 0;
  console.log(ok ? '\nRISULTATO: TEST TEXTURE RUMOROSA SUPERATO' : '\nRISULTATO: ERRORI PRESENTI (frammentazione o errori)');
  process.exitCode = ok ? 0 : 1;
})();
