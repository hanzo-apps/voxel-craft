// Chunk — a first-person voxel sandbox. Procedural terrain, greedy-ish face
// culling into ONE merged BufferGeometry per chunk, walk/fly controls, and
// place/break editing that re-meshes only the touched chunk.
//
// The template's lesson: a voxel world is a MESHING problem, not a drawing
// problem. 32^3 voxels is 32768 cubes; emitting only the faces that touch air
// cuts that to a few thousand triangles and holds 60 fps on a laptop.
import * as THREE from 'three';

const CH = 16;                 // chunk edge in voxels
const RAD = 4;                 // chunks from origin in x/z
const H = 24;                  // world height in voxels
const hud = (t) => { document.getElementById('hud').innerHTML = t; };

const PALETTE = [
  null,
  new THREE.Color(0x4ade80), // 1 grass
  new THREE.Color(0x92703a), // 2 dirt
  new THREE.Color(0x94a3b8), // 3 stone
  new THREE.Color(0x38bdf8), // 4 water
  new THREE.Color(0xfbbf24), // 5 sand
  new THREE.Color(0xf472b6), // 6 the block you place
];

// ---- world storage: one flat Uint8Array per chunk ------------------------
const chunks = new Map();                       // "cx,cz" -> {data, mesh}
const key = (cx, cz) => cx + ',' + cz;
const idx = (x, y, z) => (y * CH + z) * CH + x;

function noise2(x, z) {                          // cheap deterministic hills
  const s = Math.sin(x * 0.09) * Math.cos(z * 0.11) + Math.sin((x + z) * 0.05) * 0.8
          + Math.sin(x * 0.021) * Math.cos(z * 0.017) * 2.2;
  return s;
}

function generate(cx, cz) {
  const data = new Uint8Array(CH * CH * H);
  for (let x = 0; x < CH; x++) {
    for (let z = 0; z < CH; z++) {
      const wx = cx * CH + x, wz = cz * CH + z;
      const h = Math.max(1, Math.min(H - 2, Math.round(10 + noise2(wx, wz) * 3.6)));
      for (let y = 0; y < h; y++) {
        data[idx(x, y, z)] = y === h - 1 ? (h <= 9 ? 5 : h >= 17 ? 3 : 1) : (y > h - 4 ? 2 : 3);
      }
      for (let y = h; y <= 8; y++) data[idx(x, y, z)] = 4;   // sea level 8
    }
  }
  return data;
}

function voxel(wx, wy, wz) {
  if (wy < 0 || wy >= H) return 0;
  const cx = Math.floor(wx / CH), cz = Math.floor(wz / CH);
  const c = chunks.get(key(cx, cz));
  if (!c) return 0;
  return c.data[idx(wx - cx * CH, wy, wz - cz * CH)];
}

// six face templates: [normal, four corner offsets]
const FACES = [
  [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]],
  [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
  [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]],
  [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
  [[0, 0, 1], [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]],
  [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]],
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc4ff);
scene.fog = new THREE.Fog(0x8fc4ff, 40, 110);
const mat = new THREE.MeshLambertMaterial({ vertexColors: true });

function mesh(cx, cz) {
  const c = chunks.get(key(cx, cz));
  const pos = [], nor = [], col = [], ind = [];
  let n = 0;
  for (let x = 0; x < CH; x++) for (let y = 0; y < H; y++) for (let z = 0; z < CH; z++) {
    const v = c.data[idx(x, y, z)];
    if (!v) continue;
    const wx = cx * CH + x, wz = cz * CH + z;
    for (const [nm, corners] of FACES) {
      const nb = voxel(wx + nm[0], y + nm[1], wz + nm[2]);
      if (nb && !(v !== 4 && nb === 4)) continue;      // skip faces buried in solid
      const shade = 0.62 + 0.38 * (nm[1] === 1 ? 1 : nm[1] === -1 ? 0.25 : 0.7);
      for (const o of corners) {
        pos.push(wx + o[0], y + o[1], wz + o[2]);
        nor.push(nm[0], nm[1], nm[2]);
        const p = PALETTE[v];
        col.push(p.r * shade, p.g * shade, p.b * shade);
      }
      ind.push(n, n + 1, n + 2, n, n + 2, n + 3);
      n += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(ind);
  if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); }
  c.mesh = new THREE.Mesh(g, mat);
  scene.add(c.mesh);
  return n / 4;
}

