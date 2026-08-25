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
  const cutRowVisible = await page.$eval('#cutRow', (e) => e.style.display !== 'none');

  // attiva il ritaglio
  await page.click('#cutToggleBtn');
  const controlsVisible = await page.$eval('#cutControls', (e) => e.style.display !== 'none');

  // questo test verifica il PENNELLO A MANO: la selezione intelligente
  // (un clic = tutta la zona) e' un'altra strada, provata da e2e-test-organico
  await page.$eval('#smartSelChk', (e) => { e.checked = false; e.dispatchEvent(new Event('change')); });
  // riduci il raggio per una selezione parziale
  await page.$eval('#cutRadius', (e) => { e.value = '10'; e.dispatchEvent(new Event('input')); });

  // tap al centro del canvas (il modello è inquadrato al centro)
  const box = await page.$eval('#viewer', (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(300);

  const createLabel = await page.textContent('#cutCreateBtn');
  const createEnabled = await page.$eval('#cutCreateBtn', (b) => !b.disabled);
  console.log('selezione dopo tap:', createLabel, '- abilitato:', createEnabled);

  // undo: annulla l'ultimo tocco -> selezione vuota -> crea disabilitato
  await page.click('#cutUndoBtn');
  await page.waitForTimeout(200);
  const disabledAfterUndo = await page.$eval('#cutCreateBtn', (b) => b.disabled);
  console.log('crea disabilitato dopo undo:', disabledAfterUndo);

  // ripeti il tap per riselezionare
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(300);
  const reEnabled = await page.$eval('#cutCreateBtn', (b) => !b.disabled);

  // gomma: rimuovi dove tocchi -> selezione di nuovo vuota
  await page.click('#cutModeEraseBtn');
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(300);
  const disabledAfterErase = await page.$eval('#cutCreateBtn', (b) => b.disabled);
  console.log('crea disabilitato dopo gomma:', disabledAfterErase);

  // torna in aggiunta e riseleziona per creare la parte
  await page.click('#cutModeAddBtn');
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(300);

  let cardsAfter = cardsBefore;
  const finalEnabled = await page.$eval('#cutCreateBtn', (b) => !b.disabled);
  if (finalEnabled) {
    await page.click('#cutCreateBtn');
    await page.waitForTimeout(800);
    cardsAfter = await page.$$eval('#partsList .part-card', (els) => els.length);
  }

  const partNames = await page.$$eval('#partsList .part-name', (els) => els.map((e) => e.value));
  console.log('parti prima:', cardsBefore, '- dopo:', cardsAfter, '- nomi:', partNames);
  console.log('consoleErrors:', consoleErrors);

  await browser.close();

  const ok = cutRowVisible && controlsVisible && createEnabled
    && disabledAfterUndo && reEnabled && disabledAfterErase
    && cardsAfter === cardsBefore + 1
    && partNames.some((n) => /^ritaglio/.test(n))
    && consoleErrors.length === 0;
  console.log(ok ? '\nRISULTATO: TEST RITAGLIO SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
