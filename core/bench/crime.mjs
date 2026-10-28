// R3-1, the crime diagnosis ($0, bots only; trunk docs/briefs/R3-crime-pays.md). It plays each season as the bench does
// (runner.mjs's runSeason, so every season is the bench's, event for event) and only watches it (runSeason's `observe`),
// then reads the record and what it saw at each lock:
// - money: what came onto the island and went off it, by source and sink (the state's books), and each seat's cash by
//   where it came from and where it went, by the kind of seat (its bot), each seat's books closed against its last cash;
// - each crime (a hit, a break-in, a grab, a vault job, a deal, a stolen piece fenced, a bounty): tried, found, won,
//   arrests, what it took, the strength it took, and its worth a night against that night's median hustle take;
// - the robbers' nights (the scout and the guesser, §27's robbers), by the branch of their night() that decided them;
// - what was on the street to steal at each lock: cash at home (homes left empty, and homes with someone in), what
//   agents wore and carried out, the crew stashes, the crate and the vault;
// - an upper bound for one armed robber with full information: each night's best single take it would win, summed, and
//   the same never wanted (§13: below 3 stars), with a hustle or a night in on the nights between.
// Usage: node core/bench/crime.mjs --seeds 404-423 --rules A,B --out core/runs/r3-diag [--cast layer4] [--set k=v ...]
//   It writes crime.json and CRIME.md to --out, the seasons' run folders under it, and the bench's SUMMARY.md and
//   summary.json for the same seasons, as bench.mjs writes them.
// R4-1: haul is copy paid (passbars.mjs's VALUATIONS), with the last-price mark and the opening price as labelled
// shadows; the crime bar reads as §27 words it (passbars.mjs), with the separate medians as a shadow reading; and its
// counts of seasons are also given as distinct seasons.
// R4-11: the bars and their verdicts are passbars.mjs's, and so is what a crime took: a piece at its copy's own first
// sale on the list, goods at the city's opening prices (passbars.mjs's takeWorth), the one reading of a take's worth.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSeason, argsOrExit, parseSet, mixOrExit, castName } from './runner.mjs';
import { viewFor } from '../index.mjs';
import { N } from '../numbers.mjs';
import { rng } from '../rng.mjs';
import { robberPlay, leadValues, hustleChoice, DOSES, STREET, GUNS } from './bots.mjs';
import { piecesOf, wornOf, crewPieces, DRUGS, HOMES, TIER_RANK, dosesUpTo, hustleTake } from '../rules/state.mjs';
import { worksOut } from '../rules/fights.mjs';
import { median, seasonCount, takeWorth, firstSales, ROBBERS, VALUATIONS, SHADOWS, VALUED } from './passbars.mjs';
import { summarize } from './metrics.mjs';
import { summaryMarkdown, countText } from './report.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// R11: a night's take, what a robber's night is weighed against where it was weighed against the shift's wage: the
// median of the night's public hustle takes, by night; and, on a night nobody hustled, one hustle alone in a normal
// district (state.mjs hustleTake).
function nightTakes(log) {
  const by = {};
  for (const e of log) if (e.type === 'hustle') (by[e.night] ||= []).push(e.take);
  return Object.fromEntries(Object.entries(by).map(([n, xs]) => [n, median(xs)]));
}
const loneTake = () => hustleTake('normal', 0);
const ATTACKS = ['hit', 'breakin', 'grab', 'vault'];
const sum = xs => xs.reduce((t, x) => t + x, 0);
const half = x => Math.floor(x / 2);
const mean = xs => (xs.length ? sum(xs) / xs.length : null);
const money = x => (x == null ? 'n/a' : `$${Math.round(x).toLocaleString('en-US')}`);
const pct = x => (x == null ? 'n/a' : `${Math.round(x * 100)}%`);
// R3-2's jump (GAP gap.jump): the strength a hit adds, a whole number; R3-2c's 'alone' adds none and wins a hit's tie on
// an agent out working alone (§7).
const jumpAll = () => (Number.isInteger(N['gap.jump']) ? N['gap.jump'] : 0);
const jumpAlone = () => N['gap.jump'] === 'alone';

// A piece's worth as the board shows it (what it last sold for, else today's price); a fake is worth nothing to a thief.
const worthOf = (S, k) => (S.copies[k].fake ? 0 : S.traits[S.copies[k].trait].last || S.traits[S.copies[k].trait].price);
const rarestWorth = (S, ks) => {
  const real = ks.filter(k => !S.copies[k].fake);
  if (!real.length) return 0;
  const top = Math.max(...real.map(k => TIER_RANK[S.copies[k].tier]));
  return Math.max(...real.filter(k => TIER_RANK[S.copies[k].tier] === top).map(k => worthOf(S, k)));
};
// Goods at the agents' trading price (§9: about $15 a unit and $15 a dose), a gun at what a buyer offers a Gunrunner.
const goodsWorth = g => Object.entries(g || {}).reduce((t, [k, u]) => t + u * (k === 'guns' ? Math.round(N.shopPrice.guns * GUNS.share) : k === 'warrants' || k === 'lockpicks' ? 0 : STREET.unit), 0);
const unitsOf = g => sum(Object.values(g || {}));

// --- what the watcher keeps from each night ----------------------------------------------------------------------------
function watcher(seed, cast) {
  const typeOf = Object.fromEntries(cast.map(c => [c.id, c.type]));
  const cfgOf = Object.fromEntries(cast.map(c => [c.id, c]));
  const W = { lockCash: {}, endCash: {}, nights: [], robberNights: [], log: null, state: null, rawPlays: {} };
  W.observe = info => {
    const d = info.day;
    if (info.at === 'lock') {
      const S = info.state;
      W.lockCash[d] = Object.fromEntries(Object.keys(S.agents).map(id => [id, S.agents[id].cash]));
      W.rawPlays[d] = info.plays;
      for (const id of Object.keys(S.agents).sort()) {
        if (!ROBBERS.includes(typeOf[id])) continue;
        W.robberNights.push({ day: d, id, type: typeOf[id], ...robberNight(S, info.log, id, d, info.plays[id], cfgOf[id], seed) });
      }
      return;
    }
    W.endCash[d] = Object.fromEntries(Object.keys(info.state.agents).map(id => [id, info.state.agents[id].cash]));
    W.nights.push(streetAt(info.lock, info.result, d));
    W.log = info.log;
    W.state = info.state;
  };
  return W;
}

