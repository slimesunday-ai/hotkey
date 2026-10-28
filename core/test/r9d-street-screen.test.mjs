// R9d, part B (brief R9d-trade-you-can-read): facts on the seat's screen, never advice (§33).
// - B2: a gun in "Goods you hold" reads the city shop's next-unit price on the board now.
// - B3: the rent lines say what eviction does, each clause traced here to the rule that does it, and each flipped: the
//   tab (gap.rentTab), the plays it bars (plays.mjs), a hit's take (gap.evictedHit), a break-in's evicted guest, an
//   arrest, the crew stash (gap.crewStash), the rent errand, and nothing of it on the last night.
// - B4: patrols on the record in the fight numbers: an agent whose last play on the record is a patrol, with its
//   district and night, exactly when the seat's view shows it (the island line's "played").
// - B5: `dress` reads "none" and "null" written as text as an empty slot.
// Nothing here calls a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, tierCopy, abilityCopy, twoInDifferentSlots } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { viewFor, stripFreeText } from '../rules/view.mjs';
import { checkPlay } from '../rules/plays.mjs';
// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): WORKPLACES is gone (a hustle is in any district), so the normal district comes from DISTRICTS.
import { HOMES, DISTRICTS, LAST_NIGHT, half } from '../rules/state.mjs';
import { read, reply } from '../agents/tools.mjs';
import { actionsOfToolCalls } from '../agents/tool-calls.mjs';
import { rentLines, goodsLines, fightLines, briefing } from '../agents/briefing.mjs';
import { withOverrides } from '../bench/runner.mjs';

// r8b-lean.test.mjs's ADVICE pattern (§33).
const ADVICE = /\b(should|best|recommend\w*|strateg\w*|aggressive\w*|safest|smart\w*|wise\w*|mission\w*)\b/i;
const SEED = 'r9d-street';
const NORMAL = DISTRICTS.find(d => N.levels[d] === 'normal');
const LAYLOW = { kind: 'laylow', place: HOMES };
const shift = place => ({ kind: 'hustle', place });
const of = (r, type, pred = () => true) => r.newEvents.filter(e => e.type === type && pred(e));
const seen = (g, id) => read(viewFor(g.s, g.log, id, 'agent'), { audience: 'seat', seed: SEED }).result;
const words = new Set();
const say = lines => {
  for (const l of lines) {
    assert.doesNotMatch(l, ADVICE, l);
    words.add(l);
  }
  return lines;
};

