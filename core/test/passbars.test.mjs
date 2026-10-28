// R4-11, design (b) of the gates redesign (docs/redesign/gates-20261017.md and gates-20261017-b.md): one module owns
// every §27 bar (core/bench/passbars.mjs), with its §27 line quoted above its code and one reading each; the thresholds
// across seasons are applied there; report.mjs only formats; and the three bars R2-9 left unbuilt are built.
// bar-fixtures.test.mjs is the spec, bar by bar. This file adds what it doesn't check: the module itself, the eight
// readings where a fixture leaves a case open, the money bar computed once, the trades listed once, and the model bars
// end to end on the fake ($0). Every amount is read from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { N } from '../numbers.mjs';
import { TRADES } from '../index.mjs';
import { seasonMetrics, seasonReport, summarize, summaryMarkdown } from '../bench/report.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.join(here, '..', 'bench');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r4-passbars-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// A night's base shift wage: the unit of every amount below.
// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): N.hustleBase is gone, so the unit is its value, $50, and every amount is unchanged.
const U = 50;
const LAST = N.nights;
const seat = (id, type, more = {}) => ({ id, type, name: id, ...more });
const L2 = { layer: 2 };
// A seat's mint at the ferry: its Mainland money, in shift wages, and no piece.
const mint = (agent, wages) => ({ type: 'mint', agent, mainland: wages * U, cash: wages * U, cards: [] });
const blank = cast => ({ agents: Object.fromEntries(cast.map(c => [c.id, {}])), copies: {}, money: { in: {}, out: {} }, goods: { in: {}, out: {} } });
const season = ({ cast, log = [], nights = [], state = blank(cast), rule = 'A', seed = 1, models }) => seasonMetrics(state, log, { seed, rule, midseason: 'payday', nights, ...(models ? { models } : {}) }, cast);
const hauls = (cast, wages, extra = []) => [...Object.entries(wages).map(([id, x]) => mint(id, x)), ...extra];
const arrest = (agent, n) => ({ type: 'arrest', night: n, agent, why: 'fight' });
const give = (from, to, goods) => ({ type: 'give', from, to, copy: null, cash: 0, goods });
const debt = (from, to, wages) => ({ type: 'pay', from, to, amount: wages * U, for: 'debt' });

// --- one module -------------------------------------------------------------------------------------------------------
// Each bar's own words in §27 (trunk's GAME.md), a phrase the module's line for it must quote.
const WORDS = {
  ledger: 'The ledger never loses or doubles a copy',
  buyLate: "A buy-late bot (saves everything, buys only on the list's last two nights)",
  turtle: 'a turtle bot (lays low every night after its first rare)',
  copGunrunner: 'The median cop and the median Gunrunner finish in the top half',
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): §27 says "the median hustler" at R11's merge, as passbars.mjs's words do since ec5b07d, where it said "the median shift worker".
  crimePays: 'Crime pays, with risk: the median robber out-earns the median hustler',
  crimeMedians: "Reports also show the earlier reading, the robbers' median haul and the median of their arrests",
  middle: 'the last night moves less than a third of all the value stolen in a season',
  leaderChanges: '#1 by haul changes hands at least 3 times a season',
  betrayals: 'At least 3 betrayals a season',
  showWorthy: 'Every night has at least one show-worthy event',
  mintedMoved: 'At least a third of the traits that mint were taken or traded at least once',
  places: 'rerun each night with places ignored',
  money: 'the median Smuggler, Chemist and Dealer each out-earn the median hustler',
  moneyEarn: 'the median Smuggler, Chemist and Dealer each out-earn the median hustler',
  moneyChems: "Most chems that get cooked come from Smugglers, not the city's shop",
  moneyGap: "No trade's median income is more than twice another's",
  dropSells: 'at least three in four copies sell before the list closes',
  backing: 'report how often a target cut a backer of the attack on itself',
  drugs: 'every drug gets taken at least once a season, and someone gets hooked',
  vault: 'someone jobs the vault in at least half of seasons',
  models: 'Local-model agents beat the scripted bots on average',
  ceiling: 'Runner calls stay inside the ceiling',
  invalid: 'are typed, logged and replaced by the default play',
  invalidByModel: 'the report gives the rate per model',
};
// A season with every bar a cast carries: layer 2 with every seat working a trade, layer 3's drugs, layer 4's score,
// and a model seat (R2-8), hand-built, so nothing plays.
const FULL = [
  seat('sm', 'smuggler', { trade: 'smuggler' }), seat('ch', 'chemist', { trade: 'chemist' }), seat('de', 'dealer', { trade: 'dealer' }),
  seat('gu', 'gunrunner', { trade: 'gunrunner' }), seat('co', 'cop', { trade: 'cop' }), seat('s1', 'hustle', { trade: 'cop' }),
  seat('b1', 'buylate', { trade: 'dealer', works: true }), seat('t1', 'turtle', { trade: 'chemist', works: true }),
  seat('r1', 'scout', { trade: 'smuggler', works: true }), seat('m1', 'guess', { trade: 'gunrunner', works: true, model: true }),
].map(c => ({ ...L2, drugs: true, score: true, model: false, ...c }));
const fullSeason = () => season({
  cast: FULL,
  log: [{ type: 'season', agents: FULL.map(c => ({ id: c.id, driver: c.model ? 'fake' : 'bot' })) }, ...FULL.map(c => mint(c.id, 1))],
  models: { seats: { m1: { record: [] } } },
});

