// GAME.md §26: the same plays in any order give the same night. Several nights with hits, a break-in, backing and cut
// backers, a beleaguered target, an arrest, an invalid play and the list, under both cut rules; each night is settled
// with the plays in many key orders, and every result must match byte for byte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, abilityCopy, tierCopy, idOf } from './helpers.mjs';
import { settleNight } from '../rules/night.mjs';
import { rng, shuffle } from '../rng.mjs';

function reorder(plays, seed) {
  const keys = shuffle(rng('shuffle-test', seed), Object.keys(plays));
  const out = {};
  for (const k of keys) out[k] = plays[k];
  return out;
}

function nightsFor() {
  // R4-2 (gap.accept): each leader names the backers it accepts (on night two a03 names its crewmate a05 and a01).
  const one = {
    a01: { kind: 'hit', target: 'a02', place: 'docks', reason: 'r1', accept: ['a03'] },
    a02: { kind: 'hustle', place: 'docks', accept: ['a04'] },
    a03: { kind: 'back', target: 'a01' },
    a04: { kind: 'back', target: 'a02' },
    a05: { kind: 'hit', target: 'a03', place: 'docks' },
    a06: { kind: 'breakin', target: 'a07', accept: ['a08'] },
    a07: { kind: 'laylow' },
    a08: { kind: 'back', target: 'a06' },
    a09: { kind: 'hit', target: 'a10', place: 'downtown' },
    a10: { kind: 'hustle', place: 'downtown' },
    a11: { kind: 'breakin', target: 'a11' },
    a12: { kind: 'hit', target: 'a02', place: 'docks' },
  };
  const two = {
    a01: { kind: 'back', target: 'a03' },
    a02: { kind: 'hit', target: 'a01', place: 'industrial' },
    a03: { kind: 'hit', target: 'a04', place: 'industrial', accept: ['a05', 'a01'] },
    a04: { kind: 'hustle', place: 'industrial' },
    a05: { kind: 'back', target: 'a03' },
    a06: { kind: 'hustle', place: 'docks' },
    a07: { kind: 'hit', target: 'a06', place: 'docks' },
    a08: { kind: 'hit', target: 'a06', place: 'docks' },
    a10: { kind: 'laylow' },
    a11: { kind: 'hustle', place: 'downtown' },
    a12: { kind: 'breakin', target: 'a10' },
  };
  const three = {};
  for (let i = 1; i <= 12; i++) three[idOf(i)] = { kind: 'hustle', place: ['downtown', 'industrial', 'docks'][i % 3] };
  three.a02 = { kind: 'hit', target: 'a05', place: 'industrial' };
  three.a04 = { kind: 'hit', target: 'a05', place: 'industrial', accept: ['a06'] };
  three.a06 = { kind: 'back', target: 'a04' };
  return [one, two, three];
}

for (const rule of ['A', 'B']) {
  test(`the same plays in any order give the same night (rule ${rule})`, () => {
    const g = new Game({ n: 12, rule });
    g.grant('a07', 300);
    g.grant('a01', 300);
    g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
    g.hand('a06', abilityCopy(g.s, 'knuckles', 1), { wear: true });
    g.hand('a02', tierCopy(g.s, 'rare'), { wear: true });
    g.hand('a07', tierCopy(g.s, 'common'));
    g.s.agents.a09.heat = 3;
    g.errand('a03', 'crew_form', { name: 'crew' });
    g.errand('a03', 'crew_invite', { agent: 'a05' });
    g.errand('a05', 'crew_join', { crew: 'c1' });
    const common = Object.values(g.s.traits).find(t => t.tier === 'common' && !t.ability);
    g.errand('a01', 'offer', { trait: common.id, amount: 100 });
    g.errand('a07', 'offer', { trait: common.id, amount: 110 });
    let n = 0;
    const cuts = [];
    for (const plays of nightsFor()) {
      n += 1;
      const frozen = JSON.stringify(plays);
      const base = settleNight(g.s, plays);
      const want = JSON.stringify([base.events, base.state, base.fights]);
      for (let k = 0; k < 12; k++) {
        const r = settleNight(g.s, reorder(plays, `${rule}-${n}-${k}`));
        assert.equal(JSON.stringify([r.events, r.state, r.fights]), want, `night ${n}, order ${k}`);
      }
      assert.equal(JSON.stringify(plays), frozen, 'the plays given in are never changed');
      g.s = base.state;
      g.log.push(...base.events);
      cuts.push(...base.fights.cut);
    }
    // Positive control: these nights really had fights, an arrest, a cut backer and an invalid play.
    assert.ok(g.log.filter(e => e.type === 'fight').length >= 4, 'fights happened');
    assert.ok(g.log.some(e => e.type === 'arrest'), 'an arrest happened');
    assert.ok(g.log.some(e => e.type === 'invalid'), 'an invalid play became the default');
    // a03 backs a01 and is hit by a05, its own crewmate: cut under A, not under B (§8).
    assert.equal(cuts.includes('a03'), rule === 'A', 'the crew exception decides whether a03 is cut');
  });
}
