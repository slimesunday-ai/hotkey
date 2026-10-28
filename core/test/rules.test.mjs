// Layer-1 rules, one GAME.md section at a time (§24 layer 1). Expected values come from GAME.md and the RULE/GUESS/GAP
// rows in core/numbers.mjs, never from what the code printed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy, tierCopy, twoInDifferentSlots } from './helpers.mjs';
import { moveCopy, DAY15 } from '../rules/state.mjs';
import { N } from '../numbers.mjs';

const robOf = (r, leader) => r.newEvents.find(e => e.type === 'rob' && (!leader || e.leader === leader));
const fightOn = (r, target) => r.newEvents.find(e => e.type === 'fight' && e.target === target);
const setLast = (g, copy, price) => { g.s.traits[g.s.copies[copy].trait].last = price; };
const cashOf = (g, id) => g.s.agents[id].cash;

// --- §10 rent and eviction -------------------------------------------------------------------------------------------

test('rent: $20 a night at dawn; can\'t pay and you\'re evicted until you do (§10, gap.eviction, gap.defaultPlay)', () => {
  const g = new Game({ n: 3 });
  g.grant('a01', 10);
  g.grant('a02', 50);
  g.night({ a01: { kind: 'laylow' }, a02: { kind: 'laylow' }, a03: { kind: 'laylow' } });
  assert.equal(cashOf(g, 'a02'), 50 - N.rent);
  assert.equal(g.s.agents.a01.evicted, true);
  assert.equal(cashOf(g, 'a01'), 10, 'it can\'t pay, so it pays nothing');
  const ev = g.events('evicted', e => e.agent === 'a01' && e.on);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].vis.to, 'all', 'gap.publicFacts: evictions are on the board');
  // No home: no laying low (the default play is a shift in Glasswall), and no more rent while evicted.
  const r = g.night({ a01: { kind: 'laylow' } });
  const inv = r.newEvents.find(e => e.type === 'invalid' && e.agent === 'a01');
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the evicted default is a hustle at the Mall, not a shift in Glasswall, and the work event's wage is a01's hustle event's take.
  assert.deepEqual(inv.instead, { kind: 'hustle', place: 'mall' });
  const wage = r.newEvents.find(e => e.type === 'hustle' && e.agent === 'a01').take;
  assert.equal(cashOf(g, 'a01'), 10 + wage, 'paid for the shift, charged no rent');
  assert.equal(g.errand('a01', 'rent').ok, true, 'paying ends the eviction');
  assert.equal(g.s.agents.a01.evicted, false);
  assert.equal(cashOf(g, 'a01'), 10 + wage - N.rent);
});

test('a hit on an evicted agent also takes half its cash (§7, §10)', () => {
  const g = new Game({ n: 3 });
  g.night({ a01: { kind: 'laylow' } });
  assert.equal(g.s.agents.a01.evicted, true);
  g.grant('a01', 101);
  g.hand('a02', abilityCopy(g.s, 'knuckles'), { wear: true });
  const r = g.night({ a01: { kind: 'hustle', place: 'docks' }, a02: { kind: 'hit', target: 'a01', place: 'docks' } });
  // a01 works a shift, so the hit takes its wage tonight too (§7, GAP gap.holdup).
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the work event's wage is now a01's hustle event's take.
  assert.equal(robOf(r, 'a02').cash, 50 + r.newEvents.find(e => e.type === 'hustle' && e.agent === 'a01').take, 'half of 101, rounded down (gap.rounding), and its wage');
});

// --- §13 heat, cops, jail -------------------------------------------------------------------------------------------

test('arrested: 2 nights on Iron Island, the rarest piece on you and half your cash to the vault, heat to 0 (§13)', () => {
  const g = new Game({ n: 4 });
  g.grant('a01', 101);
  const rare = g.hand('a01', tierCopy(g.s, 'rare'), { wear: true });
  const common = g.hand('a01', tierCopy(g.s, 'common', t => t.slot !== g.s.copies[rare].slot), { wear: true });
  // Glasswall is heavy: 1 against 1 + 1, so a01 loses a fight with cops in it (§6, §8).
  g.night({ a01: { kind: 'hit', target: 'a02', place: 'downtown' }, a02: { kind: 'hustle', place: 'downtown' } });
  const a = g.s.agents.a01;
  assert.ok(a.jail, 'arrested');
  assert.equal(g.s.copies[rare].holder.k, 'vault', 'the rarest real piece on you goes to the vault');
  assert.equal(g.s.copies[common].holder.id, 'a01', 'only that one');
  assert.equal(g.s.vault.cash, 50, 'half your cash as a fine');
  assert.equal(cashOf(g, 'a01'), 51, 'and no rent in jail');
  assert.equal(a.heat, 0, 'jail clears heat');
  assert.equal(a.jail.stars, 1, 'gap.bailStars: the heat at the lock (0) plus the crime (1)');
  const arrest = g.events('arrest')[0];
  assert.equal(arrest.vis.to, 'all');
  assert.equal(arrest.bail, N.bailPerStar * 1);
  assert.ok(g.view(null, 'public').board.vault.pieces.some(p => p.copy === rare), 'the vault\'s contents are public');
  // You can still talk (§13).
  assert.equal(g.errand('a01', 'ask', { to: 'a03' }).ok, true);
  g.night({ a01: { kind: 'hustle', place: 'docks' } });
  assert.ok(!g.events('play').some(e => e.agent === 'a01' && e.t === 2 * 2 + 1), 'no play on night 2');
  assert.ok(g.s.agents.a01.jail, 'still in jail after night 2');
  g.night();
  assert.equal(g.s.agents.a01.jail, null, 'out after 2 nights');
  assert.equal(g.events('release', e => e.agent === 'a01' && e.why === 'served').length, 1);
  assert.equal(cashOf(g, 'a01'), 51, 'no rent for the nights in jail');
  g.night();
  assert.ok(g.events('play').some(e => e.agent === 'a01' && e.t === 2 * 4 + 1), 'it plays again on night 4');
});

