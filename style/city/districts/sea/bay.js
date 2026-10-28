// THE BAY (sea) · the blocks with something to see (owner: the water-side agent, batch 5). Worker-safe. The bay's water is the ground's
// flat SEA (ground.js); this kit only builds the few blocks where something floats, breaks or sinks, and nothing else (no far tier, no
// job, for open water). Everything is placed where it clears the docks' piers and ships and the island's riprap:
//   (4,−11) a red nun, a green can (C1-7d: SECOND CHANCE, the passenger ferry, is live: second-chance.js, out here heading out by default)
//   (5,−10) MISS DEMEANOR pushing SCOW 9 (sand for the Yards) south-west toward the docks; the lit channel buoy
//   (5,−9)  the breakwater off the Yards: a rubble mound 30 m long, a green light on its east head, a red one on its west, gulls, surf
//   (6,−11) HARBOR UNIT 9, the police launch, running south down the island's west side, its wake curling; a keep-off buoy
//   (6,−12) the wreck off the north-west rocks: a trawler gone down by the stern, bow up, rust, gulls all over it (hero)
//   (9,−11) LITTLE ANGIE, a lobster boat off the island's east side, hauling; her floats; a keep-off buoy
import { C, CV, SIDE, TOD, REG, H, lit, shade, mix, air, wv, later, fin, stampA, stamp, gull, inBlock, person, logSign, put, keep, stampAAt, mrect, ISLAND_MAP } from '../jail/lib.js';   // (SPREAD: today's metres, mapped by jail/lib.js)
import { blockCtx } from '../../engine.js';
import { ferry, launch, tug, scow, lobster, skiff, buoy, navLight } from './boats.js';
import { P0 as PITCH, SPREAD } from '../../../../world/city.js';   // (SPREAD: today's pitch — the bay is today's metres, mapped into the spread world)
// SPREAD · a block's frame: the bay moves with its blocks, the three beside Iron Island with the island (the launch on its west side, the
// wreck on its rocks, LITTLE ANGIE and the keep-out buoys keep their distance to it)
const NEAR_ISLAND = new Set(['6,-11', '6,-12', '9,-11']), seaMap = ctx => { if (NEAR_ISLAND.has(ctx.i + ',' + ctx.j)) ctx.map = ISLAND_MAP; };

// ── the plan (world metres; heading a: the bow points to (sin a, cos a))
export const FERRY = { x: 140.0, z: -345.0, a: -2.70, L: 24, W: 8, draft: .8 };
export const LAUNCH = { x: 206.4, z: -333.4, a: .12, L: 11, W: 3.6, draft: .5 };
export const TUG = { x: 191.6, z: -297.4, a: -2.06, L: 12, W: 5, draft: .7 };
export const SCOW = { a: -2.06, L: 22, W: 8, draft: .8 };   // ahead of the tug on its heading
export const BREAK = [[163.5, -281.2], [171, -283.4], [180, -284.6], [189.5, -283.2]];   // the breakwater's crest line, west → east
export const WRECK = { x: 211.2, z: -368.6, a: .5 };
export const ANGIE = { x: 303.2, z: -332.6 };
export const BUOYS = [   // [kind, number, x, z]
  ['nun', '6', 139.6, -325.4], ['can', '5', 158.2, -347.0], ['light', '', 164.0, -316.4], ['keep', '', 213.4, -346.2], ['keep', '', 213.8, -379.8], ['keep', '', 296.2, -345.4], ['keep', '', 296.4, -321.2]];
export const dirOf = a => [Math.sin(a), Math.cos(a)];
const scowAt = () => { const [dx, dz] = dirOf(TUG.a), d = TUG.L / 2 + SCOW.L / 2 - .4; return [TUG.x + dx * d, TUG.z + dz * d]; };

