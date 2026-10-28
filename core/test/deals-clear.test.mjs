// R5-deals, CLEAR and a deal (GAME.md §11; GAP gap.clear; rules/deals.mjs): CLEAR keeps a deal, as it keeps a promise.
// Its taker's view still holds the deal, and only what the deal itself holds (its terms and its counts), never the give
// and pay events CLEAR wiped, and its briefing reads the same. The note says so. Amounts come from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { N, ROWS } from '../numbers.mjs';

const tools = () => import('../agents/tools.mjs');
const briefingOf = () => import('../agents/briefing.mjs');
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

test('CLEAR keeps a deal as it keeps a promise: the taker still sees its terms and counts, never the give it forgot; the note says so (§11, §14; gap.clear)', async () => {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'chems', 2);
  stock(g, 'a02', 'clear', 1);
  ok(g, 'a01', 'ask', { to: 'a02' });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { chems: 2 }, cash: 2 * N.rent } });
  ok(g, 'a01', 'give', { to: 'a02', goods: { chems: 1 } });
  const before = g.view('a02').me.deals;
  ok(g, 'a02', 'take', { drug: 'clear' });
  const v = g.view('a02');
  assert.equal(v.events.filter(e => e.type === 'give').length, 0, 'control: CLEAR wiped the give from its view');
  assert.deepEqual(v.me.deals, before, 'the deal is as it was: terms and counts');
  const keys = Object.keys(v.me.deals[0]).sort();
  assert.ok(!keys.some(k => /event|^n$|^t$/.test(k)), `the deal carries no event: ${keys}`);
  const { read } = await tools();
  const { briefing } = await briefingOf();
  const user = briefing(read(v, { audience: 'seat', seed: 'R5-clear' }).result)[1].content;
  assert.match(user, new RegExp(`^- ${sd}: a01 sells you 2 chems for \\$${2 * N.rent} \\(agreed day 1\\): a01 gave 1 of 2 \\(\\$${N.rent} due\\), you paid \\$0\\.$`, 'm'), 'its line reads from the deal');
  assert.ok(!/a01 gave you 1 chems/.test(user), 'and the forgotten give itself is nowhere');
  const note = ROWS.find(r => r.key === 'gap.clear').note;
  assert.match(note, /deals/, `the note says CLEAR keeps deals: ${note.slice(-200)}`);
});
