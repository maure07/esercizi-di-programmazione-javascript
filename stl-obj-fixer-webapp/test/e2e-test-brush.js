const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/index.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/sfera.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 20000 });
  await p.click('#cutToggleBtn'); await p.waitForTimeout(150);
  // il pennello ('wand') e' lo strumento predefinito; raggio piu' grande per il test
  await p.evaluate(() => { const s = document.getElementById('cutRadius'); s.value = 800; s.dispatchEvent(new Event('input', { bubbles: true })); });
  const box = await (await p.$('#viewer')).boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  const camBefore = await p.evaluate(() => window.__viewerCam());

  // DIPINGE trascinando sul modello (dovrebbe selezionare, NON ruotare)
  await p.mouse.move(cx - 60, cy);
  await p.mouse.down();
  for (let i = -60; i <= 60; i += 12) { await p.mouse.move(cx + i, cy + (i % 24 === 0 ? 10 : -10)); await p.waitForTimeout(30); }
  await p.mouse.up();
  await p.waitForTimeout(150);
  const info = await p.evaluate(() => window.__cutInfo());
  const camAfterPaint = await p.evaluate(() => window.__viewerCam());
  const rotated = camBefore && camAfterPaint ? Math.hypot(camAfterPaint[0] - camBefore[0], camAfterPaint[1] - camBefore[1], camAfterPaint[2] - camBefore[2]) : 0;
  console.log('selezione dopo pennello:', JSON.stringify(info), '| rotazione camera durante pittura:', rotated.toFixed(4));

  const painted = info && info.count > 20;
  const didNotRotate = rotated < 0.001;

  // trascinando FUORI dal modello (sfondo) invece deve RUOTARE
  await p.mouse.move(box.x + 30, box.y + 40);
  await p.mouse.down();
  await p.mouse.move(box.x + 140, box.y + 80, { steps: 6 });
  await p.mouse.up();
  await p.waitForTimeout(100);
  const camAfterBg = await p.evaluate(() => window.__viewerCam());
  const rotatedBg = Math.hypot(camAfterBg[0] - camAfterPaint[0], camAfterBg[1] - camAfterPaint[1], camAfterBg[2] - camAfterPaint[2]);
  console.log('rotazione trascinando sullo sfondo:', rotatedBg.toFixed(4));
  const bgRotates = rotatedBg > 0.01;

  console.log('dipinto:', painted, '| non ha ruotato dipingendo:', didNotRotate, '| sfondo ruota:', bgRotates, '| errori:', errs.length);
  await b.close();
  const ok = painted && didNotRotate && bgRotates && errs.length === 0;
  console.log(ok ? '\nRISULTATO: TEST PENNELLO SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