test('bail: anyone can pay $100 a star to get you out the next morning (§13)', () => {
  const g = new Game({ n: 4 });
  g.night({ a01: { kind: 'hit', target: 'a02', place: 'downtown' }, a02: { kind: 'hustle', place: 'downtown' } });
  assert.ok(g.s.agents.a01.jail);
  g.grant('a03', 100);
  const before = cashOf(g, 'a03');
  assert.equal(g.errand('a03', 'bail', { agent: 'a01' }).ok, true);
  assert.equal(g.s.agents.a01.jail, null);
  assert.equal(cashOf(g, 'a03'), before - 100, 'one star: $100');
  assert.equal(g.s.money.out.bail, 100);
  assert.equal(g.events('release', e => e.agent === 'a01' && e.why === 'bail').length, 1);
  const r = g.night({ a01: { kind: 'hustle', place: 'docks' } });
  assert.ok(r.newEvents.some(e => e.type === 'play' && e.agent === 'a01'), 'out in time for tonight');
});

test('5 stars: the city comes for you, arrested at the end of the night (§13)', () => {
  const g = new Game({ n: 3 });
  g.s.agents.a01.heat = 4;
  // The Heap is lawless: no cops in the fight, a 1-1 tie, so no arrest from the fight. The crime still adds a star.
  g.night({ a01: { kind: 'hit', target: 'a02', place: 'junkyard' }, a02: { kind: 'hit', target: 'a03', place: 'junkyard' } });
  const arrest = g.events('arrest', e => e.agent === 'a01');
  assert.equal(arrest.length, 1);
  assert.equal(arrest[0].why, 'heat');
  assert.equal(g.s.agents.a01.jail.stars, 5);
  assert.equal(arrest[0].bail, 5 * N.bailPerStar);
  assert.equal(g.s.agents.a01.heat, 0);
});

test('heat: each crime adds a star and backers get the same; it falls 1 a night without one, 2 laying low; a hit in the wrong district finds nobody and adds none (§6, §13)', () => {
  const g = new Game({ n: 7 });
  for (const id of ['a04', 'a05', 'a06']) g.s.agents[id].heat = 2;
  // R4-2 (gap.accept): a01 accepts its backer.
  g.night({
    // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a02's and a04's nights out without a crime are hustles at the Mall (lawless, no star), as their shifts added none; a01's hit finds a02 there.
    a01: { kind: 'hit', target: 'a02', place: 'mall', accept: ['a03'] },
    a02: { kind: 'hustle', place: 'mall' },
    a03: { kind: 'back', target: 'a01' },
    a04: { kind: 'hustle', place: 'mall' },
    a05: { kind: 'laylow' },
    a06: { kind: 'hit', target: 'a02', place: 'strip' },
    a07: { kind: 'hustle', place: 'industrial' },
  });
  const heat = id => g.s.agents[id].heat;
  assert.deepEqual(
    { a01: heat('a01'), a03: heat('a03'), a02: heat('a02'), a04: heat('a04'), a05: heat('a05'), a06: heat('a06') },
    { a01: 1, a03: 1, a02: 0, a04: 1, a05: 0, a06: 1 },
  );
  assert.ok(!g.events('fight').some(e => e.place === 'strip'), 'the miss found nobody: no fight');
  assert.ok(g.events('heat').every(e => e.vis.to === 'all'), 'heat stars are public');
  g.s.agents.a07.heat = 3;
  assert.equal(g.view(null, 'public').board.agents.find(a => a.id === 'a07').wanted, true, '3 stars: wanted, and it\'s public');
});

// --- §6 places and the city's push-back ------------------------------------------------------------------------------

test('the push-back: 3+ crimes in a district make it one level hotter tomorrow; a quiet night moves it one back (§6, gap.quietNight)', () => {
  const g = new Game({ n: 10 });
  assert.equal(g.s.districts.docks.level, 'normal');
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a04, a05 and a06 are fillers the hits find at the docks, so these nights pass the docks filler.
  const docks = { filler: { kind: 'hustle', place: 'docks' } };
  g.night({
    a01: { kind: 'hit', target: 'a04', place: 'docks' },
    a02: { kind: 'hit', target: 'a05', place: 'docks' },
    a03: { kind: 'hit', target: 'a06', place: 'docks' },
    a07: { kind: 'hit', target: 'a08', place: 'industrial' },
    a08: { kind: 'hustle', place: 'industrial' },
    a09: { kind: 'hit', target: 'a10', place: 'industrial' },
    a10: { kind: 'hustle', place: 'industrial' },
  }, docks);
  assert.equal(g.s.districts.docks.level, 'heavy', 'three crimes: normal to heavy');
  assert.equal(g.s.districts.industrial.level, 'normal', 'two crimes: no change');
  assert.ok(g.events('police', e => e.place === 'docks')[0].vis.to === 'all');
  // One crime is not a quiet night, so the level holds; a night with none moves it back.
  g.night({ a01: { kind: 'hit', target: 'a04', place: 'docks' } }, docks);
  assert.equal(g.s.districts.docks.level, 'heavy');
  g.night();
  assert.equal(g.s.districts.docks.level, 'normal');
  g.night();
  assert.equal(g.s.districts.docks.level, 'normal', 'never cooler than where it started');
});

