// R3-5, the trades diagnosis ($0, bots only; trunk docs/briefs/R3-crime-pays.md, task 6). It changes no rule and no
// bot. It plays each season as the bench does (runner.mjs's runSeason, so every season is the bench's, event for event)
// and only watches it (runSeason's `observe`, as crime.mjs does), then reads the record, what it saw at each lock and
// each night's settled fights:
// - each trade's books: a seat's cash by where it came from and where it went, closed against its last cash, and its
//   goods by where they came from and where they went, closed against nothing (goods never board);
// - the supply chain: who handed what to whom and what was paid for it, the city's shop and buyer, and the street;
// - each seat's nights: its play, the reason its bot gave, what the night made, and what it cost (an arrest, a robbery,
//   a corner fight);
// - the crews: their jobs, the grabs, the vault, the cuts, the crew stash and the betrayals;
// - night 1, and a counterfactual for a Dealer that picks its corner blind there: the night settled again
//   (settleNight is pure; the runner settles every night twice already, for "places matter") with that one Dealer on
//   each corner in turn and every other play as played, and with every Dealer on a corner drawn at random;
// - §27's money bar, clause by clause, as passbars.mjs scores it (R4-11: the one module that owns §27's bars).
// Nothing it reads or computes reaches a bot: the counterfactual settles a copy and is thrown away.
// Usage: node core/bench/trades.mjs --seeds 404-423 --rules A,B --out <dir> [--cast crime] [--set key=value ...]
//          It writes trades.json and TRADES.md to --out, the seasons' run folders under it, and the bench's SUMMARY.md
//          and summary.json for the same seasons, as bench.mjs writes them (so bars.mjs reads the run too).
//        node core/bench/trades.mjs --compare <dir> [<dir> ...]
//          The key tables of several runs side by side, from their trades.json.
// R4-1: haul is copy paid (passbars.mjs's VALUATIONS); wherever it shows, the last-price mark and the opening price show
// beside it as labelled shadows; and the money bar's counts of seasons are also given as distinct seasons.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSeason, argsOrExit, parseSet, mixOrExit, castName, withOverrides } from './runner.mjs';
import { settleNight } from '../index.mjs';
import { N } from '../numbers.mjs';
import { rng, pick } from '../rng.mjs';
import { STREET, jobDay } from './bots.mjs';
import { median, seasonCount, SHADOWS, VALUED, TRADES, OUT_EARN } from './passbars.mjs';
import { summarize } from './metrics.mjs';
import { summaryMarkdown, countText } from './report.mjs';
import { DRUGS, levelTonight, unwornOf, crewPieces, rarest, hustleTake } from '../rules/state.mjs';
import { priceOf, cornerTakings } from '../rules/market.mjs';
// R11: a night's take, where the shift's wage was: the median of the night's public hustle takes, or null with nobody
// hustling; and one hustle alone in a normal district, for a night with none (state.mjs hustleTake).
const nightTake = (log, n) => median(log.filter(e => e.type === 'hustle' && e.night === n).map(e => e.take));
const loneTake = () => hustleTake('normal', 0);

const sum = xs => xs.reduce((t, x) => t + (x || 0), 0);
const mean = xs => (xs.length ? sum(xs) / xs.length : null);
const half = x => Math.floor(x / 2);
const money = x => (x == null || Number.isNaN(x) ? 'n/a' : `${x < 0 ? '−' : ''}$${Math.abs(Math.round(x)).toLocaleString('en-US')}`);
const pct = x => (x == null || Number.isNaN(x) ? 'n/a' : `${Math.round(x * 100)}%`);
const num = (x, d = 1) => (x == null || Number.isNaN(x) ? 'n/a' : Number(x).toFixed(d));
const share = (a, b) => (b ? a / b : null);

// The kinds of seat this report reads, in its order: the hustler (the yardstick), the trade bots, the crews, and
// the rest of §25's strategies.
const KINDS = ['hustle', 'smuggler', 'chemist', 'dealer', 'gunrunner', 'cop', 'crew', 'buylate', 'turtle', 'scout', 'guess'];
const TRADE_WORK = { smuggler: ['run'], chemist: ['cook'], dealer: ['deal'], gunrunner: ['build'], cop: ['patrol', 'guard', 'collar'] };
const ALL_WORK = ['run', 'cook', 'deal', 'build', 'patrol', 'guard', 'collar'];
const CRIMES = ['hit', 'breakin', 'grab', 'vault'];
// Goods as the trades deal in them: every drug is a dose.
const goodsKind = k => (DRUGS.includes(k) ? 'doses' : k);
const unitsOf = g => sum(Object.values(g || {}));
// What a unit is worth at the agents' trading price (§9's "about $15 a unit and $15 a dose"; the bots' STREET.unit).
const NOMINAL = { chems: STREET.unit, parts: STREET.unit, doses: STREET.unit, guns: 150, warrants: 110, lockpicks: 0, piece: 0 };

// --- what the watcher keeps -------------------------------------------------------------------------------------------
// At each lock: every agent's cash, goods, heat, home and jail, the corners' holders, the city's prices, the crate, the
// crews' stashes, and every play with its bot's reason. After each night: the checked plays, where everyone was, and
// every fight as it settled. On night 1, the blind-corner counterfactual.
function watcher(cast, seed) {
  const W = { lock: {}, night: {}, blind: null, log: null, state: null };
  W.observe = info => {
    const d = info.day;
    const S = info.state;
    if (info.at === 'lock') {
      W.lock[d] = {
        agents: Object.fromEntries(Object.keys(S.agents).map(id => {
          const a = S.agents[id];
          const keeps = a.crew && S.crews[a.crew] && S.crews[a.crew].keeper === id ? crewPieces(S, a.crew) : [];
          const k = rarest(S, [...unwornOf(S, id), ...keeps], null);
          const inside = k ? S.traits[S.copies[k].trait].last || S.traits[S.copies[k].trait].price : 0;
          return [id, { cash: a.cash, goods: { ...a.goods }, heat: a.heat, evicted: a.evicted, jail: !!a.jail, crew: a.crew, crash: a.crash, hooked: a.hooked.length, inside }];
        })),
        corners: Object.fromEntries(Object.keys(S.corners).map(c => [c, S.corners[c].holder])),
        buyer: Object.fromEntries(Object.keys(S.market.buyer).map(k => [k, priceOf('buyer', k, S.market.buyer[k])])),
        shop: Object.fromEntries(Object.keys(S.market.shop).map(k => [k, priceOf('shop', k, S.market.shop[k])])),
        crate: S.crate ? { cash: S.crate.cash, goods: { ...S.crate.goods } } : null,
        levels: Object.fromEntries(Object.keys(S.districts).map(x => [x, levelTonight(S, x, d)])),
        crews: Object.fromEntries(Object.values(S.crews).map(c => [c.id, { cash: c.cash, keeper: c.keeper, members: c.members.slice() }])),
        plays: Object.fromEntries(Object.entries(info.plays).map(([id, p]) => [id, { kind: p.kind, place: p.place, corner: p.corner, target: p.target, reason: typeof p.reason === 'string' ? p.reason : '' }])),
      };
      if (d === 1) W.blind = blindCorners(S, info.plays, cast, seed);
      return;
    }
    const R = info.result.fights;
    const P = info.result.plays;
    W.night[d] = {
      plays: Object.fromEntries(Object.entries(P).map(([id, p]) => [id, { kind: p.kind, place: p.place, corner: p.corner, target: p.target, batches: p.batches, drug: p.drug }])),
      where: Object.fromEntries(Object.entries(R.where).map(([id, w]) => [id, w.at === 'out' ? w.place : w.at])),
      fights: R.fights.map(f => ({
        kind: f.kind, target: f.target, corner: f.corner || null, place: f.place, level: f.level,
        attackers: f.attackers.map(g => ({ leader: g.leader, members: g.members.slice(), strength: g.strength })),
        defenders: (f.defenders || []).slice(), base: f.base, defence: f.defence, cops: f.cops, patrol: f.patrol || 0, patrols: (f.patrols || []).slice(),
        guard: f.guard || 0, winner: f.winner, arrested: f.arrested.slice(), tipped: !!f.tipped,
      })),
      missed: R.missed.map(m => ({ ...m })),
      deals: { ...R.deals },
    };
    W.log = info.log;
    W.state = info.state;
  };
  return W;
}

// --- night 1: a Dealer that picks its corner blind ------------------------------------------------------------------
// On night 1 nobody has a public night yet: a Dealer's view shows the eight corners (all open), which are hot, the
// police levels, and who works the Dealer trade on the board; not where any Cop will patrol, nor which corner any other
// Dealer means to take (GAME.md §19). The bots split the corners by a pecking order every one of them reads the same way
// (bots.mjs cornerByOrder). Here, from the lock's state and plays: (1) each Dealer that deals tonight is moved, alone,
// to each of the eight corners in turn, every other play as played: does it deal, tie, get arrested? (2) every Dealer
// that deals tonight is put on a corner drawn at random (BLIND_DRAWS draws a season): how many collide, how many are
// arrested? Each settles a copy of the night and is thrown away.
const BLIND_DRAWS = 20;
// The bots' crew cut (bots.mjs CUT), for the habit table only.
const CUT_BOT = 20;
function blindCorners(S, played, cast, seed) {
  // A copy of the plays, so the season's own are never touched.
  const plays = JSON.parse(JSON.stringify(played));
  const corners = Object.keys(N.corners).sort();
  const dealers = Object.keys(plays).filter(id => plays[id].kind === 'deal').sort();
  const settle = ps => settleNight(S, ps);
  const outcome = (res, id) => {
    const p = res.plays[id];
    const f = res.fights.fights.find(x => x.kind === 'corner' && x.corner === p.corner && (x.attackers.some(g => g.members.includes(id)) || x.target === id));
    const sale = res.events.find(e => e.type === 'sale' && e.agent === id);
    return {
      corner: p.corner, dealt: res.fights.deals[p.corner] === id && !!sale && sale.doses > 0, fight: !!f, tie: !!f && !f.winner,
      arrested: res.events.some(e => e.type === 'arrest' && e.agent === id), cash: sale ? sale.cash : 0, patrolled: !!f && f.patrol > 0,
      heavy: N.corners[p.corner].place === 'downtown',
    };
  };
  const actual = settle(plays);
  const own = Object.fromEntries(dealers.map(id => [id, outcome(actual, id)]));
  const moves = [];
  for (const id of dealers) {
    for (const c of corners) {
      const ps = { ...plays, [id]: { ...plays[id], kind: 'deal', corner: c, place: N.corners[c].place, reason: 'blind' } };
      moves.push({ id, mine: c === plays[id].corner, taken: dealers.some(x => x !== id && plays[x].corner === c), ...outcome(c === plays[id].corner ? actual : settle(ps), id) });
    }
  }
  const draws = [];
  for (let k = 0; k < BLIND_DRAWS && dealers.length; k++) {
    const r = rng(seed, 'blind-corners', k);
    const ps = { ...plays };
    for (const id of dealers) {
      const c = pick(r, corners);
      ps[id] = { ...plays[id], kind: 'deal', corner: c, place: N.corners[c].place, reason: 'blind' };
    }
    const res = settle(ps);
    const outs = dealers.map(id => outcome(res, id));
    draws.push({ dealers: dealers.length, fights: outs.filter(o => o.fight).length, ties: outs.filter(o => o.tie).length, arrested: outs.filter(o => o.arrested).length, dealt: outs.filter(o => o.dealt).length, cash: sum(outs.map(o => o.cash)) });
  }
  const patrols = Object.keys(plays).filter(id => plays[id].kind === 'patrol').map(id => plays[id].place).sort();
  return { dealers: dealers.length, own, moves, draws, patrols, actualCash: sum(Object.values(own).map(o => o.cash)) };
}

// --- each seat's books ------------------------------------------------------------------------------------------------
// Money in and out by kind, from the record. Prices between agents are their own (§9): a payment for goods (a `pay`
// for a debt) is matched to the oldest goods the payee handed the payer that are still unpaid, and booked under their
// kind. Dawn's rent has no event: it's paid by everyone who played the night, wasn't arrested in it, had a home and
// wasn't evicted at that dawn (night.mjs dawn). A theft's own-cash part is what the rules take from what the victim held
// at the lock (half of it, or all under breakinShare 1, for a break-in; half on the last night or from an evicted agent
// for a hit), the break-ins first, as the night settles them; under R3-2's hold-up (gap.holdup 'pay') a won hit takes
// the pay its target's work made tonight, which the target's own work record still shows, so it goes out as `heldUp`.
// `rest` is whatever no event explains (fence swaps' cash, an evicted guest's half; it should be near $0).
const IN = ['hustle', 'police', 'collar', 'flex', 'street', 'buyer:chems', 'buyer:parts', 'buyer:doses', 'sold:chems', 'sold:parts', 'sold:doses', 'sold:guns', 'sold:warrants', 'sold:piece', 'sold:other',
  'thefts', 'grabs', 'vault', 'bounty', 'fence', 'stashTake', 'cuts', 'muscle', 'gifts', 'refund'];
const OUT = ['rent', 'tab', 'list', 'fenceBuy', 'bought:chems', 'bought:parts', 'bought:doses', 'bought:guns', 'bought:warrants', 'bought:piece', 'bought:other', 'shop:chems', 'shop:parts', 'shop:guns',
  'bail', 'bribe', 'lookout', 'bountyPost', 'fine', 'robbed', 'heldUp', 'musclePaid', 'cutsPaid', 'stashPut', 'giftsOut'];
function books(W, ids) {
  const log = W.log;
  const B = Object.fromEntries(ids.map(id => [id, Object.fromEntries([...IN, ...OUT, 'rest', 'end', 'missed'].map(k => [k, 0]))]));
  const add = (id, k, x) => {
    if (B[id] && x) B[id][k] += x;
  };
  // Goods handed over, waiting to be paid for, by `seller>buyer`.
  const due = {};
  const unpaid = {};
  for (const e of log) {
    switch (e.type) {
      case 'hustle': add(e.agent, 'hustle', e.take); break;
      case 'patrol': case 'guard': add(e.agent, 'police', e.wage); break;
      case 'collar': add(e.agent, 'collar', e.pay); break;
      case 'flex': add(e.agent, 'flex', e.pay); break;
      case 'sale': add(e.agent, 'street', e.cash); break;
      case 'sell': add(e.agent, `buyer:${e.item}`, e.cash); break;
      case 'shop': add(e.agent, `shop:${e.item}`, e.cash); break;
      case 'bid': add(e.agent, 'list', e.amount); break;
      case 'refund': add(e.agent, 'refund', e.amount); break;
      case 'give': {
        if (e.cash) {
          add(e.from, 'giftsOut', e.cash);
          add(e.to, 'gifts', e.cash);
        }
        const q = (due[`${e.from}>${e.to}`] ||= []);
        for (const [k, u] of Object.entries(e.goods || {})) q.push({ kind: goodsKind(k), units: u });
        if (e.copy) q.push({ kind: 'piece', units: 1 });
        break;
      }
      case 'pay': {
        if (e.for === 'debt') {
          const q = due[`${e.to}>${e.from}`] || [];
          const lot = q.shift();
          const k = lot ? lot.kind : 'other';
          add(e.to, `sold:${k}`, e.amount);
          add(e.from, `bought:${k}`, e.amount);
        } else if (e.for === 'deal') {
          add(e.from, 'musclePaid', e.amount);
          add(e.to, 'muscle', e.amount);
        } else if (e.for === 'cut') {
          add(e.from, 'cutsPaid', e.amount);
          add(e.to, 'cuts', e.amount);
        } else {
          add(e.from, 'giftsOut', e.amount);
          add(e.to, 'gifts', e.amount);
        }
        break;
      }
      case 'bail': add(e.by, 'bail', e.amount); break;
      case 'rent': add(e.agent, 'rent', e.amount); break;
      case 'bribe': add(e.by, 'bribe', e.price); break;
      case 'look': add(e.by, 'lookout', N.lookout); break;
      case 'bounty':
        if (e.act === 'post') add(e.by, 'bountyPost', e.amount);
        else if (e.act === 'collected') add(e.to, 'bounty', e.amount);
        break;
      case 'stash':
        if (e.act === 'put') add(e.agent, 'stashPut', e.cash);
        else if (e.act === 'take' || e.act === 'aboard') add(e.agent, 'stashTake', e.cash);
        break;
      case 'fence':
        if (e.act === 'buy') add(e.agent, 'fenceBuy', e.price);
        else if (e.act === 'sold') add(e.agent, 'fence', e.cash);
        else if (e.act === 'returned' && e.cash) add(e.agent, 'refund', e.cash);
        break;
      case 'rob': case 'burgle': add(e.leader, 'thefts', e.cash); break;
      case 'grab': add(e.leader, 'grabs', e.cash); break;
      case 'vault': add(e.leader, 'vault', e.cash); break;
      case 'seized': add(e.agent, 'fine', e.fine); break;
      case 'tab': add(e.agent, 'tab', e.paid); break;
      default:
    }
  }
  // Goods handed over and never paid for, at the agents' price, by seller.
  for (const [key, q] of Object.entries(due)) {
    const seller = key.split('>')[0];
    for (const lot of q) unpaid[seller] = (unpaid[seller] || 0) + lot.units * (NOMINAL[lot.kind] || 0);
  }
  // Dawn's rent.
  const nights = Object.keys(W.night).map(Number).sort((x, y) => x - y);
  for (const n of nights) {
    if (n >= N.nights) continue;
    const evictedNow = new Set(log.filter(e => e.type === 'evicted' && e.on && e.t === 2 * (n + 1)).map(e => e.agent));
    const jailed = new Set(log.filter(e => e.type === 'arrest' && e.night === n).map(e => e.agent));
    for (const id of ids) {
      if (!W.night[n].plays[id] || jailed.has(id) || W.lock[n].agents[id].evicted || evictedNow.has(id)) continue;
      add(id, 'rent', N.rent);
    }
  }
  // Thefts' own-cash part and the hold-up's pay.
  for (const [id, x] of Object.entries(ownTakes(W))) {
    add(id, 'robbed', x.robbed);
    add(id, 'heldUp', x.held);
  }
  const finalCash = Object.fromEntries(log.filter(e => e.type === 'mint' || e.type === 'missed').map(e => [e.agent, e.cash]));
  for (const id of ids) {
    const b = B[id];
    b.end = finalCash[id] != null ? finalCash[id] : W.state.agents[id].cash;
    b.missed = log.some(e => e.type === 'missed' && e.agent === id) ? b.end : 0;
    b.rest = sum(IN.map(k => b[k])) - sum(OUT.map(k => b[k])) - b.end;
    b.unpaid = unpaid[id] || 0;
  }
  return B;
}

