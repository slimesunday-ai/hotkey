// The briefing arm (runner.mjs, --briefing current|legacy): the paired briefing experiment's full model seasons give
// every model seat either the current briefing (agents/briefing.mjs, the default) or the frozen legacy formatter
// (bench/fixtures/legacy-briefing.mjs), called with the same arguments, everything else identical: the tools, the
// rules, memory and settlement stay the current ones (HANDBACK-PAID-FIXES.md; the audit's review, §4: "Apply semantic
// tool fixes equally to both arms"). The run folder keeps the arm, a resume must name it, a replay plays it, and the
// bench never certifies or pools one arm's seasons as the other's. Nothing here calls a model: every model seat talks
// to the runner's in-process fake. Each test imports the runner itself, so each fails on its own before the code
// exists.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { read } from '../agents/tools.mjs';
import { present } from '../agents/handles.mjs';
import { briefing as currentBriefing } from '../agents/briefing.mjs';
import { briefing as legacyBriefing } from '../bench/fixtures/legacy-briefing.mjs';
import { readTape } from '../agents/fake-model.mjs';

const runnerModule = () => import('../bench/runner.mjs');
const botsModule = () => import('../bench/bots.mjs');
const evidenceModule = () => import('../bench/evidence.mjs');
const passbarsModule = () => import('../bench/passbars.mjs');
const here = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(here, '..', 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'briefing-arm-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const FORMATS = { legacy: legacyBriefing, current: currentBriefing };
// The models season every test plays: seed 404 under rule A, four seats the fake plays.
const SEASON = ['--seed', '404', '--rule', 'A', '--cast', 'models', '--model-seats', '4', '--quiet'];
const text = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const checkpoint = dir => JSON.parse(text(dir, 'checkpoint.json'));
const tapeOf = dir => readTape(text(dir, 'tape.jsonl'));
// The runner on its own command line. Nothing in this process answers it: its fake is its own, in-process.
const cli = args => spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8' });
// A one-night pilot on the command line, into its own folder: the season's folder.
function pilot(name, ...extra) {
  const out = path.join(tmp, name);
  const r = cli([...SEASON, '--stop-after', '1', '--out', out, ...extra]);
  assert.equal(r.status, 0, r.stderr);
  return path.join(out, '404-A');
}

// A one-night models season on the in-process fake, with each model seat's first view kept: its round-1 view of day 1,
// which its first call was briefed from. The runner's own wake-ups decide, as in every season.
async function oneNight(name, more = {}) {
  const { runModelSeason, wakes } = await runnerModule();
  const { CASTS } = await botsModule();
  const first = new Map();
  const spy = (view, round) => {
    if (!first.has(view.me.id)) first.set(view.me.id, structuredClone(view));
    return wakes(view, round);
  };
  const r = await runModelSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, name), mix: { ...CASTS.models, models: 4 }, stopAfter: 1, wakes: spy, ...more });
  return { ...r, first };
}

// A seat's first call as a formatter briefs it (seat.mjs's call point, call 1): its first view read for the seat with
// the season's secret from handle 1, its game-held memory, no results yet, and a day's call.
function firstBriefing(format, view, secret) {
  const { deal, result } = read(view, { audience: 'seat', seed: secret, from: 1 });
  const memory = Object.hasOwn(view.me, 'memory') ? view.me.memory : undefined;
  return format(result, { memory, last: present(deal, []), call: 'round' });
}

