// Intro 3D: un computador beige compacto de 1984 sobre un escritorio, con la pregunta
// "Are you from HR?" en su pantalla. Compilar con `npm run build`.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Vector3, Vector2, Raycaster, Color, Group, Mesh, Fog,
  BoxGeometry, PlaneGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, TorusGeometry, CircleGeometry,
  LatheGeometry, ExtrudeGeometry, ShapeGeometry, TubeGeometry, BufferGeometry, Float32BufferAttribute,
  Shape, Path, CatmullRomCurve3, Spherical, Quaternion,
  MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, CanvasTexture,
  SpotLight, PointLight, HemisphereLight, DirectionalLight, InstancedMesh, Object3D,
  PCFShadowMap, ACESFilmicToneMapping, SRGBColorSpace, RepeatWrapping, DoubleSide, MathUtils, PMREMGenerator,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// medidas en decímetros, proporción de un compacto de 1984 (24,6 × 34,4 × 27,6 cm)
const W = 2.46, H = 3.44, D = 2.76, LIFT = 0.08;
const SW = 1.6, SH = 1.2;                 // zona visible del CRT (4:3)
const SY = LIFT + H * 0.66;               // centro de la pantalla
const RECESS = 0.2;                       // profundidad del hueco de la pantalla
const SZ = D / 2 - RECESS;                // plano de los bordes del CRT
const BULGE = 0.045;
const OPEN_W = 2.06, OPEN_H = 1.62;       // boca del hueco en el frente
const BEV = 0.085;                        // bisel de la carcasa
const TAPER_X = 0.025, TAPER_Y = 0.03;    // la carcasa se estrecha hacia atrás
const FOV = 35;
const TEX_W = 1024, TEX_H = 768, TEX_R = 36;
const PHOS = '#4dff88', PHOS_DIM = '#2f9c5a', CRT_BG = '#041008';

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createScene(canvas, { reduce = false } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.background = new Color('#050506');
  scene.fog = new Fog('#050506', 13, 27);
  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.05;
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);

  const M = materials();
  const disposables = [envTex, pmrem, M.grain];

  // ---------- luz ----------
  scene.add(new HemisphereLight('#ffe9cc', '#0a0805', 0.12));
  const lampPos = new Vector3(-2.5, 5.1, 3.4);
  const lampTarget = new Vector3(0.25, 1.55, 0.7);
  const spot = new SpotLight('#ffc98a', 95, 22, 0.6, 0.85, 2);
  spot.position.copy(lampPos);
  spot.target.position.copy(lampTarget);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.bias = -0.0003;
  spot.shadow.normalBias = 0.02;
  scene.add(spot, spot.target);
  const rim = new DirectionalLight('#9fb4ff', 0.14);
  rim.position.set(-5, 6, -7);
  rim.target.position.set(0, 1.5, 0);
  scene.add(rim, rim.target);
  const glow = new PointLight(PHOS, 0, 3, 2);
  glow.position.set(0, SY, D / 2 + 1.1);
  scene.add(glow);

  // ---------- escritorio y pared ----------
  const wood = woodTextures();
  disposables.push(wood.map, wood.bump);
  const desk = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 0.6, roughness: 0.78 }));
  desk.rotation.x = -Math.PI / 2;
  desk.receiveShadow = true;
  const wall = new Mesh(new PlaneGeometry(40, 20), new MeshStandardMaterial({ color: '#121014', roughness: 1 }));
  wall.position.set(0, 10, -10);
  scene.add(desk, wall);

  // ---------- pantalla (textura del CRT) ----------
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = TEX_W; screenCanvas.height = TEX_H;
  const ctx = screenCanvas.getContext('2d');
  const screenTex = new CanvasTexture(screenCanvas);
  screenTex.colorSpace = SRGBColorSpace;
  screenTex.anisotropy = 8;
  disposables.push(screenTex);

  // ---------- el computador ----------
  const mac = buildMac(M, screenTex);
  scene.add(mac.group);
  const screen = mac.screen;

  // ---------- teclado, mouse, cables y cosas del escritorio ----------
  const KB_Z = D / 2 + 1.2;
  const kb = buildKeyboard(M);
  kb.position.set(-0.05, 0, KB_Z);
  kb.rotation.y = 0.03;
  const mouse = buildMouse(M);
  mouse.position.set(2.05, 0, KB_Z + 0.1);
  mouse.rotation.y = -0.18;
  scene.add(kb, mouse);
  scene.add(coiledCord(M, [
    new Vector3(-1.05, 0.15, KB_Z - 0.5), new Vector3(-1.2, 0.05, KB_Z - 0.72),
    new Vector3(-1.45, 0.045, D / 2 + 0.42), new Vector3(-1.2, 0.045, D / 2 + 0.16),
    new Vector3(-0.93, 0.1, D / 2 + 0.05), new Vector3(-0.86, LIFT + 0.22, D / 2 + 0.012),
  ]));
  scene.add(cord(M, [
    new Vector3(2.0, 0.07, KB_Z - 0.22), new Vector3(1.95, 0.03, KB_Z - 0.55),
    new Vector3(1.8, 0.025, D / 2 + 0.3), new Vector3(1.55, 0.025, 0.4),
    new Vector3(1.45, 0.03, -0.6), new Vector3(1.05, 0.2, -D / 2 - 0.06),
  ], 0.013));
  const props = buildProps(M);
  scene.add(props);
  scene.add(buildLamp(M, lampPos, lampTarget));

  // ---------- texto del CRT ----------
  const st = { power: 0, lines: [], cursor: true, hover: null, buttons: null, say: null, ask: false };
  const FONT = (px) => `${px}px "VT323", monospace`;

  function drawScreen(now = performance.now()) {
    ctx.fillStyle = '#020403';
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    ctx.save();
    roundRect(ctx, 0, 0, TEX_W, TEX_H, TEX_R);
    ctx.clip();
    ctx.fillStyle = CRT_BG;
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    if (st.power > 0) {
      const h = Math.max(4, TEX_H * st.power);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, (TEX_H - h) / 2, TEX_W, h);
      ctx.clip();
      if (st.power < 1) {
        ctx.fillStyle = 'rgba(200,255,220,0.85)';
        ctx.fillRect(0, (TEX_H - h) / 2, TEX_W, h);
      } else {
        ctx.shadowColor = PHOS;
        ctx.shadowBlur = 14;
        ctx.textBaseline = 'top';
        let y = 64;
        for (const l of st.lines) {
          ctx.font = FONT(l.size || 46);
          ctx.fillStyle = l.dim ? PHOS_DIM : PHOS;
          ctx.fillText(l.text, 80, y);
          y += (l.size || 46) * 1.12;
        }
        st.buttons = null;
        if (st.ask) {
          ctx.font = FONT(104);
          ctx.fillStyle = PHOS;
          ctx.fillText('Are you from HR?', 80, y + 50);
          const by = y + 220, bh = 84;
          const btn = (label, x, key) => {
            ctx.font = FONT(64);
            const w = ctx.measureText(label).width + 48;
            const on = st.hover === key;
            ctx.lineWidth = 3;
            ctx.strokeStyle = PHOS;
            ctx.strokeRect(x, by, w, bh);
            if (on) { ctx.fillStyle = PHOS; ctx.fillRect(x, by, w, bh); }
            ctx.fillStyle = on ? '#001a08' : PHOS;
            ctx.fillText(label, x + 24, by + 10);
            return { x, y: by, w, h: bh };
          };
          const yes = btn('[Y] yes', 80, 'hr');
          const no = btn('[N] no', 80 + yes.w + 60, 'terminal');
          st.buttons = { hr: yes, terminal: no };
          if (st.cursor && Math.floor(now / 530) % 2 === 0) {
            ctx.fillStyle = PHOS;
            ctx.fillRect(80 + yes.w + no.w + 110, by + 10, 34, 64);
          }
        }
        if (st.say) {
          ctx.font = FONT(52);
          ctx.fillStyle = PHOS;
          ctx.fillText(st.say, 80, TEX_H - 150);
        }
      }
      ctx.restore();
    }
    // líneas de barrido, viñeta y un reflejo suave del vidrio
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < TEX_H; y += 4) ctx.fillRect(0, y, TEX_W, 1.5);
    const g = ctx.createRadialGradient(TEX_W / 2, TEX_H / 2, TEX_H * 0.35, TEX_W / 2, TEX_H / 2, TEX_W * 0.68);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    ctx.restore();
    screenTex.needsUpdate = true;
  }

  // ---------- cámara ----------
  const lookAsk = new Vector3(0.3, 1.5, 0.9);
  const screenCenter = new Vector3(0, SY, SZ);
  const FRONT_OFF = 0.0; // la cámara mira un poco más abajo para que se vea el borde de arriba del PC
  const frontLook = new Vector3(0, SY - FRONT_OFF, SZ);
  const camAsk = new Vector3(), sphAsk = new Spherical(), sphFar = new Spherical();
  // pose de la pregunta: tres cuartos en pantallas anchas, casi de frente y más lejos en vertical
  function askPose() {
    const portrait = MathUtils.clamp((1.3 - camera.aspect) / 0.8, 0, 1);
    const dir = new Vector3().lerpVectors(new Vector3(0.45, 0.15, 1), new Vector3(0.14, 0.12, 1), portrait).normalize();
    const hHalf = Math.tan(MathUtils.degToRad(FOV / 2)) * camera.aspect;
    const dist = Math.max(9.6, 1.7 / hHalf + 1.4);
    camAsk.copy(lookAsk).addScaledVector(dir, dist);
    sphAsk.setFromVector3(new Vector3().subVectors(camAsk, lookAsk));
    // la llegada: más lejos, más alto y desde la izquierda, en arco
    sphFar.set(sphAsk.radius * 1.75, sphAsk.phi - 0.32, sphAsk.theta - 0.75);
  }
  const pointer = new Vector2(0, 0), parallax = new Vector2(0, 0);
  let mode = 'intro'; // intro | ask | moving | front
  const anims = [];
  let raf = 0, running = false, onChoose = null;

  function frontPosition(fill = 0.44, look = frontLook) {
    const t = Math.tan(MathUtils.degToRad(FOV / 2));
    const vh = Math.max(SH / fill, SW / (0.6 * camera.aspect));
    return new Vector3(0, look.y, SZ + vh / (2 * t));
  }

  function animate(dur, fn) {
    return new Promise((res) => anims.push({ t0: performance.now(), dur: reduce ? 1 : dur, fn, res }));
  }

  function tick(now) {
    raf = 0;
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      const p = Math.min(1, (now - a.t0) / a.dur);
      a.fn(p);
      if (p >= 1) { anims.splice(i, 1); a.res(); }
    }
    if (mode === 'ask') {
      parallax.lerp(pointer, 0.05);
      camera.position.set(camAsk.x + parallax.x * 0.45, camAsk.y - parallax.y * 0.25, camAsk.z);
      camera.lookAt(lookAsk);
    }
    if (st.power >= 1) glow.intensity = 0.45 + Math.sin(now / 90) * 0.02;
    if (st.power > 0) drawScreen(now);
    renderer.render(scene, camera);
    if (running && (anims.length || mode === 'ask' || mode === 'intro' || mode === 'moving')) raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf && running) raf = requestAnimationFrame(tick); }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    askPose();
    if (mode === 'front') {
      camera.position.copy(frontPosition());
      camera.lookAt(frontLook);
    }
    renderer.render(scene, camera);
  }

  // ---------- interacción con los botones de la pantalla ----------
  const ray = new Raycaster();
  function hitButton(ev) {
    if (mode !== 'ask' || !st.buttons) return null;
    const r = canvas.getBoundingClientRect();
    const v = new Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v, camera);
    const hit = ray.intersectObject(screen)[0];
    if (!hit || !hit.uv) return null;
    const x = hit.uv.x * TEX_W, y = (1 - hit.uv.y) * TEX_H;
    for (const key of ['hr', 'terminal']) {
      const b = st.buttons[key];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return key;
    }
    return null;
  }
  const onMove = (ev) => {
    pointer.set((ev.clientX / window.innerWidth) * 2 - 1, (ev.clientY / window.innerHeight) * 2 - 1);
    st.hover = hitButton(ev);
    canvas.style.cursor = st.hover ? 'pointer' : '';
  };
  const onClick = (ev) => { const k = hitButton(ev); if (k && onChoose) onChoose(k); };
  window.addEventListener('pointermove', onMove);
  canvas.addEventListener('click', onClick);

  async function typeLine(text, opts = {}) {
    const line = { text: '', ...opts };
    st.lines.push(line);
    if (reduce) { line.text = text; return; }
    for (let i = 1; i <= text.length; i++) {
      line.text = text.slice(0, i);
      await sleep(opts.speed || 22);
    }
  }

  // ---------- API ----------
  return {
    set onChoose(fn) { onChoose = fn; },

    // arranque completo: la cámara llega en arco, el monitor se prende y pregunta
    async boot() {
      running = true;
      resize();
      await document.fonts.load(FONT(46)).catch(() => {});
      const sph = new Spherical();
      const place = (e) => {
        sph.set(
          MathUtils.lerp(sphFar.radius, sphAsk.radius, e),
          MathUtils.lerp(sphFar.phi, sphAsk.phi, e),
          MathUtils.lerp(sphFar.theta, sphAsk.theta, e),
        );
        camera.position.setFromSpherical(sph).add(lookAsk);
        camera.lookAt(lookAsk);
      };
      place(0);
      mode = 'intro';
      kick();
      const move = animate(2600, (p) => place(easeOut(p)));
      await sleep(reduce ? 0 : 900);
      await animate(420, (p) => { st.power = Math.max(0.01, easeOut(p) * 0.999); glow.intensity = 0.45 * p; });
      st.power = 1;
      await typeLine('DANYW24 SYSTEM 1.0', { dim: true, size: 42 });
      await typeLine('memory check ........ 640K OK', { dim: true, size: 42, speed: 12 });
      await typeLine('mounting research/ automation/ ... ok', { dim: true, size: 42, speed: 12 });
      await move;
      st.ask = true;
      mode = 'ask';
      kick();
    },

    // el visitante eligió HR: el monitor lo dice y el sitio funde a blanco
    sayHR() {
      st.ask = false;
      st.say = 'switching to recruiter mode...';
      kick();
    },

    // cámara de frente al PC; la pantalla queda lista para el HTML encima
    async goFront({ instant = false } = {}) {
      running = true;
      resize();
      const to = frontPosition();
      st.ask = false;
      if (instant || reduce) {
        mode = 'front';
        camera.position.copy(to);
        camera.lookAt(frontLook);
        st.power = 1; st.lines = []; st.say = null;
        glow.intensity = 0.45;
        drawScreen();
        renderer.render(scene, camera);
        running = false;
        return;
      }
      st.say = 'loading terminal...';
      mode = 'moving';
      kick();
      const from = camera.position.clone(), lookFrom = lookAsk.clone();
      const lk = new Vector3();
      await animate(1600, (p) => {
        const e = easeInOut(p);
        camera.position.lerpVectors(from, to, e);
        lk.lerpVectors(lookFrom, frontLook, e);
        camera.lookAt(lk);
      });
      mode = 'front';
      st.lines = []; st.say = null;
      drawScreen();
      renderer.render(scene, camera);
      running = false;
    },

    // móvil: la cámara entra en la pantalla hasta llenarla
    async goInto() {
      running = true;
      mode = 'moving';
      st.ask = false; st.say = 'loading terminal...';
      kick();
      const from = camera.position.clone(), to = frontPosition(1.05, screenCenter), lk = new Vector3();
      await animate(1300, (p) => {
        const e = easeInOut(p);
        camera.position.lerpVectors(from, to, e);
        lk.lerpVectors(lookAsk, screenCenter, e);
        camera.lookAt(lk);
      });
      running = false;
    },

    // rectángulo de la pantalla en píxeles CSS (con la cámara de frente)
    screenRect() {
      const r = canvas.getBoundingClientRect();
      camera.updateMatrixWorld();
      const pts = [[-SW / 2, SH / 2], [SW / 2, -SH / 2]].map(([x, y]) => {
        const v = new Vector3(x, SY + y, SZ).project(camera);
        return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
      });
      return { x: pts[0][0], y: pts[0][1], w: pts[1][0] - pts[0][0], h: pts[1][1] - pts[0][1] };
    },

    resize,

    dispose() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('click', onClick);
      scene.traverse((ob) => {
        if (ob.geometry) ob.geometry.dispose();
        if (ob.material) [].concat(ob.material).forEach((m) => m.dispose());
      });
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}

