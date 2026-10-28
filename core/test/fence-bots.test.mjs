// Layer 2's bench at the fence (GAME.md §9, §25, §27): a bot lists a piece it won't wear below what it last sold for,
// a bargain hunter buys a listing that's under the list's price, partners swap piece for piece when each can see what
// it gets, and the report counts the fence from the record. Each test imports what it needs itself, so each fails on
// its own before the fence's bots exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, listCopies } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { rng } from '../rng.mjs';

const bots = () => import('../bench/bots.mjs');
const commons = (s, slot) => listCopies(s, t => t.tier === 'common' && !t.ability && t.slot === slot);
const ctxFor = (id, day, round) => ({ seed: 404, day, round, rounds: 3, rng: rng(404, 'bot', id, day, round) });
// Runs one bot's day for one round and applies its errands; every one of them must go through.
function runDay(g, bot, id, round) {
  const errands = bot.day(g.view(id), ctxFor(id, g.s.day, round));
  for (const e of errands) {
    const r = g.errand(id, e.kind, e);
    assert.ok(r.ok, `${id} ${e.kind}: ${r.why}`);
  }
  return errands;
}

test('a spare piece is a second piece for a slot worn with one at least as rare, or a take that isn\'t kit; never one worn or already moved', async () => {
  const { sparePieces } = await bots();
  const v = {
    me: {
      pieces: [
        { copy: 'k1', slot: 'top', tier: 'rare', ability: null, worn: true },
        { copy: 'k2', slot: 'top', tier: 'common', ability: null, worn: false },
        { copy: 'k3', slot: 'shoes', tier: 'epic', ability: null, worn: false },
        { copy: 'k4', slot: 'top', tier: 'epic', ability: null, worn: false },
        { copy: 'k5', slot: 'acc', tier: 'common', ability: 'knuckles', worn: false },
        { copy: 'k6', slot: 'eyes', tier: 'rare', ability: null, worn: false },
      ],
    },
  };
  const fit = { top: 'k1' };
  assert.deepEqual(sparePieces(v, fit, ['k5', 'k6']).map(p => p.copy), ['k2', 'k6'], 'k3 fills an empty slot, k4 is rarer than what it wears, k5 is kit');
  assert.deepEqual(sparePieces(v, fit, ['k5', 'k6'], new Set(['k6'])).map(p => p.copy), ['k2'], 'a piece an earlier errand moves');
  assert.deepEqual(sparePieces(v, { top: 'k4' }, []).map(p => p.copy), ['k1', 'k2'], 'wearing the epic, both lesser tops are spare');
});

test('a bargain is a listing under the list\'s price, within the budget and at least as rare as asked, never its own; the fence is shut on the last day', async () => {
  const { fenceBargain } = await bots();
  const v = day => ({
    day,
    me: { id: 'a01', fence: [{ deal: 'f3', kind: 'listing', role: 'seller' }] },
    board: {
      list: [{ trait: 'top/x', price: 100, tier: 'rare' }, { trait: 'shoes/y', price: 40, tier: 'common' }],
      fence: [
        { deal: 'f1', trait: 'top/x', tier: 'rare', price: 100 },
        { deal: 'f2', trait: 'top/x', tier: 'rare', price: 80 },
        { deal: 'f3', trait: 'top/x', tier: 'rare', price: 50 },
        { deal: 'f4', trait: 'shoes/y', tier: 'common', price: 30 },
      ],
    },
  });
  const ctx = { seed: 404, round: 1 };
  assert.equal(fenceBargain(v(5), ctx, 1000, 1).deal, 'f2', 'f1 is the list\'s own price, f3 is its own listing');
  assert.equal(fenceBargain(v(5), ctx, 50, 1), null, 'f2 is over the budget');
  assert.equal(fenceBargain(v(5), ctx, 50, 0).deal, 'f4');
  assert.equal(fenceBargain(v(N.nights), ctx, 1000, 0), null, 'no deals on the last day');
});

