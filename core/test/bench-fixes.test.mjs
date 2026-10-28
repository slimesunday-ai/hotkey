// L4-4b, two fixes to the $0 bench's bots (GAME.md §9, §12, §13, §14, §25); no rule changes, and no model is called.
// - Warrants: a seat that sells them takes a crew's leader's ask, whatever the leader's trade, while a job on the vault
//   looks worth it. An ask names no subject, and the gun-selling code left a Smuggler's ask to the goods code, which
//   answers one only when it wants parts, so a Smuggler leader's ask for a warrant mostly went unanswered. The seat still
//   answers a parts sale as before, and once it wants parts it orders them in a sit-down it took that way, so a Smuggler
//   leader that sells it parts loses no sale: one sit-down carries both.
// - The buy-late saver bids out of the cash it has once its bail is paid, not the cash it had before, in every cast.
// Each test imports what it needs itself, so each fails on its own before the fixes exist. Amounts come from N, the
// bots' functions or the state a test set up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods } from '../rules/state.mjs';
import { N } from '../numbers.mjs';
import { rng } from '../rng.mjs';

const bots = () => import('../bench/bots.mjs');
const LAYLOW = { kind: 'laylow', place: 'suburbs' };
const RANK = { common: 0, rare: 1, epic: 2, grail: 3 };