// a wake behind a boat: the propeller wash straight back from the stern, the two Kelvin arms spreading at ~19°, broken with noise;
// a bow wave at the stem. One flat layer (y −0.1 … 0.1) in world metres: this block draws the parts over its own square (+ out)
function wake(ctx, b, len, o = {}) {
  const [hx, hz] = dirOf(b.a), sx = b.x - hx * b.L / 2, sz = b.z - hz * b.L / 2, R = len + 4, W = wv(ctx, [sx - R, sz - R, sx + R, sz + R], -.1, .1, { s: .2, out: o.out ?? 24 }); if (!W) return; const V = W.V; let any = false;
  for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const x = W.wx(i), z = W.wz(k), dx = x - sx, dz = z - sz, back = -(dx * hx + dz * hz), side = dx * hz - dz * hx, n = H(Math.floor(x * 2.2), Math.floor(z * 2.2), 7), bow = (dx - hx * b.L) * hx + (dz - hz * b.L) * hz;
    let c = null;
    if (back > -.2 && back < len) { const f = back / len, curl = o.curl ? o.curl * f * f : 0, s = side - curl;
      if (Math.abs(s) < b.W * .32 + back * .04 && n > .12 + f * .7) c = n > .5 ? C.foam : C.foam2;                                                        // the wash
      const arm = Math.abs(Math.abs(s) - (b.W * .5 + back * .34)); if (arm < .35 + f * .25 && n > .25 + f * .6) c = C.foam2;                                // the arms
    }
    const along = dx * hx + dz * hz; if (along > b.L * .55 && along < b.L * .62 + 1.2 && Math.abs(side) < b.W * .75 && Math.abs(side) > b.W * .25 && n > .3) c = C.foam;   // the bow wave
    if (c !== null && inBlockOr(ctx, x, z, o)) { V.set(i, 0, k, c); any = true; } }
  if (any) later(ctx, W);
}
const inBlockOr = (ctx, x, z, o) => inBlock(ctx, x, z) || !!o.anywhere;