test('a worker lists its spare piece below what it last sold for, another buys it because it\'s under the list\'s price, and the fence pays the seller less its cut (§9)', async () => {
  const { makeBot, FENCE } = await bots();
  const g = new Game({ n: 3 });
  const [worn, spare] = commons(g.s, 'top');
  g.hand('a01', worn, { wear: true });
  g.hand('a01', spare);
  g.grant('a01', 100);
  g.grant('a02', 200);
  const cfg = id => ({ id, type: 'hustle', trade: 'smuggler', fav: 'industrial', route: 'downtown', layer: 2 });
  const seller = makeBot(cfg('a01'), {});
  const buyer = makeBot(cfg('a02'), {});
  const listed = runDay(g, seller, 'a01', 1).filter(e => e.kind === 'fence_list');
  assert.equal(listed.length, 1);
  const copy = listed[0].copy;
  const price = Math.floor(g.s.traits[g.s.copies[copy].trait].price * FENCE.list);
  assert.equal(listed[0].price, price, 'never sold yet, so below the list\'s price');
  const bought = runDay(g, buyer, 'a02', 1).filter(e => e.kind === 'fence_buy');
  assert.equal(bought.length, 1, 'a piece under the list\'s price comes before the list');
  const cash = g.s.agents.a01.cash;
  const r = g.night();
  assert.deepEqual(g.s.copies[copy].holder, { k: 'agent', id: 'a02' }, 'it arrives at dawn');
  const sold = r.newEvents.find(e => e.type === 'fence' && e.act === 'sold');
  const cut = Math.floor((price * N.fence) / 100);
  assert.deepEqual([sold.price, sold.fee, sold.cash], [price, cut, price - cut], 'paid at the lock, less the cut');
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the work event's wage is now a01's hustle event's take.
  const wage = r.newEvents.find(e => e.type === 'hustle' && e.agent === 'a01').take;
  assert.equal(g.s.agents.a01.cash, cash + price - cut + wage - N.rent, 'then its shift and the rent');
});

test('a partner offered a swap accepts piece for piece when it can see what it gets on the giver\'s public holdings record, and the pieces change hands at dawn (§9, §19)', async () => {
  const { makeBot } = await bots();
  const g = new Game({ n: 3 });
  const [topWorn, topSpare] = commons(g.s, 'top');
  const [shoesWorn, shoesSpare] = commons(g.s, 'shoes');
  g.hand('a01', topWorn, { wear: true });
  g.hand('a01', topSpare);
  g.hand('a02', shoesWorn, { wear: true });
  g.hand('a02', shoesSpare);
  g.grant('a01', 100);
  g.grant('a02', 100);
  // Two nights, so each one's holdings record from the first dawn is public.
  g.night();
  g.night();
  const offer = g.errand('a01', 'fence_swap', { to: 'a02', give: { pieces: [topSpare] }, get: { pieces: [shoesSpare] } });
  assert.ok(offer.ok, offer.why);
  const partner = makeBot({ id: 'a02', type: 'hustle', trade: 'smuggler', fav: 'industrial', route: 'downtown', layer: 2 }, {});
  const accepts = runDay(g, partner, 'a02', 2).filter(e => e.kind === 'fence_accept');
  assert.equal(accepts.length, 1);
  g.night();
  assert.deepEqual(g.s.copies[topSpare].holder, { k: 'agent', id: 'a02' });
  assert.deepEqual(g.s.copies[shoesSpare].holder, { k: 'agent', id: 'a01' });
});

