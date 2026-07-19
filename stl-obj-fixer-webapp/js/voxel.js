/*
 * voxel.js
 * Solidificazione a voxel ("Make Solid"): trasforma una mesh qualsiasi —
 * anche aperta, non-manifold, con gusci compenetrati (tipico dei modelli IA) —
 * in un SOLIDO chiuso, watertight e manifold. Funziona rasterizzando la
 * superficie in una griglia, riempiendo l'interno (flood-fill dell'esterno) ed
 * estraendo la nuova superficie con Surface Nets. La risoluzione della griglia
 * agisce da tolleranza: le crepe/buchi piu' piccoli di un voxel vengono
 * sigillati automaticamente. Lo stesso campo a voxel rende le operazioni
 * booleane (connettori: perno + foro) esatte e sempre chiuse.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./geometry-core.js'));
  } else {
    root.Voxel = factory(root.MeshCore);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (MeshCore) {
  'use strict';
  const Voxel = {};

  // --- tabelle Surface Nets (naive, di dominio pubblico, M. Lysenko) ---
  const cubeEdges = new Int32Array(24);
  const edgeTable = new Int32Array(256);
  (function () {
    let k = 0;
    for (let i = 0; i < 8; ++i) {
      for (let j = 1; j <= 4; j <<= 1) {
        const p = i ^ j;
        if (i <= p) { cubeEdges[k++] = i; cubeEdges[k++] = p; }
      }
    }
    for (let i = 0; i < 256; ++i) {
      let em = 0;
      for (let j = 0; j < 24; j += 2) {
        const a = !!(i & (1 << cubeEdges[j]));
        const b = !!(i & (1 << cubeEdges[j + 1]));
        em |= a !== b ? (1 << (j >> 1)) : 0;
      }
      edgeTable[i] = em;
    }
  })();

  // Estrae la superficie iso-0 da un campo scalare (dentro se < 0) su griglia
  // di punti dims=[nx,ny,nz]; layout data[x + y*nx + z*nx*ny].
  // Restituisce vertici (coord. di griglia) e facce (quad, 4 indici).
  Voxel.surfaceNets = function (data, dims) {
    const vertices = [];
    const faces = [];
    const dx = dims[0], dy = dims[1];
    // strides della griglia dati (per leggere il campo)
    // strides del buffer dei vertici del layer precedente (griglia "+1")
    const R = [1, dx + 1, (dx + 1) * (dy + 1)];
    const buffer = new Int32Array(R[2] * 2);
    let bufNo = 1;
    let n = 0;
    const grid = new Float32Array(8);
    const x = [0, 0, 0];

    for (x[2] = 0; x[2] < dims[2] - 1; ++x[2], n += dx, bufNo ^= 1, R[2] = -R[2]) {
      let m = 1 + (dx + 1) * (1 + bufNo * (dy + 1));
      for (x[1] = 0; x[1] < dims[1] - 1; ++x[1], ++n, m += 2) {
        for (x[0] = 0; x[0] < dims[0] - 1; ++x[0], ++n, ++m) {
          let mask = 0, g = 0, idx = n;
          for (let k = 0; k < 2; ++k, idx += dx * (dy - 2)) {
            for (let j = 0; j < 2; ++j, idx += dx - 2) {
              for (let i = 0; i < 2; ++i, ++g, ++idx) {
                const p = data[idx];
                grid[g] = p;
                mask |= (p < 0) ? (1 << g) : 0;
              }
            }
          }
          if (mask === 0 || mask === 0xff) continue;
          const em = edgeTable[mask];
          const v = [0, 0, 0];
          let eCount = 0;
          for (let i = 0; i < 12; ++i) {
            if (!(em & (1 << i))) continue;
            ++eCount;
            const e0 = cubeEdges[i << 1], e1 = cubeEdges[(i << 1) + 1];
            const g0 = grid[e0], g1 = grid[e1];
            let t = g0 - g1;
            if (Math.abs(t) > 1e-6) t = g0 / t; else continue;
            for (let j = 0, kk = 1; j < 3; ++j, kk <<= 1) {
              const a = e0 & kk, b = e1 & kk;
              if (a !== b) v[j] += a ? 1 - t : t;
              else v[j] += a ? 1 : 0;
            }
          }
          const s = 1 / eCount;
          for (let i = 0; i < 3; ++i) v[i] = x[i] + s * v[i];
          buffer[m] = vertices.length;
          vertices.push([v[0], v[1], v[2]]);

          for (let i = 0; i < 3; ++i) {
            if (!(em & (1 << i))) continue;
            const iu = (i + 1) % 3, iv = (i + 2) % 3;
            if (x[iu] === 0 || x[iv] === 0) continue;
            const du = R[iu], dv = R[iv];
            if (mask & 1) {
              faces.push([buffer[m], buffer[m - du], buffer[m - du - dv], buffer[m - dv]]);
            } else {
              faces.push([buffer[m], buffer[m - dv], buffer[m - du - dv], buffer[m - du]]);
            }
          }
        }
      }
    }
    return { vertices, faces };
  };

  // Costruisce il campo solido (dentro/fuori) rasterizzando la superficie e
  // riempiendo l'interno. options.resolution = voxel lungo il lato piu' lungo.
  Voxel.buildSolidField = function (positions, indices, options) {
    options = options || {};
    let minx = Infinity, miny = Infinity, minz = Infinity;
    let maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      if (z < minz) minz = z; if (z > maxz) maxz = z;
    }
    // estende il volume per contenere eventuali aggiunte (perni) che sporgono
    // oltre la mesh: senza questo la parte aggiunta finirebbe fuori griglia
    if (options.includeMin && options.includeMax) {
      minx = Math.min(minx, options.includeMin[0]); miny = Math.min(miny, options.includeMin[1]); minz = Math.min(minz, options.includeMin[2]);
      maxx = Math.max(maxx, options.includeMax[0]); maxy = Math.max(maxy, options.includeMax[1]); maxz = Math.max(maxz, options.includeMax[2]);
    }
    const sx = maxx - minx, sy = maxy - miny, sz = maxz - minz;
    const maxDim = Math.max(sx, sy, sz) || 1;
    const targetN = options.resolution || 110;
    let voxel = maxDim / targetN;
    const maxPoints = options.maxPoints || 7000000;
    const pad = 3;
    let nx, ny, nz;
    function dims() {
      nx = Math.ceil(sx / voxel) + 2 * pad + 1;
      ny = Math.ceil(sy / voxel) + 2 * pad + 1;
      nz = Math.ceil(sz / voxel) + 2 * pad + 1;
    }
    dims();
    while (nx * ny * nz > maxPoints) { voxel *= 1.18; dims(); }
    const ox = minx - pad * voxel, oy = miny - pad * voxel, oz = minz - pad * voxel;
    const N = nx * ny * nz;
    const inv = 1 / voxel;
    const surf = new Uint8Array(N);

    function mark(px, py, pz) {
      const ix = Math.round((px - ox) * inv);
      const iy = Math.round((py - oy) * inv);
      const iz = Math.round((pz - oz) * inv);
      if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) return;
      surf[ix + iy * nx + iz * nx * ny] = 1;
    }

    const nTris = indices.length / 3;
    for (let t = 0; t < nTris; t++) {
      const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
      const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
      const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
      const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
      const lAB = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2);
      const lAC = Math.sqrt((cx - ax) ** 2 + (cy - ay) ** 2 + (cz - az) ** 2);
      const steps = Math.max(1, Math.ceil(Math.max(lAB, lAC) * inv * 2));
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        for (let j = 0; j <= steps - i; j++) {
          const w = j / steps;
          mark(ax + (bx - ax) * u + (cx - ax) * w,
            ay + (by - ay) * u + (cy - ay) * w,
            az + (bz - az) * u + (cz - az) * w);
        }
      }
    }

    // flood-fill dell'esterno partendo dall'angolo (dentro il padding)
    const ext = new Uint8Array(N);
    const stack = new Int32Array(N);
    let sp = 0;
    stack[sp++] = 0; ext[0] = 1;
    const nxy = nx * ny;
    while (sp > 0) {
      const p = stack[--sp];
      const z = (p / nxy) | 0;
      const rem = p - z * nxy;
      const y = (rem / nx) | 0;
      const xx = rem - y * nx;
      if (xx > 0) { const q = p - 1; if (!surf[q] && !ext[q]) { ext[q] = 1; stack[sp++] = q; } }
      if (xx < nx - 1) { const q = p + 1; if (!surf[q] && !ext[q]) { ext[q] = 1; stack[sp++] = q; } }
      if (y > 0) { const q = p - nx; if (!surf[q] && !ext[q]) { ext[q] = 1; stack[sp++] = q; } }
      if (y < ny - 1) { const q = p + nx; if (!surf[q] && !ext[q]) { ext[q] = 1; stack[sp++] = q; } }
      if (z > 0) { const q = p - nxy; if (!surf[q] && !ext[q]) { ext[q] = 1; stack[sp++] = q; } }
      if (z < nz - 1) { const q = p + nxy; if (!surf[q] && !ext[q]) { ext[q] = 1; stack[sp++] = q; } }
    }

    const data = new Float32Array(N);
    for (let i = 0; i < N; i++) data[i] = (surf[i] || !ext[i]) ? -1 : 1;

    return { data, dims: [nx, ny, nz], origin: [ox, oy, oz], voxel };
  };

  // Smoothing laplaciano: sposta ogni vertice verso la media dei vicini per
  // ammorbidire la "scalinatura" del voxel, mantenendo la mesh chiusa.
  Voxel.laplacianSmooth = function (positions, indices, iterations, factor) {
    iterations = iterations || 0;
    factor = factor === undefined ? 0.5 : factor;
    if (iterations <= 0) return positions;
    const nV = positions.length / 3;
    const neighbors = Array.from({ length: nV }, () => new Set());
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t], b = indices[t + 1], c = indices[t + 2];
      neighbors[a].add(b); neighbors[a].add(c);
      neighbors[b].add(a); neighbors[b].add(c);
      neighbors[c].add(a); neighbors[c].add(b);
    }
    let pos = Float64Array.from(positions);
    for (let it = 0; it < iterations; it++) {
      const out = Float64Array.from(pos);
      for (let v = 0; v < nV; v++) {
        const nb = neighbors[v];
        if (nb.size === 0) continue;
        let sx = 0, sy = 0, sz = 0;
        nb.forEach((w) => { sx += pos[w * 3]; sy += pos[w * 3 + 1]; sz += pos[w * 3 + 2]; });
        const inv = 1 / nb.size;
        out[v * 3] = pos[v * 3] + factor * (sx * inv - pos[v * 3]);
        out[v * 3 + 1] = pos[v * 3 + 1] + factor * (sy * inv - pos[v * 3 + 1]);
        out[v * 3 + 2] = pos[v * 3 + 2] + factor * (sz * inv - pos[v * 3 + 2]);
      }
      pos = out;
    }
    return pos;
  };

  // Estrae la mesh dal campo (Surface Nets -> coord mondo -> smoothing ->
  // orientamento -> statistiche). Condiviso da remesh e applyEdits.
  function finishField(field, options) {
    const sn = Voxel.surfaceNets(field.data, field.dims);
    const nV = sn.vertices.length;
    const outPos = new Float64Array(nV * 3);
    for (let i = 0; i < nV; i++) {
      outPos[i * 3] = field.origin[0] + sn.vertices[i][0] * field.voxel;
      outPos[i * 3 + 1] = field.origin[1] + sn.vertices[i][1] * field.voxel;
      outPos[i * 3 + 2] = field.origin[2] + sn.vertices[i][2] * field.voxel;
    }
    const idxArr = [];
    for (const q of sn.faces) idxArr.push(q[0], q[1], q[2], q[0], q[2], q[3]);
    let P = outPos;
    let I = Uint32Array.from(idxArr);
    const smooth = options.smoothIterations === undefined ? 2 : options.smoothIterations;
    if (smooth > 0) P = Voxel.laplacianSmooth(P, I, smooth);
    let watertight = true;
    if (I.length > 0) {
      let edgeMap = MeshCore.buildEdgeMap(I);
      MeshCore.fixWindingConsistency(I, edgeMap);
      edgeMap = MeshCore.buildEdgeMap(I);
      const comp = MeshCore.connectedComponents(I, edgeMap);
      MeshCore.orientOutward(P, I, comp.faceComponentId, comp.componentCount);
      const boundary = MeshCore.traceBoundaryLoops(I, edgeMap);
      watertight = boundary.totalBoundaryEdges === 0;
    }
    const stats = MeshCore.computeStats(P, I);
    return { positions: P, indices: I, watertight, stats, voxel: field.voxel };
  }

  // Solidifica una mesh: campo -> Surface Nets -> mesh chiusa in coord. mondo.
  Voxel.remesh = function (positions, indices, options) {
    options = options || {};
    const field = Voxel.buildSolidField(positions, indices, options);
    return finishField(field, options);
  };

  // "Timbra" un cilindro nel campo: mode 'add' (perno: mette solido) o 'sub'
  // (foro: toglie solido). p0,p1 = estremi dell'asse in coordinate mondo.
  // La booleana e' esatta perche' avviene sulla griglia discreta.
  Voxel.stampCylinder = function (field, p0, p1, radius, mode) {
    const { data, dims, origin, voxel } = field;
    const nx = dims[0], ny = dims[1], nz = dims[2];
    const inv = 1 / voxel;
    const val = mode === 'sub' ? 1 : -1;
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const len2 = ax * ax + ay * ay + az * az || 1e-12;
    // AABB del cilindro in coordinate di griglia
    const minx = Math.min(p0[0], p1[0]) - radius, maxx = Math.max(p0[0], p1[0]) + radius;
    const miny = Math.min(p0[1], p1[1]) - radius, maxy = Math.max(p0[1], p1[1]) + radius;
    const minz = Math.min(p0[2], p1[2]) - radius, maxz = Math.max(p0[2], p1[2]) + radius;
    const gx0 = Math.max(0, Math.floor((minx - origin[0]) * inv));
    const gx1 = Math.min(nx - 1, Math.ceil((maxx - origin[0]) * inv));
    const gy0 = Math.max(0, Math.floor((miny - origin[1]) * inv));
    const gy1 = Math.min(ny - 1, Math.ceil((maxy - origin[1]) * inv));
    const gz0 = Math.max(0, Math.floor((minz - origin[2]) * inv));
    const gz1 = Math.min(nz - 1, Math.ceil((maxz - origin[2]) * inv));
    const r2 = radius * radius;
    const nxy = nx * ny;
    for (let gz = gz0; gz <= gz1; gz++) {
      const wz = origin[2] + gz * voxel;
      for (let gy = gy0; gy <= gy1; gy++) {
        const wy = origin[1] + gy * voxel;
        for (let gx = gx0; gx <= gx1; gx++) {
          const wx = origin[0] + gx * voxel;
          // proiezione del punto sull'asse del cilindro
          const t = ((wx - p0[0]) * ax + (wy - p0[1]) * ay + (wz - p0[2]) * az) / len2;
          if (t < 0 || t > 1) continue;
          const cx = p0[0] + ax * t, cy = p0[1] + ay * t, cz = p0[2] + az * t;
          const d2 = (wx - cx) ** 2 + (wy - cy) ** 2 + (wz - cz) ** 2;
          if (d2 <= r2) data[gx + gy * nx + gz * nxy] = val;
        }
      }
    }
  };

  // Solidifica una mesh e applica una lista di modifiche booleane (cilindri),
  // poi ri-estrae la superficie: usato per i connettori (perno/foro).
  // edits: [{ p0, p1, radius, mode:'add'|'sub' }]
  Voxel.applyEdits = function (positions, indices, edits, options) {
    options = options || {};
    // la griglia deve contenere anche i perni (add) che sporgono oltre la mesh
    let mn = null, mx = null;
    for (const e of edits) {
      if (e.mode !== 'add') continue;
      const lo = [Math.min(e.p0[0], e.p1[0]) - e.radius, Math.min(e.p0[1], e.p1[1]) - e.radius, Math.min(e.p0[2], e.p1[2]) - e.radius];
      const hi = [Math.max(e.p0[0], e.p1[0]) + e.radius, Math.max(e.p0[1], e.p1[1]) + e.radius, Math.max(e.p0[2], e.p1[2]) + e.radius];
      if (!mn) { mn = lo.slice(); mx = hi.slice(); }
      else { for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], lo[k]); mx[k] = Math.max(mx[k], hi[k]); } }
    }
    const opt = Object.assign({}, options);
    if (mn) { opt.includeMin = mn; opt.includeMax = mx; }
    const field = Voxel.buildSolidField(positions, indices, opt);
    for (const e of edits) Voxel.stampCylinder(field, e.p0, e.p1, e.radius, e.mode);
    return finishField(field, opt);
  };

  return Voxel;
});
