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
  // Voto di maggioranza tra triangoli adiacenti: ripulisce le etichette
  // "sale e pepe" isolate (un triangolo con colore diverso da TUTTI i
  // vicini) che compaiono ai bordi tra due zone su texture rumorose.
  // Un vero confine resta stabile (i vicini sono divisi ~a meta'), solo i
  // triangoli davvero isolati vengono riassegnati.
  // ---------------------------------------------------------------------
  function smoothLabelsMajority(labels, indices, iterations) {
    iterations = iterations === undefined ? 2 : iterations;
    const nTris = indices.length / 3;
    const edgeMap = MeshCore.buildEdgeMap(indices);
    const adjacency = Array.from({ length: nTris }, () => []);
    edgeMap.forEach((occurrences) => {
      if (occurrences.length < 2) return;
      for (let i = 0; i < occurrences.length; i++) {
        for (let j = i + 1; j < occurrences.length; j++) {
          adjacency[occurrences[i].face].push(occurrences[j].face);
          adjacency[occurrences[j].face].push(occurrences[i].face);
        }
      }
    });

    let current = labels.slice();
    for (let iter = 0; iter < iterations; iter++) {
      const next = current.slice();
      let changedAny = false;
      for (let t = 0; t < nTris; t++) {
        const neigh = adjacency[t];
        if (neigh.length === 0) continue;
        const counts = new Map();
        for (const nb of neigh) counts.set(current[nb], (counts.get(current[nb]) || 0) + 1);
        let bestLabel = current[t];
        let bestCount = counts.get(current[t]) || 0;
        counts.forEach((cnt, l) => { if (cnt > bestCount) { bestCount = cnt; bestLabel = l; } });
        if (bestLabel !== current[t] && bestCount > neigh.length / 2) {
          next[t] = bestLabel;
          changedAny = true;
        }
      }
      current = next;
      if (!changedAny) break;
    }
    return current;
  }

  // ---------------------------------------------------------------------
  // Segmentazione geometrica ("per forma"): ignora colori e texture.
  // Fa crescere le regioni unendo i triangoli attraverso gli spigoli piatti
  // o convessi e si ferma alle pieghe CONCAVE marcate (angolo diedro sopra
  // soglia): sono le "valli" dove tipicamente un pezzo incontra l'altro
  // (cappello->testa, collo->busto). Le regioni vengono poi consolidate:
  // i frammenti minuscoli assorbiti, e fusioni progressive lungo le pieghe
  // piu' deboli fino a scendere al numero massimo di parti richiesto.
  // ---------------------------------------------------------------------
  Segmentation.segmentByGeometry = function (positions, indices, targetParts, options) {
    options = options || {};
    const creaseAngleDeg = options.creaseAngleDeg === undefined ? 35 : options.creaseAngleDeg;
    const creaseCos = Math.cos((creaseAngleDeg * Math.PI) / 180);
    const nTris = indices.length / 3;
    targetParts = Math.max(1, targetParts || 8);
    if (nTris === 0) return { labelIds: new Int32Array(0), regionCount: 0 };

    // Winding coerente e normali verso l'esterno: senza questo passaggio la
    // distinzione concavo/convesso sarebbe casuale su mesh mal orientate.
    const idx = Uint32Array.from(indices);
    let edgeMap = MeshCore.buildEdgeMap(idx);
    MeshCore.fixWindingConsistency(idx, edgeMap);
    edgeMap = MeshCore.buildEdgeMap(idx);
    const comp = MeshCore.connectedComponents(idx, edgeMap);
    MeshCore.orientOutward(positions, idx, comp.faceComponentId, comp.componentCount);

    const normals = new Float64Array(nTris * 3);
    const centroids = new Float64Array(nTris * 3);
    for (let t = 0; t < nTris; t++) {
      const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
      const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
      const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
      const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
      let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      normals[t * 3] = nx / len; normals[t * 3 + 1] = ny / len; normals[t * 3 + 2] = nz / len;
      centroids[t * 3] = (ax + bx + cx) / 3;
      centroids[t * 3 + 1] = (ay + by + cy) / 3;
      centroids[t * 3 + 2] = (az + bz + cz) / 3;
    }

    const parent = new Int32Array(nTris);
    for (let i = 0; i < nTris; i++) parent[i] = i;
    function find(x) {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    }
    function union(a, b) {
      a = find(a); b = find(b);
      if (a !== b) parent[b] = a;
      return a;
    }

    // Raccogli tutti gli spigoli manifold con angolo diedro e concavita'.
    const eF1 = [], eF2 = [], eDot = [], eConcave = [];
    edgeMap.forEach((occ) => {
      if (occ.length !== 2) return;
      const f1 = occ[0].face, f2 = occ[1].face;
      if (f1 === f2) return;
      let dot = normals[f1 * 3] * normals[f2 * 3]
        + normals[f1 * 3 + 1] * normals[f2 * 3 + 1]
        + normals[f1 * 3 + 2] * normals[f2 * 3 + 2];
      if (dot > 1) dot = 1; else if (dot < -1) dot = -1;
      const sx = centroids[f2 * 3] - centroids[f1 * 3];
      const sy = centroids[f2 * 3 + 1] - centroids[f1 * 3 + 1];
      const sz = centroids[f2 * 3 + 2] - centroids[f1 * 3 + 2];
      const side = normals[f1 * 3] * sx + normals[f1 * 3 + 1] * sy + normals[f1 * 3 + 2] * sz;
      eF1.push(f1); eF2.push(f2); eDot.push(dot);
      eConcave.push(side > 1e-12 ? 1 : 0);
    });

    // Soglia ADATTIVA: su una mesh densa e levigata (tipica dei generatori
    // IA) i solchi sono arrotondati su tante piccole pieghe, ognuna ben
    // sotto una soglia fissa "da spigolo netto". La soglia viene quindi
    // calcolata dalla distribuzione degli angoli concavi del modello stesso
    // (75° percentile, ridotto del 10%), limitata tra 5° e creaseAngleDeg:
    // su una mesh spigolosa resta alta, su una mesh densa scende quanto
    // basta per agganciare le "valli" reali; il rumore in eccesso viene poi
    // riassorbito dalle fusioni successive.
    let creaseDotThreshold = creaseCos;
    {
      const concaveAngles = [];
      for (let i = 0; i < eDot.length; i++) {
        if (eConcave[i]) concaveAngles.push(Math.acos(eDot[i]));
      }
      if (concaveAngles.length > 0) {
        concaveAngles.sort((a, b) => a - b);
        const p75 = concaveAngles[Math.min(concaveAngles.length - 1, Math.floor(concaveAngles.length * 0.75))];
        const minAngle = (5 * Math.PI) / 180;
        const maxAngle = (creaseAngleDeg * Math.PI) / 180;
        const adaptive = Math.min(maxAngle, Math.max(minAngle, p75 * 0.9));
        creaseDotThreshold = Math.cos(adaptive);
      }
    }

    // Classifica: le pieghe concave sopra soglia diventano confini; tutto il
    // resto (piatto o convesso) unisce le regioni.
    const creaseEdges = []; // [f1, f2, dotNormali]
    for (let i = 0; i < eF1.length; i++) {
      if (eConcave[i] && eDot[i] < creaseDotThreshold) {
        creaseEdges.push([eF1[i], eF2[i], eDot[i]]);
      } else {
        union(eF1[i], eF2[i]);
      }
    }

    function computeSizes() {
      const sizes = new Map();
      for (let t = 0; t < nTris; t++) {
        const r = find(t);
        sizes.set(r, (sizes.get(r) || 0) + 1);
      }
      return sizes;
    }

    const minSize = Math.max(3, Math.ceil(nTris * 0.002));

    // Assorbi i frammenti piccoli nel vicino (via pieghe) con cui condividono
    // piu' spigoli: sono rumore di tassellazione, non parti stampabili.
    // Con la soglia adattiva bassa le regioni iniziali possono essere molte:
    // servono piu' passate perche' le catene di fusioni convergano.
    for (let pass = 0; pass < 8; pass++) {
      const sizes = computeSizes();
      const neighborCount = new Map(); // rootPiccolo -> Map(rootVicino -> nSpigoli)
      for (const [f1, f2] of creaseEdges) {
        const r1 = find(f1), r2 = find(f2);
        if (r1 === r2) continue;
        if (sizes.get(r1) < minSize) {
          let m = neighborCount.get(r1);
          if (!m) { m = new Map(); neighborCount.set(r1, m); }
          m.set(r2, (m.get(r2) || 0) + 1);
        }
        if (sizes.get(r2) < minSize) {
          let m = neighborCount.get(r2);
          if (!m) { m = new Map(); neighborCount.set(r2, m); }
          m.set(r1, (m.get(r1) || 0) + 1);
        }
      }
      let changed = false;
      neighborCount.forEach((neighMap, smallRoot) => {
        if (find(smallRoot) !== smallRoot) return; // gia' fuso in questa passata
        let best = -1, bestCount = -1;
        neighMap.forEach((cnt, other) => {
          if (cnt > bestCount) { bestCount = cnt; best = other; }
        });
        if (best !== -1) { union(find(best), smallRoot); changed = true; }
      });
      if (!changed) break;
    }

    // Frammenti piccoli SENZA vicini via pieghe (isole sconnesse, geometria
    // duplicata): assegnali alla regione grande piu' vicina nello spazio.
    {
      const sizes = computeSizes();
      const bigRoots = [];
      sizes.forEach((size, root) => { if (size >= minSize) bigRoots.push(root); });
      if (bigRoots.length === 0) {
        let largest = -1, largestSize = -1;
        sizes.forEach((size, root) => { if (size > largestSize) { largestSize = size; largest = root; } });
        if (largest !== -1) bigRoots.push(largest);
      }
      const centroidSum = new Map(); // root -> [x,y,z,n]
      for (let t = 0; t < nTris; t++) {
        const r = find(t);
        let s = centroidSum.get(r);
        if (!s) { s = [0, 0, 0, 0]; centroidSum.set(r, s); }
        s[0] += centroids[t * 3]; s[1] += centroids[t * 3 + 1]; s[2] += centroids[t * 3 + 2]; s[3]++;
      }
      const bigCentroids = bigRoots.map((r) => {
        const s = centroidSum.get(r);
        return [s[0] / s[3], s[1] / s[3], s[2] / s[3], r];
      });
      sizes.forEach((size, root) => {
        if (size >= minSize || find(root) !== root) return;
        if (bigRoots.length === 1 && bigRoots[0] === root) return;
        const s = centroidSum.get(root);
        const cx = s[0] / s[3], cy = s[1] / s[3], cz = s[2] / s[3];
        let best = -1, bestDist = Infinity;
        for (const [bx, by, bz, br] of bigCentroids) {
          if (br === root) continue;
          const d = (bx - cx) ** 2 + (by - cy) ** 2 + (bz - cz) ** 2;
          if (d < bestDist) { bestDist = d; best = br; }
        }
        if (best !== -1) union(find(best), root);
      });
    }

    // Fusioni progressive lungo le pieghe piu' DEBOLI (angolo minore) finche'
    // le regioni non scendono al numero massimo richiesto: restano cosi' solo
    // i confini piu' marcati (es. il solco cappello-testa).
    {
      const pairAgg = new Map(); // "rMin_rMax" -> {r1, r2, sumDot, n}
      for (const [f1, f2, dot] of creaseEdges) {
        const r1 = find(f1), r2 = find(f2);
        if (r1 === r2) continue;
        const key = r1 < r2 ? r1 + '_' + r2 : r2 + '_' + r1;
        let e = pairAgg.get(key);
        if (!e) { e = { r1, r2, sumDot: 0, n: 0 }; pairAgg.set(key, e); }
        e.sumDot += dot; e.n++;
      }
      const pairs = [...pairAgg.values()];
      // dot alto = piega debole (quasi piatta) -> fondere per prima
      pairs.sort((a, b) => (b.sumDot / b.n) - (a.sumDot / a.n));
      let regionCount = computeSizes().size;
      for (const p of pairs) {
        if (regionCount <= targetParts) break;
        const r1 = find(p.r1), r2 = find(p.r2);
        if (r1 === r2) continue;
        union(r1, r2);
        regionCount--;
      }
    }

    // Etichette finali: id sequenziali ordinati per dimensione decrescente
    const finalSizes = computeSizes();
    const roots = [...finalSizes.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    const rootToId = new Map();
    roots.forEach((r, i) => rootToId.set(r, i));
    const labelIds = new Int32Array(nTris);
    for (let t = 0; t < nTris; t++) labelIds[t] = rootToId.get(find(t));

    return { labelIds, regionCount: roots.length };
  };

  // ---------------------------------------------------------------------
  // Pipeline completa: dati grezzi parser -> lista di parti riparate.
  // options: { weldEpsilon, colorParts, segmentMode ('auto'|'geometry'), repairOptions }
  // ---------------------------------------------------------------------
  Segmentation.buildParts = function (parsed, options) {
    options = options || {};
    const weldEpsilon = options.weldEpsilon === undefined ? 1e-4 : options.weldEpsilon;
    const warnings = [];

    const { positions, indices } = MeshCore.weldVertices(parsed.rawPositions, weldEpsilon);
    const nTris = indices.length / 3;

    const segmentMode = options.segmentMode || 'auto';

    // costruisce i gruppi con la segmentazione geometrica (per forma)
    function buildGeometryGroups() {
      const target = options.colorParts === undefined ? 8 : options.colorParts;
      const geo = Segmentation.segmentByGeometry(positions, indices, target, options.geometryOptions);
      const byRegion = new Map();
      for (let t = 0; t < nTris; t++) {
        const id = geo.labelIds[t];
        let list = byRegion.get(id);
        if (!list) { list = []; byRegion.set(id, list); }
        list.push(t);
      }
      const entries = [...byRegion.entries()].sort((a, b) => b[1].length - a[1].length);
      const g = new Map();
      entries.forEach(([, triList], i) => {
        g.set('Parte ' + (i + 1), { triangles: triList, color: FALLBACK_PALETTE[i % FALLBACK_PALETTE.length] });
      });
      return g;
    }

    if (segmentMode === 'geometry') {
      const groups = buildGeometryGroups();
      return finalizeParts(groups, 'geometry', warnings, positions, indices, options);
    }

    let { labels, labelColors, mode } = Segmentation.buildTriangleLabels(parsed, options);

    let groups; // Map name -> {triangles:[...], color:[r,g,b]}
    if (labels) {
      const smoothIterations = options.labelSmoothIterations === undefined ? 2 : options.labelSmoothIterations;
      if (smoothIterations > 0) labels = smoothLabelsMajority(labels, indices, smoothIterations);

      groups = new Map();
      const byLabel = groupByLabel(labels);
      byLabel.forEach((triList, label) => {
        const color = labelColors.get(label) || [0.8, 0.8, 0.8];
        // ulteriore split per componenti connesse: stesso colore/materiale
        // ma zone fisicamente separate (es. cappello nero + stivali neri)
        // diventano parti distinte invece di un unico file "che porta tutto".
        const sub = MeshCore.extractSubMesh(positions, indices, triList);
        const localComp = MeshCore.connectedComponents(sub.indices);
        const byComp = new Map();
        for (let i = 0; i < triList.length; i++) {
          const cid = localComp.faceComponentId[i];
          let list = byComp.get(cid);
          if (!list) { list = []; byComp.set(cid, list); }
          list.push(triList[i]); // indice GLOBALE originale
        }
        const compEntries = [...byComp.values()].sort((a, b) => b.length - a.length);

        // Su mesh reali con difetti di topologia (geometria duplicata,
        // cuciture non saldate) lo split per componenti connesse puo'
        // generare centinaia di "isolette" di pochi triangoli che non sono
        // parti vere, solo rumore. Le componenti troppo piccole rispetto al
        // gruppo (soglia relativa, cosi' funziona sia su mesh semplici che
        // su mesh da centinaia di migliaia di triangoli) vengono riassorbite
        // nella componente principale invece di diventare una parte a se'.
        const minComponentSize = Math.max(3, Math.ceil(triList.length * 0.02));
        const kept = [];
        let absorbed = [];
        compEntries.forEach((subTriList, i) => {
          if (i === 0 || subTriList.length >= minComponentSize) {
            kept.push(subTriList);
          } else {
            absorbed = absorbed.concat(subTriList);
          }
        });
        if (absorbed.length > 0) kept[0] = kept[0].concat(absorbed);

        kept.forEach((subTriList, i) => {
          const finalName = i === 0 ? label : `${label} (${i + 1})`;
          groups.set(finalName, { triangles: subTriList, color });
        });
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
        // niente colori e blocco unico fuso: prova la segmentazione per forma
        const geoGroups = buildGeometryGroups();
        if (geoGroups.size > 1) {
          warnings.push('Nessuna informazione di colore: il modello è stato diviso lungo le pieghe della forma (metodo "Forma").');
          return finalizeParts(geoGroups, 'geometry', warnings, positions, indices, options);
        }
        warnings.push('Nessuna informazione di colore/materiale e nessuna componente separata trovata: il modello è un unico blocco fuso e non può essere segmentato automaticamente. Serve una versione colorata del modello oppure un taglio manuale.');
      }
    }

    return finalizeParts(groups, mode, warnings, positions, indices, options);
  };

  // Estrazione, riparazione e ordinamento finale delle parti a partire dai
  // gruppi di triangoli (comune a tutte le modalita' di segmentazione).
  function finalizeParts(groups, mode, warnings, positions, indices, options) {
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
  }

  return Segmentation;
});
