/*
 * texture.js
 * Decodifica un'immagine texture (PNG/JPG) e campiona il colore per ogni
 * triangolo in base al centroide delle sue coordinate UV. Richiede API
 * browser (Canvas/Image): non e' portabile/testabile in Node come
 * geometry-core.js e parsers.js.
 */
(function (root) {
  'use strict';
  const TextureSampler = {};

  TextureSampler.decodeImageFile = function (file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          resolve(imageData);
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Impossibile decodificare il file immagine (formato non supportato o file corrotto)'));
      };
      img.src = url;
    });
  };

  // rawUV: Float32Array [u,v, u,v, ...] centroide per triangolo (convenzione OBJ: v=0 in basso)
  TextureSampler.sampleTriangleColors = function (imageData, rawUV, nTris) {
    const { width, height, data } = imageData;
    const colors = new Float32Array(nTris * 3);
    for (let t = 0; t < nTris; t++) {
      let u = rawUV[t * 2];
      let v = rawUV[t * 2 + 1];
      // avvolgi u,v in [0,1) per gestire texture "tiling" o coordinate fuori range
      u = u - Math.floor(u);
      v = v - Math.floor(v);
      const px = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
      // v OBJ ha origine in basso a sinistra, i pixel dell'immagine hanno origine in alto a sinistra
      const py = Math.min(height - 1, Math.max(0, Math.floor((1 - v) * height)));
      const idx = (py * width + px) * 4;
      colors[t * 3] = data[idx] / 255;
      colors[t * 3 + 1] = data[idx + 1] / 255;
      colors[t * 3 + 2] = data[idx + 2] / 255;
    }
    return colors;
  };

  root.TextureSampler = TextureSampler;
})(typeof window !== 'undefined' ? window : globalThis);
