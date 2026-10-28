// Layer 3's bounties and lookouts (GAME.md §10, §15, §19, §22, §38; brief R1-layer3-tricks.md, task L3-4 and call 4), with
// the rows in core/numbers.mjs (lookout, gap.bounty, gap.lookout). Every expected value was worked out from GAME.md, the
// brief's fills and those rows before the code ran. Amounts come from N where GAME.md sets them, so tuning a number never
// breaks these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, abilityCopy, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger, ledgerProblems } from '../rules/ledger.mjs';
import { viewFor } from '../rules/view.mjs';
import { DAY15 } from '../rules/state.mjs';
import { N } from '../numbers.mjs';

const has = (v, secret) => JSON.stringify(v).includes(secret);
const label = v => `${v.audience}${v.me ? ` (${v.me.id})` : ''}`;
const hit = (target, place = 'docks') => ({ kind: 'hit', target, place });
// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the helpers' filler is a hustle at the Mall now; a test whose hit finds a filler at the docks passes this one.
const DOCKS = { filler: { kind: 'hustle', place: 'docks' } };
const breakin = target => ({ kind: 'breakin', target, place: 'suburbs' });
const bountyEvents = (v, act) => v.events.filter(e => e.type === 'bounty' && (!act || e.act === act));
const fightEvent = (r, kind, target) => r.newEvents.find(e => e.type === 'fight' && e.kind === kind && e.target === target);
// Brass knuckles, worn: +1 attacking, so one agent beats one unarmed agent in the street or an empty home's lock (§8).
const armed = (g, id) => g.hand(id, abilityCopy(g.s, 'knuckles'), { wear: true });
// Posts a bounty and returns its id.
const post = (g, by, fields) => {
  const r = g.errand(by, 'bounty', fields);
  assert.equal(r.ok, true, `${by} posts ${JSON.stringify(fields)}`);
  return r.events.find(e => e.type === 'bounty').bounty;
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
const everyView = g => [
  ...Object.keys(g.s.agents).sort().map(id => g.view(id, 'agent')),
  ...Object.keys(g.s.agents).sort().map(id => g.view(id, 'ownerAI')),
  g.view(null, 'public'),
  g.view(null, 'record'),
];

// --- posting (§10, §19, §22) ----------------------------------------------------------------------------------------

test('a bounty puts cash on a piece or another agent: held where the list holds offers, and on the board at once, never with its poster (§10, §19, §22)', () => {
  const g = new Game({ n: 4 });
  const piece = g.hand('a02', tierCopy(g.s, 'rare'));
  g.grant('a03', 1000);
  const b1 = post(g, 'a03', { agent: 'a01', amount: 300 });
  const b2 = post(g, 'a03', { copy: piece, amount: 200 });
  assert.equal(g.s.agents.a03.cash, 500, 'the cash leaves its stash now');
  assert.deepEqual(g.s.offers, [{ by: 'a03', bounty: b1, amount: 300 }, { by: 'a03', bounty: b2, amount: 200 }], 'and is held where the list holds offers');
  assert.deepEqual(ledgerProblems(g.s), [], 'still the island\'s cash');
  for (const v of [g.view(null, 'public'), g.view('a01'), g.view('a02', 'ownerAI'), g.view(null, 'record')]) {
    const rows = v.board.bounties;
    assert.deepEqual(rows.map(b => [b.bounty, b.agent || b.copy, b.amount]), [[b1, 'a01', 300], [b2, piece, 200]], `${label(v)}: the agent or the piece, and the amount, live`);
    assert.equal(rows[1].trait, g.s.copies[piece].trait, `${label(v)}: the piece as a fit shows one`);
    assert.ok(!has(rows, 'a03'), `${label(v)}: never who posted it`);
  }
  assert.deepEqual(g.view('a03').me.bounties.map(b => b.bounty), [b1, b2], 'its poster sees its own');
  assert.deepEqual(g.view('a01').me.bounties, [], 'nobody else sees whose they are');
});

test("a bounty names one piece or another agent, in whole dollars its poster holds; it can't be taken back (§10, GAP gap.bounty)", () => {
  const g = new Game({ n: 3 });
  const piece = g.hand('a02', tierCopy(g.s, 'common'));
  g.grant('a01', 500);
  const bad = [
    { amount: 100 }, { agent: 'a01', amount: 100 }, { agent: 'a09', amount: 100 }, { copy: 'k999', amount: 100 },
    { copy: piece, agent: 'a02', amount: 100 }, { agent: 'a02', amount: 0 }, { agent: 'a02', amount: -5 },
    { agent: 'a02', amount: 2.5 }, { agent: 'a02', amount: '100' }, { agent: 'a02' },
  ];
  for (const fields of bad) assert.equal(g.errand('a01', 'bounty', fields).ok, false, JSON.stringify(fields));
  const short = g.errand('a01', 'bounty', { agent: 'a02', amount: 501 });
  assert.deepEqual([short.ok, short.events[0].errand, short.events[0].kind], [false, 'bounty', 'not-yet'], 'not enough cash, yet');
  assert.deepEqual([g.s.agents.a01.cash, g.s.offers], [500, []], 'a refused bounty holds nothing');
  const b = post(g, 'a01', { copy: piece, amount: 100 });
  g.night();
  g.night();
  assert.deepEqual(g.s.offers, [{ by: 'a01', bounty: b, amount: 100 }], 'still held two nights on: nothing takes it back but a payout or night 14');
});

test("the list's offers settle without touching a bounty's cash, and me.offers stays the list's (§3, §22)", () => {
  const g = new Game({ n: 3 });
  g.grant('a01', 1000);
  const trait = Object.values(g.s.traits).find(t => t.tier === 'common' && !t.ability);
  assert.equal(g.errand('a01', 'offer', { trait: trait.id, amount: trait.price }).ok, true);
  const b = post(g, 'a01', { agent: 'a02', amount: 250 });
  assert.deepEqual(g.view('a01').me.offers, [{ trait: trait.id, amount: trait.price }], 'only the list offer');
  g.night();
  assert.ok(g.events('buy').some(e => e.agent === 'a01' && e.trait === trait.id), 'control: the list settled the offer');
  assert.deepEqual(g.s.offers, [{ by: 'a01', bounty: b, amount: 250 }], 'and left the bounty held');
  assert.deepEqual(g.view('a01').me.offers, []);
});

// --- payouts at the takes (§7, §10, §13; call 4) --------------------------------------------------------------------

test('a bounty on an agent pays all of it to the leader of a won hit on that agent, once; the board drops it (§10, call 4)', () => {
  const g = new Game({ n: 4 });
  armed(g, 'a01');
  g.grant('a01', 100);
  g.grant('a04', 1000);
  const b = post(g, 'a04', { agent: 'a02', amount: 400 });
  g.hand('a02', tierCopy(g.s, 'common'), { wear: true });
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a02 is a filler the hit finds at the docks, so these nights pass the docks filler; the work event's wage is a02's hustle event's take.
  const r = g.night({ a01: hit('a02') }, DOCKS);
  assert.equal(fightEvent(r, 'hit', 'a02').won, true, 'control: 2 against 1');
  // a02 is out on a shift, so the hit also takes its wage tonight (§7, GAP gap.holdup).
  const rob = r.newEvents.find(e => e.type === 'rob' && e.leader === 'a01');
  assert.equal(rob.cash, r.newEvents.find(e => e.type === 'hustle' && e.agent === 'a02').take, "the hold-up: a02's wage");
  assert.equal(g.s.agents.a01.cash, 100 + 400 + rob.cash - N.rent, "the whole bounty and the hit's take, then the night's rent");
  assert.equal(g.s.money.out.fence, undefined, 'the fence takes no cut: a transfer, not a sink');
  assert.deepEqual([g.s.offers, g.view(null, 'public').board.bounties], [[], []], 'its cash came out of the offers, and it came off the board');
  const paid = r.newEvents.filter(e => e.type === 'bounty');
  assert.deepEqual(paid.map(e => [e.act, e.bounty, e.agent, e.amount]).sort(), [['collected', b, 'a02', 400], ['paid', b, 'a02', 400]]);
  assert.equal(paid.find(e => e.act === 'collected').to, 'a01');
  assert.equal(paid.find(e => e.act === 'paid').by, 'a04');
  const again = g.night({ a01: hit('a02') }, DOCKS);
  assert.equal(fightEvent(again, 'hit', 'a02').won, true, 'control: robbed again');
  assert.equal(again.newEvents.filter(e => e.type === 'bounty').length, 0, 'it paid once');
});

test('a bounty on a piece pays the leader of the won hit or break-in that takes that piece, and no other fight (§7, §10)', () => {
  const g = new Game({ n: 4 });
  const worn = g.hand('a02', tierCopy(g.s, 'common'), { wear: true });
  const kept = g.hand('a02', tierCopy(g.s, 'rare'));
  armed(g, 'a01');
  armed(g, 'a03');
  g.grant('a01', 100);
  g.grant('a03', 100);
  g.grant('a04', 1000);
  // The first night's hit takes a02's wage too (§7, GAP gap.holdup), so a02 brings a night's rent and keeps its home.
  g.grant('a02', N.rent);
  const b = post(g, 'a04', { copy: kept, amount: 300 });
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a02 is a filler the hit finds at the docks, so this night passes the docks filler.
  const first = g.night({ a01: hit('a02') }, DOCKS);
  assert.deepEqual(g.s.copies[worn].holder, { k: 'agent', id: 'a01' }, 'control: the hit took the piece a02 wore');
  assert.equal(first.newEvents.filter(e => e.type === 'bounty').length, 0, 'not the piece with the bounty on it');
  const second = g.night({ a03: breakin('a02') });
  assert.deepEqual(g.s.copies[kept].holder, { k: 'agent', id: 'a03' }, 'control: the break-in took the piece from its stash');
  const got = second.newEvents.find(e => e.type === 'bounty' && e.act === 'collected');
  assert.deepEqual([got.bounty, got.to, got.copy, got.amount], [b, 'a03', kept, 300]);
  assert.deepEqual(g.s.offers, []);
});

test('a bounty on an agent pays the Cop of a won collar on it, on top of the collar\'s pay (§10, §13)', () => {
  const g = withTrades(['cop', 'smuggler', 'smuggler']);
  g.s.agents.a02.heat = 3;
  // R4-4 (gap.collarPay): a collar pays its stars up to what its arrest seized, so a02 holds twice its stars' pay in
  // cash and its fine, half of it, covers them.
  g.grant('a02', 2 * 3 * N.copPay.star);
  g.grant('a03', 1000);
  const b = post(g, 'a03', { agent: 'a02', amount: 300 });
  const r = g.night({ a01: { kind: 'collar', target: 'a02', place: 'docks' }, a02: { kind: 'hustle', place: 'docks' } });
  assert.ok(g.s.agents.a02.jail, 'control: the collar won');
  const got = r.newEvents.find(e => e.type === 'bounty' && e.act === 'collected');
  assert.deepEqual([got.bounty, got.to, got.agent, got.amount], [b, 'a01', 'a02', 300]);
  assert.equal(g.s.agents.a01.cash, 3 * N.copPay.star + 300 - N.rent, "the collar's pay for 3 stars, which its fine covers, and the bounty, then rent");
});

test('a city arrest, a lost fight and a corner fight pay nobody (§10, §13)', () => {
  const g = new Game({ n: 4 });
  g.s.agents.a02.heat = 3;
  g.grant('a04', 1000);
  post(g, 'a04', { agent: 'a02', amount: 300 });
  post(g, 'a04', { agent: 'a03', amount: 200 });
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a03 is a filler the hit finds at the docks, so this night passes the docks filler.
  const r = g.night({ a02: hit('a03') }, DOCKS);
  assert.equal(fightEvent(r, 'hit', 'a03').won, false, "control: a wanted attacker's 1 against 1 and the city cops' 2");
  assert.equal(r.newEvents.find(e => e.type === 'arrest').agent, 'a02', 'control: the city cops arrested it');
  assert.equal(r.newEvents.filter(e => e.type === 'bounty').length, 0, 'nobody robbed a03, and nobody collared a02');
  assert.equal(g.s.offers.length, 2, 'both still held');

  const d = withTrades(['dealer', 'dealer', 'smuggler']);
  d.s.corners['strip-1'].holder = 'a01';
  armed(d, 'a02');
  d.grant('a03', 1000);
  post(d, 'a03', { agent: 'a01', amount: 300 });
  const c = d.night({ a01: { kind: 'deal', corner: 'strip-1' }, a02: { kind: 'deal', corner: 'strip-1' } });
  const corner = c.newEvents.find(e => e.type === 'fight' && e.kind === 'corner');
  assert.deepEqual([corner.target, corner.won], ['a01', true], "control: the challenger's 2 took a01's corner from its 1");
  assert.equal(c.newEvents.filter(e => e.type === 'bounty').length, 0, 'a corner fight takes nothing, so it robs nobody');
});

test("a bounty pays once, to the first fight in the night's order that earns it: a break-in before a hit (§10, GAP gap.bounty)", () => {
  const g = new Game({ n: 5 });
  armed(g, 'a01');
  armed(g, 'a02');
  g.grant('a01', 100);
  g.grant('a02', 100);
  g.grant('a04', 1000);
  g.grant('a05', 1000);
  g.grant('a03', 100);
  g.hand('a03', tierCopy(g.s, 'common'), { wear: true });
  const b1 = post(g, 'a04', { agent: 'a03', amount: 300 });
  const b2 = post(g, 'a05', { agent: 'a03', amount: 200 });
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a03 is a filler the hit finds at the docks, so this night passes the docks filler; the work event's wage is a03's hustle event's take.
  const r = g.night({ a01: hit('a03'), a02: breakin('a03') }, DOCKS);
  assert.deepEqual([fightEvent(r, 'hit', 'a03').won, fightEvent(r, 'breakin', 'a03').won], [true, true], 'control: both won');
  const got = r.newEvents.filter(e => e.type === 'bounty' && e.act === 'collected');
  assert.deepEqual(got.map(e => [e.bounty, e.to, e.amount]).sort(), [[b1, 'a02', 300], [b2, 'a02', 200]], "both to the break-in's leader");
  // a03 is out on a shift, so the hit takes its wage tonight (§7, GAP gap.holdup), and no bounty with it.
  const rob = r.newEvents.find(e => e.type === 'rob' && e.leader === 'a01');
  assert.equal(rob.cash, r.newEvents.find(e => e.type === 'hustle' && e.agent === 'a03').take, "the hold-up: a03's wage");
  assert.equal(g.s.agents.a01.cash, 100 + rob.cash - N.rent, 'and no bounty to the hit');
});

test('night 14: a bounty still pays at the takes, and every unpaid one is gone with the ferry, never back to its poster (§10, §15)', () => {
  const g = new Game({ n: 4 });
  g.advanceTo(14);
  armed(g, 'a04');
  g.grant('a01', 1000);
  const paid = post(g, 'a01', { agent: 'a02', amount: 300 });
  const back = post(g, 'a01', { agent: 'a03', amount: 200 });
  const cash = g.s.agents.a01.cash;
  const r = g.night({ a02: { kind: 'board', place: 'industrial' }, a04: hit('a02', 'industrial') });
  const ev = r.newEvents;
  assert.equal(fightEvent(r, 'hit', 'a02').won, true, 'control: robbed on the walk to the dock');
  assert.deepEqual(ev.filter(e => e.type === 'bounty' && e.act === 'collected').map(e => [e.bounty, e.to]), [[paid, 'a04']]);
  const returned = ev.filter(e => e.type === 'bounty' && e.act === 'gone');
  assert.deepEqual(returned.map(e => [e.bounty, e.by, e.agent, e.amount]), [[back, 'a01', 'a03', 200]]);
  assert.ok(returned[0].n < ev.find(e => e.type === 'board').n, 'before the boarding');
  assert.equal(ev.find(e => e.type === 'mint' && e.agent === 'a01').cash, cash, 'none of it boards with its poster');
  assert.deepEqual(g.s.offers, [], 'nothing is held after the ferry');
  // §19: the last night's private record is the poster's until day 15, then everyone's.
  const seen = v => bountyEvents(v, 'gone').some(e => e.bounty === back);
  const before = structuredClone(g.s);
  before.clock = DAY15 - 1;
  assert.ok(seen(viewFor(before, g.log, 'a01')), 'positive control: its poster sees it before day 15');
  for (const who of ['a02', 'a03']) assert.ok(!seen(viewFor(before, g.log, who)), `${who}: not before day 15`);
  for (const who of ['a02', 'a03']) assert.ok(seen(viewFor(g.s, g.log, who)), `${who}: on day 15`);
});

// --- what each audience sees (§19) ----------------------------------------------------------------------------------

test("a bounty's poster is private for 24 hours: its own posting now, everyone's 24 hours later; the board never names it (§19)", () => {
  const g = new Game({ n: 4 });
  g.grant('a03', 1000);
  post(g, 'a03', { agent: 'a01', amount: 321 });
  const posted = v => bountyEvents(v, 'post').some(e => e.by === 'a03' && e.agent === 'a01');
  assert.ok(posted(g.view('a03')) && posted(g.view('a03', 'ownerAI')), "positive control: the poster and its owner's AI");
  assert.ok(g.view(null, 'public').board.bounties.some(b => b.agent === 'a01' && b.amount === 321), 'positive control: the bounty itself is public, live');
  for (const v of [g.view('a01'), g.view('a02'), g.view('a02', 'ownerAI'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.equal(bountyEvents(v).length, 0, `${label(v)}: no posting yet`);
    assert.ok(!has(v.board.bounties, 'a03'), `${label(v)}: the board never names the poster`);
  }
  g.night();
  for (const v of [g.view('a01'), g.view('a02'), g.view(null, 'public'), g.view(null, 'record')]) assert.ok(posted(v), `${label(v)}: 24 hours later`);
});

test("a payout is the poster's and the collector's now, everyone's 24 hours later; the poster isn't told who collected, so a masked robber stays masked (§19)", () => {
  const g = new Game({ n: 5 });
  armed(g, 'a01');
  g.hand('a01', abilityCopy(g.s, 'skimask'), { wear: true });
  g.grant('a01', 100);
  g.grant('a04', 1000);
  post(g, 'a04', { agent: 'a02', amount: 400 });
  g.hand('a02', tierCopy(g.s, 'common'), { wear: true });
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a02 is a filler the hit finds at the docks, so this night passes the docks filler.
  g.night({ a01: hit('a02') }, DOCKS);
  assert.ok(g.view('a02').events.some(e => e.type === 'robbed' && e.by === null), 'control: the victim gets no name through the mask');
  const paid = bountyEvents(g.view('a04'), 'paid');
  assert.equal(paid.length, 1, 'positive control: the poster learns its bounty paid');
  assert.ok(!has(paid, 'a01') && !bountyEvents(g.view('a04'), 'collected').length, 'but not who collected it');
  assert.ok(!has(bountyEvents(g.view('a04', 'ownerAI'), 'paid'), 'a01'), "nor does its owner's AI");
  assert.equal(bountyEvents(g.view('a01'), 'collected').length, 1, 'positive control: the collector learns it collected');
  for (const v of [g.view('a02'), g.view('a03'), g.view('a03', 'ownerAI'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.equal(bountyEvents(v).filter(e => e.act !== 'post').length, 0, `${label(v)}: no payout yet`);
  }
  g.night();
  for (const v of [g.view('a02'), g.view('a04'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(bountyEvents(v, 'collected').some(e => e.to === 'a01'), `${label(v)}: who collected, 24 hours later`);
    assert.ok(bountyEvents(v, 'paid').some(e => e.by === 'a04'), `${label(v)}: whose bounty paid, 24 hours later`);
  }
});

// --- lookouts (§10, §19, §38) ---------------------------------------------------------------------------------------

test("a lookout shows another agent's stash and cash now, as its holdings record would, for N.lookout to a sink of its own (§10, §19, §38)", () => {
  const g = new Game({ n: 4 });
  const kept = g.hand('a01', tierCopy(g.s, 'rare'));
  const worn = g.hand('a01', tierCopy(g.s, 'common'), { wear: true });
  g.grant('a01', 300);
  g.errand('a01', 'crew_form', { name: 'c' });
  g.errand('a01', 'stash_put', { cash: 100 });
  g.grant('a03', 1000);
  const r = g.errand('a03', 'lookout', { agent: 'a01' });
  assert.equal(r.ok, true);
  const look = r.events.find(e => e.type === 'look');
  assert.deepEqual([look.by, look.agent, look.cash, look.home], ['a03', 'a01', 200, true]);
  assert.deepEqual(look.pieces.map(p => p.copy), [kept], 'its unworn pieces: what it wears is on the board already');
  assert.ok(!has(look.pieces, worn));
  assert.deepEqual([look.crew.id, look.crew.cash], [g.s.agents.a01.crew, 100], 'and the crew stash kept at its home');
  assert.equal(g.s.agents.a03.cash, 1000 - N.lookout);
  assert.equal(g.s.money.out.lookout, N.lookout, 'the cash leaves the island');
  for (const fields of [{ agent: 'a09' }, { agent: 'a03' }, {}]) assert.equal(g.errand('a03', 'lookout', fields).ok, false, JSON.stringify(fields));
  const poor = g.errand('a02', 'lookout', { agent: 'a01' });
  assert.deepEqual([poor.ok, poor.events[0].errand, poor.events[0].kind], [false, 'lookout', 'not-yet'], 'not enough cash, yet');
  g.night();
  assert.equal(g.events('holdings', e => e.agent === 'a01').length, 1, 'a look is its own record: still one holdings record per agent at dawn');
});

test("a lookout's look is the hirer's now and everyone's 24 hours later; its target isn't told (§19)", () => {
  const g = new Game({ n: 4 });
  g.grant('a01', 777555);
  g.grant('a03', 1000);
  assert.ok(has(g.view('a01'), '777555'), 'positive control: the owner sees its cash');
  for (const v of [g.view('a03'), g.view(null, 'public')]) assert.ok(!has(v, '777555'), `${label(v)}: not before the look`);
  assert.equal(g.errand('a03', 'lookout', { agent: 'a01' }).ok, true);
  assert.ok(has(g.view('a03'), '777555') && has(g.view('a03', 'ownerAI'), '777555'), "the hirer and its owner's AI see it now");
  for (const v of [g.view('a02'), g.view('a02', 'ownerAI'), g.view(null, 'public'), g.view(null, 'record')]) assert.ok(!has(v, '777555'), `${label(v)}: not live`);
  assert.ok(!g.view('a01').events.some(e => e.type === 'look') && !g.view('a01', 'ownerAI').events.some(e => e.type === 'look'), "the target isn't told");
  g.night();
  for (const v of [g.view('a01'), g.view('a02'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(v.events.some(e => e.type === 'look' && e.by === 'a03' && e.agent === 'a01' && e.cash === 777555), `${label(v)}: 24 hours later`);
  }
});

// --- the ledger and typed inputs (§18, §23) -------------------------------------------------------------------------

test("the ledger checks bounty holds: cash held for no bounty, a bounty with nothing held, a wrong amount or poster; the fence's check leaves them alone (§23)", () => {
  const g = new Game({ n: 3 });
  const copy = g.hand('a01', tierCopy(g.s, 'common'));
  g.grant('a02', 1000);
  const deal = g.errand('a01', 'fence_list', { copy, price: 40 }).events[0].deal;
  assert.equal(g.errand('a02', 'fence_buy', { deal }).ok, true);
  post(g, 'a02', { agent: 'a03', amount: 300 });
  assert.deepEqual(ledgerProblems(g.s), [], 'positive control: a fence hold and a bounty hold side by side');
  const plant = fn => {
    const s = structuredClone(g.s);
    fn(s);
    return ledgerProblems(s);
  };
  const caught = p => p.some(x => /^bount/.test(x)) && !p.some(x => /^fence/.test(x));
  assert.ok(caught(plant(s => { s.bounties = []; })), 'cash held for no bounty');
  assert.ok(caught(plant(s => { s.offers = s.offers.filter(o => !o.bounty); s.money.out.test = 300; })), 'a bounty with nothing held');
  assert.ok(caught(plant(s => { s.bounties[0].amount += 1; })), 'a bounty that says more than is held');
  assert.ok(caught(plant(s => { s.offers.find(o => o.bounty).by = 'a01'; })), 'cash held for someone else');
  assert.equal(JSON.stringify(ledgerProblems(g.s)), '[]', 'planting never touched the clean state');
});

test("a bounty's and a lookout's inputs are typed: nothing else an agent writes there reaches any view (§18, §23)", () => {
  const g = new Game({ n: 3 });
  g.grant('a01', 1000);
  g.errand('a01', 'bounty', { copy: 'CANARY-COPY', amount: 5 });
  g.errand('a01', 'bounty', { agent: 'CANARY-AGENT', amount: 5 });
  g.errand('a01', 'bounty', { agent: 'a02', amount: 'CANARY-AMOUNT' });
  g.errand('a01', 'bounty', { agent: 'a02', amount: 5, note: 'CANARY-BOUNTY-NOTE' });
  g.errand('a01', 'lookout', { agent: 'CANARY-LOOK' });
  g.errand('a01', 'lookout', { agent: 'a02', note: 'CANARY-LOOK-NOTE' });
  assert.equal(g.events('bounty').length, 1, 'positive control: the valid bounty went in');
  assert.equal(g.events('look').length, 1, 'positive control: the valid look went in');
  const canaries = ['CANARY-COPY', 'CANARY-AGENT', 'CANARY-AMOUNT', 'CANARY-BOUNTY-NOTE', 'CANARY-LOOK', 'CANARY-LOOK-NOTE'];
  for (const when of ['live', 'two days later']) {
    for (const v of everyView(g)) for (const c of canaries) assert.ok(!has(v, c), `${when}: ${c} in ${label(v)}`);
    g.night();
    g.night();
  }
});
