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
  // entro in ritaglio: sul modello il sinistro dipinge, ma il CENTRALE deve ruotare
  await p.click('#cutToggleBtn'); await p.waitForTimeout(150);
  const box = await (await p.$('#viewer')).boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  const cam0 = await p.evaluate(() => window.__viewerCam());
  // MIDDLE-drag sopra il modello -> deve RUOTARE (non dipingere)
  await p.mouse.move(cx, cy);
  await p.mouse.down({ button: 'middle' });
  await p.mouse.move(cx + 120, cy + 30, { steps: 8 });
  await p.mouse.up({ button: 'middle' });
  await p.waitForTimeout(100);
  const cam1 = await p.evaluate(() => window.__viewerCam());
  const rotMiddle = Math.hypot(cam1[0] - cam0[0], cam1[1] - cam0[1], cam1[2] - cam0[2]);
  const sel = await p.evaluate(() => window.__cutInfo());
  console.log('rotazione col centrale sopra il modello:', rotMiddle.toFixed(3), '| selezione (deve essere vuota):', JSON.stringify(sel));

  // WHEEL sopra il modello -> deve ZOOMARE (camera si avvicina)
  const before = Math.hypot(cam1[0], cam1[1], cam1[2]);
  await p.mouse.move(cx + 40, cy - 30);
  await p.mouse.wheel(0, -300); // scroll up = zoom in
  await p.waitForTimeout(100);
  const cam2 = await p.evaluate(() => window.__viewerCam());
  const after = Math.hypot(cam2[0], cam2[1], cam2[2]);
  const zoomed = Math.abs(after - before) > 0.5;
  console.log('distanza camera prima/dopo rotellina:', before.toFixed(2), after.toFixed(2), '| ha zoomato:', zoomed);

  await b.close();
  const ok = rotMiddle > 0.5 && (!sel || sel.count === 0 || sel.count === undefined) && zoomed && errs.length === 0;
  // nota: sel puo' essere null (nessuna selezione) = corretto
  console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: TEST NAVIGAZIONE SUPERATO' : '\nRISULTATO: ERRORI PRESENTI');
  process.exitCode = ok ? 0 : 1;
})();
