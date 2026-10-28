// R4-3's review (10-17): what the read-only review of the daytime found, each fixed here (trunk
// docs/briefs/R4-astra-fixes.md, task 3; GAME.md §9, §10, §11, §14, §19; GAP gap.truth, gap.marketOrder).
// - TRUTH's lock counted goods on order at the city's shop, which the clearing can send back, so a taker could show a
//   partner a "verified" play it knew it wouldn't make (probe p1). Now the lock counts only the goods held.
// - One side's word in a sit-down that lasts made a day's meeting by itself, and showed the speaker the other's hidden
//   fit and its TRUTH play though the other did nothing that day (probe p8). Now a day counts once both sides act.
// - The shop's clearing stopped at the first limit level that couldn't fill, so one order could bounce every lower one
//   for nothing (probe p2). Now a failed level is passed over, and the 'back' line says why an order came back.
// - A cook or a build short at the lock because an order came back was invalid (the orchestrator's call: it works with
//   what it holds).
// - The bots counted an order at risk as certain (withDue), and closed every sit-down each morning, so the bench never
//   played one that lasts. Now a bot plans on the goods it holds and the orders whose max covers a busy day, counts a
//   sale at what it fetches on a busy day, and keeps a sit-down open while a goods deal in it is pending.
// Amounts come from N and the curves. Each test imports what it needs itself, so each fails on its own before the fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, abilityCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { runOf } from '../rules/market.mjs';
import { rng } from '../rng.mjs';
import { N } from '../numbers.mjs';

const bots = () => import('../bench/bots.mjs');
const tools = () => import('../agents/tools.mjs');
const briefingOf = () => import('../agents/briefing.mjs');
const DOCKS = 'docks';
// A season whose agents have the trades named, in id order (the helpers' cast is all Smugglers).
function withTrades(trades) {
  const g = new Game({ n: 1 });
  const agents = trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' }));
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
function stock(g, id, kind, n = 1) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, n > 0 ? 'in' : 'out', 'test', kind, Math.abs(n));
  checkLedger(g.s, `stock ${id} ${kind}`);
}
function ok(g, id, kind, fields) {
  const r = g.errand(id, kind, fields);
  assert.equal(r.ok, true, `day ${g.s.day}: ${id}'s ${kind} went through (${r.why})`);
  return r;
}
const lastAsk = g => g.events('ask').at(-1).sitdown;
// No invalid play and no forced one for `id` on night `n`.
const clean = (g, id, n) => g.events('invalid', e => e.agent === id && e.play && e.day === n).length + g.events('forced', e => e.agent === id && e.day === n).length === 0;
// A small season on day 1 with one bot config each (daytime-agents.test.mjs's world): `errands(id, round)` applies a
// fresh bot's day in that round, and `play(id)` is tonight's play.
async function world(cfgs) {
  const { makeBot } = await bots();
  const agents = cfgs.map((c, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: c.trade, driver: 'test' }));
  const g = new Game({ n: 1 });
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  const cfg = Object.fromEntries(agents.map((a, i) => [a.id, { id: a.id, fav: 'industrial', route: 'downtown', layer: 2, ...cfgs[i] }]));
  const memos = {};
  const bot = id => makeBot(cfg[id], (memos[id] ||= {}));
  const ctx = (id, round) => ({ seed: 404, day: g.s.day, round, rounds: 3, rng: rng(404, 'bot', id, g.s.day, round) });
  const errands = (id, round) => {
    const out = bot(id).day(g.view(id), ctx(id, round));
    for (const e of out) ok(g, id, e.kind, e);
    return out;
  };
  const play = id => bot(id).night(g.view(id), ctx(id, 'night')).play;
  return { g, errands, play };
}

