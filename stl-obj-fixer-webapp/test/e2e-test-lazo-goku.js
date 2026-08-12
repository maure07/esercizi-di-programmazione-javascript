// Il Lazo sul modello VERO (400.000 triangoli, superficie increspata). Qui il
// vecchio metodo usciva a strisce frastagliate perche' i triangoli sono piu'
// piccoli di un pixel. Si disegna un cappio attorno alla testa e si controlla
// che la selezione sia PIENA (non a strisce) e che resti sulla testa.
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
  await p.keyboard.press('1'); await p.waitForTimeout(900);
  await p.click('#cutToggleBtn'); await p.waitForTimeout(200);
  await p.click('#cutToolLassoBtn'); await p.waitForTimeout(200);

  const box = await p.$eval('#viewer', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top }; });
  // cappio attorno alla testa: cerchio nello spazio del modello, a z alto
  const contorno = await p.evaluate(() => {
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const s = window.__proietta(190 * Math.cos(a), 0, 1640 + 200 * Math.sin(a));
      pts.push([s.x, s.y]);
    }
    return pts;
  });
  for (const [x, y] of contorno) { await p.mouse.click(box.l + x, box.t + y); await p.waitForTimeout(50); }
  const t0 = Date.now();
  await p.click('#cutLassoCloseBtn');
  await p.waitForTimeout(1500);
  const ms = Date.now() - t0;
  // secondo cappio: qui la topologia e le geometrie numerate sono gia' pronte,
  // quindi si misura il costo VERO di un lazo, non quello della preparazione.
  await p.evaluate(() => window.__resetSel());
  await p.click('#cutToolLassoBtn'); await p.waitForTimeout(150);
  for (const [x, y] of contorno) { await p.mouse.click(box.l + x, box.t + y); await p.waitForTimeout(40); }
  const t1 = Date.now();
  await p.click('#cutLassoCloseBtn');
  await p.waitForTimeout(50);
  await p.waitForFunction(() => window.__selInfo() !== null, { timeout: 60000 });
  console.log('tempo del secondo lazo (senza preparazione):', Date.now() - t1, 'ms');
  const sel = await p.evaluate(() => window.__selInfo());
  console.log('tempo chiusura lazo:', ms, 'ms');
  console.log('selezione:', JSON.stringify(sel && { parte: sel.parte, facce: sel.facce, totale: sel.totale,
    mn: sel.bboxMin.map(v => Math.round(v)), mx: sel.bboxMax.map(v => Math.round(v)) }));
  if (!sel) { console.log('nessuna selezione'); await b.close(); process.exitCode = 1; return; }
  // COMPATTEZZA: una selezione "a strisce" e' fatta di tante isole staccate.
  // Una buona selezione e' una macchia sola (o poche).
  const isole = await p.evaluate(() => window.__isoleSelezione());
  console.log('isole della selezione:', isole.numero, '| la piu grande copre il', Math.round(isole.frazioneMaggiore * 100) + '%');
  // SECONDA PROVA: cappio piccolo, tutto dentro la sagoma del petto. Qui la
  // schiena sta dietro e NON deve entrare: se entra, il Lazo sta ancora
  // prendendo quello che non si vede.
  await p.evaluate(() => window.__resetSel());
  const petto = await p.evaluate(() => {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      pts.push(window.__proietta(45 * Math.cos(a), 0, 1330 + 45 * Math.sin(a)));
    }
    window.__cronoLazo(pts);
    return window.__selInfo();
  });
  console.log('petto:', JSON.stringify({ facce: petto.facce,
    mn: petto.bboxMin.map(Math.round), mx: petto.bboxMax.map(Math.round) }));
  // il davanti del petto sta a y positiva; la schiena a y negativa
  const soloDavanti = petto.bboxMin[1] > 0;
  console.log('il cappio piccolo prende solo il davanti:', soloDavanti);

  await b.close();
  const compatta = isole.frazioneMaggiore > 0.9;
  const sullaTesta = sel.bboxMin[2] > 1250;   // non deve scendere sul busto
  const abbastanza = sel.facce > 8000;        // deve prendere la testa, non una striscia
  console.log('compatta:', compatta, '| resta sulla testa:', sullaTesta, '| abbastanza piena:', abbastanza);
  if (errs.length) console.log('errori:', errs);
  const ok = compatta && sullaTesta && abbastanza && soloDavanti && errs.length === 0;
  console.log(ok ? '\nRISULTATO: LAZO SUL MODELLO VERO OK' : '\nRISULTATO: LAZO ANCORA DIFETTOSO');
  process.exitCode = ok ? 0 : 1;
})();
