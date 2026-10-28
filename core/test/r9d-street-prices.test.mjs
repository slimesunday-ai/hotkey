// R9d, part B item 1 (slime, 10-20: "Yes, show it"): street prices, what agents paid each other for goods over the last
// 3 days, by kind, with no party named: a public board field (board.street, built when first read) from the settled
// record's one owner (rules/deals.mjs streetPrices), and its lines on the seat's screen. Pinned here:
// - settled: an agreed goods deal off the live record with goods and cash both handed over, in full ('settled') or a
//   part delivery paid pro rata with its sit-down over ('in step'); never a piece deal, a lapsed one or a live one;
// - the last 3 days: the 3 days before today, by the deal's last hand-over, today not one of them, and a deal that
//   ended today waits for tomorrow;
// - the unit price: cash paid over units handed over, to the nearest dollar, a half rounding down.
// Nothing here calls a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, tierCopy } from './helpers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { viewFor, stripFreeText } from '../rules/view.mjs';
import { read } from '../agents/tools.mjs';
import { briefing, goodsLines } from '../agents/briefing.mjs';
import { N } from '../numbers.mjs';

// r8b-lean.test.mjs's ADVICE pattern (§33).
const ADVICE = /\b(should|best|recommend\w*|strateg\w*|aggressive\w*|safest|smart\w*|wise\w*|mission\w*)\b/i;
const HEAD = "Street prices (agents' settled trades, last 3 days): ";
const ID = /\ba\d\d\b/;

function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
function ok(g, id, kind, fields) {
  const r = g.errand(id, kind, fields);
  assert.equal(r.ok, true, `${id}'s ${kind} went through (${r.why})`);
  return r;
}
// `buyer` orders `goods` (or a piece) for `cash` from `seller` in a new sit-down; then the seller hands over `give`
// (default all of it) and the buyer pays `pay` (default all of it); `close` closes the sit-down after. The sit-down.
function trade(g, seller, buyer, { goods = null, piece = null, cash, give = goods || {}, pay = cash, close = false }) {
  if (goods) for (const [k, n] of Object.entries(goods)) stock(g, seller, k, n);
  if (g.s.agents[buyer].cash < pay) g.grant(buyer, pay);
  ok(g, buyer, 'ask', { to: seller });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, seller, 'answer', { sitdown: sd, accept: true });
  ok(g, buyer, 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', ...(goods ? { goods } : { piece }), cash } });
  if (piece) ok(g, seller, 'give', { to: buyer, copy: piece });
  else if (Object.keys(give).length) ok(g, seller, 'give', { to: buyer, goods: give });
  if (pay) ok(g, buyer, 'pay', { to: seller, amount: pay });
  if (close) ok(g, buyer, 'close', { sitdown: sd });
  return sd;
}
const street = (g, id = 'a09', audience = 'agent') => viewFor(g.s, g.log, id, audience).board.street;
const screen = (g, id = 'a09') => briefing(read(viewFor(g.s, g.log, id, 'agent'), { audience: 'seat', seed: 'r9d-street' }), { call: 'round' })[1].content;
const lineOf = (g, id) => screen(g, id).split('\n').find(l => l.startsWith(HEAD));

test('street prices: settled deals by kind, a range across deals, the price rounded, shown from the day after and never on the day', () => {
  const g = new Game({ n: 10 });
  // Day 1: two chems deals ($15 and $50/3 = $16.67, so $17), a gun, and TEMP at $31/2 = $15.50 (a half rounds down: $15).
  trade(g, 'a01', 'a02', { goods: { chems: 2 }, cash: 30 });
  trade(g, 'a03', 'a04', { goods: { chems: 3 }, cash: 50 });
  trade(g, 'a05', 'a06', { goods: { guns: 1 }, cash: 150 });
  trade(g, 'a07', 'a08', { goods: { temp: 2 }, cash: 31 });
  assert.equal(g.s.dealsDone.filter(d => d.how === 'settled').length, 4, 'control: four settled on day 1');
  assert.deepEqual(street(g), { from: 1, to: 0, kinds: [] }, 'not on the day itself');
  assert.equal(lineOf(g), `${HEAD}none.`, 'said plainly when there were none');
  g.night();
  assert.deepEqual(street(g), { from: 1, to: 1, kinds: [
    { kind: 'chems', units: 5, deals: 2, low: 15, high: 17 },
    { kind: 'temp', units: 2, deals: 1, low: 15, high: 15 },
    { kind: 'guns', units: 1, deals: 1, low: 150, high: 150 },
  ] });
  const line = lineOf(g);
  assert.equal(line, `${HEAD}5 chems at $15–$17 a chem (2 deals); 2 temp at $15 a dose (1 deal); 1 gun at $150 a gun (1 deal).`);
  assert.doesNotMatch(line, ADVICE);
  assert.doesNotMatch(line, ID, 'no party named');
});

