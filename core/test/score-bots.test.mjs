// L4-4, the big score in play (GAME.md §4, §7, §9, §12, §13, §15, §19, §25, §27): in the layer4 cast every seat plays
// the layer3 cast's bots and habits and, each from its own view and for its own gain, the big score. Gunrunners build
// forged warrants and fakes and sell them, a warrant to one crew a night until the double-sell pays; crews and robbers
// job the vault when its contents are worth it and their strength beats its defence as they can read it; Cops guard a
// vault worth a job; buyers in shades refuse the fakes their shades show, and no bot reads a fake from its copy id
// (call 1). The report counts the vault, the warrants, the fakes and the double-sells, and §27's vault bar; the haul
// and "most of the drop sells" skip fakes, and a vault job is show-worthy. Each test imports what it needs itself, so
// each fails on its own before the bots exist. Amounts come from N, the bots' settings or the state a test set up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Game, ITEMS, abilityCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, moveCopy } from '../rules/state.mjs';
import { N } from '../numbers.mjs';
import { rng } from '../rng.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(here, '..', 'bench', 'runner.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-score-bots-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const bots = () => import('../bench/bots.mjs');
const readLog = dir => fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
// §6, §13: the Evidence Vault is at Precinct 9, in Glasswall, the city kit's downtown.
const GLASSWALL = 'downtown';
const JOB = { kind: 'vault', place: GLASSWALL };
const ROBBERS = ['scout', 'guess'];
const LAYLOW = { kind: 'laylow', place: 'suburbs' };
const RANK = { common: 0, rare: 1, epic: 2, grail: 3 };
const REFUSED = 'the fence takes no fakes';

