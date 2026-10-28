// The night: (state, every play) -> (state, events). GAME.md §5's order, layer 1 only (§24):
//   the lock (the fence's deals land, the city's shop and buyer fill the day's orders together (R4-3), then the plays
//   lock: jail, a crash or a withdrawal, TRUTH's locked play, SUDO's written play, then the agent's own play),
//   1. the list's offers, 2. every play at once (TEMP's +1 counts here; the vault's fight is last), 3. takes land (the
//   vault's as it stood at the lock; lockpicks and warrants are used up, and a double-sell shows), then arrests (a won
//   collar's first, its Cop paid out of the fine, then the bounties pay; CLEAR seizes nothing; a seizure is public at
//   dawn), 4. work pays (a guard's too), 5. heat, and anyone at 5 stars is arrested (a listed piece gone from its seller
//   ends its listing), 6. police levels for tomorrow and the city's prices ease back, 7. dawn: buys arrive, rent is due,
//   an evicted agent's rent tab runs up, and highs end, streaks and hooks update and tomorrow's crashes are set.
// Night 14 ends with the walk to the dock, the bounties still open gone with the ferry, the tabs settled there, the
// ferry and the mint (§15); the fence settles nothing that night.
import { N } from '../numbers.mjs';
import {
  clone, emit, toAll, toFew, toFewUntil, DAY15, LAST_NIGHT, DISTRICTS, LEVELS, agentIds, byId, half,
  cashIn, cashOut, piecesOf, crewPieces, wornOf, unwornOf, wears, rarest, moveCopy, levelTonight, lastPrice, copyPaid,
  bookGoods, sortGoods, addGoods, moveGoods, HOMES, holdingsOf, DRUGS, dosesUpTo, rehome, stashOn, ROUTES, promiseState,
  HUSTLE_HOW, hustleTake, hustleStar,
} from './state.mjs';
import { resolveFights } from './fights.mjs';
import { priceOf, marketItems, cornerTakings, dropSplit, clearingOf, gathers } from './market.mjs';
import { checkPlay, defaultPlay, typedPlay, forcedPlay, onRecord, originOf } from './plays.mjs';
import { settleFence, returnFence, endLost } from './fence.mjs';
import { endDeals } from './deals.mjs';

