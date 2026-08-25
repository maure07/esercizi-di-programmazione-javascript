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
  // STL puro, senza colori: mesh FUSA scatola-su-scatola
  await page.setInputFiles('#fileInput', [`${dir}/scatola_su_scatola.stl`]);
  await page.waitForSelector('#toSegmentBtn', { timeout: 30000 });
  await page.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 15000 });
  await page.waitForTimeout(300);

  const cardCount = await page.$$eval('#partsList .part-card', (els) => els.length);
  const method = await page.$eval('#segMethod', (e) => e.value);
  const methodVisible = await page.$eval('#methodRow', (e) => e.style.display !== 'none');
  const sliderVisible = await page.$eval('#controlsRow', (e) => e.style.display !== 'none');
  const modeInfo = await page.textContent('#warnings');
  const statsTexts = await page.$$eval('#partsList .part-stats', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));

  console.log('cardCount:', cardCount);
  console.log('metodo selezionato:', method);
  console.log('selettore visibile:', methodVisible, '- slider visibile:', sliderVisible);
  console.log('modeInfo:', modeInfo);
  console.log('statsTexts:', statsTexts);
  console.log('consoleErrors:', consoleErrors);

  await browser.close();

  const ok = cardCount === 2
    && method === 'geometry'
    && methodVisible && sliderVisible
    && /forma/i.test(modeInfo)
    && consoleErrors.length === 0;
  console.log(ok ? '\nRISULTATO: TEST GEOMETRIA SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
