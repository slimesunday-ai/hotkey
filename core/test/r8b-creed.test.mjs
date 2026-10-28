// R8b, the Creed (GAME.md §17 at 8bcaeb7; slime, 10-19: "THE OWNER (HUMAN) CAN EDIT AT A LATER DATE IF THEY WANY"):
// the owner's own words, up to N.creed characters, empty for every agent at the start, set only through the trusted
// owner context (memory.mjs), public after 24 hours as before; the next call after a change tells the agent once,
// "Your owner changed your Creed."; and the bench's --creeds simulates owners editing on a given day, off by default,
// kept in the run folder and checked on resume and replay. The words "mission" appear nowhere. Nothing calls a model.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Game } from './helpers.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { defaultPlay, checkPlay } from '../rules/plays.mjs';
import { N } from '../numbers.mjs';
import { fakeModel, manualClock, CHAT_PATH, readTape } from '../agents/fake-model.mjs';

const NOTICE = 'Your owner changed your Creed.';
const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r8b-creed-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const cli = args => spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8' });
const checkpoint = dir => JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8'));

function owner(g, id, fields, context = { source: 'owner' }) {
  const r = applyErrand(g.s, { by: id, kind: 'creed', ...fields }, context);
  g.s = r.state;
  g.log.push(...r.events);
  checkLedger(g.s);
  return r;
}
const creedOf = (g, id = 'a01') => g.view(id).me.memory.creed;

test('the Creed is the owner\'s own words, up to N.creed characters (600), new lines and all; empty at the start; empty words clear it; only the trusted owner context sets it', () => {
  assert.equal(N.creed, 600);
  const g = new Game();
  assert.deepEqual(creedOf(g), [], 'every agent starts with no Creed');
  const start = "never rat.\nprotect the grail; don't trust a03. ";
  const words = `${start}${'x'.repeat(N.creed - start.length)}`;
  assert.equal(words.length, N.creed);
  assert.equal(owner(g, 'a01', { text: words }).ok, true);
  assert.deepEqual(creedOf(g), [words], 'kept whole, as written');
  const long = owner(g, 'a01', { text: `${words}!` });
  assert.equal(long.ok, false);
  assert.match(long.why, /600 characters/);
  assert.deepEqual(creedOf(g), [words], 'a refused edit changes nothing');
  for (const ctx of [{}, { source: 'ownerAI' }, { source: 'model' }]) assert.equal(owner(g, 'a01', { text: 'FORGED' }, ctx).ok, false, JSON.stringify(ctx));
  assert.equal(owner(g, 'a01', { text: 'FORGED', source: 'owner' }, {}).ok, false, 'never from the action\'s own fields');
  assert.equal(owner(g, 'a01', { text: 'x', lines: ['y'] }).ok, false, 'its words or its lines, not both');
  assert.equal(owner(g, 'a01', { text: 42 }).ok, false);
  assert.equal(owner(g, 'a01', { text: '' }).ok, true);
  assert.deepEqual(creedOf(g), [], 'empty words clear it');
  assert.equal(owner(g, 'a01', { lines: ['one', 'two'] }).ok, true, 'the three-line form still works as it did');
  assert.deepEqual(creedOf(g), ['one', 'two']);
});

test('the owner\'s words are the agent\'s own at once and everyone\'s after 24 hours, never an owner\'s AI\'s', () => {
  const g = new Game();
  owner(g, 'a01', { text: 'CREED-WORDS-CANARY\nsecond line' });
  const has = (v, t) => JSON.stringify(v).includes(t);
  assert.ok(has(g.view('a01'), 'CREED-WORDS-CANARY'));
  assert.equal(has(g.view('a02'), 'CREED-WORDS-CANARY'), false);
  assert.equal(has(g.view(null, 'public'), 'CREED-WORDS-CANARY'), false);
  g.night();
  assert.ok(has(g.view('a02'), 'CREED-WORDS-CANARY'));
  assert.equal(has(g.view('a02', 'ownerAI'), 'CREED-WORDS-CANARY'), false);
});

