// R4-5, bot round 2 (trunk docs/briefs/R4-astra-fixes.md, task 5): six habits the canny cast's seats still lacked, each
// played from the seat's own view (bots.mjs, the R4-5 section). No rule changes, and no model is called. Every test
// drives the bots through the rules (the helpers' Game, the ledger checked after every errand and night), reads its
// amounts from N or from the bots' own published settings, and pins what a sensible player does, not a number the
// bench happens to give.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, tierCopy, abilityCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, ROUTES } from '../rules/state.mjs';
import { N } from '../numbers.mjs';
import { rng } from '../rng.mjs';

const bots = () => import('../bench/bots.mjs');
const LAYLOW = { kind: 'laylow', place: 'suburbs' };
const num = id => Number(id.slice(1));
const byId = (x, y) => num(x.id) - num(y.id);

// A season with the canny cast in the helpers' Game, as canny-bots.test.mjs builds one: `seat(id)` is a bot's config as
// the runner hands it over, `ctx` its context for a round. With `cash`, every agent gets the rent to the ferry twice
// over first, so nobody is evicted.
async function world(seed = 404, { cash = true } = {}) {
  const { makeCast, CASTS } = await bots();
  const cast = makeCast(seed, CASTS.canny);
  const g = new Game({ n: 1 });
  const r = newSeason({ seed, rule: 'A', midseason: 'payday', items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  g.cast = cast;
  g.seat = id => ({ ...cast.find(c => c.id === id), every: true });
  g.ctx = (id, round) => ({ seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', id, g.s.day, round) });
  g.rest = (day, plays = {}) => {
    while (g.s.day < day) g.night(plays, { filler: LAYLOW });
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
// The first seed from 404 whose canny cast has what a test needs.
async function seedWith(pred) {
  const { makeCast, CASTS } = await bots();
  for (let seed = 404; seed < 504; seed++) if (pred(makeCast(seed, CASTS.canny))) return seed;
  throw new Error('no seed in 404-503 has it');
}
const apply = (g, id, out) => out.forEach(({ kind, ...e }) => g.errand(id, kind, e));
const sitdown = (g, by, to) => Object.values(g.s.sitdowns).find(x => x.a === by && x.b === to);
// The crews form on day 1, as their leaders form them.
function formCrews(g) {
  for (const c of g.cast.filter(x => x.type === 'crew' && x.role === 'leader')) {
    g.errand(c.id, 'crew_form', { name: c.crewName });
    for (const m of c.mates) {
      g.errand(c.id, 'crew_invite', { agent: m });
      g.errand(m, 'crew_join', { crew: g.s.agents[c.id].crew });
    }
  }
}
// What a piece of `trait` is worth on the board, as a bot reads it: what it last sold for, or today's price.
const worthOn = (v, trait) => {
  const t = v.board.list.find(x => x.trait === trait);
  return t.last || t.price;
};

test('victims remember: a seat robbed while it can\'t spare a bounty keeps the grievance and posts it once it can, TRICKS.bounty of what it lost; a thief whose ski mask kept its name off the receipt is named by the 24-hour record (§10, §19)', async () => {
  const { makeBot, TRICKS } = await bots();
  for (const masked of [false, true]) {
    const g = await world();
    const shift = g.cast.filter(c => c.type === 'hustle').sort(byId);
    const [victim, other] = shift.map(c => c.id);
    const thief = g.cast.find(c => c.type === 'scout').id;
    const rare = tierCopy(g.s, 'rare');
    g.hand(victim, rare, { wear: true });
    stock(g, thief, 'guns', 1);
    if (masked) g.hand(thief, abilityCopy(g.s, 'skimask'), { wear: true });
    const works = { [victim]: { kind: 'hustle', place: 'docks' } };
    g.rest(3, works);
    // Short of cash before the night it's robbed: it hands all but two nights' rent to another agent.
    g.errand(victim, 'pay', { to: other, amount: g.s.agents[victim].cash - 2 * N.rent });
    g.night({ ...works, [thief]: { kind: 'hit', target: victim, place: 'docks' } }, { filler: LAYLOW });
    const robbed = g.events('robbed', e => e.agent === victim)[0];
    assert.equal(robbed.copy, rare, 'control: the hit took the rare it wore');
    assert.equal(robbed.by, masked ? null : thief, 'control: the receipt names the thief unless it wore the ski mask');
    const bot = makeBot(g.seat(victim), {});
    const bounties = () => bot.day(g.view(victim), g.ctx(victim, 1)).filter(e => e.kind === 'bounty');
    assert.deepEqual(bounties(), [], `day ${g.s.day}: it can't spare a night's wage`);
    g.night(works, { filler: LAYLOW });
    // The next day it has the cash (test money, as if it had earned it).
    g.grant(victim, 40 * N.rent);
    const posted = bounties();
    const lost = worthOn(g.view(victim), robbed.trait) + robbed.cash;
    assert.deepEqual(posted, [{ kind: 'bounty', agent: thief, amount: Math.floor(TRICKS.bounty * lost) }], `${masked ? 'masked' : 'named'}: the bounty on its thief`);
    apply(g, victim, posted);
    assert.ok(g.s.bounties.some(b => b.by === victim && b.on.agent === thief), 'the rules take it');
  }
});

test('victims remember: a victim posts a bounty only while BOUNTY_NIGHTS nights of crime are left before the walk, enough for a hunter to collect it, since a bounty nobody earns is gone with the ferry: robbed by a thief it can name, with cash to spare, it posts on the last day that leaves them, and none the day after (§10, §15)', async () => {
  const { makeBot, BOUNTY_NIGHTS } = await bots();
  const last = N.nights - BOUNTY_NIGHTS;
  for (const day of [last, last + 1]) {
    const g = await world();
    const victim = g.cast.filter(c => c.type === 'hustle').sort(byId)[0].id;
    const thief = g.cast.find(c => c.type === 'scout').id;
    // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the
    // victim's nights of work are hustles at the Mall (lawless, no star), as its shifts at the docks added none, and the
    // hit finds it there. It wears an epic, a theft worth a bounty: a victim posts one only when half its loss comes to
    // its own night (bots.mjs cannyBounties), now its best hustle tonight, $70, where it was last night's wage, $59; half
    // a rare at $80 and the hold-up's $44 is $62.
    g.hand(victim, tierCopy(g.s, 'epic'), { wear: true });
    stock(g, thief, 'guns', 1);
    const works = { [victim]: { kind: 'hustle', place: 'mall' } };
    g.rest(day - 1, works);
    g.night({ ...works, [thief]: { kind: 'hit', target: victim, place: 'mall' } }, { filler: LAYLOW });
    assert.equal(g.events('robbed', e => e.agent === victim)[0].by, thief, 'control: robbed by a thief it can name');
    g.grant(victim, 40 * N.rent);
    assert.equal(g.s.day, day);
    const posted = makeBot(g.seat(victim), {}).day(g.view(victim), g.ctx(victim, 1)).filter(e => e.kind === 'bounty');
    if (day === last) assert.deepEqual(posted.map(e => e.agent), [thief], `day ${day}, ${N.nights - day} nights of crime left: a bounty on its thief`);
    else assert.deepEqual(posted, [], `day ${day}, ${N.nights - day} nights of crime left: too few, no bounty`);
  }
});

test('opening break-ins: on night 1 a canny robber reads a home off the rules: an owner whose trade works out of its home is out, and every agent started with what it did; with a stake worth more than a night\'s wage it breaks in, valuing the home at its own start, not at what the home holds; at today\'s $0 it doesn\'t (§1, §6, §7)', async () => {
  const { makeBot } = await bots();
  const seed = await seedWith(cast => cast.some(c => c.type === 'scout'));
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): N.hustleBase is gone, so the stake and the rich owner's grant use its value, $50.
  for (const stake of [0, 2 * 50]) {
    const g = await world(seed, { cash: false });
    const scout = g.cast.filter(c => c.type === 'scout').sort(byId)[0].id;
    if (stake) for (const id of Object.keys(g.s.agents)) g.grant(id, stake);
    // An owner holding far more than it started with: no robber can see that.
    const rich = g.cast.filter(c => c.id !== scout && c.trade === 'smuggler').sort(byId)[0].id;
    g.grant(rich, 10 * 50);
    stock(g, scout, 'guns', 1);
    const bot = makeBot(g.seat(scout), {});
    bot.day(g.view(scout), g.ctx(scout, 1));
    const r = bot.night(g.view(scout), g.ctx(scout, 'night'));
    if (!stake) {
      assert.notEqual(r.play.kind, 'breakin', `with nothing in any home it breaks in nowhere: ${JSON.stringify(r)}`);
      continue;
    }
    assert.equal(r.play.kind, 'breakin', `a break-in on night 1: ${JSON.stringify(r)}`);
    const owner = g.cast.find(c => c.id === r.play.target);
    assert.ok(['smuggler', 'dealer', 'cop'].includes(owner.trade), `an owner whose trade works out of its home: ${owner.trade}`);
    assert.equal(r.value, Math.floor(stake * N.breakinShare), 'the home is worth what everyone started with');
    g.night({ [scout]: r.play }, { filler: { kind: 'hustle', place: 'docks' } });
    assert.ok(g.events('burgle', e => e.leader === scout && e.night === 1).length, 'and the rules let it in');
  }
});

test('lockpicks: an unarmed canny robber that would break into a home with one buys a lockpick from a Gunrunner at its price; the Gunrunner hands it over, the robber breaks in with it that night and pays the next morning (§8, §9)', async () => {
  const { makeBot, pickPrice, STREET } = await bots();
  const seed = await seedWith(cast => cast.some(c => c.type === 'scout' && !['smuggler', 'gunrunner'].includes(c.trade)) && cast.some(c => c.type === 'gunrunner'));
  const g = await world(seed);
  const scout = g.cast.filter(c => c.type === 'scout' && !['smuggler', 'gunrunner'].includes(c.trade)).sort(byId)[0].id;
  const seller = g.cast.filter(c => c.type === 'gunrunner').sort(byId)[0].id;
  const [mark, other] = g.cast.filter(c => c.type === 'hustle').sort(byId).map(c => c.id);
  // Its record shows the pick it holds from day 3 on.
  stock(g, seller, 'lockpicks', 1);
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the mark's nights of work are hustles at the Mall (lawless, no star), as its shifts at the docks added none; the robber's night's wage is the take of its hustle tonight as it reckons it (hustleChoice), where it was last night's work event's wage.
  const works = { [mark]: { kind: 'hustle', place: 'mall' } };
  g.rest(3, works);
  // No gun, no knuckles, and no gun's price to buy one: a lone robber's 1 beats no lock (§8).
  g.errand(scout, 'pay', { to: other, amount: g.s.agents[scout].cash - 5 * N.rent });
  const robber = makeBot(g.seat(scout), {});
  const gunrunner = makeBot(g.seat(seller), {});
  const ask = robber.day(g.view(scout), g.ctx(scout, 1)).filter(e => e.kind === 'ask' && e.to === seller);
  assert.deepEqual(ask, [{ kind: 'ask', to: seller, line: `Buying a lockpick for $${pickPrice(g.view(scout))}; I pay once it's handed over.` }], 'it asks the Gunrunner whose record shows a pick, at the price its order then states (R9d)');
  apply(g, scout, ask);
  const sd = sitdown(g, scout, seller).id;
  apply(g, seller, gunrunner.day(g.view(seller), g.ctx(seller, 2)).filter(e => e.sitdown === sd));
  const price = pickPrice(g.view(scout));
  assert.equal(price, N.build.lockpicks * STREET.unit + (await bots()).hustleChoice(g.view(scout)).take, 'its part at the agents\' price and a night\'s wage');
  const order = robber.day(g.view(scout), g.ctx(scout, 2)).filter(e => e.sitdown === sd);
  assert.deepEqual(order, [{ kind: 'say', sitdown: sd, say: 'offer', terms: { what: 'buy', goods: { lockpicks: 1 }, cash: price } }]);
  apply(g, scout, order);
  apply(g, seller, gunrunner.day(g.view(seller), g.ctx(seller, 3)).filter(e => e.kind === 'give' && e.to === scout));
  assert.equal(g.s.agents[scout].goods.lockpicks, 1, 'the pick is handed over');
  const { play } = robber.night(g.view(scout), g.ctx(scout, 'night'));
  assert.deepEqual([play.kind, play.target], ['breakin', mark], `it breaks into the worker's home: ${JSON.stringify(play)}`);
  g.night({ ...works, [scout]: play }, { filler: LAYLOW });
  assert.ok(g.events('used', e => e.agent === scout && e.goods.lockpicks).length, 'the pick is used up');
  assert.ok(g.events('burgle', e => e.leader === scout).length, 'and the break-in wins');
  const pay = robber.day(g.view(scout), g.ctx(scout, 1)).filter(e => e.kind === 'pay' && e.to === seller);
  assert.deepEqual(pay, [{ kind: 'pay', to: seller, amount: price, for: 'debt' }], 'it pays for the pick');
});

test('lockpicks: a Gunrunner with no pick says so to an order, and builds one that night beside the gun its stock is short (§9)', async () => {
  const { makeBot } = await bots();
  const seed = await seedWith(cast => cast.some(c => c.type === 'scout' && !['smuggler', 'gunrunner'].includes(c.trade)) && cast.some(c => c.type === 'gunrunner'));
  const g = await world(seed);
  const scout = g.cast.filter(c => c.type === 'scout' && !['smuggler', 'gunrunner'].includes(c.trade)).sort(byId)[0].id;
  const seller = g.cast.filter(c => c.type === 'gunrunner').sort(byId)[0].id;
  const [mark, other] = g.cast.filter(c => c.type === 'hustle').sort(byId).map(c => c.id);
  stock(g, seller, 'parts', N.build.parts - (g.s.agents[seller].goods.parts || 0));
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the mark's nights of work are hustles at the Mall (lawless, no star), as its shifts at the docks added none.
  g.rest(3, { [mark]: { kind: 'hustle', place: 'mall' } });
  g.errand(scout, 'pay', { to: other, amount: g.s.agents[scout].cash - 5 * N.rent });
  // It asked this Gunrunner for a pick before, so it asks it again.
  const robber = makeBot(g.seat(scout), { pickFrom: seller });
  const gunrunner = makeBot(g.seat(seller), {});
  apply(g, scout, robber.day(g.view(scout), g.ctx(scout, 1)).filter(e => e.kind === 'ask' && e.to === seller));
  const sd = sitdown(g, scout, seller);
  assert.ok(sd, 'it asks the Gunrunner it asked before');
  apply(g, seller, gunrunner.day(g.view(seller), g.ctx(seller, 2)).filter(e => e.sitdown === sd.id));
  apply(g, scout, robber.day(g.view(scout), g.ctx(scout, 2)).filter(e => e.sitdown === sd.id));
  const reply = gunrunner.day(g.view(seller), g.ctx(seller, 3)).filter(e => e.sitdown === sd.id || e.kind === 'give');
  assert.deepEqual(reply, [{ kind: 'say', sitdown: sd.id, say: 'answer', terms: { what: 'buy', cash: 0 } }], 'holding none, it says so');
  apply(g, seller, reply);
  const { play } = gunrunner.night(g.view(seller), g.ctx(seller, 'night'));
  assert.equal(play.kind, 'build', JSON.stringify(play));
  assert.equal(play.guns, 1, 'the gun its stock is short');
  assert.equal(play.lockpicks, 1, 'and the pick it was asked for');
});

test('bribes: on a night Pleasantview is heavy, a canny robber that would break in there with the city cops kept out bribes for that break-in and makes it; the bribe keeps the cops out of the fight (§13)', async () => {
  const { makeBot } = await bots();
  const seed = await seedWith(cast => cast.some(c => c.type === 'scout' && c.trade !== 'smuggler'));
  const g = await world(seed);
  const scout = g.cast.filter(c => c.type === 'scout' && c.trade !== 'smuggler').sort(byId)[0].id;
  const mark = g.cast.filter(c => c.type === 'hustle').sort(byId)[0].id;
  stock(g, scout, 'guns', 1);
  const works = { [mark]: { kind: 'hustle', place: 'docks' } };
  g.rest(3, works);
  g.s.districts.suburbs.level = 'heavy';
  assert.equal(g.view(scout).board.tonight.suburbs, 'heavy', 'control: Pleasantview is heavy tonight');
  const bot = makeBot(g.seat(scout), {});
  for (let round = 1; round <= 2; round++) bot.day(g.view(scout), g.ctx(scout, round));
  const bribe = bot.day(g.view(scout), g.ctx(scout, 3)).filter(e => e.kind === 'bribe');
  assert.deepEqual(bribe, [{ kind: 'bribe', target: mark }], 'it bribes for the break-in on the worker\'s home');
  apply(g, scout, bribe);
  const { play } = bot.night(g.view(scout), g.ctx(scout, 'night'));
  assert.deepEqual([play.kind, play.target], ['breakin', mark], JSON.stringify(play));
  const r = g.night({ ...works, [scout]: play }, { filler: LAYLOW });
  const fight = r.fights.fights.find(f => f.kind === 'breakin' && f.target === mark);
  assert.equal(fight.cops, 0, 'no city cops in it');
  assert.equal(fight.winner, scout, 'and the break-in wins');
});

test('bribes: a wanted canny seat whose arrest would cost it more than the bribe bribes for its own collar when tonight\'s police plan comes for it at home and wins only with the city cops; the collar fails (§13)', async () => {
  const { makeBot, policePlan } = await bots();
  const seed = await seedWith(cast => cast.filter(c => c.trade === 'cop' && c.type !== 'hustle').length >= 2 && cast.some(c => c.type === 'dealer'));
  const g = await world(seed);
  const cops = g.cast.filter(c => c.trade === 'cop').map(c => c.id);
  const dealer = g.cast.filter(c => c.type === 'dealer').sort(byId)[0].id;
  const beat = Object.fromEntries(cops.map(id => [id, { kind: 'patrol', place: 'docks' }]));
  g.rest(3, beat);
  g.s.agents[dealer].heat = N.wantedAt;
  g.grant(dealer, 2 * N.bribe[N.wantedAt]);
  const plan = policePlan(g.view(dealer), true);
  assert.equal(plan && plan.target, dealer, `control: tonight's police plan collars it: ${JSON.stringify(plan)}`);
  const bot = makeBot(g.seat(dealer), {});
  for (let round = 1; round <= 2; round++) bot.day(g.view(dealer), g.ctx(dealer, round));
  const bribe = bot.day(g.view(dealer), g.ctx(dealer, 3)).filter(e => e.kind === 'bribe');
  assert.deepEqual(bribe, [{ kind: 'bribe', target: dealer }], 'it bribes for its own fight');
  apply(g, dealer, bribe);
  const plays = { ...beat, [plan.lead]: { kind: 'collar', target: dealer, place: plan.place } };
  for (const id of plan.group.filter(x => x !== plan.lead)) plays[id] = { kind: 'back', target: plan.lead };
  plays[plan.lead].accept = plan.group.filter(x => x !== plan.lead);
  plays[dealer] = bot.night(g.view(dealer), g.ctx(dealer, 'night')).play;
  const r = g.night(plays, { filler: LAYLOW });
  const fight = r.fights.fights.find(f => f.kind === 'collar' && f.target === dealer);
  assert.ok(fight, 'control: the collar finds it at home');
  assert.equal(fight.winner, null, 'the Cops alone don\'t beat it');
  assert.ok(!g.s.agents[dealer].jail, 'it isn\'t arrested');
});

test('bribes: the hold-up\'s pay counted in a hit\'s value includes a guard\'s wage: a Cop the show saw guarding the vault twice carries it (§7, §13)', async () => {
  const { goodsCarried } = await bots();
  const g = await world();
  const cop = g.cast.filter(c => c.trade === 'cop' && c.type !== 'hustle').sort(byId)[0].id;
  const robber = g.cast.find(c => c.type === 'scout').id;
  g.rest(4, { [cop]: { kind: 'guard', place: 'downtown' } });
  const v = g.view(robber);
  const a = v.board.agents.find(x => x.id === cop);
  assert.equal(goodsCarried(v, true).at(a, 'downtown'), N.copPay.guard);
  assert.equal(goodsCarried(v).at(a, 'downtown'), 0, 'every other cast reads it as before');
});

test('the last split: on day 14 each crew member takes its share of the stash by what it put in and risked, as the crew\'s record shows it: the cash it put in, the piece it put in, and a piece a crew job took shared by the group that took it; the keeper\'s share stays, and no take reads as a rug (§12, §15)', async () => {
  const { makeBot } = await bots();
  const seed = await seedWith(cast => cast.some(c => c.type === 'crew' && c.role === 'leader' && c.mates.length >= 2));
  const g = await world(seed);
  const lead = g.cast.filter(c => c.type === 'crew' && c.role === 'leader' && c.mates.length >= 2).sort(byId)[0];
  formCrews(g);
  const crew = [lead.id, ...lead.mates];
  const [m1, m2] = lead.mates.slice().sort((x, y) => num(x) - num(y));
  const put = { [m1]: 15 * N.rent, [m2]: 50 };
  g.grant(m1, put[m1]);
  const bot = Object.fromEntries(crew.map(id => [id, makeBot(g.seat(id), {})]));
  // Every member reads its record each day, as it does in a season.
  const look = () => crew.forEach(id => bot[id].day(g.view(id), g.ctx(id, 1)));
  const rare = tierCopy(g.s, 'rare');
  g.hand(m1, rare);
  g.errand(m1, 'stash_put', { copy: rare });
  for (const id of [m1, m2]) g.errand(id, 'stash_put', { cash: put[id] });
  look();
  // Night 1: the leader, armed, holds up a worker wearing a rare, with m1 backing it; the take goes in the stash.
  const mark = g.cast.filter(c => c.type === 'hustle').sort(byId)[0].id;
  const job = tierCopy(g.s, 'rare');
  g.hand(mark, job, { wear: true });
  stock(g, lead.id, 'guns', 1);
  g.night({ [lead.id]: { kind: 'hit', target: mark, place: 'docks' }, [m1]: { kind: 'back', target: lead.id }, [mark]: { kind: 'hustle', place: 'docks' } }, { filler: LAYLOW });
  const took = g.events('rob', e => e.leader === lead.id)[0];
  assert.deepEqual([took.copy, took.members.slice().sort()], [job, [lead.id, m1].sort()], 'control: the job took the rare, m1 in its group');
  g.errand(lead.id, 'stash_put', { copy: job });
  while (g.s.day < N.nights) {
    look();
    g.night({}, { filler: LAYLOW });
  }
  const st = () => g.s.crews[g.s.agents[lead.id].crew];
  assert.equal(st().keeper, lead.id, 'control: the leader keeps the stash');
  const cash = st().cash;
  assert.equal(cash, put[m1] + put[m2], 'control: the stash holds what they put in');
  const w = trait => worthOn(g.view(m1), trait);
  const before = g.log.length;
  for (const id of crew.filter(x => x !== lead.id)) apply(g, id, bot[id].day(g.view(id), g.ctx(id, 1)).filter(e => e.kind === 'stash_take'));
  const takes = g.log.slice(before).filter(e => e.type === 'stash' && e.act === 'take');
  const of = id => takes.filter(e => e.agent === id);
  assert.deepEqual(of(m1).filter(e => e.copy).map(e => e.copy).sort(), [rare, job].sort(), 'm1, which put in most and backed the job, takes both pieces');
  // Each share is what each put in: m1 its cash and its piece and half the job's piece, m2 its cash, the leader half the
  // job's piece. m1 holds both pieces, so its cash is its share less them.
  const half = w(g.s.copies[job].trait) / 2;
  assert.equal(of(m1).reduce((t, e) => t + e.cash, 0), Math.floor(put[m1] - half), 'm1\'s cash');
  assert.deepEqual(of(m2).map(e => [e.copy, e.cash]), [[null, put[m2]]], 'm2 takes its cash');
  assert.equal(st().cash, cash - Math.floor(put[m1] - half) - put[m2], 'the leader\'s share stays in the stash');
  assert.deepEqual(g.log.slice(before).filter(e => e.type === 'betray'), [], 'no take reads as a rug');
});

test('the last night: a canny seat carrying something a hit could take, which a crew on the board could beat on its usual route, walks the route the cops guard best only when the cops there would hold every such crew off; where even they wouldn\'t, it keeps its usual route, which nobody else knows, as one carrying nothing does. Against a wanted crew the city cops\' +2 counts too (§6, §8, §15)', async () => {
  const { makeBot } = await bots();
  const seed = await seedWith(cast => cast.filter(c => c.type === 'hustle' && c.route !== 'downtown').length >= 3);
  for (const wanted of [false, true]) {
    const g = await world(seed);
    formCrews(g);
    // The strong one is armed and on TEMP, in the first season only: in the second, only the crews could beat a holder.
    const [strong, weak, empty] = g.cast.filter(c => c.type === 'hustle' && c.route !== 'downtown').sort(byId).map(c => c.id);
    if (!wanted) stock(g, strong, 'guns', 1);
    g.rest(N.nights);
    if (!wanted) {
      stock(g, strong, 'temp', 1);
      g.errand(strong, 'take', { drug: 'temp' });
    }
    for (const id of [strong, weak]) g.hand(id, tierCopy(g.s, 'rare'));
    g.errand(empty, 'pay', { to: weak, amount: g.s.agents[empty].cash });
    if (wanted) for (const c of g.cast.filter(x => x.type === 'crew')) g.s.agents[c.id].heat = N.wantedAt;
    const v = g.view(weak);
    assert.equal(v.board.tonight.downtown, 'heavy', 'control: Glasswall is heavy');
    assert.ok(v.board.crews.every(c => c.members.every(id => !!v.board.agents.find(a => a.id === id).wanted === wanted)), `control: the crews are ${wanted ? '' : 'not '}wanted`);
    // Strength (§8): 1 each, and the strong one +1 for its gun and +1 on TEMP; the biggest crew, its members, 1 each.
    const big = Math.max(...v.board.crews.map(c => c.members.length));
    const walk = id => makeBot(g.seat(id), {}).night(g.view(id), g.ctx(id, 'night')).play;
    if (!wanted) {
      assert.ok(big > 3 && big <= 3 + N.copsHeavy && big > 1 + N.copsHeavy, 'control: the biggest crew beats both off Glasswall; there its cops hold it off the strong one only');
      assert.deepEqual(walk(strong), { kind: 'board', place: 'downtown' }, 'the strong one walks through Glasswall, where the cops hold every crew off');
      assert.deepEqual(walk(weak), { kind: 'board', place: g.seat(weak).route }, 'the weak one keeps its usual route: not even Glasswall\'s cops would hold the biggest crew off');
    } else {
      assert.ok(big > 1 + N.copsWanted && big <= 1 + N.copsWanted + N.copsHeavy, 'control: against a wanted crew, The Yards\' cops wouldn\'t hold the biggest off the weak one, and Glasswall\'s would');
      assert.deepEqual(walk(weak), { kind: 'board', place: 'downtown' }, 'the weak one walks through Glasswall, where the cops would hold every wanted crew off');
    }
    assert.deepEqual(walk(empty), { kind: 'board', place: g.seat(empty).route }, 'the empty-handed one walks its usual route');
  }
});

test('the last night: a canny robber looks for a target where public facts say it walks, and guesses where they don\'t, since looking in the wrong place costs nothing. Armed, it leaves the holders that Glasswall\'s cops keep safe from it to Glasswall, which it can\'t win, and walks; with knuckles too, no route keeps a holder safe, each keeps its usual route, which nobody else knows, and it guesses a route where it would win, with no cop in the fight while it carries more than the take would bring: where it finds its target it wins, and where it doesn\'t it boards untouched (§8, §13, §15)', async () => {
  const { makeBot } = await bots();
  const seed = await seedWith(cast => cast.some(c => c.type === 'scout') && cast.some(c => c.type === 'hustle' && c.route !== 'downtown'));
  // The scout armed, with knuckles worn or not, on the last night, carrying more than any take would bring (test money).
  const setup = async knuckles => {
    const g = await world(seed);
    const scout = g.cast.filter(c => c.type === 'scout').sort(byId)[0].id;
    stock(g, scout, 'guns', 1);
    if (knuckles) g.hand(scout, abilityCopy(g.s, 'knuckles'), { wear: true });
    g.rest(N.nights);
    g.grant(scout, 40 * N.rent);
    const walk = id => makeBot(g.seat(id), {}).night(g.view(id), g.ctx(id, 'night')).play;
    return { g, scout, walk, play: walk(scout) };
  };
  const armed = await setup(false);
  assert.equal(armed.g.view(armed.scout).board.tonight.downtown, 'heavy', 'control: Glasswall is heavy');
  const holder = armed.g.cast.filter(c => c.type === 'hustle' && c.route !== 'downtown').sort(byId)[0].id;
  assert.deepEqual(armed.walk(holder), { kind: 'board', place: 'downtown' }, 'control: a holder that only Glasswall\'s cops keep safe from the scout walks through Glasswall');
  assert.equal(armed.play.kind, 'board', `2 against a holder's 1 and Glasswall's cops, with a point to keep in hand: it walks (${JSON.stringify(armed.play)})`);
  for (const found of [true, false]) {
    const { g, scout, walk, play } = await setup(true);
    assert.equal(play.kind, 'hit', `with knuckles, a guess (${JSON.stringify(play)})`);
    assert.notEqual(play.target, scout);
    assert.deepEqual(walk(play.target), { kind: 'board', place: g.seat(play.target).route }, 'control: no route keeps its target safe from 3, so it keeps its usual route');
    assert.notEqual(g.view(scout).board.tonight[play.place], 'heavy', 'it looks only where no cop would be in the fight');
    const place = found ? play.place : ROUTES.find(rt => rt !== play.place);
    const r = g.night({ [scout]: play, [play.target]: { kind: 'board', place } }, { filler: { kind: 'board', place: 'downtown' } });
    if (found) {
      assert.ok(r.fights.fights.some(f => f.kind === 'hit' && f.target === play.target && f.winner === scout), 'it finds its target there and wins');
      continue;
    }
    assert.deepEqual(r.fights.fights.filter(f => f.target === play.target), [], 'its target walked another route: no fight');
    assert.ok(g.s.agents[scout].boarded && !g.s.agents[scout].jail, 'it boards untouched');
  }
});

test('the last night: two crews don\'t go for one target. No route keeps a lone walker safe from either crew, so neither can read where it walks and each guesses; the weaker crew leaves the stronger one\'s target to it, as anyone reads it off public facts, since two groups on one target are one fight that only one can win, and with a cop in it the other is arrested (§8, §15)', async () => {
  const { makeBot } = await bots();
  const g = await world();
  formCrews(g);
  // A lone shift worker with the most cash on the board, by its public record: the best take for either crew.
  const rich = g.cast.filter(c => c.type === 'hustle').sort(byId)[0].id;
  g.grant(rich, 60 * N.rent);
  const size = id => g.cast.filter(c => c.type === 'crew' && c.leader === id).length;
  const [strong, weak] = g.cast.filter(c => c.type === 'crew' && c.role === 'leader').map(c => c.id).sort((x, y) => size(y) - size(x));
  assert.ok(size(strong) > size(weak), 'control: one crew is bigger, so stronger by public strength (§8)');
  const bot = Object.fromEntries([strong, weak].map(id => [id, makeBot(g.seat(id), {})]));
  // Each leader reads its first day, as it does in a season: the record shows it who founded each crew.
  for (const id of [strong, weak]) bot[id].day(g.view(id), g.ctx(id, 1));
  g.rest(N.nights);
  const walk = id => bot[id].night(g.view(id), g.ctx(id, 'night')).play;
  const [s, w] = [walk(strong), walk(weak)];
  assert.deepEqual([s.kind, s.target], ['hit', rich], `the stronger crew goes for the best take (${JSON.stringify(s)})`);
  assert.equal(w.kind, 'hit', `the weaker crew hunts too (${JSON.stringify(w)})`);
  assert.notEqual(w.target, rich, 'on another target');
});
