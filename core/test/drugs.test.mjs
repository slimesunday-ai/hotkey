// Layer 3's drugs as goods, and taking them (GAME.md §8, §9, §10, §11, §13, §19, §38; brief R1-layer3-tricks.md, task
// L3-2, calls 1, 5 and 7, and slime's 10-15 call: "every dose is a real drug"), with the rows in core/numbers.mjs
// (walks, hooked, gap.doses, gap.take, gap.high, gap.temp, gap.forced, gap.firewall, gap.clear, gap.hooked). Every
// expected value was worked out from GAME.md, the brief's fills and those rows before the code ran, and every amount is
// read from N (or the money curves built on it), so tuning a number never breaks a test here.
// TRUTH, HALLU and SUDO's own effects are L3-3's, and so is the shape of their cooks and takes, so the behaviour here
// runs on TEMP, FIREWALL and CLEAR, whose effects are this task's; nothing here pins what the other three don't do yet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, abilityCopy, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { resolveFights } from '../rules/fights.mjs';
import { checkLedger, ledgerProblems } from '../rules/ledger.mjs';
import { viewFor } from '../rules/view.mjs';
import { runOf, priceOf, cornerTakings } from '../rules/market.mjs';
import { DAY15 } from '../rules/state.mjs';
import { N } from '../numbers.mjs';

const DISTRICTS = ['downtown', 'strip', 'industrial', 'suburbs', 'docks', 'junkyard', 'mall', 'forest'];
const LAWLESS = Object.fromEntries(DISTRICTS.map(d => [d, 'lawless']));
const YARDS = 'industrial';
const shift = (place = YARDS) => ({ kind: 'hustle', place });
const hit = (target, place = YARDS) => ({ kind: 'hit', target, place });
const LAYLOW = { kind: 'laylow', place: 'suburbs' };
const both = (name, fn) => {
  for (const rule of ['A', 'B']) test(`${name} (rule ${rule})`, () => fn(rule));
};
const has = (v, secret) => JSON.stringify(v).includes(secret);
// A drug's name as it shows in a view's JSON: a goods kind, or the value of a `drug` field.
const named = drug => `"${drug}"`;
const NOT_A_DRUG = /temp|truth|hallu|firewall|clear|sudo|drug|dose/i;
// §11's table, in its order.
const SECTION_11 = ['temp', 'truth', 'hallu', 'firewall', 'clear', 'sudo'];
// The first n doses in goods, in §11's order (gap.doses): what a Dealer carries to its corner, worked out here.
function firstDoses(goods, n) {
  const out = {};
  for (const d of SECTION_11) {
    const k = Math.min(n, goods[d] || 0);
    if (k) out[d] = k;
    n -= k;
  }
  return out;
}
// What's left of goods once some are gone.
const minus = (goods, gone) => Object.fromEntries(Object.entries(goods).map(([k, n]) => [k, n - (gone[k] || 0)]).filter(([, n]) => n));

// Fight-level agents at the lock: nobody armed, wanted, high or wearing anything unless it says so.
function agentsOf(ids, overrides = {}) {
  return Object.fromEntries(ids.map(id => [id, { home: true, jailed: false, crew: null, wanted: false, knuckles: false, runners: false, ...overrides[id] }]));
}
const fightOn = (r, kind, target) => r.fights.find(f => f.kind === kind && f.target === target);
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
const housed = (g, ids) => ids.forEach(id => g.grant(id, 20 * N.rent));
const ids = g => Object.keys(g.s.agents).sort();
const everyView = g => [
  ...ids(g).map(id => g.view(id, 'agent')),
  ...ids(g).map(id => g.view(id, 'ownerAI')),
  g.view(null, 'public'),
  g.view(null, 'record'),
];
const label = v => `${v.audience}${v.me ? ` (${v.me.id})` : ''}`;
// Every view but those of the agents named (theirs and their owners' AIs).
const othersThan = (g, few) => everyView(g).filter(v => !v.me || !few.includes(v.me.id));
const invalidOf = (g, id, errand) => g.events('invalid', e => e.agent === id && e.errand === errand);
const forcedOn = (r, id) => r.newEvents.filter(e => e.type === 'forced' && e.agent === id);
const playOn = (r, id) => r.newEvents.find(e => e.type === 'play' && e.agent === id);

// --- the drugs as goods (§9, §11, §38; call 1) ---------------------------------------------------------------------

test("every dose is one of the six drugs: a Dealer's kit is TEMP, a cook that names no drug makes TEMP, and one that names a drug makes that one (§9, §11, §38; call 1)", () => {
  const g = withTrades(['dealer', 'chemist', 'chemist']);
  assert.ok(N.kits.dealer.temp > 0, "control: a Dealer's kit has doses");
  assert.deepEqual(g.s.agents.a01.goods, { temp: N.kits.dealer.temp }, "a Dealer's kit is TEMP");
  assert.equal(g.s.goods.in.kit.temp, N.kits.dealer.temp, 'booked in as a kit, by drug');
  for (const id of ['a02', 'a03']) stock(g, id, 'chems', N.cook.chems);
  g.night({ a01: shift('docks'), a02: { kind: 'cook', place: 'forest', batches: 1 }, a03: { kind: 'cook', place: 'forest', batches: 1, drug: 'firewall' } });
  assert.equal(g.s.agents.a02.goods.temp, N.cook.doses, 'a batch of TEMP when the cook names no drug');
  assert.equal(g.s.agents.a03.goods.firewall, N.cook.doses);
  assert.ok(!('temp' in g.s.agents.a03.goods) && !('doses' in g.s.agents.a02.goods), 'no other kind, and no plain dose');
  assert.deepEqual(g.s.goods.in.cook, { temp: N.cook.doses, firewall: N.cook.doses });
  assert.deepEqual(g.s.goods.out.cook, { chems: 2 * N.cook.chems });
  assert.equal(g.events('play', e => e.agent === 'a03')[0].drug, 'firewall', 'the drug is a typed field of the play');
  assert.equal(g.events('cook', e => e.agent === 'a03')[0].drug, 'firewall', 'and of its cook');
  assert.equal(g.events('cook', e => e.agent === 'a03')[0].doses, N.cook.doses);
  // A drug that isn't one is refused for good, and never reaches a view.
  stock(g, 'a02', 'chems', N.cook.chems);
  const r = g.night({ a02: { kind: 'cook', place: 'forest', batches: 1, drug: 'CANARY-COOK-DRUG' } });
  const bad = r.newEvents.find(e => e.type === 'invalid' && e.agent === 'a02');
  assert.equal(bad.kind, 'never');
  assert.deepEqual(bad.play, { kind: 'cook', place: 'forest', batches: 1 }, 'the typed parts of the play are kept, the bad drug isn\'t');
  g.night();
  g.night();
  for (const v of everyView(g)) assert.ok(!has(v, 'CANARY-COOK-DRUG'), `${label(v)}: no unknown drug`);
});

