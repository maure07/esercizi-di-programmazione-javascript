/*
 * segmentation.js
 * Orchestrazione: dai dati grezzi del parser (triangle soup + colore/materiale
 * per triangolo) costruisce le "parti" stampabili separate, ciascuna
 * riparata/chiusa singolarmente con geometry-core.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./geometry-core.js'));
  } else {
    root.Segmentation = factory(root.MeshCore);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (MeshCore) {
  'use strict';
  const Segmentation = {};

  // Palette di riserva per le parti senza informazioni di colore (fallback a isole)
  const FALLBACK_PALETTE = [
    [0.90, 0.30, 0.24], [0.20, 0.55, 0.85], [0.95, 0.75, 0.15], [0.35, 0.75, 0.35],
    [0.65, 0.35, 0.85], [0.95, 0.55, 0.20], [0.25, 0.80, 0.75], [0.85, 0.35, 0.60],
  ];

  function colorDistance2(a, b) {
    // distanza al quadrato (evita sqrt nel ciclo interno, non serve per i confronti)
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
  }

  // k-means su colori RGB (0..1): raggruppa i triangoli in ESATTAMENTE k
  // colori dominanti. A differenza di un clustering a soglia, il numero di
  // gruppi risultanti e' sempre limitato e prevedibile anche su texture
  // fotografiche rumorose (sfumature, compressione, dettagli), dove un
  // clustering "a soglia" genererebbe centinaia di micro-cluster spuri.
  // Inizializzazione deterministica "farthest-point" (variante di k-means++
  // senza casualita'): stessi colori in ingresso -> stesso risultato.
  Segmentation.kMeansColorClusters = function (rawColors, nTris, k, options) {
    options = options || {};
    const maxIterations = options.maxIterations || 15;
    k = Math.max(1, Math.min(k, nTris));

    // --- inizializzazione: primo centroide fisso, poi scegli sempre il
    // punto piu' lontano da tutti i centroidi gia' scelti ---
    const centroids = [[rawColors[0], rawColors[1], rawColors[2]]];
    const minDistToCentroid = new Float64Array(nTris).fill(Infinity);
    for (let pick = 1; pick < k; pick++) {
      const lastC = centroids[centroids.length - 1];
      let farthestIdx = -1, farthestDist = -1;
      for (let t = 0; t < nTris; t++) {
        const c = [rawColors[t * 3], rawColors[t * 3 + 1], rawColors[t * 3 + 2]];
        const d = colorDistance2(c, lastC);
        if (d < minDistToCentroid[t]) minDistToCentroid[t] = d;
        if (minDistToCentroid[t] > farthestDist) { farthestDist = minDistToCentroid[t]; farthestIdx = t; }
      }
      if (farthestIdx === -1 || farthestDist <= 0) break; // meno colori distinti di k, ok cosi'
      centroids.push([rawColors[farthestIdx * 3], rawColors[farthestIdx * 3 + 1], rawColors[farthestIdx * 3 + 2]]);
    }

    const kActual = centroids.length;
    const labelIds = new Int32Array(nTris);

    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = false;
      // assegnazione
      for (let t = 0; t < nTris; t++) {
        const c = [rawColors[t * 3], rawColors[t * 3 + 1], rawColors[t * 3 + 2]];
        let best = 0, bestDist = Infinity;
        for (let ci = 0; ci < kActual; ci++) {
          const d = colorDistance2(c, centroids[ci]);
          if (d < bestDist) { bestDist = d; best = ci; }
        }
        if (labelIds[t] !== best) { labelIds[t] = best; changed = true; }
      }
      // ricalcolo centroidi come media dei punti assegnati
      const sums = Array.from({ length: kActual }, () => [0, 0, 0, 0]); // r,g,b,n
      for (let t = 0; t < nTris; t++) {
        const s = sums[labelIds[t]];
        s[0] += rawColors[t * 3]; s[1] += rawColors[t * 3 + 1]; s[2] += rawColors[t * 3 + 2]; s[3]++;
      }
      for (let ci = 0; ci < kActual; ci++) {
        const s = sums[ci];
        if (s[3] > 0) centroids[ci] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
        // cluster vuoto: lascia il centroide invariato (potra' riprendere punti al giro dopo)
      }
      if (!changed) break;
    }

    // rinumera scartando eventuali cluster rimasti vuoti, cosi' l'elenco
    // finale delle parti non contiene voci fantasma a 0 triangoli
    const counts = new Array(kActual).fill(0);
    for (let t = 0; t < nTris; t++) counts[labelIds[t]]++;
    const remap = new Array(kActual).fill(-1);
    const finalClusters = [];
    for (let ci = 0; ci < kActual; ci++) {
      if (counts[ci] === 0) continue;
      remap[ci] = finalClusters.length;
      finalClusters.push({ color: centroids[ci], count: counts[ci] });
    }
    for (let t = 0; t < nTris; t++) labelIds[t] = remap[labelIds[t]];

    return { labelIds, clusters: finalClusters };
  };

  // ---------------------------------------------------------------------
  // Determina l'etichetta (parte) di ogni triangolo a partire dai dati grezzi.
  // ---------------------------------------------------------------------
  Segmentation.buildTriangleLabels = function (parsed, options) {
    options = options || {};
    const nTris = parsed.rawPositions.length / 9;

    if (parsed.hasMaterialInfo && parsed.rawGroupName) {
      const labels = new Array(nTris);
      const colorSum = new Map(); // label -> {r,g,b,n}
      for (let t = 0; t < nTris; t++) {
        const label = parsed.rawGroupName[t] || 'senza materiale';
        labels[t] = label;
        if (parsed.rawColors) {
          const cur = colorSum.get(label) || { r: 0, g: 0, b: 0, n: 0 };
          cur.r += parsed.rawColors[t * 3]; cur.g += parsed.rawColors[t * 3 + 1]; cur.b += parsed.rawColors[t * 3 + 2]; cur.n++;
          colorSum.set(label, cur);
        }
      }
      const labelColors = new Map();
      colorSum.forEach((v, k) => labelColors.set(k, [v.r / v.n, v.g / v.n, v.b / v.n]));
      return { labels, labelColors, mode: 'material' };
    }

    if (parsed.hasColorInfo && parsed.rawColors) {
      const colorParts = options.colorParts === undefined ? 8 : options.colorParts;
      const { labelIds, clusters } = Segmentation.kMeansColorClusters(parsed.rawColors, nTris, colorParts);
      const labels = new Array(nTris);
      const labelColors = new Map();
      for (let t = 0; t < nTris; t++) labels[t] = 'colore_' + labelIds[t];
      clusters.forEach((c, i) => labelColors.set('colore_' + i, c.color));
      return { labels, labelColors, mode: 'color-cluster' };
    }

    return { labels: null, labelColors: null, mode: 'none' };
  };

  function groupByLabel(labels) {
    const map = new Map();
    for (let t = 0; t < labels.length; t++) {
      const l = labels[t];
      let list = map.get(l);
      if (!list) { list = []; map.set(l, list); }
      list.push(t);
    }
    return map;
  }

  // ---------------------------------------------------------------------
  // Pipeline completa: dati grezzi parser -> lista di parti riparate.
  // options: { weldEpsilon, colorThreshold, repairOptions }
  // ---------------------------------------------------------------------
  Segmentation.buildParts = function (parsed, options) {
    options = options || {};
    const weldEpsilon = options.weldEpsilon === undefined ? 1e-4 : options.weldEpsilon;
    const warnings = [];

    const { positions, indices } = MeshCore.weldVertices(parsed.rawPositions, weldEpsilon);
    const nTris = indices.length / 3;

    const { labels, labelColors, mode } = Segmentation.buildTriangleLabels(parsed, options);

    let groups; // Map name -> {triangles:[...], color:[r,g,b]}
    if (labels) {
      groups = new Map();
      const byLabel = groupByLabel(labels);
      byLabel.forEach((triList, label) => {
        groups.set(label, { triangles: triList, color: labelColors.get(label) || [0.8, 0.8, 0.8] });
      });
    } else {
      const comp = MeshCore.connectedComponents(indices);
      groups = new Map();
      const byComp = new Map();
      for (let t = 0; t < nTris; t++) {
        const id = comp.faceComponentId[t];
        let list = byComp.get(id);
        if (!list) { list = []; byComp.set(id, list); }
        list.push(t);
      }
      let i = 0;
      byComp.forEach((triList) => {
        groups.set('Parte ' + (i + 1), { triangles: triList, color: FALLBACK_PALETTE[i % FALLBACK_PALETTE.length] });
        i++;
      });
      if (byComp.size <= 1) {
        warnings.push('Nessuna informazione di colore/materiale e nessuna componente separata trovata: il modello è un unico blocco fuso e non può essere segmentato automaticamente. Serve una versione colorata del modello oppure un taglio manuale.');
      }
    }

    const parts = [];
    let idx = 0;
    groups.forEach((group, name) => {
      const sub = MeshCore.extractSubMesh(positions, indices, group.triangles);
      const repaired = MeshCore.repairMesh(sub.positions, sub.indices, options.repairOptions);
      parts.push({
        id: 'part_' + (idx++),
        name,
        color: group.color,
        sourceTriangleCount: group.triangles.length,
        positions: repaired.positions,
        indices: repaired.indices,
        log: repaired.log,
        watertight: repaired.watertight,
        stats: repaired.stats,
        included: true,
      });
    });

    // ordina le parti dalla piu' grande alla piu' piccola (per volume) cosi'
    // la "parte principale" (es. testa/corpo) appare per prima nell'elenco
    parts.sort((a, b) => b.stats.volume - a.stats.volume);

    return { parts, mode, warnings };
  };

  return Segmentation;
});
