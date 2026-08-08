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
    cutRowHint: document.getElementById('cutRowHint'),
    cutToggleBtn: document.getElementById('cutToggleBtn'),
    cutControls: document.getElementById('cutControls'),
    cutRadius: document.getElementById('cutRadius'),
    cutRadiusValue: document.getElementById('cutRadiusValue'),
    lassoOverlay: document.getElementById('lassoOverlay'),
    cutToolWandBtn: document.getElementById('cutToolWandBtn'),
    cutToolLassoBtn: document.getElementById('cutToolLassoBtn'),
    cutToolPlaneBtn: document.getElementById('cutToolPlaneBtn'),
    cutToolCopertaBtn: document.getElementById('cutToolCopertaBtn'),
    undoPartiBtn: document.getElementById('undoPartiBtn'),
    copertaControls: document.getElementById('copertaControls'),
    brushRadiusRow: document.getElementById('brushRadiusRow'),
    smartSelBox: document.getElementById('smartSelBox'),
    copertaPart: document.getElementById('copertaPart'),
    copertaAxisX: document.getElementById('copertaAxisX'),
    copertaAxisY: document.getElementById('copertaAxisY'),
    copertaAxisZ: document.getElementById('copertaAxisZ'),
    copertaResetBtn: document.getElementById('copertaResetBtn'),
    copertaPosizionaBtn: document.getElementById('copertaPosizionaBtn'),
    copertaScala: document.getElementById('copertaScala'),
    copertaScalaValue: document.getElementById('copertaScalaValue'),
    copertaCutBtn: document.getElementById('copertaCutBtn'),
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
    planeIncl: document.getElementById('planeIncl'),
    planeInclValue: document.getElementById('planeInclValue'),
    planeGira: document.getElementById('planeGira'),
    planeGiraValue: document.getElementById('planeGiraValue'),
    planeResetBtn: document.getElementById('planeResetBtn'),
    cutFlatProBtn: document.getElementById('cutFlatProBtn'),
    smartSelChk: document.getElementById('smartSelChk'),
    smartSelAngle: document.getElementById('smartSelAngle'),
    smartSelAngleValue: document.getElementById('smartSelAngleValue'),
    planeCutProBtn: document.getElementById('planeCutProBtn'),
    connAutoChk: document.getElementById('connAutoChk'),
    connGioco: document.getElementById('connGioco'),
    connScala: document.getElementById('connScala'),
    connScalaValue: document.getElementById('connScalaValue'),
    connGiocoValue: document.getElementById('connGiocoValue'),
    repairProBtn: document.getElementById('repairProBtn'),
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
    flatCutChk: document.getElementById('flatCutChk'),
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
    segmentAiBtn: document.getElementById('segmentAiBtn'),
    dettagliChk: document.getElementById('dettagliChk'),
    dettagliSens: document.getElementById('dettagliSens'),
    dettagliSensValue: document.getElementById('dettagliSensValue'),
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
      if (!showMeshWithModelColors(currentParsed, currentRepaired.positions, currentRepaired.indices)) {
        showSingleMesh(currentRepaired.positions, currentRepaired.indices, [0.45, 0.62, 0.85]);
      }
    } else if (currentAnalysis && n === 1 && showColoredModel(currentParsed)) {
      // step 1 con texture/colori: mostra il modello com'e' davvero
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

  // Disegna una mesh indicizzata con UN colore per triangolo: "srotola" ogni
  // triangolo in 3 vertici propri cosi' il colore per-faccia e' netto (niente
  // sfumature tra facce diverse). perTri = Float32Array [r,g,b, ...] per triangolo.
  function showColoredIndexedMesh(positions, indices, perTri) {
    const nTris = indices.length / 3;
    const P = new Float32Array(nTris * 9);
    const VC = new Float32Array(nTris * 9);
    const IDX = new Uint32Array(nTris * 3);
    for (let t = 0; t < nTris; t++) {
      const r = perTri[t * 3], g = perTri[t * 3 + 1], b = perTri[t * 3 + 2];
      for (let k = 0; k < 3; k++) {
        const vi = indices[t * 3 + k];
        const o = (t * 3 + k) * 3;
        P[o] = positions[vi * 3]; P[o + 1] = positions[vi * 3 + 1]; P[o + 2] = positions[vi * 3 + 2];
        VC[o] = r; VC[o + 1] = g; VC[o + 2] = b;
        IDX[t * 3 + k] = t * 3 + k;
      }
    }
    viewer.clearParts();
    viewer.addPart({ id: 'single', color: [0.8, 0.8, 0.8], positions: P, indices: IDX, vertexColors: VC });
    requestAnimationFrame(() => viewer.frameAll());
  }

  // Mostra il modello grezzo CON I SUOI COLORI reali (texture o materiali):
  // usa la "triangle soup" non saldata, cosi' ogni triangolo tiene il suo colore.
  function showColoredModel(parsed) {
    if (!parsed || !parsed.hasColorInfo || !parsed.rawColors) return false;
    const nTris = parsed.rawPositions.length / 9;
    const rc = parsed.rawColors;
    if (!rc || rc.length < nTris * 3) return false;
    const indices = new Uint32Array(nTris * 3);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
    showColoredIndexedMesh(parsed.rawPositions, indices, rc);
    return true;
  }

  // Trasferisce i colori del modello originale su una mesh diversa (es. quella
  // RIPARATA, che ha vertici/triangoli diversi): per ogni triangolo di arrivo
  // trova il triangolo originale col centroide piu' vicino e ne copia il colore.
  // Griglia hash sui centroidi originali -> O(n). Ritorna null se non ci sono colori.
  function transferColorsToMesh(parsed, positions, indices) {
    if (!parsed || !parsed.hasColorInfo || !parsed.rawColors) return null;
    const src = parsed.rawPositions, sc = parsed.rawColors;
    const nSrc = src.length / 9;
    if (nSrc === 0) return null;
    // bbox dei centroidi originali
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    const cent = new Float64Array(nSrc * 3);
    for (let t = 0; t < nSrc; t++) {
      const o = t * 9;
      const cx = (src[o] + src[o + 3] + src[o + 6]) / 3;
      const cy = (src[o + 1] + src[o + 4] + src[o + 7]) / 3;
      const cz = (src[o + 2] + src[o + 5] + src[o + 8]) / 3;
      cent[t * 3] = cx; cent[t * 3 + 1] = cy; cent[t * 3 + 2] = cz;
      if (cx < mnx) mnx = cx; if (cy < mny) mny = cy; if (cz < mnz) mnz = cz;
      if (cx > mxx) mxx = cx; if (cy > mxy) mxy = cy; if (cz > mxz) mxz = cz;
    }
    const cell = (Math.max(mxx - mnx, mxy - mny, mxz - mnz) || 1) / 64;
    const inv = 1 / cell;
    const gx = Math.max(1, Math.floor((mxx - mnx) * inv) + 1);
    const gy = Math.max(1, Math.floor((mxy - mny) * inv) + 1);
    const gz = Math.max(1, Math.floor((mxz - mnz) * inv) + 1);
    const key = (ix, iy, iz) => ix + iy * gx + iz * gx * gy;
    const clamp = (v, hi) => (v < 0 ? 0 : (v > hi ? hi : v));
    const map = new Map();
    for (let t = 0; t < nSrc; t++) {
      const ix = clamp(Math.floor((cent[t * 3] - mnx) * inv), gx - 1);
      const iy = clamp(Math.floor((cent[t * 3 + 1] - mny) * inv), gy - 1);
      const iz = clamp(Math.floor((cent[t * 3 + 2] - mnz) * inv), gz - 1);
      const k = key(ix, iy, iz); let arr = map.get(k); if (!arr) { arr = []; map.set(k, arr); } arr.push(t);
    }
    const nTgt = indices.length / 3;
    const out = new Float32Array(nTgt * 3);
    for (let t = 0; t < nTgt; t++) {
      const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
      const px = (positions[a * 3] + positions[b * 3] + positions[c * 3]) / 3;
      const py = (positions[a * 3 + 1] + positions[b * 3 + 1] + positions[c * 3 + 1]) / 3;
      const pz = (positions[a * 3 + 2] + positions[b * 3 + 2] + positions[c * 3 + 2]) / 3;
      const cix = clamp(Math.floor((px - mnx) * inv), gx - 1);
      const ciy = clamp(Math.floor((py - mny) * inv), gy - 1);
      const ciz = clamp(Math.floor((pz - mnz) * inv), gz - 1);
      let best = Infinity, bt = 0;
      for (let rad = 1; rad <= Math.max(gx, gy, gz); rad++) {
        for (let dz = -rad; dz <= rad; dz++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
          // solo il guscio nuovo del raggio corrente
          if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== rad) continue;
          const ix = cix + dx, iy = ciy + dy, iz = ciz + dz;
          if (ix < 0 || iy < 0 || iz < 0 || ix >= gx || iy >= gy || iz >= gz) continue;
          const arr = map.get(key(ix, iy, iz)); if (!arr) continue;
          for (let ai = 0; ai < arr.length; ai++) {
            const s = arr[ai];
            const d2 = (px - cent[s * 3]) ** 2 + (py - cent[s * 3 + 1]) ** 2 + (pz - cent[s * 3 + 2]) ** 2;
            if (d2 < best) { best = d2; bt = s; }
          }
        }
        // trovato qualcosa e abbiamo esplorato un guscio oltre: basta
        if (best < Infinity && rad >= 2) break;
      }
      out[t * 3] = sc[bt * 3]; out[t * 3 + 1] = sc[bt * 3 + 1]; out[t * 3 + 2] = sc[bt * 3 + 2];
    }
    return out;
  }

  // Mostra una mesh (riparata/solidificata) con i colori trasferiti dall'originale.
  // Ritorna true se aveva colori da mostrare, false altrimenti.
  function showMeshWithModelColors(parsed, positions, indices) {
    const perTri = transferColorsToMesh(parsed, positions, indices);
    if (!perTri) return false;
    showColoredIndexedMesh(positions, indices, perTri);
    return true;
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

    // stato colori/texture, mostrato subito allo step 1 (e' qui che l'utente
    // si accorge se il modello e' "grigio")
    let colorHtml = '';
    const cp = currentParsed;
    if (cp) {
      if (cp.textureError) {
        colorHtml = `<div class="issue" style="margin-top:6px">⚠ Non sono riuscito a leggere l'immagine texture: ${cp.textureError}. Il modello resta grigio.</div>`;
      } else if (cp.textureApplied) {
        colorHtml = '<div class="ok" style="margin-top:6px">✔ Texture caricata: il modello è mostrato con i suoi colori.</div>';
      } else if (cp.hasTextureInfo) {
        colorHtml = '<div class="issue" style="margin-top:6px">⚠ Questo .obj usa una texture ma non hai selezionato il file immagine (.png/.jpg). Per vedere i colori ricarica <b>insieme</b> .obj + .mtl + immagine (selezionali tutti nella stessa finestra).</div>';
      } else if (cp.hasColorInfo) {
        colorHtml = '<div class="ok" style="margin-top:6px">✔ Colori del modello caricati.</div>';
      } else {
        colorHtml = '<div class="dim" style="margin-top:6px">Modello senza colori: verrà mostrato in grigio (normale per gli STL). Per i colori serve un .obj con texture.</div>';
      }
    }

    el.analysisReport.innerHTML = `
      <div><span class="dim">Triangoli:</span> ${fmt(nTris, 0)}</div>
      <div><span class="dim">Dimensioni:</span> ${fmt(size[0], 1)}×${fmt(size[1], 1)}×${fmt(size[2], 1)} mm <span class="dim">(se non corrisponde, imposta l'altezza qui sotto)</span></div>
      <div><span class="dim">Pezzi separati nel file:</span> ${fmt(comp.componentCount, 0)}</div>
      <div style="margin-top:6px">${issuesHtml}</div>
      ${colorHtml}
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
      // se il modello ha colori (texture/materiali), mostralo a colori anche
      // dopo la riparazione invece del blu piatto
      if (!showMeshWithModelColors(currentParsed, repaired.positions, repaired.indices)) {
        showSingleMesh(repaired.positions, repaired.indices, [0.45, 0.62, 0.85]);
      }
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
  el.segmentAiBtn.addEventListener('click', () => runAiSegmentation());
  el.smartSelAngle.addEventListener('input', () => {
    el.smartSelAngleValue.textContent = el.smartSelAngle.value + '\u00b0';
  });
  el.dettagliSens.addEventListener('input', () => {
    el.dettagliSensValue.textContent = el.dettagliSens.value;
  });

  // Segmentazione tramite il companion locale (motore geometria o AI/GPU).
  // Manda la mesh saldata a http://127.0.0.1:8760 e riceve un'etichetta per
  // triangolo, poi costruisce le parti come al solito.
  const AI_URL = 'http://127.0.0.1:8760';

  // Tavolozza per i pezzi nati da un taglio. Prima il pezzo staccato ereditava
  // il colore di quello da cui veniva: due pezzi identici di colore, e a
  // schermo non si capiva piu' cosa fosse stato staccato da cosa.
  const PALETTE_PEZZI = [
    [0.90, 0.30, 0.24], [0.20, 0.55, 0.85], [0.95, 0.75, 0.15], [0.35, 0.75, 0.35],
    [0.65, 0.35, 0.85], [0.95, 0.55, 0.20], [0.25, 0.80, 0.75], [0.85, 0.35, 0.60],
  ];
  // sceglie il colore piu' LONTANO da quelli gia' in uso, cosi' il pezzo nuovo
  // si distingue sempre da quelli che ha intorno
  function coloreNuovo() {
    const usati = currentResult ? currentResult.parts.map((p) => p.color) : [];
    let migliore = PALETTE_PEZZI[0], distMax = -1;
    for (const c of PALETTE_PEZZI) {
      let min = Infinity;
      for (const u of usati) {
        if (!u) continue;
        const d = (c[0] - u[0]) ** 2 + (c[1] - u[1]) ** 2 + (c[2] - u[2]) ** 2;
        if (d < min) min = d;
      }
      if (min > distMax) { distMax = min; migliore = c; }
    }
    return migliore.slice();
  }

  // --- ANNULLA l'ultima operazione sui pezzi (taglio, connettore, unione...) ---
  // La selezione aveva gia' il suo "indietro", le operazioni sui pezzi no: un
  // taglio sbagliato non si poteva disfare se non ricaricando il modello.
  const storiaParti = [];
  function pushStoriaParti(etichetta) {
    if (!currentResult) return;
    // copia superficiale: le operazioni SOSTITUISCONO positions/indices, non li
    // modificano sul posto, quindi condividere gli array e' sicuro e non pesa
    storiaParti.push({ etichetta, parts: currentResult.parts.map((x) => Object.assign({}, x)) });
    if (storiaParti.length > 15) storiaParti.shift();
    aggiornaUndoParti();
  }
  function aggiornaUndoParti() {
    if (!el.undoPartiBtn) return;
    const ultimo = storiaParti[storiaParti.length - 1];
    el.undoPartiBtn.style.display = ultimo ? 'block' : 'none';
    if (ultimo) el.undoPartiBtn.title = 'Annulla: ' + ultimo.etichetta;
  }
  function annullaOperazioneParti() {
    const s = storiaParti.pop();
    if (!s || !currentResult) return;
    currentResult.parts = s.parts;
    resetCutSelection();
    renderResult(currentResult);
    aggiornaUndoParti();
  }
  // deve corrispondere a VERSIONE in ai-segmentation/taglia_pro.py: serve a
  // capire se sul PC gira ancora un companion vecchio (senza taglio locale)
  const TAGLIA_PRO_VERSIONE_ATTESA = 'taglio-liscio-6';
  async function runAiSegmentation() {
    if (!currentParsed) {
      alert('Carica prima un modello.');
      return;
    }
    // controlla che il companion sia acceso
    let health;
    try {
      const h = await fetch(AI_URL + '/health', { method: 'GET' });
      health = await h.json();
    } catch (e) {
      alert('Companion non raggiungibile.\n\nApri la cartella "ai-segmentation" sul PC e fai doppio clic su "avvia.bat" (lascia la finestra nera aperta), poi riprova.');
      return;
    }
    const engine = health.ai_available ? 'auto' : 'geometria';
    setLoading(true, health.ai_available ? 'Segmentazione AI sul PC (GPU)…' : 'Segmentazione sul PC…');
    await new Promise((r) => setTimeout(r, 20));
    try {
      const tol = MeshCore.suggestTolerances(currentParsed.rawPositions);
      const welded = MeshCore.weldVertices(currentParsed.rawPositions, tol.weldEpsilon);
      const nF = welded.indices.length / 3;
      setLoading(true, `Invio ${fmt(nF, 0)} triangoli al PC…`);
      await new Promise((r) => setTimeout(r, 20));
      const body = meshToPayload(welded.positions, welded.indices);
      body.target_parts = parseInt(el.colorParts.value, 10) || 8;
      body.engine = engine;
      body.dettagli = el.dettagliChk.checked;
      body.sensibilita_dettagli = parseInt(el.dettagliSens.value, 10);
      setLoading(true, `Analisi di ${fmt(nF, 0)} triangoli sul PC… (guarda la finestra nera per l'avanzamento)`);
      const resp = await fetch(AI_URL + '/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const out = await resp.json();
      const labels = out.labels;
      if (!labels || labels.length !== nF) throw new Error('risposta del companion non valida');
      // colori per faccia se il modello li ha (per dare il nome del filamento)
      const faceColors = (currentParsed.hasColorInfo && currentParsed.rawColors) ? currentParsed.rawColors : null;
      const result = Segmentation.buildPartsFromLabels(welded.positions, welded.indices, labels, faceColors, {});
      const nomeMotore = out.engine_used === 'ai' ? 'AI / GPU'
        : (out.engine_used === 'geometria+dettagli' ? 'forma + dettagli in rilievo' : 'geometria');
      result.warnings = [`Segmentazione dal companion locale (motore: ${nomeMotore}).`]
        .concat(out.note || []);
      if (currentScaleFactor !== 1) scaleAllParts(result.parts, currentScaleFactor);
      currentResult = result;
      renderResult(result);
    } catch (err) {
      console.error(err);
      alert('Errore dalla segmentazione locale: ' + err.message);
    } finally {
      setLoading(false);
    }
  }
  // =====================================================================
  // MOTORE PRO SUL PC: riparazione (MeshLab) e booleane esatte (manifold3d)
  // =====================================================================
  // Chiede al companion se e' acceso e cosa sa fare. Ritorna null se spento.
  async function companionHealth(silenzioso) {
    try {
      const h = await fetch(AI_URL + '/health', { method: 'GET' });
      return await h.json();
    } catch (e) {
      if (!silenzioso) {
        alert('Companion non raggiungibile.\n\nApri la cartella "ai-segmentation" sul PC e fai doppio clic su "avvia.bat" (lascia la finestra nera aperta), poi riprova.');
      }
      return null;
    }
  }

  // Dati mandati in forma PIATTA ([x,y,z,x,y,z,...]) invece che a terne.
  // Su un modello da 800.000 triangoli la versione a terne obbligava il browser
  // a creare centinaia di migliaia di piccoli array: memoria che esplodeva e PC
  // in ginocchio. Cosi' e' un array solo, e il JSON e' pure piu' corto.
  function meshToPayload(positions, indices) {
    return { vertices: Array.from(positions), faces: Array.from(indices) };
  }
  // Accetta ENTRAMBI i formati: a terne ([[x,y,z],...]) o piatto ([x,y,z,...]).
  // Il companion risponde in piatto per essere leggero; leggere solo le terne
  // produceva vertici NaN e volumi nulli.
  function payloadToMesh(out) {
    const V = out.vertices, F = out.faces;
    const piattoV = V.length === 0 || typeof V[0] === 'number';
    const piattoF = F.length === 0 || typeof F[0] === 'number';
    let positions;
    if (piattoV) {
      positions = Float64Array.from(V);
    } else {
      positions = new Float64Array(V.length * 3);
      for (let i = 0; i < V.length; i++) { positions[i * 3] = V[i][0]; positions[i * 3 + 1] = V[i][1]; positions[i * 3 + 2] = V[i][2]; }
    }
    let indices;
    if (piattoF) {
      indices = Uint32Array.from(F);
    } else {
      indices = new Uint32Array(F.length * 3);
      for (let t = 0; t < F.length; t++) { indices[t * 3] = F[t][0]; indices[t * 3 + 1] = F[t][1]; indices[t * 3 + 2] = F[t][2]; }
    }
    return { positions, indices };
  }

  // Riparazione professionale del modello intero (step 2).
  async function runRepairPro() {
    if (!currentAnalysis) { alert('Carica prima un modello.'); return; }
    const health = await companionHealth();
    if (!health) return;
    if (!health.ripara_pro) {
      alert('La riparazione PRO non è installata sul companion.\n\nApri la cartella "ai-segmentation" e fai doppio clic su "install_pro.bat", poi riavvia "avvia.bat".');
      return;
    }
    setLoading(true, 'Riparazione PRO sul PC (MeshLab + booleane esatte)…');
    await new Promise((r) => setTimeout(r, 20));
    try {
      const body = meshToPayload(currentAnalysis.positions, currentAnalysis.indices);
      body.aggressivita = 'auto';
      const resp = await fetch(AI_URL + '/ripara', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const out = await resp.json();
      if (out.error) throw new Error(out.error);
      const { positions, indices } = payloadToMesh(out);
      const stats = MeshCore.computeStats(positions, indices);
      currentRepaired = {
        positions, indices, stats,
        watertight: !!out.watertight,
        log: out.log || [],
      };
      const size = [0, 1, 2].map((i) => stats.bboxMax[i] - stats.bboxMin[i]);
      el.repairReport.innerHTML = `
        <div style="color:#6be3ac;margin-bottom:4px">🛠️ Riparazione PRO (motore MeshLab + solido esatto)</div>
        ${(out.log || []).map((l) => `<div>· ${l}</div>`).join('')}
        <div style="margin-top:6px">${out.watertight ? '<span class="ok">✔ Solido chiuso ed esatto: pronto per booleane e stampa</span>' : '<span class="issue">⚠ Restano bordi aperti</span>'}</div>
        <div class="dim" style="margin-top:4px">${fmt(indices.length / 3, 0)} triangoli · ${fmt(size[0], 1)}×${fmt(size[1], 1)}×${fmt(size[2], 1)}</div>
      `;
      el.downloadRepairedBtn.style.display = 'block';
      if (!showMeshWithModelColors(currentParsed, positions, indices)) {
        showSingleMesh(positions, indices, [0.45, 0.62, 0.85]);
      }
      goToStep(2);
    } catch (err) {
      console.error(err);
      alert('Errore dalla riparazione PRO: ' + err.message);
    } finally {
      setLoading(false);
    }
  }
  el.repairProBtn.addEventListener('click', () => runRepairPro());

  // Taglio PRO con piano + connettore quadrato automatico (perno + foro).
  async function runPlaneCutPro() {
    const part = planePartObj();
    if (!part) { alert('Scegli il pezzo da tagliare.'); return; }
    const health = await companionHealth();
    if (!health) return;
    if (!health.booleane_pro) {
      alert('Le booleane PRO non sono installate sul companion.\n\nApri la cartella "ai-segmentation" e fai doppio clic su "install_pro.bat", poi riavvia "avvia.bat".');
      return;
    }
    const { point, normal } = planeFromControls(part);
    const conn = el.connAutoChk.checked;
    const gioco = parseInt(el.connGioco.value, 10) / 100;
    pushStoriaParti('taglio dritto PRO');
    setLoading(true, conn ? 'Taglio esatto + connettore sul PC…' : 'Taglio esatto sul PC…');
    await new Promise((r) => setTimeout(r, 20));
    try {
      const body = meshToPayload(part.positions, part.indices);
      body.punto = point; body.normale = normal;
      body.connettore = conn; body.gioco = gioco; body.scala_connettore = scalaConn();
      const resp = await fetch(AI_URL + '/taglia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const out = await resp.json();
      if (out.error) throw new Error(out.error);

      const idx = currentResult.parts.indexOf(part);
      const mk = (p, suff) => {
        const { positions, indices } = payloadToMesh(p);
        return {
          id: 'part_pro_' + Date.now() + '_' + suff.replace(/\W/g, ''),
          name: part.name + ' ' + suff,
          color: /perno|sopra|\(A\)/.test(suff) ? coloreNuovo() : part.color.slice(),
          sourceTriangleCount: indices.length / 3,
          positions, indices,
          log: out.log || [], watertight: !!p.watertight,
          stats: MeshCore.computeStats(positions, indices),
          included: true,
        };
      };
      const suffA = conn ? '(perno)' : '(sopra)';
      const suffB = conn ? '(foro)' : '(sotto)';
      currentResult.parts.splice(idx, 1, mk(out.b, suffB), mk(out.a, suffA));
      currentResult.parts.sort((a, b) => b.stats.volume - a.stats.volume);
      renderResult(currentResult);
      setCutMode(true); setCutTool('plane');
      if (out.connettore) {
        const c = out.connettore;
        alert(`Taglio esatto riuscito.\n\nConnettore quadrato: lato ${c.lato.toFixed(1)} mm, profondità ${c.profondita.toFixed(1)} mm, gioco ${c.gioco.toFixed(2)} mm.\nIl perno è sul pezzo "(perno)", il foro sul pezzo "(foro)".`);
      }
    } catch (err) {
      console.error(err);
      alert('Errore dal taglio PRO: ' + err.message);
    } finally {
      setLoading(false);
    }
  }
  el.planeCutProBtn.addEventListener('click', () => runPlaneCutPro());
  // quanto ingrandire/rimpicciolire il perno rispetto alla misura automatica
  function scalaConn() {
    return el.connScala ? (parseInt(el.connScala.value, 10) || 100) / 100 : 1;
  }
  if (el.connScala) {
    el.connScala.addEventListener('input', () => {
      el.connScalaValue.textContent = el.connScala.value + '%';
    });
  }
  el.connGioco.addEventListener('input', () => {
    el.connGiocoValue.textContent = (parseInt(el.connGioco.value, 10) / 100).toFixed(2).replace('.', ',') + ' mm';
  });

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

  // Normale della superficie nel punto toccato: e' la direzione giusta per il
  // perno, perche' e' perpendicolare alla faccia dove i due pezzi si toccano.
  function faceNormalOf(part, faceIndex) {
    if (faceIndex === undefined || faceIndex === null) return null;
    const I = part.indices, Pp = part.positions;
    const a = I[faceIndex * 3], b = I[faceIndex * 3 + 1], c = I[faceIndex * 3 + 2];
    if (a === undefined) return null;
    const ux = Pp[b * 3] - Pp[a * 3], uy = Pp[b * 3 + 1] - Pp[a * 3 + 1], uz = Pp[b * 3 + 2] - Pp[a * 3 + 2];
    const vx = Pp[c * 3] - Pp[a * 3], vy = Pp[c * 3 + 1] - Pp[a * 3 + 1], vz = Pp[c * 3 + 2] - Pp[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!(l > 1e-12)) return null;
    return [nx / l, ny / l, nz / l];
  }

  async function applyConnectorAt(hitPartId, P, faceIndex) {
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
        let a = faceNormalOf(A, faceIndex);
        if (!a) a = normalize3([partCenter(A)[0] - partCenter(B)[0], partCenter(A)[1] - partCenter(B)[1], partCenter(A)[2] - partCenter(B)[2]]);
        const p0 = [P[0] - a[0] * depth, P[1] - a[1] * depth, P[2] - a[2] * depth];
        const p1 = [P[0] + a[0] * depth, P[1] + a[1] * depth, P[2] + a[2] * depth];
        const edit = { p0, p1, radius: r, mode: 'sub' };
        applySolidEdit(A, [edit], resolution);
        applySolidEdit(B, [edit], resolution);
      } else {
        // perno sul pezzo piu' grande, foro nel piu' piccolo
        const big = A.stats.volume >= B.stats.volume ? A : B;
        const small = big === A ? B : A;
        // Direzione del perno: la NORMALE della superficie nel punto toccato,
        // girata verso l'altro pezzo. Prima si usava la direzione fra i centri
        // dei due pezzi, che non ha niente a che vedere con la faccia dove si
        // toccano: su pezzi affiancati il perno usciva di traverso e non
        // agganciava nulla.
        const cb = partCenter(big), cs = partCenter(small);
        let d = faceNormalOf(A, faceIndex);
        if (d) {
          // orienta la normale in modo che punti verso il pezzo piccolo
          const verso = [cs[0] - P[0], cs[1] - P[1], cs[2] - P[2]];
          if (d[0] * verso[0] + d[1] * verso[1] + d[2] * verso[2] < 0) d = [-d[0], -d[1], -d[2]];
        } else {
          d = normalize3([cs[0] - cb[0], cs[1] - cb[1], cs[2] - cb[2]]);
        }
        // il perno affonda nel pezzo grande di quanto e' profondo, cosi' resta
        // saldamente attaccato invece di appoggiarsi appena alla superficie
        const ancora = Math.max(r, depth * 0.6);
        const peg = { p0: [P[0] - d[0] * ancora, P[1] - d[1] * ancora, P[2] - d[2] * ancora], p1: [P[0] + d[0] * depth, P[1] + d[1] * depth, P[2] + d[2] * depth], radius: r, mode: 'add' };
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

  // ------------------- CONNETTORE AUTOMATICO -------------------
  // Si sceglie il pezzo dall'ELENCO: il punto giusto lo trova da solo, dove i
  // due pezzi si toccano. Le booleane girano sul companion e sono esatte: il
  // resto della mesh resta identico, mentre la vecchia versione ricostruiva
  // tutto il pezzo su una griglia a voxel e rovinava il modello.
  // Distanza minima fra le superfici di due pezzi, campionando i vertici.
  // Serve a capire quale pezzo confina davvero con quale.
  function distanzaMinimaFraSuperfici(a, b) {
    const A = a.positions, B = b.positions;
    const nA = A.length / 3, nB = B.length / 3;
    const passoA = Math.max(1, Math.floor(nA / 800));
    const passoB = Math.max(1, Math.floor(nB / 800));
    // scarta subito i pezzi lontani confrontando gli ingombri
    let sep = 0;
    for (let k = 0; k < 3; k++) {
      const d = Math.max(a.stats.bboxMin[k] - b.stats.bboxMax[k],
                         b.stats.bboxMin[k] - a.stats.bboxMax[k], 0);
      sep += d * d;
    }
    if (sep > 0) return Math.sqrt(sep);   // gli ingombri non si sovrappongono
    let best = Infinity;
    for (let i = 0; i < nA; i += passoA) {
      const ax = A[i * 3], ay = A[i * 3 + 1], az = A[i * 3 + 2];
      for (let j = 0; j < nB; j += passoB) {
        const dx = ax - B[j * 3], dy = ay - B[j * 3 + 1], dz = az - B[j * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < best) best = d;
      }
    }
    return Math.sqrt(best);
  }

  // Autovalori/autovettori di una matrice 3x3 SIMMETRICA (metodo di Jacobi).
  // Serve per trovare il piano che meglio approssima un insieme di punti:
  // l'autovettore dell'autovalore piu' piccolo e' la perpendicolare a quel
  // piano. Prima qui si provavano 144 direzioni "a tentativi" (una griglia
  // ogni ~15 gradi): su un anello stretto come un polso quell'errore bastava
  // a far uscire il taglio storto. Con Jacobi la direzione e' esatta.
  function autovettoriSimmetrica3x3(xx, xy, xz, yy, yz, zz) {
    const a = [[xx, xy, xz], [xy, yy, yz], [xz, yz, zz]];
    const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let giro = 0; giro < 60; giro++) {
      // azzera, uno alla volta, il termine fuori diagonale piu' grande
      let p = 0, q = 1, max = Math.abs(a[0][1]);
      if (Math.abs(a[0][2]) > max) { max = Math.abs(a[0][2]); p = 0; q = 2; }
      if (Math.abs(a[1][2]) > max) { max = Math.abs(a[1][2]); p = 1; q = 2; }
      if (max < 1e-14) break;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const segno = theta >= 0 ? 1 : -1;
      const t = segno / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
      }
    }
    const val = [a[0][0], a[1][1], a[2][2]];
    const vec = [[v[0][0], v[1][0], v[2][0]], [v[0][1], v[1][1], v[2][1]], [v[0][2], v[1][2], v[2][2]]];
    const ordine = [0, 1, 2].sort((i, j) => val[i] - val[j]);
    return { valori: ordine.map((i) => val[i]), vettori: ordine.map((i) => vec[i]) };
  }

  // Piano medio del BORDO della selezione: i vertici che stanno sulla linea
  // fra i triangoli scelti e quelli lasciati fuori. E' il piano su cui i due
  // pezzi si separeranno.
  function pianoDelBordo(part, sel) {
    const topo = ensurePartTopology(part);
    const bordo = new Set();
    sel.forEach((f) => {
      const adj = topo.adjacency[f];
      for (let i = 0; i < adj.length; i++) {
        if (!sel.has(adj[i])) {
          for (let k = 0; k < 3; k++) bordo.add(part.indices[f * 3 + k]);
        }
      }
    });
    if (bordo.size < 3) return null;
    let cx = 0, cy = 0, cz = 0;
    bordo.forEach((v) => { cx += part.positions[v * 3]; cy += part.positions[v * 3 + 1]; cz += part.positions[v * 3 + 2]; });
    const nBordo = bordo.size; cx /= nBordo; cy /= nBordo; cz /= nBordo;

    // La normale del piano si ricava dall'ANELLO DEL BORDO (es. l'anello del
    // polso, se hai selezionato la mano): e' quello, e solo quello, a dire
    // dove e con che inclinazione i due pezzi si devono separare.
    //
    // Prima qui si usava la direzione "centro della selezione meno centro di
    // tutto il resto del pezzo". Sbagliato: su una mano attaccata a un
    // braccio, il "centro del resto" e' il baricentro di TUTTO il corpo, e
    // quella direzione punta in diagonale verso il centro del busto — non
    // lungo l'avambraccio. Risultato: taglio storto, in diagonale a meta'
    // della mano invece che dritto al polso.
    let sx = 0, sy = 0, sz = 0, ns = 0;
    const selMin = [Infinity, Infinity, Infinity];
    const selMax = [-Infinity, -Infinity, -Infinity];
    sel.forEach((f) => {
      for (let k = 0; k < 3; k++) {
        const v = part.indices[f * 3 + k];
        const px = part.positions[v * 3], py = part.positions[v * 3 + 1], pz = part.positions[v * 3 + 2];
        sx += px; sy += py; sz += pz; ns++;
        if (px < selMin[0]) selMin[0] = px; if (py < selMin[1]) selMin[1] = py; if (pz < selMin[2]) selMin[2] = pz;
        if (px > selMax[0]) selMax[0] = px; if (py > selMax[1]) selMax[1] = py; if (pz > selMax[2]) selMax[2] = pz;
      }
    });
    sx /= ns; sy /= ns; sz /= ns;

    // matrice di dispersione dei soli punti del bordo
    let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
    bordo.forEach((v) => {
      const dx = part.positions[v * 3] - cx, dy = part.positions[v * 3 + 1] - cy, dz = part.positions[v * 3 + 2] - cz;
      xx += dx * dx; xy += dx * dy; xz += dx * dz; yy += dy * dy; yz += dy * dz; zz += dz * dz;
    });
    const auto = autovettoriSimmetrica3x3(xx, xy, xz, yy, yz, zz);
    // l'anello si sviluppa nelle due direzioni con PIU' dispersione; la terza,
    // quella con meno, e' la perpendicolare al piano dell'anello
    let normale = auto.vettori[0];
    const lung = Math.hypot(normale[0], normale[1], normale[2]);
    if (!(lung > 1e-9)) return null;
    normale = [normale[0] / lung, normale[1] / lung, normale[2] / lung];

    // Quanto e' affidabile? Se l'anello e' quasi una retta (punti in fila) le
    // due direzioni piu' piccole si equivalgono e la perpendicolare non e'
    // definita: in quel caso si ripiega sulla direzione selezione->resto,
    // grossolana ma sempre definita.
    const l0 = Math.abs(auto.valori[0]), l1 = Math.abs(auto.valori[1]);
    if (l1 < 1e-12 || l0 / l1 > 0.6) {
      const nTri = part.indices.length / 3;
      let rx = 0, ry = 0, rz = 0, nr = 0;
      for (let f = 0; f < nTri; f++) {
        if (sel.has(f)) continue;
        for (let k = 0; k < 3; k++) {
          const v = part.indices[f * 3 + k];
          rx += part.positions[v * 3]; ry += part.positions[v * 3 + 1]; rz += part.positions[v * 3 + 2]; nr++;
        }
      }
      if (nr > 0) {
        rx /= nr; ry /= nr; rz /= nr;
        const dx = sx - rx, dy = sy - ry, dz = sz - rz;
        const len = Math.hypot(dx, dy, dz);
        if (len > 1e-9) normale = [dx / len, dy / len, dz / len];
      }
    }

    // la normale deve puntare VERSO la selezione
    const verso = (sx - cx) * normale[0] + (sy - cy) * normale[1] + (sz - cz) * normale[2];
    if (verso < 0) normale = [-normale[0], -normale[1], -normale[2]];
    // i punti del bordo servono al companion per costruire, quando il bordo
    // e' ondulato, un telo che ci passa sopra invece del piano medio
    const puntiBordo = [];
    bordo.forEach((v) => {
      puntiBordo.push(part.positions[v * 3], part.positions[v * 3 + 1], part.positions[v * 3 + 2]);
    });
    return { punto: [cx, cy, cz], normale, nBordo, selMin, selMax, puntiBordo };
  }

  // Taglio PIATTO sulla selezione, con booleane esatte sul companion.
  // Ritagliare gruppi di triangoli lascia sempre un bordo frastagliato: qui
  // invece si taglia il solido con il PIANO medio del bordo della selezione,
  // quindi le due facce che si toccano sono piatte e combaciano davvero.
  async function tagliaPiattoSullaSelezione() {
    if (!cutSelection || cutSelection.faces.size < 4 || !currentResult) {
      alert('Prima seleziona una zona sul modello.');
      return;
    }
    const part = currentResult.parts.find((p) => p.id === cutSelection.partId);
    if (!part) return;
    const piano = pianoDelBordo(part, cutSelection.faces);
    if (!piano) { alert('Non riesco a ricavare un piano dal bordo della selezione.'); return; }
    // La selezione "un clic = tutta la zona" su superfici morbide (senza una
    // piega netta vicino al punto toccato) puo' allargarsi molto oltre
    // l'intenzione, anche col cursore Estensione al minimo: il risultato e'
    // un pezzo enorme staccato "senza senso", scoperto solo a taglio fatto.
    // Il conteggio triangoli da solo NON basta: su un pezzo grande e denso
    // (es. un busto pieno di dettagli) una selezione puo' restare sotto il
    // 35% dei triangoli pur estendendosi per meta' dell'altezza del pezzo,
    // perche' i triangoli non sono distribuiti uniformemente nello spazio.
    // Quello che conta davvero e' quanto e' grande, in MISURE REALI, la
    // scatola della selezione rispetto al pezzo intero: e' proprio quella
    // scatola (bbox + margine) a decidere cosa tocca il taglio locale.
    const nTriParte = part.indices.length / 3;
    const fracSelezione = cutSelection.faces.size / nTriParte;
    const dimSel = [piano.selMax[0] - piano.selMin[0], piano.selMax[1] - piano.selMin[1], piano.selMax[2] - piano.selMin[2]];
    const dimParte = [
      part.stats.bboxMax[0] - part.stats.bboxMin[0],
      part.stats.bboxMax[1] - part.stats.bboxMin[1],
      part.stats.bboxMax[2] - part.stats.bboxMin[2],
    ];
    const diagSel = Math.hypot(dimSel[0], dimSel[1], dimSel[2]);
    const diagParte = Math.hypot(dimParte[0], dimParte[1], dimParte[2]) || 1;
    const fracSpaziale = diagSel / diagParte;
    if (fracSelezione > 0.35 || fracSpaziale > 0.3) {
      const continua = confirm(
        `La selezione occupa circa il ${Math.round(fracSelezione * 100)}% dei triangoli del pezzo e si estende per circa il ${Math.round(fracSpaziale * 100)}% delle sue dimensioni: sembra molto piu' grande di una singola zona come una mano o un dito.\n\n` +
        'Se il pennello/"un clic" si e\' allargato troppo, prova ad abbassare "Estensione" oppure usa il Lazo per disegnare a mano il contorno esatto.\n\n' +
        'Vuoi tagliare comunque questa selezione?'
      );
      if (!continua) return;
    }
    const health = await companionHealth();
    if (!health) return;
    if (!health.booleane_pro) {
      alert('Le booleane PRO non sono installate sul companion.\n\nApri "ai-segmentation" e fai doppio clic su "install_pro.bat", poi riavvia "avvia.bat".');
      return;
    }
    // Il taglio "solo zona selezionata" vive nel companion (taglia_pro.py),
    // non nel browser: se sul PC gira ancora una copia vecchia del
    // companion (finestra nera non chiusa/riavviata) il taglio torna a
    // tranciare tutto il pezzo, ma senza errori — e' silenzioso. Meglio
    // avvisare subito invece di far scoprire il problema dal risultato.
    if (health.taglia_pro_versione !== TAGLIA_PRO_VERSIONE_ATTESA) {
      const continua = confirm(
        'Il companion sul PC sembra una versione VECCHIA di "taglia_pro" (il taglio potrebbe tagliare tutto il pezzo invece che solo la zona selezionata).\n\n' +
        'Chiudi la finestra nera del companion, sostituisci la cartella "ai-segmentation" con quella nuova e riavvia "avvia.bat" prima di continuare.\n\n' +
        'Vuoi provare comunque il taglio adesso?'
      );
      if (!continua) return;
    }
    const conn = el.connAutoChk ? el.connAutoChk.checked : true;
    const gioco = el.connGioco ? parseInt(el.connGioco.value, 10) / 100 : 0.2;
    pushStoriaParti('taglio piatto');
    setLoading(true, 'Taglio piatto con booleane esatte…');
    await new Promise((r) => setTimeout(r, 20));
    try {
      const body = meshToPayload(part.positions, part.indices);
      body.punto = piano.punto; body.normale = piano.normale;
      body.selMin = piano.selMin; body.selMax = piano.selMax;
      body.connettore = conn; body.gioco = gioco; body.scala_connettore = scalaConn();
      body.bordo = piano.puntiBordo;
      // Prima strada: staccare ESATTAMENTE i triangoli scelti, chiudendo i due
      // pezzi con un tappo sul contorno. Piano e telo sono superfici che
      // arrivano da fuori e, dove sbordano, tagliano roba non selezionata
      // (le lamelle piatte comparse attorno allo strappo del pantalone).
      // QUALE MOTORE. Se il contorno della selezione e' un anello
      // ragionevolmente piano (una caviglia dentro uno stivale: ~27% di
      // scostamento) il piano e' la scelta giusta e regala una faccia di
      // taglio PIATTA, comoda da stampare. Se invece e' frastagliato (un orlo
      // strappato: oltre il 100%) il piano farebbe scempio, e allora si stacca
      // esattamente la selezione chiudendola con un tappo.
      let storto = 0;
      if (piano.puntiBordo && piano.puntiBordo.length >= 24) {
        const P = piano.puntiBordo, n = piano.normale, c = piano.punto;
        let somma = 0, somma2 = 0, cnt = 0;
        let lmin = Infinity, lmax = -Infinity;
        for (let i = 0; i < P.length; i += 3) {
          const dx = P[i] - c[0], dy = P[i + 1] - c[1], dz = P[i + 2] - c[2];
          const h = dx * n[0] + dy * n[1] + dz * n[2];
          somma += h; somma2 += h * h; cnt++;
          const lat = Math.hypot(dx - h * n[0], dy - h * n[1], dz - h * n[2]);
          if (lat < lmin) lmin = lat;
          if (lat > lmax) lmax = lat;
        }
        const media = somma / cnt;
        const dev = Math.sqrt(Math.max(0, somma2 / cnt - media * media));
        storto = dev / Math.max(2 * lmax, 1e-9);
      }
      let out = null;
      // Si usa SEMPRE, quando c'e'. Il taglio col piano si limita alla zona
      // scelta intersecandola con una SCATOLA squadrata, e le pareti di quella
      // scatola tagliano il modello dove lo incontrano: sono loro le lamelle
      // rettangolari che comparivano attorno alla selezione. Il taglio esatto
      // non ha nessuna scatola, quindi non puo' produrle. Il piano resta come
      // ripiego se il contorno e' troppo intricato per chiuderlo con un tappo.
      if (health.taglio_selezione) {
        const bodySel = meshToPayload(part.positions, part.indices);
        bodySel.selezione = Array.from(cutSelection.faces);
        bodySel.connettore = conn; bodySel.gioco = gioco;
        bodySel.scala_connettore = scalaConn();
        bodySel.appiattisci = el.flatCutChk ? el.flatCutChk.checked : true;
        try {
          const r1 = await fetch(AI_URL + '/taglia_selezione', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodySel),
          });
          const o1 = await r1.json();
          if (!o1.error) out = o1;
          else console.warn('taglio sulla selezione non riuscito, ripiego sul piano:', o1.error);
        } catch (e) {
          console.warn('taglio sulla selezione non raggiungibile, ripiego sul piano:', e);
        }
      }
      if (!out) {
        const resp = await fetch(AI_URL + '/taglia', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        out = await resp.json();
      }
      if (out.error) throw new Error(out.error);
      const idx = currentResult.parts.indexOf(part);
      const mk = (p, suff) => {
        const m = payloadToMesh(p);
        return {
          id: 'part_piatto_' + Date.now() + '_' + suff.replace(/\W/g, ''),
          name: part.name + ' ' + suff,
          color: /perno|sopra|\(A\)/.test(suff) ? coloreNuovo() : part.color.slice(),
          sourceTriangleCount: m.indices.length / 3,
          positions: m.positions, indices: m.indices,
          log: out.log || [], watertight: !!p.watertight,
          stats: MeshCore.computeStats(m.positions, m.indices),
          included: true,
        };
      };
      currentResult.parts.splice(idx, 1, mk(out.b, conn ? '(foro)' : '(B)'), mk(out.a, conn ? '(perno)' : '(A)'));
      currentResult.parts.sort((a, b) => b.stats.volume - a.stats.volume);
      cutSelection = null;
      renderResult(currentResult);
      alert('Taglio piatto riuscito: le due facce che si toccano sono piane e combaciano.' +
            (out.connettore ? `\n\nConnettore: lato ${out.connettore.lato.toFixed(1)} mm, gioco ${out.connettore.gioco.toFixed(2)} mm.` : ''));
    } catch (err) {
      console.error(err);
      alert('Errore nel taglio piatto: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function connettoreAutomatico(part) {
    if (!currentResult) return;
    const altri = currentResult.parts.filter((p) => p !== part && p.included);
    if (altri.length === 0) { alert('Serve almeno un altro pezzo incluso.'); return; }
    const health = await companionHealth();
    if (!health) return;
    if (!health.connettore_pro) {
      alert('Il connettore automatico non e\' installato sul companion.\n\nApri la cartella "ai-segmentation" e fai doppio clic su "install_pro.bat", poi riavvia "avvia.bat".');
      return;
    }
    // Il compagno giusto e' quello la cui SUPERFICIE tocca questo pezzo, non
    // quello con il centro piu' vicino: un ritaglio piccolo ha il centro
    // vicinissimo al pezzo da cui e' stato staccato, ma anche a pezzi che non
    // lo sfiorano nemmeno — ed e' cosi' che usciva "i due pezzi non si toccano".
    let vicino = null, best = Infinity;
    for (const p of altri) {
      const d = distanzaMinimaFraSuperfici(part, p);
      if (d < best) { best = d; vicino = p; }
    }
    if (!vicino) { alert('Non trovo un pezzo confinante.'); setLoading(false); return; }
    const gioco = el.connGioco ? parseInt(el.connGioco.value, 10) / 100 : 0.2;
    pushStoriaParti('perno e foro');
    setLoading(true, `Perno e foro fra "${part.name}" e "${vicino.name}"…`);
    await new Promise((r) => setTimeout(r, 20));
    try {
      const resp = await fetch(AI_URL + '/connettore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          a: meshToPayload(part.positions, part.indices),
          b: meshToPayload(vicino.positions, vicino.indices),
          gioco,
        }),
      });
      const out = await resp.json();
      if (out.error) throw new Error(out.error);
      const applica = (p, dati) => {
        const m = payloadToMesh(dati);
        p.positions = m.positions;
        p.indices = m.indices;
        p.stats = MeshCore.computeStats(m.positions, m.indices);
        p._topo = null;
      };
      applica(part, out.a);
      applica(vicino, out.b);
      renderResult(currentResult);
      const k = out.connettore;
      alert(`Fatto.\n\nPerno sul pezzo "${part.name}", foro su "${vicino.name}".\nLato ${k.lato.toFixed(1)} mm, profondita' ${k.profondita.toFixed(1)} mm, gioco ${k.gioco.toFixed(2)} mm.\n\nIl resto del modello non e' stato toccato.`);
    } catch (err) {
      console.error(err);
      alert('Errore nel connettore automatico: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  el.cutFlatProBtn.addEventListener('click', () => tagliaPiattoSullaSelezione());
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

  window.__storiaParti = () => storiaParti.length;
  window.__partsColori = () => (currentResult ? currentResult.parts.map((p) => ({ name: p.name, color: p.color })) : null);
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
    el.cutRowHint.style.display = result.parts.length > 0 ? 'block' : 'none';
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
      ai: 'Segmentazione dal companion locale sul PC (motore per forma / AI su GPU).',
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

    // Connettore AUTOMATICO: si sceglie il pezzo dall'elenco e basta. Il punto
    // dove mettere perno e foro lo trova da solo (dove i due pezzi si toccano),
    // e la booleana e' esatta: il resto della mesh non viene toccato.
    if (currentResult && currentResult.parts.length > 1) {
      const connRow = document.createElement('div');
      connRow.className = 'part-actions';
      connRow.style.marginTop = '8px';
      const connBtn = document.createElement('button');
      connBtn.textContent = '🔩 Aggiungi perno e foro (automatico)';
      connBtn.style.background = 'linear-gradient(90deg,#3fd08a,#2f9bd0)';
      connBtn.style.color = '#fff';
      connBtn.style.border = 'none';
      connBtn.addEventListener('click', () => connettoreAutomatico(part));
      connRow.appendChild(connBtn);
      card.appendChild(connRow);
    }

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
    el.cutToolCopertaBtn.classList.toggle('active', tool === 'coperta');
    clearLasso();
    resetCutSelection();
    const isPlane = tool === 'plane';
    const isCoperta = tool === 'coperta';
    const senzaSelezione = isPlane || isCoperta;
    el.planeControls.style.display = isPlane ? 'block' : 'none';
    el.copertaControls.style.display = isCoperta ? 'block' : 'none';
    el.selectExtras.style.display = senzaSelezione ? 'none' : 'block';
    el.selectFinalRow.style.display = senzaSelezione ? 'none' : 'flex';
    if (isPlane) { populatePlaneParts(); updatePlanePreview(); }
    else viewer.hideCutPlane();
    // col telo e col piano non si dipinge: via i comandi del pennello
    if (el.brushRadiusRow) el.brushRadiusRow.style.display = senzaSelezione ? 'none' : 'flex';
    if (el.smartSelBox) el.smartSelBox.style.display = senzaSelezione ? 'none' : 'block';
    copertaPosiziona = false;
    if (el.copertaPosizionaBtn) {
      el.copertaPosizionaBtn.classList.remove('active');
      el.copertaPosizionaBtn.textContent = '📍 Metti dove clicco';
    }
    if (isCoperta) { popolaCopertaParti(); creaCoperta(); }
    else viewer.nascondiCoperta();
    document.getElementById('cutHint').textContent =
      tool === 'lasso'
        ? 'Lazo: disegna un cappio CHIUSO tutto attorno alla zona (non un tratto). Metti i punti del contorno, poi chiudi toccando il primo punto o "Chiudi lazo" e "Crea parte". Per selezioni a mano libera conviene il Pennello.'
        : tool === 'coperta'
          ? 'Coperta: trascina i pallini per piegare il telo e stringerne il contorno. Il telo taglia SOLO dove passa, quindi puoi staccare un polso senza toccare il resto. Verdi = bordo, gialli = interno.'
        : tool === 'plane'
          ? 'Taglio dritto: scegli il pezzo, l\'asse e la posizione del piano rosso, poi "Taglia qui". Le due facce vengono PIATTE e identiche, così i pezzi si incastrano perfettamente. Aggiungi poi i connettori per bloccarli.'
          : 'Pennello: TRASCINA il dito/mouse sul modello per dipingere la selezione (giallo) esattamente dove passi. Ruoti la vista trascinando fuori dal modello (sfondo). Regola il Raggio; ➖ Rimuovi fa da gomma.';
  }


  // ------------------- LA COPERTA: telo di taglio deformabile -------------------
  // Il piano dritto e' infinito: per staccare un polso taglia anche tutto il
  // resto che incontra. La coperta invece ha un PERIMETRO, e si piega: taglia
  // solo dove la metti. Le maniglie si trascinano direttamente nel 3D.
  const COPERTA_N = 5;                 // 5x5 maniglie
  let coperta = null;                  // { partId, punti: Float64Array(N*N*3) }
  let copertaAsse = 'z';
  let copertaTrascina = null;          // { indice, partenza }
  let copertaPosiziona = false;        // "metti il telo dove clicco"

  // porta il telo (senza deformarlo) col centro su un punto scelto
  function spostaCopertaSu(punto) {
    if (!coperta) return;
    const n = COPERTA_N * COPERTA_N;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += coperta.punti[i * 3]; cy += coperta.punti[i * 3 + 1]; cz += coperta.punti[i * 3 + 2]; }
    const dx = punto[0] - cx / n, dy = punto[1] - cy / n, dz = punto[2] - cz / n;
    for (let i = 0; i < coperta.punti.length; i += 3) {
      coperta.punti[i] += dx; coperta.punti[i + 1] += dy; coperta.punti[i + 2] += dz;
    }
    disegnaCoperta();
  }

  function copertaParte() {
    if (!currentResult) return null;
    const id = el.copertaPart.value;
    return currentResult.parts.find((p) => p.id === id)
        || currentResult.parts.filter((p) => p.included)[0] || null;
  }
  function popolaCopertaParti() {
    if (!currentResult) return;
    const inclusi = currentResult.parts.filter((p) => p.included);
    const prima = el.copertaPart.value;
    el.copertaPart.innerHTML = '';
    inclusi.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.name;
      el.copertaPart.appendChild(o);
    });
    if (inclusi.some((p) => p.id === prima)) el.copertaPart.value = prima;
  }

  // telo piatto, grande una frazione del pezzo, messo al centro e rivolto
  // secondo l'asse scelto: da qui l'utente lo piega e lo stringe
  function creaCoperta() {
    const part = copertaParte();
    if (!part) { viewer.nascondiCoperta(); coperta = null; return; }
    const mn = part.stats.bboxMin, mx = part.stats.bboxMax;
    const centro = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    const maxDim = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2], 1);
    const lato = maxDim * (parseInt(el.copertaScala.value, 10) / 100);
    const ai = copertaAsse === 'x' ? 0 : (copertaAsse === 'y' ? 1 : 2);
    const e = [0, 0, 0]; e[ai] = 1;
    const t = ai === 2 ? [1, 0, 0] : [0, 0, 1];
    let u = [t[1] * e[2] - t[2] * e[1], t[2] * e[0] - t[0] * e[2], t[0] * e[1] - t[1] * e[0]];
    const lu = Math.hypot(u[0], u[1], u[2]) || 1; u = [u[0] / lu, u[1] / lu, u[2] / lu];
    const v = [e[1] * u[2] - e[2] * u[1], e[2] * u[0] - e[0] * u[2], e[0] * u[1] - e[1] * u[0]];
    const punti = new Float64Array(COPERTA_N * COPERTA_N * 3);
    for (let i = 0; i < COPERTA_N; i++) {
      const a = (i / (COPERTA_N - 1) - 0.5) * lato;
      for (let j = 0; j < COPERTA_N; j++) {
        const b = (j / (COPERTA_N - 1) - 0.5) * lato;
        const o = (i * COPERTA_N + j) * 3;
        for (let k = 0; k < 3; k++) punti[o + k] = centro[k] + u[k] * a + v[k] * b;
      }
    }
    coperta = { partId: part.id, punti };
    disegnaCoperta();
  }
  function disegnaCoperta() {
    if (!coperta) { viewer.nascondiCoperta(); return; }
    // Il raggio dei pallini segue la grandezza DEL TELO, non quella del
    // modello: legandolo al modello, rimpicciolendo la coperta i pallini
    // restavano giganti, si sovrapponevano fra loro e coprivano il telo,
    // rendendo impossibile prenderne uno solo. Ora si misura la distanza
    // media fra maniglie vicine e il pallino resta sempre una frazione di
    // quella: non si toccano mai, a qualsiasi grandezza del telo.
    const N = COPERTA_N, P = coperta.punti;
    let somma = 0, quante = 0;
    const dist = (a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (j + 1 < N) { somma += dist(i * N + j, i * N + j + 1); quante++; }
        if (i + 1 < N) { somma += dist(i * N + j, (i + 1) * N + j); quante++; }
      }
    }
    const passo = quante ? somma / quante : 1;
    const maxDim = computeOverallMaxDimension(currentResult.parts) || 100;
    // un minimo legato al modello, se no su un telo minuscolo i pallini
    // diventerebbero invisibili e impossibili da centrare col mouse
    const raggio = Math.max(passo * 0.20, maxDim * 0.0025);
    viewer.mostraCoperta(coperta.punti, N, raggio);
  }
  function setCopertaAsse(ax) {
    copertaAsse = ax;
    el.copertaAxisX.classList.toggle('active', ax === 'x');
    el.copertaAxisY.classList.toggle('active', ax === 'y');
    el.copertaAxisZ.classList.toggle('active', ax === 'z');
    creaCoperta();
  }
  el.copertaAxisX.addEventListener('click', () => setCopertaAsse('x'));
  el.copertaAxisY.addEventListener('click', () => setCopertaAsse('y'));
  el.copertaAxisZ.addEventListener('click', () => setCopertaAsse('z'));
  el.copertaResetBtn.addEventListener('click', () => creaCoperta());
  el.copertaPosizionaBtn.addEventListener('click', () => {
    copertaPosiziona = !copertaPosiziona;
    el.copertaPosizionaBtn.classList.toggle('active', copertaPosiziona);
    el.copertaPosizionaBtn.textContent = copertaPosiziona
      ? '📍 Clicca sul modello…' : '📍 Metti dove clicco';
  });
  el.copertaPart.addEventListener('change', () => creaCoperta());
  el.copertaScala.addEventListener('input', () => {
    el.copertaScalaValue.textContent = el.copertaScala.value + '%';
    creaCoperta();
  });

  async function tagliaConCoperta() {
    if (!coperta || !currentResult) { alert('Prima scegli il pezzo da tagliare.'); return; }
    const part = currentResult.parts.find((p) => p.id === coperta.partId);
    if (!part) { alert('Il pezzo non c\'e\' piu\': riapri lo strumento Coperta.'); return; }
    const health = await companionHealth();
    if (!health) return;
    if (!health.coperta) {
      alert('Il companion sul PC non conosce ancora la Coperta.\n\nSostituisci la cartella "ai-segmentation" con quella nuova e riavvia "avvia.bat".');
      return;
    }
    const conn = el.connAutoChk ? el.connAutoChk.checked : true;
    const gioco = el.connGioco ? parseInt(el.connGioco.value, 10) / 100 : 0.2;
    pushStoriaParti('taglio con la coperta');
    setLoading(true, 'Taglio con la coperta…');
    await new Promise((r) => setTimeout(r, 20));
    try {
      const body = meshToPayload(part.positions, part.indices);
      body.griglia = Array.from(coperta.punti);
      body.connettore = conn; body.gioco = gioco; body.scala_connettore = scalaConn();
      const resp = await fetch(AI_URL + '/taglia_coperta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const out = await resp.json();
      if (out.error) throw new Error(out.error);
      const idx = currentResult.parts.indexOf(part);
      const mk = (p, suff) => {
        const m = payloadToMesh(p);
        return {
          id: 'part_coperta_' + Date.now() + '_' + suff.replace(/\W/g, ''),
          name: part.name + ' ' + suff,
          color: /perno|sopra|\(A\)/.test(suff) ? coloreNuovo() : part.color.slice(),
          sourceTriangleCount: m.indices.length / 3,
          positions: m.positions, indices: m.indices,
          log: out.log || [], watertight: !!p.watertight,
          stats: MeshCore.computeStats(m.positions, m.indices),
          included: true,
        };
      };
      currentResult.parts.splice(idx, 1, mk(out.b, conn ? '(foro)' : '(sotto)'), mk(out.a, conn ? '(perno)' : '(sopra)'));
      currentResult.parts.sort((a, b) => b.stats.volume - a.stats.volume);
      renderResult(currentResult);
      setCutMode(true); setCutTool('coperta');
      alert('Taglio con la coperta riuscito.' +
        (out.connettore ? `\n\nConnettore: lato ${out.connettore.lato.toFixed(1)} mm, gioco ${out.connettore.gioco.toFixed(2)} mm.` : ''));
    } catch (err) {
      console.error(err);
      alert('Errore nel taglio con la coperta: ' + err.message);
    } finally {
      setLoading(false);
    }
  }
  el.copertaCutBtn.addEventListener('click', () => tagliaConCoperta());

  // accessori per i test
  window.__copertaPunti = () => (coperta ? Array.from(coperta.punti) : null);
  window.__maniglieSotto = (x, y) => viewer.maniglieSotto(x, y);
  window.__copertaIndiceCentro = () => COPERTA_N * COPERTA_N;
  window.__copertaMuovi = (indice, delta) => {
    if (!coperta) return false;
    const o = indice * 3;
    coperta.punti[o] += delta[0]; coperta.punti[o + 1] += delta[1]; coperta.punti[o + 2] += delta[2];
    disegnaCoperta();
    return true;
  };

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
  // Piano manuale con inclinazione LIBERA. L'asse X/Y/Z e' solo la direzione
  // di partenza: "Inclina" la piega di tot gradi e "Gira" sceglie in che
  // verso pende. Le due manopole insieme raggiungono qualsiasi orientamento,
  // come il piano di taglio di uno slicer.
  function planeFromControls(part) {
    const ai = planeAxis === 'x' ? 0 : (planeAxis === 'y' ? 1 : 2);
    const e = [0, 0, 0]; e[ai] = 1;
    // due direzioni perpendicolari all'asse: sono il "piano" in cui inclinare
    const tmp = ai === 2 ? [1, 0, 0] : [0, 0, 1];
    let u = [tmp[1] * e[2] - tmp[2] * e[1], tmp[2] * e[0] - tmp[0] * e[2], tmp[0] * e[1] - tmp[1] * e[0]];
    const lu = Math.hypot(u[0], u[1], u[2]) || 1;
    u = [u[0] / lu, u[1] / lu, u[2] / lu];
    const v = [e[1] * u[2] - e[2] * u[1], e[2] * u[0] - e[0] * u[2], e[0] * u[1] - e[1] * u[0]];

    const incl = (parseInt(el.planeIncl.value, 10) || 0) * Math.PI / 180;
    const gira = (parseInt(el.planeGira.value, 10) || 0) * Math.PI / 180;
    const si = Math.sin(incl), co = Math.cos(incl);
    const cg = Math.cos(gira), sg = Math.sin(gira);
    const normal = [
      si * (cg * u[0] + sg * v[0]) + co * e[0],
      si * (cg * u[1] + sg * v[1]) + co * e[1],
      si * (cg * u[2] + sg * v[2]) + co * e[2],
    ];
    const ln = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    normal[0] /= ln; normal[1] /= ln; normal[2] /= ln;

    // La posizione scorre lungo la NORMALE (non lungo l'asse di partenza),
    // cosi' il cursore "Posizione" copre sempre tutto il pezzo, anche con il
    // piano inclinato: si proietta l'ingombro del pezzo sulla normale.
    const mn = part.stats.bboxMin, mx = part.stats.bboxMax;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 8; i++) {
      const px = (i & 1) ? mx[0] : mn[0];
      const py = (i & 2) ? mx[1] : mn[1];
      const pz = (i & 4) ? mx[2] : mn[2];
      const d = px * normal[0] + py * normal[1] + pz * normal[2];
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    const f = parseInt(el.planePos.value, 10) / 100;
    const at = lo + (hi - lo) * f;
    const c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    const dc = c[0] * normal[0] + c[1] * normal[1] + c[2] * normal[2];
    const point = [
      c[0] + normal[0] * (at - dc),
      c[1] + normal[1] * (at - dc),
      c[2] + normal[2] * (at - dc),
    ];
    return { point, normal, ai };
  }
  function updatePlanePreview() {
    if (cutTool !== 'plane') return;
    const part = planePartObj();
    if (!part) { viewer.hideCutPlane(); return; }
    el.planePosValue.textContent = el.planePos.value + '%';
    el.planeInclValue.textContent = el.planeIncl.value + '°';
    el.planeGiraValue.textContent = el.planeGira.value + '°';
    const { point, normal } = planeFromControls(part);
    const s = part.stats.bboxMax, m = part.stats.bboxMin;
    const size = 1.4 * Math.max(s[0] - m[0], s[1] - m[1], s[2] - m[2], 1);
    viewer.showCutPlane(point, normal, size);
  }
  el.planePart.addEventListener('change', updatePlanePreview);
  el.planePos.addEventListener('input', updatePlanePreview);
  el.planeIncl.addEventListener('input', updatePlanePreview);
  el.planeGira.addEventListener('input', updatePlanePreview);
  el.planeResetBtn.addEventListener('click', () => {
    el.planeIncl.value = 0; el.planeGira.value = 0; updatePlanePreview();
  });
  el.planeAxisX.addEventListener('click', () => setPlaneAxis('x'));
  el.planeAxisY.addEventListener('click', () => setPlaneAxis('y'));
  el.planeAxisZ.addEventListener('click', () => setPlaneAxis('z'));
  el.planeCutBtn.addEventListener('click', () => {
    const part = planePartObj();
    if (!part) return;
    const { point, normal } = planeFromControls(part);
    pushStoriaParti('taglio dritto');
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
          color: /perno|sopra|\(A\)/.test(suff) ? coloreNuovo() : part.color.slice(),
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
  el.cutToolCopertaBtn.addEventListener('click', () => setCutTool('coperta'));
  if (el.undoPartiBtn) el.undoPartiBtn.addEventListener('click', () => annullaOperazioneParti());
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

  // ------------------- SELEZIONE INTELLIGENTE: UN CLIC = TUTTA LA ZONA -------
  // Dal punto toccato la selezione si allarga sulla superficie e si FERMA da
  // sola sulle pieghe: il bordo della scarpa, l'attaccatura del braccio, il
  // contorno di un occhio. A differenza dell'AI questo e' deterministico e lo
  // guidi tu: se prende troppo o troppo poco, sposti un cursore.
  //
  // Le normali vengono prima ammorbidite sui vicini, perche' le mesh generate
  // dall'AI sono increspate e ogni increspatura sembrerebbe una piega
  // (misurato altrove: angoli falsi fino a 78 gradi su superfici lisce).
  function ensureSmoothNormals(part) {
    const topo = ensurePartTopology(part);
    if (topo.smoothNormals) return topo.smoothNormals;
    const n = topo.normals;
    const nTris = n.length / 3;
    let cur = Float32Array.from(n);
    for (let pass = 0; pass < 3; pass++) {
      const out = new Float32Array(nTris * 3);
      for (let f = 0; f < nTris; f++) {
        let x = cur[f * 3], y = cur[f * 3 + 1], z = cur[f * 3 + 2];
        const adj = topo.adjacency[f];
        for (let i = 0; i < adj.length; i++) {
          const a = adj[i];
          x += cur[a * 3]; y += cur[a * 3 + 1]; z += cur[a * 3 + 2];
        }
        const l = Math.sqrt(x * x + y * y + z * z) || 1;
        out[f * 3] = x / l; out[f * 3 + 1] = y / l; out[f * 3 + 2] = z / l;
      }
      cur = out;
    }
    topo.smoothNormals = cur;
    return cur;
  }

  // Cresce dal triangolo toccato pagando un COSTO a ogni passo, e si ferma
  // quando ha speso il budget.
  //
  // Perche' non basta una soglia secca sull'angolo: sui modelli generati
  // dall'AI non ci sono spigoli. Fra la scarpa e la gamba non c'e' uno
  // scalino, c'e' una VALLE dolce. Misurato su un modello di prova: angolo
  // mediano fra le facce 6.4 gradi ovunque, e la caviglia si distingue dalla
  // gamba liscia solo per 3.4 contro 1.9 gradi. Con una soglia la selezione
  // dilagava su tutto il modello.
  //
  // Qui invece attraversare una piega CONCAVA costa: le valli sono i confini
  // naturali fra le parti, mentre i rigonfiamenti convessi (un muscolo, una
  // piega del vestito) sono gratis e non spezzano nulla. Si somma il costo
  // lungo il cammino: una valle poco profonda si supera, una marcata no.
  // Il cursore regola quanto si e' disposti a spendere.
  // Quanto e' "in valle" ogni triangolo: media delle pieghe CONCAVE verso i
  // vicini, poi ammorbidita. Le valli (caviglia, attaccatura del braccio,
  // contorno di un occhio) formano bande continue di valore alto; le
  // increspature del rumore, sparse e isolate, si spengono.
  function ensureConcavita(part) {
    const topo = ensurePartTopology(part);
    if (topo.concavita) return topo.concavita;
    const N = ensureSmoothNormals(part);
    const C = topo.centroids;
    const nTris = part.indices.length / 3;
    let campo = new Float32Array(nTris);
    for (let f = 0; f < nTris; f++) {
      const adj = topo.adjacency[f];
      let somma = 0;
      for (let i = 0; i < adj.length; i++) {
        const nb = adj[i];
        const d = Math.min(1, Math.max(-1,
          N[f * 3] * N[nb * 3] + N[f * 3 + 1] * N[nb * 3 + 1] + N[f * 3 + 2] * N[nb * 3 + 2]));
        const vx = C[nb * 3] - C[f * 3], vy = C[nb * 3 + 1] - C[f * 3 + 1], vz = C[nb * 3 + 2] - C[f * 3 + 2];
        const concavo = (vx * N[f * 3] + vy * N[f * 3 + 1] + vz * N[f * 3 + 2]) > 0;
        if (concavo) somma += Math.acos(d) * 180 / Math.PI;
      }
      campo[f] = adj.length ? somma / adj.length : 0;
    }
    // ammorbidisci: le valli restano, i puntini di rumore spariscono
    for (let pass = 0; pass < 3; pass++) {
      const out = new Float32Array(nTris);
      for (let f = 0; f < nTris; f++) {
        const adj = topo.adjacency[f];
        let s = campo[f], n = 1;
        for (let i = 0; i < adj.length; i++) { s += campo[adj[i]]; n++; }
        out[f] = s / n;
      }
      campo = out;
    }
    topo.concavita = campo;
    return campo;
  }

  // Cresce dal triangolo toccato fermandosi sulle VALLI.
  //
  // Sui modelli generati dall'AI non ci sono spigoli: fra la scarpa e la gamba
  // non c'e' uno scalino ma una valle dolce. Misurato su un modello di prova:
  // angolo mediano fra le facce 6.4 gradi ovunque, e la caviglia si distingue
  // dalla gamba liscia solo per 3.4 contro 1.9 gradi.
  //
  // Non si sommano i costi lungo il cammino (allargarsi sulla scarpa costerebbe
  // quanto scavalcare la caviglia): conta solo la VALLE PIU' PROFONDA che si e'
  // dovuta attraversare per arrivare a un triangolo. Cosi' ci si allarga
  // liberamente sulla superficie della scarpa, e ci si ferma dove il terreno
  // sale davvero. Il cursore dice quanto in alto si e' disposti a salire.
  function smartSelect(part, seedFace, estensione, maxFrazione) {
    const topo = ensurePartTopology(part);
    const conc = ensureConcavita(part);
    const C = topo.centroids;
    const nTris = part.indices.length / 3;
    const maxFacce = Math.max(20, Math.floor(nTris * (maxFrazione || 0.85)));

    // La soglia si tara sul MODELLO, non su un numero fisso: si prende la
    // profondita' di valle tipica della superficie (la mediana) e il cursore
    // dice quante volte tanto si e' disposti a superare. Cosi' funziona
    // uguale su mesh fitte o rade, grandi o piccole.
    // Misurato sul modello di prova: superficie liscia 0.55-0.75, caviglia
    // 1.38 — cioe' il doppio. Con il cursore intorno a 20 la soglia cade in
    // mezzo e la selezione si ferma alla caviglia.
    const campione = [];
    for (let t = 0; t < nTris; t += Math.max(1, Math.floor(nTris / 4000))) campione.push(conc[t]);
    campione.sort((a, b) => a - b);
    const tipica = campione.length ? campione[Math.floor(campione.length / 2)] : 0.5;
    const soglia = Math.max(1e-4, tipica * (0.6 + estensione / 22));

    // RAGGIO MORBIDO dal punto cliccato, in millimetri reali (relativo alla
    // dimensione del PEZZO). Misurato su un modello reale (Meshy): su una
    // zona liscia senza pieghe nette vicino al punto toccato, la sola soglia
    // di valle sopra NON basta a fermare la crescita — anche a Estensione
    // minima la selezione arrivava a mezzo metro di altezza, perche' non
    // c'e' nessuna valle abbastanza profonda da incontrare.
    // Non e' un muro rigido (romperebbe casi legittimi come "prendi tutta
    // la scarpa", che e' grande rispetto alla gamba ma e' UNA zona sola):
    // oltre il raggio si somma un costo che cresce col quadrato della
    // distanza in eccesso. Vicino al raggio non cambia quasi nulla (la
    // scarpa la si prende comunque, la valle della caviglia la ferma
    // comunque), ma su un terreno piatto senza valli il costo aggiuntivo
    // supera la soglia da solo, anche se non c'e' nessuna vera piega.
    // Il pezzo puo' essere gia' isolato e piccolo (es. la sola scarpa, dopo
    // che la segmentazione automatica l'ha gia' separata dalla gamba — li'
    // "tutto il pezzo" e' la zona giusta e non conviene limitarlo), oppure
    // enorme perche' la segmentazione non e' riuscita a separare nulla (es.
    // busto+braccia+testa tutti insieme) — li' serve invece un raggio
    // stretto. Si confronta la dimensione del PEZZO con quella di TUTTO IL
    // MODELLO per capire in quale dei due casi si e': un pezzo che da solo
    // e' gia' una piccola frazione del modello e' probabilmente una zona
    // isolata (si lascia crescere quasi libero); un pezzo grande quanto il
    // modello stesso e' probabilmente un blocco composito non separato (si
    // stringe il raggio).
    const bb0 = part.stats && part.stats.bboxMin, bb1 = part.stats && part.stats.bboxMax;
    const maxDimParte = bb0 && bb1
      ? Math.max(bb1[0] - bb0[0], bb1[1] - bb0[1], bb1[2] - bb0[2], 1e-6)
      : Infinity;
    const maxDimModello = currentResult && currentResult.parts && currentResult.parts.length
      ? computeOverallMaxDimension(currentResult.parts)
      : maxDimParte;
    const fracParteModello = maxDimParte / (maxDimModello || 1e-6);
    let raggioMorbido = fracParteModello < 0.4
      ? maxDimParte * 1.3                          // pezzo gia' una zona isolata piccola: quasi libero
      : maxDimParte * (0.07 + estensione / 300);   // pezzo grande/composito: raggio stretto
    // PAVIMENTO legato alla risoluzione della mesh: su una mesh rada (poche
    // facce grandi, tipico di un modello di prova o di un pezzo poco
    // dettagliato) il raggio calcolato sopra puo' finire piu' piccolo di un
    // singolo triangolo — la selezione sparirebbe del tutto. Si assicura
    // sempre spazio per un po' di triangoli vicini al punto cliccato,
    // misurando la distanza media dai vicini diretti del seme.
    const adjSeed = topo.adjacency[seedFace];
    if (adjSeed && adjSeed.length) {
      let sommaDist = 0;
      for (let i = 0; i < adjSeed.length; i++) {
        const nb = adjSeed[i];
        sommaDist += Math.hypot(C[nb * 3] - C[seedFace * 3], C[nb * 3 + 1] - C[seedFace * 3 + 1], C[nb * 3 + 2] - C[seedFace * 3 + 2]);
      }
      const distMediaVicini = sommaDist / adjSeed.length;
      raggioMorbido = Math.max(raggioMorbido, distMediaVicini * 8);
    }
    const sx = C[seedFace * 3], sy = C[seedFace * 3 + 1], sz = C[seedFace * 3 + 2];

    const arrivo = new Float64Array(nTris).fill(Infinity);
    arrivo[seedFace] = conc[seedFace];
    const coda = [[arrivo[seedFace], seedFace]];
    const sel = new Set();
    while (coda.length && sel.size < maxFacce) {
      let bi = 0;
      for (let i = 1; i < coda.length; i++) if (coda[i][0] < coda[bi][0]) bi = i;
      const [c, f] = coda.splice(bi, 1)[0];
      if (c > arrivo[f]) continue;
      if (c > soglia) break;              // oltre questa valle non si passa
      const dx = C[f * 3] - sx, dy = C[f * 3 + 1] - sy, dz = C[f * 3 + 2] - sz;
      const distanza = Math.hypot(dx, dy, dz);
      const extra = distanza > raggioMorbido ? soglia * Math.pow(distanza / raggioMorbido - 1, 2) : 0;
      if (c + extra > soglia) continue;   // troppo lontano E senza una valle vera che lo giustifichi
      sel.add(f);
      const adj = topo.adjacency[f];
      for (let i = 0; i < adj.length; i++) {
        const nb = adj[i];
        const q = Math.max(c, conc[nb]);  // la valle piu' profonda del cammino
        if (q < arrivo[nb]) { arrivo[nb] = q; coda.push([q, nb]); }
      }
    }
    return sel;
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
  // Un CLIC (senza trascinare) seleziona tutta la zona fermandosi sulle pieghe;
  // TRASCINANDO invece si dipinge a mano come prima. Si distinguono guardando
  // se il puntatore si e' spostato piu' di qualche pixel.
  let attesaClic = null;
  viewer.setPointerDownHook((x, y) => {
    // COPERTA: se il cursore e' su una maniglia, la si prende e si trascina.
    // Se e' altrove, si lascia ruotare la vista come sempre.
    if (cutMode && cutTool === 'coperta' && coperta) {
      const k = viewer.maniglieSotto(x, y);
      if (k === COPERTA_N * COPERTA_N) {
        // pallino blu al centro: si trascina TUTTO il telo insieme
        let cx = 0, cy = 0, cz = 0;
        const n = COPERTA_N * COPERTA_N;
        for (let i = 0; i < n; i++) { cx += coperta.punti[i * 3]; cy += coperta.punti[i * 3 + 1]; cz += coperta.punti[i * 3 + 2]; }
        copertaTrascina = {
          indice: -1, partenza: [cx / n, cy / n, cz / n],
          tutti: Float64Array.from(coperta.punti),
        };
        return true;
      }
      if (k >= 0) {
        copertaTrascina = { indice: k, partenza: [
          coperta.punti[k * 3], coperta.punti[k * 3 + 1], coperta.punti[k * 3 + 2]] };
        return true;
      }
      // "metti il telo dove clicco": un clic sul modello lo porta li'
      if (copertaPosiziona) {
        const hit = viewer.raycastAt(x, y);
        if (hit) {
          spostaCopertaSu(hit.point);
          copertaPosiziona = false;
          el.copertaPosizionaBtn.classList.remove('active');
          el.copertaPosizionaBtn.textContent = '📍 Metti dove clicco';
          return true;
        }
      }
      return false;
    }
    if (!cutMode || cutTool !== 'wand') return false; // dipinge solo il pennello
    const hit = viewer.raycastAt(x, y);
    if (!hit) return false; // tocco fuori dal modello: lascia ruotare la vista
    paintPartId = hit.partId;
    if (el.smartSelChk && el.smartSelChk.checked) {
      // aspetta: potrebbe essere un clic (zona intera) o un trascinamento (pennello)
      attesaClic = { x, y, hit };
      painting = false;
    } else {
      pushCutHistory();
      painting = true;
      paintAt(hit);
    }
    return true; // pointer "preso": niente rotazione mentre si lavora
  });
  el.viewer.addEventListener('pointermove', (e) => {
    if (copertaTrascina && coperta) {
      // il punto segue il cursore su un piano che guarda la camera: cosi' si
      // sposta davvero in 3D, nella direzione in cui si sta guardando
      const p = viewer.puntoSulPianoVista(e.clientX, e.clientY, copertaTrascina.partenza);
      if (p) {
        if (copertaTrascina.indice < 0) {
          // maniglia centrale: sposta tutto il telo, senza deformarlo
          const dx = p[0] - copertaTrascina.partenza[0];
          const dy = p[1] - copertaTrascina.partenza[1];
          const dz = p[2] - copertaTrascina.partenza[2];
          const base = copertaTrascina.tutti;
          for (let i = 0; i < coperta.punti.length; i += 3) {
            coperta.punti[i] = base[i] + dx;
            coperta.punti[i + 1] = base[i + 1] + dy;
            coperta.punti[i + 2] = base[i + 2] + dz;
          }
        } else {
          const o = copertaTrascina.indice * 3;
          coperta.punti[o] = p[0]; coperta.punti[o + 1] = p[1]; coperta.punti[o + 2] = p[2];
        }
        disegnaCoperta();
      }
      return;
    }
    if (attesaClic) {
      const d = Math.hypot(e.clientX - attesaClic.x, e.clientY - attesaClic.y);
      if (d > 5) {                       // si sta trascinando: passa al pennello
        pushCutHistory();
        painting = true;
        paintAt(attesaClic.hit);
        attesaClic = null;
      } else {
        return;
      }
    }
    if (!painting) return;
    const hit = viewer.raycastAt(e.clientX, e.clientY);
    if (hit && hit.partId === paintPartId) paintAt(hit);
  });
  function chiudiTratto() {
    // fine del tratto a pennello: ripulisci i triangolini sfuggiti
    if (painting && cutSelection && currentResult) {
      const part = currentResult.parts.find((p) => p.id === cutSelection.partId);
      if (part && cutSelection.faces.size > 8) {
        pulisciSelezione(part, cutSelection.faces);
        refreshCutHighlight();
      }
    }
    if (copertaTrascina) { copertaTrascina = null; return; }
    if (attesaClic) {
      // era un clic secco: prendi tutta la zona
      applicaSelezioneIntelligente(attesaClic.hit);
      attesaClic = null;
    }
    painting = false;
  }
  window.addEventListener('pointerup', chiudiTratto);
  window.addEventListener('pointercancel', chiudiTratto);

  // Ripulisce una selezione dai buchi: i triangolini rimasti fuori in mezzo
  // alla zona scelta vengono inglobati, e i frammenti isolati fuori vengono
  // scartati. Sono quelli che lasciavano il bordo del taglio frastagliato.
  function pulisciSelezione(part, sel) {
    const topo = ensurePartTopology(part);
    const nTris = part.indices.length / 3;
    // 1) buchi DENTRO la selezione: un triangolo fuori, circondato da dentro
    for (let giro = 0; giro < 3; giro++) {
      const daAggiungere = [];
      for (let f = 0; f < nTris; f++) {
        if (sel.has(f)) continue;
        const adj = topo.adjacency[f];
        if (adj.length === 0) continue;
        let dentro = 0;
        for (let i = 0; i < adj.length; i++) if (sel.has(adj[i])) dentro++;
        if (dentro >= adj.length - 0.5) daAggiungere.push(f);  // tutti i vicini dentro
      }
      if (daAggiungere.length === 0) break;
      for (const f of daAggiungere) sel.add(f);
    }
    // 2) sporgenze: triangoli dentro ma con un solo vicino dentro (peli isolati)
    for (let giro = 0; giro < 2; giro++) {
      const daTogliere = [];
      sel.forEach((f) => {
        const adj = topo.adjacency[f];
        if (adj.length < 3) return;
        let dentro = 0;
        for (let i = 0; i < adj.length; i++) if (sel.has(adj[i])) dentro++;
        if (dentro <= 1) daTogliere.push(f);
      });
      if (daTogliere.length === 0) break;
      for (const f of daTogliere) sel.delete(f);
    }
    // 3) frammenti staccati: tiene solo il gruppo piu' grande
    const visti = new Set();
    let migliore = null;
    sel.forEach((s) => {
      if (visti.has(s)) return;
      const gruppo = [s]; const pila = [s]; visti.add(s);
      while (pila.length) {
        const f = pila.pop();
        const adj = topo.adjacency[f];
        for (let i = 0; i < adj.length; i++) {
          const nb = adj[i];
          if (sel.has(nb) && !visti.has(nb)) { visti.add(nb); pila.push(nb); gruppo.push(nb); }
        }
      }
      if (!migliore || gruppo.length > migliore.length) migliore = gruppo;
    });
    if (migliore && migliore.length < sel.size) {
      const tenuti = new Set(migliore);
      sel.forEach((f) => { if (!tenuti.has(f)) sel.delete(f); });
    }
    return sel;
  }

  function applicaSelezioneIntelligente(hit) {
    const part = currentResult && currentResult.parts.find((p) => p.id === hit.partId);
    if (!part) return;
    pushCutHistory();
    const gradi = parseInt(el.smartSelAngle.value, 10) || 22;
    const zona = pulisciSelezione(part, smartSelect(part, hit.faceIndex, gradi, 0.85));
    if (!cutSelection || cutSelection.partId !== part.id) {
      cutSelection = { partId: part.id, faces: new Set() };
    }
    if (cutErase) zona.forEach((f) => cutSelection.faces.delete(f));
    else zona.forEach((f) => cutSelection.faces.add(f));
    refreshCutHighlight();
  }

  // Appiattisce il BORDO del taglio sul suo piano medio: i vertici condivisi
  // tra la parte ritagliata e il resto vengono proiettati su un piano, cosi' la
  // superficie di taglio diventa liscia e i due pezzi combaciano (incastro).
  function flattenCutBoundary(part, selectedSet) {
    const pos = part.positions;
    const idx = part.indices;
    const em = MeshCore.buildEdgeMap(idx);
    const bverts = new Set();
    em.forEach((occ) => {
      if (occ.length !== 2) return;
      const s1 = selectedSet.has(occ[0].face);
      const s2 = selectedSet.has(occ[1].face);
      if (s1 !== s2) { bverts.add(occ[0].a); bverts.add(occ[0].b); }
    });
    if (bverts.size < 3) return;
    // normale del piano: media (pesata per area) delle normali delle facce
    // selezionate al bordo -> ~ normale della superficie in quel punto
    let nx = 0, ny = 0, nz = 0;
    em.forEach((occ) => {
      if (occ.length !== 2) return;
      const s1 = selectedSet.has(occ[0].face), s2 = selectedSet.has(occ[1].face);
      if (s1 === s2) return;
      const f = s1 ? occ[0].face : occ[1].face;
      const a = idx[f * 3], b = idx[f * 3 + 1], c = idx[f * 3 + 2];
      const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
      const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
      nx += uy * vz - uz * vy; ny += uz * vx - ux * vz; nz += ux * vy - uy * vx;
    });
    let nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (nl < 1e-12) return;
    nx /= nl; ny /= nl; nz /= nl;
    // punto del piano = baricentro dei vertici di bordo
    let cx = 0, cy = 0, cz = 0;
    bverts.forEach((v) => { cx += pos[v * 3]; cy += pos[v * 3 + 1]; cz += pos[v * 3 + 2]; });
    const n = bverts.size; cx /= n; cy /= n; cz /= n;
    // proietta ogni vertice di bordo sul piano
    bverts.forEach((v) => {
      const d = (pos[v * 3] - cx) * nx + (pos[v * 3 + 1] - cy) * ny + (pos[v * 3 + 2] - cz) * nz;
      pos[v * 3] -= d * nx; pos[v * 3 + 1] -= d * ny; pos[v * 3 + 2] -= d * nz;
    });
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

        // faccia di taglio PIATTA: appiattisce i vertici del bordo di taglio sul
        // loro piano medio (modifica condivisa da entrambi i pezzi), cosi' la base
        // del ritaglio e l'incavo rimasto sono lisci e combaciano per l'incastro
        if (el.flatCutChk && el.flatCutChk.checked) {
          flattenCutBoundary(part, selectedSet);
        }

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
        if (hit) applyConnectorAt(hit.partId, hit.point, hit.faceIndex);
      } else {
        handleCutTap(e.clientX, e.clientY);
      }
    }
  });

  // accessi di sola lettura usati dai test automatici (nessun effetto sull'app)
  window.__viewerCam = () => viewer.getCameraPosition();
  window.__viewerScene = () => viewer.scene;
  window.__viewerTarget = () => viewer.getTarget();
  window.__parsedInfo = () => currentParsed ? {
    hasColorInfo: currentParsed.hasColorInfo,
    hasTextureInfo: currentParsed.hasTextureInfo,
    hasMaterialInfo: currentParsed.hasMaterialInfo,
    materialCount: currentParsed.materialCount,
    textureApplied: !!currentParsed.textureApplied,
    textureError: currentParsed.textureError || null,
  } : null;
  window.__repairedInfo = () => currentRepaired ? {
    tris: currentRepaired.indices.length / 3,
    watertight: !!currentRepaired.watertight,
    volume: currentRepaired.stats ? currentRepaired.stats.volume : null,
  } : null;
  window.__partsVolumes = () => currentResult ? currentResult.parts.map((p) => p.stats.volume) : null;
  window.__selezioneZ = () => {
    if (!cutSelection || !currentResult) return null;
    const part = currentResult.parts.find((p) => p.id === cutSelection.partId);
    if (!part) return null;
    let zmin = Infinity, zmax = -Infinity;
    cutSelection.faces.forEach((f) => {
      for (let k = 0; k < 3; k++) {
        const v = part.indices[f * 3 + k];
        const z = part.positions[v * 3 + 2];
        if (z < zmin) zmin = z; if (z > zmax) zmax = z;
      }
    });
    return { zmin, zmax, modelZmin: part.stats.bboxMin[2], modelZmax: part.stats.bboxMax[2] };
  };
  window.__raycast = (x, y) => { const h = viewer.raycastAt(x, y); return h ? { partId: h.partId, faceIndex: h.faceIndex, z: h.point[2] } : null; };
  window.__resetSel = () => { cutSelection = null; refreshCutHighlight(); };
  window.__applicaSelTest = (zSeed, estensione) => {
    if (!currentResult) return 0;
    let part = currentResult.parts[0];
    for (const p of currentResult.parts) {
      if (zSeed >= p.stats.bboxMin[2] && zSeed <= p.stats.bboxMax[2]) { part = p; break; }
    }
    const nT = part.indices.length / 3;
    let best = 0, bestD = Infinity;
    for (let t = 0; t < nT; t++) {
      let z = 0;
      for (let k = 0; k < 3; k++) z += part.positions[part.indices[t * 3 + k] * 3 + 2];
      z /= 3;
      const d = Math.abs(z - zSeed);
      if (d < bestD) { bestD = d; best = t; }
    }
    const zona = pulisciSelezione(part, smartSelect(part, best, estensione, 0.85));
    cutSelection = { partId: part.id, faces: zona };
    refreshCutHighlight();
    return zona.size;
  };
  // quanto e' piatta la faccia di taglio: scarto massimo fra le facce complanari
  // Misura la faccia di taglio: il piu' grande gruppo di facce COMPLANARI E
  // ATTACCATE fra loro. Richiedere che siano attaccate e' essenziale: su una
  // superficie curva ci sono tante facce parallele fra loro ma in punti
  // lontanissimi, e senza questo vincolo la misura risultava falsata.
  window.__smartTest = (zSeed, estensione) => {
    if (!currentResult) return null;
    let part = currentResult.parts[0];
    for (const p of currentResult.parts) {
      if (zSeed >= p.stats.bboxMin[2] && zSeed <= p.stats.bboxMax[2]) { part = p; break; }
    }
    const nT = part.indices.length / 3;
    let best = 0, bestD = Infinity;
    for (let t = 0; t < nT; t++) {
      let z = 0;
      for (let k = 0; k < 3; k++) z += part.positions[part.indices[t * 3 + k] * 3 + 2];
      z /= 3;
      const d = Math.abs(z - zSeed);
      if (d < bestD) { bestD = d; best = t; }
    }
    const sel = pulisciSelezione(part, smartSelect(part, best, estensione, 0.85));
    let zmin = Infinity, zmax = -Infinity;
    sel.forEach((f) => {
      for (let k = 0; k < 3; k++) {
        const z = part.positions[part.indices[f * 3 + k] * 3 + 2];
        if (z < zmin) zmin = z; if (z > zmax) zmax = z;
      }
    });
    return { count: sel.size, totale: nT, zmin, zmax, modelZmax: part.stats.bboxMax[2] };
  };
  window.__planarita = (filtro) => {
    if (!currentResult) return null;
    const scelte = filtro
      ? currentResult.parts.filter((p) => new RegExp(filtro).test(p.name))
      : currentResult.parts.slice(0, 3);
    return scelte.map((part) => {
      const topo = ensurePartTopology(part);
      const N = topo.normals, C = topo.centroids;
      const nT = part.indices.length / 3;
      const visti = new Uint8Array(nT);
      let migliore = null;
      for (let s0 = 0; s0 < nT; s0++) {
        if (visti[s0]) continue;
        const nx = N[s0 * 3], ny = N[s0 * 3 + 1], nz = N[s0 * 3 + 2];
        const gruppo = [s0]; const pila = [s0]; visti[s0] = 1;
        while (pila.length) {
          const f = pila.pop();
          const adj = topo.adjacency[f];
          for (let i = 0; i < adj.length; i++) {
            const nb = adj[i];
            if (visti[nb]) continue;
            const d = N[nb * 3] * nx + N[nb * 3 + 1] * ny + N[nb * 3 + 2] * nz;
            if (d < 0.9995) continue;
            visti[nb] = 1; pila.push(nb); gruppo.push(nb);
          }
        }
        if (!migliore || gruppo.length > migliore.g.length) migliore = { g: gruppo, n: [nx, ny, nz] };
      }
      if (!migliore) return null;
      const [nx, ny, nz] = migliore.n;
      let mn = Infinity, mx = -Infinity;
      for (const f of migliore.g) {
        const q = C[f * 3] * nx + C[f * 3 + 1] * ny + C[f * 3 + 2] * nz;
        if (q < mn) mn = q; if (q > mx) mx = q;
      }
      return { nome: part.name, facceComplanari: migliore.g.length,
               scartoMax: +(mx - mn).toFixed(4) };
    });
  };
  window.__lassoCount = () => lassoPoints.length;
  window.__partsInfo = () => currentResult ? currentResult.parts.map((p) => ({ name: p.name, tris: p.indices.length / 3, wt: !!p.watertight, log: p.log })) : null;
  window.__partsBBox = () => currentResult ? currentResult.parts.map((p) => ({ name: p.name, bboxMin: p.stats.bboxMin, bboxMax: p.stats.bboxMax, vol: p.stats.volume })) : null;
  window.__sceneInfo = () => {
    const out = [];
    viewer.scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        out.push({ id: o.userData.partId || o.uuid.slice(0,6), visible: o.visible,
          pos: [o.position.x, o.position.y, o.position.z],
          bbMin: [bb.min.x, bb.min.y, bb.min.z], bbMax: [bb.max.x, bb.max.y, bb.max.z] });
      }
    });
    return out;
  };
  // seleziona i triangoli il cui baricentro cade in una scatola: serve ai
  // test per isolare il calcolo del PIANO dalla selezione automatica
  window.__selBox = (min, max) => {
    if (!currentResult) return 0;
    let scelta = null, meglio = -1;
    for (const p of currentResult.parts) {
      const nT = p.indices.length / 3;
      const dentro = new Set();
      for (let f = 0; f < nT; f++) {
        let bx = 0, by = 0, bz = 0;
        for (let k = 0; k < 3; k++) {
          const v = p.indices[f * 3 + k];
          bx += p.positions[v * 3]; by += p.positions[v * 3 + 1]; bz += p.positions[v * 3 + 2];
        }
        bx /= 3; by /= 3; bz /= 3;
        if (bx >= min[0] && bx <= max[0] && by >= min[1] && by <= max[1] && bz >= min[2] && bz <= max[2]) dentro.add(f);
      }
      if (dentro.size > meglio) { meglio = dentro.size; scelta = { partId: p.id, faces: dentro }; }
    }
    if (!scelta || scelta.faces.size === 0) return 0;
    cutSelection = scelta;
    refreshCutHighlight();
    return scelta.faces.size;
  };
  window.__pianoTest = () => {
    if (!cutSelection || !currentResult) return null;
    const part = currentResult.parts.find((p) => p.id === cutSelection.partId);
    if (!part) return null;
    const piano = pianoDelBordo(part, cutSelection.faces);
    if (!piano) return null;
    // per confronto nei test: la vecchia normale "centro selezione meno
    // centro del resto", quella che faceva uscire il taglio in diagonale
    const sel = cutSelection.faces;
    const nTri = part.indices.length / 3;
    let sx = 0, sy = 0, sz = 0, ns = 0, rx = 0, ry = 0, rz = 0, nr = 0;
    for (let f = 0; f < nTri; f++) {
      for (let k = 0; k < 3; k++) {
        const v = part.indices[f * 3 + k];
        const px = part.positions[v * 3], py = part.positions[v * 3 + 1], pz = part.positions[v * 3 + 2];
        if (sel.has(f)) { sx += px; sy += py; sz += pz; ns++; } else { rx += px; ry += py; rz += pz; nr++; }
      }
    }
    if (ns && nr) {
      const dx = sx / ns - rx / nr, dy = sy / ns - ry / nr, dz = sz / ns - rz / nr;
      const L = Math.hypot(dx, dy, dz) || 1;
      piano.normaleVecchia = [dx / L, dy / L, dz / L];
    }
    return piano;
  };
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
    const bboxMin = [Infinity, Infinity, Infinity], bboxMax = [-Infinity, -Infinity, -Infinity];
    sel.forEach((f) => {
      for (let k = 0; k < 3; k++) {
        const v = part.indices[f * 3 + k];
        for (let a = 0; a < 3; a++) {
          const c = part.positions[v * 3 + a];
          if (c < bboxMin[a]) bboxMin[a] = c;
          if (c > bboxMax[a]) bboxMax[a] = c;
        }
      }
    });
    return { count: sel.size, components: comps, bboxMin, bboxMax };
  };
})();
