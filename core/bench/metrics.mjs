import { actionCounters, acquisitionProfile } from './evidence.mjs';
// A season's numbers for the match report (GAME.md §25): who won, the biggest stories, money by trade, the police, the
// fence, the drugs, the tricks and the big score, read off the event log, the final state and the runner's per-night
// bench data; nothing is re-simulated. §27's pass bars, and the measures they read (haul, a take's worth, distinct
// seasons), are passbars.mjs's: this module takes them from there and computes no bar of its own (R4-11). report.mjs
// formats what both give it.
// Tiers are MOCK (§4). Layer 2's cast adds the street; the cast where every seat trades (L2-6) the cast and the money
// bar's parts by trade; the layer3 cast the drugs (L3-5a) and the tricks (L3-5b); the layer4 cast the big score (L4-4).
import { hash32 } from '../rng.mjs';
import { N } from '../numbers.mjs';
import {
  seasonBars, acrossSeasons, groupsOf, seasonCount, seasonKeyOf, recordText, median, theftsOf, takeWorth, firstSales,
  betrayalActs, modelSeats, VALUATIONS, SHADOWS, BOT_TYPES, TRADES, OUT_EARN, ROBBERS, DRUGS,
} from './passbars.mjs';

const MUSCLE = ['hustle', 'buylate', 'turtle'];
// Layer 2's money, by source (§9): what work brought in, cash taken in thefts, and what the work's goods cost.
const SOURCES = ['hustle', 'flex', 'street', 'buyer', 'agents', 'thefts'];
const COSTS = ['shop', 'bought'];
const sum = list => list.reduce((t, x) => t + x, 0);
const share = (part, whole) => (whole ? part / whole : null);

export function seasonMetrics(state, log, bench, cast) {
  const typeOf = Object.fromEntries(cast.map(c => [c.id, c.type]));
  const nameOf = Object.fromEntries(cast.map(c => [c.id, c.name]));
  const ids = Object.keys(state.agents).sort();
  // Layer 2's cast has a bot for each trade (bots.mjs); layer 1's report stays as it was.
  const layer = cast.some(c => c.layer === 2) ? 2 : 1;
  // §27's bars, and haul (for testing) three ways: passbars.mjs's.
  const own = seasonBars(state, log, bench, cast);
  const valuedHauls = own.hauls;
  const haul = valuedHauls.paid;
  const hauls = ids.map(id => haul[id]);
  const ofType = type => ids.filter(id => typeOf[id] === type);
  const medianOf = type => median(ofType(type).map(id => haul[id]));
  // The thefts (a hit or a break-in that took something), each at its worth as the bars count it (passbars.mjs).
  const thefts = theftsOf(log);
  const sales = firstSales(log);
  const worth = e => takeWorth(e, sales, state.copies);
  const fights = bench.nights.flatMap(n => n.fights);
  const errandsBad = log.filter(e => e.type === 'invalid' && 'errand' in e);
  const errandWhy = {};
  for (const e of errandsBad) errandWhy[`${e.errand}: ${e.why}`] = (errandWhy[`${e.errand}: ${e.why}`] || 0) + 1;

  const street = layer === 2 ? streetMetrics(state, log, ids, typeOf, ofType, thefts, fights) : null;
  // The cast where every seat works a trade (L2-6).
  const every = layer === 2 && cast.some(c => c.works);
  // Every seat that works the Gunrunner trade: its own bot and, in the cast where every seat trades, the seats that
  // work it.
  const gunrunners = new Set(cast.filter(c => c.type === 'gunrunner' || (c.works && c.trade === 'gunrunner')).map(c => c.id));
  // In the cast where every seat trades, every seat that works the Cop trade: the Cop seat and the seats that work it
  // (L2-6c: they back one collar).
  const cops = every ? new Set(cast.filter(c => c.type === 'cop' || (c.works && c.trade === 'cop')).map(c => c.id)) : null;
  const police = layer === 2 ? policeMetrics(log, bench, typeOf, gunrunners, cops) : null;
  // L3-5a: the drugs in play, with the layer3 cast; L3-5b: the tricks.
  const drugs = own.bars.drugs ? drugMetrics(state, log, cast, own.bars.drugs) : null;
  const tricks = drugs ? trickMetrics(state, log, bench, typeOf) : null;
  // L4-4: the big score, with the layer4 cast.
  const score = own.bars.vault ? scoreMetrics(state, log, bench, own.bars.vault) : null;

  // R11: the hustles, from the public hustle events: how many a night, where and at what level, the take, and the
  // hustlers robbed (a won hit on an agent the record shows hustling that night) and arrested (any arrest the night it
  // hustled). Reported only, no bar.
  const hustles = hustleMetrics(log);
  // GAP gap.rentTab: the tabs settled at the dock, from the public record.
  const tabEvents = log.filter(e => e.type === 'tab');
  const tabs = { agents: tabEvents.length, paid: sum(tabEvents.map(e => e.paid)), pieces: tabEvents.filter(e => e.copy).length };
  const tabOf = id => tabEvents.find(e => e.agent === id) || null;
  // The squatter's place by haul: 1 + the agents strictly ahead of it.
  const squatters = ofType('squatter').map(id => {
    const t = tabOf(id);
    return { id, haul: haul[id], rank: 1 + hauls.filter(h => h > haul[id]).length, ...(t ? { tab: { tab: t.tab, paid: t.paid, copy: t.copy, tier: t.tier } } : {}) };
  });
  const betrayals = betrayalActs(log);
  // Hired muscle (§12), from typed facts: muscle promising to back a robber, fights a robber led with muscle in the
  // group (and how many it won), cuts paid, and walks by robbers.
  const robber = id => ROBBERS.includes(typeOf[id]);
  const hiredFights = fights.filter(f => f.attackers.some(g => robber(g.leader) && g.members.some(m => MUSCLE.includes(typeOf[m]))));
  const hires = {
    deals: log.filter(e => e.type === 'say' && e.say === 'promise' && e.terms.what === 'back' && MUSCLE.includes(typeOf[e.from]) && robber(e.to)).length,
    fights: hiredFights.length,
    won: hiredFights.filter(f => f.winner && robber(f.winner)).length,
    paid: log.filter(e => e.type === 'pay' && e.for === 'deal' && robber(e.from)).length,
    walks: betrayals.filter(b => b.kind === 'walk' && robber(b.by)).length,
  };
  // Every fight's outcome in order, hashed: two seasons on one seed with the same hash fought the same fights.
  const outcome = hash32(JSON.stringify(bench.nights.map(n => n.fights.map(f => [f.kind, f.target, f.winner, f.arrested]))));

  // The top 5 by the official haul, each with its shadows.
  const top = ids.slice().sort((x, y) => haul[y] - haul[x] || (x < y ? -1 : 1)).slice(0, 5)
    .map(id => ({ id, name: nameOf[id], type: typeOf[id], haul: haul[id], ...Object.fromEntries(SHADOWS.map(v => [v, valuedHauls[v][id]])) }));
  // Each valuation's medians: all agents and by bot.
  const valued = Object.fromEntries(VALUATIONS.map(v => [v, {
    all: median(ids.map(id => valuedHauls[v][id])),
    byType: Object.fromEntries(BOT_TYPES.map(t => [t, median(ofType(t).map(id => valuedHauls[v][id]))])),
  }]));
  // The biggest stories: the thefts by their worth as the bars count it (§27: a piece at its copy's own first sale).
  const stories = thefts.map(e => ({ e, value: worth(e) })).sort((x, y) => y.value - x.value).slice(0, 5).map(({ e, value }) => ({
    night: e.night, kind: e.type, leader: e.leader, leaderType: typeOf[e.leader], members: e.members.length, target: e.target,
    targetType: typeOf[e.target], place: e.place, trait: e.trait, tier: e.tier, cash: e.cash, value,
  }));
  const arrests = log.filter(e => e.type === 'arrest');
  // The fence (§9, layer 2), from the record: pieces listed and sold, swaps offered, done and lapsed, the deals handed
  // back on night 14, and its cut.
  const fenceLog = log.filter(e => e.type === 'fence');
  const fenceActs = act => fenceLog.filter(e => e.act === act);
  const fence = layer === 2 ? {
    listed: fenceActs('list').length, sold: fenceActs('sold').length, offered: fenceActs('swap').length,
    swapped: fenceActs('swapped').length, lapsed: fenceActs('expired').length,
    returned: new Set(fenceActs('returned').map(e => e.deal)).size,
    fees: sum([...fenceActs('sold'), ...fenceActs('swapped')].map(e => e.fee || 0)),
  } : null;

  return {
    seed: bench.seed, rule: bench.rule, midseason: bench.midseason, mock: true, events: log.length, layer, street, police,
    ...(every ? { every: true, seats: seatsByTrade(cast), dealers: dealerNights(log, cast), close: closeMetrics(log) } : {}),
    ...(drugs ? { drugs, tricks } : {}),
    ...(score ? { score } : {}),
    overrides: bench.overrides || {},
    ledger: bench.ledger || null,
    // R4-1: the season's identity for distinct seasons (seasonKeyOf).
    seasonKey: seasonKeyOf(recordText(log)),
    haul, hauls: valuedHauls, valued, typeOf, top, allMedian: median(hauls),
    // R4-11: the seats a model played (R2-8), for the model bar's pairs.
    modelSeats: modelSeats(cast),
    provenance: bench.provenance || null,
    cast,
    actionCounters: actionCounters(bench.models, log, modelSeats(cast)),
    acquisition: acquisitionProfile(state, log, ids),
    medianByType: Object.fromEntries(BOT_TYPES.map(t => [t, medianOf(t)])),
    countByType: Object.fromEntries(BOT_TYPES.map(t => [t, ofType(t).length])),
    stories,
    betrayals: betrayals.map(b => ({ kind: b.kind, by: b.by, byType: typeOf[b.by], victims: b.victims, night: b.night ?? b.day })),
    arrests: { total: arrests.length, byWhy: arrests.reduce((m, e) => ({ ...m, [e.why]: (m[e.why] || 0) + 1 }), {}), missedFerry: log.filter(e => e.type === 'missed').length },
    thefts: thefts.length,
    crews: log.filter(e => e.type === 'crew' && e.act === 'form').length,
    evictions: log.filter(e => e.type === 'evicted' && e.on).length,
    tabs,
    ...(fence ? { fence } : {}),
    money: state.money,
    errandsInvalid: { total: errandsBad.length, why: errandWhy },
    hustleWorkers: hustles.perNight,
    hustles,
    squatters,
    hires,
    outcome,
    bars: own.bars,
    // R4-1: the bars that read haul, under each shadow valuation.
    shadow: own.shadow,
    // R7: a mixed season's row a model (modelRows); a season of one model has none, and its result stays as it was.
    ...(bench.models && bench.models.mixed ? { byModel: modelRows(state, log, bench, typeOf, haul) } : {}),
  };
}

