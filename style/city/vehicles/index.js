// CARS pass (2026-09-28) · THE FLEET REGISTRY. Worker-safe (no three): props.js, street.js and the build workers import it; the
// main-thread helpers (BufferGeometries, ready meshes) are in vehicles/three.js.
//
// VEHICLES: [{ id, kind, name, dims: { w, h, l } (m), wheels: [{ x, y, z, r }] (m, from the base centre, facing +z), wheel (style),
//   mix: { district: weight }, build(V, { variant, lights, driver, night }), far(V), vol(), variants }]
// - a body Vol comes from spec.vol(); build() draws the body into it (0.1 m voxels, base centre at the origin, facing +z, the left is +x).
// - wheels are SEPARATE parts: wheelVol(spec) is a round voxel wheel at 0.05 m (a rasterised cylinder on the x axis: tyre, rim, a spoke /
//   hubcap pattern on both faces, so rotation reads), centred on its axle. Spin it about x by +distance / r when the car moves forward (+z).
// - brake lights are their own part (brakeVol): lit red plates just behind the tail lamps; show them to brake.
// - vehicleParts(id, o) → { spec, body, wheel, brake, far } Banks; vehicleTiers(id, o) → the same packed (lod.js packMerged, cm) for
//   gpu.js geometryOf — draw with mats.tier at scale 0.01, one body instance + one wheel instance per spec.wheels entry.
// - vehicleProp(id, o) → a stampable template (body + wheels baked, one piece) for parked cars and every prop that calls car()/taxi()/…
// - the district mix: pickVehicle(district, u) · mixAt(x, z) · PARK (the parking density per district). Parking lanes: parkOff / travelOff.
import { Vol, meshed, stamp, textMask } from '../vox.js';
import { CV, PAL } from '../style.js';
import { packMerged } from '../lod.js';
import { isOneWay, oneWayDir } from '../traffic/rules.js';
import { isAve } from '../plan.js';
import * as M from './models.js';

const WG = .05;   // the wheels' grain: half a city cube, so a 0.8 m wheel is a 16-voxel disc (round, not a square)
const W18 = { tire: 0x1b1b20, tread: 0x2a2a31 };
// wheel styles: r (m), tw (tyre width m), rim, cap (centre cap), spokes (n; 0 = a plain dish), hole (the gaps between spokes), wall (a whitewall ring)
// radii are whole multiples of the 0.05 grain, so a wheel's rim touches y = 0 exactly (a 0.38 wheel rasterised to 0.40 and sank 2 cm)
const WH = {
  alloy: { r: .4, tw: .25, rim: 0xc9ced6, cap: 0x8a8f99, spokes: 5, hole: 0x2a2a30 },
  steel: { r: .4, tw: .25, rim: 0x3a3a42, cap: 0xc9ced6, spokes: 4, hole: 0x1f1f25 },
  chrome: { r: .4, tw: .25, rim: 0xe6e8ee, cap: 0x17171b, spokes: 6, hole: 0x2a2a30 },
  wire: { r: .35, tw: .22, rim: PAL.gold, cap: 0xf7f7f2, spokes: 12, hole: 0x6a5220, wall: 0xf7f7f2, knock: true },
  beat: { r: .35, tw: .24, rim: 0x55555f, cap: 0x9a9aa6, spokes: 4, hole: 0x1f1f25 },
  truck: { r: .45, tw: .28, rim: 0xc9ced6, cap: 0xe8232a, spokes: 8, hole: 0x2a2a30 },
  race: { r: .4, tw: .26, rim: 0x17171b, cap: 0xffc21a, spokes: 5, hole: 0x3a3a42, thin: true },
  bus: { r: .5, tw: .3, rim: 0xc9ced6, cap: 0x2f5bff, spokes: 8, hole: 0x2a2a30 },
};
const axles = (L, wz, r, tw, W = 18) => { const x = W * CV / 2 - .05 - tw / 2, z0 = L * CV / 2; return wz.flatMap(z => [-x, x].map(xx => ({ x: +xx.toFixed(3), y: r, z: +(z * CV - z0).toFixed(3), r }))); };
function def(id, kind, name, L, H, wz, wheel, mix, build, extra = {}) {
  const W = extra.W ?? 18, wh = WH[wheel];
  return { id, kind, name, dims: { w: W * CV, h: H * CV, l: L * CV }, wheels: axles(L, wz, wh.r, wh.tw, W), wheel: { style: wheel, ...wh }, mix, variants: extra.variants ?? 6,
    L, H, W, wz, build, vol() { return new Vol(W + 2, H, L, { s: CV, org: [-(W + 2) * CV / 2, 0, -L * CV / 2], ground: true }); },
    farVol() { return new Vol(Math.ceil(W / 2) + 1, Math.ceil(H / 2), Math.ceil(L / 2), { s: CV * 2, org: [-(Math.ceil(W / 2) + 1) * CV, 0, -Math.ceil(L / 2) * CV], ground: true }); },
    far(V) { return farOf(this, V); }, ...extra };
}
// the far tier (0.2 m): the body colour block, the glass band, the roof, four dark wheels — for the traffic agent's distant cars
function farOf(spec, V) {
  const src = spec.vol(); spec.build(src, { variant: 0 }); const hist = new Map(); for (let k = 0; k < src.d.length; k++) { const v = src.d[k]; if (v) hist.set(v, (hist.get(v) || 0) + 1); }
  const main = src.pal[[...hist].sort((a, b) => b[1] - a[1])[0][0]], nx = V.nx, nz = V.nz, top = Math.ceil(spec.H / 2);
  V.box(0, 1, 0, nx, Math.min(top, 5), nz, main); if (top > 5) { V.box(0, 5, 1, nx, top - 1, nz - 2, M.C.glass, 1); V.box(0, top - 1, 1, nx, top, nz - 2, main); }
  for (const w of spec.wheels) { const x = Math.floor((w.x - V.org[0]) / V.s), z = Math.floor((w.z - V.org[2]) / V.s); V.box(x, 0, z - 1, x + 1, 2, z + 1, W18.tire); }
  return V;
}

