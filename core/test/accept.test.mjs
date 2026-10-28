// R4-2, fights and groups (trunk docs/briefs/R4-astra-fixes.md, task 2; GAME.md §7, §8, §12, §13, §15; GAP gap.accept,
// gap.groupCap). A back joins a group, attacking or defending, only if that group's leader accepted it before the lock:
// a play with no `accept` accepts the leader's crewmates, and a play's `accept` list accepts exactly those agents, in its
// order. Accepting is permission, not a promise: an accepted backer can still not come, turn or be cut. A back its
// leader didn't accept does nothing: it stays home, and on night 14 it walks with the agent it backed, in no group.
// Astra's review (2026-10-17, law/REVIEW.md §2) showed two cases where nobody had accepted anything:
// 1. a wanted enemy with runners backs a clean robber that paid a valid bribe: the bribe no longer covers the group,
//    the city cops come, a 2-1 win becomes a 3-3 loss, the robber is arrested and the backer escapes;
// 2. four unarmed enemies with lower ids take a leader's four places, so its four armed allies are turned away: a 10-6
//    win becomes a 6-6 tie.
// Every case runs under both cut rules (§8), reads its amounts from N, and the two cases run again under shuffled ids.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy, idOf } from './helpers.mjs';
import { resolveFights } from '../rules/fights.mjs';
import { settleNight } from '../rules/night.mjs';
import { checkPlay, defaultPlay } from '../rules/plays.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { ROUTES, LAST_NIGHT, HOMES, addGoods, bookGoods } from '../rules/state.mjs';
import { withOverrides } from '../bench/runner.mjs';
import { rng, shuffle } from '../rng.mjs';
import { N } from '../numbers.mjs';

const YARDS = 'industrial';
const LEVELS = { ...N.levels };
const both = (name, fn) => {
  for (const rule of ['A', 'B']) test(`${name} (rule ${rule})`, () => fn(rule));
};
const hit = (target, place = YARDS, accept) => ({ kind: 'hit', target, place, ...(accept ? { accept } : {}) });
const shift = (place = YARDS, accept) => ({ kind: 'hustle', place, ...(accept ? { accept } : {}) });
const back = target => ({ kind: 'back', target });
// Fight-level agents at the lock: nobody armed, wanted, in a crew or wearing anything unless it says so.
const LOCK = { home: true, jailed: false, crew: null, wanted: false, heat: 0, knuckles: false, runners: false, gun: false };
const agentsOf = (ids, over = {}) => Object.fromEntries(ids.map(id => [id, { ...LOCK, ...over[id] }]));
const fightOn = (R, target, kind = 'hit') => R.fights.find(f => f.target === target && f.kind === kind);
// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n = 1) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
// Roles to ids: the identity (a01 for the first role, and so on), or a shuffle from its own stream, so a case reads the
// same whatever ids its agents have.
function idsFor(roles, k) {
  const ids = roles.map((_, i) => idOf(i + 1));
  const order = k === 0 ? ids : k === 1 ? [...ids].reverse() : shuffle(rng('r4-2 accept', k), ids);
  return Object.fromEntries(roles.map((r, i) => [r, order[i]]));
}
// A case written by role, played under ids: each agent's entry renamed, and each field naming a role (a target, an
// accept list) too; a field's own name, a kind and a place are never a role.
const val = (map, x) => (Array.isArray(x) ? x.map(y => val(map, y)) : typeof x === 'string' && Object.hasOwn(map, x) ? map[x] : x);
const asIds = (map, byRole) => Object.fromEntries(Object.entries(byRole).map(([r, o]) => [map[r] || r,
  Object.fromEntries(Object.entries(o).map(([k, y]) => [k, ['kind', 'place'].includes(k) ? y : val(map, y)]))]));
const roleOf = map => Object.fromEntries(Object.entries(map).map(([r, id]) => [id, r]));

// --- Astra's case 1: the uninvited wanted backer and the bribe -----------------------------------------------------

