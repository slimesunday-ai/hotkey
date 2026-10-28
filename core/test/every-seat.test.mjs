// L2-6, every seat trades (GAME.md §9, §10, §25, §27). In GAME.md every agent picks a trade on day 0 and starts with
// its kit, but in layer 2's cast 17 of the 30 seats never work theirs. The new cast keeps layer 2's seats and §25's
// strategies, gives every seat a trade, and works it on any night the seat's strategy leaves free. The report gives the
// money bar's parts one at a time. Each test imports what it needs itself, so each fails on its own before the cast
// exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(here, '..', 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-every-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const bots = () => import('../bench/bots.mjs');

const TRADES = ['smuggler', 'chemist', 'dealer', 'gunrunner', 'cop'];
// The strategies that had no trade to work in layer 2's cast, and now work one on their free nights.
const WORKERS = ['buylate', 'turtle', 'scout', 'guess', 'crew'];
// Each trade's night of work, as plays (§9, §13).
const WORK = { smuggler: ['run'], chemist: ['cook'], dealer: ['deal'], gunrunner: ['build'], cop: ['patrol', 'collar'] };
const readLog = dir => fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));

test("the cast where every seat trades: layer 2's seats, seed by seed, each with a trade, six of each (§9, §25)", async () => {
  const { makeCast, CASTS } = await bots();
  assert.ok(CASTS && CASTS.trades, 'a cast called trades');
  const deals = new Set();
  for (const seed of [404, 405, 406, 407]) {
    const cast = makeCast(seed, CASTS.trades);
    assert.equal(cast.length, 30);
    // The same seats as layer 2's cast: ids, names, strategies, workplaces, routes and crews; only the trades differ.
    const seat = ({ trade, works, ...rest }) => rest;
    assert.deepEqual(cast.map(seat), makeCast(seed, CASTS.layer2).map(seat), `seed ${seed}: layer 2's seats`);
    const count = {};
    for (const c of cast) {
      assert.ok(TRADES.includes(c.trade), `${c.id} has a trade`);
      count[c.trade] = (count[c.trade] || 0) + 1;
      if (TRADES.includes(c.type)) assert.deepEqual([c.trade, !!c.works], [c.type, false], `${c.id}: a trade's own bot keeps its trade`);
      if (c.type === 'hustle') assert.deepEqual([c.trade, !!c.works], ['cop', false], `${c.id}: a shift worker is a Cop on paper and works shifts`);
      if (WORKERS.includes(c.type)) assert.equal(c.works, true, `${c.id}, a ${c.type}, works its trade`);
    }
    assert.deepEqual(count, { smuggler: 6, chemist: 6, dealer: 6, gunrunner: 6, cop: 6 });
    assert.deepEqual(makeCast(seed, CASTS.trades), cast, 'the same seed, the same cast');
    deals.add(JSON.stringify(cast.filter(c => c.works).map(c => c.trade)));
  }
  assert.ok(deals.size > 1, 'the seed deals the trades out');
});

