// Roofs (pass 1c): NEUTRAL membranes (white, light greys, warm concrete, gravel, a few tar roofs) with neutral clutter; most roofs are
// calm — a stair hatch and an AC or two, some left plain; tanks only on 5+ storeys. The colour of a block lives in its 1–3 set pieces
// (setpieces.js), which take their footprint on the roof first. Items sit on a 0.5-unit collision grid so nothing overlaps.
import { stamp } from './vox.js';
import { PAL, CV, hash, shade } from './style.js';
import { TOD } from './kit.js';
import { ROOFS, YARD, BOARDS } from './lexicon.js';
import { pieceFoot } from './setpieces.js';
import { tankV, bulkhead, acBox, dish, antenna, vent, chimney, skylight, solar, coop, pigeons, laundry, hotTub, lawnChair, umbrella, grill, planterBed, potPlant, tent, kiddiePool, speaker, roofSign, hoop, milkCrate, couch, trashCan } from './props.js';
import { unshift } from '../../world/city.js';   // (SPREAD pins: a person's look seed reads today's position)
export const THEMES = ['party', 'garden', 'pigeons', 'chill', 'tub', 'laundry', 'hoop', 'tent', 'dishes', 'solar', 'pool'];   // length is part of gen.specify's rng sequence — keep 11
const LUM = c => (((c >> 16) & 255) * .3 + ((c >> 8) & 255) * .59 + (c & 255) * .11) / 255, NEUTRAL = new Set(ROOFS);
const copingOf = c => LUM(c) > .55 ? shade(c, .8) : shade(c, LUM(c) < .3 ? 1.5 : 1.3);   // LOOK round: a dark roof's coping is its own grey lifted, not a pale ring (a white rim round every tar roof read as outlines from above)
// membrane + coping as pure functions of the building spec (far.js uses them too, so the tiers never change colour when they swap)
export function roofColor(s) { return ROOFS[(hash((s.seed | 0) + 17, 88) * ROOFS.length) | 0]; }
export function copingColor(s) { return copingOf(roofColor(s)); }
const neutralOf = (c, wall = 0) => NEUTRAL.has(c) ? c : ROOFS[(hash(c | 0, wall | 0, 5) * ROOFS.length) | 0];