// The robber (armed, 0 stars) hits a worker on a shift in The Yards (normal) and bribed the precinct for that fight at
// its own stars; the enemy, wanted and wearing runners, backs the robber without being asked.
function poisoned(rule, map, accept) {
  const agents = asIds(map, agentsOf(['enemy', 'robber', 'worker'], { enemy: { wanted: true, heat: N.wantedAt, runners: true }, robber: { gun: true } }));
  const plays = asIds(map, { enemy: back('robber'), robber: hit('worker', YARDS, accept), worker: shift() });
  return resolveFights({ agents, plays, levels: LEVELS, rule, bribes: [{ by: map.robber, target: map.worker }] });
}

both("Astra's case 1: an uninvited wanted backer with runners can't spoil a valid bribe: it stays home, the bribe covers the robber's group, no city cops come, and the robber wins 2-1; accepted, it's the robber's own choice, and the robber loses 3-3 and is arrested", rule => {
  for (let k = 0; k < 6; k++) {
    const map = idsFor(['enemy', 'robber', 'worker'], k);
    const R = poisoned(rule, map);
    const f = fightOn(R, map.worker);
    const say = `ids ${JSON.stringify(map)}`;
    assert.deepEqual(R.groups[map.robber], [map.robber], `the robber's group is the robber: ${say}`);
    assert.deepEqual([R.unaccepted, R.idle], [[map.enemy], [map.enemy]], `the enemy's back does nothing: ${say}`);
    assert.deepEqual(R.where[map.enemy], { at: 'home', home: map.enemy }, `it stays home: ${say}`);
    assert.deepEqual(f.bribers, [map.robber], `the bribe at the robber's stars covers its group: ${say}`);
    assert.deepEqual([f.cops, f.attackers[0].strength, f.defence, f.winner, f.arrested], [0, 2, 1, map.robber, []], `2 against 1, a win: ${say}`);
    // Accepted, named on the robber's play, the same backer is the robber's own choice: its stars set the price, the
    // bribe at 0 stars covers nothing (gap.bribe), the city cops come, and the robber is arrested while the runner
    // walks (runners: never arrested for a lost attack).
    const A = poisoned(rule, map, [map.enemy]);
    const g = fightOn(A, map.worker);
    assert.deepEqual([A.groups[map.robber], A.unaccepted, g.bribers], [[map.robber, map.enemy], [], undefined], `accepted: ${say}`);
    assert.deepEqual([g.cops, g.attackers[0].strength, g.defence, g.winner, g.arrested], [N.copsWanted, 3, 1 + N.copsWanted, null, [map.robber]], `accepted: ${say}`);
  }
});

both("Astra's case 1 through the night: the bribe paid at its price, the uninvited wanted backer home and not hooded, and the robber not arrested", rule => {
  const g = new Game({ n: 3, rule });
  g.s.agents.a01.heat = N.wantedAt;
  g.hand('a01', abilityCopy(g.s, 'runners'), { wear: true });
  stock(g, 'a02', 'guns');
  g.grant('a02', N.bribe[0]);
  assert.equal(g.errand('a02', 'bribe', { target: 'a03' }).ok, true, `a bribe at 0 stars costs $${N.bribe[0]}`);
  const r = g.night({ a01: back('a02'), a02: hit('a03'), a03: shift() });
  const f = fightOn(r.fights, 'a03');
  assert.deepEqual([f.winner, f.cops, f.arrested], ['a02', 0, []]);
  assert.ok(!g.s.agents.a02.jail, 'the robber walks away with the take');
  const show = r.newEvents.find(e => e.type === 'show');
  assert.equal(show.seen.a01, 'home', 'the show saw the enemy at home, not hooded with the attack');
  assert.equal(g.s.agents.a01.heat, N.wantedAt - N['gap.cool'], 'no stars for a hit it was never in');
});

// --- Astra's case 2: the uninvited crowd and the group's places ---------------------------------------------------