// ── the fleet. mix weights by district (the kit names: downtown, strip, suburbs, estates, trailer = Sunny Acres, industrial = the Yards,
// docks, junkyard, mall, hospital, highway, jail) plus `precinct` (near Precinct 9)
export const VEHICLES = [
  def('sedan', 'car', 'Kubo Pixel', 42, 21, [8, 34], 'alloy', { downtown: 3, strip: 2, suburbs: 5, estates: 1, industrial: 2, docks: 1, trailer: 1, hospital: 3, mall: 1, highway: 3, junkyard: 1, precinct: 2 }, M.sedan, { variants: 10 }),
  def('taxi', 'taxi', 'Kubo Pixel Cab', 42, 29, [8, 34], 'steel', { downtown: 5, strip: 4, hospital: 3, highway: .5, suburbs: .2, precinct: 1 }, M.taxi, { variants: 9 }),
  def('livery', 'car', 'Sable Regent (livery)', 46, 20, [9, 37], 'chrome', { downtown: 4, strip: 2, estates: 3, hospital: 1, precinct: .5 }, M.livery, { variants: 4 }),
  def('van', 'van', 'Qwik Kargo bodega van', 44, 24, [8, 36], 'steel', { downtown: 2, strip: 2, industrial: 4, docks: 3, suburbs: .5, mall: .5, junkyard: 1 }, M.van, { variants: 16 }),
  def('boxtruck', 'truck', 'Haulr box truck', 66, 31, [12, 57], 'truck', { downtown: .6, industrial: 5, docks: 5, mall: .5, highway: 2, junkyard: 1 }, M.boxTruck, { variants: 4 }),
  def('pickup', 'car', 'Ramrod pickup', 48, 22, [9, 38], 'steel', { trailer: 5, suburbs: 2, industrial: 3, docks: 2, junkyard: 3, highway: 2, mall: 1, downtown: .3 }, M.pickup, { variants: 6 }),
  def('lowrider', 'car', 'Bajito Deville lowrider', 50, 15, [9, 40], 'wire', { trailer: 1.5, strip: 2, downtown: .6, suburbs: .8, mall: 1 }, M.lowrider, { variants: 5 }),
  def('beater', 'car', 'Kubo Nubbin (beater)', 36, 21, [7, 29], 'beat', { trailer: 5, industrial: 2, mall: 3, junkyard: 4, docks: 2, suburbs: 1.2, downtown: 1, strip: 1 }, M.beater, { variants: 6 }),
  def('cruiser', 'copcar', 'P9 Interceptor', 44, 23, [8, 36], 'steel', { precinct: 12, downtown: .25, jail: 3, hospital: .5, strip: .3 }, M.cruiser, { variants: 4 }),
  def('icecream', 'truck', 'Kool Kone ice cream truck', 50, 40, [9, 42], 'chrome', { suburbs: .8, downtown: .3, strip: .2, trailer: .4 }, M.icecream, { variants: 4 }),
  def('supercar', 'car', 'Vanta Stiletto', 44, 13, [9, 34], 'race', { estates: 6, strip: .6, downtown: .25 }, M.supercar, { variants: 6 }),
  def('bus', 'bus', 'Metro 9 city bus', 80, 30, [16, 64], 'bus', {}, M.bus, { W: 20, variants: 1 }),   // (BUS RETIME 2026-10-09: 8 m, was 110 · [18, 92])
];
export const byId = Object.fromEntries(VEHICLES.map(v => [v.id, v]));
const spec = id => { const s = byId[id]; if (!s) throw new Error('vehicles: no model ' + id); return s; };