/* =====================================================================
   Materiales
   ===================================================================== */
function materials() {
  const grain = noiseTexture(256, 7);
  grain.repeat.set(3, 3);
  const plastic = (color, rough = 0.58) => new MeshPhysicalMaterial({
    color, roughness: rough, bumpMap: grain, bumpScale: 0.25, clearcoat: 0.08, clearcoatRoughness: 0.6,
  });
  return {
    grain,
    beige: plastic('#d8ceb4'),
    beigeDark: plastic('#c3b99e', 0.66),
    seam: new MeshStandardMaterial({ color: '#8f866f', roughness: 0.8 }),
    keyLight: plastic('#e7e0cd', 0.5),
    keyDark: plastic('#cfc6ad', 0.55),
    black: new MeshStandardMaterial({ color: '#0b0b0b', roughness: 0.45 }),
    tube: new MeshPhysicalMaterial({ color: '#050605', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 }),
    glass: new MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, roughness: 0.04, clearcoat: 1, depthWrite: false }),
    cable: new MeshStandardMaterial({ color: '#9b927c', roughness: 0.55 }),
    metal: new MeshStandardMaterial({ color: '#1c1e1b', roughness: 0.38, metalness: 0.7 }),
    enamel: new MeshStandardMaterial({ color: '#1e3a2a', roughness: 0.42, metalness: 0.25, side: DoubleSide }),
    ceramic: new MeshPhysicalMaterial({ color: '#ebe7de', roughness: 0.22, clearcoat: 0.6 }),
    coffee: new MeshStandardMaterial({ color: '#1f130b', roughness: 0.15 }),
    disk: new MeshStandardMaterial({ color: '#232326', roughness: 0.5 }),
    shutter: new MeshStandardMaterial({ color: '#b8bcc2', roughness: 0.32, metalness: 0.85 }),
  };
}