test("the new cast is the runner's and the bench's default; runSeason() and makeCast() still default to layer 1's mix", async () => {
  const { makeCast, CASTS, DEFAULT_MIX } = await bots();
  const { mixOf, BENCH_ARGS, parseArgs } = await import('../bench/runner.mjs');
  assert.equal(mixOf({}), CASTS.trades);
  assert.equal(mixOf({ cast: 'trades' }), CASTS.trades);
  assert.equal(mixOf({ cast: 'layer2' }), CASTS.layer2);
  assert.equal(mixOf({ cast: 'layer1' }), DEFAULT_MIX);
  assert.deepEqual(makeCast(404), makeCast(404, DEFAULT_MIX));
  assert.deepEqual(parseArgs(['--cast', 'trades'], BENCH_ARGS), { cast: 'trades', set: [] });
  const r = spawnSync(process.execPath, [runner, '--seed', '406', '--rule', 'A', '--out', path.join(tmp, 'cli'), '--quiet'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const ck = JSON.parse(fs.readFileSync(path.join(tmp, 'cli', '406-A', 'checkpoint.json'), 'utf8'));
  assert.equal(ck.bench.options.cast, 'trades');
  assert.ok(ck.cast.some(c => c.works), 'the seats work their trades');
});

test('a season with the new cast: the strategies hold, every other seat works its own trade on its free nights, every play and errand is legal, the ledger holds (§9, §25)', async () => {
  const { CASTS } = await bots();
  const { runSeason } = await import('../bench/runner.mjs');
  const robbed = [];
  for (const [seed, rule] of [[404, 'A'], [405, 'B'], [406, 'A']]) {
    const { dir, metrics } = runSeason({ seed, rule, outDir: path.join(tmp, 'seasons'), mix: CASTS.trades });
    const ck = JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8'));
    const log = readLog(dir);
    assert.equal(metrics.ledger.failed, 0);
    assert.deepEqual(log.filter(e => e.type === 'invalid').map(e => `${e.agent} ${e.errand || e.kind}: ${e.why}`), [], `seed ${seed}: no invalid play or errand`);
    const seat = Object.fromEntries(ck.cast.map(c => [c.id, c]));
    const plays = log.filter(e => e.type === 'play');
    const isWork = e => Object.values(WORK).flat().includes(e.kind);
    // The shift worker is §27's baseline: it never works its trade.
    for (const e of plays.filter(x => seat[x.agent].type === 'hustle')) assert.ok(['hustle', 'back', 'hit', 'board'].includes(e.kind), `shift worker ${e.agent} played ${e.kind}`);
    for (const c of ck.cast.filter(x => x.works)) {
      const mine = plays.filter(e => e.agent === c.id);
      assert.ok(mine.some(isWork), `seed ${seed}: ${c.id}, a ${c.type}, worked its trade (${c.trade})`);
      for (const e of mine.filter(isWork)) assert.ok(WORK[c.trade].includes(e.kind), `${c.id}, a ${c.trade}, played ${e.kind}`);
      // A Smuggler can always run a drop and a Cop can always patrol, so neither takes a shift on a free night.
      if (c.trade === 'smuggler' || c.trade === 'cop') assert.ok(!mine.some(e => e.kind === 'hustle'), `${c.id}, a ${c.trade}, took a shift`);
    }
    // The turtle lays low once it holds a rare, on every night it has a home: its dawn holdings (it wears nothing, so
    // they show every piece it has) say whether it held a rare-or-better and had a home that day.
    for (const c of ck.cast.filter(x => x.type === 'turtle')) {
      for (const h of log.filter(x => x.type === 'holdings' && x.agent === c.id && x.day < 14)) {
        const p = plays.find(e => e.agent === c.id && e.day === h.day);
        if (p && h.home && h.pieces.some(x => x.tier !== 'common')) assert.equal(p.kind, 'laylow', `turtle ${c.id} on night ${h.day}`);
      }
    }
    // The buy-late saver buys only on the list's last two nights.
    for (const c of ck.cast.filter(x => x.type === 'buylate')) {
      for (const e of log.filter(x => (x.type === 'bid' || (x.type === 'fence' && x.act === 'buy')) && x.agent === c.id)) assert.ok([11, 12].includes(e.day), `buy-late ${c.id} bought on day ${e.day}`);
    }
    // Crews do crew jobs: on a job night every free member backs (the leader, or, the snake, a side).
    for (const night of [2, 5, 8, 11]) {
      for (const c of ck.cast.filter(x => x.type === 'crew' && x.role === 'member')) {
        const p = plays.find(e => e.agent === c.id && e.day === night);
        const leader = plays.find(e => e.agent === c.leader && e.day === night);
        if (p && leader) assert.equal(p.kind, 'back', `crew member ${c.id} on job night ${night}`);
      }
    }
    robbed.push(plays.filter(e => ['scout', 'guess'].includes(seat[e.agent].type) && ['hit', 'breakin', 'grab'].includes(e.kind)).length);
  }
  assert.ok(robbed.every(n => n > 0), `scouts and the guesser still rob: ${robbed.join(', ')}`);
});

test('the new cast replays: the same seed gives the same log, also after a kill mid-write and a resume (§23, §26)', () => {
  const run = (out, ...extra) => spawnSync(process.execPath, [runner, '--seed', '407', '--rule', 'B', '--out', path.join(tmp, out), '--quiet', '--cast', 'trades', ...extra], { encoding: 'utf8' });
  const logOf = out => fs.readFileSync(path.join(tmp, out, '407-B', 'events.jsonl'));
  assert.equal(run('one').status, 0);
  assert.equal(run('two').status, 0);
  assert.ok(logOf('one').equals(logOf('two')), 'two runs, one log');
  assert.equal(run('killed', '--die-at', 'mid-write:7').signal, 'SIGKILL');
  const resumed = run('killed', '--resume');
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.ok(logOf('killed').equals(logOf('one')), 'the resumed log differs');
});

test("the money bar's parts, one at a time: each trade's median seat, of the seats that play it, by haul against the median shift worker's (income a shadow), where cooked chems came from, the widest gap, the street's share (§9, §27)", async () => {
  const { seasonMetrics, seasonReport, summarize, summaryMarkdown } = await import('../bench/report.mjs');
  const seat = (id, type, trade, works) => ({ id, type, trade, name: id, layer: 2, ...(works ? { works: true } : {}) });
  const cast = [
    seat('a01', 'smuggler', 'smuggler'), seat('a02', 'scout', 'smuggler', true),
    seat('a03', 'chemist', 'chemist'), seat('a04', 'crew', 'chemist', true),
    seat('a05', 'dealer', 'dealer'), seat('a06', 'buylate', 'dealer', true),
    seat('a07', 'gunrunner', 'gunrunner'),
    seat('a08', 'cop', 'cop'), seat('a09', 'turtle', 'cop', true),
    seat('a10', 'hustle', 'cop'), seat('a11', 'hustle', 'cop'),
  ];
  const state = {
    agents: Object.fromEntries(cast.map(c => [c.id, {}])), copies: {}, money: { in: { street: 400, hustle: 150, patrol: 250 }, out: {} },
    goods: { in: { kit: { chems: 4, doses: 8, parts: 2 } }, out: {} },
  };
  const debt = (from, to, amount) => ({ type: 'pay', from, to, amount, for: 'debt' });
  const give = (from, to, goods) => ({ type: 'give', from, to, copy: null, cash: 0, goods });
  const log = [
    give('a01', 'a03', { chems: 4 }), debt('a03', 'a01', 60),
    give('a02', 'a04', { chems: 2 }), debt('a04', 'a02', 30),
    give('a09', 'a03', { chems: 1 }),
    { type: 'shop', agent: 'a03', item: 'chems', units: 2, cash: 54 },
    { type: 'cook', night: 2, agent: 'a03', place: 'suburbs', batches: 2, chems: 4, doses: 10 },
    { type: 'cook', night: 3, agent: 'a03', place: 'suburbs', batches: 2, chems: 4, doses: 10 },
    { type: 'cook', night: 3, agent: 'a04', place: 'forest', batches: 1, chems: 2, doses: 5 },
    give('a03', 'a05', { doses: 10 }), debt('a05', 'a03', 150),
    give('a04', 'a06', { doses: 5 }), debt('a06', 'a04', 75),
    { type: 'sale', night: 3, agent: 'a05', corner: 'strip-1', place: 'strip', hot: true, doses: 6, cash: 253 },
    { type: 'sale', night: 4, agent: 'a06', corner: 'suburbs-1', place: 'suburbs', hot: false, doses: 5, cash: 150 },
    // A gun is gear, not a Smuggler's goods: what a02 paid for it doesn't count against its trade.
    give('a07', 'a02', { guns: 1 }), debt('a02', 'a07', 150),
    { type: 'shop', agent: 'a07', item: 'parts', units: 2, cash: 50 },
    { type: 'patrol', night: 1, agent: 'a08', place: 'strip', wage: 50 }, { type: 'patrol', night: 2, agent: 'a08', place: 'strip', wage: 50 },
    { type: 'patrol', night: 3, agent: 'a08', place: 'strip', wage: 50 }, { type: 'patrol', night: 1, agent: 'a09', place: 'docks', wage: 50 },
    // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): each work event (wage 50, its agents) is now one hustle event an agent, a take of 50 each.
    { type: 'hustle', night: 3, agent: 'a10', take: 50 }, { type: 'hustle', night: 3, agent: 'a11', take: 50 }, { type: 'hustle', night: 3, agent: 'a09', take: 50 }, { type: 'hustle', night: 4, agent: 'a10', take: 50 },
    { type: 'rob', night: 4, leader: 'a02', members: ['a02'], target: 'a05', place: 'strip', cash: 40, value: 40, goods: { doses: 1 } },
  ];
  const bench = { seed: 1, rule: 'A', midseason: 'payday', nights: [] };
  const m = seasonMetrics(state, log, bench, cast);
  const b = m.bars;
  // 1. R4-11: a trade's seats are the seats that play it (reading 3), here its own bot, so a02, a04, a06 and a09, which
  //    work a trade on their free nights, play none; and each median is one seat (reading 2). Incomes: smuggler a01 60;
  //    chemist a03 150 - 60 - 54; dealer a05 253 - 150; gunrunner a07 150 - 50; cop a08 150. Out-earn is by haul
  //    (reading 6): nobody minted, so every haul is $0 and none beats the median shift worker's. By income, the shadow,
  //    the median shift worker is a11 at 50 (the lower of a10's 100 and a11's 50), and the Smuggler and the Dealer beat it.
  assert.equal(b.moneyEarn.hustle, 0);
  assert.deepEqual(b.moneyEarn.trades.map(t => [t.trade, t.seats, t.income]), [['smuggler', 1, 60], ['chemist', 1, 36], ['dealer', 1, 103], ['gunrunner', 1, 100], ['cop', 1, 150]]);
  assert.deepEqual(b.moneyEarn.trades.filter(t => 'pass' in t).map(t => [t.trade, t.pass]), [['smuggler', false], ['chemist', false], ['dealer', false]], "§27 names the Smuggler, the Chemist and the Dealer");
  assert.equal(b.moneyEarn.pass, false);
  assert.deepEqual([b.moneyEarn.byIncome.hustleIncome, b.moneyEarn.byIncome.outEarn.map(o => [o.type, o.income, o.pass])], [50, [['smuggler', 60, true], ['chemist', 36, false], ['dealer', 103, true]]]);
  // 2. Chems into the Chemist a03's hands (reading 7): from the Smuggler 4, another seat (a09) 1, the city's shop 2, and
  //    its own kit, its share of the final state's books (4 kit chems, a03's and a04's): 2. 4 of 9 isn't most.
  assert.deepEqual(b.moneyChems, { cooked: 8, smugglers: 4, shop: 2, others: 1, kits: 2, taken: 0, total: 9, share: 4 / 9, pass: false });
  // 3. The widest gap between two trades' medians: the Cop's $150 against the Chemist's $36.
  assert.deepEqual([b.moneyGap.hi, b.moneyGap.lo, b.moneyGap.pass], [{ trade: 'cop', income: 150 }, { trade: 'chemist', income: 36 }, false]);
  assert.ok(Math.abs(b.moneyGap.ratio - 150 / 36) < 1e-9);
  // 4. The street's share of the cash onto the island (no bar of its own: §9 says about two-thirds).
  assert.deepEqual(b.moneyShare, { street: 400, total: 800, share: 0.5 });
  assert.equal('pass' in b.moneyShare, false);
  const page = seasonReport(m);
  for (const part of ['The money works, 1', 'The money works, 2', 'The money works, 3', 'The money works, 4']) assert.ok(page.includes(part), part);
  assert.match(page, /\*\*The cast:\*\*/);
  const sum = summarize([m, { ...m, rule: 'B' }]);
  assert.deepEqual(sum.rows.filter(r => r.key.startsWith('money')).map(r => r.key), ['money', 'moneyEarn', 'moneyChems', 'moneyGap']);
  const md = summaryMarkdown(sum, { cast: 'trades' });
  for (const part of ['The money works, 1', 'The money works, 2', 'The money works, 3', 'The money works, 4']) assert.ok(md.includes(part), part);
  // Layer 2's cast (no seat works a second trade) keeps its report as it was.
  const layer2 = seasonMetrics(state, log, bench, cast.map(({ works, ...c }) => c));
  for (const k of ['moneyEarn', 'moneyChems', 'moneyGap', 'moneyShare']) assert.equal(k in layer2.bars, false, k);
  assert.equal(seasonReport(layer2).includes('The money works, 1'), false);
});
