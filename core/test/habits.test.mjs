// L2-6b, three bot habits in the cast where every seat trades (GAME.md §9, §10, §25). L2-6's cast showed them: goods
// trades start at $0 and are paid in goods, so they missed the rent; a Dealer remembered only last night's tie, so two
// Dealers short of a corner could tie on the same two corners all season; and Gunrunners built guns nobody bought. In
// the trades cast each bot now plays these the way a sensible player would, from its own view. Layer 2's and layer 1's
// casts keep their bots as they were. Each test imports what it needs itself, so each fails on its own before the
// habits exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Game, ITEMS, idOf, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { rng } from '../rng.mjs';
import { N } from '../numbers.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-habits-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const bots = () => import('../bench/bots.mjs');
const readLog = dir => fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));

// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  const a = g.s.agents[id];
  a.goods[kind] = (a.goods[kind] || 0) + n;
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}

// A small season on day 1, one bot config each (type, trade, and `every` for the trades cast's bots). `play(id)` is
// tonight's play from a fresh bot; `errands(id, round)` its day's errands in that round, applied.
async function world(cfgs, seed = 404) {
  const { makeBot } = await bots();
  const agents = cfgs.map((c, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: c.trade, driver: 'test' }));
  const g = new Game({ n: 1 });
  const r = newSeason({ seed, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  const cfg = Object.fromEntries(agents.map((a, i) => [a.id, { id: a.id, fav: 'industrial', route: 'downtown', layer: 2, ...cfgs[i] }]));
  const ctx = (id, round) => ({ seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', id, g.s.day, round) });
  const play = (id, memo = {}) => makeBot(cfg[id], memo).night(g.view(id), ctx(id, 'night')).play;
  const errands = (id, round, memo = {}) => {
    const out = makeBot(cfg[id], memo).day(g.view(id), ctx(id, round));
    for (const e of out) assert.ok(g.errand(id, e.kind, e).ok, `${id} ${e.kind}`);
    return out;
  };
  return { g, play, errands };
}

const chemist = { type: 'chemist', trade: 'chemist' };
const gunrunner = { type: 'gunrunner', trade: 'gunrunner' };
const smuggler = { type: 'smuggler', trade: 'smuggler' };
const dealer = { type: 'dealer', trade: 'dealer' };
const shift = { type: 'hustle', trade: 'cop' };
const every = cfg => ({ ...cfg, every: true });

test('rent first, at night: a seat whose cash won\'t cover the rent due at dawn, on a night its work pays in goods, works a shift; with the rent in hand it works its trade (§10)', async () => {
  // a01 and a02 play the trades cast's bots, a03 and a04 layer 2's; all start with $0 and their kits.
  const { g, play } = await world([every(chemist), every(gunrunner), chemist, gunrunner, every(smuggler), shift]);
  assert.equal(play('a01').kind, 'hustle', 'a cook pays in doses: $0 at dawn is an eviction');
  assert.equal(play('a02').kind, 'hustle', 'a build pays in guns');
  assert.equal(play('a03').kind, 'cook', "layer 2's Chemist is as it was");
  assert.equal(play('a04').kind, 'build', "layer 2's Gunrunner is as it was");
  // A Smuggler always runs a drop (every-seat.test.mjs): it covers the rent by day, selling its haul.
  assert.equal(play('a05').kind, 'run');
  g.grant('a01', 20);
  g.grant('a02', 20);
  assert.equal(play('a01').kind, 'cook', 'the rent in hand: it cooks');
  assert.equal(play('a02').kind, 'build');
});

test('rent first: the turtle that holds a rare still lays low, short of the rent or not (its strategy forbids the shift)', async () => {
  const { g, play } = await world([{ type: 'turtle', trade: 'chemist', works: true, every: true }, shift]);
  assert.equal(play('a01').kind, 'hustle', 'no rare yet, and a cook would miss the rent');
  g.hand('a01', tierCopy(g.s, 'rare'));
  assert.equal(play('a01').kind, 'laylow');
});

test("rent first: an evicted Smuggler, which never takes a shift, pays its way home only when it can cover the rent due at dawn as well; layer 2's pays as soon as it has the rent (§10)", async () => {
  const { g, errands } = await world([every(smuggler), smuggler, shift]);
  for (const id of ['a01', 'a02']) {
    g.s.agents[id].evicted = true;
    g.grant(id, 30);
  }
  const home = id => errands(id, 1).filter(e => e.kind === 'rent').length;
  assert.equal(home('a01'), 0, '$30: home tonight, and evicted again at dawn');
  assert.equal(home('a02'), 1, "layer 2's Smuggler is as it was");
  g.grant('a01', 10);
  assert.equal(home('a01'), 1, '$40 covers both');
});

test('rent first, by day: in the day\'s last round a seat short of the rent sells the city\'s buyer enough of what tonight\'s work won\'t use to cover it on a busy day, then works its trade; goods that can\'t cover it stay, and it shifts (§9, §10)', async () => {
  const { g, play, errands } = await world([every(chemist), every(smuggler), every(chemist), chemist, shift]);
  // a01 holds 10 doses and the 2 chems tonight's cook uses: 3 doses at the buyer ($10, $9, $8) cover the $20, on a busy
  // day too; 2 don't.
  stock(g, 'a01', 'temp', 10);
  const sold = errands('a01', 3).filter(e => e.kind === 'sell');
  assert.deepEqual(sold, [{ kind: 'sell', item: 'doses', units: 3 }]);
  // R4-3: the sale fills at the lock, before dawn's rent.
  assert.equal(g.s.agents.a01.cash, 0, 'paid at the lock');
  assert.equal(g.s.agents.a01.goods.chems, 2, 'the chems stay for tonight');
  assert.equal(play('a01').kind, 'cook');
  // a02, a Smuggler with a haul: 3 chems ($8, $7, $6) cover the $20 alone, but (R4-3's review) a sale fills beside the
  // day's other sales, and on a busy day 3 might not, so it sells 4.
  stock(g, 'a02', 'chems', 6);
  assert.deepEqual(errands('a02', 3).filter(e => e.kind === 'sell'), [{ kind: 'sell', item: 'chems', units: 4 }]);
  assert.equal(play('a02').kind, 'run');
  // a03 has a single dose: not enough to cover the rent, so it keeps it and works a shift.
  stock(g, 'a03', 'temp', 1);
  assert.deepEqual(errands('a03', 3).filter(e => e.kind === 'sell'), []);
  assert.equal(play('a03').kind, 'hustle');
  // Layer 2's bots don't.
  stock(g, 'a04', 'temp', 10);
  assert.deepEqual(errands('a04', 3).filter(e => e.kind === 'sell'), [], "layer 2's Chemist is as it was");
  // The night: the sales fill at the lock, $27 and $27, and both keep their homes at dawn.
  const plays = Object.fromEntries(['a01', 'a02', 'a03', 'a04', 'a05'].map(id => [id, play(id)]));
  const r = g.night(plays);
  assert.deepEqual(Object.fromEntries(g.events('sell').map(e => [e.agent, e.cash])), { a01: 27, a02: 27 });
  assert.deepEqual(r.newEvents.filter(e => e.type === 'evicted' && ['a01', 'a02'].includes(e.agent)), [], 'the rent was covered');
  assert.equal(g.s.agents.a01.cash, 27 - N.rent);
});

test("Dealers short of a corner go by the street's pecking order: in id order each takes the best open corner left, so no two pick one, and each one's pick is the same from every view (§9, GAP gap.corners)", async () => {
  const { g, play } = await world([every(dealer), every(dealer), every(dealer), every(dealer), every(dealer), every(dealer), shift]);
  const plays = Object.fromEntries(['a01', 'a02', 'a03', 'a04', 'a05', 'a06'].map(id => [id, play(id)]));
  assert.deepEqual(Object.values(plays).map(p => [p.kind, p.corner]), [
    ['deal', 'downtown-1'], ['deal', 'downtown-2'], ['deal', 'strip-1'], ['deal', 'strip-2'], ['deal', 'docks-1'], ['deal', 'industrial-1'],
  ], 'the hot corners to the lowest ids, then the rest by id');
  g.night({ ...plays, a07: { kind: 'hustle', place: 'docks' } }, { exact: true });
  assert.equal(g.events('fight', e => e.kind === 'corner').length, 0, 'no corner fight');
  assert.equal(g.events('sale', e => e.doses > 0).length, 6, 'all six sell');
  // Night 2: each holds the corner it dealt on, and deals there again.
  for (const [id, p] of Object.entries(plays)) {
    stock(g, id, 'temp', 4);
    assert.equal(play(id).corner, p.corner, id);
  }
});

test('a Gunrunner keeps at most one gun unsold: it orders one gun\'s parts and builds one, and past it sells its parts and works a shift; layer 2\'s builds to its stock as before (§9)', async () => {
  const { g, play, errands } = await world([every(gunrunner), gunrunner, smuggler, smuggler, shift]);
  for (const id of ['a01', 'a02']) {
    g.grant(id, 100);
    // Each sells its kit's parts first, so both start from none.
    g.errand(id, 'sell', { item: 'parts', units: 2 });
  }
  // Orders: each Gunrunner answers a Smuggler's ask with an order for parts.
  g.errand('a03', 'ask', { to: 'a01' });
  g.errand('a04', 'ask', { to: 'a02' });
  const order = id => errands(id, 2).filter(e => e.kind === 'say' && e.terms.goods).map(e => e.terms.goods.parts);
  assert.deepEqual(order('a01'), [2], "one gun's parts");
  assert.deepEqual(order('a02'), [4], "layer 2's orders a night's 4");
  stock(g, 'a01', 'parts', 4);
  stock(g, 'a02', 'parts', 4);
  assert.deepEqual(play('a01'), { kind: 'build', place: 'suburbs', guns: 1, lockpicks: 0 }, 'one gun, not two');
  assert.equal(play('a02').guns, 2);
  stock(g, 'a01', 'guns', 1);
  stock(g, 'a02', 'guns', 1);
  assert.equal(play('a01').kind, 'hustle', 'one gun unsold: it builds no more');
  assert.equal(play('a02').kind, 'build', "layer 2's stock is two");
  const sold = errands('a01', 3).filter(e => e.kind === 'sell');
  assert.deepEqual(sold, [{ kind: 'sell', item: 'parts', units: 4 }], 'past the cap it sells its parts');
  assert.deepEqual(errands('a02', 3).filter(e => e.kind === 'sell'), []);
});

test('a robber or crew member that works the Gunrunner trade builds its own gun rather than buying one, so a bought gun never fills the stock it builds for (§9)', async () => {
  const scout = trade => ({ type: 'scout', trade, works: true, every: true });
  const { g, errands } = await world([scout('gunrunner'), scout('chemist'), gunrunner, shift]);
  for (const id of ['a01', 'a02']) g.grant(id, 500);
  const [own, other] = [{}, {}];
  errands('a01', 1, own);
  errands('a02', 1, other);
  assert.equal(own.gunOrder || null, null, 'no ask for a gun');
  assert.ok(other.gunOrder, 'a robber in another trade still buys one');
});

test('seasons with the trades cast: no Chemist or Gunrunner is evicted after a night it cooked or built, unless a break-in took its cash; no two Dealers tie on an open corner; every build leaves at most one gun unsold (§9, §10)', async () => {
  const { CASTS } = await bots();
  const { runSeason } = await import('../bench/runner.mjs');
  for (const [seed, rule] of [[404, 'A'], [405, 'B'], [406, 'A']]) {
    const { dir, metrics } = runSeason({ seed, rule, outDir: path.join(tmp, 'seasons'), mix: CASTS.trades });
    const log = readLog(dir);
    assert.equal(metrics.ledger.failed, 0);
    const plays = log.filter(e => e.type === 'play');
    // Rent: an eviction at dawn follows the night before (its day - 1).
    for (const e of log.filter(x => x.type === 'evicted' && x.on)) {
      const p = plays.find(x => x.agent === e.agent && x.day === e.day - 1);
      const broken = log.some(x => x.type === 'burgle' && x.target === e.agent && x.night === e.day - 1);
      if (p && ['cook', 'build'].includes(p.kind)) assert.ok(broken, `seed ${seed}: ${e.agent} evicted after its ${p.kind} on night ${p.day}`);
    }
    // Corners: a tie is a corner fight nobody won with no holder defending.
    const ties = log.filter(x => x.type === 'fight' && x.kind === 'corner' && !x.won && !x.target);
    assert.deepEqual(ties.map(x => `night ${x.night} ${x.corner}`), [], `seed ${seed}: Dealers tied`);
    // Guns: at the lock before a build (its last dawn's holdings, less the guns it handed over by day, plus any it got
    // or bought at the city's shop) the seat held none, and it builds one.
    for (const c of log.filter(x => x.type === 'craft')) {
      const dawn = log.filter(x => x.type === 'holdings' && x.agent === c.agent && x.day === c.night).slice(-1)[0];
      const moved = log.filter(x => x.type === 'give' && x.day === c.night && x.goods && x.goods.guns && (x.from === c.agent || x.to === c.agent));
      const shop = log.filter(x => x.type === 'shop' && x.item === 'guns' && x.agent === c.agent && x.day === c.night);
      const atLock = ((dawn && dawn.goods.guns) || 0) + moved.reduce((t, x) => t + (x.to === c.agent ? 1 : -1) * x.goods.guns, 0)
        + shop.reduce((t, x) => t + x.units, 0);
      assert.ok(atLock + c.guns <= 1, `seed ${seed}: ${c.agent} built ${c.guns} on night ${c.night} holding ${atLock}`);
    }
  }
});
