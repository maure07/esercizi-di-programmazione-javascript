// La COPERTA: telo di taglio finito e deformabile. Verifica che
//  - compaia con le sue 25 maniglie
//  - una maniglia si possa TRASCINARE col mouse (non solo via codice)
//  - il taglio stacchi solo la mano, lasciando il busto intero
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('dialog', async (d) => { console.log('  [avviso]', d.message().split('\n')[0]); await d.accept(); });
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/mano_diagonale.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 30000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 40000 });
  await p.waitForTimeout(400);

  await p.click('#cutToggleBtn'); await p.waitForTimeout(200);
  await p.click('#cutToolCopertaBtn'); await p.waitForTimeout(500);
  const controlliVisibili = await p.isVisible('#copertaControls');
  const punti = await p.evaluate(() => window.__copertaPunti());
  console.log('controlli coperta visibili:', controlliVisibili, '| maniglie:', punti ? punti.length / 3 : 0);
  if (!punti || punti.length !== 75) { console.log('coperta non creata'); await b.close(); process.exitCode = 1; return; }

  // TRASCINAMENTO VERO col mouse: si cerca sullo schermo un pixel dove il
  // raycast trova una maniglia, poi si trascina di 60 px e si verifica che
  // quel punto si sia davvero spostato in 3D.
  const box = await (await p.$('#viewer')).boundingBox();
  let preso = -1, px = 0, py = 0;
  for (let gx = 0.25; gx <= 0.75 && preso < 0; gx += 0.05) {
    for (let gy = 0.25; gy <= 0.75 && preso < 0; gy += 0.05) {
      const x = box.x + box.width * gx, y = box.y + box.height * gy;
      const k = await p.evaluate(([a, c]) => window.viewerCoperta ? -1 : -1, [x, y]).catch(() => -1);
      const kk = await p.evaluate(([a, c]) => {
        // usa la stessa funzione del visualizzatore
        return window.__maniglieSotto ? window.__maniglieSotto(a, c) : -1;
      }, [x, y]).catch(() => -1);
      if (kk >= 0) { preso = kk; px = x; py = y; }
    }
  }
  if (preso < 0) { console.log('nessuna maniglia trovata sullo schermo'); await b.close(); process.exitCode = 1; return; }
  const prima = (await p.evaluate(() => window.__copertaPunti())).slice(preso * 3, preso * 3 + 3);
  await p.mouse.move(px, py);
  await p.mouse.down();
  await p.mouse.move(px + 60, py - 40, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(300);
  const dopo = (await p.evaluate(() => window.__copertaPunti())).slice(preso * 3, preso * 3 + 3);
  const spostata = Math.hypot(dopo[0] - prima[0], dopo[1] - prima[1], dopo[2] - prima[2]);
  console.log(`maniglia ${preso} trascinata col mouse di ${spostata.toFixed(1)} mm`);

  // la vista NON deve essersi girata mentre trascinavo
  const cam = await p.evaluate(() => window.__viewerCam());
  console.log('camera dopo il trascinamento:', cam.map((v) => v.toFixed(0)));

  // PALLINO BLU: deve spostare TUTTO il telo, senza deformarlo
  const iCentro = await p.evaluate(() => window.__copertaIndiceCentro());
  let cx = 0, cy = 0, blu = false;
  for (let gx = 0.2; gx <= 0.8 && !blu; gx += 0.03) {
    for (let gy = 0.2; gy <= 0.8 && !blu; gy += 0.03) {
      const x = box.x + box.width * gx, y = box.y + box.height * gy;
      const k = await p.evaluate(([a, c]) => window.__maniglieSotto(a, c), [x, y]);
      if (k === iCentro) { blu = true; cx = x; cy = y; }
    }
  }
  console.log('pallino centrale trovato sullo schermo:', blu);
  let spostatoTutto = false, formaIntatta = false;
  if (blu) {
    const pre = await p.evaluate(() => window.__copertaPunti());
    await p.mouse.move(cx, cy); await p.mouse.down();
    await p.mouse.move(cx + 90, cy + 50, { steps: 10 }); await p.mouse.up();
    await p.waitForTimeout(300);
    const post = await p.evaluate(() => window.__copertaPunti());
    // ogni punto deve essersi spostato dello STESSO vettore (traslazione pura)
    const d0 = [post[0] - pre[0], post[1] - pre[1], post[2] - pre[2]];
    let scartoMax = 0;
    for (let i = 0; i < pre.length; i += 3) {
      for (let k = 0; k < 3; k++) scartoMax = Math.max(scartoMax, Math.abs((post[i + k] - pre[i + k]) - d0[k]));
    }
    const dist = Math.hypot(d0[0], d0[1], d0[2]);
    spostatoTutto = dist > 5;
    formaIntatta = scartoMax < 0.001;
    console.log(`telo spostato di ${dist.toFixed(1)} mm; deformazione residua ${scartoMax.toFixed(6)} mm`);
  }

  const primaParti = await p.evaluate(() => window.__partsBBox());
  await p.click('#copertaCutBtn');
  await p.waitForFunction((k) => window.__partsInfo().length > k, primaParti.length, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const dopoParti = await p.evaluate(() => window.__partsBBox());
  console.log('parti:', primaParti.length, '->', dopoParti.length);
  dopoParti.forEach((x) => console.log('   ', x.name, 'vol', x.vol.toFixed(0),
    'min', x.bboxMin.map((v) => v.toFixed(0)), 'max', x.bboxMax.map((v) => v.toFixed(0))));

  await p.screenshot({ path: `${dir}/coperta-shot.png` });
  await b.close();

  const cresciute = dopoParti.length > primaParti.length;
  const nuovi = dopoParti.filter((x) => /perno|foro|sopra|sotto/.test(x.name));
  const grande = dopoParti.slice().sort((a, c) => c.vol - a.vol)[0];
  // il busto (cilindro r=60, z -130..130 circa) deve restare intero
  const bustoIntero = grande && (grande.bboxMax[2] - grande.bboxMin[2]) > 200;
  const ok = controlliVisibili && spostata > 1 && cresciute && nuovi.length >= 2 && bustoIntero
    && blu && spostatoTutto && formaIntatta && errs.length === 0;
  console.log('maniglia trascinabile:', spostata > 1, '| taglio eseguito:', cresciute,
    '| busto intero:', bustoIntero,
    '| pallino blu sposta tutto:', spostatoTutto, '| senza deformare:', formaIntatta);
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: COPERTA OK' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