// --- the robbers' nights: which branch of the scout's and the guesser's night() decided it (bots.mjs, seatBot) --------
function robberNight(S, log, id, d, raw, cfg, seed) {
  if (S.agents[id].jail) return { why: 'in jail' };
  const v = viewFor(S, log, id, 'agent');
  const me = v.me;
  const play = raw ? raw.kind : null;
  const reason = raw && typeof raw.reason === 'string' ? raw.reason : '';
  const muscle = me.promises.filter(p => p.what === 'back' && p.who === me.id && p.by !== me.id && p.night === v.day).length;
  const knuckles = me.pieces.some(p => p.worn && p.ability === 'knuckles');
  const gun = (me.goods.guns || 0) >= 1;
  const temp = me.high.includes('temp');
  const power = 1 + muscle + (knuckles ? 1 : 0) + (gun ? 1 : 0) + (temp ? 1 : 0);
  const base = { play, power, cash: me.cash, heat: me.heat, gun, knuckles, temp, muscle };
  if (v.legal.some(l => l.kind === 'board')) return { ...base, why: play === 'hit' ? 'last night: a hit on the route' : 'last night: boards' };
  if (me.crash || me.hooked.length) {
    const forced = v.legal.length === 1;
    if (forced) return { ...base, why: 'forced (a crash or a withdrawal)' };
  }
  if (cfg.careless) return { ...base, why: ATTACKS.includes(play) ? `careless: ${play}` : 'careless: no strength to rob' };
  if (me.heat >= 4) return { ...base, why: 'too hot (4 stars): lies low' };
  if (reason.startsWith('counter-hit')) return { ...base, why: 'counter-hit on a crew' };
  if (ATTACKS.includes(play)) return { ...base, why: `robs: ${play}${reason.includes('TEMP') ? ' (on TEMP)' : ''}${reason.includes('bribed') ? ' (bribed)' : ''}${muscle ? ' (with muscle)' : ''}` };
  const leads = cfg.drugs ? leadValues(v) : null;
  // What a group of strength 2 would have found tonight (the best, not the spread pick), from the same view.
  const armed = robberPlay(v, rng(seed, 'diag', id, d), cfg, Math.max(1, 2 - (knuckles ? 1 : 0) - (gun ? 1 : 0) - (temp ? 1 : 0)) + muscle, false, leads);
  const at2 = armed ? { best2: armed.value, best2kind: armed.play.kind } : { best2: 0, best2kind: null };
  if (!cfg.sharp && !(me.cash >= DOSES.broke || muscle || leads)) return { ...base, ...at2, why: `broke: under $${DOSES.broke}, no muscle, no lead` };
  if (power + jumpAll() + (jumpAlone() ? 1 : 0) < 2) return { ...base, ...at2, why: 'alone and unarmed (strength 1)' };
  if (cfg.sharp && me.heat + 1 >= N.wantedAt) return { ...base, ...at2, why: 'cooling off: a crime would make it wanted' };
  // The crime cast's robber robs only for a take worth the hustle it skips (bots.mjs, robberPlay's floor; R11).
  const floor = cfg.sharp ? hustleChoice(v).take : 0;
  const p = robberPlay(v, rng(seed, 'bot', id, d, 'night'), cfg, 1 + muscle, true, leads, floor);
  if (!p) return { ...base, ...at2, why: cfg.sharp ? 'armed, but no target worth a night\'s hustle' : 'armed, but no target in reach' };
  return { ...base, ...at2, why: 'armed, a target, but it worked' };
}

