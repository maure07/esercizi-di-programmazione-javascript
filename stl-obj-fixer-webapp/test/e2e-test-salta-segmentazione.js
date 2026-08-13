// Richiesta: poter saltare la segmentazione automatica e andare dritti al
// ritaglio manuale, con il modello tenuto come UN pezzo solo.
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
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.waitForTimeout(300);
  // NIENTE segmentazione automatica: si salta
  await p.click('#saltaSegmBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 40000 });
  await p.waitForTimeout(500);
  const parti = await p.evaluate(() => window.__partsInfo());
  console.log('pezzi dopo aver saltato:', parti.length, parti.map((x) => x.name).join(', '));

  // gli strumenti di ritaglio devono essere utilizzabili
  await p.click('#cutToggleBtn'); await p.waitForTimeout(400);
  const strumenti = await p.evaluate(() => ({
    pannello: document.getElementById('cutControls').style.display !== 'none',
    tagliaSel: !!document.getElementById('cutFlatProBtn'),
  }));
  console.log('pannello ritaglio aperto:', strumenti.pannello);
  const n = await p.evaluate(() => window.__selBox([-45, -45, -140], [45, 45, -60]));
  console.log('selezione fatta a mano sul pezzo unico:', n, 'triangoli');
  const prima = parti.length;
  await p.click('#cutFlatProBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForFunction((k) => window.__partsInfo().length > k, prima, { timeout: 180000 }).catch(() => {});
  await p.waitForTimeout(1000);
  const dopo = await p.evaluate(() => window.__partsInfo());
  console.log('pezzi dopo il taglio:', dopo.length);
  const log = (dopo.find((x) => x.log && x.log.length) || {}).log || [];
  log.forEach((l) => console.log('   ', l));
  await b.close();
  const unoSolo = parti.length === 1;
  const haTagliato = dopo.length > prima;
  const senzaRipiego = !log.some((l) => /RIPIEGO/.test(l));
  const chiuse = dopo.every((x) => x.wt);
  console.log('un pezzo solo:', unoSolo, '| ha tagliato:', haTagliato,
    '| taglio esatto (niente ripiego):', senzaRipiego, '| pezzi chiusi:', chiuse);
  if (errs.length) console.log('errori:', errs);
  const ok = unoSolo && strumenti.pannello && n > 0 && haTagliato && senzaRipiego && chiuse && errs.length === 0;
  console.log(ok ? '\nRISULTATO: SALTO SEGMENTAZIONE OK' : '\nRISULTATO: PROBLEMI NEL SALTO SEGMENTAZIONE');
  process.exitCode = ok ? 0 : 1;
})();
