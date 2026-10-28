// Views (GAME.md §19, §23): built from an allow-list per audience, never by copying the state. One rule: live, you see
// the board and the street; 24 hours later, you see everything. Agents' tools return exactly what their owner can see,
// and an owner's own AI gets the same minus other agents' words (typed facts only, §18).
// audience: 'agent' (the same as 'owner'), 'owner', 'ownerAI', 'public', and 'record' (the 24-hour record: the board
// and everything that has gone public, from day 0).
import { N } from '../numbers.mjs';
import { memoryOf, publicMemories } from './memory.mjs';
import {
  DISTRICTS, agentIds, byId, piecesOf, crewPieces, wornOf, wears, listLeft, levelTonight, lastPrice, LAST_NIGHT,
  messageLimit, sortGoods, walkOf, DRUGS, DAY15, tookToday, relabel, drugsAsDoses, clone, promiseState,
  HUSTLE_HOW, hustleTake, hustleStar,
} from './state.mjs';
import { legalPlays, onRecord } from './plays.mjs';
import { priceOf, marketItems, runOf, dropSplit, gathers } from './market.mjs';
import { actionState } from './errand.mjs';
import { fenceBoard, fenceMine } from './fence.mjs';
import { dealsFor, dealtFor, streetPrices } from './deals.mjs';
import { personStrength, HOME } from './fights.mjs';
import { showPlays, morningCards } from './show.mjs';

const FREE_TEXT = new Set(['line', 'reason', 'creed']);
const AUDIENCES = ['agent', 'owner', 'ownerAI', 'public', 'record'];
const SPEECH = new Set(['ask', 'say', 'decline', 'chat', 'outloud', 'overheard']);

// A field of a view that is built the first time it's read (or written), then stays a plain field. It's enumerable in
// its place, so a spread, JSON or a clone of the view reads it like any other.
function lazy(o, key, build) {
  const settle = value => Object.defineProperty(o, key, { value, writable: true, enumerable: true, configurable: true });
  Object.defineProperty(o, key, {
    enumerable: true, configurable: true,
    get() { const value = build(); settle(value); return value; },
    set(value) { settle(value); },
  });
}

