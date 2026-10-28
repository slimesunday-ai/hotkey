// R3-2c (trunk docs/briefs/R3-crime-pays.md, task 5): two things before an R3 switch goes on by default.
// - The hold-up's value hole (the R3-2 review): a won hit booked its target's pay to the robber at the take, but a
//   collar's arrest comes after the take, and step 4 pays nobody arrested tonight, so a worker held up and collared the
//   same night had a wage booked to the robber that nobody paid, and a Dealer kept its doses while the robber had their
//   street price. checkLedger counts cash and goods apart, so it never saw it. The invariant: the robber gets pay that
//   was paid, or, if the target's work pays nothing tonight, what a hit takes with the switch off; never both, never
//   value from nothing; and the night's books tie to its events.
// - The narrow jump (gap.jump 'alone'): §7's "a hit beats an agent out working alone, if the hitter picked the right
//   district", as a tie that a hit on such an agent wins. Out working: §7's Work play, away from home (a shift, a
//   Smuggler's run, cooking at a lab, dealing, a Cop's patrol or guarding the vault). Alone: nobody else on its side in
//   the fight (§8): no backer, no city cops (a heavy district, a wanted attacker, a tip), no patrol.
// Each test sets every switch it reads, reads every amount from N, and puts the switches back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy, tierCopy } from './helpers.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { cornerTakings } from '../rules/market.mjs';
import { DRUGS } from '../rules/state.mjs';
import { N } from '../numbers.mjs';
import { rng } from '../rng.mjs';

// Runs fn with N[key] set to value, then puts the old value back.
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
const of = (r, type, pred = () => true) => r.newEvents.find(e => e.type === type && pred(e));
const all = (r, type, pred = () => true) => r.newEvents.filter(e => e.type === type && pred(e));
const knuckles = (g, id) => g.hand(id, abilityCopy(g.s, 'knuckles'), { wear: true });
const sum = xs => xs.reduce((t, x) => t + x, 0);
const books = s => JSON.parse(JSON.stringify({ money: s.money, goods: s.goods }));
// The fields of a take that say what it took.
const takeOf = e => e && { leader: e.leader, target: e.target, copy: e.copy, cash: e.cash, value: e.value, goods: e.goods || {} };

// The night's books against its events (§9, §23): every dollar a work source paid in is pay a work event reports (the
// wage to each agent the work event lists, a Dealer's takings on its sale, a Cop's wage on its patrol or guard event),
// each sale's cash is what its doses fetch on its corner, and every dose the street took is a dose a sale reports sold.
// Each entry is [the books, the events].
function workBooks(before, s, r) {
  const cashIn = k => (s.money.in[k] || 0) - (before.money.in[k] || 0);
  const out = s.goods.out.street || {};
  const was = before.goods.out.street || {};
  const sales = all(r, 'sale');
  return {
    // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the night's work event (one wage times its agents) is now each hustler's hustle event, its take each.
    'shift wages': [cashIn('hustle'), sum(all(r, 'hustle').map(e => e.take))],
    'street cash': [cashIn('street'), sum(sales.map(e => e.cash))],
    'takings for the doses sold': [sum(sales.map(e => e.cash)), sum(sales.map(e => cornerTakings(e.doses, e.hot)))],
    'doses to the street': [sum(DRUGS.map(d => (out[d] || 0) - (was[d] || 0))), sum(sales.map(e => e.doses))],
    'patrol wages': [cashIn('patrol'), sum(all(r, 'patrol').map(e => e.wage))],
    'guard wages': [cashIn('guard'), sum(all(r, 'guard').map(e => e.wage))],
  };
}
function assertBooks(b, label) {
  for (const [k, [inBooks, inEvents]] of Object.entries(b)) assert.equal(inBooks, inEvents, `${label}: ${k}, the books against the night's events`);
}

