// MOVEMENT W3b · THE CARRIAGE: the subway ride as a cutaway scene (MOVEMENT.md §5: "a ride is a CUTAWAY scene, a carriage interior with
// NPC riders swaying, opened like the home interiors"). slime: "when an agent is on the subway it should play an animation of them on the
// subway with random npcs… we need this to feel alive."
// One car in section, seen from the side like a diorama: the near wall cut away (the floor and roof slabs cut in ink, STYLE.md flat
// colour blocks), the far wall with its windows, three pairs of sliding doors, orange and yellow bucket benches, poles and grab rails,
// car cards from the signage transit pool, a line map over each door in the line's colour; the tunnel streams past the windows (ribs
// and work lights, streaked by speed); at a station the platform slides in (the line's colour band, the station's name in the city's
// sign lettering, the kiosks' green columns), the car brakes, the doors open, riders get off and on. The car sways and clacks on the
// rail joints; standing riders lean into the starts and stops. The agent rides among NPC riders (cast.js rollLook pool 'npc'), with its
// handle over its head.
//   openCarriage({ program, net, now, agent: { id, handle, look }, container, onClose, onDone, title }) → handle
//     program  subway/net.js programOf(): the underground legs in real seconds · now() → real s into the program (live: the sim clock;
//              demo: a local clock) · onDone: the program ran out (the leg ended: the city picks the agent up on the stairs)
//   handle: { close(), get t, state(), view: { scene, camera, renderer }, ready, advance(s) (shots: step a paused clock), pause(on) }
// Its own canvas, renderer, scene and camera over the page (interiors/city/mainland.js's pattern); everything is disposed on close, so
// nothing runs or stays in memory while no ride is open. Esc or × leaves early.
// Animation (2026-10-08): the riders are the city's own walker bodies (subway/riders.js: the near tier's bake and vertex shader), so they
// play the SAME authored clips as the city's walkers (anim/cast/clips/transit.js): sit_ride on the benches (the seats are at the clip's
// 0.30 m), stand_rail with the +x hand on a pole (each standing spot is placed so its pole is at the clip's body-frame x 0.52, z 0.27),
// wait_stop on the platform, each at its own random clock (out of phase); walking on and off with the city's walk.
import * as THREE from 'three';
import { Vol, meshed, textMask } from '../vox.js';
import { geoOf } from '../glue.js';
import * as C from '../cast.js';
import { stateAt, changesAt } from './net.js';
import { createCrowd } from './riders.js';   // (the riders: walker bodies playing the clips)

const INK = 0x17171b, CV = .1, L = 15, DOORS = [-5, 0, 5], DOOR_W = 1.2;
const BENCHES = [[-7.35, -5.75], [-4.25, -.75], [.75, 4.25], [5.75, 7.35]];
// the seats (sit_ride: seat top ≈ 0.30 m, the hips 0.39 m): top, front edge (z), the back's top; z the seated rider's origin (its hips)
const SEAT = { top: .3, front: -1.0, back: .95, z: -1.1, pitch: .86 };
// the poles (buildShell pole(): a 0.1 m voxel column; these are their centres) and stand_rail's pole in the body frame (+x hand)
const cell = v => Math.round((v + 7.6) / CV) * CV - 7.6 + CV / 2, cellZ = v => Math.round((v + 1.6) / CV) * CV - 1.6 + CV / 2;
const RAIL = { x: .52, z: .27 };
const POLES = [...DOORS.map(d => ({ x: cell(d), z: cellZ(.02), door: d })), ...BENCHES.flatMap(([a, b]) => [a > -7 ? { x: cell(a + .05), z: cellZ(-1.0), end: 'a' } : null, b < 7 ? { x: cell(b - .15), z: cellZ(-1.0), end: 'b' } : null]).filter(Boolean)];
// a standing spot at pole p, the rider turned yaw: the rider's origin is the pole less the body-frame offset turned by yaw
const atPole = (p, yaw, o = {}) => ({ x: p.x - (RAIL.x * Math.cos(yaw) + RAIL.z * Math.sin(yaw)), z: p.z - (-RAIL.x * Math.sin(yaw) + RAIL.z * Math.cos(yaw)), yaw, pole: p, by: null, ...o });
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k), lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rngOf = seed => { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const hexCss = n => '#' + n.toString(16).padStart(6, '0');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const agentLook = id => C.rollLook(fnv(String(id)) & 0xffffff);   // (simstate/looks.js specOf: the look the city gives a sim agent)

// ── pixel lettering onto a canvas (the city's 5×7 sign face, vox.js textMask)
function pix(g, s, x, y, sc, col) { const M = textMask(s); g.fillStyle = col; for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) g.fillRect(x + i * sc, y + j * sc, sc, sc); return M.w * sc; }
const pixW = (s, sc) => textMask(s).w * sc;
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; t.userData.redraw = f => { f(g, w, h); t.needsUpdate = true; }; return t; }

