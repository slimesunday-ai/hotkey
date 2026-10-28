// R9b, the dawn journal's entry: the cap (gap.journalEntry, cut at a word boundary), an empty reply storing nothing with
// no retry, tool calls ignored, thinking dropped, the trusted dawn context in the core's memory path (a model's own
// note can't claim it), and the seat's dawn call under the day's ceiling. $0: the fake answers, or a stub fetch.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { N } from '../numbers.mjs';
import { readTape } from '../agents/fake-model.mjs';
import { entryOf, dawnReply, dawnTask, DAWN_CONTEXT, dawnNote, dawnDay } from '../agents/journal.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { viewFor } from '../rules/view.mjs';
import { Game } from './helpers.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r9j-entry-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const text = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const checkpoint = dir => JSON.parse(text(dir, 'checkpoint.json'));
const events = dir => text(dir, 'events.jsonl').split('\n').filter(Boolean).map(l => JSON.parse(l));
const CAP = N['gap.journalEntry'].chars;
const words = n => Array.from({ length: n }, (_, i) => ['alpha', 'beta', 'gamma', 'delta', 'epsilon'][i % 5]).join(' ');

test('entryOf: one line, white space run together, cut at a word boundary to gap.journalEntry.chars; nothing is ""', () => {
  assert.deepEqual(N['gap.journalEntry'], { words: 80, chars: 600 });
  assert.equal(entryOf('  Night 3:\n\n  I  lost\tthe corner. '), 'Night 3: I lost the corner.');
  assert.equal(entryOf(''), '');
  assert.equal(entryOf('   \n '), '');
  assert.equal(entryOf(undefined), '');
  const long = words(140);
  const cut = entryOf(long);
  assert.ok(cut.length <= CAP && cut.length > CAP - 10, `${cut.length} characters`);
  assert.ok(long.startsWith(cut) && long[cut.length] === ' ', 'cut where a word ends');
  assert.equal(entryOf(words(5)), words(5), 'under the cap it is kept whole');
  assert.equal(entryOf('x'.repeat(CAP + 50)).length, CAP, 'one word past the cap is cut at the cap');
  assert.equal(dawnDay(1), false);
  assert.equal(dawnDay(2), true);
  assert.equal(dawnDay(N.nights), true);
  assert.equal(dawnDay(N.nights + 1), false);
});

test('dawnReply: the reply\'s text after any thinking is the entry; tool calls are ignored; a reply of tool calls alone has no text; errors are typed', () => {
  const ok = message => ({ status: 200, body: { choices: [{ message, finish_reason: 'stop' }] } });
  assert.deepEqual(dawnReply(ok({ role: 'assistant', content: '<think>plan it</think>\nNight 2: quiet.' })), { outcome: 'reply', text: '\nNight 2: quiet.' });
  const call = { id: 'c1', type: 'function', function: { name: 'play', arguments: '{"menu":1}' } };
  assert.deepEqual(dawnReply(ok({ role: 'assistant', content: 'Night 2: quiet.', tool_calls: [call] })), { outcome: 'reply', text: 'Night 2: quiet.' });
  assert.deepEqual(dawnReply(ok({ role: 'assistant', content: null, tool_calls: [call] })), { outcome: 'reply', text: '' });
  assert.equal(dawnReply({ status: 500, body: {} }).outcome, 'error');
  assert.equal(dawnReply({ status: 200, body: { error: { code: 502 } } }, 'openrouter').outcome, 'error');
  assert.equal(dawnReply({ status: 200, body: { choices: [{ message: { content: 'cut sho' }, finish_reason: 'length' }] } }).outcome, 'cutoff');
  // Cut off while still thinking: the reasoning is never the entry (it would go public after 24 hours).
  assert.deepEqual(dawnReply({ status: 200, body: { choices: [{ message: { content: '<think>rob a07 tonight, he trusts me' }, finish_reason: 'length' }] } }), { outcome: 'cutoff', text: '' });
  assert.deepEqual(dawnReply(ok({ role: 'assistant', content: 'Night 4: <think> no close' })), { outcome: 'reply', text: '' });
});

