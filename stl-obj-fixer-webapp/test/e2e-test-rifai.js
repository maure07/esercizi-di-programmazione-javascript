// "Annulla" e "Rifai" sulle operazioni ai pezzi.
//
// Segnalato dall'uso: "se per sbaglio faccio l'undo ho perso tutto il lavoro
// fatto fin ad ora". Era vero: si andava indietro e basta, la strada in avanti
// spariva. Qui si controlla che dopo un Annulla si possa tornare avanti, e che
// una mossa NUOVA chiuda la strada in avanti (se no il "Rifai" rimetterebbe
// roba di un'altra storia).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const dir = path.join(__dirname, 'modelli');
  const modello = fs.existsSync(path.join(dir, 'goku_vero.stl'))
    ? 'goku_vero.stl' : 'cube.stl';
  if (!fs.existsSync(path.join(dir, modello))) {
    console.log('SALTATO: manca un modello di prova');
    process.exitCode = 0;
    return;
  }
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1300, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', async (d) => { await d.accept(); });
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(400);
  await p.setInputFiles('#fileInput', [`${dir}/${modello}`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 120000 });
  await p.click('#toSegmentBtn', { timeout: 180000, noWaitAfter: true }); await p.waitForTimeout(300);
  await p.click('#saltaSegmBtn', { timeout: 180000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 180000 });
  await p.waitForTimeout(400);

  const nome = (await p.evaluate(() => window.__partsInfo()))[0].name;
  const h = async () => (await p.evaluate((n) => window.__misureParte(n), nome))[2];
  const visibile = async (id) => p.evaluate((x) => {
    const e = document.getElementById(x);
    return !!e && e.style.display !== 'none';
  }, id);

  const h0 = await h();
  // due operazioni una dopo l'altra: dimezza, poi dimezza ancora
  await p.evaluate((n) => window.__ridimensiona(n, [1, 1, 0.5]), nome);
  const h1 = await h();
  await p.evaluate((n) => window.__ridimensiona(n, [1, 1, 0.5]), nome);
  const h2 = await h();
  console.log('altezze:', h0.toFixed(1), '->', h1.toFixed(1), '->', h2.toFixed(1));

  // all'inizio "Rifai" non deve nemmeno vedersi: non c'e' niente da rimettere
  const rifaiNascostoPrima = !(await visibile('rifaiPartiBtn'));

  await p.click('#undoPartiBtn'); await p.waitForTimeout(300);
  const dopoUndo = await h();
  const rifaiVisibile = await visibile('rifaiPartiBtn');
  await p.click('#undoPartiBtn'); await p.waitForTimeout(300);
  const dopoDueUndo = await h();
  console.log('due Annulla:', dopoUndo.toFixed(1), '->', dopoDueUndo.toFixed(1),
    '| il tasto Rifai si vede:', rifaiVisibile);

  await p.click('#rifaiPartiBtn'); await p.waitForTimeout(300);
  const dopoRifai = await h();
  await p.click('#rifaiPartiBtn'); await p.waitForTimeout(300);
  const dopoDueRifai = await h();
  console.log('due Rifai:', dopoRifai.toFixed(1), '->', dopoDueRifai.toFixed(1));

  // il punto della richiesta: dopo Annulla + Rifai si deve tornare ESATTAMENTE
  // dov'eravamo, non "quasi"
  const tornatoIndietro = Math.abs(dopoDueUndo - h0) < 0.05;
  const tornatoAvanti = Math.abs(dopoDueRifai - h2) < 0.05;

  // una mossa nuova dopo un Annulla deve chiudere la strada in avanti
  await p.click('#undoPartiBtn'); await p.waitForTimeout(300);
  await p.evaluate((n) => window.__ridimensiona(n, [1, 1, 0.8]), nome);
  await p.waitForTimeout(300);
  const rifaiSparito = !(await visibile('rifaiPartiBtn'));
  console.log('dopo una mossa nuova il Rifai sparisce:', rifaiSparito);

  await b.close();
  const ok = rifaiNascostoPrima && rifaiVisibile && tornatoIndietro && tornatoAvanti
    && rifaiSparito && errs.length === 0;
  if (errs.length) console.log('errori JS:', errs);
  if (!ok) {
    console.log('controlli falliti:', Object.entries({
      rifaiNascostoPrima, rifaiVisibile, tornatoIndietro, tornatoAvanti, rifaiSparito,
    }).filter(([, v]) => !v).map(([k]) => k).join(', ') || '(nessuno: errori JS)');
  }
  console.log(ok ? '\nRISULTATO: ANNULLA E RIFAI OK' : '\nRISULTATO: ANNULLA/RIFAI NON FUNZIONANO');
  process.exitCode = ok ? 0 : 1;
})();