test('a partner turns down a swap for a piece it\'s wearing (§9)', async () => {
  const { makeBot } = await bots();
  const g = new Game({ n: 3 });
  const [topWorn, topSpare] = commons(g.s, 'top');
  const [shoesWorn] = commons(g.s, 'shoes');
  g.hand('a01', topWorn, { wear: true });
  g.hand('a01', topSpare);
  g.hand('a02', shoesWorn, { wear: true });
  g.grant('a01', 100);
  g.grant('a02', 100);
  g.night();
  g.night();
  assert.ok(g.errand('a01', 'fence_swap', { to: 'a02', give: { pieces: [topSpare] }, get: { pieces: [shoesWorn] } }).ok);
  const partner = makeBot({ id: 'a02', type: 'hustle', trade: 'smuggler', fav: 'industrial', route: 'downtown', layer: 2 }, {});
  assert.equal(runDay(g, partner, 'a02', 2).filter(e => e.kind === 'fence_accept').length, 0);
});

test('the report counts the fence from the record: listed, sold, swaps offered, done and lapsed, deals handed back, and its cut (§9, §27)', async () => {
  const { seasonMetrics, summarize, seasonReport } = await import('../bench/report.mjs');
  const cast = [
    { id: 'a01', type: 'hustle', name: 'a', layer: 2 }, { id: 'a02', type: 'dealer', name: 'b', layer: 2 },
    { id: 'a03', type: 'cop', name: 'c', layer: 2 }, { id: 'a04', type: 'gunrunner', name: 'd', layer: 2 },
  ];
  const state = { agents: Object.fromEntries(cast.map(c => [c.id, {}])), copies: {}, money: { in: {}, out: {} } };
  const log = [
    { type: 'fence', act: 'list', deal: 'f1', agent: 'a01', copy: 'k1', trait: 't', price: 40 },
    { type: 'fence', act: 'list', deal: 'f2', agent: 'a01', copy: 'k2', trait: 't', price: 50 },
    { type: 'fence', act: 'buy', deal: 'f1', agent: 'a02', trait: 't', price: 40 },
    { type: 'fence', act: 'sold', deal: 'f1', agent: 'a01', copy: 'k1', trait: 't', price: 40, fee: 8, cash: 32 },
    { type: 'fence', act: 'bought', deal: 'f1', agent: 'a02', copy: 'k1', trait: 't', price: 40 },
    { type: 'fence', act: 'swap', deal: 'f3', a: 'a02', b: 'a01', give: { pieces: ['k3'], goods: {}, cash: 0 }, get: { pieces: ['k4'], goods: {}, cash: 0 } },
    { type: 'fence', act: 'swapped', deal: 'f3', a: 'a02', b: 'a01', fee: 0 },
    { type: 'fence', act: 'swap', deal: 'f4', a: 'a03', b: 'a01', give: { pieces: ['k5'], goods: {}, cash: 0 }, get: { pieces: ['k6'], goods: {}, cash: 0 } },
    { type: 'fence', act: 'expired', deal: 'f4', a: 'a03', b: 'a01' },
    { type: 'fence', act: 'returned', deal: 'f2', agent: 'a01', pieces: ['k2'], goods: {}, cash: 0 },
    ...cast.map(c => ({ type: 'mint', agent: c.id, mainland: 100, cards: [] })),
  ];
  const night = n => ({ night: n, haul: {}, hits: [], placesChanged: false, fights: [], guns: { held: 0, armed: 0 } });
  const bench = { seed: 1, rule: 'A', midseason: 'payday', nights: [night(1), night(2)] };
  const m = seasonMetrics(state, log, bench, cast);
  assert.deepEqual(m.fence, { listed: 2, sold: 1, offered: 2, swapped: 1, lapsed: 1, returned: 1, fees: 8 });
  assert.match(seasonReport(m), /\*\*The fence:\*\* 2 pieces listed, 1 sold \(its cut \$8\); 2 swaps offered, 1 done, 1 lapsed; 1 deals handed back on night 14\./);
  const all = summarize([m, m]).keyNumbers.find(k => k.group === 'all');
  assert.deepEqual(all.fence, { listed: 4, sold: 2, offered: 4, swapped: 2, lapsed: 2, returned: 2, fees: 16 });
});
