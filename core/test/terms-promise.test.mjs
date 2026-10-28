// R5-terms, the second defect the paid diagnostic found (runs/2026-10-18-r5diag, two-obligations, 1 of 2): Luna had
// promised a03 a cut for backing her hit on night 1, the hit won, and on day 2 the core counted the cut due, a walk if
// still unpaid at the next dawn, while her briefing showed the promise as "expired", read off its night alone. One
// sample believed it and didn't pay. Now the core is the one owner of where a promise stands (rules/state.mjs
// promiseState, which the walk itself reads): the view carries it, and the briefing shows a cut still owed as owed,
// with the amount and the dawn it counts as walked out on, in the seat's own state and on the message that made it.
// The first test is the diagnostic's own scenario, built as harness.mjs builds it. Amounts come from N and the bots'
// own settings: the goods deal at the rent, the cut at the agents' street price (the diagnostic's $20 and $15).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { N } from '../numbers.mjs';

const tools = () => import('../agents/tools.mjs');
const briefingOf = () => import('../agents/briefing.mjs');
const bots = () => import('../bench/bots.mjs');
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
function ok(g, id, kind, fields) {
  const r = g.errand(id, kind, fields);
  assert.equal(r.ok, true, `day ${g.s.day}: ${id}'s ${kind} went through (${r.why})`);
  return r;
}
function sitDown(g, a, b) {
  ok(g, a, 'ask', { to: b });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, b, 'answer', { sitdown: sd, accept: true });
  return sd;
}
// A season of the given cast, in id order, on day 1, as harness.mjs's World builds one (seed 404, rule A, a blackout).
function seasonOf(rows) {
  const g = new Game({ n: 1 });
  const agents = rows.map(([id, name, trade]) => ({ id, name, trade, driver: id === 'a01' ? 'openai/gpt-6-luna' : 'bot' }));
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
async function story(g, id) {
  const { read } = await tools();
  const { briefing } = await briefingOf();
  return briefing(read(g.view(id), { audience: 'seat', seed: 'R5-terms' }).result, { call: 'round' })[1].content;
}
const shift = { kind: 'hustle', place: 'docks' };

// The diagnostic's two-obligations world (harness.mjs twoObligations.build), on the morning of day 2: a goods deal with
// a02 (2 chems, agreed day 1, both handed over, Luna's cash still due) and Luna's promise to pay a03 a cut for backing
// her hit on a04 on night 1, which won, so the cut fell due.
async function twoObligations() {
  const { STREET } = await bots();
  const [debt, cut] = [N.rent, STREET.unit];
  const g = seasonOf([['a01', 'penny', 'chemist'], ['a02', 'vex', 'smuggler'], ['a03', 'mo', 'smuggler'], ['a04', 'kit', 'dealer'], ['a05', 'juno', 'gunrunner']]);
  for (const id of Object.keys(g.s.agents)) g.grant(id, 5 * N.rent);
  stock(g, 'a02', 'chems', 2);
  const s1 = sitDown(g, 'a02', 'a01');
  ok(g, 'a02', 'say', { sitdown: s1, say: 'offer', terms: { what: 'sell', goods: { chems: 2 }, cash: debt } });
  ok(g, 'a01', 'say', { sitdown: s1, say: 'offer', terms: { what: 'trade', goods: { chems: 2 }, cash: debt } });
  ok(g, 'a02', 'give', { to: 'a01', goods: { chems: 2 }, sitdown: s1 });
  const s2 = sitDown(g, 'a03', 'a01');
  ok(g, 'a01', 'say', { sitdown: s2, say: 'promise', terms: { what: 'pay', cash: cut, night: 1 }, line: `Back my hit on a04 at the docks tonight and I pay you $${cut}.` });
  const promise = g.s.promises.at(-1).id;
  const night = g.night({ a01: { kind: 'hit', target: 'a04', place: 'docks', accept: ['a03'] }, a03: { kind: 'back', target: 'a01' }, a02: shift, a04: shift, a05: shift });
  const won = night.fights.fights.find(f => f.kind === 'hit' && f.target === 'a04');
  assert.ok(won && won.winner === 'a01' && won.attackers[0].members.includes('a03'), 'control: the backed hit won');
  const p = g.s.promises.find(x => x.id === promise);
  assert.deepEqual(p && [p.due, p.paid], [2, 0], "control: the core counts the cut due today, nothing paid");
  return { g, s1, s2, promise, debt, cut };
}

test("the diagnostic's two-obligations: on day 2 the promise shows as $15 due, with the dawn it counts as walked out on, in Luna's own state and on its message, never as expired; a03 reads the same (§12, §14)", async () => {
  const { g, s1, s2, promise, debt, cut } = await twoObligations();
  const text = await story(g, 'a01');
  const mine = text.split('\n').find(l => l.startsWith(`Promise ${promise}:`));
  assert.equal(mine, `Promise ${promise}: you to a03: pay a03 on night 1 for $${cut}: $${cut} due; unpaid at dawn on day 3, it counts as walked out on.`);
  const said = text.split('\n').find(l => l.startsWith(`- ${s2} with a03`));
  assert.match(said, new RegExp(`you: promise \\(pay \\$${cut} night 1, \\$${cut} due\\)`), `its message reads the promise as it stands: ${said}`);
  assert.ok(!/expired/.test(said) && !/expired/.test(mine), 'never as expired');
  assert.match(text, new RegExp(`- ${s1}: a02 sells you 2 chems for \\$${debt} \\(agreed day 1\\): a02 gave 2 of 2 \\(\\$${debt} due\\), you paid \\$0\\.`), 'control: the goods deal shows as before');
  const theirs = (await story(g, 'a03')).split('\n').find(l => l.startsWith(`Promise ${promise}:`));
  assert.equal(theirs, `Promise ${promise}: a01 to you: pay a03 on night 1 for $${cut}: $${cut} due; unpaid at dawn on day 3, it counts as walked out on.`, 'a03 reads the same facts');
});

test("the view carries the core's own record of a promise, and the walk keeps to the dawn the briefing named: a part paid shows what's left, paid in full shows paid and walks nobody, unpaid walks at that dawn (§12)", async () => {
  // Unpaid: the walk comes at dawn on day 3, the day the view names, and not before.
  let w = await twoObligations();
  let [p] = w.g.view('a01').me.promises;
  assert.deepEqual([p.id, p.state, p.owed, p.paid, p.walkAt], [w.promise, 'owed', w.cut, 0, 3], "Luna's view: the cut owed, and its dawn");
  assert.deepEqual(w.g.view('a03').me.promises.map(x => [x.state, x.owed, x.walkAt]), [['owed', w.cut, 3]], "a03's too");
  w.g.night({ a02: shift, a03: shift, a04: shift, a05: shift, a01: shift });
  assert.equal(w.g.s.day, p.walkAt, 'control: it is that dawn');
  const walk = w.g.events('betray', e => e.kind === 'walk' && e.by === 'a01');
  assert.deepEqual(walk.map(e => [e.victims, e.promise, e.owed, e.paid, e.day]), [[['a03'], w.promise, w.cut, 0, p.walkAt]], 'unpaid, it counts as walked out on at that dawn');
  assert.deepEqual(w.g.view('a01').me.promises, [], 'and the promise is over');
  // Part paid: what's left shows due, with what was paid.
  w = await twoObligations();
  const left = Math.floor(w.cut / 2);
  ok(w.g, 'a01', 'pay', { to: 'a03', amount: w.cut - left, for: 'cut' });
  [p] = w.g.view('a01').me.promises;
  assert.deepEqual([p.state, p.owed, p.paid], ['owed', left, w.cut - left]);
  const part = (await story(w.g, 'a01')).split('\n').find(l => l.startsWith(`Promise ${w.promise}:`));
  assert.match(part, new RegExp(`: \\$${left} due \\(\\$${w.cut - left} paid\\); unpaid at dawn on day 3, it counts as walked out on\\.$`));
  // Paid in full: it shows paid, on its message too, and nobody is walked out on.
  ok(w.g, 'a01', 'pay', { to: 'a03', amount: left, for: 'cut' });
  [p] = w.g.view('a01').me.promises;
  assert.deepEqual([p.state, p.owed, p.paid], ['paid', 0, w.cut]);
  const text = await story(w.g, 'a01');
  assert.equal(text.split('\n').find(l => l.startsWith(`Promise ${w.promise}:`)), `Promise ${w.promise}: you to a03: pay a03 on night 1 for $${w.cut}: paid.`);
  assert.match(text.split('\n').find(l => l.startsWith(`- ${w.s2} with a03`)), new RegExp(`you: promise \\(pay \\$${w.cut} night 1, paid\\)`));
  w.g.night({ a02: shift, a03: shift, a04: shift, a05: shift, a01: shift });
  assert.deepEqual(w.g.events('betray', e => e.kind === 'walk'), [], 'paid: no walk');
  assert.deepEqual(w.g.view('a01').me.promises, [], 'and it is over');
});

test('a promise still open shows as open, with no due and no expiry; one that ended reads expired on its message, as before: a back promise once its night is played, and a cut whose play did not win (§12, §14)', async () => {
  const g = new Game({ n: 4 });
  const sd = sitDown(g, 'a02', 'a01');
  ok(g, 'a01', 'say', { sitdown: sd, say: 'promise', terms: { what: 'pay', cash: N.rent, night: 1 } });
  ok(g, 'a01', 'say', { sitdown: sd, say: 'promise', terms: { what: 'back', who: 'a02', night: 1 } });
  assert.deepEqual(g.view('a01').me.promises.map(p => [p.what, p.state, p.owed, p.walkAt]), [['pay', 'open', undefined, undefined], ['back', 'open', undefined, undefined]], 'both open tonight');
  let text = await story(g, 'a01');
  assert.match(text, /^Promise p1: you to a02: pay a02 on night 1 for \$\d+\.$/m, 'an open promise reads as it did');
  assert.ok(!/due|expired/.test(text.split('\n').find(l => l.startsWith(`- ${sd} with a02`))), 'and its messages carry no mark');
  // a01 lays low: no play of its won, so the cut never falls due; the back promise is over once the night is played.
  g.night({ a01: { kind: 'laylow', place: 'suburbs' } });
  assert.deepEqual(g.view('a01').me.promises, [], 'both ended');
  text = await story(g, 'a01');
  assert.match(text.split('\n').find(l => l.startsWith(`- ${sd} with a02`)), /you: promise \(pay \$\d+ night 1, expired\); you: promise \(back who a02 night 1, expired\)/);
});