test("gap.holdup 'pay': a wanted Dealer held up and collared the same night deals nothing, so the hit takes what it takes with the switch off, its doses, and the street pays nothing; held up and not collared, it deals and the robber takes the takings (§7, §9, §13)", () => {
  const corner = Object.keys(N.corners).find(c => N.corners[c].place === 'strip' && N.corners[c].hot);
  const play = (holdup, collar) => withN({ 'gap.holdup': holdup }, () => {
    const g = new Game({ n: 4 });
    g.s.agents.a01.trade = 'dealer';
    g.s.agents.a03.trade = 'cop';
    stock(g, 'a01', 'temp', N.deal.cap);
    // Wanted, so a Cop can collar it (§13).
    g.s.agents.a01.heat = N.wantedAt;
    knuckles(g, 'a02');
    const before = books(g.s);
    const r = g.night({
      a01: { kind: 'deal', corner },
      a02: { kind: 'hit', target: 'a01', place: 'strip' },
      a03: collar ? { kind: 'collar', target: 'a01', place: 'strip' } : { kind: 'laylow' },
      a04: { kind: 'laylow' },
    }, { exact: true });
    return { g, r, before, rob: of(r, 'rob', e => e.leader === 'a02') };
  });
  const off = play('off', true);
  const pay = play('pay', true);
  assert.ok(pay.g.s.agents.a01.jail, 'the collar wins: the Cop and the city cops, 1 + 2 against 1 on Neon Row (§13)');
  assert.ok(pay.rob, 'the hit wins: 2 against 1');
  assert.deepEqual(pay.rob.goods, { temp: N.deal.cap }, 'the hit takes the doses it carries (§7)');
  assert.equal(pay.rob.cash, 0, 'and no takings: a Dealer arrested tonight deals nothing');
  assert.deepEqual(takeOf(pay.rob), takeOf(off.rob), 'the take is the switch-off take');
  assert.equal(of(pay.r, 'robbed', e => e.agent === 'a01').cash, 0, 'what the Dealer hears it lost');
  assert.equal(all(pay.r, 'sale').length, 0, 'no sale');
  assert.deepEqual(books(pay.g.s), books(off.g.s), "the island's cash and goods books are the switch-off night's");
  assert.equal(pay.g.s.agents.a02.cash, off.g.s.agents.a02.cash, "the robber's cash");
  assert.deepEqual(pay.g.s.agents.a02.goods, off.g.s.agents.a02.goods, "the robber's goods");
  assert.deepEqual(pay.g.s.agents.a01.goods, {}, 'the Dealer goes to jail with nothing to deal');
  assertBooks(workBooks(pay.before, pay.g.s, pay.r), 'collared');
  // Not collared: it deals, the street pays it its takings, and the robber takes them in place of the doses.
  const free = play('pay', false);
  const takings = cornerTakings(N.deal.cap, true);
  const sale = of(free.r, 'sale', e => e.agent === 'a01');
  assert.equal(sale.doses, N.deal.cap, 'the Dealer deals its doses');
  assert.equal(sale.cash, takings, 'the street pays for them');
  assert.equal(free.rob.cash, takings, 'the robber takes the takings');
  assert.deepEqual(free.rob.goods || {}, {}, 'and no doses');
  assert.equal(of(free.r, 'robbed', e => e.agent === 'a01').cash, takings, 'what the Dealer hears it lost');
  assertBooks(workBooks(free.before, free.g.s, free.r), 'not collared');
});

