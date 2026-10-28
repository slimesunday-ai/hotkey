// The building generator (pass 1b): block interior (from the plan) → lots → typed specs → voxels. Every choice is a rule over
// (block kind, lot shape, street type, neighbours, seed). Axes vary independently — type × storeys × colour × windows × cornice ×
// ground floor × sign kind × wall paint × roof scene — and neighbours never share colour, storeys, window style or cornice.
import { Vol, Bank, meshVol, stamp, textMask, tempBank } from './vox.js';
import { bankBox } from './audit.js';
import { frame, win, bays, mass, stoop, fireEscape, AIR, TOD, glass } from './kit.js';
import { PAL, CV, SIDE, hash, shade, rng } from './style.js';
import { windowRow, cornice, shopRun, resiEntry, mural, ghostSign, paintedAd, pipes, fitText, nameOrNo, textW, inkOn, MURALS } from './facade.js';
import { planRoof, paintRoof, stampRoof, roofColor, copingColor } from './roofs.js';
import { giantObject, billboard, car, bike, trashCan, planterBox, sandwich, barberPole, newsBox, potPlant, bags, cart, couch, carOnBlocks, milkCrate, acBox } from './props.js';
import { yards } from './yards.js';
import { chooseSetPieces, buildSetPiece, calmLot } from './setpieces.js';
import { REG, WALK } from './audit.js';
import { overrideFor, ModuleError } from './modules.js';
import { FALLBACK } from './districts/api.js';
import { neutralMix } from './neutral.js';
import { transitLots, stationFront, globeLamp, stairwell, STAIR } from './transit.js';
import { SIM_PLACES } from './simplaces.js';
import { slab } from './ground.js';
import { swX, swZ, P as PITCH } from './plan.js';   // (SPREAD: a street's sidewalk width)
import { unshift } from '../../world/city.js';   // (SPREAD pins: a person's look seed reads today's position)
import { shopRoom, shopFitout, meshFitouts } from './interiors/store/fill.js';   // fit-out pass: a stocked room behind every main-face shop's glass
import { vigTower } from './heroes/vig-tower.js';   // LOOK round (2026-10-06): THE VIG, the supertall on block −1,−2's tower lot

// pass 2 · the shared generator reads every district rule from the CURRENT KIT (districts/<name>.js, set per block by jobs.js):
// grammar (types, storeys, windows, cornices, signs, lots, set pieces, one-offs, life), palette (walls, awnings, the neutral mix)
// and lexicon (the sign voice). Heroes that call specify()/buildLot() for their generated lots get their block's kit too.
export const GEN = { kit: null, override: undefined, flags: { neutral: true, pass2: true } };
export const kitNow = () => GEN.kit || FALLBACK;

// ───────────────────────── lots
function split(L, r, lo = 5, hi = 9) { const out = []; let rem = L, prev = 0, guard = 0;
  while (rem > 0 && guard++ < 50) { if (rem <= hi) { out.push(rem); break; } let w = lo + Math.floor(r() * (hi - lo + 1)); if (w === prev) w = w === hi ? w - 1 : w + 1; if (rem - w < lo) w = rem - lo; out.push(w); rem -= w; prev = w; }
  return out; }
export function subdivide(b, r, towerCorner = null) {
  const { R } = b, F = b.F, X0 = R.x0, X1 = R.x1, Z0 = R.z0, Z1 = R.z1, lots = [], LG = kitNow().grammar.lots, [c0, cn] = LG.corner, T = LG.tower, [w0, w1] = LG.row, DMAX = LG.depth;
  const cs = {}; for (const c of ['NW', 'NE', 'SW', 'SE']) cs[c] = c === towerCorner ? [T, T] : [c0 + Math.floor(r() * cn), c0 + Math.floor(r() * cn)];
  // pass 1d: opposite corners never overlap (a 14 m tower corner on a 20 m deep block used to share 1–3 m with the corner across)
  for (const [p, q, k, len] of [['NW', 'SW', 1, Z1 - Z0], ['NE', 'SE', 1, Z1 - Z0], ['NW', 'NE', 0, X1 - X0], ['SW', 'SE', 0, X1 - X0]]) if (cs[p][k] + cs[q][k] > len) { const t = p === towerCorner ? q : p; cs[t][k] = Math.max(3, len - cs[t === p ? q : p][k]); }
  const fz = s => F[s] ? s : null, faces = (...s) => s.filter(Boolean);
  lots.push({ x0: X0, z0: Z0, x1: X0 + cs.NW[0], z1: Z0 + cs.NW[1], faces: faces(fz('-z'), fz('-x')), corner: 'NW' });
  lots.push({ x0: X1 - cs.NE[0], z0: Z0, x1: X1, z1: Z0 + cs.NE[1], faces: faces(fz('-z'), fz('+x')), corner: 'NE' });
  lots.push({ x0: X0, z0: Z1 - cs.SW[1], x1: X0 + cs.SW[0], z1: Z1, faces: faces(fz('+z'), fz('-x')), corner: 'SW' });
  lots.push({ x0: X1 - cs.SE[0], z0: Z1 - cs.SE[1], x1: X1, z1: Z1, faces: faces(fz('+z'), fz('+x')), corner: 'SE' });
  const dn = Math.min(cs.NW[1], cs.NE[1], DMAX), ds = Math.min(cs.SW[1], cs.SE[1], DMAX), dw = Math.min(cs.NW[0], cs.SW[0], DMAX), de = Math.min(cs.NE[0], cs.SE[0], DMAX);
  let x = X0 + cs.NW[0]; for (const w of split(X1 - cs.NE[0] - x, r, w0, w1)) { lots.push({ x0: x, z0: Z0, x1: x + w, z1: Z0 + dn - (w < 7 ? 0 : Math.floor(r() * 2)), faces: faces(fz('-z')) }); x += w; }
  x = X0 + cs.SW[0]; for (const w of split(X1 - cs.SE[0] - x, r, w0, w1)) { lots.push({ x0: x, z0: Z1 - ds + (w < 7 ? 0 : Math.floor(r() * 2)), x1: x + w, z1: Z1, faces: faces(fz('+z')) }); x += w; }
  let z = Z0 + cs.NW[1]; for (const w of split(Z1 - cs.SW[1] - z, r, w0, w1)) { lots.push({ x0: X0, z0: z, x1: X0 + dw - (w < 7 ? 0 : Math.floor(r() * 2)), z1: z + w, faces: faces(fz('-x')) }); z += w; }
  z = Z0 + cs.NE[1]; for (const w of split(Z1 - cs.SE[1] - z, r, w0, w1)) { lots.push({ x0: X1 - de + (w < 7 ? 0 : Math.floor(r() * 2)), z0: z, x1: X1, z1: z + w, faces: faces(fz('+x')) }); z += w; }
  for (const l of lots) { l.w = l.x1 - l.x0; l.d = l.z1 - l.z0; l.main = l.faces[0] || '-z'; l.front = (l.main[1] === 'z') ? l.w : l.d; }
  return lots.filter(l => l.w >= 3 && l.d >= 3);
}

