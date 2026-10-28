// 2026-10-27: re-pin bot reason prose for slime's call, "the first 2 we should do" (rent is now compute); plays and rules unchanged.
// R9c (slime, 10-19: "Show hit strength numbers"; docs/briefs/R9c-fight-numbers.md): when tonight's menu has a hit or a
// break-in, the menu carries one short block of fight numbers, rendered from a typed field of the seat's view
// (rules/view.mjs me.fight), counted by the fights' own per-person count (rules/fights.mjs personStrength). Facts only
// (GAME.md §33): the seat's own state as its view shows it, public facts, and exact rules; nothing hidden is read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Game, ITEMS, abilityCopy } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { newSeason } from '../rules/setup.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { settleNight } from '../rules/night.mjs';
import { viewFor } from '../rules/view.mjs';
import { resolveFights, personStrength } from '../rules/fights.mjs';
import { DISTRICTS, levelTonight } from '../rules/state.mjs';
import { read } from '../agents/tools.mjs';
import { briefing, starterBriefing, fightLines } from '../agents/briefing.mjs';
import { rng, shuffle } from '../rng.mjs';
import { makeCast, makeBot, CASTS } from '../bench/bots.mjs';
import { MIDSEASON_ROTATION } from '../bench/runner.mjs';

// r8b-lean.test.mjs's ADVICE pattern: words that advise, nudge or rank (§33), and the word slime struck.
const ADVICE = /\b(should|best|recommend\w*|strateg\w*|aggressive\w*|safest|smart\w*|wise\w*|mission\w*)\b/i;
const HEAD = 'Fight numbers (';

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
  const a = g.s.agents[id];
  a.goods[kind] = (a.goods[kind] || 0) + n;
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
// Rent for the whole season, so nobody is evicted.
const housed = g => Object.keys(g.s.agents).forEach(id => g.grant(id, 2 * N.nights * N.rent));
const fieldOf = (g, id) => g.view(id).me.fight;
// The user message of a seat's briefing, as the seat reads it (read: the handled view and its menu).
const userText = (g, id, { call = 'round', reply = 'json', version = 'current' } = {}) => {
  const rd = read(g.view(id), { audience: 'seat', seed: 'r9s', from: 1 });
  const m = (version === 'starter' ? starterBriefing : briefing)(rd, { call, reply });
  return m[1].content;
};
// The block's lines in a briefing's user message, or null.
const blockOf = text => {
  const lines = text.split('\n');
  const at = lines.findIndex(l => l.startsWith(HEAD));
  if (at < 0) return null;
  let end = at + 1;
  while (end < lines.length && lines[end].startsWith('- ')) end += 1;
  return lines.slice(at, end);
};
const ARMS = [['current', 'json'], ['current', 'tools'], ['starter', 'json'], ['starter', 'tools']];

test('the block shows only when the menu has a hit or a break-in, in both reply arms and both briefing versions, after the play lines; the menu is never cut', () => {
  const g = new Game({ n: 4 });
  housed(g);
  g.night();
  g.night();
  // a03 crashes tonight (a day on TEMP), so its menu is the default play only; a04 is in jail, with no menu.
  g.s.agents.a03.crash = true;
  g.s.agents.a04.jail = { nights: 2, stars: 1 };
  for (const [version, reply] of ARMS) {
    const what = `${version}, ${reply}`;
    const rd = read(g.view('a01'), { audience: 'seat', seed: 'r9s', from: 1 });
    assert.ok(rd.result.menu.some(m => m.kind === 'hit') && rd.result.menu.some(m => m.kind === 'breakin'), 'control: a01 may hit and break in');
    const text = userText(g, 'a01', { version, reply });
    const block = blockOf(text);
    assert.ok(block, `${what}: a01's menu has the block`);
    assert.ok(text.indexOf(HEAD) > text.indexOf(`${rd.result.menu.at(-1).n}. ${rd.result.menu.at(-1).kind}`), `${what}: after the play lines`);
    assert.ok(text.indexOf(HEAD) < text.indexOf('Errand preconditions'), `${what}: before the errands`);
    assert.ok(block.some(l => l.startsWith('- A home: ')), `${what}: a break-in on the menu brings the home line`);
    for (const id of ['a03', 'a04']) {
      const menu = read(g.view(id), { audience: 'seat', seed: 'r9s', from: 1 }).result.menu;
      assert.ok(!menu.some(m => ['hit', 'breakin'].includes(m.kind)), `control: no hit or break-in on ${id}'s menu`);
      assert.equal(blockOf(userText(g, id, { version, reply })), null, `${what}: no block for ${id}`);
    }
  }
  // A briefing over budget cuts the story, never the block (the menu is never cut).
  withN({ 'gap.briefing': { ...N['gap.briefing'], chars: 9000 } }, () => {
    const text = userText(g, 'a01', { reply: 'tools', version: 'starter' });
    assert.match(text, /Budget reductions attempted/, 'control: the story is cut');
    assert.deepEqual(blockOf(text), fightLines(read(g.view('a01'), { audience: 'seat', seed: 'r9s', from: 1 }).result.view, 'round', true), 'the whole block');
  });
});