// The leader and its four allies are armed, as are the target and its two backers; four unarmed enemies back the
// leader without being asked. Under the old rule they had the lowest ids and took all four places.
const CROWD = ['e1', 'e2', 'e3', 'e4', 'leader', 'ally1', 'ally2', 'ally3', 'ally4', 'target', 'guard1', 'guard2'];
function crowded(rule, map) {
  const armed = Object.fromEntries(['leader', 'ally1', 'ally2', 'ally3', 'ally4', 'target', 'guard1', 'guard2'].map(r => [r, { gun: true }]));
  const agents = asIds(map, agentsOf(CROWD, armed));
  const plays = asIds(map, {
    leader: hit('target', YARDS, ['ally1', 'ally2', 'ally3', 'ally4']), ally1: back('leader'), ally2: back('leader'), ally3: back('leader'), ally4: back('leader'),
    target: shift(YARDS, ['guard1', 'guard2']), guard1: back('target'), guard2: back('target'),
    e1: back('leader'), e2: back('leader'), e3: back('leader'), e4: back('leader'),
  });
  return resolveFights({ agents, plays, levels: LEVELS, rule });
}

both("Astra's case 2: four uninvited enemies can't take an accepted ally's place: they stay home, the leader's four armed allies are its group, and 10 beats 6", rule => {
  for (let k = 0; k < 8; k++) {
    const map = idsFor(CROWD, k);
    const R = crowded(rule, map);
    const f = fightOn(R, map.target);
    const say = `ids ${JSON.stringify(map)}`;
    const role = roleOf(map);
    assert.deepEqual(R.groups[map.leader].map(x => role[x]), ['leader', 'ally1', 'ally2', 'ally3', 'ally4'], `the leader's order: ${say}`);
    assert.deepEqual(R.unaccepted.map(x => role[x]).sort(), ['e1', 'e2', 'e3', 'e4'], say);
    assert.deepEqual(R.turnedAway, [], `nobody it accepted is turned away: ${say}`);
    assert.deepEqual([f.attackers[0].strength, f.defence, f.winner], [10, 6, map.leader], say);
    assert.equal(R.groups[map.leader].length, N.groupMax);
  }
});

// --- the leader's order --------------------------------------------------------------------------------------------

both("among the backers a leader accepted, its order decides who's in when more come than there's room for, never the agent id; the rest are there but not in its group", rule => {
  const roles = ['leader', 'target', 'b1', 'b2', 'b3', 'b4', 'b5'];
  const room = N.groupMax - 1;
  for (let k = 0; k < 6; k++) {
    for (const order of [['b1', 'b2', 'b3', 'b4', 'b5'], ['b5', 'b4', 'b3', 'b2', 'b1'], ['b3', 'b5', 'b1', 'b4', 'b2']]) {
      const map = idsFor(roles, k);
      const plays = asIds(map, { leader: hit('target', YARDS, order), target: shift(), b1: back('leader'), b2: back('leader'), b3: back('leader'), b4: back('leader'), b5: back('leader') });
      const R = resolveFights({ agents: asIds(map, agentsOf(roles)), plays, levels: LEVELS, rule });
      const role = roleOf(map);
      const say = `order ${order}, ids ${JSON.stringify(map)}`;
      assert.deepEqual(R.groups[map.leader].map(x => role[x]), ['leader', ...order.slice(0, room)], say);
      assert.deepEqual(R.turnedAway.map(x => role[x]), order.slice(room), say);
      assert.deepEqual(R.where[map[order[room]]], R.where[map.leader], `turned away, it's still there: ${say}`);
    }
  }
});

// --- the crew, and a list of the leader's own ---------------------------------------------------------------------

both("with no list a leader accepts its crewmates and nobody else; a list accepts exactly those it names, crewmates or not; an empty list accepts nobody", rule => {
  const agents = agentsOf(['lead', 'mate1', 'mate2', 'hired', 'target'], { lead: { crew: 'c1' }, mate1: { crew: 'c1' }, mate2: { crew: 'c1' }, hired: { crew: 'c2' } });
  const backs = { mate1: back('lead'), mate2: back('lead'), hired: back('lead'), target: shift() };
  const run = accept => resolveFights({ agents, plays: { ...backs, lead: hit('target', YARDS, accept) }, levels: LEVELS, rule });
  let R = run();
  assert.deepEqual([R.groups.lead, R.unaccepted], [['lead', 'mate1', 'mate2'], ['hired']], 'no list: its crewmates');
  R = run(['hired', 'mate2']);
  assert.deepEqual([R.groups.lead, R.unaccepted], [['lead', 'hired', 'mate2'], ['mate1']], 'a list: those it names, in its order, from another crew too');
  R = run([]);
  assert.deepEqual([R.groups.lead, R.unaccepted], [['lead'], ['hired', 'mate1', 'mate2']], 'an empty list: nobody');
});

