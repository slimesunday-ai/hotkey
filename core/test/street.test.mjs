// Layer 2's bench (GAME.md §9, §25, §27): the street's bots and the money report. The trade bots trade among themselves
// in typed sit-downs and hand-overs and use the city only when no agent deals, a worker weighs flex against what a hit
// would take, layer 1's cast is still there to reproduce layer 1's reports, and the report counts the street's money
// from the record. Each test imports what it needs itself, so each fails on its own before the bots exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { rng } from '../rng.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-street-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const bots = () => import('../bench/bots.mjs');

// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  const a = g.s.agents[id];
  a.goods[kind] = (a.goods[kind] || 0) + n;
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}

// A small season with these trades, played by layer 2's bots for them, a day or a night at a time, in id order.
async function street(trades) {
  const { makeBot } = await bots();
  const g = new Game({ n: 1 });
  const agents = trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' }));
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  const b = Object.fromEntries(agents.map(a => [a.id, makeBot({ id: a.id, type: a.trade, trade: a.trade, fav: 'industrial', route: 'downtown', layer: 2 }, {})]));
  const day = () => {
    for (let round = 1; round <= 3; round++) {
      for (const id of Object.keys(b)) {
        for (const e of b[id].day(g.view(id), { seed: 404, day: g.s.day, round, rounds: 3, rng: rng(404, 'bot', id, g.s.day, round) })) {
          const res = g.errand(id, e.kind, e);
          assert.ok(res.ok, `${id} ${e.kind}: ${res.why}`);
        }
      }
    }
  };
  const night = () => {
    const plays = {};
    for (const id of Object.keys(b)) if (!g.s.agents[id].jail) plays[id] = b[id].night(g.view(id), { seed: 404, day: g.s.day, round: 'night', rng: rng(404, 'bot', id, g.s.day, 'night') }).play;
    return g.night(plays, { exact: true });
  };
  return { g, day, night };
}

test("layer 2's cast: 30 seats with each trade, a Cop seat and layer 1's types; a trade bot holds its trade, the rest the Cop trade (§25, §9)", async () => {
  const { makeCast, CASTS } = await bots();
  assert.ok(CASTS && CASTS.layer2, 'a layer-2 cast');
  for (const seed of [404, 405]) {
    const cast = makeCast(seed, CASTS.layer2);
    assert.equal(cast.length, 30);
    for (const t of ['smuggler', 'chemist', 'dealer', 'gunrunner', 'cop', 'hustle', 'buylate', 'turtle', 'scout', 'guess', 'crew']) {
      assert.ok(cast.some(c => c.type === t), `a ${t} in the cast`);
    }
    for (const c of cast) assert.equal(c.trade, ['smuggler', 'chemist', 'dealer', 'gunrunner'].includes(c.type) ? c.type : 'cop', `${c.id}, a ${c.type}`);
    assert.deepEqual(makeCast(seed, CASTS.layer2), cast, 'the same seed, the same cast');
  }
});

test("--cast layer1 is layer 1's cast exactly, so layer 1's reports still reproduce; an unknown cast stops the run", async () => {
  const { makeCast, CASTS, DEFAULT_MIX } = await bots();
  assert.equal(CASTS.layer1, DEFAULT_MIX);
  for (const seed of [404, 405]) assert.deepEqual(makeCast(seed, CASTS.layer1), makeCast(seed));
  const runner = path.join(here, '..', 'bench', 'runner.mjs');
  const run = (out, ...extra) => spawnSync(process.execPath, [runner, '--seed', '404', '--rule', 'A', '--out', path.join(tmp, out), '--quiet', ...extra], { encoding: 'utf8' });
  const bad = run('nope', '--cast', 'layer9');
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /unknown argument/);
  assert.equal(fs.existsSync(path.join(tmp, 'nope', '404-A')), false, 'no season ran');
  const cli = run('cli1', '--cast', 'layer1');
  assert.equal(cli.status, 0, cli.stderr);
  const { runSeason } = await import('../bench/runner.mjs');
  runSeason({ seed: 404, rule: 'A', outDir: path.join(tmp, 'api1') });
  const log = d => fs.readFileSync(path.join(tmp, d, '404-A', 'events.jsonl'));
  assert.ok(log('cli1').equals(log('api1')), "--cast layer1 plays layer 1's cast, byte for byte");
});

