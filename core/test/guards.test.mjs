// Layer 4's guards, and tips, bribes and the double-sell at the vault (GAME.md §6, §7, §8, §12, §13, §19, §38; brief
// R1-layer4-score.md, task L4-3, and the orchestrator's calls on it: only guards add to the vault's defence and patrols
// don't join that fight, runners still escape a lost job, tips and bribes can name the vault, tip immunity at the vault
// and a bribe at the vault), with the rows in core/numbers.mjs (copPay, vault, gap.guard, gap.tip, gap.bribe, gap.vault,
// gap.doubleSell). Every expected value was worked out from GAME.md, the brief, those calls and rows before the code
// ran, and every amount is read from N (or from the state the test set up). Fight-level cases call resolveFights
// directly, as the DATC suite does, under both cut rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkPlay } from '../rules/plays.mjs';
import { resolveFights } from '../rules/fights.mjs';
import { settleNight } from '../rules/night.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { DAY15, addGoods } from '../rules/state.mjs';
import { rng, shuffle } from '../rng.mjs';
import { N } from '../numbers.mjs';
import { withOverrides } from '../bench/runner.mjs';

// §6: Precinct 9 and the Evidence Vault are in Glasswall, the city kit's downtown.
const GLASSWALL = 'downtown';
const GUARD = { kind: 'guard' };
// A guard as checked: its place is the vault's.
const POST = { kind: 'guard', place: GLASSWALL };
const VAULT = { kind: 'vault' };
const JOB = { kind: 'vault', place: GLASSWALL };
const BUILD = { kind: 'build', warrants: 1 };
const DISTRICTS = ['downtown', 'strip', 'industrial', 'suburbs', 'docks', 'junkyard', 'mall', 'forest'];
const LEVELS = ['lawless', 'normal', 'heavy'];
const everywhere = level => Object.fromEntries(DISTRICTS.map(d => [d, level]));
const back = target => ({ kind: 'back', target });
const hit = (target, place = GLASSWALL) => ({ kind: 'hit', target, place });
const shift = (place = GLASSWALL) => ({ kind: 'hustle', place });
const tipOn = (by, agent) => [{ by, agent, target: 'vault' }];
const both = (name, fn) => {
  for (const rule of ['A', 'B']) test(`${name} (rule ${rule})`, () => fn(rule));
};

