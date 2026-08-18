// DUE TAGLI DI FILA: quello che si fa davvero, non un taglio solo.
//
// Segnalati insieme, dall'uso, e sono i due difetti che bloccano il lavoro:
//
//   A) "ho tagliato una sola parte preselezionata e dopo ho fatto io una
//      selezione manuale su un'altra parte ma sembra buggato, non mi fa
//      procedere al taglio";
//   B) "ho selezionato un occhio e tagliato col nocciolo ed e' andato bene;
//      poi ho fatto lo stesso con l'altro occhio ma ha fatto un semplice
//      taglio normale senza nocciolo".
//
// Nessuno dei test di prima faceva DUE tagli di seguito: si caricava il
// modello, si tagliava una volta e si guardava il risultato. Tutti e due i
// difetti stanno esattamente li', nel secondo giro - e per questo non li
// vedeva nessuno.
//
// Quando fallisce, questo test non dice solo "no": stampa lo stato interno
// (che pezzo puntava la selezione, se quel pezzo esiste ancora, se i pulsanti
// erano spenti) e le righe di diagnostica del motore. Tirare a indovinare sul
// nocciolo e' gia' costato giorni una volta.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, 'modelli');
  const modello = fs.existsSync(path.join(dir, 'goku_vero.stl'))
    ? 'goku_vero.stl' : 'ciocca_su_testa.stl';
  if (!fs.existsSync(path.join(dir, modello))) {
    console.log('SALTATO: manca un modello di prova');
    process.exitCode = 0;
    return;
  }
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const p = await b.newPage({ viewport: { width: 1300, height: 950 } });
  const errs = [];
  const avvisi = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', async (d) => { avvisi.push(d.message()); await d.accept(); });

  await p.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p.waitForTimeout(400);
  await p.setInputFiles('#fileInput', [`${dir}/${modello}`]);
  await p.waitForSelector('#analysisPanel', { state: 'visible', timeout: 120000 });
  await p.click('#toSegmentBtn', { timeout: 180000, noWaitAfter: true }); await p.waitForTimeout(300);
  await p.click('#saltaSegmBtn', { timeout: 180000, noWaitAfter: true });
  await p.waitForSelector('#partsList .part-card', { timeout: 180000 });
  await p.click('#cutToggleBtn'); await p.waitForTimeout(300);
  // il nocciolo lo si CHIEDE: e' il caso segnalato
  await p.selectOption('#incastroModo', 'nocciolo');
  await p.waitForTimeout(200);

  const pezzi = async () => p.evaluate(() => window.__partsInfo().map((x) => x.name));

  // ------------------------------------------------------------------
  // Primo taglio: da una ZONA PROPOSTA, come nel giro nuovo.
  // ------------------------------------------------------------------
  await p.click('#zoneProponiBtn', { timeout: 300000, noWaitAfter: true });
  await p.waitForFunction(() => document.querySelectorAll('#zoneElenco .zona-riga').length > 0,
    null, { timeout: 300000 });
  const nZone = await p.evaluate(() => document.querySelectorAll('#zoneElenco .zona-riga').length);
  // la zona piu' piccola: e' quella che uno stacca davvero (una ciocca, un
  // occhio), non il corpo intero
  const piccola = await p.evaluate(() => {
    let best = 0, n = Infinity;
    for (let i = 0; i < window.__zoneMostrate(); i++) {
      const k = window.__zoneFacce(i).length;
      if (k > 20 && k < n) { n = k; best = i; }
    }
    return best;
  });
  await p.evaluate((i) => document.querySelectorAll('#zoneElenco .zona-riga')[i].click(), piccola);
  await p.waitForTimeout(800);
  const sel1 = await p.evaluate(() => (window.__selFacce() || []).length);
  console.log(`zone proposte: ${nZone} | presa la n.${piccola + 1} -> ${sel1} triangoli`);

  const primaDelTaglio = await pezzi();
  await p.click('#cutFlatProBtn', { timeout: 300000, noWaitAfter: true });
  await p.waitForFunction((q) => window.__partsInfo().length !== q,
    primaDelTaglio.length, { timeout: 300000 }).catch(() => {});
  await p.waitForTimeout(600);
  const dopoUno = await pezzi();
  const primoTaglio = dopoUno.length > primaDelTaglio.length;
  const primoNocciolo = dopoUno.some((n) => /nocciolo/.test(n));
  console.log('dopo il primo taglio:', dopoUno.join(' | '));
  console.log(`  taglio fatto: ${primoTaglio} | e' un nocciolo: ${primoNocciolo}`);

  // ------------------------------------------------------------------
  // DIFETTO A: adesso una selezione A MANO su un altro pezzo, col mouse vero.
  // ------------------------------------------------------------------
  // Il pezzo grosso rimasto: e' li' che uno va a prendere il secondo dettaglio.
  const grosso = await p.evaluate(() => {
    const l = window.__partsInfo();
    let k = 0;
    for (let i = 1; i < l.length; i++) if (l[i].tris > l[k].tris) k = i;
    return l[k].name;
  });
  // si cerca un punto sullo schermo che colpisca DAVVERO quel pezzo: e' il
  // giro che fa il mouse dell'utente, raycast compreso
  const bersaglio = await p.evaluate((nome) => {
    const lista = window.__partsInfo();
    const voluto = lista.find((x) => x.name === nome);
    for (let y = 180; y < 820; y += 10) {
      for (let x = 300; x < 1120; x += 10) {
        const h = window.__raycast(x, y);
        if (h && voluto && h.partId === voluto.id) return { x, y, partId: h.partId };
      }
    }
    return null;
  }, grosso);
  console.log('punto sullo schermo per la pennellata:', JSON.stringify(bersaglio));

  // un CLIC secco: e' il gesto normale ("un clic = tutta la zona"), quello
  // che si fa per prendere il secondo occhio dopo aver tagliato il primo
  let selManuale = 0;
  avvisi.length = 0;
  if (bersaglio) {
    await p.mouse.move(bersaglio.x, bersaglio.y);
    await p.mouse.down();
    await p.waitForTimeout(60);
    await p.mouse.up();
    await p.waitForTimeout(900);
    selManuale = await p.evaluate(() => (window.__selFacce() || []).length);
    // se il clic secco non prende niente, si prova la pennellata trascinata
    if (selManuale === 0) {
      await p.mouse.move(bersaglio.x, bersaglio.y);
      await p.mouse.down();
      for (let k = 1; k <= 10; k++) {
        await p.mouse.move(bersaglio.x + k * 4, bersaglio.y + k * 3);
        await p.waitForTimeout(30);
      }
      await p.mouse.up();
      await p.waitForTimeout(700);
      selManuale = await p.evaluate(() => (window.__selFacce() || []).length);
      console.log('  (il clic secco non ha preso niente: provata la pennellata)');
    }
  }
  avvisi.forEach((m) => console.log('   avviso alla selezione:', m.split('\n')[0]));
  const statoA = await p.evaluate(() => {
    const c = window.__cutInfo();
    return {
      selezione: c ? c.count : 0,
      creaSpento: document.getElementById('cutCreateBtn').disabled,
      tagliaSpento: document.getElementById('cutFlatProBtn').disabled,
      pezzi: window.__partsInfo().map((x) => x.name),
    };
  });
  console.log(`pennellata a mano su "${grosso}": ${selManuale} triangoli`);
  console.log('  stato:', JSON.stringify(statoA));

  let secondoTaglio = false, secondoNocciolo = false;
  if (selManuale > 3) {
    const prima2 = statoA.pezzi.length;
    avvisi.length = 0;
    await p.click('#cutFlatProBtn', { timeout: 300000, noWaitAfter: true });
    await p.waitForFunction((q) => window.__partsInfo().length !== q, prima2,
      { timeout: 300000 }).catch(() => {});
    await p.waitForTimeout(600);
    const dopoDue = await pezzi();
    secondoTaglio = dopoDue.length > prima2;
    secondoNocciolo = dopoDue.filter((n) => /nocciolo/.test(n)).length
      > dopoUno.filter((n) => /nocciolo/.test(n)).length;
    console.log('dopo il secondo taglio:', dopoDue.join(' | '));
    console.log(`  taglio fatto: ${secondoTaglio} | e' un nocciolo: ${secondoNocciolo}`);
    avvisi.forEach((m) => console.log('   avviso:', m.split('\n').slice(0, 3).join(' / ')));
    // se il nocciolo non e' uscito, si stampa quello che ha detto il motore:
    // e' l'unico modo per sapere PERCHE' invece di indovinare
    if (!secondoNocciolo) {
      const righe = await p.evaluate(() => {
        const l = window.__partsInfo();
        const ultimo = l[l.length - 1];
        return (ultimo.log || []).slice(-25);
      });
      console.log('  diagnostica del secondo taglio:');
      righe.forEach((r) => console.log('    ', String(r).slice(0, 170)));
    }
  } else {
    console.log('  la pennellata non ha selezionato niente: il taglio non puo\' partire');
  }

  // ------------------------------------------------------------------
  // DIFETTO A, il caso vero: la zona scelta e' un CORPO STACCATO.
  // ------------------------------------------------------------------
  // Nei modelli fatti dall'IA occhi, sopracciglia e bottoni non sono saldati
  // alla faccia: sono solidi appoggiati sopra. Passandoci il pennello si
  // prende il corpo tutto intero, e una selezione che copre un corpo intero
  // non ha bordo: il taglio si fermava li' ("Non riesco a ricavare un piano
  // dal bordo della selezione") e non c'era modo di andare avanti. E' questo
  // che si vedeva come "non mi fa procedere al taglio".
  const p2 = await b.newPage({ viewport: { width: 1000, height: 800 } });
  const av2 = [];
  p2.on('pageerror', (e) => errs.push(e.message));
  p2.on('dialog', async (d) => { av2.push(d.message()); await d.accept(); });
  await p2.goto('http://127.0.0.1:8973/stl-obj-fixer.html'); await p2.waitForTimeout(300);
  await p2.setInputFiles('#fileInput', [`${dir}/due_cubi.stl`]);
  await p2.waitForSelector('#analysisPanel', { state: 'visible', timeout: 60000 });
  await p2.click('#toSegmentBtn', { timeout: 60000, noWaitAfter: true }); await p2.waitForTimeout(300);
  await p2.click('#saltaSegmBtn', { timeout: 60000, noWaitAfter: true });
  await p2.waitForSelector('#partsList .part-card', { timeout: 60000 });
  await p2.click('#cutToggleBtn'); await p2.waitForTimeout(300);
  const nCorpo = await p2.evaluate(() => window.__selCorpo(0));
  const senzaBordo = await p2.evaluate(() => window.__pianoTest() === null);
  const primaStacco = await p2.evaluate(() => window.__partsInfo().length);
  av2.length = 0;
  await p2.click('#cutFlatProBtn', { timeout: 120000, noWaitAfter: true });
  await p2.waitForTimeout(2500);
  const dopoStacco = await p2.evaluate(() => window.__partsInfo().length);
  const okStaccato = dopoStacco > primaStacco;
  console.log('');
  console.log(`corpo staccato preso tutto: ${nCorpo} triangoli, senza bordo: ${senzaBordo}`);
  console.log(`  parti ${primaStacco} -> ${dopoStacco} -> si va avanti lo stesso: ${okStaccato}`);
  av2.forEach((m) => console.log('   avviso:', m.split('\n')[0]));
  await p2.close();

  await b.close();
  const okA = selManuale > 3 && !statoA.creaSpento && secondoTaglio && okStaccato;
  const okB = primoNocciolo && secondoNocciolo;
  if (errs.length) console.log('errori JS:', errs);
  console.log('');
  console.log('A) dopo un taglio di zona la selezione a mano porta al taglio:', okA);
  console.log('B) anche il secondo taglio esce a nocciolo:', okB);
  const ok = primoTaglio && okA && okB && errs.length === 0;
  console.log(ok ? '\nRISULTATO: DUE TAGLI DI FILA OK'
    : '\nRISULTATO: IL SECONDO TAGLIO NON FUNZIONA COME IL PRIMO');
  process.exitCode = ok ? 0 : 1;
})();
