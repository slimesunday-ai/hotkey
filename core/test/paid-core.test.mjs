// Paid-test repair regressions. Fixtures exercise real errands/night transitions and the ledger, without model calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import * as errands from '../rules/errand.mjs';
import { addGoods, bookGoods, rarest } from '../rules/state.mjs';
import { cornerTakings } from '../rules/market.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';

function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s);
}
function worker(rule, trade) {
  const g = new Game({ n: 2, rule });
  const r = newSeason({ seed: 404, rule, items: ITEMS, agents: [
    { id: 'a01', name: 'robber', trade: 'smuggler' }, { id: 'a02', name: 'worker', trade },
  ] });
  g.s = r.state; g.log = [...r.events];
  g.grant('a01', 100); g.grant('a02', 100);
  stock(g, 'a01', 'guns', 1);
  return g;
}
for (const rule of ['A', 'B']) for (const trade of ['dealer', 'chemist']) {
  test(`paid core ${rule}: burglary leaves remote ${trade} production intact`, () => {
    const corner = Object.keys(N.corners).find(k => !N.corners[k].hot);
    const play = trade === 'dealer' ? { kind: 'deal', corner, doses: 4 } : { kind: 'cook', place: 'forest', batches: 1 };
    const output = burgle => {
      const g = worker(rule, trade);
      const r = g.night({ a01: burgle ? { kind: 'breakin', target: 'a02' } : { kind: 'hustle', place: 'docks' }, a02: play });
      const e = r.newEvents.find(e => e.type === (trade === 'dealer' ? 'sale' : 'cook') && e.agent === 'a02');
      if (burgle) {
        const take = r.newEvents.find(e => e.type === 'burgle');
        assert.ok(take, 'fixture wins the break-in');
        assert.equal(take.goods, undefined);
      }
      return { doses: e.doses, cash: e.cash, goods: g.s.agents.a02.goods };
    };
    assert.deepEqual(output(true), output(false));
    assert.equal(output(true).doses, trade === 'dealer' ? 4 : N.cook.doses);
  });
}
test('paid core: street hit takes lab chems; Dealer hold-up still sells doses and moves real takings', () => {
  const lab = worker('A', 'chemist');
  const r = lab.night({ a01: { kind: 'hit', target: 'a02', place: 'forest' }, a02: { kind: 'cook', place: 'forest', batches: 1 } });
  assert.equal(r.newEvents.find(e => e.type === 'rob').goods.chems, N.cook.chems);
  assert.equal(r.newEvents.find(e => e.type === 'cook').doses, 0);
  const g = worker('A', 'dealer');
  const corner = Object.keys(N.corners).find(k => !N.corners[k].hot);
  const h = g.night({ a01: { kind: 'hit', target: 'a02', place: N.corners[corner].place }, a02: { kind: 'deal', corner, doses: 4 } });
  assert.equal(h.newEvents.find(e => e.type === 'sale').doses, 4);
  const rob = h.newEvents.find(e => e.type === 'rob');
  assert.equal(rob.goods, undefined);
  assert.equal(rob.cash, cornerTakings(4, false));
});

