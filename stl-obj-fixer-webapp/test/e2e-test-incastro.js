// La manopola "Come si uniscono i pezzi". Prima il nocciolo partiva da solo e
// non c'era modo di chiederlo: chi lo voleva cercava (invano) un bottone.
// Adesso i quattro modi devono comandare davvero il motore, e il resoconto
// deve dire quale e' stato usato.
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
  for (const modo of ['nocciolo', 'nocciolo_ovale', 'nocciolo_esatto', 'perno', 'niente']) {
    await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
    await p.setInputFiles('#fileInput', [`${dir}/goku_vero.stl`]);
    await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 60000 });
    await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.waitForTimeout(300);
    await p.click('#saltaSegmBtn', { timeout: 120000, noWaitAfter: true });
    await p.waitForSelector('#partsList .part-card', { timeout: 120000 });
    await p.click('#cutToggleBtn'); await p.waitForTimeout(300);
    await p.selectOption('#incastroModo', modo);
    // stessa macchia sulla coscia del test della faccia piatta
    await p.evaluate(() => window.__selBox([60, -120, 500], [230, 60, 700]));
    const volPrima = await p.evaluate(() => window.__partsInfo().reduce((a, x) => a + (x.vol || 0), 0));
    const prima = await p.evaluate(() => window.__partsInfo().length);
    await p.click('#cutFlatProBtn', { timeout: 120000, noWaitAfter: true });
    await p.waitForFunction((k) => window.__partsInfo().length > k, prima, { timeout: 300000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const info = await p.evaluate(() => window.__partsInfo());
    const log = (info.find((x) => x.log && x.log.length) || {}).log || [];
    esiti[modo] = {
      nocciolo: log.some((l) => /Taglio A NOCCIOLO/.test(l)),
      perno: log.some((l) => /^Connettore:/.test(l)),
      colla: log.some((l) => /Nessun aggancio/.test(l)),
      ripiego: log.some((l) => /RIPIEGO SUL PIANO/.test(l)),
      chiuse: info.slice().sort((a, c) => a.tris - c.tris)[0].wt,
      pezzi: info.length,
      nomi: info.map((x) => x.name).join(' | '),
      // tagliando non deve SPARIRE materiale: la sede scavava un pezzo che al
      // pezzo staccato non corrispondeva, e quella roba non finiva da nessuna parte
      perso: volPrima > 0
        ? (volPrima - info.reduce((a, x) => a + (x.vol || 0), 0)) / volPrima : 0,
      // la faccia di taglio del pezzo staccato deve essere PIANA: era proprio
      // questo il difetto (il fondo copiava la pelle curva e faceva le punte)
      piana: await p.evaluate((ns) => {
        const n = ns.find((x) => /\(nocciolo\)|\(perno\)|\(A\)/.test(x));
        return n ? window.__facciaPiatta(n) : null;
      }, info.map((x) => x.name)),
    };
    console.log(modo, JSON.stringify(esiti[modo]));
    log.filter((l) => /NOCCIOLO|Nocciolo|aggancio|Connettore|ATTENZIONE|RIPIEGO/.test(l))
      .forEach((l) => console.log('    ', l.slice(0, 150)));
  }
  await b.close();
  const ok =
    // "nocciolo": lo fa, non ci mette anche il perno, e i pezzi si chiamano
    // col nome giusto (mandare a cercare un "perno" che non c'e' e' lo stesso
    // errore dei pulsanti scambiati, in piccolo)
    esiti.nocciolo.nocciolo && !esiti.nocciolo.perno &&
    // il fondo del nocciolo sta in una fetta sottilissima: e' un piano vero
    esiti.nocciolo.piana && esiti.nocciolo.piana.spessoreRelativo !== null &&
    esiti.nocciolo.piana.spessoreRelativo < 0.02 &&
    esiti.nocciolo.piana.areaPiana > 0.15 * esiti.nocciolo.piana.areaTotale &&
    /\(nocciolo\)/.test(esiti.nocciolo.nomi) && /\(sede\)/.test(esiti.nocciolo.nomi) &&
    !/\(perno\)|\(foro\)/.test(esiti.nocciolo.nomi) &&
    /\(perno\)/.test(esiti.perno.nomi) && /\(foro\)/.test(esiti.perno.nomi) &&
    !/\(perno\)|\(nocciolo\)/.test(esiti.niente.nomi) &&
    // "perno": mai il nocciolo, sempre lo spinotto
    !esiti.perno.nocciolo && esiti.perno.perno &&
    // "niente": ne' l'uno ne' l'altro, e lo dice
    !esiti.niente.nocciolo && !esiti.niente.perno && esiti.niente.colla &&
    // in nessun caso si deve ripiegare sul piano, e i pezzi devono venire chiusi
    Object.values(esiti).every((e) => !e.ripiego && e.chiuse && e.pezzi > 1) &&
    // al massimo si perde la fettina di gioco, non un pezzo di modello
    Object.values(esiti).every((e) => Math.abs(e.perso) < 0.005) &&
    errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: SCELTA INCASTRO OK' : '\nRISULTATO: LA SCELTA INCASTRO NON FUNZIONA');
  process.exitCode = ok ? 0 : 1;
})();