test('on the last night the menu has a hit and no break-in: the block shows, without the home line, a lockpick, a lone worker or a crash night', () => {
  const g = new Game({ n: 3 });
  housed(g);
  g.advanceTo(N.nights);
  stock(g, 'a01', 'lockpicks', 1);
  stock(g, 'a01', 'temp', 1);
  const menu = read(g.view('a01'), { audience: 'seat', seed: 'r9s', from: 1 }).result.menu;
  assert.ok(menu.some(m => m.kind === 'hit') && !menu.some(m => m.kind === 'breakin'), 'control: a hit, no break-in');
  assert.deepEqual([...new Set(g.view('a01').legal.map(p => p.kind))].sort(), ['back', 'board', 'hit'], 'control: nobody can be out working');
  const block = blockOf(userText(g, 'a01'));
  assert.ok(block, 'the block shows');
  assert.ok(!block.some(l => l.startsWith('- A home')), 'no home line');
  assert.ok(!block.join('\n').includes('lockpick'), 'no lockpick clause');
  assert.equal(block[1], '- You: attacking 1, defending 1. You hold TEMP x1: a dose taken today is +1 tonight.', 'no next night to crash on');
  assert.equal(block[4], '- The attack must beat the defence. A tie holds.', 'no lone worker on the last night');
});

