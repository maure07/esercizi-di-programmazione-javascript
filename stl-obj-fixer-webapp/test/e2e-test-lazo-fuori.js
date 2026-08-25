// Il difetto segnalato: "ho preso tutta la cintura ma ha selezionato solo
// questa riga". Per circondare una cintura servono punti ai lati, SULLO SFONDO:
// prima venivano buttati via e il cappio si schiacciava in una striscia.
// Qui il cappio si disegna volutamente piu' largo del modello.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  // Questo test usa goku_vero.stl, che pesa 19 MB e sta fuori dal
  // repository: senza, si salta invece di fallire.
  if (!require('fs').existsSync(require('path').join(__dirname, 'modelli', 'goku_vero.stl'))) {
    console.log('SALTATO: manca modelli/goku_vero.stl (vedi test/LEGGIMI.md)');
    process.exitCode = 0;
    return;
  }
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('dialog', async (d) => { console.log('  [avviso]', d.message().split('\n')[0]); await d.accept(); });
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/goku_vero.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 60000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 120000 });
  await p.keyboard.press('1'); await p.waitForTimeout(700);
  await p.click('#cutToggleBtn'); await p.waitForTimeout(200);
  await p.click('#cutToolLassoBtn'); await p.waitForTimeout(200);
  // si inquadra la vita
  await p.evaluate(() => window.__viewer.animaVerso({ x: 0, y: 0, z: 1150 }, 900));
  await p.waitForTimeout(1200);

  const box = await p.$eval('#viewer', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  // rettangolo attorno alla vita che ESCE dai fianchi: i due lati cadono sullo
  // sfondo, e prima non si potevano mettere
  const centro = await p.evaluate(() => window.__proietta(0, 0, 1150));
  console.log('riquadro del visualizzatore:', Math.round(box.w), 'x', Math.round(box.h),
    '| centro della vita sullo schermo x=', Math.round(centro.x));
  const pts = [];
  // il cappio deve stare dentro al riquadro del visualizzatore, ma uscire dai
  // fianchi del modello
  const RX = Math.min(centro.x - 20, box.w - centro.x - 20, 420), RY = 90;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pts.push([centro.x + RX * Math.cos(a), centro.y + RY * Math.sin(a)]);
  }
  let fuori = 0;
  for (const [x, y] of pts) {
    const dentro = await p.evaluate(([cx, cy]) => !!window.__raycast(cx, cy), [box.l + x, box.t + y]);
    if (!dentro) fuori++;
    await p.mouse.click(box.l + x, box.t + y);
    await p.waitForTimeout(50);
  }
  console.log('punti del cappio caduti sullo sfondo:', fuori, 'su', pts.length);
  const messi = await p.evaluate(() => window.__lassoCount());
  console.log('punti effettivamente registrati:', messi);
  await p.click('#cutLassoCloseBtn');
  await p.waitForTimeout(1200);
  const sel = await p.evaluate(() => window.__selInfo());
  console.log('selezione:', JSON.stringify(sel && { facce: sel.facce,
    mn: sel.bboxMin.map(Math.round), mx: sel.bboxMax.map(Math.round) }));
  await b.close();
  if (!sel) { console.log('nessuna selezione'); process.exitCode = 1; return; }
  const tuttiRegistrati = messi === pts.length;
  // deve prendere una FASCIA che gira attorno alla vita (davanti e dietro),
  // non una riga sottile
  const gira = sel.bboxMin[1] < -80 && sel.bboxMax[1] > 80;
  const larga = (sel.bboxMax[0] - sel.bboxMin[0]) > 150 && sel.facce > 4000;
  console.log('tutti i punti registrati:', tuttiRegistrati, '| gira attorno alla vita:', gira, '| fascia piena:', larga);
  if (errs.length) console.log('errori:', errs);
  const ok = fuori > 0 && tuttiRegistrati && gira && larga && errs.length === 0;
  console.log(ok ? '\nRISULTATO: LAZO CON PUNTI FUORI DAL MODELLO OK' : '\nRISULTATO: IL LAZO PERDE I PUNTI FUORI DAL MODELLO');
  process.exitCode = ok ? 0 : 1;
})();
