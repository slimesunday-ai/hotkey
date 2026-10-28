// R4-3, deals that last (trunk docs/briefs/R4-astra-fixes.md, task 3; GAME.md §5, §14, §17, §19; sitdownDays).
// Astra's finding (FULL-SIMULATION-REVIEW-2026-10-17.md §3; human/REVIEW.md, journey 3): every sit-down was deleted at
// dawn, and `answer` and `say` need an open one, so an ask accepted on day 1 couldn't be continued on day 2 ("no open
// sit-down"), and two owners who each visit once a day, at different hours, couldn't finish ask → offer → hand over →
// pay. Now:
// - a sit-down stays open N.sitdownDays days from its ask, unless either side closes it first, which uses no message;
// - a pair has one sit-down at a time, and the earpiece hears one for a day;
// - terms tied to a night expire at that night's lock: the view marks them, and a promise for last night's backing never
//   rolls forward;
// - talk still binds nobody: the hand-over and the pay are their own errands, so a deal can be broken, or finished later;
// - §19 is unchanged: who meets whom is public at once on each day both of them act in the sit-down (R4-3's review: one
//   side alone makes no meeting), and the words, a close and an expiry are theirs now and everyone's 24 hours later.
// Amounts come from N. Each test fails on its own before the rule exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy } from './helpers.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { N } from '../numbers.mjs';

const DOCKS = 'docks';
function stock(g, id, kind, n = 1) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
// One agent's visit: its errands, in order, each of which must go through.
function visit(g, id, errands) {
  for (const [kind, fields] of errands) {
    const r = g.errand(id, kind, fields);
    assert.equal(r.ok, true, `day ${g.s.day}: ${id}'s ${kind} went through (${r.why})`);
  }
}
const lastAsk = g => g.events('ask').at(-1).sitdown;
const sitdownIn = (g, id, sd) => g.view(id).me.sitdowns.find(x => x.id === sd) || null;
const DAYS = () => N.sitdownDays;

// Astra's case: a seller and a buyer who each visit once a day, the seller asking and handing over, the buyer offering
// and paying. `sellerFirst`: whose visit comes earlier in the day. Nights pass with every agent on a shift.
function dailyTrade(sellerFirst) {
  const g = new Game({ n: 3 });
  const [seller, buyer] = ['a01', 'a02'];
  const units = N.dropUnits;
  const price = units * N.buyerPrice.chems * 2;
  stock(g, seller, 'chems', units);
  g.grant(buyer, price);
  const terms = { what: 'trade', goods: { chems: units }, cash: price };
  // Each day's visits, in the order they come that day.
  const days = sellerFirst
    ? [
      [[seller, [['ask', { to: buyer }]]], [buyer, sd => [['answer', { sitdown: sd, accept: true }], ['say', { sitdown: sd, say: 'offer', terms }]]]],
      [[seller, sd => [['say', { sitdown: sd, say: 'answer', terms }], ['give', { to: buyer, goods: { chems: units } }]]], [buyer, () => [['pay', { to: seller, amount: price, for: 'deal' }]]]],
    ]
    : [
      [[seller, [['ask', { to: buyer }]]]],
      [[buyer, sd => [['answer', { sitdown: sd, accept: true }], ['say', { sitdown: sd, say: 'offer', terms }]]], [seller, sd => [['say', { sitdown: sd, say: 'answer', terms }], ['give', { to: buyer, goods: { chems: units } }]]]],
      [[buyer, () => [['pay', { to: seller, amount: price, for: 'deal' }]]]],
    ];
  let sd = null;
  for (const visits of days) {
    for (const [id, errands] of visits) {
      visit(g, id, typeof errands === 'function' ? errands(sd) : errands);
      sd ||= lastAsk(g);
    }
    g.night();
  }
  return { g, seller, buyer, units, price, sd };
}

