// CLEAR and the model seat (GAME.md §11, §17; GAP gap.clear). §11: "the game wipes your plan card and everything your
// agent learned in the last day", the price of an arrest that seizes nothing. The core forgets for the agent: its view
// loses its private events from before the take, and the words said in today's sit-downs before it (rules/view.mjs).
// The seat (agents/seat.mjs) keeps memory of its own between calls: tonight's pick, a play the model sent earlier in
// the day, which plays at the lock when nobody answers there (§17: "your agent's pick plays"); the last reply's results,
// which the next briefing shows; and the day's failed tries, which refuse an action untried (gap.tries). Once its agent
// has taken CLEAR, as the seat's own view shows it, none of that from before the take goes on: the next briefing and
// the lock's fallback carry nothing from before it, standing orders and the default play still answer, and what the
// seat learns after the take it keeps. Another agent's CLEAR wipes nothing of this seat's.
// The independent review's probe (Astra, 2026-10-17): with its endpoint down at the lock, a seat still played the hit it
// had picked before CLEAR, and its lock briefing still said "Your last reply: - play: set, hit a02 docks".
// Nothing here calls a model: every call goes to the fake (R2-6), in-process, on its manual clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { defaultPlay } from '../rules/plays.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { briefing } from '../agents/briefing.mjs';
import { fakeModel, manualClock, CHAT_PATH } from '../agents/fake-model.mjs';
import { N } from '../numbers.mjs';

const seatModule = () => import('../agents/seat.mjs');
// In-process, any URL with the endpoint's path will do: the fake never reaches the network.
const IN_PROCESS = `http://fake.invalid${CHAT_PATH}`;
// The per-season secret a caller passes in (the runner draws one; never the season's seed).
const SECRET = 'a secret drawn when the season starts';
const HIT = { act: 'play', kind: 'hit', target: 'a02', place: 'docks' };
const SHIFT = { act: 'play', kind: 'hustle', place: 'docks' };
const TAKE = { act: 'take', drug: 'clear' };
// The briefing's heading for the last reply's results, and what it writes under it for the pick from before the take
// (briefing.mjs). A retry's own message starts "Your last reply failed:", which is this call's, not the old reply's.
const LAST = 'Your last reply:';
const OLD_PICK = 'play: set, hit a02 docks';
const said = actions => ({ json: { actions } });
// A call point nobody answers: the call and its retry, each malformed.
const none = () => Array(1 + N['gap.retry']).fill({ fault: 'malformed' });

// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind) {
  addGoods(g.s.agents[id], kind, 1);
  bookGoods(g.s, 'in', 'test', kind, 1);
  checkLedger(g.s, `stock ${id} ${kind}`);
}

// a01's seat on the fake, with the real briefing (briefing.mjs), its errands applied to the rules as the season loop
// applies them. Every briefing's round and last results are kept, and every request the fake took.
async function seated(g, script, more = {}) {
  const { makeSeat } = await seatModule();
  const clock = manualClock();
  const fake = fakeModel({ script: { a01: script }, clock });
  const briefs = [];
  const brief = (r, memory, last, round) => {
    briefs.push({ day: r.view.day, round, last: JSON.parse(JSON.stringify(last)) });
    return briefing(r, { memory, last, call: round === 'lock' ? 'lock' : 'round' });
  };
  const seat = makeSeat({ id: 'a01', url: IN_PROCESS, fetch: fake.fetch, secret: SECRET, brief, clock, ...more });
  const apply = e => {
    const r = g.errand('a01', e.kind, e);
    const bad = r.events.find(x => x.type === 'invalid');
    return { ok: r.ok, why: r.why, kind: bad ? bad.kind : undefined };
  };
  const call = round => seat.call(round === 'lock'
    ? { view: g.view('a01'), round, defaultPlay: defaultPlay(g.s, 'a01', g.s.day) }
    : { view: g.view('a01'), round, apply });
  // The text of the requests of the last call point: the call and, if it was made, its retry.
  const sent = n => fake.calls.slice(-n).map(c => c.request.messages.map(m => m.content).join('\n')).join('\n');
  return { seat, fake, briefs, call, sent };
}

test('CLEAR after the model picked tonight\'s play: with nobody answering at the lock, the pick from before the take never plays, and the lock\'s briefing shows nothing from before it; the default play answers, or standing orders when there are some (§11, §17, gap.clear)', async () => {
  const work = { play: { kind: 'hustle', place: 'docks' }, reason: 'standing order: work' };
  for (const orders of [null, (view, round) => (round === 'lock' ? work : null)]) {
    const g = new Game({ n: 3 });
    stock(g, 'a01', 'clear');
    const { seat, fake, briefs, call, sent } = await seated(g, [said([HIT]), ...none()], orders ? { orders } : {});
    const day = await call(1);
    assert.equal(day.origin, 'model');
    assert.deepEqual(seat.memo.pick, { kind: 'hit', target: 'a02', place: 'docks' }, "positive control: the model's pick by day");
    assert.equal(g.errand('a01', 'take', { drug: 'clear' }).ok, true, 'a01 takes CLEAR');
    const lock = await call('lock');
    assert.deepEqual([lock.calls, lock.outcome], [1 + N['gap.retry'], 'malformed'], 'nobody answered at the lock');
    const want = orders ? ['orders', { ...work.play, reason: work.reason }] : ['default', defaultPlay(g.s, 'a01', g.s.day)];
    assert.deepEqual([lock.origin, lock.play], want, orders ? 'standing orders answer' : 'the default play answers');
    assert.ok(!lock.results.some(r => r.act === 'play' && r.ok && r.play && r.play.kind === 'hit'), 'the old pick is not played');
    assert.deepEqual(briefs.at(-1).last, [], 'the lock briefing gets no last results from before the take');
    const text = sent(1 + N['gap.retry']);
    assert.ok(!text.includes(LAST) && !text.includes(OLD_PICK), 'nor does either request say them');
    assert.deepEqual(fake.unused(), []);
    await fake.close();
  }
});