// ───────────────────────── specs
const angle = (b, l) => Math.atan2((l.z0 + l.z1) / 2 - (b.R.z0 + b.R.z1) / 2, (l.x0 + l.x1) / 2 - (b.R.x0 + b.R.x1) / 2);
export function pick(r, opts) { const t = opts.reduce((s, o) => s + o[1], 0); let x = r() * t; for (const [v, w] of opts) { if ((x -= w) < 0) return v; } return opts[0][0]; }
export const pickNot = (r, opts, not) => { const o = opts.filter(p => p[0] !== not); return pick(r, o.length ? o : opts); };
export function specify(b, lots, r, seedBase) {
  const K = kitNow(), G = K.grammar, X = K.lexicon, AWN = K.palette.awnings, WALLS = K.palette.walls;
  const tower = G.towerKinds.includes(b.k), order = [...lots].sort((p, q) => angle(b, p) - angle(b, q)), HW = b.HW || {};
  const deck = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } let k = 0; return () => a[k++ % a.length]; };
  const peopleD = deck(G.roofPeople), shopD = deck(X.shops), plaqueD = deck(X.plaques), tagD = deck(X.tags), themeD = deck(X.themes), corpD = deck(X.corps), deliD = deck(X.delis), awnD = deck(AWN);
  const mids = order.filter(l => !l.corner && l.front >= 4 && l.front <= 6.5 && l.faces.length === 1), alley = !b.noAlley && mids.length && r() < G.alley ? mids[(r() * mids.length) | 0] : null;
  let prevCol = -1, prevSt = 0, prevWin = '', prevCorn = '', prevSign = '', gagDone = false, n = 0;
  for (const l of order) {
    const corner = !!l.corner && l.faces.length >= 2, big = l.w >= 12 && l.d >= 12, ave = !!b.AVE?.[l.main];   // (SPREAD: the main face's street class, not its width)
    const c = { b, l, corner, big, ave, tower, n }, type = l === alley ? 'alley' : G.typeOf(c, r); c.type = type;
    const SR = G.storeys(type, tower);
    let st = SR[0] + Math.floor(r() * (SR[1] - SR[0] + 1)); if (st && st === prevSt) st = st < SR[1] ? st + 1 : Math.max(SR[0], st - 1); if (st) prevSt = st;
    let ci; do { ci = Math.floor(r() * WALLS.length); } while (ci === prevCol); prevCol = ci; const wall = WALLS[ci];
    const ground = G.groundOf(c, r);
    const shops = [];
    if (ground === 'shop') { const two = G.twoShops(c, r);
      if (type === 'bodega') shops.push({ name: deliD(), sign: PAL.green, kind: 'awnBox', awn: PAL.green, disp: 'food' });
      const room = (two ? l.front * 10 * .42 : l.front * 10) - 8, fitD = () => { let best = null; for (let t = 0; t < 12; t++) { const c = shopD(); if (textW(c[0]) <= room) return c; if (!best || textW(c[0]) < textW(best[0])) best = c; } return best; };
      for (let k = shops.length; k < (two ? 2 : 1); k++) { const S = fitD(); const kind = pickNot(r, G.signKinds, prevSign); prevSign = kind; shops.push({ name: S[0], sign: S[1], disp: S[2], obj: S[3], kind, awn: awnD(), gate: r() < .2, tag: tagD(), blade: kind !== 'blade' && r() < .15 }); } }
    const wstyle = G.windows[type] ? pickNot(r, G.windows[type], prevWin) : 'punched'; prevWin = wstyle;
    const corn = G.cornices[type] ? pickNot(r, G.cornices[type], prevCorn) : 'band'; prevCorn = corn;
    const trim = G.trimFor(r, wall), seed = seedBase + n * 17;
    const s = l.spec = { type, st, wall, trim, seed, ground, shops, win: wstyle, cornice: corn, accent: AWN[(seed >> 2) % AWN.length] === wall ? PAL.ink : AWN[(seed >> 2) % AWN.length], bayCol: shade(wall, 1.12),
      curtain: [[PAL.red, PAL.yellow], [PAL.pink, PAL.white], [0x2de2e6, PAL.yellow], [PAL.lime, PAL.pink]][seed & 3], plaque: plaqueD(),
      canopy: null, fire: G.fire(type, st), roofTheme: themeD(), corp: type === 'office' || type === 'tower' ? corpD() : null, tag: tagD() };
    if (ground === 'resi' || (ground === 'stoop' && r() < .5)) s.canopy = r() < .5 ? s.plaque : String(100 + ((seed * 7) % 800)); // apartment canopies carry the name or the house number
    if (!s.canopy && (ground === 'stoop' || ground === 'resi') && !['deco', 'sign', 'pediment'].includes(s.cornice)) s.cornice = 'deco';           // every residential building gets an identity (canopy or plaque)
    s.fireBack = G.fireBack(type, st, r);
    // roof people: at most three roofs per block carry a scene with people
    if (!gagDone && s.shops[0]?.obj && type !== 'office') { s.gag = { kind: 'object', obj: s.shops[0].obj }; gagDone = true; }
    n++;
  }
  if (GEN.flags.neutral) neutralMix(b, order, K);   // pass 2: 30–40 % of the district's buildings white, grey or neutral brick, in clusters (neutral.js)
  // roof life: two or three roofs per block always carry a scene with people (party, garden, pigeons, tub, hoop…)
  const elig = order.filter(l => !['alley', 'parking', 'tower'].includes(l.spec.type) && l.w * l.d >= 24).sort((p, q) => hash(p.spec.seed, 5) - hash(q.spec.seed, 5));
  elig.slice(0, 2 + (hash(seedBase, 9) < .5 ? 1 : 0)).forEach(l => { l.spec.roofPeople = true; l.spec.roofTheme = peopleD(); });
  if (!gagDone) { const c = order.find(l => l.corner && l.spec.type !== 'tower' && l.spec.type !== 'parking' && l.spec.type !== 'alley' && l.faces.length >= 2) || order.find(l => !['parking', 'alley', 'tower'].includes(l.spec.type)); if (c) c.spec.gag = { kind: 'billboard' }; }
  chooseSetPieces(b, order, seedBase, G.pieces);   // pass 1c: 1–3 big roof set pieces per block + calm lots (hash-based, never the block rng)
  return order;
}
// pass 2 · a sim supply site (The Heap, the Mall ruins, the Docks) that falls inside a generated block keeps an open, fenced gravel yard
// around its coordinates, so the sim-state layer's piles stand on ground (any kit using the generator; a kit with its own builder
// declares hooks.sites instead). The sim's coordinates are law: the yard moves to the place, never the place to the yard.
function siteYards(b, lots) {
  for (const p of SIM_PLACES) { if (p.kind !== 'site' || Math.max(b.R.x0 - p.x, 0, p.x - b.R.x1) > 7 || Math.max(b.R.z0 - p.z, 0, p.z - b.R.z1) > 7) continue;   // (every block within reach: a compound's site sits where four blocks meet)
    for (const l of lots) { if (!l.spec || ['alley'].includes(l.spec.type)) continue; const dx = Math.max(l.x0 - p.x, 0, p.x - l.x1), dz = Math.max(l.z0 - p.z, 0, p.z - l.z1);
      if (Math.hypot(dx, dz) < 6.5) Object.assign(l.spec, { type: 'calm', calm: 'site', st: 0, shops: [], ground: 'calm', fire: false, fireBack: false, canopy: null, piece: null, gag: null, roofPeople: false, site: p.id }); } }
}
// storeys → height in city voxels (stoop buildings have a raised ground floor)
export function heightOf(s) { if (s.type === 'parking' || s.type === 'alley' || s.type === 'calm') return 0; if (s.type === 'tower') return 66; if (s.type === 'transit') return 36; const stoopy = s.ground === 'stoop' || s.stoop, fh = s.type === 'loft' ? 32 : 30; return (stoopy ? 12 : 36) + (s.st - 1) * fh + (stoopy ? fh : 0); }
// neighbours + exposure: every non-street side is either a party wall (paint what shows above the neighbour) or a back wall
const OPP = { '-z': '+z', '+z': '-z', '-x': '+x', '+x': '-x' };
export function exposures(lots, r) {
  const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
  for (const l of lots) { if (!l.spec || l.spec.type === 'alley' || l.spec.type === 'parking' || l.spec.type === 'calm') continue; l.expo = {}; const H = l.H;
    for (const side of ['-z', '+z', '-x', '+x']) { if (l.faces.includes(side)) continue; let nb = null, best = 0;
      for (const m of lots) { if (m === l) continue; let o = 0;
        if (side === '-x' && Math.abs(m.x1 - l.x0) < .01) o = ov(l.z0, l.z1, m.z0, m.z1); if (side === '+x' && Math.abs(m.x0 - l.x1) < .01) o = ov(l.z0, l.z1, m.z0, m.z1);
        if (side === '-z' && Math.abs(m.z1 - l.z0) < .01) o = ov(l.x0, l.x1, m.x0, m.x1); if (side === '+z' && Math.abs(m.z0 - l.z1) < .01) o = ov(l.x0, l.x1, m.x0, m.x1);
        if (o > best) { best = o; nb = m; } }
      const len = side[1] === 'z' ? l.w : l.d;
      if (nb && best >= len * .45) { const t = nb.spec.type, nh = t === 'alley' ? 0 : t === 'parking' ? 2 : t === 'calm' ? 7 : nb.H + (nb.spec.cornice === 'thin' ? 3 : 5) + 2, ex = H - nh; l.expo[side] = { kind: 'party', nh, ex, open: t === 'alley' || t === 'parking' || t === 'calm' }; }   // pass 1d: nh includes the neighbour's parapet
      else l.expo[side] = { kind: 'back' }; } }
  // paint the exposed party walls: the biggest gets a mural, others ghost signs / painted ads / pipes
  const walls = []; for (const l of lots) for (const [side, e] of Object.entries(l.expo || {})) if (e.kind === 'party' && e.ex >= 34) walls.push({ l, side, e, area: e.ex * (side[1] === 'z' ? l.w : l.d) });
  walls.sort((p, q) => q.area - p.area); const md = [...MURALS]; let face = false;
  walls.forEach((w, k) => { const h = hash(w.l.spec.seed, k, 3); w.e.paint = k === 0 || (k < 3 && h < .45) ? 'mural' : h < .45 ? 'ghost' : (h < .88 || w.e.open) ? 'ad' : 'pipes'; if (w.e.open && w.e.paint === 'ghost' && h < .2) w.e.paint = 'mural';
    if (w.e.paint === 'mural') { w.e.mural = !face ? 'face' : md[(w.l.spec.seed + k) % md.length]; face = true; } });
}

// ───────────────────────── voxels
function lotVol(l, H, s = CV, top = 16) {
  const pad = f => (l.faces.includes(f) ? 16 : (l.backPad?.[f] ?? 3)), px0 = pad('-x'), px1 = pad('+x'), pz0 = pad('-z'), pz1 = pad('+z'), k = CV / s;
  const nx = Math.round(l.w / s) + px0 + px1, nz = Math.round(l.d / s) + pz0 + pz1;
  const V = new Vol(nx, H + Math.round(top * k) + 2, nz, { s, org: [l.x0 - px0 * s, SIDE, l.z0 - pz0 * s] });
  return { V, B: { x0: px0, z0: pz0, x1: nx - px1, z1: nz - pz1 } };
}
const inset = (B, side, n) => { const b = { ...B }; if (side === '-z') b.z0 += n; if (side === '+z') b.z1 -= n; if (side === '-x') b.x0 += n; if (side === '+x') b.x1 -= n; return b; };
const faceRot = { '+z': 0, '+x': 1, '-z': 2, '-x': 3 }, faceRy = { '+z': 0, '+x': Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 };
// world anchor for a facade point (a along, d out, both in world units) at the lot's street line
// SPREAD · the sidewalk in front of a lot's face (2 m today) and a distance out from the lot line kept to its own edge: what stands in the
// curb half of today's walk (d > 1) keeps to the curb on a wider one (d + sw − 2); what stands at the shopfront (d ≤ 1) keeps to it
const swAt = (l, side) => side[1] === 'z' ? swZ(Math.round((side === '-z' ? l.z0 : l.z1) / PITCH)) : swX(Math.round((side === '-x' ? l.x0 : l.x1) / PITCH));
const kerbD = (l, side, d) => d > 1 ? d + (swAt(l, side) - 2) : d;
function facadeWorld(l, side, a, d = 0) { if (side === '-z') return [l.x1 - a, l.z0 - d]; if (side === '+z') return [l.x0 + a, l.z1 + d]; if (side === '-x') return [l.x0 - d, l.z0 + a]; return [l.x1 + d, l.z1 - a]; }
// world point of a frame (a, d in voxels) — follows setbacks
const fw = (f, a, d) => { const [x, z] = f.xz(a, d), V = f.V; return [V.org[0] + (x + .5) * V.s, V.org[2] + (z + .5) * V.s]; };
const along = side => ({ '+z': [1, 0], '-z': [-1, 0], '-x': [0, 1], '+x': [0, -1] }[side]);
// hero compatibility: pass-1 style specs (shop/awning/stoop) get the pass-1 look. (s.hero stays set on every lot: the pass-1 roof — its
// theme, no roof people — is the look every district was approved with; s.pass1 marks the specs that really are pass-1, cleanup pass)
function normalize(s) {
  if (s._n) return s; s._n = true; s.pass1 = !s.ground;
  if (!s.ground) s.ground = s.type === 'office' ? 'lobby' : (s.stoop || s.type === 'brownstone') ? 'stoop' : s.shop ? 'shop' : 'resi';
  if (!s.shops) s.shops = s.shop ? [{ name: s.shop.name, sign: s.shop.sign, kind: s.awning ? 'awnBox' : 'band', awn: s.awning, disp: s.shop.name === 'HOT SLICE' ? 'food' : s.shop.name === 'FRESH CUTZ' ? 'barber' : 'misc' }] : [];
  s.win ??= s.type === 'loft' ? 'loft' : s.type === 'office' ? 'grid' : 'punched'; s.cornice ??= 'bracket'; s.accent ??= PAL.red; s.bayCol ??= shade(s.wall, 1.12); s.curtain ??= [PAL.red, PAL.yellow]; s.plaque ??= null;
  if (s.roofTheme === undefined) s.roofTheme = s.tank ? 'laundry' : 'dishes'; s.hero = true; return s;
}

