// La colonna di sinistra coi dati della mesh. Quei numeri stavano solo nel
// riquadro dell'analisi, che sparisce appena si passa al passo dopo: servono
// invece mentre si taglia. Qui si controlla che ci siano, che siano GIUSTI e
// che si aggiornino dopo la riparazione.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const dir = require('path').join(__dirname, 'modelli');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', async (d) => { await d.accept(); });

  const valore = (etichetta) => p.evaluate((et) => {
    const r = [...document.querySelectorAll('#infoCorpo .mesh-riga')]
      .find((x) => x.querySelector('.mesh-et').textContent.trim() === et);
    return r ? { v: r.querySelector('.mesh-val').textContent.trim(),
                 tono: r.className.replace('mesh-riga', '').trim() } : null;
  }, etichetta);

  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(400);
  // a modello non caricato la colonna dice che aspetta, non mostra numeri finti
  const vuotoPrima = await p.evaluate(() =>
    document.getElementById('infoVuoto').offsetParent !== null
    && document.querySelectorAll('#infoCorpo .mesh-riga').length === 0);
  console.log('senza modello, la colonna e\' in attesa:', vuotoPrima);

  await p.setInputFiles('#fileInput', [`${dir}/cubo_con_buco.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 60000 });
  await p.waitForTimeout(600);
  const tri = await valore('Triangoli');
  const buchi = await valore('Buchi');
  const aperti = await valore('Spigoli aperti');
  const senzaArea = await valore('Triangoli senza area');
  console.log('dopo il caricamento -> triangoli:', tri && tri.v, '| buchi:', buchi && buchi.v,
    '| spigoli aperti:', aperti && aperti.v, '| senza area:', senzaArea && senzaArea.v, senzaArea && senzaArea.tono);
  // il cubo bucato ha 10 triangoli, 1 buco, 4 spigoli aperti
  const caricamentoOk = tri && tri.v === '10' && buchi && buchi.v === '1'
    && buchi.tono === 'guai' && aperti && aperti.v === '4'
    && senzaArea && senzaArea.v === '0' && senzaArea.tono === 'ok';

  // la riparazione deve cambiare i numeri, non lasciarli congelati
  await p.click('#toRepairBtn', { timeout: 60000, noWaitAfter: true }).catch(() => {});
  await p.waitForTimeout(400);
  await p.click('#repairBtn', { timeout: 120000, noWaitAfter: true }).catch(() => {});
  await p.waitForTimeout(2500);
  const superficie = await valore('Superficie');
  const triDopo = await valore('Triangoli');
  const volume = await valore('Volume');
  console.log('dopo la riparazione -> superficie:', superficie && superficie.v,
    superficie && superficie.tono, '| triangoli:', triDopo && triDopo.v, '| volume:', volume && volume.v);
  const riparazioneOk = superficie && superficie.v === 'chiusa' && superficie.tono === 'ok'
    && triDopo && triDopo.v !== tri.v && volume && /cm/.test(volume.v);

  // su uno schermo stretto le tre colonne non ci stanno: la sinistra sparisce
  await p.setViewportSize({ width: 1000, height: 900 }); await p.waitForTimeout(400);
  const strettoOk = await p.evaluate(() =>
    document.getElementById('infoPanel').offsetParent === null);
  console.log('a 1000px la colonna sparisce:', strettoOk);

  await b.close();
  const ok = vuotoPrima && caricamentoOk && riparazioneOk && strettoOk && errs.length === 0;
  if (errs.length) console.log('errori JS:', errs);
  console.log(ok ? '\nRISULTATO: PANNELLO DATI OK' : '\nRISULTATO: PANNELLO DATI NON FUNZIONA');
  process.exitCode = ok ? 0 : 1;
})();
