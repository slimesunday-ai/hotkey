// L2-6c, the Cops in the cast where every seat trades (GAME.md §8, §13). L2-6's bench reached no collar fight in 40
// seasons: each Cop named the district where the show last saw its target while a wanted agent lies low at home, Cops
// on one target collared it each and their groups tied and all failed (§8), a lone unarmed Cop loses even at the right
// door, and the Cop seat never held a gun. In the trades cast every seat that works the Cop trade now plays from the
// same public facts: it looks for a wanted agent at home unless the show saw it out while it was already wanted, backs
// one collar (the Cop seat's, else the lowest id's), collars only when the group beats the defence it reckons, and the
// Cop seat saves for a gun. Layer 2's and layer 1's casts keep their bots as they were. Each test imports what it needs
// itself, so each fails on its own before the habits exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { rng } from '../rng.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-collars-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const bots = () => import('../bench/bots.mjs');
const readLog = dir => fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));

// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  const a = g.s.agents[id];
  a.goods[kind] = (a.goods[kind] || 0) + n;
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}

// A small season on day 1, one bot config each (type, trade, `every` for the trades cast's bots, and the driver the
// board shows: the Cop seat's is bot:cop). `play(id)` is tonight's play from a fresh bot; `day()` plays a day's three
// rounds, every bot in id order, its errands applied.
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
  const play = id => makeBot(cfg[id], {}).night(g.view(id), ctx(id, 'night')).play;
  const memos = Object.fromEntries(agents.map(a => [a.id, {}]));
  const day = () => {
    for (let round = 1; round <= 3; round++) {
      for (const a of agents) {
        for (const e of makeBot(cfg[a.id], memos[a.id]).day(g.view(a.id), ctx(a.id, round))) {
          const res = g.errand(a.id, e.kind, e);
          assert.ok(res.ok, `${a.id} ${e.kind}: ${res.why}`);
        }
      }
    }
  };
  return { g, play, day, ctx };
}

const copSeat = { type: 'cop', trade: 'cop', driver: 'bot:cop', every: true };
const worksCop = { type: 'buylate', trade: 'cop', works: true, every: true };
const dealer = { type: 'dealer', trade: 'dealer', every: true };
const shift = { type: 'hustle', trade: 'cop', every: true };
const smuggler = { type: 'smuggler', trade: 'smuggler', every: true };
const patrol = { kind: 'patrol', place: 'docks' };
const laylow = { kind: 'laylow' };

// Two seats that work the Cop trade on their free nights (a01, a02), the Cop seat (a03), a Dealer (a04) that turns
// wanted on night 2 dealing on a hot corner at 2 stars, a shift worker that's a Cop on paper (a05) and a Smuggler, each
// with the rent in hand. On day 3 the record has made night 1's plays public: `onRecord` are the Cops that patrolled
// that night (the rest lay low). `armed`: a04's holdings at night 1's dawn show a gun.
async function street({ onRecord = ['a01', 'a02', 'a03'], armed = false } = {}) {
  const w = await world([worksCop, worksCop, copSeat, dealer, shift, smuggler]);
  const { g } = w;
  for (let i = 1; i <= 6; i++) g.grant(idOf(i), 100);
  if (armed) stock(g, 'a04', 'guns', 1);
  const cop = id => (onRecord.includes(id) ? patrol : laylow);
  g.night({ a01: cop('a01'), a02: cop('a02'), a03: cop('a03'), a04: laylow });
  g.s.agents.a04.heat = 2;
  g.night({ a01: patrol, a02: patrol, a03: patrol, a04: { kind: 'deal', corner: 'strip-1' } });
  assert.equal(g.s.agents.a04.heat, 3, 'the hot corner made a04 wanted');
  return w;
}