test('the core\'s memory path: a dawn entry comes only through the trusted dawn context, up to the cap, its event part "dawn"; a model\'s own note is still one line of gap.lineLength, part "note", whatever its fields say', () => {
  const g = new Game({ n: 3 });
  const full = words(140).slice(0, CAP);
  const res = applyErrand(g.s, dawnNote('a01', full), DAWN_CONTEXT);
  assert.ok(res.ok, res.why);
  assert.deepEqual(res.state.agents.a01.memory.journal, [{ day: g.s.day, line: full }]);
  assert.deepEqual(res.events.map(e => [e.type, e.agent, e.part]), [['memory', 'a01', 'dawn']]);
  const over = applyErrand(g.s, dawnNote('a01', `${full} more`), DAWN_CONTEXT);
  assert.equal(over.ok, false, 'past the cap is refused');
  // A model's note: no context, so the line is cut at gap.lineLength and the event says note, even if it claims dawn.
  const own = applyErrand(g.s, { by: 'a02', kind: 'note', line: full, source: 'dawn' });
  assert.ok(own.ok);
  assert.deepEqual(own.state.agents.a02.memory.journal, [{ day: g.s.day, line: full.slice(0, N['gap.lineLength']) }]);
  assert.equal(own.events[0].part, 'note');
});

// A runner season on the fake, answering chosen dawn calls with a script: the call numbers come from a first pass,
// since the fake's own entries change nothing the bots read.
async function scripted(name, pick) {
  const { runModelSeason } = await import('../bench/runner.mjs');
  const { CASTS } = await import('../bench/bots.mjs');
  const base = { seed: 404, rule: 'A', mix: { ...CASTS['models-canny'], models: 4 }, journal: 'dawn', stopAfter: 3, reply: 'tools' };
  const first = await runModelSeason({ ...base, outDir: path.join(tmp, `${name}-first`) });
  const ck = checkpoint(first.dir);
  const dawnCalls = {};
  for (const [id, x] of Object.entries(ck.models.seats)) for (const r of x.record) if (r.round === 'dawn') (dawnCalls[id] ||= {})[r.day] = r.attempts[0].call;
  const script = pick(dawnCalls);
  const r = await runModelSeason({ ...base, script, outDir: path.join(tmp, name) });
  return { r, dawnCalls, ck: checkpoint(r.dir), log: events(r.dir), tape: [...readTape(text(r.dir, 'tape.jsonl')).values()] };
}

