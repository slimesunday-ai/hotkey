// Pass 2 · cameras by rule (STYLE §5), shared by the page (main.js) and the fixed shot list (tools/shots.mjs). Pure: plan only.
// street camera rule (pass 1c): stand on the street's centreline. Wide streets (≥ 12 m facade to facade): 16 m before the intersection,
// target 26 ahead, 6 toward the block (the corner shot). Narrow streets: stand at the mouth — in the crossing street, just behind its
// far curb line — look straight down the centreline (≤ 1.5 m toward the block), fov 56, target a little higher: the crossing is the
// open foreground and the walls start ~2×hw ahead, so the near wall never fills the frame.
import { P, hwX, hwZ, rwOf, isAve, blockAt } from './plan.js';

export const hwOf = (b, s) => s === '-z' ? hwZ(b.j) : s === '+z' ? hwZ(b.j + 1) : s === '-x' ? hwX(b.i) : hwX(b.i + 1);
// area = { i0, i1, j0, j1 }: the camera stays inside it (section 1 for the pass-1 views, a kit's built blocks for its shots)
export function streetView(b, sd, label, area) {
  const { i, j } = b, X0 = area.i0 * P, X1 = (area.i1 + 1) * P, Z0 = area.j0 * P, Z1 = (area.j1 + 1) * P, inS = ([x, z]) => x > X0 + 2 && x < X1 - 2 && z > Z0 + 2 && z < Z1 - 2;
  let fwd = { '-z': [1, 0], '+z': [-1, 0], '-x': [0, -1], '+x': [0, 1] }[sd], start = { '-z': [i * P, j * P], '+z': [(i + 1) * P, (j + 1) * P], '-x': [i * P, (j + 1) * P], '+x': [(i + 1) * P, j * P] }[sd], side = 1;
  const line = sd[1] === 'z' ? ['z', sd === '-z' ? j : j + 1] : ['x', sd === '-x' ? i : i + 1], rw = rwOf(...line), wide = isAve(...line);   // (SPREAD: wide by class; rw: the street's right-of-way)
  const crossL = (st, f) => f[0] !== 0 ? ['x', Math.round(st[0] / P)] : ['z', Math.round(st[1] / P)], crossHw = (st, f) => { const [ax, L] = crossL(st, f); return ax === 'x' ? hwX(L) : hwZ(L); }, crossAve = (st, f) => isAve(...crossL(st, f));
  // narrow street: prefer the end whose crossing street is wider (an avenue mouth); narrow-into-narrow stands 3 m back past the crossing
  const backOf = (st, f) => { const ch = crossHw(st, f); return wide ? 16 : crossAve(st, f) ? ch + 1.5 : rwOf(...crossL(st, f)) + 3; };
  let back = backOf(start, fwd);
  const alt = [start[0] + fwd[0] * P, start[1] + fwd[1] * P], altF = [-fwd[0], -fwd[1]], altOk = inS([alt[0] - altF[0] * backOf(alt, altF), alt[1] - altF[1] * backOf(alt, altF)]);
  if (!inS([start[0] - fwd[0] * back, start[1] - fwd[1] * back]) || (!wide && altOk && crossHw(alt, altF) > crossHw(start, fwd))) { start = alt; fwd = altF; side = -1; back = backOf(start, fwd); }
  const right = [-fwd[1] * side, fwd[0] * side], off = wide ? -.5 : 0, lat = wide ? 6 : 0, narrowMouth = !wide && !crossAve(start, fwd);
  const cam = [start[0] - fwd[0] * back + right[0] * off, start[1] - fwd[1] * back + right[1] * off], tgt = [cam[0] + fwd[0] * 26 + right[0] * lat, cam[1] + fwd[1] * 26 + right[1] * lat];
  return { pos: [cam[0], narrowMouth ? 3.3 : 2.9, cam[1]], tgt: [tgt[0], wide ? 3.8 : narrowMouth ? 4.3 : 4.6, tgt[1]], fov: wide ? 54 : narrowMouth ? 50 : 56, sh: [(cam[0] + tgt[0]) / 2 + fwd[0] * 6, (cam[1] + tgt[1]) / 2 + fwd[1] * 6, 34], block: `${label} ${b.i},${b.j} (${b.k}) ${sd} face, street ${2 * rw} m` };
}
// the blocks a kit builds, as a bounding area (a kit with built: 'all' → its district's blocks on the plan)
export function areaOf(blocks) { let i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9; for (const [i, j] of blocks) { i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); } return { i0, i1, j0, j1 }; }
// a kit camera → { pos, tgt, fov, sh }. Either explicit ({ pos, tgt, fov, sh? }) or a rule ({ rule: 'street', block: [i, j], side }).
export function resolveCamera(c, area) {
  if (!c) return null;
  if (c.rule === 'street') { const v = streetView(blockAt(c.block[0], c.block[1]), c.side, c.name || 'street', area); return { ...v, name: c.name }; }
  const [p, t] = [c.pos, c.tgt]; return { pos: p, tgt: t, fov: c.fov ?? 50, sh: c.sh ?? [(p[0] + t[0]) / 2, (p[2] + t[2]) / 2, Math.max(16, Math.hypot(p[0] - t[0], p[2] - t[2]) * .8)], name: c.name };
}
// the fixed shot list of a kit: overhead, two street views, one landmark close-up, night (tools/shots.mjs renders exactly these)
export function shotList(kit, blocks) {
  const area = areaOf(blocks), C = kit.cameras || {}, out = [];
  if (C.overhead) out.push({ key: 'overhead', ...resolveCamera(C.overhead, area) });
  (C.street || []).slice(0, 2).forEach((c, k) => out.push({ key: 'street-' + (k + 1), ...resolveCamera(c, area) }));
  if (C.landmark) out.push({ key: 'landmark', ...resolveCamera(C.landmark, area) });
  if (C.night) out.push({ key: 'night', night: true, ...resolveCamera(C.night, area) });
  return out;
}