test("your own numbers, one part at a time: a gun held, TEMP taken today, knuckles worn; and what you hold that changes tonight's count: TEMP doses, a lockpick, knuckles not worn", () => {
  const cases = [
    ['nothing', () => {}, { attacking: 1, defending: 1 }, '- You: attacking 1, defending 1.'],
    ['a gun', g => stock(g, 'a01', 'guns', 1), { attacking: 2, defending: 2, gun: true }, '- You: attacking 2 (1, gun +1), defending 2 (1, gun +1).'],
    ['TEMP taken today', g => {
      stock(g, 'a01', 'temp', 1);
      g.errand('a01', 'take', { drug: 'temp' });
    }, { attacking: 2, defending: 2, onTemp: true }, '- You: attacking 2 (1, TEMP +1), defending 2 (1, TEMP +1).'],
    ['knuckles worn', g => g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true }), { attacking: 2, defending: 1, knuckles: true }, '- You: attacking 2 (1, knuckles +1), defending 1.'],
    ['all three', g => {
      stock(g, 'a01', 'guns', 2);
      stock(g, 'a01', 'temp', 1);
      g.errand('a01', 'take', { drug: 'temp' });
      g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
    }, { attacking: 4, defending: 3, gun: true, onTemp: true, knuckles: true }, '- You: attacking 4 (1, gun +1, TEMP +1, knuckles +1), defending 3 (1, gun +1, TEMP +1).'],
  ];
  for (const [what, set, want, line] of cases) {
    const g = new Game({ n: 3 });
    housed(g);
    g.night();
    set(g);
    const y = fieldOf(g, 'a01').you;
    assert.deepEqual({ attacking: y.attacking, defending: y.defending, gun: y.gun, onTemp: y.onTemp, knuckles: y.knuckles },
      { gun: false, onTemp: false, knuckles: false, ...want }, `${what}: the field`);
    assert.equal(blockOf(userText(g, 'a01'))[1], line, `${what}: the line`);
  }
  // What it holds. TEMP doses: a dose taken today is +1 tonight; none once one is taken (one dose of each drug a day).
  const g = new Game({ n: 3 });
  housed(g);
  g.night();
  stock(g, 'a01', 'temp', 2);
  stock(g, 'a01', 'lockpicks', 1);
  g.hand('a01', abilityCopy(g.s, 'knuckles'));
  assert.deepEqual(fieldOf(g, 'a01').you.held, { tempDoses: 2, lockpicks: 1, knuckles: 1 });
  const round = blockOf(userText(g, 'a01'))[1];
  assert.equal(round, '- You: attacking 1, defending 1. You hold TEMP x2: a dose taken today is +1 tonight, then a crash night. You hold 1 lockpick: +1 to a break-in, used up. You hold knuckles, not worn: +1 attacking if worn at the lock.');
  // At the lock errands are refused, so only the lockpick, which a break-in uses as played, can still count tonight.
  assert.equal(blockOf(userText(g, 'a01', { call: 'lock' }))[1], '- You: attacking 1, defending 1. You hold 1 lockpick: +1 to a break-in, used up.');
  g.errand('a01', 'take', { drug: 'temp' });
  assert.deepEqual(fieldOf(g, 'a01').you.held, { tempDoses: 0, lockpicks: 1, knuckles: 1 }, 'TEMP taken: a second dose today adds nothing');
  const knuckles = g.view('a01').me.pieces.find(p => p.ability === 'knuckles').copy;
  g.errand('a01', 'dress', { fit: { [g.s.copies[knuckles].slot]: knuckles } });
  assert.deepEqual(fieldOf(g, 'a01').you, { attacking: 3, defending: 2, gun: false, onTemp: true, knuckles: true, wanted: false, held: { tempDoses: 0, lockpicks: 1, knuckles: 0 }, ordered: { guns: 0, lockpicks: 0 } }, 'worn now: counted, not held');
});

// One night with a01 hitting a02, out on a shift at the docks; a03 lays low. The fight a01 led, from the night's events.
function hitAt(g) {
  const r = g.night({ a01: { kind: 'hit', target: 'a02', place: 'docks' }, a02: { kind: 'hustle', place: 'docks' } }, { filler: { kind: 'laylow' } });
  return r.newEvents.find(e => e.type === 'fight' && e.kind === 'hit' && e.target === 'a02');
}

test('at the lock call, the attacking strength shown is what resolveFights counts for the seat as a lone attacker, in every mix of gun, TEMP and knuckles', () => {
  for (let mask = 0; mask < 8; mask++) {
    const g = new Game({ n: 3 });
    housed(g);
    g.night();
    if (mask & 1) stock(g, 'a01', 'guns', 1);
    if (mask & 2) {
      stock(g, 'a01', 'temp', 1);
      g.errand('a01', 'take', { drug: 'temp' });
    }
    if (mask & 4) g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
    const shown = fieldOf(g, 'a01').you.attacking;
    const line = blockOf(userText(g, 'a01', { call: 'lock' }))[1];
    assert.ok(line.startsWith(`- You: attacking ${shown}`), `mask ${mask}: the line shows ${shown}`);
    const f = hitAt(g);
    assert.equal(f.sides.length, 1, `mask ${mask}: control: one attack`);
    assert.equal(f.sides[0].size, 1, `mask ${mask}: control: a lone attacker`);
    assert.equal(f.sides[0].strength, shown, `mask ${mask}: the night counted ${f.sides[0].strength}, the view showed ${shown}`);
  }
  // The same through resolveFights itself, from the agent record the night builds at the lock.
  const agents = { a01: { home: true, gun: true, temp: true, knuckles: true }, a02: { home: true } };
  const R = resolveFights({ agents, plays: { a01: { kind: 'hit', target: 'a02', place: 'docks' }, a02: { kind: 'hustle', place: 'docks' } }, levels: Object.fromEntries(DISTRICTS.map(d => [d, 'lawless'])), rule: 'A' });
  assert.equal(R.fights[0].attackers[0].strength, personStrength(agents.a01, true));
  assert.equal(R.fights[0].defence, personStrength(agents.a02, false));
});

