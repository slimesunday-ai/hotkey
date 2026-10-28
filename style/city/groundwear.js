// GROUND PASS (2026-10-06) · THE HANDMADE GROUND (art direction 2026-09-28, item 9). Flat-colour decal voxels painted into the ground
// canvases (ground.js draw, inside its paintedTexture, so a GPU reset repaints them too): darker tyre lanes along every travel lane,
// asphalt patches (some with sealed seams), tar-snake sealant, oil in the parking lanes and where cars idle at the stop bars, manholes,
// utility plates and kerb drains; zebra bars, stop bars and lane lines chipped (most where the wheels run); sidewalks with replaced,
// cracked and corner-broken slabs, gum, stains and kerb chips. Ground only (STYLE §2: no grime on buildings).
// Every mark is snapped to the 0.1 m city voxel (one pixel of a fine tile) and is a pure function of world position: seeded by its road
// segment, node or block, never by the tile or the load, so a tile paints the same every time and a mark crossing a tile edge continues.
// GRIME (per district) scales the counts and the tones: Gatehill clean, downtown in between, the docks and the junkyard grimy.
// The one moving part is the night steam over a few manholes (createSteam: one instanced draw, near the camera, built only at night).
// Worker-safe at module level (ground.js rides in the build workers' bundle).
import * as THREE from 'three';
import { P, kindAt, distOf, urban, segX, segZ, hwX, hwZ, isHwy } from './plan.js';
import { hash, rng } from './style.js';
import { isOneWay, oneWayDir } from './traffic/rules.js';

export const GRIME = { estates: .1, hospital: .25, suburbs: .3, mall: .6, downtown: .5, strip: .7, highway: .45, jail: .5, trailer: .75, industrial: .85, docks: 1, junkyard: 1, forest: .35, sea: .5, bridge: .5 };
const grimeOf = (i, j) => GRIME[distOf(kindAt(i, j))] ?? .5;
// night steam: the share of a district's manholes that steam (a few per district; none in the trailer park, the woods or Gatehill's lawns)
const STEAM = { downtown: .045, strip: .08, docks: .3, junkyard: .2, industrial: .06, estates: .08, hospital: .1, mall: .06, suburbs: .01, jail: .2, highway: .03 };
const COMMERCIAL = new Set(['D', 'd', 'N', 'L', 'B', 'C', 'S', 'P', 'W', 'A', 'H']);
const hx6 = c => '#' + c.toString(16).padStart(6, '0');
// the palette of wear: every tone sits a few % off the surface it marks (asphalt #5D5E6B, sidewalk #CDC5B8, curb #ECE8DF)
const C = Object.fromEntries(Object.entries({
  asphalt: 0x5d5e6b, tyreA: 0x565763, tyreB: 0x50515c, oil: 0x4a4b56, oil2: 0x41424c, gutter: 0x555661,
  patchNew: 0x4e4f5a, patchOld: 0x666772, seam: 0x45464f, sealant: 0x3e3f49,
  rim: 0x34353d, iron: 0x4a4b54, ironDot: 0x3c3d46, plate: 0x72737b, plateEdge: 0x47484f, grate: 0x2a2b31, grateBar: 0x4c4d55,
  slabNew: 0xd5cec2, slabOld: 0xc4bcaf, crack: 0xaea595, corner: 0xbbb3a6, gum1: 0xb4ac9f, gum2: 0xa29b8f, gum3: 0x8d877d, stain: 0xc3bbad, stain2: 0xb7afa1,
  kerbChip: 0xd2cbbf, kerbScuff: 0xc6c0b4,
}).map(([k, v]) => [k, hx6(v)]));
const seedOf = (a, b, c) => (hash(a, b, c) * 4294967296) | 0;