export function viewFor(s, log, who = null, audience = 'agent') {
  if (!AUDIENCES.includes(audience)) throw new Error(`unknown audience ${audience}`);
  const nobody = audience === 'public' || audience === 'record';
  const me = nobody ? null : who;
  if (!nobody && !s.agents[me]) throw new Error(`no agent ${who}`);
  const T = s.clock;
  // §11, CLEAR: the agent forgets its private events from before the take until they go public (GAP gap.clear).
  const wiped = me && s.agents[me].wiped;
  const sees = e => e.vis.to === 'all' || e.vis.pub <= T || (me && e.vis.to.includes(me) && !(wiped && e.n < wiped.n));
  const recent = e => audience === 'record' || e.t >= T - 4;
  const sat = me ? satDownWith(s, me) : new Set();
  // §11, call 2: SUDO is sold as TEMP: its taker reads its take as TEMP until the night settles, and the agent it was
  // handed to reads the hand-over as TEMP until it goes public (GAP gap.sudo).
  const sold = e => !!me && (e.type === 'take' ? e.agent === me && !!e.writer && T <= e.t
    : e.type === 'give' && e.to === me && !!(e.goods && e.goods.sudo) && T < e.vis.pub);
  const cards = morningCards(log, T);
  const events = log.filter(e => recent(e) && (sees(e) || cards.has(e.n))).map(e => {
    const copy = sees(e) ? copyEvent(e, audience === 'ownerAI', e.vis.to === 'all' && e.agent !== me && T < Math.min(e.t + 2, DAY15), sold(e))
      : { n: e.n, t: e.t, day: e.day, type: 'card' };
    if (e.type === 'show') copy.plays = showPlays(e, log);
    if (cards.has(e.n)) copy.card = cards.get(e.n);
    return copy;
  });
  const v = {
    audience, day: s.day, clock: T, over: s.over, rule: s.rule, midseason: s.midseason,
    nightsLeft: Math.max(0, LAST_NIGHT - s.day + (s.clock % 2 === 0 ? 1 : 0)),
    board: board(s, log, T, me, sat),
    sightings: sightings(log, T),
    // §11, §19: an event public at once names no drug in its first 24 hours (to day 15 for the last night's), except
    // to the agent it's about (GAP gap.doses).
    events,
  };
  // R9d (slime, 10-20: "Yes, show it"): street prices, from the settled record as it stood now (it only grows), built
  // when first read, so a bot or the night that never reads it never pays for it (deals.mjs streetPrices).
  const done = s.dealsDone || [];
  const settledNow = done.length;
  const today = s.day;
  lazy(v.board, 'street', () => streetPrices(done.slice(0, settledNow), today));
  // §14, §19, §20: today's out-loud lines are on the board for the day, as the view's record shows them (GAP
  // gap.outloud).
  v.board.outloud = clone(v.events.filter(e => e.type === 'outloud' && e.day === s.day).map(({ n, t, day, type, ...said }) => said));
  if (me) {
    v.me = mine(s, me);
    // The event ledger owns transfers. Keep the player's visible receipts available after the recent-news window,
    // including after a sit-down closes; CLEAR and SUDO use exactly the event view's visibility and masking above.
    v.me.transactions = log.filter(e => ['pay', 'give'].includes(e.type) && (e.from === me || e.to === me) && sees(e))
      .map(e => copyEvent(e, true, false, sold(e)));
    // Exact speech remains retrievable after the news window. This is another projection of the same ledger,
    // with exactly the same visibility, CLEAR, live-drug and SUDO masking as events above, never a second memory.
    // The archive (speech, history) is built when first read, from the ledger as it stood when this view was built
    // (the log only grows), so a caller that never reads it (a bot, the night) never pays for it.
    const at = log.length;
    const shown = e => copyEvent(e, audience === 'ownerAI', e.vis.to === 'all' && e.agent !== me && T < Math.min(e.t + 2, DAY15), sold(e));
    lazy(v.me, 'speech', () => log.slice(0, at).filter(e => SPEECH.has(e.type) && sees(e))
      .flatMap(e => {
        const said = shown(e);
        if (said.type !== 'overheard') return [{ ...said, speechId: `speech:${e.n}:0` }];
        const { said: words, ...where } = said;
        return (words || []).map((message, i) => ({ ...where, ...message, n: said.n, observedDay: said.day,
          observedAt: said.t, participants: [said.a, said.b], speechId: `speech:${e.n}:${i}` }));
      }));
    lazy(v.me, 'history', () => log.slice(0, at).filter(e => e.type !== 'season' && sees(e)).map(shown));
    // R9c (slime, 10-19: "Show hit strength numbers"): the fight numbers, built when first read, from this view alone.
    lazy(v.me, 'fight', () => fightOf(v));
    // R9e (slime, 10-20: "Run numbers, then test"): the run numbers, built when first read, from this view alone.
    lazy(v.me, 'run', () => runNumbersOf(v));
    // R11: the hustle numbers, built when first read, from this view alone.
    lazy(v.me, 'hustle', () => hustleNumbersOf(v));
    v.me.actions = actionState(s, me);
    v.legal = legalPlays(s, me);
  }
  return audience === 'ownerAI' ? typedOnly(v) : v;
}

// §18: an owner's own AI gets typed facts only. Free text is `line` (a sit-down's, crew chat's or out loud's),
// `reason`, and a crew's name.
function typedOnly(v) {
  const out = stripFreeText(v);
  for (const c of out.board.crews) delete c.name;
  for (const events of [out.events, out.me?.history || [], out.me?.speech || []]) {
    for (const e of events) if (e.type === 'crew') delete e.name;
  }
  return out;
}

// §14, §19 (R4-3): a pair sits down on a day both of them act in the sit-down: the ask and its answer that day, or, in
// one that lasts, a word from each. What a sit-down shows its partner (a hoodie's fit, TRUTH's play) shows to the agents
// an agent sat down with today, as when sit-downs ended at dawn.
const satToday = (s, sd) => sd.state === 'open' && (sd.met === undefined || sd.met === s.day);

