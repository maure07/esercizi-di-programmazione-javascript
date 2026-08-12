// Il difetto segnalato: "quando chiudo la selezione mi da' tutt'altro al di
// fuori di quello selezionato". Il cappio si disegna sullo SCHERMO, quindi
// dentro ci finisce anche cio' che sta DIETRO. Qui c'e' una ciocca di capelli
// davanti a una testa fitta di triangoli: il cappio attorno alla ciocca deve
// prendere la ciocca e non la testa.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('dialog', async (d) => { console.log('  [avviso]', d.message().split('\n')[0]); await d.accept(); });
  const dir = require('path').join(__dirname, 'modelli');
  const passante = process.argv[2] === 'passante';
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/ciocca_su_testa.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 30000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 40000 });
  await p.waitForTimeout(500);
  await p.keyboard.press('1');            // vista di fronte (si guarda da +Y)
  await p.waitForTimeout(600);
  await p.click('#cutToggleBtn'); await p.waitForTimeout(200);
  await p.click('#cutToolLassoBtn'); await p.waitForTimeout(200);
  if (passante) await p.evaluate(() => { document.getElementById('lassoThroughChk').checked = true; });

  const box = await p.$eval('#viewer', (e) => {
    const r = e.getBoundingClientRect(); return { l: r.left, t: r.top };
  });
  // il cappio segue il contorno della ciocca proiettato sullo schermo
  const contorno = await p.evaluate(() => {
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      // ellisse attorno alla ciocca (raggio 18 in x, 21.6 in z, centro z=30)
      const s = window.__proietta(15 * Math.cos(a), 46, 32 + 18 * Math.sin(a));
      pts.push([s.x, s.y]);
    }
    return pts;
  });
  for (const [x, y] of contorno) {
    await p.mouse.click(box.l + x, box.t + y);
    await p.waitForTimeout(60);
  }
  await p.click('#cutLassoCloseBtn');
  await p.waitForTimeout(500);

  const sel = await p.evaluate(() => window.__selInfo());
  console.log('selezione:', JSON.stringify(sel));
  if (!sel) { console.log('nessuna selezione'); await b.close(); process.exitCode = 1; return; }

  // ...e sulla selezione fatta col Lazo deve funzionare anche il taglio. La
  // ciocca e' una lamina di pochi millimetri: qui il perno NON va messo (lo
  // sfonderebbe), e il motore deve dirlo chiaramente invece di piazzarlo.
  const prima = await p.evaluate(() => window.__partsInfo().length);
  await p.click('#cutFlatProBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForFunction((k) => window.__partsInfo().length > k, prima, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const info = await p.evaluate(() => window.__partsInfo());
  const log = (info.find((x) => x.log && x.log.length && /Tappo|perno/.test(x.log.join(' '))) || {}).log || [];
  console.log('parti:', prima, '->', info.length);
  log.forEach((l) => console.log('   ', l));
  const tagliato = info.length > prima;
  // il tappo deve essere pulito: faccia piatta con gonnella, oppure il
  // contorno seguito com'e'. Mai la raggiera, che sul pezzo si vede.
  const tappoPulito = log.some((l) => /Faccia di taglio PIATTA|gonnella|niente raggiera/.test(l))
    && !log.some((l) => /a raggiera \(contorno/.test(l));
  const nientePernoSuLamina = log.some((l) => /niente perno/.test(l));
  const tutteChiuse = info.every((x) => x.wt);
  console.log('taglio eseguito:', tagliato, '| tappo pulito (niente raggiera):', tappoPulito,
    '| niente perno sulla lamina sottile:', nientePernoSuLamina, '| tutte chiuse:', tutteChiuse);
  // La ciocca sporge da y=40 in su. La testa sta dietro e arriva a y=-50:
  // se la selezione scende sotto y=0 il lazo ha preso la testa.
  const soloCiocca = sel.bboxMin[1] > 5 && sel.bboxMin[2] > 0;
  console.log('resta sulla ciocca (non prende la testa dietro):', soloCiocca,
    '| facce', sel.facce, 'su', sel.totale, '| errori:', errs.length);
  if (errs.length) console.log(errs);
  await b.close();
  const ok = soloCiocca && sel.facce > 30 && tagliato && tappoPulito
    && nientePernoSuLamina && tutteChiuse && errs.length === 0;
  console.log(ok ? '\nRISULTATO: LAZO IN PROFONDITA OK' : '\nRISULTATO: IL LAZO PRENDE ROBA DIETRO');
  process.exitCode = ok ? 0 : 1;
})();
