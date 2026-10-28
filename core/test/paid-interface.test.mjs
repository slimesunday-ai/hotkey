import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, tierCopy } from './helpers.mjs';
import { read, reply, replyFormat } from '../agents/tools.mjs';
import { checkPlay, legalPlays } from '../rules/plays.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { briefing } from '../agents/briefing.mjs';

const stock = (g, item, n) => { addGoods(g.s.agents.a01, item, n); bookGoods(g.s, 'in', 'test', item, n); };
function caller(g) {
  const { deal } = read(g.view('a01'), { audience: 'seat', seed: 'paid-interface-fixture' });
  return { deal, tries: {}, validatePlay: p => checkPlay(g.s, 'a01', p, g.s.day), apply: e => {
    const r = g.errand('a01', e.kind, e);
    return { ...r, legal: legalPlays(g.s, 'a01'), kind: r.events.find(e => e.type === 'invalid')?.kind };
  } };
}
test('rent then explicit laylow and adequately capped shop then cook use current core state', () => {
  for (const kind of ['rent', 'shop']) {
    const g = new Game({ n: 3 }); g.grant('a01', 100);
    g.s.agents.a01.evicted = kind === 'rent';
    if (kind === 'shop') g.s.agents.a01.trade = 'chemist';
    const ctx = caller(g);
    const actions = kind === 'rent' ? [{ act: 'rent' }, { act: 'play', kind: 'laylow', place: 'suburbs' }]
      : [{ act: 'shop', item: 'chems', units: 2, max: 54 }, { act: 'play', kind: 'cook', place: 'forest', batches: 1 }];
    const out = reply({ actions }, ctx);
    assert.deepEqual(out.results.map(r => r.ok), [true, true]);
    assert.equal(out.play.kind, kind === 'rent' ? 'laylow' : 'cook');
    const original = ctx.deal.menu[0];
    assert.equal(reply({ act: 'play', menu: original.n }, ctx).play.kind, original.kind);
  }
});
test('per-kind fields and conflicting numbered kind are refused with no silent intent change', () => {
  const g = new Game({ n: 3 }); const ctx = caller(g);
  for (const action of [
    { act: 'play', kind: 'hit', target: 'a02', place: 'docks', drug: 'temp' },
    { act: 'play', kind: 'hit', target: 'a02', place: 'docks', guns: 2 },
    { act: 'play', kind: 'back', target: 'a02', accept: ['a03'] },
    { act: 'play', menu: 1, kind: 'hit', target: 'a02', place: 'docks' },
  ]) {
    const out = reply(action, ctx); assert.equal(out.play, null); assert.equal(out.results[0].code, 'field');
    assert.equal(out.results[0].source, 'tools');
  }
});
test('a sale places an order, cannot fund rent now, and receipts distinguish core from schema', () => {
  const g = new Game({ n: 3 }); g.s.agents.a01.evicted = true; stock(g, 'chems', 6);
  const out = reply({ actions: [{ act: 'sell', item: 'chems', units: 6 }, { act: 'rent' }] }, caller(g));
  assert.equal(out.results[0].status, 'placed'); assert.equal(out.results[0].source, 'core');
  assert.equal(out.results[1].ok, false); assert.equal(out.results[1].source, 'core'); assert.equal(g.s.agents.a01.cash, 0);
});
test('briefing names automatic rent, invitation transition, buyer offer and voluntary transfers within unchanged budget', () => {
  const g = new Game({ n: 3 }); g.errand('a02', 'ask', { to: 'a01', line: 'PRIVATE_WORDS' });
  const seen = read(g.view('a01'), { audience: 'seat', seed: 'fixture' });
  const text = briefing(seen).map(m => m.content).join('\n');
  assert.match(text, /automatic dawn charge/); assert.match(text, /restore.*home/i);
  assert.match(text, /say.*offer/); assert.match(text, /give.*pay/); assert.match(text, /answer.*accept.*decline/i);
  assert.ok(text.length <= 18000); assert.ok(replyFormat('seat').length < 8000);
});

