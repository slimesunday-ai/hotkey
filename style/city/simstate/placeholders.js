// Pass 2 · PLACEHOLDERS for the sim-state pieces. The real pieces are modeled by the ASSETS agent in city/simassets/index.js (a
// separate library with its own preview page); layer.js loads that module in isolation and falls back to these plain boxes when it
// is missing or fails, so either can land first. The same interface and conventions as simassets/index.js: every function returns a
// meshed template (or a Vol) facing +z; ground pieces anchor at their base centre, facade pieces at the bottom centre of their opening
// on the wall's outer plane; parametric sizes (w, h, width) are in CITY VOXELS (0.1 m), e.g. a window 13 × 17, a door 14 × 24.
import { Vol, meshed } from '../vox.js';
import { PAL } from '../style.js';
import { TOD } from '../kit.js';
import { copCar } from '../props.js';

const memo = new Map(), M = (k, f) => { k += '|' + TOD.night; let b = memo.get(k); if (!b) memo.set(k, b = f()); return b; };
// a volume spanning x ±w/2, y 0…h, z ±d/2 (metres) at voxel size s; add() paints a box in metres inside it
const vol = (w, h, d, s = .05) => new Vol(Math.max(1, Math.round(w / s)), Math.max(1, Math.round(h / s)), Math.max(1, Math.round(d / s)), { s, org: [-w / 2, 0, -d / 2], ground: true });
const add = (V, x0, y0, z0, x1, y1, z1, c, l = 0) => { const s = V.s, o = V.org; V.box(Math.round((x0 - o[0]) / s), Math.round((y0 - o[1]) / s), Math.round((z0 - o[2]) / s), Math.max(Math.round((x0 - o[0]) / s) + 1, Math.round((x1 - o[0]) / s)), Math.max(Math.round((y0 - o[1]) / s) + 1, Math.round((y1 - o[1]) / s)), Math.max(Math.round((z0 - o[2]) / s) + 1, Math.round((z1 - o[2]) / s)), c, l); return V; };
const box = (w, h, d, c, l = 0) => add(vol(w, h, d), -w / 2, 0, -d / 2, w / 2, h, d / 2, c, l);
const done = (V, kind) => Object.assign(meshed(V), { kind, placeholder: true });
const lit = () => TOD.night ? 3 : 1;

export const SIZES = {
  forRentSign: { lawn: { w: .8, d: .1, h: 1.4, anchor: 'ground' }, window: { w: .9, d: .02, h: .45, anchor: 'window' }, lobby: { w: .7, d: .5, h: 1.0, anchor: 'ground' } },
  pile: { w: 3.2, d: 3.2, h: [.3, 2.2], anchor: 'ground' },
  security: { lock: { w: .16, h: .26, d: .05, anchor: 'door' }, door: { w: 1.3, h: 2.5, d: .05, anchor: 'door' }, safe: { w: .5, h: .5, d: .05, anchor: 'window' }, gate: { w: 1.2, h: 1.0, d: .1, anchor: 'ground' },
    buzzer: { w: .2, h: .35, d: .05, anchor: 'door' }, camera: { w: .3, h: .25, d: .35, anchor: 'wall' } },
  doormanLobby: { d: 1.8, h: 2.9, anchor: 'door' },
  scar: { burned: { anchor: 'window' }, boarded: { anchor: 'window' }, foreclosed: { w: .5, h: .6, d: .04, anchor: 'door' }, crimeScene: { d: .1, h: 1.1, anchor: 'ground' }, memorial: { w: .8, d: .5, h: .6, anchor: 'ground' } },
  windowCard: { w: .9, h: .45, d: .02, anchor: 'window' },
  hotspot: { w: 6.8, d: 6.8, h: .02, anchor: 'road' },
  patrolCar: { w: 1.8, d: 4.4, h: 2.3, anchor: 'road' },
};

export const forRentSign = ({ style = 'lawn' } = {}) => M('rent' + style, () => {
  if (style === 'window') return done(add(box(.9, .45, .02, PAL.white), -.4, .15, -.01, .4, .3, .01, 0xe8232a), 'for-rent-card');
  if (style === 'lobby') return done(add(add(vol(.7, 1.0, .5), -.35, 0, -.25, .35, 1.0, .2, 0xe8232a), -.3, .4, .2, .3, .8, .25, PAL.white), 'for-rent-board');
  const V = vol(.8, 1.4, .1); add(V, -.04, 0, -.04, .04, 1.0, .04, PAL.iron); add(V, -.4, .8, -.05, .4, 1.4, .03, 0xe8232a); add(V, -.3, 1.0, .03, .3, 1.2, .05, PAL.white); return done(V, 'for-rent-sign'); });
export const pile = (kind = 'scrap', level = .5) => { const n = Math.max(1, Math.min(8, Math.round(1 + level * 7))); return M('pile' + kind + n, () => {
  const c = { scrap: 0x8a4a2a, salts: 0xf7f7f2, goo: 0x25b84c, leaf: 0x2fbf55, cloth: 0xff4fa3 }[kind] ?? 0x9a9aa6, V = vol(3.2, 2.2, 3.2);
  for (let k = 0; k < n; k++) { const r = 1.55 - k * .17, y = k * .27; add(V, -r, y, -r, r, y + .27, r, k % 2 ? c : 0x6f727b); } return done(V, 'pile-' + kind); }); };
