// R9d, Part A, the review's follow-ups (docs/briefs/R9d-trade-you-can-read.md; the independent review, 10-20):
// - a buy-shaped counter from the seller is left alone: an echo would agree the deal with the bot as its seller
//   (rules/deals.mjs, R5-terms);
// - a drug buyer and a lockpick buyer take a counter that fits and leave one that doesn't (answerSeller);
// - every priced ask line's numbers are the bot's first offer in that sit-down, the same day, in bot-only seasons;
// - a held ask closes the morning after it was held, however long its seller goes on talking with no terms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { N } from '../numbers.mjs';
import { bots, world, dealerAsks, ok, mine, buy, stock } from './r9d-bots-fixtures.mjs';

test('a buy-shaped counter from the seller is left alone: no say, no restating, and the deal never agreed with the bot selling (§10, §14)', async () => {
  const { STREET } = await bots();
  const { g, dealer, chemist, sd, want, said, day } = await dealerAsks();
  assert.deepEqual(said, [buy(sd, { temp: want }, want * STREET.unit)], 'control: its order');
  const n = want - 1;
  ok(g, chemist, 'say', { sitdown: sd, say: 'offer', terms: { what: 'buy', goods: { temp: n }, cash: n * STREET.unit }, line: `${n} for you.` });
  assert.deepEqual(mine(day(3), sd), [], 'no say to it');
  ok(g, chemist, 'say', { sitdown: sd, say: 'answer', terms: {}, line: 'Deal?' });
  assert.deepEqual(mine(day(3), sd), [], 'nor its order again after words that follow it');
  const deal = g.view(dealer).me.deals.find(d => d.sitdown === sd);
  assert.ok(deal && !deal.agreed, 'the Chemist\'s buy stands unagreed');
});

// The layer3 cast on day 1: the seat with the TEMP habit asks a Chemist for its doses, the Chemist (played by hand)
// takes the ask, and the buyer orders. `units`: its order's doses. (A robber also puts its muscle offer in a sit-down it
// asked, a known limit by bots.mjs's heldAsk; only the order is read here.)
async function drugOrder() {
  const { DOSES } = await bots();
  const w = await world('layer3');
  const { g, cast, player } = w;
  const id = cast.find(c => c.habit === 'temp').id;
  const bot = player(id);
  const ask = bot.day(1).find(e => e.kind === 'ask' && cast.some(c => c.id === e.to && c.trade === 'chemist'));
  assert.ok(ask, 'control: the habit\'s seat asks a Chemist');
  const units = Number(/^Buying (\d+) doses? at \$(\d+) each/.exec(ask.line)[1]);
  const sd = g.view(id).me.sitdowns.find(x => x.with === ask.to).id;
  ok(g, ask.to, 'answer', { sitdown: sd, accept: true });
  const order = mine(bot.day(2), sd).filter(e => e.terms && e.terms.goods);
  assert.deepEqual(order, [buy(sd, { temp: units }, units * DOSES.price)], 'control: it orders what its line said');
  return { ...w, id, chemist: ask.to, sd, units, day: bot.day };
}

test('a drug buyer takes a counter that fits, at the seller\'s price, and agrees the deal (§10, §11, §14)', async () => {
  const { DOSES } = await bots();
  const { g, id, chemist, sd, units, day } = await drugOrder();
  assert.ok(units >= 2, `control: ${units} doses ordered`);
  ok(g, chemist, 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { temp: units - 1 }, cash: (units - 1) * DOSES.price - 2 } });
  assert.deepEqual(mine(day(3), sd), [buy(sd, { temp: units - 1 }, (units - 1) * DOSES.price - 2)]);
  assert.equal(g.view(id).me.deals.find(d => d.sitdown === sd).agreed, true);
});

