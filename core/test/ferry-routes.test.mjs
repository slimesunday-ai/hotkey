// The last night's walk to the dock (GAME.md §15): "Board: walk from home to the dock with your group, by one of three
// routes", "Back someone: walk with it", "Hit someone on the route you name", and nobody can hide at the end, "because
// everyone walks to the dock". No chains (§8): a back on an agent that is itself backing does nothing, and on any other
// night that agent stays home (gap.chainedBack), where no hit can find it. Night 14 has no home to stay in (every play
// that keeps an agent home is off its menu), so before any attack is found every agent not in jail walks a route:
// - a back walks with the agent its backs lead to (A backs B, B backs C: A walks C's route, in no group);
// - a back whose backs lead to jail, to nobody or round a ring (A and B backing each other) walks the default play's
//   route, the one an agent with no play takes (gap.defaultPlay: GAME.md doesn't say which route; this is the existing
//   default, read from defaultPlay, never written out here).
// A hit naming that route reaches it. Valid backers still follow their leader, and every other night is as before.
// The independent review's probe (Astra, 2026-10-17): two agents backing each other on night 14 walked no route, so six
// armed hitters covering all three routes found nobody, and both boarded with a grail and an epic.
// Every case runs under both cut rules (§8), with today's numbers and with R3's candidate set S+H+R+T
// (core/reports/R3/HANDBACK-2c.md), set with the bench's own override helper, and reads its amounts from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, tierCopy } from './helpers.mjs';
import { resolveFights } from '../rules/fights.mjs';
import { settleNight } from '../rules/night.mjs';
import { defaultPlay, VAULT_AT } from '../rules/plays.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { DISTRICTS, ROUTES, HOMES, LAST_NIGHT, addGoods, bookGoods, half } from '../rules/state.mjs';
import { withOverrides } from '../bench/runner.mjs';
import { N } from '../numbers.mjs';

// Today's numbers, and S+H+R+T: the whole of a home's cash to a break-in, the hold-up's pay, the jailed released for
// the ferry, rares at 200 falling to 80, and prices falling 20% a night unsold.
const SETS = {
  "today's numbers": {},
  'S+H+R+T': { breakinShare: 1, 'gap.holdup': 'pay', 'gap.ferryJail': 'released', 'price.rare': [200, 80], priceFall: 0.2 },
};
// One test for each cut rule under each set, with the set's numbers in N while it runs.
function each(name, fn) {
  for (const [label, set] of Object.entries(SETS)) {
    for (const rule of ['A', 'B']) test(`${name} (rule ${rule}, ${label})`, () => withOverrides(set, () => fn(rule)));
  }
}

const board = place => ({ kind: 'board', place });
const hit = (target, place) => ({ kind: 'hit', target, place });
const back = target => ({ kind: 'back', target });
const VAULT = { kind: 'vault', place: VAULT_AT };
// The route an agent with no play walks on the last night (gap.defaultPlay).
const fallback = (s, id) => defaultPlay(s, id, LAST_NIGHT).place;
// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind) {
  addGoods(g.s.agents[id], kind, 1);
  bookGoods(g.s, 'in', 'test', kind, 1);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
// The fight a hitter's group is in, if its hit found its target.
const fightOf = (R, leader) => R.fights.find(f => f.kind === 'hit' && f.attackers.some(x => x.leader === leader));
const boardOf = (r, id) => r.newEvents.find(e => e.type === 'board' && e.agent === id);