test('the drugs are goods kinds: handed over and put in a crew stash by drug; there is no plain dose (§9, §10, §12; GAP gap.doses)', () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  stock(g, 'a01', 'firewall', 2);
  stock(g, 'a01', 'clear', 1);
  assert.equal(g.errand('a01', 'give', { to: 'a02', goods: { clear: 1, firewall: 1 } }).ok, true);
  assert.deepEqual(g.s.agents.a02.goods, { firewall: 1, clear: 1 });
  assert.deepEqual(Object.entries(g.events('give')[0].goods), [['firewall', 1], ['clear', 1]], "in §11's order on the record");
  assert.equal(g.errand('a01', 'give', { to: 'a02', goods: { doses: 1 } }).ok, false, 'no plain dose to hand over');
  assert.equal(invalidOf(g, 'a01', 'give')[0].kind, 'never');
  g.errand('a02', 'crew_form', { name: 'c' });
  g.errand('a02', 'stash_put', { goods: { firewall: 1 } });
  assert.deepEqual(g.s.crews.c1.goods, { firewall: 1 });
  const s = structuredClone(g.s);
  s.agents.a03.goods.doses = 1;
  s.goods.in.test.doses = 1;
  assert.ok(ledgerProblems(s).some(p => /a03 holds 1 doses/.test(p)), 'the ledger knows no plain dose');
  assert.deepEqual(ledgerProblems(g.s), [], 'positive control');
});

test("a Dealer carries its doses of every drug in §11's order, up to its cap, and the street pays the same for each; a hit on a Dealer that deals takes its takings, not its doses (§7, §9; GAP gap.doses, gap.carried, gap.holdup)", () => {
  const g = withTrades(['dealer', 'dealer', 'smuggler']);
  // Each Dealer hands its kit to a03, and deals what it's stocked with: more than a night's cap, of two or three drugs.
  for (const id of ['a01', 'a02']) g.errand(id, 'give', { to: 'a03', goods: { ...N.kits.dealer } });
  stock(g, 'a01', 'temp', 1);
  stock(g, 'a01', 'clear', N.deal.cap);
  stock(g, 'a02', 'temp', 1);
  stock(g, 'a02', 'firewall', 1);
  stock(g, 'a02', 'clear', N.deal.cap);
  // a03 brings knuckles and a gun: 3 against a lone Dealer's 1, and a heavy district's cops would make it 2.
  g.hand('a03', abilityCopy(g.s, 'knuckles'), { wear: true });
  stock(g, 'a03', 'guns', 1);
  const at = { a01: { ...g.s.agents.a01.goods }, a02: { ...g.s.agents.a02.goods } };
  const carried = { a01: firstDoses(at.a01, N.deal.cap), a02: firstDoses(at.a02, N.deal.cap) };
  assert.ok(Object.keys(carried.a01).length > 1 && Object.keys(carried.a02).length > 1, 'control: each carries more than one drug');
  const corner = 'industrial-1';
  const r = g.night({ a01: { kind: 'deal', corner }, a02: { kind: 'deal', corner: 'docks-1' }, a03: hit('a02', 'docks') });
  const sale = id => r.newEvents.find(e => e.type === 'sale' && e.agent === id);
  assert.deepEqual([sale('a01').doses, sale('a01').cash], [N.deal.cap, cornerTakings(N.deal.cap, N.corners[corner].hot)], 'TEMP and CLEAR, at the price of any doses');
  // Held up, a02 deals what it carries all the same, and the hit takes the street's cash for it (GAP gap.holdup).
  assert.deepEqual([sale('a02').doses, sale('a02').cash], [N.deal.cap, cornerTakings(N.deal.cap, N.corners['docks-1'].hot)], 'TEMP, FIREWALL and CLEAR, at the same price');
  const street = {};
  for (const c of [carried.a01, carried.a02]) for (const [k, n] of Object.entries(c)) street[k] = (street[k] || 0) + n;
  assert.deepEqual(g.s.goods.out.street, street, "both Dealers' doses reached the street");
  assert.deepEqual(g.s.agents.a01.goods, minus(at.a01, carried.a01));
  assert.deepEqual(g.s.agents.a02.goods, minus(at.a02, carried.a02), 'the first of its doses, in order, up to its cap, went; the rest stayed in its stash');
  const rob = r.newEvents.find(e => e.type === 'rob' && e.leader === 'a03');
  assert.equal(rob.cash, sale('a02').cash, 'the hit takes its takings');
  assert.equal(rob.goods, undefined, 'and none of its doses');
});

