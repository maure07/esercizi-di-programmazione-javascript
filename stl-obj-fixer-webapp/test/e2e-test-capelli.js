// I CAPELLI SONO UN BLOCCO SOLO.
//
// Segnalato dall'uso: la preselezione trova gli occhi ma spacca i capelli in
// sette o otto zone. I capelli si stampano di un colore e basta: sono un pezzo.
// Il motivo e' che la divisione taglia lungo le pieghe, e fra una ciocca e
// l'altra di pieghe ce ne sono tante - solo che sono solchi LEGGERI rispetto
// all'attaccatura dei capelli sulla fronte.
//
// Il modello di prova (modelli/testa_capelli.stl, si rifa' con
// fai-testa-capelli.py) e' una testa con otto ciocche saldate sopra e due occhi
// appoggiati come corpi staccati, che nei modelli fatti dall'IA e' come stanno
// quasi sempre. ATTENZIONE a cosa prova e cosa no: su questo modello i capelli
// venivano gia' bene anche prima. Serve da GUARDIA - dopo aver toccato le
// soglie devono continuare a venire bene - non come prova che il difetto sul
// modello vero sia risolto. Quello si guarda con gli occhi, sul pezzo vero.
//
// Le due cose che devono restare vere:
//   1. i capelli non si spezzano: la testa con le ciocche resta UNA zona;
//   2. gli occhi restano zone a parte, a qualunque tacca del cursore. Se si
//      unissero alla testa, il cursore "Quanto dividere" avrebbe mangiato
//      proprio i dettagli che uno vuole di un altro colore.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, 'modelli');
  if (!fs.existsSync(path.join(dir, 'testa_capelli.stl'))) {
    console.log('SALTATO: manca modelli/testa_capelli.stl (si rifa\' con fai-testa-capelli.py)');
    process.exitCode = 0;
    return;
  }
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1300, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', async (d) => { await d.accept(); });

  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(400);
  await p.setInputFiles('#fileInput', [`${dir}/testa_capelli.stl`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 120000 });
  await p.click('#toSegmentBtn', { timeout: 180000, noWaitAfter: true }); await p.waitForTimeout(300);
  await p.click('#saltaSegmBtn', { timeout: 180000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 180000 });
  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);
  // Il pannello del taglio e' a sotto-menu (chiesto dall'uso: per abbassare il
  // raggio del pennello si doveva risalire tutta la pagina). Chiuso, il gruppo
  // delle zone sta nel DOM ma non e' visibile e il clic non arriva. Si apre
  // CLICCANDO il titolo: mettere .open a mano non serve, il pannello tiene
  // aperto un gruppo alla volta e lo richiude subito.
  await p.click('#grpZone > summary'); await p.waitForTimeout(300);

  // il cursore va provato ai due estremi e in mezzo: una taratura che funziona
  // solo al valore predefinito non e' una taratura, e' una coincidenza
  const esiti = [];
  for (const tacca of [1, 6, 10]) {
    await p.evaluate((v) => {
      const s = document.getElementById('zoneQuante');
      s.value = String(v);
      s.dispatchEvent(new Event('input', { bubbles: true }));
    }, tacca);
    await p.click('#zoneProponiBtn', { timeout: 300000, noWaitAfter: true });
    await p.waitForFunction(() => document.querySelectorAll('#zoneElenco .zona-riga').length > 0,
      null, { timeout: 300000 });
    const misure = await p.evaluate(() => {
      const n = window.__zoneMostrate();
      const out = [];
      for (let i = 0; i < n; i++) out.push(window.__zoneFacce(i).length);
      return out;
    });
    esiti.push({ tacca, misure });
    console.log(`"Quanto dividere" = ${tacca.toString().padStart(2)} -> ${misure.length} zone: `
      + misure.join(', ') + ' triangoli');
    if (tacca === 6) {
      const el = await p.evaluate(() => document.getElementById('zoneElenco').innerText);
      esiti.dettagli = (el.match(/dettaglio/g) || []).length;
      esiti.avviso = /avvia\.bat|install_pro\.bat|non sono riuscito a cercare/i.test(el);
      console.log('   dettagli con targhetta:', esiti.dettagli,
        '| riga che spiega cosa manca:', esiti.avviso);
    }
    await p.click('#zoneViaBtn');
    await p.waitForTimeout(200);
  }

  await b.close();

  // 3) I DETTAGLI. Col companion acceso devono comparire zone segnate
  //    "dettaglio" (occhi, sopracciglia, bocca); col companion spento no, ma
  //    allora ci dev'essere la riga che dice cosa manca. Quello che NON deve
  //    mai succedere e' un elenco corto senza spiegazione: uno resta li' a
  //    chiedersi perche' gli occhi non ci sono.
  const dettagliOk = esiti.dettagli > 0 || esiti.avviso;
  console.log('');
  console.log(esiti.dettagli > 0
    ? `dettagli trovati dal companion: ${esiti.dettagli}`
    : 'companion spento: al posto dei dettagli c\'e\' la spiegazione -> ' + esiti.avviso);

  // 1) i capelli non si spezzano. La testa con le ciocche e' di gran lunga il
  //    corpo piu' grosso: se restasse spezzata si vedrebbero piu' zone grandi
  //    invece di una sola, quindi si guarda quante zone "grosse" ci sono.
  const capelliInteri = esiti.every((e) => {
    const tot = e.misure.reduce((a, x) => a + x, 0);
    return e.misure.filter((x) => x > tot * 0.25).length === 1;
  });
  // 2) gli occhi restano a parte: due zone piccole, sempre
  const occhiSalvi = esiti.every((e) => {
    const tot = e.misure.reduce((a, x) => a + x, 0);
    return e.misure.filter((x) => x > tot * 0.02 && x < tot * 0.25).length >= 2;
  });
  console.log('');
  console.log('i capelli restano un pezzo solo:', capelliInteri);
  console.log('gli occhi restano zone a parte:', occhiSalvi);
  console.log('i dettagli ci sono, o si sa perche\' no:', dettagliOk);
  if (errs.length) console.log('errori JS:', errs);
  const ok = capelliInteri && occhiSalvi && dettagliOk && errs.length === 0;
  console.log(ok ? '\nRISULTATO: CAPELLI INTERI E OCCHI SEPARATI'
    : '\nRISULTATO: LA DIVISIONE SPEZZA QUELLO CHE NON DEVE');
  process.exitCode = ok ? 0 : 1;
})();