// ── the breakwater (0.2 m): a rubble mound along its crest line, big blocks on top, the heads rounded; surf on its seaward (north) side
function breakwater(ctx) {
  const W = wv(ctx, [158, -292, 196, -276], -.5, 2.3, { s: .2, out: 6 }); if (!W) return; const V = W.V, T = new Float32Array(V.nx * V.nz).fill(-1);
  const dist = (x, z) => { let m = 1e9, tt = 0; for (let q = 0; q + 1 < BREAK.length; q++) { const [ax, az] = BREAK[q], [bx, bz] = BREAK[q + 1], vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))), d = Math.hypot(x - ax - vx * t, z - az - vz * t); if (d < m) { m = d; tt = q + t; } } return [m, tt]; };
  for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const x = W.wx(i), z = W.wz(k); if (!inBlock(ctx, x, z)) continue; const [d, t] = dist(x, z), a0 = Math.floor(x / 1.1), b0 = Math.floor(z / 1.1);
    let best = -1; for (let a = a0 - 1; a <= a0 + 1; a++) for (let b = b0 - 1; b <= b0 + 1; b++) { const cx = (a + .2 + H(a, b, 61) * .6) * 1.1, cz = (b + .2 + H(a, b, 62) * .6) * 1.1, [dc] = dist(cx, cz); if (dc > 2.6) continue;
      const r = .6 + H(a, b, 63) * .5, q = Math.hypot(x - cx, z - cz) / r; if (q >= 1) continue; const h = (1.9 - dc * .55) * (.75 + H(a, b, 64) * .4) * Math.sqrt(1 - q * q); if (h > best) best = h; }
    T[i + k * V.nx] = best; if (best < 0) continue; const top = Math.max(1, Math.min(V.ny, Math.round((best + .5) / .2))), base = C.rock[(H(a0, b0, 65) * C.rock.length) | 0];
    for (let y = 0; y < top; y++) { const wy = -.5 + (y + .5) * .2; V.set(i, y, k, wy < .12 ? C.wet : wy < .3 ? mix(base, C.wet, .45) : (y === top - 1 && H(i, k, 66) < .06) ? C.guano : base); } }
  const F = wv(ctx, [W.ux0, W.uz0, W.ux1, W.uz1], -.1, .1, { s: .2, out: 6 }); let foam = false;   // (SPREAD: W's own bounds, in today's metres)
  for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { if (T[i + k * V.nx] >= 0) continue; const x = W.wx(i), z = W.wz(k); if (!inBlock(ctx, x, z)) continue; let near = 9;
    for (const [di, dk, d] of [[3, 0, .6], [-3, 0, .6], [0, 3, .6], [0, -3, .6], [0, -6, 1.2], [6, 0, 1.2], [-6, 0, 1.2]]) { const a = i + di, b = k + dk; if (a >= 0 && b >= 0 && a < V.nx && b < V.nz && T[a + b * V.nx] >= 0) near = Math.min(near, d); }
    const n = H(Math.floor(x * 2.5), Math.floor(z * 2.5), 67), north = z < -283; if ((near <= .6 && n > (north ? .1 : .5)) || (near <= 1.2 && north && n > .55)) { F.V.set(i, 0, k, n > .55 ? C.foam : C.foam2); foam = true; } }
  later(ctx, W, { walk: true }); if (foam) later(ctx, F);
  ctx.J.rockT = { W, T };
  // the heads' lights, gulls on the crest
  const top = (x, z) => { const i = W.X(x), k = W.Z(z); let m = -1; for (let a = i - 2; a <= i + 2; a++) for (let b = k - 2; b <= k + 2; b++) if (a >= 0 && b >= 0 && a < V.nx && b < V.nz) m = Math.max(m, T[a + b * V.nx]); return m; };
  const flat = (x, z) => { const i = W.X(x), k = W.Z(z); let lo = 99, hi = -1; for (let a = i - 3; a <= i + 3; a++) for (let b = k - 3; b <= k + 3; b++) if (a >= 0 && b >= 0 && a < V.nx && b < V.nz) { const t = T[a + b * V.nx]; lo = Math.min(lo, t); hi = Math.max(hi, t); } return [lo, hi]; };
  // (the lights stand on concrete footings poured on the heads: a little volume of their own, so they never hang off a boulder)
  for (const [[x, z], col] of [[BREAK[BREAK.length - 1], 0x25b84c], [BREAK[0], 0xe8232a]]) { const hx = x + (col === 0x25b84c ? -1.2 : 1.2), hz = z; if (!inBlock(ctx, hx, hz)) continue; const [lo, hi] = flat(hx, hz), yTop = Math.max(.6, hi + .1);
    const Fo = wv(ctx, [hx - .6, hz - .6, hx + .6, hz + .6], -.3, yTop, { s: .2 }); if (Fo) { Fo.box(hx - .6, -.3, hz - .6, hx + .6, yTop, hz + .6, C.concL); later(ctx, Fo, { walk: true });
      for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const wx = W.wx(i), wz = W.wz(k); if (Math.abs(wx - hx) < .7 && Math.abs(wz - hz) < .7) for (let y = 0; y < V.ny; y++) V.set(i, y, k, -1); }
      put(ctx, navLight(col), hx, hz, { y: yTop, reach: .2 }); } }
  ctx.group('gulls');
  for (const [x, z] of [[172, -283.6], [177.6, -284.4]]) { const [lo, hi] = flat(x, z); if (hi - lo < .21 && hi > .4) put(ctx, gull(Math.round(x)), x, z, { y: -.5 + Math.round((hi + .5) / .2) * .2, rot: Math.round(x) & 3, reach: .6 }); }
}