test('one module owns every §27 bar: every bar a season carries is the module\'s, with its §27 line, and the season\'s bars are the module\'s own', async () => {
  const mod = await import('../bench/passbars.mjs');
  const m = fullSeason();
  for (const [key, words] of Object.entries(WORDS)) {
    const bar = mod.BARS.find(b => b.key === key);
    assert.ok(bar, `${key} is one of the module's bars`);
    assert.ok(typeof bar.words === 'string' && bar.words.includes(words), `${key} quotes §27: "${words}"`);
  }
  for (const key of Object.keys(m.bars)) assert.ok(mod.BARS.some(b => b.key === key), `the season's ${key} is one of the module's bars`);
  const own = mod.seasonBars(blank(FULL), [{ type: 'season', agents: FULL.map(c => ({ id: c.id, driver: c.model ? 'fake' : 'bot' })) }, ...FULL.map(c => mint(c.id, 1))], { seed: 1, rule: 'A', midseason: 'payday', nights: [], models: { seats: { m1: { record: [] } } } }, FULL);
  assert.deepEqual(m.bars, own.bars);
  assert.deepEqual(m.shadow, own.shadow);
});

test('report.mjs only formats: its seasonMetrics and summarize are the metrics module\'s, and it sets no verdict', async () => {
  const report = await import('../bench/report.mjs');
  const metrics = await import('../bench/metrics.mjs');
  assert.equal(report.seasonMetrics, metrics.seasonMetrics);
  assert.equal(report.summarize, metrics.summarize);
  const src = fs.readFileSync(path.join(BENCH, 'report.mjs'), 'utf8');
  assert.doesNotMatch(src, /\bpass\s*:/, 'report.mjs builds no verdict');
  assert.doesNotMatch(src, /^(?:export )?function (?:median|seasonCount|haulsOf|firstSales)\b/m, 'report.mjs measures nothing');
});