test("TRUTH's lock counts only the goods its taker holds: chems on order can come back at the lock, so a cook that needs them can't be locked and no partner sees it verified; a plain cook may still count on them (§9, §11, GAP gap.truth)", () => {
  const g = withTrades(['chemist', 'smuggler', 'smuggler']);
  stock(g, 'a01', 'truth');
  const one = runOf('shop', 'chems', g.s.market.shop.chems, 1);
  g.grant('a01', 2 * one);
  // Probe p1: two orders of one chem, each at one chem's price alone; together they cost more than both limits.
  ok(g, 'a01', 'shop', { item: 'chems', units: 1, max: one });
  ok(g, 'a01', 'shop', { item: 'chems', units: 1, max: one });
  const held = g.s.agents.a01.goods.chems;
  assert.equal(held, N.kits.chemist.chems, "control: it holds its kit's chems");
  const cooks = g.view('a01').legal.filter(p => p.kind === 'cook');
  const big = cooks.find(p => p.batches * N.cook.chems > held);
  assert.ok(big, 'control: by day, a plain cook counts the chems on order');
  const r = g.errand('a01', 'take', { drug: 'truth', play: big });
  assert.equal(r.ok, false, `TRUTH won't lock a cook on chems still on order (${r.why})`);
  assert.equal(g.s.agents.a01.goods.truth, 1, 'the dose stays');
  const small = cooks.find(p => p.batches * N.cook.chems <= held && p.place === big.place);
  ok(g, 'a01', 'take', { drug: 'truth', play: small });
  ok(g, 'a02', 'ask', { to: 'a01' });
  const sd = lastAsk(g);
  ok(g, 'a01', 'answer', { sitdown: sd, accept: true });
  const shown = g.view('a02').me.sitdowns.find(x => x.id === sd).verified;
  assert.deepEqual([shown.kind, shown.batches], ['cook', small.batches], 'its partner sees the cook its own chems allow, verified');
  g.night({ a01: big });
  assert.deepEqual(g.events('order', e => e.act === 'back').map(e => e.agent), ['a01', 'a01'], 'control: both orders came back');
  assert.deepEqual(g.events('cook', e => e.agent === 'a01').map(e => e.batches), [small.batches], 'and it cooks the play it locked');
});

test("a day counts as a sit-down only once both sides act in it: an old partner's word alone makes no meeting and shows it neither the other's hidden fit nor its TRUTH play; the other's word then does both (§4, §11, §14, §19)", () => {
  const g = new Game({ n: 3 });
  const hood = abilityCopy(g.s, 'hoodie');
  g.hand('a01', hood, { wear: true });
  stock(g, 'a01', 'truth');
  ok(g, 'a02', 'ask', { to: 'a01' });
  const sd = lastAsk(g);
  ok(g, 'a01', 'answer', { sitdown: sd, accept: true });
  g.night();
  const play = { kind: 'hustle', place: DOCKS };
  ok(g, 'a01', 'take', { drug: 'truth', play });
  const fit = () => g.view('a02').board.agents.find(a => a.id === 'a01').fit;
  const shown = () => g.view('a02').me.sitdowns.find(x => x.id === sd).verified;
  const meets = () => g.events('meet', e => e.sitdown === sd).map(e => e.day);
  // Probe p8: on day 2, a02 says one word in the day-1 sit-down; a01 has done nothing in it today.
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: {} });
  assert.deepEqual([fit(), shown(), meets()], [null, undefined, [1]], "day 2, a02's word alone: no fit, no verified play, no meeting");
  assert.deepEqual(g.view('a02').me.sitdowns.find(x => x.id === sd).acted, ['a02'], 'its view shows who has acted in it today');
  ok(g, 'a01', 'say', { sitdown: sd, say: 'answer', terms: {} });
  assert.ok(fit() && fit().some(p => p.copy === hood), 'a01 speaks too: the fit shows');
  assert.deepEqual(shown(), play, "and a01's play, verified");
  assert.deepEqual(meets(), [1, 2], "and today's meeting is public, once");
  assert.equal(g.view('a03').board.agents.find(a => a.id === 'a01').fit, null, 'control: a03 never sat down with a01');
});

test("the shop's clearing passes over a limit level that can't fill, and the levels below still get their turn, so one order can't bounce a lower one for nothing; the order that came back is told why (§9, GAP gap.marketOrder)", async () => {
  const { briefing } = await briefingOf();
  const { read } = await tools();
  const g = withTrades(['chemist', 'chemist', 'smuggler']);
  const run = u => runOf('shop', 'chems', g.s.market.shop.chems, u);
  // Probe p2: a01's one chem at a high limit, then its four at four's price alone; a02's one chem at two's average.
  const top = 4 * run(1);
  const spoiler = run(4);
  const victim = Math.ceil(run(2) / 2);
  assert.ok(run(5) * 4 > spoiler * 5 && run(2) <= 2 * victim, "control: the four can't fill beside the top one, and a02's one can");
  g.grant('a01', top + spoiler);
  g.grant('a02', victim);
  ok(g, 'a01', 'shop', { item: 'chems', units: 1, max: top });
  ok(g, 'a01', 'shop', { item: 'chems', units: 4, max: spoiler });
  ok(g, 'a02', 'shop', { item: 'chems', units: 1, max: victim });
  g.night();
  assert.deepEqual(g.events('shop').map(e => [e.agent, e.units]).sort(), [['a01', 1], ['a02', 1]], "a01's top chem and a02's fill");
  assert.equal(g.events('shop').reduce((t, e) => t + e.cash, 0), run(2), 'at the price of the two units filled');
  assert.deepEqual(g.events('order', e => e.act === 'back').map(e => [e.agent, e.units]), [['a01', 4]], 'only the four come back');
  const user = briefing(read(g.view('a01'), { audience: 'seat', seed: 'R4-3' }).result)[1].content;
  const line = user.split('\n').find(l => l.includes('came back'));
  assert.ok(line && line.includes(`with it in, the day's price for them would have passed its max, $${spoiler}`), `the line says why: ${line}`);
});