// ── the wreck (0.2 m): a trawler gone down by the stern, the bow up at ~22°: hull stations lifted along its length, rust with the old teal
// paint in patches, the wheelhouse leaning with it, a boom snapped; only what is above the water shows. Gulls on it; surf round it
export function wreck(ctx) {
  ctx.group('wreck'); const { x, z, a } = WRECK, [hx, hz] = dirOf(a), L = 15, Wd = 4.6, pitch = .4, W = wv(ctx, [x - 10, z - 10, x + 10, z + 10], -.6, 7.6, { s: .2, out: 2 }); if (!W) return; const V = W.V;
  const rust = [0x8b4a24, 0x6e3e19, 0x9b5a2e, 0x7a4424], paint = 0x3f8f86;
  for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const dx = W.wx(i) - x, dz = W.wz(k) - z, u = dx * hx + dz * hz, v = dx * hz - dz * hx; if (u < -L / 2 || u > L / 2) continue;
    const t = (u + L / 2) / L, half = (Wd / 2) * (t > .7 ? Math.max(.08, 1 - Math.pow((t - .7) / .3, 1.5) * .92) : 1); if (Math.abs(v) > half) continue;
    const keel = (u + L / 2) * Math.tan(pitch) - 2.6, sheer = keel + 2.2 + (t > .75 ? (t - .75) * 2 : 0), edge = Math.abs(v) > half - .3;
    for (let j = 0; j < V.ny; j++) { const y = W.wy(j); if (y < -.5 || y < keel || y > sheer) continue; if (!edge && y < sheer - .25 && y > keel + .3) continue;   // hollow: the shell and the deck
      const n = H(i >> 3, j >> 2, k >> 3), n2 = H(i >> 1, j, k >> 1, 7); V.set(i, j, k, y < .15 ? C.wet : y > sheer - .25 && !edge ? 0x5a4a3c : (n > .62 && n2 > .2) ? paint : rust[(n2 * 4) | 0]); } }
  // the wheelhouse, leaning with the hull, a snapped boom
  for (let s = 0; s < 18; s++) { const u = -.6 + s * .12, base = (u + L / 2) * Math.tan(pitch) - 2.6 + 2.2; for (let h = 0; h < 14; h++) for (let w = -6; w <= 6; w++) { const px_ = x + hx * (u - h * .2 * Math.sin(pitch)) + hz * w * .2, pz = z + hz * (u - h * .2 * Math.sin(pitch)) - hx * w * .2, py = base + h * .2 * Math.cos(pitch);
    if (py < .1) continue; const edge = Math.abs(w) === 6 || h === 13 || s === 0 || s === 17; if (!edge) continue; const win = h > 7 && h < 11 && Math.abs(w) < 5 && (s % 5 !== 0); W.set(px_, py, pz, win ? 0x1d2a3a : h === 13 ? 0x6e3e19 : 0xb8b0a0); } }
  for (let s = 0; s < 16; s++) { const u = 3.4, py = (u + L / 2) * Math.tan(pitch) - 2.6 + 2.2 + s * .2; W.set(x + hx * (u + s * .03), py, z + hz * (u + s * .03), C.steelD); }   // the mast, snapped short
  later(ctx, W); keep(ctx, [x - 7, -.6, z - 7, x + 7, 7, z + 7], 'wreck');
  // surf round it where the hull meets the water
  const F = wv(ctx, [x - 10, z - 10, x + 10, z + 10], -.1, .1, { s: .2, out: 2 }); let any = false;
  for (let k = 0; k < F.V.nz; k++) for (let i = 0; i < F.V.nx; i++) { const dx = F.wx(i) - x, dz = F.wz(k) - z, u = dx * hx + dz * hz, v = dx * hz - dz * hx, t = (u + L / 2) / L, half = (Wd / 2) * (t > .7 ? Math.max(.08, 1 - Math.pow((t - .7) / .3, 1.5) * .92) : 1);
    const keelY = (u + L / 2) * Math.tan(pitch) - 2.6, inside = u > -L / 2 - .2 && u < L / 2 + .2 && Math.abs(v) <= half + .2; if (inside && keelY < .1 && keelY + 2.2 + (t > .75 ? (t - .75) * 2 : 0) > -.1) continue;
    const d = Math.max(Math.abs(v) - half, Math.abs(u) - L / 2, 0), n = H(Math.floor(F.wx(i) * 2.4), Math.floor(F.wz(k) * 2.4), 71);
    if (u > -L / 2 - 1 && u < 1.2 && d < 1.2 && n > .3) { F.V.set(i, 0, k, n > .6 ? C.foam : C.foam2); any = true; } }
  if (any) later(ctx, F);
  // gulls: perched along the deck edge, two in the air over it (no support needed in flight)
  for (let q = 0; q < 3; q++) { const u = 1.2 + q * 1.7, v = (q % 2 ? 1 : -1) * (Wd / 2 * (1 - q * .12) - .15), gx = x + hx * u + hz * v, gz = z + hz * u - hx * v, gy = (u + L / 2) * Math.tan(pitch) - 2.6 + 2.2 + .05;
    const G = wv(ctx, [gx - .3, gz - .3, gx + .3, gz + .3], gy - .05, gy + .5, { s: CV, out: 2 }); if (!G) continue; G.box(gx - .1, gy - .05, gz - .2, gx + .1, gy + .25, gz + .2, 0xf5f6f4); G.box(gx - .1, gy + .15, gz - .2, gx + .1, gy + .25, gz + .1, 0xb4bcc6); G.box(gx - .05, gy + .25, gz + .1, gx + .05, gy + .4, gz + .2, 0xf5f6f4); later(ctx, G); }
  for (let q = 0; q < 2; q++) stampAAt(ctx, gull(q + 3, true), q * 2.1 + .4, x + (q ? 3 : -2.4), 6.2 + q * 1.7, z + (q ? -2 : 1.6));
  logSign(ctx, 'WRECK', x, z, 0);
}

