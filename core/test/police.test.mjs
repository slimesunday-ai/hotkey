// Layer 2's bench, part 2 (GAME.md §8, §9, §13, §25, §27): the Cop seat patrols and collars, crews grab the shipment
// crate, robbers count the goods a target carries, guns change hands from Gunrunners in typed sit-downs, a wanted trade
// bot lies low, and the report counts the police, the crate and guns with the Cop and Gunrunner bar. Each test imports
// what it needs itself, so each fails on its own before the bots exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { rng } from '../rng.mjs';

const bots = () => import('../bench/bots.mjs');

// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  const a = g.s.agents[id];
  a.goods[kind] = (a.goods[kind] || 0) + n;
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}

// A small season played by layer 2's bots, one config each (type, trade and anything else the bot reads), a day or a
// night at a time, in id order.
async function season(cfgs, seed = 404) {
  const { makeBot } = await bots();
  const g = new Game({ n: 1 });
  const agents = cfgs.map((c, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: c.trade, driver: 'test' }));
  const r = newSeason({ seed, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  const b = Object.fromEntries(agents.map((a, i) => [a.id, makeBot({ id: a.id, fav: 'industrial', route: 'downtown', layer: 2, ...cfgs[i] }, {})]));
  const ctx = (id, round) => ({ seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', id, g.s.day, round) });
  const day = () => {
    for (let round = 1; round <= 3; round++) {
      for (const id of Object.keys(b)) {
        for (const e of b[id].day(g.view(id), ctx(id, round))) {
          const res = g.errand(id, e.kind, e);
          assert.ok(res.ok, `${id} ${e.kind}: ${res.why}`);
        }
      }
    }
  };
  const plays = () => Object.fromEntries(Object.keys(b).filter(id => !g.s.agents[id].jail).map(id => [id, b[id].night(g.view(id), ctx(id, 'night')).play]));
  return { g, b, day, plays, ctx };
}

test('the Cop seat collars a wanted agent the show saw out, not one that only just turned wanted; with none, it patrols the docks on a shipment night (§13, §9)', async () => {
  const { copPlan } = await bots();
  const { g, ctx } = await season([
    { type: 'cop', trade: 'cop' }, { type: 'hustle', trade: 'cop' }, { type: 'dealer', trade: 'dealer' }, { type: 'hustle', trade: 'cop' },
  ]);
  // Night 1: a02 works a shift in The Yards; a03, at 2 stars, deals on a hot corner and so turns wanted tonight.
  g.s.agents.a03.heat = 2;
  g.night({ a01: { kind: 'hustle', place: 'docks' }, a02: { kind: 'hustle', place: 'industrial' }, a03: { kind: 'deal', corner: 'strip-1' }, a04: { kind: 'hustle', place: 'docks' } }, { exact: true });
  assert.equal(g.s.agents.a03.heat, 3, 'the hot corner made a03 wanted');
  // a02 was wanted already (its heat set here, with no record of turning wanted last night).
  g.s.agents.a02.heat = 3;
  const cop = { type: 'cop', fav: 'industrial' };
  const plan = copPlan(g.view('a01'), ctx('a01', 'night'), cop);
  assert.deepEqual(plan.play, { kind: 'collar', target: 'a02', place: 'industrial' }, 'a02, wanted and out in The Yards; not a03, which may lie low');
  g.s.agents.a01.heat = 3;
  assert.equal(copPlan(g.view('a01'), ctx('a01', 'night'), cop).play.kind, 'patrol', "a wanted Cop can't collar");
  g.s.agents.a01.heat = 0;
  g.s.agents.a02.heat = 0;
  assert.ok(g.view('a01').board.crate, "night 2's crate is posted at the docks");
  assert.deepEqual(copPlan(g.view('a01'), ctx('a01', 'night'), cop).play, { kind: 'patrol', place: 'docks' });
});

test('a crew grabs the crate on a shipment night when it beats the job, and its leader takes the cash (§9, §12)', async () => {
  const crew = { type: 'crew', trade: 'cop', leader: 'a01', crewName: 'crew 1', snake: false, turn: 0, rug: 0, walk: 0, crew: 0 };
  const { g, day, plays } = await season([
    { ...crew, role: 'leader', mates: ['a02', 'a03'] }, { ...crew, role: 'member', mates: ['a01', 'a03'] },
    { ...crew, role: 'member', mates: ['a01', 'a02'] }, { type: 'hustle', trade: 'cop' },
  ]);
  day();
  g.night(plays(), { exact: true });
  assert.ok(g.s.agents.a01.crew, 'the crew formed');
  day();
  const p = plays();
  assert.deepEqual(p.a01, { kind: 'grab', place: 'docks' }, "nobody's fit is worth a job; $500 in the crate is");
  assert.deepEqual([p.a02, p.a03], [{ kind: 'back', target: 'a01' }, { kind: 'back', target: 'a01' }]);
  g.night(p, { exact: true });
  const grab = g.events('grab');
  assert.equal(grab.length, 1);
  assert.deepEqual([grab[0].leader, grab[0].cash, grab[0].members], ['a01', 500, ['a01', 'a02', 'a03']]);
  assert.equal(g.s.money.in.shipment, 500, "the crate's cash joined the island when it was grabbed");
});

test('a robber buys a gun from a Gunrunner in a typed sit-down: it asks, offers the price, the gun is handed over, and it pays (§8, §10, §14)', async () => {
  const { gunPrice } = await bots();
  const { g, day } = await season([{ type: 'scout', trade: 'cop' }, { type: 'gunrunner', trade: 'gunrunner' }]);
  g.grant('a01', 400);
  stock(g, 'a02', 'guns', 1);
  const price = gunPrice(g.view('a01'));
  assert.equal(price, Math.round(g.view('a01').board.market.shop.guns * 0.75), "three-quarters of the city shop's next gun");
  const cash = g.s.agents.a02.cash;
  day();
  assert.equal(g.s.agents.a01.goods.guns, 1, 'the robber is armed');
  assert.equal(g.s.agents.a02.goods.guns || 0, 0);
  assert.equal(g.events('pay', e => e.from === 'a01' && e.to === 'a02' && e.for === 'debt' && e.amount === price).length, 1);
  assert.equal(g.s.agents.a02.cash - cash, price);
});

test('a Gunrunner builds to demand: no more guns than its stock target (§9)', async () => {
  const { streetPlan, STREET } = await bots();
  const { g, ctx } = await season([{ type: 'gunrunner', trade: 'gunrunner' }, { type: 'hustle', trade: 'cop' }]);
  const cfg = { type: 'gunrunner', fav: 'industrial', layer: 2 };
  stock(g, 'a01', 'parts', 4);
  assert.equal(streetPlan(g.view('a01'), ctx('a01', 'night'), cfg, {}).play.kind, 'build', 'no guns yet');
  stock(g, 'a01', 'guns', STREET.gunStock);
  assert.equal(streetPlan(g.view('a01'), ctx('a01', 'night'), cfg, {}).play.kind, 'hustle', 'a full stock and no sales: it keeps its parts');
  assert.equal(streetPlan(g.view('a01'), ctx('a01', 'night'), cfg, { gunSales: [g.s.day] }).play.kind, 'build', 'a gun sold today raises the target');
});

test("a robber counts the goods a trade's worker carries tonight, and what its work pays, only where its routine puts it, and never guns (§7, GAP gap.carried, gap.holdup)", async () => {
  const { goodsCarried, STREET } = await bots();
  const { cornerTakings } = await import('../rules/market.mjs');
  const { N } = await import('../numbers.mjs');
  const v = {
    board: {
      market: { buyer: { chems: 8, parts: 8, doses: 10 } },
      corners: [{ corner: 'strip-1', place: 'strip', hot: true, holder: 'a03' }],
    },
    sightings: {
      a01: [{ night: 1, place: 'mall' }, { night: 2, place: 'mall' }],
      a02: [{ night: 1, place: 'mall' }, { night: 2, place: 'forest' }],
      a03: [{ night: 1, place: 'strip' }, { night: 2, place: 'strip' }],
      a04: [{ night: 1, place: 'strip' }, { night: 2, place: 'strip' }],
      a05: [{ night: 1, place: 'forest' }, { night: 2, place: 'forest' }],
      a06: [{ night: 1, place: 'industrial' }, { night: 2, place: 'industrial' }],
    },
    // The record a hold-up reads for shifts and patrols (the latest public night's plays): none here.
    events: [],
    clock: 6,
  };
  const g = goodsCarried(v);
  const a = (id, trade) => ({ id, trade });
  assert.equal(g.at(a('a01', 'smuggler'), 'mall'), Math.round(6 * 8 * STREET.loot), 'a haul at the drop it keeps working');
  assert.equal(g.at(a('a02', 'smuggler'), 'forest'), 0, 'a Smuggler that moves about');
  assert.equal(g.at(a('a03', 'dealer'), 'strip'), cornerTakings(N.deal.held, true), "a Dealer on the corner it holds: a held corner's takings, in place of its doses");
  assert.equal(g.at(a('a04', 'dealer'), 'strip'), 0, 'holding no corner there');
  assert.equal(g.at(a('a05', 'chemist'), 'forest'), Math.round(4 * 8 * STREET.loot), 'a Chemist at the lab');
  assert.equal(g.may(a('a06', 'gunrunner')), true, 'any worker may be paid tonight, so any may be worth a hit');
  assert.equal(g.at(a('a06', 'gunrunner'), 'industrial'), 0, 'a hit takes no guns');
});

test('a wanted trade bot lies low at home, out of a Cop\'s reach (§13)', async () => {
  const { streetPlan } = await bots();
  const { g, ctx } = await season([{ type: 'dealer', trade: 'dealer' }, { type: 'hustle', trade: 'cop' }]);
  const cfg = { type: 'dealer', fav: 'industrial', layer: 2 };
  assert.equal(streetPlan(g.view('a01'), ctx('a01', 'night'), cfg, { tied: {} }).play.kind, 'deal');
  g.s.agents.a01.heat = 3;
  assert.deepEqual(streetPlan(g.view('a01'), ctx('a01', 'night'), cfg, { tied: {} }).play, { kind: 'laylow', place: 'suburbs' });
});

test('the report counts the police, the crate and guns, a grab is show-worthy, and the Cop and Gunrunner bar (§27)', async () => {
  const { seasonMetrics, summarize } = await import('../bench/report.mjs');
  const cast = [
    { id: 'a01', type: 'cop', name: 'a', layer: 2 }, { id: 'a02', type: 'gunrunner', name: 'b', layer: 2 },
    { id: 'a03', type: 'crew', name: 'c', layer: 2 }, { id: 'a04', type: 'hustle', name: 'd', layer: 2 },
    { id: 'a05', type: 'dealer', name: 'e', layer: 2 },
  ];
  const state = { agents: Object.fromEntries(cast.map(c => [c.id, {}])), copies: {}, money: { in: { patrol: 50, collar: 300 }, out: {} } };
  const mint = (agent, mainland) => ({ type: 'mint', agent, mainland, cards: [] });
  const log = [
    { type: 'patrol', night: 1, agent: 'a01', place: 'docks', wage: 50 },
    { type: 'craft', night: 1, agent: 'a02', guns: 2, lockpicks: 0, parts: 4 },
    { type: 'give', from: 'a02', to: 'a03', copy: null, cash: 0, goods: { guns: 1 } },
    { type: 'shop', agent: 'a01', item: 'guns', units: 1, cash: 200 },
    { type: 'play', night: 2, agent: 'a01', kind: 'collar', target: 'a05', place: 'strip' },
    { type: 'collar', night: 2, agent: 'a01', target: 'a05', stars: 3, pay: 300 },
    { type: 'arrest', night: 2, agent: 'a05', why: 'collar', by: 'a01' },
    { type: 'arrest', night: 3, agent: 'a03', why: 'fight' },
    { type: 'arrest', night: 4, agent: 'a04', why: 'fight' },
    { type: 'arrest', night: 5, agent: 'a04', why: 'heat' },
    { type: 'grab', night: 6, leader: 'a03', members: ['a03'], place: 'docks', cash: 500, goods: {} },
    { type: 'grab', night: 8, leader: 'a03', members: ['a03'], place: 'docks', cash: 0, goods: { guns: 2 } },
    mint('a01', 400), mint('a02', 300), mint('a03', 100), mint('a04', 200), mint('a05', 250),
  ];
  const fight = (kind, extra = {}) => ({ kind, target: null, winner: null, attackers: [{ leader: 'a03', members: ['a03'], strength: 1 }], arrested: [], ...extra });
  const night = (n, fights = [], guns = { held: 1, armed: 1 }) => ({ night: n, haul: {}, hits: [], placesChanged: false, fights, guns });
  const bench = {
    seed: 1, rule: 'A', midseason: 'payday',
    nights: [
      night(1), night(2), night(3, [fight('hit', { arrested: ['a03'], patrols: ['a01'] })]), night(4, [fight('hit', { arrested: ['a04'] })]),
      night(5), night(6, [fight('grab', { winner: 'a03' })], { held: 3, armed: 2 }), night(7), night(8, [fight('grab', { winner: 'a03' })], { held: 5, armed: 3 }),
    ],
  };
  const m = seasonMetrics(state, log, bench, cast);
  assert.deepEqual(m.police.arrests, { collar: 1, patrol: 1, city: 1, heat: 1, dock: 0 });
  assert.deepEqual(m.police.seat, { patrols: 1, collarsTried: 1, collarsWon: 1, pay: 350 });
  assert.deepEqual(m.police.crate, { fights: 2, won: 2, byType: { crew: 2 }, cash: 500 });
  assert.deepEqual(m.police.guns, { built: 2, shop: 1, crates: 2, sold: 1, held: 1, armed: 1 });
  assert.equal(m.bars.showWorthy.missing.includes(6), false, 'a grab at the docks is show-worthy');
  assert.equal(m.street.police.cop, 350, "the Cop's patrols and collars");
  assert.equal(m.street.income.cop, 150, 'less the gun it bought at the city\'s shop');
  assert.equal(m.street.sources.crew.thefts, 500, "the crate's cash counts with the thefts");
  assert.deepEqual(m.bars.copGunrunner, { cop: 400, gunrunner: 300, median: 250, pass: true });
  const poorer = seasonMetrics(state, log.map(e => (e.type === 'mint' && e.agent === 'a02' ? mint('a02', 240) : e)), bench, cast);
  assert.equal(poorer.bars.copGunrunner.pass, false, 'a Gunrunner below the median fails it');
  const layer1 = seasonMetrics(state, log, bench, cast.map(({ layer, ...c }) => c));
  assert.equal(layer1.police, null);
  assert.equal('copGunrunner' in layer1.bars, false, "layer 1's report has no Cop and Gunrunner bar");
  const sum = summarize([m, { ...m, rule: 'B' }]);
  assert.ok(sum.rows.some(r => r.key === 'copGunrunner'));
});