// --- what was on the street to steal at the lock --------------------------------------------------------------------
// From the state at the lock and the night's checked plays and where they put everyone (resolveFights' `where`).
function streetAt(L, result, d) {
  const R = result.fights;
  const P = result.plays;
  const last = d === N.nights;
  const levels = Object.fromEntries(Object.keys(L.districts).map(x => [x, levelOn(L, x, d)]));
  const gather = Object.fromEntries(result.events.filter(e => e.type === 'gather').map(e => [e.agent, e.goods]));
  // R3-2's hold-up (GAP gap.holdup): the cash each worker's work paid tonight, from the night's own record.
  const holdup = N['gap.holdup'] === 'pay';
  const paid = {};
  if (holdup) {
    for (const e of result.events) if (e.type === 'hustle') paid[e.agent] = e.take;
    for (const e of result.events) if (e.type === 'sale' || e.type === 'patrol' || e.type === 'guard') paid[e.agent] = (paid[e.agent] || 0) + (e.cash != null ? e.cash : e.wage);
  }
  const share = x => Math.floor(x * N.breakinShare);
  const strength = id => 1 + ((L.agents[id].goods.guns || 0) > 0 ? 1 : 0) + (L.agents[id].high.includes('temp') ? 1 : 0);
  const group = id => R.groups[id] || [id];
  const patrol = place => sum(Object.keys(P).filter(x => P[x].kind === 'patrol' && P[x].place === place).map(x => sum(group(x).map(strength))));
  const out = {
    day: d, wage: nightTakes(result.events)[d] ?? null,
    homes: { empty: 0, emptyCash: 0, emptyTake: 0, full: 0, fullCash: 0, fullTake: 0 },
    worn: { agents: 0, pieces: 0, value: 0 }, carried: { agents: 0, units: 0, value: 0 },
    evicted: { agents: 0, cash: 0 }, crews: { cash: 0, pieces: 0 },
    crate: L.crate ? L.crate.cash + goodsWorth(L.crate.goods) : 0,
    vault: L.vault.cash + sum(Object.keys(L.copies).filter(k => L.copies[k].holder.k === 'vault').map(k => worthOf(L, k))),
    best: { value: 0, kind: null },
  };
  // One robber of strength 2, and a hit's jump on top (R3-2, GAP gap.jump); under R3-2c's 'alone', a hit on an agent out
  // working alone (`alone`) wins a tie.
  const consider = (value, kind, defence, alone = false) => {
    const wins = 2 + (kind === 'hit' ? jumpAll() : 0) > defence || (kind === 'hit' && alone && jumpAlone() && 2 === defence);
    if (wins && value > out.best.value) out.best = { value, kind };
  };
  for (const id of Object.keys(L.agents).sort()) {
    const a = L.agents[id];
    const w = R.where[id] || { at: 'jail' };
    const pieces = piecesOf(L, id);
    const worn = wornOf(L, id);
    const c = a.crew && L.crews[a.crew] && L.crews[a.crew].keeper === id ? L.crews[a.crew] : null;
    if (c) {
      out.crews.cash += c.cash;
      out.crews.pieces += crewPieces(L, c.id).length;
    }
    if (!a.evicted && !last) {
      const home = w.at === 'home' && w.home === id;
      const inside = pieces.filter(k => home || !worn.includes(k)).concat(c ? crewPieces(L, c.id) : []);
      const take = share(a.cash) + (c ? share(c.cash) : 0) + rarestWorth(L, inside);
      const k = home ? 'full' : 'empty';
      out.homes[k] += 1;
      out.homes[`${k}Cash`] += a.cash;
      out.homes[`${k}Take`] += take;
      const defence = 1 + (home ? sum(group(id).map(strength)) + (P[id] && P[id].kind === 'laylow' ? 1 : 0) : 0) + patrol(HOMES);
      consider(take, 'breakin', defence);
    }
    if (w.at !== 'out') continue;
    // A hit takes the rarest real piece worn (on the last night, or evicted, everything carried and half the cash) and
    // the goods carried tonight (GAP gap.carried).
    const all = last || a.evicted;
    const piece = rarestWorth(L, all ? pieces : worn);
    const p = P[id] || {};
    const goods = p.kind === 'run' ? gather[id] || {} : p.kind === 'deal' && !(holdup && paid[id]) ? dosesUpTo(a.goods, L.corners[p.corner].holder === id ? N.deal.held : N.deal.cap)
      : p.kind === 'cook' && p.place !== HOMES ? { chems: p.batches * N.cook.chems } : {};
    const cash = (all || N['gap.purse'] === 'half' ? half(a.cash) : 0) + (paid[id] || 0);
    if (worn.length) {
      out.worn.agents += 1;
      out.worn.pieces += worn.length;
      out.worn.value += rarestWorth(L, worn);
    }
    if (unitsOf(goods)) {
      out.carried.agents += 1;
      out.carried.units += unitsOf(goods);
      out.carried.value += goodsWorth(goods);
    }
    if (a.evicted) {
      out.evicted.agents += 1;
      out.evicted.cash += a.cash;
    }
    if (p.kind === 'back') continue;
    const place = w.place;
    const defence = sum(group(id).map(strength)) + (levels[place] === 'heavy' ? N.copsHeavy : 0) + patrol(place);
    const alone = worksOut(p) && group(id).length === 1 && levels[place] !== 'heavy' && !patrol(place);
    consider(piece + goodsWorth(goods) + cash, 'hit', defence, alone);
  }
  if (L.crate && !last) consider(out.crate, 'grab', (levels.docks === 'heavy' ? N.copsHeavy : 0) + patrol('docks'));
  return out;
}
const levelOn = (S, place, night) => (night === 7 && S.midseason === 'blackout' ? 'lawless' : night === 7 && S.midseason === 'crackdown' ? 'heavy' : S.districts[place].level);

// The full-information bounds for one armed robber (strength 2, not wanted, alone): every night's best single take it
// would win (`best`), summed; and the same never wanted (§13: below 3 stars), a crime adding a star, a hustle taking one
// off and paying that night's wage, a night in taking two off.
function bounds(nights) {
  const loose = sum(nights.map(n => n.best.value));
  let dp = { 0: 0 };
  for (const n of nights) {
    const next = {};
    const put = (h, x) => {
      if (next[h] == null || x > next[h]) next[h] = x;
    };
    for (const [hs, x] of Object.entries(dp)) {
      const h = Number(hs);
      const last = n.day === N.nights;
      if (n.best.value > 0 && (h + 1 < N.wantedAt || last)) put(Math.min(N.maxHeat, h + 1), x + n.best.value);
      if (!last) {
        put(Math.max(0, h - 1), x + (n.wage ?? loneTake()));
        put(Math.max(0, h - 2), x);
      }
    }
    dp = next;
  }
  return { loose, cool: Math.max(...Object.values(dp)) };
}

