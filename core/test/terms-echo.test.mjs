// R5-terms, the first defect the paid diagnostic found (runs/2026-10-18-r5diag, trade-sell, 0 of 2): a bot buyer ordered
// a gun, `trade` 1 gun for its price, and the seller, holding the gun and meaning to sell, sent the identical terms back.
// The core read them from the speaker's side, so the echo became a buy offer that replaced the order: nobody agreed and
// nothing moved. Now (rules/deals.mjs; the orchestrator's call, 10-18):
// - the other side's open terms sent back as they stand, the same what, goods and cash in the same sit-down, agree to
//   that side's deal, in that side's direction; the mirrored form (a sell against a buy) agrees as it did;
// - a buy is said `buy` (rules/errand.mjs TERM_SAID): the tools, the briefing and the bots use `buy` and `sell`, and
//   `trade` still reads as it did, everywhere terms are read;
// - the briefing says, in one line of rules text, that repeating the other side's terms agrees to their deal.
// Consent stays real: only open, unexpired terms in that sit-down agree so, and an echo moves nothing by itself; every
// give and pay is an errand either side can skip. The first test is the diagnostic's own scenario, built as harness.mjs
// builds it. Amounts come from N and the bots' own settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { checkPlay, legalPlays } from '../rules/plays.mjs';
import { rng } from '../rng.mjs';
import { N } from '../numbers.mjs';

