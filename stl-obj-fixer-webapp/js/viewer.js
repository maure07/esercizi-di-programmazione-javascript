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
    // col mouse: SHIFT+sinistro e tasto centrale girano SEMPRE la telecamera,
    // anche quando si sta selezionando e anche col cursore sopra il modello;
    // tasto destro (o Ctrl/Cmd+sinistro) sposta (pan); il sinistro liscio
    // ruota, oppure dipinge se la app se lo prende.
    // Su touch resta un dito = ruota, due dita = zoom+pan.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // hook opzionale: se restituisce true la app "prende" questo pointer (per
    // dipingere la selezione), e il viewer NON ruota/sposta con quel dito.
    let pointerDownHook = null;
    function setPointerDownHook(fn) { pointerDownHook = fn; }

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      // Mouse: destro (o Ctrl/Cmd+sinistro) = sposta (pan);
      // CENTRALE e SHIFT+sinistro = girano la telecamera SEMPRE, anche sopra il
      // modello mentre selezioni. Prima per girare bisognava zoomare indietro,
      // trovare un punto vuoto, girare e rizoomare: con Shift si gira e basta.
      // Sinistro liscio = ruota, oppure dipinge se la app "prende" il tocco.
      const pan = e.button === 2 || (e.button === 0 && (e.ctrlKey || e.metaKey));
      const orbita = e.button === 1 || (e.button === 0 && e.shiftKey);
      const paintEligible = e.button === 0 && !pan && !orbita;
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
      numeratori.forEach((n) => n.geom.dispose());
      numeratori.clear();
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
    // ------------------- LA COPERTA (superficie di taglio finita) -------------
    // Un telo NxN di maniglie che l'utente piega e stringe a piacere. A
    // differenza del piano rosso, che e' infinito e taglia tutto quello che
    // incontra, la coperta ha un perimetro: taglia solo dove la si mette.
    let copertaGruppo = null;
    let copertaManiglie = [];

    // superficie liscia che passa per tutte le maniglie (Catmull-Rom), la
    // stessa curva che poi usa il companion per tagliare davvero
    function catmull(a, b, c, d, t, out) {
      const t2 = t * t, t3 = t2 * t;
      for (let k = 0; k < 3; k++) {
        out[k] = 0.5 * (2 * b[k] + (-a[k] + c[k]) * t
          + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2
          + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3);
      }
      return out;
    }

    function infittisciCoperta(punti, N, passo) {
      const get = (i, j) => {
        const ii = Math.max(0, Math.min(N - 1, i)), jj = Math.max(0, Math.min(N - 1, j));
        const o = (ii * N + jj) * 3;
        const p = [punti[o], punti[o + 1], punti[o + 2]];
        // bordi: si prolunga la superficie invece di appiattirla
        if (i < 0 || i > N - 1 || j < 0 || j > N - 1) {
          const i2 = Math.max(0, Math.min(N - 1, i < 0 ? 1 : (i > N - 1 ? N - 2 : i)));
          const j2 = Math.max(0, Math.min(N - 1, j < 0 ? 1 : (j > N - 1 ? N - 2 : j)));
          const o2 = (i2 * N + j2) * 3;
          return [2 * p[0] - punti[o2], 2 * p[1] - punti[o2 + 1], 2 * p[2] - punti[o2 + 2]];
        }
        return p;
      };
      const M = (N - 1) * passo + 1;
      const out = new Float32Array(M * M * 3);
      const tmp = [0, 0, 0], col = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let a = 0; a < M; a++) {
        const i = Math.min(Math.floor(a / passo), N - 2), tu = (a - i * passo) / passo;
        for (let b = 0; b < M; b++) {
          const j = Math.min(Math.floor(b / passo), N - 2), tv = (b - j * passo) / passo;
          for (let k = 0; k < 4; k++) {
            catmull(get(i - 1 + k, j - 1), get(i - 1 + k, j), get(i - 1 + k, j + 1), get(i - 1 + k, j + 2), tv, col[k]);
          }
          catmull(col[0], col[1], col[2], col[3], tu, tmp);
          const o = (a * M + b) * 3;
          out[o] = tmp[0]; out[o + 1] = tmp[1]; out[o + 2] = tmp[2];
        }
      }
      return { punti: out, M };
    }

    function mostraCoperta(punti, N, raggioManiglia) {
      nascondiCoperta();
      copertaGruppo = new THREE.Group();
      const { punti: fitta, M } = infittisciCoperta(punti, N, 4);
      const idx = [];
      for (let i = 0; i < M - 1; i++) {
        for (let j = 0; j < M - 1; j++) {
          const a = i * M + j, b = (i + 1) * M + j, c = (i + 1) * M + j + 1, d = i * M + j + 1;
          idx.push(a, b, c, a, c, d);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(fitta, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      // depthTest disattivato di proposito: il telo lavora QUASI SEMPRE dentro
      // al modello (e' li' che deve tagliare), e col test di profondita' sparirebbe
      // sotto la superficie proprio quando serve vederlo per posizionarlo.
      const telo = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0xff5b6b, transparent: true, opacity: 0.30, side: THREE.DoubleSide,
        depthWrite: false, depthTest: false,
      }));
      telo.renderOrder = 998;
      copertaGruppo.add(telo);
      // reticolo, per vedere come e' piegata
      const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0xffb3ba, wireframe: true, transparent: true, opacity: 0.35,
        depthWrite: false, depthTest: false,
      }));
      wire.renderOrder = 998;
      copertaGruppo.add(wire);
      // maniglie
      copertaManiglie = [];
      const sfera = new THREE.SphereGeometry(raggioManiglia, 12, 10);
      // MANIGLIA CENTRALE: sposta tutto il telo insieme. Senza di questa, per
      // portare la coperta dal centro del pezzo fino al polso bisognava
      // trascinare i pallini uno per uno.
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < N * N; k++) { cx += punti[k * 3]; cy += punti[k * 3 + 1]; cz += punti[k * 3 + 2]; }
      cx /= N * N; cy /= N * N; cz /= N * N;
      const centrale = new THREE.Mesh(
        new THREE.SphereGeometry(raggioManiglia * 1.9, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x5b8cff, depthTest: false })
      );
      centrale.position.set(cx, cy, cz);
      centrale.renderOrder = 1001;
      centrale.userData.maniglia = N * N;   // indice speciale = "sposta tutto"
      copertaManiglie.push(centrale);
      copertaGruppo.add(centrale);
      for (let k = 0; k < N * N; k++) {
        const bordo = (k < N) || (k >= N * (N - 1)) || (k % N === 0) || (k % N === N - 1);
        const m = new THREE.Mesh(sfera, new THREE.MeshBasicMaterial({
          color: bordo ? 0x36d1a0 : 0xffd23f, depthTest: false,
        }));
        m.position.set(punti[k * 3], punti[k * 3 + 1], punti[k * 3 + 2]);
        m.renderOrder = 1000;
        m.userData.maniglia = k;
        copertaManiglie.push(m);
        copertaGruppo.add(m);
      }
      scene.add(copertaGruppo);
    }

    function nascondiCoperta() {
      if (!copertaGruppo) return;
      copertaGruppo.traverse((o) => {
        if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
      });
      scene.remove(copertaGruppo);
      copertaGruppo = null;
      copertaManiglie = [];
    }

    // quale maniglia sta sotto il cursore (-1 se nessuna)
    const rayManiglia = new THREE.Raycaster();
    function maniglieSotto(clientX, clientY) {
      if (!copertaManiglie.length) return -1;
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      rayManiglia.setFromCamera(ndc, camera);
      const hits = rayManiglia.intersectObjects(copertaManiglie, false);
      return hits.length ? hits[0].object.userData.maniglia : -1;
    }

    // dove finisce il cursore, su un piano che passa per `rif` e guarda la
    // camera: e' cosi' che si trascina un punto in 3D con un mouse 2D
    const dirVista = new THREE.Vector3();
    const pianoTrascina = new THREE.Plane();
    const rayTrascina = new THREE.Raycaster();
    const puntoTrascina = new THREE.Vector3();
    function puntoSulPianoVista(clientX, clientY, rif) {
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      camera.getWorldDirection(dirVista);
      pianoTrascina.setFromNormalAndCoplanarPoint(dirVista, new THREE.Vector3(rif[0], rif[1], rif[2]));
      rayTrascina.setFromCamera(ndc, camera);
      const p = rayTrascina.ray.intersectPlane(pianoTrascina, puntoTrascina);
      return p ? [p.x, p.y, p.z] : null;
    }

    function hideCutPlane() {
      if (cutPlaneMesh) { scene.remove(cutPlaneMesh); cutPlaneMesh.geometry.dispose(); cutPlaneMesh.material.dispose(); cutPlaneMesh = null; }
    }

    function colorToHex(c) {
      return new THREE.Color(c[0], c[1], c[2]);
    }

    // Media delle normali SOLO fra facce che si raccordano dolcemente (angolo
    // sotto la soglia). Restituisce una geometria non indicizzata: serve
    // perche' su uno spigolo lo stesso vertice deve avere due normali diverse,
    // una per lato, cosa impossibile con gli indici condivisi.
    function normaliConSpigoli(positions, indices, vertexColors, gradiSoglia) {
      const nTri = indices.length / 3;
      const nVert = positions.length / 3;
      if (nTri === 0) return null;
      // normale di ogni faccia: versore (per confrontare gli angoli) e
      // versione pesata sull'area (per fare la media come si deve)
      const nu = new Float32Array(nTri * 3);   // versori
      const np = new Float32Array(nTri * 3);   // pesate sull'area
      for (let f = 0; f < nTri; f++) {
        const a = indices[f * 3], b = indices[f * 3 + 1], c = indices[f * 3 + 2];
        const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
        const ux = positions[b * 3] - ax, uy = positions[b * 3 + 1] - ay, uz = positions[b * 3 + 2] - az;
        const vx = positions[c * 3] - ax, vy = positions[c * 3 + 1] - ay, vz = positions[c * 3 + 2] - az;
        const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
        np[f * 3] = x; np[f * 3 + 1] = y; np[f * 3 + 2] = z;
        const L = Math.hypot(x, y, z) || 1;
        nu[f * 3] = x / L; nu[f * 3 + 1] = y / L; nu[f * 3 + 2] = z / L;
      }
      // elenco compatto delle facce che toccano ogni vertice
      const inizio = new Uint32Array(nVert + 1);
      for (let i = 0; i < indices.length; i++) inizio[indices[i] + 1]++;
      for (let v = 0; v < nVert; v++) inizio[v + 1] += inizio[v];
      const facce = new Uint32Array(indices.length);
      const cursore = inizio.slice(0, nVert);
      for (let f = 0; f < nTri; f++) {
        for (let k = 0; k < 3; k++) facce[cursore[indices[f * 3 + k]]++] = f;
      }
      const cosSoglia = Math.cos(gradiSoglia * Math.PI / 180);
      const pos = new Float32Array(nTri * 9);
      const nor = new Float32Array(nTri * 9);
      const col = vertexColors ? new Float32Array(nTri * 9) : null;
      for (let f = 0; f < nTri; f++) {
        const fx = nu[f * 3], fy = nu[f * 3 + 1], fz = nu[f * 3 + 2];
        for (let k = 0; k < 3; k++) {
          const v = indices[f * 3 + k];
          const o = (f * 3 + k) * 3;
          pos[o] = positions[v * 3]; pos[o + 1] = positions[v * 3 + 1]; pos[o + 2] = positions[v * 3 + 2];
          if (col) { col[o] = vertexColors[v * 3]; col[o + 1] = vertexColors[v * 3 + 1]; col[o + 2] = vertexColors[v * 3 + 2]; }
          let sx = 0, sy = 0, sz = 0;
          for (let i = inizio[v]; i < inizio[v + 1]; i++) {
            const g = facce[i];
            if (nu[g * 3] * fx + nu[g * 3 + 1] * fy + nu[g * 3 + 2] * fz >= cosSoglia) {
              sx += np[g * 3]; sy += np[g * 3 + 1]; sz += np[g * 3 + 2];
            }
          }
          const L = Math.hypot(sx, sy, sz);
          if (L > 1e-12) { nor[o] = sx / L; nor[o + 1] = sy / L; nor[o + 2] = sz / L; }
          else { nor[o] = fx; nor[o + 1] = fy; nor[o + 2] = fz; }
        }
      }
      return { positions: pos, normals: nor, colors: col };
    }

    function addPart(part) {
      const geometry = new THREE.BufferGeometry();
      const useVC = !!part.vertexColors;
      // Normali che rispettano gli SPIGOLI VIVI. computeVertexNormals() di
      // three.js fa la media fra TUTTE le facce attorno a un vertice, anche
      // quelle che formano uno spigolo netto: cosi' una faccia di taglio
      // perfettamente piatta viene disegnata con una sfumatura curva sul
      // bordo e sembra ondulata, pur essendo piatta al millesimo di mm.
      // Qui la media si ferma agli spigoli, e il taglio si vede piatto.
      const creased = part.indices.length / 3 <= 800000
        ? normaliConSpigoli(part.positions, part.indices, part.vertexColors, 35)
        : null;
      if (creased) {
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(creased.positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(creased.normals, 3));
        if (useVC && creased.colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(creased.colors, 3));
      } else {
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(part.indices, 1));
        if (useVC) geometry.setAttribute('color', new THREE.Float32BufferAttribute(part.vertexColors, 3));
        geometry.computeVertexNormals();
      }
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

    // Proiezione di TANTI punti in un colpo solo. projectToScreen va bene per
    // un punto, ma il Lazo deve proiettare il centro di ogni triangolo: su un
    // modello da 400.000 triangoli sono 400.000 chiamate, ognuna delle quali
    // rimisura il riquadro della pagina e rifa i conti della camera. Qui la
    // matrice si calcola una volta sola e poi si macinano i punti di fila.
    const matVP = new THREE.Matrix4();
    function proiettaTanti(punti) {
      const rect = canvas.getBoundingClientRect();
      camera.updateMatrixWorld();
      matVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const e = matVP.elements;
      const n = (punti.length / 3) | 0;
      const xy = new Float32Array(n * 2);
      const dietro = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const x = punti[i * 3], y = punti[i * 3 + 1], z = punti[i * 3 + 2];
        const w = e[3] * x + e[7] * y + e[11] * z + e[15];
        if (w <= 0) { dietro[i] = 1; continue; }
        const iw = 1 / w;
        const cx = (e[0] * x + e[4] * y + e[8] * z + e[12]) * iw;
        const cy = (e[1] * x + e[5] * y + e[9] * z + e[13]) * iw;
        const cz = (e[2] * x + e[6] * y + e[10] * z + e[14]) * iw;
        xy[i * 2] = ((cx + 1) / 2) * rect.width;
        xy[i * 2 + 1] = ((1 - cy) / 2) * rect.height;
        if (cz > 1) dietro[i] = 1;
      }
      return { xy, dietro };
    }

    // --- QUALI TRIANGOLI SI VEDONO DAVVERO (scheda video) --------------------
    // Confrontare le distanze non basta: su un modello da 400.000 triangoli i
    // triangoli sono piu' piccoli di un pixel, quindi meta' di loro non
    // "possiede" il pixel del proprio centro e verrebbe scambiata per coperta.
    // Si e' visto sul modello vero: la selezione usciva a strisce frastagliate.
    // Qui invece la scheda video disegna la scena scrivendo, al posto del
    // colore, il NUMERO di ogni triangolo. Rileggendo i pixel si sa esattamente
    // quali triangoli sono in vista: e' la stessa domanda che si fa la scheda
    // video per decidere cosa disegnare, quindi la risposta non puo' sbagliare.
    const matNumeri = new THREE.ShaderMaterial({
      vertexShader: [
        'attribute vec3 numTri;',
        'varying vec3 vNum;',
        'void main() {',
        '  vNum = numTri;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vNum;',
        'void main() { gl_FragColor = vec4(vNum, 1.0); }',
      ].join('\n'),
      side: THREE.DoubleSide,
    });
    let bersaglioNumeri = null;
    const numeratori = new Map(); // partId -> { base, geom }

    // Prepara (una volta sola) la geometria "numerata" di un pezzo: stessi
    // triangoli, ma ogni vertice porta scritto il numero del proprio triangolo
    // in tre byte, cioe' un colore.
    function geometriaNumerata(id, mesh, base) {
      const vecchia = numeratori.get(id);
      if (vecchia && vecchia.base === base && vecchia.geom.userData.fonte === mesh.geometry) {
        return vecchia.geom;
      }
      if (vecchia) vecchia.geom.dispose();
      const src = mesh.geometry;
      const pos = src.getAttribute('position');
      const idx = src.getIndex();
      const nTri = idx ? idx.count / 3 : pos.count / 3;
      const N = new Uint8Array(nTri * 9);
      // si lavora sugli array grezzi: con getX/getY/getZ su 400.000 triangoli
      // sarebbero sette milioni di chiamate e il primo lazo si piantava per
      // qualche secondo.
      const src2 = pos.array;
      let P;
      if (!idx) {
        P = src2 instanceof Float32Array ? src2 : new Float32Array(src2);
      } else {
        P = new Float32Array(nTri * 9);
        const ia = idx.array;
        for (let i = 0; i < nTri * 3; i++) {
          const v = ia[i] * 3;
          P[i * 3] = src2[v]; P[i * 3 + 1] = src2[v + 1]; P[i * 3 + 2] = src2[v + 2];
        }
      }
      for (let t = 0; t < nTri; t++) {
        const n = base + t + 1; // lo 0 resta allo sfondo
        const r = (n >> 16) & 255, g = (n >> 8) & 255, bl = n & 255;
        const o = t * 9;
        N[o] = r; N[o + 1] = g; N[o + 2] = bl;
        N[o + 3] = r; N[o + 4] = g; N[o + 5] = bl;
        N[o + 6] = r; N[o + 7] = g; N[o + 8] = bl;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(P, 3));
      geom.setAttribute('numTri', new THREE.BufferAttribute(N, 3, true));
      geom.userData.fonte = src;
      numeratori.set(id, { base, geom });
      return geom;
    }

    // Restituisce una Map partId -> Set(numero di triangolo) con i soli
    // triangoli che si vedono dentro al rettangolo indicato.
    function facceVisibili(x0, y0, x1, y1) {
      const rect = canvas.getBoundingClientRect();
      const dpr = renderer.getPixelRatio();
      const W = Math.max(1, Math.round(rect.width * dpr));
      const H = Math.max(1, Math.round(rect.height * dpr));
      if (!bersaglioNumeri || bersaglioNumeri.width !== W || bersaglioNumeri.height !== H) {
        if (bersaglioNumeri) bersaglioNumeri.dispose();
        bersaglioNumeri = new THREE.WebGLRenderTarget(W, H, {
          minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
        });
      }
      // scena usa e getta con le sole geometrie numerate dei pezzi visibili
      const finta = new THREE.Scene();
      finta.background = new THREE.Color(0x000000); // nero = sfondo
      const fette = []; // per ogni pezzo: da quale numero comincia e quanti ne ha
      let base = 0;
      meshes.forEach((m, id) => {
        if (!m.visible) return;
        const geom = geometriaNumerata(id, m, base);
        const nTri = geom.getAttribute('position').count / 3;
        const oggetto = new THREE.Mesh(geom, matNumeri);
        oggetto.position.copy(m.position);
        oggetto.quaternion.copy(m.quaternion);
        oggetto.scale.copy(m.scale);
        finta.add(oggetto);
        fette.push({ id, nTri, base });
        base += nTri;
      });
      if (!fette.length) return new Map();

      // Una sola passata per tutti i pezzi: la numerazione e' continua da un
      // pezzo all'altro, poi si torna indietro al pezzo giusto con gli
      // intervalli. Cosi' la scheda video disegna una volta e si legge una
      // volta, anche con dieci pezzi sullo schermo.
      const px0 = Math.max(0, Math.floor(x0 * dpr) - 1);
      const px1 = Math.min(W - 1, Math.ceil(x1 * dpr) + 1);
      const py0 = Math.max(0, Math.floor(y0 * dpr) - 1);
      const py1 = Math.min(H - 1, Math.ceil(y1 * dpr) + 1);
      const w = Math.max(1, px1 - px0 + 1);
      const h = Math.max(1, py1 - py0 + 1);
      const buf = new Uint8Array(w * h * 4);
      renderer.setRenderTarget(bersaglioNumeri);
      renderer.render(finta, camera);
      renderer.setRenderTarget(null);
      renderer.readRenderTargetPixels(bersaglioNumeri, px0, H - 1 - py1, w, h, buf);
      finta.clear();

      const risultato = new Map();
      for (let i = 0; i < buf.length; i += 4) {
        const n = (buf[i] << 16) | (buf[i + 1] << 8) | buf[i + 2];
        if (n <= 0) continue;
        const g = n - 1; // numero globale
        for (let k = 0; k < fette.length; k++) {
          const f = fette[k];
          if (g >= f.base && g < f.base + f.nTri) {
            let s = risultato.get(f.id);
            if (!s) { s = new Set(); risultato.set(f.id, s); }
            s.add(g - f.base);
            break;
          }
        }
      }
      return risultato;
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

    return { scene, camera, renderer, clearParts, addPart, setPartVisible, setPartOffset, frameAll, resize, raycastAt, setHighlight, projectToScreen, getCameraPosition, getTarget, setPointerDownHook, showCutPlane, hideCutPlane, impostaVista, animaVerso,
      mostraCoperta, nascondiCoperta, maniglieSotto, puntoSulPianoVista, proiettaTanti, facceVisibili };
  }

  root.createViewer = createViewer;
})(typeof window !== 'undefined' ? window : globalThis);
