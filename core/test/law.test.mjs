// R4-4, the law (trunk docs/briefs/R4-astra-fixes.md, task 4; GAME.md §10, §11, §13, §15, §41), with the rows in
// core/numbers.mjs (gap.collarPay, gap.ferryJail, gap.sudo):
// - Astra's full review (law/REVIEW.md §3) found that the city paid $100 a star for every won collar, even when the
//   arrest seized nothing. A Chemist and a Cop in one crew gave the Chemist stars by cooking at home, moved its cash to
//   the Cop before each collar, and out-earned the same pair working honestly. R4-4's review found that paying up to
//   what the arrest seized still paid: the seizure went into the vault, and a night-14 vault job took it back. So a
//   collar creates no money: its Cop is paid out of the arrest's fine, up to $100 a star, and the rest of the fine and
//   the seized piece go to the vault. Partners who arrange a collar only move their own cash, while a collar on a
//   criminal holding its takings still pays in full.
// - Two leftovers still assumed that jail meant missing the ferry: the bots' bail reserve and SUDO's cutoff from day 12.
//   Both follow gap.ferryJail: under 'released' (the rule since R3-3) only night 14's own arrests miss the boat.
// Every amount is read from N, or from the state the test set up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, listCopies } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { settleNight } from '../rules/night.mjs';
import { rng } from '../rng.mjs';
import { withOverrides } from '../bench/runner.mjs';
import { VAULT_AT } from '../rules/plays.mjs';

const bots = () => import('../bench/bots.mjs');
const YARDS = 'industrial';
const shift = (place = YARDS) => ({ kind: 'hustle', place });
const collar = (target, place = YARDS) => ({ kind: 'collar', target, place });
const half = x => Math.floor(x / 2);