// plays: { agentId: { kind, place, target, want, reason } }. Jailed agents have none; a missing or invalid play becomes
// the default play, typed and logged (§27).
// opts.ignorePlaces: the bench's counterfactual for "places matter" (§27).
export function settleNight(s0, plays = {}, opts = {}) {
  const n = s0.day;
  if (s0.over || n < 1 || n > LAST_NIGHT || s0.clock !== 2 * n) throw new Error(`no night to settle (day ${s0.day}, clock ${s0.clock})`);
  // A value of GAP gap.evictedHit or gap.rentTab, or of R3-2's switches, the rules don't know (a typo in --set) fails
  // here, before anything moves.
  evictedCarries();
  tabOn();
  crimeSwitches();
  crewFits();
  const s = clone(s0);
  const out = [];
  s.clock = 2 * n + 1;
  const last = n === LAST_NIGHT;
  const ids = agentIds(s);
  // §19: private now, public 24 hours later; the last night's private record goes public on day 15.
  const secret = few => (last ? toFewUntil(few, DAY15) : toFew(s, few));

  // §9: the fence holds a swap's halves until the lock, and every deal lands there, first, so tonight's plays and fights
  // find what it moved where it landed (GAP gap.fence).
  if (!last) settleFence(s, out, n);
  // §15: on the last night everything your agent owns goes with it, and the crew stash goes aboard with whoever's home
  // it's in. The fence settles nothing tonight: every listing ends, and all it holds goes back first (GAP gap.fence).
  if (last) {
    returnFence(s, out, secret);
    for (const c of Object.values(s.crews).sort((x, y) => byId(x.id, y.id))) {
      const keeper = s.agents[c.keeper];
      if (keeper.jail) continue;
      const pieces = crewPieces(s, c.id);
      for (const k of pieces) moveCopy(s, k, { k: 'agent', id: keeper.id }, 'aboard', { crew: c.id });
      keeper.cash += c.cash;
      emit(s, out, 'stash', { act: 'aboard', crew: c.id, agent: keeper.id, copies: pieces, cash: c.cash }, secret(c.members));
      c.cash = 0;
    }
  }
  // §9 (R4-3): the city's shop and buyer fill the day's orders together, so tonight's plays find what they brought, and
  // dawn's rent the cash. `short`: what each agent's orders at the shop didn't bring, so a cook or a build that counted
  // on them works with what came, never invalid for it (GAP gap.marketOrder).
  const short = clearMarket(s, out, n);

  // The lock: one play each. Jail first (no play), then a crash or a withdrawal forces the default play, then TRUTH's
  // locked play, then SUDO's written play, each typed as forced, never invalid (§11, GAP gap.forced); then the agent's
  // own play, checked. A written play carries no reason (GAP gap.sudo). A HALLU cook's lies are on no play's record
  // (GAP gap.hallu). Who made a play goes on the record of the play it came with: on the play when it's played, else on
  // the invalid or forced record's play (GAP gap.origin).
  const P = {};
  const written = new Set();
  for (const id of ids) {
    if (s.agents[id].jail) continue;
    const opts = { short: short[id] };
    const forced = forcedPlay(s, id, n, opts);
    const res = forced ? null : checkPlay(s, id, plays[id], n, opts);
    P[id] = forced ? forced.play : res.ok ? res.play : defaultPlay(s, id, n);
    // §8, §11 (GAP gap.accept): a crash or a withdrawal forces the default play, never whom the agent accepts: an agent
    // that sends that very play, naming whom it accepts, plays it as sent.
    if (forced && (forced.why === 'crash' || forced.why === 'withdrawal')) {
      const sent = checkPlay(s, id, plays[id], n, opts);
      if (sent.ok && sent.play.kind === forced.play.kind && sent.play.place === forced.play.place) P[id] = sent.play;
    }
    if (forced || !res.ok) {
      const why = forced ? { why: forced.why } : { why: res.why, kind: res.kind };
      emit(s, out, forced ? 'forced' : 'invalid', { agent: id, play: typedPlay(s, plays[id]), ...why, instead: onRecord(P[id]) }, secret([id]));
    }
    if (forced && forced.why === 'sudo') written.add(id);
    const own = !written.has(id) && plays[id] && typeof plays[id].reason === 'string';
    const reason = own ? plays[id].reason.slice(0, N['gap.lineLength']) : '';
    emit(s, out, 'play', { agent: id, ...onRecord(P[id]), reason, ...(res && res.ok ? originOf(plays[id]) : {}) }, secret([id]));
  }
  const lock = clone(s);

  // 1. The list's offers (§3), after the lock, which the fights read; their copies arrive at dawn.
  if (n <= N.listLastNight) settleList(s, out, n);

  // 2. Every play at once, from what everyone had at the lock (§8).
  const agentsIn = {};
  for (const id of ids) {
    const a = lock.agents[id];
    agentsIn[id] = {
      home: !a.evicted, jailed: !!a.jail, crew: a.crew, wanted: a.heat >= N.wantedAt, heat: a.heat,
      knuckles: wears(lock, id, 'knuckles'), runners: wears(lock, id, 'runners'),
      gun: (a.goods.guns || 0) > 0, lockpick: (a.goods.lockpicks || 0) > 0, temp: a.high.includes('temp'),
    };
  }
  const levels = Object.fromEntries(DISTRICTS.map(d => [d, levelTonight(s, d, n)]));
  // §15: on the last night everyone walks to the dock, and a back that leads to nobody walking takes the default
  // play's route (gap.defaultPlay, gap.chainedBack).
  const walk = last ? id => defaultPlay(lock, id, n).place : null;
  const R = resolveFights({
    agents: agentsIn, plays: P, levels, rule: s.rule, ignorePlaces: !!opts.ignorePlaces, corners: lock.corners, tips: lock.tips, bribes: lock.bribes, walk,
    night: n,
  });
  show(s, out, P, R, n);
  // §12: a right tip on a fight the tipper's crewmates attack in is a rat, and those crewmates are its victims (GAP
  // gap.tip): the rat's and theirs now, everyone's 24 hours later.
  for (const f of R.fights) {
    for (const by of f.tippers || []) {
      const crew = agentsIn[by].crew;
      const victims = crew ? f.attackers.flatMap(g => g.members).filter(m => m !== by && agentsIn[m].crew === crew).sort(byId) : [];
      if (victims.length) emit(s, out, 'betray', { kind: 'rat', by, victims, crew, night: n, target: f.target, place: f.place }, secret([by, ...victims]));
    }
  }
  const carried = workOut(s, lock, out, P, n);
  // R3-2's option (GAP gap.holdup, 'pay'): what each worker's work pays tonight, which a won hit on it takes (none for
  // an agent arrested tonight, R3-2c); and who was held up, paid at the take, whom step 4 doesn't pay again.
  const pay = N['gap.holdup'] === 'pay' ? nightPay(s, P, R, carried, n) : {};
  const heldUp = new Set();

  // 3. Takes land first, then arrests, so an agent arrested the night it stole is caught with the goods.
  // The guard stops the night loudly if a copy were ever taken twice, or seized twice (§23: one holder at every moment).
  const guard = { taken: new Set(), seized: new Set() };
  // The pieces and cash each won hit, break-in or vault job took, for the bounties (GAP gap.bounty).
  const took = new Map();
  for (const f of R.fights) {
    if (f.winner && (f.kind === 'hit' || f.kind === 'breakin')) took.set(f, take(s, lock, out, f, P, n, secret, guard, carried, pay, heldUp));
    if (f.winner && f.kind === 'grab') grabCrate(s, out, f, n, secret);
    if (f.winner && f.kind === 'vault') took.set(f, jobVault(s, lock, out, f, n, secret));
    // §8: a break-in's lockpick is used up, won or lost (GAP gap.gear); §13: so is each vault group's leader's warrant,
    // and its `used` names the warrant's maker (GAP gap.vault, gap.warrants).
    const used = f.kind === 'breakin' ? f.attackers.filter(g => g.lockpick).map(g => [g.lockpick, 'lockpicks'])
      : f.kind === 'vault' ? f.attackers.map(g => [g.leader, 'warrants']) : [];
    const makers = {};
    for (const [id, kind] of used) {
      const [lot] = addGoods(s.agents[id], kind, -1);
      bookGoods(s, 'out', 'used', kind, 1);
      emit(s, out, 'used', { night: n, agent: id, goods: { [kind]: 1 }, ...(kind === 'warrants' ? { maker: lot ? lot.maker : null } : {}) }, secret([id]));
      if (lot) (makers[lot.maker] ||= []).push(id);
    }
    // §12: a double-sell is tonight's vault groups whose leaders' warrants share a maker, when those leaders aren't all
    // in one crew (crews at the lock): one act by the maker, whose victims are those leaders; theirs and the maker's
    // now, as a rat is (GAP gap.doubleSell).
    for (const by of Object.keys(makers).sort(byId)) {
      const victims = makers[by].filter(m => m !== by).sort(byId);
      if (new Set(makers[by].map(m => lock.agents[m].crew || m)).size > 1) emit(s, out, 'betray', { kind: 'double-sell', by, victims, night: n, place: f.place }, secret([by, ...victims]));
    }
  }
  const crimes = {};
  const districtCrimes = {};
  for (const f of R.fights) {
    if (f.kind === 'corner' || f.kind === 'collar') continue;
    for (const g of f.attackers) {
      // §13: a vault job is +2 stars for every member, a hit, a break-in or a grab +1; each group is one crime (§6).
      for (const m of g.members) crimes[m] = (crimes[m] || 0) + (f.kind === 'vault' ? N.vault.heat : 1);
      districtCrimes[f.place] = (districtCrimes[f.place] || 0) + 1;
    }
  }
  // Bail stars (GAP): the heat at the lock plus the crime that got you arrested. A won collar's arrest comes first,
  // and its Cop is paid $100 a star out of the arrest's fine, the rest going to the vault (§13, GAP gap.collar,
  // gap.collarPay).
  const starsOf = m => Math.max(1, Math.min(N.maxHeat, lock.agents[m].heat + (crimes[m] || 0)));
  const collared = {};
  for (const f of R.fights) {
    if (f.kind !== 'collar' || !f.winner || s.agents[f.target].jail) continue;
    const stars = starsOf(f.target);
    const seized = arrest(s, out, f.target, 'collar', stars, n, f.place, guard, { by: f.winner }, f.winner);
    collared[f.winner] = { target: f.target, stars, fine: seized.fine, ...collarPay(s, f.target, stars, seized) };
  }
  payBounties(s, lock, out, R.fights, took, n, secret);
  for (const f of R.fights) {
    for (const m of f.arrested) arrest(s, out, m, 'fight', starsOf(m), n, f.place, guard);
  }

  // 4. Work pays, into your stash: a worker held up tonight was paid its cash work's pay at the take, and the robber took
  //    it there. Hustles first (R11), then the trades; each says the work heat it adds.
  const workHeat = last ? {} : { ...payHustles(s, out, P, n, heldUp), ...payTrades(s, lock, out, P, R, carried, n, collared, heldUp) };

  // 5. Heat changes (§13): every crime adds stars, backers get the same; it falls 1 a night without a crime, 2 if you
  //    lay low. Anyone at 5 stars is arrested (on the last night, at the dock).
  for (const id of ids) {
    const a = s.agents[id];
    if (a.jail || !P[id]) continue;
    const was = a.heat;
    const stars = (crimes[id] || 0) + (workHeat[id] || 0);
    // R3-2's option (GAP gap.cool): a quiet night takes N['gap.cool'] stars off, laying low one more (§13: 1 and 2).
    a.heat = stars ? Math.min(N.maxHeat, a.heat + stars) : Math.max(0, a.heat - N['gap.cool'] - (P[id].kind === 'laylow' ? 1 : 0));
    if (a.heat !== was) emit(s, out, 'heat', { agent: id, heat: a.heat, was, wanted: a.heat >= N.wantedAt }, toAll(s));
  }
  for (const id of ids) {
    if (!s.agents[id].jail && s.agents[id].heat >= N.maxHeat) arrest(s, out, id, last ? 'dock' : 'heat', N.maxHeat, n, null, guard);
  }
  // A listed piece taken or seized tonight ends its listing (GAP gap.listed).
  endLost(s, out, secret);

  // A turn shows at the lock: a promise to back someone tonight, then backing the other side (§12).
  turns(s, out, P, R, n, secret, written);

  if (last) {
    bountiesGone(s, out, secret);
    const beforeDawn = boardAndMint(s, out, R);
    return { state: s, events: out, fights: R, plays: P, beforeDawn };
  }

  // 6. Police levels for tomorrow (§6), and the city's shop and buyer ease back (§9; GAP gap.marketOrder).
  pushBack(s, out, districtCrimes);
  easeMarket(s, out);

  // 7. Dawn. The independent snapshot and event prefix let the public record read the board at the show.
  const beforeDawn = { state: clone(s), eventCount: out.length };
  dawn(s, out, P, R, n);
  return { state: s, events: out, fights: R, plays: P, beforeDawn };
}

// §3: if more agents offer than there are copies left, the highest offers win; an exact tie for the last copy means
// nobody gets it tonight. Winners pay what they offered; everyone else gets their cash back. Prices fall 10% after an
// open night with no sale, never below the floor, and rise 20% after a night with one.
function settleList(s, out, n) {
  for (const tid of Object.keys(s.traits).sort(byId)) {
    const t = s.traits[tid];
    if (t.opens > n) continue;
    const offers = s.offers.filter(o => o.trait === tid).sort((x, y) => y.amount - x.amount || byId(x.by, y.by));
    const left = t.copies.filter(k => s.copies[k].holder.k === 'list').sort(byId);
    const winners = offers.length <= left.length ? offers : offers.filter(o => o.amount > offers[left.length].amount);
    winners.forEach((o, i) => {
      s.pending.push({ copy: left[i], to: o.by, price: o.amount, trait: tid });
      cashOut(s, 'list', o.amount);
    });
    for (const o of offers) {
      if (winners.includes(o)) continue;
      s.agents[o.by].cash += o.amount;
      emit(s, out, 'refund', { agent: o.by, trait: tid, amount: o.amount }, toFew(s, [o.by]));
    }
    const was = t.price;
    if (winners.length) {
      t.price = Math.round(t.price * (1 + N.priceRise));
      // GAP: when several copies sell the same night, the trait's "last sold for" is the lowest winning offer.
      t.last = winners[winners.length - 1].amount;
    } else {
      t.price = Math.max(t.floor, Math.round(t.price * (1 - N.priceFall)));
    }
    if (t.price !== was) emit(s, out, 'price', { trait: tid, price: t.price, was }, toAll(s));
  }
  // The fence holds its cash here too, a swap's and a bounty's (§10, §22); each settles its own.
  s.offers = s.offers.filter(o => !o.trait);
}