/* =====================================================================
   El computador
   ===================================================================== */
function buildMac(M, screenTex) {
  const g = new Group();
  const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  // carcasa: rectángulo redondeado extruido con bisel y la boca de la pantalla como agujero
  const shape = rrPath(new Shape(), W - 2 * BEV, H - 2 * BEV, 0.15, 0, 0);
  shape.holes.push(rrPath(new Path(), OPEN_W, OPEN_H, 0.1, 0, SY - (LIFT + H / 2)));
  const depth = D - 2 * BEV;
  const body = new ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 5, curveSegments: 12,
  });
  body.translate(0, LIFT + H / 2, -depth / 2);
  taper(body);
  body.computeVertexNormals();
  g.add(shadowy(new Mesh(body, M.beige)));

  // tapa trasera interna del túnel (no se ve, pero cierra la caja)
  const plug = new Mesh(new PlaneGeometry(OPEN_W, OPEN_H), M.black);
  plug.position.set(0, SY, -D / 2 + 0.2);
  g.add(plug);

  // hueco de la pantalla: rampa desde la boca hasta el tubo
  const funnel = frameFunnel(
    OPEN_W - 2 * BEV, OPEN_H - 2 * BEV, 0.08, D / 2 - BEV,
    SW + 0.06, SH + 0.06, 0.05, SZ - 0.004,
  );
  funnel.translate(0, SY, 0);
  g.add(shadowy(new Mesh(funnel, M.beigeDark)));

  // el tubo: vidrio negro con el CRT encima, un poco abombado
  const tube = new Mesh(new ShapeGeometry(rrPath(new Shape(), SW + 0.07, SH + 0.07, 0.06, 0, 0), 8), M.tube);
  tube.position.set(0, SY, SZ - 0.006);
  g.add(tube);
  const sGeo = new PlaneGeometry(SW, SH, 40, 30);
  const pos = sGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (SW / 2), y = pos.getY(i) / (SH / 2);
    pos.setZ(i, BULGE * (1 - x * x) * (1 - y * y));
  }
  sGeo.computeVertexNormals();
  const screen = new Mesh(sGeo, new MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.set(0, SY, SZ);
  const glass = new Mesh(sGeo, M.glass);
  glass.position.set(0, SY, SZ + 0.004);
  g.add(screen, glass);

  // línea de unión alrededor de la parte baja (frente y lados)
  const seamY = LIFT + 1.02;
  const front = new BoxGeometry(W - 2 * BEV - 0.04, 0.014, 0.012);
  front.translate(0, seamY, D / 2 + 0.002);
  const sideL = new BoxGeometry(0.012, 0.014, D - 2 * BEV - 0.06);
  sideL.translate(-W / 2 - 0.002, seamY, 0);
  const sideR = sideL.clone();
  sideR.translate(W + 0.004, 0, 0);
  [front, sideL, sideR].forEach((s) => { taper(s); g.add(new Mesh(s, M.seam)); });

  // manija: canal hundido arriba, cerca de la parte de atrás
  const handle = new RoundedBoxGeometry(1.55, 0.09, 0.22, 3, 0.04);
  handle.translate(0, LIFT + H - 0.035, -D / 2 + 0.4);
  taper(handle);
  g.add(new Mesh(handle, new MeshStandardMaterial({ color: '#4a4436', roughness: 0.9 })));

  // base hundida
  const foot = new RoundedBoxGeometry(W - 0.22, LIFT + 0.04, D - 0.3, 2, 0.03);
  foot.translate(0, (LIFT + 0.04) / 2, 0);
  g.add(shadowy(new Mesh(foot, M.beigeDark)));

  // disquetera: marco, ranura y botón de expulsión
  const fy = LIFT + 0.66;
  const surround = new Mesh(new RoundedBoxGeometry(1.0, 0.24, 0.024, 2, 0.01), M.beigeDark);
  surround.position.set(0.42, fy, D / 2 + 0.006);
  const slot = new Mesh(new RoundedBoxGeometry(0.82, 0.05, 0.03, 2, 0.012), M.black);
  slot.position.set(0.42, fy + 0.01, D / 2 + 0.012);
  const eject = new Mesh(new CylinderGeometry(0.017, 0.017, 0.02, 14), M.black);
  eject.rotation.x = Math.PI / 2;
  eject.position.set(0.86, fy - 0.07, D / 2 + 0.014);
  g.add(surround, slot, eject);

  // placa con el nombre (sin logos) y conector del teclado
  const badgeTex = labelTexture('danyw24', '#6d6553', '#c9bfa4', 256, 64, 44);
  const badge = new Mesh(new RoundedBoxGeometry(0.34, 0.085, 0.016, 2, 0.006),
    [M.beigeDark, M.beigeDark, M.beigeDark, M.beigeDark, new MeshStandardMaterial({ map: badgeTex, roughness: 0.6 }), M.beigeDark]);
  badge.position.set(-0.7, fy, D / 2 + 0.006);
  const jack = new Mesh(new RoundedBoxGeometry(0.13, 0.09, 0.02, 2, 0.008), M.black);
  jack.position.set(-0.86, LIFT + 0.22, D / 2 + 0.004);
  g.add(badge, jack);

  return { group: g, screen };
}

