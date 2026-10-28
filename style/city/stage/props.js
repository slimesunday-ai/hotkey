// STAGE · THE PROPS a vignette uses (main thread, three only). All cheap: one InstancedMesh of bills, a few pooled meshes, one patrol
// car built once. Nothing here knows the sim; stage/vignettes.js moves them.
//   bills     cash bills bursting out of a pocket: ballistic, fluttering down (drag + spin), lying on the pavement a while (the aftermath)
//   exclaim   "?!" in the city's own sign lettering: chunky voxels, a dark backing like the shop signs, lit by the world's light; it pops
//             up over a head, bobs and shrinks away. Never a UI bubble: an object in the street (slime: pop-ups "feel related to the world")
//   baggie / note   a deal's two little things changing hands
//   chalk     a chalk outline on the pavement where someone fell (+ the simassets memorial beside it: layer.pieceMesh)
//   car       a P9 cruiser (vehicles/ 'cruiser', the traffic's own fleet model) with a light bar that flashes red / blue, and a glow on the
//             ground under it (additive, no real light: a light would recompile every material)
//   flicker   a window pane that flickers (a flashlight inside) · alarm: a red lamp that blinks over a door
//   pistol    the shooter's gun (anim/cast/clips/gun-prop.js, the one model), posed each frame from the playing aim clip's prop (gunAt)
//   BANG!     a toon burst in the signs' lettering over a shot (bangText): readable from the street camera, where the gun is a few pixels
import * as THREE from 'three';
import { SIDE } from '../style.js';
import { gunGeometry } from '../anim/cast/clips/gun-prop.js';

// a tiny merge: boxes [x0, y0, z0, x1, y1, z1, colour] → one indexed geometry with vertex colours
export function boxesGeo(list) {
  const P = [], N = [], C = [], I = [], c = new THREE.Color();
  for (const [x0, y0, z0, x1, y1, z1, col] of list) { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), o = P.length / 3;
    c.setHex(col, THREE.SRGBColorSpace); P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); for (let k = 0; k < g.attributes.position.count; k++) C.push(c.r, c.g, c.b);
    for (const i of g.index.array) I.push(i + o); g.dispose(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); return g; }

// "?!" as a 7-row bitmap (the signs' chunky lettering), 9 cm voxels, a dark backing one voxel bigger all round
const GLYPH = ['.###..#', '#...#.#', '....#.#', '...#..#', '..#...#', '.......', '..#...#'];
function exclaimGeo(night) {
  const v = .09, W = GLYPH[0].length, H = GLYPH.length, face = night ? 0xffe46a : 0xffd23a, back = 0x17161f, L = [];
  for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) { if (GLYPH[r][q] !== '#') continue; const x = (q - (W - 1) / 2) * v, y = (H - 1 - r) * v;
    L.push([x - v / 2, y - v / 2, -.02, x + v / 2, y + v / 2, .05, face]);
    L.push([x - v * .95, y - v * .95, -.07, x + v * .95, y + v * .95, -.01, back]); }   // (the backing: each lit voxel's dark rim behind it)
  return boxesGeo(L); }

