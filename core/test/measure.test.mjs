// R4-1, the measurement (trunk docs/briefs/R4-astra-fixes.md, task 1; Astra's PROPOSAL §1 and "Open for slime" 4):
// - §27's haul values each minted copy at that copy's own first sale on the list, read from the record, not at its
//   trait's latest list price, so an overbid can't raise it; the old last-price mark and the opening price stay beside
//   it as shadows;
// - the crime bar reads as §27 words it: the median robber by haul out-earns the median shift worker, and that same
//   robber was arrested at least once; the separate medians stay as a shadow reading;
// - every count of seasons is also given as distinct seasons (the rule label stripped from events.jsonl).
// Every amount is read from N or from the season itself. The bench modules are imported whole, so a part missing
// fails its own test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { N } from '../numbers.mjs';
import { Game } from './helpers.mjs';
import * as report from '../bench/report.mjs';
import * as runner from '../bench/runner.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r4-measure-'));
const sum = xs => xs.reduce((t, x) => t + x, 0);
const PAIR = [{ id: 'a01', type: 'hustle', name: 't1' }, { id: 'a02', type: 'hustle', name: 't2' }];

// A night of the fixture, and the bench's record of it: the haul to date as the runner keeps it.
function play(g, nights) {
  g.night();
  const hauls = runner.haulsNow ? runner.haulsNow(g.s, g.log) : null;
  nights.push({
    night: g.s.day - 1, haul: runner.haulNow(g.s, g.log), ...(hauls ? { shadow: { mark: hauls.mark, open: hauls.open } } : {}),
    fights: [], hits: [], placesChanged: false,
  });
}

// Astra's fixture (her PROPOSAL §1, `overbid-score-fixture`): seed 404, two agents from $0 working the same shifts, no
// crime. a01 buys the same four copies of one plain common trait on four nights in a row, at the asking price; in the
// overbid season it bids N.hustleBase over the asking price for the fourth. Same copies, less cash.
function overbidSeason(over) {
  const g = new Game({ n: 2, seed: 404, rule: 'A', midseason: 'blackout' });
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the pair's
  // nights of work are hustles at the Mall (lawless, no star), $39 a night each where the shift paid $58, and a hustle
  // that pays more adds a star a night, so each starts with the $114 the shift paid it more over the six nights before
  // the first buy (test money, as if it had earned it): a01 has trunk's $228 on day 7 and can afford the overbid. Both
  // seasons start alike, so the overbid is still their one difference.
  for (const id of ['a01', 'a02']) g.grant(id, 114);
  const trait = Object.values(g.s.traits).find(t => t.tier === 'common' && !t.ability).id;
  const nights = [];
  // The first buy waits until the trait's price has fallen to its floor and a01 can afford four copies.
  while (g.s.day < 7) play(g, nights);
  const bids = [];
  for (let i = 0; i < 4; i++) {
    const ask = g.s.traits[trait].price;
    const bid = ask + (i === 3 ? over : 0);
    assert.equal(g.errand('a01', 'offer', { trait, amount: bid }).ok, true, `offer ${bid} on day ${g.s.day}`);
    bids.push(bid);
    play(g, nights);
    if (i === 3) nights.afterBuys = nights[nights.length - 1];
  }
  while (!g.s.over) play(g, nights);
  const m = report.seasonMetrics(g.s, g.log, { seed: 404, rule: 'A', midseason: 'blackout', nights }, PAIR);
  const mint = id => g.log.find(e => e.type === 'mint' && e.agent === id);
  return { g, m, trait, bids, nights, mint };
}
const control = overbidSeason(0);
// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): N.hustleBase is gone, so the overbid is its value, $50.
const overbid = overbidSeason(50);

