// R5-deals, the review's briefing section (briefing.mjs; GAME.md §14, §17): the deals a seat reads are bounded and say
// what they are. At most one line per counterpart, and a count of the rest; a deal with nothing handed over stays hidden
// while its sit-down is open, since its terms show there; an offer nobody agreed to reads as an offer ("a19 offers…"),
// never as a sale, and only an agreed deal says what is due. The review's probe: an agent that plants offers and $1
// prepays in another's briefing every day can't push it over budget or cut its talk. Amounts come from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';

const tools = () => import('../agents/tools.mjs');
const briefingOf = () => import('../agents/briefing.mjs');
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
function ok(g, id, kind, fields) {
  const r = g.errand(id, kind, fields);
  assert.equal(r.ok, true, `day ${g.s.day}: ${id}'s ${kind} went through (${r.why})`);
  return r;
}
function sitDown(g, a, b) {
  ok(g, a, 'ask', { to: b });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, b, 'answer', { sitdown: sd, accept: true });
  return sd;
}
async function brief(g, id) {
  const { read } = await tools();
  const { briefing } = await briefingOf();
  return briefing(read(g.view(id), { audience: 'seat', seed: 'R5-section' }).result, { call: 'round' }).map(m => m.content);
}
// The deals section of a story: its heading and lines, up to the next blank line.
const section = user => {
  const at = user.split('\n\n').find(p => p.startsWith('Your deals'));
  return at ? at.split('\n') : [];
};
const price = N.rent;

test("the review's probe: offers and $1 prepays planted in a seat's briefing every day for a week leave it one line a day at most, inside the budget, with its talk and speech kept (§14, §17; gap.briefing)", async () => {
  const g = new Game({ n: 20 });
  g.grant('a01', 500);
  for (let d = 0; d < 7; d++) {
    const sd = sitDown(g, 'a01', 'a02');
    ok(g, `a${String(3 + d).padStart(2, '0')}`, 'ask', { to: 'a02', line: `hello on day ${g.s.day}` });
    while (g.s.agents.a01.msgs < N.messages) {
      ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { guns: 1 }, cash: 1 } });
      ok(g, 'a01', 'pay', { to: 'a02', amount: 1 });
    }
    const [system, user] = await brief(g, 'a02');
    const lines = section(user).filter(l => l.startsWith('- '));
    assert.ok(lines.length <= 1, `day ${g.s.day}: at most one line for a01: ${lines.length}`);
    assert.ok(system.length + user.length <= N['gap.briefing'].chars, `day ${g.s.day}: inside the budget`);
    assert.ok(user.includes('<speech>') && user.includes('Your sit-downs:'), `day ${g.s.day}: its talk and speech kept`);
    ok(g, 'a02', 'close', { sitdown: sd });
    g.night();
  }
  assert.deepEqual(section((await brief(g, 'a02'))[1]), [], 'and nothing of it the next week');
});

test('one line per counterpart, the rest counted; an offer nobody agreed to, with nothing handed over, stays in its sit-down; an agreed deal shows at once (R9), and both show once something changes hands (§14)', async () => {
  const g = new Game({ n: 4 });
  stock(g, 'a01', 'parts', 4);
  stock(g, 'a03', 'chems', 1);
  g.grant('a02', 10 * price);
  // Two agreed deals with a01, both owed, one in a closed sit-down.
  const s1 = sitDown(g, 'a01', 'a02');
  ok(g, 'a02', 'say', { sitdown: s1, say: 'offer', terms: { what: 'trade', goods: { parts: 2 }, cash: 2 * price } });
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 2 } });
  ok(g, 'a01', 'close', { sitdown: s1 });
  const s2 = sitDown(g, 'a01', 'a02');
  ok(g, 'a02', 'say', { sitdown: s2, say: 'offer', terms: { what: 'trade', goods: { parts: 2 }, cash: 3 * price } });
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 2 } });
  // An agreed deal with a03, nothing handed over yet: the same terms offered back.
  const s3 = sitDown(g, 'a03', 'a02');
  ok(g, 'a03', 'say', { sitdown: s3, say: 'offer', terms: { what: 'sell', goods: { chems: 1 }, cash: price } });
  ok(g, 'a02', 'say', { sitdown: s3, say: 'offer', terms: { what: 'trade', goods: { chems: 1 }, cash: price } });
  assert.equal(g.view('a02').me.deals.length, 3, 'control: three deals on the record');
  let lines = section((await brief(g, 'a02'))[1]);
  assert.deepEqual(lines.filter(l => l.startsWith('- ')).map(l => l.split(':')[0]), [`- ${s2}`, `- ${s3}`], 'a01\'s newest owed deal, then a03\'s agreed deal with nothing handed over yet (R9)');
  assert.ok(lines.some(l => /1 more/.test(l) && /a01/.test(l)), `the other deal with a01 counted: ${lines.join(' | ')}`);
  ok(g, 'a03', 'give', { to: 'a02', goods: { chems: 1 } });
  lines = section((await brief(g, 'a02'))[1]).filter(l => l.startsWith('- '));
  assert.ok(lines.some(l => l.startsWith(`- ${s3}: a03 sells you 1 chems`)), `once the chems came, a03's line: ${lines.join(' | ')}`);
  ok(g, 'a02', 'pay', { to: 'a03', amount: price, sitdown: s3 });
  lines = section((await brief(g, 'a02'))[1]).filter(l => l.startsWith('- '));
  assert.ok(!lines.some(l => l.startsWith(`- ${s3}`)), 'settled, it drops off');
});

test('an offer nobody agreed to reads as an offer and never says what is due; an agreed deal says so; and the rules say how an offer becomes a deal, and that an answer alone brings no bot delivery (§14, §33)', async () => {
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'parts', 2);
  g.grant('a02', 4 * price);
  const sd = sitDown(g, 'a01', 'a02');
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { parts: 2 }, cash: 2 * price } });
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 1 } });
  let [system, user] = await brief(g, 'a02');
  let line = section(user).find(l => l.startsWith(`- ${sd}`));
  assert.match(line, new RegExp(`^- ${sd}: a01 offers to sell you 2 parts for \\$${2 * price} \\(not agreed\\): a01 gave 1 of 2, you paid \\$0\\.$`));
  ok(g, 'a02', 'pay', { to: 'a01', amount: price });
  ok(g, 'a01', 'give', { to: 'a02', goods: { parts: 1 } });
  [system, user] = await brief(g, 'a02');
  line = section(user).find(l => l.startsWith(`- ${sd}`));
  assert.match(line, new RegExp(`^- ${sd}: a01 sells you 2 parts for \\$${2 * price} \\(agreed day 1\\): a01 gave 2 of 2 \\(\\$${2 * price} due\\), you paid \\$${price}\\.$`));
  const rules = system.split('\n\n')[0];
  assert.match(rules, /say:"answer" alone triggers no bot delivery/, 'the answer sentence is back');
  assert.match(rules, /same terms back, or its half handed over/, 'and how an offer becomes a deal');
});
