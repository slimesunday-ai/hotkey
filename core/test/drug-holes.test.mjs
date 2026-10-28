// The drug holes the 10-15 mechanics review found, and slime's HALLU lie pool (brief R1-layer3-tricks.md, "After the
// mechanics review (10-15)", L3-7; GAME.md §11, §13, §19, §41), with the rows in core/numbers.mjs (gap.hallu,
// gap.truth, gap.clear, gap.lookout, gap.sudo, gap.betrayals, gap.bounty). Every amount comes from N (a bounty's, a
// lie's and a lookout's figures are what an agent chooses, never a tunable), and every expected value was worked out
// from GAME.md, the brief and those rows before the code ran.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, abilityCopy, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkPlay } from '../rules/plays.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { viewFor } from '../rules/view.mjs';
// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): WORKPLACES is gone (a hustle is in any district), so the normal and heavy districts come from DISTRICTS.
import { DAY15, DISTRICTS, HOMES, half } from '../rules/state.mjs';
import { N } from '../numbers.mjs';

const YARDS = 'industrial';
// A workplace whose cops are normal (§6): city cops come there for a wanted attacker or a tip, and for nothing else.
const NORMAL = DISTRICTS.find(d => N.levels[d] === 'normal');
const shift = (place = YARDS) => ({ kind: 'hustle', place });
const hit = (target, place = YARDS) => ({ kind: 'hit', target, place });
const back = target => ({ kind: 'back', target });
const breakin = target => ({ kind: 'breakin', target, place: HOMES });
const LAYLOW = { kind: 'laylow', place: HOMES };
const SECTION_11 = ['temp', 'truth', 'hallu', 'firewall', 'clear', 'sudo'];
const json = x => JSON.stringify(x);
const has = (v, secret) => json(v).includes(secret);
// A drug's name as it shows in a view's JSON: a goods kind, or the value of a `drug` field.
const named = drug => `"${drug}"`;
// HALLU's leads, or some of them, in the one order that says nothing: sorted as text.
const sorted = leads => [...leads].sort((x, y) => (json(x) < json(y) ? -1 : json(x) > json(y) ? 1 : 0));
const cashLie = (agent, value) => ({ kind: 'cash', agent, value });
const hallu = (lies, batches = 1) => ({ kind: 'cook', place: 'forest', batches, drug: 'hallu', lies });

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
// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  const a = g.s.agents[id];
  a.goods[kind] = (a.goods[kind] || 0) + n;
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
// The rent for a whole season and more, so nobody is evicted and every default play is a lay low.
const housed = (g, list) => list.forEach(id => g.grant(id, 2 * N.nights * N.rent));
const ids = g => Object.keys(g.s.agents).sort();
const everyView = g => [
  ...ids(g).map(id => g.view(id, 'agent')),
  ...ids(g).map(id => g.view(id, 'ownerAI')),
  g.view(null, 'public'),
  g.view(null, 'record'),
];
const label = v => `${v.audience}${v.me ? ` (${v.me.id})` : ''}`;
const of = (r, type, pred = () => true) => r.newEvents.filter(e => e.type === type && pred(e));
const fightOn = (r, kind, target) => r.newEvents.find(e => e.type === 'fight' && e.kind === kind && e.target === target);
const forcedOn = (r, id) => r.newEvents.filter(e => e.type === 'forced' && e.agent === id);
const playOn = (r, id) => r.newEvents.find(e => e.type === 'play' && e.agent === id);
const typedOf = p => ({ kind: p.kind, ...(p.target ? { target: p.target } : {}), ...(p.corner ? { corner: p.corner } : {}), place: p.place });
const sitdownWith = (g, viewer, other) => g.view(viewer).me.sitdowns.find(sd => sd.with === other);
function sitDown(g, a, b) {
  assert.equal(g.errand(a, 'ask', { to: b }).ok, true, `${a} asks ${b}`);
  const sd = Object.keys(g.s.sitdowns).find(k => g.s.sitdowns[k].a === a && g.s.sitdowns[k].b === b);
  assert.equal(g.errand(b, 'answer', { sitdown: sd, accept: true }).ok, true, `${b} sits down with ${a}`);
  return sd;
}
// Brass knuckles, worn: +1 attacking (§8).
const armed = (g, id, i = 0) => g.hand(id, abilityCopy(g.s, 'knuckles', i), { wear: true });
const post = (g, by, fields) => {
  const r = g.errand(by, 'bounty', fields);
  assert.equal(r.ok, true, `${by} posts ${json(fields)}`);
  return r.events.find(e => e.type === 'bounty').bounty;
};