// --- §13 the midseason event ------------------------------------------------------------------------------------------

for (const [event, level] of [['blackout', 'lawless'], ['crackdown', 'heavy']]) {
  test(`midseason ${event}: every district ${level} on night 7, and only that night (§13)`, () => {
    const g = new Game({ n: 3, midseason: event });
    g.advanceTo(7);
    assert.ok(Object.values(g.view('a01').board.tonight).every(l => l === level));
    g.s.agents.a01.heat = event === 'blackout' ? 3 : 0;
    // A lone 1-1 hit in Glasswall: under a blackout no cops come, even for a wanted attacker; under a crackdown the
    // docks are heavy, so the cops are in the fight and the loser is arrested.
    const place = event === 'blackout' ? 'downtown' : 'docks';
    g.night({ a01: { kind: 'hit', target: 'a02', place }, a02: { kind: 'hustle', place } });
    assert.equal(!!g.s.agents.a01.jail, event === 'crackdown');
    assert.equal(g.s.districts.downtown.level, 'heavy', 'the stored levels are untouched');
    assert.equal(g.view('a03').board.tonight.junkyard, 'lawless', 'night 8 is ordinary again');
  });
}

test('midseason Payday: work pays double on night 7; the shift curve (§13, §38 hustleCurve GUESS)', () => {
  const g = new Game({ n: 6, midseason: 'payday' });
  g.advanceTo(6);
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the hustle's take (N.hustle) replaces the shift curve, read off each hustler's event: at the docks (normal) $58, less $5 for each other hustler there, at least $20; Payday doubles it.
  const docks = { filler: { kind: 'hustle', place: 'docks' } };
  assert.equal(g.night({}, docks).newEvents.find(e => e.type === 'hustle').take, 33, 'six hustlers at the docks: $58 - 5 x $5 = $33');
  assert.equal(g.night({}, docks).newEvents.find(e => e.type === 'hustle').take, 2 * 33, 'Payday doubles it');
  const many = new Game({ n: 12 });
  assert.equal(many.night({}, docks).newEvents.find(e => e.type === 'hustle').take, 20, 'twelve hustlers at the docks: $58 - 11 x $5 is under the floor, $20');
  const crowd = new Game({ n: 30 });
  assert.equal(crowd.night({}, docks).newEvents.find(e => e.type === 'hustle').take, 20, 'never below $20');
});

// --- §8 fights: break-ins ---------------------------------------------------------------------------------------------

test('a break-in: the lock, plus everyone home, plus 1 if the owner lays low; it takes the rarest piece inside and all the cash there (§7, §8)', () => {
  const g = new Game({ n: 6 });
  g.grant('a02', 100);
  const stashed = g.hand('a02', tierCopy(g.s, 'common'));
  // The owner is out at work: the lock alone defends, 1 against 1 holds.
  let r = g.night({ a01: { kind: 'breakin', target: 'a02' } });
  assert.equal(fightOn(r, 'a02').defence, 1);
  assert.equal(fightOn(r, 'a02').won, false);
  g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
  const lockCash = cashOf(g, 'a02');
  r = g.night({ a01: { kind: 'breakin', target: 'a02' } });
  const b = r.newEvents.find(e => e.type === 'burgle');
  assert.equal(b.copy, stashed, 'the rarest real piece inside');
  assert.equal(b.cash, Math.floor(lockCash * N.breakinShare), 'all the cash there (breakinShare)');
  assert.ok(g.s.agents.a01.carry.length === 0 && g.s.copies[stashed].holder.id === 'a01', 'the bag goes to the burglar');

  // Laying low alone: 1 lock + 1 home + 1 laying low = 3. Knuckles (2) and one backer (1) tie; two backers win.
  const h = new Game({ n: 6 });
  h.grant('a02', 200);
  h.hand('a01', abilityCopy(h.s, 'knuckles'), { wear: true });
  const worn = h.hand('a02', tierCopy(h.s, 'rare'), { wear: true });
  h.hand('a02', tierCopy(h.s, 'common', t => t.slot !== h.s.copies[worn].slot));
  // R4-2 (gap.accept): the burglar accepts its backers, and the owner its own.
  r = h.night({ a01: { kind: 'breakin', target: 'a02', accept: ['a03'] }, a03: { kind: 'back', target: 'a01' }, a02: { kind: 'laylow' } });
  assert.equal(fightOn(r, 'a02').defence, 3);
  assert.equal(fightOn(r, 'a02').won, false);
  r = h.night({ a01: { kind: 'breakin', target: 'a02', accept: ['a03', 'a04'] }, a03: { kind: 'back', target: 'a01' }, a04: { kind: 'back', target: 'a01' }, a02: { kind: 'laylow' } });
  assert.equal(fightOn(r, 'a02').won, true);
  assert.equal(r.newEvents.find(e => e.type === 'burgle').copy, worn, 'what anyone home is wearing counts: the worn rare beats the stashed common');
  // The break-in took all of a02's cash, so it couldn't pay the dawn's rent; paying it gets a02 home again (§10).
  assert.equal(h.s.agents.a02.evicted, true, 'control: evicted at dawn');
  h.grant('a02', N.rent);
  assert.equal(h.errand('a02', 'rent').ok, true);
  // A backer home with the owner counts too: 1 + 2 + 1 = 4.
  r = h.night({ a01: { kind: 'breakin', target: 'a02', accept: ['a03', 'a04'] }, a03: { kind: 'back', target: 'a01' }, a04: { kind: 'back', target: 'a01' }, a02: { kind: 'laylow', accept: ['a05'] }, a05: { kind: 'back', target: 'a02' } });
  assert.equal(fightOn(r, 'a02').defence, 4);
  assert.equal(fightOn(r, 'a02').won, false);
});