// A season whose agents have the trades named, in id order (the helpers' cast is all Smugglers).
function withTrades(trades) {
  const g = new Game({ n: 1 });
  const agents = trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' }));
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  const a = g.s.agents[id];
  a.goods[kind] = (a.goods[kind] || 0) + n;
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
// The rent for a whole season and more, so nobody is evicted and every default play is a lay low.
const housed = (g, ids) => ids.forEach(id => g.grant(id, 2 * N.nights * N.rent));
const collarOf = (r, cop) => r.newEvents.find(e => e.type === 'collar' && e.agent === cop);
const seizedOf = (r, id) => r.newEvents.find(e => e.type === 'seized' && e.agent === id);

// A common bought on the list on day 1 at its price and worn from day 2: a piece with its copy's own first sale.
function boughtAndWorn(g, id) {
  const t = Object.values(g.s.traits).filter(x => x.tier === 'common' && !x.ability && x.opens <= g.s.day).sort((x, y) => (x.id < y.id ? -1 : 1))[0];
  g.grant(id, t.price);
  assert.equal(g.errand(id, 'offer', { trait: t.id, amount: t.price }).ok, true);
  g.night();
  const copy = Object.values(g.s.copies).find(c => c.trait === t.id && c.holder.k === 'agent' && c.holder.id === id).id;
  assert.equal(g.errand(id, 'dress', { fit: { [g.s.copies[copy].slot]: copy } }).ok, true);
  return { copy, price: g.s.copies[copy].sold };
}

// Astra's matched pair, rebuilt here (law/REVIEW.md §3; her probe was read, not run): a Chemist and a Cop in one crew,
// $200 and 12 chems between them, the same six batches on nights 1-3 and 7-9, and the same boarding. Honest: the
// Chemist cooks at the lab and works shifts, and the Cop patrols. Arranged: the Chemist cooks at home for its stars,
// hands the Cop all its cash but `park` before nights 4 and 10 (the Cop tops it up to `park`), and works a shift where
// the Cop collars it. Each day it's free the Chemist sells its doses to the city's buyer (never on a collar day, since a
// sale's cash lands at the lock) and keeps a night's rent; the Cop holds the rest. R4-4's review, as its probe built
// it: with `piece`, the Cop buys a common on day 1, and the arranged Chemist wears it at its collars (the honest Cop
// keeps it); with `vault`, on day 14 both pairs hold a forged warrant and a gun each and take TEMP, and job the vault
// together on night 14, the Chemist leading.
function pairSeason(arranged, { park = 0, piece = false, vault = false } = {}) {
  const g = new Game({ n: 2 });
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents: [{ id: 'a01', name: 'cook', trade: 'chemist' }, { id: 'a02', name: 'cop', trade: 'cop' }] });
  g.s = r.state;
  g.log = [...r.events];
  for (const id of ['a01', 'a02']) g.grant(id, 100);
  stock(g, 'a01', 'chems', 12 - (g.s.agents.a01.goods.chems || 0));
  g.errand('a02', 'crew_form', { name: 'Partners' });
  g.errand('a02', 'crew_invite', { agent: 'a01' });
  g.errand('a01', 'crew_join', { crew: g.s.agents.a02.crew });
  let common = null;
  if (piece) {
    const t = Object.values(g.s.traits).filter(x => x.tier === 'common' && !x.ability && x.opens <= g.s.day).sort((x, y) => (x.id < y.id ? -1 : 1))[0];
    g.grant('a02', t.price);
    assert.equal(g.errand('a02', 'offer', { trait: t.id, amount: t.price }).ok, true);
    common = t.id;
  }
  const COOK = [1, 2, 3, 7, 8, 9];
  const COLLARS = arranged ? [4, 10] : [];
  for (let day = 1; day < N.nights; day++) {
    const cook = g.s.agents.a01;
    const collared = COLLARS.includes(day);
    if (!cook.jail) {
      const doses = cook.goods.temp || 0;
      if (doses && !collared) assert.equal(g.errand('a01', 'sell', { item: 'doses', drug: 'temp', units: doses }).ok, true);
      const keep = collared ? park : N.rent;
      if (cook.cash > keep) assert.equal(g.errand('a01', 'pay', { to: 'a02', amount: cook.cash - keep }).ok, true);
      else if (cook.cash < keep) assert.equal(g.errand('a02', 'pay', { to: 'a01', amount: Math.min(keep - cook.cash, g.s.agents.a02.cash) }).ok, true);
      const k = common && Object.values(g.s.copies).find(c => c.trait === common && c.holder.k === 'agent');
      if (k && collared) {
        if (k.holder.id === 'a02') assert.equal(g.errand('a02', 'give', { to: 'a01', copy: k.id }).ok, true);
        assert.equal(g.errand('a01', 'dress', { fit: { [k.slot]: k.id } }).ok, true);
      }
    }
    const plays = { a02: collared ? collar('a01') : { kind: 'patrol', place: YARDS } };
    if (!g.s.agents.a01.jail) plays.a01 = COOK.includes(day) ? { kind: 'cook', place: arranged ? 'suburbs' : 'forest', batches: 1 } : shift();
    g.night(plays, { exact: true });
  }
  if (vault) {
    stock(g, 'a01', 'warrants', 1);
    for (const id of ['a01', 'a02']) {
      stock(g, id, 'guns', 1);
      stock(g, id, 'temp', 1);
      assert.equal(g.errand(id, 'take', { drug: 'temp' }).ok, true);
    }
    g.night({ a01: { kind: 'vault', place: VAULT_AT, accept: ['a02'] }, a02: { kind: 'back', target: 'a01' } }, { exact: true });
  } else {
    g.night({ a01: { kind: 'board', place: YARDS }, a02: { kind: 'board', place: YARDS } }, { exact: true });
  }
  const mainland = g.events('mint').reduce((t, e) => t + e.mainland, 0);
  // §27's haul: Mainland money plus each minted copy at that copy's own first sale on the list.
  const minted = g.events('mint').flatMap(e => e.cards).reduce((t, c) => t + (g.s.copies[c.copy].sold || 0), 0);
  return {
    mainland, haul: mainland + minted,
    doses: g.events('cook').reduce((t, e) => t + e.doses, 0),
    arrests: g.events('arrest').map(e => [e.night, e.why, e.stars]),
    pay: g.events('collar').map(e => e.pay),
    seized: g.events('seized').map(e => [e.copy, e.fine]),
    jobs: g.events('vault').map(e => ({ cash: e.cash, copies: e.copies.length })),
    city: g.s.money.in.collar || 0,
  };
}