// Everyone at the same sit-down today sees past a hoodie (§4 placeholder).
function satDownWith(s, me) {
  const out = new Set();
  for (const sd of Object.values(s.sitdowns)) {
    if (!satToday(s, sd)) continue;
    if (sd.a === me) out.add(sd.b);
    if (sd.b === me) out.add(sd.a);
  }
  return out;
}

function piece(s, k) {
  const c = s.copies[k];
  return { copy: k, trait: c.trait, slot: c.slot, tier: c.tier };
}
// §4, §19 (layer 4): who can tell a fake, when the view is built: its maker, wherever the view lists it, and an agent
// wearing shades, about the pieces other agents wear (`other`). Everyone else reads a real piece (GAP gap.fakes).
function pieceFor(s, me, k, other = false) {
  const c = s.copies[k];
  const tells = !!me && !!c.fake && (c.maker === me || (other && wears(s, me, 'shades')));
  return tells ? { ...piece(s, k), fake: true } : piece(s, k);
}

// The board (§20, §19's "everyone, live" row): the list, fits, heat, who's wanted, who's evicted and their rent tabs
// (gap.rentTab), police levels, the vault, crews.
function board(s, log, T, me, sat) {
  const next = Object.keys(N.shipments).map(Number).sort((a, b) => a - b).find(night => 2 * night >= T);
  return {
    startingStake: s.stake ?? 0,
    memories: publicMemories(log, T),
    list: Object.keys(s.traits).sort(byId).map(id => {
      const t = s.traits[id];
      return {
        trait: id, slot: t.slot, name: t.name, tier: t.tier, ability: t.ability, opens: t.opens, price: t.price,
        floor: t.floor, last: t.last, left: listLeft(s, id),
      };
    }),
    // §19: every sale on the list (who, what, how much) is public at dawn, never which copy: the ledger keeps that.
    sales: log.filter(e => e.type === 'buy').map(e => ({ night: e.night, agent: e.agent, trait: e.trait, price: e.price })),
    agents: agentIds(s).map(id => {
      const a = s.agents[id];
      const hidden = id !== me && wears(s, id, 'hoodie') && !sat.has(id);
      return {
        id, name: a.name, trade: a.trade, driver: a.driver, heat: a.heat, wanted: a.heat >= N.wantedAt,
        jailed: !!a.jail, bail: a.jail ? a.jail.stars * N.bailPerStar : null, evicted: a.evicted, tab: a.tab, crew: a.crew,
        boarded: a.boarded, fit: hidden ? null : wornOf(s, id).map(k => pieceFor(s, me, k, id !== me)), fitHidden: hidden,
        // §11: how it walks on what it took today, never the drug (GAP gap.high).
        walk: walkOf(s, id),
      };
    }),
    police: Object.fromEntries(DISTRICTS.map(d => [d, s.districts[d].level])),
    tonight: s.day <= LAST_NIGHT ? Object.fromEntries(DISTRICTS.map(d => [d, levelTonight(s, d, s.day)])) : null,
    vault: {
      pieces: Object.keys(s.copies).filter(k => s.copies[k].holder.k === 'vault').sort(byId).map(k => piece(s, k)),
      cash: s.vault.cash,
    },
    crews: Object.values(s.crews).sort((x, y) => byId(x.id, y.id)).map(c => ({ id: c.id, name: c.name, members: c.members.slice() })),
    // §9, §19: every corner and who holds it, live.
    corners: Object.keys(N.corners).sort(byId).map(c => ({ corner: c, place: N.corners[c].place, hot: N.corners[c].hot, holder: s.corners[c].holder })),
    // §9: the next unit's price at the city's shop and its buyer, live (GAP gap.marketSeen).
    market: Object.fromEntries(['shop', 'buyer'].map(side => [side, Object.fromEntries(marketItems(side).map(k => [k, priceOf(side, k, s.market[side][k])]))])),
    // R9e: the steps each item has moved along the shop's and the buyer's curves, live, from which board.market's prices
    // come (market.mjs priceOf), so a quantity's total on the published curve is exact (market.mjs runOf).
    marketSteps: Object.fromEntries(['shop', 'buyer'].map(side => [side, Object.fromEntries(marketItems(side).map(k => [k, s.market[side][k]]))])),
    // §9: what's in the crate at the docks, posted that morning, until someone grabs it; live, its drugs are doses (§11).
    crate: s.crate ? { cash: s.crate.cash, goods: drugsAsDoses(s.crate.goods) } : null,
    // §9, §19: tonight counts until it has run. Only the night is announced; contents still wait for its morning.
    nextShipment: next === undefined ? null : { night: next },
    // §9, §19: the fence's listings, live: the piece and the price, never the seller.
    fence: fenceBoard(s),
    // §10, §19: the bounties, live: the piece or the agent, and the amount, never who posted one (GAP gap.bounty).
    bounties: s.bounties.map(b => bountyRow(s, b, me)),
  };
}