// --- HALLU (§11, §41) -----------------------------------------------------------------------------------------------

test("HALLU's lies stay the cook's: no play carries them, locked, written or verified; a lot's lies are a `lies` record of their own, the cook's alone until day 15, then everyone's (§11, §19; the mechanics review, 10-15; GAP gap.hallu)", () => {
  const g = withTrades(['chemist', 'chemist', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  // Canary lies: cash nobody holds. a01's, which TRUTH locks; a02's, which SUDO's writer writes.
  const L = [913501, 913502].map(v => cashLie('a05', v));
  const W = [913601, 913602].map(v => cashLie('a05', v));
  const [lies01, lies02] = [['913501', '913502'], ['913601', '913602']];
  for (const id of ['a01', 'a02']) stock(g, id, 'chems', N.cook.chems);
  stock(g, 'a01', 'truth', 1);
  stock(g, 'a03', 'sudo', 1);
  assert.equal(g.errand('a01', 'take', { drug: 'truth', play: hallu(L) }).ok, true);
  sitDown(g, 'a04', 'a01');
  const verified = sitdownWith(g, 'a04', 'a01').verified;
  assert.deepEqual([verified.kind, verified.drug], ['cook', 'hallu'], 'its sit-down sees the locked cook, verified');
  assert.ok(!lies01.some(c => has(verified, c)), 'but none of its lies');
  g.errand('a03', 'give', { to: 'a02', goods: { sudo: 1 } });
  g.errand('a02', 'take', { drug: 'temp' });
  assert.equal(g.errand('a03', 'write', { agent: 'a02', play: hallu(W) }).ok, true);
  g.night({ a01: shift(), a02: shift() });
  assert.deepEqual([g.s.agents.a01.goods.hallu, g.s.agents.a02.goods.hallu], [N.cook.doses, N.cook.doses], 'control: both cooked their HALLU');
  // On the record, only a lies event names a lie: not the play, the forced play, the write or the cook.
  for (const e of g.log.filter(x => x.type !== 'lies')) {
    for (const c of [...lies01, ...lies02]) assert.ok(!has(e, c), `a ${e.type} event (n${e.n}) names a lie`);
  }
  const lies = g.events('lies');
  assert.deepEqual(lies.map(e => [e.agent, e.lies]), [['a01', L], ['a02', W]], "each lot's lies, typed, on a record of their own");
  assert.ok(lies.every(e => json(e.vis.to) === json([e.agent]) && e.vis.pub === DAY15), "the cook's own until day 15");
  const secret = when => {
    for (const v of everyView(g)) {
      for (const [cook, canaries] of [['a01', lies01], ['a02', lies02]]) {
        const seen = canaries.filter(c => has(v, c));
        assert.deepEqual(seen, v.me && v.me.id === cook ? canaries : [], `${when}: ${cook}'s lies in ${label(v)}`);
      }
    }
  };
  secret('the morning after');
  g.night();
  secret('24 hours later, when the night is public');
  g.advanceTo(N.nights);
  assert.ok(![...lies01, ...lies02].some(c => has(g.view(null, 'record'), c)), 'day 14: not on the record yet');
  g.night();
  assert.equal(g.s.clock, DAY15);
  assert.ok([...lies01, ...lies02].every(c => has(g.view(null, 'record'), c)), "day 15: on everyone's record");
});

test("HALLU's lie pool (slime, 10-15): a cook writes at least two lies, every one a typed lead; each dose of its lot takes the next two in turn, wrapping round, wherever its doses go, oldest first; two lies make every dose alike (§11, §41; GAP gap.hallu)", () => {
  const g = withTrades(['chemist', 'chemist', 'smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  const pool = [1, 2, 3, 4, 5].map(i => cashLie('a06', 913700 + i));
  const two = [cashLie('a06', 913801), { kind: 'tip', agent: 'a03', value: 'a04' }];
  stock(g, 'a01', 'chems', N.cook.batches * N.cook.chems);
  stock(g, 'a02', 'chems', N.cook.chems);
  for (const lies of [two, pool.slice(0, 3), pool]) {
    assert.deepEqual(checkPlay(g.s, 'a01', hallu(lies), g.s.day).play.lies, lies, `${lies.length} lies: a play`);
  }
  for (const lies of [undefined, [], pool.slice(0, 1), [...pool, cashLie('a06', -1)], [...pool, null], [...pool, { kind: 'rumour', agent: 'a06', value: 1 }]]) {
    const r = checkPlay(g.s, 'a01', hallu(lies), g.s.day);
    assert.deepEqual([r.ok, r.kind], [false, 'never'], `lies ${json(lies)}: refused for good`);
  }
  // Night 1: a01 cooks the pool into one lot, as big as a night's cook makes; a02 a batch with two lies.
  g.night({ a01: hallu(pool, N.cook.batches), a02: hallu(two) });
  const lot = g.s.agents.a01.goods.hallu;
  assert.ok(lot >= pool.length, `control: a lot of ${lot} doses, enough to wrap a pool of ${pool.length}`);
  // Dose i of a lot takes the pool's lies 2i and 2i + 1, wrapping round.
  const turn = i => sorted([pool[(2 * i) % pool.length], pool[(2 * i + 1) % pool.length]]);
  const lies = [...pool, ...two].map(json);
  const take = id => {
    assert.equal(g.errand(id, 'take', { drug: 'hallu' }).ok, true, `${id} takes HALLU`);
    const leads = g.events('take', e => e.agent === id).at(-1).leads;
    assert.equal(leads.filter(l => !lies.includes(json(l))).length, 1, `control: ${id}'s third lead is a true one`);
    return leads.filter(l => lies.includes(json(l)));
  };
  // Day 2: a01 hands its lot's first two doses to a03, and keeps the rest.
  g.errand('a01', 'give', { to: 'a03', goods: { hallu: 2 } });
  assert.deepEqual(take('a03'), turn(0), "a03's first: the lot's first dose");
  assert.deepEqual(take('a01'), turn(2), "a01's first: the lot's third, past the end of the pool and round");
  g.errand('a02', 'give', { to: 'a05', goods: { hallu: 2 } });
  assert.deepEqual([take('a02'), take('a05')], [sorted(two), sorted(two)], 'two lies: every dose takes both');
  g.night();
  // Day 3: the turn goes on in each holder's hands, and through another hand-over.
  assert.deepEqual(take('a03'), turn(1), "a03's second: the lot's second dose");
  g.errand('a01', 'give', { to: 'a04', goods: { hallu: 1 } });
  assert.deepEqual(take('a04'), turn(3), 'handed over: the fourth');
  assert.deepEqual(take('a01'), turn(4), 'and a01 the fifth');
  assert.deepEqual(take('a05'), sorted(two));
});

// --- TRUTH (§11, §17) -----------------------------------------------------------------------------------------------

test("TRUTH locks one of tonight's legal plays, as they stand once the dose is taken: crashing or in withdrawal only the forced play, in jail none, so what a sit-down sees verified is what the lock plays (§11, §17; the mechanics review, 10-15; GAP gap.truth, gap.forced)", () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler', 'dealer', 'smuggler']);
  housed(g, ids(g));
  for (const id of ['a01', 'a02', 'a03', 'a04']) stock(g, id, 'truth', N.hooked.nights + 1);
  stock(g, 'a01', 'temp', 1);
  stock(g, 'a02', 'firewall', N.hooked.nights);
  // Until day 4: a01 takes TEMP the day before, so it crashes tonight; a02 is hooked on FIREWALL and a03 on TRUTH.
  for (let day = 1; day <= N.hooked.nights; day++) {
    if (day === N.hooked.nights) g.errand('a01', 'take', { drug: 'temp' });
    g.errand('a02', 'take', { drug: 'firewall' });
    assert.equal(g.errand('a03', 'take', { drug: 'truth', play: shift() }).ok, true);
    g.night();
  }
  assert.deepEqual([g.view('a01').me.crash, g.view('a02').me.hooked, g.view('a03').me.hooked], [true, ['firewall'], ['truth']], 'control');
  for (const id of ['a01', 'a02', 'a03']) assert.deepEqual(g.view(id).legal, [LAYLOW], `control: ${id} can only lay low tonight`);
  // Crashing, or in withdrawal, the lock plays the forced play, so that's the only play TRUTH locks; a refusal keeps
  // the dose.
  for (const id of ['a01', 'a02']) {
    const held = g.s.agents[id].goods.truth;
    const r = g.errand(id, 'take', { drug: 'truth', play: shift() });
    assert.deepEqual([r.ok, r.events[0].kind, g.s.agents[id].goods.truth], [false, 'not-yet', held], `${id}: not a shift`);
    assert.equal(g.errand(id, 'take', { drug: 'truth', play: LAYLOW }).ok, true, `${id}: its forced play`);
  }
  // Hooked on TRUTH itself, the dose ends a03's withdrawal, so any legal play locks.
  assert.equal(g.errand('a03', 'take', { drug: 'truth', play: shift('docks') }).ok, true);
  // In jail there's no play tonight to lock.
  g.s.agents.a04.jail = { nights: N.jailNights, stars: 1, since: g.s.day - 1 };
  const jailed = g.errand('a04', 'take', { drug: 'truth', play: shift() });
  assert.deepEqual([jailed.ok, g.s.agents.a04.goods.truth], [false, N.hooked.nights + 1], 'in jail: refused, and the dose stays');
  // A Dealer whose one dose is the TRUTH it takes can't lock a deal: once it's taken, there's nothing to deal.
  g.errand('a05', 'give', { to: 'a06', goods: { ...N.kits.dealer } });
  stock(g, 'a05', 'truth', 1);
  const corner = Object.keys(N.corners).sort()[0];
  const dealt = g.errand('a05', 'take', { drug: 'truth', play: { kind: 'deal', corner } });
  assert.deepEqual([dealt.ok, g.s.agents.a05.goods.truth], [false, 1], 'no dose left to deal: refused');
  // Whoever sits down with them sees verified exactly what the lock plays.
  for (const id of ['a01', 'a02', 'a03']) sitDown(g, 'a06', id);
  const locked = { a01: LAYLOW, a02: LAYLOW, a03: shift('docks') };
  for (const id of ['a01', 'a02', 'a03']) assert.deepEqual(sitdownWith(g, 'a06', id).verified, locked[id], `${id}: verified`);
  const r = g.night({ a01: shift(), a02: shift(), a03: shift() });
  const why = { a01: 'crash', a02: 'withdrawal', a03: 'truth' };
  for (const id of ['a01', 'a02', 'a03']) {
    assert.deepEqual([typedOf(playOn(r, id)), forcedOn(r, id).map(e => e.why)], [locked[id], [why[id]]], `${id}: the lock plays what it verified`);
  }
});

test("while TRUTH locks a play, its taker can't make it impossible: handing away, selling, stashing or swapping what it needs, or taking the last dose a deal needs, is refused until dawn; what leaves enough goes through, and the lock plays it (§11; the mechanics review, 10-15; GAP gap.truth)", () => {
  const g = withTrades(['chemist', 'dealer', 'smuggler']);
  housed(g, ids(g));
  // a01 locks a lab cook with one chem to spare; a02 locks a deal with one dose left once its TRUTH is taken. Each hands
  // a03 what its kit holds beyond that first.
  if (N.kits.chemist.chems) g.errand('a01', 'give', { to: 'a03', goods: { chems: N.kits.chemist.chems } });
  stock(g, 'a01', 'chems', N.cook.chems + 1);
  stock(g, 'a01', 'truth', 1);
  g.errand('a02', 'give', { to: 'a03', goods: { temp: N.kits.dealer.temp - 1 } });
  stock(g, 'a02', 'truth', 1);
  const corner = Object.keys(N.corners).sort()[0];
  const cook = { kind: 'cook', place: 'forest', batches: 1 };
  const deal = { kind: 'deal', corner, place: N.corners[corner].place };
  assert.equal(g.errand('a01', 'take', { drug: 'truth', play: cook }).ok, true);
  assert.equal(g.errand('a02', 'take', { drug: 'truth', play: deal }).ok, true);
  assert.equal(g.errand('a01', 'give', { to: 'a03', goods: { chems: 1 } }).ok, true, 'control: the spare chem can go');
  assert.equal(g.errand('a02', 'crew_form', { name: 'c' }).ok, true);
  const tries = [
    ['a01', 'give', { to: 'a03', goods: { chems: 1 } }],
    ['a01', 'sell', { item: 'chems', units: 1 }],
    ['a01', 'fence_swap', { to: 'a03', give: { goods: { chems: 1 } }, get: { cash: 1 } }],
    ['a02', 'give', { to: 'a03', goods: { temp: 1 } }],
    ['a02', 'sell', { item: 'doses', units: 1 }],
    ['a02', 'stash_put', { goods: { temp: 1 } }],
    ['a02', 'take', { drug: 'temp' }],
  ];
  for (const [by, kind, fields] of tries) {
    const r = g.errand(by, kind, fields);
    assert.deepEqual([r.ok, r.events[0].kind], [false, 'not-yet'], `${by} ${kind}: refused, not yet: the lock ends at dawn`);
  }
  assert.deepEqual([g.s.agents.a01.goods.chems, g.s.agents.a02.goods.temp], [N.cook.chems, 1], 'it kept what its play needs');
  assert.deepEqual([g.view('a01').legal, g.view('a02').legal], [[cook], [deal]]);
  const r = g.night({ a01: shift(), a02: shift() });
  assert.deepEqual([playOn(r, 'a01').kind, playOn(r, 'a02').kind], ['cook', 'deal'], 'the lock plays the locked plays');
  assert.deepEqual([of(r, 'cook')[0].batches, of(r, 'sale')[0].doses], [1, 1], 'and they work');
});

// --- CLEAR and the arrest at the show (§11, §13, §19; call 5 revised) -----------------------------------------------

test("CLEAR leaves heat alone (call 5 revised): an arrest on it seizes nothing, and jail clears its stars as any arrest's does, so the Cop can't collar it again when it walks out (§11, §13; GAP gap.clear)", () => {
  const g = withTrades(['cop', 'smuggler', 'smuggler', 'cop']);
  housed(g, ids(g));
  armed(g, 'a01', 0);
  armed(g, 'a04', 1);
  const piece = {};
  for (const [i, id] of ['a02', 'a03'].entries()) {
    piece[id] = g.hand(id, tierCopy(g.s, 'rare', () => true, i), { wear: true });
    g.s.agents[id].heat = N.wantedAt;
  }
  stock(g, 'a02', 'clear', 1);
  assert.equal(g.errand('a02', 'take', { drug: 'clear' }).ok, true);
  const cash = g.s.agents.a03.cash;
  const collar = target => ({ kind: 'collar', target, place: HOMES });
  const r = g.night({ a01: collar('a02'), a04: collar('a03'), a02: LAYLOW, a03: LAYLOW });
  assert.ok(g.s.agents.a02.jail && g.s.agents.a03.jail, 'control: both collared');
  const seized = id => of(r, 'seized', e => e.agent === id)[0];
  assert.deepEqual([seized('a02').copy, seized('a02').fine], [null, 0], 'on CLEAR the cops seize nothing');
  assert.deepEqual([g.s.copies[piece.a02].holder, g.s.agents.a02.heat], [{ k: 'agent', id: 'a02' }, 0], 'it keeps its piece, and jail clears its stars');
  assert.deepEqual([seized('a03').copy, seized('a03').fine, g.s.agents.a03.heat], [piece.a03, half(cash), 0], 'control: off CLEAR, its piece, half its cash, and its stars');
  for (let k = 0; k < N.jailNights; k++) g.night();
  assert.equal(g.s.agents.a02.jail, null, 'control: out');
  assert.equal(checkPlay(g.s, 'a01', collar('a02'), g.s.day).ok, false, "not wanted, so no collar: the jail loop is gone");
});

test("an arrest at the show reads the same on CLEAR or off it: its seizure, the piece and the fine, is a record of its own, the arrested agent's now and everyone's at dawn, when the high has worn off (§11, §13, §19, §20; GAP gap.clear)", () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  // A heavy district: 1 against 1 and the city cops' 1, so both hits lose and both robbers are arrested.
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): WORKPLACES is gone (a hustle is in any district), so the heavy district comes from DISTRICTS.
  const heavy = DISTRICTS.find(d => N.levels[d] === 'heavy');
  assert.ok(heavy, 'control: a heavy district with shifts in it');
  for (const [i, id] of ['a01', 'a03'].entries()) g.hand(id, tierCopy(g.s, 'rare', () => true, i), { wear: true });
  stock(g, 'a01', 'clear', 1);
  g.errand('a01', 'take', { drug: 'clear' });
  const r = g.night({ a01: hit('a02', heavy), a02: shift(heavy), a03: hit('a04', heavy), a04: shift(heavy) });
  const arrest = id => of(r, 'arrest', e => e.agent === id)[0];
  const seized = id => of(r, 'seized', e => e.agent === id)[0];
  assert.ok(arrest('a01') && arrest('a03'), 'control: both arrested');
  const T = arrest('a01').t;
  for (const id of ['a01', 'a03']) {
    assert.equal(arrest(id).vis.to, 'all', `${id}: the arrest is public at the show`);
    assert.ok(!['copy', 'trait', 'fine'].some(k => k in arrest(id)), `${id}: and says nothing of the seizure`);
    assert.deepEqual([seized(id).night, json(seized(id).vis.to), seized(id).vis.pub], [arrest(id).night, json([id]), T + 1], `${id}: the seizure is its own now, everyone's at dawn`);
  }
  const { n: n1, agent: x1, ...a1 } = arrest('a01');
  const { n: n3, agent: x3, ...a3 } = arrest('a03');
  assert.deepEqual(a1, a3, 'the two arrests at the show are alike but for the agent');
  assert.deepEqual([seized('a01').copy, seized('a03').fine > 0], [null, true], 'control: one on CLEAR, one not');
  // Viewed at the show, nobody but the arrested agent reads a seizure; at dawn, everyone reads both.
  const atShow = { ...g.s, clock: T };
  const log = g.log.filter(e => e.t <= T);
  const audiences = [[null, 'public'], [null, 'record'], ...ids(g).flatMap(id => [[id, 'agent'], [id, 'ownerAI']])];
  for (const [who, audience] of audiences) {
    const seen = viewFor(atShow, log, who, audience).events.filter(e => e.type === 'seized').map(e => e.agent);
    assert.deepEqual(seen, ['a01', 'a03'].filter(id => id === who), `at the show, ${audience}${who ? ` (${who})` : ''}`);
  }
  assert.deepEqual(g.view(null, 'public').events.filter(e => e.type === 'seized').map(e => [e.agent, e.copy !== null]), [['a01', false], ['a03', true]], 'at dawn, everyone');
});

test("an arrest's seizure on the last night is the arrested agent's until day 15, as the rest of that night's private record is (§13, §15, §19)", () => {
  const g = new Game({ n: 3 });
  g.advanceTo(N.nights);
  g.s.agents.a01.heat = N.maxHeat - 1;
  const r = g.night({ a01: hit('a02', YARDS), a02: { kind: 'board', place: YARDS } });
  assert.equal(of(r, 'arrest', e => e.agent === 'a01').length, 1, 'control: arrested on the last night');
  const seized = of(r, 'seized', e => e.agent === 'a01');
  assert.deepEqual(seized.map(e => [json(e.vis.to), e.vis.pub]), [[json(['a01']), DAY15]]);
});

// --- the lookout (§10, §11, §19) ------------------------------------------------------------------------------------

test("a lookout shows drugs as doses: its look counts every drug, in the agent's goods and in the crew stash it keeps, as `doses`, so it names no drug live (§11, §19; slime's standing call; GAP gap.lookout, gap.doses)", () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  for (const [kind, n] of [['clear', 1], ['sudo', 2], ['chems', 3], ['firewall', 1], ['parts', 2]]) stock(g, 'a01', kind, n);
  assert.equal(g.errand('a01', 'crew_form', { name: 'c' }).ok, true);
  assert.equal(g.errand('a01', 'stash_put', { goods: { firewall: 1, parts: 2 } }).ok, true);
  g.grant('a02', N.lookout);
  assert.equal(g.errand('a02', 'lookout', { agent: 'a01' }).ok, true);
  const look = g.view('a02').events.find(e => e.type === 'look');
  assert.deepEqual([look.goods, look.crew.goods], [{ chems: 3, doses: 3 }, { parts: 2, doses: 1 }], 'every drug a dose; the rest by name');
  assert.ok(has(g.view('a01'), named('clear')), "positive control: a01's own view names its drugs");
  for (const v of everyView(g)) {
    for (const e of v.events.filter(x => x.type === 'look')) for (const d of SECTION_11) assert.ok(!has(e, named(d)), `${d} in ${label(v)}'s look`);
  }
});

