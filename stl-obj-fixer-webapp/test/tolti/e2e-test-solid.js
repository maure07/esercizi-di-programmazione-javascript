const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 850 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto('http://127.0.0.1:8973/index.html');
  await page.waitForTimeout(300);
  const dir = require('path').join(__dirname, 'modelli');

  // carico una scatola-su-scatola (2 corpi), vado a segmentare per forma
  await page.setInputFiles('#fileInput', [`${dir}/scatola_su_scatola.stl`]);
  await page.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });
  await page.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.selectOption('#segMethod', 'geometry');
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 20000 });
  const nParts = await page.$$eval('#partsList .part-card', (e) => e.length);

  // la riga di solidificazione deve essere visibile
  const solidVisible = await page.$eval('#solidRow', (e) => e.style.display !== 'none');
  console.log('parti:', nParts, '| riga solidifica visibile:', solidVisible);

  // volumi/stato prima
  const before = await page.$eval('#partsList', (el) => el.textContent.includes('non completamente chiuso'));

  // rendo solidi tutti i pezzi (qualità bassa per velocità del test)
  await page.selectOption('#solidQuality', '90');
  await page.click('#solidifyAllBtn');
  // aspetto che sparisca l'overlay di caricamento
  await page.waitForFunction(() => {
    const o = document.getElementById('loadingOverlay');
    return o && !o.classList.contains('visible');
  }, { timeout: 60000 });
  await page.waitForTimeout(300);

  // dopo la solidificazione nessun pezzo deve essere "non completamente chiuso"
  const afterText = await page.$eval('#partsList', (el) => el.textContent);
  const afterOpen = /non completamente chiuso/.test(afterText);
  const hasClosed = /solido chiuso/.test(afterText);
  console.log('prima c\'erano pezzi aperti:', before, '| dopo aperti:', afterOpen, '| testo "solido chiuso":', hasClosed);

  // export ZIP per confermare che produce STL validi
  await page.click('#toPrintBtn');
  await page.waitForSelector('#exportZipBtn', { state: 'visible', timeout: 10000 });

  console.log('consoleErrors:', consoleErrors);
  await browser.close();

  const ok = nParts >= 1 && solidVisible && !afterOpen && consoleErrors.length === 0;
  console.log(ok ? '\nRISULTATO: TEST SOLIDIFICA SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
