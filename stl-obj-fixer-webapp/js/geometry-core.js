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

  MeshCore.earClipPolygon2D = function (ptsIn) {
    let pts = ptsIn.slice();
    let order = pts.map((_, i) => i);
    const area = polygonSignedArea(pts);
    let reversed = false;
    if (area < 0) { order.reverse(); reversed = true; }

    const triangles = [];
    let ring = order.slice();
    let guard = 0;
    const maxGuard = ring.length * ring.length + 16;

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
      if (!earFound) break; // poligono non semplice: interrompi, fallback sotto
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
    return triangles;
  };

  // ---------------------------------------------------------------------
  // Chiude un loop di bordo con una "toppa" triangolata, coerente con la
  // direzione del loop (che a sua volta riflette l'orientamento del guscio).
  // loopVertexIndices: indici globali nel buffer positions.
  // Restituisce array piatto di nuovi indici di triangoli (globali).
  // ---------------------------------------------------------------------
  MeshCore.triangulateLoop = function (positions, loopVertexIndices) {
    const n = loopVertexIndices.length;
    if (n < 3) return [];
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
    if (len < 1e-12) return []; // loop degenere
    nx /= len; ny /= len; nz /= len;

    // base locale (u,v) ortogonale alla normale
    let ux, uy, uz;
    if (Math.abs(nx) < 0.9) { ux = 1; uy = 0; uz = 0; } else { ux = 0; uy = 1; uz = 0; }
    // u = normalize(up - (up.n)n)
    const d = ux * nx + uy * ny + uz * nz;
    ux -= d * nx; uy -= d * ny; uz -= d * nz;
    len = Math.sqrt(ux * ux + uy * uy + uz * uz);
    ux /= len; uy /= len; uz /= len;
    const vx = ny * uz - nz * uy;
    const vy = nz * ux - nx * uz;
    const vz = nx * uy - ny * ux;

    const pts2 = pts3.map(([x, y, z]) => ({ x: x * ux + y * uy + z * uz, y: x * vx + y * vy + z * vz }));

    const localTris = MeshCore.earClipPolygon2D(pts2);
    const outIndices = [];
    for (const [i0, i1, i2] of localTris) {
      outIndices.push(loopVertexIndices[i0], loopVertexIndices[i1], loopVertexIndices[i2]);
    }
    return outIndices;
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

    // 1) rimuovi i triangoli duplicati (causa principale degli edge non-manifold)
    const dedup = MeshCore.removeDuplicateFaces(indices);
    let idx = dedup.indices;
    if (dedup.removed > 0) log.push(`Rimossi ${dedup.removed} triangoli duplicati`);

    // 2) rimuovi i triangoli degeneri
    const nBeforeDeg = idx.length;
    const deg = MeshCore.removeDegenerateTriangles(positions, idx, options.areaEpsilon);
    idx = deg.indices;
    if (nBeforeDeg !== idx.length) {
      log.push(`Rimossi ${(nBeforeDeg - idx.length) / 3} triangoli degeneri`);
    }

    // 3) chiusura dei buchi in PIU' passate: le toppe aggiunte in una passata
    //    creano nuovi spigoli che possono permettere di chiudere altri loop
    //    alla passata successiva (tipico delle mesh con giunzioni difettose).
    let totalFlipped = 0;
    let totalHolesClosed = 0;
    let nonManifoldLogged = false;
    let edgeMap = null;
    const maxPasses = options.maxClosePasses === undefined ? 3 : options.maxClosePasses;
    for (let pass = 0; pass < maxPasses; pass++) {
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
      let holesClosed = 0;
      for (const loop of boundary.loops) {
        const capIndices = MeshCore.triangulateLoop(positions, loop);
        if (capIndices.length > 0) {
          newTriangles = newTriangles.concat(capIndices);
          holesClosed++;
        }
      }
      if (holesClosed === 0) break; // nessun progresso possibile
      totalHolesClosed += holesClosed;
      const merged = new Uint32Array(idx.length + newTriangles.length);
      merged.set(idx);
      merged.set(newTriangles, idx.length);
      idx = merged;
    }
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
