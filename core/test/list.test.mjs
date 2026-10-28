// The drop and the list (GAME.md §3, numbers in §38; rounding is the GAP row gap.rounding).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy } from './helpers.mjs';
import { N } from '../numbers.mjs';

const plainCommon = s => Object.values(s.traits).filter(t => t.tier === 'common' && !t.ability).sort((x, y) => (x.id < y.id ? -1 : 1))[0];
const firstOf = (s, tier) => Object.values(s.traits).filter(t => t.tier === tier).sort((x, y) => (x.id < y.id ? -1 : 1))[0];
const left = (s, tid) => s.traits[tid].copies.filter(k => s.copies[k].holder.k === 'list').length;

test('waves: commons open on night 1, rares on 4, epics on 7, grails on 10 (§2, §3)', () => {
  const g = new Game({ n: 2 });
  for (const t of Object.values(g.s.traits)) assert.equal(t.opens, { common: 1, rare: 4, epic: 7, grail: 10 }[t.tier], t.id);
  g.grant('a01', 20000);
  const rare = firstOf(g.s, 'rare');
  const early = g.errand('a01', 'offer', { trait: rare.id, amount: rare.price });
  assert.equal(early.ok, false, 'a rare on day 1 is refused');
  assert.equal(g.events('invalid').at(-1).kind, 'not-yet');
  g.advanceTo(4);
  assert.equal(g.errand('a01', 'offer', { trait: rare.id, amount: g.s.traits[rare.id].price }).ok, true, 'a rare on day 4 is taken');
  const epic = firstOf(g.s, 'epic');
  assert.equal(g.errand('a01', 'offer', { trait: epic.id, amount: epic.price }).ok, false, 'an epic before night 7');
  const grail = firstOf(g.s, 'grail');
  g.advanceTo(10);
  assert.equal(g.errand('a01', 'offer', { trait: grail.id, amount: g.s.traits[grail.id].price }).ok, true, 'a grail on day 10');
});

test('prices fall 20% each open night without a sale, to whole dollars, never below the floor (§3, §38)', () => {
  const g = new Game({ n: 2 });
  const c = plainCommon(g.s);
  const r = firstOf(g.s, 'rare');
  assert.deepEqual([c.price, c.floor], N.price.common);
  assert.deepEqual([r.price, r.floor], N.price.rare);
  const seen = [];
  const rare = [];
  while (g.s.day <= 11) {
    rare.push(g.s.traits[r.id].price);
    g.night();
    seen.push(g.s.traits[c.id].price);
  }
  // Each open night without a sale takes priceFall off, to the nearest dollar, never below the floor (gap.rounding).
  // At 20%: 100 -> 80 -> 64 -> 51.2=51 -> 40.8=41 -> 32.8 (floor 40) -> 40, and 40 from then on.
  const fall = ([price, floor], nights) => Array.from({ length: nights }).reduce(p => [...p, Math.max(floor, Math.round(p.at(-1) * (1 - N.priceFall)))], [price]).slice(1);
  assert.deepEqual(seen.slice(0, 10), fall(N.price.common, 10));
  assert.ok(seen.slice(0, 10).includes(c.floor), 'control: the price reaches its floor and stays there');
  // A rare isn't open until night 4, so its price holds until then; the first open night without a sale takes 20% off.
  assert.deepEqual(rare.slice(0, 5), [...Array(4).fill(N.price.rare[0]), ...fall(N.price.rare, 1)]);
});

test('a night with a sale raises the price 20% (§3)', () => {
  const g = new Game({ n: 2 });
  const c = plainCommon(g.s);
  g.grant('a01', 500);
  g.errand('a01', 'offer', { trait: c.id, amount: 100 });
  g.night();
  assert.equal(g.s.traits[c.id].price, 120);
});

test('the highest offers win, winners pay what they offered, everyone else gets their cash back (§3)', () => {
  const g = new Game({ n: 6 });
  const c = plainCommon(g.s);
  const offers = { a01: 150, a02: 140, a03: 130, a04: 120, a05: 110, a06: 100 };
  for (const [id, amount] of Object.entries(offers)) {
    g.grant(id, 200);
    assert.equal(g.errand(id, 'offer', { trait: c.id, amount }).ok, true);
    assert.equal(g.s.agents[id].cash, 200 - amount, 'the offer is held until the lock');
  }
  const lowAll = Object.fromEntries(Object.keys(offers).map(id => [id, { kind: 'laylow' }]));
  g.night(lowAll);
  for (const [id, amount] of Object.entries(offers)) {
    const won = amount >= 110;
    assert.equal(g.s.agents[id].cash, won ? 200 - amount - N.rent : 200 - N.rent, `${id}'s cash`);
    const held = Object.values(g.s.copies).filter(k => k.trait === c.id && k.holder.k === 'agent' && k.holder.id === id).length;
    assert.equal(held, won ? 1 : 0, `${id} holds a copy`);
  }
  assert.equal(g.s.money.out.list, 150 + 140 + 130 + 120 + 110);
  assert.deepEqual(g.events('refund').map(e => [e.agent, e.amount]), [['a06', 100]]);
});