// A bounty as the board shows it: its piece (as a fit shows one, and a fake to its maker) or its agent, and its amount.
const bountyRow = (s, b, me) => ({ bounty: b.id, ...(b.on.copy ? pieceFor(s, me, b.on.copy) : b.on), amount: b.amount });

// §6: where each agent was on each of the last 3 nights, as far as the show made it public.
function sightings(log, T) {
  const shows = log.filter(e => e.type === 'show' && e.vis.to === 'all' && e.t < T).slice(-3);
  const out = {};
  for (const e of shows) {
    for (const [id, place] of Object.entries(e.seen)) (out[id] ||= []).push({ night: e.night, place });
  }
  return out;
}

function mine(s, id) {
  const a = s.agents[id];
  const c = a.crew ? s.crews[a.crew] : null;
  const worn = new Set(wornOf(s, id));
  return {
    memory: memoryOf(s, id),
    id, name: a.name, trade: a.trade, cash: a.cash, goods: sortGoods(a.goods), heat: a.heat, wanted: a.heat >= N.wantedAt, evicted: a.evicted,
    tab: a.tab, jail: a.jail ? { ...a.jail, bail: a.jail.stars * N.bailPerStar } : null, crew: a.crew, vestUsed: a.vestUsed,
    // §11: SUDO, sold as TEMP, reads as TEMP to its taker (GAP gap.sudo).
    high: DRUGS.filter(d => tookToday(a, d) && d !== 'sudo'), hooked: a.hooked.slice(), crash: a.crash,
    messagesLeft: Math.max(0, messageLimit(s, id) - a.msgs), outLoudLeft: Math.max(0, N.outLoud - (a.outLoud || 0)), listenedToday: a.listening === s.day,
    pieces: piecesOf(s, id).map(k => ({ ...pieceFor(s, id, k), ability: s.traits[s.copies[k].trait].ability, worn: worn.has(k), last: lastPrice(s, k) })),
    crewStash: c ? { crew: c.id, keeper: c.keeper, cash: c.cash, goods: sortGoods(c.goods), pieces: crewPieces(s, c.id).map(k => pieceFor(s, id, k)), invites: c.invites.slice() } : null,
    invitedTo: Object.values(s.crews).filter(x => x.invites.includes(id)).map(x => x.id).sort(byId),
    offers: s.offers.filter(o => o.by === id && o.trait).map(o => ({ trait: o.trait, amount: o.amount })),
    // §9 (R4-3): its orders at the city's shop and buyer, filled at the lock: a shop order's max is held until then.
    orders: (s.orders || []).filter(o => o.by === id).map(o => ({
      order: o.id, side: o.side, item: o.item, units: o.units, ...(o.side === 'shop' ? { max: o.cash } : {}), ...(o.drug ? { drug: o.drug } : {}),
    })),
    fence: fenceMine(s, id),
    bounties: s.bounties.filter(b => b.by === id).map(b => bountyRow(s, b, id)),
    // §11, TRUTH: everyone the agent sits down with sees its locked play on that sit-down, marked verified (call 3: the
    // plan card is R2's; GAP gap.truth), without a HALLU cook's lies, which are the cook's own (GAP gap.hallu).
    // R4-3 (sitdownDays): each with the day it was asked, its last day open and the last day the two met; a message's
    // terms tied to a night are marked expired once that night's lock has passed. R5-terms: a message that made a
    // promise still on the record reads that promise's own state instead (promiseOf), so a cut still owed never reads
    // as expired.
    sitdowns: Object.values(s.sitdowns).filter(sd => sd.a === id || sd.b === id).sort((x, y) => byId(x.id, y.id)).map(sd => {
      const other = s.agents[sd.a === id ? sd.b : sd.a];
      // §11, CLEAR: the words said in it before the take, that day; older ones are everyone's by then (GAP gap.clear).
      const cut = a.wiped && (a.wiped.day === undefined || a.wiped.day === s.day) ? a.wiped.said[sd.id] || 0 : 0;
      const said = sd.said.map((m, i) => [m, i]).filter(([m, i]) => i >= cut || m.day < s.day).map(([m, i]) => {
        const p = s.promises.find(x => x.sitdown === sd.id && x.message === i);
        const st = p ? promiseOf(p) : null;
        return {
          ...m, terms: { ...m.terms }, ...(st ? { promise: { id: p.id, ...st } } : {}),
          ...((!st || st.state === 'open') && expired(s, m) ? { expired: true } : {}),
        };
      });
      return {
        id: sd.id, with: other.id, asked: sd.a === id ? 'me' : 'them', state: sd.state, day: sd.day, until: sd.until, met: sd.met ?? null,
        acted: sd.acted && sd.acted.day === s.day ? [...sd.acted.ids] : [],
        said,
        ...(satToday(s, sd) && other.locked ? { verified: onRecord(other.locked), verifiedPlan: memoryOf(s, other.id).plan } : {}),
      };
    }),
    promises: s.promises.filter(p => p.by === id || p.to === id).map(p => ({
      id: p.id, by: p.by, to: p.to, what: p.what, who: p.who, night: p.night, cash: p.cash, ...promiseOf(p),
    })),
    // R5-deals (deals.mjs): the deals it's in, from its sit-downs' typed terms and the hand-overs since, until each
    // settles, after its sit-down too.
    deals: dealsFor(s, id),
    // R9: its agreed deals that have settled or ended, with how, so the record of who it dealt with outlives the
    // sit-down (deals.mjs dealtFor).
    dealt: dealtFor(s, id),
  };
}