export const security = (kind, o = {}) => M('sec' + kind + (o.w ?? '') + 'x' + (o.h ?? '') + (o.style ?? ''), () => {
  const S0 = SIZES.security[kind] || SIZES.security.lock, S = (kind === 'door' || kind === 'lock' || kind === 'gate') && o.w ? { ...S0, w: kind === 'lock' ? .16 : o.w / 10, h: kind === 'lock' ? .26 : o.h / 10 } : S0;
  const c = { lock: PAL.gold, door: 0x5b5d63, safe: 0x5b5d63, gate: PAL.iron, buzzer: PAL.gold, camera: PAL.white }[kind] ?? 0x9a9aa6, V = vol(S.w, S.h, (S.d ?? .05) + .04);
  add(V, -S.w / 2, 0, -(S.d ?? .05) / 2, S.w / 2, S.h, (S.d ?? .05) / 2, c, kind === 'door' || kind === 'safe' ? 2 : 0);
  if (kind === 'camera' || kind === 'buzzer') add(V, -.04, S.h * .45, (S.d ?? .05) / 2, .04, S.h * .7, (S.d ?? .05) / 2 + .04, kind === 'camera' ? 0xe8232a : 0x2de2e6, lit());
  if (kind === 'gate') add(V, -S.w / 2 + .1, .1, -.05, S.w / 2 - .1, S.h - .1, .05, 0xffe23a);   // (a yellow plate: the dog's sign)
  return done(V, 'security-' + kind); });
export const doormanLobby = ({ width = 56 } = {}) => M('lobby' + width, () => { const w = Math.max(4, width / 10), V = vol(w, 2.9, 3.6, .1);
  add(V, -w / 2, 2.6, 0, w / 2, 2.8, 1.8, 0xe8232a); for (const x of [-w / 2 + .05, w / 2 - .15]) add(V, x, 0, 1.65, x + .1, 2.6, 1.75, PAL.gold); add(V, -.3, 0, .6, .3, 1.1, 1.0, PAL.ink); return done(V, 'doorman-lobby'); });
export const scar = (kind, { w: wv = 13, h: hv = 17, door = false } = {}) => M('scar' + kind + wv + 'x' + hv + door, () => { const w = wv / 10, h = hv / 10;
  if (kind === 'boarded') return done(box(w + .1, h + .1, .04, 0xc9a36b), 'scar-boarded');
  if (kind === 'burned') { const V = vol(w, h + .6, .04); add(V, -w / 2, 0, -.02, w / 2, h, .02, 0x121216); add(V, -w / 3, h, -.02, w / 3, h + .6, .02, 0x2a2a30); return done(V, 'scar-burned'); }
  if (kind === 'foreclosed') return done(add(box(.5, .6, .04, PAL.white), -.25, .42, .02, .25, .52, .02, 0xe8232a), 'scar-foreclosed');
  if (kind === 'crimeScene') { const V = vol(Math.max(1, w), 1.1, .1, .1); add(V, -w / 2, 0, -.05, -w / 2 + .1, 1.1, .05, PAL.iron); add(V, w / 2 - .1, 0, -.05, w / 2, 1.1, .05, PAL.iron); add(V, -w / 2, .85, -.05, w / 2, 1.0, .05, 0xffe23a); return done(V, 'scar-crime'); }
  const V = vol(.8, .6, .5); add(V, -.4, 0, -.25, .4, .3, .25, 0xffe23a); add(V, -.1, .3, -.05, .1, .6, .05, PAL.white); return done(V, 'scar-memorial'); });
export const windowCard = (kind, { w = 13, h = 17 } = {}) => M('card' + kind + w + 'x' + h, () => kind === 'curtain' ? done(box(w / 10, h / 10, .02, 0xff4fa3), 'card-curtain')
  : kind === 'zzz' ? done(add(box(.6, .4, .02, 0x2f5bff), -.2, .15, -.01, .2, .25, .01, PAL.white), 'card-zzz') : done(add(box(.9, .45, .02, PAL.white), -.4, .15, -.01, .4, .3, .01, 0xe8232a), 'card-for-rent'));
export const hotspot = ({ heat = .5 } = {}) => { const k = heat > .62 ? 2 : heat > .3 ? 1 : 0; return M('hot' + k, () => { const c = [0xf7f7f2, 0xffc21a, 0xff2d6f][k], V = vol(6.8, .1, 6.8, .1);
  add(V, -3.4, 0, -3.4, 3.4, .1, 3.4, c, k === 2 ? lit() : 0); add(V, -1.2, 0, -1.2, 1.2, .1, 1.2, PAL.ink); return done(V, 'hotspot'); }); };   // a filled square, readable from overhead
export const patrolCar = ({ lights = TOD.night } = {}) => copCar();   // the city's own cop car stands in until simassets lands
