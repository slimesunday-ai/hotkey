// Day 0 (GAME.md §2): the ferry over, every agent picks a trade, and the whole drop is posted.
// This is the one rules file that uses the seed: it picks the drop's traits and their MOCK tiers (§4, §23).
import { N } from '../numbers.mjs';
import { rng, shuffle } from '../rng.mjs';
import { DISTRICTS, TIERS, emit, toAll, byId, addGoods, bookGoods, cashIn } from './state.mjs';
import { emptyMemory } from './memory.mjs';
import { marketItems } from './market.mjs';

// §4's ten placeholder abilities, until slime picks the items. `layer` is when its rule exists (§24).
export const ABILITIES = [
  { id: 'shades', slot: 'eyewear', layer: 3, words: ['shade'] },
  { id: 'vest', slot: 'top', layer: 1, words: ['vest'] },
  { id: 'hoodie', slot: 'top', layer: 1, words: ['hoodie', 'hood'] },
  { id: 'burner', slot: 'held', layer: 1, words: ['phone', 'burner', 'flip'] },
  { id: 'earpiece', slot: 'ears', layer: 1, words: ['bud', 'piece', 'phone'] },
  { id: 'skimask', slot: 'hat', layer: 1, words: ['mask', 'balaclava', 'ski'] },
  { id: 'knuckles', slot: 'acc', layer: 1, words: ['knuckle', 'brass'] },
  { id: 'runners', slot: 'shoes', layer: 1, words: ['runner', 'sneaker'] },
  { id: 'workboots', slot: 'shoes', layer: 2, words: ['work boot', 'workboot', 'boot'] },
  { id: 'apron', slot: 'top', layer: 2, words: ['apron'] },
];
export const TRADES = ['smuggler', 'chemist', 'dealer', 'gunrunner', 'cop'];
// §9: the trade whose night's work uses each kind of goods the trades pass on: a cook takes chems, a build parts, a deal
// doses. One owner: the briefing's goods line and the bench's bots both read it here.
export const USED_BY = { chems: 'chemist', parts: 'gunrunner', doses: 'dealer' };
export const MIDSEASON = ['blackout', 'crackdown', 'payday'];

