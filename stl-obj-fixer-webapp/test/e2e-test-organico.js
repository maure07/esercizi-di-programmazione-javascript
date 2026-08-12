const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  // GAMBA ORGANICA come un modello Meshy: nessuno spigolo, solo una valle
  // concava alla caviglia (z=25). E' il caso su cui la soglia secca falliva.
  await p.setInputFiles('#fileInput', [`${dir}/gamba_organica.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 30000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 40000 });
  await p.waitForTimeout(400);

  console.log('clic sulla scarpa (z=8); la caviglia sta a z=25');
  let tutteSotto = true, sempreAmpia = true;
  for (const est of [10, 22, 45]) {
    const r = await p.evaluate(([z, e]) => window.__smartTest(z, e), [8, est]);
    const pct = 100 * r.count / r.totale;
    console.log(`  estensione ${String(est).padStart(2)}: ${r.count} tri (${pct.toFixed(0)}%), arriva a z=${r.zmax.toFixed(0)}`);
    if (r.zmax > 30) tutteSotto = false;          // non deve scavalcare la caviglia
    if (pct < 40) sempreAmpia = false;            // deve comunque prendere la scarpa
  }
  await b.close();
  const ok = tutteSotto && sempreAmpia && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log('si ferma alla caviglia:', tutteSotto, '| prende la scarpa:', sempreAmpia);
  console.log(ok ? '\nRISULTATO: SELEZIONE CORRETTA SU MESH ORGANICA' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
