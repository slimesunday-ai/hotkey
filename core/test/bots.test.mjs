// The bench's bots for layer 1's intended paths (GAME.md §25): the squatter (the eviction exploit, opt-in), hired
// muscle (§12), the counter-hit that tells backing rule A from rule B (§8), and robbers valuing an evicted target by
// gap.evictedHit (§7, §10). Bots read the agent's view, the rulebook and their own memory, nothing else (§23).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Game, tierCopy } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { rng } from '../rng.mjs';
// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a night's wage is the take of the hustle the bot would take tonight (hustleChoice), where it was last night's work event's wage.
import {
  makeCast, makeBot, DEFAULT_MIX, HIRE, hireMuscle, muscleReplies, payMuscle, hitWorth, counterHit, usualGap, hustleChoice,
} from '../bench/bots.mjs';
import { runSeason } from '../bench/runner.mjs';
import { seasonMetrics, summarize } from '../bench/report.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-bots-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// --- the squatter ----------------------------------------------------------------------------------------------------

test('the squatter is opt-in, and takes one shift worker\'s slot: everyone else keeps id, trade, workplace and route', () => {
  assert.equal('squatter' in DEFAULT_MIX, false);
  for (const seed of [404, 405, 406]) {
    const plain = makeCast(seed);
    const squat = makeCast(seed, { ...DEFAULT_MIX, squatter: 1 });
    assert.equal(squat.length, plain.length);
    const changed = plain.filter((c, i) => JSON.stringify(c) !== JSON.stringify(squat[i]));
    assert.equal(changed.length, 1, `seed ${seed}: exactly one agent changes`);
    const i = plain.indexOf(changed[0]);
    assert.equal(plain[i].type, 'hustle');
    assert.equal(squat[i].type, 'squatter');
    assert.deepEqual({ ...squat[i], type: 'hustle' }, plain[i]);
  }
});

test('the squatter skips night 1, is evicted at dawn, never pays the rent back and never wears a rare (§10)', () => {
  const { dir } = runSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, 'squat'), mix: { ...DEFAULT_MIX, squatter: 1 } });
  const ck = JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8'));
  const log = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const q = ck.cast.find(c => c.type === 'squatter').id;
  const night1 = log.find(e => e.type === 'play' && e.agent === q && e.t === 3);
  assert.equal(night1.kind, 'laylow');
  const evicted = log.filter(e => e.type === 'evicted' && e.agent === q);
  assert.equal(evicted.length, 1, 'evicted once, and never home again');
  assert.equal(evicted[0].on, true);
  assert.equal(evicted[0].day, 2);
  assert.equal(log.filter(e => e.type === 'rent' && e.agent === q).length, 0);
  const tierOf = trait => ck.state.traits[trait].tier;
  for (const e of log.filter(x => x.type === 'wear' && x.agent === q)) {
    for (const trait of Object.values(e.fit)) assert.equal(tierOf(trait), 'common', `night ${e.day}: it wore ${trait}`);
  }
});

test('with --squatter, a run killed after night 7 and resumed gives the same log as an uninterrupted one', () => {
  const runner = path.join(here, '..', 'bench', 'runner.mjs');
  const run = (out, ...extra) => spawnSync(process.execPath, [runner, '--seed', '405', '--rule', 'B', '--out', out, '--quiet', '--squatter', ...extra], { encoding: 'utf8' });
  const logOf = out => fs.readFileSync(path.join(out, '405-B', 'events.jsonl'));
  const whole = path.join(tmp, 'whole');
  const killed = path.join(tmp, 'killed');
  assert.equal(run(whole).status, 0);
  assert.equal(run(killed, '--die-at', 'after-night:7').signal, 'SIGKILL');
  const resumed = run(killed, '--resume');
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.ok(logOf(killed).equals(logOf(whole)), 'the resumed log differs');
  const ck = JSON.parse(fs.readFileSync(path.join(whole, '405-B', 'checkpoint.json'), 'utf8'));
  assert.equal(ck.cast.filter(c => c.type === 'squatter').length, 1);
  assert.equal(ck.bench.options.squatter, 1);
});

// --- hired muscle (§12) ---------------------------------------------------------------------------------------------

const scout = { id: 'a01', type: 'scout', fav: 'docks', route: 'downtown' };
const worker = { id: 'a02', type: 'hustle', fav: 'docks', route: 'downtown' };
const apply = (g, by, errands) => {
  for (const { kind, ...fields } of errands) assert.equal(g.errand(by, kind, fields).ok, true, `${by} ${kind}`);
};
const ctx = (round, seed = 404) => ({ seed, round, rng: rng(seed, 'test', round) });

