// Riproduce il caso reale: mano in fondo a un braccio DIAGONALE su un corpo
// grosso. Selezionando SOLO la mano, il piano di taglio deve risultare
// perpendicolare all'avambraccio (asse X), cioe' un taglio
// dritto al polso. Col vecchio calcolo (centro selezione - centro resto) la
// normale puntava verso il baricentro del busto: taglio in diagonale.
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
  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);

  // seleziona SOLO la mano (sfera di raggio 20 centrata oltre il polso)
  const n = await p.evaluate(() => window.__selBox([128, -30, 98], [200, 30, 170]));
  console.log('triangoli selezionati (solo mano):', n);
  if (!n) { console.log('selezione vuota'); await b.close(); process.exitCode = 1; return; }

  const piano = await p.evaluate(() => window.__pianoTest());
  const nrm = piano.normale;
  console.log('normale del piano:', nrm.map((v) => v.toFixed(4)));
  console.log('punto del piano:  ', piano.punto.map((v) => v.toFixed(1)));

  // verita': l'avambraccio e' inclinato a 45 gradi nel piano XZ
  const asse = [0.70710678, 0, 0.70710678];
  const scarto = (v) => {
    const d = Math.abs(v[0] * asse[0] + v[1] * asse[1] + v[2] * asse[2]);
    return Math.acos(Math.min(1, d)) * 180 / Math.PI;
  };
  const errGradi = scarto(nrm);
  console.log('scarto dall asse dell avambraccio:', errGradi.toFixed(1), 'gradi');
  if (piano.normaleVecchia) {
    console.log('  (col vecchio calcolo sarebbe stato:', scarto(piano.normaleVecchia).toFixed(1), 'gradi)');
  }

  await b.close();
  const ok = errGradi < 15 && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok
    ? '\nRISULTATO: PIANO DRITTO AL POLSO (taglio corretto)'
    : '\nRISULTATO: PIANO STORTO (taglio in diagonale)');
  process.exitCode = ok ? 0 : 1;
})();
