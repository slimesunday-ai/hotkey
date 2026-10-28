// Layer 3's mind drugs: TRUTH, HALLU and SUDO (GAME.md §10, §11, §14, §19; brief R1-layer3-tricks.md, task L3-3, calls
// 2 and 3), with the rows in core/numbers.mjs (gap.truth, gap.hallu, gap.sudo, gap.forced). Every expected value was
// worked out from GAME.md, the brief's fills and those rows before the code ran, and every amount is read from N (or
// from the state the test set up), so tuning a number never breaks a test here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkPlay } from '../rules/plays.mjs';
import { checkLedger, ledgerProblems } from '../rules/ledger.mjs';
import { viewFor } from '../rules/view.mjs';
import { DAY15 } from '../rules/state.mjs';
import { N } from '../numbers.mjs';
import { withOverrides } from '../bench/runner.mjs';

const YARDS = 'industrial';
const shift = (place = YARDS) => ({ kind: 'hustle', place });
const hit = (target, place = YARDS) => ({ kind: 'hit', target, place });
const LAYLOW = { kind: 'laylow', place: 'suburbs' };
const has = (v, secret) => JSON.stringify(v).includes(secret);
// A drug's name as it shows in a view's JSON: a goods kind, or the value of a `drug` field.
const named = drug => `"${drug}"`;
const SECTION_11 = ['temp', 'truth', 'hallu', 'firewall', 'clear', 'sudo'];
const json = x => JSON.stringify(x);
// HALLU's leads in the one order that says nothing about which is true: sorted as text.
const sorted = leads => [...leads].sort((x, y) => (json(x) < json(y) ? -1 : json(x) > json(y) ? 1 : 0));

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
const housed = (g, ids) => ids.forEach(id => g.grant(id, 2 * N.nights * N.rent));
const ids = g => Object.keys(g.s.agents).sort();
const everyView = g => [
  ...ids(g).map(id => g.view(id, 'agent')),
  ...ids(g).map(id => g.view(id, 'ownerAI')),
  g.view(null, 'public'),
  g.view(null, 'record'),
];
const label = v => `${v.audience}${v.me ? ` (${v.me.id})` : ''}`;
// Every view but those of the agents named (theirs and their owners' AIs).
const othersThan = (g, few) => everyView(g).filter(v => !v.me || !few.includes(v.me.id));
const forcedOn = (r, id) => r.newEvents.filter(e => e.type === 'forced' && e.agent === id);
const playOn = (r, id) => r.newEvents.find(e => e.type === 'play' && e.agent === id);
const typedOf = p => ({ kind: p.kind, ...(p.target ? { target: p.target } : {}), place: p.place, ...(p.want ? { want: p.want } : {}) });
const sitdownWith = (g, viewer, other, audience = 'agent') => g.view(viewer, audience).me.sitdowns.find(sd => sd.with === other);
function sitDown(g, a, b) {
  g.errand(a, 'ask', { to: b });
  const sd = Object.keys(g.s.sitdowns).find(k => g.s.sitdowns[k].a === a && g.s.sitdowns[k].b === b);
  g.errand(b, 'answer', { sitdown: sd, accept: true });
  return sd;
}

// --- TRUTH (§11, call 3) --------------------------------------------------------------------------------------------

test('TRUTH: the take carries the play it locks, checked at the take; the lock plays it whatever the agent sends, as a forced play, never an invalid one; until dawn it is the only legal play (§11; GAP gap.truth, gap.forced)', () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  stock(g, 'a01', 'truth', 2);
  const locked = hit('a02', 'docks');
  const refused = [
    g.errand('a01', 'take', { drug: 'truth' }),
    g.errand('a01', 'take', { drug: 'truth', play: hit('a01', 'docks') }),
    g.errand('a01', 'take', { drug: 'truth', play: { kind: 'board', place: 'downtown' } }),
  ];
  assert.deepEqual(refused.map(r => r.ok), [false, false, false], "a take that locks no play, or one that can't work tonight, is refused");
  assert.equal(g.s.agents.a01.goods.truth, 2, 'and the dose stays');
  assert.equal(g.errand('a01', 'take', { drug: 'truth', play: { ...locked, reason: 'r' } }).ok, true);
  assert.equal(g.s.agents.a01.goods.truth, 1);
  assert.deepEqual(g.view('a01').legal, [locked], 'its one legal play tonight');
  const take = g.events('take', e => e.agent === 'a01');
  assert.deepEqual(take.map(e => e.drug), ['truth']);
  assert.ok(!('play' in take[0]) && !has(take[0], named('a02')), 'the take names the drug, never the play');
  const r = g.night({ a01: shift('docks'), a02: shift('docks') });
  assert.deepEqual(typedOf(playOn(r, 'a01')), locked, 'the locked play, not the one it sent');
  assert.deepEqual(forcedOn(r, 'a01').map(e => [e.why, e.play, e.instead]), [['truth', shift('docks'), locked]]);
  assert.equal(r.newEvents.filter(e => e.type === 'invalid').length, 0, 'never invalid');
  assert.ok(r.newEvents.some(e => e.type === 'fight' && e.target === 'a02'), 'and it went ahead');
  assert.ok(g.view('a01').legal.length > 1, 'at dawn the lock is gone');
  const free = g.night({ a01: shift('docks') });
  assert.deepEqual([playOn(free, 'a01').kind, forcedOn(free, 'a01').length], ['hustle', 0], 'its own play again');
});