test('the money bar is computed once: in the cast where every seat trades, its three clauses and their own rows are the same reading, and its spread counts the five trades, the Cop\'s included', () => {
  const cast = [
    seat('sm', 'smuggler', { trade: 'smuggler' }), seat('tu', 'turtle', { trade: 'smuggler', works: true }), seat('ch', 'chemist', { trade: 'chemist' }),
    seat('de', 'dealer', { trade: 'dealer' }), seat('gu', 'gunrunner', { trade: 'gunrunner' }), seat('co', 'cop', { trade: 'cop' }),
    seat('s1', 'hustle', { trade: 'cop' }), seat('s2', 'hustle', { trade: 'cop' }), seat('s3', 'hustle', { trade: 'cop' }),
  ].map(c => ({ ...c, ...L2 }));
  // Incomes: the Smuggler 6, the Chemist 6 (12 for its doses, less 6), the Dealer 8, the Gunrunner 6; the Cop patrols 13
  // nights for 13, more than twice the Smuggler's 6.
  const log = [
    give('sm', 'ch', { chems: 8 }), debt('ch', 'sm', 6), { type: 'cook', night: 3, agent: 'ch', place: 'forest', batches: 2, chems: 8, doses: 20 },
    give('ch', 'de', { doses: 20 }), debt('de', 'ch', 12), { type: 'sale', night: 5, agent: 'de', corner: 'strip-1', place: 'strip', hot: true, doses: 20, cash: 20 * U },
    { type: 'sell', agent: 'gu', item: 'parts', units: 1, cash: 6 * U },
    ...Array.from({ length: 13 }, (_, i) => ({ type: 'patrol', night: i + 1, agent: 'co', place: 'strip', wage: U })),
    ...hauls(cast, { sm: 5, tu: 3, ch: 5, de: 8, gu: 5, co: 5, s1: 4, s2: 4, s3: 4 }),
  ];
  const b = season({ cast, log }).bars;
  assert.equal(b.moneyChems, b.money.chems, 'one chems clause');
  assert.deepEqual(b.money.trades.map(t => t.trade), TRADES, 'the five trades, the rules\' own list');
  assert.deepEqual([b.money.spread.pass, b.moneyGap.pass, b.moneyGap.hi.trade], [false, false, 'cop']);
  assert.equal(b.moneyEarn.pass, b.money.outEarn.every(o => o.pass));
  assert.deepEqual(b.moneyEarn.trades.filter(t => 'pass' in t).map(t => [t.trade, t.pass]), b.money.outEarn.map(o => [o.type, o.pass]));
  assert.equal(b.money.pass, b.money.outEarn.every(o => o.pass) && b.money.chems.pass && b.money.spread.pass);
});

test('the bench lists the five trades once, as the rules do: no bench module spells them out, so no two lists can differ', async () => {
  const mod = await import('../bench/passbars.mjs');
  assert.equal(mod.TRADES, TRADES);
  for (const f of fs.readdirSync(BENCH).filter(x => x.endsWith('.mjs'))) {
    const src = fs.readFileSync(path.join(BENCH, f), 'utf8');
    for (const [, name, value] of src.matchAll(/^(?:export )?const (STREET_TYPES|TRADES) = (.*)$/gm)) {
      assert.ok(!value.trim().startsWith('['), `${f}: ${name} spells out a list of its own`);
    }
  }
});

// --- the readings -----------------------------------------------------------------------------------------------------
test('reading 2, "the median X" is one seat: of two Smugglers the lower decides, and of two shift workers the lower is the median shift worker', () => {
  const cast = [
    seat('sm1', 'smuggler'), seat('sm2', 'smuggler'), seat('ch', 'chemist'), seat('de', 'dealer'), seat('g1', 'gunrunner'), seat('g2', 'gunrunner'),
    seat('co', 'cop'), seat('s1', 'hustle'), seat('s2', 'hustle'),
  ].map(c => ({ ...c, ...L2 }));
  // The Smugglers have 7 and 3 (their mean, 5, would beat the shift workers' mean, 4); the shift workers 3 and 5.
  const m = season({ cast, log: hauls(cast, { sm1: 7, sm2: 3, ch: 8, de: 8, g1: 5, g2: 5, co: 6, s1: 3, s2: 5 }) });
  assert.deepEqual(m.bars.money.outEarn.map(o => [o.type, o.seat, o.haul, o.pass]), [['smuggler', 'sm2', 3 * U, false], ['chemist', 'ch', 8 * U, true], ['dealer', 'de', 8 * U, true]]);
  assert.equal(m.bars.money.hustleHaul, 3 * U);
  assert.equal(m.bars.crimePays.hustleHaul, 3 * U);
  // Two Gunrunners level at 5, on the season's median haul: either is the median Gunrunner, and neither is above it.
  assert.deepEqual([m.bars.copGunrunner.gunrunner, m.bars.copGunrunner.median, m.bars.copGunrunner.pass], [5 * U, 5 * U, false]);
});