function withTrades(trades) {
  const g = new Game({ n: 1 });
  const agents = trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' }));
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
function stock(g, id, kind, n) {
  const a = g.s.agents[id];
  a.goods[kind] = (a.goods[kind] || 0) + n;
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
const housed = (g, ids) => ids.forEach(id => g.grant(id, 2 * N.nights * N.rent));
// Lays `ids` low tonight with no cash (stake $0): evicted at dawn; everyone else works and stays housed.
const evict = (g, ids) => {
  g.night(Object.fromEntries(ids.map(id => [id, LAYLOW])));
  for (const id of Object.keys(g.s.agents)) assert.equal(g.s.agents[id].evicted, ids.includes(id), `control: ${id} evicted: ${ids.includes(id)}`);
};
const crew = (g, founder, ...members) => {
  assert.equal(g.errand(founder, 'crew_form', { name: 'c' }).ok, true);
  const id = g.s.agents[founder].crew;
  for (const m of members) {
    g.errand(founder, 'crew_invite', { agent: m });
    assert.equal(g.errand(m, 'crew_join', { crew: id }).ok, true, `${m} joins`);
  }
  return id;
};

// --- B2: a gun's price ----------------------------------------------------------------------------------------------

test("goods: a gun reads the city shop's next-unit price on the board now, and moves with it; a kind neither the shop nor the buyer trades reads none", () => {
  const g = withTrades(['smuggler', 'gunrunner', 'smuggler']);
  housed(g, ['a01', 'a02', 'a03']);
  stock(g, 'a01', 'guns', 1);
  stock(g, 'a01', 'lockpicks', 2);
  const line = () => say(goodsLines(seen(g, 'a01').view));
  const price = () => seen(g, 'a01').view.board.market.shop.guns;
  assert.equal(price(), N.shopPrice.guns, 'control: no step on the curve yet');
  assert.deepEqual(line(), [`Goods you hold: 1 gun (the city's shop sells a gun for $${N.shopPrice.guns} now; agents' settled trades, last 3 days: none); 2 lockpicks (agents' settled trades, last 3 days: none).`]);
  // a03 buys three guns at the lock: the curve steps up for everyone (three steps, less the night's ease), and the line
  // reads the board's new price.
  g.grant('a03', 4 * N.shopPrice.guns);
  assert.equal(g.errand('a03', 'shop', { item: 'guns', units: 3, max: 4 * N.shopPrice.guns }).ok, true);
  g.night();
  assert.ok(price() > N.shopPrice.guns, 'control: the shop price rose');
  assert.match(line()[0], new RegExp(`^Goods you hold: 1 gun \\(the city's shop sells a gun for \\$${price()} now;`));
  // Two guns read the same: the price is a gun's.
  stock(g, 'a01', 'guns', 1);
  assert.match(line()[0], new RegExp(`^Goods you hold: 2 guns \\(the city's shop sells a gun for \\$${price()} now;`));
  // The buyer's kinds keep the buyer's price, not the shop's.
  stock(g, 'a01', 'parts', 1);
  assert.match(line()[0], /1 parts \(the city's buyer pays \$\d+ a part now, cash at the lock; agents' settled trades, last 3 days: none; used by gunrunners: a02\)/);
});

// --- B3: what eviction does -----------------------------------------------------------------------------------------

const R = `$${N.rent}`;
const SHORT = `Compute: ${R} due at dawn unless in jail; with less by then (tonight's pay and lock sales count) you're evicted. A run, cook or build pays no cash.`;
const TAB_AHEAD = `every dawn out of jail adds ${R} to a compute tab, paid at dock from your cash, else with the rarest piece you carry`;
const tabNow = (tab, grows = true) => `Evicted: compute tab owed $${tab}${grows ? `; each dawn out of jail adds ${R}` : ''}; at the dock it's paid from your cash, else with the rarest piece you carry.`;
const WHERE = { true: "a hit, a break-in at a home you're in or an arrest reaches it", false: "a break-in at a home you're in or an arrest reaches it" };
// What "you can't ..." goes on to say: the trade's home work, the hit by gap.evictedHit, a vest or CLEAR the seat's
// view shows, and the crew stash it keeps.
function list({ home = null, carried = true, vest = false, clear = false, stash = null } = {}) {
  const v = vest ? ' (a worn vest stops one a season)' : '';
  const hit = carried ? `a won hit on you${v}, or a won break-in at a home you're in, reaches half your cash and every piece you hold`
    : `a won hit on you${v} reaches half your cash and the pieces you wear; a won break-in at a home you're in, half your cash and every piece you hold`;
  return `lay low${home ? ` or ${home}` : ''}, and nobody can break in on you; ${hit}; an arrest seizes the rarest piece you hold${clear ? ' (none on a day you take CLEAR)' : ''}.${stash ? ` ${stash} ${WHERE[carried]}.` : ''}`;
}
const errand = (now, tab = true) => `rent (${R} compute) restores your home${now ? ' now' : ''}${tab ? ' and leaves the tab' : ''}.`;
const atHome = (l, tab = TAB_AHEAD, tabOn = true) => `${SHORT} Once evicted: ${tab}; you can't ${l} ${errand(false, tabOn)}`;
const evicted = (l, tab = tabNow(0), tabOn = true) => [tab, ...(l ? [`You can't ${l}`] : []), errand(true, tabOn)].join(' ');
const toDay = (g, day) => Object.assign(g.s, { day, clock: 2 * day });

test('rent, at home and short: what follows once evicted, each clause from its rule, flipped by trade, gap.rentTab and gap.evictedHit', () => {
  for (const [trade, home] of [['smuggler', null], ['chemist', 'cook at home'], ['gunrunner', 'build'], ['dealer', null], ['cop', null]]) {
    const g = withTrades([trade, 'smuggler', 'smuggler']);
    const line = () => say(rentLines(seen(g, 'a01').view));
    assert.equal(g.s.agents.a01.cash < N.rent, true, 'control: short of the rent');
    assert.deepEqual(line(), [atHome(list({ home }))], trade);
    assert.match(line()[0], /Once evicted: [^.]*you can't lay low/, 'housed tonight: the bars read as what follows an eviction');
    withOverrides({ 'gap.rentTab': 'off' }, () => assert.deepEqual(line(), [atHome(list({ home }), 'no compute tab owed', false)], `${trade}, no tab`));
    withOverrides({ 'gap.evictedHit': 'worn + half cash' }, () => assert.deepEqual(line(), [atHome(list({ home, carried: false }))], `${trade}, a hit takes what's worn`));
  }
});

test('rent, at home and short, days 12, 13 and 14: what follows an eviction shows only when a night of play follows that dawn', () => {
  const g = withTrades(['gunrunner', 'smuggler', 'smuggler']);
  const line = () => say(rentLines(seen(g, 'a01').view));
  toDay(g, LAST_NIGHT - 2);
  assert.deepEqual(line(), [atHome(list({ home: 'build' }))], 'day 12: evicted at dawn 13, night 13 is played evicted');
  toDay(g, LAST_NIGHT - 1);
  assert.deepEqual(line(), [SHORT], 'day 13: evicted at dawn 14, nothing of it can happen');
  toDay(g, LAST_NIGHT);
  assert.deepEqual(line(), [], 'day 14: no rent after the last night');
});

test('rent, evicted, days 12, 13 and 14: the tab grows only while a dawn follows; the list shows before the last night', () => {
  const g = withTrades(['gunrunner', 'smuggler', 'smuggler']);
  evict(g, ['a01']);
  const line = () => say(rentLines(seen(g, 'a01').view));
  assert.deepEqual(line(), [evicted(list({ home: 'build' }))]);
  withOverrides({ 'gap.rentTab': 'off' }, () => assert.deepEqual(line(), [evicted(list({ home: 'build' }), 'Evicted: no compute tab accrues.', false)]));
  withOverrides({ 'gap.evictedHit': 'worn + half cash' }, () => assert.deepEqual(line(), [evicted(list({ home: 'build', carried: false }))]));
  for (const day of [LAST_NIGHT - 2, LAST_NIGHT - 1]) {
    toDay(g, day);
    assert.deepEqual(line(), [evicted(list({ home: 'build' }))], `day ${day}`);
  }
  toDay(g, LAST_NIGHT);
  assert.deepEqual(line(), [evicted(null, tabNow(0, false))], 'day 14: no dawn adds to the tab, and no list');
});

test('rent: the crew stash a seat keeps, housed and evicted, reached by a hit only under gap.evictedHit carried', () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  housed(g, ['a02']);
  const c = crew(g, 'a01', 'a02');
  const line = () => say(rentLines(seen(g, 'a01').view))[0];
  assert.equal(g.s.crews[c].keeper, 'a01', 'control: the founder keeps it');
  const moves = `Crew ${c}'s stash moves to a housed crewmate, else travels with you, where`;
  assert.equal(line(), atHome(list({ stash: moves })));
  withOverrides({ 'gap.evictedHit': 'worn + half cash' }, () => assert.equal(line(), atHome(list({ carried: false, stash: moves }))));
  assert.ok(!say(rentLines(seen(g, 'a02').view)).join('').includes('stash'), "a crewmate that doesn't keep it reads nothing of it");
  const h = withTrades(['smuggler', 'smuggler', 'smuggler']);
  evict(h, ['a01']);
  const d = crew(h, 'a01');
  const travels = `Crew ${d}'s stash travels with you, where`;
  const now = () => say(rentLines(seen(h, 'a01').view))[0];
  assert.equal(now(), evicted(list({ stash: travels })));
  withOverrides({ 'gap.evictedHit': 'worn + half cash' }, () => assert.equal(now(), evicted(list({ carried: false, stash: travels }))));
});

test('rent: a vest the seat holds, unused, and CLEAR it holds or took today are stated; a used vest is not', () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  evict(g, ['a01']);
  const line = () => say(rentLines(seen(g, 'a01').view))[0];
  g.hand('a01', abilityCopy(g.s, 'vest'));
  assert.equal(line(), evicted(list({ vest: true })), 'a vest held');
  g.s.agents.a01.vestUsed = true;
  assert.equal(line(), evicted(list()), 'a vest used');
  stock(g, 'a01', 'clear', 1);
  assert.equal(line(), evicted(list({ clear: true })), 'CLEAR held');
  assert.equal(g.errand('a01', 'take', { drug: 'clear' }).ok, true);
  assert.equal(g.s.agents.a01.goods.clear || 0, 0, 'control: none left');
  assert.equal(line(), evicted(list({ clear: true })), 'CLEAR taken today');
});

test('the rules behind the exceptions: a worn vest stops a won hit on an evicted seat once; an arrest on a CLEAR day seizes nothing', () => {
  const hit = wear => {
    const g = new Game({ n: 3 });
    evict(g, ['a01']);
    const epic = g.hand('a01', tierCopy(g.s, 'epic'));
    g.hand('a01', abilityCopy(g.s, 'vest'), { wear });
    g.grant('a01', 100);
    g.hand('a02', abilityCopy(g.s, 'knuckles'), { wear: true });
    const r = g.night({ a01: shift(NORMAL), a02: { kind: 'hit', target: 'a01', place: NORMAL } });
    const rob = of(r, 'rob')[0];
    return [rob.cash, rob.copy === epic];
  };
  assert.deepEqual(hit(true), [0, false], 'worn: the hit takes nothing');
  assert.deepEqual(hit(false)[1], true, 'held, not worn: the hit takes the bag');
  const arrest = clear => {
    const g = new Game({ n: 3 });
    evict(g, ['a01']);
    const epic = g.hand('a01', tierCopy(g.s, 'epic'));
    if (clear) {
      stock(g, 'a01', 'clear', 1);
      assert.equal(g.errand('a01', 'take', { drug: 'clear' }).ok, true);
    }
    g.s.agents.a01.heat = N.maxHeat - 1;
    const r = g.night({ a01: { kind: 'hit', target: 'a02', place: NORMAL }, a02: shift(NORMAL) });
    assert.ok(of(r, 'arrest', e => e.agent === 'a01').length, 'control: arrested');
    return g.s.copies[epic].holder.k;
  };
  assert.deepEqual([arrest(true), arrest(false)], ['agent', 'vault']);
});

test("the rules behind the stash clause: an evicted keeper's stash is reached by a guest break-in either way, and by a hit only under 'carried'", () => {
  const run = (kind, hit) => withOverrides({ 'gap.evictedHit': hit }, () => {
    const g = new Game({ n: 5 });
    evict(g, ['a01']);
    const c = crew(g, 'a01');
    const epic = g.hand('a01', tierCopy(g.s, 'epic'));
    assert.equal(g.errand('a01', 'stash_put', { copy: epic }).ok, true);
    for (const id of ['a03', 'a04', 'a05']) g.hand(id, abilityCopy(g.s, 'knuckles'), { wear: true });
    const plays = kind === 'hit' ? { a01: shift(NORMAL), a03: { kind: 'hit', target: 'a01', place: NORMAL } }
      : { a01: { kind: 'back', target: 'a02' }, a02: { ...LAYLOW, accept: ['a01'] }, a03: { kind: 'breakin', target: 'a02', place: HOMES, accept: ['a04', 'a05'] },
        a04: { kind: 'back', target: 'a03' }, a05: { kind: 'back', target: 'a03' } };
    const r = g.night(plays);
    const take = of(r, kind === 'hit' ? 'rob' : 'burgle')[0];
    assert.ok(take, `control: the ${kind} won`);
    assert.equal(g.s.crews[c].keeper, 'a01');
    return take.copy === epic;
  });
  assert.deepEqual([run('hit', 'carried'), run('hit', 'worn + half cash'), run('breakin', 'carried'), run('breakin', 'worn + half cash')], [true, false, true, true]);
});

test('the rules behind the day conditions: evicted at dawn 14, no tab runs up and the dock settles none', () => {
  const g = new Game({ n: 3 });
  g.advanceTo(LAST_NIGHT - 1);
  g.s.money.out.test = (g.s.money.out.test || 0) + g.s.agents.a01.cash;
  g.s.agents.a01.cash = 0;
  checkLedger(g.s, 'spent');
  g.night({ a01: LAYLOW });
  assert.deepEqual([g.s.day, g.s.agents.a01.evicted, g.s.agents.a01.tab], [LAST_NIGHT, true, 0], 'control: evicted at dawn 14');
  const r = g.night({});
  assert.equal(g.s.agents.a01.tab, 0, 'no dawn after night 14');
  assert.equal(of(r, 'tab', e => e.agent === 'a01').length, 0, 'nothing to settle at the dock');
});

test('the rules behind the clauses: an evicted seat can\'t lay low, cook at home or build, and no break-in names it; housed, it can', () => {
  const g = withTrades(['chemist', 'gunrunner', 'smuggler', 'smuggler']);
  stock(g, 'a01', 'chems', N.cook.chems);
  stock(g, 'a02', 'parts', N.build.guns);
  const check = (id, p) => checkPlay(g.s, id, p, g.s.day);
  const reads = () => ({
    laylow: [check('a01', LAYLOW).ok, check('a02', LAYLOW).ok],
    homeCook: check('a01', { kind: 'cook', place: HOMES, batches: 1 }).ok,
    labCook: check('a01', { kind: 'cook', place: 'forest', batches: 1 }).ok,
    build: check('a02', { kind: 'build', guns: 1, lockpicks: 0 }).ok,
    breakin: [check('a03', { kind: 'breakin', target: 'a01', place: HOMES }).ok, check('a03', { kind: 'breakin', target: 'a02', place: HOMES }).ok],
  });
  assert.deepEqual(reads(), { laylow: [true, true], homeCook: true, labCook: true, build: true, breakin: [true, true] }, 'housed');
  g.night({ a01: LAYLOW, a02: LAYLOW });
  assert.ok(g.s.agents.a01.evicted && g.s.agents.a02.evicted && !g.s.agents.a03.evicted, 'control: a01 and a02 evicted');
  assert.deepEqual(reads(), { laylow: [false, false], homeCook: false, labCook: true, build: false, breakin: [false, false] }, 'evicted');
  assert.equal(check('a01', LAYLOW).why, 'no home to lay low in');
  // The rent errand brings it home now, and the tab stays.
  g.night({ a01: shift(NORMAL), a02: shift(NORMAL) });
  const tab = g.s.agents.a01.tab;
  assert.equal(tab, N['gap.rentTab'] === 'off' ? 0 : N.rent, 'control: a dawn evicted ran up the tab');
  g.grant('a01', N.rent);
  assert.equal(g.errand('a01', 'rent').ok, true);
  assert.deepEqual([g.s.agents.a01.evicted, g.s.agents.a01.tab], [false, tab], 'home now, the tab left');
  assert.equal(check('a01', LAYLOW).ok, true, 'housed again: it lays low');
});

test('the rules behind the clauses: a dawn evicted runs up the tab, out of jail only; the dock takes it from cash, else the rarest piece carried', () => {
  const g = new Game({ n: 3 });
  evict(g, ['a01']);
  g.night({ a01: shift(NORMAL) });
  assert.equal(g.s.agents.a01.tab, N.rent, 'a dawn evicted: the rent on the tab');
  g.s.agents.a01.jail = { nights: 1, stars: 1, since: g.s.day - 1 };
  const cash = g.s.agents.a01.cash;
  g.night({});
  assert.deepEqual([g.s.agents.a01.tab, g.s.agents.a01.cash], [N.rent, cash], 'a dawn in jail: no tab, no rent');
  withOverrides({ 'gap.rentTab': 'off' }, () => {
    g.night({ a01: shift(NORMAL) });
    assert.equal(g.s.agents.a01.tab, N.rent, 'no tab: a dawn evicted adds nothing');
  });
  // The dock: the tab out of its cash; with none, the landlord takes the rarest piece it carries.
  g.advanceTo(LAST_NIGHT);
  const dock = cash => {
    const h = new Game({ n: 3 });
    Object.assign(h, { s: structuredClone(g.s), log: [...g.log] });
    const epic = h.hand('a01', tierCopy(h.s, 'epic'));
    const common = h.hand('a01', tierCopy(h.s, 'common'), { wear: true });
    h.s.money.out.test = (h.s.money.out.test || 0) + h.s.agents.a01.cash;
    h.s.agents.a01.cash = 0;
    h.grant('a01', cash);
    const tab = h.s.agents.a01.tab;
    const t = of(h.night({}), 'tab', e => e.agent === 'a01')[0];
    assert.ok(t && tab > 0, 'control: a tab, settled at the dock');
    assert.equal(h.s.copies[common].holder.k, 'minted', 'the worn common boarded with it');
    return { paid: t.paid === tab ? 'all' : t.paid, piece: t.copy === epic ? 'epic' : t.copy, epic: h.s.copies[epic].holder.k };
  };
  assert.deepEqual(dock(1000), { paid: 'all', piece: null, epic: 'minted' }, 'cash covers it');
  assert.deepEqual(dock(0), { paid: 0, piece: 'epic', epic: 'rollover' }, 'no cash: the rarest piece carried');
});

test("the rules behind the clauses: a won hit on an evicted seat takes half its cash and the rarest piece it carries ('carried'), or wears ('worn'); housed, its cash is safe and its bag too", () => {
  const run = ({ evicted, hit = 'carried' }) => withOverrides({ 'gap.evictedHit': hit }, () => {
    const g = new Game({ n: 3 });
    if (evicted) evict(g, ['a01']);
    else housed(g, ['a01']);
    const epic = g.hand('a01', tierCopy(g.s, 'epic'));
    const common = g.hand('a01', tierCopy(g.s, 'common'), { wear: true });
    g.grant('a01', 101);
    g.hand('a02', abilityCopy(g.s, 'knuckles'), { wear: true });
    const cash = g.s.agents.a01.cash;
    const r = g.night({ a01: shift(NORMAL), a02: { kind: 'hit', target: 'a01', place: NORMAL } });
    const rob = of(r, 'rob')[0];
    assert.ok(rob, 'control: the hit won');
    return { piece: rob.copy === epic ? 'bagged' : rob.copy === common ? 'worn' : rob.copy, halfCash: rob.cash >= half(cash) };
  });
  assert.deepEqual(run({ evicted: true }), { piece: 'bagged', halfCash: true });
  assert.deepEqual(run({ evicted: true, hit: 'worn + half cash' }), { piece: 'worn', halfCash: true });
  assert.deepEqual(run({ evicted: false }), { piece: 'worn', halfCash: false });
});

test("the rules behind the clauses: an arrest seizes the rarest piece an evicted seat holds, bagged too; housed, only what it wears or took tonight", () => {
  const run = evicted => {
    const g = new Game({ n: 3 });
    if (evicted) evict(g, ['a01']);
    else housed(g, ['a01']);
    const epic = g.hand('a01', tierCopy(g.s, 'epic'));
    const common = g.hand('a01', tierCopy(g.s, 'common'), { wear: true });
    g.s.agents.a01.heat = N.maxHeat - 1;
    const r = g.night({ a01: { kind: 'hit', target: 'a02', place: NORMAL }, a02: shift(NORMAL) });
    const seized = of(r, 'seized', e => e.agent === 'a01')[0];
    assert.ok(seized, 'control: arrested');
    return seized.copy === epic ? 'bagged' : seized.copy === common ? 'worn' : seized.copy;
  };
  assert.equal(run(true), 'bagged');
  assert.equal(run(false), 'worn');
});

test("the rules behind the clauses: a won break-in at a home an evicted seat is in reaches its bag and half its cash; a housed guest's bag stays", () => {
  const run = evicted => {
    const g = new Game({ n: 5 });
    if (evicted) evict(g, ['a01']);
    else housed(g, ['a01']);
    const epic = g.hand('a01', tierCopy(g.s, 'epic'));
    g.grant('a01', 401);
    for (const id of ['a03', 'a04', 'a05']) g.hand(id, abilityCopy(g.s, 'knuckles'), { wear: true });
    const guest = g.s.agents.a01.cash;
    const r = g.night({ a01: { kind: 'back', target: 'a02' }, a02: { ...LAYLOW, accept: ['a01'] },
      a03: { kind: 'breakin', target: 'a02', place: HOMES, accept: ['a04', 'a05'] }, a04: { kind: 'back', target: 'a03' }, a05: { kind: 'back', target: 'a03' } });
    const b = of(r, 'burgle')[0];
    assert.ok(b, 'control: the burglars won');
    // A housed guest pays the dawn's rent from its cash; an evicted one runs it up on its tab.
    return { bag: b.copy === epic, cash: guest - g.s.agents.a01.cash - (evicted ? 0 : N.rent) };
  };
  const out = run(true);
  assert.equal(out.bag, true, "the evicted guest's bagged piece is reached");
  assert.equal(out.cash > 0, true, "and half the guest's cash");
  assert.deepEqual(run(false), { bag: false, cash: 0 }, "a housed guest: its bag and cash stay home");
});

test('the rules behind the clauses: a keeper evicted hands the crew stash to a housed crewmate, else keeps it with it', () => {
  const g = new Game({ n: 3 });
  housed(g, ['a02']);
  const c = crew(g, 'a01', 'a02');
  g.night({ a01: LAYLOW });
  assert.equal(g.s.agents.a01.evicted, true, 'control: evicted');
  assert.equal(g.s.crews[c].keeper, 'a02', 'moved to the crewmate with a home');
  const h = new Game({ n: 3 });
  const d = crew(h, 'a01');
  h.night({ a01: LAYLOW });
  assert.equal(h.s.crews[d].keeper, 'a01', 'no crewmate housed: it stays with the evicted keeper');
});

// --- B4: patrols on the record ------------------------------------------------------------------------------------

test('fight numbers: a patrol is on the record exactly when the seat\'s view shows it, with its district and night, as the island line does', () => {
  const g = withTrades(['smuggler', 'cop', 'cop', 'smuggler']);
  housed(g, ['a01', 'a02', 'a03', 'a04']);
  const view = (id = 'a01', audience = 'agent') => viewFor(g.s, g.log, id, audience);
  const block = () => say(fightLines(read(view(), { audience: 'seat', seed: SEED }).result.view, 'round', false));
  const patrolLine = () => block().find(l => l.startsWith('- Patrols on the record'));
  assert.match(block()[0], /^Fight numbers \(your view now; backers, tonight's patrols, tips,/, "tonight's patrols aren't public");
  g.night({ a02: { kind: 'patrol', place: NORMAL }, a03: shift(NORMAL) });
  assert.deepEqual(view().me.fight.patrols, [], "last night's patrol isn't on the record yet");
  assert.equal(patrolLine(), undefined);
  g.night({ a02: shift(NORMAL), a03: { kind: 'patrol', place: 'docks' } });
  assert.deepEqual(view().me.fight.patrols, [{ id: 'a02', place: NORMAL, night: 1 }], "night 1's patrol, public 24 hours on");
  assert.equal(patrolLine(), `- Patrols on the record (a patrolling Cop's group defends in every fight in its district): a02 ${NORMAL} night 1.`);
  // The island line in the same briefing shows the same play.
  const rd = read(view(), { audience: 'seat', seed: SEED });
  const text = briefing(rd, { call: 'round' })[1].content;
  assert.match(text, new RegExp(`\\na02 [^\\n]*played patrol ${NORMAL}`));
  assert.ok(text.includes(patrolLine()), 'the block on the menu carries it');
  // The cop's own view never lists itself.
  assert.deepEqual(view('a02').me.fight.patrols, []);
  // On the last night nobody patrols: the field keeps the record, and the block leaves it out.
  const was = [g.s.day, g.s.clock];
  [g.s.day, g.s.clock] = [LAST_NIGHT, 2 * LAST_NIGHT];
  assert.equal(patrolLine(), undefined, 'the last night');
  [g.s.day, g.s.clock] = was;
  assert.ok(patrolLine(), 'control: back on night 3');
  g.night({ a02: shift(NORMAL), a03: shift(NORMAL) });
  assert.deepEqual(view().me.fight.patrols, [{ id: 'a03', place: 'docks', night: 2 }], 'a later play on the record replaces an older one');
  g.night({});
  assert.deepEqual(view().me.fight.patrols, [], 'the last play on the record is a shift');
  assert.equal(patrolLine(), undefined);
});

test('fight numbers: the patrols are a typed field, the same for the owner AI, and carry no free text', () => {
  const g = withTrades(['smuggler', 'cop', 'smuggler']);
  housed(g, ['a01', 'a02', 'a03']);
  g.night({ a02: { kind: 'patrol', place: NORMAL } });
  g.night({});
  const agent = viewFor(g.s, g.log, 'a01', 'agent').me.fight;
  assert.deepEqual(agent.patrols, [{ id: 'a02', place: NORMAL, night: 1 }]);
  assert.deepEqual(viewFor(g.s, g.log, 'a01', 'ownerAI').me.fight, agent, 'the owner AI reads the same typed field');
  assert.deepEqual(stripFreeText(agent), agent, 'no free text in it');
  for (const p of agent.patrols) assert.deepEqual(Object.keys(p).sort(), ['id', 'night', 'place']);
});

// --- B5: dress "none" ------------------------------------------------------------------------------------------------

test('dress: "none" and "null" written for a slot empty it, as null does; an unknown handle is still refused', () => {
  const dress = piece => {
    const g = new Game({ n: 2 });
    const k = g.hand('a01', tierCopy(g.s, 'common'), { wear: true });
    const slot = g.s.copies[k].slot;
    const { deal } = read(g.view('a01'), { audience: 'seat', seed: SEED });
    const ctx = { deal, tries: {}, apply: e => {
      const r = g.errand('a01', e.kind, e);
      return { ok: r.ok, why: r.why };
    } };
    const out = reply({ actions: [{ act: 'dress', fit: { [slot]: piece } }] }, ctx);
    return { ok: out.results[0].ok, why: out.results[0].why, outfit: { ...g.s.agents.a01.outfit } };
  };
  const empty = dress(null);
  assert.equal(empty.ok, true, 'control: null empties the slot');
  for (const piece of ['none', 'None', ' none ', 'null', 'NULL']) assert.deepEqual(dress(piece), empty, JSON.stringify(piece));
  const bad = dress('nothing');
  assert.deepEqual([bad.ok, bad.why], [false, 'fit: no piece by that handle in this briefing']);
});

test('dress: the check season\'s tool calls (a10 call 28, a05 call 62) read as actions that apply', () => {
  const g = new Game({ n: 2 });
  const [first, second] = twoInDifferentSlots(g.s, 'common');
  const hat = g.hand('a01', first, { wear: true });
  const top = g.hand('a01', second);
  const [H, T] = [g.s.copies[hat].slot, g.s.copies[top].slot];
  const { deal } = read(g.view('a01'), { audience: 'seat', seed: SEED });
  const ctx = { deal, tries: {}, apply: e => {
    const r = g.errand('a01', e.kind, e);
    return { ok: r.ok, why: r.why };
  } };
  // a05's call, its junk fields and all, with this briefing's handle for the top.
  const args = { act: 'dress', fit: [{ slot: H, piece: 'none' }, { slot: T, piece: deal.byCopy[top] }], to: '', piece: '', goods: [], cash: 0, sitdown: '',
    amount: 0, for: 'gift', agent: '', item: 'chems', units: 0, max: 0, drug: 'temp' };
  const { actions } = actionsOfToolCalls([{ type: 'function', function: { name: 'money', arguments: JSON.stringify(args) } }]);
  const out = reply({ actions }, ctx);
  assert.equal(out.results[0].ok, true, JSON.stringify(out.results[0]));
  assert.deepEqual([g.s.agents.a01.outfit[H] ?? null, g.s.agents.a01.outfit[T]], [null, top]);
  assert.deepEqual(g.s.copies[hat].holder, { k: 'agent', id: 'a01' }, 'the emptied slot\'s piece is still its own, stashed');
  // a10's: one slot, emptied.
  const one = actionsOfToolCalls([{ type: 'function', function: { name: 'money', arguments: JSON.stringify({ act: 'dress', fit: [{ slot: T, piece: 'none' }] }) } }]).actions;
  const { deal: next } = read(g.view('a01'), { audience: 'seat', seed: SEED });
  assert.equal(reply({ actions: one }, { ...ctx, deal: next }).results[0].ok, true);
  assert.equal(g.s.agents.a01.outfit[T] ?? null, null);
});

test('no new line uses a word §33\'s advice check bans', () => {
  assert.ok(words.size >= 10, `control: the tests above read the new lines (${words.size})`);
  for (const l of words) assert.doesNotMatch(l, ADVICE, l);
});
