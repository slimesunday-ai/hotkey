// R4-3, the agents and the bots under the new daytime (trunk docs/briefs/R4-astra-fixes.md, task 3; GAME.md §9, §14,
// §17, §33). A sit-down stays open N.sitdownDays days unless either side closes it; shop and sell are orders, filled
// together at the lock, a shop order naming the most it pays.
// - The tools: a `close` action, and the shop's `max`, typed like any field.
// - The briefing: the timing in plain rules text, once each, with no advice; the story shows a sit-down's last day, the
//   terms that have expired, and the seat's orders.
// - The runner: a model seat wakes in a later round only for what happened in its sit-downs today, as before.
// - The bots, from their own view (`viewFor(..., 'agent')`): each closes a sit-down from an earlier day when its day
//   starts, once the deal in it is done or dead (R4-3's review: one with a goods order pending stays open; see
//   daytime-review.test.mjs), so its trades go on as they did; a shop order puts up a max; and it plans tonight with
//   what its orders bring at the lock.
// Each test imports what it needs itself, so each fails on its own before the rule exists. Amounts come from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { runOf } from '../rules/market.mjs';
import { rng } from '../rng.mjs';
import { N } from '../numbers.mjs';

const bots = () => import('../bench/bots.mjs');
const tools = () => import('../agents/tools.mjs');
const briefingOf = () => import('../agents/briefing.mjs');
const runner = () => import('../bench/runner.mjs');
// The briefing tests' cue check (§33): advice and crime cues.
const CUES = /\b(you should|should you|recommend|advice|your goal|the goal|crime is allowed|crime pays|deception|get rich|best (play|move|option|choice)|try to|consider|make sure|worth it)\b/i;
function stock(g, id, kind, n = 1) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, n > 0 ? 'in' : 'out', 'test', kind, Math.abs(n));
  checkLedger(g.s, `stock ${id} ${kind}`);
}
function ok(g, id, kind, fields) {
  const r = g.errand(id, kind, fields);
  assert.equal(r.ok, true, `${id}'s ${kind} went through (${r.why})`);
}
const lastAsk = g => g.events('ask').at(-1).sitdown;
// A small season on day 1, one bot config each (habits.test.mjs's world): `errands(id, round)` applies a fresh bot's
// day in that round, and `play(id)` is tonight's play.
async function world(cfgs) {
  const { makeBot } = await bots();
  const agents = cfgs.map((c, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: c.trade, driver: 'test' }));
  const g = new Game({ n: 1 });
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  const cfg = Object.fromEntries(agents.map((a, i) => [a.id, { id: a.id, fav: 'industrial', route: 'downtown', layer: 2, ...cfgs[i] }]));
  const memos = {};
  const bot = id => makeBot(cfg[id], (memos[id] ||= {}));
  const ctx = (id, round) => ({ seed: 404, day: g.s.day, round, rounds: 3, rng: rng(404, 'bot', id, g.s.day, round) });
  const errands = (id, round) => {
    const out = bot(id).day(g.view(id), ctx(id, round));
    for (const e of out) ok(g, id, e.kind, e);
    return out;
  };
  const play = id => bot(id).night(g.view(id), ctx(id, 'night')).play;
  return { g, errands, play };
}

test("the tools: a close action, and the shop's max, typed like any field; a shop order without one is refused when the seat replies (§17, §33)", async () => {
  const { replyFormat, read, reply } = await tools();
  const format = replyFormat('seat');
  assert.ok(/\{"act":\s*"close"\}.*"sitdown":\s*sitdown/.test(format), 'close is in the reply format');
  assert.ok(/\{"act":\s*"shop"\}.*"item":\s*shopItem.*"units"\?:\s*count.*"max":\s*dollars/.test(format), 'and the shop takes its max');
  const g = new Game({ n: 2 });
  ok(g, 'a01', 'ask', { to: 'a02' });
  const sd = lastAsk(g);
  const { deal } = read(g.view('a02'), { audience: 'seat', seed: 'R4-3' });
  const sent = [];
  const apply = e => {
    sent.push(e);
    const r = g.errand('a02', e.kind, e);
    return { ok: r.ok, why: r.why };
  };
  const r = reply({ actions: [{ act: 'close', sitdown: sd }, { act: 'shop', item: 'chems', units: 1 }] }, { deal, apply, tries: {} });
  assert.deepEqual(r.results.map(x => [x.act, x.ok, x.code || null]), [['close', true, null], ['shop', false, 'field']]);
  assert.match(r.results[1].why, /max/);
  assert.deepEqual(sent.map(e => e.kind), ['close'], 'the shop order never reached the rules');
  assert.equal(g.events('close').length, 1);
});

test("the briefing states the new timing once each, in plain rules text with no advice; the story shows a sit-down's last day, its expired terms and the seat's orders (§14, §17, §33)", async () => {
  const { briefing } = await briefingOf();
  const { read } = await tools();
  const g = new Game({ n: 3 });
  ok(g, 'a01', 'ask', { to: 'a02' });
  const sd = lastAsk(g);
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  ok(g, 'a02', 'say', { sitdown: sd, say: 'promise', terms: { what: 'back', who: 'a01', night: 1 } });
  g.night();
  g.grant('a01', runOf('shop', 'chems', 0, 1));
  ok(g, 'a01', 'shop', { item: 'chems', units: 1, max: runOf('shop', 'chems', 0, 1) });
  const [system, user] = briefing(read(g.view('a01'), { audience: 'seat', seed: 'R4-3' }).result).map(m => m.content);
  const rules = system.split('\n\n')[0];
  const life = `last ${N.sitdownDays} days`;
  assert.equal(rules.split(life).length - 1, 1, `the sit-down's life is said once: ${life}`);
  assert.equal(rules.split("fill the day's orders at the lock").length - 1, 1, 'and the clearing once');
  assert.ok(!CUES.test(system) && !CUES.test(user), 'no advice');
  const talk = user.split('\n').find(l => l.startsWith(`- ${sd} `));
  assert.ok(talk && talk.includes(`until day ${1 + N.sitdownDays - 1}`), `the sit-down shows its last day: ${talk}`);
  assert.ok(talk.includes('expired'), "and night 1's promise as expired");
  assert.ok(user.split('\n').some(l => l.startsWith('Your orders') && l.includes('chems')), 'the seat sees its order');
});