// --- money: each seat's books, from the record ------------------------------------------------------------------------
// Inflows and outflows by kind. Dawn's rent has no event, so it's what closes each night's books (checked: it must be
// $0 or one night's rent); `rest` is whatever no event explains (it should be $0).
const IN = ['hustle', 'police', 'collar', 'flex', 'street', 'buyer', 'goodsSold', 'muscle', 'cuts', 'thefts', 'grabs', 'vault', 'bounty', 'fence', 'crew', 'gifts', 'refund'];
const OUT = ['rent', 'list', 'fenceBuy', 'goodsBought', 'shop', 'bail', 'bribe', 'lookout', 'bountyPost', 'fine', 'robbed', 'musclePaid', 'cutsPaid', 'crewPut', 'giftsOut', 'tab'];
function books(W, ids) {
  const B = Object.fromEntries(ids.map(id => [id, Object.fromEntries([...IN, ...OUT, 'rest'].map(k => [k, 0]))]));
  const add = (id, k, x) => {
    if (B[id] && x) B[id][k] += x;
  };
  const byNight = {};
  for (const e of W.log) {
    const at = e.type === 'pay' || e.type === 'give' ? e.from : e.agent;
    switch (e.type) {
      case 'hustle': add(e.agent, 'hustle', e.take); break;
      case 'patrol': case 'guard': add(e.agent, 'police', e.wage); break;
      case 'collar': add(e.agent, 'collar', e.pay); break;
      case 'flex': add(e.agent, 'flex', e.pay); break;
      case 'sale': add(e.agent, 'street', e.cash); break;
      case 'sell': add(e.agent, 'buyer', e.cash); break;
      case 'shop': add(e.agent, 'shop', e.cash); break;
      case 'bid': add(e.agent, 'list', e.amount); break;
      case 'refund': add(e.agent, 'refund', e.amount); break;
      case 'pay': {
        const k = e.for === 'debt' ? ['goodsBought', 'goodsSold'] : e.for === 'deal' ? ['musclePaid', 'muscle'] : e.for === 'cut' ? ['cutsPaid', 'cuts'] : ['giftsOut', 'gifts'];
        add(at, k[0], e.amount);
        add(e.to, k[1], e.amount);
        break;
      }
      case 'give': if (e.cash) { add(e.from, 'giftsOut', e.cash); add(e.to, 'gifts', e.cash); } break;
      case 'bail': add(e.by, 'bail', e.amount); break;
      case 'rent': add(e.agent, 'rent', e.amount); break;
      case 'bribe': add(e.by, 'bribe', e.price); break;
      case 'look': add(e.by, 'lookout', N.lookout); break;
      case 'bounty':
        if (e.act === 'post') add(e.by, 'bountyPost', e.amount);
        else if (e.act === 'collected') add(e.to, 'bounty', e.amount);
        break;
      case 'stash':
        if (e.act === 'put') add(e.agent, 'crewPut', e.cash);
        else if (e.act === 'take' || e.act === 'aboard') add(e.agent, 'crew', e.cash);
        break;
      case 'fence':
        if (e.act === 'buy') add(e.agent, 'fenceBuy', e.price);
        else if (e.act === 'sold') add(e.agent, 'fence', e.cash);
        break;
      case 'rob': case 'burgle': add(e.leader, 'thefts', e.cash); (byNight[e.night] ||= []).push(e); break;
      case 'grab': add(e.leader, 'grabs', e.cash); break;
      case 'vault': add(e.leader, 'vault', e.cash); break;
      case 'seized': add(e.agent, 'fine', e.fine); break;
      case 'tab': add(e.agent, 'tab', e.paid); break;
      default:
    }
  }
  // A theft's cash came out of the victim's own cash (half of it at the lock, for a break-in or a hit that takes cash),
  // a crew stash and evicted guests; the victim's own part is its loss here.
  for (const [n, list] of Object.entries(byNight)) {
    for (const e of list) {
      const was = (W.lockCash[n] || {})[e.target];
      if (was == null || !e.cash) continue;
      add(e.target, 'robbed', Math.min(e.cash, half(was)));
    }
  }
  // Swaps' cash and the fence's held cash on swaps are rare among the bots (4 offered in 40 seasons): they land in rest.
  const last = Math.max(...Object.keys(W.endCash).map(Number));
  const finalCash = Object.fromEntries(W.log.filter(e => e.type === 'mint' || e.type === 'missed').map(e => [e.agent, e.cash]));
  for (const id of ids) {
    const b = B[id];
    const inflow = sum(IN.map(k => b[k]));
    const outflow = sum(OUT.map(k => b[k]));
    const end = finalCash[id] != null ? finalCash[id] : W.endCash[last][id];
    // Rent at dawn closes the books; any part of the gap that isn't a whole number of nights' rent is `rest`.
    const gap = inflow - outflow - end;
    const nights = Math.max(0, Math.round(gap / N.rent));
    b.rent += Math.min(nights, N.nights) * N.rent;
    b.rest = gap - Math.min(nights, N.nights) * N.rent;
  }
  return B;
}