// "BANG!" (stage-a, 2026-10-08): the same chunky sign voxels, red letters with the dark backing, on a jagged yellow burst with an
// orange rim and a dark edge, as one voxel layer each (a comic sound effect, built like a shop sign). ~3.6 × 1.9 m: from the default
// city camera (~25 m off, looking down) the letters are ~25 px tall
const BANG = { B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'], A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'], G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'], '!': ['#', '#', '#', '#', '#', '.', '#'] };
function bangGeo(night) {
  const v = .1, word = 'BANG!', rows = 7, L = [], letter = night ? 0xff4a3a : 0xe8302a, back = 0x17161f, fill = night ? 0xffe46a : 0xffd23a, rim = 0xff8a1a;
  let W = 0; for (const ch of word) W += BANG[ch][0].length + 1; W -= 1;
  let q0 = 0; for (const ch of word) { const g = BANG[ch]; for (let r = 0; r < rows; r++) for (let q = 0; q < g[r].length; q++) { if (g[r][q] !== '#') continue; const x = (q0 + q - (W - 1) / 2) * v, y = ((rows - 1) / 2 - r) * v;
      L.push([x - v / 2, y - v / 2, .04, x + v / 2, y + v / 2, .1, letter]); L.push([x - v * .95, y - v * .95, .01, x + v * .95, y + v * .95, .05, back]); }
    q0 += g[0].length + 1; }
  // the burst: a 14-point star (radii alternating, a little irregular) rasterised on the voxel grid; rim = the outer band
  const N = 14, Rx = W * v / 2 + .62, Rz = rows * v / 2 + .58, inside = (x, y, k = 1) => { const a = Math.atan2(y / Rz, x / Rx), r = Math.hypot(x / Rx, y / Rz), s = (a / (2 * Math.PI) * N % 1 + 1) % 1, j = Math.floor((a / (2 * Math.PI) + 1) * N) % N;
    const tip = 1 + .1 * ((j * 7) % 3 - 1), lo = .7, e = s < .5 ? lo + (tip - lo) * (s / .5) : tip - (tip - lo) * ((s - .5) / .5); return r < e * k; };
  const nx = Math.ceil(Rx * 1.25 / v), ny = Math.ceil(Rz * 1.25 / v);
  for (let i = -nx; i <= nx; i++) for (let j = -ny; j <= ny; j++) { const x = i * v, y = j * v; if (!inside(x, y)) { if (inside(x, y, 1.12)) L.push([x - v / 2, y - v / 2, -.05, x + v / 2, y + v / 2, -.01, back]); continue; }
    L.push([x - v / 2, y - v / 2, -.04, x + v / 2, y + v / 2, .01, inside(x, y, .84) ? fill : rim]); }
  return boxesGeo(L); }

// a chalk outline of someone sprawled on the ground (metres, body along +z from the feet; a closed loop) as flat strips
const OUTLINE = [[-.12, 0], [-.18, .25], [-.2, .62], [-.55, .55], [-.62, .66], [-.24, .86], [-.2, 1.08], [-.3, 1.2], [-.28, 1.42], [-.12, 1.55], [.12, 1.55], [.28, 1.42],
  [.3, 1.2], [.2, 1.08], [.26, .9], [.6, 1.08], [.66, .98], [.24, .72], [.2, .55], [.24, .22], [.14, 0], [.06, .02], [.02, .5], [-.02, .5], [-.06, .02]];