// §19, §20: the city plays the night as a show. Every play and its place is public, except that attackers in hits and
// break-ins show hooded. Fights show their sides as counts and strengths, a patrol's or the guards' strength (never
// who), and that a fight was tipped, never who tipped (a bribe shows only as no cops).
function show(s, out, P, R, n) {
  const attacking = new Set();
  for (const id of Object.keys(P)) {
    if (P[id].kind === 'hit' || P[id].kind === 'breakin') attacking.add(id);
  }
  for (const id of Object.keys(P)) {
    if (P[id].kind === 'back' && attacking.has(P[id].target) && !R.idle.includes(id)) attacking.add(id);
  }
  const seen = {};
  const hooded = {};
  for (const id of Object.keys(P).sort(byId)) {
    const w = R.where[id];
    if (attacking.has(id)) hooded[w.place] = (hooded[w.place] || 0) + 1;
    else seen[id] = w.at === 'home' ? 'home' : w.place;
  }
  emit(s, out, 'show', { night: n, seen, hooded }, toAll(s));
  for (const f of R.fights) {
    emit(s, out, 'fight', {
      night: n, kind: f.kind, ...(f.corner ? { corner: f.corner } : {}), target: f.target, place: f.place, level: f.level,
      sides: f.attackers.map(g => ({ size: g.members.length, strength: g.strength })),
      defence: f.defence, cops: f.cops, ...(f.patrol ? { patrol: f.patrol } : {}), ...(f.guard ? { guard: f.guard } : {}), won: !!f.winner, backingDecided: f.backingDecided,
      ...(f.tipped ? { tipped: true } : {}),
    }, toAll(s));
  }
}

// GAP gap.evictedHit, the two readings: 'worn + half cash' (§7 as written: the rarest piece it wears) and 'carried +
// half cash' (§10's "everything you own is on you": everything it carries, as on the last night). 'carried' is short
// for the second. True when a hit on an evicted agent reaches everything it carries.
function evictedCarries() {
  const v = N['gap.evictedHit'];
  if (v === 'worn + half cash') return false;
  if (v === 'carried + half cash' || v === 'carried') return true;
  throw new Error(`gap.evictedHit: no such value ${JSON.stringify(v)}; use 'worn + half cash' or 'carried + half cash'`);
}

// R3-2's switches (trunk docs/briefs/R3-crime-pays.md): GAP gap.holdup ('off' or 'pay'), GAP gap.jump (a whole number
// of strength, or R3-2c's 'alone'), breakinShare (a share from 0 to 1), GAP gap.fine ('half' or 'stars'), GAP gap.purse
// ('off' or 'half'), GAP gap.ferryJail ('missed' or 'released') and GAP gap.cool (a whole number of stars). Since R3-3
// slime's picks are the defaults (GAME.md §41): 'pay', no jump, the whole stash and 'released'; the rest are off. R4-4's
// GAP gap.collarPay: 'fine' (the rule), 'once' or 'stars' (collarPay).
function crimeSwitches() {
  const bad = (key, v, want) => {
    throw new Error(`${key}: no such value ${JSON.stringify(v)}; use ${want}`);
  };
  if (!['off', 'pay'].includes(N['gap.holdup'])) bad('gap.holdup', N['gap.holdup'], "'off' or 'pay'");
  if (!((Number.isInteger(N['gap.jump']) && N['gap.jump'] >= 0) || N['gap.jump'] === 'alone')) bad('gap.jump', N['gap.jump'], "a whole number, 0 or more, or 'alone'");
  if (!(typeof N.breakinShare === 'number' && N.breakinShare >= 0 && N.breakinShare <= 1)) bad('breakinShare', N.breakinShare, 'a share from 0 to 1');
  if (!['half', 'stars'].includes(N['gap.fine'])) bad('gap.fine', N['gap.fine'], "'half' or 'stars'");
  if (!['off', 'half'].includes(N['gap.purse'])) bad('gap.purse', N['gap.purse'], "'off' or 'half'");
  if (!['missed', 'released'].includes(N['gap.ferryJail'])) bad('gap.ferryJail', N['gap.ferryJail'], "'missed' or 'released'");
  if (!(Number.isInteger(N['gap.cool']) && N['gap.cool'] >= 1)) bad('gap.cool', N['gap.cool'], 'a whole number, 1 or more');
  if (!['fine', 'once', 'stars'].includes(N['gap.collarPay'])) bad('gap.collarPay', N['gap.collarPay'], "'fine', 'once' or 'stars'");
}

// §8 (GAP gap.accept): a leader with no list accepts its crewmates, and a whole crew fits in one group only while
// crewMax is at most groupMax. Past that, the crewmates' order would decide who's in, and nothing but their ids gives
// one, so numbers that allow it (a typo in --set, or a bigger crew) fail here, before anything moves.
function crewFits() {
  if (!(Number.isInteger(N.crewMax) && Number.isInteger(N.groupMax) && N.crewMax <= N.groupMax)) {
    throw new Error(`crewMax ${JSON.stringify(N.crewMax)} and groupMax ${JSON.stringify(N.groupMax)}: a crew must fit in one group (crewMax at most groupMax), or its default acceptance would need an order (gap.accept)`);
  }
}

// §9, R3-2's option (GAP gap.holdup, 'pay'): the cash each agent's work pays tonight, as step 4 will pay it, with its
// source: a hustle's take (R11), a Cop's patrol or guard wage (Payday doubles both), and a Dealer's takings for the doses it
// carries to a corner it deals on. { id: { source, cash } }. R3-2c: step 4 pays nobody arrested in tonight's fights
// (§13), a won collar's target and a lost fight's arrested, so their work pays nothing tonight, and a hit on one takes
// what it takes with the switch off.
function nightPay(s, P, R, carried, n) {
  const out = {};
  const payday = n === 7 && s.midseason === 'payday' ? 2 : 1;
  const hustles = hustlesOf(s, P, n);
  const jailed = new Set(R.fights.flatMap(f => (f.kind === 'collar' ? (f.winner ? [f.target] : []) : f.arrested)));
  for (const id of Object.keys(P)) {
    if (jailed.has(id)) continue;
    const p = P[id];
    if (p.kind === 'hustle') out[id] = { source: 'hustle', cash: hustles[id].take };
    else if (p.kind === 'patrol' || p.kind === 'guard') out[id] = { source: p.kind, cash: N.copPay[p.kind] * payday };
    else if (p.kind === 'deal' && R.deals[p.corner] === id) {
      const doses = DRUGS.reduce((t, d) => t + ((carried[id] || {})[d] || 0), 0);
      if (doses) out[id] = { source: 'street', cash: cornerTakings(doses, N.corners[p.corner].hot) };
    }
  }
  return out;
}

// GAP gap.rentTab: 'dock' (a night spent evicted runs up the rent on a tab, settled at the dock) or 'off' (no tab).
// True when the tab is on.
function tabOn() {
  const v = N['gap.rentTab'];
  if (v === 'dock') return true;
  if (v === 'off') return false;
  throw new Error(`gap.rentTab: no such value ${JSON.stringify(v)}; use 'dock' or 'off'`);
}