// §19: each other agent's last play on the record, as the seat's view has it: a night's plays go public 24 hours after
// it, so last night's is nobody's yet. One reading for the island line's "played" and the fight numbers' patrols.
export function playsOnRecord(v) {
  const out = {};
  for (const e of v.events) if (e.type === 'play' && e.agent !== v.me.id && e.t < v.clock - 1) out[e.agent] = e;
  return out;
}

// R9c (§8, §33; slime, 10-19: "Show hit strength numbers"): the fight numbers as the seat's view shows them, built from
// the view alone (its own state, the board and the events it sees), never from the state, so a number here can differ
// from what the fights count at the lock. Facts only: the seat's own state, public facts and exact rules.
// - you: its per-person strength (rules/fights.mjs personStrength), attacking and defending, and the parts counted, as
//   its own view reads them: SUDO taken reads as TEMP (tookToday), a fake it can't tell reads real, and a piece its view
//   marks fake adds nothing (`onTemp`: TEMP taken today, as it reads). `held`: what it holds that can change tonight's
//   count: TEMP doses (none once one was taken today: one dose of each drug a day), lockpicks (+1 to a break-in, used
//   up) and knuckles held but not worn. `ordered`: the guns and lockpicks on its open orders at the city's shop, which
//   fill at the lock before the fights (night.mjs clearMarket), so one that comes counts tonight; an order can come
//   back short. No key is a drug's bare name (drugs.test.mjs reads every view for one).
// - others: every other agent on what this view sees: 1, +1 for a gun on the latest of its holdings record (the island
//   line's "had") and the seat's own lookout's look at it (`source` 'record' or 'look', `day` its day; in log order,
//   the later wins), +1 if it walks wired, which SUDO does too (walks) and shades hide. Backers, patrols, tips and any
//   gun or dose since that record or look aren't public.
// - patrols (R9d): every other agent whose last play on the record (playsOnRecord, the island line's "played") is a
//   patrol, with its district and night, by id. Tonight's patrols aren't public.
// - cops: tonight's levels (board.tonight, night 7's event in it): the heavy and lawless districts, and what the city
//   cops add (copsHeavy, copsWanted); a bribed fight has none (fights.mjs copsFor).
// - tie: GAP gap.jump as the fights read it: 'alone', or the whole number a hit's attacking group adds.
// - home: what a home adds to the strength of everyone home in its defence (fights.mjs HOME).
function fightOf(v) {
  const me = v.me;
  const knuckles = me.pieces.filter(p => p.ability === 'knuckles' && !p.fake);
  const own = { gun: (me.goods.guns || 0) > 0, onTemp: me.high.includes('temp'), knuckles: knuckles.some(p => p.worn) };
  const count = x => ({ gun: x.gun, temp: x.onTemp, knuckles: x.knuckles });
  const record = {};
  for (const e of v.events) if ((e.type === 'holdings' || (e.type === 'look' && e.by === me.id)) && e.agent !== me.id) record[e.agent] = e;
  const ordered = item => me.orders.filter(o => o.side === 'shop' && o.item === item).reduce((t, o) => t + o.units, 0);
  const levels = v.board.tonight || v.board.police;
  const at = level => DISTRICTS.filter(d => levels[d] === level);
  return {
    you: {
      attacking: personStrength(count(own), true), defending: personStrength(count(own), false), ...own, wanted: me.wanted,
      held: { tempDoses: own.onTemp ? 0 : me.goods.temp || 0, lockpicks: me.goods.lockpicks || 0, knuckles: own.knuckles ? 0 : knuckles.length },
      ordered: { guns: ordered('guns'), lockpicks: ordered('lockpicks') },
    },
    others: v.board.agents.filter(a => a.id !== me.id).map(a => {
      const h = record[a.id];
      const seen = { gun: !!h && (h.goods.guns || 0) > 0, onTemp: a.walk === 'wired' };
      return {
        id: a.id, strength: personStrength(count(seen), false), gun: seen.gun, source: h ? (h.type === 'look' ? 'look' : 'record') : null,
        day: h ? h.day : null, wired: seen.onTemp,
      };
    }),
    patrols: Object.values(playsOnRecord(v)).filter(e => e.kind === 'patrol').map(e => ({ id: e.agent, place: e.place, night: e.day }))
      .sort((x, y) => byId(x.id, y.id)),
    cops: { heavy: at('heavy'), lawless: at('lawless'), heavyAdds: N.copsHeavy, wantedAdds: N.copsWanted },
    tie: N['gap.jump'],
    home: { ...HOME },
  };
}