// a01, a robber with no brass knuckles, hires a02 to hit a03, who wears a rare and was seen at the docks last night.
function hiredJob(paySeed) {
  const g = new Game({ n: 3 });
  g.hand('a03', tierCopy(g.s, 'rare'), { wear: true });
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a03 is a filler seen and hit at the docks, so its first two nights pass the docks filler; the robber's price is a night's wage as it reckons it, the take of its hustle tonight (hustleChoice), where it was last night's work event's wage.
  const docks = { filler: { kind: 'hustle', place: 'docks' } };
  g.night({}, docks);
  g.grant('a01', 200);
  const wage = hustleChoice(g.view('a01')).take;
  const pay = wage + HIRE.premium;
  apply(g, 'a01', hireMuscle(g.view('a01'), ctx(1), scout, g.s.agents.a01.cash));
  assert.deepEqual(g.events('ask').map(e => [e.from, e.to]), [['a01', 'a02']], 'it asks the one agent it could hire');
  apply(g, 'a02', muscleReplies(g.view('a02'), worker));
  apply(g, 'a01', hireMuscle(g.view('a01'), ctx(2), scout, g.s.agents.a01.cash));
  apply(g, 'a02', muscleReplies(g.view('a02'), worker));
  const said = g.events('say').map(e => [e.from, e.say, e.terms]);
  assert.deepEqual(said, [
    ['a01', 'offer', { what: 'back', who: 'a01', night: 2, cash: pay }],
    ['a01', 'promise', { what: 'pay', who: 'a02', cash: pay, night: 2 }],
    ['a02', 'promise', { what: 'back', who: 'a01', night: 2 }],
  ]);
  const robber = makeBot(scout).night(g.view('a01'), ctx('night'));
  const muscle = makeBot(worker).night(g.view('a02'), ctx('night'));
  // R4-2 (gap.accept): the robber's play accepts the muscle that promised it, so its back joins the group.
  assert.deepEqual(robber.play, { kind: 'hit', target: 'a03', place: 'docks', want: g.s.agents.a03.outfit[Object.keys(g.s.agents.a03.outfit)[0]], accept: ['a02'] });
  assert.deepEqual(muscle.play, { kind: 'back', target: 'a01' });
  const r = g.night({ a01: robber.play, a02: muscle.play }, docks);
  const fight = r.fights.fights.find(f => f.target === 'a03');
  assert.deepEqual(fight.attackers.map(x => x.members), [['a01', 'a02']]);
  assert.equal(fight.winner, 'a01', 'two beat a lone target (§8)');
  apply(g, 'a01', payMuscle(g.view('a01'), ctx(1, paySeed)));
  g.night();
  g.night();
  return { g, pay };
}

const stiffs = seed => rng(seed, 'stiff', 'a01', 3)() < HIRE.stiff;

test('hired muscle: a robber that can\'t win alone hires through a typed sit-down, wins, and pays the cut (§12)', () => {
  const seed = Array.from({ length: 200 }, (_, i) => i + 1).find(x => !stiffs(x));
  const { g, pay } = hiredJob(seed);
  assert.deepEqual(g.events('pay').map(e => [e.from, e.to, e.amount, e.for]), [['a01', 'a02', pay, 'deal']]);
  assert.equal(g.events('betray').length, 0);
});

test('hired muscle: at HIRE.stiff\'s odds the robber keeps the cut, and the rules record a walk (§12)', () => {
  const seed = Array.from({ length: 200 }, (_, i) => i + 1).find(stiffs);
  const { g } = hiredJob(seed);
  assert.equal(g.events('pay').length, 0);
  assert.deepEqual(g.events('betray').map(e => [e.kind, e.by, e.victims]), [['walk', 'a01', ['a02']]]);
});