export const ST = { signs: 0, roof: 0 };
const pushDoor = (A, at, rot) => { A.doors.push({ at, rot }); REG.door(at[0], at[1], rot); };   // pass 1d: the audit keeps doorways clear
export function buildLot(bank, l, A) {
  const s = normalize(l.spec); A.life ??= [];
  if (s.type === 'parking') return parkingLot(bank, l, A);
  if (s.type === 'alley') return 0;
  if (s.type === 'calm') return calmLot(bank, l, A);
  if (s.type === 'tower') return towerLot(bank, l, A);
  if (s.type === 'transit') return transitLot(bank, l, A);
  const r = rng(s.seed), stoopy = s.ground === 'stoop', stoopSet = stoopy ? 25 : 0, fh = s.type === 'loft' ? 32 : 30, H = l.H ?? heightOf(s);
  if (s.fireBack) { l.backPad ??= {}; l.backPad[OPP[l.main]] = 16; }
  const { V, B: B0 } = lotVol(l, H + 12);
  const B = inset(B0, l.main, stoopSet), ph = s.cornice === 'thin' ? 3 : 5, F = mass(V, B, H, s.wall, s.trim, l.faces, { parapet: ph, cornice: false });
  const floors = []; for (let y = stoopy ? 12 : 36; y + 20 < H - 4; y += fh) floors.push(y);
  const windows = [], later = [], clutter = [], door0 = A.doors.length, stoop0 = A.stoops.length;   // pass 1d: facade parts drawn after the windows; sidewalk clutter once every facade of the block exists
  l.faces.forEach((side, fi) => { const f = F(side), main = fi === 0, L = f.len;
    // ── ground floor
    if (stoopy && main) { const sa = Math.min(8, Math.floor(L * .12)); stoop(f, sa, 20, [0xeccb98, 0xd9b48a, 0xf2e2c4][s.seed % 3], [0x0b5a3a, 0x7a1020, 0x17171b, 0x2f5bff][(s.seed >> 2) & 3], s.trim); f.box(0, 0, 0, L, 12, 2, shade(s.wall, .7)); f.box(-1, 12, 0, L + 1, 14, 3, s.trim);
      for (let a = sa + 26; a + 10 < L - 2; a += 18) { f.box(a, 2, -2, a + 10, 9, 2, AIR); f.box(a, 2, -3, a + 10, 9, -2, 0x2a2d38, 1); for (let b = a + 1; b < a + 10; b += 2) f.box(b, 2, 0, b + 1, 9, 1, PAL.iron); }
      if (s.canopy) { const t = nameOrNo(s.canopy, 22, s.seed), AW = kitNow().palette.awnings, cc = AW[(s.seed >> 1) % AW.length]; f.box(sa - 3, 38 + 8, 3, sa + 23, 38 + 11, 14, cc); f.box(sa - 3, 41, 12, sa + 23, 50, 14, cc); if (t) f.text(t, sa + 10, 49, 14, 15, PAL.white, TOD.night ? 3 : 0, 1, 1); }   // pass 1d: a 0.9 m fascia under the name
      const st = fw(f, sa + 10, 13); A.stoops.push({ at: [st[0], st[1]], rot: faceRot[side], y: 1.0, dog: fw(f, sa + 27, 17) });   // (dog: a spot in the front yard beside the steps, jobs.js placeDogs)
      clutter.push(() => streetClutter(bank, l, side, f, s, 'stoop', { door: sa + 10, stoopSet }, A)); }
    else if (s.ground === 'lobby') { f.box(0, 0, 0, L, 36, 2, PAL.ink); const m = L >> 1, lob = (aa, y) => y > 24 ? PAL.litHi : (aa % 6 === 0 || y === 14) ? PAL.iron : (y > 16 ? PAL.glassHi : PAL.glassLo);
      f.box(m - 14, 1, -3, m + 14, 28, 3, AIR); f.box(m - 14, 1, -4, m + 14, 28, -3, (a, y) => y > 24 ? PAL.litHi : (a - m) % 7 === 0 ? PAL.iron : (y > 16 ? PAL.glassHi : PAL.glassLo), 1);
      for (let a = 4; a + 18 < m - 16; a += 22) { f.box(a, 4, -3, a + 18, 28, 3, AIR); f.box(a, 4, -4, a + 18, 28, -3, lob, 1); f.box(a + 2, 4, -3, a + 6, 9, -2, 0xd9643a); f.box(a + 1, 9, -3, a + 7, 15, -2, 0x2fbf55); }
      for (let a = m + 18; a + 18 < L - 4; a += 22) { f.box(a, 4, -3, a + 18, 28, 3, AIR); f.box(a, 4, -4, a + 18, 28, -3, lob, 1); f.box(a + 12, 4, -3, a + 16, 9, -2, 0xd9643a); f.box(a + 11, 9, -3, a + 17, 15, -2, 0x2fbf55); }
      const cn = fitText(s.corp || '', 34); f.box(m - 18, 29, 0, m + 18, 33, 15, s.accent); f.box(m - 18, 24, 13, m + 18, 33, 15, s.trim); if (cn) f.text(cn, m, 32, 15, 16, inkOn(s.trim), TOD.night ? 3 : 0, 1, 1);   // pass 1d: the canopy's fascia is tall enough for its name
      for (const fa of [m - 16, m + 15]) if (!REG.why(f.world(fa, 0, 13, fa + 1, 24, 14), { ignore: ['facade', 'plinth'], items: false })) f.box(fa, 0, 13, fa + 1, 24, 14, PAL.gold, 2);   // (a post that would break the walkers' clear path is left out: the canopy is cantilevered there)
      // the building's name in gold on an ink board over the lobby, flags either side of it: drawn after the windows (the window cuts
      // used to carve the flag poles loose and paint sills over the letters)
      later.unshift(() => { const nm = s.corp ? fitText(s.corp, L - 10) : '', w = nm ? textW(nm) : 0, bw = Math.min(L - 4, Math.max(w + 10, 52)) >> 1;
        if (nm) { f.box(Math.max(2, m - bw), 36, 0, Math.min(L - 2, m + bw), 48, 3, PAL.ink); f.text(nm, m, 45, 3, 4, PAL.gold, TOD.night ? 3 : 2, 1, 1); }
        for (const [fa, fc, fc2] of [[m - 24, s.accent, PAL.white], [m + 22, PAL.white, s.accent]]) { if (!nm || fa < m - bw + 1 || fa > m + bw - 2) continue;
          f.box(fa, 46, 3, fa + 1, 47, 16, PAL.iron); for (let d = 5; d < 16; d++) f.box(fa, 36 - (d >> 2), d, fa + 1, 46, d + 1, (a, y) => (y < 38 - (d >> 2) + 2 || y > 43) ? fc2 : fc);
          const ini = tm1((s.corp || 'X')[0]); for (let j = 0; j < 7; j++) for (let i = 0; i < ini.w; i++) if (ini.at(i, j)) { f.set(fa + 1, 42 - j, 13 - i, fc2); f.set(fa - 1, 42 - j, 13 - (ini.w - 1 - i), fc2); } } });   // each face reads left→right from its own side
      if (main) { pushDoor(A, fw(f, m, 6), faceRot[side]); clutter.push(() => streetClutter(bank, l, side, f, s, 'lobby', { door: m }, A)); } }
    else if (s.ground === 'shop' && (main || s.type === 'bodega' || s.shops.length)) {
      const list = main ? s.shops : s.type === 'bodega' ? [{ name: bodegaBand(), sign: PAL.green, kind: 'awnBox', awn: PAL.green, disp: 'food' }] : [s.shops[s.shops.length - 1]];
      const cut = list.length === 2 ? Math.round(L * (.42 + hash(s.seed, 5) * .16)) : L; let a0 = 0;
      list.forEach((sh, k) => { const a1 = k === list.length - 1 ? L : cut, dl = (k + fi) % 2 === 1, room = shopRoom(f, { a0, a1, faces: l.faces, depth: side[1] === 'z' ? B.z1 - B.z0 : B.x1 - B.x0, doorLeft: dl });   /* hardening: every street face (a corner shop's second face too) */
        const door = shopRun(f, { a0, a1, ...sh, seed: s.seed + k * 5 + fi, doorLeft: dl, room: !!room }); if (room) shopFitout(f, room, { ...sh, type: s.type, seed: s.seed + k * 5 + fi });
        if (main || k === 0) pushDoor(A, fw(f, door, 5), faceRot[side]); const c0 = a0; if (a1 - a0 > 20) clutter.push(() => streetClutter(bank, l, side, f, s, 'shop', { a0: c0, a1, door, sh }, A)); a0 = a1; });
      if (s.type === 'bodega' && main) bodegaFruit(f); }
    else { f.box(0, 0, 0, L, 4, 2, shade(s.wall, .7)); const AW = kitNow().palette.awnings, door = main ? resiEntry(f, Math.max(4, (L >> 1) - 7 + (s.seed % 3 - 1) * 12), { trim: s.trim, door: [0x0b5a3a, 0x7a1020, 0x17171b, 0x2f5bff][(s.seed >> 2) & 3], canopy: s.canopy, canopyCol: AW[(s.seed >> 1) % AW.length] }) : -99;
      for (const a0 of bays(L, 26)) if (Math.abs(a0 + 13 - door) > 16) win(f, a0 + 6, 10, 14, 18, s.trim, { box: hash(a0, s.seed) > .5 });
      if (main) { pushDoor(A, fw(f, door, 5), faceRot[side]); clutter.push(() => streetClutter(bank, l, side, f, s, 'resi', { door }, A)); } }
    // ── upper floors
    const rows = [];
    for (const y0 of floors) { if (stoopy && main && y0 === 12) { rows.push(...windowRow(f, y0, fh, s.st, { style: s.win === 'bay' ? 'arched' : s.win, trim: s.trim, seed: s.seed, accent: s.accent, bayCol: s.bayCol, curtain: s.curtain, skip: (a0, a1) => a0 < 34 }).map(w => ({ ...w, f, side })));
      continue; }
      if (s.win === 'grid') { f.box(3, y0 + 5, -2, L - 3, y0 + 21, 2, AIR); f.box(3, y0 + 5, -3, L - 3, y0 + 21, -2, (a, y) => ((a - 3) % 20 === 0) ? s.trim : glass(20, 16, TOD.night && hash(a / 20 | 0, y0, s.seed) > .45)(a % 20, y - y0 - 5), 1);
        f.box(1, y0 + 1, 0, L - 1, y0 + 5, 2, s.accent); f.box(1, y0 + 4, 0, L - 1, y0 + 5, 3, s.trim); for (let a = 3; a < L - 3; a += 20) f.box(a, y0 + 5, 0, a + 1, y0 + 21, 2, s.trim); continue; }
      rows.push(...windowRow(f, y0, fh, s.st, { style: s.win, trim: s.trim, seed: s.seed + fi, accent: s.accent, bayCol: s.bayCol, curtain: s.curtain, lights: s.seed % 7 === 3 && y0 === floors[1] }).map(w => ({ ...w, f, side }))); }
    windows.push(...rows);
    // ── fire escape on the street face of walk-ups / lofts
    if (s.fire && main && L >= 56 && floors.length > 2) { const a1 = L - 4, a0 = Math.max(4, a1 - 56); fireEscape(f, a0, a1, floors.slice(stoopy ? 1 : 1).map(y => y - 1));
      if (hash(s.seed, 9) < kitNow().grammar.fireSitter) { const lv = floors[1 + ((hash(s.seed, 4) * (floors.length - 2)) | 0)] - 1;
        // pass 2: sit where the big head (0.8 m) clears the end railing and the flight above (the audit's char-railing); blocks whose
        // override moves people by id keep the pass-1d spot, so the location agents' hand moves still land where they meant them to
        let at = a0 + 3; if (GEN.flags.pass2 && !Object.keys(GEN.override?.people?.move || {}).length) { let best = 1e9;
          for (let k = 0; k <= (a1 - a0 - 10) / 2; k++) { const a = k % 2 ? a1 - 5 - (k >> 1) * 2 : a0 + 5 + (k >> 1) * 2; let hits = 0;
            for (let aa = a - 4; aa <= a + 4; aa += 2) for (let y = lv + 6; y <= lv + 16; y += 2) for (let d = 4; d <= 10; d += 2) { const [x, z] = f.xz(aa, d); if (V.has(x, y, z)) hits++; }
            if (hits < best) { best = hits; at = a; } if (!hits) break; } }
        const p = fw(f, at, 7); A.life.push({ x: p[0], y: SIDE + lv * CV + CV, z: p[1], ry: faceRy[side], act: 'fe', seed: s.seed + 3 }); } }   // pass 1d: the sitter sits on the platform (the stairs run through the middle)
    // ── cornice (+ plaque / painted parapet)
    cornice(f, H, ph, s.cornice, s.trim, s.wall, { plaque: s.plaque, signCol: s.accent });
    // ── loft ghost name high on the wall
    if (s.type === 'loft' && main && L >= 60 && s.cornice !== 'sign') { const nm = fitText(s.plaque.replace('THE ', '') + ' LOFTS', L - 14), w = textW(nm);   // pass 1d: on a painted board (it floated over the top-floor windows)
      if (nm) { f.box((L >> 1) - (w >> 1) - 3, H - 18, 0, (L >> 1) + (w >> 1) + 4, H - 7, 2, shade(s.wall, .8)); f.text(nm, L >> 1, H - 9, 2, 3, s.trim, 0, 1, 1); } }
  });
  // ── pass 2 · the building's apartment units for the sim-state layer (walk-ups carry apartments: the home ladder's tier 2). One unit
  // per floor above the shop; its windows on the street face; the entrance is the street door or the stoop (buzzer, lock, FOR RENT board)
  if (GEN.flags.pass2 && UNIT_TYPES.has(s.type)) {
    const side = l.main, f = F(side), rot = faceRot[side], [nx, nz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][rot], grp = REG.blk?.group || 'L?', key = REG.blk?.key || '?';
    const st = A.stoops[stoop0], dr = A.doors[door0], door = st ? [st.at[0], SIDE + 1.2, st.at[1]] : dr ? [dr.at[0], SIDE, dr.at[1]] : null;
    const units = floors.filter(y0 => !(s.ground === 'shop' && y0 < 30)).map((y0, n) => ({ id: `apt:${key}·${grp}·${n + 1}`, floor: n + 1,
      windows: windows.filter(w => w.side === side && !w.bay && w.y >= y0 && w.y < y0 + fh).map(w => { const hgt = s.win === 'tall' ? 21 : s.win === 'loft' ? 20 : s.win === 'ribbon' ? 14 : 17, [x, z] = fw(f, (w.a0 + w.a1) / 2, 0);
        return [+(x + nx * .07).toFixed(2), +(SIDE + (w.y + hgt / 2) * CV).toFixed(2), +(z + nz * .07).toFixed(2), +((w.a1 - w.a0) * CV).toFixed(2), +(hgt * CV).toFixed(2)]; }) })).filter(u => u.windows.length);   // (on the wall plane, just outside the skin voxel)
    if (door && units.length) (A.anchors ??= { lots: {}, sites: [] }, A.anchors.buildings ??= []).push({ id: `bld:${key}·${grp}`, kind: 'walkup', type: s.type, tier: 'apartment', rot, face: [nx, nz],
      entrance: { door: door.map(v => +v.toFixed(2)), stoop: !!st }, units, top: +(SIDE + H * CV).toFixed(2) });
  }
  // ── window people: one open window with somebody leaning on the sill (about one building in three)
  const cand = windows.filter(w => !w.bay && !w.ac && w.a1 - w.a0 >= 11 && w.a1 - w.a0 <= 14);
  // (cleanup pass: s.pass1, not s.hero — normalize() sets s.hero on every lot, so nobody ever leaned out)
  if (cand.length && hash(s.seed, 21) < (s.pass1 ? 0 : kitNow().grammar.windowPeople)) { const w = cand[(hash(s.seed, 22) * cand.length) | 0], f = w.f, y0 = w.y - 7, ww = w.a1 - w.a0;
    f.box(w.a0 - 1, y0, -16, w.a1 + 1, w.y + 18, -3, AIR); f.box(w.a0, w.y, -3, w.a1, w.y + 17, 0, AIR); f.box(w.a0 - 1, y0, -17, w.a1 + 1, w.y + 18, -16, [0xffd3a0, 0xa7e0ff, 0xffb3d1][s.seed % 3], TOD.night ? 3 : 0);
    f.box(w.a0 - 1, w.y + 17, -16, w.a1 + 1, w.y + 18, -3, 0xfffbe8, TOD.night ? 3 : 0); f.box(w.a0 + ww - 3, w.y, -3, w.a1, w.y + 17, -2, s.curtain[0]);
    const p = fw(f, (w.a0 + w.a1) >> 1, -9); A.life.push({ x: p[0], y: SIDE + y0 * CV, z: p[1], ry: faceRy[w.side], act: 'window', seed: s.seed + 11 }); }
  // ── non-street sides: party walls show paint above the neighbour; back walls get windows, AC, fire escapes
  for (const [side, e] of Object.entries(l.expo || defaultExpo(l))) { const f = frame(V, B, side), L = f.len;
    if (e.kind === 'back') { for (const y0 of floors.length ? floors : [10]) for (const a0 of bays(L, 22)) win(f, a0 + 5, y0 + 6, 11, 15, s.trim, { lit: TOD.night && hash(a0, y0, s.seed) > .55, ac: hash(a0, y0, s.seed + 1) > .72, box: hash(y0, a0, s.seed) > .85 });
      if (L > 30) pipes(f, L - 5, 0, H - 2, [0x9a9aa6, 0x2a2d38, shade(s.wall, .7)][s.seed % 3]); f.box(0, 0, 0, L, 4, 2, shade(s.wall, .72));
      if (s.fireBack && side === OPP[l.main] && L >= 56 && floors.length > 2) fireEscape(f, Math.max(4, L - 60), L - 4, floors.slice(1).map(y => y - 1));
      continue; }
    if (!e.paint || e.ex < 34) continue; const y0 = Math.max(4, e.nh + 4), y1 = H - 8, h = y1 - y0, a0 = 4, w = L - 8; if (h < 24 || w < 24) continue;
    if (e.paint === 'mural') mural(f, a0 + 2, y0 + 2, w - 4, Math.min(h - 4, 120), e.mural, s.seed, [[0xffe23a, 0x2de2e6, 0xff4fa3, 0x6cff4a, 0x2f5bff][s.seed % 5], [0xe8232a, 0x7a3cff, 0x17171b][s.seed % 3], PAL.white, s.tag]);
    else if (e.paint === 'ghost') { const GH = kitNow().lexicon.ghosts; ghostSign(f, a0 + 2, y1 - 4, w - 4, GH[s.seed % GH.length], s.wall); }
    else if (e.paint === 'ad') { const ADS = kitNow().lexicon.ads, ad = ADS[(s.seed >> 1) % ADS.length], bg = [PAL.red, 0x2f5bff, PAL.yellow, PAL.ink, PAL.green][s.seed % 5]; paintedAd(f, a0 + 2, Math.max(y0 + 2, y1 - 44), w - 4, Math.min(40, h - 4), ad, bg, inkOn(bg)); }
    else { pipes(f, 6, 0, H - 2); for (const y of floors.slice(1)) win(f, (L >> 1) - 5, y + 8, 10, 12, s.trim, {}); } }
  if (s.type === 'bodega' && l.faces.length > 1) bladeDeli(V, B, l.faces);
  for (const fn of later) fn();
  if (A.clutter) A.clutter.push(...clutter); else for (const fn of clutter) fn();
  // ── roof: coloured membrane + scene (planned on the real roof rect inside the parapet)
  const wX = x => V.org[0] + x * V.s, wZ = z => V.org[2] + z * V.s;
  const plan = planRoof({ x0: wX(B.x0 + 3), z0: wZ(B.z0 + 3), x1: wX(B.x1 - 3), z1: wZ(B.z1 - 3) }, { ...s, st: s.tank ? 6 : s.st }, r, s.hero ? s.roofTheme : (s.roofPeople ? s.roofTheme : ['dishes', 'solar', 'laundry', 'garden', 'pigeons', 'tent'][s.seed % 6]));
  if (!s.roofPeople || s.hero) plan.people.length = 0;
  if (s.gag?.kind === 'billboard') plan.items = plan.items.filter(it => it.kind !== 'tank');
  paintRoof(V, B, H, plan, s.wall); ST.roof += plan.items.length + (plan.deck ? 1 : 0);
  ST.signs += s.shops.length + s.shops.filter(x => x.blade || x.kind === 'blade').length + (s.canopy ? 1 : 0) + (['deco', 'sign', 'pediment'].includes(s.cornice) && s.plaque ? 1 : 0) + (s.corp ? l.faces.length : 0) + (s.gag ? 1 : 0) + (s.type === 'bodega' ? 2 : 0) + Object.values(l.expo || {}).filter(e => e.paint && e.paint !== 'pipes' && e.ex >= 34).length;
  const bankL = meshVol(V, tempBank(bank)); meshFitouts(V, bankL, A); stamp(bankL, bank, 0, 0, 0, 0);   // (cleanup pass: far-only when the block's bank is)
  const top = SIDE + H * CV, cx = (l.x0 + l.x1) / 2, cz = (l.z0 + l.z1) / 2;
  if (s.gag?.kind !== 'billboard') stampRoof(bank, plan, top, s, A); else stampRoof(bank, { ...plan, items: plan.items.filter(it => ['ac', 'vent', 'chim', 'dish', 'antenna', 'pot'].includes(it.kind) && Math.hypot(it.x - cx, it.z - cz) > 4.2) }, top, s, A);
  A.roofs.push({ x: cx, z: cz, y: top, w: l.w, d: l.d });
  if (s.piece) buildSetPiece(bank, s.piece, { x0: wX(B.x0 + 3), z0: wZ(B.z0 + 3), x1: wX(B.x1 - 3), z1: wZ(B.z1 - 3) }, top, s, A);
  if (s.gag?.kind === 'object') { const f = F(l.main), side = l.main, g = giantObject(s.gag.obj), gr = { '-z': 1, '+z': 3, '+x': 0, '-x': 2 }[side]; let done = false;
    // pass 1d: hung where it clears window boxes, balconies, blades and fire escapes (it used to pierce them at a fixed 78%)
    const Lm = f.len * .1, spots = []; for (let a = .5; a <= Lm - .5; a += .1) spots.push(a); spots.sort((p, q) => Math.abs(p - Lm * .78) - Math.abs(q - Lm * .78));   // sweep the frontage, nearest 78% first
    const whys = new Set(); for (const a of spots) { for (const dy of [3.9, 4.4, 3.6]) { const [wx, wz] = facadeWorld(l, side, a, 0), w = REG.why(REG.boxOf(g, gr, wx, SIDE + dy, wz), { ignore: 'plinth', doors: false, items: false }); if (!w) { stamp(g, bank, gr, wx, SIDE + dy, wz); done = true; break; } whys.add(w); } if (done) break; }
    if (!done) REG.skip('giant', [...facadeWorld(l, side, f.len * .078, 0)].slice(0, 1).concat([SIDE + 3.9], facadeWorld(l, side, f.len * .078, 0).slice(1)), 'no clear spot on the facade: ' + [...whys].join(', ')); }
  if (s.gag?.kind === 'billboard') { const side = l.faces[l.faces.length - 1] || l.main, rot = faceRot[side], bb = billboard(s.seed);
    stamp(bb, bank, rot, cx, top, cz); const [cs, sn] = [[1, 0], [0, 1], [-1, 0], [0, -1]][rot], lx = 2.2, lz = .45;
    if (s.seed % 3 === 0) A.giants.push({ x: cx + lx * cs + lz * sn, z: cz - lx * sn + lz * cs, y: top + 1.8, rot, seed: s.seed }); }
  return H;
}
const UNIT_TYPES = new Set(['walkup', 'brownstone', 'bodega', 'loft']);
const defaultExpo = l => { const o = {}; for (const side of new Set(l.faces.map(f => OPP[f]))) if (!l.faces.includes(side)) o[side] = { kind: 'back' }; return o; };
// the bodega's fruit stands: 0.7 m out onto the sidewalk, so each keeps the walkers' clear path and their corner lines (a corner lamp, a
// crossing) and stays off the doorway: it slides along the shopfront until it does (cleanup pass), else it is left out
function bodegaFruit(f) { const fruit = [0xff7a1a, 0xe8232a, 0x7bd12f, 0xffd93b, 0x7b3fb5];
  for (let k = 0, a0 = 4; k < 2; k++, a0 += 20) { while (a0 + 18 <= f.len - 20 && REG.why(f.world(a0, 0, 2, a0 + 18, 11, 9), { ignore: ['facade', 'plinth'], items: false })) a0 += 2;
    if (a0 + 18 > f.len - 20) break; f.box(a0, 0, 2, a0 + 18, 7, 9, (a, y, d) => (d === 8 && y % 2) ? 0x2a9a44 : 0x34b653);
    for (const [row, dd, yy] of [[0, 6, 9], [1, 3, 11]]) { f.box(a0 + 1, yy - 3, dd, a0 + 17, yy - 2, dd + 3, PAL.wood); f.box(a0 + 1, yy - 2, dd, a0 + 17, yy, dd + 3, (a, y, d) => shade(fruit[(k * 2 + row) % 5], hash(a, y, d) > .75 ? 1.18 : 1)); } } }