const tools = () => import('../agents/tools.mjs');
const briefingOf = () => import('../agents/briefing.mjs');
const bots = () => import('../bench/bots.mjs');
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
// A season of the given cast, in id order, on day 1, as harness.mjs's World builds one (seed 404, rule A, a blackout).
function seasonOf(rows) {
  const g = new Game({ n: 1 });
  const agents = rows.map(([id, name, trade]) => ({ id, name, trade, driver: id === 'a01' ? 'openai/gpt-6-luna' : 'bot' }));
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
const dealsOf = (g, id) => g.view(id).me.deals;
const holdings = g => JSON.stringify(Object.values(g.s.agents).map(a => [a.id, a.cash, a.goods]));
// A seat's reply through the tools into the rules, as a model seat's goes (the tools' read, reply and apply).
async function seat(g, id = 'a01') {
  const { read, reply } = await tools();
  const { deal } = read(g.view(id), { audience: 'seat', seed: 'R5-terms' });
  const ctx = { deal, tries: {}, validatePlay: p => checkPlay(g.s, id, p, g.s.day), apply: e => {
    const r = g.errand(id, e.kind, e);
    return { ...r, legal: legalPlays(g.s, id), kind: r.events.find(x => x.type === 'invalid')?.kind };
  } };
  return actions => reply({ actions }, ctx).results;
}
async function story(g, id) {
  const { read } = await tools();
  const { briefing } = await briefingOf();
  return briefing(read(g.view(id), { audience: 'seat', seed: 'R5-terms' }).result, { call: 'round' });
}

// The diagnostic's trade-sell world (harness.mjs tradeSell.build): Luna (a01, a Gunrunner) builds a gun on night 1, in
// a sit-down the Cop a03 asked for; on day 2 the Cop orders it at the bots' gun price (gunPrice: GUNS.share of the
// shop's), and pays what its own deal record says it owes, for the debt, naming the sit-down.
async function tradeSell() {
  const { gunPrice } = await bots();
  const g = seasonOf([['a01', 'penny', 'gunrunner'], ['a02', 'vex', 'smuggler'], ['a03', 'mo', 'cop'], ['a04', 'kit', 'chemist'], ['a05', 'juno', 'dealer']]);
  for (const id of Object.keys(g.s.agents)) g.grant(id, (id === 'a03' ? 15 : 5) * N.rent);
  const sd = sitDown(g, 'a03', 'a01');
  g.night({ a01: { kind: 'build', place: 'suburbs', guns: 1, lockpicks: 0 }, a02: { kind: 'run', place: 'docks' }, a03: { kind: 'patrol', place: 'downtown' }, a04: { kind: 'hustle', place: 'docks' }, a05: { kind: 'hustle', place: 'docks' } });
  assert.equal(g.s.agents.a01.goods.guns, 1, 'control: Luna holds the gun she built');
  const price = gunPrice(g.view('a03'));
  assert.ok(g.s.agents.a03.cash >= price, 'control: the Cop can pay its price');
  const order = { what: 'trade', goods: { guns: 1 }, cash: price };
  ok(g, 'a03', 'say', { sitdown: sd, say: 'offer', terms: order });
  const payDue = () => {
    for (const d of dealsOf(g, 'a03').filter(x => x.role === 'buyer' && x.agreed && x.owes === 'me' && x.due > x.paid)) {
      ok(g, 'a03', 'pay', { to: d.with, amount: d.due - d.paid, for: 'debt', sitdown: d.sitdown });
    }
  };
  return { g, sd, price, order, payDue };
}

test("the diagnostic's trade-sell: the seller repeats the bot's order word for word, which agrees to the bot's deal in the bot's direction; nothing moves until her give, the gun moves on it, and the bot pays its price (§10, §14)", async () => {
  const { g, sd, price, order, payDue } = await tradeSell();
  const before = holdings(g);
  const at = g.log.length;
  const send = await seat(g);
  const [said] = send([{ act: 'say', sitdown: sd, say: 'offer', terms: order, line: `I'll trade you one gun for $${price}.` }]);
  assert.equal(said.ok, true, `the echo goes through the tools: ${said.why}`);
  assert.deepEqual(dealsOf(g, 'a03').map(d => [d.role, d.with, d.stated, d.agreed, d.agreedDay, d.goods, d.cash]),
    [['buyer', 'a01', 'me', true, 2, { guns: 1 }, price]], "the bot's own order, agreed by the echo: the bot still buys");
  assert.deepEqual(dealsOf(g, 'a01').map(d => [d.role, d.with, d.owes]), [['seller', 'a03', null]], 'Luna sells, and nobody owes yet');
  assert.equal(holdings(g), before, 'the echo moved no cash and no goods');
  assert.deepEqual(g.log.slice(at).filter(e => ['give', 'pay'].includes(e.type)), [], 'and handed nothing over');
  payDue();
  assert.equal(holdings(g), before, 'nothing is due before the gun comes, so the bot pays nothing');
  const [gave] = send([{ act: 'give', to: 'a03', goods: { guns: 1 }, sitdown: sd }]);
  assert.equal(gave.ok, true, `her give goes through: ${gave.why}`);
  assert.equal(g.s.agents.a03.goods.guns, 1, 'the gun moves on her give');
  assert.deepEqual(dealsOf(g, 'a03').map(d => [d.owes, d.due, d.paid]), [['me', price, 0]], 'the bot owes its price');
  const cash = g.s.agents.a01.cash;
  payDue();
  assert.equal(g.s.agents.a01.cash, cash + price, 'the bot pays it');
  assert.deepEqual([dealsOf(g, 'a01'), dealsOf(g, 'a03')], [[], []], 'both halves in: the deal settled');
});

test('the mirrored form keeps agreeing as it did: a sell against a buy order on the same goods and cash agrees to that order, in its direction, as the echo does (§14)', async () => {
  for (const what of ['sell', 'trade', 'buy']) {
    const { g, sd, price } = await tradeSell();
    ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what, goods: { guns: 1 }, cash: price } });
    assert.deepEqual(dealsOf(g, 'a03').map(d => [d.role, d.stated, d.agreed]), [['buyer', 'me', true]], `"${what}" back agrees to the Cop's order`);
  }
  // Other terms are a counter-offer, as before: Luna's own offer now stands, unagreed.
  const { g, sd, price } = await tradeSell();
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { guns: 1 }, cash: price + N.rent } });
  assert.deepEqual(dealsOf(g, 'a03').map(d => [d.role, d.stated, d.agreed, d.cash]), [['buyer', 'them', false, price + N.rent]], 'a counter-offer stands, unagreed');
});