// --- each crime, from the record and the runner's fights --------------------------------------------------------------
function crimes(W, metrics, typeOf) {
  const log = W.log;
  const S = W.state;
  const sales = firstSales(log);
  const fights = {};
  for (const e of log) if (e.type === 'fight') (fights[e.night] ||= []).push(e);
  const plays = log.filter(e => e.type === 'play');
  const arrests = log.filter(e => e.type === 'arrest');
  const wage = nightTakes(log);
  const arrested = (id, n, within = 0) => arrests.some(a => a.agent === id && a.night >= n && a.night <= n + within);
  const out = {};
  const row = kind => (out[kind] ||= { tried: 0, found: 0, won: 0, arrestedThere: 0, arrestedSoon: 0, takes: [], strength: [], defence: [], groups: [], wage: [], byType: {} });
  // A hit, a break-in, a grab and a vault job, by its leader's play.
  const takesBy = { hit: 'rob', breakin: 'burgle', grab: 'grab', vault: 'vault' };
  for (const p of plays) {
    if (!takesBy[p.kind]) continue;
    const n = p.day;
    const r = row(p.kind);
    r.tried += 1;
    r.byType[typeOf[p.agent]] = (r.byType[typeOf[p.agent]] || 0) + 1;
    r.wage.push(wage[n] ?? loneTake());
    const night = metrics.benchNights.find(x => x.night === n);
    const f = night && night.fights.find(x => x.kind === (p.kind === 'hit' ? 'hit' : p.kind) && x.attackers.some(g => g.leader === p.agent));
    if (!f) {
      r.takes.push(0);
      continue;
    }
    r.found += 1;
    const g = f.attackers.find(x => x.leader === p.agent);
    r.strength.push(g.strength);
    r.defence.push(f.defence);
    r.groups.push(g.members.length);
    if (f.arrested.includes(p.agent)) r.arrestedThere += 1;
    if (arrested(p.agent, n, 2)) r.arrestedSoon += 1;
    if (f.winner !== p.agent) {
      r.takes.push(0);
      continue;
    }
    r.won += 1;
    const e = log.find(x => x.type === takesBy[p.kind] && x.leader === p.agent && x.night === n);
    r.takes.push(e ? takeWorth(e, sales, S.copies) : 0);
  }
  // A deal: the corner's takings less the doses at the agents' price, its heat, and the arrests in corner fights.
  const deal = row('deal');
  for (const p of plays.filter(x => x.kind === 'deal')) {
    deal.tried += 1;
    deal.byType[typeOf[p.agent]] = (deal.byType[typeOf[p.agent]] || 0) + 1;
    deal.wage.push(wage[p.day] ?? loneTake());
    const sale = log.find(x => x.type === 'sale' && x.agent === p.agent && x.night === p.day);
    if (sale) {
      deal.found += 1;
      if (sale.doses) deal.won += 1;
    }
    if (arrests.some(a => a.agent === p.agent && a.night === p.day)) deal.arrestedThere += 1;
    if (arrested(p.agent, p.day, 2)) deal.arrestedSoon += 1;
    deal.takes.push(sale ? sale.cash - sale.doses * STREET.unit : 0);
  }
  // A stolen piece fenced: a listing sold whose piece came by a theft (a hit, a break-in, a vault job).
  const stolen = new Set(Object.keys(S.copies).filter(k => S.copies[k].hist.some(h => ['rob', 'burgle', 'job'].includes(h.what))));
  const fenced = log.filter(e => e.type === 'fence' && e.act === 'sold' && stolen.has(e.copy));
  out.fenced = { stolenPieces: stolen.size, sold: fenced.length, cash: sum(fenced.map(e => e.cash)), minted: Object.values(S.copies).filter(c => stolen.has(c.id) && c.holder.k === 'minted').length };
  const posts = log.filter(e => e.type === 'bounty' && e.act === 'post');
  const paid = log.filter(e => e.type === 'bounty' && e.act === 'collected');
  out.bounty = { posted: posts.length, postedCash: sum(posts.map(e => e.amount)), collected: paid.length, collectedCash: sum(paid.map(e => e.amount)), byType: paid.reduce((m, e) => ({ ...m, [typeOf[e.to]]: (m[typeOf[e.to]] || 0) + 1 }), {}) };
  return out;
}

// --- one season -------------------------------------------------------------------------------------------------------
function season({ seed, rule, outDir, overrides, mix, cast }) {
  const W = watcher(seed, cast);
  const r = runSeason({ seed, rule, outDir, overrides, mix, observe: W.observe });
  const typeOf = Object.fromEntries(cast.map(c => [c.id, c.type]));
  const tradeOf = Object.fromEntries(cast.map(c => [c.id, c.trade]));
  const ids = Object.keys(W.state.agents).sort();
  const B = books(W, ids);
  const bench = JSON.parse(fs.readFileSync(path.join(r.dir, 'checkpoint.json'), 'utf8')).bench;
  const C = crimes(W, { benchNights: bench.nights }, typeOf);
  return {
    metrics: r.metrics, seed, rule, typeOf, tradeOf, haul: r.metrics.haul, hauls: r.metrics.hauls, seasonKey: r.metrics.seasonKey, money: r.metrics.money, bars: Object.fromEntries(Object.entries(r.metrics.bars).map(([k, v]) => [k, v.pass])),
    crimePays: r.metrics.bars.crimePays, books: B, crimes: C, nights: W.nights, robberNights: W.robberNights, bounds: bounds(W.nights),
    arrests: Object.fromEntries(ids.map(id => [id, W.log.filter(e => e.type === 'arrest' && e.agent === id).length])),
  };
}

