const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
  await p.setInputFiles('#fileInput', [`${dir}/texture_fixture.obj`, `${dir}/texture_fixture.mtl`, `${dir}/texture_test.png`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });
  await p.waitForTimeout(300);
  // clicca RIPARA
  await p.click('#repairBtn').catch(async () => { await p.click('text=Ripara'); });
  await p.waitForTimeout(1200);
  const vc = await p.evaluate(() => {
    let found = null;
    window.__viewerScene().traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.getAttribute && o.geometry.getAttribute('color')) {
        const c = o.geometry.getAttribute('color');
        let mn=[1,1,1],mx=[0,0,0];
        for (let i=0;i<c.count;i++) for(let k=0;k<3;k++){const v=c.array[i*3+k];mn[k]=Math.min(mn[k],v);mx[k]=Math.max(mx[k],v);}
        found = { vertexColors: !!o.material.vertexColors, spread: (mx[0]-mn[0])+(mx[1]-mn[1])+(mx[2]-mn[2]) };
      }
    });
    return found;
  });
  console.log('dopo riparazione, colori nel viewer:', JSON.stringify(vc));
  await b.close();
  const ok = vc && vc.vertexColors && vc.spread > 0.05 && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: COLORI MANTENUTI DOPO RIPARAZIONE - OK' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