test('a robber with brass knuckles to wear doesn\'t hire, and an offer under last night\'s wage is turned down', () => {
  const g = new Game({ n: 3 });
  g.hand('a03', tierCopy(g.s, 'rare'), { wear: true });
  g.night();
  g.grant('a01', 200);
  const v = g.view('a01');
  const armed = { ...v, me: { ...v.me, pieces: [...v.me.pieces, { copy: 'x', trait: 'x', slot: 'hands', tier: 'common', ability: 'knuckles', worn: false }] } };
  assert.deepEqual(hireMuscle(armed, ctx(1), scout, 200), []);
  apply(g, 'a01', hireMuscle(v, ctx(1), scout, 200));
  apply(g, 'a02', muscleReplies(g.view('a02'), worker));
  const sd = g.events('meet')[0].sitdown;
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the muscle's wage is the take of its hustle tonight as it reckons it (hustleChoice), where it was last night's work event's wage.
  const wage = hustleChoice(g.view('a02')).take;
  apply(g, 'a01', [{ kind: 'say', sitdown: sd, say: 'offer', terms: { what: 'back', who: 'a01', night: 2, cash: wage - 1 } }]);
  assert.deepEqual(muscleReplies(g.view('a02'), worker), []);
});

// --- the counter-hit (§8: the move that tells rule A from rule B) -------------------------------------------------

const LEVELS = { downtown: 'heavy', strip: 'normal', industrial: 'normal', suburbs: 'normal', docks: 'normal', junkyard: 'lawless', mall: 'lawless', forest: 'lawless' };
const someone = (id, extra = {}) => ({ id, fit: [], evicted: false, jailed: false, boarded: false, crew: null, heat: 0, wanted: false, ...extra });
// a05 bought a rare (public sale) and works nights at the docks; crew c1 (a01 founded it) struck on nights 2 and 5.
function crewWatch({ day = 8, sales = [{ agent: 'a05', trait: 'tr' }, { agent: 'a06', trait: 'tc' }], robbedBy = {} } = {}) {
  const v = {
    day,
    me: { id: 'a05', wanted: false },
    board: {
      tonight: LEVELS,
      crews: [{ id: 'c1', name: 'c1', members: ['a01', 'a02', 'a03'] }],
      agents: [someone('a01', { crew: 'c1' }), someone('a02', { crew: 'c1' }), someone('a03', { crew: 'c1' }), someone('a05'), someone('a06'), someone('a07')],
      sales,
      list: [{ trait: 'tc', tier: 'common', price: 100, last: null }, { trait: 'tr', tier: 'rare', price: 500, last: null }],
    },
    sightings: { a05: [{ night: 7, place: 'docks' }], a06: [{ night: 7, place: 'industrial' }], a07: [{ night: 7, place: 'industrial' }] },
    events: [],
  };
  const memo = { heat: { 2: ['a01', 'a02', 'a03'], 5: ['a01', 'a02', 'a03', 'a06'] }, robbedBy, founders: { c1: 'a01' } };
  return { v, memo };
}

test('counter-hit: on the crew\'s next beat, the richest home it can reach hits a crew member who isn\'t its leader, in Pleasantview', () => {
  const { v, memo } = crewWatch();
  const c = counterHit(v, memo, rng(1, 'counter'));
  assert.equal(c.play.kind, 'hit');
  assert.equal(c.play.place, 'suburbs', 'burglars and their backers are out in Pleasantview (gap.burglarPlace)');
  assert.ok(['a02', 'a03'].includes(c.play.target), `not the founder: ${c.play.target}`);
  const known = crewWatch({ robbedBy: { 5: 'a02' } });
  assert.ok(['a01', 'a03'].includes(counterHit(known.v, known.memo, rng(1, 'counter')).play.target), 'the one who robbed it last is the leader');
});

test('counter-hit: not off the beat, not when another home is richer, not in a three-way tie at the top', () => {
  const off = crewWatch({ day: 7 });
  assert.equal(counterHit(off.v, off.memo, rng(1, 'counter')), null);
  const poorer = crewWatch({ sales: [{ agent: 'a05', trait: 'tc' }, { agent: 'a06', trait: 'tr' }] });
  assert.equal(counterHit(poorer.v, poorer.memo, rng(1, 'counter')), null);
  const tie = crewWatch({ sales: [{ agent: 'a05', trait: 'tr' }, { agent: 'a06', trait: 'tr' }, { agent: 'a07', trait: 'tr' }] });
  assert.equal(counterHit(tie.v, tie.memo, rng(1, 'counter')), null);
  assert.equal(usualGap([2, 5, 8]), 3);
  assert.equal(usualGap([2, 5, 6]), 1, 'a tie between gaps goes to the shorter');
});

// --- robbers value an evicted target by gap.evictedHit (§7, §10) --------------------------------------------------

