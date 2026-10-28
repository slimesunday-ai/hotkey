// R9d, Part A (docs/briefs/R9d-trade-you-can-read.md): trade a model can read with the bots (bench/bots.mjs).
// - Every bot ask says what the sit-down is for in its line, from the numbers the bot then acts on.
// - A buyer bot answers what its seller said after its order: a fitting counter it takes, at the seller's price; words
//   with no terms get its order again, once; a counter above its price or past its budget it leaves.
// The bots play from their own views against a seller played by hand here, as a model seat would play it. Amounts come
// from N and the bots' own settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { rng } from '../rng.mjs';
import { N } from '../numbers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const bots = () => import('../bench/bots.mjs');
const LAYLOW = { kind: 'laylow', place: 'suburbs' };
const num = id => Number(id.slice(1));
const byId = (x, y) => num(x.id) - num(y.id);

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
const apply = (g, id, out) => out.forEach(({ kind, ...e }) => ok(g, id, kind, e));
const sitdownWith = (g, a, b) => g.view(a).me.sitdowns.find(sd => sd.with === b);

// Two seats on day 1, the trades named, in id order (deals-bots.test.mjs's world): `errands(id, round)` plays a bot's
// day in that round, with its memory kept across calls, and applies what it sends.
async function pair(cfgs) {
  const { makeBot } = await bots();
  const agents = cfgs.map((c, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: c.trade, driver: 'test' }));
  const g = new Game({ n: 1 });
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  const memos = {};
  const cfg = id => ({ id, fav: 'industrial', route: 'downtown', layer: 2, ...cfgs[num(id) - 1] });
  const errands = (id, round) => {
    const out = makeBot(cfg(id), (memos[id] ||= {})).day(g.view(id), { seed: 404, day: g.s.day, round, rounds: 3, rng: rng(404, 'bot', id, g.s.day, round) });
    apply(g, id, out);
    return out;
  };
  return { g, errands };
}