test('where a Cop looks: home, unless the show saw the wanted agent out last night while it was already wanted; at 4 stars always home (§6, §13)', async () => {
  const { collarSpot, copPlan } = await bots();
  const { g, ctx } = await world([copSeat, dealer, dealer, dealer, shift]);
  g.night({ a01: patrol });
  // Night 2: a02 turns wanted on a hot corner; a03, wanted at the lock, deals on a corner that isn't hot (its heat
  // falls to 3); a04, wanted at the lock, deals on a hot corner and climbs to 4.
  g.s.agents.a02.heat = 2;
  g.s.agents.a03.heat = 4;
  g.s.agents.a04.heat = 3;
  g.night({ a01: patrol, a02: { kind: 'deal', corner: 'strip-1' }, a03: { kind: 'deal', corner: 'industrial-1' }, a04: { kind: 'deal', corner: 'strip-2' } });
  assert.deepEqual(['a02', 'a03', 'a04'].map(id => g.s.agents[id].heat), [3, 3, 4]);
  const v = g.view('a01');
  const spot = id => collarSpot(v, v.board.agents.find(a => a.id === id));
  assert.deepEqual([spot('a02').place, spot('a02').home], ['suburbs', true], 'it only turned wanted last night: it lies low now');
  assert.deepEqual([spot('a03').place, spot('a03').home], ['industrial', false], 'wanted and out last night: out again');
  assert.deepEqual([spot('a04').place, spot('a04').home], ['suburbs', true], 'at 4 stars it lies low');
  // Layer 2's Cop seat is as it was: it names where the show last saw its target.
  assert.deepEqual(copPlan(v, ctx('a01', 'night'), { type: 'cop', fav: 'industrial', layer: 2 }).play, { kind: 'collar', target: 'a04', place: 'strip' });
});

test("one collar: the Cops working the trade back the Cop seat's collar on a wanted agent at home, and win; a shift worker, a Cop on paper, stays on its shift (§8, §13)", async () => {
  const { g, play } = await street({ armed: true });
  const plays = Object.fromEntries(['a01', 'a02', 'a03', 'a05'].map(id => [id, play(id)]));
  // R4-2 (gap.accept): the collar accepts the Cops the plan puts in its group.
  assert.deepEqual(plays.a03, { kind: 'collar', target: 'a04', place: 'suburbs', accept: ['a01', 'a02'] }, "the Cop seat's collar, at a04's home");
  assert.deepEqual([plays.a01, plays.a02], [{ kind: 'back', target: 'a03' }, { kind: 'back', target: 'a03' }], 'one group, not rival ones');
  assert.equal(plays.a05.kind, 'hustle');
  const r = g.night({ ...plays, a04: laylow });
  const fights = r.fights.fights.filter(f => f.kind === 'collar');
  assert.equal(fights.length, 1);
  // 3 Cops and the city cops' 2, against the lock, a04, its gun and laying low.
  assert.deepEqual([fights[0].attackers.map(x => x.members), fights[0].attackers[0].strength, fights[0].defence, fights[0].winner], [[['a03', 'a01', 'a02']], 5, 4, 'a03']);
  assert.ok(g.s.agents.a04.jail, 'collared');
  assert.equal(r.newEvents.find(e => e.type === 'arrest' && e.agent === 'a04').by, 'a03');
});

test('when to go: the Cops collar only when their group beats the defence they reckon from public facts, and bring only the Cops it takes and one more (§8)', async () => {
  const { policePlan } = await bots();
  // a04 armed (its holdings 24 hours ago show a gun) and laying low at home: 1 + 1 + 1 + 1 = 4. The Cop seat and one
  // Cop on the record are 2 and the city cops' 2: a tie holds, so they patrol.
  let { g, play } = await street({ armed: true, onRecord: ['a01', 'a03'] });
  assert.equal(policePlan(g.view('a03')), null);
  assert.deepEqual(['a01', 'a02', 'a03'].map(id => play(id).kind), ['patrol', 'patrol', 'patrol']);
  // Unarmed (3), the Cop seat alone ties it; with a01 on the record they beat it, and a02, which wasn't, patrols.
  ({ g, play } = await street({ onRecord: ['a03'] }));
  assert.equal(play('a03').kind, 'patrol');
  ({ g, play } = await street({ onRecord: ['a01', 'a03'] }));
  assert.deepEqual(policePlan(g.view('a02')), {
    target: 'a04', place: 'suburbs', home: true, lead: 'a03', group: ['a03', 'a01'], strength: 4, defence: 3, why: 'wanted, so it lies low at home',
  }, 'every Cop reads the same plan');
  assert.deepEqual(['a01', 'a02', 'a03'].map(id => play(id).kind), ['back', 'patrol', 'collar']);
  // All three on the record: the Cop seat and a01 beat it, and a02 comes as the one more.
  ({ g, play } = await street());
  assert.deepEqual(policePlan(g.view('a01')).group, ['a03', 'a01', 'a02']);
});