// the lanes of a road, as world offsets across it (u, + toward +x / +z): travel lanes [u, dir along the road] and parking lanes [u]
// (traffic/sim.js lanesOf, vehicles/index.js parkOff: a one-way side street drives on one half and parks on the other; an avenue's
// inner lanes (±1) drive, its kerb lanes (±3) park; Route 9 drives ±1 and ±3.2)
function lanesOf(axis, L, hw) {
  const dirOf = u => axis === 'x' ? (u > 0 ? -1 : 1) : (u > 0 ? 1 : -1);
  if (isOneWay(axis, L)) { const d = oneWayDir(axis, L), park = (axis === 'x' ? -d : d) * (hw - .88); return { travel: [[-park, d]], park: [park] }; }   // (transit sync: vehicles/index.js PARK_IN, traffic/sim.js ONEWAY_LANE)
  if (!isHwy(axis, L)) return { travel: [[1, dirOf(1)], [-1, dirOf(-1)]], park: [hw - .88, -(hw - .88)] };
  return { travel: [1, 3.2, -1, -3.2].map(u => [u, dirOf(u)]), park: [] };
}
const crossAt = (axis, L, n) => axis === 'x' ? (segZ(n, L - 1) || segZ(n, L)) : (segX(n, L - 1) || segX(n, L));
const crossHw = (axis, n) => axis === 'x' ? hwZ(n) : hwX(n);
// one road segment: the road on line L (axis 'x': x = L·P, running in z) beside block row/column n, from node n to node n + 1
function segment(axis, L, n) {
  const hw = axis === 'x' ? hwX(L) : hwZ(L), c = L * P, a0 = n * P, b0 = (n + 1) * P, ca = crossAt(axis, L, n), cb = crossAt(axis, L, n + 1);
  const g = (axis === 'x' ? grimeOf(L - 1, n) + grimeOf(L, n) : grimeOf(n, L - 1) + grimeOf(n, L)) / 2;
  const dist = axis === 'x' ? distOf(kindAt(L - (hash(L, n, 5) < .5 ? 1 : 0), n)) : distOf(kindAt(n, L - (hash(L, n, 6) < .5 ? 1 : 0)));
  return { axis, L, n, hw, c, g, dist, ca, cb, lanes: lanesOf(axis, L, hw),
    a: a0 + (ca ? crossHw(axis, n) : 0), b: b0 - (cb ? crossHw(axis, n + 1) : 0),               // the asphalt between the node boxes
    a2: a0 + (ca ? crossHw(axis, n) + 2.6 : 0), b2: b0 - (cb ? crossHw(axis, n + 1) + 2.6 : 0) };   // … and between the crossings
}
// the manholes of a segment and of a node (painted here; steamed at night): [{ x, z, steam }]
function manholesOf(s) {
  const r = rng(seedOf(s.axis === 'x' ? 11 : 13, s.L, s.n)), out = [], n = (r() < .8 ? 1 : 0) + (r() < .3 ? 1 : 0), len = s.b2 - s.a2;
  if (len < 6) return out;
  const steamRate = STEAM[s.dist] || 0;
  for (let k = 0; k < n; k++) { const lane = s.lanes.travel[Math.floor(r() * s.lanes.travel.length)], v = s.a2 + 2 + r() * (len - 4), st = r() < steamRate;
    if (out.some(m => Math.abs(m.v - v) < 6)) continue;
    out.push({ v, u: lane[0], x: s.axis === 'x' ? s.c + lane[0] : v, z: s.axis === 'x' ? v : s.c + lane[0], steam: st }); }
  return out;
}
function nodeManhole(Lx, Lz) {
  const r = rng(seedOf(17, Lx, Lz)); if (r() > .45) return null;
  const ns = segX(Lx, Lz - 1) || segX(Lx, Lz), ew = segZ(Lz, Lx - 1) || segZ(Lz, Lx); if (!ns || !ew) return null;
  const x = Lx * P + (r() - .5) * 2, z = Lz * P + (r() - .5) * 2, dist = distOf(kindAt(Lx - (r() < .5 ? 1 : 0), Lz - (r() < .5 ? 1 : 0)));
  return { x, z, steam: r() < (STEAM[dist] || 0) * 1.5 };
}

// the 8 × 8 manhole: rim, cast iron, a cross-hatch of dots (pixel art, one city voxel per pixel)
const MANHOLE = ['..rrrr..', '.riiiir.', 'ridiidir', 'riidiidr', 'ridiidir', 'riidiidr', '.riiiir.', '..rrrr..'];
const MCOL = { r: 'rim', i: 'iron', d: 'ironDot' };