// The cash each victim lost from its own hand in tonight's takes, and the pay a hold-up took, by agent. Its cash at the
// lock is what the watcher saw before the night plus what the fence paid it there (and, on the last night, the crew
// stash that went aboard with it and the fence's hand-back); then the night's takes in the order they settled.
function ownTakes(W) {
  const log = W.log;
  const out = {};
  const add = (id, k, x) => {
    out[id] ||= { robbed: 0, held: 0 };
    out[id][k] += x || 0;
  };
  const holdup = N['gap.holdup'] === 'pay';
  for (const n of Object.keys(W.night).map(Number)) {
    const last = n === N.nights;
    const takes = log.filter(e => (e.type === 'rob' || e.type === 'burgle') && e.night === n);
    if (!takes.length) continue;
    const cash = {};
    const at = id => {
      if (cash[id] == null) {
        const t = 2 * n + 1;
        cash[id] = W.lock[n].agents[id].cash
          + sum(log.filter(e => e.type === 'fence' && e.t === t && e.agent === id && (e.act === 'sold' || e.act === 'returned')).map(e => e.cash || 0))
          + sum(log.filter(e => e.type === 'stash' && e.act === 'aboard' && e.t === t && e.agent === id).map(e => e.cash || 0));
      }
      return cash[id];
    };
    const was = {};
    for (const e of takes) if (was[e.target] == null) was[e.target] = at(e.target);
    for (const e of takes) {
      const v = e.target;
      if (e.vest) continue;
      let own = 0;
      if (e.type === 'burgle') own = Math.floor(Math.min(was[v], cash[v]) * N.breakinShare);
      else if (last || W.lock[n].agents[v].evicted || N['gap.purse'] === 'half') own = half(Math.min(was[v], cash[v]));
      cash[v] -= own;
      add(v, 'robbed', own);
      if (holdup && e.type === 'rob') add(v, 'held', payOf(W, log, v, n));
    }
  }
  return out;
}
// What a worker's work paid it tonight, as its own record shows it: a hustle's take, a patrol's or a guard's wage, a
// corner's takings.
function payOf(W, log, id, n) {
  const p = W.night[n].plays[id];
  if (!p) return 0;
  if (p.kind === 'hustle') {
    const h = log.find(e => e.type === 'hustle' && e.agent === id && e.night === n);
    return h ? h.take : 0;
  }
  if (p.kind === 'patrol' || p.kind === 'guard') {
    const e = log.find(x => x.type === p.kind && x.agent === id && x.night === n);
    return e ? e.wage : 0;
  }
  if (p.kind === 'deal') {
    const e = log.find(x => x.type === 'sale' && x.agent === id && x.night === n);
    return e && e.doses ? e.cash : 0;
  }
  return 0;
}

// --- each seat's goods ------------------------------------------------------------------------------------------------
// Units of each kind (chems, parts, doses, guns, warrants, lockpicks), in by source and out by sink. A season's goods
// all leave by the ferry (gap.goodsGone), so a seat's in and out must match.
const G_IN = ['kit', 'drop', 'cook', 'build', 'got', 'shop', 'grab', 'stolen', 'stashTake'];
const G_OUT = ['given', 'buyer', 'cooked', 'built', 'dealt', 'taken', 'robbed', 'used', 'stashPut', 'gone'];
function goodsBooks(log, ids, kits) {
  const G = Object.fromEntries(ids.map(id => [id, {}]));
  const add = (id, side, src, goods) => {
    if (!G[id]) return;
    for (const [k, u] of Object.entries(goods || {})) {
      if (!u) continue;
      const kind = goodsKind(k);
      const row = (G[id][kind] ||= { in: {}, out: {} });
      row[side][src] = (row[side][src] || 0) + u;
    }
  };
  for (const id of ids) add(id, 'in', 'kit', kits[id] || {});
  for (const e of log) {
    switch (e.type) {
      case 'gather': add(e.agent, 'in', 'drop', e.goods); break;
      case 'cook':
        if (e.batches) {
          add(e.agent, 'in', 'cook', { [e.drug || 'temp']: e.doses });
          add(e.agent, 'out', 'cooked', { chems: e.chems });
        }
        break;
      case 'craft':
        add(e.agent, 'in', 'build', { guns: e.guns, lockpicks: e.lockpicks, warrants: e.warrants || 0 });
        add(e.agent, 'out', 'built', { parts: e.parts });
        break;
      case 'give':
        add(e.from, 'out', 'given', e.goods);
        add(e.to, 'in', 'got', e.goods);
        break;
      case 'shop': add(e.agent, 'in', 'shop', { [e.item]: e.units }); break;
      case 'sell': add(e.agent, 'out', 'buyer', { [e.item]: e.units }); break;
      case 'sale': add(e.agent, 'out', 'dealt', { doses: e.doses }); break;
      case 'take': add(e.agent, 'out', 'taken', { [e.drug]: 1 }); break;
      case 'grab': add(e.leader, 'in', 'grab', e.goods); break;
      case 'rob':
        if (e.goods) {
          add(e.leader, 'in', 'stolen', e.goods);
          add(e.target, 'out', 'robbed', e.goods);
        }
        break;
      case 'used': add(e.agent, 'out', 'used', e.goods); break;
      case 'stash':
        if (e.goods && e.act === 'put') add(e.agent, 'out', 'stashPut', e.goods);
        if (e.goods && e.act === 'take') add(e.agent, 'in', 'stashTake', e.goods);
        break;
      case 'mint': add(e.agent, 'out', 'gone', e.goodsLeft); break;
      case 'missed': add(e.agent, 'out', 'gone', e.goods); break;
      default:
    }
  }
  // A sale to the city's buyer names the dose's drug, or sells TEMP; the street takes the doses carried. Both are
  // `doses` here, so nothing more to do. The rest must be zero.
  for (const id of ids) {
    for (const row of Object.values(G[id])) row.rest = sum(Object.values(row.in)) - sum(Object.values(row.out));
  }
  return G;
}

// --- each seat's nights -----------------------------------------------------------------------------------------------
// A bot's reason, with ids, corners, districts and numbers taken out, so like reasons count together.
const PLACES = new RegExp(`\\b(${[...Object.keys(N.corners), 'downtown', 'strip', 'industrial', 'suburbs', 'docks', 'junkyard', 'mall', 'forest'].join('|')})\\b`, 'g');
const norm = r => String(r || '').replace(/\ba\d\d\b/g, 'X').replace(PLACES, '<place>').replace(/\$?\d+/g, 'N').replace(/:.*$/, '').trim();
function seatNights(W, log, ids, typeOf, tradeOf) {
  const out = Object.fromEntries(ids.map(id => [id, []]));
  const arrests = log.filter(e => e.type === 'arrest');
  const forced = log.filter(e => e.type === 'forced');
  for (const n of Object.keys(W.night).map(Number).sort((x, y) => x - y)) {
    const L = W.lock[n];
    const night = W.night[n];
    const wage = nightTake(log, n);
    // What the sellers held at the lock, unsold: the Chemists' doses, the Smugglers' chems and parts.
    const stockOf = (trade, kinds, but) => sum(ids.filter(x => x !== but && tradeOf[x] === trade && !L.agents[x].jail).map(x => sum(kinds.map(k => L.agents[x].goods[k] || 0))));
    for (const id of ids) {
      const a = L.agents[id];
      if (a.jail) {
        out[id].push({ n, cat: 'jail' });
        continue;
      }
      const raw = L.plays[id] || {};
      const p = night.plays[id] || {};
      const f = forced.find(e => e.agent === id && e.t === 2 * n + 1);
      const kind = p.kind;
      let cat = kind === 'hustle' ? 'hustle' : ALL_WORK.includes(kind) ? 'trade' : CRIMES.includes(kind) ? 'crime' : kind === 'laylow' ? 'laylow' : kind === 'board' ? 'board' : kind === 'back' ? 'back' : 'other';
      // Backing: a crew's job is a crime, a collar is Cop work, and the rest (hired muscle, a bodyguard SUDO wrote, a
      // walk to the dock) is backing.
      if (kind === 'back') {
        const lp = night.plays[p.target] || {};
        if (CRIMES.includes(lp.kind)) cat = 'crime';
        else if (lp.kind === 'collar') cat = 'trade';
      }
      const held = { chems: a.goods.chems || 0, parts: a.goods.parts || 0, doses: sum(DRUGS.map(d => a.goods[d] || 0)), guns: a.goods.guns || 0 };
      const rec = {
        n, cat, kind, raw: raw.kind, reason: norm(raw.reason), forced: f ? f.why : null, wage, place: p.place || null, corner: p.corner || null,
        evicted: a.evicted, heat: a.heat, cash: a.cash, held,
        stock: { doses: stockOf('chemist', DRUGS, id), chems: stockOf('smuggler', ['chems'], id), parts: stockOf('smuggler', ['parts'], id) },
      };
      rec.limit = limitOf(rec, tradeOf[id], typeOf[id], n);
      // What the night made.
      const gather = log.find(e => e.type === 'gather' && e.agent === id && e.night === n);
      if (gather) rec.units = unitsOf(gather.goods);
      if (gather) rec.atDrop = log.filter(e => e.type === 'gather' && e.night === n && e.place === gather.place).length;
      const cook = log.find(e => e.type === 'cook' && e.agent === id && e.night === n);
      if (cook) Object.assign(rec, { batches: cook.batches, doses: cook.doses, chems: cook.chems, drug: cook.drug || 'temp', lab: cook.place !== 'suburbs' });
      const sale = log.find(e => e.type === 'sale' && e.agent === id && e.night === n);
      if (sale) Object.assign(rec, { sold: sale.doses, takings: sale.cash, hot: sale.hot });
      if (kind === 'deal') rec.carried = Math.min(sum(DRUGS.map(d => a.goods[d] || 0)), L.corners[p.corner] === id ? N.deal.held : N.deal.cap);
      const craft = log.find(e => e.type === 'craft' && e.agent === id && e.night === n);
      if (craft) Object.assign(rec, { guns: craft.guns, warrants: craft.warrants || 0, fakes: craft.fakes || 0, parts: craft.parts });
      const police = log.find(e => (e.type === 'patrol' || e.type === 'guard') && e.agent === id && e.night === n);
      if (police) rec.police = police.wage;
      const collar = log.find(e => e.type === 'collar' && e.agent === id && e.night === n);
      if (collar) rec.collar = collar.pay;
      // What it cost.
      rec.arrested = arrests.some(e => e.agent === id && e.night === n);
      rec.arrestedSoon = arrests.some(e => e.agent === id && e.night >= n && e.night <= n + 2);
      const robbed = log.find(e => e.type === 'robbed' && e.agent === id && e.night === n);
      if (robbed) rec.robbed = { kind: robbed.kind, cash: robbed.cash, goods: unitsOf(robbed.goods), piece: !!robbed.copy };
      const cf = night.fights.find(x => x.kind === 'corner' && (x.attackers.some(g => g.leader === id) || x.target === id));
      if (cf) rec.cornerFight = { role: cf.target === id ? 'held' : 'challenged', won: cf.winner === id || (cf.target === id && !cf.winner), tie: !cf.winner && !cf.target, arrested: cf.arrested.includes(id), patrol: cf.patrol > 0, cops: cf.cops };
      out[id].push(rec);
    }
  }
  return out;
}

// Why a seat that works a trade didn't work it tonight, from its bot's reason and what it held at the lock: supply (it
// held nothing to work with), demand (a Gunrunner's one gun still unsold), cash up front (a cook or a build that would
// leave it short of the rent), heat (wanted, or no bail reserve late on), a drug or SUDO, its strategy's night (a crew's
// job, a robber's crime, a turtle's lying low), a counter-hit. null on a night it worked its trade, or one in jail.
function limitOf(rec, trade, type, n) {
  if (rec.cat === 'jail' || rec.cat === 'board') return null;
  if ((TRADE_WORK[trade] || []).includes(rec.kind)) return null;
  if (rec.forced) return rec.forced === 'sudo' ? 'SUDO wrote its play' : `a drug: ${rec.forced}`;
  const r = rec.reason;
  if (r.startsWith('short of compute')) return 'cash up front: short of compute';
  if (r.startsWith('no bail reserve')) return 'heat: no bail reserve before the ferry';
  if (r.startsWith('wanted')) return 'heat: wanted, lies low';
  if (r.startsWith('counter-hit')) return 'a counter-hit on a crew';
  if (type === 'crew' && jobDay(n)) return "its crew's job";
  if (type === 'turtle' && rec.kind === 'laylow') return "the turtle's lying low";
  if (CRIMES.includes(rec.kind) || (rec.kind === 'back' && rec.cat === 'crime')) return 'its strategy: a crime';
  if (rec.kind === 'back') return 'backing (muscle, a bodyguard)';
  if (rec.kind === 'hustle' && r.startsWith('a hustle always pays')) {
    if (trade === 'chemist') return rec.held.chems < N.cook.chems ? 'supply: under 2 chems' : 'other';
    if (trade === 'dealer') return rec.held.doses ? 'no corner it could work' : 'supply: no doses';
    if (trade === 'gunrunner') return rec.evicted ? 'evicted: no home to build in' : rec.held.guns >= 1 ? 'demand: its one gun unsold' : rec.held.parts < N.build.guns ? 'supply: under 2 parts' : 'other';
    if (trade === 'cop') return 'other';
  }
  return `other: ${rec.kind} (${r})`;
}

// --- the supply chain -------------------------------------------------------------------------------------------------
// Every hand-over of goods, by the seller's trade and the buyer's kind of seat, with what was paid for it (the debt
// payments matched as in books); the city's shop and buyer by item and by kind of seat; the street.
function supplyChain(W, log, typeOf, tradeOf) {
  // A trade's own bot, or a seat whose strategy works that trade on its free nights.
  const who = id => (typeOf[id] === tradeOf[id] ? 'bot' : 'works');
  const flows = {};
  const due = {};
  const row = key => (flows[key] ||= { units: 0, paid: 0, paidUnits: 0, hand: 0, bot: 0 });
  for (const e of log) {
    if (e.type === 'give' && (e.goods || e.copy)) {
      for (const [k, u] of Object.entries(e.copy ? { ...(e.goods || {}), piece: 1 } : e.goods)) {
        const key = `${tradeOf[e.from]}>${tradeOf[e.to]}|${goodsKind(k)}`;
        row(key).units += u;
        row(key).hand += 1;
        if (who(e.from) === 'bot') row(key).bot += u;
        (due[`${e.from}>${e.to}`] ||= []).push({ key, units: u });
      }
    }
    if (e.type === 'pay' && e.for === 'debt') {
      const q = due[`${e.to}>${e.from}`] || [];
      const lot = q.shift();
      if (lot) {
        row(lot.key).paid += e.amount;
        row(lot.key).paidUnits += lot.units;
      }
    }
  }
  const city = {};
  for (const e of log) {
    if (e.type !== 'shop' && e.type !== 'sell') continue;
    const key = `${e.type === 'shop' ? 'shop' : 'buyer'}|${goodsKind(e.item)}|${tradeOf[e.agent]}`;
    const r = (city[key] ||= { units: 0, cash: 0, bot: 0, lastDay: 0 });
    r.units += e.units;
    r.cash += e.cash;
    if (who(e.agent) === 'bot') r.bot += e.units;
    // The last day, when every seat sells what it holds: goods never board (gap.goodsGone).
    if (e.day >= N.nights) r.lastDay += e.units;
  }
  // The city's buyer: its price for each item at every lock (the board's next unit), to see how far dumping drives it.
  const buyerAt = Object.fromEntries(Object.keys(W.lock).map(d => [d, W.lock[d].buyer]));
  const street = log.filter(e => e.type === 'sale' && e.doses);
  return {
    flows, city, buyerAt,
    shopAt: Object.fromEntries(Object.keys(W.lock).map(d => [d, W.lock[d].shop])),
    street: { doses: sum(street.map(e => e.doses)), cash: sum(street.map(e => e.cash)), nights: street.length, hot: street.filter(e => e.hot).length, hotDoses: sum(street.filter(e => e.hot).map(e => e.doses)), hotCash: sum(street.filter(e => e.hot).map(e => e.cash)) },
    goods: JSON.parse(JSON.stringify(W.state.goods)),
  };
}

