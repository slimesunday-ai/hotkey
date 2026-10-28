// R2-8, the model season (GAME.md §17, §18, §23, §25, §26; brief R2-agents.md, task 8; Q2, Q4, Q5). One season loop
// plays bots and model seats: `runSeason` stays synchronous for the bot casts, and a cast with model seats runs through
// the same steps asynchronously (runModelSeason). A model seat is called in round 1, in any later round where a
// sit-down waits for it, and at the lock, where the calls go out together under a cap. The `models` cast is the layer4
// cast with N seats played by a model, never a crew member or a shift worker; every bot's driver reads `bot`. The
// per-season secret, each seat's memo, record and tape stay in the run folder; a killed season resumes from its
// checkpoint and its tape without calling again; a finished one replays from its tape with no model. A real endpoint
// is called only with --model-url and --go, and stopping aborts the requests in flight. Nothing here calls a model:
// every model seat talks to the fake (R2-6), in-process or on a port the system picks, and nothing reaches
// 127.0.0.1:8000. Each test imports what it needs itself, so each fails on its own before the code exists.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { N } from '../numbers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { viewFor } from '../rules/view.mjs';
import { HOMES } from '../rules/state.mjs';
import { ITEMS } from './helpers.mjs';
import { read, replyFormat } from '../agents/tools.mjs';
import { briefing } from '../agents/briefing.mjs';
import { fakeModel, readTape, CHAT_PATH } from '../agents/fake-model.mjs';