test('an exact tie for the last copy means nobody gets it tonight (§3)', () => {
  const g = new Game({ n: 6 });
  const c = plainCommon(g.s);
  const offers = { a01: 150, a02: 140, a03: 130, a04: 120, a05: 110, a06: 110 };
  for (const [id, amount] of Object.entries(offers)) {
    g.grant(id, 200);
    g.errand(id, 'offer', { trait: c.id, amount });
  }
  g.night(Object.fromEntries(Object.keys(offers).map(id => [id, { kind: 'laylow' }])));
  assert.equal(left(g.s, c.id), 1, 'the fifth copy stays on the list');
  assert.deepEqual(g.events('refund').map(e => e.agent).sort(), ['a05', 'a06']);
  assert.deepEqual(g.events('buy').map(e => e.agent).sort(), ['a01', 'a02', 'a03', 'a04']);
});

test('offers: at or above today\'s price, one per trait per night, not more than you have (§3)', () => {
  const g = new Game({ n: 2 });
  const c = plainCommon(g.s);
  const other = Object.values(g.s.traits).filter(t => t.tier === 'common' && t.id !== c.id)[0];
  g.grant('a01', 150);
  assert.equal(g.errand('a01', 'offer', { trait: c.id, amount: 99 }).ok, false, 'below today\'s price');
  assert.equal(g.errand('a01', 'offer', { trait: c.id, amount: 100 }).ok, true);
  assert.equal(g.errand('a01', 'offer', { trait: c.id, amount: 100 }).ok, false, 'a second offer on the same trait tonight');
  assert.equal(g.errand('a01', 'offer', { trait: other.id, amount: 100 }).ok, false, 'not enough cash left');
  assert.equal(g.s.agents.a01.cash, 50);
});

test('a bought trait arrives at dawn, not during the night, and the sale is public at dawn (§3, §19)', () => {
  const g = new Game({ n: 3 });
  const c = plainCommon(g.s);
  g.grant('a01', 300);
  g.hand('a02', abilityCopy(g.s, 'knuckles'), { wear: true });
  g.errand('a01', 'offer', { trait: c.id, amount: 100 });
  assert.ok(g.view('a01').events.some(e => e.type === 'bid' && e.agent === 'a01'), 'positive control: the buyer sees its own offer');
  assert.ok(!g.view('a03').events.some(e => e.type === 'bid'), 'an offer is private');
  // a02 breaks into a01's home tonight (a01 is out on a shift, so the lock alone defends: 2 against 1).
  const r = g.night({ a02: { kind: 'breakin', target: 'a01' } });
  const burgle = r.newEvents.find(e => e.type === 'burgle');
  assert.ok(burgle, 'the break-in won');
  assert.equal(burgle.copy, null, 'the trait bought tonight was not in the home yet');
  assert.equal(burgle.cash, Math.floor((300 - 100) * N.breakinShare), "the break-in's share of the cash there: 300 less the 100 held for the offer (breakinShare)");
  const copy = Object.values(g.s.copies).find(k => k.trait === c.id && k.holder.k === 'agent');
  assert.equal(copy.holder.id, 'a01', 'at dawn the trait is in the buyer\'s stash');
  const last = copy.hist.at(-1);
  assert.equal(last.what, 'bought');
  assert.equal(last.t, 4, 'stamped at dawn of day 2');
  const sale = g.view('a03').board.sales.find(x => x.trait === c.id);
  assert.deepEqual([sale.agent, sale.price], ['a01', 100], 'the sale is public at dawn: who, what, how much');
  assert.equal(g.events('buy')[0].vis.to, 'all');
});

test('the list closes after night 12; unsold copies roll into next season\'s list (§3)', () => {
  const g = new Game({ n: 2 });
  g.grant('a01', 50000);
  g.advanceTo(12);
  const c = plainCommon(g.s);
  assert.equal(g.errand('a01', 'offer', { trait: c.id, amount: g.s.traits[c.id].price }).ok, true, 'positive control: day 12 is open');
  g.night();
  const again = g.errand('a01', 'offer', { trait: c.id, amount: 10000 });
  assert.equal(again.ok, false);
  assert.equal(again.why, 'the list is closed');
  g.advanceTo(14);
  const onList = Object.keys(g.s.copies).filter(k => g.s.copies[k].holder.k === 'list');
  g.night();
  assert.ok(onList.length > 0);
  for (const k of onList) assert.equal(g.s.copies[k].holder.k, 'rollover', k);
  assert.deepEqual(g.events('rollover')[0].copies, onList.sort());
});
