// R3-2's rule options (trunk docs/briefs/R3-crime-pays.md), each a switch in core/numbers.mjs: the hold-up
// (gap.holdup), the jump (gap.jump), the share of the cash a break-in takes (breakinShare), the purse (gap.purse),
// released for the ferry (gap.ferryJail), cooling (gap.cool) and an arrest's fine (gap.fine). Each test sets every value
// it tests, reads every amount from N, and puts the switch back, so none depends on a switch's default.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy } from './helpers.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { cornerTakings } from '../rules/market.mjs';
import { N } from '../numbers.mjs';

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
// Cash at dawn: the rent comes out if it covers it, else the agent is evicted and pays nothing (§10).
const afterRent = cash => (cash >= N.rent ? cash - N.rent : cash);
const knuckles = (g, id) => g.hand(id, abilityCopy(g.s, 'knuckles'), { wear: true });

test('gap.jump: a hit\'s attacking group adds gap.jump for picking its moment, so at 1 a lone hitter in the right district beats a lone worker; off (0) it ties and the worker holds (§7, §8)', () => {
  for (const jump of [0, 1]) {
    withN({ 'gap.jump': jump }, () => {
      const g = new Game({ n: 3 });
      const r = g.night({ a01: { kind: 'hustle', place: 'docks' }, a02: { kind: 'hit', target: 'a01', place: 'docks' } });
      const f = of(r, 'fight', e => e.kind === 'hit' && e.target === 'a01');
      assert.equal(f.sides[0].strength, 1 + N['gap.jump'], `jump ${jump}: the hitter's strength`);
      assert.equal(f.defence, 1, 'a lone worker at the docks (normal) defends at 1');
      assert.equal(f.won, 1 + N['gap.jump'] > 1, `jump ${jump}: ${jump ? 'it wins' : 'a tie holds'}`);
    });
  }
});

test('gap.jump never helps a break-in, a corner, a grab, a collar or the vault: a lone burglar still ties an empty home\'s lock (§8)', () => {
  withN({ 'gap.jump': 1 }, () => {
    const g = new Game({ n: 3 });
    g.grant('a01', 100);
    const r = g.night({ a01: { kind: 'hustle', place: 'docks' }, a02: { kind: 'breakin', target: 'a01' } });
    const f = of(r, 'fight', e => e.kind === 'breakin' && e.target === 'a01');
    assert.equal(f.sides[0].strength, 1, 'no jump on a break-in');
    assert.equal(f.won, false, '1 against the lock\'s 1 holds');
  });
});

test('gap.holdup \'pay\': a won hit on a shift worker takes its night\'s wage, and the worker isn\'t paid it; off, the worker keeps its wage (§7, §9)', () => {
  for (const holdup of ['off', 'pay']) {
    withN({ 'gap.holdup': holdup }, () => {
      const g = new Game({ n: 3 });
      knuckles(g, 'a02');
      const r = g.night({ a01: { kind: 'hustle', place: 'docks' }, a02: { kind: 'hit', target: 'a01', place: 'docks' } });
      // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the work event's wage is now a01's hustle event's take, and its agents the agents with a hustle event.
      const wage = of(r, 'hustle', e => e.agent === 'a01').take;
      const rob = of(r, 'rob', e => e.leader === 'a02');
      assert.ok(rob, 'the hit wins: 2 against 1');
      const taken = holdup === 'pay' ? wage : 0;
      assert.equal(rob.cash, taken, `${holdup}: the take's cash`);
      assert.equal(of(r, 'robbed', e => e.agent === 'a01').cash, taken, `${holdup}: what the worker hears it lost`);
      assert.equal(g.s.agents.a02.cash, afterRent(taken), `${holdup}: the robber's cash at dawn`);
      assert.equal(g.s.agents.a01.cash, afterRent(wage - taken), `${holdup}: the worker's cash at dawn`);
      assert.ok(of(r, 'hustle', e => e.agent === 'a01'), 'it still worked the shift');
    });
  }
});