// --- §4 ties for the rarest (added 10-14) ------------------------------------------------------------------------------

function tieSetup() {
  const g = new Game({ n: 4 });
  const [x, y] = twoInDifferentSlots(g.s, 'rare');
  g.hand('a02', x, { wear: true });
  g.hand('a02', y, { wear: true });
  g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
  return { g, x, y };
}
const taken = (g, want) => robOf(g.night({
  a01: { kind: 'hit', target: 'a02', place: 'docks', ...(want ? { want } : {}) }, a02: { kind: 'hustle', place: 'docks' },
}), 'a01').copy;

test('ties for the rarest: the piece the play named (§4)', () => {
  const { g, x, y } = tieSetup();
  setLast(g, x, 300);
  setLast(g, y, 250);
  assert.equal(taken(g, y), y);
});
test('ties for the rarest: otherwise the one that last sold for more on the list (§4)', () => {
  const { g, x, y } = tieSetup();
  setLast(g, x, 250);
  setLast(g, y, 300);
  assert.equal(taken(g), y);
});
test('ties for the rarest: then the lower id (§4)', () => {
  const { g, x, y } = tieSetup();
  setLast(g, x, 300);
  setLast(g, y, 300);
  assert.equal(taken(g), [x, y].sort()[0]);
});
test('ties for the rarest: a named piece that isn\'t among the tied ones changes nothing (§4)', () => {
  const { g, x, y } = tieSetup();
  const used = [g.s.copies[x].slot, g.s.copies[y].slot, 'acc'];
  const c = g.hand('a02', tierCopy(g.s, 'common', t => !used.includes(t.slot)), { wear: true });
  setLast(g, x, 300);
  setLast(g, y, 250);
  assert.equal(taken(g, c), x);
});
test('the rarest is by tier first: a grail nobody has bought beats a rare that sold high (§4)', () => {
  const g = new Game({ n: 4 });
  const grail = Object.values(g.s.traits).find(t => t.tier === 'grail');
  const rare = tierCopy(g.s, 'rare', t => t.slot !== grail.slot);
  g.hand('a02', grail.copies[0], { wear: true });
  g.hand('a02', rare, { wear: true });
  setLast(g, rare, 3000);
  g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
  assert.equal(taken(g), grail.copies[0]);
});
test('an arrest seizes by the same fallback, since nobody picks (§4, §13)', () => {
  const g = new Game({ n: 4 });
  const [x, y] = twoInDifferentSlots(g.s, 'rare');
  g.hand('a01', x, { wear: true });
  g.hand('a01', y, { wear: true });
  setLast(g, x, 250);
  setLast(g, y, 300);
  g.night({ a01: { kind: 'hit', target: 'a02', place: 'downtown', want: x }, a02: { kind: 'hustle', place: 'downtown' } });
  assert.ok(g.s.agents.a01.jail);
  assert.equal(g.s.copies[y].holder.k, 'vault');
  assert.equal(g.s.copies[x].holder.id, 'a01');
});

// --- §4 the placeholder abilities --------------------------------------------------------------------------------------

test('the vest: once a season, a won hit on you takes nothing (§4)', () => {
  const g = new Game({ n: 3 });
  g.hand('a02', abilityCopy(g.s, 'vest'), { wear: true });
  const rare = g.hand('a02', tierCopy(g.s, 'rare', t => t.slot !== 'top'), { wear: true });
  g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
  const plays = { a01: { kind: 'hit', target: 'a02', place: 'docks' }, a02: { kind: 'hustle', place: 'docks' } };
  let rob = robOf(g.night(plays), 'a01');
  assert.equal(rob.copy, null);
  assert.equal(rob.vest, true);
  assert.equal(g.s.copies[rare].holder.id, 'a02');
  rob = robOf(g.night(plays), 'a01');
  assert.equal(rob.copy, rare, 'the second time, it takes');
});

test('runners: if your attack fails, you\'re never arrested for it (§4)', () => {
  const g = new Game({ n: 4 });
  g.hand('a01', abilityCopy(g.s, 'runners'), { wear: true });
  // Two attackers tie 1-1 and both fail; Glasswall is heavy, so the cops are in the fight.
  g.night({ a01: { kind: 'hit', target: 'a02', place: 'downtown' }, a03: { kind: 'hit', target: 'a02', place: 'downtown' }, a02: { kind: 'hustle', place: 'downtown' } });
  assert.equal(g.s.agents.a01.jail, null);
  assert.ok(g.s.agents.a03.jail, 'control: without runners, arrested');
});

test('the ski mask: the victim doesn\'t learn who robbed it until the 24-hour record (§4, §19)', () => {
  const g = new Game({ n: 4 });
  g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
  g.hand('a01', abilityCopy(g.s, 'skimask'), { wear: true });
  g.hand('a03', abilityCopy(g.s, 'knuckles', 1), { wear: true });
  g.hand('a02', tierCopy(g.s, 'common'), { wear: true });
  g.hand('a04', tierCopy(g.s, 'common'), { wear: true });
  const r = g.night({
    a01: { kind: 'hit', target: 'a02', place: 'docks' }, a02: { kind: 'hustle', place: 'docks' },
    a03: { kind: 'hit', target: 'a04', place: 'industrial' }, a04: { kind: 'hustle', place: 'industrial' },
  });
  assert.equal(r.newEvents.find(e => e.type === 'robbed' && e.agent === 'a02').by, null);
  assert.equal(r.newEvents.find(e => e.type === 'robbed' && e.agent === 'a04').by, 'a03', 'control: no mask, named');
  const record = robOf(r, 'a01');
  assert.equal(record.vis.pub, record.t + 2, 'the 24-hour record names the robber');
});