// A won fight's take goes to the agent whose play it was (§8 "the bag"). Returns what it took: the piece, if any, and
// the cash. R3-2's options: a hit's take includes its target's pay tonight (`pay`, GAP gap.holdup), and the target goes
// into `heldUp`; a break-in takes breakinShare of the cash in the home.
function take(s, lock, out, f, P, n, secret, guard, carried, pay = {}, heldUp = new Set()) {
  const last = n === LAST_NIGHT;
  const leader = f.winner;
  const victim = f.target;
  const was = lock.agents[victim];
  const members = f.attackers.find(g => g.leader === leader).members;
  const want = P[leader].want;
  const masked = wears(lock, leader, 'skimask');
  let pieces;
  let cash = 0;
  let crew = null;
  let crewCash = 0;
  let held = 0;
  // The purses of the evicted guests a break-in finds, [holder, the half it takes], and who they are.
  const guests = [];
  const told = [];
  if (f.kind === 'hit') {
    // §4 placeholder, the vest: once a season, a won hit on you takes nothing.
    if (wears(lock, victim, 'vest') && !s.agents[victim].vestUsed) {
      s.agents[victim].vestUsed = true;
      emit(s, out, 'rob', { night: n, leader, members, target: victim, place: f.place, copy: null, trait: null, cash: 0, value: 0, vest: true }, secret(members));
      emit(s, out, 'robbed', { night: n, agent: victim, by: masked ? null : leader, kind: 'hit', place: f.place, copy: null, trait: null, cash: 0, vest: true }, secret([victim]));
      return { copies: [], cash: 0 };
    }
    // §7: the rarest real piece it wears, and half its cash on the last night or if it's been evicted. §15: on the
    // last night, the rarest real piece it carries, worn or bagged. Evicted, GAP gap.evictedHit: §7's "wears", or, as
    // 'carried', what it carries, as on the last night, since "everything you own is on you" (§10).
    const carried = last || (was.evicted && evictedCarries());
    pieces = carried ? piecesOf(lock, victim) : wornOf(lock, victim);
    // R3-2's option (GAP gap.purse, 'half'): half its cash on any night, of what a break-in tonight left it (break-ins
    // land first); under §7 as written no agent loses cash to two takes in one night.
    if (last || was.evicted || N['gap.purse'] === 'half') cash = half(Math.min(was.cash, s.agents[victim].cash));
    // R3-2 (GAP gap.holdup, 'pay'): the cash its work pays tonight. R3-2c: the source pays it to the worker, as step 4
    // would, and the take moves it on to the robber, so the work's own event and the rob each tell a move that happened.
    if (pay[victim]) {
      held = pay[victim].cash;
      s.agents[victim].cash += held;
      cashIn(s, pay[victim].source, held);
      heldUp.add(victim);
    }
    // Carried, a stash with no member's home travels with its keeper, so the hit reaches what a break-in at its home
    // would (GAP gap.crewStash). On the last night the stash is already aboard with the keeper.
    const c = carried && !last && stashOn(lock, victim);
    if (c) {
      crew = c.id;
      pieces = pieces.concat(crewPieces(lock, c.id));
      crewCash = half(c.cash);
    }
  } else {
    // §7: the rarest real piece inside (the stashes, and what anyone home is wearing) and half the cash there. An
    // evicted guest has no home, so everything it owns is inside with it (§10): its pieces, worn or bagged, half its
    // cash, and a stash that travels with it (GAP gap.crewStash).
    pieces = unwornOf(lock, victim);
    const c = was.crew && lock.crews[was.crew];
    const share = x => Math.floor(x * N.breakinShare);
    if (c && c.keeper === victim) {
      crew = c.id;
      pieces = pieces.concat(crewPieces(lock, c.id));
      crewCash = share(c.cash);
    }
    for (const d of f.defenders) {
      if (!lock.agents[d].evicted) {
        pieces = pieces.concat(wornOf(lock, d));
        continue;
      }
      const g = stashOn(lock, d);
      pieces = pieces.concat(piecesOf(lock, d), g ? crewPieces(lock, g.id) : []);
      guests.push([s.agents[d], half(lock.agents[d].cash)], ...(g ? [[s.crews[g.id], half(g.cash)]] : []));
      told.push(d);
    }
    cash = share(Math.min(was.cash, s.agents[victim].cash));
  }
  const total = guests.reduce((t, [, k]) => t + k, cash + crewCash + held);
  const piece = rarest(lock, [...new Set(pieces)].sort(byId), want);
  const pieceValue = piece ? copyPaid(lock, piece) : 0;
  const value = total + pieceValue;
  const mark = total + (piece ? lastPrice(lock, piece) : 0);
  let from = victim;
  if (piece) {
    if (guard.taken.has(piece)) throw new Error(`LEDGER GUARD: ${piece} taken twice on night ${n}`);
    guard.taken.add(piece);
    from = lock.copies[piece].holder.k === 'crew' ? `crew:${lock.copies[piece].holder.id}` : lock.copies[piece].holder.id;
    moveCopy(s, piece, { k: 'agent', id: leader }, f.kind === 'hit' ? 'rob' : 'burgle', { from, night: n, place: f.place });
    s.agents[leader].carry.push(piece);
  }
  s.agents[victim].cash -= cash + held;
  if (crew) s.crews[crew].cash -= crewCash;
  for (const [h, k] of guests) h.cash -= k;
  s.agents[leader].cash += total;
  // §7: a hit takes the goods its target carries tonight too (GAP gap.carried); a break-in takes none. R3-2 (GAP
  // gap.holdup): a Dealer held up keeps its doses to deal, and the robber has the takings instead.
  const dealt = heldUp.has(victim) && P[victim].kind === 'deal';
  const goods = f.kind === 'hit' && carried[victim] && !dealt ? sortGoods(carried[victim]) : {};
  moveGoods(s.agents[victim], s.agents[leader], goods);
  if (f.kind === 'hit' && carried[victim] && !dealt) carried[victim] = {};
  const took = Object.keys(goods).length ? { goods } : {};
  const type = f.kind === 'hit' ? 'rob' : 'burgle';
  const trait = piece ? lock.copies[piece].trait : null;
  const tier = piece ? lock.copies[piece].tier : null;
  emit(s, out, type, {
    night: n, leader, members, target: victim, place: f.place, copy: piece, trait, tier, from, cash: total, value, pieceValue, mark, valueBasis: 'copy-paid', ...took,
  }, secret(members));
  // §19: the victim, and any evicted guest the break-in found, learn who at dawn, unless the robber wore the ski mask.
  const victims = [...(crew ? [victim, ...lock.crews[crew].members] : [victim]), ...told];
  emit(s, out, 'robbed', {
    night: n, agent: victim, by: masked ? null : leader, kind: f.kind, place: f.place, copy: piece, trait, tier,
    cash: total, crew, ...took,
  }, secret(victims));
  return { copies: piece ? [piece] : [], cash: total };
}

// §10: a bounty pays once, all of it, with no cut (call 4), to the first fight in the night's order that earns it: the
// leader of a won hit, break-in or vault job that took its piece, or of a won hit or break-in that took a piece or cash
// from its agent (R4-4: robbing an agent includes robbing its home), or the Cop of a won collar on its agent; never its
// own poster, nor one of the target's crewmates (crews at the lock), and a city arrest pays nobody. The poster's event
// never names the collector, so a masked robber stays masked (GAP gap.bounty, gap.vault).
function payBounties(s, lock, out, fights, took, n, secret) {
  const mates = x => !!x.target && !!lock.agents[x.winner].crew && lock.agents[x.winner].crew === lock.agents[x.target].crew;
  const earns = (b, x, t = took.get(x)) => !!x.winner && x.winner !== b.by && !mates(x) && (b.on.copy ? !!t && t.copies.includes(b.on.copy)
    : x.target === b.on.agent && (x.kind === 'collar' || (!!t && (t.copies.length > 0 || t.cash > 0))));
  for (const b of [...s.bounties]) {
    const f = fights.find(x => earns(b, x));
    if (!f) continue;
    s.agents[f.winner].cash += closeBounty(s, b);
    emit(s, out, 'bounty', { act: 'paid', bounty: b.id, by: b.by, ...b.on, amount: b.amount, night: n }, secret([b.by]));
    emit(s, out, 'bounty', { act: 'collected', bounty: b.id, to: f.winner, ...b.on, amount: b.amount, night: n }, secret([f.winner]));
  }
}

// §10, §15: a bounty nobody earned is gone with the ferry: its cash leaves the island (the 'bounty' sink), so posting
// one spends it. Its poster's own until day 15 (GAP gap.bounty).
function bountiesGone(s, out, secret) {
  for (const b of [...s.bounties]) {
    cashOut(s, 'bounty', closeBounty(s, b));
    emit(s, out, 'bounty', { act: 'gone', bounty: b.id, by: b.by, ...b.on, amount: b.amount }, secret([b.by]));
  }
}

// A bounty closes: its cash comes out of the offers, for whoever it goes to.
function closeBounty(s, b) {
  s.offers = s.offers.filter(o => o.bounty !== b.id);
  s.bounties = s.bounties.filter(x => x.id !== b.id);
  return b.amount;
}

// §9: the crate goes whole to the agent whose grab won (the bag); its cash and goods join the island now, never before
// (GAP gap.shipments).
function grabCrate(s, out, f, n, secret) {
  const { cash, goods } = s.crate;
  const a = s.agents[f.winner];
  a.cash += cash;
  if (cash) cashIn(s, 'shipment', cash);
  for (const [k, u] of Object.entries(goods)) {
    addGoods(a, k, u);
    bookGoods(s, 'in', 'shipment', k, u);
  }
  const members = f.attackers.find(g => g.leader === f.winner).members;
  emit(s, out, 'grab', { night: n, leader: f.winner, members, place: f.place, cash, goods: { ...goods } }, secret(members));
  s.crate = null;
}