test("Astra's overbid fixture: the same four copies for N.hustleBase less cash, and the overbid raises no haul; at any price a buy is as good as the cash it cost (§27, R4-1)", () => {
  const copies = s => s.mint('a01').cards.map(c => c.copy);
  assert.deepEqual(copies(overbid), copies(control), 'the same four copies mint');
  assert.equal(copies(control).length, 4);
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): N.hustleBase is gone, so the overbid is its value, $50.
  assert.equal(overbid.mint('a01').mainland, control.mint('a01').mainland - Math.round(50 * N.mainlandRate), 'the overbid costs its Mainland cash');
  assert.equal(overbid.g.events('arrest').length + overbid.g.events('rob').length + overbid.g.events('burgle').length, 0, 'no crime');
  // The haul: Mainland money plus each copy at what that copy itself sold for.
  for (const s of [control, overbid]) {
    assert.equal(s.m.haul.a01, s.mint('a01').mainland + sum(s.bids), 'each copy at its own sale');
    assert.equal(s.m.haul.a01, s.m.haul.a02, 'the buyer finishes level with the agent that kept its cash');
  }
  assert.ok(overbid.m.haul.a01 <= control.m.haul.a01, 'the overbid must not raise haul');
  assert.equal(overbid.m.haul.a01, control.m.haul.a01);
  assert.equal(overbid.m.haul.a02, control.m.haul.a02, "the other agent's haul is untouched");
  // The haul to date, the night after the fourth buy, as the runner keeps it for "#1 changes hands".
  assert.equal(overbid.nights.afterBuys.haul.a01, control.nights.afterBuys.haul.a01, 'nor the haul to date');
  assert.equal(overbid.m.bars.leaderChanges.changes, control.m.bars.leaderChanges.changes);
});

test('the shadows keep the old last-price mark and the opening price beside the official haul: the overbid lifts the mark by three times its extra cash and costs the opening price that cash', () => {
  const extra = overbid.bids[3] - control.bids[3];
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): N.hustleBase is gone, so the overbid is its value, $50.
  assert.equal(extra, 50);
  const cash = s => s.mint('a01').mainland;
  const open = control.g.log.find(e => e.type === 'season').drop.find(t => t.trait === control.trait).price;
  assert.equal(open, N.price.common[0]);
  for (const s of [control, overbid]) {
    // The card's headline is copy paid; its explicit mark retains the latest-price shadow.
    assert.deepEqual(s.mint('a01').cards.map(c => c.value), s.bids, 'every card at its original winning bid');
    assert.deepEqual(s.mint('a01').cards.map(c => c.mark), Array(4).fill(s.bids[3]), 'every mark at the last winning bid');
    assert.deepEqual(s.m.hauls.paid, s.m.haul);
    assert.equal(s.m.hauls.mark.a01, cash(s) + 4 * s.bids[3]);
    assert.equal(s.m.hauls.open.a01, cash(s) + 4 * open);
  }
  assert.equal(overbid.m.hauls.mark.a01 - control.m.hauls.mark.a01, 3 * extra, 'the latest winning bid reprices the three older copies');
  assert.equal(overbid.m.hauls.open.a01 - control.m.hauls.open.a01, -extra);
  // The nightly shadows, as the runner keeps them.
  assert.equal(overbid.nights.afterBuys.shadow.mark.a01 - control.nights.afterBuys.shadow.mark.a01, 3 * extra);
  assert.equal(overbid.nights.afterBuys.shadow.open.a01 - control.nights.afterBuys.shadow.open.a01, -extra);
  // The season report labels them.
  const page = report.seasonReport(overbid.m);
  for (const label of ['haul (copy paid)', 'last-price mark (shadow)', 'opening price (shadow)']) assert.ok(page.includes(label), label);
  assert.match(page, /own first sale on the list/);
});

