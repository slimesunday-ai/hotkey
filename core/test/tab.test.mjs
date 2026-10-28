// The rent tab, GAP gap.rentTab (core/numbers.mjs). GAME.md §10: "Can't pay, and you're evicted until you do", and
// rent's why: "guarding or laying low every night should bleed you dry". As 'dock': each dawn an agent spends evicted
// (not in jail) runs up a night's rent on a tab, public on the board. Paying the rent ends the eviction as before, and
// the tab stays. At the dock on night 14 the tab comes out of the cash the agent carries; if that falls short, the
// landlord takes the rarest piece it carries (§4's tie rule), the piece rolls into next season's list as unsold copies
// do (§3), and the tab is cleared. As 'off': no tab.
// Expected values come from GAME.md and the row, never from what the code printed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, twoInDifferentSlots } from './helpers.mjs';
import { byId } from '../rules/state.mjs';
import { N } from '../numbers.mjs';

// Sets gap.rentTab for one test and puts the old value back, as the bench's --set does for one run.
function withTab(value, fn) {
  const was = N['gap.rentTab'];
  N['gap.rentTab'] = value;
  try {
    return fn();
  } finally {
    N['gap.rentTab'] = was;
  }
}

// a01 has no cash on night 1, so it can't pay the rent and is evicted at dawn (§10). That night's rent is the one
// paying the rent errand covers; it isn't on the tab.
function evicted() {
  const g = new Game({ n: 3 });
  g.night({ a01: { kind: 'laylow' } });
  assert.equal(g.s.agents.a01.evicted, true);
  return g;
}
const setLast = (g, copy, price) => { g.s.traits[g.s.copies[copy].trait].last = price; };
const ofType = (r, type, agent) => r.newEvents.find(e => e.type === type && e.agent === agent);

test('each dawn spent evicted runs up a night\'s rent on the tab; paying the rent ends the eviction and the tab stays (gap.rentTab, §10)', () => {
  withTab('dock', () => {
    const g = evicted();
    assert.equal(g.s.agents.a01.tab, 0, 'the night that evicted it is owed, not on the tab');
    g.night();
    assert.equal(g.s.agents.a01.tab, N.rent);
    const cash = g.s.agents.a01.cash;
    g.night();
    assert.equal(g.s.agents.a01.tab, 2 * N.rent);
    assert.ok(g.s.agents.a01.cash > cash, 'nothing comes out of its cash while it is evicted (rules.test.mjs pins that)');
    assert.equal(g.errand('a01', 'rent').ok, true, 'paying ends the eviction');
    assert.equal(g.s.agents.a01.evicted, false);
    assert.equal(g.s.agents.a01.tab, 2 * N.rent, 'the tab stays');
    g.night();
    assert.equal(g.s.agents.a01.tab, 2 * N.rent, 'home again, it pays rent at dawn and the tab doesn\'t grow');
  });
});

test('no tab runs up in jail: "No rent in jail" (§10)', () => {
  withTab('dock', () => {
    const g = evicted();
    // Test-only: a01 starts 2 nights on Iron Island before night 2, as an arrest on night 1 would have put it there.
    g.s.agents.a01.jail = { nights: N.jailNights, stars: 1, since: 1 };
    g.night();
    g.night();
    assert.equal(g.s.agents.a01.jail, null, 'released at dawn after its second night');
    assert.equal(g.s.agents.a01.tab, 0);
    g.night();
    assert.equal(g.s.agents.a01.evicted, true, 'jail doesn\'t end an eviction');
    assert.equal(g.s.agents.a01.tab, N.rent, 'out of jail and still evicted: the tab runs again');
  });
});