test('TRUTH: checked again at the lock, which plays it: its taker can never make it impossible; a crash comes first, and jail before it (§11; GAP gap.truth, gap.forced)', () => {
  const g = withTrades(['chemist', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  for (const id of ids(g)) stock(g, id, 'truth', 1);
  stock(g, 'a01', 'chems', N.cook.chems);
  stock(g, 'a02', 'temp', 1);
  g.errand('a02', 'take', { drug: 'temp' });
  g.night();
  // Day 2: a01 locks a cook, then tries to give its chems away; a02 crashes tonight; a03 is in jail.
  const cook = { kind: 'cook', place: 'forest', batches: 1 };
  assert.equal(g.errand('a01', 'take', { drug: 'truth', play: cook }).ok, true);
  assert.deepEqual(g.view('a01').legal, [cook]);
  g.errand('a01', 'give', { to: 'a03', goods: { chems: g.s.agents.a01.goods.chems } });
  assert.deepEqual(g.view('a01').legal, [cook], 'the hand-over was refused, so the cook still works');
  assert.equal(g.view('a02').me.crash, true, 'control: a02 crashes tonight');
  assert.equal(g.errand('a02', 'take', { drug: 'truth', play: LAYLOW }).ok, true, 'crashing, it locks only the play the crash forces');
  assert.deepEqual(g.view('a02').legal, [LAYLOW], 'a crash comes before TRUTH');
  g.s.agents.a03.jail = { nights: N.jailNights, stars: 1, since: 1 };
  assert.equal(g.errand('a03', 'take', { drug: 'truth', play: shift() }).ok, false, 'in jail there is no play tonight to lock');
  const r = g.night({ a01: shift(), a02: shift() });
  assert.deepEqual([playOn(r, 'a01').kind, forcedOn(r, 'a01').map(e => [e.why, e.instead])], ['cook', [['truth', cook]]]);
  assert.deepEqual([playOn(r, 'a02').kind, forcedOn(r, 'a02').map(e => e.why)], ['laylow', ['crash']]);
  assert.deepEqual([playOn(r, 'a03'), forcedOn(r, 'a03').length], [undefined, 0], 'jail: no play at all');
  assert.equal(r.newEvents.filter(e => e.type === 'invalid').length, 0);
});

test("TRUTH: everyone the agent sits down with sees its locked play on that sit-down, marked verified, until dawn; nobody else does, and a locked hit's attacker stays hooded until the night's record goes public (§11, §14, §19; call 3; GAP gap.truth)", () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  stock(g, 'a01', 'truth', 1);
  // The canary: a piece in a03's stash, which only a03 sees, named as the locked hit's want.
  const secret = g.hand('a03', tierCopy(g.s, 'rare'));
  const locked = { ...hit('a03', 'junkyard'), want: secret };
  sitDown(g, 'a02', 'a01');
  g.errand('a04', 'ask', { to: 'a01' });
  assert.ok(!('verified' in sitdownWith(g, 'a02', 'a01')), 'nothing before the take');
  assert.equal(g.errand('a01', 'take', { drug: 'truth', play: locked }).ok, true);
  assert.deepEqual(sitdownWith(g, 'a02', 'a01').verified, locked, 'its partner sees the locked play, marked verified');
  assert.deepEqual(sitdownWith(g, 'a02', 'a01', 'ownerAI').verified, locked, "and so does its owner's AI");
  assert.ok(!('verified' in sitdownWith(g, 'a04', 'a01')), 'a sit-down only asked for is not one it sits down with');
  sitDown(g, 'a05', 'a01');
  assert.deepEqual(sitdownWith(g, 'a05', 'a01').verified, locked, 'sitting down after the take counts too');
  for (const v of [g.view('a04'), g.view('a04', 'ownerAI'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(!has(v, secret), `${label(v)}: no locked play`);
  }
  assert.ok(has(g.view('a02'), secret), 'positive control');
  // Night 1: the locked hit finds a03 on its run at The Heap.
  g.night({ a03: { kind: 'run', place: 'junkyard' } });
  const show = g.events('show').at(-1);
  assert.ok(!('a01' in show.seen) && show.hooded.junkyard === 1, 'hooded at the show');
  for (const v of [g.view('a04'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(!v.events.some(e => e.agent === 'a01' && has(e, named('a03'))), `${label(v)}: the attacker stays hooded at dawn`);
    assert.ok(v.events.some(e => e.type === 'take' && e.agent === 'a01' && e.drug === 'truth'), `${label(v)}: control: the take is public`);
  }
  // R4-3: the sit-down itself lasts (sitdownDays), and the lock ends at dawn, so nothing in it is verified now.
  assert.ok(sitdownWith(g, 'a02', 'a01') && !('verified' in sitdownWith(g, 'a02', 'a01')), 'the verified play ends at dawn');
  g.night();
  assert.ok(g.view(null, 'public').events.some(e => e.type === 'play' && e.agent === 'a01' && e.target === 'a03' && e.want === secret), "the night's record names it a day later");
});

// --- HALLU (§11) ----------------------------------------------------------------------------------------------------

test('HALLU: a cook of HALLU writes two typed lies, each an agent\'s cash, stash or tip; without two good ones it is invalid for good; its doses are one lot that carries the lies wherever they are handed over or stashed, oldest first; the fence takes none (§9, §11; GAP gap.hallu)', () => {
  const g = withTrades(['chemist', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  const piece = g.hand('a04', tierCopy(g.s, 'rare'));
  const L1 = [{ kind: 'cash', agent: 'a02', value: 4321 }, { kind: 'tip', agent: 'a03', value: 'a04' }];
  const L2 = [{ kind: 'stash', agent: 'a04', value: piece }, { kind: 'stash', agent: 'a03', value: null }];
  const cook = lies => ({ kind: 'cook', place: 'forest', batches: 1, drug: 'hallu', ...(lies ? { lies } : {}) });
  stock(g, 'a01', 'chems', 2 * N.cook.chems);
  const bad = [
    undefined, [L1[0]], [L1[0], { kind: 'cash', agent: 'a02', value: -1 }],
    [L1[0], { kind: 'cash', agent: 'a02', value: 1.5 }], [L1[0], { kind: 'rumour', agent: 'a02', value: 1 }],
    [L1[0], { kind: 'stash', agent: 'a02', value: 'no-such-copy' }], [L1[0], { kind: 'tip', agent: 'zz', value: 'a02' }],
    [L1[0], { kind: 'tip', agent: 'a02', value: 'zz' }], [L1[0], null],
  ];
  for (const lies of bad) {
    const r = checkPlay(g.s, 'a01', cook(lies), g.s.day);
    assert.deepEqual([r.ok, r.kind], [false, 'never'], `lies ${json(lies)}`);
  }
  assert.deepEqual(checkPlay(g.s, 'a01', cook(L1), g.s.day).play.lies, L1, 'two good lies, typed');
  g.night({ a01: cook(L1) });
  g.night({ a01: cook(L2) });
  assert.deepEqual(g.events('lies', e => e.agent === 'a01').map(e => e.lies), [L1, L2], 'the lies are typed, on a record of their own');
  assert.equal(g.s.agents.a01.goods.hallu, 2 * N.cook.doses, 'control: two batches');
  // The ledger knows a lot can't outnumber the doses it rides on.
  const s = structuredClone(g.s);
  delete s.agents.a01.goods.hallu;
  s.goods.out.test = { hallu: 2 * N.cook.doses };
  assert.ok(ledgerProblems(s).some(p => p.includes('a01') && p.includes('HALLU')), 'lots without their doses');
  assert.deepEqual(ledgerProblems(g.s), [], 'positive control');
  const leadsOf = id => g.events('take', e => e.agent === id && e.drug === 'hallu').at(-1).leads;
  const carries = (id, lies) => lies.every(l => leadsOf(id).some(x => json(x) === json(l)));
  // Day 3: a01 hands a02 exactly its first night's doses: the older lot goes first, so a01's own dose is night 2's.
  g.errand('a01', 'give', { to: 'a02', goods: { hallu: N.cook.doses } });
  g.errand('a01', 'take', { drug: 'hallu' });
  assert.ok(carries('a01', L2) && !carries('a01', L1), "a01's dose is from night 2's lot");
  // Through the crew stash: a02 puts one of night 1's in, a03 takes it out, and its dose still carries night 1's lies.
  g.errand('a02', 'crew_form', { name: 'c' });
  g.errand('a02', 'crew_invite', { agent: 'a03' });
  g.errand('a03', 'crew_join', { crew: g.s.agents.a02.crew });
  g.errand('a02', 'stash_put', { goods: { hallu: 1 } });
  g.errand('a03', 'stash_take', { goods: { hallu: 1 } });
  g.errand('a03', 'take', { drug: 'hallu' });
  assert.ok(carries('a03', L1) && !carries('a03', L2), "a03's dose is from night 1's lot");
  // The fence takes no HALLU, on either side of a swap.
  for (const [give, get] of [[{ goods: { hallu: 1 } }, { cash: 1 }], [{ cash: 1 }, { goods: { hallu: 1 } }]]) {
    const r = g.errand('a01', 'fence_swap', { to: 'a02', give, get });
    assert.equal(r.ok, false);
  }
  assert.ok(g.events('invalid', e => e.errand === 'fence_swap').every(e => e.kind === 'never'));
});

test("HALLU: a take gives three typed leads, sorted: its dose's two lies and one true lead, the first fact the taker hasn't had from a lead or a look: tonight's tips naming it, then the richest agent's cash, then its stash, then the next richest (§10, §11, §13; GAP gap.hallu)", () => {
  const g = withTrades(['chemist', 'smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  // a02 is the richest, then a03, then a04; a05 takes the HALLU.
  g.grant('a02', 30000);
  g.grant('a03', 20000);
  g.grant('a04', 10000);
  const lies = [{ kind: 'cash', agent: 'a04', value: 99 }, { kind: 'tip', agent: 'a02', value: 'a05' }];
  while ((g.s.agents.a01.goods.hallu || 0) < 4) {
    stock(g, 'a01', 'chems', N.cook.chems);
    g.night({ a01: { kind: 'cook', place: 'forest', batches: 1, drug: 'hallu', lies } });
  }
  g.errand('a01', 'give', { to: 'a05', goods: { hallu: 4 } });
  const takeLeads = () => {
    assert.equal(g.errand('a05', 'take', { drug: 'hallu' }).ok, true);
    return g.events('take', e => e.agent === 'a05').at(-1);
  };
  // Two tips name a05 tonight: the lower tipper's id comes first, whoever tipped first.
  g.errand('a04', 'tip', { agent: 'a05', target: 'a02' });
  g.errand('a03', 'tip', { agent: 'a05', target: 'a02' });
  let take = takeLeads();
  assert.deepEqual(take.leads, sorted([{ kind: 'tip', agent: 'a03', value: 'a05' }, ...lies]));
  assert.deepEqual([take.vis.to, take.vis.pub], [['a05'], g.s.clock + 2], "the taker's own now, everyone's 24 hours later");
  g.night();
  // The next day both tip again: a03's is no news now.
  g.errand('a03', 'tip', { agent: 'a05', target: 'a02' });
  g.errand('a04', 'tip', { agent: 'a05', target: 'a02' });
  assert.deepEqual(takeLeads().leads, sorted([{ kind: 'tip', agent: 'a04', value: 'a05' }, ...lies]));
  g.night();
  // No tips: a05 hires a lookout on the richest, so its cash and stash are no news; the next richest's cash is.
  g.grant('a05', N.lookout);
  g.errand('a05', 'lookout', { agent: 'a02' });
  assert.deepEqual(takeLeads().leads, sorted([{ kind: 'cash', agent: 'a03', value: g.s.agents.a03.cash }, ...lies]));
  g.night();
  assert.deepEqual(takeLeads().leads, sorted([{ kind: 'stash', agent: 'a03', value: null }, ...lies]), 'then its stash: no piece in it');
  assert.ok(g.view('a05', 'ownerAI').events.some(e => e.type === 'take' && e.day === g.s.day && e.leads.length === 3), "the taker and its owner's AI read today's leads");
  for (const v of othersThan(g, ['a05'])) assert.ok(!v.events.some(e => e.type === 'take' && e.agent === 'a05' && e.day === g.s.day), `${label(v)}: not today's leads`);
});

// --- SUDO (§11, call 2) ---------------------------------------------------------------------------------------------

test("SUDO handed over arrives as TEMP, carrying the giver's mark: the receiver holds TEMP and reads the hand-over as TEMP until it goes public; the mark lapses once it holds fewer TEMP than marks, so a SUDO passed on is plain TEMP (§10, §11; call 2; GAP gap.sudo)", () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  stock(g, 'a01', 'sudo', 2);
  stock(g, 'a02', 'temp', 1);
  stock(g, 'a04', 'temp', 1);
  assert.equal(g.errand('a01', 'give', { to: 'a02', goods: { sudo: 2 } }).ok, true);
  assert.deepEqual(g.s.agents.a02.goods, { temp: 3 }, 'it arrives as TEMP');
  assert.deepEqual([g.s.goods.out.disguise, g.s.goods.in.disguise], [{ sudo: 2 }, { temp: 2 }], 'booked out as SUDO, in as TEMP');
  const give = v => v.events.find(e => e.type === 'give' && e.from === 'a01');
  assert.deepEqual(give(g.view('a02')).goods, { temp: 2 }, 'the receiver reads the hand-over as TEMP');
  assert.deepEqual(give(g.view('a02', 'ownerAI')).goods, { temp: 2 }, "and so does its owner's AI");
  assert.deepEqual(give(g.view('a01')).goods, { sudo: 2 }, 'the giver knows what it gave');
  for (const v of [g.view('a02'), g.view('a02', 'ownerAI')]) assert.ok(!has(v, named('sudo')), `${label(v)}: no SUDO`);
  // a02 sells one TEMP (three TEMP, two marks: none lapses), then hands one to a03 (two marks on one TEMP: one lapses).
  g.errand('a02', 'sell', { item: 'doses', units: 1 });
  g.errand('a02', 'give', { to: 'a03', goods: { temp: 1 } });
  g.errand('a02', 'take', { drug: 'temp' });
  g.errand('a03', 'take', { drug: 'temp' });
  const took = id => g.events('take', e => e.agent === id).at(-1);
  assert.deepEqual([took('a02').drug, took('a02').writer], ['sudo', 'a01'], 'its last TEMP carried a mark');
  assert.deepEqual([took('a03').drug, took('a03').writer], ['temp', undefined], 'a SUDO passed on unknowingly is plain TEMP');
  g.night();
  assert.deepEqual(give(g.view('a02')).goods, { sudo: 2 }, "24 hours later the hand-over is everyone's, the receiver's too");
  // Day 2: the second mark lapsed, so a plain TEMP from a04 is plain TEMP.
  g.errand('a04', 'give', { to: 'a02', goods: { temp: 1 } });
  g.errand('a02', 'take', { drug: 'temp' });
  assert.deepEqual([took('a02').drug, took('a02').day], ['temp', 2]);
});

test("SUDO: a TEMP taken while the agent carries a mark is SUDO, written by the mark's giver: no +1 and no crash; the writer sees the take at once, the taker and its owner see TEMP until the night settles, and the written play replaces the taker's own, with no reason (§8, §11; call 2; GAP gap.sudo, gap.forced)", () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  stock(g, 'a01', 'sudo', 1);
  stock(g, 'a02', 'temp', 1);
  stock(g, 'a03', 'temp', 1);
  g.errand('a01', 'give', { to: 'a02', goods: { sudo: 1 } });
  assert.equal(g.errand('a01', 'write', { agent: 'a02', play: shift() }).ok, false, 'nothing to write before the take');
  const before = g.view('a02').legal;
  assert.equal(g.errand('a02', 'take', { drug: 'temp' }).ok, true);
  g.errand('a03', 'take', { drug: 'temp' });
  // The taker sees TEMP: its high, its take, its walk and its legal plays are TEMP's.
  for (const v of [g.view('a02'), g.view('a02', 'ownerAI')]) {
    assert.deepEqual(v.me.high, ['temp'], label(v));
    assert.deepEqual(v.events.filter(e => e.type === 'take').map(e => [e.agent, e.drug, e.writer]), [['a02', 'temp', undefined]], label(v));
    assert.ok(!has(v, named('sudo')), `${label(v)}: no SUDO`);
  }
  assert.deepEqual(g.view('a02').legal, before, 'its legal plays are as they were');
  assert.equal(g.view(null, 'public').board.agents.find(a => a.id === 'a02').walk, N.walks.temp, 'it walks as TEMP does');
  const again = g.errand('a02', 'take', { drug: 'temp' });
  assert.deepEqual([again.ok, again.why], [false, 'one dose of each drug a day'], 'one TEMP a day, as far as it knows');
  // The writer sees the truth at once, and only the mark's giver can write.
  const seen = g.view('a01').events.find(e => e.type === 'take' && e.agent === 'a02');
  assert.deepEqual([seen.drug, seen.writer], ['sudo', 'a01']);
  assert.equal(g.errand('a04', 'write', { agent: 'a02', play: shift() }).ok, false);
  assert.equal(g.errand('a01', 'write', { agent: 'a02', play: hit('a02') }).ok, false, "checked as the taker's play");
  const written = hit('a04', 'docks');
  assert.equal(g.errand('a01', 'write', { agent: 'a02', play: { ...written, reason: 'theirs' } }).ok, true);
  const write = g.events('write')[0];
  assert.deepEqual([write.by, write.agent, write.play, write.vis.to], ['a01', 'a02', written, ['a01']]);
  assert.ok(!g.view('a02').events.some(e => e.type === 'write'), 'the taker never sees the write');
  // Night 1: a02 plays what was written, at its own strength; a03, on TEMP, gets its +1.
  const r = g.night({ a01: shift(), a02: { ...shift(), reason: 'mine' }, a03: hit('a01'), a04: shift('docks') });
  assert.deepEqual(typedOf(playOn(r, 'a02')), written);
  assert.equal(playOn(r, 'a02').reason, '', 'a written play carries no reason');
  assert.deepEqual(forcedOn(r, 'a02').map(e => [e.why, e.play, e.instead]), [['sudo', shift(), written]]);
  const fight = target => r.newEvents.find(e => e.type === 'fight' && e.target === target);
  assert.deepEqual([fight('a04').sides[0].strength, fight('a01').sides[0].strength], [1, 2], 'no +1 on SUDO; +1 on TEMP');
  assert.equal(write.vis.pub, playOn(r, 'a02').vis.pub, 'the write goes public with the night\'s plays');
  // At dawn the taker knows, and there's no crash.
  assert.deepEqual([g.view('a02').me.crash, g.view('a03').me.crash], [false, true], 'no crash on SUDO');
  const told = g.view('a02').events.find(e => e.type === 'take' && e.agent === 'a02');
  assert.deepEqual([told.drug, told.writer], ['sudo', 'a01'], "the taker's at the settle");
  assert.ok(g.view(null, 'public').events.some(e => e.type === 'take' && e.agent === 'a02' && e.drug === 'sudo' && e.writer === 'a01'), "everyone's 24 hours later");
});

test("SUDO: nobody takes it on purpose; with nothing written the taker's own play stands; a written play that fails at the lock gives way to the default play; the last write stands; and on night 14 it does nothing (§11, §15; GAP gap.sudo)", () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'chemist']);
  housed(g, ids(g));
  stock(g, 'a01', 'sudo', 5);
  const refused = g.errand('a01', 'take', { drug: 'sudo' });
  assert.deepEqual([refused.ok, g.s.agents.a01.goods.sudo], [false, 5], 'nobody takes SUDO on purpose');
  // Night 1: nothing written.
  g.errand('a01', 'give', { to: 'a02', goods: { sudo: 1 } });
  g.errand('a02', 'take', { drug: 'temp' });
  let r = g.night({ a02: shift() });
  assert.deepEqual([typedOf(playOn(r, 'a02')), forcedOn(r, 'a02').length], [shift(), 0], 'its own play');
  // Night 2: a01 writes a04's cook; a04 then hands its chems away, so at the lock it gives way to the default play.
  stock(g, 'a04', 'chems', N.cook.chems);
  g.errand('a01', 'give', { to: 'a04', goods: { sudo: 1 } });
  g.errand('a04', 'take', { drug: 'temp' });
  assert.equal(g.errand('a01', 'write', { agent: 'a04', play: { kind: 'cook', place: 'forest', batches: 1 } }).ok, true);
  g.errand('a04', 'give', { to: 'a03', goods: { chems: g.s.agents.a04.goods.chems } });
  r = g.night({ a04: shift() });
  assert.deepEqual([playOn(r, 'a04').kind, forcedOn(r, 'a04').map(e => [e.why, e.instead])], ['laylow', [['sudo', LAYLOW]]]);
  // Night 3: two writes; the last stands.
  g.errand('a01', 'give', { to: 'a03', goods: { sudo: 1 } });
  g.errand('a03', 'take', { drug: 'temp' });
  g.errand('a01', 'write', { agent: 'a03', play: shift('docks') });
  g.errand('a01', 'write', { agent: 'a03', play: shift('downtown') });
  r = g.night({ a03: shift() });
  assert.deepEqual(typedOf(playOn(r, 'a03')), shift('downtown'));
  // Night 14: it can't keep anyone off the ferry.
  g.advanceTo(N.nights);
  g.errand('a01', 'give', { to: 'a02', goods: { sudo: 1 } });
  assert.equal(g.errand('a02', 'take', { drug: 'temp' }).ok, true);
  assert.equal(g.events('take', e => e.agent === 'a02').at(-1).drug, 'sudo');
  assert.equal(g.errand('a01', 'write', { agent: 'a02', play: hit('a03', 'downtown') }).ok, false, 'no write on day 14');
  r = g.night({ a02: { kind: 'board', place: 'industrial' } });
  assert.deepEqual([typedOf(playOn(r, 'a02')), forcedOn(r, 'a02').length], [{ kind: 'board', place: 'industrial' }, 0]);
  assert.equal(g.s.agents.a02.boarded, true);
});

// R4-4: the first night whose arrest still holds its agent when the ferry leaves (gap.ferryJail): under 'released' (the
// rule since R3-3) jail ends at dawn on day 14, so only night 14's own arrests miss the boat; under 'missed', any from
// night nights − jailNights on.
const offBoat = () => (N['gap.ferryJail'] === 'released' ? N.nights : N.nights - N.jailNights);
for (const ferryJail of ['released', 'missed']) test(`SUDO can't keep anyone off the ferry (gap.ferryJail '${ferryJail}'): no write goes through from the first night whose arrest would still hold its taker when the ferry leaves, so an arrest a written play brings ends before the boarding (§11, §13, §15; GAP gap.sudo)`, () => withOverrides({ 'gap.ferryJail': ferryJail }, () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  stock(g, 'a01', 'sudo', N.jailNights + 2);
  const lastDay = offBoat() - 1;
  g.advanceTo(lastDay);
  // The last day a write goes through: a02, a star short of an arrest, is written a break-in, and is arrested tonight.
  g.s.agents.a02.heat = N.maxHeat - 1;
  g.errand('a01', 'give', { to: 'a02', goods: { sudo: 1 } });
  g.errand('a02', 'take', { drug: 'temp' });
  assert.equal(g.errand('a01', 'write', { agent: 'a02', play: { kind: 'breakin', target: 'a03' } }).ok, true);
  g.night();
  // Under 'released' a night-13 arrest walks out at the very next dawn, so the record shows it, not the jail.
  assert.ok(g.events('arrest').some(e => e.agent === 'a02' && e.night === lastDay), 'control: the written play got a02 arrested');
  // From the next day on, nothing a writer writes goes through, and the taker's own play stands.
  for (let day = lastDay + 1; day <= N.nights; day++) {
    g.errand('a01', 'give', { to: 'a04', goods: { sudo: 1 } });
    assert.equal(g.errand('a04', 'take', { drug: 'temp' }).ok, true);
    const w = g.errand('a01', 'write', { agent: 'a04', play: shift('downtown') });
    assert.equal(w.ok, false, `day ${day}: no write`);
    assert.equal(g.events('invalid', e => e.agent === 'a01' && e.day === day)[0].kind, 'never', `day ${day}: for good`);
    const r = g.night();
    assert.equal(forcedOn(r, 'a04').length, 0, `night ${day}: its own play`);
  }
  assert.deepEqual([g.s.agents.a02.boarded, g.events('missed').length], [true, 0], "a02's arrest ended before the ferry left");
}));

test("FIREWALL stops a SUDO write: the write still goes through, so its writer learns nothing it wouldn't have anyway, but if the taker is on FIREWALL at the lock the written play is ignored and its own play stands (§11; GAP gap.sudo, gap.firewall)", () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  stock(g, 'a01', 'sudo', 3);
  stock(g, 'a02', 'firewall', 1);
  stock(g, 'a04', 'firewall', 1);
  for (const id of ['a02', 'a03', 'a04']) g.errand('a01', 'give', { to: id, goods: { sudo: 1 } });
  // a04 takes FIREWALL before its TEMP, a02 after it; a03 takes none.
  g.errand('a04', 'take', { drug: 'firewall' });
  for (const id of ['a02', 'a03', 'a04']) assert.equal(g.errand(id, 'take', { drug: 'temp' }).ok, true);
  g.errand('a02', 'take', { drug: 'firewall' });
  const writes = ['a02', 'a03', 'a04'].map(id => g.errand('a01', 'write', { agent: id, play: shift('docks') }));
  assert.deepEqual(writes.map(w => [w.ok, w.events.map(e => e.type)]), [[true, ['write']], [true, ['write']], [true, ['write']]], 'every write goes through, the same way');
  assert.ok(!has(g.view('a01'), named('firewall')) && has(g.view('a02'), named('firewall')), "the writer's view names no FIREWALL (positive control: the taker's does)");
  const r = g.night({ a02: shift(), a03: shift(), a04: shift() });
  for (const id of ['a02', 'a04']) assert.deepEqual([typedOf(playOn(r, id)), forcedOn(r, id).length], [shift(), 0], `${id}: on FIREWALL at the lock, its own play`);
  assert.deepEqual([typedOf(playOn(r, 'a03')), forcedOn(r, 'a03').map(e => e.why)], [shift('docks'), ['sudo']], 'control: without it, the written play');
});

// --- the lock's order (§11, §17) ------------------------------------------------------------------------------------

test("the lock forces plays in order: jail, then a crash or a withdrawal, then TRUTH's locked play, then SUDO's written play, then the agent's own; and SUDO, sold as TEMP, feeds a hook on TEMP, so its taker's legal plays never change (§11, §17; GAP gap.forced, gap.sudo)", () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  stock(g, 'a01', 'sudo', 4);
  stock(g, 'a02', 'truth', 1);
  stock(g, 'a03', 'temp', 1);
  stock(g, 'a04', 'temp', N.hooked.nights);
  // a04 takes TEMP every day until it's hooked, and crashes the night after; a03 takes it that day, so it crashes the
  // night after that, when a04 is hooked and not crashing.
  for (let day = 1; day <= N.hooked.nights; day++) {
    g.errand('a04', 'take', { drug: 'temp' });
    g.night();
  }
  g.errand('a03', 'take', { drug: 'temp' });
  g.night();
  assert.deepEqual([g.view('a04').me.hooked, g.view('a04').me.crash, g.view('a03').me.crash], [['temp'], false, true], 'control');
  assert.deepEqual(g.view('a04').legal, [LAYLOW], 'control: hooked on TEMP without it, a04 can only lay low');
  for (const id of ['a02', 'a03', 'a04', 'a05']) g.errand('a01', 'give', { to: id, goods: { sudo: 1 } });
  g.errand('a02', 'take', { drug: 'truth', play: shift('docks') });
  for (const id of ['a02', 'a03', 'a04', 'a05']) assert.equal(g.errand(id, 'take', { drug: 'temp' }).ok, true);
  assert.ok(g.view('a04').legal.length > 1, "a04 took what it thinks is TEMP, so it's no longer in withdrawal");
  g.s.agents.a05.jail = { nights: N.jailNights, stars: 1, since: g.s.day - 1 };
  for (const id of ['a02', 'a03', 'a04', 'a05']) assert.equal(g.errand('a01', 'write', { agent: id, play: shift('downtown') }).ok, true);
  const r = g.night({ a02: shift(), a03: shift(), a04: shift(), a06: shift() });
  const why = id => forcedOn(r, id).map(e => e.why);
  assert.deepEqual([playOn(r, 'a05'), why('a05')], [undefined, []], 'jail first');
  assert.deepEqual([playOn(r, 'a03').kind, why('a03')], ['laylow', ['crash']], 'then a crash');
  assert.deepEqual([typedOf(playOn(r, 'a02')), why('a02')], [shift('docks'), ['truth']], "then TRUTH's locked play");
  assert.deepEqual([typedOf(playOn(r, 'a04')), why('a04')], [shift('downtown'), ['sudo']], "then SUDO's written play");
  assert.deepEqual([typedOf(playOn(r, 'a06')), why('a06')], [shift(), []], 'then its own');
});

// --- who sees what, and when (§19; slime's standing call) -----------------------------------------------------------

// Every view at the state's clock: the board never names a drug, and no event names one to an audience it doesn't
// involve before its 24 hours are up. An event involves the agents it's shown to live (a public one, the agent it's
// about); a public one's 24 hours end at day 15 for the last night's (§19). As L3-2's canary does.
function liveCanary(s, log, when) {
  const byN = new Map(log.map(e => [e.n, e]));
  const audiences = [[null, 'public'], [null, 'record'], ...Object.keys(s.agents).sort().flatMap(id => [[id, 'agent'], [id, 'ownerAI']])];
  for (const [who, audience] of audiences) {
    const v = viewFor(s, log, who, audience);
    const where = `${when}, ${audience}${who ? ` (${who})` : ''}`;
    for (const d of SECTION_11) assert.ok(!has(v.board, named(d)), `${where}: ${d} on the board`);
    for (const ev of v.events) {
      const e = byN.get(ev.n);
      const involved = !!who && (e.vis.to === 'all' ? e.agent === who : e.vis.to.includes(who));
      const until = e.vis.to === 'all' ? Math.min(e.t + 2, DAY15) : e.vis.pub;
      if (involved || s.clock >= until) continue;
      for (const d of SECTION_11) assert.ok(!has(ev, named(d)), `${where}: ${d} in a ${e.type} event, live`);
    }
  }
}

test("a mind drug's name never shows live, and SUDO's disguise holds: over a season of TRUTH, HALLU and SUDO, no audience a drug doesn't involve reads its name before its 24 hours, and an agent sold SUDO as TEMP never reads SUDO before its hand-over goes public or its night settles (§11, §19; slime's standing call; call 2)", () => {
  const g = withTrades(['chemist', 'chemist', 'smuggler', 'smuggler', 'smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  stock(g, 'a03', 'truth', N.nights);
  // a07 and a08 are only ever sold SUDO as TEMP: a hand-over that brought it reads as TEMP to them until it goes public,
  // and a take of it until its night settles; their highs never read SUDO.
  const blind = ['a07', 'a08'];
  let disguised = 0;
  const check = when => {
    liveCanary(g.s, g.log, when);
    const byN = new Map(g.log.map(e => [e.n, e]));
    for (const id of blind) {
      for (const v of [g.view(id), g.view(id, 'ownerAI')]) {
        assert.ok(!v.me.high.includes('sudo'), `${when}: SUDO in ${label(v)}'s highs`);
        for (const ev of v.events) {
          const e = byN.get(ev.n);
          const until = e.type === 'take' && e.writer ? e.t + 1 : e.type === 'give' && e.goods && e.goods.sudo ? e.vis.pub : -1;
          if (g.s.clock >= until) continue;
          disguised += 1;
          assert.ok(!has(ev, named('sudo')) && !('writer' in ev), `${when}: ${e.type} n${e.n} names SUDO to ${label(v)}`);
        }
      }
    }
  };
  const lies = [{ kind: 'cash', agent: 'a05', value: 1 }, { kind: 'tip', agent: 'a06', value: 'a04' }];
  // Every night but the last, a01 cooks a batch of HALLU and a02 one of SUDO.
  const cooks = () => {
    for (const id of ['a01', 'a02']) stock(g, id, 'chems', N.cook.chems);
    return { a01: { kind: 'cook', place: 'forest', batches: 1, drug: 'hallu', lies }, a02: { kind: 'cook', place: 'forest', batches: 1, drug: 'sudo' } };
  };
  g.night(cooks());
  check('day 2');
  for (let day = 2; day < N.nights; day++) {
    // TRUTH: a03 locks a shift and sits down with a04. R4-3: a sit-down lasts, so a04 closes yesterday's first.
    // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a03's locked night out is a hustle at the Mall (lawless, no star), as its shift in The Yards added none; at The Yards (normal) a star a night jailed it by day 6.
    g.errand('a03', 'take', { drug: 'truth', play: shift('mall') });
    const old = Object.values(g.s.sitdowns).find(x => x.a === 'a04' && x.b === 'a03');
    if (old) g.errand('a04', 'close', { sitdown: old.id });
    sitDown(g, 'a04', 'a03');
    assert.deepEqual(sitdownWith(g, 'a04', 'a03').verified, shift('mall'), `day ${day}: control: a04 sees a03's play, verified`);
    // HALLU: a01 hands a dose to a05 or a06, which takes it; a06 hires a lookout first.
    const taker = day % 2 ? 'a05' : 'a06';
    if (g.s.agents.a01.goods.hallu) g.errand('a01', 'give', { to: taker, goods: { hallu: 1 } });
    if (taker === 'a06') g.errand('a06', 'lookout', { agent: 'a03' });
    g.errand(taker, 'take', { drug: 'hallu' });
    // SUDO: a02 sells one as TEMP to a07 or a08, which takes TEMP today or tomorrow; a02 writes when it sees a take.
    const mark = blind[day % 2];
    if (g.s.agents.a02.goods.sudo) g.errand('a02', 'give', { to: mark, goods: { sudo: 1 } });
    check(`day ${day}, after the hand-over`);
    if (day % 3) g.errand(mark, 'take', { drug: 'temp' });
    for (const id of blind) {
      if (g.view('a02').events.some(e => e.type === 'take' && e.agent === id && e.writer === 'a02' && e.day === day)) {
        g.errand('a02', 'write', { agent: id, play: shift('docks') });
      }
    }
    check(`day ${day}`);
    g.night(cooks());
  }
  check('day 14');
  g.night();
  check('day 15');
  // Controls: each drug did its thing, a02 saw its takes at once, and the disguise had something to hide.
  assert.ok(g.events('take', e => e.drug === 'truth').length >= 3 && g.events('take', e => e.leads).length >= 3);
  const sudo = g.events('take', e => e.drug === 'sudo');
  assert.ok(sudo.length >= 3 && sudo.every(e => e.writer === 'a02' && e.vis.to.includes('a02')), 'the writer sees each take at once');
  assert.ok(g.events('forced', e => e.why === 'sudo').length >= 3 && g.events('forced', e => e.why === 'truth').length >= 3);
  assert.ok(disguised >= 6, `control: ${disguised} disguised events checked`);
});

test("the mind drugs' inputs are typed: an unknown field or a bad value in TRUTH's play, a written play or HALLU's lies never reaches any view (§18, §23)", () => {
  const g = withTrades(['chemist', 'smuggler', 'smuggler', 'smuggler']);
  housed(g, ids(g));
  stock(g, 'a01', 'chems', 2 * N.cook.chems);
  stock(g, 'a02', 'truth', 1);
  stock(g, 'a04', 'sudo', 1);
  assert.equal(g.errand('a02', 'take', { drug: 'truth', play: { kind: 'CANARY-T-KIND', place: 'CANARY-T-PLACE' } }).ok, false);
  assert.equal(g.errand('a02', 'take', { drug: 'truth', play: { ...shift('docks'), note: 'CANARY-T-NOTE', want: 'CANARY-T-WANT' }, line: 'CANARY-T-LINE' }).ok, true);
  g.errand('a04', 'give', { to: 'a03', goods: { sudo: 1 } });
  g.errand('a03', 'take', { drug: 'temp' });
  assert.equal(g.errand('a04', 'write', { agent: 'a03', play: { kind: 'CANARY-W-KIND' } }).ok, false);
  assert.equal(g.errand('a04', 'write', { agent: 'a03', play: { ...shift('docks'), note: 'CANARY-W-NOTE', reason: 'CANARY-W-REASON' } }).ok, true);
  const lie = { kind: 'cash', agent: 'a02', value: 5 };
  g.night({ a01: { kind: 'cook', place: 'forest', batches: 1, drug: 'hallu', lies: [lie, { kind: 'stash', agent: 'a03', value: 'CANARY-L-VALUE' }] } });
  g.night({ a01: { kind: 'cook', place: 'forest', batches: 1, drug: 'hallu', lies: [lie, { kind: 'tip', agent: 'a03', value: 'a02', note: 'CANARY-L-NOTE' }] } });
  assert.deepEqual(g.events('lies', e => e.agent === 'a01').at(-1).lies, [lie, { kind: 'tip', agent: 'a03', value: 'a02' }], 'positive control: the good lies, typed');
  assert.deepEqual(typedOf(g.events('play', e => e.agent === 'a02')[0]), shift('docks'), "positive control: TRUTH's play, typed");
  assert.deepEqual(typedOf(g.events('play', e => e.agent === 'a03')[0]), shift('docks'), 'positive control: the written play, typed');
  const canaries = ['CANARY-T-KIND', 'CANARY-T-PLACE', 'CANARY-T-NOTE', 'CANARY-T-WANT', 'CANARY-T-LINE', 'CANARY-W-KIND', 'CANARY-W-NOTE', 'CANARY-W-REASON', 'CANARY-L-VALUE', 'CANARY-L-NOTE'];
  const nowhere = when => {
    for (const v of everyView(g)) for (const c of canaries) assert.ok(!has(v, c), `${when}: ${c} in ${label(v)}`);
  };
  nowhere('the morning after');
  g.night();
  g.night();
  nowhere('two days later');
});
