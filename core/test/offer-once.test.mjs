// A crew leader offers at most once on a trait a day (§3: one offer per trait per night). On the list's last day a
// leader that works a trade spends down in round 1, an offer on the list among it, and in round 2 it buys for the crew
// with the pooled cash. Its pooled buy picked the cheapest of the rarest it could afford without looking at its own
// offers, so when that was the trait it had just offered on, it took the price out of the crew stash and offered again,
// and the rules refused the second offer. `134a2bb`'s canny seasons did this 8 times, every one on day 12 (406-B,
// 407-A and B, 411-A and B, 417-B, 434-A and B), and R4-3's daytime exposed it on the trades cast's seed 406. Now its
// pooled buy passes over a trait it already offered on today, read off its own view. Amounts come from N and the board.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { rng } from '../rng.mjs';
import { N } from '../numbers.mjs';

const bots = () => import('../bench/bots.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'offer-once-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const RANK = { common: 0, rare: 1, epic: 2, grail: 3 };

// A crew of two Smugglers, a01 its leader, as the trades cast deals one (bots.mjs makeCast), with three other agents,
// on the list's last day, its stash holding the pooled cash for two rares at today's price and less than any piece
// above a rare.
function lastListDay() {
  const g = new Game({ n: 1 });
  const agents = Array.from({ length: 5 }, (_, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: 'smuggler', driver: 'test' }));
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  for (const [by, kind, fields] of [['a01', 'crew_form', { name: 'the crew' }], ['a01', 'crew_invite', { agent: 'a02' }]]) assert.equal(g.errand(by, kind, fields).ok, true);
  assert.equal(g.errand('a02', 'crew_join', { crew: g.s.agents.a01.crew }).ok, true);
  g.advanceTo(N.listLastNight);
  const open = g.view('a01').board.list.filter(t => t.opens <= g.s.day && t.left > 0);
  const rare = Math.min(...open.filter(t => t.tier === 'rare').map(t => t.price));
  const above = Math.min(...open.filter(t => RANK[t.tier] > RANK.rare).map(t => t.price));
  assert.ok(2 * rare < above, `control: two rares at $${rare} cost less than the cheapest piece above a rare, $${above}`);
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): five
  // hustlers at the Mall, the helpers' filler, take $24 a night, $4 after the rent, so a01 has $44 on day 12 (trunk, from
  // shifts: $385), short of a rare; it also gets a rare's price of its own (test money, as if it had earned it), for the
  // offer its round-1 spend-down makes on one.
  g.grant('a01', 3 * rare);
  assert.equal(g.errand('a01', 'stash_put', { cash: 2 * rare }).ok, true);
  return { g, rare };
}
const LEADER = {
  id: 'a01', type: 'crew', trade: 'smuggler', role: 'leader', works: true, every: true, layer: 2, crew: 1, leader: 'a01',
  mates: ['a02'], crewName: 'the crew', snake: false, turn: 0.35, rug: 0.5, walk: 0.35, fav: 'industrial', route: 'industrial',
};
// The leader's round-2 errands, from a fresh bot reading its own view.
async function round2(g) {
  const { makeBot } = await bots();
  return makeBot(LEADER, {}).day(g.view('a01'), { seed: 404, day: g.s.day, round: 2, rounds: 3, rng: rng(404, 'bot', 'a01', g.s.day, 2) });
}

test("on the list's last day a crew leader that has already offered on the trait its pooled buy would pick doesn't offer on it again, nor take the crew's cash for it; every errand it sends goes through (§3; GAME.md §12)", async () => {
  const { g, rare } = lastListDay();
  const control = (await round2(g)).filter(e => e.kind === 'offer');
  assert.equal(control.length, 1, 'control: with no offer of its own yet, its pooled buy offers on a rare');
  const trait = control[0].trait;
  // Its own offer on that trait, as its round-1 spend-down makes one.
  assert.equal(g.errand('a01', 'offer', { trait, amount: rare }).ok, true);
  assert.deepEqual(g.view('a01').me.offers.map(o => o.trait), [trait], 'its view shows the offer it made');
  const errands = await round2(g);
  assert.deepEqual(errands.filter(e => e.kind === 'offer' && e.trait === trait), [], 'no second offer on that trait');
  const stash = g.s.crews[g.s.agents.a01.crew].cash;
  for (const e of errands) {
    const r = g.errand('a01', e.kind, e);
    assert.equal(r.ok, true, `${e.kind} ${JSON.stringify(e)}: ${r.why}`);
  }
  const taken = errands.filter(e => e.kind === 'stash_take' && e.cash).reduce((t, e) => t + e.cash, 0);
  const bought = errands.filter(e => e.kind === 'offer').reduce((t, e) => t + e.amount, 0);
  assert.ok(taken <= bought, `the crew's cash comes out only for an offer it makes (took $${taken}, offered $${bought}; the stash held $${stash})`);
});

// Across canny seasons, not one pinned season: a pinned season's control stopped firing each time the bots or the
// rules moved it (407-A after R4-3 and again after R4-5), so this reads every refusal the rule names in ten seasons.
test("canny seasons 404-413 under rule A: no leader's offer is refused as a second offer on one trait (§3, §25)", async () => {
  const { CASTS } = await bots();
  const { runSeason } = await import('../bench/runner.mjs');
  const refused = [];
  let lastDayBids = 0;
  for (let seed = 404; seed <= 413; seed++) {
    const { dir } = runSeason({ seed, rule: 'A', outDir: tmp, mix: CASTS.canny });
    const log = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    lastDayBids += log.filter(e => e.type === 'bid' && e.day === N.listLastNight).length;
    refused.push(...log.filter(e => e.type === 'invalid' && e.errand === 'offer' && /one offer per trait/.test(e.why || '')).map(e => `${seed} ${e.agent} day ${e.day}`));
  }
  assert.ok(lastDayBids > 0, "control: someone offered on the list's last day");
  assert.deepEqual(refused, [], 'no second offer on one trait refused');
});