test("a cook or a build short at the lock because an order came back works with what its agent holds, never invalid for that: the cook the batches its chems allow, the build its guns, then its lockpicks, as far as its parts go (§9, GAP gap.marketOrder)", () => {
  const g = withTrades(['chemist', 'gunrunner', 'chemist', 'gunrunner']);
  const run = (item, u) => runOf('shop', item, g.s.market.shop[item], u);
  const chems = N.cook.batches * N.cook.chems - N.kits.chemist.chems;
  const parts = N.build.parts - N.kits.gunrunner.parts;
  assert.ok(chems > 0 && parts > 0, "control: the kits hold less than a full night's work");
  // a01 and a02 put up their units' price alone; a03 and a04 order more, at a limit far above, so they fill first and
  // a01's and a02's orders can't cover the day's price beside them.
  const big = 4;
  for (const [id, item, units, max] of [['a01', 'chems', chems, run('chems', chems)], ['a02', 'parts', parts, run('parts', parts)], ['a03', 'chems', big, 10 * run('chems', big)], ['a04', 'parts', big, 10 * run('parts', big)]]) {
    g.grant(id, max);
    ok(g, id, 'shop', { item, units, max });
  }
  const cook = g.view('a01').legal.find(p => p.kind === 'cook' && p.batches === N.cook.batches);
  const build = g.view('a02').legal.find(p => p.kind === 'build' && p.guns === 1 && p.lockpicks === N.build.parts - N.build.guns);
  assert.ok(cook && build, 'control: by day, both plays count the goods on order');
  g.night({ a01: cook, a02: build });
  assert.deepEqual(g.events('order', e => e.act === 'back').map(e => e.agent).sort(), ['a01', 'a02'], "control: a01's and a02's orders came back");
  const made = g.events('cook', e => e.agent === 'a01');
  assert.deepEqual(made.map(e => [e.batches, e.doses]), [[N.kits.chemist.chems / N.cook.chems, (N.kits.chemist.chems / N.cook.chems) * N.cook.doses]], 'a01 cooks the batches its own chems allow');
  const craft = g.events('craft', e => e.agent === 'a02');
  assert.deepEqual(craft.map(e => [e.guns, e.lockpicks, e.parts]), [[1, 0, N.build.guns]], 'a02 builds its gun first, and no lockpick is left for');
  assert.ok(clean(g, 'a01', 1) && clean(g, 'a02', 1), 'neither play was invalid or forced');
  assert.equal(g.s.agents.a01.goods.chems || 0, 0);
  assert.equal(g.s.agents.a02.goods.parts || 0, N.kits.gunrunner.parts - N.build.guns);
});

test('a bot keeps a sit-down open while a goods deal in it is pending: an order made after its seller\'s last turn is handed over the next day, the seller closes it then, and the buyer pays (§10, §14)', async () => {
  const { STREET } = await bots();
  const { g, errands } = await world([{ type: 'smuggler', trade: 'smuggler', every: true }, { type: 'chemist', trade: 'chemist', every: true }]);
  stock(g, 'a01', 'chems', N.cook.batches * N.cook.chems);
  g.grant('a02', 4 * N.rent);
  // Day 1: the Smuggler asks in its first round, and the Chemist answers with its order in the day's last, after the
  // Smuggler's last turn.
  const ask = errands('a01', 1).find(e => e.kind === 'ask' && e.to === 'a02');
  assert.ok(ask, 'control: the Smuggler asks the Chemist');
  const sd = lastAsk(g);
  const order = errands('a02', 3).find(e => e.kind === 'say' && e.sitdown === sd && e.say === 'offer');
  assert.ok(order && order.terms.goods, "control: the Chemist's order");
  const units = Object.values(order.terms.goods)[0];
  g.night();
  // Day 2: the buyer looks in first and keeps it open; the seller hands over and closes it; the buyer pays.
  assert.ok(!errands('a02', 1).some(e => e.kind === 'close' && e.sitdown === sd), 'the buyer keeps it open while its order waits');
  assert.equal(g.view('a02').me.sitdowns.find(x => x.id === sd).state, 'open');
  const seller = errands('a01', 1);
  assert.ok(seller.some(e => e.kind === 'give' && e.to === 'a02' && JSON.stringify(e.goods) === JSON.stringify(order.terms.goods)), 'the seller hands over the order');
  assert.ok(seller.some(e => e.kind === 'close' && e.sitdown === sd), 'and closes the sit-down: its deal is done');
  const paid = errands('a02', 2).filter(e => e.kind === 'pay' && e.to === 'a01');
  assert.deepEqual(paid.map(e => [e.amount, e.for]), [[units * STREET.unit, 'debt']], 'the buyer pays for what arrived');
});