test("without the Cop seat the lowest id's collar is the one the others back (§13)", async () => {
  // The Cop seat lay low on night 1, so the record doesn't show it working the trade.
  const { play } = await street({ onRecord: ['a01', 'a02'] });
  // R4-2 (gap.accept): the collar accepts the Cop the plan puts in its group.
  assert.deepEqual([play('a01'), play('a02')], [{ kind: 'collar', target: 'a04', place: 'suburbs', accept: ['a02'] }, { kind: 'back', target: 'a01' }]);
  assert.equal(play('a03').kind, 'patrol', "it isn't in the plan, so it patrols");
});

test("the Cop seat saves for a gun: it keeps a gun's price back from the list and back only tonight's rent, and buys one from a Gunrunner; layer 2's buys off the list (§8, §9)", async () => {
  const gunrunner = { type: 'gunrunner', trade: 'gunrunner', every: true };
  const { g, day } = await world([copSeat, { type: 'cop', trade: 'cop', driver: 'bot:cop' }, gunrunner, shift]);
  stock(g, 'a03', 'guns', 1);
  // $175: a gun is $150 from a Gunrunner, and tonight's rent $20.
  g.grant('a01', 175);
  g.grant('a02', 175);
  day();
  assert.equal(g.s.agents.a01.goods.guns, 1, 'the Cop seat is armed');
  assert.equal(g.events('pay', e => e.from === 'a01' && e.to === 'a03' && e.amount === 150).length, 1, 'and paid for it');
  assert.equal(g.events('bid', e => e.agent === 'a01').length + g.s.offers.filter(o => o.by === 'a01').length, 0, 'nothing off the list');
  assert.equal(g.s.agents.a02.goods.guns || 0, 0, "layer 2's keeps $40 more back");
  assert.ok(g.s.offers.some(o => o.by === 'a02'), "layer 2's buys off the list");
});

