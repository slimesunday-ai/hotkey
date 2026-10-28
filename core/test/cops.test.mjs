// Layer 2's gear, home defence, player cops and shipments (GAME.md §6, §7, §8, §9, §13, §38), with the rows in
// core/numbers.mjs (gap.gear, gap.homeDefence, gap.patrol, gap.collar, gap.shipments). Every expected value was worked
// out from GAME.md and those rows before the code ran. Fight-level cases call resolveFights directly, as the DATC suite
// does, and run under both cut rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { settleNight } from '../rules/night.mjs';
import { resolveFights } from '../rules/fights.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { rng, shuffle } from '../rng.mjs';
import { withOverrides } from '../bench/runner.mjs';

const DISTRICTS = ['downtown', 'strip', 'industrial', 'suburbs', 'docks', 'junkyard', 'mall', 'forest'];
const LAWLESS = Object.fromEntries(DISTRICTS.map(d => [d, 'lawless']));
const NORMAL = Object.fromEntries(DISTRICTS.map(d => [d, 'normal']));
const YARDS = 'industrial';

// Fight-level agents at the lock: nobody armed, wanted or wearing anything unless it says so.
function agentsOf(ids, overrides = {}) {
  return Object.fromEntries(ids.map(id => [id, { home: true, jailed: false, crew: null, wanted: false, knuckles: false, runners: false, ...overrides[id] }]));
}
const fightOn = (r, target, kind) => r.fights.find(f => f.target === target && f.kind === kind);
const shift = (place = YARDS) => ({ kind: 'hustle', place });
const hit = (target, place = YARDS) => ({ kind: 'hit', target, place });
const back = target => ({ kind: 'back', target });
const patrol = (place = YARDS) => ({ kind: 'patrol', place });
const both = (name, fn) => {
  for (const rule of ['A', 'B']) test(`${name} (rule ${rule})`, () => fn(rule));
};

