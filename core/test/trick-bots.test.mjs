// L3-5b, the tricks in play (GAME.md §8, §10, §12, §13, §19, §25, §27): in the layer3 cast every seat also tips, rats,
// bribes, posts bounties and hires lookouts, each from its own view and for its own gain, by the rules as L3-6 and L3-7
// left them (a bounty pays only for a fight that took something and is gone at the ferry; a bribe is checked against
// the hottest agent on its side; a tipper is spared only when its tip brought the cops; a hit on an evicted agent takes
// everything it carries). The report counts the tricks, and rats join the betrayal bar. Each test imports what it needs
// itself, so each fails on its own before the bots exist. Amounts come from N or the bots' settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { N } from '../numbers.mjs';
import { rng } from '../rng.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-trick-bots-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const bots = () => import('../bench/bots.mjs');
const readLog = dir => fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const level = lv => Object.keys(N.levels).find(d => N.levels[d] === lv);
const HEAVY = level('heavy');
const NORMAL = level('normal');

// A day of a season with the layer3 cast. `add` puts an event on the record, public or private to `to` for 24 hours;
// `errand` applies one; `ctx` is a bot's context for a round or the night.
async function world(seed, day) {
  const { newSeason, viewFor, applyErrand } = await import('../index.mjs');
  const { loadItems } = await import('../bench/runner.mjs');
  const { makeCast, CASTS } = await bots();
  const cast = makeCast(seed, CASTS.layer3);
  const r = newSeason({ seed, rule: 'A', midseason: 'payday', items: loadItems(), agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  const w = { s: r.state, log: [...r.events], cast };
  w.at = d => {
    w.s.day = d;
    w.s.clock = 2 * d;
  };
  w.add = (type, t, fields, to = null) => {
    const e = { n: w.log.length + 1000, t, day: Math.floor(t / 2), type, ...fields, vis: to ? { to, pub: t + 2 } : { to: 'all', pub: t } };
    w.log.push(e);
    return e;
  };
  w.errand = (by, kind, fields = {}) => {
    const res = applyErrand(w.s, { by, kind, ...fields });
    assert.ok(res.ok, `${by} ${kind}: ${res.why}`);
    w.s = res.state;
    w.log.push(...res.events);
  };
  w.seat = id => ({ ...cast.find(c => c.id === id), every: true });
  w.view = id => viewFor(w.s, w.log, id, 'agent');
  w.ctx = (id, round) => ({ seed, day: w.s.day, round, rounds: 3, rng: rng(seed, 'bot', id, w.s.day, round) });
  // A copy of a tier still on the list, handed to `id` (worn, if asked).
  w.hand = (id, tier, wear = false) => {
    const k = Object.keys(w.s.copies).sort().find(x => w.s.copies[x].tier === tier && w.s.copies[x].holder.k === 'list');
    w.s.copies[k].holder = { k: 'agent', id };
    if (wear) w.s.agents[id].outfit[w.s.copies[k].slot] = k;
    return k;
  };
  w.at(day);
  return w;
}
// The seats of a strategy, in id order.
const seatsOf = (w, type) => w.cast.filter(c => c.type === type).map(c => c.id);
// The cast's crews, formed on day 1 as the bots form them: the leader founds it and invites its mates, who join.
function formCrews(w) {
  w.at(1);
  for (const c of w.cast.filter(x => x.type === 'crew' && x.role === 'leader')) {
    w.errand(c.id, 'crew_form', { name: c.crewName });
    for (const m of c.mates) w.errand(c.id, 'crew_invite', { agent: m });
  }
  for (const c of w.cast.filter(x => x.type === 'crew' && x.role === 'member')) w.errand(c.id, 'crew_join', { crew: w.s.agents[c.leader].crew });
}

// --- the protection tip (§8, §13) -----------------------------------------------------------------------------------
// a05 bought a rare (a public sale) and works nights at the docks; crew c1 (a01 founded it) struck on nights 2 and 5.
const someone = (id, extra = {}) => ({ id, fit: [], evicted: false, jailed: false, boarded: false, crew: null, heat: 0, wanted: false, ...extra });
function crewWatch({ day = 8, sales = [{ agent: 'a05', trait: 'tr' }, { agent: 'a06', trait: 'tc' }], robbedBy = {} } = {}) {
  const v = {
    day,
    me: { id: 'a05', wanted: false, jail: null, cash: 0, pieces: [], bounties: [] },
    board: {
      tonight: N.levels,
      crews: [{ id: 'c1', name: 'c1', members: ['a01', 'a02', 'a03'] }],
      agents: [someone('a01', { crew: 'c1' }), someone('a02', { crew: 'c1' }), someone('a03', { crew: 'c1' }), someone('a05'), someone('a06'), someone('a07')],
      sales,
      list: [{ trait: 'tc', tier: 'common', price: N.price.common[0], last: null }, { trait: 'tr', tier: 'rare', price: N.price.rare[0], last: null }],
      bounties: [],
    },
    sightings: { a05: [{ night: day - 1, place: 'docks' }], a06: [{ night: day - 1, place: 'industrial' }], a07: [{ night: day - 1, place: 'industrial' }] },
    events: [],
  };
  const memo = { heat: { 2: ['a01', 'a02', 'a03'], 5: ['a01', 'a02', 'a03', 'a06'] }, robbedBy, founders: { c1: 'a01' } };
  return { v, memo };
}

test("a tip is free, so a seat that expects a crew tonight tips the cops on the crew's leader, naming itself: on the crew's beat, when its home is the crew's likely pick (§8, §13)", async () => {
  const { tipFor } = await bots();
  const cfg = { type: 'hustle', trade: 'cop', layer: 2, every: true, drugs: true };
  const ctx = day => ({ seed: 1, day, round: 1, rounds: 3 });
  const due = crewWatch();
  assert.deepEqual(tipFor(due.v, ctx(8), cfg, due.memo), { kind: 'tip', agent: 'a01', target: 'a05' }, 'the founder leads');
  const known = crewWatch({ robbedBy: { 5: 'a02' } });
  assert.deepEqual(tipFor(known.v, ctx(8), cfg, known.memo), { kind: 'tip', agent: 'a02', target: 'a05' }, 'the one who robbed it for the crew leads');
  const off = crewWatch({ day: 7 });
  assert.equal(tipFor(off.v, ctx(7), cfg, off.memo), null, 'off the beat');
  const poorer = crewWatch({ sales: [{ agent: 'a05', trait: 'tc' }, { agent: 'a06', trait: 'tr' }] });
  assert.equal(tipFor(poorer.v, ctx(8), cfg, poorer.memo), null, 'another home is richer');
  const later = crewWatch();
  assert.equal(tipFor(later.v, { ...ctx(8), round: 2 }, cfg, later.memo), null, 'one tip a day, in its first round');
  const trades = crewWatch();
  assert.equal(tipFor(trades.v, ctx(8), { ...cfg, drugs: undefined }, trades.memo), null, "the trades cast's bots don't tip");
});

// --- the rat (§12) ----------------------------------------------------------------------------------------------------

test("the rat: a crew member its leader walked on sits out the leader's next job, takes no TRUTH for it, and tips the cops on it: its leader, at the target it reckons the job will pick (§12, §13)", async () => {
  const { tipFor, truthPlay, makeBot, jobDay } = await bots();
  const w = await world(404, 1);
  formCrews(w);
  // Two members of one crew, neither its snake (which may turn on a job night).
  const byCrew = {};
  for (const c of w.cast.filter(x => x.type === 'crew' && x.role === 'member' && !x.snake)) (byCrew[c.crew] ||= []).push(c.id);
  const [rat, loyal] = Object.values(byCrew).find(ids => ids.length >= 2);
  const { leader } = w.seat(rat);
  const day = Array.from({ length: N.nights }, (_, i) => i + 1).find(d => d > 2 && jobDay(d));
  w.at(day);
  // The leader kept the cut it promised the rat for its last job; somebody the crew can reach was out last night.
  w.add('betray', 2 * day - 1, { kind: 'walk', by: leader, victims: [rat], night: day - 2, promises: [] }, [leader, rat]);
  const target = seatsOf(w, 'hustle')[0];
  w.add('show', 2 * day - 1, { night: day - 1, seen: { [target]: NORMAL }, hooded: {} });
  for (const id of [rat, loyal]) w.s.agents[id].goods.truth = 1;
  const memo = {};
  assert.deepEqual(tipFor(w.view(rat), w.ctx(rat, 1), w.seat(rat), memo), { kind: 'tip', agent: leader, target });
  assert.equal(truthPlay(w.view(rat), w.ctx(rat, 1), w.seat(rat), [], memo), null, 'no TRUTH to lock a back it means to skip');
  const night = makeBot(w.seat(rat), memo).night(w.view(rat), w.ctx(rat, 'night'));
  assert.ok(night.play.kind !== 'back', `it sits the job out: ${JSON.stringify(night.play)}`);
  // A member with no receipt backs its leader, and tips nobody.
  const other = {};
  assert.equal(tipFor(w.view(loyal), w.ctx(loyal, 1), w.seat(loyal), other), null);
  assert.deepEqual(truthPlay(w.view(loyal), w.ctx(loyal, 1), w.seat(loyal), [], other), { kind: 'back', target: leader });
  assert.deepEqual(makeBot(w.seat(loyal), other).night(w.view(loyal), w.ctx(loyal, 'night')).play, { kind: 'back', target: leader });
  // The grudge is for one job: on the next job day the rat backs its leader again.
  const next = Array.from({ length: N.nights }, (_, i) => i + 1).find(d => d > day && jobDay(d));
  w.at(next);
  assert.equal(tipFor(w.view(rat), w.ctx(rat, 1), w.seat(rat), memo), null);
  assert.deepEqual(makeBot(w.seat(rat), memo).night(w.view(rat), w.ctx(rat, 'night')).play, { kind: 'back', target: leader });
});

// --- the bribe (§13) --------------------------------------------------------------------------------------------------

// A scout with a gun (strength 2) and the cash for a bribe, and a shift worker wearing a rare, seen at work in the heavy
// district on each of the last two nights, where the city cops' +1 would hold it against the scout.
async function heavyHit({ last = null, routine = true } = {}) {
  const w = await world(404, 4);
  const [scout] = seatsOf(w, 'scout');
  const [target] = seatsOf(w, 'hustle');
  w.s.agents[scout].goods.guns = 1;
  w.s.agents[scout].cash = 10 * (N.bribe[0] + N.lookout + N.rent);
  const k = w.hand(target, 'rare', true);
  if (last != null) w.s.traits[w.s.copies[k].trait].last = last;
  for (const night of [w.s.day - 2, w.s.day - 1]) w.add('show', 2 * night + 1, { night, seen: { [target]: routine || night === w.s.day - 1 ? HEAVY : NORMAL }, hooded: {} });
  return { w, scout, target, k };
}

test('the bribe: a scout whose best hit is in a heavy district, where the city cops would hold the target, bribes the precinct for that fight at its stars and plays that hit, when the take beats the bribe (§8, §13, gap.bribe)', async () => {
  const { bribePlan, makeBot } = await bots();
  // The rare is worth the bribe at 0 stars and ten nights' wages.
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): N.hustleBase is gone, so ten nights' wages are at its value, $50.
  const rich = N.bribe[0] + 10 * 50;
  const { w, scout, target, k } = await heavyHit({ last: rich });
  const memo = {};
  assert.equal(bribePlan(w.view(scout), w.ctx(scout, 1), w.seat(scout), memo), null, 'in the day\'s last round, once its muscle and its drugs are in');
  assert.deepEqual(bribePlan(w.view(scout), w.ctx(scout, 3), w.seat(scout), memo), { kind: 'bribe', target });
  assert.deepEqual(memo.plan.play, { kind: 'hit', target, place: HEAVY, want: k });
  assert.deepEqual(makeBot(w.seat(scout), memo).night(w.view(scout), w.ctx(scout, 'night')).play, memo.plan.play, 'it plays the hit it paid for');
  // Not when the take is worth no more than the bribe, nor for a guesser, which goes where it guesses.
  const cheap = await heavyHit({ last: N.bribe[0] });
  assert.equal(bribePlan(cheap.w.view(cheap.scout), cheap.w.ctx(cheap.scout, 3), cheap.w.seat(cheap.scout), {}), null);
  assert.equal(bribePlan(w.view(scout), w.ctx(scout, 3), { ...w.seat(scout), type: 'guess' }, {}), null);
  // Nor on one sighting: money on a sighting goes only to a target that keeps a routine there.
  const once = await heavyHit({ last: rich, routine: false });
  assert.equal(bribePlan(once.w.view(once.scout), once.w.ctx(once.scout, 3), once.w.seat(once.scout), {}), null);
  // Not when its own strength can't beat the target without the cops: an armed target.
  const armed = await heavyHit({ last: rich });
  armed.w.add('holdings', 2 * armed.w.s.day - 3, { agent: armed.target, cash: 0, home: true, pieces: [], goods: { guns: 1 }, crew: null }, [armed.target]);
  assert.equal(bribePlan(armed.w.view(armed.scout), armed.w.ctx(armed.scout, 3), armed.w.seat(armed.scout), {}), null);
});

// --- lookouts, and the evicted agent's bag a day late (§7, §10, §19; L3-6's gap.evictedHit) ----------------------------

test('a lookout: a robber about to break into a home it values from the record hires a lookout on it first, once a day, and then values the break-in by what the look shows (§7, §10)', async () => {
  const { lookFor, attackOptions, trickSight } = await bots();
  const w = await world(405, 4);
  const [robber] = seatsOf(w, 'scout');
  const [target] = seatsOf(w, 'hustle');
  w.s.agents[robber].goods.guns = 1;
  w.s.agents[robber].cash = 10 * (N.lookout + N.rent);
  const k = w.hand(target, 'rare');
  w.s.traits[w.s.copies[k].trait].last = 10 * N.lookout;
  w.add('buy', 2 * w.s.day - 3, { night: w.s.day - 2, agent: target, trait: w.s.copies[k].trait, copy: k, price: 10 * N.lookout });
  w.add('show', 2 * w.s.day - 1, { night: w.s.day - 1, seen: { [target]: NORMAL }, hooded: {} });
  assert.deepEqual(lookFor(w.view(robber), w.ctx(robber, 1), w.seat(robber), {}), [{ kind: 'lookout', agent: target }]);
  assert.deepEqual(lookFor(w.view(robber), w.ctx(robber, 2), w.seat(robber), {}), [], 'in the first round only');
  assert.deepEqual(lookFor(w.view(robber), w.ctx(robber, 1), { ...w.seat(robber), drugs: undefined }, {}), [], "the trades cast's robbers don't");
  // The look finds the cash whose break-in share (breakinShare) is the rare's sale price, so the two values differ by
  // what the sales record adds.
  const cash = Math.ceil((10 * N.lookout) / N.breakinShare);
  w.add('look', 2 * w.s.day, { by: robber, agent: target, cash, home: true, pieces: [], goods: {}, crew: null }, [robber]);
  const v = w.view(robber);
  const a = v.board.agents.find(x => x.id === target);
  const breakin = sight => attackOptions(v, [a], { power: 2, safe: () => true, hitAt: () => null, sight }).find(o => o.play.kind === 'breakin');
  assert.equal(breakin(trickSight(v)).value, Math.floor(cash * N.breakinShare), "the break-in's share of the cash the look found, and no piece");
  assert.ok(breakin(null).value > Math.floor(cash * N.breakinShare), "the trades cast's robbers go by the sales record");
  assert.deepEqual(lookFor(v, w.ctx(robber, 1), w.seat(robber), {}), [], 'it has looked today');
});

test("L3-6: a hit on an evicted agent takes everything it carries, and the record shows its bag a day late, so a robber counts the bag and the cash at less than the record says, and a look today in full (§10, §19, gap.evictedHit)", async () => {
  const { hitWorth, trickSight } = await bots();
  const w = await world(406, 5);
  const [robber] = seatsOf(w, 'scout');
  const [target] = seatsOf(w, 'hustle');
  w.s.agents[target].evicted = true;
  const k = w.hand(target, 'rare');
  const bag = { cash: 2 * N.price.rare[0], pieces: [{ copy: k, trait: w.s.copies[k].trait, tier: 'rare' }] };
  w.add('holdings', 2 * w.s.day - 3, { agent: target, home: false, goods: {}, crew: null, ...bag }, [target]);
  const v = w.view(robber);
  const a = v.board.agents.find(x => x.id === target);
  const record = hitWorth(v, a);
  assert.ok(record.value > 0);
  assert.ok(hitWorth(v, a, trickSight(v)).value < record.value, 'a day-late bag is worth less than it says');
  w.add('look', 2 * w.s.day, { by: robber, agent: target, home: false, goods: {}, crew: null, ...bag }, [robber]);
  const seen = w.view(robber);
  assert.deepEqual(hitWorth(seen, a, trickSight(seen)), record, "today's look counts in full");
});

// --- bounties (§10, §13) ----------------------------------------------------------------------------------------------

test("a bounty: a seat robbed by an agent it saw puts a price on that agent's head, a share of what it took, from cash it can spare; none for a masked robber, a second one, or a theft too small to move a hunter (§10, §19, gap.bounty)", async () => {
  const { bountyFor, TRICKS } = await bots();
  const w = await world(407, 6);
  const [victim, other] = seatsOf(w, 'hustle');
  const [thief] = seatsOf(w, 'scout');
  w.s.agents[victim].cash = 10 * N.price.grail[0];
  const k = w.hand(thief, 'rare');
  const trait = w.s.copies[k].trait;
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): N.hustleBase is gone, so the rare's last price uses its value, $50.
  w.s.traits[trait].last = Math.ceil(4 * 50 / TRICKS.bounty);
  const robbed = (by, extra = {}) => w.add('robbed', 2 * w.s.day - 1, { night: w.s.day - 1, agent: victim, by, kind: 'hit', place: NORMAL, copy: k, trait, tier: 'rare', cash: 0, crew: null, ...extra }, [victim]);
  robbed(thief);
  const worth = w.s.traits[trait].last;
  assert.deepEqual(bountyFor(w.view(victim), w.ctx(victim, 1), w.seat(victim), {}), [{ kind: 'bounty', agent: thief, amount: Math.floor(TRICKS.bounty * worth) }]);
  assert.deepEqual(bountyFor(w.view(victim), w.ctx(victim, 1), { ...w.seat(victim), drugs: undefined }, {}), [], "the trades cast's bots post none");
  w.errand(victim, 'bounty', { agent: thief, amount: Math.floor(TRICKS.bounty * worth) });
  assert.deepEqual(bountyFor(w.view(victim), w.ctx(victim, 1), w.seat(victim), {}), [], 'one open bounty on an agent is enough');
  const masked = await world(407, 6);
  masked.s.agents[victim].cash = 10 * N.price.grail[0];
  masked.add('robbed', 2 * masked.s.day - 1, { night: masked.s.day - 1, agent: victim, by: null, kind: 'hit', place: NORMAL, copy: k, trait, tier: 'rare', cash: 0, crew: null }, [victim]);
  assert.deepEqual(bountyFor(masked.view(victim), masked.ctx(victim, 1), masked.seat(victim), {}), [], 'a ski mask hides who');
  const small = await world(407, 6);
  small.s.agents[other].cash = 10 * N.price.grail[0];
  small.add('robbed', 2 * small.s.day - 1, { night: small.s.day - 1, agent: other, by: thief, kind: 'breakin', place: 'suburbs', copy: null, trait: null, tier: null, cash: 1, crew: null }, [other]);
  assert.deepEqual(bountyFor(small.view(other), small.ctx(other, 1), small.seat(other), {}), [], 'a theft of a dollar is worth no bounty');
});