// R7, a mixed season, a row a model group (the runner's --seat-models: the checkpoint's `models.mixed`, and `seatOf`,
// which seat plays for which), read off the record, the final state and the runner's per-night bench data, as the
// season's other numbers are:
// - haul (the official, passbars.mjs's), cash at the end (Mainland cash once the season is over) and the real pieces
//   its seats hold or minted;
// - crimes (a hit, a break-in, a grab, a vault job), each by its leader's executed play: tried, and won where the
//   night's fight that play led has it as winner (crime.mjs reads them so);
// - deals, as far as the record types them: promises made (a `say` promise), hand-overs in a sit-down (a `give` or a
//   `pay` naming one) and betrayals (passbars.mjs betrayalActs). The core keeps an agreed deal only while it is live and
//   types no event when one is agreed or settles, so deals agreed and settled aren't measured;
// - lookups the tools ran and inspects sent and used (evidence.mjs seatUsage), and refused actions by typed source
//   (evidence.mjs actionCounters, the seats' own records);
// - its use: call points, requests, request size in characters, tokens, and, on a paid run, the spend record's requests
//   sent and costed, cost and tokens (bench.usage, seatUsage's, which the runner reads off the tape and the spend record).
const CRIMES = ['hit', 'breakin', 'grab', 'vault'];
function modelRows(state, log, bench, typeOf, haul) {
  const { mixed, seatOf } = bench.models;
  const usage = bench.usage || null;
  const plays = log.filter(e => e.type === 'play' && CRIMES.includes(e.kind));
  const acts = betrayalActs(log);
  return mixed.map((g, i) => {
    const seats = Object.keys(seatOf).filter(id => seatOf[id] === i).sort();
    const mine = new Set(seats);
    const n = seats.length;
    const cash = seats.map(id => (state.over ? state.agents[id].mainland : state.agents[id].cash));
    const pieces = Object.values(state.copies).filter(c => !c.fake && (c.holder.k === 'agent' || c.holder.k === 'minted') && mine.has(c.holder.id)).length;
    const byKind = {};
    for (const p of plays.filter(e => mine.has(e.agent))) {
      const night = bench.nights.find(x => x.night === p.day);
      const f = night && night.fights.find(x => x.kind === p.kind && x.attackers.some(a => a.leader === p.agent));
      const k = (byKind[p.kind] ||= { tried: 0, won: 0 });
      k.tried += 1;
      if (f && f.winner === p.agent) k.won += 1;
    }
    const counters = actionCounters(bench.models, log, seats);
    const use = usage ? seats.map(id => usage[id]).filter(Boolean) : [];
    const add = f => sum(use.map(f));
    const paid = use.length && use.every(u => u.spend);
    const chars = add(u => u.chars.total);
    const requestsOnTape = add(u => u.chars.n);
    // R9b: the dawn journal's calls, apart from the acting calls above (evidence.mjs seatUsage), when there are any.
    const dawnUse = use.filter(u => u.dawn);
    const dawnOnTape = sum(dawnUse.map(u => u.dawn.chars.n));
    const dawn = dawnUse.length ? { requests: sum(dawnUse.map(u => u.dawn.requests)), chars: { mean: dawnOnTape ? sum(dawnUse.map(u => u.dawn.chars.total)) / dawnOnTape : null, max: Math.max(0, ...dawnUse.map(u => u.dawn.chars.max)) } } : null;
    return {
      model: g.model, thinking: g.thinking, ...(g.provider ? { provider: g.provider } : {}), seats, types: seats.map(id => typeOf[id]),
      haul: { mean: sum(seats.map(id => haul[id])) / n, bySeat: Object.fromEntries(seats.map(id => [id, haul[id]])) },
      cash: { mean: sum(cash) / n, total: sum(cash) }, pieces,
      crimes: { tried: sum(Object.values(byKind).map(k => k.tried)), won: sum(Object.values(byKind).map(k => k.won)), byKind },
      deals: {
        promises: log.filter(e => e.type === 'say' && e.say === 'promise' && mine.has(e.from)).length,
        handovers: log.filter(e => (e.type === 'give' || e.type === 'pay') && e.sitdown && mine.has(e.from)).length,
        betrayals: acts.filter(b => mine.has(b.by)).length,
      },
      refusals: { tools: counters.refusals.bySource.tools.total, core: counters.refusals.bySource.core.total, unknown: counters.refusals.bySource.unknown.total, coverage: counters.coverage },
      ...(use.length ? {
        lookups: add(u => u.lookups), lookupsSent: add(u => u.lookupsSent), inspectsSent: add(u => u.inspectsSent), inspects: add(u => u.inspects),
        calls: { callPoints: add(u => u.callPoints), requests: add(u => u.requests) },
        chars: { mean: requestsOnTape ? chars / requestsOnTape : null, max: Math.max(0, ...use.map(u => u.chars.max)) },
        ...(dawn ? { dawn } : {}),
        tokens: { in: add(u => u.tokens.in), out: add(u => u.tokens.out) },
        spend: paid ? { sent: add(u => u.spend.sent), costed: add(u => u.spend.costed), cost: add(u => u.spend.cost), tokens: { in: add(u => u.spend.tokens.in), out: add(u => u.spend.tokens.out), reasoning: add(u => u.spend.tokens.reasoning) } } : null,
      } : {}),
    };
  });
}

