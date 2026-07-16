/*
 * export.js
 * Scrittura STL binario e di un file ZIP (metodo "store", senza compressione)
 * senza dipendenze esterne, per l'esportazione delle parti segmentate.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Exporter = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const Exporter = {};

  // ---------------------------------------------------------------------
  // STL binario
  // ---------------------------------------------------------------------
  Exporter.buildBinarySTL = function (positions, indices, name) {
    const nTris = indices.length / 3;
    const buffer = new ArrayBuffer(84 + nTris * 50);
    const view = new DataView(buffer);
    const header = (name || 'modello').slice(0, 79);
    for (let i = 0; i < header.length; i++) view.setUint8(i, header.charCodeAt(i));
    view.setUint32(80, nTris, true);

    let offset = 84;
    for (let t = 0; t < nTris; t++) {
      const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
      const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
      const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
      const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len; ny /= len; nz /= len;

      view.setFloat32(offset, nx, true); view.setFloat32(offset + 4, ny, true); view.setFloat32(offset + 8, nz, true);
      offset += 12;
      view.setFloat32(offset, ax, true); view.setFloat32(offset + 4, ay, true); view.setFloat32(offset + 8, az, true);
      offset += 12;
      view.setFloat32(offset, bx, true); view.setFloat32(offset + 4, by, true); view.setFloat32(offset + 8, bz, true);
      offset += 12;
      view.setFloat32(offset, cx, true); view.setFloat32(offset + 4, cy, true); view.setFloat32(offset + 8, cz, true);
      offset += 12;
      view.setUint16(offset, 0, true);
      offset += 2;
    }
    return new Uint8Array(buffer);
  };

  // ---------------------------------------------------------------------
  // CRC32 (tabella standard)
  // ---------------------------------------------------------------------
  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  Exporter.crc32 = crc32;

  // ---------------------------------------------------------------------
  // ZIP (metodo store, nessuna compressione) — bastano header locali +
  // central directory + EOCD, sufficiente per file fino a poche decine di MB.
  // files: [{ name: string, data: Uint8Array }]
  // ---------------------------------------------------------------------
  Exporter.buildZip = function (files) {
    const encoder = new TextEncoder();
    const encodedNames = files.map((f) => encoder.encode(f.name));
    const crcs = files.map((f) => crc32(f.data));

    let localSize = 0;
    let centralSize = 0;
    files.forEach((f, i) => {
      localSize += 30 + encodedNames[i].length + f.data.length;
      centralSize += 46 + encodedNames[i].length;
    });
    const totalSize = localSize + centralSize + 22;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 0;
    const localOffsets = [];

    // DOS date/time fissi (irrilevanti per l'uso pratico)
    const dosTime = 0;
    const dosDate = (1 << 5) | 1; // 1 gennaio, anno base

    files.forEach((f, i) => {
      localOffsets.push(offset);
      const nameBytes = encodedNames[i];
      view.setUint32(offset, 0x04034b50, true); offset += 4;
      view.setUint16(offset, 20, true); offset += 2; // version needed
      view.setUint16(offset, 0, true); offset += 2; // flags
      view.setUint16(offset, 0, true); offset += 2; // method = store
      view.setUint16(offset, dosTime, true); offset += 2;
      view.setUint16(offset, dosDate, true); offset += 2;
      view.setUint32(offset, crcs[i], true); offset += 4;
      view.setUint32(offset, f.data.length, true); offset += 4; // compressed size
      view.setUint32(offset, f.data.length, true); offset += 4; // uncompressed size
      view.setUint16(offset, nameBytes.length, true); offset += 2;
      view.setUint16(offset, 0, true); offset += 2; // extra length
      bytes.set(nameBytes, offset); offset += nameBytes.length;
      bytes.set(f.data, offset); offset += f.data.length;
    });

    const centralStart = offset;
    files.forEach((f, i) => {
      const nameBytes = encodedNames[i];
      view.setUint32(offset, 0x02014b50, true); offset += 4;
      view.setUint16(offset, 20, true); offset += 2; // version made by
      view.setUint16(offset, 20, true); offset += 2; // version needed
      view.setUint16(offset, 0, true); offset += 2; // flags
      view.setUint16(offset, 0, true); offset += 2; // method
      view.setUint16(offset, dosTime, true); offset += 2;
      view.setUint16(offset, dosDate, true); offset += 2;
      view.setUint32(offset, crcs[i], true); offset += 4;
      view.setUint32(offset, f.data.length, true); offset += 4;
      view.setUint32(offset, f.data.length, true); offset += 4;
      view.setUint16(offset, nameBytes.length, true); offset += 2;
      view.setUint16(offset, 0, true); offset += 2; // extra length
      view.setUint16(offset, 0, true); offset += 2; // comment length
      view.setUint16(offset, 0, true); offset += 2; // disk number start
      view.setUint16(offset, 0, true); offset += 2; // internal attrs
      view.setUint32(offset, 0, true); offset += 4; // external attrs
      view.setUint32(offset, localOffsets[i], true); offset += 4;
      bytes.set(nameBytes, offset); offset += nameBytes.length;
    });
    const centralSizeActual = offset - centralStart;

    view.setUint32(offset, 0x06054b50, true); offset += 4;
    view.setUint16(offset, 0, true); offset += 2; // disk number
    view.setUint16(offset, 0, true); offset += 2; // disk with cd
    view.setUint16(offset, files.length, true); offset += 2;
    view.setUint16(offset, files.length, true); offset += 2;
    view.setUint32(offset, centralSizeActual, true); offset += 4;
    view.setUint32(offset, centralStart, true); offset += 4;
    view.setUint16(offset, 0, true); offset += 2; // comment length

    return bytes;
  };

  return Exporter;
});
