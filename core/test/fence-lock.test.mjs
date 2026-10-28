// The fence's custody (GAME.md §9, §7, §10, §15, §23; layer 2; GAP gap.fence, gap.listed): a listed piece stays with
// its seller until it sells, and every deal lands at the lock, before the night's plays, so nothing the fence moves is
// out of reach of that night's fights. Amounts come from N, never typed in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, tierCopy, abilityCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { ledgerProblems, checkLedger } from '../rules/ledger.mjs';
import { moveCopy } from '../rules/state.mjs';
import { N } from '../numbers.mjs';

const LISTED = 'that piece is listed at the fence';
const fee = cash => Math.floor((cash * N.fence) / 100);
const dealOf = r => r.events.find(e => e.type === 'fence').deal;
const fenceAct = (r, act) => r.newEvents.filter(e => e.type === 'fence' && e.act === act);
// A robber in brass knuckles: 2 attacking, against an empty home's lock of 1 (§8).
const knuckles = (g, id) => g.hand(id, abilityCopy(g.s, 'knuckles'), { wear: true });
const took = (r, leader) => r.newEvents.find(e => e.type === 'burgle' && e.leader === leader);
// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  g.s.agents[id].goods[kind] = (g.s.agents[id].goods[kind] || 0) + n;
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
// A season whose agents have the trades named, in id order (the helpers' cast is all Smugglers).
function withTrades(trades) {
  const g = new Game({ n: 1 });
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents: trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' })) });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}

test('a piece bought at the fence lands at the lock, and a break-in on the buyer\'s home that same night takes it (§9, §7)', () => {
  const g = new Game({ n: 3 });
  const copy = g.hand('a01', tierCopy(g.s, 'rare'));
  const price = 300;
  const deal = dealOf(g.errand('a01', 'fence_list', { copy, price }));
  g.grant('a02', 400);
  assert.equal(g.errand('a02', 'fence_buy', { deal }).ok, true);
  assert.deepEqual(g.s.copies[copy].holder, { k: 'agent', id: 'a01' }, 'bought, it stays with its seller until the lock');
  assert.equal(g.errand('a01', 'give', { to: 'a03', copy }).why, LISTED, 'and its seller can\'t move it');
  assert.equal(g.errand('a01', 'fence_unlist', { deal }).why, 'already bought');
  knuckles(g, 'a03');
  const r = g.night({ a02: { kind: 'hustle', place: 'docks' }, a03: { kind: 'breakin', target: 'a02' } });
  const lock = g.s.clock - 1;
  assert.deepEqual(fenceAct(r, 'bought').map(e => [e.agent, e.copy, e.t]), [['a02', copy, lock]]);
  assert.equal(took(r, 'a03').copy, copy, 'the break-in found it in the buyer\'s home');
  assert.deepEqual(g.s.copies[copy].holder, { k: 'agent', id: 'a03' });
  assert.deepEqual(g.s.copies[copy].hist.slice(-2).map(h => [h.what, h.to, h.t]), [['fence', 'agent:a02', lock], ['burgle', 'agent:a03', lock]], 'it landed at the lock, then the burglar took it');
  assert.deepEqual([fenceAct(r, 'sold')[0].cash, g.s.money.out.fence], [price - fee(price), fee(price)], 'the seller paid at the lock, less the cut');
  assert.deepEqual(g.s.offers, []);
  assert.deepEqual(g.s.fence.deals, {}, 'a settled deal is done');
});

test('an accepted swap lands at the lock, and that night\'s thefts can take both swapped pieces (§9, §7)', () => {
  const g = new Game({ n: 4 });
  const p = g.hand('a01', tierCopy(g.s, 'rare'));
  const q = g.hand('a02', tierCopy(g.s, 'rare'));
  const deal = dealOf(g.errand('a01', 'fence_swap', { to: 'a02', give: { pieces: [p] }, get: { pieces: [q] } }));
  assert.equal(g.errand('a02', 'fence_accept', { deal }).ok, true);
  assert.deepEqual([g.s.copies[p].holder, g.s.copies[q].holder], [{ k: 'fence' }, { k: 'fence' }], 'by day the fence holds both halves, and there are no thefts by day');
  knuckles(g, 'a03');
  knuckles(g, 'a04');
  const r = g.night({ a03: { kind: 'breakin', target: 'a02' }, a04: { kind: 'breakin', target: 'a01' } });
  const lock = g.s.clock - 1;
  assert.equal(fenceAct(r, 'swapped')[0].t, lock);
  assert.deepEqual([took(r, 'a03').copy, took(r, 'a04').copy], [p, q], 'each half was in its new holder\'s home');
  assert.deepEqual([g.s.copies[p].holder, g.s.copies[q].holder], [{ k: 'agent', id: 'a03' }, { k: 'agent', id: 'a04' }]);
  assert.deepEqual(g.s.copies[p].hist.slice(-2).map(h => [h.what, h.to, h.t]), [['fence', 'agent:a02', lock], ['burgle', 'agent:a03', lock]]);
  assert.equal(g.s.money.out.fence || 0, 0, 'piece for piece, still free');
});

test('a swap nobody accepted goes back at the lock, in reach of that night\'s fights (§9, §7)', () => {
  const g = new Game({ n: 3 });
  const p = g.hand('a01', tierCopy(g.s, 'rare'));
  const deal = dealOf(g.errand('a01', 'fence_swap', { to: 'a02', give: { pieces: [p] }, get: { cash: 10 } }));
  knuckles(g, 'a03');
  const r = g.night({ a03: { kind: 'breakin', target: 'a01' } });
  assert.deepEqual(fenceAct(r, 'expired').map(e => e.deal), [deal]);
  assert.equal(took(r, 'a03').copy, p, 'the fence is no safe for the night');
  assert.deepEqual(g.s.copies[p].holder, { k: 'agent', id: 'a03' });
});

test('the cash a deal lands is in reach too: a break-in the night a listing sells takes all the seller\'s cash, the sale included (§9, §7)', () => {
  const g = new Game({ n: 3 });
  const copy = g.hand('a01', tierCopy(g.s, 'rare'));
  const price = 301;
  const deal = dealOf(g.errand('a01', 'fence_list', { copy, price }));
  g.grant('a02', 400);
  g.errand('a02', 'fence_buy', { deal });
  knuckles(g, 'a03');
  assert.equal(g.s.agents.a01.cash, 0);
  const r = g.night({ a01: { kind: 'hustle', place: 'docks' }, a03: { kind: 'breakin', target: 'a01' } });
  assert.equal(took(r, 'a03').cash, Math.floor((price - fee(price)) * N.breakinShare), "the break-in's share of the cash there (breakinShare), the sale's cash included");
});

test('goods a swap hands over at the lock can be worked that night: the fence lands before the plays are checked (§9, §5)', () => {
  const g = withTrades(['smuggler', 'chemist', 'smuggler']);
  stock(g, 'a01', 'chems', N.cook.chems);
  g.grant('a02', 30);
  const deal = dealOf(g.errand('a01', 'fence_swap', { to: 'a02', give: { goods: { chems: N.cook.chems } }, get: { cash: 30 } }));
  assert.equal(g.errand('a02', 'fence_accept', { deal }).ok, true);
  assert.equal(g.s.agents.a02.goods.chems, N.kits.chemist.chems, 'its kit; the rest is at the fence');
  const batches = (N.kits.chemist.chems + N.cook.chems) / N.cook.chems;
  const r = g.night({ a02: { kind: 'cook', place: 'suburbs', batches } });
  assert.deepEqual(r.newEvents.filter(e => e.type === 'invalid' && e.agent === 'a02'), []);
  assert.equal(r.newEvents.find(e => e.type === 'cook' && e.agent === 'a02').batches, batches);
});

test('a listed piece stays with its seller: a break-in on the seller\'s home takes it, the listing leaves the board, and the seller is told (§9, §7, §19)', () => {
  const g = new Game({ n: 3 });
  const copy = g.hand('a01', tierCopy(g.s, 'rare'), { wear: true });
  const hist = g.s.copies[copy].hist.length;
  const deal = dealOf(g.errand('a01', 'fence_list', { copy, price: 300 }));
  assert.deepEqual(g.s.copies[copy].holder, { k: 'agent', id: 'a01' }, 'its seller keeps it');
  assert.equal(g.s.copies[copy].hist.length, hist, 'listing moved nothing');
  assert.ok(!Object.values(g.s.agents.a01.outfit).includes(copy), 'listing takes it off');
  assert.deepEqual(g.view(null, 'public').board.fence.map(l => l.deal), [deal]);
  knuckles(g, 'a02');
  const r = g.night({ a01: { kind: 'hustle', place: 'docks' }, a02: { kind: 'breakin', target: 'a01' } });
  assert.equal(took(r, 'a02').copy, copy, 'the listed piece was in the seller\'s home');
  assert.deepEqual(g.s.copies[copy].holder, { k: 'agent', id: 'a02' });
  assert.deepEqual(fenceAct(r, 'lost').map(e => [e.deal, e.agent, e.copy, e.trait]), [[deal, 'a01', copy, g.s.copies[copy].trait]], 'the listing ended');
  assert.deepEqual(g.s.fence.deals, {});
  assert.deepEqual(g.view(null, 'public').board.fence, [], 'and left the board');
  assert.deepEqual(g.view('a01').me.fence, []);
  assert.equal(g.view('a01').events.filter(e => e.type === 'fence' && e.act === 'lost').length, 1, 'the seller sees it now');
  assert.equal(g.view('a02').events.filter(e => e.type === 'fence' && e.act === 'lost').length, 0, '...and everyone else 24 hours later');
  g.grant('a03', 400);
  assert.equal(g.errand('a03', 'fence_buy', { deal }).why, 'no such listing');
});

test('an arrest that seizes an evicted seller\'s listed piece ends the listing (§13, §10)', () => {
  const g = new Game({ n: 3 });
  g.night({ a01: { kind: 'laylow' } });
  assert.equal(g.s.agents.a01.evicted, true, 'no wage, no rent: evicted');
  const copy = g.hand('a01', tierCopy(g.s, 'rare'));
  const deal = dealOf(g.errand('a01', 'fence_list', { copy, price: 300 }));
  const r = g.night({ a01: { kind: 'hit', target: 'a02', place: 'downtown' }, a02: { kind: 'hustle', place: 'downtown' } });
  const arrest = r.newEvents.find(e => e.type === 'arrest' && e.agent === 'a01');
  assert.ok(arrest, '1 against 1 and Glasswall\'s cops: it loses and is arrested');
  assert.equal(r.newEvents.find(e => e.type === 'seized' && e.agent === 'a01').copy, copy, 'evicted, everything it owns is on it (§10), the listed piece too');
  assert.deepEqual(g.s.copies[copy].holder, { k: 'vault' });
  assert.deepEqual(fenceAct(r, 'lost').map(e => [e.deal, e.agent]), [[deal, 'a01']]);
  assert.deepEqual(g.view(null, 'public').board.fence, []);
});

test('errands that would wear or move a listed piece are refused, typed and not yet; unlisting ends the listing (§10, §33)', () => {
  const g = new Game({ n: 3 });
  const copy = g.hand('a01', tierCopy(g.s, 'common'), { wear: true });
  const slot = g.s.copies[copy].slot;
  g.grant('a01', 100);
  g.grant('a02', 100);
  const deal = dealOf(g.errand('a01', 'fence_list', { copy, price: 50 }));
  assert.equal(g.errand('a01', 'crew_form', { name: 'x' }).ok, true);
  const ask = g.errand('a02', 'fence_swap', { to: 'a01', give: { cash: 10 }, get: { pieces: [copy] } });
  assert.equal(ask.ok, true, 'an offer can ask for it: it can\'t learn that it\'s listed');
  const tries = [
    ['dress', { fit: { [slot]: copy } }],
    ['give', { to: 'a02', copy }],
    ['stash_put', { copy }],
    ['fence_list', { copy, price: 60 }],
    ['fence_swap', { to: 'a02', give: { pieces: [copy] }, get: { cash: 5 } }],
    ['fence_accept', { deal: dealOf(ask) }],
  ];
  for (const [kind, fields] of tries) {
    const r = g.errand('a01', kind, fields);
    assert.equal(r.ok, false, kind);
    const e = r.events[0];
    assert.deepEqual([e.type, e.agent, e.errand, e.why, e.kind], ['invalid', 'a01', kind, LISTED, 'not-yet'], kind);
  }
  assert.deepEqual(g.s.copies[copy].holder, { k: 'agent', id: 'a01' }, 'it never moved');
  assert.deepEqual(g.s.agents.a01.outfit, {}, 'nor went back on');
  assert.equal(g.errand('a01', 'fence_unlist', { deal }).ok, true);
  assert.deepEqual([g.s.fence.deals[deal], g.view(null, 'public').board.fence], [undefined, []], 'unlisting ends the listing');
  assert.equal(g.errand('a01', 'dress', { fit: { [slot]: copy } }).ok, true, 'it can wear it again');
  assert.equal(g.errand('a01', 'fence_accept', { deal: dealOf(ask) }).ok, true, 'or answer the swap with it');
});

test('night 14: a listing ends at the lock without its piece moving, and the piece boards with its seller; its stash record showed it (§15, §19)', () => {
  const g = new Game({ n: 3 });
  g.advanceTo(13);
  const copy = g.hand('a01', tierCopy(g.s, 'rare'));
  const deal = dealOf(g.errand('a01', 'fence_list', { copy, price: 900 }));
  g.night();
  const record = g.events('holdings', e => e.agent === 'a01').at(-1);
  assert.deepEqual(record.pieces.map(p => p.copy), [copy], 'a listed piece is in its seller\'s stash');
  const hist = g.s.copies[copy].hist.length;
  const r = g.night();
  assert.deepEqual(fenceAct(r, 'returned').map(e => [e.deal, e.agent, e.pieces]), [[deal, 'a01', [copy]]]);
  assert.deepEqual(g.s.copies[copy].hist.slice(hist).map(h => h.what), ['minted'], 'nothing moved it but the mint');
  assert.deepEqual(g.s.copies[copy].holder, { k: 'minted', id: 'a01' });
});

test('the ledger checks the custody: a listing\'s piece is with its seller, off its outfit and in one listing; the fence holds pieces only for open swaps; held cash matches a live deal (§23)', () => {
  const g = new Game({ n: 3 });
  const copy = g.hand('a01', tierCopy(g.s, 'common'));
  const other = g.hand('a02', tierCopy(g.s, 'common'));
  g.grant('a03', 100);
  const deal = dealOf(g.errand('a01', 'fence_list', { copy, price: 40 }));
  g.errand('a03', 'fence_buy', { deal });
  assert.deepEqual(g.s.copies[copy].holder, { k: 'agent', id: 'a01' });
  assert.deepEqual(ledgerProblems(g.s), [], 'positive control');
  const plant = fn => {
    const s = structuredClone(g.s);
    fn(s);
    return ledgerProblems(s).filter(p => /^fence/.test(p));
  };
  assert.equal(plant(s => moveCopy(s, copy, { k: 'agent', id: 'a02' }, 'test')).length, 1, 'a listed piece its seller doesn\'t hold');
  assert.equal(plant(s => moveCopy(s, copy, { k: 'fence' }, 'test')).length, 2, 'a listed piece at the fence: not its seller\'s, and no open swap put it up');
  assert.equal(plant(s => { s.agents.a01.outfit[s.copies[copy].slot] = copy; }).length, 1, 'a listed piece worn');
  assert.equal(plant(s => { s.fence.deals.f9 = { ...s.fence.deals[deal], id: 'f9', buyer: null }; }).length, 1, 'one piece in two listings');
  assert.equal(plant(s => moveCopy(s, other, { k: 'fence' }, 'test')).length, 1, 'a piece at the fence with no open swap');
  assert.equal(plant(s => {
    s.offers = s.offers.filter(o => o.fence !== deal);
    s.money.out.test = (s.money.out.test || 0) + 40;
  }).length, 1, 'a bought listing whose cash isn\'t held');
});
