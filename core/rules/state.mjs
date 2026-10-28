// Shared pieces of the rules core: places, the event record, the ledger moves, and "the rarest piece".
// Everything here is pure: no clock, no randomness, nothing outside core/ (GAME.md §23).
import { N } from '../numbers.mjs';

// GAME.md §6: the eight districts, by the city kit names (the district names are slime's to change).
export const DISTRICTS = ['downtown', 'strip', 'industrial', 'suburbs', 'docks', 'junkyard', 'mall', 'forest'];
export const DISTRICT_NAMES = {
  downtown: 'Glasswall', strip: 'Neon Row', industrial: 'The Yards', suburbs: 'Pleasantview',
  docks: 'Low Tide Docks', junkyard: 'The Heap', mall: 'Millennium Mall', forest: 'Blackpine Woods',
};
// R11 (slime, 10-21): a hustle is small-time crime against the city's own people, in any district, and the district
// decides its kind: a fixed word on the record (`how`) for the cards, the board and the show (Claude's call, 10-21).
export const HUSTLE_HOW = {
  downtown: 'stickup', strip: 'mugging', industrial: 'crates', suburbs: 'cars',
  docks: 'boats', junkyard: 'scrap', mall: 'shoplift', forest: 'campers',
};
// R11: what a hustle takes, from the district's police level tonight and the other agents hustling there tonight
// (N.hustle: the take by level, less the crowd for each other hustler, never below the floor); night 7's Payday doubles
// it, as it doubled the shift's wage. The one owner of the sum: the night pays it, and the bots and the briefing read it.
export function hustleTake(level, crowd, payday = false) {
  const h = N.hustle;
  const take = Math.max(h.floor, h.take[level] - h.crowd * crowd);
  return payday ? 2 * take : take;
}
// R11: a hustle adds work heat (N.workHeat) in a district that's normal or heavy tonight, or that a Cop patrols tonight.
export const hustleStar = (level, patrolled = false) => (level !== 'lawless' || patrolled ? N.workHeat : 0);
// §15: the walk to the dock goes through Glasswall, through The Yards, or along the waterfront past The Heap.
export const ROUTES = ['downtown', 'industrial', 'junkyard'];
// §6: every agent's home is in Pleasantview.
export const HOMES = 'suburbs';
export const TIERS = ['common', 'rare', 'epic', 'grail'];
export const TIER_RANK = { common: 0, rare: 1, epic: 2, grail: 3 };
export const LEVELS = ['lawless', 'normal', 'heavy'];
export const LAST_NIGHT = N.nights;
// §13, §15 (R4-4, GAP gap.ferryJail): the first night whose arrest still holds its agent in jail when the ferry leaves.
// 'released': at dawn on day 14 everyone still in jail walks out, so only night 14's own arrests miss the boat;
// 'missed': any arrest whose jailNights outlast night 13 (night.mjs, dawn, keeps the sentence). SUDO's last write
// (errand.mjs) and the bots' bail reserve read it.
export const offBoatFrom = () => (N['gap.ferryJail'] === 'released' ? LAST_NIGHT : LAST_NIGHT - N.jailNights);
// §9, §13: a tip or a bribe names the shipment crate as the grab's target, and (layer 4, call 6) the Evidence Vault as
// the vault job's (GAP gap.tip, gap.bribe).
export const CRATE = 'crate';
export const VAULT = 'vault';
// Time on the record, in half-days: day d is 2d, the night after it is 2d+1. "24 hours later" is +2 (§19).
export const DAY15 = 2 * (LAST_NIGHT + 1);

export const clone = s => structuredClone(s);
export const byId = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
// An id from an errand or a play finds only a table's own entries, so `__proto__`, `constructor`, `toString` and every
// other name all objects inherit is as unknown as any other id (§33). The entry, or null.
export const own = (table, id) => (typeof id === 'string' && Object.hasOwn(table, id) ? table[id] : null);
export const agentIds = s => Object.keys(s.agents).sort(byId);
export const half = n => Math.floor(n / 2);

