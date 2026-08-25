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
    `${dir}/texture_fixture.obj`,
    `${dir}/texture_fixture.mtl`,
    `${dir}/texture_test.png`,
  ]);
  await page.waitForSelector('#toSegmentBtn', { timeout: 30000 });
  await page.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 15000 });
  await page.waitForTimeout(400);

  const cardCount = await page.$$eval('#partsList .part-card', (els) => els.length);
  const partNames = await page.$$eval('#partsList .part-name', (els) => els.map((e) => e.value));
  const swatchColors = await page.$$eval('#partsList .swatch', (els) => els.map((e) => e.style.background));
  const modeInfo = await page.textContent('#warnings');
  const statsTexts = await page.$$eval('#partsList .part-stats', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));

  console.log('cardCount:', cardCount);
  console.log('partNames:', partNames);
  console.log('swatchColors:', swatchColors);
  console.log('modeInfo:', modeInfo);
  console.log('statsTexts:', statsTexts);
  console.log('consoleErrors:', consoleErrors);

  await page.screenshot({ path: `${dir}/e2e-texture-screenshot.png` });
  await browser.close();

  const textureApplied = /Colori letti dalla texture/.test(modeInfo);
  const ok = cardCount === 2 && textureApplied && consoleErrors.length === 0;
  console.log(ok ? '\nRISULTATO: TEST TEXTURE SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