// plan a roof: world rect (x0,z0,x1,z1), the building spec, a seeded rng → { col, deck, items[], people[] }
export function planRoof(R, s, r, theme) {
  const W = R.x1 - R.x0, D = R.z1 - R.z0, gx = Math.max(1, Math.floor(W / .5)), gz = Math.max(1, Math.floor(D / .5)), occ = new Uint8Array(gx * gz), items = [], people = [];
  const fits = (x, z, w, d) => { const i0 = Math.floor((x - w / 2 - R.x0) / .5), i1 = Math.ceil((x + w / 2 - R.x0) / .5), k0 = Math.floor((z - d / 2 - R.z0) / .5), k1 = Math.ceil((z + d / 2 - R.z0) / .5);
    if (i0 < 0 || k0 < 0 || i1 > gx || k1 > gz) return false; for (let i = i0; i < i1; i++) for (let k = k0; k < k1; k++) if (occ[i + k * gx]) return false;
    for (let i = i0; i < i1; i++) for (let k = k0; k < k1; k++) occ[i + k * gx] = 1; return true; };
  const put = (kind, w, d, o = {}) => { for (let t = 0; t < 14; t++) { const rot = o.rot ?? ((r() * 4) | 0), sw = rot & 1 ? d : w, sd = rot & 1 ? w : d;
    const x = o.x ?? R.x0 + sw / 2 + r() * Math.max(0, W - sw), z = o.z ?? R.z0 + sd / 2 + r() * Math.max(0, D - sd); if (fits(x, z, sw + .2, sd + .2)) { const it = { kind, x, z, rot, ...o }; items.push(it); return it; } if (o.x !== undefined) return null; } return null; };
  const reserve = F => { const i0 = Math.max(0, Math.floor((F.x0 - .25 - R.x0) / .5)), i1 = Math.min(gx, Math.ceil((F.x1 + .25 - R.x0) / .5)), k0 = Math.max(0, Math.floor((F.z0 - .25 - R.z0) / .5)), k1 = Math.min(gz, Math.ceil((F.z1 + .25 - R.z0) / .5));
    for (let i = i0; i < i1; i++) for (let k = k0; k < k1; k++) occ[i + k * gx] = 1; };
  const tall = s.st >= 5, big = W * D > 40, col = roofColor(s);
  if (s.piece) {   // a set-piece roof: the piece owns the roof; a hatch and a unit or two go in what is left
    reserve(pieceFoot(s.piece, R)); if (W * D > 18) put('bulk', 2.4, 2.1); if (r() < .7) put('ac', 1.5, 1.1); if (r() < .35) put('vent', .9, .9);
    return { col, deck: null, items, people, theme: 'piece' };
  }
  // calm roofs: a stair hatch, then (for four in five) a utility kit; one in three of those carries a quiet utility theme
  const h = hash((s.seed | 0) + 3, 61);
  if (W * D > 12) put('bulk', 2.4, 2.1);
  if (s.tank || (tall && r() < .7)) put('tank', 2.8, 2.8, { v: s.tank ? 0 : (s.seed >> 1) % 4 });
  if (h >= .2) {
    for (let k = 0, n = 1 + ((r() * (big ? 3 : 2)) | 0); k < n; k++) put('ac', 1.5, 1.1);
    for (let k = 0, n = (r() * 2.4) | 0; k < n; k++) put(r() < .55 ? 'vent' : 'chim', .9, .9);
    if (h > .66) { const q = ((h - .66) / .34 * 5) | 0;
      if (q === 0) { put('solar', 3.4, 1.8); if (big) put('solar', 3.4, 1.8); } else if (q === 1) { put('dish', 1.6, 1.6); put('dish', 1.6, 1.6); put('antenna', 2.2, .4); }
      else if (q === 2) { put('skylight', 2, 1.4); put('skylight', 2, 1.4); } else if (q === 3) { put('coop', 2.6, 1.6); put('pigeons', 4, 1.4); } else put('antenna', 2.2, .4); }
    else if (r() < .3) put('dish', 1.6, 1.6);
  }
  return { col, deck: null, items, people, theme: theme ?? 'calm' };
}
// neutral coping: the top of the parapet ring reads as a pale (or darker) neutral edge from above; the wall colour stays on its faces
export function neutralCap(V, B, H, wall, cap) {
  for (let x = B.x0; x < B.x1; x++) for (let z = B.z0; z < B.z1; z++) { if (x >= B.x0 + 2 && x < B.x1 - 2 && z >= B.z0 + 2 && z < B.z1 - 2) continue;
    for (let y = Math.min(V.ny - 1, H + 14); y >= H; y--) { if (!V.has(x, y, z)) continue; const i = x + z * V.nx + y * V.sxz; if (V.pal[V.d[i]] === wall) V.set(x, y, z, cap); break; } }
}
// in-volume paint (before meshing): neutral membrane (gravel speckle, membrane seams or concrete joints), coping, legacy decks
export function paintRoof(V, B, H, plan, wall) {
  const col = neutralOf(plan.col, wall), dark = LUM(col) < .45, pat = (hash(col, 3) * 3) | 0, alt = dark ? shade(col, 1.18) : shade(col, .93);
  V.box(B.x0 + 1, H - 1, B.z0 + 1, B.x1 - 1, H, B.z1 - 1, (x, y, z) => (pat === 0 ? hash(x, z, 7) > .9 : pat === 1 ? (x - B.x0) % 10 === 0 : ((x - B.x0) % 12 === 0 || (z - B.z0) % 12 === 0)) ? alt : col);
  neutralCap(V, B, H, wall, copingOf(col));
  const d = plan.deck; if (!d) return; const s = V.s;
  const X0 = Math.round((d.x0 - V.org[0]) / s), X1 = Math.round((d.x1 - V.org[0]) / s), Z0 = Math.round((d.z0 - V.org[2]) / s), Z1 = Math.round((d.z1 - V.org[2]) / s);
  const f = { checker: (x, z) => (((x >> 3) + (z >> 3)) & 1) ? 0xf7f7f2 : 0x17171b, wood: (x, z) => (z % 4 === 0) ? 0x9a5a2a : 0xc98a4b, turf: (x, z) => ((x * 5 + z * 3) % 11 === 0) ? 0x3aa840 : 0x5cc24a,
    court: (x, z) => (x === X0 + 2 || x === X1 - 3 || z === Z0 + 2 || z === Z1 - 3 || (Math.hypot(x - (X0 + X1) / 2, z - Z0 - 2) | 0) === 16) ? 0xf7f7f2 : 0xe07a3f }[d.kind];
  V.box(X0, H - 1, Z0, X1, H, Z1, (x, y, z) => f(x, z)); if (d.kind === 'wood' || d.kind === 'checker') V.box(X0, H, Z0, X1, H + 1, Z1, (x, y, z) => f(x, z));
  if (d.lights) { const poles = [[X0 + 1, Z0 + 1], [X1 - 2, Z0 + 1], [X1 - 2, Z1 - 2], [X0 + 1, Z1 - 2]], bulbs = [0xffe23a, 0xff4fa3, 0x2de2e6, 0x6cff4a, 0xff7a1a];
    for (const [x, z] of poles) V.box(x, H, z, x + 1, H + 22, z + 1, PAL.iron);
    for (let k = 0; k < 4; k++) { const [x0, z0] = poles[k], [x1, z1] = poles[(k + 1) % 4], n = Math.round(Math.hypot(x1 - x0, z1 - z0)); for (let t = 0; t <= n; t++) { const u = t / n, y = H + 21 - Math.sin(u * Math.PI) * 5; V.set(x0 + (x1 - x0) * u, y, z0 + (z1 - z0) * u, PAL.iron); if (t % 5 === 2) V.set(x0 + (x1 - x0) * u, y - 1, z0 + (z1 - z0) * u, bulbs[(t / 5 | 0) % 5], 3); } } }
}
// stamped props (after meshing) + people anchors
export function stampRoof(bank, plan, top, s, A, facing = 0) {
  const T = top + (plan.deck && (plan.deck.kind === 'wood' || plan.deck.kind === 'checker') ? CV : 0);
  for (const it of plan.items) { const onDeck = plan.deck && it.x > plan.deck.x0 && it.x < plan.deck.x1 && it.z > plan.deck.z0 && it.z < plan.deck.z1, y = onDeck ? T : top, S = (b, rot = it.rot) => stamp(b, bank, rot, it.x, y, it.z);
    const [ux, uz] = unshift(it.x, it.z);   // (SPREAD pin: a prop's look rolls on today's place, not the spread world's)
    switch (it.kind) {
      case 'tank': S(tankV(it.v), 0); break; case 'bulk': S(bulkhead(roofColor(s), s.trim)); break; case 'ac': S(acBox()); break; case 'dish': S(dish(s.seed + (ux * 3 | 0))); break;
      case 'antenna': S(antenna(s.seed + (uz * 5 | 0))); break; case 'vent': S(vent(ux * 7 | 0)); break; case 'chim': S(chimney([0x9a8f86, 0xb3aba2, 0x8a8580][(s.seed >>> 0) % 3])); break; case 'skylight': S(skylight()); break;
      case 'solar': S(solar()); break; case 'coop': S(coop()); break; case 'pigeons': S(pigeons(s.seed + (ux * 11 | 0))); break; case 'laundry': S(laundry(s.seed + (uz * 3 | 0))); break;
      case 'tub': S(hotTub()); break; case 'chair': S(lawnChair(YARD[(s.seed + (ux * 5 | 0)) % YARD.length])); break; case 'umbrella': S(umbrella(YARD[(s.seed >> 2) % YARD.length]), 0); break;
      case 'grill': S(grill()); break; case 'bed': S(planterBed(s.seed + (uz * 9 | 0))); break; case 'pot': S(potPlant(ux * 13 | 0)); break; case 'tent': S(tent(YARD[(s.seed >> 1) % YARD.length])); break;
      case 'kpool': S(kiddiePool()); break; case 'speaker': S(speaker(), 0); break; case 'hoop': S(hoop(), 0); break; case 'crate': S(milkCrate(PAL.red)); break; case 'couch': S(couch(YARD[(s.seed >> 3) % YARD.length])); break;
      case 'can': S(trashCan(0x25b84c)); break;
    } }
  for (const p of plan.people) { const onDeck = plan.deck && p.x > plan.deck.x0 && p.x < plan.deck.x1 && p.z > plan.deck.z0 && p.z < plan.deck.z1; A.life.push({ x: p.x, y: onDeck ? T : top, z: p.z, ry: p.ry, act: p.act, seed: s.seed + (unshift(p.x, p.z)[0] * 31 | 0) }); }   // (SPREAD pin: today's x)
}