// --- SUDO and betrayal (§11, §12) -----------------------------------------------------------------------------------

test("a play SUDO wrote is never a betrayal: a written hit on the agent its taker promised to back is no turn, where the taker's own hit would be (§11, §12; the mechanics review, 10-15; GAP gap.sudo, gap.betrayals)", () => {
  const night = written => {
    const g = withTrades(['chemist', 'smuggler', 'smuggler']);
    housed(g, ids(g));
    const sd = sitDown(g, 'a02', 'a03');
    assert.equal(g.errand('a02', 'say', { sitdown: sd, say: 'promise', terms: { what: 'back', night: g.s.day } }).ok, true);
    if (written) {
      stock(g, 'a01', 'sudo', 1);
      g.errand('a01', 'give', { to: 'a02', goods: { sudo: 1 } });
      g.errand('a02', 'take', { drug: 'temp' });
      assert.equal(g.errand('a01', 'write', { agent: 'a02', play: hit('a03', 'docks') }).ok, true);
    }
    const r = g.night({ a02: written ? back('a03') : hit('a03', 'docks'), a03: shift('docks') });
    assert.deepEqual([typedOf(playOn(r, 'a02')), forcedOn(r, 'a02').map(e => e.why)], [hit('a03', 'docks'), written ? ['sudo'] : []], 'control: a02 hit the agent it promised to back');
    return of(r, 'betray').map(e => [e.kind, e.by, e.victims]);
  };
  assert.deepEqual(night(false), [['turn', 'a02', ['a03']]], 'control: its own hit is a turn');
  assert.deepEqual(night(true), [], 'the hit SUDO wrote is not');
});

