// Streets pass · THE SIGNAL LAMPS: the live layer of the traffic signals. The poles, heads and ped boxes are baked into the blocks (street.js
// signalPole, laid out by ground.js signalPoles + SIG) with every lens dark; this layer lights, every frame, the lens that traffic/rules.js
// signalAt says is on — red, yellow or green on each face of each head — and the WALK / DON'T WALK icon of each ped box (flashing hand
// while `flash`), for the poles within RANGE of the camera. Four instanced draws citywide: lenses, night halos, hands, walkers.
// Every batch has frustumCulled = false: three r185 never refreshes an instanced mesh's bounding sphere, so a batch whose instances move
// is culled whole (PASS-fidelity.md). ground.js creates it (createLamps, handing it signalPoles + SIG: this module never imports ground.js)
// — main.js needs no hook; it updates itself in the scene's onBeforeRender (chained), before three projects the scene, so what it writes
// draws in the same frame.
import * as THREE from 'three';
import { P } from '../plan.js';
import { SIDE } from '../style.js';
import { TOD } from '../kit.js';
import { buildsBlock } from '../modules.js';
import { CLOCK, signalAt } from './rules.js';
import { paintedTexture } from '../canvastex.js';   // (black-ground fix: these canvases came back blank after a GPU-process reset)

export const RANGE = 170;   // m: past it a head is a few pixels (and the mid tier still has the poles out to 270 m, so none floats)
const CAP = 4096, LIT = { R: 0xff2a1a, Y: 0xffb300, G: 0x2cff6a }, SLOT = { R: 0, Y: 1, G: 2 }, BLINK = .55;
const LENS_OUT = .03 - .15;   // a lit lens is a 0.3 m box standing 3 cm proud of its dark lens (its back half buried in the housing)

