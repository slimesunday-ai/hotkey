// Fixes from the R1 review: one betrayal per act, and guards that make the night stop loudly if a copy were ever
// taken or seized twice (GAME.md §12, §23).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, tierCopy } from './helpers.mjs';
import { settleNight } from '../rules/night.mjs';

test('a walk is one betrayal, with every unpaid backer as a victim (§12, gap.betrayals)', () => {
  const g = new Game({ n: 5 });
  g.errand('a01', 'crew_form', { name: 'c' });
  for (const m of ['a02', 'a03']) {
    g.errand('a01', 'crew_invite', { agent: m });
    g.errand(m, 'crew_join', { crew: g.s.agents.a01.crew });
  }
  for (const m of ['a02', 'a03']) {
    g.errand('a01', 'ask', { to: m });
    const sd = Object.values(g.s.sitdowns).find(x => x.b === m).id;
    g.errand(m, 'answer', { sitdown: sd, accept: true });
    g.errand('a01', 'say', { sitdown: sd, say: 'promise', terms: { what: 'pay', who: m, cash: 20, night: 1 } });
  }
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a04 is a filler the job finds at the docks, so this night passes the docks filler.
  g.night({ a01: { kind: 'hit', target: 'a04', place: 'docks' }, a02: { kind: 'back', target: 'a01' }, a03: { kind: 'back', target: 'a01' } }, { filler: { kind: 'hustle', place: 'docks' } });
  assert.equal(g.events('fight', e => e.target === 'a04' && e.won).length, 1, 'positive control: the job won');
  g.night();
  const walks = g.events('betray', e => e.kind === 'walk');
  assert.equal(walks.length, 1, 'one act, one betrayal');
  assert.deepEqual(walks[0].victims, ['a02', 'a03']);
  assert.ok(walks[0].vis.to.includes('a02') && walks[0].vis.to.includes('a03'), 'each victim gets the receipt');
});

// A state no valid errand or night can make: two agents with the same copy in their outfits. The night must refuse
// to hand the copy out twice instead of quietly moving it again.
test('a copy taken twice in one night stops the night (§23: one holder at every moment)', () => {
  const g = new Game({ n: 6 });
  const k = g.hand('a02', tierCopy(g.s, 'rare'));
  const s = structuredClone(g.s);
  s.agents.a01.outfit[s.copies[k].slot] = k;
  const plays = {
    a01: { kind: 'hustle', place: 'docks' },
    a02: { kind: 'hustle', place: 'industrial' },
    // R4-2 (gap.accept): each leader accepts its backer.
    a03: { kind: 'hit', target: 'a01', place: 'docks', accept: ['a05'] },
    a05: { kind: 'back', target: 'a03' },
    a04: { kind: 'breakin', target: 'a02', accept: ['a06'] },
    a06: { kind: 'back', target: 'a04' },
  };
  assert.throws(() => settleNight(s, plays), /taken twice/);
  // Positive control: the same night on a clean state settles.
  assert.doesNotThrow(() => settleNight(g.s, plays));
});

test('a copy seized twice in one night stops the night (§13, §23)', () => {
  const g = new Game({ n: 4 });
  const k = g.hand('a01', tierCopy(g.s, 'rare'), { wear: true });
  const s = structuredClone(g.s);
  s.agents.a02.outfit[s.copies[k].slot] = k;
  const plays = {
    a01: { kind: 'hit', target: 'a03', place: 'downtown' },
    a02: { kind: 'hit', target: 'a04', place: 'downtown' },
    a03: { kind: 'hustle', place: 'downtown' },
    a04: { kind: 'hustle', place: 'downtown' },
  };
  assert.throws(() => settleNight(s, plays), /seized twice/);
  const ok = settleNight(g.s, { ...plays, a02: { kind: 'hustle', place: 'docks' } });
  assert.equal(ok.events.filter(e => e.type === 'arrest').length, 1, 'positive control: one arrest in a heavy district, one seizure');
});