// ── the block builders
// a hero module's entry (heroes/sea-*.js): the engine's guarded context, strict placement, the bay's shared parts and the hero's own
export function seaHero(bank, b, A, kit, content) { const ctx = blockCtx(bank, b, A, kit); REG.strict = true; try { bayBlock(ctx, content); } finally { REG.strict = false; } }
export { wake };
export function bayBlock(ctx, hero = null) {
  ctx.J = {}; seaMap(ctx); const k = ctx.i + ',' + ctx.j, y = 0;
  const boat = (bk, b, extra = 0) => { const [dx, dz] = dirOf(b.a); stampAAt(ctx, bk, b.a, b.x + dx * extra, -b.draft, b.z + dz * extra); };
  ctx.group('bay');
  if (k === '5,-10') { const [sx, sz] = scowAt(); stampAAt(ctx, tug(), TUG.a, TUG.x, -TUG.draft, TUG.z); stampAAt(ctx, scow(), SCOW.a, sx, -SCOW.draft, sz); wake(ctx, TUG, 14, { anywhere: true }); logSign(ctx, 'MISS DEMEANOR', TUG.x, TUG.z, 96); }
  if (k === '5,-9') { breakwater(ctx); ctx.group('skiff');   // two men fishing from a skiff in the breakwater's lee
    const at = put(ctx, skiff(), 168.6, -275.4, { y: -.3, rot: 1, reach: .4 });
    if (at) { person(ctx, at[0] - 1.2, .1, at[1] + .1, Math.PI, 'arms', 1301); person(ctx, at[0] + .65, -.2, at[1] - .05, -Math.PI / 2, 'sit', 1302, { seatY: .5 });
      const R = wv(ctx, [at[0] - 1.3, at[1] - 3.2, at[0] - .9, at[1] - .2], 0, 2.4, { s: CV }); if (R) { const x = at[0] - 1.1; for (let q = 0; q <= 40; q++) { const t = q / 40; R.set(x, 1.15 + t * 1.1, at[1] - .4 - t * 2.4, t < .15 ? C.ink : C.steelD); } for (let y = .02; y < 2.25; y += .1) R.set(x, y, at[1] - 2.82, 0xe6e6e6); later(ctx, R); }
      logSign(ctx, 'SKIFF', at[0], at[1], 0); } }
  if (k === '6,-11') { boat(launch(), LAUNCH); wake(ctx, LAUNCH, 20, { curl: -3, anywhere: true }); logSign(ctx, 'POLICE', LAUNCH.x, LAUNCH.z, 96); }
  if (k === '9,-11') { const at = put(ctx, lobster(), ANGIE.x, ANGIE.z, { y: -.5, rot: 2, reach: .4 }); if (at) { person(ctx, at[0] - .55, -.5 + 1.5, at[1] + .2, -Math.PI / 2, 'reach', 1201); logSign(ctx, 'LITTLE ANGIE', at[0], at[1], 96); }
    for (const [fx, fz, c] of [[297.4, -327.2, C.orange], [300.4, -323.8, 0xf7f7f2], [309.6, -339.4, C.orange]]) { const F = wv(ctx, [fx - .2, fz - .2, fx + .2, fz + .2], -.1, .3, { s: CV }); if (F) { F.box(fx - .2, -.1, fz - .2, fx + .2, .2, fz + .2, c); F.box(fx - .05, .2, fz - .05, fx + .05, .3, fz + .05, C.ink); later(ctx, F); } } }
  if (hero) hero(ctx);
  ctx.group('buoys'); for (const [kind, n, bx, bz] of BUOYS) if (inBlock(ctx, bx, bz)) put(ctx, buoy(kind, n), bx, bz, { y: -.3, reach: .4 });
  fin(ctx);
}

