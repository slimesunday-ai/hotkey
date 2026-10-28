// View canaries (GAME.md §23, §26): plant secret values and fail if one shows up where §19 says it shouldn't. Every
// check has a positive control, so a view that shows nothing can't pass.
// §19: live, you see the board and the street; 24 hours later, you see everything. §18: an owner's own AI gets typed
// facts only. Time on the record is in half-days (day d = 2d, its night = 2d+1); "24 hours later" is +2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy, tierCopy } from './helpers.mjs';
import { viewFor } from '../rules/view.mjs';
import { DAY15 } from '../rules/state.mjs';

const has = (v, secret) => JSON.stringify(v).includes(secret);

test('stash cash and unworn pieces: the owner sees them, nobody else does (§19)', () => {
  const g = new Game({ n: 4 });
  g.grant('a01', 777123);
  const secretCopy = g.hand('a01', tierCopy(g.s, 'rare'));
  assert.ok(has(g.view('a01'), '777123'), 'positive control: the owner sees its cash');
  assert.ok(has(g.view('a01'), secretCopy), 'positive control: the owner sees its unworn piece');
  assert.ok(has(g.view('a01', 'ownerAI'), '777123'), 'the owner\'s own AI sees the owner\'s typed facts');
  for (const v of [g.view('a02'), g.view('a03', 'ownerAI'), g.view(null, 'public')]) {
    assert.ok(!has(v, '777123'), `${v.audience}: no stash cash`);
    assert.ok(!has(v, secretCopy), `${v.audience}: no unworn piece`);
  }
  // Worn, it's on the board for everyone (§19: fits on the board, live).
  g.errand('a01', 'dress', { fit: { [g.s.copies[secretCopy].slot]: secretCopy } });
  assert.ok(has(g.view('a02'), secretCopy), 'a worn piece shows on the board');
  assert.ok(has(g.view(null, 'public'), secretCopy));
  assert.ok(!has(g.view('a02'), '777123'), 'the cash still doesn\'t');
});

test('sit-down words: the two agents live, everyone 24 hours later, an owner\'s AI never (§14, §18, §19)', () => {
  const g = new Game({ n: 4 });
  g.errand('a01', 'ask', { to: 'a02', line: 'CANARY-ASK-LINE' });
  const sd = Object.keys(g.s.sitdowns)[0];
  g.errand('a02', 'answer', { sitdown: sd, accept: true });
  g.errand('a01', 'say', { sitdown: sd, say: 'promise', terms: { what: 'pay', who: 'a02', cash: 5, night: 1 }, line: 'CANARY-SAY-LINE' });
  for (const who of ['a01', 'a02']) {
    assert.ok(has(g.view(who), 'CANARY-SAY-LINE'), `${who} reads the words live`);
    assert.ok(has(g.view(who), 'CANARY-ASK-LINE'));
  }
  assert.ok(g.view(null, 'public').events.some(e => e.type === 'meet' && e.a === 'a01' && e.b === 'a02'), 'positive control: who meets whom is public at once');
  for (const v of [g.view('a03'), g.view(null, 'public'), g.view('a01', 'ownerAI'), g.view('a02', 'ownerAI')]) {
    assert.ok(!has(v, 'CANARY-SAY-LINE') && !has(v, 'CANARY-ASK-LINE'), `${v.audience}: no words`);
  }
  const typed = g.view('a01', 'ownerAI');
  assert.ok(typed.events.some(e => e.type === 'say' && e.terms.what === 'pay' && e.terms.cash === 5), 'positive control: the owner\'s AI gets the typed terms');
  assert.ok(typed.me.sitdowns[0].said.length === 1 && !('line' in typed.me.sitdowns[0].said[0]), 'and the sit-down without its line');
  g.night();
  assert.equal(g.s.clock, 4);
  assert.ok(has(g.view('a03'), 'CANARY-SAY-LINE'), 'day 1 words are public on day 2');
  assert.ok(has(g.view(null, 'public'), 'CANARY-SAY-LINE'));
  assert.ok(!has(g.view('a03', 'ownerAI'), 'CANARY-SAY-LINE'), 'never in an owner\'s AI');
  assert.ok(!has(g.view('a01', 'ownerAI'), 'CANARY-SAY-LINE'));
});