// --- across seasons ---------------------------------------------------------------------------------------------------
function summary(seasons) {
  const types = [...new Set(seasons.flatMap(s => Object.values(s.typeOf)))];
  const order = ['hustle', 'buylate', 'turtle', 'scout', 'guess', 'crew', 'smuggler', 'chemist', 'dealer', 'gunrunner', 'cop'].filter(t => types.includes(t));
  // Money onto and off the island: the median season's, and all seasons'.
  const srcs = [...new Set(seasons.flatMap(s => Object.keys(s.money.in)))];
  const sinks = [...new Set(seasons.flatMap(s => Object.keys(s.money.out)))];
  const island = {
    in: Object.fromEntries(srcs.map(k => [k, { median: median(seasons.map(s => s.money.in[k] || 0)), total: sum(seasons.map(s => s.money.in[k] || 0)) }])),
    out: Object.fromEntries(sinks.map(k => [k, { median: median(seasons.map(s => s.money.out[k] || 0)), total: sum(seasons.map(s => s.money.out[k] || 0)) }])),
  };
  // Each kind of seat: the mean a seat a season of each flow (means, so small flows show), its haul's median, and its
  // arrests.
  const seats = {};
  for (const t of order) {
    const rows = seasons.flatMap(s => Object.keys(s.typeOf).filter(id => s.typeOf[id] === t).map(id => ({ b: s.books[id], hauls: Object.fromEntries(VALUATIONS.map(v => [v, s.hauls[v][id]])), arrests: s.arrests[id] })));
    seats[t] = {
      seats: rows.length / seasons.length,
      flows: Object.fromEntries([...IN, ...OUT, 'rest'].map(k => [k, mean(rows.map(x => x.b[k]))])),
      // The haul's median under each valuation (R4-1): `haul` is the official one.
      haul: median(rows.map(x => x.hauls.paid)), hauls: Object.fromEntries(VALUATIONS.map(v => [v, median(rows.map(x => x.hauls[v]))])),
      arrests: mean(rows.map(x => x.arrests)), arrestedOnce: mean(rows.map(x => (x.arrests > 0 ? 1 : 0))),
    };
  }
  // Every crime across seasons.
  const kinds = ['hit', 'breakin', 'grab', 'vault', 'deal'];
  const crime = {};
  for (const k of kinds) {
    const rs = seasons.map(s => s.crimes[k]).filter(Boolean);
    const takes = rs.flatMap(r => r.takes);
    const byType = {};
    for (const r of rs) for (const [t, n] of Object.entries(r.byType)) byType[t] = (byType[t] || 0) + n;
    crime[k] = {
      tried: sum(rs.map(r => r.tried)), found: sum(rs.map(r => r.found)), won: sum(rs.map(r => r.won)),
      arrestedThere: sum(rs.map(r => r.arrestedThere)), arrestedSoon: sum(rs.map(r => r.arrestedSoon)),
      meanTake: mean(takes), medianStrength: median(rs.flatMap(r => r.strength)), medianDefence: median(rs.flatMap(r => r.defence)),
      meanGroup: mean(rs.flatMap(r => r.groups)), meanWage: mean(rs.flatMap(r => r.wage)), byType,
    };
  }
  const fenced = ['stolenPieces', 'sold', 'cash', 'minted'].reduce((m, k) => ({ ...m, [k]: sum(seasons.map(s => s.crimes.fenced[k])) }), {});
  const bounty = ['posted', 'postedCash', 'collected', 'collectedCash'].reduce((m, k) => ({ ...m, [k]: sum(seasons.map(s => s.crimes.bounty[k])) }), {});
  // The robbers' nights, by what decided them.
  const rn = seasons.flatMap(s => s.robberNights);
  const why = {};
  for (const x of rn) why[x.why] = (why[x.why] || 0) + 1;
  const stuck = rn.filter(x => x.best2 != null && !x.why.startsWith('robs'));
  const robbers = {
    nights: rn.length, why: Object.fromEntries(Object.entries(why).sort((x, y) => y[1] - x[1])),
    armed: mean(rn.filter(x => x.why !== 'in jail').map(x => (x.gun || x.knuckles ? 1 : 0))),
    cashAtLock: median(rn.filter(x => x.why !== 'in jail').map(x => x.cash)),
    best2: { nights: stuck.length, withTarget: stuck.filter(x => x.best2 > 0).length, median: median(stuck.filter(x => x.best2 > 0).map(x => x.best2)), kinds: stuck.reduce((m, x) => (x.best2kind ? { ...m, [x.best2kind]: (m[x.best2kind] || 0) + 1 } : m), {}) },
    gunNight: median(seasons.flatMap(s => Object.keys(s.typeOf).filter(id => ROBBERS.includes(s.typeOf[id])).map(id => {
      const first = s.robberNights.find(x => x.id === id && x.gun);
      return first ? first.day : null;
    }))),
    // Robbers that ever held a gun at a lock, and how many of those work the Gunrunner trade (they build their own).
    guns: (() => {
      const all = seasons.flatMap(s => Object.keys(s.typeOf).filter(id => ROBBERS.includes(s.typeOf[id])).map(id => ({ armed: s.robberNights.some(x => x.id === id && x.gun), gunrunner: s.tradeOf[id] === 'gunrunner' })));
      return { robbers: all.length, armed: all.filter(x => x.armed).length, gunrunners: all.filter(x => x.armed && x.gunrunner).length };
    })(),
  };
  // The street at each lock, by night: medians across seasons.
  const street = [];
  for (let d = 1; d <= N.nights; d++) {
    const ns = seasons.map(s => s.nights.find(n => n.day === d)).filter(Boolean);
    street.push({
      day: d,
      empty: median(ns.map(n => n.homes.empty)), emptyCash: median(ns.map(n => n.homes.emptyCash)), emptyTake: median(ns.map(n => n.homes.emptyTake)),
      full: median(ns.map(n => n.homes.full)), fullCash: median(ns.map(n => n.homes.fullCash)),
      worn: median(ns.map(n => n.worn.value)), wornAgents: median(ns.map(n => n.worn.agents)), carried: median(ns.map(n => n.carried.value)),
      evictedCash: median(ns.map(n => n.evicted.cash)), crews: median(ns.map(n => n.crews.cash)), crate: median(ns.map(n => n.crate)), vault: median(ns.map(n => n.vault)),
      best: median(ns.map(n => n.best.value)), bestKind: mode(ns.map(n => n.best.kind)), wage: median(ns.map(n => n.wage)),
    });
  }
  // Every robber-seat's and hustler-seat's haul, under each valuation (R4-1).
  const seatHauls = (pick, v) => median(seasons.flatMap(s => Object.keys(s.typeOf).filter(id => pick(s.typeOf[id])).map(id => s.hauls[v][id])));
  const byValuation = f => Object.fromEntries(VALUATIONS.map(v => [v, f(v)]));
  // The crime bar under each valuation and both readings (passbars.mjs): as §27 words it (`crimePays`, the median robber
  // by haul, arrested) and the shadow reading (`crimeMedians`, the separate medians); a season's bars under a shadow
  // valuation are in its metrics' `shadow`.
  const barOf = (s, v, key) => (v === 'paid' ? s.metrics.bars[key] : s.metrics.shadow[v][key]);
  const crimeBar = byValuation(v => Object.fromEntries(['crimePays', 'crimeMedians'].map(key => [key, {
    count: seasonCount(seasons, s => !!barOf(s, v, key).pass),
    robberHaul: median(seasons.map(s => barOf(s, v, key).robberHaul)), hustleHaul: median(seasons.map(s => barOf(s, v, key).hustleHaul)),
    robberArrests: median(seasons.map(s => barOf(s, v, key).robberArrests)),
  }])));
  return {
    seasons: seasons.length, island, seats, order, crime, fenced, bounty, robbers, street,
    bounds: { loose: median(seasons.map(s => s.bounds.loose)), cool: median(seasons.map(s => s.bounds.cool)), robberHaul: byValuation(v => seatHauls(t => ROBBERS.includes(t), v)), hustleHaul: byValuation(v => seatHauls(t => t === 'hustle', v)) },
    crimeBar,
    rest: sum(seasons.flatMap(s => Object.values(s.books).map(b => Math.abs(b.rest)))),
  };
}
function mode(xs) {
  const c = {};
  for (const x of xs) if (x) c[x] = (c[x] || 0) + 1;
  return Object.keys(c).sort((x, y) => c[y] - c[x])[0] || null;
}