test('the tab is public on the board, and the agent sees its own (§19, gap.publicFacts)', () => {
  withTab('dock', () => {
    const g = evicted();
    g.night();
    g.night();
    const row = v => v.board.agents.find(a => a.id === 'a01');
    assert.equal(row(g.view(null, 'public')).tab, 2 * N.rent);
    assert.equal(row(g.view('a02')).tab, 2 * N.rent);
    assert.equal(row(g.view('a02', 'ownerAI')).tab, 2 * N.rent);
    assert.equal(g.view('a01').me.tab, 2 * N.rent);
    assert.equal(g.view(null, 'public').board.agents.find(a => a.id === 'a02').tab, 0);
  });
});

test('at the dock the tab comes out of the cash it carries, and is cleared (§15, gap.rentTab)', () => {
  withTab('dock', () => {
    const g = evicted();
    g.advanceTo(14);
    // Evicted at the dawn after night 1, so the dawns after nights 2 to 13 each ran up a night: 12 of them.
    assert.equal(g.s.agents.a01.tab, 12 * N.rent);
    const cash = g.s.agents.a01.cash;
    assert.ok(cash >= 12 * N.rent, 'a shift pays more than the rent, so its cash covers the tab');
    const r = g.night();
    assert.deepEqual(ofType(r, 'tab', 'a01'), { ...ofType(r, 'tab', 'a01'), tab: 12 * N.rent, paid: 12 * N.rent, copy: null });
    assert.equal(ofType(r, 'mint', 'a01').cash, cash - 12 * N.rent);
    assert.equal(g.s.agents.a01.tab, 0);
    assert.equal(ofType(r, 'tab', 'a02'), undefined, 'no tab, no settlement');
  });
});

test('short at the dock: all its cash, then the landlord takes the rarest piece it carries by §4\'s rule, and it rolls over', () => {
  // §4 with nobody naming a piece: the one that last sold for more on the list, then the lower id.
  const settle = ({ lo: lastLo, hi: lastHi }) => withTab('dock', () => {
    const g = evicted();
    const [lo, hi] = twoInDifferentSlots(g.s, 'rare').sort(byId);
    g.hand('a01', lo);
    g.hand('a01', hi, { wear: true });
    setLast(g, lo, lastLo);
    setLast(g, hi, lastHi);
    g.advanceTo(14);
    const tab = g.s.agents.a01.tab;
    g.errand('a01', 'pay', { to: 'a02', amount: g.s.agents.a01.cash - 30 });
    assert.equal(g.s.agents.a01.cash, 30);
    const r = g.night();
    const t = ofType(r, 'tab', 'a01');
    assert.equal(t.tab, tab);
    assert.equal(t.paid, 30, 'everything it carries goes first');
    assert.equal(ofType(r, 'mint', 'a01').cash, 0);
    assert.equal(g.s.agents.a01.tab, 0, 'the piece clears the rest');
    const kept = t.copy === lo ? hi : lo;
    assert.deepEqual(g.s.copies[t.copy].holder, { k: 'rollover' });
    assert.deepEqual(g.s.copies[kept].holder, { k: 'minted', id: 'a01' });
    return { taken: t.copy, lo, hi };
  });
  const a = settle({ lo: 500, hi: 900 });
  assert.equal(a.taken, a.hi, 'the one that last sold for more, worn or bagged');
  const b = settle({ lo: 500, hi: 500 });
  assert.equal(b.taken, b.lo, 'then the lower id');
});

test('off: no tab runs up and nothing is settled at the dock', () => {
  withTab('off', () => {
    const g = evicted();
    g.advanceTo(14);
    assert.equal(g.s.agents.a01.tab, 0);
    const cash = g.s.agents.a01.cash;
    const r = g.night();
    assert.equal(ofType(r, 'tab', 'a01'), undefined);
    assert.equal(ofType(r, 'mint', 'a01').cash, cash);
  });
});

test('a value of gap.rentTab the rules don\'t know fails loudly, before anything moves', () => {
  withTab('bogus', () => {
    const g = new Game({ n: 3 });
    const day = g.s.day;
    assert.throws(() => g.night(), /gap\.rentTab/);
    assert.equal(g.s.day, day);
  });
});