test('tonight\'s play and its reason: the owner now, everyone in the 24-hour record; the show only tells places, attackers hooded (§19, §20)', () => {
  const g = new Game({ n: 4 });
  g.hand('a04', abilityCopy(g.s, 'knuckles'), { wear: true });
  g.hand('a02', tierCopy(g.s, 'common'), { wear: true });
  g.night({
    a01: { kind: 'hustle', place: 'industrial', reason: 'CANARY-REASON-N1' },
    a02: { kind: 'hustle', place: 'docks' },
    a03: { kind: 'hustle', place: 'docks' },
    a04: { kind: 'hit', target: 'a02', place: 'docks', reason: 'CANARY-HIT-REASON' },
  });
  assert.equal(g.s.day, 2);
  assert.ok(has(g.view('a01'), 'CANARY-REASON-N1'), 'positive control: the owner sees its play and reason');
  for (const v of [g.view('a02'), g.view(null, 'public'), g.view('a01', 'ownerAI')]) {
    assert.ok(!has(v, 'CANARY-REASON-N1'), `${v.audience}: no reason yet`);
    assert.ok(!has(v, 'CANARY-HIT-REASON'), `${v.audience}: no hit reason`);
  }
  const pub = g.view(null, 'public');
  const show = pub.events.find(e => e.type === 'show');
  assert.equal(show.seen.a01, 'industrial', 'the show makes the place public');
  assert.ok(!('a04' in show.seen), 'the attacker is hooded');
  assert.equal(show.hooded.docks, 1);
  const fight = pub.events.find(e => e.type === 'fight');
  assert.ok(fight && fight.target === 'a02' && fight.won, 'positive control: the fight is public');
  assert.ok(!JSON.stringify(fight).includes('a04'), 'the public fight never names the hooded attacker');
  assert.ok(!pub.events.some(e => e.type === 'rob' || e.type === 'robbed'), 'who robbed whom isn\'t public yet');
  assert.ok(!g.view('a03').events.some(e => e.type === 'rob' || e.type === 'robbed'), 'nor to a bystander');
  assert.ok(g.view('a02').events.some(e => e.type === 'robbed' && e.by === 'a04'), 'the victim learns who at dawn');
  assert.ok(g.view('a01', 'ownerAI').events.some(e => e.type === 'play' && e.kind === 'hustle' && e.place === 'industrial'), 'positive control: the owner\'s AI gets the typed play');
  g.night();
  assert.equal(g.s.day, 3);
  assert.ok(has(g.view(null, 'public'), 'CANARY-REASON-N1'), 'night 1\'s record is public from day 3');
  assert.ok(g.view('a03').events.some(e => e.type === 'rob' && e.leader === 'a04'), 'the 24-hour record names the robber');
  assert.ok(!has(g.view('a03', 'ownerAI'), 'CANARY-REASON-N1'), 'an owner\'s AI never gets the free text');
});

test('the last night\'s private record goes public on day 15, not before (§19)', () => {
  const g = new Game({ n: 3 });
  g.advanceTo(14);
  g.night({ a01: { kind: 'board', place: 'downtown', reason: 'CANARY-LAST-REASON' } });
  assert.equal(g.s.clock, DAY15);
  const night14 = g.log.filter(e => e.t === 2 * 14 + 1 && e.vis.to !== 'all');
  assert.ok(night14.length > 0);
  assert.ok(night14.every(e => e.vis.pub === DAY15), 'every private night-14 event waits for day 15');
  const night13 = g.log.filter(e => e.type === 'play' && e.t === 2 * 13 + 1);
  assert.ok(night13.every(e => e.vis.pub === 2 * 13 + 1 + 2), 'an ordinary night waits 24 hours');
  const before = structuredClone(g.s);
  before.clock = DAY15 - 1;
  assert.ok(!has(viewFor(before, g.log, 'a02'), 'CANARY-LAST-REASON'), 'not before day 15');
  assert.ok(has(viewFor(g.s, g.log, 'a02'), 'CANARY-LAST-REASON'), 'on day 15');
  assert.ok(has(viewFor(before, g.log, 'a01'), 'CANARY-LAST-REASON'), 'positive control: the owner always');
});