test('the street: a Smuggler asks a Chemist, the Chemist orders in a typed offer, the chems are handed over and paid for at $15 a unit (§9, §10, §14)', async () => {
  const { g, day } = await street(['smuggler', 'chemist']);
  g.grant('a01', 100);
  g.grant('a02', 200);
  stock(g, 'a01', 'chems', 6);
  day();
  const order = g.events('say', e => e.from === 'a02' && e.say === 'offer' && e.terms.what === 'trade');
  assert.deepEqual(order.map(e => e.terms), [{ what: 'trade', goods: { chems: 2 }, cash: 30 }], 'its kit holds 2, and 2 batches take 4');
  const gives = g.events('give', e => e.from === 'a01' && e.to === 'a02' && e.goods);
  assert.deepEqual(gives.map(e => e.goods), [{ chems: 2 }]);
  assert.deepEqual(g.events('pay', e => e.from === 'a02' && e.to === 'a01').map(e => [e.amount, e.for]), [[30, 'debt']]);
  assert.deepEqual([g.s.agents.a01.goods, g.s.agents.a01.cash], [{ chems: 4 }, 130]);
  assert.deepEqual(g.s.agents.a02.goods, { chems: 4 });
});

test("the city is the fallback: what no agent took for 2 days goes to the city's buyer (§9)", async () => {
  const { g, day, night } = await street(['smuggler']);
  g.grant('a01', 100);
  stock(g, 'a01', 'chems', 6);
  day();
  night();
  day();
  night();
  // R4-3: a sale is an order by day, filled at the lock.
  assert.equal(g.events('order').length + g.events('sell').length, 0, 'not on days 1 and 2');
  day();
  const sells = g.events('order', e => e.act === 'place' && e.agent === 'a01' && e.side === 'buyer' && e.item === 'chems');
  assert.equal(sells.length, 1, 'on day 3, in the last round');
  assert.equal(sells[0].day, 3);
  assert.equal(g.s.agents.a01.goods.chems || 0, 0, 'all of them');
});

test("flex: a worker wears a rare where a night of flex beats the chance of losing it, and always at home (§4, §7)", async () => {
  const { streetFit, FLEX_RISK } = await bots();
  const rare = { copy: 'k1', trait: 't1', slot: 'top', tier: 'rare', last: 500, ability: null, worn: false };
  const common = { copy: 'k2', trait: 't2', slot: 'top', tier: 'common', last: 100, ability: null, worn: false };
  const v = {
    me: { pieces: [rare, common] },
    board: { list: [{ trait: 't1', last: 500, price: 500 }, { trait: 't2', last: 100, price: 100 }], tonight: { downtown: 'heavy', strip: 'normal', forest: 'lawless' } },
  };
  assert.ok(FLEX_RISK.heavy < FLEX_RISK.normal && FLEX_RISK.normal < FLEX_RISK.lawless);
  assert.deepEqual(streetFit(v, { place: 'downtown' }), { top: 'k1' }, 'Glasswall: $10 of flex beats 1% of $500');
  assert.deepEqual(streetFit(v, { place: 'strip' }), { top: 'k2' }, 'Neon Row: 5% of $500 is $25, more than the flex, so the common');
  assert.deepEqual(streetFit(v, { place: 'forest' }), { top: 'k2' });
  assert.deepEqual(streetFit(v, { home: true }), { top: 'k1' }, "at home a hit can't reach it");
});

