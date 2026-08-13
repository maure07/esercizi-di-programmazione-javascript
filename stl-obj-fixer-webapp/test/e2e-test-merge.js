const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 850 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto('http://127.0.0.1:8973/index.html');
  await page.waitForTimeout(300);

  const fixtureDir = require('path').join(__dirname, '..', 'esempio');
  await page.setInputFiles('#fileInput', [`${fixtureDir}/funko_esempio.obj`, `${fixtureDir}/funko_esempio.mtl`]);
  await page.waitForSelector('#toSegmentBtn', { timeout: 30000 });
  await page.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await page.waitForSelector('#partsList .part-card', { timeout: 15000 });
  await page.waitForTimeout(300);

  const cardCountBefore = await page.$$eval('#partsList .part-card', (els) => els.length);
  const mergeBtnCount = await page.$$eval('button', (els) => els.filter((b) => b.textContent.includes('Unisci con la parte principale')).length);
  console.log('cardCountBefore:', cardCountBefore, 'mergeBtnCount:', mergeBtnCount);

  const mergeBtn = await page.$('button:has-text("Unisci con la parte principale")');
  await mergeBtn.click();
  await page.waitForTimeout(300);

  const cardCountAfter = await page.$$eval('#partsList .part-card', (els) => els.length);
  const mainStats = await page.$eval('#partsList .part-stats', (e) => e.textContent.replace(/\s+/g, ' ').trim());
  const logText = await page.textContent('#log');
  console.log('cardCountAfter:', cardCountAfter);
  console.log('mainStats:', mainStats);
  console.log('logText includes merge note:', /Unita la parte/.test(logText));
  console.log('consoleErrors:', consoleErrors);

  await browser.close();

  const ok = cardCountBefore === 2 && mergeBtnCount === 1 && cardCountAfter === 1 && /Unita la parte/.test(logText) && consoleErrors.length === 0;
  console.log(ok ? '\nRISULTATO: TEST MERGE SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
