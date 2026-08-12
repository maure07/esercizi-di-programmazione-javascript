const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 850 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto('http://127.0.0.1:8973/index.html');
  await page.waitForTimeout(300);

  const dir = require('path').join(__dirname, 'modelli');
  // fixture con colori allineati (rosso/blu) per il riepilogo filamenti
  await page.setInputFiles('#fileInput', [
    `${dir}/texture_fixture.obj`, `${dir}/texture_fixture.mtl`, `${dir}/texture_test.png`,
  ]);
  await page.waitForSelector('#toSegmentBtn', { timeout: 30000 });
  await page.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 15000 });

  // vai al menu Stampa
  await page.click('#toPrintBtn');
  await page.waitForTimeout(300);
  const printVisible = await page.$eval('#printPanel', (e) => e.style.display !== 'none');
  const summary = await page.textContent('#filamentSummary');
  console.log('riepilogo:', summary.replace(/\s+/g, ' ').trim());
  const summaryOk = /rosso/.test(summary) && /blu/.test(summary) && /Totale/.test(summary);

  // vista esplosa on/off senza errori
  await page.click('#explodeBtn');
  await page.waitForTimeout(200);
  const explodeActive = await page.$eval('#explodeBtn', (b) => b.classList.contains('active'));
  await page.click('#explodeBtn');

  // export ZIP con appoggio piano attivo (default)
  const layFlatChecked = await page.$eval('#layFlatChk', (c) => c.checked);
  const [zipDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportZipBtn'),
  ]);
  await zipDownload.saveAs(`${dir}/print-export.zip`);

  // salva progetto
  const [projDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#saveProjectBtn'),
  ]);
  const projPath = `${dir}/progetto_test.json`;
  await projDownload.saveAs(projPath);

  // ricarica la pagina e riapri il progetto
  await page.reload();
  await page.waitForTimeout(300);
  await page.setInputFiles('#fileInput', [projPath]);
  await page.waitForSelector('#partsList .part-card', { timeout: 20000 });
  const cardsAfterLoad = await page.$$eval('#partsList .part-card', (els) => els.length);
  const namesAfterLoad = await page.$$eval('#partsList .part-name', (els) => els.map((e) => e.value));
  console.log('parti dopo riapertura progetto:', cardsAfterLoad, namesAfterLoad);
  console.log('consoleErrors:', consoleErrors);

  await browser.close();

  const zipOk = fs.statSync(`${dir}/print-export.zip`).size > 500;
  const ok = printVisible && summaryOk && explodeActive && layFlatChecked && zipOk
    && cardsAfterLoad === 2 && namesAfterLoad.includes('rosso') && namesAfterLoad.includes('blu')
    && consoleErrors.length === 0;
  console.log(ok ? '\nRISULTATO: TEST STAMPA SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