// The canny cast (canny-bots.test.mjs's world), every agent with the rent to the ferry twice over: a Dealer bot and the
// stocked Chemist it asks, which is played by hand. `day(round)` plays the Dealer's day and applies it. The Dealer has
// asked and the Chemist has taken the ask; `want` is what the Dealer is short of.
async function dealerAsks() {
  const { makeCast, makeBot, CASTS } = await bots();
  const seed = 404;
  const cast = makeCast(seed, CASTS.canny);
  const g = new Game({ n: 1 });
  const r = newSeason({ seed, rule: 'A', midseason: 'payday', items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  Object.keys(g.s.agents).forEach(id => g.grant(id, 2 * N.nights * N.rent));
  const every = cast.some(c => c.works);
  const seat = id => ({ ...cast.find(c => c.id === id), ...(every ? { every } : {}) });
  const workers = trade => cast.filter(c => c.trade === trade && (c.type === trade || c.works)).sort(byId);
  const dealer = workers('dealer').find(c => c.type === 'dealer').id;
  const chemist = workers('chemist').find(c => c.type === 'chemist').id;
  stock(g, chemist, 'temp', workers('dealer').length * N.deal.held);
  while (g.s.day < 3) g.night({}, { filler: LAYLOW });
  const want = N.deal.held - (g.s.agents[dealer].goods.temp || 0);
  const bot = makeBot(seat(dealer), {});
  const day = round => {
    const out = bot.day(g.view(dealer), { seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', dealer, g.s.day, round) });
    apply(g, dealer, out);
    return out;
  };
  const asks = day(1).filter(e => e.kind === 'ask' && e.to === chemist);
  assert.equal(asks.length, 1, 'control: the Dealer asks the stocked Chemist');
  const sd = sitdownWith(g, dealer, chemist).id;
  ok(g, chemist, 'answer', { sitdown: sd, accept: true });
  return { g, dealer, chemist, sd, want, ask: asks[0], day, night: () => g.night({}, { filler: LAYLOW }) };
}
const mine = (out, sd) => out.filter(e => e.sitdown === sd);
const buy = (sd, goods, cash) => ({ kind: 'say', sitdown: sd, say: 'offer', terms: { what: 'buy', goods, cash } });

test('every ask in the bots carries a line', async () => {
  const src = fs.readFileSync(path.join(here, '..', 'bench', 'bots.mjs'), 'utf8');
  const asks = src.match(/\{ kind: 'ask', to[^}]*\}/g) || [];
  assert.ok(asks.length >= 10, `the ask sites: ${asks.length}`);
  assert.deepEqual(asks.filter(a => !/\bline: /.test(a)), [], 'every one names a line');
});

test('a goods buyer\'s ask says how many it buys, at what price, and that it pays as they come; the order it then states has those numbers (§9, §14)', async () => {
  const { STREET, buyLine } = await bots();
  const { g, dealer, sd, want, ask, day } = await dealerAsks();
  assert.ok(want >= 3, `control: the Dealer is short of ${want} doses`);
  assert.equal(ask.line, buyLine('doses', want, STREET.unit));
  assert.equal(ask.line, `Buying up to ${want} doses at $${STREET.unit} each; I pay as they're handed over.`);
  assert.ok(ask.line.length <= N['gap.lineLength'], 'inside the line limit');
  assert.deepEqual(mine(day(2), sd), [buy(sd, { temp: want }, want * STREET.unit)], 'it orders what the line said, at its price');
  const said = g.events('ask', e => e.sitdown === sd)[0];
  assert.equal(said.line, ask.line, 'the ask event carries the line to the seat asked');
  assert.ok(g.view(dealer).me.sitdowns.some(x => x.id === sd), 'control: the sit-down is the Dealer\'s');
});

test('a street seller\'s ask says what it sells and at what price; the offer it states once the buyer takes it has those numbers (§9, §14)', async () => {
  const { STREET, sellLine } = await bots();
  const { g, errands } = await pair([{ type: 'smuggler', trade: 'smuggler', every: true }, { trade: 'chemist' }]);
  const n = N.cook.chems * N.cook.batches;
  stock(g, 'a01', 'chems', 2 * n);
  g.grant('a02', 10 * N.rent);
  const ask = errands('a01', 1).find(e => e.kind === 'ask' && e.to === 'a02');
  assert.ok(ask, 'control: the Smuggler asks the Chemist');
  assert.equal(ask.line, sellLine('chems', n, STREET.unit));
  assert.equal(ask.line, `Selling up to ${n} chems at $${STREET.unit} each; order and I hand them over, you pay on delivery.`);
  const sd = sitdownWith(g, 'a01', 'a02').id;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  assert.deepEqual(mine(errands('a01', 2), sd), [{ kind: 'say', sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { chems: n }, cash: n * STREET.unit } }]);
});

test('a gun buyer\'s ask names the gun and its price; the order it states has that price; it takes a fitting counter and leaves one above its price (§9, §14)', async () => {
  const { gunPrice, itemLine } = await bots();
  const { g, errands } = await pair([{ type: 'cop', trade: 'cop' }, { trade: 'gunrunner' }]);
  g.grant('a01', 8 * N.shopPrice.guns);
  const price = gunPrice(g.view('a01'));
  const ask = errands('a01', 1).find(e => e.kind === 'ask' && e.to === 'a02');
  assert.ok(ask, 'control: the Cop asks the Gunrunner');
  assert.equal(ask.line, itemLine('a gun', price));
  assert.equal(ask.line, `Buying a gun for $${price}; I pay once it's handed over.`);
  const sd = sitdownWith(g, 'a01', 'a02').id;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  assert.deepEqual(mine(errands('a01', 2), sd), [buy(sd, { guns: 1 }, price)], 'it orders at the line\'s price');
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { guns: 1 }, cash: price + 10 } });
  assert.deepEqual(mine(errands('a01', 3), sd), [], 'a counter above its price it leaves');
  ok(g, 'a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { guns: 1 }, cash: price - 10 } });
  assert.deepEqual(mine(errands('a01', 3), sd), [buy(sd, { guns: 1 }, price - 10)], 'a counter under its price it takes, at the seller\'s price');
  const deal = g.view('a01').me.deals.find(d => d.sitdown === sd);
  assert.equal(deal && deal.agreed, true, 'which agrees the deal');
  stock(g, 'a02', 'guns', 1);
  ok(g, 'a02', 'give', { to: 'a01', goods: { guns: 1 } });
  g.night();
  const paid = [1, 2, 3].flatMap(r => errands('a01', r)).filter(e => e.kind === 'pay');
  assert.deepEqual(paid.map(e => [e.to, e.amount]), [['a02', price - 10]], 'and it pays the countered price once the gun comes');
});

test('a gun buyer orders on a later day of an open sit-down: its seller took the ask after its last turn (§14)', async () => {
  const { gunPrice } = await bots();
  const { g, errands } = await pair([{ type: 'cop', trade: 'cop' }, { trade: 'gunrunner' }]);
  g.grant('a01', 8 * N.shopPrice.guns);
  [1, 2, 3].forEach(r => errands('a01', r));
  const sd = sitdownWith(g, 'a01', 'a02').id;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  g.night();
  const day2 = [1, 2, 3].flatMap(r => errands('a01', r));
  assert.ok(!day2.some(e => e.kind === 'close' && e.sitdown === sd), 'it keeps the sit-down');
  assert.deepEqual(mine(day2, sd), [buy(sd, { guns: 1 }, gunPrice(g.view('a01')))], 'and orders there the next day');
});