test("hunters: a robber counts the bounties on an agent in what a fight on it brings, never its own; the Cops add them to a collar's pay (§10, §13, gap.bounty)", async () => {
  const { attackOptions, trickSight, policePlan } = await bots();
  const w = await world(408, 4);
  const [robber] = seatsOf(w, 'scout');
  const [poster] = seatsOf(w, 'hustle');
  const [target] = seatsOf(w, 'turtle');
  w.add('show', 2 * w.s.day - 1, { night: w.s.day - 1, seen: { [target]: NORMAL, [poster]: NORMAL }, hooded: {} });
  // What a break-in on `on` brings, as the robber reckons it in the layer3 cast (`sight`) or the trades cast.
  const breakin = (on, sight = true) => {
    const v = w.view(robber);
    const a = v.board.agents.find(x => x.id === on);
    return attackOptions(v, [a], { power: 2, safe: () => true, hitAt: () => null, sight: sight ? trickSight(v) : null }).find(o => o.play.kind === 'breakin').value;
  };
  const before = breakin(target);
  const amount = N.price.rare[0];
  w.s.agents[poster].cash = amount;
  w.errand(poster, 'bounty', { agent: target, amount });
  assert.equal(breakin(target), before + amount);
  assert.equal(breakin(target, false), before, "the trades cast's robbers don't read bounties");
  w.s.agents[robber].cash = amount;
  w.errand(robber, 'bounty', { agent: poster, amount });
  assert.equal(breakin(poster), breakin(poster, false), 'its own bounty never pays it');
  // The Cops: two wanted agents at home that the Cops on the record can beat; the hotter pays more stars, until a bounty
  // on the other outweighs them.
  const cops = w.cast.filter(c => c.trade === 'cop' && (c.type === 'cop' || c.works)).map(c => c.id);
  for (const id of cops) w.add('play', 2 * w.s.day - 3, { agent: id, kind: 'patrol', place: NORMAL, reason: '' }, [id]);
  const [hot, warm] = seatsOf(w, 'buylate').concat(seatsOf(w, 'hustle')).filter(id => !cops.includes(id) && id !== poster);
  w.s.agents[hot].heat = N.wantedAt + 1;
  w.s.agents[warm].heat = N.wantedAt;
  const lead = cops[0];
  const plan = (bounties = false) => policePlan(w.view(lead), bounties);
  assert.ok(plan(), 'the Cops can beat them');
  const without = plan(true).target;
  assert.equal(plan().target, without, 'no bounty on either: the more stars');
  const on = without === hot ? warm : hot;
  w.s.agents[poster].cash = 2 * N.copPay.star;
  w.errand(poster, 'bounty', { agent: on, amount: 2 * N.copPay.star });
  assert.equal(plan(true).target, on, 'a bounty worth more than a star pays more');
  assert.equal(plan().target, without, "the trades cast's Cops don't read bounties");
});