test('street prices: a part delivery paid pro rata counts what was handed over and paid; a piece deal, a mixed one, a lapsed one and a live one never count', () => {
  const g = new Game({ n: 12 });
  // 5 TEMP for $75; 3 handed over and $45 paid, then the sit-down closes: in step, 3 at $15.
  trade(g, 'a01', 'a02', { goods: { temp: 5 }, cash: 75, give: { temp: 3 }, pay: 45, close: true });
  assert.equal(g.s.dealsDone.at(-1).how, 'in step', 'control: in step');
  // A piece for $300, settled.
  const piece = g.hand('a03', tierCopy(g.s, 'rare'));
  trade(g, 'a03', 'a04', { piece, cash: 300 });
  assert.equal(g.s.dealsDone.at(-1).how, 'settled', 'control: the piece deal settled');
  // Two kinds for one price: no price for each.
  trade(g, 'a05', 'a06', { goods: { chems: 1, parts: 1 }, cash: 40 });
  assert.equal(g.s.dealsDone.at(-1).how, 'settled', 'control: the mixed deal settled');
  // Agreed, nothing handed over, its sit-down closed: lapsed.
  const sd = trade(g, 'a07', 'a08', { goods: { parts: 2 }, cash: 30, give: {}, pay: 0 });
  ok(g, 'a07', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { parts: 2 }, cash: 30 } });
  ok(g, 'a08', 'close', { sitdown: sd });
  assert.equal(g.s.dealsDone.at(-1).how, 'lapsed', 'control: lapsed');
  // Goods handed over, the cash not yet paid: still live.
  trade(g, 'a09', 'a10', { goods: { parts: 4 }, cash: 60, pay: 0 });
  assert.equal(g.s.deals.filter(d => d.seller === 'a09').length, 1, 'control: live');
  g.night();
  assert.deepEqual(street(g, 'a11').kinds, [{ kind: 'temp', units: 3, deals: 1, low: 15, high: 15 }]);
});

test('street prices: the window is the 3 days before today by the day a deal ended, and a deal that ended today waits for tomorrow', () => {
  const g = new Game({ n: 9 });
  trade(g, 'a01', 'a02', { goods: { parts: 2 }, cash: 30 });
  const seen = [];
  for (let day = 2; day <= 5; day++) {
    g.night();
    seen.push([g.s.day, street(g).kinds.map(k => k.units), street(g).from, street(g).to]);
  }
  assert.deepEqual(seen, [[2, [2], 1, 1], [3, [2], 1, 2], [4, [2], 1, 3], [5, [], 2, 4]], 'days 2, 3 and 4 show day 1; day 5 does not');
  // Handed over on day 5, the sit-down closed on day 6: in the window from day 7 (ended day 6), as of day 5's hand-over.
  const sd = trade(g, 'a03', 'a04', { goods: { chems: 4 }, cash: 60, give: { chems: 2 }, pay: 30 });
  g.night();
  ok(g, 'a04', 'close', { sitdown: sd });
  assert.deepEqual([g.s.dealsDone.at(-1).how, g.s.dealsDone.at(-1).lastDay, g.s.dealsDone.at(-1).endedDay], ['in step', 5, 6], 'control');
  assert.deepEqual(street(g).kinds, [], 'ended today: not yet, so the line stays the same all day');
  g.night();
  assert.deepEqual(street(g).kinds, [{ kind: 'chems', units: 2, deals: 1, low: 15, high: 15 }]);
});

test('street prices: no party named, the same public field for every seat and audience, typed, and built only when read', () => {
  const g = new Game({ n: 4 });
  trade(g, 'a01', 'a02', { goods: { chems: 2 }, cash: 30 });
  g.night();
  const field = street(g, 'a01');
  assert.doesNotMatch(JSON.stringify(field), ID, 'no agent id anywhere in it');
  for (const [id, audience] of [['a02', 'agent'], ['a03', 'agent'], ['a03', 'ownerAI'], [null, 'public'], [null, 'record']]) {
    assert.deepEqual(street(g, id, audience), field, `${id || 'nobody'} as ${audience}`);
  }
  assert.deepEqual(stripFreeText(field), field, 'no free text');
  for (const k of field.kinds) assert.deepEqual(Object.keys(k).sort(), ['deals', 'high', 'kind', 'low', 'units']);
  const v = viewFor(g.s, g.log, 'a03', 'agent');
  assert.equal(typeof Object.getOwnPropertyDescriptor(v.board, 'street').get, 'function', 'not built until read');
  assert.deepEqual(v.board.street, field);
  assert.equal(Object.getOwnPropertyDescriptor(v.board, 'street').get, undefined, 'a plain field once read');
});

