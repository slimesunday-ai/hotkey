// The trades' night (GAME.md §9, layer 2, "the street"): runs at the drops, cooking, dealing on corners, building, the
// goods a hit takes, corner fights, flex, and who sees what. Expected values come from GAME.md (§4, §7, §8, §9, §38)
// and the rows in core/numbers.mjs, never from what the code printed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, abilityCopy, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { settleNight } from '../rules/night.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { cornerTakings } from '../rules/market.mjs';
import { rng, shuffle } from '../rng.mjs';
import { N } from '../numbers.mjs';

// A season whose agents have the trades named, in id order (the helpers' cast is all Smugglers).
function withTrades(trades, { rule = 'A', midseason = 'blackout' } = {}) {
  const g = new Game({ n: 1 });
  const agents = trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' }));
  const r = newSeason({ seed: 404, rule, midseason, items: ITEMS, agents });
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
const of = (r, type, agent) => r.newEvents.filter(e => e.type === type && (agent === undefined || e.agent === agent));
const one = (r, type, agent) => {
  const list = of(r, type, agent);
  assert.equal(list.length, 1, `one ${type} for ${agent}`);
  return list[0];
};
// The next copy of brass knuckles still on the list (the list shrinks as copies are handed out).
const knuckles = (g, id) => g.hand(id, abilityCopy(g.s, 'knuckles'), { wear: true });
const housed = (g, ids) => ids.forEach(id => g.grant(id, 500));

test('each trade lists its night of work with the place filled in, and only what it holds enough for (§9, §33)', () => {
  const g = withTrades(['smuggler', 'chemist', 'dealer', 'gunrunner', 'cop']);
  const work = id => g.view(id).legal.filter(p => ['run', 'cook', 'deal', 'build'].includes(p.kind));
  assert.deepEqual(work('a01'), ['docks', 'forest', 'junkyard', 'mall'].map(place => ({ kind: 'run', place })), 'a Smuggler: the four drops');
  assert.deepEqual(work('a02'), [{ kind: 'cook', place: 'suburbs', batches: 1 }, { kind: 'cook', place: 'forest', batches: 1 }],
    "a Chemist's kit of 2 chems is one batch, at home or at the lab");
  assert.equal(work('a03').length, 8, 'a Dealer with doses: any of the 8 corners');
  assert.deepEqual(work('a03')[0], { kind: 'deal', corner: 'docks-1', place: 'docks' });
  assert.deepEqual(work('a04'), [
    { kind: 'build', place: 'suburbs', guns: 0, lockpicks: 1 }, { kind: 'build', place: 'suburbs', guns: 0, lockpicks: 2 },
    { kind: 'build', place: 'suburbs', guns: 1, lockpicks: 0 },
  ], "a Gunrunner's 2 parts: a gun (2 parts) or one or two lockpicks (1 part each)");
  assert.deepEqual(work('a05'), [], "a Cop's patrol and collar come with player cops");
  assert.ok(g.view('a01').legal.some(p => p.kind === 'hustle'), 'anyone can still work a shift');

  const r = g.night({
    a01: { kind: 'cook', place: 'suburbs', batches: 1 }, a02: { kind: 'cook', place: 'suburbs', batches: 2 },
    a03: { kind: 'deal', corner: 'CANARY-CORNER' }, a04: { kind: 'build', guns: 3 }, a05: { kind: 'laylow' },
  });
  const invalid = id => one(r, 'invalid', id);
  assert.equal(invalid('a01').kind, 'never', 'a Smuggler never cooks');
  assert.equal(invalid('a02').kind, 'not-yet', 'two batches need 4 chems; it holds 2');
  assert.equal(invalid('a03').kind, 'never', 'no such corner');
  assert.ok(!JSON.stringify(g.log).includes('CANARY-CORNER'), 'an unknown corner never reaches the record');
  assert.equal(invalid('a04').kind, 'never', 'three guns take 6 parts, past the 4 a night');
  assert.deepEqual(invalid('a04').play, { kind: 'build', guns: 3 }, 'the typed parts of the play are kept');
});

test('a run: a drop holds 6 units a night, split evenly among the Smugglers there; work boots add one (§9, §4, §38)', () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler']);
  g.hand('a03', abilityCopy(g.s, 'workboots'), { wear: true });
  g.night({
    a01: { kind: 'run', place: 'mall' }, a02: { kind: 'run', place: 'junkyard' }, a03: { kind: 'run', place: 'junkyard' },
    a04: { kind: 'hustle', place: 'docks' },
  });
  assert.deepEqual(g.s.agents.a01.goods, { chems: 6 }, 'alone at a chems drop: 6 chems');
  assert.deepEqual(g.s.agents.a02.goods, { parts: 3 }, 'two at a parts drop: 3 each');
  assert.deepEqual(g.s.agents.a03.goods, { parts: 4 }, 'work boots: one more unit');
  assert.deepEqual(g.s.goods.in.drop, { chems: 6, parts: 7 }, 'the drops are booked in as a source');
});