test('brass knuckles: +1 when you attack, nothing on defence (§4, §8)', () => {
  const g = new Game({ n: 6 });
  g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
  g.hand('a05', abilityCopy(g.s, 'knuckles', 1), { wear: true });
  g.hand('a06', abilityCopy(g.s, 'knuckles', 2), { wear: true });
  const r = g.night({
    a01: { kind: 'hit', target: 'a02', place: 'docks' }, a02: { kind: 'hustle', place: 'docks' },
    a03: { kind: 'hit', target: 'a04', place: 'docks' }, a04: { kind: 'hustle', place: 'docks' },
    a06: { kind: 'hit', target: 'a05', place: 'industrial' }, a05: { kind: 'hustle', place: 'industrial' },
  });
  assert.deepEqual([fightOn(r, 'a02').sides[0].strength, fightOn(r, 'a02').won], [2, true]);
  // gap.jump 'alone' (R8, slime 10-19: "do 1 and 2"): a04 is out working alone, so the bare-handed hit wins the tie.
  assert.deepEqual([fightOn(r, 'a04').sides[0].strength, fightOn(r, 'a04').won], [1, true], 'control: bare hands tie, and win it on a lone shift worker');
  assert.deepEqual([fightOn(r, 'a05').defence, fightOn(r, 'a05').won], [1, true], 'knuckles add nothing to a defence');
});

test('the burner phone: 4 more sit-down messages a day; messages start over each day (§4, §14)', () => {
  for (const [burner, limit] of [[false, N.messages], [true, N.messages + N.burnerMessages]]) {
    const g = new Game({ n: 2 });
    if (burner) g.hand('a01', abilityCopy(g.s, 'burner'), { wear: true });
    g.errand('a01', 'ask', { to: 'a02' });
    const sd = Object.keys(g.s.sitdowns)[0];
    g.errand('a02', 'answer', { sitdown: sd, accept: true });
    let sent = 1;
    while (g.errand('a01', 'say', { sitdown: sd, say: 'offer', terms: {} }).ok) sent++;
    assert.equal(sent, limit, burner ? 'with the burner' : 'without');
    assert.equal(g.events('invalid').at(-1).why, 'no messages left today');
    g.night();
    // R4-3: the sit-down lasts (sitdownDays), and its messages start over with the day.
    assert.equal(g.errand('a01', 'say', { sitdown: sd, say: 'offer', terms: {} }).ok, true, 'a new day');
  }
});

// --- §15 the last night, the ferry and the mint ----------------------------------------------------------------------

