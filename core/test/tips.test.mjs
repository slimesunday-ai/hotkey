// Layer 3's tips and bribes (GAME.md §6, §8, §12, §13, §19, §38; brief R1-layer3-tricks.md, task L3-1 and call 6), with
// the rows in core/numbers.mjs (bribe, gap.tip, gap.bribe). Every expected value was worked out from GAME.md, the brief's
// fills and those rows before the code ran. Fight-level cases call resolveFights directly, as the DATC suite does, and
// run under both cut rules; night-level cases go through the errands and settleNight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, abilityCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { resolveFights } from '../rules/fights.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';

const DISTRICTS = ['downtown', 'strip', 'industrial', 'suburbs', 'docks', 'junkyard', 'mall', 'forest'];
const NORMAL = Object.fromEntries(DISTRICTS.map(d => [d, 'normal']));
const LAWLESS = Object.fromEntries(DISTRICTS.map(d => [d, 'lawless']));
const YARDS = 'industrial';
const shift = (place = YARDS) => ({ kind: 'hustle', place });
const hit = (target, place = YARDS) => ({ kind: 'hit', target, place });
const back = target => ({ kind: 'back', target });
// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the helpers' filler is a hustle at the Mall now; a test whose hit finds a filler at the docks passes this one.
const DOCKS = { filler: { kind: 'hustle', place: 'docks' } };
const both = (name, fn) => {
  for (const rule of ['A', 'B']) test(`${name} (rule ${rule})`, () => fn(rule));
};
const has = (v, secret) => JSON.stringify(v).includes(secret);

// Fight-level agents at the lock: nobody armed, wanted or wearing anything unless it says so.
function agentsOf(ids, overrides = {}) {
  return Object.fromEntries(ids.map(id => [id, { home: true, jailed: false, crew: null, wanted: false, knuckles: false, runners: false, ...overrides[id] }]));
}
const fightOn = (r, kind, target) => r.fights.find(f => f.kind === kind && f.target === target);
const fightEvent = (r, kind, target) => r.newEvents.find(e => e.type === 'fight' && e.kind === kind && e.target === target);
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
const everyView = g => [
  ...Object.keys(g.s.agents).sort().map(id => g.view(id, 'agent')),
  ...Object.keys(g.s.agents).sort().map(id => g.view(id, 'ownerAI')),
  g.view(null, 'public'),
  g.view(null, 'record'),
];
const label = v => `${v.audience}${v.me ? ` (${v.me.id})` : ''}`;

// --- tips: when one is right, and what it does (§8, §13) ------------------------------------------------------------

both('a tip is right if the agent it names leads or backs an attack on the target it names: city cops +2 for the defence', rule => {
  const agents = agentsOf(['x', 'b', 'y', 'w']);
  // R4-2 (gap.accept): x accepts its backer.
  const plays = { x: { ...hit('y'), accept: ['b'] }, b: back('x'), y: shift(), w: shift() };
  const run = tips => fightOn(resolveFights({ agents, plays, levels: NORMAL, rule, tips }), 'hit', 'y');
  const plain = run([]);
  assert.deepEqual([plain.cops, plain.defence, plain.winner], [0, 1, 'x'], 'control: 2 against 1');
  for (const named of ['x', 'b']) {
    const f = run([{ by: 'w', agent: named, target: 'y' }]);
    assert.deepEqual([f.tipped, f.cops, f.defence, f.winner, f.arrested], [true, 2, 3, null, ['b', 'x']], `naming ${named}: 2 against 1 + 2`);
  }
  for (const [named, target] of [['x', 'w'], ['w', 'y'], ['y', 'x']]) {
    const f = run([{ by: 'w', agent: named, target }]);
    assert.deepEqual([f.tipped, f.cops, f.winner], [undefined, 0, 'x'], `naming ${named} and ${target} is wrong, and changes nothing`);
  }
});