test('a goods buyer takes a fitting counter after its order: fewer units at its price, which agrees the deal, and it pays for what comes (§10, §14)', async () => {
  const { STREET } = await bots();
  const { g, dealer, chemist, sd, want, day } = await dealerAsks();
  day(2);
  const n = want - 1;
  assert.ok(n >= 2, `control: a counter of ${n} doses`);
  ok(g, chemist, 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { temp: n }, cash: n * STREET.unit }, line: `I can do ${n}.` });
  assert.deepEqual(mine(day(3), sd), [buy(sd, { temp: n }, n * STREET.unit)], 'it takes the counter');
  const deal = g.view(dealer).me.deals.find(d => d.sitdown === sd);
  assert.deepEqual(deal && [deal.agreed, deal.goods, deal.cash, deal.role], [true, { temp: n }, n * STREET.unit, 'buyer'], 'the deal agreed is the counter');
  ok(g, chemist, 'give', { to: dealer, goods: { temp: n - 1 } });
  const paid = day(3).filter(e => e.kind === 'pay' && e.to === chemist);
  assert.deepEqual(paid.map(e => e.amount), [(n - 1) * STREET.unit], 'it pays for what came, pro rata');
});

test('a goods buyer takes a counter that comes after its last turn of the day on the next day (§14)', async () => {
  const { STREET } = await bots();
  const { g, chemist, sd, want, day, night } = await dealerAsks();
  day(2);
  day(3);
  const n = want - 1;
  ok(g, chemist, 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { temp: n }, cash: n * STREET.unit - 5 } });
  night();
  const next = day(1);
  assert.ok(!next.some(e => e.kind === 'close' && e.sitdown === sd), 'its order still waits there');
  assert.deepEqual(mine(next, sd), [buy(sd, { temp: n }, n * STREET.unit - 5)], 'it takes the counter, at the seller\'s price');
});

test('a goods buyer leaves a counter above its price, and one its budget can\'t cover (§14)', async () => {
  const { STREET } = await bots();
  {
    const { g, chemist, sd, want, day } = await dealerAsks();
    day(2);
    ok(g, chemist, 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { temp: want }, cash: want * (STREET.unit + 1) } });
    assert.deepEqual(mine(day(3), sd), [], 'above its price');
  }
  {
    const { g, dealer, chemist, sd, want, day } = await dealerAsks();
    day(2);
    ok(g, dealer, 'pay', { to: chemist, amount: g.s.agents[dealer].cash, for: 'gift' });
    ok(g, chemist, 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { temp: want - 1 }, cash: (want - 1) * STREET.unit } });
    assert.deepEqual(mine(day(3), sd), [], 'past its budget');
  }
});

test('a goods buyer answers words with no terms by stating its order again, once (§14)', async () => {
  const { STREET } = await bots();
  const { g, chemist, sd, want, day } = await dealerAsks();
  const order = buy(sd, { temp: want }, want * STREET.unit);
  assert.deepEqual(mine(day(2), sd), [order], 'control: its order');
  ok(g, chemist, 'say', { sitdown: sd, say: 'answer', terms: {}, line: 'What are you offering?' });
  assert.deepEqual(mine(day(3), sd), [order], 'it states its order again');
  ok(g, chemist, 'say', { sitdown: sd, say: 'answer', terms: {}, line: 'And what else?' });
  assert.deepEqual(mine(day(3), sd), [], 'once');
});

test('a gun buyer answers words with no terms by stating its order again, once (§14)', async () => {
  const { gunPrice } = await bots();
  const { g, errands } = await pair([{ type: 'cop', trade: 'cop' }, { trade: 'gunrunner' }]);
  g.grant('a01', 8 * N.shopPrice.guns);
  errands('a01', 1);
  const sd = sitdownWith(g, 'a01', 'a02').id;
  ok(g, 'a02', 'answer', { sitdown: sd, accept: true });
  const order = buy(sd, { guns: 1 }, gunPrice(g.view('a01')));
  assert.deepEqual(mine(errands('a01', 2), sd), [order]);
  ok(g, 'a02', 'say', { sitdown: sd, say: 'answer', terms: {}, line: 'Cash first?' });
  assert.deepEqual(mine(errands('a01', 3), sd), [order], 'it states its order again');
  ok(g, 'a02', 'say', { sitdown: sd, say: 'answer', terms: {}, line: 'Well?' });
  assert.deepEqual(mine(errands('a01', 3), sd), [], 'once');
});

test('in a bot-only season every ask carries a line inside the line limit (§14)', async () => {
  const { runSeason, mixOf } = await import('../bench/runner.mjs');
  const os = await import('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r9d-bots-'));
  try {
    runSeason({ seed: 404, rule: 'A', outDir: dir, mix: mixOf({ cast: 'models-canny', 'model-seats': '0' }), quiet: true });
    const asks = fs.readFileSync(path.join(dir, '404-A', 'events.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(e => e.type === 'ask');
    assert.ok(asks.length > 100, `control: ${asks.length} asks`);
    assert.deepEqual(asks.filter(e => !e.line || e.line.length > N['gap.lineLength']), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