test('a hoodie hides the fit from the board, except to agents it sat down with today (§4 placeholder)', () => {
  const g = new Game({ n: 4 });
  g.hand('a04', abilityCopy(g.s, 'hoodie'), { wear: true });
  const shown = g.hand('a04', tierCopy(g.s, 'rare', t => t.slot !== 'top'), { wear: true });
  g.hand('a02', tierCopy(g.s, 'common', t => t.slot !== 'top'), { wear: true });
  const fitOf = (v, id) => v.board.agents.find(a => a.id === id);
  assert.equal(fitOf(g.view('a03'), 'a04').fit, null);
  assert.equal(fitOf(g.view('a03'), 'a04').fitHidden, true);
  assert.ok(!has(g.view('a03'), shown));
  assert.ok(!has(g.view(null, 'public'), shown));
  assert.ok(fitOf(g.view('a04'), 'a04').fit.some(p => p.copy === shown), 'its own view shows its fit');
  assert.ok(fitOf(g.view('a03'), 'a02').fit.length === 1, 'positive control: a fit without a hoodie shows');
  g.errand('a03', 'ask', { to: 'a04' });
  g.errand('a04', 'answer', { sitdown: Object.keys(g.s.sitdowns)[0], accept: true });
  assert.ok(fitOf(g.view('a03'), 'a04').fit.some(p => p.copy === shown), 'sat down together: the fit shows');
  assert.equal(fitOf(g.view('a02'), 'a04').fit, null, 'still hidden from everyone else');
});

test('the earpiece reads one sit-down between other agents live, once a day (§4 placeholder)', () => {
  const g = new Game({ n: 4 });
  g.hand('a03', abilityCopy(g.s, 'earpiece'), { wear: true });
  g.errand('a01', 'ask', { to: 'a02' });
  const sd = Object.keys(g.s.sitdowns)[0];
  g.errand('a02', 'answer', { sitdown: sd, accept: true });
  g.errand('a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', cash: 100 }, line: 'CANARY-EAR-1' });
  assert.ok(!has(g.view('a03'), 'CANARY-EAR-1'), 'not before listening');
  assert.equal(g.errand('a04', 'listen', { sitdown: sd }).ok, false, 'no earpiece, no listening');
  assert.equal(g.errand('a03', 'listen', { sitdown: sd }).ok, true);
  assert.ok(has(g.view('a03'), 'CANARY-EAR-1'), 'what was said so far');
  g.errand('a02', 'say', { sitdown: sd, say: 'answer', terms: { what: 'trade' }, line: 'CANARY-EAR-2' });
  assert.ok(has(g.view('a03'), 'CANARY-EAR-2'), 'and what is said next, live');
  assert.ok(!has(g.view('a04'), 'CANARY-EAR-1') && !has(g.view('a04'), 'CANARY-EAR-2'), 'nobody else');
  assert.ok(!has(g.view('a03', 'ownerAI'), 'CANARY-EAR-1'), 'the listener\'s own AI still gets no words');
  const again = g.errand('a03', 'listen', { sitdown: sd });
  assert.equal(again.ok, false);
  assert.equal(again.why, 'once a day');
});

test('hand-overs and offers are private for 24 hours (§19: tips, bribes, hand-overs; stashes and cash)', () => {
  const g = new Game({ n: 3 });
  g.grant('a01', 5000);
  g.errand('a01', 'give', { to: 'a02', cash: 4242 });
  const c = Object.values(g.s.traits).find(t => t.tier === 'common');
  g.errand('a01', 'offer', { trait: c.id, amount: 313 });
  assert.ok(has(g.view('a02'), '4242'), 'positive control: the receiver sees it');
  assert.ok(has(g.view('a01'), '313'), 'positive control: the buyer sees its offer');
  for (const v of [g.view('a03'), g.view(null, 'public')]) {
    assert.ok(!v.events.some(e => e.type === 'give' || e.type === 'bid'), `${v.audience}: no hand-over or offer yet`);
  }
  g.night();
  const later = g.view('a03');
  assert.ok(later.events.some(e => e.type === 'give' && e.cash === 4242), 'the 24-hour record');
  assert.ok(later.events.some(e => e.type === 'bid' && e.amount === 313));
});