both('a tip can name a break-in on a home, and the grab, whose target is the crate', rule => {
  const tip = target => [{ by: 'w', agent: 'x', target }];
  const breakin = resolveFights({
    agents: agentsOf(['x', 'y', 'w'], { x: { knuckles: true } }), plays: { x: { kind: 'breakin', target: 'y', place: 'suburbs' }, y: shift(), w: shift() },
    levels: NORMAL, rule, tips: tip('y'),
  });
  const home = fightOn(breakin, 'breakin', 'y');
  assert.deepEqual([home.tipped, home.defence, home.winner, home.arrested], [true, 3, null, ['x']], "2 against an empty home's lock and the city cops' 2");
  const grab = resolveFights({ agents: agentsOf(['x', 'w']), plays: { x: { kind: 'grab', place: 'docks' }, w: shift() }, levels: NORMAL, rule, tips: tip('crate') });
  const crate = grab.fights.find(f => f.kind === 'grab');
  assert.deepEqual([crate.tipped, crate.cops, crate.winner, crate.arrested], [true, 2, null, ['x']], '1 against the city cops 2');
});

both("corners and collars can't be tipped, and a cut backer never arrives, so a tip naming it is wrong", rule => {
  const corner = resolveFights({
    agents: agentsOf(['d1', 'd2', 'w'], { d2: { gun: true } }), corners: { 'strip-1': { holder: 'd1' } },
    plays: { d1: { kind: 'deal', corner: 'strip-1', place: 'strip' }, d2: { kind: 'deal', corner: 'strip-1', place: 'strip' }, w: shift() },
    levels: NORMAL, rule, tips: [{ by: 'w', agent: 'd2', target: 'd1' }],
  }).fights.find(f => f.kind === 'corner');
  assert.deepEqual([corner.tipped, corner.cops, corner.winner], [undefined, 0, 'd2'], "the challenger's 2 against the holder's 1");
  const collar = fightOn(resolveFights({
    agents: agentsOf(['c', 't', 'w'], { t: { wanted: true } }), plays: { c: { kind: 'collar', target: 't', place: YARDS }, t: shift(), w: shift() },
    levels: NORMAL, rule, tips: [{ by: 'w', agent: 'c', target: 't' }],
  }), 'collar', 't');
  assert.deepEqual([collar.tipped, collar.attackers[0].strength, collar.defence, collar.winner], [undefined, 3, 1, 'c']);
  const cut = fightOn(resolveFights({
    // R4-2 (gap.accept): x accepts b, so b is cut rather than turned away unasked.
    agents: agentsOf(['x', 'b', 'y', 'z', 'w']), plays: { x: { ...hit('y'), accept: ['b'] }, b: back('x'), y: shift(), z: hit('b'), w: shift() },
    levels: NORMAL, rule, tips: [{ by: 'w', agent: 'b', target: 'y' }],
  }), 'hit', 'y');
  // gap.jump 'alone' (R8, slime 10-19: "do 1 and 2"): y is out working alone, so x wins the tie.
  assert.deepEqual([cut.tipped, cut.attackers[0].members, cut.cops, cut.winner], [undefined, ['x'], 0, 'x'], 'z cut b, so x is alone, 1 against 1, and wins the tie on a lone worker');
});

both("a right tip brings no cops to a lawless district, and doesn't stack with a wanted attacker's +2", rule => {
  const lawless = fightOn(resolveFights({
    agents: agentsOf(['x', 'y', 'w'], { x: { knuckles: true } }), plays: { x: hit('y', 'junkyard'), y: shift('junkyard'), w: shift() },
    levels: LAWLESS, rule, tips: [{ by: 'w', agent: 'x', target: 'y' }],
  }), 'hit', 'y');
  assert.deepEqual([lawless.cops, lawless.defence, lawless.winner], [0, 1, 'x']);
  const agents = agentsOf(['x', 'b1', 'b2', 'y', 'w'], { x: { wanted: true, knuckles: true } });
  // R4-2 (gap.accept): x accepts its two backers.
  const plays = { x: { ...hit('y'), accept: ['b1', 'b2'] }, b1: back('x'), b2: back('x'), y: shift(), w: shift() };
  for (const tips of [[], [{ by: 'w', agent: 'x', target: 'y' }]]) {
    const f = fightOn(resolveFights({ agents, plays, levels: NORMAL, rule, tips }), 'hit', 'y');
    assert.deepEqual([f.cops, f.defence, f.winner], [2, 3, 'x'], `4 against 1 + 2, with ${tips.length} tip(s)`);
  }
});