test("the city's buyer pays the same for every drug, on one curve: a sale names its drug, or sells TEMP, and (R4-3) the day's sales fill together at the lock (§9, §38; GAP gap.doses, gap.marketOrder)", () => {
  const g = withTrades(['smuggler', 'smuggler']);
  stock(g, 'a01', 'firewall', 2);
  stock(g, 'a01', 'temp', 2);
  assert.ok(runOf('buyer', 'doses', 2, 2) < runOf('buyer', 'doses', 0, 2), 'control: each unit sold lowers the price');
  assert.equal(g.errand('a01', 'sell', { item: 'doses', drug: 'firewall', units: 2 }).ok, true);
  assert.deepEqual(g.s.agents.a01.goods, { temp: 2 });
  assert.equal(g.errand('a01', 'sell', { item: 'doses', units: 2 }).ok, true);
  assert.deepEqual(g.s.agents.a01.goods, {});
  assert.equal(g.s.agents.a01.cash, 0, 'nothing is paid before the lock');
  assert.equal(g.errand('a01', 'sell', { item: 'doses', drug: 'clear' }).ok, false, 'none of that drug');
  assert.equal(g.errand('a01', 'sell', { item: 'doses', drug: 'CANARY-SELL-DRUG' }).ok, false);
  assert.deepEqual(invalidOf(g, 'a01', 'sell').map(e => e.kind), ['not-yet', 'never']);
  assert.deepEqual(g.s.orders.map(o => [o.kind, o.units]), [['firewall', 2], ['temp', 2]], 'a refused sale puts no order in');
  const r = g.night({ a01: { kind: 'laylow' }, a02: { kind: 'laylow' } });
  const sold = r.newEvents.filter(e => e.type === 'sell' && e.agent === 'a01');
  assert.equal(sold.reduce((t, e) => t + e.cash, 0), runOf('buyer', 'doses', 0, 4), 'TEMP and FIREWALL sell along one curve, four doses on it');
  assert.deepEqual(g.s.goods.out.buyer, { firewall: 2, temp: 2 });
  const move = r.newEvents.find(e => e.type === 'price' && e.side === 'buyer' && e.item === 'doses');
  assert.deepEqual([move.was, move.price], [priceOf('buyer', 'doses', 0), priceOf('buyer', 'doses', 4)], 'one price for a dose of any drug');
  assert.equal(sold[0].drug, 'firewall', 'a sale that names its drug says so');
  assert.equal('drug' in sold[1], false, 'and one that names none sells TEMP');
  g.night();
  for (const v of everyView(g)) assert.ok(!has(v, 'CANARY-SELL-DRUG'), `${label(v)}: no unknown drug`);
});

// --- taking them (§10, §11) -----------------------------------------------------------------------------------------

test('take: one dose of a drug the agent holds, one of each drug a day, in jail too; each dose taken leaves the island as `taken` (§10, §11; GAP gap.take)', () => {
  const g = withTrades(['smuggler', 'smuggler']);
  stock(g, 'a01', 'temp', 2);
  stock(g, 'a01', 'firewall', 2);
  assert.equal(g.errand('a01', 'take', { drug: 'temp' }).ok, true);
  assert.deepEqual(g.s.agents.a01.goods, { temp: 1, firewall: 2 });
  assert.deepEqual(g.s.goods.out.taken, { temp: 1 }, 'a goods sink, like the street');
  const again = g.errand('a01', 'take', { drug: 'temp' });
  assert.deepEqual([again.ok, again.why], [false, 'one dose of each drug a day']);
  assert.equal(g.errand('a01', 'take', { drug: 'firewall' }).ok, true, 'another drug the same day');
  assert.equal(g.errand('a01', 'take', { drug: 'clear' }).ok, false, 'it holds no CLEAR');
  assert.equal(g.errand('a01', 'take', { drug: 'doses' }).ok, false, 'a dose is always a drug');
  assert.equal(g.errand('a01', 'take', {}).ok, false);
  assert.deepEqual(invalidOf(g, 'a01', 'take').map(e => e.kind), ['not-yet', 'not-yet', 'never', 'never']);
  const take = g.events('take', e => e.agent === 'a01')[0];
  assert.deepEqual([take.drug, take.vis.to, take.vis.pub], ['temp', ['a01'], g.s.clock + 2], "the taker's own now, everyone's 24 hours later");
  g.night();
  assert.equal(g.errand('a01', 'take', { drug: 'firewall' }).ok, true, 'a new day');
  g.s.agents.a01.jail = { nights: 2, stars: 1, since: g.s.day - 1 };
  assert.equal(g.errand('a01', 'take', { drug: 'temp' }).ok, true, 'in jail too: errands need no place');
  assert.deepEqual(g.s.goods.out.taken, { temp: 2, firewall: 2 });
});

both('TEMP: +1 strength tonight, attacking and defending, a backer as well (§8, §11; GAP gap.temp)', rule => {
  const run = (agents, plays) => resolveFights({ agents: agentsOf(Object.keys(plays), agents), plays, levels: LAWLESS, rule });
  let f = fightOn(run({ x: { temp: true } }, { x: hit('y'), y: shift() }), 'hit', 'y');
  assert.deepEqual([f.attackers[0].strength, f.defence, f.winner], [2, 1, 'x'], 'on TEMP, 2 against 1');
  f = fightOn(run({ x: { temp: true }, y: { temp: true } }, { x: hit('y'), y: shift() }), 'hit', 'y');
  // gap.jump 'alone' (R8, slime 10-19: "do 1 and 2"): y is out working alone, so x wins the tie.
  assert.deepEqual([f.attackers[0].strength, f.defence, f.winner], [2, 2, 'x'], 'both on TEMP: a tie, which x wins on y out working alone');
  // R4-2 (gap.accept): x accepts its backer.
  f = fightOn(run({ b: { temp: true } }, { x: { ...hit('y'), accept: ['b'] }, b: { kind: 'back', target: 'x' }, y: shift() }), 'hit', 'y');
  assert.deepEqual([f.attackers[0].strength, f.winner], [3, 'x'], 'a backer on TEMP brings 2');
  f = fightOn(run({ x: { temp: true, knuckles: true }, y: { temp: true } }, { x: { kind: 'breakin', target: 'y', place: 'suburbs' }, y: LAYLOW }), 'breakin', 'y');
  assert.deepEqual([f.attackers[0].strength, f.defence, f.winner], [3, 4, null], 'at home: 1 for the lock, 2 for the owner on TEMP, 1 for laying low');
});

test('TEMP taken by day counts in tonight\'s fight (§5, §8, §11)', () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler']);
  stock(g, 'a01', 'temp', 1);
  g.errand('a01', 'take', { drug: 'temp' });
  const r = g.night({ a01: hit('a02'), a02: shift(), a03: hit('a04'), a04: shift() });
  const fight = target => r.newEvents.find(e => e.type === 'fight' && e.target === target);
  assert.deepEqual(fight('a02').sides, [{ size: 1, strength: 2 }], 'on TEMP');
  assert.deepEqual(fight('a04').sides, [{ size: 1, strength: 1 }], 'control: not on TEMP');
});

