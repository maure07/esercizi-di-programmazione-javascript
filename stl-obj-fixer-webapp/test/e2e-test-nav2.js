const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/sfera.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });
  await p.waitForTimeout(400);

  const cam0 = await p.evaluate(() => window.__viewerCam());
  // tasto 1 = vista frontale
  await p.keyboard.press('1'); await p.waitForTimeout(500);
  const cam1 = await p.evaluate(() => window.__viewerCam());
  const cambiata = Math.hypot(cam1[0]-cam0[0], cam1[1]-cam0[1], cam1[2]-cam0[2]) > 0.01;
  // tasto 7 = dall'alto: asse verticale = Z (convenzione STL/stampa 3D),
  // la camera deve stare molto piu' in alto (Z) che di lato (X/Y)
  await p.keyboard.press('7'); await p.waitForTimeout(500);
  const cam7 = await p.evaluate(() => window.__viewerCam());
  const dallAlto = Math.abs(cam7[2]) > Math.hypot(cam7[0], cam7[1]) * 3;
  console.log('tasto 1 cambia vista:', cambiata, '| tasto 7 guarda dall alto:', dallAlto, '(z=' + cam7[2].toFixed(1) + ')');

  // doppio clic sul modello centra la vista
  const box = await (await p.$('#viewer')).boundingBox();
  await p.keyboard.press('1'); await p.waitForTimeout(400);
  const t0 = await p.evaluate(() => { const v = window.__viewerTarget(); return v; });
  await p.mouse.dblclick(box.x + box.width/2 + 70, box.y + box.height/2 - 40);
  await p.waitForTimeout(600);
  const t1 = await p.evaluate(() => window.__viewerTarget());
  const centrato = Math.hypot(t1[0]-t0[0], t1[1]-t0[1], t1[2]-t0[2]) > 0.01;
  console.log('doppio clic sposta il centro:', centrato);

  // Qui si provava il cursore "sensibilita' dettagli", che stava nella
  // segmentazione sul PC: quella e' stata tolta dal pannello. Al suo posto si
  // controlla il cursore della PROFONDITA' DEL NOCCIOLO, che e' il comando
  // nuovo di quel pannello.
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.waitForTimeout(200);
  await p.click('#saltaSegmBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 120000 });
  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);
  await p.evaluate(() => { const s=document.getElementById('profNocciolo'); s.value=70; s.dispatchEvent(new Event('input',{bubbles:true})); });
  const lbl = await p.textContent('#profNoccioloValue');
  console.log('cursore profondita nocciolo ->', lbl);

  await b.close();
  const ok = cambiata && dallAlto && centrato && lbl === '70%' && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: NAVIGAZIONE PC OK' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
