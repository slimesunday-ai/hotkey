// R9e (slime, 10-20: "Run numbers, then test"; docs/briefs/R9e-run-numbers.md): when tonight's menu has a run, the menu
// carries one short block of run numbers, after the play lines and before the fight numbers, rendered from a typed field
// of the seat's view (rules/view.mjs me.run): where the show saw Smugglers last night, the seat's share at each drop by
// the drop's own split (rules/market.mjs dropSplit, gathers), what those units fetch on public prices (board.street, the
// buyer's published curve from board.marketSteps), and last night's shift pay. Facts only (GAME.md §33); nothing hidden
// is read. Nothing here calls a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { runOf, dropSplit } from '../rules/market.mjs';
import { read } from '../agents/tools.mjs';
import { briefing, starterBriefing, runLines } from '../agents/briefing.mjs';

// r8b-lean.test.mjs's ADVICE pattern: words that advise, nudge or rank (§33), and the word slime struck.
const ADVICE = /\b(should|best|recommend\w*|strateg\w*|aggressive\w*|safest|smart\w*|wise\w*|mission\w*)\b/i;
const HEAD = 'Run numbers (';
const ARMS = [['current', 'json'], ['current', 'tools'], ['starter', 'json'], ['starter', 'tools']];

// Runs fn with N's keys set, then puts the old values back.
function withN(values, fn) {
  const was = Object.fromEntries(Object.keys(values).map(k => [k, N[k]]));
  Object.assign(N, values);
  try {
    return fn();
  } finally {
    Object.assign(N, was);
  }
}
// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
function ok(g, id, kind, fields) {
  const r = g.errand(id, kind, fields);
  assert.equal(r.ok, true, `${id}'s ${kind} went through (${r.why})`);
  return r;
}
// `buyer` buys `goods` for `cash` from `seller` in a new sit-down, both sides handed over in full (a settled deal).
function trade(g, seller, buyer, goods, cash) {
  for (const [k, n] of Object.entries(goods)) stock(g, seller, k, n);
  if (g.s.agents[buyer].cash < cash) g.grant(buyer, cash);
  ok(g, buyer, 'ask', { to: seller });
  const sd = g.events('ask').at(-1).sitdown;
  ok(g, seller, 'answer', { sitdown: sd, accept: true });
  ok(g, buyer, 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods, cash } });
  ok(g, seller, 'give', { to: buyer, goods });
  ok(g, buyer, 'pay', { to: seller, amount: cash });
}
// Rent for the whole season, so nobody is evicted.
const housed = g => Object.keys(g.s.agents).forEach(id => g.grant(id, 2 * N.nights * N.rent));
const fieldOf = (g, id = 'a01') => g.view(id).me.run;
const dropOf = (g, place, id = 'a01') => fieldOf(g, id).drops.find(d => d.place === place);
const readOf = (g, id) => read(g.view(id), { audience: 'seat', seed: 'r9t', from: 1 });
// The user message of a seat's briefing, as the seat reads it.
const userText = (g, id = 'a01', { call = 'round', reply = 'json', version = 'current' } = {}) =>
  (version === 'starter' ? starterBriefing : briefing)(readOf(g, id), { call, reply })[1].content;
// The block's lines in a briefing's user message, or null.
const blockOf = text => {
  const lines = text.split('\n');
  const at = lines.findIndex(l => l.startsWith(HEAD));
  if (at < 0) return null;
  let end = at + 1;
  while (end < lines.length && lines[end].startsWith('- ')) end += 1;
  return lines.slice(at, end);
};
const lineOf = (g, start, id = 'a01') => blockOf(userText(g, id)).find(l => l.startsWith(start));
// What the night gathered for `id` at its run, from its own gather event.
const gathered = (r, id) => {
  const e = r.newEvents.find(x => x.type === 'gather' && x.agent === id);
  return Object.values(e.goods).reduce((t, n) => t + n, 0);
};

