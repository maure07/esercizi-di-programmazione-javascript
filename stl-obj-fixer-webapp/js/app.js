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
    methodRow: document.getElementById('methodRow'),
    segMethod: document.getElementById('segMethod'),
    controlsRow: document.getElementById('controlsRow'),
    colorParts: document.getElementById('colorParts'),
    colorPartsValue: document.getElementById('colorPartsValue'),
    resegmentBtn: document.getElementById('resegmentBtn'),
    scaleRow: document.getElementById('scaleRow'),
    scaleHeight: document.getElementById('scaleHeight'),
    scaleApplyBtn: document.getElementById('scaleApplyBtn'),
    scaleHint: document.getElementById('scaleHint'),
    cutRow: document.getElementById('cutRow'),
    cutToggleBtn: document.getElementById('cutToggleBtn'),
    cutControls: document.getElementById('cutControls'),
    cutRadius: document.getElementById('cutRadius'),
    cutRadiusValue: document.getElementById('cutRadiusValue'),
    lassoOverlay: document.getElementById('lassoOverlay'),
    cutToolWandBtn: document.getElementById('cutToolWandBtn'),
    cutToolLassoBtn: document.getElementById('cutToolLassoBtn'),
    cutLassoCloseBtn: document.getElementById('cutLassoCloseBtn'),
    cutModeAddBtn: document.getElementById('cutModeAddBtn'),
    cutModeEraseBtn: document.getElementById('cutModeEraseBtn'),
    cutUndoBtn: document.getElementById('cutUndoBtn'),
    cutCreateBtn: document.getElementById('cutCreateBtn'),
    cutCancelBtn: document.getElementById('cutCancelBtn'),
    stepper: document.getElementById('stepper'),
    stepChip1: document.getElementById('stepChip1'),
    stepChip2: document.getElementById('stepChip2'),
    stepChip3: document.getElementById('stepChip3'),
    analysisPanel: document.getElementById('analysisPanel'),
    analysisReport: document.getElementById('analysisReport'),
    repairBtn: document.getElementById('repairBtn'),
    toSegmentBtn: document.getElementById('toSegmentBtn'),
    repairPanel: document.getElementById('repairPanel'),
    repairReport: document.getElementById('repairReport'),
    runRepairBtn: document.getElementById('runRepairBtn'),
    downloadRepairedBtn: document.getElementById('downloadRepairedBtn'),
    toSegmentBtn2: document.getElementById('toSegmentBtn2'),
    segmentPanel: document.getElementById('segmentPanel'),
    segmentBtn: document.getElementById('segmentBtn'),
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
  let currentScaleFactor = 1; // fattore di scala applicato (persiste tra un ricalcolo e l'altro)
  let currentAnalysis = null; // { positions, indices, ...statistiche } del modello grezzo saldato
  let currentRepaired = null; // { positions, indices, log, watertight, stats } riparazione intera

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

  const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

  async function handleFiles(files) {
    setLoading(true, 'Lettura del file…');
    try {
      const stlFile = files.find((f) => ext(f.name) === 'stl');
      const objFile = files.find((f) => ext(f.name) === 'obj');
      const mtlFile = files.find((f) => ext(f.name) === 'mtl');
      const imageFiles = files.filter((f) => IMAGE_EXTENSIONS.includes(ext(f.name)));

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

      if (parsed.hasTextureInfo && imageFiles.length > 0) {
        setLoading(true, 'Lettura colori dalla texture…');
        await new Promise((r) => setTimeout(r, 30));
        try {
          const rawImageData = await TextureSampler.decodeImageFile(imageFiles[0]);
          // sfoca leggermente la texture prima di campionare: attenua il
          // rumore fotografico/di compressione che altrimenti produrrebbe
          // triangoli isolati di colore sbagliato ai bordi tra due zone
          const blurRadius = TextureSampler.suggestBlurRadius(rawImageData.width, rawImageData.height);
          const imageData = TextureSampler.blurImageData(rawImageData, blurRadius);
          const nTris = parsed.rawPositions.length / 9;
          const sampled = TextureSampler.sampleTriangleColors(imageData, parsed.rawUV, nTris);
          parsed.rawColors = sampled;
          parsed.hasColorInfo = true;
          // la texture da' un segnale di colore per-triangolo molto piu' utile
          // di un singolo materiale piatto condiviso da tutta la mesh: se i
          // materiali distinti sono <= 1 (caso tipico dei modelli IA con
          // texture unica), diamo priorita' al colore campionato.
          if (parsed.materialCount <= 1) {
            parsed.hasMaterialInfo = false;
          }
          parsed.textureApplied = true;
        } catch (err) {
          console.error(err);
          parsed.textureError = err.message;
        }
      }

      currentParsed = parsed;
      currentScaleFactor = 1; // nuovo file: riparti dalla scala nativa del file
      currentAnalysis = null;
      currentRepaired = null;
      currentResult = null;
      setCutMode(false);
      // metodo predefinito: materiali espliciti multipli -> per materiale;
      // texture/colori -> combinata (forma + colore); nessun colore -> forma
      if (parsed.hasMaterialInfo && parsed.materialCount > 1) {
        el.segMethod.value = 'color';
      } else if (parsed.hasColorInfo) {
        el.segMethod.value = 'combined';
      } else {
        el.segMethod.value = 'geometry';
      }
      // STEP 1: solo analisi — nessuna modifica finche' non lo decidi tu
      await runAnalysis();
    } catch (err) {
      console.error(err);
      alert('Errore durante la lettura del file: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // =====================================================================
  // FLUSSO A STEP: 1 Analisi -> 2 Riparazione -> 3 Segmentazione
  // =====================================================================
  function goToStep(n) {
    [el.stepChip1, el.stepChip2, el.stepChip3].forEach((chip, i) => {
      chip.classList.toggle('active', i + 1 === n);
    });
    el.stepChip2.classList.toggle('done', !!currentRepaired);
    el.stepChip3.classList.toggle('done', !!currentResult);
    el.analysisPanel.style.display = n === 1 ? 'block' : 'none';
    el.repairPanel.style.display = n === 2 ? 'block' : 'none';
    el.segmentPanel.style.display = n === 3 ? 'block' : 'none';
    if (n === 3) {
      // metodo e numero parti visibili gia' prima di segmentare
      el.methodRow.style.display = 'flex';
      el.controlsRow.style.display = 'flex';
    }
    // il viewer mostra cio' che riguarda lo step corrente
    if (n === 3 && currentResult) {
      renderResult(currentResult);
    } else if (n === 2 && currentRepaired) {
      showSingleMesh(currentRepaired.positions, currentRepaired.indices, [0.45, 0.62, 0.85]);
    } else if (currentAnalysis && (n === 1 || n === 2)) {
      showSingleMesh(currentAnalysis.positions, currentAnalysis.indices, [0.72, 0.70, 0.66]);
    }
  }

  function showSingleMesh(positions, indices, color) {
    viewer.clearParts();
    viewer.addPart({ id: 'single', color, positions, indices });
    requestAnimationFrame(() => viewer.frameAll());
  }

  async function runAnalysis() {
    if (!currentParsed) return;
    setLoading(true, 'Analisi del modello in corso…');
    await new Promise((r) => setTimeout(r, 30));

    const { positions, indices } = MeshCore.weldVertices(currentParsed.rawPositions, 1e-4);
    const nTris = indices.length / 3;
    const deg = MeshCore.removeDegenerateTriangles(positions, indices);
    const nDegenerate = nTris - deg.indices.length / 3;
    const edgeMap = MeshCore.buildEdgeMap(indices);
    let nonManifold = 0;
    edgeMap.forEach((occ) => { if (occ.length > 2) nonManifold++; });
    const boundary = MeshCore.traceBoundaryLoops(indices, edgeMap);
    const comp = MeshCore.connectedComponents(indices, edgeMap);
    const stats = MeshCore.computeStats(positions, indices);
    const size = [0, 1, 2].map((i) => stats.bboxMax[i] - stats.bboxMin[i]);

    currentAnalysis = { positions, indices, nTris, nDegenerate, nonManifold, boundary, components: comp.componentCount, size };

    const issues = [];
    if (nDegenerate > 0) issues.push(`<div class="issue">⚠ ${fmt(nDegenerate, 0)} triangoli degeneri (senza area)</div>`);
    if (nonManifold > 0) issues.push(`<div class="issue">⚠ ${fmt(nonManifold, 0)} spigoli non-manifold (geometria doppia o difettosa)</div>`);
    if (boundary.totalBoundaryEdges > 0) issues.push(`<div class="issue">⚠ ${fmt(boundary.loops.length, 0)} buchi (${fmt(boundary.totalBoundaryEdges, 0)} spigoli di bordo): la superficie è aperta, non stampabile così</div>`);
    const issuesHtml = issues.length > 0
      ? issues.join('') + '<div class="dim" style="margin-top:6px">Consiglio: passa da "Ripara e solidifica" prima di segmentare.</div>'
      : '<div class="ok">✔ Nessun problema rilevato: la mesh è già chiusa e pulita.</div>';

    el.analysisReport.innerHTML = `
      <div><span class="dim">Triangoli:</span> ${fmt(nTris, 0)}</div>
      <div><span class="dim">Dimensioni:</span> ${fmt(size[0], 1)}×${fmt(size[1], 1)}×${fmt(size[2], 1)} (unità del file)</div>
      <div><span class="dim">Pezzi separati nel file:</span> ${fmt(comp.componentCount, 0)}</div>
      <div style="margin-top:6px">${issuesHtml}</div>
    `;

    el.emptyState.style.display = 'none';
    el.viewerHint.style.display = '';
    el.frameBtn.style.display = '';
    el.stepper.style.display = 'flex';
    goToStep(1);
    setLoading(false);
  }

  async function runWholeRepair() {
    if (!currentAnalysis) return;
    setLoading(true, 'Riparazione in corso…');
    await new Promise((r) => setTimeout(r, 30));
    try {
      const positions = Float64Array.from(currentAnalysis.positions);
      const indices = Uint32Array.from(currentAnalysis.indices);
      const repaired = MeshCore.repairMesh(positions, indices);
      currentRepaired = repaired;
      const size = [0, 1, 2].map((i) => repaired.stats.bboxMax[i] - repaired.stats.bboxMin[i]);
      el.repairReport.innerHTML = `
        ${repaired.log.map((l) => `<div>${/Attenzione|ancora aperta/.test(l) ? '<span class="issue">⚠ ' + l + '</span>' : '· ' + l}</div>`).join('')}
        <div style="margin-top:6px">${repaired.watertight ? '<span class="ok">✔ Modello chiuso e stampabile (watertight)</span>' : '<span class="issue">⚠ Restano bordi aperti: la stampa potrebbe comunque riuscire, lo slicer chiude i difetti piccoli</span>'}</div>
        <div class="dim" style="margin-top:4px">${fmt(repaired.indices.length / 3, 0)} triangoli · ${fmt(size[0], 1)}×${fmt(size[1], 1)}×${fmt(size[2], 1)}</div>
      `;
      el.downloadRepairedBtn.style.display = 'block';
      showSingleMesh(repaired.positions, repaired.indices, [0.45, 0.62, 0.85]);
      goToStep(2);
    } catch (err) {
      console.error(err);
      alert('Errore durante la riparazione: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  el.repairBtn.addEventListener('click', () => { goToStep(2); if (!currentRepaired) runWholeRepair(); });
  el.runRepairBtn.addEventListener('click', () => { if (!currentRepaired) runWholeRepair(); });
  el.toSegmentBtn.addEventListener('click', () => goToStep(3));
  el.toSegmentBtn2.addEventListener('click', () => goToStep(3));
  el.segmentBtn.addEventListener('click', () => runSegmentation());
  el.stepChip1.addEventListener('click', () => goToStep(1));
  el.stepChip2.addEventListener('click', () => goToStep(2));
  el.stepChip3.addEventListener('click', () => goToStep(3));
  el.downloadRepairedBtn.addEventListener('click', () => {
    if (!currentRepaired) return;
    const bytes = Exporter.buildBinarySTL(currentRepaired.positions, currentRepaired.indices, 'modello_riparato');
    triggerDownload(new Blob([bytes], { type: 'application/sla' }), 'modello_riparato.stl');
  });

  async function runSegmentation() {
    if (!currentParsed) return;
    setLoading(true, 'Riparazione e segmentazione in corso…');
    // lascia respirare la UI prima del lavoro pesante e sincrono
    await new Promise((r) => setTimeout(r, 30));

    const colorParts = parseInt(el.colorParts.value, 10);
    const method = el.segMethod.value;
    const segmentMode = method === 'geometry' ? 'geometry' : (method === 'combined' ? 'combined' : 'auto');
    let result;
    try {
      result = Segmentation.buildParts(currentParsed, { colorParts, segmentMode });
    } catch (err) {
      console.error(err);
      alert('Errore durante la riparazione/segmentazione: ' + err.message);
      setLoading(false);
      return;
    }
    // Segmentation.buildParts riparte sempre dai dati grezzi non scalati:
    // se l'utente aveva gia' impostato una scala, la riapplichiamo qui.
    if (currentScaleFactor !== 1) scaleAllParts(result.parts, currentScaleFactor);
    currentResult = result;
    renderResult(result);
    setLoading(false);
  }

  function computeOverallMaxDimension(parts) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    parts.forEach((p) => {
      for (let k = 0; k < 3; k++) {
        if (p.stats.bboxMin[k] < min[k]) min[k] = p.stats.bboxMin[k];
        if (p.stats.bboxMax[k] > max[k]) max[k] = p.stats.bboxMax[k];
      }
    });
    return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  }

  function scaleAllParts(parts, factor) {
    parts.forEach((part) => {
      for (let i = 0; i < part.positions.length; i++) part.positions[i] *= factor;
      part.stats = MeshCore.computeStats(part.positions, part.indices);
    });
  }

  el.colorParts.addEventListener('input', () => {
    el.colorPartsValue.textContent = el.colorParts.value;
  });
  el.segMethod.addEventListener('change', () => { runSegmentation(); });
  el.resegmentBtn.addEventListener('click', () => { runSegmentation(); });
  el.frameBtn.addEventListener('click', () => viewer.frameAll());

  el.scaleApplyBtn.addEventListener('click', () => {
    if (!currentResult || currentResult.parts.length === 0) return;
    const targetCm = parseFloat(el.scaleHeight.value);
    if (!targetCm || targetCm <= 0) {
      alert('Inserisci un\'altezza valida in centimetri (es. 15).');
      return;
    }
    const currentMaxMm = computeOverallMaxDimension(currentResult.parts);
    if (!(currentMaxMm > 0)) return;
    const incrementalFactor = (targetCm * 10) / currentMaxMm;
    scaleAllParts(currentResult.parts, incrementalFactor);
    currentScaleFactor *= incrementalFactor;
    renderResult(currentResult);
  });

  function fmt(n, digits) {
    return n.toLocaleString('it-IT', { maximumFractionDigits: digits === undefined ? 1 : digits });
  }

  function renderResult(result) {
    el.emptyState.style.display = 'none';
    el.viewerHint.style.display = '';
    el.frameBtn.style.display = '';
    el.methodRow.style.display = 'flex';
    el.controlsRow.style.display = (result.mode === 'color-cluster' || result.mode === 'geometry' || result.mode === 'combined') ? 'flex' : 'none';
    el.scaleRow.style.display = result.parts.length > 0 ? 'flex' : 'none';
    el.cutRow.style.display = result.parts.length > 0 ? 'block' : 'none';
    resetCutSelection();
    updateCutRadiusLabel();
    el.logTitle.style.display = '';
    el.partsTitle.style.display = '';
    el.exportRow.style.display = 'flex';

    if (result.parts.length > 0) {
      const maxMm = computeOverallMaxDimension(result.parts);
      el.scaleHint.style.display = '';
      el.scaleHint.textContent = `Dimensione massima rilevata: ${fmt(maxMm, 0)} mm. Se non corrisponde alla realtà, inserisci l'altezza vera sopra e tocca "Applica scala".`;
    }

    viewer.clearParts();
    el.partsList.innerHTML = '';
    el.warnings.innerHTML = '';
    el.log.innerHTML = '';
    el.log.classList.add('visible');

    const modeLabel = {
      material: 'Segmentazione automatica per materiale/colore (dati OBJ)',
      'color-cluster': 'Segmentazione automatica per colore rilevato sul modello',
      combined: 'Segmentazione combinata: struttura dalla forma + dettagli dal colore. Il nome di ogni parte è il colore di filamento suggerito.',
      geometry: 'Segmentazione per forma: tagli lungo le pieghe della superficie (i dettagli solo dipinti, come gli occhi, non vengono separati)',
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

    if (result.mode === 'geometry') {
      // in modalita' forma le note sulla texture non sono pertinenti
    } else if (currentParsed && currentParsed.textureError) {
      const box = document.createElement('div');
      box.className = 'warning-box';
      box.textContent = '⚠️ Non sono riuscito a leggere la texture: ' + currentParsed.textureError;
      el.warnings.appendChild(box);
    } else if (currentParsed && currentParsed.hasTextureInfo && !currentParsed.textureApplied) {
      const box = document.createElement('div');
      box.className = 'warning-box';
      box.textContent = '💡 Questo modello ha una texture (mappa UV) ma non hai selezionato il file immagine insieme a .obj e .mtl: caricali di nuovo tutti e tre insieme per segmentare per colore.';
      el.warnings.appendChild(box);
    } else if (currentParsed && currentParsed.textureApplied) {
      const box = document.createElement('div');
      box.className = 'warning-box';
      box.style.background = 'rgba(63,208,138,0.12)';
      box.style.borderColor = 'rgba(63,208,138,0.4)';
      box.style.color = '#6be3ac';
      box.textContent = '✔ Colori letti dalla texture del modello.';
      el.warnings.appendChild(box);
    }

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

    const isMainPart = currentResult && currentResult.parts.length > 0 && currentResult.parts[0] === part;
    if (currentResult && currentResult.parts.length > 1 && !isMainPart) {
      const mergeRow = document.createElement('div');
      mergeRow.className = 'part-actions';
      mergeRow.style.marginTop = '8px';
      const mergeBtn = document.createElement('button');
      mergeBtn.textContent = '🔗 Unisci con la parte principale';
      mergeBtn.addEventListener('click', () => mergePartIntoMain(part));
      mergeRow.appendChild(mergeBtn);
      card.appendChild(mergeRow);
    }

    return card;
  }

  function mergePartIntoMain(part) {
    if (!currentResult || currentResult.parts.length <= 1) return;
    const parts = currentResult.parts;
    const mainPart = parts[0];
    if (mainPart === part) return;

    const offset = mainPart.positions.length / 3;
    const newPositions = new Float64Array(mainPart.positions.length + part.positions.length);
    newPositions.set(mainPart.positions);
    newPositions.set(part.positions, mainPart.positions.length);
    const newIndices = new Uint32Array(mainPart.indices.length + part.indices.length);
    newIndices.set(mainPart.indices);
    for (let i = 0; i < part.indices.length; i++) {
      newIndices[mainPart.indices.length + i] = part.indices[i] + offset;
    }
    mainPart.positions = newPositions;
    mainPart.indices = newIndices;
    mainPart.stats = MeshCore.computeStats(mainPart.positions, mainPart.indices);
    mainPart.watertight = mainPart.watertight && part.watertight;
    mainPart.log = mainPart.log.concat([`Unita la parte "${part.name}" (${part.indices.length / 3} triangoli)`]);

    currentResult.parts = parts.filter((p) => p !== part);
    currentResult.parts.sort((a, b) => b.stats.volume - a.stats.volume);
    renderResult(currentResult);
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

  // =====================================================================
  // RITAGLIO MANUALE: tocchi il modello, una "bacchetta" seleziona la zona
  // attorno al punto (si ferma ai solchi concavi e al raggio massimo), e
  // "Crea parte" la scorpora in una parte nuova.
  // =====================================================================
  let cutMode = false;
  let cutErase = false;
  let cutSelection = null; // { partId, faces: Set<number> }
  let cutHistory = []; // stati precedenti della selezione, per "indietro"

  function pushCutHistory() {
    cutHistory.push(cutSelection ? { partId: cutSelection.partId, faces: new Set(cutSelection.faces) } : null);
    if (cutHistory.length > 10) cutHistory.shift();
    el.cutUndoBtn.disabled = false;
  }

  function resetCutSelection() {
    cutSelection = null;
    cutHistory = [];
    viewer.setHighlight(null);
    clearLasso();
    el.cutUndoBtn.disabled = true;
    el.cutCreateBtn.disabled = true;
    el.cutCreateBtn.textContent = 'Crea parte (0 triangoli)';
  }

  function setCutMode(active) {
    cutMode = active;
    el.cutToggleBtn.classList.toggle('active', active);
    el.cutToggleBtn.textContent = active ? '✂️ Ritaglio attivo — tocca il modello' : '✂️ Ritaglio manuale';
    el.cutControls.style.display = active ? 'block' : 'none';
    if (!active) resetCutSelection();
  }

  function setCutErase(erase) {
    cutErase = erase;
    el.cutModeAddBtn.classList.toggle('active', !erase);
    el.cutModeEraseBtn.classList.toggle('active', erase);
  }

  function updateCutRadiusLabel() {
    const pct = parseInt(el.cutRadius.value, 10);
    let label = pct + '%';
    if (currentResult && currentResult.parts.length > 0) {
      const mm = computeOverallMaxDimension(currentResult.parts) * (pct / 100);
      label += ' · ' + fmt(mm, 0) + ' mm';
    }
    el.cutRadiusValue.textContent = label;
  }

  // ------------------- strumento LAZO (stile Blender) -------------------
  // I punti del lazo sono ANCORATI alla superficie 3D del modello: puoi
  // ruotare/zoomare/spostarti liberamente mentre disegni, i punti seguono
  // il pezzo e vengono riproiettati a schermo a ogni frame.
  let cutTool = 'wand'; // 'wand' (pennello) | 'lasso'
  let lassoPoints = []; // punti 3D [x,y,z] sulla superficie del modello

  function lassoCtx() { return el.lassoOverlay.getContext('2d'); }

  function syncLassoOverlay() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = el.lassoOverlay.clientWidth, h = el.lassoOverlay.clientHeight;
    if (el.lassoOverlay.width !== Math.round(w * dpr) || el.lassoOverlay.height !== Math.round(h * dpr)) {
      el.lassoOverlay.width = Math.round(w * dpr);
      el.lassoOverlay.height = Math.round(h * dpr);
    }
    const ctx = lassoCtx();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function projectedLassoPoints() {
    return lassoPoints.map((p) => viewer.projectToScreen(p[0], p[1], p[2]));
  }

  function drawLasso() {
    syncLassoOverlay();
    const ctx = lassoCtx();
    ctx.clearRect(0, 0, el.lassoOverlay.clientWidth, el.lassoOverlay.clientHeight);
    if (lassoPoints.length === 0) return;
    const pts = projectedLassoPoints();
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
    pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === 0 ? 10 : 5, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? 'rgba(255,225,77,0.25)' : '#ffe14d';
      ctx.fill();
      ctx.strokeStyle = '#ffe14d';
      ctx.stroke();
    });
  }

  // ridisegna il lazo a ogni frame (i punti 3D seguono la camera)
  (function lassoRedrawLoop() {
    if (cutMode && cutTool === 'lasso' && lassoPoints.length > 0) drawLasso();
    requestAnimationFrame(lassoRedrawLoop);
  })();

  function clearLasso() {
    lassoPoints = [];
    el.cutLassoCloseBtn.style.display = 'none';
    el.cutUndoBtn.disabled = cutHistory.length === 0;
    drawLasso();
  }

  function setCutTool(tool) {
    cutTool = tool;
    el.cutToolWandBtn.classList.toggle('active', tool === 'wand');
    el.cutToolLassoBtn.classList.toggle('active', tool === 'lasso');
    clearLasso();
    document.getElementById('cutHint').textContent = tool === 'lasso'
      ? 'Tocca il modello per mettere i punti del perimetro: restano attaccati al pezzo, puoi ruotare e spostarti mentre disegni. Chiudi toccando il primo punto o con "Chiudi lazo", poi "Crea parte".'
      : 'Tocca il modello per selezionare (giallo). Raggio piccolo = tocchi precisi. ➖ Rimuovi cancella dove tocchi, ↩ annulla l\'ultimo tocco.';
  }

  function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function lassoSelectFaces(polygon) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polygon.forEach((p) => {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    const camPos = viewer.getCameraPosition();
    let bestPartId = null, bestFaces = null;
    for (const part of currentResult.parts) {
      if (part.visible === false) continue;
      const topo = ensurePartTopology(part);
      const n = part.indices.length / 3;
      const faces = [];
      for (let t = 0; t < n; t++) {
        const cx = topo.centroids[t * 3], cy = topo.centroids[t * 3 + 1], cz = topo.centroids[t * 3 + 2];
        // considera solo i triangoli rivolti verso la camera: quello che vedi
        // e' quello che selezioni (non "buca" fino al lato opposto del pezzo)
        const vx = cx - camPos[0], vy = cy - camPos[1], vz = cz - camPos[2];
        if (topo.normals[t * 3] * vx + topo.normals[t * 3 + 1] * vy + topo.normals[t * 3 + 2] * vz >= 0) continue;
        const s = viewer.projectToScreen(cx, cy, cz);
        if (s.behind) continue;
        if (s.x < minX || s.x > maxX || s.y < minY || s.y > maxY) continue;
        if (pointInPolygon(s.x, s.y, polygon)) faces.push(t);
      }
      if (faces.length > 0 && (!bestFaces || faces.length > bestFaces.length)) {
        bestFaces = faces;
        bestPartId = part.id;
      }
    }
    return bestPartId ? { partId: bestPartId, faces: new Set(bestFaces) } : null;
  }

  function closeLasso() {
    if (lassoPoints.length < 3) { clearLasso(); return; }
    // il poligono di selezione e' la proiezione ATTUALE dei punti 3D
    const sel = lassoSelectFaces(projectedLassoPoints());
    clearLasso();
    if (!sel) return;
    pushCutHistory();
    if (cutErase) {
      if (cutSelection && cutSelection.partId === sel.partId) {
        sel.faces.forEach((f) => cutSelection.faces.delete(f));
      }
    } else if (cutSelection && cutSelection.partId === sel.partId) {
      sel.faces.forEach((f) => cutSelection.faces.add(f));
    } else {
      cutSelection = sel;
    }
    refreshCutHighlight();
  }

  function addLassoPoint(clientX, clientY) {
    const rect = el.lassoOverlay.getBoundingClientRect();
    const sx = clientX - rect.left, sy = clientY - rect.top;
    // chiusura: tocco vicino alla proiezione ATTUALE del primo punto
    if (lassoPoints.length >= 3) {
      const first = viewer.projectToScreen(lassoPoints[0][0], lassoPoints[0][1], lassoPoints[0][2]);
      const dx = sx - first.x, dy = sy - first.y;
      if (Math.sqrt(dx * dx + dy * dy) < 24) { closeLasso(); return; }
    }
    // il punto va ancorato alla superficie: serve colpire il modello
    const hit = viewer.raycastAt(clientX, clientY);
    if (!hit) return;
    lassoPoints.push(hit.point);
    el.cutLassoCloseBtn.style.display = lassoPoints.length >= 3 ? 'block' : 'none';
    el.cutUndoBtn.disabled = false;
    drawLasso();
  }

  el.cutToolWandBtn.addEventListener('click', () => setCutTool('wand'));
  el.cutToolLassoBtn.addEventListener('click', () => setCutTool('lasso'));
  el.cutLassoCloseBtn.addEventListener('click', () => closeLasso());
  window.addEventListener('resize', () => { if (lassoPoints.length > 0) drawLasso(); });

  el.cutToggleBtn.addEventListener('click', () => setCutMode(!cutMode));
  el.cutCancelBtn.addEventListener('click', () => resetCutSelection());
  el.cutModeAddBtn.addEventListener('click', () => setCutErase(false));
  el.cutModeEraseBtn.addEventListener('click', () => setCutErase(true));
  el.cutUndoBtn.addEventListener('click', () => {
    // durante il disegno del lazo, "indietro" toglie l'ultimo punto
    if (cutTool === 'lasso' && lassoPoints.length > 0) {
      lassoPoints.pop();
      if (lassoPoints.length === 0) clearLasso();
      else {
        el.cutLassoCloseBtn.style.display = lassoPoints.length >= 3 ? 'block' : 'none';
        drawLasso();
      }
      return;
    }
    if (cutHistory.length === 0) return;
    cutSelection = cutHistory.pop();
    el.cutUndoBtn.disabled = cutHistory.length === 0;
    refreshCutHighlight();
  });
  el.cutRadius.addEventListener('input', updateCutRadiusLabel);

  // topologia per-parte (adiacenza + normali + centroidi), calcolata al primo
  // tocco e riusata; invalidata quando la geometria della parte cambia
  function ensurePartTopology(part) {
    if (part._topo) return part._topo;
    const nTris = part.indices.length / 3;
    const normals = new Float32Array(nTris * 3);
    const centroids = new Float32Array(nTris * 3);
    for (let t = 0; t < nTris; t++) {
      const a = part.indices[t * 3], b = part.indices[t * 3 + 1], c = part.indices[t * 3 + 2];
      const ax = part.positions[a * 3], ay = part.positions[a * 3 + 1], az = part.positions[a * 3 + 2];
      const bx = part.positions[b * 3], by = part.positions[b * 3 + 1], bz = part.positions[b * 3 + 2];
      const cx = part.positions[c * 3], cy = part.positions[c * 3 + 1], cz = part.positions[c * 3 + 2];
      let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      normals[t * 3] = nx / len; normals[t * 3 + 1] = ny / len; normals[t * 3 + 2] = nz / len;
      centroids[t * 3] = (ax + bx + cx) / 3;
      centroids[t * 3 + 1] = (ay + by + cy) / 3;
      centroids[t * 3 + 2] = (az + bz + cz) / 3;
    }
    const edgeMap = MeshCore.buildEdgeMap(part.indices);
    const adjacency = Array.from({ length: nTris }, () => []);
    edgeMap.forEach((occ) => {
      if (occ.length < 2) return;
      for (let i = 0; i < occ.length; i++) {
        for (let j = i + 1; j < occ.length; j++) {
          adjacency[occ[i].face].push(occ[j].face);
          adjacency[occ[j].face].push(occ[i].face);
        }
      }
    });
    part._topo = { adjacency, normals, centroids };
    return part._topo;
  }

  const CUT_CREASE_DEG = 18; // la bacchetta si ferma alle pieghe concave oltre questo angolo

  function wandSelect(part, seedFace, maxRadius) {
    const { adjacency, normals, centroids } = ensurePartTopology(part);
    const stopCos = Math.cos((CUT_CREASE_DEG * Math.PI) / 180);
    const selected = new Set([seedFace]);
    const dist = new Map([[seedFace, 0]]);
    const queue = [seedFace];
    while (queue.length) {
      const f = queue.shift();
      const df = dist.get(f);
      for (const nb of adjacency[f]) {
        if (selected.has(nb)) continue;
        // fermati alle pieghe concave marcate
        const dot = normals[f * 3] * normals[nb * 3]
          + normals[f * 3 + 1] * normals[nb * 3 + 1]
          + normals[f * 3 + 2] * normals[nb * 3 + 2];
        const sx = centroids[nb * 3] - centroids[f * 3];
        const sy = centroids[nb * 3 + 1] - centroids[f * 3 + 1];
        const sz = centroids[nb * 3 + 2] - centroids[f * 3 + 2];
        const side = normals[f * 3] * sx + normals[f * 3 + 1] * sy + normals[f * 3 + 2] * sz;
        if (side > 1e-12 && dot < stopCos) continue;
        const step = Math.sqrt(sx * sx + sy * sy + sz * sz);
        const dNew = df + step;
        if (dNew > maxRadius) continue;
        selected.add(nb);
        dist.set(nb, dNew);
        queue.push(nb);
      }
    }
    return selected;
  }

  function refreshCutHighlight() {
    if (!cutSelection || cutSelection.faces.size === 0) {
      viewer.setHighlight(null);
      el.cutCreateBtn.disabled = true;
      el.cutCreateBtn.textContent = 'Crea parte (0 triangoli)';
      return;
    }
    const part = currentResult.parts.find((p) => p.id === cutSelection.partId);
    if (!part) { resetCutSelection(); return; }
    const faces = [...cutSelection.faces];
    const positions = new Float32Array(faces.length * 9);
    faces.forEach((t, i) => {
      for (let k = 0; k < 3; k++) {
        const vi = part.indices[t * 3 + k];
        positions[i * 9 + k * 3] = part.positions[vi * 3];
        positions[i * 9 + k * 3 + 1] = part.positions[vi * 3 + 1];
        positions[i * 9 + k * 3 + 2] = part.positions[vi * 3 + 2];
      }
    });
    viewer.setHighlight(positions);
    el.cutCreateBtn.disabled = false;
    el.cutCreateBtn.textContent = `Crea parte (${faces.length.toLocaleString('it-IT')} triangoli)`;
  }

  function handleCutTap(clientX, clientY) {
    if (!currentResult) return;
    if (cutTool === 'lasso') {
      // tutti i punti del lazo passano dal tocco sul viewer: il trascinamento
      // continua a ruotare la vista anche durante il disegno
      addLassoPoint(clientX, clientY);
      return;
    }
    const hit = viewer.raycastAt(clientX, clientY);
    if (!hit) return;
    const part = currentResult.parts.find((p) => p.id === hit.partId);
    if (!part) return;
    // il raggio e' una percentuale della dimensione massima del modello
    const maxDim = computeOverallMaxDimension(currentResult.parts);
    const maxRadius = maxDim * (parseInt(el.cutRadius.value, 10) / 100);
    const tappedFaces = wandSelect(part, hit.faceIndex, maxRadius);

    if (cutErase) {
      // gomma: rimuove dalla selezione dove tocchi
      if (!cutSelection || cutSelection.partId !== hit.partId) return;
      pushCutHistory();
      tappedFaces.forEach((f) => cutSelection.faces.delete(f));
    } else if (cutSelection && cutSelection.partId === hit.partId) {
      pushCutHistory();
      tappedFaces.forEach((f) => cutSelection.faces.add(f));
    } else {
      pushCutHistory();
      cutSelection = { partId: hit.partId, faces: tappedFaces };
    }
    refreshCutHighlight();
  }

  el.cutCreateBtn.addEventListener('click', () => {
    if (!cutSelection || cutSelection.faces.size === 0 || !currentResult) return;
    const part = currentResult.parts.find((p) => p.id === cutSelection.partId);
    if (!part) return;
    const nTris = part.indices.length / 3;
    const selectedFaces = [...cutSelection.faces];
    if (selectedFaces.length >= nTris) {
      alert('La selezione copre tutta la parte: non c\'è nulla da scorporare.');
      return;
    }
    setLoading(true, 'Ritaglio e riparazione in corso…');
    setTimeout(() => {
      try {
        const selectedSet = cutSelection.faces;
        const restFaces = [];
        for (let t = 0; t < nTris; t++) if (!selectedSet.has(t)) restFaces.push(t);

        const subSel = MeshCore.extractSubMesh(part.positions, part.indices, selectedFaces);
        const repairedSel = MeshCore.repairMesh(subSel.positions, subSel.indices);
        const subRest = MeshCore.extractSubMesh(part.positions, part.indices, restFaces);
        const repairedRest = MeshCore.repairMesh(subRest.positions, subRest.indices);

        // aggiorna la parte originale con il "resto"
        part.positions = repairedRest.positions;
        part.indices = repairedRest.indices;
        part.log = part.log.concat([`Scorporati ${selectedFaces.length} triangoli con il ritaglio manuale`]);
        part.watertight = repairedRest.watertight;
        part.stats = repairedRest.stats;
        delete part._topo;

        // nuova parte dal ritaglio
        const existing = currentResult.parts.filter((p) => /^ritaglio/.test(p.name)).length;
        currentResult.parts.push({
          id: 'part_cut_' + Date.now(),
          name: existing === 0 ? 'ritaglio' : `ritaglio (${existing + 1})`,
          color: part.color.map((c) => Math.min(1, c * 0.6 + 0.35)),
          sourceTriangleCount: selectedFaces.length,
          positions: repairedSel.positions,
          indices: repairedSel.indices,
          log: repairedSel.log,
          watertight: repairedSel.watertight,
          stats: repairedSel.stats,
          included: true,
        });
        currentResult.parts.sort((a, b) => b.stats.volume - a.stats.volume);
        resetCutSelection();
        renderResult(currentResult);
        setCutMode(true); // resta in modalita' ritaglio per ritagli successivi
      } catch (err) {
        console.error(err);
        alert('Errore durante il ritaglio: ' + err.message);
      } finally {
        setLoading(false);
      }
    }, 30);
  });

  // tap sul canvas (distinto dal trascinamento per ruotare)
  let tapStart = null;
  el.viewer.addEventListener('pointerdown', (e) => {
    tapStart = { x: e.clientX, y: e.clientY, time: Date.now() };
  });
  el.viewer.addEventListener('pointerup', (e) => {
    if (!cutMode || !tapStart) { tapStart = null; return; }
    const dx = e.clientX - tapStart.x;
    const dy = e.clientY - tapStart.y;
    const moved = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - tapStart.time;
    tapStart = null;
    if (moved < 10 && elapsed < 600) {
      handleCutTap(e.clientX, e.clientY);
    }
  });
})();
