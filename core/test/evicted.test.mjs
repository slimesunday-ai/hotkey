// A hit on an evicted agent, under both values of GAP gap.evictedHit (core/numbers.mjs). 'worn + half cash' is §7 as
// written: the rarest piece it wears. 'carried + half cash' (or 'carried') reads §10's "no home, so everything you own
// is on you" as the last night does (§15): the rarest real piece it carries, worn or bagged. Both take half its cash.
// Expected values come from GAME.md and the row, never from what the code printed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy, tierCopy, twoInDifferentSlots } from './helpers.mjs';
import { byId } from '../rules/state.mjs';
import { N } from '../numbers.mjs';

const robOf = (r, leader) => r.newEvents.find(e => e.type === 'rob' && e.leader === leader);
const robbedOf = (r, agent) => r.newEvents.find(e => e.type === 'robbed' && e.agent === agent);
// Tonight's shift wage: a01 works a shift, so a won hit on it takes that too (§7, GAP gap.holdup).
// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the work event's wage is now a01's hustle event's take.
const wageOf = r => r.newEvents.find(e => e.type === 'hustle' && e.agent === 'a01').take;
const setLast = (g, copy, price) => { g.s.traits[g.s.copies[copy].trait].last = price; };

// Sets gap.evictedHit for one test and puts the old value back, as the bench's --set does for one run.
function withEvictedHit(value, fn) {
  const was = N['gap.evictedHit'];
  N['gap.evictedHit'] = value;
  try {
    return fn();
  } finally {
    N['gap.evictedHit'] = was;
  }
}

// a01 can't pay the first night's rent, so it's evicted at dawn (§10); a02 wears brass knuckles, so its hit beats a01
// alone (2 against 1, §8), at the docks, where no cops come for an attacker that isn't wanted.
function evicted({ before } = {}) {
  const g = new Game({ n: 3 });
  if (before) before(g);
  g.night({ a01: { kind: 'laylow' } });
  assert.equal(g.s.agents.a01.evicted, true);
  g.hand('a02', abilityCopy(g.s, 'knuckles'), { wear: true });
  return g;
}
const hitA01 = (g, want) => g.night({
  a01: { kind: 'hustle', place: 'docks' }, a02: { kind: 'hit', target: 'a01', place: 'docks', ...(want ? { want } : {}) },
});

test('carried: a hit on an evicted agent takes its rarest unworn piece when it outranks the worn one (gap.evictedHit, §10, §15)', () => {
  for (const value of ['carried + half cash', 'carried']) {
    withEvictedHit(value, () => {
      const g = evicted();
      const worn = g.hand('a01', tierCopy(g.s, 'common'), { wear: true });
      const bagged = g.hand('a01', tierCopy(g.s, 'rare'));
      const rob = robOf(hitA01(g), 'a02');
      assert.equal(rob.copy, bagged, value);
      assert.equal(g.s.copies[bagged].holder.id, 'a02', value);
      assert.equal(g.s.copies[worn].holder.id, 'a01', value);
    });
  }
});

test('carried: ties among everything it carries follow §4: the named piece, then the last sold for more, then the lower id', () => {
  const take = ({ want, worn: lastWorn, bagged: lastBagged }) => withEvictedHit('carried + half cash', () => {
    const g = evicted();
    // Two rares; the bagged one has the lower id, so every fallback that picks it had to reach into the bag.
    const [lo, hi] = twoInDifferentSlots(g.s, 'rare').sort(byId);
    const bagged = g.hand('a01', lo);
    const worn = g.hand('a01', hi, { wear: true });
    setLast(g, worn, lastWorn);
    setLast(g, bagged, lastBagged);
    const named = want === 'bagged' ? bagged : want === 'worn' ? worn : undefined;
    const copy = robOf(hitA01(g, named), 'a02').copy;
    return copy === bagged ? 'bagged' : copy === worn ? 'worn' : copy;
  });
  assert.equal(take({ want: 'bagged', worn: 300, bagged: 250 }), 'bagged', 'the piece the play named');
  assert.equal(take({ want: 'worn', worn: 250, bagged: 300 }), 'worn', 'the piece the play named, worn or bagged');
  assert.equal(take({ worn: 250, bagged: 300 }), 'bagged', 'otherwise the one that last sold for more');
  assert.equal(take({ worn: 300, bagged: 300 }), 'bagged', 'then the lower id');
});