// --- the seasons (§23, §25) -------------------------------------------------------------------------------------------

test('seasons with the layer3 cast: every trick a legal errand with its reason: a tip on the tipper itself or a rat on a stiffing leader, a bribe for the scout\'s own hit, a bounty on its own robber, a lookout before a robber\'s or a crew\'s job; and a member its leader walked on never backs the next job (§10, §12, §13, §25)', async () => {
  const { CASTS, jobDay } = await bots();
  const { runSeason } = await import('../bench/runner.mjs');
  // 407 and 412 are seeds whose crews' leaders walked on their members in L3-5a's bench.
  for (const [seed, rule] of [[404, 'A'], [407, 'A'], [412, 'B']]) {
    const { dir, metrics } = runSeason({ seed, rule, outDir: path.join(tmp, 'seasons'), mix: CASTS.layer3 });
    const ck = JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8'));
    const log = readLog(dir);
    const seat = Object.fromEntries(ck.cast.map(c => [c.id, c]));
    assert.equal(metrics.ledger.failed, 0);
    assert.deepEqual(log.filter(e => e.type === 'invalid').map(e => `${e.agent} ${e.errand || e.kind}: ${e.why}`), [], `seed ${seed}: no invalid play or errand`);
    const walked = (by, victim, n) => log.some(e => e.type === 'betray' && e.kind === 'walk' && e.by === by && e.victims.includes(victim) && e.n < n);
    for (const t of log.filter(e => e.type === 'tip')) {
      const c = seat[t.by];
      const rat = c.type === 'crew' && c.role === 'member' && t.agent === c.leader && jobDay(t.day) && walked(c.leader, t.by, t.n);
      assert.ok(t.target === t.by || rat, `${t.by} (${c.type}) tipped on ${t.agent} and ${t.target} on day ${t.day}`);
    }
    for (const r of log.filter(e => e.type === 'betray' && e.kind === 'rat')) {
      assert.ok(log.some(t => t.type === 'tip' && t.by === r.by && t.day === r.night && t.agent === seat[r.by].leader), `${r.by}'s rat is its tip on its leader`);
    }
    for (const b of log.filter(e => e.type === 'bribe')) {
      const play = log.find(e => e.type === 'play' && e.agent === b.by && e.day === b.day);
      assert.equal(seat[b.by].type, 'scout');
      assert.deepEqual([play.kind, play.target], ['hit', b.target], `${b.by} bribed for its own hit`);
    }
    for (const b of log.filter(e => e.type === 'bounty' && e.act === 'post')) {
      assert.ok(log.some(e => e.type === 'robbed' && e.agent === b.by && e.by === b.agent && e.n < b.n), `${b.by}'s bounty is on its robber`);
    }
    for (const l of log.filter(e => e.type === 'look')) {
      const c = seat[l.by];
      assert.ok(['scout', 'guess'].includes(c.type) || (c.type === 'crew' && c.role === 'leader' && jobDay(l.day)), `${l.by} (${c.type}) hired a lookout on day ${l.day}`);
    }
    // A walk's receipt reaches its victims at dawn; on the first job night from that day, they don't back the leader.
    for (const wk of log.filter(e => e.type === 'betray' && e.kind === 'walk' && seat[e.by].type === 'crew')) {
      const job = Array.from({ length: N.nights }, (_, i) => i + 1).find(d => d >= wk.day && jobDay(d));
      for (const m of wk.victims.filter(x => seat[x].type === 'crew')) {
        const play = log.find(e => e.type === 'play' && e.agent === m && e.day === job);
        assert.ok(!play || play.kind !== 'back' || play.target !== wk.by, `seed ${seed}: ${m} backed ${wk.by} on night ${job}, after its walk`);
      }
    }
  }
});