each('two agents backing each other on night 14 walk the default route, where a hit naming it reaches them and robs them of what they carry (§8, §15)', rule => {
  const setUp = () => {
    const g = new Game({ n: 8, rule });
    assert.equal(g.s.rule, rule);
    g.advanceTo(LAST_NIGHT);
    const grail = g.hand('a01', tierCopy(g.s, 'grail'));
    const epic = g.hand('a02', tierCopy(g.s, 'epic'));
    for (const id of ['a03', 'a04', 'a05', 'a06', 'a07', 'a08']) stock(g, id, 'guns');
    return { g, grail, epic, route: fallback(g.s, 'a01') };
  };

  // The review's probe: six armed hitters, one on each route for each of the pair.
  {
    const { g, route } = setUp();
    const hitters = { a01: ['a03', 'a04', 'a05'], a02: ['a06', 'a07', 'a08'] };
    const plays = { a01: back('a02'), a02: back('a01') };
    for (const [target, ids] of Object.entries(hitters)) ids.forEach((id, i) => { plays[id] = hit(target, ROUTES[i]); });
    const r = g.night(plays);
    for (const id of ['a01', 'a02']) {
      assert.deepEqual(r.fights.where[id], { at: 'out', place: route }, `${id} walks the default route`);
      assert.ok(r.fights.idle.includes(id), `${id}'s back does nothing (no chains)`);
      for (const [i, h] of hitters[id].entries()) {
        const f = fightOf(r.fights, h);
        assert.equal(!!f, ROUTES[i] === route, `${h}'s hit naming ${ROUTES[i]} ${ROUTES[i] === route ? 'reaches' : 'misses'} ${id}`);
        if (f) assert.deepEqual([f.target, f.place, f.defenders], [id, route, [id]], `${id} defends alone: neither back adds anything`);
        else assert.ok(r.fights.missed.some(m => m.leader === h && m.target === id && m.place === ROUTES[i]));
      }
      const boarded = boardOf(r, id);
      assert.ok(boarded, `${id} boards`);
      assert.equal(boarded.route, route, `${id} boards from the route it walked, never from nowhere`);
    }
  }

  // The same pair, each hit on the default route by a group of three armed agents walking it together.
  {
    const { g, grail, epic, route } = setUp();
    const cash = { a01: g.s.agents.a01.cash, a02: g.s.agents.a02.cash };
    // R4-2 (gap.accept): each hitter accepts its two backers.
    const r = g.night({
      a01: back('a02'), a02: back('a01'),
      a03: { ...hit('a01', route), accept: ['a04', 'a05'] }, a04: back('a03'), a05: back('a03'),
      a06: { ...hit('a02', route), accept: ['a07', 'a08'] }, a07: back('a06'), a08: back('a06'),
    });
    for (const [victim, leader, piece] of [['a01', 'a03', grail], ['a02', 'a06', epic]]) {
      const f = fightOf(r.fights, leader);
      assert.ok(f, `${leader}'s hit reaches ${victim} on ${route}`);
      assert.ok(f.attackers[0].strength > f.defence, `3 armed (${f.attackers[0].strength}) beat ${victim} alone with ${route}'s cops (${f.defence})`);
      assert.equal(f.winner, leader);
      const rob = r.newEvents.find(e => e.type === 'rob' && e.leader === leader);
      assert.equal(rob.copy, piece, `§15: the rarest real piece ${victim} carries`);
      assert.equal(rob.cash, half(cash[victim]), `§15: and half its cash, ${half(cash[victim])} of ${cash[victim]}`);
      assert.deepEqual(g.s.copies[piece].holder, { k: 'minted', id: leader }, 'it mints to the robber');
      const mint = r.newEvents.find(e => e.type === 'mint' && e.agent === victim);
      assert.ok(!mint.cards.some(c => c.copy === piece), `${victim} mints nothing it lost`);
      assert.equal(mint.cash, cash[victim] - half(cash[victim]), `${victim} boards with what it kept`);
      assert.equal(mint.mainland, Math.round(mint.cash * N.mainlandRate));
      assert.equal(boardOf(r, victim).route, route);
    }
  }
});

// Day 14 with every kind of last-night back in it. a13 is in jail if the ferry doesn't release it; a15 has no home;
// a17's TRUTH locks a back on a18 (a forced play); a19 crashes off TEMP (forced to the default play); a23 holds a
// forged warrant. Night 13 has two of the same rings, to show that night is as before.
function lastDay(rule) {
  const g = new Game({ n: 26, rule });
  // Night 1: a15 can't pay the first rent, so it's evicted at dawn (§10), and it never pays it back.
  g.night({ a15: { kind: 'laylow' } });
  assert.equal(g.s.agents.a15.evicted, true, 'a15 has no home');
  g.advanceTo(LAST_NIGHT - 1);
  stock(g, 'a19', 'temp');
  assert.equal(g.errand('a19', 'take', { drug: 'temp' }).ok, true);
  // Night 13: a13's lone hit on a shift worker ties Glasswall's heavy cops, so a13 is arrested (§8, §13).
  const r13 = g.night({
    a13: hit('a22', 'downtown'), a22: { kind: 'hustle', place: 'downtown' },
    a01: back('a02'), a02: back('a01'), a15: back('a16'), a16: back('a15'),
  });
  assert.ok(r13.newEvents.some(e => e.type === 'arrest' && e.agent === 'a13'), 'a13 is arrested on night 13');
  assert.equal(!!g.s.agents.a13.jail, N['gap.ferryJail'] === 'missed', 'a13 is in jail on night 14 unless the ferry releases it');
  // Any other night is as before: a ring of backs stays home, or out in Pleasantview with no home (gap.chainedBack).
  assert.deepEqual([r13.fights.where.a01, r13.fights.where.a02], [{ at: 'home', home: 'a01' }, { at: 'home', home: 'a02' }], 'night 13: home');
  assert.deepEqual(r13.fights.where.a15, { at: 'out', place: HOMES }, 'night 13: with no home, out in Pleasantview');
  stock(g, 'a17', 'truth');
  assert.equal(g.errand('a17', 'take', { drug: 'truth', play: back('a18') }).ok, true);
  stock(g, 'a23', 'warrants');
  return g;
}