// opts: seed, rule ('A' | 'B', §8), midseason (§13), items (core/data/items.json's list), agents: [{ id, name, trade, driver }]
export function newSeason({ seed, rule = 'A', midseason = 'blackout', items, agents }) {
  if (!Number.isSafeInteger(N.stake) || N.stake < 0) throw new Error('stake must be nonnegative whole dollars');
  if (!['A', 'B'].includes(rule)) throw new Error(`unknown backing rule ${rule}`);
  if (!MIDSEASON.includes(midseason)) throw new Error(`unknown midseason event ${midseason}`);
  const s = {
    v: 1, seed, rule, midseason, day: 0, clock: 0, seq: 0, over: false,
    agents: {}, traits: {}, copies: {}, crews: {}, sitdowns: {}, promises: [], offers: [], pending: [],
    vault: { cash: 0 }, money: { in: {}, out: {} }, goods: { in: {}, out: {} }, nextId: { crew: 1, sitdown: 1, promise: 1, bounty: 1, order: 1 },
    districts: Object.fromEntries(DISTRICTS.map(d => [d, { level: N.levels[d], base: N.levels[d] }])),
    // §9: the city's shop and buyer, as steps along each item's curve.
    market: Object.fromEntries(['shop', 'buyer'].map(side => [side, Object.fromEntries(marketItems(side).map(k => [k, 0]))])),
    // §9 (R4-3): the day's orders at the city's shop and buyer, each holding its cash or its goods, until the lock fills
    // them together (GAP gap.marketOrder).
    orders: [],
    // §9: the corners and who holds each one (nobody, on day 0).
    corners: Object.fromEntries(Object.keys(N.corners).sort(byId).map(c => [c, { holder: null }])),
    // §9: the shipment crate at the docks, posted the morning of its night (none on day 0).
    crate: null,
    // §9: the fence's listings and swaps, by id, until they settle or go back.
    fence: { next: 1, deals: {} },
    // §13: tonight's tips and bribes (layer 3), until dawn.
    tips: [], bribes: [],
    // §10: the open bounties, in the order they were posted, until one pays or night 14 (layer 3).
    bounties: [],
  };

  if (N.stake) s.stake = N.stake;
  for (const a of agents.slice().sort((x, y) => byId(x.id, y.id))) {
    if (!TRADES.includes(a.trade)) throw new Error(`unknown trade ${a.trade}`);
    s.agents[a.id] = {
      id: a.id, name: a.name, trade: a.trade, driver: a.driver || 'bot', cash: N.stake, heat: 0, evicted: false, jail: null,
      crew: null, outfit: {}, carry: [], msgs: 0, vestUsed: false, listening: null, boarded: false, mainland: 0,
      goods: {}, tab: 0, memory: emptyMemory(),
      // §11 (layer 3): the drugs taken since dawn, days running on each, hooks, tonight's crash, clean dawns in a row,
      // and what CLEAR wiped.
      high: [], streak: {}, hooked: [], crash: false, clean: 0, wiped: null,
    };
    if (N.stake) cashIn(s, 'stake', N.stake);
    // §9: each trade starts with its small kit (§38).
    for (const [k, n] of Object.entries(N.kits[a.trade])) {
      addGoods(s.agents[a.id], k, n);
      bookGoods(s, 'in', 'kit', k, n);
    }
  }

  // The drop (§3), MOCK tiers from the seed (§4): the abilities' commons first, then the rest of each tier.
  const r = rng(seed, 'drop');
  const pool = items.filter(i => i.kind === 'item').sort((x, y) => byId(x.id, y.id));
  const taken = new Set();
  const chosen = [];
  for (const ab of ABILITIES) {
    const inSlot = pool.filter(i => i.slot === ab.slot && !taken.has(i.id));
    const named = inSlot.filter(i => ab.words.some(w => i.name.toLowerCase().includes(w) || i.id.includes(w)));
    const it = shuffle(r, named.length ? named : inSlot)[0];
    taken.add(it.id);
    chosen.push({ item: it, tier: 'common', ability: ab.id });
  }
  const rest = shuffle(r, pool.filter(i => !taken.has(i.id)));
  for (const tier of TIERS.slice().reverse()) {
    const want = N.drop[tier].traits - chosen.filter(c => c.tier === tier).length;
    for (let i = 0; i < want; i++) chosen.push({ item: rest.shift(), tier, ability: null });
  }

  let k = 1;
  for (const c of chosen.sort((x, y) => byId(x.item.id, y.item.id))) {
    const [open, floor] = N.price[c.tier];
    const t = {
      id: c.item.id, slot: c.item.slot, name: c.item.name, tier: c.tier, ability: c.ability,
      opens: N.waves[c.tier], open, floor, price: open, last: null, copies: [],
    };
    for (let i = 0; i < N.drop[c.tier].copies; i++) {
      const id = `k${String(k++).padStart(3, '0')}`;
      t.copies.push(id);
      s.copies[id] = { id, trait: t.id, slot: t.slot, tier: t.tier, holder: { k: 'list' }, sold: null, hist: [{ t: 0, what: 'drop', to: 'list' }] };
    }
    s.traits[t.id] = t;
  }

  const out = [];
  emit(s, out, 'season', {
    seed, rule, midseason, nights: N.nights, mock: true,
    agents: Object.values(s.agents).map(a => ({ id: a.id, name: a.name, trade: a.trade, driver: a.driver })),
    drop: Object.values(s.traits).map(t => ({
      trait: t.id, slot: t.slot, name: t.name, tier: t.tier, copies: t.copies.length, ability: t.ability,
      opens: t.opens, price: t.price, floor: t.floor,
    })),
  }, toAll(s));
  s.day = 1;
  s.clock = 2;
  return { state: s, events: out };
}
