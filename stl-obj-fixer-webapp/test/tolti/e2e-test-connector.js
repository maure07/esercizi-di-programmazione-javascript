const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

  await page.goto('http://127.0.0.1:8973/index.html');
  await page.waitForTimeout(300);
  const dir = require('path').join(__dirname, 'modelli');

  await page.setInputFiles('#fileInput', [`${dir}/scatola_su_scatola.stl`]);
  await page.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });
  // scala reale cosi' i connettori in mm hanno senso
  await page.fill('#modelHeight', '6');
  await page.click('#applyModelScaleBtn');
  await page.waitForTimeout(400);
  await page.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.selectOption('#segMethod', 'geometry');
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 20000 });
  const nParts = await page.$$eval('#partsList .part-card', (e) => e.length);

  // la riga connettori deve essere visibile con >1 parte
  const connVisible = await page.$eval('#connectorRow', (e) => e.style.display !== 'none');
  console.log('parti:', nParts, '| riga connettori visibile:', connVisible);

  // attiva connettori (tipo perno+foro di default), qualita' bassa per velocita'
  await page.click('#connectorToggleBtn');
  await page.selectOption('#connQuality', '90');
  await page.waitForTimeout(200);

  // conteggio triangoli prima
  const volBefore = await page.evaluate(() => window.__partsInfo ? window.__partsInfo() : null);

  // tocca al centro-basso della vista (dovrebbe colpire un pezzo)
  const box = await (await page.$('#viewer')).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.62);
  // aspetta fine elaborazione voxel
  await page.waitForFunction(() => {
    const o = document.getElementById('loadingOverlay');
    return o && !o.classList.contains('visible');
  }, { timeout: 60000 });
  await page.waitForTimeout(400);

  const volAfter = await page.evaluate(() => window.__partsInfo ? window.__partsInfo() : null);
  const undoEnabled = await page.$eval('#connUndoBtn', (e) => !e.disabled);
  const allClosed = await page.$eval('#partsList', (e) => !/non completamente chiuso/.test(e.textContent));
  console.log('prima:', JSON.stringify(volBefore), '| dopo:', JSON.stringify(volAfter));
  console.log('undo attivo:', undoEnabled, '| tutti chiusi dopo:', allClosed);

  // annulla: ripristina
  await page.click('#connUndoBtn');
  await page.waitForTimeout(300);
  const volUndo = await page.evaluate(() => window.__partsInfo ? window.__partsInfo() : null);
  console.log('dopo undo:', JSON.stringify(volUndo));

  console.log('consoleErrors:', errs);
  await browser.close();

  const changed = volBefore && volAfter && JSON.stringify(volBefore) !== JSON.stringify(volAfter);
  const ok = nParts >= 2 && connVisible && changed && undoEnabled && allClosed && errs.length === 0;
  console.log(ok ? '\nRISULTATO: TEST CONNETTORE SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
