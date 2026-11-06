import * as THREE from './three.module.js';

const ART_WIDTH = 1888;
const ART_HEIGHT = 1334;
const SHEET_WIDTH = 5.52;
const SHEET_HEIGHT = SHEET_WIDTH * ART_HEIGHT / ART_WIDTH;
const SHEET_THICKNESS = 0.018;
const FIELD_OF_VIEW = 32;
const HALF_VIEW = Math.tan(THREE.MathUtils.degToRad(FIELD_OF_VIEW / 2));

function materialTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function contactShadow(width, height, texture, opacity) {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  return shadow;
}

function lathe(profile, material) {
  const shape = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 96);
  const mesh = new THREE.Mesh(shape, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeEspresso(scene, shadowTexture) {
  const place = new THREE.Group();
  place.position.set(-3.68, 0, 0.46);
  place.rotation.y = 0.57;
  scene.add(place);

  const shadow = contactShadow(1.75, 1.53, shadowTexture, 0.62);
  shadow.position.x = 0.08;
  place.add(shadow);

  const linen = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.019, 1.38),
    new THREE.MeshStandardMaterial({ color: 0xaaa293, roughness: 0.97 })
  );
  linen.position.set(-0.16, 0.013, 0.11);
  linen.rotation.y = -0.32;
  linen.castShadow = true;
  linen.receiveShadow = true;
  place.add(linen);

  const glaze = new THREE.MeshPhysicalMaterial({ color: 0xe9dfcd, roughness: 0.26, clearcoat: 0.43, clearcoatRoughness: 0.2 });
  const saucer = lathe([
    [0, .019], [.32, .019], [.39, .026], [.47, .047], [.545, .083], [.565, .104],
    [.565, .115], [.55, .121], [.513, .108], [.44, .077], [.36, .055], [.27, .053], [0, .053]
  ], glaze);
  saucer.position.y = 0.025;
  place.add(saucer);

  const cup = new THREE.Group();
  cup.position.set(-0.036, 0.078, -0.025);
  place.add(cup);
  cup.add(lathe([
    [0, .016], [.19, .016], [.224, .02], [.242, .033], [.27, .061], [.296, .10],
    [.317, .15], [.331, .216], [.335, .286], [.333, .339], [.324, .357], [.306, .362],
    [.292, .355], [.289, .331], [.291, .286], [.287, .23], [.276, .17], [.256, .116],
    [.227, .081], [.18, .063], [0, .063]
  ], glaze));

  const handleCurve = new THREE.CatmullRomCurve3([
    [.305, .272, 0], [.397, .30, 0], [.474, .281, 0], [.485, .23, 0],
    [.44, .164, 0], [.372, .118, 0], [.286, .113, 0]
  ].map(point => new THREE.Vector3(...point)));
  const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 32, .033, 12, false), glaze);
  handle.castShadow = true;
  handle.receiveShadow = true;
  cup.add(handle);

  const crema = materialTexture(256, (ctx, size) => {
    const gradient = ctx.createRadialGradient(102, 111, 18, 129, 128, 129);
    gradient.addColorStop(0, '#bb7335');
    gradient.addColorStop(.6, '#98501e');
    gradient.addColorStop(.85, '#743914');
    gradient.addColorStop(.94, '#b77537');
    gradient.addColorStop(1, '#532712');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    let seed = 76341;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 4200; i += 1) {
      ctx.fillStyle = random() < .52 ? '#e7a65a28' : '#30140b20';
      const x = random() * size;
      const y = random() * size;
      ctx.fillRect(x, y, 0.6 + random() * 1.7, 0.6 + random() * 1.7);
    }
    ctx.strokeStyle = '#f0bc7380';
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.ellipse(126, 127, 116, 119, .24, .23, 2.77);
    ctx.stroke();
  });
  const espresso = new THREE.Mesh(
    new THREE.CircleGeometry(.289, 80),
    new THREE.MeshBasicMaterial({ map: crema, toneMapped: false })
  );
  espresso.rotation.x = -Math.PI / 2;
  espresso.position.y = 0.288;
  cup.add(espresso);
}