test('the block shows only when the menu has a run, in both reply arms and both briefing versions, after the play lines and before the fight numbers; the menu is never cut', () => {
  const g = new Game({ n: 5 });
  housed(g);
  g.night();
  // a02 is a Chemist (no run); a03 crashes tonight (the default play only); a04 is in jail (no menu).
  g.s.agents.a02.trade = 'chemist';
  g.s.agents.a03.crash = true;
  g.s.agents.a04.jail = { nights: 2, stars: 1 };
  for (const [version, reply] of ARMS) {
    const what = `${version}, ${reply}`;
    const menu = readOf(g, 'a01').result.menu;
    assert.ok(menu.some(m => m.kind === 'run'), 'control: a01 may run');
    const text = userText(g, 'a01', { version, reply });
    const block = blockOf(text);
    assert.ok(block, `${what}: a01's menu has the block`);
    assert.deepEqual(block, runLines(readOf(g, 'a01').result.view), `${what}: the whole block`);
    assert.ok(text.indexOf(HEAD) > text.indexOf(`${menu.at(-1).n}. ${menu.at(-1).kind}`), `${what}: after the play lines`);
    assert.ok(text.indexOf(HEAD) < text.indexOf('Fight numbers ('), `${what}: before the fight numbers`);
    for (const id of ['a02', 'a03', 'a04']) {
      assert.ok(!readOf(g, id).result.menu.some(m => m.kind === 'run'), `control: no run on ${id}'s menu`);
      assert.equal(blockOf(userText(g, id, { version, reply })), null, `${what}: no block for ${id}`);
    }
    assert.equal(blockOf(userText(g, 'a01', { version, reply, call: 'lock' }))?.[0], block[0], `${what}: at the lock call too`);
  }
  assert.equal(fieldOf(g, 'a02'), null, 'no run on the menu: the field is null');
  // A briefing over budget cuts the story, never the block.
  withN({ 'gap.briefing': { ...N['gap.briefing'], chars: 9000 } }, () => {
    const text = userText(g, 'a01', { reply: 'tools', version: 'starter' });
    assert.match(text, /Budget reductions attempted/, 'control: the story is cut');
    assert.deepEqual(blockOf(text), runLines(readOf(g, 'a01').result.view), 'the whole block');
  });
  // The last night has no run on anyone's menu.
  g.s.agents.a03.crash = false;
  g.advanceTo(N.nights);
  assert.ok(!readOf(g, 'a01').result.menu.some(m => m.kind === 'run'), 'control: no run on the last night');
  assert.equal(blockOf(userText(g, 'a01')), null, 'no block on the last night');
});

test('before any night is played the block says the show has seen nobody yet, and carries no shift line', () => {
  const g = new Game({ n: 3 });
  const r = fieldOf(g);
  assert.equal(r.seenNight, null);
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): last night's shift pay (me.run.shifts) is gone; last night's hustles are the view's me.hustle.last, null before any night.
  assert.equal(g.view('a01').me.hustle.last, null);
  assert.ok(r.drops.every(d => d.seen.length === 0 && d.alone === N.dropUnits && d.with === N.dropUnits));
  const block = blockOf(userText(g));
  assert.equal(block[0], "Run numbers (no night played yet, so the show has seen nobody; who runs tonight isn't public):");
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): last night's line moved from this block to the hustle numbers ("- Last night: ..."), so the check reads every line of the briefing.
  assert.ok(!userText(g).split('\n').some(l => l.startsWith('- Last night')), 'no shift line');
});

test("the share with 0, 1, 2 and 4 Smugglers seen at a drop is what the night gathers for the seat when exactly they and it run there, night after night (the leftovers go round)", () => {
  const shares = {};
  for (const k of [0, 1, 2, 4]) {
    const g = new Game({ n: 6 });
    housed(g);
    const others = ['a02', 'a03', 'a04', 'a05'].slice(0, k);
    const runs = Object.fromEntries(others.map(id => [id, { kind: 'run', place: 'forest' }]));
    // Night 1: the others run the forest; a01 and everyone else lays low.
    g.night(runs, { filler: { kind: 'laylow' } });
    for (let i = 0; i < 5; i++) {
      const d = dropOf(g, 'forest');
      assert.deepEqual(d.seen, others, `k ${k}, night ${g.s.day}: seen`);
      assert.equal(d.alone, N.dropUnits, `k ${k}: alone`);
      assert.equal(d.with, dropSplit([...others, 'a01'], g.s.day).a01, `k ${k}: control: the split for tonight`);
      const want = k ? `; with ${others.join(', ')}: ${d.with}.` : '.';
      assert.equal(lineOf(g, '- forest '), `- forest (chems): ${k ? `${others.join(', ')} seen` : 'no Smuggler seen'}. Alone: ${N.dropUnits}${want}`);
      const r = g.night({ ...runs, a01: { kind: 'run', place: 'forest' } }, { filler: { kind: 'laylow' } });
      assert.equal(gathered(r, 'a01'), d.with, `k ${k}, night ${g.s.day - 1}: the night gathered ${gathered(r, 'a01')}, the view showed ${d.with}`);
      (shares[k] ||= new Set()).add(d.with);
    }
  }
  assert.deepEqual([...shares[0]], [6]);
  assert.deepEqual([...shares[1]], [3]);
  assert.deepEqual([...shares[2]], [2]);
  assert.deepEqual([...shares[4]].sort(), [1, 2], 'five at a drop: 2, 1, 1, 1, 1, the 2 moving round');
});

