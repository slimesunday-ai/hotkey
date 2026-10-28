// IRON ISLAND · hero · IRON POINT (block 8,−12) · owner: the water-side agent (batch 5).
// The light on the island's north-east point, outside the wall where it is cut back: an octagonal keeper's plinth with a steel door
// and its plate (IRON POINT LIGHT 1891), the round tower in red and white bands tapering to the gallery, the gallery rail with two
// gulls on it, the lantern (glass and eight mullions; lit at night: the bay's night mark), the red cap, the ventilator ball, the rod.
import { kitNow } from '../gen.js';
import { heroBlock } from '../districts/jail/build.js';
import { C, CV, SIDE, TOD, REG, H, lit, shade, wv, later, wboard, mini, logSign } from '../districts/jail/lib.js';
import { LIGHT } from '../districts/jail/plan.js';

export function lighthouse(bank, b, A) { heroBlock(bank, b, A, kitNow(), content); }

function content(ctx) {
  ctx.group('lighthouse'); const { x, z } = LIGHT, N = TOD.night, top = SIDE + 17.4;
  const W = wv(ctx, [x - 2.4, z - 2.4, x + 2.4, z + 2.4], SIDE, top + .2, { s: CV, out: 1 }); if (!W) return; const V = W.V;
  const oct = (dx, dz) => Math.max(Math.abs(dx), Math.abs(dz), (Math.abs(dx) + Math.abs(dz)) / 1.414);
  const bands = [[2.4, C.red], [4.6, C.chalk], [6.8, C.red], [9.0, C.chalk], [11.2, C.red]], yS0 = SIDE + 2.4, yS1 = SIDE + 13.4;
  for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const dx = W.wx(i) - x, dz = W.wz(k) - z, r = Math.hypot(dx, dz), o = oct(dx, dz), ang = Math.atan2(dz, dx);
    for (let j = 0; j < V.ny; j++) { const y = W.wy(j); let c = null, l = 0;
      if (y < yS0) { if (o < 2.1) c = y < SIDE + .4 ? C.concD : (o > 1.95 && y > SIDE + 2.1) ? C.concL : C.bone; }                           // the keeper's plinth
      else if (y < yS1) { const t = (y - yS0) / (yS1 - yS0), R = 1.5 - t * .3; if (r < R) { c = bands.reduce((cc, [b0, col]) => y >= SIDE + b0 ? col : cc, C.red); if (r < R - .25) c = null;   // the banded shaft (hollow)
          const band = Math.floor((y - yS0) / 2.2); if (band % 2 === 1 && Math.abs(ang - Math.PI * .75) < .16 && ((y - yS0) % 2.2) > .7 && ((y - yS0) % 2.2) < 1.5 && r > R - .25) c = N ? C.litLo : C.navy, l = N ? 3 : 0; } }   // a window per white band, south-west
      else if (y < yS1 + .2) { if (r < 1.9) c = C.steelD; }                                                                                    // the gallery deck
      else if (y < yS1 + 1.0) { if (r > 1.75 && r < 1.9 && (Math.abs(((ang + Math.PI) % (Math.PI / 4)) - Math.PI / 8) > .3 || y > yS1 + .85)) c = C.steelD;   // the rail: posts, a top ring
        if (r < 1.05 && r > .9) c = (Math.abs(((ang + Math.PI) % (Math.PI / 4)) - Math.PI / 8) < .09) ? C.ink : N ? 0xfff1c4 : 0x9fd8ff, l = N ? 3 : 1; if (r < .5 && y < yS1 + .8) c = N ? 0xffffff : C.gold, l = N ? 3 : 2; }
      else if (y < yS1 + 2.0) { if (r < 1.05 && r > .9) c = (Math.abs(((ang + Math.PI) % (Math.PI / 4)) - Math.PI / 8) < .09) ? C.ink : N ? 0xfff1c4 : 0x9fd8ff, l = N ? 3 : 1; if (r < .5 && y < yS1 + 1.3) c = N ? 0xffffff : C.gold, l = N ? 3 : 2; }   // the lantern: glass, mullions, the lamp
      else if (y < yS1 + 3.0) { const t = (y - yS1 - 2.0) / 1.0; if (r < 1.2 - t * .9) c = C.red; }                                           // the cap
      else if (y < yS1 + 3.4) { if (r < .22) c = C.ink; }                                                                                      // the ventilator ball
      else if (y < yS1 + 4.0) { if (r < .06) c = C.steelD; }                                                                                   // the rod
      if (c !== null) V.set(i, j, k, c, l); } }
  // the lamp stays in the middle of the lantern: fill its column so it is one piece with the gallery
  W.box(x - .15, yS1 + .2, z - .15, x + .15, yS1 + 1.3, z + .15, N ? 0xffffff : C.gold, N ? 3 : 2);
  // the door and the plate on the plinth's south-west face (toward the compound's cut wall)
  const dxw = x - 1.48, dzw = z + 1.48; W.box(dxw - .5, SIDE + .4, dzw - .1, dxw + .4, SIDE + 2.2, dzw + .5, C.steelD);
  // two gulls on the gallery rail (voxels of the rail itself, facing out)
  for (const [gx, gz] of [[x + 1.3, z - 1.3], [x - 1.8, z + .3]]) { W.box(gx - .1, yS1 + 1.0, gz - .15, gx + .1, yS1 + 1.2, gz + .15, 0xf5f6f4); W.box(gx - .1, yS1 + 1.1, gz - .1, gx + .1, yS1 + 1.2, gz + .1, 0xb4bcc6); W.box(gx - .05, yS1 + 1.2, gz - .05, gx + .05, yS1 + 1.3, gz + .05, 0xf5f6f4); }
  later(ctx, W, { keep: [x - 2.2, SIDE, z - 2.2, x + 2.2, top, z + 2.2], tag: 'lighthouse' });
  logSign(ctx, 'IRON POINT LIGHT', x, z, 96);
  // the plate, on its own board so the words sit on it
  const P = wv(ctx, [x - 2.5, z - 1.0, x - 2.1, z + 1.0], SIDE + .9, SIDE + 1.9, { s: CV, out: 1 }); if (P) { P.box(x - 2.2, SIDE + .9, z - .9, x - 2.1, SIDE + 1.9, z + .9, C.cream);
    [['IRON POINT', 1.75], ['LIGHT', 1.45], ['1891', 1.15]].forEach(([t, h]) => wletters2(P, t, x - 2.2, z, SIDE + h)); later(ctx, P); }
}
// the plate's words: 3×5 letters facing west on the plate (its board is the cream plate one cell behind)
import { letters } from '../districts/jail/lib.js';
function wletters2(P, t, plane, zc, ytop) { const M = mini(t), V = P.V, d = P.X(plane) - 1; letters(V, M, '-x', P.Z(zc) - (M.w >> 1), P.Y(ytop), d, C.ink); }
