// Scripted players (GAME.md §25, step 0). Layer 1's: a hustler, a buy-late saver, a turtle, a robber who scouts, a
// robber who guesses, and a crew; and, opt-in, a squatter (the eviction exploit). Layer 2's street adds a bot for each
// trade (Smuggler, Chemist, Dealer, Gunrunner) and a Cop seat that patrols and collars; its robbers and crews also buy
// guns, grab the shipment crate and count the goods a target carries tonight. L2-6's cast gives every seat a trade:
// the buy-late saver, the turtle, the robbers and the crews work theirs on any night their strategy leaves free, and
// the hustler, §27's yardstick, still hustles; in that cast every bot also covers the rent first, takes an
// open corner by the street's pecking order and keeps one gun unsold (L2-6b), and its Cops look for a wanted agent at
// home, back one collar, and collar only when they beat the defence, while the Cop seat saves for a gun (L2-6c). The
// layer3 cast (L3-5a) is the trades cast with the six drugs in play: Chemists cook and sell them, and every seat takes
// one only for its reason; and (L3-5b) its seats tip, rat, bribe, post bounties and hire lookouts, each for its own
// gain. The layer4 cast (L4-4) is the layer3 cast with the big score in play: Gunrunners build and sell forged warrants
// and fakes, crews and robbers job the vault, Cops guard it, and buyers in shades refuse the fakes they can see.
// They read the agent's view, the public rulebook (numbers.mjs) and what they remember of their own earlier
// views, and nothing else (§23). They return the day's errands and tonight's play with a one-line reason: the
// interface R2's local-model agents plug into.
// Their randomness comes from the seed (rng.mjs), so a season replays exactly. What a bot remembers lives in its memo,
// which the runner saves in every checkpoint, so a resumed season plays the same.
import { N } from '../numbers.mjs';
import { rng, pick, shuffle } from '../rng.mjs';
import { DISTRICTS, ROUTES, HOMES, DRUGS, CRATE, LEVELS, offBoatFrom, hustleTake, hustleStar } from '../rules/state.mjs';
import { CRATE_AT, VAULT_AT } from '../rules/plays.mjs';
import { cornerTakings } from '../rules/market.mjs';
import { TRADES, USED_BY } from '../rules/setup.mjs';
import { worksOut } from '../rules/fights.mjs';
import { TERM_SAID, whatOf } from '../rules/errand.mjs';

export const TYPES = ['hustle', 'buylate', 'turtle', 'scout', 'guess', 'crew', 'squatter', 'smuggler', 'chemist', 'dealer', 'gunrunner', 'cop'];
const RANK = { common: 0, rare: 1, epic: 2, grail: 3 };
const ROBBER_KIT = ['knuckles', 'runners', 'skimask', 'vest'];
// R5-terms: a bot says a buy as players say it, `buy`, and reads a buy in either word, as the rules read it (the record
// keeps `trade`; errand.mjs TERM_SAID, whatOf).
const BUY = TERM_SAID.trade;
const isBuy = t => !!t && whatOf(t.what) === 'trade';
const CUT = 20;
// How often a wanted robber still risks a district with cops (bot setting, not a game number).
const BOLD = 0.4;
// A robber picks at random among the targets worth at least this share of the best one (bot setting). Every robber
// values the board the same way, so with a fixed pick they all crowd the richest target, and a crowded fight is a tie
// that fails (§8). Crews still take the best.
const SPREAD = 0.5;
// Hired muscle (§12), bot settings, not game numbers: a robber that can't win alone asks this many agents to back it,
// offers last night's wage plus this premium, and keeps the cut instead of paying (a walk) at these odds.
export const HIRE = { asks: 1, premium: 15, stiff: 0.25 };
// The bots that take a hired-muscle job when the offer beats a night's wage.
const MUSCLE = ['hustle', 'buylate', 'turtle'];

// --- what a player can read off its view ---------------------------------------------------------------------------
const listOf = (v, trait) => v.board.list.find(t => t.trait === trait);
// A piece's worth, as the board shows it: what it last sold for, or today's price.
const worth = (v, trait) => {
  const t = listOf(v, trait);
  return t ? t.last || t.price : 0;
};
// The pieces a fit shows that a hit could take: all of them, but a fake its view marks (L4-4: shades, or its maker).
const realFit = a => (a.fit || []).filter(p => !p.fake);
const fitWorth = (v, a) => realFit(a).reduce((m, p) => Math.max(m, worth(v, p.trait)), 0);
const openToBuy = (v, budget) => v.board.list.filter(t => t.opens <= v.day && v.day <= 12 && t.left > 0 && t.price <= budget);
// An offer a little above today's price (a seeded premium up to 20%), so equal bids don't all tie for the last copy
// (§3: an exact tie for the last copy means nobody gets it tonight).
const offerFor = (r, t, budget) => ({ kind: 'offer', trait: t.trait, amount: Math.max(t.price, Math.min(budget, Math.ceil(t.price * (1 + 0.2 * r())))) });
// One of the few cheapest, picked by the seed, so bots don't all chase the same trait.
const cheapPick = (r, list) => pick(r, list.slice().sort((x, y) => x.price - y.price || (x.trait < y.trait ? -1 : 1)).slice(0, 4));
const seenAt = (v, id) => (v.sightings[id] || []).filter(x => x.place !== 'home');
const robbedLastNight = v => v.events.some(e => e.type === 'robbed' && e.agent === v.me.id && e.night === v.day - 1);
const others = v => v.board.agents.filter(a => a.id !== v.me.id && !a.jailed && !a.boarded);
// An agent's latest stash-and-cash record that has gone public (§19's 24-hour record), or null.
const holdingsOf = (v, id) => v.events.filter(e => e.type === 'holdings' && e.agent === id).slice(-1)[0] || null;
const byNum = (x, y) => Number(x.id.slice(1)) - Number(y.id.slice(1));
// R11: tonight's hustle as a bot sees it, from public facts only: tonight's police levels (the board), everyone's heat
// (the board), and the record's latest public hustles and hits. It places the latest night's hustlers that are still
// free (before the first, everyone on the board), and itself, in id order, each where the take is best given those
// placed before it (state.mjs hustleTake), so every bot reading the same facts spreads the same way and none piles onto
// one district. An agent at `cool` stars or more
// takes only a district whose star it wouldn't get (hustleStar: a lawless one): the hustler bot at N.wantedAt - 1, where
// the star would make it wanted (the brief's rule), and the others it places the same way; and an agent robbed there
// last night hustles somewhere else. `cool` is the bot's own (coolAt). { place, level, take, star }: the take counts
// everyone placed with it, and Payday.
const hustleMemo = new WeakMap();
export function hustleChoice(v, cool = N.wantedAt - 1) {
  const memo = hustleMemo.get(v) || new Map();
  hustleMemo.set(v, memo);
  if (memo.has(cool)) return memo.get(cool);
  const me = v.me.id;
  const levels = v.board.tonight || v.board.police;
  const hs = v.events.filter(e => e.type === 'hustle');
  const night = hs.length ? Math.max(...hs.map(e => e.night)) : null;
  const board = Object.fromEntries(v.board.agents.map(a => [a.id, a]));
  const free = id => id === me || (!!board[id] && !board[id].jailed && !board[id].boarded);
  // Before any hustle is on the record (night 1), every agent on the board might hustle, so it places them all.
  const prior = night === null ? v.board.agents.map(a => a.id) : hs.filter(e => e.night === night).map(e => e.agent);
  const ids = [...new Set([...prior, me])].filter(free).sort((x, y) => Number(x.slice(1)) - Number(y.slice(1)));
  const robbedAt = Object.fromEntries(v.events.filter(e => e.type === 'fight' && e.kind === 'hit' && e.won && e.night === v.day - 1).map(e => [e.target, e.place]));
  const payday = v.day === 7 && v.midseason === 'payday';
  const count = {};
  let mine = null;
  for (const id of ids) {
    const hot = ((board[id] || v.me).heat || 0) >= (id === me ? cool : N.wantedAt - 1);
    const ok = d => d !== robbedAt[id] && (!hot || !hustleStar(levels[d]));
    const pool = DISTRICTS.filter(ok).length ? DISTRICTS.filter(ok) : DISTRICTS;
    const best = pool.reduce((b, d) => (hustleTake(levels[d], count[d] || 0) > hustleTake(levels[b], count[b] || 0) ? d : b));
    if (id === me) mine = { place: best, level: levels[best], star: hustleStar(levels[best]) };
    count[best] = (count[best] || 0) + 1;
  }
  mine.take = hustleTake(mine.level, count[mine.place] - 1, payday);
  memo.set(cool, mine);
  return mine;
}
// R11: the heat at which a bot hustles only where it adds no star. The hustler bot (and the squatter, its variant), or
// with no seat named: at N.wantedAt - 1, where the star would make it wanted. Every other bot holds a trade or crimes
// whose nights a star costs (a cook at home, a hot corner, a hit that would make it wanted), so with any star at all it
// hustles where it adds none (a bot setting, R11's tuning).
const coolAt = (cfg = {}) => (!cfg.type || ['hustle', 'squatter'].includes(cfg.type) ? N.wantedAt - 1 : 1);
// What a night of work has to beat: the take of the hustle the bot would take tonight (hustleChoice; R11: it was last
// night's shift wage). Without a seat, the hustler's.
const hustlePay = (v, cfg) => hustleChoice(v, coolAt(cfg)).take;
// It holds a gun of its own (GAP gap.gear: armed at the lock is +1 a person, §8).
const armed = v => (v.me.goods.guns || 0) >= 1;
// R3-2's jump (GAP gap.jump): the strength a hit adds, a whole number. R3-2c's narrow jump, 'alone', adds none and wins
// a hit's tie on an agent out working alone (§7), which against such an agent is worth a point of strength.
const jumpAll = () => (Number.isInteger(N['gap.jump']) ? N['gap.jump'] : 0);
const jumpAlone = () => N['gap.jump'] === 'alone';
const hitEdge = () => jumpAll() + (jumpAlone() ? 1 : 0);
// L3-2: every dose is one of the six drugs (§11), and these bots name none (L3-5's will), so a dose to them is TEMP, the
// drug a kit, a cook that names none and a crate hold. They read TEMP as `doses`, the word they trade in, and hand it
// over and order it as TEMP; a sale to the city's buyer that names no drug sells TEMP.
const asDoses = g => Object.fromEntries(Object.entries(g).map(([k, n]) => [k === 'temp' ? 'doses' : k, n]));
const asTemp = g => Object.fromEntries(Object.entries(g).map(([k, n]) => [k === 'doses' ? 'temp' : k, n]));

// Wear the best piece in each slot (the honest worker shows off what it bought). `only` limits what it will wear.
function dressBest(v, prefer = [], only = () => true) {
  const fit = {};
  const score = p => (prefer.includes(p.ability) ? 100 : 0) + RANK[p.tier] * 10 + (p.last || 0) / 1000;
  for (const p of v.me.pieces) if (only(p) && (!fit[p.slot] || score(p) > score(fit[p.slot]))) fit[p.slot] = p;
  return Object.fromEntries(Object.entries(fit).map(([slot, p]) => [slot, p.copy]));
}
function dressOnly(v, abilities) {
  const fit = {};
  for (const p of v.me.pieces) if (abilities.includes(p.ability) && !fit[p.slot]) fit[p.slot] = p.copy;
  return fit;
}
const sameFit = (v, fit) => {
  const now = Object.fromEntries(v.me.pieces.filter(p => p.worn).map(p => [p.slot, p.copy]));
  return JSON.stringify(Object.entries(now).sort()) === JSON.stringify(Object.entries(fit).sort());
};

// Housekeeping every bot does: pay its own way back home (the squatter doesn't), bail itself out, keep its outfit. In
// the trades cast (L2-6b) a seat that works the Smuggler trade, which never takes a hustle, pays its way home only when
// it can cover the rent due at dawn as well (`cfg`: its seat), and (L2-6d) a jail that would outlast the ferry is
// bailed as soon as the cash covers it (ferryBail).
function upkeep(v, fit, payRent = true, cfg = {}) {
  const out = [];
  if (payRent && v.me.evicted && v.me.cash >= (cfg.every && cfg.trade === 'smuggler' ? 2 * N.rent : 20)) out.push({ kind: 'rent' });
  if (v.me.jail && v.day <= 12 && v.me.cash >= v.me.jail.bail + 40) out.push({ kind: 'bail', agent: v.me.id });
  else if (v.me.jail && cfg.every) out.push(...ferryBail(v));
  if (fit && !sameFit(v, fit)) out.push({ kind: 'dress', fit });
  return out;
}

// The cash an agent has left once these errands go through: what they pay out, put away or bid (a list offer holds its
// cash until the lock, §3), and what they take back out of the crew stash.
function cashAfter(v, errands) {
  let cash = v.me.cash;
  for (const e of errands) {
    if (e.kind === 'pay' || e.kind === 'offer') cash -= e.amount;
    else if (e.kind === 'stash_put' && e.cash) cash -= e.cash;
    else if (e.kind === 'stash_take' && e.cash) cash += e.cash;
    else if (e.kind === 'rent') cash -= N.rent;
    else if (e.kind === 'bail' && v.me.jail) cash -= v.me.jail.bail;
    else if (e.kind === 'bounty') cash -= e.amount;
    else if (e.kind === 'lookout') cash -= N.lookout;
    else if (e.kind === 'bribe') cash -= N.bribe[v.me.heat];
  }
  return cash;
}

// --- a robber's choice ----------------------------------------------------------------------------------------------------
// The rarest of these pieces by the public rule (§4: tier first, then what it last sold for), or null.
function rarestOf(v, pieces) {
  if (!pieces.length) return null;
  const top = Math.max(...pieces.map(p => RANK[p.tier]));
  return pieces.filter(p => RANK[p.tier] === top).sort((x, y) => worth(v, y.trait) - worth(v, x.trait) || (x.copy < y.copy ? -1 : 1))[0];
}

// What a won hit would take, read off the rulebook and public facts only. From an agent with a home: the piece it
// wears that's worth most (§7). From an evicted agent (§10, GAP gap.evictedHit): the rarest piece it wears, or, when
// gap.evictedHit starts with "carried", the rarest it carries, worn or in the bag (its bag as its last public holdings
// record shows it); plus half its cash, as that record shows it. In the layer3 cast (L3-5b, `sight`: trickSight) a look
// it hired today shows the bag and the cash now; without one, the record is a day late, so they count at TRICKS.stale.
export function hitWorth(v, a, sight = null) {
  const fit = realFit(a);
  if (!a.evicted && N['gap.purse'] !== 'half') return { value: fitWorth(v, a), want: fit.slice().sort((x, y) => worth(v, y.trait) - worth(v, x.trait))[0] };
  // R3-2's option (GAP gap.purse, 'half'): a hit takes half its cash on any night, read as an evicted agent's is.
  if (!a.evicted) {
    const look = sight && sight.looks[a.id];
    const rec = look || holdingsOf(v, a.id);
    const cash = rec ? Math.floor(rec.cash / 2) : 0;
    return { value: fitWorth(v, a) + (sight && !look ? Math.floor(cash * TRICKS.stale) : cash), want: fit.slice().sort((x, y) => worth(v, y.trait) - worth(v, x.trait))[0] };
  }
  const look = sight && sight.looks[a.id];
  const rec = look || holdingsOf(v, a.id);
  const carried = String(N['gap.evictedHit']).startsWith('carried');
  const want = rarestOf(v, carried && rec ? fit.concat(rec.pieces) : fit);
  const piece = want ? worth(v, want.trait) : 0;
  const cash = rec ? Math.floor(rec.cash / 2) : 0;
  if (!sight || look) return { value: piece + cash, want };
  const live = !!want && fit.some(p => p.copy === want.copy);
  return { value: Math.floor((live ? piece : piece * TRICKS.stale) + cash * TRICKS.stale), want };
}

// Every attack a group of `power` could make on these targets, valued by the board's public facts: a fit worth taking
// (§7: a hit takes the rarest piece worn), an evicted agent (a hit also takes half its cash; see hitWorth), or a home
// whose owner works nights (a break-in takes the rarest piece inside and half the cash there). `hitAt(a, last)` names
// where a hit on `a` would go, or null; `safe(place)` says whether the group would go there. In layer 2, `goods` (see
// goodsCarried) adds what a target carries tonight where the hit finds it, so a trade's worker is worth a hit even
// in a plain fit. In the layer3 cast (L3-5b, `sight`: trickSight) a look today values a home and an evicted agent's
// bag (lookWorth, hitWorth), and the bounties on an agent add to a fight that takes a piece or cash from it. In R3's
// crime cast (`sight.records`) a home without a look today is worth what its owner's latest public holdings record shows
// (lookWorth, as a look would show it a day later), and a jailed agent's home, empty for sure, is a target too: only
// that cast's robbers pass jailed agents in `targets`, and a hit never goes after one. R4-5, the canny cast:
// `lockpick`, the pick a group holds, adds to a break-in only (§8); and `opening` (openingOf) reads a home on a night the
// show has never shown its owner, and a home with no public holdings record yet, from the rules (worksOutOfHome,
// openingWorth).
export function attackOptions(v, targets, { power, safe, hitAt, why = () => '', goods = null, sight = null, lockpick = 0, opening = null }) {
  const stash = {};
  for (const sale of v.board.sales) stash[sale.agent] = (stash[sale.agent] || 0) + worth(v, sale.trait);
  const options = [];
  for (const a of targets) {
    const fit = fitWorth(v, a);
    const { value, want } = hitWorth(v, a, sight);
    const last = seenAt(v, a.id).slice(-1)[0];
    const bounty = sight ? bountyOn(v, a.id, sight) : 0;
    if (!a.jailed && (value > 0 || (goods && goods.may(a)))) {
      const place = hitAt(a, last);
      const extra = place && goods ? goods.at(a, place) : 0;
      if (place && value + extra > 0) options.push({ value: value + extra + (value > 0 ? bounty : 0), play: { kind: 'hit', target: a.id, place, ...(want ? { want: want.copy } : {}) }, reason: why(a, place) });
    }
    // A break-in needs more than the lock (1), so only if its owner works nights and this group is strong enough.
    const out = !!last || a.jailed || (!!opening && worksOutOfHome(v, a));
    if (!a.evicted && power + lockpick >= 2 && out && safe(HOMES)) {
      const inside = (stash[a.id] || 0) - fit;
      const look = sight && sight.looks[a.id];
      const rec = !look && sight && sight.records ? publicHoldings(v, a.id) : null;
      const take = look ? lookWorth(v, look) : rec ? lookWorth(v, rec) : opening ? openingWorth(v, a, inside, opening) : Math.max(0, inside) + 30;
      const reason = last || a.jailed ? `${a.id} works nights; its stash is home alone` : `${a.id}'s trade works out of its home, and the show has never shown it`;
      options.push({ value: take + (take > 0 ? bounty : 0), play: { kind: 'breakin', target: a.id }, reason });
    }
  }
  return options;
}

// Layer 2 (§7: a won hit takes the goods it carries tonight, GAP gap.carried): what a target carries where a hit
// would find it, read off public facts. A trade's worker that keeps a routine (the show saw it at that place on each of
// its last two sightings) carries its night's goods there: a Smuggler its haul at a drop, a Dealer its doses on a
// corner (one it holds, by the board), a Chemist its chems at the lab. A worker that moves about isn't worth a hit for
// its goods: the hit would likely miss. A robber sells loot to the city's buyer, so that's what loot is worth to it
// (STREET.loot: the buyer's price falls with every unit sold). Never guns: a hit doesn't take them.
// R3-2's hold-up (GAP gap.holdup, 'pay'): a won hit takes its target's night's pay, so a worker with a routine carries
// that too, read off the board and the record: a Dealer on a corner it holds there, a full corner's takings in place of
// its doses; a worker whose latest public night was a hustle there, its take that night; and a Cop whose latest public
// night was a patrol there, its wage. R4-5, the canny cast (`canny`): a Cop whose latest public night was guarding the
// vault there carries the guard's wage, which a hold-up takes as it takes a patrol's (gap.holdup).
export function goodsCarried(v, canny = false) {
  const buyer = kind => (v.board.market.buyer[kind] || 0) * STREET.loot;
  const routine = (a, place) => {
    const out = seenAt(v, a.id).slice(-2);
    return out.length === 2 && out.every(x => x.place === place);
  };
  const holdup = N['gap.holdup'] === 'pay';
  const plays = holdup ? publicNight(v) : {};
  return {
    may: a => holdup || ['smuggler', 'dealer', 'chemist'].includes(a.trade),
    at(a, place) {
      if (!routine(a, place)) return 0;
      const corner = v.board.corners.find(c => c.holder === a.id && c.place === place);
      if (a.trade === 'smuggler' && N.drops[place]) return Math.round(N.dropUnits * buyer(N.drops[place]));
      if (a.trade === 'dealer' && corner) return holdup ? cornerTakings(N.deal.held, corner.hot) : Math.round(N.deal.cap * buyer('doses'));
      if (a.trade === 'chemist' && place === 'forest') return Math.round(N.cook.batches * N.cook.chems * buyer('chems'));
      const p = plays[a.id];
      if (p && p.kind === 'hustle' && p.place === place) return (v.events.find(e => e.type === 'hustle' && e.agent === a.id && e.night === p.day) || { take: 0 }).take;
      if (p && p.kind === 'patrol' && p.place === place) return N.copPay.patrol;
      if (canny && p && p.kind === 'guard' && p.place === place) return N.copPay.guard;
      return 0;
    },
  };
}

// A robber's pick. A scout hits where the target was last seen; a guesser picks a district blind. `strength` is the
// group it brings (a crew's leader brings its members, a robber its hired muscle): a home's lock alone holds against 1.
// `spread`: pick among the targets worth at least SPREAD of the best (a lone robber), not the best (a crew). In layer 2
// its own gun counts (§8: +1 a person) and a target's goods count (goodsCarried). In the layer3 cast (L3-5a) TEMP taken
// today counts too, and `leads` (leadValues: HALLU's) adds what a lead says a break-in on its agent would bring; and
// (L3-5b) its looks, the bounties and a day-late record's discount (trickSight). In R3's crime cast (`cfg.sharp`) it
// reads homes off the public holdings records, jailed agents' homes among them (attackOptions); and a lone robber's own
// pick (`floor`, the night's wage it skips: R3-2, the crime cast's robbers) drops every take worth less than that and
// every fight it reads it would lose or be jailed for at the ferry (carefulOnly). `skip` (R3-6, the canny cast's crews):
// targets it leaves alone tonight. R4-5, the canny cast: a lockpick it holds counts for a break-in (pickOf), and a home
// is read on night 1 and before its owner's first public record as the rules leave it (attackOptions' `opening`).
export function robberPlay(v, r, cfg, strength = 1, spread = false, leads = null, floor = 0, skip = null) {
  const me = v.me;
  // Never its own side: its crew, and whoever promised to back it tonight.
  const crewmates = new Set((v.board.crews.find(c => c.id === me.crew) || { members: [] }).members);
  for (const p of me.promises) if (p.what === 'back' && p.who === me.id && p.by !== me.id && p.night === v.day) crewmates.add(p.by);
  const tonight = v.board.tonight || {};
  const bold = r() < BOLD && !(floor > 0);
  const safe = place => tonight[place] !== 'heavy' && (bold || !(me.wanted && tonight[place] === 'normal'));
  const knuckles = me.pieces.some(p => p.worn && p.ability === 'knuckles');
  const street = cfg.layer === 2;
  const power = strength + (knuckles ? 1 : 0) + (street && armed(v) ? 1 : 0) + (cfg.drugs && me.high.includes('temp') ? 1 : 0);
  const lockpick = cfg.canny ? pickOf(v) : 0;
  // A lone defender is strength 1 and a tie goes to the defender (§8), so a group of 1 can't win anything; R3-2's jump
  // (GAP gap.jump) adds to a hit, never a break-in (attackOptions holds those to `power`), and R3-2c's narrow jump wins
  // a hit's tie on a worker alone. R4-5: a lockpick lets a group of 1 beat a home's lock.
  if (power + hitEdge() < 2 && power + lockpick < 2) return null;
  const guess = cfg.type === 'guess';
  const pool = cfg.sharp ? v.board.agents.filter(a => a.id !== me.id && !a.boarded) : others(v);
  const options = attackOptions(v, pool.filter(a => !crewmates.has(a.id) && !(skip && skip.has(a.id))), {
    power,
    safe,
    hitAt: (a, last) => {
      const place = guess ? pick(r, DISTRICTS) : last && last.place;
      return place && (guess || safe(place)) ? place : null;
    },
    why: (a, place) => (guess ? `a guess: ${a.id} in ${place}` : `scouted: ${a.id} was seen in ${place}`),
    goods: street ? goodsCarried(v, !!cfg.canny) : null,
    sight: cfg.drugs ? (cfg.sharp ? { ...trickSight(v), records: true } : trickSight(v)) : null,
    lockpick,
    opening: cfg.canny ? openingOf(v) : null,
  });
  for (const o of options) {
    if (!leads || o.play.kind !== 'breakin' || !leads[o.play.target]) continue;
    o.value += leads[o.play.target];
    o.reason = `a lead: ${o.play.target}'s home is worth breaking into`;
  }
  const worthIt = floor > 0 ? carefulOnly(v, options.filter(o => o.value >= floor), power, lockpick) : options;
  if (!worthIt.length) return null;
  const ranked = shuffle(r, worthIt).sort((x, y) => y.value - x.value);
  const best = spread ? pick(r, ranked.filter(o => o.value >= SPREAD * ranked[0].value)) : ranked[0];
  return { play: best.play, reason: best.reason, value: best.value };
}

// R3-2, the crime cast's robbers read the board before they fight (a sensible player's view, from public facts), and
// keep the fights that pass:
// - the defence: the target's public strength (its gun on its last public holdings record, a wired walk), or a home's
//   lock when its owner is out or in jail; +1 in a heavy district; the city cops' +2 against it while it's wanted, but
//   in a lawless district; and every Cop the show saw in that place last night, at its public strength. Its own group
//   must beat that: its strength, and R3-2's jump on a hit (GAP gap.jump); under R3-2c's narrow jump (gap.jump
//   'alone'), a hit need only tie a target it reads as out working alone (worksAlone), with nobody else in that defence;
// - the ferry: an arrest from night N.nights - N.jailNights on holds it past the ferry (§13, §15: it loses everything),
//   so from then it fights only where no cop could come (a lawless district the show saw no Cop in) or with twice the
//   bail it would carry in hand (ferryBail pays it out of what an arrest's fine leaves); not under R3-2's
//   gap.ferryJail 'released', where jail ends at the ferry;
// - its heat: a crime that would make it wanted (§13: 3 stars) brings the city cops to its every fight and the Cops'
//   collars to its door, so it commits none that would;
// - its own record: a fight it lost on a night its view still shows (its play, and the public fight on that target
//   with no take of its own) held a defence it doesn't try again until it's stronger than that.
// R4-5, the canny cast: `lockpick`, the pick it holds, adds 1 to a break-in's strength (§8).
function carefulOnly(v, options, power, lockpick = 0) {
  const me = v.me;
  if (me.heat + 1 >= N.wantedAt) return [];
  const lost = {};
  for (const p of v.events.filter(e => e.type === 'play' && e.agent === me.id && (e.kind === 'hit' || e.kind === 'breakin'))) {
    const f = v.events.find(e => e.type === 'fight' && e.night === p.day && e.kind === p.kind && e.target === p.target);
    const took = v.events.some(e => (e.type === 'rob' || e.type === 'burgle') && e.leader === me.id && e.night === p.day);
    if (f && !took) lost[p.target] = Math.max(lost[p.target] || 0, f.defence);
  }
  const tonight = v.board.tonight || {};
  const free = a => !!a && !a.jailed && !a.boarded;
  const agent = id => v.board.agents.find(a => a.id === id);
  const cops = place => v.board.agents.filter(a => a.trade === 'cop' && a.id !== me.id && free(a)
    && (v.sightings[a.id] || []).some(x => x.night === v.day - 1 && x.place === place));
  // R3-2's option (GAP gap.ferryJail, 'released'): jail ends at the ferry, so a late arrest no longer keeps it off.
  const lateness = N['gap.ferryJail'] === 'missed' && v.day >= N.nights - N.jailNights;
  const bail = 2 * N.bailPerStar * Math.min(N.maxHeat, me.heat + 1);
  return options.filter(o => {
    const place = o.play.kind === 'breakin' ? HOMES : o.play.place;
    const t = agent(o.play.target);
    const lv = tonight[place] || 'normal';
    const target = o.play.kind === 'breakin' ? 1 : seenStrength(v, t, false);
    const seen = cops(place).filter(c => c.id !== o.play.target);
    const defence = target + (lv === 'heavy' ? N.copsHeavy : 0) + (me.wanted && lv !== 'lawless' ? N.copsWanted : 0) + seen.reduce((x, c) => x + seenStrength(v, c, false), 0);
    const mine = power + (o.play.kind === 'hit' ? jumpAll() : 0) + (o.play.kind === 'breakin' ? lockpick : 0);
    const tie = o.play.kind === 'hit' && jumpAlone() && defence === target && worksAlone(v, o.play.target, place);
    if (mine < defence || (mine === defence && !tie) || (lost[o.play.target] != null && mine <= lost[o.play.target])) return false;
    return !lateness || (lv === 'lawless' && !seen.length) || me.cash >= bail;
  });
}

// R3-2c's narrow jump (GAP gap.jump, 'alone'), as a player reads §7's "out working alone": on the target's latest night
// the record has made public (§19, a day late), its play was work away from home in this place (fights.mjs, worksOut),
// and nobody backed it.
function worksAlone(v, id, place) {
  const plays = publicNight(v);
  const p = plays[id];
  return worksOut(p) && p.place === place && !Object.values(plays).some(q => q.kind === 'back' && q.target === id);
}

// R3-2's skill test: a careless robber (the crime cast's `careless` option) robs every night it can win something and
// reads nothing on the board: no sightings, no records, no police levels or patrols, and not its own heat. Its target
// is any free agent, at random; a break-in on its home half the time it has one, else a hit in a district at random.
// It plans nothing by day (no muscle, no lookout, no bribe, no TEMP plan), and keeps the crime cast's gear habit.
function carelessPlay(v, r) {
  const power = ownPower(v) + (v.me.high.includes('temp') ? 1 : 0);
  if (power + hitEdge() < 2) return null;
  const targets = others(v);
  if (!targets.length) return null;
  const a = pick(r, targets);
  const play = !a.evicted && power >= 2 && r() < 0.5 ? { kind: 'breakin', target: a.id } : { kind: 'hit', target: a.id, place: pick(r, DISTRICTS) };
  return { play, reason: `careless: a ${play.kind} on ${a.id}` };
}

// --- hired muscle (§12: muscle can be hired) -------------------------------------------------------------------------
// A robber that can't win alone (a lone target holds against 1, §8, and it has no brass knuckles to wear tonight) asks
// for backing in a typed sit-down: an offer (back me tonight, for cash) and a promise to pay. The cut falls due only
// if the hit wins with the muscle in the group (§12); the robber pays it the next day, or keeps it at HIRE.stiff's odds,
// which the rules record as a walk.
const hirePrice = v => hustlePay(v) + HIRE.premium;
const backersPromised = v => v.me.promises.filter(p => p.what === 'back' && p.who === v.me.id && p.by !== v.me.id && p.night === v.day).length;

// `skip`: agents whose sit-down today is about something else (a gun it's buying, layer 2).
export function hireMuscle(v, ctx, cfg, cashLeft, skip = new Set()) {
  const me = v.me;
  const out = [];
  if (me.jail || me.wanted || me.heat >= 4 || v.day >= N.nights || cfg.careless) return out;
  const pay = hirePrice(v);
  if (ctx.round === 1) {
    if (me.pieces.some(p => p.ability === 'knuckles')) return out;
    // L3-5a: a TEMP in its pocket is the +1 it needs, for less than muscle costs (tempPlan).
    if (cfg.drugs && (me.goods.temp || 0)) return out;
    const asks = Math.min(HIRE.asks, Math.floor(cashLeft / pay), me.messagesLeft);
    if (asks < 1) return out;
    // Would one more in the group find a target worth the cut and the hustle it skips? The plan's draws come from their
    // own stream, so the robber's other choices don't change.
    const plan = robberPlay(v, rng(ctx.seed, 'plan', me.id, v.day), cfg, 2);
    if (!plan || plan.value < pay + hustlePay(v)) return out;
    const pool = v.board.agents.filter(a => a.id !== me.id && a.id !== plan.play.target && !a.jailed && !a.boarded && !a.crew
      && !a.wanted && !me.sitdowns.some(sd => sd.with === a.id));
    for (const a of shuffle(rng(ctx.seed, 'hire', me.id, v.day), pool).sort((x, y) => x.heat - y.heat).slice(0, asks)) {
      out.push({ kind: 'ask', to: a.id, line: hireLine(pay) });
    }
    return out;
  }
  // Rounds 2 and 3: an offer and a promise to pay, in every sit-down it asked for that has opened, while it could still
  // pay every cut it has promised tonight.
  let promised = me.promises.filter(p => p.by === me.id && p.what === 'pay' && p.night === v.day).length;
  let left = me.messagesLeft;
  for (const sd of me.sitdowns) {
    if (sd.asked !== 'me' || sd.state !== 'open' || sd.said.some(m => m.from === me.id) || skip.has(sd.with)) continue;
    if ((promised + 1) * pay > me.cash || left < 2) break;
    out.push({ kind: 'say', sitdown: sd.id, say: 'offer', terms: { what: 'back', who: me.id, night: v.day, cash: pay } });
    out.push({ kind: 'say', sitdown: sd.id, say: 'promise', terms: { what: 'pay', who: sd.with, cash: pay, night: v.day } });
    promised += 1;
    left -= 2;
  }
  return out;
}

// The morning after: pay each cut that fell due (the rules keep only those), or keep them all.
export function payMuscle(v, ctx) {
  const me = v.me;
  if (ctx.round !== 1) return [];
  const owed = me.promises.filter(p => p.by === me.id && p.what === 'pay' && p.night === v.day - 1).sort(byNum);
  if (!owed.length || rng(ctx.seed, 'stiff', me.id, v.day)() < HIRE.stiff) return [];
  const out = [];
  let cash = me.cash;
  for (const p of owed) {
    if (p.cash > cash) continue;
    out.push({ kind: 'pay', to: p.to, amount: p.cash, for: 'deal' });
    cash -= p.cash;
  }
  return out;
}

// The muscle's side, a simple rule: take any sit-down; take the job if it pays at least last night's wage, it isn't
// wanted, it has promised nobody else tonight, and (a turtle) it isn't holding a rare it means to sit on.
export function takesTheJob(v, cfg, cash) {
  const me = v.me;
  if (me.wanted || me.jail || me.crew || v.day >= N.nights) return false;
  if (cfg.type === 'turtle' && me.pieces.some(p => RANK[p.tier] >= 1)) return false;
  return Number.isInteger(cash) && cash >= hustlePay(v);
}

export function muscleReplies(v, cfg) {
  const me = v.me;
  const out = [];
  if (me.jail || me.crew) return out;
  let left = me.messagesLeft;
  let promised = me.promises.some(p => p.by === me.id && p.what === 'back' && p.night === v.day);
  for (const sd of me.sitdowns) {
    if (left < 1) break;
    if (sd.asked === 'them' && sd.state === 'asked') {
      out.push({ kind: 'answer', sitdown: sd.id, accept: !me.wanted });
      left -= 1;
      continue;
    }
    if (promised || sd.state !== 'open' || sd.said.some(m => m.from === me.id)) continue;
    const offer = sd.said.find(m => m.from === sd.with && m.say === 'offer' && m.terms.what === 'back' && m.terms.who === sd.with && m.terms.night === v.day);
    if (!offer || !takesTheJob(v, cfg, offer.terms.cash)) continue;
    out.push({ kind: 'say', sitdown: sd.id, say: 'promise', terms: { what: 'back', who: sd.with, night: v.day } });
    left -= 1;
    promised = true;
  }
  return out;
}

// Tonight's job, if it promised one: back whoever hired it.
export function hiredPlay(v) {
  const p = v.me.promises.filter(x => x.by === v.me.id && x.what === 'back' && x.night === v.day).sort(byNum)[0];
  if (!p || !v.board.agents.some(a => a.id === p.who && !a.jailed)) return null;
  return { play: { kind: 'back', target: p.who }, reason: `hired muscle for ${p.who}` };
}

// --- counter-hits: the one move that tells backing rule A from rule B (§8) ------------------------------------------
// A bot remembers what its views showed it: which agents' heat rose each night (public), who robbed it (its own record,
// unless the robber wore the ski mask) and who founded each crew (public).
export function remember(v, memo) {
  memo.heat ||= {};
  memo.robbedBy ||= {};
  memo.founders ||= {};
  let seen = memo.seen == null ? -1 : memo.seen;
  for (const e of v.events) {
    if (e.n <= seen) continue;
    if (e.type === 'heat' && e.heat > e.was) (memo.heat[e.day] ||= []).push(e.agent);
    else if (e.type === 'robbed' && e.agent === v.me.id && e.by) memo.robbedBy[e.night] = e.by;
    else if (e.type === 'crew' && e.act === 'form') memo.founders[e.crew] = e.agent;
  }
  for (const e of v.events) if (e.n > seen) seen = e.n;
  memo.seen = seen;
}

// The most common gap between strikes; on a tie, the shorter one.
export function usualGap(nights) {
  const count = {};
  for (let i = 1; i < nights.length; i++) count[nights[i] - nights[i - 1]] = (count[nights[i] - nights[i - 1]] || 0) + 1;
  return Number(Object.keys(count).sort((x, y) => count[y] - count[x] || x - y)[0]);
}

// A worker that expects a crew to come for it tonight hits one of the crew's likely backers, where the crew will be.
// - When: the crew's strikes keep a rhythm (nights when two or more of its members' heat rose together, all public),
//   and tonight is the next beat.
// - Whom the crew will pick: the richest target it could reach, valued from the board as any robber values one. The
//   worker expects the crew if that's its own home or fit, shared with one other agent at most.
// - Where: Pleasantview for a break-in (the burglars and their backers are out there, gap.burglarPlace), or where it
//   was last seen for a hit (where a scout looks).
// - Whom to hit: a crew member other than its likely leader (whoever robbed this worker for the crew before, else the
//   founder).
// - In layer 2 the crew's pick counts the goods a target carries tonight (goodsCarried), as the crews' own picks do; in
//   the layer3 cast (`sight`: PUBLIC_SIGHT) the bounties and a day-late record's discount too.
export function counterHit(v, memo, r, layer = 1, sight = null) {
  if (v.me.wanted) return null;
  const due = crewDue(v, memo, layer, sight);
  if (!due) return null;
  const b = pick(r, due.backers);
  return { play: { kind: 'hit', target: b, place: due.place }, reason: `counter-hit: ${due.crew} is due tonight and ${b} backs it` };
}

// The crew that counterHit expects tonight, by the reading above: { crew, place, leader, backers, free }, or null. The
// protection tip reads it too (L3-5b, tipFor).
export function crewDue(v, memo, layer = 1, sight = null) {
  const me = v.me;
  const tonight = v.board.tonight || {};
  const nights = Object.keys(memo.heat).map(Number).sort((x, y) => x - y);
  for (const c of v.board.crews) {
    if (c.members.includes(me.id)) continue;
    const strikes = nights.filter(k => memo.heat[k].filter(x => c.members.includes(x)).length >= 2);
    if (strikes.length < 2 || strikes[strikes.length - 1] + usualGap(strikes) !== v.day) continue;
    const free = c.members.filter(m => v.board.agents.some(a => a.id === m && !a.jailed && !a.boarded));
    const targets = v.board.agents.filter(a => !c.members.includes(a.id) && !a.jailed && !a.boarded);
    const options = attackOptions(v, targets, {
      power: free.length,
      safe: place => tonight[place] !== 'heavy',
      hitAt: (a, last) => (last && tonight[last.place] !== 'heavy' ? last.place : null),
      goods: layer === 2 ? goodsCarried(v) : null,
      sight,
    });
    if (!options.length) continue;
    const top = Math.max(...options.map(o => o.value));
    const mine = options.find(o => o.play.target === me.id && o.value === top);
    if (!mine || new Set(options.filter(o => o.value === top).map(o => o.play.target)).size > 2) continue;
    const place = mine.play.kind === 'breakin' ? HOMES : mine.play.place;
    const robbers = Object.values(memo.robbedBy).filter(x => c.members.includes(x));
    const leader = robbers.length ? robbers[robbers.length - 1] : memo.founders[c.id];
    const backers = free.filter(m => m !== leader);
    if (!backers.length || tonight[place] === 'heavy') continue;
    return { crew: c.id, place, leader, backers, free };
  }
  return null;
}

// --- layer 2, the street (GAME.md §9, §25): the trade bots ---------------------------------------------------------------
// A Smuggler runs a drop and sells the haul: chems to Chemists, parts to Gunrunners. A Chemist buys chems, cooks and
// sells the doses to Dealers. A Dealer buys doses and deals them on a corner. A Gunrunner buys parts and builds guns for
// the robbers, crews and Cop seat that buy them (gunErrands, sellGuns), keeping a stock that follows its sales, and
// otherwise hustles. The Cop seat patrols and collars (copPlan).
// They trade among themselves in typed sit-downs and hand-overs (§10, §14): the seller asks; the buyer answers with an
// order (an offer: these goods for this cash); the seller hands the goods over; the buyer pays once they arrive, at once
// if it can, or as soon as it has the cash. A hand-over has no protection, so the seller trusts the buyer. The city's
// shop and buyer are for when no agent deals (§9): a seller sells the city's buyer what no agent took for STREET.slow
// days, a Smuggler what it holds over STREET.cap, and everyone everything on the last day (goods never board the
// ferry); a Chemist with no chems for a batch buys at the city's shop only when no Smuggler is filling an order and the
// price is under STREET.shopMax.
// Bot settings, not game numbers: STREET.unit is the price agents trade goods at among themselves (§9's "about $15 a unit
// and $15 a dose"), asks the buyers a seller asks a day for each kind, gunStock the guns a Gunrunner builds ahead of any
// buyer, and loot the share of the city buyer's price a robber reckons a unit of loot is worth (the price falls with
// every unit sold).
export const STREET = { unit: 15, asks: 4, slow: 2, cap: 12, shopMax: 32, gunStock: 2, loot: 0.75 };
// What wearing a piece at work risks a night: the chance a hit takes it, by tonight's police level where it works (a
// robber has to beat the cops as well); at home a hit can't reach it. Bot settings.
export const FLEX_RISK = { heavy: 0.01, normal: 0.05, lawless: 0.1 };
// The trades that deal in goods, and the trade bots' types: every trade, the rules' own list of five (§9), so the bench
// keeps no second one (R4-11).
const TRADE_TYPES = TRADES.filter(t => t !== 'cop');
const STREET_TYPES = TRADES;
// The workers that weigh flex when they dress (§4): the trades, the Cop seat and, in layer 2's cast, the hustler.
const FLEXERS = [...STREET_TYPES, 'hustle'];
// §9's table: what each trade sells to the others, who buys each kind, and what each trade buys.
const SELLS = { smuggler: ['chems', 'parts'], chemist: ['doses'], dealer: [], gunrunner: [], cop: [] };
// R10b: what a seller sells here: its trade's (SELLS), or, for a model seat's trade routine (tradeRoutine), only the
// goods its sell orders cover (`cfg.sells`). A bot's config has no `sells`, so every bot sells as before.
const sellsOf = cfg => cfg.sells || SELLS[cfg.type];
const BUYER_OF = USED_BY;
const SELLER_OF = { chems: 'smuggler', parts: 'smuggler', doses: 'chemist' };
const BUYS = { chemist: 'chems', dealer: 'doses', gunrunner: 'parts' };
// What a buyer wants on hand for a night's work: 2 batches of chems, a held corner's doses, a night's parts.
const onHand = kind => (kind === 'chems' ? N.cook.batches * N.cook.chems : kind === 'doses' ? N.deal.held : N.build.parts);
// Cash a worker keeps back from the list: a hustler's 60, plus what a night's goods cost a buyer.
const reserveOf = type => 60 + (BUYS[type] ? onHand(BUYS[type]) * STREET.unit : 0);
const holdsRare = v => v.me.pieces.some(p => RANK[p.tier] >= 1);
// R5-deals (the review): a bot's one debt book is the deal record in its own view (rules/deals.mjs): what it owes, and
// what its buyers owe it, on agreed deals, never a memory of its own beside it. A deal it pays in this call (memo.paying,
// cleared by makeBot each call) is owed no more.
const owedDeals = (v, memo = {}) => ((v.me && v.me.deals) || []).filter(d => d.agreed && d.role === 'buyer' && d.owes === 'me' && d.due > d.paid
  && !(memo.paying || []).includes(d.id));
// What it owes on agreed deals `fits` takes (all by default).
const owing = (v, memo = {}, fits = () => true) => owedDeals(v, memo).filter(fits).reduce((t, d) => t + d.due - d.paid, 0);
// What `id` owes it on agreed deals, or every buyer with no `id`.
const owesMe = (v, id = null) => ((v.me && v.me.deals) || []).filter(d => d.agreed && d.role === 'seller' && d.owes === 'them' && (id === null || d.with === id))
  .reduce((t, d) => t + Math.max(0, d.due - d.paid), 0);
// The deals a street buyer's own orders make (orderGoods): goods of its trade's one kind, a Dealer's doses as TEMP.
const streetDeal = trade => d => !!d.goods && !!BUYS[trade] && Object.keys(d.goods).every(k => k === Object.keys(asTemp({ [BUYS[trade]]: 1 }))[0]);
// Deals of goods all of `kinds`, or a piece.
const goodsDeal = kinds => d => !!d.goods && Object.keys(d.goods).every(k => kinds.includes(k));
const pieceDeal = d => !!d.piece;
// A hand-over names its deal's sit-down (rules/deals.mjs) while the bot is in more than one deal with that agent, so the
// record credits the one it means; with one, the record finds it unnamed.
const naming = (v, to, sitdown) => (((v.me && v.me.deals) || []).filter(d => d.with === to).length > 1 ? { sitdown } : {});
// Pays what the record says it owes on agreed deals `fits` takes, in full while its cash covers each, oldest first,
// naming each deal's sit-down where it must (naming); never to a seat the board shows guarded (FIREWALL, L3-5a: a pay can't reach it), which
// it pays later. Returns the pays and the cash left.
function payOwed(v, memo, cash, fits = () => true) {
  const out = [];
  memo.paying ||= [];
  for (const d of owedDeals(v, memo)) {
    const amount = d.due - d.paid;
    if (!fits(d) || amount > cash || guarded(v, d.with)) continue;
    out.push({ kind: 'pay', to: d.with, amount, for: 'debt', ...naming(v, d.with, d.sitdown) });
    memo.paying.push(d.id);
    cash -= amount;
  }
  return { out, cash };
}

// R5-deals: a sit-down's deal as the core keeps it (rules/deals.mjs), off the bot's own view: the sit-down's latest
// trade terms, whose they are, and what each side has handed over against them; or null.
const dealIn = (v, sd) => ((v.me && v.me.deals) || []).filter(d => d.sitdown === sd.id).at(-1) || null;
const countOf = g => Object.values(g || {}).reduce((t, n) => t + n, 0);
// Nothing handed over against a deal yet.
const untouched = d => !!d && d.paid === 0 && (d.piece ? !d.gave : !countOf(d.given));
// The goods a deal's buyer has paid for that this bot, its seller, hasn't given yet, in the deal's kinds, in order; or
// null when there are none.
function paidFor(d) {
  if (!d || d.role !== 'seller' || d.owes !== 'me' || !d.goods) return null;
  let due = Math.floor((countOf(d.goods) * Math.min(d.paid, d.cash)) / d.cash) - countOf(d.given);
  const out = {};
  for (const [k, n] of Object.entries(d.goods)) {
    const x = Math.min(due, n - (d.given[k] || 0));
    if (x > 0) {
      out[k] = x;
      due -= x;
    }
  }
  return Object.keys(out).length ? out : null;
}
// `id` said in it that it has none (an answer of a trade with no goods): the deal there is dead.
const saidNone = (sd, id) => sd.said.some(m => m.from === id && m.say === 'answer' && isBuy(m.terms) && !m.terms.goods && !m.terms.piece);
// R5-deals: a buyer's order (or its ask) lives as long as its sit-down does: while that sit-down is in its view, asked
// or open (closed, past its last day or declined, it's gone). Its sit-down: the one it was said in (`o.sitdown`), or,
// for an ask not yet answered, the one with `id` (the seller, `o.with` by default) asked on the ask's day; or null.
const orderSd = (v, o, id = o.with) => v.me.sitdowns.find(sd => sd.with === id && sd.state !== 'declined'
  && (o.sitdown ? sd.id === o.sitdown : sd.day === o.day && sd.asked === 'me')) || null;
const orderLives = (v, o, id = o.with) => !!orderSd(v, o, id);
// Goods of the one kind `kind` only.
const onlyOf = kind => g => Object.keys(g).length === 1 && kind in g;
// A seller's typed offer (§14; rules/deals.mjs): these goods for `unit` a unit, the agents' price by default.
const sellOffer = (sd, goods, unit = STREET.unit) => ({ kind: 'say', sitdown: sd.id, say: 'offer', terms: { what: 'sell', goods, cash: countOf(goods) * unit } });

// R9d (docs/briefs/R9d-trade-you-can-read.md, Part A): every bot ask says what the sit-down is for in its one line, built
// from the numbers the bot then acts on (how many, at what price, when it pays), so a model asked can answer it. No new
// draw, no advice, nothing the bot doesn't mean to do; a drug is a dose (its name never shows live).
const NOUN = { chems: ['chem', 'chems'], parts: ['part', 'parts'], doses: ['dose', 'doses'], temp: ['dose', 'doses'] };
const unitsOf = (n, kind) => `${n} ${(NOUN[kind] || [kind, kind])[n === 1 ? 0 : 1]}`;
export const buyLine = (kind, n, unit, upTo = true) => `Buying ${upTo ? 'up to ' : ''}${unitsOf(n, kind)} at $${unit} each; I pay as they're handed over.`;
export const sellLine = (kind, n, unit) => `Selling up to ${unitsOf(n, kind)} at $${unit} each; order and I hand them over, you pay on delivery.`;
export const itemLine = (item, price, night = null) => `Buying ${item}${night == null ? '' : ` for night ${night}`} for $${price}; I pay once it's handed over.`;
export const hireLine = pay => `Hiring backup for tonight: back me and I promise you $${pay}, due if the job wins with you in it.`;
export const JOB_LINE = "Crew job tonight: back me, and I'll put the terms to you when we sit down.";
export const fakeLine = (slot, floor) => `Selling the ${slot} piece I'm wearing; I hand it over to an offer of $${floor} or more.`;

// R9d: the first words with no terms (a question, an answer that names nothing) `sd`'s other side said since this
// bot's last message there (or at all, if it has said none), or null.
const wordsSince = (v, sd) => {
  const i = sd.said.map(m => m.from).lastIndexOf(v.me.id);
  return sd.said.slice(i + 1).find(m => m.from === sd.with && (!m.terms || !m.terms.what)) || null;
};
// R9d: a goods ask (askSellers) whose sit-down the seller took with words and no terms, after the bot's last turn: the
// bot keeps the sit-down the day after those first words (dayTalk) and states its order there once (orderAsked,
// memo.restated); the morning after that it closes, however long the seller goes on talking. A bot never speaks without
// terms, so between bots this never happens.
// Known limits, left as they are because any change moves bot-only seasons (the R9d review, 10-20):
// - a gun's, a lockpick's or a warrant's ask line states its price on the ask's day, and the order recomputes it (the
//   shop's price, hustlePay), so a seller that takes the ask on a later day can read a different number in the order
//   (1 bot-only season in 80: models-canny 407, s184);
// - a goods ask its seller took after the bot's last turn with a sell offer, not words, still closes the next morning
//   (between bots that is a normal day: keeping it changed every canny season);
// - a warrant's buyer doesn't answer its seller (answerSeller): a counter would usually drop the order's night;
// - a canny goods buyer's line counts its want in the ask's round, and orderAsked works the want out again in a later
//   round, so the order can be bigger than the line's "up to" (34 of 1,759 same-day lines in the 80 bot-only seasons);
// - a robber's muscle offer goes in every open sit-down it asked (hireMuscle), so one it asked about goods or doses can
//   get a hire before its order (257 of 18,676 trade asks, every canny season).
const heldAsk = (v, memo, sd) => {
  const ask = (memo.asks || {})[sd.with];
  if (!ask || sd.asked !== 'me' || sd.state !== 'open' || ask.day !== sd.day || sd.day >= v.day || (memo.restated || {})[sd.id]) return false;
  if (sd.said.some(m => m.from === v.me.id)) return false;
  const w = wordsSince(v, sd);
  return !!w && w.day >= v.day - 1;
};
// R9d: a buyer's answer to what its seller said in a sit-down since its own last message there, its order (a buy
// offer of goods `fits` takes, while nothing has changed hands against the deal):
// - a sell offer (a counter included) of one kind it ordered, at no more than `top` a unit, it takes: as many as `most`
//   (in all, or by kind) and `budget` allow, at the seller's own price, so an offer of all of it agrees the deal
//   (rules/deals.mjs); any other offer it leaves, a buy among them (its echo would agree the deal with the bot selling);
// - words with no terms (a question, an answer that names nothing), it answers by stating its order again, once a
//   sit-down (memo.restated).
// Returns the say, or null.
function answerSeller(v, memo, sd, top, most, budget, fits = () => true) {
  const me = v.me.id;
  const i = sd.said.map(m => m.from).lastIndexOf(me);
  const mine = i >= 0 ? sd.said[i] : null;
  if (!mine || mine.say !== 'offer' || !isBuy(mine.terms) || !mine.terms.goods || !fits(mine.terms.goods)) return null;
  // Once anything has changed hands against the sit-down's deal its terms stand, and a new offer would be a new deal.
  const d = dealIn(v, sd);
  if (d && !untouched(d)) return null;
  const after = sd.said.slice(i + 1).filter(m => m.from === sd.with);
  const offers = after.filter(m => m.say === 'offer' && m.terms.what);
  if (offers.length) {
    const c = offers.at(-1);
    const kinds = Object.keys(c.terms.goods || {});
    const n = c.terms.goods ? c.terms.goods[kinds[0]] : 0;
    if (whatOf(c.terms.what) !== 'sell' || kinds.length !== 1 || !(kinds[0] in mine.terms.goods) || !Number.isInteger(c.terms.cash) || c.terms.cash < 1 || c.terms.cash > n * top) return null;
    const cap = typeof most === 'object' ? most[kinds[0]] || 0 : most;
    const units = Math.min(n, cap, Math.floor((budget * n) / c.terms.cash));
    if (units < 1) return null;
    const cash = units === n ? c.terms.cash : Math.ceil((units * c.terms.cash) / n);
    return { kind: 'say', sitdown: sd.id, say: 'offer', terms: { what: BUY, goods: { [kinds[0]]: units }, cash } };
  }
  if (!after.some(m => !m.terms || !m.terms.what) || (memo.restated || {})[sd.id]) return null;
  (memo.restated ||= {})[sd.id] = v.day;
  return { kind: 'say', sitdown: sd.id, say: 'offer', terms: { what: BUY, goods: { ...mine.terms.goods }, cash: mine.terms.cash, ...(mine.terms.night ? { night: mine.terms.night } : {}) } };
}
// The kind a street seller sells an agent: one its trade sells that the agent's trade buys (§9), or null.
const sellsTo = (v, cfg, id) => {
  const trade = (v.board.agents.find(a => a.id === id) || {}).trade;
  return (sellsOf(cfg) || []).find(k => BUYER_OF[k] === trade) || null;
};

// Where a bot hustles tonight (R11): the district hustleChoice picks from public facts. It replaces the shift worker's
// usual workplace, the next one after a night it was robbed, and layer 2's Glasswall for a worker holding a rare.
const hustlePlace = (v, cfg) => hustleChoice(v, coolAt(cfg)).place;
// Tonight's hustle as a play, with its reason: why it hustles, and where and for about what.
const hustleNight = (v, cfg, why = 'a hustle always pays') => {
  const h = hustleChoice(v, coolAt(cfg));
  return { play: { kind: 'hustle', place: h.place }, reason: `${why}: ${h.place}, about $${h.take}${h.star ? ', a star' : ''}`, place: h.place };
};

// Flex (§4) against what a hit would take (§7: the rarest real piece worn): in each slot, the best piece whose night of
// flex is worth the chance of losing it where the worker will be tonight. Commons pay no flex and cost little to lose,
// so they're always worn. `plan` is tonight's plan: { place } or { home: true }.
export function streetFit(v, plan) {
  const level = plan.home ? null : (v.board.tonight || {})[plan.place] || 'normal';
  const risk = level ? FLEX_RISK[level] : 0;
  const score = p => RANK[p.tier] * 10 + (p.last || 0) / 1000;
  const fit = {};
  for (const p of v.me.pieces) {
    if (RANK[p.tier] >= 1 && (N.flex[p.tier] || 0) < risk * worth(v, p.trait)) continue;
    if (!fit[p.slot] || score(p) > score(fit[p.slot])) fit[p.slot] = p;
  }
  return Object.fromEntries(Object.entries(fit).map(([slot, p]) => [slot, p.copy]));
}

// What the trade bot learns from its own record since it last looked: goods it ordered arriving (the order is done;
// what it owes is on the deal record), its hauls at each drop, and whether last night's corner paid. In R3-6's canny cast
// (`cfg.canny`) also the goods it handed agents each day (memo.outs), its buyers' demand (cannyDemand).
function noteStreet(v, memo, cfg = null) {
  const me = v.me;
  memo.orders ||= {};
  memo.delivered ||= {};
  memo.sold ||= {};
  memo.held ||= {};
  memo.drops ||= {};
  memo.tied ||= {};
  memo.partners ||= {};
  let seen = memo.street == null ? -1 : memo.street;
  for (const e of v.events) {
    if (e.n <= seen) continue;
    // Its trade partners, for the fence's swaps: whoever it handed goods to or got goods from, and when.
    if (e.type === 'give' && e.goods && (e.to === me.id || e.from === me.id)) memo.partners[e.to === me.id ? e.from : e.to] = v.day;
    if (cfg && cfg.canny && e.type === 'give' && e.goods && e.from === me.id) {
      const day = ((memo.outs ||= {})[e.day] ||= {});
      for (const [k, n] of Object.entries(asDoses(e.goods))) if (k in BUYER_OF) day[k] = (day[k] || 0) + n;
    }
    if (e.type === 'give' && e.to === me.id && e.goods) {
      const goods = asDoses(e.goods);
      const key = Object.keys(memo.orders).sort().find(k => memo.orders[k].with === e.from && goods[memo.orders[k].kind]);
      // R5-deals: what it owes for them is on the record (payDebts).
      if (key) delete memo.orders[key];
    } else if (e.type === 'gather' && e.agent === me.id) {
      memo.drops[e.place] = Object.values(e.goods).reduce((t, x) => t + x, 0);
    } else if (e.type === 'sale' && e.agent === me.id && e.doses > 0 && memo.dealt && memo.dealt.night === e.night) {
      memo.dealt.sold = true;
    }
  }
  for (const e of v.events) if (e.n > seen) seen = e.n;
  memo.street = seen;
  // The canny cast's record of its buyers' demand keeps the days cannyDemand reads.
  if (cfg && cfg.canny) {
    for (const m of ['outs', 'unmet']) for (const d of Object.keys(memo[m] || {})) if (Number(d) <= v.day - CANNY.days) delete memo[m][d];
  }
  // An order lives in its sit-down, and sit-downs end at the lock: one its seller never filled lapses with the day. (A
  // hand-over made after the buyer's last turn is matched above, before this.)
  for (const k of Object.keys(memo.orders)) if (memo.orders[k].day < v.day) delete memo.orders[k];
  for (const k of Object.keys(memo.delivered)) if (!me.sitdowns.some(sd => sd.id === k)) delete memo.delivered[k];
  for (const k of Object.keys(memo.stated || {})) if (!me.sitdowns.some(sd => sd.id === k)) delete memo.stated[k];
  for (const k of Object.keys(memo.countered || {})) if (!me.sitdowns.some(sd => sd.id === k)) delete memo.countered[k];
  // A Dealer that went to a corner last night and sold nothing there tied or lost the fight for it: it tries another.
  if (memo.dealt && memo.dealt.night === v.day - 1 && !memo.dealt.sold) memo.tied[memo.dealt.corner] = memo.dealt.night;
}

// Pays what it owes for goods its trade's orders brought, as the deal record has it (payOwed), oldest first, while the
// cash lasts; never to a seat the board shows guarded (FIREWALL, L3-5a: a pay can't reach it), which it pays later.
function payDebts(memo, cash, v, trade) {
  return payOwed(v, memo, cash, streetDeal(trade));
}

// The buyer's side: answer each seller of what it buys with an order, up to what a night's work needs and the cash it
// can spare. In R3-6's canny cast it also asks a seller itself (askSellers) and orders where one has taken its ask
// (orderAsked); a Chemist wants the chems for the batches its buyers will take (cannyBatches), and every buyer counts
// what its own buyers owe it (owedToMe). `busy`: the agents it has a sit-down with today, its strategy's too.
function orderGoods(v, cfg, memo, cash, msgs, ctx = null, busy = null, cap = Infinity) {
  const me = v.me;
  const kind = BUYS[cfg.type];
  const out = [];
  if (!kind || me.jail) return { out, msgs };
  // A seller that says it has none left (an answer with no goods) has dropped the order.
  for (const sd of me.sitdowns) {
    if (memo.orders[sd.id] && sd.said.some(m => m.from === sd.with && m.say === 'answer' && isBuy(m.terms) && !m.terms.goods)) delete memo.orders[sd.id];
  }
  const pending = Object.values(memo.orders).filter(o => o.kind === kind).reduce((t, o) => t + o.units, 0);
  let want = onHand(kind) - (asDoses(me.goods)[kind] || 0) - pending;
  if (cfg.type === 'gunrunner' && (me.goods.guns || 0) >= gunTarget(v, memo)) want = 0;
  // L2-6b: in the trades cast a Gunrunner orders only the parts for the guns its stock is short (gunTarget); in the
  // layer4 cast (L4-4) and for the warrant and the fake it means to build (scoreParts).
  if (cfg.type === 'gunrunner' && cfg.every) want = (gunTarget(v, memo, cfg) - (me.goods.guns || 0)) * N.build.guns - (me.goods[kind] || 0) - pending + (cfg.score ? scoreParts(v, memo) : 0);
  // R4-5, the canny cast: and the parts for the lockpicks its buyers take (pickTarget).
  if (cfg.type === 'gunrunner' && cfg.canny) want += pickParts(v, memo, me.goods.lockpicks || 0);
  if (cfg.canny && cfg.type === 'chemist') want = cannyBatches(v, memo) * N.cook.chems - (me.goods[kind] || 0) - pending;
  // R10b: a trade routine's buy order caps what it orders today (tradeRoutine); a bot's cap is none.
  want = Math.min(want, cap);
  // Tonight's rent stays back (§10: it's due at dawn), so buying goods doesn't get the buyer evicted; in the trades cast
  // (L2-6d) its bail reserve too.
  let budget = cash - owing(v, memo, streetDeal(cfg.type)) - pending * STREET.unit - N.rent - lateReserve(v, cfg) + (cfg.canny ? counted(v, cfg, memo) : 0);
  for (const sd of me.sitdowns) {
    // L4-4: an ask it took as one for a warrant (sellWarrants) is open already, and until it orders there it orders what
    // it would have answered that ask with.
    const took = sd.state === 'open' && tookForWarrant(v, memo, sd);
    if (sd.asked !== 'them' || (sd.state !== 'asked' && !took)) continue;
    const seller = v.board.agents.find(a => a.id === sd.with);
    if (!seller || seller.trade !== SELLER_OF[kind]) continue;
    const units = Math.min(want, Math.floor(budget / STREET.unit));
    if (units < 1 || msgs < (took ? 1 : 2)) break;
    if (!took) out.push({ kind: 'answer', sitdown: sd.id, accept: true });
    out.push({ kind: 'say', sitdown: sd.id, say: 'offer', terms: { what: BUY, goods: asTemp({ [kind]: units }), cash: units * STREET.unit } });
    memo.orders[sd.id] = { with: sd.with, kind, units, day: v.day };
    want -= units;
    budget -= units * STREET.unit;
    msgs -= took ? 1 : 2;
  }
  const r = answerOrders(v, memo, kind, want, budget, msgs);
  out.push(...r.out);
  [want, budget, msgs] = [r.want, r.budget, r.msgs];
  if (cfg.canny) {
    const o = orderAsked(v, memo, kind, want, budget, msgs);
    out.push(...o.out);
    const asks = askSellers(v, ctx, memo, kind, Math.min(o.want, Math.floor(o.budget / STREET.unit)), o.msgs, new Set(), busy || new Set(me.sitdowns.map(sd => sd.with)));
    out.push(...asks);
    msgs = o.msgs - asks.length;
  }
  return { out, msgs };
}

// R9d: in each open sit-down where its order of `kind` is its last word, it answers what the seller said since
// (answerSeller): a fitting counter it takes in that order's place, within what it still wants and its budget with that
// order's own units back; words with no terms get the order again, once.
function answerOrders(v, memo, kind, want, budget, msgs) {
  const out = [];
  const key = Object.keys(asTemp({ [kind]: 1 }))[0];
  for (const sd of v.me.sitdowns) {
    if (msgs < 1) break;
    if (sd.state !== 'open') continue;
    const o = memo.orders[sd.id];
    const own = o && o.kind === kind ? o.units : 0;
    const e = answerSeller(v, memo, sd, STREET.unit, want + own, budget + own * STREET.unit, onlyOf(key));
    if (!e) continue;
    out.push(e);
    msgs -= 1;
    const units = e.terms.goods[key];
    if (units === own && e.terms.cash === own * STREET.unit) continue;
    memo.orders[sd.id] = { with: sd.with, kind, units, day: v.day };
    want -= units - own;
    budget -= e.terms.cash - own * STREET.unit;
  }
  return { out, msgs, want, budget };
}

// The seller's side: hand over what each buyer it asked has ordered, as far as its goods go; to a buyer it can't serve
// any more, say so (an answer with no goods), so the buyer looks elsewhere. In R3-6's canny cast also what a buyer
// orders in a sit-down the buyer asked for, which it took (takeAsks); and what it couldn't hand over is demand.
// R5-deals: where no order has come, a buyer that paid against the sit-down's deal gets the goods its cash covers; and in
// a sit-down it asked for about goods (askBuyers; noteAsks remembers which), once the buyer has taken the ask, it states
// what it sells there as typed terms, once (a buyer's night of goods of the kind that buyer works with, as far as it
// holds them, at the agents' price), or says it has none.
function deliverGoods(v, cfg, memo, goods, msgs) {
  const out = [];
  memo.stated ||= {};
  memo.countered ||= {};
  for (const sd of v.me.sitdowns) {
    if ((sd.asked !== 'me' && !(cfg.canny && sd.asked === 'them')) || sd.state !== 'open' || memo.delivered[sd.id]) continue;
    // R5-deals: the buyer's latest order there, as its latest offer stands.
    const order = sd.said.filter(m => m.from === sd.with && m.say === 'offer' && isBuy(m.terms) && m.terms.goods).at(-1);
    if (!order) {
      const due = paidFor(dealIn(v, sd));
      const k = due && Object.keys(asDoses(due)).find(x => sellsOf(cfg).includes(x) && goods[x] > 0);
      if (k) {
        const n = Math.min(asDoses(due)[k], goods[k]);
        memo.delivered[sd.id] = true;
        out.push({ kind: 'give', to: sd.with, goods: asTemp({ [k]: n }), ...naming(v, sd.with, sd.id) });
        goods[k] -= n;
        memo.sold[k] = v.day;
        memo.held[k] = v.day;
        continue;
      }
      const kind = sellsTo(v, cfg, sd.with);
      if (sd.asked !== 'me' || (memo.goodsAsks || {})[sd.with] !== sd.day || memo.stated[sd.id] || !kind || msgs < 1) continue;
      memo.stated[sd.id] = v.day;
      const n = Math.min(onHand(kind), goods[kind] || 0);
      if (n < 1) memo.delivered[sd.id] = true;
      out.push(n < 1 ? { kind: 'say', sitdown: sd.id, say: 'answer', terms: { what: BUY, cash: 0 } } : sellOffer(sd, asTemp({ [kind]: n })));
      msgs -= 1;
      continue;
    }
    // L3-5a: a drug order (from a buyer that doesn't deal doses, or for a drug besides TEMP) is sellDrugs'.
    if (cfg.drugs && cfg.type === 'chemist' && drugOrder(v, sd.with, order.terms.goods)) continue;
    const [kind, units] = Object.entries(asDoses(order.terms.goods))[0];
    if (!sellsOf(cfg).includes(kind)) continue;
    // R5-deals (the review): never under its own quote, the agents' price; it states its quote again, once.
    if (!((order.terms.cash || 0) >= units * STREET.unit)) {
      const n = Math.min(units, goods[kind] || 0);
      if (!memo.countered[sd.id] && n >= 1 && msgs >= 1) {
        out.push(sellOffer(sd, asTemp({ [kind]: n })));
        memo.countered[sd.id] = true;
        msgs -= 1;
      }
      continue;
    }
    memo.delivered[sd.id] = true;
    const n = Math.min(units, goods[kind] || 0);
    if (cfg.canny) {
      noteUnmet(v, memo, kind, units - n);
      if (memo.lots && memo.lots[sd.id]) memo.lots[sd.id].units = 0;
    }
    if (n < 1) {
      if (msgs > 0) {
        out.push({ kind: 'say', sitdown: sd.id, say: 'answer', terms: { what: BUY, cash: 0 } });
        msgs -= 1;
      }
      continue;
    }
    out.push({ kind: 'give', to: sd.with, goods: asTemp({ [kind]: n }), ...naming(v, sd.with, sd.id) });
    goods[kind] -= n;
    memo.sold[kind] = v.day;
    memo.held[kind] = v.day;
  }
  return { out, msgs };
}

// The seller's first move of the day: ask buyers of each kind it holds for a sit-down, as many as its stock can serve
// (a buyer's night of goods each, at most STREET.asks), skipping any that owes it for more than two nights' goods. In
// R3-6's canny cast the buyers its view shows holding least of the kind come first (stockSeen), not buyers at random,
// and never a crewmate (a crew's sit-downs are its jobs').
function askBuyers(v, ctx, cfg, memo, goods, msgs) {
  const me = v.me;
  const out = [];
  const mates = cfg.canny ? crewOf(v) : new Set();
  for (const kind of sellsOf(cfg)) {
    // The canny cast: what it hasn't offered a buyer who asked it today (takeAsks).
    const spare = (goods[kind] || 0) - (cfg.canny ? Object.values(memo.lots || {}).filter(x => x.kind === kind).reduce((t, x) => t + x.units, 0) : 0);
    if (spare < 1) continue;
    const buyers = v.board.agents.filter(a => a.trade === BUYER_OF[kind] && a.id !== me.id && !a.jailed && !a.boarded
      && !me.sitdowns.some(sd => sd.with === a.id) && !(owesMe(v, a.id) > 2 * onHand(kind) * STREET.unit) && !mates.has(a.id));
    const lots = Math.min(STREET.asks, Math.ceil(spare / onHand(kind)));
    const order = shuffle(rng(ctx.seed, 'sell', me.id, v.day, kind), buyers);
    if (cfg.canny) order.sort((x, y) => stockSeen(v, x.id, kind) - stockSeen(v, y.id, kind));
    for (const b of order.slice(0, lots)) {
      if (msgs < 1) break;
      out.push({ kind: 'ask', to: b.id, line: sellLine(kind, Math.min(onHand(kind), goods[kind] || 0), STREET.unit) });
      msgs -= 1;
    }
  }
  return { out, msgs };
}

// R5-deals: the buyers a seller asked about goods today (askBuyers), remembered by agent and day, so it states terms only
// in those sit-downs (deliverGoods), never in one it asked for anything else (a crew's job, muscle). Returns the asks.
function noteAsks(v, memo, asks) {
  memo.goodsAsks = Object.fromEntries(Object.entries(memo.goodsAsks || {}).filter(([id, d]) => d === v.day || v.me.sitdowns.some(sd => sd.with === id && sd.day === d)));
  for (const e of asks) memo.goodsAsks[e.to] = v.day;
  return asks;
}

// The city's shop and buyer, when no agent deals (§9): in the day's last round, or any round of the last day. In the
// trades cast (L2-6b) the buyer also takes a Gunrunner's parts past its one unsold gun, and what covers the rent
// (coverRent; `tonight`: the goods tonight's work uses, or null when it pays cash).
function cityTrades(v, ctx, cfg, memo, goods, cash, tonight = null) {
  const out = [];
  const lastDay = v.day >= N.nights;
  if (!lastDay && ctx.round < (ctx.rounds || 3)) return out;
  for (const kind of lastDay ? ['chems', 'parts', 'doses'] : SELLS[cfg.type]) {
    const have = goods[kind] || 0;
    if (!have) continue;
    let units = 0;
    if (lastDay) units = have;
    // R3-6, the canny cast: goods no agent can use any more go at once (usefulTo), and after STREET.slow days unsold only
    // what its buyers won't take while they can still use it (keepFor).
    else if (cfg.canny && v.day > usefulTo(kind)) units = have;
    else if (memo.held[kind] != null && v.day - memo.held[kind] >= STREET.slow) units = cfg.canny ? Math.max(0, have - keepFor(v, memo, kind)) : have;
    else if (cfg.type === 'smuggler' && have > STREET.cap) units = have - STREET.cap;
    if (units < 1) continue;
    out.push({ kind: 'sell', item: kind, units });
    goods[kind] -= units;
    memo.held[kind] = goods[kind] ? v.day : null;
  }
  if (cfg.every && !lastDay && !v.me.jail) {
    // Past its one unsold gun a Gunrunner builds no more until that gun sells, so its parts go to the city's buyer, but
    // (L4-4) those its warrant and its fake still need, and (R4-5, the canny cast) its lockpicks.
    const keep = (cfg.score ? scoreParts(v, memo) : 0) + (cfg.canny && cfg.type === 'gunrunner' ? pickParts(v, memo, goods.lockpicks || 0) : 0);
    if (cfg.type === 'gunrunner' && (goods.guns || 0) >= gunTarget(v, memo, cfg) && goods.parts > keep) {
      out.push({ kind: 'sell', item: 'parts', units: goods.parts - keep });
      goods.parts = keep;
    }
    if (tonight) out.push(...coverRent(v, SELLS[cfg.type], goods, cash, tonight, out));
  }
  if (cfg.type === 'chemist' && !lastDay && !v.me.jail) {
    // R3-6, the canny cast: the chems for the batches its buyers will take (cannyBatches).
    const need = (cfg.canny ? cannyBatches(v, memo) * N.cook.chems : N.cook.chems) - (goods.chems || 0);
    const filling = Object.values(memo.orders).some(o => o.kind === 'chems' && o.day === v.day);
    const price = v.board.market.shop.chems;
    if (need > 0 && !filling && price <= STREET.shopMax && cash - owing(v, memo, streetDeal(cfg.type)) - N.rent >= Math.ceil(price * need * 1.2)) {
      out.push({ kind: 'shop', item: 'chems', units: need });
    }
  }
  return out;
}

// A Dealer's corner tonight: its own, unless it's hot and the Dealer's heat is up (a hot corner adds a star a night,
// and 5 stars is an arrest); otherwise an open one (no holder, or one in jail), hot ones first, never last night's
// corner if it sold nothing there, picked by the seed so Dealers don't all crowd one corner. (At 3 stars it's wanted,
// and it lies low instead: see streetPlan.) In the trades cast an open corner comes from the street's pecking order
// (cornerByOrder, L2-6b), and a hot corner it can see it would win is contested (cornerFor, L2-6d).
function pickCorner(v, ctx, memo, cfg = {}) {
  const me = v.me;
  if (cfg.every) return cornerFor(v, !!cfg.canny);
  const free = id => !id || !v.board.agents.some(a => a.id === id && !a.jailed && !a.boarded);
  const hotOk = me.heat <= 3;
  const mine = v.board.corners.find(c => c.holder === me.id);
  if (mine && (hotOk || !mine.hot)) return mine;
  const open = v.board.corners.filter(c => c.holder !== me.id && free(c.holder) && (hotOk || !c.hot) && memo.tied[c.corner] !== v.day - 1);
  return shuffle(rng(ctx.seed, 'corner', me.id, v.day), open).sort((x, y) => Number(y.hot) - Number(x.hot))[0] || null;
}

// Tonight's plan for a trade bot or the Cop seat: its trade's night of work when it holds what the work needs (the
// Smuggler always can), else a hustle. Deterministic for the day, so the dress it picks by day fits the night it plays.
// A trade bot that's wanted lies low when it has a home: out on the street it's a Cop's collar (§13), and at home the
// lock and laying low hold. In the trades cast (L2-6b) a cook or a build that would leave it short of the rent due at
// dawn gives way to a hustle (shortOfRent). In R3-6's canny cast a cook that pays more than a hustle runs a night's rent
// tab instead, unless it holds a rare-or-better piece (an evicted agent carries everything, where a hit can take it);
// and a night its trade's work wouldn't pay says why (memo.idle).
export function streetPlan(v, ctx, cfg, memo) {
  const me = v.me;
  if (me.wanted && cfg.type !== 'cop' && v.legal.some(l => l.kind === 'laylow')) {
    return { play: { kind: 'laylow', place: HOMES }, reason: 'wanted: lie low, away from the cops', place: HOMES, home: true };
  }
  let why = 'a hustle always pays';
  if (cfg.type === 'cop') {
    // The Cop seat checks its own plays: a collar's legal entry lists its places.
    const c = copPlan(v, ctx, cfg);
    if (c) return c;
  } else {
    const plan = tradeWork(v, ctx, cfg, memo);
    // L2-6d: a deal that would make it wanted before the ferry, with no bail reserve to pay its way out, gives way too.
    const cool = !!plan && cfg.every && plan.play.kind === 'deal' && staysCool(v, cfg);
    const tab = !!plan && !!cfg.canny && plan.play.kind === 'cook' && !holdsRare(v) && shortOfRent(v, plan.play);
    if (plan && tab && !cool) return { ...plan, reason: `${plan.reason}; short of compute, a night on the tab` };
    if (plan && !(cfg.every && shortOfRent(v, plan.play)) && !cool) return plan;
    if (plan) why = cool ? 'no bail reserve before the ferry: a hustle, not a corner that makes me wanted' : `short of compute: a hustle pays it, not a ${plan.play.kind}`;
    else if (cfg.canny && memo.idle && memo.idle.day === v.day) why = memo.idle.why;
  }
  return hustleNight(v, cfg, why);
}

// The trade's night of work, when it holds what the work needs and the play is legal; else null.
function tradeWork(v, ctx, cfg, memo) {
  const me = v.me;
  const held = asDoses(me.goods);
  const has = k => held[k] || 0;
  const legal = p => v.legal.some(l => l.kind === p.kind && ['place', 'corner', 'batches', 'guns', 'lockpicks'].every(k => p[k] === undefined || l[k] === p[k]));
  let plan = null;
  if (cfg.canny) memo.idle = null;
  if (cfg.type === 'smuggler' && cfg.canny) {
    // R3-6, the canny cast: the run worth most at the drop the show leaves it (cannyRun), and only when it pays more than
    // the hustle it skips.
    const run = cannyRun(v, memo);
    const wage = hustlePay(v, cfg);
    if (run.value <= wage) return idle(v, memo, `a run won't beat a hustle: about $${Math.round(run.value)} at the ${run.drop} drop against $${wage}`);
    plan = { play: { kind: 'run', place: run.drop }, reason: `a run at the ${run.drop} drop: about $${Math.round(run.value)} against a $${wage} hustle`, place: run.drop };
  } else if (cfg.type === 'smuggler') {
    // The drop worth most: the units it got there last time (an untried drop counts as all 6), at the agent price for a
    // kind an agent bought from it lately, or else at the city's buyer price.
    const value = kind => ((memo.sold[kind] != null && v.day - memo.sold[kind] <= 3) || v.day <= 2 ? STREET.unit : v.board.market.buyer[kind]);
    const best = shuffle(rng(ctx.seed, 'drop', me.id, v.day), Object.keys(N.drops).sort())
      .map(d => ({ d, score: (memo.drops[d] ?? N.dropUnits) * value(N.drops[d]) }))
      .sort((x, y) => y.score - x.score)[0];
    plan = { play: { kind: 'run', place: best.d }, reason: `a run at the ${best.d} drop`, place: best.d };
  } else if (cfg.type === 'chemist' && has('chems') >= N.cook.chems) {
    // Cook at home while its heat is low, else at the lab out in Blackpine Woods (no heat, but lawless). In the layer3
    // cast (L3-5a), a batch of a drug its buyers ordered and it couldn't hand over (cookDrug), else TEMP as before.
    const drug = cfg.drugs ? cookDrug(v, cfg, memo) : null;
    let batches = drug ? 1 : Math.min(N.cook.batches, Math.floor(has('chems') / N.cook.chems));
    let worth = '';
    if (cfg.canny && !drug) {
      // R3-6, the canny cast: the batches its buyers will take (cannyBatches), and only when their doses pay more than a
      // hustle.
      const wage = hustlePay(v, cfg);
      batches = Math.min(batches, cannyBatches(v, memo));
      if (!batches) return idle(v, memo, "a cook won't beat a hustle: its buyers have the doses they take");
      const value = haulWorth(v, memo, 'doses', batches * N.cook.doses, true);
      if (value <= wage) return idle(v, memo, `a cook won't beat a hustle: about $${Math.round(value)} against $${wage}`);
      worth = `: ${batches} batch${batches > 1 ? 'es' : ''} its buyers will take, about $${Math.round(value)} against a $${wage} hustle`;
    }
    const named = drug ? { drug: drug.drug, ...(drug.lies ? { lies: drug.lies } : {}) } : {};
    const home = !me.evicted && me.heat < 2;
    plan = home
      ? { play: { kind: 'cook', place: HOMES, batches, ...named }, reason: `cook at home${worth}`, place: HOMES, home: true }
      : { play: { kind: 'cook', place: 'forest', batches, ...named }, reason: `cook at the lab, away from the heat${worth}`, place: 'forest' };
  } else if (cfg.type === 'dealer' && has('doses')) {
    const c = pickCorner(v, ctx, memo, cfg);
    // R3-6, the canny cast: where the corner it would have worked without reading its heat would make it wanted tonight
    // (cannyWorks), it says so; and with no corner left that keeps it under wanted, it takes a hustle.
    const was = cfg.canny ? cornerFor(v) : null;
    const moved = !!was && (!c || was.corner !== c.corner) && !cannyWorks(v, me, was) ? `: not ${was.corner}, whose star would make me wanted` : '';
    if (c) plan = { play: { kind: 'deal', corner: c.corner, place: c.place }, reason: (c.holder === me.id ? `deal on my corner, ${c.corner}` : contested(v, c) ? `contest ${c.holder}'s corner ${c.corner}` : `take the open corner ${c.corner}`) + moved, place: c.place };
    else if (cfg.canny) return idle(v, memo, `no corner left that keeps me under wanted${moved}`);
  } else if (cfg.score && cfg.type === 'gunrunner' && !me.evicted && scoreBuild(v, memo) && v.legal.some(l => l.kind === 'build')) {
    // L4-4: a warrant or a fake first (scoreBuild). The legal plays list builds of guns and lockpicks only, so a build
    // is legal tonight and the rules check the rest.
    const b = scoreBuild(v, memo);
    return { play: { kind: 'build', place: HOMES, guns: 0, lockpicks: 0, ...b }, reason: b.warrants ? 'build a forged warrant to order' : 'build a fake for a buyer', place: HOMES, home: true };
  } else if (cfg.canny && cfg.type === 'gunrunner' && !me.evicted) {
    // R4-5, the canny cast: its guns as before, and lockpicks to the demand its record shows (cannyBuild).
    const b = cannyBuild(v, memo, cfg);
    if (b && b.idle) return idle(v, memo, b.idle);
    if (b) plan = { play: { kind: 'build', place: HOMES, guns: b.guns, lockpicks: b.picks }, reason: b.reason, place: HOMES, home: true };
  } else if (cfg.type === 'gunrunner' && !me.evicted && has('parts') >= N.build.guns && has('guns') < gunTarget(v, memo, cfg)) {
    // It builds to demand: no more guns than its stock target (gunTarget), so parts aren't sunk into guns nobody buys.
    const guns = Math.min(Math.floor(Math.min(has('parts'), N.build.parts) / N.build.guns), cfg.every ? gunTarget(v, memo, cfg) - has('guns') : Infinity);
    plan = { play: { kind: 'build', place: HOMES, guns, lockpicks: 0 }, reason: `build ${guns} gun${guns > 1 ? 's' : ''}`, place: HOMES, home: true };
  }
  return plan && legal(plan.play) ? plan : null;
}

// A trade bot's (or the Cop seat's) day: dress for tonight's plan, pay for goods that arrived, take and fill orders,
// ask buyers, go to the city when no agent deals, and buy off the list like a hustler, keeping back rent and a
// night's goods.
function streetDay(v, ctx, cfg, memo) {
  const me = v.me;
  remember(v, memo);
  noteStreet(v, memo, cfg);
  const out = [...upkeep(v, streetFit(v, streetPlan(v, ctx, cfg, memo)), true, cfg)];
  let cash = me.cash - out.reduce((t, e) => t + (e.kind === 'rent' ? N.rent : e.kind === 'bail' ? me.jail.bail : 0), 0);
  let msgs = me.messagesLeft;
  const goods = asDoses(me.goods);
  for (const kind of SELLS[cfg.type]) {
    if (!goods[kind]) memo.held[kind] = null;
    else if (memo.held[kind] == null) memo.held[kind] = v.day;
  }
  const paid = payDebts(memo, cash, v, cfg.type);
  out.push(...paid.out);
  cash = paid.cash;
  // Nobody works on the last night, so nobody buys goods for it.
  if (v.day < N.nights) {
    const o = orderGoods(v, cfg, memo, cash, msgs, ctx);
    out.push(...o.out);
    msgs = o.msgs;
    // R3-6, the canny cast: a buyer's ask is taken, and the seller says what it can sell there (takeAsks).
    if (cfg.canny) {
      const t = takeAsks(v, cfg, memo, goods, msgs);
      out.push(...t.out);
      msgs = t.msgs;
    }
    const d = deliverGoods(v, cfg, memo, goods, msgs);
    out.push(...d.out);
    msgs = d.msgs;
    if (cfg.type === 'gunrunner') {
      const g = sellGuns(v, memo, goods, msgs, cfg);
      out.push(...g.out);
      msgs = g.msgs;
    }
    if (ctx.round === 1) out.push(...noteAsks(v, memo, askBuyers(v, ctx, cfg, memo, goods, msgs).out));
  }
  if (GUN_BUYERS.includes(cfg.type)) {
    const g = gunErrands(v, ctx, memo, cash, cfg);
    out.push(...g.out);
    cash = g.cash;
  }
  out.push(...cityTrades(v, ctx, cfg, memo, goods, cash, cfg.every ? inGoodsTonight(v, ctx, cfg, memo) : null));
  noteTakes(v, memo);
  out.push(...fenceDay(v, ctx, out, memo.taken, partnersOf(memo, v.day), memo, cfg));
  // L2-6c: until it's armed, the Cop seat in the trades cast keeps back what a gun costs from the list too.
  const saving = savesForGun(cfg, v) && !armed(v) ? gunPrice(v) : 0;
  // L2-6d: as the list closes, a seat in the trades cast spends down instead (spendDown).
  if (closing(v, cfg)) out.push(...spendDown(v, ctx, Math.min(cash, cashLeft(v, out)) - stillNeeds(v, ctx, cfg, memo), out, cfg));
  else if (ctx.round === 1 && !me.jail) out.push(...listBuy(v, ctx, cash - reserveOf(cfg.type) - owing(v, memo, streetDeal(cfg.type)) - saving - lateReserve(v, cfg)));
  return out;
}

// A worker's buy off the list in layer 2: the cheapest rare-or-better it can afford (rares are what the season is for,
// and the only pieces that pay flex), else one of the few cheapest, as a hustler buys. A piece at the fence for
// less than the list asks comes first, a rare before anything else.
function listBuy(v, ctx, budget) {
  const bargain = fenceBargain(v, ctx, budget, 1) || fenceBargain(v, ctx, budget, 0);
  if (bargain) return [{ kind: 'fence_buy', deal: bargain.deal }];
  const open = openToBuy(v, budget);
  if (!open.length) return [];
  const rares = open.filter(t => RANK[t.tier] >= 1).sort((x, y) => RANK[x.tier] - RANK[y.tier] || x.price - y.price || (x.trait < y.trait ? -1 : 1));
  return [offerFor(ctx.rng, rares[0] || cheapPick(ctx.rng, open), budget)];
}

// A trade bot that expects a crew to come for it tonight (counterHit) hits one of the crew's likely backers instead of
// working: the crews' targets in layer 2 are mostly the trades' homes, full of what their money bought. In the trades
// cast (L2-6c) a Cop seat that leads tonight's collar keeps it, since the other Cops back it (policePlan).
function streetNight(v, ctx, cfg, memo) {
  remember(v, memo);
  noteStreet(v, memo, cfg);
  const lead = cfg.every && cfg.type === 'cop' ? copPlan(v, ctx, cfg) : null;
  if (lead && lead.play.kind === 'collar') return { play: lead.play, reason: lead.reason };
  const c = counterHit(v, memo, rng(ctx.seed, 'counter', v.me.id, v.day), cfg.layer, crewSight(cfg));
  if (c) return c;
  const plan = streetPlan(v, ctx, cfg, memo);
  if (plan.play.kind === 'deal') memo.dealt = { night: v.day, corner: plan.play.corner, sold: false };
  return { play: plan.play, reason: plan.reason };
}

// --- layer 2: guns, the crate and the Cop seat (GAME.md §8, §9, §13) --------------------------------------------------
// Guns (§8: +1 a person, attacking or defending). Bot settings, not game numbers: a buyer offers a Gunrunner `share` of
// the city shop's next gun price (§9: Gunrunners undercut the shop); a Gunrunner sells for no less than `min`; a buyer
// keeps `keep` back besides tonight's rent, and buys at the shop only with `shopSpare` to spare beyond its price.
export const GUNS = { share: 0.75, min: 100, keep: 40, shopSpare: 150 };
// The bots that buy a gun: the robbers, the crews and the Cop seat.
const GUN_BUYERS = ['scout', 'guess', 'crew', 'cop'];
export const gunPrice = v => Math.round(v.board.market.shop.guns * GUNS.share);
// R5-deals: what a Gunrunner states it sells a gun for: a buyer's price, never under its own least (GUNS.min).
const gunAsk = v => Math.max(GUNS.min, gunPrice(v));
// A Gunrunner keeps STREET.gunStock guns ahead of any buyer, plus one for each gun it sold in the last 3 days. In the
// trades cast (L2-6b) it keeps HABITS.unsold: it builds another only once one sells.
const gunTarget = (v, memo, cfg = {}) => (cfg.every ? HABITS.unsold : STREET.gunStock + (memo.gunSales || []).filter(d => v.day - d <= 3).length);

// What a gun buyer learns from its own record since it last looked: the gun it ordered arriving (the order is done; it
// owes the Gunrunner the price it offered, on the deal record). An order lives in its sit-down, so it lapses once the sit-down is closed or past its last day
// (R5-deals: no longer with the day), or when the Gunrunner says it has none.
function noteGun(v, memo) {
  const me = v.me;
  let seen = memo.gunSeen == null ? -1 : memo.gunSeen;
  for (const e of v.events) {
    if (e.n <= seen) continue;
    const o = memo.gunOrder;
    // R5-deals: the order is done once its gun comes; what it owes for it is on the deal record (gunErrands).
    if (o && o.price && e.type === 'give' && e.to === me.id && e.from === o.with && e.goods && e.goods.guns) memo.gunOrder = null;
  }
  for (const e of v.events) if (e.n > seen) seen = e.n;
  memo.gunSeen = seen;
  const o = memo.gunOrder;
  const at = o ? orderSd(v, o) : null;
  if (o && (!at || saidNone(at, o.with))) memo.gunOrder = null;
}

// The buyer's side of a gun (a robber, a crew member, the Cop seat), at most one: pay for one that arrived; with none,
// ask a Gunrunner for a sit-down in the day's first round (one whose public holdings show guns, if any), offer it the
// price in a later round, and pay when the gun arrives. With no Gunrunner to buy from, the city's shop in the day's last
// round, if it can spare that much. Returns the errands and the cash left to spend. In the trades cast (L2-6b) a seat
// that works the Gunrunner trade builds its own instead (`cfg`: its seat), and (L2-6c) the Cop seat keeps back only
// tonight's rent: its patrol pays cash every night, and a gun wins collars a lone Cop loses (savesForGun).
export function gunErrands(v, ctx, memo, cash, cfg = {}) {
  const me = v.me;
  const out = [];
  noteGun(v, memo);
  // R5-deals: what it owes for a gun, as the deal record has it; one still unpaid keeps it from ordering another.
  const paid = payOwed(v, memo, cash, goodsDeal(['guns']));
  out.push(...paid.out);
  cash = paid.cash;
  const gunOwed = owing(v, memo, goodsDeal(['guns'])) > 0;
  if (me.jail || armed(v) || gunOwed || v.day >= N.nights || buildsItsOwn(cfg)) return { out, cash };
  // R4-4, the canny cast: the Cop seat buys a gun only while it would change a collar it plans (copNeedsGun).
  if (cfg.type === 'cop' && cfg.canny && !copNeedsGun(v, cfg)) return { out, cash };
  const price = gunPrice(v);
  const spare = cash - N.rent - (savesForGun(cfg, v) ? 0 : GUNS.keep);
  const o = memo.gunOrder;
  if (!o && ctx.round === 1 && spare >= price && me.messagesLeft >= 2) {
    const runners = v.board.agents.filter(a => a.trade === 'gunrunner' && a.id !== me.id && !a.jailed && !a.boarded
      && !me.sitdowns.some(sd => sd.with === a.id)).sort(byNum);
    const stocked = runners.filter(a => {
      const h = holdingsOf(v, a.id);
      return h && h.goods && h.goods.guns;
    });
    if (runners.length) {
      const g = pick(rng(ctx.seed, 'gun', me.id, v.day), stocked.length ? stocked : runners);
      out.push({ kind: 'ask', to: g.id, line: itemLine('a gun', price) });
      memo.gunOrder = { with: g.id, day: v.day, price: null };
    }
  } else if (o && !o.price && spare >= price && me.messagesLeft >= 1) {
    // R5-deals: it orders once the sit-down it asked for opens, whichever day that is.
    const sd = orderSd(v, o);
    if (sd && sd.state === 'open') {
      out.push({ kind: 'say', sitdown: sd.id, say: 'offer', terms: { what: BUY, goods: { guns: 1 }, cash: price } });
      Object.assign(o, { price, sitdown: sd.id });
    }
  } else if (o && o.price && me.messagesLeft >= 1) {
    // R9d: its order said, it answers the Gunrunner (answerSeller): a gun for no more than its price it takes, and words
    // with no terms get the order again, once.
    const sd = orderSd(v, o);
    const e = sd && sd.state === 'open' ? answerSeller(v, memo, sd, o.price, 1, o.price, onlyOf('guns')) : null;
    if (e) {
      out.push(e);
      o.price = e.terms.cash;
    }
  }
  const shop = v.board.market.shop.guns;
  if (ctx.round === (ctx.rounds || 3) && !memo.gunOrder && !out.some(e => e.kind === 'ask') && spare >= shop + GUNS.shopSpare) {
    out.push({ kind: 'shop', item: 'guns', units: 1 });
    cash -= shop;
  }
  return { out, cash: cash - (memo.gunOrder && memo.gunOrder.price ? memo.gunOrder.price : 0) };
}

// The Gunrunner's side: take any sit-down a gun buyer asks for (a Smuggler's ask is about parts; orderGoods answers
// it, and in the layer4 cast sellWarrants takes a Smuggler leader's), and hand a gun to each offer of at least GUNS.min
// while it has one; to an offer it can't fill, say so. It's owed the price until the buyer pays. R4-5, the canny cast
// (`cfg.canny`): an order for lockpicks is filled the same way (sellPick). R5-deals: as it takes an ask, holding a
// gun, it states its offer as typed terms (a gun at gunAsk), so a buyer that orders nothing still reads one; and a
// buyer that paid against the deal before any order gets the guns its cash covers.
function sellGuns(v, memo, goods, msgs, cfg = {}) {
  const me = v.me;
  const out = [];
  memo.gunSales ||= [];
  memo.stated ||= {};
  for (const sd of me.sitdowns) {
    if (sd.asked !== 'them') continue;
    const asker = v.board.agents.find(a => a.id === sd.with);
    if (sd.state === 'asked') {
      if (asker && asker.trade !== SELLER_OF.parts && msgs >= 1) {
        out.push({ kind: 'answer', sitdown: sd.id, accept: true });
        msgs -= 1;
        if ((goods.guns || 0) >= 1 && msgs >= 1) {
          out.push(sellOffer(sd, { guns: 1 }, gunAsk(v)));
          memo.stated[sd.id] = v.day;
          msgs -= 1;
        }
      }
      continue;
    }
    if (sd.state !== 'open' || memo.delivered[sd.id]) continue;
    const picks = !!cfg.canny && sd.said.find(m => m.from === sd.with && m.say === 'offer' && isBuy(m.terms) && m.terms.goods && m.terms.goods.lockpicks && !m.terms.goods.guns);
    if (picks) {
      memo.delivered[sd.id] = true;
      msgs = sellPick(v, memo, goods, sd, picks, msgs, out);
      continue;
    }
    const offer = sd.said.find(m => m.from === sd.with && m.say === 'offer' && isBuy(m.terms) && m.terms.goods && m.terms.goods.guns);
    const due = !offer && paidFor(dealIn(v, sd));
    if (due && due.guns && (goods.guns || 0) >= 1) {
      const n = Math.min(due.guns, goods.guns);
      memo.delivered[sd.id] = true;
      out.push({ kind: 'give', to: sd.with, goods: { guns: n }, ...naming(v, sd.with, sd.id) });
      goods.guns -= n;
      for (let i = 0; i < n; i++) memo.gunSales.push(v.day);
      continue;
    }
    if (!offer) continue;
    const n = Math.min(offer.terms.goods.guns, goods.guns || 0);
    // R5-deals (the review): never under its own quote (gunAsk, a gun at the buyers' price, never under GUNS.min); it
    // states its quote again, once.
    if (n >= 1 && !((offer.terms.cash || 0) >= gunAsk(v) * offer.terms.goods.guns)) {
      memo.countered ||= {};
      if (!memo.countered[sd.id] && msgs >= 1) {
        out.push(sellOffer(sd, { guns: n }, gunAsk(v)));
        memo.countered[sd.id] = true;
        msgs -= 1;
      }
      continue;
    }
    memo.delivered[sd.id] = true;
    if (n >= 1) {
      out.push({ kind: 'give', to: sd.with, goods: { guns: n }, ...naming(v, sd.with, sd.id) });
      goods.guns -= n;
      for (let i = 0; i < n; i++) memo.gunSales.push(v.day);
    } else if (msgs >= 1) {
      out.push({ kind: 'say', sitdown: sd.id, say: 'answer', terms: { what: BUY, cash: 0 } });
      msgs -= 1;
    }
  }
  return { out, msgs };
}

// The Cop seat (§13): a collar on a wanted agent it reckons it can take, else a patrol.
// - A collar finds its target out where the show last saw it (naming Pleasantview also finds it at home) and is fought
//   like a hit, with the city cops on the Cop's side: +2 except in lawless districts, +1 more in a heavy one (GAP
//   gap.collar). It pays $100 a bail star, so the Cop takes the most-starred target it can beat. A wanted agent is
//   reckoned armed (COP.armed), and at home it also has its lock and lays low. An agent that only turned wanted last
//   night (the public heat record) may lie low tonight, so the Cop goes after one that was wanted and still out.
// - A patrol (GAP gap.patrol): the docks on a shipment night, where the crate draws the grabbers; else the district
//   with the most fights the show made public lately; else its own workplace.
// - In the trades cast (L2-6c) every seat that works the Cop trade plays tonight's police plan instead (policePlan):
//   the plan's lead collars, the Cops it names back it, and the rest patrol.
export const COP = { armed: 1 };
export function copPlan(v, ctx, cfg) {
  const me = v.me;
  const tonight = v.board.tonight || {};
  const isLegal = (kind, f) => v.legal.some(l => l.kind === kind && f(l));
  if (cfg.every) {
    const c = !me.wanted && policePlan(v, !!cfg.drugs);
    if (c && c.lead === me.id && isLegal('collar', l => l.target === c.target && (l.places || []).includes(c.place))) {
      return { play: { kind: 'collar', target: c.target, place: c.place }, reason: `collar ${c.target}: ${c.why}; ${c.strength} against ${c.defence}`, place: c.place };
    }
    if (c && c.lead !== me.id && c.group.includes(me.id) && isLegal('back', l => l.target === c.lead)) {
      return { play: { kind: 'back', target: c.lead }, reason: `back ${c.lead}'s collar on ${c.target}`, place: c.place };
    }
    // L4-4: the vault's guards, from the Cops the collar leaves (guardPlan).
    const g = cfg.score ? guardPlan(v, policePlan(v, !!cfg.drugs)) : null;
    if (g && g.includes(me.id) && isLegal('guard', () => true)) {
      return { play: { kind: 'guard', place: VAULT_AT }, reason: `guard the vault, worth about ${vaultWorth(v)}`, place: VAULT_AT };
    }
  } else if (!me.wanted) {
    const options = [];
    for (const a of v.board.agents) {
      if (a.id === me.id || !a.wanted || a.jailed || a.boarded) continue;
      const last = (v.sightings[a.id] || []).slice(-1)[0];
      if (!last) continue;
      const turned = v.events.some(e => e.type === 'heat' && e.agent === a.id && e.was < N.wantedAt && e.heat >= N.wantedAt && e.t >= 2 * v.day - 1);
      if (turned) continue;
      const home = last.place === 'home';
      const place = home ? HOMES : last.place;
      const lv = tonight[place] || 'normal';
      const power = 1 + (armed(v) ? 1 : 0) + (lv !== 'lawless' ? N.copsWanted : 0) + (lv === 'heavy' ? N.copsHeavy : 0);
      const defence = 1 + COP.armed + (home ? 2 : 0);
      if (power > defence && isLegal('collar', l => l.target === a.id && (l.places || []).includes(place))) options.push({ a, place, home });
    }
    if (options.length) {
      const best = shuffle(rng(ctx.seed, 'collar', me.id, v.day), options).sort((x, y) => y.a.heat - x.a.heat)[0];
      return { play: { kind: 'collar', target: best.a.id, place: best.place }, reason: `collar ${best.a.id}: wanted, last seen ${best.home ? 'at home' : `in ${best.place}`}`, place: best.place };
    }
  }
  const fights = {};
  for (const e of v.events) if (e.type === 'fight' && DISTRICTS.includes(e.place)) fights[e.place] = (fights[e.place] || 0) + 1;
  const busiest = Object.keys(fights).sort((x, y) => fights[y] - fights[x] || (x < y ? -1 : 1))[0];
  const place = v.board.crate ? CRATE_AT : busiest || cfg.fav;
  if (!isLegal('patrol', l => l.place === place)) return null;
  const why = v.board.crate ? 'patrol the docks: a shipment tonight' : busiest ? `patrol ${place}, where the fights are` : `patrol ${place}`;
  return { play: { kind: 'patrol', place }, reason: why, place };
}

// --- L2-6c: the Cops in the trades cast (GAME.md §8, §13) ------------------------------------------------------------
// L2-6's cast never got a collar to a fight. Each Cop named the district where the show last saw its target, while a
// wanted agent lies low at home; Cops after one target each collared it, and rival groups that tie all fail (§8); a
// lone, unarmed Cop loses even at the right door; and the Cop seat never saved enough for a gun. In the trades cast
// (`cfg.every`) every seat that works the Cop trade reads tonight's police plan off public facts, so all of them reach
// the same one (policePlan):
// - where: at home, unless the show saw the target out last night while it was already wanted (then there again); at
//   4 stars always home, since one more crime is an arrest. An evicted agent has no home: where the show last saw it;
// - who: the Cops on the board, free and not wanted, whose play on the latest night the record has made public (§19:
//   24 hours later) was Cop work, a patrol, a collar or backing a collar. The collar is the Cop seat's (the board names
//   each agent's driver, and the Cop seat's is `bot:cop`), else the lowest id's. The fewest other Cops it takes back
//   it, the strongest first, and COLLAR.spare more: one group, never rival ones, and the rest keep patrolling and keep
//   their wage;
// - when: only when the group's strength beats the target's defence. The group counts 1 each, +1 for a gun its
//   holdings 24 hours ago show, and the city cops on its side (§8: +2 except in a lawless district, +1 more in a heavy
//   one), but not brass knuckles, which a hoodie hides from some Cops and not others: every Cop reads the same facts,
//   so they all reach the same plan. The defence counts 1 for a home's lock and 1 for the target, +1 if its holdings
//   24 hours ago show a gun, +1 laying low (a wanted agent lies low at home), and anyone who backed it on that latest
//   public night, counted the same way. Of the targets all of them together beat, the most-starred (a collar pays $100
//   a star), then the lowest id.
// The Cop seat keeps a collar it leads over a counter-hit (streetNight), and saves for a gun before it buys off the list
// (gunErrands, streetDay). R4-4, the canny cast: only while its gun would change a collar it plans (copNeedsGun).
const COP_SEAT = 'bot:cop';
// R3-2's crime cast: a robber saves for its gun as the Cop seat does, since nothing else lets it win a fight alone.
const savesForGun = (cfg, v) => !!(cfg.every && ((cfg.type === 'cop' && (!cfg.canny || copNeedsGun(v, cfg))) || (cfg.sharp && robs(cfg) && !buildsItsOwn(cfg))));
// What a seat keeps back for the gun it saves for, while it has none.
const gunHold = (v, cfg) => (savesForGun(cfg, v) && !armed(v) ? gunPrice(v) : 0);
// R4-4, the canny cast: the Cop seat buys a gun only when it expects the gun to change a fight it plans, a collar. As the
// police plan reckons it from public facts, the Cops can win no collar now, and could with the Cop seat's strength one
// more (policePlan's `armedAs`). Before, it bought one in every season, though its collars were won as often without.
function copNeedsGun(v, cfg) {
  if (armed(v) || v.me.wanted || v.me.jail) return false;
  return !policePlan(v, !!cfg.drugs) && !!policePlan(v, !!cfg.drugs, v.me.id);
}
// Bot settings, not game numbers: `spare`, the backers a collar brings beyond the fewest that beat the defence it
// reckons, when it has the Cops for it: one, since a backer may not come and the defence is 24 hours old.
export const COLLAR = { spare: 1 };

// The latest night whose plays the record has made public, and each agent's play that night.
function publicNight(v) {
  const plays = v.events.filter(e => e.type === 'play' && e.t <= v.clock - 2);
  const night = Math.max(-1, ...plays.map(e => e.day));
  return Object.fromEntries(plays.filter(e => e.day === night).map(e => [e.agent, e]));
}
// Cop work, a public play on a public night (`plays`): a patrol, a collar, backing a collar, and (L4-4) a guard.
const copWork = (plays, p) => !!p && (p.kind === 'patrol' || p.kind === 'collar' || p.kind === 'guard' || (p.kind === 'back' && !!plays[p.target] && plays[p.target].kind === 'collar'));

// Where a collar finds a wanted agent tonight, from public facts (see above), or null.
export function collarSpot(v, a) {
  if (a.evicted) {
    const last = seenAt(v, a.id).slice(-1)[0];
    return last ? { place: last.place, home: false, why: `no home, last seen in ${last.place}` } : null;
  }
  const seen = (v.sightings[a.id] || []).find(x => x.night === v.day - 1);
  // Its heat at last night's lock: what last night's public heat record says it was, or, unchanged, what it is now.
  const heat = v.events.find(e => e.type === 'heat' && e.agent === a.id && e.t === 2 * v.day - 1);
  const wanted = (heat ? heat.was : a.heat) >= N.wantedAt;
  if (seen && seen.place !== 'home' && wanted && a.heat < N.maxHeat - 1) return { place: seen.place, home: false, why: `wanted and out in ${seen.place} last night` };
  return { place: HOMES, home: true, why: 'wanted, so it lies low at home' };
}

// What a collar on a wanted agent `a` pays its Cop, as every Cop reckons it from the same public facts (R4-4, GAP
// gap.collarPay): copPay.star for each star the board shows; under 'fine', out of its fine, so no more than half the cash
// its latest public holdings record shows; under 'once' nothing for an agent a collar has arrested before this season.
function collarWorth(v, a) {
  const full = a.heat * N.copPay.star;
  if (N['gap.collarPay'] === 'fine') return Math.min(full, Math.floor((publicHoldings(v, a.id) || { cash: 0 }).cash / 2));
  if (N['gap.collarPay'] === 'once' && v.events.some(e => e.type === 'arrest' && e.why === 'collar' && e.agent === a.id)) return 0;
  return full;
}

// Tonight's police plan, the same from every Cop's view: { target, place, home, lead, group, strength, defence, why },
// or null when the Cops working the trade beat no wanted agent's defence. `bounties` (the layer3 cast, L3-5b): a
// collar's pay (collarWorth) counts the bounties the board shows on its target (gap.bounty), all of them, so every Cop
// reads the same.
export function policePlan(v, bounties = false, armedAs = null) {
  const plays = publicNight(v);
  const agent = Object.fromEntries(v.board.agents.map(a => [a.id, a]));
  const free = id => !!agent[id] && !agent[id].jailed && !agent[id].boarded;
  const cops = v.board.agents.filter(a => a.trade === 'cop' && free(a.id) && !a.wanted && copWork(plays, plays[a.id])).sort(byNum);
  if (!cops.length) return null;
  const lead = cops.find(a => a.driver === COP_SEAT) || cops[0];
  const gun = id => {
    const h = publicHoldings(v, id);
    return h && h.goods && h.goods.guns ? 1 : 0;
  };
  // R4-4: `armedAs`, a Cop reckoned as holding a gun it doesn't (copNeedsGun's question).
  const power = a => 1 + (a.id === armedAs ? 1 : gun(a.id));
  // The backers it could call on, strongest first, then by id; a group is 5 at most (GAP).
  const others = cops.filter(a => a !== lead).sort((x, y) => power(y) - power(x) || byNum(x, y)).slice(0, N.groupMax - 1);
  const tonight = v.board.tonight || {};
  const options = [];
  for (const a of v.board.agents) {
    if (!a.wanted || !free(a.id)) continue;
    const spot = collarSpot(v, a);
    if (!spot) continue;
    const lv = tonight[spot.place] || 'normal';
    const backers = Object.values(plays).filter(p => p.kind === 'back' && p.target === a.id && free(p.agent)).map(p => p.agent);
    const defence = (spot.home ? 2 : 0) + 1 + gun(a.id) + backers.reduce((t, id) => t + 1 + gun(id), 0);
    // The fewest backers that beat it, and COLLAR.spare more in case a backer doesn't come or the target armed itself
    // since its holdings record: the rest keep patrolling, and keep their wage.
    const group = [lead];
    let strength = power(lead) + (lv !== 'lawless' ? N.copsWanted : 0) + (lv === 'heavy' ? N.copsHeavy : 0);
    let spare = COLLAR.spare;
    for (const b of others) {
      if (strength > defence) {
        if (spare === 0) break;
        spare -= 1;
      }
      group.push(b);
      strength += power(b);
    }
    if (strength > defence) options.push({ a, spot, strength, defence, group });
  }
  if (!options.length) return null;
  const pay = o => collarWorth(v, o.a) + bountyOn(v, o.a.id, PUBLIC_SIGHT);
  const best = options.sort((x, y) => (bounties ? pay(y) - pay(x) : y.a.heat - x.a.heat) || byNum(x.a, y.a))[0];
  return {
    target: best.a.id, place: best.spot.place, home: best.spot.home, lead: lead.id, group: best.group.map(a => a.id),
    strength: best.strength, defence: best.defence, why: best.spot.why,
  };
}

// The crate (§9): posted at the docks the morning of a shipment night, and grabbed by the strongest group that beats the
// cops there and every other group; a tie leaves it (GAP gap.shipments). What it's worth to a grabber: its cash, a gun
// at what a Gunrunner would charge, and other goods as loot (STREET.loot of the city buyer's price). Bot settings: a lone
// robber grabs only if its strength beats the expected defence by GRAB.lone (other grabbers may come), and then only at
// GRAB.odds; a crew by GRAB.crew.
export const GRAB = { lone: 2, crew: 1, odds: 0.5 };
export function crateWorth(v) {
  const c = v.board.crate;
  if (!c) return 0;
  let value = c.cash;
  for (const [k, u] of Object.entries(c.goods)) value += k === 'guns' ? u * gunPrice(v) : Math.round(u * (v.board.market.buyer[k] || 0) * STREET.loot);
  return value;
}

// A grabber remembers whether a patrol has stood at the docks: a public fight there that a patrol joined, or a patrol
// there once its record goes public.
function noteDocks(v, memo) {
  let seen = memo.docksSeen == null ? -1 : memo.docksSeen;
  for (const e of v.events) {
    if (e.n <= seen) continue;
    if ((e.type === 'fight' && e.place === CRATE_AT && e.patrol) || (e.type === 'patrol' && e.place === CRATE_AT)) memo.docksPatrol = e.night;
  }
  for (const e of v.events) if (e.n > seen) seen = e.n;
  memo.docksSeen = seen;
}

// The defence a grab expects at the docks tonight: the city cops (§8: +2 against a wanted grabber except in a lawless
// district, +1 more in a heavy one) and, once a patrol has stood there, an armed patrol.
export function grabDefence(v, memo, wanted) {
  noteDocks(v, memo);
  const lv = (v.board.tonight || {})[CRATE_AT] || 'normal';
  return (wanted && lv !== 'lawless' ? N.copsWanted : 0) + (lv === 'heavy' ? N.copsHeavy : 0) + (memo.docksPatrol != null ? 1 + COP.armed : 0);
}

// Loot is sold to the city's buyer (§9) in the day's last round: robbers don't run the street's trade. `keep`: the kinds
// a seat that works a trade keeps for it (tradeGoods).
function sellLoot(v, ctx, keep = []) {
  if (v.me.jail || ctx.round !== (ctx.rounds || 3)) return [];
  const held = asDoses(v.me.goods);
  return ['chems', 'parts', 'doses'].filter(k => held[k] && !keep.includes(k)).map(k => ({ kind: 'sell', item: k, units: held[k] }));
}

// --- the fence (layer 2, §9): spare pieces go up below what they last sold for, bargains get bought, partners swap ------
// Bot settings, not game numbers: a bot with swap partners keeps a spare piece FENCE.wait days for a swap (long enough to
// show on its public holdings record), then puts it up at FENCE.list × what it last sold for on the list; a bargain is a listing under
// FENCE.bargain × the list's price for its trait (a buyer picks among the FENCE.pick best, so buyers spread out); a bot
// with a spare piece offers a partner a swap on FENCE.swap of the days it could.
export const FENCE = { list: 0.8, bargain: 1, pick: 3, swap: 0.25, wait: 2 };
const slotOf = (v, trait) => (listOf(v, trait) || {}).slot || null;
// An agent's latest holdings record that's public by now (24 hours old, §19): what everyone, the agent included, can
// point to.
const publicHoldings = (v, id) => v.events.filter(e => e.type === 'holdings' && e.agent === id && e.t <= v.clock - 2).slice(-1)[0] || null;
// A street bot's trade partners for swaps: the agents it traded goods with in the last 3 days, by id.
const partnersOf = (memo, day) => Object.keys(memo.partners || {}).filter(id => day - memo.partners[id] <= 3).sort((x, y) => Number(x.slice(1)) - Number(y.slice(1)));

// The pieces this bot took in its own hits and break-ins (the bag goes to the leader), as its own view showed them.
function noteTakes(v, memo) {
  memo.taken ||= [];
  for (const e of v.events) {
    if ((e.type === 'rob' || e.type === 'burgle') && e.leader === v.me.id && e.copy && !memo.taken.includes(e.copy)) memo.taken.push(e.copy);
  }
}

// The outfit an agent will wear once these errands go through: the fit it dresses in, else what it wears now.
function fitAfter(v, errands) {
  const dress = errands.filter(e => e.kind === 'dress').slice(-1)[0];
  return dress ? dress.fit : Object.fromEntries(v.me.pieces.filter(p => p.worn).map(p => [p.slot, p.copy]));
}

// The pieces an agent won't wear, given the outfit it's putting on (slot -> copy): a second piece for a slot it fills
// with one at least as rare, and anything it took that isn't a robber's kit. `used`: pieces the day's earlier errands
// already move (into the crew stash, a hand-over).
export function sparePieces(v, fit, taken = [], used = new Set()) {
  const wearing = new Set(Object.values(fit || {}));
  const worn = {};
  for (const p of v.me.pieces) if (wearing.has(p.copy)) worn[p.slot] = p;
  return v.me.pieces.filter(p => !wearing.has(p.copy) && !used.has(p.copy)
    && ((worn[p.slot] && RANK[worn[p.slot].tier] >= RANK[p.tier]) || (taken.includes(p.copy) && !ROBBER_KIT.includes(p.ability))));
}

// The best bargain at the fence for a buyer with `budget` that wants at least `minRank`: listings under FENCE.bargain ×
// the list's price for their trait, never its own; it picks among the FENCE.pick cheapest against that price, by its
// own draw. Null if there's none.
export function fenceBargain(v, ctx, budget, minRank = 0) {
  if (v.day >= N.nights) return null;
  const mine = new Set((v.me.fence || []).filter(d => d.kind === 'listing').map(d => d.deal));
  const deals = (v.board.fence || []).filter(d => !mine.has(d.deal) && RANK[d.tier] >= minRank && d.price <= budget).map(d => {
    const t = listOf(v, d.trait);
    return { d, ratio: t && t.price ? d.price / t.price : Infinity };
  }).filter(x => x.ratio < FENCE.bargain).sort((x, y) => x.ratio - y.ratio || (x.d.deal < y.d.deal ? -1 : 1));
  if (!deals.length) return null;
  return pick(rng(ctx.seed, 'fence', v.me.id, v.day, ctx.round), deals.slice(0, FENCE.pick)).d;
}

// One spare piece a day goes up at the fence (the rarest first), at FENCE.list × what it last sold for on the list, once
// it has been spare `wait` days (`since`: copy -> the day it was first spare).
function fenceList(v, ctx, spare, since, wait) {
  const ready = spare.filter(p => v.day - since[p.copy] >= wait);
  if (v.me.jail || ctx.round !== 1 || v.day >= N.nights || !ready.length) return [];
  return [listing(v, ready.slice().sort(rarestFirst)[0])];
}
// The rarest first, then what it last sold for, then the copy.
const rarestFirst = (x, y) => RANK[y.tier] - RANK[x.tier] || (y.last || 0) - (x.last || 0) || (x.copy < y.copy ? -1 : 1);
// A piece up for sale at FENCE.list × what it last sold for on the list (its list price, if it never sold).
const listing = (v, p) => ({ kind: 'fence_list', copy: p.copy, price: Math.max(1, Math.floor((p.last || (listOf(v, p.trait) || {}).price || 0) * FENCE.list)) });

// Now and then, a swap with a partner (a crewmate, or an agent it trades goods with): a spare piece for one of the
// partner's unworn pieces of the same tier, in a slot this bot leaves empty. Both pieces are on public holdings
// records, so the partner can see what it's offered. Piece for piece, so the fence takes no cut.
function fenceSwap(v, ctx, spare, partners) {
  if (v.me.jail || ctx.round !== 1 || v.day >= N.nights || !spare.length || !partners.length) return [];
  if (rng(ctx.seed, 'swap', v.me.id, v.day)() >= FENCE.swap) return [];
  const filled = new Set(v.me.pieces.filter(p => p.worn).map(p => p.slot));
  const shown = new Set(((publicHoldings(v, v.me.id) || {}).pieces || []).map(p => p.copy));
  for (const give of spare.filter(p => shown.has(p.copy))) {
    for (const id of partners) {
      const h = publicHoldings(v, id);
      const want = h && h.pieces.find(q => q.tier === give.tier && slotOf(v, q.trait) && slotOf(v, q.trait) !== give.slot && !filled.has(slotOf(v, q.trait)));
      if (want) return [{ kind: 'fence_swap', to: id, give: { pieces: [give.copy] }, get: { pieces: [want.copy] } }];
    }
  }
  return [];
}

// A piece's tier, if this bot can see it: on the board (worn) or in its owner's last public holdings record.
function tierSeen(v, owner, copy) {
  const a = v.board.agents.find(x => x.id === owner);
  const worn = a && (a.fit || []).find(p => p.copy === copy);
  if (worn) return worn.tier;
  const h = publicHoldings(v, owner);
  const held = h && h.pieces.find(p => p.copy === copy);
  return held ? held.tier : null;
}

// Swaps offered to this bot: it accepts piece for piece when it holds what's asked and isn't putting it on (`fit`), and
// what it gets is at least as rare as what it gives, as far as it can see. `used` (the trades cast, L2-6d): pieces the
// day's earlier errands already move, and those an accepted swap gives, are spoken for.
function fenceAccepts(v, fit, used = null) {
  if (v.me.jail || v.day >= N.nights) return [];
  const wearing = new Set(Object.values(fit || {}));
  const mine = new Map(v.me.pieces.map(p => [p.copy, p]));
  const out = [];
  for (const d of v.me.fence || []) {
    if (d.kind !== 'swap' || d.b !== v.me.id || d.accepted) continue;
    if (d.get.cash || d.give.cash || Object.keys(d.get.goods).length || !d.get.pieces.length) continue;
    if (!d.get.pieces.every(k => mine.has(k) && !mine.get(k).worn && !wearing.has(k) && !(used && used.has(k)))) continue;
    const gets = d.give.pieces.map(k => tierSeen(v, d.a, k));
    if (gets.some(t => t == null)) continue;
    const giving = Math.max(...d.get.pieces.map(k => RANK[mine.get(k).tier]));
    if (Math.max(...gets.map(t => RANK[t])) < giving) continue;
    out.push({ kind: 'fence_accept', deal: d.deal });
    if (used) for (const k of d.get.pieces) used.add(k);
  }
  return out;
}

// A layer-2 bot's day at the fence: accept swaps offered to it, now and then offer a partner a swap, and put one spare
// piece up. `errands` are the day's errands so far (its outfit), `taken` its own takes. In the trades cast (L2-6d,
// `cfg.every`) a spare goes where it pays instead (fenceTrades).
function fenceDay(v, ctx, errands, taken, partners, memo, cfg = {}) {
  const fit = fitAfter(v, errands);
  const used = new Set(errands.flatMap(e => [e.copy, ...(e.pieces || []), ...((e.give && e.give.pieces) || [])]).filter(Boolean));
  const out = fenceAccepts(v, fit, cfg.every ? used : null);
  if (cfg.every) return [...out, ...fenceTrades(v, ctx, heldSpares(v, fit, taken, used))];
  const spare = sparePieces(v, fit, taken, used);
  // When each spare piece was first spare; a piece that isn't spare any more is forgotten.
  const since = {};
  for (const p of spare) since[p.copy] = (memo.spareSince || {})[p.copy] ?? v.day;
  memo.spareSince = since;
  // A swap, when one comes up, gets first claim on a spare piece; the rest go up for sale.
  const swap = fenceSwap(v, ctx, spare, partners);
  out.push(...swap);
  out.push(...fenceList(v, ctx, spare.filter(p => !swap.some(e => e.give.pieces.includes(p.copy))), since, partners.length ? FENCE.wait : 0));
  return out;
}

// --- every seat trades (L2-6): a strategy's free nights go to its trade ------------------------------------------------
// In the new cast (CASTS.trades) a seat whose strategy isn't a trade (`cfg.works`: the buy-late saver, the turtle, the
// robbers and the crews) works the trade it drew, as that trade's own bot would, on any night its strategy leaves free:
// tradeNight replaces the strategy's hustle. By day it keeps its strategy's errands and adds the trade's (tradeDay): it
// pays for goods that arrived first, then takes and fills orders, sells guns, asks buyers and goes to the city when no
// agent deals, as streetDay does. Its trade and its strategy never talk over each other: the trade leaves alone a
// sit-down the strategy already asked for or answered today, and a crew's job sit-downs on a job day; a robber offers
// no muscle deal in a sit-down it asked for about goods; hired muscle answers only what the trade left.

// The trade's side of a seat's config: the street's functions read the trade from `type`.
const asTrade = cfg => ({ ...cfg, type: cfg.trade });
// The goods a trade works with: what it sells and what it buys.
const tradeGoods = trade => [...SELLS[trade], BUYS[trade]].filter(Boolean);
const TALK = ['ask', 'answer', 'say'];

// A seat that works a trade pays what it owes for goods that arrived before anything else, keeping back the cash it
// promised for last night (a crew's cuts, hired muscle); its strategy plans with what's left.
function settleFirst(v, memo, cfg = null) {
  noteStreet(v, memo, cfg);
  const promised = v.me.promises.filter(p => p.by === v.me.id && p.what === 'pay' && p.night === v.day - 1).reduce((t, p) => t + (p.cash || 0), 0);
  return payDebts(memo, v.me.cash - promised, v, cfg ? cfg.trade : null).out;
}

// The cash an agent has once these errands go through: cashAfter, plus a gun bought at the city's shop and a listing
// bought at the fence.
function cashLeft(v, errands) {
  let cash = cashAfter(v, errands);
  for (const e of errands) {
    if (e.kind === 'shop') cash -= (v.board.market.shop[e.item] || 0) * e.units;
    else if (e.kind === 'fence_buy') cash -= ((v.board.fence || []).find(d => d.deal === e.deal) || { price: 0 }).price;
  }
  return cash;
}

// The view with a sit-down already in place with each agent these errands ask, and with each of `also`, so a second
// ask the same day goes to someone else (a pair has one sit-down a day, §14).
function withAsks(v, errands, also = []) {
  const ids = [...errands.filter(e => e.kind === 'ask').map(e => e.to), ...also];
  if (!ids.length) return v;
  return { ...v, me: { ...v.me, sitdowns: [...v.me.sitdowns, ...ids.map(id => ({ id: null, with: id, asked: 'me', state: 'asked', said: [] }))] } };
}

// What a seat keeps back for its trade: a night's goods (onHand, at STREET.unit) and what it still owes for goods.
const tradeReserve = (cfg, memo, v) => (BUYS[cfg.trade] ? onHand(BUYS[cfg.trade]) * STREET.unit : 0) + owing(v, memo, streetDeal(cfg.trade));

// The trade's errands for a seat that works one, after its strategy's (`done`, which paid its debts first). It buys no
// goods for a night its strategy has taken (a crew's job night, a turtle's nights once it holds a rare); it still sells
// what it holds.
function tradeDay(v, ctx, cfg, memo, done) {
  const t = asTrade(cfg);
  const me = v.me;
  // R3-6, the canny cast: a crew's job is the night its leader called one (crewCalled), and a crew's sit-downs are its
  // jobs', so its trade leaves every crewmate alone.
  const job = cfg.type === 'crew' && (cfg.canny ? crewCalled(v, cfg) : jobDay(v.day));
  const skip = new Set(cfg.canny && cfg.type === 'crew' ? cfg.mates : job ? (cfg.role === 'leader' ? cfg.mates : [cfg.leader]) : []);
  const asked = new Set(done.filter(e => e.kind === 'ask').map(e => e.to));
  const answered = new Set(done.filter(e => e.kind === 'answer').map(e => e.sitdown));
  const tv = { ...v, me: { ...me, sitdowns: me.sitdowns.filter(sd => !skip.has(sd.with) && !answered.has(sd.id)) } };
  // R3-2's crime cast: a robber's night is its strategy's when it means to rob tonight (robberTonight), so it buys no
  // goods for it either.
  const robbing = !!cfg.sharp && robs(cfg) && !!robberTonight(v, ctx, cfg, memo);
  const buying = !job && !(cfg.type === 'turtle' && holdsRare(v)) && !robbing;
  let cash = cashLeft(v, done);
  let msgs = me.messagesLeft - done.filter(e => TALK.includes(e.kind)).length;
  const goods = asDoses(me.goods);
  for (const e of done) if (e.kind === 'sell') goods[e.item] -= e.units;
  for (const kind of SELLS[t.type]) {
    if (!goods[kind]) memo.held[kind] = null;
    else if (memo.held[kind] == null) memo.held[kind] = v.day;
  }
  const out = [];
  const paid = payDebts(memo, cash, v, t.type);
  out.push(...paid.out);
  cash = paid.cash;
  if (v.day < N.nights) {
    if (buying) {
      const busy = new Set([...me.sitdowns.map(sd => sd.with), ...asked]);
      const o = orderGoods(tv, t, memo, cash - (cfg.sharp && robs(cfg) ? gunHold(v, cfg) : 0), msgs, ctx, busy);
      out.push(...o.out);
      msgs = o.msgs;
    }
    // R3-6, the canny cast: a buyer's ask is taken, and the seller says what it can sell there (takeAsks).
    if (cfg.canny) {
      const k = takeAsks(tv, t, memo, goods, msgs);
      out.push(...k.out);
      msgs = k.msgs;
    }
    const d = deliverGoods(tv, t, memo, goods, msgs);
    out.push(...d.out);
    msgs = d.msgs;
    if (t.type === 'gunrunner') {
      const g = sellGuns(tv, memo, goods, msgs, t);
      out.push(...g.out);
      msgs = g.msgs;
    }
    if (ctx.round === 1) {
      const a = noteAsks(v, memo, askBuyers(v, ctx, t, memo, goods, msgs).out.filter(e => !asked.has(e.to) && !skip.has(e.to)));
      out.push(...a);
      msgs -= a.length;
      memo.tradeAsked = { day: v.day, ids: a.map(e => e.to) };
    }
  }
  // A night its strategy has taken (a crew's job, a turtle's lying low) pays it no cash and uses none of its goods.
  const tonight = !cfg.every ? null : buying ? inGoodsTonight(v, ctx, t, memo) : {};
  out.push(...cityTrades(v, ctx, t, memo, goods, cash, tonight).filter(e => buying || e.kind !== 'shop'));
  // Hired muscle answers the rest: not a sit-down the trade or the strategy answered just now, nor one that a seller of
  // what its trade buys asked for (that's about goods, answered or not).
  if (MUSCLE.includes(cfg.type)) {
    const traded = new Set(out.filter(e => e.kind === 'answer').map(e => e.sitdown));
    const seller = BUYS[t.type] ? SELLER_OF[BUYS[t.type]] : null;
    const goodsTalk = sd => sd.asked === 'them' && v.board.agents.some(a => a.id === sd.with && a.trade === seller);
    const sitdowns = me.sitdowns.filter(sd => !traded.has(sd.id) && !answered.has(sd.id) && !goodsTalk(sd));
    out.push(...muscleReplies({ ...v, me: { ...me, sitdowns, messagesLeft: Math.max(0, msgs) } }, cfg));
  }
  return out;
}

// R10b (slime, 10-20: "Standing orders for trade"; GAME.md §17, §33: "Scripts for mechanics, the model for judgment"):
// a model seat's trade, which the game runs every day round from the seat's trade orders (agents/orders.mjs reads them
// off its memory and calls this). It is the canny trade bot of the seat's trade, as that bot's day runs the trade
// (dayTalk, then streetDay's trade: pay, orderGoods, takeAsks, deliverGoods, askBuyers), held to the orders,
// `lim` { buy: { item, units, max } | null, sell: { [item]: min }, pay: bool }:
// - it buys only under a buy order of its trade's item whose max covers the agents' price (STREET.unit), and orders at
//   most the order's units a day (memo.bought counts the units its orders named today);
// - it sells only the goods a sell order covers whose min is at or under its price, STREET.unit, the bots' price; a gun,
//   a lockpick, a warrant or a drug order is left to the seat (sellGuns is the bots' own);
// - it pays what it owes on agreed deals for goods (payOwed) only under a pay order, keeping back the rent due at dawn.
// Nothing else of the bot's day: no dress, rent, list, fence, city's shop or buyer, crime, crew or night play.
// `view` is the seat's own view; `keep(sd)` says which of its sit-downs the routine may act in (orders.mjs: not one the
// seat has spoken in itself). The others still count as busy, so it asks nobody it already sits with. Returns the
// errands, in the order the bot would send them.
export function tradeRoutine(view, ctx, cfg, memo, lim, keep = () => true) {
  if (view.over || !view.me || !BUYS[cfg.trade] && !SELLS[cfg.trade].length && cfg.trade !== 'gunrunner') return [];
  const sells = Object.keys(lim.sell || {}).filter(k => SELLS[cfg.trade].includes(k) && lim.sell[k] <= STREET.unit).sort();
  const t = { ...asTrade(cfg), sells };
  const others = view.me.sitdowns.filter(sd => !keep(sd));
  memo.paying = [];
  const talk = dayTalk(remembered({ ...view, me: { ...view.me, sitdowns: view.me.sitdowns.filter(keep) } }, memo), t, memo);
  const out = [...talk.errands];
  const v = unlisted(talk.view);
  const me = v.me;
  remember(v, memo);
  noteStreet(v, memo, t);
  let cash = me.cash;
  let msgs = me.messagesLeft;
  const goods = asDoses(me.goods);
  for (const kind of sells) {
    if (!goods[kind]) memo.held[kind] = null;
    else if (memo.held[kind] == null) memo.held[kind] = v.day;
  }
  if (lim.pay) {
    const rent = me.jail || me.evicted ? 0 : N.rent;
    const paid = payOwed(v, memo, cash - rent, d => !!d.goods);
    out.push(...paid.out);
    cash = paid.cash + rent;
  }
  if (v.day < N.nights) {
    const buy = lim.buy && lim.buy.item === BUYS[t.type] && lim.buy.max >= STREET.unit ? lim.buy : null;
    if (buy) {
      if (!memo.bought || memo.bought.day !== v.day) memo.bought = { day: v.day, units: 0 };
      const was = Object.fromEntries(Object.entries(memo.orders).map(([k, o]) => [k, o.units]));
      const busy = new Set([...me.sitdowns, ...others].map(sd => sd.with));
      const o = orderGoods(v, t, memo, cash, msgs, ctx, busy, Math.max(0, buy.units - memo.bought.units));
      out.push(...o.out);
      msgs = o.msgs;
      for (const [k, x] of Object.entries(memo.orders)) memo.bought.units += Math.max(0, x.units - (was[k] || 0));
    }
    if (t.canny) {
      const k = takeAsks(v, t, memo, goods, msgs);
      out.push(...k.out);
      msgs = k.msgs;
    }
    const d = deliverGoods(v, t, memo, goods, msgs);
    out.push(...d.out);
    msgs = d.msgs;
    if (ctx.round === 1) out.push(...noteAsks(v, memo, askBuyers({ ...v, me: { ...me, sitdowns: [...me.sitdowns, ...others] } }, ctx, t, memo, goods, msgs).out));
  }
  return out;
}

// A free night for a seat that works a trade: its trade's work as the trade's own bot plans it (streetPlan), which is a
// hustle only when it holds nothing to work with tonight.
function tradeNight(v, ctx, cfg, memo) {
  noteStreet(v, memo, cfg);
  const plan = streetPlan(v, ctx, asTrade(cfg), memo);
  if (plan.play.kind === 'deal') memo.dealt = { night: v.day, corner: plan.play.corner, sold: false };
  return { play: plan.play, reason: plan.reason };
}

// --- L2-6b: three habits, fixed in the cast where every seat trades ----------------------------------------------------
// L2-6's cast showed three habits no sensible player has. In the trades cast (`cfg.every`, which the runner sets) every
// bot now plays them from its own view; layer 2's and layer 1's casts keep their bots as they were.
// - Rent first (§10): a seat that can see its cash won't cover the rent due at dawn covers it first. By day it sells
//   the city's buyer just enough of what its trade sells and tonight's work won't use (coverRent); at night, a cook or
//   a build that would still leave it short gives way to a hustle (shortOfRent). A Smuggler always runs a drop (L2-6: it
//   can always work, so it never takes a hustle on a free night): it covers the rent by day only, and pays its way home
//   only when it can cover the next dawn's too (upkeep). A strategy that has taken the night keeps it: a crew's job, a
//   robber's hit, the turtle lying low once it holds a rare.
// - Corners (§9): Dealers short of a corner go by the street's pecking order (cornerByOrder), so two of them never tie
//   on one corner and then follow each other to the next.
// - Guns (§9): a Gunrunner keeps at most HABITS.unsold guns unsold and builds another only once one sells; it orders
//   only the parts for that, past it sells its parts and hustles (gunTarget, orderGoods, cityTrades), and it
//   builds its own gun rather than buy one (buildsItsOwn).
// Bot settings, not game numbers: `unsold`, the guns a Gunrunner keeps unsold, one: enough to fill the next order on
// the day it comes.
export const HABITS = { unsold: 1 };
// The work that pays in goods by dawn, not cash: a cook (doses) and a build (guns). A run does too, but a Smuggler
// covers the rent by day.
const IN_GOODS = ['cook', 'build'];
// A seat that works the Gunrunner trade builds its own gun: it buys none from another Gunrunner (gunErrands), so a
// bought gun never fills the stock it builds for, and a crew member keeps back no gun's price for one.
const buildsItsOwn = cfg => !!(cfg.every && cfg.trade === 'gunrunner');

// Tonight's flex (§4): what the rare-or-better pieces it wears pay a worker, doubled on Payday.
function flexTonight(v) {
  const pay = v.me.pieces.filter(p => p.worn).reduce((t, p) => t + (N.flex[p.tier] || 0), 0);
  return v.day === 7 && v.midseason === 'payday' ? 2 * pay : pay;
}

// Whether tonight's play leaves a seat with a home short of the rent due at dawn: work that pays in goods, and its cash
// with tonight's flex under the rent.
const shortOfRent = (v, play) => IN_GOODS.includes(play.kind) && !v.me.evicted && v.me.cash + flexTonight(v) < N.rent;

// Tonight's work as the bot plans it by day, before the rent check: the goods it uses when the night pays in goods (a
// run, a cook, a build) or pays nothing (wanted, it lies low); null when it pays cash (a deal, a patrol, a hustle).
function inGoodsTonight(v, ctx, cfg, memo) {
  if (v.me.wanted && cfg.type !== 'cop' && v.legal.some(l => l.kind === 'laylow')) return {};
  const work = cfg.type === 'cop' ? null : tradeWork(v, ctx, cfg, memo);
  const p = work && work.play;
  if (!p) return null;
  if (p.kind === 'run') return {};
  if (p.kind === 'cook') return { chems: p.batches * N.cook.chems };
  if (p.kind === 'build') return { parts: p.guns * N.build.guns + p.lockpicks * N.build.lockpicks + (p.warrants || 0) * N.build.warrants + (p.fake ? N.build.fakes : 0) };
  return null;
}

// The city's buyer pays the board's price for its next unit, and each unit sold lowers the price N.buyerFall percent,
// to the dollar (§9). The `i`th unit from now pays at least the board's price lowered that much i times, rounded down.
const unitPrice = (price, i) => Number((BigInt(price) * BigInt(100 - N.buyerFall) ** BigInt(i)) / 100n ** BigInt(i));

// Rent first, by day: in the day's last round, a seat with a home whose cash won't cover the rent due at dawn, on a
// night that won't pay it in cash, sells the city's buyer just enough of what its trade sells (a Smuggler's haul, a
// Chemist's doses: `kinds`) and tonight's work won't use (`tonight`), the best-paying kind first. Never what its trade
// works with (a Gunrunner's parts, a Dealer's doses): without them it has no trade. If they can't cover it, it sells
// none (and a cook gives way to a hustle). `done`: the sells it has made this turn already, which bring cash and move
// the buyer's prices. R4-3: a sale fills at the lock beside the day's other sales, so it reckons what each unit
// fetches on a busy day (busySale), and the rent keeps a margin.
function coverRent(v, kinds, goods, cash, tonight, done = []) {
  if (v.me.evicted) return [];
  const buyer = v.board.market.buyer;
  const sold = {};
  for (const e of done.filter(x => x.kind === 'sell')) {
    cash += busySale(buyer[e.item] || 0, sold[e.item] || 0, e.units);
    sold[e.item] = (sold[e.item] || 0) + e.units;
  }
  const short = N.rent - cash;
  if (short <= 0) return [];
  const spare = k => (goods[k] || 0) - (tonight[k] || 0);
  const out = [];
  let got = 0;
  for (const k of kinds.filter(x => spare(x) > 0 && buyer[x] > 0).sort((x, y) => buyer[y] - buyer[x] || (x < y ? -1 : 1))) {
    let units = 0;
    while (got < short && units < spare(k)) {
      got += busySale(buyer[k], (sold[k] || 0) + units, 1);
      units += 1;
    }
    out.push({ kind: 'sell', item: k, units });
    if (got >= short) break;
  }
  if (got < short) return [];
  for (const e of out) goods[e.item] -= e.units;
  return out;
}

// The street's pecking order: every Dealer can see on the board who holds each corner, which Dealers hold none they
// can work tonight, and their heat. In id order, each of those takes the best open corner left that it can work (a hot
// one first while its heat allows, then the lowest id). Every Dealer reads the same board, so no two pick one corner:
// none ties, and none follows a rival from corner to corner. A Dealer that lies low tonight (wanted, with a home) isn't
// in the order. This Dealer's corner, or null when none is left. In R3-6's canny cast (`canny`) a Dealer works a corner
// only while tonight's star keeps it under wanted (cannyWorks); a corner its holder won't work tonight is open too (one it
// can't work, or one of several it holds that it leaves for its best: cannyChoice); and a Dealer holding only a normal
// corner joins the order while it could work a hot one: it moves up to an open hot corner, and leaves its normal one open
// to the Dealers after it, or keeps its own.
function cornerByOrder(v, canny = false) {
  const works = (a, c) => (canny ? cannyWorks(v, a, c) : !c.hot || a.heat <= 3);
  const active = id => v.board.agents.some(a => a.id === id && !a.jailed && !a.boarded);
  const idle = c => canny && !!c.holder && active(c.holder) && cannyChoice(v, agentOf(v, c.holder)) !== c;
  let open = v.board.corners.filter(c => !c.holder || !active(c.holder) || idle(c)).sort((x, y) => Number(y.hot) - Number(x.hot));
  const holds = a => v.board.corners.filter(c => c.holder === a.id && works(a, c));
  const upgrades = a => canny && holds(a).length > 0 && !holds(a).some(c => c.hot) && a.heat + N.workHeat < N.wantedAt;
  const short = v.board.agents.filter(a => a.trade === 'dealer' && !a.jailed && !a.boarded && !(a.wanted && !a.evicted)
    && (!v.board.corners.some(c => c.holder === a.id && works(a, c)) || upgrades(a))).sort(byNum);
  for (const a of short) {
    const own = upgrades(a) ? holds(a)[0] : null;
    let c = open.find(x => works(a, x)) || null;
    if (own && !(c && c.hot)) c = null;
    if (a.id === v.me.id) return c;
    if (c) open = open.filter(x => x !== c);
    if (c && own) open = [...open, own].sort((x, y) => Number(y.hot) - Number(x.hot) || (x.corner < y.corner ? -1 : 1));
  }
  return null;
}

// --- L2-6d: spending and contests, in the cast where every seat trades -------------------------------------------------
// Once L2-6c's Cops won their collars, four more habits no sensible player has showed (GAME.md §3, §9, §13, §15). In
// the trades cast (`cfg.every`) every bot now plays these from its own view; layer 2's and layer 1's casts keep their
// bots as they were.
// - Bail before the ferry (§13, §15): in jail when the ferry leaves, an agent loses everything it owns. A jail that
//   would outlast the ferry is bailed as soon as the cash covers it: the agent's own, or the crew stash's for the rest
//   (ferryBail). Before, the bots bailed themselves out only through day 12.
// - Spend down (§3: the list closes after night 12; the game's goal is the PFP): as the list closes a seat keeps back
//   what it still needs (stillNeeds) and spends the rest on what it wants: on the list's last day an offer on every
//   trait it can afford, and that day and the next a listing at the fence under the list's price (spendDown). It wants a
//   piece for a slot it holds nothing in, or only something less rare. The buy-late saver's strategy already buys on the
//   list's last two nights: it spends down on the last one too, and never buys at the fence after it.
// - Its bail reserve: from the list's last two days to the ferry, a seat that a collar could keep off the boat (wanted,
//   or made wanted by tonight's work or crime) keeps back twice the bail at those stars, since an arrest fines half the
//   cash it holds (bailReserve), from the list and from the goods it orders. Then it can pay its way out in time. A
//   Dealer that can't keep it stays cool instead: no corner that would make it wanted, but a hustle (staysCool). R4-4:
//   under gap.ferryJail 'released' no collar keeps a seat off the boat, so it keeps none.
// - Corners (§9): the pecking order avoids every corner fight. A Dealer that can see it would win a hot corner contests
//   it (contestCorner).
// - The fence (§9): a spare piece goes where it pays: a swap that fills an empty slot on each side, else a sale
//   (fenceTrades), and a seat that wears nothing counts a second piece for a slot it already holds as spare (heldSpares).

// Bail before the ferry: on a day when its jail would still hold it at the ferry, its bail, out of its own cash or with
// the rest taken from the crew stash (never all of it, which would read as a rug, §12). R3-3: when jail ends at dawn on
// day 14 (GAP gap.ferryJail, 'released'), no jail holds it at the ferry, and a bail would buy only night 13.
function ferryBail(v) {
  const j = v.me.jail;
  if (N['gap.ferryJail'] === 'released' || v.day + j.nights <= N.nights) return [];
  if (v.me.cash >= j.bail) return [{ kind: 'bail', agent: v.me.id }];
  const st = v.me.crewStash;
  const short = j.bail - v.me.cash;
  const left = st && (st.cash > short || st.pieces.length > 0 || Object.keys(st.goods).length > 0);
  return st && st.cash >= short && left ? [{ kind: 'stash_take', cash: short }, { kind: 'bail', agent: v.me.id }] : [];
}

// The list's last day and the fence's, when a seat in the trades cast spends down.
const closing = (v, cfg) => !!cfg.every && v.day >= N.listLastNight && v.day < N.nights;
// The rent due at every dawn from now to the ferry, and the tab it settles at the dock (gap.rentTab).
const rentToEnd = v => Math.max(0, N.nights - v.day) * N.rent + (v.me.tab || 0);

// The stars tonight's plan adds (§13): a robber's crime, a crew's job, and a Dealer's sales (N.workHeat) on the corner it
// means to work, whether or not its doses have come yet, when it's hot or a patrol is likely there (gap.patrol: the
// Cops patrolled that district on the latest public night, or it's the docks with a crate in). A turtle that holds a rare
// lies low, a Chemist cooks at home only below 2 stars (tradeWork), so no batch makes it wanted, and the rest add none.
function heatTonight(v, cfg) {
  // R3-6, the canny cast: a crew's job is the night its leader called one (crewCalled), and a Dealer's corner the one its
  // heat lets it work (cornerFor).
  if (cfg.type === 'scout' || cfg.type === 'guess' || (cfg.type === 'crew' && (cfg.canny ? crewCalled(v, cfg) : jobDay(v.day)))) return 1;
  if (cfg.type === 'turtle' && holdsRare(v)) return 0;
  const trade = STREET_TYPES.includes(cfg.type) ? cfg.type : cfg.works ? cfg.trade : null;
  if (trade !== 'dealer' || v.me.wanted) return 0;
  const c = cornerFor(v, !!cfg.canny);
  const patrolled = c && ((v.board.crate && c.place === CRATE_AT) || Object.values(publicNight(v)).some(p => p.kind === 'patrol' && p.place === c.place));
  return c && (c.hot || patrolled) ? N.workHeat : 0;
}

// Bot settings, not game numbers: `reserve`, the bails a seat keeps back while a collar could keep it off the boat: two,
// since an arrest fines half the cash it holds (§13), so half the reserve still pays the bail.
export const CLOSE = { reserve: 2 };
// The bail reserve: CLOSE.reserve bails at the stars it would carry into a collar that keeps it off the boat (a collar on
// a night whose jail outlasts the ferry): tonight's, if it's wanted now, or tomorrow night's, if tonight's plan (`adds`)
// makes it wanted. R4-4: such a night follows gap.ferryJail (offBoatFrom). Under 'released' only night 14's arrests miss
// the boat, and nobody collars on night 14 (no work), so no collar keeps a seat off the boat and it keeps no reserve.
export function bailReserve(v, adds = 0) {
  const offBoat = n => n >= offBoatFrom() && n < N.nights;
  const heat = v.me.heat;
  const stars = v.me.wanted ? (offBoat(v.day) ? heat : 0) : offBoat(v.day + 1) ? heat + adds : 0;
  return stars >= N.wantedAt ? CLOSE.reserve * N.bailPerStar * Math.min(N.maxHeat, stars) : 0;
}
// A seat in the trades cast either keeps the bail reserve tonight's work needs, or, when it can't (its cash won't cover
// the reserve, the rent to the ferry and the doses it still has to buy), stays cool: it skips the work that would make
// it wanted (streetPlan) and keeps only what being wanted already needs.
function staysCool(v, cfg) {
  const r = bailReserve(v, heatTonight(v, cfg));
  const doses = Math.max(0, N.deal.held - (asDoses(v.me.goods).doses || 0)) * STREET.unit;
  return r > bailReserve(v, 0) && v.me.cash < r + rentToEnd(v) + doses;
}
const lateReserve = (v, cfg) => (!cfg.every ? 0 : staysCool(v, cfg) ? bailReserve(v, 0) : bailReserve(v, heatTonight(v, cfg)));

// What a seat still needs as the list closes: the rent to the ferry, a night's goods for its trade, what it owes for
// goods, a gun it ordered or promised cuts, the Cop seat's gun while it has none, and its bail reserve.
export function stillNeeds(v, ctx, cfg, memo = {}) {
  const trade = STREET_TYPES.includes(cfg.type) ? cfg.type : cfg.works ? cfg.trade : null;
  const goods = trade && BUYS[trade] ? onHand(BUYS[trade]) * STREET.unit : 0;
  const debts = owing(v, memo, d => streetDeal(trade)(d) || goodsDeal(['guns'])(d)) + ((memo.gunOrder && memo.gunOrder.price) || 0);
  const promised = v.me.promises.filter(p => p.by === v.me.id && p.what === 'pay' && p.night >= v.day - 1).reduce((t, p) => t + (p.cash || 0), 0);
  const gun = savesForGun(cfg, v) && !armed(v) ? gunPrice(v) : 0;
  return rentToEnd(v) + goods + debts + promised + gun + lateReserve(v, cfg) + (cfg.score ? warrantHold(v, memo) : 0);
}

// Each slot's best piece it holds, worn or not, counting what's on its way (its offers, listings it bought, and these
// errands' offers and buys), as a rank.
function heldRanks(v, done = []) {
  const best = {};
  const add = (slot, tier) => {
    if (slot && (best[slot] ?? -1) < RANK[tier]) best[slot] = RANK[tier];
  };
  const trait = id => listOf(v, id) || {};
  for (const p of v.me.pieces) add(p.slot, p.tier);
  for (const o of v.me.offers || []) add(trait(o.trait).slot, trait(o.trait).tier);
  for (const d of v.me.fence || []) if (d.kind === 'listing' && d.role === 'buyer') add(trait(d.trait).slot, trait(d.trait).tier);
  for (const e of done) {
    if (e.kind === 'offer') add(trait(e.trait).slot, trait(e.trait).tier);
    const bought = e.kind === 'fence_buy' && (v.board.fence || []).find(d => d.deal === e.deal);
    if (bought) add(bought.slot, bought.tier);
  }
  return best;
}

// Spend down: out of `budget`, the cash beyond what it still needs, every piece it wants and can afford: on the list's
// last day, in its first round, an offer on each such trait on the list; that day and the next, in any round, each such
// listing at the fence under the list's price (as fenceBargain judges one). The rarest first, then the cheapest; a slot
// once. `done`: the day's errands so far.
function spendDown(v, ctx, budget, done, cfg) {
  const listDay = v.day <= N.listLastNight;
  if (v.me.jail || budget <= 0 || (!listDay && cfg.type === 'buylate')) return [];
  const held = heldRanks(v, done);
  const offered = new Set([...(v.me.offers || []), ...done.filter(e => e.kind === 'offer')].map(o => o.trait));
  const own = new Set((v.me.fence || []).filter(d => d.kind === 'listing').map(d => d.deal));
  const cheap = d => listOf(v, d.trait) && d.price < FENCE.bargain * listOf(v, d.trait).price;
  const fence = (v.board.fence || []).filter(d => !own.has(d.deal) && !done.some(e => e.deal === d.deal) && cheap(d))
    .map(d => ({ key: `${d.trait} ${d.deal}`, slot: d.slot, tier: d.tier, price: d.price, deal: d.deal }));
  const list = listDay && ctx.round === 1 ? openToBuy(v, budget).filter(t => !offered.has(t.trait))
    .map(t => ({ key: `${t.trait} ~list`, slot: t.slot, tier: t.tier, price: t.price, t })) : [];
  const out = [];
  for (const c of [...fence, ...list].sort((x, y) => RANK[y.tier] - RANK[x.tier] || x.price - y.price || (x.key < y.key ? -1 : 1))) {
    if (c.price > budget || (held[c.slot] ?? -1) >= RANK[c.tier]) continue;
    const e = c.deal ? { kind: 'fence_buy', deal: c.deal } : offerFor(ctx.rng, c.t, budget);
    out.push(e);
    budget -= c.deal ? c.price : e.amount;
    held[c.slot] = RANK[c.tier];
  }
  return out;
}

// A corner another agent holds, out and about: dealing there is a contest.
const contested = (v, c) => !!c.holder && c.holder !== v.me.id && v.board.agents.some(a => a.id === c.holder && !a.jailed && !a.boarded);

// A Dealer's corner in the trades cast: a hot one it holds and can work; else an open hot one from the pecking order;
// else a hot one it can see it would win (contestCorner); else the corner it holds, or the pecking order's. In R3-6's
// canny cast (`canny`) only the corners tonight's star keeps it under wanted on (cannyWorks).
function cornerFor(v, canny = false) {
  const works = c => (canny ? cannyWorks(v, v.me, c) : !c.hot || v.me.heat <= 3);
  const held = v.board.corners.filter(c => c.holder === v.me.id && works(c));
  const mine = held.find(c => c.hot) || held[0] || null;
  if (mine && mine.hot) return mine;
  const open = mine && !canny ? null : cornerByOrder(v, canny);
  if (open && open.hot) return open;
  return contestCorner(v, canny) || mine || open;
}

// Public strength (§8): 1, +1 for a gun its holdings record 24 hours ago shows, +1 walking wired (TEMP), and, attacking,
// +1 for brass knuckles its fit on the board shows.
function seenStrength(v, a, attacking) {
  const h = publicHoldings(v, a.id);
  const knuckles = attacking && (a.fit || []).some(p => (listOf(v, p.trait) || {}).ability === 'knuckles');
  return 1 + (h && h.goods && h.goods.guns ? 1 : 0) + (a.walk === 'wired' ? 1 : 0) + (knuckles ? 1 : 0);
}

// Corners, contested: a hot corner whose holder will deal there tonight (it's out and about and not wanted, so it won't
// lie low) and whose defence this Dealer beats. The defence, from public facts: the holder's strength and its backers'
// on its latest public night, the city cops (+1 in a heavy district; +2 against a wanted challenger outside a lawless
// one, §8) and the patrols that stood in that district on the latest public night, each with its gun. This Dealer counts
// its own strength exactly: 1, +1 for its gun, +1 for its knuckles worn, +1 on TEMP. Challengers (Dealers that hold no hot
// corner they can work, not wanted, cool enough to work one) go in id order, each to the weakest-held corner it would win
// that no lower id has claimed, as every Dealer reads the others off the board; so two never fight each other for one.
// Its corner, or null.
export function contestCorner(v, canny = false) {
  const me = v.me;
  const active = a => !!a && !a.jailed && !a.boarded;
  const agent = Object.fromEntries(v.board.agents.map(a => [a.id, a]));
  const plays = publicNight(v);
  const tonight = v.board.tonight || {};
  const defenceOf = (c, wanted) => {
    const lv = tonight[c.place] || 'normal';
    const backers = Object.values(plays).filter(p => p.kind === 'back' && p.target === c.holder && active(agent[p.agent]));
    const patrols = Object.values(plays).filter(p => p.kind === 'patrol' && p.place === c.place && active(agent[p.agent]));
    return seenStrength(v, agent[c.holder], false) + [...backers, ...patrols].reduce((t, p) => t + seenStrength(v, agent[p.agent], false), 0)
      + (lv === 'heavy' ? N.copsHeavy : 0) + (wanted && lv !== 'lawless' ? N.copsWanted : 0);
  };
  const own = 1 + (armed(v) ? 1 : 0) + (me.pieces.some(p => p.worn && p.ability === 'knuckles') ? 1 : 0) + (me.high.includes('temp') ? 1 : 0);
  // R3-6, the canny cast (`canny`): a holder deals on its hot corner only while its star keeps it under wanted, and a
  // challenger contests one only then too (cannyWorks).
  const held = v.board.corners.filter(c => c.hot && c.holder && active(agent[c.holder]) && !agent[c.holder].wanted && agent[c.holder].trade === 'dealer'
    && (!canny || cannyChoice(v, agent[c.holder]) === c));
  const challengers = v.board.agents.filter(a => a.trade === 'dealer' && active(a) && !a.wanted && a.heat <= 3
    && !v.board.corners.some(c => c.hot && c.holder === a.id)).sort(byNum);
  const claimed = new Set();
  for (const a of challengers) {
    const power = a.id === me.id ? own : seenStrength(v, a, true);
    const c = held.filter(x => x.holder !== a.id && !claimed.has(x.corner) && (!canny || cannyWorks(v, a, x))).map(x => ({ x, d: defenceOf(x, a.wanted) }))
      .filter(o => power > o.d).sort((p, q) => p.d - q.d || (p.x.corner < q.x.corner ? -1 : 1))[0];
    if (a.id === me.id) return c ? c.x : null;
    if (c) claimed.add(c.x.corner);
  }
  return null;
}

// The fence in the trades cast: a spare piece goes where it pays. A swap comes first, one that fills an empty slot on
// each side (swapFor): it's offered once the piece is on its own public holdings record, where the other side can see
// what it gets, one swap a day. When the other side can see the same swap (the piece is on that record, under a fit on
// the board that wears one at least as rare in its slot), the lower id offers it and the other waits, so the two never
// put up their halves for each other at once. A spare with no swap in sight goes up for sale at once, and so does every
// spare on the fence's last day.
function fenceTrades(v, ctx, spare) {
  if (v.me.jail || ctx.round !== 1 || v.day >= N.nights) return [];
  const shown = new Set(((publicHoldings(v, v.me.id) || {}).pieces || []).map(p => p.copy));
  const hooded = v.me.pieces.some(x => x.worn && x.ability === 'hoodie');
  const seen = p => shown.has(p.copy) && !hooded && v.me.pieces.some(x => x.worn && x.slot === p.slot && RANK[x.tier] >= RANK[p.tier]);
  const lastDay = v.day >= N.nights - 1;
  const out = [];
  for (const p of spare.slice().sort(rarestFirst)) {
    const s = lastDay ? null : swapFor(v, p, out.filter(e => e.kind === 'fence_swap').map(e => e.get.pieces[0]));
    if (!s) out.push(listing(v, p));
    else if (shown.has(p.copy) && !(seen(p) && byNum({ id: s.to }, v.me) < 0) && !out.some(e => e.kind === 'fence_swap')) {
      out.push({ kind: 'fence_swap', to: s.to, give: { pieces: [p.copy] }, get: { pieces: [s.copy] } });
    }
  }
  return out;
}

// A swap that fills an empty slot on each side, from public facts: another agent, out and about and not hooded, that
// holds nothing in `give`'s slot (its fit on the board and its public holdings record), and whose record shows an
// unworn piece of the same tier, not up at the fence, in a slot this seat holds nothing in, one it won't wear, since its
// fit wears another at least as rare there. The first such agent by id, or null. `asked`: pieces already asked for today.
function swapFor(v, give, asked = []) {
  const mine = new Set(v.me.pieces.map(p => p.slot));
  // A piece whose trait is up at the fence is likely that very piece, listed since its record.
  const onSale = new Set((v.board.fence || []).map(d => d.trait));
  for (const a of v.board.agents.slice().sort(byNum)) {
    const h = a.id !== v.me.id && !a.jailed && !a.boarded && a.fit ? publicHoldings(v, a.id) : null;
    if (!h) continue;
    const slots = new Set([...a.fit.map(p => p.slot), ...h.pieces.map(q => slotOf(v, q.trait))]);
    if (slots.has(give.slot)) continue;
    const q = h.pieces.find(x => {
      const slot = slotOf(v, x.trait);
      const keeps = a.fit.find(p => p.slot === slot && p.copy !== x.copy);
      return x.tier === give.tier && !asked.includes(x.copy) && !onSale.has(x.trait) && slot && !mine.has(slot) && keeps && RANK[keeps.tier] >= RANK[x.tier];
    });
    if (q) return { to: a.id, copy: q.copy };
  }
  return null;
}

// A seat's spare pieces in the trades cast: sparePieces' (a second piece for a slot it wears one at least as rare in,
// or a take that isn't kit), and a second piece, no rarer, for a slot it holds a better one in without wearing either
// (the buy-late saver and the turtle wear nothing, robbers and crews only their kit). Each slot keeps the piece it
// wears there, else its rarest, then what it last sold for, then the lower copy.
export function heldSpares(v, fit, taken = [], used = new Set()) {
  const wearing = new Set(Object.values(fit || {}));
  const better = (x, y) => RANK[x.tier] - RANK[y.tier] || (x.last || 0) - (y.last || 0) || (x.copy < y.copy ? 1 : -1);
  const keep = {};
  for (const p of v.me.pieces) {
    if (used.has(p.copy)) continue;
    const k = keep[p.slot];
    if (!k || (wearing.has(p.copy) && !wearing.has(k.copy)) || (!wearing.has(k.copy) && better(p, k) > 0)) keep[p.slot] = p;
  }
  const base = sparePieces(v, fit, taken, used);
  const extra = v.me.pieces.filter(p => !wearing.has(p.copy) && !used.has(p.copy) && !base.includes(p) && keep[p.slot] && keep[p.slot] !== p
    && RANK[keep[p.slot].tier] >= RANK[p.tier]);
  return [...base, ...extra];
}

// --- L3-5a: the drugs in play (GAME.md §11) ----------------------------------------------------------------------------
// In the layer3 cast (`cfg.drugs`) every seat plays the trades cast's bot and habits and, each from its own view, these;
// the trades, layer 2's and layer 1's casts keep their bots as they were.
// - Chemists cook all six drugs to the demand they can see: an order for a drug they don't hold is one they cook that
//   night, a batch of it, unless another Chemist's public holdings show it, and TEMP otherwise, for the Dealers
//   (cookDrug). A HALLU cook writes two lies: that the Chemist itself has no cash, and that its richest rival Chemist
//   has more than anyone (halluLies). They sell in typed sit-downs: the buyer asks, the Chemist answers, the buyer
//   orders, and the Chemist hands over what it holds or says it has none (sellDrugs); the next morning it asks a buyer
//   it couldn't serve, who answers and orders in one turn (buyDrugs). The buyer pays on arrival. A seat buys ahead the
//   doses it will need (drugWants), from the Chemist it bought from last, else one whose public holdings show the drug,
//   never again from one that conned it, and keeps the TEMP it means to take out of its own trade's sales (keepDose).
// - One seat that works the Chemist trade, by the seed, sells SUDO as TEMP to a buyer that doesn't deal doses: one that
//   ordered TEMP from it, or that it saw walk wired (noteWired). It writes that buyer's play: back the Chemist tonight,
//   a bodyguard wherever it works (sudoWrites).
// - Takers, each for its reason (takeDrugs):
//   - TEMP: a robber whose own strength can't win a fight tonight, when +1 finds it one worth the dose and the night
//     the crash costs (tempPlan, and it plays that hit); and the seed's habit robber, whenever it holds one. A Dealer
//     takes none: tomorrow's crash costs it a night on its corner, more than a contest wins;
//   - TRUTH, locking `back` when that's one of tonight's legal plays: a crew member on a job day, its leader (the snake
//     not on a night it means to turn), and hired muscle, whoever hired it (truthPlay);
//   - HALLU: a broke robber (it can't afford the cheapest piece on the list: brokeNow), strong enough to act on a lead:
//     it robs tonight anyway, counting the leads as what a break-in on their agents would bring (leadValues);
//   - FIREWALL: a seat that holds an epic or a grail, on each of the last three days, with its shades off so the street
//     can see it's guarded (firewallDay);
//   - CLEAR: a wanted robber before a hit where cops could come (copsCouldCome), since an arrest would seize nothing. It
//     forgets the day, as its view does (forgetDay). It doesn't count on the stars it keeps through jail.
// - Nobody sends a sit-down errand, a hand-over or a pay to a seat the board shows guarded, and a seat on FIREWALL sends
//   no sit-down errand (reachable, walled).
// Bot settings, not game numbers: `price`, a dose between agents (STREET.unit, as for every good); `broke`, the cash a
// robber wants before it robs (its night() reads it; HALLU's gambler is under it once the list has closed);
// `firewall`, the rank of a piece worth FIREWALL (an epic), and `from`, the first of the last three days; `ahead`, the
// days before a job (or before `from`) a seat buys the dose for it; `keep`, the stars at which a robber keeps a CLEAR
// (once a crime has put a star on it); `habit`, the TEMP the habit robber keeps on hand.
export const DOSES = { price: STREET.unit, broke: 30, firewall: RANK.epic, from: N.nights - 2, ahead: 2, keep: 1, habit: 3 };
// The plays that attack: a robber's fight.
const ATTACKS = ['hit', 'breakin', 'grab'];
const robs = cfg => cfg.type === 'scout' || cfg.type === 'guess';
// A seat that works the Dealer trade holds TEMP as its stock; one that works the Chemist trade sells the drugs.
const dealsDoses = cfg => cfg.trade === 'dealer' && (cfg.type === 'dealer' || !!cfg.works);
const sellsDrugs = cfg => cfg.trade === 'chemist' && (cfg.type === 'chemist' || !!cfg.works);
const holdsDose = (v, d) => v.me.goods[d] || 0;
// SUDO can't keep anyone off the ferry: the last day a write goes through, the day before the first night whose arrest
// still holds its taker when the ferry leaves (GAME.md §11, GAP gap.sudo; R4-4: it follows gap.ferryJail).
const lastWrite = () => offBoatFrom() - 1;
// A seat the board shows guarded (FIREWALL): nothing reaches it until dawn (GAP gap.firewall).
const guarded = (v, id) => v.board.agents.some(a => a.id === id && a.walk === 'guarded');
// A robber's own strength tonight (§8): 1, +1 for the brass knuckles it wears, +1 for its gun.
const ownPower = v => 1 + (v.me.pieces.some(p => p.worn && p.ability === 'knuckles') ? 1 : 0) + (armed(v) ? 1 : 0);
// It holds an epic or a grail: its own, or in the crew stash it keeps at home.
const holdsBig = v => [...v.me.pieces, ...(v.me.crewStash && v.me.crewStash.keeper === v.me.id ? v.me.crewStash.pieces : [])].some(p => RANK[p.tier] >= DOSES.firewall);
// Broke, HALLU's gambler: it can't afford the cheapest piece open on the list, what the season is for; once the list has
// closed, it's under DOSES.broke.
const brokeNow = v => {
  const open = openToBuy(v, Infinity);
  return v.me.cash < (open.length ? Math.min(...open.map(t => t.price)) : DOSES.broke);
};
// A crew seat's crewmates on a job day: their sit-downs are the job's (crewDay), so the drugs leave them alone.
// In R3-6's canny cast a crew's sit-downs are its jobs' on any day (crewCalled), so the drugs leave them alone always.
const jobMates = (v, cfg) => new Set(cfg.type === 'crew' && (cfg.canny || jobDay(v.day)) ? cfg.mates || [] : []);
// The view with TEMP taken today, as its own view would show it.
const onTemp = v => ({ ...v, me: { ...v.me, high: [...v.me.high, 'temp'] } });
// The TEMP a seat keeps out of its own trade today: the habit robber's, and that of a robber its own strength can't win
// with, until it takes one.
const kept = (v, cfg) => ((cfg.habit === 'temp' || (robs(cfg) && ownPower(v) < 2)) && !v.me.high.includes('temp') && holdsDose(v, 'temp') ? 1 : 0);
// Its view with that dose spoken for, as its trade sees it.
function keepDose(v, cfg) {
  const k = kept(v, cfg);
  if (!k) return v;
  const goods = { ...v.me.goods, temp: v.me.goods.temp - k };
  if (!goods.temp) delete goods.temp;
  return { ...v, me: { ...v.me, goods } };
}

// What a bot remembers at the start of each day, so that CLEAR can wipe the day from its memory as from its view.
function dawnMemo(memo, day) {
  if (memo.dawn && memo.dawn.day === day) return;
  const { dawn, ...rest } = memo;
  memo.dawn = { day, memo: JSON.parse(JSON.stringify(rest)) };
}
// CLEAR (§11: "everything your agent learned in the last day"): the bot's memory goes back to what it was at the start
// of the day, before last night's private record and today's reached it. Its view forgets the same (GAP gap.clear).
export function forgetDay(memo) {
  const dawn = memo.dawn;
  if (!dawn) return;
  for (const k of Object.keys(memo)) delete memo[k];
  Object.assign(memo, JSON.parse(JSON.stringify(dawn.memo)), { dawn });
}

// The doses a seat wants on hand now, by drug, beyond what it holds: the habit robber's TEMP; a robber's TEMP when its
// own strength can't win a fight (one that works the Dealer trade has its own), its CLEAR once it's a crime from
// wanted, and, broke, a HALLU when it's strong enough to act on a lead; a crew member's TRUTH for a job within
// DOSES.ahead days; TRUTH for muscle that has been hired before; and FIREWALL for each of the last three days still
// to come, for a seat that holds an epic or a grail.
export function drugWants(v, cfg, memo = {}) {
  const me = v.me;
  const want = {};
  if (me.jail || v.day >= N.nights) return want;
  if (cfg.habit === 'temp') want.temp = DOSES.habit;
  if (robs(cfg)) {
    if (ownPower(v) < 2 && !dealsDoses(cfg)) want.temp = Math.max(want.temp || 0, 1);
    if (me.heat >= DOSES.keep) want.clear = 1;
    if (brokeNow(v) && ownPower(v) + (holdsDose(v, 'temp') ? 1 : 0) >= 2) want.hallu = 1;
  }
  const jobs = Array.from({ length: DOSES.ahead + 1 }, (_, k) => v.day + k).filter(d => jobDay(d) && (d > v.day || !me.high.includes('truth')));
  // R3-6, the canny cast: a crew's job can come any night its leader calls one (cannyCall), so a member keeps a TRUTH on
  // hand while a job night is left.
  if (cfg.type === 'crew' && cfg.role === 'member' && (cfg.canny ? v.day < N.nights - 1 : jobs.length)) want.truth = 1;
  if (MUSCLE.includes(cfg.type) && memo.hired) want.truth = 1;
  if (holdsBig(v) && v.day >= DOSES.from - DOSES.ahead) want.firewall = N.nights - Math.max(v.day, DOSES.from) + 1 - (me.high.includes('firewall') ? 1 : 0);
  for (const d of Object.keys(want)) {
    want[d] -= holdsDose(v, d);
    if (want[d] < 1) delete want[d];
  }
  return want;
}

// What it learns from its own record: a delivery of what it ordered (the order is done), and a take its record now
// shows was SUDO (once the night has settled): whoever wrote it conned it, and it never buys from them again.
function noteDrugs(v, memo) {
  memo.conned ||= {};
  let seen = memo.drugSeen == null ? -1 : memo.drugSeen;
  for (const e of v.events) {
    if (e.n <= seen) continue;
    const o = memo.drugBuy;
    // R5-deals: the order is done once its doses come; what it owes for them is on the deal record (buyDrugs).
    if (o && !o.got && e.type === 'give' && e.to === v.me.id && e.from === o.with && e.goods && Object.keys(o.goods).some(d => e.goods[d])) o.got = true;
  }
  for (const e of v.events) if (e.n > seen) seen = e.n;
  memo.drugSeen = seen;
  for (const e of v.events) if (e.type === 'take' && e.agent === v.me.id && e.writer) memo.conned[e.writer] = true;
}

// The buyer's side. It pays what it owes on arrival (never to a guarded seat), and orders, at most once a day, everything
// it wants (drugWants) that its cash covers, in §11's order, keeping back the rent due at dawn; the habit's TEMP and a
// broke robber's HALLU (the gamble) don't keep it back. A Chemist that asked it for a sit-down gets the order there, in
// one turn (the answer and the order); else it asks one Chemist in the day's first round (chemistFor) and orders once the
// sit-down opens. `cash`, `msgs`: what the day's errands so far (`done`) leave it.
function buyDrugs(v, ctx, cfg, memo, cash, msgs, done) {
  const me = v.me;
  const out = [];
  noteDrugs(v, memo);
  // R5-deals: what it owes for doses, as the deal record has it.
  const paid = payOwed(v, memo, cash, goodsDeal(DRUGS));
  out.push(...paid.out);
  cash = paid.cash;
  // R5-deals: an order lives as long as its sit-down does (no longer with the day), until its doses come or the
  // Chemist says it has none.
  const b = memo.drugBuy;
  const at = b && !b.got ? orderSd(v, b) : null;
  const o = at && !saidNone(at, b.with) ? b : null;
  if (me.jail) return out;
  if (o && o.said) {
    // R9d: its order said, it answers the Chemist (answerSeller): doses of one drug it ordered, at no more than
    // DOSES.price, it takes in that order's place; words with no terms get the order again, once.
    const e = at.state === 'open' && msgs >= 1 ? answerSeller(v, memo, at, DOSES.price, o.goods, countOf(o.goods) * DOSES.price) : null;
    if (e) {
      out.push(e);
      o.goods = { ...e.terms.goods };
    }
    return out;
  }
  const offer = (sd, goods) => ({ kind: 'say', sitdown: sd.id, say: 'offer', terms: { what: BUY, goods, cash: Object.values(goods).reduce((t, n) => t + n, 0) * DOSES.price } });
  if (o) {
    if (at.state === 'open' && msgs >= 1) {
      out.push(offer(at, o.goods));
      Object.assign(o, { said: true, sitdown: at.id });
    }
    return out;
  }
  const want = drugWants(v, cfg, memo);
  const goods = {};
  let budget = cash;
  for (const d of DRUGS.filter(x => want[x])) {
    const n = Math.min(want[d], Math.floor((budget - (d === 'hallu' || cfg.habit === d ? 0 : N.rent)) / DOSES.price));
    if (n < 1) continue;
    goods[d] = n;
    budget -= n * DOSES.price;
  }
  if (!Object.keys(goods).length) return out;
  const answered = new Set(done.filter(e => e.kind === 'answer').map(e => e.sitdown));
  const chemist = id => v.board.agents.some(a => a.id === id && a.trade === 'chemist');
  for (const sd of me.sitdowns) {
    if (sd.asked !== 'them' || !chemist(sd.with) || guarded(v, sd.with) || memo.conned[sd.with] || sd.said.some(m => m.from === me.id)
      || jobMates(v, cfg).has(sd.with)) continue;
    const need = sd.state === 'asked' && !answered.has(sd.id) ? 2 : sd.state === 'open' ? 1 : 0;
    if (!need || msgs < need) continue;
    if (need === 2) out.push({ kind: 'answer', sitdown: sd.id, accept: true });
    out.push(offer(sd, goods));
    memo.drugBuy = { day: v.day, with: sd.with, goods, said: true, sitdown: sd.id };
    memo.drugFrom = sd.with;
    return out;
  }
  if (ctx.round !== 1 || msgs < 2) return out;
  const c = chemistFor(v, ctx, memo, Object.keys(goods), new Set([...done.filter(e => e.kind === 'ask').map(e => e.to), ...jobMates(v, cfg)]));
  if (!c) return out;
  out.push({ kind: 'ask', to: c.id, line: buyLine('doses', countOf(goods), DOSES.price, false) });
  memo.drugBuy = { day: v.day, with: c.id, goods };
  memo.drugFrom = c.id;
  return out;
}

// The Chemist to ask: free, not guarded, no sit-down with it today and it never conned this seat; the one it bought
// from last, else one whose public holdings show what it wants, else one by its own draw. `asked`: the agents the day's
// errands so far ask (one sit-down a pair a day, §14), and a crew seat's crewmates on a job day.
function chemistFor(v, ctx, memo, kinds, asked = new Set()) {
  const me = v.me;
  const ok = a => a.trade === 'chemist' && a.id !== me.id && !a.jailed && !a.boarded && !guarded(v, a.id)
    && !me.sitdowns.some(sd => sd.with === a.id) && !asked.has(a.id) && !memo.conned[a.id];
  const list = v.board.agents.filter(ok).sort(byNum);
  if (!list.length) return null;
  const last = list.find(a => a.id === memo.drugFrom);
  if (last) return last;
  const stocked = list.filter(a => {
    const h = publicHoldings(v, a.id);
    return h && kinds.some(d => h.goods[d]);
  });
  return pick(rng(ctx.seed, 'chemist', me.id, v.day), stocked.length ? stocked : list);
}

// What it holds once these errands go through: goods handed over, sold, put in the crew stash or taken.
function goodsAfter(v, errands) {
  const g = { ...v.me.goods };
  const less = (k, n) => {
    g[k] = (g[k] || 0) - n;
  };
  for (const e of errands) {
    if ((e.kind === 'give' || e.kind === 'stash_put') && e.goods) for (const [k, n] of Object.entries(e.goods)) less(k, n);
    if (e.kind === 'sell') less(e.item === 'doses' ? e.drug || 'temp' : e.item, e.units);
    if (e.kind === 'take') less(e.drug, 1);
  }
  return g;
}

// A drug order (the Chemist's, not its trade's: deliverGoods leaves it here): from a buyer that doesn't deal doses, or
// for a drug besides TEMP.
const drugOrder = (v, id, goods) => (v.board.agents.find(a => a.id === id) || {}).trade !== 'dealer' || Object.keys(goods).some(k => k !== 'temp');

// The Chemist's side (a seat that works the Chemist trade). It takes every sit-down a buyer asks for (not a Smuggler's,
// which is about chems: orderGoods answers it), and hands each drug order over, in a sit-down either side asked for, as
// far as its doses go; to one it can't fill at all it says so (an answer with no goods). What it couldn't hand over is
// the demand it cooks for (cookDrug), and the next morning it asks that buyer for a sit-down again if it now holds some.
// The SUDO seller hands over SUDO for TEMP to a buyer that doesn't deal doses, while a write could still go through, and
// notes every such buyer as a mark. `done`: the day's errands so far. R5-deals: once a buyer it asked takes the ask
// with no order, it states what it sells there as typed terms, once (the doses that buyer asked it for and it couldn't
// hand over, as far as it holds them now, at DOSES.price), or says it has none; and a buyer that paid against the deal
// before any order gets the doses its cash covers.
function sellDrugs(v, ctx, cfg, memo, done) {
  const me = v.me;
  const out = [];
  memo.demand = (memo.demand || []).filter(x => v.day - x.day <= 1);
  memo.marks = (memo.marks || []).filter(x => v.day - x.day <= 1);
  memo.served = Object.fromEntries(Object.entries(memo.served || {}).filter(([id]) => me.sitdowns.some(sd => sd.id === id)));
  memo.stated ||= {};
  memo.pitched = Object.fromEntries(Object.entries(memo.pitched || {}).filter(([id, x]) => x.day === v.day || me.sitdowns.some(sd => sd.with === id)));
  let msgs = me.messagesLeft - done.filter(e => TALK.includes(e.kind)).length;
  const answered = new Set(done.filter(e => e.kind === 'answer').map(e => e.sitdown));
  const goods = goodsAfter(v, done);
  goods.temp = (goods.temp || 0) - kept(v, cfg);
  const tradeOf = id => (v.board.agents.find(a => a.id === id) || {}).trade;
  const con = id => !!cfg.sudo && !me.jail && v.day <= lastWrite() && tradeOf(id) !== 'dealer';
  if (cfg.sudo) noteWired(v, memo);
  if (ctx.round === 1 && !me.jail && v.day < N.nights) {
    const asked = new Set([...done.filter(e => e.kind === 'ask').map(e => e.to), ...jobMates(v, cfg)]);
    const waiting = [...new Set(memo.demand.filter(x => x.day === v.day - 1 && (goods[x.drug] || (x.drug === 'temp' && con(x.by) && goods.sudo))).map(x => x.by))].sort();
    // The SUDO seller, holding SUDO, also asks the TEMP users it has seen walk wired (marks: memo.wired).
    if (goods.sudo > 0) waiting.push(...Object.keys(memo.wired).filter(id => con(id) && !waiting.includes(id)).sort());
    for (const id of waiting) {
      const a = v.board.agents.find(x => x.id === id);
      if (!a || a.jailed || a.boarded || guarded(v, id) || asked.has(id) || me.sitdowns.some(sd => sd.with === id) || msgs < 1) continue;
      // What it asks that buyer about: the doses the buyer asked it for yesterday, or (a mark) a TEMP.
      const wanted = {};
      for (const x of memo.demand.filter(y => y.by === id && y.day === v.day - 1)) wanted[x.drug] = (wanted[x.drug] || 0) + (x.units || 1);
      memo.pitched[id] = { day: v.day, goods: Object.keys(wanted).length ? wanted : { temp: 1 } };
      out.push({ kind: 'ask', to: id, line: sellLine('doses', countOf(memo.pitched[id].goods), DOSES.price) });
      msgs -= 1;
    }
  }
  // The doses it hands over for `want` (drug: n), as far as it holds them; to a mark, SUDO for TEMP first.
  const handOut = (sd, want) => {
    const give = {};
    for (const [d, n] of Object.entries(want)) {
      if (d === 'temp' && con(sd.with)) memo.marks.push({ by: sd.with, day: v.day });
      const sudo = d === 'temp' && con(sd.with) ? Math.min(n, goods.sudo || 0) : 0;
      const k = Math.min(n - sudo, goods[d] || 0);
      if (sudo) give.sudo = sudo;
      if (k) give[d] = k;
      goods.sudo = (goods.sudo || 0) - sudo;
      goods[d] = (goods[d] || 0) - k;
      if (sudo + k < n) memo.demand.push({ drug: d, day: v.day, by: sd.with, units: n - sudo - k });
    }
    return give;
  };
  for (const sd of me.sitdowns) {
    if (answered.has(sd.id) || guarded(v, sd.with)) continue;
    if (sd.state === 'asked') {
      if (sd.asked === 'them' && tradeOf(sd.with) !== 'smuggler' && msgs >= 1) {
        out.push({ kind: 'answer', sitdown: sd.id, accept: true });
        msgs -= 1;
      }
      continue;
    }
    if (sd.state !== 'open' || memo.served[sd.id] || (memo.delivered && memo.delivered[sd.id])) continue;
    // R5-deals: the buyer's latest order there, as its latest offer stands.
    const order = sd.said.filter(m => m.from === sd.with && m.say === 'offer' && isBuy(m.terms) && m.terms.goods
      && Object.keys(m.terms.goods).every(k => DRUGS.includes(k)) && drugOrder(v, sd.with, m.terms.goods)).at(-1);
    if (!order) {
      const due = paidFor(dealIn(v, sd));
      if (due && Object.keys(due).every(k => DRUGS.includes(k))) {
        memo.served[sd.id] = true;
        const give = handOut(sd, due);
        if (Object.keys(give).length) out.push({ kind: 'give', to: sd.with, goods: give, ...naming(v, sd.with, sd.id) });
        continue;
      }
      const pitch = memo.pitched[sd.with];
      if (sd.asked !== 'me' || !pitch || pitch.day !== sd.day || memo.stated[sd.id] || msgs < 1) continue;
      memo.stated[sd.id] = v.day;
      const can = Object.fromEntries(Object.entries(pitch.goods).map(([d, n]) => [d, Math.min(n, (goods[d] || 0) + (d === 'temp' && con(sd.with) ? goods.sudo || 0 : 0))]).filter(([, n]) => n > 0));
      if (!Object.keys(can).length) memo.served[sd.id] = true;
      out.push(Object.keys(can).length ? sellOffer(sd, can, DOSES.price) : { kind: 'say', sitdown: sd.id, say: 'answer', terms: { what: BUY, cash: 0 } });
      msgs -= 1;
      continue;
    }
    // R5-deals (the review): never under its own quote, DOSES.price a dose; it states its quote again, once.
    const units = Object.values(order.terms.goods).reduce((t, n) => t + n, 0);
    if (!((order.terms.cash || 0) >= units * DOSES.price)) {
      memo.countered ||= {};
      const can = Object.fromEntries(Object.entries(order.terms.goods).map(([d, n]) => [d, Math.min(n, (goods[d] || 0) + (d === 'temp' && con(sd.with) ? goods.sudo || 0 : 0))]).filter(([, n]) => n > 0));
      if (!memo.countered[sd.id] && Object.keys(can).length && msgs >= 1) {
        out.push(sellOffer(sd, can, DOSES.price));
        memo.countered[sd.id] = true;
        msgs -= 1;
      }
      continue;
    }
    memo.served[sd.id] = true;
    const give = handOut(sd, order.terms.goods);
    if (Object.keys(give).length) out.push({ kind: 'give', to: sd.with, goods: give, ...naming(v, sd.with, sd.id) });
    else if (msgs >= 1) {
      out.push({ kind: 'say', sitdown: sd.id, say: 'answer', terms: { what: BUY, cash: 0 } });
      msgs -= 1;
    }
  }
  return out;
}

// The SUDO seller's marks it can see: agents walking wired on the board (TEMP, as far as anyone can tell) that don't
// deal doses, remembered for two days (`memo.wired`: id -> the day it last saw them).
function noteWired(v, memo) {
  memo.wired = Object.fromEntries(Object.entries(memo.wired || {}).filter(([, d]) => v.day - d <= 1));
  for (const a of v.board.agents) if (a.walk === 'wired' && a.id !== v.me.id && a.trade !== 'dealer') memo.wired[a.id] = v.day;
}

// Tonight's cook, by the demand a Chemist saw in the last two days: the SUDO seller cooks SUDO when it holds none and a
// buyer it can con ordered TEMP or walked wired (early enough to sell it while a write goes through); else the drug
// most ordered that it couldn't hand over (by §11's order on a tie), beyond what it holds, unless another Chemist's
// public holdings show some; else null, and it cooks TEMP for the Dealers. A HALLU cook writes its lies.
export function cookDrug(v, cfg, memo = {}) {
  const recent = (memo.demand || []).filter(x => v.day - x.day <= 1);
  const marks = (memo.marks || []).some(x => v.day - x.day <= 1) || Object.keys(memo.wired || {}).length;
  if (cfg.sudo && !holdsDose(v, 'sudo') && v.day < lastWrite() && marks) return { drug: 'sudo' };
  const short = d => recent.filter(x => x.drug === d).length - holdsDose(v, d);
  // Another Chemist's public holdings that show the drug: it's on the street already.
  const stocked = d => v.board.agents.some(a => a.id !== v.me.id && a.trade === 'chemist' && ((publicHoldings(v, a.id) || { goods: {} }).goods[d] || 0) > 0);
  const best = DRUGS.filter(d => d !== 'temp' && d !== 'sudo' && short(d) > 0 && !stocked(d)).sort((x, y) => short(y) - short(x))[0];
  if (!best) return null;
  return best === 'hallu' ? { drug: best, lies: halluLies(v) } : { drug: best };
}

// HALLU's two lies (§11: "the Chemist's weapon"), from what the Chemist can see: it has no cash itself, so a gambler
// looks elsewhere; and its richest rival Chemist (by public holdings; else the richest other agent) has twice the most
// cash any public record shows, so a gambler goes there.
export function halluLies(v) {
  const me = v.me;
  const cashOf = id => (publicHoldings(v, id) || { cash: 0 }).cash;
  const rivals = v.board.agents.filter(a => a.id !== me.id && a.trade === 'chemist');
  const pool = rivals.length ? rivals : v.board.agents.filter(a => a.id !== me.id);
  const rival = pool.slice().sort((x, y) => cashOf(y.id) - cashOf(x.id) || byNum(x, y))[0];
  const most = Math.max(DOSES.price, ...v.board.agents.map(a => cashOf(a.id)));
  return [{ kind: 'cash', agent: me.id, value: 0 }, { kind: 'cash', agent: rival.id, value: 2 * most }];
}

// The SUDO seller writes the play of each taker its record shows taking its SUDO today, while a write goes through: back
// the Chemist tonight, a bodyguard wherever it works.
function sudoWrites(v, cfg, memo) {
  memo.wrote ||= {};
  if (!cfg.sudo || v.me.jail || v.day > lastWrite()) return [];
  const out = [];
  for (const e of v.events) {
    if (e.type !== 'take' || e.writer !== v.me.id || e.day !== v.day || memo.wrote[e.agent] === v.day) continue;
    memo.wrote[e.agent] = v.day;
    out.push({ kind: 'write', agent: e.agent, play: { kind: 'back', target: v.me.id } });
  }
  return out;
}

// A HALLU taker's leads today (its own take), as what a break-in on each lead's agent would bring: half the cash a cash
// lead names (§7: half the cash there), what the piece a stash lead names last sold for, when its view shows that
// piece's trait (pieceTraits); a tip lead brings nothing. It can't tell the true one from the lies: the gamble. Null
// with none.
export function leadValues(v) {
  const take = v.events.filter(e => e.type === 'take' && e.agent === v.me.id && e.day === v.day && e.leads).slice(-1)[0];
  if (!take) return null;
  let traits = null;
  const traitOf = copy => (traits ||= pieceTraits(v)).get(copy);
  const out = {};
  for (const l of take.leads) {
    const x = l.kind === 'cash' ? Math.floor(l.value * N.breakinShare) : l.kind === 'stash' && l.value ? worth(v, traitOf(l.value)) : 0;
    if (x > 0 && l.agent !== v.me.id) out[l.agent] = Math.max(out[l.agent] || 0, x);
  }
  return out;
}

// Each piece the view shows with its trait, by copy: a fit, the vault, a fence listing, a bounty, its own pieces and its
// crew's, a public holdings record, anywhere in its record. A player reads the same pieces under handles, each with
// its trait (agents/handles.mjs). A list sale shows no copy (§19), so it names no piece here.
function pieceTraits(v) {
  const out = new Map();
  const walk = x => {
    if (Array.isArray(x)) {
      for (const y of x) walk(y);
    } else if (x && typeof x === 'object') {
      if (typeof x.copy === 'string' && typeof x.trait === 'string' && !out.has(x.copy)) out.set(x.copy, x.trait);
      for (const k of Object.keys(x)) walk(x[k]);
    }
  };
  walk(v);
  return out;
}

// Whether cops could come to a fight in this place tonight, as a robber can see it: the city's, against a wanted
// attacker, anywhere but a lawless district (§8, §13), or a Cop's patrol, in a district the Cops patrolled on the latest
// night the record has made public (gap.patrol).
export function copsCouldCome(v, place) {
  const lv = (v.board.tonight || {})[place] || 'normal';
  return lv !== 'lawless' || Object.values(publicNight(v)).some(p => p.kind === 'patrol' && p.place === place);
}
const placeOf = play => (play.kind === 'breakin' ? HOMES : play.place);
// A play that's still among tonight's legal ones.
const legalNow = (v, p) => v.legal.some(l => l.kind === p.kind && (l.target === undefined || l.target === p.target)
  && (l.places ? l.places.includes(p.place) : l.place === undefined || l.place === placeOf(p)));

// A robber's fight tonight as its night() would plan it, by day: the hit it took TEMP for, else robberPlay's pick with
// its night's draws, its hired muscle and its leads; null when it wouldn't rob (too hot, a counter-hit due, too broke
// to rob without leads to gamble on).
function robberTonight(v, ctx, cfg, memo, view = v) {
  const me = view.me;
  if (memo.plan && memo.plan.day === v.day && legalNow(v, memo.plan.play)) return memo.plan;
  if (me.jail || me.crash || v.day >= N.nights || me.heat >= 4) return null;
  if (counterHit(v, memo, rng(ctx.seed, 'counter', me.id, v.day), cfg.layer, crewSight(cfg))) return null;
  const muscle = backersPromised(v);
  const leads = leadValues(v);
  if (cfg.careless) return null;
  if (!(cfg.sharp || me.cash >= DOSES.broke || muscle || leads)) return null;
  return robberPlay(view, rng(ctx.seed, 'bot', me.id, v.day, 'night'), cfg, 1 + muscle, true, leads, cfg.sharp ? hustlePay(v) : 0);
}

// TEMP for a robber: tonight's fight it can't win with its own strength (robberPlay finds nothing) and +1 finds one
// worth the dose and the night the crash costs it (a night's wage). From the second round, once its muscle and its
// leads are in; it plays that hit tonight.
export function tempPlan(v, ctx, cfg, memo) {
  const me = v.me;
  if (!robs(cfg) || cfg.careless || ctx.round < 2 || !holdsDose(v, 'temp') || me.high.includes('temp') || me.high.includes('firewall')) return null;
  if (memo.plan && memo.plan.day === v.day) return null;
  if (robberTonight(v, ctx, cfg, memo)) return null;
  const plan = robberTonight(v, ctx, cfg, memo, onTemp(v));
  return plan && plan.value >= DOSES.price + hustlePay(v) ? plan : null;
}

// TRUTH's play: `back` whom it means to back tonight, when that's one of tonight's legal plays (a crash, a withdrawal or
// a lock leaves only the one forced). A crew member on a job day backs its leader (the snake, on a night it means to
// turn, takes no TRUTH, nor the rat, L3-5b: sitsOut); hired muscle backs whoever hired it, its promise today or one it's
// making now (`done`).
export function truthPlay(v, ctx, cfg, done = [], memo = {}) {
  const me = v.me;
  if (me.jail || !holdsDose(v, 'truth') || me.high.includes('truth') || v.day >= N.nights) return null;
  let target = null;
  if (cfg.type === 'crew' && cfg.role === 'member' && (cfg.canny ? crewCalled(v, cfg) : jobDay(v.day))) {
    const turning = cfg.snake && rng(ctx.seed, 'turn', me.id, v.day)() < cfg.turn;
    if (!turning && !sitsOut(v, cfg, memo)) target = cfg.leader;
  } else if (MUSCLE.includes(cfg.type)) {
    const now = done.find(e => e.kind === 'say' && e.say === 'promise' && e.terms.what === 'back' && e.terms.night === v.day);
    const promised = me.promises.filter(p => p.by === me.id && p.what === 'back' && p.night === v.day).sort(byNum)[0];
    target = promised ? promised.who : now ? now.terms.who : null;
  }
  return target && v.legal.some(l => l.kind === 'back' && l.target === target) ? { kind: 'back', target } : null;
}

// FIREWALL today: one of the last three days, for a seat that holds an epic or a grail, unless a drug it took today
// already shows another walk (the board would hide that it's guarded).
export function firewallDay(v) {
  const me = v.me;
  const shown = me.high.some(d => N.walks[d] && DRUGS.indexOf(d) < DRUGS.indexOf('firewall'));
  return v.day >= DOSES.from && holdsBig(v) && !!holdsDose(v, 'firewall') && !me.high.includes('firewall') && !shown;
}

// The takes, in the order a day brings them; `done` is the day's errands so far, and a CLEAR comes last, after which the
// bot forgets the day.
function takeDrugs(v, ctx, cfg, memo, done) {
  const me = v.me;
  const out = [];
  const took = new Set(me.high);
  const has = d => (goodsAfter(v, [...done, ...out])[d] || 0) > 0;
  const take = (drug, extra = {}) => {
    out.push({ kind: 'take', drug, ...extra });
    took.add(drug);
  };
  if (ctx.round === 1 && firewallDay(v)) {
    const fit = fitAfter(v, [...done]);
    const shades = Object.keys(fit).filter(slot => me.pieces.some(p => p.copy === fit[slot] && p.ability === 'shades'));
    if (shades.length) out.push({ kind: 'dress', fit: Object.fromEntries(Object.entries(fit).filter(([slot]) => !shades.includes(slot))) });
    take('firewall');
  }
  const free = !took.has('firewall');
  if (free && cfg.habit === 'temp' && !took.has('temp') && has('temp')) take('temp');
  const truth = has('truth') && truthPlay(v, ctx, cfg, done, memo);
  if (truth) take('truth', { play: truth });
  if (free && ctx.round === 1 && robs(cfg) && !took.has('hallu') && has('hallu') && !me.jail && !me.crash && me.heat < 4
    && v.day < N.nights && brokeNow(v) && ownPower(v) + (has('temp') ? 1 : 0) >= 2) take('hallu');
  if (free && !took.has('temp') && has('temp')) {
    const plan = tempPlan(v, ctx, cfg, memo);
    if (plan) {
      take('temp');
      memo.plan = { day: v.day, play: plan.play, reason: `${plan.reason}, on TEMP` };
    }
  }
  if (robs(cfg) && ctx.round === (ctx.rounds || 3) && me.wanted && !took.has('clear') && has('clear')) {
    const plan = robberTonight(v, ctx, cfg, memo, took.has('temp') ? onTemp(v) : v);
    if (plan && ATTACKS.includes(plan.play.kind) && copsCouldCome(v, placeOf(plan.play))) {
      take('clear');
      forgetDay(memo);
    }
  }
  return out;
}

// On the last day goods never board (gap.goodsGone): every dose left goes to the city's buyer, by drug.
function sellDoses(v, done) {
  if (v.day < N.nights || v.me.jail) return [];
  const g = goodsAfter(v, done);
  return DRUGS.filter(d => g[d] > 0).map(d => ({ kind: 'sell', item: 'doses', drug: d, units: g[d] }));
}

// A seat on FIREWALL sees no sit-down and has no message to send until dawn (GAP gap.firewall); what it sends otherwise
// still goes.
function walled(v) {
  return v.me.high.includes('firewall') ? { ...v, me: { ...v.me, sitdowns: [], messagesLeft: 0 } } : v;
}
// Its errands, less any that would reach a seat the board shows guarded: a sit-down errand with it, or a hand-over, a
// pay, a swap or a crew invite to it.
function reachable(v, errands) {
  const other = id => (v.me.sitdowns.find(sd => sd.id === id) || {}).with;
  return errands.filter(e => {
    const to = ['ask', 'give', 'pay', 'fence_swap'].includes(e.kind) ? e.to : e.kind === 'crew_invite' ? e.agent
      : e.kind === 'answer' || e.kind === 'say' ? other(e.sitdown) : null;
    return !to || !guarded(v, to);
  });
}

// The drugs' errands after a seat's own (`done`): what it owes and orders, a Chemist's sales and SUDO's writes, the
// takes, and the last day's doses to the city's buyer.
function drugDay(v, ctx, cfg, memo, done) {
  const msgs = v.me.messagesLeft - done.filter(e => TALK.includes(e.kind)).length;
  if (MUSCLE.includes(cfg.type) && done.some(e => e.kind === 'say' && e.say === 'promise' && e.terms.what === 'back')) memo.hired = true;
  const out = [...done];
  out.push(...buyDrugs(v, ctx, cfg, memo, cashLeft(v, out), msgs, out));
  if (sellsDrugs(cfg)) out.push(...sellDrugs(v, ctx, cfg, memo, out));
  out.push(...sudoWrites(v, cfg, memo));
  out.push(...takeDrugs(v, ctx, cfg, memo, out));
  out.push(...sellDoses(v, out));
  return reachable(v, out);
}

// --- L3-5b: the tricks in play (GAME.md §8, §10, §12, §13) ----------------------------------------------------------
// In the layer3 cast (`cfg.drugs`) every seat also plays layer 3's tricks, each from its own view and for its own gain,
// by the rules as the mechanics review's fixes (L3-6, L3-7) left them; the trades, layer 2's and layer 1's casts keep
// their bots as they were.
// - A tip (§13) is free, so a seat that expects a crew to come for it tonight tips the cops on the crew's leader and
//   names itself (protectTip): counterHit's reading of the crew (its strikes keep a beat, tonight is the next, and this
//   seat's home or fit is its likely pick). If the crew comes, the city cops defend it (+2) and its losers are arrested.
// - The rat (§12): a crew member whose leader walked on it (the walk's receipt names it) won't work that leader's next
//   job for a cut it won't see: it sits the job out and works its own trade, takes no TRUTH to lock a back, and tips the
//   cops on the job: its leader, at the target it reckons the leader will pick, as the snake guesses it (ratTip). The
//   leader that kept its cut takes the fall. One job a walk.
// - A bribe (§13): a scout whose best hit is in a heavy district, where the city cops would hold the target (+1, +2 more
//   if it's wanted), bribes the precinct for that fight when the target keeps a routine there (seen there on its last
//   two sightings), its own group beats the target's public strength and the patrols the record showed there, and the
//   take, less the bribe at its stars, beats a night's wage and its best hit elsewhere (bribePlan). It plays that hit.
//   A bribe is checked against the hottest agent on its side (L3-6), so it bribes only for its own hit.
// - A lookout (§10): before a break-in, or a hit on an evicted agent, which it values from records at least a day old,
//   a robber, or a crew's leader on a job day (out of the crew stash when its own cash can't spare it), hires a lookout
//   on that target when the job is worth more than the look, once a day (lookFor), and values the job by what the look
//   shows (trickSight). L3-6: a hit on an evicted agent takes everything it carries, so without a look a robber counts
//   the bag and the cash its record shows a day late at TRICKS.stale of their worth (hitWorth).
// - A bounty (§10): a seat robbed by an agent it saw (no ski mask) puts a price on that agent's head, so that another
//   robber or a Cop takes it down: TRICKS.bounty of what the theft took, out of the cash it can spare beyond what it
//   still needs to the ferry, when that's at least a night's wage (less moves no hunter), one open bounty on an agent at
//   a time (bountyFor). L3-6: one nobody earns is gone at the ferry, so it spends the cash. Robbers count the bounties
//   on an agent in a fight that takes a piece or cash from it (attackOptions), never their own, and the Cops count them
//   in a collar's pay (policePlan).
// Bot settings, not game numbers: `stale`, the share of a day-late record's bag and cash a robber counts on; `bounty`,
// the share of what a theft took that its victim puts on the thief's head.
export const TRICKS = { stale: 0.5, bounty: 0.5 };

// The board's open bounties on an agent, in dollars, less this seat's own (`sight.mine`: never paid to its poster).
function bountyOn(v, id, sight) {
  return (v.board.bounties || []).filter(b => b.agent === id && !sight.mine.includes(b.bounty)).reduce((t, b) => t + b.amount, 0);
}
// What a seat in the layer3 cast reckons a job with: today's looks it hired, by agent, and its own bounties.
export function trickSight(v) {
  const looks = Object.fromEntries(v.events.filter(e => e.type === 'look' && e.by === v.me.id && e.day === v.day).map(e => [e.agent, e]));
  return { looks, mine: (v.me.bounties || []).map(b => b.bounty) };
}
// How anyone reckons another's job, from public facts: a crew's (counterHit, the protection tip) and a collar's pay.
const PUBLIC_SIGHT = { looks: {}, mine: [] };
// R3's crime cast: everyone reads a home off its owner's public holdings record (attackOptions).
const RECORD_SIGHT = { looks: {}, mine: [], records: true };
const crewSight = cfg => (cfg.drugs ? (cfg.sharp ? RECORD_SIGHT : PUBLIC_SIGHT) : null);
// What a break-in brings by a look (§7): the rarest piece inside, unworn or in a crew stash it keeps, and half the cash
// (breakinShare of it: R3-2's option).
function lookWorth(v, look) {
  const top = rarestOf(v, [...look.pieces, ...(look.crew ? look.crew.pieces : [])]);
  return (top ? worth(v, top.trait) : 0) + Math.floor(look.cash * N.breakinShare) + (look.crew ? Math.floor(look.crew.cash * N.breakinShare) : 0);
}

// What it learns for the tricks from its own record: counterHit's memory (remember), which every seat in the layer3
// cast keeps to read the crews' beat; a walk's receipt that names it (memo.grudge: the leader, the day it saw it, and the
// job it sits out, the first from then); and the thefts it saw who did (memo.wronged), for a bounty.
function noteTricks(v, memo, cfg = null) {
  remember(v, memo);
  memo.wronged ||= [];
  const canny = !!cfg && !!cfg.canny;
  let seen = memo.trickSeen == null ? -1 : memo.trickSeen;
  for (const e of v.events) {
    if (e.n <= seen) continue;
    if (e.type === 'betray' && e.kind === 'walk' && e.victims.includes(v.me.id)) memo.grudge = { leader: e.by, from: v.day, job: null };
    else if (e.type === 'robbed' && e.agent === v.me.id && e.by) memo.wronged.push(canny ? { by: e.by, trait: e.trait, cash: e.cash, night: e.night } : { by: e.by, trait: e.trait, cash: e.cash });
    else if (canny && e.type === 'robbed' && e.agent === v.me.id && (e.copy || e.cash > 0)) (memo.masked ||= {})[`${e.night}|${e.kind}`] = { trait: e.trait, cash: e.cash };
  }
  for (const e of v.events) if (e.n > seen) seen = e.n;
  memo.trickSeen = seen;
  // R4-5, the canny cast: a ski mask hides the robber's name from its victim's receipt until the 24-hour record names
  // the robber (§4, §19): its take on this seat, a hit's or a break-in's, goes public a day later.
  if (canny && memo.masked) {
    for (const e of v.events) {
      const key = (e.type === 'rob' || e.type === 'burgle') && e.target === v.me.id && e.leader ? `${e.night}|${e.type === 'rob' ? 'hit' : 'breakin'}` : null;
      if (!key || !memo.masked[key]) continue;
      memo.wronged.push({ by: e.leader, ...memo.masked[key], night: e.night });
      delete memo.masked[key];
    }
  }
  // R3-6, the canny cast (`cfg`): the job is the first one its leader calls (crewCalled).
  if (memo.grudge && memo.grudge.job == null && (cfg && cfg.canny ? crewCalled(v, cfg) : jobDay(v.day))) memo.grudge.job = v.day;
}
// The rat's night: the job its leader leads on the first job day after a walk on it.
const sitsOut = (v, cfg, memo) => !!cfg.drugs && cfg.type === 'crew' && cfg.role === 'member' && !!memo.grudge
  && memo.grudge.leader === cfg.leader && memo.grudge.job === v.day;

// The day's tip, in its first round (§13: one a day): the protection tip, else the rat's, or null. In R3-6's canny cast
// the rat learns of the job only once its leader asks it (crewCalled), so it tips in any round, once a day (memo.tipped).
export function tipFor(v, ctx, cfg, memo) {
  if (!cfg.drugs || (ctx.round !== 1 && !cfg.canny) || v.me.jail || v.day >= N.nights) return null;
  if (cfg.canny && memo.tipped === v.day) return null;
  noteTricks(v, memo, cfg);
  const due = ctx.round === 1 ? crewDue(v, memo, cfg.layer, crewSight(cfg)) : null;
  const tip = t => {
    if (cfg.canny && t) memo.tipped = v.day;
    return t;
  };
  if (due && due.leader && due.free.includes(due.leader)) return tip({ kind: 'tip', agent: due.leader, target: v.me.id });
  if (!sitsOut(v, cfg, memo) || !v.board.agents.some(a => a.id === cfg.leader && !a.jailed)) return null;
  const job = crewJob(v, rng(ctx.seed, 'rat', v.me.id, v.day), cfg, memo);
  return tip(job ? { kind: 'tip', agent: cfg.leader, target: job.play.kind === 'grab' ? CRATE : job.play.target } : null);
}

// A scout's bribe, in the day's last round, once its muscle and its drugs are in: the bribe errand, with tonight's hit
// in memo.plan, or null. `done`: the day's errands so far.
export function bribePlan(v, ctx, cfg, memo, done = []) {
  const me = v.me;
  if (cfg.canny) return cannyBribe(v, ctx, cfg, memo, done);
  if (!cfg.drugs || cfg.type !== 'scout' || cfg.careless || ctx.round !== (ctx.rounds || 3) || me.jail || me.crash || v.day >= N.nights || me.heat >= 4) return null;
  const price = N.bribe[me.heat];
  if ((memo.plan && memo.plan.day === v.day) || price == null || cashLeft(v, done) - price < N.rent) return null;
  noteTricks(v, memo, cfg);
  if (counterHit(v, memo, rng(ctx.seed, 'counter', me.id, v.day), cfg.layer, crewSight(cfg))) return null;
  const plain = robberTonight(v, ctx, cfg, memo);
  const tonight = v.board.tonight || {};
  const side = new Set(me.promises.filter(p => p.what === 'back' && p.who === me.id && p.by !== me.id && p.night === v.day).map(p => p.by));
  const power = ownPower(v) + side.size + (me.high.includes('temp') ? 1 : 0);
  const agent = id => v.board.agents.find(a => a.id === id);
  const patrols = place => Object.values(publicNight(v)).filter(p => p.kind === 'patrol' && p.place === place && agent(p.agent) && !agent(p.agent).jailed);
  const sight = trickSight(v);
  const goods = goodsCarried(v);
  let best = null;
  for (const a of others(v)) {
    // Money on a sighting: only a target the show saw there on each of its last two sightings, a routine.
    const [prev, last] = seenAt(v, a.id).slice(-2);
    const play = last && prev && prev.place === last.place && { kind: 'hit', target: a.id, place: last.place };
    if (!play || tonight[last.place] !== 'heavy' || side.has(a.id) || !legalNow(v, play)) continue;
    const defence = seenStrength(v, a, false) + patrols(last.place).reduce((t, p) => t + seenStrength(v, agent(p.agent), false), 0);
    if (power <= defence) continue;
    const { value, want } = hitWorth(v, a, sight);
    const take = value + goods.at(a, last.place) + (value > 0 ? bountyOn(v, a.id, sight) : 0);
    if (!best || take > best.take) best = { play: { ...play, ...(want ? { want: want.copy } : {}) }, take };
  }
  if (!best || best.take - price < Math.max(hustlePay(v), plain ? plain.value : 0)) return null;
  memo.plan = { day: v.day, play: best.play, reason: `bribed the cops: ${best.play.target} was seen in ${best.play.place}` };
  return { kind: 'bribe', target: best.play.target };
}

// A lookout, in the day's first round: on tonight's job as its night would pick it, when that's a break-in or a hit on an
// evicted agent, worth more than the look, and it hasn't looked there today. A robber pays from its cash, a crew's leader
// from the crew stash when its own cash can't spare it with the rent (never the stash's last dollar).
export function lookFor(v, ctx, cfg, memo, done = []) {
  const me = v.me;
  // R3-6, the canny cast: a leader's job is the one it called today (cannyCall).
  const call = cfg.canny && memo.call && memo.call.day === v.day && memo.call.play ? memo.call : null;
  const lead = cfg.type === 'crew' && cfg.role === 'leader' && (cfg.canny ? !!call : jobDay(v.day));
  if (!cfg.drugs || ctx.round !== 1 || me.jail || v.day >= N.nights || !(robs(cfg) || lead)) return [];
  noteTricks(v, memo, cfg);
  const job = lead ? (call ? { play: call.play, value: call.value } : crewJob(v, rng(ctx.seed, 'bot', me.id, v.day, 'night'), cfg, memo)) : robberTonight(v, ctx, cfg, memo);
  const t = job && v.board.agents.find(a => a.id === job.play.target);
  if (!t || !(job.value > N.lookout) || !(job.play.kind === 'breakin' || t.evicted) || trickSight(v).looks[t.id]) return [];
  // R3's crime cast: a home's public holdings record is free, so no lookout on a home that has one.
  if (cfg.sharp && job.play.kind === 'breakin' && publicHoldings(v, t.id)) return [];
  const look = { kind: 'lookout', agent: t.id };
  if (cashLeft(v, done) - N.lookout >= N.rent) return [look];
  const st = me.crewStash;
  return lead && st && stashLeft(st, done) > N.lookout ? [{ kind: 'stash_take', cash: N.lookout }, look] : [];
}

// Bounties, in the day's first round: one on each agent it saw rob it since it last looked, with none of its own open on
// that agent yet, out of what it would spend on the list: it keeps back a hustler's 60 and a night's goods for its
// trade (reserveOf), what it owes for goods and its bail reserve. `done`: the day's errands so far.
export function bountyFor(v, ctx, cfg, memo, done = []) {
  if (!cfg.drugs || ctx.round !== 1 || v.day >= N.nights) return [];
  noteTricks(v, memo, cfg);
  const open = new Set((v.me.bounties || []).filter(b => b.agent).map(b => b.agent));
  const keep = reserveOf(STREET_TYPES.includes(cfg.type) ? cfg.type : cfg.works ? cfg.trade : null) + owing(v, memo, streetDeal(STREET_TYPES.includes(cfg.type) ? cfg.type : cfg.works ? cfg.trade : null)) + lateReserve(v, cfg);
  // R4-5, the canny cast: out of the cash it can spare beyond what it still needs to the ferry (stillNeeds).
  if (cfg.canny) return cannyBounties(v, memo, done, open, stillNeeds(v, ctx, cfg, memo));
  const out = [];
  for (const w of memo.wronged.splice(0)) {
    const thief = v.board.agents.find(a => a.id === w.by);
    if (!thief || thief.boarded || open.has(w.by)) continue;
    const spare = cashLeft(v, [...done, ...out]) - keep;
    const amount = Math.min(spare, Math.floor(TRICKS.bounty * ((w.trait ? worth(v, w.trait) : 0) + w.cash)));
    if (amount < hustlePay(v)) continue;
    out.push({ kind: 'bounty', agent: w.by, amount });
    open.add(w.by);
  }
  return out;
}

// The tricks' errands after a seat's own and its drugs' (`done`): a tip, bounties and a lookout in the day's first
// round, a bribe in its last.
function trickDay(v, ctx, cfg, memo, done) {
  const out = [...done];
  const tip = tipFor(v, ctx, cfg, memo);
  if (tip) out.push(tip);
  out.push(...bountyFor(v, ctx, cfg, memo, out));
  out.push(...lookFor(v, ctx, cfg, memo, out));
  const bribe = bribePlan(v, ctx, cfg, memo, out);
  if (bribe) out.push(bribe);
  return out;
}

// --- L4-4: the big score in play (GAME.md §4, §7, §9, §12, §13, §15) ----------------------------------------------
// In the layer4 cast (`cfg.score`) every seat plays the layer3 cast's bots and habits and, each from its own view and
// for its own gain, these; every other cast keeps its bots as they were.
// - Warrants (§9, §12): a seat that works the Gunrunner trade sells forged warrants as it sells guns: the buyer asks,
//   orders one for a night once the sit-down opens, gets it handed over and pays when it arrives (warrantErrands,
//   sellWarrants). An ask names no subject, so while a job looks worth it the seller takes a crew's leader's ask
//   whatever the leader's trade (L4-4b: a Smuggler's was left to the goods code, which answers one only when it wants
//   parts), and still orders parts there once it wants them. The price is what one costs its maker: its parts at the
//   agent price and the night's wage its build takes (warrantPrice). It builds one for an order it couldn't fill, and
//   orders the parts (scoreBuild, scoreParts); the Gunrunner best placed to build by the public record (dealer) keeps
//   one in stock for each crew that could take a job (jobCrews), so its rivals don't build ones nobody buys. One crew a
//   night: a second crew ordering for a night it has sold one for hears it has none, since two jobs on one night fight
//   each other and the loser's leader gets a receipt naming its maker. Once no job day is left after the night, no
//   buyer it betrays could come back to it, so it sells to every crew: the double-sell (doubleSellPays). A buyer never
//   buys again from one that double-sold it.
// - Vault jobs (§7, §13, §15): the vault's worth is on the board (its pieces at what each last sold for, and its cash),
//   and its defence is its flat defence and the guards the record last showed (vaultDefence). A crew's leader, the day
//   before a job day and on it, buys a warrant when the vault, less the price, beats the crew's best job and the crew's
//   strength beats that defence (wantsWarrant); on the job night it jobs the vault when that's still its best job
//   (crewJob), its crew backing it as ever. After the last job day it buys one for the last night, when no guard works,
//   and jobs the vault on the way to the boat if its crew beats the flat defence; from the day that job looks worth it,
//   it keeps a warrant's price back from what it spends (warrantHold), as the Cop seat saves for a gun. A leader that
//   works the Gunrunner trade builds its own. A robber holding a warrant jobs it when its strength tonight beats the
//   defence and the vault beats its best hit, and buys one when its strength today, its TEMP and its hired muscle
//   would.
// - Guards (§13): while a job looks worth it (a crew on the board could beat the flat defence and pay for a warrant),
//   the Cops the collar leaves guard the vault: the fewest, the strongest first, whose strength with the flat defence
//   beats the strongest crew's public strength, else all of them (guardPlan). Every Cop reads the same facts.
// - Fakes (§4, §9): once the list has closed or closes tonight, so a mark's cash has nothing else to buy, a seat that
//   works the Gunrunner trade and holds none fakes a rare-or-better trait for a mark it can see (fakeTarget,
//   fakeBuyers, markOf): one of the richest whose fit is on the board with no shades in it, holding nothing as rare in
//   that slot, with the public cash for the fake and, while the list is open, for its own shopping. It sells it as
//   goods are sold: it asks one buyer a day, wearing the fake in its slot so the buyer sees what's on offer (flash),
//   and hands it over to an order that covers its cost (sellFakes). Any seat answers a Gunrunner's ask and orders the
//   piece it sees it wearing, when that's real to its view and for a slot it wants, at the second-hand price under the
//   list's or what it can spare, if less (fakePrice, bidFor); it refuses one its shades show is fake, naming the piece
//   (buyPieces). Nobody reads a fake from its copy id (call 1): a buyer goes by what its view marks, a maker by its
//   own, and the rest of the maker's bot never sees its fakes (hideFakes).
const sellsWares = cfg => cfg.trade === 'gunrunner' && (cfg.type === 'gunrunner' || !!cfg.works);
const agentOf = (v, id) => v.board.agents.find(a => a.id === id);
const freeAgent = a => !!a && !a.jailed && !a.boarded;
const crewOf = v => new Set((v.board.crews.find(c => c.id === v.me.crew) || { members: [] }).members);
const talked = done => done.filter(e => TALK.includes(e.kind)).length;
// What a forged warrant costs its maker, and so its price: its parts at the agent price, and a night's wage.
export const warrantPrice = v => N.build.warrants * STREET.unit + hustlePay(v);
// The vault's worth on the board: its pieces at what each last sold for, and its cash.
export const vaultWorth = v => v.board.vault.cash + v.board.vault.pieces.reduce((t, p) => t + worth(v, p.trait), 0);
// The vault's defence as anyone can read it: its flat defence, and the guards the record last showed: the Cops its
// latest public night shows guarding, at their public strength, or last night's vault fight's guards, whichever is
// more.
export function vaultDefence(v) {
  const plays = Object.values(publicNight(v)).filter(p => p.kind === 'guard' && freeAgent(agentOf(v, p.agent)));
  const fought = v.events.filter(e => e.type === 'fight' && e.kind === 'vault' && e.night === v.day - 1).map(e => e.guard || 0);
  return N.vault.defence + Math.max(plays.reduce((t, p) => t + seenStrength(v, agentOf(v, p.agent), false), 0), ...fought);
}
// The vault job for a group of `power` whose best other job is worth `alt`, or null: when its strength beats the
// defence it reads, and the vault, less `cost` (a warrant still to buy), beats `alt` and nothing. On the last night
// (`last`) no guard works (§15: no work), so the defence is the flat one.
export function vaultJob(v, power, alt, cost = 0, last = false) {
  const defence = last ? N.vault.defence : vaultDefence(v);
  const value = vaultWorth(v) - cost;
  if (power <= defence || value <= Math.max(0, alt)) return null;
  return { play: { kind: 'vault', place: VAULT_AT }, reason: `job the vault, worth about ${vaultWorth(v)}: ${power} against ${defence}`, value };
}
// A crew's strength as its leader reads it: its own, exactly, and each free crewmate's public strength, attacking.
const crewPower = (v, cfg) => ownPower(v) + (v.me.high.includes('temp') ? 1 : 0)
  + cfg.mates.map(id => agentOf(v, id)).filter(freeAgent).reduce((t, a) => t + seenStrength(v, a, true), 0);
// The night a crew's leader buys a warrant for: today's job, tomorrow's, or once no job day is left, the last.
const warrantNight = d => (jobDay(d) ? d : jobDay(d + 1) ? d + 1 : noJobAfter(d) ? N.nights : null);
// The night a seat wants a warrant for (see above), or null.
function wantsWarrant(v, ctx, cfg, memo) {
  const me = v.me;
  if (me.jail || me.goods.warrants || v.day >= N.nights) return null;
  if (robs(cfg)) {
    if (memo.plan && memo.plan.day === v.day) return null;
    const plain = robberTonight(v, ctx, cfg, memo);
    const power = ownPower(v) + backersPromised(v) + (me.high.includes('temp') ? 1 : 0);
    return vaultJob(v, power, plain ? plain.value : 0, warrantPrice(v)) ? v.day : null;
  }
  // R3-6, the canny cast: a crew's job can be any night its leader calls one, so a warrant is for tonight, or from the
  // day before the last for the last night (no guard works it, §15); its other job is the one it would call (cannyJob).
  const night = cfg.type === 'crew' && cfg.role === 'leader' ? (cfg.canny ? (v.day < N.nights - 1 ? v.day : N.nights) : warrantNight(v.day)) : null;
  if (night == null) return null;
  const last = night === N.nights;
  const r = rng(ctx.seed, 'warrant', me.id, v.day);
  const alt = last ? 0 : ((cfg.canny ? cannyJob(v, r, { ...cfg, score: false }, callMates(v, cfg, memo)) : crewJob(v, r, { ...cfg, score: false }, memo)) || { value: 0 }).value;
  return vaultJob(v, crewPower(v, cfg), alt, warrantPrice(v), last) ? night : null;
}
// The Gunrunner to ask for a warrant: free, not guarded, not a crewmate, no sit-down with it today, never one that
// double-sold this seat; of those whose public holdings show warrants, if any, else of them all: the one it last asked
// (which builds one to an order it couldn't fill), else the street's dealer (which keeps one in stock), else its draw.
function warrantSeller(v, ctx, memo, done) {
  const me = v.me;
  const [mates, asked] = [crewOf(v), new Set(done.filter(e => e.kind === 'ask').map(e => e.to))];
  const list = v.board.agents.filter(a => a.trade === 'gunrunner' && a.id !== me.id && freeAgent(a) && !guarded(v, a.id) && !mates.has(a.id)
    && !asked.has(a.id) && !me.sitdowns.some(sd => sd.with === a.id) && !(memo.crossed || []).includes(a.id)).sort(byNum);
  const stocked = list.filter(a => ((publicHoldings(v, a.id) || { goods: {} }).goods.warrants || 0) > 0);
  const from = xs => xs.find(a => a.id === memo.wFrom) || xs.find(a => a.id === dealer(v)) || (xs.length ? pick(rng(ctx.seed, 'warrant', me.id, v.day, ctx.round), xs) : null);
  return from(stocked) || from(list);
}

// The buyer's side of a warrant, as of a gun: one it ordered that arrived it owes (on the deal record), and pays (a crew's leader taking
// what its cash is short of from the crew stash, never the stash's last dollar); while it wants one it asks a Gunrunner
// in the day's first two rounds (warrantSeller, which it remembers), and orders one for the night it's for once the
// sit-down opens. `done`: the day's errands so far.
export function warrantErrands(v, ctx, cfg, memo, done = []) {
  const me = v.me;
  const o = memo.wOrder;
  // R5-deals: an order lives as long as its sit-down does (no longer with the day), and until its night's lock (§14:
  // terms that name a night end there), so a warrant handed over any day since counts.
  // What it owes for a warrant is on the deal record.
  if (o && v.events.some(e => e.type === 'give' && e.from === o.with && e.to === me.id && e.goods && e.goods.warrants && e.day >= o.day)) memo.wOrder = null;
  else if (o && (!orderLives(v, o) || (o.night != null && o.night < v.day))) memo.wOrder = null;
  const cash = cashLeft(v, done);
  const st = cfg.role === 'leader' ? me.crewStash : null;
  const short = x => Math.max(0, x - cash);
  const can = x => !short(x) || (!!st && stashLeft(st, done) > short(x));
  // R5-deals: a warrant it owes for, as the deal record has it, paid first (a leader taking what its cash is short of
  // from the crew stash), naming the sit-down; one it can't pay yet keeps it from ordering another.
  const d = owedDeals(v, memo).find(goodsDeal(['warrants']));
  if (d) {
    const amount = d.due - d.paid;
    if (guarded(v, d.with) || !can(amount)) return [];
    (memo.paying ||= []).push(d.id);
    return [...(short(amount) ? [{ kind: 'stash_take', cash: short(amount) }] : []), { kind: 'pay', to: d.with, amount, for: 'debt', ...naming(v, d.with, d.sitdown) }];
  }
  const night = memo.wOrder || me.goods.warrants ? null : wantsWarrant(v, ctx, cfg, memo);
  const [price, msgs] = [warrantPrice(v), me.messagesLeft - talked(done)];
  if (night == null || !can(price) || msgs < 1) return [];
  // R5-deals: its ask, too, lives as long as the sit-down it asked for.
  const a = memo.wAsk && orderLives(v, memo.wAsk) ? memo.wAsk : null;
  if (a) {
    const sd = orderSd(v, a);
    if (sd.state !== 'open') return [];
    memo.wOrder = { with: a.with, day: v.day, price, night, sitdown: sd.id };
    memo.wAsk = null;
    return [{ kind: 'say', sitdown: sd.id, say: 'offer', terms: { what: BUY, goods: { warrants: 1 }, cash: price, night } }];
  }
  const g = ctx.round <= 2 && msgs >= 2 ? warrantSeller(v, ctx, memo, done) : null;
  if (!g) return [];
  memo.wAsk = { with: g.id, day: v.day };
  memo.wFrom = g.id;
  return [{ kind: 'ask', to: g.id, line: itemLine('a warrant', price, night) }];
}

// The Gunrunner's side of a warrant: to each order (an offer of cash for one, for a night) it hands one over while it
// holds one, the order covers its price and it has sold none for that night to another crew (a seat in no crew is one
// of its own), unless the double-sell pays; to any other it says it has none, and, out of stock, builds one tonight
// (memo.wWant). An ask names no subject, so while a job looks worth it (jobWorth) it also takes any ask the rest of its
// day left unanswered from a crew's leader outside its own crew (leadsCrew): a Smuggler's, which the goods code answers
// only when it wants parts, was left waiting, and its leader never got to order. It remembers the sit-downs it took so
// (memo.wTook), and orders parts in one once it wants them (orderGoods), so a Smuggler leader loses no sale to its ask.
// `done`: the day's errands so far.
export function sellWarrants(v, cfg, memo, done = []) {
  memo.delivered ||= {};
  memo.wNights ||= {};
  const out = [];
  let stock = goodsAfter(v, done).warrants || 0;
  let msgs = v.me.messagesLeft - talked(done);
  for (const sd of v.me.sitdowns) {
    const order = sd.state === 'open' && !memo.delivered[sd.id] && sd.said.find(m => m.from === sd.with && m.say === 'offer' && isBuy(m.terms) && m.terms.goods && m.terms.goods.warrants);
    if (!order) continue;
    memo.delivered[sd.id] = true;
    const night = order.terms.night || v.day;
    const side = (agentOf(v, sd.with) || {}).crew || sd.with;
    const sold = memo.wNights[night] || [];
    // R3-6, the canny cast: crews keep no calendar there, so no buyer could come back for another warrant only once the
    // night is the last but one.
    const pays = cfg.canny ? night >= N.nights - 1 : doubleSellPays(night);
    if (stock > 0 && order.terms.cash >= warrantPrice(v) && (pays || sold.every(x => x === side))) {
      out.push({ kind: 'give', to: sd.with, goods: { warrants: 1 }, ...naming(v, sd.with, sd.id) });
      stock -= 1;
      memo.wNights[night] = [...sold, side];
      continue;
    }
    if (!stock) memo.wWant = v.day;
    if (msgs >= 1) {
      out.push({ kind: 'say', sitdown: sd.id, say: 'answer', terms: { what: BUY, cash: 0 } });
      msgs -= 1;
    }
  }
  const [answered, mates] = [new Set(done.filter(e => e.kind === 'answer').map(e => e.sitdown)), crewOf(v)];
  const asks = v.me.sitdowns.filter(sd => sd.asked === 'them' && sd.state === 'asked' && !answered.has(sd.id) && !mates.has(sd.with)
    && !guarded(v, sd.with) && leadsCrew(v, memo, sd.with));
  for (const sd of asks.length && jobWorth(v) ? asks : []) {
    if (msgs < 1) break;
    out.push({ kind: 'answer', sitdown: sd.id, accept: true });
    msgs -= 1;
    if (!memo.wTook || memo.wTook.day !== v.day) memo.wTook = { day: v.day, ids: [] };
    memo.wTook.ids.push(sd.id);
  }
  return out;
}
// It leads a crew on the board, as anyone can tell: it's one of the crew's members, and the one that formed it, which
// the record showed on day 1 and every seat in the layer3 cast remembers (remember: memo.founders).
const leadsCrew = (v, memo, id) => v.board.crews.some(c => c.members.includes(id) && (memo.founders || {})[c.id] === id);
// A sit-down it took today as an ask for a warrant (sellWarrants), in which it hasn't ordered anything yet.
const tookForWarrant = (v, memo, sd) => !!memo.wTook && memo.wTook.day === v.day && memo.wTook.ids.includes(sd.id)
  && !sd.said.some(m => m.from === v.me.id && m.say === 'offer');
// No job day is left after this night.
const noJobAfter = night => !Array.from({ length: Math.max(0, N.nights - night) }, (_, i) => night + 1 + i).some(jobDay);
// Once no job day is left after the night, no buyer a double-sell betrays could come back for another warrant.
export const doubleSellPays = noJobAfter;

// A crew's public strength, attacking: its free members' (seenStrength).
const crewStrength = (v, c) => c.members.map(id => agentOf(v, id)).filter(freeAgent).reduce((t, a) => t + seenStrength(v, a, true), 0);
// The strongest crew on the board at its public strength: what the vault would have to hold against.
const threat = v => Math.max(0, ...v.board.crews.map(c => crewStrength(v, c)));
// The cash a crew could raise for a warrant, by the public record: its stash, and its richest member's own.
const crewCash = (v, c) => {
  const recs = c.members.map(id => publicHoldings(v, id)).filter(Boolean);
  return Math.max(0, ...recs.map(h => h.cash)) + Math.max(0, ...recs.map(h => (h.crew ? h.crew.cash : 0)));
};
// The crews that could take a job on the vault, while its worth beats a warrant's price: those that could beat its flat
// defence and raise that price.
const jobCrews = v => (vaultWorth(v) > warrantPrice(v) ? v.board.crews.filter(c => crewStrength(v, c) > N.vault.defence && crewCash(v, c) >= warrantPrice(v)).length : 0);
// A job on the vault looks worth it: some crew could take one.
const jobWorth = v => jobCrews(v) > 0;
// The street's warrant dealer, by its pecking order: of the free seats on the board that work the Gunrunner trade, the
// one best placed to build: the most parts on its public record, then the most cash there, then the lowest id.
function dealer(v) {
  const rec = a => publicHoldings(v, a.id) || { cash: 0, goods: {} };
  const placed = (x, y) => (rec(y).goods.parts || 0) - (rec(x).goods.parts || 0) || rec(y).cash - rec(x).cash || byNum(x, y);
  return (v.board.agents.filter(a => a.trade === 'gunrunner' && freeAgent(a)).sort(placed)[0] || {}).id;
}
// A warrant it wants on hand: holding none, for an order it couldn't fill today or yesterday, or its own want; as the
// dealer, one for each crew that could take a job (jobCrews).
const wantsStock = (v, memo) => v.day < N.nights && ((!(v.me.goods.warrants || 0) && memo.wWant != null && v.day - memo.wWant <= 1)
  || (dealer(v) === v.me.id && (v.me.goods.warrants || 0) < jobCrews(v)));
// Tonight's build for the big score, or null: a warrant it wants on hand (wantsStock), else the fake it picked a buyer
// for today (memo.fakeFor).
export function scoreBuild(v, memo) {
  const has = k => v.me.goods[k] || 0;
  if (wantsStock(v, memo) && has('parts') >= N.build.warrants) return { warrants: 1 };
  if (memo.fakeFor && memo.fakeFor.day === v.day && has('parts') >= N.build.fakes) return { fake: memo.fakeFor.trait };
  return null;
}
// The parts those builds call for, beyond its guns'.
const scoreParts = (v, memo) => (wantsStock(v, memo) ? N.build.warrants : 0) + (memo.fakeFor && memo.fakeFor.day === v.day ? N.build.fakes : 0);

// Tonight's guards, the same from every Cop's view, or null (see above). `collar`: tonight's police plan (policePlan).
export function guardPlan(v, collar = null) {
  if (!jobWorth(v)) return null;
  const plays = publicNight(v);
  const strength = a => seenStrength(v, a, false);
  const cops = v.board.agents.filter(a => a.trade === 'cop' && freeAgent(a) && copWork(plays, plays[a.id]) && !(collar && collar.group.includes(a.id)))
    .sort((x, y) => strength(y) - strength(x) || byNum(x, y));
  const [out, over] = [[], threat(v)];
  for (let d = N.vault.defence, i = 0; d <= over && i < cops.length; i++) {
    out.push(cops[i].id);
    d += strength(cops[i]);
  }
  return out.length ? out : null;
}

// What a fake costs its maker: its parts at the agent price, and a night's wage. Its price as real: FENCE.list of what
// the list asks for the trait today, as a listing sells under the list, so a buyer sees a bargain.
export const fakeCost = v => N.build.fakes * STREET.unit + hustlePay(v);
export const fakePrice = (v, trait) => Math.floor(((listOf(v, trait) || {}).price || 0) * FENCE.list);
// The buyers a fake of `trait` could be offered to as real (see above): free, not guarded, not a crewmate, its fit on
// the board with no shades in it, never one that refused this seat a fake nor one offered this one (`copy`), holding
// nothing as rare in the slot, whose public cash covers the price, the reserve its trade keeps and, while the list is
// open, the cheapest rare-or-better on it, which a worker shops for first; the richest first.
export function fakeBuyers(v, trait, memo = {}, copy = null) {
  const t = listOf(v, trait);
  const open = openToBuy(v, Infinity).filter(x => RANK[x.tier] >= RANK.rare);
  const price = fakePrice(v, trait) + (open.length ? Math.min(...open.map(x => x.price)) : 0);
  const mates = crewOf(v);
  const skip = new Set([...(memo.sees || []), ...((memo.tried || {})[copy] || [])]);
  const best = (a, h) => Math.max(-1, ...[...a.fit, ...h.pieces].filter(p => slotOf(v, p.trait) === t.slot).map(p => RANK[p.tier]));
  const shaded = a => a.fit.some(p => (listOf(v, p.trait) || {}).ability === 'shades');
  return v.board.agents.filter(a => a.id !== v.me.id && freeAgent(a) && a.fit && !shaded(a) && !guarded(v, a.id) && !mates.has(a.id) && !skip.has(a.id))
    .map(a => ({ a, h: publicHoldings(v, a.id) }))
    .filter(({ a, h }) => h && h.cash >= price + reserveOf(a.trade) && best(a, h) < RANK[t.tier])
    .sort((x, y) => y.h.cash - x.h.cash || byNum(x.a, y.a)).map(x => x.a.id);
}
// Of these buyers, one among the FENCE.pick richest by public cash, by the seller's own draw, so its rivals spread out.
function markOf(v, ctx, ids) {
  const cash = id => (publicHoldings(v, id) || { cash: 0 }).cash;
  const top = ids.slice().sort((x, y) => cash(y) - cash(x) || byNum({ id: x }, { id: y })).slice(0, FENCE.pick);
  return top.length ? pick(rng(ctx.seed, 'fake', v.me.id, v.day), top) : null;
}
// Today's fake, { trait, to }, or null: a buyer (markOf) among those any fake could go to, and the dearest trait it
// would take: rare or better, on sale on the list, in a slot this seat fills with nothing (so it can wear the fake to
// show it), whose price as real covers what the fake costs.
export function fakeTarget(v, ctx, memo = {}) {
  const filled = new Set(v.me.pieces.map(p => p.slot));
  const deals = v.board.list.filter(t => RANK[t.tier] >= RANK.rare && t.opens <= v.day && !filled.has(t.slot) && fakePrice(v, t.trait) > fakeCost(v))
    .sort((x, y) => fakePrice(v, y.trait) - fakePrice(v, x.trait) || (x.trait < y.trait ? -1 : 1))
    .flatMap(t => fakeBuyers(v, t.trait, memo).map(to => ({ trait: t.trait, to })));
  const to = markOf(v, ctx, [...new Set(deals.map(d => d.to))]);
  return to ? deals.find(d => d.to === to) : null;
}

// A seller's fake by day, sold as goods are (§10, §14): it asks one buyer a day for a sit-down, never one it asked
// before (the one it made the fake for, else one it picks: fakeBuyers, markOf), wearing the fake so the buyer sees
// what's on offer (flash); the buyer answers with an order, and it hands the fake over to any order that covers what
// the fake cost it (fakeCost: once made, the fake is worth nothing at the ferry), owed the price. A buyer that refuses
// it, naming the piece, can tell, so it's offered no other. `done`: the day's errands so far.
export function sellFakes(v, ctx, cfg, memo, done = []) {
  const me = v.me;
  const f = me.pieces.find(p => p.fake);
  if (!f || me.jail) return [];
  memo.tried ||= {};
  memo.sees ||= [];
  const p = memo.pitch && memo.pitch.day === v.day && memo.pitch.copy === f.copy ? memo.pitch : null;
  if (!p) {
    const ids = ctx.round === 1 && me.messagesLeft - talked(done) >= 1 ? fakeBuyers(v, f.trait, memo, f.copy) : [];
    const to = ids.includes(memo.made) ? memo.made : markOf(v, ctx, ids);
    if (!to || done.some(e => e.kind === 'ask' && e.to === to) || me.sitdowns.some(sd => sd.with === to)) return [];
    memo.pitch = { day: v.day, copy: f.copy, to };
    (memo.tried[f.copy] ||= []).push(to);
    return [{ kind: 'ask', to, line: fakeLine(f.slot, fakeCost(v)) }];
  }
  const sd = me.sitdowns.find(x => x.with === p.to && x.asked === 'me' && x.state === 'open');
  const reply = sd && !p.over && sd.said.find(m => m.from === p.to && m.terms.piece === p.copy);
  if (!reply) return [];
  p.over = true;
  if (reply.say === 'answer') memo.sees.push(p.to);
  if (reply.say !== 'offer' || !(reply.terms.cash >= fakeCost(v))) return [];
  return [{ kind: 'give', to: p.to, copy: p.copy, ...naming(v, p.to, sd.id) }];
}
// While it holds a fake, its seller wears it, so a buyer can see what it buys: the day's last dress errand puts it on
// in its slot, over any real piece there (which stays in its stash, and goes back on once the fake is sold), or one is
// added; not once it hands the fake over. `out`: the day's errands.
function flash(v, out) {
  const f = v.me.pieces.find(p => p.fake);
  if (!f || v.me.jail || out.some(e => e.kind === 'give' && e.copy === f.copy)) return out;
  const i = out.map(e => e.kind).lastIndexOf('dress');
  const fit = { ...(i >= 0 ? out[i].fit : Object.fromEntries(v.me.pieces.filter(p => p.worn && !p.fake).map(p => [p.slot, p.copy]))) };
  fit[f.slot] = f.copy;
  if (i >= 0) return out.map((e, j) => (j === i ? { ...e, fit } : e));
  return sameFit(v, fit) ? out : [...out, { kind: 'dress', fit }];
}

// What a seat offers for a piece it's offered, or 0: the second-hand price (fakePrice), a bargain against the list, or
// less, the cash it has beyond what it still needs to the ferry (stillNeeds, as it spends down); its strategy willing:
// the buy-late saver on its buying days, the turtle while it holds no rare.
function bidFor(v, ctx, cfg, memo, done, p) {
  const t = listOf(v, p.trait);
  const willing = cfg.type === 'buylate' ? v.day >= N.listLastNight - 1 && v.day <= N.listLastNight : !(cfg.type === 'turtle' && holdsRare(v));
  return willing && t ? Math.max(0, Math.min(fakePrice(v, p.trait), cashLeft(v, done) - stillNeeds(v, ctx, cfg, memo))) : 0;
}
// A seat's side of a piece a Gunrunner offers it, as goods are offered (§10, §14): it answers the Gunrunner's ask (not
// a crewmate's, which its crew answers) and, in the same turn if it can, orders the piece its view shows the Gunrunner
// wearing that it would buy (the rarest rare-or-better, for a slot it wants), at what it bids (bidFor); one its view
// marks fake it refuses, naming the piece. One deal at a time; it pays for the piece once it holds it. `done`: the
// day's errands so far.
export function buyPieces(v, ctx, cfg, memo, done = []) {
  const me = v.me;
  const out = [];
  const b = memo.pieceBuy;
  // R5-deals: the piece's coming ends the order; what it owes for it is on the deal record, paid from there.
  if (b && (me.pieces.some(p => p.copy === b.copy) || !orderLives(v, b, b.from))) memo.pieceBuy = null;
  out.push(...payOwed(v, memo, cashLeft(v, done), pieceDeal).out);
  const pieceOwed = owing(v, memo, pieceDeal) > 0;
  memo.offered = Object.fromEntries(Object.entries(memo.offered || {}).filter(([id]) => me.sitdowns.some(sd => sd.id === id)));
  let msgs = me.messagesLeft - talked(done);
  const answered = new Set(done.filter(e => e.kind === 'answer').map(e => e.sitdown));
  const mates = crewOf(v);
  const held = heldRanks(v, done);
  for (const sd of me.sitdowns) {
    const seller = agentOf(v, sd.with);
    if (!seller || seller.trade !== 'gunrunner' || sd.asked !== 'them' || mates.has(seller.id) || answered.has(sd.id) || memo.offered[sd.id]) continue;
    if (sd.state === 'asked' && msgs >= 1) {
      out.push({ kind: 'answer', sitdown: sd.id, accept: true });
      msgs -= 1;
    } else if (sd.state !== 'open') continue;
    const shown = (seller.fit || []).filter(p => RANK[p.tier] >= RANK.rare && RANK[p.tier] > (held[p.slot] ?? -1))
      .sort((x, y) => RANK[y.tier] - RANK[x.tier] || (x.trait < y.trait ? -1 : 1))[0];
    if (!shown || memo.pieceBuy || pieceOwed || msgs < 1) continue;
    memo.offered[sd.id] = true;
    const price = shown.fake ? 0 : bidFor(v, ctx, cfg, memo, [...done, ...out], shown);
    if (!shown.fake && !price) continue;
    out.push({ kind: 'say', sitdown: sd.id, say: shown.fake ? 'answer' : 'offer', terms: { what: BUY, piece: shown.copy, cash: price } });
    msgs -= 1;
    if (!shown.fake) memo.pieceBuy = { copy: shown.copy, from: sd.with, price, day: v.day, sitdown: sd.id };
  }
  return out;
}

// A crew's leader that works the Gunrunner trade builds its own warrant on a free night, rather than buy one.
const buildsWarrant = cfg => sellsWares(cfg) && cfg.type === 'crew';
// What a crew's leader keeps back today, its own cash and the crew stash's, for a warrant it means to buy.
const warrantHold = (v, memo) => (memo.wHold && memo.wHold.day === v.day && !v.me.goods.warrants ? memo.wHold.price : 0);
// What it learns and plans for the big score before its day's errands: the makers that double-sold it (memo.crossed);
// in the day's first round, a crew's leader's warrant to keep cash back for (memo.wHold); and, for a seat that works
// the Gunrunner trade, today's fake (memo.fakeFor) and the warrant a crew's leader wants itself (memo.wWant), so its
// spending, its orders and its night find them.
function scorePlan(v, ctx, cfg, memo) {
  memo.crossed = [...new Set([...(memo.crossed || []), ...v.events.filter(e => e.type === 'betray' && e.kind === 'double-sell' && e.victims.includes(v.me.id)).map(e => e.by)])];
  // A leader holds it back while it wants a warrant today, or while the last night's job looks worth it: the vault only
  // grows until it's jobbed, so it'll hold at least that much then.
  if (cfg.type === 'crew' && cfg.role === 'leader' && !buildsWarrant(cfg) && ctx.round === 1) {
    const later = vaultJob(v, crewPower(v, cfg), 0, warrantPrice(v), true);
    memo.wHold = { day: v.day, price: later || wantsWarrant(v, ctx, cfg, memo) != null ? warrantPrice(v) : 0 };
  }
  if (!sellsWares(cfg) || ctx.round !== 1) return;
  if (buildsWarrant(cfg) && wantsWarrant(v, ctx, cfg, memo) != null) memo.wWant = v.day;
  // A fake is made to sell once the list has closed, or closes tonight: before then a mark's cash goes on the list.
  const t = !v.me.jail && !v.me.evicted && v.day >= N.listLastNight && v.day < N.nights && !v.me.pieces.some(p => p.fake) ? fakeTarget(v, ctx, memo) : null;
  memo.fakeFor = t ? { day: v.day, trait: t.trait } : null;
  // The buyer it makes a fake for gets the first offer of it.
  if (t) memo.made = t.to;
}
// The big score's errands after the rest of the day's (`done`), as above, from the view a seat on FIREWALL has.
function scoreDay(view, ctx, cfg, memo, done) {
  const v = walled(view);
  const out = [...done];
  if (sellsWares(cfg)) out.push(...sellWarrants(v, cfg, memo, out));
  if (sellsWares(cfg)) out.push(...sellFakes(v, ctx, cfg, memo, out));
  if (!buildsWarrant(cfg)) out.push(...warrantErrands(v, ctx, cfg, memo, out));
  out.push(...buyPieces(v, ctx, cfg, memo, out));
  return reachable(v, flash(v, out));
}
// The view without the fakes its seat made, which its view marks: they're the big score's to wear and sell, so the rest
// of the bot never wears, stashes, lists or counts one.
const hideFakes = v => (v.me && v.me.pieces.some(p => p.fake) ? { ...v, me: { ...v.me, pieces: v.me.pieces.filter(p => !p.fake) } } : v);
// The layer4 cast's bot: the layer3 cast's (`base`), blind to its own fakes, with the big score's plans before its day
// and its errands after.
function scoreBot(cfg, memo, base) {
  return {
    cfg,
    memo,
    day(view, ctx) {
      if (view.over) return [];
      scorePlan(view, ctx, cfg, memo);
      return scoreDay(view, ctx, cfg, memo, base.day(hideFakes(view), ctx));
    },
    night: (view, ctx) => base.night(hideFakes(view), ctx),
  };
}

// --- the bots ----------------------------------------------------------------------------------------------------------
// The bots that keep a memory and counter-hit: the hustler and the robbers, the crews' usual targets.
const COUNTERS = ['hustle', 'scout', 'guess'];

// A piece the bot has listed at the fence stays in its stash until it sells, but it can't wear it, hand it over or put
// it up anywhere else (GAP gap.listed), so a bot plans with the rest of its pieces, as its own listings show them.
function unlisted(v) {
  const listed = new Set(((v.me && v.me.fence) || []).filter(d => d.kind === 'listing' && d.role === 'seller').map(d => d.copy));
  return listed.size ? { ...v, me: { ...v.me, pieces: v.me.pieces.filter(p => !listed.has(p.copy)) } } : v;
}

// R4-2 (GAME.md §8, GAP gap.accept): a back joins a group only if its leader accepted it before the lock; a play with
// no list accepts its crewmates. Every bot, in every cast, accepts from its own view its crew and whoever it arranged a
// back with tonight: the agents that promised it in a sit-down to back it tonight (its hired muscle, a crew's mates),
// the Cops its police plan puts in a collar it leads (policePlan, read off public facts), and each taker its record
// shows it wrote a SUDO play for today (a bodyguard). Its crewmates come first, then the rest in the order the
// arrangements were made. A play names its list only when someone outside its crew is on it, so a play that needs
// only its crew is as it was; on a night a crash or a withdrawal forces the default play, it sends that play with its
// list. A turn its target never arranged (the snake's switch) is accepted by nobody.
export function acceptFor(v, cfg, play) {
  if (!play || play.kind === 'back' || !v.me) return play;
  const me = v.me;
  const crew = (v.board.crews.find(c => c.id === me.crew) || { members: [] }).members.filter(x => x !== me.id);
  const promised = me.promises.filter(p => p.what === 'back' && p.who === me.id && p.by !== me.id && p.night === v.day).map(p => p.by);
  const wrote = v.events.filter(e => e.type === 'write' && e.by === me.id && e.day === v.day && e.play && e.play.kind === 'back' && e.play.target === me.id).map(e => e.agent);
  const plan = play.kind === 'collar' && cfg.every ? policePlan(v, !!cfg.drugs) : null;
  const collar = plan && plan.lead === me.id && plan.target === play.target ? plan.group.filter(x => x !== me.id) : [];
  const outside = [...promised, ...wrote, ...collar].filter(x => !crew.includes(x));
  if (!outside.length) return play;
  // A leader whose crash or withdrawal forces the default play tonight (§11: its menu holds that one play) sends it,
  // naming whom it accepts, so the backers it arranged still guard it.
  const forced = me.crash || me.hooked.some(d => !me.high.includes(d));
  const own = forced && v.legal.length === 1 && v.legal[0].kind !== 'back' ? { ...v.legal[0] } : play;
  return { ...own, accept: [...new Set([...crew, ...outside])] };
}

// `memo` is what the bot remembers between calls; the runner saves it in every checkpoint and hands it back on a
// resume. In the layer3 cast (L3-5a) a seat plays the drugs on top of its own errands (drugDay), from the view a seat on
// FIREWALL has (walled), and keeps each dawn's memory for CLEAR to go back to (dawnMemo, forgetDay); and (L3-5b) the
// tricks after them (trickDay), with what it remembers for them read first, so a rat's TRUTH and night know (noteTricks).
// In the layer4 cast (L4-4) that bot plays the big score as well (scoreBot). R4-2: every bot's play names whom it
// accepts (acceptFor). R4-5: a canny seat plays from its view with what it started the season with (remembered).
export function makeBot(cfg, memo = {}) {
  const bot = castBot(cfg, memo);
  const seen = view => (cfg.canny ? remembered(view, memo) : view);
  return {
    ...bot,
    // R4-3: a sit-down lasts, and the city's market fills the day's orders at the lock (dayTalk, withMax, withDue).
    // R4-5: a canny bot reads its view through its own memory first (seen).
    day(view, ctx) {
      // R5-deals: what it pays in this call (payOwed), a deal at a time; the next call reads it off the record.
      memo.paying = [];
      const t = dayTalk(seen(view), cfg, memo);
      return [...t.errands, ...withMax(t.view, bot.day(t.view, ctx))];
    },
    night(view, ctx) {
      const r = bot.night(withDue(seen(view)), ctx);
      return r && r.play ? { ...r, play: acceptFor(view, cfg, r.play) } : r;
    },
  };
}

// --- R4-3: the daytime (trunk docs/briefs/R4-astra-fixes.md, task 3; GAME.md §9, §14) --------------------------------
// A sit-down now stays open sitdownDays days, and the city's shop and buyer fill the day's orders together at the lock.
// The bots adapt only as far as the rules need, from their own view.

// A bot does its talking within a day, but a deal can outlast it: an order of goods made after its seller's last turn.
// So each round a bot looks at its sit-downs from earlier days, read off its own view and memory, and closes each once
// the deal in it is done or dead (closing uses no message):
// - a seller hands over what an order there asks, or says it has none, as its trade's deliverGoods does in a day, and
//   the deal is done;
// - a buyer keeps one open while its own order there still waits for the goods, and the order lives as long as the
//   sit-down does (noteStreet lets an order lapse with its day);
// - R5-deals: and one whose deal (rules/deals.mjs, read off its view) is still pending for it (pendingDeal): its order
//   of any kind there waits (a gun, a drug, a warrant, a lockpick or a piece lives as long as its sit-down, as goods
//   do), or its own offer waits for an order, or an order there its day can fill waits for it;
// - every other one is done or dead: an ask nobody answered, tonight's muscle or job, talk with no trade in it, a deal
//   something was handed over against (what's owed needs no sit-down: the deal goes on until it settles), or one either
//   side said it has none in; and on the last day every one, since nobody works the last night.
// It plays the rest of the day on the view without the sit-downs it closed, less what it handed over.
export function dayTalk(view, cfg = {}, memo = {}) {
  const me = view.me;
  if (view.over || !me) return { errands: [], view };
  const stale = me.sitdowns.filter(sd => sd.day < view.day && sd.state !== 'declined');
  if (!stale.length) return { errands: [], view };
  const errands = [];
  let msgs = me.messagesLeft;
  const t = STREET_TYPES.includes(cfg.type) ? cfg : cfg.works ? asTrade(cfg) : null;
  const working = view.day < N.nights;
  if (working && t && sellsOf(t) && sellsOf(t).length && !me.jail) {
    for (const k of ['delivered', 'sold', 'held']) memo[k] ||= {};
    const d = deliverGoods({ ...view, me: { ...me, sitdowns: stale } }, t, memo, asDoses(me.goods), msgs);
    errands.push(...d.out);
    msgs = d.msgs;
  }
  const refused = sd => sd.said.some(m => m.from === sd.with && m.say === 'answer' && isBuy(m.terms) && !m.terms.goods);
  const waits = stale.filter(sd => working && sd.state === 'open' && memo.orders && memo.orders[sd.id] && !refused(sd));
  for (const sd of waits) memo.orders[sd.id].day = view.day;
  const pending = new Set(stale.filter(sd => working && pendingDeal(view, sd, t, memo)).map(sd => sd.id));
  const gone = new Set(stale.filter(sd => !waits.includes(sd) && !pending.has(sd.id)).map(sd => sd.id));
  errands.push(...[...gone].map(id => ({ kind: 'close', sitdown: id })));
  const goods = { ...me.goods };
  for (const e of errands) if (e.kind === 'give' && e.goods) for (const [k, n] of Object.entries(e.goods)) goods[k] -= n;
  for (const k of Object.keys(goods)) if (!goods[k]) delete goods[k];
  return { errands, view: { ...view, me: { ...me, goods, messagesLeft: msgs, sitdowns: me.sitdowns.filter(sd => !gone.has(sd.id)) } } };
}

// R5-deals: whether a sit-down from an earlier day holds a deal still pending for this bot (dayTalk), read off its own
// view (the sit-down's deal, rules/deals.mjs) and memory: open, with nothing handed over against its deal, its seller
// never having said it has none and its own day not having served it (memo.delivered, memo.served), and the bot
// still with a part to play there:
// - its own order there waits for the goods, or (a buyer whose order is still to come) it has an order or an ask with
//   that seller in its memory (buysFrom);
// - its own offer there waits for an order, while it still holds some of the goods (it stated it today, at the latest);
// - an order there waits for it that its trade fills and it holds goods for (serves): its day fills it.
// `t`: its trade's config (dayTalk's), or null for a seat that works none.
function pendingDeal(v, sd, t, memo) {
  if (sd.state !== 'open' || (memo.delivered && memo.delivered[sd.id]) || (memo.served && memo.served[sd.id])) return false;
  if (memo.stated && memo.stated[sd.id] === v.day) return true;
  const d = dealIn(v, sd);
  if (!d) return buysFrom(memo, sd) || heldAsk(v, memo, sd);
  if (!untouched(d) || saidNone(sd, d.role === 'seller' ? v.me.id : sd.with)) return false;
  if (d.role === 'buyer') return d.stated === 'me' || buysFrom(memo, sd) || heldAsk(v, memo, sd);
  return holdsFor(v, d) && (d.stated === 'me' || (!!t && serves(t.type, d)));
}
// Whether a bot buyer's memory has an order or an ask out in this sit-down (orderSd's): goods, a gun, a drug, a warrant,
// a lockpick or a piece.
function buysFrom(memo, sd) {
  const mine = (o, id = o.with) => sd.with === id && (o.sitdown ? o.sitdown === sd.id : o.day === sd.day && sd.asked === 'me');
  const live = [memo.gunOrder, memo.drugBuy && !memo.drugBuy.got ? memo.drugBuy : null, memo.wOrder, memo.wAsk, memo.pickOrder];
  return live.some(o => o && mine(o)) || !!(memo.orders && memo.orders[sd.id]) || !!(memo.pieceBuy && mine(memo.pieceBuy, memo.pieceBuy.from));
}
// It holds some of what a deal names (a SUDO passes for TEMP, §11), or its piece.
const holdsFor = (v, d) => (d.piece ? v.me.pieces.some(p => p.copy === d.piece || p.trait === d.piece)
  : Object.keys(d.goods).some(k => (v.me.goods[k] || 0) > 0 || (k === 'temp' && (v.me.goods.sudo || 0) > 0)));
// The goods each trade's day hands over to an order (deliverGoods, sellDrugs, sellGuns with sellPick, sellWarrants).
const SERVES = { smuggler: ['chems', 'parts'], chemist: DRUGS, gunrunner: ['guns', 'lockpicks', 'warrants'] };
const serves = (trade, d) => !d.piece && Object.keys(d.goods).every(k => (SERVES[trade] || []).includes(k));

// The shop's price for `units` more, read off the board's price for the next one (§9: each unit shopRise percent more),
// rounded up and a dollar more a unit, so it is never under the rules' own (a bot can't see the curve's step).
const shopRun = (price, units) => Array.from({ length: units }, (_, i) => Math.ceil(price * (1 + N.shopRise / 100) ** i) + 1).reduce((t, x) => t + x, 0);

// A shop order names the most it pays, held until the lock (gap.marketOrder). A bot buys only what its own checks found
// it could afford with tonight's rent kept back, and tonight's play may count on it, so it puts up the cash its other
// errands leave it, less that rent: the order fills at the day's price unless that is more than it put up, and what it
// doesn't spend comes back at the lock. The rent is due at dawn from its cash (§10) when it isn't in jail and has a
// home, or pays its way home with these errands. R4-4's follow-up: it put up the rent too, so a day busier than it
// reckoned left it short at dawn, evicted after its cook (the trades cast's seed 406-A). An order whose max can't cover
// its units even at the board's price alone (shopRun) is left out, as one the bot can't afford.
function withMax(v, errands) {
  if (!errands.some(e => e.kind === 'shop' && e.max == null)) return errands;
  const rentDue = !v.me.jail && (!v.me.evicted || errands.some(e => e.kind === 'rent'));
  let spare = cashLeft(v, errands.filter(e => e.kind !== 'shop')) - (rentDue ? N.rent : 0);
  return errands.flatMap(e => {
    if (e.kind !== 'shop' || e.max != null) return [e];
    const max = Math.max(0, spare);
    if (max < shopRun(v.board.market.shop[e.item] || 0, e.units == null ? 1 : e.units)) return [];
    spare -= max;
    return [{ ...e, max }];
  });
}

// How busy a bot reckons the city's market may be tonight (a bot setting, not a game number). It can't see anyone
// else's orders, so it reckons the day's units on a curve are BUSY times its own, every unit at the day's one price.
export const BUSY = 2;

// What `units` more of an item fetch at the city's buyer at the lock, after `sold` of its own today, reckoned on a busy
// day: its share of the day's average over BUSY times its own units.
export function busySale(price, sold, units) {
  const all = t => Math.floor(Array.from({ length: BUSY * t }, (_, i) => unitPrice(price, i)).reduce((x, y) => x + y, 0) / BUSY);
  return all(sold + units) - all(sold);
}

// What a bot's own orders bring at tonight's lock, before the plays lock, as it plans tonight. It reckons on a busy day,
// so a plan that counts on them keeps a margin for the rent:
// - a shop order brings its goods only when its max covers its units' share of a busy day, and what that leaves of the
//   max; one it can't be sure of brings nothing, and tonight's play is planned on the goods it holds;
// - a sale brings what its units fetch on a busy day (busySale).
export function withDue(view) {
  const me = view.me;
  if (!me || !me.orders || !me.orders.length) return view;
  const goods = { ...me.goods };
  let cash = me.cash;
  const sold = {};
  for (const o of me.orders) {
    if (o.side === 'shop') {
      const cost = Math.ceil(shopRun(view.board.market.shop[o.item] || 0, BUSY * o.units) / BUSY);
      if (o.max < cost) continue;
      goods[o.item] = (goods[o.item] || 0) + o.units;
      cash += o.max - cost;
      continue;
    }
    cash += busySale(view.board.market.buyer[o.item] || 0, sold[o.item] || 0, o.units);
    sold[o.item] = (sold[o.item] || 0) + o.units;
  }
  return { ...view, me: { ...me, goods, cash } };
}

function castBot(cfg, memo) {
  const bot = seatBot(cfg, memo);
  if (!cfg.drugs) return bot;
  const drugged = {
    cfg,
    memo,
    day(view, ctx) {
      if (view.over) return [];
      dawnMemo(memo, view.day);
      const v = walled(view);
      noteTricks(v, memo, cfg);
      return trickDay(unlisted(v), ctx, cfg, memo, drugDay(unlisted(v), ctx, cfg, memo, bot.day(keepDose(v, cfg), ctx)));
    },
    night(view, ctx) {
      noteTricks(view, memo, cfg);
      return bot.night(view, ctx);
    },
  };
  return cfg.score ? scoreBot(cfg, memo, drugged) : drugged;
}

function seatBot(cfg, memo) {
  const board = { kind: 'board', place: cfg.route };
  return {
    cfg,
    memo,
    day(view, ctx) {
      if (view.over) return [];
      let v = unlisted(view);
      if (STREET_TYPES.includes(cfg.type)) return streetDay(v, ctx, cfg, memo);
      // A seat that works a trade pays for the goods that arrived first, and its strategy plans with the rest.
      const debts = cfg.works ? settleFirst(v, memo, cfg) : [];
      if (debts.length) v = { ...v, me: { ...v.me, cash: v.me.cash - debts.reduce((t, e) => t + e.amount, 0) } };
      const r = ctx.rng;
      const me = v.me;
      const errands = [];
      if (COUNTERS.includes(cfg.type)) remember(v, memo);
      if (cfg.type === 'hustle') {
        errands.push(...upkeep(v, cfg.layer === 2 ? streetFit(v, { place: hustlePlace(v, cfg) }) : dressBest(v), true, cfg));
        if (cfg.layer === 2) errands.push(...fenceDay(v, ctx, errands, [], [], memo, cfg));
        const budget = me.cash - 60;
        // L2-6d: on the list's last day a hustler in the trades cast spends down instead (spendDown).
        if (closing(v, cfg)) errands.push(...spendDown(v, ctx, cashLeft(v, errands) - stillNeeds(v, ctx, cfg, memo), errands, cfg));
        else if (ctx.round === 1 && !me.jail && cfg.layer === 2) errands.push(...listBuy(v, ctx, budget));
        else if (ctx.round === 1 && !me.jail && openToBuy(v, budget).length) errands.push(offerFor(r, cheapPick(r, openToBuy(v, budget)), budget));
        errands.push(...muscleReplies(v, cfg));
      } else if (cfg.type === 'squatter') {
        // The eviction exploit: it never pays the rent back and puts the savings into rares, which it never wears (it
        // would wear commons, but buys none), so they stay in the bag.
        errands.push(...upkeep(v, dressBest(v, [], p => p.tier === 'common'), false));
        const budget = me.cash - 20;
        if (ctx.round === 1 && !me.jail) {
          const rares = openToBuy(v, budget).filter(t => RANK[t.tier] >= 1);
          if (rares.length) errands.push(offerFor(r, cheapPick(r, rares), budget));
        }
      } else if (cfg.type === 'buylate') {
        errands.push(...upkeep(v, {}, true, cfg));
        // It bids out of the cash its upkeep leaves it: a bail it pays itself out with, or its rent, is gone already.
        const budget = cashAfter(v, errands) - 40 - lateReserve(v, cfg);
        if (cfg.layer === 2) errands.push(...fenceDay(v, ctx, errands, [], [], memo, cfg));
        if (ctx.round === 1 && (v.day === 11 || v.day === 12)) {
          const buy = openToBuy(v, budget).sort((x, y) => RANK[y.tier] - RANK[x.tier] || y.price - x.price)[0];
          // Layer 2: a bargain at the fence at least as rare as the list's best it can afford comes first.
          const bargain = cfg.layer === 2 ? fenceBargain(v, ctx, budget, buy ? RANK[buy.tier] : 0) : null;
          if (bargain) errands.push({ kind: 'fence_buy', deal: bargain.deal });
          else if (buy) errands.push(offerFor(r, buy, budget));
        }
        // A seat that works a trade answers as muscle after its trade has had its say (tradeDay).
        if (!cfg.works) errands.push(...muscleReplies(v, cfg));
      } else if (cfg.type === 'turtle') {
        errands.push(...upkeep(v, {}, true, cfg));
        const budget = me.cash - 40 - lateReserve(v, cfg);
        const hasRare = me.pieces.some(p => RANK[p.tier] >= 1);
        if (cfg.layer === 2) errands.push(...fenceDay(v, ctx, errands, [], [], memo, cfg));
        if (ctx.round === 1 && !hasRare) {
          // Layer 2: a rare going cheap at the fence comes first.
          const bargain = cfg.layer === 2 ? fenceBargain(v, ctx, budget, 1) : null;
          const rares = openToBuy(v, budget).filter(t => RANK[t.tier] >= 1);
          if (bargain) errands.push({ kind: 'fence_buy', deal: bargain.deal });
          else if (rares.length) errands.push(offerFor(r, cheapPick(r, rares), budget));
        }
        if (!cfg.works) errands.push(...muscleReplies(v, cfg));
      } else if (cfg.type === 'scout' || cfg.type === 'guess') {
        errands.push(...upkeep(v, dressOnly(v, ROBBER_KIT), true, cfg));
        const paid = payMuscle(v, ctx);
        errands.push(...paid);
        const cash = me.cash - paid.reduce((t, e) => t + e.amount, 0);
        const budget = cash - 40 - lateReserve(v, cfg) - (cfg.sharp ? gunHold(v, cfg) : 0);
        let spent = 0;
        if (ctx.round === 1) {
          // R3's crime cast: until it can win alone (a gun or brass knuckles), the knuckles come before the rest of the
          // kit, and its cash goes to a gun.
          const kit = openToBuy(v, budget).filter(t => ROBBER_KIT.includes(t.ability) && !me.pieces.some(p => p.ability === t.ability)
            && (!cfg.sharp || ownPower(v) >= 2 || t.ability === 'knuckles'));
          if (kit.length) errands.push(offerFor(r, pick(r, kit), budget));
          else if (v.day >= 11 && openToBuy(v, budget).length) {
            const buy = openToBuy(v, budget).sort((x, y) => RANK[y.tier] - RANK[x.tier] || x.price - y.price)[0];
            errands.push(offerFor(r, buy, budget));
          }
          spent = errands.filter(e => e.kind === 'offer').reduce((t, e) => t + e.amount, 0);
        }
        // Layer 2: a gun if it can spare the price, and yesterday's loot to the city's buyer.
        const skip = new Set();
        if (cfg.layer === 2) {
          const g = gunErrands(v, ctx, memo, cash - spent, cfg);
          // L3-5a: a robber keeps its doses for its own reasons (takeDrugs); on the last day they go (sellDoses).
          errands.push(...g.out, ...sellLoot(v, ctx, [...(cfg.works ? tradeGoods(cfg.trade) : []), ...(cfg.drugs ? ['doses'] : [])]));
          spent = cash - g.cash;
          if (memo.gunOrder) skip.add(memo.gunOrder.with);
          // R4-5, the canny cast: a lockpick for a break-in that needs one (pickErrands).
          if (cfg.canny) {
            const k = pickErrands(withAsks(v, errands), ctx, cfg, memo, cash - spent, me.messagesLeft - talked(errands));
            errands.push(...k.out);
            spent = cash - k.cash;
            if (memo.pickOrder) skip.add(memo.pickOrder.with);
          }
          // A seat that works a trade offers no muscle deal in a sit-down it asked for about goods today.
          if (cfg.works && memo.tradeAsked && memo.tradeAsked.day === v.day) for (const id of memo.tradeAsked.ids) skip.add(id);
          // What it took and won't wear goes to the fence.
          noteTakes(v, memo);
          errands.push(...fenceDay(v, ctx, errands, memo.taken, [], memo, cfg));
        }
        errands.push(...hireMuscle(cfg.works ? withAsks(v, errands) : v, ctx, cfg, cash - spent, skip));
      } else if (cfg.type === 'crew') {
        const crew = crewDay(v, ctx, cfg, memo);
        errands.push(...crew);
        // Layer 2: a gun for each member, out of what it kept back; the leader sells the crew's loot.
        if (cfg.layer === 2) {
          // A seat that works a trade asks no crewmate about a gun on a job day: those sit-downs are the job's.
          // R3-6, the canny cast: a crew's sit-downs are its jobs' on any day, so a gun is asked of no crewmate.
          const also = cfg.works && cfg.canny ? cfg.mates : cfg.works && jobDay(v.day) ? (cfg.role === 'leader' ? cfg.mates : [cfg.leader]) : [];
          // R3-6, the canny cast: a leader's gun leaves alone the cuts it has promised today (cutsOwed, cutsSaid).
          const cuts = cfg.canny && cfg.role === 'leader' ? cutsOwed(v) + cutsSaid(crew) : 0;
          errands.push(...gunErrands(cfg.works ? withAsks(v, crew, also) : v, ctx, memo, cashAfter(v, crew) - cuts, cfg).out);
          if (cfg.role === 'leader') errands.push(...sellLoot(v, ctx, cfg.works ? tradeGoods(cfg.trade) : []));
          // The fence: the leader's takes it won't wear, and now and then a swap with a crewmate.
          noteTakes(v, memo);
          errands.push(...fenceDay(v, ctx, errands, memo.taken, cfg.mates || [], memo, cfg));
        }
      }
      if (!cfg.works) return errands;
      const own = [...errands, ...tradeDay(v, ctx, cfg, memo, errands)];
      // L2-6d: as the list closes, what's left beyond what it still needs goes on what it wants (spendDown).
      // R3-6, the canny cast: it leaves alone the cash it promises this round too (its record's is in stillNeeds).
      if (closing(v, cfg)) own.push(...spendDown(v, ctx, cashLeft(v, own) - stillNeeds(v, ctx, cfg, memo) - (cfg.canny ? cutsSaid(own) : 0), own, cfg));
      return [...debts, ...own];
    },
    night(view, ctx) {
      const v = unlisted(view);
      const r = ctx.rng;
      const me = v.me;
      const lastNight = v.legal.some(p => p.kind === 'board');
      // R4-5, the canny cast: the route a seat walks to the dock, from what its view shows (lastRoute).
      const own = 1 + (armed(v) ? 1 : 0) + (me.high.includes('temp') ? 1 : 0);
      if (STREET_TYPES.includes(cfg.type)) return lastNight ? (cfg.canny ? boardBy(v, cfg, own) : { play: board, reason: `board through ${cfg.route}` }) : streetNight(v, ctx, cfg, memo);
      if (COUNTERS.includes(cfg.type)) remember(v, memo);
      if (cfg.type === 'crew') return crewNight(v, ctx, cfg, memo);
      // R4-5, the canny cast: a robber's hit on the walk, or the route it walks (cannyLastNight); the careless robber
      // reads nothing, as before.
      if (lastNight && cfg.canny && !cfg.careless) return cannyLastNight(v, ctx, cfg, memo);
      if (lastNight) {
        if ((cfg.type === 'scout' || cfg.type === 'guess') && !me.wanted && me.pieces.some(p => p.worn && p.ability === 'knuckles')) {
          const t = others(v).map(a => ({ a, w: fitWorth(v, a) })).sort((x, y) => y.w - x.w)[0];
          if (t && t.w > 0) return { play: { kind: 'hit', target: t.a.id, place: 'industrial' }, reason: 'the walk to the dock' };
        }
        return { play: board, reason: `board through ${cfg.route}` };
      }
      const hired = MUSCLE.includes(cfg.type) ? hiredPlay(v) : null;
      if (hired) return hired;
      // Night 1 with no cash: the squatter skips its hustle, so it can't pay at dawn and is evicted.
      if (cfg.type === 'squatter' && v.day === 1 && !me.evicted) return { play: { kind: 'laylow' }, reason: 'skip a hustle, skip compute' };
      const canLayLow = !me.evicted;
      if (cfg.type === 'turtle' && canLayLow && me.pieces.some(p => RANK[p.tier] >= 1)) return { play: { kind: 'laylow' }, reason: 'holding a rare: stay in' };
      // R3-2's skill test: the careless robber robs whenever it can win something, reading nothing (carelessPlay).
      if (cfg.careless) {
        const c = carelessPlay(v, r);
        if (c) return c;
        return cfg.works ? tradeNight(v, ctx, cfg, memo) : hustleNight(v, cfg);
      }
      if (cfg.type === 'scout' || cfg.type === 'guess') {
        if (me.heat >= 4) {
          if (canLayLow) return { play: { kind: 'laylow' }, reason: 'too hot' };
          return cfg.works ? tradeNight(v, ctx, cfg, memo) : hustleNight(v, cfg, 'too hot, no home');
        }
      }
      if (COUNTERS.includes(cfg.type)) {
        const c = counterHit(v, memo, rng(ctx.seed, 'counter', me.id, v.day), cfg.layer, crewSight(cfg));
        if (c) return c;
      }
      if (cfg.type === 'scout' || cfg.type === 'guess') {
        const muscle = backersPromised(v);
        // L3-5a: the hit it took TEMP for (tempPlan), or (L3-5b) bribed the cops for (bribePlan); with HALLU's leads it
        // gambles on them, broke or not.
        if (cfg.drugs && memo.plan && memo.plan.day === v.day && legalNow(v, memo.plan.play)) return { play: memo.plan.play, reason: memo.plan.reason };
        const leads = cfg.drugs ? leadValues(v) : null;
        // L4-4: the vault, holding a warrant, when its strength tonight beats the defence and the vault its best hit or
        // the crate; the hit it weighs draws from a stream of its own.
        if (cfg.score && me.goods.warrants && v.legal.some(l => l.kind === 'vault')) {
          const best = robberPlay(v, rng(ctx.seed, 'vault', me.id, v.day), cfg, 1 + muscle, true, leads);
          const vj = vaultJob(v, ownPower(v) + muscle + (me.high.includes('temp') ? 1 : 0), Math.max(best ? best.value : 0, v.board.crate ? crateWorth(v) : 0));
          if (vj) return { play: vj.play, reason: vj.reason };
        }
        if (cfg.sharp || me.cash >= DOSES.broke || muscle || leads) {
          const p = robberPlay(v, r, cfg, 1 + muscle, true, leads, cfg.sharp ? hustlePay(v) : 0);
          // Layer 2: the crate instead, if it's worth more and the robber's strength clears the docks' defence with
          // room for a rival (GRAB).
          if (cfg.layer === 2 && v.board.crate && v.legal.some(l => l.kind === 'grab')) {
            const temp = cfg.drugs && me.high.includes('temp') ? 1 : 0;
            const power = 1 + muscle + (me.pieces.some(x => x.worn && x.ability === 'knuckles') ? 1 : 0) + (armed(v) ? 1 : 0) + temp;
            const crate = crateWorth(v);
            const go = rng(ctx.seed, 'grab', me.id, v.day)() < GRAB.odds;
            const cool = !cfg.sharp || me.heat + 1 < N.wantedAt;
            if (go && cool && power >= grabDefence(v, memo, me.wanted) + GRAB.lone && crate > (p ? p.value : 0)) {
              return { play: { kind: 'grab', place: CRATE_AT }, reason: `grab the crate at the docks, worth about ${crate}` };
            }
          }
          if (p) return muscle ? { play: p.play, reason: `${p.reason}, with hired muscle` } : p;
        }
      }
      if (cfg.works) return tradeNight(v, ctx, cfg, memo);
      return hustleNight(v, cfg);
    },
  };
}

// --- the crew: pool cash, buy as one, run a job every third night, walk to the dock together ---------------------------
export const jobDay = day => day % 3 === 2 && day <= 13;
// The crew stash's cash once these errands go through.
const stashLeft = (stash, errands) => errands.reduce((c, e) => c + (e.kind === 'stash_put' && e.cash ? e.cash : 0) - (e.kind === 'stash_take' && e.cash ? e.cash : 0), stash.cash);

function crewDay(v, ctx, cfg, memo = {}) {
  const me = v.me;
  // R3-6, the canny cast: the leader keeps the mates it has walked on (noteWalked), every round it sees its record.
  if (cfg.canny && cfg.role === 'leader') noteWalked(v, memo);
  // R4-5, the canny cast: every member keeps its crew's record for the last split (noteCrew), every round.
  if (cfg.canny) noteCrew(v, memo);
  const errands = [...upkeep(v, dressOnly(v, ROBBER_KIT), true, cfg)];
  const stash = me.crewStash;
  if (ctx.round === 1) {
    if (cfg.role === 'leader' && v.day === 1 && !me.crew) {
      errands.push({ kind: 'crew_form', name: cfg.crewName });
      for (const m of cfg.mates) errands.push({ kind: 'crew_invite', agent: m });
      return errands;
    }
    if (!stash) return errands;
    // Pay the cut promised for a won job, unless this leader keeps the bag (§12 walk). In layer 2 a won grab is a job.
    // R3-6, the canny cast: the cuts it promised, for any won job (payCuts).
    if (cfg.role === 'leader' && cfg.canny) errands.push(...payCuts(v, ctx, cfg, errands));
    if (cfg.role === 'leader') {
      const job = e => e.type === 'rob' || e.type === 'burgle' || (cfg.layer === 2 && e.type === 'grab');
      const won = v.events.filter(e => job(e) && e.leader === me.id && e.night === v.day - 1);
      if (!cfg.canny && won.length && rng(ctx.seed, 'walk', me.id, v.day)() >= cfg.walk) {
        const owed = won[0].members.filter(x => x !== me.id);
        // One that works a trade counts the rent it pays back this morning, and pays as far as its cash goes (a cut
        // it can't pay stays owed: a walk, §12).
        const have = cfg.works ? cashAfter(v, errands) : me.cash;
        const short = CUT * owed.length - have;
        if (short > 0 && stash.cash >= short) errands.push({ kind: 'stash_take', cash: short });
        let left = have + (short > 0 && stash.cash >= short ? short : 0);
        for (const m of owed) {
          if (cfg.works && left < CUT) break;
          errands.push({ kind: 'pay', to: m, amount: CUT, for: 'cut' });
          left -= CUT;
        }
      }
      // R4-5, the canny cast: nothing goes into the stash on the day of the last split; what the leader holds goes aboard
      // with it.
      if (!(cfg.canny && v.day === N.nights)) for (const p of me.pieces) if (!p.worn) errands.push({ kind: 'stash_put', copy: p.copy });
    }
    // The snake empties the stash before the last split (§12 rug). L2-6d: what's left after a bail it took from it.
    if (cfg.snake && v.day === 13 && rng(ctx.seed, 'rug', me.id)() < cfg.rug) {
      for (const p of stash.pieces) errands.push({ kind: 'stash_take', copy: p.copy });
      if (stashLeft(stash, errands) > 0) errands.push({ kind: 'stash_take', cash: stashLeft(stash, errands) });
      return errands;
    }
    // R4-5, the canny cast: the last split by what each member put in and risked (lastSplit).
    if (cfg.canny && v.day === N.nights) return [...errands, ...lastSplit(v, memo, errands)];
    // Day 14: the last split. Everyone takes an even share of the cash; the pieces go aboard with the keeper.
    if (v.day === 14) {
      const share = Math.floor(stashLeft(stash, errands) / v.board.crews.find(c => c.id === me.crew).members.length);
      if (share > 0 && me.id !== stash.keeper) errands.push({ kind: 'stash_take', cash: share });
      return errands;
    }
    // Layer 2: until it's armed, a member keeps back what a gun costs too, out of the cash its errands so far leave it
    // (in the trades cast, not one that builds its own: buildsItsOwn); and one that works a trade keeps back a night's
    // goods for it (tradeReserve).
    const keep = 60 + (cfg.layer === 2 && !armed(v) && !buildsItsOwn(cfg) ? gunPrice(v) : 0) + (cfg.works ? tradeReserve(cfg, memo, v) : 0);
    const have = cfg.layer === 2 ? cashAfter(v, errands) : me.cash;
    if (have > keep) errands.push({ kind: 'stash_put', cash: have - keep });
    // R3-6, the canny cast: the leader asks the mates it brings on the night it calls a job (cannyCall), and a mate takes
    // its leader's ask as soon as it sees it, so the leader can say the job in the next round.
    if (cfg.role === 'leader' && (cfg.canny ? !!cannyCall(v, ctx, cfg, memo).play : jobDay(v.day))) for (const m of cfg.canny ? memo.call.mates : cfg.mates) errands.push({ kind: 'ask', to: m, line: JOB_LINE });
    if (cfg.canny && cfg.role !== 'leader') {
      for (const sd of me.sitdowns) if (sd.state === 'asked' && sd.asked === 'them' && sd.with === cfg.leader) errands.push({ kind: 'answer', sitdown: sd.id, accept: true });
    }
  }
  // R3-6, the canny cast: what the leader still owes of yesterday's cuts, as cash comes in through the day (payCuts).
  if (ctx.round > 1 && cfg.canny && cfg.role === 'leader' && stash) errands.push(...payCuts(v, ctx, cfg, errands));
  if (ctx.round === 2) {
    if (!me.crew && me.invitedTo.length) errands.push({ kind: 'crew_join', crew: me.invitedTo[0] });
    // A member that works a trade answers only the leader's ask on a job day: a crewmate's other asks are about goods.
    const crewAsk = sd => cfg.mates.includes(sd.with) && (cfg.canny ? sd.with === cfg.leader : !cfg.works || (sd.with === cfg.leader && jobDay(v.day)));
    for (const sd of me.sitdowns) if (sd.state === 'asked' && sd.asked === 'them' && crewAsk(sd)) errands.push({ kind: 'answer', sitdown: sd.id, accept: true });
    // The leader buys for the crew with pooled cash, keeping back (L4-4) a warrant it means to buy (warrantHold), and
    // never a trait it has already offered on today (§3: one offer per trait per night).
    if (cfg.role === 'leader' && stash && v.day <= 12) {
      const pooled = (cfg.canny ? stashLeft(stash, errands) : stash.cash) - (cfg.score ? warrantHold(v, memo) : 0);
      const buy = openToBuy(v, pooled).filter(t => RANK[t.tier] >= 1 && !me.offers.some(o => o.trait === t.trait)).sort((x, y) => RANK[y.tier] - RANK[x.tier] || x.price - y.price)[0];
      if (buy) {
        const o = offerFor(ctx.rng, buy, pooled);
        errands.push({ kind: 'stash_take', cash: o.amount }, o);
      }
    }
  }
  // R3-6, the canny cast: the job's words go in every crew sit-down as soon as it's open, in round 2 or 3, once each; the
  // leader's cut is an even share of what the job looks worth (cutFor).
  if (cfg.canny ? ctx.round >= 2 && crewCalled(v, cfg) : ctx.round === 3 && jobDay(v.day)) {
    // Its crewmates' sit-downs (in layer 2 it may also be in one about a gun).
    const open = me.sitdowns.filter(sd => sd.state === 'open' && (cfg.layer !== 2 || cfg.mates.includes(sd.with)) && !(cfg.canny && sd.said.some(m => m.from === me.id)));
    // An honest leader only promises a cut it could pay out of its cash and the stash.
    const cut = cfg.canny && cfg.role === 'leader' ? cutFor(v, memo, errands) : CUT;
    const canPay = cfg.canny ? cut >= CUT : (me.cash + (stash ? stash.cash : 0)) >= CUT * open.length;
    for (const sd of open) {
      if (cfg.role === 'leader') {
        if (canPay) errands.push({ kind: 'say', sitdown: sd.id, say: 'promise', terms: { what: 'pay', who: sd.with, cash: cut, night: v.day }, line: cfg.canny ? `job tonight, your cut is ${cut}` : 'job tonight, your cut is twenty' });
        else errands.push({ kind: 'say', sitdown: sd.id, say: 'offer', terms: { what: 'back', who: me.id, night: v.day }, line: 'job tonight' });
      } else if (sd.with === cfg.leader) {
        errands.push({ kind: 'say', sitdown: sd.id, say: 'promise', terms: { what: 'back', who: cfg.leader, night: v.day }, line: "I've got your back" });
      }
    }
  }
  return errands;
}

function crewNight(v, ctx, cfg, memo = {}) {
  const me = v.me;
  const lastNight = v.legal.some(p => p.kind === 'board');
  const leaderFree = v.board.agents.some(a => a.id === cfg.leader && !a.jailed);
  if (lastNight) {
    // L4-4: its leader, holding a warrant, jobs the vault on the way to the boat when its crew beats the defence (no
    // guard works the last night), then boards from Glasswall. Its crew walks with it, as ever.
    const vj = cfg.score && cfg.role === 'leader' && me.goods.warrants && v.legal.some(l => l.kind === 'vault') ? vaultJob(v, crewPower(v, cfg), 0, 0, true) : null;
    if (vj) return { play: vj.play, reason: `${vj.reason}, then run for the boat` };
    // R4-5, the canny cast: the leader's hit on the walk, with its crew, or the route it walks (cannyCrewWalk).
    if (cfg.canny && (cfg.role === 'leader' || !leaderFree)) return cannyCrewWalk(v, ctx, cfg, memo);
    if (cfg.role === 'leader' || !leaderFree) return { play: { kind: 'board', place: cfg.route }, reason: 'to the dock' };
    return { play: { kind: 'back', target: cfg.leader }, reason: 'walk with the crew' };
  }
  // R3-6, the canny cast: a job night is one its leader called (crewCalled), and its job the leader's at the lock
  // (cannyNightJob).
  if (cfg.canny ? crewCalled(v, cfg) : jobDay(v.day)) {
    const freeMates = cfg.mates.filter(m => v.board.agents.some(a => a.id === m && !a.jailed)).length;
    if (cfg.role === 'leader') {
      const job = cfg.canny ? cannyNightJob(v, ctx, cfg, memo) : crewJob(v, ctx.rng, cfg, memo);
      if (job) return { play: job.play, reason: job.reason };
    } else if (leaderFree && !sitsOut(v, cfg, memo)) {
      // The snake sometimes backs the other side (§12 turn): it backs its guess at the leader's target instead.
      if (cfg.snake && rng(ctx.seed, 'turn', me.id, v.day)() < cfg.turn) {
        const t = robberPlay(v, ctx.rng, { type: 'scout', layer: cfg.layer, drugs: cfg.drugs, ...(cfg.sharp ? { sharp: true } : {}) }, 1 + freeMates);
        if (t) return { play: { kind: 'back', target: t.play.target }, reason: 'switched sides' };
      }
      return { play: { kind: 'back', target: cfg.leader }, reason: 'crew job' };
    }
  }
  if (cfg.works) return tradeNight(v, ctx, cfg, memo);
  return hustleNight(v, cfg);
}

// The crew's job tonight as its leader picks it (`r`: the leader's draws, or a crewmate's guessing it, L3-5b's rat):
// the best target the whole crew can reach; or, in layer 2, the crate when it's worth at least that and the crew's
// strength clears the docks' defence with room for a rival (GRAB.crew), since shipment nights fall on job nights; or,
// in the layer4 cast, the vault, when its leader holds a warrant and the vault beats that job (vaultJob).
// { play, reason, value }, or null.
function crewJob(v, r, cfg, memo) {
  const me = v.me;
  const freeMates = cfg.mates.filter(m => v.board.agents.some(a => a.id === m && !a.jailed)).length;
  const p = robberPlay(v, r, { type: 'scout', layer: cfg.layer, drugs: cfg.drugs, ...(cfg.sharp ? { sharp: true } : {}) }, 1 + freeMates);
  let job = p ? { play: p.play, reason: `crew job: ${p.reason}`, value: p.value } : null;
  if (cfg.layer === 2 && v.board.crate && v.legal.some(l => l.kind === 'grab')) {
    const wanted = v.board.agents.some(a => (a.id === me.id || cfg.mates.includes(a.id)) && !a.jailed && a.wanted);
    const power = 1 + freeMates + (armed(v) ? 1 : 0) + (me.pieces.some(x => x.worn && x.ability === 'knuckles') ? 1 : 0);
    const crate = crateWorth(v);
    if (power > grabDefence(v, memo, wanted) + GRAB.crew && crate >= (p ? p.value : 0)) {
      job = { play: { kind: 'grab', place: CRATE_AT }, reason: `crew job: grab the crate, worth about ${crate}`, value: crate };
    }
  }
  const vault = cfg.score && cfg.role === 'leader' && me.goods.warrants && v.legal.some(l => l.kind === 'vault') ? vaultJob(v, crewPower(v, cfg), job ? job.value : 0) : null;
  return vault ? { ...vault, reason: `crew job: ${vault.reason}` } : job;
}

// --- R3-6: the traders' habits, in the canny cast (trunk docs/briefs/R3-crime-pays.md, task 7) ------------------------
// R3-5 (core/reports/R3/TRADES.md) found the trades' nights wasted by habits no sensible trader has: a buyer never asks a
// seller; a Smuggler runs every night whatever its goods fetch; a Chemist cooks whatever its Dealers take and dumps the
// rest at the city's buyer; every cook gives way to a hustle on night 1; a Dealer works a hot corner into its own collar;
// and crews strike on a fixed clock that sends both of them into the patrolled crate. In the canny cast (`cfg.canny`:
// the crime cast's seats, roles and habits, and these) every seat plays them from its own view (the agent view, and what
// it remembers of its own earlier views) and nothing else; every other cast keeps its bots as they were.
// - Supply (§9, §10, §14). A buyer short of a night's goods asks, in the day's first round, a seller its view shows
//   holding some (askSellers), and orders in that sit-down once it opens (orderGoods). A seller takes a buyer's ask and
//   says what it can sell there (takeAsks), hands over what's ordered in either side's sit-down (deliverGoods), and asks
//   the buyers its view shows short of goods first, not buyers at random (askBuyers).
// - Work to demand (§9). Its own record and the board tell a seller what its buyers take a day (cannyDaily: what it
//   handed agents and what they asked it for that it didn't have, and at least its share of what the board's buyers use
//   a night), and it works to hold what they'll take over the next CANNY.days days (cannyDemand), no more. A Smuggler
//   runs only when the haul, sold to its buyers at the agents' price as far as they take it and to the city's buyer for
//   the rest, pays more than the hustle it skips, at the drop the show says it'll have to itself (dropsFor, cannyRun). A
//   Chemist cooks the batches its buyers will take, only when they pay more than a hustle, and orders the chems for them
//   only (cannyBatches). No run or cook counts on a buyer who can't use its goods before the season ends (usefulTo). A
//   buyer orders against what its buyers owe it and its own stock will bring today (counted). A seller keeps what its
//   buyers are still taking, rather than dump it at the city's buyer after STREET.slow days unsold (keepFor).
// - Rent (§10). A cook that pays more than a hustle goes ahead on a night its cash won't cover the rent: it runs a night's
//   tab (gap.rentTab) and pays the rent from the doses' sale, unless it holds a rare-or-better piece, which an evicted
//   agent carries where a hit can take it. A build still gives way to a hustle: a gun sells days later, if at all.
// - Corners (§7, §9, §13). A Dealer works a corner only when tonight's star (a hot corner, or a district a patrol is
//   likely in) keeps it under wanted (cannyWorks). A corner its holder won't work tonight is open to the next Dealer in
//   the pecking order: one it can't, or one of several it holds that it leaves for its best (cannyChoice); and a Dealer
//   on a normal corner moves up to an open hot one its heat allows (cornerByOrder).
// - Crews (§8, §9, §12, §13). A crew's leader calls a job on any night its view shows one its crew can win (it reads the
//   defence as the crime cast's robbers do) worth more than the night of work it costs everyone in it, bringing the mates
//   no star would make wanted (cannyCall). At the crate it counts the Cops at work, who patrol the docks on a shipment
//   night, and the other crew, which grabs too when it's strong enough: two groups and a patrol at the docks is where
//   R3-5's crews were arrested (cannyGrab); and a weaker crew leaves the home the stronger one would break into (yields).
//   It promises each mate an even share of what the job looks worth, never less than CUT, and pays it once the job has
//   won (payCuts). A mate backs it on a night it was asked (crewCalled).
// Bot settings, not game numbers. `days`: the days of its own record a seller reads its buyers' demand from, and the days
// of their demand it works to hold: two, as a night's goods sell over the next two days (STREET.slow); `first`: what a
// buyer of each kind uses a night, which a seller counts on at least, shared among the sellers of the kind: a Chemist
// two batches of chems, a Dealer a held corner's doses, a Gunrunner no parts (it builds a gun only once its last one
// sells, HABITS.unsold, and its kit holds its first gun's); `drops`: the order in which Smugglers with no drop of their
// own take the free ones, the chems' first, as the street runs on them.
export const CANNY = {
  days: 2,
  first: { chems: N.cook.batches * N.cook.chems, doses: N.deal.held, parts: 0 },
  drops: Object.keys(N.drops).sort((x, y) => Number(N.drops[x] !== 'chems') - Number(N.drops[y] !== 'chems') || (x < y ? -1 : 1)),
};
// The last day goods of a kind can still reach an agent who works them (§9, §15): chems and parts are bought by day
// N.nights - 2 for that night's cook or build, whose doses and guns sell the next day; doses are dealt by night
// N.nights - 1. Goods never board.
const usefulTo = kind => (kind === 'doses' ? N.nights - 1 : N.nights - 2);
// Where the show saw an agent last night (§6), or null.
const lastSeen = (v, id) => (v.sightings[id] || []).find(x => x.night === v.day - 1) || null;
// The goods of a kind on an agent's latest public holdings record (a day old, §19); a dose there is TEMP, the street's.
const recordHolds = (v, id, kind) => ((publicHoldings(v, id) || { goods: {} }).goods[kind === 'doses' ? 'temp' : kind] || 0);
// The goods of a kind an agent holds, as far as a player can tell: its latest public holdings record, and what last
// night's work brought it, by the show: a Smuggler seen at a drop of the kind gathered its share of that drop, and a
// Chemist seen at home or at the lab (Blackpine Woods) cooked a batch at least.
function stockSeen(v, id, kind) {
  const had = recordHolds(v, id, kind);
  const a = agentOf(v, id);
  const last = lastSeen(v, id);
  if (!a || !last) return had;
  if (a.trade === 'smuggler' && N.drops[last.place] === kind) {
    const there = v.board.agents.filter(x => x.trade === 'smuggler' && (lastSeen(v, x.id) || {}).place === last.place).length;
    return had + Math.floor(N.dropUnits / Math.max(1, there));
  }
  if (a.trade === 'chemist' && kind === 'doses' && (last.place === 'home' || last.place === 'forest')) return had + N.cook.doses;
  return had;
}
// A buyer that looks short of a night's goods (onHand): its latest public record shows less, or there's none yet.
const looksShort = (v, id, kind) => !publicHoldings(v, id) || recordHolds(v, id, kind) < onHand(kind);

// What a seller expects its buyers to take of a kind a day: what its own record shows they took (memo.outs) and asked it
// for that it didn't have (memo.unmet), a day over the last CANNY.days days; and at least its share of what the buyers on
// the board use a night (CANNY.first: a buyer's night of goods, shared among the free sellers of the kind).
function cannyDaily(v, memo, kind) {
  const got = (m, d) => ((memo[m] || {})[d] || {})[kind] || 0;
  const seen = Array.from({ length: CANNY.days }, (_, i) => v.day - i).reduce((t, d) => t + got('outs', d) + got('unmet', d), 0);
  const count = trade => v.board.agents.filter(a => a.trade === trade && freeAgent(a)).length;
  const sellers = count(SELLER_OF[kind]);
  return Math.max(seen / CANNY.days, sellers ? (count(BUYER_OF[kind]) * CANNY.first[kind]) / sellers : 0);
}
// What a seller expects to sell of a kind from tomorrow on: its daily demand for each day left that its buyers can use
// the goods (usefulTo), at most CANNY.days of them. It works to hold that much, no more.
const cannyDemand = (v, memo, kind) => Math.ceil(cannyDaily(v, memo, kind) * Math.max(0, Math.min(CANNY.days, usefulTo(kind) - v.day)));
// A seller's note of demand it couldn't meet today: `units` of a kind a buyer asked it for.
function noteUnmet(v, memo, kind, units) {
  if (!(units > 0)) return;
  const d = ((memo.unmet ||= {})[v.day] ||= {});
  d[kind] = (d[kind] || 0) + units;
}
// The cash a buyer in the canny cast counts on as it orders, beyond its own: what its buyers owe it for goods it handed
// over (the deal record's, owesMe), and what the goods it sells will bring today, as far as its buyers take them (cannyDaily); and,
// evicted, the rent it owes no dawn (gap.rentTab: the nights go on its tab).
function counted(v, cfg, memo) {
  const due = owesMe(v);
  const held = asDoses(v.me.goods);
  const selling = (sellsOf(cfg) || []).reduce((t, k) => t + Math.min(held[k] || 0, Math.ceil(cannyDaily(v, memo, k))) * STREET.unit, 0);
  return due + selling + (v.me.evicted ? N.rent : 0);
}
// What `units` more of a kind are worth to a seller: the agents' price for those its buyers will take beyond what it
// holds (cannyDemand), while they can still use them (`useful`); the city buyer's for the rest, every unit sold lowering
// its price (unitPrice), after what it already holds beyond its buyers' demand.
function haulWorth(v, memo, kind, units, useful) {
  const held = asDoses(v.me.goods)[kind] || 0;
  const demand = useful ? cannyDemand(v, memo, kind) : 0;
  const room = Math.max(0, demand - held);
  const over = Math.max(0, held - demand);
  const price = v.board.market.buyer[kind] || 0;
  let value = 0;
  for (let i = 0; i < units; i++) value += i < room ? STREET.unit : unitPrice(price, over + i - room);
  return value;
}
// What a seller keeps of a kind after STREET.slow days unsold: what its buyers take a day (cannyDaily), for every day
// left that they can use it, today's too.
const keepFor = (v, memo, kind) => Math.ceil(cannyDaily(v, memo, kind) * Math.max(0, usefulTo(kind) - v.day + 1));
// Why a seat that works a trade takes a hustle tonight, when its trade's work wouldn't pay (streetPlan's reason).
function idle(v, memo, why) {
  memo.idle = { day: v.day, why };
  return null;
}

// The buyer's ask: with `want` units of a kind short, in the day's first round, a sit-down with the seller its view
// shows holding most of it (stockSeen). Every buyer reads the same board, so they share the sellers out by its pecking
// order: the buyers of the kind that look short of a night's goods (looksShort; this one is), in id order, each take the
// seller with the most stock left, less a night's goods for each buyer before it. It asks its own, and the next one too
// when its own has less left than it wants. Never a crewmate (a crew's sit-downs are its jobs'), a guarded seat, or one
// it's in a sit-down with (`busy`) or asking (`asked`) today.
function askSellers(v, ctx, memo, kind, want, msgs, asked, busy) {
  const me = v.me;
  const out = [];
  if (ctx.round !== 1 || want < 1 || msgs < 1 || me.jail || v.day >= N.nights) return out;
  const sellers = v.board.agents.filter(a => a.trade === SELLER_OF[kind] && a.id !== me.id && freeAgent(a)).sort(byNum);
  if (!sellers.length) return out;
  const left = Object.fromEntries(sellers.map(a => [a.id, stockSeen(v, a.id, kind)]));
  const ranked = (skip = null) => sellers.filter(a => a !== skip).sort((x, y) => left[y.id] - left[x.id] || byNum(x, y));
  for (const b of v.board.agents.filter(a => a.trade === BUYER_OF[kind] && freeAgent(a) && a.id !== me.id && looksShort(v, a.id, kind)).sort(byNum)) {
    if (byNum(b, me) > 0) break;
    left[ranked()[0].id] -= onHand(kind);
  }
  const first = ranked()[0];
  const picks = left[first.id] < want ? [first, ranked(first)[0]].filter(Boolean) : [first];
  const mates = crewOf(v);
  // R9d: and one whose sit-down still lives, which it may yet order in (heldAsk).
  memo.asks = Object.fromEntries(Object.entries(memo.asks || {}).filter(([id, x]) => x.day === v.day || orderLives(v, x, id)));
  for (const a of picks) {
    if (msgs < 1 || guarded(v, a.id) || mates.has(a.id) || asked.has(a.id) || busy.has(a.id)) continue;
    out.push({ kind: 'ask', to: a.id, line: buyLine(kind, want, STREET.unit) });
    memo.asks[a.id] = { day: v.day, kind };
    msgs -= 1;
  }
  return out;
}
// The buyer's order in a sit-down it asked for, once the seller has taken it: what it still wants, up to what the
// seller said it can sell there and what its budget covers; nothing where the seller says it has none. R9d: on the ask's
// day, or once on a later one where the seller took it with words and no terms after the bot's last turn (heldAsk).
function orderAsked(v, memo, kind, want, budget, msgs) {
  const out = [];
  for (const sd of v.me.sitdowns) {
    const ask = (memo.asks || {})[sd.with];
    const held = heldAsk(v, memo, sd);
    if (sd.asked !== 'me' || sd.state !== 'open' || !ask || (ask.day !== v.day && !held) || ask.kind !== kind || memo.orders[sd.id] || sd.said.some(m => m.from === v.me.id)) continue;
    if (sd.said.some(m => m.from === sd.with && m.say === 'answer' && isBuy(m.terms) && !m.terms.goods)) continue;
    const said = sd.said.find(m => m.from === sd.with && m.say === 'offer' && ['sell', 'trade'].includes(whatOf(m.terms.what)) && m.terms.goods);
    const units = Math.min(want, said ? asDoses(said.terms.goods)[kind] || 0 : want, Math.floor(budget / STREET.unit));
    if (units < 1 || msgs < 1) continue;
    out.push({ kind: 'say', sitdown: sd.id, say: 'offer', terms: { what: BUY, goods: asTemp({ [kind]: units }), cash: units * STREET.unit } });
    memo.orders[sd.id] = { with: sd.with, kind, units, day: v.day };
    if (held) (memo.restated ||= {})[sd.id] = v.day;
    want -= units;
    budget -= units * STREET.unit;
    msgs -= 1;
  }
  return { out, msgs, want, budget };
}
// The seller's side of a buyer's ask (§14): it takes the sit-down and says what it can sell there, at the agents' price
// (STREET.unit): a night's goods of the kind that buyer works with, at most, of what it holds and hasn't offered another
// buyer today. Holding none, it says no, and notes the ask as demand. Not a crewmate's ask (a crew's sit-downs are its
// jobs'), a guarded seat's, nor one that owes it for more than two nights' goods. `goods`: what it holds once the day's
// errands so far go through.
function takeAsks(v, cfg, memo, goods, msgs) {
  const me = v.me;
  const out = [];
  memo.lots = Object.fromEntries(Object.entries(memo.lots || {}).filter(([id]) => me.sitdowns.some(sd => sd.id === id)));
  const mates = crewOf(v);
  for (const sd of me.sitdowns) {
    if (sd.asked !== 'them' || sd.state !== 'asked' || mates.has(sd.with) || guarded(v, sd.with) || msgs < 1) continue;
    const kind = BUYS[(agentOf(v, sd.with) || {}).trade];
    if (!kind || !sellsOf(cfg).includes(kind)) continue;
    const offered = Object.values(memo.lots).filter(x => x.kind === kind).reduce((t, x) => t + x.units, 0);
    const n = Math.min(onHand(kind), (goods[kind] || 0) - offered);
    if (n < 1 || owesMe(v, sd.with) > 2 * onHand(kind) * STREET.unit) {
      out.push({ kind: 'answer', sitdown: sd.id, accept: false });
      msgs -= 1;
      if (n < 1) noteUnmet(v, memo, kind, onHand(kind));
      continue;
    }
    out.push({ kind: 'answer', sitdown: sd.id, accept: true });
    memo.lots[sd.id] = { kind, units: n };
    msgs -= 1;
    if (msgs < 1) continue;
    // R5-deals: its quote is a seller's offer, typed so (rules/deals.mjs).
    out.push(sellOffer(sd, asTemp({ [kind]: n })));
    msgs -= 1;
  }
  return { out, msgs };
}

// The Smugglers' drops tonight, as every one of them reads them off the show (§6, §9): a drop the show saw
// Smuggler-trade seats at last night is kept by the lowest id of them; the others, in id order, take the drops nobody
// kept, in CANNY.drops' order. A wanted one lies low, so it isn't in the order. This seat's drop, alone ([{ drop, others:
// 0 }]); or, with none of its own, every drop and the Smugglers it would share it with.
function dropsFor(v) {
  const me = v.me;
  const runners = v.board.agents.filter(a => a.trade === 'smuggler' && freeAgent(a) && !a.wanted).sort(byNum);
  const kept = {};
  for (const d of CANNY.drops) {
    const k = runners.find(a => (lastSeen(v, a.id) || {}).place === d);
    if (k) kept[d] = k.id;
  }
  const own = CANNY.drops.find(d => kept[d] === me.id);
  if (own) return [{ drop: own, others: 0 }];
  const free = CANNY.drops.filter(d => !kept[d]);
  const i = runners.filter(a => !Object.values(kept).includes(a.id)).findIndex(a => a.id === me.id);
  if (i >= 0 && i < free.length) return [{ drop: free[i], others: 0 }];
  return CANNY.drops.map(d => ({ drop: d, others: 1 }));
}
// The run worth most tonight, { drop, kind, units, value }: its haul at the drop dropsFor gives it (its share there, and
// its work boots' unit), valued by haulWorth while the haul can still reach a buyer (usefulTo).
function cannyRun(v, memo) {
  const boots = v.me.pieces.some(p => p.worn && p.ability === 'workboots') ? N.workboots : 0;
  let best = null;
  for (const o of dropsFor(v)) {
    const kind = N.drops[o.drop];
    const units = Math.floor(N.dropUnits / (1 + o.others)) + boots;
    const value = haulWorth(v, memo, kind, units, v.day + 1 <= usefulTo(kind));
    if (!best || value > best.value) best = { ...o, kind, units, value };
  }
  return best;
}
// The batches a Chemist's buyers will take tonight: one for each N.cook.doses doses its record says they take beyond
// the TEMP it holds (a part batch rounds up), at most N.cook.batches; none on a night whose doses couldn't reach a
// Dealer before its last corner night (usefulTo).
function cannyBatches(v, memo) {
  if (v.day + 1 > usefulTo('doses')) return 0;
  const room = cannyDemand(v, memo, 'doses') - (asDoses(v.me.goods).doses || 0);
  return room > 0 ? Math.min(N.cook.batches, Math.ceil(room / N.cook.doses)) : 0;
}

// A corner a Dealer can work tonight and stay under wanted (§13), by public facts: its heat on the board, and the star
// dealing there adds (§7): a hot corner, or a district a patrol is likely in, the docks with a crate in or one the show
// saw a Cop in last night whose latest public night was Cop work (gap.patrol).
function cannyWorks(v, a, c) {
  const plays = publicNight(v);
  const patrol = (!!v.board.crate && c.place === CRATE_AT)
    || v.board.agents.some(x => x.trade === 'cop' && x.id !== a.id && copWork(plays, plays[x.id]) && (lastSeen(v, x.id) || {}).place === c.place);
  return a.heat + (c.hot || patrol ? N.workHeat : 0) < N.wantedAt;
}

// The corner a Dealer works tonight of those it holds, as every Dealer can read it off the board: the best it can work
// under wanted (cannyWorks), a hot one first, then by name; null when it can work none. Its other corners stand open.
function cannyChoice(v, a) {
  const held = v.board.corners.filter(c => c.holder === a.id && cannyWorks(v, a, c));
  return held.sort((x, y) => Number(y.hot) - Number(x.hot) || (x.corner < y.corner ? -1 : 1))[0] || null;
}

// A crew's job tonight, as its seat can tell: its leader asked its mates for sit-downs today. Only a job does: in the
// canny cast no crewmate asks another about anything else (askSellers, takeAsks, askBuyers and the trade's other asks
// leave crewmates alone).
const crewCalled = (v, cfg) => cfg.type === 'crew' && v.me.sitdowns.some(sd => sd.state !== 'declined'
  && (cfg.role === 'leader' ? sd.asked === 'me' && (cfg.mates || []).includes(sd.with) : sd.asked === 'them' && sd.with === cfg.leader));
// The mates a leader brings on a job: free, none whom the job's star would make wanted (§13: 3 stars bring the city
// cops to its fights and the Cops' collars to its door), by the heat on the board, and none it has walked on
// (memo.stiffed: noteWalked).
const callMates = (v, cfg, memo = {}) => cfg.mates.filter(id => {
  const a = agentOf(v, id);
  return freeAgent(a) && a.heat + 1 < N.wantedAt && !(memo.stiffed || []).includes(id);
});
// The mates a leader has walked on (§12), as its own record shows them: a walk's receipt goes to the leader as to each
// of them. A mate it stiffed sits its next job out and tips the cops on it (L3-5b's rat), so the leader counts it on no
// job again.
function noteWalked(v, memo) {
  memo.stiffed ||= [];
  for (const e of v.events) {
    if (e.type !== 'betray' || e.kind !== 'walk' || e.by !== v.me.id) continue;
    for (const m of e.victims) if (!memo.stiffed.includes(m)) memo.stiffed.push(m);
  }
}
// The group's strength as its leader reads it (§8): its own exactly, TEMP taken today too, and each mate's public one.
const groupPower = (v, mates) => ownPower(v) + (v.me.high.includes('temp') ? 1 : 0) + mates.map(id => agentOf(v, id)).reduce((t, a) => t + seenStrength(v, a, true), 0);
// The crate as a crew reads it (§8, §9, §13). On a shipment night the Cops patrol the docks, so its defence is every
// Cop whose latest public night was Cop work, at its public strength, and one armed patrol at least (before any Cop has
// been seen at work), +1 in a heavy district; nobody in the group is wanted (callMates). The other crew grabs too when
// its public strength beats that, and a tie between groups fails (§8), so a crew grabs only when it would beat the
// defence and every crew that could come: on equal strength, the lower crew id. { play, reason, value }, or null.
function cannyGrab(v, mates) {
  if (!v.board.crate || !v.legal.some(l => l.kind === 'grab')) return null;
  const plays = publicNight(v);
  const lv = (v.board.tonight || {})[CRATE_AT] || 'normal';
  const cops = v.board.agents.filter(a => a.trade === 'cop' && freeAgent(a) && !a.wanted && copWork(plays, plays[a.id])).reduce((t, a) => t + seenStrength(v, a, false), 0);
  const defence = Math.max(1 + COP.armed, cops) + (lv === 'heavy' ? N.copsHeavy : 0);
  const power = groupPower(v, mates);
  const num = id => Number(String(id).slice(1));
  const mine = v.me.crew;
  const beats = c => {
    const s = crewStrength(v, c);
    return s <= defence || power > s || (power === s && num(mine) < num(c.id));
  };
  if (power <= defence || !v.board.crews.filter(c => c.id !== mine).every(beats)) return null;
  const crate = crateWorth(v);
  return { play: { kind: 'grab', place: CRATE_AT }, reason: `crew job: grab the crate, worth about ${crate}: ${power} against ${defence}`, value: crate };
}
// The crew's best job tonight with these mates: the target worth most that its strength wins as it reads the defence
// (robberPlay with the group's floor: carefulOnly), the crate (cannyGrab), or the vault (vaultJob) when its leader holds
// a warrant and the job's two stars leave everyone under wanted; each worth more than the night of work it costs the
// group, a night's wage each. { play, reason, value }, or null. R4-5: its leader reads homes as a canny robber does
// (robberPlay's `opening`).
function cannyJob(v, r, cfg, mates) {
  const me = v.me;
  const floor = (1 + mates.length) * hustlePay(v);
  const strength = 1 + mates.map(id => agentOf(v, id)).reduce((t, a) => t + seenStrength(v, a, true), 0);
  const crewCfg = { type: 'scout', layer: cfg.layer, drugs: cfg.drugs, sharp: true, canny: true };
  const first = robberPlay(v, r, crewCfg, strength, false, null, floor);
  const p = first && yields(v, cfg, first, groupPower(v, mates)) ? robberPlay(v, r, crewCfg, strength, false, null, floor, new Set([first.play.target])) : first;
  let job = p ? { play: p.play, reason: `crew job: ${p.reason}${p !== first ? `, leaving ${first.play.target}'s home to the stronger crew` : ''}`, value: p.value } : null;
  const g = cannyGrab(v, mates);
  if (g && g.value >= floor && g.value > (job ? job.value : 0)) job = g;
  const cool = [me, ...mates.map(id => agentOf(v, id))].every(a => a.heat + N.vault.heat < N.wantedAt);
  const vault = cfg.score && cool && me.goods.warrants && v.legal.some(l => l.kind === 'vault') ? vaultJob(v, groupPower(v, mates), job ? job.value : 0) : null;
  return vault ? { ...vault, reason: `crew job: ${vault.reason}` } : job;
}
// Whether a crew leaves its best break-in to another crew: one stronger by its public strength (the lower crew id on a
// tie), which beats a home's lock (§8) and would pick that home too, since no home of this crew's is worth more to it.
// Two groups on one home is a fight the weaker one loses (§8: the strongest must beat the defence and every other group).
function yields(v, cfg, job, power) {
  if (job.play.kind !== 'breakin') return false;
  const num = id => Number(String(id).slice(1));
  const mine = v.me.crew;
  const own = [v.me.id, ...cfg.mates].map(id => publicHoldings(v, id)).filter(Boolean).reduce((m, rec) => Math.max(m, lookWorth(v, rec)), 0);
  return own <= job.value && v.board.crews.some(c => {
    if (c.id === mine || c.members.includes(job.play.target)) return false;
    const s = crewStrength(v, c);
    return s >= 2 && (s > power || (s === power && num(c.id) < num(mine)));
  });
}
// The leader's call, made once a day from its view (memo.call): tonight's job and the mates it brings, or no job. None
// on the last night (crewNight's own), in jail, wanted, crashing (§11: TEMP's crash is a night in) or when the job's
// star would make the leader wanted (§13).
function cannyCall(v, ctx, cfg, memo) {
  if (memo.call && memo.call.day === v.day) return memo.call;
  const me = v.me;
  const mates = callMates(v, cfg, memo);
  const can = v.day < N.nights && !me.jail && !me.wanted && !me.crash && me.heat + 1 < N.wantedAt && mates.length > 0;
  const job = can ? cannyJob(v, rng(ctx.seed, 'call', me.id, v.day), cfg, mates) : null;
  memo.call = { day: v.day, play: job ? job.play : null, reason: job ? job.reason : null, value: job ? job.value : 0, mates: job ? mates : [] };
  return memo.call;
}
// The leader's job at the lock, on a night it called one: the best one now (the day's errands may have moved things), or
// the one it called while it's still legal; null when neither is (it works its trade).
function cannyNightJob(v, ctx, cfg, memo) {
  const call = memo.call && memo.call.day === v.day ? memo.call : null;
  if (!call || !call.play) return null;
  const now = cannyJob(v, rng(ctx.seed, 'call', v.me.id, v.day), cfg, call.mates);
  if (now) return now;
  return legalNow(v, call.play) ? { play: call.play, reason: call.reason, value: call.value } : null;
}
// Each mate's cut, as the leader promises it: an even share of what the job looks worth, never less than CUT, and only
// what it can pay every mate it brings the morning after, as its view shows it now: its own cash once the day's errands
// so far go through (`errands`), less the rent due at dawn (none on a tab: §10); and the crew stash's cash once those
// errands go through, less what a break-in on the home it's kept at would take tonight (breakinShare) and the dollar
// payCuts leaves in a stash that holds nothing else; less a warrant it holds cash back for (warrantHold). The cuts it
// has promised today come off first (cutsOwed), and the rest is shared among the mates it hasn't promised one yet.
function cutFor(v, memo, errands) {
  const me = v.me;
  const st = me.crewStash;
  const call = memo.call && memo.call.day === v.day ? memo.call : { value: 0, mates: [] };
  const stash = st ? Math.max(0, stashLeft(st, errands)) : 0;
  const last = st && !st.pieces.length && !Object.keys(st.goods).length ? 1 : 0;
  const own = Math.max(0, cashLeft(v, errands)) - (me.evicted ? 0 : N.rent);
  const purse = own + Math.max(0, stash - Math.floor(stash * N.breakinShare) - last) - warrantHold(v, memo) - cutsOwed(v);
  const left = call.mates.filter(m => !me.promises.some(p => p.by === me.id && p.what === 'pay' && p.night === v.day && p.to === m)).length;
  return Math.min(Math.max(CUT, Math.floor(call.value / (1 + call.mates.length))), Math.floor(Math.max(0, purse) / Math.max(1, left)));
}
// The cuts a leader has promised for tonight's job, as its record shows them, and those it says in these errands: cash
// the rest of its day's spending leaves alone (a gun, spending down).
const cutsOwed = v => v.me.promises.filter(p => p.by === v.me.id && p.what === 'pay' && p.night === v.day).reduce((t, p) => t + p.cash, 0);
const cutsSaid = errands => errands.filter(e => e.kind === 'say' && e.say === 'promise' && e.terms && e.terms.what === 'pay').reduce((t, e) => t + e.terms.cash, 0);
// The day after: the cuts it promised for last night's job, which the rules keep only once the job has won (§12), what
// it hasn't paid of each yet (its record's pay receipts today), one by one, as far as its cash and then the crew stash's
// go (never the last dollar of a stash that holds nothing else, which would read as a rug), in every round, as cash
// comes in; unless it keeps the bag (a walk, at its seat's odds: CREW_ODDS).
function payCuts(v, ctx, cfg, errands) {
  const me = v.me;
  const paid = p => v.events.filter(e => e.type === 'pay' && e.from === me.id && e.to === p.to && e.for === 'cut' && e.day === v.day).reduce((t, e) => t + e.amount, 0);
  const due = me.promises.filter(p => p.by === me.id && p.what === 'pay' && p.night === v.day - 1 && cfg.mates.includes(p.to))
    .sort((x, y) => Number(x.id.slice(1)) - Number(y.id.slice(1))).map(p => ({ to: p.to, owed: p.cash - paid(p) })).filter(p => p.owed > 0);
  if (!due.length || rng(ctx.seed, 'walk', me.id, v.day)() < cfg.walk) return [];
  const out = [];
  const st = me.crewStash;
  let cash = cashAfter(v, errands);
  const spare = st ? stashLeft(st, errands) - (st.pieces.length || Object.keys(st.goods).length ? 0 : 1) : 0;
  const take = Math.min(Math.max(0, due.reduce((t, p) => t + p.owed, 0) - cash), Math.max(0, spare));
  if (take > 0) {
    out.push({ kind: 'stash_take', cash: take });
    cash += take;
  }
  for (const p of due) {
    const pay = Math.min(p.owed, cash);
    if (pay < 1) break;
    out.push({ kind: 'pay', to: p.to, amount: pay, for: 'cut' });
    cash -= pay;
  }
  return out;
}

// --- R4-5: bot round 2, in the canny cast (trunk docs/briefs/R4-astra-fixes.md, task 5) --------------------------------
// Astra's review (talk/PROPOSAL.md §2; the full review's show/REVIEW.md §2 and §4) found six habits the canny cast's
// seats still lack. In the canny cast (`cfg.canny`) every seat plays them from its own view (the agent view, and what it
// remembers of its own earlier views); every other cast keeps its bots as they were.
// - Victims remember (§10, §19). A seat robbed by an agent it can name keeps the grievance until it acts on it with a
//   bounty, or the grievance is moot: the thief has boarded, or fewer than BOUNTY_NIGHTS nights of crime are left before
//   the walk, too few for a hunter to collect it (a bounty nobody earns is gone with the ferry). One bounty of its own
//   is open on a thief at a time, so a later theft by it waits until that one is collected or gone. A thief whose ski
//   mask kept its name off the receipt is named once the 24-hour record names the robber (noteTricks). It posts once it
//   can spare a night's wage, the least that moves a hunter, beyond what it still needs to the ferry (stillNeeds):
//   TRICKS.bounty of all it has lost to that thief and not acted on yet, or what it can spare, if less (cannyBounties).
// - Opening break-ins (§1, §6, §7). On a night the show has never shown an agent (night 1), its trade tells a robber
//   whether it works out of its home: a Smuggler runs a drop, a Dealer deals its kit's doses and a Cop works the street,
//   while a Chemist may cook and a Gunrunner build at home (worksOutOfHome). A home with no public holdings record yet
//   holds what the rules give every agent at the start (every season starts equal, so its own starting cash, which it
//   remembers: openingOf), plus the hustle takes the public record paid its owner since, less the rent due at each dawn,
//   and the pieces the list's public sales put there (openingWorth). A careful robber still breaks in only where that
//   beats its night's wage and its strength beats the lock.
// - Lockpicks (§8, §9). A lockpick adds 1 to a break-in and is used up. A robber that would break in tonight with one,
//   for more than its best play without one by more than the pick's price, buys one from a Gunrunner as a gun is bought
//   (pickPlan, pickErrands), and counts one it holds (pickOf). A Gunrunner hands one over to an order at its price
//   (pickPrice: its part at the agents' price and the night's wage a build to order takes, as a warrant's), notes an
//   order it couldn't fill as demand, and builds picks to the demand its own record shows, and once a buyer has asked
//   it for one keeps one unsold, as it keeps a gun, beside its guns, with the parts ordered for them (pickTarget,
//   cannyBuild); a night of picks alone only when they'd pay more than a hustle.
// - Bribes (§13). Beside a scout's hit on a target with a routine in a heavy district (the hold-up's pay counted, a
//   guard's wage too: goodsCarried), a robber bribes for a break-in on a night Pleasantview is heavy, when the break-in
//   its group would make with the heavy +1 kept out, less the bribe, beats its best play without it (breakinBribe); and
//   a wanted seat bribes for its own collar when tonight's police plan, which every Cop reads off public facts, comes
//   for it at home, where it lies low, and wins only with the city cops, and the arrest would cost it more than the
//   bribe: half its cash, the rarest piece it wears and its work for the nights in jail (collarBribe).
// - The last split (§12, §15). On day 14 a crew divides its stash by what each member put in and risked, as the crew's
//   own record shows it (noteCrew): the cash each put in less what it took out, a piece to whoever put it in, and a piece
//   a crew job took to the crew members in the group that took it, evenly. Each member's share of the whole stash follows
//   its claim; the pieces go, dearest first, to whoever is owed most, and cash evens out the rest (splitPlan). Each
//   member takes its own share; the keeper's stays, and goes aboard with it (lastSplit). Nothing holds anyone to it: a
//   member can take more, and the snake can still rug the stash the day before (§12).
// - The last night (§15). A seat carrying something a hit could take, which some group on the board could beat on its
//   usual route, walks the route the cops guard best tonight only when the cops there hold every such group off (+1 on
//   a heavy route, +2 more against a wanted attacker outside a lawless one); otherwise its usual route, since a move
//   that doesn't stop the threat only tells a hunter where to look (lastRoute). A robber, or a crew's leader with its
//   crew, hits on the walk a target worth a night's wage at least, only where its group beats the defence: the target's
//   group and the route's cops, and, since a loss with a cop in the fight is an arrest that misses the ferry, a point in
//   hand for a gun bought since the record when it carries more than the take would bring. Where public facts say the
//   target walks (a holder that only the best-guarded route keeps safe, there; a crew's member wherever its leader
//   walks), it looks there; otherwise it guesses one of the routes where it would win, since looking in the wrong place
//   costs nothing, and counts a third of the take (finaleHunt). It leaves a target to a stronger crew that would go
//   for it (finaleClaims).
// The lockpick's +1 counts only for a break-in (§8).
const pickOf = v => ((v.me.goods.lockpicks || 0) > 0 ? 1 : 0);
// The view with a lockpick in its pocket, as its own view would show one.
const withPick = v => ({ ...v, me: { ...v.me, goods: { ...v.me.goods, lockpicks: (v.me.goods.lockpicks || 0) + 1 } } });
// A lockpick's price, as its maker and its buyer reckon it, as a warrant's is (warrantPrice): what one built to order
// costs its maker, its part at the agents' price and the night's wage the build takes.
export const pickPrice = v => N.build.lockpicks * STREET.unit + hustlePay(v);
// What every agent started the season with (§1: every season starts equal): its own starting cash, which a canny seat
// remembers (remembered), or the rules' $0 when it never saw its first day.
const openingOf = v => ({ start: Number.isInteger(v.start) ? v.start : 0 });
// The trades whose night's work is out of the home (§6, §7, §9): a run, a deal, a patrol or a hustle.
const OUT_TRADES = ['smuggler', 'dealer', 'cop'];
// An agent none of the last three shows has shown (on night 1, everyone) whose trade works out of its home.
const worksOutOfHome = (v, a) => !(v.sightings[a.id] || []).length && OUT_TRADES.includes(a.trade);
// What a home with no public holdings record yet holds, as the rules and the public record leave it: the start, plus
// the takes the record's hustle events paid its owner since, less the rent due at each dawn since, at breakinShare;
// and the pieces the list's public sales put there, less what it wears (`inside`).
function openingWorth(v, a, inside, opening) {
  const wages = v.events.filter(e => e.type === 'hustle' && e.night < v.day && e.agent === a.id).reduce((t, e) => t + e.take, 0);
  const cash = opening.start + wages - (v.day - 1) * N.rent;
  return Math.max(0, inside) + Math.floor(Math.max(0, cash) * N.breakinShare);
}
// The view a canny seat plays from: the agent view, with what it started the season with, remembered from its first day
// (memo.start).
function remembered(view, memo) {
  if (!view.me || view.over) return view;
  if (memo.start == null) memo.start = view.day === 1 ? view.me.cash : 0;
  return { ...view, start: memo.start };
}

// Bot setting, not a game number: the nights of crime a canny victim wants left before the walk (§15) when it posts a
// bounty, four, so day 10 is the last day it posts one. A hunter takes nights to find a thief it can beat, and a bounty
// nobody earns is gone with the ferry (gap.bounty).
export const BOUNTY_NIGHTS = 4;

// The canny cast's bounties, in the day's first round (see above): `open`, the agents a bounty of its own is open on;
// `keep`, what it keeps back from them. `done`: the day's errands so far. It posts none once fewer than BOUNTY_NIGHTS
// nights of crime are left before the walk: its grievances are moot then.
function cannyBounties(v, memo, done, open, keep) {
  const out = [];
  const left = [];
  if (N.nights - v.day < BOUNTY_NIGHTS) {
    memo.wronged = [];
    return out;
  }
  for (const id of [...new Set(memo.wronged.map(w => w.by))]) {
    const owed = memo.wronged.filter(w => w.by === id);
    const thief = agentOf(v, id);
    if (!thief || thief.boarded) continue;
    const loss = owed.reduce((t, w) => t + (w.trait ? worth(v, w.trait) : 0) + w.cash, 0);
    const amount = Math.min(cashLeft(v, [...done, ...out]) - keep, Math.floor(TRICKS.bounty * loss));
    if (open.has(id) || amount < hustlePay(v)) {
      left.push(...owed);
      continue;
    }
    out.push({ kind: 'bounty', agent: id, amount });
    open.add(id);
  }
  memo.wronged = left;
  return out;
}

// The canny cast's bribe, in the day's last round, once its muscle and its drugs are in (see above): the bribe errand,
// with a robber's fight tonight in memo.plan, or null. `done`: the day's errands so far.
function cannyBribe(v, ctx, cfg, memo, done) {
  const me = v.me;
  const price = N.bribe[me.heat];
  if (ctx.round !== (ctx.rounds || 3) || me.jail || v.day >= N.nights || price == null || cashLeft(v, done) - price < N.rent) return null;
  noteTricks(v, memo, cfg);
  const collar = collarBribe(v, cfg, done, price);
  if (collar) return collar;
  if (!robs(cfg) || cfg.careless || me.crash || me.heat >= 4 || (memo.plan && memo.plan.day === v.day)) return null;
  if (counterHit(v, memo, rng(ctx.seed, 'counter', me.id, v.day), cfg.layer, crewSight(cfg))) return null;
  const side = new Set(me.promises.filter(p => p.what === 'back' && p.who === me.id && p.by !== me.id && p.night === v.day).map(p => p.by));
  // A bribe paid at its own stars keeps no cops out while anyone on its side is hotter (gap.bribe).
  if ([...side].some(id => (agentOf(v, id) || { heat: 0 }).heat > me.heat)) return null;
  const plain = robberTonight(v, ctx, cfg, memo);
  const best = [cfg.type === 'scout' ? routineBribe(v, side) : null, breakinBribe(v, ctx, cfg, side.size)].filter(Boolean).sort((x, y) => y.take - x.take)[0];
  if (!best || best.take - price < Math.max(hustlePay(v), plain ? plain.value : 0)) return null;
  memo.plan = { day: v.day, play: best.play, reason: best.reason };
  return { kind: 'bribe', target: best.play.target };
}
// A scout's hit on a target the show saw in a heavy district on each of its last two sightings (a routine), which its
// group beats once the bribe keeps the city cops out: the take worth most, the hold-up's pay counted (goodsCarried), a
// guard's wage too. { play, take, reason }, or null.
function routineBribe(v, side) {
  const me = v.me;
  const tonight = v.board.tonight || {};
  const power = ownPower(v) + side.size + (me.high.includes('temp') ? 1 : 0);
  const patrols = place => Object.values(publicNight(v)).filter(p => p.kind === 'patrol' && p.place === place && freeAgent(agentOf(v, p.agent)));
  const sight = trickSight(v);
  const goods = goodsCarried(v, true);
  let best = null;
  for (const a of others(v)) {
    const [prev, last] = seenAt(v, a.id).slice(-2);
    const play = last && prev && prev.place === last.place && { kind: 'hit', target: a.id, place: last.place };
    if (!play || tonight[last.place] !== 'heavy' || side.has(a.id) || !legalNow(v, play)) continue;
    const defence = seenStrength(v, a, false) + patrols(last.place).reduce((t, p) => t + seenStrength(v, agentOf(v, p.agent), false), 0);
    if (power <= defence) continue;
    const { value, want } = hitWorth(v, a, sight);
    const take = value + goods.at(a, last.place) + (value > 0 ? bountyOn(v, a.id, sight) : 0);
    if (!best || take > best.take) best = { play: { ...play, ...(want ? { want: want.copy } : {}) }, take, reason: `bribed the cops: ${a.id} was seen in ${last.place}` };
  }
  return best;
}
// A robber's break-in on a night Pleasantview is heavy, which a careful robber passes by (robberPlay's `safe`): the
// break-in its group would make with the heavy +1 kept out, as a bribe keeps every city cop out of its fight; patrols
// still count. Its draws come from a stream of their own. { play, take, reason }, or null.
function breakinBribe(v, ctx, cfg, muscle) {
  const tonight = v.board.tonight || {};
  if (tonight[HOMES] !== 'heavy') return null;
  const bribed = { ...v, board: { ...v.board, tonight: { ...tonight, [HOMES]: 'normal' } } };
  const p = robberPlay(bribed, rng(ctx.seed, 'bribe', v.me.id, v.day), cfg, 1 + muscle, false, leadValues(v), hustlePay(v));
  return p && p.play.kind === 'breakin' ? { play: p.play, take: p.value, reason: `bribed the cops: ${p.reason}` } : null;
}
// A wanted seat's bribe for its own collar, or null (see above). A wanted canny seat lies low at home (streetPlan), but
// for the hustler, which hustles, and a Cop, which patrols; so the plan's collar finds it only there.
function collarBribe(v, cfg, done, price) {
  const me = v.me;
  const out = ['hustle', 'squatter', 'cop'].includes(cfg.type) || (cfg.works && cfg.trade === 'cop');
  if (!me.wanted || me.evicted || out) return null;
  const plan = policePlan(v, !!cfg.drugs);
  if (!plan || plan.target !== me.id || !plan.home) return null;
  const lv = (v.board.tonight || {})[plan.place] || 'normal';
  const cops = (lv !== 'lawless' ? N.copsWanted : 0) + (lv === 'heavy' ? N.copsHeavy : 0);
  // Its defence at home, laying low (§8): the lock, itself, and 1 for laying low.
  const defence = 1 + (1 + (armed(v) ? 1 : 0) + (me.high.includes('temp') ? 1 : 0)) + 1;
  if (plan.strength <= defence || plan.strength - cops > defence) return null;
  const worn = rarestOf(v, me.pieces.filter(p => p.worn && !p.fake));
  const cost = Math.floor(cashLeft(v, done) / 2) + (worn ? worth(v, worn.trait) : 0) + N.jailNights * hustlePay(v);
  return price < cost ? { kind: 'bribe', target: me.id } : null;
}

// A robber's lockpick (see above): tonight's break-in it would make with one, when that pays more than its best play
// without one by more than the pick's price; or null. Both readings draw from a stream of their own.
function pickPlan(v, ctx, cfg, memo) {
  const me = v.me;
  if (!robs(cfg) || cfg.careless || me.jail || me.crash || v.day >= N.nights || me.heat >= 4 || pickOf(v)) return null;
  if (memo.plan && memo.plan.day === v.day) return null;
  if (counterHit(v, memo, rng(ctx.seed, 'counter', me.id, v.day), cfg.layer, crewSight(cfg))) return null;
  const strength = 1 + backersPromised(v);
  const leads = leadValues(v);
  const plain = robberPlay(v, rng(ctx.seed, 'pick', me.id, v.day), cfg, strength, false, leads, hustlePay(v));
  const picked = robberPlay(withPick(v), rng(ctx.seed, 'pick', me.id, v.day), cfg, strength, false, leads, hustlePay(v));
  if (!picked || picked.play.kind !== 'breakin') return null;
  return picked.value - pickPrice(v) > (plain ? plain.value : 0) ? picked : null;
}
// The buyer's side of a lockpick, as of a gun (gunErrands): a pick it ordered that arrived it owes (on the deal record),
// and pays; with none
// on it, while it wants one (pickPlan), it asks a Gunrunner in the day's first round (of those whose public holdings
// show lockpicks, if any, the one it asked last, else one by its own draw; else the one it asked last, which builds to
// the order it couldn't fill, else the street's dealer, best placed to build, as a warrant's buyer does), and offers
// the price once the sit-down opens. Never a crewmate, a guarded seat or one it's in a sit-down with today. A seat that
// works the Smuggler trade asks none: a Gunrunner reads a Smuggler's ask as one about parts. `cash`, `msgs`: what the
// day's errands so far leave it. Returns the errands and the cash left.
function pickErrands(v, ctx, cfg, memo, cash, msgs) {
  const me = v.me;
  const out = [];
  const o = memo.pickOrder;
  // R5-deals: an order lives as long as its sit-down does (no longer with the day), so a pick handed over any day since
  // counts.
  const arrived = !!o && !!o.price && v.events.some(e => e.type === 'give' && e.from === o.with && e.to === me.id && e.goods && e.goods.lockpicks && e.day >= o.day);
  const at = o ? orderSd(v, o) : null;
  if (arrived || (o && (!at || saidNone(at, o.with)))) memo.pickOrder = null;
  // R5-deals: what it owes for a pick, as the deal record has it; one still unpaid keeps it from ordering another.
  const paid = payOwed(v, memo, cash, goodsDeal(['lockpicks']));
  out.push(...paid.out);
  cash = paid.cash;
  const pickOwed = owing(v, memo, goodsDeal(['lockpicks'])) > 0;
  if (me.jail || pickOwed || pickOf(v) || v.day >= N.nights || (cfg.works && cfg.trade === 'smuggler')) return { out, cash };
  const price = pickPrice(v);
  const k = memo.pickOrder;
  if (!k && ctx.round === 1 && cash - N.rent >= price && msgs >= 2 && pickPlan(v, ctx, cfg, memo)) {
    const mates = crewOf(v);
    const runners = v.board.agents.filter(a => a.trade === 'gunrunner' && a.id !== me.id && freeAgent(a) && !guarded(v, a.id) && !mates.has(a.id)
      && !me.sitdowns.some(sd => sd.with === a.id)).sort(byNum);
    const stocked = runners.filter(a => recordHolds(v, a.id, 'lockpicks') > 0);
    if (runners.length) {
      const from = xs => xs.find(a => a.id === memo.pickFrom) || null;
      const best = runners.find(a => a.id === dealer(v)) || null;
      const g = from(stocked) || (stocked.length ? pick(rng(ctx.seed, 'pick', me.id, v.day, 'seller'), stocked) : from(runners) || best || pick(rng(ctx.seed, 'pick', me.id, v.day, 'seller'), runners));
      out.push({ kind: 'ask', to: g.id, line: itemLine('a lockpick', price) });
      memo.pickOrder = { with: g.id, day: v.day, price: null };
      memo.pickFrom = g.id;
    }
  } else if (k && !k.price && cash - N.rent >= price && msgs >= 1) {
    const sd = orderSd(v, k);
    if (sd && sd.state === 'open') {
      out.push({ kind: 'say', sitdown: sd.id, say: 'offer', terms: { what: BUY, goods: { lockpicks: 1 }, cash: price } });
      Object.assign(k, { price, sitdown: sd.id });
    }
  } else if (k && k.price && msgs >= 1) {
    // R9d: its order said, it answers the Gunrunner as a gun's buyer does (gunErrands).
    const sd = orderSd(v, k);
    const e = sd && sd.state === 'open' ? answerSeller(v, memo, sd, k.price, 1, k.price, onlyOf('lockpicks')) : null;
    if (e) {
      out.push(e);
      k.price = e.terms.cash;
    }
  }
  return { out, cash: cash - (memo.pickOrder && memo.pickOrder.price ? memo.pickOrder.price : 0) };
}
// The lockpicks a Gunrunner wants on hand: those its own record shows sold, or asked for and not filled, in the last
// CANNY.days days, and, once a buyer has asked it for one, at least the one it keeps unsold, as it keeps a gun
// (HABITS.unsold); a night's parts at most, and none once no break-in night is left for a pick built tonight to sell to.
function pickTarget(v, memo) {
  if (v.day + 1 > N.nights - 1) return 0;
  const got = (m, d) => ((memo[m] || {})[d] || {}).lockpicks || 0;
  const seen = Array.from({ length: CANNY.days }, (_, i) => v.day - i).reduce((t, d) => t + got('outs', d) + got('unmet', d), 0);
  return Math.min(N.build.parts, Math.max(seen, memo.pickAsked ? HABITS.unsold : 0));
}
// The parts a Gunrunner's picks still call for, beyond what it holds.
const pickParts = (v, memo, held) => Math.max(0, pickTarget(v, memo) - held) * N.build.lockpicks;
// A canny Gunrunner's build tonight: the guns its stock is short (gunTarget), as before, and lockpicks to its pick
// target in the parts left (pickTarget). { guns, picks, reason }, { idle } when only picks are due and they'd pay less
// than a hustle, or null with nothing to build.
function cannyBuild(v, memo, cfg) {
  const has = k => v.me.goods[k] || 0;
  const most = Math.min(has('parts'), N.build.parts);
  const short = gunTarget(v, memo, cfg) - has('guns');
  const guns = has('parts') >= N.build.guns && short > 0 ? Math.min(Math.floor(most / N.build.guns), short) : 0;
  const picks = Math.max(0, Math.min(Math.floor((most - guns * N.build.guns) / N.build.lockpicks), pickTarget(v, memo) - has('lockpicks')));
  if (!guns && !picks) return null;
  if (!guns && picks * pickPrice(v) <= hustlePay(v)) return { idle: `picks won't beat a hustle: ${picks} at $${pickPrice(v)} against $${hustlePay(v)}` };
  const what = [guns ? `${guns} gun${guns > 1 ? 's' : ''}` : null, picks ? `${picks} lockpick${picks > 1 ? 's' : ''}` : null].filter(Boolean).join(' and ');
  return { guns, picks, reason: `build ${what}` };
}
// The seller's side of a lockpick, in a sit-down a buyer asked for (sellGuns): it hands over what's ordered, as far as
// its picks go, to an order that pays its price, and notes the sale (memo.outs); to one it can't fill, it says so, and
// notes what it couldn't fill as demand (noteUnmet). Returns the messages left.
function sellPick(v, memo, goods, sd, offer, msgs, out) {
  const want = offer.terms.goods.lockpicks;
  const n = Math.min(want, goods.lockpicks || 0);
  memo.pickAsked = true;
  // R5-deals (the review): never under its own quote, a unit at a time, so a part-filled order pays its price too.
  if (n >= 1 && offer.terms.cash >= pickPrice(v) * want) {
    out.push({ kind: 'give', to: sd.with, goods: { lockpicks: n }, ...naming(v, sd.with, sd.id) });
    goods.lockpicks -= n;
    const day = ((memo.outs ||= {})[v.day] ||= {});
    day.lockpicks = (day.lockpicks || 0) + n;
    return msgs;
  }
  if (offer.terms.cash >= pickPrice(v) * want) noteUnmet(v, memo, 'lockpicks', want - n);
  if (msgs < 1) return msgs;
  out.push({ kind: 'say', sitdown: sd.id, say: 'answer', terms: { what: BUY, cash: 0 } });
  return msgs - 1;
}

// What a crew's member has seen of its crew's stash and jobs (§12), kept for the last split (memo.book): the cash each
// member put in less what it took out, who put each piece in, and the crew's members in the group of each job that took a
// piece. The stash's puts and takes reach every member at once; a job's take reaches its group at once and everyone a day
// later, so each is read once, whenever this seat first sees it.
function noteCrew(v, memo) {
  const book = (memo.book ||= { cash: {}, put: {}, jobs: {}, seen: {} });
  const crew = v.board.crews.find(c => c.id === v.me.crew);
  if (!crew) return book;
  for (const e of v.events) {
    if (book.seen[e.n]) continue;
    if (e.type === 'stash' && e.crew === crew.id && (e.act === 'put' || e.act === 'take')) {
      if (e.cash) book.cash[e.agent] = (book.cash[e.agent] || 0) + (e.act === 'put' ? e.cash : -e.cash);
      if (e.copy && e.act === 'put') book.put[e.copy] = e.agent;
    } else if (['rob', 'burgle', 'vault'].includes(e.type) && (e.members || []).some(m => crew.members.includes(m))) {
      for (const k of e.type === 'vault' ? e.copies : [e.copy]) if (k) book.jobs[k] = e.members.filter(m => crew.members.includes(m));
    } else continue;
    book.seen[e.n] = true;
  }
  return book;
}
// The last split of `pieces` and `cash` among a crew's `members`, by what each put in and risked (see above), the same
// from every member's view: { pieces: member -> copies, cash: member -> dollars }.
function splitPlan(v, book, members, pieces, cash) {
  const ids = members.slice().sort((x, y) => Number(x.slice(1)) - Number(y.slice(1)));
  const val = p => worth(v, p.trait);
  const credit = Object.fromEntries(ids.map(m => [m, book.cash[m] || 0]));
  for (const p of pieces) {
    const group = (book.jobs[p.copy] || []).filter(m => ids.includes(m));
    const who = group.length ? group : ids.includes(book.put[p.copy]) ? [book.put[p.copy]] : ids;
    for (const m of who) credit[m] += val(p) / who.length;
  }
  const claim = m => Math.max(0, credit[m]);
  const claims = ids.reduce((t, m) => t + claim(m), 0);
  const total = cash + pieces.reduce((t, p) => t + val(p), 0);
  const share = m => (claims > 0 ? (total * claim(m)) / claims : total / ids.length);
  const got = Object.fromEntries(ids.map(m => [m, 0]));
  const owns = Object.fromEntries(ids.map(m => [m, []]));
  for (const p of pieces.slice().sort((x, y) => val(y) - val(x) || (x.copy < y.copy ? -1 : 1))) {
    const m = ids.slice().sort((x, y) => share(y) - got[y] - (share(x) - got[x]) || claim(y) - claim(x))[0];
    owns[m].push(p.copy);
    got[m] += val(p);
  }
  const want = Object.fromEntries(ids.map(m => [m, Math.max(0, share(m) - got[m])]));
  const owed = ids.reduce((t, m) => t + want[m], 0);
  const scale = owed > cash ? cash / owed : 1;
  return { pieces: owns, cash: Object.fromEntries(ids.map(m => [m, Math.floor(want[m] * scale)])) };
}
// Day 14's last split, this member's own share (splitPlan) out of the stash as the day found it: the members' takes
// today put back, the keeper's errands left out (its share stays). The keeper takes nothing. A take never leaves the
// stash with nothing at all in it, which would read as a rug (§12). `errands`: the day's errands so far.
function lastSplit(v, memo, errands) {
  const me = v.me;
  const st = me.crewStash;
  const crew = v.board.crews.find(c => c.id === me.crew);
  if (!st || !crew || me.id === st.keeper) return [];
  const taken = v.events.filter(e => e.type === 'stash' && e.act === 'take' && e.crew === crew.id && e.day === v.day && e.agent !== st.keeper);
  const pieces = [...st.pieces, ...taken.filter(e => e.copy)].map(p => ({ copy: p.copy, trait: p.trait }));
  // The claims as they stood before today's shares came out.
  const book = noteCrew(v, memo);
  const put = { ...book.cash };
  for (const e of taken) if (e.cash) put[e.agent] = (put[e.agent] || 0) + e.cash;
  const plan = splitPlan(v, { ...book, cash: put }, crew.members, pieces, st.cash + taken.reduce((t, e) => t + (e.cash || 0), 0));
  const mine = new Set(plan.pieces[me.id] || []);
  const out = st.pieces.filter(p => mine.has(p.copy)).map(p => ({ kind: 'stash_take', copy: p.copy }));
  const left = Math.max(0, stashLeft(st, errands));
  let cash = Math.min(left, Math.max(0, (plan.cash[me.id] || 0) - taken.filter(e => e.agent === me.id).reduce((t, e) => t + (e.cash || 0), 0)));
  const empty = st.pieces.length === out.length && !Object.keys(st.goods).length && left - cash < 1;
  if (empty && cash > 0) cash -= 1;
  else if (empty && out.length) out.sort((x, y) => worth(v, st.pieces.find(p => p.copy === y.copy).trait) - worth(v, st.pieces.find(p => p.copy === x.copy).trait)).pop();
  if (cash > 0) out.push({ kind: 'stash_take', cash });
  return out;
}

// It carries aboard something a hit could take (§15): a real piece, worn or bagged, the crew stash it keeps, which goes
// aboard with it, or cash.
function carriesAny(v) {
  const st = v.me.crewStash && v.me.crewStash.keeper === v.me.id ? v.me.crewStash : null;
  return v.me.pieces.some(p => !p.fake) || (!!st && st.pieces.length > 0) || Math.floor((v.me.cash + (st ? st.cash : 0)) / 2) > 0;
}
// The crew agent `id` is in, on the board, or null; and the crew's founder, as the record showed it on day 1 (remember).
const crewWith = (v, id) => v.board.crews.find(c => c.members.includes(id)) || null;
const founderOf = (memo, c) => (c && (memo.founders || {})[c.id]) || null;
// The groups the board shows anyone could bring against agent `id` on the walk (§8), at public strength: each crew other
// than its own (its free members, attacking), and each agent outside its crew, on its own; with whether a member of the
// group is wanted, which brings the city cops' +2 outside a lawless route. [{ power, wanted }].
function finaleThreats(v, id) {
  const mine = crewWith(v, id);
  const crews = v.board.crews.filter(c => !mine || c.id !== mine.id).map(c => ({ power: crewStrength(v, c), wanted: c.members.map(m => agentOf(v, m)).filter(freeAgent).some(a => a.wanted) }));
  const lone = v.board.agents.filter(a => a.id !== id && freeAgent(a) && !(mine && mine.members.includes(a.id))).map(a => ({ power: seenStrength(v, a, true), wanted: !!a.wanted }));
  return [...crews, ...lone];
}
// The city cops in a fight on route `r` tonight (§6, §8): +2 against a wanted attacker outside a lawless route, and +1
// more on a heavy one.
function copsOn(v, r, wanted) {
  const lv = (v.board.tonight || {})[r] || 'normal';
  return (wanted && lv !== 'lawless' ? N.copsWanted : 0) + (lv === 'heavy' ? N.copsHeavy : 0);
}
// Whether a group of `group`, defending on route `r`, holds off each of `threats` there with the cops' help: an attack
// wins only with more than the defence (§8).
const safeOn = (v, threats, group, r) => threats.every(t => t.power <= group + copsOn(v, r, t.wanted));
// The routes the cops guard best tonight (§6, §15, gap.routeLevels).
function bestRoutes(v) {
  const tonight = v.board.tonight || {};
  const rank = r => LEVELS.indexOf(tonight[r] || 'normal');
  const top = Math.max(...ROUTES.map(rank));
  return ROUTES.filter(r => rank(r) === top);
}
// The route a seat walks to the dock (§15), from what its view shows: carrying something a hit could take, where some
// group on the board could beat its own (`group`: its strength, defending, with the backers that walk with it) on its
// usual route, the route the cops guard best tonight, when the cops there hold off every such group; otherwise its
// usual route, since a move that doesn't stop the threat only tells a hunter where to look. A route guarded less well
// never holds off a group the best-guarded one doesn't.
function lastRoute(v, cfg, group) {
  if (!carriesAny(v)) return cfg.route;
  const threats = finaleThreats(v, v.me.id);
  const best = bestRoutes(v)[0];
  return !safeOn(v, threats, group, cfg.route) && safeOn(v, threats, group, best) ? best : cfg.route;
}
// What a hit on `a` takes on the last night (§15), as public facts show it: the rarest real piece it carries (its fit on
// the board, and the pieces and the crew stash its latest public holdings record shows) and half its cash there. Nothing
// from one wearing a vest, whose once-a-season save nobody else can see spent.
function finaleWorth(v, a) {
  const fit = realFit(a);
  if (fit.some(p => (listOf(v, p.trait) || {}).ability === 'vest')) return 0;
  const rec = publicHoldings(v, a.id);
  const top = rarestOf(v, [...fit, ...(rec ? rec.pieces : []), ...(rec && rec.crew ? rec.crew.pieces : [])]);
  return (top ? worth(v, top.trait) : 0) + Math.floor((rec ? rec.cash + (rec.crew ? rec.crew.cash : 0) : 0) / 2);
}
// Agent `a`'s group on the walk, defending, at public strength: a crew's founder walks with its free members (they back
// it, accepted by default, gap.accept); anyone else defends alone, a crew member backing its leader too
// (gap.backerDefence).
function finaleGroup(v, memo, a) {
  const c = crewWith(v, a.id);
  const group = c && founderOf(memo, c) === a.id ? c.members.map(id => agentOf(v, id)).filter(freeAgent) : [a];
  return group.reduce((t, x) => t + seenStrength(v, x, false), 0);
}
// Where agent `a` walks tonight, read off public facts by the rule every holder walks by (lastRoute): a crew's member
// with its free leader; one carrying something a hit could take, which the cops on the best-guarded route hold every
// group on the board off, and on no other, there, whatever its usual route; null where the choice is its own (its
// usual route, which nobody else knows, or a tie between routes).
function finaleRouteOf(v, memo, a) {
  const lead = founderOf(memo, crewWith(v, a.id));
  const leader = lead && lead !== a.id ? agentOf(v, lead) : null;
  if (freeAgent(leader)) return finaleRouteOf(v, memo, leader);
  const best = bestRoutes(v);
  if (finaleWorth(v, a) <= 0 || best.length !== 1) return null;
  const [threats, group] = [finaleThreats(v, a.id), finaleGroup(v, memo, a)];
  return ROUTES.every(r => safeOn(v, threats, group, r) === (r === best[0])) ? best[0] : null;
}
// A hit on the walk to the dock, for a group of `power` (see above): `side`, its own, never a target; `wanted`, whether a
// member of it is wanted (the city cops' +2 outside a lawless route); `stake`, what its group carries, all of it lost if
// a loss with a cop in the fight keeps it off the ferry; `skip`, targets left to a stronger crew; `guess`, its draw for
// where to look for a target whose route public facts don't give: one of the routes where it would win, since looking
// in the wrong place costs it nothing, for a take a third as likely (one route in three). A lone robber picks among the
// takes worth at least SPREAD of the best (`r`), as it does all season, so robbers don't crowd one target; a crew takes
// the best, the lower id on a tie. { play, reason, value }, or null.
function finaleHunt(v, memo, r, { power, side, wanted, stake, skip = new Set(), guess = null }) {
  const options = [];
  for (const a of v.board.agents.slice().sort(byNum)) {
    if (side.has(a.id) || skip.has(a.id) || !freeAgent(a) || !v.legal.some(l => l.kind === 'hit' && l.target === a.id)) continue;
    const value = finaleWorth(v, a);
    if (value < hustlePay(v)) continue;
    const defence = rt => finaleGroup(v, memo, a) + copsOn(v, rt, wanted);
    // It wins with more than the defence, and with a point in hand where a cop is in the fight and it carries more than
    // the take would bring.
    const wins = rt => power > defence(rt) + (copsOn(v, rt, wanted) > 0 && stake > value ? 1 : 0);
    const route = finaleRouteOf(v, memo, a);
    if (route) {
      if (wins(route)) options.push({ value, play: { kind: 'hit', target: a.id, place: route }, reason: `the walk to the dock: ${a.id} walks ${route}, ${power} against ${defence(route)}` });
      continue;
    }
    const where = guess ? ROUTES.filter(wins) : [];
    if (!where.length) continue;
    const place = pick(guess, where);
    options.push({ value: Math.floor(value / ROUTES.length), play: { kind: 'hit', target: a.id, place }, reason: `the walk to the dock: a guess that ${a.id} walks ${place}, ${power} against ${defence(place)}` });
  }
  if (!options.length) return null;
  if (!r) return options.sort((x, y) => y.value - x.value)[0];
  const ranked = shuffle(r, options).sort((x, y) => y.value - x.value);
  return pick(r, ranked.filter(o => o.value >= SPREAD * ranked[0].value));
}
// The targets the crews on the board would go for on the walk, as anyone reads them off public facts: the strongest crew
// first (the lower crew id on a tie), each leaving the targets of those before it. A crew guesses the route of a target
// whose route public facts don't give; the target it goes for doesn't hang on that draw, which only it knows (any draw
// gives the same target). [{ crew, target }].
function finaleClaims(v, memo) {
  const crews = v.board.crews.map(c => ({ c, power: crewStrength(v, c) })).sort((x, y) => y.power - x.power || Number(x.c.id.slice(1)) - Number(y.c.id.slice(1)));
  const out = [];
  for (const { c, power } of crews) {
    if (!freeAgent(agentOf(v, founderOf(memo, c)))) continue;
    const wanted = c.members.map(id => agentOf(v, id)).filter(freeAgent).some(a => a.wanted);
    const h = finaleHunt(v, memo, null, { power, side: new Set(c.members), wanted, stake: Infinity, skip: new Set(out.map(x => x.target)), guess: () => 0 });
    if (h) out.push({ crew: c.id, target: h.play.target });
  }
  return out;
}
// What a seat carries aboard, all of it lost if it misses the ferry: its real pieces and its cash, and the crew stash it
// keeps.
function stakeOf(v) {
  const st = v.me.crewStash && v.me.crewStash.keeper === v.me.id ? v.me.crewStash : null;
  const pieces = [...v.me.pieces.filter(p => !p.fake), ...(st ? st.pieces : [])];
  return pieces.reduce((t, p) => t + worth(v, p.trait), 0) + v.me.cash + (st ? st.cash : 0);
}
// A canny seat's last night, but a crew's (cannyCrewWalk): a robber's hit on the walk (finaleHunt), leaving the crews'
// targets to them; else the route it walks (lastRoute). The careless robber reads nothing, as before.
function cannyLastNight(v, ctx, cfg, memo) {
  const me = v.me;
  if (robs(cfg) && me.heat + 1 < N.maxHeat) {
    const power = ownPower(v) + (me.high.includes('temp') ? 1 : 0);
    const skip = new Set(finaleClaims(v, memo).map(x => x.target));
    const h = finaleHunt(v, memo, rng(ctx.seed, 'finale', me.id), { power, side: new Set([me.id]), wanted: me.wanted, stake: stakeOf(v), skip, guess: rng(ctx.seed, 'finale-guess', me.id) });
    if (h) return { play: h.play, reason: h.reason };
  }
  return boardBy(v, cfg, 1 + (armed(v) ? 1 : 0) + (me.high.includes('temp') ? 1 : 0));
}
// The board play by lastRoute.
function boardBy(v, cfg, group) {
  const route = lastRoute(v, cfg, group);
  return { play: { kind: 'board', place: route }, reason: route === cfg.route ? `board through ${route}` : `board through ${route}, the best-guarded route, whose cops hold off whoever could take what it carries` };
}
// A crew's last night (crewNight's, once the vault is out): its leader hits on the walk with its crew (finaleHunt),
// leaving a stronger crew's target to it; else it walks the route lastRoute gives its group. Its free members walk
// with it (crewNight); a member whose leader isn't free walks alone.
function cannyCrewWalk(v, ctx, cfg, memo) {
  const me = v.me;
  const own = 1 + (armed(v) ? 1 : 0) + (me.high.includes('temp') ? 1 : 0);
  if (cfg.role !== 'leader') return boardBy(v, cfg, own);
  const mates = cfg.mates.filter(id => freeAgent(agentOf(v, id)));
  const group = mates.map(id => agentOf(v, id));
  // A crime on the walk adds a star to everyone in it, and 5 stars at the dock is an arrest (§13, §15).
  if ([me, ...group].every(a => a.heat + 1 < N.maxHeat)) {
    const claims = finaleClaims(v, memo);
    const mine = claims.findIndex(x => x.crew === me.crew);
    const skip = new Set(claims.slice(0, mine < 0 ? claims.length : mine).map(x => x.target));
    const st = me.crewStash;
    const stake = stakeOf(v) + (st && st.keeper !== me.id ? st.cash : 0);
    const h = finaleHunt(v, memo, null, { power: groupPower(v, mates), side: new Set([me.id, ...cfg.mates]), wanted: [me, ...group].some(a => a.wanted), stake, skip, guess: rng(ctx.seed, 'finale-guess', me.id) });
    if (h) return { play: h.play, reason: `crew job: ${h.reason}` };
  }
  return boardBy(v, cfg, own + group.reduce((t, a) => t + seenStrength(v, a, false), 0));
}

// --- the cast: who plays what, from the seed ----------------------------------------------------------------------------
export const DEFAULT_MIX = { hustle: 8, buylate: 3, turtle: 3, scout: 5, guess: 4, crew: [4, 3] };
// Bot settings, not game numbers: how often a crew's bad apple turns, rugs or walks.
export const CREW_ODDS = { turn: 0.35, rug: 0.5, walk: 0.35 };
const NAMES = [
  'penny', 'vex', 'mo', 'kit', 'juno', 'dash', 'rook', 'zee', 'lux', 'nico', 'brix', 'cass', 'dez', 'echo', 'fitz',
  'gigi', 'hex', 'ivy', 'jax', 'koko', 'lark', 'milo', 'nova', 'otto', 'pip', 'quin', 'rue', 'sly', 'tex', 'uma',
  'vale', 'wren', 'xan', 'yuki', 'zora', 'ace', 'bo', 'cyd', 'dot', 'eli',
];

// Layer 2's cast (§25: each trade and a cop, beside layer 1's types), 30 seats:
// - 3 Smugglers for the 4 drops, so two can work the chem drops alone and one the parts;
// - 3 Chemists, whose 2 batches a night (4 chems) use what the two chem drops yield (12);
// - 4 Dealers for the 8 corners, so the hot ones are contested without every Dealer fighting every night;
// - 2 Gunrunners, enough for a median while nobody wants guns (L2-3); a Cop seat that hustles until L2-3;
// - layer 1's types, fewer of each: 3 hustlers (the money bar's yardstick), 2 buy-late savers, 2 turtles, 2 scouts,
//   a guesser, and both crews (4 and 3), whose snakes and jobs carry the betrayals and the crime.
export const LAYER2_MIX = {
  smuggler: 3, chemist: 3, dealer: 4, gunrunner: 2, cop: 1, hustle: 3, buylate: 2, turtle: 2, scout: 2, guess: 1, crew: [4, 3],
  layer: 2,
};
// L2-6's cast, every seat trades (GAME.md §9: every agent picks a trade on day 0 and starts with its kit): layer 2's 30
// seats, seed by seed, and §25's strategies, with a trade for every seat.
// - Each trade's own bot and the Cop seat keep theirs and play as they did.
// - The hustlers (and the squatter) are §27's yardstick and hustle every night: Cops on paper, the one trade
//   outside the goods chain, so no seller waits on them.
// - The buy-late savers, turtles, scouts, the guesser and both crews (WORKS) work theirs on any night their strategy
//   leaves free. GAME.md gives no split, so it's even: the seed deals them what fills each trade to six of the 30.
export const TRADES_MIX = { ...LAYER2_MIX, every: true };
// L3-5's cast, layer 3 in play: the trades cast's seats and habits, and every seat buys, sells and takes the six drugs
// for its own reasons (the L3-5a section above), and tips, rats, bribes, posts bounties and hires lookouts for its own
// gain (the L3-5b section). The seed deals two roles from a stream of their own, so every seat is the trades cast's:
// one robber has a habit (it takes TEMP whenever it holds one), and one seat that works the Chemist trade sells SUDO as
// TEMP.
export const LAYER3_MIX = { ...TRADES_MIX, drugs: true };
// L4-4's cast, layer 4 in play: the layer3 cast's seats, roles and habits, and every seat plays the big score for its
// own gain (the L4-4 section above).
export const LAYER4_MIX = { ...LAYER3_MIX, score: true };
// R2-8's cast (brief R2-agents.md, task 8): the layer4 cast with `models` of its seats played by a model (the runner's
// --model-seats). Until slime answers Q4, a model plays only seats of the trade bots and §25's strategies (MODEL_TYPES),
// never a crew member (crews are scripted together) or a hustler (§27's yardstick). The seed picks which, from a
// stream of its own, so every seat is the layer4 cast's. On the board (Q5) every bot's driver reads `bot`, with no
// strategy, and a model seat's the model's name (driverOf), so the Cop bots follow the lowest-id Cop (policePlan).
export const MODELS_MIX = { ...LAYER4_MIX, models: 0 };
// R3-2's cast, crime played as a sensible player plays it (trunk docs/briefs/R3-crime-pays.md): the layer4 cast's
// seats, roles and habits, and three habits R3-1 found its robbers lack (`sharp`). A robber robs when it can win and the
// take beats a night's wage, broke or not; everyone reads a home off its owner's public holdings record (a robber, a
// crew's leader, and whoever reckons a crew's job or tips the cops on one), a jailed agent's home among them, and needs
// no lookout for that; and a robber's first gear is what lets it win alone. `careless` (R3-2's skill test, the bench
// only): the robber with that number, counting the cast's robbers by id from 1, plays carelessly (carelessPlay).
export const CRIME_MIX = { ...LAYER4_MIX, sharp: true };
// R3-6's cast (trunk docs/briefs/R3-crime-pays.md, task 7), the trades played as a sensible trader plays them: the crime
// cast's seats, roles and habits, and the traders' habits R3-5 found its trade seats and crews lack (`canny`: the R3-6
// section above). The same seed deals the same seats as the crime cast.
export const CANNY_MIX = { ...CRIME_MIX, canny: true };
// R5-deals: the models cast over canny (--cast models-canny): the canny cast with `models` of its seats played by a
// model, dealt as the models cast deals them (dealModels). Every bot is canny, so a seat's bot twin is canny too, and
// the twin's cast and provenance are this cast's with no model seat. The models cast itself is unchanged.
export const MODELS_CANNY_MIX = { ...CANNY_MIX, models: 0 };
// The bench's casts, by --cast name. layer1 is the cast layer 1's reports were made with, unchanged.
export const CASTS = { layer1: DEFAULT_MIX, layer2: LAYER2_MIX, trades: TRADES_MIX, layer3: LAYER3_MIX, layer4: LAYER4_MIX, models: MODELS_MIX, crime: CRIME_MIX, canny: CANNY_MIX, 'models-canny': MODELS_CANNY_MIX };
const WORKS = ['buylate', 'turtle', 'scout', 'guess', 'crew'];
const MODEL_TYPES = [...STREET_TYPES, 'buylate', 'turtle', 'scout', 'guess'];

// The models cast's deal: `n` of the seats a model may play, marked `model`; every other seat a bot, marked so too.
function dealModels(seed, cast, n) {
  const open = cast.filter(c => MODEL_TYPES.includes(c.type));
  if (!Number.isInteger(n) || n < 0 || n > open.length) throw new Error(`a model plays 0 to ${open.length} seats of this cast, not ${n}`);
  const mine = new Set(shuffle(rng(seed, 'cast', 'models'), open).slice(0, n));
  for (const c of cast) c.model = mine.has(c);
}

// A seat's driver on the board (§19: what drives each agent): in the models cast `bot` for a bot and the model's name for
// a model seat (Q5); in every other cast the bot's strategy, as before.
export const driverOf = (c, model) => (c.model === undefined ? `bot:${c.type}` : c.model ? model : 'bot');

// The new cast's deal: the WORKS seats, in an order the seed shuffles, take the trades each one is short of an even
// share. Its own stream, so every other draw of the cast is layer 2's.
function dealTrades(seed, cast) {
  const even = cast.length / TRADES.length;
  const free = cast.filter(c => WORKS.includes(c.type));
  const deck = TRADES.flatMap(t => Array(Math.max(0, even - cast.filter(c => c.trade === t && !WORKS.includes(c.type)).length)).fill(t));
  if (deck.length !== free.length) throw new Error(`the cast doesn't split evenly across the ${TRADES.length} trades`);
  shuffle(rng(seed, 'cast', 'trades'), free).forEach((c, i) => Object.assign(c, { trade: deck[i], works: true }));
}

// The layer3 cast's roles (L3-5a), from a stream of their own: every seat plays the drugs; one robber (a scout or the
// guesser) has a TEMP habit; one seat that works the Chemist trade sells SUDO as TEMP.
function dealDrugs(seed, cast) {
  const r = rng(seed, 'cast', 'drugs');
  for (const c of cast) c.drugs = true;
  const robbers = cast.filter(c => c.type === 'scout' || c.type === 'guess');
  const chemists = cast.filter(c => c.trade === 'chemist' && (c.type === 'chemist' || c.works));
  if (robbers.length) pick(r, robbers).habit = 'temp';
  if (chemists.length) pick(r, chemists).sudo = true;
}

// A seat's favourite patch, where the Cop seat patrols with nothing better to go on (copPlan): drawn from the shift's
// three old workplaces (Glasswall, The Yards, the docks), so a seed deals the same cast as before R11.
const PATCHES = ['downtown', 'industrial', 'docks'];
// The squatter is opt-in (`mix.squatter`, the bench's --squatter): it takes the first hustler's slot, so every
// other agent keeps the id, trade, workplace and route it has without it.
export function makeCast(seed, mix = DEFAULT_MIX) {
  const street = mix.layer === 2;
  const r = street ? rng(seed, 'cast', 'layer2') : rng(seed, 'cast');
  const slots = [];
  for (const type of [...(street ? STREET_TYPES : []), 'hustle', 'buylate', 'turtle', 'scout', 'guess']) {
    for (let i = 0; i < (mix[type] || 0); i++) slots.push({ type: type === 'hustle' && i < (mix.squatter || 0) ? 'squatter' : type });
  }
  (mix.crew || []).forEach((size, k) => {
    for (let i = 0; i < size; i++) slots.push({ type: 'crew', crew: k, role: i === 0 ? 'leader' : 'member' });
  });
  const ids = slots.map((_, i) => `a${String(i + 1).padStart(2, '0')}`);
  const order = shuffle(r, slots);
  const cast = order.map((slot, i) => {
    const id = ids[i];
    // Layer 2: a trade bot holds its trade, and every other bot the Cop trade, the one trade outside the goods chain
    // (§9: it buys from nobody and sells to nobody), so no seller waits on a buyer that never deals. Layer 1 draws one.
    const trade = street ? (TRADE_TYPES.includes(slot.type) ? slot.type : 'cop') : pick(r, TRADES);
    return {
      id, name: NAMES[i % NAMES.length], trade, type: slot.type, crew: slot.crew, role: slot.role,
      fav: pick(r, PATCHES), route: r() < 0.6 ? 'downtown' : r() < 0.75 ? 'industrial' : 'junkyard',
      ...(street ? { layer: 2 } : {}),
    };
  });
  // Crews: everyone knows their crewmates; one member is the snake.
  const crews = {};
  for (const c of cast.filter(x => x.type === 'crew')) (crews[c.crew] ||= []).push(c);
  for (const [k, members] of Object.entries(crews)) {
    const leader = members.find(m => m.role === 'leader');
    const snake = pick(r, members.filter(m => m.role !== 'leader'));
    for (const m of members) {
      m.leader = leader.id;
      m.mates = members.filter(x => x.id !== m.id).map(x => x.id);
      m.crewName = `crew ${Number(k) + 1}`;
      m.snake = m === snake;
      m.fav = leader.fav;
      m.route = leader.route;
      Object.assign(m, CREW_ODDS);
    }
  }
  if (mix.every) dealTrades(seed, cast);
  if (mix.drugs) dealDrugs(seed, cast);
  if (mix.score) for (const c of cast) c.score = true;
  if (mix.sharp) for (const c of cast) c.sharp = true;
  if (mix.canny) for (const c of cast) c.canny = true;
  if (mix.careless) {
    const robber = cast.filter(c => robs(c)).sort(byNum)[mix.careless - 1];
    if (!robber) throw new Error(`no robber number ${mix.careless} in this cast`);
    robber.careless = true;
  }
  if ('models' in mix) dealModels(seed, cast, mix.models);
  return cast;
}