test('a robber values a hit on an evicted agent by what gap.evictedHit says it takes, from public facts only', () => {
  const v = {
    board: { list: [{ trait: 'tc', tier: 'common', price: 100, last: null }, { trait: 'tr', tier: 'rare', price: 500, last: null }] },
    events: [{ type: 'holdings', agent: 'a09', cash: 101, pieces: [{ copy: 'k2', trait: 'tr', tier: 'rare' }] }],
  };
  const evicted = someone('a09', { evicted: true, fit: [{ copy: 'k1', trait: 'tc', tier: 'common' }] });
  const was = N['gap.evictedHit'];
  try {
    N['gap.evictedHit'] = 'worn + half cash';
    assert.deepEqual(hitWorth(v, evicted), { value: 100 + 50, want: evicted.fit[0] });
    N['gap.evictedHit'] = 'carried + half cash';
    assert.deepEqual(hitWorth(v, evicted), { value: 500 + 50, want: v.events[0].pieces[0] });
  } finally {
    N['gap.evictedHit'] = was;
  }
  const housed = someone('a08', { fit: [{ copy: 'k3', trait: 'tc', tier: 'common' }] });
  assert.deepEqual(hitWorth(v, housed), { value: 100, want: housed.fit[0] }, 'an agent with a home: what it wears');
  const unseen = someone('a10', { evicted: true });
  assert.deepEqual(hitWorth(v, unseen), { value: 0, want: null }, 'no public record yet: nothing known to take');
});

// --- the report's new numbers -----------------------------------------------------------------------------------------

test('the report: shift workers and wage a night, the squatter\'s rank, hired-muscle deals, and rule A against rule B', () => {
  const cast = [
    { id: 'a01', type: 'hustle', name: 'a' }, { id: 'a02', type: 'squatter', name: 'b' }, { id: 'a03', type: 'hustle', name: 'c' },
    { id: 'a04', type: 'scout', name: 'd' }, { id: 'a05', type: 'crew', name: 'e' },
  ];
  const state = { agents: Object.fromEntries(cast.map(c => [c.id, {}])), copies: {}, money: { in: {}, out: {} } };
  const mint = (agent, mainland) => ({ type: 'mint', agent, mainland, cards: [] });
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): each work
  // event (a wage, its agents) is now one hustle event an agent, its take each. The report reads hustlers a night over the
  // 13 nights a hustle is legal (metrics.mjs hustleMetrics), where the shift's work event came every night, so nights 4-13
  // list two hustlers at $45 each, and the medians stay 2 a night and $45; the take's is m.hustles.take, where it was m.wage.
  const hustle = (night, agent, take) => ({ type: 'hustle', night, agent, take });
  const log = [
    hustle(1, 'a01', 40), hustle(1, 'a02', 40),
    hustle(2, 'a01', 50),
    hustle(3, 'a01', 45), hustle(3, 'a02', 45), hustle(3, 'a03', 45),
    ...Array.from({ length: N.nights - 4 }, (_, i) => [hustle(i + 4, 'a01', 45), hustle(i + 4, 'a02', 45)]).flat(),
    { type: 'say', say: 'promise', from: 'a01', to: 'a04', terms: { what: 'back', night: 2 } },
    { type: 'say', say: 'promise', from: 'a05', to: 'a04', terms: { what: 'back', night: 2 } },
    { type: 'pay', from: 'a04', to: 'a01', amount: 65, for: 'deal' },
    mint('a01', 300), mint('a02', 200), mint('a03', 200), mint('a04', 100), mint('a05', 50),
  ];
  const bench = { seed: 1, rule: 'A', midseason: 'payday', nights: [] };
  const m = seasonMetrics(state, log, bench, cast);
  assert.equal(m.hustleWorkers, 2);
  assert.equal(m.hustles.take, 45);
  assert.deepEqual(m.squatters, [{ id: 'a02', haul: 200, rank: 2 }], 'tied with a03 below a01: 1 + the agents strictly ahead');
  assert.equal(m.hires.deals, 1, 'a crew member backing a robber is not hired muscle');
  assert.equal(m.hires.paid, 1);
  const twin = (seed, rule, outcome) => ({ ...m, seed, rule, outcome });
  const sum = summarize([twin(1, 'A', 7), twin(1, 'B', 7), twin(2, 'A', 7), twin(2, 'B', 8)]);
  assert.deepEqual(sum.ruleDiff, { seeds: 2, differ: 1 });
});
