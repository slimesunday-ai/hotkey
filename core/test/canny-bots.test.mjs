// R3-6, the traders' habits (trunk docs/briefs/R3-crime-pays.md, task 7): the canny cast, the crime cast's seats with its
// trade seats and crews playing as a sensible trader plays, each from its own view (bots.mjs, the R3-6 section). No rule
// changes, and no model is called. Every test drives the bots through the rules (the helpers' Game, the ledger checked
// after every errand and night), reads its amounts from N or from what the bots trade at, and pins what a sensible
// player does, not a number the bench happens to give.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods } from '../rules/state.mjs';
import { N } from '../numbers.mjs';
import { rng } from '../rng.mjs';

const bots = () => import('../bench/bots.mjs');
const LAYLOW = { kind: 'laylow', place: 'suburbs' };
const num = id => Number(id.slice(1));
const byId = (x, y) => num(x.id) - num(y.id);

// A season with the canny cast in the helpers' Game: `seat(id)` is a bot's config as the runner hands it over, `ctx` its
// context for a round, `rest(day)` settles the nights to that day with everyone laying low. With `cash`, every agent gets
// the rent to the ferry twice over first, so nobody is evicted.
async function world(seed = 404, { cash = true } = {}) {
  const { makeCast, CASTS } = await bots();
  const cast = makeCast(seed, CASTS.canny);
  const every = cast.some(c => c.works);
  const g = new Game({ n: 1 });
  const r = newSeason({ seed, rule: 'A', midseason: 'payday', items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  g.cast = cast;
  g.seat = id => ({ ...cast.find(c => c.id === id), ...(every ? { every } : {}) });
  g.ctx = (id, round) => ({ seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', id, g.s.day, round) });
  g.rest = (day, plays = {}) => {
    while (g.s.day < day) g.night(typeof plays === 'function' ? plays(g.s.day) : plays, { filler: LAYLOW });
  };
  if (cash) Object.keys(g.s.agents).forEach(id => g.grant(id, 2 * N.nights * N.rent));
  return g;
}
// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
// Test-only goods out, through a named sink, so the books still balance: what an agent holds of a kind.
function unstock(g, id, kind) {
  const n = g.s.agents[id].goods[kind] || 0;
  if (!n) return;
  addGoods(g.s.agents[id], kind, -n);
  const t = (g.s.goods.out.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'unstock');
}
// Every seat that works a trade, its own bot or a strategy that works it on its free nights, in id order.
const workers = (g, trade) => g.cast.filter(c => c.trade === trade && (c.type === trade || c.works)).sort(byId);
// The first seed from 404 whose canny cast has what a test needs.
async function seedWith(pred) {
  const { makeCast, CASTS } = await bots();
  for (let seed = 404; seed < 504; seed++) if (pred(makeCast(seed, CASTS.canny))) return seed;
  throw new Error('no seed in 404-503 has it');
}
const apply = (g, id, out) => out.forEach(({ kind, ...e }) => g.errand(id, kind, e));
const sitdown = (g, by, to) => Object.values(g.s.sitdowns).find(x => x.a === by && x.b === to);

test('the canny cast is the crime cast\'s seats, roles and habits, with the traders\' habits on: the same seed deals the same seats, and the bench names it', async () => {
  const { makeCast, CASTS } = await bots();
  const { mixOf, castName } = await import('../bench/runner.mjs');
  assert.ok(CASTS.canny, 'a cast called canny');
  assert.equal(mixOf({ cast: 'canny' }), CASTS.canny);
  assert.equal(castName(CASTS.canny), 'canny');
  assert.equal(castName(CASTS.crime), 'crime', 'the crime cast keeps its name');
  for (let seed = 404; seed < 444; seed++) {
    const canny = makeCast(seed, CASTS.canny);
    assert.ok(canny.every(c => c.canny && c.sharp), `${seed}: every seat plays the habits`);
    assert.deepEqual(canny.map(({ canny: _, ...c }) => c), makeCast(seed, CASTS.crime), `${seed}: the crime cast's seats`);
  }
});

test('supply: a Dealer short of a night\'s doses asks, in its first round, the Chemist its view shows holding most; the Chemist takes the ask and says what it can sell, a night\'s doses at most; the Dealer orders there and the Chemist hands the doses over (§9, §10, §14)', async () => {
  const { makeBot, STREET } = await bots();
  const g = await world();
  const dealer = workers(g, 'dealer').find(c => c.type === 'dealer').id;
  const chemists = workers(g, 'chemist');
  const stocked = chemists.find(c => c.type === 'chemist').id;
  // Its public holdings record shows more doses than every Dealer on the board deals in a night.
  stock(g, stocked, 'temp', workers(g, 'dealer').length * N.deal.held);
  g.rest(3);
  const want = N.deal.held - (g.s.agents[dealer].goods.temp || 0);
  assert.ok(want >= 1, 'control: the Dealer is short of a held corner\'s doses');
  const buyer = makeBot(g.seat(dealer), {});
  const asks = buyer.day(g.view(dealer), g.ctx(dealer, 1)).filter(e => e.kind === 'ask');
  assert.ok(asks.some(e => e.to === stocked), `it asks the stocked Chemist: ${JSON.stringify(asks)}`);
  assert.ok(asks.every(e => chemists.some(c => c.id === e.to)), 'it asks Chemists only');
  apply(g, dealer, asks.filter(e => e.to === stocked));
  const sd = sitdown(g, dealer, stocked).id;
  const seller = makeBot(g.seat(stocked), {});
  const took = seller.day(g.view(stocked), g.ctx(stocked, 2)).filter(e => e.sitdown === sd);
  const lot = Math.min(N.deal.held, g.s.agents[stocked].goods.temp);
  assert.deepEqual(took, [
    { kind: 'answer', sitdown: sd, accept: true },
    { kind: 'say', sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { temp: lot }, cash: lot * STREET.unit } },
  ], 'it takes the ask and says what it can sell there');
  apply(g, stocked, took);
  const order = buyer.day(g.view(dealer), g.ctx(dealer, 2)).filter(e => e.sitdown === sd);
  assert.deepEqual(order, [{ kind: 'say', sitdown: sd, say: 'offer', terms: { what: 'buy', goods: { temp: want }, cash: want * STREET.unit } }], 'the Dealer orders what it still wants');
  apply(g, dealer, order);
  const before = g.s.agents[dealer].goods.temp || 0;
  apply(g, stocked, seller.day(g.view(stocked), g.ctx(stocked, 3)).filter(e => e.kind === 'give' || e.sitdown === sd));
  assert.equal(g.s.agents[dealer].goods.temp, before + want, 'the doses are handed over');
});

test('supply: a seller holding none of what a buyer asks it for says no, so the buyer isn\'t left waiting (§14)', async () => {
  const { makeBot } = await bots();
  const g = await world();
  const dealer = workers(g, 'dealer').find(c => c.type === 'dealer').id;
  const chemist = workers(g, 'chemist').find(c => c.type === 'chemist').id;
  g.rest(3);
  assert.equal(g.s.agents[chemist].goods.temp || 0, 0, 'control: it holds no doses');
  g.errand(dealer, 'ask', { to: chemist });
  const sd = sitdown(g, dealer, chemist).id;
  const out = makeBot(g.seat(chemist), {}).day(g.view(chemist), g.ctx(chemist, 2)).filter(e => e.sitdown === sd);
  assert.deepEqual(out, [{ kind: 'answer', sitdown: sd, accept: false }]);
});

test('work to demand: a Smuggler runs a drop while its buyers are short, and takes a shift when what it holds already covers what they take, since a run\'s haul would only go to the city\'s buyer (§9)', async () => {
  const { makeBot } = await bots();
  const seed = await seedWith(cast => cast.filter(c => c.trade === 'smuggler' && (c.type === 'smuggler' || c.works)).sort(byId)[0].type === 'smuggler');
  for (const held of [0, 3 * N.dropUnits]) {
    const g = await world(seed);
    const smuggler = workers(g, 'smuggler')[0].id;
    if (held) stock(g, smuggler, 'chems', held);
    g.rest(3);
    const { play } = makeBot(g.seat(smuggler), {}).night(g.view(smuggler), g.ctx(smuggler, 'night'));
    if (!held) {
      assert.equal(play.kind, 'run', `holding none, it runs: ${JSON.stringify(play)}`);
      assert.equal(N.drops[play.place], 'chems', 'the lowest id takes a chems drop nobody holds (the street runs on chems)');
    } else assert.equal(play.kind, 'hustle', `holding ${held} chems, it takes a shift: ${JSON.stringify(play)}`);
  }
});

test('work to demand: the Smugglers share out the drops by the show: two seen at one drop last night, the lower id keeps it and the other takes a drop nobody was seen at (§6, §9)', async () => {
  const { makeBot } = await bots();
  const seed = await seedWith(cast => cast.filter(c => c.type === 'smuggler').length >= 2);
  const g = await world(seed);
  const [first, second] = g.cast.filter(c => c.type === 'smuggler').sort(byId).map(c => c.id);
  const drop = Object.keys(N.drops).filter(d => N.drops[d] === 'chems').sort()[0];
  g.rest(2, { [first]: { kind: 'run', place: drop }, [second]: { kind: 'run', place: drop } });
  g.rest(3, { [first]: { kind: 'run', place: drop }, [second]: { kind: 'run', place: drop } });
  const seen = id => g.view(id).sightings[id].find(x => x.night === g.s.day - 1);
  assert.equal(seen(first).place, drop, 'control: the show saw both there');
  assert.equal(seen(second).place, drop, 'control: the show saw both there');
  // Their shared hauls are sold, so each holds nothing and its buyers are short.
  for (const id of [first, second]) unstock(g, id, 'chems');
  const play = id => makeBot(g.seat(id), {}).night(g.view(id), g.ctx(id, 'night')).play;
  const [p1, p2] = [play(first), play(second)];
  assert.deepEqual([p1.kind, p1.place], ['run', drop], 'the lower id keeps the drop');
  assert.equal(p2.kind, 'run', JSON.stringify(p2));
  assert.notEqual(p2.place, drop, 'the other leaves it');
  assert.equal(N.drops[p2.place], 'chems', 'for the other chems drop, which nobody was seen at');
});

test('work to demand: a Chemist cooks the batches its buyers will take and takes a shift when its doses cover them; it cooks nothing whose doses couldn\'t reach a Dealer before the last corner night (§9, §15)', async () => {
  const { makeBot } = await bots();
  for (const [day, doses, cooks] of [[3, 0, true], [3, 3 * N.cook.batches * N.cook.doses * N.deal.held, false], [N.nights - 1, 0, false]]) {
    const g = await world();
    const chemist = workers(g, 'chemist').find(c => c.type === 'chemist').id;
    if (doses) stock(g, chemist, 'temp', doses);
    g.rest(day);
    stock(g, chemist, 'chems', N.cook.batches * N.cook.chems);
    const { play } = makeBot(g.seat(chemist), {}).night(g.view(chemist), g.ctx(chemist, 'night'));
    assert.equal(play.kind, cooks ? 'cook' : 'hustle', `night ${day}, holding ${doses} doses: ${JSON.stringify(play)}`);
    if (cooks) assert.ok(play.batches >= 1 && play.batches <= N.cook.batches);
  }
});

test('rent: on night 1, with no cash for the rent, a Chemist cooks its kit\'s batch for the Dealers and runs a night\'s tab, unless it holds a rare piece an evicted agent would carry; a Gunrunner\'s build still gives way to a shift (§9, §10)', async () => {
  const { makeBot } = await bots();
  for (const rare of [false, true]) {
    const g = await world(404, { cash: false });
    const chemist = workers(g, 'chemist').find(c => c.type === 'chemist').id;
    const gunrunner = workers(g, 'gunrunner').find(c => c.type === 'gunrunner').id;
    assert.equal(g.s.agents[chemist].cash, 0, 'control: night 1 starts at $0');
    assert.ok((g.s.agents[chemist].goods.chems || 0) >= N.cook.chems, "control: its kit's batch");
    if (rare) g.hand(chemist, tierCopy(g.s, 'rare'));
    const { play } = makeBot(g.seat(chemist), {}).night(g.view(chemist), g.ctx(chemist, 'night'));
    assert.equal(play.kind, rare ? 'hustle' : 'cook', `${rare ? 'holding a rare' : 'nothing to lose'}: ${JSON.stringify(play)}`);
    if (!rare) assert.equal(play.batches, 1);
    const build = makeBot(g.seat(gunrunner), {}).night(g.view(gunrunner), g.ctx(gunrunner, 'night')).play;
    assert.equal(build.kind, 'hustle', `a build pays in a gun that sells later: ${JSON.stringify(build)}`);
  }
});

test('corners: a Dealer works its hot corner while tonight\'s star keeps it under wanted, and at one star short of wanted it deals a normal corner, never the hot one (§7, §9, §13)', async () => {
  const { makeBot } = await bots();
  for (const heat of [N.wantedAt - N.workHeat - 1, N.wantedAt - N.workHeat]) {
    const g = await world();
    const dealer = workers(g, 'dealer').find(c => c.type === 'dealer').id;
    g.rest(3);
    const hot = Object.keys(N.corners).filter(c => N.corners[c].hot).sort()[0];
    g.s.corners[hot].holder = dealer;
    g.s.agents[dealer].heat = heat;
    stock(g, dealer, 'temp', N.deal.held);
    const { play } = makeBot(g.seat(dealer), {}).night(g.view(dealer), g.ctx(dealer, 'night'));
    if (heat + N.workHeat < N.wantedAt) assert.deepEqual([play.kind, play.corner], ['deal', hot], `at ${heat} stars, its hot corner`);
    else {
      assert.ok(play.kind !== 'deal' || !N.corners[play.corner].hot, `at ${heat} stars, no hot corner: ${JSON.stringify(play)}`);
      assert.ok(play.kind === 'deal' || play.kind === 'hustle', JSON.stringify(play));
    }
  }
});

test('hold, don\'t dump: a Smuggler keeps the chems its buyers are taking past STREET.slow days unsold, rather than sell them all to the city\'s buyer; on the last day they go (§9, §15)', async () => {
  const { makeBot, STREET } = await bots();
  const g = await world();
  const smuggler = workers(g, 'smuggler').find(c => c.type === 'smuggler').id;
  stock(g, smuggler, 'chems', N.cook.batches * N.cook.chems);
  const bot = makeBot(g.seat(smuggler), {});
  const sold = [];
  for (let day = 1; day <= 2 + STREET.slow; day++) {
    for (let round = 1; round <= 3; round++) {
      const out = bot.day(g.view(smuggler), g.ctx(smuggler, round));
      sold.push(...out.filter(e => e.kind === 'sell'));
      apply(g, smuggler, out.filter(e => e.kind !== 'ask'));
    }
    g.night({ [smuggler]: { kind: 'hustle', place: 'docks' } }, { filler: LAYLOW });
  }
  assert.deepEqual(sold, [], 'nothing went to the city\'s buyer');
  assert.equal(g.s.agents[smuggler].goods.chems, N.cook.batches * N.cook.chems);
  g.rest(N.nights);
  const last = bot.day(g.view(smuggler), g.ctx(smuggler, 1)).filter(e => e.kind === 'sell');
  assert.deepEqual(last, [{ kind: 'sell', item: 'chems', units: N.cook.batches * N.cook.chems }], 'goods never board');
});

test('crews: a crew\'s leader calls a job on a night off the old calendar when its view shows one its crew wins that pays every member more than a night\'s wage; it asks its mates, promises each more than that wage, and its mates back it (§7, §8, §12)', async () => {
  const { makeBot, jobDay } = await bots();
  const seed = await seedWith(cast => cast.some(c => c.type === 'crew' && c.role === 'leader' && c.mates.length >= 3));
  const g = await world(seed);
  const lead = g.cast.find(c => c.type === 'crew' && c.role === 'leader' && c.mates.length >= 3);
  const crew = [lead.id, ...lead.mates];
  // The crews form on day 1, as their leaders form them.
  for (const c of g.cast.filter(x => x.type === 'crew' && x.role === 'leader')) {
    g.errand(c.id, 'crew_form', { name: c.crewName });
    for (const m of c.mates) {
      g.errand(c.id, 'crew_invite', { agent: m });
      g.errand(m, 'crew_join', { crew: g.s.agents[c.id].crew });
    }
  }
  // A shift worker with cash at home on its public record, out working every night.
  const mark = g.cast.find(c => c.type === 'hustle').id;
  g.grant(mark, 20 * N.rent * crew.length);
  const night = day => (jobDay(day) ? null : day);
  const day = Array.from({ length: N.nights }, (_, i) => i + 1).find(d => d >= 3 && !jobDay(d));
  g.rest(day, d => ({ [mark]: { kind: 'hustle', place: 'docks' } }));
  assert.ok(!jobDay(g.s.day) && night(g.s.day), 'control: not one of the old job nights');
  const memo = {};
  const leader = makeBot(g.seat(lead.id), memo);
  const asks = leader.day(g.view(lead.id), g.ctx(lead.id, 1)).filter(e => e.kind === 'ask' && crew.includes(e.to));
  assert.deepEqual(asks.map(e => e.to).sort(), lead.mates.slice().sort(), 'it asks every mate its job leaves under wanted');
  apply(g, lead.id, asks);
  const mates = Object.fromEntries(lead.mates.map(m => [m, makeBot(g.seat(m), {})]));
  for (let round = 2; round <= 3; round++) {
    for (const m of lead.mates) apply(g, m, mates[m].day(g.view(m), g.ctx(m, round)).filter(e => e.sitdown || e.kind === 'answer'));
    apply(g, lead.id, leader.day(g.view(lead.id), g.ctx(lead.id, round)).filter(e => e.kind === 'say' || e.kind === 'answer'));
  }
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the leader's night's wage is the take of its hustle tonight as it reckons it (hustleChoice), where it was last night's work event's wage.
  const wage = (await bots()).hustleChoice(g.view(lead.id)).take;
  const cuts = g.s.promises.filter(p => p.by === lead.id && p.what === 'pay' && p.night === g.s.day);
  assert.equal(cuts.length, lead.mates.length, 'a cut promised to each mate');
  assert.ok(cuts.every(p => p.cash > wage), `each more than the night's wage ($${wage}): ${cuts.map(p => p.cash)}`);
  const { play } = leader.night(g.view(lead.id), g.ctx(lead.id, 'night'));
  assert.ok(['hit', 'breakin', 'grab', 'vault'].includes(play.kind), `the leader's job: ${JSON.stringify(play)}`);
  for (const m of lead.mates.filter(x => !g.cast.find(c => c.id === x).snake)) {
    assert.deepEqual(mates[m].night(g.view(m), g.ctx(m, 'night')).play, { kind: 'back', target: lead.id }, `${m} backs its leader`);
  }
});

test('crews: at the crate both crews read the same board: the stronger one grabs where it beats the Cops at work, and the weaker one leaves it, since two groups and a patrol at the docks is a lost fight for one of them (§8, §9, §13)', async () => {
  const { makeBot } = await bots();
  const g = await world();
  const leaders = g.cast.filter(c => c.type === 'crew' && c.role === 'leader').sort((x, y) => y.mates.length - x.mates.length);
  assert.ok(leaders.length === 2 && leaders[0].mates.length > leaders[1].mates.length, 'control: a crew of four and one of three');
  for (const c of leaders) {
    g.errand(c.id, 'crew_form', { name: c.crewName });
    for (const m of c.mates) {
      g.errand(c.id, 'crew_invite', { agent: m });
      g.errand(m, 'crew_join', { crew: g.s.agents[c.id].crew });
    }
  }
  const crateNight = Object.keys(N.shipments).map(Number).sort((x, y) => x - y)[0];
  g.rest(crateNight);
  assert.ok(g.view(leaders[0].id).board.crate, 'control: a crate is in at the docks tonight');
  // Each leader's day: a job it calls, it asks its mates for (crewCalled), and they take the ask.
  const leading = Object.fromEntries(leaders.map(c => [c.id, makeBot(g.seat(c.id), {})]));
  for (const c of leaders) {
    apply(g, c.id, leading[c.id].day(g.view(c.id), g.ctx(c.id, 1)).filter(e => e.kind === 'ask' && c.mates.includes(e.to)));
    for (const m of c.mates) apply(g, m, makeBot(g.seat(m), {}).day(g.view(m), g.ctx(m, 2)).filter(e => e.kind === 'answer' && e.sitdown === (sitdown(g, c.id, m) || {}).id));
  }
  const [strong, weak] = leaders.map(c => leading[c.id].night(g.view(c.id), g.ctx(c.id, 'night')).play);
  assert.equal(strong.kind, 'grab', `the crew of four grabs: ${JSON.stringify(strong)}`);
  assert.notEqual(weak.kind, 'grab', `the crew of three leaves the crate to it: ${JSON.stringify(weak)}`);
});