// sidewalk clutter + street life in front of one ground floor (world stamps, life anchors)
// pass 1d: nothing is stamped blind. putAt() asks the registry whether the prop's box is clear of building masses and their plinth
// zone (0.35 m), facade projections (stands, stoops, awnings, canopies), doorways and everything already on the sidewalk; if not, it
// slides along the wall (up to ±1.2 m) and a little toward the curb (never past it) before giving up. People get the same test.
const SLIDE = [0, 3, -3, 6, -6, 9, -9, 12, -12, 16, -16, 20, -20, 24, -24];   // (cleanup pass: up to ±2.4 m, to find room beside the clear path)
function putAt(bank, l, side, b, a, d, rr, quiet = false, o = null) {   // a: voxels along the facade, d: metres out from the lot's street line
  const bb = bankBox(b), half = (rr & 1) === (faceRot[side] & 1) ? (bb[5] - bb[2]) / 2 : (bb[3] - bb[0]) / 2;   // half depth across the sidewalk
  let why = null;   // (walkers-fix: o.out, how far out from the lot line it may reach; o.avoid(box), spots it may not take)
  let dd0 = false;   // (walkers-fix: a spot on a crossing approach is left out, not slid along: the cast placed after it keeps its spots and ids)
  const dw = swAt(l, side) - 2; d = kerbD(l, side, d);   // (SPREAD: the curb half keeps to the curb; the reach is the side's own walk)
  for (const dd of [0, .15, .3, .45]) { if (dd0) break; const dOut = d + dd; if (dOut + half > (o?.out ?? 1.96) + dw) { why ??= 'would stick out past the curb'; break; }   // (cleanup pass: kerb things may stand on the curb stone)
    for (const off of SLIDE) { const [x, z] = facadeWorld(l, side, (a + off) * CV, dOut), e = REG.boxOf(b, rr, x, SIDE, z); if (!onSlab(e)) { why ??= 'off the sidewalk'; continue; }   // (cleanup pass: a long slide never leaves the slab)
      if (o?.avoid?.(e)) { if (!dd && !off) { why = 'on a crossing approach'; dd0 = true; break; } why ??= 'on a crossing approach'; continue; }
      const w = REG.why(e); if (!w) { stamp(b, bank, rr, x, SIDE, z); return [x, z]; } why = w; } }
  if (!quiet) REG.skip(b.kind, [...facadeWorld(l, side, a * CV, d)].slice(0, 1).concat([SIDE], facadeWorld(l, side, a * CV, d).slice(1)), why); return null;
}
const onSlab = e => !REG.groundAt || [[e[0] + .05, e[2] + .05], [e[3] - .05, e[2] + .05], [e[0] + .05, e[5] - .05], [e[3] - .05, e[5] - .05]].every(([x, z]) => REG.groundAt(x, z) > .1);
function lifeAt(A, l, side, a, d, ry, act, seed, extra = {}) {   // a person where they fit (their body column clear of props and stands, and of the clear path)
  // (cleanup pass: at the shopfront, else waiting out by the curb)
  const clear = WALK.people + (swAt(l, side) - 2);   // (crowd hold, SPREAD: the clear path measured as on today's walk — its new width is the riders' and the walkers', not room for more people)
  for (const dd of d < 1 ? [d, kerbD(l, side, 1.6)] : [kerbD(l, side, d)]) for (const off of [0, 4, -4, 8, -8, 12, -12, 16, -16]) { const [x, z] = facadeWorld(l, side, (a + off) * CV, dd); if (onSlab([x - .25, 0, z - .25, x + .25, 0, z + .25]) && REG.fitsPerson(x, z, SIDE, { ignore: 'plinth', clear })) { A.life.push({ x, y: SIDE, z, ry, act, seed, ...extra }); return true; } }
  return false;
}
const KERB_APPROACH = 4.6, KERB_STRIP = 1.0;   // walkers-fix: pedsim.js NODE + KERB.reach + a walker's head (1.2 + 2.9 + 0.4); the kerb row and the second file's step out
function streetClutter(bank, l, side, f, s, kind, o, A) {
  const rot = faceRot[side], ry = faceRy[side], [ux, uz] = along(side), h = k => hash(s.seed, k, 41);
  const life = (a, d, dry, act, extra = {}) => lifeAt(A, l, side, a, d, extra.abs ?? ry + dry, act, s.seed * 7 + (a | 0) + (d * 10 | 0), extra.abs !== undefined ? {} : {});
  const stampAt = (b, a, d, rr = rot) => putAt(bank, l, side, b, a, d, rr), BOARDS = kitNow().lexicon.boards, AWN_P = kitNow().palette.props;
  // cleanup pass · the clear walkway rule (audit.js WALK): bins, news boxes, planters, pots and bikes stand in the kerb strip (d = metres
  // out from the lot line: 2 is the curb), sandwich boards, barber poles and the door-level people against the shopfront, and everything
  // leaves the walkers a clear path ≥ 0.95 m (a placement that wouldn't slides along the frontage, or is left out)
  // walkers-fix round · news boxes and a sandwich board out by the curb keep off the CROSSING APPROACHES — the kerb strip (KERB_STRIP m)
  // within KERB_APPROACH m of every corner of a street sidewalk, where the crossings' files step off and the kerb-wait row stands (pedsim.js
  // KERB). One whose spot is on an approach is left out (logged), not slid along the curb: what the lot places after it keeps its spots,
  // so the generated cast keeps its ids (a slid news box took a customer's spot, and a block file's people.move then moved the wrong one)
  const kerbOut = { avoid: e => (REG.blk?.walk || []).some(S => { const X = S.ax === 'x', a0 = X ? e[0] : e[2], a1 = X ? e[3] : e[5], c0 = X ? e[2] : e[0], c1 = X ? e[5] : e[3];
    const k0 = Math.min(S.cur, S.cur + S.dir * KERB_STRIP), k1 = Math.max(S.cur, S.cur + S.dir * KERB_STRIP); if (c1 <= k0 || c0 >= k1) return false;
    return (a0 < S.u0 + KERB_APPROACH && a1 > S.u0) || (a1 > S.u1 - KERB_APPROACH && a0 < S.u1); }) };
  if (kind === 'shop') { const { a0, a1, door, sh } = o;
    if (h(1) < .55) { const sb = sandwich(BOARDS[(s.seed + a0) % BOARDS.length], sh.sign === PAL.ink ? PAL.red : sh.sign), sa = door + (a0 < door - 20 ? -18 : 18);   // against the shopfront, else out by the curb
      if (putAt(bank, l, side, sb, sa, .45, rot, true) || putAt(bank, l, side, sb, sa, 1.8, rot, false, kerbOut)) ST.signs++; }
    if (sh.disp === 'barber') stampAt(barberPole(), door - 12, .45);
    if (h(2) < .3) putAt(bank, l, side, newsBox([PAL.red, 0x2f5bff, PAL.yellow][s.seed % 3]), a0 + 6, 1.55, rot, false, kerbOut);
    if (h(3) < .35) stampAt(trashCan(0x25b84c), (a0 + a1) >> 1, 1.5);
    if (h(4) < .25) stampAt(planterBox(PAL.ink), a0 + 8, 1.55);
    // people: a customer at the door (carrying), a talking pair or a leaner, all at the shopfront
    if (h(5) < .7) life(door, .5, (h(6) - .5) * 1.4, h(7) < .5 ? 'carry' : 'phone');
    if (h(8) < .45 && a1 - a0 > 50) { const a = a0 + 12 + h(9) * (a1 - a0 - 24), fwd = Math.atan2(ux, uz); life(a, .5, 0, 'talk', { abs: fwd + .35 }); life(a + 9, .5, 0, 'talk2', { abs: fwd + Math.PI - .35 }); }
    else if (h(10) < .45) life(a0 + 6 + h(11) * (a1 - a0 - 12), .42, 0, 'lean');
  } else if (kind === 'stoop' || kind === 'resi') { const d0 = o.door;
    if (h(1) < .75) for (let k = 0, n = 2 + (h(2) * 2 | 0); k < n; k++) stampAt(trashCan([0x25b84c, 0x17171b, 0x2f5bff][(s.seed + k) % 3]), d0 + (kind === 'stoop' ? 16 : 11) + k * 7, 1.6);
    if (h(3) < .6) { stampAt(planterBox(AWN_P[(s.seed >> 2) % AWN_P.length]), d0 - (kind === 'stoop' ? 17 : 15), 1.55); }
    if (h(4) < .45) stampAt(bike(AWN_P[(s.seed >> 3) % AWN_P.length]), d0 + (kind === 'stoop' ? -24 : 20), 1.55, (rot + 1) & 3);
    if (h(5) < .3) stampAt(potPlant(s.seed), d0 + 10, 1.65);
    if (kind === 'resi' && h(6) < .6) life(d0 + 3, .5, (h(7) - .5), 'stand');
    if (h(8) < .5) life(d0 + (h(9) < .5 ? -30 : 30), .5, Math.PI / 2, h(10) < .5 ? 'carry' : 'walk');
  } else if (kind === 'lobby') { stampAt(planterBox(PAL.ink), o.door - 24, 1.55); stampAt(planterBox(PAL.ink), o.door + 24, 1.55); life(o.door - 9, .55, .15, 'stand'); life(o.door + 30, .42, 0, 'lean'); if (h(1) < .6) life(o.door + 10, .5, -.3, 'phone'); }
}
function bladeDeli(V, B, faces) {   // vertical red DELI blade on the corner where the two street faces meet
  const sx = faces.includes('-x') ? B.x0 - 12 : B.x1, sz = faces.includes('-z') ? B.z0 + 4 : B.z1 - 7, x0 = Math.max(0, sx);
  V.box(x0, 44, sz, x0 + 12, 80, sz + 3, PAL.red);
  V.recNext(); ['D', 'E', 'L', 'I'].forEach((ch, i) => { const M = textMaskCached(ch); for (let j = 0; j < 7; j++) for (let k = 0; k < M.w; k++) if (M.at(k, j)) { const y = 77 - i * 8 - j; V.set(x0 + 4 + (M.w - 1 - k), y, sz - 1, PAL.white, TOD.night ? 3 : 0); V.recN('DELI', x0 + 4 + (M.w - 1 - k), y, sz - 1, 0, -1); V.set(x0 + 4 + k, y, sz + 3, PAL.white, TOD.night ? 3 : 0); V.recN('DELI', x0 + 4 + k, y, sz + 3, 0, 1); } });
}
const tm1 = s => textMaskCached(s);
const TMC = new Map(); const textMaskCached = s => { let m = TMC.get(s); if (!m) TMC.set(s, m = textMask(s)); return m; };