// A season with a cast in the helpers' Game, so every errand and night goes through the rules with the ledger checked.
// `seat(id)` is a bot's config as the runner hands it over, `ctx` its context for a round, and `rest(day)` settles the
// nights to that day with everyone laying low. Every agent gets the rent to the ferry twice over, so nobody is evicted.
async function world(seed, castName = 'layer4') {
  const { makeCast, CASTS } = await bots();
  const cast = makeCast(seed, CASTS[castName]);
  const every = cast.some(c => c.works);
  const g = new Game({ n: 1 });
  const r = newSeason({ seed, rule: 'A', midseason: 'payday', items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  g.cast = cast;
  g.seat = id => ({ ...cast.find(c => c.id === id), ...(every ? { every } : {}) });
  g.ctx = (id, round) => ({ seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', id, g.s.day, round) });
  g.rest = day => {
    while (g.s.day < day) g.night({}, { filler: LAYLOW });
  };
  Object.keys(g.s.agents).forEach(id => g.grant(id, 2 * N.nights * N.rent));
  return g;
}
// Test-only goods and vault cash, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
function vaultHolds(g, cash) {
  g.s.money.in.test = (g.s.money.in.test || 0) + cash;
  g.s.vault.cash += cash;
  checkLedger(g.s, 'vault');
}
// The cast's crews, formed on day 1 as their leaders form them.
function formCrews(g) {
  for (const c of g.cast.filter(x => x.type === 'crew' && x.role === 'leader')) {
    g.errand(c.id, 'crew_form', { name: c.crewName });
    for (const m of c.mates) {
      g.errand(c.id, 'crew_invite', { agent: m });
      g.errand(m, 'crew_join', { crew: g.s.agents[c.id].crew });
    }
  }
}
// A crew one stronger than the vault's flat defence by the public record: guns for its first members, stocked before
// night 1, so the holdings records show them from day 3.
function armCrew(g, crew) {
  const guns = N.vault.defence + 1 - crew.length;
  assert.ok(guns >= 0 && guns <= crew.length, `a crew of ${crew.length} can't be ${N.vault.defence + 1} strong`);
  crew.slice(0, guns).forEach(m => stock(g, m, 'guns', 1));
}
// A seat that sells warrants and fakes: one that works the Gunrunner trade, its own bot or a strategy that works it.
const wares = c => c.trade === 'gunrunner' && (c.type === 'gunrunner' || !!c.works);
// A crew's leader that works the Smuggler trade, with a seat that sells warrants outside its crew, or null.
const smugglerLeader = cast => cast.find(c => c.type === 'crew' && c.role === 'leader' && c.trade === 'smuggler' && cast.some(x => wares(x) && !c.mates.includes(x.id))) || null;
// The first seed from 404 on whose layer4 cast has what a test needs.
async function seedWith(pred) {
  const { makeCast, CASTS } = await bots();
  for (let seed = 404; seed < 504; seed++) if (pred(makeCast(seed, CASTS.layer4))) return seed;
  throw new Error('no seed in 404-503 has it');
}
// `by`'s sit-down with `to` today, as the rules hold it.
const sitdown = (g, by, to) => Object.values(g.s.sitdowns).find(x => x.a === by && x.b === to);
// The errands a bot returns that touch one sit-down.
const about = (errands, sd) => errands.filter(e => e.sitdown === sd);

test("warrants: a seat that sells them takes a crew's leader's ask while a job on the vault looks worth it, whatever the leader's trade, so a Smuggler leader's ask opens though the seat wants no parts; a Smuggler's that leads no crew, and any ask while no job looks worth it, stay the goods code's (§9, §12, §14)", async () => {
  const { makeBot, remember } = await bots();
  const seed = await seedWith(cast => !!smugglerLeader(cast) && cast.some(c => c.type === 'smuggler'));
  for (const worth of [true, false]) {
    const g = await world(seed);
    const lead = smugglerLeader(g.cast);
    const crew = [lead.id, ...lead.mates];
    const seller = g.cast.find(c => wares(c) && !crew.includes(c.id)).id;
    const loner = g.cast.find(c => c.type === 'smuggler').id;
    formCrews(g);
    armCrew(g, crew);
    // The seller holds its one unsold gun and a warrant for each crew on the board, so it wants no parts.
    stock(g, seller, 'guns', 1);
    stock(g, seller, 'warrants', g.view(seller).board.crews.length);
    // What it saw on day 1, as every seat looks at its view each day: who formed each crew.
    const memo = {};
    remember(g.view(seller), memo);
    g.rest(4);
    if (worth) vaultHolds(g, 10 * N.price.rare[0]);
    g.errand(lead.id, 'ask', { to: seller });
    g.errand(loner, 'ask', { to: seller });
    const [mine, other] = [sitdown(g, lead.id, seller).id, sitdown(g, loner, seller).id];
    const out = makeBot(g.seat(seller), memo).day(g.view(seller), g.ctx(seller, 1));
    assert.deepEqual(about(out, other), [], "a Smuggler that leads no crew is selling parts, which the seller doesn't want");
    if (!worth) {
      assert.deepEqual(about(out, mine), [], 'no job looks worth it: the leader is selling parts too');
      continue;
    }
    assert.deepEqual(about(out, mine), [{ kind: 'answer', sitdown: mine, accept: true }], "the crew's leader may want a warrant");
    g.errand(seller, 'answer', { sitdown: mine, accept: true });
    assert.equal(sitdown(g, lead.id, seller).state, 'open', 'its leader can order one now');
  }
});

test("warrants: a Smuggler leader that sells parts loses no sale to its ask for a warrant: a seat that wants parts answers the ask with an order, as before; one that took it for a warrant orders parts in it once it wants them, and the leader hands them over, in one sit-down with its warrant order (§9, §14)", async () => {
  const { makeBot, remember, warrantPrice, STREET } = await bots();
  const seed = await seedWith(cast => !!smugglerLeader(cast));
  for (const wants of [true, false]) {
    const g = await world(seed);
    const lead = smugglerLeader(g.cast);
    const crew = [lead.id, ...lead.mates];
    const sellers = g.cast.filter(c => wares(c) && !crew.includes(c.id)).map(c => c.id);
    const seller = sellers[sellers.length - 1];
    formCrews(g);
    armCrew(g, crew);
    // Every other Gunrunner shows more parts on its record, so this seller isn't the one that keeps warrants in stock.
    // It hands its kit's parts on and holds no warrant; it holds its one unsold gun, or, wanting parts, none.
    g.cast.filter(c => c.trade === 'gunrunner' && c.id !== seller).forEach(c => stock(g, c.id, 'parts', N.build.warrants));
    const kit = g.s.agents[seller].goods.parts || 0;
    if (kit) g.errand(seller, 'give', { to: g.cast.find(c => c.type === 'hustle').id, goods: { parts: kit } });
    if (!wants) stock(g, seller, 'guns', 1);
    // The leader holds a haul of parts to sell.
    stock(g, lead.id, 'parts', N.build.warrants);
    const memo = {};
    remember(g.view(seller), memo);
    g.rest(4);
    vaultHolds(g, 10 * N.price.rare[0]);
    const bot = makeBot(g.seat(seller), memo);
    const apply = out => out.forEach(({ kind, ...e }) => g.errand(seller, kind, e));
    g.errand(lead.id, 'ask', { to: seller });
    const sd = sitdown(g, lead.id, seller).id;
    const round1 = about(bot.day(g.view(seller), g.ctx(seller, 1)), sd);
    const parts = say => say.kind === 'say' && say.say === 'offer' && say.terms.goods && say.terms.goods.parts > 0 && say.terms.cash === say.terms.goods.parts * STREET.unit;
    if (wants) {
      assert.deepEqual(round1.map(e => e.kind), ['answer', 'say'], 'answered with an order, as before');
      assert.ok(parts(round1[1]), JSON.stringify(round1[1]));
      continue;
    }
    assert.deepEqual(round1, [{ kind: 'answer', sitdown: sd, accept: true }], 'taken for a warrant, with no order for parts');
    apply(round1);
    // The leader orders its warrant; the seller has none, so it says so, and builds one tonight from parts it needs.
    g.errand(lead.id, 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { warrants: 1 }, cash: warrantPrice(g.view(lead.id)), night: g.s.day + 1 } });
    const round2 = about(bot.day(g.view(seller), g.ctx(seller, 2)), sd);
    assert.deepEqual(round2.map(e => [e.kind, e.say, e.terms && e.terms.cash]), [['say', 'answer', 0]], 'it has no warrant to hand over');
    apply(round2);
    const round3 = about(bot.day(g.view(seller), g.ctx(seller, 3)), sd);
    assert.equal(round3.length, 1, JSON.stringify(round3));
    assert.ok(parts(round3[0]), `an order for parts in the same sit-down: ${JSON.stringify(round3[0])}`);
    apply(round3);
    const ordered = round3[0].terms.goods.parts;
    const before = g.s.agents[seller].goods.parts || 0;
    const sale = makeBot(g.seat(lead.id), {}).day(g.view(lead.id), g.ctx(lead.id, 3)).filter(e => e.kind === 'give' && e.to === seller);
    assert.deepEqual(sale, [{ kind: 'give', to: seller, goods: { parts: Math.min(ordered, N.build.warrants) } }], 'the leader hands the parts over');
    sale.forEach(({ kind, ...e }) => g.errand(lead.id, kind, e));
    assert.equal(g.s.agents[seller].goods.parts, before + sale[0].goods.parts);
  }
});

test("the buy-late saver bids out of the cash it has once it has paid its bail, in every cast: after its bail it can't afford the cheapest rare on the list, so no bid it makes is refused (§3, §13, §25)", async () => {
  const { makeBot, CASTS } = await bots();
  for (const name of Object.keys(CASTS)) {
    for (const day of [N.listLastNight - 1, N.listLastNight]) {
      const g = await world(404, name);
      g.rest(day);
      const b = g.cast.find(c => c.type === 'buylate').id;
      const open = g.view(b).board.list.filter(t => t.opens <= day && t.left > 0 && RANK[t.tier] >= RANK.rare);
      const rare = Math.min(...open.map(t => t.price));
      assert.ok(open.length && rare > 0, 'control: a rare on sale');
      // A night in jail at one star, with a dollar less than the cheapest rare once the bail is paid.
      g.s.agents[b].jail = { nights: N.jailNights, stars: 1, since: day - 1 };
      const bail = N.bailPerStar;
      const want = rare + bail - 1;
      const have = g.s.agents[b].cash;
      if (have < want) g.grant(b, want - have);
      else if (have > want) g.errand(b, 'pay', { to: g.cast.find(c => c.id !== b).id, amount: have - want, for: 'deal' });
      const out = makeBot(g.seat(b), {}).day(g.view(b), g.ctx(b, 1));
      const refused = [];
      for (const { kind, ...e } of out) {
        const r = g.errand(b, kind, e);
        refused.push(...r.events.filter(x => x.type === 'invalid').map(x => `${kind}: ${x.why}`));
      }
      assert.equal(g.s.agents[b].jail, null, `${name}, day ${day}: it pays its bail`);
      assert.deepEqual(refused, [], `${name}, day ${day}: every errand goes through`);
      const bids = out.filter(e => e.kind === 'offer').map(e => e.amount);
      assert.ok(bids.every(x => x <= want - bail), `${name}, day ${day}: bids ${bids} out of ${want - bail} after the bail`);
    }
  }
});