test('a one-night models season on the fake under --briefing legacy sends the legacy formatter\'s messages, and without the flag the current one\'s; only the text changes: the same calls, the same requests but their messages, the same replies and the same season', async () => {
  const runs = { legacy: await oneNight('in-legacy', { briefing: 'legacy' }), current: await oneNight('in-current') };
  const tapes = {};
  for (const [arm, r] of Object.entries(runs)) {
    assert.equal(r.stopped, 1, `${arm}: a one-night pilot`);
    const secret = checkpoint(r.dir).models.secret;
    const tape = tapeOf(r.dir);
    tapes[arm] = tape;
    assert.equal(r.first.size, 4, `${arm}: every model seat was called`);
    const other = arm === 'legacy' ? 'current' : 'legacy';
    for (const [id, view] of r.first) {
      const sent = tape.get(`${id}#1`).request.messages;
      assert.deepEqual(sent, firstBriefing(FORMATS[arm], view, secret), `${arm}: ${id}'s first call is the ${arm} formatter's messages, byte for byte`);
      assert.notDeepEqual(sent, firstBriefing(FORMATS[other], view, secret), `control: the ${other} formatter briefs ${id} otherwise`);
    }
    for (const l of tape.values()) {
      assert.equal(l.request.messages[0].content, tape.get(`${l.seat}#1`).request.messages[0].content, `${arm}: ${l.seat}'s call ${l.call} has the same formatter's header`);
    }
  }
  assert.deepEqual([...tapes.legacy.keys()].sort(), [...tapes.current.keys()].sort(), 'the same calls');
  assert.ok(tapes.legacy.size >= 8, `control: ${tapes.legacy.size} calls, a day's and the lock's for each seat`);
  for (const [key, l] of tapes.legacy) {
    const c = tapes.current.get(key);
    const { messages: lm, ...lr } = l.request;
    const { messages: cm, ...cr } = c.request;
    assert.deepEqual(lr, cr, `${key}: the same request but its messages`);
    assert.notDeepEqual(lm, cm, `${key}: the legacy briefing`);
    assert.deepEqual(l.reply.body.choices, c.reply.body.choices, `${key}: the same reply, which the same tools read`);
  }
  assert.ok(text(runs.legacy.dir, 'events.jsonl') === text(runs.current.dir, 'events.jsonl'), 'the same season: the rules and settlement did the same');
  // On the command line: --briefing legacy is the legacy season and no flag the current one, call for call.
  assert.ok(text(pilot('cli-legacy', '--briefing', 'legacy'), 'tape.jsonl') === text(runs.legacy.dir, 'tape.jsonl'), 'the flag sends the legacy messages');
  assert.ok(text(pilot('cli-current'), 'tape.jsonl') === text(runs.current.dir, 'tape.jsonl'), 'no flag sends the current ones');
  assert.ok(text(pilot('cli-named', '--briefing', 'current'), 'tape.jsonl') === text(runs.current.dir, 'tape.jsonl'), '--briefing current is the default');
  const wrong = cli([...SEASON, '--stop-after', '1', '--out', path.join(tmp, 'cli-wrong'), '--briefing', 'neutral']);
  assert.equal(wrong.status, 2);
  assert.match(wrong.stderr, /--briefing takes current or legacy, not neutral/);
  const bots = cli(['--seed', '404', '--rule', 'A', '--cast', 'layer4', '--quiet', '--out', path.join(tmp, 'cli-bots'), '--briefing', 'legacy']);
  assert.equal(bots.status, 2, 'a bot cast reads no briefing');
  assert.match(bots.stderr, /--briefing go with --cast models/);
  assert.equal(fs.existsSync(path.join(tmp, 'cli-wrong')) || fs.existsSync(path.join(tmp, 'cli-bots')), false, 'refused before anything is written');
});