// §13: a won vault job takes everything the vault held at the lock, its pieces and its cash, into its leader's bag (§8),
// and tonight's seizures go in after. The take is the group's own until the 24-hour record (GAP gap.vault). Returns what
// it took: the pieces and the cash.
function jobVault(s, lock, out, f, n, secret) {
  const leader = f.winner;
  const members = f.attackers.find(g => g.leader === leader).members;
  const copies = Object.keys(lock.copies).filter(k => lock.copies[k].holder.k === 'vault').sort(byId);
  for (const k of copies) moveCopy(s, k, { k: 'agent', id: leader }, 'job', { from: 'vault', night: n, place: f.place });
  s.agents[leader].carry.push(...copies);
  const cash = lock.vault.cash;
  s.vault.cash -= cash;
  s.agents[leader].cash += cash;
  emit(s, out, 'vault', { night: n, leader, members, place: f.place, copies, cash }, secret(members));
  return { copies, cash };
}

// §9, step 2: the drops split among the Smugglers there, and what every worker carries out tonight, which a won hit
// takes before work pays (GAP gap.carried, gap.trades). A haul is the drop's, booked in as it's split.
function workOut(s, lock, out, P, n) {
  const carried = {};
  const runs = {};
  for (const id of Object.keys(P).sort(byId)) {
    const p = P[id];
    if (p.kind === 'run') (runs[p.place] ||= []).push(id);
    // R4-3: a cook short of chems at the lock carries what it holds (GAP gap.marketOrder).
    if (p.kind === 'cook' && p.place !== HOMES) carried[id] = { chems: Math.min(p.batches * N.cook.chems, lock.agents[id].goods.chems || 0) };
    if (p.kind === 'deal') {
      const cap = lock.corners[p.corner].holder === id ? N.deal.held : N.deal.cap;
      carried[id] = dosesUpTo(lock.agents[id].goods, cap);
    }
  }
  for (const place of Object.keys(runs).sort(byId)) {
    const kind = N.drops[place];
    for (const [id, share] of Object.entries(dropSplit(runs[place], n))) {
      const units = gathers(share, wears(lock, id, 'workboots'));
      if (units) {
        addGoods(s.agents[id], kind, units);
        bookGoods(s, 'in', 'drop', kind, units);
      }
      carried[id] = units ? { [kind]: units } : {};
      emit(s, out, 'gather', { night: n, agent: id, place, goods: { ...carried[id] } }, toFew(s, [id]));
    }
  }
  return carried;
}

// §9, step 4: the trades' night pays, for everyone not arrested in tonight's fights. The corners change hands; Dealers
// sell what they still carry; Chemists cook; Gunrunners build; and every worker's flex pays (§4). The results are the
// agent's now and everyone's 24 hours later; corners are public (§19). Returns the work's heat (GAP gap.workHeat).
const WORK = ['hustle', 'run', 'cook', 'deal', 'build', 'patrol', 'collar', 'guard'];
function payTrades(s, lock, out, P, R, carried, n, collared, heldUp = new Set()) {
  const heat = {};
  const patrolled = new Set(Object.keys(P).filter(id => P[id].kind === 'patrol').map(id => P[id].place));
  for (const corner of Object.keys(R.deals).sort(byId)) {
    const [holder, was] = [R.deals[corner], s.corners[corner].holder];
    if (!holder || holder === was) continue;
    s.corners[corner].holder = holder;
    emit(s, out, 'turf', { night: n, corner, place: N.corners[corner].place, holder, was }, toAll(s));
  }
  const use = (a, sink, kind, k) => {
    addGoods(a, kind, -k);
    bookGoods(s, 'out', sink, kind, k);
  };
  const make = (a, source, kind, k, lots) => {
    addGoods(a, kind, k, lots);
    bookGoods(s, 'in', source, kind, k);
  };
  for (const id of Object.keys(P).sort(byId)) {
    const [p, a] = [P[id], s.agents[id]];
    if (a.jail || !WORK.includes(p.kind)) continue;
    const mine = toFew(s, [id]);
    if (p.kind === 'deal' && R.deals[p.corner] === id) {
      // §9: the street pays the same for a dose of any drug (GAP gap.doses).
      const [doses, hot] = [DRUGS.reduce((t, d) => t + (carried[id][d] || 0), 0), N.corners[p.corner].hot];
      const cash = cornerTakings(doses, hot);
      if (doses) {
        for (const [d, k] of Object.entries(carried[id])) use(a, 'street', d, k);
        // R3-2 (GAP gap.holdup): a Dealer held up tonight was paid these takings at the take, and the robber took them.
        if (!heldUp.has(id)) {
          a.cash += cash;
          cashIn(s, 'street', cash);
        }
        if (hot || patrolled.has(p.place)) heat[id] = N.workHeat;
      }
      emit(s, out, 'sale', { night: n, agent: id, corner: p.corner, place: p.place, hot, doses, cash }, mine);
    }
    if (p.kind === 'cook') {
      const lab = p.place !== HOMES;
      // R4-3: a cook short of chems, its order at the city's shop come back, cooks the batches what it holds allows.
      const chems = lab ? carried[id].chems || 0 : Math.min(p.batches * N.cook.chems, a.goods.chems || 0);
      const batches = Math.min(p.batches, Math.floor(chems / N.cook.chems));
      const doses = batches ? batches * N.cook.doses + (wears(lock, id, 'apron') ? N.apron : 0) : 0;
      if (batches) {
        use(a, 'cook', 'chems', batches * N.cook.chems);
        // §11: doses of the drug the cook names, TEMP if it names none (GAP gap.doses); HALLU's are one lot, with the
        // cook's two lies (GAP gap.hallu).
        make(a, 'cook', p.drug || 'temp', doses, p.lies && [{ lies: p.lies, n: doses }]);
        if (!lab) heat[id] = N.workHeat;
      }
      emit(s, out, 'cook', { night: n, agent: id, place: p.place, batches, chems: batches * N.cook.chems, doses, ...(p.drug ? { drug: p.drug } : {}) }, mine);
      // §11: a HALLU lot's lies are the cook's own until day 15 (the mechanics review, 10-15; GAP gap.hallu).
      if (batches && p.lies) emit(s, out, 'lies', { night: n, agent: id, lies: p.lies }, toFewUntil([id], DAY15));
    }
    if (p.kind === 'build') {
      const b = buildWith(p, a.goods.parts || 0);
      const w = b.warrants;
      const parts = b.guns * N.build.guns + b.lockpicks * N.build.lockpicks + w * N.build.warrants + (b.fake ? N.build.fakes : 0);
      if (parts) use(a, 'build', 'parts', parts);
      for (const k of ['guns', 'lockpicks']) if (b[k]) make(a, 'build', k, b[k]);
      // §9 (layer 4): each forged warrant carries its maker (GAP gap.warrants).
      if (w) make(a, 'build', 'warrants', w, [{ maker: id, n: w }]);
      emit(s, out, 'craft', { night: n, agent: id, guns: b.guns, lockpicks: b.lockpicks, ...(w ? { warrants: w } : {}), ...(b.fake ? { fakes: 1 } : {}), parts }, mine);
      if (b.fake) forge(s, out, id, b.fake, n);
    }
    // §13: a patrol earns the wage, and so (layer 4) does a guard, doubled on Payday; a won collar pays a set sum a
    // star out of the arrest's fine, never doubled (GAP gap.patrol, gap.guard, gap.collar, gap.collarPay).
    if (p.kind === 'patrol' || p.kind === 'guard') {
      const wage = N.copPay[p.kind] * (n === 7 && s.midseason === 'payday' ? 2 : 1);
      // R3-2 (GAP gap.holdup): a Cop held up tonight was paid its wage at the take, and the robber took it.
      if (!heldUp.has(id)) {
        a.cash += wage;
        cashIn(s, p.kind, wage);
      }
      emit(s, out, p.kind, { night: n, agent: id, place: p.place, wage }, mine);
    }
    // R4-4: the Cop was paid out of the fine at the arrest. Under R4-4's measured options ('once', 'stars') the city
    // pays it here, from the 'collar' source. The event says the fine it came out of (GAP gap.collarPay).
    const c = collared[id];
    if (c) {
      if (c.city && c.pay) {
        a.cash += c.pay;
        cashIn(s, 'collar', c.pay);
      }
      emit(s, out, 'collar', { night: n, agent: id, target: c.target, stars: c.stars, pay: c.pay, fine: c.fine }, mine);
    }
    // §4: flex pays for every real rare-or-better piece worn at the lock, never a fake (call 2); Payday doubles it with
    // the wage (GAP gap.flex, gap.fakes).
    let pay = wornOf(lock, id).reduce((t, k) => t + (lock.copies[k].fake ? 0 : N.flex[lock.copies[k].tier] || 0), 0);
    if (n === 7 && s.midseason === 'payday') pay *= 2;
    if (pay) {
      a.cash += pay;
      cashIn(s, 'flex', pay);
      emit(s, out, 'flex', { night: n, agent: id, pay }, mine);
    }
  }
  return heat;
}