// Layer 2's street (§9), from the record, by bot (a report, not a bar: the money bar is passbars.mjs's):
// - every agent's season in cash, by source: hustles, flex, the street (a Dealer's corner), the city's buyer, goods sold
//   to agents (paid for "debt" once they arrive) and cash taken in thefts; and what the work's goods cost: the city's
//   shop and goods bought from agents. Income here is what work brought in less what its goods cost; thefts stay apart;
// - the cash that came onto the island, by source (state.money.in), and the street's share of it (§9: about two-thirds);
// - how crowded the drops got: Smugglers at each drop a night;
// - corner fights and changes of hands; the chems the Chemist bots cooked, and how many they bought from the Smuggler
//   bots and the city's shop.
function streetMetrics(state, log, ids, typeOf, ofType, thefts, fights) {
  const zero = () => Object.fromEntries([...SOURCES, ...COSTS].map(k => [k, 0]));
  const earn = Object.fromEntries(ids.map(id => [id, zero()]));
  const add = (id, k, x) => {
    if (earn[id] && Number.isFinite(x)) earn[id][k] += x;
  };
  for (const e of log) {
    if (e.type === 'hustle') add(e.agent, 'hustle', e.take);
    else if (e.type === 'flex') add(e.agent, 'flex', e.pay);
    else if (e.type === 'sale') add(e.agent, 'street', e.cash);
    else if (e.type === 'sell') add(e.agent, 'buyer', e.cash);
    else if (e.type === 'shop') add(e.agent, 'shop', e.cash);
    else if (e.type === 'pay' && e.for === 'debt') {
      add(e.to, 'agents', e.amount);
      add(e.from, 'bought', e.amount);
    }
  }
  for (const e of thefts) add(e.leader, 'thefts', e.cash || 0);
  // A grab's cash (the crate, §9) is a crime's take too, so it counts with the thefts.
  for (const e of log) if (e.type === 'grab') add(e.leader, 'thefts', e.cash || 0);
  // A Cop's work (§13): the patrol wage (and, layer 4, a guard's) and collar pay, kept apart from the sources above.
  const police = Object.fromEntries(ids.map(id => [id, 0]));
  for (const e of log) {
    if ((e.type === 'patrol' || e.type === 'guard') && police[e.agent] != null) police[e.agent] += e.wage;
    else if (e.type === 'collar' && police[e.agent] != null) police[e.agent] += e.pay;
  }
  const income = Object.fromEntries(ids.map(id => [id, SOURCES.filter(k => k !== 'thefts').reduce((t, k) => t + earn[id][k], 0) + police[id] - COSTS.reduce((t, k) => t + earn[id][k], 0)]));
  const present = BOT_TYPES.filter(t => ofType(t).length);
  const island = Object.fromEntries(Object.entries((state.money && state.money.in) || {}).sort((x, y) => y[1] - x[1]));
  const atDrop = {};
  for (const e of log) if (e.type === 'gather') (atDrop[`${e.night}|${e.place}`] ||= []).push(e.agent);
  const crowd = Object.values(atDrop).map(x => x.length);
  const cornerFights = fights.filter(f => f.kind === 'corner');
  const is = t => id => typeOf[id] === t;
  return {
    income: Object.fromEntries(present.map(t => [t, median(ofType(t).map(id => income[id]))])),
    police: Object.fromEntries(present.map(t => [t, median(ofType(t).map(id => police[id]))])),
    sources: Object.fromEntries(present.map(t => [t, Object.fromEntries([...SOURCES, ...COSTS].map(k => [k, median(ofType(t).map(id => earn[id][k]))]))])),
    island,
    streetShare: share(island.street || 0, sum(Object.values(island))),
    drops: { runs: sum(crowd), worked: crowd.length, perDrop: median(crowd), shared: share(sum(crowd.filter(c => c > 1)), sum(crowd)), most: crowd.length ? Math.max(...crowd) : 0 },
    corners: { fights: cornerFights.length, won: cornerFights.filter(f => f.winner).length, turf: log.filter(e => e.type === 'turf').length },
    chems: {
      cooked: sum(log.filter(e => e.type === 'cook').map(e => e.chems || 0)),
      smugglers: sum(log.filter(e => e.type === 'give' && e.goods && is('smuggler')(e.from) && is('chemist')(e.to)).map(e => e.goods.chems || 0)),
      shop: sum(log.filter(e => e.type === 'shop' && e.item === 'chems' && is('chemist')(e.agent)).map(e => e.units || 0)),
    },
  };
}

// The money columns of the street's tables: a key and its label.
export const MONEY_COLUMNS = [['income', 'income'], ['hustle', 'hustles'], ['street', 'street'], ['buyer', "city's buyer"], ['agents', 'goods sold'], ['bought', 'goods bought'], ['shop', "city's shop"], ['flex', 'flex'], ['police', 'patrols and collars'], ['thefts', 'thefts and grabs']];
// A money column's value for a bot type in a season's street metrics.
export const moneyOf = (st, t, k) => (k === 'income' ? st.income[t] : k === 'police' ? (st.police ? st.police[t] : null) : st.sources[t] ? st.sources[t][k] : null);

// The Dealers' nights on a corner (every seat that works the trade, L2-6b): the nights it dealt, and those it sold on.
function dealerNights(log, cast) {
  const dealers = new Set(cast.filter(c => c.trade === 'dealer' && (c.works || c.type === 'dealer')).map(c => c.id));
  return {
    dealt: log.filter(e => e.type === 'play' && e.kind === 'deal' && dealers.has(e.agent)).length,
    sold: log.filter(e => e.type === 'sale' && e.doses > 0 && dealers.has(e.agent)).length,
  };
}