test("a gun on an open shop order fills at the lock, before the fights: the clause shows at the day and lock calls, and the night counts the gun if the order brings it, none if it comes back", () => {
  for (const short of [false, true]) {
    const g = new Game({ n: 3 });
    housed(g);
    g.night();
    const price = g.view('a01').board.market.shop.guns;
    // A rival order with a higher max takes the one unit at today's price, so a01's comes back (short).
    if (short) assert.ok(g.errand('a03', 'shop', { item: 'guns', units: 1, max: price + 100 }).ok, 'control: the rival order');
    assert.ok(g.errand('a01', 'shop', { item: 'guns', units: 1, max: short ? price : price + 50 }).ok, 'control: the order');
    assert.deepEqual(fieldOf(g, 'a01').you.ordered, { guns: 1, lockpicks: 0 });
    const clause = '- You: attacking 1, defending 1. Your shop order for a gun fills at the lock: gun +1 if it brings one.';
    assert.equal(blockOf(userText(g, 'a01'))[1], clause, `${short ? 'short' : 'filled'}: day call`);
    assert.equal(blockOf(userText(g, 'a01', { call: 'lock' }))[1], clause, `${short ? 'short' : 'filled'}: lock call`);
    const f = hitAt(g);
    assert.equal(f.sides[0].strength, short ? 1 : 2, short ? 'it came back: no gun' : 'it came: gun +1');
    assert.equal(g.s.agents.a01.goods.guns || 0, short ? 0 : 1, 'control: the order');
  }
  // A seat that holds a gun already shows no clause: another adds nothing.
  const g = new Game({ n: 3 });
  housed(g);
  g.night();
  stock(g, 'a01', 'guns', 1);
  g.errand('a01', 'shop', { item: 'guns', units: 1, max: g.view('a01').board.market.shop.guns + 50 });
  assert.equal(blockOf(userText(g, 'a01'))[1], '- You: attacking 2 (1, gun +1), defending 2 (1, gun +1).');
});

test("against the night itself: a wanted seat's hit in a heavy district meets the target's number, the heavy +1 and the wanted +2; a lone break-in meets the home line", () => {
  const g = new Game({ n: 3 });
  housed(g);
  g.night();
  g.s.agents.a01.heat = N.wantedAt;
  const heavy = fieldOf(g, 'a01').cops.heavy[0];
  assert.ok(heavy, 'control: a heavy district tonight');
  const block = blockOf(userText(g, 'a01', { call: 'lock' }));
  const target = 1;
  assert.ok(block[2].endsWith('everyone 1.'), 'control: a02 is 1 on public facts');
  const heavyAdds = Number(new RegExp(`\\+(\\d+) in heavy [^;]*\\b${heavy}\\b`).exec(block[3])[1]);
  const wantedAdds = Number(/You are wanted: \+(\d+)/.exec(block[3])[1]);
  const r = g.night({ a01: { kind: 'hit', target: 'a02', place: heavy }, a02: { kind: 'hustle', place: heavy } }, { filler: { kind: 'laylow' } });
  const f = r.newEvents.find(e => e.type === 'fight' && e.target === 'a02');
  assert.equal(f.cops, heavyAdds + wantedAdds, 'the city cops, as the block numbers them');
  assert.equal(f.defence, target + heavyAdds + wantedAdds, 'the defence');
  // Break-ins on a02's home: laying low (everyone home is a02), and out on a shift (nobody home).
  for (const [play, home] of [[{ kind: 'laylow' }, 1], [{ kind: 'hustle', place: 'docks' }, 0]]) {
    const h = new Game({ n: 3 });
    housed(h);
    h.night();
    const v = h.view('a01');
    const line = blockOf(userText(h, 'a01', { call: 'lock' })).find(l => l.startsWith('- A home: '));
    const [lock, laylow] = /^- A home: (\d+) for the lock \+ everyone home \+ (\d+) if its owner lays low\.$/.exec(line).slice(1).map(Number);
    const rb = h.night({ a01: { kind: 'breakin', target: 'a02' }, a02: play }, { filler: { kind: 'laylow' } });
    const fb = rb.newEvents.find(e => e.type === 'fight' && e.kind === 'breakin' && e.target === 'a02');
    const want = lock + home * v.me.fight.others.find(o => o.id === 'a02').strength + (play.kind === 'laylow' ? laylow : 0);
    assert.equal(fb.defence - fb.cops - (fb.patrol || 0), want, `${play.kind}: the home's own defence`);
  }
});

