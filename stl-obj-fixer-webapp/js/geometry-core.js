/*
 * geometry-core.js
 * Funzioni pure per riparazione e analisi di mesh triangolari.
 * Nessuna dipendenza dal browser: funziona sia in Node (test) sia nel browser.
 * Rappresentazione mesh: positions = Float64Array [x0,y0,z0, x1,y1,z1, ...]
 *                         indices   = Uint32Array/Array [a0,b0,c0, a1,b1,c1, ...]
 */
(function (root) {
  'use strict';

  const MeshCore = {};

  // ---------------------------------------------------------------------
  // Saldatura vertici (weld) su una "triangle soup" grezza
  // rawPositions: array piatto di lunghezza nTriangoli*9 (3 vertici per triangolo, non condivisi)
  // ---------------------------------------------------------------------
  MeshCore.weldVertices = function (rawPositions, epsilon) {
    epsilon = epsilon || 1e-5;
    const inv = 1 / epsilon;
    const map = new Map();
    const positions = [];
    const nRaw = rawPositions.length / 3;
    const indices = new Uint32Array(nRaw);

    for (let i = 0; i < nRaw; i++) {
      const x = rawPositions[i * 3];
      const y = rawPositions[i * 3 + 1];
      const z = rawPositions[i * 3 + 2];
      const kx = Math.round(x * inv);
      const ky = Math.round(y * inv);
      const kz = Math.round(z * inv);
      const key = kx + ',' + ky + ',' + kz;
      let idx = map.get(key);
      if (idx === undefined) {
        idx = positions.length / 3;
        positions.push(x, y, z);
        map.set(key, idx);
      }
      indices[i] = idx;
    }

    return { positions: Float64Array.from(positions), indices };
  };

  // ---------------------------------------------------------------------
  // ALLEGGERIMENTO: meno triangoli, stessa forma.
  //
  // I modelli fatti dall'IA arrivano con triangoli molto piu' fini di quanto
  // una stampante possa mai riprodurre: un file da 130 MB ha triangoli grossi
  // un decimo di millimetro, mentre l'ugello ne fa 0,4 e lo strato 0,2. Quel
  // dettaglio non finisce nell'oggetto stampato, finisce solo nella memoria
  // del browser: la mappa degli spigoli di un modello da 2,6 milioni di
  // triangoli occupa da sola quasi un giga, ed e' per questo che la pagina si
  // impunta e Firefox avvisa che sta rallentando.
  //
  // Si alleggerisce nel modo piu' semplice e prevedibile: si appoggia il
  // modello su una griglia e i punti che finiscono nella stessa casella
  // diventano uno solo. I triangoli che cosi' si schiacciano spariscono. E'
  // esattamente la saldatura dei vertici che si fa gia' all'apertura del file,
  // solo con la maglia piu' larga.
  //
  // Il passo della griglia NON si cerca per tentativi (ogni tentativo su un
  // modello del genere costa dieci secondi): si calcola. Su una superficie il
  // numero di caselle occupate e' circa area/passo², e ogni casella regge un
  // paio di triangoli, quindi per arrivare a T triangoli serve
  // passo = radice(2·area/T).
  // ---------------------------------------------------------------------
  MeshCore.passoPerAlleggerire = function (rawPositions, triangoliObiettivo) {
    let area = 0;
    for (let i = 0; i + 8 < rawPositions.length; i += 9) {
      const ux = rawPositions[i + 3] - rawPositions[i];
      const uy = rawPositions[i + 4] - rawPositions[i + 1];
      const uz = rawPositions[i + 5] - rawPositions[i + 2];
      const vx = rawPositions[i + 6] - rawPositions[i];
      const vy = rawPositions[i + 7] - rawPositions[i + 1];
      const vz = rawPositions[i + 8] - rawPositions[i + 2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      area += Math.sqrt(cx * cx + cy * cy + cz * cz) * 0.5;
    }
    // Il 2,6 non e' teorico: col 2 secco, chiedendo 300.000 triangoli ne
    // uscivano 395.000. Misurato e corretto.
    const T = Math.max(1000, triangoliObiettivo || 300000);
    return { passo: Math.sqrt((2.6 * area) / T), area };
  };

  // Alleggerisce e riporta anche COSA e' sopravvissuto, cosi' chi chiama puo'
  // portarsi dietro i colori e le coordinate della texture dei triangoli
  // rimasti invece di buttarli.
  // NB: qui NON si riusa weldVertices. Quella lavora con una chiave di testo
  // per ogni punto ("12,-4,88"): su un modello normale non si nota, ma su
  // 7,9 milioni di punti vuol dire 7,9 milioni di stringhe da creare e
  // buttare, e la prima versione di questa funzione ci metteva un quarto
  // d'ora. Qui la casella della griglia diventa un NUMERO, e i risultati
  // vanno in tabelle di dimensione fissa invece che in liste che crescono.
  MeshCore.alleggerisci = function (rawPositions, passo) {
    const nPunti = rawPositions.length / 3;
    const nTrisIn = nPunti / 3;
    // riquadro del modello: serve a numerare le caselle a partire da zero
    let mnx = Infinity, mny = Infinity, mnz = Infinity;
    let mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    for (let i = 0; i < rawPositions.length; i += 3) {
      const x = rawPositions[i], y = rawPositions[i + 1], z = rawPositions[i + 2];
      if (x < mnx) mnx = x; if (x > mxx) mxx = x;
      if (y < mny) mny = y; if (y > mxy) mxy = y;
      if (z < mnz) mnz = z; if (z > mxz) mxz = z;
    }
    const inv = 1 / passo;
    const nx = Math.floor((mxx - mnx) * inv) + 2;
    const ny = Math.floor((mxy - mny) * inv) + 2;

    // Di ogni casella si tiene solo QUALE punto ci e' arrivato per primo, non
    // le sue tre coordinate: un numero invece di tre, cioe' 30 MB invece di
    // 190 su un modello di questa stazza. Le coordinate si rileggono dopo.
    const nuovoIndice = new Int32Array(nPunti);      // punto -> vertice tenuto
    const primoPunto = new Int32Array(nPunti);       // vertice tenuto -> punto di partenza
    const celle = new Map();                         // chiave numerica -> vertice
    let nVert = 0;
    for (let i = 0; i < nPunti; i++) {
      const ix = Math.floor((rawPositions[i * 3] - mnx) * inv);
      const iy = Math.floor((rawPositions[i * 3 + 1] - mny) * inv);
      const iz = Math.floor((rawPositions[i * 3 + 2] - mnz) * inv);
      const chiave = ix + iy * nx + iz * nx * ny;    // numero, non stringa
      let v = celle.get(chiave);
      if (v === undefined) {
        v = nVert++;
        celle.set(chiave, v);
        primoPunto[v] = i;
      }
      nuovoIndice[i] = v;
    }
    celle.clear();

    // Triangoli sopravvissuti: spariscono quelli che si sono schiacciati, cioe'
    // quelli con due o tre angoli finiti nella stessa casella. Si contano prima
    // e si scrive dopo, cosi' la tabella dei risultati nasce della misura
    // giusta invece che grande quanto il modello di partenza.
    let n = 0;
    for (let t = 0; t < nTrisIn; t++) {
      const a = nuovoIndice[t * 3], b = nuovoIndice[t * 3 + 1], c = nuovoIndice[t * 3 + 2];
      if (a !== b && b !== c && a !== c) n++;
    }
    const fuori = new Float64Array(n * 9);
    const tenuti = new Int32Array(n);
    let m = 0;
    for (let t = 0; t < nTrisIn; t++) {
      const a = nuovoIndice[t * 3], b = nuovoIndice[t * 3 + 1], c = nuovoIndice[t * 3 + 2];
      if (a === b || b === c || a === c) continue;
      const o = m * 9;
      const pa = primoPunto[a] * 3, pb = primoPunto[b] * 3, pc = primoPunto[c] * 3;
      fuori[o] = rawPositions[pa]; fuori[o + 1] = rawPositions[pa + 1]; fuori[o + 2] = rawPositions[pa + 2];
      fuori[o + 3] = rawPositions[pb]; fuori[o + 4] = rawPositions[pb + 1]; fuori[o + 5] = rawPositions[pb + 2];
      fuori[o + 6] = rawPositions[pc]; fuori[o + 7] = rawPositions[pc + 1]; fuori[o + 8] = rawPositions[pc + 2];
      tenuti[m] = t;
      m++;
    }
    return {
      rawPositions: fuori,
      triangoliPrima: nTrisIn,
      triangoliDopo: n,
      tenuti,                          // indice del triangolo di partenza
      vertici: nVert,
    };
  };

  // ---------------------------------------------------------------------
  // Rimozione triangoli degeneri (area ~ 0)
  // ---------------------------------------------------------------------
  MeshCore.removeDegenerateTriangles = function (positions, indices, areaEpsilon) {
    areaEpsilon = areaEpsilon === undefined ? 1e-10 : areaEpsilon;
    const nTris = indices.length / 3;
    const kept = [];
    const keptTriOriginalIndex = [];
    for (let t = 0; t < nTris; t++) {
      const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
      if (a === b || b === c || a === c) continue;
      const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
      const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
      const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const crossx = uy * vz - uz * vy;
      const crossy = uz * vx - ux * vz;
      const crossz = ux * vy - uy * vx;
      const area2 = Math.sqrt(crossx * crossx + crossy * crossy + crossz * crossz);
      if (area2 < areaEpsilon) continue;
      kept.push(a, b, c);
      keptTriOriginalIndex.push(t);
    }
    return { indices: Uint32Array.from(kept), keptTriOriginalIndex };
  };

  // ---------------------------------------------------------------------
  // Tolleranze RELATIVE alla dimensione del modello: con tolleranze assolute
  // lo stesso modello si comporterebbe in modo diverso a seconda dell'unita'
  // di misura del file (o dopo aver applicato una scala).
  // ---------------------------------------------------------------------
  MeshCore.suggestTolerances = function (positions) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = positions[i + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
    const dx = max[0] - min[0], dy = max[1] - min[1], dz = max[2] - min[2];
    const diag = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    return {
      weldEpsilon: diag * 1e-5,
      areaEpsilon: diag * diag * 3e-9,
      diag,
    };
  };

  // ---------------------------------------------------------------------
  // Rimozione triangoli DUPLICATI (stessa terna di vertici, in qualsiasi
  // ordine/orientamento): tipici della geometria doppia degli export IA e
  // causa principale degli edge non-manifold. Tiene la prima occorrenza.
  // ---------------------------------------------------------------------
  MeshCore.removeDuplicateFaces = function (indices) {
    const nTris = indices.length / 3;
    const seen = new Set();
    const kept = [];
    for (let t = 0; t < nTris; t++) {
      const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
      const lo = Math.min(a, b, c);
      const hi = Math.max(a, b, c);
      const mid = a + b + c - lo - hi;
      const key = lo + '_' + mid + '_' + hi;
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(a, b, c);
    }
    return { indices: Uint32Array.from(kept), removed: nTris - kept.length / 3 };
  };

  // ---------------------------------------------------------------------
  // Mappa degli edge: per ogni edge non orientato, elenco delle occorrenze
  // {face, a, b} con (a,b) nell'ordine con cui compaiono nel winding del triangolo.
  // ---------------------------------------------------------------------
  MeshCore.buildEdgeMap = function (indices) {
    const nTris = indices.length / 3;
    const map = new Map();
    for (let t = 0; t < nTris; t++) {
      const v = [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]];
      for (let e = 0; e < 3; e++) {
        const a = v[e], b = v[(e + 1) % 3];
        const key = a < b ? a + '_' + b : b + '_' + a;
        let list = map.get(key);
        if (!list) { list = []; map.set(key, list); }
        list.push({ face: t, a, b });
      }
    }
    return map;
  };

  // ---------------------------------------------------------------------
  // Unione delle componenti connesse via edge condivisi (qualsiasi molteplicita' >=1)
  // Restituisce array faceComponentId[nTris]
  // ---------------------------------------------------------------------
  MeshCore.connectedComponents = function (indices, edgeMap) {
    const nTris = indices.length / 3;
    edgeMap = edgeMap || MeshCore.buildEdgeMap(indices);
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

    const compId = new Int32Array(nTris).fill(-1);
    let nComp = 0;
    for (let start = 0; start < nTris; start++) {
      if (compId[start] !== -1) continue;
      const stack = [start];
      compId[start] = nComp;
      while (stack.length) {
        const f = stack.pop();
        const neigh = adjacency[f];
        for (let k = 0; k < neigh.length; k++) {
          const nb = neigh[k];
          if (compId[nb] === -1) {
            compId[nb] = nComp;
            stack.push(nb);
          }
        }
      }
      nComp++;
    }
    return { faceComponentId: compId, componentCount: nComp };
  };

  // ---------------------------------------------------------------------
  // Rende coerente il winding (orientamento) dei triangoli all'interno di
  // ogni componente connessa "manifold" (collegata solo tramite edge con
  // esattamente 2 occorrenze). indices viene modificato IN PLACE.
  // ---------------------------------------------------------------------
  MeshCore.fixWindingConsistency = function (indices, edgeMap) {
    const nTris = indices.length / 3;
    edgeMap = edgeMap || MeshCore.buildEdgeMap(indices);

    // Costruisci adiacenza solo per edge manifold (esattamente 2 occorrenze)
    const adjacency = Array.from({ length: nTris }, () => []);
    edgeMap.forEach((occurrences) => {
      if (occurrences.length !== 2) return;
      const [o1, o2] = occurrences;
      adjacency[o1.face].push({ face: o2.face, sameDir: o1.a === o2.a && o1.b === o2.b });
      adjacency[o2.face].push({ face: o1.face, sameDir: o1.a === o2.a && o1.b === o2.b });
    });

    const visited = new Uint8Array(nTris);
    // flipped[f]: se il winding CORRENTE di f e' stato invertito rispetto a
    // quello originale (con cui sameDir e' stato calcolato in adjacency).
    const flipped = new Uint8Array(nTris);
    const faceComponentId = new Int32Array(nTris).fill(-1);
    let nComp = 0;
    let flippedCount = 0;

    function flipFace(t) {
      const b = indices[t * 3 + 1];
      indices[t * 3 + 1] = indices[t * 3 + 2];
      indices[t * 3 + 2] = b;
    }

    for (let start = 0; start < nTris; start++) {
      if (visited[start]) continue;
      visited[start] = 1;
      faceComponentId[start] = nComp;
      const stack = [start];
      while (stack.length) {
        const f = stack.pop();
        const neigh = adjacency[f];
        for (let k = 0; k < neigh.length; k++) {
          const { face: nb, sameDir } = neigh[k];
          if (visited[nb]) continue;
          visited[nb] = 1;
          faceComponentId[nb] = nComp;
          // sameDir descrive la relazione tra i winding ORIGINALI di f e nb;
          // se f e' gia' stato ribaltato rispetto al suo winding originale,
          // la relazione effettiva attuale va invertita di conseguenza.
          const effectiveSameDir = sameDir !== !!flipped[f];
          if (effectiveSameDir) { flipFace(nb); flipped[nb] = 1; flippedCount++; }
          stack.push(nb);
        }
      }
      nComp++;
    }

    return { faceComponentId, componentCount: nComp, flippedCount };
  };

  // ---------------------------------------------------------------------
  // Volume con segno (somma di volumi di tetraedri dall'origine).
  // Positivo se i triangoli sono orientati "verso l'esterno" (CCW visto da fuori).
  // ---------------------------------------------------------------------
  MeshCore.signedVolume = function (positions, indices, faceList) {
    let vol = 0;
    const nTris = faceList ? faceList.length : indices.length / 3;
    for (let i = 0; i < nTris; i++) {
      const t = faceList ? faceList[i] : i;
      const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
      const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
      const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
      const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
      vol += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
    }
    return vol;
  };

  // ---------------------------------------------------------------------
  // Inverte le facce di ogni componente il cui volume con segno e' negativo,
  // cosi' che tutte le normali risultino coerentemente rivolte verso l'esterno.
  // ---------------------------------------------------------------------
  MeshCore.orientOutward = function (positions, indices, faceComponentId, componentCount) {
    const byComp = Array.from({ length: componentCount }, () => []);
    for (let t = 0; t < faceComponentId.length; t++) byComp[faceComponentId[t]].push(t);

    let flipped = 0;
    for (let c = 0; c < componentCount; c++) {
      const faces = byComp[c];
      const vol = MeshCore.signedVolume(positions, indices, faces);
      if (vol < 0) {
        for (const t of faces) {
          const b = indices[t * 3 + 1];
          indices[t * 3 + 1] = indices[t * 3 + 2];
          indices[t * 3 + 2] = b;
        }
        flipped++;
      }
    }
    return { flippedComponents: flipped };
  };

  // ---------------------------------------------------------------------
  // Traccia i loop di bordo (edge con una sola occorrenza).
  // Restituisce { loops: [ [v0,v1,...], ... ], openEdgesLeft: n }
  // ---------------------------------------------------------------------
  MeshCore.traceBoundaryLoops = function (indices, edgeMap) {
    edgeMap = edgeMap || MeshCore.buildEdgeMap(indices);
    const nextMap = new Map(); // startVertex -> [{a,b,used}]
    let boundaryCount = 0;
    edgeMap.forEach((occurrences) => {
      if (occurrences.length !== 1) return;
      const o = occurrences[0];
      let list = nextMap.get(o.a);
      if (!list) { list = []; nextMap.set(o.a, list); }
      list.push({ a: o.a, b: o.b, used: false });
      boundaryCount++;
    });

    const loops = [];
    let usedCount = 0;
    let guard = 0;
    const maxGuard = boundaryCount * 4 + 10;

    for (const [startVertex, list] of nextMap) {
      for (const startEdge of list) {
        if (startEdge.used) continue;
        startEdge.used = true;
        usedCount++;
        const loop = [startEdge.a];
        let current = startEdge.b;
        let closed = false;
        while (guard++ < maxGuard) {
          if (current === startEdge.a) { closed = true; break; }
          loop.push(current);
          const candidates = nextMap.get(current);
          if (!candidates) break;
          const nextEdge = candidates.find((e) => !e.used);
          if (!nextEdge) break;
          nextEdge.used = true;
          usedCount++;
          current = nextEdge.b;
        }
        if (closed && loop.length >= 3) {
          loops.push(loop);
        }
      }
    }

    return { loops, openEdgesLeft: boundaryCount - usedCount, totalBoundaryEdges: boundaryCount };
  };

  // ---------------------------------------------------------------------
  // Triangolazione "ear clipping" di un poligono 2D semplice (assunto CCW).
  // pts: array di {x,y}. Restituisce array di terne di indici locali.
  // ---------------------------------------------------------------------
  function polygonSignedArea(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
  }

  function isConvexTurn(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 1e-12;
  }

  function pointInTriangle(p, a, b, c) {
    const d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
    const d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
    const d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  // Variante che segnala anche se la triangolazione e' andata a buon fine
  // (tutte "orecchie" valide) oppure ha dovuto ripiegare su un ventaglio
  // perche' il poligono non era semplice/convesso a sufficienza.
  MeshCore.earClipPolygon2DEx = function (ptsIn) {
    let pts = ptsIn.slice();
    let order = pts.map((_, i) => i);
    const area = polygonSignedArea(pts);
    let reversed = false;
    if (area < 0) { order.reverse(); reversed = true; }

    const triangles = [];
    let ring = order.slice();
    let guard = 0;
    const maxGuard = ring.length * ring.length + 16;
    let complete = true;

    while (ring.length > 3 && guard++ < maxGuard) {
      let earFound = false;
      for (let i = 0; i < ring.length; i++) {
        const iPrev = ring[(i - 1 + ring.length) % ring.length];
        const iCurr = ring[i];
        const iNext = ring[(i + 1) % ring.length];
        const a = pts[iPrev], b = pts[iCurr], c = pts[iNext];
        if (!isConvexTurn(a, b, c)) continue;
        let ok = true;
        for (let k = 0; k < ring.length; k++) {
          const idx = ring[k];
          if (idx === iPrev || idx === iCurr || idx === iNext) continue;
          if (pointInTriangle(pts[idx], a, b, c)) { ok = false; break; }
        }
        if (!ok) continue;
        triangles.push([iPrev, iCurr, iNext]);
        ring.splice(i, 1);
        earFound = true;
        break;
      }
      if (!earFound) { complete = false; break; } // poligono non semplice
    }

    if (ring.length >= 3) {
      // fan fallback per l'eventuale resto (o poligoni non semplici)
      for (let i = 1; i < ring.length - 1; i++) {
        triangles.push([ring[0], ring[i], ring[i + 1]]);
      }
    }

    if (reversed) {
      for (const tri of triangles) {
        const tmp = tri[1]; tri[1] = tri[2]; tri[2] = tmp;
      }
    }
    return { triangles, complete };
  };

  MeshCore.earClipPolygon2D = function (ptsIn) {
    return MeshCore.earClipPolygon2DEx(ptsIn).triangles;
  };

  // ---------------------------------------------------------------------
  // Chiude un loop di bordo con una "toppa" triangolata, coerente con la
  // direzione del loop (che a sua volta riflette l'orientamento del guscio).
  // loopVertexIndices: indici globali nel buffer positions.
  // Restituisce array piatto di nuovi indici di triangoli (globali).
  // ---------------------------------------------------------------------
  // options.newVertexIndex: se il buco viene chiuso con un ventaglio dal
  // baricentro, l'indice che avra' il nuovo vertice nel buffer positions.
  // Restituisce { indices, newVertex } dove newVertex e' [x,y,z] o null.
  MeshCore.triangulateLoop = function (positions, loopVertexIndices, options) {
    options = options || {};
    const n = loopVertexIndices.length;
    if (n < 3) return { indices: [], newVertex: null };
    const pts3 = loopVertexIndices.map((vi) => [
      positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2],
    ]);

    // normale del piano medio (Newell)
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < n; i++) {
      const [x1, y1, z1] = pts3[i];
      const [x2, y2, z2] = pts3[(i + 1) % n];
      nx += (y1 - y2) * (z1 + z2);
      ny += (z1 - z2) * (x1 + x2);
      nz += (x1 - x2) * (y1 + y2);
    }
    let len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 1e-12) return { indices: [], newVertex: null }; // loop degenere
    nx /= len; ny /= len; nz /= len;

    // baricentro e planarita' del loop: scarto massimo dal piano medio
    // rapportato al perimetro. Un buco quasi piatto si triangola bene con
    // le "orecchie"; un buco molto curvo (tipico degli scafi aperti generati
    // dall'IA) va chiuso a cupola con un ventaglio dal baricentro, altrimenti
    // le orecchie proiettate si sovrappongono e la toppa esce storta.
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += pts3[i][0]; cy += pts3[i][1]; cz += pts3[i][2]; }
    cx /= n; cy /= n; cz /= n;
    let maxDev = 0, perim = 0;
    for (let i = 0; i < n; i++) {
      const p = pts3[i];
      const dev = Math.abs((p[0] - cx) * nx + (p[1] - cy) * ny + (p[2] - cz) * nz);
      if (dev > maxDev) maxDev = dev;
      const q = pts3[(i + 1) % n];
      perim += Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2);
    }
    const planarityRatio = perim > 0 ? maxDev / perim : 0;

    // base locale (u,v) ortogonale alla normale
    let ux, uy, uz;
    if (Math.abs(nx) < 0.9) { ux = 1; uy = 0; uz = 0; } else { ux = 0; uy = 1; uz = 0; }
    const d = ux * nx + uy * ny + uz * nz;
    ux -= d * nx; uy -= d * ny; uz -= d * nz;
    len = Math.sqrt(ux * ux + uy * uy + uz * uz);
    ux /= len; uy /= len; uz /= len;
    const vx = ny * uz - nz * uy;
    const vy = nz * ux - nx * uz;
    const vz = nx * uy - ny * ux;

    // prova prima le orecchie (toppa piu' pulita se il buco e' semplice/piatto)
    const allowCentroid = options.allowCentroid !== false && options.newVertexIndex !== undefined;
    if (!allowCentroid || (n <= 5 && planarityRatio < 0.08)) {
      const pts2 = pts3.map(([x, y, z]) => ({ x: x * ux + y * uy + z * uz, y: x * vx + y * vy + z * vz }));
      const localTris = MeshCore.earClipPolygon2D(pts2);
      const outIndices = [];
      for (const [i0, i1, i2] of localTris) {
        outIndices.push(loopVertexIndices[i0], loopVertexIndices[i1], loopVertexIndices[i2]);
      }
      return { indices: outIndices, newVertex: null };
    }

    const pts2 = pts3.map(([x, y, z]) => ({ x: x * ux + y * uy + z * uz, y: x * vx + y * vy + z * vz }));
    const ear = MeshCore.earClipPolygon2DEx(pts2);
    if (ear.complete && planarityRatio < 0.08) {
      const outIndices = [];
      for (const [i0, i1, i2] of ear.triangles) {
        outIndices.push(loopVertexIndices[i0], loopVertexIndices[i1], loopVertexIndices[i2]);
      }
      return { indices: outIndices, newVertex: null };
    }

    // Chiusura che SEGUE IL BORDO (orecchie in 3D). Si "mangia" il contorno un
    // vertice alla volta, scegliendo ogni volta il triangolo piu' compatto fra
    // tre vertici consecutivi. Non si aggiunge nessun punto al centro, quindi
    // la toppa resta appoggiata al bordo invece di formare quella raggiera
    // appuntita che si vedeva prima sui tagli.
    const seguiBordo = MeshCore.fillLoop3D(pts3, loopVertexIndices);
    if (seguiBordo) return { indices: seguiBordo, newVertex: null };

    // ultima spiaggia: ventaglio dal baricentro (chiusura sempre garantita)
    const cIdx = options.newVertexIndex;
    const outIndices = [];
    for (let i = 0; i < n; i++) {
      outIndices.push(loopVertexIndices[i], loopVertexIndices[(i + 1) % n], cIdx);
    }
    return { indices: outIndices, newVertex: [cx, cy, cz] };
  };

  // ---------------------------------------------------------------------
  // Chiusura di un contorno CURVO senza aggiungere punti: a ogni passo si
  // toglie ("orecchia") il vertice il cui triangolo con i due vicini e' il
  // piu' conveniente — piccolo e ben proporzionato, non una scheggia. E'
  // l'approccio classico per tappare i buchi seguendo la forma del bordo.
  // Restituisce la lista di indici, oppure null se non ci riesce.
  // ---------------------------------------------------------------------
  // ---------------------------------------------------------------------
  // Lisciatura dei BORDI APERTI (le linee di taglio).
  // Un bordo nato da una segmentazione segue gli spigoli dei triangoli, quindi
  // e' seghettato. Quel dente di sega si vede sul pezzo stampato e, quando il
  // buco viene tappato, viene amplificato in una brutta raggiera. Qui ogni
  // vertice di bordo viene portato verso la media dei suoi due vicini LUNGO IL
  // BORDO: la linea si distende, la superficie del pezzo non viene toccata.
  // Siccome i due pezzi condividono lo stesso bordo, lisciandolo allo stesso
  // modo continuano a combaciare.
  // ---------------------------------------------------------------------
  MeshCore.smoothBoundaryLoops = function (positions, indices, iterations, strength) {
    iterations = iterations === undefined ? 6 : iterations;
    strength = strength === undefined ? 0.5 : strength;
    if (iterations <= 0) return positions;
    const edgeMap = MeshCore.buildEdgeMap(indices);
    // vicini lungo il bordo: ogni vertice di bordo ne ha due
    const vicini = new Map();
    edgeMap.forEach((occ) => {
      if (occ.length !== 1) return;
      const { a, b } = occ[0];
      if (!vicini.has(a)) vicini.set(a, []);
      if (!vicini.has(b)) vicini.set(b, []);
      vicini.get(a).push(b);
      vicini.get(b).push(a);
    });
    if (vicini.size === 0) return positions;

    // Si lisciano SOLO i contorni fatti di tanti vertici, cioe' le linee di
    // taglio nate dalla segmentazione (decine o centinaia di punti, seghettate).
    // Un contorno con pochi vertici e' uno spigolo voluto — il bordo quadrato di
    // un pezzetto — e lisciarlo lo arrotonderebbe facendogli perdere volume.
    const minVerticiContorno = 16;
    const daLisciare = new Set();
    const visti = new Set();
    vicini.forEach((_nb, avvio) => {
      if (visti.has(avvio)) return;
      // percorri il contorno a cui appartiene questo vertice
      const contorno = [];
      const pila = [avvio];
      visti.add(avvio);
      while (pila.length) {
        const v = pila.pop();
        contorno.push(v);
        for (const w of (vicini.get(v) || [])) {
          if (!visti.has(w)) { visti.add(w); pila.push(w); }
        }
      }
      if (contorno.length >= minVerticiContorno) {
        for (const v of contorno) daLisciare.add(v);
      }
    });
    if (daLisciare.size === 0) return positions;

    const P = Float64Array.from(positions);
    const originale = Float64Array.from(positions);

    // Tetto allo spostamento: nessun vertice puo' allontanarsi dalla sua
    // posizione originale piu' di una frazione della distanza fra i vertici del
    // bordo. Senza questo, su un pezzo piccolo il contorno si stringerebbe su
    // se' stesso e il pezzo perderebbe volume (misurato: -67%).
    let somma = 0, conteggio = 0;
    daLisciare.forEach((v) => {
      for (const w of (vicini.get(v) || [])) {
        somma += Math.sqrt(
          (originale[v * 3] - originale[w * 3]) ** 2 +
          (originale[v * 3 + 1] - originale[w * 3 + 1]) ** 2 +
          (originale[v * 3 + 2] - originale[w * 3 + 2]) ** 2);
        conteggio++;
      }
    });
    const tetto = conteggio ? (somma / conteggio) * 0.75 : 0;
    if (!(tetto > 0)) return positions;

    // Si alternano un passo che liscia e uno che "rigonfia" (coefficiente
    // negativo): e' lo schema di Taubin, che toglie il dente di sega senza
    // restringere la linea.
    const mu = -(strength / (1 - 0.1 * strength)) * 1.02;
    for (let it = 0; it < iterations * 2; it++) {
      const fattore = (it % 2 === 0) ? strength : mu;
      const next = Float64Array.from(P);
      vicini.forEach((nb, v) => {
        if (nb.length !== 2 || !daLisciare.has(v)) return;  // biforcazioni e spigoli voluti: non toccarli
        const [p, q] = nb;
        for (let k = 0; k < 3; k++) {
          const media = (P[p * 3 + k] + P[q * 3 + k]) / 2;
          next[v * 3 + k] = P[v * 3 + k] + fattore * (media - P[v * 3 + k]);
        }
      });
      P.set(next);
    }

    // applica il tetto allo spostamento complessivo
    daLisciare.forEach((v) => {
      const dx = P[v * 3] - originale[v * 3];
      const dy = P[v * 3 + 1] - originale[v * 3 + 1];
      const dz = P[v * 3 + 2] - originale[v * 3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > tetto) {
        const s = tetto / d;
        P[v * 3] = originale[v * 3] + dx * s;
        P[v * 3 + 1] = originale[v * 3 + 1] + dy * s;
        P[v * 3 + 2] = originale[v * 3 + 2] + dz * s;
      }
    });
    return P;
  };

  MeshCore.fillLoop3D = function (pts3, loopVertexIndices, maxN) {
    const n = pts3.length;
    if (n < 3) return null;
    // La ricerca esplora tutte le suddivisioni possibili: e' il metodo che da'
    // la toppa migliore, ma il lavoro cresce col cubo del numero di vertici.
    // Oltre una certa soglia si lascia perdere e si usa il ventaglio.
    if (n > (maxN || 260)) return null;

    const dist = (a, b) => Math.sqrt(
      (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
    // costo di un triangolo: si vuole poca superficie e nessuna scheggia, cioe'
    // niente triangoli lunghi e sottili (erano quelli a formare la raggiera)
    function costo(i, j, k) {
      const p = pts3[i], q = pts3[j], r = pts3[k];
      const a = dist(p, q), b = dist(q, r), c = dist(r, p);
      const s = (a + b + c) / 2;
      const area = Math.sqrt(Math.max(s * (s - a) * (s - b) * (s - c), 0));
      const lato = Math.max(a, b, c);
      if (area <= 1e-14) return lato * lato * 100 + 1e3;
      // rapporto fra il lato piu' lungo e l'altezza corrispondente:
      // vale ~1 per un triangolo equilatero, cresce moltissimo per le schegge
      const magrezza = (lato * lato) / (2 * area);
      return area + 6.0 * magrezza * lato;
    }

    // ricerca della triangolazione di costo minimo (programmazione dinamica):
    // W[i][j] = costo migliore per chiudere il tratto di contorno da i a j
    const W = new Float64Array(n * n).fill(0);
    const scelta = new Int32Array(n * n).fill(-1);
    for (let salto = 2; salto < n; salto++) {
      for (let i = 0; i + salto < n; i++) {
        const j = i + salto;
        let best = Infinity, bestK = -1;
        for (let k = i + 1; k < j; k++) {
          const v = W[i * n + k] + W[k * n + j] + costo(i, k, j);
          if (v < best) { best = v; bestK = k; }
        }
        W[i * n + j] = best;
        scelta[i * n + j] = bestK;
      }
    }
    if (!isFinite(W[0 * n + (n - 1)])) return null;

    const out = [];
    const pila = [[0, n - 1]];
    while (pila.length) {
      const [i, j] = pila.pop();
      if (j - i < 2) continue;
      const k = scelta[i * n + j];
      if (k < 0) return null;
      out.push(loopVertexIndices[i], loopVertexIndices[k], loopVertexIndices[j]);
      pila.push([i, k], [k, j]);
    }
    return out.length ? out : null;
  };

  // ---------------------------------------------------------------------
  // "Zippering" dei bordi: salda tra loro i vertici DI BORDO che distano
  // meno di epsilon. Serve a chiudere le cuciture/crepe (loop di bordo quasi
  // coincidenti ma con vertici non saldati) tipiche dei modelli esportati a
  // pezzi: non tocca i vertici interni, quindi non deforma la superficie.
  // Restituisce { positions, indices, merged }.
  // ---------------------------------------------------------------------
  MeshCore.weldBoundaryVertices = function (positions, indices, epsilon) {
    if (!(epsilon > 0)) return { positions, indices, merged: 0 };
    const edgeMap = MeshCore.buildEdgeMap(indices);
    const isBoundary = new Set();
    edgeMap.forEach((occ) => {
      if (occ.length === 1) { isBoundary.add(occ[0].a); isBoundary.add(occ[0].b); }
    });
    if (isBoundary.size === 0) return { positions, indices, merged: 0 };

    // griglia spaziale sui soli vertici di bordo; ogni vertice cerca un
    // rappresentante gia' visto entro epsilon nelle celle 3x3x3 vicine.
    const inv = 1 / epsilon;
    const grid = new Map();
    const remap = new Int32Array(positions.length / 3);
    for (let i = 0; i < remap.length; i++) remap[i] = i;
    let merged = 0;
    const boundaryList = [...isBoundary];
    for (const vi of boundaryList) {
      const x = positions[vi * 3], y = positions[vi * 3 + 1], z = positions[vi * 3 + 2];
      const gx = Math.floor(x * inv), gy = Math.floor(y * inv), gz = Math.floor(z * inv);
      let rep = -1;
      for (let dx = -1; dx <= 1 && rep < 0; dx++) {
        for (let dy = -1; dy <= 1 && rep < 0; dy++) {
          for (let dz = -1; dz <= 1 && rep < 0; dz++) {
            const cell = grid.get((gx + dx) + '_' + (gy + dy) + '_' + (gz + dz));
            if (!cell) continue;
            for (const cvi of cell) {
              const dxx = positions[cvi * 3] - x, dyy = positions[cvi * 3 + 1] - y, dzz = positions[cvi * 3 + 2] - z;
              if (dxx * dxx + dyy * dyy + dzz * dzz <= epsilon * epsilon) { rep = cvi; break; }
            }
          }
        }
      }
      if (rep >= 0) { remap[vi] = rep; merged++; }
      else {
        const key = gx + '_' + gy + '_' + gz;
        let cell = grid.get(key);
        if (!cell) { cell = []; grid.set(key, cell); }
        cell.push(vi);
      }
    }
    if (merged === 0) return { positions, indices, merged: 0 };
    const newIdx = new Uint32Array(indices.length);
    for (let i = 0; i < indices.length; i++) newIdx[i] = remap[indices[i]];
    return { positions, indices: newIdx, merged };
  };

  // ---------------------------------------------------------------------
  // Estrae una sotto-mesh a partire da una lista di triangoli (indici globali)
  // ---------------------------------------------------------------------
  MeshCore.extractSubMesh = function (positions, indices, triangleList) {
    const remap = new Map();
    const outPositions = [];
    const outIndices = new Uint32Array(triangleList.length * 3);
    for (let i = 0; i < triangleList.length; i++) {
      const t = triangleList[i];
      for (let k = 0; k < 3; k++) {
        const gi = indices[t * 3 + k];
        let li = remap.get(gi);
        if (li === undefined) {
          li = outPositions.length / 3;
          outPositions.push(positions[gi * 3], positions[gi * 3 + 1], positions[gi * 3 + 2]);
          remap.set(gi, li);
        }
        outIndices[i * 3 + k] = li;
      }
    }
    return { positions: Float64Array.from(outPositions), indices: outIndices };
  };

  // ---------------------------------------------------------------------
  // TAGLIO CON UN PIANO: divide la mesh nei due lati di un piano (punto p0,
  // normale nrm). I triangoli attraversati vengono spezzati sul piano
  // (Sutherland-Hodgman), e la sezione trasversale viene TAPPATA PIATTA su
  // entrambi i lati: cosi' le due facce di taglio sono lisce e identiche, e i
  // pezzi si incastrano perfettamente. Restituisce { above, below } con
  // { positions, indices } ciascuno.
  // ---------------------------------------------------------------------
  MeshCore.cutByPlane = function (positions, indices, p0, nrm) {
    const nl = Math.sqrt(nrm[0] * nrm[0] + nrm[1] * nrm[1] + nrm[2] * nrm[2]) || 1;
    const nx = nrm[0] / nl, ny = nrm[1] / nl, nz = nrm[2] / nl;
    const nV = positions.length / 3;
    // sposta il piano di un'inezia lungo la normale: cosi' non passa MAI
    // esattamente per un vertice (che genererebbe triangoli-tappo degeneri).
    // Lo scostamento e' impercettibile (0,01% della dimensione del modello).
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < positions.length; i++) { if (positions[i] < mn) mn = positions[i]; if (positions[i] > mx) mx = positions[i]; }
    const shift = (mx - mn) * 1.37e-4;
    const q0 = [p0[0] + nx * shift, p0[1] + ny * shift, p0[2] + nz * shift];
    const dist = new Float64Array(nV);
    for (let i = 0; i < nV; i++) {
      dist[i] = (positions[i * 3] - q0[0]) * nx + (positions[i * 3 + 1] - q0[1]) * ny + (positions[i * 3 + 2] - q0[2]) * nz;
    }

    const posA = [], idxA = [], posB = [], idxB = [];
    const mapA = new Map(), mapB = new Map();
    const A = { pos: posA, idx: idxA, map: mapA };
    const B = { pos: posB, idx: idxB, map: mapB };
    function addOrig(side, vi) {
      let m = side.map.get(vi);
      if (m === undefined) { m = side.pos.length / 3; side.pos.push(positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]); side.map.set(vi, m); }
      return m;
    }
    // vertici di intersezione: identificati dalla chiave dello spigolo, condivisi
    // per lato (indice locale) e in cache come punto 3D per il tappo
    const cutPos = new Map(); // key -> [x,y,z]
    const cutA = new Map(), cutB = new Map();
    function edgeKey(i, j) { return i < j ? i + '_' + j : j + '_' + i; }
    function cutPointPos(i, j) {
      const key = edgeKey(i, j);
      let p = cutPos.get(key);
      if (!p) {
        const di = dist[i], dj = dist[j];
        const t = di / (di - dj);
        p = [positions[i * 3] + t * (positions[j * 3] - positions[i * 3]),
        positions[i * 3 + 1] + t * (positions[j * 3 + 1] - positions[i * 3 + 1]),
        positions[i * 3 + 2] + t * (positions[j * 3 + 2] - positions[i * 3 + 2])];
        cutPos.set(key, p);
      }
      return { key, p };
    }
    function addCut(side, cutMap, key, p) {
      let m = cutMap.get(key);
      if (m === undefined) { m = side.pos.length / 3; side.pos.push(p[0], p[1], p[2]); cutMap.set(key, m); }
      return m;
    }

    // segmenti della sezione (per il tappo): coppie di chiavi spigolo
    const capSeg = [];

    function emitPoly(side, cutMap, verts) {
      // verts: lista di {orig?:vi, cut?:{key,p}} in ordine; fan-triangola
      if (verts.length < 3) return;
      const local = verts.map((v) => v.orig !== undefined ? addOrig(side, v.orig) : addCut(side, cutMap, v.cut.key, v.cut.p));
      for (let i = 1; i < local.length - 1; i++) {
        side.idx.push(local[0], local[i], local[i + 1]);
      }
    }

    const nT = indices.length / 3;
    for (let t = 0; t < nT; t++) {
      const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
      // segno binario: sul piano (d>=0) conta come "sopra". Cosi' evitiamo la
      // degenerazione quando il piano passa esattamente per dei vertici.
      const sa = dist[a] >= 0 ? 1 : -1;
      const sb = dist[b] >= 0 ? 1 : -1;
      const sc = dist[c] >= 0 ? 1 : -1;
      if (sa > 0 && sb > 0 && sc > 0) { idxAddTri(A, a, b, c); continue; }
      if (sa < 0 && sb < 0 && sc < 0) { idxAddTri(B, a, b, c); continue; }

      // triangolo attraversato: costruisci i poligoni sopra/sotto camminando i bordi
      const vs = [a, b, c], ss = [sa, sb, sc];
      const aboveV = [], belowV = [];
      const capPts = [];
      for (let e = 0; e < 3; e++) {
        const i = vs[e], j = vs[(e + 1) % 3];
        const si = ss[e], sj = ss[(e + 1) % 3];
        if (si > 0) aboveV.push({ orig: i }); else belowV.push({ orig: i });
        if (si !== sj) {
          const cp = cutPointPos(i, j);
          aboveV.push({ cut: cp });
          belowV.push({ cut: cp });
          capPts.push(cp);
        }
      }
      emitPoly(A, cutA, aboveV);
      emitPoly(B, cutB, belowV);
      if (capPts.length === 2) capSeg.push([capPts[0], capPts[1]]);
    }

    function idxAddTri(side, a, b, c) {
      side.idx.push(addOrig(side, a), addOrig(side, b), addOrig(side, c));
    }

    // TAPPO PIATTO della sezione: traccia i loop dei segmenti e triangola sul piano
    const capTris = capFromSegments(capSeg);
    // aggiungi il tappo ai due lati con verso opposto (facce piatte combacianti)
    for (const loop of capTris) {
      for (const tri of loop.tris) {
        const kA = tri.map((pt) => addCut(A, cutA, pt.key, pt.p));
        idxA.push(kA[0], kA[1], kA[2]);
        const kB = tri.map((pt) => addCut(B, cutB, pt.key, pt.p));
        idxB.push(kB[0], kB[2], kB[1]); // verso opposto
      }
    }

    // costruisce i triangoli-tappo (in punti 3D con chiave) dai segmenti
    function capFromSegments(segs) {
      if (segs.length === 0) return [];
      // grafo: chiave -> vicini (chiavi) con il punto
      const nodes = new Map(); // key -> p
      const adj = new Map();   // key -> [key,...]
      for (const [p1, p2] of segs) {
        nodes.set(p1.key, p1.p); nodes.set(p2.key, p2.p);
        if (!adj.has(p1.key)) adj.set(p1.key, []);
        if (!adj.has(p2.key)) adj.set(p2.key, []);
        adj.get(p1.key).push(p2.key); adj.get(p2.key).push(p1.key);
      }
      const visited = new Set();
      const results = [];
      for (const startKey of adj.keys()) {
        if (visited.has(startKey)) continue;
        // traccia una catena/loop
        const loopKeys = [];
        let cur = startKey, prev = null, guard = 0;
        while (cur !== undefined && !visited.has(cur) && guard++ < adj.size + 2) {
          visited.add(cur); loopKeys.push(cur);
          const neigh = adj.get(cur) || [];
          let next;
          for (const nb of neigh) { if (nb !== prev && !visited.has(nb)) { next = nb; break; } }
          prev = cur; cur = next;
        }
        if (loopKeys.length < 3) continue;
        const pts3 = loopKeys.map((k) => ({ key: k, p: nodes.get(k) }));
        // triangola sul piano usando la base (u,v) del piano di taglio
        const tris = triangulatePlanarLoop(pts3);
        if (tris.length) results.push({ tris });
      }
      return results;
    }

    function triangulatePlanarLoop(pts3) {
      // base ortonormale (u,v) sul piano
      let ux, uy, uz;
      if (Math.abs(nx) < 0.9) { ux = 1; uy = 0; uz = 0; } else { ux = 0; uy = 1; uz = 0; }
      const dd = ux * nx + uy * ny + uz * nz;
      ux -= dd * nx; uy -= dd * ny; uz -= dd * nz;
      const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
      const pts2 = pts3.map((o) => ({ x: o.p[0] * ux + o.p[1] * uy + o.p[2] * uz, y: o.p[0] * vx + o.p[1] * vy + o.p[2] * vz }));
      const localTris = MeshCore.earClipPolygon2D(pts2);
      return localTris.map(([i0, i1, i2]) => [pts3[i0], pts3[i1], pts3[i2]]);
    }

    return {
      above: { positions: Float64Array.from(posA), indices: Uint32Array.from(idxA) },
      below: { positions: Float64Array.from(posB), indices: Uint32Array.from(idxB) },
    };
  };

  // ---------------------------------------------------------------------
  // Statistiche: volume assoluto (mm^3), area superficiale, bbox
  // ---------------------------------------------------------------------
  MeshCore.computeStats = function (positions, indices) {
    let area = 0;
    const nTris = indices.length / 3;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length / 3; i++) {
      for (let k = 0; k < 3; k++) {
        const v = positions[i * 3 + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
    for (let t = 0; t < nTris; t++) {
      const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
      const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
      const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
      const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const crossx = uy * vz - uz * vy;
      const crossy = uz * vx - ux * vz;
      const crossz = ux * vy - uy * vx;
      area += 0.5 * Math.sqrt(crossx * crossx + crossy * crossy + crossz * crossz);
    }
    const volume = Math.abs(MeshCore.signedVolume(positions, indices));
    return { area, volume, bboxMin: min, bboxMax: max };
  };

  // ---------------------------------------------------------------------
  // Appoggio sul piano di stampa: trova la superficie PIANA dominante della
  // parte (tipicamente la faccia di taglio), ruota la parte in modo che
  // quella faccia guardi in basso (-Z, la verticale degli slicer) e la
  // appoggia a Z=0. Restituisce una COPIA delle posizioni trasformate.
  // ---------------------------------------------------------------------
  MeshCore.layFlat = function (positions, indices) {
    const nTris = indices.length / 3;
    if (nTris === 0) return { positions: Float64Array.from(positions) };

    // area e normale per faccia, aggregate per normale quantizzata (~3 gradi)
    const buckets = new Map(); // chiave -> [sommaArea, nx, ny, nz] (pesati per area)
    for (let t = 0; t < nTris; t++) {
      const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
      const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
      const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
      const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
      let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len < 1e-30) continue;
      const area = len / 2;
      nx /= len; ny /= len; nz /= len;
      const key = Math.round(nx * 20) + '_' + Math.round(ny * 20) + '_' + Math.round(nz * 20);
      let bkt = buckets.get(key);
      if (!bkt) { bkt = [0, 0, 0, 0]; buckets.set(key, bkt); }
      bkt[0] += area;
      bkt[1] += nx * area; bkt[2] += ny * area; bkt[3] += nz * area;
    }
    let best = null;
    buckets.forEach((bkt) => { if (!best || bkt[0] > best[0]) best = bkt; });
    if (!best) return { positions: Float64Array.from(positions) };
    let nx = best[1], ny = best[2], nz = best[3];
    let len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len; ny /= len; nz /= len;

    // rotazione (Rodrigues) che porta la normale dominante su (0,0,-1)
    const tx = 0, ty = 0, tz = -1;
    const axx = ny * tz - nz * ty;
    const axy = nz * tx - nx * tz;
    const axz = nx * ty - ny * tx;
    const s = Math.sqrt(axx * axx + axy * axy + axz * axz);
    const cth = nx * tx + ny * ty + nz * tz;
    let R;
    if (s < 1e-9) {
      R = cth > 0
        ? [1, 0, 0, 0, 1, 0, 0, 0, 1]
        : [1, 0, 0, 0, -1, 0, 0, 0, -1]; // 180 gradi attorno a X
    } else {
      const ux = axx / s, uy = axy / s, uz = axz / s;
      const c1 = 1 - cth;
      R = [
        cth + ux * ux * c1, ux * uy * c1 - uz * s, ux * uz * c1 + uy * s,
        uy * ux * c1 + uz * s, cth + uy * uy * c1, uy * uz * c1 - ux * s,
        uz * ux * c1 - uy * s, uz * uy * c1 + ux * s, cth + uz * uz * c1,
      ];
    }

    const out = new Float64Array(positions.length);
    let minZ = Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      out[i] = R[0] * x + R[1] * y + R[2] * z;
      out[i + 1] = R[3] * x + R[4] * y + R[5] * z;
      out[i + 2] = R[6] * x + R[7] * y + R[8] * z;
      if (out[i + 2] < minZ) minZ = out[i + 2];
    }
    for (let i = 2; i < out.length; i += 3) out[i] -= minZ;
    return { positions: out };
  };

  // ---------------------------------------------------------------------
  // Pipeline completa di riparazione di UNA sotto-mesh (gia' estratta):
  // saldatura locale (opzionale, i vertici sono gia' condivisi se provengono
  // da extractSubMesh), rimozione degeneri, orientamento coerente,
  // individuazione e chiusura dei buchi.
  // ---------------------------------------------------------------------
  MeshCore.repairMesh = function (positions, indices, options) {
    options = options || {};
    const log = [];
    // tolleranze relative alla dimensione del modello: il repair resta uguale
    // a qualsiasi scala/unita' di misura
    const tol = MeshCore.suggestTolerances(positions);
    const areaEpsilon = options.areaEpsilon === undefined ? tol.areaEpsilon : options.areaEpsilon;
    // epsilon per lo "zippering" dei bordi: un filo piu' largo del welding, cosi'
    // da cucire le crepe (cuciture non saldate) senza toccare i vertici interni
    const zipEpsilon = options.zipEpsilon === undefined ? tol.diag * 3e-5 : options.zipEpsilon;

    // 1) rimuovi i triangoli duplicati (causa principale degli edge non-manifold)
    const dedup = MeshCore.removeDuplicateFaces(indices);
    let idx = dedup.indices;
    if (dedup.removed > 0) log.push(`Rimossi ${dedup.removed} triangoli duplicati`);

    // 2) rimuovi i triangoli degeneri
    const nBeforeDeg = idx.length;
    const deg = MeshCore.removeDegenerateTriangles(positions, idx, areaEpsilon);
    idx = deg.indices;
    if (nBeforeDeg !== idx.length) {
      log.push(`Rimossi ${(nBeforeDeg - idx.length) / 3} triangoli degeneri`);
    }

    // 3) chiusura dei buchi in PIU' passate. Prima di ogni tentativo di
    //    triangolazione si "cuciono" i bordi vicini (zippering) e si tolgono
    //    gli eventuali triangoli diventati degeneri: cosi' le crepe sottili si
    //    saldano da sole e restano solo i buchi veri da tappare.
    let totalFlipped = 0;
    let totalHolesClosed = 0;
    let totalZipped = 0;
    let nonManifoldLogged = false;
    let edgeMap = null;
    const maxPasses = options.maxClosePasses === undefined ? 6 : options.maxClosePasses;
    // limite superiore per la cucitura: non oltre lo 0,2% della diagonale, per
    // non deformare la parte unendo bordi realmente distanti
    const zipEpsilonMax = options.zipEpsilonMax === undefined ? tol.diag * 2e-3 : options.zipEpsilonMax;
    for (let pass = 0; pass < maxPasses; pass++) {
      // zippering dei bordi quasi coincidenti: l'epsilon CRESCE a ogni passata
      // (prima le cuciture strette, poi le crepe piu' larghe), cosi' si chiude
      // di piu' mantenendo intatti i triangoli originali
      const passZip = Math.min(zipEpsilonMax, zipEpsilon * Math.pow(3, pass));
      const zip = MeshCore.weldBoundaryVertices(positions, idx, passZip);
      if (zip.merged > 0) {
        totalZipped += zip.merged;
        idx = MeshCore.removeDegenerateTriangles(positions, zip.indices, areaEpsilon).indices;
        idx = MeshCore.removeDuplicateFaces(idx).indices;
      }

      edgeMap = MeshCore.buildEdgeMap(idx);
      const winding = MeshCore.fixWindingConsistency(idx, edgeMap);
      totalFlipped += winding.flippedCount;
      // fixWindingConsistency modifica idx in place: le direzioni degli edge
      // registrate sopra sono obsolete, vanno ricalcolate prima dei loop
      edgeMap = MeshCore.buildEdgeMap(idx);

      if (!nonManifoldLogged) {
        let nonManifold = 0;
        edgeMap.forEach((occ) => { if (occ.length > 2) nonManifold++; });
        if (nonManifold > 0) log.push(`Attenzione: ${nonManifold} edge non-manifold rilevati (geometria complessa)`);
        nonManifoldLogged = true;
      }

      const boundary = MeshCore.traceBoundaryLoops(idx, edgeMap);
      if (boundary.totalBoundaryEdges === 0) break;

      let newTriangles = [];
      let newVerts = [];
      let nextVertIndex = positions.length / 3;
      let holesClosed = 0;
      for (const loop of boundary.loops) {
        const cap = MeshCore.triangulateLoop(positions, loop, { newVertexIndex: nextVertIndex });
        if (cap.indices.length > 0) {
          if (cap.newVertex) {
            newVerts.push(cap.newVertex[0], cap.newVertex[1], cap.newVertex[2]);
            nextVertIndex++;
          }
          newTriangles = newTriangles.concat(cap.indices);
          holesClosed++;
        }
      }
      if (holesClosed === 0) break; // nessun progresso possibile
      totalHolesClosed += holesClosed;
      // fai crescere il buffer positions con gli eventuali baricentri aggiunti
      if (newVerts.length > 0) {
        const grown = new Float64Array(positions.length + newVerts.length);
        grown.set(positions);
        grown.set(newVerts, positions.length);
        positions = grown;
      }
      const merged = new Uint32Array(idx.length + newTriangles.length);
      merged.set(idx);
      merged.set(newTriangles, idx.length);
      idx = merged;
    }
    if (totalZipped > 0) log.push(`Cuciti ${totalZipped} vertici di bordo (crepe/cuciture)`);
    if (totalFlipped > 0) log.push(`Corretto orientamento di ${totalFlipped} triangoli`);
    if (totalHolesClosed > 0) log.push(`Chiusi ${totalHolesClosed} buchi`);

    // 4) orienta tutto verso l'esterno usando le componenti connesse finali
    const finalIndices = idx;
    edgeMap = MeshCore.buildEdgeMap(finalIndices);
    MeshCore.fixWindingConsistency(finalIndices, edgeMap);
    const comp = MeshCore.connectedComponents(finalIndices, edgeMap);
    MeshCore.orientOutward(positions, finalIndices, comp.faceComponentId, comp.componentCount);

    const finalBoundary = MeshCore.traceBoundaryLoops(finalIndices, edgeMap);
    const watertight = finalBoundary.totalBoundaryEdges === 0;
    log.push(watertight ? 'Mesh chiusa (watertight)' : `Mesh ancora aperta: ${finalBoundary.totalBoundaryEdges} edge di bordo residui`);

    const stats = MeshCore.computeStats(positions, finalIndices);

    return { positions, indices: finalIndices, log, watertight, stats };
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MeshCore;
  } else {
    root.MeshCore = MeshCore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