test('TEMP crashes the next night: the agent can only lay low, forced and typed as forced, never invalid; TEMP taken while crashing crashes again; jail comes first (§11; GAP gap.temp, gap.forced)', () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ['a01', 'a02', 'a03', 'a04']);
  stock(g, 'a01', 'temp', 2);
  g.hand('a02', abilityCopy(g.s, 'knuckles'), { wear: true });
  g.errand('a01', 'take', { drug: 'temp' });
  let r = g.night({ a01: shift('docks') });
  assert.equal(playOn(r, 'a01').kind, 'hustle', 'the night it takes TEMP is its own');
  const crash = g.events('crash', e => e.agent === 'a01');
  assert.equal(crash.length, 1, 'tomorrow night\'s crash is set at dawn');
  assert.deepEqual([crash[0].night, crash[0].vis.to, crash[0].vis.pub], [2, ['a01'], g.s.clock + 2], "the agent's own now, everyone's 24 hours later");
  assert.equal(g.view('a01').me.crash, true);
  assert.deepEqual(g.view('a01').legal, [LAYLOW], 'its one play tonight');
  // Crashing, it takes TEMP again: +1 at home tonight, and another crash tomorrow night.
  g.errand('a01', 'take', { drug: 'temp' });
  r = g.night({ a01: { ...hit('a03', 'docks'), reason: 'r' }, a02: { kind: 'breakin', target: 'a01' } });
  assert.deepEqual([playOn(r, 'a01').kind, playOn(r, 'a01').place], ['laylow', 'suburbs']);
  const forced = forcedOn(r, 'a01');
  assert.equal(forced.length, 1);
  assert.deepEqual([forced[0].why, forced[0].play, forced[0].instead], ['crash', { kind: 'hit', place: 'docks', target: 'a03' }, LAYLOW]);
  assert.equal(r.newEvents.filter(e => e.type === 'invalid' && e.agent === 'a01').length, 0, 'never invalid');
  const breakin = r.newEvents.find(e => e.type === 'fight' && e.kind === 'breakin');
  assert.deepEqual([breakin.defence - breakin.cops, breakin.won], [4, false], 'the home: 1 for the lock, 2 for a01 on TEMP, 1 for laying low');
  assert.equal(g.events('crash', e => e.agent === 'a01').length, 2, 'TEMP taken while crashing still crashes the next night');
  r = g.night({ a01: shift('docks') });
  assert.deepEqual([playOn(r, 'a01').kind, forcedOn(r, 'a01')[0].why], ['laylow', 'crash']);
  assert.equal(g.view('a01').me.crash, false, 'no TEMP yesterday: no crash tonight');
  r = g.night({ a01: shift('docks') });
  assert.deepEqual([playOn(r, 'a01').kind, forcedOn(r, 'a01').length], ['hustle', 0]);
  // An evicted agent can't lay low: its crash is its default play, a shift in Glasswall (gap.defaultPlay).
  stock(g, 'a04', 'temp', 1);
  g.s.agents.a04.evicted = true;
  g.errand('a04', 'take', { drug: 'temp' });
  g.night();
  r = g.night({ a04: shift('docks') });
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the evicted default is a hustle at the Mall, not a shift in Glasswall.
  assert.deepEqual(forcedOn(r, 'a04')[0].instead, { kind: 'hustle', place: 'mall' });
  // Jail comes first: a crashing agent in jail has no play to force.
  stock(g, 'a03', 'temp', 1);
  g.errand('a03', 'take', { drug: 'temp' });
  g.night();
  g.s.agents.a03.jail = { nights: 2, stars: 1, since: g.s.day - 1 };
  r = g.night();
  assert.deepEqual([playOn(r, 'a03'), forcedOn(r, 'a03').length], [undefined, 0]);
});