const runnerModule = () => import('../bench/runner.mjs');
const botsModule = () => import('../bench/bots.mjs');
const here = path.dirname(fileURLToPath(import.meta.url));
const core = path.resolve(here, '..');
const runner = path.join(core, 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-models-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
// In-process, any URL with the endpoint's path will do: the fake never reaches the network.
const IN_PROCESS = `http://fake.invalid${CHAT_PATH}`;
// Ports nothing here may use: the model's own, the old sim's tests' and slime's viewers'.
const TAKEN = [8000, 5601, 5602, 5613, 5615, 5262, 5265, 5340];
// A reply a scripted endpoint gives every call: no errand, and the first line of tonight's menu.
const FIRST_LINE = { json: { actions: [{ act: 'play', menu: 1 }] } };
const readLog = dir => fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8');
const events = dir => readLog(dir).split('\n').filter(Boolean).map(l => JSON.parse(l));
const checkpoint = dir => JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8'));
const tapeOf = dir => fs.readFileSync(path.join(dir, 'tape.jsonl'), 'utf8');
const turn = () => new Promise(resolve => setImmediate(resolve));
// What was open before any test ran: the file must leave its process as it found it.
const OPEN_AT_START = process.getActiveResourcesInfo();
// Seats a model may play until slime answers Q4: never a crew member or a shift worker.
const OPEN = c => !['crew', 'hustle', 'squatter'].includes(c.type);

// The runner on its own command line, in a child process, without blocking this one (a fake here may be answering it).
function cli(args, { onSpawn } = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [runner, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
    if (onSpawn) onSpawn(child);
  });
}
async function until(what, ok, ms = 20000) {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

// One models season on the fake, run once and shared by the tests that read it.
const ran = new Map();
function modelSeason(seed, rule, n, more = {}) {
  const key = JSON.stringify([seed, rule, n, Object.keys(more).sort()]);
  if (!ran.has(key)) {
    ran.set(key, (async () => {
      const { runModelSeason } = await runnerModule();
      const { CASTS } = await botsModule();
      return runModelSeason({ seed, rule, outDir: path.join(tmp, `season-${ran.size}`), mix: { ...CASTS.models, models: n }, ...more });
    })());
  }
  return ran.get(key);
}
// A seat-day's requests, from the seats' records in a run folder's checkpoint.
function callsPerSeatDay(ck) {
  const out = new Map();
  for (const [id, seat] of Object.entries(ck.models.seats)) {
    for (const r of seat.record) out.set(`${id}#${r.day}`, (out.get(`${id}#${r.day}`) || 0) + r.attempts.filter(a => a.call !== null).length);
  }
  return out;
}

test('the models cast: the layer4 cast with N seats a model plays, picked by the seed from the trade bots and §25\'s strategies, never a crew member or a shift worker (Q4, until slime answers); every bot\'s driver reads bot and a model seat\'s its model\'s name, and every other cast keeps its drivers (Q5)', async () => {
  const { makeCast, CASTS, driverOf } = await botsModule();
  const { mixOf, castName } = await runnerModule();
  assert.ok(CASTS.models, 'a cast called models');
  const picks = new Set();
  for (const seed of [404, 405, 406, 407]) {
    const layer4 = makeCast(seed, CASTS.layer4);
    const open = layer4.filter(OPEN).length;
    assert.ok(open > 0 && open < layer4.length);
    for (const n of [0, 4, open]) {
      const cast = makeCast(seed, { ...CASTS.models, models: n });
      assert.deepEqual(cast.map(({ model, ...c }) => c), layer4, `seed ${seed}, ${n} model seats: the layer4 cast, seat for seat`);
      const mine = cast.filter(c => c.model);
      assert.equal(mine.length, n);
      for (const c of mine) assert.ok(OPEN(c), `${c.id}, a ${c.type}, is never a model seat`);
      assert.deepEqual(makeCast(seed, { ...CASTS.models, models: n }), cast, 'the same seed, the same seats');
      if (n === 4) picks.add(mine.map(c => c.id).join());
      for (const c of cast) assert.equal(driverOf(c, 'some-model'), c.model ? 'some-model' : 'bot', `${c.id}'s driver on the board`);
    }
    assert.throws(() => makeCast(seed, { ...CASTS.models, models: open + 1 }), /model/, 'no more model seats than the seats a model may play');
    for (const c of layer4) assert.equal(driverOf(c, 'some-model'), `bot:${c.type}`, 'every other cast keeps its drivers');
  }
  assert.ok(picks.size > 1, 'the seed picks the seats');
  assert.deepEqual(mixOf({ cast: 'models', 'model-seats': '4' }), { ...CASTS.models, models: 4 });
  assert.equal(castName(mixOf({ cast: 'models', 'model-seats': '4' })), 'models');
  assert.throws(() => mixOf({ cast: 'models' }), /model-seats/, '--cast models takes --model-seats');
  assert.throws(() => mixOf({ cast: 'layer4', 'model-seats': '4' }), /model-seats/, 'no other cast takes it');
  assert.equal(mixOf({ cast: 'layer4' }), CASTS.layer4);
});

test('the models cast on the fake, three seasons (404 A, 405 B, 406 A; the bench runs all 40): each ends with the ledger checked after every errand and every night and nothing failed, every model seat called inside the ceiling, the fake never failing, its secret, memos, records and tape in the run folder (§23, §25; brief R2-8)', async () => {
  for (const [seed, rule] of [[404, 'A'], [405, 'B'], [406, 'A']]) {
    const { dir, metrics, calls } = await modelSeason(seed, rule, 4);
    assert.equal(metrics.ledger.failed, 0);
    assert.equal(metrics.ledger.nights, N.nights);
    assert.ok(metrics.ledger.errands > 0);
    assert.ok(fs.existsSync(path.join(dir, 'report.md')) && fs.existsSync(path.join(dir, 'result.json')));
    const ck = checkpoint(dir);
    assert.equal(ck.state.over, true);
    const seats = ck.cast.filter(c => c.model).map(c => c.id);
    assert.equal(seats.length, 4);
    assert.deepEqual(Object.keys(ck.models.seats).sort(), seats, 'a memo and a record for each model seat');
    assert.ok(calls.live > 0 && calls.taped === 0, `${calls.live} calls, none from a tape`);
    const tape = readTape(tapeOf(dir));
    assert.equal(tape.size, calls.live, 'every call is on the tape');
    for (const id of seats) assert.equal(ck.models.seats[id].memo.calls, [...tape.values()].filter(l => l.seat === id).length, `${id}'s call counter`);
    const most = Math.max(...callsPerSeatDay(ck).values());
    assert.ok(most <= N.callCeiling, `the most calls in a seat-day: ${most}`);
    // The model seats played: their records show the model answering, and their drivers show the model's name.
    const origins = Object.values(ck.models.seats).flatMap(x => x.record.map(r => r.origin));
    assert.ok(origins.filter(o => o === 'model').length > origins.length / 2, 'the model answered most calls');
    const season = events(dir)[0];
    for (const a of season.agents) assert.equal(a.driver, seats.includes(a.id) ? 'fake' : 'bot');
  }
});

test('wake-ups (Q2): a model seat is called in round 1, in a later round only when a sit-down waits for it (asked of it, or open and its turn), and at the lock whenever it is free', async () => {
  const { wakes } = await runnerModule();
  const sd = (state, asked, said = []) => ({ id: 's1', with: 'a02', asked, state, said: said.map(from => ({ from, say: 'offer', terms: {} })) });
  const view = (...sitdowns) => ({ me: { id: 'a01', sitdowns } });
  assert.equal(wakes(view(), 1), true, 'round 1, always');
  assert.equal(wakes(view(), 2), false, 'nothing waits');
  assert.equal(wakes(view(sd('asked', 'them')), 2), true, 'asked of it');
  assert.equal(wakes(view(sd('asked', 'me')), 3), false, 'its own ask, still unanswered');
  assert.equal(wakes(view(sd('open', 'me')), 3), true, 'its ask accepted: its word is due');
  assert.equal(wakes(view(sd('open', 'them')), 3), false, 'it accepted theirs: their word is due');
  assert.equal(wakes(view(sd('open', 'them', ['a01', 'a02'])), 2), true, 'the last word is theirs');
  assert.equal(wakes(view(sd('open', 'me', ['a02', 'a01'])), 2), false, 'the last word is its own');
  assert.equal(wakes(view(sd('declined', 'them')), 2), false, 'declined');
  // In a season: the seats' records show a call exactly where the rule woke them, and one at every lock they played.
  const said = new Map();
  const spy = (v, round) => {
    const w = wakes(v, round);
    said.set(`${v.me.id}#${v.day}#${round}`, w);
    return w;
  };
  const { dir } = await modelSeason(407, 'A', 6, { wakes: spy });
  const ck = checkpoint(dir);
  const log = events(dir);
  let later = 0;
  for (const [id, seat] of Object.entries(ck.models.seats)) {
    const byDay = seat.record.filter(r => r.round !== 'lock').map(r => `${id}#${r.day}#${r.round}`);
    assert.deepEqual(byDay, [...said].filter(([k, w]) => w && k.startsWith(`${id}#`)).map(([k]) => k), `${id}: called by day exactly where it woke`);
    later += byDay.filter(k => !k.endsWith('#1')).length;
    const locks = seat.record.filter(r => r.round === 'lock').map(r => r.day);
    assert.deepEqual(locks, log.filter(e => e.type === 'play' && e.agent === id).map(e => e.day), `${id}: called at every lock it played`);
  }
  assert.ok(later > 0, `control: ${later} later rounds woke a seat`);
  assert.ok([...said.values()].some(w => !w), 'control: some rounds did not');
});

test('the lock\'s calls go out together, at most --model-concurrency at once, and the day\'s one at a time (oMLX takes 8 at once; brief R2-8)', async () => {
  const { runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  for (const cap of [8, 2]) {
    const fake = fakeModel({ script: () => ({ ...FIRST_LINE, delayMs: 20 }) });
    let now = 0, most = 0;
    const spans = [];
    const counting = async (url, init) => {
      const h = new Headers(init.headers);
      const span = { seat: h.get('x-seat'), call: Number(h.get('x-call')) };
      now += 1;
      most = Math.max(most, now);
      span.with = now;
      spans.push(span);
      try {
        return await fake.fetch(url, init);
      } finally {
        now -= 1;
      }
    };
    const { dir } = await runModelSeason({
      seed: 404, rule: 'A', outDir: path.join(tmp, `cap-${cap}`), mix: { ...CASTS.models, models: 6 }, stopAfter: 1,
      url: IN_PROCESS, fetch: counting, go: 'a test: the fake stands in for the endpoint', model: 'test', concurrency: cap,
    });
    await fake.close();
    const ck = checkpoint(dir);
    const round = new Map(Object.entries(ck.models.seats).flatMap(([id, x]) => x.record.flatMap(r => r.attempts.map(a => [`${id}#${a.call}`, r.round]))));
    const atLock = spans.filter(s => round.get(`${s.seat}#${s.call}`) === 'lock');
    assert.equal(atLock.length, 6, 'every seat called at the lock on night 1');
    assert.equal(Math.max(...atLock.map(s => s.with)), Math.min(cap, 6), `cap ${cap}: the lock's calls together, up to the cap`);
    assert.equal(Math.max(...spans.filter(s => !atLock.includes(s)).map(s => s.with)), 1, 'by day, one call at a time');
    assert.equal(most, Math.min(cap, 6));
  }
});

test('the per-season secret: drawn when the season starts, kept in the run folder, never in the state, the log or a request; with the fake it comes from the seed, so a test season repeats, and with a real endpoint it is random (the orchestrator\'s call, 10-15)', async () => {
  const { runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  const { dir } = await modelSeason(404, 'A', 4);
  const again = await runModelSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, 'secret-again'), mix: { ...CASTS.models, models: 4 }, stopAfter: 1 });
  const other = await modelSeason(405, 'B', 4);
  const secret = checkpoint(dir).models.secret;
  assert.ok(typeof secret === 'string' && secret.length >= 16);
  assert.equal(checkpoint(again.dir).models.secret, secret, 'the fake\'s secret repeats with the seed');
  assert.notEqual(checkpoint(other.dir).models.secret, secret);
  assert.notEqual(secret, '404', 'not the seed itself');
  const ck = checkpoint(dir);
  assert.ok(!JSON.stringify(ck.state).includes(secret), 'not in the state');
  assert.ok(!readLog(dir).includes(secret), 'not in the log, so in no view');
  for (const l of readTape(tapeOf(dir)).values()) assert.ok(!JSON.stringify(l.request).includes(secret), 'not in any request');
  // A real endpoint (the fake standing in, as the guard requires): a random secret each season.
  const secrets = [];
  for (const k of [1, 2]) {
    const fake = fakeModel({ script: () => FIRST_LINE });
    const r = await runModelSeason({
      seed: 404, rule: 'A', outDir: path.join(tmp, `secret-real-${k}`), mix: { ...CASTS.models, models: 2 }, stopAfter: 1,
      url: IN_PROCESS, fetch: fake.fetch, go: 'a test: the fake stands in for the endpoint', model: 'test',
    });
    await fake.close();
    secrets.push(checkpoint(r.dir).models.secret);
  }
  assert.ok(secrets.every(x => typeof x === 'string' && x.length >= 16));
  assert.notEqual(secrets[0], secrets[1], 'random, season by season');
});

