const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('dialog', async (d) => { console.log('  [avviso]', d.message().split('\n')[0]); await d.accept(); });
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/gamba_organica.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 30000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 40000 });
  await p.waitForTimeout(400);
  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);

  // seleziona la zona della scarpa (partendo da z=8)
  const n = await p.evaluate(() => window.__applicaSelTest(8, 22));
  console.log('selezione impostata:', n, 'triangoli');
  if (!n || n < 10) { console.log('selezione non riuscita'); await b.close(); process.exitCode = 1; return; }

  const prima = await p.evaluate(() => window.__partsInfo().length);
  await p.click('#cutFlatProBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForFunction((k) => window.__partsInfo().length > k, prima, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const parti = await p.evaluate(() => window.__partsInfo());
  console.log('parti:', prima, '->', parti.length);
  parti.slice(0, 3).forEach((x) => console.log('   ', x.name, x.tris, 'tri, chiuso:', x.wt));

  const pl = await p.evaluate(() => window.__planarita());
  console.log('faccia di taglio piu grande di ogni pezzo:');
  (pl || []).forEach((x) => x && console.log(`    ${x.nome}: ${x.facceComplanari} facce complanari, scarto dal piano ${x.scartoMax} mm`));

  await b.close();
  const cresciute = parti.length > prima;
  // la faccia di taglio deve essere PIATTA: scarto praticamente nullo
  // si controllano solo i DUE pezzi nati dal taglio: le altre parti non sono
  // state toccate e la loro superficie non c'entra
  const tagliati = (pl || []).filter((x) => x && /\(perno\)|\(foro\)|\(A\)|\(B\)/.test(x.nome));
  // Tolleranza 0,5 mm invece di 0,01. Il taglio non avviene piu' con un piano
  // che rade via tutto (faccia esattamente piatta ma geometria sbagliata dove
  // il piano sborda): ora la faccia e' un tappo costruito sul contorno VERO
  // della selezione. Su un anello che zigzaga fra due quote resta quindi un
  // mezzo millimetro di scostamento, che per un incastro stampato non conta,
  // mentre tagliare solo il selezionato conta eccome.
  const piatte = tagliati.length >= 2 && tagliati.every((x) => x.scartoMax < 0.5 && x.facceComplanari > 20);
  console.log('parti create:', cresciute, '| facce di taglio piatte:', piatte);
  const ok = cresciute && piatte && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: TAGLIO PIATTO OK' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