test('hooked: the same drug three days running hooks the agent on it; on a night without it, it can only lay low; three dawns with no drug at all end every hook with a public clean mark, and jail days count (§11; GAP gap.hooked; call 7)', () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  housed(g, ['a01', 'a02', 'a03']);
  stock(g, 'a01', 'firewall', 4);
  stock(g, 'a01', 'clear', 1);
  stock(g, 'a02', 'firewall', 3);
  for (let day = 1; day <= 3; day++) {
    assert.equal(g.events('hooked').length, 0, `not hooked before its third night (day ${day})`);
    g.errand('a01', 'take', { drug: 'firewall' });
    g.errand('a02', 'take', { drug: 'firewall' });
    g.night();
  }
  const hooked = g.events('hooked');
  assert.deepEqual(hooked.map(e => [e.agent, e.drug, e.day]), [['a01', 'firewall', 4], ['a02', 'firewall', 4]]);
  assert.ok(hooked.every(e => e.vis.to.length === 1 && e.vis.to[0] === e.agent && e.vis.pub === 10), "the agent's own now, everyone's 24 hours later");
  for (const v of othersThan(g, ['a01', 'a02'])) assert.ok(!v.events.some(e => e.type === 'hooked'), `a hook, live, in ${label(v)}`);
  assert.ok(g.view('a01').events.some(e => e.type === 'hooked' && e.agent === 'a01' && e.drug === 'firewall'), 'positive control: the agent knows');
  assert.ok(!g.view('a01').events.some(e => e.type === 'hooked' && e.agent === 'a02'), "and not another's");
  assert.deepEqual(g.view('a01').me.hooked, ['firewall']);
  // Day 4: a01 takes nothing, so it can only lay low; a02 goes to jail for two nights.
  assert.deepEqual(g.view('a01').legal, [LAYLOW]);
  g.s.agents.a02.jail = { nights: 2, stars: 1, since: 3 };
  let r = g.night({ a01: shift() });
  assert.deepEqual([playOn(r, 'a01').kind, forcedOn(r, 'a01')[0].why], ['laylow', 'withdrawal']);
  assert.equal(forcedOn(r, 'a02').length, 0, 'in jail: no play to force');
  assert.ok(g.view(null, 'public').events.some(e => e.type === 'hooked' && e.agent === 'a01'), 'the hook is everyone\'s 24 hours later');
  // Day 5: its drug, so its own play.
  g.errand('a01', 'take', { drug: 'firewall' });
  assert.ok(g.view('a01').legal.length > 1);
  r = g.night({ a01: shift() });
  assert.deepEqual([playOn(r, 'a01').kind, forcedOn(r, 'a01').length], ['hustle', 0]);
  // Day 6: nothing for either. a02 is out of jail, and its two jail days count: its third clean dawn is dawn 7.
  r = g.night({ a01: shift(), a02: shift() });
  assert.deepEqual([forcedOn(r, 'a01')[0].why, forcedOn(r, 'a02')[0].why], ['withdrawal', 'withdrawal']);
  const clean = g.events('clean');
  assert.deepEqual(clean.map(e => [e.agent, e.day, e.vis.to]), [['a02', 7, 'all']], 'a public clean mark, at once');
  assert.deepEqual(g.view('a02').me.hooked, [], 'every hook ends');
  // Day 7: a01 takes CLEAR, another drug: still in withdrawal from FIREWALL, and not a clean day (call 7).
  g.errand('a01', 'take', { drug: 'clear' });
  r = g.night({ a01: shift(), a02: shift() });
  assert.deepEqual([forcedOn(r, 'a01')[0].why, playOn(r, 'a02').kind], ['withdrawal', 'hustle']);
  // Days 8-10: clean; its third clean dawn is dawn 11.
  for (let day = 8; day <= 10; day++) {
    r = g.night({ a01: shift() });
    assert.equal(forcedOn(r, 'a01').length, 1, `still hooked on night ${day}`);
  }
  assert.deepEqual(g.events('clean').map(e => [e.agent, e.day]), [['a02', 7], ['a01', 11]]);
  r = g.night({ a01: shift() });
  assert.deepEqual([playOn(r, 'a01').kind, forcedOn(r, 'a01').length], ['hustle', 0], 'clean: its own play again');
  assert.equal(g.events('forced', e => e.agent === 'a01').length, 6, 'nights 4, 6, 7, 8, 9 and 10');
});

test("FIREWALL: until dawn no sit-down with the agent goes through, nor a hand-over, pay, swap or crew invite to it, as not-yet, and the reason never names the drug (§11, §14; GAP gap.firewall)", () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ['a01', 'a02', 'a03', 'a04']);
  stock(g, 'a02', 'firewall', 1);
  g.errand('a01', 'ask', { to: 'a02' });
  const open = Object.keys(g.s.sitdowns)[0];
  g.errand('a02', 'answer', { sitdown: open, accept: true });
  g.errand('a03', 'ask', { to: 'a02' });
  const asked = Object.keys(g.s.sitdowns)[1];
  g.errand('a01', 'crew_form', { name: 'c' });
  assert.equal(g.errand('a02', 'take', { drug: 'firewall' }).ok, true);
  const tries = [
    ['a01', 'give', { to: 'a02', cash: 5 }], ['a01', 'pay', { to: 'a02', amount: 5 }], ['a01', 'crew_invite', { agent: 'a02' }],
    ['a01', 'fence_swap', { to: 'a02', give: { cash: 5 }, get: { cash: 1 } }], ['a04', 'ask', { to: 'a02' }], ['a02', 'ask', { to: 'a04' }],
    ['a02', 'answer', { sitdown: asked, accept: true }], ['a01', 'say', { sitdown: open, say: 'offer', terms: { what: 'trade' } }],
    ['a02', 'say', { sitdown: open, say: 'offer', terms: { what: 'trade' } }],
  ];
  for (const [by, kind, fields] of tries) {
    const r = g.errand(by, kind, fields);
    assert.equal(r.ok, false, `${by} ${kind}`);
    assert.ok(!NOT_A_DRUG.test(r.why), `${by} ${kind}: "${r.why}" names no drug`);
  }
  const refused = g.events('invalid', e => e.day === 1);
  assert.equal(refused.length, tries.length);
  assert.ok(refused.every(e => e.kind === 'not-yet'), 'not yet: it wears off at dawn');
  // Controls: the same errands to anyone else go through, and what a02 sends itself still goes.
  assert.equal(g.errand('a01', 'give', { to: 'a03', cash: 5 }).ok, true);
  assert.equal(g.errand('a01', 'crew_invite', { agent: 'a03' }).ok, true);
  assert.equal(g.errand('a04', 'ask', { to: 'a03' }).ok, true);
  const cash = g.s.agents.a02.cash;
  assert.equal(g.errand('a02', 'give', { to: 'a01', cash: 5 }).ok, true);
  assert.equal(g.s.agents.a02.cash, cash - 5);
  g.night();
  assert.equal(g.errand('a01', 'give', { to: 'a02', cash: 5 }).ok, true, 'at dawn it wears off');
  assert.equal(g.errand('a04', 'ask', { to: 'a02' }).ok, true);
  assert.equal(g.errand('a01', 'crew_invite', { agent: 'a02' }).ok, true);
});