export async function createTableScene({ mount, images, motion, contextLost }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost();
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x20140d);
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 45);
  const overviewCamera = camera.clone();
  const loader = new THREE.TextureLoader();
  let food, drinks, walnut;
  try {
    [food, drinks, walnut] = await Promise.all([
      loader.loadAsync(images.food), loader.loadAsync(images.drinks), loader.loadAsync('walnut-table.webp')
    ]);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 12);
  for (const texture of [food, drinks, walnut]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
  }

  const daylight = new THREE.DirectionalLight(0xffead4, 2.4);
  daylight.position.set(-3.8, 7.5, -2.2);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(2048, 2048);
  Object.assign(daylight.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.25, far: 19 });
  daylight.shadow.normalBias = 0.014;
  daylight.shadow.bias = -0.00025;
  daylight.shadow.radius = 3;
  scene.add(daylight, new THREE.HemisphereLight(0xfff5ea, 0x6a4735, 1.4));

  const wood = new THREE.MeshStandardMaterial({ map: walnut, color: 0xead7c1, roughness: 0.64 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(17, 0.22, 13), wood);
  table.position.set(0, -0.11, -1.9);
  table.receiveShadow = true;
  scene.add(table);

  const shadowTexture = materialTexture(128, (ctx, size) => {
    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 5, center, center, center);
    gradient.addColorStop(0, '#150c08b0');
    gradient.addColorStop(.43, '#150c086b');
    gradient.addColorStop(1, '#150c0800');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
  makeEspresso(scene, shadowTexture);
  const paperShadow = contactShadow(SHEET_WIDTH + 0.62, SHEET_HEIGHT + 0.54, shadowTexture, 0.28);
  scene.add(paperShadow);

  const placement = new THREE.Group();
  const turntable = new THREE.Group();
  placement.add(turntable);
  scene.add(placement);
  const geometry = new THREE.BoxGeometry(SHEET_WIDTH, SHEET_HEIGHT, SHEET_THICKNESS, 44, 30, 1);
  const vertices = geometry.attributes.position;
  const original = vertices.array.slice();
  const edge = new THREE.MeshStandardMaterial({ color: 0xd8c5a7, roughness: 0.86 });
  const print = map => new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.9, toneMapped: false });
  const sheet = new THREE.Mesh(geometry, [edge, edge, edge, edge, print(food), print(drinks)]);
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  turntable.add(sheet);

  const viewDirection = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const corner = new THREE.Vector3();
  const overviewPaper = new THREE.Matrix4();
  const basePosition = new THREE.Vector3(0, 0.025, 0);
  const baseRotation = new THREE.Quaternion();
  const unitScale = new THREE.Vector3(1, 1, 1);
  let width = 1;
  let height = 1;
  let side = false;
  let focusBox = null;
  let pose;
  let lastBend;
  let transition;
  let frameId = 0;

  function paperPoint(x, y, out) {
    return out.set((x / ART_WIDTH - 0.5) * SHEET_WIDTH, (0.5 - y / ART_HEIGHT) * SHEET_HEIGHT, SHEET_THICKNESS / 2);
  }

  function fitDistance(w, h, fitX, fitY) {
    return Math.max(w / (2 * HALF_VIEW * camera.aspect * fitX), h / (2 * HALF_VIEW * fitY));
  }

  function wholePose(drinksSide = side) {
    return {
      x: width < 700 ? 0 : -0.19, y: -0.055,
      distance: fitDistance(SHEET_WIDTH, SHEET_HEIGHT * 0.94, width < 700 ? 0.86 : 0.71, 0.78),
      elevation: 1.17, azimuth: 0.065, lift: 0, pitch: 0, lean: 0, roll: 0.015,
      turn: drinksSide ? Math.PI : 0, bend: 0
    };
  }

  function goal() {
    const full = wholePose();
    if (!focusBox) return full;
    const [x, y, w, h] = focusBox;
    const point = paperPoint(x + w / 2, y + h / 2, new THREE.Vector3());
    return {
      ...full, distance: full.distance * 0.985, lift: 0.035,
      pitch: 0.035 + point.y * 0.006, lean: -point.x * 0.0125, bend: 0.014
    };
  }

  function placeCamera(view, state, target) {
    viewDirection.set(
      Math.sin(state.azimuth) * Math.cos(state.elevation),
      Math.sin(state.elevation),
      Math.cos(state.azimuth) * Math.cos(state.elevation)
    );
    view.position.copy(target).addScaledVector(viewDirection, state.distance);
    view.lookAt(target);
    view.updateMatrixWorld();
  }

  function keepSheetInFrame(view, sheetMatrix, bend = 0) {
    const horizontal = HALF_VIEW * view.aspect * (1 - Math.min(0.24, 56 / width));
    const vertical = HALF_VIEW * (1 - Math.min(0.34, 100 / height));
    // The box includes the paper's maximum curl and thickness on either face.
    const halfDepth = SHEET_THICKNESS / 2 + 0.027 + Math.abs(bend);
    let pullBack = 0;
    for (const x of [-SHEET_WIDTH / 2, SHEET_WIDTH / 2]) {
      for (const y of [-SHEET_HEIGHT / 2, SHEET_HEIGHT / 2]) {
        for (const z of [-halfDepth, halfDepth]) {
          corner.set(x, y, z).applyMatrix4(sheetMatrix).applyMatrix4(view.matrixWorldInverse);
          const requiredDepth = Math.max(Math.abs(corner.x) / horizontal, Math.abs(corner.y) / vertical);
          pullBack = Math.max(pullBack, corner.z + requiredDepth);
        }
      }
    }
    if (pullBack > 0) {
      view.position.addScaledVector(viewDirection, pullBack);
      view.updateMatrixWorld();
    }
  }

  function flex(bend) {
    if (bend === lastBend) return;
    lastBend = bend;
    for (let i = 0; i < vertices.count; i += 1) {
      const offset = i * 3;
      const x = original[offset] / (SHEET_WIDTH / 2);
      const y = original[offset + 1] / (SHEET_HEIGHT / 2);
      const curl = 0.011 * x ** 2 + 0.016 * Math.max(0, y) ** 2;
      vertices.setZ(i, original[offset + 2] + curl + bend * x ** 2 * (0.72 + 0.28 * y));
    }
    vertices.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  function render(arc = 0) {
    const state = { ...pose, distance: pose.distance + 1.15 * arc };
    placement.position.set(0, basePosition.y + state.lift + 2.55 * arc, 0);
    placement.rotation.set(-Math.PI / 2 + state.pitch + .23 * arc, state.lean, state.roll - .08 * arc);
    turntable.rotation.y = state.turn;
    const bend = state.bend + 0.13 * arc;
    flex(bend);
    placement.updateMatrixWorld(true);
    aim.set(state.x, state.y, 0).applyMatrix4(placement.matrixWorld);
    placeCamera(camera, state, aim);
    keepSheetInFrame(camera, sheet.matrixWorld, bend);
    paperShadow.material.opacity = .28 - .16 * Math.min(1, state.lift + arc);
    renderer.render(scene, camera);
  }

  function cancelMotion() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    if (transition) transition.resolve(false);
    transition = null;
  }

  function step(time) {
    const { from, to, duration, start, resolve, flipping } = transition;
    const t = Math.min(1, (time - start) / duration);
    const ease = t * t * (3 - 2 * t);
    for (const key of Object.keys(to)) pose[key] = THREE.MathUtils.lerp(from[key], to[key], ease);
    render(flipping ? Math.sin(Math.PI * ease) : 0);
    if (t < 1) {
      frameId = requestAnimationFrame(step);
    } else {
      frameId = 0;
      transition = null;
      resolve(true);
    }
  }

  function move(to, duration, flipping = false) {
    cancelMotion();
    if (!pose || motion.matches || duration === 0) {
      pose = to;
      render();
      return Promise.resolve(true);
    }
    return new Promise(resolve => {
      transition = { from: { ...pose }, to, start: performance.now(), duration, flipping, resolve };
      frameId = requestAnimationFrame(step);
    });
  }

  function resize(nextWidth, nextHeight) {
    if (nextWidth < 1 || nextHeight < 1) return;
    width = nextWidth;
    height = nextHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    overviewCamera.aspect = camera.aspect;
    overviewCamera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    const home = wholePose();
    baseRotation.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, home.roll));
    overviewPaper.compose(basePosition, baseRotation, unitScale);
    aim.set(home.x, home.y, 0).applyMatrix4(overviewPaper);
    placeCamera(overviewCamera, home, aim);
    keepSheetInFrame(overviewCamera, overviewPaper);
    if (!transition?.flipping) void move(goal(), 0);
  }

  function projectBox([x, y, w, h]) {
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => {
      paperPoint(px, py, projected).applyMatrix4(overviewPaper).project(overviewCamera);
      return [(projected.x + 1) * width / 2, (1 - projected.y) * height / 2];
    });
  }

  function focus(nextMode, box = null, immediate = false) {
    focusBox = nextMode === 'peek' ? box : null;
    return move(goal(), immediate ? 0 : 280);
  }

  async function turn(drinksSide) {
    if (side === drinksSide) return;
    await focus('whole', null, !focusBox);
    await move(wholePose(drinksSide), 680, true);
    side = drinksSide;
    await focus('whole', null, true);
  }

  function setSide(drinksSide) {
    side = drinksSide;
    return focus('whole', null, true);
  }

  mount.replaceChildren(renderer.domElement);
  resize(mount.clientWidth, mount.clientHeight);
  return { resize, projectBox, focus, turn, setSide, cancelMotion };
}