// R9e (§9, §33; slime, 10-20: "Run numbers, then test"): the run numbers as the seat's view shows them, built from the
// view alone (its own state, the board, the sightings and the events it sees), never from the state; null when tonight's
// legal plays have no run. Facts only: the seat's own state, public facts and exact rules.
// - drops: each drop on its legal runs, in their order (the menu's), with its kind and the Smugglers (by the board's
//   trades) the show saw at its place last night (sightings, by id, the seat left out): where the show saw them, never
//   their plays. `jailed`: those of them in jail now, who have no play tonight. `alone` and `with`: the seat's units by
//   the drop's split for tonight's night (market.mjs dropSplit, so the leftovers go round as they will tonight), alone
//   and with every one of them not in jail, plus work boots worn as its view reads them (a piece its view marks fake
//   adds nothing; market.mjs gathers). Who runs tonight isn't public.
// - prices: for each kind those drops hold, in their order, the street price (board.street, R9d) or null, and for each
//   number of units in `alone` and `with` above 0, largest first, that many at the street price (low and high) and the
//   city's buyer's total on its published curve from its step now (board.marketSteps, market.mjs runOf). Other sellers'
//   orders the same day fill with the seat's at the lock, at one price a unit for all, so they can lower it.
function runNumbersOf(v) {
  const me = v.me;
  const places = v.legal.filter(p => p.kind === 'run').map(p => p.place);
  if (!places.length) return null;
  const night = v.day;
  const shown = v.events.some(e => e.type === 'show' && e.night === night - 1);
  const workboots = me.pieces.some(p => p.ability === 'workboots' && p.worn && !p.fake);
  const trade = Object.fromEntries(v.board.agents.map(a => [a.id, a]));
  const seenAt = place => Object.keys(v.sightings).filter(id => id !== me.id && trade[id]?.trade === 'smuggler'
    && v.sightings[id].some(x => x.night === night - 1 && x.place === place)).sort(byId);
  const share = ids => gathers(dropSplit([...ids, me.id], night)[me.id], workboots);
  const drops = places.map(place => {
    const seen = seenAt(place);
    const jailed = seen.filter(id => trade[id].jailed);
    return { place, kind: N.drops[place], seen, jailed, alone: share([]), with: share(seen.filter(id => !jailed.includes(id))) };
  });
  const prices = [...new Set(drops.map(d => d.kind))].map(kind => {
    const r = v.board.street.kinds.find(x => x.kind === kind);
    const street = r ? { low: r.low, high: r.high, deals: r.deals, units: r.units } : null;
    const step = v.board.marketSteps.buyer[kind];
    const units = [...new Set(drops.filter(d => d.kind === kind).flatMap(d => [d.alone, d.with]))].filter(u => u > 0).sort((x, y) => y - x);
    return {
      kind, street, buyerStep: step,
      totals: units.map(u => ({ units: u, street: street ? { low: u * street.low, high: u * street.high } : null, buyer: runOf('buyer', kind, step, u) })),
    };
  });
  return { night, seenNight: shown ? night - 1 : null, dropUnits: N.dropUnits, workboots, bootsAdd: N.workboots, drops, prices };
}