test('the last night: everything carried, route hits, the dock, the ferry and the mint; jail ends when the ferry docks, so only night 14\'s arrests miss the boat (§13, §15)', () => {
  const g = new Game({ n: 8 });
  g.advanceTo(13);
  // a05 is arrested on night 13 (Glasswall is heavy), holding a rare in its stash. Jail ends at dawn on day 14, when the
  // ferry docks (GAP gap.ferryJail): it walks out, its fine standing, and boards like anyone.
  const a05Rare = g.hand('a05', tierCopy(g.s, 'rare'));
  const before13 = cashOf(g, 'a05');
  const n13 = g.night({ a05: { kind: 'hit', target: 'a06', place: 'downtown' }, a06: { kind: 'hustle', place: 'downtown' } });
  assert.ok(n13.newEvents.some(e => e.type === 'arrest' && e.agent === 'a05'), 'control: arrested on night 13');
  assert.equal(n13.newEvents.find(e => e.type === 'seized' && e.agent === 'a05').fine, Math.floor(before13 / 2), 'its fine, half its cash, stands');
  assert.ok(n13.newEvents.some(e => e.type === 'release' && e.agent === 'a05'), 'out at the dawn the ferry docks');
  assert.equal(g.s.agents.a05.jail, null);
  const a05Cash = cashOf(g, 'a05');

  const bagged = g.hand('a01', tierCopy(g.s, 'rare'));
  const a01Worn = g.hand('a01', tierCopy(g.s, 'common', t => t.slot !== g.s.copies[bagged].slot), { wear: true });
  g.hand('a02', abilityCopy(g.s, 'knuckles'), { wear: true });
  const a06Piece = g.hand('a06', tierCopy(g.s, 'common'), { wear: true });
  g.s.agents.a03.heat = 4;
  const vaulted = Object.keys(g.s.copies).find(k => g.s.copies[k].holder.k === 'list');
  moveCopy(g.s, vaulted, { k: 'vault' }, 'test');
  g.s.money.in.test = (g.s.money.in.test || 0) + 33;
  g.s.vault.cash += 33;
  const vaultCash = g.s.vault.cash;
  const a01Cash = cashOf(g, 'a01');
  const a06Cash = cashOf(g, 'a06');
  // a03 carries a rare and a common to the dock, where the cops arrest it: the arrest seizes the rare (§13), and the
  // common stays on it, in jail when the ferry leaves.
  const a03Rare = g.hand('a03', tierCopy(g.s, 'rare'));
  const a03Common = g.hand('a03', tierCopy(g.s, 'common'));
  const a03Cash = cashOf(g, 'a03');

  const r = g.night({
    a01: { kind: 'board', place: 'industrial' },
    a02: { kind: 'hit', target: 'a01', place: 'industrial' },
    a03: { kind: 'hit', target: 'a04', place: 'junkyard' },
    a04: { kind: 'board', place: 'junkyard' },
    a06: { kind: 'board', place: 'downtown' },
    a07: { kind: 'laylow' },
    a08: { kind: 'hustle', place: 'docks' },
  });
  // Everything goes with you: the hit takes the rarest piece it carries, worn or bagged, and half its cash.
  const rob = robOf(r, 'a02');
  assert.equal(rob.copy, bagged);
  assert.equal(rob.cash, Math.floor(a01Cash / 2));
  assert.deepEqual(g.s.copies[bagged].holder, { k: 'minted', id: 'a02' }, 'and it mints to the robber');
  assert.deepEqual(g.s.copies[a01Worn].holder, { k: 'minted', id: 'a01' });
  // No work, no laying low on the last night (gap.defaultPlay: board through Glasswall).
  for (const id of ['a07', 'a08']) {
    assert.deepEqual(r.newEvents.find(e => e.type === 'invalid' && e.agent === id).instead, { kind: 'board', place: 'downtown' });
  }
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): no work is paid on the last night: the work event is now the hustle event.
  assert.ok(!r.newEvents.some(e => e.type === 'hustle'));
  // City cops wait at the dock: 5 stars, arrested there, and the boat leaves without you.
  const dock = r.newEvents.find(e => e.type === 'arrest' && e.agent === 'a03');
  assert.equal(dock.why, 'dock');
  assert.ok(r.newEvents.some(e => e.type === 'missed' && e.agent === 'a03'));
  assert.ok(!r.newEvents.some(e => e.type === 'board' && e.agent === 'a03'));
  // Arrested on night 14, a03 is in jail when the ferry leaves: nothing mints and the cash is gone.
  const seized = r.newEvents.find(e => e.type === 'seized' && e.agent === 'a03');
  assert.equal(seized.copy, a03Rare, 'the dock arrest seized the rarest piece it carried');
  const missed = r.newEvents.find(e => e.type === 'missed' && e.agent === 'a03');
  assert.deepEqual(missed.copies, [a03Common]);
  assert.equal(missed.cash, a03Cash - seized.fine);
  assert.equal(g.s.copies[a03Common].holder.k, 'gone');
  assert.equal(g.s.copies[a03Rare].holder.k, 'gone', 'seized into the vault, it never mints either');
  // Out of jail at dawn, a05 boarded like anyone: its stash's rare mints to it, and its cash becomes Mainland money.
  assert.ok(r.newEvents.some(e => e.type === 'board' && e.agent === 'a05'));
  assert.ok(!r.newEvents.some(e => e.type === 'missed' && e.agent === 'a05'));
  assert.deepEqual(g.s.copies[a05Rare].holder, { k: 'minted', id: 'a05' });
  assert.equal(g.s.agents.a05.mainland, a05Cash * N.mainlandRate);
  // Aboard: every real trait mints to its owner with its history; cash becomes Mainland money (rate GUESS 1).
  assert.deepEqual(g.s.copies[a06Piece].holder, { k: 'minted', id: 'a06' });
  assert.equal(g.s.agents.a06.mainland, a06Cash * N.mainlandRate);
  const card = r.newEvents.find(e => e.type === 'mint' && e.agent === 'a06').cards.find(c => c.copy === a06Piece);
  assert.ok(card.history.length >= 2, 'a history card');
  // Whatever's still in the vault never mints.
  assert.equal(g.s.copies[vaulted].holder.k, 'gone');
  // The dock arrest's fine went into the vault tonight too (§13), and it's lost with the rest.
  assert.equal(r.newEvents.find(e => e.type === 'gone' && e.from === 'vault').cash, vaultCash + r.newEvents.find(e => e.type === 'seized' && e.agent === 'a03').fine);
  assert.equal(g.s.over, true);
  assert.equal(g.s.clock, DAY15);
  assert.ok(Object.values(g.s.agents).every(a => a.cash === 0), 'no island cash survives the ferry');
});

test('the crew stash goes aboard with whoever\'s home it\'s in (§12, §15)', () => {
  const g = new Game({ n: 3 });
  g.errand('a01', 'crew_form', { name: 'crew' });
  g.errand('a01', 'crew_invite', { agent: 'a02' });
  g.errand('a02', 'crew_join', { crew: 'c1' });
  g.advanceTo(14);
  const piece = g.hand('a02', tierCopy(g.s, 'rare'));
  g.errand('a02', 'stash_put', { copy: piece });
  g.night();
  assert.deepEqual(g.s.copies[piece].holder, { k: 'minted', id: 'a01' }, 'the keeper (the founder, gap.crewStash) carries it aboard');
});

// --- §12 betrayals, typed (gap.betrayals) -----------------------------------------------------------------------------

function promise(g, by, to, terms) {
  g.errand(by, 'ask', { to });
  const sd = Object.keys(g.s.sitdowns).at(-1);
  g.errand(to, 'answer', { sitdown: sd, accept: true });
  return g.errand(by, 'say', { sitdown: sd, say: 'promise', terms });
}

