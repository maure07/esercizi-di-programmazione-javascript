const fs = require('fs');
const path = require('path');

// la webapp sta una cartella sopra: test/ vive dentro stl-obj-fixer-webapp
const root = path.join(__dirname, '..');
// il file montato finisce accanto ai modelli, che e' quello che il
// server di prova serve durante la batteria
const outDir = path.join(__dirname, 'modelli');

function safe(js) {
  // Evita che un `</script` presente LETTERALMENTE dentro il codice sorgente
  // chiuda in anticipo il tag <script> che lo contiene.
  return js.split('</script').join('<\\/script');
}

// L'app e' fatta di due meta': questo HTML e la cartella "ai-segmentation".
// Si riconoscono per nome di versione, e se i due nomi si scollano l'app si
// pianta accusando la meta' sbagliata - e' successo davvero, dopo che avevo
// cambiato la versione del motore dimenticandomi di quella dell'HTML.
// Quindi il montaggio si rifiuta di partire finche' non combaciano.
(function controllaVersioni() {
  const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  const py = path.join(root, '..', 'ai-segmentation', 'taglia_pro.py');
  if (!fs.existsSync(py)) return;                 // cartella non presente: niente da confrontare
  const qui = /TAGLIA_PRO_VERSIONE_ATTESA\s*=\s*'([^']+)'/.exec(appJs);
  const la = /^VERSIONE\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(py, 'utf8'));
  if (!qui || !la) return;
  if (qui[1] !== la[1]) {
    console.error('\nLE DUE META\' NON COMBACIANO:\n' +
      '  js/app.js  TAGLIA_PRO_VERSIONE_ATTESA = ' + qui[1] + '\n' +
      '  taglia_pro.py            VERSIONE     = ' + la[1] + '\n\n' +
      'Allineale prima di montare il file, se no l\'app si blocca da sola.\n');
    process.exit(1);
  }
})();

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [
  ['vendor/three.min.js', 'vendor/three.min.js'],
  ['js/geometry-core.js', 'js/geometry-core.js'],
  ['js/voxel.js', 'js/voxel.js'],
  ['js/parsers.js', 'js/parsers.js'],
  ['js/segmentation.js', 'js/segmentation.js'],
  ['js/export.js', 'js/export.js'],
  ['js/texture.js', 'js/texture.js'],
  ['js/viewer.js', 'js/viewer.js'],
  ['js/app.js', 'js/app.js'],
];

// IMPORTANTE: uso una funzione come sostituzione (non una stringa) perche'
// three.min.js contiene letteralmente la sequenza "$&"; con una stringa
// verrebbe interpretata come pattern speciale corrompendo l'output.
let standalone = html;
for (const [srcTag, file] of files) {
  const code = safe(fs.readFileSync(path.join(root, file), 'utf8'));
  standalone = standalone.replace('<script src="' + srcTag + '"></script>', () => '<script>\n' + code + '\n</script>');
}

// Verifica: nessun riferimento esterno rimasto
if (/src="http|src="\.\/|src="js\/|src="vendor\//.test(standalone)) {
  console.error('ATTENZIONE: riferimenti esterni ancora presenti!');
}

// 1) Standalone completo (consegnato all'utente)
const standalonePath = path.join(outDir, 'stl-obj-fixer.html');
fs.writeFileSync(standalonePath, standalone);

// 2) Bundle per l'Artifact (senza doctype/html/head/body)
let artifact = standalone;
artifact = artifact.replace(/^<!doctype html>\s*/i, '');
artifact = artifact.replace(/<html[^>]*>\s*/i, '');
artifact = artifact.replace(/<\/html>\s*$/i, '');
artifact = artifact.replace(/<head>\s*/i, '');
artifact = artifact.replace(/<\/head>\s*/i, '');
artifact = artifact.replace(/<body>\s*/i, '');
artifact = artifact.replace(/<\/body>\s*/i, '');
const artifactPath = path.join(outDir, 'artifact-bundle.html');
fs.writeFileSync(artifactPath, artifact);

// Alcuni test aprono index.html, altri stl-obj-fixer.html: sono la stessa
// pagina montata, e chiedere a ogni test di sapere quale non serve a niente.
// Se ne scrive una copia con tutti e due i nomi.
fs.writeFileSync(path.join(outDir, 'index.html'), standalone);

console.log('standalone', (standalone.length / 1024).toFixed(0), 'KB ->', standalonePath);
console.log('artifact  ', (artifact.length / 1024).toFixed(0), 'KB ->', artifactPath);