test('cooking: a batch is 2 chems to 5 doses, up to 2 a night; at home +1 heat, at the lab none; the apron adds a dose (§9, §4, §7)', () => {
  const g = withTrades(['chemist', 'chemist']);
  stock(g, 'a01', 'chems', 2);
  g.hand('a02', abilityCopy(g.s, 'apron'), { wear: true });
  const r = g.night({ a01: { kind: 'cook', place: 'suburbs', batches: 2 }, a02: { kind: 'cook', place: 'forest', batches: 1 } });
  assert.deepEqual(g.s.agents.a01.goods, { temp: 10 }, '4 chems make 10 doses');
  assert.equal(g.s.agents.a01.heat, 1, 'cooking at home: +1 heat');
  assert.deepEqual(g.s.agents.a02.goods, { temp: 6 }, 'one batch, 5 doses, and the apron adds 1');
  assert.equal(g.s.agents.a02.heat, 0, 'at the lab: no heat');
  assert.equal(r.fights.where.a01.at, 'home', 'cooking at home is home');
  assert.deepEqual(r.fights.where.a02, { at: 'out', place: 'forest' }, 'the lab is out in Blackpine Woods');
  assert.deepEqual(g.s.goods.out.cook, { chems: 6 });
  assert.deepEqual(g.s.goods.in.cook, { temp: 16 });
});

test('dealing: $36 a dose, 10% less each dose, so 6 doses take $169; a hot corner $253 and +1 heat; the holder sells a 7th (§9, §38)', () => {
  const g = withTrades(['dealer', 'dealer']);
  housed(g, ['a01', 'a02']);
  stock(g, 'a01', 'temp', 9);
  stock(g, 'a02', 'temp', 2);
  let r = g.night({ a01: { kind: 'deal', corner: 'industrial-1' }, a02: { kind: 'deal', corner: 'strip-1' } });
  assert.deepEqual([one(r, 'sale', 'a01').doses, one(r, 'sale', 'a01').cash], [6, 169], 'a normal corner: 6 doses, $169');
  assert.deepEqual([one(r, 'sale', 'a02').doses, one(r, 'sale', 'a02').cash], [6, 253], 'a hot corner: $253');
  assert.deepEqual([g.s.agents.a01.heat, g.s.agents.a02.heat], [0, 1], 'only the hot corner adds heat');
  assert.deepEqual(g.s.agents.a01.goods, { temp: 7 });
  assert.deepEqual(g.s.agents.a02.goods, {});
  assert.equal(g.s.corners['industrial-1'].holder, 'a01', 'a lone Dealer takes its corner');
  // Night 2: a01 held its corner the night before, so it sells up to 7: 36 × (1 − 0.9^7) / 0.1 = 187.8, so $188.
  r = g.night({ a01: { kind: 'deal', corner: 'industrial-1' }, a02: { kind: 'hustle', place: 'docks' } });
  assert.deepEqual([one(r, 'sale', 'a01').doses, one(r, 'sale', 'a01').cash], [7, 188]);
  assert.deepEqual(g.s.goods.out.street, { temp: 19 }, 'doses sold to the street leave the island');
  assert.equal(g.s.money.in.street, 169 + 253 + 188, 'the street is a cash source');
});

test('building: 4 parts make 2 guns, or a gun and two lockpicks, at home (§9, §38)', () => {
  const g = withTrades(['gunrunner', 'gunrunner']);
  stock(g, 'a01', 'parts', 2);
  stock(g, 'a02', 'parts', 2);
  const r = g.night({ a01: { kind: 'build', guns: 2 }, a02: { kind: 'build', guns: 1, lockpicks: 2 } });
  assert.deepEqual(g.s.agents.a01.goods, { guns: 2 });
  assert.deepEqual(g.s.agents.a02.goods, { guns: 1, lockpicks: 2 });
  assert.equal(r.fights.where.a01.at, 'home', 'building is at home');
  assert.deepEqual(g.s.goods.out.build, { parts: 8 });
  assert.deepEqual(g.s.goods.in.build, { guns: 3, lockpicks: 2 });
});

