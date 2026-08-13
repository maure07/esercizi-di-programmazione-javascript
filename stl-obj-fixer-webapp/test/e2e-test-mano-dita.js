// Riproduce il caso reale segnalato dall'utente: una mano CON DITA (bordo
// frastagliato, non un anello piatto) attaccata a un corpo. Il vecchio
// fit PCA sul bordo poteva orientare il piano "in lungo" invece che di
// traverso al polso. Verifica che il piano trovato sia ragionevolmente
// PERPENDICOLARE al braccio (normale quasi verticale, come l'asse del
// braccio), non parallelo/laterale, e che il busto resti intero dopo il
// taglio.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('dialog', async (d) => { console.log('  [avviso]', d.message().split('\n')[0]); await d.accept(); });
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/corpo_mano_dita.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 30000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 40000 });
  await p.waitForTimeout(400);
  const primaParti = await p.evaluate(() => window.__partsBBox());
  console.log('parti dopo segmentazione:', primaParti.length);
  primaParti.forEach((x) => console.log('   ', x.name, 'min', x.bboxMin.map(v=>v.toFixed(0)), 'max', x.bboxMax.map(v=>v.toFixed(0))));

  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);
  // Seleziono la CALOTTA superiore della mano (z oltre 126): cosi' il bordo
  // della selezione e' un anello vero e orizzontale, come lo e' il polso
  // quando si stacca una mano. Con __applicaSelTest la selezione copriva
  // invece tutta la mano in ogni direzione: nessun anello, quindi nessuna
  // inclinazione sensata da verificare.
  const n = await p.evaluate(() => window.__selBox([-40, -40, 126], [40, 40, 300]));
  console.log('selezione impostata:', n, 'triangoli');
  const cutInfo = await p.evaluate(() => window.__cutInfo());
  console.log('selezione bbox:', cutInfo && { min: cutInfo.bboxMin.map(v=>v.toFixed(1)), max: cutInfo.bboxMax.map(v=>v.toFixed(1)) });
  if (!n || n < 4) { console.log('selezione non riuscita'); await b.close(); process.exitCode = 1; return; }

  const piano = await p.evaluate(() => window.__pianoTest());
  console.log('piano calcolato: normale', piano && piano.normale.map(v=>v.toFixed(3)), 'punto', piano && piano.punto.map(v=>v.toFixed(1)));
  // l'anello di bordo e' orizzontale, quindi la perpendicolare deve essere
  // quasi verticale (|nz| grande rispetto a nx,ny). Se invece esce orizzontale
  // il piano sta tagliando "in lungo", di traverso rispetto al bordo scelto.
  const nz2 = piano ? piano.normale[2] * piano.normale[2] : 0;
  const nxy2 = piano ? piano.normale[0] * piano.normale[0] + piano.normale[1] * piano.normale[1] : 1;
  const pianoGiusto = nz2 > nxy2;
  console.log('piano orientato a traverso (non in lungo):', pianoGiusto);

  await p.click('#cutFlatProBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForFunction((k) => window.__partsInfo().length > k, primaParti.length, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const dopoParti = await p.evaluate(() => window.__partsBBox());
  console.log('parti dopo il taglio:', dopoParti.length);
  dopoParti.forEach((x) => console.log('   ', x.name, 'min', x.bboxMin.map(v=>v.toFixed(0)), 'max', x.bboxMax.map(v=>v.toFixed(0)), 'vol', x.vol.toFixed(0)));

  await b.close();

  const cresciute = dopoParti.length > primaParti.length;
  const grande = dopoParti.slice().sort((a, b) => b.vol - a.vol)[0];
  // il busto (raggio 35, z -60..60) deve restare intero: bbox ampia fino a
  // z negativo e positivo, non ridotta a una fetta
  const bustoIntatto = grande && grande.bboxMax[2] > 55 && grande.bboxMin[2] < -55 &&
                        (grande.bboxMax[0] - grande.bboxMin[0]) > 60;
  // la parte piccola (la mano staccata) NON deve essere una fetta lunga
  // quanto tutto il braccio: la sua estensione in Z deve restare contenuta
  // (mano+dita, non "dal polso al busto")
  const piccole = dopoParti.filter((x) => /perno|foro/.test(x.name));
  const manoRagionevole = piccole.length >= 1 && piccole.every((x) => (x.bboxMax[2] - x.bboxMin[2]) < 60);
  const connesso = piccole.length > 0;
  // Il PERNO non deve sporgere fuori dal modello: e' il "cubo sospeso per
  // aria" che si vedeva quando il centro del connettore veniva calcolato
  // sommando (invece che sostituendo) le componenti del punto del piano.
  const mMin = [-40, -40, -70], mMax = [40, 40, 160];
  const pernoDentro = piccole.every((x) =>
    x.bboxMin.every((v, i) => v >= mMin[i] - 3) && x.bboxMax.every((v, i) => v <= mMax[i] + 3));
  console.log('parti create:', cresciute, '| busto intatto:', bustoIntatto,
              '| pezzo di dimensione ragionevole:', manoRagionevole,
              '| connettore aggiunto:', connesso,
              '| perno dentro il modello (niente cubo per aria):', pernoDentro);
  const ok = cresciute && bustoIntatto && manoRagionevole && connesso && pianoGiusto && pernoDentro && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: TAGLIO SU MANO CON DITA OK' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
