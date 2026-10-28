// L2-6d, spending and contests in the cast where every seat trades (GAME.md §3, §9, §13, §15). Once L2-6c's Cops won
// their collars, four habits no sensible player has showed: a seat collared on night 12 or 13 sat in jail past the
// ferry (the bots bailed themselves out only through day 12); thousands of dollars boarded unspent while traits it
// could buy went unsold; the Dealers' pecking order avoided every corner fight, even one a Dealer could see it would
// win; and the fence moved few pieces. In the trades cast each bot now plays these from its own view. Layer 2's and
// layer 1's casts keep their bots as they were. Every amount is read from the rulebook (N) or a bot setting. Each test
// imports what it needs itself, so each fails on its own before the habits exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Game, ITEMS, idOf, listCopies } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { rng } from '../rng.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-spending-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const bots = () => import('../bench/bots.mjs');
const readLog = dir => fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const commons = (s, slot) => listCopies(s, t => t.tier === 'common' && !t.ability && t.slot === slot);

// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  const a = g.s.agents[id];
  a.goods[kind] = (a.goods[kind] || 0) + n;
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}

// A small season, one bot config each (type, trade, `every` for the trades cast's bots). `play(id)` is tonight's play
// from a fresh bot; `errands(id, round)` its day's errands in that round, each applied and each going through.
async function world(cfgs, seed = 404) {
  const { makeBot } = await bots();
  const agents = cfgs.map((c, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: c.trade, driver: c.driver || 'test' }));
  const g = new Game({ n: 1 });
  const r = newSeason({ seed, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  const cfg = Object.fromEntries(agents.map((a, i) => [a.id, { id: a.id, fav: 'industrial', route: 'downtown', layer: 2, ...cfgs[i] }]));
  const ctx = (id, round) => ({ seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', id, g.s.day, round) });
  const play = (id, memo = {}) => makeBot(cfg[id], memo).night(g.view(id), ctx(id, 'night')).play;
  const errands = (id, round, memo = {}) => {
    const out = makeBot(cfg[id], memo).day(g.view(id), ctx(id, round));
    for (const e of out) {
      const res = g.errand(id, e.kind, e);
      assert.ok(res.ok, `${id} ${e.kind}: ${res.why}`);
    }
    return out;
  };
  return { g, play, errands };
}

const shift = { type: 'hustle', trade: 'cop' };
const dealer = { type: 'dealer', trade: 'dealer' };
const every = cfg => ({ ...cfg, every: true });
const filler = { kind: 'hustle', place: 'docks' };
// A hit on `target` at the docks (where the filler shift puts it) by agents at one star short of 5: the crime takes
// them to 5, and losing it with the city cops against a wanted attacker gets them arrested tonight.
function arrestTonight(g, ids, target) {
  for (const id of ids) g.s.agents[id].heat = N.maxHeat - 1;
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the helpers' filler is a hustle at the Mall now, so the night passes the docks filler that puts the target at the docks.
  return g.night(Object.fromEntries(ids.map(id => [id, { kind: 'hit', target, place: 'docks' }])), { filler: { kind: 'hustle', place: 'docks' } });
}
const rentToEnd = day => (N.nights - day) * N.rent;

test("bail before the ferry: jail ends at dawn on day 14, when the ferry docks, so a seat jailed on night 12 keeps its bail, in the trades cast as in layer 2's, and every seat boards; one out before the ferry anyway keeps its cash too (§13, §15)", async () => {
  const { g, errands } = await world([every(shift), shift, every(shift), shift]);
  g.advanceTo(N.nights - N.jailNights - 1);
  // a03 is arrested the night before: its jail ends at the dawn the ferry docks.
  arrestTonight(g, ['a03'], 'a04');
  arrestTonight(g, ['a01', 'a02'], 'a04');
  assert.equal(g.s.day, N.nights - 1);
  for (const id of ['a01', 'a02', 'a03']) {
    assert.ok(g.s.agents[id].jail, `${id} is in jail`);
    g.grant(id, g.s.agents[id].jail.stars * N.bailPerStar);
  }
  const bailed = id => errands(id, 1).filter(e => e.kind === 'bail').length;
  // No jail outlasts the ferry (GAP gap.ferryJail): a bail now would buy only night 13.
  assert.equal(bailed('a01'), 0, 'the trades cast keeps its cash: its jail ends at the dawn the ferry docks');
  assert.equal(bailed('a02'), 0, "layer 2's bails only through day 12");
  assert.equal(bailed('a03'), 0, 'out at the dawn the ferry docks anyway');
  assert.ok(g.s.agents.a01.jail, 'a01 waits for that dawn');
  const kept = g.s.agents.a01.cash;
  g.night();
  g.night();
  assert.deepEqual(g.events('missed').map(e => e.agent), [], 'nobody misses the boat');
  for (const id of ['a01', 'a02', 'a03']) assert.ok(g.events('board').some(e => e.agent === id), `${id} boards`);
  assert.equal(g.s.agents.a01.mainland, kept * N.mainlandRate, 'a01 boards with the cash the bail would have cost');
});

test("bail before the ferry, under the old jail rule (gap.ferryJail 'missed'), where a jail can outlast the ferry: a crew member short of its bail takes the rest from the crew stash, and never empties it (§12, §13)", async () => {
  // Under 'released' (the rule since R3-3) no jail outlasts the ferry, so the habit never bails: ferry-bail.test.mjs.
  const { withOverrides } = await import('../bench/runner.mjs');
  await withOverrides({ 'gap.ferryJail': 'missed' }, async () => {
    const member = { type: 'crew', role: 'member', crew: 0, leader: 'a02', mates: ['a02'], crewName: 'c', snake: false, turn: 0, rug: 0, walk: 0, trade: 'cop', works: true, every: true };
    const { g, errands } = await world([member, { ...member, role: 'leader', leader: 'a02', mates: ['a01'] }, shift]);
    g.errand('a02', 'crew_form', { name: 'c' });
    g.errand('a02', 'crew_invite', { agent: 'a01' });
    g.errand('a01', 'crew_join', { crew: g.s.agents.a02.crew });
    g.advanceTo(N.nights - N.jailNights);
    arrestTonight(g, ['a01'], 'a03');
    const bail = g.s.agents.a01.jail.stars * N.bailPerStar;
    const own = g.s.agents.a01.cash;
    assert.ok(own < bail, 'its own cash is short');
    // The stash holds the shortfall and one dollar more.
    g.grant('a02', bail - own + 1);
    g.errand('a02', 'stash_put', { cash: bail - own + 1 });
    const out = errands('a01', 1);
    assert.deepEqual(out.filter(e => ['stash_take', 'bail'].includes(e.kind)), [{ kind: 'stash_take', cash: bail - own }, { kind: 'bail', agent: 'a01' }]);
    assert.equal(g.s.agents.a01.jail, null);
    assert.equal(g.s.crews[g.s.agents.a02.crew].cash, 1);
    assert.equal(g.events('betray').length, 0, 'not a rug');
  });
});

test("spend down: on the list's last day a seat in the trades cast offers on every trait it wants and can afford beyond the rent to the ferry, the rarest first, a slot once, never one it holds; layer 2's makes one offer (§3, §10)", async () => {
  const { g, errands } = await world([every(shift), shift, every({ type: 'smuggler', trade: 'smuggler' })]);
  g.advanceTo(N.listLastNight);
  const open = g.view('a01').board.list.filter(t => t.opens <= g.s.day && t.left > 0);
  const rare = open.filter(t => t.tier === 'rare').sort((x, y) => x.price - y.price)[0];
  const cheap = open.filter(t => t.tier === 'common' && !t.ability).sort((x, y) => x.price - y.price || (x.trait < y.trait ? -1 : 1));
  // Room for the cheapest rare, and three commons, one of them for a slot it holds.
  const cash = rare.price + cheap[0].price + cheap[1].price + cheap[2].price;
  // a01 already holds a common in the cheapest common's slot.
  const held = commons(g.s, cheap[0].slot)[0];
  g.hand('a01', held);
  for (const id of ['a01', 'a02']) g.grant(id, cash + rentToEnd(g.s.day) - g.s.agents[id].cash);
  const offers = errands('a01', 1).filter(e => e.kind === 'offer');
  const slot = t => open.find(x => x.trait === t).slot;
  assert.ok(offers.length >= 2, `${offers.length} offers`);
  assert.equal(open.find(t => t.trait === offers[0].trait).tier, 'rare', 'the rarest first');
  assert.equal(new Set(offers.map(o => slot(o.trait))).size, offers.length, 'a slot once');
  assert.ok(!offers.some(o => slot(o.trait) === g.s.copies[held].slot && open.find(t => t.trait === o.trait).tier === 'common'), 'nothing for a slot it holds');
  assert.ok(g.s.agents.a01.cash >= rentToEnd(g.s.day), 'the rent to the ferry stays');
  assert.ok(errands('a02', 1).filter(e => e.kind === 'offer').length <= 1, "layer 2's buys one");
});

test("the bail reserve, under the old jail rule (gap.ferryJail 'missed'), where a collar can still keep a seat off the boat: a Dealer that tonight's hot corner would make wanted keeps twice the bail back from the list, or, short of it, stays cool, works a shift and spends; a cool one spends (§13)", async () => {
  // R4-4: under 'released' (the rule since R3-3) no collar keeps anyone off the boat, so no seat keeps a reserve:
  // law.test.mjs.
  const { withOverrides } = await import('../bench/runner.mjs');
  await withOverrides({ 'gap.ferryJail': 'missed' }, () => bailReserveCase());
});

async function bailReserveCase() {
  const { bailReserve, CLOSE, STREET } = await bots();
  const { g, errands, play } = await world([every(dealer), every(dealer), every(dealer), shift]);
  g.advanceTo(N.listLastNight - 1);
  const at = { a01: 'strip-1', a02: 'strip-2', a03: 'downtown-1' };
  for (const id of Object.keys(at)) {
    stock(g, id, 'temp', N.deal.cap);
    g.grant(id, N.rent);
  }
  g.night(Object.fromEntries(Object.entries(at).map(([id, corner]) => [id, { kind: 'deal', corner, place: N.corners[corner].place }])));
  for (const id of Object.keys(at)) g.s.agents[id].heat = id === 'a02' ? 0 : N.wantedAt - 1;
  const reserve = CLOSE.reserve * N.bailPerStar * N.wantedAt;
  assert.equal(bailReserve(g.view('a01'), N.workHeat), reserve);
  assert.equal(bailReserve(g.view('a02'), N.workHeat), 0);
  const cheapest = Math.min(...g.view('a01').board.list.filter(t => t.opens <= g.s.day && t.left > 0).map(t => t.price));
  const doses = N.deal.held * STREET.unit;
  // a01 can keep the reserve with the rent to the ferry and tonight's doses, but not one trait more; a03 can't keep it.
  g.grant('a01', reserve + rentToEnd(g.s.day) + doses + cheapest - 1 - g.s.agents.a01.cash);
  for (const id of ['a02', 'a03']) g.grant(id, rentToEnd(g.s.day) + doses + cheapest - g.s.agents[id].cash);
  assert.equal(errands('a01', 1).filter(e => e.kind === 'offer').length, 0, 'it keeps its bail reserve');
  assert.ok(errands('a02', 1).filter(e => e.kind === 'offer').length >= 1, 'a cool Dealer spends down');
  assert.ok(errands('a03', 1).filter(e => e.kind === 'offer').length >= 1, 'one that stays cool spends down');
  for (const id of Object.keys(at)) stock(g, id, 'temp', N.deal.held);
  assert.deepEqual([play('a01').corner, play('a02').corner, play('a03').kind], ['strip-1', 'strip-2', 'hustle'], 'a03 stays cool');
}

test("the fence's last day: a spare piece goes up at once, a seat with cash to spare buys it for a slot it holds nothing in, and the buy-late saver, whose strategy buys only on the list's last two nights, doesn't (§9)", async () => {
  const { FENCE } = await bots();
  const buylate = { type: 'buylate', trade: 'cop', works: true, every: true };
  const { g, errands } = await world([every(shift), every(shift), buylate]);
  g.advanceTo(N.nights - 1);
  const [worn, spare] = commons(g.s, 'top');
  g.hand('a01', worn, { wear: true });
  g.hand('a01', spare);
  const listed = errands('a01', 1).filter(e => e.kind === 'fence_list');
  assert.deepEqual(listed.map(e => e.copy), [spare]);
  const price = Math.floor(g.s.traits[g.s.copies[spare].trait].price * FENCE.list);
  assert.equal(listed[0].price, price);
  for (const id of ['a02', 'a03']) g.grant(id, price + rentToEnd(g.s.day) - g.s.agents[id].cash);
  assert.equal(errands('a03', 2).filter(e => e.kind === 'fence_buy').length, 0, 'the buy-late saver');
  assert.equal(errands('a02', 2).filter(e => e.kind === 'fence_buy').length, 1);
  g.night();
  assert.deepEqual(g.s.copies[spare].holder, { k: 'agent', id: 'a02' });
});

test("corners: a Dealer that can see it would win a hot corner contests it (its strength against the holder's, the city cops' and the patrols', from public facts), the lowest id first, and wins it; never an armed holder's or one the cops tip; layer 2's Dealers don't (§8, §9)", async () => {
  const { g, play } = await world([every(dealer), every(dealer), every(dealer), every(dealer), every(dealer), dealer, shift]);
  const at = { a01: 'strip-1', a02: 'strip-2', a03: 'downtown-1', a04: 'docks-1', a05: 'industrial-1', a06: 'suburbs-1' };
  // a02, a04, a05 and a06 are armed; the dawn's holdings record says so 24 hours later.
  for (const id of ['a02', 'a04', 'a05', 'a06']) stock(g, id, 'guns', 1);
  for (let n = 0; n < 2; n++) {
    for (const id of Object.keys(at)) {
      stock(g, id, 'temp', N.deal.cap);
      g.grant(id, N.rent);
    }
    g.night(Object.fromEntries(Object.entries(at).map(([id, corner]) => [id, { kind: 'deal', corner, place: N.corners[corner].place }])));
  }
  for (const id of Object.keys(at)) stock(g, id, 'temp', N.deal.cap);
  const plays = Object.fromEntries(Object.keys(at).map(id => [id, play(id)]));
  assert.equal(plays.a04.corner, 'strip-1', "a04's gun beats a01 alone in a normal district");
  assert.equal(plays.a05.corner, 'industrial-1', 'strip-1 is a04\'s to contest; a02 is armed too, and Glasswall\'s cops tip downtown-1');
  assert.equal(plays.a06.corner, 'suburbs-1', "layer 2's Dealer keeps its corner");
  for (const id of ['a01', 'a02', 'a03']) assert.equal(plays[id].corner, at[id]);
  const r = g.night(plays);
  const fights = r.fights.fights.filter(f => f.kind === 'corner');
  assert.deepEqual(fights.map(f => [f.corner, f.target, f.winner]), [['strip-1', 'a01', 'a04']]);
  assert.equal(g.s.corners['strip-1'].holder, 'a04');
});

test("the fence: two seats whose spares each fill the other's empty slot swap them, the lower id offering; layer 2's lists its spare instead (§9, §19)", async () => {
  const { g, errands } = await world([every(shift), every(shift), shift, shift]);
  const tops = commons(g.s, 'top');
  const shoes = commons(g.s, 'shoes');
  g.hand('a01', tops[0], { wear: true });
  g.hand('a01', tops[1]);
  g.hand('a02', shoes[0], { wear: true });
  g.hand('a02', shoes[1]);
  g.hand('a03', tops[2], { wear: true });
  g.hand('a03', tops[3]);
  g.hand('a04', shoes[2], { wear: true });
  g.hand('a04', shoes[3]);
  for (let i = 1; i <= 4; i++) g.grant(idOf(i), N.rent * 4);
  // Two nights, so each one's holdings record from the first dawn is public.
  g.night();
  g.night();
  const offer = errands('a01', 1).filter(e => e.kind === 'fence_swap');
  assert.deepEqual(offer.map(e => [e.to, e.give.pieces, e.get.pieces]), [['a02', [tops[1]], [shoes[1]]]]);
  const answer = errands('a02', 1);
  assert.equal(answer.filter(e => e.kind === 'fence_accept').length, 1);
  assert.equal(answer.filter(e => e.kind === 'fence_swap' || e.kind === 'fence_list').length, 0, 'it waits for the lower id');
  assert.deepEqual(errands('a03', 1).filter(e => e.kind === 'fence_list').map(e => e.copy), [tops[3]]);
  g.night();
  assert.deepEqual(g.s.copies[tops[1]].holder, { k: 'agent', id: 'a02' });
  assert.deepEqual(g.s.copies[shoes[1]].holder, { k: 'agent', id: 'a01' });
});

test("the fence: a seat that wears nothing (the turtle) counts a second piece for a slot it holds as spare and lists it; layer 2's doesn't (§9)", async () => {
  const turtle = { type: 'turtle', trade: 'cop', works: true };
  const { g, errands } = await world([every(turtle), turtle, shift]);
  const tops = commons(g.s, 'top');
  g.hand('a01', tops[0]);
  g.hand('a01', tops[1]);
  g.hand('a02', tops[2]);
  g.hand('a02', tops[3]);
  for (const id of ['a01', 'a02']) g.grant(id, N.rent);
  assert.deepEqual(errands('a01', 1).filter(e => e.kind === 'fence_list').map(e => e.copy), [tops[1]], 'the lower copy stays');
  assert.equal(errands('a02', 1).filter(e => e.kind === 'fence_list').length, 0);
});

test('seasons with the trades cast: every play and errand legal, the ledger holds, nobody misses the ferry with its bail in hand, every corner fight is a contest of a held corner, the buy-late saver buys only on the list\'s last two nights, and seats spend down on the last one (§3, §9, §13, §15)', async () => {
  const { CASTS } = await bots();
  const { runSeason } = await import('../bench/runner.mjs');
  let spent = 0;
  for (const [seed, rule] of [[404, 'A'], [405, 'B'], [406, 'A']]) {
    const { dir, metrics } = runSeason({ seed, rule, outDir: path.join(tmp, 'seasons'), mix: CASTS.trades });
    const ck = JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8'));
    const log = readLog(dir);
    assert.equal(metrics.ledger.failed, 0);
    assert.deepEqual(log.filter(e => e.type === 'invalid').map(e => `${e.agent} ${e.errand || e.kind}: ${e.why}`), [], `seed ${seed}`);
    for (const m of log.filter(e => e.type === 'missed')) {
      const arrest = log.filter(e => e.type === 'arrest' && e.agent === m.agent).slice(-1)[0];
      assert.ok(m.cash < arrest.bail, `seed ${seed}: ${m.agent} missed the ferry holding ${m.cash} for a bail of ${arrest.bail}`);
    }
    const corners = log.filter(e => e.type === 'fight' && e.kind === 'corner');
    for (const f of corners) assert.ok(f.target, `seed ${seed}: a corner fight with no holder on night ${f.night}`);
    const late = new Set(ck.cast.filter(c => c.type === 'buylate').map(c => c.id));
    for (const e of log.filter(x => late.has(x.agent) && (x.type === 'bid' || (x.type === 'fence' && x.act === 'buy')))) {
      assert.ok(e.day >= N.listLastNight - 1 && e.day <= N.listLastNight, `buy-late ${e.agent} bought on day ${e.day}`);
    }
    // Spending down: on the list's last day some seat offers on more than one trait.
    const bids = {};
    for (const e of log.filter(x => x.type === 'bid' && x.day === N.listLastNight)) bids[e.agent] = (bids[e.agent] || 0) + 1;
    spent += Object.values(bids).filter(n => n > 1).length;
  }
  assert.ok(spent > 0, "no seat offered on more than one trait on the list's last day");
});