// ───────────────────────── parking lot: striped asphalt, a booth with an attendant, a big price sign, cars, a painted side wall does the rest
// signage pass 4: the price sign's words and the bodega's side band come from the signage system (the copy nearest the centre keeps PARK $404)
import { bodegaBand, parkSign } from './signage/index.js';
function parkingLot(bank, l, A) {
  const V = new Vol(Math.round(l.w / CV), 70, Math.round(l.d / CV), { s: CV, org: [l.x0, SIDE, l.z0] }), W = V.nx, D = V.nz;
  V.box(0, 0, 0, W, 1, D, (x, y, z) => (x % 26 === 0 && z > 6 && z < D - 6) ? PAL.lineW : PAL.asphalt);
  const bx = l.main === '-x' ? 2 : W - 17, bz = l.main === '-z' ? 2 : D - 17; V.box(bx, 1, bz, bx + 15, 24, bz + 15, PAL.yellow); V.box(bx - 1, 24, bz - 1, bx + 16, 26, bz + 16, PAL.ink); V.box(bx + 2, 12, bz, bx + 13, 20, bz + 16, 0x9fd8ff, 1);
  const px = l.main === '-x' ? 1 : W - 4, pz = Math.round(D / 2); V.box(px, 1, pz, px + 2, 50, pz + 2, PAL.iron);
  const [pk1, pk2] = parkSign(l.x0 + (px + 1) * CV, l.z0 + (pz + 1) * CV), sgn = textMaskCached(pk1), sgn2 = textMaskCached(pk2); V.box(px - 12, 50, pz - 1, px + 14, 68, pz + 3, PAL.red);
  V.recNext(); for (const [M, yt] of [[sgn, 66], [sgn2, 58]]) for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) { const xa = px - 10 + i + Math.round((24 - M.w) / 2), xb = px + 12 - i - Math.round((24 - M.w) / 2);
    V.set(xa, yt - j, pz - 2, PAL.white, TOD.night ? 3 : 0); V.recN(M.s, xa, yt - j, pz - 2, 0, -1); V.set(xb, yt - j, pz + 3, PAL.white, TOD.night ? 3 : 0); V.recN(M.s, xb, yt - j, pz + 3, 0, 1); }
  REG.surface(V); meshVol(V, bank);   // pass 1d: the asphalt is a walkable surface (props on it sit on top)
  const cars = Math.max(1, Math.floor(l.w * l.d / 60)); for (let k = 0; k < cars; k++) { const cx = l.x0 + 1.6 + (k % 3) * 2.6, cz = l.z0 + l.d / 2 + ((k / 3 | 0) - .5) * 4.6; if (cx < l.x1 - 1.4) stamp(car(k + l.x0), bank, 0, cx, SIDE + .1, cz); }
  A.life.push({ x: l.x0 + (bx + 7.5) * CV, y: SIDE, z: l.z0 + (bz + (l.main === '-z' ? 20 : -5)) * CV, ry: l.main === '-z' ? Math.PI : 0, act: 'phone', seed: l.spec.seed });
  A.roofs.push({ x: (l.x0 + l.x1) / 2, z: (l.z0 + l.z1) / 2, y: SIDE, w: l.w, d: l.d, open: true });
  return 0;
}