both('hired muscle and alliances across crews still work: a crew leader names its crewmate and a hired agent from another crew, and both are in its group, through the night; a bystander it never named stays out', rule => {
  const g = new Game({ n: 5, rule });
  g.errand('a01', 'crew_form', { name: 'one' });
  g.errand('a01', 'crew_invite', { agent: 'a02' });
  g.errand('a02', 'crew_join', { crew: 'c1' });
  g.errand('a03', 'crew_form', { name: 'two' });
  const r = g.night({ a01: hit('a05', 'docks', ['a02', 'a03']), a02: back('a01'), a03: back('a01'), a04: back('a01'), a05: shift('docks') });
  const f = fightOn(r.fights, 'a05');
  assert.deepEqual([f.attackers[0].members, f.attackers[0].strength, f.winner], [['a01', 'a02', 'a03'], 3, 'a01']);
  assert.deepEqual(r.fights.unaccepted, ['a04']);
});

// --- defending, and a collar ---------------------------------------------------------------------------------------

both("defending too: an uninvited backer can't join a target's defence, nor spoil the bribe a collared agent paid; accepted, the hotter backer is the target's own choice", rule => {
  // A Cop collars a wanted Smuggler on a shift in The Yards; the Smuggler bribed for that fight at its stars; an agent
  // at 4 stars backs the Smuggler.
  const hot = N.maxHeat - 1;
  const agents = agentsOf(['cop', 'smuggler', 'hot'], { smuggler: { wanted: true, heat: N.wantedAt }, hot: { wanted: true, heat: hot } });
  const run = accept => resolveFights({
    agents, plays: { cop: { kind: 'collar', target: 'smuggler', place: YARDS }, smuggler: shift(YARDS, accept), hot: back('smuggler') },
    levels: LEVELS, rule, bribes: [{ by: 'smuggler', target: 'smuggler' }],
  });
  let f = fightOn(run(), 'smuggler', 'collar');
  assert.deepEqual([f.defenders, f.bribers, f.cops, f.attackers[0].strength, f.defence, f.winner], [['smuggler'], ['smuggler'], 0, 1, 1, null], 'its bribe keeps the city cops out: 1 against 1, the collar fails');
  f = fightOn(run(['hot']), 'smuggler', 'collar');
  assert.deepEqual([f.defenders, f.bribers, f.cops], [['smuggler', 'hot'], undefined, N.copsWanted], `accepted, the backer's ${hot} stars set the price`);
});

// --- betrayal and cutting still work -------------------------------------------------------------------------------

both("an accepted ally's betrayal still works: it promised to back the robber, the robber named it, and it backs the target, which accepted it: the robber loses and the turn is on the record; a bystander backing the robber uninvited makes no difference", rule => {
  const g = new Game({ n: 4, rule });
  stock(g, 'a01', 'guns');
  assert.equal(g.errand('a01', 'ask', { to: 'a02' }).ok, true);
  const sd = g.events('ask')[0].sitdown;
  assert.equal(g.errand('a02', 'answer', { sitdown: sd, accept: true }).ok, true);
  assert.equal(g.errand('a02', 'say', { sitdown: sd, say: 'promise', terms: { what: 'back', who: 'a01', night: g.s.day } }).ok, true);
  const r = g.night({ a01: hit('a03', YARDS, ['a02']), a02: back('a03'), a03: shift(YARDS, ['a02']), a04: back('a01') });
  const f = fightOn(r.fights, 'a03');
  assert.deepEqual([r.fights.groups.a01, f.defenders, r.fights.unaccepted], [['a01'], ['a03', 'a02'], ['a04']], 'it never came to the robber, and it defends the target');
  assert.deepEqual([f.attackers[0].strength, f.defence, f.winner], [2, 2, null], 'a tie: the target holds');
  const turn = r.newEvents.find(e => e.type === 'betray' && e.kind === 'turn');
  assert.deepEqual([turn.by, turn.victims], ['a02', ['a01']]);
});