test('carried: the cash half is unchanged: half its own cash, and nothing from a crew stash another member keeps', () => {
  withEvictedHit('carried + half cash', () => {
    // a03 founds the crew and keeps its stash at home; a01 joins, then gets evicted (§12, gap.crewStash).
    const g = evicted({
      before: g => {
        g.grant('a03', 100);
        g.errand('a03', 'crew_form', { name: 'c' });
        g.errand('a03', 'crew_invite', { agent: 'a01' });
        g.errand('a01', 'crew_join', { crew: 'c1' });
        g.errand('a03', 'stash_put', { cash: 60, copy: g.hand('a03', tierCopy(g.s, 'epic')) });
      },
    });
    assert.equal(g.s.crews.c1.keeper, 'a03');
    g.grant('a01', 101);
    const bagged = g.hand('a01', tierCopy(g.s, 'rare'));
    const r = hitA01(g);
    const rob = robOf(r, 'a02');
    assert.equal(rob.copy, bagged);
    assert.equal(rob.cash, 50 + wageOf(r), 'half of 101, rounded down (gap.rounding), and its wage tonight');
    assert.equal(g.s.crews.c1.cash, 60);
    assert.equal(robbedOf(r, 'a01').crew ?? null, null);
  });
});

test('carried: an evicted keeper (every member evicted) carries the crew stash: its pieces count, and half its cash goes too', () => {
  withEvictedHit('carried + half cash', () => {
    let stashed;
    // a01 is the crew's only member, so it keeps the stash, and stays the keeper once evicted: nobody has a home.
    const g = evicted({
      before: g => {
        g.grant('a01', 60);
        g.errand('a01', 'crew_form', { name: 'c' });
        stashed = g.hand('a01', tierCopy(g.s, 'rare'));
        g.errand('a01', 'stash_put', { cash: 60, copy: stashed });
      },
    });
    assert.equal(g.s.crews.c1.keeper, 'a01');
    g.grant('a01', 101);
    const worn = g.hand('a01', tierCopy(g.s, 'common'), { wear: true });
    const r = hitA01(g);
    const rob = robOf(r, 'a02');
    assert.equal(rob.copy, stashed);
    assert.equal(rob.from, 'crew:c1');
    assert.equal(rob.cash, 50 + 30 + wageOf(r), 'half of its 101 and half of the stash\'s 60, and its wage tonight');
    assert.equal(g.s.crews.c1.cash, 30);
    assert.equal(g.s.copies[worn].holder.id, 'a01');
    assert.equal(robbedOf(r, 'a01').crew, 'c1');
  });
});

test('worn + half cash (the other value): the worn piece, half its cash, and the crew stash untouched', () => withEvictedHit('worn + half cash', () => {
  let stashed;
  const g = evicted({
    before: g => {
      g.grant('a01', 60);
      g.errand('a01', 'crew_form', { name: 'c' });
      stashed = g.hand('a01', tierCopy(g.s, 'epic'));
      g.errand('a01', 'stash_put', { cash: 60, copy: stashed });
    },
  });
  g.grant('a01', 101);
  const worn = g.hand('a01', tierCopy(g.s, 'common'), { wear: true });
  const bagged = g.hand('a01', tierCopy(g.s, 'rare'));
  const r = hitA01(g);
  const rob = robOf(r, 'a02');
  assert.equal(rob.copy, worn);
  assert.equal(rob.cash, 50 + wageOf(r), 'half its cash, and its wage tonight');
  assert.equal(g.s.copies[bagged].holder.id, 'a01');
  assert.equal(g.s.copies[stashed].holder.k, 'crew');
  assert.equal(g.s.crews.c1.cash, 60);
  assert.equal(robbedOf(r, 'a01').crew ?? null, null);
}));

test('a value of gap.evictedHit the rules don\'t know fails loudly, before anything moves', () => {
  withEvictedHit('carry', () => {
    const g = new Game({ n: 3 });
    assert.throws(() => g.night(), /gap\.evictedHit/);
  });
});