test('reading 3, the seats that play a role: a model seat plays its trade and no bot\'s strategy, so it is a Gunrunner by its trade, and no robber or buy-late bot by the seat it sits in', () => {
  const cast = [
    seat('g1', 'gunrunner', { trade: 'gunrunner' }), seat('m1', 'scout', { trade: 'gunrunner', model: true }),
    seat('b1', 'buylate', { trade: 'cop' }), seat('m2', 'buylate', { trade: 'dealer', model: true }),
    seat('r1', 'scout', { trade: 'cop' }), seat('s1', 'hustle', { trade: 'cop' }), seat('co', 'cop', { trade: 'cop' }),
  ].map(c => ({ model: false, ...c, ...L2 }));
  // Hauls 1, 1, 2, 4, 6, 9, 9: the median is r1's 4.
  const m = season({ cast, log: hauls(cast, { g1: 9, m1: 1, b1: 1, m2: 9, r1: 4, s1: 2, co: 6 }, [arrest('r1', 3)]) });
  assert.deepEqual([m.bars.copGunrunner.gunrunner, m.bars.copGunrunner.pass], [U, false], 'the Gunrunners are g1 and m1, and m1 is the lower');
  assert.deepEqual([m.bars.buyLate.value, m.bars.buyLate.pass], [U, true], 'the buy-late bots are b1 alone');
  assert.deepEqual([m.bars.crimePays.robber, m.bars.crimePays.pass], ['r1', true], 'the robbers are r1 alone');
});

test('readings 4 and 5, all the value stolen: hits (cash, pieces and goods), grabs and vault jobs, each piece at its copy\'s own first sale and goods at the city\'s opening prices; a fake counts nothing, and the biggest stories count the same', () => {
  const cast = [seat('r1', 'scout'), seat('s1', 'hustle')];
  const P = N.price.rare[0];
  const buy = (n, copy, trait, price) => ({ type: 'buy', night: n, agent: 's1', trait, copy, price });
  const rob = (n, cash, more = {}) => ({ type: 'rob', night: n, leader: 'r1', members: ['r1'], target: 's1', place: 'strip', copy: null, trait: null, tier: null, cash, value: cash, ...more });
  const crate = N.shipments[5];
  const log = [
    buy(2, 'k1', 't1', P), buy(3, 'k3', 't2', P), buy(N.listLastNight, 'k4', 't2', 3 * P),
    rob(3, U),
    { type: 'grab', night: 5, leader: 'r1', members: ['r1'], place: 'docks', cash: 0, goods: { ...crate } },
    // An overbid priced t2 at 3P before the lock: the record's `value` says so, k3's own sale says P.
    rob(7, 0, { copy: 'k3', trait: 't2', tier: 'rare', value: 3 * P }),
    rob(9, U),
    { type: 'vault', night: LAST, leader: 'r1', members: ['r1'], place: 'downtown', copies: ['k1', 'k9'], cash: U },
    rob(LAST, 0, { goods: { temp: 2 } }),
  ];
  const state = { ...blank(cast), copies: { k9: { trait: 't1', tier: 'rare', holder: { k: 'agent', id: 'r1' }, fake: true, maker: 's1', sold: null, hist: [] } } };
  const m = season({ cast, log, state });
  const goods = Object.entries(crate).reduce((t, [k, u]) => t + u * N.shopPrice[k], 0);
  const last = U + P + 2 * N.corner.price;
  const stolen = U + goods + P + U + last;
  assert.deepEqual([m.bars.middle.stolen, m.bars.middle.lastNight], [stolen, last]);
  assert.equal(m.bars.middle.pass, last / stolen < 1 / 3);
  assert.equal(m.stories.find(s => s.trait === 't2').value, P, "the story counts k3 at its own sale");
});

test('reading 7, most chems: more than half of what reached the Chemists came from Smugglers, a seat with the Smuggler trade that is no Smuggler counted apart, and the Chemists\' own kits in the total', () => {
  const cast = [
    seat('sm', 'smuggler', { trade: 'smuggler' }), seat('tu', 'turtle', { trade: 'smuggler', works: true }), seat('ch', 'chemist', { trade: 'chemist' }),
    seat('c2', 'crew', { trade: 'chemist', works: true }), seat('de', 'dealer', { trade: 'dealer' }), seat('gu', 'gunrunner', { trade: 'gunrunner' }),
    seat('co', 'cop', { trade: 'cop' }), seat('s1', 'hustle', { trade: 'cop' }),
  ].map(c => ({ ...c, ...L2 }));
  // Both seats with the Chemist trade start with its kit: the books hold two kits' chems, and one of them is the Chemist's.
  const kit = N.kits.chemist.chems;
  const state = { ...blank(cast), goods: { in: { kit: { chems: 2 * kit } }, out: {} } };
  const log = [
    give('sm', 'ch', { chems: 3 }), give('tu', 'ch', { chems: 5 }), { type: 'shop', agent: 'ch', item: 'chems', units: 1, cash: N.shopPrice.chems },
    { type: 'cook', night: 2, agent: 'ch', place: 'forest', batches: 2, chems: 6, doses: 15 },
    { type: 'cook', night: 2, agent: 'c2', place: 'forest', batches: 1, chems: 2, doses: 5 },
    ...hauls(cast, { sm: 1, tu: 1, ch: 1, c2: 1, de: 1, gu: 1, co: 1, s1: 1 }),
  ];
  const c = season({ cast, log, state }).bars.moneyChems;
  assert.deepEqual([c.smugglers, c.others, c.shop, c.kits, c.cooked], [3, 5, 1, kit, 6]);
  assert.equal(c.pass, 3 / (3 + 5 + 1 + kit) > 1 / 2);
  assert.equal(c.pass, false);
});

