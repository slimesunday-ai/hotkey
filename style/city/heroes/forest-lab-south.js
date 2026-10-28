// BLACKPINE WOODS · THE SOUTH SHACK (block −4,12) · owner: the Blackpine Woods agent. A cook lab (the sim's lab-south at −120, 390):
// a tin shed near the south shore where Grand Ave's dead end turns into a dirt track, past the chain, NO HUNTING and BEWARE OF DOG.
// Patchwork corrugated sheets (rust, galvanised, one salvaged blue), a silver lean-to roof, a blue tarp nailed over the east wall, a
// tall vent stack with a turbine cap spinning on top (the tell), KEEP OUT painted on the plywood door; the water tote, drums, the
// generator, the dog's house, and the lookout: a chair up on stacked pallets, facing the track.
import { hero, shed } from '../districts/forest/hero.js';
import { putW } from '../districts/forest/features.js';
import { off, at, atR, atB } from '../districts/frame.js';   // (SPREAD: the hero's metres are today's, its block's frame)
import * as FP from '../districts/forest/props.js';
import { bags } from '../props.js';
import { TOD } from '../kit.js';
import { REG } from '../audit.js';
import { SIDE, CV, hash } from '../style.js';

const SHEETS = [[0xa4502a, 0x8a3f22], [0x9a9ca4, 0x85878f], [0x8a3f22, 0x74331b], [0x5a7a9a, 0x4a6a8a], [0xa4502a, 0x93472a]];
export function labSouth(bank, b, A) {
  const F = (x, z) => at(b, x, z);
  hero(bank, b, A, { skip: [[...F(-121, 393), 10]], carve: [[...F(-121.6, 393.4), 6.5, 5.2]] }, ctx => {
    ctx.group('shack'); shack(ctx); tarpWall(ctx);
    ctx.group('yard'); const Pp = (prop, x, z, o) => putW(ctx, prop, ...at(ctx, x, z), { reach: .8, ...o });
    Pp(FP.ibc(), -116.4, 394.2, { rot: 1 }); Pp(FP.drum(0x2f5bff, 0), -126.6, 392.2); Pp(FP.drum(0xffc21a, 1), -126.9, 393.8); Pp(FP.drum(0xa4502a, 0), -126.2, 395.3);
    Pp(FP.generator(), -117.2, 397.4, { rot: 0 }); Pp(FP.propane(), -125.8, 397.6); Pp(FP.kennel(), -125.6, 388.2, { rot: 2 }); Pp(FP.wheelbarrow(), -114.2, 392.6, { rot: 1 });
    Pp(bags(2), -116.6, 389.0, { reach: 1 }); Pp(FP.bucket(0xe8232a), -118.2, 389.4);
    const st = Pp(FP.pallets(4), -114.4, 388.4, { rot: 0 }); if (st) putW(ctx, FP.campChair(0x2f5bff), st[0], st[1], { reach: .8, ...{ rot: 2, y: SIDE + .6, reach: 0 } });   // (st: where the pallets went, already the spread world's)
  });
}
// the shed: 5.8 × 4.8 m of corrugated sheets, a lean-to roof high at the door (north), the door and KEEP OUT on the north wall
function shack(ctx) {
  const [x0, z0, x1, z1] = atR(ctx, [-124.6, 391, -118.8, 395.8]), Hf = 2.6, Hb = 2.1, { V, B } = shed(ctx, x0, z0, x1, z1, Hf, { pad: 6, extra: 34, roofY: Hb }), night = TOD.night;
  const xa = B.x0, xb = B.x1, za = B.z0, zb = B.z1, hf = Math.round(Hf / CV), hb = Math.round(Hb / CV), hAt = z => Math.round(hf - (hf - hb) * (z - za) / (zb - za));
  // walls: 1 m sheets, each its own colour, ribbed every other column; a rust run where the sheets meet
  const sheet = u => SHEETS[(hash(Math.floor(u / 10), 7, 3) * SHEETS.length) | 0], rib = (u, c) => (u & 1) ? c[1] : c[0];
  for (let z = za; z < zb; z++) { const h = hAt(z); for (let y = 0; y < h; y++) for (const x of [xa, xb - 1]) V.set(x, y, z, rib(z, sheet(z + (x === xa ? 0 : 50)))); }
  for (let x = xa; x < xb; x++) { for (let y = 0; y < hf; y++) V.set(x, y, za, rib(x, sheet(x + 100))); for (let y = 0; y < hb; y++) V.set(x, y, zb - 1, rib(x, sheet(x + 150))); }
  // the lean-to roof: galvanised, 0.3 m eaves, a few rust spots, sloping from the north (door) to the south
  for (let z = za - 3; z < zb + 3; z++) { const y = hAt(Math.max(za, Math.min(zb - 1, z))); V.box(xa - 3, y, z, xb + 3, y + 1, z + 1, (x) => hash(x >> 1, z >> 1, 11) < .12 ? 0xa4502a : (x & 1) ? 0xb9bcc4 : 0xa7aab2, 2); }
  // the door: plywood, KEEP OUT painted on it in red (read from the track, north), a hasp; a foil window in the west wall
  const dx = Math.round((xa + xb) / 2) - 1; V.box(dx - 5, 0, za, dx + 5, 20, za + 1, 0xc49a6c); V.box(dx + 3, 9, za - 1, dx + 4, 11, za, 0x9a9ca4, 2);
  const T = 'KEEP', U = 'OUT', tx = w => dx - (FP.tw(w) >> 1); FP.txt(V, T, tx(T), 17, za - 1, 0xe8232a, 0, -1); FP.txt(V, U, tx(U), 9, za - 1, 0xe8232a, 0, -1);
  V.box(xa, 10, za + 18, xa + 1, 16, za + 30, night ? 0xffb347 : 0xc9ced6, night ? 3 : 2);
  // the vent stack up the back (south) wall and a metre and a half over the roof, the turbine cap on top
  const vx = xb - 12, vz = zb; V.box(vx, 0, vz, vx + 3, hb + 18, vz + 3, 0xb9bcc4, 2); V.box(vx + 1, hb - 4, vz - 1, vx + 2, hb - 3, vz, 0x6d707a, 2);
  for (let y = 0; y < 6; y++) { const r = y === 0 || y === 5 ? 1 : 2; for (let a = -r; a <= r + 1; a++) for (let c = -r; c <= r + 1; c++) if (Math.abs(a - .5) + Math.abs(c - .5) <= r + .5) V.set(vx + 1 + a, hb + 18 + y, vz + 1 + c, (a + c + y) & 1 ? 0xc9ced6 : 0x9a9ca4, 2); }
}
// a blue tarp nailed over the east wall, pulled tight with a rope to a stake
function tarpWall(ctx) { const [x0, z0, x1, z1] = atR(ctx, [-118.7, 391.4, -118.5, 395.4]), V = ctx.volume(x0, SIDE, z0, x1, SIDE + 2.3, z1, {});
  for (let z = 0; z < V.nz; z++) for (let y = 0; y < V.ny - Math.round(z * .1); y++) V.set(0, y, z, (z % 10 === 0 || y % 11 === 0) ? FP.K.tarpL : FP.K.tarp); }