test('a model seat wakes in a later round only for what happened in its sit-downs today: an ask or a message from an earlier day waits for round 1 (runner Q2)', async () => {
  const { wakes } = await runner();
  const g = new Game({ n: 3 });
  ok(g, 'a02', 'ask', { to: 'a01' });
  ok(g, 'a03', 'ask', { to: 'a01' });
  ok(g, 'a01', 'answer', { sitdown: lastAsk(g), accept: true });
  ok(g, 'a03', 'say', { sitdown: lastAsk(g), say: 'offer', terms: {} });
  assert.equal(wakes(g.view('a01'), 2), true, 'day 1: an ask and a message wait for it');
  g.night();
  assert.equal(wakes(g.view('a01'), 1), true, 'day 2, round 1: always');
  assert.equal(wakes(g.view('a01'), 2), false, "day 2, round 2: yesterday's ask and message don't wake it again");
  ok(g, 'a03', 'say', { sitdown: lastAsk(g), say: 'offer', terms: {} });
  assert.equal(wakes(g.view('a01'), 2), true, "a message today does");
});

test('a bot closes, as its day starts, every sit-down from an earlier day with no deal pending in it, read off its own view, and leaves today\'s alone, so its trade goes on as it did (§14)', async () => {
  const { g, errands } = await world([
    { type: 'hustle', trade: 'smuggler' }, { type: 'hustle', trade: 'smuggler' }, { type: 'hustle', trade: 'smuggler' }, { type: 'hustle', trade: 'smuggler' },
  ]);
  ok(g, 'a02', 'ask', { to: 'a01' });
  const asked = lastAsk(g);
  ok(g, 'a01', 'ask', { to: 'a03' });
  const open = lastAsk(g);
  ok(g, 'a03', 'answer', { sitdown: open, accept: true });
  g.night();
  assert.equal(g.errand('a03', 'ask', { to: 'a01' }).ok, false, "control: yesterday's sit-down is still open");
  ok(g, 'a04', 'ask', { to: 'a01' });
  const today = g.view('a01').me.sitdowns.find(x => x.day === 2).id;
  const out = errands('a01', 1);
  assert.deepEqual(out.filter(e => e.kind === 'close').map(e => e.sitdown).sort(), [asked, open].sort(), "it closes yesterday's two");
  assert.ok(!out.some(e => e.sitdown === today && e.kind === 'close'), "and leaves today's");
  assert.deepEqual(g.view('a01').me.sitdowns.map(x => x.id), [today]);
  assert.equal(errands('a01', 2).filter(e => e.kind === 'close').length, 0, 'nothing more to close in a later round');
});

test("a bot's shop order puts up a max from its own view, at least its units' price alone and within its cash; it plans tonight with what its orders bring at the lock: the chems it ordered it cooks, and the cash its sale brings covers the rent (§9, §10)", async () => {
  const { g, errands, play } = await world([
    { type: 'chemist', trade: 'chemist', every: true }, { type: 'chemist', trade: 'chemist', every: true }, { type: 'smuggler', trade: 'smuggler', every: true },
  ]);
  // a01: no chems, and the cash for a batch's worth from the shop and the rent.
  stock(g, 'a01', 'chems', -N.kits.chemist.chems);
  const alone = runOf('shop', 'chems', g.s.market.shop.chems, N.cook.chems);
  g.grant('a01', 2 * alone + 2 * N.rent);
  const shop = errands('a01', 3).filter(e => e.kind === 'shop');
  assert.equal(shop.length, 1, 'it orders chems');
  assert.ok(shop[0].max >= alone && shop[0].max <= 2 * alone + 2 * N.rent, `its max: ${shop[0].max}, at least ${alone}`);
  assert.equal(g.s.agents.a01.goods.chems || 0, 0, 'control: by day they are not yet its own');
  assert.equal(play('a01').kind, 'cook', 'it plans the cook they make possible');
  // a02: doses enough to cover the rent at the buyer, and its kit's chems for tonight's cook.
  stock(g, 'a02', 'temp', 10);
  const sold = errands('a02', 3).filter(e => e.kind === 'sell');
  assert.ok(sold.length >= 1, 'it sells to cover the rent');
  assert.equal(g.s.agents.a02.cash, 0, 'control: by day the sale has not paid yet');
  assert.equal(play('a02').kind, 'cook', 'it plans with the cash the sale brings at the lock');
  const r = g.night({ a01: play('a01'), a02: play('a02'), a03: play('a03') });
  assert.deepEqual(g.events('cook').map(e => e.agent).sort(), ['a01', 'a02'], 'both cooked');
  assert.deepEqual(r.newEvents.filter(e => e.type === 'evicted' && e.agent !== 'a03').map(e => e.agent), [], 'and kept their homes');
});