// The close (L2-6d), from the record: the cash that boarded unspent, the copies still on the list when it closed, and the
// bails paid out of a jail that would have outlasted the ferry (an arrest on a night whose jail reaches night 14).
function closeMetrics(log) {
  const arrests = log.filter(e => e.type === 'arrest');
  const lastArrest = b => arrests.filter(a => a.agent === b.agent && a.night < b.day).slice(-1)[0];
  const rollover = log.find(e => e.type === 'rollover');
  return {
    boarded: sum(log.filter(e => e.type === 'mint').map(e => e.cash)),
    unsold: rollover ? rollover.copies.length : 0,
    bailed: log.filter(e => e.type === 'bail' && lastArrest(e) && lastArrest(e).night + N.jailNights >= N.nights).length,
  };
}

// The drugs (L3-5a, GAME.md §11), from the record, which keeps every drug's name (a SUDO take is SUDO, as its reveal
// shows it, never the TEMP it was sold as): the doses taken, by drug and by bot; the crashes (a TEMP day's), the
// withdrawals (a forced lay low for a hook not fed), the agents hooked and on what, and the clean marks; the `taken`
// sink (state.goods.out.taken, where a SUDO dose goes out as the TEMP it was handed over as); the doses cooked, by
// drug; SUDO's con (doses handed over as TEMP, plays written, plays forced) and TRUTH's locked plays. §27's drug bar,
// and the doses taken it counts, are passbars.mjs's (`bar`).
function drugMetrics(state, log, cast, bar) {
  const typeOf = Object.fromEntries(cast.map(c => [c.id, c.type]));
  const takes = log.filter(e => e.type === 'take');
  const by = Object.fromEntries(DRUGS.map(d => [d, {}]));
  for (const e of takes) by[e.drug][typeOf[e.agent]] = (by[e.drug][typeOf[e.agent]] || 0) + 1;
  const forced = log.filter(e => e.type === 'forced');
  const hookedOn = {};
  for (const e of log.filter(x => x.type === 'hooked')) (hookedOn[e.drug] ||= new Set()).add(e.agent);
  const cooked = {};
  for (const e of log.filter(x => x.type === 'cook' && x.doses)) cooked[e.drug || 'temp'] = (cooked[e.drug || 'temp'] || 0) + e.doses;
  const sink = ((state.goods || {}).out || {}).taken || {};
  return {
    taken: bar.taken, by,
    crashes: log.filter(e => e.type === 'crash').length,
    withdrawals: forced.filter(e => e.why === 'withdrawal').length,
    hooked: bar.hooked, hookedOn: Object.fromEntries(DRUGS.filter(d => hookedOn[d]).map(d => [d, hookedOn[d].size])),
    clean: log.filter(e => e.type === 'clean').length,
    sink: Object.fromEntries(DRUGS.filter(d => sink[d]).map(d => [d, sink[d]])),
    cooked: Object.fromEntries(DRUGS.filter(d => cooked[d]).map(d => [d, cooked[d]])),
    sudo: {
      sold: sum(log.filter(e => e.type === 'give' && e.goods && e.goods.sudo).map(e => e.goods.sudo)),
      written: log.filter(e => e.type === 'write').length,
      forced: forced.filter(e => e.why === 'sudo').length,
    },
    truth: forced.filter(e => e.why === 'truth').length,
    bar,
  };
}

// The tricks (L3-5b, GAME.md §10, §12, §13), from the record and the runner's fights (each fight's tippers and bribers):
// - tips: given, right (the agent named was in an attacking group of that night's hit, break-in or grab on the target
//   named: a fight's tippers) and wrong, the arrests in fights a right tip named, and rats (§12, betrayals too);
// - bribes: paid, their cash, and the fights whose city cops they kept out (a fight's bribers; L3-6: a bribe paid at
//   less than its side's hottest agent's price keeps none out);
// - bounties: posted, paid (and to which bots) and gone at the ferry, with their cash;
// - lookouts hired, by bot;
// - the new sinks: bribes, lookouts and the bounties gone at the ferry (state.money.out).
function trickMetrics(state, log, bench, typeOf) {
  const fights = bench.nights.flatMap(n => n.fights);
  const tipped = fights.filter(f => f.tippers);
  const of = (type, act) => log.filter(e => e.type === type && (!act || e.act === act));
  const byBot = (list, key) => list.reduce((m, e) => ({ ...m, [typeOf[e[key]]]: (m[typeOf[e[key]]] || 0) + 1 }), {});
  const cash = list => sum(list.map(e => e.amount));
  const right = sum(tipped.map(f => f.tippers.length));
  const out = (state.money && state.money.out) || {};
  return {
    tips: { given: of('tip').length, right, wrong: of('tip').length - right, arrests: sum(tipped.map(f => f.arrested.length)), rats: of('betray').filter(e => e.kind === 'rat').length },
    bribes: { paid: of('bribe').length, cash: sum(of('bribe').map(e => e.price)), kept: sum(fights.filter(f => f.bribers).map(f => f.bribers.length)) },
    bounties: {
      posted: of('bounty', 'post').length, cash: cash(of('bounty', 'post')), paid: of('bounty', 'paid').length, paidCash: cash(of('bounty', 'paid')),
      to: byBot(of('bounty', 'collected'), 'to'), gone: of('bounty', 'gone').length, goneCash: cash(of('bounty', 'gone')),
    },
    looks: { hired: of('look').length, by: byBot(of('look'), 'by') },
    sinks: { bribe: out.bribe || 0, lookout: out.lookout || 0, bounty: out.bounty || 0 },
  };
}
// The tricks across seasons: counts and cash summed.
function trickSummary(rs) {
  const ts = rs.map(r => r.tricks).filter(Boolean);
  const add = (f, keys) => Object.fromEntries(keys.map(k => [k, sum(ts.map(t => f(t)[k]))]));
  const merge = f => ts.reduce((m, t) => {
    for (const [k, n] of Object.entries(f(t))) m[k] = (m[k] || 0) + n;
    return m;
  }, {});
  return {
    tips: add(t => t.tips, ['given', 'right', 'wrong', 'arrests', 'rats']),
    bribes: add(t => t.bribes, ['paid', 'cash', 'kept']),
    bounties: { ...add(t => t.bounties, ['posted', 'cash', 'paid', 'paidCash', 'gone', 'goneCash']), to: merge(t => t.bounties.to) },
    looks: { hired: sum(ts.map(t => t.looks.hired)), by: merge(t => t.looks.by) },
    sinks: add(t => t.sinks, ['bribe', 'lookout', 'bounty']),
  };
}