// The record (§23): every event is typed, and its visibility is set when it happens (§19).
// vis.to is 'all' (public now) or the agents who see it live (and their owners); vis.pub is when everyone sees it.
export function emit(s, out, type, fields, vis) {
  const e = { n: s.seq, t: s.clock, day: Math.floor(s.clock / 2), type, ...fields, vis };
  s.seq += 1;
  out.push(e);
  return e;
}
export const toAll = s => ({ to: 'all', pub: s.clock });
export const toFew = (s, ids, delay = 2) => ({ to: [...new Set(ids)].sort(byId), pub: s.clock + delay });
export const toFewUntil = (ids, pub) => ({ to: [...new Set(ids)].sort(byId), pub });

// Money in and out of the island (§9). Everything else only moves between holders.
export function cashIn(s, source, amount) {
  s.money.in[source] = (s.money.in[source] || 0) + amount;
}
export function cashOut(s, sink, amount) {
  s.money.out[sink] = (s.money.out[sink] || 0) + amount;
}

// Goods (§9, layer 2): counts by kind, held by agents and crew stashes; no ids, since a unit is a unit (GAP gap.goods).
// §11, layer 3: every dose is one of the six drugs, each its own kind, in §11's order (GAP gap.doses). §9, layer 4: a
// forged warrant is goods too (GAP gap.warrants).
export const DRUGS = Object.keys(N.walks);
export const GOODS = ['chems', 'parts', ...DRUGS, 'guns', 'lockpicks', 'warrants'];
export const dosesOf = h => DRUGS.reduce((t, d) => t + (h.goods[d] || 0), 0);
// The first n doses in goods, in §11's order: what a Dealer carries to its corner (GAP gap.doses).
export function dosesUpTo(goods, n) {
  const out = {};
  for (const d of DRUGS) {
    const k = Math.min(n, goods[d] || 0);
    if (k) out[d] = k;
    n -= k;
  }
  return out;
}
// Adds n of a kind to a holder (takes, if n is negative); a kind at 0 leaves the map. §11 (layer 3): HALLU's lots come
// with the doses they're given, and go with them oldest first; an agent's SUDO marks lapse, the newest first, once it
// holds fewer TEMP than marks (GAP gap.hallu, gap.sudo). §9 (layer 4): forged warrants carry their makers in lots the
// same way, under `makers` (GAP gap.warrants). Returns the lots that went.
// §11, HALLU's pool: each dose of a lot takes the next two of its lies in turn, wrapping round, so a lot's lies start at
// its next dose's two, and what stays of a lot once doses go starts two lies a dose on (GAP gap.hallu).
const LOTS = { hallu: 'lots', warrants: 'makers' };
const turned = (xs, k) => [...xs.slice(k % xs.length), ...xs.slice(0, k % xs.length)];
export function addGoods(h, kind, n, lots = []) {
  const left = (h.goods[kind] || 0) + n;
  if (left) h.goods[kind] = left;
  else delete h.goods[kind];
  if (h.marks) h.marks = h.marks.slice(0, h.goods.temp || 0);
  if (h.marks && !h.marks.length) delete h.marks;
  const key = LOTS[kind];
  if (key && lots.length) h[key] = [...(h[key] || []), ...lots];
  const out = [];
  for (let k = key ? -n : 0; k > 0 && h[key];) {
    const l = h[key][0];
    const m = Math.min(k, l.n);
    out.push({ ...l, n: m });
    k -= m;
    l.n -= m;
    if (!l.n) h[key].shift();
    else if (l.lies) l.lies = turned(l.lies, 2 * m);
    if (!h[key].length) delete h[key];
  }
  return out;
}
export function moveGoods(from, to, goods) {
  for (const [k, n] of Object.entries(goods)) addGoods(to, k, n, addGoods(from, k, -n));
}
export const holdsGoods = (h, goods) => Object.entries(goods).every(([k, n]) => (h.goods[k] || 0) >= n);
// §9 (R4-3): the goods an agent's orders at the city's shop bring it at tonight's lock, before the plays lock, by kind
// (GAP gap.marketOrder).
export function dueOf(s, id) {
  const out = {};
  for (const o of s.orders || []) if (o.by === id && o.side === 'shop') out[o.kind] = (out[o.kind] || 0) + o.units;
  return out;
}
// The same goods in GOODS order, so the record never depends on the order they arrived in.
export const sortGoods = g => Object.fromEntries(GOODS.filter(k => g[k]).map(k => [k, g[k]]));
// Goods counted under the names `as` gives their kinds.
export function relabel(goods, as) {
  const out = {};
  for (const [k, n] of Object.entries(goods)) out[as(k)] = (out[as(k)] || 0) + n;
  return out;
}
// §11, §19 (slime: "a drug's name never shows live"): to anyone it doesn't involve, a drug shows live only as a dose,
// the word §9 uses for the crate (GAP gap.doses).
export const drugsAsDoses = goods => relabel(goods, k => (DRUGS.includes(k) ? 'doses' : k));
// Goods into and out of the island, by source and sink, as cash is (§9). side: 'in' or 'out'.
export function bookGoods(s, side, name, kind, n) {
  const g = (s.goods[side][name] ||= {});
  g[kind] = (g[kind] || 0) + n;
}

