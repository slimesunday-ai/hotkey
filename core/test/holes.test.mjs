// The hiding places and the cheap ways out that the 10-15 mechanics review found in layers 2 and 3 (brief
// R1-layer3-tricks.md, "After the mechanics review (10-15)", L3-6; GAME.md §7, §10, §12, §13, §15, §41), with the rows
// in core/numbers.mjs (gap.bounty, gap.crewStash, gap.evictedHit, gap.bribe, gap.tip). Every amount comes from N, and
// every expected value was worked out from GAME.md, the brief and those rows before the code ran.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, abilityCopy, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { resolveFights } from '../rules/fights.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { viewFor } from '../rules/view.mjs';
// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): WORKPLACES is gone (a hustle is in any district), so the normal district comes from DISTRICTS.
import { DAY15, DISTRICTS, HOMES, half } from '../rules/state.mjs';
import { N } from '../numbers.mjs';

const hit = (target, place) => ({ kind: 'hit', target, place });
const back = target => ({ kind: 'back', target });
const shift = place => ({ kind: 'hustle', place });
const breakin = target => ({ kind: 'breakin', target, place: HOMES });
// The share of a home's cash a won break-in takes: its owner's and a crew stash kept there (§7, breakinShare).
const share = cash => Math.floor(cash * N.breakinShare);
const LAYLOW = { kind: 'laylow', place: HOMES };
// A workplace whose cops are normal (§6): city cops come there for a wanted attacker or a tip, and for nothing else.
const NORMAL = DISTRICTS.find(d => N.levels[d] === 'normal');
// A drop in a lawless district (§6, §9): city cops never come there.
const LAWLESS = Object.keys(N.drops).find(d => N.levels[d] === 'lawless');
const both = (name, fn) => {
  for (const rule of ['A', 'B']) test(`${name} (rule ${rule})`, () => fn(rule));
};
const of = (r, type, pred = () => true) => r.newEvents.filter(e => e.type === type && pred(e));
const fightOn = (r, kind, target) => r.newEvents.find(e => e.type === 'fight' && e.kind === kind && e.target === target);
// The same, in what resolveFights returns.
const fightIn = (R, kind, target) => R.fights.find(f => f.kind === kind && f.target === target);
const arrested = r => of(r, 'arrest').map(e => e.agent).sort();
// Brass knuckles, worn: +1 attacking (§8).
const armed = (g, id) => g.hand(id, abilityCopy(g.s, 'knuckles'), { wear: true });
const post = (g, by, fields) => {
  const r = g.errand(by, 'bounty', fields);
  assert.equal(r.ok, true, `${by} posts ${JSON.stringify(fields)}`);
  return r.events.find(e => e.type === 'bounty').bounty;
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
// Night 1 with no income for the agents named: they can't pay the rent, so they're evicted at dawn (§10).
const evict = (g, ids) => {
  g.night(Object.fromEntries(ids.map(id => [id, LAYLOW])));
  for (const id of Object.keys(g.s.agents)) assert.equal(g.s.agents[id].evicted, ids.includes(id), `control: ${id} evicted: ${ids.includes(id)}`);
};
// A season whose agents have the trades named, in id order (the helpers' cast is all Smugglers).
function withTrades(trades) {
  const g = new Game({ n: 1 });
  const agents = trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' }));
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
// Fight-level agents at the lock, as settleNight passes them (§8, §13): nobody armed, wanted or hot unless it says so.
const agentsOf = (ids, overrides = {}) => Object.fromEntries(ids.map(id => [id, {
  home: true, jailed: false, crew: null, wanted: false, heat: 0, knuckles: false, runners: false, ...overrides[id],
}]));
const levelsAt = level => Object.fromEntries(DISTRICTS.map(d => [d, level]));

// --- 1. A bounty is no safe (§10, §15) ------------------------------------------------------------------------------

test('a bounty nobody earned is gone with the ferry: its cash leaves the island at a sink of its own and never comes back to its poster (§10, §15, GAP gap.bounty)', () => {
  const lastNight = bank => {
    const g = new Game({ n: 3 });
    g.advanceTo(N.nights);
    const cash = g.s.agents.a01.cash;
    assert.ok(cash > 0, 'control: its shifts left it cash');
    const b = bank ? post(g, 'a01', { agent: 'a02', amount: cash }) : null;
    const r = g.night();
    return { g, r, b, cash, minted: of(r, 'mint', e => e.agent === 'a01')[0].cash };
  };
  const plain = lastNight(false);
  assert.equal(plain.minted, plain.cash, 'control: not posted, its cash boards with it');
  const banked = lastNight(true);
  assert.equal(banked.minted, 0, 'posted on an agent nobody robbed, none of it boards');
  assert.equal(banked.g.s.money.out.bounty, banked.cash, 'it left the island at the bounty sink');
  assert.deepEqual(of(banked.r, 'bounty').map(e => [e.act, e.bounty, e.by, e.agent, e.amount]), [['gone', banked.b, 'a01', 'a02', banked.cash]]);
  assert.deepEqual([banked.g.s.offers, banked.g.s.bounties], [[], []], 'nothing is held after the ferry');
  // §19: the last night's private record is its poster's until day 15, so nobody else learns who posted it.
  const before = structuredClone(banked.g.s);
  before.clock = DAY15 - 1;
  const seen = who => viewFor(before, banked.g.log, who).events.some(e => e.type === 'bounty' && e.act === 'gone');
  assert.ok(seen('a01'), 'positive control: its poster sees it go');
  for (const who of ['a02', 'a03']) assert.ok(!seen(who), `${who}: not before day 15`);
});

// --- 2. The squatter's homeless stash (§10, §12) -------------------------------------------------------------------

test('a keeper is re-homed when a member with a home joins: the stash is at that home, and a break-in reaches it (§12, GAP gap.crewStash)', () => {
  const g = new Game({ n: 3 });
  evict(g, ['a01']);
  const c = crew(g, 'a01');
  assert.equal(g.s.crews[c].keeper, 'a01', 'control: its evicted founder keeps it while no member has a home');
  g.errand('a01', 'crew_invite', { agent: 'a02' });
  g.errand('a02', 'crew_join', { crew: c });
  assert.equal(g.s.crews[c].keeper, 'a02', 'a member with a home joined');
  const grail = g.hand('a02', tierCopy(g.s, 'grail'));
  g.grant('a02', 301);
  assert.equal(g.errand('a02', 'stash_put', { copy: grail, cash: 201 }).ok, true);
  const cash = g.s.agents.a02.cash;
  armed(g, 'a03');
  const r = g.night({ a02: shift(NORMAL), a03: breakin('a02') });
  assert.equal(fightOn(r, 'breakin', 'a02').won, true, "control: 2 against an empty home's lock");
  const b = of(r, 'burgle')[0];
  assert.deepEqual([b.copy, b.from, b.cash], [grail, `crew:${c}`, share(cash) + share(201)], "the stash's grail, and the break-in's share of the cash there");
});

test('a keeper is re-homed when a member pays its rent (§10, §12, GAP gap.crewStash)', () => {
  const g = new Game({ n: 3 });
  evict(g, ['a01', 'a02']);
  const c = crew(g, 'a01', 'a02');
  assert.equal(g.s.crews[c].keeper, 'a01', 'control: no member has a home');
  const epic = g.hand('a01', tierCopy(g.s, 'epic'));
  g.errand('a01', 'stash_put', { copy: epic });
  g.grant('a02', N.rent);
  assert.equal(g.errand('a02', 'rent').ok, true);
  assert.equal(g.s.crews[c].keeper, 'a02', 'a member has a home again');
  armed(g, 'a03');
  const r = g.night({ a01: shift(NORMAL), a02: shift(NORMAL), a03: breakin('a02') });
  assert.equal(of(r, 'burgle')[0].copy, epic, "a break-in on a02's home reaches the stash");
});

test("a stash with no member's home travels with its keeper: an arrest seizes from it and fines half its cash too (§10, §13, GAP gap.crewStash)", () => {
  const g = new Game({ n: 3 });
  evict(g, ['a01']);
  const c = crew(g, 'a01');
  const epic = g.hand('a01', tierCopy(g.s, 'epic'));
  const worn = g.hand('a01', tierCopy(g.s, 'common'), { wear: true });
  g.grant('a01', 301);
  assert.equal(g.errand('a01', 'stash_put', { copy: epic, cash: 201 }).ok, true);
  const [cash, stash, vault] = [g.s.agents.a01.cash, g.s.crews[c].cash, g.s.vault.cash];
  // A crime at one star short of 5: it's arrested tonight whether its hit wins or loses (§13).
  g.s.agents.a01.heat = N.maxHeat - 1;
  const r = g.night({ a01: hit('a02', NORMAL), a02: shift(NORMAL) });
  const arrest = of(r, 'seized', e => e.agent === 'a01')[0];
  assert.ok(arrest, 'control: arrested');
  assert.equal(arrest.copy, epic, "the rarest piece on it is the stash's epic");
  assert.deepEqual([g.s.copies[epic].holder, g.s.copies[worn].holder], [{ k: 'vault' }, { k: 'agent', id: 'a01' }]);
  assert.equal(arrest.fine, half(cash) + half(stash), "half its own cash and half the stash's");
  assert.deepEqual([g.s.crews[c].cash, g.s.vault.cash], [stash - half(stash), vault + arrest.fine]);
});

test("a break-in reaches an evicted guest's bag and half its cash: with no home, everything it owns is on it (§7, §10)", () => {
  const g = new Game({ n: 5 });
  evict(g, ['a01']);
  const epic = g.hand('a01', tierCopy(g.s, 'epic'));
  g.grant('a01', 401);
  for (const id of ['a03', 'a04', 'a05']) armed(g, id);
  const [guest, host] = [g.s.agents.a01.cash, g.s.agents.a02.cash];
  // The lock, the host and its guest, and the lay low: 4, against three armed burglars' 6 (§8). R4-2 (gap.accept): the
  // host accepts its guest, and the burglars' leader its backers.
  const r = g.night({ a01: back('a02'), a02: { ...LAYLOW, accept: ['a01'] }, a03: { ...breakin('a02'), accept: ['a04', 'a05'] }, a04: back('a03'), a05: back('a03') });
  assert.equal(fightOn(r, 'breakin', 'a02').won, true, 'control: the burglars won');
  const b = of(r, 'burgle')[0];
  assert.equal(b.copy, epic, "the guest's bagged epic was the rarest piece inside");
  assert.deepEqual(g.s.copies[epic].holder, { k: 'agent', id: 'a03' });
  assert.equal(b.cash, share(host) + half(guest), "the break-in's share of the host's cash, and half the guest's");
  assert.equal(g.s.agents.a01.cash, guest - half(guest));
});

// --- 3. No bribe by proxy (§13, call 6) -----------------------------------------------------------------------------

test("a bribe is checked at the lock against the hottest agent on the briber's side: a 0-star backer's buys a wanted robber nothing, and is spent anyway (§13, call 6, GAP gap.bribe)", () => {
  const night = briber => {
    const g = new Game({ n: 3 });
    g.s.agents.a01.heat = N.wantedAt;
    for (const id of ['a01', 'a02']) g.grant(id, N.bribe[N.wantedAt]);
    if (briber) assert.equal(g.errand(briber, 'bribe', { target: 'a03' }).ok, true, `${briber} bribes`);
    // R4-2 (gap.accept): the robber accepts its backer, so the backer is on its side.
    const r = g.night({ a01: { ...hit('a03', NORMAL), accept: ['a02'] }, a02: back('a01'), a03: shift(NORMAL) });
    return { g, r, f: fightOn(r, 'hit', 'a03') };
  };
  const plain = night(null);
  assert.ok(plain.f.cops > 0 && !plain.f.won, 'control: the city cops come for the wanted robber, and its group loses');
  assert.deepEqual(arrested(plain.r), ['a01', 'a02']);
  const proxy = night('a02');
  assert.deepEqual([proxy.f.cops, proxy.f.defence, proxy.f.won], [plain.f.cops, plain.f.defence, false], "its 0-star backer's bribe keeps no cops out");
  assert.deepEqual(arrested(proxy.r), ['a01', 'a02']);
  assert.equal(proxy.g.s.money.out.bribe, N.bribe[0], 'and it was spent all the same');
  const own = night('a01');
  assert.deepEqual([own.f.cops, own.f.won], [0, true], "at the robber's own stars' price the cops stay out: 2 against 1");
});

test("a 0-star guest's bribe keeps no cops off a collar on a hotter agent; the agent's own does (§13, call 6, GAP gap.bribe)", () => {
  const stars = N.maxHeat - 1;
  const night = briber => {
    const g = withTrades(['cop', 'smuggler', 'smuggler', 'smuggler']);
    g.s.agents.a02.heat = stars;
    for (const id of ['a01', 'a04']) armed(g, id);
    for (const id of ['a02', 'a03']) g.grant(id, N.bribe[stars]);
    if (briber) assert.equal(g.errand(briber, 'bribe', { target: 'a02' }).ok, true, `${briber} bribes`);
    // R4-2 (gap.accept): the Cop accepts its backer, and the collared agent its guest, so the guest is on its side.
    const r = g.night({ a01: { kind: 'collar', target: 'a02', place: HOMES, accept: ['a04'] }, a04: back('a01'), a02: { ...LAYLOW, accept: ['a03'] }, a03: back('a02') });
    return { g, f: fightOn(r, 'collar', 'a02') };
  };
  const plain = night(null);
  assert.ok(plain.f.cops > 0 && plain.f.won, "control: the Cop's group and the city cops beat the home");
  const proxy = night('a03');
  assert.deepEqual([proxy.f.cops, proxy.f.won], [plain.f.cops, true], "the guest's bribe, at its own 0 stars, keeps no cops out");
  assert.ok(proxy.g.s.agents.a02.jail);
  assert.equal(night('a02').f.cops, 0, 'its own bribe, at its own stars, does');
});

both("the briber's side is every group attacking in its fight, as the cops it keeps out are (call 6, GAP gap.bribe)", rule => {
  const agents = agentsOf(['x', 'z', 'y'], { x: { heat: N.wantedAt, wanted: true } });
  const plays = { x: hit('y', NORMAL), z: hit('y', NORMAL), y: shift(NORMAL) };
  const run = bribes => fightIn(resolveFights({ agents, plays, levels: levelsAt('normal'), rule, bribes }), 'hit', 'y');
  assert.equal(run([]).cops, N.copsWanted, 'control: the city cops come for the wanted attacker');
  assert.equal(run([{ by: 'z', target: 'y' }]).cops, N.copsWanted, "z's bribe at 0 stars doesn't cover x's");
  assert.equal(run([{ by: 'x', target: 'y' }]).cops, 0, "x's own does");
});

// --- 4. No bounty farming (§10, §21) --------------------------------------------------------------------------------

test('a bounty on an agent pays only when the fight took a piece or cash from it: a won hit that took neither, only a haul, earns nothing (§10, GAP gap.bounty)', () => {
  const g = new Game({ n: 4 });
  armed(g, 'a02');
  g.grant('a03', 600);
  const b = post(g, 'a03', { agent: 'a01', amount: 600 });
  // a01 is out on a run, which pays no cash tonight (a shift's wage would go with the hit: §7, GAP gap.holdup).
  const empty = g.night({ a01: { kind: 'run', place: LAWLESS }, a02: hit('a01', LAWLESS) });
  const rob = of(empty, 'rob')[0];
  assert.deepEqual([fightOn(empty, 'hit', 'a01').won, rob.copy, rob.cash], [true, null, 0], 'control: a won hit, mid-season, on an agent wearing nothing and paid no cash tonight');
  assert.ok(rob.goods && Object.keys(rob.goods).length > 0, 'control: it took the haul, which is goods');
  assert.equal(of(empty, 'bounty').length, 0, 'it took no piece and no cash, so it earned nothing');
  assert.deepEqual(g.s.bounties.map(x => x.id), [b], 'the bounty stays open');
  const worn = g.hand('a01', tierCopy(g.s, 'common'), { wear: true });
  const took = g.night({ a01: shift(NORMAL), a02: hit('a01', NORMAL) });
  assert.equal(of(took, 'rob')[0].copy, worn, 'control: this time it took the piece a01 wore');
  assert.deepEqual(of(took, 'bounty', e => e.act === 'collected').map(e => [e.bounty, e.to, e.amount]), [[b, 'a02', 600]]);
});

test("a bounty never pays the target's crewmates, whether it's on the agent or on the piece taken (§10, §21, GAP gap.bounty)", () => {
  const night = robber => {
    const g = new Game({ n: 4 });
    crew(g, 'a01', 'a02');
    const worn = g.hand('a01', tierCopy(g.s, 'rare'), { wear: true });
    armed(g, robber);
    g.grant('a03', 500);
    post(g, 'a03', { agent: 'a01', amount: 300 });
    post(g, 'a03', { copy: worn, amount: 200 });
    const r = g.night({ a01: shift(NORMAL), [robber]: hit('a01', NORMAL) });
    assert.equal(of(r, 'rob')[0].copy, worn, `control: ${robber} took the piece a01 wore`);
    return of(r, 'bounty', e => e.act === 'collected').map(e => [e.to, e.amount]).sort();
  };
  assert.deepEqual(night('a02'), [], 'its crewmate collects nothing');
  assert.deepEqual(night('a04'), [['a04', 200], ['a04', 300]], 'control: anyone else collects both');
});

// --- 5. Tip immunity (§12, §41; slime, 10-15) -------------------------------------------------------------------------

both('a tipper is spared only when its tip is what brought the cops: not in a lawless district, against a wanted attacker, in a heavy one, with a patrol there or in a bribed fight (§12, §41)', rule => {
  // x hits y with b backing it, and b tips x: 2 against y's 1 and whatever cops come. c works there, or patrols.
  const run = ({ level = 'normal', wanted = false, patrol = false, bribe = false }) => {
    const agents = agentsOf(['x', 'b', 'y', 'c'], { x: wanted ? { heat: N.wantedAt, wanted } : {} });
    // R4-2 (gap.accept): x accepts its backer.
    const plays = { x: { ...hit('y', NORMAL), accept: ['b'] }, b: back('x'), y: shift(NORMAL), c: patrol ? { kind: 'patrol', place: NORMAL } : shift(NORMAL) };
    const tips = [{ by: 'b', agent: 'x', target: 'y' }];
    return fightIn(resolveFights({ agents, plays, levels: levelsAt(level), rule, tips, bribes: bribe ? [{ by: 'x', target: 'y' }] : [] }), 'hit', 'y');
  };
  const alone = run({});
  assert.deepEqual([alone.tipped, alone.winner, alone.arrested], [true, null, ['x']], 'positive control: its tip alone brought the cops, so its tipper walks');
  for (const c of [{ level: 'lawless', patrol: true }, { wanted: true }, { level: 'heavy' }, { patrol: true }, { bribe: true, patrol: true }]) {
    const f = run(c);
    assert.equal(f.winner, null, `control: ${JSON.stringify(c)}: lost`);
    assert.deepEqual(f.arrested, ['b', 'x'], `${JSON.stringify(c)}: the cops came for another reason, so its tipper is arrested too`);
  }
  const grab = patrol => resolveFights({
    agents: agentsOf(['x', 'b', 'c']), levels: levelsAt('normal'), rule, tips: [{ by: 'b', agent: 'x', target: 'crate' }],
    plays: { x: { kind: 'grab', place: 'docks', accept: ['b'] }, b: back('x'), c: patrol ? { kind: 'patrol', place: 'docks' } : shift(NORMAL) },
  }).fights.find(f => f.kind === 'grab');
  assert.deepEqual(grab(false).arrested, ['x'], 'positive control: the grab, its tip alone');
  assert.deepEqual(grab(true).arrested, ['b', 'x'], 'the grab, with a patrol there');
});

test('a tip in a lawless district brings no cops, so a patrolling Cop arrests its tipper with the rest (§6, §12, §13)', () => {
  const night = tip => {
    const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'cop']);
    if (tip) assert.equal(g.errand('a02', 'tip', { agent: 'a01', target: 'a03' }).ok, true);
    // R4-2 (gap.accept): a01 accepts its backer.
    const r = g.night({ a03: { kind: 'run', place: LAWLESS }, a04: { kind: 'patrol', place: LAWLESS }, a01: { ...hit('a03', LAWLESS), accept: ['a02'] }, a02: back('a01') });
    return { r, f: fightOn(r, 'hit', 'a03') };
  };
  const plain = night(false);
  assert.deepEqual([plain.f.cops, plain.f.won, arrested(plain.r)], [0, false, ['a01', 'a02']], "control: 2 against the runner's 1 and the patrol's 1");
  const tipped = night(true);
  assert.deepEqual([tipped.f.cops, tipped.f.tipped, arrested(tipped.r)], [0, true, ['a01', 'a02']], 'the tip changed nothing, so it spares nobody');
});

test('the pair trick dies: two attackers who tip each other, one of them wanted, and pay a 0-star bribe are both arrested by a patrol (§12, §13, §41)', () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'cop']);
  g.s.agents.a01.heat = N.wantedAt;
  g.grant('a02', N.bribe[0]);
  assert.equal(g.errand('a02', 'tip', { agent: 'a01', target: 'a03' }).ok, true);
  assert.equal(g.errand('a01', 'tip', { agent: 'a02', target: 'a03' }).ok, true);
  assert.equal(g.errand('a02', 'bribe', { target: 'a03' }).ok, true);
  // R4-2 (gap.accept): a01 accepts its backer, the pair's other half.
  const r = g.night({ a03: shift(NORMAL), a04: { kind: 'patrol', place: NORMAL }, a01: { ...hit('a03', NORMAL), accept: ['a02'] }, a02: back('a01') });
  const f = fightOn(r, 'hit', 'a03');
  assert.deepEqual([f.tipped, f.cops > 0, f.won], [true, true, false], 'the bribe at 0 stars kept no cops out, and they lost');
  assert.deepEqual(arrested(r), ['a01', 'a02'], 'and neither tip spared its tipper');
});
