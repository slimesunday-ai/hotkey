// MAINLAND v1 · THE LAYOUT → plots.json (the page is generated from that file; this script only writes it).
//   node style/city/mainland/layout.mjs            (rewrites mainland/plots.json and prints the counts)
// World frame (same as candidate A): metres, +x east, +z SOUTH toward the water; the seawall is z = 0, the island ~400 m out.
// A street is a centreline polyline (asphalt half-width hw; curb, verge and walk make the right-of-way edge ROW = hw + 2.8) or a
// bulb (a round turnaround). A plot is an oriented rect: its front edge sits on the right-of-way line and faces the street.
//   rect = { x, z, w, d, rot }: x, z = the FRONT-centre point; w frontage, d depth; rot = yaw, so the lot's local +z (toward its
//   street) points along world (sin rot, cos rot) and the lot runs back over local z ∈ [−d, 0]. corners[] are the four world corners.
// To add a neighbourhood: add a street (and a bulb or loop) to STREETS, then call lotsAlong / pieLots for it below. Built plots carry
// a house style; everything else is 'available'. Overlapping or street-crossing plots are dropped (and reported) automatically.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), HW = 4, ROW = HW + 2.8, HX = 12;
const r2 = v => Math.round(v * 100) / 100, rad = d => d * Math.PI / 180;
const quad = (P0, P1, P2, n = 28) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n, a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t; return [a * P0[0] + b * P1[0] + c * P2[0], a * P0[1] + b * P1[1] + c * P2[1]]; });
const cubic = (P0, P1, P2, P3, n = 36) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3; return [a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0], a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1]]; });
const ellipse = (cx, cz, rx, rz, n = 56) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n * Math.PI * 2; return [cx + Math.cos(t) * rx, cz + Math.sin(t) * rz]; });

// ── THE STREETS (built: the two courts and Harbor Rd's lower end are dressed; the rest is fresh frontier asphalt)
const SUNNY = { stem: quad([HX, -96], [56, -96], [66, -110]), bulb: [76, -118] };
const WILLOW = { stem: cubic([HX, -72], [-12, -72], [-22, -104], [-44, -104]), loop: { c: [-64, -104], rx: 20, rz: 13 } };
const STREETS = [
  { id: 'harbor', name: 'HARBOR RD', pts: [[HX, -7.5], [HX, -312]], hw: HW, line: true, built: true },
  { id: 'bayview', name: 'BAYVIEW DR', pts: [[HX, -44], [236, -44]], hw: HW, built: false },
  { id: 'bayview-end', name: 'BAYVIEW DR', bulb: [246, -44], r: 13, island: 0, built: false },
  { id: 'sunny', name: 'SUNNY CT', pts: SUNNY.stem, hw: HW, built: true },
  { id: 'sunny-bulb', name: 'SUNNY CT', bulb: SUNNY.bulb, r: 13, island: 4.4, built: true },
  { id: 'willow', name: 'WILLOW BEND', pts: WILLOW.stem, hw: HW, built: true },
  { id: 'willow-loop', name: 'WILLOW BEND', pts: ellipse(WILLOW.loop.c[0], WILLOW.loop.c[1], WILLOW.loop.rx, WILLOW.loop.rz), hw: HW, loop: WILLOW.loop, built: true },
  { id: 'orchard', name: 'ORCHARD LN', pts: [[150, -44], [150, -190]], hw: HW, built: false },
  { id: 'juniper', name: 'JUNIPER WAY', pts: [[-148, -190], [206, -190]], hw: HW, built: false },
  { id: 'aster', name: 'ASTER CT', bulb: [-160, -190], r: 13, island: 4.4, built: false },
  { id: 'sycamore', name: 'SYCAMORE CT', bulb: [218, -190], r: 13, island: 4.4, built: false },
  { id: 'clover', name: 'CLOVER CT', pts: [[HX, -258], [70, -258]], hw: HW, built: false },
  { id: 'clover-bulb', name: 'CLOVER CT', bulb: [82, -258], r: 13, island: 4.4, built: false },
];

