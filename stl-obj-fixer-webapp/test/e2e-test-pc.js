const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  // viewport da PC (largo)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto('http://127.0.0.1:8973/index.html');
  await page.waitForTimeout(300);

  // 1) layout a colonne attivo su schermo largo
  const bodyDisplay = await page.$eval('body', (b) => getComputedStyle(b).display);
  const sheetBox = await page.$eval('#sheet', (s) => s.getBoundingClientRect().left);
  const viewerBox = await page.$eval('#viewerWrap', (v) => v.getBoundingClientRect().left);
  const twoColumns = bodyDisplay === 'grid' && sheetBox > viewerBox + 200;
  console.log('layout PC (grid, pannello a destra):', twoColumns, '| display:', bodyDisplay);

  const dir = require('path').join(__dirname, 'modelli');
  await page.setInputFiles('#fileInput', [`${dir}/scatola_su_scatola.stl`]);
  await page.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });
  await page.waitForTimeout(400);

  // posizione camera prima del pan
  const camBefore = await page.evaluate(() => window.__viewerCam ? window.__viewerCam() : null);

  // 2) PAN col tasto destro: la camera deve spostarsi
  const canvas = await page.$('#viewer');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(cx + 120, cy + 40, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(150);
  const camAfterPan = await page.evaluate(() => window.__viewerCam ? window.__viewerCam() : null);

  let panned = false;
  if (camBefore && camAfterPan) {
    const d = Math.hypot(camAfterPan[0] - camBefore[0], camAfterPan[1] - camBefore[1], camAfterPan[2] - camBefore[2]);
    panned = d > 0.001;
    console.log('spostamento camera col tasto destro:', d.toFixed(4), '->', panned);
  } else {
    console.log('helper camera non disponibile, salto il controllo numerico del pan');
  }

  // 3) in modalita' taglio/lazo, il tasto destro NON deve mettere punti
  await page.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); // vai a segmenta
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 20000 });
  await page.click('#cutToggleBtn');       // attiva ritaglio
  await page.click('#cutToolLassoBtn');    // strumento lazo
  await page.waitForTimeout(150);
  // click destro sul modello: non deve aggiungere punti
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(100);
  const lassoCountAfterRight = await page.evaluate(() => window.__lassoCount ? window.__lassoCount() : -1);
  // click sinistro invece deve aggiungere un punto (se colpisce il modello)
  await page.mouse.click(cx, cy, { button: 'left' });
  await page.waitForTimeout(100);
  const lassoCountAfterLeft = await page.evaluate(() => window.__lassoCount ? window.__lassoCount() : -1);
  console.log('punti lazo dopo tasto destro:', lassoCountAfterRight, '| dopo tasto sinistro:', lassoCountAfterLeft);
  const rightNoPoint = lassoCountAfterRight === 0;
  const leftAddsPoint = lassoCountAfterLeft >= 1;

  console.log('consoleErrors:', consoleErrors);
  await browser.close();

  const ok = twoColumns && (panned || camBefore === null) && rightNoPoint && leftAddsPoint && consoleErrors.length === 0;
  console.log(ok ? '\nRISULTATO: TEST PC SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