test('each request carries the briefing (R2-4), which says which call it is: by day a play sent becomes tonight\'s pick, and at the lock errands are refused (R2-7\'s notes); without saying, the briefing is as it was, and it keeps its budget', async () => {
  const { dir } = await modelSeason(404, 'A', 4);
  const ck = checkpoint(dir);
  const round = new Map(Object.entries(ck.models.seats).flatMap(([id, x]) => x.record.flatMap(r => r.attempts.filter(a => a.call !== null).map(a => [`${id}#${a.call}`, r.round]))));
  const tape = [...readTape(tapeOf(dir)).values()];
  const header = new Map();
  for (const l of tape) {
    const [sys, user] = l.request.messages;
    assert.equal(sys.role, 'system');
    assert.ok(sys.content.includes(replyFormat('seat')), 'the stable header holds the reply format');
    header.set(l.seat, header.get(l.seat) ?? sys.content);
    assert.equal(sys.content, header.get(l.seat), 'the header never changes for a seat');
    const lock = round.get(`${l.seat}#${l.call}`) === 'lock';
    assert.equal(/errands sent now are refused/i.test(user.content), lock, `${l.seat}'s call ${l.call}: the lock's line`);
    assert.equal(/tonight's pick/.test(user.content), !lock, `${l.seat}'s call ${l.call}: the day's line`);
    assert.ok(sys.content.length + user.content.length <= N['gap.briefing'].chars, 'inside the budget');
  }
  assert.ok(tape.some(l => round.get(`${l.seat}#${l.call}`) === 'lock') && tape.some(l => round.get(`${l.seat}#${l.call}`) !== 'lock'));
  // The briefing itself: the optional input changes only the menu block.
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents: [1, 2, 3].map(i => ({ id: `a0${i}`, name: `t${i}`, trade: 'smuggler', driver: 'test' })) });
  const seen = read(viewFor(r.state, r.events, 'a01', 'agent'), { audience: 'seat', seed: 'a secret' }).result;
  const plain = briefing(seen);
  assert.deepEqual(briefing(seen, { call: undefined }), plain);
  const [day, lock] = [briefing(seen, { call: 'round' }), briefing(seen, { call: 'lock' })];
  for (const b of [day, lock]) assert.equal(b[0].content, plain[0].content, 'the header is the same');
  assert.match(day[1].content, /tonight's pick/);
  assert.match(day[1].content, /errands sent at the lock are refused/i);
  assert.match(lock[1].content, /errands sent now are refused/i);
  assert.ok(!/tonight's pick|are refused/.test(plain[1].content));
});

test('R2-7\'s expected differences: a models season whose every model seat (all the seats a model may play) is the bot-playing fake, called in every round, differs from the same cast played by its bots only where R2-7 said: the drivers, the play a crash or a withdrawal forced (the default the seat sent, with no reason), and a SUDO night\'s break-in, whose place its menu line fills in (brief R2-6, R2-7, R2-8)', async () => {
  const { runModelSeason, runSeason } = await runnerModule();
  const { makeCast, CASTS } = await botsModule();
  const seen = { forced: 0, sudo: 0 };
  // Two seasons with a SUDO night whose taker, a seat a model may play, sent a break-in. R4-4's re-pin, as R4-3's
  // handles.test.mjs picks its season: the first seed of 404-463 whose bots season under rule A has one, then the first
  // later seed whose season under rule B does. (406-A and 410-B were pinned by a scan; since R4-4 neither has one.)
  // R8's re-pin (gap.jump 'alone', slime 10-19: "do 1 and 2"): the scan found 404-A and 406-B; now 419-A is the first and
  // 453-B the first later one, so it runs to 463.
  const sudoBreakin = (seed, rule) => {
    const open = new Set(makeCast(seed, CASTS.layer4).filter(OPEN).map(c => c.id));
    const { dir } = runSeason({ seed, rule, outDir: path.join(tmp, 'scan'), mix: { ...CASTS.models, models: 0 } });
    return events(dir).some(e => e.type === 'forced' && e.why === 'sudo' && open.has(e.agent) && e.play && e.play.kind === 'breakin');
  };
  const picks = [];
  for (let seed = 404; seed <= 463 && picks.length < 2; seed++) {
    const rule = picks.length ? 'B' : 'A';
    if (sudoBreakin(seed, rule)) picks.push([seed, rule]);
  }
  assert.equal(picks.length, 2, 'control: two seasons in 404-463 have such a night');
  for (const [seed, rule] of picks) {
    const open = makeCast(seed, CASTS.layer4).filter(OPEN).length;
    const m = await runModelSeason({ seed, rule, outDir: path.join(tmp, 'every'), mix: { ...CASTS.models, models: open }, wakes: () => true });
    const b = runSeason({ seed, rule, outDir: path.join(tmp, 'bots'), mix: { ...CASTS.models, models: 0 } });
    const [A, B] = [events(m.dir), events(b.dir)];
    const seats = new Set(checkpoint(m.dir).cast.filter(c => c.model).map(c => c.id));
    assert.equal(seats.size, open);
    assert.equal(A.length, B.length, `seed ${seed}: as many events`);
    // Nights the seat sent a play other than its bot's: those R2-7 named, each by its agent and day.
    const forcedNights = new Set(A.filter(e => e.type === 'forced' && ['crash', 'withdrawal'].includes(e.why) && seats.has(e.agent)).map(e => `${e.agent}#${e.day}`));
    // Who made a play goes on a model seat's records (§17; R2-1's `origin`, once it lands), never on a bot's: it is set
    // aside before comparing.
    const unsigned = e => {
      if (!seats.has(e.agent)) return e;
      const { origin, ...rest } = e;
      for (const k of ['play', 'instead']) if (rest[k] && typeof rest[k] === 'object') rest[k] = (({ origin: o, ...p }) => p)(rest[k]);
      return rest;
    };
    assert.ok(!B.some(e => 'origin' in e || (e.play && typeof e.play === 'object' && 'origin' in e.play)), 'no bot\'s play says who made it');
    const odd = [];
    for (let i = 0; i < A.length; i++) {
      const [a, x] = [unsigned(A[i]), B[i]];
      if (JSON.stringify(a) === JSON.stringify(x)) continue;
      const same = (p, q) => JSON.stringify(p) === JSON.stringify(q);
      if (a.type === 'season') {
        const bot = { ...a, agents: a.agents.map(g => (seats.has(g.id) ? { ...g, driver: 'bot' } : g)) };
        if (same(bot, x) && a.agents.every(g => g.driver === (seats.has(g.id) ? 'fake' : 'bot'))) continue;
      } else if (a.type === 'forced' && seats.has(a.agent) && ['crash', 'withdrawal'].includes(a.why)) {
        // The seat sent the default play the crash forced, not its bot's.
        if (same(a.play, a.instead) && same({ ...a, play: null }, { ...x, play: null })) { seen.forced += 1; continue; }
      } else if (a.type === 'play' && forcedNights.has(`${a.agent}#${a.day}`)) {
        if (a.reason === '' && same({ ...a, reason: null }, { ...x, reason: null })) continue;
      } else if (a.type === 'forced' && seats.has(a.agent) && a.why === 'sudo') {
        // The taker's own play, as sent: a break-in with the place its menu line fills in.
        const placeless = p => (p && p.kind === 'breakin' ? { ...p, place: undefined } : p);
        if (a.play.kind === 'breakin' && a.play.place === HOMES && x.play.place === undefined
          && same({ ...a, play: placeless(a.play) }, { ...x, play: placeless(x.play) })) { seen.sudo += 1; continue; }
      }
      odd.push({ i, models: a, bots: x });
    }
    assert.deepEqual(odd.slice(0, 3), [], `seed ${seed} rule ${rule}: ${odd.length} events differ beyond R2-7's`);
    assert.equal(m.metrics.ledger.failed, 0);
  }
  assert.ok(seen.forced > 0, `control: ${seen.forced} crash or withdrawal nights sent the default`);
  assert.ok(seen.sudo > 0, `control: ${seen.sudo} SUDO nights' break-ins took their menu line's place`);
});

test('a killed season resumes and finishes: killed after a night\'s checkpoint or in the middle of its write, the runner resumes from the checkpoint and the tape, answers the calls on the tape without calling again, each seat\'s call counter restored, and the log and the tape are the uninterrupted run\'s, byte for byte (§26; brief R2-8)', async () => {
  const { dir: whole } = await modelSeason(404, 'A', 4);
  for (const [point, taped] of [['mid-write:7', true], ['after-night:7', false]]) {
    const out = path.join(tmp, `kill-${point.replace(':', '-')}`);
    const args = ['--seed', '404', '--rule', 'A', '--cast', 'models', '--model-seats', '4', '--out', out, '--quiet'];
    const killed = await cli([...args, '--die-at', point]);
    assert.equal(killed.signal, 'SIGKILL', `expected a kill, got ${killed.status} ${killed.stderr}`);
    const resumed = await cli([...args, '--resume']);
    assert.equal(resumed.status, 0, resumed.stderr);
    const dir = path.join(out, '404-A');
    assert.ok(readLog(dir) === readLog(whole), `${point}: the resumed log is the uninterrupted one`);
    assert.ok(tapeOf(dir) === tapeOf(whole), `${point}: the tape too: no call made twice or lost`);
    const from = Number((resumed.stdout.match(/(\d+) from the tape/) || [])[1]);
    assert.equal(from > 0, taped, `${point}: ${from} calls answered from the tape`);
  }
});

test('a real endpoint\'s killed season resumes without calling it again: on the fake\'s HTTP endpoint (a port the system picks, with --go), killed mid-write and resumed, the endpoint is asked each call once and the log is the uninterrupted one; --stop-after stops a pilot at a night\'s checkpoint (brief R2-8, R2-10)', async () => {
  const run = async (name, ...extra) => {
    const fake = fakeModel({ script: () => FIRST_LINE });
    const { url, port } = await fake.listen();
    assert.ok(!TAKEN.includes(port), `port ${port}`);
    const out = path.join(tmp, `real-${name}`);
    const args = ['--seed', '405', '--rule', 'A', '--cast', 'models', '--model-seats', '3', '--model', 'test', '--model-url', url, '--go', 'a test: the fake stands in for the endpoint', '--out', out, '--quiet', '--stop-after', '3'];
    const first = await cli([...args, ...extra]);
    return { fake, url, out, args, first };
  };
  const whole = await run('whole');
  assert.equal(whole.first.status, 0, whole.first.stderr);
  await whole.fake.close();
  const dir = path.join(whole.out, '405-A');
  assert.equal(checkpoint(dir).state.day, 4, 'stopped at night 3\'s checkpoint');
  assert.equal(fs.existsSync(path.join(dir, 'result.json')), false, 'a stopped season writes no result');
  const killed = await run('killed', '--die-at', 'mid-write:2');
  assert.equal(killed.first.signal, 'SIGKILL', killed.first.stderr);
  const asked = killed.fake.calls.length;
  const resumed = await cli([...killed.args, '--resume']);
  assert.equal(resumed.status, 0, resumed.stderr);
  await killed.fake.close();
  assert.deepEqual(killed.fake.failures, [], 'never asked a call twice');
  assert.equal(killed.fake.calls.length, whole.fake.calls.length, 'each call asked once, over the kill');
  assert.ok(killed.fake.calls.length > asked, 'control: the resumed run called the endpoint for what was left');
  assert.ok(readLog(path.join(killed.out, '405-A')) === readLog(dir), 'the same log');
  const ck = checkpoint(path.join(killed.out, '405-A'));
  assert.equal(ck.models.url, killed.url, 'the run folder keeps the url');
  assert.ok([].concat(ck.models.go).includes('a test: the fake stands in for the endpoint'), 'and the go');
});

test('--replay replays a finished season from its tape with no model, on a manual clock: the same log byte for byte, and the recorded timeouts don\'t wait (brief R2-6, R2-8)', async () => {
  // A season with faults: some calls hang past the window, so its tape holds replies that never came.
  const hang = (seat, call) => (call % 7 === 3 ? { fault: 'hang' } : undefined);
  const { dir } = await modelSeason(406, 'B', 4, { script: hang });
  const tape = [...readTape(tapeOf(dir)).values()];
  const timeouts = tape.filter(l => l.reply === null).length;
  assert.ok(timeouts > 0, `control: ${timeouts} timeouts on the tape`);
  const out = path.join(tmp, 'replay');
  const started = Date.now();
  const r = await cli(['--replay', dir, '--out', out, '--quiet']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(Date.now() - started < N['gap.window'] * 1000, 'no window was waited out');
  assert.ok(readLog(path.join(out, '406-B')) === readLog(dir), 'the same log');
  const refused = await cli(['--replay', dir, '--out', path.dirname(dir), '--quiet']);
  assert.equal(refused.status, 2, 'a replay never writes over the season it replays');
});

test('the real endpoint\'s guard: --model-url without --go (or with empty words, or --go without --model-url) stops the runner with exit 2 before it writes anything or calls anyone; in-process, a url without a go is refused; the runner and the bench name no 8000 (CLAUDE.md: no model run without slime\'s go)', async () => {
  const fake = fakeModel({ script: () => FIRST_LINE });
  const { url } = await fake.listen();
  const base = ['--seed', '404', '--rule', 'A', '--cast', 'models', '--model-seats', '2', '--model', 'test', '--quiet'];
  for (const [i, extra] of [['--model-url', url], ['--model-url', url, '--go', ' '], ['--go', 'yes']].entries()) {
    const out = path.join(tmp, `guard-${i}`);
    const r = await cli([...base, ...extra, '--out', out]);
    assert.equal(r.status, 2, `${extra.join(' ')}: ${r.stderr}`);
    assert.match(r.stderr, /--go/);
    assert.equal(fs.existsSync(out), false, 'nothing written');
  }
  assert.equal(fake.calls.length, 0, 'nothing reached the endpoint');
  await fake.close();
  const { runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  const out = path.join(tmp, 'guard-in-process');
  const quiet = fakeModel({ script: () => FIRST_LINE });
  await assert.rejects(runModelSeason({ seed: 404, rule: 'A', outDir: out, mix: { ...CASTS.models, models: 2 }, url: IN_PROCESS, fetch: quiet.fetch, model: 'test' }), /go/);
  assert.equal(quiet.calls.length, 0);
  assert.equal(fs.existsSync(out), false);
  await quiet.close();
  for (const f of ['runner.mjs', 'bench.mjs']) assert.ok(!fs.readFileSync(path.join(core, 'bench', f), 'utf8').includes('8000'), `${f} names no 8000`);
});

test('stopping aborts the requests in flight: the wrapped fetch closes them when the run stops, so none stays queued at the model\'s server; the runner stops on SIGTERM, keeps no line for a call it cut off, and exits (the brain, 09-23)', async () => {
  const { stoppable } = await runnerModule();
  const fake = fakeModel({ script: () => ({ fault: 'hang' }) });
  const { url } = await fake.listen();
  const stop = new AbortController();
  const send = stoppable(fetch, stop.signal);
  const p = send(url, { method: 'POST', body: JSON.stringify({ messages: [] }), headers: { 'x-seat': 'a01', 'x-call': '1' } });
  p.catch(() => {});
  await until('the call to reach the fake', () => fake.calls.length === 1);
  assert.equal(fake.calls[0].outcome, 'pending');
  stop.abort();
  await assert.rejects(p);
  await until('the fake to see the request closed', () => fake.calls[0].outcome === 'none');
  // The runner: its first call hangs, and SIGTERM stops it.
  const out = path.join(tmp, 'stopped');
  let child;
  const done = cli(['--seed', '404', '--rule', 'A', '--cast', 'models', '--model-seats', '1', '--model', 'test', '--model-url', url, '--go', 'a test: the fake stands in for the endpoint', '--out', out, '--quiet'], { onSpawn: c => { child = c; } });
  await until('the runner\'s call', () => fake.calls.length === 2);
  child.kill('SIGTERM');
  const r = await done;
  assert.equal(r.signal, null, 'it stopped itself');
  assert.notEqual(r.status, 0, 'and says so');
  assert.match(r.stderr, /stopped/);
  await until('the runner\'s call to close', () => fake.calls[1].outcome === 'none');
  assert.equal(tapeOf(path.join(out, '404-A')), '', 'no tape line for the call it cut off');
  await fake.close();
});

test('every bot cast keeps its season report: layer1, layer2, trades, layer3 and layer4 on seed 404 under rule A give core/reports\' 404-A.md byte for byte (brief R2-8: the shared loop changes no bot cast)', async () => {
  const { runSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  for (const cast of ['layer1', 'layer2', 'trades', 'layer3', 'layer4']) {
    const { dir } = runSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, `report-${cast}`), mix: CASTS[cast] });
    const kept = path.join(core, 'reports', ...(cast === 'layer2' ? [] : [cast]), '404-A.md');
    assert.ok(fs.readFileSync(path.join(dir, 'report.md'), 'utf8') === fs.readFileSync(kept, 'utf8'), `${cast}: the report kept in ${path.relative(core, kept)}`);
  }
});

test('nothing a test here started is still open, so the file\'s process exits on its own', async () => {
  const extra = () => {
    const now = process.getActiveResourcesInfo();
    for (const x of OPEN_AT_START) {
      const i = now.indexOf(x);
      if (i >= 0) now.splice(i, 1);
    }
    return now;
  };
  for (let i = 0; i < 100 && extra().length; i++) await turn();
  assert.deepEqual(extra(), []);
});
