// R5-deals, the tools: goods written as {"doses": n}, the form model seats used for a dose, read as the dose the rules
// mean when none is named, TEMP (§11: a cook that names no drug and a sale of doses to the city's buyer are TEMP), in a
// sit-down's terms and in a hand-over alike. A form that maps to no goods is refused, typed, with a hint naming the
// form the rules take. Each test sets up its own season; amounts come from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { addGoods, bookGoods, GOODS } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { checkPlay, legalPlays } from '../rules/plays.mjs';
import { N } from '../numbers.mjs';

const tools = () => import('../agents/tools.mjs');
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
// The seat a01's reply, through the tools, into the rules.
async function seat(g, id = 'a01') {
  const { read, reply } = await tools();
  const { deal } = read(g.view(id), { audience: 'seat', seed: 'R5-deals-tools' });
  const sent = [];
  const ctx = { deal, tries: {}, validatePlay: p => checkPlay(g.s, id, p, g.s.day), apply: e => {
    sent.push(e);
    const r = g.errand(id, e.kind, e);
    return { ...r, legal: legalPlays(g.s, id), kind: r.events.find(x => x.type === 'invalid')?.kind };
  } };
  return { send: actions => reply({ actions }, ctx).results, sent };
}

test('{"doses": n} in a sit-down\'s terms reads as TEMP: the order goes through, and the deal it states names TEMP (§11, §14)', async () => {
  const g = new Game({ n: 3 });
  g.errand('a02', 'ask', { to: 'a01' });
  const sd = g.events('ask').at(-1).sitdown;
  g.errand('a01', 'answer', { sitdown: sd, accept: true });
  const { send, sent } = await seat(g);
  const [r] = send([{ act: 'say', sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { doses: 2 }, cash: 2 * N.rent } }]);
  assert.equal(r.ok, true, `the order goes through: ${r.why}`);
  assert.deepEqual(sent.map(e => e.terms.goods), [{ temp: 2 }], 'the rules get TEMP');
  assert.deepEqual(g.view('a02').me.deals.map(d => [d.role, d.goods]), [['seller', { temp: 2 }]]);
});

test('{"doses": n} in a hand-over reads as TEMP too, counted with any TEMP beside it; a form that maps to no goods is refused, typed, naming the form (§10, §33)', async () => {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'temp', 3);
  const { send, sent } = await seat(g);
  const [given] = send([{ act: 'give', to: 'a02', goods: { doses: 1, temp: 2 } }]);
  assert.equal(given.ok, true, `${given.why}`);
  assert.deepEqual(sent.map(e => e.goods), [{ temp: 3 }]);
  assert.equal(g.s.agents.a02.goods.temp, 3);
  const [bad] = send([{ act: 'give', to: 'a02', goods: { pills: 1 } }]);
  assert.deepEqual([bad.ok, bad.source, bad.code, bad.kind], [false, 'tools', 'field', 'never'], 'refused by the tools, typed');
  for (const k of GOODS) assert.ok(bad.why.includes(k), `the hint names the kinds: ${k}`);
  assert.match(bad.why, /"doses" reads as temp/, 'and the doses form');
  const { replyFormat } = await tools();
  assert.match(replyFormat('seat'), /- goods: [^\n]*"doses" reads as temp/, 'the reply format says so once, with the goods');
});