// The big score (L4-4, GAME.md §4, §7, §9, §12, §13, §15), from the record, the final state's copies (which keep every
// fake and its maker) and the runner's vault fights and fakes at the lock:
// - vault jobs: the groups that jobbed it (tried, §27's vault bar's count: passbars.mjs's `bar`), won and lost, the
//   arrests in those fights, and the fights guards were in;
// - the vault's money: in, the fines and pieces arrests seized; out, what jobs took and what was gone at the ferry;
// - guard nights (a Cop's wage at the vault); warrants built, handed over and used; double-sells;
// - fakes: made; sold as real (handed over by their makers) and the price their buyers ordered them at; refused by a
//   buyer, naming the piece, and by the fence; seen through shades (worn at a lock while another agent wore real
//   shades); and exposed at the ferry.
function scoreMetrics(state, log, bench, bar) {
  const fights = bench.nights.flatMap(n => n.fights).filter(f => f.kind === 'vault');
  const of = (type, f = () => true) => log.filter(e => e.type === type && f(e));
  const fake = k => !!k && !!state.copies[k] && !!state.copies[k].fake;
  const maker = k => state.copies[k].maker;
  const tried = bar.jobs;
  const won = fights.filter(f => f.winner).length;
  const sold = of('give', e => fake(e.copy) && maker(e.copy) === e.from);
  // What its buyer ordered it at: the buyer's last offer for that piece to its maker.
  const ordered = of('say', e => e.say === 'offer' && fake(e.terms.piece) && maker(e.terms.piece) === e.to);
  const at = g => (ordered.filter(e => e.terms.piece === g.copy && e.from === g.to).slice(-1)[0] || { terms: { cash: 0 } }).terms.cash;
  const gone = of('gone', e => e.from === 'vault');
  return {
    jobs: { tried, won, lost: tried - won, arrests: sum(fights.map(f => f.arrested.length)), guarded: fights.filter(f => f.guards).length },
    vault: {
      // R4-4: what a seizure put in the vault, its fine less what a collar paid its Cop out of it (`vault`).
      in: sum(of('seized').map(e => (e.vault == null ? e.fine : e.vault))), inPieces: of('seized', e => e.copy).length,
      taken: sum(of('vault').map(e => e.cash)), takenPieces: sum(of('vault').map(e => e.copies.length)),
      gone: sum(gone.map(e => e.cash)), gonePieces: sum(gone.map(e => e.copies.length)),
    },
    guards: of('guard').length,
    warrants: {
      built: sum(of('craft').map(e => e.warrants || 0)), sold: sum(of('give', e => e.goods && e.goods.warrants).map(e => e.goods.warrants)),
      used: sum(of('used', e => e.goods.warrants).map(e => e.goods.warrants)),
    },
    fakes: {
      made: of('fake', e => e.act === 'made').length, sold: sold.length, soldFor: sum(sold.map(at)),
      refused: of('say', e => e.say === 'answer' && fake(e.terms.piece) && e.terms.cash === 0).length,
      fence: of('invalid', e => e.why === 'the fence takes no fakes').length,
      seen: new Set(bench.nights.flatMap(n => (n.fakes ? n.fakes.seen : []))).size, exposed: of('fake', e => e.act === 'exposed').length,
    },
    doubleSells: of('betray', e => e.kind === 'double-sell').length,
    bar,
  };
}
// The big score across seasons: counts and cash summed.
function scoreSummary(rs) {
  const ss = rs.map(r => r.score).filter(Boolean);
  const add = (key, keys) => Object.fromEntries(keys.map(k => [k, sum(ss.map(s => s[key][k]))]));
  return {
    jobs: add('jobs', ['tried', 'won', 'lost', 'arrests', 'guarded']),
    vault: add('vault', ['in', 'inPieces', 'taken', 'takenPieces', 'gone', 'gonePieces']),
    guards: sum(ss.map(s => s.guards)),
    warrants: add('warrants', ['built', 'sold', 'used']),
    fakes: add('fakes', ['made', 'sold', 'soldFor', 'refused', 'fence', 'seen', 'exposed']),
    doubleSells: sum(ss.map(s => s.doubleSells)),
  };
}

// Every seat's trade, and the strategies that hold it: { trade: { strategy: seats } }.
function seatsByTrade(cast) {
  const out = Object.fromEntries(TRADES.map(t => [t, {}]));
  for (const c of cast) if (out[c.trade]) out[c.trade][c.type] = (out[c.trade][c.type] || 0) + 1;
  return out;
}

// Layer 2's police, crate and guns (§8, §9, §13), from the record:
// - arrests by what made them: a Cop's collar, a fight a patrol joined, a fight with the city cops alone, 5 stars, and
//   the dock;
// - the Cop seat's nights: patrols, collars tried and won, and what its work paid;
// - the crate: grab fights, grabs won and by which bots, and the cash they took;
// - guns: built, bought at the city's shop, taken in crates and sold by Gunrunners (every seat with the trade) to
//   agents; and, at the lock, how many were held and how many agents were armed (medians over the nights);
// - with `cops` (the cast where every seat trades, L2-6c), the collars of every seat that works the Cop trade: tried,
//   fought (the collar found its target) and won, and the nights one of them backed another's collar.
function policeMetrics(log, bench, typeOf, gunrunners, cops = null) {
  const arrests = { collar: 0, patrol: 0, city: 0, heat: 0, dock: 0 };
  for (const e of log) {
    if (e.type !== 'arrest') continue;
    if (e.why !== 'fight') {
      if (e.why in arrests) arrests[e.why] += 1;
      continue;
    }
    const night = bench.nights.find(n => n.night === e.night);
    const f = night && night.fights.find(x => (x.arrested || []).includes(e.agent));
    arrests[f && f.patrols && f.patrols.length ? 'patrol' : 'city'] += 1;
  }
  const isCop = id => typeOf[id] === 'cop';
  // Layer 4: its guard nights, only when there are any.
  const guards = log.filter(e => e.type === 'guard' && isCop(e.agent)).length;
  const seat = {
    patrols: log.filter(e => e.type === 'patrol' && isCop(e.agent)).length,
    ...(guards ? { guards } : {}),
    collarsTried: log.filter(e => e.type === 'play' && e.kind === 'collar' && isCop(e.agent)).length,
    collarsWon: log.filter(e => e.type === 'collar' && isCop(e.agent)).length,
    pay: sum(log.filter(e => isCop(e.agent) && ['patrol', 'guard', 'collar'].includes(e.type)).map(e => (e.type === 'collar' ? e.pay : e.wage))),
  };
  const grabs = log.filter(e => e.type === 'grab');
  const crate = {
    fights: bench.nights.flatMap(n => n.fights).filter(f => f.kind === 'grab').length,
    won: grabs.length,
    byType: grabs.reduce((m, e) => ({ ...m, [typeOf[e.leader]]: (m[typeOf[e.leader]] || 0) + 1 }), {}),
    cash: sum(grabs.map(e => e.cash || 0)),
  };
  const guns = {
    built: sum(log.filter(e => e.type === 'craft').map(e => e.guns || 0)),
    shop: sum(log.filter(e => e.type === 'shop' && e.item === 'guns').map(e => e.units || 0)),
    crates: sum(grabs.map(e => (e.goods && e.goods.guns) || 0)),
    sold: sum(log.filter(e => e.type === 'give' && e.goods && e.goods.guns && gunrunners.has(e.from)).map(e => e.goods.guns)),
    held: median(bench.nights.map(n => (n.guns ? n.guns.held : null))),
    armed: median(bench.nights.map(n => (n.guns ? n.guns.armed : null))),
  };
  return { arrests, seat, crate, guns, ...(cops ? { collars: collarCounts(log, bench, cops) } : {}) };
}

// The collars of these Cops, from the record: tried (a collar play), fought (a collar fight its group was in), won,
// and backed (a back on a Cop collaring that night).
function collarCounts(log, bench, cops) {
  const plays = log.filter(e => e.type === 'play' && cops.has(e.agent));
  const tried = plays.filter(e => e.kind === 'collar');
  const fightsOn = n => (bench.nights.find(x => x.night === n) || { fights: [] }).fights;
  const collaring = new Set(tried.map(e => `${e.day}|${e.agent}`));
  return {
    tried: tried.length,
    fought: tried.filter(e => fightsOn(e.day).some(f => f.kind === 'collar' && f.target === e.target && f.attackers.some(g => g.leader === e.agent))).length,
    won: log.filter(e => e.type === 'collar' && cops.has(e.agent)).length,
    backed: plays.filter(e => e.kind === 'back' && collaring.has(`${e.day}|${e.target}`)).length,
  };
}