test("§9's chain end to end: a Smuggler's chems, a Chemist's doses, a Dealer's hot corner (§9)", () => {
  const g = withTrades(['smuggler', 'chemist', 'dealer']);
  housed(g, ['a01', 'a02', 'a03']);
  g.night({ a01: { kind: 'run', place: 'mall' }, a02: { kind: 'laylow' }, a03: { kind: 'laylow' } });
  g.errand('a01', 'give', { to: 'a02', goods: { chems: 4 } });
  g.night({ a01: { kind: 'laylow' }, a02: { kind: 'cook', place: 'forest', batches: 2 }, a03: { kind: 'laylow' } });
  assert.deepEqual(g.s.agents.a02.goods, { chems: 2, temp: 10 }, 'its kit of 2 chems and the 4 it got: 2 batches, 10 doses');
  g.errand('a02', 'give', { to: 'a03', goods: { temp: 6 } });
  const r = g.night({ a01: { kind: 'laylow' }, a02: { kind: 'laylow' }, a03: { kind: 'deal', corner: 'strip-1' } });
  assert.deepEqual([one(r, 'sale', 'a03').doses, one(r, 'sale', 'a03').cash], [6, 253], 'its kit of 4 and the 6: it sells 6, at $253');
  assert.deepEqual(g.s.agents.a03.goods, { temp: 4 });
});

test('a won hit takes the goods carried tonight, a haul or a lab\'s chems, and what work pays tonight, a Dealer\'s takings in place of its doses or a shift\'s wage; never guns, never from a stash (§7, §8)', () => {
  const g = withTrades(['smuggler', 'smuggler', 'dealer', 'smuggler', 'chemist', 'smuggler', 'gunrunner', 'smuggler', 'smuggler', 'smuggler']);
  for (const id of ['a02', 'a04', 'a06', 'a08', 'a10']) knuckles(g, id);
  stock(g, 'a03', 'temp', 4);
  stock(g, 'a07', 'guns', 1);
  // a07's gun counts on defence (§8), so a08 brings knuckles and a gun: 3 against 2.
  stock(g, 'a08', 'guns', 1);
  stock(g, 'a09', 'chems', 3);
  const r = g.night({
    a01: { kind: 'run', place: 'junkyard' }, a02: { kind: 'hit', target: 'a01', place: 'junkyard' },
    a03: { kind: 'deal', corner: 'industrial-1' }, a04: { kind: 'hit', target: 'a03', place: 'industrial' },
    a05: { kind: 'cook', place: 'forest', batches: 1 }, a06: { kind: 'hit', target: 'a05', place: 'forest' },
    a07: { kind: 'hustle', place: 'docks' }, a08: { kind: 'hit', target: 'a07', place: 'docks' },
    a09: { kind: 'hustle', place: 'docks' }, a10: { kind: 'breakin', target: 'a09' },
  });
  const rob = leader => r.newEvents.find(e => e.type === 'rob' && e.leader === leader);
  assert.deepEqual(rob('a02').goods, { parts: 6 }, "the Smuggler's whole haul");
  assert.deepEqual(g.s.agents.a01.goods, {});
  // Held up, the Dealer deals the doses it carried (its cap) all the same, and the hit takes the street's cash for them
  // (GAP gap.holdup).
  assert.deepEqual([one(r, 'sale', 'a03').doses, one(r, 'sale', 'a03').cash], [N.deal.cap, cornerTakings(N.deal.cap, N.corners['industrial-1'].hot)], 'it sells its cap');
  assert.equal(rob('a04').goods, undefined, 'none of its doses');
  assert.equal(rob('a04').cash, one(r, 'sale', 'a03').cash, 'its takings');
  assert.deepEqual(g.s.agents.a03.goods, { temp: 2 }, 'the rest stayed in its stash');
  assert.deepEqual(rob('a06').goods, { chems: 2 }, 'the chems the Chemist carried to the lab');
  assert.equal(one(r, 'cook', 'a05').batches, 0, 'nothing left to cook');
  assert.ok(rob('a08'), 'knuckles and a gun (3) beat a gun on defence (2)');
  assert.equal(rob('a08').goods, undefined, 'a gun is not carried goods');
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the work event's wage is now a07's hustle event's take.
  assert.equal(rob('a08').cash, r.newEvents.find(e => e.type === 'hustle' && e.agent === 'a07').take, "a07's wage tonight");
  assert.deepEqual(g.s.agents.a07.goods, { parts: 2, guns: 1 }, 'its kit and its gun, untouched');
  const burgle = r.newEvents.find(e => e.type === 'burgle' && e.leader === 'a10');
  assert.ok(burgle, 'the break-in won');
  assert.equal(burgle.goods, undefined, 'a break-in takes no goods (§7)');
  assert.deepEqual(g.s.agents.a09.goods, { chems: 3 });
  assert.deepEqual(one(r, 'robbed', 'a01').goods, { parts: 6 }, 'the victim learns what went');
});