test("the report counts the street's money from the record: by source and bot, the drops, corner fights as show-worthy, and the money bar (§9, §27)", async () => {
  const { seasonMetrics, summarize } = await import('../bench/report.mjs');
  const cast = [
    { id: 'a01', type: 'smuggler', name: 'a', layer: 2 }, { id: 'a02', type: 'smuggler', name: 'b', layer: 2 },
    { id: 'a03', type: 'chemist', name: 'c', layer: 2 }, { id: 'a04', type: 'dealer', name: 'd', layer: 2 },
    { id: 'a05', type: 'hustle', name: 'e', layer: 2 },
  ];
  const state = { agents: Object.fromEntries(cast.map(c => [c.id, {}])), copies: {}, money: { in: { street: 200, hustle: 100 }, out: {} } };
  const mint = (agent, mainland) => ({ type: 'mint', agent, mainland, cards: [] });
  const log = [
    { type: 'gather', night: 1, agent: 'a01', place: 'mall', goods: { chems: 3 } },
    { type: 'gather', night: 1, agent: 'a02', place: 'mall', goods: { chems: 3 } },
    { type: 'gather', night: 2, agent: 'a01', place: 'forest', goods: { chems: 6 } },
    { type: 'give', from: 'a01', to: 'a03', copy: null, cash: 0, goods: { chems: 4 } },
    { type: 'pay', from: 'a03', to: 'a01', amount: 60, for: 'debt' },
    { type: 'shop', agent: 'a03', item: 'chems', units: 2, cash: 54 },
    { type: 'cook', night: 2, agent: 'a03', place: 'suburbs', batches: 2, chems: 4, doses: 10 },
    { type: 'give', from: 'a03', to: 'a04', copy: null, cash: 0, goods: { doses: 6 } },
    { type: 'pay', from: 'a04', to: 'a03', amount: 90, for: 'debt' },
    { type: 'sale', night: 3, agent: 'a04', corner: 'strip-1', place: 'strip', hot: true, doses: 6, cash: 253 },
    { type: 'sell', agent: 'a02', item: 'chems', units: 3, cash: 21 },
    // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the work event (wage 50, agents a05) is now a05's hustle event, a take of 50.
    { type: 'hustle', night: 3, agent: 'a05', take: 50 },
    { type: 'flex', night: 3, agent: 'a05', pay: 10 },
    mint('a01', 300), mint('a02', 100), mint('a03', 150), mint('a04', 500), mint('a05', 200),
  ];
  const night = (n, fights = []) => ({ night: n, haul: {}, hits: [], placesChanged: false, fights });
  const corner = { kind: 'corner', target: null, winner: null, attackers: [{ leader: 'a04', members: ['a04'], strength: 1 }], arrested: [] };
  const bench = { seed: 1, rule: 'A', midseason: 'payday', nights: [night(1), night(2), night(3, [corner])] };
  const m = seasonMetrics(state, log, bench, cast);
  assert.equal(m.layer, 2);
  assert.deepEqual(m.street.sources.chemist, { hustle: 0, flex: 0, street: 0, buyer: 0, agents: 90, thefts: 0, shop: 54, bought: 60 });
  assert.deepEqual([m.street.income.smuggler, m.street.income.chemist, m.street.income.dealer, m.street.income.hustle], [40.5, -24, 163, 60]);
  assert.equal(m.street.streetShare, 2 / 3);
  assert.deepEqual(m.street.drops, { runs: 3, worked: 2, perDrop: 1.5, shared: 2 / 3, most: 2 });
  assert.deepEqual(m.street.chems, { cooked: 4, smugglers: 4, shop: 2 });
  assert.equal(m.street.corners.fights, 1);
  assert.equal(m.bars.showWorthy.missing.includes(3), false, 'a corner fight is show-worthy');
  const mb = m.bars.money;
  // R4-11, reading 2: the median Smuggler is one seat, the lower of a01's $300 and a02's $100.
  assert.deepEqual(mb.outEarn.map(x => [x.type, x.haul, x.pass]), [['smuggler', 100, false], ['chemist', 150, false], ['dealer', 500, true]], 'against the shift worker\'s $200 haul');
  assert.deepEqual([mb.chems.pass, mb.spread.lo, mb.spread.hi, mb.spread.pass, mb.pass], [true, -24, 163, false, false]);
  const layer1 = seasonMetrics(state, log, bench, cast.map(({ layer, ...c }) => c));
  assert.equal(layer1.street, null);
  assert.equal('money' in layer1.bars, false, "layer 1's report has no money bar");
  const sum = summarize([m, { ...m, rule: 'B' }]);
  assert.equal(sum.layer, 2);
  assert.ok(sum.rows.some(r => r.key === 'money'));
});

test('a layer-2 season: the trades trade, every play is legal, the ledger holds, and the report shows the street (§25, §27)', async () => {
  const { CASTS } = await bots();
  const { runSeason } = await import('../bench/runner.mjs');
  const { metrics } = runSeason({ seed: 405, rule: 'B', outDir: path.join(tmp, 'l2'), mix: CASTS.layer2 });
  assert.equal(metrics.layer, 2);
  assert.equal(metrics.ledger.failed, 0);
  assert.equal(Object.values(metrics.bars.invalid).reduce((t, x) => t + x.invalid, 0), 0, 'no invalid plays');
  assert.ok(metrics.street.chems.smugglers > 0, 'Chemists bought chems from Smugglers');
  assert.ok(metrics.street.sources.dealer.street > 0, 'Dealers sold on corners');
  assert.ok(metrics.bars.money, 'the money bar is measured');
  const report = fs.readFileSync(path.join(tmp, 'l2', '405-B', 'report.md'), 'utf8');
  assert.match(report, /\*\*The street:\*\*/);
  assert.match(report, /The money works/);
});