function chalkGeo() { const P = [], I = [], w = .035, n = OUTLINE.length;
  for (let k = 0; k < n; k++) { const [ax, az] = OUTLINE[k], [bx, bz] = OUTLINE[(k + 1) % n], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, nx = -dz / L * w, nz = dx / L * w, o = P.length / 3;
    P.push(ax - nx, 0, az - nz, ax + nx, 0, az + nz, bx + nx, 0, bz + nz, bx - nx, 0, bz - nz); I.push(o, o + 2, o + 1, o, o + 3, o + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); return g; }

// the cruiser's hull as the stage uses it (vehicles/models.js cruiser, 0.1 m voxels, centred on the root: the hull x 1–19 of 20, the
// white doors z 13–23 and 23–33 of 44; the root's +z is its nose): its half-width, its two kerb-side doors' z spans (m, rear → front)
export const CRUISER = { hw: .9, half: 2.2, doors: { rear: [-.9, .1], front: [.1, 1.1] } };
export function createProps({ scene, mats, night = false, layer = null }) {
  const out = { meshes: [] }, scene0 = scene; scene = { add: (...o) => { out.meshes.push(...o); return scene0.add(...o); } };   // (every prop but the chalk: stage/index.js occ() hides them)
  // ── bills
  const BILL_N = 96, billGeo = new THREE.BoxGeometry(.3, .014, .14), billMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85 });
  const bills = new THREE.InstancedMesh(billGeo, billMat, BILL_N); bills.count = 0; bills.frustumCulled = false; bills.castShadow = true; bills.receiveShadow = true; scene.add(bills);
  const billCol = [new THREE.Color(0x8fd36a), new THREE.Color(0x6fbf52), new THREE.Color(0xb8ec8e)]; for (let k = 0; k < BILL_N; k++) bills.setColorAt(k, billCol[k % 3]);
  const B = [], M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
  // n bills from (x, y, z), thrown mostly along (dx, dz); they lie `ttl` s on the ground, then sink away
  out.burst = (x, y, z, n = 10, dx = 0, dz = 0, ttl = 40) => { for (let k = 0; k < n; k++) { if (B.length >= BILL_N) B.shift();
    const a = Math.random() * Math.PI * 2, s = .6 + Math.random() * 1.6;
    B.push({ p: [x + (Math.random() - .5) * .2, y + Math.random() * .2, z + (Math.random() - .5) * .2], v: [Math.cos(a) * s + dx * 1.6, 1.6 + Math.random() * 2.2, Math.sin(a) * s + dz * 1.6], r: [Math.random() * 6, Math.random() * 6, Math.random() * 6],
      w: [(Math.random() - .5) * 14, (Math.random() - .5) * 10, (Math.random() - .5) * 14], ground: SIDE + .006 + Math.random() * .004, age: 0, ttl: ttl * (.8 + Math.random() * .4), rest: false }); } };
  // bills already lying there (an aftermath staged off screen)
  out.litter = (x, z, n = 5, ttl = 90) => { for (let k = 0; k < n; k++) { if (B.length >= BILL_N) B.shift(); const a = Math.random() * 6.28, r = Math.random() * 1.2, g = SIDE + .006 + Math.random() * .004;
    B.push({ p: [x + Math.cos(a) * r, g, z + Math.sin(a) * r], v: [0, 0, 0], r: [0, Math.random() * 6, 0], w: [0, 0, 0], ground: g, age: 0, ttl, rest: true }); } };
  out.clearBills = () => { B.length = 0; bills.count = 0; };
  function stepBills(dt) { let n = 0;
    for (let k = B.length - 1; k >= 0; k--) { const b = B[k]; b.age += dt; if (b.age > b.ttl + 1.5) { B.splice(k, 1); continue; } }
    for (const b of B) {
      if (!b.rest) { b.v[1] -= 6.5 * dt; const drag = Math.exp(-dt * (b.v[1] < 0 ? 3.2 : .8)); b.v[0] *= drag; b.v[2] *= drag; if (b.v[1] < -1.1) b.v[1] = -1.1;   // (paper: it floats down)
        b.p[0] += b.v[0] * dt + Math.sin(b.age * 7 + b.r[0]) * .25 * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt + Math.cos(b.age * 6 + b.r[2]) * .25 * dt;
        for (let i = 0; i < 3; i++) b.r[i] += b.w[i] * dt;
        if (b.p[1] <= b.ground) { b.p[1] = b.ground; b.rest = true; b.r[0] = 0; b.r[2] = 0; } }
      const sink = b.age > b.ttl ? (b.age - b.ttl) / 1.5 : 0;
      E.set(b.r[0], b.r[1], b.r[2]); Q.setFromEuler(E); V.set(b.p[0], b.p[1] - sink * .05, b.p[2]); M4.compose(V, Q, sink ? V.clone().set(1 - sink, 1, 1 - sink) : S1); bills.setMatrixAt(n++, M4); }
    bills.count = n; bills.instanceMatrix.needsUpdate = true; }

  // ── "?!" over a head (pool of 4)
  const exGeo = exclaimGeo(night), exMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, emissive: night ? 0x403000 : 0x000000 }), EX = [];
  for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(exGeo, exMat); m.visible = false; m.castShadow = false; scene.add(m); EX.push({ m, t: 0, dur: 0, follow: null }); }
  // pop one over a point (or a walker: follow = w, it rides above the head) for dur s
  out.exclaim = (follow, dur = 1.8, x = 0, y = 0, z = 0) => { const e = EX.find(e => !e.m.visible) || EX[0]; e.m.visible = true; e.t = 0; e.dur = dur; e.follow = follow; e.at = [x, y, z]; return e; };
  function stepExclaim(dt, camera) { for (const e of EX) { if (!e.m.visible) continue; e.t += dt; if (e.t > e.dur) { e.m.visible = false; continue; }
    const p = e.follow ? [e.follow.p[0], e.follow.p[1] + 2.05, e.follow.p[2]] : e.at, t = e.t, pop = t < .12 ? t / .12 * 1.25 : t < .26 ? 1.25 - (t - .12) / .14 * .25 : 1, out = e.dur - t < .22 ? (e.dur - t) / .22 : 1;
    e.m.position.set(p[0], p[1] + .08 * Math.sin(t * 5) + (1 - pop) * -.2, p[2]); e.m.scale.setScalar(Math.max(.01, pop * out));
    e.m.rotation.set(0, Math.atan2(camera.position.x - p[0], camera.position.z - p[2]), Math.sin(t * 9) * .06 * out); } }

  // ── a deal's baggie and note
  const bag = new THREE.Mesh(boxesGeo([[-.05, -.035, -.02, .05, .035, .02, 0xeef2f4], [-.05, .025, -.021, .05, .035, .021, 0xd2343a]]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4 }));
  const note = new THREE.Mesh(new THREE.BoxGeometry(.15, .01, .07), new THREE.MeshStandardMaterial({ color: 0x77b35c, roughness: .85 }));
  for (const m of [bag, note]) { m.visible = false; m.castShadow = false; scene.add(m); } out.bag = bag; out.note = note;

  // ── chalk outlines + memorials (lasting: until clear())
  // F27 (audit 2026-10-08) · every mark built its memorial afresh (layer.pieceMesh: a geometry of its own) and clearMarks only took the
  // groups out of the scene, never disposing them: every tape seek (a clear, then a mark per death of the last game day) and every live
  // death left GPU buffers behind. The memorial is one piece, the same every time (simassets scar 'memorial': no randomness), so it is
  // built once and every mark draws a clone of it (its geometry and material shared, like the chalk's). Nothing a mark holds is its own
  // GPU resource any more: a clear only has to unhook the groups.
  const chalkMat = new THREE.MeshStandardMaterial({ color: 0xf4f1e6, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), cGeo = chalkGeo(), marks = [];
  let memo;   // the memorial piece (undefined: not built yet · null: the layer has none)
  const memorialMesh = () => { if (memo === undefined) { try { memo = layer?.pieceMesh?.('scar', ['memorial']) || null; } catch { return null; } } return memo ? memo.clone() : null; };
  out.chalk = (x, z, ry, { memorial = true, key = null } = {}) => { const g = new THREE.Group(), c = new THREE.Mesh(cGeo, chalkMat); c.receiveShadow = true; g.add(c); g.position.set(x, SIDE + .012, z); g.rotation.y = ry;
    if (memorial) { const m = memorialMesh(); if (m) { const h = new THREE.Group(); h.add(m); h.position.set(.85, -.012, .35); h.rotation.y = Math.PI; g.add(h); } }
    scene0.add(g); marks.push({ g, key }); return g; };
  out.clearMarks = (keep = null) => { for (let k = marks.length - 1; k >= 0; k--) { if (keep && keep(marks[k].key)) continue; marks[k].g.removeFromParent(); marks.splice(k, 1); } };
  out.marks = () => marks.length;

  // ── the patrol car (built on first use: the vehicles module loads then)
  let car = null, carLoading = null;
  out.car = async () => { if (car) return car; if (carLoading) return carLoading; carLoading = (async () => {
    const { vehicleMesh } = await import('../vehicles/three.js'), body = vehicleMesh('cruiser', { lights: night, night, driver: true }, mats.tier), root = new THREE.Group(); root.add(body);
    const bb = new THREE.Box3().setFromObject(body), top = bb.max.y, cz = (bb.min.z + bb.max.z) / 2, cx = (bb.min.x + bb.max.x) / 2; body.position.set(-cx, 0, -cz);   // (the body centred on the root)
    const lens = (col, x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(.5, .2, .44), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); m.position.set(x, top - .08, 0); return m; };
    // the bar sits over the cabin (vehicles/models.js cruiser: z 19–25 of 44 voxels): its centre, from the body's own bounds
    const barZ = bb.min.z - cz + (22 / 44) * (bb.max.z - bb.min.z), red = lens(0xff2a2a, -.3), blue = lens(0x2f7bff, .3); red.position.z = blue.position.z = barZ; root.add(red, blue);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(4.2, 28).rotateX(-Math.PI / 2), glowMat); glow.position.y = .03; glow.renderOrder = 2; root.add(glow);
    // STAGE-B (2026-10-08) · THE KERB-SIDE DOORS (the model is one merged piece, no door opens: vehicles/models.js cruiser): a door
    // panel per kerb-side door (local −x: the root faces +z along its lane, the kerb on its −x), hinged at its front edge, swung out by
    // car.door(which, k) (k 0 shut … 1 open 88°), and a dark doorway on the hull behind it while it is open. White below the belt,
    // the window frame and glass above (the cruiser's black-and-white doors); 6 cm proud of the hull so a shut panel never z-fights it.
    const DOOR = { hw: CRUISER.hw, h0: .4, belt: 1.0, h1: 1.78 }, doorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55 }), doors = {};
    for (const [which, [z0, z1]] of Object.entries(CRUISER.doors)) { const L = z1 - z0, g = new THREE.Group(), hole = new THREE.Mesh(boxesGeo([[-.03, DOOR.h0, -L + .04, 0, DOOR.h1 - .04, -.04, 0x121218]]), doorMat);
      const panel = new THREE.Mesh(boxesGeo([[-.07, DOOR.h0, -L, 0, DOOR.belt, 0, 0xeeeeea], [-.075, DOOR.belt - .08, -L, -.065, DOOR.belt - .04, 0, 0x17161f],
        [-.05, DOOR.belt, -L + .07, -.02, DOOR.h1 - .07, -.07, 0x2c3a48], [-.07, DOOR.h1 - .07, -L, 0, DOOR.h1, 0, 0x17161f], [-.07, DOOR.belt, -L, 0, DOOR.h1, -L + .07, 0x17161f], [-.07, DOOR.belt, -.07, 0, DOOR.h1, 0, 0x17161f],
        [-.1, DOOR.belt - .22, -L + .12, -.07, DOOR.belt - .17, -L + .3, 0xc9ccd2]]), doorMat);
      panel.castShadow = true; g.add(panel); g.position.set(-DOOR.hw, 0, z1); hole.position.set(-DOOR.hw + .005, 0, z1); g.visible = hole.visible = false; root.add(g, hole); doors[which] = { g, hole, k: 0 }; }
    const door = (which, k) => { const d = doors[which]; if (!d) return; d.k = Math.max(0, Math.min(1, k)); const on = d.k > .002; d.g.visible = d.hole.visible = on; d.g.rotation.y = d.k * 1.54; };
    root.visible = false; scene.add(root); car = { root, body, red, blue, glow, glowMat, len: bb.max.z - bb.min.z, roll: d => body.userData.roll?.(d), flash: false, ft: 0, door, doors };
    return car; })(); return carLoading; };
  function stepCar(dt) { if (!car || !car.root.visible) return; car.ft += dt;
    const ph = car.flash ? (Math.floor(car.ft * 6) % 4) : -1, r = ph === 0 || ph === 1, b = ph === 2 || ph === 3;   // (red, red, blue, blue: a toon wig-wag)
    car.red.visible = !car.flash || r; car.blue.visible = !car.flash || b; car.red.material.color.setHex(car.flash && r ? 0xff3030 : 0x5a1010); car.blue.material.color.setHex(car.flash && b ? 0x3a8bff : 0x0e1e4a);
    car.glowMat.opacity = car.flash ? (night ? .34 : .13) * (.7 + .3 * Math.sin(car.ft * 40)) : 0; car.glowMat.color.setHex(r ? 0xff2020 : 0x2060ff); }

  // ── window flicker + alarm lamp (one each at a time: burglaries are rare)
  const flick = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xfff1c4, toneMapped: false, transparent: true, opacity: .9 })); flick.visible = false; scene.add(flick);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(.22, .22, .22), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })); lamp.visible = false; scene.add(lamp);
  const lampGlow = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); lampGlow.visible = false; scene.add(lampGlow);
  out.flick = flick; out.lamp = lamp; out.lampGlow = lampGlow;
  // a window entry [x, y, z, w, h(, rot)] on a wall facing `rot` (layer.js: the pane sits 2 cm outside the wall)
  out.windowAt = (m, win, rot) => { const r = win[5] ?? rot, F = [[0, 1], [1, 0], [0, -1], [-1, 0]][r & 3]; m.position.set(win[0] + F[0] * .03, win[1], win[2] + F[1] * .03); m.rotation.set(0, Math.atan2(F[0], F[1]), 0); m.scale.set(win[3] * .92, win[4] * .92, 1); };

  // ── a shot (2026-10-08): a toon muzzle flash — a yellow star that pops for a tenth of a second, turned to the camera — and puffs of
  // smoke that swell, drift up and fade. No gore: where it hits, only a small white puff. Pools: 2 flashes, 10 puffs.
  const flashGeo = boxesGeo([[-.1, -.1, -.02, .1, .1, .02, 0xfffbe0], [-.34, -.04, -.015, .34, .04, .015, 0xffc21a], [-.04, -.34, -.015, .04, .34, .015, 0xffc21a]]), FLS = [];
  for (let k = 0; k < 2; k++) { const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), a = new THREE.Mesh(flashGeo, mat), b = new THREE.Mesh(flashGeo, mat);
    b.rotation.z = Math.PI / 4; b.scale.setScalar(.62); g.add(a, b); g.visible = false; scene.add(g); FLS.push({ g, t: 0 }); }
  const puffGeo = new THREE.BoxGeometry(.16, .16, .16), PUFF = [];
  for (let k = 0; k < 10; k++) { const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xd8d6cc, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); m.visible = false; scene.add(m); PUFF.push({ m, t: 0, dur: 1, v: [0, 0, 0], s0: 1 }); }
  out.bang = (x, y, z, { flash = true, puffs = 3, colour = 0xd8d6cc, size = 1, dir = [0, 0], fsize = 1 } = {}) => {
    if (flash) { const f = FLS.find(f => !f.g.visible) || FLS[0]; f.g.visible = true; f.t = 0; f.s = fsize; f.g.position.set(x, y, z); }
    for (let k = 0; k < puffs; k++) { const p = PUFF.find(p => !p.m.visible) || PUFF[k]; p.m.visible = true; p.t = -k * .04; p.dur = .8 + k * .15; p.s0 = size * (.8 + .25 * k);
      p.m.position.set(x + dir[0] * .1 * k, y, z + dir[1] * .1 * k); p.v = [dir[0] * .5 + (Math.random() - .5) * .3, .45 + .2 * Math.random(), dir[1] * .5 + (Math.random() - .5) * .3]; p.m.material.color.setHex(colour); p.m.rotation.set(Math.random(), Math.random(), Math.random()); } };
  function stepBang(dt, camera) {
    for (const f of FLS) { if (!f.g.visible) continue; f.t += dt; if (f.t > .14) { f.g.visible = false; continue; } const k = f.t < .04 ? f.t / .04 * 1.3 : 1.3 * (1 - (f.t - .04) / .1);
      f.g.scale.setScalar(Math.max(.01, k * (f.s || 1))); f.g.lookAt(camera.position); f.g.rotateZ(f.t * 9); }
    for (const p of PUFF) { if (!p.m.visible) continue; p.t += dt; if (p.t < 0) { p.m.material.opacity = 0; continue; } if (p.t > p.dur) { p.m.visible = false; continue; } const u = p.t / p.dur;
      p.m.position.x += p.v[0] * dt; p.m.position.y += p.v[1] * dt; p.m.position.z += p.v[2] * dt; p.m.scale.setScalar(p.s0 * (.6 + 1.6 * u)); p.m.material.opacity = .85 * (1 - u) * Math.min(1, p.t / .05); p.m.rotation.y += dt * 1.5; } }
  // ── the pistol (stage-a): one mesh per shooter (a pool of 2), posed from the walker's drawn place and yaw × the aim clip's prop.matrix,
  // called from the gait hook (stage/index.js applyPose) on the frame the walker is drawn. gunAt(A, null) hides A's. Any gun nobody posed
  // since the last frame hides itself (frame below).
  const gunMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45, metalness: .25 }), GUNS = [], GM = new THREE.Matrix4(), GW = new THREE.Matrix4();
  for (let k = 0; k < 2; k++) { const m = new THREE.Mesh(gunGeometry(THREE), gunMat); m.matrixAutoUpdate = false; m.visible = false; m.castShadow = true; scene.add(m); GUNS.push({ m, A: null, used: false }); }
  out.gunAt = (A, w, prop, t) => { let G = GUNS.find(g => g.A === A); if (!w) { if (G) { G.m.visible = false; G.A = null; } return; }
    if (!G) { G = GUNS.find(g => !g.A) || GUNS[0]; G.A = A; }
    prop.matrix(THREE, t, GM); GW.makeRotationY(w.yawS ?? w.p[3]).setPosition(w.p[0], w.p[1], w.p[2]); G.m.matrix.multiplyMatrices(GW, GM); G.m.matrixWorldNeedsUpdate = true; G.m.visible = true; G.used = true; };
  const stepGuns = () => { for (const G of GUNS) { if (!G.used) { G.m.visible = false; G.A = null; } G.used = false; } };

  // ── "BANG!" over a shot (pool of 2): pops up big (×1.3), settles, shakes a little, holds, shrinks away; turned square to the camera
  const bangG = bangGeo(night), bangMat = new THREE.MeshBasicMaterial({ vertexColors: true }), BG = [];
  for (let k = 0; k < 2; k++) { const m = new THREE.Mesh(bangG, bangMat); m.visible = false; m.castShadow = false; m.renderOrder = 4; scene.add(m); BG.push({ m, t: 0, dur: 1.3, at: [0, 0, 0] }); }
  out.bangText = (x, y, z, dur = 1.3) => { const b = BG.find(b => !b.m.visible) || BG[0]; b.m.visible = true; b.t = 0; b.dur = dur; b.at = [x, y, z]; b.tilt = (Math.random() < .5 ? -1 : 1) * (.06 + .06 * Math.random()); return b; };
  function stepBangText(dt, camera) { for (const b of BG) { if (!b.m.visible) continue; b.t += dt; const t = b.t; if (t > b.dur) { b.m.visible = false; continue; }
    const pop = t < .07 ? t / .07 * 1.3 : t < .2 ? 1.3 - (t - .07) / .13 * .3 : 1, out = b.dur - t < .25 ? (b.dur - t) / .25 : 1, sh = t < .45 ? .05 * Math.sin(t * 70) * (1 - t / .45) : 0;
    b.m.position.set(b.at[0], b.at[1] + .12 * Math.min(1, t / .4), b.at[2]); b.m.lookAt(camera.position); b.m.rotateZ(b.tilt + sh); b.m.scale.setScalar(Math.max(.01, pop * out)); } }
  out.frame = (dt, camera) => { stepBills(dt); stepExclaim(dt, camera); stepCar(dt); stepBang(dt, camera); stepBangText(dt, camera); stepGuns(); };
  out.counts = () => ({ bills: B.length, exclaims: EX.filter(e => e.m.visible).length, marks: marks.length, car: !!car?.root.visible, guns: GUNS.filter(g => g.m.visible).length, bangs: BG.filter(b => b.m.visible).length });
  return out;
}