test('CLEAR: an arrest tonight seizes nothing, no piece and no fine, and jail clears its stars as ever; the arrest looks like any other (§11, §13; call 5 revised; GAP gap.clear)', () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler']);
  // A heavy district: 1 against 1 and the city cops' 1, so both hits lose and both robbers are arrested.
  const heavy = DISTRICTS.find(d => N.levels[d] === 'heavy' && ['downtown', 'industrial', 'docks'].includes(d));
  assert.ok(heavy, 'control: a heavy district with shifts in it');
  const piece = {};
  for (const [i, id] of ['a01', 'a03'].entries()) {
    g.grant(id, 100);
    piece[id] = g.hand(id, tierCopy(g.s, 'rare', () => true, i), { wear: true });
    g.s.agents[id].heat = 2;
  }
  stock(g, 'a01', 'clear', 1);
  g.errand('a01', 'take', { drug: 'clear' });
  const r = g.night({ a01: hit('a02', heavy), a02: shift(heavy), a03: hit('a04', heavy), a04: shift(heavy) });
  const arrest = id => ({ ...r.newEvents.find(e => e.type === 'arrest' && e.agent === id), ...r.newEvents.find(e => e.type === 'seized' && e.agent === id) });
  assert.deepEqual([arrest('a01').copy, arrest('a01').fine, arrest('a01').stars, arrest('a01').bail], [null, 0, 3, 3 * N.bailPerStar], 'nothing seized; bail as ever');
  assert.deepEqual([g.s.agents.a01.cash, g.s.copies[piece.a01].holder], [100, { k: 'agent', id: 'a01' }]);
  assert.equal(g.s.agents.a01.heat, 0, 'jail clears its stars, as ever');
  assert.deepEqual([arrest('a03').copy, arrest('a03').fine, g.s.agents.a03.heat], [piece.a03, 50, 0], 'control: without CLEAR, its piece, half its cash, and its stars');
  assert.deepEqual(Object.keys(arrest('a01')), Object.keys(arrest('a03')), 'the arrest shows no field the drug adds');
  g.night();
  assert.equal(g.s.agents.a01.heat, 0, 'still, a night later in jail');
});

test("CLEAR: the agent's view loses its private events from the last 24 hours until they go public, and today's sit-down words before it; its own state and the board stay (§11, §19; calls 3 and 5; GAP gap.clear)", () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  stock(g, 'a01', 'clear', 1);
  g.night({ a01: { ...shift('docks'), reason: 'CANARY-CLEAR-NIGHT' } });
  g.grant('a02', 5000);
  g.errand('a02', 'give', { to: 'a01', cash: 4242 });
  g.errand('a03', 'ask', { to: 'a01', line: 'CANARY-CLEAR-ASK' });
  const sd = Object.keys(g.s.sitdowns)[0];
  g.errand('a01', 'answer', { sitdown: sd, accept: true });
  g.errand('a03', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', cash: 31337 }, line: 'CANARY-CLEAR-SAY' });
  const canaries = ['CANARY-CLEAR-NIGHT', 'CANARY-CLEAR-ASK', 'CANARY-CLEAR-SAY', '31337'];
  for (const c of canaries) assert.ok(has(g.view('a01'), c), `positive control: a01 knows ${c}`);
  assert.ok(g.view('a01').events.some(e => e.type === 'give' && e.cash === 4242));
  g.errand('a01', 'take', { drug: 'clear' });
  for (const v of [g.view('a01'), g.view('a01', 'ownerAI')]) {
    for (const c of canaries) assert.ok(!has(v, c), `${label(v)}: ${c} is wiped`);
    assert.ok(!v.events.some(e => e.type === 'give' || e.type === 'holdings'), `${label(v)}: the hand-over and last dawn's record too`);
    assert.ok(v.events.some(e => e.type === 'take' && e.drug === 'clear'), `${label(v)}: it knows what it took`);
    assert.ok(v.events.some(e => e.type === 'meet'), `${label(v)}: what's public stays`);
    assert.ok(v.me.cash >= 4242 && v.me.sitdowns.length === 1, `${label(v)}: its own state stays`);
  }
  assert.ok(has(g.view('a03'), 'CANARY-CLEAR-SAY'), 'only the taker forgets');
  g.errand('a03', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade' }, line: 'CANARY-CLEAR-AFTER' });
  assert.ok(has(g.view('a01'), 'CANARY-CLEAR-AFTER'), 'what it learns after the take, it keeps');
  // Tonight (clock 5) last night's record goes public, so the taker reads it with everyone; today's waits for the morning.
  const tonight = viewFor({ ...g.s, clock: 5 }, g.log, 'a01');
  assert.ok(has(tonight, 'CANARY-CLEAR-NIGHT'));
  assert.ok(!has(tonight, 'CANARY-CLEAR-ASK') && !has(tonight, 'CANARY-CLEAR-SAY'));
  g.night();
  for (const c of canaries) assert.ok(has(g.view('a01'), c), `${c}: public, so it's back`);
});

test('being high shows: the walk on the board, wired, spaced out or guarded, hidden by shades; a public `high` event carries only the walk; highs end at dawn (§11, §19; walks, GAP gap.high)', () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler', 'smuggler', 'smuggler']);
  stock(g, 'a01', 'temp', 1);
  stock(g, 'a02', 'firewall', 1);
  stock(g, 'a03', 'clear', 1);
  stock(g, 'a04', 'temp', 1);
  stock(g, 'a05', 'firewall', 1);
  stock(g, 'a05', 'temp', 1);
  g.hand('a04', abilityCopy(g.s, 'shades'), { wear: true });
  const walks = () => Object.fromEntries(g.view(null, 'public').board.agents.map(a => [a.id, a.walk]));
  assert.ok(Object.values(walks()).every(w => w === null), 'control: nobody high, no walk');
  g.errand('a01', 'take', { drug: 'temp' });
  g.errand('a02', 'take', { drug: 'firewall' });
  g.errand('a03', 'take', { drug: 'clear' });
  g.errand('a04', 'take', { drug: 'temp' });
  g.errand('a05', 'take', { drug: 'firewall' });
  g.errand('a05', 'take', { drug: 'temp' });
  assert.deepEqual(walks(), { a01: 'wired', a02: 'guarded', a03: 'spaced', a04: null, a05: 'wired', a06: null }, "a05 on two: the first of §11's order with a walk");
  const highs = g.view(null, 'public').events.filter(e => e.type === 'high');
  assert.deepEqual(highs.map(e => [e.agent, e.walk]), [['a01', 'wired'], ['a02', 'guarded'], ['a03', 'spaced'], ['a05', 'guarded'], ['a05', 'wired']], 'one each time the board changes; none behind shades');
  for (const e of highs) assert.deepEqual(Object.keys(e).sort(), ['agent', 'day', 'n', 't', 'type', 'walk'], 'only the walk');
  // §11's table for the other three: HALLU looks like CLEAR, SUDO like TEMP, and TRUTH shows only in how the agent talks.
  g.s.agents.a06.high = ['hallu'];
  assert.equal(walks().a06, 'spaced');
  g.s.agents.a06.high = ['sudo'];
  assert.equal(walks().a06, 'wired');
  g.s.agents.a06.high = ['truth'];
  assert.equal(walks().a06, null);
  g.s.agents.a06.high = [];
  g.night();
  assert.ok(Object.values(walks()).every(w => w === null), 'every high ends at dawn');
});