test('SUDO taken reads as TEMP, as the view shows it: +1 shown, and the night counts nothing for it (by design: the seat cannot tell)', () => {
  const g = new Game({ n: 3 });
  housed(g);
  g.night();
  // a01 took a dose it was sold as TEMP, which was SUDO (nobody wrote its play, so its own play stands).
  g.s.agents.a01.high = ['sudo'];
  const y = fieldOf(g, 'a01').you;
  assert.deepEqual([y.onTemp, y.attacking, y.defending, y.held.tempDoses], [true, 2, 2, 0], 'the view reads TEMP');
  assert.equal(blockOf(userText(g, 'a01', { call: 'lock' }))[1], '- You: attacking 2 (1, TEMP +1), defending 2 (1, TEMP +1).');
  assert.equal(hitAt(g).sides[0].strength, 1, 'the night counts no TEMP');
});

test('a fake the seat cannot tell reads real (+1 shown, nothing counted, by design); a piece its own view marks fake adds nothing', () => {
  const knuckles = g => Object.values(g.s.traits).find(t => t.ability === 'knuckles');
  // a03, a Gunrunner, forges knuckles and gives them to a01, who wears them: a01 can't tell.
  const g = new Game({ n: 3 });
  housed(g);
  g.s.agents.a03.trade = 'gunrunner';
  stock(g, 'a03', 'parts', N.build.fakes);
  const r = g.night({ a03: { kind: 'build', fake: knuckles(g).id } });
  const fake = r.newEvents.find(e => e.type === 'fake' && e.act === 'made').copy;
  g.errand('a03', 'give', { to: 'a01', copy: fake });
  g.errand('a01', 'dress', { fit: { [g.s.copies[fake].slot]: fake } });
  const mine = g.view('a01').me.pieces.find(p => p.copy === fake);
  assert.ok(mine && !mine.fake && mine.worn, "control: a01's view reads a real piece, worn");
  assert.deepEqual([fieldOf(g, 'a01').you.knuckles, fieldOf(g, 'a01').you.attacking], [true, 2], 'shown as knuckles +1');
  assert.equal(hitAt(g).sides[0].strength, 1, 'a fake has no ability: the night counts nothing');
  // Its maker's view marks it fake: worn by its maker, it adds nothing, and held unworn it isn't listed.
  const h = new Game({ n: 3 });
  housed(h);
  h.s.agents.a01.trade = 'gunrunner';
  stock(h, 'a01', 'parts', N.build.fakes);
  const r2 = h.night({ a01: { kind: 'build', fake: knuckles(h).id } });
  const own = r2.newEvents.find(e => e.type === 'fake' && e.act === 'made').copy;
  assert.ok(h.view('a01').me.pieces.find(p => p.copy === own).fake, "control: its maker's view marks it");
  assert.equal(fieldOf(h, 'a01').you.held.knuckles, 0, 'not held knuckles');
  h.errand('a01', 'dress', { fit: { [h.s.copies[own].slot]: own } });
  assert.deepEqual([fieldOf(h, 'a01').you.knuckles, fieldOf(h, 'a01').you.attacking], [false, 1], 'worn: nothing');
});