test('street prices: nothing the window counts is hidden from a third seat; every hand-over it counts is on that seat\'s own record', () => {
  const g = new Game({ n: 4 });
  trade(g, 'a01', 'a02', { goods: { chems: 3 }, cash: 45 });
  g.night();
  const v = viewFor(g.s, g.log, 'a04', 'agent');
  const gives = v.events.filter(e => e.type === 'give' && e.goods?.chems);
  const pays = v.events.filter(e => e.type === 'pay' && e.from === 'a02' && e.to === 'a01');
  assert.equal(gives.reduce((t, e) => t + e.goods.chems, 0), v.board.street.kinds[0].units, "the units: a04's view holds the give");
  assert.equal(pays.reduce((t, e) => t + e.amount, 0) / v.board.street.kinds[0].units, v.board.street.kinds[0].low, 'the price: and the pay');
  // On the day itself, a04 sees neither, and the field holds nothing.
  const h = new Game({ n: 4 });
  trade(h, 'a01', 'a02', { goods: { chems: 3 }, cash: 45 });
  const today = viewFor(h.s, h.log, 'a04', 'agent');
  assert.deepEqual([today.events.filter(e => ['give', 'pay'].includes(e.type)).length, today.board.street.kinds.length], [0, 0]);
});

test('the goods line puts the street price of each kind held beside the city buyer\'s price, and beside the shop\'s for a gun; none said plainly', () => {
  const g = new Game({ n: 10 });
  trade(g, 'a01', 'a02', { goods: { chems: 2 }, cash: 30 });
  trade(g, 'a03', 'a04', { goods: { guns: 1 }, cash: 150 });
  trade(g, 'a05', 'a06', { goods: { temp: 2 }, cash: 40 });
  g.night();
  stock(g, 'a09', 'chems', 1);
  stock(g, 'a09', 'parts', 1);
  stock(g, 'a09', 'guns', 1);
  stock(g, 'a09', 'temp', 1);
  stock(g, 'a09', 'lockpicks', 1);
  const v = read(viewFor(g.s, g.log, 'a09', 'agent'), { audience: 'seat', seed: 'r9d-street' }).result.view;
  const b = v.board.market;
  const [line] = goodsLines(v);
  for (const bit of [
    `1 chems (the city's buyer pays $${b.buyer.chems} a chem now, cash at the lock; agents' settled trades, last 3 days: $15 a chem (1 deal); used by`,
    `1 parts (the city's buyer pays $${b.buyer.parts} a part now, cash at the lock; agents' settled trades, last 3 days: none; used by`,
    `1 gun (the city's shop sells a gun for $${b.shop.guns} now; agents' settled trades, last 3 days: $150 a gun (1 deal))`,
    `1 temp (the city's buyer pays $${b.buyer.doses} a dose now, cash at the lock; agents' settled trades, last 3 days: $20 a dose (1 deal); used by`,
    "1 lockpick (agents' settled trades, last 3 days: none)",
  ]) assert.ok(line.includes(bit), `${bit}\n in: ${line}`);
  assert.doesNotMatch(line, ADVICE);
});

test("street prices: a part delivery left to expire counts from the day its sit-down ended, days after its last hand-over", () => {
  const g = new Game({ n: 4 });
  trade(g, 'a01', 'a02', { goods: { temp: 6 }, cash: 90, give: { temp: 2 }, pay: 30 });
  const shown = [];
  for (let i = 0; i < 9; i++) {
    g.night();
    shown.push(street(g, 'a03').kinds.map(k => `${k.units}@${k.low}`).join() || '-');
  }
  const d = g.s.dealsDone.find(x => x.seller === 'a01');
  assert.ok(d && d.how === 'in step' && d.lastDay === 1 && d.endedDay > d.lastDay + 1, `control: ended in step on day ${d && d.endedDay}, handed over day 1`);
  const want = Array.from({ length: 9 }, (_, i) => (i + 2 > d.endedDay && i + 2 <= d.endedDay + 3 ? '2@15' : '-'));
  assert.deepEqual(shown, want, 'days 2 to 10: the 3 days after it ended');
});

test('street prices: the deal count on the line, so one deal reads as one', () => {
  const g = new Game({ n: 8 });
  trade(g, 'a01', 'a02', { goods: { parts: 1 }, cash: 90 });
  trade(g, 'a03', 'a04', { goods: { chems: 2 }, cash: 30 });
  trade(g, 'a05', 'a06', { goods: { chems: 4 }, cash: 60 });
  g.night();
  assert.equal(lineOf(g, 'a07'), `${HEAD}6 chems at $15 a chem (2 deals); 1 parts at $90 a part (1 deal).`);
  assert.deepEqual(street(g, 'a07').kinds.map(k => [k.kind, k.deals]), [['chems', 2], ['parts', 1]]);
});
