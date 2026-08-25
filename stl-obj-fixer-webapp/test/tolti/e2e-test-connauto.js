const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('dialog', async d => { console.log('  [avviso]', d.message().split('\n')[0]); await d.accept(); });
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/due_cubi.stl`]);
  await p.waitForSelector('#analysisPanel', { state:'visible', timeout:20000 });
  await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.click('#segmentBtn', { timeout: 120000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout:30000 });
  await p.waitForTimeout(400);

  const prima = await p.evaluate(() => window.__partsInfo().map(x => ({n:x.name, t:x.tris})));
  const volPrima = await p.evaluate(() => window.__partsVolumes());
  console.log('prima:', JSON.stringify(prima), 'volumi', JSON.stringify(volPrima.map(v=>+v.toFixed(1))));

  // clic sul pulsante del connettore AUTOMATICO della prima parte (niente tocco sul modello)
  const btns = await p.$$('button');
  let cliccato = false;
  for (const bt of btns) {
    const t = await bt.textContent();
    if (t && t.includes('perno e foro')) { await bt.click(); cliccato = true; break; }
  }
  console.log('pulsante automatico trovato e cliccato:', cliccato);
  await p.waitForTimeout(9000);

  const dopo = await p.evaluate(() => window.__partsInfo().map(x => ({n:x.name, t:x.tris})));
  const volDopo = await p.evaluate(() => window.__partsVolumes());
  console.log('dopo: ', JSON.stringify(dopo), 'volumi', JSON.stringify(volDopo.map(v=>+v.toFixed(1))));
  await b.close();

  let cresciuto=false, calato=false, conservato=true;
  for (let i=0;i<volPrima.length;i++){
    if (volDopo[i] > volPrima[i]*1.001) cresciuto=true;
    if (volDopo[i] < volPrima[i]*0.999) calato=true;
    // il numero di triangoli non deve ESPLODERE (la voxelizzazione lo faceva)
    if (dopo[i].t > prima[i].t * 4 + 50) conservato=false;
  }
  console.log('perno aggiunto:', cresciuto, '| foro scavato:', calato, '| mesh non stravolta:', conservato);
  const ok = cliccato && cresciuto && calato && conservato && errs.length===0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: CONNETTORE AUTOMATICO OK' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
