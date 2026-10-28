// R3-6's review (trunk docs/briefs/R3-crime-pays.md, task 7): the canny cast's crews keep their word. A leader promises
// only the cuts it can pay, pays what it owes as far as its cash goes, and leaves out of its jobs the mates it has walked
// on (bots.mjs, the R3-6 section: cutFor, payCuts, callMates). No rule changes, and no model is called. Every test drives
// the bots through the rules (the helpers' Game, the ledger checked after every errand and night) and reads its amounts
// from N or from what the bots promise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { N } from '../numbers.mjs';
import { rng } from '../rng.mjs';
import { withOverrides } from '../bench/runner.mjs';

const bots = () => import('../bench/bots.mjs');
const LAYLOW = { kind: 'laylow', place: 'suburbs' };
const JOBS = ['hit', 'breakin', 'grab', 'vault'];
// The night the crew's job falls on in these tests (off the old job nights 2, 5, 8 and 11), and the day its cuts are due.
const NIGHT = 3;
const PAYDAY = NIGHT + 1;
const byNum = (x, y) => Number(x.id.slice(1)) - Number(y.id.slice(1));

// A season with the canny cast in the helpers' Game, built as canny-bots.test.mjs builds one: `seat(id)` is a bot's
// config as the runner hands it over, `ctx` its context for a round. Every agent gets the rent to the ferry twice over.
async function world(seed) {
  const { makeCast, CASTS } = await bots();
  const cast = makeCast(seed, CASTS.canny);
  const g = new Game({ n: 1 });
  const r = newSeason({ seed, rule: 'A', midseason: 'payday', items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  g.cast = cast;
  g.seat = id => ({ ...cast.find(c => c.id === id), every: true });
  g.ctx = (id, round) => ({ seed, day: g.s.day, round, rounds: 3, rng: rng(seed, 'bot', id, g.s.day, round) });
  Object.keys(g.s.agents).forEach(id => g.grant(id, 2 * N.nights * N.rent));
  return g;
}
const apply = (g, id, out) => out.forEach(({ kind, ...e }) => g.errand(id, kind, e));
// A crew's leader with at least `n` mates, the lowest id.
const leaderOf = (cast, n) => cast.filter(c => c.type === 'crew' && c.role === 'leader' && c.mates.length >= n).sort(byNum)[0];
// The first seed from 404 whose canny cast has a leader of three mates or more, and whose walk roll the day after
// `night` (payCuts' roll, at its seat's odds) keeps the bag (`walks`) or pays.
async function seedWhere(walks, night) {
  const { makeCast, CASTS } = await bots();
  for (let seed = 404; seed < 504; seed++) {
    const lead = leaderOf(makeCast(seed, CASTS.canny), 3);
    if (lead && (rng(seed, 'walk', lead.id, night + 1)() < lead.walk) === walks) return seed;
  }
  throw new Error('no seed in 404-503 has it');
}
const stashOf = (g, id) => g.s.crews[g.s.agents[id].crew];
// What the leader could pay out of the crew stash without emptying it of everything (a rug, §12): payCuts' reading.
const spareOf = st => st.cash - (Object.values(st.pieces || {}).length || Object.keys(st.goods).length ? 0 : 1);

// The morning of `night` (NIGHT unless given) for the crew of the lowest-id leader of three mates or more: the crews
// formed on day 1 as their
// leaders form them; a shift worker out at work every night whose home holds cash on its public record (the job its
// leader calls); everyone else laying low. Its mates keep three nights' rent and the leader four nights' for each mate,
// the rest given to an agent outside the crews, so the cash a cut can come from is the leader's own.
async function crewWorld(walks, night = NIGHT) {
  const { makeBot } = await bots();
  const seed = await seedWhere(walks, night);
  const g = await world(seed);
  const lead = leaderOf(g.cast, 3);
  const crew = [lead.id, ...lead.mates];
  for (const c of g.cast.filter(x => x.type === 'crew' && x.role === 'leader')) {
    g.errand(c.id, 'crew_form', { name: c.crewName });
    for (const m of c.mates) {
      g.errand(c.id, 'crew_invite', { agent: m });
      g.errand(m, 'crew_join', { crew: g.s.agents[c.id].crew });
    }
  }
  const [mark, other] = g.cast.filter(c => c.type === 'hustle').map(c => c.id);
  g.grant(mark, 20 * N.rent * crew.length);
  const works = { [mark]: { kind: 'hustle', place: 'docks' } };
  while (g.s.day < night) g.night(works, { filler: LAYLOW });
  const leave = id => (id === lead.id ? 4 * N.rent * lead.mates.length : 3 * N.rent);
  for (const id of crew) g.errand(id, 'pay', { to: other, amount: g.s.agents[id].cash - leave(id) });
  const bot = Object.fromEntries(crew.map(id => [id, makeBot(g.seat(id), {})]));
  return { g, lead, crew, mark, other, works, bot };
}
// A day's rounds for the crew's seats, every errand their bots give, the leader first in each round.
function crewDay(w) {
  for (let round = 1; round <= 3; round++) for (const id of w.crew) apply(w.g, id, w.bot[id].day(w.g.view(id), w.g.ctx(id, round)));
}
// The night: the crew's seats play as their bots do (but for `plays`), the mark works, everyone else lays low.
function crewNight(w, plays = {}) {
  const all = { ...w.works };
  for (const id of w.crew) all[id] = plays[id] || w.bot[id].night(w.g.view(id), w.g.ctx(id, 'night')).play;
  w.g.night(all, { filler: LAYLOW });
  return all;
}
const cutsOf = (g, lead, night = NIGHT) => g.s.promises.filter(p => p.by === lead && p.what === 'pay' && p.night === night);
const dueOf = (g, lead) => g.s.promises.filter(p => p.by === lead && p.what === 'pay' && p.due === PAYDAY && !p.settled).sort(byNum);
const paidTo = (g, lead, to) => g.events('pay', e => e.from === lead && e.to === to && e.for === 'cut' && e.day === PAYDAY).reduce((t, e) => t + e.amount, 0);
const walksBy = (g, lead) => g.events('betray', e => e.kind === 'walk' && e.by === lead);
// What the leader could still pay the day after, by the state at the end of the day: its cash once the dawn rent is
// paid, and the crew stash's once a break-in on the home it's kept at took its share tonight (breakinShare).
const canPay = (g, lead) => {
  const st = stashOf(g, lead);
  return Math.max(0, g.s.agents[lead].cash - N.rent) + st.cash - Math.floor(st.cash * N.breakinShare);
};

test('crews: a leader promises its mates only the cuts it can still pay the day after, once the dawn rent is paid; its job wins, and it pays every cut in full, so no walk is recorded (§10, §12)', async () => {
  const w = await crewWorld(false);
  const { g, lead } = w;
  crewDay(w);
  const cuts = cutsOf(g, lead.id);
  assert.ok(cuts.length > 0, 'control: it promised its mates cuts for tonight\'s job');
  const total = cuts.reduce((t, p) => t + p.cash, 0);
  assert.ok(total <= canPay(g, lead.id), `it promised $${total}, where after the day's errands and the dawn rent it can pay $${canPay(g, lead.id)}`);
  const plays = crewNight(w);
  assert.ok(JOBS.includes(plays[lead.id].kind), `control: the leader's job tonight: ${JSON.stringify(plays[lead.id])}`);
  const due = dueOf(g, lead.id);
  assert.ok(due.length > 0, 'control: the job won, so its cuts are due');
  crewDay(w);
  for (const p of due) assert.equal(paidTo(g, lead.id, p.to), p.cash, `${p.to}'s cut paid in full`);
  g.night(w.works, { filler: LAYLOW });
  assert.deepEqual(walksBy(g, lead.id), [], 'no walk');
});

// The day a crew's leader bids the crew stash on the list: the first night a rare is open (a crew buys rare or better
// with its stash), off the old job nights. The leader is granted what the cheapest open rare costs and as much again as
// it held, and keeps `keep(w)` of its cash out of the stash, the rest going in; then the crew's day runs. Its asserts:
// it bid the stash's cash, it promised cuts, and no more than it can pay the day after.
async function bidDay(keep) {
  const { jobDay } = await bots();
  const probe = await world(404);
  const opens = Math.min(...probe.view('a01').board.list.filter(t => t.tier !== 'common').map(t => t.opens));
  const night = Array.from({ length: N.nights }, (_, i) => i + 1).find(d => d >= opens && !jobDay(d));
  const w = await crewWorld(false, night);
  const { g, lead } = w;
  const rare = Math.min(...g.view(lead.id).board.list.filter(t => t.tier !== 'common' && t.opens <= night && t.left > 0).map(t => t.price));
  g.grant(lead.id, rare + g.s.agents[lead.id].cash);
  g.errand(lead.id, 'stash_put', { cash: g.s.agents[lead.id].cash - keep(w) });
  crewDay(w);
  const today = g.log.filter(e => e.day === night);
  assert.ok(today.some(e => e.type === 'bid' && e.agent === lead.id) && today.some(e => e.type === 'stash' && e.act === 'take' && e.agent === lead.id && e.cash > 0), 'control: it bid the stash\'s cash on the list today');
  const cuts = cutsOf(g, lead.id, night);
  assert.ok(cuts.length > 0, 'control: it promised its mates cuts');
  const total = cuts.reduce((t, p) => t + p.cash, 0);
  assert.ok(total <= canPay(g, lead.id), `it promised $${total}, where after its bid, the dawn rent and a break-in on the stash's home it can pay $${canPay(g, lead.id)}`);
}

test('crews: a leader that bids the crew stash on the list the day it calls a job promises only what the bid leaves it, after the dawn rent and what a break-in on the stash\'s home would take tonight; where a break-in takes half a home\'s cash (breakinShare 0.5), the stash is all it has (§3, §7, §10, §12)', () => withOverrides({ breakinShare: 0.5 }, async () => {
  // All but the dawn rent of its leader's cash goes into the stash, so the stash is what it has to bid and to pay with:
  // only the half of what the bid leaves that a break-in wouldn't take can pay a cut.
  await bidDay(() => N.rent);
}));

test('crews: the same under today\'s rules, with the leader keeping some of its cash out of the stash it bids from: it promises no more than that cash after the dawn rent and what a break-in would leave of the stash (§3, §7, §10, §12)', async () => {
  // Its leader keeps the four nights' rent for each mate it held, so a cut can come out of its own cash whatever share
  // of the stash's cash a break-in on its home would take.
  await bidDay(w => 4 * N.rent * w.lead.mates.length);
});

test('crews: the day after a won job, a leader short of its cuts pays them one by one as far as its cash goes, the last of them in part, and the rest once more cash comes in that day, so no walk is recorded (§12)', async () => {
  const w = await crewWorld(false);
  const { g, lead, other } = w;
  crewDay(w);
  crewNight(w);
  const due = dueOf(g, lead.id);
  assert.ok(due.length >= 2, `control: two cuts or more are due: ${due.length}`);
  // What it has for its cuts this morning: the first cut and half the second, its cash and the stash's spare together.
  const target = due[0].cash + Math.floor(due[1].cash / 2);
  if (spareOf(stashOf(g, lead.id)) > target) g.errand(lead.id, 'stash_take', { cash: spareOf(stashOf(g, lead.id)) - target });
  const spare = Math.max(0, spareOf(stashOf(g, lead.id)));
  g.errand(lead.id, 'pay', { to: other, amount: g.s.agents[lead.id].cash - (target - spare) });
  const morning = w.bot[lead.id].day(g.view(lead.id), g.ctx(lead.id, 1));
  const pays = morning.filter(e => e.kind === 'pay' && e.for === 'cut');
  assert.deepEqual(pays.map(e => e.to), due.slice(0, 2).map(p => p.to), `the first cut, then the second: ${JSON.stringify(pays)}`);
  assert.equal(pays[0].amount, due[0].cash, 'the first in full');
  assert.equal(pays[1].amount, target - due[0].cash, 'the second as far as its cash goes');
  const st = stashOf(g, lead.id);
  const took = morning.filter(e => e.kind === 'stash_take' && e.cash).reduce((t, e) => t + e.cash, 0);
  assert.ok(took <= Math.max(0, spareOf(st)), 'never the last dollar of a stash that holds nothing else');
  apply(g, lead.id, morning);
  // Cash comes in, what it still owes, and it pays the rest in the day's next round.
  g.grant(lead.id, due.reduce((t, p) => t + p.cash, 0) - target);
  apply(g, lead.id, w.bot[lead.id].day(g.view(lead.id), g.ctx(lead.id, 2)));
  for (const p of due) assert.equal(paidTo(g, lead.id, p.to), p.cash, `${p.to} paid in full`);
  g.night(w.works, { filler: LAYLOW });
  assert.deepEqual(walksBy(g, lead.id), [], 'no walk');
});

test('crews: a leader that walked on its mates asks them on no job after, from its own record, so they neither sit its next job out nor tip the cops on it; it brings the mate it didn\'t walk on (§12, §13)', async () => {
  const w = await crewWorld(true);
  const { g, lead } = w;
  // A second shift worker with cash at home on its public record, out at work every night, so the leader still has a job
  // to call after tonight's break-in, whatever share of a home's cash a break-in takes (breakinShare).
  const mark2 = g.cast.filter(c => c.type === 'hustle').map(c => c.id).find(id => id !== w.mark && id !== w.other);
  assert.ok(mark2, 'control: a third shift worker');
  g.grant(mark2, 20 * N.rent * w.crew.length);
  w.works[mark2] = { kind: 'hustle', place: 'docks' };
  crewDay(w);
  // One mate stays home tonight, so it isn't owed a cut; the others back the job.
  const home = lead.mates.slice().sort().slice(-1)[0];
  crewNight(w, { [home]: LAYLOW });
  const owed = dueOf(g, lead.id).map(p => p.to);
  assert.ok(owed.length > 0 && !owed.includes(home), `control: the job won, and its backers are owed: ${owed}`);
  // The day after, the leader keeps the bag (its walk roll), and the rules record the walk the next dawn.
  crewDay(w);
  assert.equal(g.events('pay', e => e.from === lead.id && e.for === 'cut' && e.day === PAYDAY).length, 0, 'control: it pays no cut');
  g.night(w.works, { filler: LAYLOW });
  const walk = walksBy(g, lead.id);
  assert.equal(walk.length, 1, 'control: a walk');
  const stiffed = walk[0].victims;
  // Its next day: whom it asks for a job.
  const asks = w.bot[lead.id].day(g.view(lead.id), g.ctx(lead.id, 1)).filter(e => e.kind === 'ask' && lead.mates.includes(e.to));
  assert.deepEqual(asks.filter(e => stiffed.includes(e.to)), [], `it asks none of the mates it walked on (${stiffed})`);
  assert.deepEqual(asks.map(e => e.to), [home], 'it asks the mate it didn\'t walk on');
  apply(g, lead.id, asks);
  for (const m of stiffed) assert.deepEqual(w.bot[m].day(g.view(m), g.ctx(m, 1)).filter(e => e.kind === 'tip'), [], `${m} tips nothing`);
});
