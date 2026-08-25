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
  // riusiamo il fixture con texture: cubo "testa" 2x2x2 -> dimensione massima attesa 2 (unita' grezze)
  await page.setInputFiles('#fileInput', [
    `${dir}/texture_fixture.obj`,
    `${dir}/texture_fixture.mtl`,
    `${dir}/texture_test.png`,
  ]);
  await page.waitForSelector('#toSegmentBtn', { timeout: 30000 });
  await page.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 15000 });
  await page.waitForTimeout(300);

  const hintBefore = await page.textContent('#scaleHint');
  const statsBefore = await page.$$eval('#partsList .part-stats', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  console.log('hintBefore:', hintBefore);
  console.log('statsBefore:', statsBefore);

  // il modello (testa+cappello) ha dimensione massima grezza ~2.8 (2 base + 0.8 cappello sopra)
  // impostiamo l'altezza reale a 15 cm -> 150mm
  await page.fill('#scaleHeight', '15');
  await page.click('#scaleApplyBtn');
  await page.waitForTimeout(300);

  const hintAfter = await page.textContent('#scaleHint');
  const statsAfter = await page.$$eval('#partsList .part-stats', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  console.log('hintAfter:', hintAfter);
  console.log('statsAfter:', statsAfter);

  // riapplichiamo un ricalcolo (resegment) e verifichiamo che la scala resti applicata
  await page.click('#resegmentBtn');
  await page.waitForTimeout(300);
  const hintAfterResegment = await page.textContent('#scaleHint');
  console.log('hintAfterResegment:', hintAfterResegment);

  await browser.close();

  const maxAfterMatch = /rilevata: (\d+) mm/.exec(hintAfter);
  const maxAfterValue = maxAfterMatch ? parseInt(maxAfterMatch[1], 10) : null;
  const maxAfterResegMatch = /rilevata: (\d+) mm/.exec(hintAfterResegment);
  const maxAfterResegValue = maxAfterResegMatch ? parseInt(maxAfterResegMatch[1], 10) : null;

  console.log('maxAfterValue:', maxAfterValue, 'maxAfterResegValue:', maxAfterResegValue);
  console.log('consoleErrors:', consoleErrors);

  const ok = maxAfterValue === 150 && maxAfterResegValue === 150 && consoleErrors.length === 0;
  console.log(ok ? '\nRISULTATO: TEST SCALA SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