test("a trunk bot buyer: the Cop's gun order, echoed word for word by the Gunrunner it asked, is agreed; the gun moves on the Gunrunner's give, and the bot pays what its deal record says it owes (§9, §10, §14)", async () => {
  const { makeBot } = await bots();
  const g = seasonOf([['a01', 'penny', 'cop'], ['a02', 'vex', 'gunrunner']]);
  g.grant('a01', 8 * N.shopPrice.guns);
  const memo = {};
  const cfg = { id: 'a01', type: 'cop', trade: 'cop', fav: 'industrial', route: 'downtown', layer: 2 };
  const errands = round => {
    const out = makeBot(cfg, memo).day(g.view('a01'), { seed: 404, day: g.s.day, round, rounds: 3, rng: rng(404, 'bot', 'a01', g.s.day, round) });
    for (const e of out) ok(g, 'a01', e.kind, e);
    return out;
  };
  assert.ok(errands(1).some(e => e.kind === 'ask' && e.to === 'a02'), 'control: the Cop asks the Gunrunner');
  const sd = g.view('a02').me.sitdowns.find(x => x.with === 'a01').id;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  const order = errands(2).find(e => e.kind === 'say' && e.sitdown === sd);
  assert.deepEqual(order && [order.say, order.terms.goods], ['offer', { guns: 1 }], 'control: the bot orders a gun');
  stock(g, 'a02', 'guns', 1);
  // The Gunrunner sends back the terms as its own view shows them.
  const shown = g.view('a02').me.sitdowns.find(x => x.id === sd).said.at(-1).terms;
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: shown });
  assert.deepEqual(dealsOf(g, 'a01').map(d => [d.role, d.stated, d.agreed]), [['buyer', 'me', true]], "the echo agrees to the bot's order");
  ok(g, 'a02', 'give', { to: 'a01', goods: { guns: 1 }, sitdown: sd });
  const paid = errands(3).filter(e => e.kind === 'pay');
  assert.deepEqual(paid.map(e => [e.to, e.amount, e.for]), [['a02', order.terms.cash, 'debt']], 'the bot pays its price');
  assert.deepEqual(dealsOf(g, 'a02'), [], 'the deal settled');
  assert.equal(order.terms.what, 'buy', 'the bot said its order "buy"');
});

