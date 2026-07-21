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
    sensitivityRow: document.getElementById('sensitivityRow'),
    colorSensitivity: document.getElementById('colorSensitivity'),
    colorSensitivityValue: document.getElementById('colorSensitivityValue'),
    sensitivityHint: document.getElementById('sensitivityHint'),
    solidRow: document.getElementById('solidRow'),
    solidQuality: document.getElementById('solidQuality'),
    solidifyAllBtn: document.getElementById('solidifyAllBtn'),
    closeLightBtn: document.getElementById('closeLightBtn'),
    connectorRow: document.getElementById('connectorRow'),
    connectorToggleBtn: document.getElementById('connectorToggleBtn'),
    connectorControls: document.getElementById('connectorControls'),
    connectorHint: document.getElementById('connectorHint'),
    connTypePegBtn: document.getElementById('connTypePegBtn'),
    connTypePinBtn: document.getElementById('connTypePinBtn'),
    connDiam: document.getElementById('connDiam'),
    connDiamValue: document.getElementById('connDiamValue'),
    connDepth: document.getElementById('connDepth'),
    connDepthValue: document.getElementById('connDepthValue'),
    connQuality: document.getElementById('connQuality'),
    connUndoBtn: document.getElementById('connUndoBtn'),
    connDoneBtn: document.getElementById('connDoneBtn'),
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
    cutToolPlaneBtn: document.getElementById('cutToolPlaneBtn'),
    cutLassoCloseBtn: document.getElementById('cutLassoCloseBtn'),
    cutModeAddBtn: document.getElementById('cutModeAddBtn'),
    cutModeEraseBtn: document.getElementById('cutModeEraseBtn'),
    cutUndoBtn: document.getElementById('cutUndoBtn'),
    cutCreateBtn: document.getElementById('cutCreateBtn'),
    cutCancelBtn: document.getElementById('cutCancelBtn'),
    selectExtras: document.getElementById('selectExtras'),
    planeControls: document.getElementById('planeControls'),
    planePart: document.getElementById('planePart'),
    planeAxisX: document.getElementById('planeAxisX'),
    planeAxisY: document.getElementById('planeAxisY'),
    planeAxisZ: document.getElementById('planeAxisZ'),
    planePos: document.getElementById('planePos'),
    planePosValue: document.getElementById('planePosValue'),
    planeCutBtn: document.getElementById('planeCutBtn'),
    selectFinalRow: document.getElementById('selectFinalRow'),
    stepper: document.getElementById('stepper'),
    stepChip1: document.getElementById('stepChip1'),
    stepChip2: document.getElementById('stepChip2'),
    stepChip3: document.getElementById('stepChip3'),
    stepChip4: document.getElementById('stepChip4'),
    printPanel: document.getElementById('printPanel'),
    filamentSummary: document.getElementById('filamentSummary'),
    explodeBtn: document.getElementById('explodeBtn'),
    saveProjectBtn: document.getElementById('saveProjectBtn'),
    layFlatChk: document.getElementById('layFlatChk'),
    toPrintBtn: document.getElementById('toPrintBtn'),
    lassoThroughChk: document.getElementById('lassoThroughChk'),
    analysisPanel: document.getElementById('analysisPanel'),
    analysisReport: document.getElementById('analysisReport'),
    modelHeight: document.getElementById('modelHeight'),
    applyModelScaleBtn: document.getElementById('applyModelScaleBtn'),
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
      const projectFile = files.find((f) => ext(f.name) === 'json');
      if (projectFile) {
        await loadProject(projectFile);
        return;
      }
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
    [el.stepChip1, el.stepChip2, el.stepChip3, el.stepChip4].forEach((chip, i) => {
      chip.classList.toggle('active', i + 1 === n);
    });
    el.stepChip2.classList.toggle('done', !!currentRepaired);
    el.stepChip3.classList.toggle('done', !!currentResult);
    el.analysisPanel.style.display = n === 1 ? 'block' : 'none';
    el.repairPanel.style.display = n === 2 ? 'block' : 'none';
    el.segmentPanel.style.display = n === 3 ? 'block' : 'none';
    el.printPanel.style.display = n === 4 ? 'block' : 'none';
    if (n === 3) {
      // metodo e numero parti visibili gia' prima di segmentare
      el.methodRow.style.display = 'flex';
      el.controlsRow.style.display = 'flex';
    }
    if (n === 4) {
      buildFilamentSummary();
      el.exportRow.style.display = currentResult && currentResult.parts.length > 0 ? 'flex' : 'none';
      updateExportButtonState();
    }
    if (explodedOn && n !== 4) setExploded(false);
    // il viewer mostra cio' che riguarda lo step corrente
    if (n === 3 && currentResult) {
      renderResult(currentResult);
    } else if (n === 2 && currentRepaired) {
      showSingleMesh(currentRepaired.positions, currentRepaired.indices, [0.45, 0.62, 0.85]);
    } else if (currentAnalysis && (n === 1 || n === 2)) {
      showSingleMesh(currentAnalysis.positions, currentAnalysis.indices, [0.72, 0.70, 0.66]);
    }
  }

  // ------------------- menu STAMPA (step 4) -------------------
  let explodedOn = false;

  function buildFilamentSummary() {
    if (!currentResult || currentResult.parts.length === 0) {
      el.filamentSummary.innerHTML = '<span class="dim">Nessuna parte: torna allo step 3 e segmenta il modello.</span>';
      return;
    }
    const groups = new Map(); // nomeColore -> { grams, parts: [nomi], color }
    currentResult.parts.filter((p) => p.included).forEach((p) => {
      const cname = Segmentation.colorNameForRGB(p.color[0], p.color[1], p.color[2]);
      let g = groups.get(cname);
      if (!g) { g = { grams: 0, parts: [], color: p.color }; groups.set(cname, g); }
      g.grams += weightGrams(p);
      g.parts.push(p.name);
    });
    const rows = [...groups.entries()].sort((a, b) => b[1].grams - a[1].grams);
    let totalG = 0;
    const html = rows.map(([cname, g], i) => {
      totalG += g.grams;
      const sw = `rgb(${Math.round(g.color[0] * 255)},${Math.round(g.color[1] * 255)},${Math.round(g.color[2] * 255)})`;
      return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0">
        <span class="dim">${i + 1}.</span>
        <span style="width:14px;height:14px;border-radius:4px;background:${sw};border:1px solid rgba(255,255,255,0.2);flex-shrink:0"></span>
        <b>${cname}</b>
        <span class="dim">· ${g.parts.length} ${g.parts.length === 1 ? 'pezzo' : 'pezzi'} · ~${fmt(g.grams, 1)} g</span>
      </div>`;
    }).join('');
    el.filamentSummary.innerHTML = `
      <div class="dim" style="margin-bottom:6px">Bobine da caricare (ordine consigliato: una alla volta, tutti i pezzi di quel colore):</div>
      ${html}
      <div style="margin-top:6px"><span class="dim">Totale:</span> ~${fmt(totalG, 1)} g PLA · ${currentResult.parts.filter((p) => p.included).length} pezzi</div>
    `;
  }

  function setExploded(on) {
    explodedOn = on;
    el.explodeBtn.classList.toggle('active', on);
    el.explodeBtn.textContent = on ? '💥 Vista esplosa attiva' : '💥 Vista esplosa';
    if (!currentResult) return;
    const parts = currentResult.parts;
    if (parts.length === 0) return;
    // centro complessivo
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    parts.forEach((p) => {
      for (let k = 0; k < 3; k++) {
        if (p.stats.bboxMin[k] < min[k]) min[k] = p.stats.bboxMin[k];
        if (p.stats.bboxMax[k] > max[k]) max[k] = p.stats.bboxMax[k];
      }
    });
    const center = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
    const maxDim = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    parts.forEach((p) => {
      if (!on) { viewer.setPartOffset(p.id, 0, 0, 0); return; }
      const pc = [0, 1, 2].map((k) => (p.stats.bboxMin[k] + p.stats.bboxMax[k]) / 2);
      let dx = pc[0] - center[0], dy = pc[1] - center[1], dz = pc[2] - center[2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const f = (maxDim * 0.35) / len;
      viewer.setPartOffset(p.id, dx * f, dy * f, dz * f);
    });
  }

  el.explodeBtn.addEventListener('click', () => setExploded(!explodedOn));
  el.toPrintBtn.addEventListener('click', () => goToStep(4));
  el.stepChip4.addEventListener('click', () => goToStep(4));

  // ------------------- salva / apri progetto -------------------
  function bytesToB64(u8) {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) {
      s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + CH, u8.length)));
    }
    return btoa(s);
  }
  function b64ToBytes(b64) {
    const s = atob(b64);
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }

  el.saveProjectBtn.addEventListener('click', () => {
    if (!currentResult || currentResult.parts.length === 0) {
      alert('Non ci sono parti da salvare: segmenta prima il modello.');
      return;
    }
    const project = {
      app: 'correggi-segmenta-stl',
      version: 1,
      salvato: new Date().toISOString(),
      parts: currentResult.parts.map((p) => ({
        name: p.name,
        color: p.color,
        included: p.included,
        watertight: p.watertight,
        positions: bytesToB64(new Uint8Array(Float32Array.from(p.positions).buffer)),
        indices: bytesToB64(new Uint8Array(Uint32Array.from(p.indices).buffer)),
      })),
    };
    const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
    triggerDownload(blob, 'progetto_parti.json');
  });

  async function loadProject(file) {
    setLoading(true, 'Apertura del progetto…');
    await new Promise((r) => setTimeout(r, 30));
    try {
      const project = JSON.parse(await file.text());
      if (project.app !== 'correggi-segmenta-stl' || !Array.isArray(project.parts)) {
        throw new Error('non è un file di progetto di questa app');
      }
      const parts = project.parts.map((p, i) => {
        const positions = Float64Array.from(new Float32Array(b64ToBytes(p.positions).buffer));
        const indices = new Uint32Array(b64ToBytes(p.indices).buffer);
        return {
          id: 'part_loaded_' + i,
          name: p.name || 'Parte ' + (i + 1),
          color: p.color || [0.8, 0.8, 0.8],
          included: p.included !== false,
          watertight: !!p.watertight,
          positions,
          indices,
          log: ['Caricata dal progetto salvato'],
          stats: MeshCore.computeStats(positions, indices),
          sourceTriangleCount: indices.length / 3,
        };
      });
      currentParsed = null;
      currentAnalysis = null;
      currentRepaired = null;
      currentScaleFactor = 1;
      currentResult = { parts, mode: 'progetto', warnings: [] };
      el.emptyState.style.display = 'none';
      el.viewerHint.style.display = '';
      el.frameBtn.style.display = '';
      el.stepper.style.display = 'flex';
      renderResult(currentResult);
      goToStep(3);
    } catch (err) {
      console.error(err);
      alert('Errore nell\'apertura del progetto: ' + err.message);
    } finally {
      setLoading(false);
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

    const tol = MeshCore.suggestTolerances(currentParsed.rawPositions);
    const { positions, indices } = MeshCore.weldVertices(currentParsed.rawPositions, tol.weldEpsilon);
    const nTris = indices.length / 3;
    const deg = MeshCore.removeDegenerateTriangles(positions, indices, tol.areaEpsilon);
    const nDegenerate = nTris - deg.indices.length / 3;
    const edgeMap = MeshCore.buildEdgeMap(indices);
    let nonManifold = 0;
    edgeMap.forEach((occ) => { if (occ.length > 2) nonManifold++; });
    const boundary = MeshCore.traceBoundaryLoops(indices, edgeMap);
    const comp = MeshCore.connectedComponents(indices, edgeMap);
    const stats = MeshCore.computeStats(positions, indices);
    const size = [0, 1, 2].map((i) => stats.bboxMax[i] - stats.bboxMin[i]);

    currentAnalysis = { positions, indices, nTris, nDegenerate, nonManifold, boundary, components: comp.componentCount, size, tol };

    const issues = [];
    if (nDegenerate > 0) issues.push(`<div class="issue">⚠ ${fmt(nDegenerate, 0)} triangoli degeneri (senza area)</div>`);
    if (nonManifold > 0) issues.push(`<div class="issue">⚠ ${fmt(nonManifold, 0)} spigoli non-manifold (geometria doppia o difettosa)</div>`);
    if (boundary.totalBoundaryEdges > 0) issues.push(`<div class="issue">⚠ ${fmt(boundary.loops.length, 0)} buchi (${fmt(boundary.totalBoundaryEdges, 0)} spigoli di bordo): la superficie è aperta, non stampabile così</div>`);
    const issuesHtml = issues.length > 0
      ? issues.join('') + '<div class="dim" style="margin-top:6px">Consiglio: passa da "Ripara e solidifica" prima di segmentare.</div>'
      : '<div class="ok">✔ Nessun problema rilevato: la mesh è già chiusa e pulita.</div>';

    el.analysisReport.innerHTML = `
      <div><span class="dim">Triangoli:</span> ${fmt(nTris, 0)}</div>
      <div><span class="dim">Dimensioni:</span> ${fmt(size[0], 1)}×${fmt(size[1], 1)}×${fmt(size[2], 1)} mm <span class="dim">(se non corrisponde, imposta l'altezza qui sotto)</span></div>
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
      const repaired = MeshCore.repairMesh(positions, indices, { areaEpsilon: currentAnalysis.tol.areaEpsilon });
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

  el.applyModelScaleBtn.addEventListener('click', async () => {
    if (!currentParsed || !currentAnalysis) return;
    const targetCm = parseFloat(el.modelHeight.value);
    if (!targetCm || targetCm <= 0) {
      alert('Inserisci un\'altezza valida in centimetri (es. 15).');
      return;
    }
    const maxDim = Math.max(...currentAnalysis.size);
    if (!(maxDim > 0)) return;
    const factor = (targetCm * 10) / maxDim;
    // scala i dati grezzi UNA volta: tutto il resto (riparazione,
    // segmentazione, export) lavorera' gia' in millimetri reali
    for (let i = 0; i < currentParsed.rawPositions.length; i++) {
      currentParsed.rawPositions[i] *= factor;
    }
    currentRepaired = null;
    currentResult = null;
    el.downloadRepairedBtn.style.display = 'none';
    el.repairReport.textContent = 'Premi "Ripara adesso" per correggere gli errori trovati e chiudere i buchi.';
    await runAnalysis();
  });

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
    if (!currentParsed) {
      if (currentResult && currentResult.mode === 'progetto') {
        alert('Questo è un progetto già segmentato: per rifare la segmentazione carica il file 3D originale (.stl/.obj).');
      }
      return;
    }
    setLoading(true, 'Riparazione e segmentazione in corso…');
    // lascia respirare la UI prima del lavoro pesante e sincrono
    await new Promise((r) => setTimeout(r, 30));

    const colorParts = parseInt(el.colorParts.value, 10);
    const method = el.segMethod.value;
    const segmentMode = method === 'geometry' ? 'geometry' : (method === 'combined' ? 'combined' : 'auto');
    // sensibilità colore 1..10 -> soglia di contrasto (alta sensibilità = soglia
    // bassa = separa anche i dettagli dipinti sottili come le sopracciglia)
    const sens = parseInt(el.colorSensitivity.value, 10);
    const colorBoundaryThreshold = Math.max(0.08, Math.min(0.34, 0.36 - 0.028 * sens));
    let result;
    try {
      result = Segmentation.buildParts(currentParsed, { colorParts, segmentMode, colorBoundaryThreshold });
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

  // Solidificazione a voxel: ogni pezzo incluso viene ricostruito come solido
  // chiuso e stampabile. Lavora un pezzo alla volta lasciando respirare la UI
  // (niente Web Worker: cediamo il controllo tra un pezzo e l'altro).
  async function solidifyAllParts() {
    if (!currentResult || currentResult.parts.length === 0) return;
    if (typeof Voxel === 'undefined') { alert('Modulo di solidificazione non disponibile.'); return; }
    const resolution = parseInt(el.solidQuality.value, 10) || 120;
    const parts = currentResult.parts.filter((p) => p.included);
    let done = 0;
    for (const part of parts) {
      done++;
      setLoading(true, `Rendo solido il pezzo ${done}/${parts.length} (${part.name})…`);
      await new Promise((r) => setTimeout(r, 20)); // fa disegnare l'overlay
      try {
        const solid = Voxel.remesh(part.positions, part.indices, { resolution, smoothIterations: 1 });
        if (solid.indices.length > 0) {
          part.positions = solid.positions;
          part.indices = solid.indices;
          part.stats = solid.stats;
          part.watertight = solid.watertight;
          part.solidified = true;
          part._topo = null; // invalida la topologia usata dal ritaglio
        }
      } catch (err) {
        console.error('solidify', part.name, err);
      }
    }
    setLoading(false);
    renderResult(currentResult);
  }
  el.solidifyAllBtn.addEventListener('click', () => { solidifyAllParts(); });

  // Chiusura LEGGERA: ripara ogni pezzo mantenendo i triangoli originali
  // (tappa solo i buchi, cuce le crepe). Preserva il dettaglio, a differenza
  // della ricostruzione a voxel.
  async function closeAllPartsLight() {
    if (!currentResult || currentResult.parts.length === 0) return;
    const parts = currentResult.parts.filter((p) => p.included);
    let done = 0, closed = 0;
    for (const part of parts) {
      done++;
      setLoading(true, `Chiudo il pezzo ${done}/${parts.length} (${part.name})…`);
      await new Promise((r) => setTimeout(r, 15));
      try {
        const rep = MeshCore.repairMesh(part.positions, part.indices);
        part.positions = rep.positions;
        part.indices = rep.indices;
        part.stats = rep.stats;
        part.watertight = rep.watertight;
        part._topo = null;
        if (rep.watertight) closed++;
      } catch (err) { console.error('close', part.name, err); }
    }
    setLoading(false);
    renderResult(currentResult);
    if (closed < parts.length) {
      alert(`${closed}/${parts.length} pezzi sono ora chiusi mantenendo i dettagli. Per quelli ancora aperti (gusci molto rotti) usa "Ricostruisci solido (voxel)".`);
    }
  }
  el.closeLightBtn.addEventListener('click', () => { closeAllPartsLight(); });

  // ------------------- CONNETTORI (perno+foro / fori per spillo) -------------------
  // Posizionamento a tocco. La booleana e' fatta sulla griglia a voxel, quindi
  // e' sempre pulita e chiusa. Ogni connettore unisce il pezzo toccato al
  // pezzo incluso piu' vicino.
  let connectorMode = false;
  let connType = 'peg'; // 'peg' = perno+foro | 'pin' = fori per spillo
  const connHistory = []; // per l'annulla: snapshot dei due pezzi modificati

  function partCenter(p) {
    return [
      (p.stats.bboxMin[0] + p.stats.bboxMax[0]) / 2,
      (p.stats.bboxMin[1] + p.stats.bboxMax[1]) / 2,
      (p.stats.bboxMin[2] + p.stats.bboxMax[2]) / 2,
    ];
  }
  function nearestVertDist2(part, P) {
    const pos = part.positions;
    const step = Math.max(3, Math.floor((pos.length / 3) / 4000)) * 3;
    let best = Infinity;
    for (let i = 0; i < pos.length; i += step) {
      const d = (pos[i] - P[0]) ** 2 + (pos[i + 1] - P[1]) ** 2 + (pos[i + 2] - P[2]) ** 2;
      if (d < best) best = d;
    }
    return best;
  }
  function normalize3(v) {
    const l = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  function setConnectorMode(on) {
    connectorMode = on;
    if (on && cutMode) setCutMode(false);
    el.connectorToggleBtn.classList.toggle('active', on);
    el.connectorControls.style.display = on ? 'block' : 'none';
    el.viewerHint.textContent = on
      ? 'Connettori: tocca dove due pezzi si uniscono. (Trascina per ruotare)'
      : 'Touch: 1 dito ruota · 2 dita zoom/sposta   ·   Mouse: sinistro/centrale ruota · rotellina zoom (verso il cursore) · destro o Shift sposta';
  }
  function setConnType(t) {
    connType = t;
    el.connTypePegBtn.classList.toggle('active', t === 'peg');
    el.connTypePinBtn.classList.toggle('active', t === 'pin');
  }

  async function applyConnectorAt(hitPartId, P) {
    if (typeof Voxel === 'undefined') { alert('Modulo connettori non disponibile.'); return; }
    const parts = currentResult.parts.filter((p) => p.included);
    const A = parts.find((p) => p.id === hitPartId);
    if (!A) return;
    let B = null, best = Infinity;
    for (const p of parts) {
      if (p === A) continue;
      const d = nearestVertDist2(p, P);
      if (d < best) { best = d; B = p; }
    }
    if (!B) { alert('Serve almeno un secondo pezzo per creare un connettore.'); return; }

    const r = parseFloat(el.connDiam.value) / 2;
    const depth = parseFloat(el.connDepth.value);
    const resolution = parseInt(el.connQuality.value, 10) || 130;
    const clr = 0.4; // gioco tra perno e foro (mm)

    // snapshot per l'annulla
    const snap = (p) => ({ part: p, positions: p.positions, indices: p.indices, stats: p.stats, watertight: p.watertight, solidified: p.solidified });
    connHistory.push([snap(A), snap(B)]);
    if (connHistory.length > 12) connHistory.shift();
    el.connUndoBtn.disabled = false;

    setLoading(true, connType === 'peg' ? 'Creo perno e foro…' : 'Creo i fori per lo spillo…');
    await new Promise((res) => setTimeout(res, 20));
    try {
      if (connType === 'pin') {
        // fori allineati passanti su entrambi i pezzi
        const a = normalize3([partCenter(A)[0] - partCenter(B)[0], partCenter(A)[1] - partCenter(B)[1], partCenter(A)[2] - partCenter(B)[2]]);
        const p0 = [P[0] - a[0] * depth, P[1] - a[1] * depth, P[2] - a[2] * depth];
        const p1 = [P[0] + a[0] * depth, P[1] + a[1] * depth, P[2] + a[2] * depth];
        const edit = { p0, p1, radius: r, mode: 'sub' };
        applySolidEdit(A, [edit], resolution);
        applySolidEdit(B, [edit], resolution);
      } else {
        // perno sul pezzo piu' grande, foro nel piu' piccolo
        const big = A.stats.volume >= B.stats.volume ? A : B;
        const small = big === A ? B : A;
        const cb = partCenter(big), cs = partCenter(small);
        const d = normalize3([cs[0] - cb[0], cs[1] - cb[1], cs[2] - cb[2]]);
        const peg = { p0: [P[0] - d[0] * r, P[1] - d[1] * r, P[2] - d[2] * r], p1: [P[0] + d[0] * depth, P[1] + d[1] * depth, P[2] + d[2] * depth], radius: r, mode: 'add' };
        const socket = { p0: [P[0] - d[0] * 0.5, P[1] - d[1] * 0.5, P[2] - d[2] * 0.5], p1: [P[0] + d[0] * (depth + clr), P[1] + d[1] * (depth + clr), P[2] + d[2] * (depth + clr)], radius: r + clr, mode: 'sub' };
        applySolidEdit(big, [peg], resolution);
        applySolidEdit(small, [socket], resolution);
      }
    } catch (err) {
      console.error('connector', err);
      alert('Errore nel creare il connettore: ' + err.message);
    }
    setLoading(false);
    renderResult(currentResult);
    setConnectorMode(true); // renderResult resetta i pannelli: riattiva la modalita'
  }

  function applySolidEdit(part, edits, resolution) {
    const res = Voxel.applyEdits(part.positions, part.indices, edits, { resolution, smoothIterations: 1 });
    if (res.indices.length > 0) {
      part.positions = res.positions;
      part.indices = res.indices;
      part.stats = res.stats;
      part.watertight = res.watertight;
      part.solidified = true;
      part._topo = null;
    }
  }

  el.connectorToggleBtn.addEventListener('click', () => setConnectorMode(!connectorMode));
  el.connTypePegBtn.addEventListener('click', () => setConnType('peg'));
  el.connTypePinBtn.addEventListener('click', () => setConnType('pin'));
  el.connDiam.addEventListener('input', () => { el.connDiamValue.textContent = el.connDiam.value + ' mm'; });
  el.connDepth.addEventListener('input', () => { el.connDepthValue.textContent = el.connDepth.value + ' mm'; });
  el.connDoneBtn.addEventListener('click', () => setConnectorMode(false));
  el.connUndoBtn.addEventListener('click', () => {
    const last = connHistory.pop();
    if (!last) return;
    last.forEach((s) => {
      s.part.positions = s.positions; s.part.indices = s.indices;
      s.part.stats = s.stats; s.part.watertight = s.watertight; s.part.solidified = s.solidified; s.part._topo = null;
    });
    el.connUndoBtn.disabled = connHistory.length === 0;
    renderResult(currentResult);
    setConnectorMode(true);
  });

  el.colorParts.addEventListener('input', () => {
    el.colorPartsValue.textContent = el.colorParts.value;
  });
  el.colorSensitivity.addEventListener('input', () => {
    el.colorSensitivityValue.textContent = el.colorSensitivity.value;
  });
  el.segMethod.addEventListener('change', () => { updateSegmentControls(); runSegmentation(); });
  el.resegmentBtn.addEventListener('click', () => { runSegmentation(); });

  // mostra la sensibilità colore solo quando il colore conta (combinata/colore)
  function updateSegmentControls() {
    const m = el.segMethod.value;
    const colorMatters = m === 'combined' || m === 'color';
    el.sensitivityRow.style.display = colorMatters ? 'flex' : 'none';
    el.sensitivityHint.style.display = colorMatters ? 'block' : 'none';
  }
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
    updateSegmentControls();
    el.solidRow.style.display = result.parts.length > 0 ? 'block' : 'none';
    el.connectorRow.style.display = result.parts.length > 1 ? 'block' : 'none';
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
      progetto: 'Progetto caricato: parti pronte per la modifica manuale e la stampa.',
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

  // se richiesto, ruota la parte con la faccia di taglio verso il basso e
  // la appoggia a Z=0, cosi' arriva allo slicer gia' orientata
  function exportPositions(part) {
    if (el.layFlatChk.checked) {
      return MeshCore.layFlat(part.positions, part.indices).positions;
    }
    return part.positions;
  }

  function downloadPart(part) {
    const bytes = Exporter.buildBinarySTL(exportPositions(part), part.indices, part.name);
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
      return { name, data: Exporter.buildBinarySTL(exportPositions(part), part.indices, part.name) };
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
    el.cutToggleBtn.textContent = active ? '✂️ Ritaglio attivo — dipingi sul modello' : '✂️ Ritaglio manuale';
    el.cutControls.style.display = active ? 'block' : 'none';
    if (active) setCutTool(cutTool); // imposta il messaggio d'aiuto giusto
    else { resetCutSelection(); viewer.hideCutPlane(); }
  }

  function setCutErase(erase) {
    cutErase = erase;
    el.cutModeAddBtn.classList.toggle('active', !erase);
    el.cutModeEraseBtn.classList.toggle('active', erase);
  }

  // raggio del pennello in % della dimensione del modello, con scala
  // ESPONENZIALE: cursore 0..1000 -> 0,05% .. 40%. Cosi' c'e' tanta finezza
  // sui valori piccoli (selezioni di precisione) e si arriva comunque a pennelli
  // grandi. parseFloat perche' il vecchio parseInt buttava via i decimali.
  function currentBrushPct() {
    const s = parseFloat(el.cutRadius.value);
    return 0.05 * Math.pow(800, s / 1000);
  }
  function updateCutRadiusLabel() {
    const pct = currentBrushPct();
    let label = (pct < 1 ? pct.toFixed(2) : pct.toFixed(1)) + '%';
    if (currentResult && currentResult.parts.length > 0) {
      const mm = computeOverallMaxDimension(currentResult.parts) * (pct / 100);
      label += ' · ⌀' + (mm * 2 < 1 ? (mm * 2).toFixed(2) : fmt(mm * 2, 1)) + ' mm';
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
    el.cutToolPlaneBtn.classList.toggle('active', tool === 'plane');
    clearLasso();
    resetCutSelection();
    const isPlane = tool === 'plane';
    el.planeControls.style.display = isPlane ? 'block' : 'none';
    el.selectExtras.style.display = isPlane ? 'none' : 'block';
    el.selectFinalRow.style.display = isPlane ? 'none' : 'flex';
    if (isPlane) { populatePlaneParts(); updatePlanePreview(); }
    else viewer.hideCutPlane();
    document.getElementById('cutHint').textContent =
      tool === 'lasso'
        ? 'Lazo: disegna un cappio CHIUSO tutto attorno alla zona (non un tratto). Metti i punti del contorno, poi chiudi toccando il primo punto o "Chiudi lazo" e "Crea parte". Per selezioni a mano libera conviene il Pennello.'
        : tool === 'plane'
          ? 'Taglio dritto: scegli il pezzo, l\'asse e la posizione del piano rosso, poi "Taglia qui". Le due facce vengono PIATTE e identiche, così i pezzi si incastrano perfettamente. Aggiungi poi i connettori per bloccarli.'
          : 'Pennello: TRASCINA il dito/mouse sul modello per dipingere la selezione (giallo) esattamente dove passi. Ruoti la vista trascinando fuori dal modello (sfondo). Regola il Raggio; ➖ Rimuovi fa da gomma.';
  }

  // ------------------- TAGLIO DRITTO CON UN PIANO -------------------
  let planeAxis = 'z';
  function planePartObj() {
    if (!currentResult) return null;
    const id = el.planePart.value;
    return currentResult.parts.find((p) => p.id === id) || currentResult.parts.filter((p) => p.included)[0] || null;
  }
  function populatePlaneParts() {
    if (!currentResult) return;
    const included = currentResult.parts.filter((p) => p.included);
    const prev = el.planePart.value;
    el.planePart.innerHTML = '';
    included.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.name;
      el.planePart.appendChild(o);
    });
    if (included.some((p) => p.id === prev)) el.planePart.value = prev;
  }
  function setPlaneAxis(ax) {
    planeAxis = ax;
    el.planeAxisX.classList.toggle('active', ax === 'x');
    el.planeAxisY.classList.toggle('active', ax === 'y');
    el.planeAxisZ.classList.toggle('active', ax === 'z');
    updatePlanePreview();
  }
  function planeFromControls(part) {
    const ai = planeAxis === 'x' ? 0 : (planeAxis === 'y' ? 1 : 2);
    const lo = part.stats.bboxMin[ai], hi = part.stats.bboxMax[ai];
    const f = parseInt(el.planePos.value, 10) / 100;
    const at = lo + (hi - lo) * f;
    const cx = (part.stats.bboxMin[0] + part.stats.bboxMax[0]) / 2;
    const cy = (part.stats.bboxMin[1] + part.stats.bboxMax[1]) / 2;
    const cz = (part.stats.bboxMin[2] + part.stats.bboxMax[2]) / 2;
    const point = [cx, cy, cz]; point[ai] = at;
    const normal = [0, 0, 0]; normal[ai] = 1;
    return { point, normal, ai };
  }
  function updatePlanePreview() {
    if (cutTool !== 'plane') return;
    const part = planePartObj();
    if (!part) { viewer.hideCutPlane(); return; }
    el.planePosValue.textContent = el.planePos.value + '%';
    const { point, normal } = planeFromControls(part);
    const s = part.stats.bboxMax, m = part.stats.bboxMin;
    const size = 1.4 * Math.max(s[0] - m[0], s[1] - m[1], s[2] - m[2], 1);
    viewer.showCutPlane(point, normal, size);
  }
  el.planePart.addEventListener('change', updatePlanePreview);
  el.planePos.addEventListener('input', updatePlanePreview);
  el.planeAxisX.addEventListener('click', () => setPlaneAxis('x'));
  el.planeAxisY.addEventListener('click', () => setPlaneAxis('y'));
  el.planeAxisZ.addEventListener('click', () => setPlaneAxis('z'));
  el.planeCutBtn.addEventListener('click', () => {
    const part = planePartObj();
    if (!part) return;
    const { point, normal } = planeFromControls(part);
    setLoading(true, 'Taglio con il piano in corso…');
    setTimeout(() => {
      try {
        const res = MeshCore.cutByPlane(part.positions, part.indices, point, normal);
        if (res.above.indices.length === 0 || res.below.indices.length === 0) {
          alert('Il piano non attraversa il pezzo: sposta la posizione.');
          setLoading(false); return;
        }
        const ra = MeshCore.repairMesh(res.above.positions, res.above.indices);
        const rb = MeshCore.repairMesh(res.below.positions, res.below.indices);
        // sostituisci il pezzo con le due metà
        const idx = currentResult.parts.indexOf(part);
        const mk = (rep, suff) => ({
          id: 'part_plane_' + Date.now() + '_' + suff,
          name: part.name + ' ' + suff,
          color: part.color.slice(),
          sourceTriangleCount: rep.indices.length / 3,
          positions: rep.positions, indices: rep.indices,
          log: rep.log, watertight: rep.watertight, stats: rep.stats, included: true,
        });
        currentResult.parts.splice(idx, 1, mk(rb, '(sotto)'), mk(ra, '(sopra)'));
        currentResult.parts.sort((a, b) => b.stats.volume - a.stats.volume);
        renderResult(currentResult);
        setCutMode(true); setCutTool('plane');
      } catch (err) {
        console.error(err); alert('Errore nel taglio con piano: ' + err.message);
      } finally { setLoading(false); }
    }, 30);
  });

  function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // tiene solo la componente connessa piu' grande di un insieme di facce
  // (rimuove i frammenti sparsi che non fanno parte della zona disegnata)
  function largestFaceComponent(faceSet, adjacency) {
    const visited = new Set();
    let best = null;
    faceSet.forEach((start) => {
      if (visited.has(start)) return;
      const comp = [];
      const stack = [start];
      visited.add(start);
      while (stack.length) {
        const f = stack.pop();
        comp.push(f);
        const adj = adjacency[f];
        for (let i = 0; i < adj.length; i++) {
          const nb = adj[i];
          if (faceSet.has(nb) && !visited.has(nb)) { visited.add(nb); stack.push(nb); }
        }
      }
      if (!best || comp.length > best.length) best = comp;
    });
    return new Set(best || []);
  }

  function lassoSelectFaces(polygon) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polygon.forEach((p) => {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    const camPos = viewer.getCameraPosition();
    const through = el.lassoThroughChk.checked; // lazo passante: prendi anche il retro
    let best = null;
    for (const part of currentResult.parts) {
      if (part.visible === false) continue;
      const topo = ensurePartTopology(part);
      const n = part.indices.length / 3;
      const insideAll = new Set(); // tutte le facce dentro il perimetro (fronte+retro)
      const front = new Set();     // rivolte verso di te (visibili)
      const fillable = new Set();  // fronte + fianco (per riempire i buchi, MA non il retro)
      for (let t = 0; t < n; t++) {
        const cx = topo.centroids[t * 3], cy = topo.centroids[t * 3 + 1], cz = topo.centroids[t * 3 + 2];
        const s = viewer.projectToScreen(cx, cy, cz);
        if (s.behind) continue;
        if (s.x < minX || s.x > maxX || s.y < minY || s.y > maxY) continue;
        if (!pointInPolygon(s.x, s.y, polygon)) continue;
        insideAll.add(t);
        let vx = cx - camPos[0], vy = cy - camPos[1], vz = cz - camPos[2];
        const vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
        const facing = (topo.normals[t * 3] * vx + topo.normals[t * 3 + 1] * vy + topo.normals[t * 3 + 2] * vz) / vl;
        if (facing < 0) front.add(t);        // verso la camera
        if (facing < 0.35) fillable.add(t);  // fronte o fianco (esclude il retro netto)
      }
      if (insideAll.size > 0 && (!best || insideAll.size > best.insideAll.size)) {
        best = { partId: part.id, topo, insideAll, front, fillable };
      }
    }
    if (!best) return null;

    let selected;
    if (through) {
      selected = best.insideAll; // taglio passante: tutto quello dentro il perimetro
    } else {
      // parti dalle facce viste; poi RIEMPI solo i buchi interni usando le facce
      // di fianco (non quelle del retro, cosi' non sborda sulle superfici sottili
      // come i capelli). Nessun filtro "zona piu' grande": non si perdono le
      // ciocche/parti separate.
      selected = new Set(best.front.size > 0 ? best.front : best.insideAll);
      const adj = best.topo.adjacency;
      for (let it = 0; it < 10; it++) {
        let added = 0;
        best.fillable.forEach((t) => {
          if (selected.has(t)) return;
          let c = 0;
          const a = adj[t];
          for (let i = 0; i < a.length; i++) if (selected.has(a[i])) c++;
          if (c >= 2) { selected.add(t); added++; }
        });
        if (!added) break;
      }
    }
    return selected.size > 0 ? { partId: best.partId, faces: selected } : null;
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
  el.cutToolPlaneBtn.addEventListener('click', () => setCutTool('plane'));
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
    // solo il lazo usa il "tocco": mette i punti del perimetro. Il pennello
    // dipinge (gestito dallo stroke: pointerdown/move sotto).
    if (cutTool === 'lasso') addLassoPoint(clientX, clientY);
  }

  // ------------------- PENNELLO CHE DIPINGE -------------------
  // Selezione a "disco geodetico": dal punto toccato cresce lungo la superficie
  // (via adiacenza) fino al raggio scelto. Trascinando si dipinge di continuo
  // esattamente dove passi. Molto piu' prevedibile del lazo.
  function paintDisk(part, seedFace, center, radius) {
    const topo = ensurePartTopology(part);
    const c = topo.centroids;
    const r2 = radius * radius;
    const sel = new Set([seedFace]);
    const stack = [seedFace];
    while (stack.length) {
      const f = stack.pop();
      const adj = topo.adjacency[f];
      for (let i = 0; i < adj.length; i++) {
        const nb = adj[i];
        if (sel.has(nb)) continue;
        const dx = c[nb * 3] - center[0], dy = c[nb * 3 + 1] - center[1], dz = c[nb * 3 + 2] - center[2];
        if (dx * dx + dy * dy + dz * dz <= r2) { sel.add(nb); stack.push(nb); }
      }
    }
    return sel;
  }

  let painting = false;
  let paintPartId = null;
  function paintAt(hit) {
    const part = currentResult && currentResult.parts.find((p) => p.id === hit.partId);
    if (!part) return;
    const maxDim = computeOverallMaxDimension(currentResult.parts);
    const radius = maxDim * (currentBrushPct() / 100);
    const faces = paintDisk(part, hit.faceIndex, hit.point, radius);
    if (cutErase) {
      if (cutSelection && cutSelection.partId === hit.partId) faces.forEach((f) => cutSelection.faces.delete(f));
    } else if (cutSelection && cutSelection.partId === hit.partId) {
      faces.forEach((f) => cutSelection.faces.add(f));
    } else {
      cutSelection = { partId: hit.partId, faces };
    }
    refreshCutHighlight();
  }

  // il viewer chiede se prendere questo tocco per dipingere (invece di ruotare)
  viewer.setPointerDownHook((x, y) => {
    if (!cutMode || cutTool !== 'wand') return false; // dipinge solo il pennello
    const hit = viewer.raycastAt(x, y);
    if (!hit) return false; // tocco fuori dal modello: lascia ruotare la vista
    pushCutHistory();
    painting = true;
    paintPartId = hit.partId;
    paintAt(hit);
    return true; // pointer "preso": niente rotazione mentre dipingi
  });
  el.viewer.addEventListener('pointermove', (e) => {
    if (!painting) return;
    const hit = viewer.raycastAt(e.clientX, e.clientY);
    if (hit && hit.partId === paintPartId) paintAt(hit);
  });
  window.addEventListener('pointerup', () => { painting = false; });
  window.addEventListener('pointercancel', () => { painting = false; });

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
    // col mouse solo il tasto sinistro seleziona/mette punti: destro e centrale
    // servono per spostarsi (pan) senza sporcare la selezione
    const isPan = e.button === 1 || e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey;
    tapStart = isPan ? null : { x: e.clientX, y: e.clientY, time: Date.now() };
  });
  el.viewer.addEventListener('pointerup', (e) => {
    if ((!cutMode && !connectorMode) || !tapStart) { tapStart = null; return; }
    const dx = e.clientX - tapStart.x;
    const dy = e.clientY - tapStart.y;
    const moved = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - tapStart.time;
    tapStart = null;
    if (moved < 10 && elapsed < 600) {
      if (connectorMode) {
        const hit = viewer.raycastAt(e.clientX, e.clientY);
        if (hit) applyConnectorAt(hit.partId, hit.point);
      } else {
        handleCutTap(e.clientX, e.clientY);
      }
    }
  });

  // accessi di sola lettura usati dai test automatici (nessun effetto sull'app)
  window.__viewerCam = () => viewer.getCameraPosition();
  window.__lassoCount = () => lassoPoints.length;
  window.__partsInfo = () => currentResult ? currentResult.parts.map((p) => ({ name: p.name, tris: p.indices.length / 3, wt: !!p.watertight })) : null;
  window.__cutInfo = () => {
    if (!cutSelection || !currentResult) return null;
    const part = currentResult.parts.find((p) => p.id === cutSelection.partId);
    if (!part) return null;
    const topo = ensurePartTopology(part);
    const sel = cutSelection.faces;
    // numero di componenti connesse della selezione (1 = zona contigua)
    const seen = new Set();
    let comps = 0;
    sel.forEach((s) => {
      if (seen.has(s)) return;
      comps++;
      const st = [s]; seen.add(s);
      while (st.length) { const f = st.pop(); for (const nb of topo.adjacency[f]) if (sel.has(nb) && !seen.has(nb)) { seen.add(nb); st.push(nb); } }
    });
    return { count: sel.size, components: comps };
  };
})();
