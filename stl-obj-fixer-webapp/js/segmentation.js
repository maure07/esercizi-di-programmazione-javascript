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

  function colorDistance(a, b) {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  // Clustering "leader" online: assegna ogni colore al cluster piu' vicino
  // entro soglia, altrimenti ne crea uno nuovo. Semplice, deterministico,
  // non richiede di scegliere k a priori.
  Segmentation.greedyColorClusters = function (rawColors, nTris, threshold) {
    threshold = threshold === undefined ? 0.12 : threshold;
    const clusters = []; // {color:[r,g,b], count}
    const labelIds = new Int32Array(nTris);
    for (let t = 0; t < nTris; t++) {
      const c = [rawColors[t * 3], rawColors[t * 3 + 1], rawColors[t * 3 + 2]];
      let best = -1, bestDist = Infinity;
      for (let k = 0; k < clusters.length; k++) {
        const d = colorDistance(c, clusters[k].color);
        if (d < bestDist) { bestDist = d; best = k; }
      }
      if (best !== -1 && bestDist <= threshold) {
        const cl = clusters[best];
        const n = cl.count + 1;
        cl.color = [
          (cl.color[0] * cl.count + c[0]) / n,
          (cl.color[1] * cl.count + c[1]) / n,
          (cl.color[2] * cl.count + c[2]) / n,
        ];
        cl.count = n;
        labelIds[t] = best;
      } else {
        clusters.push({ color: c, count: 1 });
        labelIds[t] = clusters.length - 1;
      }
    }
    return { labelIds, clusters };
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
      const threshold = options.colorThreshold === undefined ? 0.12 : options.colorThreshold;
      const { labelIds, clusters } = Segmentation.greedyColorClusters(parsed.rawColors, nTris, threshold);
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