test('in a season: a long reply is cut at a word boundary to the cap; an empty reply, a reply of tool calls alone, a reply cut off while still thinking, or no reply in the window stores nothing and is not asked again; thinking is dropped', async () => {
  const long = words(140);
  let seats;
  const { ck, log, tape, dawnCalls } = await scripted('cases', calls => {
    seats = Object.keys(calls).sort();
    const [a, b, c, d] = seats;
    return {
      [a]: { [calls[a][2]]: { content: long } },
      [b]: { [calls[b][2]]: { content: '' }, [calls[b][3]]: { content: '<think>the plan: rob a07 while he trusts me', finish: 'length' } },
      [c]: { [calls[c][2]]: { toolCalls: [{ id: 'c1', type: 'function', function: { name: 'play', arguments: '{"menu":1}' } }] } },
      [d]: { [calls[d][2]]: { fault: 'hang' }, [calls[d][3]]: { content: '<think>count the cash</think>\n  Night 2:\n  kept  my head down. ' } },
    };
  });
  const [a, b, c, d] = seats;
  const stored = (id, day) => log.filter(e => e.type === 'memory' && e.part === 'dawn' && e.agent === id && e.day === day).map(e => e.memory.journal.at(-1).line);
  const [cut] = stored(a, 2);
  assert.ok(cut.length <= CAP && long.startsWith(cut) && long[cut.length] === ' ', `cut to ${cut.length} at a word's end`);
  assert.deepEqual(stored(b, 2), [], 'an empty reply stores nothing');
  assert.deepEqual(stored(c, 2), [], 'tool calls are ignored: nothing stored');
  assert.deepEqual(stored(d, 2), [], 'no reply in the window: nothing stored');
  assert.deepEqual(stored(d, 3), ['Night 2: kept my head down.'], 'thinking dropped, one line');
  assert.deepEqual(stored(b, 3), [], 'a reply cut off while thinking stores nothing: its reasoning never goes public');
  assert.ok(!log.some(e => e.type === 'memory' && JSON.stringify(e.memory).includes('rob a07')), 'nowhere in the record');
  for (const id of [a, c, d]) assert.equal(stored(id, 3).length, 1, `${id}: day 3's entry is stored as usual`);
  const dawn = Object.fromEntries(seats.map(id => [id, ck.models.seats[id].record.filter(r => r.round === 'dawn')]));
  assert.deepEqual(dawn[b].find(r => r.day === 2), { day: 2, round: 'dawn', origin: 'default', play: null, attempts: [{ call: dawnCalls[b][2], outcome: 'reply', actions: [] }] });
  assert.equal(dawn[d].find(r => r.day === 2).attempts[0].outcome, 'timeout');
  // No retry: each dawn is one call, and the seat's next call is the day's first.
  for (const id of seats) for (const day of [2, 3]) {
    const n = dawnCalls[id][day];
    assert.equal(tape.filter(l => l.seat === id && l.call === n).length, 1);
    const nextRecord = ck.models.seats[id].record.find(r => r.day === day && r.round === 1);
    assert.equal(nextRecord.attempts[0].call, n + 1, `${id} day ${day}: no second dawn request`);
  }
});

test('a seat\'s dawn call: under the day\'s ceiling (at it, no request and no entry); it acts on nothing and leaves the last results, the feedback and the pick for the day\'s first call', async () => {
  const { makeSeat } = await import('../agents/seat.mjs');
  const g = new Game({ n: 3 });
  const view = viewFor(g.s, g.log, 'a01', 'agent');
  const brief = () => [{ role: 'system', content: 'rules' }, { role: 'user', content: `Day ${view.day}.` }];
  const sent = [];
  const fetch = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Night 0: nothing yet.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 });
  };
  const last = [{ act: 'play', ok: true }];
  const atCeiling = makeSeat({ id: 'a01', url: 'http://fake.invalid/v1/chat/completions', fetch, secret: 's', brief, memo: { day: view.day, today: N.callCeiling, last } });
  assert.deepEqual(await atCeiling.dawn({ view }), { text: '', outcome: 'ceiling', calls: 0 });
  assert.equal(sent.length, 0, 'past the ceiling nothing is sent');
  assert.deepEqual(atCeiling.record, [{ day: view.day, round: 'dawn', origin: 'default', play: null, attempts: [{ call: null, outcome: 'ceiling' }] }]);
  const memo = { day: view.day, today: 2, last, feedback: [], pick: { kind: 'hustle', place: 'docks' } };
  const seat = makeSeat({ id: 'a01', url: 'http://fake.invalid/v1/chat/completions', fetch, secret: 's', brief, memo, reply: 'tools' });
  const out = await seat.dawn({ view });
  assert.deepEqual(out, { text: 'Night 0: nothing yet.', outcome: 'reply', calls: 1 });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].messages.at(-1), { role: 'user', content: dawnTask(view.day) });
  assert.equal(sent[0].tool_choice, 'none');
  assert.equal(seat.memo.today, 3, 'it counts toward the day\'s ceiling');
  assert.deepEqual([seat.memo.last, seat.memo.pick], [last, { kind: 'hustle', place: 'docks' }], 'nothing the day\'s first call reads is changed');
  const json = makeSeat({ id: 'a01', url: 'http://fake.invalid/v1/chat/completions', fetch, secret: 's', brief });
  await json.dawn({ view });
  assert.ok(!('response_format' in sent[1]) && !('tools' in sent[1]), 'a JSON seat asks for text: no JSON reply format, no tools');
});