test("a bot plans tonight from the goods it holds and the orders whose max covers a busy day's price, and counts a sale at what it fetches on a busy day, so its plan keeps a margin for the rent (§9, §10)", async () => {
  const { withDue, BUSY } = await bots();
  const g = withTrades(['chemist', 'chemist', 'smuggler']);
  const shop = u => runOf('shop', 'chems', g.s.market.shop.chems, u);
  const buyer = u => runOf('buyer', 'chems', g.s.market.buyer.chems, u);
  const u = N.cook.chems;
  const held = N.kits.chemist.chems;
  // a01 puts up its units' price alone.
  g.grant('a01', shop(u));
  ok(g, 'a01', 'shop', { item: 'chems', units: u, max: shop(u) });
  assert.equal(withDue(g.view('a01')).me.goods.chems, held, "a01 plans on the chems it holds: its max covers only its units' price alone");
  // a02 puts up a busy day's price for all the day's units.
  assert.ok(Number.isInteger(BUSY) && BUSY > 1, 'control: the bots reckon on a busy day');
  g.grant('a02', shop(BUSY * u));
  ok(g, 'a02', 'shop', { item: 'chems', units: u, max: shop(BUSY * u) });
  const a02 = withDue(g.view('a02')).me;
  assert.equal(a02.goods.chems, held + u, "a02 counts its order's chems");
  assert.ok(a02.cash > 0 && a02.cash < shop(BUSY * u) - shop(u), "and what's left of its max after a busy day's price, less than after its price alone");
  // a03 sells chems: it counts less than they fetch alone.
  const n = 2 * u;
  stock(g, 'a03', 'chems', n);
  ok(g, 'a03', 'sell', { item: 'chems', units: n });
  const sale = withDue(g.view('a03')).me.cash;
  assert.ok(sale > 0 && sale < buyer(n), `the sale counts ${sale}, under the ${buyer(n)} its units fetch alone`);
  assert.ok(sale <= Math.floor(buyer(BUSY * n) / BUSY), "at most its share of a busy day's");
});

test("rent first, on a busy day: two seats short of the rent each sell the city's buyer enough that, sold beside the other's, the sale still covers the rent; both work their trade and keep their homes (§9, §10)", async () => {
  const { g, errands, play } = await world([{ type: 'smuggler', trade: 'smuggler', every: true }, { type: 'smuggler', trade: 'smuggler', every: true }]);
  const haul = 3 * N.cook.chems;
  for (const id of ['a01', 'a02']) {
    stock(g, id, 'chems', haul);
    assert.equal(g.s.agents[id].cash, 0, `control: ${id} has no cash for the rent`);
  }
  const sold = ['a01', 'a02'].map(id => errands(id, 3).filter(e => e.kind === 'sell'));
  assert.ok(sold.every(s => s.length === 1 && s[0].item === 'chems'), 'each sells chems');
  const units = sold[0][0].units;
  assert.ok(runOf('buyer', 'chems', 0, 2 * units) >= 2 * N.rent, 'the two sales together cover both rents at the lock');
  const plays = { a01: play('a01'), a02: play('a02') };
  assert.deepEqual([plays.a01.kind, plays.a02.kind], ['run', 'run'], 'both work their trade');
  const r = g.night(plays);
  assert.ok(g.events('sell').every(e => e.cash >= N.rent), `each sale covers the rent: ${g.events('sell').map(e => e.cash)}`);
  assert.deepEqual(r.newEvents.filter(e => e.type === 'evicted').map(e => e.agent), [], 'and both keep their homes');
});