for (const pays of [false, true]) {
  test(`walk: a leader keeps a cut it promised for a won play past the next day (${pays ? 'control: it pays' : 'it walks'}) (§12)`, () => {
    const g = new Game({ n: 5 });
    g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
    g.hand('a03', tierCopy(g.s, 'common'), { wear: true });
    promise(g, 'a01', 'a02', { what: 'pay', who: 'a02', cash: 50, night: 1 });
    // R4-2 (gap.accept): the leader accepts the backer it promised a cut.
    const r = g.night({ a01: { kind: 'hit', target: 'a03', place: 'docks', accept: ['a02'] }, a02: { kind: 'back', target: 'a01' }, a03: { kind: 'hustle', place: 'docks' } });
    assert.ok(fightOn(r, 'a03').won);
    assert.equal(g.events('betray').filter(e => e.kind === 'walk').length, 0, 'not before the end of the next day');
    if (pays) {
      g.grant('a01', 50);
      g.errand('a01', 'pay', { to: 'a02', amount: 50, for: 'cut' });
    }
    g.night();
    const walks = g.events('betray', e => e.kind === 'walk');
    assert.equal(walks.length, pays ? 0 : 1);
    if (!pays) {
      assert.equal(walks[0].by, 'a01');
      assert.deepEqual(walks[0].victims, ['a02']);
      assert.ok(walks[0].vis.to.includes('a02'), 'the betrayed agent gets a receipt');
    }
  });
}

for (const turns of [true, false]) {
  test(`turn: promise to back someone, then back the other side (${turns ? 'it turns' : 'control: it keeps its word'}) (§12)`, () => {
    const g = new Game({ n: 4 });
    promise(g, 'a02', 'a01', { what: 'back', who: 'a01', night: 1 });
    g.night({ a01: { kind: 'hit', target: 'a03', place: 'docks' }, a02: { kind: 'back', target: turns ? 'a03' : 'a01' }, a03: { kind: 'hustle', place: 'docks' } });
    const t = g.events('betray', e => e.kind === 'turn');
    assert.equal(t.length, turns ? 1 : 0);
    if (turns) {
      assert.equal(t[0].by, 'a02');
      assert.deepEqual(t[0].victims, ['a01']);
    }
  });
}

test('rug: a take that empties the crew stash with something another member put in; taking back your own isn\'t one (§12)', () => {
  const crew = () => {
    const g = new Game({ n: 3 });
    g.errand('a01', 'crew_form', { name: 'crew' });
    g.errand('a01', 'crew_invite', { agent: 'a02' });
    g.errand('a02', 'crew_join', { crew: 'c1' });
    return g;
  };
  let g = crew();
  g.grant('a01', 100);
  g.errand('a01', 'stash_put', { cash: 100 });
  g.errand('a02', 'stash_take', { cash: 100 });
  let rugs = g.events('betray', e => e.kind === 'rug');
  assert.equal(rugs.length, 1);
  assert.equal(rugs[0].by, 'a02');
  assert.deepEqual(rugs[0].victims, ['a01']);

  g = crew();
  g.grant('a01', 100);
  g.errand('a01', 'stash_put', { cash: 100 });
  g.errand('a01', 'stash_take', { cash: 100 });
  assert.equal(g.events('betray').length, 0, 'control: its own cash back');

  g = crew();
  const piece = g.hand('a01', tierCopy(g.s, 'rare'));
  g.errand('a01', 'stash_put', { copy: piece });
  g.errand('a02', 'stash_take', { copy: piece });
  rugs = g.events('betray', e => e.kind === 'rug');
  assert.equal(rugs.length, 1, 'a piece another member put in');
});

// --- §8 groups, chains and several attackers ---------------------------------------------------------------------------

test("a group is an agent plus the backers it accepts, 5 at most, in its order; the rest are there but not in it (§8, gap.groupCap; R4-2: the leader's order, not the lowest ids)", () => {
  const g = new Game({ n: 8 });
  const backers = { a02: { kind: 'back', target: 'a01' }, a03: { kind: 'back', target: 'a01' }, a04: { kind: 'back', target: 'a01' }, a05: { kind: 'back', target: 'a01' }, a06: { kind: 'back', target: 'a01' } };
  const r = g.night({ a01: { kind: 'hit', target: 'a07', place: 'docks', accept: ['a06', 'a05', 'a04', 'a03', 'a02'] }, a07: { kind: 'hustle', place: 'docks' }, ...backers });
  assert.deepEqual(r.fights.groups.a01, ['a01', 'a06', 'a05', 'a04', 'a03']);
  assert.deepEqual(r.fights.turnedAway, ['a02']);
  assert.equal(fightOn(r, 'a07').sides[0].size, 5);
  assert.equal(g.s.agents.a02.heat, 0, 'not in the group: no stars');
});

test('no chains: backing an agent that is itself backing someone does nothing (§8, gap.chainedBack)', () => {
  const g = new Game({ n: 5 });
  // R4-2 (gap.accept): a01 accepts a02, and a03's back on a02 is a chain whatever anyone accepts.
  const r = g.night({
    a01: { kind: 'hit', target: 'a04', place: 'docks', accept: ['a02', 'a03'] }, a04: { kind: 'hustle', place: 'docks' },
    a02: { kind: 'back', target: 'a01' }, a03: { kind: 'back', target: 'a02' },
  });
  assert.deepEqual(r.fights.groups.a01, ['a01', 'a02']);
  assert.ok(r.fights.idle.includes('a03'));
  assert.deepEqual(r.fights.where.a03, { at: 'home', home: 'a03' });
  assert.equal(g.s.agents.a03.heat, 0);
});