test('an echo agrees only to open, unexpired terms in that sit-down: terms whose night has been played, terms from an ended sit-down, and terms another agent offered elsewhere agree to nothing (§14)', async () => {
  // Control: an echo of open terms before the night they name agrees.
  let g = new Game({ n: 4 });
  stock(g, 'a01', 'guns', 1);
  g.grant('a02', 10 * N.rent);
  let sd = sitDown(g, 'a02', 'a01');
  const terms = { what: 'trade', goods: { guns: 1 }, cash: 8 * N.rent, night: 1 };
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms });
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.role, d.agreed]), [['buyer', true]], 'control: open terms, echoed, agree');
  // Expired: the same order, its night played before the echo.
  g = new Game({ n: 4 });
  stock(g, 'a01', 'guns', 1);
  g.grant('a02', 10 * N.rent);
  sd = sitDown(g, 'a02', 'a01');
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms });
  g.night();
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.expired, d.agreed]), [[true, false]], 'control: its night is played');
  let before = holdings(g);
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms });
  assert.ok(!dealsOf(g, 'a02').some(d => d.agreed), 'an echo of expired terms agrees to nothing');
  assert.equal(holdings(g), before, 'and moves nothing');
  ok(g, 'a01', 'give', { to: 'a02', goods: { guns: 1 }, sitdown: sd });
  assert.ok(dealsOf(g, 'a02').every(d => d.owes === null), 'a give after it leaves nobody owing: nothing was agreed');
  // An ended sit-down: its offer is gone with it, and a new sit-down between the two starts with none.
  g = new Game({ n: 4 });
  g.grant('a02', 10 * N.rent);
  sd = sitDown(g, 'a02', 'a01');
  const gun = { what: 'trade', goods: { guns: 1 }, cash: 8 * N.rent };
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: gun });
  ok(g, 'a02', 'close', { sitdown: sd });
  const sd2 = sitDown(g, 'a01', 'a02');
  before = holdings(g);
  ok(g, 'a01', 'say', { sitdown: sd2, say: 'offer', terms: gun });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.sitdown, d.role, d.stated, d.agreed]), [[sd2, 'seller', 'them', false]],
    "the echo in the new sit-down is a01's own offer, unagreed");
  assert.equal(holdings(g), before, 'and moves nothing');
  // Terms another agent offered, repeated in another sit-down: an offer of its own to its own partner, unagreed.
  g = new Game({ n: 4 });
  g.grant('a02', 10 * N.rent);
  sd = sitDown(g, 'a02', 'a01');
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: gun });
  const other = sitDown(g, 'a01', 'a03');
  ok(g, 'a01', 'say', { sitdown: other, say: 'offer', terms: gun });
  assert.deepEqual(dealsOf(g, 'a02').map(d => [d.sitdown, d.agreed]), [[sd, false]], "a02's order in its own sit-down stays unagreed");
  assert.deepEqual(dealsOf(g, 'a03').map(d => [d.sitdown, d.role, d.stated, d.agreed]), [[other, 'seller', 'them', false]], 'and a01 offered a03 its own terms');
});

test('an echo never moves goods or cash by itself: agreed, the deal holds nothing handed over and nobody owes; with nothing handed over, it ends with its sit-down, and an agreed deal said again on its own terms stands as it was (§10, §14)', async () => {
  const { g, sd, price, order } = await tradeSell();
  const before = holdings(g);
  const at = g.log.length;
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: order });
  const [d] = dealsOf(g, 'a03');
  assert.deepEqual([d.agreed, d.given, d.paid, d.due, d.owes], [true, {}, 0, 0, null], 'agreed: nothing handed over, nothing owed');
  // The same deal said again, by either side and in either form, before anything is handed over: it stands.
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: order });
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { ...order, what: 'sell' } });
  ok(g, 'a03', 'say', { sitdown: sd, say: 'offer', terms: order });
  assert.deepEqual(dealsOf(g, 'a03').map(x => [x.id, x.role, x.agreed, x.agreedDay]), [[d.id, 'buyer', true, d.agreedDay]], 'the deal stands as agreed');
  assert.equal(holdings(g), before, 'none of it moved cash or goods');
  assert.deepEqual(g.log.slice(at).filter(e => ['give', 'pay'].includes(e.type)), [], 'or handed anything over');
  checkLedger(g.s, 'after the echoes');
  // New terms still make a new offer, unagreed.
  ok(g, 'a03', 'say', { sitdown: sd, say: 'offer', terms: { ...order, cash: price - N.rent } });
  assert.deepEqual(dealsOf(g, 'a01').map(x => [x.agreed, x.cash]), [[false, price - N.rent]], 'a new price is a new offer');
  // An agreed deal nothing was handed over against ends with its sit-down.
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { ...order, cash: price - N.rent } });
  assert.equal(dealsOf(g, 'a01')[0].agreed, true, 'control: agreed again by the echo');
  ok(g, 'a03', 'close', { sitdown: sd });
  assert.deepEqual([dealsOf(g, 'a01'), dealsOf(g, 'a03')], [[], []], 'nothing handed over: it ends with the sit-down');
  assert.equal(holdings(g), before, 'having moved nothing');
});

