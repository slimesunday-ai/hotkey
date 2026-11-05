// AI City · HOMES pass (2026-09-28) · WHAT GOES IN AN OWNER'S SLOTS until the sim has real inventories: plausible gear, collectibles and
// trophies by tier and wealth (rich homes look rich), seeded by the home so a visit always shows the same things. Pure, worker-safe.
//   fillsFor(A, { tier, wealth 0–1, sec: Set, seed, show }) → one { id, variant, state? } | null per layout slot
// A slot built for a sim piece (its demo is a dog bed, a keypad, a gate, a camera or a safe) takes that piece only when the home has that
// security. `show` (a vacant Gatehill unit, staged by the realtor) fills every slot with the layout's own demo piece.
import { OBJECTS, byId } from '../home/index.js';
// (the drugs, as the card's Pockets names them: one list on the city side)
import { DRUGS } from '../../ui/record/format.js';

const RANK = { common: 0, event: 1, rare: 1, epic: 2, grail: 3, legendary: 4, '1of1': 5 };
const CAP = { trailer: 1.2, apartment: 2.2, house: 3.2, penthouse: 5, mainland: 4.6 };   // (mainland: the collectors' neighbourhood)   // the best rarity a tier's owner plausibly has
const SIMSLOT = { dog: 'dog', alarm: 'alarm', cctv: 'alarm', door: 'door', safe: 'safe' };
const h32 = (a, b) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function fillsFor(A, { tier, wealth = 0, sec = new Set(), seed = 1, show = false }) {
  const used = new Set(), cap = CAP[tier] ?? 2, target = Math.max(0, Math.min(1, wealth)) * cap;
  const n = show ? A.slots.length : Math.round(A.slots.length * Math.min(1, .25 + wealth * 1.1));   // poorer homes leave slots empty
  const order = A.slots.map((s, i) => [h32(seed, i + 11), i]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
  const out = A.slots.map(() => null); let filled = 0;
  for (const i of order) { const s = A.slots[i], demo = byId.get(s.demo); if (!demo) continue;
    if (demo.sim && SIMSLOT[demo.sim]) { if (sec.has(SIMSLOT[demo.sim])) out[i] = { id: demo.id, variant: s.variant ?? 0, state: demo.sim === 'alarm' ? 'armed' : undefined }; continue; }
    if (show) { out[i] = { id: demo.id, variant: s.variant ?? 0 }; continue; }
    if (filled >= n) continue;
    const kind = demo.game?.kind ?? 'collectible', kinds = kind === 'trophy' ? ['trophy'] : kind === 'gear' ? ['gear', 'collectible'] : ['collectible', ...(s.place === 'surface' || s.place === 'wall' ? ['trophy'] : [])];
    let best = null, bs = 1e9;
    for (const o of OBJECTS) { const g = o.game; if (!g || !kinds.includes(g.kind) || o.place !== s.place || used.has(o.id) || o.sim) continue;
      if (o.foot[0] > s.foot[0] || o.foot[1] > s.foot[1]) continue;
      const sc = Math.abs((RANK[g.rarity] ?? 1) - target) + (o.tiers.includes(tier) || (tier === 'mainland' && (o.tiers.includes('house') || o.tiers.includes('penthouse'))) ? 0 : 1.2) + (g.kind === kind ? 0 : .6) + (o.cat === demo.cat ? 0 : .9) + h32(seed * 7 + i, o.id.length * 131 + o.id.charCodeAt(1)) * .9;
      if (sc < bs) { bs = sc; best = o; } }
    if (!best) continue; used.add(best.id); filled++;
    out[i] = { id: best.id, variant: Math.floor(h32(seed, i + 101) * best.variants), rarity: best.game.rarity, kind: best.game.kind }; }
  return out;
}
// wealth 0–1 from what the state knows: the tier they live at, their marks (MARKs made physical) and their money — the owner's cash and the
// stash at home where the state carries them (demo.json). The live sim never does: its public view (GET /state, 2026-10-01) has no cash
// or stash, and the live feed passes neither on. There a home doesn't read as broke (half its slots empty): the tier's typical money
// (demo.json's median per tier) stands in, nudged by what anyone can see — the security installed and the drip worn.
const PRIOR = { trailer: .3, apartment: .55, house: .6, penthouse: .8, mainland: .85 };
export function wealthOf(tier, agent, home) { const base = { trailer: .1, apartment: .25, house: .4, penthouse: .75, mainland: .8 }[tier] ?? .3;
  const cash = typeof agent?.cash === 'number' ? agent.cash : null, stash = typeof home?.stash === 'number' ? home.stash : null, marks = Array.isArray(agent?.marks) ? agent.marks.length : 0;
  const money = cash !== null || stash !== null ? Math.min(1, ((cash ?? 0) + (stash ?? 0) * 1.5) / 220)
    : Math.min(1, (PRIOR[tier] ?? .4) + (home?.sec?.size ?? 0) * .05 + (typeof agent?.drip === 'number' ? agent.drip : 0) * .04);
  return Math.max(0, Math.min(1, base * .55 + money * .45 + marks * .05)); }
// what the overlay says about a piece: its picker name, rarity and kind
export const infoOf = id => { const o = byId.get(id); return o ? { name: o.name, rarity: o.game?.rarity ?? '', kind: o.game?.kind ?? '' } : null; };

// C2-indoors (2026-10-31) · WHAT A RECORD HOME'S SLOTS SHOW: only what the record has already disclosed (GAME.md §19, slime 10-30: "you
// see them cook or hide something under the floor, but what, how much and which drug land on the tape a day later"). `held` is the last
// disclosed holdings receipt (panel-data.js tapeAt(...).holdings, as the card's Pockets reads it: its typed fields), or null.
//   none disclosed   neutral: a stash slot shows its stash shut (every home has one, §: the sim keeps a stash per home), a gear slot
//                    its gear (a console, a cook rig, a light: no holding in it), every trophy, collectible, cash and product slot empty
//   disclosed        kind by kind, only what the receipt itself lists (C2-indoors2, the 10-31 review: a receipt of {parts: 1} had filled the
//                    product slot with SUDO baggies): the stash open and a cash piece (the money counter) when it has cash; the baggies
//                    only for a drug it names that has baggies of its own (crime.js: SUDO lime, TEMP pink, HALLU cyan), in that drug's
//                    colour (the most it holds; DRUGS' order on a tie); a scale or a rolling tray for any dose it lists (a named drug or
//                    unnamed doses); as many trophy and collectible slots as it lists pieces, each the slot's own piece. Chems, parts,
//                    guns, lockpicks and warrants have no prop here: their slots stay empty (a gun rack or a wall of pieces shows guns, so
//                    it is never filled as a trait piece either)
// Each slot's fill carries `shows` (null | 'cash' | 'goods' | 'pieces') and, for goods, `good` (the receipt's goods key it shows):
// what of the receipt it shows (tools/indoorcheck.mjs, tools/indoorleakcheck.mjs read them).
const CASHY = new Set(['money-counter', 'cash-stack', 'duffel-cash', 'trophy-in-the-bank', 'counterfeit-press']), DOSE_GEAR = new Set(['scale-digital', 'rolling-tray']);
const GUNS = new Set(['gun-rack', 'piece-wall']), BAGGIES = 'baggies-product';
// baggies-product's variants, by its vnames (home/crime.js): the drug each colour is. TRUTH, CLEAR and FIREWALL have none
export const BAGGIE = Object.freeze({ sudo: 0, temp: 1, hallu: 2 });
export function recordFills(A, held) {
  const r = held?.fields ?? null, cash = r ? +(r.cash ?? 0) : 0, n = k => r ? +(r.goods?.[k] ?? 0) || 0 : 0;
  const doses = [...DRUGS, 'doses'].filter(k => n(k) > 0), bag = DRUGS.filter(k => Object.hasOwn(BAGGIE, k) && n(k) > 0).sort((a, b) => n(b) - n(a))[0] ?? null;
  let pieces = r ? (r.pieces?.length ?? 0) : 0;
  return A.slots.map((s, i) => { const o = byId.get(s.demo); if (!o) return null; const kind = o.game?.kind ?? null, v = s.variant ?? 0;
    if (o.cat === 'stash' || o.sim === 'stash') return { id: o.id, variant: v, state: cash > 0 ? 'open' : 'closed', shows: cash > 0 ? 'cash' : null };
    if (o.sim) return null;   // (a safe, the dog, an alarm or a camera: security the record doesn't carry; left out)
    if (CASHY.has(o.id)) return cash > 0 ? { id: o.id, variant: v, shows: 'cash' } : null;
    if (o.id === BAGGIES) return bag ? { id: o.id, variant: BAGGIE[bag], shows: 'goods', good: bag } : null;
    if (DOSE_GEAR.has(o.id)) return doses.length ? { id: o.id, variant: v, shows: 'goods', good: doses[0] } : null;
    if (GUNS.has(o.id)) return null;
    if (kind === 'gear' || (!kind && o.cat === 'lights')) return { id: o.id, variant: v, shows: null };
    if (pieces > 0) { pieces--; return { id: o.id, variant: v, shows: 'pieces' }; }
    return null; });
}
