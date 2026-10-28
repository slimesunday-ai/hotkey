// MAINLAND v1 · the two modernists from candidate B (the slab and the butterfly), adapted to A's flat, friendly suburb: the flat or
// butterfly roof, the glass curtain, the breeze-block screen and the GLASS GARAGE with the car on show stay; the palms, agaves, the
// perimeter hedges and every internet gag go (A's trees and shrubs instead, and the sherbet walls). Worker-safe (no three).
// Authored in B's lot frame (x across the frontage, z INTO the lot from the front line, y up from the lawn, metres); houses.js stamps
// the result turned by π into A's frame (z out of the lot), so B's left is A's right.
import { Vol, meshed, stamp } from '../vox.js';
import { PAL, hash } from '../style.js';
import { TOD } from '../kit.js';
import { vehicleProp } from '../vehicles/index.js';
import { lawnChair, umbrella } from '../props.js';
import { tree } from '../districts/suburbs/props.js';

const H = (a, b = 0, c = 0) => hash(Math.round(a) | 0, Math.round(b) | 0, Math.round(c) | 0);
const C = { white: 0xf4f1ea, bone: 0xe6e1d6, pale: 0xd3d4d7, grey: 0xa7a9b1, slate: 0x6d707a, ink: 0x17171b, chalk: 0xf7f7f2, gold: 0xe7bd4a, orange: 0xff7a1a, sign: 0xffe23a,
  pink: 0xff4fa3, teal: 0x12b3a0, red: 0xef4a2a, blue: 0x2f5bff, granite: 0x26262e, hedge: 0x1d8f3c, hedgeT: 0x2aa84a, hedgeD: 0x187a34, trav: 0xefe6d2, paveJ: 0xcfc7b8,
  water: 0x2fc4ff, waterD: 0x1f8fd8, caustic: 0xbff0ff };
class Box {   // B's metre-addressed Vol (colour functions get centres and offsets from the box start; return [colour, layer] to set a layer)
  constructor(x0, y0, z0, x1, y1, z1, s = .1) { this.s = s; this.o = [x0, y0, z0]; this.V = new Vol(Math.round((x1 - x0) / s), Math.round((y1 - y0) / s), Math.round((z1 - z0) / s), { s, org: [x0, y0, z0], ground: true }); }
  ix(v) { return Math.round((v - this.o[0]) / this.s); } iy(v) { return Math.round((v - this.o[1]) / this.s); } iz(v) { return Math.round((v - this.o[2]) / this.s); }
  box(x0, y0, z0, x1, y1, z1, c, l = 0) {
    const V = this.V, a = [this.ix(x0), this.iy(y0), this.iz(z0), this.ix(x1), this.iy(y1), this.iz(z1)];
    if (typeof c !== 'function') { if (Array.isArray(c)) V.box(a[0], a[1], a[2], a[3], a[4], a[5], c[0], c[1]); else V.box(a[0], a[1], a[2], a[3], a[4], a[5], c, l); return; }
    const s = this.s, [ox, oy, oz] = this.o;
    for (let y = Math.max(0, a[1]); y < Math.min(V.ny, a[4]); y++) for (let z = Math.max(0, a[2]); z < Math.min(V.nz, a[5]); z++) for (let x = Math.max(0, a[0]); x < Math.min(V.nx, a[3]); x++) {
      const v = c(ox + (x + .5) * s, oy + (y + .5) * s, oz + (z + .5) * s, x - a[0], y - a[1], z - a[2]); if (v === undefined || v === null) continue;
      if (Array.isArray(v)) V.set(x, y, z, v[0], v[1]); else V.set(x, y, z, v, l); }
  }
}
const NIGHT = () => TOD.night;
const glassF = (lit, y0, y1) => (x, y, z, i, j, k) => { const t = (y - y0) / Math.max(.1, y1 - y0);
  if (NIGHT()) { const bay = H(((x + 400) / 1.4) | 0, ((z + 400) / 1.4) | 0, 5); return lit && bay > .3 ? [t > .55 ? PAL.litHi : PAL.litLo, 3] : lit && bay > .15 ? [t > .5 ? 0xb07a48 : 0x8a5a36, 3] : (t > .6 ? 0x2a3566 : 0x1b2240); }
  const g = (i + k + j) % 29; return [g < 2 && t > .25 ? PAL.glint : t > .55 ? PAL.glassHi : PAL.glassLo, 1]; };
function curtain(B, x0, x1, y0, y1, zf, lit, mull = C.chalk, bay = 1.4) {
  B.box(x0, y0, zf, x1, y1, zf + .2, glassF(lit, y0, y1));
  for (let x = x0; x <= x1 + .01; x += bay) B.box(x - .05, y0, zf - .1, x + .05, y1, zf + .1, mull);
  B.box(x0, y0 - .1, zf - .1, x1, y0, zf + .1, mull); B.box(x0, y1, zf - .1, x1, y1 + .1, zf + .1, mull); }