test('a drug buyer leaves a counter above its price, and takes no more doses than it ordered (§11, §14)', async () => {
  const { DOSES } = await bots();
  {
    const { g, chemist, sd, units, day } = await drugOrder();
    ok(g, chemist, 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { temp: units }, cash: units * DOSES.price + 1 } });
    assert.deepEqual(mine(day(3), sd), [], 'above its price');
  }
  {
    const { g, chemist, sd, units, day } = await drugOrder();
    ok(g, chemist, 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { temp: units + 2 }, cash: (units + 2) * DOSES.price } });
    assert.deepEqual(mine(day(3), sd), [buy(sd, { temp: units }, units * DOSES.price)], 'past its order\'s doses and cash: only those');
  }
});

// The canny cast (canny-round2.test.mjs's lockpick world): an unarmed scout that would break in with a pick asks the
// Gunrunner whose record shows one, the Gunrunner (played by hand) takes the ask, and the scout orders at its price.
async function pickOrder() {
  const { pickPrice } = await bots();
  const w = await world('canny', 405);
  const { g, cast, player } = w;
  const scout = cast.filter(c => c.type === 'scout' && !['smuggler', 'gunrunner'].includes(c.trade))[0];
  const seller = cast.find(c => c.type === 'gunrunner');
  assert.ok(scout && seller, 'control: the seed deals a scout and a Gunrunner');
  const [mark, other] = cast.filter(c => c.type === 'hustle').map(c => c.id);
  stock(g, seller.id, 'lockpicks', 1);
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the mark's nights of work are hustles at the Mall (lawless, no star), as its shifts at the docks added none.
  while (g.s.day < 3) w.night({ [mark]: { kind: 'hustle', place: 'mall' } });
  ok(g, scout.id, 'pay', { to: other, amount: g.s.agents[scout.id].cash - 5 * N.rent });
  const bot = player(scout.id);
  const ask = bot.day(1).find(e => e.kind === 'ask' && e.to === seller.id);
  assert.ok(ask, 'control: it asks the Gunrunner');
  const price = pickPrice(g.view(scout.id));
  assert.equal(ask.line, `Buying a lockpick for $${price}; I pay once it's handed over.`);
  const sd = g.view(scout.id).me.sitdowns.find(x => x.with === seller.id).id;
  ok(g, seller.id, 'answer', { sitdown: sd, accept: true });
  assert.deepEqual(mine(bot.day(2), sd), [buy(sd, { lockpicks: 1 }, price)], 'control: it orders at the line\'s price');
  return { g, id: scout.id, seller: seller.id, sd, price, day: bot.day };
}

test('a lockpick buyer takes a counter under its price and leaves one above it (§9, §14)', async () => {
  {
    const { g, seller, sd, price, day } = await pickOrder();
    ok(g, seller, 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { lockpicks: 1 }, cash: price + 1 } });
    assert.deepEqual(mine(day(3), sd), [], 'above its price');
  }
  {
    const { g, id, seller, sd, price, day } = await pickOrder();
    ok(g, seller, 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { lockpicks: 1 }, cash: price - 4 } });
    assert.deepEqual(mine(day(3), sd), [buy(sd, { lockpicks: 1 }, price - 4)], 'under it, at the seller\'s price');
    assert.equal(g.view(id).me.deals.find(d => d.sitdown === sd).agreed, true);
  }
});

// What an ask line says the bot will offer: its kind of offer, goods, price a unit, and whether its units are a cap.
const SHAPES = [
  // (most specific first)
  // A goods buyer's count is its want in the ask's round, which a canny buyer works out again each round (a known limit
  // by bots.mjs's heldAsk): only its price is checked.
  [/^Buying up to (\d+) (chems?|parts?|doses?) at \$(\d+) each/, m => ({ what: 'trade', units: Infinity, unit: +m[3], upTo: true })],
  [/^Buying (\d+) doses? at \$(\d+) each/, m => ({ what: 'trade', units: +m[1], unit: +m[2], upTo: false, name: 'drug buy' })],
  [/^Selling up to (\d+) (chems?|parts?|doses?) at \$(\d+) each/, m => ({ what: 'sell', units: +m[1], unit: +m[3], upTo: true, name: m[2].startsWith('dose') ? 'dose sell' : null })],
  [/^Buying a (gun|lockpick|warrant)(?: for night (\d+))? for \$(\d+);/, m => ({ what: 'trade', goods: { gun: 'guns', lockpick: 'lockpicks', warrant: 'warrants' }[m[1]], units: 1, unit: +m[3], night: m[2] ? +m[2] : null, name: m[1] })],
  [/^Hiring backup for tonight: back me and I promise you \$(\d+),/, m => ({ what: 'back', cash: +m[1], name: 'hire' })],
];

