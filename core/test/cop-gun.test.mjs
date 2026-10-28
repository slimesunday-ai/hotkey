// R4-4's review: the canny Cop seat bought a $150 gun in every one of 40 canny seasons, though its collars were won as
// often without one. In the canny cast it now buys a gun only when it expects the gun to change a fight it plans: a
// collar the police plan can't win as things stand, which the Cop seat's own gun would win (bench/bots.mjs,
// copNeedsGun). The other casts' Cop seat still saves for a gun (collars.test.mjs). Bench only: the bot reads its own
// view. Every amount is read from N or the state the test set up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { rng } from '../rng.mjs';

const bots = () => import('../bench/bots.mjs');

// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}

const canny = { canny: true, every: true };
const worksCop = { type: 'buylate', trade: 'cop', works: true, ...canny };
const copSeat = { type: 'cop', trade: 'cop', driver: 'bot:cop', ...canny };
const dealer = { type: 'dealer', trade: 'dealer', ...canny };
const shift = { type: 'hustle', trade: 'cop', ...canny };
const gunrunner = { type: 'gunrunner', trade: 'gunrunner', ...canny };
const patrol = { kind: 'patrol', place: 'docks' };
const laylow = { kind: 'laylow' };

// collars.test.mjs's street, in the canny cast: two seats that work the Cop trade on free nights (a01, a02), the Cop
// seat (a03), a Dealer (a04), a shift worker (a05) and a Gunrunner with a gun to sell (a06). Night 1: the Cops in
// `onRecord` patrol, the rest lie low; by day 3 the record has made that night public. Night 2: a04, at 2 stars, deals
// on a hot corner, and turns wanted when `wanted`. Returns the Cop seat's day-3 errands in the day's first round.
async function copDay({ onRecord, wanted = true }) {
  const { makeBot } = await bots();
  const cfgs = [worksCop, worksCop, copSeat, dealer, shift, gunrunner];
  const agents = cfgs.map((c, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: c.trade, driver: c.driver || 'test' }));
  const g = new Game({ n: 1 });
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  for (let i = 1; i <= 6; i++) g.grant(idOf(i), 2 * N.nights * N.rent);
  stock(g, 'a06', 'guns', 1);
  const cop = id => (onRecord.includes(id) ? patrol : laylow);
  g.night({ a01: cop('a01'), a02: cop('a02'), a03: cop('a03'), a04: laylow });
  g.s.agents.a04.heat = wanted ? N.wantedAt - 1 : 0;
  g.night({ a01: patrol, a02: patrol, a03: patrol, a04: { kind: 'deal', corner: 'strip-1' } });
  assert.equal(g.s.agents.a04.heat >= N.wantedAt, wanted, `control: a04 ${wanted ? 'is' : "isn't"} wanted`);
  const cfg = { id: 'a03', fav: 'industrial', route: 'downtown', layer: 2, ...copSeat };
  const ctx = { seed: 404, day: g.s.day, round: 1, rounds: 3, rng: rng(404, 'bot', 'a03', g.s.day, 1) };
  const { policePlan } = await bots();
  return { errands: makeBot(cfg, {}).day(g.view('a03'), ctx), plan: policePlan(g.view('a03'), false), v: g.view('a03') };
}
const asksForGun = errands => errands.some(e => e.kind === 'ask' && e.to === 'a06');

test("the canny Cop seat buys a gun only when it expects the gun to change a collar it plans: with nobody wanted, or a collar its Cops already win, it asks no Gunrunner for one; when only its own gun would win the collar, it asks (§8, §13; R4-4's review)", async () => {
  // Nobody wanted: no collar to plan.
  const quiet = await copDay({ onRecord: ['a01', 'a02', 'a03'], wanted: false });
  assert.equal(quiet.plan, null, 'control: no collar planned');
  assert.ok(!asksForGun(quiet.errands), 'with nobody to collar, no gun');
  // a04 wanted, at home: the Cop seat and the two Cops on the record beat its defence without a gun.
  const won = await copDay({ onRecord: ['a01', 'a02', 'a03'] });
  assert.equal(won.plan && won.plan.target, 'a04', 'control: the collar is planned without a gun');
  assert.ok(!asksForGun(won.errands), 'a collar its Cops win already needs no gun');
  // Only the Cop seat on the record: alone with the city cops it ties a04's home, and with its own gun it would win.
  const tied = await copDay({ onRecord: ['a03'] });
  assert.equal(tied.plan, null, 'control: alone and unarmed, it ties');
  const { policePlan } = await bots();
  assert.equal((policePlan(tied.v, false, 'a03') || {}).target, 'a04', 'control: with its gun, the plan would collar a04');
  assert.ok(asksForGun(tied.errands), 'so it asks a Gunrunner for a gun');
});