each('night 14: every agent not in jail walks a legal route before any attack is found, whatever its back: rings, chains, a chain into a ring, a jailed or absent leader, an evicted backer, forced plays; a hit naming that route reaches each one, and valid backers follow their leader (§8, §15, gap.chainedBack, gap.defaultPlay)', rule => {
  const g = lastDay(rule);
  assert.equal(g.s.rule, rule);
  const s = g.s;
  const free = !s.agents.a13.jail;
  const D = fallback(s, 'a01');
  // R4-2 (gap.accept): every leader with a valid backer accepts it: a08 a07, a13 a12, a21 a20 and a23 a24.
  const sent = {
    a01: back('a02'), a02: back('a01'),
    a03: back('a04'), a04: back('a05'), a05: back('a03'),
    a06: back('a07'), a07: back('a08'), a08: { ...board('junkyard'), accept: ['a07'] },
    a09: back('a10'), a10: back('a11'), a11: back('a10'),
    a12: back('a13'), a13: { ...board('industrial'), accept: ['a12'] },
    a14: back('a99'),
    a15: back('a16'), a16: back('a15'),
    a17: board('junkyard'), a18: back('a17'),
    a19: back('a20'),
    a20: back('a21'), a21: { ...hit('a22', 'industrial'), accept: ['a20'] }, a22: board('industrial'),
    a23: { ...VAULT, accept: ['a24'] }, a24: back('a23'),
    a25: board('junkyard'), a26: board('junkyard'),
  };
  const ids = Object.keys(s.agents).sort().filter(id => !s.agents[id].jail);
  const playsWith = (more = {}) => Object.fromEntries(ids.map(id => [id, more[id] || sent[id]]));
  const settle = (more = {}) => {
    const r = settleNight(s, playsWith(more));
    checkLedger(r.state, 'night 14');
    return r;
  };
  // Where each one walks: the default route for a back that leads to no walker (rings; a jailed or absent leader and a
  // crash give the default play itself), else the route of the agent its backs lead to.
  const route = {
    a01: D, a02: D, a03: D, a04: D, a05: D, a06: 'junkyard', a07: 'junkyard', a08: 'junkyard', a09: D, a10: D, a11: D,
    a12: free ? 'industrial' : D, ...(free ? { a13: 'industrial' } : {}), a14: D, a15: D, a16: D, a17: D, a18: D, a19: D,
    a20: 'industrial', a21: 'industrial', a22: 'industrial', a23: VAULT_AT, a24: VAULT_AT, a25: 'junkyard', a26: 'junkyard',
  };

  const r = settle();
  const R = r.fights;
  for (const id of ids) {
    assert.ok(R.where[id].at === 'out' && ROUTES.includes(R.where[id].place), `${id} walks a route: ${JSON.stringify(R.where[id])}`);
    assert.equal(R.where[id].place, route[id], `${id} walks ${route[id]}`);
  }
  // No chains (§8): the backs that do nothing, and the valid backers in their leader's group.
  assert.deepEqual(R.idle, ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a09', 'a10', 'a11', 'a15', 'a16', 'a17', 'a18']);
  assert.deepEqual(R.groups.a08, ['a08', 'a07'], 'a07 backs a walker: in its group');
  assert.deepEqual(R.groups.a21, ['a21', 'a20'], 'a20 backs a hitter: in its group on its route');
  assert.deepEqual(R.groups.a23, ['a23', 'a24'], 'a24 backs the vault job: in its group in Glasswall');
  if (free) assert.deepEqual(R.groups.a13, ['a13', 'a12'], 'released, a13 walks, and a12 with it');
  // The forced plays and the invalid ones (§11, §17).
  const forced = id => r.events.find(e => e.type === 'forced' && e.agent === id);
  const invalid = id => r.events.find(e => e.type === 'invalid' && e.agent === id);
  assert.deepEqual([forced('a17').why, forced('a17').instead], ['truth', back('a18')], "TRUTH's locked back plays");
  assert.deepEqual([forced('a19').why, forced('a19').instead], ['crash', defaultPlay(s, 'a19', LAST_NIGHT)], 'a crash plays the default');
  assert.deepEqual(invalid('a14').instead, defaultPlay(s, 'a14', LAST_NIGHT), 'a back on nobody gives way to the default');
  if (!free) assert.deepEqual(invalid('a12').instead, defaultPlay(s, 'a12', LAST_NIGHT), 'a back on a jailed agent too');
  // Everyone who boards boards from the route it walked.
  const boards = r.events.filter(e => e.type === 'board');
  assert.ok(boards.length > 0);
  for (const e of boards) assert.equal(e.route, route[e.agent], `${e.agent} boards from ${route[e.agent]}`);

  // A hit naming each walker's route reaches it; one naming another route misses.
  const walkers = ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07', 'a09', 'a10', 'a11', 'a12', 'a14', 'a15', 'a16', 'a17', 'a18', 'a19'];
  for (const w of walkers) {
    const there = settle({ a25: hit(w, route[w]) }).fights;
    const f = fightOf(there, 'a25');
    assert.ok(f, `a hit naming ${route[w]} reaches ${w}`);
    assert.deepEqual([f.target, f.place], [w, route[w]]);
    const elsewhere = ROUTES.find(x => x !== route[w]);
    const away = settle({ a25: hit(w, elsewhere) }).fights;
    assert.ok(!fightOf(away, 'a25') && away.missed.some(m => m.leader === 'a25' && m.target === w), `a hit naming ${elsewhere} misses ${w}`);
  }
});

// Where each of `plays` walks on the last night, worked out as a fixed point: an agent whose play isn't a back walks
// its play's place; a back walks where the agent it backs walks, once that is known; a back nothing settles walks `D`.
function walksOf(agents, plays, D) {
  const at = {};
  for (const [id, p] of Object.entries(plays)) if (p.kind !== 'back') at[id] = p.place;
  for (let more = true; more;) {
    more = false;
    for (const [id, p] of Object.entries(plays)) {
      if (p.kind === 'back' && !(id in at) && p.target in at && !agents[p.target].jailed) {
        at[id] = at[p.target];
        more = true;
      }
    }
  }
  for (const id of Object.keys(plays)) if (!(id in at)) at[id] = D;
  return at;
}

each('every combination of last-night plays among four agents (one with no home), with a jailed agent and an absent one to back: each free agent walks a route, the one its backs lead to or else the default; a hit reaches exactly the agents out on the route it names; valid backers follow their leader; and any other night leaves the backs that do nothing at home, as before (§8, §15)', rule => {
  const g = new Game({ n: 4 });
  const D = fallback(g.s, 'a01');
  const ids = ['a01', 'a02', 'a03', 'a04'];
  const lock = { home: true, jailed: false, crew: null, wanted: false, heat: 0, knuckles: false, runners: false };
  const agents = { ...Object.fromEntries(ids.map(id => [id, { ...lock }])), a04: { ...lock, home: false }, a05: { ...lock, jailed: true } };
  const levels = Object.fromEntries(DISTRICTS.map(d => [d, N.levels[d]]));
  // R4-2 (gap.accept): every play but a back accepts the other three, so a back on a walker is valid as before.
  const options = id => {
    const others = ids.filter(x => x !== id);
    const accept = p => ({ ...p, accept: others });
    return [board(D), board('junkyard'), VAULT, ...others.map(t => hit(t, D))].map(accept).concat([...others.map(back), back('a05'), back('a99')]);
  };
  const menus = ids.map(options);
  let combos = 0;
  const pick = (i, plays) => {
    if (i < ids.length) {
      for (const p of menus[i]) pick(i + 1, { ...plays, [ids[i]]: p });
      return;
    }
    combos += 1;
    const R = resolveFights({ agents, plays, levels, rule, walk: id => fallback(g.s, id) });
    const at = walksOf(agents, plays, D);
    const ok = id => !!agents[plays[id].target] && !agents[plays[id].target].jailed && plays[plays[id].target].kind !== 'back';
    const say = () => JSON.stringify(plays);
    for (const id of ids) {
      const w = R.where[id];
      assert.ok(w && w.at === 'out' && ROUTES.includes(w.place) && w.place === at[id], `${id} walks ${at[id]}: ${say()} -> ${JSON.stringify(w)}`);
      const p = plays[id];
      if (p.kind === 'back') {
        assert.equal(R.idle.includes(id), !ok(id), `${id}'s back ${ok(id) ? 'counts' : 'does nothing'}: ${say()}`);
        if (ok(id)) assert.ok((R.groups[p.target] || []).includes(id) || R.cut.includes(id), `${id} is in ${p.target}'s group unless cut: ${say()}`);
      }
      if (p.kind === 'hit') {
        const reaches = R.where[p.target].place === p.place;
        assert.equal(!!fightOf(R, id), reaches, `${id}'s hit on ${p.target} naming ${p.place} ${reaches ? 'reaches' : 'misses'} it: ${say()}`);
      }
    }
    // Any other night, as before: a back that does nothing stays home, or is out in Pleasantview with no home.
    const before = resolveFights({ agents, plays, levels, rule });
    for (const id of ids) {
      const was = R.idle.includes(id) ? (agents[id].home ? { at: 'home', home: id } : { at: 'out', place: HOMES }) : R.where[id];
      assert.deepEqual(before.where[id], was, `${id}, any other night: ${say()}`);
    }
  };
  pick(0, {});
  assert.equal(combos, menus.reduce((t, m) => t * m.length, 1));
});