both("an accepted ally can still just not come: named on the robber's play, it works a shift instead, and the robber fights alone; a bystander backing the robber uninvited can't stand in", rule => {
  const R = resolveFights({
    agents: agentsOf(['robber', 'ally', 'target', 'bystander']), plays: { robber: hit('target', YARDS, ['ally']), ally: shift('docks'), target: shift(), bystander: back('robber') }, levels: LEVELS, rule,
  });
  // gap.jump 'alone' (R8, slime 10-19: "do 1 and 2"): 1 against the target's 1, and the target is out working alone, so the robber wins the tie.
  assert.deepEqual([R.groups.robber, R.unaccepted, fightOn(R, 'target').attackers[0].strength, fightOn(R, 'target').winner], [['robber'], ['bystander'], 1, 'robber']);
});

both("a rival's cut still works: a hit on an accepted backer where it is cuts it under both rules, unless it's from the agent its group attacks (rule B) or from its own crew (rule B); a bystander backing the robber uninvited can't make up for it", rule => {
  const agents = agentsOf(['robber', 'ally', 'target', 'rival', 'mate', 'bystander'], { ally: { crew: 'c1' }, mate: { crew: 'c1' } });
  const base = { robber: hit('target', YARDS, ['ally']), ally: back('robber'), target: shift(), bystander: back('robber') };
  const run = more => resolveFights({ agents, plays: { rival: shift('docks'), mate: shift('docks'), ...base, ...more }, levels: LEVELS, rule });
  let R = run({ rival: hit('ally') });
  // gap.jump 'alone' (R8, slime 10-19: "do 1 and 2"): the target is out working alone, so the robber wins the tie.
  assert.deepEqual([R.cut, R.groups.robber, R.unaccepted, fightOn(R, 'target').winner], [['ally'], ['robber'], ['bystander'], 'robber'], 'a rival cuts it: the robber is alone, 1 against 1, and wins the tie on a lone worker');
  R = run({ target: hit('ally') });
  assert.deepEqual(R.cut, rule === 'A' ? ['ally'] : [], 'the agent its group attacks cuts it under A only (§8)');
  R = run({ mate: hit('ally') });
  assert.deepEqual(R.cut, rule === 'A' ? ['ally'] : [], 'its own crew cuts it under A only (§8)');
  R = run({});
  assert.deepEqual([R.cut, R.groups.robber, fightOn(R, 'target').winner], [[], ['robber', 'ally'], 'robber'], 'control: uncut, 2 against 1');
});

// --- the back that does nothing ------------------------------------------------------------------------------------

both('an unaccepted back is idle: home on any night (out in Pleasantview with no home), in no fight, never cut, and no stars', rule => {
  const g = new Game({ n: 4, rule });
  g.s.agents.a04.evicted = true;
  const r = g.night({ a01: hit('a03'), a02: back('a01'), a04: back('a01'), a03: shift() });
  const R = r.fights;
  assert.deepEqual([R.unaccepted, R.groups.a01], [['a02', 'a04'], ['a01']]);
  assert.deepEqual([R.where.a02, R.where.a04], [{ at: 'home', home: 'a02' }, { at: 'out', place: HOMES }]);
  assert.ok(!r.newEvents.some(e => e.type === 'heat' && (e.agent === 'a02' || e.agent === 'a04') && e.heat > e.was), 'no stars');
  const cut = resolveFights({
    agents: agentsOf(['a01', 'a02', 'a03', 'a05']), plays: { a01: hit('a03'), a02: back('a01'), a03: shift(), a05: hit('a02', HOMES) }, levels: LEVELS, rule,
  });
  assert.deepEqual([cut.cut, cut.unaccepted], [[], ['a02']], "a hit can't find it at home, so it's never cut");
});