// la carcasa es un poco más chica atrás que adelante
function taper(geo) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = MathUtils.clamp((D / 2 - p.getZ(i)) / D, 0, 1);
    p.setX(i, p.getX(i) * (1 - TAPER_X * t));
    p.setY(i, LIFT + (p.getY(i) - LIFT) * (1 - TAPER_Y * t));
  }
  p.needsUpdate = true;
}

/* =====================================================================
   Teclado: cuña con teclas por filas
   ===================================================================== */
function buildKeyboard(M) {
  const g = new Group();
  const KW = 2.86, KD = 1.04, HF = 0.1, HB = 0.2;
  const prof = new Shape();
  prof.moveTo(0, 0); prof.lineTo(KD, 0); prof.lineTo(KD, HB); prof.lineTo(0, HF); prof.lineTo(0, 0);
  const caseGeo = new ExtrudeGeometry(prof, { depth: KW - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 });
  caseGeo.rotateY(Math.PI / 2);
  caseGeo.translate(-(KW - 0.06) / 2, 0, KD / 2);
  caseGeo.computeVertexNormals();
  const kcase = new Mesh(caseGeo, M.beige);
  kcase.castShadow = kcase.receiveShadow = true;
  g.add(kcase);

  // superficie superior inclinada: las teclas viven en este grupo
  const slope = Math.atan((HB - HF) / KD);
  const top = new Group();
  top.position.set(0, (HF + HB) / 2 + 0.03, 0);
  top.rotation.x = slope;
  g.add(top);

  const U = 0.172, GAP = 0.024;
  const rows = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
    [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
    [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
    [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
    [1.5, 1.5, 9, 1.5, 1.5],
  ];
  const well = new Mesh(new PlaneGeometry(15 * U + 0.05, rows.length * U + 0.05), new MeshStandardMaterial({ color: '#a99f86', roughness: 0.9 }));
  well.rotation.x = -Math.PI / 2;
  well.position.y = 0.002;
  top.add(well);

  const unitGeo = keycap(U - GAP, U - GAP);
  const unitCount = rows.flat().filter((w) => w === 1).length;
  const unit = new InstancedMesh(unitGeo, M.keyLight, unitCount);
  unit.castShadow = true;
  const o = new Object3D();
  const cache = new Map();
  let n = 0;
  rows.forEach((row, r) => {
    let x = -7.5 * U;
    const z = (r - (rows.length - 1) / 2) * U;
    row.forEach((w) => {
      const cx = x + (w * U) / 2;
      if (w === 1) {
        o.position.set(cx, 0.04, z);
        o.updateMatrix();
        unit.setMatrixAt(n++, o.matrix);
      } else {
        if (!cache.has(w)) cache.set(w, keycap(w * U - GAP, U - GAP));
        const k = new Mesh(cache.get(w), M.keyDark);
        k.position.set(cx, 0.04, z);
        k.castShadow = true;
        top.add(k);
      }
      x += w * U;
    });
  });
  top.add(unit);

  // leyendas impresas: una calcomanía transparente justo encima de las tapas
  const labels = [
    ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'backspace'],
    ['tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
    ['caps lock', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'return'],
    ['shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'shift'],
    ['option', 'cmd', '', 'enter', 'option'],
  ];
  const PPU = 104;
  const c = document.createElement('canvas');
  c.width = 15 * PPU; c.height = rows.length * PPU;
  const x2 = c.getContext('2d');
  x2.fillStyle = '#3e382c';
  x2.textBaseline = 'top';
  rows.forEach((row, r) => {
    let u = 0;
    row.forEach((w, i) => {
      const txt = labels[r][i] || '';
      const small = txt.length > 1;
      x2.font = small ? '700 19px Arial, Helvetica, sans-serif' : '700 33px Arial, Helvetica, sans-serif';
      x2.fillText(txt, (u + 0.22) * PPU, (r + (small ? 0.52 : 0.2)) * PPU);
      u += w;
    });
  });
  const legendTex = new CanvasTexture(c);
  legendTex.colorSpace = SRGBColorSpace;
  legendTex.anisotropy = 8;
  const legend = new Mesh(new PlaneGeometry(15 * U, rows.length * U), new MeshStandardMaterial({
    map: legendTex, transparent: true, depthWrite: false, roughness: 0.6,
    polygonOffset: true, polygonOffsetFactor: -2,
  }));
  legend.rotation.x = -Math.PI / 2;
  legend.position.y = 0.04 + 0.0375 + 0.0012;
  top.add(legend);
  return g;
}

// tecla: caja redondeada que se angosta arriba
function keycap(w, d) {
  const h = 0.075;
  const geo = new RoundedBoxGeometry(w, h, d, 2, 0.016);
  const p = geo.attributes.position;
  const ins = 0.016; // la tapa queda 1,6 mm más adentro por lado, igual en teclas anchas y angostas
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + h / 2) / h;
    p.setX(i, p.getX(i) * (1 - (ins * t) / (w / 2)));
    p.setZ(i, p.getZ(i) * (1 - (ins * t) / (d / 2)));
  }
  geo.computeVertexNormals();
  return geo;
}

/* =====================================================================
   Mouse de un botón
   ===================================================================== */
function buildMouse(M) {
  const g = new Group();
  const body = new Mesh(new RoundedBoxGeometry(0.4, 0.135, 0.64, 3, 0.045), M.beige);
  body.position.y = 0.0675;
  body.castShadow = body.receiveShadow = true;
  const button = new Mesh(new RoundedBoxGeometry(0.35, 0.03, 0.22, 2, 0.012), M.keyDark);
  button.position.set(0, 0.137, -0.17);
  button.castShadow = true;
  const gap = new Mesh(new BoxGeometry(0.352, 0.004, 0.006), M.seam);
  gap.position.set(0, 0.136, -0.055);
  g.add(body, button, gap);
  return g;
}

/* =====================================================================
   Cables
   ===================================================================== */
function cord(M, pts, r = 0.012) {
  const m = new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), 200, r, 8, false), M.cable);
  m.castShadow = true;
  return m;
}