// ── the car's shell, one voxel volume (0.1 m): floor and roof slabs (their near edge cut in ink), the far wall with its windows and door
// openings, the end walls, benches, poles, rails, the light strips. Car frame: x along the car (+x the way it runs, screen right), y up
// from the floor, z toward the viewer; the far wall's inner face at z −1.4, the cut at z +1.5.
function buildShell() {
  // (the city's people are ~2 m with big heads and short legs: the seats are at 0.30 m (the walker's hips at 0.5: sit_ride sits its hips at
  // 0.39 m on a 0.30 m seat), the car is 3 m to the roof, the doors 2.25 m)
  const V = new Vol(152, 36, 31, { s: CV, org: [-7.6, -.3, -1.6], ground: false }), X = x => Math.round((x + 7.6) / CV), Y = y => Math.round((y + .3) / CV), Z = z => Math.round((z + 1.6) / CV);
  const FLOOR = [0xa09d9a, 0x9a9794, 0xa6a39d], CEIL = 0xe9e6df, LOW = 0xb9bdc6, UP = 0xe6e1d6, FRAME = 0x3a3d46, END = 0xd3d4d7, BASE = 0x4b4e57, METAL = 0xc9cdd5, LIGHT = 0xfffbef, TOP = Y(3.0);
  V.box(0, 0, 0, 152, 3, 31, (x, y, z) => FLOOR[(x * 7 + z * 13 + ((x * z) >> 2)) % 3]);   // the floor, a speckled grey
  V.box(0, 2, 2, 152, 3, 3, 0x6f727b); V.box(0, 0, 29, 152, 3, 31, INK);                           // its kick strip · the cut
  const RF = new Vol(152, 36, 31, { s: CV, org: [-7.6, -.3, -1.6], ground: false });   // the roof: the far half only (the section cuts it at z −0.3), apart so it never shades the aisle
  RF.box(0, TOP, 0, 152, 36, Z(-.3), CEIL); RF.box(0, TOP, Z(-.4), 152, 36, Z(-.3), INK); RF.box(0, 35, 0, 152, 36, Z(-.4), 0x2a2c33);
  for (let x = -7.3; x < 7.2; x += 1.25) RF.box(X(x), TOP - 1, Z(-.85), X(x + 1.1), TOP, Z(-.85) + 2, LIGHT, 3);   // the light strip, in segments
  V.box(0, 3, 0, 152, Y(1.1), 2, LOW); V.box(0, Y(1.1), 0, 152, TOP, 2, UP);                         // the far wall: a steel lower panel, a bone upper
  // the end walls: full height under the roof, cut down to 1.2 m where the roof is cut away (an ink edge on every cut face)
  for (const ex of [0, 151]) { V.box(ex, 3, 0, ex + 1, TOP, Z(-.3), END); V.box(ex, 3, Z(-.3), ex + 1, Y(1.2), 29, END); V.box(ex, Y(1.2) - 1, Z(-.3), ex + 1, Y(1.2), 29, INK); V.box(ex, 3, 28, ex + 1, Y(1.2), 29, INK); V.box(ex, Y(1.2), Z(-.4), ex + 1, TOP, Z(-.3), INK);
    V.box(ex, 3, Z(-1.05), ex + 1, Y(2.25), Z(-.45), 0x9a9ea8); V.box(ex, Y(1.25), Z(-.95), ex + 1, Y(2.05), Z(-.55), 0x1b2a55, 1); }   // the end door, its window (to the next car)
  // the windows: between the doors, 1.2 to 2.35 m, framed; the door openings: 1.2 m by 2.25 m
  const spans = [[-7.4, -5.7], [-4.3, -.7], [.7, 4.3], [5.7, 7.4]];
  for (const [a, b] of spans) { const n = Math.max(1, Math.round((b - a) / 1.15)), w = (b - a) / n;
    for (let k = 0; k < n; k++) { const x0 = X(a + k * w + .12), x1 = X(a + (k + 1) * w - .12); V.box(x0 - 1, Y(1.15), 1, x1 + 1, Y(2.4), 2, FRAME); V.clear(x0, Y(1.2), 0, x1, Y(2.35), 2); } }
  for (const d of DOORS) { const x0 = X(d - DOOR_W / 2), x1 = X(d + DOOR_W / 2); V.box(x0 - 1, 3, 1, x1 + 1, Y(2.3), 2, FRAME); V.clear(x0, 3, 0, x1, Y(2.25), 2); V.box(x0, 2, 0, x1, 3, 2, 0x5f626b); }
  // the benches: a dark plinth, moulded buckets in two colours (every 0.5 m), a back
  for (const [a, b] of BENCHES) { V.box(X(a), 3, 2, X(b), Y(SEAT.top - .09), Z(SEAT.front - .13), BASE);
    V.box(X(a), Y(SEAT.top - .09), 2, X(b), Y(SEAT.top), Z(SEAT.front), x => Math.floor((x - X(a)) / 5) % 2 ? 0xff7a1a : 0xffc21a, 1);
    V.box(X(a), Y(SEAT.top), 2, X(b), Y(SEAT.back), 3, x => Math.floor((x - X(a)) / 5) % 2 ? 0xff7a1a : 0xffc21a, 1);
    for (let x = X(a) + 5; x < X(b) - 1; x += 5) V.box(x, Y(SEAT.top), 3, x + 1, Y(SEAT.top + .07), Z(SEAT.front - .05), x % 10 ? 0xe86a14 : 0xe6ad12, 1); }   // the bucket ridges
  // poles: at each door (in the aisle) and at the bench ends; the grab rails
  const pole = (x, z, top) => V.box(X(x), 3, Z(z), X(x) + 1, top, Z(z) + 1, METAL, 2);
  for (const d of DOORS) pole(d, .02, Y(2.4));
  for (const [a, b] of BENCHES) { if (a > -7) pole(a + .05, -1.0, Y(2.45)); if (b < 7) pole(b - .15, -1.0, Y(2.45)); }
  V.box(X(-7.3), Y(2.45), Z(-.95), X(7.3), Y(2.45) + 1, Z(-.95) + 1, METAL, 2); for (let x = -7; x <= 7; x += 1.75) V.box(X(x), Y(2.45), Z(-.95), X(x) + 1, TOP, Z(-.95) + 1, METAL, 2);   // the rail over the benches, hung from the roof
  V.box(X(-7.3), Y(2.4), Z(.02), X(7.3), Y(2.4) + 1, Z(.02) + 1, METAL, 2);   // the aisle rail, on the door poles (the roof over it is cut away)
  V.box(0, Y(2.45), 2, 152, Y(2.45) + 1, 3, METAL, 2);   // the card rail over the windows
  return { shell: meshed(V), roof: meshed(RF) };
}
// a door leaf (0.6 × 1.95 m): steel, a window, a black rubber nosing on its meeting edge (mirrored for the right leaf)
function buildLeaf(right) { const V = new Vol(6, 23, 1, { s: CV, org: [right ? 0 : -.6, 0, -.05], ground: false }), e = right ? 0 : 5;
  V.box(0, 0, 0, 6, 23, 1, 0xb0b4bd, 2); V.box(1, 11, 0, 5, 20, 1, 0x1b2a55, 1); V.box(e, 0, 0, e + 1, 23, 1, INK); V.box(0, 4, 0, 6, 5, 1, 0x8d9099, 2); return meshed(V); }