// --- who sees what, and when (§19) ----------------------------------------------------------------------------------

test("a drug's name never shows live: a take, a crash, a forced night, a cook, a sale and a hand-over are the agents' own now and everyone's 24 hours later (§11, §19; slime's standing call)", () => {
  const g = withTrades(['chemist', 'smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  stock(g, 'a01', 'chems', N.cook.chems);
  stock(g, 'a02', 'temp', 2);
  stock(g, 'a03', 'firewall', 1);
  stock(g, 'a04', 'clear', 2);
  const secretFrom = (few, drugs, when) => {
    for (const v of othersThan(g, few)) for (const d of drugs) assert.ok(!has(v, named(d)), `${when}: ${d} in ${label(v)}`);
  };
  // Day 1: two takes.
  g.errand('a02', 'take', { drug: 'temp' });
  g.errand('a03', 'take', { drug: 'firewall' });
  secretFrom(['a02', 'a03'], ['temp', 'firewall'], 'day 1');
  for (const v of othersThan(g, ['a02', 'a03'])) assert.ok(!v.events.some(e => 'drug' in e), `day 1: a drug field in ${label(v)}`);
  assert.ok(has(g.view('a02'), named('temp')) && has(g.view('a02', 'ownerAI'), named('temp')), 'positive control: the taker and its owner\'s AI');
  assert.ok(has(g.view('a03'), named('firewall')));
  assert.ok(!has(g.view('a02'), named('firewall')), 'one taker never sees another\'s');
  // Night 1: a cook that names CLEAR.
  g.night({ a01: { kind: 'cook', place: 'forest', batches: 1, drug: 'clear' } });
  assert.ok(g.view(null, 'public').events.some(e => e.type === 'take' && e.agent === 'a02' && e.drug === 'temp'), 'day 1\'s takes are public on day 2');
  assert.ok(g.view(null, 'public').events.some(e => e.type === 'take' && e.agent === 'a03' && e.drug === 'firewall'));
  // Day 2: a02 crashes tonight; a04 sells CLEAR to the city's buyer and hands one to a05.
  g.errand('a04', 'sell', { item: 'doses', drug: 'clear', units: 1 });
  g.errand('a04', 'give', { to: 'a05', goods: { clear: 1 } });
  secretFrom(['a01', 'a04', 'a05'], ['clear'], 'day 2');
  assert.ok(has(g.view('a01'), named('clear')) && has(g.view('a04'), named('clear')) && has(g.view('a05'), named('clear')), 'positive control: the cook, the seller and the receiver');
  for (const v of othersThan(g, ['a02'])) assert.ok(!v.events.some(e => e.type === 'crash'), `day 2: the crash in ${label(v)}`);
  assert.ok(g.view('a02').events.some(e => e.type === 'crash'), 'positive control: the agent knows');
  // Night 2: a02's forced lay low.
  g.night({ a02: shift() });
  for (const v of othersThan(g, ['a02'])) assert.ok(!v.events.some(e => e.type === 'forced'), `day 3: the forced night in ${label(v)}`);
  assert.ok(g.view('a02').events.some(e => e.type === 'forced'), 'positive control');
  const pub = g.view(null, 'public');
  assert.ok(pub.events.some(e => e.type === 'cook' && e.agent === 'a01' && e.drug === 'clear'), 'the cook, 24 hours later');
  assert.ok(pub.events.some(e => e.type === 'sell' && e.agent === 'a04' && e.drug === 'clear'), 'the sale');
  assert.ok(pub.events.some(e => e.type === 'crash' && e.agent === 'a02'), 'the crash');
  g.night();
  assert.ok(g.view(null, 'public').events.some(e => e.type === 'forced' && e.agent === 'a02' && e.why === 'crash'), 'the forced night');
});

// --- live, a drug is only a dose to everyone it doesn't involve (§9, §11, §19; slime's standing call) ----------------

// Every view at the state's clock: the board never names a drug, and no event names one to an audience it doesn't
// involve before its 24 hours are up. An event involves the agents it's shown to live (a public one, the agent it's
// about); a public one's 24 hours end at day 15 for the last night's, as the last night's record does (§19).
function liveCanary(s, log, when) {
  const byN = new Map(log.map(e => [e.n, e]));
  const audiences = [[null, 'public'], [null, 'record'], ...Object.keys(s.agents).sort().flatMap(id => [[id, 'agent'], [id, 'ownerAI']])];
  for (const [who, audience] of audiences) {
    const v = viewFor(s, log, who, audience);
    const where = `${when}, ${audience}${who ? ` (${who})` : ''}`;
    for (const d of SECTION_11) assert.ok(!has(v.board, named(d)), `${where}: ${d} on the board`);
    for (const ev of v.events) {
      const e = byN.get(ev.n);
      const involved = !!who && (e.vis.to === 'all' ? e.agent === who : e.vis.to.includes(who));
      const until = e.vis.to === 'all' ? Math.min(e.t + 2, DAY15) : e.vis.pub;
      if (involved || s.clock >= until) continue;
      for (const d of SECTION_11) assert.ok(!has(ev, named(d)), `${where}: ${d} in a ${e.type} event, live`);
    }
  }
}

test("live, a drug is only a dose to anyone it doesn't involve: over a season of all six drugs moving as goods, neither the board nor any event an audience isn't in names one before its 24 hours are up (§9, §11, §19; slime's standing call)", () => {
  const g = withTrades(['chemist', 'chemist', 'dealer', 'dealer', 'smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  for (const d of ['truth', 'hallu', 'sudo']) stock(g, 'a01', d, 4);
  for (const d of ['temp', 'firewall', 'clear']) stock(g, 'a02', d, 4);
  for (const d of ['truth', 'hallu', 'sudo', 'firewall', 'clear']) stock(g, 'a03', d, 2);
  stock(g, 'a04', 'clear', 3);
  for (const d of SECTION_11) stock(g, 'a08', d, 1);
  g.hand('a05', abilityCopy(g.s, 'knuckles'), { wear: true });
  stock(g, 'a05', 'guns', 1);
  stock(g, 'a06', 'guns', 1);
  g.hand('a07', abilityCopy(g.s, 'earpiece'), { wear: true });
  const check = when => liveCanary(g.s, g.log, when);
  // Day 1: hand-overs, the crew stash and a rug, a swap at the fence, a sit-down an earpiece overhears, a named sale, a
  // lookout and a take.
  g.errand('a01', 'give', { to: 'a02', goods: { truth: 1, sudo: 1 } });
  g.errand('a02', 'give', { to: 'a01', goods: { firewall: 1, clear: 1 } });
  g.errand('a05', 'crew_form', { name: 'c' });
  g.errand('a05', 'crew_invite', { agent: 'a06' });
  g.errand('a06', 'crew_join', { crew: 'c1' });
  g.errand('a01', 'give', { to: 'a05', goods: { hallu: 1 } });
  g.errand('a05', 'stash_put', { goods: { hallu: 1 } });
  g.errand('a06', 'stash_take', { goods: { hallu: 1 } });
  g.errand('a01', 'fence_swap', { to: 'a02', give: { goods: { truth: 1 } }, get: { goods: { clear: 1 } } });
  g.errand('a02', 'fence_accept', { deal: g.events('fence', e => e.act === 'swap')[0].deal });
  g.errand('a01', 'ask', { to: 'a02' });
  const sd = Object.keys(g.s.sitdowns)[0];
  g.errand('a02', 'answer', { sitdown: sd, accept: true });
  g.errand('a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { hallu: 2 }, cash: 30 } });
  g.errand('a07', 'listen', { sitdown: sd });
  g.errand('a02', 'say', { sitdown: sd, say: 'answer', terms: { what: 'trade', goods: { sudo: 1 } } });
  g.errand('a04', 'sell', { item: 'doses', drug: 'clear', units: 1 });
  g.errand('a07', 'lookout', { agent: 'a01' });
  g.errand('a02', 'take', { drug: 'temp' });
  assert.ok(has(g.view('a07').events.filter(e => e.type === 'say'), named('sudo')), 'an earpiece hears the talk live, its terms too');
  check('day 1');
  // Night 1: two Dealers carry mixed drugs to one open corner and tie for it, so neither deals (GAP gap.corners), and a05
  // robs one of the doses it carries (a hit on a Dealer that deals takes its takings instead, GAP gap.holdup).
  g.night({ a03: { kind: 'deal', corner: 'industrial-1' }, a04: { kind: 'deal', corner: 'industrial-1' }, a05: hit('a03') });
  assert.ok(g.view('a05').events.some(e => e.type === 'rob' && SECTION_11.some(d => has(e, named(d)))), 'positive control: the robber sees what it took');
  check('day 2');
  // Days 2 to 10: doses keep changing hands, and into the crew stash.
  for (let day = 2; day <= 10; day++) {
    const d = SECTION_11[day % SECTION_11.length];
    const giver = ['a01', 'a02', 'a03', 'a04'].find(id => g.s.agents[id].goods[d]);
    if (giver) g.errand(giver, 'give', { to: 'a07', goods: { [d]: 1 } });
    const held = SECTION_11.find(x => g.s.agents.a07.goods[x]);
    if (held) {
      g.errand('a07', 'give', { to: 'a05', goods: { [held]: 1 } });
      g.errand('a05', 'stash_put', { goods: { [held]: 1 } });
    }
    g.night();
    check(`day ${day + 1}`);
  }
  // Dawn 11: the crate is posted, public at once, and gets a dose of every drug, so all six ride in it.
  const posted = g.events('shipment').at(-1);
  const shipped = SECTION_11.filter(d => posted.goods[d]);
  for (const d of SECTION_11) g.s.crate.goods[d] = (g.s.crate.goods[d] || 0) + 1;
  check('day 11');
  const live = g.view(null, 'public');
  const units = goods => Object.values(goods).reduce((t, n) => t + n, 0);
  assert.equal(live.board.crate.goods.doses, SECTION_11.reduce((t, d) => t + g.s.crate.goods[d], 0), 'live, the crate shows its drugs as doses');
  assert.equal(units(live.events.find(e => e.n === posted.n).goods), units(posted.goods), 'and so does its posting, unit for unit');
  // Night 11: a06 grabs it.
  g.night({ a06: { kind: 'grab', place: 'docks' } });
  check('day 12');
  const grab = g.view('a06').events.filter(e => e.type === 'grab');
  assert.ok(SECTION_11.every(d => has(grab, named(d))), 'positive control: the grabber sees every drug it took');
  const later = g.view(null, 'public').events.find(e => e.n === posted.n);
  assert.ok(shipped.every(d => has(later, named(d))), "24 hours on, the posting's drugs are public by name");
  // Days 12 to 14: a08 goes to jail with a dose of each drug, so it misses the ferry with them.
  g.night();
  check('day 13');
  g.night();
  g.s.agents.a08.jail = { nights: 2, stars: 1, since: 13 };
  check('day 14');
  g.night();
  const night14 = { ...g.s, clock: DAY15 - 1 };
  const before15 = g.log.filter(e => e.t < DAY15);
  liveCanary(night14, before15, 'night 14');
  const missedLive = viewFor(night14, before15, null, 'public').events.find(e => e.type === 'missed' && e.agent === 'a08');
  assert.equal(missedLive.goods.doses, SECTION_11.length, "on the last night a08's drugs go down with it as doses");
  check('day 15');
  const missed = g.view(null, 'public').events.find(e => e.type === 'missed' && e.agent === 'a08');
  assert.ok(SECTION_11.every(d => has(missed, named(d))), "on day 15 the last night's record is public, the drugs by name");
  for (const d of SECTION_11) {
    assert.ok(g.log.some(e => ['give', 'stash', 'fence', 'say', 'rob', 'grab', 'missed'].includes(e.type) && has(e, named(d))), `control: ${d} moved as goods`);
  }
});