test('corners: a lone Dealer takes one; the holder defends it; a stronger challenger takes it; no take, no crime (§9, §8)', () => {
  const g = withTrades(['dealer', 'dealer', 'smuggler']);
  housed(g, ['a01', 'a02', 'a03']);
  stock(g, 'a01', 'temp', 20);
  stock(g, 'a02', 'temp', 20);
  g.night({ a01: { kind: 'deal', corner: 'industrial-1' }, a02: { kind: 'laylow' }, a03: { kind: 'laylow' } });
  assert.equal(g.s.corners['industrial-1'].holder, 'a01');
  // 1 against the holder's 1: a tie, so the holder holds and deals; the challenger deals nothing.
  let r = g.night({ a01: { kind: 'deal', corner: 'industrial-1' }, a02: { kind: 'deal', corner: 'industrial-1' }, a03: { kind: 'laylow' } });
  const fight = r.newEvents.find(e => e.type === 'fight' && e.kind === 'corner');
  assert.deepEqual([fight.corner, fight.target, fight.defence, fight.won], ['industrial-1', 'a01', 1, false]);
  assert.equal(one(r, 'sale', 'a01').doses, 7, 'the holder sells its 7');
  assert.equal(of(r, 'sale', 'a02').length, 0);
  assert.equal(g.s.agents.a02.heat, 0, 'a corner fight is no crime');
  assert.equal(of(r, 'arrest').length, 0, 'no cops in The Yards for this fight');
  // With brass knuckles the challenger is 2 against 1: it takes the corner, and takes nothing else.
  knuckles(g, 'a02');
  r = g.night({ a01: { kind: 'deal', corner: 'industrial-1' }, a02: { kind: 'deal', corner: 'industrial-1' }, a03: { kind: 'laylow' } });
  assert.equal(g.s.corners['industrial-1'].holder, 'a02');
  assert.deepEqual(one(r, 'turf').holder, 'a02');
  assert.equal(one(r, 'turf').was, 'a01');
  assert.equal(one(r, 'sale', 'a02').doses, 6, 'a new holder sells 6');
  assert.equal(of(r, 'sale', 'a01').length, 0);
  assert.equal(of(r, 'rob').length, 0, 'a corner fight takes no piece and no cash');
  assert.equal(g.s.agents.a02.heat, 0, 'no heat: not a hot corner, and no crime');
});