// a painter for one canvas: marks are collected per layer and colour, then drawn with one fillStyle per colour (cheap: a fine tile
// takes a few thousand fillRects); `put` takes world metres snapped to the tile's pixel grid, `pix` pixels
function painter(T) {
  const R = T.R, W = T.W * R, H = T.D * R, layers = [new Map(), new Map(), new Map(), new Map(), new Map()], n = { rects: 0 };
  const X = x => Math.round((x - T.X0) * R), Z = z => Math.round((z - T.Z0) * R);
  function pix(L, c, a, b, w = 1, h = 1) { if (w < 1 || h < 1 || a >= W || b >= H || a + w <= 0 || b + h <= 0) return;
    let arr = layers[L].get(c); if (!arr) layers[L].set(c, arr = []); arr.push(a, b, w, h); }
  function put(L, c, x0, z0, x1, z1) { const a = X(Math.min(x0, x1)), b = Z(Math.min(z0, z1)); pix(L, c, a, b, Math.max(1, X(Math.max(x0, x1)) - a), Math.max(1, Z(Math.max(z0, z1)) - b)); }
  function flush(g, L) { for (const [c, arr] of layers[L]) { g.fillStyle = C[c]; for (let k = 0; k < arr.length; k += 4) g.fillRect(arr[k], arr[k + 1], arr[k + 2], arr[k + 3]); n.rects += arr.length / 4; } layers[L].clear(); }
  return { R, W, H, X, Z, pix, put, flush, n };
}
// a road-frame helper: (u across, v along) → world, for segment s
const frame = (D, s) => (L, c, u0, v0, u1, v1) => s.axis === 'x' ? D.put(L, c, s.c + u0, v0, s.c + u1, v1) : D.put(L, c, v0, s.c + u0, v1, s.c + u1);
// a wandering line of pixels (a sealant snake, a slab crack): `len` px along the unit pixel step (dx, dz), drifting a pixel sideways now
// and then; runs on one row or column are merged into one rect
function walk(D, L, c, x, z, dx, dz, len, r, drift = .25) {
  let px = x, pz = z, sx = x, sz = z, run = 0;
  const emit = () => { if (!run) return; D.pix(L, c, Math.min(sx, sx + dx * (run - 1)), Math.min(sz, sz + dz * (run - 1)), dx ? run : 1, dz ? run : 1); run = 0; };
  for (let k = 0; k < len; k++) {
    if (k && r() < drift) { emit(); const s = r() < .5 ? -1 : 1; if (dx) pz += s; else px += s; }
    if (!run) { sx = px; sz = pz; } run++; px += dx; pz += dz;
  }
  emit();
}
// a blob: two to four overlapping pixel rects round (x, z), sizes in pixels
function blob(D, L, c, x, z, size, r) { const k = 2 + Math.floor(r() * 3); for (let q = 0; q < k; q++) { const w = 1 + Math.floor(r() * size), h = 1 + Math.floor(r() * size); D.pix(L, c, x + Math.round((r() - .5) * size) - (w >> 1), z + Math.round((r() - .5) * size) - (h >> 1), w, h); } }