test("a copy counts at its own first sale on the list, not at what its final holder gave for it: a gift counts at the price it first sold for, and a later sale of its trait doesn't reprice it (§27, R4-1)", () => {
  const g = new Game({ n: 2, seed: 404, rule: 'A', midseason: 'blackout' });
  const trait = Object.values(g.s.traits).find(t => t.tier === 'common' && !t.ability).id;
  const nights = [];
  while (g.s.day < 7) play(g, nights);
  const first = g.s.traits[trait].price;
  g.errand('a01', 'offer', { trait, amount: first });
  play(g, nights);
  const [gift] = g.events('buy', e => e.agent === 'a01').map(e => e.copy);
  assert.equal(g.errand('a01', 'give', { to: 'a02', copy: gift }).ok, true);
  const second = g.s.traits[trait].price;
  assert.equal(second, Math.round(first * (1 + N.priceRise)), 'the price rose after the sale');
  g.errand('a01', 'offer', { trait, amount: second });
  play(g, nights);
  while (!g.s.over) play(g, nights);
  const m = report.seasonMetrics(g.s, g.log, { seed: 404, rule: 'A', midseason: 'blackout', nights }, PAIR);
  const mint = id => g.log.find(e => e.type === 'mint' && e.agent === id);
  assert.deepEqual(mint('a02').cards.map(c => [c.copy, c.value]), [[gift, first]], 'the card carries its original purchase price');
  assert.deepEqual(mint('a02').cards.map(c => [c.copy, c.mark]), [[gift, second]], 'the explicit shadow carries the latest price');
  assert.equal(m.haul.a02, mint('a02').mainland + first, 'the gift counts at its own sale, though a02 paid nothing for it');
  assert.equal(m.haul.a01, mint('a01').mainland + second);
  assert.equal(m.hauls.mark.a02, mint('a02').mainland + second, 'the old mark reprices it');
});

test('the official haul reads every minted copy\'s sale from the record: a copy minted with no sale on the list stops the report rather than counting $0', () => {
  const ids = ['a01'];
  const season = { type: 'season', drop: [{ trait: 't1', price: N.price.common[0] }] };
  const mint = { type: 'mint', agent: 'a01', mainland: N.rent, cash: N.rent, cards: [{ copy: 'k1', trait: 't1', tier: 'common', value: N.price.common[1] }] };
  const buy = { type: 'buy', night: 1, agent: 'a01', trait: 't1', copy: 'k1', price: N.price.common[0] };
  assert.deepEqual(report.haulsOf([season, buy, mint], ids), {
    paid: { a01: N.rent + N.price.common[0] }, mark: { a01: N.rent + N.price.common[1] }, open: { a01: N.rent + N.price.common[0] },
  });
  assert.throws(() => report.haulsOf([season, mint], ids), /no sale on the list for k1/);
});

// --- the crime bar --------------------------------------------------------------------------------------------------
// Three shift workers at a season's wages; robbers whose hauls are given as multiples of it, and the arrests named.
function crimeSeason(robbers, arrested) {
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): N.hustleBase is gone, so a season's wages are its value, $50, a night.
  const wage = 50 * (N.nights - 1);
  const cast = [
    ...['a01', 'a02', 'a03'].map(id => ({ id, type: 'hustle', name: id })),
    ...robbers.map((x, i) => ({ id: `r${i + 1}`, type: i % 2 ? 'guess' : 'scout', name: `r${i + 1}` })),
  ];
  const state = { agents: Object.fromEntries(cast.map(c => [c.id, {}])), copies: {}, money: { in: {}, out: {} } };
  const log = [
    ...cast.map(c => ({ type: 'mint', agent: c.id, mainland: c.type === 'hustle' ? wage : Math.round(robbers[Number(c.id.slice(1)) - 1] * wage), cash: 0, cards: [] })),
    ...arrested.map((id, i) => ({ type: 'arrest', agent: id, night: i + 1, why: 'fight' })),
  ];
  return { wage, m: report.seasonMetrics(state, log, { seed: 1, rule: 'A', midseason: 'payday', nights: [] }, cast) };
}