test("gap.holdup 'pay': a wanted shift worker held up and collared the same night is paid no wage, so the hit takes what it takes with the switch off and no wage is booked; held up and not collared, it's paid and the robber takes the wage (§7, §9, §13)", () => {
  const play = (holdup, collar) => withN({ 'gap.holdup': holdup }, () => {
    const g = new Game({ n: 3 });
    g.s.agents.a03.trade = 'cop';
    g.s.agents.a01.heat = N.wantedAt;
    knuckles(g, 'a02');
    const before = books(g.s);
    const r = g.night({
      a01: { kind: 'hustle', place: 'docks' },
      a02: { kind: 'hit', target: 'a01', place: 'docks' },
      a03: collar ? { kind: 'collar', target: 'a01', place: 'docks' } : { kind: 'laylow' },
    }, { exact: true });
    return { g, r, before, rob: of(r, 'rob', e => e.leader === 'a02') };
  });
  const off = play('off', true);
  const pay = play('pay', true);
  assert.ok(pay.g.s.agents.a01.jail, 'the collar wins: 1 + 2 against 1 at the docks (§13)');
  assert.ok(pay.rob, 'the hit wins: 2 against 1');
  assert.equal(pay.rob.cash, 0, 'no wage to take: a worker arrested tonight is paid nothing (§13)');
  assert.deepEqual(takeOf(pay.rob), takeOf(off.rob), 'the take is the switch-off take');
  assert.equal(of(pay.r, 'robbed', e => e.agent === 'a01').cash, 0, 'what the worker hears it lost');
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the work event's agents are now the agents with a hustle event, and its wage their take.
  assert.ok(!of(pay.r, 'hustle', e => e.agent === 'a01'), 'it was not paid');
  assert.deepEqual(books(pay.g.s), books(off.g.s), "the island's cash and goods books are the switch-off night's");
  assert.equal(pay.g.s.agents.a02.cash, off.g.s.agents.a02.cash, "the robber's cash");
  assertBooks(workBooks(pay.before, pay.g.s, pay.r), 'collared');
  // Not collared: it's paid the wage, and the robber takes it.
  const free = play('pay', false);
  const work = of(free.r, 'hustle', e => e.agent === 'a01');
  assert.ok(work, 'it worked the shift and was paid');
  assert.equal(free.rob.cash, work.take, 'the robber takes the wage');
  assert.equal(of(free.r, 'robbed', e => e.agent === 'a01').cash, work.take, 'what the worker hears it lost');
  assertBooks(workBooks(free.before, free.g.s, free.r), 'not collared');
});

test("gap.holdup 'pay': a wanted Cop held up on patrol and collared the same night is paid no wage, and the hit takes what it takes with the switch off (§7, §13)", () => {
  const play = (holdup, collar) => withN({ 'gap.holdup': holdup }, () => {
    const g = new Game({ n: 3 });
    g.s.agents.a01.trade = 'cop';
    g.s.agents.a03.trade = 'cop';
    g.s.agents.a01.heat = N.wantedAt;
    knuckles(g, 'a02');
    const before = books(g.s);
    const r = g.night({
      a01: { kind: 'patrol', place: 'docks' },
      a02: { kind: 'hit', target: 'a01', place: 'docks' },
      a03: collar ? { kind: 'collar', target: 'a01', place: 'docks' } : { kind: 'laylow' },
    }, { exact: true });
    return { g, r, before, rob: of(r, 'rob', e => e.leader === 'a02') };
  });
  const off = play('off', true);
  const pay = play('pay', true);
  assert.ok(pay.g.s.agents.a01.jail, 'the collar wins');
  assert.ok(pay.rob, 'the hit wins: the Cop it attacks joins no fight but its own');
  assert.equal(pay.rob.cash, 0, 'no wage to take');
  assert.deepEqual(books(pay.g.s), books(off.g.s), "the island's books are the switch-off night's");
  assertBooks(workBooks(pay.before, pay.g.s, pay.r), 'collared');
  const free = play('pay', false);
  assert.equal(free.rob.cash, N.copPay.patrol, 'not collared, the robber takes the patrol wage');
  assertBooks(workBooks(free.before, free.g.s, free.r), 'not collared');
});

// One hit on a01 at `place`, a02 the hitter; `set(g)` dresses the night, `plays` are the other plays.
function hitNight(jump, place, a01Play, set = () => {}, plays = {}, n = 2) {
  return withN({ 'gap.jump': jump }, () => {
    const g = new Game({ n });
    set(g);
    const r = g.night({ a01: a01Play, a02: { kind: 'hit', target: 'a01', place }, ...plays }, { filler: { kind: 'laylow' } });
    return { g, r, f: of(r, 'fight', e => e.kind === 'hit' && e.target === 'a01') };
  });
}