// ── the wear of one canvas. ground.js draw calls road() before the lane paint, the line and bar chips as it paints them, walks()
// after the block slabs and covers() last. Layers: 0 road wear (under the paint) · 1 sidewalks · 2 chips over paint · 3 covers
// ?wear=0 paints the plain ground of before (the A/B for review, and the paint-cost baseline)
export const WEAR_OFF = typeof location !== 'undefined' && /[?&]wear=0(&|$)/.test(location.search || '');
const NOWEAR = { road() {}, chipBar() {}, chipLine() {}, chips() {}, walks() {}, covers() {}, stats: { rects: 0 } };
export function createWear(T, detail) {
  if (WEAR_OFF) return NOWEAR;
  const D = painter(T), i0 = Math.floor(T.X0 / P), i1 = Math.floor((T.X0 + T.W - 1) / P), j0 = Math.floor(T.Z0 / P), j1 = Math.floor((T.Z0 + T.D - 1) / P);
  const segs = [];
  for (let L = i0; L <= i1 + 1; L++) for (let n = j0; n <= j1; n++) if (segX(L, n)) segs.push(segment('x', L, n));
  for (let L = j0; L <= j1 + 1; L++) for (let n = i0; n <= i1; n++) if (segZ(L, n)) segs.push(segment('z', L, n));

  function road(g) {
    for (const s of segs) { const F = frame(D, s), r = rng(seedOf(s.axis === 'x' ? 21 : 23, s.L, s.n)), gr = s.g;
      // tyre lanes: two darker wheel tracks per travel lane, in hand-cut lengths with a pixel of wobble (gaps where the street is clean)
      for (const [t] of s.lanes.travel) for (const side of [-1, 1]) { const tc = t + side * .75;
        if (!detail) { F(0, 'tyreA', tc - .25, s.a, tc + .25, s.b); continue; }
        for (let v = s.a; v < s.b;) { const l = 1.5 + r() * 3, w = (r() - .5) * .2, gap = r() < .3 * (1 - gr);
          if (!gap) F(0, r() < .3 + .5 * gr ? 'tyreB' : 'tyreA', tc - .25 + w, v, tc + .25 + w, Math.min(s.b, v + l)); v += l; } }
      if (!detail) continue;
      // oil where cars idle: drips between the wheel tracks in the last 12 m before the stop bar
      for (const [t, dir] of s.lanes.travel) { const stop = dir > 0 ? (s.cb ? s.b2 : null) : (s.ca ? s.a2 : null); if (stop === null) continue;
        const k = Math.round(2 + 9 * gr * r()); for (let q = 0; q < k; q++) { const d = Math.pow(r(), 1.6) * 12, v = stop - dir * (d + .3), u = t + (r() - .5) * .5;
          const p = s.axis === 'x' ? [D.X(s.c + u), D.Z(v)] : [D.X(v), D.Z(s.c + u)]; blob(D, 0, r() < .7 ? 'oil' : 'oil2', p[0], p[1], 3, r); } }
      // oil in the parking lanes, a car length apart
      for (const u of s.lanes.park) for (let v = s.a2 + 1; v < s.b2 - 2; v += 5.5) { if (r() > .1 + .45 * gr) continue;
        const vv = v + r() * 3.5, uu = u + (r() - .5) * .6, p = s.axis === 'x' ? [D.X(s.c + uu), D.Z(vv)] : [D.X(vv), D.Z(s.c + uu)];
        blob(D, 0, gr > .6 && r() < .5 ? 'oil2' : 'oil', p[0], p[1], 4 + Math.floor(gr * 3), r); }
      // gutter grime along both kerbs where the street is grimy
      if (gr > .45) for (const side of [-1, 1]) for (let v = s.a; v < s.b;) { const l = 1 + r() * 5; if (r() < (gr - .4) * 1.3) F(0, 'gutter', side * (s.hw - .3), v, side * s.hw, Math.min(s.b, v + l)); v += l + r() * 4; }
      // patches: utility cuts, long trench strips, small squares; fresh ones darker (half of them with a sealed seam), old ones paler
      const len = s.b2 - s.a2, np = Math.floor((.35 + 2.4 * gr) * len / 26 + r());
      for (let q = 0; q < np && len > 3; q++) { const kind = r(), fresh = r() < .55 - .2 * gr; let du, dv;
        if (kind < .45) { du = 1.2 + r() * 1.8; dv = .8 + r() * 1.4; } else if (kind < .75) { du = .6 + r() * .4; dv = Math.min(len - 1, 4 + r() * 6); } else { du = dv = .6 + r() * .6; }
        const u0 = -s.hw + .2 + r() * Math.max(0, 2 * s.hw - .4 - du), v0 = s.a2 + r() * Math.max(0, len - dv);
        if (fresh && r() < .5) F(0, 'seam', u0 - .1, v0 - .1, u0 + du + .1, v0 + dv + .1);
        F(0, fresh ? 'patchNew' : 'patchOld', u0, v0, u0 + du, v0 + dv); }
      // tar snakes: sealed cracks wandering across or along the road
      const ns = Math.floor((.25 + 3 * gr) * len / 26 + r());
      for (let q = 0; q < ns && len > 3; q++) { const across = r() < .55, u = -s.hw + .3 + r() * (2 * s.hw - .6), v = s.a2 + r() * len, l = Math.round((across ? Math.min(2 * s.hw - .4, 1.2 + r() * 4) : 1.5 + r() * 5) * D.R);
        let p = s.axis === 'x' ? [D.X(s.c + u), D.Z(v)] : [D.X(v), D.Z(s.c + u)], st;
        if (across) { const sg = u > 0 ? -1 : 1; st = s.axis === 'x' ? [sg, 0] : [0, sg]; } else { const sg = r() < .5 ? -1 : 1; st = s.axis === 'x' ? [0, sg] : [sg, 0]; }
        walk(D, 0, 'sealant', p[0], p[1], st[0], st[1], l, r, .22); }
    }
    // the node boxes: now and then an old patch or a sealed crack where the traffic turns
    if (detail) for (let Lx = i0; Lx <= i1 + 1; Lx++) for (let Lz = j0; Lz <= j1 + 1; Lz++) {
      const ns = segX(Lx, Lz - 1) || segX(Lx, Lz), ew = segZ(Lz, Lx - 1) || segZ(Lz, Lx); if (!ns || !ew) continue;
      const r = rng(seedOf(29, Lx, Lz)), gr = (grimeOf(Lx - 1, Lz - 1) + grimeOf(Lx, Lz)) / 2, hx = hwX(Lx), hz = hwZ(Lz), x = Lx * P, z = Lz * P;
      if (r() < .15 + .5 * gr) { const w = 1.5 + r() * 2.5, d = 1.5 + r() * 2.5, x0 = x - hx + r() * Math.max(0, 2 * hx - w), z0 = z - hz + r() * Math.max(0, 2 * hz - d); D.put(0, r() < .5 ? 'patchOld' : 'patchNew', x0, z0, x0 + w, z0 + d); }
      if (r() < .2 + .6 * gr) { const ax = r() < .5; walk(D, 0, 'sealant', D.X(x + (r() - .5) * hx), D.Z(z + (r() - .5) * hz), ax ? 1 : 0, ax ? 0 : 1, Math.round((1.5 + r() * 3) * D.R), r, .25); }
    }
    D.flush(g, 0);
  }
  // the wheel tracks crossing a bar (for the wear that follows them): the lanes of the road the crossing spans
  const tracksOf = (axis, L) => { const hw = axis === 'x' ? hwX(L) : hwZ(L), out = []; for (const [t] of lanesOf(axis, L, hw).travel) out.push(t - .75, t + .75); return out; };
  // a zebra bar or stop bar over road (axis, L) at line c, spanning u0…u1 across and v0…v1 along: nibbled edges, worn through in the tracks
  function chipBar(axis, L, x0, z0, x1, z1) {
    if (!detail) return; const c = L * P, r = rng(seedOf(31, Math.round(x0 * 10), Math.round(z0 * 10))), gr = grimeOf(Math.floor(x0 / P), Math.floor(z0 / P));
    const a = D.X(x0), b = D.Z(z0), w = Math.max(1, D.X(x1) - a), h = Math.max(1, D.Z(z1) - b);
    const k = Math.round(r() * (.6 + 2.6 * gr)); for (let q = 0; q < k; q++) { const e = r(), long = w < h ? (e < .4 ? 'x0' : e < .8 ? 'x1' : e < .9 ? 'z0' : 'z1') : (e < .4 ? 'z0' : e < .8 ? 'z1' : e < .9 ? 'x0' : 'x1');
      const d = 1, l = 1 + Math.floor(r() * 2);
      if (long === 'x0') D.pix(2, 'asphalt', a, b + Math.floor(r() * h), d, l); else if (long === 'x1') D.pix(2, 'asphalt', a + w - d, b + Math.floor(r() * h), d, l);
      else if (long === 'z0') D.pix(2, 'asphalt', a + Math.floor(r() * w), b, l, d); else D.pix(2, 'asphalt', a + Math.floor(r() * w), b + h - d, l, d); }
    for (const t of tracksOf(axis, L)) { const lo = c + t - .2, hi = c + t + .2;   // the track, in world x (axis 'x') or z (axis 'z')
      const [p0, p1] = axis === 'x' ? [Math.max(lo, x0), Math.min(hi, x1)] : [Math.max(lo, z0), Math.min(hi, z1)]; if (p1 <= p0) continue;
      const A = axis === 'x' ? D.X(p0) : D.Z(p0), B = Math.max(A + 1, axis === 'x' ? D.X(p1) : D.Z(p1)), m = Math.round(r() * (1 + 3.5 * gr));
      for (let q = 0; q < m; q++) { const s = 1, along = axis === 'x' ? b + Math.floor(r() * h) : a + Math.floor(r() * w), across = A + Math.floor(r() * (B - A));
        if (axis === 'x') D.pix(2, 'tyreA', across, along, s, 1 + Math.floor(r() * 2)); else D.pix(2, 'tyreA', along, across, 1 + Math.floor(r() * 2), s); } }
  }
  // a piece of lane line (0.5 m): a nibble now and then
  function chipLine(x0, z0, x1, z1) {
    if (!detail) return; const r = rng(seedOf(37, Math.round(x0 * 10), Math.round(z0 * 10))), gr = grimeOf(Math.floor(x0 / P), Math.floor(z0 / P)); if (r() > .06 + .22 * gr) return;
    const a = D.X(x0), b = D.Z(z0), w = Math.max(1, D.X(x1) - a), h = Math.max(1, D.Z(z1) - b);
    if (w < h) D.pix(2, 'asphalt', a + (r() < .5 ? 0 : w - 1), b + Math.floor(r() * h), 1, 1 + Math.floor(r() * 3)); else D.pix(2, 'asphalt', a + Math.floor(r() * w), b + (r() < .5 ? 0 : h - 1), 1 + Math.floor(r() * 3), 1);
  }
  function chips(g) { D.flush(g, 2); }

  // sidewalks: per block and street side, slabs replaced, cracked or corner-broken, gum, stains, kerb chips and scuffs
  function walks(g, slabOf) {
    if (!detail) return;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = kindAt(i, j); if (!urban(k)) continue;
      const s = slabOf(i, j), gr = grimeOf(i, j), comm = COMMERCIAL.has(k) ? 1 : .4, r = rng(seedOf(41, i, j));
      const has = { N: segZ(j, i), S: segZ(j + 1, i), W: segX(i, j), E: segX(i + 1, j) };
      for (const side of ['N', 'S', 'W', 'E']) { if (!has[side]) continue;
        const alongX = side === 'N' || side === 'S', a0 = alongX ? s.x0 : s.z0, a1 = alongX ? s.x1 : s.z1, kerb = side === 'N' ? s.z0 : side === 'S' ? s.z1 : side === 'W' ? s.x0 : s.x1, inward = side === 'N' || side === 'W' ? 1 : -1;
        // pixel helpers in the side's frame: along (world) a, across (metres from the kerb) d
        const P0 = (a, d) => alongX ? [D.X(a), D.Z(kerb + inward * d)] : [D.X(kerb + inward * d), D.Z(a)];
        const rectAD = (L, c, aA, aB, dA, dB) => alongX ? D.put(L, c, aA, kerb + inward * dA, aB, kerb + inward * dB) : D.put(L, c, kerb + inward * dA, aA, kerb + inward * dB, aB);
        const lo = (has[alongX ? 'W' : 'N'] ? a0 + 2 : a0), hi = (has[alongX ? 'E' : 'S'] ? a1 - 2 : a1);
        // slabs between the joints (ground.js: every 1.5 m from the slab's corner, 1 px)
        for (let q = 1; a0 + 1.5 * (q + 1) <= a1; q++) { const sa = a0 + 1.5 * q, sb = sa + 1.5; if (sa < lo - .01 || sb > hi + .01) continue; const u = r();
          const pa = alongX ? D.X(sa) + 1 : D.Z(sa) + 1, pb = alongX ? D.X(sb) : D.Z(sb), k0 = P0(sa, .2)[alongX ? 1 : 0], k1 = P0(sa, 2)[alongX ? 1 : 0];
          const c0 = Math.min(k0, k1), c1 = Math.max(k0, k1), fill = (c, A0, A1, B0, B1) => alongX ? D.pix(1, c, A0, B0, A1 - A0, B1 - B0) : D.pix(1, c, B0, A0, B1 - B0, A1 - A0);
          if (u < .045 + .04 * gr) fill(r() < .55 ? 'slabNew' : 'slabOld', pa, pb, c0, c1);
          else if (u < .07 + .12 * gr) { const sx = r() < .5, st = sx ? 1 : -1, len = c1 - c0, start = pa + Math.floor(r() * (pb - pa)), dv = r() < .5 ? 1 : -1;   // a crack across the slab
            const rr = rng(seedOf(43, i * 97 + q, j * 13 + side.charCodeAt(0))); let x = start, y = inward > 0 ? c0 : c1 - 1;
            for (let t = 0; t < len; t++) { if (x >= pa && x < pb) alongX ? D.pix(3, 'crack', x, y, 1, 1) : D.pix(3, 'crack', y, x, 1, 1); y += inward > 0 ? 1 : -1; if (rr() < .55) x += dv * st; } }
          else if (u < .09 + .07 * gr) { const n = 3 + Math.floor(r() * 4), atA = r() < .5, nearKerb = r() < .6;   // a broken corner
            for (let t = 0; t < n; t++) { const A = atA ? pa : pb - (n - t), w = n - t, B = nearKerb ? (inward > 0 ? c0 + t : c1 - 1 - t) : (inward > 0 ? c1 - 1 - t : c0 + t); fill('corner', A, A + w, B, B + 1); } } }
        // gum: single voxels, a few doubled, more where the shops are
        const ng = Math.round((a1 - a0) * (.25 + 2.2 * gr) * comm * (.7 + .6 * r()));
        for (let q = 0; q < ng; q++) { const a = a0 + r() * (a1 - a0), d = .35 + Math.pow(r(), .8) * 1.55, [px, pz] = P0(a, d), u = r(), c = u < .6 ? 'gum1' : u < .9 ? 'gum2' : 'gum3';
          D.pix(1, c, px, pz, 1, 1); if (r() < .15) D.pix(1, c, px + (alongX ? 1 : 0), pz + (alongX ? 0 : 1), 1, 1); }
        // stains: soft blobs a shade darker
        const nst = Math.floor(r() * (.6 + 2.4 * gr) * comm + .3); for (let q = 0; q < nst; q++) { const [px, pz] = P0(a0 + r() * (a1 - a0), .5 + r() * 1.2); blob(D, 1, gr > .6 && r() < .4 ? 'stain2' : 'stain', px, pz, 4 + Math.floor(r() * 5), r); }
        // the kerb: chips off its edge and tyre scuffs, more near the corners where cars cut in
        const nk = Math.round((a1 - a0) * (.06 + .3 * gr) * (.5 + r())); for (let q = 0; q < nk; q++) { const a = a0 + r() * (a1 - a0), [px, pz] = P0(a, 0), l = 1 + Math.floor(r() * 2);
          const pzz = inward > 0 ? pz : pz - 1, pxx = inward > 0 ? px : px - 1; alongX ? D.pix(1, 'kerbChip', px, pzz, l, 1) : D.pix(1, 'kerbChip', pxx, pz, 1, l); }
        const nsc = Math.floor(r() * (.5 + 2 * gr) + .2); for (let q = 0; q < nsc; q++) { const nearC = r() < .6, a = nearC ? (r() < .5 ? a0 + 2 + r() * 3 : a1 - 2 - r() * 3) : a0 + r() * (a1 - a0), l = .4 + r() * 1.2;
          rectAD(1, 'kerbScuff', a, a + l, 0, .1); } } }
    D.flush(g, 1); D.flush(g, 3);
  }

  // covers over everything: manholes, utility plates, kerb drains by the crossings
  function covers(g) {
    if (!detail) return;
    const stampM = (x, z) => { const a = D.X(x) - 4, b = D.Z(z) - 4; MANHOLE.forEach((row, y) => { let s = 0; for (let k = 1; k <= 8; k++) if (k === 8 || row[k] !== row[s]) { if (row[s] !== '.') D.pix(4, MCOL[row[s]], a + s, b + y, k - s, 1); s = k; } }); };
    for (const s of segs) { for (const m of manholesOf(s)) stampM(m.x, m.z);
      const r = rng(seedOf(47, s.axis === 'x' ? s.L : -s.L - 99, s.n)), len = s.b2 - s.a2, F = frame(D, s);
      const np = (r() < .35 + .3 * s.g ? 1 : 0) + (r() < .15 ? 1 : 0);   // steel plates and small valve covers
      for (let q = 0; q < np && len > 4; q++) { const big = r() < .5, du = big ? .6 : .3, dv = big ? (r() < .5 ? .6 : 1) : .3, u = -s.hw + .4 + r() * (2 * s.hw - .8 - du), v = s.a2 + 1 + r() * (len - 2 - dv);
        F(4, 'plateEdge', u - .1, v - .1, u + du + .1, v + dv + .1); F(4, big ? 'plate' : 'iron', u, v, u + du, v + dv); }
      for (const [end, has] of [[-1, s.ca], [1, s.cb]]) { if (!has) continue; for (const side of [-1, 1]) { if (r() > .45) continue;   // kerb drains just before the crossing
        const v = end < 0 ? s.a2 + .3 : s.b2 - 1.2, u0 = side * s.hw - (side > 0 ? .4 : 0); F(4, 'grate', u0, v, u0 + .4, v + .9);
        for (let q = 0; q < 4; q++) F(4, 'grateBar', u0 + .05, v + .1 + q * .2, u0 + .35, v + .15 + q * .2); } } }
    for (let Lx = i0; Lx <= i1 + 1; Lx++) for (let Lz = j0; Lz <= j1 + 1; Lz++) { const m = nodeManhole(Lx, Lz); if (m) stampM(m.x, m.z); }
    D.flush(g, 4);
  }
  return { road, chipBar, chipLine, chips, walks, covers, stats: D.n };
}

