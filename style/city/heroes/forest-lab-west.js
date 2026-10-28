// BLACKPINE WOODS · THE WEST SHACK (block −13,−5) · owner: the Blackpine Woods agent. A cook lab (the sim's lab-west at −400, −150):
// a hunter's log cabin at the end of the long west track, past PRIVATE PROPERTY, TURN BACK and KEEP OUT. Round logs with their ends
// sticking out at the corners, a green tin roof, a fieldstone chimney on the north gable and a steel vent stack through the south slope
// (that one is new), boarded windows, a padlocked plank door, a porch with the lookout chair and a lantern; firewood, the outhouse,
// drums under a tarp, the generator.
import { hero, shed } from '../districts/forest/hero.js';
import { putW } from '../districts/forest/features.js';
import { off, at, atR, atB } from '../districts/frame.js';   // (SPREAD: the hero's metres are today's, its block's frame)
import * as FP from '../districts/forest/props.js';
import { bags } from '../props.js';
import { TOD } from '../kit.js';
import { REG } from '../audit.js';
import { SIDE, CV, hash } from '../style.js';

const LOG = 0x8a5530, LOGD = 0x6e4224, CHINK = 0xc9b48a, END = 0xd9b27a, ROOF = 0x2f6a45, ROOFD = 0x255a3a, STONE = [0x9a968e, 0x857f77, 0xb3aea4, 0x6f6a64];
export function labWest(bank, b, A) {
  const F = (x, z) => at(b, x, z);
  hero(bank, b, A, { skip: [[...F(-402, -151), 10]], carve: [[...F(-402.5, -152), 7, 5.5]] }, ctx => {
    ctx.group('cabin'); cabin(ctx); porch(ctx);
    ctx.group('yard'); const Pp = (prop, x, z, o) => putW(ctx, prop, ...at(ctx, x, z), { reach: .8, ...o });
    Pp(FP.campChair(0x8a3a2a), -399.6, -150.3, { rot: 1, y: SIDE + .3, reach: .4, slide: [0, 1] }); Pp(FP.lanternPole(), -397.6, -153.4, { rot: 1, slide: [0, 1] });
    Pp(FP.woodpile(), -403.2, -147.9, { rot: 0 }); Pp(FP.outhouse(), -409.6, -142.8, { rot: 1, reach: 1.5 }); tarp(ctx);
    // under the tarp canopy on the south side: the chemicals (blue and white drums, hazard labels), the generator's jerry can
    Pp(FP.drum(0x2f5bff, 1), -404.4, -158.7); Pp(FP.drum(0xd8dbe2, 1), -403.0, -159.0); Pp(FP.drum(0x2f5bff, 0), -401.6, -158.6); Pp(FP.jerrycan(0xb8322a), -400.6, -159.2, { rot: 1 });
    Pp(FP.generator(), -397.0, -157.9, { rot: 1 }); Pp(FP.burnBarrel(), -396.4, -148.2); Pp(FP.cooler(0xe8e2d0), -398.4, -155.8, { rot: 1 });
    Pp(FP.propane(), -406.8, -157.2); Pp(bags(1), -407.4, -150.4, { reach: 1 }); Pp(FP.bucket(0x5a6b3a), -398.2, -147.0);
  });
}
// the cabin: 4.8 × 6.0 m of round logs, the ridge running north–south, the door in the east wall onto the porch
function cabin(ctx) {
  const [x0, z0, x1, z1] = atR(ctx, [-405.4, -155.2, -400.6, -149.2]), H = 2.4, { V, B } = shed(ctx, x0, z0, x1, z1, H, { pad: 8, extra: 32, roofY: H + .2 }), night = TOD.night;
  const xa = B.x0, xb = B.x1, za = B.z0, zb = B.z1, h = Math.round(H / CV), mid = (xa + xb) / 2;
  // log courses (0.2 m) with a pale chinking line between them; the log ends stick out past the corners, course by course
  V.box(xa, 0, za, xb, h, zb, (x, y) => y % 2 === 1 ? CHINK : (y >> 1) % 2 ? LOG : LOGD); V.clear(xa + 1, 0, za + 1, xb - 1, h, zb - 1);
  for (let y = 0, k = 0; y < h; y += 2, k++) { if (k % 2 === 0) for (const z of [za, zb - 1]) { V.box(xa - 2, y, z, xa, y + 2, z + 1, END); V.box(xb, y, z, xb + 2, y + 2, z + 1, END); }
    else for (const x of [xa, xb - 1]) { V.box(x, y, za - 2, x + 1, y + 2, za, END); V.box(x, y, zb, x + 1, y + 2, zb + 2, END); } }
  // gables (north and south) in vertical boards, the green tin roof in two slopes (east and west) with 0.4 m eaves, a ridge cap
  const run = Math.ceil((xb - xa) / 2) + 4, ry = k => h + Math.round(k * .75);
  for (let k = 0; k <= run; k++) { const y = ry(k); for (const x of [xa - 4 + k, xb + 3 - k]) V.box(x, y, za - 4, x + 1, y + 2, zb + 4, (xx, yy, z) => z % 3 === 0 ? ROOFD : ROOF);
    if (k >= 4) for (let yy = h; yy < y; yy++) for (const z of [za, zb - 1]) for (let x = xa - 4 + k; x <= xb + 3 - k; x++) if (x >= xa && x < xb) V.set(x, yy, z, x % 3 ? 0x7a4a26 : 0x5a3620); }
  V.box(Math.floor(mid) - 1, ry(run) + 1, za - 4, Math.ceil(mid) + 1, ry(run) + 2, zb + 4, 0x9a9ca4, 2);
  // the fieldstone chimney outside the north gable, above the ridge; the new steel vent stack through the west slope, capped
  const cx = Math.floor(mid) - 3, top = ry(run) + 8;
  V.box(cx, 0, za - 5, cx + 6, top, za, (x, y, z) => STONE[(hash(x >> 1, y >> 1, z >> 1) * 4) | 0]); V.box(cx + 1, top, za - 4, cx + 5, top + 1, za - 1, 0x3b3f4a);
  const vx = xa + 6, vz = zb - 14, vy = ry(10);
  V.box(vx, vy - 1, vz, vx + 3, vy + 16, vz + 3, 0xb9bcc4, 2); V.box(vx - 1, vy + 16, vz - 1, vx + 4, vy + 17, vz + 4, 0x6d707a, 2); V.box(vx - 2, vy + 17, vz - 2, vx + 5, vy + 18, vz + 5, 0x9a9ca4, 2);
  // the door (padlocked planks) in the east wall, boarded windows, one with a crack of light at night
  const dz = Math.round((za + zb) / 2) - 4; V.box(xb - 1, 0, dz, xb, 20, dz + 8, (x, y, z) => z % 3 === 0 ? 0x5a3620 : 0x7a4a26); V.box(xb, 10, dz + 6, xb + 1, 12, dz + 7, 0xc9ced6, 2);
  const win = (x, y, z, ax) => { for (let a = 0; a < 10; a++) for (let b = 0; b < 8; b++) { const lit = night && b === 4 && a > 1 && a < 8, c = lit ? 0xffb347 : (a === b || a === 9 - b || b === 1 || b === 6) ? 0x9a6a3c : 0x1b1f28; if (ax) V.set(x, y + b, z + a, c, lit ? 3 : 0); else V.set(x + a, y + b, z, c, lit ? 3 : 0); } };
  win(xb - 1, 8, dz + 12, true); win(Math.round(mid) - 5, 8, za, false); win(Math.round(mid) - 5, 8, zb - 1, false);
}
// the porch: a plank deck along the east wall, two posts, a lean-to roof off the eave
function porch(ctx) {
  const [x0, z0, x1, z1] = atR(ctx, [-400.6, -155.0, -398.8, -149.4]), V = ctx.volume(x0, SIDE, z0, x1, SIDE + .3, z1, { walk: true });
  V.box(0, 0, 0, V.nx, 3, V.nz, (x, y, z) => y < 2 ? (x === V.nx - 1 && z % 12 === 0 ? 0x5a3620 : undefined) : (x % 3 === 2 ? 0x6b4526 : 0x9a6a3c));
  for (let z = 0; z < V.nz; z += 12) V.box(V.nx - 1, 0, z, V.nx, 2, z + 1, 0x5a3620);
  const R = ctx.volume(x0, SIDE + .3, z0, x1 + .2, SIDE + 2.4, z1, {}), n = R.nx;
  for (const z of [2, R.nz - 3]) R.box(n - 3, 0, z, n - 2, 20 - Math.round((n - 3) * .35), z + 1, 0x5a3620);
  for (let x = 0; x < n; x++) R.box(x, 20 - Math.round(x * .35), 0, x + 1, 21 - Math.round(x * .35), R.nz, x % 4 ? ROOF : ROOFD);
  REG.keep([x1 - .3, SIDE, z0, x1, SIDE + 2.4, z0 + .3], 'porch-post'); REG.keep([x1 - .3, SIDE, z1 - .5, x1, SIDE + 2.4, z1 - .2], 'porch-post');
}
// the drums' shelter on the south side: an olive tarp strung flat on four poles, sagging in the middle, a rope to a stake at each end
function tarp(ctx) { const [x0, z0, x1, z1] = atR(ctx, [-405.4, -160.2, -400.0, -157.2]), V = ctx.volume(x0, SIDE, z0, x1, SIDE + 2.0, z1, {}), nx = V.nx, nz = V.nz, D = 0x4f5a36, DL = 0x5f6b42;
  for (let x = 0; x < nx; x++) for (let z = 0; z < nz; z++) { const sagY = 18 - Math.round(Math.sin(Math.PI * x / (nx - 1)) * 1.6 + Math.sin(Math.PI * z / (nz - 1)) * .8); V.set(x, sagY, z, (x % 12 === 0 || z === 0 || z === nz - 1) ? DL : D); }
  for (const [x, z] of [[0, 0], [nx - 1, 0], [0, nz - 1], [nx - 1, nz - 1]]) V.box(x, 0, z, x + 1, 18, z + 1, 0x6b4526);
  for (const [x, z] of [[.05, .05], [x1 - x0 - .15, .05], [.05, z1 - z0 - .15], [x1 - x0 - .15, z1 - z0 - .15]]) REG.keep([x0 + x, SIDE, z0 + z, x0 + x + .1, SIDE + 1.9, z0 + z + .1], 'tarp-pole'); }