function roof(B, x0, z0, x1, z1, y, t = .3, fascia = C.chalk) { B.box(x0, y, z0, x1, y + t, z1, fascia); B.box(x0 + .3, y + t - .1, z0 + .3, x1 - .3, y + t, z1 - .3, (x, yy, z, i, j, k) => H(i, k, 3) > .93 ? C.grey : C.pale); }
function door(B, x, zf, col, w = 1.2, h = 2.4) { B.box(x - w / 2 - .1, 0, zf - .05, x + w / 2 + .1, h + .1, zf + .1, C.chalk); B.box(x - w / 2, 0, zf - .1, x + w / 2, h, zf + .1, col); B.box(x + w / 2 - .3, 1.0, zf - .2, x + w / 2 - .2, 1.6, zf - .1, C.gold, 2);
  B.box(x + w / 2 + .3, 1.8, zf - .15, x + w / 2 + .5, 2.2, zf, NIGHT() ? [0xffe3a0, 3] : 0xfff1c8); }
const bbHole = (a, j) => ((a % 5 === 1 || a % 5 === 3) && (j % 5 === 1 || j % 5 === 3));
function breezeX(B, x0, x1, z, h, col) { B.box(x0, 0, z, x1, h, z + .2, (x, y, zz, i, j) => (j >= 1 && j < Math.round(h / .1) - 1 && bbHole(i, j - 1)) ? undefined : col); B.box(x0 - .05, h, z - .05, x1 + .05, h + .1, z + .25, C.chalk); }
function planterRow(B, x0, x1, z) { for (let x = x0; x < x1 - .4; x += .8) B.box(x, 0, z, x + .7, .45 + H(x * 10, z) * .3, z + .7, (xx, y, zz, i, j, k) => H(i, j, k) > .86 ? [0xff4fa3, 0xffe23a, 0xf7f7f2][(H(k, i) * 3) | 0] : j > 3 ? 0x3cbc5a : 0x2e9f4a); }
function pool(B, x0, z0, x1, z1, deck = 1.2) {
  B.box(x0 - deck, 0, z0 - deck, x1 + deck, .3, z1 + deck, (x, y, z, i, j, k) => (i + k) % 12 === 0 && H(i, k) > .5 ? C.paveJ : C.trav);
  B.box(x0 - .3, .2, z0 - .3, x1 + .3, .3, z1 + .3, C.chalk);
  B.box(x0, 0, z0, x1, .3, z1, (x, y, z, i, j, k) => { if (y > .2) return -1; const e = Math.min(x - x0, x1 - x, z - z0, z1 - z);
    if (NIGHT()) return [e < .35 ? 0x1aa6ee : H(i, k, 9) > .96 ? 0xd8fbff : 0x46dcff, 3]; return [e < .35 ? C.waterD : H(i, k, 9) > .965 ? C.caustic : C.water, 1]; }); }
// the glass garage: an open showroom behind a pane, a lit floor and soffit, a clean back wall; the car inside nose-out
function garage(B, P, x0, x1, z0, z1, h, wall, cars) {
  B.box(x0, 0, z0, x1, .1, z1, NIGHT() ? [0xfff4dc, 3] : 0xe9e6df);
  B.box(x0, 0, z0, x0 + .3, h, z1, wall); B.box(x1 - .3, 0, z0, x1, h, z1, wall); B.box(x0, 0, z1 - .3, x1, h, z1, wall);
  B.box(x0, h - .35, z0, x1, h, z1, wall); B.box(x0 + .5, h - .45, z0 + .6, x1 - .5, h - .35, z1 - .6, NIGHT() ? [0xfff2d6, 3] : C.chalk);
  B.box(x0 + .3, .1, z1 - .5, x1 - .3, 2.6, z1 - .3, (x, y, z, i, j) => j % 6 === 0 ? C.pale : C.white);
  const bw = (x1 - x0) / cars.length;
  for (let b = 1; b < cars.length; b++) B.box(x0 + b * bw - .07, 0, z0, x0 + b * bw + .07, h, z0 + .15, C.ink);
  cars.forEach((c, b) => P.cars.push({ ...c, x: x0 + (b + .5) * bw, z: (z0 + z1) / 2 + .1, ry: Math.PI }));
  P.panes.push([x0 + .3, .1, z0 + .05, x1 - .3, h - .35, z0 + .12]); P.lights.push([(x0 + x1) / 2, h - .8, (z0 + z1) / 2]);
}
function totem(B, x, z) { B.box(x - .7, 0, z - .7, x + .7, .3, z + .7, C.granite, 1); [[.9, C.red, .1], [.75, C.sign, -.12], [.6, C.blue, .08], [.45, C.chalk, 0]].reduce((y, [s, c, o]) => { B.box(x - s / 2 + o, y, z - s / 2, x + s / 2 + o, y + s, z + s / 2, c, 1); return y + s; }, .3); }
function ring(B, x, z, col) { B.box(x - .9, 0, z - .5, x + .9, .3, z + .5, C.granite, 1); B.box(x - 2, .3, z - .2, x + 2, 4.1, z + .2, (xx, y) => Math.abs(Math.hypot(xx - x, y - 2.1) - 1.6) < .24 ? col : undefined, 1); }