// Pieces. A copy's holder is one of: list, agent, crew, vault, fence, minted, gone, rollover (§3, §9, §12, §13, §15).
export const piecesOf = (s, id) =>
  Object.keys(s.copies).filter(k => s.copies[k].holder.k === 'agent' && s.copies[k].holder.id === id).sort(byId);
export const crewPieces = (s, crewId) =>
  Object.keys(s.copies).filter(k => s.copies[k].holder.k === 'crew' && s.copies[k].holder.id === crewId).sort(byId);
export const wornOf = (s, id) => Object.values(s.agents[id].outfit).sort(byId);
export const unwornOf = (s, id) => {
  const worn = new Set(wornOf(s, id));
  return piecesOf(s, id).filter(k => !worn.has(k));
};
// §19: an agent's stash and cash, as the 24-hour record shows them at dawn and a lookout shows them now: its cash, its
// unworn pieces, its goods and, for a crew stash's keeper, the crew stash.
export function holdingsOf(s, id) {
  const a = s.agents[id];
  const brief = k => ({ copy: k, trait: s.copies[k].trait, tier: s.copies[k].tier });
  const c = a.crew && s.crews[a.crew] && s.crews[a.crew].keeper === id ? s.crews[a.crew] : null;
  return {
    agent: id, cash: a.cash, home: !a.evicted, pieces: unwornOf(s, id).map(brief), goods: sortGoods(a.goods),
    crew: c ? { id: c.id, cash: c.cash, pieces: crewPieces(s, c.id).map(brief), goods: sortGoods(c.goods) } : null,
  };
}
// GAP gap.crewStash: the stash is kept at a member's home whenever one has a home: its keeper's while it has one, else
// the lowest id's with one. With none, it stays with its keeper (one that left hands it to the lowest id).
export function rehome(s, c) {
  const housed = c.members.filter(m => !s.agents[m].evicted).sort(byId);
  if (!c.members.includes(c.keeper)) c.keeper = (housed.length ? housed : c.members.slice().sort(byId))[0];
  else if (s.agents[c.keeper].evicted && housed.length) c.keeper = housed[0];
}
// The crew whose stash an agent carries, or null: a stash with no member's home to keep it in travels with its keeper,
// so whatever reaches what the keeper carries reaches it (GAP gap.crewStash).
export const stashOn = (s, id) => {
  const c = s.agents[id].crew && s.crews[s.agents[id].crew];
  return c && c.keeper === id && s.agents[id].evicted ? c : null;
};
// §4 (layer 4): a fake has no ability (GAP gap.fakes).
export const abilityOf = (s, copyId) => (s.copies[copyId].fake ? null : s.traits[s.copies[copyId].trait].ability);
export const wears = (s, id, ability) => wornOf(s, id).some(k => abilityOf(s, k) === ability);
export const lastPrice = (s, copyId) => s.traits[s.copies[copyId].trait].last || 0;
// Original list purchase value belongs to this copy. A later sale, gift or fence transaction never reprices it.
// Test-granted/unsold pieces carry no purchase value. Keep lastPrice separate: it owns the approved robbery tie rule.
export const copyPaid = (s, copyId) => s.copies[copyId].hist.find(h => h.what === 'bought')?.price ?? s.copies[copyId].sold ?? 0;