both("night 14: an unaccepted back walks the route of the agent it backed, by the existing rule, in no group; a hit naming that route reaches it, and it boards from it", rule => {
  const g = new Game({ n: 4, rule });
  g.advanceTo(LAST_NIGHT);
  stock(g, 'a04', 'guns');
  const plays = { a01: { kind: 'board', place: 'junkyard' }, a02: back('a01'), a03: { kind: 'board', place: 'industrial' }, a04: { kind: 'board', place: 'downtown' } };
  // settleNight is pure, so each variant settles the same state.
  const R = (more = {}) => settleNight(g.s, { ...plays, ...more }).fights;
  const r = R();
  assert.deepEqual([r.unaccepted, r.idle, r.groups.a01], [['a02'], ['a02'], ['a01']]);
  assert.deepEqual(r.where.a02, { at: 'out', place: 'junkyard' }, 'it walks with a01, by the route its back leads to');
  for (const route of ROUTES) {
    const there = R({ a04: hit('a02', route) });
    const f = fightOn(there, 'a02');
    assert.equal(!!f, route === 'junkyard', `a hit naming ${route} ${route === 'junkyard' ? 'reaches' : 'misses'} it`);
    if (f) assert.deepEqual(f.defenders, ['a02'], 'it defends alone');
  }
  const last = g.night(plays);
  assert.equal(last.newEvents.find(e => e.type === 'board' && e.agent === 'a02').route, 'junkyard');
});

// --- a play the lock replaces -------------------------------------------------------------------------------------

both("a crash forces the default play, never whom the agent accepts: an agent that sends that very play naming its muscle keeps the list, so the muscle guards it at home and an uninvited agent stays out; any other play gives way to the plain default, and so does a play that fails", rule => {
  const g = new Game({ n: 5, rule });
  g.grant('a01', 3 * N.rent);
  stock(g, 'a01', 'temp');
  assert.equal(g.errand('a01', 'take', { drug: 'temp' }).ok, true);
  g.night({ a01: { kind: 'laylow' } });
  assert.equal(g.s.agents.a01.crash, true, 'control: a day on TEMP crashes the next night');
  stock(g, 'a05', 'guns');
  const laylow = { kind: 'laylow', place: HOMES };
  // Crashing, a01 lays low naming its muscle a02; a03 backs it uninvited; a05 breaks into its home.
  const night = a01 => settleNight(g.s, { ...Object.fromEntries(['a02', 'a03', 'a04', 'a05'].map(id => [id, shift('docks')])), a01, a02: back('a01'), a03: back('a01'), a05: { kind: 'breakin', target: 'a01' } });
  let r = night({ ...laylow, accept: ['a02'] });
  const forced = r.events.find(e => e.type === 'forced' && e.agent === 'a01');
  assert.deepEqual([forced.why, forced.instead], ['crash', { ...laylow, accept: ['a02'] }]);
  assert.deepEqual([r.fights.groups.a01, r.fights.unaccepted], [['a01', 'a02'], ['a03']]);
  const f = fightOn(r.fights, 'a01', 'breakin');
  assert.deepEqual([f.defenders, f.defence, f.attackers[0].strength, f.winner], [['a01', 'a02'], 4, 2, null], 'the lock, a01 and its muscle, and laying low, against the armed burglar');
  // Any other play, a hit naming the same muscle, gives way to the plain default: nobody but a crew is accepted.
  r = night(hit('a04', 'docks', ['a02']));
  assert.deepEqual([r.events.find(e => e.type === 'forced' && e.agent === 'a01').instead, r.fights.unaccepted], [laylow, ['a02', 'a03']]);
  // A play that fails gives way to the default too, list and all.
  g.night();
  assert.equal(g.s.agents.a01.crash, false, 'control: the crash is over');
  r = settleNight(g.s, { ...Object.fromEntries(['a03', 'a04', 'a05'].map(id => [id, shift('docks')])), a01: hit('a99', 'docks', ['a02']), a02: back('a01') });
  assert.deepEqual([r.events.find(e => e.type === 'invalid' && e.agent === 'a01').instead, r.fights.unaccepted], [laylow, ['a02']]);
});