// --- bounties (§10; L3-6's open item) -------------------------------------------------------------------------------

test("a bounty never pays its own poster, not even through a staged hit on a friend: a fight its poster wins earns nothing, the bounty stays open, and the next fight in the night's order that earns it is paid (§10; GAP gap.bounty)", () => {
  const g = new Game({ n: 4 });
  armed(g, 'a01', 0);
  armed(g, 'a03', 1);
  g.grant('a01', 1000);
  g.grant('a02', 2 * N.nights * N.rent);
  // a02 is a01's friend: it works its shift wearing a piece for a01 to take.
  const worn = g.hand('a02', tierCopy(g.s, 'common'), { wear: true });
  const b = post(g, 'a01', { agent: 'a02', amount: 300 });
  const staged = g.night({ a01: hit('a02', NORMAL), a02: shift(NORMAL) });
  assert.deepEqual([fightOn(staged, 'hit', 'a02').won, of(staged, 'rob')[0].copy], [true, worn], 'control: the staged hit took the piece');
  assert.equal(of(staged, 'bounty').length, 0, 'its poster earns nothing');
  assert.deepEqual([g.s.bounties.map(x => x.id), g.s.offers.map(o => o.bounty)], [[b], [b]], 'the bounty stays open, its cash held');
  // Night 2: the poster breaks into a02's home while a03 hits it at work. Break-ins come first in the night's order,
  // but that one is the poster's, so the hit's leader is paid.
  g.hand('a02', tierCopy(g.s, 'rare'));
  g.hand('a02', tierCopy(g.s, 'common'), { wear: true });
  const r = g.night({ a01: breakin('a02'), a02: shift(NORMAL), a03: hit('a02', NORMAL) });
  assert.deepEqual([fightOn(r, 'breakin', 'a02').won, fightOn(r, 'hit', 'a02').won], [true, true], 'control: both won');
  assert.ok(of(r, 'burgle')[0].copy && of(r, 'rob')[0].copy, 'control: and both took a piece');
  assert.deepEqual(of(r, 'bounty', e => e.act === 'collected').map(e => [e.bounty, e.to]), [[b, 'a03']], "the hit's leader, after the poster's break-in");
});

