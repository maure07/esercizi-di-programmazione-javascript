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
  await page.setInputFiles('#fileInput', [`${dir}/scatola_su_scatola.stl`]);
  await page.waitForSelector('#toSegmentBtn', { timeout: 30000 });
  await page.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 15000 });
  await page.waitForTimeout(500);

  const cardsBefore = await page.$$eval('#partsList .part-card', (els) => els.length);

  await page.click('#cutToggleBtn');
  await page.click('#cutToolLassoBtn');

  const box = await page.$eval('#viewer', (e) => {
    const r = e.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  });

  // 4 punti attorno alla zona centrale del modello
  const pts = [
    [box.cx - 60, box.cy - 80],
    [box.cx + 60, box.cy - 80],
    [box.cx + 60, box.cy + 80],
    [box.cx - 60, box.cy + 80],
  ];
  for (const [x, y] of pts) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(150);
  }

  const closeBtnVisible = await page.$eval('#cutLassoCloseBtn', (e) => e.style.display !== 'none');
  console.log('pulsante Chiudi visibile:', closeBtnVisible);

  await page.click('#cutLassoCloseBtn');
  await page.waitForTimeout(400);

  const createLabel = await page.textContent('#cutCreateBtn');
  const createEnabled = await page.$eval('#cutCreateBtn', (b) => !b.disabled);
  console.log('dopo chiusura lazo:', createLabel, '- abilitato:', createEnabled);

  let cardsAfter = cardsBefore;
  if (createEnabled) {
    await page.click('#cutCreateBtn');
    await page.waitForTimeout(800);
    cardsAfter = await page.$$eval('#partsList .part-card', (els) => els.length);
  }
  const partNames = await page.$$eval('#partsList .part-name', (els) => els.map((e) => e.value));
  console.log('parti prima:', cardsBefore, '- dopo:', cardsAfter, '- nomi:', partNames);
  console.log('consoleErrors:', consoleErrors);

  await browser.close();

  const ok = closeBtnVisible && createEnabled
    && cardsAfter === cardsBefore + 1
    && partNames.some((n) => /^ritaglio/.test(n))
    && consoleErrors.length === 0;
  console.log(ok ? '\nRISULTATO: TEST LAZO SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