// --- the page ---------------------------------------------------------------------------------------------------------
const LABEL = {
  hustle: 'hustles', police: 'patrol/guard wage', collar: 'collars', flex: 'flex', street: 'street (dealing)', buyer: "city's buyer",
  goodsSold: 'goods sold to agents', muscle: 'hired as muscle', cuts: 'crew cuts', thefts: 'thefts (cash)', grabs: 'grabs (cash)',
  vault: 'vault jobs (cash)', bounty: 'bounties collected', fence: 'fence sales', crew: 'taken from crew stash', gifts: 'other pay in', refund: 'list refunds',
  rent: 'rent', list: 'list offers', fenceBuy: 'fence buys', goodsBought: 'goods bought', shop: "city's shop", bail: 'bail', bribe: 'bribes',
  lookout: 'lookouts', bountyPost: 'bounties posted', fine: 'fines (arrests)', robbed: 'robbed of', musclePaid: 'muscle paid', cutsPaid: 'cuts paid',
  crewPut: 'put in crew stash', giftsOut: 'other pay out', tab: 'rent tab at the dock',
};
export function page(sm, meta) {
  const L = [];
  L.push('# R3-1: the crime diagnosis (MOCK)', '');
  L.push(`${meta.cast} cast, ${meta.seeds}. ${meta.overrides ? `OVERRIDES: ${meta.overrides}. ` : ''}Command: \`${meta.command}\`.`, '');
  const cb = sm.crimeBar;
  L.push(`The crime bar, as §27 words it (the median robber by haul out-earns the median hustler, and was arrested at least once): ${countText(cb.paid.crimePays.count)} seasons; the median robber's haul ${money(cb.paid.crimePays.robberHaul)} against the median shift worker's ${money(cb.paid.crimePays.hustleHaul)}; the median robber's arrests ${cb.paid.crimePays.robberArrests} (medians across seasons). Haul is copy paid: each minted copy at that copy's own first sale on the list.`, '');
  L.push('| the crime bar, seasons passing · distinct | ' + VALUATIONS.map(v => (v === 'paid' ? 'copy paid (official)' : VALUED[v])).join(' | ') + ' |', `|---|${VALUATIONS.map(() => '---').join('|')}|`);
  L.push(`| as §27 words it: the median robber by haul, arrested | ${VALUATIONS.map(v => countText(cb[v].crimePays.count)).join(' | ')} |`);
  L.push(`| the shadow reading: the robbers' median haul, and the median of their arrests at least 1 | ${VALUATIONS.map(v => countText(cb[v].crimeMedians.count)).join(' | ')} |`);
  L.push(`| the median robber's haul / the robbers' median haul / the median hustler's (medians across seasons) | ${VALUATIONS.map(v => `${money(cb[v].crimePays.robberHaul)} / ${money(cb[v].crimeMedians.robberHaul)} / ${money(cb[v].crimePays.hustleHaul)}`).join(' | ')} |`);
  L.push(`| the median robber's arrests / the robbers' median arrests | ${VALUATIONS.map(v => `${cb[v].crimePays.robberArrests} / ${cb[v].crimeMedians.robberArrests}`).join(' | ')} |`, '');
  L.push('## Money onto and off the island (median season; all seasons)', '');
  L.push('| source | median | total | | sink | median | total |', '|---|---|---|---|---|---|---|');
  const ins = Object.entries(sm.island.in).sort((x, y) => y[1].total - x[1].total);
  const outs = Object.entries(sm.island.out).sort((x, y) => y[1].total - x[1].total);
  for (let i = 0; i < Math.max(ins.length, outs.length); i++) {
    const a = ins[i];
    const b = outs[i];
    L.push(`| ${a ? a[0] : ''} | ${a ? money(a[1].median) : ''} | ${a ? money(a[1].total) : ''} | | ${b ? b[0] : ''} | ${b ? money(b[1].median) : ''} | ${b ? money(b[1].total) : ''} |`);
  }
  L.push('');
  L.push('## Money by kind of seat (mean a seat a season; haul a median)', '');
  const cols = sm.order;
  L.push(`| flow | ${cols.map(t => `${t} (${sm.seats[t].seats})`).join(' | ')} |`, `|---|${cols.map(() => '---').join('|')}|`);
  for (const k of [...IN, ...OUT]) {
    if (cols.every(t => !sm.seats[t].flows[k])) continue;
    L.push(`| ${OUT.includes(k) ? '−' : '+'} ${LABEL[k]} | ${cols.map(t => money(sm.seats[t].flows[k])).join(' | ')} |`);
  }
  L.push(`| haul (median; copy paid) | ${cols.map(t => money(sm.seats[t].haul)).join(' | ')} |`);
  for (const v of SHADOWS) L.push(`| ↳ haul, ${VALUED[v]} | ${cols.map(t => money(sm.seats[t].hauls[v])).join(' | ')} |`);
  L.push(`| arrests a seat (mean) | ${cols.map(t => (sm.seats[t].arrests == null ? 'n/a' : sm.seats[t].arrests.toFixed(2))).join(' | ')} |`);
  L.push(`| arrested at least once | ${cols.map(t => pct(sm.seats[t].arrestedOnce)).join(' | ')} |`);
  L.push('', `Books closed against every seat's last cash; unexplained by any event, all seats, all seasons: ${money(sm.rest)}.`, '');
  L.push('## Each crime (all seasons)', '');
  L.push('| crime | tried | found its target | won | arrested in the fight | arrested within 2 nights | mean take a try | mean take a win | median strength vs defence | mean group | the hustle take that night | by seat |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, c] of Object.entries(sm.crime)) {
    L.push(`| ${k} | ${c.tried} | ${c.found} | ${c.won} | ${c.arrestedThere} | ${c.arrestedSoon} | ${money(c.meanTake)} | ${money(c.won ? (c.meanTake * c.tried) / c.won : null)} | ${c.medianStrength ?? 'n/a'} vs ${c.medianDefence ?? 'n/a'} | ${c.meanGroup == null ? 'n/a' : c.meanGroup.toFixed(1)} | ${money(c.meanWage)} | ${Object.entries(c.byType).sort((x, y) => y[1] - x[1]).map(([t, n]) => `${t} ${n}`).join(', ')} |`);
  }
  L.push('', `A deal's take is the corner's takings less its doses at $${STREET.unit}; a won deal is a night it sold. Stolen pieces: ${sm.fenced.stolenPieces}, ${sm.fenced.sold} sold at the fence for ${money(sm.fenced.cash)}, ${sm.fenced.minted} minted. Bounties: ${sm.bounty.posted} posted (${money(sm.bounty.postedCash)}), ${sm.bounty.collected} collected (${money(sm.bounty.collectedCash)}).`, '');
  L.push("## The robbers' nights (scout and guesser), by what decided them", '');
  const r = sm.robbers;
  L.push('| what decided the night | robber-nights | share |', '|---|---|---|');
  for (const [k, n] of Object.entries(r.why)) L.push(`| ${k} | ${n} | ${pct(n / r.nights)} |`);
  L.push('', `Armed (a gun or brass knuckles) on ${pct(r.armed)} of free nights; median cash at the lock ${money(r.cashAtLock)}; median night a robber first holds a gun: ${r.gunNight ?? 'never'}; ${r.guns.armed} of ${r.guns.robbers} robbers ever held one, ${r.guns.gunrunners} of them working the Gunrunner trade. On the ${r.best2.nights} nights it didn't rob, a strength-2 group would have found a target on ${r.best2.withTarget}, worth a median ${money(r.best2.median)} (${Object.entries(r.best2.kinds).map(([k, n]) => `${k} ${n}`).join(', ')}).`, '');
  L.push('## On the street at each lock (medians across seasons)', '');
  L.push('| night | homes empty | cash in empty homes | a break-in each would take | homes with someone in | their cash | worn out (rarest each) | goods carried | evicted cash | crew stashes | crate | vault | best single take, strength 2 | wage |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const n of sm.street) {
    L.push(`| ${n.day} | ${n.empty} | ${money(n.emptyCash)} | ${money(n.emptyTake)} | ${n.full} | ${money(n.fullCash)} | ${money(n.worn)} (${n.wornAgents}) | ${money(n.carried)} | ${money(n.evictedCash)} | ${money(n.crews)} | ${money(n.crate)} | ${money(n.vault)} | ${money(n.best)} (${n.bestKind || '-'}) | ${money(n.wage)} |`);
  }
  L.push('', `## The upper bound`, '');
  L.push(`One armed robber (strength 2, alone, not wanted) with full information, a median season: every night's best single take summed ${money(sm.bounds.loose)}; never wanted (a crime a star, a hustle or a night in to cool off) ${money(sm.bounds.cool)}. The median robber-seat's haul ${money(sm.bounds.robberHaul.paid)}, the median shift-seat's ${money(sm.bounds.hustleHaul.paid)} (copy paid; ${SHADOWS.map(v => `${VALUED[v]} ${money(sm.bounds.robberHaul[v])} and ${money(sm.bounds.hustleHaul[v])}`).join('; ')}).`, '');
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const usage = 'node core/bench/crime.mjs --seeds 404-423 --rules A,B --out core/runs/r3-diag [--cast layer4] [--set key=value ...]';
  const args = argsOrExit(process.argv.slice(2), { seeds: 'value', rules: 'value', out: 'value', cast: 'value', set: 'list' }, usage);
  const overrides = parseSet(args.set);
  const mix = mixOrExit({ cast: args.cast || 'layer4' }, usage);
  const [lo, hi] = (args.seeds || '404-423').split('-').map(Number);
  const seeds = Array.from({ length: (hi || lo) - lo + 1 }, (_, i) => lo + i);
  const rules = (args.rules || 'A,B').split(',');
  const outDir = path.resolve(args.out || path.join(here, '..', 'runs', 'r3-diag'));
  const { makeCast } = await import('./bots.mjs');
  const seasons = [];
  for (const rule of rules) {
    for (const seed of seeds) {
      fs.rmSync(path.join(outDir, `${seed}-${rule}`), { recursive: true, force: true });
      seasons.push(season({ seed, rule, outDir, overrides, mix, cast: makeCast(seed, mix) }));
    }
  }
  const sm = summary(seasons);
  const bench = summarize(seasons.map(s => s.metrics));
  const benchMeta = { seeds: `Seeds ${lo}-${hi || lo} under rules ${rules.join(' and ')}: ${seasons.length} seasons.`, overrides, squatter: 0, cast: castName(mix) };
  fs.writeFileSync(path.join(outDir, 'SUMMARY.md'), summaryMarkdown(bench, benchMeta));
  fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ OVERRIDES: overrides, meta: benchMeta, ...bench, perSeason: seasons.map(r => ({ seed: r.seed, rule: r.rule, midseason: r.metrics.midseason, bars: r.bars })) }, null, 1)}\n`);
  const meta = {
    cast: castName(mix), seeds: `seeds ${lo}-${hi || lo} under rules ${rules.join(' and ')}, ${seasons.length} seasons`,
    overrides: Object.entries(overrides).map(([k, v]) => `${k}=${v}`).join(', '), command: `node core/bench/crime.mjs ${process.argv.slice(2).join(' ')}`,
  };
  fs.writeFileSync(path.join(outDir, 'crime.json'), `${JSON.stringify({ meta, summary: sm, seasons: seasons.map(s => ({ seed: s.seed, rule: s.rule, bars: s.bars, crimePays: s.crimePays, bounds: s.bounds })) }, null, 1)}\n`);
  fs.writeFileSync(path.join(outDir, 'CRIME.md'), `${page(sm, meta)}\n`);
  console.log(page(sm, meta));
}
