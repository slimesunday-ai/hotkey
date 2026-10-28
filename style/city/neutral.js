// Pass 2 · THE NEUTRAL MIX (STYLE §2, slime's default). Roughly 30–40 % of a district's buildings get a white, grey or neutral-brick
// wall so the bold colour lands in clusters instead of confetti from overhead. Two smooth noise fields decide which:
//   macro (palette.neutral.field, ~2 blocks): how neutral a whole block leans (0.45× … 1.55× the district share)
//   micro (lotField, ~half a block):       which lots inside the block, so neutral lots come in runs, often across a corner
// Pure hashing (never the block rng), so types, storeys, names and every other choice stay exactly as they were.
// A neutral wall takes a contrasting trim (ink or a bold accent on white, cream on brick) so it still reads as designed.
import { PAL, hash, shade } from './style.js';
import { unshift } from '../../world/city.js';   // (SPREAD pins: the neutral fields are sampled at today's coordinates, so no block's colours re-roll)

const vn = (x, z, seed) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi, seed), b = hash(xi + 1, zi, seed), c = hash(xi, zi + 1, seed), d = hash(xi + 1, zi + 1, seed); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const LUM = c => (((c >> 16) & 255) * .3 + ((c >> 8) & 255) * .59 + (c & 255) * .11) / 255;
const LIGHT_TRIMS = [PAL.ink, 0x8f929b, PAL.ink, 0x2f5bff, PAL.ink, 0xe8232a, 0x8f929b];   // on white / bone / pale walls: mostly ink or grey, now and then an accent
const MID_TRIMS = [PAL.white, PAL.cream, PAL.white, PAL.ink];                     // on greys
const BRICK_TRIMS = [PAL.cream, PAL.white, PAL.cream, PAL.white];                 // on brick and buff (classic: pale lintels and sills)
export const isNeutral = (K, c) => K.palette.neutral.tones.includes(c);
export const macroOf = (K, x, z) => { [x, z] = unshift(x, z); return vn(x / K.palette.neutral.field, z / K.palette.neutral.field, 401); };

export function neutralMix(b, order, K) {
  const N = K.palette.neutral; if (!N || !(N.share > 0) || !N.tones?.length) return 0;
  const cand = order.filter(l => l.spec && !N.keep.includes(l.spec.type) && !l.spec.hero); if (cand.length < 3) return 0;
  const [cx, cz] = unshift((b.R.x0 + b.R.x1) / 2, (b.R.z0 + b.R.z1) / 2), macro = vn(cx / N.field, cz / N.field, 401);
  const k = Math.max(1, Math.min(cand.length - 2, Math.round(cand.length * N.share * (.45 + 1.1 * (1 - macro)))));
  // towers and offices lean neutral (stone, glass, white: they are most of what the overview sees); small shops keep their colour
  const score = l => { const [lx, lz] = unshift((l.x0 + l.x1) / 2, (l.z0 + l.z1) / 2); return vn(lx / N.lotField, lz / N.lotField, 409) + hash(l.spec.seed, 93) * .12 + (N.lean?.[l.spec.type] ?? 0); };
  const chosen = new Set(cand.slice().sort((p, q) => score(p) - score(q)).slice(0, k));
  let prev = -1;
  for (const l of order) { const s = l.spec; if (!s) continue;
    if (!chosen.has(l)) { prev = s.wall; continue; }
    let t = (hash(s.seed, 94) * N.tones.length) | 0; if (N.tones[t] === prev) t = (t + 1) % N.tones.length; if (N.tones[t] === prev) t = (t + 2) % N.tones.length;
    const wall = N.tones[t], lum = LUM(wall), brick = (wall >> 16) - (wall & 255) > 60, trims = brick ? BRICK_TRIMS : lum > .7 ? LIGHT_TRIMS : MID_TRIMS;
    s.wall = wall; s.neutral = true; s.trim = trims[(hash(s.seed, 95) * trims.length) | 0]; if (s.trim === wall) s.trim = PAL.ink;
    s.bayCol = shade(wall, lum > .8 ? .93 : 1.12); if (s.accent === wall) s.accent = PAL.ink; prev = wall; }
  return k;
}
// the same rule for kits that place buildings one by one (no block ranking): neutral where the fields run low, about `share` overall.
// u: the building's own hash (0–1). Half micro field, half hash → roughly triangular, so the threshold is the inverse of that CDF.
export function neutralAt(K, x, z, u) { const N = K.palette.neutral; if (!N || !(N.share > 0)) return false; [x, z] = unshift(x, z);
  const macro = vn(x / N.field, z / N.field, 401), micro = vn(x / N.lotField, z / N.lotField, 409), p = Math.min(.9, N.share * (.45 + 1.1 * (1 - macro)));
  return .5 * micro + .5 * u < (p < .5 ? Math.sqrt(p / 2) : 1 - Math.sqrt((1 - p) / 2)); }