test("others' numbers on public facts, defending: a gun on the latest holdings record adds 1; a gun got after that record doesn't show; a wired walk adds 1, SUDO's too, and shades hide it; ids are grouped by strength and reason, losing no fact", () => {
  const g = new Game({ n: 6 });
  housed(g);
  g.night();
  stock(g, 'a02', 'guns', 1);
  stock(g, 'a03', 'guns', 1);
  stock(g, 'a06', 'guns', 1);
  // The holdings record of tonight's dawn goes public a day later.
  g.night();
  assert.ok(!fieldOf(g, 'a01').others.find(o => o.id === 'a02').gun, 'not yet public');
  g.night();
  const day = g.s.day;
  const a02 = fieldOf(g, 'a01').others.find(o => o.id === 'a02');
  const record = g.view('a01').events.filter(e => e.type === 'holdings' && e.agent === 'a02').at(-1);
  assert.deepEqual(a02, { id: 'a02', strength: 2, gun: true, source: 'record', day: record.day, wired: false }, 'the record the island line shows as "had"');
  assert.match(userText(g, 'a01'), /\na02 [^\n]*had [^\n]*1 gun/, 'the island line shows that record as "had"');
  assert.equal(record.day, day - 1, 'control: the latest record is from dawn yesterday');
  const others = () => blockOf(userText(g, 'a01'))[2];
  assert.ok(others().startsWith('- Others on public facts, defending: 1 each, gun +1 (latest holdings record or your lookout\'s look), wired +1 if TEMP (SUDO walks wired, adds 0): '));
  assert.ok(others().endsWith(`: 2 (gun, day-${day - 1} record): a02, a03, a06; everyone else 1.`), 'one group, in id order');
  // a05 gets a gun now, after its latest record: it doesn't show.
  stock(g, 'a05', 'guns', 1);
  assert.equal(fieldOf(g, 'a01').others.find(o => o.id === 'a05').strength, 1, 'a gun since the record');
  // a04 takes TEMP: it walks wired, +1; a06 too, with its gun on the record: 3, its own group, first. SUDO walks wired
  // too, and shows the same (it adds 0 at the lock).
  for (const id of ['a04', 'a06']) {
    stock(g, id, 'temp', 1);
    g.errand(id, 'take', { drug: 'temp' });
  }
  assert.deepEqual(fieldOf(g, 'a01').others.find(o => o.id === 'a04'), { id: 'a04', strength: 2, gun: false, source: 'record', day: day - 1, wired: true });
  assert.ok(others().endsWith(`: 3 (gun, day-${day - 1} record, wired): a06; 2 (gun, day-${day - 1} record): a02, a03; 2 (wired): a04; everyone else 1.`), others());
  const temp = JSON.stringify(fieldOf(g, 'a01'));
  g.s.agents.a04.high = ['sudo'];
  assert.equal(JSON.stringify(fieldOf(g, 'a01')), temp, 'SUDO reads as TEMP on the board');
  g.hand('a04', abilityCopy(g.s, 'shades'), { wear: true });
  assert.equal(fieldOf(g, 'a01').others.find(o => o.id === 'a04').strength, 1, 'shades hide the walk');
  // Every fact the old per-id list had is still there: each id above 1 once, with its strength and reasons.
  const listed = others().split(': ').slice(1).join(': ');
  for (const o of fieldOf(g, 'a01').others.filter(x => x.strength > 1)) assert.equal(listed.split(o.id).length, 2, `${o.id} once`);
});

test("the seat's own lookout's look is a newer fact than the holdings record: a gun it showed counts, as the night counts it; no other seat's field changes", () => {
  const g = new Game({ n: 3 });
  housed(g);
  g.night();
  g.night();
  stock(g, 'a02', 'guns', 1);
  const a03 = JSON.stringify(fieldOf(g, 'a03'));
  assert.equal(fieldOf(g, 'a01').others.find(o => o.id === 'a02').strength, 1, 'control: no record shows the gun yet');
  g.errand('a01', 'lookout', { agent: 'a02' });
  const day = g.s.day;
  assert.deepEqual(fieldOf(g, 'a01').others.find(o => o.id === 'a02'), { id: 'a02', strength: 2, gun: true, source: 'look', day, wired: false });
  assert.ok(blockOf(userText(g, 'a01', { call: 'lock' }))[2].endsWith(`: 2 (gun, day-${day} look): a02; everyone else 1.`));
  assert.equal(JSON.stringify(fieldOf(g, 'a03')), a03, "a01's look is a01's alone");
  const f = hitAt(g);
  assert.equal(f.defence, 2, 'the night defends a02 at 2: the look was right');
  assert.equal(f.cops, 0, 'control: no cops');
});