test('reading 8, the thresholds count distinct seasons: buy-late passes 16 of 18 runs, but 16 of 17 distinct seasons, so it reaches its 90%; a bar §27 gives no share has no verdict across seasons', () => {
  const cast = [seat('b1', 'buylate'), seat('s1', 'hustle'), seat('s2', 'hustle')];
  // Seeds 1-8 play a different season under A and B (an arrest on another night), and buy-late passes; seed 9 plays
  // one season under both, and it fails. Each record names its seed and rule, as events.jsonl does.
  const run = (seed, rule) => season({
    seed, rule, cast,
    log: [{ type: 'season', seed, rule }, ...hauls(cast, seed === 9 ? { b1: 9, s1: 2, s2: 3 } : { b1: 1, s1: 2, s2: 3 }, seed === 9 ? [] : [arrest('s1', rule === 'A' ? 1 : 2)])],
  });
  const results = [...Array.from({ length: 9 }, (_, i) => run(i + 1, 'A')), ...Array.from({ length: 9 }, (_, i) => run(i + 1, 'B'))];
  const sum = summarize(results);
  const row = sum.rows.find(r => r.key === 'buyLate');
  const all = row.cells[row.cells.length - 1];
  assert.deepEqual([all.pass, all.n, all.count.distinct, all.count.of], [16, 18, 16, 17]);
  assert.equal(all.rate, 16 / 17);
  assert.deepEqual([row.need, row.verdict], [0.9, true]);
  assert.equal(sum.rows.find(r => r.key === 'betrayals').verdict, null);
});

// --- the three bars R2-9 left -------------------------------------------------------------------------------------------
test('local-model agents against the bots: each model season pairs with the bot season on its seed and rule, seat for seat; the bar is the mean haul across every paired seat, with the gap\'s standard error; a pair played twice counts once; and the bot seasons can come apart from the seasons the other bars count', () => {
  const cast = models => [seat('a01', 'scout'), seat('a02', 'dealer'), seat('a03', 'turtle'), seat('a04', 'smuggler')].map(c => ({ ...c, model: models.includes(c.id) }));
  const play = (seed, rule, models, x) => season({ seed, rule, cast: cast(models), log: x.map((w, i) => mint(`a0${i + 1}`, w)) });
  // Seed 1: the model in a01 and a02 makes 4 and 3 where the bots made 2 and 4 (3.5 against 3). Seed 2: 1 and 2 where
  // the bots made 6 and 2 (1.5 against 4). Across the four paired seats, 2.5 against the bots' 3.5.
  const bots = [play(1, 'A', [], [2, 4, 6, 6]), play(2, 'A', [], [6, 2, 5, 5])];
  const model = [play(1, 'A', ['a01', 'a02'], [4, 3, 8, 8]), play(2, 'A', ['a01', 'a02'], [1, 2, 5, 5])];
  const row = summarize([...bots, ...model]).rows.find(r => r.key === 'models');
  const all = row.cells[row.cells.length - 1];
  assert.deepEqual([all.pass, all.n, all.model, all.bots, row.verdict], [1, 2, 2.5 * U, 3.5 * U, false]);
  // The two seasons' gaps are +0.5 and -2.5: a mean of -1, and a standard error of 1.5.
  assert.ok(Math.abs(all.gap + U) < 1e-9, `gap ${all.gap}`);
  assert.ok(Math.abs(all.se - 1.5 * U) < 1e-9, `standard error ${all.se}`);
  // Seed 1's pair again under rule B, the same two seasons: one pair, counted once.
  const twice = summarize([...bots, ...model, { ...bots[0], rule: 'B' }, { ...model[0], rule: 'B' }]).rows.find(r => r.key === 'models');
  const t = twice.cells[twice.cells.length - 1];
  assert.deepEqual([t.n, t.count.of, t.model, t.bots], [3, 2, 2.5 * U, 3.5 * U]);
  // The bot seasons apart: the model bar reads them, the other bars count the model seasons only.
  const apart = summarize(model, { twins: bots });
  assert.equal(apart.rows.find(r => r.key === 'models').cells.at(-1).n, 2);
  assert.equal(apart.rows.find(r => r.key === 'betrayals').cells.at(-1).n, 2);
});