// A seat on the fake local API, briefed as `brief` says, on a manual clock (r8-tools-seat.test.mjs's harness).
async function seatOn(g, brief, more = {}) {
  const { makeSeat } = await import('../agents/seat.mjs');
  const clock = manualClock();
  // By day nothing; the fourth request is the lock's, with a play, so each call point makes one request.
  const fake = fakeModel({ script: { a01: Array.from({ length: 12 }, (_, i) => ({ json: { actions: i === 3 ? [{ act: 'play', kind: 'laylow' }] : [] } })) }, clock });
  const seat = makeSeat({
    id: 'a01', url: `http://fake.invalid${CHAT_PATH}`, fetch: fake.fetch, secret: 'r8b', clock, model: 'test/model',
    brief: (r, memory, last, round, context) => brief(r, { memory, last, call: round === 'lock' ? 'lock' : 'round', ...context }), ...more,
  });
  const call = async (round = 1) => {
    const at = round === 'lock' ? { round, defaultPlay: defaultPlay(g.s, 'a01', g.s.day) } : { round, apply: e => { const r = g.errand('a01', e.kind, e); return { ok: r.ok, why: r.why }; } };
    return seat.call({ view: g.view('a01'), currentView: () => g.view('a01'), validatePlay: x => checkPlay(g.s, 'a01', x, g.s.day), ...at });
  };
  return { seat, fake, call, users: () => fake.calls.map(c => c.request.messages[1].content), systems: () => fake.calls.map(c => c.request.messages[0].content) };
}

test('the next call after the owner changes the Creed says so once, in the day\'s text and not the fixed system text; a call with no change says nothing; in the current and the starter briefing alike', async () => {
  const { briefingPacket, starterBriefingPacket } = await import('../agents/briefing.mjs');
  for (const brief of [briefingPacket, starterBriefingPacket]) {
    const g = new Game({ n: 4 });
    const s = await seatOn(g, brief);
    await s.call(1);
    owner(g, 'a01', { text: 'NEW-CREED-WORDS' });
    await s.call(2);
    await s.call(3);
    owner(g, 'a01', { text: 'NEWER-CREED-WORDS' });
    await s.call('lock');
    owner(g, 'a01', { text: '' });
    g.night();
    await s.call(1);
    await s.call(2);
    const said = s.users().map(u => u.split(NOTICE).length - 1);
    assert.deepEqual(said, [0, 1, 0, 1, 1, 0], `${brief.name}: once after each change`);
    assert.ok(s.users()[1].startsWith(NOTICE), 'first, before the day');
    assert.ok(s.users()[1].includes('NEW-CREED-WORDS') && s.users()[2].includes('NEW-CREED-WORDS'), 'the words themselves, quoted as before');
    assert.ok(s.systems().every(x => !x.includes(NOTICE)), 'never in the system text, which stays the same');
    assert.ok(s.users().every(u => u.length + s.systems()[0].length <= N['gap.briefing'].chars + 3), 'inside the cap');
    assert.ok(!/mission/i.test(JSON.stringify(s.fake.calls.map(c => c.request))), 'no "mission" anywhere');
    await s.fake.close();
  }
});

async function season(name, more = {}) {
  const { runModelSeason } = await import('../bench/runner.mjs');
  const { CASTS } = await import('../bench/bots.mjs');
  return runModelSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, name), mix: { ...CASTS.models, models: 4 }, say: () => {}, ...more });
}