// §9 (R4-3): what a build makes from the parts its builder holds: all of it, or, short of parts because an order at the
// city's shop came back, what they allow, in the play's own order: guns, then lockpicks, then the forged warrant, then
// the fake (GAP gap.marketOrder).
function buildWith(p, parts) {
  let left = parts;
  const take = (want, each) => {
    const k = Math.min(want, Math.floor(left / each));
    left -= k * each;
    return k;
  };
  const guns = take(p.guns, N.build.guns);
  const lockpicks = take(p.lockpicks, N.build.lockpicks);
  const warrants = take(p.warrants || 0, N.build.warrants);
  return { guns, lockpicks, warrants, fake: p.fake && left >= N.build.fakes ? p.fake : null };
}

// §4, §9 (layer 4): a fake is a copy of a trait outside the trait's copies, numbered on from the drop (call 1), unworn in
// its maker's stash. Which piece it is stays its maker's own until day 15 (GAP gap.fakes).
function forge(s, out, id, trait, n) {
  const [t, k] = [s.traits[trait], `k${String(Object.keys(s.copies).length + 1).padStart(3, '0')}`];
  s.copies[k] = { id: k, trait, slot: t.slot, tier: t.tier, holder: { k: 'agent', id }, sold: null, hist: [{ t: s.clock, what: 'forged', to: `agent:${id}`, night: n }], fake: true, maker: id };
  emit(s, out, 'fake', { act: 'made', night: n, agent: id, copy: k, trait, tier: t.tier }, toFewUntil([id], DAY15));
}

// §13: jail on Iron Island for 2 nights; the rarest real piece on you and half your cash as a fine go to the Evidence
// Vault, but for the part of the fine a won collar pays its Cop (`cop`; R4-4, GAP gap.collarPay); your heat goes to 0. "On you": what you wear and what you took tonight; everything, if you have no home or
// it's the last night, with a stash that travels with you, whose pieces count and half of whose cash goes in the fine
// too (GAP gap.crewStash; on the last night it's already aboard with you). §11: on CLEAR the cops seize nothing, and
// jail clears your stars as ever (call 5 revised). The arrest is public at the show and its seizure at dawn, when the
// high has worn off, so no arrest at the show reads as CLEAR (GAP gap.clear).
function arrest(s, out, id, why, stars, n, place, guard, extra = {}, cop = null) {
  const a = s.agents[id];
  if (a.jail) return { copy: null, fine: 0, toCop: 0 };
  const clear = a.high.includes('clear');
  const c = clear || n === LAST_NIGHT ? null : stashOn(s, id);
  const onYou = clear ? [] : a.evicted || n === LAST_NIGHT ? [...piecesOf(s, id), ...(c ? crewPieces(s, c.id) : [])] : [...new Set([...wornOf(s, id), ...a.carry])].sort(byId);
  const piece = rarest(s, onYou, null);
  if (piece) {
    if (guard.seized.has(piece)) throw new Error(`LEDGER GUARD: ${piece} seized twice on night ${n}`);
    guard.seized.add(piece);
    moveCopy(s, piece, { k: 'vault' }, 'seized', { from: s.copies[piece].holder.k === 'crew' ? `crew:${c.id}` : id, night: n });
  }
  // R3-2's option (GAP gap.fine, 'stars'): bail's price for each star, never more than §13's half.
  const cap = N['gap.fine'] === 'stars' ? stars * N.bailPerStar : Infinity;
  const own = Math.min(clear ? 0 : half(a.cash), cap);
  const kept = c ? Math.min(half(c.cash), cap - own) : 0;
  const fine = own + kept;
  a.cash -= own;
  if (c) c.cash -= kept;
  // R4-4 (GAP gap.collarPay, 'fine'): a won collar's Cop (`cop`) is paid out of the fine, up to copPay.star a star, so a
  // collar creates no money; the rest of the fine goes to the vault, and so does the piece, which pays the Cop nothing.
  const toCop = cop && N['gap.collarPay'] === 'fine' ? Math.min(stars * N.copPay.star, fine) : 0;
  if (toCop) s.agents[cop].cash += toCop;
  s.vault.cash += fine - toCop;
  a.jail = { nights: N.jailNights, stars, since: n };
  a.heat = 0;
  emit(s, out, 'arrest', { night: n, agent: id, why, ...extra, place, stars, bail: stars * N.bailPerStar }, toAll(s));
  // `vault`: the part of the fine that went into the vault (all of it, unless a collar's Cop was paid out of it).
  emit(s, out, 'seized', { night: n, agent: id, copy: piece, trait: piece ? s.copies[piece].trait : null, fine, vault: fine - toCop }, toFew(s, [id], 1));
  return { copy: piece, fine, toCop };
}

// §13 (R4-4, GAP gap.collarPay): what a won collar pays its Cop, a set sum a star (copPay.star), and who pays it.
// 'fine', the rule: the arrest's fine pays it, up to the star sum (arrest), so the city creates no money for a collar and
// partners who arrange one only move their own cash, whatever a later vault job takes back. 'once', the per-offender
// bound, and 'stars', §13 as first written, are R4-4's measured options: the city pays (`city`), the star sum for an
// agent's first won collar this season (its count kept on the agent) and nothing for a later one, or the star sum
// every time.
function collarPay(s, target, stars, seized) {
  const full = stars * N.copPay.star;
  if (N['gap.collarPay'] === 'fine') return { pay: seized.toCop, city: false };
  if (N['gap.collarPay'] === 'once') {
    const t = s.agents[target];
    t.collared = (t.collared || 0) + 1;
    return { pay: t.collared === 1 ? full : 0, city: true };
  }
  return { pay: full, city: true };
}

// R11 (GAP gap.hustleHeat): tonight's hustles, by agent: the district, its kind (`how`), its police level tonight, the
// other agents hustling there tonight, and the take (state.mjs hustleTake), doubled on night 7's Payday. The hold-up
// (nightPay) and step 4 (payHustles) both read it, so a robber takes what the hustle pays.
function hustlesOf(s, P, n) {
  const ids = Object.keys(P).filter(id => P[id].kind === 'hustle').sort(byId);
  const payday = n === 7 && s.midseason === 'payday';
  const at = {};
  for (const id of ids) at[P[id].place] = (at[P[id].place] || 0) + 1;
  return Object.fromEntries(ids.map(id => {
    const place = P[id].place;
    const level = levelTonight(s, place, n);
    const crowd = at[place] - 1;
    return [id, { place, how: HUSTLE_HOW[place], level, crowd, take: hustleTake(level, crowd, payday) }];
  }));
}
// R11: every hustler not arrested in tonight's fights takes its take; one held up tonight (R3-2, GAP gap.holdup) still
// hustled: it was paid at the take, and the robber took it. Each hustle is on the record at once, for everyone: its
// district, kind, level, the others there and the take. Returns the hustles' work heat: one star in a district that's
// normal or heavy tonight, or that a Cop patrols tonight, even a lawless one (GAP gap.hustleHeat).
function payHustles(s, out, P, n, heldUp = new Set()) {
  const heat = {};
  const patrolled = new Set(Object.keys(P).filter(id => P[id].kind === 'patrol').map(id => P[id].place));
  const hustles = hustlesOf(s, P, n);
  for (const id of Object.keys(hustles)) {
    if (s.agents[id].jail) continue;
    const h = hustles[id];
    if (!heldUp.has(id)) {
      s.agents[id].cash += h.take;
      cashIn(s, 'hustle', h.take);
    }
    const star = hustleStar(h.level, patrolled.has(h.place));
    if (star) heat[id] = star;
    emit(s, out, 'hustle', { night: n, agent: id, place: h.place, how: h.how, level: h.level, crowd: h.crowd, take: h.take }, toAll(s));
  }
  return heat;
}

