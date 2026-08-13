// La faccia di taglio piatta si paga in materiale: su un contorno ondulato
// riempire fino al piano snatura il pezzo. La scelta deve restare all'utente:
// "solo dove costa poco" (predefinito), "sempre", "mai".
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
  p.on('dialog', async (d) => { await d.accept(); });
  const dir = require('path').join(__dirname, 'modelli');
  const esiti = {};
  for (const modo of ['auto', 'sempre', 'mai']) {
    await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
    await p.setInputFiles('#fileInput', [`${dir}/goku_vero.stl`]);
    await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 60000 });
    await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.waitForTimeout(300);
    await p.click('#saltaSegmBtn', { timeout: 120000, noWaitAfter: true });
    await p.waitForSelector('#partsList .part-card', { timeout: 120000 });
    await p.click('#cutToggleBtn'); await p.waitForTimeout(300);
    await p.selectOption('#flatCutModo', modo);
    // macchia sulla coscia: contorno ondulato al 14%
    const n = await p.evaluate(() => window.__selBox([60, -120, 500], [230, 60, 700]));
    const prima = await p.evaluate(() => window.__partsInfo().length);
    await p.click('#cutFlatProBtn', { timeout: 120000, noWaitAfter: true });
    await p.waitForFunction((k) => window.__partsInfo().length > k, prima, { timeout: 300000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const info = await p.evaluate(() => window.__partsInfo());
    const log = (info.find((x) => x.log && x.log.length) || {}).log || [];
    esiti[modo] = {
      piatta: log.some((l) => /Faccia di taglio PIATTA/.test(l)),
      fedele: log.some((l) => /FEDELE al modello|segue il contorno/.test(l)),
      // il pezzo STACCATO deve essere chiuso; il resto puo' ereditare difetti
      // che erano gia' nel modello di partenza (il log lo dice)
      chiuse: info.slice().sort((a, c) => a.tris - c.tris)[0].wt,
      pezzi: info.length,
    };
    console.log(modo, JSON.stringify(esiti[modo]),
      JSON.stringify(info.map((x) => ({ n: x.name, tri: x.tris, wt: x.wt }))));
    log.filter((l) => /difettosi|chiuso=|FEDELE|gonnella/.test(l)).forEach((l) => console.log('    ', l.slice(0, 120)));
  }
  await b.close();
  // su un contorno ondulato: auto -> fedele, sempre -> piatta, mai -> fedele
  const ok = esiti.auto.fedele && esiti.sempre.piatta && esiti.mai.fedele
    && !esiti.mai.piatta
    && Object.values(esiti).every((e) => e.chiuse && e.pezzi > 1)
    && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: SCELTA FACCIA PIATTA OK' : '\nRISULTATO: LA SCELTA NON FUNZIONA');
  process.exitCode = ok ? 0 : 1;
})();