// ───────────────────────── pass 2 · subway station house: a one-storey green kiosk, stairwell into the dark, two globe lamps (transit.js)
function transitLot(bank, l, A) {
  const s = l.spec, H = 36, t = s.transit || {}, { V, B } = lotVol(l, H + 8), F = mass(V, B, H, s.wall, s.trim, l.faces, { parapet: 3, cornice: false });
  const side = l.main, f = F(side), { door } = stationFront(f, f.len, H, t); pushDoor(A, fw(f, door, 6), faceRot[side]);
  for (const sd of l.faces.slice(1)) { const g = F(sd); g.box(0, 0, 0, g.len, H, 2, 0x155a3c); for (const a0 of bays(g.len, 22)) win(g, a0 + 5, 10, 12, 16, PAL.white, {}); }
  paintRoof(V, B, H, { col: roofColor(s), deck: null }, s.wall); meshVol(V, bank);
  const clutter = () => { for (const a of [door - 27, door + 27]) putAt(bank, l, side, globeLamp(), a, .3, faceRot[side]); };
  if (A.clutter) A.clutter.push(clutter); else clutter();
  // the flight under it (subway stations agent, 2026-10-08): the clips' own treads, from the top nosing 0.32 m in from the street line,
  // down under the kiosk's floor (transit.js stairwell); its opening is cut out of the ground (the anchors' holes, ground.js)
  const [x, z] = facadeWorld(l, side, door * CV, 0), inw = { '+z': [0, -1], '-z': [0, 1], '+x': [-1, 0], '-x': [1, 0] }[side], nose = STAIR.kiosk.nose;
  const W = stairwell({ x: x + inw[0] * nose, z: z + inw[1] * nose, dir: inw, y0: SIDE, w: STAIR.kiosk.w, cover: (side[1] === 'z' ? l.d : l.w) - nose - .05, style: 'kiosk' }); meshVol(W.V, bank);
  (A.stations ??= []).push({ id: t.id, x, z, rot: faceRot[side], top: W.top, dir: inw, y: W.y, w: W.w, nose, hole: W.hole, entry: 'kiosk' });
  A.roofs.push({ x: (l.x0 + l.x1) / 2, z: (l.z0 + l.z1) / 2, y: SIDE + H * CV, w: l.w, d: l.d });
  return H;
}

// ───────────────────────── towers: detailed podium (0.1) + a shaft in 0.2 voxels with setbacks and a crown
function towerLot(bank, l, A) {
  if (l.spec.supertall === 'vig') return vigTower(bank, l, A, { lotVol, pushDoor, fw, faceRot });   // LOOK round: the skyline anchor (heroes/vig-tower.js, set by blocks/-1_-2.js)
  const s = l.spec, r = rng(s.seed), podH = 66;
  const { V, B } = lotVol(l, podH + 8, CV, 4);
  const F = mass(V, B, podH, s.wall, s.trim, l.faces, { parapet: 3 });
  l.faces.forEach((side, fi) => { const f = F(side); f.box(0, 0, 0, f.len, 36, 2, PAL.ink); f.box(0, 27, 0, f.len, 36, 3, s.trim);   // pass 1d: the trim band carries the whole name
    for (let a = 6; a + 24 < f.len - 4; a += 30) { f.box(a, 3, -3, a + 24, 28, 3, AIR); f.box(a, 3, -4, a + 24, 28, -3, (aa, y) => y > 22 ? PAL.litHi : 0x243a6a, 1); }
    f.text(fitText(s.corp || 'GLASSWALL', f.len - 8), f.len >> 1, 35, 3, 4, PAL.ink, TOD.night ? 3 : 0, 1, 1);
    for (const a0 of bays(f.len, 27)) win(f, a0 + 7, 42, 13, 17, s.trim); if (fi === 0) pushDoor(A, fw(f, f.len >> 1, 6), faceRot[side]); });
  paintRoof(V, B, podH, { col: roofColor(s), deck: null }, s.wall);
  meshVol(V, bank);
  const S = .2, tiers = 2 + (r() < .5 ? 1 : 0), inset0 = 1.0; let y = SIDE + podH * CV, fx0 = l.x0 + inset0, fz0 = l.z0 + inset0, fx1 = l.x1 - inset0, fz1 = l.z1 - inset0;
  const floorsTotal = s.st - 2, per = Math.ceil(floorsTotal / tiers), crown = ['spire', 'sign', 'pyramid', 'tank', 'antenna'][s.seed % 5];
  for (let t = 0; t < tiers; t++) { const fl = Math.min(per, floorsTotal - t * per); if (fl <= 0) break; const Hh = Math.round(fl * 3.0 / S);
    const W = Math.round((fx1 - fx0) / S), D = Math.round((fz1 - fz0) / S), V2 = new Vol(W + 4, Hh + 6, D + 4, { s: S, org: [fx0 - 2 * S, y, fz0 - 2 * S], ground: false }), B2 = { x0: 2, z0: 2, x1: W + 2, z1: D + 2 };
    const F2 = mass(V2, B2, Hh, s.wall, s.trim, ['-z', '+z', '-x', '+x'], { parapet: 2, cornice: t === tiers - 1, roof: roofColor(s) });   // pass 1c: neutral tier roofs
    for (const side of ['-z', '+z', '-x', '+x']) { const f = F2(side); for (let yy = 2; yy + 8 < Hh - 3; yy += 15) for (const a0 of bays(f.len, 13)) win(f, a0 + 3, yy + 3, 7, 9, s.trim, {}); }
    meshVol(V2, bank); y += Hh * S; const k = 1.2 + r() * .6; fx0 += k; fz0 += k; fx1 -= k; fz1 -= k; if (fx1 - fx0 < 5) break; }
  const cx = (l.x0 + l.x1) / 2, cz = (l.z0 + l.z1) / 2;
  crownOf(bank, crown, cx, y, cz, Math.min(fx1 - fx0 + 1.6, fz1 - fz0 + 1.6), s, l);   // pass 1d: the crown sits inside the top tier's parapet (it sat on it: coincident faces)
  A.roofs.push({ x: cx, z: cz, y, w: 4, d: 4, tower: true });
  return (y - SIDE) / CV;
}
function crownOf(bank, kind, cx, y, cz, w, s, l) {
  const V = new Vol(Math.round(w / .2) + 4, 60, Math.round(w / .2) + 4, { s: .2, org: [cx - (Math.round(w / .2) + 4) * .1, y, cz - (Math.round(w / .2) + 4) * .1], ground: false }), n = V.nx, m = n >> 1;
  if (kind === 'pyramid' || kind === 'spire') { const rc = roofColor(s), cc = copingColor(s); let topY = 0; for (let k = 0; k < 10; k++) { if (n - 2 - k * 2 <= 2 + k * 2) break; topY = k * 3 + 3; V.box(2 + k * 2, k * 3, 2 + k * 2, n - 2 - k * 2, k * 3 + 3, n - 2 - k * 2, (x, y, z) => y === k * 3 + 2 ? (k % 2 ? cc : rc) : (k % 2 ? s.trim : s.wall)); } /* pass 1c: step tops neutral, no bullseye from above */ if (kind === 'spire') V.box(m - 1, Math.min(20, topY - 1), m - 1, m + 1, 58, m + 1, s.trim, 2); }   // pass 1d: the spire starts on the top step
  else if (kind === 'antenna') { V.box(m - 4, 0, m - 4, m + 4, 6, m + 4, s.wall); for (let yy = 6; yy < 56; yy++) V.set(m, yy, m, yy % 6 < 3 ? PAL.red : PAL.white); V.box(m - 1, 56, m - 1, m + 2, 58, m + 2, PAL.red, 3); }
  else if (kind === 'tank') { for (const [ox, oz] of [[-6, -6], [6, 5]]) { V.box(m + ox - 4, 0, m + oz - 4, m + ox + 4, 6, m + oz + 4, PAL.iron); for (let yy = 6; yy < 18; yy++) for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (x * x + z * z <= 17) V.set(m + ox + x, yy, m + oz + z, yy % 4 ? PAL.wood : PAL.woodD); for (let k = 0; k < 3; k++) for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (x * x + z * z <= 17 - k * 6) V.set(m + ox + x, 18 + k, m + oz + z, PAL.woodD); } }
  else { const name = (s.corp || 'GLASSWALL').split(' ')[0], M = textMaskCached(name.slice(0, 6)); V.box(4, 0, m - 1, n - 4, 3, m + 1, PAL.iron);
    for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) V.box(Math.round(m - M.w + i * 2), 3 + (6 - j) * 2, m - 1, Math.round(m - M.w + i * 2) + 2, 5 + (6 - j) * 2, m + 1, TOD.night ? PAL.yellow : PAL.white, TOD.night ? 3 : 0); }   // pass 1d: letters stand on the bar
  meshVol(V, bank);
}