test('"buy" is the buy\'s name: the rules read it as "trade", the record keeps "trade", "trade" still works, the tools show "buy" and "sell", and the briefing writes "buy" (§14, §33)', async () => {
  const g = new Game({ n: 3 });
  g.grant('a01', 10 * N.rent);
  const sd = sitDown(g, 'a01', 'a02');
  ok(g, 'a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'buy', goods: { chems: 2 }, cash: 2 * N.rent } });
  assert.deepEqual(g.events('say').at(-1).terms, { what: 'trade', cash: 2 * N.rent, goods: { chems: 2 } }, 'the record keeps "trade"');
  assert.deepEqual(dealsOf(g, 'a01').map(d => [d.role, d.with, d.stated]), [['buyer', 'a02', 'me']], '"buy" makes its speaker the buyer');
  // Either word echoes the other: the same what.
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { chems: 2 }, cash: 2 * N.rent } });
  assert.deepEqual(dealsOf(g, 'a01').map(d => [d.role, d.agreed]), [['buyer', true]], '"trade" back agrees to the "buy"');
  // Crew chat and out loud read terms the same way.
  ok(g, 'a01', 'crew_form', { name: 'tide' });
  ok(g, 'a01', 'chat', { say: 'offer', terms: { what: 'buy', goods: { parts: 1 }, cash: N.rent } });
  ok(g, 'a01', 'outloud', { say: 'offer', terms: { what: 'buy', goods: { parts: 1 }, cash: N.rent }, line: 'buying parts' });
  assert.deepEqual(['chat', 'outloud'].map(t => g.events(t).at(-1).terms.what), ['trade', 'trade']);
  // The tools take either word and show "buy" and "sell", never "trade".
  const { replyFormat } = await tools();
  const row = replyFormat('seat').split('\n').find(l => l.startsWith('- termWhat:'));
  assert.equal(row, '- termWhat: back|pay|hit|buy|sell|join|stay|meet');
  const send = await seat(g, 'a02');
  const results = send([
    { act: 'say', sitdown: sd, say: 'offer', terms: { what: 'buy', goods: { parts: 1 }, cash: N.rent } },
    { act: 'say', sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { parts: 2 }, cash: 2 * N.rent } },
    { act: 'say', sitdown: sd, say: 'offer', terms: { what: 'swap', goods: { parts: 2 }, cash: 2 * N.rent } },
  ]);
  assert.deepEqual(results.map(r => r.ok), [true, true, false], 'either word goes through; another is refused');
  assert.match(results[2].why, /one of back, pay, hit, buy, sell, join, stay, meet/, 'the refusal names the words');
  // The briefing writes "buy": its rules line and every message.
  const [system, user] = (await story(g, 'a01')).map(m => m.content);
  assert.match(system, /terms:\{what:"buy",goods:\{kind:count\},cash:amount\} offers to buy them; what:"sell" offers to sell/);
  assert.ok(!/what:"trade"/.test(system), 'and never names "trade" as a what');
  assert.ok(system.split('\n').includes(row), 'its reply format shows the same words');
  const line = user.split('\n').find(l => l.startsWith(`- ${sd} with a02`));
  assert.match(line, /you: offer \(buy \$\d+ 2 chems\); a02: offer \(buy \$\d+ 2 chems\)/, 'a buy reads "buy" in the sit-down');
  assert.ok(!/\btrade\b/.test(line), `no "trade" in it: ${line}`);
});

test("the briefing says plainly, in one line of rules text, that repeating the other side's terms agrees to their deal; no advice (§14, §33)", async () => {
  const g = new Game({ n: 3 });
  const [system] = (await story(g, 'a01')).map(m => m.content);
  const lines = system.split('\n').filter(l => /repeating the other side's terms/i.test(l));
  assert.equal(lines.length, 1, 'one line says it');
  assert.match(lines[0], /An offer becomes a deal with the other side's same terms back, or its half handed over; repeating the other side's terms agrees to their deal\./);
  assert.ok(!/\b(should|must|best|try|consider|remember)\b/i.test(lines[0]), `rules text, no advice: ${lines[0]}`);
});