// cable en espiral: hélice alrededor de un camino suave
function coiledCord(M, pts) {
  const base = new CatmullRomCurve3(pts);
  const N = 1400, turns = 64, R = 0.026;
  const frames = base.computeFrenetFrames(N, false);
  const coil = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = t * turns * Math.PI * 2;
    const ramp = Math.min(1, t * 12, (1 - t) * 12); // los extremos salen rectos
    const p = base.getPointAt(t);
    p.addScaledVector(frames.normals[i], Math.cos(a) * R * ramp);
    p.addScaledVector(frames.binormals[i], Math.sin(a) * R * ramp);
    coil.push(p);
  }
  const m = new Mesh(new TubeGeometry(new CatmullRomCurve3(coil), N * 2, 0.008, 6, false), M.cable);
  m.castShadow = true;
  return m;
}

/* =====================================================================
   Escritorio: taza y disquetes
   ===================================================================== */
function buildProps(M) {
  const g = new Group();

  // taza
  const prof = [
    [0.0, 0.0], [0.3, 0.0], [0.33, 0.03], [0.35, 0.86], [0.335, 0.9], [0.31, 0.88], [0.3, 0.1], [0.0, 0.1],
  ].map(([x, y]) => new Vector2(x, y));
  const mug = new Group();
  const cup = new Mesh(new LatheGeometry(prof, 48), M.ceramic);
  cup.castShadow = true;
  const coffee = new Mesh(new CircleGeometry(0.305, 40), M.coffee);
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.74;
  const handle = new Mesh(new TorusGeometry(0.17, 0.035, 12, 28, Math.PI), M.ceramic);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.34, 0.45, 0);
  handle.castShadow = true;
  mug.add(cup, coffee, handle);
  mug.position.set(2.35, 0, 0.35);
  mug.rotation.y = 0.9;
  g.add(mug);

  // dos disquetes de 3,5"
  const disk = (label, x, z, ry, y = 0) => {
    const d = new Group();
    const shell = new Mesh(new RoundedBoxGeometry(0.9, 0.032, 0.94, 2, 0.01), M.disk);
    shell.castShadow = shell.receiveShadow = true;
    const shutter = new Mesh(new BoxGeometry(0.5, 0.036, 0.3), M.shutter);
    shutter.position.set(-0.05, 0, -0.32);
    const tex = labelTexture(label, '#1d2a6b', '#efeadf', 256, 160, 56);
    const lab = new Mesh(new PlaneGeometry(0.66, 0.4), new MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    lab.rotation.x = -Math.PI / 2;
    lab.position.set(0, 0.0175, 0.2);
    d.add(shell, shutter, lab);
    d.position.set(x, 0.016 + y, z);
    d.rotation.y = ry;
    return d;
  };
  g.add(disk('mcp-radar', -2.35, D / 2 + 1.25, 0.35));
  g.add(disk('php2shell', -2.25, D / 2 + 1.1, 0.12, 0.034));
  return g;
}

