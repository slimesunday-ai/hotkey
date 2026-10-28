// R9 review fix 1 (the orchestrator, 10-19): agree sends the seat's own side of the offer, so the bench's bots, which
// read a deal from the buyer's words, carry it through in both directions. With the canny cast's own bots (makeBot):
// - a seat buying agrees a bot smuggler's offer to sell chems, and the bot hands the chems over in its next round;
// - a seat selling agrees a bot dealer's offer to buy doses, hands them over, and the bot pays.
// The setup is the reviewer's (botsell.mjs, botbuy.mjs). Nothing here calls a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { rng } from '../rng.mjs';
import { makeCast, makeBot, CASTS } from '../bench/bots.mjs';

const seed = 418;
function canny() {
  const cast = makeCast(seed, CASTS.canny);
  const g = new Game({ n: 1 });
  const r = newSeason({ seed, rule: 'A', midseason: 'payday', items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  Object.assign(g, { s: r.state, log: [...r.events] });
  for (const id of Object.keys(g.s.agents)) g.grant(id, 200);
  return { g, cast };
}
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
// A bot's round for one agent, its errands in its sit-down with `other` applied through the rules.
function round(g, bot, id, other, sd, n) {
  const out = bot.day(g.view(id), { seed, day: g.s.day, round: n, rounds: 3, rng: rng(seed, 'bot', id, g.s.day, n) })
    .filter(e => e.sitdown === sd || e.to === other);
  for (const { kind, ...e } of out) assert.equal(g.errand(id, kind, e).ok, true, `${id} ${kind}`);
  return out;
}

test('a seat buying agrees a bot smuggler\'s offer to sell; the bot hands the goods over in its next round', () => {
  const { g, cast } = canny();
  const sm = cast.find(c => c.type === 'smuggler' && c.trade === 'smuggler');
  stock(g, sm.id, 'chems', 6);
  const bot = makeBot({ ...sm, canny: true }, {});
  // The bot's own first round: it asks the agents it sells to; the seat is a Chemist it asked.
  const asks = bot.day(g.view(sm.id), { seed, day: g.s.day, round: 1, rounds: 3, rng: rng(seed, 'bot', sm.id, g.s.day, 1) }).filter(e => e.kind === 'ask');
  for (const { kind, ...e } of asks) g.errand(sm.id, kind, e);
  const chem = { id: asks.map(e => e.to).find(id => g.s.agents[id].trade === 'chemist') };
  assert.ok(chem.id, 'control: the bot asked a Chemist');
  const sd = Object.values(g.s.sitdowns).find(x => x.a === sm.id && x.b === chem.id).id;
  g.errand(chem.id, 'answer', { sitdown: sd, accept: true });
  round(g, bot, sm.id, chem.id, sd, 2);
  const offer = g.s.deals.find(d => d.sitdown === sd);
  assert.deepEqual([offer.by, offer.seller, offer.buyer], [sm.id, sm.id, chem.id], 'control: the bot offers to sell');
  const before = g.s.agents[chem.id].goods.chems || 0;
  assert.equal(g.errand(chem.id, 'say', { sitdown: sd, agree: true }).ok, true);
  assert.equal(g.log.filter(e => e.type === 'say' && e.from === chem.id).at(-1).terms.what, 'trade', 'the seat says its own side: a buy');
  assert.equal(g.s.deals.find(d => d.sitdown === sd).agreed, true);
  const gave = round(g, bot, sm.id, chem.id, sd, 3);
  assert.deepEqual(gave.map(e => [e.kind, e.to, e.goods]), [['give', chem.id, offer.goods]], 'the bot delivers');
  assert.equal(g.s.agents[chem.id].goods.chems, before + offer.goods.chems);
});

test('a seat selling agrees a bot dealer\'s offer to buy, hands the goods over, and the bot pays', () => {
  const { g, cast } = canny();
  const dl = cast.find(c => c.type === 'dealer');
  const chem = cast.find(c => c.trade === 'chemist');
  stock(g, chem.id, 'temp', 5);
  const bot = makeBot({ ...dl, canny: true }, {});
  g.errand(chem.id, 'ask', { to: dl.id });
  const sd = Object.values(g.s.sitdowns).find(x => x.a === chem.id && x.b === dl.id).id;
  round(g, bot, dl.id, chem.id, sd, 1);
  const offer = g.s.deals.find(d => d.sitdown === sd);
  assert.deepEqual([offer.by, offer.buyer, offer.seller], [dl.id, dl.id, chem.id], 'control: the bot offers to buy');
  assert.equal(g.errand(chem.id, 'say', { sitdown: sd, agree: true }).ok, true);
  assert.equal(g.log.filter(e => e.type === 'say' && e.from === chem.id).at(-1).terms.what, 'sell', 'the seat says its own side: a sell');
  assert.equal(g.s.deals.find(d => d.sitdown === sd).agreed, true);
  assert.equal(g.errand(chem.id, 'give', { to: dl.id, goods: offer.goods, sitdown: sd }).ok, true);
  const cash = g.s.agents[chem.id].cash;
  const paid = round(g, bot, dl.id, chem.id, sd, 2);
  assert.deepEqual(paid.map(e => [e.kind, e.to, e.amount]), [['pay', chem.id, offer.cash]], 'the bot pays');
  assert.equal(g.s.agents[chem.id].cash, cash + offer.cash);
});