// §4: "Ties for the rarest": the piece the play named, then what it last sold for on the list, then the lower id. Only
// a real piece counts: a fake never does (layer 4, GAP gap.fakes).
export function rarest(s, copyIds, want) {
  const real = copyIds.filter(k => !s.copies[k].fake);
  if (!real.length) return null;
  const top = Math.max(...real.map(k => TIER_RANK[s.copies[k].tier]));
  const tied = real.filter(k => TIER_RANK[s.copies[k].tier] === top);
  if (want) {
    const named = tied.find(k => k === want || s.copies[k].trait === want);
    if (named) return named;
  }
  return tied.slice().sort((x, y) => lastPrice(s, y) - lastPrice(s, x) || byId(x, y))[0];
}

export function holderLabel(h) {
  return h.id ? `${h.k}:${h.id}` : h.k;
}

// The one way a copy changes holder. It leaves any outfit or bag it was in, and its history gets a line.
export function moveCopy(s, copyId, holder, what, extra = {}) {
  const c = s.copies[copyId];
  if (c.holder.k === 'agent') {
    const a = s.agents[c.holder.id];
    for (const slot of Object.keys(a.outfit)) if (a.outfit[slot] === copyId) delete a.outfit[slot];
    a.carry = a.carry.filter(k => k !== copyId);
  }
  c.holder = { ...holder };
  c.hist.push({ t: s.clock, what, to: holderLabel(holder), ...extra });
}

// §6, §13: the police level a district has tonight, with night 7's midseason event on top.
export function levelTonight(s, place, night) {
  if (night === 7 && s.midseason === 'blackout') return 'lawless';
  if (night === 7 && s.midseason === 'crackdown') return 'heavy';
  return s.districts[place].level;
}

// §11: how an agent walks on what it took today: the walk of the first drug in §11's order that has one, and none with
// shades on (GAP gap.high).
export function walkOf(s, id) {
  const d = s.agents[id].high.find(x => N.walks[x]);
  return d && !wears(s, id, 'shades') ? N.walks[d] : null;
}

// §11: whether an agent took a drug since dawn, as far as it can tell: SUDO, sold as TEMP, passes for TEMP (GAP gap.sudo).
export const tookToday = (a, d) => a.high.includes(d) || (d === 'temp' && a.high.includes('sudo'));

// §12 (R5-terms): where a promise stands, read from its own record, the one owner of that fact: errand.mjs makes it,
// and night.mjs falls its cut due and counts the walk by this. A promise is 'open' until its night is played. A cut
// that fell due for a won play is then 'owed' (`owed`: the dollars still unpaid) or 'paid', until dawn on day
// `walkAt`, the day after its last day (`due`), when a cut still owed counts as walked out on.
export function promiseState(p) {
  if (p.what !== 'pay' || !Number.isInteger(p.due)) return { state: 'open' };
  const owed = Math.max(0, p.cash - p.paid);
  return { state: owed > 0 ? 'owed' : 'paid', owed, walkAt: p.due + 1 };
}

export const isJailed = (s, id) => !!s.agents[id].jail;
export const hasHome = (s, id) => !s.agents[id].evicted;
export const messageLimit = (s, id) => N.messages + (wears(s, id, 'burner') ? N.burnerMessages : 0);
export const listOpen = (s, traitId, night) => night <= N.listLastNight && s.traits[traitId].opens <= night;
export const listLeft = (s, traitId) => s.traits[traitId].copies.filter(k => s.copies[k].holder.k === 'list').length;
