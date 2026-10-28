// Free text (GAME.md §18, §23): only `line` and `reason` carry words an agent wrote, and an owner's AI never gets
// those. Every other field an agent fills is typed (an id, a place, a number, an enum), so a canary planted in it must
// never show up in any view: not another agent's, not the public's, not the record, not any owner's AI, live or 24 hours
// later. Each check has a positive control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, tierCopy } from './helpers.mjs';

const has = (v, secret) => JSON.stringify(v).includes(secret);
const everyView = g => [
  ...Object.keys(g.s.agents).sort().map(id => g.view(id, 'agent')),
  ...Object.keys(g.s.agents).sort().map(id => g.view(id, 'ownerAI')),
  g.view(null, 'public'),
  g.view(null, 'record'),
];
function nowhere(g, canaries, when) {
  for (const v of everyView(g)) {
    for (const c of canaries) assert.ok(!has(v, c), `${when}: ${c} shows up in a ${v.audience} view${v.me ? ` (${v.me.id})` : ''}`);
  }
}

test("a crew's name is free text: agents and the public see it, no owner's AI ever does (§12, §18)", () => {
  const g = new Game({ n: 4 });
  g.errand('a01', 'crew_form', { name: 'CANARY-CREW-NAME' });
  assert.ok(has(g.view(null, 'public').board.crews, 'CANARY-CREW-NAME'), 'positive control: the public board shows it');
  assert.ok(has(g.view('a02'), 'CANARY-CREW-NAME'), 'positive control: another agent sees it');
  const check = when => {
    for (const id of ['a01', 'a02', 'a03', 'a04']) assert.ok(!has(g.view(id, 'ownerAI'), 'CANARY-CREW-NAME'), `${when}: ${id}'s owner's AI`);
    assert.ok(g.view('a01', 'ownerAI').board.crews.some(c => c.members.includes('a01')), `${when}: positive control: the owner's AI still sees the crew, by id`);
  };
  check('live');
  g.night();
  g.night();
  check('two days later');
});

test("an errand's other inputs never reach any view: pay's label, a sit-down's place, unknown errands, bad copy ids (§18, §23)", () => {
  const g = new Game({ n: 4 });
  g.grant('a01', 500);
  const mine = g.hand('a01', tierCopy(g.s, 'rare'));
  g.errand('a01', 'pay', { to: 'a02', amount: 10, for: 'CANARY-FOR' });
  g.errand('a01', 'ask', { to: 'a02' });
  const sd = Object.keys(g.s.sitdowns)[0];
  g.errand('a02', 'answer', { sitdown: sd, accept: true });
  g.errand('a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'meet', where: 'CANARY-WHERE' } });
  g.errand('a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'meet', where: 'strip' } });
  g.errand('a01', 'CANARY-ERRAND');
  g.errand('a01', 'dress', { fit: { hat: 'CANARY-COPY-1' } });
  g.errand('a01', 'dress', { fit: { 'CANARY-SLOT': mine } });
  g.errand('a01', 'give', { to: 'a02', copy: 'CANARY-COPY-2' });
  g.errand('a01', 'crew_form', { name: 'plain' });
  g.errand('a01', 'stash_take', { copy: 'CANARY-COPY-3' });
  g.errand('a01', 'stash_put', { copy: 'CANARY-COPY-4' });

  // Positive controls: the payment and the valid place went through; the bad errands are on the owner's record.
  assert.equal(g.s.agents.a02.cash, 10, 'the payment happened');
  assert.ok(g.view('a02').events.some(e => e.type === 'say' && e.terms.where === 'strip'), 'a valid place is kept');
  const bad = g.view('a01').events.filter(e => e.type === 'invalid');
  assert.ok(bad.length >= 6, `the bad errands are typed and logged (${bad.length})`);
  assert.ok(bad.some(e => e.errand === 'unknown'), 'an unknown errand is logged as unknown');

  const canaries = ['CANARY-FOR', 'CANARY-WHERE', 'CANARY-ERRAND', 'CANARY-COPY-1', 'CANARY-SLOT', 'CANARY-COPY-2', 'CANARY-COPY-3', 'CANARY-COPY-4'];
  nowhere(g, canaries, 'live');
  g.night();
  g.night();
  nowhere(g, canaries, 'two days later');
});

test("a play's inputs: an unknown want, an unknown kind and extra fields never reach any view (§18, §23, §27)", () => {
  const g = new Game({ n: 4 });
  g.night({
    a01: { kind: 'hit', target: 'a02', place: 'docks', want: 'CANARY-WANT', reason: 'r' },
    a03: { kind: 'CANARY-KIND', note: 'CANARY-NOTE', place: 'CANARY-PLACE', target: 'CANARY-TARGET', want: 'CANARY-WANT-2' },
  });
  const inv = g.events('invalid', e => e.agent === 'a03');
  assert.equal(inv.length, 1, 'positive control: the bad play is typed and logged');
  assert.equal(inv[0].play.kind, 'unknown');
  assert.ok(g.events('play', e => e.agent === 'a01' && e.kind === 'hit').length === 1, 'positive control: the hit went in');
  const canaries = ['CANARY-WANT', 'CANARY-KIND', 'CANARY-NOTE', 'CANARY-PLACE', 'CANARY-TARGET'];
  nowhere(g, canaries, 'the morning after');
  g.night();
  g.night();
  nowhere(g, canaries, 'two days later');

  // A want that names a real piece is a typed fact, and it's kept.
  const g2 = new Game({ n: 4 });
  const piece = g2.hand('a02', tierCopy(g2.s, 'rare'), { wear: true });
  g2.night({ a01: { kind: 'hit', target: 'a02', place: 'docks', want: piece } });
  assert.equal(g2.events('play', e => e.agent === 'a01')[0].want, piece, 'positive control: a valid want stays on the record');
});