// the two ped icons as 10 × 12 pixel art (the NYC orange hand, the white walking man): read at a glance, voxel-crisp
const HAND = ['..X.X.X...', '..X.X.X.X.', '..X.X.X.X.', '..X.X.X.X.', 'X.XXXXXXX.', 'XXXXXXXXX.', '.XXXXXXXX.', '..XXXXXXX.', '..XXXXXX..', '...XXXXX..', '...XXXXX..', '...XXXXX..'];
const MAN = ['....XX....', '....XX....', '..........', '...XXX....', '..XXXXX...', '.X.XXX.X..', '.X.XXX..X.', '...XXX....', '...X.X....', '..XX.XX...', '..X...X...', '.XX...XX..'];
function iconTex(rows) { const t = paintedTexture(12, 14, g => { g.fillStyle = '#fff'; rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'X') g.fillRect(x + 1, y + 1, 1, 1); })); });
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t; }
function haloTex() { const t = paintedTexture(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.14, 'rgba(255,255,255,.95)'); gr.addColorStop(.35, 'rgba(255,255,255,.4)'); gr.addColorStop(.7, 'rgba(255,255,255,.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }); t.colorSpace = THREE.SRGBColorSpace; return t; }

export function createLamps(scene, { poles: signalPoles, sig: SIG, range = RANGE, isBuilt = (i, j) => buildsBlock(i, j) }) {
  const night = !!TOD.night, batch = (geo, mat, colors) => { const m = new THREE.InstancedMesh(geo, mat, CAP); m.count = 0; m.frustumCulled = false; m.castShadow = m.receiveShadow = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); if (colors) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); } scene.add(m); return m; };
  const lens = batch(new THREE.BoxGeometry(.3, .28, .3), new THREE.MeshBasicMaterial({ toneMapped: false }), true);
  const halo = night ? batch(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: haloTex(), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), true) : null;
  if (halo) halo.renderOrder = 2;
  const icon = rows => new THREE.MeshBasicMaterial({ map: iconTex(rows), alphaTest: .5, toneMapped: false });
  const hand = batch(new THREE.PlaneGeometry(.36, .42), Object.assign(icon(HAND), { color: new THREE.Color(0xff7a1a) }));
  const man = batch(new THREE.PlaneGeometry(.36, .42), Object.assign(icon(MAN), { color: new THREE.Color(0xf4f8ff) }));
  lens.name = 'signal-lenses'; hand.name = 'signal-hands'; man.name = 'signal-walk'; if (halo) halo.name = 'signal-halos';
  const COL = Object.fromEntries(Object.entries(LIT).map(([k, v]) => [k, new THREE.Color(v)]));

  let poles = [], at = '';
  const gather = (cx, cz) => { const ci = Math.floor(cx / P), cj = Math.floor(cz / P), key = ci + ',' + cj; if (key === at) return; at = key; poles = [];
    const n = Math.ceil(range / P) + 1; for (let i = ci - n; i <= ci + n; i++) for (let j = cj - n; j <= cj + n; j++) { if (!isBuilt(i, j)) continue;
      for (const q of signalPoles(i, j)) if (Math.hypot(q.x - cx, q.z - cz) < range + P) { q.key = i + ',' + j; poles.push(q); } } };
  // a pole lights only while its block shows its full or mid tier (the ones with the poles in them): no lamp hangs in the air before the
  // block streams in (window.__city.stream, main.js; without it — a report page — every built block counts)
  const shown = k => { const st = globalThis.__city?.stream, r = st?.blocks?.get(k); return !st || (!!r && (r.shown === 'full' || r.shown === 'mid')); };

  // instance writers: a translation (lenses) or a quarter turn about y + translation (icons and halos face n)
  // V10 (render review 2026-10-09) · only what changed goes up. A write is compared with what its slot holds (the GPU's copy too: every
  // change is uploaded), a changed slot widens its attribute's dirty range, and update() flags just that range (addUpdateRange).
  // Steady lights under a still camera upload nothing; before, every batch re-sent all CAP slots every frame (~0.8 MB a frame).
  const M16 = new Float32Array(16), C3 = new Float32Array(3), dirty = new Map();
  const write = (att, o, v) => { const a = att.array; let lo = -1, hi = -1;
    for (let i = 0; i < v.length; i++) if (a[o + i] !== v[i]) { a[o + i] = v[i]; if (lo < 0) lo = i; hi = i; }
    if (lo < 0) return; const d = dirty.get(att);
    if (d) { d[0] = Math.min(d[0], o + lo); d[1] = Math.max(d[1], o + hi + 1); } else dirty.set(att, [o + lo, o + hi + 1]); };
  const put = (m, k, x, y, z, nx = 0, nz = 1) => { M16.fill(0);
    M16[0] = nz; M16[2] = -nx; M16[5] = 1; M16[8] = nx; M16[10] = nz; M16[12] = x; M16[13] = y; M16[14] = z; M16[15] = 1; write(m.instanceMatrix, k * 16, M16); };
  const tint = (m, k, c) => { C3[0] = c.r; C3[1] = c.g; C3[2] = c.b; write(m.instanceColor, k * 3, C3); };
  let nL = 0, nH = 0, nHand = 0, nMan = 0;
  const lit = (x, y, z, nx, nz, face, st) => { if (nL >= CAP) return; const d = face + LENS_OUT, c = COL[st];
    put(lens, nL, x + nx * d, y, z + nz * d); tint(lens, nL++, c);
    if (halo && nH < CAP) { put(halo, nH, x + nx * (face + .05), y, z + nz * (face + .05), nx, nz); tint(halo, nH++, c); } };
  const ped = (x, z, nx, nz, walk, flashing, blinkOn) => { const px = x + nx * (SIG.pedFace + .012), pz = z + nz * (SIG.pedFace + .012), y = SIDE + SIG.pedY;
    if (walk) { if (nMan < CAP) put(man, nMan++, px, y, pz, nx, nz); } else if ((!flashing || blinkOn) && nHand < CAP) put(hand, nHand++, px, y, pz, nx, nz); };

  function update(camera) {
    const cp = camera.position; gather(cp.x, cp.z); const t = CLOCK.t, blinkOn = ((t % 1) + 1) % 1 < BLINK, r2 = range * range; nL = nH = nHand = nMan = 0;
    for (const q of poles) { const dx = q.x - cp.x, dz = q.z - cp.z, dy = cp.y - 3; if (dx * dx + dz * dz + dy * dy > r2 || !shown(q.key)) continue;
      const st = signalAt(q.Lx, q.Lz, t), sg = q.rot === 0 ? 1 : -1;
      // the four-faced head: ±z faces show the N–S phase, ±x faces the E–W phase
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const s = nx ? st.ew : st.ns; lit(q.x, SIDE + SIG.lensY[SLOT[s]], q.z, nx, nz, SIG.face, s); }
      // a mast's hanging head, double-faced along the road it spans
      if (q.span) { const ns = q.span === 'ns', hx = q.x + sg * (ns ? q.reach : 0), hz = q.z + sg * (ns ? 0 : q.reach), s = ns ? st.ns : st.ew;
        for (const f of [1, -1]) lit(hx, SIDE + SIG.mastY[SLOT[s]], hz, ns ? 0 : f, ns ? f : 0, SIG.mastFace, s); }
      // the ped boxes: local +x faces across the crossing over the N–S road (walkAcrossNS, flashing at the end of the E–W green),
      // local +z across the one over the E–W road
      ped(q.x, q.z, sg, 0, st.walkAcrossNS, st.flash && st.ew === 'G', blinkOn);
      ped(q.x, q.z, 0, sg, st.walkAcrossEW, st.flash && st.ns === 'G', blinkOn); }
    for (const [m, n] of [[lens, nL], [halo, nH], [hand, nHand], [man, nMan]]) if (m) m.count = n;
    for (const [att, d] of dirty) { att.addUpdateRange(d[0], d[1] - d[0]); att.needsUpdate = true; }
    dirty.clear();
  }
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (renderer, sc, camera, ...rest) { prev.call(this, renderer, sc, camera, ...rest); if (camera && camera.isCamera) update(camera); };
  return { update, get poles() { return poles; }, stats: () => ({ poles: poles.length, lenses: nL, hands: nHand, walk: nMan, halos: nH }), meshes: [lens, halo, hand, man].filter(Boolean) };
}
