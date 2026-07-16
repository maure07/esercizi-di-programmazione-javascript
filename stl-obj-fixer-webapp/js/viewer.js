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
    scene.add(grid);

    // --- stato camera orbit ---
    const target = new THREE.Vector3(0, 0, 0);
    let radius = 100;
    let theta = Math.PI / 4; // azimut
    let phi = Math.PI / 3; // polare (0=sopra, PI=sotto)
    let minRadius = 0.01;
    let maxRadius = 100000;

    function updateCamera() {
      const sinPhi = Math.sin(phi);
      camera.position.set(
        target.x + radius * sinPhi * Math.sin(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * sinPhi * Math.cos(theta)
      );
      camera.lookAt(target);
    }
    updateCamera();

    // --- input pointer (mouse + touch unificati) ---
    const pointers = new Map();
    let lastPinchDist = null;

    function pointerDistance() {
      const pts = [...pointers.values()];
      if (pts.length < 2) return null;
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      lastPinchDist = pointerDistance();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 1) {
        theta -= dx * 0.008;
        phi -= dy * 0.008;
        phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi));
        updateCamera();
      } else if (pointers.size === 2) {
        const dist = pointerDistance();
        if (lastPinchDist && dist) {
          const scale = lastPinchDist / dist;
          radius = Math.max(minRadius, Math.min(maxRadius, radius * scale));
          updateCamera();
        }
        lastPinchDist = dist;
      }
    });
    function releasePointer(e) {
      pointers.delete(e.pointerId);
      lastPinchDist = pointerDistance();
    }
    canvas.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', releasePointer);
    canvas.addEventListener('pointerleave', (e) => { if (pointers.size <= 1) releasePointer(e); });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const scale = Math.exp(e.deltaY * 0.001);
      radius = Math.max(minRadius, Math.min(maxRadius, radius * scale));
      updateCamera();
    }, { passive: false });

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
    }

    function colorToHex(c) {
      return new THREE.Color(c[0], c[1], c[2]);
    }

    function addPart(part) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(part.indices, 1));
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({
        color: colorToHex(part.color),
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

    return { scene, camera, renderer, clearParts, addPart, setPartVisible, frameAll, resize };
  }

  root.createViewer = createViewer;
})(typeof window !== 'undefined' ? window : globalThis);
