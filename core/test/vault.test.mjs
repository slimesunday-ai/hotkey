// Layer 4's forged warrants and the vault job (GAME.md §6, §7, §8, §9, §12, §13, §15, §19, §38; brief
// R1-layer4-score.md, task L4-1, its fills and calls 3, 4 and 5), with the rows in core/numbers.mjs (build,
// warrantsNight, vault, gap.warrants, gap.vault). Every expected value was worked out from GAME.md, the brief and those
// rows before the code ran, and every amount is read from N (or from the state the test set up), so tuning a number
// never breaks a test here. Fight-level cases call resolveFights directly, as the DATC suite does, under both cut rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, tierCopy, abilityCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkPlay } from '../rules/plays.mjs';
import { resolveFights } from '../rules/fights.mjs';
import { checkLedger, ledgerProblems } from '../rules/ledger.mjs';
import { DAY15, addGoods, moveCopy } from '../rules/state.mjs';
import { withOverrides } from '../bench/runner.mjs';
import { N } from '../numbers.mjs';

// §6: Precinct 9 and the Evidence Vault are in Glasswall, the city kit's downtown.
const GLASSWALL = 'downtown';
const VAULT = { kind: 'vault' };
const JOB = { kind: 'vault', place: GLASSWALL };
const BUILD = { kind: 'build', warrants: 1 };
const LAYLOW = { kind: 'laylow', place: 'suburbs' };
const DISTRICTS = ['downtown', 'strip', 'industrial', 'suburbs', 'docks', 'junkyard', 'mall', 'forest'];
const everywhere = level => Object.fromEntries(DISTRICTS.map(d => [d, level]));
const back = target => ({ kind: 'back', target });
const both = (name, fn) => {
  for (const rule of ['A', 'B']) test(`${name} (rule ${rule})`, () => fn(rule));
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
// Test-only goods, in through a named source (out, when n is below 0), so the books still balance. A warrant stocked
// here carries no maker.
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
// Test-only pieces and cash in the vault, as earlier arrests would have left them (no event names them).
function vaultHolds(g, copies, cash) {
  for (const k of copies) moveCopy(g.s, k, { k: 'vault' }, 'test');
  g.s.money.in.test = (g.s.money.in.test || 0) + cash;
  g.s.vault.cash += cash;
  checkLedger(g.s, 'vault');
}
// The rent for a whole season and more, so nobody is evicted.
const housed = g => Object.keys(g.s.agents).forEach(id => g.grant(id, 2 * N.nights * N.rent));
const of = (r, type, pred = () => true) => r.newEvents.filter(e => e.type === type && pred(e));
const has = (v, secret) => JSON.stringify(v).includes(secret);
const label = v => `${v.audience}${v.me ? ` (${v.me.id})` : ''}`;
// The fewest members a group of `strength` needs, as many of them armed as it takes (§8: 1 a person, +1 with a gun).
const sizeFor = strength => Math.ceil(strength / 2);
// A vault group of `strength`: its leader, holding a warrant, and the backers named, the first of them armed as needed;
// the leader's play accepts its backers (R4-2, gap.accept). Returns its plays.
function gang(g, leader, backers, strength) {
  const members = [leader, ...backers];
  const guns = strength - members.length;
  assert.ok(guns >= 0 && guns <= members.length && members.length <= N.groupMax, `${members.length} can't be ${strength} strong`);
  stock(g, leader, 'warrants', 1);
  members.slice(0, guns).forEach(m => stock(g, m, 'guns', 1));
  return { [leader]: backers.length ? { ...VAULT, accept: backers } : VAULT, ...Object.fromEntries(backers.map(b => [b, back(leader)])) };
}
// The agents after `first` in id order: a group's backers.
const after = (first, n) => Array.from({ length: n }, (_, i) => idOf(Number(first.slice(1)) + 1 + i));

// Fight-level agents at the lock: nobody armed, wanted or wearing anything unless it says so.
function agentsOf(ids, flags = {}) {
  return Object.fromEntries(ids.map(id => [id, { home: true, jailed: false, crew: null, wanted: false, knuckles: false, runners: false, ...flags[id] }]));
}
// A fight-level vault group of `strength`: its ids, flags (guns, as many as it takes, and any extra) and plays; the
// leader's play accepts its backers (R4-2, gap.accept).
function vaultGroup(lead, strength, extra = {}) {
  const ids = [lead, ...Array.from({ length: sizeFor(strength) - 1 }, (_, i) => `${lead}${i + 1}`)];
  const flags = Object.fromEntries(ids.map((id, i) => [id, { ...(i < strength - ids.length ? { gun: true } : {}), ...extra[id] }]));
  const led = ids.length > 1 ? { ...JOB, accept: ids.slice(1) } : JOB;
  return { ids, flags, plays: Object.fromEntries(ids.map(id => [id, id === lead ? led : back(lead)])) };
}
const fightOf = (groups, flags = {}) => ({
  agents: agentsOf(groups.flatMap(x => x.ids), Object.assign({}, ...groups.map(x => x.flags), flags)),
  plays: Object.assign({}, ...groups.map(x => x.plays)),
});
const vaultFight = r => r.fights.find(f => f.kind === 'vault');

// --- forged warrants (§9, §38) --------------------------------------------------------------------------------------

test('a Gunrunner builds a forged warrant at home from parts, an optional field of build the legal plays never list: one a night at most, inside its parts a night; craft and the play show warrants only when one was built (§9, §38; GAP gap.warrants)', () => {
  const g = withTrades(['gunrunner', 'gunrunner', 'smuggler']);
  housed(g);
  const parts = id => g.s.agents[id].goods.parts || 0;
  const kept = parts('a01');
  stock(g, 'a01', 'parts', N.build.warrants);
  stock(g, 'a02', 'parts', N.build.guns);
  const keptA02 = parts('a02') - N.build.guns;
  assert.ok(g.view('a01').legal.some(p => p.kind === 'build'), 'control: it can build tonight');
  assert.ok(g.view('a01').legal.every(p => !('warrants' in p)), 'the legal plays list no warrants');
  const r = g.night({ a01: BUILD, a02: { kind: 'build', guns: 1 }, a03: BUILD });
  assert.equal(g.s.agents.a01.goods.warrants, 1, 'one warrant');
  assert.equal(parts('a01'), kept, `from ${N.build.warrants} parts`);
  assert.equal(r.fights.where.a01.at, 'home', 'built at home');
  const craft = of(r, 'craft', e => e.agent === 'a01')[0];
  assert.deepEqual([craft.warrants, craft.guns, craft.lockpicks, craft.parts], [1, 0, 0, N.build.warrants]);
  assert.deepEqual([g.s.goods.in.build.warrants, g.s.goods.out.build.parts], [1, N.build.warrants + N.build.guns]);
  assert.equal(of(r, 'play', e => e.agent === 'a01')[0].warrants, 1, 'the play carries it');
  // A build with no warrant is as it was: neither its play nor its craft has the field.
  assert.equal(parts('a02'), keptA02, 'control: a02 built its gun');
  assert.ok(!('warrants' in of(r, 'craft', e => e.agent === 'a02')[0]), 'no warrants on a craft that built none');
  assert.ok(!('warrants' in of(r, 'play', e => e.agent === 'a02')[0]), 'nor on its play');
  assert.equal(of(r, 'invalid', e => e.agent === 'a03')[0].kind, 'never', 'only a Gunrunner builds');

  // Inside its parts a night: a warrant and as many lockpicks as push it past them, never.
  const over = Math.floor((N.build.parts - N.build.warrants) / N.build.lockpicks) + 1;
  stock(g, 'a01', 'parts', N.build.warrants + over * N.build.lockpicks);
  const past = checkPlay(g.s, 'a01', { kind: 'build', warrants: 1, lockpicks: over }, g.s.day);
  assert.deepEqual([past.ok, past.kind], [false, 'never']);
  // Short of parts: not yet.
  stock(g, 'a02', 'parts', N.build.warrants - 1 - parts('a02'));
  const short = checkPlay(g.s, 'a02', BUILD, g.s.day);
  assert.deepEqual([short.ok, short.kind], [false, 'not-yet']);
  // One a night: with the parts, and a cap of parts that would allow more, still no more than warrantsNight.
  withOverrides({ 'build.parts': (N.warrantsNight + 1) * N.build.warrants }, () => {
    stock(g, 'a01', 'parts', (N.warrantsNight + 1) * N.build.warrants);
    const most = checkPlay(g.s, 'a01', { kind: 'build', warrants: N.warrantsNight }, g.s.day);
    assert.equal(most.ok, true, 'control: as many as a night allows');
    const many = { kind: 'build', warrants: N.warrantsNight + 1 };
    const r2 = g.night({ a01: many });
    const bad = of(r2, 'invalid', e => e.agent === 'a01')[0];
    assert.deepEqual([bad.kind, bad.play], ['never', many], 'refused for good, and the typed parts of the play are kept');
  });
});

test("the city's shop and buyer don't trade warrants, and a hit never takes one (§7, §9; GAP gap.warrants, gap.carried)", () => {
  const g = withTrades(['smuggler', 'smuggler']);
  housed(g);
  stock(g, 'a01', 'warrants', 1);
  assert.equal(g.errand('a01', 'sell', { item: 'warrants', units: 1 }).ok, false, "the city's buyer turns it away");
  assert.equal(g.errand('a01', 'shop', { item: 'warrants', units: 1 }).ok, false, "and its shop sells none");
  assert.ok(['shop', 'buyer'].every(side => !('warrants' in g.view('a01').board.market[side])), 'its prices list none');
  stock(g, 'a02', 'guns', 1);
  const r = g.night({ a01: { kind: 'run', place: 'mall' }, a02: { kind: 'hit', target: 'a01', place: 'mall' } });
  assert.deepEqual(of(r, 'rob')[0].goods, { [N.drops.mall]: N.dropUnits }, "control: the hit won, and took the night's haul");
  assert.equal(g.s.agents.a01.goods.warrants, 1, 'the warrant stays with its holder');
  assert.equal(g.s.agents.a02.goods.warrants, undefined);
});

test("each warrant carries its maker, oldest first, as HALLU's lots do: through hand-overs and the crew stash; a fence swap drops it; a leader uses its oldest (§9, §12; GAP gap.warrants)", () => {
  const g = withTrades(['gunrunner', 'gunrunner', 'smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g);
  for (const id of ['a01', 'a02']) stock(g, id, 'parts', 2 * N.build.warrants);
  g.night({ a01: BUILD, a02: BUILD });
  // The ledger knows a mark can't outnumber the warrants it rides on.
  const s = structuredClone(g.s);
  delete s.agents.a01.goods.warrants;
  s.goods.out.test = { warrants: 1 };
  assert.ok(ledgerProblems(s).some(p => p.includes('a01') && p.includes('warrant')), 'a mark without its warrant');
  assert.deepEqual(ledgerProblems(g.s), [], 'positive control');
  // Day 2: a03 gets a01's warrant, then a02's, and hands the older one, a01's, on to a04.
  for (const [from, to] of [['a01', 'a03'], ['a02', 'a03'], ['a03', 'a04']]) g.errand(from, 'give', { to, goods: { warrants: 1 } });
  const r2 = g.night({ a01: BUILD, a02: BUILD, a03: VAULT, a04: VAULT });
  const makers = r => Object.fromEntries(of(r, 'used').map(e => [e.agent, e.maker]));
  assert.deepEqual(makers(r2), { a03: 'a02', a04: 'a01' });
  assert.ok(of(r2, 'used').every(e => JSON.stringify(e.goods) === JSON.stringify({ warrants: 1 })), 'each leader used one warrant');
  // Day 3: through the crew stash, a01's mark stays; through a fence swap, a02's is gone.
  g.errand('a01', 'crew_form', { name: 'c' });
  g.errand('a01', 'crew_invite', { agent: 'a05' });
  g.errand('a05', 'crew_join', { crew: g.s.agents.a01.crew });
  g.errand('a01', 'stash_put', { goods: { warrants: 1 } });
  g.errand('a05', 'stash_take', { goods: { warrants: 1 } });
  const swap = g.errand('a02', 'fence_swap', { to: 'a06', give: { goods: { warrants: 1 } }, get: { cash: 1 } });
  assert.equal(g.errand('a06', 'fence_accept', { deal: swap.events.find(e => e.type === 'fence').deal }).ok, true);
  // The swap lands at the lock, before the plays are checked, so a06 can job the vault tonight.
  assert.equal(checkPlay(g.s, 'a06', VAULT, g.s.day).kind, 'not-yet', 'no warrant before the lock');
  const r3 = g.night({ a05: VAULT, a06: VAULT });
  assert.equal(of(r3, 'invalid').length, 0, 'both plays stand');
  assert.deepEqual(makers(r3), { a05: 'a01', a06: null });
});

// --- the vault job (§7, §8, §13) ------------------------------------------------------------------------------------

test('the vault job is a play in Glasswall, legal while the agent holds a forged warrant at the lock, night 14 included (§7, §13, §15, §33)', () => {
  const g = new Game({ n: 3 });
  housed(g);
  const listed = id => g.view(id).legal.filter(p => p.kind === 'vault');
  assert.deepEqual(listed('a01'), [], 'no warrant: not listed');
  const none = checkPlay(g.s, 'a01', VAULT, g.s.day);
  assert.deepEqual([none.ok, none.kind], [false, 'not-yet']);
  stock(g, 'a01', 'warrants', 1);
  assert.deepEqual(listed('a01'), [JOB], 'listed, with its place');
  assert.deepEqual(checkPlay(g.s, 'a01', VAULT, g.s.day).play, JOB);
  // Without one at the lock it's invalid, typed, and the default play stands.
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the control reads a01, a filler, working at the docks, so this night passes the docks filler.
  const r = g.night({ a02: VAULT }, { filler: { kind: 'hustle', place: 'docks' } });
  const bad = of(r, 'invalid', e => e.agent === 'a02')[0];
  assert.deepEqual([bad.play, bad.kind, bad.instead], [VAULT, 'not-yet', LAYLOW]);
  assert.equal(r.fights.where.a01.place, 'docks', "control: a01 kept its warrant and worked a shift");
  g.advanceTo(14);
  assert.deepEqual(listed('a01'), [JOB], 'night 14 included');
});

both("every vault group is in one fight, the last of the night, after the grab, against the vault's flat defence: on every police level, with no city cops for a wanted jobber and no patrol (§8, §13; calls 3, 4)", rule => {
  const D = N.vault.defence;
  const x = vaultGroup('x', D + 1);
  const y = vaultGroup('y', 1);
  const { agents, plays } = fightOf([x, y], { y: { wanted: true } });
  for (const id of ['g', 'h', 't', 'c']) agents[id] = agentsOf([id])[id];
  Object.assign(plays, {
    g: { kind: 'grab', place: 'docks' }, h: { kind: 'hit', target: 't', place: GLASSWALL }, t: { kind: 'hustle', place: GLASSWALL },
    c: { kind: 'patrol', place: GLASSWALL },
  });
  for (const level of ['lawless', 'normal', 'heavy']) {
    const r = resolveFights({ agents, plays, levels: everywhere(level), rule });
    assert.equal(r.fights.filter(f => f.kind === 'vault').length, 1, `${level}: one fight`);
    const f = vaultFight(r);
    assert.equal(r.fights.at(-1), f, `${level}: the last of the night`);
    assert.equal(r.fights.at(-2).kind, 'grab', `${level}: after the grab`);
    assert.deepEqual(f.attackers.map(a => [a.leader, a.members, a.strength]), [['x', x.ids, D + 1], ['y', ['y'], 1]]);
    assert.deepEqual([f.place, f.defence, f.cops, f.winner, f.arrested], [GLASSWALL, D, 0, 'x', ['y']], `${level}: the flat defence, and no cops for wanted y`);
    assert.ok(!('patrol' in f) && !('patrols' in f), `${level}: the patrol in Glasswall stays out of it`);
    assert.deepEqual(r.fights.find(h => h.kind === 'hit').patrols, ['c'], `${level}: control: it joins the hit there`);
  }
});

both('several groups on the vault: the strongest gets in only if it beats the defence and every other group; a tie at the top fails them all; every member of a losing group is arrested, runners aside (§8, §13; call 5)', rule => {
  const D = N.vault.defence;
  const levels = everywhere('heavy');
  const x = vaultGroup('x', D + 2);
  const y = vaultGroup('y', D + 1, { y1: { runners: true } });
  const f = vaultFight(resolveFights({ ...fightOf([x, y]), levels, rule }));
  assert.deepEqual([f.winner, f.losers], ['x', ['y']]);
  assert.deepEqual(f.arrested, y.ids.filter(m => m !== 'y1'), 'the losing group, but for its runner');
  const [t1, t2] = [vaultGroup('x', D + 1), vaultGroup('y', D + 1)];
  const tie = vaultFight(resolveFights({ ...fightOf([t1, t2]), levels, rule }));
  assert.deepEqual([tie.winner, tie.arrested], [null, [...t1.ids, ...t2.ids].sort()], 'a tie at the top: nobody gets in');
  const weak = vaultGroup('x', D);
  const held = vaultFight(resolveFights({ ...fightOf([weak]), levels: everywhere('lawless'), rule }));
  assert.deepEqual([held.winner, held.arrested], [null, weak.ids], 'alone and no stronger than the defence: it holds');
});

test("the vault defends at its flat defence on a Blackout's night and a Crackdown's too (§13, call 3)", () => {
  const D = N.vault.defence;
  for (const [midseason, level] of [['blackout', 'lawless'], ['crackdown', 'heavy']]) {
    const g = new Game({ n: sizeFor(D), midseason });
    housed(g);
    g.advanceTo(7);
    const r = g.night(gang(g, 'a01', after('a01', sizeFor(D) - 1), D));
    const f = of(r, 'fight', e => e.kind === 'vault')[0];
    assert.deepEqual([f.level, f.defence, f.cops, f.won], [level, D, 0, false], `${midseason}: ${D} against ${D}, and the vault holds`);
  }
});

test("step 3: every leader uses a warrant, won or lost; the winner takes all the vault held at the lock, its pieces and its cash, in its leader's bag; tonight's seizures go in after (§8, §13; GAP gap.vault)", () => {
  const D = N.vault.defence;
  const backers = after('a01', sizeFor(D + 1) - 1);
  const loser = idOf(sizeFor(D + 1) + 1);
  const g = new Game({ n: sizeFor(D + 1) + 2 });
  housed(g);
  const kept = [tierCopy(g.s, 'rare'), tierCopy(g.s, 'common')].sort();
  vaultHolds(g, kept, 333);
  const vaultCash = g.s.vault.cash;
  const plays = gang(g, 'a01', backers, D + 1);
  stock(g, loser, 'warrants', 1);
  const worn = g.hand(loser, tierCopy(g.s, 'common'), { wear: true });
  const cash = id => g.s.agents[id].cash;
  const [leaderCash, backerCash, loserCash] = [cash('a01'), cash(backers[0]), cash(loser)];
  const r = g.night({ ...plays, [loser]: VAULT });
  assert.deepEqual(of(r, 'used').map(e => [e.agent, e.goods]), [['a01', { warrants: 1 }], [loser, { warrants: 1 }]]);
  assert.equal(g.s.goods.out.used.warrants, 2, 'both used up, booked out');
  assert.ok(!g.s.agents.a01.goods.warrants && !g.s.agents[loser].goods.warrants);
  const job = of(r, 'vault');
  assert.equal(job.length, 1, 'one take');
  assert.deepEqual([job[0].leader, job[0].members, job[0].copies, job[0].cash], ['a01', ['a01', ...backers], kept, vaultCash]);
  for (const k of kept) assert.deepEqual(g.s.copies[k].holder, { k: 'agent', id: 'a01' }, 'the bag goes to the leader');
  assert.equal(cash('a01'), leaderCash + vaultCash - N.rent, "the vault's cash too, then the rent at dawn");
  assert.equal(cash(backers[0]), backerCash - N.rent, 'a backer gets only what its leader pays it');
  assert.ok(g.s.agents[loser].jail, 'the losing group is arrested');
  const vault = g.view(null, 'public').board.vault;
  assert.deepEqual([vault.pieces.map(p => p.copy), vault.cash], [[worn], Math.floor(loserCash / 2)], "the loser's seizure went in after the take");
});

test('an empty vault can still be jobbed: the warrant is used and the take is nothing; a lockpick used up beside it names no maker (GAP gap.vault, gap.gear)', () => {
  const D = N.vault.defence;
  const size = sizeFor(D + 1);
  const [burglar, mark] = [idOf(size + 1), idOf(size + 2)];
  const g = new Game({ n: size + 2 });
  housed(g);
  assert.deepEqual(g.view(null, 'public').board.vault, { pieces: [], cash: 0 }, 'control: empty');
  stock(g, burglar, 'lockpicks', 1);
  g.hand(burglar, abilityCopy(g.s, 'knuckles'), { wear: true });
  const r = g.night({ ...gang(g, 'a01', after('a01', size - 1), D + 1), [burglar]: { kind: 'breakin', target: mark } });
  const job = of(r, 'vault')[0];
  assert.deepEqual([job.leader, job.copies, job.cash], ['a01', [], 0]);
  const used = Object.fromEntries(of(r, 'used').map(e => [e.agent, e]));
  assert.deepEqual([used.a01.goods, used.a01.maker], [{ warrants: 1 }, null], 'a warrant the test stocked carries no maker');
  assert.deepEqual(used[burglar].goods, { lockpicks: 1 }, 'control: the lockpick was used');
  assert.ok(!('maker' in used[burglar]), 'a lockpick has no maker field');
});

test("a leader the city arrests tonight is caught with the bag: the rarest piece it took goes back into the vault (§5, §8, §13)", () => {
  const D = N.vault.defence;
  const g = new Game({ n: sizeFor(D + 1) });
  housed(g);
  const [rare, common] = [tierCopy(g.s, 'rare'), tierCopy(g.s, 'common')];
  vaultHolds(g, [rare, common], 0);
  const plays = gang(g, 'a01', after('a01', sizeFor(D + 1) - 1), D + 1);
  g.s.agents.a01.heat = N.maxHeat - N.vault.heat;
  const r = g.night(plays);
  assert.equal(of(r, 'vault')[0].leader, 'a01', 'control: it got in');
  const arrest = { ...of(r, 'arrest', e => e.agent === 'a01')[0], ...of(r, 'seized', e => e.agent === 'a01')[0] };
  assert.deepEqual([arrest.why, arrest.copy], ['heat', rare], `at ${N.maxHeat} stars, with the take in its bag`);
  assert.deepEqual([g.s.copies[rare].holder, g.s.copies[common].holder], [{ k: 'vault' }, { k: 'agent', id: 'a01' }]);
});

test("heat: every member of a vault group gets the vault job's stars, won or lost, backers the same, and a lost job's bail counts them; each group is one crime for the push-back (§6, §13; GAP gap.bailStars, gap.crimeCount)", () => {
  const D = N.vault.defence;
  const backers = after('a01', sizeFor(D + 1) - 1);
  const leaders = after(backers.at(-1), N.hotCrimes - 1);
  const g = new Game({ n: sizeFor(D + 1) + N.hotCrimes });
  housed(g);
  // Glasswall lawless for good, so a hotter night shows: hotCrimes crimes in a night make it one level hotter.
  g.s.districts[GLASSWALL] = { level: 'lawless', base: 'lawless' };
  const plays = gang(g, 'a01', backers, D + 1);
  for (const id of leaders) stock(g, id, 'warrants', 1);
  const r = g.night({ ...plays, ...Object.fromEntries(leaders.map(id => [id, VAULT])) });
  for (const m of ['a01', ...backers]) assert.equal(g.s.agents[m].heat, Math.min(N.maxHeat, N.vault.heat), `${m}: won`);
  for (const m of leaders) assert.equal(g.s.agents[m].jail.stars, Math.max(1, Math.min(N.maxHeat, N.vault.heat)), `${m}: lost, and its bail counts them`);
  const police = of(r, 'police', e => e.place === GLASSWALL)[0];
  assert.deepEqual([police.was, police.level, police.crimes], ['lawless', 'normal', N.hotCrimes], 'one crime a group, not a member');
});

test('night 14: the winning group runs for the boat through Glasswall with the take, which mints to its leader; a losing group misses the boat; the take and the warrants used are private until day 15 (§15, §19)', () => {
  const D = N.vault.defence;
  const backers = after('a01', sizeFor(D + 1) - 1);
  const loser = idOf(sizeFor(D + 1) + 1);
  const g = new Game({ n: sizeFor(D + 1) + 2 });
  housed(g);
  g.advanceTo(14);
  const k = tierCopy(g.s, 'rare');
  vaultHolds(g, [k], 77);
  const vaultCash = g.s.vault.cash;
  const plays = gang(g, 'a01', backers, D + 1);
  stock(g, loser, 'warrants', 1);
  assert.ok(g.view('a01').legal.some(p => p.kind === 'vault'), 'listed on the last night');
  const leaderCash = g.s.agents.a01.cash;
  const r = g.night({ ...plays, [loser]: VAULT });
  const job = of(r, 'vault')[0];
  assert.deepEqual([job.copies, job.cash, job.vis.to, job.vis.pub], [[k], vaultCash, ['a01', ...backers], DAY15]);
  assert.ok(of(r, 'used').length === 2 && of(r, 'used').every(e => e.vis.pub === DAY15), 'the warrants used, too');
  for (const m of ['a01', ...backers]) assert.equal(of(r, 'board', e => e.agent === m)[0].route, GLASSWALL, `${m} boards from the Glasswall route`);
  assert.deepEqual(g.s.copies[k].holder, { k: 'minted', id: 'a01' }, 'the take mints to the leader');
  assert.equal(of(r, 'mint', e => e.agent === 'a01')[0].cash, leaderCash + vaultCash, "with the vault's cash");
  assert.equal(of(r, 'missed', e => e.agent === loser).length, 1, 'the losing group misses the boat');
});

test('a bounty on a piece the job takes pays its leader (§10, §13; GAP gap.bounty)', () => {
  const D = N.vault.defence;
  const poster = idOf(sizeFor(D + 1) + 1);
  const g = new Game({ n: sizeFor(D + 1) + 1 });
  housed(g);
  // Two pieces in the vault, and the bounty on the later one by id.
  const pair = [tierCopy(g.s, 'rare'), tierCopy(g.s, 'common')].sort();
  vaultHolds(g, pair, 0);
  const k = pair[1];
  const amount = 123;
  assert.equal(g.errand(poster, 'bounty', { copy: k, amount }).ok, true);
  const plays = gang(g, 'a01', after('a01', sizeFor(D + 1) - 1), D + 1);
  const leaderCash = g.s.agents.a01.cash;
  const r = g.night(plays);
  const got = of(r, 'bounty', e => e.act === 'collected')[0];
  assert.deepEqual([got.to, got.copy, got.amount], ['a01', k, amount]);
  assert.equal(of(r, 'bounty', e => e.act === 'paid' && e.by === poster).length, 1, 'its poster is told');
  assert.equal(g.s.agents.a01.cash, leaderCash + amount - N.rent);
});

// --- who sees what (§19) --------------------------------------------------------------------------------------------

test("who sees what (§19): the vault fight is public and its jobbers aren't hooded; the take is the group's now and everyone's 24 hours later; the board's vault is live; a warrant's build, who holds it and its maker stay private until the 24-hour record", () => {
  const D = N.vault.defence;
  const size = sizeFor(D + 1);
  const g = withTrades(['gunrunner', ...Array(size + 2).fill('smuggler')]);
  housed(g);
  const everyone = Object.keys(g.s.agents).sort();
  const leader = 'a02';
  const group = [leader, ...after(leader, size - 1)];
  const outsiders = everyone.filter(id => id !== 'a01' && !group.includes(id));
  const views = ids => [...ids.map(id => g.view(id)), ...ids.map(id => g.view(id, 'ownerAI'))];
  const nobody = () => [g.view(null, 'public'), g.view(null, 'record')];
  stock(g, 'a01', 'parts', N.build.warrants);
  g.night({ a01: BUILD });
  // Day 2: the build, and the warrant, are its maker's own.
  assert.ok(g.view('a01').events.some(e => e.type === 'craft' && e.warrants === 1), "positive control: the maker sees its build");
  assert.equal(g.view('a01').me.goods.warrants, 1, 'and holds its warrant');
  for (const v of [...views(everyone.filter(id => id !== 'a01')), ...nobody()]) assert.ok(!has(v, 'warrants'), `${label(v)}: no warrant, live`);
  g.errand('a01', 'give', { to: leader, goods: { warrants: 1 } });
  const k = tierCopy(g.s, 'rare');
  vaultHolds(g, [k], 55);
  assert.ok(has(g.view(outsiders[0]).board.vault, k), "positive control: the board shows the vault's contents, live");
  for (const m of group.slice(0, D + 1 - size)) stock(g, m, 'guns', 1);
  g.night({ [leader]: { ...VAULT, accept: group.slice(1) }, ...Object.fromEntries(group.slice(1).map(m => [m, back(leader)])) });
  // Day 3, live.
  for (const v of [...views(everyone), ...nobody()]) {
    assert.ok(v.events.some(e => e.type === 'fight' && e.kind === 'vault' && e.won), `${label(v)}: the vault fight is public`);
    const show = v.events.find(e => e.type === 'show' && e.night === 2);
    assert.deepEqual(group.map(m => show.seen[m]), group.map(() => GLASSWALL), `${label(v)}: no jobber is hooded`);
    assert.deepEqual(v.board.vault, { pieces: [], cash: 0 }, `${label(v)}: the board's vault, live`);
  }
  for (const v of views(group)) assert.ok(v.events.some(e => e.type === 'vault' && e.copies.includes(k)), `${label(v)}: the group sees its take`);
  assert.ok(g.view(leader).events.some(e => e.type === 'used' && e.maker === 'a01'), 'the leader sees the mark on the warrant it used');
  for (const v of [...views(outsiders), ...views(['a01']), ...nobody()]) {
    assert.ok(!v.events.some(e => e.type === 'vault' || e.type === 'used'), `${label(v)}: no take and no warrant used, yet`);
    assert.ok(!has(v, k), `${label(v)}: nor where the piece went`);
  }
  for (const v of views(group.slice(1))) assert.ok(!v.events.some(e => e.type === 'used'), `${label(v)}: the warrant used is the leader's own`);
  assert.ok(g.view(null, 'record').events.some(e => e.type === 'craft' && e.agent === 'a01' && e.warrants === 1), "night 1's build is on the 24-hour record");
  g.night();
  // Day 4: the 24-hour record.
  for (const v of [...views(outsiders), ...nobody()]) {
    assert.ok(v.events.some(e => e.type === 'vault' && e.leader === leader && e.copies.includes(k)), `${label(v)}: the take is public`);
    assert.ok(v.events.some(e => e.type === 'used' && e.agent === leader && e.maker === 'a01'), `${label(v)}: and the warrant it used`);
  }
});