// the line map over the doors: the line's bar, a dot per station, the names, the station it is at (or the next) lit
function drawStrip(g, w, h, ln, net, cur, nextUp, dir) {
  const stops = dir === 'rev' ? ln.stops.slice().reverse() : ln.stops, col = hexCss(ln.hex); g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
  g.fillStyle = col; g.fillRect(0, 0, 20, h); pix(g, ln.bullet, 6, 6, 2, '#f4f1ea');   // the bullet
  const x0 = 34, x1 = w - 14, y = 16; g.fillRect(x0, y - 2, x1 - x0, 4);
  stops.forEach((s, k) => { const x = Math.round(x0 + (x1 - x0) * k / Math.max(1, stops.length - 1)), on = s === cur, nx = s === nextUp;
    g.fillStyle = on ? '#ff4fa3' : nx ? '#17171b' : '#f4f1ea'; g.fillRect(x - 4, y - 4, 8, 8); g.fillStyle = col; if (!on && !nx) g.fillRect(x - 2, y - 2, 4, 4);
    const nm = net.nameOf(s), tw = pixW(nm, 1); pix(g, nm, clamp(x - (tw >> 1), x0 - 8, w - tw - 2), y + 8, 1, on ? '#d1107a' : '#17171b');
    if (changesAt(net, s, ln.id).length) { const o = net.lines.get(changesAt(net, s, ln.id)[0]); g.fillStyle = hexCss(o.hex); g.fillRect(x - 3, y - 12, 6, 6); } });
}
// the platform's back wall: cream tile, a band in the line's colour with the station's name every 9 m, a dark dado (one canvas, 36 m)
function drawWall(g, w, h, name, ln) {   // 36 m × 4.4 m at 20 px a metre: the name band high (it shows over the car's roof), a band at eye height, the dado
  const col = hexCss(ln.hex); g.fillStyle = '#efe9dc'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(23,23,27,.07)';
  for (let x = 0; x < w; x += 6) g.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  g.fillStyle = '#2b2d35'; g.fillRect(0, h - 12, w, 12); g.fillRect(0, 0, w, 4); g.fillStyle = col; g.fillRect(0, 8, w, 22); g.fillRect(0, 50, w, 6); g.fillStyle = '#17171b'; g.fillRect(0, 30, w, 2);
  for (let k = 0; k < 6; k++) { const cx = Math.round(w * (k + .5) / 6), sc = 2, tw = pixW(name, sc); g.fillStyle = '#17171b'; g.fillRect(cx - (tw >> 1) - 5, 9, tw + 10, 20); pix(g, name, cx - (tw >> 1), 12, sc, '#f4f1ea'); }
  for (let k = 0; k < 12; k++) { const cx = Math.round(w * (k + .25) / 12) + 10; g.fillStyle = '#17171b'; g.fillRect(cx - 1, 39, 11, 11); g.fillStyle = col; g.fillRect(cx, 40, 9, 9); pix(g, ln.bullet, cx + 2, 41, 1, '#f4f1ea'); }   // the line bullets along the wall
}
// a car card from the signage transit pool (painted by the signage painter, else lettered here)
let cardsP = null;
async function cardTextures(n, seed) {
  cardsP ??= Promise.all([import('../signage/designs.js'), import('../signage/paint.js')]).then(([D, P]) => ({ list: D.POOLS.transit.part.flat(), paint: P.paint })).catch(() => null);
  const S = await cardsP, r = rngOf(seed), out = [];
  for (let k = 0; k < n; k++) { let I = null, d = null;
    for (let tries = 0; S && tries < 6 && !I; tries++) { d = S.list[(r() * S.list.length) | 0]; try { const im = S.paint(d, 60, 22, { lit: 0 }); if (!im.miss && !im.fell) I = im; } catch { } }
    out.push(canvasTex(60, 22, g => { if (I) { const D = g.createImageData(60, 22); for (let i = 0; i < 60 * 22; i++) { const c = I.c[i]; if (c < 0) { D.data.set([240, 236, 226, 255], i * 4); continue; } D.data.set([c >> 16 & 255, c >> 8 & 255, c & 255, 255], i * 4); } g.putImageData(D, 0, 0); }
      else { const bg = ['#ffc21a', '#ff4fa3', '#2f5bff', '#6cff4a', '#f4f1ea'][k % 5]; g.fillStyle = bg; g.fillRect(0, 0, 60, 22); pix(g, (d?.big || 'CALL 555-0144').slice(0, 9), 3, 4, 1, '#17171b'); } })); }
  return out;
}

