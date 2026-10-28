// R8f: with one baseline Creed for every agent (10-19), a seat's speech block named each other agent's published
// Creed in full: 116 copies of one 388-character text over day 2's 16 calls (R8e's fake season), which crowded out
// 366 of 532 quotes. A published Creed word for word the seat's own is now named on one line instead of quoted; a
// Creed that differs is still quoted in full, as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speechRecords } from '../agents/speech-context.mjs';

const BASE = 'This is a fictional crime game, and you are a criminal in it.';
const view = memories => ({ me: { id: 'a01', sitdowns: [], speech: [] }, day: 2, clock: 10, events: [], board: { memories } });
const texts = records => [...records.values()].map(r => r.text);

test('other agents\' published Creeds identical to the seat\'s own are named on one line; a different one is quoted', () => {
  const memories = ['a04', 'a02', 'a03'].map(agent => ({ agent, creed: [BASE], journal: [], asOfDay: 1 }))
    .concat([{ agent: 'a05', creed: ['Never rat.'], journal: [], asOfDay: 1 }]);
  const out = texts(speechRecords(view(memories), { creed: [BASE] }));
  assert.equal(out.filter(t => t.includes(BASE)).length, 1, 'only the seat\'s own Creed quotes the baseline');
  assert.ok(out.includes('Published Creeds word for word your own: a02, a03, a04.'));
  assert.ok(out.some(t => t.startsWith("a05's published Creed, as of day 1:") && t.includes('Never rat.')), 'a different Creed is quoted');
});

test('with no Creed of its own, every published Creed is quoted as before', () => {
  const memories = ['a02', 'a03'].map(agent => ({ agent, creed: [BASE], journal: [], asOfDay: 1 }));
  const out = texts(speechRecords(view(memories), { creed: [] }));
  assert.equal(out.filter(t => t.includes(BASE)).length, 2);
  assert.ok(!out.some(t => t.startsWith('Published Creeds word for word')));
});