// --- the crews ----------------------------------------------------------------------------------------------------------
// Each crew's jobs (its leader's play on a job day and on the last night), with the fight and the take; every grab at
// the docks; the cuts, the stash and the betrayals.
function crewsOf(W, log, cast, typeOf, worthOf) {
  const crews = {};
  for (const c of cast.filter(x => x.type === 'crew')) {
    const k = c.crewName;
    crews[k] ||= { name: k, leader: c.leader, members: [], snake: null };
    crews[k].members.push(c.id);
    if (c.snake) crews[k].snake = c.id;
  }
  const jobs = [];
  for (const cr of Object.values(crews)) {
    for (const n of Object.keys(W.night).map(Number).sort((x, y) => x - y)) {
      // A job night: the crews' calendar's (jobDay), the last night, and (R3-6's canny cast, whose leaders call a job on
      // any night) any night its leader's play was a crime.
      if (!jobDay(n) && n !== N.nights && !CRIMES.includes((W.night[n].plays[cr.leader] || {}).kind)) continue;
      const L = W.lock[n];
      const P = W.night[n].plays;
      const lead = cr.leader;
      if (L.agents[lead].jail) {
        if (jobDay(n)) jobs.push({ crew: cr.name, n, kind: 'leader in jail' });
        continue;
      }
      const p = P[lead] || {};
      if (!CRIMES.includes(p.kind)) {
        if (jobDay(n)) jobs.push({ crew: cr.name, n, kind: `no job (${p.kind})`, reason: norm((L.plays[lead] || {}).reason) });
        continue;
      }
      const f = W.night[n].fights.find(x => x.kind === p.kind && x.attackers.some(g => g.leader === lead));
      const g = f && f.attackers.find(x => x.leader === lead);
      const backers = cr.members.filter(m => m !== lead && (P[m] || {}).kind === 'back' && P[m].target === lead);
      const take = log.find(e => ['rob', 'burgle', 'grab', 'vault'].includes(e.type) && e.leader === lead && e.night === n);
      const value = !take ? 0 : take.type === 'grab' ? take.cash + sum(Object.entries(take.goods || {}).map(([k, u]) => u * (NOMINAL[goodsKind(k)] || 0)))
        : take.type === 'vault' ? take.cash + sum((take.copies || []).map(worthOf))
          : take.cash + (take.copy ? worthOf(take.copy) : 0) + sum(Object.entries(take.goods || {}).map(([k, u]) => u * (NOMINAL[goodsKind(k)] || 0)));
      jobs.push({
        crew: cr.name, n, kind: p.kind, target: p.target ? typeOf[p.target] : null, found: !!f, won: !!f && f.winner === lead,
        size: g ? g.members.length : 1, crewIn: g ? g.members.filter(m => cr.members.includes(m)).length : 1, backers: backers.length, strength: g ? g.strength : null,
        defence: f ? f.defence : null, cops: f ? f.cops : null, patrol: f ? f.patrol : null, tipped: f ? f.tipped : false, rivals: f ? f.attackers.length - 1 : 0,
        arrested: f ? f.arrested.length : 0, arrestedCrew: f ? f.arrested.filter(m => cr.members.includes(m)).length : 0, value, cash: take ? take.cash : 0,
        wage: nightTake(log, n) ?? loneTake(), last: n === N.nights,
      });
    }
  }
  const grabs = [];
  for (const n of Object.keys(W.night).map(Number)) {
    for (const f of W.night[n].fights.filter(x => x.kind === 'grab')) {
      const top = f.attackers.slice().sort((x, y) => y.strength - x.strength)[0];
      const tie = f.attackers.filter(g => g.strength === top.strength).length > 1;
      grabs.push({
        n, groups: f.attackers.length, leaders: f.attackers.map(g => typeOf[g.leader]), top: top.strength, defence: f.defence, cops: f.cops, patrol: f.patrol, patrols: f.patrols.length,
        won: !!f.winner, why: f.winner ? 'won' : tie && top.strength > f.defence ? 'a tie between groups' : 'the defence held', arrested: f.arrested.length, tipped: f.tipped,
        crate: (W.lock[n].crate ? W.lock[n].crate.cash + sum(Object.entries(W.lock[n].crate.goods).map(([k, u]) => u * (NOMINAL[goodsKind(k)] || 0))) : 0),
      });
    }
  }
  const betrayals = {};
  const seen = new Set();
  for (const e of log.filter(x => x.type === 'betray')) {
    const key = `${e.kind}|${e.by}|${e.night ?? `d${e.day}`}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const b = (betrayals[e.kind] ||= { n: 0, cash: 0, owed: 0, paid: 0, byType: {} });
    b.n += 1;
    b.cash += e.cash || 0;
    b.owed += e.owed || 0;
    b.paid += e.paid || 0;
    b.byType[typeOf[e.by]] = (b.byType[typeOf[e.by]] || 0) + 1;
  }
  // The stash: what members put in and took out, what went aboard with the keeper, the pieces it held, and the cash that
  // left the island with it.
  const stash = { put: 0, take: 0, aboardCash: 0, aboardPieces: 0, aboardValue: 0, putPieces: 0, gone: 0 };
  for (const e of log.filter(x => x.type === 'stash')) {
    if (e.act === 'put') {
      stash.put += e.cash || 0;
      if (e.copy) stash.putPieces += 1;
    } else if (e.act === 'take') stash.take += e.cash || 0;
    else if (e.act === 'aboard') {
      stash.aboardCash += e.cash || 0;
      stash.aboardPieces += (e.copies || []).length;
      stash.aboardValue += sum((e.copies || []).map(worthOf));
    }
  }
  stash.gone = sum(log.filter(e => e.type === 'gone' && String(e.from).startsWith('crew:')).map(e => e.cash || 0));
  return { crews: Object.values(crews), jobs, grabs, betrayals, stash };
}

// --- night 1 ------------------------------------------------------------------------------------------------------------
function nightOne(W, log, ids, typeOf) {
  const L = W.lock[1];
  const night = W.night[1];
  const plays = {};
  const reasons = {};
  for (const id of ids) {
    if (L.agents[id].jail) continue;
    const t = typeOf[id];
    const k = (night.plays[id] || {}).kind;
    (plays[t] ||= {})[k] = (plays[t][k] || 0) + 1;
    const r = `${t}: ${k} (${norm(L.plays[id].reason)})`;
    reasons[r] = (reasons[r] || 0) + 1;
  }
  const n1 = log.filter(e => e.night === 1);
  return {
    plays, reasons,
    fights: night.fights.map(f => `${f.kind}${f.winner ? ' won' : f.attackers.length > 1 ? ' tie' : ' held'}`),
    thefts: n1.filter(e => e.type === 'rob' || e.type === 'burgle').length,
    arrests: n1.filter(e => e.type === 'arrest').length,
    patrols: Object.values(night.plays).filter(p => p.kind === 'patrol').map(p => p.place),
    dealers: Object.values(night.plays).filter(p => p.kind === 'deal').map(p => p.corner),
    cash: Object.values(L.agents).reduce((t, a) => t + a.cash, 0),
    carried: n1.filter(e => e.type === 'gather').length,
  };
}

// --- what each trade could make: estimates, not seasons ------------------------------------------------------------------
// The Dealer's is a player's view. The crew's is a replay that reads more than a view (see sharpCrew), and the
// Smuggler's, the Chemist's and the Gunrunner's are fair-share bounds (sharpSummary), not views.
// One more seat, played sharply night by night on the season as it was (everyone else as played), from what its view
// shows at GAME.md §19's delays: the board live (the corners and their holders, police levels, who's jailed), the show's
// sightings of last night (where it saw each agent, the Cops among them), and the 24-hour record (each agent's cash and
// stash at the dawn before last). It changes nobody's play, so what it would have done to the others (and they to it)
// isn't counted: an estimate of what the rules pay a player that reads the board, not a season.
const lastSeen = (log, n) => {
  const show = log.find(e => e.type === 'show' && e.night === n - 1);
  return show ? show.seen : {};
};

// A sharp Dealer: 7 doses on hand every day at the agents' $15 (the assumption: TRADES.md shows the Chemists held them),
// on a corner the board shows open, never Glasswall's (its heavy cops jail both sides of any corner fight); a hot corner
// while one more star keeps it below wanted, else a normal one in a district where the show saw no Cop last night (no
// heat), so it never turns wanted; the corner it dealt last night first (7 doses there, and it defends it). The night as
// played then decides: a real Dealer on its corner is a fight (it holds a corner it held; a tie on an open one, and an
// arrest if cops were in it), a real patrol there adds a star.
function sharpDealer(W, log, tradeOf) {
  const corners = Object.keys(N.corners).sort();
  let heat = 0;
  let held = null;
  let jail = 0;
  const out = { nights: 0, dealt: 0, takings: 0, cost: 0, net: 0, arrests: 0, ties: 0, hot: 0 };
  for (let n = 1; n < N.nights; n++) {
    const L = W.lock[n];
    const night = W.night[n];
    if (jail > 0) {
      jail -= 1;
      continue;
    }
    out.nights += 1;
    const seen = lastSeen(log, n);
    const copsSeen = new Set(Object.entries(seen).filter(([id, p]) => tradeOf[id] === 'cop' && p !== 'home').map(([, p]) => p));
    const open = c => c === held || !L.corners[c] || L.agents[L.corners[c]].jail;
    const ok = corners.filter(c => N.corners[c].place !== 'downtown' && open(c));
    const hot = heat + N.workHeat < N.wantedAt ? ok.filter(c => N.corners[c].hot && !copsSeen.has(N.corners[c].place)) : [];
    const cool = ok.filter(c => !N.corners[c].hot && !copsSeen.has(N.corners[c].place));
    const pickOf = list => list.find(c => c === held) || list[0] || null;
    const c = pickOf(hot) || pickOf(cool);
    if (!c) {
      heat = Math.max(0, heat - 1);
      continue;
    }
    const place = N.corners[c].place;
    const rivals = Object.entries(night.plays).filter(([, p]) => p.kind === 'deal' && p.corner === c).length;
    const patrol = Object.values(night.plays).some(p => p.kind === 'patrol' && p.place === place);
    const level = L.levels[place];
    const mine = c === held;
    if (rivals && !mine) {
      out.ties += 1;
      held = null;
      if (patrol || level === 'heavy') {
        out.arrests += 1;
        jail = N.jailNights;
        heat = 0;
      } else heat = Math.max(0, heat - 1);
      continue;
    }
    const doses = mine ? N.deal.held : N.deal.cap;
    const takings = cornerTakings(doses, N.corners[c].hot);
    out.dealt += 1;
    out.takings += takings;
    out.cost += doses * STREET.unit;
    out.hot += N.corners[c].hot ? 1 : 0;
    const stars = (N.corners[c].hot || patrol) ? N.workHeat : 0;
    heat = stars ? Math.min(N.maxHeat, heat + stars) : Math.max(0, heat - 1);
    held = c;
  }
  out.net = out.takings - out.cost;
  return out;
}

// Not a player's view: it ranks homes with the end-of-season state's fake flags and prices, which no player sees, and
// settles its fights by hand, without the owner's backers, TEMP, city cops or tips (fights.mjs); each pushes it up.
// A sharp crew of four, with no gear (strength 4): from night 2 (night 1 has no cash anywhere), it strikes when one more
// star keeps every member below wanted (a crime is a star a member, a quiet night takes one off), so about every other
// night, and hustles on the rest. Its job: the break-in on the home its view rates highest, among owners the show
// saw out last night or that the board shows jailed: the cash on the owner's latest public record (and a crew stash it
// keeps) at breakinShare. The night as played then decides, by the cash really there at the lock: the defence is the
// lock, an owner who stayed home with its group and laying low, the patrols in Pleasantview; a real attack on the same
// home makes it a fight it counts as lost. A lost fight with a cop in it jails all four.
function sharpCrew(W, log, ids, crewIds) {
  const out = { strikes: 0, won: 0, take: 0, pieces: 0, lost: 0, arrests: 0, shifts: 0, hustlePay: 0 };
  let heat = 0;
  let jail = 0;
  const share = x => Math.floor(x * N.breakinShare);
  const worth = (S, k) => S.traits[S.copies[k].trait].last || S.traits[S.copies[k].trait].price;
  for (let n = 1; n < N.nights; n++) {
    const L = W.lock[n];
    const night = W.night[n];
    const wage = nightTake(log, n) ?? loneTake();
    if (n === 1) {
      out.shifts += 1;
      out.hustlePay += wage;
      continue;
    }
    if (jail > 0) {
      jail -= 1;
      continue;
    }
    if (heat + 1 >= N.wantedAt) {
      heat = Math.max(0, heat - 1);
      out.shifts += 1;
      out.hustlePay += wage;
      continue;
    }
    const seen = lastSeen(log, n);
    const record = id => log.filter(e => e.type === 'holdings' && e.agent === id && e.t <= 2 * n - 2).slice(-1)[0] || null;
    const options = ids.filter(id => !crewIds.includes(id) && !L.agents[id].evicted && (L.agents[id].jail || (seen[id] && seen[id] !== 'home'))).map(id => {
      const r = record(id);
      const top = r ? Math.max(0, ...[...r.pieces, ...(r.crew ? r.crew.pieces : [])].filter(q => W.state.copies[q.copy] && !W.state.copies[q.copy].fake).map(q => worth(W.state, q.copy))) : 0;
      return { id, view: r ? share(r.cash) + (r.crew ? share(r.crew.cash) : 0) + top : 0 };
    }).filter(o => o.view > 0).sort((x, y) => y.view - x.view || (x.id < y.id ? -1 : 1));
    const best = options[0];
    if (!best) {
      heat = Math.max(0, heat - 1);
      out.shifts += 1;
      out.hustlePay += wage;
      continue;
    }
    out.strikes += 1;
    heat += 1;
    const owner = best.id;
    const home = W.night[n].where[owner] === 'home';
    const p = night.plays[owner] || {};
    const gun = id => ((L.agents[id].goods.guns || 0) > 0 ? 1 : 0);
    const patrols = Object.entries(night.plays).filter(([, x]) => x.kind === 'patrol' && x.place === 'suburbs').map(([id]) => id);
    const defence = 1 + (home ? 1 + gun(owner) + (p.kind === 'laylow' ? 1 : 0) : 0) + sum(patrols.map(id => 1 + gun(id)));
    const rival = night.fights.some(f => f.kind === 'breakin' && f.target === owner);
    if (4 > defence && !rival) {
      out.won += 1;
      const keeper = Object.values(L.crews).find(c => c.keeper === owner);
      out.take += share(L.agents[owner].cash) + (keeper ? share(keeper.cash) : 0);
      out.pieces += L.agents[owner].inside;
    } else {
      out.lost += 1;
      if (patrols.length) {
        out.arrests += 1;
        jail = N.jailNights;
        heat = 0;
      }
    }
  }
  return out;
}

// --- one season ---------------------------------------------------------------------------------------------------------
function season({ seed, rule, outDir, overrides, mix, cast }) {
  const W = watcher(cast, seed);
  const r = runSeason({ seed, rule, outDir, overrides, mix, observe: W.observe });
  // The analysis reads N as the season played it (the --set overrides).
  return withOverrides(overrides, () => analyse(W, r, cast, seed, rule));
}

function analyse(W, r, cast, seed, rule) {
  const log = W.log;
  const S = W.state;
  const ids = Object.keys(S.agents).sort();
  const typeOf = Object.fromEntries(cast.map(c => [c.id, c.type]));
  const tradeOf = Object.fromEntries(cast.map(c => [c.id, c.trade]));
  const worthOf = k => (S.copies[k] && !S.copies[k].fake ? S.traits[S.copies[k].trait].last || S.traits[S.copies[k].trait].price : 0);
  const kits = Object.fromEntries(cast.map(c => [c.id, N.kits[c.trade] || {}]));
  const B = books(W, ids);
  const G = goodsBooks(log, ids, kits);
  const nights = seatNights(W, log, ids, typeOf, tradeOf);
  const metrics = r.metrics;
  const seats = Object.fromEntries(cast.map(c => [c.id, {
    type: c.type, trade: c.trade, works: !!c.works, role: c.role || null, snake: !!c.snake, habit: c.habit || null, sudo: !!c.sudo,
    haul: metrics.haul[c.id], hauls: Object.fromEntries(SHADOWS.map(v => [v, metrics.hauls[v][c.id]])), books: B[c.id], goods: G[c.id], nights: nights[c.id],
  }]));
  const bars = metrics.bars;
  return {
    seed, rule, metrics, seats,
    supply: supplyChain(W, log, typeOf, tradeOf),
    crews: crewsOf(W, log, cast, typeOf, worthOf),
    night1: nightOne(W, log, ids, typeOf),
    blind: W.blind,
    money: {
      haul: bars.money ? { outEarn: bars.money.outEarn, hustleHaul: bars.money.hustleHaul, chems: bars.money.chems, spread: bars.money.spread, trades: bars.money.trades, pass: bars.money.pass } : null,
      // R4-1: the money bar by haul under each shadow valuation.
      shadow: Object.fromEntries(SHADOWS.map(v => {
        const mb = metrics.shadow[v].money;
        return [v, mb ? { outEarn: mb.outEarn, hustleHaul: mb.hustleHaul, pass: mb.pass } : null];
      })),
      // R4-11: the first clause by income, the money bar's shadow; its second clause is `haul.chems` (one bar, computed once).
      byIncome: bars.money ? bars.money.byIncome : null, gap: bars.moneyGap || null, share: bars.moneyShare || null,
    },
    showWorthy: bars.showWorthy,
    wage: median(log.filter(e => e.type === 'hustle').map(e => e.take)),
    sharp: {
      dealer: sharpDealer(W, log, tradeOf),
      crew: sharpCrew(W, log, ids, cast.filter(c => c.type === 'crew' && c.crewName === 'crew 1').map(c => c.id)),
    },
  };
}

// --- across seasons -----------------------------------------------------------------------------------------------------
// Every seat of a kind, across seasons, as { s, id, seat }.
const seatsOf = (seasons, kind) => seasons.flatMap(s => Object.entries(s.seats).filter(([, x]) => x.type === kind).map(([id, seat]) => ({ s, id, seat })));
const statOf = xs => ({ mean: mean(xs), median: median(xs), n: xs.length });
// R4-1: the haul's shadows for some seats, each a stat as `haul` is.
const haulShadows = rows => Object.fromEntries(SHADOWS.map(v => [v, statOf(rows.map(x => x.seat.hauls[v]))]));
// A count of seasons with its distinct seasons (passbars.mjs's seasonCount).
const countOf = (seasons, pass) => seasonCount(seasons.map(s => ({ seed: s.seed, seasonKey: s.metrics.seasonKey, s })), x => !!pass(x.s));

// Each kind's books: every flow's mean and median a seat a season, its haul, and the groups the report prints.
const GROUPS = [
  ['its trade: the street', ['street']],
  ['its trade: goods sold to agents', ['sold:chems', 'sold:parts', 'sold:doses', 'sold:guns', 'sold:warrants', 'sold:piece', 'sold:other']],
  ["its trade: the city's buyer", ['buyer:chems', 'buyer:parts', 'buyer:doses']],
  ['its trade: patrols, guards, collars', ['police', 'collar']],
  ['hustles', ['hustle']],
  ['flex', ['flex']],
  ['crime: thefts, grabs, the vault, bounties', ['thefts', 'grabs', 'vault', 'bounty']],
  ['the crew: stash takes, cuts', ['stashTake', 'cuts']],
  ['other in: fence sales, muscle, gifts, list refunds', ['fence', 'muscle', 'gifts', 'refund']],
  ['goods for the trade (from agents)', ['bought:chems', 'bought:parts', 'bought:doses']],
  ["goods for the trade (the city's shop)", ['shop:chems', 'shop:parts']],
  ['gear: guns, warrants, fakes bought', ['bought:guns', 'bought:warrants', 'bought:piece', 'bought:other', 'shop:guns']],
  ['compute (and the tab at the dock)', ['rent', 'tab']],
  ['the list (offers, net of refunds)', ['list']],
  ['fines, bail, bribes', ['fine', 'bail', 'bribe']],
  ['robbed of (own cash) and held up', ['robbed', 'heldUp']],
  ['the crew: stash puts, cuts paid', ['stashPut', 'cutsPaid']],
  ['other out: fence buys, lookouts, bounties, muscle, gifts', ['fenceBuy', 'lookout', 'bountyPost', 'musclePaid', 'giftsOut']],
];
const IN_GROUPS = GROUPS.slice(0, 9).map(g => g[0]);
function kindBooks(seasons, kind) {
  const rows = seatsOf(seasons, kind);
  if (!rows.length) return null;
  const flows = Object.fromEntries([...IN, ...OUT, 'rest', 'end', 'missed', 'unpaid'].map(k => [k, statOf(rows.map(x => x.seat.books[k]))]));
  const groups = Object.fromEntries(GROUPS.map(([label, keys]) => {
    const vals = rows.map(x => sum(keys.map(k => x.seat.books[k])) - (label.startsWith('the list') ? x.seat.books.refund : 0));
    return [label, statOf(vals)];
  }));
  // A list refund is netted into the list, so it's dropped from "other in".
  const other = rows.map(x => x.seat.books.fence + x.seat.books.muscle + x.seat.books.gifts);
  groups['other in: fence sales, muscle, gifts, list refunds'] = statOf(other);
  const tradeIncome = rows.map(x => tradeIncomeOf(x.seat));
  return {
    seats: rows.length / seasons.length, flows, groups, haul: statOf(rows.map(x => x.seat.haul)), hauls: haulShadows(rows),
    tradeIncome: statOf(tradeIncome), income: statOf(rows.map(x => tradeIncomeOf(x.seat) + x.seat.books.hustle + x.seat.books.flex)),
    arrests: mean(rows.map(x => x.seat.nights.filter(n => n.arrested).length)),
  };
}
// A seat's trade income: what its trade's work brought in (the street, its goods sold to agents and to the city's
// buyer, a Cop's wages and collars) less what its trade's goods cost (from agents and the city's shop). Guns, warrants
// and pieces a seat buys are gear; hustles and flex are apart.
function tradeIncomeOf(seat) {
  const b = seat.books;
  return b.street + b['sold:chems'] + b['sold:parts'] + b['sold:doses'] + b['sold:guns'] + b['sold:warrants'] + b['sold:piece'] + b['buyer:chems'] + b['buyer:parts'] + b['buyer:doses']
    + b.police + b.collar - b['bought:chems'] - b['bought:parts'] - b['bought:doses'] - b['shop:chems'] - b['shop:parts'];
}

// Each kind's nights: how they were spent, what a night of its trade made, what it cost, and why it didn't work.
function kindNights(seasons, kind) {
  const rows = seatsOf(seasons, kind);
  if (!rows.length) return null;
  const all = rows.flatMap(x => x.seat.nights.map(n => ({ ...n, seat: x.seat })));
  const free = all.filter(n => n.cat !== 'jail' && n.cat !== 'board');
  const cats = {};
  for (const n of all) cats[n.cat] = (cats[n.cat] || 0) + 1;
  const trade = all.filter(n => n.cat === 'trade' && (TRADE_WORK[kind] || ALL_WORK).includes(n.kind));
  // Trade income a night of trade work, seat by seat (the season's trade income over its trade nights).
  const perNight = rows.map(x => {
    const t = x.seat.nights.filter(n => n.cat === 'trade').length;
    return t ? tradeIncomeOf(x.seat) / t : null;
  }).filter(x => x != null);
  const wageOn = trade.map(n => n.wage).filter(Boolean);
  // The reasons for nights a trade bot didn't work its trade (its free nights).
  const why = {};
  for (const n of free.filter(x => x.cat !== 'trade' || !(TRADE_WORK[x.seat.trade] || []).includes(x.kind))) {
    const k = n.limit || `${n.kind}: ${n.reason || '(no reason)'}`;
    why[k] = (why[k] || 0) + 1;
  }
  return {
    seats: rows.length, nights: all.length, free: free.length, cats, why: Object.fromEntries(Object.entries(why).sort((x, y) => y[1] - x[1])),
    trade: {
      n: trade.length, perSeat: trade.length / rows.length, incomePerNight: statOf(perNight), wage: mean(wageOn),
      arrested: share(trade.filter(n => n.arrested).length, trade.length), arrestedSoon: share(trade.filter(n => n.arrestedSoon).length, trade.length),
      robbed: share(trade.filter(n => n.robbed).length, trade.length), robbedCash: sum(trade.filter(n => n.robbed).map(n => n.robbed.cash)), robbedGoods: sum(trade.filter(n => n.robbed).map(n => n.robbed.goods)),
      cornerFights: trade.filter(n => n.cornerFight).length, cornerLost: trade.filter(n => n.cornerFight && !n.cornerFight.won).length,
      cornerTies: trade.filter(n => n.cornerFight && n.cornerFight.tie).length, cornerArrests: trade.filter(n => n.cornerFight && n.cornerFight.arrested).length,
    },
    product: productOf(kind, trade),
  };
}
// What a night of each trade's work made, from its own record.
function productOf(kind, trade) {
  if (kind === 'smuggler') {
    const runs = trade.filter(n => n.kind === 'run');
    return { runs: runs.length, units: mean(runs.map(n => n.units || 0)), alone: share(runs.filter(n => n.atDrop === 1).length, runs.length), atDrop: mean(runs.map(n => n.atDrop || 0)), full: share(runs.filter(n => (n.units || 0) >= N.dropUnits).length, runs.length) };
  }
  if (kind === 'chemist') {
    const cooks = trade.filter(n => n.kind === 'cook');
    return { cooks: cooks.length, made: share(cooks.filter(n => n.batches).length, cooks.length), batches: mean(cooks.map(n => n.batches || 0)), doses: mean(cooks.map(n => n.doses || 0)), lab: share(cooks.filter(n => n.lab).length, cooks.length), named: share(cooks.filter(n => n.drug && n.drug !== 'temp').length, cooks.length), twoBatches: share(cooks.filter(n => n.batches === 2).length, cooks.length) };
  }
  if (kind === 'dealer') {
    const deals = trade.filter(n => n.kind === 'deal');
    const sold = deals.filter(n => n.sold);
    return {
      deals: deals.length, sold: share(sold.length, deals.length), doses: mean(sold.map(n => n.sold)), takings: mean(sold.map(n => n.takings)), hot: share(sold.filter(n => n.hot).length, sold.length),
      full: share(sold.filter(n => n.sold >= N.deal.cap).length, sold.length), short: share(deals.filter(n => (n.carried || 0) < N.deal.cap).length, deals.length), carried: mean(deals.map(n => n.carried || 0)),
      perDose: share(sum(sold.map(n => n.takings)), sum(sold.map(n => n.sold))),
    };
  }
  if (kind === 'gunrunner') {
    const builds = trade.filter(n => n.kind === 'build');
    return { builds: builds.length, guns: mean(builds.map(n => n.guns || 0)), warrants: sum(builds.map(n => n.warrants || 0)), fakes: sum(builds.map(n => n.fakes || 0)) };
  }
  if (kind === 'cop') {
    return { patrols: trade.filter(n => n.kind === 'patrol').length, guards: trade.filter(n => n.kind === 'guard').length, collars: trade.filter(n => n.kind === 'collar').length, collarPay: sum(trade.map(n => n.collar || 0)), wage: mean(trade.filter(n => n.police).map(n => n.police)) };
  }
  return {};
}

// The goods a kind of seat handled, in units a seat a season: in by source and out by sink, for each kind of goods.
function kindGoods(seasons, kind) {
  const rows = seatsOf(seasons, kind);
  if (!rows.length) return null;
  const out = {};
  for (const x of rows) {
    for (const [g, row] of Object.entries(x.seat.goods || {})) {
      const o = (out[g] ||= { in: {}, out: {}, rest: 0 });
      for (const [k, u] of Object.entries(row.in)) o.in[k] = (o.in[k] || 0) + u / rows.length;
      for (const [k, u] of Object.entries(row.out)) o.out[k] = (o.out[k] || 0) + u / rows.length;
      o.rest += row.rest;
    }
  }
  return out;
}

// The mean, across seasons, of every number in a tree of objects.
function meanTree(objs) {
  const out = {};
  for (const k of Object.keys(objs[0])) {
    const vs = objs.map(o => o[k]);
    out[k] = typeof vs[0] === 'number' ? mean(vs) : vs[0] && typeof vs[0] === 'object' ? meanTree(vs.map(v => v || {})) : vs[0];
  }
  return out;
}

// The goods chain by trade (every seat that works the trade, its own bot and the seats whose strategy works it), a
// season's mean: what each step made, sold to agents, dumped at the city's buyer, lost or left, and the cash for it.
function chainSummary(seasons) {
  const per = seasons.map(s => {
    const seats = Object.values(s.seats);
    const of = t => seats.filter(x => x.trade === t);
    const g = (xs, kind, side, k) => sum(xs.map(x => ((((x.goods || {})[kind] || {})[side] || {})[k]) || 0));
    const b = (xs, k) => sum(xs.map(x => x.books[k]));
    const lot = (xs, kind, own, cashKey) => ({
      made: sum(G_IN.map(src => g(xs, kind, 'in', src))), own: sum(own.map(src => g(xs, kind, 'in', src))), sold: g(xs, kind, 'out', 'given'), buyer: g(xs, kind, 'out', 'buyer'), dealt: g(xs, kind, 'out', 'dealt'),
      used: g(xs, kind, 'out', 'cooked') + g(xs, kind, 'out', 'built'), taken: g(xs, kind, 'out', 'taken'), robbed: g(xs, kind, 'out', 'robbed'), gone: g(xs, kind, 'out', 'gone'),
      stash: g(xs, kind, 'out', 'stashPut'), cash: cashKey ? b(xs, cashKey) : 0, buyerCash: b(xs, `buyer:${kind}`),
    });
    const [sm, ch, dl, gr] = ['smuggler', 'chemist', 'dealer', 'gunrunner'].map(of);
    return {
      smuggler: { seats: sm.length, chems: lot(sm, 'chems', ['drop'], 'sold:chems'), parts: lot(sm, 'parts', ['drop'], 'sold:parts') },
      chemist: {
        seats: ch.length,
        chemsIn: { got: g(ch, 'chems', 'in', 'got'), shop: g(ch, 'chems', 'in', 'shop'), kit: g(ch, 'chems', 'in', 'kit'), other: g(ch, 'chems', 'in', 'stolen') + g(ch, 'chems', 'in', 'grab') + g(ch, 'chems', 'in', 'drop') + g(ch, 'chems', 'in', 'stashTake') },
        chemsPaid: b(ch, 'bought:chems'), shopPaid: b(ch, 'shop:chems'), chemsUsed: g(ch, 'chems', 'out', 'cooked'), chemsDumped: g(ch, 'chems', 'out', 'buyer'), chemsGone: g(ch, 'chems', 'out', 'gone'),
        doses: lot(ch, 'doses', ['cook'], 'sold:doses'),
      },
      dealer: {
        seats: dl.length, got: g(dl, 'doses', 'in', 'got'), kit: g(dl, 'doses', 'in', 'kit'), other: g(dl, 'doses', 'in', 'grab') + g(dl, 'doses', 'in', 'stolen') + g(dl, 'doses', 'in', 'cook') + g(dl, 'doses', 'in', 'stashTake'),
        doses: lot(dl, 'doses', [], null), paid: b(dl, 'bought:doses'), street: b(dl, 'street'),
      },
      gunrunner: {
        seats: gr.length, partsGot: g(gr, 'parts', 'in', 'got'), partsKit: g(gr, 'parts', 'in', 'kit'), partsPaid: b(gr, 'bought:parts'), partsUsed: g(gr, 'parts', 'out', 'built'), partsDumped: g(gr, 'parts', 'out', 'buyer'),
        guns: lot(gr, 'guns', ['build'], 'sold:guns'), warrants: lot(gr, 'warrants', ['build'], 'sold:warrants'), pieceCash: b(gr, 'sold:piece'),
      },
      street: s.supply.street,
    };
  });
  return meanTree(per);
}

// The bot habits R3-5 names (TRADES.md), each counted where it decides: the nights, runs, cooks or jobs it shaped, out of
// those it could have. `where` is the decision point in bots.mjs at the lane's base (a0f5dad).
function habitCounts(seasons) {
  const nightsOf = pred => seasons.flatMap(s => Object.values(s.seats).flatMap(x => x.nights.map(n => ({ ...n, type: x.type, trade: x.trade, works: x.works, role: x.role }))).filter(pred));
  const free = n => n.cat !== 'jail' && n.cat !== 'board' && n.n < N.nights;
  const per = x => x / seasons.length;
  const out = [];
  const crewFree = nightsOf(n => n.type === 'crew' && free(n));
  const offBeat = crewFree.filter(n => !jobDay(n.n));
  out.push({ key: 'crew-rhythm', where: 'bots.mjs:3168 (jobDay), 3267 (crewNight)', label: "a crew acts only on nights 2, 5, 8 and 11; its members' other free nights go to their trade or a hustle", count: per(offBeat.length), of: per(crewFree.length), unit: 'crew-member nights a season' });
  const jobs = seasons.flatMap(s => s.crews.jobs);
  const crimeJobs = jobs.filter(j => CRIMES.includes(j.kind));
  const grabJobs = crimeJobs.filter(j => j.kind === 'grab');
  const grabFights = seasons.flatMap(s => s.crews.grabs);
  out.push({ key: 'crate-night', where: 'bots.mjs:3168 (jobDay) with numbers.mjs shipments', label: "both crews' job nights are the shipment nights, so both go for the one crate, where the Cops patrol (bots.mjs:1080)", count: per(grabJobs.filter(j => j.rivals > 0).length), of: per(grabJobs.length), unit: 'crew grabs a season with a rival group in the fight', extra: `of the ${per(sum(grabFights.map(g => g.arrested))).toFixed(1)} agents arrested in grab fights a season, ${per(sum(grabFights.filter(g => g.groups > 1 && g.patrol).map(g => g.arrested))).toFixed(1)} were in fights with two groups and a patrol` });
  out.push({ key: 'grab-patrol', where: 'bots.mjs:3297-3299 (crewJob)', label: 'a crew grabs into a patrol: its reckoning counts only the leader\'s gun and a patrol once seen (grabDefence, bots.mjs:1218), never a rival crew', count: per(grabJobs.filter(j => j.patrol).length), of: per(grabJobs.length), unit: 'crew grabs a season with a patrol in the fight', extra: `${per(sum(grabJobs.map(j => j.arrestedCrew))).toFixed(1)} crew members arrested in grabs a season` });
  out.push({ key: 'crew-blind', where: 'bots.mjs:3293 (crewJob: robberPlay with no floor, so no carefulOnly)', label: "a crew's leader reads no defence before its job (the crime cast's robbers do)", count: per(crimeJobs.filter(j => j.arrestedCrew > 0).length), of: per(crimeJobs.length), unit: 'crew jobs a season that ended in crew arrests' });
  const runs = nightsOf(n => n.kind === 'run');
  // With k runs a night at the drops, the runs an even spread still puts at a shared drop: no spreading avoids those.
  let mustShare = 0;
  for (const s of seasons) {
    const k = {};
    for (const x of Object.values(s.seats)) for (const n of x.nights) if (n.kind === 'run') k[n.n] = (k[n.n] || 0) + 1;
    const drops = Object.keys(N.drops).length;
    for (const runsTonight of Object.values(k)) {
      const sizes = Array.from({ length: drops }, (_, i) => Math.floor(runsTonight / drops) + (i < runsTonight % drops ? 1 : 0));
      mustShare += sum(sizes.filter(z => z > 1));
    }
  }
  const chain = chainSummary(seasons);
  out.push({ key: 'drop-crowd', where: 'bots.mjs:805-811 (tradeWork, the Smuggler)', label: "a Smuggler picks its drop from its own last haul there and a seeded shuffle, never from the show's sightings of the other Smugglers", count: per(runs.filter(n => n.atDrop > 1).length), of: per(runs.length), unit: 'runs a season at a shared drop', extra: `${num(mean(runs.filter(n => n.atDrop > 1).map(n => n.units)))} units a shared run against ${num(mean(runs.filter(n => n.atDrop === 1).map(n => n.units)))} alone; an even spread of the night's runs over the ${Object.keys(N.drops).length} drops still shares ${pct(share(mustShare, runs.length))} of runs, so ${Math.round(100 * share(runs.filter(n => n.atDrop > 1).length - mustShare, runs.length))} points were avoidable, and spreading would add units the buyers don't take` });
  const smugglerNights = nightsOf(n => n.type === 'smuggler' && free(n));
  out.push({ key: 'smuggler-always-runs', where: 'bots.mjs:805 (tradeWork: the Smuggler always runs), 98 (upkeep: home only at $40)', label: 'a Smuggler runs every night and takes no hustle, whatever its last haul fetched: it brings in about twice what agents buy, and from night 1 it has no cash for compute, so it is evicted', count: per(smugglerNights.filter(n => n.evicted).length), of: per(smugglerNights.length), unit: 'Smuggler-bot nights a season evicted at the lock', extra: `every seat that works the trade brought in ${num(chain.smuggler.chems.made + chain.smuggler.parts.made)} units a season and sold agents ${num(chain.smuggler.chems.sold + chain.smuggler.parts.sold)}` });
  const lastDayOf = (trade, goods) => sum(seasons.map(s => (s.supply.city[`buyer|${goods}|${trade}`] || {}).lastDay || 0)) / seasons.length;
  out.push({ key: 'dump-goods', where: 'bots.mjs:728 (cityTrades: STREET.slow, 2 days), 723 (the last day: everything)', label: "goods no agent took in two days go to the city's buyer, whose price every unit sold lowers 10%; on the last day everything goes", count: chain.smuggler.chems.buyer + chain.smuggler.parts.buyer + chain.chemist.doses.buyer, of: chain.smuggler.chems.made + chain.smuggler.parts.made + chain.chemist.doses.made, unit: "units a season the Smugglers and Chemists sold the city's buyer, of those they made", extra: `for ${money(chain.smuggler.chems.buyerCash + chain.smuggler.parts.buyerCash + chain.chemist.doses.buyerCash)}; on the last day ${num(lastDayOf('smuggler', 'chems'))} of the ${num(chain.smuggler.chems.buyer)} chems, ${num(lastDayOf('smuggler', 'parts'))} of the ${num(chain.smuggler.parts.buyer)} parts and ${num(lastDayOf('chemist', 'doses'))} of the ${num(chain.chemist.doses.buyer)} doses` });
  const traded = seasons.flatMap(s => Object.entries(s.supply.flows).filter(([k]) => ['chems', 'parts', 'doses'].includes(k.split('|')[1])).map(([, f]) => f));
  out.push({ key: 'one-price', where: 'bots.mjs:526 (STREET.unit), 658 (orderGoods: the offer), 2006 (buyDrugs: DOSES.price)', label: "every good between agents changes hands at $15 a unit, whatever the street pays a Dealer or the city's shop asks a Chemist", count: per(sum(traded.map(f => f.units))), of: null, unit: 'units a season handed over at $15', extra: `paid ${money(per(sum(traded.map(f => f.paid))))}` });
  const rentShift = nightsOf(n => n.limit === 'cash up front: short of compute');
  const dryTwo = nightsOf(n => n.trade === 'dealer' && n.n === 2 && n.limit === 'supply: no doses');
  out.push({ key: 'rent-first', where: 'bots.mjs:1515 (shortOfRent), 791 (streetPlan)', label: "a cook or a build gives way to a hustle when the seat's cash won't cover tonight's compute", count: per(rentShift.length), of: null, unit: 'nights a season', extra: `${per(rentShift.filter(n => n.n === 1).length).toFixed(1)} of them on night 1, when every seat has $0; so no doses are cooked that night, and on night 2 ${per(dryTwo.length).toFixed(1)} Dealer-trade seats a season have none to deal` });
  const deals = nightsOf(n => n.kind === 'deal' && n.trade === 'dealer');
  const noDoses = nightsOf(n => n.trade === 'dealer' && n.limit === 'supply: no doses');
  const noChems = nightsOf(n => n.trade === 'chemist' && n.limit === 'supply: under 2 chems');
  const noParts = nightsOf(n => n.trade === 'gunrunner' && n.limit === 'supply: under 2 parts');
  const canPay = n => n.cash >= N.deal.held * STREET.unit + N.rent;
  out.push({ key: 'buyer-waits', where: 'bots.mjs:652 (orderGoods: a buyer orders only in a sit-down a seller asked for), 706 (askBuyers: a seller asks a few buyers at random)', label: 'a buyer never asks a seller: a Dealer waits for a Chemist to ask it, a Chemist for a Smuggler, a Gunrunner for a Smuggler', count: per(noDoses.length + noChems.length + noParts.length), of: null, unit: 'hustles a season for want of goods', extra: `Dealers ${per(noDoses.length).toFixed(1)} (the Chemists holding ≥${N.deal.cap} doses at that lock on ${pct(share(noDoses.filter(n => n.stock.doses >= N.deal.cap).length, noDoses.length))}, and the Dealer holding the cash for ${N.deal.held} doses and compute on ${pct(share(noDoses.filter(canPay).length, noDoses.length))}), Chemists ${per(noChems.length).toFixed(1)} (Smugglers holding ≥${2 * N.cook.chems} chems on ${pct(share(noChems.filter(n => n.stock.chems >= 2 * N.cook.chems).length, noChems.length))}, and the Chemist holding the cash for ${2 * N.cook.chems} chems and compute on ${pct(share(noChems.filter(n => n.cash >= 2 * N.cook.chems * STREET.unit + N.rent).length, noChems.length))}), Gunrunners ${per(noParts.length).toFixed(1)} (Smugglers holding ≥${N.build.guns} parts on ${pct(share(noParts.filter(n => n.stock.parts >= N.build.guns).length, noParts.length))})` });
  out.push({ key: 'dealer-short', where: 'bots.mjs:540 (onHand: 7 doses), 652 (orderGoods)', label: 'a Dealer reaches its corner with fewer doses than it could sell', count: per(deals.filter(n => (n.carried || 0) < N.deal.cap).length), of: per(deals.length), unit: 'corner nights a season under 6 doses', extra: `the Chemists holding ≥${N.deal.cap} doses at that lock on ${pct(share(deals.filter(n => (n.carried || 0) < N.deal.cap && n.stock.doses >= N.deal.cap).length, deals.filter(n => (n.carried || 0) < N.deal.cap).length))}` });
  const oneGun = nightsOf(n => n.trade === 'gunrunner' && n.limit === 'demand: its one gun unsold');
  out.push({ key: 'one-gun', where: 'bots.mjs:1499 (HABITS.unsold), 925 (gunTarget), 831 (tradeWork)', label: 'a Gunrunner builds no gun while one is unsold, and hustles', count: per(oneGun.length), of: per(nightsOf(n => n.trade === 'gunrunner' && free(n)).length), unit: 'Gunrunner-trade nights a season' });
  const cooks = nightsOf(n => n.kind === 'cook' && n.batches);
  out.push({ key: 'one-batch', where: 'bots.mjs:817 (tradeWork: a named drug is one batch)', label: 'a cook of a named drug is one batch, though it holds the chems for two', count: per(cooks.filter(n => n.drug !== 'temp' && n.batches === 1 && n.held.chems >= 2 * N.cook.chems).length), of: per(cooks.length), unit: 'cooks a season' });
  const wanted = nightsOf(n => n.trade === 'dealer' && (n.limit === 'heat: wanted, lies low' || n.limit === 'heat: no bail reserve before the ferry'));
  const collared = nightsOf(n => n.trade === 'dealer' && n.kind === 'laylow' && n.arrested);
  out.push({ key: 'dealer-heat', where: 'bots.mjs:1722 and 1573 (cornerFor, cornerByOrder: a hot corner at up to 3 stars), 779 (streetPlan: wanted, it lies low)', label: 'a Dealer works a hot corner (+1 star a night) at up to 3 stars, so it turns wanted, then lies low at home, where the Cops collar it', count: per(wanted.length), of: per(nightsOf(n => n.trade === 'dealer' && free(n)).length), unit: 'Dealer-trade nights a season', extra: `${per(collared.length).toFixed(2)} Dealer-trade arrests a season come while it lies low at home (the Cops' collar)` });
  const robberNights = nightsOf(n => ['scout', 'guess'].includes(n.type) && free(n));
  const lockpicks = sum(seasons.map(s => (s.supply.goods.in.build || {}).lockpicks || 0));
  out.push({ key: 'no-lockpick', where: 'bots.mjs:834 (tradeWork: builds guns, lockpicks 0), 954 (gunErrands: a gun, never a lockpick)', label: 'no bot builds, sells or buys a lockpick, the one gear that is used up (so bought again) and lets a lone unarmed robber into an empty home (2 against its lock\'s 1)', count: per(lockpicks), of: null, unit: 'lockpicks built a season', extra: `the robbers' free nights with no gun: ${per(robberNights.filter(n => !n.held.guns).length).toFixed(1)} a season` });
  const won = jobs.filter(j => j.won && CRIMES.includes(j.kind));
  out.push({ key: 'cut', where: 'bots.mjs:27 (CUT), 3184-3199 (crewDay: the leader pays it for a won hit, break-in or grab, never a vault job, or walks)', label: "a crew member's cut of a won job is $20, whatever the job took; the bag stays with the leader", count: CUT_BOT, of: null, unit: 'dollars a member a won job', extra: `a won job took ${money(mean(won.map(j => j.value)))} for ${num(mean(won.map(j => j.crewIn)))} crew members in it` });
  const members = seasons.flatMap(s => Object.values(s.seats).filter(x => x.type === 'crew' && x.role !== 'leader'));
  out.push({ key: 'crew-stash', where: 'bots.mjs:3218-3220 (crewDay: cash above the keep goes in the stash), 3230 (the leader buys with it)', label: "a member puts all its cash above $60 (and a gun and a night's goods) in the crew stash; the leader buys pieces with it, and the pieces go aboard with the keeper", count: mean(members.map(x => x.books.stashPut)), of: null, unit: 'dollars a member a season put in', extra: `${money(mean(members.map(x => x.books.stashTake)))} a member taken back out` });
  return out;
}

// What each trade could make, a season: the two night-by-night estimates (sharpDealer, sharpCrew), and for the
// Smuggler, the Chemist and the Gunrunner a fair-share bound, read off no view: an even share of the demand the season
// measured, sold at the agents' $15 (guns at what they fetched), worked alone at a drop, two batches a cook, on just
// the nights that demand takes, and a hustle on every other night. "Supplied" adds the doses the Dealers would have dealt on their nights
// without any (at the doses a selling corner night dealt) and the chems those doses take. A season has N.nights - 1
// working nights (the last is the walk to the ferry).
function sharpSummary(seasons, chain, B, Nn) {
  const nights = N.nights - 1;
  const wage = median(seasons.map(s => s.wage));
  const dealers = Nn.dealer;
  const dry = dealers ? (dealers.why['supply: no doses'] || 0) / seasons.length : 0;
  const dealtPerNight = dealers ? dealers.product.doses : 0;
  // The dose-starved nights of every seat that works the Dealer trade, not only the Dealer bots.
  const dryAll = mean(seasons.map(s => sum(Object.values(s.seats).filter(x => x.trade === 'dealer').map(x => x.nights.filter(n => n.limit === 'supply: no doses').length))));
  const extraDoses = dryAll * dealtPerNight;
  const perSeat = (total, seats) => (seats ? total / seats : 0);
  const trade = (units, perNight, margin, seats) => {
    const u = perSeat(units, seats);
    const worked = Math.min(nights, u / perNight);
    return { units: u, nights: worked, trade: u * margin, shifts: (nights - worked) * wage, income: u * margin + (nights - worked) * wage };
  };
  const sm = chain.smuggler.seats;
  const chemsWanted = chain.chemist.chemsIn.got + chain.chemist.chemsIn.shop;
  const partsWanted = chain.gunrunner.partsGot;
  const doseCost = (N.cook.chems / N.cook.doses) * STREET.unit;
  const dosesWanted = chain.chemist.doses.sold;
  const gunPrice = share(chain.gunrunner.guns.cash, chain.gunrunner.guns.sold) || 0;
  return {
    wage, hustleIncome: B.hustle ? B.hustle.income.median : null,
    dealer: { ...meanTree(seasons.map(s => s.sharp.dealer)), median: median(seasons.map(s => s.sharp.dealer.net)) },
    crew: {
      ...meanTree(seasons.map(s => s.sharp.crew)),
      member: median(seasons.map(s => (s.sharp.crew.take + s.sharp.crew.pieces) / 4 + s.sharp.crew.hustlePay)),
      memberCash: median(seasons.map(s => s.sharp.crew.take / 4 + s.sharp.crew.hustlePay)),
      memberTake: median(seasons.map(s => (s.sharp.crew.take + s.sharp.crew.pieces) / 4)),
    },
    smuggler: trade(chemsWanted + partsWanted, N.dropUnits, STREET.unit, sm),
    smugglerSupplied: trade(chemsWanted + partsWanted + extraDoses * (N.cook.chems / N.cook.doses), N.dropUnits, STREET.unit, sm),
    chemist: trade(dosesWanted, N.cook.batches * N.cook.doses, STREET.unit - doseCost, chain.chemist.seats),
    chemistSupplied: trade(dosesWanted + extraDoses, N.cook.batches * N.cook.doses, STREET.unit - doseCost, chain.chemist.seats),
    gunrunner: { guns: perSeat(chain.gunrunner.guns.sold, chain.gunrunner.seats), price: gunPrice, trade: perSeat(chain.gunrunner.guns.cash + chain.gunrunner.warrants.cash - chain.gunrunner.partsPaid, chain.gunrunner.seats) },
    inputs: { chemsWanted, partsWanted, dosesWanted, dry, dryAll, dealtPerNight, extraDoses },
  };
}

function summary(seasons) {
  const kinds = KINDS.filter(k => seasons.some(s => Object.values(s.seats).some(x => x.type === k)));
  const B = Object.fromEntries(kinds.map(k => [k, kindBooks(seasons, k)]));
  const Nn = Object.fromEntries(kinds.map(k => [k, kindNights(seasons, k)]));
  const Gd = Object.fromEntries(kinds.map(k => [k, kindGoods(seasons, k)]));
  // Crew roles: the leader, the snake, the other members.
  const crewRole = x => (x.seat.role === 'leader' ? 'leader' : x.seat.snake ? 'snake' : 'member');
  const crewRows = seatsOf(seasons, 'crew');
  const roles = {};
  for (const role of ['leader', 'member', 'snake']) {
    const rows = crewRows.filter(x => crewRole(x) === role);
    roles[role] = {
      n: rows.length, haul: statOf(rows.map(x => x.seat.haul)), hauls: haulShadows(rows),
      flows: Object.fromEntries(['hustle', 'thefts', 'grabs', 'vault', 'stashTake', 'cuts', 'stashPut', 'cutsPaid', 'fine', 'bail', 'list', 'rent', 'tab', 'robbed', 'heldUp', 'end'].map(k => [k, mean(rows.map(x => x.seat.books[k]))])),
      trade: mean(rows.map(x => tradeIncomeOf(x.seat))), arrests: mean(rows.map(x => x.seat.nights.filter(n => n.arrested).length)),
      cats: (() => {
        const c = {};
        for (const x of rows) for (const n of x.seat.nights) c[n.cat] = (c[n.cat] || 0) + 1;
        return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v / rows.length]));
      })(),
    };
  }
  // Crew jobs.
  const jobs = seasons.flatMap(s => s.crews.jobs);
  const jobKinds = {};
  for (const j of jobs) {
    const r = (jobKinds[j.kind] ||= { n: 0, found: 0, won: 0, value: 0, arrested: 0, arrestedCrew: 0, size: 0, crewIn: 0, tipped: 0, patrol: 0, rivals: 0, wage: 0, last: 0 });
    r.n += 1;
    r.found += j.found ? 1 : 0;
    r.won += j.won ? 1 : 0;
    r.value += j.value || 0;
    r.arrested += j.arrested || 0;
    r.arrestedCrew += j.arrestedCrew || 0;
    r.size += j.size || 0;
    r.crewIn += j.crewIn || 0;
    r.tipped += j.tipped ? 1 : 0;
    r.patrol += j.patrol ? 1 : 0;
    r.rivals += j.rivals ? 1 : 0;
    r.wage += j.wage || 0;
    r.last += j.last ? 1 : 0;
  }
  // What an arrest cost a crew member: its fine and bail, and the two nights' wages jail took.
  const crewSeats = seatsOf(seasons, 'crew');
  const crewArrests = sum(crewSeats.map(x => x.seat.nights.filter(n => n.arrested).length));
  const arrestCost = share(sum(crewSeats.map(x => x.seat.books.fine + x.seat.books.bail)), crewArrests) + N.jailNights * median(seasons.map(s => s.wage));
  for (const j of Object.values(jobKinds)) j.net = j.crewIn ? (j.value - j.arrestedCrew * arrestCost) / j.crewIn : null;
  const crewJobs = seasons.flatMap(s => s.crews.jobs);
  const vaultNights = {};
  for (const j of crewJobs.filter(x => x.kind === 'vault')) vaultNights[j.n] = (vaultNights[j.n] || 0) + 1;
  const breakins = crewJobs.filter(j => j.kind === 'breakin');
  const crewBreakins = {
    n: breakins.length, won: breakins.filter(j => j.won).length, rivals: breakins.filter(j => j.rivals).length, rivalsWon: breakins.filter(j => j.rivals && j.won).length,
    tipped: breakins.filter(j => j.tipped).length, tippedWon: breakins.filter(j => j.tipped && j.won).length,
  };
  const allNights = seasons.flatMap(s => Object.values(s.seats).flatMap(x => x.nights));
  const armed = { arrests: allNights.filter(n => n.arrested).length / seasons.length, armedArrests: allNights.filter(n => n.arrested && n.held && n.held.guns).length / seasons.length };
  const grabs = seasons.flatMap(s => s.crews.grabs);
  const grabWhy = {};
  for (const g of grabs) grabWhy[g.why] = (grabWhy[g.why] || 0) + 1;
  const betrayals = {};
  for (const s of seasons) {
    for (const [k, b] of Object.entries(s.crews.betrayals)) {
      const x = (betrayals[k] ||= { n: 0, cash: 0, owed: 0, paid: 0, byType: {} });
      x.n += b.n;
      x.cash += b.cash;
      x.owed += b.owed;
      x.paid += b.paid;
      for (const [t, c] of Object.entries(b.byType)) x.byType[t] = (x.byType[t] || 0) + c;
    }
  }
  const stash = Object.fromEntries(Object.keys(seasons[0].crews.stash).map(k => [k, mean(seasons.map(s => s.crews.stash[k]))]));
  // The supply chain, a season's mean, and every flow's price.
  const flows = {};
  for (const s of seasons) {
    for (const [k, f] of Object.entries(s.supply.flows)) {
      const x = (flows[k] ||= { units: 0, paid: 0, paidUnits: 0, bot: 0 });
      x.units += f.units / seasons.length;
      x.paid += f.paid / seasons.length;
      x.paidUnits += f.paidUnits / seasons.length;
      x.bot += f.bot / seasons.length;
    }
  }
  const city = {};
  for (const s of seasons) {
    for (const [k, f] of Object.entries(s.supply.city)) {
      const x = (city[k] ||= { units: 0, cash: 0, bot: 0, lastDay: 0 });
      x.units += f.units / seasons.length;
      x.cash += f.cash / seasons.length;
      x.bot += f.bot / seasons.length;
      x.lastDay += (f.lastDay || 0) / seasons.length;
    }
  }
  const street = Object.fromEntries(Object.keys(seasons[0].supply.street).map(k => [k, mean(seasons.map(s => s.supply.street[k]))]));
  const goodsIn = {};
  const goodsOut = {};
  for (const s of seasons) {
    for (const [src, g] of Object.entries(s.supply.goods.in)) for (const [k, u] of Object.entries(g)) goodsIn[`${src}|${goodsKind(k)}`] = (goodsIn[`${src}|${goodsKind(k)}`] || 0) + u / seasons.length;
    for (const [snk, g] of Object.entries(s.supply.goods.out)) for (const [k, u] of Object.entries(g)) goodsOut[`${snk}|${goodsKind(k)}`] = (goodsOut[`${snk}|${goodsKind(k)}`] || 0) + u / seasons.length;
  }
  // Night 1.
  const n1 = seasons.map(s => s.night1);
  const n1plays = {};
  for (const x of n1) for (const [t, ks] of Object.entries(x.plays)) for (const [k, c] of Object.entries(ks)) n1plays[`${t}|${k}`] = (n1plays[`${t}|${k}`] || 0) + c / seasons.length;
  const n1reasons = {};
  for (const x of n1) for (const [k, c] of Object.entries(x.reasons)) n1reasons[k] = (n1reasons[k] || 0) + c / seasons.length;
  const n1fights = {};
  for (const x of n1) for (const f of x.fights) n1fights[f] = (n1fights[f] || 0) + 1;
  const quiet1 = seasons.filter(s => s.showWorthy && s.showWorthy.missing.includes(1)).length;
  // The blind corner on night 1.
  const moves = seasons.flatMap(s => (s.blind ? s.blind.moves : []));
  const others = moves.filter(m => !m.mine);
  const taken = others.filter(m => m.taken);
  const free = others.filter(m => !m.taken);
  const draws = seasons.flatMap(s => (s.blind ? s.blind.draws : []));
  const blind = {
    dealers: mean(seasons.map(s => (s.blind ? s.blind.dealers : 0))),
    own: { n: moves.filter(m => m.mine).length, dealt: share(moves.filter(m => m.mine && m.dealt).length, moves.filter(m => m.mine).length), cash: mean(moves.filter(m => m.mine).map(m => m.cash)) },
    any: { n: others.length, dealt: share(others.filter(m => m.dealt).length, others.length), tie: share(others.filter(m => m.tie).length, others.length), arrested: share(others.filter(m => m.arrested).length, others.length), cash: mean(others.map(m => m.cash)) },
    taken: { n: taken.length, tie: share(taken.filter(m => m.tie).length, taken.length), arrested: share(taken.filter(m => m.arrested).length, taken.length), heavy: share(taken.filter(m => m.arrested && m.heavy).length, taken.filter(m => m.arrested).length), patrolled: share(taken.filter(m => m.arrested && m.patrolled).length, taken.filter(m => m.arrested).length) },
    free: { n: free.length, dealt: share(free.filter(m => m.dealt).length, free.length), arrested: share(free.filter(m => m.arrested).length, free.length) },
    uniform: { dealt: share(moves.filter(m => m.dealt).length, moves.length), arrested: share(moves.filter(m => m.arrested).length, moves.length), tie: share(moves.filter(m => m.tie).length, moves.length) },
    draws: {
      n: draws.length, fights: mean(draws.map(d => d.fights)), ties: mean(draws.map(d => d.ties)), arrested: mean(draws.map(d => d.arrested)), dealt: mean(draws.map(d => d.dealt)),
      anyArrest: share(draws.filter(d => d.arrested > 0).length, draws.length), cash: mean(draws.map(d => d.cash)),
    },
    actualCash: mean(seasons.map(s => (s.blind ? s.blind.actualCash : 0))),
    patrols: (() => {
      const c = {};
      for (const s of seasons) for (const p of s.blind ? s.blind.patrols : []) c[p] = (c[p] || 0) + 1 / seasons.length;
      return c;
    })(),
  };
  // §27's money bar, clause by clause.
  const m = seasons.map(s => s.money);
  const moneyBar = {
    pass: m.filter(x => x.haul && x.haul.pass).length,
    // R4-1: the bar and its first clause by haul, with distinct seasons, officially and under each shadow valuation.
    counts: {
      pass: countOf(seasons, s => s.money.haul && s.money.haul.pass),
      allOut: countOf(seasons, s => s.money.haul && s.money.haul.outEarn.every(o => o.pass)),
      byType: Object.fromEntries(['smuggler', 'chemist', 'dealer'].map(t => [t, countOf(seasons, s => s.money.haul && (s.money.haul.outEarn.find(o => o.type === t) || {}).pass)])),
      shadow: Object.fromEntries(SHADOWS.map(v => [v, {
        pass: countOf(seasons, s => s.money.shadow[v] && s.money.shadow[v].pass),
        allOut: countOf(seasons, s => s.money.shadow[v] && s.money.shadow[v].outEarn.every(o => o.pass)),
        byType: Object.fromEntries(['smuggler', 'chemist', 'dealer'].map(t => [t, countOf(seasons, s => s.money.shadow[v] && (s.money.shadow[v].outEarn.find(o => o.type === t) || {}).pass)])),
        median: Object.fromEntries(['smuggler', 'chemist', 'dealer'].map(t => [t, median(seasons.map(s => (s.money.shadow[v] ? (s.money.shadow[v].outEarn.find(o => o.type === t) || {}).haul : null)))])),
        hustleHaul: median(seasons.map(s => (s.money.shadow[v] ? s.money.shadow[v].hustleHaul : null))),
      }])),
      chems: countOf(seasons, s => s.money.haul && s.money.haul.chems.pass),
      byIncome: countOf(seasons, s => s.money.byIncome && s.money.byIncome.pass),
      byIncomeBy: Object.fromEntries(OUT_EARN.map(t => [t, countOf(seasons, s => s.money.byIncome && (s.money.byIncome.outEarn.find(o => o.type === t) || {}).pass)])),
      spread: countOf(seasons, s => s.money.haul && s.money.haul.spread.pass),
    },
    haul: Object.fromEntries(['smuggler', 'chemist', 'dealer'].map(t => [t, {
      pass: m.filter(x => x.haul && (x.haul.outEarn.find(o => o.type === t) || {}).pass).length, median: median(m.map(x => (x.haul ? (x.haul.outEarn.find(o => o.type === t) || {}).haul : null))),
    }])),
    hustleHaul: median(m.map(x => (x.haul ? x.haul.hustleHaul : null))),
    allOut: m.filter(x => x.haul && x.haul.outEarn.every(o => o.pass)).length,
    chems: { pass: m.filter(x => x.haul && x.haul.chems.pass).length, ...Object.fromEntries(['smugglers', 'shop', 'cooked', 'kits', 'taken', 'others', 'share'].map(k => [k, median(m.map(x => (x.haul ? x.haul.chems[k] : null)))])) },
    spread: { pass: m.filter(x => x.haul && x.haul.spread.pass).length, lo: median(m.map(x => (x.haul ? x.haul.spread.lo : null))), hi: median(m.map(x => (x.haul ? x.haul.spread.hi : null))) },
    // The first clause by income (the shadow), with each trade's median income (the third clause's).
    byIncome: {
      pass: m.filter(x => x.byIncome && x.byIncome.pass).length, hustle: median(m.map(x => (x.byIncome ? x.byIncome.hustleIncome : null))),
      trades: Object.fromEntries(TRADES.map(t => [t, {
        median: median(m.map(x => (x.haul ? (x.haul.trades.find(o => o.trade === t) || {}).income : null))),
        pass: m.filter(x => x.byIncome && (x.byIncome.outEarn.find(o => o.type === t) || {}).pass).length,
      }])),
    },
    gap: { pass: m.filter(x => x.gap && x.gap.pass).length, ratio: median(m.map(x => (x.gap ? x.gap.ratio : null))), pairs: (() => {
      const c = {};
      for (const x of m) if (x.gap && x.gap.hi && !x.gap.pass) c[`${x.gap.hi.trade} over ${x.gap.lo.trade}`] = (c[`${x.gap.hi.trade} over ${x.gap.lo.trade}`] || 0) + 1;
      return c;
    })() },
    share: median(m.map(x => (x.share ? x.share.share : null))),
  };
  // The city's prices at each lock (the board's next unit), medians across seasons.
  const priceByNight = side => Array.from({ length: N.nights }, (_, i) => i + 1).map(d => ({
    day: d, ...Object.fromEntries(['chems', 'parts', 'doses', 'guns'].filter(k => seasons[0].supply[side][d] && k in seasons[0].supply[side][d]).map(k => [k, median(seasons.map(s => (s.supply[side][d] || {})[k]))])),
  }));
  const chain = chainSummary(seasons);
  const habits = habitCounts(seasons);
  const sharp = sharpSummary(seasons, chain, B, Nn);
  const checks = {
    rest: sum(seasons.flatMap(s => Object.values(s.seats).map(x => Math.abs(x.books.rest)))),
    restMax: Math.max(...seasons.flatMap(s => Object.values(s.seats).map(x => Math.abs(x.books.rest)))),
    goodsRest: sum(seasons.flatMap(s => Object.values(s.seats).flatMap(x => Object.values(x.goods || {}).map(g => Math.abs(g.rest))))),
  };
  return {
    vaultNights, crewBreakins, armed, arrestCost, chain, habits, sharp, buyerByNight: priceByNight('buyerAt'), shopByNight: priceByNight('shopAt'),
    seasons: seasons.length, kinds, books: B, nights: Nn, goods: Gd, roles, jobKinds, grabs: { n: grabs.length, why: grabWhy, list: grabs }, betrayals, stash,
    flows, city, street, goodsIn, goodsOut, night1: { plays: n1plays, reasons: n1reasons, fights: n1fights, quiet: quiet1, cash: mean(n1.map(x => x.cash)), patrols: n1.map(x => x.patrols) }, blind, moneyBar, checks,
    wage: median(seasons.map(s => s.wage)),
  };
}

