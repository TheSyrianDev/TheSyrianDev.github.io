/* Three.js page effects, shared by the portfolio and the LastSoft site.

   Two layers:
     #fx          a drifting constellation behind the content
     #fx-cursor   a glowing orb that follows the pointer, with a trail,
                  orbiting satellites and a click pulse

   Both follow the site theme, render one static frame for reduced motion, and
   do nothing at all if the canvas or WebGL is missing. */

(async () => {
  const fieldCanvas = document.getElementById("fx");
  const cursorCanvas = document.getElementById("fx-cursor");
  if (!fieldCanvas && !cursorCanvas) return;

  let THREE;
  try {
    THREE = await import("./vendor/three.module.js");
  } catch {
    return;
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const token = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  const ground = new THREE.Color(token("--ground", "#0b120e"));
  const accent = new THREE.Color(token("--accent", "#b2c27c"));
  const tint = new THREE.Color();

  /* The palette stays exactly as the theme sets it; on a light ground the same
     accent reads far too loud, so the effect is scaled back instead. */
  const relLum = 0.2126 * ground.r + 0.7152 * ground.g + 0.0722 * ground.b;
  let dim = 1 - Math.min(Math.max((relLum - 0.3) / 0.5, 0), 1) * 0.62;

  const watch = (fn) =>
    new MutationObserver(fn).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style"],
    });

  /* ---------------------------------------------------------------- sprite */
  const sprite = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  const pointer = { tx: 0, ty: 0, x: 0, y: 0, moved: 0 };

  /* ---------------------------------------------------------------- field */
  if (fieldCanvas) {
    let renderer = null;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: fieldCanvas, antialias: true, alpha: true });
    } catch {
      fieldCanvas.remove();
    }

    if (renderer) {
      const COUNT = 80;
      const LINK = 6.0;
      const MAX_LINKS = 520;
      const DEPTH = 10;

      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 200);
      camera.position.set(0, 0, 30);

      const pos = new Float32Array(COUNT * 3);
      const base = new Float32Array(COUNT * 3);
      const phase = new Float32Array(COUNT * 2);
      for (let i = 0; i < COUNT; i++) {
        base[i * 3] = Math.random() * 2 - 1;
        base[i * 3 + 1] = Math.random() * 2 - 1;
        base[i * 3 + 2] = Math.random() * 2 - 1;
        phase[i * 2] = Math.random() * Math.PI * 2;
        phase[i * 2 + 1] = 0.3 + Math.random() * 0.8;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        size: 2.4 + 1.2 * dim,
        map: sprite,
        transparent: true,
        depthWrite: false,
        color: accent.clone(),
        opacity: dim,
      });
      scene.add(new THREE.Points(geo, mat));

      const lines = new THREE.BufferGeometry();
      const linePos = new Float32Array(MAX_LINKS * 6);
      const lineCol = new Float32Array(MAX_LINKS * 6);
      lines.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
      lines.setAttribute("color", new THREE.BufferAttribute(lineCol, 3));
      scene.add(
        new THREE.LineSegments(
          lines,
          new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.95 * dim,
            depthWrite: false,
          })
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

      watch(() => {
        mat.color.copy(accent.set(token("--accent", "#b2c27c")));
        ground.set(token("--ground", "#0b120e"));
        dim = 1 - Math.min(Math.max((0.2126 * ground.r + 0.7152 * ground.g + 0.0722 * ground.b - 0.3) / 0.5, 0), 1) * 0.62;
        mat.opacity = dim;
      });

      function paint(t) {
        pointer.x += (pointer.tx - pointer.x) * 0.07;
        pointer.y += (pointer.ty - pointer.y) * 0.07;
        const px = pointer.x * halfW;
        const py = pointer.y * halfH;

        for (let i = 0; i < COUNT; i++) {
          const ph = phase[i * 2];
          const sp = phase[i * 2 + 1];
          let x = base[i * 3] * halfW * 0.95 + Math.sin(t * sp + ph) * 1.4;
          let y = base[i * 3 + 1] * halfH * 0.95 + Math.cos(t * sp * 0.8 + ph) * 1.1;
          const z = base[i * 3 + 2] * DEPTH + Math.sin(t * sp * 0.6 + ph * 2) * 1.6;

          const dx = x - px;
          const dy = y - py;
          const d2 = dx * dx + dy * dy;
          const R = 7;
          if (d2 < R * R && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const f = (1 - d / R) * 3.2;
            x += (dx / d) * f;
            y += (dy / d) * f;
          }

          pos[i * 3] = x;
          pos[i * 3 + 1] = y;
          pos[i * 3 + 2] = z;
        }
        geo.attributes.position.needsUpdate = true;

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
            lineCol[o] = tint.r;
            lineCol[o + 1] = tint.g;
            lineCol[o + 2] = tint.b;
            lineCol[o + 3] = tint.r;
            lineCol[o + 4] = tint.g;
            lineCol[o + 5] = tint.b;
            n++;
          }
        }
        lines.setDrawRange(0, n * 2);
        lines.attributes.position.needsUpdate = true;
        lines.attributes.color.needsUpdate = true;

        renderer.render(scene, camera);
      }

      if (reduce) {
        paint(1.7);
      } else {
        const clock = new THREE.Clock();
        (function loop() {
          paint(clock.getElapsedTime());
          requestAnimationFrame(loop);
        })();
      }
    }
  }

  /* -------------------------------------------------------------- cursor */
  if (cursorCanvas && !reduce) {
    let renderer = null;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: cursorCanvas, antialias: true, alpha: true });
    } catch {
      cursorCanvas.remove();
    }

    if (renderer) {
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 0, 12);

      const orb = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 24, 24),
        new THREE.MeshBasicMaterial({ color: accent.clone(), transparent: true, opacity: 0.55 + 0.45 * dim })
      );
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: sprite,
          color: accent.clone(),
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        })
      );
      halo.scale.setScalar(1.5 + 1.1 * dim);
      orb.add(core, halo);
      scene.add(orb);

      const TRAIL = 46;
      const trailPos = new Float32Array(TRAIL * 3);
      const trailCol = new Float32Array(TRAIL * 3);
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
      trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
      scene.add(
        new THREE.Line(
          trailGeo,
          new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.9 * dim,
            depthWrite: false,
          })
        )
      );

      const pulse = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.27, 40),
        new THREE.MeshBasicMaterial({
          color: accent.clone(),
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      scene.add(pulse);
      let pulseT = 1;

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

      window.addEventListener(
        "pointermove",
        (e) => {
          pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
          pointer.ty = -((e.clientY / window.innerHeight) * 2 - 1);
          pointer.moved = performance.now();
        },
        { passive: true }
      );
      window.addEventListener("pointerdown", () => {
        pulseT = 0;
      }, { passive: true });

      watch(() => {
        const c = accent.set(token("--accent", "#b2c27c"));
        ground.set(token("--ground", "#0b120e"));
        dim = 1 - Math.min(Math.max((0.2126 * ground.r + 0.7152 * ground.g + 0.0722 * ground.b - 0.3) / 0.5, 0), 1) * 0.62;
        core.material.opacity = 0.55 + 0.45 * dim;
        halo.material.opacity = 0.4 * dim;
        halo.scale.setScalar(1.5 + 1.1 * dim);
        core.material.color.copy(c);
        halo.material.color.copy(c);
        pulse.material.color.copy(c);
      });

      const target = new THREE.Vector3(0, 0, 0);
      const clock = new THREE.Clock();

      (function loop() {
        const t = clock.getElapsedTime();

        if (performance.now() - pointer.moved > 2600) {
          target.set(
            Math.sin(t * 0.55) * halfW * 0.42,
            Math.cos(t * 0.8) * halfH * 0.4,
            Math.sin(t * 0.4) * 2.5
          );
        } else {
          target.set(pointer.tx * halfW, pointer.ty * halfH, Math.sin(t * 1.3) * 0.6);
        }

        orb.position.lerp(target, 0.14);
        orb.position.z = target.z;

        for (let i = TRAIL - 1; i > 0; i--) {
          trailPos[i * 3] = trailPos[(i - 1) * 3];
          trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1];
          trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2];
        }
        trailPos[0] = orb.position.x;
        trailPos[1] = orb.position.y;
        trailPos[2] = orb.position.z;
        for (let i = 0; i < TRAIL; i++) {
          const k = 1 - i / TRAIL;
          tint.copy(ground).lerp(accent, k);
          trailCol[i * 3] = tint.r;
          trailCol[i * 3 + 1] = tint.g;
          trailCol[i * 3 + 2] = tint.b;
        }
        trailGeo.attributes.position.needsUpdate = true;
        trailGeo.attributes.color.needsUpdate = true;

        if (pulseT < 1) {
          pulseT = Math.min(1, pulseT + 0.022);
          pulse.position.copy(orb.position);
          pulse.scale.setScalar(1 + pulseT * 16);
          pulse.material.opacity = (1 - pulseT) * 0.55 * dim;
        } else {
          pulse.material.opacity = 0;
        }

        renderer.render(scene, camera);
        requestAnimationFrame(loop);
      })();
    }
  }
})();
