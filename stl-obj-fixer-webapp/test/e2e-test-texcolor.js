const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const dir = require('path').join(__dirname, 'modelli');
  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);

  // carica OBJ + MTL + PNG tutti insieme
  await p.setInputFiles('#fileInput', [`${dir}/texture_fixture.obj`, `${dir}/texture_fixture.mtl`, `${dir}/texture_test.png`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 20000 });
  await p.waitForTimeout(400);

  // 1) la texture e' stata applicata?
  const applied = await p.evaluate(() => {
    const cp = window.__parsedInfo ? window.__parsedInfo() : null;
    return cp;
  });
  console.log('parsedInfo:', JSON.stringify(applied));

  // 2) il viewer usa colori per-vertice (non grigio piatto)?
  const vc = await p.evaluate(() => {
    // trova la mesh e leggi se ha attributo color e materiale vertexColors
    let found = null;
    if (window.__viewerScene) {
      window.__viewerScene().traverse((o) => {
        if (o.isMesh && o.geometry && o.geometry.getAttribute && o.geometry.getAttribute('color')) {
          const c = o.geometry.getAttribute('color');
          // varianza dei colori: se >0 ci sono colori diversi (non tinta unica)
          let mn = [1,1,1], mx = [0,0,0];
          for (let i = 0; i < c.count; i++) {
            for (let k = 0; k < 3; k++) { const v = c.getComponent ? c.getComponent(i,k) : c.array[i*3+k]; mn[k]=Math.min(mn[k],v); mx[k]=Math.max(mx[k],v); }
          }
          found = { vertexColors: !!o.material.vertexColors, count: c.count, spread: [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]] };
        }
      });
    }
    return found;
  });
  console.log('vertexColors nel viewer:', JSON.stringify(vc));

  await b.close();
  const ok = applied && applied.textureApplied && vc && vc.vertexColors && (vc.spread[0]+vc.spread[1]+vc.spread[2] > 0.05) && errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: TEXTURE MOSTRATA A COLORI - OK' : '\nRISULTATO: PROBLEMI');
  process.exitCode = ok ? 0 : 1;
})();