// --- the report (§25, §27) --------------------------------------------------------------------------------------------

test("the report's tricks: tips right and wrong, arrests in tipped fights and rats, which join the betrayal bar; bribes and the fights they kept the cops out of; bounties posted, paid and gone at the ferry; lookouts; and the new sinks", async () => {
  const { seasonMetrics, seasonReport, summarize, summaryMarkdown } = await import('../bench/report.mjs');
  const cast = [
    { id: 'a01', type: 'scout', trade: 'dealer', name: 'a01', layer: 2, works: true, drugs: true },
    { id: 'a02', type: 'crew', trade: 'cop', name: 'a02', layer: 2, works: true, drugs: true, role: 'leader', leader: 'a02' },
    { id: 'a03', type: 'crew', trade: 'cop', name: 'a03', layer: 2, works: true, drugs: true, role: 'member', leader: 'a02' },
    { id: 'a04', type: 'hustle', trade: 'cop', name: 'a04', layer: 2, drugs: true },
    { id: 'a05', type: 'cop', trade: 'cop', name: 'a05', layer: 2, drugs: true },
  ];
  const [bribe, look, bounty, gone] = [N.bribe[0], N.lookout, N.copPay.star, 2 * N.copPay.star];
  const state = { agents: Object.fromEntries(cast.map(c => [c.id, {}])), copies: {}, money: { in: {}, out: { bribe, lookout: 3 * look, bounty: gone } }, goods: { in: {}, out: {} } };
  const log = [
    { type: 'tip', day: 2, by: 'a04', agent: 'a02', target: 'a04' },
    { type: 'tip', day: 5, by: 'a03', agent: 'a02', target: 'a01' },
    { type: 'tip', day: 8, by: 'a04', agent: 'a01', target: 'a04' },
    { type: 'betray', kind: 'rat', by: 'a03', victims: ['a02'], night: 5, target: 'a01' },
    { type: 'bribe', day: 3, by: 'a01', target: 'a04', stars: 0, price: bribe },
    { type: 'bounty', act: 'post', bounty: 'b1', by: 'a04', agent: 'a01', amount: bounty },
    { type: 'bounty', act: 'paid', bounty: 'b1', by: 'a04', agent: 'a01', amount: bounty, night: 6 },
    { type: 'bounty', act: 'collected', bounty: 'b1', to: 'a05', agent: 'a01', amount: bounty, night: 6 },
    { type: 'bounty', act: 'post', bounty: 'b2', by: 'a04', agent: 'a02', amount: gone },
    { type: 'bounty', act: 'gone', bounty: 'b2', by: 'a04', agent: 'a02', amount: gone },
    { type: 'look', day: 3, by: 'a01', agent: 'a04' }, { type: 'look', day: 5, by: 'a02', agent: 'a01' }, { type: 'look', day: 6, by: 'a01', agent: 'a03' },
  ];
  const fight = (kind, target, members, extra = {}) => ({
    kind, target, place: 'suburbs', level: 'normal', winner: null, attackers: [{ leader: members[0], members, strength: members.length }],
    defence: members.length, cops: 0, arrested: [], backingDecided: false, targetHitBacker: false, ...extra,
  });
  const night = (n, fights) => ({ night: n, placesChanged: false, fights, cutByTarget: [], hits: [], haul: {}, guns: null });
  const bench = {
    seed: 1, rule: 'A', midseason: 'payday',
    nights: [
      night(2, [fight('breakin', 'a04', ['a02', 'a03'], { tippers: ['a04'], arrested: ['a02', 'a03'] })]),
      night(3, [fight('hit', 'a04', ['a01'], { bribers: ['a01'], winner: 'a01' })]),
      night(5, [fight('hit', 'a01', ['a02'], { tippers: ['a03'], arrested: ['a02'] })]),
    ],
  };
  const m = seasonMetrics(state, log, bench, cast);
  const t = m.tricks;
  assert.deepEqual(t.tips, { given: 3, right: 2, wrong: 1, arrests: 3, rats: 1 });
  assert.deepEqual(t.bribes, { paid: 1, cash: bribe, kept: 1 });
  assert.deepEqual(t.bounties, { posted: 2, cash: bounty + gone, paid: 1, paidCash: bounty, to: { cop: 1 }, gone: 1, goneCash: gone });
  assert.deepEqual(t.looks, { hired: 3, by: { scout: 2, crew: 1 } });
  assert.deepEqual(t.sinks, { bribe, lookout: 3 * look, bounty: gone });
  assert.equal(m.bars.betrayals.byKind.rat, 1, 'a rat is a betrayal');
  const page = seasonReport(m);
  assert.match(page, /\*\*The tricks\*\*/);
  assert.match(page, /≥ 3 betrayals \(walk, rug, turn, rat\)/);
  const sum = summarize([m, { ...m, rule: 'B' }]);
  const all = sum.keyNumbers.find(k => k.group === 'all').tricks;
  assert.deepEqual(all.tips, { given: 6, right: 4, wrong: 2, arrests: 6, rats: 2 });
  assert.deepEqual(all.sinks, { bribe: 2 * bribe, lookout: 6 * look, bounty: 2 * gone });
  assert.match(summaryMarkdown(sum, { cast: 'layer3' }), /\*\*The tricks, all seasons\*\*/);
  // The trades cast's report has no tricks in it.
  const trades = seasonMetrics(state, log, bench, cast.map(({ drugs, ...c }) => c));
  assert.equal('tricks' in trades, false);
  assert.equal(seasonReport(trades).includes('The tricks'), false);
});
