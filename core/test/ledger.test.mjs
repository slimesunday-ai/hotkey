// GAME.md §23: one ledger holds every trait copy, with exactly one holder at every moment. Cash and goods are conserved
// except at the named sources and sinks (§9). Both are checked after every errand and every night (§26).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy, tierCopy, json } from './helpers.mjs';
import { ledgerProblems, checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';

const HOLDERS = ['list', 'agent', 'crew', 'vault', 'minted', 'gone', 'rollover'];

// Independent of ledger.mjs: count the places that claim each copy.
function claims(s) {
  const out = {};
  const add = (k, who) => (out[k] ||= []).push(who);
  for (const [k, c] of Object.entries(s.copies)) add(k, `holder:${c.holder.k}:${c.holder.id || ''}`);
  for (const a of Object.values(s.agents)) for (const k of Object.values(a.outfit)) add(k, `outfit:${a.id}`);
  return out;
}
function cashHeld(s) {
  return Object.values(s.agents).reduce((t, a) => t + a.cash, 0) + Object.values(s.crews).reduce((t, c) => t + c.cash, 0)
    + s.vault.cash + s.offers.reduce((t, o) => t + o.amount, 0);
}
const sum = o => Object.values(o).reduce((t, v) => t + v, 0);
function perTrait(s) {
  return Object.fromEntries(Object.values(s.traits).map(t => [t.id, t.copies.length]));
}
function invariants(s, counts) {
  for (const [k, list] of Object.entries(claims(s))) {
    const holder = list.filter(x => x.startsWith('holder:'));
    assert.equal(holder.length, 1, `${k} has ${holder.length} holders`);
    const kind = holder[0].split(':')[1];
    assert.ok(HOLDERS.includes(kind), `${k} held by ${kind}`);
    for (const o of list.filter(x => x.startsWith('outfit:'))) {
      assert.equal(holder[0], `holder:agent:${o.split(':')[1]}`, `${k} is worn by ${o} but held by ${holder[0]}`);
    }
  }
  assert.deepEqual(perTrait(s), counts, 'copies per trait never change');
  assert.equal(cashHeld(s), sum(s.money.in) - sum(s.money.out), 'cash held = in - out');
}

test('the drop: §3/§38 counts, every copy on the list', () => {
  const g = new Game();
  const tiers = {};
  for (const t of Object.values(g.s.traits)) (tiers[t.tier] ||= []).push(t.copies.length);
  for (const [tier, { traits, copies }] of Object.entries(N.drop)) {
    assert.equal(tiers[tier].length, traits, `${tier} traits`);
    assert.ok(tiers[tier].every(c => c === copies), `${tier} copies each`);
  }
  assert.equal(Object.keys(g.s.copies).length, 3 * 1 + 4 * 2 + 8 * 4 + 20 * 5);
  assert.ok(Object.values(g.s.copies).every(c => c.holder.k === 'list'));
  assert.deepEqual(ledgerProblems(g.s), []);
});

test('exactly one holder and cash conservation after every errand and every night', () => {
  const g = new Game({ n: 6 });
  const counts = perTrait(g.s);
  invariants(g.s, counts);
  g.grant('a01', 600);
  g.grant('a02', 300);
  g.grant('a03', 200);
  const knuckles = g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
  const rare = g.hand('a04', tierCopy(g.s, 'rare'), { wear: true });
  const steps = [
    () => g.errand('a01', 'offer', { trait: Object.values(g.s.traits).find(t => t.tier === 'common' && !t.ability).id, amount: 100 }),
    () => g.errand('a02', 'offer', { trait: Object.values(g.s.traits).find(t => t.tier === 'common' && !t.ability).id, amount: 120 }),
    () => g.errand('a02', 'give', { to: 'a03', cash: 50 }),
    () => g.errand('a03', 'pay', { to: 'a05', amount: 20, for: 'cut' }),
    () => g.errand('a01', 'crew_form', { name: 'test crew' }),
    () => g.errand('a01', 'crew_invite', { agent: 'a02' }),
    () => g.errand('a02', 'crew_join', { crew: 'c1' }),
    () => g.errand('a02', 'stash_put', { cash: 40 }),
    () => g.errand('a01', 'stash_take', { cash: 40 }),
    () => g.night({ a01: { kind: 'hit', target: 'a04', place: 'docks' }, a06: { kind: 'hit', target: 'a01', place: 'downtown' } }),
    () => g.errand('a04', 'dress', { fit: {} }),
    () => g.night({ a04: { kind: 'laylow' } }),
    () => g.advanceTo(14),
    () => g.night({ a02: { kind: 'hit', target: 'a03', place: 'downtown' } }),
  ];
  for (const step of steps) {
    step();
    invariants(g.s, counts);
  }
  assert.ok(g.s.over, 'the season ran to the end');
  assert.ok(knuckles && rare);
  assert.ok(Object.values(g.s.copies).every(c => ['minted', 'gone', 'rollover'].includes(c.holder.k)), 'after the ferry every copy is minted, gone or rolled over');
  assert.equal(cashHeld(g.s), 0, 'after the ferry no cash is left on the island');
});

test('the check catches planted corruption (and passes a clean state)', () => {
  const clean = new Game({ n: 3 });
  clean.grant('a01', 100);
  clean.hand('a01', tierCopy(clean.s, 'common'), { wear: true });
  assert.deepEqual(ledgerProblems(clean.s), [], 'positive control: a clean state has no problems');
  assert.equal(checkLedger(clean.s), true);

  const plant = fn => {
    const s = structuredClone(clean.s);
    fn(s);
    return ledgerProblems(s);
  };
  const someCopy = Object.keys(clean.s.copies).find(k => clean.s.copies[k].holder.k === 'list');

  assert.ok(plant(s => { s.agents.a02.outfit[s.copies[someCopy].slot] = someCopy; }).some(p => /a02 wears/.test(p)), 'a copy worn by an agent that does not hold it');
  assert.ok(plant(s => { s.agents.a02.cash = -5; }).some(p => /a02 has cash -5/.test(p)), 'negative cash');
  assert.ok(plant(s => {
    const [x, y] = Object.values(s.traits);
    y.copies.push(x.copies[0]);
  }).length > 0, 'one copy listed under two traits');
  assert.ok(plant(s => { s.agents.a03.cash += 100; }).some(p => /^cash:/.test(p)), 'cash made from nothing');
  assert.ok(plant(s => { s.vault.cash += 1; }).some(p => /^cash:/.test(p)), 'cash appearing in the vault');
  assert.ok(plant(s => { delete s.copies[someCopy]; }).length > 0, 'a copy lost');
  assert.ok(plant(s => { s.copies[someCopy].holder = { k: 'agent', id: 'a02' }; }).some(p => /history ends/.test(p)), 'a holder changed without its history');
  assert.ok(plant(s => { s.copies[someCopy].holder = { k: 'pocket' }; }).length > 0, 'an unknown kind of holder');
  assert.ok(plant(s => { s.copies[someCopy].holder = { k: 'agent', id: 'a99' }; s.copies[someCopy].hist.push({ to: 'agent:a99' }); }).some(p => /unknown agent/.test(p)), 'a holder that is not an agent');
  assert.throws(() => checkLedger(Object.assign(structuredClone(clean.s), { vault: { cash: 7 } })), /LEDGER CHECK FAILED/);
  assert.equal(json(ledgerProblems(clean.s)), '[]', 'planting never touched the clean state');
});