test('the crime bar as §27 words it: the median robber by haul must out-earn the median shift worker and have been arrested itself; the separate medians stay as the shadow reading (R4-1)', () => {
  // The median earner never arrested, its two neighbours both: the separate medians pass, §27's robber doesn't.
  const a = crimeSeason([0.5, 2, 3], ['r1', 'r3']).m;
  assert.equal(a.bars.crimePays.robber, 'r2');
  assert.deepEqual([a.bars.crimePays.robberArrests, a.bars.crimePays.pass], [0, false]);
  assert.deepEqual([a.bars.crimeMedians.robberArrests, a.bars.crimeMedians.pass], [1, true]);
  // Only the median earner arrested: §27's robber passes, the separate medians (a median of 0 arrests) don't.
  const b = crimeSeason([0.5, 2, 3], ['r2']).m;
  assert.deepEqual([b.bars.crimePays.robber, b.bars.crimePays.robberArrests, b.bars.crimePays.pass], ['r2', 1, true]);
  assert.equal(b.bars.crimeMedians.pass, false);
  // The median robber arrested, but out-earning nobody.
  const c = crimeSeason([0.5, 0.75, 3], ['r2']);
  assert.equal(c.m.bars.crimePays.robberHaul, Math.round(0.75 * c.wage));
  assert.equal(c.m.bars.crimePays.pass, false);
  // The season report and the summary give both readings.
  assert.match(report.seasonReport(b), /the median robber, r2 \(guess\)/);
  const rows = report.summarize([a, { ...b, rule: 'B' }]).rows.filter(r => r.key.startsWith('crime')).map(r => [r.key, r.cells[2].pass]);
  assert.deepEqual(rows, [['crimePays', 1], ['crimeMedians', 1]]);
});

test('the median robber with an even count is the lower of the two middle ones, by its own haul; a tie on haul ranks the robber with fewer arrests first (R4-1)', () => {
  // Four robbers: the lower middle one decides, by its own haul and its own arrests.
  assert.deepEqual(['robber', 'pass'].map(k => crimeSeason([0.5, 2, 3, 4], ['r2']).m.bars.crimePays[k]), ['r2', true]);
  assert.equal(crimeSeason([0.5, 2, 3, 4], ['r3']).m.bars.crimePays.pass, false, 'the upper middle one arrested is not enough');
  // The lower middle one earns less than the shift worker, though the two middle ones' mean is more.
  const low = crimeSeason([0.25, 0.5, 3, 4], ['r1', 'r2', 'r3', 'r4']).m;
  assert.deepEqual([low.bars.crimePays.robber, low.bars.crimePays.pass], ['r2', false]);
  assert.equal(low.bars.crimeMedians.robberHaul > low.bars.crimeMedians.hustleHaul, true, "the shadow reading's median is the two middle ones' mean");
  // Two robbers tied at the median haul, one arrested: the one never arrested is the median robber, whichever id.
  for (const who of ['r2', 'r3']) {
    const tie = crimeSeason([0.5, 2, 2], [who]).m.bars.crimePays;
    assert.deepEqual([tie.robberArrests, tie.pass], [0, false], `${who} arrested`);
  }
});