test('no hidden state: changing another agent\'s real guns, doses or drug (TEMP or SUDO) with no public record leaves the field as it was', () => {
  const g = new Game({ n: 4 });
  housed(g);
  g.night();
  g.night();
  stock(g, 'a02', 'temp', 1);
  g.errand('a02', 'take', { drug: 'temp' });
  const before = JSON.stringify(fieldOf(g, 'a01'));
  stock(g, 'a02', 'guns', 3);
  stock(g, 'a03', 'guns', 1);
  stock(g, 'a03', 'temp', 4);
  stock(g, 'a04', 'lockpicks', 2);
  g.s.agents.a02.high = ['sudo'];
  assert.equal(JSON.stringify(fieldOf(g, 'a01')), before);
});

test("city cops tonight: the board's levels as levelTonight has them, night 7's crackdown and blackout too; a wanted seat sees the +2", () => {
  for (const midseason of ['crackdown', 'blackout']) {
    const g = new Game({ n: 3, midseason });
    housed(g);
    g.advanceTo(7);
    const c = fieldOf(g, 'a01').cops;
    const want = l => DISTRICTS.filter(d => levelTonight(g.s, d, 7) === l);
    assert.deepEqual([c.heavy, c.lawless], [want('heavy'), want('lawless')], `${midseason}: as levelTonight has them`);
    assert.deepEqual([c.heavyAdds, c.wantedAdds], [N.copsHeavy, N.copsWanted]);
    const line = blockOf(userText(g, 'a01'))[3];
    if (midseason === 'crackdown') {
      assert.deepEqual(c.heavy, DISTRICTS, 'every district heavy');
      assert.equal(line, `- City cops tonight: +${N.copsHeavy} in heavy ${DISTRICTS.join(', ')}; +${N.copsWanted} when an attacker is wanted or the fight was tipped, in every district tonight; none in a bribed fight. You aren't wanted.`);
    } else {
      assert.deepEqual(c.lawless, DISTRICTS, 'every district lawless');
      assert.equal(line, `- City cops tonight: +${N.copsHeavy} in a heavy district (none tonight); +${N.copsWanted} when an attacker is wanted or the fight was tipped, except lawless ${DISTRICTS.join(', ')}; none in a bribed fight. You aren't wanted.`);
    }
  }
  const g = new Game({ n: 3 });
  housed(g);
  g.night();
  g.s.agents.a01.heat = N.wantedAt;
  assert.equal(fieldOf(g, 'a01').you.wanted, true);
  assert.match(blockOf(userText(g, 'a01'))[3], new RegExp(`You are wanted: \\+${N.copsWanted} against any attacking group you're in, except in a lawless district\\.$`));
});

test("the tie line follows N['gap.jump']: 'alone', 0 and a whole number", () => {
  const g = new Game({ n: 3 });
  housed(g);
  g.night();
  const tie = () => blockOf(userText(g, 'a01'))[4];
  assert.equal(N['gap.jump'], 'alone', 'control: the rule in force');
  assert.equal(tie(), '- The attack must beat the defence. A tie holds, but a hit wins a tie on an agent out working alone (a hustle, run, lab cook, deal, patrol or guard) with nobody else on its side.');
  // R11 step 1: the list is the out-working play kinds, so the renamed kind reads "a hustle" (it read "a shift").
  withN({ 'gap.jump': 0 }, () => {
    assert.equal(fieldOf(g, 'a01').tie, 0);
    assert.equal(tie(), '- The attack must beat the defence. A tie holds.');
  });
  withN({ 'gap.jump': 2 }, () => {
    assert.equal(fieldOf(g, 'a01').tie, 2);
    assert.equal(tie(), "- The attack must beat the defence. A tie holds. A hit's attacking group adds +2.");
  });
});