// --- the page -------------------------------------------------------------------------------------------------------------
const cell = st => (st ? `${money(st.median)} (${money(st.mean)})` : 'n/a');
export function page(sm, meta) {
  const L = [];
  const kinds = sm.kinds;
  const trades = ['hustle', 'smuggler', 'chemist', 'dealer', 'gunrunner', 'cop', 'crew'].filter(k => kinds.includes(k));
  L.push('# R3-5: the trades diagnosis (MOCK)', '');
  L.push(`${meta.cast} cast, ${meta.seeds}. ${meta.overrides ? `OVERRIDES: ${meta.overrides}. ` : 'Today\'s rules (no overrides). '}Command: \`${meta.command}\`.`, '');
  L.push(`Books closed against every seat's last cash: unexplained, all seats, all seasons ${money(sm.checks.rest)} (the largest one seat ${money(sm.checks.restMax)}); goods unexplained ${sm.checks.goodsRest} units.`, '');

  L.push('## Each trade\'s books (a seat a season: median (mean))', '');
  L.push(`| flow | ${trades.map(k => `${k} (${num(sm.books[k].seats, 0)})`).join(' | ')} |`, `|---|${trades.map(() => '---').join('|')}|`);
  for (const [label] of GROUPS) {
    if (trades.every(k => !sm.books[k].groups[label].mean)) continue;
    L.push(`| ${IN_GROUPS.includes(label) ? '+' : '−'} ${label} | ${trades.map(k => cell(sm.books[k].groups[label])).join(' | ')} |`);
  }
  L.push(`| cash at the end | ${trades.map(k => cell(sm.books[k].flows.end)).join(' | ')} |`);
  L.push(`| trade income (its trade's sales less its goods) | ${trades.map(k => cell(sm.books[k].tradeIncome)).join(' | ')} |`);
  L.push(`| income (trade income, hustles, flex) | ${trades.map(k => cell(sm.books[k].income)).join(' | ')} |`);
  L.push(`| **haul** (copy paid) | ${trades.map(k => `**${cell(sm.books[k].haul)}**`).join(' | ')} |`);
  for (const v of SHADOWS) L.push(`| ↳ haul, ${VALUED[v]} | ${trades.map(k => cell(sm.books[k].hauls[v])).join(' | ')} |`);
  L.push(`| goods handed over and never paid for (at $15) | ${trades.map(k => cell(sm.books[k].flows.unpaid)).join(' | ')} |`);
  L.push(`| arrests a seat | ${trades.map(k => num(sm.books[k].arrests, 2)).join(' | ')} |`, '');

  L.push('## Each trade\'s nights (a seat a season)', '');
  const CATS = ['trade', 'hustle', 'crime', 'back', 'laylow', 'jail', 'board', 'other'];
  L.push(`| | ${trades.map(k => k).join(' | ')} |`, `|---|${trades.map(() => '---').join('|')}|`);
  for (const c of CATS) {
    if (trades.every(k => !sm.nights[k].cats[c])) continue;
    L.push(`| ${c} | ${trades.map(k => num((sm.nights[k].cats[c] || 0) / sm.nights[k].seats, 1)).join(' | ')} |`);
  }
  L.push(`| trade income a night of its trade's work, median seat (mean) | ${trades.map(k => (sm.nights[k].trade.n ? cell(sm.nights[k].trade.incomePerNight) : 'n/a')).join(' | ')} |`);
  L.push(`| the hustle take those nights | ${trades.map(k => money(sm.nights[k].trade.wage)).join(' | ')} |`);
  L.push(`| a trade night ends in an arrest that night / within 2 nights | ${trades.map(k => (sm.nights[k].trade.n ? `${pct(sm.nights[k].trade.arrested)} / ${pct(sm.nights[k].trade.arrestedSoon)}` : 'n/a')).join(' | ')} |`);
  L.push(`| a trade night it was robbed | ${trades.map(k => (sm.nights[k].trade.n ? pct(sm.nights[k].trade.robbed) : 'n/a')).join(' | ')} |`);
  L.push(`| corner fights (lost, ties, arrests), all seasons | ${trades.map(k => (sm.nights[k].trade.cornerFights ? `${sm.nights[k].trade.cornerFights} (${sm.nights[k].trade.cornerLost}, ${sm.nights[k].trade.cornerTies}, ${sm.nights[k].trade.cornerArrests})` : '0')).join(' | ')} |`, '');

  L.push('### What a night of each trade made', '');
  const P = k => sm.nights[k] && sm.nights[k].product;
  if (P('smuggler')) L.push(`- Smuggler: ${P('smuggler').runs} runs; ${num(P('smuggler').units)} units a run; alone at its drop ${pct(P('smuggler').alone)}, a mean ${num(P('smuggler').atDrop)} Smugglers at its drop; a full ${N.dropUnits} on ${pct(P('smuggler').full)}.`);
  if (P('chemist')) L.push(`- Chemist: ${P('chemist').cooks} cooks; a batch made on ${pct(P('chemist').made)}; ${num(P('chemist').batches, 2)} batches and ${num(P('chemist').doses)} doses a cook; both batches on ${pct(P('chemist').twoBatches)}; at the lab ${pct(P('chemist').lab)}; a named drug ${pct(P('chemist').named)}.`);
  if (P('dealer')) L.push(`- Dealer: ${P('dealer').deals} nights on a corner; sold on ${pct(P('dealer').sold)}; ${num(P('dealer').doses)} doses for ${money(P('dealer').takings)} a night it sold (${money(P('dealer').perDose)} a dose); a hot corner on ${pct(P('dealer').hot)}; the cap of ${N.deal.cap} or more on ${pct(P('dealer').full)}; it carried fewer than ${N.deal.cap} doses to the corner on ${pct(P('dealer').short)} (a mean ${num(P('dealer').carried)}).`);
  if (P('gunrunner')) L.push(`- Gunrunner: ${P('gunrunner').builds} builds; ${num(P('gunrunner').guns, 2)} guns a build; ${P('gunrunner').warrants} warrants and ${P('gunrunner').fakes} fakes in all.`);
  if (P('cop')) L.push(`- Cop: ${P('cop').patrols} patrols, ${P('cop').guards} guards, ${P('cop').collars} collars (${money(P('cop').collarPay)} in collar pay); ${money(P('cop').wage)} a patrol or guard.`);
  L.push('');

  L.push('### Why a trade bot didn\'t work its trade (its free nights, all seasons)', '');
  for (const k of ['smuggler', 'chemist', 'dealer', 'gunrunner', 'cop'].filter(x => kinds.includes(x))) {
    const w = sm.nights[k].why;
    const free = sm.nights[k].free;
    L.push(`- **${k}** (${free} free nights, ${sm.nights[k].trade.n} worked): ${Object.entries(w).slice(0, 8).map(([r, c]) => `${r} ${c} (${pct(c / free)})`).join('; ')}.`);
  }
  L.push('');

  L.push('## Goods (units a seat a season)', '');
  for (const k of ['smuggler', 'chemist', 'dealer', 'gunrunner'].filter(x => kinds.includes(x))) {
    const g = sm.goods[k];
    for (const [kind, row] of Object.entries(g)) {
      const ins = Object.entries(row.in).filter(([, u]) => u >= 0.05).map(([s, u]) => `${s} ${num(u)}`).join(', ');
      const outs = Object.entries(row.out).filter(([, u]) => u >= 0.05).map(([s, u]) => `${s} ${num(u)}`).join(', ');
      if (!ins && !outs) continue;
      L.push(`- ${k}, ${kind}: in ${ins || 'none'}; out ${outs || 'none'}.`);
    }
  }
  L.push('');

  L.push('## The supply chain (a season\'s mean, every seat by the trade it works)', '');
  L.push('| seller → buyer | goods | units | from the trade\'s own bots | paid | a unit paid |', '|---|---|---|---|---|---|');
  for (const [k, f] of Object.entries(sm.flows).sort((x, y) => y[1].units - x[1].units)) {
    if (f.units < 0.5) continue;
    const [pair, goods] = k.split('|');
    L.push(`| ${pair.replace('>', ' → ')} | ${goods} | ${num(f.units)} | ${pct(share(f.bot, f.units))} | ${money(f.paid)} | ${f.paidUnits ? money(f.paid / f.paidUnits) : 'n/a'} |`);
  }
  L.push('', "| the city | goods | seller's or buyer's trade | units | cash | a unit |", '|---|---|---|---|---|---|');
  for (const [k, f] of Object.entries(sm.city).sort((x, y) => y[1].units - x[1].units)) {
    if (f.units < 0.5) continue;
    const [side, goods, trade] = k.split('|');
    L.push(`| ${side} | ${goods} | ${trade} | ${num(f.units)} | ${money(f.cash)} | ${money(f.cash / f.units)} |`);
  }
  L.push('', `The street: ${num(sm.street.doses)} doses a season on ${num(sm.street.nights)} corner-nights for ${money(sm.street.cash)} (${money(sm.street.cash / sm.street.doses)} a dose); hot corners ${num(sm.street.hotDoses)} doses for ${money(sm.street.hotCash)}.`, '');
  L.push(`Goods onto the island (a season): ${Object.entries(sm.goodsIn).filter(([, u]) => u >= 0.5).map(([k, u]) => `${k} ${num(u)}`).join(', ')}.`, '');
  L.push(`Goods off it: ${Object.entries(sm.goodsOut).filter(([, u]) => u >= 0.5).map(([k, u]) => `${k} ${num(u)}`).join(', ')}.`, '');
  const ch = sm.chain;
  const fate = (x, label) => `${label}: ${num(x.made)} in${x.own ? ` (${num(x.own)} its own work)` : ''}; ${pct(share(x.sold, x.made))} sold to agents for ${money(x.cash)} (${money(share(x.cash, x.sold))} a unit), ${pct(share(x.buyer, x.made))} sold the city's buyer for ${money(x.buyerCash)} (${money(share(x.buyerCash, x.buyer))} a unit)${x.dealt ? `, ${pct(share(x.dealt, x.made))} dealt` : ''}${x.used ? `, ${pct(share(x.used, x.made))} used` : ''}${x.taken ? `, ${pct(share(x.taken, x.made))} taken` : ''}, ${pct(share(x.robbed, x.made))} robbed, ${pct(share(x.gone, x.made))} gone at the ferry${x.stash ? `, ${pct(share(x.stash, x.made))} into a crew stash` : ''}`;
  L.push('### Where each step\'s goods went (every seat that works the trade, a season)', '');
  L.push(`- Smugglers (${num(ch.smuggler.seats)} seats), ${fate(ch.smuggler.chems, 'chems')}.`);
  L.push(`- Smugglers, ${fate(ch.smuggler.parts, 'parts')}.`);
  L.push(`- Chemists (${num(ch.chemist.seats)}): chems in ${num(ch.chemist.chemsIn.got)} from agents for ${money(ch.chemist.chemsPaid)}, ${num(ch.chemist.chemsIn.shop)} from the city's shop for ${money(ch.chemist.shopPaid)}, ${num(ch.chemist.chemsIn.kit)} in the kits, ${num(ch.chemist.chemsIn.other)} otherwise; ${num(ch.chemist.chemsUsed)} cooked, ${num(ch.chemist.chemsDumped)} sold the buyer, ${num(ch.chemist.chemsGone)} gone.`);
  L.push(`- Chemists, ${fate(ch.chemist.doses, 'doses')}.`);
  L.push(`- Dealers (${num(ch.dealer.seats)}): doses in ${num(ch.dealer.kit)} kit, ${num(ch.dealer.got)} from agents for ${money(ch.dealer.paid)} (${money(share(ch.dealer.paid, ch.dealer.got))} a dose), ${num(ch.dealer.other)} otherwise; ${fate(ch.dealer.doses, 'of all its doses')}; the street paid ${money(ch.dealer.street)} (${money(share(ch.dealer.street, ch.dealer.doses.dealt))} a dose).`);
  L.push(`- Gunrunners (${num(ch.gunrunner.seats)}): parts ${num(ch.gunrunner.partsKit)} kit and ${num(ch.gunrunner.partsGot)} from agents for ${money(ch.gunrunner.partsPaid)}; ${num(ch.gunrunner.partsUsed)} built, ${num(ch.gunrunner.partsDumped)} sold the buyer; ${fate(ch.gunrunner.guns, 'guns')}; warrants ${num(ch.gunrunner.warrants.made)} made, ${num(ch.gunrunner.warrants.sold)} sold for ${money(ch.gunrunner.warrants.cash)}; fakes sold for ${money(ch.gunrunner.pieceCash)}.`, '');
  // A street dose's price, step by step: what the Smuggler's two chems for five doses fetched, the Chemist's dose less
  // its chems, the Dealer's corner less the dose.
  const smChem = share(ch.smuggler.chems.cash, ch.smuggler.chems.sold);
  const chemCost = share(ch.chemist.chemsPaid + ch.chemist.shopPaid, ch.chemist.chemsIn.got + ch.chemist.chemsIn.shop);
  const chDose = share(ch.chemist.doses.cash, ch.chemist.doses.sold);
  const dlDose = share(ch.dealer.paid, ch.dealer.got);
  const street = share(ch.dealer.street, ch.dealer.doses.dealt);
  const perDose = N.cook.chems / N.cook.doses;
  L.push(`**Where a street dose's ${money(street)} lands** (a dose is ${N.cook.chems} chems for ${N.cook.doses} doses): the Smuggler ${money(smChem * perDose)} (${N.cook.chems}/${N.cook.doses} of a chem at ${money(smChem)}); the Chemist ${money(chDose - chemCost * perDose)} (a dose at ${money(chDose)} less its chems at ${money(chemCost)} each); the Dealer ${money(street - dlDose)} (the street less the ${money(dlDose)} it paid). The rest of what the chain made went to the city's buyer at its collapsed prices, or nowhere.`, '');
  L.push('| night | the buyer: chems / parts / doses | the shop: chems / parts / guns |', '|---|---|---|');
  for (let i = 0; i < sm.buyerByNight.length; i++) {
    const b = sm.buyerByNight[i];
    const s2 = sm.shopByNight[i];
    L.push(`| ${b.day} | ${money(b.chems)} / ${money(b.parts)} / ${money(b.doses)} | ${money(s2.chems)} / ${money(s2.parts)} / ${money(s2.guns)} |`);
  }
  L.push('', "(The board's next unit at each lock, medians across seasons: the buyer starts at $8 / $8 / $10, the shop at $25 / $25 / $200.)", '');

  L.push('## Bot habits at their decision points (bots.mjs at a0f5dad)', '');
  L.push('| habit | where | how often | of |', '|---|---|---|---|');
  for (const h of sm.habits) L.push(`| ${h.label} | ${h.where} | ${num(h.count)} ${h.unit}${h.extra ? `; ${h.extra}` : ''} | ${h.of == null ? '' : `${num(h.of)} (${pct(share(h.count, h.of))})`} |`);
  L.push('');

  L.push('## The crews', '');
  L.push(`| role | seats | haul median (mean), copy paid | ${SHADOWS.map(v => `haul, ${VALUED[v]}`).join(' | ')} | nights: trade / hustle / crime / back / laylow / jail | trade income | arrests | hustles | thefts+grabs+vault | stash taken | cuts in | stash put | fines+bail | the list | end cash |`, `|---|---|---|${SHADOWS.map(() => '---').join('|')}|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const [role, r] of Object.entries(sm.roles)) {
    if (!r.n) continue;
    const c = r.cats;
    L.push(`| ${role} | ${r.n} | ${cell(r.haul)} | ${SHADOWS.map(v => cell(r.hauls[v])).join(' | ')} | ${num(c.trade || 0)} / ${num(c.hustle || 0)} / ${num(c.crime || 0)} / ${num(c.back || 0)} / ${num(c.laylow || 0)} / ${num(c.jail || 0)} | ${money(r.trade)} | ${num(r.arrests, 2)} | ${money(r.flows.hustle)} | ${money(r.flows.thefts + r.flows.grabs + r.flows.vault)} | ${money(r.flows.stashTake)} | ${money(r.flows.cuts)} | ${money(r.flows.stashPut)} | ${money(r.flows.fine + r.flows.bail)} | ${money(r.flows.list)} | ${money(r.flows.end)} |`);
  }
  L.push('', '| crew job (leader\'s play) | jobs | found | won | mean take a job | a crew member, a job night (take ÷ crew in it) | crew members arrested a job | net a member, a job night (less arrests) | the hustle take those nights | tipped | a patrol there | rival groups |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, j] of Object.entries(sm.jobKinds).sort((x, y) => y[1].n - x[1].n)) {
    const crimeJob = CRIMES.includes(k);
    L.push(`| ${k} | ${j.n} | ${crimeJob ? j.found : ''} | ${crimeJob ? j.won : ''} | ${crimeJob ? money(j.value / j.n) : ''} | ${crimeJob && j.crewIn ? money(j.value / j.crewIn) : ''} | ${crimeJob ? num(j.arrestedCrew / j.n, 2) : ''} | ${crimeJob && j.net != null ? money(j.net) : ''} | ${money(j.wage / j.n)} | ${crimeJob ? j.tipped : ''} | ${crimeJob ? j.patrol : ''} | ${crimeJob ? j.rivals : ''} |`);
  }
  L.push('', `An arrest cost a crew member ${money(sm.arrestCost)}: its fine and bail (the mean a crew arrest), and ${N.jailNights} nights of the median wage.`);
  const cb = sm.crewBreakins;
  L.push('', `Crew break-ins: won ${cb.won} of ${cb.n}; another group broke into the same home in ${cb.rivals} (won ${cb.rivalsWon}), none did in ${cb.n - cb.rivals} (won ${cb.won - cb.rivalsWon}); a right tip brought the cops to ${cb.tipped} (won ${cb.tippedWon}). Vault jobs by night: ${Object.entries(sm.vaultNights).map(([k, n]) => `night ${k} ${n}`).join(', ') || 'none'}.`);
  L.push('', `Grabs at the docks, all seasons: ${sm.grabs.n}; ${Object.entries(sm.grabs.why).map(([k, n]) => `${k} ${n}`).join(', ')}; arrested ${sum(sm.grabs.list.map(g => g.arrested))} agents; a patrol in ${sm.grabs.list.filter(g => g.patrol).length}; tipped ${sm.grabs.list.filter(g => g.tipped).length}; median top group ${median(sm.grabs.list.map(g => g.top))} against a defence of ${median(sm.grabs.list.map(g => g.defence))}.`, '');
  L.push(`Betrayals, all seasons: ${Object.entries(sm.betrayals).map(([k, b]) => `${k} ${b.n}${b.cash ? ` (${money(b.cash)} taken)` : ''}${b.owed ? ` (${money(b.owed - b.paid)} of cuts kept)` : ''}`).join(', ')}.`, '');
  L.push(`The crew stash, a season: ${money(sm.stash.put)} put in, ${money(sm.stash.take)} taken out, ${money(sm.stash.aboardCash)} cash and ${num(sm.stash.aboardPieces)} pieces (worth ${money(sm.stash.aboardValue)}) aboard with a keeper, ${money(sm.stash.gone)} gone at the ferry.`, '');

  L.push('## Night 1', '');
  L.push(`Quiet (no theft, arrest, corner fight, turn, grab or vault job) in ${sm.night1.quiet} of ${sm.seasons} seasons. Cash on the island at the lock: ${money(sm.night1.cash)}. Fights: ${Object.entries(sm.night1.fights).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}.`, '');
  L.push(`Plays, a season: ${Object.entries(sm.night1.plays).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ${num(n)}`).join(', ')}.`, '');
  L.push(`Why, a season: ${Object.entries(sm.night1.reasons).sort((x, y) => y[1] - x[1]).slice(0, 16).map(([k, n]) => `${k} ${num(n)}`).join('; ')}.`, '');
  const b = sm.blind;
  L.push(`**A Dealer that picks blind on night 1** (${num(b.dealers)} Dealers deal there a season; the night settled again with one moved, the rest as played): on its own pecking-order corner it deals ${pct(b.own.dealt)}, for ${money(b.own.cash)}. Moved to one of the other ${Object.keys(N.corners).length - 1} corners: it deals ${pct(b.any.dealt)} and is arrested ${pct(b.any.arrested)}. On a corner another Dealer took (${b.taken.n} cases): a tie ${pct(b.taken.tie)}, arrested ${pct(b.taken.arrested)} (of those arrests, in Glasswall's heavy district ${pct(b.taken.heavy)}, with a patrol there ${pct(b.taken.patrolled)}). On a corner nobody took (${b.free.n}): deals ${pct(b.free.dealt)}, arrested ${pct(b.free.arrested)}. A pick uniform over all ${Object.keys(N.corners).length}: deals ${pct(b.uniform.dealt)}, ties ${pct(b.uniform.tie)}, arrested ${pct(b.uniform.arrested)}.`, '');
  L.push(`Every Dealer on a corner drawn at random (${b.draws.n} draws): a mean ${num(b.draws.fights)} in corner fights, ${num(b.draws.ties)} ties, ${num(b.draws.arrested)} arrested and ${num(b.draws.dealt)} dealing, for ${money(b.draws.cash)} against the pecking order's ${money(b.actualCash)}; someone arrested in ${pct(b.draws.anyArrest)} of draws. Cops patrolled on night 1, a season: ${Object.entries(b.patrols).map(([k, n]) => `${k} ${num(n)}`).join(', ')}.`, '');

  L.push('## What each trade could make: the Dealer from its own view, the rest bounds (estimates)', '');
  const sh = sm.sharp;
  const est = x => `${num(x.units)} units a seat a season, ${num(x.nights)} nights of the trade and ${num(N.nights - 1 - x.nights)} hustles, ${money(x.trade)} from the trade and ${money(x.shifts)} in takes, ${money(x.income)} in all`;
  L.push(`The hustler's income: ${money(sh.hustleIncome)} a season (a median take of ${money(sh.wage)}).`, '');
  const lossPerNight = sm.books.dealer && sm.nights.dealer.trade.n ? (sm.books.dealer.flows.robbed.mean + sm.books.dealer.flows.heldUp.mean) / (sm.nights.dealer.trade.n / sm.nights.dealer.seats) : 0;
  L.push(`- **Dealer**, from its own view: one more seat night by night on the seasons as played (7 doses a day at $15, open corners only, never Glasswall, hot while it stays unwanted, else a normal corner where no Cop was seen): ${num(sh.dealer.dealt)} corner nights of ${num(sh.dealer.nights)}, ${num(sh.dealer.hot)} hot; takings ${money(sh.dealer.takings)} less ${money(sh.dealer.cost)} of doses = ${money(sh.dealer.net)} a season (median ${money(sh.dealer.median)}); ${num(sh.dealer.ties, 2)} ties and ${num(sh.dealer.arrests, 2)} arrests a season. Less what the Dealer bots lost to thefts and hold-ups a corner night (${money(lossPerNight)}): ${money(sh.dealer.net - lossPerNight * sh.dealer.dealt)}.`);
  L.push(`- **Crew member**, a replay that is not a player's view: it ranks homes with the fake flag and end-of-season prices, which no player sees, and settles its fights without the owner's backers, TEMP, city cops or tips, so each gap pushes it up. A crew of four with no gear, break-ins on the home it rates richest, striking while every member stays unwanted: ${num(sh.crew.strikes)} strikes a season, ${num(sh.crew.won)} won, ${money(sh.crew.take)} in cash and ${money(sh.crew.pieces)} in pieces (at what each last sold for) taken (${money(sh.crew.memberTake)} a member, median), ${num(sh.crew.arrests, 2)} arrests of the four; with ${num(sh.crew.shifts)} hustles (${money(sh.crew.hustlePay)}), a member's season ${money(sh.crew.member)} (median; ${money(sh.crew.memberCash)} counting cash only).`);
  L.push(`- **Smuggler**, a fair-share bound, not a player's view: the season's real demand (${num(sh.inputs.chemsWanted)} chems and ${num(sh.inputs.partsWanted)} parts) ÷ the seats that work the trade × $15 a unit, run alone at a drop, and a hustle at the median take on every other night: ${est(sh.smuggler)}; with the Dealers supplied (${num(sh.inputs.extraDoses)} more doses a season): ${est(sh.smugglerSupplied)}.`);
  L.push(`- **Chemist**, a fair-share bound, not a player's view: the season's real demand (${num(sh.inputs.dosesWanted)} doses) ÷ the seats that work the trade × $${num(STREET.unit - (N.cook.chems / N.cook.doses) * STREET.unit, 0)} a dose ($15 less $${num((N.cook.chems / N.cook.doses) * STREET.unit, 0)} of chems), two batches a cook, and a hustle at the median take on every other night: ${est(sh.chemist)}; with the Dealers supplied: ${est(sh.chemistSupplied)}.`);
  L.push(`- **Gunrunner**, a fair-share bound: the guns and warrants that sold, less the parts, ÷ the seats that work the trade: ${num(sh.gunrunner.guns, 2)} guns sold a seat a season at ${money(sh.gunrunner.price)}; its trade nets ${money(sh.gunrunner.trade)} a seat a season; the rest is hustles. A gun is never used up: of ${num(sm.armed.arrests)} arrests a season, ${num(sm.armed.armedArrests)} were of an agent holding one.`, '');

  L.push('## §27\'s money bar, clause by clause', '');
  const mb = sm.moneyBar;
  const mc = mb.counts;
  L.push(`- The bar (passbars.mjs's \`money\`): ${countText(mc.pass)} (${SHADOWS.map(v => `${VALUED[v]} ${countText(mc.shadow[v].pass)}`).join('; ')}).`);
  L.push(`- 1, by haul, copy paid (each trade's median seat, of the seats that play it, against the median hustler's ${money(mb.hustleHaul)}): ${Object.entries(mb.haul).map(([t, x]) => `${t} ${money(x.median)} (${countText(mc.byType[t])})`).join(', ')}; all three ${countText(mc.allOut)}.`);
  for (const v of SHADOWS) L.push(`  - ${VALUED[v]} (against the median hustler's ${money(mc.shadow[v].hustleHaul)}): ${['smuggler', 'chemist', 'dealer'].map(t => `${t} ${money(mc.shadow[v].median[t])} (${countText(mc.shadow[v].byType[t])})`).join(', ')}; all three ${countText(mc.shadow[v].allOut)}.`);
  L.push(`- 1, by income (the shadow; each trade's median seat of the seats that play it, against the median hustler's ${money(mb.byIncome.hustle)}): ${Object.entries(mb.byIncome.trades).map(([t, x]) => `${t} ${money(x.median)}${OUT_EARN.includes(t) ? ` (${countText(mc.byIncomeBy[t])})` : ''}`).join(', ')}; all three ${countText(mc.byIncome)}.`);
  L.push(`- 2, most chems cooked from Smugglers (more than half of what reached the Chemists): ${countText(mc.chems)}; a median season ${mb.chems.smugglers} from Smugglers (a share of ${pct(mb.chems.share)}), ${mb.chems.shop} from the shop, ${mb.chems.kits} from the Chemists' kits, ${mb.chems.taken} taken, ${mb.chems.others} from other seats; ${mb.chems.cooked} cooked.`);
  L.push(`- 3, no trade's median income over twice another's (the five trades, the Cop's included): ${countText(mc.spread)}, a median of ${money(mb.spread.lo)} to ${money(mb.spread.hi)}; a median ratio of ${num(mb.gap.ratio, 2)}×; widest pairs that failed: ${Object.entries(mb.gap.pairs).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}.`);
  L.push(`- The street's share of the cash onto the island: ${pct(mb.share)} (§9: about two-thirds).`, '');
  return L.join('\n');
}

// --- several runs side by side ----------------------------------------------------------------------------------------------
function compare(dirs) {
  const runs = dirs.map(d => ({ name: path.basename(d), ...JSON.parse(fs.readFileSync(path.join(d, 'trades.json'), 'utf8')) }));
  const L = [];
  const col = f => runs.map(r => f(r.summary)).join(' | ');
  // A run from before R4-1 kept one haul, the last-price mark, and no distinct seasons: its haul shows as the mark, and
  // copy paid and the opening price are n/a.
  const old = s => !s.moneyBar.counts;
  const BEFORE = 'n/a (made before R4-1)';
  // A haul stat under one valuation: `paid` is `haul`, a shadow is in `hauls`.
  const haulStat = (x, v, f) => {
    if (!x) return 'n/a';
    if (!x.hauls) return v === 'mark' ? f(x.haul) : BEFORE;
    return f(v === 'paid' ? x.haul : x.hauls[v]);
  };
  L.push(`| | ${runs.map(r => r.name).join(' | ')} |`, `|---|${runs.map(() => '---').join('|')}|`);
  for (const k of ['hustle', 'smuggler', 'chemist', 'dealer', 'gunrunner', 'cop', 'crew']) {
    L.push(`| ${k} haul, median (mean), copy paid | ${col(s => haulStat(s.books[k], 'paid', cell))} |`);
    for (const v of SHADOWS) L.push(`| ↳ ${k} haul, ${VALUED[v]} | ${col(s => haulStat(s.books[k], v, cell))} |`);
  }
  for (const k of ['smuggler', 'chemist', 'dealer', 'gunrunner', 'crew']) {
    L.push(`| ${k} income, median (mean) | ${col(s => cell(s.books[k] && s.books[k].income))} |`);
  }
  for (const k of ['smuggler', 'chemist', 'dealer', 'gunrunner', 'cop']) {
    L.push(`| ${k}: trade income a trade night, median seat | ${col(s => money(s.nights[k] && s.nights[k].trade.incomePerNight.median))} |`);
  }
  for (const role of ['leader', 'member', 'snake']) {
    L.push(`| crew ${role} haul, median, copy paid | ${col(s => haulStat(s.roles[role], 'paid', x => money(x.median)))} |`);
    for (const v of SHADOWS) L.push(`| ↳ crew ${role} haul, ${VALUED[v]} | ${col(s => haulStat(s.roles[role], v, x => money(x.median)))} |`);
  }
  // The money bar, and its first clause by haul: officially, then under each shadow, with distinct seasons.
  const byHaul = c => ['smuggler', 'chemist', 'dealer'].map(t => c.byType[t].pass).join(' / ');
  L.push(`| money bar | ${col(s => (old(s) ? BEFORE : countText(s.moneyBar.counts.pass)))} |`);
  for (const v of SHADOWS) L.push(`| ↳ money bar, ${VALUED[v]} | ${col(s => (old(s) ? (v === 'mark' ? `${s.moneyBar.pass}/${s.seasons}` : BEFORE) : countText(s.moneyBar.counts.shadow[v].pass)))} |`);
  L.push(`| 1 by haul: Smuggler / Chemist / Dealer beat the hustler | ${col(s => (old(s) ? BEFORE : byHaul(s.moneyBar.counts)))} |`);
  for (const v of SHADOWS) L.push(`| ↳ 1 by haul, ${VALUED[v]} | ${col(s => (old(s) ? (v === 'mark' ? ['smuggler', 'chemist', 'dealer'].map(t => s.moneyBar.haul[t].pass).join(' / ') : BEFORE) : byHaul(s.moneyBar.counts.shadow[v])))} |`);
  L.push(`| 1 by income (shadow): Smuggler / Chemist / Dealer | ${col(s => OUT_EARN.map(t => (s.moneyBar.byIncome || s.moneyBar.earn).trades[t].pass).join(' / '))} |`);
  L.push(`| 2 most chems from Smugglers | ${col(s => `${s.moneyBar.chems.pass} (${s.moneyBar.chems.smugglers} vs ${s.moneyBar.chems.shop})`)} |`);
  L.push(`| 3 no trade over 2× another (by income) | ${col(s => `${s.moneyBar.gap.pass} (${num(s.moneyBar.gap.ratio, 2)}×)`)} |`);
  L.push(`| grabs: won / defence held / tie | ${col(s => `${s.grabs.why.won || 0} / ${s.grabs.why['the defence held'] || 0} / ${s.grabs.why['a tie between groups'] || 0}`)} |`);
  L.push(`| night 1 quiet | ${col(s => `${s.night1.quiet}/${s.seasons}`)} |`);
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const usage = 'node core/bench/trades.mjs --seeds 404-423 --rules A,B --out <dir> [--cast crime] [--set key=value ...] | --compare <dir> [<dir> ...]';
  if (process.argv[2] === '--compare') {
    console.log(compare(process.argv.slice(3)));
    process.exit(0);
  }
  const args = argsOrExit(process.argv.slice(2), { seeds: 'value', rules: 'value', out: 'value', cast: 'value', set: 'list' }, usage);
  const overrides = parseSet(args.set);
  const mix = mixOrExit({ cast: args.cast || 'crime' }, usage);
  const [lo, hi] = (args.seeds || '404-423').split('-').map(Number);
  const seeds = Array.from({ length: (hi || lo) - lo + 1 }, (_, i) => lo + i);
  const rules = (args.rules || 'A,B').split(',');
  if (!args.out) {
    console.error(`--out is required\nusage: ${usage}`);
    process.exit(2);
  }
  const outDir = path.resolve(args.out);
  const { makeCast } = await import('./bots.mjs');
  const seasons = [];
  for (const rule of rules) {
    for (const seed of seeds) {
      const dir = path.join(outDir, `${seed}-${rule}`);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      seasons.push(season({ seed, rule, outDir, overrides, mix, cast: makeCast(seed, mix) }));
    }
  }
  const sm = withOverrides(overrides, () => summary(seasons));
  const bench = summarize(seasons.map(s => s.metrics));
  const benchMeta = { seeds: `Seeds ${lo}-${hi || lo} under rules ${rules.join(' and ')}: ${seasons.length} seasons.`, overrides, squatter: 0, cast: castName(mix) };
  fs.writeFileSync(path.join(outDir, 'SUMMARY.md'), summaryMarkdown(bench, benchMeta));
  fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ OVERRIDES: overrides, meta: benchMeta, ...bench, perSeason: seasons.map(r => ({ seed: r.seed, rule: r.rule, midseason: r.metrics.midseason, bars: r.metrics.bars })) }, null, 1)}\n`);
  const meta = {
    cast: castName(mix), seeds: `seeds ${lo}-${hi || lo} under rules ${rules.join(' and ')}, ${seasons.length} seasons`,
    overrides: Object.entries(overrides).map(([k, v]) => `${k}=${v}`).join(', '), command: `node core/bench/trades.mjs ${process.argv.slice(2).join(' ')}`,
  };
  fs.writeFileSync(path.join(outDir, 'trades.json'), `${JSON.stringify({ meta, summary: sm, seasons: seasons.map(s => ({ seed: s.seed, rule: s.rule, money: s.money, sharp: s.sharp, crews: { jobs: s.crews.jobs, grabs: s.crews.grabs, betrayals: s.crews.betrayals, stash: s.crews.stash }, night1: s.night1, blind: s.blind ? { ...s.blind, moves: undefined } : null, seats: Object.fromEntries(Object.entries(s.seats).map(([id, x]) => [id, { type: x.type, trade: x.trade, works: x.works, role: x.role, snake: x.snake, haul: x.haul, hauls: x.hauls, books: x.books, goods: x.goods, nights: x.nights }])) })) })}\n`);
  fs.writeFileSync(path.join(outDir, 'TRADES.md'), `${page(sm, meta)}\n`);
  console.log(page(sm, meta));
}