test('several attackers on one target: the strongest wins only if it beats the defence and every other group (§8)', () => {
  const g = new Game({ n: 4 });
  g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
  g.hand('a02', tierCopy(g.s, 'common'), { wear: true });
  const r = g.night({ a01: { kind: 'hit', target: 'a02', place: 'docks' }, a03: { kind: 'hit', target: 'a02', place: 'docks' }, a02: { kind: 'hustle', place: 'docks' } });
  const f = r.fights.fights.find(x => x.target === 'a02');
  assert.equal(f.winner, 'a01', '2 beats 1 and the defence of 1');
  assert.deepEqual(f.losers, ['a03']);
  assert.equal(f.arrested.length, 0, 'normal district, nobody wanted: no cops, no arrests');
});

test('your own play still happens if you\'re attacked: a robbed worker still works its shift, and the hit takes the wage it was paid (§7, §8)', () => {
  const g = new Game({ n: 3 });
  g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
  g.hand('a02', tierCopy(g.s, 'common'), { wear: true });
  const before = cashOf(g, 'a02');
  assert.equal(before, 0, 'control: it starts with nothing');
  const r = g.night({ a01: { kind: 'hit', target: 'a02', place: 'docks' }, a02: { kind: 'hustle', place: 'docks' } });
  const rob = robOf(r, 'a01');
  assert.ok(rob.copy);
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the work event is now a02's hustle event: its agents the agents with one, its wage the take.
  const wage = r.newEvents.find(e => e.type === 'hustle' && e.agent === 'a02');
  assert.ok(wage, 'it worked the shift');
  assert.equal(rob.cash, wage.take, 'the hit took the wage it was paid (GAP gap.holdup)');
  assert.equal(cashOf(g, 'a02'), before, 'it kept none of the wage');
  assert.equal(g.s.agents.a02.evicted, true, "so it had nothing for the dawn's rent (§10)");
});

test('wanted: city cops defend anyone a wanted agent attacks (+2), except in lawless districts (§6, §8, §13)', () => {
  for (const [place, wins] of [['docks', false], ['junkyard', true]]) {
    const g = new Game({ n: 3 });
    g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
    g.s.agents.a01.heat = 3;
    // a02 is out in the place the hit names: at the docks on a shift, or at The Heap on a hit of its own.
    const a02 = place === 'docks' ? { kind: 'hustle', place } : { kind: 'hit', target: 'a03', place };
    const r = g.night({ a01: { kind: 'hit', target: 'a02', place }, a02 });
    const f = fightOn(r, 'a02');
    assert.equal(f.defence, wins ? 1 : 3, place);
    assert.equal(f.won, wins, place);
    assert.equal(!!g.s.agents.a01.jail, !wins, `${place}: losing to cops means arrest`);
  }
});

test('takes land first, then arrests: an agent arrested the night it stole is caught with the goods (§5, §8)', () => {
  const g = new Game({ n: 3 });
  g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
  const loot = g.hand('a02', tierCopy(g.s, 'rare'), { wear: true });
  g.s.agents.a01.heat = 4;
  // The Heap is lawless, so the hit wins; the crime makes 5 stars, and the city comes at the end of the night.
  g.night({ a01: { kind: 'hit', target: 'a02', place: 'junkyard' }, a02: { kind: 'hit', target: 'a03', place: 'junkyard' } });
  assert.ok(g.s.agents.a01.jail);
  assert.equal(g.s.copies[loot].holder.k, 'vault', 'the stolen rare was the rarest piece on it');
});

test('a hit can\'t find an agent laying low: it\'s home, not out (§6, §7)', () => {
  const g = new Game({ n: 3 });
  g.grant('a02', 100);
  const r = g.night({ a01: { kind: 'hit', target: 'a02', place: 'suburbs' }, a02: { kind: 'laylow' } });
  assert.equal(r.fights.fights.length, 0);
  assert.equal(r.fights.missed[0].target, 'a02');
});

test('crews are up to 4 (§12, §38); a sit-down can be refused (§14)', () => {
  const g = new Game({ n: 6 });
  g.errand('a01', 'crew_form', { name: 'crew' });
  for (const id of ['a02', 'a03', 'a04']) {
    g.errand('a01', 'crew_invite', { agent: id });
    assert.equal(g.errand(id, 'crew_join', { crew: 'c1' }).ok, true);
  }
  assert.equal(g.errand('a01', 'crew_invite', { agent: 'a05' }).ok, false, 'a fifth');
  assert.deepEqual(g.s.crews.c1.members, ['a01', 'a02', 'a03', 'a04']);
  g.errand('a05', 'ask', { to: 'a06' });
  const sd = Object.keys(g.s.sitdowns).at(-1);
  g.errand('a06', 'answer', { sitdown: sd, accept: false });
  assert.equal(g.s.sitdowns[sd].state, 'declined');
  assert.equal(g.errand('a05', 'say', { sitdown: sd, say: 'offer', terms: {} }).ok, false);
  assert.ok(!g.events('meet').some(e => e.sitdown === sd), 'no meeting to show');
});

test('on the last night, backing someone means walking with it (§15)', () => {
  const g = new Game({ n: 4 });
  g.advanceTo(14);
  g.hand('a02', abilityCopy(g.s, 'knuckles'), { wear: true });
  // R4-2 (gap.accept): a01 accepts the agent walking with it.
  const r = g.night({ a01: { kind: 'board', place: 'industrial', accept: ['a03'] }, a03: { kind: 'back', target: 'a01' }, a02: { kind: 'hit', target: 'a01', place: 'industrial' } });
  const f = fightOn(r, 'a01');
  assert.equal(f.defence, 2, 'a01 and the agent walking with it');
  assert.equal(f.won, false, '2 against 2: the defender holds');
});