// o: { wall, accent, car: { id, v }, seed } → { bank (B frame), panes, lights, stand: people spots } — all in B's frame
const HOMES = {
  slab(B, P, o) {   // white (or the lot's wall), one storey, the roof slab running over a glass garage; a breeze-block screen, a bright door
    const wall = o.wall ?? C.white, acc = o.accent ?? C.orange;
    if (!o.noGarage) garage(B, P, -8.6, -3.6, 5, 12.6, 3.2, wall, [o.car ?? { id: 'supercar', v: 0 }]);   // (the house kit can leave the garage off: a narrow lot)
    B.box(-3.6, 0, 6, 8.2, 3.2, 15.6, wall);
    curtain(B, 1.0, 8.0, .1, 3.0, 6, true); door(B, -1.6, 6, acc);
    roof(B, o.noGarage ? -4.2 : -9.2, 4.2, 9.0, 16.8, 3.2, .35);
    breezeX(B, -3.4, 1.4, 3.4, 2.5, acc);
    pool(B, -2.4, 18.4, 6.6, 21.4);
    totem(B, 6.4, 2.6); planterRow(B, 1.8, 7.8, 4.2);
    P.stamps.push([tree('birch', 1, 1), 7.6, 0, 1.2], [lawnChair(acc), 1.2, .3, 16.6, 0], [lawnChair(acc), 3.0, .3, 16.6, 0], [umbrella(acc), 5.2, .3, 16.6, 0]);
    P.stand.push([-6.0, 3.0, 0]);
  },
  butterfly(B, P, o) {   // a butterfly roof over clerestory glass, a white breeze planter wall; the lowrider in the glass garage
    const wall = o.wall ?? C.teal, acc = o.accent ?? C.sign;
    if (!o.noGarage) { garage(B, P, -9.4, -4.6, 4.8, 12.2, 3.0, wall, [o.car ?? { id: 'lowrider', v: 1 }]); roof(B, -9.8, 4.4, -4.6, 12.6, 3.0, .3); }
    B.box(-4.6, 0, 6, 8.8, 2.8, 14.6, wall);
    curtain(B, 2.4, 8.2, .1, 2.7, 6, true); door(B, 0, 6, acc);
    const yt = x => 2.95 + Math.abs(x - 2.1) * .15;
    B.box(-5.4, 2.8, 5.0, 9.6, 4.4, 15.4, (x, y, z, i, j, k) => { const t = yt(x); if (y >= t || y < t - .3) return; return (y > t - .1 && x > -5.1 && x < 9.3 && z > 5.3 && z < 15.1) ? (H(i, k, 3) > .93 ? C.grey : C.pale) : C.chalk; });
    for (const zf of [6, 14.4]) B.box(-4.6, 2.8, zf, 8.8, 4.4, zf + .2, (x, y, z, i, j, k) => y < yt(x) - .3 ? (i % 12 === 0 ? C.chalk : glassF(true, 2.8, 4.2)(x, y, z, i, j, k)) : undefined);
    breezeX(B, -4.2, 1.6, 3.6, 1.4, C.white); planterRow(B, -4, 1.4, 2.6);
    pool(B, -3, 17.2, 6.6, 20.8);
    ring(B, 6.6, 2.4, acc === C.sign ? C.red : acc);
    P.stamps.push([tree('redmaple', 1, 2), 8.4, 0, 3.0], [lawnChair(wall), -1, .3, 15.4, 0], [lawnChair(wall), .8, .3, 15.4, 0], [umbrella(acc), 4.4, .3, 15.4, 0]);
    P.stand.push([6.2, 4.4, -2.6]);
  },
};
export const MODERN = Object.keys(HOMES);
export function buildModern(kind, o = {}) {
  const B = new Box(-10.2, 0, -.2, 10.2, 5.0, 22.8, .1), P = { stamps: [], cars: [], panes: [], lights: [], stand: [] };
  HOMES[kind](B, P, o);
  const bank = meshed(B.V);
  for (const [b, x, y, z, r] of P.stamps) stamp(b, bank, r | 0, x, y, z);
  for (const c of P.cars) { const t = vehicleProp(c.id, { variant: c.v | 0, kind: 'car', night: TOD.night }); stamp(t, bank, 2, c.x, .1, c.z); }   // nose toward the street (B's −z)
  return { bank, panes: P.panes, lights: P.lights, stand: P.stand };
}
