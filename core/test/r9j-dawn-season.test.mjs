// R9b, the dawn journal, on whole seasons ($0, the runner's in-process fake): with --journal dawn every model seat gets
// one dawn call a day on days 2-14, its ordinary briefing for the day with the same system text and the task line
// below it; the reply's text is stored as a dated journal note through the core's memory path, and every later call
// shows the newest entries. Without the flag nothing about the season changes. Nothing here calls a model.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readTape } from '../agents/fake-model.mjs';
import { N } from '../numbers.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r9j-season-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const text = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const checkpoint = dir => JSON.parse(text(dir, 'checkpoint.json'));
const events = dir => text(dir, 'events.jsonl').split('\n').filter(Boolean).map(l => JSON.parse(l));
const DAYS = Array.from({ length: N.nights - 1 }, (_, i) => i + 2);

// Each tape line with the day and round its seat's record gives its call.
function calls(dir) {
  const ck = checkpoint(dir);
  const at = {};
  for (const [id, x] of Object.entries(ck.models.seats)) for (const r of x.record) for (const a of r.attempts) if (a.call !== null) at[`${id}#${a.call}`] = { day: r.day, round: r.round };
  return [...readTape(text(dir, 'tape.jsonl')).values()].map(l => ({ ...l, ...at[`${l.seat}#${l.call}`] })).sort((a, b) => (a.seat === b.seat ? a.call - b.call : a.seat < b.seat ? -1 : 1));
}
const userText = l => l.request.messages.filter(m => m.role === 'user').map(m => m.content).join('\n');

let on, off, journal, quotedWords, fakeEntry, toolDefinitions;
before(async () => {
  const { runModelSeason } = await import('../bench/runner.mjs');
  const { CASTS } = await import('../bench/bots.mjs');
  journal = await import('../agents/journal.mjs');
  ({ quotedWords } = await import('../agents/speech-context.mjs'));
  ({ fakeEntry } = await import('../agents/fake-hooks.mjs'));
  ({ toolDefinitions } = await import('../agents/tool-calls.mjs'));
  const base = { seed: 418, rule: 'A', mix: { ...CASTS['models-canny'], models: 8 }, briefing: 'starter', reply: 'tools' };
  on = await runModelSeason({ ...base, journal: 'dawn', outDir: path.join(tmp, 'on') });
  off = await runModelSeason({ ...base, outDir: path.join(tmp, 'off') });
});

test('--journal dawn: every model seat gets one dawn call a day on days 2-14, none on day 1 and none after the ferry; 13 extra calls a seat', () => {
  const ck = checkpoint(on.dir);
  const seats = Object.keys(ck.models.seats).sort();
  assert.equal(seats.length, 8);
  for (const id of seats) {
    const dawn = ck.models.seats[id].record.filter(r => r.round === 'dawn');
    assert.deepEqual(dawn.map(r => r.day), DAYS, `${id}: a dawn a day, days 2-14`);
    for (const r of dawn) {
      assert.equal(r.attempts.length, 1, `${id} day ${r.day}: one request, no retry`);
      assert.ok(Number.isInteger(r.attempts[0].call));
      assert.equal(r.attempts[0].outcome, 'reply');
      assert.deepEqual([r.play, r.origin], [null, 'model']);
    }
  }
  const all = calls(on.dir);
  assert.equal(all.filter(l => l.round === 'dawn').length, 8 * 13);
  assert.equal(all.length - calls(off.dir).length, 8 * 13, 'the dawn calls are the only extra calls');
  assert.equal(on.calls.live, all.length, 'every call went to the model once');
});

