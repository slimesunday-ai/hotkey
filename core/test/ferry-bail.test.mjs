// R3-3, released for the ferry and the trades cast's bail (GAME.md §12, §13, §15, §41; GAP gap.ferryJail): jail ends at
// dawn on day 14, when the ferry docks, so no jail outlasts the ferry, and the bail-before-the-ferry habit (L2-6d,
// `ferryBail` in bots.mjs) pays no bail just to make the boat. A day-13 bail would buy only night 13, and every seat
// that paid one finished poorer for it (core/reports/R3/HANDBACK-3.md §4). Under the old rule, 'missed', the habit is
// spending.test.mjs's. Every amount is read from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { rng } from '../rng.mjs';
import { withOverrides } from '../bench/runner.mjs';

const bots = () => import('../bench/bots.mjs');

// A small season, one bot config each (type, trade, `every` for the trades cast's bots), as spending.test.mjs builds
// it: `errands(id, round)` gives a fresh bot's day errands in that round, each applied and each going through.
async function world(cfgs, seed = 404) {
  const { makeBot } = await bots();
  const agents = cfgs.map((c, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: c.trade, driver: c.driver || 'test' }));
  const g = new Game({ n: 1 });
  const r = newSeason({ seed, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  const cfg = Object.fromEntries(agents.map((a, i) => [a.id, { id: a.id, fav: 'industrial', route: 'downtown', layer: 2, ...cfgs[i] }]));
  const ctx = (id, round) => ({ seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', id, g.s.day, round) });
  const errands = (id, round, memo = {}) => {
    const out = makeBot(cfg[id], memo).day(g.view(id), ctx(id, round));
    for (const e of out) {
      const res = g.errand(id, e.kind, e);
      assert.ok(res.ok, `${id} ${e.kind}: ${res.why}`);
    }
    return out;
  };
  return { g, errands };
}

// A hit on `target` at the docks (where the filler shift puts it) by agents at one star short of 5: the crime takes
// them to 5, and losing it with the city cops against a wanted attacker gets them arrested tonight.
function arrestTonight(g, ids, target) {
  for (const id of ids) g.s.agents[id].heat = N.maxHeat - 1;
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the helpers' filler is a hustle at the Mall now, so the night passes the docks filler that puts the target at the docks.
  return g.night(Object.fromEntries(ids.map(id => [id, { kind: 'hit', target, place: 'docks' }])), { filler: { kind: 'hustle', place: 'docks' } });
}

test("released for the ferry: a crew member jailed on night 12 walks out at the dawn the ferry docks, so it takes no cash from the crew stash and pays no bail to make the boat, and boards (§12, §13, §15; GAP gap.ferryJail)", () => withOverrides({ 'gap.ferryJail': 'released' }, async () => {
  const member = { type: 'crew', role: 'member', crew: 0, leader: 'a02', mates: ['a02'], crewName: 'c', snake: false, turn: 0, rug: 0, walk: 0, trade: 'cop', works: true, every: true };
  const shift = { type: 'hustle', trade: 'cop' };
  const { g, errands } = await world([member, { ...member, role: 'leader', leader: 'a02', mates: ['a01'] }, shift]);
  g.errand('a02', 'crew_form', { name: 'c' });
  g.errand('a02', 'crew_invite', { agent: 'a01' });
  g.errand('a01', 'crew_join', { crew: g.s.agents.a02.crew });
  g.advanceTo(N.nights - N.jailNights);
  arrestTonight(g, ['a01'], 'a03');
  const crew = g.s.agents.a02.crew;
  const bail = g.s.agents.a01.jail.stars * N.bailPerStar;
  const own = g.s.agents.a01.cash;
  assert.ok(g.s.day + g.s.agents.a01.jail.nights > N.nights, 'control: under the old rule this jail would still hold it when the ferry leaves');
  assert.ok(own < bail, 'control: its own cash is short of the bail');
  // The stash holds the shortfall and one dollar more, as in spending.test.mjs's case under the old rule.
  g.grant('a02', bail - own + 1);
  g.errand('a02', 'stash_put', { cash: bail - own + 1 });
  for (let round = 1; round <= 3; round++) {
    const out = errands('a01', round);
    assert.deepEqual(out.filter(e => ['stash_take', 'bail'].includes(e.kind)), [], `round ${round}: no bail, and no cash from the stash for one`);
  }
  assert.ok(g.s.agents.a01.jail, 'it waits in jail');
  assert.equal(g.s.crews[crew].cash, bail - own + 1, 'the stash keeps every dollar');
  g.night();
  assert.equal(g.s.agents.a01.jail, null, 'out at the dawn the ferry docks');
  const last = g.night();
  assert.ok(last.newEvents.some(e => e.type === 'board' && e.agent === 'a01'), 'and it boards');
  assert.ok(!last.newEvents.some(e => e.type === 'missed'), 'nobody misses the boat');
  assert.equal(g.events('bail').length, 0, 'no bail paid all season');
  assert.equal(g.events('betray').length, 0, 'and no rug');
}));