// ───────────────────────── one-off scenes (one per block): the stuff nobody would generate
function oneOff(bank, b, lots, kind, r, A) {
  // pick a street-facing lot (one rng draw, as before); pass 1d: the whole scene must fit — clear of stands, stoops, doorways and
  // clutter — so it tries shifts along that frontage, then the other candidate lots, and skips the scene if nothing is free
  const cands = lots.filter(l => l.spec && !['alley', 'parking', 'tower', 'calm'].includes(l.spec.type) && l.front >= 6); if (!cands.length) return null;
  const first = (r() * cands.length) | 0; let lastWhy = null; const whys = new Set();
  // the drawn lot first, then the doorless frontages (pocket plazas, parking lots), then every other lot
  const open = lots.filter(l => l.spec && ['calm', 'parking'].includes(l.spec.type) && l.front >= 6), order = [cands[first], ...open, ...cands.filter((_, k) => k !== first)];
  // every street face of those lots (a corner lot offers its side street too)
  const faces = order.flatMap(l => l.faces.map(side => ({ l, side, front: side[1] === 'z' ? l.w : l.d })));
  for (const { l, side, front } of faces) {
    const shifts = []; for (let d = 0; d <= front / 2; d += .3) { shifts.push(d); if (d) shifts.push(-d); }   // the whole frontage, from its middle out
    for (const shift of shifts) { const mid = front / 2 + shift; if (mid < 2.4 || mid > front - 2.4) continue;
      const parts = [], people = []; scene(kind, l, mid, (bk, a, d, rr) => parts.push({ bk, a, d, rr }), (a, d, dry, act, extra) => people.push({ a, d, dry, act, extra }), faceRot[side]);
      const rot = faceRot[side], ry = faceRy[side], P = (a, d) => facadeWorld(l, side, a, kerbD(l, side, d));   // (SPREAD: a scene's curb-side parts keep to the curb)
      const clear = SCENE_CLEAR + (swAt(l, side) - 2);   // (crowd hold, SPREAD: the clear path it leaves is measured as on today's walk — the walk's new width isn't room for a scene)
      const placed = parts.map(p => { const [x, z] = P(p.a, p.d), rr = p.rr ?? rot, y = p.y ?? SIDE; return { ...p, x, z, rr, y, box: REG.boxOf(p.bk, rr, x, y, z) }; });
      const bad = placed.map(p => REG.why(p.box, { clear })).find(Boolean); if (bad) { whys.add(bad); lastWhy = bad; continue; }   // (the scene's own parts interlock by design: a table over its crates)
      if (!people.every(p => { const [x, z] = P(p.a, p.d); return REG.fitsPerson(x, z, SIDE, { items: false, ignore: 'plinth', clear }); })) { lastWhy = 'no room for its people'; continue; }
      { const u = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9], add = e => { for (let q = 0; q < 3; q++) { u[q] = Math.min(u[q], e[q]); u[q + 3] = Math.max(u[q + 3], e[q + 3]); } };   // the whole scene, people included, still leaves a lane
        for (const p of placed) add(p.box._w?.() || p.box); for (const p of people) { const [x, z] = P(p.a, p.d); add([x - .3, SIDE + .1, z - .3, x + .3, SIDE + 1.7, z + .3]); }
        const w = REG.walkGap(u, clear); if (w) { whys.add(w); lastWhy = w; continue; } }
      for (const p of placed) stamp(p.bk, bank, p.rr, p.x, p.y, p.z);
      for (const p of people) { const [x, z] = P(p.a, p.d), [ux, uz] = unshift(x, z); A.life.push({ x, y: SIDE, z, ry: ry + p.dry, act: p.act, seed: (ux * 97 + uz * 13) | 0, ...(p.extra || {}) }); }   // (SPREAD pin: the look seed reads today's place)
      return { kind, l }; } }
  const l0 = cands[first]; REG.skip('oneoff-' + kind, [(l0.x0 + l0.x1) / 2, SIDE, (l0.z0 + l0.z1) / 2], [...whys].join(', ') || lastWhy || 'no frontage fits'); return null;
}
// cleanup pass: a one-off scene is the one thing allowed to squeeze the clear path, down to a walker's own width (the lane goes past it)
const SCENE_CLEAR = .75;
// one-off scenes in the lot's facade frame: a along the frontage (m), d out from the street line (m); put(bank, a, d, rot?), life(a, d, dry, act, extra)
function scene(kind, l, mid, put, life, rot = faceRot[l.main]) {   // pass 1d: every scene fits the 2 m sidewalk (clear of the 0.35 m plinth zone, inside the curb)
  // cleanup pass: every scene stands along the curb, within 1 m of it, so the walkers' lane passes behind it (gen.js SCENE_CLEAR)
  const YARD = kitNow().lexicon.yard;
  if (kind === 'couch') { put(couch(YARD[(l.spec.seed >> 2) % YARD.length]), mid, 1.45, (rot + 2) & 3); put(sandwich('FREE', PAL.red), mid + 1.9, 1.8, rot); life(mid - .45, 1.55, 0, 'sit', { seatY: .5 }); life(mid + .5, 1.55, .2, 'sit', { seatY: .5 }); }
  else if (kind === 'domino') { put(milkCrate(PAL.red), mid - .75, 1.5); put(milkCrate(0x2f5bff), mid + .75, 1.5); put(cardTable(), mid, 1.5, 0);   // a folding card table out by the curb
    life(mid - .75, 1.5, Math.PI / 2, 'sit', { seatY: .5 }); life(mid + .75, 1.5, -Math.PI / 2, 'sit', { seatY: .5 }); life(mid - 1.55, 1.5, Math.PI / 2 + .3, 'stand'); life(mid + 1.6, 1.45, -2.2, 'stand'); }
  else if (kind === 'cart') { put(cart(), mid, 1.4); life(mid - 1.45, 1.45, Math.PI / 2, 'arms'); life(mid + 1.55, 1.5, -1.8, 'carry'); }
  else if (kind === 'moving') { for (let k = 0; k < 5; k++) put(milkCrateBig(k), mid - 1.4 + k * .65, 1.55); put(couch(0x7a3cff), mid + 2.7, 1.45); life(mid - 2.2, 1.5, 1.2, 'carry'); life(mid + 1.25, 1.55, -.4, 'arms'); }
  else if (kind === 'yardsale') { put(tableTop(), mid, 1.5); put(sandwich('SALE', 0x2f5bff), mid + 1.7, 1.8, rot); put(bags(3), mid - 1.7, 1.55); life(mid + .95, 1.5, -Math.PI / 2, 'arms'); life(mid - .2, 1.5, Math.PI + .3, 'stand'); }
}
import { Vol as V2 } from './vox.js';
import { meshed } from './vox.js';
const TT = new Map(); function tableTop() { let b = TT.get('t'); if (!b) { const V = new V2(12, 8, 8, { s: CV, org: [-.6, 0, -.4] }); V.box(0, 6, 0, 12, 7, 8, 0xf7f7f2); V.box(5, 0, 3, 7, 6, 5, PAL.iron); for (let k = 0; k < 6; k++) V.set(2 + k * 2, 7, 2 + (k % 3) * 2, k % 2 ? PAL.ink : PAL.white); TT.set('t', b = meshed(V)); b.kind = 'table'; } return b; }   // (cleanup pass: 1.2 × 0.8, a folding table that fits the curb)
function cardTable() { let b = TT.get('ct'); if (!b) { const V = new V2(8, 8, 8, { s: CV, org: [-.4, 0, -.4] }); V.box(0, 6, 0, 8, 7, 8, 0x2a9a44); for (const [x, z] of [[0, 0], [7, 0], [0, 7], [7, 7]]) V.box(x, 0, z, x + 1, 6, z + 1, PAL.iron);
  for (let k = 0; k < 5; k++) V.set(1 + k + (k & 1), 7, 2 + (k % 3) * 2, k % 2 ? PAL.ink : PAL.white); TT.set('ct', b = meshed(V)); b.kind = 'table'; } return b; }