// --- distinct seasons -----------------------------------------------------------------------------------------------
test('distinct seasons: two seasons are one when their events.jsonl match with the rule label stripped; every count of seasons says how many distinct seasons pass, and when its passes rest on one seed (R4-1)', () => {
  const lines = rule => `{"n":0,"type":"season","seed":1,"rule":"${rule}"}\n{"n":1,"type":"season_end","seed":1,"rule":"${rule}"}\n`;
  assert.equal(report.seasonKeyOf(lines('A')), report.seasonKeyOf(lines('B')));
  assert.notEqual(report.seasonKeyOf(lines('A')), report.seasonKeyOf(lines('A').replace('"seed":1', '"seed":2')));
  // Seed 1 plays one season under A and B; seed 2 two. Only seed 1's has three betrayals.
  const cast = [{ id: 'a01', type: 'hustle', name: 'x' }, { id: 'a02', type: 'hustle', name: 'y' }];
  const state = { agents: { a01: {}, a02: {} }, copies: {}, money: { in: {}, out: {} } };
  const betray = n => ({ type: 'betray', kind: 'walk', by: 'a01', victims: ['a02'], night: n });
  const season = (seed, rule, extra = []) => {
    const log = [{ type: 'season', seed, rule }, ...extra, { type: 'season_end', seed, rule }];
    return report.seasonMetrics(state, log, { seed, rule, midseason: 'payday', nights: [] }, cast);
  };
  const three = [betray(1), betray(2), betray(3)];
  const results = [season(1, 'A', three), season(1, 'B', three), season(2, 'A'), season(2, 'B', [betray(4)])];
  assert.equal(new Set(results.map(r => r.seasonKey)).size, 3);
  const count = report.seasonCount(results, r => r.bars.betrayals.pass);
  assert.deepEqual([count.pass, count.n, count.distinct, count.of, count.seeds], [2, 4, 1, 3, [1]]);
  assert.equal(report.countText(count), '2/4 · 1/3 distinct, one seed (1)');
  const sum = report.summarize(results);
  assert.equal(sum.rows.find(r => r.key === 'betrayals').cells[2].count.distinct, 1);
  const md = report.summaryMarkdown(sum);
  assert.match(md, /\| ≥ 3 betrayals a season \| 1\/2 \(50%\) \| 1\/2 \(50%\) \| 2\/4 \(50%\) · 1\/3 distinct, one seed \(1\) \|/);
  assert.match(md, /\*\*Haul, three ways\*\*/);
});

test("bars.mjs: each run's seasons and distinct seasons, every count also as distinct seasons, a row for each shadow under every row that reads haul, and a run from before R4-1 refused (R4-1)", async () => {
  const out = path.join(tmp, 'bars-run');
  const r = spawnSync(process.execPath, [path.join(here, '..', 'bench', 'bench.mjs'), '--seeds', '404-404', '--rules', 'A,B', '--cast', 'layer1', '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const strip = d => fs.readFileSync(path.join(out, d, 'events.jsonl'), 'utf8').replace(/"rule":"[AB]"/g, '');
  const distinct = strip('404-A') === strip('404-B') ? 1 : 2;
  const { readRun, table } = await import('../bench/bars.mjs');
  const run = readRun(out);
  assert.deepEqual([run.n, run.distinct], [2, distinct]);
  const page = table([run]);
  assert.ok(page.includes(`| bar | bars-run (2 seasons, ${distinct} distinct) |`), page.split('\n')[0]);
  const rowOf = label => page.split('\n').find(l => l.startsWith(`| ${label} |`));
  for (const label of ['Turtle below the median haul (≥ 90% of seasons)', 'A show-worthy event every night']) {
    assert.match(rowOf(label), new RegExp(`^\\| .+ \\| \\d/2 · \\d/${distinct} distinct`), label);
  }
  const lines = page.split('\n');
  const crime = lines.findIndex(l => l.startsWith('| Crime pays, with risk: the median robber by haul'));
  assert.ok(crime > 0);
  assert.deepEqual(lines.slice(crime + 1, crime + 3).map(l => l.split(' | ')[0]), ['| ↳ last-price mark (shadow)', '| ↳ opening price (shadow)']);
  assert.ok(lines.some(l => l.startsWith("| Crime pays, with risk, the shadow reading")));
  // A season made before R4-1 keeps no shadows: the run is refused, not misread.
  const old = path.join(tmp, 'bars-old');
  fs.cpSync(out, old, { recursive: true });
  const res = path.join(old, '404-A', 'result.json');
  const { shadow, hauls, ...before } = JSON.parse(fs.readFileSync(res, 'utf8'));
  assert.ok(shadow && hauls);
  fs.writeFileSync(res, JSON.stringify(before));
  assert.throws(() => readRun(old), /before R4-1/);
});

test('cleanup', () => {
  fs.rmSync(tmp, { recursive: true, force: true });
});
