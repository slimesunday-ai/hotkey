// GATEHILL · hero · AUREUM (block −7,5: Oak St to Pine St, Cedar St to Dogwood St, the middle of the district). Owner: the Gatehill agent.
// Ids read -7_5·<group>·kind·n (groups: tower, shops, lobbyN, lobbyS, roof, podium, aureum).
//   The tallest thing in Gatehill: a white deco tower with gold spandrels stepping back three times to a sunburst crown of gold arches
//   (rays of glass, lit white at night) and a steel spire with its red light. Chrome eagles lean out of the corners of the last setback.
//   Both courts have gold porte-cochères (a limo on the north, a black SUV line on the south). The kit draws the tower (specs.js: the
//   crown is 'sunburst'); this adds the eagles (into the shaft before it is meshed).
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { TOD } from '../kit.js';
import { buildEstate } from '../districts/estates/build.js';
import { C } from '../districts/estates/lib.js';

export function aureum(bank, b, A) {
  const ctx = blockCtx(bank, b, A, kitNow()); REG.strict = true;
  try { buildEstate(ctx, { tower: eagles }); ctx.finish(); } finally { REG.strict = false; }
}
// chrome eagles at the four corners of the third tier's roof, leaning out on the diagonal (0.2 cubes, into the shaft volume)
function eagles(ctx, P, T, { sh }) {
  const V = sh.V, st = P.st, t = st.tiers[2], y = Math.round((t.y1 - st.podTop) / .2), [u0, v0, u1, v1] = t.rects[0], X = u => Math.round((P.U(u) - V.org[0]) / .2), Z = v => Math.round((P.V(v) - V.org[2]) / .2);
  const CH = 0xc9ced6, lay = TOD.night ? 3 : 2;
  for (const [x, z, dx, dz] of [[X(u0), Z(v0), -1, -1], [X(u1) - 1, Z(v0), 1, -1], [X(u0), Z(v1) - 1, -1, 1], [X(u1) - 1, Z(v1) - 1, 1, 1]]) {
    for (let k = 0; k < 5; k++) { const xx = x + dx * k, zz = z + dz * k, yy = y - 3 + Math.min(k, 2); V.box(Math.min(xx, xx - dx), yy, Math.min(zz, zz - dz), Math.max(xx, xx - dx) + 1, yy + 3, Math.max(zz, zz - dz) + 1, CH, lay); }   // the neck
    const hx = x + dx * 5, hz = z + dz * 5; V.box(Math.min(hx, hx + dx * 2), y - 1, Math.min(hz, hz + dz * 2), Math.max(hx, hx + dx * 2) + 1, y + 3, Math.max(hz, hz + dz * 2) + 1, CH, lay);   // the head
    V.box(Math.min(hx + dx * 3, hx + dx * 4), y - 1, Math.min(hz + dz * 3, hz + dz * 4), Math.max(hx + dx * 3, hx + dx * 4) + 1, y + 1, Math.max(hz + dz * 3, hz + dz * 4) + 1, C.gold, 2);   // the beak
    V.set(hx + dx, y + 2, hz, 0x17171b); V.set(hx, y + 2, hz + dz, 0x17171b); }                                                                      // eyes
}
