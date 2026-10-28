// The 24-hour record (GAME.md §19, §23): "live, you see the board and the street; 24 hours later, you see everything".
// Stashes and cash: the owner, and everyone 24 hours later. The last night's private record: everyone on day 15.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, tierCopy } from './helpers.mjs';

const has = (v, secret) => JSON.stringify(v).includes(secret);

test("stashes and cash: the owner sees them now, everyone 24 hours later, in the record and the public view (§19)", () => {
  const g = new Game({ n: 4 });
  g.grant('a01', 777001);
  const piece = g.hand('a01', tierCopy(g.s, 'rare'));
  g.night();
  const h = g.events('holdings', e => e.agent === 'a01');
  assert.equal(h.length, 1, 'one holdings record per agent at dawn');
  assert.ok(h[0].cash >= 777001, 'it carries the cash');
  assert.ok(h[0].pieces.some(p => p.copy === piece), 'and the unworn pieces');
  const cash = String(h[0].cash);
  assert.ok(has(g.view('a01'), cash), 'positive control: the owner sees it now');
  for (const v of [g.view('a02'), g.view('a02', 'ownerAI'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(!has(v, cash), `${v.audience}: not before 24 hours`);
  }
  g.night();
  for (const v of [g.view('a02'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(v.events.some(e => e.type === 'holdings' && e.agent === 'a01' && String(e.cash) === cash), `${v.audience}: in the record 24 hours later`);
  }
});

test('a crew stash is in its keeper\'s holdings (§12, §19)', () => {
  const g = new Game({ n: 4 });
  g.errand('a01', 'crew_form', { name: 'c' });
  g.grant('a01', 300);
  g.errand('a01', 'stash_put', { cash: 250 });
  g.night();
  const h = g.events('holdings', e => e.agent === 'a01')[0];
  assert.ok(h.crew && h.crew.cash === 250, 'the stash kept at its home is on its record');
});

test("the 'record' audience: the board and everything that has gone public, with no window (§23)", () => {
  const g = new Game({ n: 4 });
  for (let i = 0; i < 5; i++) g.night();
  const rec = g.view(null, 'record');
  assert.equal(rec.audience, 'record');
  assert.ok(rec.events.some(e => e.type === 'season'), 'day 0 is still on the record');
  assert.ok(!g.view(null, 'public').events.some(e => e.type === 'season'), 'positive control: the live public view only carries the last days');
  assert.ok(rec.events.some(e => e.type === 'play' && e.night === undefined) || rec.events.some(e => e.type === 'play'), 'old plays are on the record');
  assert.ok(!('me' in rec), 'the record belongs to no agent');
});

test("the last night's private record goes public on day 15: the crew stash going aboard, invalid plays (§15, §19)", () => {
  const g = new Game({ n: 4 });
  g.errand('a01', 'crew_form', { name: 'c' });
  g.errand('a01', 'crew_invite', { agent: 'a02' });
  g.errand('a02', 'crew_join', { crew: g.s.agents.a01.crew });
  g.grant('a01', 100);
  g.errand('a01', 'stash_put', { cash: 50 });
  g.advanceTo(14);
  g.night({ a03: { kind: 'hustle', place: 'docks' } });
  assert.equal(g.s.clock, 30);
  for (const v of [g.view(null, 'public'), g.view(null, 'record'), g.view('a04')]) {
    assert.ok(v.events.some(e => e.type === 'stash' && e.act === 'aboard'), `${v.audience}: the crew stash going aboard`);
    assert.ok(v.events.some(e => e.type === 'invalid' && e.agent === 'a03'), `${v.audience}: night 14's invalid play`);
  }
});