test("no line of the block matches r8b-lean's ADVICE pattern, in any arm, at any call, wanted or not, with every clause on", () => {
  const g = new Game({ n: 4, midseason: 'crackdown' });
  housed(g);
  g.night();
  stock(g, 'a02', 'guns', 1);
  g.night();
  g.night();
  stock(g, 'a01', 'guns', 1);
  stock(g, 'a01', 'temp', 2);
  stock(g, 'a01', 'lockpicks', 1);
  g.hand('a01', abilityCopy(g.s, 'knuckles'));
  stock(g, 'a03', 'temp', 1);
  g.errand('a03', 'take', { drug: 'temp' });
  let seen = 0;
  for (const heat of [0, N.wantedAt]) for (const jump of ['alone', 0, 1]) for (const call of ['round', 'lock', null]) for (const [version, reply] of ARMS) {
    g.s.agents.a01.heat = heat;
    withN({ 'gap.jump': jump }, () => {
      const block = blockOf(userText(g, 'a01', { call, reply, version }));
      for (const line of block) assert.doesNotMatch(line, ADVICE);
      seen += 1;
    });
  }
  assert.equal(seen, 2 * 3 * 3 * 4);
});

test("the field is typed: the owner AI audience (typedOnly) keeps it as the seat's own view has it", () => {
  const g = new Game({ n: 3 });
  housed(g);
  g.night();
  stock(g, 'a01', 'guns', 1);
  assert.deepEqual(g.view('a01', 'ownerAI').me.fight, fieldOf(g, 'a01'));
});

// The outcome hash of a bot-only season (rule A, layer4, seed 404): the season's final state and log. Pinned from trunk
// e420c02, before personStrength was exported (and from the view-identity fixture's `end`, which is the same digest).
// Re-pinned by R9d (core/reports/R9/REPINS.md): every bot ask now carries a line; with the 290 ask lines blanked, the
// season's state and log still hash to e420c02's 820a3ebcc2c3d237cb3ab080d01bc83188f907387315290e6e95a0e803f50f56.
// Re-pinned by R11 step 1, the shift renamed to hustle (slime, 10-21: "let's just do that, and run the tests after to
// save movey"; core/reports/R9/REPINS.md): with every "hustle" mapped back to "shift", the bytes hash to the old pin.
// It was 7b1d771217a581adecc621b0e2527446f63e2a4d089329f85e7d364ec2a6ed30.
// Re-pinned by R11, hustles replace the shift (slime, 10-21: "they should be robbing npcs, doing crime", and on the
// build: "let's just do that"; core/reports/R9/REPINS.md): every bot-only season plays differently by design.
// It was b7da3c8627adb884af5deb7f66f913e2729cc1b6ab419b07053c0ce019ffb4fe.
const OUTCOME_404 = '3a9db08c9409fdaa4cebf133659ce84ce9857d9986a415395f5fc684dd55e548';
test('outcomes unchanged: a bot-only season hashes as it did before the count was exported', () => {
  const seed = 404;
  const cast = makeCast(seed, CASTS.layer4);
  const r = newSeason({ seed, rule: 'A', midseason: MIDSEASON_ROTATION[seed % MIDSEASON_ROTATION.length], items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  let s = r.state;
  const log = [...r.events];
  const ids = Object.keys(s.agents).sort();
  const memos = {};
  const every = cast.some(c => c.works);
  const bots = Object.fromEntries(cast.map(c => [c.id, makeBot(every ? { ...c, every } : c, (memos[c.id] ||= {}))]));
  while (!s.over) {
    const day = s.day;
    for (let round = 1; round <= 3; round++) for (const id of shuffle(rng(seed, 'order', day, round), ids)) {
      for (const e of bots[id].day(viewFor(s, log, id, 'agent'), { seed, day, round, rounds: 3, rng: rng(seed, 'bot', id, day, round) })) {
        const x = applyErrand(s, { ...e, by: id });
        s = x.state;
        log.push(...x.events);
      }
    }
    const plays = {};
    for (const id of ids) {
      if (s.agents[id].jail) continue;
      const { play, reason } = bots[id].night(viewFor(s, log, id, 'agent'), { seed, day, round: 'night', rng: rng(seed, 'bot', id, day, 'night') });
      plays[id] = { ...play, reason };
    }
    const night = settleNight(s, plays);
    s = night.state;
    log.push(...night.events);
  }
  assert.ok(log.filter(e => e.type === 'fight').length > 0, 'control: fights were fought');
  assert.equal(crypto.createHash('sha256').update(JSON.stringify([s, log])).digest('hex'), OUTCOME_404);
});
