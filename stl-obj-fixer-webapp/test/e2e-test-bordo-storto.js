// Il caso segnalato: gamba che esce da un pantalone STRAPPATO. Il bordo della
// selezione e' ondulato, non un anello piatto: col piano medio il taglio
// faceva scempio. Verifica che il companion se ne accorga e usi il telo che
// segue il bordo, e che venga staccata SOLO la gamba selezionata.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('dialog', async (d) => { console.log('  [avviso]', d.message().split('\n')[0]); await d.accept(); });
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/gamba_strappo.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 30000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 40000 });
  await p.waitForTimeout(400);
  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);

  // seleziono SOLO la gamba nuda che esce dallo strappo (sotto z=-10)
  const n = await p.evaluate(() => window.__selBox([-45, -45, -140], [45, 45, -60]));
  console.log('triangoli selezionati (solo gamba):', n);
  if (!n) { console.log('selezione vuota'); await b.close(); process.exitCode = 1; return; }

  const piano = await p.evaluate(() => window.__pianoTest());
  console.log('punti di bordo mandati al companion:', piano ? piano.puntiBordo.length / 3 : 0);

  const prima = await p.evaluate(() => window.__partsBBox());
  await p.click('#cutFlatProBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForFunction((k) => window.__partsInfo().length > k, prima.length, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const dopo = await p.evaluate(() => window.__partsBBox());
  const info = await p.evaluate(() => window.__partsInfo());
  const log = (info.find((x) => /perno|foro/.test(x.name) && x.log && x.log.length) || {}).log || [];
  console.log('log del taglio:'); log.forEach((l) => console.log('   ', l));
  console.log('parti:', prima.length, '->', dopo.length);
  dopo.forEach((x) => console.log('   ', x.name, 'vol', x.vol.toFixed(0),
    'min', x.bboxMin.map((v) => v.toFixed(0)), 'max', x.bboxMax.map((v) => v.toFixed(0))));

  // COLORI: il pezzo staccato deve avere un colore DIVERSO da quello d'origine
  const colori = await p.evaluate(() => window.__partsColori());
  console.log('colori:', JSON.stringify(colori));
  let coloriDiversi = true;
  const nuovi = colori.filter((c) => /perno|foro/.test(c.name));
  if (nuovi.length === 2) {
    const d = Math.hypot(nuovi[0].color[0] - nuovi[1].color[0],
      nuovi[0].color[1] - nuovi[1].color[1], nuovi[0].color[2] - nuovi[1].color[2]);
    coloriDiversi = d > 0.15;
    console.log('distanza fra i colori dei due pezzi:', d.toFixed(3));
  }

  // UNDO: deve riportare indietro il taglio
  const storiaPrima = await p.evaluate(() => window.__storiaParti());
  await p.click('#undoPartiBtn');
  await p.waitForTimeout(600);
  const dopoUndo = await p.evaluate(() => window.__partsInfo());
  const undoOk = dopoUndo.length === prima.length;
  console.log('storia prima dell undo:', storiaPrima, '| parti dopo undo:', dopoUndo.length, '(attese', prima.length + ')');

  await b.close();
  const usaTelo = log.some((l) => /esattamente sulla selezione/.test(l));
  const cresciute = dopo.length > prima.length;
  // il pantalone (z fino a 150) deve restare intero
  const grande = dopo.slice().sort((a, c) => c.vol - a.vol)[0];
  const pantaloneIntero = grande && grande.bboxMax[2] > 145;
  console.log('taglia esattamente sulla selezione:', usaTelo, '| taglio eseguito:', cresciute,
    '| pantalone intero:', pantaloneIntero, '| colori diversi:', coloriDiversi, '| undo:', undoOk);
  const ok = usaTelo && cresciute && pantaloneIntero && coloriDiversi && undoOk && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: TAGLIO SU BORDO STORTO OK' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