test('a right tip turns a won hit into a lost one and an arrest; the fight shows it was tipped, never who (§8, §13, §19)', () => {
  const night = tip => {
    const g = new Game({ n: 4 });
    g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
    if (tip) assert.equal(g.errand('a04', 'tip', { agent: 'a01', target: 'a02' }).ok, true);
    // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a02 is a filler the hit finds at the docks, so this night passes the docks filler.
    const r = g.night({ a01: hit('a02', 'docks') }, DOCKS);
    return { g, f: fightEvent(r, 'hit', 'a02') };
  };
  const plain = night(false);
  assert.deepEqual([plain.f.sides[0].strength, plain.f.defence, plain.f.cops, plain.f.won], [2, 1, 0, true], 'control: 2 against 1');
  assert.ok(!('tipped' in plain.f), 'an untipped fight carries no tip field');
  const tipped = night(true);
  assert.deepEqual([tipped.f.defence, tipped.f.cops, tipped.f.won, tipped.f.tipped], [3, 2, false, true], '2 against 1 + the city cops 2');
  assert.deepEqual(Object.keys(tipped.f).filter(k => !(k in plain.f)), ['tipped'], 'one field more, and it names nobody');
  assert.ok(!has(tipped.f, 'a04'), 'never who tipped');
  assert.ok(tipped.g.s.agents.a01.jail, 'it lost a fight with cops in it');
  assert.equal(tipped.g.events('betray').length, 0, 'no crew, no rat');
});

test('a tip: once a day, naming another agent and the target of its play tonight, an agent or the crate; it lasts one night (§13)', () => {
  const g = new Game({ n: 4 });
  g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
  for (const bad of [{ agent: 'a04', target: 'a02' }, { agent: 'a09', target: 'a02' }, { agent: 'a01', target: 'a01' }, { agent: 'a01', target: 'a09' }, { agent: 'a01', target: 'strip-1' }, { agent: 'a01' }]) {
    assert.equal(g.errand('a04', 'tip', bad).ok, false, JSON.stringify(bad));
  }
  assert.equal(g.errand('a04', 'tip', { agent: 'a01', target: 'crate' }).ok, true, 'the crate, for a grab');
  const again = g.errand('a04', 'tip', { agent: 'a01', target: 'a02' });
  assert.equal(again.ok, false, 'once a day');
  assert.equal(again.events[0].kind, 'not-yet');
  assert.equal(g.errand('a03', 'tip', { agent: 'a01', target: 'a02' }).ok, true, 'the tipper may be anyone');
  g.night();
  assert.equal(g.errand('a04', 'tip', { agent: 'a02', target: 'a01' }).ok, true, 'a new day, a new tip');
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a02 is a filler the hit finds at the docks, so this night passes the docks filler.
  const r = g.night({ a01: hit('a02', 'docks') }, DOCKS);
  const f = fightEvent(r, 'hit', 'a02');
  assert.deepEqual([f.cops, f.won, f.tipped], [0, true, undefined], "day 1's tip on a01 was for night 1, and a01 sat it out");
});