test('corners: a tie on an open corner means nobody deals; a holder away leaves it open; in Glasswall the loser is arrested (§9, §8)', () => {
  const g = withTrades(['dealer', 'dealer', 'dealer', 'dealer', 'dealer']);
  housed(g, ['a01', 'a02', 'a03', 'a04', 'a05']);
  for (const id of ['a01', 'a02', 'a03', 'a04', 'a05']) stock(g, id, 'temp', 10);
  let r = g.night({
    a01: { kind: 'deal', corner: 'suburbs-1' }, a02: { kind: 'deal', corner: 'suburbs-1' },
    a03: { kind: 'deal', corner: 'suburbs-2' }, a04: { kind: 'deal', corner: 'downtown-1' }, a05: { kind: 'laylow' },
  });
  assert.equal(of(r, 'sale', 'a01').length + of(r, 'sale', 'a02').length, 0, 'an open corner, 1 against 1: nobody deals');
  assert.equal(g.s.corners['suburbs-1'].holder, null);
  assert.equal(g.s.corners['suburbs-2'].holder, 'a03');
  assert.equal(g.s.corners['downtown-1'].holder, 'a04');
  // a03 is away from its corner: it's open, and two challengers tie again. a05 challenges a04 in Glasswall: 1 against
  // the holder's 1 plus the heavy district's 1, so it loses, and the cops in that fight arrest it.
  r = g.night({
    a01: { kind: 'deal', corner: 'suburbs-2' }, a02: { kind: 'deal', corner: 'suburbs-2' },
    a03: { kind: 'laylow' }, a04: { kind: 'deal', corner: 'downtown-1' }, a05: { kind: 'deal', corner: 'downtown-1' },
  });
  const fightAt = corner => r.newEvents.find(e => e.type === 'fight' && e.corner === corner);
  assert.deepEqual([fightAt('suburbs-2').target, fightAt('suburbs-2').won], [null, false], 'the holder away: an open corner');
  assert.equal(g.s.corners['suburbs-2'].holder, 'a03', 'nobody dealt there, so a03 still holds it');
  assert.deepEqual([fightAt('downtown-1').defence, fightAt('downtown-1').cops], [2, 1]);
  assert.ok(g.s.agents.a05.jail, 'the losing challenger is arrested');
  assert.equal(one(r, 'sale', 'a04').doses, 7);
});

test('flex: every rare-or-better piece worn while working pays, at the lock; laying low pays nothing; Payday doubles it (§4, §13)', () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler'], { midseason: 'payday' });
  housed(g, ['a01', 'a02', 'a03']);
  const epic = tierCopy(g.s, 'epic');
  g.hand('a01', tierCopy(g.s, 'rare'), { wear: true });
  g.hand('a02', tierCopy(g.s, 'rare', t => true, 1), { wear: true });
  g.hand('a03', epic, { wear: true });
  g.hand('a03', tierCopy(g.s, 'rare', t => t.slot !== g.s.copies[epic].slot, 2), { wear: true });
  let r = g.night({ a01: { kind: 'hustle', place: 'docks' }, a02: { kind: 'laylow' }, a03: { kind: 'run', place: 'mall' } });
  assert.equal(one(r, 'flex', 'a01').pay, 10, 'a rare: +$10');
  assert.equal(of(r, 'flex', 'a02').length, 0, 'laying low earns nothing');
  assert.equal(one(r, 'flex', 'a03').pay, 35, 'an epic and a rare: +$25 +$10');
  assert.equal(g.s.money.in.flex, 45, 'flex is a cash source');
  assert.ok(!g.view('a02').events.some(e => e.type === 'flex'), "someone's flex is its own now");
  g.night({ a01: { kind: 'laylow' }, a02: { kind: 'laylow' }, a03: { kind: 'laylow' } });
  assert.ok(g.view('a02').events.some(e => e.type === 'flex' && e.agent === 'a01'), '... and everyone\'s 24 hours later');
  g.advanceTo(7);
  r = g.night({ a01: { kind: 'hustle', place: 'docks' }, a02: { kind: 'laylow' }, a03: { kind: 'laylow' } });
  assert.equal(one(r, 'flex', 'a01').pay, 20, 'Payday doubles it');
});

test("the trades' results are the agent's now and everyone's 24 hours later; corners and their holders are public live (§19)", () => {
  const g = withTrades(['smuggler', 'chemist', 'dealer', 'gunrunner', 'smuggler']);
  housed(g, ['a01', 'a02', 'a03', 'a04', 'a05']);
  g.night({
    a01: { kind: 'run', place: 'mall' }, a02: { kind: 'cook', place: 'suburbs', batches: 1 },
    a03: { kind: 'deal', corner: 'strip-2' }, a04: { kind: 'build', lockpicks: 2 }, a05: { kind: 'laylow' },
  });
  const sees = (who, type, agent) => g.view(who).events.some(e => e.type === type && e.agent === agent);
  for (const [type, agent] of [['gather', 'a01'], ['cook', 'a02'], ['sale', 'a03'], ['craft', 'a04']]) {
    assert.ok(sees(agent, type, agent), `${type}: its agent sees it now`);
    assert.ok(!sees('a05', type, agent), `${type}: nobody else does yet`);
  }
  assert.ok(g.view('a05').events.some(e => e.type === 'turf' && e.holder === 'a03'), 'a corner changing hands is public');
  const corner = g.view(null, 'public').board.corners.find(c => c.corner === 'strip-2');
  assert.deepEqual(corner, { corner: 'strip-2', place: 'strip', hot: true, holder: 'a03' }, 'the board shows every holder');
  g.night({ a01: { kind: 'laylow' }, a02: { kind: 'laylow' }, a03: { kind: 'laylow' }, a04: { kind: 'laylow' }, a05: { kind: 'laylow' } });
  for (const [type, agent] of [['gather', 'a01'], ['cook', 'a02'], ['sale', 'a03'], ['craft', 'a04']]) {
    assert.ok(sees('a05', type, agent), `${type}: everyone, 24 hours later`);
  }
});