test('a dawn call is the day\'s ordinary briefing, the same system text as the day\'s next call, then the task line; tools offered with tool_choice "none"; the fake answers with text', () => {
  const all = calls(on.dir);
  for (const [i, l] of all.entries()) {
    if (l.round !== 'dawn') continue;
    const msgs = l.request.messages;
    assert.deepEqual(msgs.at(-1), { role: 'user', content: journal.dawnTask(l.day) }, `${l.seat}#${l.call}: the task line last`);
    assert.equal(msgs.length, 3, 'system, the day, the task');
    assert.match(msgs[1].content, new RegExp(`^Day ${l.day} of ${N.nights}\\.`), 'the ordinary briefing for that day');
    const next = all[i + 1];
    assert.equal(next.seat, l.seat);
    assert.deepEqual([next.day, next.round], [l.day, 1], 'the day\'s first call follows it');
    assert.equal(msgs[0].content, next.request.messages[0].content, 'the same system text, so the cache holds');
    assert.deepEqual(l.request.tools, toolDefinitions());
    assert.equal(l.request.tool_choice, 'none');
    assert.ok(!('response_format' in l.request));
    const msg = l.reply.body.choices[0].message;
    assert.equal(typeof msg.content, 'string');
    assert.ok(!msg.tool_calls);
  }
  assert.match(journal.dawnTask(5), /^Dawn, day 5: write today's journal entry in your own words, at most about 80 words: /);
  assert.match(journal.dawnTask(5), / Piece handles like P36 change from call to call\. /, 'the mechanical fact about handles');
  assert.ok(journal.dawnTask(14).length <= 361, `the task line stays short: ${journal.dawnTask(14).length} characters`);
});

test('each entry is stored through the memory path, dated that day, and shown on that seat\'s later calls (the newest gap.briefing.notes)', () => {
  const log = events(on.dir);
  const all = calls(on.dir);
  const entry = {};
  for (const l of all.filter(x => x.round === 'dawn')) {
    const e = log.filter(x => x.type === 'memory' && x.part === 'dawn' && x.agent === l.seat && x.day === l.day);
    assert.equal(e.length, 1, `${l.seat} day ${l.day}: one stored entry`);
    const said = l.reply.body.choices[0].message.content;
    const note = e[0].memory.journal.at(-1);
    assert.deepEqual(note, { day: l.day, line: journal.entryOf(said) }, 'the reply\'s text, dated that day');
    assert.deepEqual(e[0].vis.to, [l.seat], 'its own until published');
    entry[`${l.seat}|${l.day}`] = note.line;
  }
  // The fake's entry is read off the seat's own view.
  assert.match(Object.values(entry)[0], /^Night \d+: I played \w+/);
  assert.equal(typeof fakeEntry, 'function');
  const keep = N['gap.briefing'].notes;
  for (const l of all.filter(x => x.round !== 'dawn' && x.day >= 2)) {
    const shown = [...userText(l).matchAll(/^Your journal, day (\d+): /gm)].map(m => Number(m[1]));
    const want = DAYS.filter(d => d <= l.day).slice(-keep);
    assert.deepEqual(shown, want, `${l.seat}#${l.call} on day ${l.day}: the newest ${keep} entries`);
    for (const d of want) assert.ok(userText(l).includes(`Your journal, day ${d}: ${quotedWords(entry[`${l.seat}|${d}`])}`), `${l.seat} day ${l.day}: day ${d}'s entry in its words`);
  }
  // The journal keeps gap.journal entries, the oldest dropped: on the last day, days 3-14.
  const ck = checkpoint(on.dir);
  for (const id of Object.keys(ck.models.seats)) assert.deepEqual(ck.state.agents[id].memory.journal.map(n => n.day), DAYS.slice(-N['gap.journal']));
});

test('without the flag nothing changes: no dawn call, no stored entry, no option; and with the fake the journal changes nothing else in the season', () => {
  const ck = checkpoint(off.dir);
  assert.ok(!Object.values(ck.models.seats).some(s => s.record.some(r => r.round === 'dawn')));
  assert.ok(!calls(off.dir).some(l => /^Dawn, day/.test(l.request.messages.at(-1).content)));
  assert.ok(!events(off.dir).some(e => e.type === 'memory'), 'no memory written at all');
  assert.ok(!('journal' in ck.bench.options) && !('journal' in ck.bench.provenance.config.options));
  // The same season, event for event, once the stored entries are set aside (and the event numbers they took).
  const strip = log => log.filter(e => !(e.type === 'memory' && e.part === 'dawn')).map(({ n, vis, ...e }) => JSON.stringify(e));
  assert.deepEqual(strip(events(on.dir)), strip(events(off.dir)));
  assert.deepEqual(on.metrics.haul, off.metrics.haul);
});