test('paid core: accepted invitation words are delivered once, privately, for one message', () => {
  const g = new Game({ n: 3 });
  g.errand('a01', 'ask', { to: 'a02' });
  const sitdown = g.events('ask').at(-1).sitdown;
  const line = 'I can discuss those goods tomorrow.';
  const before = g.s.agents.a02.msgs;
  const r = g.errand('a02', 'answer', { sitdown, accept: true, line, terms: { cash: 90, what: 'trade' } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.receipt, { kind: 'answer', sitdown, state: 'open', speechSent: true });
  assert.equal(g.s.agents.a02.msgs, before + 1);
  for (const id of ['a01', 'a02']) {
    const sd = g.view(id).me.sitdowns.find(s => s.id === sitdown);
    assert.equal(sd.said.length, 1);
    assert.equal(sd.said[0].line, line);
    assert.deepEqual(sd.said[0].terms, {});
    assert.equal(g.view(id).events.filter(e => e.type === 'say' && e.line === line).length, 1);
    assert.equal(JSON.stringify(g.view(id, 'ownerAI')).includes(line), false);
  }
  assert.equal(JSON.stringify(g.view('a03')).includes(line), false);
  assert.equal(g.errand('a02', 'answer', { sitdown, accept: true, line }).ok, false);
  assert.equal(g.s.sitdowns[sitdown].said.length, 1);
  assert.equal(g.s.agents.a02.msgs, before + 1);
  g.night();
  assert.equal(g.view('a03').events.filter(e => e.type === 'say' && e.line === line).length, 1);
});

test('paid core: action state and real rent share preconditions, tab and fresh batch play facts', () => {
  const g = new Game();
  g.grant('a01', 100);
  const housed = g.view('a01').me.actions;
  assert.equal(housed.rent.restore.ok, false);
  assert.equal(housed.rent.automaticDawn, N.rent);
  assert.equal(g.errand('a01', 'rent').why, housed.rent.restore.why);
  g.s.agents.a01.evicted = true;
  g.s.agents.a01.tab = 40;
  const cash = g.s.agents.a01.cash;
  assert.equal(errands.actionState(g.s, 'a01').rent.restore.ok, true);
  const r = g.errand('a01', 'rent');
  assert.equal(g.s.agents.a01.cash, cash - N.rent);
  assert.equal(g.s.agents.a01.tab, 40);
  assert.equal(r.actions.rent.housed, true);
  assert.ok(r.legal.some(p => p.kind === 'laylow'));
  g.night();
  assert.equal(g.s.money.out.rent, (Object.keys(g.s.agents).length + 1) * N.rent);
});

test('paid core: quantity quote, reservation and sale timing come from the same engine checks', () => {
  const g = new Game();
  g.grant('a01', 100);
  const e = { by: 'a01', kind: 'shop', item: 'chems', units: 2, max: 50 };
  const q = errands.marketQuote(g.s, 'a01', e);
  assert.equal(q.total, 54);
  assert.equal(q.check.ok, false);
  const refused = g.errand('a01', 'shop', e);
  assert.equal(refused.why, q.check.why);
  assert.deepEqual(refused.quote, q);
  assert.equal(g.view('a01').me.actions.market.shop.chems.quotes[0].total, 54);
  const cash = g.s.agents.a01.cash;
  const held = g.s.agents.a01.goods.chems || 0;
  const r = g.errand('a01', 'shop', { ...e, max: 54 });
  assert.equal(r.ok, true);
  assert.equal(r.quote.total, 54);
  assert.equal(r.quote.check.ok, true);
  assert.equal(r.actions.cash.spendable, cash - 54);
  assert.equal(r.actions.cash.reserved, 54);
  assert.equal(r.actions.orders[0].reservedCash, 54);
  assert.equal(g.s.agents.a01.goods.chems || 0, held);
  assert.equal(r.actions.orders[0].settles, 'lock');
  assert.equal(r.actions.orders[0].status, 'placed');
  stock(g, 'a02', 'chems', 2);
  const before = g.s.agents.a02.cash;
  const sale = g.errand('a02', 'sell', { item: 'chems', units: 2 });
  assert.equal(sale.actions.cash.spendable, before);
  assert.deepEqual(sale.actions.orders[0].reservedGoods, { chems: 2 });
  assert.equal(g.s.agents.a02.goods.chems || 0, 0);
});

test('paid core: action facts expose own invitations and orders, never other private pending state', () => {
  const g = new Game();
  g.grant('a01', 100); g.grant('a02', 1000);
  const baseline = g.view('a01').me.actions;
  g.errand('a02', 'shop', { item: 'chems', units: 3, max: 200 });
  g.errand('a02', 'ask', { to: 'a03', line: 'private canary' });
  assert.deepEqual(g.view('a01').me.actions, baseline);
  assert.equal(g.view(null, 'public').me, undefined);
  const q = errands.marketQuote(g.s, 'a01', { kind: 'shop', item: 'chems', units: 2, max: 54 });
  assert.equal(q.total, 54);
  assert.equal(q.check.ok, true);
  g.errand('a02', 'ask', { to: 'a01' });
  const sd = g.events('ask').at(-1).sitdown;
  assert.equal(g.view('a01').me.actions.invitations.find(x => x.sitdown === sd).answer.ok, true);
  g.errand('a01', 'answer', { sitdown: sd, accept: true });
  const open = g.view('a01').me.actions.invitations.find(x => x.sitdown === sd);
  assert.equal(open.answer.ok, false);
  assert.match(open.answer.why, /use say/);
  assert.equal(open.say.ok, true);
});

test('paid core: offer and last-day fence action facts agree with actual refusals', () => {
  const g = new Game();
  g.grant('a01', 2000);
  const row = g.view('a01').me.actions.offers.find(x => x.available.ok);
  assert.ok(row);
  const r = g.errand('a01', 'offer', { trait: row.trait, amount: row.minimum });
  assert.equal(r.ok, true);
  const again = g.view('a01').me.actions.offers.find(x => x.trait === row.trait);
  assert.equal(again.held, row.minimum);
  assert.equal(again.available.ok, false);
  assert.equal(g.errand('a01', 'offer', { trait: row.trait, amount: row.minimum }).why, again.available.why);
  g.advanceTo(14);
  assert.equal(g.view('a01').me.actions.fence.open, false);
  assert.equal(g.errand('a01', 'fence_buy', { deal: 'missing' }).why, 'the fence is closed on the last day');
});

test('paid core: theft and mint carry original-copy value with a latest-price shadow', () => {
  const g = new Game({ n: 3 });
  const t = Object.values(g.s.traits).find(t => t.opens === 1 && t.copies.length >= 2);
  g.grant('a01', 4000); g.grant('a02', 4000);
  const firstPrice = t.price;
  assert.equal(g.errand('a01', 'offer', { trait: t.id, amount: firstPrice }).ok, true);
  g.night();
  const first = g.events('buy', e => e.agent === 'a01')[0].copy;
  assert.equal(g.errand('a02', 'offer', { trait: t.id, amount: 1000 }).ok, true);
  g.night();
  const second = g.events('buy', e => e.agent === 'a02')[0].copy;
  // The tie rule deliberately remains latest trait price then lower id, regardless of copy-paid presentation.
  assert.equal(rarest(g.s, [second, first]), [second, first].sort()[0]);
  assert.equal(rarest(g.s, [second, first], second), second);
  g.errand('a01', 'dress', { fit: { [g.s.copies[first].slot]: first } });
  stock(g, 'a03', 'guns', 1);
  const r = g.night({ a01: { kind: 'run', place: 'forest' }, a03: { kind: 'hit', target: 'a01', place: 'forest' } });
  const theft = r.newEvents.find(e => e.type === 'rob');
  assert.equal(theft.copy, first);
  assert.equal(theft.pieceValue, firstPrice);
  assert.equal(theft.value, theft.cash + firstPrice);
  assert.equal(theft.mark, theft.cash + 1000);
  g.advanceTo(14); g.night();
  const card = g.events('mint', e => e.agent === 'a03')[0].cards.find(c => c.copy === first);
  assert.equal(card.value, firstPrice);
  assert.equal(card.mark, 1000);
  assert.equal(card.valueBasis, 'copy-paid');
  assert.equal(g.s.copies[first].holder.k, 'minted');
});


test('paid core: CLEAR wipes accepted words through the normal speech path and action facts cannot restore them', () => {
  const g = new Game({ n: 3 });
  stock(g, 'a02', 'clear', 1);
  g.errand('a01', 'ask', { to: 'a02' });
  const sitdown = g.events('ask').at(-1).sitdown;
  const line = 'ACCEPTED-PRIVATE-CLEAR-CANARY';
  g.errand('a02', 'answer', { sitdown, accept: true, line });
  assert.ok(JSON.stringify(g.view('a02')).includes(line));
  const r = g.errand('a02', 'take', { drug: 'clear' });
  assert.equal(r.ok, true);
  assert.equal(JSON.stringify(g.view('a02')).includes(line), false);
  assert.equal(JSON.stringify(r.actions).includes(line), false);
  assert.equal(r.actions.invitations.find(x => x.sitdown === sitdown).say.ok, true);
  assert.ok(JSON.stringify(g.view('a01')).includes(line));
  assert.equal(JSON.stringify(g.view('a03')).includes(line), false);
  g.night();
  assert.ok(JSON.stringify(g.view('a02')).includes(line));
  assert.ok(JSON.stringify(g.view('a03')).includes(line));
});

test('paid core: successful shop publishes newly enabled cooking; sale cannot fund restore home today', () => {
  const g = worker('A', 'chemist');
  const a = g.s.agents.a02;
  const held = a.goods.chems || 0;
  if (held) {
    addGoods(a, 'chems', -held);
    bookGoods(g.s, 'out', 'test', 'chems', held);
  }
  assert.equal(g.view('a02').legal.some(p => p.kind === 'cook'), false);
  const r = g.errand('a02', 'shop', { item: 'chems', units: 2, max: 54 });
  assert.equal(r.ok, true);
  assert.ok(r.legal.some(p => p.kind === 'cook' && p.place === 'forest'));
  const sold = new Game({ n: 2 });
  sold.s.agents.a01.evicted = true;
  stock(sold, 'a01', 'chems', 10);
  const sale = sold.errand('a01', 'sell', { item: 'chems', units: 10 });
  assert.equal(sale.ok, true);
  assert.equal(sale.actions.rent.restore.ok, false);
  assert.equal(sold.errand('a01', 'rent').ok, false);
  sold.night();
  assert.equal(sold.view('a01').me.actions.rent.restore.ok, true);
});

test('paid core: preconditions are explicit while TRUTH remains an atomic execution constraint', () => {
  const g = worker('A', 'chemist');
  stock(g, 'a02', 'truth', 1);
  const play = { kind: 'cook', place: 'forest', batches: 1 };
  assert.equal(g.errand('a02', 'take', { drug: 'truth', play }).ok, true);
  const sale = { by: 'a02', kind: 'sell', item: 'chems', units: N.cook.chems };
  const status = errands.checkAction(g.s, sale);
  assert.equal(status.scope, 'preconditions');
  assert.equal(status.ok, true, 'inventory satisfies the sale preconditions');
  const before = structuredClone(g.s);
  const log = structuredClone(g.log);
  const r = g.errand('a02', 'sell', sale);
  assert.equal(r.ok, false);
  assert.equal(r.why, 'that would break the play locked tonight');
  assert.equal(r.actions.scope, 'preconditions');
  assert.deepEqual(r.actions.constraints.lockedPlay, g.s.agents.a02.locked);
  assert.equal(r.actions.constraints.lockedPlay.kind, 'cook');
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].type, 'invalid');
  assert.equal(r.events[0].kind, 'not-yet');
  assert.deepEqual(g.s, { ...before, seq: before.seq + 1 }, 'cash, goods, messages, next IDs and every operation effect roll back');
  assert.deepEqual(g.log, [...log, ...r.events], 'only the typed refusal is recorded');
});


test('paid core: conversation receipt describes actual word delivery for empty accepts, speech and declines', () => {
  const g = new Game({ n: 3 });
  g.errand('a01', 'ask', { to: 'a02' });
  const sitdown = g.events('ask').at(-1).sitdown;
  const opened = g.errand('a02', 'answer', { sitdown, accept: true });
  assert.deepEqual(opened.receipt, { kind: 'answer', sitdown, state: 'open', speechSent: false });
  const said = g.errand('a01', 'say', { sitdown, say: 'answer', line: 'plain reply' });
  assert.deepEqual(said.receipt, { kind: 'say', sitdown, state: 'open', speechSent: true });
  g.errand('a01', 'ask', { to: 'a03' });
  const declinedId = g.events('ask').at(-1).sitdown;
  const declined = g.errand('a03', 'answer', { sitdown: declinedId, accept: false, line: 'No thanks.' });
  assert.deepEqual(declined.receipt, { kind: 'answer', sitdown: declinedId, state: 'declined', speechSent: true });
  assert.equal(g.events('decline').at(-1).line, 'No thanks.');
});