for (const sellerFirst of [true, false]) {
  test(`Astra's daily visitors: a seller and a buyer who each visit once a day, the ${sellerFirst ? 'seller' : 'buyer'} earlier, finish ask → offer → hand over → pay across the days, with no extra visit (§14, §17)`, () => {
    const { g, seller, buyer, units, price } = dailyTrade(sellerFirst);
    const gave = g.events('give', e => e.from === seller && e.to === buyer);
    const paid = g.events('pay', e => e.from === buyer && e.to === seller);
    assert.deepEqual(gave.map(e => e.goods), [{ chems: units }], 'the goods went over');
    assert.deepEqual(paid.map(e => e.amount), [price], 'and the price came back');
    assert.equal(g.s.agents[buyer].goods.chems, units);
    assert.equal(g.events('invalid').length, 0, 'nothing was refused');
  });
}

test('a sit-down stays open N.sitdownDays days from its ask, answered or not, and closes at the dawn after its last day, telling both; the view shows the day it ends (§14)', () => {
  const g = new Game({ n: 4 });
  visit(g, 'a01', [['ask', { to: 'a02' }]]);
  const open = lastAsk(g);
  visit(g, 'a02', [['answer', { sitdown: open, accept: true }]]);
  visit(g, 'a01', [['ask', { to: 'a03' }]]);
  const waiting = lastAsk(g);
  const last = 1 + DAYS() - 1;
  assert.deepEqual([sitdownIn(g, 'a01', open).until, sitdownIn(g, 'a02', open).until, sitdownIn(g, 'a03', waiting).until], [last, last, last], 'both ends see its last day');
  for (let day = 1; day <= last; day++) {
    assert.equal(g.s.day, day);
    visit(g, 'a01', [['say', { sitdown: open, say: 'offer', terms: { what: 'meet', where: DOCKS } }]]);
    if (day === last) visit(g, 'a03', [['answer', { sitdown: waiting, accept: true }]]);
    g.night();
  }
  assert.equal(g.s.day, last + 1);
  for (const [sd, pair] of [[open, ['a01', 'a02']], [waiting, ['a01', 'a03']]]) {
    for (const id of pair) assert.equal(sitdownIn(g, id, sd), null, `${sd} is gone from ${id}'s view`);
    const ended = g.events('close', e => e.sitdown === sd);
    assert.deepEqual(ended.map(e => [e.why, e.by, e.day, e.vis.to]), [['expired', null, last + 1, pair]], `${sd}: one expiry, at the dawn after its last day, to the two of them`);
  }
  const r = g.errand('a01', 'say', { sitdown: open, say: 'offer', terms: {} });
  assert.equal(r.ok, false, 'nothing more can be said in it');
  assert.equal(g.errand('a02', 'ask', { to: 'a01' }).ok, true, 'the pair can sit down again');
});

test('either side can close a sit-down, asked or open, with no message used; the other is told, nothing more is said in it, and the pair can ask again; a sit-down not yours is not yours to close (§14)', () => {
  const g = new Game({ n: 4 });
  visit(g, 'a01', [['ask', { to: 'a02' }]]);
  const sd = lastAsk(g);
  visit(g, 'a02', [['answer', { sitdown: sd, accept: true }]]);
  const left = g.view('a02').me.messagesLeft;
  assert.equal(g.errand('a03', 'close', { sitdown: sd }).ok, false, "a03 isn't in it");
  visit(g, 'a02', [['close', { sitdown: sd }]]);
  assert.equal(g.view('a02').me.messagesLeft, left, 'closing uses no message');
  const closed = g.events('close', e => e.sitdown === sd);
  assert.deepEqual(closed.map(e => [e.why, e.by, e.vis.to]), [['closed', 'a02', ['a01', 'a02']]], 'both are told who closed it');
  assert.equal(g.errand('a01', 'say', { sitdown: sd, say: 'offer', terms: {} }).ok, false, 'nothing more is said in it');
  assert.equal(sitdownIn(g, 'a01', sd), null);
  visit(g, 'a01', [['ask', { to: 'a02' }]]);
  assert.notEqual(lastAsk(g), sd, 'a new sit-down');
  // The asker can withdraw its ask, and the one asked can close it unanswered.
  visit(g, 'a03', [['ask', { to: 'a04' }]]);
  const withdrawn = lastAsk(g);
  visit(g, 'a03', [['close', { sitdown: withdrawn }]]);
  assert.equal(g.errand('a04', 'answer', { sitdown: withdrawn, accept: true }).ok, false, 'a withdrawn ask has nothing to answer');
  visit(g, 'a04', [['ask', { to: 'a03' }]]);
  visit(g, 'a03', [['close', { sitdown: lastAsk(g) }]]);
  assert.equal(g.events('close').length, 3);
});

