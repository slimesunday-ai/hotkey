// R9 review fix 4 (the orchestrator, 10-19): a change to the seat's own game-held memory reads, in "Since last night",
// as a short sentence by its part, never as a raw object: the Creed says nothing there (its words are quoted in the
// speech block); a plan, standing orders and a note say what the seat did; CLEAR says what it erased; and the dawn
// journal's entry (part 'dawn', lane R9-journal) says it is stored, with its day. Nothing here calls a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { viewFor } from '../rules/view.mjs';
import { read } from '../agents/tools.mjs';
import { starterBriefing } from '../agents/briefing.mjs';
import { applyErrand } from '../rules/errand.mjs';

const since = g => starterBriefing(read(viewFor(g.s, g.log, 'a01', 'agent'), { audience: 'seat', seed: 'r9-memory' }).result, { call: 'round', reply: 'tools' })[1]
  .content.split('\n').find(l => l.startsWith('Since last night:')) || '';

test('memory events read as short sentences by part; the Creed adds nothing; no raw object', () => {
  const g = new Game({ n: 3 });
  const r = applyErrand(g.s, { by: 'a01', kind: 'creed', text: 'the owner\'s words' }, { source: 'owner' });
  assert.equal(r.ok, true, r.why);
  g.s = r.state;
  g.log.push(...r.events);
  assert.equal(since(g), '', 'the Creed alone: nothing since last night');
  g.errand('a01', 'note', { line: 'a dated note' });
  g.errand('a01', 'plan', { traits: [] });
  g.errand('a01', 'orders', { orders: [] });
  const line = since(g);
  for (const want of ['you wrote in your journal', 'you updated your plan', 'you updated your standing orders']) assert.ok(line.includes(want), `${want}: ${line}`);
  assert.doesNotMatch(line, /memory: |part |agent a01/, line);
  // The dawn journal's entry, as lane R9-journal records it: a memory event of part 'dawn', its entry's day its own.
  const at = g.log.at(-1);
  g.log.push({ n: at.n + 1, t: at.t, day: at.day, type: 'memory', agent: 'a01', part: 'dawn',
    memory: { creed: [], plan: [], orders: [], journal: [{ day: 1, line: 'what happened' }] }, vis: { to: ['a01'], pub: at.t + 2 } });
  assert.ok(since(g).includes('your journal entry for day 1 is stored'), since(g));
});