// R11: the hustle numbers, on a night a hustle is on the agent's menu, from the view alone (null otherwise):
// - districts: each district's police level tonight (the board), its kind (`how`), the take of a hustle there with
//   nobody else hustling there (state.mjs hustleTake, doubled on Payday) and the star it adds (hustleStar; a Cop's
//   patrol adds one anywhere, and tonight's patrols aren't public);
// - crowd and floor: what each other agent hustling in the same district takes off, and the least a hustle takes;
// - top: the highest take alone tonight, its districts and their star; noStar: the same among the districts that add
//   no star, or null when every district adds one;
// - last: last night's hustles by district, from the public hustle events: the kind, the level, who and the take
//   each; null when no night has been played, an empty list when nobody hustled.
function hustleNumbersOf(v) {
  if (!v.legal.some(p => p.kind === 'hustle')) return null;
  const payday = v.day === 7 && v.midseason === 'payday';
  const districts = DISTRICTS.map(place => {
    const level = v.board.tonight[place];
    return { place, how: HUSTLE_HOW[place], level, take: hustleTake(level, 0, payday), star: hustleStar(level) };
  });
  const highest = list => {
    if (!list.length) return null;
    const take = Math.max(...list.map(d => d.take));
    const at = list.filter(d => d.take === take);
    return { take, places: at.map(d => d.place), star: Math.max(...at.map(d => d.star)) };
  };
  const played = v.events.filter(e => e.type === 'hustle' && e.night === v.day - 1);
  const places = DISTRICTS.filter(d => played.some(e => e.place === d)).map(place => {
    const here = played.filter(e => e.place === place).sort((x, y) => byId(x.agent, y.agent));
    return { place, how: here[0].how, level: here[0].level, agents: here.map(e => e.agent), take: here[0].take };
  });
  return {
    night: v.day, payday, crowd: N.hustle.crowd, floor: N.hustle.floor, districts,
    top: highest(districts), noStar: highest(districts.filter(d => !d.star)),
    last: v.day > 1 ? { night: v.day - 1, places } : null,
  };
}