test("gap.jump 'alone': a hit on an agent out working alone wins the tie (§7: \"a hit beats an agent out working alone, if the hitter picked the right district\"); off, the tie holds (§8); either way every strength is §8's count", () => {
  const corner = Object.keys(N.corners).find(c => N.corners[c].place === 'strip');
  // Each of §7's Work plays away from home, alone, where no city cops come: a lone hitter, 1 against 1.
  const works = [
    ['a shift', 'docks', { kind: 'hustle', place: 'docks' }, () => {}],
    ["a Smuggler's run", 'junkyard', { kind: 'run', place: 'junkyard' }, () => {}],
    ['cooking at the lab', 'forest', { kind: 'cook', place: 'forest', batches: 1 }, g => {
      g.s.agents.a01.trade = 'chemist';
      stock(g, 'a01', 'chems', N.cook.chems);
    }],
    ['dealing', 'strip', { kind: 'deal', corner }, g => {
      g.s.agents.a01.trade = 'dealer';
      stock(g, 'a01', 'temp', N.deal.cap);
    }],
    ['a patrol', 'docks', { kind: 'patrol', place: 'docks' }, g => {
      g.s.agents.a01.trade = 'cop';
    }],
  ];
  for (const jump of [0, 'alone']) {
    for (const [what, place, p, set] of works) {
      const { f } = hitNight(jump, place, p, set);
      assert.ok(f, `${what}: the hit finds it`);
      assert.equal(f.sides[0].strength, 1, `${what}: a lone hitter is 1 (§8)`);
      assert.equal(f.defence, 1, `${what}: a lone worker is 1, with no cops`);
      assert.equal(f.won, jump === 'alone', `${what}, gap.jump ${jump}: ${jump === 'alone' ? 'the hitter wins the tie' : 'the tie holds'}`);
    }
  }
});

test("gap.jump 'alone': a tie still holds when anyone else is on the worker's side (a backer, a patrol, the city cops of a heavy district, a wanted hitter or a tip) or the target isn't out working (it's hitting, or backing) (§7, §8)", () => {
  withN({ 'gap.jump': 'alone' }, () => {
    const shift = { kind: 'hustle', place: 'docks' };
    // R4-2 (gap.accept): each backer's leader accepts it: the worker its backer, the hitter its own.
    const hitter = { kind: 'hit', target: 'a01', place: 'docks', accept: ['a03'] };
    const cases = [
      ['a backer', 'docks', { ...shift, accept: ['a03'] }, g => knuckles(g, 'a02'), { a03: { kind: 'back', target: 'a01' } }, 2],
      ['a patrol', 'docks', shift, g => {
        knuckles(g, 'a02');
        g.s.agents.a03.trade = 'cop';
      }, { a03: { kind: 'patrol', place: 'docks' } }, 2],
      ['a heavy district', 'downtown', { kind: 'hustle', place: 'downtown' }, g => knuckles(g, 'a02'), {}, 2],
      ['a wanted hitter', 'docks', shift, g => {
        knuckles(g, 'a02');
        g.s.agents.a02.heat = N.wantedAt;
      }, { a02: hitter, a03: { kind: 'back', target: 'a02' } }, 3],
      ['a tip', 'docks', shift, g => {
        knuckles(g, 'a02');
        g.errand('a04', 'tip', { agent: 'a02', target: 'a01' });
      }, { a02: hitter, a03: { kind: 'back', target: 'a02' } }, 3],
      ['the target out on a hit', 'docks', { kind: 'hit', target: 'a03', place: 'docks' }, () => {}, { a03: shift }, 1],
      ['the target backing', 'docks', { kind: 'back', target: 'a03' }, () => {}, { a03: { ...shift, accept: ['a01'] } }, 1],
    ];
    for (const [what, place, p, set, plays, tie] of cases) {
      const { f } = hitNight('alone', place, p, set, plays, 4);
      assert.ok(f, `${what}: the hit finds it`);
      assert.equal(f.sides[0].strength, tie, `${what}: the hitting group's strength`);
      assert.equal(f.defence, tie, `${what}: a tie`);
      assert.equal(f.won, false, `${what}: the tie holds`);
    }
  });
});