test('two-unit cap refusal carries total quote and spendable/reserved receipts', () => {
  const g = new Game({ n: 3 }); g.grant('a01', 100); const ctx = caller(g);
  const bad = reply({ act: 'shop', item: 'chems', units: 2, max: 50 }, ctx).results[0];
  assert.equal(bad.ok, false); assert.equal(bad.quote.total, 54); assert.equal(bad.quote.quantity, 2);
  const good = reply({ act: 'shop', item: 'chems', units: 2, max: 54 }, ctx).results[0];
  assert.equal(good.status, 'placed'); assert.equal(good.state.cash.spendable, 46); assert.equal(good.state.cash.reserved, 54);
  const text = briefing(read(g.view('a01'), { audience: 'seat', seed: 'x' }), { last: [bad, good] }).map(m => m.content).join('\n');
  assert.match(text, /current total quote \$54 for 2/); assert.match(text, /order placed, not settled/); assert.match(text, /chems x1 \$25, x2 \$54/);
});

test('buyer typed offer triggers bot handover while typed answer never becomes payment or delivery', async () => {
  const { makeBot } = await import('../bench/bots.mjs');
  const cfg = (id, type) => ({ id, name: 'protocol fixture', type, trade: type, layer: 2, every: true, fav: 'forest' });
  const day = (bot, g, id, round = 2) => bot.day(g.view(id), { seed: 404, day: g.s.day, round, rounds: 3, rng: () => 0.5 });
  for (const say of ['answer', 'offer']) {
    const g = new Game({ n: 3 }); g.s.agents.a01.trade = 'chemist'; g.s.agents.a02.trade = 'dealer'; stock(g, 'temp', 6); g.grant('a02', 120);
    g.errand('a01', 'ask', { to: 'a02' }); const sd = Object.keys(g.s.sitdowns)[0]; g.errand('a02', 'answer', { sitdown: sd, accept: true });
    g.errand('a02', 'say', { sitdown: sd, say, terms: { what: 'trade', goods: { temp: 4 }, cash: 60 } });
    const out = day(makeBot(cfg('a01', 'chemist'), {}), g, 'a01'); const give = out.filter(e => e.kind === 'give');
    assert.equal(give.length, say === 'offer' ? 1 : 0);
    if (give.length) { g.errand('a01', 'give', give[0]); assert.equal(g.s.agents.a02.goods.temp, 4); }
    assert.equal(g.s.agents.a02.cash, 120, 'speech and delivery never imply payment');
  }
  const g = new Game({ n: 3 }); g.s.agents.a01.trade = 'chemist'; g.s.agents.a02.trade = 'dealer'; stock(g, 'temp', 6); g.grant('a02', 120);
  g.errand('a01', 'ask', { to: 'a02' }); const sd = Object.keys(g.s.sitdowns)[0];
  const buyer = makeBot(cfg('a02', 'dealer'), {}); const order = day(buyer, g, 'a02', 1);
  for (const e of order.filter(e => ['answer', 'say'].includes(e.kind))) g.errand('a02', e.kind, e);
  assert.ok(g.s.sitdowns[sd].said.some(m => m.from === 'a02' && m.say === 'offer'));
  const ctx = caller(g); reply({ act: 'say', sitdown: sd, say: 'answer', terms: { what: 'trade', goods: { temp: 4 }, cash: 60 }, line: 'Please pay before I hand over.' }, ctx);
  assert.equal(day(buyer, g, 'a02').filter(e => e.kind === 'pay').length, 0, 'bot does not prepay a relabeled answer');
  const request = g.s.sitdowns[sd].said.find(m => m.from === 'a02' && m.say === 'offer');
  assert.equal(reply({ act: 'give', to: 'a02', goods: request.terms.goods }, caller(g)).results[0].ok, true);
  const payments = day(buyer, g, 'a02', 3).filter(e => e.kind === 'pay'); assert.equal(payments.length, 1);
  g.errand('a02', 'pay', payments[0]); assert.equal(g.s.agents.a01.cash, payments[0].amount); assert.equal(g.s.agents.a02.cash, 120 - payments[0].amount);
});

