/*
 * parsers.js
 * Parser leggeri e indipendenti dal browser per STL (ASCII/binario) e OBJ+MTL.
 * Restituiscono sempre lo stesso formato "triangle soup con colore":
 *   {
 *     rawPositions: Float64Array [x,y,z, x,y,z, ...]  (3 vertici per triangolo)
 *     rawColors:    Float32Array [r,g,b, r,g,b, ...]  (stesso layout, 0..1) oppure null
 *     rawGroupName: string[nTriangoli] oppure null    (nome materiale/gruppo per triangolo)
 *     hasColorInfo: boolean
 *     hasMaterialInfo: boolean
 *   }
 */
(function (root) {
  'use strict';
  const Parsers = {};

  // ---------------------------------------------------------------------
  // STL
  // ---------------------------------------------------------------------
  function isLikelyAsciiSTL(buffer) {
    const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 512));
    let text = '';
    for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
    return /^\s*solid\b/i.test(text) && text.toLowerCase().includes('facet');
  }

  function parseSTLBinary(buffer) {
    const view = new DataView(buffer);
    const nTris = view.getUint32(80, true);
    const expected = 84 + nTris * 50;
    const rawPositions = new Float64Array(nTris * 9);
    let offset = 84;
    for (let t = 0; t < nTris; t++) {
      offset += 12; // salta la normale dichiarata (la ricalcoliamo noi)
      for (let v = 0; v < 3; v++) {
        rawPositions[t * 9 + v * 3] = view.getFloat32(offset, true);
        rawPositions[t * 9 + v * 3 + 1] = view.getFloat32(offset + 4, true);
        rawPositions[t * 9 + v * 3 + 2] = view.getFloat32(offset + 8, true);
        offset += 12;
      }
      offset += 2; // attribute byte count
    }
    return {
      rawPositions,
      rawColors: null,
      rawGroupName: null,
      hasColorInfo: false,
      hasMaterialInfo: false,
      truncated: buffer.byteLength < expected,
    };
  }

  function parseSTLAscii(text) {
    const positions = [];
    const vertexRe = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
    let m;
    while ((m = vertexRe.exec(text)) !== null) {
      positions.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    }
    return {
      rawPositions: Float64Array.from(positions),
      rawColors: null,
      rawGroupName: null,
      hasColorInfo: false,
      hasMaterialInfo: false,
      truncated: false,
    };
  }

  Parsers.parseSTL = function (arrayBuffer) {
    if (isLikelyAsciiSTL(arrayBuffer)) {
      const decoder = new TextDecoder('utf-8');
      return parseSTLAscii(decoder.decode(arrayBuffer));
    }
    return parseSTLBinary(arrayBuffer);
  };

  // ---------------------------------------------------------------------
  // MTL (materiali OBJ)
  // ---------------------------------------------------------------------
  Parsers.parseMTL = function (text) {
    const materials = new Map(); // name -> {r,g,b}
    let current = null;
    const lines = text.split('\n');
    for (let raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split(/\s+/);
      const key = parts[0].toLowerCase();
      if (key === 'newmtl') {
        current = parts.slice(1).join(' ');
        materials.set(current, { r: 0.8, g: 0.8, b: 0.8 });
      } else if (key === 'kd' && current) {
        const r = parseFloat(parts[1]);
        const g = parseFloat(parts[2]);
        const b = parseFloat(parts[3]);
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
          materials.set(current, { r, g, b });
        }
      }
    }
    return materials;
  };

  // ---------------------------------------------------------------------
  // OBJ
  // materialsMap: Map opzionale nome->{r,g,b} da MTL gia' parsato
  // ---------------------------------------------------------------------
  Parsers.parseOBJ = function (text, materialsMap) {
    materialsMap = materialsMap || new Map();
    const v = []; // vertici [x,y,z]
    const vColor = []; // colore per-vertice opzionale [r,g,b] o null per indice
    let anyVertexColor = false;

    const rawPositions = [];
    const rawColors = [];
    const rawGroupName = [];
    let materialNamesUsed = new Set();

    let currentMaterial = null;

    const lines = text.split('\n');
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li].trim();
      if (!line || line[0] === '#') continue;
      const sp = line.indexOf(' ');
      const key = (sp === -1 ? line : line.slice(0, sp)).toLowerCase();
      const rest = sp === -1 ? '' : line.slice(sp + 1).trim();

      if (key === 'v') {
        const nums = rest.split(/\s+/).map(Number);
        v.push([nums[0], nums[1], nums[2]]);
        if (nums.length >= 6) {
          vColor.push([nums[3], nums[4], nums[5]]);
          anyVertexColor = true;
        } else {
          vColor.push(null);
        }
      } else if (key === 'usemtl') {
        currentMaterial = rest;
        materialNamesUsed.add(currentMaterial);
      } else if (key === 'f') {
        // formati supportati: "v", "v/vt", "v/vt/vn", "v//vn"
        const tokens = rest.split(/\s+/).filter(Boolean).map((tok) => {
          const vi = parseInt(tok.split('/')[0], 10);
          return vi < 0 ? v.length + vi : vi - 1; // supporta indici negativi (relativi)
        });
        // fan-triangulation per facce con piu' di 3 vertici
        for (let k = 1; k < tokens.length - 1; k++) {
          const triIdx = [tokens[0], tokens[k], tokens[k + 1]];
          for (const vi of triIdx) {
            const p = v[vi];
            if (!p) { rawPositions.push(0, 0, 0); continue; }
            rawPositions.push(p[0], p[1], p[2]);
          }
          let color = null;
          if (currentMaterial && materialsMap.has(currentMaterial)) {
            color = materialsMap.get(currentMaterial);
          } else if (anyVertexColor) {
            const c0 = vColor[triIdx[0]] || [0.8, 0.8, 0.8];
            const c1 = vColor[triIdx[1]] || [0.8, 0.8, 0.8];
            const c2 = vColor[triIdx[2]] || [0.8, 0.8, 0.8];
            color = {
              r: (c0[0] + c1[0] + c2[0]) / 3,
              g: (c0[1] + c1[1] + c2[1]) / 3,
              b: (c0[2] + c1[2] + c2[2]) / 3,
            };
          }
          if (color) {
            rawColors.push(color.r, color.g, color.b);
          } else {
            rawColors.push(0.8, 0.8, 0.8);
          }
          rawGroupName.push(currentMaterial || null);
        }
      }
    }

    const hasMaterialInfo = materialNamesUsed.size > 0 && [...materialNamesUsed].some((n) => materialsMap.has(n));
    const hasColorInfo = hasMaterialInfo || anyVertexColor;

    return {
      rawPositions: Float64Array.from(rawPositions),
      rawColors: hasColorInfo ? Float32Array.from(rawColors) : null,
      rawGroupName: hasMaterialInfo ? rawGroupName : null,
      hasColorInfo,
      hasMaterialInfo,
      materialCount: materialNamesUsed.size,
    };
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Parsers;
  } else {
    root.Parsers = Parsers;
  }
})(typeof window !== 'undefined' ? window : globalThis);