/* =====================================================================
   Lámpara de escritorio (la que ilumina la escena)
   ===================================================================== */
function buildLamp(M, bulbPos, target) {
  const g = new Group();
  const basePos = new Vector3(-4.6, 0, 0.2);
  const joint = new Vector3(-4.8, 3.7, 0.9);
  const dir = new Vector3().subVectors(target, bulbPos).normalize();
  const pivot = bulbPos.clone().addScaledVector(dir, -0.45);

  const base = new Mesh(new CylinderGeometry(0.42, 0.48, 0.09, 40), M.metal);
  base.position.copy(basePos).setY(0.045);
  g.add(base);
  g.add(rod(M.metal, basePos.clone().setY(0.09), joint, 0.04));
  g.add(rod(M.metal, joint, pivot, 0.035));
  const knuckle = new Mesh(new SphereGeometry(0.07, 16, 12), M.metal);
  knuckle.position.copy(joint);
  g.add(knuckle);

  // pantalla de la lámpara: cono abierto apuntando al computador
  const shade = new Mesh(new ConeGeometry(0.62, 0.8, 40, 1, true), M.enamel);
  shade.position.copy(bulbPos).addScaledVector(dir, -0.05);
  shade.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), dir);
  const bulb = new Mesh(new SphereGeometry(0.17, 20, 14), new MeshBasicMaterial({ color: '#fff1d0' }));
  bulb.position.copy(bulbPos).addScaledVector(dir, -0.12);
  g.add(shade, bulb);
  return g;
}