test('the arm is in the run folder\'s checkpoint, with the model, the API and the cap and in the season\'s setup and provenance; a resume with another arm is refused before anything is written, in-process too, and one with the same arm plays on', async () => {
  const legacy = pilot('resume-legacy', '--briefing', 'legacy');
  const current = pilot('resume-current');
  const ck = checkpoint(legacy);
  assert.equal(ck.models.briefing, 'legacy', 'kept where the model, the API and the cap are');
  assert.equal(ck.bench.options.briefing, 'legacy', "in the season's setup");
  assert.equal(ck.bench.provenance.config.options.briefing, 'legacy', 'so in its provenance');
  const cc = checkpoint(current);
  assert.ok(!('briefing' in cc.models) && !('briefing' in cc.bench.options), 'the current arm, the default, is recorded as before: by no arm');
  const folder = dir => ['checkpoint.json', 'events.jsonl', 'tape.jsonl'].map(f => text(dir, f));
  const refusals = [
    [legacy, [], /this season's briefing is legacy: resume it with --briefing legacy/],
    [legacy, ['--briefing', 'current'], /this season's briefing is legacy: resume it with --briefing legacy/],
    [current, ['--briefing', 'legacy'], /this season's briefing is current: resume it without --briefing/],
  ];
  for (const [dir, extra, why] of refusals) {
    const before = folder(dir);
    const r = cli([...SEASON, '--out', path.dirname(dir), '--resume', ...extra]);
    assert.equal(r.status, 2, `${extra.join(' ') || 'no flag'}: ${r.stderr}`);
    assert.match(r.stderr, why);
    assert.deepEqual(folder(dir), before, 'nothing written');
  }
  const { runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  const before = folder(legacy);
  await assert.rejects(runModelSeason({ seed: 404, rule: 'A', outDir: path.dirname(legacy), mix: { ...CASTS.models, models: 4 }, resume: true, briefing: 'current' }), e => e.refused === true && /briefing is legacy/.test(e.message));
  assert.deepEqual(folder(legacy), before, 'nothing written in-process either');
  const on = cli([...SEASON, '--out', path.dirname(legacy), '--resume', '--briefing', 'legacy', '--stop-after', '2']);
  assert.equal(on.status, 0, on.stderr);
  assert.equal(checkpoint(legacy).state.day, 3, "played on to night 2's checkpoint");
  assert.equal(checkpoint(legacy).models.briefing, 'legacy', 'its arm kept');
  const tape = tapeOf(legacy);
  assert.ok([...tape.keys()].some(k => Number(k.split('#')[1]) > 2), 'control: night 2 called the seats again');
  for (const l of tape.values()) {
    const header = l.request.messages[0].content;
    assert.equal(header, tape.get(`${l.seat}#1`).request.messages[0].content, `${l.seat}'s call ${l.call}: the resumed nights brief as the first did`);
    assert.ok(header.includes('tab paid at dock.') && !header.includes('charged automatically'), `${l.seat}'s call ${l.call}: the legacy rules text`);
  }
  // A twin for the legacy arm (the same cast, no model seat) carries the arm too, and keeps it.
  const twin = path.join(tmp, 'resume-twin');
  const twinSeason = ['--seed', '404', '--rule', 'A', '--cast', 'models', '--model-seats', '0', '--quiet', '--out', twin];
  assert.equal(cli([...twinSeason, '--stop-after', '1', '--briefing', 'legacy']).status, 0);
  const twinDir = path.join(twin, '404-A');
  assert.equal(checkpoint(twinDir).bench.options.briefing, 'legacy');
  const twinFiles = () => ['checkpoint.json', 'events.jsonl'].map(f => text(twinDir, f));
  const twinBefore = twinFiles();
  const resumed = cli([...twinSeason, '--resume']);
  assert.equal(resumed.status, 2, resumed.stderr);
  assert.match(resumed.stderr, /this season's briefing is legacy: resume it with --briefing legacy/);
  assert.deepEqual(twinFiles(), twinBefore, 'nothing written');
});

test('--replay plays the arm its run folder recorded: the same log, the arm kept in the new folder, and its tape refuses the same folder with the arm struck; a replay takes no --briefing', () => {
  const src = pilot('replay-legacy', '--briefing', 'legacy');
  const out = path.join(tmp, 'replayed');
  const r = cli(['--replay', src, '--out', out, '--quiet']);
  assert.equal(r.status, 0, r.stderr);
  const dir = path.join(out, '404-A');
  assert.ok(text(dir, 'events.jsonl') === text(src, 'events.jsonl'), 'the same log');
  assert.equal(checkpoint(dir).models.briefing, 'legacy', 'the replay keeps its arm');
  assert.equal(checkpoint(dir).bench.options.briefing, 'legacy', 'in its setup too');
  // The tape holds the legacy requests: replayed with the current briefing, they're not the ones on the tape.
  const struck = path.join(tmp, 'struck', '404-A');
  fs.cpSync(src, struck, { recursive: true });
  const ck = checkpoint(struck);
  delete ck.models.briefing;
  delete ck.bench.options.briefing;
  fs.writeFileSync(path.join(struck, 'checkpoint.json'), JSON.stringify(ck));
  const bad = cli(['--replay', struck, '--out', path.join(tmp, 'struck-replayed'), '--quiet']);
  assert.notEqual(bad.status, 0, 'control: the arm is what the tape replays');
  assert.match(bad.stderr, /differs from the tape/);
  const flagged = cli(['--replay', src, '--out', path.join(tmp, 'flagged'), '--briefing', 'legacy', '--quiet']);
  assert.equal(flagged.status, 2);
  assert.match(flagged.stderr, /a replay takes its season from the run folder, not --briefing/);
});

test('the bench never certifies a legacy-arm season against a current-arm twin, nor pools the two arms: the twin check compares the arm, each arm pairs with its own twin, and a count over both arms is refused', async () => {
  const { runSeason, runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  const { twinValidation, briefingOf } = await evidenceModule();
  const { pairSeasons, acrossSeasons } = await passbarsModule();
  const mix = n => ({ ...CASTS.models, models: n });
  const at = name => path.join(tmp, `pair-${name}`);
  const twin = runSeason({ seed: 404, rule: 'A', outDir: at('twin'), mix: mix(0) }).metrics;
  const legacyTwin = (await runModelSeason({ seed: 404, rule: 'A', outDir: at('legacy-twin'), mix: mix(0), briefing: 'legacy' })).metrics;
  const current = (await runModelSeason({ seed: 404, rule: 'A', outDir: at('current'), mix: mix(4) })).metrics;
  const legacy = (await runModelSeason({ seed: 404, rule: 'A', outDir: at('legacy'), mix: mix(4), briefing: 'legacy' })).metrics;
  assert.deepEqual([legacy, legacyTwin, current, twin].map(briefingOf), ['legacy', 'legacy', 'current', 'current'], 'each season carries its arm in its provenance');
  assert.equal(legacy.seasonKey, current.seasonKey, 'control: on the fake both arms play the same record, so only the arm tells them apart');
  assert.equal(twinValidation(current, twin).status, 'verified', 'control: the current arm and its twin');
  assert.equal(twinValidation(legacy, legacyTwin).status, 'verified', 'the legacy arm and its own twin');
  for (const [m, b] of [[legacy, twin], [current, legacyTwin]]) {
    const v = twinValidation(m, b);
    assert.equal(v.status, 'invalid', `a ${briefingOf(m)} season against a ${briefingOf(b)} twin`);
    assert.ok(v.reasons.includes('briefing arm'), JSON.stringify(v.reasons));
  }
  const unknown = twinValidation(legacy, { ...twin, provenance: null });
  assert.equal(unknown.status, 'invalid', 'a twin from before the arm was recorded played the current one');
  const [own] = pairSeasons([legacy], [twin, legacyTwin]);
  assert.equal(own.validation.status, 'verified', 'the legacy season pairs with its own twin');
  assert.deepEqual(own.bots, legacy.modelSeats.map(id => legacyTwin.haul[id]));
  assert.equal(pairSeasons([legacy], [twin])[0].bots, null, 'and with no current-arm twin');
  assert.throws(() => acrossSeasons([legacy, current], { twins: [twin, legacyTwin] }), /different briefings \(current, legacy\)/);
  const row = acrossSeasons([legacy], { twins: [twin, legacyTwin] }).rows.find(x => x.key === 'models');
  assert.equal(row.cells.at(-1).n, 1, "one arm's seasons, paired with its own twin");
  assert.equal(row.cells.at(-1).provenance.verified, 1);
});