// GAME.md §26's shuffle test with the trades: the same plays in any order give the same night, under both rules.
function reorder(plays, seed) {
  const out = {};
  for (const k of shuffle(rng('trades-shuffle', seed), Object.keys(plays))) out[k] = plays[k];
  return out;
}
for (const rule of ['A', 'B']) {
  test(`the same trade plays in any order give the same night (rule ${rule})`, () => {
    const trades = ['smuggler', 'smuggler', 'smuggler', 'dealer', 'dealer', 'dealer', 'chemist', 'chemist', 'gunrunner', 'smuggler', 'smuggler', 'smuggler'];
    const g = withTrades(trades, { rule });
    housed(g, trades.map((t, i) => idOf(i + 1)));
    for (const id of ['a04', 'a05', 'a06']) stock(g, id, 'temp', 8);
    stock(g, 'a07', 'chems', 2);
    stock(g, 'a09', 'parts', 2);
    knuckles(g, 'a05');
    knuckles(g, 'a10');
    g.hand('a02', abilityCopy(g.s, 'workboots'), { wear: true });
    const nights = [
      {
        a01: { kind: 'run', place: 'forest' }, a02: { kind: 'run', place: 'forest' }, a03: { kind: 'run', place: 'forest' },
        // R4-2 (gap.accept): a04 and a10 accept their backers.
        a04: { kind: 'deal', corner: 'strip-1', accept: ['a11'] }, a05: { kind: 'deal', corner: 'strip-1' }, a06: { kind: 'deal', corner: 'suburbs-1' },
        a07: { kind: 'cook', place: 'forest', batches: 2 }, a08: { kind: 'cook', place: 'suburbs', batches: 1 },
        a09: { kind: 'build', guns: 1, lockpicks: 2 }, a10: { kind: 'hit', target: 'a03', place: 'forest', accept: ['a12'] },
        a11: { kind: 'back', target: 'a04' }, a12: { kind: 'back', target: 'a10' },
      },
      {
        a01: { kind: 'hit', target: 'a06', place: 'suburbs' }, a02: { kind: 'run', place: 'docks' }, a03: { kind: 'run', place: 'docks' },
        // R4-2 (gap.accept): a05 accepts its backer.
        a04: { kind: 'deal', corner: 'strip-1' }, a05: { kind: 'deal', corner: 'strip-1', accept: ['a11'] }, a06: { kind: 'deal', corner: 'suburbs-1' },
        a07: { kind: 'laylow' }, a08: { kind: 'cook', place: 'forest', batches: 1 },
        a09: { kind: 'hustle', place: 'docks' }, a10: { kind: 'hit', target: 'a07', place: 'forest' },
        a11: { kind: 'back', target: 'a05' }, a12: { kind: 'deal', corner: 'docks-1' },
      },
    ];
    let n = 0;
    for (const plays of nights) {
      n += 1;
      const base = settleNight(g.s, plays);
      const want = JSON.stringify([base.events, base.state, base.fights]);
      for (let k = 0; k < 12; k++) {
        const r = settleNight(g.s, reorder(plays, `${rule}-${n}-${k}`));
        assert.equal(JSON.stringify([r.events, r.state, r.fights]), want, `night ${n}, order ${k}`);
      }
      g.s = base.state;
      g.log.push(...base.events);
      checkLedger(g.s, `night ${n}`);
    }
    // Positive control: these nights had a split drop, a corner fight, a taken haul, cooking, a build and a sale.
    for (const type of ['gather', 'cook', 'craft', 'sale', 'turf']) assert.ok(g.log.some(e => e.type === type), `a ${type} happened`);
    assert.ok(g.log.some(e => e.type === 'fight' && e.kind === 'corner'), 'a corner fight happened');
    assert.ok(g.log.some(e => e.type === 'rob' && e.goods), 'a hit took carried goods');
  });
}