test('in bot-only seasons every priced ask line\'s numbers are the bot\'s first offer in that sit-down, the same day: drug buy, dose sell, gun, lockpick, warrant and hire among them (§14)', async () => {
  const { runSeason, mixOf } = await import('../bench/runner.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r9d-lines-'));
  const checked = {};
  try {
    for (const [cast, mix] of [['default', mixOf({})], ['models-canny', mixOf({ cast: 'models-canny', 'model-seats': '0' })]]) {
      // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): seed 404's two seasons now have no warrant ask line, so the seasons are 405's, the first seed from 404 with all six kinds (rule A: 10 of 40 seasons on the lane, 4 on trunk; the lines match the first offer in all 80 seasons on each).
      runSeason({ seed: 405, rule: 'A', outDir: path.join(dir, cast), mix, quiet: true });
      const log = fs.readFileSync(path.join(dir, cast, '405-A', 'events.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
      for (const ask of log.filter(e => e.type === 'ask')) {
        const shape = SHAPES.map(([re, f]) => [re.exec(ask.line), f]).find(([m]) => m);
        if (!shape) continue;
        const want = shape[1](shape[0]);
        // Its first offer of the line's kind: goods for a trade's line, backing for a hire's (a robber can also put its
        // muscle offer in a sit-down it asked about goods, a known limit by bots.mjs's heldAsk).
        const first = log.find(e => e.type === 'say' && e.sitdown === ask.sitdown && e.from === ask.from && e.say === 'offer'
          && (want.what === 'back' ? e.terms.what === 'back' : !!e.terms.goods));
        if (!first || first.day !== ask.day) continue;
        const where = `${cast} ${ask.sitdown}: "${ask.line}" against ${JSON.stringify(first.terms)}`;
        assert.equal(first.terms.what, want.what, where);
        if (want.what === 'back') assert.equal(first.terms.cash, want.cash, where);
        else {
          const kinds = Object.keys(first.terms.goods);
          const units = kinds.reduce((t, k) => t + first.terms.goods[k], 0);
          if (want.goods) assert.deepEqual(kinds, [want.goods], where);
          assert.ok(want.upTo ? units >= 1 && units <= want.units : units === want.units, where);
          assert.equal(first.terms.cash, units * want.unit, where);
          if (want.night != null) assert.equal(first.terms.night, want.night, where);
        }
        if (want.name) checked[want.name] = (checked[want.name] || 0) + 1;
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  for (const name of ['drug buy', 'dose sell', 'gun', 'lockpick', 'warrant', 'hire']) assert.ok(checked[name] >= 1, `control: some ${name} lines checked (${JSON.stringify(checked)})`);
});

test('a held ask closes the morning after it was held, however long its seller goes on talking with no terms (§14)', async () => {
  const { g, dealer, chemist, sd, day, night } = await dealerAsks({ taken: false });
  ok(g, chemist, 'answer', { sitdown: sd, accept: true, line: 'What are you looking to discuss?' });
  night();
  ok(g, dealer, 'pay', { to: chemist, amount: g.s.agents[dealer].cash, for: 'gift' });
  const held = [1, 2, 3].flatMap(day);
  assert.ok(!held.some(e => e.kind === 'close' && e.sitdown === sd), 'control: held the day after the words');
  assert.deepEqual(mine(held, sd), [], 'control: with no cash it orders nothing');
  ok(g, chemist, 'say', { sitdown: sd, say: 'answer', terms: {}, line: 'Still there?' });
  night();
  ok(g, chemist, 'say', { sitdown: sd, say: 'answer', terms: {}, line: 'Hello?' });
  assert.ok(day(1).some(e => e.kind === 'close' && e.sitdown === sd), 'the morning after, it closes');
});