test('the invalid-play rate per model: each model\'s plays and invalid plays by the driver the record names, apart from every bot type', () => {
  const cast = [seat('a01', 'scout', { model: true }), seat('a02', 'scout', { model: false }), seat('a03', 'hustle', { model: true })];
  const laylow = { kind: 'laylow', place: 'suburbs' };
  const log = [
    { type: 'season', agents: [{ id: 'a01', driver: 'qwen' }, { id: 'a02', driver: 'bot' }, { id: 'a03', driver: 'qwen' }] },
    { type: 'invalid', agent: 'a01', play: { kind: 'unknown' }, why: 'unknown play kind', kind: 'never', instead: laylow },
    { type: 'play', agent: 'a01', ...laylow, reason: '' }, { type: 'play', agent: 'a03', kind: 'hustle', place: 'docks', reason: '' },
    { type: 'invalid', agent: 'a03', errand: 'offer', why: 'not enough cash', kind: 'not-yet' },
    { type: 'play', agent: 'a02', kind: 'hustle', place: 'docks', reason: '' },
  ];
  const b = season({ cast, log }).bars;
  assert.deepEqual(b.invalidByModel, { qwen: { seats: 2, plays: 2, invalid: 1, rate: 0.5, errands: 1 } });
  assert.deepEqual([b.invalid.scout, b.invalid.hustle], [{ plays: 1, invalid: 0, rate: 0 }, { plays: 0, invalid: 0, rate: null }]);
});

test('the model bars end to end on the fake ($0): the models cast plays each seed\'s bot twin first, its seasons carry the ceiling and the invalid-play rate per model, and the summary pairs every model season with its twin', () => {
  const out = path.join(tmp, 'models');
  const r = spawnSync(process.execPath, [path.join(BENCH, 'bench.mjs'), '--seeds', '404-404', '--rules', 'A', '--cast', 'models', '--model-seats', '2', '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(fs.readFileSync(path.join(out, '404-A', 'result.json'), 'utf8'));
  const c = result.bars.ceiling;
  assert.ok(c.seatDays > 0, 'the model seats\' records reach the report');
  assert.ok(c.most > 0 && c.most <= N.callCeiling);
  assert.equal(c.pass, true);
  assert.equal(result.bars.invalidByModel.fake.seats, 2);
  assert.ok(fs.existsSync(path.join(out, 'bots', '404-A', 'events.jsonl')), 'the bot twin');
  const sum = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
  const row = sum.rows.find(x => x.key === 'models');
  assert.equal(row.cells[row.cells.length - 1].n, 1);
  const page = fs.readFileSync(path.join(out, '404-A', 'report.md'), 'utf8');
  assert.match(page, /ceiling[^\n]*PASS/);
  assert.doesNotMatch(page, /Waiting for R2/);
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'SUMMARY.md'), 'utf8'), /Waiting for R2/);
});

test('a bot cast\'s report no longer waits for R2: it says the model bars are read where model seats play', () => {
  const cast = [seat('a01', 'hustle'), seat('a02', 'scout')];
  const m = season({ cast, log: hauls(cast, { a01: 1, a02: 1 }) });
  assert.doesNotMatch(seasonReport(m), /Waiting for R2/);
  assert.doesNotMatch(summaryMarkdown(summarize([m, { ...m, rule: 'B' }])), /Waiting for R2/);
});
