// R5-deals, the briefing: an unsettled deal is a fact the seat sees in every call until it settles (rules/deals.mjs;
// GAME.md §10, §14, §17, §18, §33), once something has changed hands (before that, its terms show in its sit-down). The
// buyer reads what came against the terms and what it has paid; the seller reads what it has given; both read the day it
// was agreed, and the cash due at the terms for what was given. It is plain fact, with no advice, and the cut order never
// drops it: a story over budget gives up everything else first.
// Each test sets up its own season; amounts come from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { viewFor } from '../rules/view.mjs';
import { N } from '../numbers.mjs';

const tools = () => import('../agents/tools.mjs');
const briefingOf = () => import('../agents/briefing.mjs');
// The briefing tests' cue check (§33): advice and crime cues.
const CUES = /\b(you should|should you|recommend|advice|your goal|the goal|crime is allowed|crime pays|deception|get rich|best (play|move|option|choice)|try to|consider|make sure|worth it|you must|remember to|don't forget)\b/i;
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
const price = N.rent;
// a01 sells a02 one part at a02's offer, handed over, unpaid.
function delivered() {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'parts', 1);
  g.grant('a02', 3 * price);
  ok(g, 'a01', 'ask', { to: 'a02' });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { parts: 1 }, cash: price } });
  return { g, sd };
}
async function user(g, id, call = 'round') {
  const { read } = await tools();
  const { briefing } = await briefingOf();
  return briefing(read(g.view(id), { audience: 'seat', seed: 'R5-deals' }).result, { call }).map(m => m.content);
}
const dealLine = (text, sd) => text.split('\n').find(l => l.startsWith(`- ${sd}: `));

test("every call shows an unsettled deal as plain fact once something has changed hands: the seller reads what it gave; the buyer what came against its offer and what it paid, with the cash due at its terms (§10, §14, §17)", async () => {
  const { g, sd } = delivered();
  const [, before] = await user(g, 'a01');
  assert.equal(dealLine(before, sd), undefined, 'nothing has changed hands yet: no deal line');
  assert.match(before, new RegExp(`^- ${sd} with a02, .*a02: offer \\(buy \\$${price} 1 parts\\)`, 'm'), 'control: the order shows in its sit-down');
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 1 } });
  for (const call of ['round', 'lock']) {
    const [system, text] = await user(g, 'a02', call);
    const line = dealLine(text, sd);
    assert.match(line, new RegExp(`a01 sells you 1 parts for \\$${price} \\(agreed day 1\\): a01 gave 1 of 1 \\(\\$${price} due\\), you paid \\$0\\.$`), `${call}: ${line}`);
    assert.ok(!CUES.test(line) && !CUES.test(system), 'facts only, no advice');
  }
  const [, seller] = await user(g, 'a01');
  assert.match(dealLine(seller, sd), new RegExp(`you sell a02 1 parts for \\$${price} \\(agreed day 1\\): you gave 1 of 1 \\(\\$${price} due\\), a02 paid \\$0\\.$`));
  ok(g, 'a02', 'pay', { to: 'a01', amount: price, for: 'debt' });
  const [, settled] = await user(g, 'a02');
  assert.equal(dealLine(settled, sd), undefined, 'once paid, it settled and shows no more');
});

test("the next day's call still shows the deal, after its sit-down is over, though the give has left the record the story reads from (§10, §14, §19)", async () => {
  const { g, sd } = delivered();
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 1 } });
  ok(g, 'a01', 'close', { sitdown: sd });
  g.night();
  const [, text] = await user(g, 'a02');
  assert.ok(!/a01 gave you 1 parts/.test(text.split('\n').find(l => l.startsWith('Since last night')) || ''), "control: yesterday's give is not in last night's news");
  assert.match(dealLine(text, sd), new RegExp(` \\(agreed day 1; sit-down over\\): a01 gave 1 of 1 \\(\\$${price} due\\), you paid \\$0\\.$`));
});

test('the cut order never drops a deal: a story far over budget gives up everything it can, the last resort too, and every deal line stays (§17; gap.briefing)', async () => {
  const { g, sd } = delivered();
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 1 } });
  // Long talk in many sit-downs, beyond any budget, in a copy of the state, so the season itself is unchanged.
  const st = structuredClone(g.s);
  for (let i = 0; i < 40; i++) {
    st.sitdowns[`s${9000 + i}`] = { id: `s${9000 + i}`, a: 'a03', b: 'a02', day: st.day, until: st.day, state: 'open', listeners: [], met: null,
      said: [0, 1, 2].map(j => ({ from: 'a03', say: 'offer', terms: { what: 'meet', cash: j }, line: `LONG-${i}-${j} ${'x'.repeat(N['gap.lineLength'] - 20)}`, day: st.day })) };
  }
  const { read } = await tools();
  const { briefing } = await briefingOf();
  const msgs = briefing(read(viewFor(st, g.log, 'a02', 'agent'), { audience: 'seat', seed: 'R5-deals' }).result).map(m => m.content);
  const text = msgs.join('\n');
  assert.ok(text.includes('whole lines past the budget'), 'control: every cut was made, the last resort too');
  assert.ok(text.length <= N['gap.briefing'].chars, `control: it fits, ${text.length}`);
  assert.match(dealLine(msgs[1], sd) || '', /a01 gave 1 of 1/, 'the deal stays');
});

test('the rules say once, in plain rules text, what a trade offer and a sell offer are, and the reply format takes "sell" (§14, §33)', async () => {
  const { g } = delivered();
  const [system] = await user(g, 'a02');
  const rules = system.split('\n\n')[0];
  assert.equal(rules.split('what:"sell"').length - 1, 1, 'sell, once');
  assert.match(rules, /what:"buy".*buy/, 'buy buys');
  assert.ok(!CUES.test(rules), 'no advice');
  const { replyFormat } = await tools();
  assert.match(replyFormat('seat'), /termWhat: [^\n]*\bsell\b/);
});
