// L3-5a, the drugs in play (GAME.md §11, §19, §25, §27). The layer3 cast is the trades cast with the six drugs in play:
// Chemists cook all six to the demand they can see and sell them in typed sit-downs, and every seat takes a drug only
// for its reason, from its own view. The report counts the drugs and §27's drug bar ("every drug gets taken at least
// once a season, and someone gets hooked"). Each test imports what it needs itself, so each fails on its own before the
// cast exists. Amounts come from N or the bots' settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { N } from '../numbers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(here, '..', 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-drug-bots-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const bots = () => import('../bench/bots.mjs');
const readLog = dir => fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const ROBBERS = ['scout', 'guess'];
const ATTACKS = ['hit', 'breakin', 'grab'];
const MUSCLE = ['hustle', 'buylate', 'turtle'];

// Day 0 of a season with the layer3 cast, at a day of our choosing, and each agent's view of it.
async function world(seed, day) {
  const { newSeason, viewFor } = await import('../index.mjs');
  const { loadItems } = await import('../bench/runner.mjs');
  const { makeCast, CASTS } = await bots();
  const cast = makeCast(seed, CASTS.layer3);
  const r = newSeason({ seed, rule: 'A', midseason: 'payday', items: loadItems(), agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  const s = r.state;
  s.day = day;
  s.clock = 2 * day;
  const log = [...r.events];
  return { s, log, cast, seat: id => ({ ...cast.find(c => c.id === id), every: true }), view: id => viewFor(s, log, id, 'agent') };
}
const holdTier = (s, id, tier) => {
  const k = Object.keys(s.copies).sort().find(x => s.copies[x].tier === tier && s.copies[x].holder.k === 'list');
  s.copies[k].holder = { k: 'agent', id };
  return k;
};

test("the layer3 cast: the trades cast's seats, every one playing the drugs; the seed deals one robber a TEMP habit and one seat that works the Chemist trade SUDO (§11, §25)", async () => {
  const { makeCast, CASTS } = await bots();
  const { mixOf, castName, parseArgs, BENCH_ARGS, RUNNER_ARGS } = await import('../bench/runner.mjs');
  assert.ok(CASTS.layer3, 'a cast called layer3');
  assert.equal(mixOf({ cast: 'layer3' }), CASTS.layer3);
  assert.equal(castName(CASTS.layer3), 'layer3');
  for (const known of [BENCH_ARGS, RUNNER_ARGS]) assert.deepEqual(parseArgs(['--cast', 'layer3'], known), { cast: 'layer3', set: [] });
  const roles = new Set();
  for (const seed of [404, 405, 406, 407]) {
    const cast = makeCast(seed, CASTS.layer3);
    const seat = ({ drugs, habit, sudo, ...rest }) => rest;
    assert.deepEqual(cast.map(seat), makeCast(seed, CASTS.trades), `seed ${seed}: the trades cast's seats, ids, strategies and trades`);
    assert.ok(cast.every(c => c.drugs === true), 'every seat plays the drugs');
    const habit = cast.filter(c => c.habit);
    assert.equal(habit.length, 1);
    assert.equal(habit[0].habit, 'temp');
    assert.ok(ROBBERS.includes(habit[0].type), `the habit is a robber's, not a ${habit[0].type}'s`);
    const sudo = cast.filter(c => c.sudo);
    assert.equal(sudo.length, 1);
    assert.ok(sudo[0].trade === 'chemist' && (sudo[0].type === 'chemist' || sudo[0].works), 'SUDO is sold by a seat that works the Chemist trade');
    assert.deepEqual(makeCast(seed, CASTS.layer3), cast, 'the same seed, the same cast');
    roles.add(`${habit[0].id} ${sudo[0].id}`);
  }
  assert.ok(roles.size > 1, 'the seed deals the roles');
  for (const name of ['trades', 'layer2', 'layer1']) {
    assert.ok(makeCast(404, CASTS[name]).every(c => !('drugs' in c) && !('habit' in c) && !('sudo' in c)), `the ${name} cast plays no drugs`);
  }
});

test('what each seat wants on hand, from its own view: TEMP for a robber its own strength cannot win with, CLEAR once it has a star, HALLU when broke and strong enough to act on a lead, TRUTH before a job, FIREWALL for the last three days with an epic, the habit\'s stock (§11)', async () => {
  const { drugWants, DOSES } = await bots();
  const w = await world(404, 2);
  // Seats whose trade starts with no doses and no gun (§38's kits), so their strength and stock are their own.
  const [id, other] = w.cast.filter(c => c.type !== 'crew' && !Object.keys(N.kits[c.trade]).length).map(c => c.id);
  const robber = { type: 'scout', trade: 'smuggler' };
  // Day 2: commons are on the list and it has no cash, so it's broke; no knuckles, no gun: strength 1.
  assert.deepEqual(drugWants(w.view(id), robber), { temp: 1 });
  w.s.agents[id].goods.temp = 1;
  assert.deepEqual(drugWants(w.view(id), robber), { hallu: 1 }, 'with a TEMP in its pocket it could act on a lead: the gamble');
  w.s.agents[id].heat = DOSES.keep;
  assert.deepEqual(drugWants(w.view(id), robber), { hallu: 1, clear: 1 });
  const cheapest = Math.min(...w.view(id).board.list.filter(t => t.opens <= w.s.day && t.left > 0).map(t => t.price));
  w.s.agents[id].cash = cheapest;
  assert.deepEqual(drugWants(w.view(id), robber), { clear: 1 }, 'not broke: it can buy a piece');
  assert.deepEqual(drugWants(w.view(id), { ...robber, habit: 'temp' }), { temp: DOSES.habit - 1, clear: 1 }, 'the habit keeps its stock');
  assert.deepEqual(drugWants(w.view(id), { type: 'hustle', trade: 'cop' }), {}, 'a shift worker wants none');
  w.s.agents[id].jail = { nights: N.jailNights, stars: 1, since: 1 };
  assert.deepEqual(drugWants(w.view(id), robber), {}, 'nothing ordered from jail');
  // A crew member before its job; a holder of an epic before the last three days.
  const crew = w.cast.find(c => c.type === 'crew' && c.role === 'member');
  for (const day of [1, 2, 3]) {
    w.s.day = day;
    w.s.clock = 2 * day;
    assert.deepEqual(drugWants(w.view(crew.id), crew), { truth: 1 }, `day ${day}: a job is due within ${DOSES.ahead} days`);
  }
  holdTier(w.s, other, 'epic');
  w.s.day = DOSES.from - DOSES.ahead;
  w.s.clock = 2 * w.s.day;
  assert.equal(drugWants(w.view(other), { type: 'hustle', trade: 'cop' }).firewall, N.nights - DOSES.from + 1, 'one FIREWALL for each of the last three days');
  w.s.day -= 1;
  w.s.clock = 2 * w.s.day;
  assert.equal(drugWants(w.view(other), { type: 'hustle', trade: 'cop' }).firewall, undefined);
});

test("TRUTH locks only a play the agent can make tonight: a crew member backs its leader on a job day, and takes none when a crash leaves it only the lay low (§11, gap.truth)", async () => {
  const { truthPlay } = await bots();
  const w = await world(405, 2);
  const crew = w.cast.find(c => c.type === 'crew' && c.role === 'member' && !c.snake);
  w.s.agents[crew.id].goods.truth = 1;
  const ctx = { seed: 405, round: 1, rounds: 3 };
  assert.deepEqual(truthPlay(w.view(crew.id), ctx, crew), { kind: 'back', target: crew.leader });
  assert.ok(w.view(crew.id).legal.some(l => l.kind === 'back' && l.target === crew.leader));
  w.s.agents[crew.id].crash = true;
  assert.ok(!w.view(crew.id).legal.some(l => l.kind === 'back'), 'a crash leaves only the default play');
  assert.equal(truthPlay(w.view(crew.id), ctx, crew), null);
  w.s.agents[crew.id].crash = false;
  w.s.day = 3;
  w.s.clock = 6;
  assert.equal(truthPlay(w.view(crew.id), ctx, crew), null, 'no job tonight');
  // Hired muscle backs whoever it promised to back today.
  const muscle = w.cast.find(c => MUSCLE.includes(c.type));
  w.s.agents[muscle.id].goods.truth = 1;
  const done = [{ kind: 'say', sitdown: 's1', say: 'promise', terms: { what: 'back', who: crew.leader, night: w.s.day } }];
  assert.deepEqual(truthPlay(w.view(muscle.id), ctx, w.seat(muscle.id), done), { kind: 'back', target: crew.leader });
  assert.equal(truthPlay(w.view(muscle.id), ctx, w.seat(muscle.id), []), null, 'no promise, no TRUTH');
});

test('FIREWALL is for a holder of an epic or a grail on the last three days, whose walk will show it guarded (§11, gap.firewall, gap.high)', async () => {
  const { firewallDay, DOSES } = await bots();
  const w = await world(406, DOSES.from);
  const [id, rare] = w.cast.map(c => c.id);
  holdTier(w.s, id, 'epic');
  holdTier(w.s, rare, 'rare');
  for (const x of [id, rare]) w.s.agents[x].goods.firewall = 1;
  assert.equal(firewallDay(w.view(id)), true);
  assert.equal(firewallDay(w.view(rare)), false, 'a rare is not worth it');
  w.s.agents[id].high = ['temp'];
  assert.equal(firewallDay(w.view(id)), false, "TEMP's walk would hide that it's guarded");
  w.s.agents[id].high = [];
  w.s.day = DOSES.from - 1;
  w.s.clock = 2 * w.s.day;
  assert.equal(firewallDay(w.view(id)), false, 'not before the last three days');
});

test('CLEAR is for a hit where cops could come: a district that is not lawless, or one the Cops patrolled on the latest public night (§8, §11, §13)', async () => {
  const { copsCouldCome } = await bots();
  const w = await world(407, 5);
  const level = lv => Object.keys(N.levels).find(d => N.levels[d] === lv);
  const id = w.cast[0].id;
  assert.equal(copsCouldCome(w.view(id), level('normal')), true);
  assert.equal(copsCouldCome(w.view(id), level('heavy')), true);
  assert.equal(copsCouldCome(w.view(id), level('lawless')), false);
  const cop = w.cast.find(c => c.trade === 'cop').id;
  const night = w.s.day - 2;
  w.log.push({ n: w.log.length + 1000, t: 2 * night + 1, day: night, type: 'play', agent: cop, kind: 'patrol', place: level('lawless'), reason: '', vis: { to: [cop], pub: 2 * night + 3 } });
  assert.equal(copsCouldCome(w.view(id), level('lawless')), true, 'a patrol stood there on the latest public night');
});

test("Chemists cook to the demand they see: an order they couldn't fill is tonight's batch, SUDO for its seller once a mark shows, and HALLU's two lies (the Chemist has nothing, a rival has the most) pass the rules (§9, §11, gap.hallu)", async () => {
  const { cookDrug, halluLies, DOSES } = await bots();
  const { checkPlay } = await import('../index.mjs');
  const w = await world(408, 4);
  const chem = w.cast.find(c => c.type === 'chemist' && !c.sudo);
  const cfg = w.seat(chem.id);
  const buyer = w.cast.find(c => ROBBERS.includes(c.type)).id;
  assert.equal(cookDrug(w.view(chem.id), cfg, {}), null, 'no orders: TEMP for the Dealers');
  assert.deepEqual(cookDrug(w.view(chem.id), cfg, { demand: [{ drug: 'clear', day: w.s.day - 1, by: buyer }] }), { drug: 'clear' });
  w.s.agents[chem.id].goods.clear = 1;
  assert.equal(cookDrug(w.view(chem.id), cfg, { demand: [{ drug: 'clear', day: w.s.day - 1, by: buyer }] }), null, 'it holds enough');
  const hallu = cookDrug(w.view(chem.id), cfg, { demand: [{ drug: 'hallu', day: w.s.day, by: buyer }] });
  assert.equal(hallu.drug, 'hallu');
  const lies = halluLies(w.view(chem.id));
  assert.deepEqual(hallu.lies, lies);
  assert.equal(lies.length, 2);
  assert.deepEqual(lies[0], { kind: 'cash', agent: chem.id, value: 0 });
  assert.equal(lies[1].kind, 'cash');
  assert.ok(lies[1].agent !== chem.id && w.cast.find(c => c.id === lies[1].agent).trade === 'chemist', 'the bait is a rival Chemist');
  assert.ok(lies[1].value >= DOSES.price);
  assert.equal(checkPlay(w.s, chem.id, { kind: 'cook', place: 'suburbs', batches: 1, drug: 'hallu', lies }, w.s.day).ok, true, 'the rules take the lies');
  const sudo = w.cast.find(c => c.sudo);
  assert.deepEqual(cookDrug(w.view(sudo.id), w.seat(sudo.id), { wired: { [buyer]: w.s.day } }), { drug: 'sudo' });
  // R4-4: the last day a write goes through follows gap.ferryJail: the day before the first night whose arrest still
  // holds its taker when the ferry leaves (night 14 under 'released', nights − jailNights under 'missed').
  w.s.day = (N['gap.ferryJail'] === 'released' ? N.nights : N.nights - N.jailNights) - 1;
  w.s.clock = 2 * w.s.day;
  assert.equal(cookDrug(w.view(sudo.id), w.seat(sudo.id), { wired: { [buyer]: w.s.day } }), null, 'too late to sell SUDO while a write goes through');
});

test('CLEAR wipes a bot\'s memory of the day, as it wipes its view: back to what it remembered at dawn (§11, gap.clear)', async () => {
  const { forgetDay } = await bots();
  const memo = { seen: 40, heat: { 3: ['a01'] }, dawn: { day: 4, memo: { seen: 31, heat: {} } } };
  forgetDay(memo);
  assert.deepEqual(memo, { seen: 31, heat: {}, dawn: { day: 4, memo: { seen: 31, heat: {} } } });
});

test('seasons with the layer3 cast: every play and errand legal, the ledger holds, and every dose taken has its reason (§11, §25)', async () => {
  const { CASTS } = await bots();
  const { runSeason } = await import('../bench/runner.mjs');
  const drugs = {};
  for (const [seed, rule] of [[404, 'A'], [405, 'B'], [406, 'A']]) {
    const { dir, metrics } = runSeason({ seed, rule, outDir: path.join(tmp, 'seasons'), mix: CASTS.layer3 });
    const ck = JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8'));
    const log = readLog(dir);
    assert.equal(metrics.ledger.failed, 0);
    assert.deepEqual(log.filter(e => e.type === 'invalid').map(e => `${e.agent} ${e.errand || e.kind}: ${e.why}`), [], `seed ${seed}: no invalid play or errand`);
    const seat = Object.fromEntries(ck.cast.map(c => [c.id, c]));
    const sudoSeat = ck.cast.find(c => c.sudo).id;
    const playOf = (id, day) => log.find(e => e.type === 'play' && e.agent === id && e.day === day);
    for (const t of log.filter(e => e.type === 'take')) {
      const c = seat[t.agent];
      const p = playOf(t.agent, t.day);
      drugs[t.drug] = (drugs[t.drug] || 0) + 1;
      if (t.drug === 'temp') {
        assert.ok(c.habit === 'temp' || (ROBBERS.includes(c.type) && p && ATTACKS.includes(p.kind)), `${t.agent} (${c.type}) took TEMP on day ${t.day} and played ${p && p.kind}`);
      } else if (t.drug === 'sudo') {
        assert.equal(t.writer, sudoSeat, 'SUDO is the seed\'s seller\'s');
        assert.ok(log.some(e => e.type === 'give' && e.from === sudoSeat && e.to === t.agent && e.goods && e.goods.sudo && e.n < t.n), 'handed over as TEMP first');
        assert.notEqual(c.trade, 'dealer', 'never sold to a seat that deals it');
      } else if (t.drug === 'truth') {
        const lock = log.find(e => e.type === 'forced' && e.agent === t.agent && e.day === t.day && e.why === 'truth');
        assert.ok(lock && lock.instead.kind === 'back', `${t.agent}'s TRUTH locked a back`);
        const job = c.type === 'crew' && c.role === 'member' && t.day % 3 === 2 && lock.instead.target === c.leader;
        const hired = MUSCLE.includes(c.type) && log.some(e => e.type === 'say' && e.say === 'promise' && e.from === t.agent && e.terms.what === 'back' && e.terms.who === lock.instead.target && e.day === t.day);
        assert.ok(job || hired, `${t.agent} (${c.type}) took TRUTH for a job or a hire`);
      } else if (t.drug === 'hallu') {
        assert.ok(ROBBERS.includes(c.type), `a robber's gamble, not a ${c.type}'s`);
        assert.equal(t.leads.length, 3);
      } else if (t.drug === 'clear') {
        assert.ok(ROBBERS.includes(c.type));
        const heat = log.filter(e => e.type === 'heat' && e.agent === t.agent && e.n < t.n).slice(-1)[0];
        assert.ok(heat && heat.heat >= N.wantedAt, 'a wanted robber');
      } else if (t.drug === 'firewall') {
        assert.ok(t.day >= N.nights - 2, 'the last three days');
      }
    }
    for (const p of log.filter(e => e.type === 'lies')) {
      assert.deepEqual(p.lies[0], { kind: 'cash', agent: p.agent, value: 0 });
      assert.equal(seat[p.lies[1].agent].trade, 'chemist');
    }
    for (const e of log.filter(x => x.type === 'write')) {
      assert.deepEqual([e.by, e.play], [sudoSeat, { kind: 'back', target: sudoSeat }], 'the SUDO seller writes its bodyguard');
      // R4-4: before the first night whose arrest still holds its taker at the ferry (gap.ferryJail).
      assert.ok(e.day < (N['gap.ferryJail'] === 'released' ? N.nights : N.nights - N.jailNights));
    }
  }
  for (const d of ['temp', 'truth']) assert.ok(drugs[d] > 0, `${d} is taken`);
});

test('the layer3 cast replays: the same seed gives the same log, also after a kill mid-write and a resume (§23, §26)', () => {
  const run = (out, ...extra) => spawnSync(process.execPath, [runner, '--seed', '412', '--rule', 'B', '--out', path.join(tmp, out), '--quiet', '--cast', 'layer3', ...extra], { encoding: 'utf8' });
  const logOf = out => fs.readFileSync(path.join(tmp, out, '412-B', 'events.jsonl'));
  assert.equal(run('one').status, 0);
  assert.equal(run('two').status, 0);
  assert.ok(logOf('one').equals(logOf('two')), 'two runs, one log');
  assert.ok(readLog(path.join(tmp, 'one', '412-B')).some(e => e.type === 'take'), 'drugs are taken');
  assert.equal(run('killed', '--die-at', 'mid-write:7').signal, 'SIGKILL');
  const resumed = run('killed', '--resume');
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.ok(logOf('killed').equals(logOf('one')), 'the resumed log differs');
});

test("the report's drugs: taken by drug, SUDO from its reveal; crashes, withdrawals, hooks and clean marks; the taken sink; §27's drug bar a season and its pass rate across seasons", async () => {
  const { seasonMetrics, seasonReport, summarize, summaryMarkdown } = await import('../bench/report.mjs');
  const cast = [
    { id: 'a01', type: 'scout', trade: 'dealer', name: 'a01', layer: 2, works: true, drugs: true, habit: 'temp' },
    { id: 'a02', type: 'chemist', trade: 'chemist', name: 'a02', layer: 2, drugs: true, sudo: true },
    { id: 'a03', type: 'crew', trade: 'cop', name: 'a03', layer: 2, works: true, drugs: true },
    { id: 'a04', type: 'hustle', trade: 'cop', name: 'a04', layer: 2, drugs: true },
  ];
  const sink = { temp: 4, truth: 1, hallu: 1, firewall: 1, clear: 1 };
  const state = { agents: Object.fromEntries(cast.map(c => [c.id, {}])), copies: {}, money: { in: {}, out: {} }, goods: { in: {}, out: { taken: sink } } };
  const take = (agent, drug, extra = {}) => ({ type: 'take', agent, drug, ...extra });
  const forced = (agent, why) => ({ type: 'forced', agent, why, play: { kind: 'hustle', place: 'downtown' }, instead: { kind: 'laylow', place: 'suburbs' } });
  const log = [
    { type: 'cook', night: 1, agent: 'a02', place: 'suburbs', batches: 2, chems: 4, doses: 10 },
    { type: 'cook', night: 2, agent: 'a02', place: 'suburbs', batches: 1, chems: 2, doses: 5, drug: 'sudo' },
    take('a01', 'temp'), take('a01', 'temp'), take('a01', 'temp'),
    { type: 'crash', agent: 'a01', night: 2 }, { type: 'crash', agent: 'a01', night: 3 }, { type: 'crash', agent: 'a01', night: 4 },
    { type: 'hooked', agent: 'a01', drug: 'temp' }, forced('a01', 'crash'), forced('a01', 'withdrawal'), { type: 'clean', agent: 'a01' },
    take('a03', 'truth', {}), forced('a03', 'truth'),
    take('a01', 'hallu', { leads: [] }), take('a04', 'firewall'), take('a01', 'clear'),
    { type: 'give', from: 'a02', to: 'a01', copy: null, cash: 0, goods: { sudo: 1 } },
    take('a01', 'sudo', { writer: 'a02' }), { type: 'write', by: 'a02', agent: 'a01', play: { kind: 'back', target: 'a02' } }, forced('a01', 'sudo'),
  ];
  const bench = { seed: 1, rule: 'A', midseason: 'payday', nights: [] };
  const m = seasonMetrics(state, log, bench, cast);
  const d = m.drugs;
  assert.deepEqual(d.taken, { temp: 3, truth: 1, hallu: 1, firewall: 1, clear: 1, sudo: 1 }, 'SUDO counts as SUDO, never as the TEMP it was sold as');
  assert.deepEqual([d.crashes, d.withdrawals, d.hooked, d.clean], [3, 1, 1, 1]);
  assert.deepEqual(d.hookedOn, { temp: 1 });
  assert.deepEqual(d.sink, sink);
  assert.deepEqual(d.cooked, { temp: 10, sudo: 5 });
  assert.deepEqual(d.sudo, { sold: 1, written: 1, forced: 1 });
  assert.equal(d.truth, 1);
  assert.equal(m.bars.drugs.pass, true);
  const page = seasonReport(m);
  assert.match(page, /\*\*The drugs\*\*/);
  assert.match(page, /Every drug taken at least once, and someone hooked/);
  // A season with no FIREWALL taken, or nobody hooked, fails the bar.
  const noFirewall = seasonMetrics(state, log.filter(e => !(e.type === 'take' && e.drug === 'firewall')), bench, cast);
  assert.deepEqual([noFirewall.bars.drugs.pass, noFirewall.bars.drugs.missing], [false, ['firewall']]);
  assert.equal(seasonMetrics(state, log.filter(e => e.type !== 'hooked'), bench, cast).bars.drugs.pass, false);
  const sum = summarize([m, { ...noFirewall, rule: 'B' }]);
  assert.deepEqual(sum.rows.find(r => r.key === 'drugs').cells.map(c => [c.pass, c.n]), [[1, 1], [0, 1], [1, 2]]);
  const all = sum.keyNumbers.find(k => k.group === 'all').drugs;
  assert.deepEqual(all.seasons, { temp: 2, truth: 2, hallu: 2, firewall: 1, clear: 2, sudo: 2 });
  assert.equal(all.hookedSeasons, 2);
  assert.match(summaryMarkdown(sum, { cast: 'layer3' }), /\*\*The drugs, all seasons\*\*/);
  // The trades cast's report has no drugs in it.
  const trades = seasonMetrics(state, log, bench, cast.map(({ drugs, habit, sudo, ...c }) => c));
  assert.equal('drugs' in trades.bars, false);
  assert.equal(seasonReport(trades).includes('The drugs'), false);
});