test('CLEAR taken in the same reply as tonight\'s pick wipes the pick: the reply was written with what the agent knew before the take (§11, §17, gap.clear)', async () => {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'clear');
  const { fake, briefs, call, sent } = await seated(g, [said([HIT, TAKE]), ...none()]);
  const day = await call(1);
  assert.deepEqual(day.results.map(r => [r.act, r.ok]), [['play', true], ['take', true]], 'the pick, then the take, both through');
  const lock = await call('lock');
  assert.deepEqual([lock.origin, lock.play], ['default', defaultPlay(g.s, 'a01', g.s.day)]);
  assert.deepEqual(briefs.at(-1).last, []);
  assert.ok(!sent(1 + N['gap.retry']).includes(OLD_PICK));
  await fake.close();
});

test('what the seat learns after the take it keeps: a pick sent after CLEAR plays at the lock, the lock\'s briefing shows that reply, the take wipes once and not again the next day, and another agent\'s CLEAR wipes nothing of this seat\'s (§11, §17, gap.clear)', async () => {
  {
    const g = new Game({ n: 3 });
    stock(g, 'a01', 'clear');
    const { fake, briefs, call } = await seated(g, [said([TAKE]), said([SHIFT]), ...none(), ...none()]);
    await call(1);
    const after = await call(2);
    assert.deepEqual(briefs.at(-1).last, [], "round 2's briefing: round 1's results were from before the seat saw the take");
    assert.equal(after.origin, 'model');
    const lock = await call('lock');
    assert.deepEqual([lock.origin, lock.play], ['model', { kind: 'hustle', place: 'docks' }], 'the pick sent after the take plays');
    assert.ok(briefs.at(-1).last.some(r => r.act === 'play' && r.ok && r.play.kind === 'hustle'), "the lock's briefing shows round 2's reply");
    g.night({ a01: lock.play });
    assert.ok(g.view('a01').events.some(e => e.type === 'take' && e.agent === 'a01' && e.drug === 'clear'), 'positive control: the take is still in its view on day 2');
    await call(1);
    assert.deepEqual([briefs.at(-1).day, briefs.at(-1).last.length > 0], [2, true], "day 2's first briefing shows the lock's results: no second wipe");
    assert.deepEqual(fake.unused(), []);
    await fake.close();
  }
  {
    const g = new Game({ n: 3 });
    stock(g, 'a02', 'clear');
    assert.equal(g.errand('a02', 'take', { drug: 'clear' }).ok, true, 'a02 takes CLEAR');
    const { fake, briefs, call } = await seated(g, [said([SHIFT]), said([SHIFT]), ...none()]);
    await call(1);
    const lock = await call('lock');
    g.night({ a01: lock.play, a02: { kind: 'hustle', place: 'docks' } });
    assert.ok(g.view('a01').events.some(e => e.type === 'take' && e.agent === 'a02' && e.drug === 'clear'), "positive control: a day on, a02's take is on a01's record");
    await call(1);
    assert.ok(briefs.at(-1).last.length > 0, "a01's briefing keeps its own last results");
    await fake.close();
  }
});

test('the day\'s failed tries start over at CLEAR: an action refused untried before the take reaches the rules again after it, and its failure is the rules\' (§11, §33, gap.clear, gap.tries)', async () => {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'clear');
  const pay = { act: 'pay', to: 'a02', amount: g.s.agents.a01.cash + 1 };
  const { fake, call } = await seated(g, [said(Array(N['gap.tries']).fill(pay)), said([pay]), said([pay])]);
  const first = await call(1);
  assert.ok(first.results.every(r => r.act === 'pay' && !r.ok && r.code === 'rules'), "each fails in the rules: it hasn't that much cash");
  const capped = await call(2);
  assert.equal(capped.results[0].code, 'repeat', `positive control: after ${N['gap.tries']} failures it's refused untried`);
  assert.equal(g.errand('a01', 'take', { drug: 'clear' }).ok, true, 'a01 takes CLEAR');
  const again = await call(3);
  assert.deepEqual([again.results[0].code, again.results[0].why], ['rules', first.results[0].why], 'tried again, and refused by the rules');
  assert.deepEqual(fake.unused(), []);
  await fake.close();
});
