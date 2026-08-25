// Le due meta' dell'app (file HTML e cartella Python sul PC) devono dire
// TUTTE E DUE la loro versione, sotto al titolo. Con la sola versione dell'HTML
// e' gia' successo che si leggesse "app nocciolo-liscio-21", si ricevesse
// l'avviso "versione vecchia" e si concludesse che l'avviso fosse sbagliato:
// la vecchia era la cartella, che e' poi quella che fa il taglio.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  // Questo test usa goku_vero.stl, che pesa 19 MB e sta fuori dal
  // repository: senza, si salta invece di fallire.
  if (!require('fs').existsSync(require('path').join(__dirname, 'modelli', 'goku_vero.stl'))) {
    console.log('SALTATO: manca modelli/goku_vero.stl (vedi test/LEGGIMI.md)');
    process.exitCode = 0;
    return;
  }
  const dir = require('path').join(__dirname, 'modelli');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const esiti = {};
  const errs = [];
  for (const finto of [null, 'nocciolo-liscio-19']) {
    const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
    let avviso = '';
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    p.on('dialog', async (d) => { avviso = d.message(); await d.dismiss(); });
    if (finto) {
      await p.route('**/health', async (route) => {
        const r = await route.fetch();
        const j = await r.json();
        j.taglia_pro_versione = finto;      // finge una cartella vecchia
        await route.fulfill({ json: j });
      });
    }
    await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(300);
    await p.setInputFiles('#fileInput', [`${dir}/goku_vero.stl`]);
    await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 60000 });
    await p.click('#toSegmentBtn', { timeout: 120000, noWaitAfter: true }); await p.waitForTimeout(300);
    await p.click('#saltaSegmBtn', { timeout: 120000, noWaitAfter: true });
    await p.waitForSelector('#partsList .part-card', { timeout: 120000 });
    await p.click('#cutToggleBtn'); await p.waitForTimeout(300);
    await p.evaluate(() => window.__selBox([60, -120, 500], [230, 60, 700]));
    await p.click('#cutFlatProBtn', { timeout: 120000, noWaitAfter: true }); await p.waitForTimeout(4000);
    esiti[finto || 'allineato'] = {
      scritta: await p.evaluate(() => document.getElementById('versioneApp').textContent.trim()),
      avviso,
    };
    await p.close();
  }
  await b.close();
  const A = esiti.allineato, V = esiti['nocciolo-liscio-19'];
  console.log('allineato:', JSON.stringify(A.scritta), '| avviso:', A.avviso ? 'SI' : 'no');
  console.log('vecchio  :', JSON.stringify(V.scritta), '| avviso:', V.avviso ? 'SI' : 'no');
  const ok =
    // quando combaciano: si vedono tutte e due le versioni e nessun avviso
    /^app \S+ · companion \S+$/.test(A.scritta) && !A.avviso &&
    // quando non combaciano: la scritta mostra quella VECCHIA della cartella...
    /companion nocciolo-liscio-19/.test(V.scritta) &&
    /app nocciolo-liscio-19/.test(V.scritta) === false &&
    // ...e l'avviso dice tutte e due le versioni, non solo "e' vecchia"
    /nocciolo-liscio-19/.test(V.avviso) && /CARTELLA/.test(V.avviso) &&
    /8760\/health/.test(V.avviso) &&
    errs.length === 0;
  if (errs.length) console.log('errori:', errs);
  console.log(ok ? '\nRISULTATO: LE DUE VERSIONI SI DISTINGUONO'
    : '\nRISULTATO: NON SI CAPISCE QUALE DELLE DUE E VECCHIA');
  process.exitCode = ok ? 0 : 1;
})();