// Across seasons: §27's bars (passbars.mjs's acrossSeasons: each bar's seasons passing per rule and overall, with its
// distinct seasons and its verdict) and the key medians. `twins` (optional): bot seasons the model bar pairs with,
// which no other row counts.
export function summarize(results, { twins = [] } = {}) {
  const across = acrossSeasons(results, { twins });
  const groups = groupsOf(results);
  const layer = Math.max(1, ...results.map(r => r.layer || 1));
  const every = results.some(r => r.every);
  const drugs = results.some(r => r.drugs);
  const score = results.some(r => r.score);
  const models = results.some(r => (r.modelSeats || []).length);
  // R4-1: each valuation's medians, each season's, then the median across seasons; the counts of the bars that read
  // haul under each valuation are passbars.mjs's.
  const pick = (r, v, key) => (v === 'paid' ? r.bars[key] : r.shadow && r.shadow[v] ? r.shadow[v][key] : null);
  const shadow = {
    rows: across.shadow,
    medians: Object.fromEntries(VALUATIONS.map(v => {
      const acrossOf = f => median(results.map(r => (r.valued ? f(r) : null)));
      const bar = (r, key) => pick(r, v, key) || {};
      const squatterRanks = results.filter(r => r.hauls).flatMap(r => (r.squatters || []).map(q => 1 + Object.values(r.hauls[v]).filter(h => h > r.hauls[v][q.id]).length));
      return [v, {
        all: acrossOf(r => r.valued[v].all),
        byType: Object.fromEntries(BOT_TYPES.map(t => [t, acrossOf(r => r.valued[v].byType[t])])),
        robber: acrossOf(r => bar(r, 'crimePays').robberHaul), robbers: acrossOf(r => bar(r, 'crimeMedians').robberHaul), hustle: acrossOf(r => bar(r, 'crimePays').hustleHaul),
        squatterRanks, squatterRank: median(squatterRanks),
      }];
    })),
  };
  const keyNumbers = groups.map(([g, rs]) => ({
    group: g,
    seasons: rs.length,
    ledgerErrands: sum(rs.map(r => (r.ledger ? r.ledger.errands : 0))),
    ledgerNights: sum(rs.map(r => (r.ledger ? r.ledger.nights : 0))),
    ledgerFailed: sum(rs.map(r => (r.ledger ? r.ledger.failed : 0))),
    ledgerSeasons: rs.filter(r => r.ledger).length,
    medianHaul: median(rs.map(r => r.allMedian)),
    medianByType: Object.fromEntries(BOT_TYPES.map(t => [t, median(rs.map(r => r.medianByType[t]))])),
    lastNightShare: median(rs.map(r => r.bars.middle.share)),
    leaderChanges: median(rs.map(r => r.bars.leaderChanges.changes)),
    betrayals: median(rs.map(r => r.bars.betrayals.total)),
    betrayalKinds: rs.reduce((m, r) => {
      for (const [k, v] of Object.entries(r.bars.betrayals.byKind)) m[k] = (m[k] || 0) + v;
      return m;
    }, {}),
    showWorthyNights: median(rs.map(r => r.bars.showWorthy.nights)),
    mintedMoved: median(rs.map(r => r.bars.mintedMoved.share)),
    placesNights: median(rs.map(r => r.bars.places.nightsChanged)),
    sightedRate: median(rs.map(r => r.bars.places.sightedRate)),
    blindRate: median(rs.map(r => r.bars.places.blindRate)),
    dropSold: median(rs.map(r => r.bars.dropSells.share)),
    fights: sum(rs.map(r => r.bars.backing.fights)),
    backed: sum(rs.map(r => r.bars.backing.backed)),
    backingDecided: sum(rs.map(r => r.bars.backing.decided)),
    targetHitBacker: sum(rs.map(r => r.bars.backing.targetHitBacker)),
    thefts: median(rs.map(r => r.thefts)),
    arrests: median(rs.map(r => r.arrests.total)),
    evictions: median(rs.map(r => r.evictions)),
    invalidPlays: sum(rs.flatMap(r => [...Object.values(r.bars.invalid), ...Object.values(r.bars.invalidByModel || {})].map(v => v.invalid))),
    plays: sum(rs.flatMap(r => [...Object.values(r.bars.invalid), ...Object.values(r.bars.invalidByModel || {})].map(v => v.plays))),
    ...(models ? { invalidByModel: invalidByModelSummary(rs) } : {}),
    ...(models ? { ceiling: ceilingSummary(rs) } : {}),
    hustleWorkers: median(rs.map(r => r.hustleWorkers)),
    hustles: hustleSummary(rs),
    squatterRanks: rs.flatMap(r => (r.squatters || []).map(q => q.rank)),
    squatterRank: median(rs.flatMap(r => (r.squatters || []).map(q => q.rank))),
    tabs: ['agents', 'paid', 'pieces'].reduce((m, k) => ({ ...m, [k]: sum(rs.map(r => (r.tabs ? r.tabs[k] : 0))) }), {}),
    hires: ['deals', 'fights', 'won', 'paid', 'walks'].reduce((m, k) => ({ ...m, [k]: sum(rs.map(r => (r.hires ? r.hires[k] : 0))) }), {}),
    // The crime bar's arrests: the median robber's own (R4-1), and the median of all the robbers' (the shadow reading).
    robberArrests: median(rs.map(r => r.bars.crimePays.robberArrests)),
    robberArrestsMedians: median(rs.map(r => r.bars.crimeMedians.robberArrests)),
    ...(layer === 2 ? { street: streetSummary(rs), police: policeSummary(rs), fence: fenceSummary(rs) } : {}),
    ...(every ? { parts: partsSummary(rs) } : {}),
    ...(drugs ? { drugs: drugSummary(rs), tricks: trickSummary(rs) } : {}),
    ...(score ? { score: scoreSummary(rs) } : {}),
  }));
  // Rule A against rule B on the same seeds: how many seeds fought different fights.
  const bySeed = {};
  for (const r of results) (bySeed[r.seed] ||= {})[r.rule] = r.outcome;
  const paired = Object.values(bySeed).filter(x => x.A != null && x.B != null);
  const ruleDiff = { seeds: paired.length, differ: paired.filter(x => x.A !== x.B).length };
  return {
    // R7: mixed seasons' rows by model, summed across them (byModelSummary); none without a mixed season.
    ...(results.some(r => r.byModel) ? { byModel: byModelSummary(results) } : {}),
    mechanisms: results.filter(r=>(r.modelSeats || []).length).map(({seed,rule,modelSeats,actionCounters,acquisition})=>({seed,rule,modelSeats,actionCounters,acquisition})),
    rules: groups.slice(0, -1).map(([g]) => g), groups: across.groups, rows: across.rows, shadow, keyNumbers, ruleDiff, layer,
    ...(every ? { every: true } : {}), ...(drugs ? { drugs: true } : {}), ...(score ? { score: true } : {}), ...(models ? { models: true } : {}),
  };
}