// §12 turn (GAP, typed): an agent promised to back someone tonight, then hit it or backed the side against it. A play
// SUDO wrote is never a betrayal (the mechanics review, 10-15; GAP gap.sudo).
function turns(s, out, P, R, n, secret, written) {
  for (const p of s.promises) {
    if (p.what !== 'back' || p.night !== n || p.settled) continue;
    p.settled = true;
    const mine = P[p.by];
    if (!mine || written.has(p.by)) continue;
    const x = p.who;
    const xs = P[x];
    // A collar on X is an attack on X, as a hit is (GAP gap.collar).
    const attack = q => q && ['hit', 'breakin', 'collar'].includes(q.kind);
    const against = ((mine.kind === 'hit' || mine.kind === 'collar') && mine.target === x)
      || (mine.kind === 'back' && attack(P[mine.target]) && P[mine.target].target === x)
      || (mine.kind === 'back' && attack(xs) && xs.target === mine.target);
    if (against) {
      emit(s, out, 'betray', { kind: 'turn', by: p.by, victims: [x], night: n, promise: p.id, play: { ...mine } }, secret([p.by, x]));
    }
  }
  // A cut promised for tonight's play falls due once the play has won; the leader has until the end of tomorrow.
  const winners = new Set(R.fights.filter(f => f.winner).map(f => f.winner));
  for (const p of s.promises) {
    if (p.what !== 'pay' || p.night !== n || p.settled) continue;
    if (winners.has(p.by) && (R.groups[p.by] || []).includes(p.to)) p.due = n + 1;
    else p.settled = true;
  }
}

// §6: a district with 3 or more crimes tonight is one level hotter tomorrow night; each quiet night (GAP: no crimes)
// moves it one level back toward where it started.
function pushBack(s, out, districtCrimes) {
  for (const d of DISTRICTS) {
    const D = s.districts[d];
    const crimes = districtCrimes[d] || 0;
    const i = LEVELS.indexOf(D.level);
    const base = LEVELS.indexOf(D.base);
    let next = i;
    if (crimes >= N.hotCrimes) next = Math.min(LEVELS.length - 1, i + 1);
    else if (crimes === 0 && i !== base) next = i + (base > i ? 1 : -1);
    if (next !== i) {
      emit(s, out, 'police', { place: d, level: LEVELS[next], was: D.level, crimes }, toAll(s));
      D.level = LEVELS[next];
    }
  }
}

// §9 (R4-3): the day's orders on each of the city's curves fill together, at the lock, after the fence's deals and before
// the plays lock (market.mjs, clearingOf): every unit moves the price one step, and every filled order pays or gets the
// same price a unit. A sale's cash, a shop order's goods and the cash it didn't spend reach their agents now. What each
// order got is its agent's own until dawn, 24 hours after the day's errands, as a day's trade was, and the price's move
// is public at once (GAP gap.marketOrder, gap.marketSeen). Returns what each agent's shop orders didn't bring, by kind.
function clearMarket(s, out, n) {
  // What each agent's orders at the shop didn't bring, by kind.
  const short = {};
  for (const side of ['buyer', 'shop']) {
    for (const item of marketItems(side)) {
      const orders = s.orders.filter(o => o.side === side && o.item === item);
      if (!orders.length) continue;
      const steps = s.market[side][item];
      const { fills, back, units, total } = clearingOf(side, item, steps, orders, n);
      for (const [o, cash] of fills) {
        const a = s.agents[o.by];
        if (side === 'buyer') {
          a.cash += cash;
          bookGoods(s, 'out', 'buyer', o.kind, o.units);
        } else {
          a.cash += o.cash - cash;
          addGoods(a, o.kind, o.units);
          bookGoods(s, 'in', 'shop', o.kind, o.units);
        }
        emit(s, out, side === 'shop' ? 'shop' : 'sell', { night: n, agent: o.by, item, units: o.units, cash, order: o.id, ...(o.drug ? { drug: o.drug } : {}) }, toFew(s, [o.by], 1));
      }
      if (total && side === 'buyer') cashIn(s, 'buyer', total);
      if (total && side === 'shop') cashOut(s, 'shop', total);
      for (const o of back) {
        s.agents[o.by].cash += o.cash;
        const mine = (short[o.by] ||= {});
        mine[o.kind] = (mine[o.kind] || 0) + o.units;
        emit(s, out, 'order', { act: 'back', night: n, order: o.id, agent: o.by, side, item, units: o.units, max: o.cash }, toFew(s, [o.by], 1));
      }
      s.market[side][item] = steps + units;
      const [was, price] = [priceOf(side, item, steps), priceOf(side, item, steps + units)];
      if (price !== was) emit(s, out, 'price', { side, item, price, was }, toAll(s));
    }
  }
  s.orders = [];
  return short;
}

// §9: the shop eases back and the buyer recovers, two steps a night; every move is public.
function easeMarket(s, out) {
  for (const side of ['shop', 'buyer']) {
    for (const item of marketItems(side)) {
      const k = s.market[side][item];
      const next = Math.max(0, k - N.marketEase);
      if (next === k) continue;
      s.market[side][item] = next;
      const [was, price] = [priceOf(side, item, k), priceOf(side, item, next)];
      if (price !== was) emit(s, out, 'price', { side, item, price, was }, toAll(s));
    }
  }
}

function dawn(s, out, P, R, n) {
  s.day = n + 1;
  s.clock = 2 * (n + 1);
  // §3: at dawn the trait is in your stash, and the sale is public.
  for (const p of s.pending) {
    moveCopy(s, p.copy, { k: 'agent', id: p.to }, 'bought', { price: p.price, night: n });
    s.copies[p.copy].sold = p.price;
    emit(s, out, 'buy', { night: n, agent: p.to, trait: p.trait, copy: p.copy, price: p.price }, toAll(s));
  }
  s.pending = [];
  // §9: the morning of a shipment night its crate is posted at the docks, on top of anything still there. Its cash and
  // goods aren't the island's until someone grabs them (GAP gap.shipments).
  const due = N.shipments[n + 1];
  if (due) {
    const c = (s.crate ||= { cash: 0, goods: {} });
    c.cash += due.cash || 0;
    for (const [k, u] of Object.entries(sortGoods(due))) addGoods(c, k, u);
    c.goods = sortGoods(c.goods);
    emit(s, out, 'shipment', { night: n + 1, cash: due.cash || 0, goods: sortGoods(due), crate: { cash: c.cash, goods: { ...c.goods } } }, toAll(s));
  }
  for (const a of Object.values(s.agents)) a.carry = [];
  // §13: 2 nights in jail, then out. R3-2's option (GAP gap.ferryJail, 'released'): at dawn on day 14 everyone still in
  // jail walks out, its sentence served by the ferry.
  const ferry = s.day === LAST_NIGHT && N['gap.ferryJail'] === 'released';
  for (const id of agentIds(s)) {
    const a = s.agents[id];
    if (!a.jail || (a.jail.since === n && !ferry)) continue;
    a.jail.nights = ferry ? 0 : a.jail.nights - 1;
    if (a.jail.nights <= 0) {
      a.jail = null;
      emit(s, out, 'release', { agent: id, why: 'served' }, toAll(s));
    }
  }
  // §10: rent is due at dawn from your stash. No rent in jail. Can't pay, and you're evicted until you do. GAP
  // gap.rentTab: a dawn spent evicted puts the night's rent on the tab instead, and nothing comes out of the cash.
  for (const id of agentIds(s)) {
    const a = s.agents[id];
    if (a.jail || !P[id]) continue;
    if (a.evicted) {
      if (tabOn()) a.tab += N.rent;
      continue;
    }
    if (a.cash >= N.rent) {
      a.cash -= N.rent;
      cashOut(s, 'rent', N.rent);
    } else {
      a.evicted = true;
      emit(s, out, 'evicted', { agent: id, on: true, owed: N.rent }, toAll(s));
      // GAP gap.crewStash: its crew's stash moves to a member's home, if one has one.
      if (a.crew) rehome(s, s.crews[a.crew]);
    }
  }
  // §12 walk (GAP, typed): cuts promised for a won play, still unpaid at the end of the next day. One leader keeping
  // one night's bag is one act, with every unpaid backer as a victim. R5-terms: the dawn and the cut owed are the
  // promise's own (state.mjs promiseState), the same facts every view shows.
  const walks = {};
  for (const p of s.promises) {
    const st = promiseState(p);
    if (p.settled || !st.walkAt || st.walkAt > s.day) continue;
    p.settled = true;
    if (st.owed > 0) (walks[`${p.by}|${p.night}`] ||= []).push(p);
  }
  for (const key of Object.keys(walks).sort(byId)) {
    const ps = walks[key];
    const victims = [...new Set(ps.map(p => p.to))].sort(byId);
    emit(s, out, 'betray', {
      kind: 'walk', by: ps[0].by, victims, night: ps[0].night, promise: ps[0].id, promises: ps.map(p => p.id),
      owed: ps.reduce((t, p) => t + p.cash, 0), paid: ps.reduce((t, p) => t + p.paid, 0),
    }, toFew(s, [ps[0].by, ...victims]));
  }
  for (const p of s.promises) if (p.what !== 'back' && p.what !== 'pay' && p.night != null && p.night < s.day) p.settled = true;
  s.promises = s.promises.filter(p => !p.settled);
  // §19, the 24-hour record: stashes and cash are the owner's now and everyone's 24 hours later. A crew's stash is on
  // its keeper's record.
  for (const id of agentIds(s)) emit(s, out, 'holdings', holdingsOf(s, id), toFew(s, [id]));
  // §11: highs end. A day on TEMP crashes the next night; the same drug hooked.nights days running hooks the agent on
  // it; hooked.clean dawns in a row with no drug at all, in jail too, end every hook with a public clean mark (call 7).
  // Crashes and hooks are the agent's own now and everyone's 24 hours later (GAP gap.temp, gap.hooked).
  for (const id of agentIds(s)) {
    const a = s.agents[id];
    a.crash = a.high.includes('temp');
    if (a.crash) emit(s, out, 'crash', { agent: id, night: n + 1 }, toFew(s, [id]));
    a.streak = Object.fromEntries(a.high.map(d => [d, (a.streak[d] || 0) + 1]));
    for (const d of a.high.filter(x => a.streak[x] >= N.hooked.nights && !a.hooked.includes(x))) {
      a.hooked = DRUGS.filter(x => x === d || a.hooked.includes(x));
      emit(s, out, 'hooked', { agent: id, drug: d }, toFew(s, [id]));
    }
    a.clean = a.high.length ? 0 : a.clean + 1;
    if (a.clean >= N.hooked.clean && a.hooked.length) {
      a.hooked = [];
      emit(s, out, 'clean', { agent: id }, toAll(s));
    }
    a.high = [];
    // TRUTH's lock and SUDO's writer end with the high (GAP gap.truth, gap.sudo).
    for (const k of ['locked', 'writer', 'written']) delete a[k];
  }
  // A new day: messages, out-loud lines, tips, bribes and the crew stash's takes start over (§13, §14).
  for (const a of Object.values(s.agents)) {
    a.msgs = 0;
    delete a.outLoud;
  }
  // §14 (R4-3, sitdownDays): a sit-down stays open to its last day unless either side closed it. One past it ends now,
  // telling the two of them, theirs now and everyone's 24 hours later; a declined one is gone; and the earpiece's day is
  // over, so a listener hears no more.
  for (const sd of Object.values(s.sitdowns).sort((x, y) => Number(x.id.slice(1)) - Number(y.id.slice(1)))) {
    if (sd.state === 'declined') delete s.sitdowns[sd.id];
    else if (sd.until < s.day) {
      delete s.sitdowns[sd.id];
      // R5-deals: its deals go on only where one side owes the other.
      endDeals(s, sd.id);
      emit(s, out, 'close', { sitdown: sd.id, a: sd.a, b: sd.b, by: null, why: 'expired' }, toFew(s, [sd.a, sd.b]));
    } else sd.listeners = [];
  }
  s.tips = [];
  s.bribes = [];
  for (const c of Object.values(s.crews)) c.took = {};
}

