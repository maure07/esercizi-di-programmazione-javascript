const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 850 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto('http://127.0.0.1:8973/artifact-bundle.html');
  await page.waitForTimeout(300);

  const dir = require('path').join(__dirname, 'modelli');
  // cubo con un buco: l'analisi deve rilevarlo SENZA riparare nulla
  await page.setInputFiles('#fileInput', [`${dir}/cubo_con_buco.stl`]);
  await page.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });

  const analysisText = await page.textContent('#analysisReport');
  const stepperVisible = await page.$eval('#stepper', (e) => e.style.display !== 'none');
  const segmentHidden = await page.$eval('#segmentPanel', (e) => e.style.display === 'none');
  console.log('analisi:', analysisText.replace(/\s+/g, ' ').trim());
  const holeDetected = /buchi/.test(analysisText);
  console.log('buco rilevato in analisi:', holeDetected, '- stepper:', stepperVisible, '- segmentazione nascosta:', segmentHidden);

  // scala allo step 1: cubo 10 unita' -> altezza 5 cm -> 50 mm
  await page.fill('#modelHeight', '5');
  await page.click('#applyModelScaleBtn');
  await page.waitForTimeout(600);
  const analysisAfterScale = await page.textContent('#analysisReport');
  const scaled = /50(,0)?×50(,0)?×50/.test(analysisAfterScale.replace(/\s/g, ''));
  console.log('dimensioni dopo scala:', analysisAfterScale.match(/Dimensioni:[^m]*mm/)?.[0], '- scala applicata:', scaled);

  // step 2: ripara
  await page.click('#repairBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#downloadRepairedBtn', { state: 'visible', timeout: 20000 });
  const repairText = await page.textContent('#repairReport');
  console.log('riparazione:', repairText.replace(/\s+/g, ' ').trim());
  const repaired = /watertight|chiuso/i.test(repairText);

  // step 3: segmenta
  await page.click('#toSegmentBtn2');
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 20000 });
  const cardCount = await page.$$eval('#partsList .part-card', (els) => els.length);
  console.log('parti dopo segmentazione:', cardCount);
  console.log('consoleErrors:', consoleErrors);

  await browser.close();

  const ok = holeDetected && stepperVisible && segmentHidden && scaled && repaired && cardCount === 1 && consoleErrors.length === 0;
  console.log(ok ? '\nRISULTATO: TEST STEP SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
