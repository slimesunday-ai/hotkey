// BLACKPINE WOODS · THE LOOKOUT (block −10,−1) · owner: the Blackpine Woods agent. The ranger's fire tower, standing on Central Ave's
// axis 40 m past the end of the avenue, so the city's main street ends in it: four galvanised legs leaning in, X-bracing, switchback
// stairs, a white cab with windows all round and a red pyramid roof (it reads from the overview), an antenna with a red light; the
// FIRE DANGER board at its foot (the arrow on HIGH), a picnic table. The lookout watches the leaf clearing and the lake.
import { hero } from '../districts/forest/hero.js';
import { putW } from '../districts/forest/features.js';
import * as FP from '../districts/forest/props.js';
import { picnic } from '../props.js';
import { TOWER } from '../districts/forest/plan.js';
import { Vol } from '../vox.js';
import { TOD } from '../kit.js';
import { REG } from '../audit.js';
import { SIDE, CV } from '../style.js';

export const LOOKOUT = { base: 2.6, top: 1.6, deck: 15, cab: 2.5, roof: 1.6, mast: 2.4 };   // half-widths and heights (m)
const G = 0xb9bcc4, GD = 0x8f9299, CAB = 0xf4f1ea, ROOF = 0xe8232a, ROOFD = 0xc81d23;
export function fireTower(bank, b, A) {
  hero(bank, b, A, { skip: [[TOWER[0], TOWER[1], 6]], carve: [[TOWER[0], TOWER[1], 5, 22]] }, ctx => {
    ctx.group('tower'); tower(ctx);
    ctx.group('yard'); putW(ctx, FP.fireDanger(), TOWER[0] + 4.6, TOWER[1] + 3.2, { rot: 1, reach: 1, slide: [0, 1] }); putW(ctx, picnic(0x9a6a3c), TOWER[0] - 4.2, TOWER[1] + 3.6, { rot: 0, reach: 1.2 });
    putW(ctx, FP.trailPost(0xe8232a), TOWER[0] + 1.2, TOWER[1] + 4.6, { reach: .6 });
  });
}
function tower(ctx) {
  const [tx, tz] = TOWER, L = LOOKOUT, R = L.base + .4, n = Math.round(2 * R / CV), top = L.deck + L.cab + L.roof + L.mast + .6, ny = Math.round(top / CV) + 2;
  const V = new Vol(n, ny, n, { s: CV, org: [tx - R, SIDE, tz - R], ground: true }), c = n / 2, deckY = Math.round(L.deck / CV), night = TOD.night;
  ctx.mass(V, [tx - L.base - .2, tz - L.base - .2, tx + L.base + .2, tz + L.base + .2], { top: SIDE + ny * CV, roofY: SIDE + L.deck + .1 });
  const half = y => (L.base + (L.top - L.base) * Math.min(1, y / deckY)) / CV;          // the legs lean in to the deck
  // footings, legs (2 × 2), girts every 3.75 m, X-braces on every face
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { V.box(c + sx * half(0) - 3, 0, c + sz * half(0) - 3, c + sx * half(0) + 3, 4, c + sz * half(0) + 3, 0xa9a397);
    for (let y = 0; y < deckY; y++) { const h = half(y), x = Math.round(c + sx * h - (sx > 0 ? 1 : 0)), z = Math.round(c + sz * h - (sz > 0 ? 1 : 0)); V.box(x, y, z, x + 2, y + 1, z + 2, G, 2); } }
  const lv = [0, 37, 75, 112, deckY - 1];
  for (const y of lv.slice(1)) { const h = Math.round(half(y)); for (let k = -h; k <= h; k++) { V.set(c + k, y, c - h, GD, 2); V.set(c + k, y, c + h - 1, GD, 2); V.set(c - h, y, c + k, GD, 2); V.set(c + h - 1, y, c + k, GD, 2); } }
  // X-braces: on each face, two diagonals from leg to leg between the girts, drawn as connected lines
  for (let q = 0; q + 1 < lv.length; q++) { const ya = lv[q], yb = lv[q + 1], ha = Math.round(half(ya)), hb = Math.round(half(yb));
    for (const [s0, s1] of [[-1, 1], [1, -1]]) {
      FP.line(V, c + s0 * ha, ya, c - ha, c + s1 * hb, yb, c - hb, GD, 2); FP.line(V, c + s0 * ha, ya, c + ha - 1, c + s1 * hb, yb, c + hb - 1, GD, 2);
      FP.line(V, c - ha, ya, c + s0 * ha, c - hb, yb, c + s1 * hb, GD, 2); FP.line(V, c + ha - 1, ya, c + s0 * ha, c + hb - 1, yb, c + s1 * hb, GD, 2); } }
  // switchback stairs up the middle: a flight per level, landings at the girts (treads in wood)
  for (let q = 0; q + 1 < lv.length; q++) { const ya = lv[q], yb = lv[q + 1], dir = q % 2 ? 1 : -1, len = 16;
    for (let y = ya; y <= yb; y++) { const t = (y - ya) / (yb - ya), z = Math.round(c + dir * (len / 2 - len * t)); V.box(c - 3, y, z, c + 3, y + 1, z + 2, 0x9a6a3c); }
    V.box(c - 4, yb, c - 9, c + 4, yb + 1, c + 9, GD, 2); }
  // the deck and its railing, the cab (white panels, glass all round, lit at night), the red pyramid roof, the finial, the antenna
  const d = Math.round(L.top / CV) + 3, cabH = Math.round(L.cab / CV), cw = Math.round(L.top / CV) - 1;
  V.box(c - d, deckY, c - d, c + d, deckY + 1, c + d, 0x6d707a, 2);
  for (let k = -d; k < d; k++) for (let y = deckY + 1; y < deckY + 10; y++) if (y === deckY + 9 || k % 6 === 0) { V.set(c + k, y, c - d, G, 2); V.set(c + k, y, c + d - 1, G, 2); V.set(c - d, y, c + k, G, 2); V.set(c + d - 1, y, c + k, G, 2); }
  for (let y = deckY + 1; y < deckY + 1 + cabH; y++) { const band = y - deckY - 1, glass = band >= 9 && band < 21;
    for (let k = -cw; k < cw; k++) { const mul = (k + cw) % 8 === 0, col = glass && !mul ? (night ? 0xffd27a : (band > 16 ? 0x3f6bc4 : 0x1b2a55)) : band === 8 || band === cabH - 1 ? 0x2a2d38 : CAB, l = glass && !mul ? (night ? 3 : 1) : 0;
      V.set(c + k, y, c - cw, col, l); V.set(c + k, y, c + cw - 1, col, l); V.set(c - cw, y, c + k, col, l); V.set(c + cw - 1, y, c + k, col, l); } }
  const ry = deckY + 1 + cabH; for (let k = 0; k <= cw + 2; k++) V.box(c - cw - 2 + k, ry + k, c - cw - 2 + k, c + cw + 2 - k, ry + k + 1, c + cw + 2 - k, k % 2 ? ROOFD : ROOF);
  const tip = ry + cw + 2; V.box(c - 1, tip, c - 1, c + 1, tip + 2, c + 1, CAB); V.box(c, tip + 2, c, c + 1, tip + 2 + Math.round(L.mast / CV), c + 1, 0x6d707a, 2);
  V.box(c - 1, tip + 2 + Math.round(L.mast / CV), c - 1, c + 1, tip + 4 + Math.round(L.mast / CV), c + 1, 0xff2a2a, night ? 3 : 1);
  // LOOKOUT on the east rail (toward the city)
  const w = FP.tw('LOOKOUT'); V.box(c + d, deckY + 2, c - (w >> 1) - 2, c + d + 1, deckY + 11, c + (w >> 1) + 2, 0x2f5a3a); FP.txtX(V, 'LOOKOUT', c - (w >> 1), deckY + 9, c + d + 1, 0xf2d27a, 0, 1);
}
