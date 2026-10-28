// REFIT · LOWER BODY (2026-09-30): bottoms, shoes and the lower accessories fitted to walk v2's closed segments.
// Installed once from world/chars.js (installLower({ BOTTOMS, SHOES, ACC })): every draw keeps its id and colourways; this pass wraps
// each one and re-cuts what it drew at the joints. Rules: world/fit/contract.js; routing and caps: world/fit/body.js.
//
// PANTS. Each BOTTOMS draw is recorded (the cells it wrote), then:
//   1 · the hands' clearance: nothing of the pants inside the hanging hands' boxes (x −8…−6 / 5…7, y 6…9, z −2…2). A free hand has
//       always been drawn over those cells; a held item's hand now lands in the hand's own segment instead of sharing the pants' cell.
//   2 · below the knee the whole leg rides the SHIN (y ≤ 5, hems and stacks included): the old rule sent the front and back columns
//       (z ≥ 3 / ≤ −3) and the hem (y < 3) to the foot, so the pant leg was torn at the knee (thigh → foot) and cut across at the ankle.
//       The shoe turns under the hem; nothing of the pants rides the foot.
//   3 · the knee and the hip are cut with CLEARANCE, never flush: the upper segment's lowest row keeps only its rim (the knee cap:
//       body.js kneeCap's ring, here the pant leg's own rim, flush), hollow inside; the row under that rim is set in by one (a groove).
//       So no cloth voxel of one segment touches the same garment on the other segment where either shows: when the joint turns the
//       rim swings over the groove and nothing of the leg's inside is uncovered (the shin's top rides inside the thigh's rim).
//       The hip does the same with the waistband: the belt row (pelvis) is a rim, the thigh's top row under it a groove (a top's hem,
//       drawn after, usually fills that groove).
//   SLABS (world/fit/body.js): the thigh no longer copies a top's hem or the belt (the hem → thigh slab), the shin and the foot no
//   longer copy the pants (the rim and the groove close the knee; the hem covers the ankle).
// SHOES ride the FOOT whole (sole, upper and collar: one rigid piece), so no shoe is cut at the ankle.
// ACC: the bandana lies on the seat under the right back pocket (the thigh: the seat is the thigh's top in walk v2), the ankle
// monitor sits on the right shin's outer face, both drawn against the surface they rest on.
import { onSeg, vkey } from './body.js';

const dec = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// run a draw and record the cells it wrote (and still holds): B.set is compose()'s tagging setter, B.del the grid's own
function record(B, draw, keep) {
  const P = new Set(), set0 = B.set, ownDel = Object.prototype.hasOwnProperty.call(B, 'del'), del0 = B.del;
  B.set = function (x, y, z, c, l) { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (keep && keep(x, y, z) && B.has(x, y, z)) return;
    set0.call(B, x, y, z, c, l); if (c !== undefined && c !== null) P.add(vkey(x, y, z)); };
  B.del = function (x, y, z) { del0.call(B, x, y, z); P.delete(vkey(x, y, z)); };
  try { draw(); } finally { B.set = set0; if (ownDel) B.del = del0; else delete B.del; }
  for (const k of [...P]) { const [x, y, z] = dec(k); if (!B.has(x, y, z)) P.delete(k); }
  return P;
}
const layerOf = (B, k) => B.L.findIndex(M => M.has(k));
const exposed = (B, x, y, z) => N6.some(d => !B.has(x + d[0], y + d[1], z + d[2]));
const kill = (B, P, k) => { const [x, y, z] = dec(k); B.del(x, y, z); P.delete(k); };

// the hanging hands (chars.js hands(), held2.js mitt()): the mitten boxes and the thumbs
const inHand = (x, y, z) => y >= 6 && y <= 9 && ((x >= -8 && x <= -6) || (x >= 5 && x <= 7)) && z >= -2 && z <= 2;
// the leg's core (chars.js base(): x −4…−2 / 1…3, z −1…1) at the rows a cut hollows (the knee's y 6, the hip's y 9 and the torso's
// y 10 over it): the pants never overwrite the body there, so the skin keeps the limb joined through the hollow (never the pants)
const core = (x, z) => ((x >= -4 && x <= -2) || (x >= 1 && x <= 3)) && z >= -1 && z <= 1;
const keepCore = (x, y, z) => (y === 6 || y === 9 || y === 10) && core(x, z);

// a joint cut with clearance between the upper segment's lowest row yU and the lower segment's top row yU − 1 (same garment):
// a cell pair that touches across the cut, where either cell shows, is resolved: under the rim the lower cell goes (the groove);
// inside the rim the upper cell goes (the hollow). Repeats until nothing touches.
function clearance(B, P, yU) {
  const yL = yU - 1, open = (x, z) => !B.has(x, yU, z), rim = new Set();   // the rim: the row's cells on its outside
  for (const k of P) { const [x, y, z] = dec(k); if (y === yU && (open(x - 1, z) || open(x + 1, z) || open(x, z - 1) || open(x, z + 1))) rim.add(k); }
  for (let it = 0; it < 32; it++) { let n = 0;
    for (const k of [...P]) { const [x, y, z] = dec(k); if (y !== yU || !P.has(k)) continue; const kl = vkey(x, yL, z); if (!P.has(kl)) continue;
      if (!exposed(B, x, yU, z) && !exposed(B, x, yL, z)) continue;
      if (rim.has(k)) kill(B, P, kl); else kill(B, P, k); n++; }
    if (!n) break; }
  return rim;
}

