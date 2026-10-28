// R11, hustles replace the shift (docs/briefs/R11-hustles.md; slime, 10-21: "they should be robbing npcs, doing crime,
// things that are actually entertaining to watch"; "let's just do that, and run the tests after to save movey").
// A hustle is small-time crime against the city's own people, any night but the last, in any district: it takes
// N.hustle.take for the district's police level tonight, less N.hustle.crowd for each other agent hustling there, never
// below N.hustle.floor, doubled on Payday; it adds a star (N.workHeat) where the district is normal or heavy tonight, or
// a Cop patrols it; it's out working; and its take, district and kind (`how`) are on a public `hustle` event.
// Every amount here is read from N, so a tuning of N.hustle moves no assertion. Nothing here calls a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';
import { DISTRICTS, HUSTLE_HOW, hustleTake, hustleStar, LAST_NIGHT } from '../rules/state.mjs';
import { legalPlays, checkPlay, defaultPlay } from '../rules/plays.mjs';
import { worksOut } from '../rules/fights.mjs';

const H = N.hustle;
const LAY = { kind: 'laylow', place: 'suburbs' };
const hustle = place => ({ kind: 'hustle', place });
const hustleOf = (r, id) => r.newEvents.find(e => e.type === 'hustle' && e.agent === id);
// A season whose agents have the trades named, in id order (the helpers' cast is all Smugglers).
function withTrades(trades, { midseason = 'blackout' } = {}) {
  const g = new Game({ n: 1 });
  const agents = trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' }));
  const r = newSeason({ seed: 404, rule: 'A', midseason, items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
// The rent for the whole season, so nobody named is evicted by a test that plays several nights.
const housed = g => Object.keys(g.s.agents).forEach(id => g.grant(id, 2 * N.nights * N.rent));

test('the take: the level tonight, less the crowd for each other hustler in the district, never below the floor (N.hustle)', () => {
  const g = new Game({ n: 6 });
  assert.deepEqual([g.s.districts.downtown.level, g.s.districts.strip.level, g.s.districts.mall.level], ['heavy', 'normal', 'lawless']);
  const r = g.night({ a01: hustle('downtown'), a02: hustle('strip'), a03: hustle('strip'), a04: hustle('mall') }, { filler: LAY });
  assert.equal(hustleOf(r, 'a01').take, H.take.heavy, 'alone in heavy Glasswall');
  assert.equal(hustleOf(r, 'a02').take, H.take.normal - H.crowd, 'two in normal Neon Row: one other');
  assert.equal(hustleOf(r, 'a03').take, H.take.normal - H.crowd);
  assert.equal(hustleOf(r, 'a04').take, H.take.lawless, 'alone in the lawless Mall');
  assert.equal(hustleOf(r, 'a02').crowd, 1);
  assert.equal(r.newEvents.filter(e => e.type === 'hustle').length, 4, 'one event a hustler, nobody else');
  assert.equal(g.s.money.in.hustle, H.take.heavy + 2 * (H.take.normal - H.crowd) + H.take.lawless, "the hustles' source on the island's books");
  // Paid at step 4, before dawn's rent.
  assert.equal(g.s.agents.a01.cash, H.take.heavy - N.rent);

  const crowded = new Game({ n: 12 });
  const all = Object.fromEntries(Object.keys(crowded.s.agents).map(id => [id, hustle('mall')]));
  const c = crowded.night(all, { exact: true });
  assert.ok(H.take.lawless - 11 * H.crowd < H.floor, 'eleven others would take it under the floor');
  for (const e of c.newEvents.filter(x => x.type === 'hustle')) assert.equal(e.take, H.floor, 'never below the floor');
});

test('the take in the rules is state.mjs hustleTake, the one owner the bots and the briefing read', () => {
  for (const level of ['lawless', 'normal', 'heavy']) {
    for (const crowd of [0, 1, 3, 20]) {
      assert.equal(hustleTake(level, crowd), Math.max(H.floor, H.take[level] - H.crowd * crowd));
      assert.equal(hustleTake(level, crowd, true), 2 * Math.max(H.floor, H.take[level] - H.crowd * crowd), 'Payday doubles it');
    }
  }
});

test('Payday doubles the take on night 7, as it doubled the shift\'s wage; the other midseason events set the level', () => {
  const pay = new Game({ n: 3, midseason: 'payday' });
  housed(pay);
  for (let n = 1; n < 7; n++) pay.night({}, { filler: LAY });
  const r = pay.night({ a01: hustle('downtown') }, { filler: LAY });
  assert.equal(hustleOf(r, 'a01').take, 2 * H.take.heavy, 'Payday');
  assert.equal(hustleOf(pay.night({ a01: hustle('downtown') }, { filler: LAY }), 'a01').take, H.take.heavy, 'night 8 is ordinary');

  const dark = new Game({ n: 3, midseason: 'blackout' });
  housed(dark);
  for (let n = 1; n < 7; n++) dark.night({}, { filler: LAY });
  const b = dark.night({ a01: hustle('downtown') }, { filler: LAY });
  assert.deepEqual([hustleOf(b, 'a01').level, hustleOf(b, 'a01').take], ['lawless', H.take.lawless], 'a Blackout makes Glasswall lawless tonight');
  assert.equal(dark.s.agents.a01.heat, 0, 'and so it adds no star');
});

test('the star: none in a lawless district, one in a normal or heavy one, one where a Cop patrols, never more than one', () => {
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler', 'cop', 'cop', 'smuggler']);
  housed(g);
  const r = g.night({
    a01: hustle('mall'), a02: hustle('strip'), a03: hustle('downtown'), a04: hustle('forest'),
    a05: { kind: 'patrol', place: 'forest' }, a06: { kind: 'patrol', place: 'docks' }, a07: hustle('docks'),
  }, { exact: true });
  const heat = id => g.s.agents[id].heat;
  assert.equal(heat('a01'), 0, 'lawless: no star');
  assert.equal(heat('a02'), N.workHeat, 'normal: one');
  assert.equal(heat('a03'), N.workHeat, 'heavy: one');
  assert.equal(heat('a04'), N.workHeat, 'lawless, but a Cop patrols it: one');
  assert.equal(heat('a07'), N.workHeat, 'normal and patrolled: still one');
  assert.equal(hustleStar('lawless'), 0);
  assert.equal(hustleStar('lawless', true), N.workHeat);
  assert.equal(hustleStar('heavy', true), N.workHeat);
  const wanted = r.newEvents.filter(e => e.type === 'heat');
  assert.ok(wanted.every(e => e.heat - e.was <= N.workHeat), 'one star at most from a hustle');

  // A night that adds no star cools, as for anyone (§13): the lawless hustle, unpatrolled, takes one off.
  g.night({ a02: hustle('mall'), a03: LAY }, { filler: LAY });
  assert.equal(heat('a02'), N.workHeat - N['gap.cool'], 'a lawless hustle with no patrol cools a star');
  assert.equal(heat('a03'), 0, 'laying low cools two');

  // Three nights running in a normal district make a hustler wanted.
  const w = new Game({ n: 2 });
  housed(w);
  for (let n = 1; n <= N.wantedAt; n++) w.night({ a01: hustle('strip') }, { filler: LAY });
  assert.equal(w.s.agents.a01.heat, N.wantedAt);
  assert.ok(w.view('a02').board.agents.find(a => a.id === 'a01').wanted, 'wanted, on the board');
});

test('hustles are work heat, not crimes: a crowd of them in one district leaves its police level where it was', () => {
  const g = new Game({ n: 6 });
  housed(g);
  const all = Object.fromEntries(Object.keys(g.s.agents).map(id => [id, hustle('strip')]));
  g.night(all, { exact: true });
  assert.ok(Object.keys(all).length >= N.hotCrimes, 'more hustles there than the crimes that push a district');
  assert.equal(g.s.districts.strip.level, 'normal', 'Neon Row stays normal');
  assert.equal(g.s.districts.mall.level, 'lawless');
});

test('out working: a hit that finds a lone hustler wins the tie (gap.jump alone) and takes its take (gap.holdup pay)', () => {
  assert.ok(worksOut(hustle('mall')), 'a hustle is §7\'s Work away from home');
  const g = new Game({ n: 3 });
  const r = g.night({ a01: hustle('mall'), a02: { kind: 'hit', target: 'a01', place: 'mall' } }, { filler: LAY });
  const rob = r.newEvents.find(e => e.type === 'rob' && e.leader === 'a02');
  assert.ok(rob, 'the hit won the 1-1 tie on a hustler alone');
  assert.equal(rob.cash, hustleOf(r, 'a01').take, "the robber took tonight's take");
  assert.equal(g.s.agents.a01.cash, 0, 'the hustler kept nothing (and was evicted at dawn)');
  assert.equal(g.s.money.in.hustle, H.take.lawless, 'the hustle still paid, once, at the take');

  // A hit in the wrong district finds nobody, and a hustler paid nothing if a fight jails it tonight.
  const miss = new Game({ n: 3 });
  const m = miss.night({ a01: hustle('mall'), a02: { kind: 'hit', target: 'a01', place: 'forest' } }, { filler: LAY });
  assert.ok(!m.newEvents.some(e => e.type === 'rob'));
  assert.equal(hustleOf(m, 'a01').take, H.take.lawless);
});

test('flex pays a rare-or-better piece worn while hustling, doubled on Payday with the take', () => {
  const g = new Game({ n: 3 });
  g.hand('a01', tierCopy(g.s, 'rare'), { wear: true });
  const r = g.night({ a01: hustle('downtown') }, { filler: LAY });
  const flex = r.newEvents.find(e => e.type === 'flex' && e.agent === 'a01');
  assert.equal(flex.pay, N.flex.rare);
  assert.equal(g.s.agents.a01.cash, H.take.heavy + N.flex.rare - N.rent);

  const pay = new Game({ n: 3, midseason: 'payday' });
  housed(pay);
  pay.hand('a01', tierCopy(pay.s, 'rare'), { wear: true });
  for (let n = 1; n < 7; n++) pay.night({}, { filler: LAY });
  const p = pay.night({ a01: hustle('mall') }, { filler: LAY });
  assert.equal(p.newEvents.find(e => e.type === 'flex' && e.agent === 'a01').pay, 2 * N.flex.rare, 'Payday doubles flex');
  assert.equal(hustleOf(p, 'a01').take, 2 * H.take.lawless, 'and the take');
});

test('the default play of an evicted agent is a hustle at the Mall (gap.defaultPlay), and night 14 still boards through Glasswall', () => {
  const g = new Game({ n: 3 });
  g.night({ a01: hustle('mall') }, { filler: LAY });
  assert.ok(g.s.agents.a02.evicted, 'a02 laid low with no cash and was evicted at dawn');
  assert.deepEqual(defaultPlay(g.s, 'a02', g.s.day), hustle('mall'));
  assert.deepEqual(defaultPlay(g.s, 'a01', LAST_NIGHT), { kind: 'board', place: 'downtown' });
  assert.equal(N['gap.defaultPlay'], 'laylow | hustle mall | board downtown');
  // With no play, and with a play that can't stand, it hustles at the Mall: lawless, so no star.
  const r = g.night({ a02: undefined, a03: { kind: 'laylow', place: 'suburbs' } }, { exact: true });
  assert.deepEqual(r.newEvents.find(e => e.type === 'invalid' && e.agent === 'a03').instead, hustle('mall'), 'an evicted agent can\'t lay low');
  for (const id of ['a02', 'a03']) {
    const h = hustleOf(r, id);
    assert.deepEqual([h.place, h.how, h.level], ['mall', HUSTLE_HOW.mall, 'lawless']);
    assert.equal(g.s.agents[id].heat, 0, 'no star');
  }
});

test('the kind on the record (`how`) is the district\'s, for every district, on a public event', () => {
  assert.deepEqual(HUSTLE_HOW, {
    downtown: 'stickup', strip: 'mugging', industrial: 'crates', suburbs: 'cars',
    docks: 'boats', junkyard: 'scrap', mall: 'shoplift', forest: 'campers',
  });
  const g = new Game({ n: DISTRICTS.length + 1 });
  const plays = Object.fromEntries(DISTRICTS.map((d, i) => [idOf(i + 1), hustle(d)]));
  const r = g.night(plays, { filler: LAY });
  for (const [id, p] of Object.entries(plays)) {
    const e = hustleOf(r, id);
    assert.deepEqual([e.place, e.how, e.level, e.take], [p.place, HUSTLE_HOW[p.place], g.s.districts[p.place].level, hustleTake(e.level, 0)]);
    assert.equal(e.vis.to, 'all', 'public at once, as the shift\'s work event was');
  }
  // Another agent reads it live; nothing else names a shift.
  const seen = g.view(idOf(DISTRICTS.length + 1)).events.filter(e => e.type === 'hustle');
  assert.equal(seen.length, DISTRICTS.length);
  assert.ok(!g.log.some(e => e.type === 'work'), 'no shift event is left');
});

test('a hustle names a district: every district is legal any night but the last, and anything else is refused, typed', () => {
  const g = new Game({ n: 2 });
  const legal = legalPlays(g.s, 'a01').filter(p => p.kind === 'hustle');
  assert.deepEqual(legal.map(p => p.place), DISTRICTS, 'all eight districts');
  for (const d of DISTRICTS) assert.deepEqual(checkPlay(g.s, 'a01', hustle(d), 1), { ok: true, play: hustle(d) });
  for (const bad of [{ kind: 'hustle' }, hustle('moon'), hustle('Iron Island')]) {
    const r = checkPlay(g.s, 'a01', bad, 1);
    assert.deepEqual([r.ok, r.kind], [false, 'never']);
    assert.equal(r.why, 'a hustle names a district');
  }
  const last = checkPlay(g.s, 'a01', hustle('mall'), LAST_NIGHT);
  assert.deepEqual([last.ok, last.why], [false, 'no work on the last night']);
});

test('the play tool takes a hustle with a district, from the menu or written out, and refuses a bad district, typed', async () => {
  const { read, reply } = await import('../agents/tools.mjs');
  const g = new Game({ n: 2 });
  const { deal } = read(g.view('a01'), { audience: 'seat', seed: 404, from: 1 });
  const ctx = { deal, apply: () => ({ ok: true }), tries: {} };
  const lines = deal.menu.filter(m => m.kind === 'hustle');
  assert.deepEqual(lines.map(m => m.place), DISTRICTS, 'a line a district on the menu');
  const byMenu = reply({ actions: [{ act: 'play', menu: lines.find(m => m.place === 'forest').n }] }, ctx);
  assert.deepEqual(byMenu.play, hustle('forest'));
  const written = reply({ actions: [{ act: 'play', kind: 'hustle', place: 'junkyard' }] }, ctx);
  assert.deepEqual(written.play, hustle('junkyard'));
  const bad = reply({ actions: [{ act: 'play', kind: 'hustle', place: 'moon' }] }, ctx);
  assert.equal(bad.play, null);
  const why = bad.results.find(x => x.act === 'play');
  assert.deepEqual([why.ok, why.kind, why.code, why.status], [false, 'never', 'field', 'refused'], JSON.stringify(why));
  assert.equal(why.why, `place: one of ${DISTRICTS.join(', ')}`, 'it names the districts a hustle can name');
});

test('the starter rulebook says what a hustle takes by level and crowd, its floor and its star, and names no shift', async () => {
  const { starterRules, starterTrade } = await import('../agents/rulebook.mjs');
  const { read } = await import('../agents/tools.mjs');
  const g = withTrades(['smuggler', 'chemist', 'dealer', 'gunrunner', 'cop']);
  const v = read(g.view('a04'), { audience: 'seat', seed: 'r11', from: 1 }).result.view;
  const text = starterRules(v);
  for (const x of [H.take.lawless, H.take.normal, H.take.heavy, H.crowd, H.floor]) assert.ok(text.includes(`$${x}`), `$${x}`);
  assert.ok(/A hustle, in any district, robs the city's own people/.test(text));
  assert.ok(/\+1 for a hustle where the district isn't lawless or a Cop patrols/.test(text));
  assert.ok(text.includes('evicted, it hustles in mall'), 'the evicted default, from plays.mjs defaultPlay');
  assert.ok(!/shift/i.test(text), 'no shift is left in the rules');
  for (const t of ['smuggler', 'chemist', 'dealer', 'gunrunner', 'cop']) assert.ok(!/shift/i.test(starterTrade(t)));
});