// A season whose agents have the trades named, in id order (the helpers' cast is all Smugglers).
function withTrades(trades, { midseason = 'blackout', rule = 'A' } = {}) {
  const g = new Game({ n: 1 });
  const agents = trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' }));
  const r = newSeason({ seed: 404, rule, midseason, items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
// Test-only goods, in through a named source, so the books still balance; a warrant stocked here carries the maker
// named, or none.
function stock(g, id, kind, n, maker = null) {
  addGoods(g.s.agents[id], kind, n, maker ? [{ maker, n }] : []);
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
// The rent for a whole season and more, so nobody is evicted.
const housed = g => Object.keys(g.s.agents).forEach(id => g.grant(id, 2 * N.nights * N.rent));
const of = (r, type, pred = () => true) => r.newEvents.filter(e => e.type === type && pred(e));
const has = (v, secret) => JSON.stringify(v).includes(secret);
const label = v => `${v.audience}${v.me ? ` (${v.me.id})` : ''}`;
const everyView = g => [
  ...Object.keys(g.s.agents).sort().flatMap(id => [g.view(id, 'agent'), g.view(id, 'ownerAI')]),
  g.view(null, 'public'),
  g.view(null, 'record'),
];
// The fewest members a group of `strength` needs, as many of them armed as it takes (§8: 1 a person, +1 with a gun).
const sizeFor = strength => Math.ceil(strength / 2);
// The agents after `first` in id order: a group's backers.
const after = (first, n) => Array.from({ length: n }, (_, i) => idOf(Number(first.slice(1)) + 1 + i));
// A vault group of `strength` in a season: its leader, holding a warrant (marked with its maker, if one is named), and
// the backers named, the first of them armed as needed; the leader's play accepts its backers (R4-2, gap.accept).
// Returns its plays.
function gang(g, leader, backers, strength, maker = null) {
  const members = [leader, ...backers];
  const guns = strength - members.length;
  assert.ok(guns >= 0 && guns <= members.length && members.length <= N.groupMax, `${members.length} can't be ${strength} strong`);
  stock(g, leader, 'warrants', 1, maker);
  members.slice(0, guns).forEach(m => stock(g, m, 'guns', 1));
  return { [leader]: backers.length ? { ...VAULT, accept: backers } : VAULT, ...Object.fromEntries(backers.map(b => [b, back(leader)])) };
}
// Forms a crew of the agents named, the first founding it.
function crewOf(g, ids) {
  g.errand(ids[0], 'crew_form', { name: 'crew' });
  for (const m of ids.slice(1)) {
    g.errand(ids[0], 'crew_invite', { agent: m });
    g.errand(m, 'crew_join', { crew: g.s.agents[ids[0]].crew });
  }
  assert.deepEqual(g.s.crews[g.s.agents[ids[0]].crew].members.slice().sort(), ids.slice().sort(), 'control: the crew formed');
}

// Fight-level agents at the lock: nobody armed, wanted or wearing anything unless it says so.
function agentsOf(ids, flags = {}) {
  return Object.fromEntries(ids.map(id => [id, { home: true, jailed: false, crew: null, wanted: false, knuckles: false, runners: false, ...flags[id] }]));
}
// A fight-level group of `strength` playing `play` (the vault job by default): its ids, its flags (guns, as many as it
// takes) and its plays; the leader's play accepts its backers (R4-2, gap.accept).
function side(lead, strength, play = JOB) {
  const ids = [lead, ...Array.from({ length: sizeFor(strength) - 1 }, (_, i) => `${lead}${i + 1}`)];
  const flags = Object.fromEntries(ids.map((id, i) => [id, i < strength - ids.length ? { gun: true } : {}]));
  const led = ids.length > 1 ? { ...play, accept: ids.slice(1) } : play;
  return { ids, flags, plays: Object.fromEntries(ids.map(id => [id, id === lead ? led : back(lead)])) };
}
// The groups' agents and plays, with any extra flags merged in, agent by agent.
function fightOf(groups, extra = {}) {
  const ids = groups.flatMap(x => x.ids);
  const flags = Object.fromEntries(ids.map(id => [id, { ...Object.assign({}, ...groups.map(x => x.flags))[id], ...extra[id] }]));
  return { agents: agentsOf(ids, flags), plays: Object.assign({}, ...groups.map(x => x.plays)) };
}
const vaultFight = r => r.fights.find(f => f.kind === 'vault');

// --- guards (§13) ---------------------------------------------------------------------------------------------------

test('a Cop guards the vault: a play at the vault in Glasswall, for any Cop, wanted or not, never on night 14; nobody else can (§6, §13; GAP gap.guard)', () => {
  const g = withTrades(['cop', 'cop', 'smuggler']);
  housed(g);
  g.s.agents.a02.heat = N.wantedAt;
  const listed = id => g.view(id).legal.filter(p => p.kind === 'guard');
  assert.deepEqual(listed('a01'), [POST], 'a Cop: listed, with its place');
  assert.deepEqual(listed('a02'), [POST], 'a wanted Cop too');
  assert.deepEqual(listed('a03'), [], 'a Smuggler: not listed');
  assert.deepEqual(checkPlay(g.s, 'a01', { kind: 'guard', place: 'docks' }, g.s.day).play, POST, "the vault's place, whatever the play names");
  const r = g.night({ a01: GUARD, a02: GUARD, a03: GUARD });
  for (const id of ['a01', 'a02']) {
    const play = of(r, 'play', e => e.agent === id)[0];
    assert.deepEqual([play.kind, play.place], ['guard', GLASSWALL], `${id}'s play stands`);
    assert.deepEqual(r.fights.where[id], { at: 'out', place: GLASSWALL }, `${id} is out in Glasswall`);
  }
  const bad = of(r, 'invalid', e => e.agent === 'a03')[0];
  assert.deepEqual([bad.kind, bad.play.kind], ['never', 'guard'], 'only a Cop guards');
  g.advanceTo(14);
  assert.deepEqual(listed('a01'), [], 'not on night 14');
  const last = checkPlay(g.s, 'a01', GUARD, g.s.day);
  assert.deepEqual([last.ok, last.kind], [false, 'never']);
});

both("a guard's group adds its strength to the vault's defence on every police level, unless a hit or a collar found the guard tonight; it joins no other fight, and patrols still don't join the vault's (§8, §13; call 4; GAP gap.guard)", rule => {
  const D = N.vault.defence;
  const x = side('x', D + 2);
  // The guard c, armed, and c1 backing it: 3.
  const c = side('c', 3, POST);
  const groups = [x, c, side('t', 1, shift()), side('h', 1, hit('t')), side('p', 1, { kind: 'patrol', place: GLASSWALL })];
  for (const level of LEVELS) {
    const r = resolveFights({ ...fightOf(groups), levels: everywhere(level), rule });
    const f = vaultFight(r);
    assert.deepEqual([f.base, f.cops, f.guard, f.guards, f.defence], [D, 0, 3, ['c'], D + 3], `${level}: the flat defence and the guard's group`);
    assert.deepEqual([f.winner, f.arrested], [null, x.ids], `${level}: ${D + 2} against ${D + 3}, and the jobbers are arrested`);
    assert.ok(!('patrol' in f) && !('patrols' in f), `${level}: the patrol in Glasswall stays out of the vault`);
    const onT = r.fights.find(h => h.kind === 'hit' && h.target === 't');
    assert.deepEqual(onT.patrols, ['p'], `${level}: control: the patrol joins the hit on t`);
    assert.ok(!('guard' in onT) && !('guards' in onT), `${level}: the guard doesn't`);
  }
  const heavy = everywhere('heavy');
  const found = vaultFight(resolveFights({ ...fightOf([x, c, side('k', 1, hit('c'))]), levels: heavy, rule }));
  assert.deepEqual([found.defence, found.winner, 'guard' in found], [D, 'x', false], 'a hit found the guard: its group stays out');
  const missed = vaultFight(resolveFights({ ...fightOf([x, c, side('k', 1, hit('c', 'strip'))]), levels: heavy, rule }));
  assert.deepEqual([missed.defence, missed.winner], [D + 3, null], 'a hit in the wrong district finds nobody, so the guard still adds');
  const collar = side('k', 1, { kind: 'collar', target: 'c', place: GLASSWALL });
  const collared = vaultFight(resolveFights({ ...fightOf([x, c, collar], { c: { wanted: true } }), levels: heavy, rule }));
  assert.deepEqual([collared.defence, collared.winner], [D, 'x'], 'a collar found the wanted guard');
  const plain = vaultFight(resolveFights({ ...fightOf([x]), levels: heavy, rule }));
  assert.ok(!('guard' in plain) && !('guards' in plain), 'no guard: no guard fields on the fight');
  const placeless = vaultFight(resolveFights({ ...fightOf([x, c]), levels: heavy, rule, ignorePlaces: true }));
  assert.deepEqual([placeless.guards, placeless.defence], [['c'], D + 3], "with places ignored (§27), the guard still guards: its post is the vault");
});

both('a guard is a cop on duty, as a patrol is: a hit that finds it and loses is an arrest, in a lawless Glasswall too (§8, §13; GAP gap.guard, gap.patrol)', rule => {
  for (const play of [POST, { kind: 'patrol', place: GLASSWALL }]) {
    const fight = () => resolveFights({ agents: agentsOf(['x', 'c']), plays: { x: hit('c'), c: play }, levels: everywhere('lawless'), rule }).fights.find(h => h.kind === 'hit' && h.target === 'c');
    // gap.jump 'alone' (R8, slime 10-19: "do 1 and 2"): a lone guard or patrol is out working alone, so x wins the tie.
    const won = fight();
    assert.deepEqual([won.cops, won.defence, won.winner, won.arrested], [0, 1, 'x', []], `${play.kind}: 1 against 1, and x wins the tie on a cop on duty working alone`);
    // With the jump off (gap.jump 0) the tie holds, so a hit that finds a cop on duty and loses is still an arrest.
    const f = withOverrides({ 'gap.jump': 0 }, fight);
    assert.deepEqual([f.cops, f.defence, f.winner, f.arrested], [0, 1, null, ['x']], `gap.jump 0, ${play.kind}: 1 against 1 holds, and a cop on duty was in it`);
  }
});

test("a guard is paid copPay.guard, as a patrol is paid its wage, doubled on Payday; it's work, so flex pays; a guard arrested tonight earns neither (§4, §13, §38; GAP gap.guard, gap.flex)", () => {
  const g = withTrades(['cop', 'cop', 'cop', 'cop'], { midseason: 'payday' });
  housed(g);
  g.hand('a01', tierCopy(g.s, 'rare'), { wear: true });
  g.hand('a02', tierCopy(g.s, 'rare', () => true, 1), { wear: true });
  g.s.agents.a02.heat = N.wantedAt;
  const cash = g.s.agents.a01.cash;
  const r = g.night({ a01: GUARD, a02: GUARD, a03: { kind: 'collar', target: 'a02', place: GLASSWALL }, a04: { kind: 'patrol', place: 'strip' } });
  const wages = of(r, 'guard');
  assert.deepEqual(wages.map(e => [e.agent, e.place, e.wage, e.night]), [['a01', GLASSWALL, N.copPay.guard, 1]], "a01's wage; a02 was collared");
  assert.equal(of(r, 'patrol')[0].wage, N.copPay.patrol, "control: a04's patrol wage");
  assert.deepEqual(of(r, 'flex').map(e => [e.agent, e.pay]), [['a01', N.flex.rare]], 'a rare worn while guarding pays flex; not in jail');
  assert.ok(g.s.agents.a02.jail, 'control: a02 was collared');
  assert.equal(g.s.money.in.guard, N.copPay.guard, 'a cash source of its own');
  assert.equal(g.s.agents.a01.cash, cash + N.copPay.guard + N.flex.rare - N.rent, 'into its stash, before the rent at dawn');
  g.advanceTo(7);
  const payday = g.night({ a01: GUARD });
  assert.deepEqual([of(payday, 'guard')[0].wage, of(payday, 'flex', e => e.agent === 'a01')[0].pay], [2 * N.copPay.guard, 2 * N.flex.rare], 'Payday doubles both');
});

// --- tips and bribes at the vault (§8, §12, §13; call 6) ------------------------------------------------------------

both("a tip can name the vault job: it's right when the agent it names leads a group jobbing it, or backs one and arrives, and it brings the city cops' copsWanted, except in a lawless Glasswall; the heavy +1 stays inside the flat defence, a wanted jobber brings none, and a wrong tip changes nothing (§8, §13; calls 3, 6; GAP gap.tip)", rule => {
  const D = N.vault.defence;
  const x = side('x', D + 1);
  const w = side('w', 1, shift('industrial'));
  const run = (tips, level = 'heavy', groups = [x, w], extra = {}) => vaultFight(resolveFights({ ...fightOf(groups, extra), levels: everywhere(level), rule, tips }));
  const plain = run([]);
  assert.deepEqual([plain.tipped, plain.cops, plain.defence, plain.winner], [undefined, 0, D, 'x'], `control: ${D + 1} against ${D}`);
  for (const named of x.ids) {
    for (const level of ['normal', 'heavy']) {
      const f = run(tipOn('w', named), level);
      assert.deepEqual([f.tipped, f.tippers, f.cops, f.defence, f.winner, f.arrested], [true, ['w'], N.copsWanted, D + N.copsWanted, null, x.ids], `naming ${named}, ${level}`);
    }
  }
  const lawless = run(tipOn('w', 'x'), 'lawless');
  assert.deepEqual([lawless.tipped, lawless.cops, lawless.defence, lawless.winner], [true, 0, D, 'x'], 'a lawless Glasswall (a Blackout): tipped, and no cops come');
  for (const [named, target] of [['w', 'vault'], ['x', 'crate'], ['x', 'w']]) {
    const f = run([{ by: 'w', agent: named, target }]);
    assert.deepEqual([f.tipped, f.cops, f.winner], [undefined, 0, 'x'], `naming ${named} and ${target} is wrong`);
  }
  const wanted = run(tipOn('w', 'x'), 'heavy', [x, w], { x: { wanted: true } });
  assert.deepEqual([wanted.cops, wanted.defence], [N.copsWanted, D + N.copsWanted], "a wanted jobber brings no cops, so the tip's don't stack");
  const cut = run(tipOn('w', 'x1'), 'heavy', [x, w, side('k', 1, hit('x1'))]);
  assert.deepEqual([cut.attackers[0].members, cut.tipped, cut.cops], [['x', 'x2'], undefined, 0], 'k cut x1, which never arrived, so a tip naming it is wrong');
});

both('tip immunity at the vault (slime, 10-15: "a tipper is spared only when its tip is what brought the cops"): every loser of a vault job is arrested, so a tipper in the job is never spared, on any police level (§8, §12, §13; GAP gap.tip)', rule => {
  const D = N.vault.defence;
  for (const level of LEVELS) {
    // Strong enough to win untipped where a tip brings cops; on a lawless night, no stronger than the vault.
    const x = side('x', level === 'lawless' ? D : D + 1);
    const f = vaultFight(resolveFights({ ...fightOf([x]), levels: everywhere(level), rule, tips: tipOn('x1', 'x') }));
    assert.deepEqual([f.tipped, f.winner, f.arrested], [true, null, x.ids], `${level}: the tipper x1 is arrested with the rest`);
  }
  const h = resolveFights({
    agents: agentsOf(['x', 'x1', 'y']), plays: { x: { ...hit('y', 'industrial'), accept: ['x1'] }, x1: back('x'), y: shift('industrial') }, levels: everywhere('normal'), rule,
    tips: [{ by: 'x1', agent: 'x', target: 'y' }],
  }).fights.find(f => f.kind === 'hit');
  assert.deepEqual([h.tipped, h.winner, h.arrested], [true, null, ['x']], 'control: on a hit only its tip brought the cops to, the tipper walks');
});

both("a bribe at the vault works as everywhere: a jobber's, at its side's price, keeps out only the tip's +2; the flat defence and every guard stay; a bystander's, a guard's, one under the hottest jobber's price, or one naming another fight keeps nothing out (§13; call 6; GAP gap.bribe)", rule => {
  const D = N.vault.defence;
  const x = side('x', D + 1);
  const w = side('w', 1, shift('industrial'));
  const c = side('c', 1, POST);
  const run = (bribes, groups = [x, w], extra = {}) => vaultFight(resolveFights({ ...fightOf(groups, extra), levels: everywhere('heavy'), rule, tips: tipOn('w', 'x'), bribes }));
  const tipped = run([]);
  assert.deepEqual([tipped.cops, tipped.winner], [N.copsWanted, null], 'control: the tip holds the vault');
  const bribed = run([{ by: 'x1', target: 'vault' }]);
  assert.deepEqual([bribed.tipped, bribed.bribers, bribed.cops, bribed.defence, bribed.winner], [true, ['x1'], 0, D, 'x'], "a backer's bribe: the flat defence alone");
  const guarded = run([{ by: 'x', target: 'vault' }], [x, w, c]);
  assert.deepEqual([guarded.bribers, guarded.cops, guarded.guard, guarded.defence, guarded.winner], [['x'], 0, 1, D + 1, null], 'a guard is a player, not a city cop: no bribe keeps it out');
  for (const by of ['w', 'c']) {
    const f = run([{ by, target: 'vault' }], [x, w, c]);
    assert.deepEqual([f.bribers, f.cops], [undefined, N.copsWanted], `${by} isn't in the job: its bribe keeps nothing out`);
  }
  const cheap = run([{ by: 'x', target: 'vault' }], [x, w], { x2: { heat: 1 } });
  assert.deepEqual([cheap.bribers, cheap.cops, cheap.winner], [undefined, N.copsWanted, null], "x's price at 0 stars is under x2's at 1: nothing kept out");
  const crate = run([{ by: 'x', target: 'crate' }]);
  assert.deepEqual([crate.bribers, crate.cops], [undefined, N.copsWanted], 'a bribe on the crate is not one on the vault');
});

test("a tip and a bribe can name the vault, as they name the crate; the job's fight shows it was tipped, never who tipped or bribed, and a bribe only as no cops (§13, §19; call 6; GAP gap.tip, gap.bribe)", () => {
  const D = N.vault.defence;
  const size = sizeFor(D + 1);
  const tipper = idOf(size + 1);
  const night = ({ tip = false, bribe = false }) => {
    const g = new Game({ n: size + 1 });
    housed(g);
    const plays = gang(g, 'a01', after('a01', size - 1), D + 1);
    if (tip) assert.equal(g.errand(tipper, 'tip', { agent: 'a01', target: 'vault' }).ok, true, 'a tip names the vault');
    if (bribe) assert.equal(g.errand('a01', 'bribe', { target: 'vault' }).ok, true, 'a bribe names the vault');
    const r = g.night(plays);
    return { g, f: of(r, 'fight', e => e.kind === 'vault')[0] };
  };
  const plain = night({});
  assert.deepEqual([plain.f.cops, plain.f.defence, plain.f.won], [0, D, true], `control: ${D + 1} against ${D}`);
  const tipped = night({ tip: true });
  assert.deepEqual([tipped.f.tipped, tipped.f.cops, tipped.f.defence, tipped.f.won], [true, N.copsWanted, D + N.copsWanted, false]);
  assert.deepEqual(Object.keys(tipped.f).filter(k => !(k in plain.f)), ['tipped'], 'one field more, and it names nobody');
  assert.ok(!has(tipped.f, tipper), 'never who tipped');
  assert.ok(tipped.g.s.agents.a01.jail, 'the job lost, and its leader is arrested');
  const bribed = night({ tip: true, bribe: true });
  assert.deepEqual([bribed.f.cops, bribed.f.defence, bribed.f.won], [0, D, true], 'the bribe kept the tip\'s cops out');
  assert.deepEqual(Object.keys(bribed.f).sort(), Object.keys(tipped.f).sort(), 'a bribe shows only as no cops');
  assert.equal(bribed.g.s.money.out.bribe, N.bribe[0], 'its cash left the island');
  assert.ok(bribed.g.events('tip').some(e => e.target === 'vault') && bribed.g.events('bribe').some(e => e.target === 'vault'), 'both on the record, naming the vault');
});

test("a tip on a vault job its tipper's crewmates are in is a rat, whether or not the tipper joins it; one in the job is arrested with the rest; the rat and its victims see it now, everyone 24 hours later (§12, §19; GAP gap.tip)", () => {
  const D = N.vault.defence;
  const size = sizeFor(D + 1);
  for (const joins of [false, true]) {
    const g = new Game({ n: size + 2 });
    housed(g);
    const backers = after('a01', size - 1);
    const [mate, outsider] = [idOf(size + 1), idOf(size + 2)];
    const tipper = joins ? backers[0] : mate;
    crewOf(g, ['a01', backers[0], mate]);
    const plays = gang(g, 'a01', backers, D + 1);
    assert.equal(g.errand(tipper, 'tip', { agent: 'a01', target: 'vault' }).ok, true);
    const r = g.night(plays);
    const victims = ['a01', backers[0]].filter(m => m !== tipper);
    const rats = of(r, 'betray', e => e.kind === 'rat');
    assert.deepEqual(rats.map(e => [e.by, e.victims, e.place]), [[tipper, victims, GLASSWALL]], `joins ${joins}: one rat; ${backers[1]} is no crewmate`);
    assert.equal(of(r, 'fight', e => e.kind === 'vault')[0].won, false, 'control: the tip held the vault');
    assert.equal(!!g.s.agents[tipper].jail, joins, joins ? 'in the job, it is arrested with the rest' : 'out of the job, it walks');
    const seen = v => v.events.some(e => e.type === 'betray' && e.kind === 'rat');
    for (const id of [tipper, ...victims]) assert.ok(seen(g.view(id)) && seen(g.view(id, 'ownerAI')), `positive control: ${id} sees it now`);
    for (const v of [g.view(backers[1]), g.view(outsider), g.view(null, 'public'), g.view(null, 'record')]) assert.ok(!seen(v), `${label(v)}: not yet`);
    g.night();
    for (const v of [g.view(backers[1]), g.view(outsider), g.view(null, 'public'), g.view(null, 'record')]) assert.ok(seen(v), `${label(v)}: 24 hours later`);
  }
});

// --- the double-sell (§12) ------------------------------------------------------------------------------------------

test("a double-sell (§12): tonight's vault groups whose leaders' warrants share a maker, when those leaders aren't all in one crew, are one betrayal by the maker, whose victims are those leaders; it shows when the warrants are used (GAP gap.doubleSell, gap.warrants)", () => {
  const g = withTrades(['gunrunner', 'smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g);
  stock(g, 'a01', 'parts', 2 * N.build.warrants);
  g.night({ a01: BUILD });
  g.night({ a01: BUILD });
  assert.equal(g.s.agents.a01.goods.warrants, 2, 'control: two warrants, one a night');
  crewOf(g, ['a02', 'a03']);
  for (const to of ['a02', 'a04']) g.errand('a01', 'give', { to, goods: { warrants: 1 } });
  const r = g.night({ a02: VAULT, a03: back('a02'), a04: VAULT });
  const sells = of(r, 'betray', e => e.kind === 'double-sell');
  assert.deepEqual(sells.map(e => [e.by, e.victims, e.night, e.place]), [['a01', ['a02', 'a04'], 3, GLASSWALL]], 'one act, by the maker; the backer a03 is no victim');
  const used = of(r, 'used');
  assert.deepEqual(used.map(e => [e.agent, e.maker]), [['a02', 'a01'], ['a04', 'a01']], 'control: both leaders used one of its warrants');
  assert.ok(r.newEvents.indexOf(sells[0]) > r.newEvents.indexOf(used.at(-1)), 'after the warrants are used');
});

test('no double-sell when the leaders are all in one crew, when the warrants have different makers, or when one or none has a mark; the maker leading with its own warrant against a rival it sold one to is one, with the rival its only victim (GAP gap.doubleSell)', () => {
  const cases = [
    { name: 'one crew', crew: ['a02', 'a03'], makers: { a02: 'a01', a03: 'a01' }, want: [] },
    { name: 'no crew', makers: { a02: 'a01', a03: 'a01' }, want: [['a01', ['a02', 'a03']]] },
    { name: 'one crew and a leader outside it', crew: ['a02', 'a03'], makers: { a02: 'a01', a03: 'a01', a04: 'a01' }, want: [['a01', ['a02', 'a03', 'a04']]] },
    { name: 'different makers', makers: { a02: 'a01', a03: 'a05' }, want: [] },
    { name: 'one with no mark', makers: { a02: 'a01', a03: null }, want: [] },
    { name: 'none with a mark', makers: { a02: null, a03: null }, want: [] },
    { name: 'the maker leads', makers: { a01: 'a01', a03: 'a01' }, want: [['a01', ['a03']]] },
    { name: 'two makers, each double-selling', makers: { a01: 'a05', a02: 'a06', a03: 'a05', a04: 'a06' }, want: [['a05', ['a01', 'a03']], ['a06', ['a02', 'a04']]] },
  ];
  for (const c of cases) {
    const g = new Game({ n: 6 });
    housed(g);
    if (c.crew) crewOf(g, c.crew);
    for (const [leader, maker] of Object.entries(c.makers)) stock(g, leader, 'warrants', 1, maker);
    const r = g.night(Object.fromEntries(Object.keys(c.makers).map(id => [id, VAULT])));
    assert.equal(of(r, 'used').length, Object.keys(c.makers).length, `${c.name}: control: every leader used its warrant`);
    assert.deepEqual(of(r, 'betray', e => e.kind === 'double-sell').map(e => [e.by, e.victims]), c.want, c.name);
  }
});

test("a double-sell is the maker's and its victims' now, and everyone's 24 hours later; on night 14, day 15 (§12, §19; GAP gap.doubleSell)", () => {
  const D = N.vault.defence;
  const g = new Game({ n: 6 });
  housed(g);
  const seen = v => v.events.some(e => e.type === 'betray' && e.kind === 'double-sell');
  const insiders = ['a01', 'a02', 'a04'];
  const outsiders = ['a03', 'a05', 'a06'];
  // a02, backed by a03, and a04 each job the vault with one of a01's warrants; neither gets in.
  const sell = () => {
    const plays = gang(g, 'a02', ['a03'], 2, 'a01');
    stock(g, 'a04', 'warrants', 1, 'a01');
    return g.night({ ...plays, a04: VAULT });
  };
  const r = sell();
  assert.equal(of(r, 'betray', e => e.kind === 'double-sell').length, 1, 'control: one double-sell');
  for (const id of insiders) assert.ok(seen(g.view(id)) && seen(g.view(id, 'ownerAI')), `positive control: ${id} sees it now`);
  for (const v of [...outsiders.flatMap(id => [g.view(id), g.view(id, 'ownerAI')]), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(!seen(v), `${label(v)}: not yet, the leader's backer a03 included`);
  }
  g.night();
  for (const v of everyView(g)) assert.ok(seen(v), `${label(v)}: 24 hours later`);
  g.advanceTo(14);
  for (const id of ['a02', 'a03', 'a04']) assert.ok(!g.s.agents[id].jail, `control: ${id} is out by night 14`);
  const last = of(sell(), 'betray', e => e.kind === 'double-sell');
  assert.deepEqual([last.length, last[0].vis.to, last[0].vis.pub], [1, ['a01', 'a02', 'a04'], DAY15], "night 14's is public on day 15");
});

// --- who sees a guard (§19) -----------------------------------------------------------------------------------------

test("who guards is public the way a patrol is (§19, §20): seen at work at the show, the vault fight shows the guards' strength as a hit shows a patrol's, never who; its play and its wage are its own until the 24-hour record (GAP gap.guard)", () => {
  const D = N.vault.defence;
  const size = sizeFor(D + 1);
  const g = withTrades([...Array(size).fill('smuggler'), 'cop', 'cop', 'smuggler', 'smuggler']);
  housed(g);
  const [guard, patrol, hitter, mark] = after(idOf(size), 4);
  const plays = gang(g, 'a01', after('a01', size - 1), D + 1);
  const r = g.night({ ...plays, [guard]: GUARD, [patrol]: { kind: 'patrol', place: 'industrial' }, [hitter]: hit(mark, 'industrial'), [mark]: shift('industrial') });
  for (const v of everyView(g)) {
    const show = v.events.find(e => e.type === 'show' && e.night === 1);
    assert.deepEqual([show.seen[guard], show.seen[patrol]], [GLASSWALL, 'industrial'], `${label(v)}: both seen where they work`);
    const [vault, street] = ['vault', 'hit'].map(k => v.events.find(e => e.type === 'fight' && e.kind === k));
    assert.deepEqual([vault.guard, street.patrol], [1, 1], `${label(v)}: each fight shows the strength that joined it`);
    assert.ok(!has(vault, guard) && !has(street, patrol), `${label(v)}: and never who`);
  }
  const vis = type => {
    const e = of(r, type)[0];
    return [e.vis.to.length, e.vis.pub - e.t];
  };
  assert.deepEqual(vis('guard'), vis('patrol'), "the guard's wage goes public as a patrol's does");
  for (const [cop, type] of [[guard, 'guard'], [patrol, 'patrol']]) {
    const mine = e => e.agent === cop && (e.type === type || (e.type === 'play' && e.kind === type));
    assert.ok([g.view(cop), g.view(cop, 'ownerAI')].every(v => v.events.filter(mine).length === 2), `${type}: positive control: its Cop sees its play and its wage`);
    for (const v of everyView(g).filter(x => !x.me || x.me.id !== cop)) assert.ok(!v.events.some(mine), `${label(v)}: no ${type} play or wage, live`);
  }
  g.night();
  for (const v of [g.view(mark), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(v.events.some(e => e.type === 'guard' && e.agent === guard && e.wage === N.copPay.guard), `${label(v)}: the wage, 24 hours later`);
    assert.ok(v.events.some(e => e.type === 'play' && e.agent === guard && e.kind === 'guard'), `${label(v)}: and the play`);
  }
});

// GAME.md §26's shuffle test with this task's plays: the same plays in any order give the same night.
for (const rule of ['A', 'B']) {
  test(`guards, a tip, a bribe, a rat and a double-sell at the vault give the same night in any order (rule ${rule})`, () => {
    const D = N.vault.defence;
    const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler', 'cop', 'cop', 'smuggler', 'smuggler'], { rule });
    housed(g);
    crewOf(g, ['a01', 'a02', 'a07']);
    const plays = { ...gang(g, 'a01', ['a02', 'a03'], D + 1, 'a08'), a04: VAULT, a05: GUARD, a06: GUARD, a07: shift('docks'), a08: shift('docks') };
    stock(g, 'a04', 'warrants', 1, 'a08');
    g.errand('a07', 'tip', { agent: 'a01', target: 'vault' });
    g.errand('a04', 'bribe', { target: 'vault' });
    const base = settleNight(g.s, plays);
    const want = JSON.stringify([base.events, base.state, base.fights]);
    for (let k = 0; k < 12; k++) {
      const order = {};
      for (const id of shuffle(rng('guards-shuffle', `${rule}-${k}`), Object.keys(plays))) order[id] = plays[id];
      const r = settleNight(g.s, order);
      assert.equal(JSON.stringify([r.events, r.state, r.fights]), want, `order ${k}`);
    }
    // Positive control: the night had the guards, the tip, the bribe, the rat and the double-sell.
    const f = base.fights.fights.find(x => x.kind === 'vault');
    assert.deepEqual([f.guards, f.tipped, f.bribers], [['a05', 'a06'], true, ['a04']]);
    const kinds = base.events.filter(e => e.type === 'betray').map(e => e.kind).sort();
    assert.deepEqual(kinds, ['double-sell', 'rat']);
  });
}
