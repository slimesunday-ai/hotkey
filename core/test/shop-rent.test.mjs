// R4-4's follow-up: a bot's order at the city's shop keeps tonight's rent back (GAME.md §9, §10; GAP gap.marketOrder).
// Since R4-3 a shop order names the most it pays and fills at the lock, at the day's price over every unit ordered. A
// bot checked it could afford its goods with the rent kept back, but then put up all its cash as the order's most
// (`withMax`, bench/bots.mjs). On a day other buyers pushed the price past its reckoning, the order spent the rent and
// the bot was evicted at dawn after cooking: the trades cast's seed 406-A, a19, once the Cop's wage changed. Bench only:
// the bot reads its own view. Every amount is read from N, the rules' own curve or the state the test set up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { runOf } from '../rules/market.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { rng } from '../rng.mjs';

const bots = () => import('../bench/bots.mjs');

// A small season, one bot config each, as spending.test.mjs builds it: `errands(id, round)` gives a fresh bot's day
// errands in that round, each applied and each going through.
async function world(cfgs, seed = 404) {
  const { makeBot } = await bots();
  const agents = cfgs.map((c, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: c.trade, driver: c.driver || 'test' }));
  const g = new Game({ n: 1 });
  const r = newSeason({ seed, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  const cfg = Object.fromEntries(agents.map((a, i) => [a.id, { id: a.id, fav: 'industrial', route: 'downtown', layer: 2, ...cfgs[i] }]));
  const ctx = (id, round) => ({ seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', id, g.s.day, round) });
  const errands = (id, round, memo = {}) => {
    const out = makeBot(cfg[id], memo).day(g.view(id), ctx(id, round));
    for (const e of out) {
      const res = g.errand(id, e.kind, e);
      assert.ok(res.ok, `${id} ${e.kind}: ${res.why}`);
    }
    return out;
  };
  const play = (id, memo = {}) => makeBot(cfg[id], memo).night(g.view(id), ctx(id, 'night')).play;
  return { g, errands, play };
}
// Test-only goods, in or out through a named source, so the books still balance.
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, n > 0 ? 'in' : 'out', 'test', kind, Math.abs(n));
  checkLedger(g.s, `stock ${id} ${kind}`);
}

// The busy day: a02 orders BUSY times a batch's chems too, so the day's price is over three batches' units. `share` is
// what a batch costs at that price, and a01, a Chemist with no chems, holds the rent and a dollar less than that share.
const units = N.cook.chems;
const busy = 2 * units;
const shareOf = steps => Math.ceil((runOf('shop', 'chems', steps, units + busy) * units) / (units + busy));
async function chemist() {
  const w = await world([{ type: 'chemist', trade: 'chemist', every: true }, { type: 'hustle', trade: 'smuggler' }]);
  const { g } = w;
  stock(g, 'a01', 'chems', -(g.s.agents.a01.goods.chems || 0));
  const cash = N.rent + shareOf(g.s.market.shop.chems) - 1;
  g.grant('a01', cash - g.s.agents.a01.cash);
  return { ...w, cash };
}

test("a bot's shop order keeps tonight's rent back: on a day other buyers push the city's price past its reckoning, its order comes back rather than spend the rent, and it keeps its home after its cook; on a quiet day the same order fills (§9, §10; GAP gap.marketOrder)", async () => {
  const { g, errands, play, cash } = await chemist();
  const shop = errands('a01', 3).filter(e => e.kind === 'shop');
  assert.deepEqual(shop.map(e => [e.item, e.units]), [['chems', units]], "control: it orders a batch's chems");
  assert.ok(shop[0].max <= cash - N.rent, `its order puts up at most its cash less the rent: ${shop[0].max} of ${cash}`);
  assert.equal(play('a01').kind, 'cook', 'control: it plans the cook its order makes possible');
  // a02 orders twice as many chems the same day, and can pay whatever the day's price comes to.
  const all = runOf('shop', 'chems', g.s.market.shop.chems, units + busy);
  g.grant('a02', all);
  assert.equal(g.errand('a02', 'shop', { item: 'chems', units: busy, max: all }).ok, true);
  const r = g.night({ a01: play('a01'), a02: { kind: 'hustle', place: 'docks' } });
  assert.ok(r.newEvents.some(e => e.type === 'order' && e.act === 'back' && e.agent === 'a01'), 'its order came back');
  assert.ok(!g.s.agents.a01.evicted, 'it kept its home');
  // A quiet day: its max covers its batch at the day's price alone, so it cooks, and keeps its home.
  const quiet = await chemist();
  const alone = runOf('shop', 'chems', quiet.g.s.market.shop.chems, units);
  const order = quiet.errands('a01', 3).filter(e => e.kind === 'shop');
  assert.ok(order.length === 1 && order[0].max >= alone, `its max covers its batch alone: ${order[0] && order[0].max} against ${alone}`);
  quiet.g.night({ a01: quiet.play('a01'), a02: { kind: 'hustle', place: 'docks' } });
  assert.equal(quiet.g.events('cook').filter(e => e.agent === 'a01' && e.batches === 1).length, 1, 'it cooked its batch');
  assert.ok(!quiet.g.s.agents.a01.evicted, 'and kept its home');
});