let faces = 0;
for (let cx = -RAD; cx <= RAD; cx++) for (let cz = -RAD; cz <= RAD; cz++) {
  chunks.set(key(cx, cz), { data: generate(cx, cz), mesh: null });
}
for (let cx = -RAD; cx <= RAD; cx++) for (let cz = -RAD; cz <= RAD; cz++) faces += mesh(cx, cz);

// ---- render + lights -----------------------------------------------------
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 18, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xdcefff, 0x54432a, 1.35));
const sun = new THREE.DirectionalLight(0xfff6e0, 1.5);
sun.position.set(30, 60, 18);
scene.add(sun);

// ---- controls: pointer-lock look + WASD fly/walk --------------------------
let yaw = 2.2, pitch = -0.35;
const keys = new Set();
const canvas = renderer.domElement;
canvas.addEventListener('click', () => { if (!document.pointerLockElement) canvas.requestPointerLock(); });
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= e.movementX * 0.0022;
  pitch = Math.max(-1.5, Math.min(1.5, pitch - e.movementY * 0.0022));
});
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- edit: DDA raycast through the voxel grid ----------------------------
function pick() {
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  let p = camera.position.clone(), last = null;
  for (let i = 0; i < 400; i++) {
    p.addScaledVector(dir, 0.05);
    const v = [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)];
    if (voxel(v[0], v[1], v[2])) return { hit: v, prev: last };
    last = v;
  }
  return null;
}

function edit(add) {
  const r = pick();
  if (!r) return;
  const t = add ? r.prev : r.hit;
  if (!t) return;
  const cx = Math.floor(t[0] / CH), cz = Math.floor(t[2] / CH);
  const c = chunks.get(key(cx, cz));
  if (!c || t[1] < 0 || t[1] >= H) return;
  c.data[idx(t[0] - cx * CH, t[1], t[2] - cz * CH)] = add ? 6 : 0;
  mesh(cx, cz);                                   // re-mesh only what changed
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (chunks.has(key(cx + dx, cz + dz))) mesh(cx + dx, cz + dz);
  }
  edits++;
}
addEventListener('mousedown', (e) => { if (document.pointerLockElement === canvas) edit(e.button === 2); });
addEventListener('contextmenu', (e) => e.preventDefault());

let edits = 0, frames = 0, mark = performance.now(), fps = 0, t = 0;
renderer.setAnimationLoop(() => {
  t += 0.016;
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const r = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const sp = keys.has('ShiftLeft') ? 0.9 : 0.32;
  let moved = false;
  if (keys.has('KeyW')) { camera.position.addScaledVector(f, sp); moved = true; }
  if (keys.has('KeyS')) { camera.position.addScaledVector(f, -sp); moved = true; }
  if (keys.has('KeyA')) { camera.position.addScaledVector(r, -sp); moved = true; }
  if (keys.has('KeyD')) { camera.position.addScaledVector(r, sp); moved = true; }
  if (keys.has('Space')) camera.position.y += sp;
  if (keys.has('KeyC')) camera.position.y -= sp;
  // Idle cinematic: orbit the world so the demo is alive before anyone touches it.
  if (!moved && !document.pointerLockElement) {
    yaw += 0.0016;
    camera.position.set(Math.sin(t * 0.09) * 46, 22 + Math.sin(t * 0.21) * 3, Math.cos(t * 0.09) * 46);
    camera.lookAt(0, 8, 0);
    yaw = camera.rotation.y; pitch = camera.rotation.x;
  }
  renderer.render(scene, camera);
  if (++frames >= 30) {
    const now = performance.now();
    fps = Math.round((frames * 1000) / (now - mark));
    frames = 0; mark = now;
    hud(`Chunk · ${chunks.size} chunks · ${faces.toLocaleString()} quads · ${fps} fps · ${edits} edits<br>`
      + `click to capture the mouse · WASD + Space/C · left-click breaks · right-click places`);
  }
});