test("Astra's case: a Chemist and its Cop who arrange its collars end the season with less than the same pair working honestly, since a collar's Cop is paid out of the arrest's fine and an arrest that fines nothing pays nothing (§13, §41; GAP gap.collarPay)", () => {
  const honest = pairSeason(false);
  const arranged = pairSeason(true);
  assert.equal(arranged.doses, honest.doses, 'control: the same cooking');
  assert.deepEqual(honest.arrests, [], 'control: nobody arrested honestly');
  assert.deepEqual(arranged.arrests.map(([night, why]) => [night, why]), [[4, 'collar'], [10, 'collar']], 'control: the two arranged collars');
  for (const [, , stars] of arranged.arrests) assert.ok(stars >= N.wantedAt, 'control: wanted, by cooking at home');
  assert.deepEqual(arranged.seized, [[null, 0], [null, 0]], 'control: its cash was with the Cop, and it wore nothing');
  assert.deepEqual(arranged.pay, [0, 0], 'neither collar fined anything, so neither pays');
  assert.equal(arranged.city, 0, 'the city paid nothing for them');
  assert.ok(arranged.mainland < honest.mainland, `arranged $${arranged.mainland} against honest $${honest.mainland}`);
});

test("R4-4's review: the same pair with a night-14 vault job, the same warrant, guns and TEMP in both branches; the arranged Chemist keeps twice its stars' pay at each collar and wears a common the Cop bought: it doesn't end ahead of the honest pair, by cash or by haul, since its Cop's pay came out of its own fine and the vault holds only what's left (§13, §15, §27, §41; GAP gap.collarPay, gap.vault)", () => {
  const options = { park: 2 * N.wantedAt * N.copPay.star, piece: true, vault: true };
  const honest = pairSeason(false, options);
  const arranged = pairSeason(true, options);
  assert.deepEqual(arranged.arrests.map(([night, why]) => [night, why]), [[4, 'collar'], [10, 'collar']], 'control: the two arranged collars');
  assert.ok(arranged.pay.every(p => p > 0), `control: both collars paid its Cop: ${arranged.pay}`);
  assert.ok(arranged.seized.some(([copy]) => copy), 'control: a collar seized the common it wore');
  for (const r of [honest, arranged]) assert.equal(r.jobs.length, 1, 'control: the vault job won');
  assert.ok(arranged.jobs[0].copies >= 1, 'control: the job took the seized common back');
  assert.ok(arranged.mainland <= honest.mainland, `by cash: arranged $${arranged.mainland} against honest $${honest.mainland}`);
  assert.ok(arranged.haul <= honest.haul, `by haul: arranged $${arranged.haul} against honest $${honest.haul}`);
  assert.equal(arranged.city, 0, 'the city paid nothing for the collars');
});

test("a collar on a real criminal still pays: copPay.star a star out of its fine while the fine covers that, and the rest of the fine and the piece go to the vault; all of the fine when it's less, the piece paying nothing; on CLEAR it fines nothing and pays nothing; the events say so: the collar its fine, the seizure what went into the vault (§11, §13, §19; GAP gap.collarPay, gap.clear)", () => {
  // a01 collars a02, a wanted agent with a piece it bought and wears, at a shift in the Yards (normal: the city cops' +2).
  const run = (cash, { clear = false } = {}) => {
    const g = withTrades(['cop', 'smuggler', 'smuggler']);
    housed(g, ['a01', 'a03']);
    g.grant('a02', N.rent);
    const piece = boughtAndWorn(g, 'a02');
    assert.ok(g.s.agents.a02.cash <= cash, 'control: no more than that yet');
    g.grant('a02', cash - g.s.agents.a02.cash);
    g.s.agents.a02.heat = N.wantedAt;
    if (clear) {
      stock(g, 'a02', 'clear', 1);
      assert.equal(g.errand('a02', 'take', { drug: 'clear' }).ok, true);
    }
    const vaultWas = g.s.vault.cash;
    const r = g.night({ a01: collar('a02'), a02: shift() });
    const arrest = r.newEvents.find(e => e.type === 'arrest' && e.agent === 'a02');
    assert.deepEqual([arrest.why, arrest.by], ['collar', 'a01'], 'control: the collar won');
    const c = collarOf(r, 'a01');
    return { pay: c.pay, fine: c.fine, stars: arrest.stars, seized: seizedOf(r, 'a02'), piece, money: g.s.money.in.collar || 0, vault: g.s.vault.cash - vaultWas, inVault: g.s.copies[piece.copy].holder.k === 'vault' };
  };
  const full = N.wantedAt * N.copPay.star;
  // Cash enough that half of it is twice its stars' pay.
  const rich = run(4 * full);
  assert.equal(rich.stars, N.wantedAt);
  assert.deepEqual([rich.seized.copy, rich.seized.fine], [rich.piece.copy, 2 * full], 'control: the piece it wore and half its cash');
  assert.equal(rich.pay, full, 'copPay.star for every star it had');
  assert.equal(rich.money, 0, "the city's collar source paid nothing");
  assert.deepEqual([rich.fine, rich.seized.vault, rich.vault, rich.inVault], [2 * full, full, full, true], 'the collar names its fine; the rest of it and the piece went into the vault, as the seizure says');
  // Less cash: half of it falls short of its stars, so the Cop gets all of the fine, and the piece pays it nothing.
  const poor = run(full);
  assert.equal(poor.seized.fine, half(full), 'control: half its cash');
  assert.deepEqual([poor.pay, poor.seized.vault, poor.vault, poor.inVault], [half(full), 0, 0, true], 'all of the fine; the piece to the vault');
  // On CLEAR the cops seize nothing, so there's nothing to pay from.
  const clear = run(4 * full, { clear: true });
  assert.deepEqual([clear.seized.copy, clear.seized.fine], [null, 0], 'control: CLEAR seized nothing');
  assert.equal(clear.pay, 0);
});