test('invitation receipts preserve sent words and repeat acceptance refuses instead of sending another message', () => {
  const g = new Game({ n: 3 }); g.errand('a02', 'ask', { to: 'a01' }); const sitdown = Object.keys(g.s.sitdowns)[0]; const ctx = caller(g);
  const accepted = reply({ act: 'answer', sitdown, accept: true, line: 'ACCEPTED-SPEECH' }, ctx).results[0];
  assert.deepEqual(accepted.receipt, { kind: 'answer', sitdown, state: 'open', speechSent: true });
  assert.ok(JSON.stringify(g.view('a02')).includes('ACCEPTED-SPEECH'));
  assert.equal(g.events('say').length, 1);
  const repeated = reply({ act: 'answer', sitdown, accept: true, line: 'MUST-NOT-SEND' }, ctx).results[0];
  assert.equal(repeated.ok, false); assert.match(repeated.why, /already open; use say/); assert.equal(g.events('say').length, 1);
  const text = briefing(read(g.view('a01'), { audience: 'seat', seed: 'x' }), { last: [accepted] }).map(m => m.content).join('\n');
  assert.match(text, /attached words sent/);
});

test('errand fields never silently turn proposed payment or commercial terms into another action', () => {
  const g = new Game({ n: 3 }); g.grant('a01', 100); g.s.agents.a01.evicted = true; const ctx = caller(g);
  const out = reply({ act: 'rent', amount: 20 }, ctx); assert.equal(out.results[0].ok, false); assert.equal(out.results[0].source, 'tools');
  assert.equal(g.s.agents.a01.cash, 100); assert.equal(g.s.agents.a01.evicted, true);
});

test('housed rent refuses, dawn charges automatically, and restore neither prepays nor clears dock debt', () => {
  const g = new Game({ n: 3 }); g.grant('a01', 100);
  assert.equal(reply({ act: 'rent' }, caller(g)).results[0].ok, false); assert.equal(g.s.agents.a01.cash, 100);
  g.night({ a01: { kind: 'laylow', place: 'suburbs' } }); assert.equal(g.s.agents.a01.cash, 80);
  g.s.agents.a01.evicted = true; g.s.agents.a01.tab = 40;
  const restored = reply({ act: 'rent' }, caller(g)).results[0]; assert.equal(restored.ok, true);
  assert.equal(restored.state.cash.spendable, 60); assert.equal(restored.state.rent.tab, 40);
  g.night({ a01: { kind: 'laylow', place: 'suburbs' } }); assert.equal(g.s.agents.a01.cash, 40); assert.equal(g.s.agents.a01.tab, 40);
});

test('final-day fence listing remains visible but is absent from executable purchase suggestions', () => {
  const g = new Game({ n: 3 }); g.grant('a01', 1000); g.advanceTo(13);
  const copy = g.hand('a02', tierCopy(g.s, 'common')); g.errand('a02', 'fence_list', { copy, price: 1 }); g.night();
  const seen = read(g.view('a01'), { audience: 'seat', seed: 'fixture' }); assert.equal(seen.result.view.board.fence.length, 1);
  const text = briefing(seen).map(m => m.content).join('\n'); const menu = text.slice(text.lastIndexOf("Tonight's menu"));
  assert.ok(!menu.includes('fence_buy')); assert.equal(seen.result.view.me.actions.fence.open, false);
  const result = reply({ act: 'fence_buy', deal: seen.result.view.board.fence[0].deal }, caller(g)).results[0];
  assert.equal(result.ok, false); assert.equal(result.source, 'core');
});