test('a pair has one sit-down at a time: an ask while one is open is refused, not yet, on any day, until it closes (§14)', () => {
  const g = new Game({ n: 3 });
  visit(g, 'a01', [['ask', { to: 'a02' }]]);
  const sd = lastAsk(g);
  visit(g, 'a02', [['answer', { sitdown: sd, accept: true }]]);
  g.night();
  for (const [by, to] of [['a01', 'a02'], ['a02', 'a01']]) {
    const r = g.errand(by, 'ask', { to });
    const bad = r.events.find(e => e.type === 'invalid');
    assert.deepEqual([r.ok, bad && bad.kind], [false, 'not-yet'], `day 2: ${by} can't ask ${to} again`);
  }
  visit(g, 'a02', [['say', { sitdown: sd, say: 'offer', terms: { what: 'meet' } }]]);
  visit(g, 'a01', [['close', { sitdown: sd }]]);
  visit(g, 'a02', [['ask', { to: 'a01' }]]);
});

test("terms tied to a night expire at that night's lock: the view marks them, and a promise for last night's backing never rolls forward (§12, §14)", () => {
  const g = new Game({ n: 3 });
  visit(g, 'a01', [['ask', { to: 'a02' }]]);
  const sd = lastAsk(g);
  visit(g, 'a02', [
    ['answer', { sitdown: sd, accept: true }],
    ['say', { sitdown: sd, say: 'promise', terms: { what: 'back', who: 'a01', night: 1 } }],
    ['say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { chems: 2 }, cash: 2 * N.shopPrice.chems, night: 2 } }],
    ['say', { sitdown: sd, say: 'threat', terms: { what: 'hit', who: 'a03' } }],
  ]);
  const marks = () => sitdownIn(g, 'a01', sd).said.map(m => [m.say, !!m.expired]);
  assert.deepEqual(marks(), [['promise', false], ['offer', false], ['threat', false]], 'day 1: all standing');
  assert.equal(g.view('a01').me.promises.length, 1);
  g.night({ a01: { kind: 'hustle', place: DOCKS }, a02: { kind: 'hustle', place: DOCKS } });
  assert.deepEqual(marks(), [['promise', true], ['offer', false], ['threat', false]], "day 2: night 1's promise has expired, night 2's offer stands, and a threat with no night has nothing to expire");
  assert.deepEqual(g.view('a01').me.promises, [], "and night 1's promise is off the books");
  g.night({ a01: { kind: 'hustle', place: DOCKS }, a02: { kind: 'hit', target: 'a01', place: DOCKS } });
  assert.deepEqual(marks(), [['promise', true], ['offer', true], ['threat', false]], "day 3: night 2's offer has expired too");
  assert.equal(g.events('betray', e => e.kind === 'turn').length, 0, 'a hit on night 2 breaks no promise made for night 1');
  // Control: the same promise broken on its own night is a turn.
  const c = new Game({ n: 3 });
  visit(c, 'a01', [['ask', { to: 'a02' }]]);
  const csd = lastAsk(c);
  visit(c, 'a02', [['answer', { sitdown: csd, accept: true }], ['say', { sitdown: csd, say: 'promise', terms: { what: 'back', who: 'a01', night: 1 } }]]);
  c.night({ a01: { kind: 'hustle', place: DOCKS }, a02: { kind: 'hit', target: 'a01', place: DOCKS } });
  assert.equal(c.events('betray', e => e.kind === 'turn').length, 1, 'control: broken on its night, it is a turn');
  // Still open, the sit-down takes new terms for a night to come.
  visit(g, 'a02', [['say', { sitdown: sd, say: 'promise', terms: { what: 'back', who: 'a01', night: 3 } }]]);
  assert.equal(g.view('a01').me.promises.length, 1);
});

test('talk still binds nobody: a deal can be broken, and the hand-over and the pay need no sit-down, so one can be finished after its sit-down has closed (§10, §14)', () => {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'chems', 2);
  g.grant('a02', 3 * N.rent);
  visit(g, 'a01', [['ask', { to: 'a02' }]]);
  const sd = lastAsk(g);
  visit(g, 'a02', [['answer', { sitdown: sd, accept: true }], ['say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { chems: 2 }, cash: N.rent } }]]);
  g.night();
  visit(g, 'a01', [['say', { sitdown: sd, say: 'answer', terms: { what: 'trade', goods: { chems: 2 }, cash: N.rent } }], ['give', { to: 'a02', goods: { chems: 2 } }]]);
  visit(g, 'a02', [['close', { sitdown: sd }]]);
  g.night();
  assert.equal(g.events('pay').length, 0, 'the buyer walked: nothing made it pay');
  visit(g, 'a02', [['pay', { to: 'a01', amount: N.rent, for: 'debt' }]]);
  assert.equal(g.events('pay', e => e.from === 'a02' && e.amount === N.rent).length, 1, 'and it can still pay later, with no sit-down');
});

test("§19 unchanged: who meets whom is public at once, on each day both of them act in the sit-down; the words, a close and an expiry are theirs now and everyone's 24 hours later", () => {
  const g = new Game({ n: 3 });
  const meets = (who, sd) => g.view(who).events.filter(e => e.type === 'meet' && e.sitdown === sd).map(e => e.day);
  visit(g, 'a01', [['ask', { to: 'a02' }]]);
  const sd = lastAsk(g);
  visit(g, 'a02', [['answer', { sitdown: sd, accept: true }], ['say', { sitdown: sd, say: 'offer', terms: {}, line: 'DAY1-WORDS' }]]);
  assert.deepEqual(meets('a03', sd), [1], 'day 1: the meeting is public at once, once');
  g.night();
  assert.deepEqual(meets('a03', sd), [1], 'day 2: nobody has talked yet, so no meeting today');
  visit(g, 'a01', [['say', { sitdown: sd, say: 'offer', terms: {}, line: 'DAY2-WORDS' }]]);
  assert.deepEqual(meets('a03', sd), [1], 'day 2: one side alone makes no meeting');
  visit(g, 'a02', [['say', { sitdown: sd, say: 'answer', terms: {} }]]);
  assert.deepEqual(meets('a03', sd), [1, 2], 'day 2: both have talked, and that is public at once');
  visit(g, 'a01', [['say', { sitdown: sd, say: 'offer', terms: {} }]]);
  assert.deepEqual(meets('a03', sd), [1, 2], 'one meeting a day');
  const words = () => JSON.stringify(g.view('a03'));
  assert.ok(words().includes('DAY1-WORDS'), "day 2: day 1's words are everyone's");
  assert.ok(!words().includes('DAY2-WORDS'), "day 2: today's words are still the pair's");
  visit(g, 'a01', [['close', { sitdown: sd }]]);
  const close = g.events('close', e => e.sitdown === sd)[0];
  assert.deepEqual([close.vis.to, close.vis.pub], [['a01', 'a02'], g.s.clock + 2], "the close: the pair's now, everyone's 24 hours later");
  assert.ok(!g.view('a03').events.some(e => e.type === 'close'), 'a03 has not seen it today');
  g.night();
  assert.ok(words().includes('DAY2-WORDS') && g.view('a03').events.some(e => e.type === 'close'), 'day 3: the words and the close are everyone\'s');
});

test("the earpiece hears a sit-down for the day it listens, live, and none of it after dawn; it can listen again the next day (§4)", () => {
  const g = new Game({ n: 3 });
  g.hand('a03', abilityCopy(g.s, 'earpiece'), { wear: true });
  visit(g, 'a01', [['ask', { to: 'a02' }]]);
  const sd = lastAsk(g);
  visit(g, 'a02', [['answer', { sitdown: sd, accept: true }], ['say', { sitdown: sd, say: 'offer', terms: {}, line: 'BEFORE' }]]);
  visit(g, 'a03', [['listen', { sitdown: sd }]]);
  visit(g, 'a01', [['say', { sitdown: sd, say: 'answer', terms: {}, line: 'LIVE' }]]);
  assert.ok(g.events('say').at(-1).vis.to.includes('a03'), 'day 1: it hears what is said next, live');
  g.night();
  visit(g, 'a02', [['say', { sitdown: sd, say: 'offer', terms: {}, line: 'DAY2' }]]);
  assert.ok(!g.events('say').at(-1).vis.to.includes('a03'), "day 2: yesterday's listen hears nothing");
  visit(g, 'a03', [['listen', { sitdown: sd }]]);
  assert.ok(g.events('overheard').at(-1).said.some(m => m.line === 'DAY2'), 'listening again, it hears the sit-down so far');
});

test("CLEAR forgets the words said before the take today, never the sit-down's older words, which are everyone's by then (§11)", () => {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'clear');
  visit(g, 'a01', [['ask', { to: 'a02' }]]);
  const sd = lastAsk(g);
  visit(g, 'a02', [['answer', { sitdown: sd, accept: true }], ['say', { sitdown: sd, say: 'offer', terms: {}, line: 'OLD-WORDS' }]]);
  g.night();
  visit(g, 'a02', [['say', { sitdown: sd, say: 'offer', terms: {}, line: 'TODAY-BEFORE' }]]);
  visit(g, 'a01', [['take', { drug: 'clear' }]]);
  visit(g, 'a02', [['say', { sitdown: sd, say: 'offer', terms: {}, line: 'TODAY-AFTER' }]]);
  const lines = sitdownIn(g, 'a01', sd).said.map(m => m.line);
  assert.deepEqual(lines, ['OLD-WORDS', 'TODAY-AFTER']);
  assert.ok(sitdownIn(g, 'a02', sd).said.some(m => m.line === 'TODAY-BEFORE'), 'control: the other side still has them');
});

test("§19 unchanged: a sit-down that lasts shows a partner TRUTH's verified play and a hoodie's fit only on a day the two sit down in it, as a new one did: the ask accepted, or both speaking in it that day (§4, §11, §19)", () => {
  const g = new Game({ n: 3 });
  const hood = abilityCopy(g.s, 'hoodie');
  g.hand('a01', hood, { wear: true });
  stock(g, 'a01', 'truth');
  visit(g, 'a02', [['ask', { to: 'a01' }]]);
  const sd = lastAsk(g);
  const fit = () => g.view('a02').board.agents.find(a => a.id === 'a01').fit;
  assert.equal(fit(), null, 'asked, not sat down: the hoodie hides the fit');
  visit(g, 'a01', [['answer', { sitdown: sd, accept: true }]]);
  assert.ok(fit() && fit().some(p => p.copy === hood), 'day 1: sat down, a02 sees past the hoodie');
  g.night();
  const play = { kind: 'hustle', place: DOCKS };
  visit(g, 'a01', [['take', { drug: 'truth', play }]]);
  const shown = () => sitdownIn(g, 'a02', sd).verified;
  assert.deepEqual([fit(), shown()], [null, undefined], "day 2: the sit-down is open, but they haven't sat down today: neither shows");
  visit(g, 'a02', [['say', { sitdown: sd, say: 'offer', terms: {} }]]);
  assert.deepEqual([fit(), shown()], [null, undefined], 'day 2: a02 speaks in it, but one side alone is no sit-down: neither shows');
  visit(g, 'a01', [['say', { sitdown: sd, say: 'answer', terms: {} }]]);
  assert.ok(fit() && fit().some(p => p.copy === hood), 'day 2: a01 speaks too, so they sit down today, and the fit shows');
  assert.deepEqual(shown(), play, "and so does a01's play, verified");
  assert.equal(g.view('a03').board.agents.find(a => a.id === 'a01').fit, null, 'control: a03 never sat down with a01');
});