// ── parts
export function bodyVol(id, o = {}) { const s = spec(id), V = s.vol(); s.build(V, { variant: 0, lights: false, driver: false, night: false, ...o }); return V; }
// side: 0 = both faces patterned (the traffic agent's spinning wheel); −1 / +1 = only the face toward −x / +x (the outer face of a parked
// car's left / right wheel: the inner face is a flat disc, about half the triangles)
export function wheelVol(id, side = 0) {
  const w = spec(id).wheel, R = Math.round(w.r / WG), nx = Math.round(w.tw / WG), D = R * 2, V = new Vol(nx, D, D, { s: WG, org: [-nx * WG / 2, -R * WG, -R * WG], ground: false });
  const rimR = R - (w.thin ? 2 : 3), n = w.spokes, outs = side === 0 ? [0, nx - 1] : [side < 0 ? 0 : nx - 1], inner = side === 0 ? null : side < 0 ? nx - 1 : 0;
  for (let y = 0; y < D; y++) for (let z = 0; z < D; z++) { const dy = y + .5 - R, dz = z + .5 - R, d = Math.hypot(dy, dz); if (d > R) continue; const a = Math.atan2(dz, dy);
    if (d > rimR) { V.box(0, y, z, nx, y + 1, z + 1, W18.tire); if (w.wall && d <= rimR + 1.2) for (const x of outs) V.set(x, y, z, w.wall); continue; }
    const f = ((a / (Math.PI * 2 / n)) % 1 + 1) % 1, spoke = Math.abs(f - .5) > .5 - (n > 8 ? .18 : .22), hub = d <= 2.2, lip = d > rimR - 1;
    const c = hub ? w.cap : lip ? w.rim : spoke ? w.rim : w.hole, l = hub || lip || spoke ? 2 : 0;
    V.box(side < 0 ? 1 : 0, y, z, side > 0 ? nx - 1 : nx, y + 1, z + 1, W18.tire);                 // the tyre's core (the inner face stays flat)
    for (const x of outs) V.del(x, y, z); V.box(side < 0 ? 1 : side > 0 ? nx - 2 : 1, y, z, side < 0 ? 2 : side > 0 ? nx - 1 : nx - 1, y + 1, z + 1, c, l);   // the dish, recessed one voxel
    if (hub || (w.knock && d <= 3.2 && Math.abs(dy) < .8)) for (const x of outs) V.set(x, y, z, w.cap, 2); }   // the centre cap (and the lowrider's knock-off bar), proud
  if (inner !== null) for (let y = 0; y < D; y++) for (let z = 0; z < D; z++) if (V.has(inner, y, z)) V.set(inner, y, z, W18.tire);
  return V;
}
// brake lamps: a 0.05 m plate just behind each tail lamp (lit red): the traffic agent shows it while braking
export function brakeVol(id, o = {}) {
  const s = spec(id), body = bodyVol(id, o), tails = body.meta?.tails || []; if (!tails.length) return null;
  const zb = tails[0][4], V = new Vol((s.W + 2) * 2, s.H * 2, 1, { s: WG, org: [body.org[0], 0, body.org[2] + zb * CV - WG], ground: false });
  for (const [x0, y0, x1, y1] of tails) V.box(x0 * 2, y0 * 2, 0, x1 * 2, y1 * 2, 1, 0xff2a2a, 3);
  return V;
}
// the composite used for stamping (and the audit / the mid tier): body + coarse 0.1 wheels + an axle stub, so it is one piece
function compositeVol(id, body) {
  const s = spec(id), V = s.vol(); V.d.set(body.d); V.pal = body.pal.slice(); V.lay = body.lay.slice(); V.pm = new Map(body.pm); V.meta = body.meta;
  const rv = s.wheel.r / CV;
  for (const z0 of s.wz) for (const [xa, xb, stub] of [[2, 4, 4], [s.W - 2, s.W, s.W - 3]]) {
    for (let y = 0; y < rv * 2; y++) for (let z = Math.floor(z0 - rv); z <= z0 + rv; z++) { const d = Math.hypot(y + .5 - rv, z + .5 - z0); if (d <= rv) V.box(xa, y, z, xb, y + 1, z + 1, d > rv - 1.2 ? W18.tire : s.wheel.rim); }
    V.box(stub, Math.floor(rv) - 1, Math.floor(z0) - 1, stub + 1, Math.floor(rv) + 1, Math.floor(z0) + 1, 0x2a2a30); }
  return V;
}
// fine lettering (0.05 m, like small signs): a model pushes { text, c, x, y, zf, zb } onto V.fine (x: the centre, y: the top, zf / zb: the
// front / back face in body voxels); the letters stand 0.05 m proud of both faces, readable from the front and from behind
function fineBanks(body) {
  const out = []; for (const f of body.fine || []) { const t = textMask(f.text), w = t.w, S = CV;
    for (const [z, dir] of [[f.zf, 1], [f.zb, -1]]) { const V = new Vol(w, 7, 1, { s: WG, org: [0, 0, 0], ground: false });
      for (let j = 0; j < 7; j++) for (let i = 0; i < w; i++) if (t.at(i, j)) V.set(dir > 0 ? i : w - 1 - i, 6 - j, 0, f.c);
      V.org = [body.org[0] + f.x * S - w * WG / 2, f.y * S - 7 * WG, body.org[2] + z * S + (dir > 0 ? 0 : -WG)]; out.push(meshed(V)); } }
  return out;
}
const bodyBank = body => { const b = meshed(body); for (const f of fineBanks(body)) stamp(f, b, 0, 0, 0, 0); return b; };
const MEMO = new Map(), memo = (k, f) => { let v = MEMO.get(k); if (v === undefined) MEMO.set(k, v = f()); return v; };
const okey = (id, o) => `${id}|${o.variant | 0}|${o.lights ? 1 : 0}|${o.driver ? 1 : 0}|${o.night ? 1 : 0}`;
export const wheelBank = (id, side = 0) => memo('w|' + id + '|' + side, () => meshed(wheelVol(id, side)));
// a stampable template: the near mesh is the body plus the round 0.05 wheels; the voxels the audit and the mid tier read are the body
// with coarse wheels (compositeVol), so the template is one connected piece and its mid tier has wheels
export function vehicleProp(id, o = {}) {
  return memo('p|' + okey(id, o) + '|' + (o.kind || ''), () => {
    const s = spec(id), body = bodyVol(id, o), t = meshed(body); t.vol = compositeVol(id, body); for (const f of fineBanks(body)) stamp(f, t, 0, 0, 0, 0); t.mid = undefined; t.far = undefined; t._bb = undefined;
    for (const w of s.wheels) stamp(wheelBank(id, w.x < 0 ? -1 : 1), t, 0, w.x, w.y, w.z);
    t.kind = o.kind || s.kind; t.vehicle = { id, variant: o.variant | 0 }; return t; });
}
export function vehicleParts(id, o = {}) {
  return memo('parts|' + okey(id, o), () => { const s = spec(id), body = bodyVol(id, o), br = brakeVol(id, o), fv = s.farVol(); s.far(fv);
    return { spec: s, body: bodyBank(body), wheel: wheelBank(id), brake: br ? meshed(br) : null, far: meshed(fv) }; });
}
export function vehicleTiers(id, o = {}) {
  const p = vehicleParts(id, o), z = [0, 0, 0];
  return { spec: p.spec, body: packMerged(p.body, z), wheel: packMerged(p.wheel, z), brake: p.brake ? packMerged(p.brake, z) : null, far: packMerged(p.far, z) };
}