function milkCrateBig(k) { let b = TT.get('box' + (k % 3)); if (!b) { const V = new V2(6, 6, 6, { s: CV, org: [-.3, 0, -.3] }); V.box(0, 0, 0, 6, 5 + (k % 2), 6, [0xc98a4b, 0xb97a3b, 0xd99a5b][k % 3]); V.box(0, 3, 0, 6, 4, 6, 0xe8d4b0); TT.set('box' + (k % 3), b = meshed(V)); b.kind = 'box'; } return b; }

// the mass a lot will have (world box; the group is its lot label): what neighbours are clipped against and what props keep clear of
export function massPlan(l, group) { const s = l.spec; if (!s || s.type === 'alley') return null;
  if (s.type === 'parking') return { box: [l.x0, SIDE, l.z0, l.x1, SIDE + .15, l.z1], group };
  if (s.type === 'calm') return { box: [l.x0, SIDE, l.z0, l.x1, SIDE + .65, l.z1], group };
  const H = s.type === 'tower' ? 66 + 3 + 1 : (l.H ?? heightOf(s)) + (s.cornice === 'thin' ? 3 : 5) + 1, set = s.ground === 'stoop' ? 2.5 : 0, m = l.main, top = SIDE + H * CV;
  const box = [l.x0 + (m === '-x' ? set : 0), SIDE, l.z0 + (m === '-z' ? set : 0), l.x1 - (m === '+x' ? set : 0), top, l.z1 - (m === '+z' ? set : 0)];
  // its frontage: the strip in front of each street face out to the curb — neighbours' band and cornice overhangs are clipped there too
  const zones = l.faces.map(f => f === '-z' ? [box[0], SIDE, l.z0 - 1.6, box[3], top, box[2]] : f === '+z' ? [box[0], SIDE, box[5], box[3], top, l.z1 + 1.6] : f === '-x' ? [l.x0 - 1.6, SIDE, box[2], box[0], top, box[5]] : [box[3], SIDE, box[2], l.x1 + 1.6, top, box[5]]);
  return { box, group, zones, roofY: SIDE + (s.type === 'tower' ? 66 : (l.H ?? heightOf(s))) * CV }; }   // pass 2: + roofY (people may stand on the roof)

// ───────────────────────── a whole block
// the spec pass: lots → specs → heights → exposures. Cheap (no voxels); the far tier is drawn from it, the full build continues from it.
export function planBlock(b, towerCorner) {
  const r = rng(1000 + (b.i + 50) * 131 + (b.j + 50) * 17), lots = subdivide(b, r, towerCorner);
  specify(b, lots, r, (b.i + 50) * 1000 + (b.j + 50) * 37);
  // pass 1d: a block override may hand-tune lot specs (name, colour, storeys, sign kind…) before heights are taken — near and far agree.
  // Lots are numbered in subdivide order (L0 NW, L1 NE, L2 SW, L3 SE corners, then the north row west→east, south row, west column, east column)
  const ov = GEN.override !== undefined ? GEN.override : overrideFor(b.i, b.j);
  if (ov?.lots) lots.forEach((l, k) => { const fn = ov.lots['L' + k]; if (fn) try { fn(l.spec, l); } catch (e) { throw new ModuleError(`blocks/${b.i}_${b.j}.js`, e, 'lots.L' + k); } });
  if (GEN.flags.pass2) { transitLots(b, lots, kitNow()); siteYards(b, lots); }   // pass 2: station houses (transit.js); open yards for the sim's supply sites
  for (const l of lots) l.H = heightOf(l.spec);
  exposures(lots, r);
  return { r, lots };
}
// cleanup pass · THE WALKERS' BAND, one rule in the core for every kit (it was gen.js's middle band plus Neon Row's own curb band in
// districts/strip/fill.js). grammar.walkway is its width in metres (0: none); grammar.walkband says where it lies:
//   'middle' (default)        centred on every street sidewalk (1.0 m out from the facade) and held for the whole build (pass 2)
//   { from: 1.2, corners: .8 } on the CURB side, from `from` m out from the facade, plus the whole sidewalk for `corners` m either side
//                             of every corner lamp, signal and transit stand; it steers what the lots, yards, one-off and clutter put
//                             down (so the door-level clutter stays at the shopfronts), then lift() takes it away before the street
//                             furniture goes down. Neon Row's grammar.
// lots may include pseudo lots for hand-made heroes ({ hero, faces, … }); keep(box) reserves more of the band (a one-off's lane).
export function walkBand(b, lots, G = kitNow().grammar) {
  const WW = G.walkway, mode = G.walkband ?? 'middle', temp = [], curb = mode !== 'middle';
  const keep = box => { if (!REG.blk) return; REG.keep(box, 'walkway'); if (curb) temp.push(REG.blk.keep[REG.blk.keep.length - 1]); };
  if (WW && REG.blk && !curb) for (const l of lots) for (const side of l.faces) { const mid = 1.0 * swAt(l, side) / 2, lo = mid - WW / 2, hi = mid + WW / 2;   // (SPREAD: the middle of the side's own walk)
    const [ax, az] = facadeWorld(l, side, 0, lo), [bx, bz] = facadeWorld(l, side, side[1] === 'z' ? l.w : l.d, hi); keep([Math.min(ax, bx), SIDE, Math.min(az, bz), Math.max(ax, bx), SIDE + 2.2, Math.max(az, bz)]); }
  if (WW && REG.blk && curb) { const from = mode.from ?? 1.2, cor = mode.corners ?? .8, s = slab(b.i, b.j), strips = [[s.x0, s.x0 + swX(b.i), 'x'], [s.x1 - swX(b.i + 1), s.x1, 'x'], [s.z0, s.z0 + swZ(b.j), 'z'], [s.z1 - swZ(b.j + 1), s.z1, 'z']];   // (SPREAD: each side's own sidewalk)
    for (const l of lots) for (const side of l.faces) { const len = side[1] === 'z' ? l.w : l.d, ext = l.corner || l.hero ? 2 : 0, fr = from + (swAt(l, side) - 2);   // (SPREAD: from the curb side's own place)
      const [ax, az] = facadeWorld(l, side, -ext, fr), [bx, bz] = facadeWorld(l, side, len + ext, fr + WW); keep([Math.min(ax, bx), SIDE, Math.min(az, bz), Math.max(ax, bx), SIDE + 2.2, Math.max(az, bz)]); }
    for (const k of REG.blk.keep.filter(k => k.tag === 'corner-furniture' || k.tag === 'transit')) { const e = k.box;   // (a lamp's box reaches over the road with its arm)
      for (const [a0, a1, ax] of strips) { if (ax === 'x' && e[3] > a0 && e[0] < a1) keep([a0, SIDE, e[2] - cor, a1, SIDE + 2.2, e[5] + cor]); if (ax === 'z' && e[5] > a0 && e[2] < a1) keep([e[0] - cor, SIDE, a0, e[3] + cor, SIDE + 2.2, a1]); } } }
  return { keep, lift() { if (!REG.blk || !temp.length) return; const kk = REG.blk.keep; for (let q = kk.length - 1; q >= 0; q--) if (temp.includes(kk[q])) kk.splice(q, 1); } };
}
export function buildBlock(bank, b, A, towerCorner) {
  A.life ??= []; ST.signs = 0; ST.roof = 0; const life0 = A.life.length, st0 = A.stoops.length;
  const { r, lots } = planBlock(b, towerCorner);
  REG.plan(lots.map((l, k) => massPlan(l, 'L' + k)).filter(Boolean));
  const band = walkBand(b, lots);   // the walkers' band (grammar.walkway / walkband)
  A.clutter = []; lots.forEach((l, k) => { REG.group('L' + k); const n0 = A.clutter.length; l.H = buildLot(bank, l, A) || l.H; for (let q = n0; q < A.clutter.length; q++) A.clutter[q] = [k, A.clutter[q]]; });   // pass 1d: ids read i_j·L<k>·kind·n
  const G = kitNow().grammar, ONEOFFS = G.oneOffs, kind = ONEOFFS.length ? ONEOFFS[((b.i + 7) * 5 + (b.j + 7) * 3) % ONEOFFS.length] : null;
  REG.group('yard'); yards(bank, b, lots, r, A, { carBlocks: kind === 'carBlocks' });
  REG.group('oneoff'); if (kind && kind !== 'carBlocks') oneOff(bank, b, lots, kind, r, A);
  // then each lot's sidewalk clutter, around the scene (under the lot's own group, so ids still read i_j·L<k>·kind·n)
  for (const [k, fn] of A.clutter) { REG.group('L' + k); fn(); } A.clutter = null;
  band.lift();   // a curb band steered the clutter; the street furniture (jobs.js furnish) goes down after it is lifted
  REG.group('life');
  // life budget per block: at least 12 people (top up with sidewalk scenes), at most ~22 (thin the generic poses first)
  const count = () => A.life.length - life0 + Math.ceil((A.stoops.length - st0) / 2), fronts = lots.filter(l => l.spec && !['alley', 'parking', 'calm'].includes(l.spec.type) && l.front >= 5);
  for (let t = 0; count() < G.life[0] && fronts.length && t < 30; t++) { const l = fronts[(r() * fronts.length) | 0], side = l.main, a = 1 + r() * (l.front - 2.4), fwd = Math.atan2(...along(side)), ry = faceRy[side], [x, z] = facadeWorld(l, side, a, .5);
    const clear = WALK.people + (swAt(l, side) - 2);   // (crowd hold, SPREAD: as on today's walk)
    if (r() < .5) { const [x2, z2] = facadeWorld(l, side, a + .9, .5); if (!REG.fitsPerson(x, z, SIDE, { clear }) || !REG.fitsPerson(x2, z2, SIDE, { clear })) continue;   // pass 1d: only where both fit (cleanup pass: at the shopfront)
      A.life.push({ x, y: SIDE, z, ry: fwd + .35, act: 'talk', seed: t * 31 + b.i * 7 }); A.life.push({ x: x2, y: SIDE, z: z2, ry: fwd + Math.PI - .35, act: 'talk2', seed: t * 37 + b.j * 5 }); }
    else { const [x3, z3] = facadeWorld(l, side, a, .42); if (!REG.fitsPerson(x3, z3, SIDE, { ignore: 'plinth', clear })) continue; A.life.push({ x: x3, y: SIDE, z: z3, ry, act: ['lean', 'phone', 'carry'][t % 3], seed: t * 41 + b.i * 3 + b.j }); } }
  for (let k = A.life.length - 1; k >= life0 && count() > G.life[1]; k--) if (['carry', 'phone', 'lean', 'walk', 'stand'].includes(A.life[k].act)) A.life.splice(k, 1);
  A.stats = [{ b: b.i + ',' + b.j, lots: lots.filter(l => !['alley', 'parking', 'calm'].includes(l.spec.type)).length, signs: ST.signs, roof: ST.roof, people: A.life.length - life0 + Math.ceil((A.stoops.length - st0) / 2), oneoff: kind }];
  return lots;
}