// ── the far tier: boats as chunky hulls along their heading, the breakwater's line, the wreck, the buoys (0.5 m)
export function bayFar(ctx) {
  seaMap(ctx); const N = TOD.night, x0 = ctx.i * PITCH, z0 = ctx.j * PITCH, k = ctx.i + ',' + ctx.j;
  const b = SPREAD ? (a0, y0, c0, a1, y1, c1, c, l) => { const r = mrect(ctx, [a0, c0, a1, c1]); ctx.box(r[0], y0, r[1], r[2], y1, r[3], c, l); } : ctx.box, g = SPREAD ? 6 : 0;   // (SPREAD: each box mapped; the hulls' scan runs past today's square, the far volume clips)
  const hullF = (bt, col, top, cab, cabCol) => { const [hx, hz] = dirOf(bt.a); for (let x = x0 - g; x < x0 + PITCH + g; x += .5) for (let z = z0 - g; z < z0 + PITCH + g; z += .5) { const dx = x + .25 - bt.x, dz = z + .25 - bt.z, u = dx * hx + dz * hz, v = dx * hz - dz * hx;
      if (Math.abs(u) > bt.L / 2 || Math.abs(v) > bt.W / 2 * (Math.abs(u) > bt.L * .35 ? .6 : 1)) continue; b(x, SIDE, z, x + .5, SIDE + top, z + .5, air(col, .15)); if (Math.abs(u) < bt.L * cab && Math.abs(v) < bt.W * .35) b(x, SIDE + top, z, x + .5, SIDE + top + 1.5, z + .5, N ? C.litLo : air(cabCol, .15), N ? 3 : 0); } };
  // (C1-7d: no SECOND CHANCE here: she is live, second-chance.js, so she can lie at the docks and sail)
  if (k === '5,-10') { hullF(TUG, C.navy, 1, .2, C.chalk); const [sx, sz] = scowAt(); hullF({ ...SCOW, x: sx, z: sz }, 0x9b4f3a, 1, .42, 0xc9b27e); }
  if (k === '5,-9') for (let q = 0; q + 1 < BREAK.length; q++) { const [ax, az] = BREAK[q], [bx, bz] = BREAK[q + 1]; for (let t = 0; t <= 1; t += .05) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; b(x - 1.5, SIDE, z - 1.5, x + 1.5, SIDE + 1, z + 1.5, air(C.rock[1], .15)); } }
  if (k === '6,-11') hullF(LAUNCH, C.chalk, 1, .2, C.navy);
  if (k === '6,-12') { const [hx, hz] = dirOf(WRECK.a); for (let u = -1; u < 7; u += .5) b(WRECK.x + hx * u - 1, SIDE, WRECK.z + hz * u - 1, WRECK.x + hx * u + 1, SIDE + .5 + u * .45, WRECK.z + hz * u + 1, air(0x8b4a24, .15)); }
  if (k === '9,-11') b(ANGIE.x - 1.5, SIDE, ANGIE.z - 4.5, ANGIE.x + 1.5, SIDE + 1.5, ANGIE.z + 4.5, air(C.chalk, .15));
  for (const [kind, , bx, bz] of BUOYS) if (inBlock(ctx, bx, bz)) b(bx - .25, SIDE, bz - .25, bx + .25, SIDE + 1, bz + .25, kind === 'nun' ? C.red : kind === 'can' ? C.greenD : kind === 'light' ? C.red : C.chalk, kind === 'light' && N ? 3 : 0);
}