test("betrayal still works: a Cop that collars its own wanted crewmate is paid as for anyone, up to what the arrest seized, and so is one that collars a friend who left the crew (§12, §13; GAP gap.collarPay)", () => {
  const g = withTrades(['cop', 'smuggler', 'smuggler']);
  housed(g, ['a01']);
  g.errand('a01', 'crew_form', { name: 'c' });
  for (const id of ['a02', 'a03']) {
    g.errand('a01', 'crew_invite', { agent: id });
    g.errand(id, 'crew_join', { crew: g.s.agents.a01.crew });
  }
  const full = N.wantedAt * N.copPay.star;
  // Each holds its stars' worth in cash, so its fine is half its stars' pay.
  const cash = full;
  for (const id of ['a02', 'a03']) {
    assert.ok(g.s.agents[id].cash <= cash, 'control: no more than that yet');
    g.grant(id, cash - g.s.agents[id].cash);
    g.s.agents[id].heat = N.wantedAt;
  }
  let r = g.night({ a01: collar('a02'), a02: shift() });
  assert.deepEqual([seizedOf(r, 'a02').copy, seizedOf(r, 'a02').fine], [null, half(cash)], 'control: half its cash, and no piece');
  assert.equal(collarOf(r, 'a01').pay, half(cash), 'its crewmate, collared like anyone');
  // a03 leaves the crew, and is collared the same.
  assert.equal(g.errand('a03', 'crew_leave').ok, true);
  g.s.agents.a03.heat = N.wantedAt;
  r = g.night({ a01: collar('a03'), a03: shift() });
  assert.equal(collarOf(r, 'a01').pay, seizedOf(r, 'a03').fine);
  assert.ok(collarOf(r, 'a01').pay > 0 && collarOf(r, 'a01').pay < full, 'control: paid, and bounded');
});

test("the per-offender bound, R4-4's measured option (gap.collarPay 'once'): the first collar on an agent in a season pays copPay.star a star, whatever it seizes; a later one on the same agent pays nothing (§13; GAP gap.collarPay)", () => withOverrides({ 'gap.collarPay': 'once' }, () => {
  const g = withTrades(['cop', 'smuggler', 'smuggler']);
  housed(g, ['a01', 'a02', 'a03']);
  const full = N.wantedAt * N.copPay.star;
  g.s.agents.a02.heat = N.wantedAt;
  let r = g.night({ a01: collar('a02'), a02: shift() });
  assert.equal(collarOf(r, 'a01').pay, full, 'its first collar this season');
  while (g.s.agents.a02.jail) g.night();
  g.s.agents.a02.heat = N.wantedAt;
  r = g.night({ a01: collar('a02'), a02: shift() });
  assert.ok(g.s.agents.a02.jail, 'control: collared again');
  assert.equal(collarOf(r, 'a01').pay, 0, 'its second pays nothing');
  g.s.agents.a03.heat = N.wantedAt;
  r = g.night({ a01: collar('a03'), a03: shift() });
  assert.equal(collarOf(r, 'a01').pay, full, "another agent's first pays");
}));