const regionOf = (x, y) => y >= 10 ? 'pelvis' : (y >= 6 ? 'thigh' : 'shin') + (x < 0 ? 'L' : 'R');
// pieces cut off by the clearances: every region keeps its largest piece; a smaller one joins the other leg's region if it touches it
// (a drawstring across the fly), else it goes
function tidy(B, P) {
  const by = new Map(), main = new Map(), rest = []; for (const k of P) { const [x, y] = dec(k), r = regionOf(x, y); (by.get(r) || by.set(r, new Set()).get(r)).add(k); }
  for (const [r, ks] of by) { const seen = new Set(), comps = [];
    for (const k of ks) { if (seen.has(k)) continue; const q = [k], cc = []; seen.add(k);
      while (q.length) { const a = q.pop(); cc.push(a); const [x, y, z] = dec(a); for (const d of N6) { const b = vkey(x + d[0], y + d[1], z + d[2]); if (ks.has(b) && !seen.has(b)) { seen.add(b); q.push(b); } } } comps.push(cc); }
    comps.sort((a, b) => b.length - a.length); main.set(r, new Set(comps[0])); for (const cc of comps.slice(1)) rest.push([r, cc]); }
  for (const [r, cc] of rest) { const other = r.replace(/L$/, '#').replace(/R$/, 'L').replace('#', 'R'); let join = false;
    if (other !== r) for (const k of cc) { const [x, y, z] = dec(k); for (const d of N6) if (main.get(other)?.has(vkey(x + d[0], y + d[1], z + d[2]))) join = true; }
    for (const k of cc) { if (join && B.fit) B.fit.force.set(k, other); else if (!join) kill(B, P, k); } }
}
// shoe cells the pants cut off from the shoe (a tongue tip over the hem): they ride the shin with the pants that hold them
function tidyShoes(B) { const f = B.fit; if (!f) return;
  for (const side of ['footL', 'footR']) { const ks = new Set(); for (const [k, r] of f.force) if (r === side) { const [x, y, z] = dec(k); if (B.has(x, y, z)) ks.add(k); }
    const seen = new Set(), comps = [];
    for (const k of ks) { if (seen.has(k)) continue; const q = [k], cc = []; seen.add(k);
      while (q.length) { const a = q.pop(); cc.push(a); const [x, y, z] = dec(a); for (const d of N6) { const b = vkey(x + d[0], y + d[1], z + d[2]); if (ks.has(b) && !seen.has(b)) { seen.add(b); q.push(b); } } } comps.push(cc); }
    comps.sort((a, b) => b.length - a.length);
    for (const cc of comps.slice(1)) for (const k of cc) { const [x, y, z] = dec(k); if (y >= 3) f.force.set(k, 'shin' + side.slice(-1)); else B.del(x, y, z); } } }

function refitPants(B, P) {
  const f = B.fit;
  for (const k of [...P]) { const [x, y, z] = dec(k); if (inHand(x, y, z) || (y >= 10 && (x < -5 || x > 4))) kill(B, P, k); }   // 1 · the hands' (and arms') clearance
  if (f) for (const k of P) { const [x, y] = dec(k); if (y <= 5) f.force.set(k, x < 0 ? 'shinL' : 'shinR'); }   // 2 · below the knee: the shin
  clearance(B, P, 6);    // 3 · the knee: the thigh's rim at y 6 over a groove at y 5
  clearance(B, P, 10);   //     the hip: the waistband's rim at y 10 over a groove at y 9
  tidy(B, P); tidyShoes(B);
}

// the bandana under the right back pocket: a corner hanging on the seat, laid against the back of whatever is there (rows y 8…5)
function bandana(B, p) { const C = p.c ?? 0xc0272d, rows = ['XXXX', 'XXX.', '.XX.', '.X..'], cells = [];
  rows.forEach((r, j) => { for (let i = 0; i < 4; i++) if (r[i] === 'X') cells.push([1 + i, 8 - j, (i + j) % 3 ? C : 0xf4f4f4]); });
  let zb = 99; for (const [x, y] of cells) for (let z = -12; z <= 12; z++) if (B.has(x, y, z)) { zb = Math.min(zb, z); break; }
  if (zb === 99) zb = -1; onSeg(B, 'thighR', () => { for (const [x, y, c] of cells) B.set(x, y, zb - 1, c); }); }
// the ankle monitor: the box (and its LED) against the right leg's outer face at the ankle (y 3…4), riding the segment of the cell it
// rests on (the shin, or the shoe's collar: the foot)
function monitor(B) { const K = 0x1d1d20, f = B.fit; let mx = -1, at = null;
  for (let y = 3; y <= 4; y++) for (let z = -1; z <= 1; z++) for (let x = 12; x >= 0; x--) if (B.has(x, y, z)) { if (x > mx) { mx = x; at = [x, y, z]; } break; }
  if (!at) { mx = 3; at = [3, 4, 0]; }
  const under = f && f.force.get(vkey(...at)), region = under === 'footR' ? 'footR' : 'shinR';
  onSeg(B, region, () => { B.box(mx + 1, 3, -1, mx + 3, 5, 2, K); B.set(mx + 2, 4, 0, 0x39e07a, 3); }); }

export function installLower({ BOTTOMS, SHOES, ACC }) {
  for (const id of Object.keys(BOTTOMS)) { const draw = BOTTOMS[id];
    BOTTOMS[id] = function (B, p, ...rest) { const P = record(B, () => draw.call(this, B, p, ...rest), keepCore); refitPants(B, P); }; }
  for (const id of Object.keys(SHOES)) { const draw = SHOES[id];
    SHOES[id] = function (B, p, ...rest) { const P = record(B, () => draw.call(this, B, p, ...rest)), f = B.fit;
      if (f) for (const k of P) f.force.set(k, dec(k)[0] < 0 ? 'footL' : 'footR'); }; }
  if (ACC.bandana) ACC.bandana = (B, p) => bandana(B, p);
  if (ACC.monitor) ACC.monitor = B => monitor(B);
}