// ── NIGHT STEAM: pale voxel puffs billowing out of a few manholes near the camera (STEAM: a few per district), lit by the street lamps.
// One InstancedMesh (≤ 8 vents × 9 puffs), its matrices moved on the CPU each frame (72 instances: microseconds); `focus` picks the
// steaming manholes nearest the camera's ground focus (ground.js update, every 15 frames).
export function steamVents(x, z, r) {
  const out = [], i0 = Math.floor((x - r) / P), i1 = Math.floor((x + r) / P), j0 = Math.floor((z - r) / P), j1 = Math.floor((z + r) / P);
  for (let L = i0; L <= i1 + 1; L++) for (let n = j0; n <= j1; n++) if (segX(L, n)) for (const m of manholesOf(segment('x', L, n))) if (m.steam) out.push(m);
  for (let L = j0; L <= j1 + 1; L++) for (let n = i0; n <= i1; n++) if (segZ(L, n)) for (const m of manholesOf(segment('z', L, n))) if (m.steam) out.push(m);
  for (let Lx = i0; Lx <= i1 + 1; Lx++) for (let Lz = j0; Lz <= j1 + 1; Lz++) { const m = nodeManhole(Lx, Lz); if (m?.steam) out.push(m); }
  return out.filter(m => Math.hypot(m.x - x, m.z - z) <= r).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
}
export function createSteam(scene) {
  const MAXV = 8, PUFFS = 9, LIFE = 3.4;
  const mat = new THREE.MeshStandardMaterial({ color: 0xe6e2da, emissive: 0x46444a, roughness: 1, transparent: true, opacity: .55, depthWrite: false });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, MAXV * PUFFS);
  mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false; mesh.renderOrder = 3; mesh.name = 'steam'; scene.add(mesh);
  let vents = [], at = null, last = -1; const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const pose = () => { const t = performance.now() / 1000; if (t === last) return; last = t; let n = 0;
    for (let v = 0; v < vents.length; v++) { const m = vents[v], seed = hash(Math.round(m.x * 10), Math.round(m.z * 10), 3), wind = seed * 6.28;
      for (let k = 0; k < PUFFS; k++) { const ph = ((t / LIFE + seed * 5 + k / PUFFS) % 1 + 1) % 1, swell = Math.sin(Math.PI * Math.min(1, ph * 1.1));
        const s = .12 + .62 * Math.pow(swell, .7) * (.75 + .5 * hash(k, v, 9)), drift = ph * ph * 1.1;
        p.set(m.x + Math.cos(wind) * drift + Math.sin(t * 1.7 + k * 2.1) * .06, .1 + ph * 2.8, m.z + Math.sin(wind) * drift + Math.cos(t * 1.3 + k) * .06);
        e.set(.3 * k, k * .9 + t * .25, .2 * k); q.setFromEuler(e); sc.setScalar(s); M.compose(p, q, sc); mesh.setMatrixAt(n++, M); } }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; };
  mesh.onBeforeRender = pose;
  return { mesh,
    focus(x, z) { if (at && Math.hypot(x - at[0], z - at[1]) < 6) return; at = [x, z]; vents = steamVents(x, z, 110).slice(0, MAXV); last = -1; pose(); },
    get vents() { return vents; } };
}