test("§13 as first written, kept as an option (gap.collarPay 'stars'): a collar pays copPay.star a star whatever its arrest seizes; and a value the rules don't know stops the night before anything moves (GAP gap.collarPay)", () => {
  withOverrides({ 'gap.collarPay': 'stars' }, () => {
    const g = withTrades(['cop', 'smuggler']);
    housed(g, ['a01']);
    g.s.agents.a02.heat = N.wantedAt;
    const r = g.night({ a01: collar('a02'), a02: shift() });
    assert.deepEqual([seizedOf(r, 'a02').copy, seizedOf(r, 'a02').fine], [null, 0], 'control: nothing seized');
    assert.equal(collarOf(r, 'a01').pay, N.wantedAt * N.copPay.star);
  });
  withOverrides({ 'gap.collarPay': 'typo' }, () => {
    const g = withTrades(['cop', 'smuggler']);
    assert.throws(() => settleNight(g.s, {}), /gap\.collarPay/);
  });
});

// --- jail and the ferry: gap.ferryJail ------------------------------------------------------------------------------

// A small season, one bot config each, as spending.test.mjs builds it: `view(id)` is its view, `play(id)` tonight's play
// from a fresh bot.
async function world(cfgs, seed = 404) {
  const { makeBot } = await bots();
  const agents = cfgs.map((c, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: c.trade, driver: c.driver || 'test' }));
  const g = new Game({ n: 1 });
  const r = newSeason({ seed, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  const cfg = Object.fromEntries(agents.map((a, i) => [a.id, { id: a.id, fav: 'industrial', route: 'downtown', layer: 2, ...cfgs[i] }]));
  const ctx = (id, round) => ({ seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', id, g.s.day, round) });
  const errands = (id, round, memo = {}) => {
    const out = makeBot(cfg[id], memo).day(g.view(id), ctx(id, round));
    for (const e of out) {
      const res = g.errand(id, e.kind, e);
      assert.ok(res.ok, `${id} ${e.kind}: ${res.why}`);
    }
    return out;
  };
  return { g, errands };
}

test("the bail reserve follows gap.ferryJail: under 'released' no collar can keep a seat off the boat, so a Dealer its hot corner would make wanted keeps no bail back and spends down; under 'missed' it keeps CLOSE.reserve bails (§13, §15)", async () => {
  const { bailReserve, CLOSE, STREET } = await bots();
  const dealer = { type: 'dealer', trade: 'dealer', every: true };
  const setUp = async () => {
    const { g, errands } = await world([dealer, { type: 'hustle', trade: 'cop' }]);
    g.advanceTo(N.listLastNight - 1);
    stock(g, 'a01', 'temp', N.deal.cap);
    g.grant('a01', N.rent);
    g.night({ a01: { kind: 'deal', corner: 'strip-1', place: N.corners['strip-1'].place } });
    g.s.agents.a01.heat = N.wantedAt - 1;
    return { g, errands };
  };
  const { g, errands } = await setUp();
  assert.equal(g.s.day, N.listLastNight, "control: the list's last day");
  for (let adds = 0; adds <= N.maxHeat; adds++) assert.equal(bailReserve(g.view('a01'), adds), 0, `no reserve with ${adds} stars more`);
  // It can afford the rent to the ferry, tonight's doses and the cheapest trait open, and no reserve stops it.
  const cheapest = Math.min(...g.view('a01').board.list.filter(t => t.opens <= g.s.day && t.left > 0).map(t => t.price));
  g.grant('a01', (N.nights - g.s.day) * N.rent + N.deal.held * STREET.unit + cheapest - g.s.agents.a01.cash);
  assert.ok(errands('a01', 1).filter(e => e.kind === 'offer').length >= 1, 'it spends down');
  await withOverrides({ 'gap.ferryJail': 'missed' }, async () => {
    const { g: old } = await setUp();
    assert.equal(bailReserve(old.view('a01'), N.workHeat), CLOSE.reserve * N.bailPerStar * N.wantedAt, 'the old rule: a collar tomorrow night would keep it off the boat');
  });
});

test("SUDO's cutoff follows gap.ferryJail: under 'released' a write goes through on days 12 and 13, since an arrest it brings ends at the dawn the ferry docks, and none on day 14; under 'missed' none from day nights − jailNights (§11, §13, §15; GAP gap.sudo)", () => {
  const sudoSeason = () => {
    const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler']);
    housed(g, ['a01', 'a02', 'a03', 'a04']);
    stock(g, 'a01', 'sudo', 4);
    return g;
  };
  const write = (g, taker, play) => {
    g.errand('a01', 'give', { to: taker, goods: { sudo: 1 } });
    assert.equal(g.errand(taker, 'take', { drug: 'temp' }).ok, true);
    assert.equal(g.events('take', e => e.agent === taker).at(-1).drug, 'sudo', 'control: it took SUDO');
    return g.errand('a01', 'write', { agent: taker, play });
  };
  const g = sudoSeason();
  const lastDay = N.nights - 1;
  g.advanceTo(N.nights - N.jailNights);
  assert.equal(write(g, 'a04', shift('downtown')).ok, true, `day ${g.s.day}: the write goes through`);
  g.night();
  g.advanceTo(lastDay);
  // The last day a write goes through: a02, a star short of an arrest, is written a break-in and arrested tonight.
  g.s.agents.a02.heat = N.maxHeat - 1;
  assert.equal(write(g, 'a02', { kind: 'breakin', target: 'a03' }).ok, true, `day ${lastDay}: the write goes through`);
  g.night();
  assert.equal(g.s.agents.a02.jail, null, 'its jail ended at the dawn the ferry docks');
  assert.ok(g.events('arrest').some(e => e.agent === 'a02' && e.night === lastDay), 'control: the written play got it arrested');
  const refused = write(g, 'a04', { kind: 'board', place: 'downtown' });
  assert.equal(refused.ok, false, `day ${N.nights}: no write`);
  g.night();
  assert.deepEqual([g.s.agents.a02.boarded, g.events('missed').length], [true, 0], 'a02 boarded');
  withOverrides({ 'gap.ferryJail': 'missed' }, () => {
    const old = sudoSeason();
    old.advanceTo(N.nights - N.jailNights);
    assert.equal(write(old, 'a04', shift('downtown')).ok, false, 'the old rule: none from day nights − jailNights');
  });
});

test("the bots' SUDO seller follows the same cutoff: under 'released' it still cooks SUDO on day 12, and on the last day a write goes through it stops (§11; GAP gap.sudo)", async () => {
  const { cookDrug } = await bots();
  const { g } = await world([{ type: 'chemist', trade: 'chemist', every: true, drugs: true, sudo: true }, { type: 'scout', trade: 'cop', every: true, drugs: true }]);
  const wired = { wired: { a02: N.nights - N.jailNights } };
  g.advanceTo(N.nights - N.jailNights);
  assert.deepEqual(cookDrug(g.view('a01'), { type: 'chemist', trade: 'chemist', every: true, drugs: true, sudo: true }, { ...wired }), { drug: 'sudo' }, `day ${g.s.day}: a write still goes through tomorrow`);
  g.advanceTo(N.nights - 1);
  assert.equal(cookDrug(g.view('a01'), { type: 'chemist', trade: 'chemist', every: true, drugs: true, sudo: true }, { wired: { a02: g.s.day } }), null, `day ${g.s.day}: too late to sell SUDO while a write goes through`);
});

// --- what the agents are told -----------------------------------------------------------------------------------------

test("the briefing says the law as it stands: a bounty on an agent is earned by robbing it out or at home, or by its collar, and a Cop's collar pays its stars out of the arrest's fine (§10, §13, §17; GAP gap.bounty, gap.collarPay)", async () => {
  const { briefing } = await import('../agents/briefing.mjs');
  const { read } = await import('../agents/tools.mjs');
  const g = withTrades(['cop', 'smuggler']);
  const text = id => briefing(read(g.view(id), { audience: 'seat', seed: 'R4-4' }).result).map(m => m.content).join('\n');
  for (const id of ['a01', 'a02']) assert.match(text(id), /A bounty pays whoever takes its piece, robs its agent \(a hit on it, or a break-in on its home\) or collars it, never its poster/, `${id}: the bounty rule`);
  assert.match(text('a01'), new RegExp(`pays \\$${N.copPay.star} a star out of its fine, the rest to the vault`), "the Cop seat: what a collar pays");
});
