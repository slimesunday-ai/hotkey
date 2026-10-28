// The money curves (GAME.md §26): unit tests for §9's table, at §38's starting numbers: the drop split, the city's shop,
// the city's buyer and a corner. The shop and the buyer price each unit in whole dollars from a step count, a half
// rounding down; a corner's night rounds once (GAP gap.marketRounding).
// Each test imports the module itself, so each one fails on its own while the module doesn't exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const market = () => import('../rules/market.mjs');

test('the drop split: 6 alone, 3 and 3 for two, 2,2,1,1 for four, the remainder going round by night, never by chance (§9; R4-2)', async () => {
  const { dropSplit } = await market();
  assert.deepEqual(dropSplit(['a07'], 1), { a07: 6 });
  assert.deepEqual(dropSplit(['a09', 'a02'], 1), { a02: 3, a09: 3 });
  assert.deepEqual(dropSplit(['a04', 'a01', 'a03', 'a02'], 4), { a01: 2, a02: 2, a03: 1, a04: 1 }, 'night 4: the remainder starts at the (4 mod 4)-th in id order');
  assert.deepEqual(dropSplit(['a04', 'a01', 'a03', 'a02'], 5), { a01: 1, a02: 2, a03: 2, a04: 1 }, 'a night later it starts one place along');
  assert.deepEqual(dropSplit(['a05', 'a03', 'a01', 'a02', 'a04', 'a06', 'a07'], 7), { a01: 1, a02: 1, a03: 1, a04: 1, a05: 1, a06: 1, a07: 0 }, 'seven at one drop: one unit for six of them');
  assert.deepEqual(dropSplit(['a05', 'a03', 'a01', 'a02', 'a04', 'a06', 'a07'], 8), { a01: 0, a02: 1, a03: 1, a04: 1, a05: 1, a06: 1, a07: 1 }, 'and the next night another goes without');
  assert.deepEqual(dropSplit([], 1), {}, 'nobody there, nothing split');
});

test("the city's shop: 4 chems cost $125, and guns go $200, $230, $264, each from its step count (§9, §38)", async () => {
  const { priceOf, runOf } = await market();
  assert.deepEqual([0, 1, 2, 3].map(k => priceOf('shop', 'chems', k)), [25, 29, 33, 38], '$25, then 15% more for each unit bought');
  assert.equal(runOf('shop', 'chems', 0, 4), 125, '§9: chems from the shop cost about $125');
  // 200 × 1.15² is exactly 264.5: a half rounds down, which is §9's $264. Compounding a rounded $230 would give $265.
  assert.deepEqual([0, 1, 2].map(k => priceOf('shop', 'guns', k)), [200, 230, 264], "§9: the shop's next gun costs $200, then $230, then $264");
  assert.equal(runOf('shop', 'guns', 0, 3), 694);
  assert.equal(runOf('shop', 'guns', 1, 2), 494, 'a run starts wherever the curve is');
  assert.equal(runOf('shop', 'chems', 0, 4, 124), null, 'past the budget: no price at all, not a partial order');
  assert.equal(runOf('shop', 'chems', 0, 4, 125), 125, 'exactly the budget is enough');
});

test("the city's buyer: 6 units pay $37 and 10 doses $65 (§9's 'about $38' and the Chemist's +$5)", async () => {
  const { priceOf, runOf } = await market();
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(k => priceOf('buyer', 'parts', k)), [8, 7, 6, 6, 5, 5], '$8, then 10% less for each unit sold');
  // §9 says "about $38": 8 + 7.2 + 6.48 + 5.83 + 5.25 + 4.72 is $37.48, and in whole dollars it's $37.
  assert.equal(runOf('buyer', 'chems', 0, 6), 37);
  assert.equal(runOf('buyer', 'doses', 0, 10), 65, '§9: 10 doses to the city clear $5 over the $60 a Chemist paid for chems');
});

test('a corner: 6 doses take in $169 on a normal corner and $253 on a hot one, the night rounded once (§9)', async () => {
  const { cornerTakings } = await market();
  assert.equal(cornerTakings(6, false), 169, '§9: a normal corner takes in about $169');
  assert.equal(cornerTakings(6, true), 253, '§9: a hot corner about $253');
  assert.equal(cornerTakings(1, false), 36, 'the first dose is $36');
  assert.equal(cornerTakings(1, true), 54, '$54 on a hot corner');
  assert.equal(cornerTakings(7, false), 188, "a held corner's 7th dose: 36 × (1 + 0.9 + … + 0.9⁶) = 187.81");
  assert.equal(cornerTakings(0, true), 0, 'no doses, no takings');
});
