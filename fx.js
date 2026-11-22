/* Page-wide Three.js field.
   A drifting particle constellation that reacts to the pointer, drawn behind
   the content on every page. Pauses when the tab is hidden, renders one static
   frame for reduced motion, and follows the site theme. */

(async () => {
  const canvas = document.getElementById("fx");
  if (!canvas) return;

  let THREE;
  try {
    THREE = await import("./vendor/three.module.js");
  } catch (e) {
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    return;
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const token = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 200);
  camera.position.set(0, 0, 30);

  const COUNT = 110;
  const LINK = 5.2;
  const MAX_LINKS = 700;
  const DEPTH = 9;

  const sprite = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  const points = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const base = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i++) {
    base[i * 3] = Math.random() * 2 - 1;
    base[i * 3 + 1] = Math.random() * 2 - 1;
    base[i * 3 + 2] = Math.random() * 2 - 1;
    phase[i * 2] = Math.random() * Math.PI * 2;
    phase[i * 2 + 1] = 0.35 + Math.random() * 0.75;
  }
  points.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pointMat = new THREE.PointsMaterial({
    size: 2.8,
    map: sprite,
    transparent: true,
    depthWrite: false,
    color: new THREE.Color(token("--accent", "#b2c27c")),
    opacity: 0.95,
  });
  scene.add(new THREE.Points(points, pointMat));

  const lines = new THREE.BufferGeometry();
  const linePos = new Float32Array(MAX_LINKS * 6);
  const lineCol = new Float32Array(MAX_LINKS * 6);
  lines.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  lines.setAttribute("color", new THREE.BufferAttribute(lineCol, 3));
  scene.add(
    new THREE.LineSegments(
      lines,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })
    )
  );

  let halfW = 20;
  let halfH = 12;
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    halfW = halfH * camera.aspect;
  }
  resize();
  window.addEventListener("resize", resize);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true }
  );

  const ground = new THREE.Color(token("--ground", "#0b120e"));
  const accent = new THREE.Color(token("--accent", "#b2c27c"));
  const tint = new THREE.Color();

  new MutationObserver(() => {
    ground.set(token("--ground", "#0b120e"));
    accent.set(token("--accent", "#b2c27c"));
    pointMat.color.copy(accent);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] });

  function paint(t) {
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    const px = pointer.x * halfW;
    const py = pointer.y * halfH;

    for (let i = 0; i < COUNT; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const bz = base[i * 3 + 2];
      const ph = phase[i * 2];
      const sp = phase[i * 2 + 1];

      let x = bx * halfW * 0.92 + Math.sin(t * sp + ph) * 1.1;
      let y = by * halfH * 0.92 + Math.cos(t * sp * 0.8 + ph) * 0.9;
      const z = bz * DEPTH + Math.sin(t * sp * 0.6 + ph * 2) * 1.2;

      const dx = x - px;
      const dy = y - py;
      const d2 = dx * dx + dy * dy;
      const R = 6;
      if (d2 < R * R && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const f = (1 - d / R) * 2.4;
        x += (dx / d) * f;
        y += (dy / d) * f;
      }

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    }
    points.attributes.position.needsUpdate = true;

    let n = 0;
    for (let i = 0; i < COUNT && n < MAX_LINKS; i++) {
      for (let j = i + 1; j < COUNT && n < MAX_LINKS; j++) {
        const dx = pos[i * 3] - pos[j * 3];
        const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
        const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > LINK * LINK) continue;

        const k = 1 - Math.sqrt(d2) / LINK;
        const o = n * 6;
        linePos[o] = pos[i * 3];
        linePos[o + 1] = pos[i * 3 + 1];
        linePos[o + 2] = pos[i * 3 + 2];
        linePos[o + 3] = pos[j * 3];
        linePos[o + 4] = pos[j * 3 + 1];
        linePos[o + 5] = pos[j * 3 + 2];

        tint.copy(ground).lerp(accent, k);
        lineCol[o] = tint.r * 0.7;
        lineCol[o + 1] = tint.g * 0.7;
        lineCol[o + 2] = tint.b * 0.7;
        lineCol[o + 3] = tint.r * 0.7;
        lineCol[o + 4] = tint.g * 0.7;
        lineCol[o + 5] = tint.b * 0.7;
        n++;
      }
    }
    lines.setDrawRange(0, n * 2);
    lines.attributes.position.needsUpdate = true;
    lines.attributes.color.needsUpdate = true;
  }

  if (reduce) {
    paint(1.7);
    renderer.render(scene, camera);
    return;
  }

  const clock = new THREE.Clock();
  function loop() {
    paint(clock.getElapsedTime());
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      clock.getElapsedTime();
      requestAnimationFrame(loop);
    }
  });
})();
