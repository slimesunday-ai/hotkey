// R9d, Part A, item 2 as the orchestrator's option (b) (docs/briefs/R9d-trade-you-can-read.md): a goods buyer bot's ask
// that its seller took with words and no terms after the bot's last turn of the day (the check season's s21, s48 and
// s60: a model seller's question, after which the bot never ordered and closed the sit-down the next morning) stays
// open a day past those words, and the bot states its order there once. Nothing else about when a bot closes a
// sit-down changes: an unanswered ask, or one taken with no words, still closes the next morning. Bots never speak
// without terms, so a bot-only season never takes this path (r9d-bots-invariance.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { rng } from '../rng.mjs';
import { N } from '../numbers.mjs';

const bots = () => import('../bench/bots.mjs');
const LAYLOW = { kind: 'laylow', place: 'suburbs' };
const byId = (x, y) => Number(x.id.slice(1)) - Number(y.id.slice(1));

function ok(g, id, kind, fields) {
  const r = g.errand(id, kind, fields);
  assert.equal(r.ok, true, `day ${g.s.day}: ${id}'s ${kind} went through (${r.why})`);
  return r;
}
const apply = (g, id, out) => out.forEach(({ kind, ...e }) => ok(g, id, kind, e));
const mine = (out, sd) => out.filter(e => e.sitdown === sd);

// The canny cast, every agent with the rent to the ferry twice over, on day 3: a Dealer bot asks the stocked Chemist,
// played by hand as a model seat would play it, and plays out its day's three rounds before the Chemist answers (with
// `taken`, the Chemist takes the ask, with no words, before the Dealer's second round). `day(round)` plays the Dealer's
// day and applies it; `want` is what it is short of; `said` is what the Dealer sent in the sit-down on that day.
async function askedAndLeft({ taken = false } = {}) {
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
  const n = workers('dealer').length * N.deal.held;
  addGoods(g.s.agents[chemist], 'temp', n);
  bookGoods(g.s, 'in', 'test', 'temp', n);
  checkLedger(g.s, 'stock');
  while (g.s.day < 3) g.night({}, { filler: LAYLOW });
  const want = N.deal.held - (g.s.agents[dealer].goods.temp || 0);
  const memo = {};
  const bot = makeBot(seat(dealer), memo);
  const day = round => {
    const out = bot.day(g.view(dealer), { seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', dealer, g.s.day, round) });
    apply(g, dealer, out);
    return out;
  };
  const first = day(1);
  assert.equal(first.filter(e => e.kind === 'ask' && e.to === chemist).length, 1, 'control: the Dealer asks the stocked Chemist');
  const sd = g.view(dealer).me.sitdowns.find(x => x.with === chemist).id;
  if (taken) ok(g, chemist, 'answer', { sitdown: sd, accept: true });
  const said = [...mine(day(2), sd), ...mine(day(3), sd)];
  if (!taken) assert.deepEqual(said, [], 'control: the Chemist hasn\'t answered by its last turn');
  return { g, dealer, chemist, sd, want, day, said, night: () => g.night({}, { filler: LAYLOW }) };
}
const order = (sd, want, unit) => ({ kind: 'say', sitdown: sd, say: 'offer', terms: { what: 'buy', goods: { temp: want }, cash: want * unit } });

// The words the check season's model sellers took a bot's ask with (418-A, the tape), all of them with no terms.
const SHAPES = [
  ['s21', "Smuggler here. I'll have chems from forest after tonight's lock. What price are you paying per chem?"],
  ['s48', 'Accepted. What are you looking to discuss?'],
  ['s60', "I'll hear you out, but I won't hand over goods or cash on promises."],
];
for (const [name, line] of SHAPES) {
  test(`${name}'s shape: a seller takes a goods buyer's ask with words and no terms after the bot's last turn; the next day the bot keeps the sit-down and states its order there, once (§14)`, async () => {
    const { STREET } = await bots();
    const { g, chemist, sd, want, day, night } = await askedAndLeft();
    ok(g, chemist, 'answer', { sitdown: sd, accept: true, line });
    night();
    const next = day(1);
    assert.ok(!next.some(e => e.kind === 'close' && e.sitdown === sd), 'it keeps the sit-down');
    assert.deepEqual(mine(next, sd), [order(sd, want, STREET.unit)], 'and states its order there');
    assert.deepEqual([...mine(day(2), sd), ...mine(day(3), sd)], [], 'once');
    ok(g, chemist, 'say', { sitdown: sd, say: 'answer', terms: {}, line: 'Cash first?' });
    assert.deepEqual(mine(day(3), sd), [], 'a question after that gets no second statement: it stated once');
  });
}

test('a seller\'s question after the bot ordered and after its last turn gets the order again the next day, once (§14)', async () => {
  const { STREET } = await bots();
  const { g, chemist, sd, want, day, said, night } = await askedAndLeft({ taken: true });
  assert.deepEqual(said, [order(sd, want, STREET.unit)], 'control: it ordered on the ask\'s day');
  ok(g, chemist, 'say', { sitdown: sd, say: 'answer', terms: {}, line: 'What are you offering?' });
  night();
  const next = day(1);
  assert.ok(!next.some(e => e.kind === 'close' && e.sitdown === sd), 'its order still waits there');
  assert.deepEqual(mine(next, sd), [order(sd, want, STREET.unit)], 'it states its order again');
  assert.deepEqual([...mine(day(2), sd), ...mine(day(3), sd)], [], 'once');
});

test('an ask its seller never answered, or took with no words, still closes the next morning (§14)', async () => {
  {
    const { sd, day, night } = await askedAndLeft();
    night();
    assert.ok(day(1).some(e => e.kind === 'close' && e.sitdown === sd), 'unanswered');
  }
  {
    const { g, chemist, sd, day, night } = await askedAndLeft();
    ok(g, chemist, 'answer', { sitdown: sd, accept: true });
    night();
    assert.ok(day(1).some(e => e.kind === 'close' && e.sitdown === sd), 'taken with no words');
  }
});

test('a held ask the bot can\'t order in the next day closes the morning after: it is kept a day past the words, no longer (§14)', async () => {
  const { g, dealer, chemist, sd, day, night } = await askedAndLeft();
  ok(g, chemist, 'answer', { sitdown: sd, accept: true, line: 'What are you looking to discuss?' });
  night();
  ok(g, dealer, 'pay', { to: chemist, amount: g.s.agents[dealer].cash, for: 'gift' });
  const next = [1, 2, 3].flatMap(day);
  assert.ok(!next.some(e => e.kind === 'close' && e.sitdown === sd), 'control: kept the day after the words');
  assert.deepEqual(mine(next, sd), [], 'control: with no cash it orders nothing');
  night();
  assert.ok(day(1).some(e => e.kind === 'close' && e.sitdown === sd), 'the morning after, it closes');
});