both("SUDO is control of a play, its list included: the writer writes whom the taker accepts, and the lock plays the written list, not the taker's own; a list the rules refuse is refused when it's written, typed (§11; the orchestrator's call)", rule => {
  const g = new Game({ n: 5, rule });
  g.grant('a02', 3 * N.rent);
  stock(g, 'a01', 'sudo');
  stock(g, 'a05', 'guns');
  assert.equal(g.errand('a01', 'give', { to: 'a02', goods: { sudo: 1 } }).ok, true);
  assert.equal(g.errand('a02', 'take', { drug: 'temp' }).ok, true);
  const bad = g.errand('a01', 'write', { agent: 'a02', play: { ...shift('docks'), accept: ['a02'] } });
  assert.deepEqual([bad.ok, bad.why], [false, 'accept: a list of other agents, each once'], "naming the taker in its own list is refused when written");
  assert.equal(g.errand('a01', 'write', { agent: 'a02', play: { ...shift('docks'), accept: ['a03'] } }).ok, true);
  // The taker sends its own play naming a04; the writer's list names a03. a05, armed, hits the taker at the docks.
  const r = g.night({ a02: { ...shift('docks'), accept: ['a04'] }, a03: back('a02'), a04: back('a02'), a05: hit('a02', 'docks') });
  const forced = r.newEvents.find(e => e.type === 'forced' && e.agent === 'a02');
  assert.deepEqual([forced.why, forced.instead], ['sudo', { ...shift('docks'), accept: ['a03'] }]);
  assert.deepEqual([r.fights.groups.a02, r.fights.unaccepted], [['a02', 'a03'], ['a04']]);
  const f = fightOn(r.fights, 'a02');
  assert.deepEqual([f.defenders, f.defence, f.winner], [['a02', 'a03'], 2, null], "the written list's backer defends the taker: 2 against the gun's 2, a tie");
});

// --- the play's list -----------------------------------------------------------------------------------------------

test("a play's accept: other agents, each once, kept on the play; dropped from a back, which leads no group; anything else makes the play invalid, typed", () => {
  const g = new Game({ n: 4 });
  const s = g.s;
  assert.deepEqual(checkPlay(s, 'a01', hit('a02', YARDS, ['a03', 'a04']), s.day), { ok: true, play: hit('a02', YARDS, ['a03', 'a04']) });
  assert.deepEqual(checkPlay(s, 'a01', shift(YARDS, []), s.day).play.accept, [], 'an empty list: nobody');
  assert.deepEqual(checkPlay(s, 'a01', { ...back('a02'), accept: ['a03'] }, s.day), { ok: true, play: back('a02') });
  for (const bad of [['a01'], ['a99'], ['a03', 'a03'], 'a03', { a03: true }]) {
    const r = checkPlay(s, 'a01', hit('a02', YARDS, bad), s.day);
    assert.deepEqual([r.ok, r.kind, r.why], [false, 'never', 'accept: a list of other agents, each once'], JSON.stringify(bad));
  }
  const r = g.night({ a01: hit('a02', YARDS, ['a01']) });
  const invalid = r.newEvents.find(e => e.type === 'invalid' && e.agent === 'a01');
  assert.deepEqual([invalid.why, invalid.instead], ['accept: a list of other agents, each once', defaultPlay(s, 'a01', s.day)]);
  const play = r.newEvents.find(e => e.type === 'play' && e.agent === 'a01');
  assert.equal(play.kind, defaultPlay(s, 'a01', s.day).kind);
});

test('the night refuses numbers where a whole crew would not fit in one group (crewMax above groupMax): the default would need an order, and only ids give one', () => {
  const g = new Game({ n: 2 });
  withOverrides({ crewMax: N.groupMax + 1 }, () => assert.throws(() => g.night(), /crewMax/));
  withOverrides({ crewMax: N.groupMax }, () => assert.doesNotThrow(() => g.night()));
});
