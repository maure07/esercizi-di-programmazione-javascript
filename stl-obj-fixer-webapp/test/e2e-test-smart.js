const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/gamba_scarpa.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 30000 });
  await p.waitForTimeout(400);
  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);
  // vista frontale, così la scarpa sta in basso
  await p.keyboard.press('1'); await p.waitForTimeout(600);

  const box = await (await p.$('#viewer')).boundingBox();
  // trova un punto che colpisca la GAMBA (z alto: la scarpa sta sotto z=12)
  let px = null, py = null, zColpito = null;
  for (const fy of [0.5, 0.55, 0.6, 0.45, 0.65]) {
    const x = box.x + box.width/2, y = box.y + box.height*fy;
    const h = await p.evaluate(([a,c]) => window.__raycast(a,c), [x,y]);
    if (h && h.z > 20) { px = x; py = y; zColpito = h.z; break; }
  }
  if (px === null) { console.log('non trovo un punto sulla gamba'); process.exitCode = 1; await b.close(); return; }
  console.log('clic sulla gamba, quota colpita z =', zColpito.toFixed(1));

  await p.mouse.click(px, py);
  await p.waitForTimeout(900);
  const info = await p.evaluate(() => window.__cutInfo());
  const zone = await p.evaluate(() => window.__selezioneZ ? window.__selezioneZ() : null);
  console.log('selezione dopo un clic:', JSON.stringify(info));
  console.log('quote della selezione:', JSON.stringify(zone));
  await p.screenshot({ path: `${dir}/smart-shot.png` });
  await b.close();
  // deve prendere una bella fetta di gamba, contigua, e FERMARSI prima
  // della scarpa (che sta sotto z=12): il bordo scarpa/gamba e' una piega
  // deve prendere una zona ampia e CONTIGUA, senza dilagare su tutto:
  // lo spigolo scarpa/gamba e' una valle e deve fare da muro
  const tot = await 0;
  const ok = info && info.count > 20 && info.components === 1 && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: UN CLIC SELEZIONA LA ZONA GIUSTA' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