// §14 (R4-3): a message's terms tied to a night expire at that night's lock.
const expired = (s, m) => !!m.terms && Number.isInteger(m.terms.night) && s.clock > 2 * m.terms.night;
// §12 (R5-terms): a promise's standing, as its own record keeps it (state.mjs promiseState): 'open', 'owed' or 'paid',
// and once its cut fell due, the dollars paid and still owed, and the day at whose dawn a cut still owed counts as
// walked out on.
const promiseOf = p => {
  const st = promiseState(p);
  return { state: st.state, ...(st.state === 'open' ? {} : { paid: p.paid, owed: st.owed, walkAt: st.walkAt }) };
};

// Events are typed records whose visibility was set when they happened; a view copies them, and the owner's AI gets
// them without free text. A list sale (`buy`) shows who, what and how much, never which copy (§19), to every audience
// and on every path that copies an event (events, history, transactions, speech). `live`: its goods show their drugs
// only as doses. `sold`: SUDO shows as the TEMP it was sold as, and its writer not at all.
function copyEvent(e, typedOnly, live, sold) {
  const copy = jsonCopy(e, 'vis');
  if (copy.type === 'buy') delete copy.copy;
  if (typedOnly) stripText(copy);
  if (sold && copy.type === 'take') copy.drug = 'temp';
  if (sold) delete copy.writer;
  if (sold && copy.goods) copy.goods = sortGoods(relabel(copy.goods, k => (k === 'sudo' ? 'temp' : k)));
  if (live) hideDrugs(copy);
  return copy;
}

// What JSON.parse(JSON.stringify(x)) gives for the ledger's plain records (objects, arrays, strings, finite numbers,
// booleans, null), without the string between; anything else takes the JSON round trip itself. `skip` applies only
// at the top: nested objects are copied whole.
const NOT_PLAIN = Symbol('not plain');
function plain(x, skip = null) {
  if (x === null || typeof x === 'string' || typeof x === 'boolean') return x;
  if (typeof x === 'number') return Number.isFinite(x) ? (x === 0 ? 0 : x) : null;
  if (typeof x !== 'object') throw NOT_PLAIN;
  if (Array.isArray(x)) {
    const out = new Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = plain(x[i]);
    return out;
  }
  if (Object.getPrototypeOf(x) !== Object.prototype || typeof x.toJSON === 'function') throw NOT_PLAIN;
  const out = {};
  for (const k of Object.keys(x)) {
    const y = x[k];
    if (k === '__proto__') throw NOT_PLAIN;
    if (k === skip || y === undefined || typeof y === 'function' || typeof y === 'symbol') continue;
    out[k] = plain(y);
  }
  return out;
}
// `skip`: a top-level key left out, as if deleted from the copy.
function jsonCopy(x, skip = null) {
  try {
    return plain(x, skip);
  } catch (err) {
    if (err !== NOT_PLAIN) throw err;
    const copy = JSON.parse(JSON.stringify(x));
    if (skip !== null) delete copy[skip];
    return copy;
  }
}

// Every goods map in an event, however deep, its drugs as doses. The log keeps the drug (GAP gap.doses).
function hideDrugs(x) {
  for (const k of Object.keys(x)) {
    if ((k === 'goods' || k === 'goodsLeft') && x[k] && typeof x[k] === 'object') x[k] = drugsAsDoses(x[k]);
    else if (x[k] && typeof x[k] === 'object') hideDrugs(x[k]);
  }
}
function stripText(x) {
  if (Array.isArray(x)) x.forEach(stripText);
  else if (x && typeof x === 'object') {
    for (const k of Object.keys(x)) {
      if (FREE_TEXT.has(k)) delete x[k];
      else stripText(x[k]);
    }
  }
}

export function stripFreeText(v) {
  const copy = JSON.parse(JSON.stringify(v));
  stripText(copy);
  return copy;
}