test('gap.holdup \'pay\': a won hit on a Dealer takes the street\'s takings for its doses, which it deals, in place of the doses; off, the doses go (§7, §9)', () => {
  for (const holdup of ['off', 'pay']) {
    withN({ 'gap.holdup': holdup }, () => {
      const g = new Game({ n: 3 });
      g.s.agents.a01.trade = 'dealer';
      stock(g, 'a01', 'temp', N.deal.cap);
      knuckles(g, 'a02');
      const corner = Object.keys(N.corners).find(c => N.corners[c].place === 'strip' && N.corners[c].hot);
      const r = g.night({ a01: { kind: 'deal', corner }, a02: { kind: 'hit', target: 'a01', place: 'strip' } });
      const rob = of(r, 'rob', e => e.leader === 'a02');
      const sale = of(r, 'sale', e => e.agent === 'a01');
      assert.ok(rob, 'the hit wins: 2 against 1 on Neon Row (normal)');
      if (holdup === 'pay') {
        const takings = cornerTakings(N.deal.cap, true);
        assert.equal(sale.doses, N.deal.cap, 'the Dealer deals its doses');
        assert.equal(sale.cash, takings, 'the street pays for them');
        assert.equal(rob.cash, takings, 'the robber takes the takings');
        assert.deepEqual(rob.goods || {}, {}, 'and no doses');
        assert.equal(g.s.agents.a02.cash, afterRent(takings), 'the robber has them at dawn');
        assert.equal(g.s.agents.a01.cash, 0, 'the Dealer keeps none of it');
      } else {
        assert.deepEqual(rob.goods, { temp: N.deal.cap }, 'the doses it carried');
        assert.equal(rob.cash, 0);
        assert.equal(sale.doses, 0, 'nothing left to deal');
      }
    });
  }
});

test('gap.holdup \'pay\': a won hit on a patrolling Cop takes its wage (§7, §13)', () => {
  withN({ 'gap.holdup': 'pay' }, () => {
    const g = new Game({ n: 3 });
    g.s.agents.a01.trade = 'cop';
    knuckles(g, 'a02');
    const r = g.night({ a01: { kind: 'patrol', place: 'docks' }, a02: { kind: 'hit', target: 'a01', place: 'docks' } });
    const rob = of(r, 'rob', e => e.leader === 'a02');
    assert.ok(rob, 'the hit wins: the Cop it attacks joins no fight but its own');
    assert.equal(rob.cash, N.copPay.patrol);
    assert.equal(g.s.agents.a02.cash, afterRent(N.copPay.patrol));
    assert.equal(g.s.agents.a01.cash, 0, 'its wage went with the robber; it had nothing for the rent');
  });
});

test('breakinShare: a won break-in takes that share of the cash in the home, rounded down: §7\'s half at 0.5, all of it at 1 (§7)', () => {
  for (const share of [0.5, 1]) {
    withN({ breakinShare: share }, () => {
      const g = new Game({ n: 3 });
      g.grant('a01', 101);
      knuckles(g, 'a02');
      const r = g.night({ a01: { kind: 'hustle', place: 'docks' }, a02: { kind: 'breakin', target: 'a01' } });
      const burgle = of(r, 'burgle', e => e.leader === 'a02');
      assert.equal(burgle.cash, Math.floor(101 * N.breakinShare), `share ${share}`);
    });
  }
});

test('gap.fine \'stars\': an arrest\'s fine is bail\'s price for each bail star, never more than half the cash; \'half\' is §13\'s half (§13)', () => {
  for (const [fine, cash] of [['half', 1001], ['stars', 1001], ['stars', 101]]) {
    withN({ 'gap.fine': fine }, () => {
      const g = new Game({ n: 3 });
      g.grant('a01', cash);
      // Glasswall is heavy: 1 against 1 + 1, so the hit loses with cops in it, and a01 is arrested at 1 star (§6, §8).
      g.night({ a01: { kind: 'hit', target: 'a02', place: 'downtown' }, a02: { kind: 'hustle', place: 'downtown' } });
      const stars = g.s.agents.a01.jail.stars;
      const want = fine === 'half' ? Math.floor(cash / 2) : Math.min(Math.floor(cash / 2), stars * N.bailPerStar);
      assert.equal(g.s.vault.cash, want, `${fine}, $${cash}: the fine`);
      assert.equal(g.events('seized', e => e.agent === 'a01')[0].fine, want);
    });
  }
});