// ── geometry helpers
const segD = (px, pz, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
const streetD = (x, z, S) => S.bulb ? Math.hypot(x - S.bulb[0], z - S.bulb[1]) - (S.r - HW) : S.pts.reduce((d, p, k) => k ? Math.min(d, segD(x, z, S.pts[k - 1], p)) : d, 1e9);
const ROWof = S => ROW;   // every street shares the section (asphalt 8, curb, verge, walk)
const clearOf = (x, z) => Math.min(...STREETS.map(S => streetD(x, z, S) - ROWof(S)));
function polyAt(P, s) {   // point and unit tangent at arc length s along a polyline
  for (let k = 1; k < P.length; k++) { const [ax, az] = P[k - 1], [bx, bz] = P[k], L = Math.hypot(bx - ax, bz - az); if (s <= L || k === P.length - 1) { const t = Math.min(1, s / L); return [[ax + (bx - ax) * t, az + (bz - az) * t], [(bx - ax) / L, (bz - az) / L]]; } s -= L; }
}
const polyLen = P => P.reduce((s, p, k) => k ? s + Math.hypot(p[0] - P[k - 1][0], p[1] - P[k - 1][1]) : 0, 0);
const toWorld = (L, lx, lz) => { const c = Math.cos(L.rot), s = Math.sin(L.rot); return [L.x + lx * c + lz * s, L.z - lx * s + lz * c]; };
const cornersOf = L => L.wedge || [[-L.w / 2, 0], [L.w / 2, 0], [L.w / 2, -L.d], [-L.w / 2, -L.d]].map(([a, b]) => toWorld(L, a, b));

const PLOTS = [];
function plot(street, fx, fz, rot, w, d, o = {}) { PLOTS.push({ street, x: fx, z: fz, rot, w, d, ...o }); }
// lots along a polyline street: side +1 = the left of travel (tangent rotated +90°: (−tz, tx)… in x/z that is (tz·−1?) — see n below)
function lotsAlong(S, side, s0, s1, w, d, o = {}) {
  const n = Math.max(1, Math.round((s1 - s0) / w)), ww = (s1 - s0) / n, frontAt = s => { const [[px, pz], [tx, tz]] = polyAt(S.pts, s), nx = -tz * side, nz = tx * side; return [px + nx * ROW, pz + nz * ROW, nx, nz]; };
  for (let k = 0; k < n; k++) { const [fx, fz, nx, nz] = frontAt(s0 + (k + .5) * ww), rot = Math.atan2(-nx, -nz);                     // n points from the street into the lot
    const a = frontAt(s0 + k * ww + .15), b = frontAt(s0 + (k + 1) * ww - .15), wedge = [[a[0], a[1]], [b[0], b[1]], [b[0] + b[2] * d, b[1] + b[3] * d], [a[0] + a[2] * d, a[1] + a[3] * d]];
    plot(S.id, fx, fz, rot, Math.min(ww, o.maxW ?? 99), d, { ...(typeof o.meta === 'function' ? o.meta(k, n) : o.meta), wedge }); }
}
// pie lots round a bulb: phi in degrees (0 = +z / south, 90 = +x / east)
function pieLots(S, phis, w, d, o = {}) { const R = S.r + 2.8 + .2;
  phis.forEach((phi, k) => { const a = rad(phi), dx = Math.sin(a), dz = Math.cos(a), gap = Math.min(...phis.filter((_, j) => j !== k).map(q => Math.abs(((q - phi + 540) % 360) - 180)));
    const half = rad(Math.min(gap / 2 - 1.5, 34)), at = (r, t) => [S.bulb[0] + Math.sin(a + t) * r, S.bulb[1] + Math.cos(a + t) * r];
    const wf = 2 * R * Math.sin(half), wedge = [at(R, -half), at(R, half), at(R + d, half), at(R + d, -half)];
    plot(S.id, S.bulb[0] + dx * R, S.bulb[1] + dz * R, Math.atan2(-dx, -dz), Math.min(w, wf), d, { ...(typeof o.meta === 'function' ? o.meta(k, phis.length) : o.meta), wedge }); }); }
// lots round the outside of an elliptical loop, between two angles (degrees, 0 = +x/east, 90 = +z/south), facing the loop
function loopLots(S, angs, w, d, o = {}) { const { c, rx, rz } = S.loop;
  angs.forEach((t0, k) => { const t = rad(t0), px = c[0] + Math.cos(t) * rx, pz = c[1] + Math.sin(t) * rz; let nx = Math.cos(t) / rx, nz = Math.sin(t) / rz; const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
    plot(S.id, px + nx * ROW, pz + nz * ROW, Math.atan2(-nx, -nz), w, d, typeof o.meta === 'function' ? o.meta(k, angs.length) : o.meta); }); }
const S = id => STREETS.find(s => s.id === id);

// ── THE BUILT COURTS (house styles: A's six + B's two modernists; walls from the sherbet set; never two neighbours alike)
// SUNNY CT: the round bulb (a blossom tree on its island), oak and maple shade, mostly two-storey traditional
lotsAlong(S('sunny'), -1, 10, 50, 20, 20, { maxW: 17.5, meta: k => ({ style: ['porch', 'gambrel'][k], wall: ['sky', 'lilac'][k] }) });            // stem, north side
lotsAlong(S('sunny'), 1, 21, 41, 20, 18, { meta: { style: 'ranch', wall: 'mint' } });                                             // stem, south side (the pocket park takes the corner)
pieLots(S('sunny-bulb'), [8, 58, 106, 154, 200], 19, 24, { meta: k => ({ style: ['slab', 'springfield', 'trophy', 'cape', 'springfield'][k], wall: ['white', 'coral', 'white', 'butter', 'pink'][k], head: k === 2 }) });
lotsAlong(S('harbor'), 1, 44, 61, 17, 20, { meta: { style: 'cape', wall: 'lilac', row: true } });                                  // Harbor Rd's first house, between Bayview and Sunny
// WILLOW BEND: an S-bend into an oval loop round a village green (the big willow, a gazebo); birch and red maple; low and modern
lotsAlong(S('willow'), -1, 10, 52, 21, 22, { meta: k => ({ style: ['butterfly', 'cape'][k], wall: ['teal', 'sky'][k] }) });        // the bend's outer side (the green corner is on the inside)
loopLots(S('willow-loop'), [58, 99, 140, 180, 220, 261, 302], 17, 24, { meta: k => ({ style: ['ranch', 'slab', 'gambrel', 'porch', 'butterfly', 'springfield', 'ranch'][k], wall: ['coral', 'white', 'mint', 'butter', 'orange', 'lilac', 'pink'][k], head: k === 3 }) });

// ── THE FRONTIER (available plots; a few PRIME: waterfront, corners, the heads of cul-de-sacs)
lotsAlong(S('bayview'), 1, 12, 222, 17.5, 26, { meta: (k, n) => ({ prime: k === 0 || k % 4 === 3, why: k === 0 ? 'corner' : 'waterfront', waterfront: true }) });   // south side: backs onto the seawall walk
lotsAlong(S('bayview'), -1, 32, 130, 16.5, 20, {});                                   // north side, to Orchard Ln
lotsAlong(S('bayview'), -1, 146, 222, 17, 20, {});
pieLots(S('bayview-end'), [60, 110, 160, 200], 17, 22, { meta: k => ({ prime: true, why: k ? 'cul-de-sac head' : 'waterfront point', waterfront: k === 0 }) });
lotsAlong(S('orchard'), 1, 30, 118, 17.5, 18, {});                                                                                 // Orchard Ln, east side
lotsAlong(S('orchard'), -1, 30, 118, 17.5, 18, {});                                                                                // west side
lotsAlong(S('harbor'), -1, 108, 152, 17, 22, {});                                                                                   // Harbor Rd north, west side (left of travel north)
lotsAlong(S('harbor'), 1, 132, 152, 17, 22, {});                                                                                  // east side
lotsAlong(S('harbor'), -1, 213, 300, 17, 22, {});
lotsAlong(S('juniper'), 1, 24, 152, 17.5, 22, {});                                                                                 // Juniper Way west of Harbor, north side (x −136 … 4)
lotsAlong(S('juniper'), -1, 24, 152, 17.5, 22, {});
lotsAlong(S('juniper'), 1, 168, 292, 17.5, 22, {});                                                                                // east of Harbor to Orchard
lotsAlong(S('juniper'), -1, 168, 292, 17.5, 22, {});
lotsAlong(S('juniper'), 1, 306, 332, 17.5, 22, {});
lotsAlong(S('juniper'), -1, 306, 332, 17.5, 22, {});
pieLots(S('aster'), [135, 180, 225, 270, 315, 0, 45], 17, 22, { meta: k => ({ prime: k === 3, why: 'cul-de-sac head' }) });
pieLots(S('sycamore'), [315, 0, 45, 90, 135, 180, 225], 17, 22, { meta: k => ({ prime: k === 3, why: 'cul-de-sac head' }) });
lotsAlong(S('clover'), 1, 10, 50, 18, 22, {});
lotsAlong(S('clover'), -1, 10, 50, 18, 22, {});
pieLots(S('clover-bulb'), [30, 80, 130, 180], 17, 22, { meta: k => ({ prime: k === 1, why: 'cul-de-sac head' }) });

// ── validate: drop plots that cross a street's right-of-way or overlap an earlier plot (separating-axis test on the rects)
const obb = L => { const C = cornersOf(L), cx = C.reduce((a, p) => a + p[0], 0) / 4, cz = C.reduce((a, p) => a + p[1], 0) / 4; return C.map(([x, z]) => { const l = Math.hypot(x - cx, z - cz); return [x - (x - cx) / l * .5, z - (z - cz) / l * .5]; }); };
function overlap(A, B) { for (const P of [A, B]) for (let k = 0; k < 4; k++) { const [ax, az] = P[k], [bx, bz] = P[(k + 1) % 4], nx = -(bz - az), nz = bx - ax;
  const pa = A.map(([x, z]) => x * nx + z * nz), pb = B.map(([x, z]) => x * nx + z * nz); if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false; } return true; }
const kept = [], dropped = [];
for (const L of PLOTS) { const C = cornersOf(L), back = [C[2], C[3], toWorld(L, 0, -L.d / 2)], front = [C[0], C[1]];
  const bad = back.some(([x, z]) => clearOf(x, z) < -.2) || front.some(([x, z]) => clearOf(x, z) < -1.6) || Math.abs(L.x) > 300 || L.z < -330 || L.z > -8 || C.some(([x, z]) => z > -8.6);
  const O = obb(L), hit = kept.find(K => overlap(O, K.O)); if (bad || hit) { dropped.push({ ...L, why: bad ? 'street' : 'overlaps ' + hit.street + ' ' + r2(hit.x) + ',' + r2(hit.z) }); continue; } kept.push({ ...L, O }); }

// ── number the plots (evens on one side, odds on the other, by distance along their street) and write the file
const bySt = new Map(); for (const L of kept) { if (!bySt.has(L.street)) bySt.set(L.street, []); bySt.get(L.street).push(L); }
const nameOf = id => (STREETS.find(s => s.id === id) || {}).name;
for (const [id, arr] of bySt) { const st = STREETS.find(s => s.id === id);
  const key = L => st.bulb ? ((Math.atan2(L.x - st.bulb[0], L.z - st.bulb[1]) + 7) % (Math.PI * 2)) : st.loop ? ((Math.atan2(L.z - st.loop.c[1], L.x - st.loop.c[0]) + 7) % (Math.PI * 2)) : (() => { let best = 0, bd = 1e9, acc = 0; for (let k = 1; k < st.pts.length; k++) { const [ax, az] = st.pts[k - 1], [bx, bz] = st.pts[k], Ls = Math.hypot(bx - ax, bz - az), t = Math.max(0, Math.min(1, ((L.x - ax) * (bx - ax) + (L.z - az) * (bz - az)) / (Ls * Ls))), d = Math.hypot(L.x - ax - t * (bx - ax), L.z - az - t * (bz - az)); if (d < bd) { bd = d; best = acc + t * Ls; } acc += Ls; } return best; })();
  arr.sort((a, b) => key(a) - key(b)); const side = L => { if (st.bulb || st.loop) return 0; const [[px, pz], [tx, tz]] = polyAt(st.pts, key(L)); return ((L.x - px) * -tz + (L.z - pz) * tx) > 0 ? 1 : 0; };
  const cnt = [0, 0]; for (const L of arr) { const sd = side(L); L.no = st.bulb || st.loop ? 2 + 2 * cnt[0]++ + 1 : (sd ? 2 : 1) + 2 * cnt[sd]++; } }
const WALL = { coral: 0xff8a5c, butter: 0xffd23f, sky: 0x58b7f7, mint: 0x3fd0a0, lilac: 0xa57cff, pink: 0xff6fae, white: 0xf4f1ea, teal: 0x12b3a0, orange: 0xff7a1a };
const plots = kept.map((L, k) => { const C = cornersOf(L), cx = C.reduce((s, p) => s + p[0], 0) / 4, cz = C.reduce((s, p) => s + p[1], 0) / 4, built = !!L.style;
  return { id: 'ML-' + String(k + 1).padStart(3, '0'), address: { number: L.no, street: nameOf(L.street) }, street: L.street,
    rect: { x: r2(L.x), z: r2(L.z), w: r2(L.w), d: r2(L.d), rot: +L.rot.toFixed(4) }, center: [r2(cx), r2(cz)], corners: C.map(([x, z]) => [r2(x), r2(z)]),
    status: built ? 'built' : 'available', prime: !!L.prime, ...(L.prime ? { primeWhy: L.why } : {}), ...(L.waterfront ? { waterfront: true } : {}),
    ...(built ? { style: L.style, wall: L.wall, ...(L.head ? { head: true } : {}) } : {}) }; });
const streets = STREETS.map(s => ({ id: s.id, name: s.name, built: s.built, hw: s.hw ?? HW, ...(s.line ? { line: true } : {}), ...(s.bulb ? { bulb: s.bulb, r: s.r, island: s.island } : { pts: s.pts.map(([x, z]) => [r2(x), r2(z)]) }), ...(s.loop ? { loop: s.loop } : {}) }));
const out = { version: 1, generated: 'mainland/layout.mjs', frame: '+x east, +z south (toward the water), metres; seawall at z = 0', section: { hw: HW, curb: .3, verge: 1, walk: 1.5, row: ROW },
  walls: WALL, courts: { sunny: { name: 'SUNNY CT', bulb: SUNNY.bulb }, willow: { name: 'WILLOW BEND', loop: WILLOW.loop } }, streets, plots };
fs.writeFileSync(path.join(HERE, 'plots.json'), JSON.stringify(out, null, 1).replace(/\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]/g, '[$1, $2]'));
const n = plots.length, b = plots.filter(p => p.status === 'built').length, pr = plots.filter(p => p.prime).length;
console.log(`plots ${n} · built ${b} · available ${n - b} · prime ${pr} · dropped ${dropped.length}`);
for (const L of dropped) console.log('  dropped', L.street, r2(L.x), r2(L.z), L.style || '', L.why);
const per = {}; for (const p of plots) per[p.street] = (per[p.street] || 0) + 1; console.log(per);