// A season with the layer4 cast in the helpers' Game, so every errand and night goes through the rules with the ledger
// checked. `seat(id)` is a bot's config as the runner hands it over and `ctx` its context for a round or the night;
// `rest(day)` settles the nights to that day with everyone laying low, but for the plays named on the nights named.
async function world(seed) {
  const { makeCast, CASTS } = await bots();
  const cast = makeCast(seed, CASTS.layer4);
  const g = new Game({ n: 1 });
  const r = newSeason({ seed, rule: 'A', midseason: 'payday', items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  g.cast = cast;
  g.seat = id => ({ ...cast.find(c => c.id === id), every: true });
  g.ctx = (id, round) => ({ seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', id, g.s.day, round) });
  g.rest = (day, plays = {}, nights = []) => {
    while (g.s.day < day) g.night(nights.includes(g.s.day) ? plays : {}, { filler: LAYLOW });
  };
  Object.keys(g.s.agents).forEach(id => g.grant(id, 2 * N.nights * N.rent));
  return g;
}
// Test-only goods, and vault contents, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
function vaultHolds(g, cash) {
  g.s.money.in.test = (g.s.money.in.test || 0) + cash;
  g.s.vault.cash += cash;
  checkLedger(g.s, 'vault');
}
// The seats of a strategy, and the seats that work a trade, in id order.
const seatsOf = (g, type) => g.cast.filter(c => c.type === type).map(c => c.id);
const working = (g, trade) => g.cast.filter(c => c.trade === trade && (c.type === trade || c.works)).map(c => c.id);
// The cast's crews, formed on day 1 as their leaders form them; the larger first.
function formCrews(g) {
  const crews = [];
  for (const c of g.cast.filter(x => x.type === 'crew' && x.role === 'leader')) {
    g.errand(c.id, 'crew_form', { name: c.crewName });
    for (const m of c.mates) {
      g.errand(c.id, 'crew_invite', { agent: m });
      g.errand(m, 'crew_join', { crew: g.s.agents[c.id].crew });
    }
    crews.push([c.id, ...c.mates]);
  }
  return crews.sort((x, y) => y.length - x.length);
}
// `by` asks `to` for a sit-down, `to` takes it, and `by` says an offer on these terms. Returns the sit-down's id.
function offer(g, by, to, terms) {
  g.errand(by, 'ask', { to });
  const sd = Object.values(g.s.sitdowns).find(x => x.a === by && x.b === to && x.state === 'asked').id;
  g.errand(to, 'answer', { sitdown: sd, accept: true });
  g.errand(by, 'say', { sitdown: sd, say: 'offer', terms });
  return sd;
}
const jobDays = async () => {
  const { jobDay } = await bots();
  return Array.from({ length: N.nights }, (_, i) => i + 1).filter(jobDay);
};

test("the layer4 cast: the layer3 cast's seats and roles, every one playing the big score; every older cast plays none of it (§25)", async () => {
  const { makeCast, CASTS } = await bots();
  const { mixOf, castName, parseArgs, BENCH_ARGS, RUNNER_ARGS } = await import('../bench/runner.mjs');
  assert.ok(CASTS.layer4, 'a cast called layer4');
  assert.equal(mixOf({ cast: 'layer4' }), CASTS.layer4);
  assert.equal(castName(CASTS.layer4), 'layer4');
  for (const known of [BENCH_ARGS, RUNNER_ARGS]) assert.deepEqual(parseArgs(['--cast', 'layer4'], known), { cast: 'layer4', set: [] });
  for (const seed of [404, 405]) {
    const cast = makeCast(seed, CASTS.layer4);
    assert.deepEqual(cast.map(({ score, ...c }) => c), makeCast(seed, CASTS.layer3), `seed ${seed}: the layer3 cast's seats and roles`);
    assert.ok(cast.every(c => c.score === true), 'every seat plays the big score');
  }
  for (const name of ['layer3', 'trades', 'layer2', 'layer1']) assert.ok(makeCast(404, CASTS[name]).every(c => !('score' in c)), `the ${name} cast plays none of it`);
});

test('warrants (§9, §12): a Gunrunner hands one over to an order at its price and is owed it; one crew a night, so a second crew ordering for a night it has sold one for hears it has none, until no job day is left after that night, when it sells to both: the double-sell (GAP gap.doubleSell)', async () => {
  const { sellWarrants, warrantPrice, doubleSellPays } = await bots();
  const jobs = await jobDays();
  const last = jobs[jobs.length - 1];
  for (const [night, double] of [[jobs[jobs.length - 2], false], [last, true], [N.nights, true]]) {
    assert.equal(doubleSellPays(night), double, `night ${night}`);
    const g = await world(409);
    const seller = working(g, 'gunrunner')[0];
    // Two shift workers in no crew: each a crew of its own.
    const [b1, b2] = seatsOf(g, 'hustle');
    stock(g, seller, 'warrants', 2);
    const price = warrantPrice(g.view(seller));
    for (const b of [b1, b2]) offer(g, b, seller, { what: 'trade', goods: { warrants: 1 }, cash: price, night });
    const memo = {};
    const out = sellWarrants(g.view(seller), g.seat(seller), memo, []);
    const sold = double ? [b1, b2] : [b1];
    assert.deepEqual(out.filter(e => e.kind === 'give'), sold.map(to => ({ kind: 'give', to, goods: { warrants: 1 } })), `night ${night}`);
    assert.deepEqual(out.filter(e => e.kind === 'say').map(e => [e.say, e.terms.cash]), double ? [] : [['answer', 0]], 'the second crew hears it has none');
    // R5-deals (the review: one debt book): what it is owed is on the deal record, read from its own view once its
    // gives are handed over.
    for (const e of out) g.errand(seller, e.kind, e);
    assert.deepEqual(g.view(seller).me.deals.filter(d => d.owes === 'them').map(d => [d.with, d.due]), sold.map(b => [b, price]), 'it is owed the price');
  }
});

test("warrants: below its price it sells none; out of stock it says so and builds one that night from its parts, a build the legal plays never list (§9, §38; GAP gap.warrants)", async () => {
  const { sellWarrants, warrantPrice, makeBot } = await bots();
  const g = await world(410);
  const seller = working(g, 'gunrunner').find(id => g.seat(id).type === 'gunrunner');
  const [cheap, buyer] = seatsOf(g, 'hustle');
  stock(g, seller, 'warrants', 1);
  const price = warrantPrice(g.view(seller));
  offer(g, cheap, seller, { what: 'trade', goods: { warrants: 1 }, cash: price - 1, night: g.s.day });
  const memo = {};
  assert.deepEqual(sellWarrants(g.view(seller), g.seat(seller), memo, []).filter(e => e.kind === 'give'), [], 'below its price');
  g.errand(seller, 'give', { to: cheap, goods: { warrants: 1 } });
  offer(g, buyer, seller, { what: 'trade', goods: { warrants: 1 }, cash: price, night: g.s.day });
  const out = sellWarrants(g.view(seller), g.seat(seller), memo, []);
  assert.deepEqual(out.map(e => [e.kind, e.terms && e.terms.cash]), [['say', 0]], 'it has none');
  stock(g, seller, 'parts', N.build.warrants);
  const { play } = makeBot(g.seat(seller), memo).night(g.view(seller), g.ctx(seller, 'night'));
  assert.deepEqual([play.kind, play.warrants], ['build', 1], JSON.stringify(play));
  assert.ok(!g.view(seller).legal.some(l => l.warrants), 'the legal plays never list warrants');
});

// A crew strong enough to beat the vault's flat defence by `margin` and no more, by the public record: guns for its
// first members, stocked before night 1, so the holdings records show them from day 3.
function armCrew(g, crew, margin) {
  const guns = N.vault.defence + 1 + margin - crew.length;
  assert.ok(guns >= 0 && guns <= crew.length, `a crew of ${crew.length} can't be ${N.vault.defence + 1 + margin} strong`);
  crew.slice(0, guns).forEach(m => stock(g, m, 'guns', 1));
}

test("vault jobs (§7, §13): a crew's leader buys a warrant the day before a job day when the vault, less its price, beats the crew's best job and the crew's strength beats the vault's defence as it can read it; on the job night it jobs the vault, its crew backs it; not when the guards the record last showed hold it", async () => {
  const { warrantErrands, warrantPrice, makeBot } = await bots();
  const jobs = await jobDays();
  const day = jobs.find(d => d > 3);
  for (const guarded of [false, true]) {
    const g = await world(411);
    const [crew] = formCrews(g);
    const [leader, mate] = crew;
    armCrew(g, crew, 0);
    // A Cop guarding the vault on the nights the record shows the day before the job and on it: as strong as the crew's
    // margin over the flat defence, so the defence the leader reads holds.
    const cop = seatsOf(g, 'hustle').find(id => !crew.includes(id));
    g.rest(day - 1, guarded ? { [cop]: { kind: 'guard' } } : {}, [day - 3, day - 2]);
    vaultHolds(g, 10 * N.price.rare[0]);
    const memo = {};
    const ask = warrantErrands(g.view(leader), g.ctx(leader, 1), g.seat(leader), memo, []);
    if (guarded) {
      assert.deepEqual(ask, [], 'the guards hold it: no warrant');
      stock(g, leader, 'warrants', 1);
      g.rest(day, { [cop]: { kind: 'guard' } }, [day - 1]);
      assert.notDeepEqual(makeBot(g.seat(leader), {}).night(g.view(leader), g.ctx(leader, 'night')).play, JOB, 'no job');
      continue;
    }
    assert.equal(ask.length, 1);
    assert.equal(ask[0].kind, 'ask');
    const seller = ask[0].to;
    assert.ok(working(g, 'gunrunner').includes(seller) && !crew.includes(seller), 'a Gunrunner outside its crew');
    g.errand(leader, 'ask', { to: seller });
    g.errand(seller, 'answer', { sitdown: Object.values(g.s.sitdowns).find(x => x.a === leader && x.b === seller).id, accept: true });
    const order = warrantErrands(g.view(leader), g.ctx(leader, 2), g.seat(leader), memo, []);
    assert.deepEqual(order.map(e => [e.kind, e.say, e.terms]), [['say', 'offer', { what: 'buy', goods: { warrants: 1 }, cash: warrantPrice(g.view(leader)), night: day }]]);
    stock(g, leader, 'warrants', 1);
    g.rest(day);
    assert.deepEqual(makeBot(g.seat(leader), {}).night(g.view(leader), g.ctx(leader, 'night')).play, JOB, 'the leader jobs the vault');
    assert.deepEqual(makeBot(g.seat(mate), {}).night(g.view(mate), g.ctx(mate, 'night')).play, { kind: 'back', target: leader }, 'its crew backs it');
  }
});

test("on the last night a crew's leader holding a warrant jobs the vault on the way to the boat when its crew's strength beats the defence it reads, and boards when it doesn't; its crew walks with it (§13, §15)", async () => {
  const { makeBot } = await bots();
  for (const margin of [-1, 0]) {
    const g = await world(412);
    const [crew] = formCrews(g);
    const [leader, mate] = crew;
    armCrew(g, crew, margin);
    g.rest(N.nights);
    vaultHolds(g, 10 * N.price.rare[0]);
    stock(g, leader, 'warrants', 1);
    const { play } = makeBot(g.seat(leader), {}).night(g.view(leader), g.ctx(leader, 'night'));
    assert.equal(play.kind, margin >= 0 ? 'vault' : 'board', `strength over the flat defence by ${margin + 1}`);
    assert.deepEqual(makeBot(g.seat(mate), {}).night(g.view(mate), g.ctx(mate, 'night')).play, { kind: 'back', target: leader });
  }
});

test("guards (§13): when the vault is worth a job and a crew on the board could beat its flat defence, the fewest Cops it takes, the strongest first, guard it, the same from every Cop's view; none when it isn't worth a job or no crew could (GAP gap.guard)", async () => {
  const { guardPlan, warrantPrice } = await bots();
  for (const [margin, worth, guards] of [[0, 1, true], [1, 1, true], [0, 0, false], [-1, 1, false]]) {
    const g = await world(413);
    const [crew] = formCrews(g);
    armCrew(g, crew, margin);
    // Every seat that works the Cop trade patrols on night 2, so the record shows them at Cop work from day 4.
    const cops = working(g, 'cop');
    g.rest(4, Object.fromEntries(cops.map(c => [c, { kind: 'patrol', place: 'strip' }])), [2]);
    vaultHolds(g, worth ? 2 * warrantPrice(g.view(cops[0])) : warrantPrice(g.view(cops[0])));
    const plan = guardPlan(g.view(cops[0]), null);
    for (const c of cops) assert.deepEqual(guardPlan(g.view(c), null), plan, `the same from ${c}'s view`);
    if (!guards) {
      assert.equal(plan, null, `margin ${margin}, worth a job: ${!!worth}`);
      continue;
    }
    // A Cop is 1 strong, 2 with a gun the record shows (one armed as a member of the crew, if it is one).
    const strength = ids => ids.map(id => 1 + (g.s.agents[id].goods.guns ? 1 : 0));
    const total = ids => strength(ids).reduce((t, x) => t + x, 0);
    const over = N.vault.defence + 1 + margin - N.vault.defence;
    assert.ok(plan.every(id => cops.includes(id)), 'Cops guard');
    assert.ok(total(plan) > over || plan.length === cops.length, 'the guards hold, or every Cop guards');
    assert.ok(total(plan.slice(0, -1)) <= over, 'no more of them than it takes');
    assert.deepEqual(strength(plan), strength(plan).slice().sort((x, y) => y - x), 'the strongest first');
  }
});

test("fakes, the seller (§4, §9): a seat that works the Gunrunner trade fakes a rare-or-better trait on sale for a buyer it can see: one whose fit is on the board with no shades in it, with the public cash for its price and its own shopping and nothing as rare in that slot, never one in shades or hooded; its price is under the list's, and covers what the fake costs", async () => {
  const { fakeTarget, fakeBuyers, fakePrice, fakeCost } = await bots();
  const g = await world(414);
  g.rest(N.waves.rare + 1);
  const seller = working(g, 'gunrunner')[0];
  const [rich, next] = seatsOf(g, 'hustle');
  g.grant(rich, 8 * N.price.rare[0]);
  g.grant(next, 6 * N.price.rare[0]);
  g.rest(g.s.day + 2);
  const v = g.view(seller);
  const deal = fakeTarget(v, g.ctx(seller, 1), {});
  const t = v.board.list.find(x => x.trait === deal.trait);
  assert.ok(RANK[t.tier] >= RANK.rare && t.opens <= g.s.day, 'a rare-or-better trait on sale');
  assert.ok(fakePrice(v, t.trait) > fakeCost(v) && fakePrice(v, t.trait) < t.price, 'its price covers what it costs, under the list\'s');
  assert.ok(!v.me.pieces.some(p => p.slot === t.slot), 'in a slot the seller fills with nothing');
  assert.ok(fakeBuyers(v, t.trait, {}).includes(deal.to), 'a buyer for it');
  // The dearest trait on sale: only the two richest can pay for its fake, the richer first.
  const dear = v.board.list.filter(x => x.opens <= g.s.day).sort((x, y) => y.price - x.price)[0].trait;
  assert.deepEqual(fakeBuyers(v, dear, {}), [rich, next]);
  // In real shades, or hooded, it is never offered one.
  g.hand(rich, abilityCopy(g.s, 'shades'), { wear: true });
  assert.deepEqual(fakeBuyers(g.view(seller), dear, {}), [next], 'not the buyer in shades');
  g.hand(next, abilityCopy(g.s, 'hoodie'), { wear: true });
  assert.deepEqual(fakeBuyers(g.view(seller), dear, {}), [], 'nor a hooded one');
});

test("fakes, the buyer (§4, §19): offered a piece it sees on the seller, a bargain for a slot it wants, a seat orders it, fake or real, as no view tells it a fake by its copy id; in real shades it refuses the fake, naming the piece, and still orders the real one (call 1)", async () => {
  const { buyPieces, fakePrice } = await bots();
  const g = await world(415);
  const [maker, other] = working(g, 'gunrunner');
  // Two buyers: one is offered the fake, the other a real copy of the same trait.
  const buyers = seatsOf(g, 'hustle').slice(0, 2);
  const shades = [0, 1].map(i => abilityCopy(g.s, 'shades', i));
  // A plain rare in a slot shades don't fill, faked by the maker tonight at home.
  const trait = Object.values(g.s.traits).filter(t => t.tier === 'rare' && !t.ability && t.slot !== g.s.copies[shades[0]].slot).sort((x, y) => (x.id < y.id ? -1 : 1))[0];
  g.rest(N.waves.rare);
  stock(g, maker, 'parts', N.build.fakes);
  const r = g.night({ [maker]: { kind: 'build', fake: trait.id } }, { filler: LAYLOW });
  const fake = r.newEvents.find(e => e.type === 'fake' && e.act === 'made').copy;
  assert.ok(!trait.copies.includes(fake), "control: the fake is outside its trait's copies");
  const real = g.hand(other, trait.copies.find(k => g.s.copies[k].holder.k === 'list'));
  g.errand(maker, 'dress', { fit: { [trait.slot]: fake } });
  g.errand(other, 'dress', { fit: { [trait.slot]: real } });
  buyers.forEach(b => g.grant(b, 2 * N.price.rare[0]));
  const price = fakePrice(g.view(maker), trait.id);
  const deals = [[maker, fake], [other, real]].map(([s, k], i) => ({ buyer: buyers[i], k, sd: offer(g, s, buyers[i], { what: 'trade', piece: k, cash: price }) }));
  const answers = () => deals.map(d => buyPieces(g.view(d.buyer), g.ctx(d.buyer, 2), g.seat(d.buyer), {}, []).filter(e => e.sitdown === d.sd).map(e => [e.say, e.terms]));
  const order = k => [['offer', { what: 'buy', piece: k, cash: price }]];
  assert.deepEqual(answers(), [order(fake), order(real)], 'without shades it can tell neither');
  buyers.forEach((b, i) => g.hand(b, shades[i], { wear: true }));
  assert.deepEqual(answers(), [[['answer', { what: 'buy', piece: fake, cash: 0 }]], order(real)], 'its shades show the fake');
});

test('seasons with the layer4 cast: every play legal, and every errand but the fence turning a fake away; each act of the big score has its reason: vault jobs led by crews\' leaders and robbers, guards by Cops, warrants and fakes built and sold by Gunrunners, a warrant bought by a crew\'s leader or a robber, a fake made once the list closes and sold only by its maker, refused only when it is one, a double-sell only once no job day is left (§9, §12, §13, §25)', async () => {
  const { CASTS, doubleSellPays } = await bots();
  const { runSeason } = await import('../bench/runner.mjs');
  const wares = c => c.trade === 'gunrunner' && (c.type === 'gunrunner' || c.works);
  for (const [seed, rule] of [[404, 'A'], [405, 'B'], [406, 'A']]) {
    const { dir, metrics } = runSeason({ seed, rule, outDir: path.join(tmp, 'seasons'), mix: CASTS.layer4 });
    const ck = JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8'));
    const log = readLog(dir);
    const seat = Object.fromEntries(ck.cast.map(c => [c.id, c]));
    const copy = k => ck.state.copies[k];
    assert.equal(metrics.ledger.failed, 0);
    assert.deepEqual(log.filter(e => e.type === 'invalid' && e.why !== REFUSED).map(e => `${e.agent} ${e.errand || e.kind}: ${e.why}`), [], `seed ${seed}: no invalid play or errand`);
    for (const p of log.filter(e => e.type === 'play' && e.kind === 'vault')) {
      const c = seat[p.agent];
      assert.ok((c.type === 'crew' && c.role === 'leader') || ROBBERS.includes(c.type), `${p.agent} (${c.type}) jobbed the vault`);
    }
    for (const p of log.filter(e => e.type === 'play' && e.kind === 'guard')) assert.ok(seat[p.agent].trade === 'cop' && seat[p.agent].type !== 'hustle', `${p.agent} guarded`);
    for (const e of log.filter(x => x.type === 'craft' && (x.warrants || x.fakes))) assert.ok(wares(seat[e.agent]), `${e.agent} built`);
    for (const e of log.filter(x => x.type === 'give' && x.goods && x.goods.warrants)) {
      const c = seat[e.to];
      assert.ok(wares(seat[e.from]) && ((c.type === 'crew' && c.role === 'leader') || ROBBERS.includes(c.type)), `${e.from} sold ${e.to} (${c.type}) a warrant`);
    }
    for (const e of log.filter(x => x.type === 'fake' && x.act === 'made')) assert.ok(e.night >= N.listLastNight, `a fake made on night ${e.night}`);
    for (const e of log.filter(x => x.type === 'give' && x.copy && copy(x.copy).fake)) assert.equal(e.from, copy(e.copy).maker, 'a fake is sold only by its maker');
    for (const e of log.filter(x => x.type === 'say' && x.say === 'answer' && x.terms.piece)) assert.ok(copy(e.terms.piece).fake, 'a refusal naming a piece names a fake');
    for (const e of log.filter(x => x.type === 'betray' && x.kind === 'double-sell')) assert.ok(doubleSellPays(e.night), `a double-sell on night ${e.night}`);
  }
});

test('the layer4 cast replays: the same seed gives the same log, also after a kill mid-write and a resume (§23, §26)', () => {
  const run = (out, ...extra) => spawnSync(process.execPath, [runner, '--seed', '413', '--rule', 'B', '--out', path.join(tmp, out), '--quiet', '--cast', 'layer4', ...extra], { encoding: 'utf8' });
  const logOf = out => fs.readFileSync(path.join(tmp, out, '413-B', 'events.jsonl'));
  assert.equal(run('one').status, 0);
  assert.equal(run('two').status, 0);
  assert.ok(logOf('one').equals(logOf('two')), 'two runs, one log');
  assert.equal(run('killed', '--die-at', 'mid-write:7').signal, 'SIGKILL');
  const resumed = run('killed', '--resume');
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.ok(logOf('killed').equals(logOf('one')), 'the resumed log differs');
});

test("the report's big score: vault jobs tried, won, lost and their arrests; the vault's money in and out; guard nights; warrants built, handed over and used; fakes made, sold, refused, seen through shades and exposed; double-sells; §27's vault bar a season and across seasons", async () => {
  const { seasonMetrics, seasonReport, summarize, summaryMarkdown } = await import('../bench/report.mjs');
  const cast = [
    { id: 'a01', type: 'crew', role: 'leader', trade: 'smuggler', name: 'a01', layer: 2, works: true, drugs: true, score: true },
    { id: 'a02', type: 'gunrunner', trade: 'gunrunner', name: 'a02', layer: 2, drugs: true, score: true },
    { id: 'a03', type: 'hustle', trade: 'cop', name: 'a03', layer: 2, drugs: true, score: true },
    { id: 'a04', type: 'cop', trade: 'cop', name: 'a04', layer: 2, drugs: true, score: true },
  ];
  const [fine, price] = [N.bailPerStar, N.price.rare[1]];
  const copies = {
    k1: { trait: 't1', tier: 'rare', holder: { k: 'gone' }, sold: null, fake: true, maker: 'a02' },
    k2: { trait: 't1', tier: 'rare', holder: { k: 'list' }, sold: null, hist: [] },
    k3: { trait: 't2', tier: 'common', holder: { k: 'gone' }, sold: 1, hist: [] },
  };
  const state = { agents: Object.fromEntries(cast.map(c => [c.id, {}])), copies, money: { in: {}, out: {} }, goods: { in: {}, out: {} } };
  const log = [
    { type: 'seized', night: 3, agent: 'a03', copy: 'k3', trait: 't2', fine },
    { type: 'seized', night: 4, agent: 'a01', copy: null, trait: null, fine },
    { type: 'vault', night: 5, leader: 'a01', members: ['a01'], copies: ['k3'], cash: fine },
    { type: 'gone', from: 'vault', copies: [], cash: fine },
    { type: 'guard', night: 5, agent: 'a04', place: GLASSWALL, wage: N.copPay.guard },
    { type: 'guard', night: 6, agent: 'a04', place: GLASSWALL, wage: N.copPay.guard },
    { type: 'craft', night: 2, agent: 'a02', guns: 0, lockpicks: 0, fakes: 1, parts: N.build.fakes },
    { type: 'craft', night: 4, agent: 'a02', guns: 0, lockpicks: 0, warrants: 1, parts: N.build.warrants },
    { type: 'give', from: 'a02', to: 'a01', copy: null, trait: null, cash: 0, goods: { warrants: 1 } },
    { type: 'used', night: 5, agent: 'a01', goods: { warrants: 1 }, maker: 'a02' },
    { type: 'fake', act: 'made', night: 2, agent: 'a02', copy: 'k1', trait: 't1', tier: 'rare' },
    { type: 'say', sitdown: 's1', from: 'a02', to: 'a03', say: 'offer', terms: { what: 'trade', piece: 'k1', cash: price } },
    { type: 'say', sitdown: 's1', from: 'a03', to: 'a02', say: 'answer', terms: { what: 'trade', piece: 'k1', cash: 0 } },
    { type: 'say', sitdown: 's2', from: 'a02', to: 'a01', say: 'offer', terms: { what: 'trade', piece: 'k1', cash: price } },
    { type: 'say', sitdown: 's2', from: 'a01', to: 'a02', say: 'offer', terms: { what: 'trade', piece: 'k1', cash: price } },
    { type: 'give', from: 'a02', to: 'a01', copy: 'k1', trait: 't1', cash: 0 },
    { type: 'invalid', agent: 'a01', errand: 'fence_list', why: REFUSED, kind: 'never' },
    { type: 'fake', act: 'exposed', agent: 'a01', copy: 'k1', trait: 't1', tier: 'rare' },
    { type: 'betray', kind: 'double-sell', by: 'a02', victims: ['a01', 'a03'], night: 11 },
  ];
  const group = (leader, strength) => ({ leader, members: [leader], strength });
  const vault = {
    kind: 'vault', target: null, place: GLASSWALL, level: 'heavy', winner: 'a01', attackers: [group('a01', N.vault.defence + 2), group('a03', 1)],
    defence: N.vault.defence + 1, cops: 0, arrested: ['a03'], backingDecided: false, targetHitBacker: false, guards: ['a04'], guard: 1,
  };
  const night = (n, fights = [], extra = {}) => ({ night: n, placesChanged: false, fights, cutByTarget: [], hits: [], haul: {}, guns: null, ...extra });
  const seen = { fakes: { worn: ['k1'], seen: ['k1'] } };
  const bench = { seed: 1, rule: 'A', midseason: 'payday', nights: [night(5, [vault], seen), night(6, [], seen)] };
  const m = seasonMetrics(state, log, bench, cast);
  const s = m.score;
  assert.deepEqual(s.jobs, { tried: 2, won: 1, lost: 1, arrests: 1, guarded: 1 });
  assert.deepEqual(s.vault, { in: 2 * fine, inPieces: 1, taken: fine, takenPieces: 1, gone: fine, gonePieces: 0 });
  assert.equal(s.guards, 2);
  assert.deepEqual(s.warrants, { built: 1, sold: 1, used: 1 });
  assert.deepEqual(s.fakes, { made: 1, sold: 1, soldFor: price, refused: 1, fence: 1, seen: 1, exposed: 1 });
  assert.equal(s.doubleSells, 1);
  assert.equal(m.bars.betrayals.byKind['double-sell'], 1, 'a double-sell is a betrayal');
  assert.deepEqual(m.bars.vault, { jobs: 2, pass: true });
  // The fixes: the drop counts only its copies, and a vault job is show-worthy.
  assert.deepEqual([m.bars.dropSells.sold, m.bars.dropSells.total], [1, 2], 'a fake is no copy of the drop');
  assert.ok(!m.bars.showWorthy.missing.includes(5) && m.bars.showWorthy.missing.includes(6), 'a vault job is show-worthy');
  const page = seasonReport(m);
  assert.match(page, /\*\*The big score\*\*/);
  assert.match(page, /≥ 3 betrayals \(walk, rug, turn, rat, double-sell\)/);
  assert.match(page, /Someone jobs the vault/);
  const none = seasonMetrics(state, log, { ...bench, nights: [night(5), night(6)] }, cast);
  assert.deepEqual(none.bars.vault, { jobs: 0, pass: false });
  const sum = summarize([m, { ...none, rule: 'B' }]);
  assert.deepEqual(sum.rows.find(r => r.key === 'vault').cells.map(c => [c.pass, c.n]), [[1, 1], [0, 1], [1, 2]]);
  assert.deepEqual(sum.keyNumbers.find(k => k.group === 'all').score.jobs, { tried: 2, won: 1, lost: 1, arrests: 1, guarded: 1 });
  assert.match(summaryMarkdown(sum, { cast: 'layer4' }), /\*\*The big score, all seasons\*\*/);
  // The layer3 cast's report has none of it.
  const layer3 = seasonMetrics(state, log, bench, cast.map(({ score, ...c }) => c));
  assert.equal('score' in layer3, false);
  assert.equal('vault' in layer3.bars, false);
  assert.equal(seasonReport(layer3).includes('The big score'), false);
});

test("the haul to date skips fakes: an agent's and a crew stash's pieces count at what that copy first sold for on the list (R4-1), a fake at nothing (§27)", async () => {
  const { haulNow } = await import('../bench/runner.mjs');
  // R4-1: the copy's own sale on the record, not its trait's later price.
  const paid = N.price.rare[0];
  const s = {
    over: false, agents: { a01: { cash: N.rent }, a02: { cash: 0 } }, traits: { t1: { last: N.price.rare[1] } },
    copies: {
      k1: { trait: 't1', holder: { k: 'agent', id: 'a01' } },
      k2: { trait: 't1', holder: { k: 'agent', id: 'a02' }, fake: true, maker: 'a01' },
      k3: { trait: 't1', holder: { k: 'crew', id: 'c1' }, fake: true, maker: 'a01' },
    },
    crews: { c1: { id: 'c1', cash: 0, members: ['a01', 'a02'] } },
  };
  const log = [{ type: 'buy', night: 4, agent: 'a01', trait: 't1', copy: 'k1', price: paid }];
  assert.deepEqual(haulNow(s, log), { a01: N.rent + paid, a02: 0 });
});
