const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');

(async () => {
  const dir = require('path').join(__dirname, 'modelli');
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 850 } }); // simula schermo telefono
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto('http://127.0.0.1:8973/index.html');
  await page.waitForTimeout(300);

  const fixtureDir = require('path').join(__dirname, '..', 'esempio');
  const objPath = path.join(fixtureDir, 'funko_esempio.obj');
  const mtlPath = path.join(fixtureDir, 'funko_esempio.mtl');

  await page.setInputFiles('#fileInput', [objPath, mtlPath]);
  await page.waitForSelector('#toSegmentBtn', { timeout: 30000 });
  await page.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 15000 });
  await page.waitForTimeout(500);

  const partsTitle = await page.textContent('#partsTitle');
  const cardCount = await page.$$eval('#partsList .part-card', (els) => els.length);
  const partNames = await page.$$eval('#partsList .part-name', (els) => els.map((e) => e.value));
  const statsTexts = await page.$$eval('#partsList .part-stats', (els) => els.map((e) => e.textContent.trim()));
  const modeInfo = await page.textContent('#warnings');
  const exportDisabled = await page.$eval('#exportZipBtn', (b) => b.disabled);

  console.log('partsTitle:', partsTitle);
  console.log('cardCount:', cardCount);
  console.log('partNames:', partNames);
  console.log('statsTexts:', JSON.stringify(statsTexts, null, 2));
  console.log('modeInfo:', modeInfo);
  console.log('exportDisabled:', exportDisabled);
  console.log('consoleErrors:', consoleErrors);

  // Screenshot per ispezione visiva
  await page.screenshot({ path: `${dir}/e2e-screenshot.png` });

  // Test download ZIP
  await page.click('#toPrintBtn');
  await page.waitForTimeout(200);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportZipBtn'),
  ]);
  const zipSavePath = `${dir}/e2e-export.zip`;
  await download.saveAs(zipSavePath);
  console.log('ZIP scaricato in', zipSavePath);

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error('\nRISULTATO: ERRORI CONSOLE PRESENTI');
    process.exitCode = 1;
  } else if (cardCount !== 2) {
    console.error('\nRISULTATO: numero parti inatteso');
    process.exitCode = 1;
  } else {
    console.log('\nRISULTATO: TEST E2E SUPERATO');
  }
})();