test("a tip is the tipper's own now and everyone's 24 hours later (§19)", () => {
  const g = new Game({ n: 4 });
  g.errand('a04', 'tip', { agent: 'a01', target: 'a02' });
  const seen = v => v.events.some(e => e.type === 'tip' && e.by === 'a04' && e.agent === 'a01' && e.target === 'a02');
  assert.ok(seen(g.view('a04')) && seen(g.view('a04', 'ownerAI')), "positive control: the tipper and its owner's AI see it now");
  for (const v of [g.view('a01'), g.view('a02'), g.view('a03', 'ownerAI'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(!v.events.some(e => e.type === 'tip'), `${label(v)}: no tip yet`);
  }
  g.night({ a01: hit('a02', 'docks') });
  for (const v of [g.view('a01'), g.view('a02'), g.view(null, 'public'), g.view(null, 'record')]) assert.ok(seen(v), `${label(v)}: 24 hours later`);
});

// --- the rat (§12) --------------------------------------------------------------------------------------------------

test("tipping your own crew's play is a rat: the tipper isn't arrested in the fight, and the crewmates who attacked are its victims (§12)", () => {
  const g = new Game({ n: 5 });
  g.errand('a01', 'crew_form', { name: 'crew' });
  for (const m of ['a03', 'a05']) {
    g.errand('a01', 'crew_invite', { agent: m });
    g.errand(m, 'crew_join', { crew: 'c1' });
  }
  g.errand('a03', 'tip', { agent: 'a01', target: 'a02' });
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a02 is a filler the hit finds at the docks, so this night passes the docks filler.
  const r = g.night({ a01: hit('a02', 'docks'), a03: back('a01') }, DOCKS);
  const f = fightEvent(r, 'hit', 'a02');
  assert.deepEqual([f.sides[0].strength, f.defence, f.won, f.tipped], [2, 3, false, true]);
  assert.ok(g.s.agents.a01.jail, 'the crewmate it ratted on is arrested');
  assert.ok(!g.s.agents.a03.jail, 'the tipper never is, in a fight it tipped');
  const rats = g.events('betray', e => e.kind === 'rat');
  assert.equal(rats.length, 1);
  assert.deepEqual([rats[0].by, rats[0].victims], ['a03', ['a01']], "a05 is in the crew, but it didn't attack");
  // §19: the rat and its victims now, everyone 24 hours later.
  const seen = v => v.events.some(e => e.type === 'betray' && e.kind === 'rat');
  assert.ok(seen(g.view('a03')) && seen(g.view('a01')), 'positive control: the rat and its victim');
  for (const v of [g.view('a02'), g.view('a04'), g.view('a05'), g.view(null, 'public'), g.view(null, 'record')]) assert.ok(!seen(v), `${label(v)}: not yet`);
  g.night();
  for (const v of [g.view('a02'), g.view('a05'), g.view(null, 'public'), g.view(null, 'record')]) assert.ok(seen(v), `${label(v)}: 24 hours later`);
});

// --- bribes (§13, §38, call 6) --------------------------------------------------------------------------------------

test("a bribe is priced by the briber's stars, rises with them, and never buys off 5; the cash leaves the island (§13, §38)", () => {
  const prices = [];
  for (let stars = 0; stars <= 4; stars++) {
    const g = new Game({ n: 3 });
    g.grant('a01', 5000);
    g.s.agents.a01.heat = stars;
    const r = g.errand('a01', 'bribe', { target: 'a02' });
    assert.equal(r.ok, true, `${stars} stars`);
    const e = r.events.find(x => x.type === 'bribe');
    assert.deepEqual([e.by, e.target, e.stars, e.price], ['a01', 'a02', stars, N.bribe[stars]]);
    assert.equal(g.s.agents.a01.cash, 5000 - N.bribe[stars]);
    assert.equal(g.s.money.out.bribe, N.bribe[stars], 'a sink of its own');
    prices.push(e.price);
  }
  assert.ok(prices.every((p, i) => p > 0 && (i === 0 || p > prices[i - 1])), `the price rises with heat: ${prices}`);
  const g = new Game({ n: 3 });
  g.grant('a01', 5000);
  g.s.agents.a01.heat = 5;
  assert.equal(g.errand('a01', 'bribe', { target: 'a02' }).ok, false, 'nothing buys off 5 stars');
  assert.equal(g.s.agents.a01.cash, 5000);
});

test("a bribe keeps every city cop out of the briber's fight: a wanted attacker's +2, the heavy +1 and a tip's +2 (§8, §13)", () => {
  const night = ({ heat = 0, bribe = false, tip = false, place = 'docks' }) => {
    const g = new Game({ n: 4 });
    g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
    g.grant('a01', 5000);
    g.s.agents.a01.heat = heat;
    if (tip) assert.equal(g.errand('a03', 'tip', { agent: 'a01', target: 'a02' }).ok, true);
    if (bribe) assert.equal(g.errand('a01', 'bribe', { target: 'a02' }).ok, true);
    const r = g.night({ a01: hit('a02', place), a02: shift(place) });
    return { g, f: fightEvent(r, 'hit', 'a02') };
  };
  const cases = [
    [{ heat: 3 }, [2, 3, false]],
    [{ heat: 3, bribe: true }, [0, 1, true]],
    [{ place: 'downtown' }, [1, 2, false]],
    [{ place: 'downtown', bribe: true }, [0, 1, true]],
    [{ tip: true }, [2, 3, false]],
    [{ tip: true, bribe: true }, [0, 1, true]],
  ];
  for (const [c, want] of cases) {
    const { g, f } = night(c);
    assert.deepEqual([f.cops, f.defence, f.won], want, JSON.stringify(c));
    assert.equal(!!g.s.agents.a01.jail, !want[2], `${JSON.stringify(c)}: arrested only where cops were in a lost fight`);
  }
  const keys = c => Object.keys(night(c).f).sort();
  assert.deepEqual(keys({ heat: 3, bribe: true }), keys({ heat: 3 }), 'a bribe shows only as no cops');
});

test("a bribe takes the city cops off a Cop's collar too, when the collared agent pays; the Cop's own changes nothing (§13)", () => {
  const collar = briber => {
    const g = withTrades(['cop', 'smuggler', 'smuggler']);
    g.s.agents.a02.heat = 3;
    g.grant('a01', 5000);
    g.grant('a02', 5000);
    if (briber) assert.equal(g.errand(briber, 'bribe', { target: 'a02' }).ok, true);
    const r = g.night({ a01: { kind: 'collar', target: 'a02', place: 'docks' }, a02: shift('docks') });
    return { g, f: fightEvent(r, 'collar', 'a02') };
  };
  for (const briber of [null, 'a01']) {
    const { g, f } = collar(briber);
    assert.deepEqual([f.sides[0].strength, f.defence, f.won], [3, 1, true], `${briber || 'no bribe'}: the Cop's 1 and the city cops' 2`);
    assert.ok(g.s.agents.a02.jail);
  }
  const bribed = collar('a02');
  assert.deepEqual([bribed.f.sides[0].strength, bribed.f.cops, bribed.f.defence, bribed.f.won], [1, 0, 1, false], "the Cop's 1 against 1: a tie");
  assert.ok(!bribed.g.s.agents.a02.jail, 'a failed collar arrests nobody');
});

test("a bribe covers only a fight the briber is in, against the cops; there are no refunds (call 6, GAP gap.bribe)", () => {
  const g = new Game({ n: 5 });
  g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
  g.s.agents.a01.heat = 3;
  g.grant('a05', 1000);
  g.grant('a02', 1000);
  assert.equal(g.errand('a05', 'bribe', { target: 'a02' }).ok, true, 'a bystander at 0 stars');
  assert.equal(g.errand('a02', 'bribe', { target: 'a02' }).ok, true, 'the target, whose side the cops are on');
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a02 is a filler the hit finds at the docks, so this night passes the docks filler; the work event's wage is a05's hustle event's take.
  const r = g.night({ a01: hit('a02', 'docks') }, DOCKS);
  const f = fightEvent(r, 'hit', 'a02');
  assert.deepEqual([f.cops, f.defence, f.won], [2, 3, false], 'the cops still come');
  assert.ok(g.s.agents.a01.jail);
  assert.equal(g.s.money.out.bribe, 2 * N.bribe[0], 'both bribes are spent');
  const wage = r.newEvents.find(e => e.type === 'hustle' && e.agent === 'a05').take;
  assert.equal(g.s.agents.a05.cash, 1000 - N.bribe[0] + wage - N.rent, "and nothing comes back: a05's night is its shift and its rent");
});

both('a bribe names its fight by the target: a corner fight by its corner, the grab by the crate (GAP gap.bribe)', rule => {
  const glasswall = { ...NORMAL, downtown: 'heavy' };
  const corner = bribes => resolveFights({
    agents: agentsOf(['d1', 'd2'], { d2: { gun: true } }), corners: { 'downtown-1': { holder: 'd1' } },
    plays: { d1: { kind: 'deal', corner: 'downtown-1', place: 'downtown' }, d2: { kind: 'deal', corner: 'downtown-1', place: 'downtown' } },
    levels: glasswall, rule, bribes,
  }).fights.find(f => f.kind === 'corner');
  const c0 = corner([]);
  assert.deepEqual([c0.cops, c0.winner, c0.arrested], [1, null, ['d2']], "control: 2 against the holder's 1 and Glasswall's 1");
  const c1 = corner([{ by: 'd2', target: 'downtown-1' }]);
  assert.deepEqual([c1.cops, c1.winner, c1.arrested], [0, 'd2', []]);
  const grab = bribes => resolveFights({
    agents: agentsOf(['x'], { x: { wanted: true } }), plays: { x: { kind: 'grab', place: 'docks' } }, levels: NORMAL, rule, bribes,
  }).fights.find(f => f.kind === 'grab');
  assert.deepEqual([grab([]).cops, grab([]).winner, grab([]).arrested], [2, null, ['x']], 'control: a wanted grabber against the city cops');
  const g1 = grab([{ by: 'x', target: 'crate' }]);
  assert.deepEqual([g1.cops, g1.winner, g1.arrested], [0, 'x', []]);
});

test('a bribe names a fight: an agent, the crate or a corner; one a fight; it needs the cash (§13)', () => {
  const g = new Game({ n: 3 });
  g.grant('a01', 3 * N.bribe[0]);
  assert.equal(g.errand('a01', 'bribe', { target: 'a09' }).ok, false, 'no such fight');
  assert.equal(g.errand('a01', 'bribe', {}).ok, false, 'no fight named');
  for (const target of ['a02', 'crate', 'strip-1']) assert.equal(g.errand('a01', 'bribe', { target }).ok, true, target);
  const twice = g.errand('a01', 'bribe', { target: 'a02' });
  assert.equal(twice.ok, false, 'one bribe a fight');
  g.grant('a01', N.bribe[0] - 1);
  const short = g.errand('a01', 'bribe', { target: 'a03' });
  assert.deepEqual([short.ok, short.events[0].kind], [false, 'not-yet'], 'not enough cash');
  assert.equal(g.s.agents.a01.cash, N.bribe[0] - 1);
});

test("a bribe is the briber's own now and everyone's 24 hours later; the fight never shows it (§19)", () => {
  const g = new Game({ n: 4 });
  g.grant('a01', 5000);
  g.errand('a01', 'bribe', { target: 'a02' });
  const seen = v => v.events.some(e => e.type === 'bribe' && e.by === 'a01' && e.target === 'a02');
  assert.ok(seen(g.view('a01')) && seen(g.view('a01', 'ownerAI')), "positive control: the briber and its owner's AI see it now");
  for (const v of [g.view('a02'), g.view('a03', 'ownerAI'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(!v.events.some(e => e.type === 'bribe'), `${label(v)}: no bribe yet`);
  }
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a02 is a filler the hit finds at the docks, so this night passes the docks filler.
  const r = g.night({ a01: hit('a02', 'docks') }, DOCKS);
  assert.ok(!has(fightEvent(r, 'hit', 'a02'), 'bribe'), 'the fight never names a bribe');
  for (const v of [g.view('a02'), g.view(null, 'public'), g.view(null, 'record')]) assert.ok(seen(v), `${label(v)}: 24 hours later`);
});

// --- typed inputs (§18) ---------------------------------------------------------------------------------------------

test("a tip's and a bribe's inputs are typed: nothing else an agent writes there reaches any view (§18, §23)", () => {
  const g = new Game({ n: 3 });
  g.grant('a01', 1000);
  g.errand('a01', 'tip', { agent: 'CANARY-TIP-AGENT', target: 'a02' });
  g.errand('a01', 'tip', { agent: 'a02', target: 'CANARY-TIP-TARGET' });
  g.errand('a01', 'bribe', { target: 'CANARY-BRIBE' });
  g.errand('a01', 'bribe', { target: 'a03', note: 'CANARY-BRIBE-NOTE' });
  g.errand('a01', 'tip', { agent: 'a02', target: 'a03', note: 'CANARY-TIP-NOTE' });
  assert.equal(g.events('tip').length, 1, 'positive control: the valid tip went in');
  assert.equal(g.events('bribe').length, 1, 'positive control: the valid bribe went in');
  const canaries = ['CANARY-TIP-AGENT', 'CANARY-TIP-TARGET', 'CANARY-BRIBE', 'CANARY-BRIBE-NOTE', 'CANARY-TIP-NOTE'];
  for (const when of ['live', 'two days later']) {
    for (const v of everyView(g)) for (const c of canaries) assert.ok(!has(v, c), `${when}: ${c} in ${label(v)}`);
    g.night();
    g.night();
  }
});