test('--creeds sets given seats\' Creeds on a given day, through the owner\'s context; off by default; kept in the run folder, refused on a resume without it, and played by a replay', async () => {
  const plain = await season('plain', { stopAfter: 3 });
  const seats = checkpoint(plain.dir).cast.filter(c => c.model).map(c => c.id);
  assert.equal(checkpoint(plain.dir).bench.options.creeds, undefined, 'off by default');
  const creeds = [{ day: 3, seat: seats[0], text: 'CREED-ONE never rat' }, { day: 3, seat: seats[1], text: 'CREED-TWO\nrob anyone who flashes a grail' }];
  const r = await season('creeds', { stopAfter: 4, creeds, briefing: 'starter', reply: 'tools' });
  const ck = checkpoint(r.dir);
  assert.deepEqual(ck.bench.options.creeds, creeds, 'in the run folder');
  assert.deepEqual(ck.bench.provenance.config.options.creeds, creeds, 'and in its setup, so no twin pairs across it');
  for (const c of creeds) assert.deepEqual(ck.state.agents[c.seat].memory.creed, [c.text]);
  const events = fs.readFileSync(path.join(r.dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const set = events.filter(e => e.type === 'memory' && e.part === 'creed');
  assert.deepEqual(set.map(e => [e.day, e.agent]), creeds.map(c => [3, c.seat]), 'on day 3, before anything else that day');
  const tape = [...readTape(fs.readFileSync(path.join(r.dir, 'tape.jsonl'), 'utf8')).values()];
  for (const id of seats) {
    // A call point's first request (a retry repeats its briefing): once, at the first call after the change.
    const firsts = new Set(ck.models.seats[id].record.map(x => x.attempts.find(a => a.call !== null)?.call).filter(Boolean));
    const told = tape.filter(l => l.seat === id && firsts.has(l.call) && l.request.messages[1].content.includes(NOTICE));
    assert.equal(told.length, creeds.some(c => c.seat === id) ? 1 : 0, `${id}: told once`);
    if (told.length) assert.ok(tape.filter(l => l.seat === id && l.call < told[0].call).every(l => !l.request.messages[1].content.includes('CREED-')), 'and not before');
  }
  const { runModelSeason } = await import('../bench/runner.mjs');
  const { CASTS } = await import('../bench/bots.mjs');
  const again = more => runModelSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, 'creeds'), mix: { ...CASTS.models, models: 4 }, say: () => {}, briefing: 'starter', reply: 'tools', resume: true, ...more });
  await assert.rejects(again({}), e => e.refused && /--creeds/.test(e.message), 'a resume must name them');
  await assert.rejects(again({ creeds: [creeds[0]] }), e => e.refused && /--creeds/.test(e.message), 'the same ones');
  const file = path.join(tmp, 'creeds.json');
  fs.writeFileSync(file, JSON.stringify(creeds));
  const out = path.join(tmp, 'replayed');
  const rp = cli(['--replay', r.dir, '--out', out, '--quiet']);
  assert.equal(rp.status, 0, rp.stderr);
  assert.equal(fs.readFileSync(path.join(out, '404-A', 'events.jsonl'), 'utf8'), fs.readFileSync(path.join(r.dir, 'events.jsonl'), 'utf8'), 'a replay plays them');
  assert.deepEqual(checkpoint(path.join(out, '404-A')).bench.options.creeds, creeds);
});

test('on the command line: --creeds reads a JSON file of { day, seat, text }; a bad one is refused before anything is written', () => {
  const out = path.join(tmp, 'cli');
  const base = ['--seed', '404', '--rule', 'A', '--cast', 'models', '--model-seats', '4', '--quiet', '--out', out, '--stop-after', '1'];
  const write = (name, x) => {
    const f = path.join(tmp, name);
    fs.writeFileSync(f, typeof x === 'string' ? x : JSON.stringify(x));
    return f;
  };
  for (const [bad, why] of [
    ['{not json', /--creeds/],
    [[{ day: 0, seat: 'a01', text: 'x' }], /day/],
    [[{ day: 3, seat: 'a01', text: 'x'.repeat(N.creed + 1) }], /600 characters/],
    [[{ day: 3, seat: 'a01', text: 'x', extra: 1 }], /day, seat and text/],
    [[{ day: 3, seat: 'a99', text: 'x' }], /a99/],
  ]) {
    const r = cli([...base, '--creeds', write('bad.json', bad)]);
    assert.equal(r.status, 2, `${JSON.stringify(bad)}: ${r.stderr}`);
    assert.match(r.stderr, why);
  }
  assert.equal(fs.existsSync(path.join(out, '404-A')), false, 'nothing written');
  const bots = cli(['--seed', '404', '--rule', 'A', '--cast', 'layer4', '--quiet', '--out', out, '--creeds', write('ok.json', [])]);
  assert.equal(bots.status, 2);
  assert.match(bots.stderr, /--creeds, --reply, --seat-models and --briefing go with --cast models/);
});