// A season whose agents have the trades named, in id order (the helpers' cast is all Smugglers).
function withTrades(trades, { rule = 'A' } = {}) {
  const g = new Game({ n: 1 });
  const agents = trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' }));
  const r = newSeason({ seed: 404, rule, midseason: 'blackout', items: ITEMS, agents });
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
const fightEvent = (r, kind, target) => r.newEvents.find(e => e.type === 'fight' && e.kind === kind && (target === undefined || e.target === target));

// --- gear and the home (§8) -----------------------------------------------------------------------------------------

both("§8's table: three with guns break into a crew laying low (3 home, 1 gun), a tie; with a lockpick they're in", rule => {
  const agents = agentsOf(['a', 'b1', 'b2', 't', 't1', 't2'], { a: { gun: true }, b1: { gun: true }, b2: { gun: true }, t1: { gun: true } });
  // R4-2 (gap.accept): each leader accepts its backers.
  const plays = {
    a: { kind: 'breakin', target: 't', place: 'suburbs', accept: ['b1', 'b2'] }, b1: back('a'), b2: back('a'),
    t: { kind: 'laylow', place: 'suburbs', accept: ['t1', 't2'] }, t1: back('t'), t2: back('t'),
  };
  const tie = fightOn(resolveFights({ agents, plays, levels: NORMAL, rule }), 't', 'breakin');
  assert.equal(tie.attackers[0].strength, 6);
  assert.equal(tie.defence, 6, '1 lock + 4 (three home, one gun) + 1 laying low');
  assert.equal(tie.winner, null, 'a tie: the home holds');
  agents.a.lockpick = true;
  const inside = fightOn(resolveFights({ agents, plays, levels: NORMAL, rule }), 't', 'breakin');
  assert.deepEqual([inside.attackers[0].strength, inside.defence, inside.winner], [7, 6, 'a'], "with a lockpick: 7 against 6, you're in");
});

both("§8's table: with a gun you hit a Dealer alone on Neon Row, 2 to 1; in Glasswall (heavy) it's 2 to 1 + 1, a tie", rule => {
  const agents = agentsOf(['you', 'dealer'], { you: { gun: true } });
  const neon = fightOn(resolveFights({
    agents, plays: { you: hit('dealer', 'strip'), dealer: { kind: 'deal', corner: 'strip-1', place: 'strip' } }, levels: NORMAL, rule,
  }), 'dealer', 'hit');
  assert.deepEqual([neon.attackers[0].strength, neon.defence, neon.winner], [2, 1, 'you']);
  const glasswall = fightOn(resolveFights({
    agents, plays: { you: hit('dealer', 'downtown'), dealer: { kind: 'deal', corner: 'downtown-1', place: 'downtown' } },
    levels: { ...NORMAL, downtown: 'heavy' }, rule,
  }), 'dealer', 'hit');
  assert.deepEqual([glasswall.attackers[0].strength, glasswall.defence, glasswall.winner], [2, 2, null]);
});

both('a home is defended by everyone in it: a Chemist cooking at home with a backer counts 2, plus the lock (§8)', rule => {
  const r = resolveFights({
    agents: agentsOf(['t', 'u', 'a', 'b', 'c']),
    // R4-2 (gap.accept): each leader accepts its backers.
    plays: { t: { kind: 'cook', place: 'suburbs', batches: 1, accept: ['u'] }, u: back('t'), a: { kind: 'breakin', target: 't', place: 'suburbs', accept: ['b', 'c'] }, b: back('a'), c: back('a') },
    levels: NORMAL, rule,
  });
  const f = fightOn(r, 't', 'breakin');
  assert.deepEqual([f.attackers[0].strength, f.defence, f.winner], [3, 3, null], '3 against the lock, t and u: the home holds');
});

// --- patrols (§8, §13) ----------------------------------------------------------------------------------------------

both("a patrolling cop joins every fight in its district on the defender's side, and arrests in a lawless one too", rule => {
  const r = resolveFights({
    agents: agentsOf(['x', 'y', 'c']), plays: { x: hit('y', 'junkyard'), y: { kind: 'run', place: 'junkyard' }, c: patrol('junkyard') },
    levels: LAWLESS, rule,
  });
  const f = fightOn(r, 'y', 'hit');
  assert.equal(f.cops, 0, 'no city cops in a lawless district');
  assert.deepEqual([f.defence, f.winner, f.arrested], [2, null, ['x']], "y's 1 and the patrol's 1; a player cop was in the fight");
});

both("a patrolling cop that's attacked joins no other fight, and losing a hit on a cop on duty is an arrest", rule => {
  const settle = () => resolveFights({ agents: agentsOf(['x', 'y', 'z', 'c']), plays: { x: hit('y'), y: shift(), z: hit('c'), c: patrol() }, levels: LAWLESS, rule });
  const r = settle();
  const onY = fightOn(r, 'y', 'hit');
  // gap.jump 'alone' (R8, slime 10-19: "do 1 and 2"): y and the patrolling cop are each out working alone, so each hitter wins its tie.
  assert.deepEqual([onY.defence, onY.winner, onY.arrested], [1, 'x', []], 'the cop was hit, so it stays out of the fight on y, and x wins the tie on y working alone');
  const onC = fightOn(r, 'c', 'hit');
  assert.deepEqual([onC.defence, onC.winner, onC.arrested], [1, 'z', []], 'z wins the tie on the cop patrolling alone, so nobody is arrested');
  // With the jump off (gap.jump 0) the tie holds, so the arrest still shows.
  const off = fightOn(withOverrides({ 'gap.jump': 0 }, settle), 'c', 'hit');
  assert.deepEqual([off.defence, off.winner, off.arrested], [1, null, ['z']], 'gap.jump 0: the cop holds, and z lost a fight with a cop in it');
});

both('with places ignored (§27), patrols join no fight (GAP gap.patrol)', rule => {
  const args = { agents: agentsOf(['x', 'y', 'c']), plays: { x: hit('y'), y: shift(), c: patrol() }, levels: LAWLESS, rule };
  assert.equal(fightOn(resolveFights(args), 'y', 'hit').defence, 2);
  const f = fightOn(resolveFights({ ...args, ignorePlaces: true }), 'y', 'hit');
  assert.deepEqual([f.defence, f.arrested], [1, []]);
});

both("whether backing decided a fight counts guns and patrols (§27's backing report)", rule => {
  const armedFight = () => resolveFights({
    // R4-2 (gap.accept): a accepts its backer.
    agents: agentsOf(['a', 'd', 'b'], { a: { gun: true }, b: { gun: true } }), plays: { a: { ...hit('b'), accept: ['d'] }, d: back('a'), b: shift() }, levels: LAWLESS, rule,
  });
  const armed = armedFight();
  // 3 against 2 and a wins; alone, a's 2 would tie b's 2, and under gap.jump 'alone' (R8, slime 10-19: "do 1 and 2")
  // a wins that tie on b out working alone, so the backing didn't decide the fight.
  assert.deepEqual([fightOn(armed, 'b', 'hit').winner, fightOn(armed, 'b', 'hit').backingDecided], ['a', false]);
  // With the jump off (gap.jump 0) b holds that tie, so the backing, counting both guns, decided the fight.
  const armedOff = withOverrides({ 'gap.jump': 0 }, armedFight);
  assert.deepEqual([fightOn(armedOff, 'b', 'hit').winner, fightOn(armedOff, 'b', 'hit').backingDecided], ['a', true]);
  const patrolled = resolveFights({
    agents: agentsOf(['a', 'd', 'b', 'c'], { a: { knuckles: true } }), plays: { a: { ...hit('b'), accept: ['d'] }, d: back('a'), b: shift(), c: patrol() }, levels: LAWLESS, rule,
  });
  // 3 against b's 1 and the patrol's 1; alone, a's 2 would tie them.
  assert.deepEqual([fightOn(patrolled, 'b', 'hit').winner, fightOn(patrolled, 'b', 'hit').backingDecided], ['a', true]);
});

// --- collars (§13) --------------------------------------------------------------------------------------------------

test('a collar is an attack: it cuts a wanted backer under rule A, but not under B when it comes from the agent its group attacks', () => {
  const agents = agentsOf(['x', 'w', 'y'], { w: { wanted: true } });
  // R4-2 (gap.accept): x accepts its backer.
  const plays = { x: { ...hit('y'), accept: ['w'] }, w: back('x'), y: { kind: 'collar', target: 'w', place: YARDS } };
  const A = resolveFights({ agents, plays, levels: LAWLESS, rule: 'A' });
  const B = resolveFights({ agents, plays, levels: LAWLESS, rule: 'B' });
  assert.deepEqual([A.cut, B.cut], [['w'], []]);
  // The hit on y, a cop on duty. A: x alone, 1 against 1, holds, and x is arrested. B: x and w, 2 against 1.
  assert.deepEqual([fightOn(A, 'y', 'hit').winner, fightOn(A, 'y', 'hit').arrested], [null, ['x']]);
  assert.deepEqual([fightOn(B, 'y', 'hit').winner, fightOn(B, 'y', 'hit').arrested], ['x', []]);
  // The collar on w, lawless: y's 1 with no city cops against w's 1, a tie. A failed collar arrests nobody.
  for (const r of [A, B]) assert.deepEqual([fightOn(r, 'w', 'collar').winner, fightOn(r, 'w', 'collar').arrested], [null, []]);
});

test("a Cop collars a wanted agent: its group and the city cops against the defence; it's arrested, and the Cop paid $100 a star out of its fine (R4-4: a collar creates no money, gap.collarPay)", () => {
  const g = withTrades(['cop', 'smuggler', 'smuggler']);
  g.s.agents.a02.heat = 3;
  // R4-4: a collar's Cop is paid its stars out of the arrest's fine. a02 holds $600, so its fine, half its cash, pays
  // them, and nothing of it is left for the vault.
  g.grant('a02', 600);
  const r = g.night({ a01: { kind: 'collar', target: 'a02', place: 'docks' }, a02: { kind: 'hustle', place: 'docks' } });
  const f = fightEvent(r, 'collar', 'a02');
  assert.deepEqual([f.sides[0].strength, f.defence, f.won], [3, 1, true], "the Cop's 1 and the city cops' 2 (the docks are normal) against 1");
  const arrest = r.newEvents.find(e => e.type === 'arrest' && e.agent === 'a02');
  assert.deepEqual([arrest.why, arrest.by, arrest.stars], ['collar', 'a01', 3]);
  const seized = r.newEvents.find(e => e.type === 'seized' && e.agent === 'a02');
  assert.equal(seized.fine, 300, 'control: its fine, half its cash');
  assert.equal(r.newEvents.find(e => e.type === 'collar' && e.agent === 'a01').pay, 300, '$100 for every star it had, out of its fine');
  assert.deepEqual([seized.vault, g.s.vault.cash, g.s.money.in.collar || 0], [0, 0, 0], 'none of it to the vault, and nothing from the city');
});

test("in a collar the city cops side with the Cop: Glasswall's +2 and +1 against a group of 3; none in a lawless district", () => {
  const g = withTrades(['cop', 'smuggler', 'smuggler', 'smuggler', 'cop', 'smuggler']);
  g.s.agents.a02.heat = 3;
  g.s.agents.a06.heat = 4;
  const r = g.night({
    // R4-2 (gap.accept): a02 accepts its backers.
    a01: { kind: 'collar', target: 'a02', place: 'downtown' }, a02: { kind: 'hustle', place: 'downtown', accept: ['a03', 'a04'] },
    a03: back('a02'), a04: back('a02'),
    a05: { kind: 'collar', target: 'a06', place: 'junkyard' }, a06: { kind: 'run', place: 'junkyard' },
  });
  const glasswall = fightEvent(r, 'collar', 'a02');
  assert.deepEqual([glasswall.sides[0].strength, glasswall.defence, glasswall.won], [4, 3, true]);
  const heap = fightEvent(r, 'collar', 'a06');
  assert.deepEqual([heap.sides[0].strength, heap.defence, heap.won], [1, 1, false]);
  assert.ok(g.s.agents.a02.jail, 'collared');
  assert.ok(!g.s.agents.a03.jail && !g.s.agents.a04.jail, "a collar arrests its target, not the target's backers");
  assert.ok(!g.s.agents.a05.jail && !g.s.agents.a06.jail, 'a failed collar arrests nobody');
});

test("a collar naming Pleasantview finds its target at home, against the home's defence", () => {
  const g = withTrades(['cop', 'smuggler', 'smuggler']);
  g.s.agents.a02.heat = 3;
  // R4-2 (gap.accept): the Cop accepts its backer.
  const r = g.night({ a01: { kind: 'collar', target: 'a02', place: 'suburbs', accept: ['a03'] }, a03: back('a01'), a02: { kind: 'laylow' } });
  const f = fightEvent(r, 'collar', 'a02');
  assert.deepEqual([f.place, f.sides[0].strength, f.defence, f.won], ['suburbs', 4, 3, true], '2 and the city cops 2 against 1 lock + 1 + 1 laying low');
  assert.ok(g.s.agents.a02.jail);
});

test('only a Cop collars, never a wanted one, and only a wanted agent', () => {
  const g = withTrades(['cop', 'smuggler', 'cop']);
  g.s.agents.a03.heat = 3;
  const r = g.night({
    a01: { kind: 'collar', target: 'a02', place: 'docks' },
    a02: { kind: 'collar', target: 'a03', place: 'docks' },
    a03: { kind: 'collar', target: 'a01', place: 'docks' },
  });
  const invalid = id => r.newEvents.find(e => e.type === 'invalid' && e.agent === id);
  assert.equal(invalid('a01').kind, 'not-yet', "a02 isn't wanted");
  assert.equal(invalid('a02').kind, 'never', "a Smuggler can't collar");
  assert.equal(invalid('a03').kind, 'not-yet', "a wanted cop can't collar");
});

test("a patrol pays the Cop's wage, and Dealers selling in its district get +1 heat, never +2 on a hot corner", () => {
  const g = withTrades(['cop', 'dealer', 'dealer', 'cop']);
  const r = g.night({
    a01: patrol('industrial'), a02: { kind: 'deal', corner: 'industrial-1' },
    a03: { kind: 'deal', corner: 'strip-1' }, a04: patrol('strip'),
  });
  for (const cop of ['a01', 'a04']) assert.equal(r.newEvents.find(e => e.type === 'patrol' && e.agent === cop).wage, 50);
  assert.equal(g.s.agents.a02.heat, 1, 'a corner in a patrolled district');
  assert.equal(g.s.agents.a03.heat, 1, 'a hot corner in a patrolled district: still 1');
  assert.equal(g.s.money.in.patrol, 100);
});

// --- lockpicks (§8) -------------------------------------------------------------------------------------------------

test('a lockpick adds 1 to a break-in and is used up, won or lost (GAP gap.gear)', () => {
  const g = withTrades(['gunrunner', 'smuggler', 'smuggler']);
  for (const id of ['a01', 'a02', 'a03']) g.grant(id, 100);
  stock(g, 'a01', 'lockpicks', 2);
  const won = fightEvent(g.night({ a01: { kind: 'breakin', target: 'a02' } }), 'breakin');
  assert.deepEqual([won.sides[0].strength, won.defence, won.won], [2, 1, true], "1 and the lockpick against an empty home's lock");
  assert.equal(g.s.agents.a01.goods.lockpicks, 1);
  const lost = fightEvent(g.night({ a01: { kind: 'breakin', target: 'a03' }, a03: { kind: 'laylow' } }), 'breakin');
  assert.deepEqual([lost.sides[0].strength, lost.defence, lost.won], [2, 3, false]);
  assert.equal(g.s.agents.a01.goods.lockpicks, undefined, 'used up, though the break-in lost');
  assert.equal(g.s.goods.out.used.lockpicks, 2);
});

// --- shipments (§9) -------------------------------------------------------------------------------------------------

test("a shipment is posted the morning of its night, joins the island only when grabbed, and a tie leaves it there", () => {
  const g = new Game({ n: 4 });
  const r1 = g.night({ a03: { kind: 'grab' } });
  assert.equal(r1.newEvents.find(e => e.type === 'invalid' && e.agent === 'a03').kind, 'not-yet', 'no crate on night 1');
  const posted = r1.newEvents.find(e => e.type === 'shipment');
  assert.deepEqual([posted.night, posted.cash, posted.vis.to], [2, 500, 'all']);
  assert.deepEqual(g.view('a01').board.crate, { cash: 500, goods: {} });
  assert.equal(g.s.money.in.shipment, undefined, 'not on the island yet');
  const r2 = g.night({ a01: { kind: 'grab' }, a02: { kind: 'grab' } });
  const tie = fightEvent(r2, 'grab');
  assert.deepEqual([tie.sides.map(x => x.strength), tie.defence, tie.won], [[1, 1], 0, false], 'two grabbers, 1 each: a tie');
  assert.equal(g.s.agents.a01.heat, 1, 'a grab is a crime: +1');
  assert.deepEqual(g.view('a01').board.crate, { cash: 500, goods: {} }, 'it sits there another night');
  const r3 = g.night({ a01: { kind: 'grab' } });
  assert.equal(r3.newEvents.find(e => e.type === 'grab').cash, 500);
  assert.equal(g.s.money.in.shipment, 500);
  assert.equal(g.view('a01').board.crate, null);
});

// GAME.md §26's shuffle test with this task's plays: the same plays in any order give the same night.
function reorder(plays, seed) {
  const out = {};
  for (const k of shuffle(rng('cops-shuffle', seed), Object.keys(plays))) out[k] = plays[k];
  return out;
}
for (const rule of ['A', 'B']) {
  test(`patrols, collars, a grab and a lockpick give the same night in any order (rule ${rule})`, () => {
    const trades = ['cop', 'cop', 'smuggler', 'smuggler', 'smuggler', 'dealer', 'smuggler', 'gunrunner'];
    const g = withTrades(trades, { rule });
    for (let i = 1; i <= trades.length; i++) g.grant(idOf(i), 500);
    g.night();
    stock(g, 'a03', 'guns', 1);
    stock(g, 'a08', 'lockpicks', 1);
    g.s.agents.a05.heat = 3;
    // R4-2 (gap.accept): a03 accepts its backer, so the backing is in the night.
    const plays = {
      a01: patrol('docks'), a02: { kind: 'collar', target: 'a05', place: 'mall' }, a03: { kind: 'grab', accept: ['a07'] }, a04: { kind: 'grab' },
      a05: { kind: 'run', place: 'mall' }, a06: { kind: 'deal', corner: 'docks-1' }, a07: back('a03'),
      a08: { kind: 'breakin', target: 'a06' },
    };
    const base = settleNight(g.s, plays);
    const want = JSON.stringify([base.events, base.state, base.fights]);
    for (let k = 0; k < 12; k++) {
      const r = settleNight(g.s, reorder(plays, `${rule}-${k}`));
      assert.equal(JSON.stringify([r.events, r.state, r.fights]), want, `order ${k}`);
    }
    // Positive control: the night had a won grab against a patrol, a failed collar and a used lockpick.
    const kinds = base.fights.fights.map(f => `${f.kind}:${f.winner}`).sort();
    assert.deepEqual(kinds, ['breakin:a08', 'collar:null', 'grab:a03']);
    assert.deepEqual(base.fights.fights.find(f => f.kind === 'grab').arrested, ['a04'], 'the patrol was in the grab');
    assert.equal(base.state.agents.a08.goods.lockpicks, undefined);
  });
}