function rod(mat, a, b, r) {
  const len = a.distanceTo(b);
  const m = new Mesh(new CylinderGeometry(r, r, len, 14), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3().subVectors(b, a).normalize()));
  return m;
}

/* =====================================================================
   Geometría auxiliar
   ===================================================================== */
function rrPath(path, w, h, r, cx, cy) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  path.moveTo(x0 + r, y0);
  path.lineTo(x1 - r, y0); path.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x1, y1 - r); path.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  path.lineTo(x0 + r, y1); path.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x0, y0 + r); path.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}

function rrPoints(w, h, r, seg) {
  const out = [];
  const corners = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 0.5], [-w / 2 + r, -h / 2 + r, 1], [w / 2 - r, -h / 2 + r, 1.5]];
  for (const [cx, cy, a0] of corners) {
    for (let s = 0; s <= seg; s++) {
      const a = (a0 + (s / seg) * 0.5) * Math.PI;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return out;
}

// marco en rampa entre dos rectángulos redondeados a distinta profundidad
function frameFunnel(ow, oh, or, oz, iw, ih, ir, iz, seg = 8) {
  const a = rrPoints(ow, oh, or, seg), b = rrPoints(iw, ih, ir, seg);
  const n = a.length, posArr = [], idx = [];
  for (let i = 0; i < n; i++) posArr.push(a[i][0], a[i][1], oz);
  for (let i = 0; i < n; i++) posArr.push(b[i][0], b[i][1], iz);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    idx.push(i, j, n + j, i, n + j, n + i);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(posArr, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/* =====================================================================
   Texturas procedurales
   ===================================================================== */
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function noiseTexture(size, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size), rnd = rng(seed);
  for (let i = 0; i < size * size; i++) {
    const v = 110 + rnd() * 40;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

function woodTextures() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#2e2016';
  g.fillRect(0, 0, S, S);
  const rnd = rng(7);
  for (let i = 0; i < 520; i++) {
    const y = rnd() * S, a = 0.025 + rnd() * 0.08;
    g.strokeStyle = rnd() > 0.5 ? `rgba(128,86,52,${a})` : `rgba(8,5,2,${a})`;
    g.lineWidth = 0.6 + rnd() * 3;
    g.beginPath();
    g.moveTo(0, y);
    const f = 40 + rnd() * 90, amp = 1 + rnd() * 4;
    for (let x = 0; x <= S; x += 24) g.lineTo(x, y + Math.sin(x / f + i) * amp);
    g.stroke();
  }
  for (let i = 0; i < 18; i++) { // nudos y vetas oscuras
    const x = rnd() * S, y = rnd() * S, r = 6 + rnd() * 18;
    const k = g.createRadialGradient(x, y, 0, x, y, r * 3);
    k.addColorStop(0, 'rgba(10,6,3,0.35)');
    k.addColorStop(1, 'rgba(10,6,3,0)');
    g.fillStyle = k;
    g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }
  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.repeat.set(4, 4);
  map.anisotropy = 8;
  const bump = new CanvasTexture(c);
  bump.wrapS = bump.wrapT = RepeatWrapping;
  bump.repeat.set(4, 4);
  return { map, bump };
}

function labelTexture(text, ink, paper, w, h, px) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = paper;
  g.fillRect(0, 0, w, h);
  g.fillStyle = ink;
  g.font = `${px}px "VT323", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
