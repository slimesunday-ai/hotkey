// LOWER BODY · pants are a continuous voxel surface on an approved leg form (world/fit/leg-forms.js, collection-forms.js); shoes are
// independent rigid pieces in their own grid (world/fit/shoe.js). The common socket is y4 (20 cm): shoe sole y0, upper y2..3, the
// leg's cloth starts at y4. Knee and ankle flexibility come from anim/walk2.js over shared mesh vertices, never from deleting cloth or
// giving shoe cells to another bone.
import { vkey } from './body.js';
import { legForm, drawLegForm, drawSeat } from './leg-forms.js';

const dec = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
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

// the hanging hands (fit/held.js hands()): the mitten boxes and the thumbs
const inHand = (x, y, z) => y >= 6 && y <= 9 && ((x >= -8 && x <= -6) || (x >= 5 && x <= 7)) && z >= -2 && z <= 2;
// The ankle socket footprint also defines the inner core retained at the waistband.
// The knee no longer has a hollow or a clearance cut.
const core = (x, z) => ((x >= -4 && x <= -2) || (x >= 1 && x <= 3)) && z >= -1 && z <= 1;
const keepCore = (x, y, z) => (y === 9 || y === 10) && core(x, z);

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
// THE WAIST SEAM (2026-10-01; whatever the top, since the seat fix). The hip joint's clearance (clearance(B, P, 10)) cuts a rim at
// y 10 over a groove at y 9, and keepCore keeps the body's core there. A top whose hem comes down to y 9 fills that groove; with no top,
// or a short one ending at y 10 (the velour track top, the bubble goose), it showed the skin core through it: a strip of skin under the
// waistband, two tan crescents on top of the legs from behind. So everything the groove can show is ALWAYS painted the pant's colour
// one shade darker, a seam under the waistband: the kept core at y 9..10 (the thigh's swing opens the cut over it, mid-stride) and the
// cloth still standing in the groove at y 9 (the seat's top row included). Colours only, through the grid's own setter: no voxel is
// added or removed (the clearance stays, nothing clips when the thigh swings) and every cell keeps its tag and its segment. Under a
// hem that fills the groove it is never seen.
export const SEAM_SHADE = .8;
const darker = (c, f) => { const m = s => Math.round(((c >> s) & 255) * f); return (m(16) << 16) | (m(8) << 8) | m(0); };
function waistSeam(B, P, p) {
  const c = darker(p.c, SEAM_SHADE), paint = (x, y, z) => Object.getPrototypeOf(B).set.call(B, x, y, z, c, 0);   // (no compose tag: the cell stays whose it was)
  for (let x = -4; x <= 3; x++) for (const y of [9, 10]) for (let z = -1; z <= 1; z++) if (core(x, z) && B.has(x, y, z) && !P.has(vkey(x, y, z))) paint(x, y, z);
  for (const k of P) { const [x, y, z] = dec(k); if (y === 9 && exposed(B, x, y, z)) paint(x, y, z); }
}
// Authored forms use the same ownership and waist seam as legacy bottoms, while
// retaining their designed cross-sections and hem. The old silhouette adapter is
// deliberately bypassed; otherwise it would erase baggy hems and exposed legs.
// THE SEAT (world/fit/leg-forms.js drawSeat) goes on after the clearance and the tidy: its top row (y 9) lies in the groove under the
// waistband's inside, which therefore stays whole (cut there, the clearance's hollow would show the torso's skin through the crack the
// thigh's swing opens). Each half rides its own thigh, as the leg it grows from: the legs pitch about one shared hip axis, so the two
// halves slide past each other on the midline, and the walk shader (style/city/anim/walk2.js, THE SEAT'S MIDLINE) keeps them on one
// plane so they never cross (the lower-body motion check covers them as leg cloth). On the pelvis the seat would yaw and roll with the
// hips, which the thighs don't, and its sides would cut into them or part from them by up to a centimetre.
export function drawLowerForm(B, p, skin) {
  if (!p.formSpec && !legForm(p.form)) return false;
  const P = record(B, () => drawLegForm(B, p, skin), keepCore);
  if (B.fit) for (const k of P) { const [x, y] = dec(k); if (y < 10) B.fit.force.set(k, (y < 6 ? 'shin' : 'thigh') + (x < 0 ? 'L' : 'R')); }
  clearance(B, P, 10);
  tidy(B, P);
  for (const k of record(B, () => drawSeat(B, p))) { P.add(k); if (B.fit) B.fit.force.set(k, 'thigh' + (dec(k)[0] < 0 ? 'L' : 'R')); }
  waistSeam(B, P, p);
  return true;
}