test("gap.jump 'alone': §8's worked hits come out as written (§8's table)", () => {
  // The table's takes are §7's as written, so the hold-up is off here.
  withN({ 'gap.jump': 'alone', 'gap.holdup': 'off' }, () => {
    const gun = (g, id) => stock(g, id, 'guns', 1);
    const dealer = g => {
      g.s.agents.a01.trade = 'dealer';
      stock(g, 'a01', 'temp', N.deal.cap);
    };
    const on = place => ({ kind: 'deal', corner: Object.keys(N.corners).find(c => N.corners[c].place === place) });
    // "You, with a gun, hit a Dealer working alone on Neon Row | 2 | 1 | You take its rarest piece and its doses."
    let x = hitNight('alone', 'strip', on('strip'), g => {
      dealer(g);
      gun(g, 'a02');
    });
    assert.deepEqual([x.f.sides[0].strength, x.f.defence, x.f.won], [2, 1, true], 'Neon Row');
    assert.deepEqual(of(x.r, 'rob', e => e.leader === 'a02').goods, { temp: N.deal.cap }, 'and its doses');
    // "The same hit, on a Dealer in Glasswall (heavy) | 2 | 1 + 1 | A tie: the Dealer holds."
    x = hitNight('alone', 'downtown', on('downtown'), g => {
      dealer(g);
      gun(g, 'a02');
    });
    assert.deepEqual([x.f.sides[0].strength, x.f.defence, x.f.won], [2, 1 + N.copsHeavy, false], 'Glasswall');
    // "You're wanted, and you and 2 backers hit an agent alone in The Yards (normal) | 3 | 1 + city cops 2 = 3 | A tie:
    // you lose, and all three of you are arrested."
    // R4-2 (gap.accept): the hitter accepts its two backers.
    const trio = place => ({ a02: { kind: 'hit', target: 'a01', place, accept: ['a03', 'a04'] }, a03: { kind: 'back', target: 'a02' }, a04: { kind: 'back', target: 'a02' } });
    x = hitNight('alone', 'industrial', { kind: 'hustle', place: 'industrial' }, g => {
      g.s.agents.a02.heat = N.wantedAt;
    }, trio('industrial'), 4);
    assert.deepEqual([x.f.sides[0].strength, x.f.defence, x.f.won], [3, 1 + N.copsWanted, false], 'The Yards');
    assert.deepEqual(all(x.r, 'arrest').map(e => e.agent).sort(), ['a02', 'a03', 'a04'], 'all three arrested');
    // "The same hit in The Heap (lawless) | 3 | 1 | No cops come. You win."
    x = hitNight('alone', 'junkyard', { kind: 'run', place: 'junkyard' }, g => {
      g.s.agents.a02.heat = N.wantedAt;
    }, trio('junkyard'), 4);
    assert.deepEqual([x.f.sides[0].strength, x.f.defence, x.f.won], [3, 1, true], 'The Heap');
  });
});

test("gap.jump 'alone': with everyone's backers gone the target is alone, so a backer that keeps a lone hitter off a worker decided the fight (§27, the backing rules)", () => {
  for (const jump of [0, 'alone']) {
    // R4-2 (gap.accept): the worker accepts its backer.
    const { f } = hitNight(jump, 'docks', { kind: 'hustle', place: 'docks', accept: ['a03'] }, () => {}, { a03: { kind: 'back', target: 'a01' } }, 3);
    assert.deepEqual([f.sides[0].strength, f.defence, f.won], [1, 2, false], `gap.jump ${jump}: 1 against the worker and its backer`);
    assert.equal(f.backingDecided, jump === 'alone', `gap.jump ${jump}: alone, the worker ${jump === 'alone' ? 'loses the tie' : 'holds the tie'}`);
  }
});

test("gap.jump 'alone' never helps a break-in, a collar or a corner: a lone burglar ties an empty home's lock, a lone Cop ties a lone worker it collars where no city cops come, and two lone Dealers tie on an open corner (§8, §9, §13)", () => {
  withN({ 'gap.jump': 'alone' }, () => {
    let g = new Game({ n: 3 });
    g.grant('a01', 100);
    let r = g.night({ a01: { kind: 'hustle', place: 'docks' }, a02: { kind: 'breakin', target: 'a01' } }, { filler: { kind: 'laylow' } });
    const b = of(r, 'fight', e => e.kind === 'breakin');
    assert.deepEqual([b.sides[0].strength, b.defence, b.won], [1, 1, false], 'the break-in');
    g = new Game({ n: 3 });
    g.s.agents.a02.trade = 'cop';
    g.s.agents.a01.heat = N.wantedAt;
    r = g.night({ a01: { kind: 'run', place: 'junkyard' }, a02: { kind: 'collar', target: 'a01', place: 'junkyard' } }, { filler: { kind: 'laylow' } });
    const c = of(r, 'fight', e => e.kind === 'collar');
    assert.deepEqual([c.sides[0].strength, c.defence, c.won], [1, 1, false], 'the collar in The Heap (lawless)');
    g = new Game({ n: 3 });
    for (const id of ['a01', 'a02']) {
      g.s.agents[id].trade = 'dealer';
      stock(g, id, 'temp', N.deal.cap);
    }
    const corner = Object.keys(N.corners).find(k => N.corners[k].place === 'strip');
    r = g.night({ a01: { kind: 'deal', corner }, a02: { kind: 'deal', corner } }, { filler: { kind: 'laylow' } });
    assert.equal(of(r, 'fight', e => e.kind === 'corner').won, false, 'the open corner');
    assert.equal(all(r, 'sale', e => e.doses > 0).length, 0, 'nobody deals');
  });
});