// GAP gap.goodsGone: goods never board. Whatever a holder has when the ferry leaves is gone, booked out as gone, and
// the record lists it under `key` (nothing when there was none).
function goodsLeft(s, h, key) {
  const goods = sortGoods(h.goods);
  for (const [k, n] of Object.entries(goods)) bookGoods(s, 'out', 'gone', k, n);
  h.goods = {};
  delete h.lots;
  delete h.marks;
  delete h.makers;
  return Object.keys(goods).length ? { [key]: goods } : {};
}

// GAP gap.rentTab: nobody boards owing rent. The tab comes out of the cash the agent carries (the rent sink); if that
// falls short, the landlord takes the rarest piece it carries (§4's tie rule, nobody naming one), which rolls into
// next season's list as unsold copies do (§3), and the tab is cleared. The settlement is public, as the tab was.
function settleTab(s, out, id) {
  const a = s.agents[id];
  if (!a.tab) return;
  const paid = Math.min(a.cash, a.tab);
  a.cash -= paid;
  if (paid) cashOut(s, 'rent', paid);
  const piece = paid < a.tab ? rarest(s, piecesOf(s, id), null) : null;
  if (piece) moveCopy(s, piece, { k: 'rollover' }, 'landlord', { from: id });
  emit(s, out, 'tab', {
    agent: id, tab: a.tab, paid, copy: piece, trait: piece ? s.copies[piece].trait : null, tier: piece ? s.copies[piece].tier : null,
  }, toAll(s));
  a.tab = 0;
}

// §15: then everyone who isn't arrested boards, and the ferry leaves. Day 15: every real trait mints to its owner, with
// its history card; cash becomes Mainland money. Anything left in a stash, a home or the vault is gone; unsold copies
// roll into next season's list (§3).
function boardAndMint(s, out, R) {
  for (const id of agentIds(s)) {
    const a = s.agents[id];
    if (a.jail) {
      const pieces = piecesOf(s, id);
      for (const k of pieces) moveCopy(s, k, { k: 'gone' }, 'missed the boat', { from: id });
      cashOut(s, 'gone', a.cash);
      emit(s, out, 'missed', { agent: id, copies: pieces, cash: a.cash, ...goodsLeft(s, a, 'goods') }, toAll(s));
      a.cash = 0;
    } else {
      // §15: everyone walks to the dock, so whoever boards walked one of the routes, where a hit could find it. A free
      // agent with none (a play kind the walk doesn't place) stops the night loudly, as the ledger's guard does.
      const w = R.where[id];
      if (!w || w.at !== 'out' || !ROUTES.includes(w.place)) throw new Error(`FERRY GUARD: ${id} boards with no route to the dock: ${JSON.stringify(w || null)}`);
      a.boarded = true;
      emit(s, out, 'board', { agent: id, route: w.place }, toAll(s));
      settleTab(s, out, id);
    }
  }
  // Boarding belongs to night 14; minting belongs to day 15. Neither the snapshot nor its prefix changes the log.
  const beforeDawn = { state: clone(s), eventCount: out.length };
  s.day = LAST_NIGHT + 1;
  s.clock = DAY15;
  for (const id of agentIds(s)) {
    const a = s.agents[id];
    if (!a.boarded) continue;
    const cards = [];
    for (const k of piecesOf(s, id)) {
      const c = s.copies[k];
      // §15: aboard, a fake is exposed to everyone ("Your GEMS were fake") and gone, and never mints (GAP gap.fakes).
      if (c.fake) {
        moveCopy(s, k, { k: 'gone' }, 'exposed');
        emit(s, out, 'fake', { act: 'exposed', agent: id, copy: k, trait: c.trait, tier: c.tier }, toAll(s));
        continue;
      }
      moveCopy(s, k, { k: 'minted', id }, 'minted');
      cards.push({ copy: k, trait: c.trait, tier: c.tier, value: copyPaid(s, k), mark: lastPrice(s, k), valueBasis: 'copy-paid', history: c.hist.map(h => ({ ...h })) });
    }
    a.mainland = Math.round(a.cash * N.mainlandRate);
    cashOut(s, 'mainland', a.cash);
    emit(s, out, 'mint', { agent: id, cards, cash: a.cash, mainland: a.mainland, ...goodsLeft(s, a, 'goodsLeft') }, toAll(s));
    a.cash = 0;
  }
  for (const c of Object.values(s.crews).sort((x, y) => byId(x.id, y.id))) {
    const left = crewPieces(s, c.id);
    for (const k of left) moveCopy(s, k, { k: 'gone' }, 'left behind', { crew: c.id });
    cashOut(s, 'gone', c.cash);
    const goods = goodsLeft(s, c, 'goods');
    if (left.length || c.cash || goods.goods) emit(s, out, 'gone', { from: `crew:${c.id}`, copies: left, cash: c.cash, ...goods }, toAll(s));
    c.cash = 0;
  }
  const vaulted = Object.keys(s.copies).filter(k => s.copies[k].holder.k === 'vault').sort(byId);
  for (const k of vaulted) moveCopy(s, k, { k: 'gone' }, 'never minted');
  cashOut(s, 'gone', s.vault.cash);
  emit(s, out, 'gone', { from: 'vault', copies: vaulted, cash: s.vault.cash }, toAll(s));
  s.vault.cash = 0;
  const unsold = Object.keys(s.copies).filter(k => s.copies[k].holder.k === 'list').sort(byId);
  for (const k of unsold) moveCopy(s, k, { k: 'rollover' }, 'rollover');
  emit(s, out, 'rollover', { copies: unsold }, toAll(s));
  s.over = true;
  emit(s, out, 'season_end', { seed: s.seed, rule: s.rule }, toAll(s));
  return beforeDawn;
}