// ── the district mix
export const PRECINCT = { x: 48, z: -16, r: 56 };   // Precinct 9 (plan.js PLACES 'police')
export const PARK = { downtown: .72, strip: .68, hospital: .55, suburbs: .42, estates: .34, industrial: .5, docks: .45, trailer: .5, mall: .3, junkyard: .4, highway: .25, jail: 0, forest: 0, sea: 0 };
export function mixOf(district, x = null, z = null) {
  const near = x !== null && Math.hypot(x - PRECINCT.x, z - PRECINCT.z) < PRECINCT.r;
  return VEHICLES.map(v => [v, (v.mix[district] || 0) + (near ? v.mix.precinct || 0 : 0)]).filter(([, w]) => w > 0);
}
// u in [0, 1) → a model id, by weight
export function pickVehicle(district, u, x = null, z = null) {
  const m = mixOf(district, x, z); if (!m.length) return null; const tot = m.reduce((s, [, w]) => s + w, 0); let a = u * tot;
  for (const [v, w] of m) { if ((a -= w) < 0) return v.id; } return m[m.length - 1][0].id;
}

// ── parking lanes (read from traffic/rules.js; the cars pass's convention, documented in PASS-cars.md)
// a one-way side street (half-width 2) parks on the RIGHT kerb of its direction of travel and drives in the other lane; an avenue
// (half-width 4) parks in both kerb lanes (±3) and drives in the inner lanes (±1); Route 9 has no kerb parking.
// Offsets are across the road from its centre line: +x for an x-line (N–S), +z for a z-line (E–W).
// TRANSIT SYNC (2026-10-08): a parked car's centre is PARK_IN m in from its kerb (was 1: 0.1 m off the kerb, 0.2 m off the cars passing it,
// which read as driving through it — 3rd St's red car through the orange one); a one-way's travel lane moved out the same way (traffic/sim.js
// ONEWAY_LANE −1.12), so a passing car clears a parked one by 0.44 m, and an avenue's by 0.32 m
export const PARK_IN = .88;
export const parkOff = (axis, L, hw) => isAve(axis, L) ? null : isOneWay(axis, L) ? (axis === 'x' ? -oneWayDir(axis, L) : oneWayDir(axis, L)) * (hw - PARK_IN) : null;
export const travelOff = (axis, L, hw) => isOneWay(axis, L) ? -parkOff(axis, L, hw) : null;
// the quarter turn (stamp rotQ) of a car driving or parked along a road: facing +z = 0, +x = 1, −z = 2, −x = 3
export const rotAlong = (axis, sgn) => axis === 'x' ? (sgn > 0 ? 0 : 2) : (sgn > 0 ? 1 : 3);
// the direction of travel of the lane at offset `off` on a two-way road (right-hand traffic)
export const laneDir = (axis, off) => axis === 'x' ? (off > 0 ? -1 : 1) : (off > 0 ? 1 : -1);
