(function () {
  'use strict';

  const PLA_DENSITY_G_CM3 = 1.24;

  const el = {
    fileBtn: document.getElementById('fileBtn'),
    fileInput: document.getElementById('fileInput'),
    viewer: document.getElementById('viewer'),
    viewerHint: document.getElementById('viewerHint'),
    frameBtn: document.getElementById('frameBtn'),
    emptyState: document.getElementById('emptyState'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText'),
    warnings: document.getElementById('warnings'),
    controlsRow: document.getElementById('controlsRow'),
    colorThreshold: document.getElementById('colorThreshold'),
    thresholdValue: document.getElementById('thresholdValue'),
    resegmentBtn: document.getElementById('resegmentBtn'),
    logTitle: document.getElementById('logTitle'),
    log: document.getElementById('log'),
    partsTitle: document.getElementById('partsTitle'),
    partsList: document.getElementById('partsList'),
    exportRow: document.getElementById('exportRow'),
    exportZipBtn: document.getElementById('exportZipBtn'),
  };

  const viewer = createViewer(el.viewer);

  let currentParsed = null; // dati grezzi dell'ultimo modello caricato
  let currentResult = null; // { parts, mode, warnings }

  function setLoading(visible, text) {
    el.loadingOverlay.classList.toggle('visible', visible);
    if (text) el.loadingText.textContent = text;
  }

  function ext(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name);
    return m ? m[1].toLowerCase() : '';
  }

  el.fileBtn.addEventListener('click', () => el.fileInput.click());
  el.fileInput.addEventListener('change', async () => {
    const files = Array.from(el.fileInput.files || []);
    if (files.length === 0) return;
    await handleFiles(files);
    el.fileInput.value = '';
  });

  async function handleFiles(files) {
    setLoading(true, 'Lettura del file…');
    try {
      const stlFile = files.find((f) => ext(f.name) === 'stl');
      const objFile = files.find((f) => ext(f.name) === 'obj');
      const mtlFile = files.find((f) => ext(f.name) === 'mtl');

      let parsed;
      if (objFile) {
        const objText = await objFile.text();
        let materials = new Map();
        if (mtlFile) materials = Parsers.parseMTL(await mtlFile.text());
        parsed = Parsers.parseOBJ(objText, materials);
      } else if (stlFile) {
        const buf = await stlFile.arrayBuffer();
        parsed = Parsers.parseSTL(buf);
      } else {
        alert('Seleziona un file .stl oppure .obj (con eventuale .mtl).');
        setLoading(false);
        return;
      }

      if (parsed.rawPositions.length === 0) {
        alert('Non ho trovato triangoli nel file selezionato. Controlla che il file non sia vuoto o corrotto.');
        setLoading(false);
        return;
      }

      currentParsed = parsed;
      const nTris = parsed.rawPositions.length / 9;
      if (nTris > 400000) {
        el.loadingText.textContent = `Modello grande (${nTris.toLocaleString('it-IT')} triangoli): potrebbe volerci un minuto…`;
        await new Promise((r) => setTimeout(r, 30));
      }

      await runSegmentation();
    } catch (err) {
      console.error(err);
      alert('Errore durante la lettura del file: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runSegmentation() {
    if (!currentParsed) return;
    setLoading(true, 'Riparazione e segmentazione in corso…');
    // lascia respirare la UI prima del lavoro pesante e sincrono
    await new Promise((r) => setTimeout(r, 30));

    const colorThreshold = parseInt(el.colorThreshold.value, 10) / 100;
    let result;
    try {
      result = Segmentation.buildParts(currentParsed, { colorThreshold });
    } catch (err) {
      console.error(err);
      alert('Errore durante la riparazione/segmentazione: ' + err.message);
      setLoading(false);
      return;
    }
    currentResult = result;
    renderResult(result);
    setLoading(false);
  }

  el.colorThreshold.addEventListener('input', () => {
    el.thresholdValue.textContent = el.colorThreshold.value;
  });
  el.resegmentBtn.addEventListener('click', () => { runSegmentation(); });
  el.frameBtn.addEventListener('click', () => viewer.frameAll());

  function fmt(n, digits) {
    return n.toLocaleString('it-IT', { maximumFractionDigits: digits === undefined ? 1 : digits });
  }

  function renderResult(result) {
    el.emptyState.style.display = 'none';
    el.viewerHint.style.display = '';
    el.frameBtn.style.display = '';
    el.controlsRow.style.display = result.mode === 'color-cluster' ? 'flex' : 'none';
    el.logTitle.style.display = '';
    el.partsTitle.style.display = '';
    el.exportRow.style.display = 'flex';

    viewer.clearParts();
    el.partsList.innerHTML = '';
    el.warnings.innerHTML = '';
    el.log.innerHTML = '';
    el.log.classList.add('visible');

    const modeLabel = {
      material: 'Segmentazione automatica per materiale/colore (dati OBJ)',
      'color-cluster': 'Segmentazione automatica per colore rilevato sul modello',
      none: 'Nessuna informazione di colore: separazione solo per parti geometricamente disgiunte',
    }[result.mode];

    const infoWarn = document.createElement('div');
    infoWarn.className = 'warning-box';
    infoWarn.style.background = 'rgba(91,140,255,0.12)';
    infoWarn.style.borderColor = 'rgba(91,140,255,0.4)';
    infoWarn.style.color = '#9db6ff';
    infoWarn.textContent = modeLabel;
    el.warnings.appendChild(infoWarn);

    result.warnings.forEach((w) => {
      const box = document.createElement('div');
      box.className = 'warning-box';
      box.textContent = '⚠️ ' + w;
      el.warnings.appendChild(box);
    });

    el.partsTitle.textContent = `Parti rilevate (${result.parts.length})`;

    result.parts.forEach((part) => addPartToScene(part));

    const logLines = [];
    result.parts.forEach((part) => {
      logLines.push(`— ${part.name} —`);
      part.log.forEach((l) => logLines.push('  ' + l));
    });
    el.log.textContent = logLines.join('\n');

    result.parts.forEach((part) => el.partsList.appendChild(buildPartCard(part)));

    requestAnimationFrame(() => viewer.frameAll());
    updateExportButtonState();
  }

  function addPartToScene(part) {
    viewer.addPart(part);
  }

  function volumeCm3(part) { return part.stats.volume / 1000; }
  function weightGrams(part) { return volumeCm3(part) * PLA_DENSITY_G_CM3; }
  function bboxSizeMm(part) {
    return [0, 1, 2].map((i) => part.stats.bboxMax[i] - part.stats.bboxMin[i]);
  }

  function buildPartCard(part) {
    const card = document.createElement('div');
    card.className = 'part-card';

    const top = document.createElement('div');
    top.className = 'part-card-top';

    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.style.background = `rgb(${Math.round(part.color[0] * 255)},${Math.round(part.color[1] * 255)},${Math.round(part.color[2] * 255)})`;
    top.appendChild(swatch);

    const nameInput = document.createElement('input');
    nameInput.className = 'part-name';
    nameInput.value = part.name;
    nameInput.addEventListener('input', () => { part.name = nameInput.value || part.name; });
    top.appendChild(nameInput);

    const visBtn = document.createElement('button');
    visBtn.className = 'visibility-toggle active';
    visBtn.textContent = '👁';
    visBtn.addEventListener('click', () => {
      part.visible = part.visible === false ? true : false;
      visBtn.classList.toggle('active', part.visible !== false);
      viewer.setPartVisible(part.id, part.visible !== false);
    });
    top.appendChild(visBtn);

    card.appendChild(top);

    const stats = document.createElement('div');
    stats.className = 'part-stats';
    const size = bboxSizeMm(part);
    const watertightBadge = part.watertight
      ? '<span>✔ solido chiuso</span>'
      : '<span class="bad">⚠ non completamente chiuso</span>';
    stats.innerHTML = `
      <span>${fmt(part.stats.volume / 1000, 1)} cm³</span>
      <span>~${fmt(weightGrams(part), 1)} g PLA</span>
      <span>${fmt(size[0], 0)}×${fmt(size[1], 0)}×${fmt(size[2], 0)} mm</span>
      <span>${part.indices.length / 3} triangoli</span>
      ${watertightBadge}
    `;
    card.appendChild(stats);

    const actions = document.createElement('div');
    actions.className = 'part-actions';

    const excludeBtn = document.createElement('button');
    excludeBtn.className = 'exclude-btn';
    excludeBtn.textContent = 'Escludi dall\'export';
    excludeBtn.addEventListener('click', () => {
      part.included = !part.included;
      excludeBtn.textContent = part.included ? 'Escludi dall\'export' : 'Esclusa — tocca per includere';
      excludeBtn.classList.toggle('excluded', !part.included);
      card.style.opacity = part.included ? '1' : '0.5';
      updateExportButtonState();
    });
    actions.appendChild(excludeBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = '⬇️ STL';
    downloadBtn.addEventListener('click', () => downloadPart(part));
    actions.appendChild(downloadBtn);

    card.appendChild(actions);
    return card;
  }

  function sanitizeFilename(name) {
    return (name || 'parte').trim().replace(/[^a-z0-9_\-àèéìòù ]/gi, '').replace(/\s+/g, '_') || 'parte';
  }

  function downloadPart(part) {
    const bytes = Exporter.buildBinarySTL(part.positions, part.indices, part.name);
    const blob = new Blob([bytes], { type: 'application/sla' });
    triggerDownload(blob, sanitizeFilename(part.name) + '.stl');
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function updateExportButtonState() {
    const anyIncluded = currentResult && currentResult.parts.some((p) => p.included);
    el.exportZipBtn.disabled = !anyIncluded;
  }

  el.exportZipBtn.addEventListener('click', () => {
    if (!currentResult) return;
    const included = currentResult.parts.filter((p) => p.included);
    if (included.length === 0) return;
    const usedNames = new Set();
    const files = included.map((part) => {
      let base = sanitizeFilename(part.name);
      let name = base + '.stl';
      let i = 2;
      while (usedNames.has(name)) { name = `${base}_${i++}.stl`; }
      usedNames.add(name);
      return { name, data: Exporter.buildBinarySTL(part.positions, part.indices, part.name) };
    });
    const zipBytes = Exporter.buildZip(files);
    const blob = new Blob([zipBytes], { type: 'application/zip' });
    triggerDownload(blob, 'parti_stampabili.zip');
  });
})();
