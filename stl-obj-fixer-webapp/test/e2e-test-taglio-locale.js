// Riproduce il bug segnalato dall'utente: selezionare una zona piccola
// (la "mano" di un corpo unico) e fare "Taglio piatto" NON deve tagliare
// tutto il pezzo con un piano infinito (il busto tagliato a meta'), e deve
// mettere il connettore.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('dialog', async (d) => { console.log('  [avviso]', d.message().split('\n')[0]); await d.accept(); });
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/corpo_con_mano.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 30000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 40000 });
  await p.waitForTimeout(400);
  const primaParti = await p.evaluate(() => window.__partsBBox());
  console.log('parti dopo segmentazione:', primaParti.length);
  primaParti.forEach((x) => console.log('   ', x.name, 'min', x.bboxMin.map(v=>v.toFixed(0)), 'max', x.bboxMax.map(v=>v.toFixed(0))));

  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);
  // semino la selezione nella mano (z tra 110 e 128): deve restare LOCALE
  const n = await p.evaluate(() => window.__applicaSelTest(122, 14));
  console.log('selezione impostata:', n, 'triangoli');
  const cutInfo = await p.evaluate(() => window.__cutInfo());
  console.log('selezione bbox:', cutInfo && { min: cutInfo.bboxMin.map(v=>v.toFixed(1)), max: cutInfo.bboxMax.map(v=>v.toFixed(1)) });
  if (!n || n < 4) { console.log('selezione non riuscita'); await b.close(); process.exitCode = 1; return; }

  await p.click('#cutFlatProBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForFunction((k) => window.__partsInfo().length > k, primaParti.length, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const dopoParti = await p.evaluate(() => window.__partsBBox());
  console.log('parti dopo il taglio:', dopoParti.length);
  dopoParti.forEach((x) => console.log('   ', x.name, 'min', x.bboxMin.map(v=>v.toFixed(0)), 'max', x.bboxMax.map(v=>v.toFixed(0)), 'vol', x.vol.toFixed(0)));
  const logInfo = await p.evaluate(() => window.__partsInfo());
  const conLog = (logInfo || []).find((x) => x.log && x.log.length);
  if (conLog) console.log('log del taglio:', conLog.log);

  await b.close();

  // Il pezzo "busto" (quello grande, ~596000mm^3 di volume totale meno la
  // mano) deve avere ancora il busto INTATTO: la bbox in X/Y deve restare
  // ampia (80x60) fino quasi in cima (torso 120mm di altezza), NON tagliata
  // a meta'. Prima del fix, il piano infinito tagliava anche il busto: la
  // parte grande sarebbe finita improvvisamente piccola o con bbox Z dimezzata.
  const cresciute = dopoParti.length > primaParti.length;
  const grande = dopoParti.slice().sort((a, b) => b.vol - a.vol)[0];
  const bustoIntatto = grande && grande.bboxMax[2] > 55 && grande.bboxMin[2] < -55 &&
                        (grande.bboxMax[0] - grande.bboxMin[0]) > 65;
  const connesso = dopoParti.some((x) => /perno|foro/.test(x.name));
  console.log('parti create:', cresciute, '| busto rimasto intatto (non tagliato a meta\'):', bustoIntatto,
              '| connettore aggiunto:', connesso);
  const ok = cresciute && bustoIntatto && connesso && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: TAGLIO LOCALE OK' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