// R7: the rows by model across mixed seasons, a row a model group (its model, thinking and routing), its counts summed
// and its haul and cash a seat's mean over every seat it played; `seats` is the seats played, `seasons` the seasons.
function byModelSummary(results) {
  const rows = new Map();
  const rs = results.filter(r => r.byModel);
  for (const r of rs) {
    for (const x of r.byModel) {
      const key = JSON.stringify([x.model, x.thinking, x.provider || null]);
      if (!rows.has(key)) rows.set(key, { parts: [], seasons: 0 });
      rows.get(key).parts.push(x);
      rows.get(key).seasons += 1;
    }
  }
  return [...rows.values()].map(({ parts, seasons }) => {
    const seats = sum(parts.map(p => p.seats.length));
    const byKind = {};
    for (const p of parts) for (const [k, c] of Object.entries(p.crimes.byKind)) {
      const t = (byKind[k] ||= { tried: 0, won: 0 });
      t.tried += c.tried;
      t.won += c.won;
    }
    const used = parts.every(p => p.calls);
    const add = f => sum(parts.map(f));
    const chars = used ? { mean: add(p => (p.chars.mean || 0) * p.calls.requests) / (add(p => p.calls.requests) || 1), max: Math.max(...parts.map(p => p.chars.max)) } : null;
    // R9b: the dawn journal's calls, summed apart, when any season had them.
    const dawned = parts.filter(p => p.dawn);
    const dawnN = sum(dawned.map(p => p.dawn.requests));
    const dawn = used && dawned.length ? { requests: dawnN, chars: { mean: sum(dawned.map(p => (p.dawn.chars.mean || 0) * p.dawn.requests)) / (dawnN || 1), max: Math.max(...dawned.map(p => p.dawn.chars.max)) } } : null;
    return {
      model: parts[0].model, thinking: parts[0].thinking, ...(parts[0].provider ? { provider: parts[0].provider } : {}), seats, seasons,
      haul: { mean: add(p => p.haul.mean * p.seats.length) / seats }, cash: { mean: add(p => p.cash.total) / seats, total: add(p => p.cash.total) },
      pieces: add(p => p.pieces), crimes: { tried: add(p => p.crimes.tried), won: add(p => p.crimes.won), byKind },
      deals: { promises: add(p => p.deals.promises), handovers: add(p => p.deals.handovers), betrayals: add(p => p.deals.betrayals) },
      refusals: { tools: add(p => p.refusals.tools), core: add(p => p.refusals.core), unknown: add(p => p.refusals.unknown) },
      ...(used ? {
        lookups: add(p => p.lookups), lookupsSent: add(p => p.lookupsSent), inspectsSent: add(p => p.inspectsSent), inspects: add(p => p.inspects),
        calls: { callPoints: add(p => p.calls.callPoints), requests: add(p => p.calls.requests) }, chars, ...(dawn ? { dawn } : {}),
        tokens: { in: add(p => p.tokens.in), out: add(p => p.tokens.out) },
        spend: parts.every(p => p.spend) ? { sent: add(p => p.spend.sent), costed: add(p => p.spend.costed), cost: add(p => p.spend.cost), tokens: { in: add(p => p.spend.tokens.in), out: add(p => p.spend.tokens.out), reasoning: add(p => p.spend.tokens.reasoning) } } : null,
      } : {}),
    };
  });
}

// Each model's invalid plays across seasons, summed (§27's hygiene number, passbars.mjs's per season).
function invalidByModelSummary(rs) {
  const out = {};
  for (const r of rs) {
    for (const [m, x] of Object.entries(r.bars.invalidByModel || {})) {
      const o = (out[m] ||= { seats: 0, plays: 0, invalid: 0, rate: null, errands: 0 });
      for (const k of ['seats', 'plays', 'invalid', 'errands']) o[k] += x[k];
    }
  }
  for (const o of Object.values(out)) o.rate = share(o.invalid, o.plays);
  return out;
}
// The model seats' calls across seasons: the most a seat made in a day, and the mean a seat-day (passbars.mjs's per
// season).
function ceilingSummary(rs) {
  const cs = rs.map(r => r.bars.ceiling).filter(c => c && c.seatDays);
  const days = sum(cs.map(c => c.seatDays));
  return { seatDays: days, most: cs.length ? Math.max(...cs.map(c => c.most)) : null, mean: days ? sum(cs.map(c => c.mean * c.seatDays)) / days : null, over: sum(cs.map(c => c.over)) };
}

// The drugs across seasons (L3-5a): counts summed; the seasons each drug was taken in, and someone hooked; the drug
// bar's seasons are its row in the table.
function drugSummary(rs) {
  const ds = rs.map(r => r.drugs).filter(Boolean);
  const total = f => sum(ds.map(f));
  const add = key => ds.reduce((m, d) => {
    for (const [k, n] of Object.entries(d[key])) m[k] = (m[k] || 0) + n;
    return m;
  }, {});
  const withDrugs = rs.filter(r => r.drugs);
  return {
    of: ds.length,
    taken: Object.fromEntries(DRUGS.map(x => [x, total(d => d.taken[x])])),
    seasons: Object.fromEntries(DRUGS.map(x => [x, ds.filter(d => d.taken[x]).length])),
    hookedSeasons: ds.filter(d => d.hooked).length,
    // The same counts with their distinct seasons (R4-1).
    counts: { ...Object.fromEntries(DRUGS.map(x => [x, seasonCount(withDrugs, r => !!r.drugs.taken[x])])), hooked: seasonCount(withDrugs, r => !!r.drugs.hooked) },
    crashes: total(d => d.crashes), withdrawals: total(d => d.withdrawals), hooked: total(d => d.hooked), clean: total(d => d.clean),
    sink: add('sink'), cooked: add('cooked'),
    sudo: { sold: total(d => d.sudo.sold), written: total(d => d.sudo.written), forced: total(d => d.sudo.forced) }, truth: total(d => d.truth),
  };
}

// The money bar's parts across seasons, from each season's bar (passbars.mjs): each season's medians, then the median
// across seasons; the seasons each of the Smuggler, Chemist and Dealer out-earned the hustler, by haul (the bar)
// and by income (the shadow); the chems summed; the widest gap's median and which two trades it fell between; and the
// street's share, its median and range. Seats by strategy are summed.
function partsSummary(rs) {
  const ps = rs.filter(r => r.bars.moneyEarn);
  const across = f => median(ps.map(f));
  const tradeIn = (r, t) => r.bars.moneyEarn.trades.find(x => x.trade === t);
  const seats = Object.fromEntries(TRADES.map(t => [t, {}]));
  for (const r of ps) for (const t of TRADES) for (const [k, n] of Object.entries((r.seats || {})[t] || {})) seats[t][k] = (seats[t][k] || 0) + n;
  const pairs = {};
  for (const r of ps) {
    const g = r.bars.moneyGap;
    if (g.hi) pairs[`${g.hi.trade} over ${g.lo.trade}`] = (pairs[`${g.hi.trade} over ${g.lo.trade}`] || 0) + 1;
  }
  const shares = ps.map(r => r.bars.moneyShare.share).filter(x => x != null);
  return {
    of: ps.length,
    hustle: across(r => r.bars.moneyEarn.hustle),
    hustleIncome: across(r => r.bars.moneyEarn.byIncome.hustleIncome),
    trades: TRADES.map(t => ({
      trade: t, seats: across(r => tradeIn(r, t).seats), income: across(r => tradeIn(r, t).income),
      ...(OUT_EARN.includes(t) ? {
        haul: across(r => tradeIn(r, t).haul),
        count: seasonCount(ps, r => !!tradeIn(r, t).pass),
        byIncome: seasonCount(ps, r => !!r.bars.moneyEarn.byIncome.outEarn.find(o => o.type === t).pass),
      } : {}),
    })),
    seats,
    chems: (() => {
      const c = Object.fromEntries(['cooked', 'smugglers', 'shop', 'others', 'kits', 'taken', 'total'].map(k => [k, sum(ps.map(r => r.bars.moneyChems[k]))]));
      // The Smugglers' share of every chem that reached the Chemists, all seasons together.
      return { ...c, share: share(c.smugglers, c.total) };
    })(),
    gap: { ratio: across(r => r.bars.moneyGap.ratio), pairs },
    share: { median: median(shares), lo: shares.length ? Math.min(...shares) : null, hi: shares.length ? Math.max(...shares) : null },
    dealers: ps.some(r => r.dealers) ? { dealt: sum(ps.map(r => (r.dealers ? r.dealers.dealt : 0))), sold: sum(ps.map(r => (r.dealers ? r.dealers.sold : 0))) } : null,
    close: ps.some(r => r.close) ? {
      boarded: median(ps.map(r => (r.close ? r.close.boarded : null))), unsold: median(ps.map(r => (r.close ? r.close.unsold : null))),
      bailed: sum(ps.map(r => (r.close ? r.close.bailed : 0))),
    } : null,
  };
}