test("gap.jump takes 'alone' as well as a whole number, and stops the night on anything else (numbers.mjs)", () => {
  withN({ 'gap.jump': 'alone' }, () => {
    const g = new Game({ n: 2 });
    assert.doesNotThrow(() => g.night());
  });
  withN({ 'gap.jump': 'lonely' }, () => {
    const g = new Game({ n: 2 });
    assert.throws(() => g.night(), /gap\.jump/);
  });
});

test("gap.jump 'alone', the crime cast's robber: alone and unarmed, it hits a worker its view shows working alone where it last saw it, and passes on one its view shows backed, in a heavy district or with a Cop seen there (§7, §8, §19)", async () => {
  const { robberPlay } = await import('../bench/bots.mjs');
  const scout = { type: 'scout', layer: 2, sharp: true };
  // Three nights of a routine, so the show has seen it on each and its plays have gone public (§19: a day late).
  const seen = (company, place = 'docks') => {
    const g = new Game({ n: 4 });
    // A Cop to patrol, and a backer whose trade carries nothing a hit would take (goodsCarried).
    g.s.agents.a04.trade = 'cop';
    g.s.agents.a03.trade = 'gunrunner';
    g.hand('a01', tierCopy(g.s, 'rare'), { wear: true });
    // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the others hold three nights' rent, so they lie low at home as written: with $0 they were evicted, and the evicted default, now a hustle at the lawless Mall, put them in the robber's reach, where the shift in heavy Glasswall had not; the robber's floor, night 3's work event's wage (or N.hustleBase, $50, with none), is a01's hustle event's take that night.
    for (const id of ['a02', 'a03', 'a04']) g.grant(id, 3 * N.rent);
    for (let night = 1; night <= 3; night++) {
      // R4-2 (gap.accept): the worker accepts its backer, so it really is backed.
      g.night({
        a01: { kind: 'hustle', place, ...(company === 'backer' ? { accept: ['a03'] } : {}) },
        a02: { kind: 'laylow' },
        a03: company === 'backer' ? { kind: 'back', target: 'a01' } : { kind: 'laylow' },
        a04: company === 'cop' ? { kind: 'patrol', place } : { kind: 'laylow' },
      }, { exact: true });
    }
    return g;
  };
  for (const [jump, company, place, want] of [
    [0, null, 'docks', null], ['alone', null, 'docks', 'a01'], ['alone', 'backer', 'docks', null], ['alone', null, 'downtown', null], ['alone', 'cop', 'docks', null],
  ]) {
    // The nights have no fight, so they play the same under any jump; the robber reckons tonight under this one.
    const g = withN({ 'gap.jump': 0 }, () => seen(company, place));
    const v = g.view('a02');
    const wage = of({ newEvents: g.log }, 'hustle', e => e.night === 3 && e.agent === 'a01') || { take: 50 };
    withN({ 'gap.jump': jump }, () => {
      const p = robberPlay(v, rng(404, 'r3-2c', 'a02', v.day), scout, 1, false, null, wage.take);
      const label = `gap.jump ${jump}, ${company || 'alone'} in ${place}`;
      assert.equal(p ? p.play.target : null, want, label);
      if (want) assert.deepEqual([p.play.kind, p.play.place], ['hit', place], label);
    });
  }
});
