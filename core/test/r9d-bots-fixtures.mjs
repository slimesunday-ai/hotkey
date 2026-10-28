// R9d, Part A: worlds for the bot tests (r9d-bots-review.test.mjs). A bot plays from its own view against a seller
// played by hand here, as a model seat would play it; the ledger is checked after every errand and night.
import assert from 'node:assert/strict';
import { Game, ITEMS } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { rng } from '../rng.mjs';
import { N } from '../numbers.mjs';

export const bots = () => import('../bench/bots.mjs');
export const LAYLOW = { kind: 'laylow', place: 'suburbs' };
const byId = (x, y) => Number(x.id.slice(1)) - Number(y.id.slice(1));

export function ok(g, id, kind, fields) {
  const r = g.errand(id, kind, fields);
  assert.equal(r.ok, true, `day ${g.s.day}: ${id}'s ${kind} went through (${r.why})`);
  return r;
}
export const apply = (g, id, out) => out.forEach(({ kind, ...e }) => ok(g, id, kind, e));
export const mine = (out, sd) => out.filter(e => e.sitdown === sd);
export const buy = (sd, goods, cash) => ({ kind: 'say', sitdown: sd, say: 'offer', terms: { what: 'buy', goods, cash } });
export function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}

// A season of `castName` in the helpers' Game, every agent with the rent to the ferry twice over: `seat(id)` is a bot's
// config as the runner hands it over, `workers(trade)` the seats that work a trade, `player(id)` a bot whose
// `day(round)` plays its day and applies it, `night()` settles a night with everyone laying low.
export async function world(castName, seed = 404) {
  const { makeCast, makeBot, CASTS } = await bots();
  const cast = makeCast(seed, CASTS[castName]);
  const g = new Game({ n: 1 });
  const r = newSeason({ seed, rule: 'A', midseason: 'payday', items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  Object.keys(g.s.agents).forEach(id => g.grant(id, 2 * N.nights * N.rent));
  const every = cast.some(c => c.works);
  const seat = id => ({ ...cast.find(c => c.id === id), ...(every ? { every } : {}) });
  const workers = trade => cast.filter(c => c.trade === trade && (c.type === trade || c.works)).sort(byId);
  const player = id => {
    const bot = makeBot(seat(id), {});
    return {
      day: round => {
        const out = bot.day(g.view(id), { seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', id, g.s.day, round) });
        apply(g, id, out);
        return out;
      },
    };
  };
  return { g, cast, seat, workers, player, night: (plays = {}) => g.night(plays, { filler: LAYLOW }) };
}

// The canny cast on day 3: a Dealer bot asks the stocked Chemist, played by hand. With `taken`, the Chemist takes the
// ask before the Dealer's second round, so the Dealer orders; else it hasn't answered by the Dealer's last turn.
// `want`: what the Dealer is short of.
export async function dealerAsks({ taken = true } = {}) {
  const w = await world('canny');
  const { g, workers, player } = w;
  const dealer = workers('dealer').find(c => c.type === 'dealer').id;
  const chemist = workers('chemist').find(c => c.type === 'chemist').id;
  stock(g, chemist, 'temp', workers('dealer').length * N.deal.held);
  while (g.s.day < 3) w.night();
  const want = N.deal.held - (g.s.agents[dealer].goods.temp || 0);
  const bot = player(dealer);
  assert.equal(bot.day(1).filter(e => e.kind === 'ask' && e.to === chemist).length, 1, 'control: the Dealer asks the stocked Chemist');
  const sd = g.view(dealer).me.sitdowns.find(x => x.with === chemist).id;
  if (taken) ok(g, chemist, 'answer', { sitdown: sd, accept: true });
  const said = [...mine(bot.day(2), sd), ...mine(bot.day(3), sd)];
  return { ...w, dealer, chemist, sd, want, said, day: bot.day };
}
