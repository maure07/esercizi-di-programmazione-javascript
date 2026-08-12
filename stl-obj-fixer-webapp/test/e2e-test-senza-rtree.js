// Il PC di chi usa l'app puo' NON avere rtree (libreria opzionale di trimesh).
// Senza, la misura dello spessore falliva, il nocciolo si arrendeva in
// silenzio e usciva il taglio normale col perno: per giorni sembrava che la
// faccia piatta non fosse mai stata implementata. Qui rtree c'e', quindi il
// difetto non si vedeva. Questa prova gira il taglio con rtree BLOCCATO.
const { execFileSync } = require('child_process');
const dir = require('path').join(__dirname, 'modelli');
try {
  const out = execFileSync('python3', [require('path').join(__dirname, 'prova-senza-rtree.py')],
    { encoding: 'utf8', timeout: 1800000, cwd: __dirname });
  console.log(out.trim());
  console.log(/ESITO: OK/.test(out)
    ? '\nRISULTATO: IL NOCCIOLO FUNZIONA ANCHE SENZA RTREE'
    : '\nRISULTATO: SENZA RTREE IL NOCCIOLO SI ARRENDE');
  process.exitCode = /ESITO: OK/.test(out) ? 0 : 1;
} catch (e) {
  console.log((e.stdout || '').trim());
  console.log('\nRISULTATO: SENZA RTREE IL TAGLIO FALLISCE');
  process.exitCode = 1;
}