export async function openCarriage({ program: P, net, now, agent = null, container = document.body, onClose, onDone, seed = 1 } = {}) {
  css();
  const root = document.createElement('div'); root.className = 'sbw'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'On the subway'); container.appendChild(root);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; root.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07080c);
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 120);
  const size = () => { const r = root.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height); renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 1.2 ? 46 : 28; camera.updateProjectionMatrix(); }; size(); const ro = new ResizeObserver(size); ro.observe(root);
  const MATS = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, metalness: 0 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .25, metalness: .05 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .7 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];
  const own = [], addBank = (b, to, shadow = true) => b.L.forEach((O, li) => { if (!O.v || !O.I.n) return; const m = new THREE.Mesh(geoOf(O), MATS[li]); m.castShadow = shadow && li !== 3; m.receiveShadow = li !== 3; to.add(m); own.push(m.geometry); });
  // ── light: a cool fluorescent fill from the strips, a soft key from above the aisle for the shadows
  scene.add(new THREE.HemisphereLight(0xf3f6ff, 0x8d8a82, 1.9));
  const key = new THREE.DirectionalLight(0xfff4e2, 2.1); key.position.set(1.5, 9, 4); key.target.position.set(0, 0, -.5); key.castShadow = true; key.shadow.mapSize.set(2048, 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 5, bottom: -5, near: 2, far: 18 }); key.shadow.bias = -.0006; key.shadow.normalBias = .02; key.shadow.radius = 3; scene.add(key, key.target);
  const fill = new THREE.PointLight(0xdfe9ff, 6, 9, 1.5); fill.position.set(0, 2.1, .2); scene.add(fill);
  // ── the car (it sways as one) and what stays put outside it
  const car = new THREE.Group(); scene.add(car); { const B = buildShell(); addBank(B.shell, car); addBank(B.roof, car, false); }
  const leafL = buildLeaf(false), leafR = buildLeaf(true), leaves = [];
  for (const d of DOORS) for (const [b, s] of [[leafL, -1], [leafR, 1]]) { const g = new THREE.Group(); addBank(b, g); g.position.set(d, 0, -1.5); car.add(g); leaves.push({ g, d, s }); }
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x2f5bff, roughness: .5 }), stripeGeo = new THREE.BoxGeometry(1, .08, .02);
  for (const [a, b] of [[-7.5, -5.65], [-4.35, -.65], [.65, 4.35], [5.65, 7.5]]) { const m = new THREE.Mesh(stripeGeo, stripeMat); m.scale.x = b - a; m.position.set((a + b) / 2, 1.14, -1.39); car.add(m); }
  const stripTex = canvasTex(240, 32, () => {}), stripMat = new THREE.MeshBasicMaterial({ map: stripTex, toneMapped: false }), stripGeo = new THREE.PlaneGeometry(1.3, .17);
  for (const d of DOORS) { const m = new THREE.Mesh(stripGeo, stripMat); m.position.set(d, 2.56, -1.385); car.add(m); }
  const cardGeo = new THREE.PlaneGeometry(.78, .286), cardMats = [];
  cardTextures(12, seed * 31 + 7).then(texs => { if (closed) { texs.forEach(t => t.dispose()); return; } let k = 0;
    for (const [a, b] of [[-7.4, -5.7], [-4.3, -.7], [.7, 4.3], [5.7, 7.4]]) { const n = Math.floor((b - a + .04) / .82); for (let i = 0; i < n && k < texs.length; i++, k++) {
      const mat = new THREE.MeshStandardMaterial({ map: texs[k], roughness: .6 }), m = new THREE.Mesh(cardGeo, mat); cardMats.push(mat); m.position.set(a + (b - a - n * .82) / 2 + .41 + i * .82, 2.68, -1.37); m.rotation.x = -.12; car.add(m); } } });
  // ── the tunnel: rib panels and work lights that stream past (instanced, wrapped over 64 m), streaked by speed
  const TUN = 64, ribGeo = new THREE.BoxGeometry(.22, 4.2, .25), ribs = new THREE.InstancedMesh(ribGeo, new THREE.MeshStandardMaterial({ color: 0x23273a, roughness: .9 }), 26);
  const tunWall = new THREE.Mesh(new THREE.PlaneGeometry(80, 5), new THREE.MeshStandardMaterial({ color: 0x0f111a, roughness: 1 })); tunWall.position.set(0, 1.6, -5.2); scene.add(tunWall);
  const lampGeo = new THREE.BoxGeometry(1, .09, .06), lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0xffd58a, toneMapped: false }), 12);
  const sigGeo = new THREE.BoxGeometry(.12, .12, .06), sigs = new THREE.InstancedMesh(sigGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 3);
  for (const m of [ribs, lamps, sigs]) { m.frustumCulled = false; scene.add(m); }
  const RED = new THREE.Color(0xff3030), GRN = new THREE.Color(0x52ff86); for (let k = 0; k < 3; k++) sigs.setColorAt(k, k % 2 ? RED : GRN);
  // ── the platform (one, reused for every station: the wall's canvas is redrawn per station), slides along x with the car's offset
  const plat = new THREE.Group(); plat.visible = false; scene.add(plat); const PL = 36;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(PL, .32, 3.1), new THREE.MeshStandardMaterial({ color: 0xb4ad9f, roughness: .95 })); slab.position.set(0, -.16, -3.17); slab.receiveShadow = true; plat.add(slab);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(PL, .02, .32), new THREE.MeshStandardMaterial({ color: 0xffe23a, roughness: .7 })); edge.position.set(0, .01, -1.8); plat.add(edge);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(PL, .32, .06), new THREE.MeshStandardMaterial({ color: 0x5d5e6b })); lip.position.set(0, -.16, -1.62); plat.add(lip);
  const wallTex = canvasTex(720, 88, () => {}), pwall = new THREE.Mesh(new THREE.PlaneGeometry(PL, 4.4), new THREE.MeshStandardMaterial({ map: wallTex, roughness: .55 })); pwall.position.set(0, 2.2, -4.7); pwall.receiveShadow = true; plat.add(pwall);
  const pceil = new THREE.Mesh(new THREE.BoxGeometry(PL, .3, 2.8), new THREE.MeshStandardMaterial({ color: 0x23252c })); pceil.position.set(0, 4.55, -3.3); plat.add(pceil);
  const colGeo = new THREE.BoxGeometry(.26, 4.4, .26), colMat = new THREE.MeshStandardMaterial({ color: 0x1f7a52, roughness: .6 });
  for (let x = -PL / 2 + 2.25; x < PL / 2; x += 4.5) { const c = new THREE.Mesh(colGeo, colMat); c.position.set(x + .6, 2.2, -3.55); c.castShadow = true; plat.add(c); }
  const tubeGeo = new THREE.BoxGeometry(1.4, .06, .14), tubeMat = new THREE.MeshBasicMaterial({ color: 0xfff6dc, toneMapped: false });
  for (let x = -PL / 2 + 1; x < PL / 2; x += 2.4) { const t = new THREE.Mesh(tubeGeo, tubeMat); t.position.set(x, 4.36, -3.0); plat.add(t); }
  const platLight = new THREE.PointLight(0xfff0d6, 0, 14, 1.4); platLight.position.set(0, 3.2, -3.2); plat.add(platLight);

  // ── the riders: a pool of NPC bodies baked a few a frame, the agent's own (subway/riders.js: the walker body, the city's clips)
  const R0 = rngOf(seed * 7919 + 13), rnd = () => R0(), riders = [], pool = [], NPOOL = 30, crowd = createCrowd({ scene, cap: NPOOL + 2 });
  // the seats: one a SEAT.pitch (the walkers' heads are 0.8 m wide: a closer pitch puts neighbours' heads through each other)
  const seats = []; for (const [a, b] of BENCHES) { const n = Math.max(1, Math.floor((b - a) / SEAT.pitch)); for (let k = 0; k < n; k++) seats.push({ x: a + (b - a) * (k + .5) / n, z: SEAT.z, bench: a, by: null }); }
  // standing spots, every one at a pole (stand_rail's +x hand on it): at each door pole facing the cut (the camera), or beside it facing
  // along the car on the cut's side (one or the other: their heads would meet); at a bench's near-end pole facing along the car (or its
  // first seat: the heads again). The middle door's pole, facing the cut, is the agent's when there is one.
  const spots = []; let AG = null;
  for (const p of POLES) { if (p.door !== undefined) { const face = atPole(p, -.12), side = atPole(p, Math.PI / 2); if (agent && p.door === 0) { AG = face; continue; } face.excl = [side]; side.excl = [face]; spots.push(face, side); }
    else if (p.end === 'a') { const sp = atPole(p, Math.PI / 2), BA = BENCHES.find(([a]) => Math.abs(cell(a + .05) - p.x) < .01), s0 = BA && seats.find(s => s.bench === BA[0]); if (s0) { sp.excl = [s0]; s0.excl = [sp]; } spots.push(sp); } }
  const seatFree = s => !s.by && !(s.excl || []).some(o => o.by), spotFree = seatFree;
  const STAND_CLIP = 'stand_rail', SIT_CLIP = 'sit_ride', WAIT_CLIP = 'wait_stop';
  let built = 0; const looks = Array.from({ length: NPOOL }, (_, k) => C.rollLook((seed * 104729 + k * 7919) & 0xffffff, { pool: 'npc' }));
  function makeRider(look, kind) { const body = crowd.add(look); return body ? { body, kind, look, parent: null, x: 0, z: 0, yaw: 0, st: 'off', seat: null, spot: null, path: null, t: 0, lean: 0, leanV: 0, out: false, snap: false } : null; }
  function buildSome(n) { for (let k = 0; k < n && built < NPOOL; k++, built++) { const R = makeRider(looks[built], 'npc'); if (R) pool.push(R); } }
  const take = () => { const free = pool.filter(R => R.st === 'off'); if (!free.length) return null; return free[(rnd() * free.length) | 0]; };
  function place(R, parent) { R.parent = parent; }
  function seatR(R, s, snap = false) { R.seat = s; s.by = R; R.st = 'sit'; R.spot = null; place(R, car); if (snap) { R.x = s.x; R.z = s.z; R.yaw = 0; R.snap = true; } }
  function standR(R, sp, snap = false) { R.spot = sp; sp.by = R; R.st = 'stand'; R.seat = null; place(R, car); if (snap) { R.x = sp.x; R.z = sp.z; R.yaw = sp.yaw; R.snap = true; } }
  function free(R) { if (R.seat) R.seat.by = null; if (R.spot) R.spot.by = null; R.seat = R.spot = null; R.snap = false; }
  function off(R) { free(R); R.st = 'off'; R.path = null; R.parent = null; }
  function walk(R, pts, then) { R.st = 'walk'; R.snap = false; R.path = pts.slice(); R.then = then; }
  const nearDoor = x => DOORS.reduce((b, d) => Math.abs(d - x) < Math.abs(b - x) ? d : b, DOORS[0]);
  function fillCar(full) { for (const R of riders.splice(0)) if (R.kind === 'npc') off(R); for (const s of seats) s.by = null; for (const s of spots) s.by = null;
    const nSit = Math.round(seats.length * (full ? .8 : .6)), nStand = full ? 5 : 3;
    for (let k = 0; k < nSit; k++) { const R = take(); if (!R) break; const free = seats.filter(seatFree); if (!free.length) break; seatR(R, free[(rnd() * free.length) | 0], true); riders.push(R); }
    for (let k = 0; k < nStand; k++) { const R = take(); if (!R) break; const free = spots.filter(spotFree); if (!free.length) break; standR(R, free[(rnd() * free.length) | 0], true); riders.push(R); } }
  let me = null; const lookP = agent ? Promise.resolve(agent.look || agentLook(agent.id)) : null;
  if (lookP) me = makeRider(await lookP, 'agent'); if (me && AG) AG.by = me;
  buildSome(16); fillCar(true);

  // ── the platform's own people: waiting by the doors, they board when the doors open; riders getting off walk away along it
  const waiting = [];
  function stockPlatform(n) { for (const R of waiting.splice(0)) if (R.st !== 'walk' || R.parent === plat) off(R);
    for (let k = 0; k < n; k++) { const R = take(); if (!R) break; const d = DOORS[(rnd() * 3) | 0]; R.st = 'stand'; R.spot = null; R.snap = true; R.x = d + (rnd() - .5) * 2.4; R.z = -2.5 - rnd() * 1.1; R.yaw = (rnd() - .5) * .8; place(R, plat); waiting.push(R); } }

  // ── the cards (DOM, the kit's tokens when the UI kit is on the page): the line and where it's going, the station, the agent
  const hud = document.createElement('div'); hud.className = 'sbw-hud'; root.appendChild(hud);
  hud.innerHTML = `<div class="sbw-line"><b class="sbw-bul"></b><div><div class="sbw-ln"></div><div class="sbw-dir"></div></div></div>
<div class="sbw-stn" aria-live="polite"><div class="sbw-nm"></div><div class="sbw-sub"></div></div>
<div class="sbw-who">${agent ? `<b>@${esc(agent.handle || agent.id)}</b>` : '<b>riding</b>'}<span class="sbw-eta"></span><i class="sbw-bar"><i></i></i></div>
<button class="sbw-x" aria-label="Leave the subway (Esc)">esc · back to the street</button>`;
  const $ = s => hud.querySelector(s), tag = document.createElement('div'); tag.className = 'sbw-tag'; if (agent) { tag.textContent = '@' + (agent.handle || agent.id); root.appendChild(tag); }
  $('.sbw-x').addEventListener('click', e => { e.stopPropagation(); close(); });
  import('../ui/signfont.js').then(m => m.loadSignFont?.()).catch(() => {});

  // ── line accents (the stripe, the map strip, the cards) and the platform wall: redrawn only when they change
  let lineNow = null, stripKey = '', wallKey = '', cardKey = '';
  function setLine(id, dir) { const ln = net.lines.get(id); if (!ln || (lineNow === id && stripKey.endsWith(dir))) return ln; lineNow = id; stripeMat.color.setHex(ln.hex);
    $('.sbw-bul').textContent = ln.bullet; $('.sbw-bul').style.background = hexCss(ln.hex); $('.sbw-ln').textContent = ln.name; $('.sbw-dir').textContent = 'to ' + net.nameOf(ln.term[dir] ?? ln.term.fwd); return ln; }
  function frameUI(s, ln, t) {
    const k1 = `${ln.id}|${s.at ? s.st : ''}|${s.next ?? ''}|${s.dir}`; if (k1 !== stripKey) { stripKey = k1; stripTex.userData.redraw((g, w, h) => drawStrip(g, w, h, ln, net, s.at ? s.st : null, s.at ? null : s.next, s.dir)); }
    const at = s.at || Math.abs(s.dx) < 6, st = s.at || s.dx > -6 ? (s.at ? s.st : s.dx > 0 ? s.next ?? s.st : s.st) : s.st, chg = changesAt(net, st, ln.id).map(id => net.lines.get(id));
    const k2 = `${at ? 'at' : 'next'}|${at ? st : s.next}|${ln.id}`; if (k2 !== cardKey) { cardKey = k2; const card = $('.sbw-stn'), nm = $('.sbw-nm'), sub = $('.sbw-sub');
      if (at) { nm.textContent = net.nameOf(st); sub.innerHTML = chg.length ? 'change for ' + chg.map(c => `<b style="background:${hexCss(c.hex)}">${esc(c.bullet)}</b> ${esc(c.name)}`).join(' ') : st === P.to && t > P.dur - 12 ? 'this is the stop' : ''; card.style.setProperty('--sbw-c', hexCss(ln.hex)); card.classList.add('at'); }
      else { nm.textContent = 'next · ' + net.nameOf(s.next); sub.textContent = ''; card.classList.remove('at'); card.style.setProperty('--sbw-c', hexCss(ln.hex)); } }
    const left = Math.max(0, P.dur - t); $('.sbw-eta').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} to ${net.nameOf(P.to)}`; $('.sbw-bar i').style.width = (100 * clamp(t / P.dur, 0, 1)).toFixed(1) + '%'; }

  // ── the timeline: the program's state at t → the car, the tunnel, the platform, the riders
  let closed = false, raf = 0, lastT = 0, paused = false, clockT = now(), segK = -1, platFor = '', fade = 0, swapAt = null, boardedK = -1, doneSent = false, tunS = 0, prevV = 0, acc = 0;
  const ents = [], ride = { roll: 0, bump: 0 }, M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(), Yv = new THREE.Vector3(0, 1, 0);
  const startAboard = clockT > (P.segs[0].kind === 'dwell' ? P.segs[0].t0 + .6 : 0);
  if (me) { if (startAboard) standAgent(true); else boardAgent(true); }
  function standAgent(snap = false) { free(me); me.spot = AG; AG.by = me; me.st = 'stand'; place(me, car); if (snap) { me.x = AG.x; me.z = AG.z; me.yaw = AG.yaw; me.snap = true; } }
  function boardAgent(fromPlatform) { free(me); me.x = .9; me.z = -3.0; me.yaw = Math.PI; place(me, car); walk(me, [[.25, -2.0], [.15, -1.1], [AG.x, AG.z]], () => standAgent()); if (!fromPlatform) me.x = .2; }
  function alightAgent() { free(me); walk(me, [[.3, -.4], [.1, -1.3], [-.2, -2.3], [-1.6, -3.0]], () => { me.st = 'stand'; me.yaw = -Math.PI / 2; }); }
  function onSegment(k, s, t) {   // entering segment k
    const ln = setLine(s.line, s.dir);
    if (s.kind === 'dwell') {
      if (s.change && k > 0) { swapAt = s.t0 + Math.min(3.2, (s.t1 - s.t0) * .3); if (me) alightAgent(); }   // the change: off this train, then the other line's
      else if (s.board && k === 0 && me && !startAboard) { /* boarding already set up */ }
      else shuffle(s); }
    if (s.kind === 'run' && k === P.segs.length - 1 && me) { /* the last stretch: the agent moves to the door near the end (step) */ }
    return ln; }
  function shuffle(s) {   // at a station: some get off (to the nearest door, out, away along the platform), the waiting get on
    const nOff = 1 + ((rnd() * 2.2) | 0); for (let k = 0; k < nOff; k++) { const cand = riders.filter(R => R.kind === 'npc' && (R.st === 'sit' || R.st === 'stand')); if (!cand.length) break; const R = cand[(rnd() * cand.length) | 0], x0 = R.st === 'sit' ? R.seat.x : R.x, d = nearDoor(x0);
      free(R); riders.splice(riders.indexOf(R), 1);   // (from where it sits or stands: the walk eases it up and out)
      R.delay = .8 + k * .9 + rnd() * .6; walk(R, [[d + (rnd() - .5) * .3, -.6], [d, -1.7], [d + (rnd() < .5 ? -1 : 1) * (1.2 + rnd()), -2.9], [d + (rnd() < .5 ? -9 : 9), -3.2]], () => off(R)); R.leaving = true; } }
  function boardWaiting(s) { let k = 0; for (const R of waiting.splice(0)) { const d = nearDoor(R.x); R.delay = 1.6 + k++ * .7 + rnd() * .5;
      const seat = seats.filter(seatFree).sort((a, b) => Math.abs(a.x - d) - Math.abs(b.x - d))[(rnd() * 2) | 0], sp = !seat ? spots.find(spotFree) : null; if (seat) seat.by = R; if (sp) sp.by = R;
      if (!seat && !sp) { R.delay = 0; walk(R, [[R.x + (rnd() < .5 ? -9 : 9), R.z]], () => off(R)); continue; }   // (no seat and no pole free: waits for the next one, off along the platform)
      walk(R, [[d + (rnd() - .5) * .2, -2.0], [d, -1.0], seat ? [seat.x, SEAT.front + .3] : [sp.x, sp.z]], () => { if (seat) { seat.by = null; seatR(R, seat); } else { sp.by = null; standR(R, sp); } riders.push(R); });
      R.boarding = true; } }
  function step(dt, T) {
    const t = clamp(clockT, 0, P.dur), s = stateAt(P, t);
    if (s.k !== segK) { segK = s.k; onSegment(s.k, s.seg, t); }
    const ln = net.lines.get(lineNow) ?? setLine(s.line, s.dir);
    // the change: a quick dip to black, the other line's train (new riders), the agent on the platform walks on
    if (swapAt !== null && t >= swapAt) { swapAt = null; fade = 1; setTimeout(() => { if (closed) return; fillCar(false); setLine(s.seg.line, s.seg.dir); stripKey = ''; if (me) boardAgent(true); }, 180); }
    // the car's speed → the tunnel streaming, the sway, the rail joints; the platform at its offset
    const v = s.v; acc = lerp(acc, dt > 0 ? (v - prevV) / dt : 0, 1 - Math.exp(-dt * 4)); prevV = v; tunS += v * dt;
    const vn = clamp(v / 16, 0, 1), joint = (tunS % 13.5) / 13.5; ride.bump = vn * (joint < .06 ? -.012 * Math.sin(joint / .06 * Math.PI) : 0) - vn * .004 * Math.abs(Math.sin(T * 11));
    ride.roll = .006 * Math.sin(T * 1.9) * (.3 + vn) + .003 * Math.sin(T * 4.7) * vn; car.rotation.x = ride.roll; car.position.y = ride.bump;
    car.rotation.z = -acc * .0015;
    for (let k = 0; k < 26; k++) { const x = ((k * 2.6 - tunS) % TUN + TUN) % TUN - TUN / 2; const hide = plat.visible && Math.abs(x - plat.position.x) < PL / 2 + .3; M4.compose(V3.set(x, 1.7, -3.15), Q4.identity(), S3.set(1, hide ? .0001 : 1, 1)); ribs.setMatrixAt(k, M4); }
    for (let k = 0; k < 12; k++) { const x = ((k * 5.6 - tunS + (k % 3) * .9) % (TUN + 3.2) + TUN + 3.2) % (TUN + 3.2) - (TUN + 3.2) / 2, hide = plat.visible && Math.abs(x - plat.position.x) < PL / 2 + 1; M4.compose(V3.set(x, k % 2 ? 2.9 : .5, -3.0), Q4.identity(), S3.set(hide ? .0001 : .22 + v * .085, 1, 1)); lamps.setMatrixAt(k, M4); }
    for (let k = 0; k < 3; k++) { const x = ((k * 22 - tunS * 1) % TUN + TUN) % TUN - TUN / 2, hide = plat.visible && Math.abs(x - plat.position.x) < PL / 2 + 1; M4.compose(V3.set(x, 1.85, -3.05), Q4.identity(), S3.setScalar(hide ? .0001 : 1)); sigs.setMatrixAt(k, M4); }
    ribs.instanceMatrix.needsUpdate = lamps.instanceMatrix.needsUpdate = sigs.instanceMatrix.needsUpdate = true;
    const show = s.at || Math.abs(s.dx) < PL / 2 + 9; plat.visible = show; plat.position.x = s.at ? 0 : s.dx; platLight.intensity = show ? 9 : 0;
    if (show) { const key2 = s.st + '|' + ln.id; if (key2 !== wallKey) { wallKey = key2; wallTex.userData.redraw((g, w, h) => drawWall(g, w, h, net.nameOf(s.st), ln)); }
      if (platFor !== s.st && !s.at && s.dx > 0) { platFor = s.st; stockPlatform(s.st === P.to ? 1 : 2 + ((rnd() * 2.5) | 0)); } }
    else if (platFor) { platFor = ''; for (const R of waiting.splice(0)) off(R); }
    // the doors: open a beat after the stop, close a beat before it leaves (and at the end of the ride, open as it stops)
    const sg = s.seg, last = s.k === P.segs.length - 1; let open = 0;
    if (s.at) { const a = t - sg.t0, b = sg.t1 - t; open = ease(Math.min((a - .5) / .7, (b - .9) / .7)); if (open > .5 && waiting.length && !sg.boarded) { sg.boarded = true; boardWaiting(sg); } }
    else if (last && sg.t1 - t < .25) open = ease((.25 - (sg.t1 - t)) / .25);
    for (const l of leaves) l.g.position.x = l.d + l.s * open * .58;
    // the agent: to the door in the last few seconds of the ride
    if (me && last && sg.t1 - t < 5 && me.st === 'stand' && me.spot === AG) { free(me); walk(me, [[.3, -.2], [.12, -.95]], () => { me.st = 'stand'; me.spot = null; me.yaw = Math.PI; }); }
    // the riders: walking ones along their paths (car frame → platform frame across the door line), everyone posed
    const all = [...riders, ...waiting, ...pool.filter(R => R.st === 'walk' && !riders.includes(R) && !waiting.includes(R))]; if (me) all.push(me); ents.length = 0;
    for (const R of new Set(all)) { if (R.st === 'off') continue;
      if (R.st === 'walk') { if (R.delay > 0) { R.delay -= dt; } else { const p = R.path[0]; if (!p) { R.st = 'stand'; R.then?.(); }
          else { const inPlat = R.parent === plat, ox = inPlat ? plat.position.x : 0, dx = p[0] - R.x, dz = p[1] - R.z, d = Math.hypot(dx, dz), sp = 1.25 * dt;
            if (d <= sp) { R.x = p[0]; R.z = p[1]; R.path.shift(); if (!R.path.length) { const f = R.then; R.then = null; R.st = 'stand'; f?.(); } } else { R.x += dx / d * sp; R.z += dz / d * sp; }
            const ty = Math.atan2(dx, dz); R.yaw += Math.atan2(Math.sin(ty - R.yaw), Math.cos(ty - R.yaw)) * Math.min(1, dt * 9);
            if (!inPlat && R.z < -1.75 && open > .3) { place(R, plat); R.x -= plat.position.x; } else if (inPlat && R.z > -1.75) { place(R, car); R.x += ox; } } } }
      if (R.st === 'stand') { R.leanV += ((-acc) - R.lean) * dt * 6; R.leanV *= Math.exp(-dt * 2.5); R.lean += R.leanV * dt * 6; } else R.lean = lerp(R.lean, -acc, dt * 3);
      // into a seat or a pole spot (eased from where the walk left it) and the clip that goes with it: sit_ride, stand_rail; wait_stop on
      // the platform; walking or standing loose: none (the walk, the idles)
      let clip = null; const k = 1 - Math.exp(-dt * 7), to = R.st === 'sit' ? R.seat : R.st === 'stand' ? R.spot : null;
      if (to) { R.x = lerp(R.x, to.x, k); R.z = lerp(R.z, to.z, k); const ty = to.yaw ?? 0; R.yaw += Math.atan2(Math.sin(ty - R.yaw), Math.cos(ty - R.yaw)) * k; clip = R.st === 'sit' ? SIT_CLIP : STAND_CLIP; }
      else if (R.st === 'stand' && R.parent === plat && waiting.includes(R)) clip = WAIT_CLIP;
      R.clip = clip; ents.push({ body: R.body, parent: R.parent, x: R.x, z: R.z, yaw: R.yaw, clip, snap: R.snap, lean: R.st === 'stand' && R.parent === car ? -R.lean * .03 : 0, show: R.parent !== plat || plat.visible }); R.snap = false; }
    crowd.frame(ents, dt);
    frameUI(s, ln, t);
    if (!doneSent && clockT >= P.dur) { doneSent = true; setTimeout(() => { if (!closed) { onDone?.(); close(); } }, 450); root.classList.add('out'); }
  }
  // ── the camera: a section view from the cut side, a touch of handheld drift, the target easing after the agent
  const CAM = { tx: 0, x: 0 }, base = new THREE.Vector3(0, 5.3, 16.4), aim = new THREE.Vector3(0, 1.15, -.7);
  let px = 0, py = 0; root.addEventListener('pointermove', e => { const r = root.getBoundingClientRect(); px = (e.clientX - r.left) / r.width - .5; py = (e.clientY - r.top) / r.height - .5; });
  function placeCam(T, dt) { const wx = me ? (me.parent === plat ? me.x + plat.position.x : me.x) : 0; CAM.tx = lerp(CAM.tx, clamp(wx * .35, -1.5, 1.5), 1 - Math.exp(-dt * 1.2));
    camera.position.set(base.x + CAM.tx + px * 1.6 + .05 * Math.sin(T * .31), base.y - py * .5 + .03 * Math.sin(T * .43), base.z); camera.lookAt(aim.x + CAM.tx * .9, aim.y, aim.z); }
  const tagV = new THREE.Vector3();
  function placeTag() { if (!me || !agent || !crowd.world(me, me.st === 'sit' ? 1.9 : 2.25, tagV)) return; tagV.project(camera);
    const r = root.getBoundingClientRect(); tag.style.transform = `translate(${((tagV.x + 1) / 2 * r.width).toFixed(1)}px, ${((1 - tagV.y) / 2 * r.height).toFixed(1)}px) translate(-50%, -100%)`; tag.style.opacity = me.st === 'off' ? 0 : 1; }
  function frame(T, dt) { if (built < NPOOL) buildSome(2); step(dt, T); placeCam(T, dt); placeTag();
    if (fade > 0) { fade = Math.max(0, fade - dt * 2.2); } root.style.setProperty('--sbw-fade', String(ease(Math.min(1, fade * 1.6)))); renderer.render(scene, camera); }
  function loop(ms) { raf = requestAnimationFrame(loop); const T = ms / 1000, dt = lastT ? Math.min(.1, T - lastT) : 0; lastT = T; if (paused) return; clockT = now(); frame(T, dt); }
  const onKey = e => { if (e.key === 'Escape' && !closed) { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  addEventListener('keydown', onKey, true);
  function close() { if (closed) return; closed = true; cancelAnimationFrame(raf); removeEventListener('keydown', onKey, true); ro.disconnect();
    crowd.dispose();
    for (const g of own) g.dispose(); for (const m of [...MATS, stripeMat, stripMat, ...cardMats, colMat, tubeMat, ribs.material, lamps.material, sigs.material, tunWall.material, slab.material, edge.material, lip.material, pwall.material, pceil.material]) { m.map?.dispose(); m.dispose(); }
    for (const g of [stripeGeo, stripGeo, cardGeo, ribGeo, lampGeo, sigGeo, colGeo, tubeGeo, tunWall.geometry, slab.geometry, edge.geometry, lip.geometry, pwall.geometry, pceil.geometry]) g.dispose();
    renderer.dispose(); renderer.forceContextLoss?.(); root.remove(); onClose?.(); }
  setLine(P.segs[0].line, P.segs[0].dir); raf = requestAnimationFrame(loop);
  return { close, get t() { return clockT; }, get closed() { return closed; }, pause(on) { paused = !!on; }, view: { scene, camera, renderer, root },
    advance(sec, stepS = 1 / 30) { for (let s = 0; s < sec - 1e-6; s += stepS) { lastT += stepS; clockT = now(); frame(lastT, stepS); } },
    state: () => { const s = stateAt(P, clamp(clockT, 0, P.dur)); return { t: +clockT.toFixed(2), dur: +P.dur.toFixed(2), seg: s.seg.kind, st: s.st, v: +s.v.toFixed(2), dx: +(s.dx ?? 0).toFixed(2), riders: riders.length, waiting: waiting.length, built, crowd: crowd.stats(), line: lineNow, agent: me ? me.st : null,
      calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; } };
}

let cssDone = false;
function css() { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = `
.sbw { position: fixed; inset: 0; z-index: 30; background: #07080c; animation: sbw-in .45s ease-out both; --sbw-ink: var(--zt-ink, #17171b); --sbw-bone: var(--zt-bone, #e6e1d6); --sbw-white: var(--zt-white, #f4f1ea); --sbw-pink: var(--zt-pink, #ff4fa3); --sbw-sign: var(--k-font-sign, "AI City Sign", "Space Mono", ui-monospace, monospace); --sbw-mono: var(--k-font-mono, "Space Mono", ui-monospace, Menlo, monospace); }
.sbw.out { animation: sbw-out .45s ease-in both; }
@keyframes sbw-in { from { opacity: 0; } } @keyframes sbw-out { to { opacity: 0; } }
.sbw canvas { display: block; width: 100%; height: 100%; touch-action: none; }
.sbw::after { content: ""; position: absolute; inset: 0; background: #000; opacity: var(--sbw-fade, 0); pointer-events: none; }
.sbw-hud { position: absolute; inset: 0; pointer-events: none; font: 700 12px/1.3 var(--sbw-mono); color: var(--sbw-ink); text-transform: uppercase; }
.sbw-line { position: absolute; left: 16px; top: 16px; display: flex; gap: 10px; align-items: center; background: var(--sbw-bone); padding: 8px 12px 8px 8px; box-shadow: 4px 5px 0 var(--sbw-ink); }
.sbw-bul { display: grid; place-items: center; width: 36px; height: 36px; color: var(--sbw-white); font: 400 27px/1 var(--sbw-sign); }
.sbw-ln { font: 400 18px/1 var(--sbw-sign); letter-spacing: .02em; } .sbw-dir { margin-top: 4px; color: #3a3a40; font-size: 11px; letter-spacing: .04em; }
.sbw-stn { position: absolute; left: 50%; top: 16px; transform: translateX(-50%); min-width: min(380px, calc(100vw - 32px)); max-width: calc(100vw - 32px); box-sizing: border-box; text-align: center; background: var(--sbw-bone); padding: 10px 16px; box-shadow: 4px 5px 0 var(--sbw-ink); border-top: 6px solid var(--sbw-c, #2f5bff); transition: background .2s, color .2s; }
.sbw-stn.at { background: var(--sbw-c, #2f5bff); color: var(--sbw-white); border-top-color: var(--sbw-ink); }
.sbw-nm { font: 400 27px/1.05 var(--sbw-sign); letter-spacing: .03em; } .sbw-stn:not(.at) .sbw-nm { font-size: 18px; }
.sbw-sub:empty { display: none; } .sbw-sub { margin-top: 6px; font-size: 12px; letter-spacing: .04em; } .sbw-sub b { display: inline-block; min-width: 16px; padding: 2px 3px 1px; color: var(--sbw-white); font: 400 18px/1 var(--sbw-sign); box-shadow: 1px 1px 0 var(--sbw-ink); vertical-align: -3px; }
.sbw-who { position: absolute; left: 16px; bottom: 16px; display: grid; grid-template-columns: auto auto; gap: 6px 12px; align-items: baseline; background: var(--sbw-bone); padding: 8px 12px; box-shadow: 4px 5px 0 var(--sbw-ink); }
.sbw-who b { font: 400 18px/1 var(--sbw-sign); color: var(--sbw-ink); } .sbw-eta { font-size: 11px; letter-spacing: .04em; color: #3a3a40; }
.sbw-bar { grid-column: 1 / -1; display: block; height: 5px; background: rgba(23, 23, 27, .15); } .sbw-bar i { display: block; height: 100%; width: 0; background: var(--sbw-pink); }
.sbw-x { position: absolute; right: 16px; bottom: 16px; pointer-events: auto; border: 0; cursor: pointer; background: var(--sbw-white); color: var(--sbw-ink); font: 700 11px/1 var(--sbw-mono); text-transform: uppercase; letter-spacing: .04em; padding: 10px 12px; min-height: 36px; box-shadow: 3px 3px 0 var(--sbw-pink); }
.sbw-x:hover { background: var(--zt-yel, #ffc21a); } .sbw-x:focus-visible { outline: 3px solid var(--sbw-pink); outline-offset: 2px; }
.sbw-tag { position: absolute; left: 0; top: 0; pointer-events: none; background: var(--sbw-pink); color: var(--sbw-ink); font: 400 18px/1 var(--sbw-sign); padding: 4px 6px 3px; box-shadow: 2px 2px 0 var(--sbw-ink); white-space: nowrap; transition: opacity .2s; }
@media (max-width: 640px) { .sbw-line { left: 8px; top: 8px; } .sbw-stn { top: 70px; } .sbw-who { left: 8px; bottom: 8px; } .sbw-x { right: 8px; bottom: 64px; } }
@media (prefers-reduced-motion: reduce) { .sbw, .sbw.out { animation: none; } }`; document.head.appendChild(s); }
