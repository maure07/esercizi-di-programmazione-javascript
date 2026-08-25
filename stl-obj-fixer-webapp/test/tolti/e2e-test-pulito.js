const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);

  // --- 1. ROTAZIONE INFINITA: trascinando tanto in verticale non si blocca ---
  await p.setInputFiles('#fileInput', [`${dir}/funko2.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 40000 });
  await p.waitForTimeout(500);
  const box = await (await p.$('#viewer')).boundingBox();
  const cx = box.x + box.width/2, cy = box.y + box.height/2;
  const cam0 = await p.evaluate(() => window.__viewerCam());
  // trascinata verticale LUNGA (oltre il polo): prima si bloccava
  await p.mouse.move(cx, cy); await p.mouse.down();
  for (let i=0;i<40;i++){ await p.mouse.move(cx, cy - i*22); await p.waitForTimeout(8); }
  await p.mouse.up(); await p.waitForTimeout(150);
  const cam1 = await p.evaluate(() => window.__viewerCam());
  // dopo aver superato il polo la camera deve essere DALL'ALTRA PARTE (y opposto)
  const superato = Math.sign(cam1[1]) !== Math.sign(cam0[1]) || Math.abs(cam1[1]-cam0[1]) > 1;
  console.log('rotazione oltre il polo: y da', cam0[1].toFixed(1), 'a', cam1[1].toFixed(1), '->', superato ? 'GIRA' : 'BLOCCATA');

  // continua a girare ancora: non deve fermarsi mai
  await p.mouse.move(cx, cy); await p.mouse.down();
  for (let i=0;i<40;i++){ await p.mouse.move(cx, cy - i*22); await p.waitForTimeout(8); }
  await p.mouse.up(); await p.waitForTimeout(150);
  const cam2 = await p.evaluate(() => window.__viewerCam());
  const continua = Math.hypot(cam2[0]-cam1[0],cam2[1]-cam1[1],cam2[2]-cam1[2]) > 1;
  console.log('continua a girare all infinito:', continua);

  // --- 2. SEGMENTAZIONE PULITA sul modello rumoroso ---
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.waitForTimeout(300);
  await p.click('#segmentAiBtn');
  await p.waitForSelector('#partsList .part-card', { timeout: 180000 });
  await p.waitForTimeout(500);
  const parti = await p.evaluate(() => window.__partsInfo());
  const tot = parti.reduce((s,x)=>s+x.tris,0);
  const chiazze = parti.filter(x => x.tris < tot*0.03).length;
  console.log('parti:', parti.length, '| chiazzine sotto il 3%:', chiazze);
  parti.forEach(x=>console.log('    ', x.name, x.tris));
  await p.screenshot({ path: `${dir}/pulito-shot.png` });

  await b.close();
  const ok = superato && continua && parti.length <= 6 && chiazze <= 3 && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: ROTAZIONE INFINITA + SEGMENTAZIONE PULITA OK' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