// The police, the crate and guns across seasons: counts summed, the lock's medians the median across seasons.
function policeSummary(rs) {
  const ps = rs.map(r => r.police).filter(Boolean);
  const total = f => sum(ps.map(f));
  const byType = {};
  for (const p of ps) for (const [t, n] of Object.entries(p.crate.byType)) byType[t] = (byType[t] || 0) + n;
  return {
    arrests: Object.fromEntries(['collar', 'patrol', 'city', 'heat', 'dock'].map(k => [k, total(p => p.arrests[k])])),
    seat: Object.fromEntries(['patrols', ...(ps.some(p => p.seat.guards) ? ['guards'] : []), 'collarsTried', 'collarsWon', 'pay'].map(k => [k, total(p => p.seat[k] || 0)])),
    crate: { fights: total(p => p.crate.fights), won: total(p => p.crate.won), byType, cash: total(p => p.crate.cash) },
    guns: {
      ...Object.fromEntries(['built', 'shop', 'crates', 'sold'].map(k => [k, total(p => p.guns[k])])),
      held: median(ps.map(p => p.guns.held)), armed: median(ps.map(p => p.guns.armed)),
    },
    ...(ps.some(p => p.collars) ? { collars: Object.fromEntries(['tried', 'fought', 'won', 'backed'].map(k => [k, total(p => (p.collars ? p.collars[k] : 0))])) } : {}),
  };
}

// The street across seasons: each season's medians, then the median across seasons; counts are summed. The money bar's
// clauses are counted from each season's bar (passbars.mjs).
function streetSummary(rs) {
  const st = rs.map(r => r.street).filter(Boolean);
  const types = BOT_TYPES.filter(t => st.some(x => x.income[t] != null));
  const across = f => median(st.map(f));
  return {
    streetShare: across(x => x.streetShare),
    island: Object.fromEntries([...new Set(st.flatMap(x => Object.keys(x.island)))].map(k => [k, across(x => x.island[k] || 0)])),
    money: Object.fromEntries(types.map(t => [t, Object.fromEntries(MONEY_COLUMNS.map(([k]) => [k, across(x => moneyOf(x, t, k))]))])),
    drops: { perDrop: across(x => x.drops.perDrop), shared: across(x => x.drops.shared), most: Math.max(0, ...st.map(x => x.drops.most)) },
    corners: { fights: sum(st.map(x => x.corners.fights)), won: sum(st.map(x => x.corners.won)), turf: sum(st.map(x => x.corners.turf)) },
    chems: { cooked: sum(st.map(x => x.chems.cooked)), smugglers: sum(st.map(x => x.chems.smugglers)), shop: sum(st.map(x => x.chems.shop)) },
    moneyParts: {
      // The same counts with their distinct seasons (R4-1), the out-earning by haul under each valuation.
      counts: {
        outEarn: Object.fromEntries(VALUATIONS.map(v => [v, OUT_EARN.map(t => [t, seasonCount(rs, r => {
          const mb = v === 'paid' ? r.bars.money : r.shadow && r.shadow[v] && r.shadow[v].money;
          return !!mb && !!mb.outEarn.find(x => x.type === t).pass;
        }, r => v === 'paid' || !!(r.shadow && r.shadow[v]))])])),
        byIncome: OUT_EARN.map(t => [t, seasonCount(rs, r => !!(r.bars.money && r.bars.money.byIncome.outEarn.find(x => x.type === t).pass))]),
        chems: seasonCount(rs, r => !!(r.bars.money && r.bars.money.chems.pass)),
        spread: seasonCount(rs, r => !!(r.bars.money && r.bars.money.spread.pass)),
      },
    },
  };
}

// The fence across seasons: counts summed.
function fenceSummary(rs) {
  const fs = rs.map(r => r.fence).filter(Boolean);
  return Object.fromEntries(['listed', 'sold', 'offered', 'swapped', 'lapsed', 'returned', 'fees'].map(k => [k, sum(fs.map(f => f[k]))]));
}

// R11 (reported, no bar): a season's hustles from the public record. `perNight`: the median of hustlers a night over the
// nights a hustle was legal (every night but the last); `byPlace`: hustles a season by district and level; `take`: the
// median take; `robbed`: won hits on an agent hustling that night; `arrested`: arrests of an agent the night it hustled.
export function hustleMetrics(log) {
  const hs = log.filter(e => e.type === 'hustle');
  const nights = Array.from({ length: N.nights - 1 }, (_, i) => i + 1);
  const on = new Set(hs.map(e => `${e.night}|${e.agent}`));
  const byPlace = {};
  for (const e of hs) {
    const p = (byPlace[e.place] ||= {});
    p[e.level] = (p[e.level] || 0) + 1;
  }
  return {
    perNight: median(nights.map(n => hs.filter(e => e.night === n).length)),
    total: hs.length,
    take: median(hs.map(e => e.take)),
    byPlace,
    robbed: log.filter(e => e.type === 'fight' && e.kind === 'hit' && e.won && on.has(`${e.night}|${e.target}`)).length,
    arrested: log.filter(e => e.type === 'arrest' && on.has(`${e.night}|${e.agent}`)).length,
  };
}
// R11: the hustles across seasons: medians of each season's numbers, and hustles a season by district and level (means).
function hustleSummary(rs) {
  const hs = rs.map(r => r.hustles).filter(Boolean);
  const byPlace = {};
  for (const h of hs) {
    for (const [place, levels] of Object.entries(h.byPlace)) {
      for (const [level, k] of Object.entries(levels)) {
        const p = (byPlace[place] ||= {});
        p[level] = (p[level] || 0) + k / hs.length;
      }
    }
  }
  return {
    perNight: median(hs.map(h => h.perNight)), take: median(hs.map(h => h.take)), total: median(hs.map(h => h.total)),
    robbed: median(hs.map(h => h.robbed)), arrested: median(hs.map(h => h.arrested)), byPlace,
  };
}