test('the report counts every Cop-trade seat\'s collars in the trades cast: tried, fought, won and backed; layer 2\'s report is as it was (§27)', async () => {
  const { seasonMetrics, seasonReport } = await import('../bench/report.mjs');
  const seat = (id, type, trade, works) => ({ id, type, trade, name: id, layer: 2, ...(works ? { works: true } : {}) });
  const cast = [seat('a01', 'cop', 'cop'), seat('a02', 'buylate', 'cop', true), seat('a03', 'dealer', 'dealer'), seat('a04', 'hustle', 'cop'), seat('a05', 'turtle', 'cop', true)];
  const state = { agents: Object.fromEntries(cast.map(c => [c.id, {}])), copies: {}, money: { in: { collar: 300 }, out: {} } };
  const log = [
    { type: 'play', day: 4, agent: 'a01', kind: 'collar', target: 'a03', place: 'suburbs' },
    { type: 'play', day: 4, agent: 'a02', kind: 'back', target: 'a01' },
    { type: 'play', day: 4, agent: 'a05', kind: 'back', target: 'a03' },
    { type: 'collar', night: 4, agent: 'a01', target: 'a03', stars: 3, pay: 300 },
    { type: 'arrest', night: 4, agent: 'a03', why: 'collar', by: 'a01' },
    { type: 'play', day: 9, agent: 'a01', kind: 'collar', target: 'a05', place: 'suburbs' },
  ];
  const group = { leader: 'a01', members: ['a01', 'a02'], strength: 4 };
  const night = (n, fights = []) => ({ night: n, haul: {}, hits: [], placesChanged: false, fights, guns: { held: 0, armed: 0 } });
  const bench = { seed: 1, rule: 'A', midseason: 'payday', nights: [night(4, [{ kind: 'collar', target: 'a03', winner: 'a01', attackers: [group], arrested: [] }]), night(9)] };
  const m = seasonMetrics(state, log, bench, cast);
  // a05 backed a Dealer, not a Cop's collar.
  assert.deepEqual(m.police.collars, { tried: 2, fought: 1, won: 1, backed: 1 });
  assert.match(seasonReport(m), /Every seat that works the Cop trade: 2 collars tried, 1 found their target, 1 won; 1 backs of another Cop's collar\./);
  const layer2 = seasonMetrics(state, log, bench, cast.map(({ works, ...c }) => c));
  assert.equal('collars' in layer2.police, false);
  assert.equal(seasonReport(layer2).includes('Every seat that works the Cop trade'), false);
});

test('seasons with the trades cast: collars reach their target and win, one group a target, at home unless the show saw it out while wanted, and the Cop seat is armed (§8, §13)', async () => {
  const { CASTS } = await bots();
  const { runSeason } = await import('../bench/runner.mjs');
  for (const [seed, rule] of [[405, 'A'], [406, 'B']]) {
    const { dir, metrics } = runSeason({ seed, rule, outDir: path.join(tmp, 'seasons'), mix: CASTS.trades });
    const ck = JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8'));
    const log = readLog(dir);
    assert.equal(metrics.ledger.failed, 0);
    assert.deepEqual(log.filter(e => e.type === 'invalid').map(e => `${e.agent} ${e.errand || e.kind}: ${e.why}`), [], `seed ${seed}: no invalid play or errand`);
    const cops = new Set(ck.cast.filter(c => c.trade === 'cop' && c.type !== 'hustle').map(c => c.id));
    const plays = log.filter(e => e.type === 'play');
    const collars = plays.filter(e => e.kind === 'collar');
    for (const c of collars) {
      assert.equal(collars.filter(x => x.day === c.day && x.target === c.target).length, 1, `seed ${seed}: rival collars on ${c.target} on night ${c.day}`);
      if (c.place === 'suburbs') continue;
      // Out: the show saw it there the night before, and it was wanted at that lock.
      const show = log.find(e => e.type === 'show' && e.night === c.day - 1);
      const heat = log.find(e => e.type === 'heat' && e.agent === c.target && e.t === 2 * c.day - 1);
      assert.ok(show.seen[c.target] === c.place && heat && heat.was >= 3, `seed ${seed}: ${c.agent} collared ${c.target} in ${c.place} on night ${c.day}`);
    }
    // Every Cop that backs a Cop backs its collar that night, unless it promised to back it as hired muscle.
    const hired = b => log.some(e => e.type === 'say' && e.say === 'promise' && e.from === b.agent && e.terms.what === 'back' && e.terms.who === b.target && e.terms.night === b.day);
    for (const b of plays.filter(e => e.kind === 'back' && cops.has(e.agent) && cops.has(e.target) && !hired(e))) {
      const led = plays.find(e => e.agent === b.target && e.day === b.day);
      assert.equal(led.kind, 'collar', `seed ${seed}: ${b.agent} backed ${b.target}'s ${led.kind} on night ${b.day}`);
    }
    assert.ok(log.some(e => e.type === 'collar'), `seed ${seed}: a collar won`);
    const seat = ck.cast.find(c => c.type === 'cop').id;
    assert.ok(log.some(e => e.type === 'holdings' && e.agent === seat && e.goods.guns), `seed ${seed}: the Cop seat armed itself`);
  }
});
