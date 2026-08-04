/*
 * viewer.js
 * Visualizzatore 3D basato su three.js con controlli touch (orbit + pinch-zoom)
 * scritti a mano, senza dipendere da OrbitControls.
 */
(function (root) {
  'use strict';

  function createViewer(canvas) {
    const THREE = root.THREE;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14161c);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(1, 2, 3);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-2, -1, -2);
    scene.add(dirLight2);

    const grid = new THREE.GridHelper(200, 20, 0x30333c, 0x22242c);
    grid.visible = false;
    // Il GridHelper di three.js nasce sdraiato sul piano Y=0 (convenzione
    // Y-in-su). Qui l'asse verticale del mondo e' Z (vedi sotto): lo si
    // ruota di 90 gradi cosi' rappresenta il piano di stampa Z=0.
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);

    // --- stato camera orbit ---
    // ASSE VERTICALE = Z, non Y. Gli STL nascono per la stampa 3D, dove Z e'
    // sempre l'altezza (il piano di stampa e' Z=0): lo fa anche layFlat() in
    // geometry-core.js, che raddrizza il pezzo verso (0,0,-1). Con l'orbita a
    // Y-in-su un modello Z-up (com'e' quasi sempre uno STL, incluso quelli
    // generati da Meshy) appariva SDRAIATO DI LATO nel visualizzatore: le
    // viste numeriche (1=fronte, 7=sopra...) mostravano il taglio sbagliato,
    // e ruotare col mouse "in alto/in basso" giravano attorno all'asse
    // sbagliato. Le coordinate della mesh non cambiano: cambia solo come la
    // camera orbita attorno ad esse.
    const target = new THREE.Vector3(0, 0, 0);
    let radius = 100;
    let theta = Math.PI / 4; // azimut
    let phi = Math.PI / 3; // polare (0=sopra, PI=sotto), misurato da +Z
    let minRadius = 0.01;
    let maxRadius = 100000;

    function updateCamera() {
      const sinPhi = Math.sin(phi);
      camera.position.set(
        target.x + radius * sinPhi * Math.sin(theta),
        target.y + radius * sinPhi * Math.cos(theta),
        target.z + radius * Math.cos(phi)
      );
      // ROTAZIONE INFINITA: phi non e' piu' bloccato ai poli, puo' girare
      // all'infinito. Quando si passa "oltre" il polo (sin(phi) negativo) il
      // modello si vede capovolto: si ribalta l'alto della camera, cosi' la
      // rotazione prosegue liscia invece di impuntarsi.
      camera.up.set(0, 0, sinPhi >= 0 ? 1 : -1);
      camera.lookAt(target);
    }
    updateCamera();

    // --- input pointer (mouse + touch unificati) ---
    const pointers = new Map();
    let lastPinchDist = null;
    let lastPinchMid = null;

    function pointerDistance() {
      const pts = [...pointers.values()];
      if (pts.length < 2) return null;
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function pointerMidpoint() {
      const pts = [...pointers.values()];
      if (pts.length < 2) return null;
      return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }

    // sposta il target sul piano della camera (pan) di (dx,dy) pixel schermo
    const panRight = new THREE.Vector3();
    const panUp = new THREE.Vector3();
    function panBy(dx, dy) {
      const h = canvas.clientHeight || 1;
      const scale = (radius * 1.2) / h;
      panRight.setFromMatrixColumn(camera.matrix, 0);
      panUp.setFromMatrixColumn(camera.matrix, 1);
      target.addScaledVector(panRight, -dx * scale);
      target.addScaledVector(panUp, dy * scale);
      updateCamera();
    }

    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    // col mouse: tasto destro / centrale / Shift-trascina = sposta (pan);
    // tasto sinistro = ruota. Su touch resta un dito = ruota, due dita = zoom+pan.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // hook opzionale: se restituisce true la app "prende" questo pointer (per
    // dipingere la selezione), e il viewer NON ruota/sposta con quel dito.
    let pointerDownHook = null;
    function setPointerDownHook(fn) { pointerDownHook = fn; }

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      // Mouse: destro o Shift = sposta (pan); CENTRALE = ruota sempre, anche
      // sopra il modello (comodo quando sei zoomato e non hai sfondo da agganciare);
      // sinistro = ruota, oppure dipinge se la app "prende" il tocco.
      const pan = e.button === 2 || e.shiftKey;
      const paintEligible = e.button === 0 && !pan;
      let claimed = false;
      if (pointerDownHook && pointers.size === 0 && paintEligible) {
        claimed = !!pointerDownHook(e.clientX, e.clientY, e.pointerId);
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, pan, claimed });
      canvas.style.cursor = claimed ? 'crosshair' : (pan ? 'move' : 'grabbing');
      lastPinchDist = pointerDistance();
      lastPinchMid = pointerMidpoint();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: prev.pan, claimed: prev.claimed });

      if (pointers.size === 1) {
        if (prev.claimed) {
          // pointer "preso" dalla app per dipingere: nessun movimento camera
        } else if (prev.pan) {
          panBy(dx, dy);
        } else {
          theta -= dx * 0.008;
          phi -= dy * 0.008;
          // niente blocco: si gira all'infinito in tutte le direzioni
          updateCamera();
        }
      } else if (pointers.size === 2) {
        // due dita: pizzica per lo zoom, trascina (punto medio) per spostarti
        const dist = pointerDistance();
        if (lastPinchDist && dist) {
          const scale = lastPinchDist / dist;
          radius = Math.max(minRadius, Math.min(maxRadius, radius * scale));
          updateCamera();
        }
        lastPinchDist = dist;
        const mid = pointerMidpoint();
        if (lastPinchMid && mid) {
          panBy(mid.x - lastPinchMid.x, mid.y - lastPinchMid.y);
        }
        lastPinchMid = mid;
      }
    });
    function releasePointer(e) {
      pointers.delete(e.pointerId);
      lastPinchDist = pointerDistance();
      lastPinchMid = pointerMidpoint();
      if (pointers.size === 0) canvas.style.cursor = 'grab';
    }
    canvas.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', releasePointer);
    // NIENTE rilascio su 'pointerleave': col pointer capture il trascinamento
    // deve continuare anche se il mouse esce dal riquadro. Rilasciarlo li'
    // faceva "impuntare" la rotazione appena si usciva dal viewer.

    // punto del mondo sotto il cursore: il modello se colpito, altrimenti il
    // punto sul piano che passa per il target. Serve per lo zoom "verso il cursore".
    const zoomRay = new THREE.Raycaster();
    const zoomDir = new THREE.Vector3();
    function worldPointUnderCursor(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      zoomRay.setFromCamera(ndc, camera);
      const list = [];
      meshes.forEach((m) => { if (m.visible) list.push(m); });
      const hits = list.length ? zoomRay.intersectObjects(list, false) : [];
      if (hits.length) return hits[0].point.clone();
      camera.getWorldDirection(zoomDir);
      const denom = zoomRay.ray.direction.dot(zoomDir);
      if (Math.abs(denom) < 1e-6) return null;
      const t = zoomDir.dot(target) - zoomDir.dot(zoomRay.ray.origin);
      const tt = t / denom;
      if (tt <= 0) return null;
      return zoomRay.ray.origin.clone().add(zoomRay.ray.direction.clone().multiplyScalar(tt));
    }

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const scale = Math.exp(e.deltaY * 0.001);
      const p = worldPointUnderCursor(e.clientX, e.clientY);
      const oldR = radius;
      radius = Math.max(minRadius, Math.min(maxRadius, radius * scale));
      // zoom verso il cursore: avvicina il target al punto sotto il mouse
      if (p) {
        const k = 1 - radius / oldR;
        target.x += (p.x - target.x) * k;
        target.y += (p.y - target.y) * k;
        target.z += (p.z - target.z) * k;
      }
      updateCamera();
    }, { passive: false });

    // --- DOPPIO CLIC: centra la vista sul punto toccato ---
    // E' la manovra piu' utile quando lavori di precisione: invece di
    // trascinare a tentativi, punti il dettaglio e ci giri intorno.
    canvas.addEventListener('dblclick', (e) => {
      e.preventDefault();
      const p = worldPointUnderCursor(e.clientX, e.clientY);
      if (!p) return;
      animaVerso(p, radius * 0.55);
    });

    // spostamento morbido del centro di rotazione (e dello zoom)
    let anim = null;
    function animaVerso(punto, nuovoRaggio) {
      const da = target.clone();
      const r0 = radius;
      const t0 = performance.now();
      const durata = 260;
      if (anim) cancelAnimationFrame(anim);
      const passo = () => {
        const k = Math.min(1, (performance.now() - t0) / durata);
        const e = 1 - Math.pow(1 - k, 3);   // parte veloce, arriva morbido
        target.set(
          da.x + (punto.x - da.x) * e,
          da.y + (punto.y - da.y) * e,
          da.z + (punto.z - da.z) * e
        );
        if (nuovoRaggio) radius = r0 + (nuovoRaggio - r0) * e;
        updateCamera();
        if (k < 1) anim = requestAnimationFrame(passo); else anim = null;
      };
      passo();
    }

    // --- VISTE STANDARD da tastiera ---
    // 1 fronte · 3 lato · 7 sopra · 2 retro · 4 lato opposto · 9 sotto
    // F inquadra tutto · Shift+tasto = vista opposta
    const VISTE = {
      '1': [0, Math.PI / 2],              // fronte
      '2': [Math.PI, Math.PI / 2],        // retro
      '3': [Math.PI / 2, Math.PI / 2],    // lato destro
      '4': [-Math.PI / 2, Math.PI / 2],   // lato sinistro
      '7': [0, 0.06],                     // dall'alto
      '9': [0, Math.PI - 0.06],           // dal basso
    };
    function impostaVista(th, ph) {
      const t0 = performance.now(), durata = 260;
      const th0 = theta, ph0 = phi;
      // scegli il giro piu' corto
      let dth = th - th0;
      while (dth > Math.PI) dth -= 2 * Math.PI;
      while (dth < -Math.PI) dth += 2 * Math.PI;
      const passo = () => {
        const k = Math.min(1, (performance.now() - t0) / durata);
        const e = 1 - Math.pow(1 - k, 3);
        theta = th0 + dth * e;
        phi = ph0 + (ph - ph0) * e;
        updateCamera();
        if (k < 1) requestAnimationFrame(passo);
      };
      passo();
    }
    function gestisciTasto(e) {
      // non rubare i tasti mentre si scrive in un campo
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      const k = e.key;
      if (VISTE[k]) {
        const [th, ph] = VISTE[k];
        impostaVista(e.shiftKey ? th + Math.PI : th, ph);
        e.preventDefault();
      } else if (k === 'f' || k === 'F') {
        frameAll();
        e.preventDefault();
      }
    }
    root.addEventListener('keydown', gestisciTasto);

    function resize() {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    root.addEventListener('resize', resize);
    resize();

    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    const meshes = new Map(); // partId -> THREE.Mesh

    function clearParts() {
      meshes.forEach((m) => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
      meshes.clear();
      setHighlight(null);
    }

    // --- piano di taglio (anteprima) ---
    let cutPlaneMesh = null;
    function showCutPlane(point, normal, size) {
      hideCutPlane();
      const geo = new THREE.PlaneGeometry(size, size);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff5b6b, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
      cutPlaneMesh = new THREE.Mesh(geo, mat);
      const n = new THREE.Vector3(normal[0], normal[1], normal[2]).normalize();
      cutPlaneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      cutPlaneMesh.position.set(point[0], point[1], point[2]);
      cutPlaneMesh.renderOrder = 999;
      scene.add(cutPlaneMesh);
    }
    function hideCutPlane() {
      if (cutPlaneMesh) { scene.remove(cutPlaneMesh); cutPlaneMesh.geometry.dispose(); cutPlaneMesh.material.dispose(); cutPlaneMesh = null; }
    }

    function colorToHex(c) {
      return new THREE.Color(c[0], c[1], c[2]);
    }

    function addPart(part) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(part.indices, 1));
      // colore per-vertice opzionale (per mostrare la texture/colori del modello)
      const useVC = !!part.vertexColors;
      if (useVC) geometry.setAttribute('color', new THREE.Float32BufferAttribute(part.vertexColors, 3));
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({
        color: useVC ? 0xffffff : colorToHex(part.color),
        vertexColors: useVC,
        metalness: 0.05,
        roughness: 0.75,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      meshes.set(part.id, mesh);
      return mesh;
    }

    function setPartVisible(id, visible) {
      const m = meshes.get(id);
      if (m) m.visible = visible;
    }

    function setPartOffset(id, x, y, z) {
      const m = meshes.get(id);
      if (m) m.position.set(x, y, z);
    }

    // --- raycast: da coordinate schermo a (parte, triangolo) ---
    const raycaster = new THREE.Raycaster();
    function raycastAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const list = [];
      meshes.forEach((m, id) => {
        if (!m.visible) return;
        m.userData.partId = id;
        list.push(m);
      });
      const hits = raycaster.intersectObjects(list, false);
      if (hits.length === 0) return null;
      const h = hits[0];
      return {
        partId: h.object.userData.partId,
        faceIndex: h.faceIndex,
        point: [h.point.x, h.point.y, h.point.z],
      };
    }

    // --- proiezione 3D -> pixel schermo (per la selezione a lazo) ---
    const projTemp = new THREE.Vector3();
    function projectToScreen(x, y, z) {
      projTemp.set(x, y, z).project(camera);
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((projTemp.x + 1) / 2) * rect.width,
        y: ((1 - projTemp.y) / 2) * rect.height,
        behind: projTemp.z > 1,
      };
    }
    function getCameraPosition() {
      return [camera.position.x, camera.position.y, camera.position.z];
    }

    // --- evidenziazione della selezione manuale ---
    let highlightMesh = null;
    function setHighlight(positionsArray) {
      if (highlightMesh) {
        scene.remove(highlightMesh);
        highlightMesh.geometry.dispose();
        highlightMesh.material.dispose();
        highlightMesh = null;
      }
      if (!positionsArray || positionsArray.length === 0) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionsArray, 3));
      geometry.computeVertexNormals();
      const material = new THREE.MeshBasicMaterial({
        color: 0xffe14d,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      highlightMesh = new THREE.Mesh(geometry, material);
      scene.add(highlightMesh);
    }

    function frameAll() {
      const box = new THREE.Box3();
      let has = false;
      meshes.forEach((m) => {
        if (!m.visible) return;
        box.expandByObject(m);
        has = true;
      });
      if (!has) return;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      target.copy(center);
      const maxDim = Math.max(size.x, size.y, size.z, 0.001);
      radius = maxDim * 1.8;
      minRadius = maxDim * 0.01;
      maxRadius = maxDim * 50;
      updateCamera();
    }

    function getTarget() { return [target.x, target.y, target.z]; }

    return { scene, camera, renderer, clearParts, addPart, setPartVisible, setPartOffset, frameAll, resize, raycastAt, setHighlight, projectToScreen, getCameraPosition, getTarget, setPointerDownHook, showCutPlane, hideCutPlane, impostaVista, animaVerso };
  }

  root.createViewer = createViewer;
})(typeof window !== 'undefined' ? window : globalThis);