test('work boots worn add N.workboots to every share shown, as the night counts them; held and not worn, they add nothing', () => {
  const g = new Game({ n: 4 });
  housed(g);
  g.night({ a02: { kind: 'run', place: 'mall' } }, { filler: { kind: 'laylow' } });
  const boots = abilityCopy(g.s, 'workboots');
  g.hand('a01', boots);
  assert.equal(fieldOf(g).workboots, false, 'held, not worn');
  assert.deepEqual([dropOf(g, 'mall').alone, dropOf(g, 'mall').with], [6, 3]);
  assert.match(blockOf(userText(g))[1], /You wear no work boots\.$/);
  g.s.agents.a01.outfit[g.s.copies[boots].slot] = boots;
  const r = fieldOf(g);
  assert.equal(r.workboots, true);
  assert.deepEqual([dropOf(g, 'mall').alone, dropOf(g, 'mall').with], [6 + N.workboots, 3 + N.workboots]);
  assert.match(blockOf(userText(g))[1], new RegExp(`You wear work boots: \\+${N.workboots} to each share below\\.$`));
  const night = g.night({ a01: { kind: 'run', place: 'mall' }, a02: { kind: 'run', place: 'mall' } }, { filler: { kind: 'laylow' } });
  assert.equal(gathered(night, 'a01'), 3 + N.workboots, 'the night counts the boots');
  // Alone at a drop nobody was seen at, the night gathers the alone number.
  const alone = dropOf(g, 'junkyard').alone;
  const r2 = g.night({ a01: { kind: 'run', place: 'junkyard' } }, { filler: { kind: 'laylow' } });
  assert.equal(gathered(r2, 'a01'), alone);
});

test('not counted: a Smuggler seen at another place, an agent of another trade seen at the drop, the seat itself; a Smuggler in jail now is named but has no play tonight', () => {
  const g = new Game({ n: 6 });
  housed(g);
  g.s.agents.a04.trade = 'chemist';
  g.night({
    a01: { kind: 'run', place: 'forest' }, a02: { kind: 'run', place: 'forest' }, a03: { kind: 'run', place: 'mall' },
    a04: { kind: 'hustle', place: 'docks' }, a05: { kind: 'run', place: 'docks' },
  }, { filler: { kind: 'laylow' } });
  const v = g.view('a01');
  assert.ok(v.sightings.a04.some(x => x.place === 'docks' && x.night === g.s.day - 1), 'control: the Chemist was seen at the docks');
  assert.ok(v.sightings.a01.some(x => x.place === 'forest' && x.night === g.s.day - 1), 'control: the seat was seen at the forest');
  assert.deepEqual(Object.fromEntries(fieldOf(g).drops.map(d => [d.place, d.seen])), { docks: ['a05'], forest: ['a02'], junkyard: [], mall: ['a03'] });
  // a05, jailed now, is still where the show saw it, but no play tonight: the share with the others leaves it out.
  g.s.agents.a05.jail = { nights: 1, stars: 1 };
  const docks = dropOf(g, 'docks');
  assert.deepEqual([docks.seen, docks.jailed, docks.with], [['a05'], ['a05'], 6]);
  assert.equal(lineOf(g, '- docks '), '- docks (parts): a05 (in jail now, no play tonight) seen. Alone: 6.');
});