test('gap.purse \'half\': a won hit takes half the cash its target holds on any night, as §7 has it take on the last night; off, none (§7)', () => {
  for (const purse of ['off', 'half']) {
    withN({ 'gap.purse': purse, 'gap.holdup': 'off' }, () => {
      const g = new Game({ n: 3 });
      g.grant('a01', 101);
      knuckles(g, 'a02');
      const r = g.night({ a01: { kind: 'hustle', place: 'docks' }, a02: { kind: 'hit', target: 'a01', place: 'docks' } });
      const rob = of(r, 'rob', e => e.leader === 'a02');
      assert.equal(rob.cash, purse === 'half' ? Math.floor(101 / 2) : 0, `${purse}: the take's cash`);
    });
  }
});

test('gap.purse with breakinShare 1: a hit and a break-in on one agent the same night take its cash once, the break-in first, the hit half of what it left (§7, §23 the ledger)', () => {
  withN({ 'gap.purse': 'half', breakinShare: 1, 'gap.holdup': 'off' }, () => {
    const g = new Game({ n: 4 });
    g.grant('a01', 101);
    knuckles(g, 'a02');
    knuckles(g, 'a03');
    const r = g.night({ a01: { kind: 'hustle', place: 'docks' }, a02: { kind: 'hit', target: 'a01', place: 'docks' }, a03: { kind: 'breakin', target: 'a01' } });
    assert.equal(of(r, 'burgle', e => e.leader === 'a03').cash, Math.floor(101 * N.breakinShare), 'the break-in lands first');
    assert.equal(of(r, 'rob', e => e.leader === 'a02').cash, Math.floor((101 - Math.floor(101 * N.breakinShare)) / 2), 'the hit takes half of what is left');
  });
});

test("gap.ferryJail 'released': everyone still in jail walks out at dawn on day 14 and boards, an arrest's seizure and fine standing; 'missed' is §15's missed boat (§13, §15)", () => {
  for (const ferry of ['missed', 'released']) {
    withN({ 'gap.ferryJail': ferry }, () => {
      const g = new Game({ n: 3 });
      g.grant('a01', 100);
      g.advanceTo(N.nights - N.jailNights);
      // Glasswall is heavy: a lone hitter loses with cops in it and is arrested on night 12, so its 2 nights in jail
      // run past the ferry (§13).
      g.night({ a01: { kind: 'hit', target: 'a02', place: 'downtown' }, a02: { kind: 'hustle', place: 'downtown' } });
      assert.ok(g.s.agents.a01.jail, 'arrested');
      g.night();
      assert.equal(!!g.s.agents.a01.jail, ferry === 'missed', `${ferry}: in jail at dawn on day ${N.nights}`);
      g.night();
      assert.equal(g.events('missed', e => e.agent === 'a01').length, ferry === 'missed' ? 1 : 0, `${ferry}: the boat`);
      assert.equal(g.events('mint', e => e.agent === 'a01').length, ferry === 'missed' ? 0 : 1);
    });
  }
});

test('gap.cool: the stars a night without a crime takes off, one more laying low; 1 is §13 as written (§13)', () => {
  for (const cool of [1, 2]) {
    withN({ 'gap.cool': cool }, () => {
      const g = new Game({ n: 3 });
      g.s.agents.a01.heat = 4;
      g.s.agents.a02.heat = 4;
      // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a01's quiet night out is a hustle at the Mall (lawless, no star), as its shift at the docks added none.
      g.night({ a01: { kind: 'hustle', place: 'mall' }, a02: { kind: 'laylow' } });
      assert.equal(g.s.agents.a01.heat, 4 - N['gap.cool'], `cool ${cool}: a quiet night out`);
      assert.equal(g.s.agents.a02.heat, Math.max(0, 4 - N['gap.cool'] - 1), `cool ${cool}: a night laying low`);
    });
  }
});

test('a value the rules don\'t know for an R3 switch stops the night before anything moves (numbers.mjs)', () => {
  for (const [key, bad] of [['gap.holdup', 'wages'], ['gap.jump', -1], ['breakinShare', 2], ['gap.fine', 'all'], ['gap.purse', 'all'], ['gap.ferryJail', 'never'], ['gap.cool', 0]]) {
    withN({ [key]: bad }, () => {
      const g = new Game({ n: 2 });
      assert.throws(() => g.night(), new RegExp(key.replace('.', '\\.')), `${key}=${bad}`);
    });
  }
});