test("a bounty never pays its own poster: not on a piece the poster takes itself, nor on an agent its Cop collars; another who takes the piece later is paid (§10, §13; GAP gap.bounty)", () => {
  const g = withTrades(['cop', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  armed(g, 'a01', 0);
  armed(g, 'a03', 1);
  g.grant('a01', 1000);
  g.grant('a03', 1000);
  // The Cop a01 collars wanted a02, on which it has posted a bounty.
  g.s.agents.a02.heat = N.wantedAt;
  post(g, 'a01', { agent: 'a02', amount: 300 });
  let r = g.night({ a01: { kind: 'collar', target: 'a02', place: NORMAL }, a02: shift(NORMAL) });
  assert.ok(g.s.agents.a02.jail, 'control: the collar won');
  assert.equal(of(r, 'bounty').length, 0, 'its poster collects nothing');
  // a03 posts a bounty on a04's piece and takes it itself.
  const piece = g.hand('a04', tierCopy(g.s, 'rare'), { wear: true });
  const b = post(g, 'a03', { copy: piece, amount: 200 });
  r = g.night({ a03: hit('a04', NORMAL), a04: shift(NORMAL) });
  assert.deepEqual(g.s.copies[piece].holder, { k: 'agent', id: 'a03' }, 'control: the poster took the piece');
  assert.equal(of(r, 'bounty').length, 0, 'and earned nothing');
  // a04 breaks into a03's home and takes it back: a04 is paid.
  armed(g, 'a04', 2);
  r = g.night({ a04: breakin('a03'), a03: shift(NORMAL) });
  assert.deepEqual(g.s.copies[piece].holder, { k: 'agent', id: 'a04' }, 'control: a04 took it from a03\'s stash');
  assert.deepEqual(of(r, 'bounty', e => e.act === 'collected').map(e => [e.bounty, e.to]), [[b, 'a04']]);
});
