// Far tier (worker-safe): a whole block as 0.5 cubes, drawn straight from the spec pass (gen.planBlock) — no facade voxels are
// built, so every block on the island can have one in a few milliseconds. Same cube grammar, coarser grain: one flat colour per
// building, window rows as glass stripes, the shop band, the neutral roof with its coping, and each roof set piece as a blob.
import { Vol, Bank, meshVol } from './vox.js';
import { PAL, CV, SIDE, shade } from './style.js';
import { BILLBOARDS } from './lexicon.js';
import * as SP from './setpieces.js';
import * as RF from './roofs.js';
import { vigFar, vigTopY } from './heroes/vig-tower.js';
const S = .5;
const roofCol = s => RF.roofColor ? RF.roofColor(s) : 0xd9d5cc, copeCol = s => RF.copingColor ? RF.copingColor(s) : 0xeeebe4;
// aerial perspective: far walls and glass lean 30% toward the horizon colour, so the background sits back and the near set pieces lead
const air = (c, t = .3) => { const h = PAL.horizon, m = k => Math.round(((c >> k) & 255) * (1 - t) + ((h >> k) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };

// cleanup pass · the far fill keeps the neighbour rule (gen.js specify: neighbours never share colour, storeys, window style or cornice),
// so a row of lots never reads as one module repeated: each window style and cornice has its own pattern in 0.5 cubes. A pattern
// answers, for a facade cell a along the face and r rows into its floor (6 rows a floor) or k in the cornice (0 lower, 1 top):
// 'g' glass · 't' trim · 'x' accent · 'b' bay colour · 'i' iron · 0 wall
const FAR_WIN = { punched: (a, r) => r >= 2 && r <= 4 && a % 2 === 0 ? 'g' : 0, arched: (a, r) => a % 2 === 0 ? (r >= 2 && r <= 4 ? 'g' : r === 5 ? 't' : 0) : 0,
  tall: (a, r) => a % 2 === 0 ? (r >= 1 && r <= 4 ? 'g' : r === 5 ? 't' : 0) : 0, paired: (a, r) => r >= 2 && r <= 4 && a % 4 < 2 ? 'g' : 0,
  shutter: (a, r) => r >= 2 && r <= 4 ? (a % 3 === 1 ? 'g' : 'x') : 0, bay: (a, r) => a % 4 < 2 ? (r >= 2 && r <= 4 ? 'g' : 'b') : 0,
  balcony: (a, r) => r >= 2 && r <= 4 && a % 2 === 0 ? 'g' : r === 1 && a % 4 < 3 ? 'i' : 0, loft: (a, r) => r >= 1 && r <= 4 && a % 3 < 2 ? 'g' : 0,
  ribbon: (a, r) => r >= 2 && r <= 4 ? 'g' : 0, grid: (a, r) => a % 4 === 0 || r === 0 ? 't' : 'g' };
const FAR_CORN = { bracket: (a, k) => k === 1 || a % 2 === 0 ? 't' : 0, band: (a, k) => k === 1 ? 't' : 0, deco: (a, k) => k === 1 || a % 3 !== 1 ? 't' : 'x',
  crenel: (a, k) => k === 1 ? 't' : 0, pediment: () => 't', thin: (a, k) => k === 1 ? 't' : 0, sign: () => 'x' };
export function farFromPlan(b, lots) {
  const R = b.R, X0 = R.x0 - 1, Z0 = R.z0 - 1, W = Math.ceil((R.x1 - R.x0 + 2) / S), D = Math.ceil((R.z1 - R.z0 + 2) / S);
  let top = 8; for (const l of lots) if (l.spec) top = Math.max(top, l.spec.supertall === 'vig' ? vigTopY() : (l.spec.type === 'tower' ? 6.6 + (l.spec.st - 2) * 3 + 6 : (l.H || 0) * CV + 7));
  const V = new Vol(W, Math.ceil(top / S) + 2, D, { s: S, org: [X0, SIDE, Z0] }), cx = x => Math.round((x - X0) / S), cz = z => Math.round((z - Z0) / S), cy = y => Math.round((y - SIDE) / S);
  const boxW = (x0, y0, z0, x1, y1, z1, c) => V.box(cx(x0), cy(y0), cz(z0), Math.max(cx(x0) + 1, cx(x1)), Math.max(cy(y0) + 1, cy(y1)), Math.max(cz(z0) + 1, cz(z1)), c);
  for (const l of lots) { const s = l.spec; if (!s) continue;
    if (s.type === 'calm' && s.calm === 'site') continue;   // pass 2: a sim site's open yard (the ground's lot colour shows through)
    if (s.type === 'calm') { for (let k = 0; k < 2; k++) { const tx = l.x0 + l.w * (.3 + .4 * k), tz = l.z0 + l.d * (.35 + .3 * k); boxW(tx - .25, SIDE, tz - .25, tx + .25, SIDE + 2, tz + .25, 0x7a4a22); boxW(tx - 1.2, SIDE + 2, tz - 1.2, tx + 1.2, SIDE + 4, tz + 1.2, 0x2fbf55); } continue; }
    if (s.type === 'parking' || s.type === 'alley' || !l.H) continue;
    if (s.supertall === 'vig') { vigFar(V, cx, cy, cz, l, air); l.H = vigTopY() / CV; continue; }   // LOOK round: THE VIG's own far massing (heroes/vig-tower.js); l.H so jobs.js reports the block's real height (maxH)
    // footprint (stoop buildings step back from the street), height in cells
    let x0 = l.x0, x1 = l.x1, z0 = l.z0, z1 = l.z1; if (s.ground === 'stoop') { const m = l.main; if (m === '-z') z0 += 2.5; if (m === '+z') z1 -= 2.5; if (m === '-x') x0 += 2.5; if (m === '+x') x1 -= 2.5; }
    const X = cx(x0), XX = cx(x1), Z = cz(z0), ZZ = cz(z1), H = Math.max(2, Math.round(l.H * CV / S)), wall = air(s.wall), glassA = air(PAL.glassLo), glassB = air(PAL.glassHi), fl = 6;
    const win = FAR_WIN[s.win] || FAR_WIN.punched, corn = FAR_CORN[s.cornice] || FAR_CORN.band, trim = air(s.trim ?? PAL.cream), acc = air(s.accent ?? PAL.red), bay = air(s.bayCol ?? s.wall), iron = air(PAL.iron);
    const paint = (k, r) => k === 'g' ? (r >= 4 ? glassB : glassA) : k === 't' ? trim : k === 'x' ? acc : k === 'b' ? bay : k === 'i' ? iron : wall;   // (glass lighter at the top of each window, like the near tier's)
    V.box(X, 0, Z, XX, H, ZZ, (x, y, z) => { const edge = x === X || x === XX - 1 || z === Z || z === ZZ - 1; if (!edge) return wall;
      if (y < 7 && s.ground === 'shop') return y === 6 ? (s.shops?.[0]?.sign ?? PAL.red) : PAL.ink;
      if (y < 7 && s.ground === 'lobby') return y >= 5 ? PAL.ink : glassA;
      if (y === 0 && s.ground === 'resi') return air(shade(s.wall, .7));   // the resi base course
      const a = (x === X || x === XX - 1) ? z - Z : x - X, yy = y - (s.ground === 'stoop' ? 2 : 7);
      if (y >= H - 2 && H > 6) return paint(corn(a, y - (H - 2)), 0);   // the cornice: its own pattern in the top two rows
      return yy >= 0 ? paint(win(a, yy % fl), yy % fl) : wall; });
    if (s.cornice === 'crenel' && H > 6) for (let x = X; x < XX; x++) for (let z = Z; z < ZZ; z++) { const edge = x === X || x === XX - 1 || z === Z || z === ZZ - 1, a = (x === X || x === XX - 1) ? z - Z : x - X; if (edge && a % 2 === 0) V.set(x, H + 1, z, wall); }   // merlons
    // roof: neutral membrane, a coping ring, a bulkhead
    V.box(X, H, Z, XX, H + 1, ZZ, (x, y, z) => (x === X || x === XX - 1 || z === Z || z === ZZ - 1) ? copeCol(s) : roofCol(s));
    V.box(X + 1, H, Z + 1, XX - 1, H, ZZ - 1, roofCol(s));
    if (XX - X > 6 && ZZ - Z > 6 && !s.piece) V.box(X + 2, H + 1, Z + 2, X + 5, H + 4, Z + 4, 0xb9b6ae);
    if (s.type === 'tower') { let y = H, lo = 2, t = 0; const floors = s.st - 2, tiers = 2 + (s.seed & 1), per = Math.ceil(floors / tiers);
      for (; t < tiers && XX - X - 2 * lo > 4; t++) { const th = Math.round(Math.min(per, floors - t * per) * 3 / S); if (th <= 0) break;
        V.box(X + lo, y, Z + lo, XX - lo, y + th, ZZ - lo, (x, yy, z) => ((x === X + lo || x === XX - lo - 1 || z === Z + lo || z === ZZ - lo - 1) && (yy - y) % 6 >= 2 && (yy - y) % 6 <= 3 && (x + z) % 2 === 0) ? glassA : wall);
        V.box(X + lo, y + th, Z + lo, XX - lo, y + th + 1, ZZ - lo, roofCol(s)); y += th + 1; lo += 3; } }
    // set piece blob (the fork's farSetPiece), billboard gag
    const top = SIDE + l.H * CV, rect = { x0: x0 + .3, z0: z0 + .3, x1: x1 - .3, z1: z1 - .3 };
    if (s.piece) for (const bx of SP.farSetPiece(s.piece, rect, top) || []) boxW(...bx);
    if (s.gag?.kind === 'billboard') { const [, , , BG, FG] = BILLBOARDS[s.seed % BILLBOARDS.length], side = l.faces[l.faces.length - 1] || l.main, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, alongX = side[1] === 'z';
      const hw = 3.8, a0 = alongX ? mx - hw : mx - .25, a1 = alongX ? mx + hw : mx + .25, b0 = alongX ? mz - .25 : mz - hw, b1 = alongX ? mz + .25 : mz + hw;
      boxW(mx - .25, top, mz - .25, mx + .25, top + 2, mz + .25, PAL.ink); boxW(a0, top + 2, b0, a1, top + 6, b1, (hashC(s.seed) ? BG : FG)); }
  }
  const bank = new Bank(true); meshVol(V, bank); return bank;
}
const hashC = s => (s % 3) !== 1;
