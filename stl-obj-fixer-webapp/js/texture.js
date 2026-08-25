/*
 * texture.js
 * Decodifica un'immagine texture (PNG/JPG), la sfoca leggermente per
 * attenuare il rumore fotografico/di compressione, e campiona il colore
 * per ogni triangolo in base al centroide delle sue coordinate UV.
 *
 * blurImageData/sampleTriangleColors sono funzioni pure (testabili in
 * Node); decodeImageFile richiede API browser (Canvas/Image).
 */
(function (root, factory) {
  const TextureSampler = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextureSampler;
  } else {
    root.TextureSampler = TextureSampler;
  }
  // decodeImageFile va aggiunto separatamente: usa API browser (Image,
  // document, URL.createObjectURL) non disponibili/necessarie in Node.
  if (typeof window !== 'undefined') {
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
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const TextureSampler = {};

  // ---------------------------------------------------------------------
  // Box blur separabile (passata orizzontale + verticale, media mobile a
  // finestra scorrevole: O(larghezza*altezza) indipendentemente dal
  // raggio). Attenua il rumore "sale e pepe" delle texture fotografiche
  // PRIMA di campionare il colore, invece di ripulirlo dopo sulla mesh.
  // ---------------------------------------------------------------------
  function boxBlurHorizontal(src, width, height, radius) {
    const dst = new Float32Array(src.length);
    const windowSize = radius * 2 + 1;
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width * 4;
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const x = Math.min(width - 1, Math.max(0, k));
          sum += src[rowOffset + x * 4 + c];
        }
        for (let x = 0; x < width; x++) {
          dst[rowOffset + x * 4 + c] = sum / windowSize;
          const xRemove = Math.min(width - 1, Math.max(0, x - radius));
          const xAdd = Math.min(width - 1, Math.max(0, x + radius + 1));
          sum += src[rowOffset + xAdd * 4 + c] - src[rowOffset + xRemove * 4 + c];
        }
      }
    }
    return dst;
  }

  function boxBlurVertical(src, width, height, radius) {
    const dst = new Float32Array(src.length);
    const windowSize = radius * 2 + 1;
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const y = Math.min(height - 1, Math.max(0, k));
          sum += src[(y * width + x) * 4 + c];
        }
        for (let y = 0; y < height; y++) {
          dst[(y * width + x) * 4 + c] = sum / windowSize;
          const yRemove = Math.min(height - 1, Math.max(0, y - radius));
          const yAdd = Math.min(height - 1, Math.max(0, y + radius + 1));
          sum += src[(yAdd * width + x) * 4 + c] - src[(yRemove * width + x) * 4 + c];
        }
      }
    }
    return dst;
  }

  // imageData: { width, height, data } con data RGBA (Uint8ClampedArray o simile)
  TextureSampler.blurImageData = function (imageData, radius) {
    if (!radius || radius <= 0) return imageData;
    const { width, height, data } = imageData;
    const h = boxBlurHorizontal(data, width, height, radius);
    const v = boxBlurVertical(h, width, height, radius);
    const out = new Uint8ClampedArray(v.length);
    for (let i = 0; i < v.length; i++) out[i] = v[i];
    return { width, height, data: out };
  };

  // Raggio di sfocatura ragionevole in funzione della risoluzione della
  // texture: abbastanza da attenuare il rumore a livello di pixel/dettaglio
  // pittorico, non cosi' tanto da cancellare zone di colore piccole ma reali.
  TextureSampler.suggestBlurRadius = function (width, height) {
    const maxDim = Math.max(width, height);
    return Math.max(2, Math.round(maxDim / 150));
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

  return TextureSampler;
});
