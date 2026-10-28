// R9 review fix 5 (the orchestrator, 10-19): briefingPacket's `reserve`, characters a caller appends after the briefing
// (lane R9-journal's dawn task line, about 370), comes off the budget before any cut: the briefing plus the appended
// line stays inside gap.briefing. With no reserve, or 0, the bytes are as before. Nothing here calls a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { viewFor } from '../rules/view.mjs';
import { read } from '../agents/tools.mjs';
import { starterBriefingPacket, briefingPacket } from '../agents/briefing.mjs';

const size = p => p.messages.reduce((t, m) => t + m.content.length, 0);

test('a reserve keeps the briefing and an appended line inside the budget; none, or 0, changes nothing', () => {
  const g = new Game({ n: 30 });
  for (let i = 0; i < 6; i++) {
    for (let k = 2; k <= 30; k++) g.errand(`a${String(k).padStart(2, '0')}`, 'outloud', { say: 'boast', line: `${k} `.repeat(N['gap.lineLength'] / 3) });
    g.night();
  }
  for (const id of ['a02', 'a03', 'a04', 'a05']) {
    g.errand(id, 'ask', { to: 'a01', line: 'x'.repeat(N['gap.lineLength']) });
    g.errand('a01', 'answer', { sitdown: g.events('ask').at(-1).sitdown, accept: true, line: 'y'.repeat(N['gap.lineLength']) });
  }
  const r = read(viewFor(g.s, g.log, 'a01', 'agent'), { audience: 'seat', seed: 'r9-reserve' }).result;
  const opts = { call: 'round', reply: 'tools' };
  const plain = starterBriefingPacket(r, opts);
  assert.deepEqual(starterBriefingPacket(r, { ...opts, reserve: 0 }).messages, plain.messages, 'reserve 0: the same bytes');
  assert.ok(size(plain) > N['gap.briefing'].chars - 370, `control: the briefing fills the budget (${size(plain)})`);
  const line = 'z'.repeat(370);
  const kept = starterBriefingPacket(r, { ...opts, reserve: line.length });
  assert.ok(size(kept) + line.length <= N['gap.briefing'].chars, `${size(kept)} + ${line.length}`);
  assert.ok(size(kept) < size(plain));
  for (const bad of [-1, 1.5, '370']) assert.throws(() => briefingPacket(r, { reserve: bad }), /reserve/);
});