test('prices: the street price as one price and as a range, or none; the buyer total is runOf on its published curve from the step now', () => {
  const g = new Game({ n: 8 });
  housed(g);
  g.night({ a02: { kind: 'run', place: 'forest' } }, { filler: { kind: 'laylow' } });
  // No deals yet: no street price for either kind.
  for (const kind of ['chems', 'parts']) {
    const p = fieldOf(g).prices.find(x => x.kind === kind);
    assert.equal(p.street, null);
    assert.ok(p.totals.every(t => t.street === null));
  }
  const parts = lineOf(g, '- Parts: ');
  assert.equal(parts, `- Parts: no street price in the last 3 days. The city's buyer, on its published curve now: 6 = $${runOf('buyer', 'parts', g.s.market.buyer.parts, 6)}; other sellers the same day can lower it.`);
  // One chems deal at $15 a chem, settled today: it shows from tomorrow.
  trade(g, 'a05', 'a06', { chems: 3 }, 45);
  g.night({}, { filler: { kind: 'laylow' } });
  let p = fieldOf(g).prices.find(x => x.kind === 'chems');
  assert.deepEqual(p.street, { low: 15, high: 15, deals: 1, units: 3 });
  assert.deepEqual(p.totals.map(t => [t.units, t.street]), [[6, { low: 90, high: 90 }]], 'nobody seen at a chems drop last night: 6 only');
  for (const t of p.totals) assert.equal(t.buyer, runOf('buyer', 'chems', g.s.market.buyer.chems, t.units));
  assert.equal(p.buyerStep, g.s.market.buyer.chems);
  // A second deal at $50 for 3 ($16.67, so $17): a range. a02 runs the forest again, so 3 shows beside 6.
  trade(g, 'a07', 'a08', { chems: 3 }, 50);
  g.night({ a02: { kind: 'run', place: 'forest' } }, { filler: { kind: 'laylow' } });
  p = fieldOf(g).prices.find(x => x.kind === 'chems');
  assert.deepEqual(p.street, { low: 15, high: 17, deals: 2, units: 6 });
  assert.deepEqual(p.totals.map(t => [t.units, t.street]), [[6, { low: 90, high: 102 }], [3, { low: 45, high: 51 }]]);
  const b6 = runOf('buyer', 'chems', g.s.market.buyer.chems, 6);
  const b3 = runOf('buyer', 'chems', g.s.market.buyer.chems, 3);
  assert.deepEqual(p.totals.map(t => t.buyer), [b6, b3]);
  assert.equal(lineOf(g, '- Chems: '), `- Chems: street $15–$17 a chem (2 deals, last 3 days): 6 = $90–$102, 3 = $45–$51. The city's buyer, on its published curve now: 6 = $${b6}, 3 = $${b3}; other sellers the same day can lower it.`);
  // The view's step is the state's, as board.market's price is.
  assert.deepEqual(g.view('a01').board.marketSteps.buyer, g.s.market.buyer);
});

test("a sale to the city's buyer moves the totals: an order placed today fills at the lock, as the board's price does; once it clears, the totals are runOf from the new step, lower than without it", () => {
  const twin = sell => {
    const g = new Game({ n: 4 });
    housed(g);
    g.night({}, { filler: { kind: 'laylow' } });
    const before = JSON.stringify(fieldOf(g).prices);
    const price = g.view('a01').board.market.buyer.chems;
    if (sell) {
      stock(g, 'a03', 'chems', 8);
      ok(g, 'a03', 'sell', { item: 'chems', units: 8 });
      assert.equal(JSON.stringify(fieldOf(g).prices), before, 'the order waits for the lock: the published curve has not moved');
      assert.equal(g.view('a01').board.market.buyer.chems, price, "control: nor has the board's price");
    }
    g.night({}, { filler: { kind: 'laylow' } });
    const p = fieldOf(g).prices.find(x => x.kind === 'chems');
    assert.equal(p.buyerStep, g.s.market.buyer.chems);
    for (const t of p.totals) assert.equal(t.buyer, runOf('buyer', 'chems', g.s.market.buyer.chems, t.units));
    return p.totals[0].buyer;
  };
  const without = twin(false);
  const withSale = twin(true);
  assert.ok(withSale < without, `the sale lowered it: ${withSale} against ${without}`);
});

// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): last night's
// pay left the run numbers (me.run.shifts, "- Last night, 3 agents worked shifts for $X each.") for the hustle numbers
// (me.hustle.last, "- Last night: docks 1 at $58; ..."), by district, as a hustle's take is its district's. The claim is
// the same there: what each paid and how many, from the hustle events the public line reads; a night nobody hustled.
test("last night's shifts: the wage each paid and how many worked, from the work event the public line reads; a night when nobody worked one", () => {
  const g = new Game({ n: 5 });
  housed(g);
  g.night({ a02: { kind: 'hustle', place: 'docks' }, a03: { kind: 'hustle', place: 'downtown' }, a04: { kind: 'hustle', place: 'industrial' } }, { filler: { kind: 'laylow' } });
  const hs = g.events('hustle');
  assert.deepEqual(hs.map(e => e.agent).sort(), ['a02', 'a03', 'a04'], 'control');
  const last = g.view('a01').me.hustle.last;
  assert.equal(last.night, hs[0].night);
  assert.deepEqual(last.places.map(p => [p.place, p.agents, p.take]).sort(), hs.map(e => [e.place, [e.agent], e.take]).sort(), 'each district: who hustled there and its take, from the hustle events');
  const text = userText(g);
  assert.ok(text.split('\n').includes(`- Last night: ${last.places.map(p => `${p.place} ${p.agents.length} at $${p.take}`).join('; ')}.`), 'the hustle numbers say so');
  for (const e of hs) assert.match(text, new RegExp(`${e.place} \\(${e.how}, ${e.level}\\) ${e.agent} took \\$${e.take}`), 'the public line reads the same events');
  g.night({}, { filler: { kind: 'laylow' } });
  assert.deepEqual(g.view('a01').me.hustle.last, { night: g.s.day - 1, places: [] });
  assert.ok(userText(g).split('\n').includes('- Last night: nobody hustled.'));
});

test("no hidden state: another agent's play locked for tonight (a run at a drop), its orders and its goods leave the field as it was", () => {
  const g = new Game({ n: 4 });
  housed(g);
  g.night({ a02: { kind: 'run', place: 'forest' } }, { filler: { kind: 'laylow' } });
  const before = JSON.stringify(fieldOf(g));
  g.s.agents.a03.locked = { kind: 'run', place: 'forest' };
  g.s.agents.a04.locked = { kind: 'run', place: 'junkyard' };
  stock(g, 'a03', 'chems', 4);
  stock(g, 'a04', 'parts', 4);
  g.s.orders.push({ id: 'o999', by: 'a04', side: 'buyer', item: 'parts', kind: 'parts', units: 4, cash: 0, day: g.s.day });
  assert.equal(JSON.stringify(fieldOf(g)), before);
});

test("no line of the block matches r8b-lean's ADVICE pattern, in any arm, at any call, with every clause on", () => {
  const g = new Game({ n: 8 });
  housed(g);
  trade(g, 'a06', 'a07', { chems: 3 }, 45);
  trade(g, 'a07', 'a08', { chems: 3 }, 50);
  g.night({ a02: { kind: 'run', place: 'forest' }, a03: { kind: 'run', place: 'forest' }, a04: { kind: 'run', place: 'mall' }, a05: { kind: 'hustle', place: 'docks' } }, { filler: { kind: 'laylow' } });
  g.s.agents.a04.jail = { nights: 1, stars: 1 };
  let seen = 0;
  for (const wear of [false, true]) {
    if (wear) g.hand('a01', abilityCopy(g.s, 'workboots'), { wear: true });
    for (const call of ['round', 'lock', null]) for (const [version, reply] of ARMS) {
      const block = blockOf(userText(g, 'a01', { call, reply, version }));
      for (const line of block) assert.doesNotMatch(line, ADVICE);
      seen += 1;
    }
  }
  assert.equal(seen, 2 * 3 * 4);
});

test("the field is typed: the owner AI audience (typedOnly) keeps it as the seat's own view has it", () => {
  const g = new Game({ n: 3 });
  housed(g);
  g.night({ a02: { kind: 'run', place: 'forest' } });
  assert.deepEqual(g.view('a01', 'ownerAI').me.run, fieldOf(g));
});
