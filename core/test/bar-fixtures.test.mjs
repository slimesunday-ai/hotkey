// R4-10, a fixture per §27 bar (trunk docs/briefs/R4-astra-fixes.md, task 10; docs/redesign/gates-20261017.md,
// design (a)). Every bar §27 lists gets a small hand-built season or event log whose verdict is plain from §27's words
// (trunk's GAME.md), and an adversarial one that a loose reading would get wrong. Each test quotes the words it checks.
// - R4-10 marked 13 tests `todo`: a fixture the bar's code got wrong, one §27's words left open, or one for a bar no code
//   computed yet. R4-11 (design (b): core/bench/passbars.mjs owns every bar) built each with the reading the
//   orchestrator called (10-17), each test says which above it, and none is todo now. Three asserted a reading the
//   orchestrator didn't pick, and assert its reading now: the Gunrunners (reading 3), out-earn (reading 6) and most
//   chems (readings 3 and 7).
// - Every amount comes from N. Hauls, takes and incomes are whole nights of the base shift wage (N.hustleBase), so each
//   verdict can be checked by hand.
// - Nothing here plays a whole season or calls a model: the ceiling's seat talks to the fake, in-process.
// - The haul, the crime bar and distinct seasons have their fixtures in measure.test.mjs; this file adds what they lack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { N } from '../numbers.mjs';
import { Game } from './helpers.mjs';
import { seasonMetrics, seasonReport, summarize } from '../bench/report.mjs';
import { haulsNow } from '../bench/runner.mjs';
import { makeCast, CASTS } from '../bench/bots.mjs';
import { resolveFights } from '../rules/fights.mjs';
import { defaultPlay } from '../rules/plays.mjs';
import { makeSeat } from '../agents/seat.mjs';
import { replyFormat } from '../agents/tools.mjs';
import { fakeModel, manualClock, CHAT_PATH } from '../agents/fake-model.mjs';

// A night's base shift wage: the unit of every amount below.
// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): N.hustleBase is gone, so the unit is its value, $50, and every amount is unchanged.
const U = 50;
const LAST = N.nights;
const DRUGS = Object.keys(N.walks);
const seat = (id, type, more = {}) => ({ id, type, name: id, ...more });
// A seat's mint at the ferry (rules/night.mjs:932): its Mainland money, in shift wages, and no piece.
const mint = (agent, wages) => ({ type: 'mint', agent, mainland: wages * U, cash: wages * U, cards: [] });
// What seasonMetrics reads of the final state when a fixture sets nothing else.
const blank = cast => ({ agents: Object.fromEntries(cast.map(c => [c.id, {}])), copies: {}, money: { in: {}, out: {} }, goods: { in: {}, out: {} } });
// One night of the runner's bench data (runner.mjs:352); a fixture fills in what it's about.
const night = (n, more = {}) => ({ night: n, haul: {}, fights: [], hits: [], placesChanged: false, cutByTarget: [], ...more });
const season = ({ cast, log = [], nights = [], state = blank(cast), rule = 'A', seed = 1 }) => seasonMetrics(state, log, { seed, rule, midseason: 'payday', nights }, cast);
// A season of final hauls: { id: [type, haul in shift wages, the seat's other fields] }.
function hauls(spec, more = {}) {
  const cast = Object.entries(spec).map(([id, [type, , own = {}]]) => seat(id, type, { ...more, ...own }));
  return season({ cast, log: Object.entries(spec).map(([id, [, x]]) => mint(id, x)) });
}

// --- buy-late and turtle ----------------------------------------------------------------------------------------------
// §27: "A buy-late bot (saves everything, buys only on the list's last two nights) and a turtle bot (lays low every
// night after its first rare) each finish below the median haul in at least 90% of seasons."

test('§27 buy-late and turtle, plain: each bot below the median haul passes; above it fails', () => {
  // Hauls 0.5, 1, 2, 3, 4: the median is 2. The turtle has 0.5 and the buy-late bot 1.
  const low = hauls({ s1: ['hustle', 2], s2: ['hustle', 3], s3: ['hustle', 4], b1: ['buylate', 1], t1: ['turtle', 0.5] });
  assert.equal(low.bars.buyLate.median, 2 * U);
  assert.deepEqual([low.bars.buyLate.pass, low.bars.turtle.pass], [true, true]);
  // Hauls 1, 2, 3, 4, 5: the median is 3. The buy-late bot has 4 and the turtle 5.
  const high = hauls({ s1: ['hustle', 1], s2: ['hustle', 2], s3: ['hustle', 3], b1: ['buylate', 4], t1: ['turtle', 5] });
  assert.deepEqual([high.bars.buyLate.pass, high.bars.turtle.pass], [false, false]);
});

// "below the median haul": level with it isn't below it.
test('§27 buy-late and turtle, adversarial: a bot level with the median haul is not below it', () => {
  // Hauls 1, 2, 2, 3: the median is the middle two's mean, 2, and both bots sit on it.
  const level = hauls({ s1: ['hustle', 1], s2: ['hustle', 3], b1: ['buylate', 2], t1: ['turtle', 2] });
  assert.equal(level.bars.buyLate.median, 2 * U);
  assert.deepEqual([level.bars.buyLate.pass, level.bars.turtle.pass], [false, false]);
});

// "A buy-late bot ... finish[es] below the median haul", in a cast with two of them: layer 2's cast and every cast
// built on it seat two buy-late bots and two turtles (bots.mjs:3887).
// R4-11, reading 1 (the orchestrator's call, 10-17): every buy-late bot, and every turtle, finishes below the median
// haul.
test('§27 buy-late and turtle, two buy-late bots: one far below the median haul and one above it', () => {
  // Hauls 0, 1, 2, 3, 4, 5: the median is 2.5. The buy-late bots have 0 and 4: their mean, 2, is below it; b2 is not.
  const m = hauls({ s1: ['hustle', 2], s2: ['hustle', 3], s3: ['hustle', 5], b1: ['buylate', 0], b2: ['buylate', 4], t1: ['turtle', 1] });
  assert.equal(m.bars.buyLate.median, 2.5 * U);
  assert.equal(m.bars.buyLate.pass, false, 'b2 finishes above the median haul');
});

// --- the Cop and the Gunrunner ----------------------------------------------------------------------------------------
// §27: "The median cop and the median Gunrunner finish in the top half in at least 30% of seasons."
const L2 = { layer: 2 };
// Layer 2's seats as makeCast deals them (bots.mjs:3978-3980): a trade bot holds its trade, every other bot the Cop's.
const COP = { trade: 'cop' };
const GUN = { trade: 'gunrunner' };

test('§27 the Cop and the Gunrunner, plain: both above the median haul passes; a Gunrunner on the median is not in the top half', () => {
  // Hauls 1, 2, 2.5, 3, 4: the median is 2.5. The Gunrunner has 3 and the Cop 4.
  const top = hauls({ s1: ['hustle', 1, COP], s2: ['hustle', 2, COP], s3: ['hustle', 2.5, COP], g1: ['gunrunner', 3, GUN], c1: ['cop', 4, COP] }, L2);
  assert.deepEqual(top.bars.copGunrunner, { cop: 4 * U, gunrunner: 3 * U, median: 2.5 * U, pass: true });
  // The Gunrunner at 2.5, the median of 1, 2, 2.5, 2.5, 4.
  const mid = hauls({ s1: ['hustle', 1, COP], s2: ['hustle', 2, COP], s3: ['hustle', 2.5, COP], g1: ['gunrunner', 2.5, GUN], c1: ['cop', 4, COP] }, L2);
  assert.equal(mid.bars.copGunrunner.pass, false);
});

// "The median ... Gunrunner finish[es] in the top half", with two Gunrunners, as layer 2's cast seats them
// (bots.mjs:3887).
// R4-11, reading 2 (the orchestrator's call, 10-17): "the median X" is one seat; with an even count, the lower of the
// two middle ones.
test('§27 the Cop and the Gunrunner, two Gunrunners: one at the top and one at the bottom', () => {
  // Hauls 1, 2, 3, 4, 5, 7: the median is 3.5. The Gunrunners have 7 and 1: their mean, 4, is above it; g2 is at the
  // bottom.
  const m = hauls({ s1: ['hustle', 2, COP], s2: ['hustle', 3, COP], s3: ['hustle', 4, COP], g1: ['gunrunner', 7, GUN], g2: ['gunrunner', 1, GUN], c1: ['cop', 5, COP] }, L2);
  assert.equal(m.bars.copGunrunner.median, 3.5 * U);
  assert.equal(m.bars.copGunrunner.pass, false, 'the median Gunrunner, g2, is in the bottom half');
});

// "The median ... Gunrunner", in a cast where every seat works a trade (GAME.md §9: "Each agent picks a trade on day 0,
// for the whole season"). In the trades, layer3, layer4, crime and canny casts a trade has six seats, two of them its
// bots (bots.mjs:3890-3897).
// R4-11, reading 3 (the orchestrator's call, 10-17): a trade's Gunrunners are the seats that play the trade, a bot by its
// own driver and a model seat by its trade. The turtle and the buy-late bot dealt the Gunrunner trade play their own
// strategies and work the trade only on nights those leave free, so they aren't Gunrunners. R4-10 asserted the other
// reading, every seat with the trade's label, under which their median, 1.5, was in the bottom half.
test('§27 the Cop and the Gunrunner, every seat with the trade: the Gunrunner bot at the top, the two other seats that work the trade at the bottom', () => {
  // Hauls 1, 1.5, 2, 3, 4, 5, 6: the median is 3. The Gunrunner trade's label: the bot g1 at 6, the turtle w1 at 1 and
  // the buy-late bot w2 at 1.5; of them g1 alone plays the trade. The Cop at 5.
  const m = hauls({
    s1: ['hustle', 2, COP], s2: ['hustle', 3, COP], s3: ['hustle', 4, COP], c1: ['cop', 5, COP],
    g1: ['gunrunner', 6, GUN], w1: ['turtle', 1, { ...GUN, works: true }], w2: ['buylate', 1.5, { ...GUN, works: true }],
  }, L2);
  assert.equal(m.bars.copGunrunner.median, 3 * U);
  assert.deepEqual([m.bars.copGunrunner.gunrunner, m.bars.copGunrunner.pass], [6 * U, true], 'the median Gunrunner is g1, the seat that plays the trade');
});

// --- crime pays, with risk (measure.test.mjs:156-189 has the rest) -----------------------------------------------------
// §27: "the median robber out-earns the median shift worker, and gets arrested at least once ... Its haul beats the
// median shift worker's".
test('§27 crime pays, adversarial (what measure.test.mjs lacks): a median robber level with the median shift worker does not out-earn it, arrested or not', () => {
  const cast = [seat('s1', 'hustle'), seat('s2', 'hustle'), seat('s3', 'hustle'), seat('r1', 'scout'), seat('r2', 'guess'), seat('r3', 'scout')];
  const arrest = (agent, n) => ({ type: 'arrest', night: n, agent, why: 'fight' });
  // The shift workers have 2 each; the robbers 1, 2 and 3, every one arrested once. The median robber, r2, has 2.
  const log = [mint('s1', 2), mint('s2', 2), mint('s3', 2), mint('r1', 1), mint('r2', 2), mint('r3', 3), arrest('r1', 1), arrest('r2', 2), arrest('r3', 3)];
  const bar = season({ cast, log }).bars.crimePays;
  assert.deepEqual([bar.robber, bar.robberHaul, bar.hustleHaul, bar.robberArrests], ['r2', 2 * U, 2 * U, 1]);
  assert.equal(bar.pass, false);
});

// --- the middle matters -----------------------------------------------------------------------------------------------
// §27: "The middle matters: the last night moves less than a third of all the value stolen in a season."
// A won hit's record (rules/night.mjs:432): its `value` is its cash plus the piece at its trait's last list price.
const rob = (n, cash, more = {}) => ({ type: 'rob', night: n, leader: 'r1', members: ['r1'], target: 's1', place: 'strip', copy: null, trait: null, cash, value: cash, ...more });
const middleOf = log => season({ cast: [seat('r1', 'scout'), seat('s1', 'hustle')], log }).bars.middle;

test('§27 the middle matters, plain: a quarter of the stolen value on the last night passes, two-thirds fails, and the night before the last is the middle', () => {
  const quarter = middleOf([rob(2, U), rob(5, U), rob(9, U), rob(LAST, U)]);
  assert.deepEqual([quarter.stolen, quarter.lastNight, quarter.pass], [4 * U, U, true]);
  const most = middleOf([rob(5, U), rob(LAST, 2 * U)]);
  assert.deepEqual([most.stolen, most.lastNight, most.pass], [3 * U, 2 * U, false]);
  // 2 on the night before the last is the middle's: the last night moves 1 of 4.
  const eve = middleOf([rob(4, U), rob(LAST - 1, 2 * U), rob(LAST, U)]);
  assert.deepEqual([eve.lastNight, eve.pass], [U, true]);
});

// "less than a third": a third is not less.
test('§27 the middle matters, adversarial: exactly a third on the last night is not less than a third', () => {
  const third = middleOf([rob(3, U), rob(8, U), rob(LAST, U)]);
  assert.equal(third.share, 1 / 3);
  assert.equal(third.pass, false);
});

// "all the value stolen": the last night's plays include jobbing the vault (§15).
// R4-11, reading 4 (the orchestrator's call, 10-17): all the value stolen is every take by crime: hits (cash, pieces and
// goods), break-ins, grabs and vault jobs.
test('§27 the middle matters, the vault jobbed on the last night', () => {
  // Hits of 1 on nights 4, 7 and 10 and on the last night; on the last night a vault job also takes 3 in cash.
  const vault = { type: 'vault', night: LAST, leader: 'r1', members: ['r1'], copies: [], cash: 3 * U };
  const m = middleOf([rob(4, U), rob(7, U), rob(10, U), rob(LAST, U), vault]);
  assert.deepEqual([m.stolen, m.lastNight], [7 * U, 4 * U]);
  assert.equal(m.pass, false);
});

// "value stolen", with a pumped price: §27 prices a copy at its own first sale for haul ("A later sale of the same trait
// reprices nothing, so an overbid can't raise anyone's haul"), and says nothing of how a theft is priced.
// R4-11, reading 5 (the orchestrator's call, 10-17): a stolen piece counts at its copy's own first sale on the list, as
// haul does.
test('§27 the middle matters, a pumped price: an overbid on the list\'s last night lifts what a last-night theft of an older copy counts for', () => {
  const P = N.price.common[0];
  const buy = (n, agent, copy, price) => ({ type: 'buy', night: n, agent, trait: 't1', copy, price });
  // k1 and k2 sell at P on nights 2 and 3; on the list's last night a02 bids 3P for k3, so t1 last sold at 3P. A hit
  // takes k1 on night 5 (worth P then), cash hits take P on nights 8 and 9, and on the last night a hit takes k2.
  const log = [
    buy(2, 's1', 'k1', P), buy(3, 's1', 'k2', P), buy(N.listLastNight, 'a02', 'k3', 3 * P),
    rob(5, 0, { copy: 'k1', trait: 't1', value: P }), rob(8, P), rob(9, P), rob(LAST, 0, { copy: 'k2', trait: 't1', value: 3 * P }),
  ];
  const m = middleOf(log);
  assert.equal(m.lastNight, P, "k2 at its own sale");
  assert.equal(m.pass, true);
});

// --- #1 changes hands -------------------------------------------------------------------------------------------------
// §27: "#1 by haul changes hands at least 3 times a season."
const PAIR = [seat('a01', 'hustle'), seat('a02', 'hustle')];
const tops = list => list.map(([a, b], i) => night(i + 1, { haul: { a01: a * U, a02: b * U } }));

test('§27 #1 changes hands, plain: a01, a02, a01, a02 on top is three changes; a01, a02, a01 is two', () => {
  const four = season({ cast: PAIR, nights: tops([[2, 1], [1, 2], [3, 2], [3, 4]]) }).bars.leaderChanges;
  assert.deepEqual(four.leaders, ['a01', 'a02', 'a01', 'a02']);
  assert.deepEqual([four.changes, four.pass], [3, true]);
  const three = season({ cast: PAIR, nights: tops([[2, 1], [1, 2], [3, 2]]) }).bars.leaderChanges;
  assert.deepEqual([three.changes, three.pass], [2, false]);
});

// "#1": a tie at the top has no #1, so it hands nothing over.
test('§27 #1 changes hands, adversarial: a tie at the top is no #1, so a01, tie, a01, tie, a02, tie, a02 is one change', () => {
  const bar = season({ cast: PAIR, nights: tops([[2, 1], [2, 2], [2, 1], [2, 2], [1, 2], [2, 2], [1, 2]]) }).bars.leaderChanges;
  assert.deepEqual(bar.leaders, ['a01', null, 'a01', null, 'a02', null, 'a02']);
  assert.deepEqual([bar.changes, bar.pass], [1, false]);
});

// "#1 by haul": a fake never mints (§15: "fakes are exposed ... and gone"), so it's no part of anyone's haul to date.
test('§27 #1 changes hands, adversarial: a fake held mid-season adds nothing to its holder\'s haul to date, so it never puts it on top', () => {
  const log = [{ type: 'season', drop: [{ trait: 't1', price: N.price.common[0] }] }];
  const fake = { k9: { trait: 't1', holder: { k: 'agent', id: 'a02' }, fake: true, maker: 'a02' } };
  const at = (a01, a02, copies = {}) => haulsNow({ over: false, agents: { a01: { cash: a01 * U }, a02: { cash: a02 * U } }, crews: {}, traits: { t1: { last: 2 * U } }, copies }, log);
  // Cash: a01 leads, a02 overtakes, a01 leads again; on night 4 a02 also holds a fake of a trait that last sold for 2,
  // which counted would put it on top (5 against 4) for a third change.
  const nights = [at(2, 1), at(2, 3), at(4, 3), at(4, 3, fake)].map((h, i) => night(i + 1, { haul: h.paid, shadow: { mark: h.mark, open: h.open } }));
  assert.equal(nights[3].haul.a02, 3 * U, 'the fake counts for nothing');
  const m = season({ cast: PAIR, nights });
  assert.deepEqual(m.bars.leaderChanges.leaders, ['a01', 'a02', 'a01', 'a01']);
  assert.deepEqual([m.bars.leaderChanges.changes, m.bars.leaderChanges.pass], [2, false]);
  for (const v of ['mark', 'open']) assert.equal(m.shadow[v].leaderChanges.changes, 2, v);
});

// --- betrayals --------------------------------------------------------------------------------------------------------
// §27: "At least 3 betrayals a season (walk, rug, turn, rat, double-sell)."
const betray = (kind, by, victims, when) => ({ type: 'betray', kind, by, victims, ...when });
const CREW = [seat('a01', 'crew'), seat('a02', 'crew'), seat('a03', 'crew')];

test('§27 betrayals, plain: a walk, a rug and a turn are three; a walk and a rug are two', () => {
  const walk = betray('walk', 'a01', ['a02'], { night: 3, day: 5 });
  const rug = betray('rug', 'a02', ['a01', 'a03'], { day: 6 });
  const turn = betray('turn', 'a03', ['a01'], { night: 7, day: 7 });
  const three = season({ cast: CREW, log: [walk, rug, turn] }).bars.betrayals;
  assert.deepEqual([three.total, three.byKind, three.pass], [3, { walk: 1, rug: 1, turn: 1 }, true]);
  assert.equal(season({ cast: CREW, log: [walk, rug] }).bars.betrayals.pass, false);
});

// "3 betrayals": acts, not records. One play that broke two promises is one turn, though the rules record it once per
// promise (rules/night.mjs:713); a turn and a rat by one agent on one night are two acts.
test('§27 betrayals, adversarial: a turn that broke two promises is one act, recorded twice; a turn and a rat by one agent on one night are two', () => {
  const turned = [betray('turn', 'a01', ['a02'], { night: 4, day: 4 }), betray('turn', 'a01', ['a03'], { night: 4, day: 4 })];
  const walk = betray('walk', 'a02', ['a03'], { night: 2, day: 4 });
  const two = season({ cast: CREW, log: [...turned, walk] }).bars.betrayals;
  assert.deepEqual([two.total, two.pass], [2, false]);
  const rat = betray('rat', 'a01', ['a02', 'a03'], { night: 4, day: 4 });
  const three = season({ cast: CREW, log: [...turned, rat, walk] }).bars.betrayals;
  assert.deepEqual([three.total, three.byKind, three.pass], [3, { turn: 1, rat: 1, walk: 1 }, true]);
});

// --- show-worthy every night ------------------------------------------------------------------------------------------
// §27: "Every night has at least one show-worthy event: a theft, an arrest, a corner fight, a turn, a grab or a vault
// job."
const group = (leader, members = [leader]) => ({ leader, members, strength: members.length });
const fight = (kind, more = {}) => ({ kind, target: null, winner: null, attackers: [group('r1')], arrested: [], ...more });
const SHOW = [seat('r1', 'scout'), seat('s1', 'hustle')];
// Night 1 a theft, 2 an arrest, 3 a corner fight, 4 a turn, 5 a grab, 6 a vault job, and a theft every night after.
function showSeason(skip = [], extra = { log: [], nights: {} }) {
  const log = [rob(1, U), { type: 'arrest', night: 2, agent: 'r1', why: 'fight' }, betray('turn', 'r1', ['s1'], { night: 4, day: 4 })];
  for (let n = 7; n <= LAST; n++) if (!skip.includes(n)) log.push(rob(n, U));
  const fights = { 3: [fight('corner')], 5: [fight('grab')], 6: [fight('vault')] };
  const nights = Array.from({ length: LAST }, (_, i) => night(i + 1, { fights: [...(fights[i + 1] || []), ...(extra.nights[i + 1] || [])] }));
  return season({ cast: SHOW, log: [...log, ...extra.log], nights }).bars.showWorthy;
}

test('§27 show-worthy every night, plain: each of the six kinds makes a night; a night with none fails the bar', () => {
  const all = showSeason();
  assert.deepEqual([all.nights, all.missing, all.pass], [LAST, [], true]);
  const quiet = showSeason([9]);
  assert.deepEqual([quiet.missing, quiet.pass], [[9], false]);
});

// "a theft ... or a turn": a hit that lost took nothing, a hit a vest stopped took nothing, and a walk is no turn.
test('§27 show-worthy every night, adversarial: a night whose only events are a lost hit, a hit that took nothing and a walk is not show-worthy', () => {
  const lost = fight('hit', { target: 's1' });
  const vest = rob(9, 0, { vest: true });
  const walk = betray('walk', 'r1', ['s1'], { night: 9, day: 11 });
  const m = showSeason([9], { log: [vest, walk], nights: { 9: [lost] } });
  assert.deepEqual([m.missing, m.pass], [[9], false]);
});

// --- a third of minted traits taken or traded --------------------------------------------------------------------------
// §27: "At least a third of the traits that mint were taken or traded at least once."
// A copy as the final state keeps it: its holder and every holder it passed through (rules/state.mjs:188).
const holderOf = to => (to.includes(':') ? { k: to.split(':')[0], id: to.split(':')[1] } : { k: to });
const copy = (trait, path, more = {}) => ({ trait, tier: 'common', holder: holderOf(path[path.length - 1]), sold: N.price.common[0], hist: path.map(to => ({ to })), ...more });
const mintedOf = copies => season({ cast: CREW, state: { ...blank(CREW), copies } }).bars.mintedMoved;
const kept = who => copy('t1', ['list', `agent:${who}`, `minted:${who}`]);

test('§27 a third of minted traits taken or traded, plain: one of three taken passes; one of four fails', () => {
  const taken = copy('t2', ['list', 'agent:a01', 'agent:a02', 'minted:a02']);
  const third = mintedOf({ k1: kept('a01'), k2: taken, k3: kept('a02') });
  assert.deepEqual([third.minted, third.moved, third.pass], [3, 1, true]);
  const quarter = mintedOf({ k1: kept('a01'), k2: taken, k3: kept('a02'), k4: kept('a03') });
  assert.deepEqual([quarter.minted, quarter.moved, quarter.pass], [4, 1, false]);
});

// "the traits that mint": a fake never mints (§15), whoever it was handed to.
test('§27 a third of minted traits taken or traded, adversarial: a fake handed over and exposed at the ferry is no minted trait; a piece taken and taken back was taken; a piece in and out of its owner\'s crew stash was not', () => {
  const taken = copy('t2', ['list', 'agent:a01', 'agent:a02', 'minted:a02']);
  // a02 forges a fake, hands it to a01, and the ferry exposes it: one of the four real pieces moved.
  const fake = copy('t3', ['agent:a02', 'agent:a01', 'gone'], { fake: true, maker: 'a02', sold: null });
  const withFake = mintedOf({ k1: kept('a01'), k2: taken, k3: kept('a02'), k4: kept('a03'), k5: fake });
  assert.deepEqual([withFake.minted, withFake.moved, withFake.pass], [4, 1, false]);
  // Taken by a02 and back by a01: taken. Into a01's crew stash and out again by a01: neither taken nor traded.
  const back = copy('t2', ['list', 'agent:a01', 'agent:a02', 'agent:a01', 'minted:a01']);
  const stash = copy('t4', ['list', 'agent:a01', 'crew:c1', 'agent:a01', 'minted:a01']);
  const m = mintedOf({ k1: back, k2: stash, k3: kept('a02') });
  assert.deepEqual([m.minted, m.moved, m.pass], [3, 1, true]);
});

// --- places matter ----------------------------------------------------------------------------------------------------
// §27: "Places matter: rerun each night with places ignored. At least 1 night's result in 5 changes. Hits backed by
// public or scouted sightings land more often than blind ones."
// A hit as the runner records it (runner.mjs:344-351): `sighted` on a public sighting, `found` when it reached its target.
const hit = (sighted, found) => ({ leader: 'r1', target: 's1', place: 'strip', sighted, found });
const placesOf = (changed, hits, length = LAST) => {
  const nights = Array.from({ length }, (_, i) => night(i + 1, { placesChanged: i < changed }));
  nights[0].hits = hits;
  return season({ cast: SHOW, nights }).bars.places;
};
// Sighted hits that land 2 of 2, blind ones 1 of 4.
const SIGHTED = [hit(true, true), hit(true, true), hit(false, true), hit(false, false), hit(false, false), hit(false, false)];

test('§27 places matter, plain: 3 nights of 14 changed and sighted hits landing 2 of 2 against blind 1 of 4 passes; 2 nights changed fails', () => {
  const three = placesOf(3, SIGHTED);
  assert.deepEqual([three.nightsChanged, three.sightedRate, three.blindRate, three.pass], [3, 1, 0.25, true]);
  assert.equal(placesOf(2, SIGHTED).pass, false);
});

// Both clauses, and "at least 1 ... in 5".
test('§27 places matter, adversarial: either clause alone fails; sighted and blind level is not "more often"; exactly 1 night in 5 is enough', () => {
  // 3 nights changed, but sighted hits land 1 of 2 and blind ones 2 of 4: level.
  const level = placesOf(3, [hit(true, true), hit(true, false), hit(false, true), hit(false, true), hit(false, false), hit(false, false)]);
  assert.deepEqual([level.sightedRate, level.blindRate, level.pass], [0.5, 0.5, false]);
  // Sighted hits land and blind ones don't, but only 2 nights of 14 changed.
  assert.equal(placesOf(2, [hit(true, true), hit(false, false)]).pass, false);
  // 1 of 5 nights changed.
  assert.equal(placesOf(1, [hit(true, true), hit(false, false)], 5).pass, true);
});

// --- the money works --------------------------------------------------------------------------------------------------
// §27: "The money works: the median Smuggler, Chemist and Dealer each out-earn the median shift worker. Most chems that
// get cooked come from Smugglers, not the city's shop. No trade's median income is more than twice another's."
// Before R4-11 report.mjs read it twice: `money` by haul and by each trade's bots, in every layer-2 cast; and, where every
// seat works a trade, `moneyEarn`, `moneyChems` and `moneyGap` by income and by every seat that works the trade. Since
// R4-11 core/bench/passbars.mjs reads it once, and those three are its clauses' own rows.
const MONEY = [
  seat('sm', 'smuggler', { trade: 'smuggler' }), seat('tu', 'turtle', { trade: 'smuggler', works: true }), seat('ch', 'chemist', { trade: 'chemist' }),
  seat('de', 'dealer', { trade: 'dealer' }), seat('gu', 'gunrunner', { trade: 'gunrunner' }), seat('co', 'cop', { trade: 'cop' }),
  seat('s1', 'hustle', { trade: 'cop' }), seat('s2', 'hustle', { trade: 'cop' }), seat('s3', 'hustle', { trade: 'cop' }),
].map(c => ({ ...c, ...L2 }));
// One season, every amount in shift wages. Incomes: the shift workers 4 (or `shifts` nights of work); the Smugglers 6
// each for the chems they hand the Chemist (8 from sm, 4 from tu); the Chemist 7 (20 for doses, less 12 to the
// Smugglers and 1 at the city's shop for 2 chems); the Dealer 10 (30 on corners, less 20); the Gunrunner 6 at the city's
// buyer; the Cop 6 on patrol (or `patrols` nights). Hauls: the shift workers 4, the Smuggler, Chemist, Gunrunner and Cop 5,
// the Dealer 8, the turtle 3.
function moneySeason({ shifts = 4, smChems = 8, tuChems = 4, shopChems = 2, kits = 0, dealerSale = 30, dealerHaul = 8, patrols = 6 } = {}) {
  const give = (from, to, goods) => ({ type: 'give', from, to, copy: null, cash: 0, goods });
  const debt = (from, to, wages) => ({ type: 'pay', from, to, amount: wages * U, for: 'debt' });
  const log = [
    // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a night's work event (wage U, agents s1-s3) is now each hustler's hustle event, a take of U each.
    ...Array.from({ length: shifts }, (_, i) => ['s1', 's2', 's3'].map(agent => ({ type: 'hustle', night: i + 1, agent, take: U }))).flat(),
    give('sm', 'ch', { chems: smChems }), debt('ch', 'sm', 6),
    ...(tuChems ? [give('tu', 'ch', { chems: tuChems })] : []), debt('ch', 'tu', 6),
    { type: 'shop', agent: 'ch', item: 'chems', units: shopChems, cash: U },
    { type: 'cook', night: 3, agent: 'ch', place: 'forest', batches: 2, chems: 8, doses: 10 },
    { type: 'cook', night: 4, agent: 'ch', place: 'forest', batches: 2, chems: 6, doses: 10 },
    give('ch', 'de', { doses: 20 }), debt('de', 'ch', 20),
    { type: 'sale', night: 5, agent: 'de', corner: 'strip-1', place: 'strip', hot: true, doses: 20, cash: dealerSale * U },
    { type: 'sell', agent: 'gu', item: 'guns', units: 1, cash: 6 * U },
    ...Array.from({ length: patrols }, (_, i) => ({ type: 'patrol', night: i + 1, agent: 'co', place: 'strip', wage: U })),
    mint('s1', 4), mint('s2', 4), mint('s3', 4), mint('sm', 5), mint('tu', 3), mint('ch', 5), mint('de', dealerHaul), mint('gu', 5), mint('co', 5),
  ];
  const state = { ...blank(MONEY), goods: { in: { kit: { chems: kits } }, out: {} } };
  return season({ cast: MONEY, log, state }).bars;
}
const moneyVerdicts = b => [b.money.pass, b.moneyEarn.pass, b.moneyChems.pass, b.moneyGap.pass];

test('§27 the money works, plain: every clause holds under both readings; each clause failing alone fails the bar', () => {
  const ok = moneySeason();
  assert.deepEqual(ok.moneyEarn.trades.map(t => [t.trade, t.income]), [['smuggler', 6 * U], ['chemist', 7 * U], ['dealer', 10 * U], ['gunrunner', 6 * U], ['cop', 6 * U]]);
  assert.deepEqual([ok.money.spread.lo, ok.money.spread.hi, ok.money.chems.smugglers, ok.money.chems.shop], [6 * U, 10 * U, 8, 2]);
  assert.deepEqual(moneyVerdicts(ok), [true, true, true, true]);
  // 1. The Dealer earns 24 on corners, 4 after its doses, level with the shift worker, and finishes with 3.
  const dealer = moneySeason({ dealerSale: 24, dealerHaul: 3 });
  assert.deepEqual(moneyVerdicts(dealer), [false, false, true, true]);
  assert.deepEqual(dealer.money.outEarn.map(x => x.pass), [true, true, false]);
  // 2. The city's shop sells the Chemist 20 chems (its price doesn't matter here), more than the Smugglers' 12.
  const shop = moneySeason({ shopChems: 20 });
  assert.deepEqual(moneyVerdicts(shop), [false, true, false, true]);
  // 3. The Dealer earns 33 on corners, 13 after its doses: more than twice the Smuggler's 6.
  const spread = moneySeason({ dealerSale: 33 });
  assert.deepEqual(moneyVerdicts(spread), [false, true, true, false]);
});

// "No trade's median income is more than twice another's": the Cop is one of the five trades (GAME.md's loop: "work a
// trade (Smuggler, Chemist, Dealer, Gunrunner or Cop)").
test('§27 the money works, adversarial: the Cop\'s income is a trade\'s income; `moneyGap` counts it', () => {
  // The Cop patrols 13 nights for 13, more than twice the Smuggler's 6.
  const b = moneySeason({ patrols: 13 });
  assert.deepEqual([b.moneyGap.hi, b.moneyGap.lo, b.moneyGap.pass], [{ trade: 'cop', income: 13 * U }, { trade: 'smuggler', income: 6 * U }, false]);
});

// R4-11: the money bar is computed once, and its spread counts the five trades, the Cop's included (a wrong verdict
// R4-10 found).
test('§27 the money works, the Cop\'s income in the `money` bar', () => {
  const b = moneySeason({ patrols: 13 });
  assert.equal(b.money.spread.pass, false, "the Cop's 13 is more than twice the Smuggler's 6");
  assert.equal(b.money.pass, false);
});

// "the median Smuggler, Chemist and Dealer each out-earn the median shift worker": by haul, as §27's crime bar reads
// "out-earns", or by income, as its third clause reads "median income"?
// R4-11, reading 6 (the orchestrator's call, 10-17): out-earn is haul (copy paid), as in the crime bar, and income stays
// as a shadow. The bar is computed once, so the clause and its own row give one verdict. R4-10 asserted one verdict by
// income.
test('§27 the money works, out-earn: the shift workers work 7 nights, so the Smuggler and the Chemist out-earn them by haul and not by income', () => {
  const b = moneySeason({ shifts: 7 });
  const byHaul = b.money.outEarn.map(x => [x.type, x.pass]);
  assert.deepEqual(byHaul, [['smuggler', true], ['chemist', true], ['dealer', true]], 'their 5 and 5 and the Dealer\'s 8 beat the shift worker\'s 4');
  assert.deepEqual(b.moneyEarn.trades.filter(t => 'pass' in t).map(t => [t.trade, t.pass]), byHaul, 'one bar, one verdict');
  assert.deepEqual(b.money.byIncome.outEarn.map(x => [x.type, x.pass]), [['smuggler', false], ['chemist', false], ['dealer', true]], 'by income, the shadow: the Smuggler\'s 6 and the Chemist\'s 7 don\'t beat 7');
});

// "Most chems that get cooked come from Smugglers, not the city's shop."
// R4-11, reading 7 (the orchestrator's call, 10-17): more than half of all the chems the Chemists cooked came from
// Smugglers, the kits and the shop counted in the total; and reading 3: the Smugglers are the seats that play the
// trade, so the turtle tu, dealt the Smuggler trade, is another seat. R4-10 counted tu's 2 with the Smugglers' 3.
test('§27 the money works, most chems: 14 cooked, 3 from the Smuggler, 2 from another seat, 2 from the shop and 9 from the kits', () => {
  const b = moneySeason({ smChems: 3, tuChems: 2, kits: 9 });
  assert.deepEqual([b.moneyChems.cooked, b.moneyChems.smugglers, b.moneyChems.others, b.moneyChems.shop, b.moneyChems.kits], [14, 3, 2, 2, 9]);
  assert.equal(b.moneyChems.pass, false);
  assert.equal(b.money.chems.pass, false);
});

// --- most of the drop sells -------------------------------------------------------------------------------------------
// §27: "Most of the drop sells: at least three in four copies sell before the list closes."
const dropOf = copies => season({ cast: CREW, state: { ...blank(CREW), copies } }).bars.dropSells;
const sold = (yes, more = {}) => ({ trait: 't1', tier: 'common', holder: yes ? { k: 'agent', id: 'a01' } : { k: 'list' }, sold: yes ? N.price.common[0] : null, hist: [], ...more });

test('§27 most of the drop sells, plain: four of four sold passes; two of four fails', () => {
  assert.deepEqual([dropOf({ k1: sold(true), k2: sold(true), k3: sold(true), k4: sold(true) }).pass], [true]);
  const half = dropOf({ k1: sold(true), k2: sold(true), k3: sold(false), k4: sold(false) });
  assert.deepEqual([half.sold, half.total, half.pass], [2, 4, false]);
});

// "at least three in four copies", of the drop: a fake was never in it.
test('§27 most of the drop sells, adversarial: exactly three in four passes, and a forged fake is no copy of the drop', () => {
  const fake = sold(false, { holder: { k: 'agent', id: 'a02' }, fake: true, maker: 'a02' });
  const m = dropOf({ k1: sold(true), k2: sold(true), k3: sold(true), k4: sold(false), k5: fake });
  assert.deepEqual([m.sold, m.total, m.share, m.pass], [3, 4, 3 / 4, true]);
});

// --- the backing rules ------------------------------------------------------------------------------------------------
// §27: "The backing rules: run A and B on the same seeds and report how often a target cut a backer of the attack on
// itself, and how often backing decided a fight." §8: under A "a backer that's attacked tonight never arrives"; under B
// "an attack from the agent its group is attacking ... doesn't cut it".
const FIGHTERS = Object.fromEntries(['a01', 'a02', 'a03'].map(id => [id, { home: true, jailed: false, crew: null, wanted: false, heat: 0, knuckles: false, runners: false, gun: false, lockpick: false, temp: false }]));
const LEVELS = { downtown: 'heavy', strip: 'normal', industrial: 'normal', suburbs: 'normal', docks: 'normal', junkyard: 'lawless', mall: 'lawless', forest: 'lawless' };
// a01 hits a03 in The Heap (lawless: no city cops) with a02 backing it, and a03 hits a02 there.
// Since R4-2 a backer joins only if its leader accepted it, so a01 names a02.
const CUT_PLAYS = { a01: { kind: 'hit', target: 'a03', place: 'junkyard', accept: ['a02'] }, a02: { kind: 'back', target: 'a01' }, a03: { kind: 'hit', target: 'a02', place: 'junkyard' } };
// That night as the runner records it (runner.mjs:354-366): the rules list a target's hit on a backer of the attack on
// it (`cutByTarget`, rules/fights.mjs:96). The fights' `targetHitBacker` is the field runner.mjs:359 kept before R4-11,
// which counted those hits; the bars now read the cut from the list and the fight's group, and ignore the field.
function cutNight(rule) {
  const backed = rule === 'B';
  return night(1, {
    cutByTarget: [{ backer: 'a02', leader: 'a01', target: 'a03' }],
    fights: [
      { kind: 'hit', target: 'a02', place: 'junkyard', winner: null, attackers: [group('a03')], arrested: [], backingDecided: false, targetHitBacker: false },
      { kind: 'hit', target: 'a03', place: 'junkyard', winner: backed ? 'a01' : null, attackers: [group('a01', backed ? ['a01', 'a02'] : ['a01'])], arrested: [], backingDecided: backed, targetHitBacker: true },
    ],
  });
}

test('§27 the backing rules, plain: under A the target\'s hit cuts the backer, and the report counts the fights, the cut and backing deciding a fight', () => {
  // The rules: under A a02 never arrives and a01 alone ties a03; under B a02 arrives and the two win.
  for (const rule of ['A', 'B']) {
    const R = resolveFights({ agents: FIGHTERS, plays: CUT_PLAYS, levels: LEVELS, rule });
    const f = R.fights.find(x => x.target === 'a03');
    const recorded = cutNight(rule).fights.find(x => x.target === 'a03');
    assert.deepEqual([R.cut, f.attackers.map(g => g.members), f.winner, f.backingDecided], [rule === 'A' ? ['a02'] : [], recorded.attackers.map(g => g.members), recorded.winner, recorded.backingDecided], rule);
    assert.deepEqual(R.cutByTarget, [{ backer: 'a02', leader: 'a01', target: 'a03' }], `${rule}: the rules list the target's hit on the backer`);
  }
  // A second night under A: a01 and a02 hit a03, nobody cuts a02, and backing decides it.
  const won = night(2, { fights: [{ kind: 'hit', target: 'a03', place: 'junkyard', winner: 'a01', attackers: [group('a01', ['a01', 'a02'])], arrested: [], backingDecided: true, targetHitBacker: false }] });
  const m = season({ cast: [seat('a01', 'scout'), seat('a02', 'hustle'), seat('a03', 'hustle')], nights: [cutNight('A'), won], rule: 'A' });
  assert.deepEqual(m.bars.backing, { fights: 3, decided: 1, targetHitBacker: 1, backed: 1 });
});

// R4-11: a target's hit counts as a cut only when the backer is missing from its leader's group in that fight, as the
// night's record shows (a wrong verdict R4-10 found).
test('§27 the backing rules, adversarial: under B the target\'s hit on the backer cuts nothing', () => {
  const m = season({ cast: [seat('a01', 'scout'), seat('a02', 'hustle'), seat('a03', 'hustle')], nights: [cutNight('B')], rule: 'B' });
  assert.deepEqual([m.bars.backing.fights, m.bars.backing.decided, m.bars.backing.backed], [2, 1, 1], 'a02 arrived and decided the fight');
  assert.equal(m.bars.backing.targetHitBacker, 0, 'no target cut a backer');
});

// --- every drug taken, and someone hooked -----------------------------------------------------------------------------
// §27: "From layer 3: every drug gets taken at least once a season, and someone gets hooked."
const DRUG_CAST = [seat('c1', 'chemist', { drugs: true }), seat('a01', 'scout', { drugs: true })];
const take = (agent, drug, more = {}) => ({ type: 'take', agent, drug, ...more });
const drugsOf = (log, state = blank(DRUG_CAST)) => season({ cast: DRUG_CAST, log, state }).bars.drugs;
const HOOK = { type: 'hooked', agent: 'a01', drug: 'temp' };

test('§27 every drug taken and someone hooked, plain: all six taken and a hook passes; five taken fails', () => {
  const all = drugsOf([...DRUGS.map(d => take('a01', d)), HOOK]);
  assert.deepEqual([all.missing, all.hooked, all.pass], [[], 1, true]);
  const five = drugsOf([...DRUGS.filter(d => d !== 'clear').map(d => take('a01', d)), HOOK]);
  assert.deepEqual([five.missing, five.pass], [['clear'], false]);
});

// "every drug gets taken": by anyone, its cook too; cooked and handed over isn't taken.
test('§27 every drug taken and someone hooked, adversarial: a drug taken only by its cook counts; one cooked and sold but never taken does not', () => {
  const log = [
    { type: 'cook', night: 2, agent: 'c1', place: 'forest', batches: 1, chems: 2, drug: 'temp', doses: 5 }, take('c1', 'temp'),
    { type: 'cook', night: 3, agent: 'c1', place: 'forest', batches: 1, chems: 2, drug: 'hallu', doses: 5 },
    { type: 'give', from: 'c1', to: 'a01', copy: null, cash: 0, goods: { hallu: 5 } },
    ...DRUGS.filter(d => d !== 'temp' && d !== 'hallu').map(d => take('a01', d)), HOOK,
  ];
  const m = drugsOf(log);
  assert.deepEqual([m.taken.temp, m.missing, m.pass], [1, ['hallu'], false]);
});

// "every drug gets taken ... someone gets hooked": the record names a SUDO dose sold as TEMP as SUDO (rules/errand.mjs:
// 612), though the `taken` sink books it as TEMP; and a crash isn't a hook.
test('§27 every drug taken and someone hooked, adversarial: SUDO taken as TEMP is SUDO taken, not TEMP; crashes without a hook fail', () => {
  const log = [
    { type: 'give', from: 'c1', to: 'a01', copy: null, cash: 0, goods: { temp: 1 } }, take('a01', 'sudo', { writer: 'c1' }),
    ...DRUGS.filter(d => d !== 'temp' && d !== 'sudo').map(d => take('a01', d)), HOOK,
  ];
  const state = { ...blank(DRUG_CAST), goods: { in: {}, out: { taken: { temp: 1, truth: 1, hallu: 1, firewall: 1, clear: 1 } } } };
  const m = drugsOf(log, state);
  assert.deepEqual([m.taken.sudo, m.taken.temp, m.missing, m.pass], [1, 0, ['temp'], false]);
  const crashes = drugsOf([...DRUGS.map(d => take('a01', d)), { type: 'crash', agent: 'a01', night: 3 }, { type: 'crash', agent: 'a01', night: 6 }]);
  assert.deepEqual([crashes.missing, crashes.hooked, crashes.pass], [[], 0, false]);
});

// --- the vault in half the seasons ------------------------------------------------------------------------------------
// §27: "From layer 4: someone jobs the vault in at least half of seasons."
const VAULT_CAST = [seat('a01', 'crew', { score: true, ...L2 }), seat('a02', 'cop', { score: true, ...L2 }), seat('s1', 'hustle', { score: true, ...L2 })];
const vaultSeason = (nights, log = [], seed = 1) => season({ cast: VAULT_CAST, nights, log, seed });
// a01's job, lost against the vault's defence: everyone in it arrested (§7).
const JOB = fight('vault', { place: 'downtown', attackers: [group('a01')], arrested: ['a01'] });

test('§27 the vault, plain: a job tried, even lost, is a season the vault was jobbed; one season in two is at least half', () => {
  const jobbed = vaultSeason([night(5, { fights: [JOB] })], [{ type: 'arrest', night: 5, agent: 'a01', why: 'fight' }]);
  assert.deepEqual(jobbed.bars.vault, { jobs: 1, pass: true });
  const none = vaultSeason([night(5)], [], 2);
  assert.deepEqual(none.bars.vault, { jobs: 0, pass: false });
  const row = summarize([jobbed, none]).rows.find(r => r.key === 'vault');
  const all = row.cells[row.cells.length - 1];
  assert.deepEqual([row.need, all.pass, all.n, all.rate >= row.need], [0.5, 1, 2, true]);
});

// "jobs the vault": a job planned and paid for, but never played, is no job.
test('§27 the vault, adversarial: a warrant handed over, a guard posted and a vault play that never reached the vault are no job', () => {
  const log = [
    { type: 'give', from: 'a02', to: 'a01', copy: null, cash: 0, goods: { warrants: 1 } },
    { type: 'guard', night: 5, agent: 'a02', place: 'downtown', wage: U },
    { type: 'invalid', agent: 'a01', play: { kind: 'vault', place: 'downtown' }, why: 'no forged warrant', kind: 'not-yet', instead: { kind: 'laylow', place: 'suburbs' } },
    { type: 'play', agent: 'a01', kind: 'laylow', place: 'suburbs', reason: '' },
  ];
  assert.deepEqual(vaultSeason([night(5)], log).bars.vault, { jobs: 0, pass: false });
});

// --- local-model agents beat the bots ---------------------------------------------------------------------------------
// §27: "Local-model agents beat the scripted bots on average. Seats: the model plays seats of the trade bots and §25's
// strategies. It never plays a crew member or one of the 3 shift workers. The comparison: each seed plays twice, once
// with the bot in the seat and once with the model. The model wins the bar when its mean haul across the paired seats
// beats the bots'."
const SEEDS = Array.from({ length: 40 }, (_, i) => 404 + i);
// The most seats the cast deals a model, found by asking for one more until it refuses.
function mostModelSeats(seed, mix) {
  let k = 0;
  for (;;) {
    try {
      makeCast(seed, { ...mix, models: k + 1 });
    } catch {
      return k;
    }
    k += 1;
  }
}

test('§27 local-model agents, seats: at the most seats a model may play, it plays every trade bot and strategy seat, the Cop\'s included, and never a crew member or a shift worker (seeds 404-443, with the squatter too)', () => {
  for (const seed of SEEDS) {
    for (const mix of [CASTS.models, { ...CASTS.models, squatter: 1 }]) {
      const cast = makeCast(seed, { ...mix, models: mostModelSeats(seed, mix) });
      const bots = [...new Set(cast.filter(c => !c.model).map(c => c.type))].sort();
      assert.deepEqual(bots, mix.squatter ? ['crew', 'hustle', 'squatter'] : ['crew', 'hustle'], `${seed}: the bots left`);
      assert.ok(cast.some(c => c.model && c.type === 'cop'), `${seed}: the Cop seat`);
    }
  }
});

// "each seed plays twice, once with the bot in the seat and once with the model": the same seat both times.
test('§27 local-model agents, the pairing: on every seed the models cast is the layer4 cast seat for seat, so a model seat\'s bot half is the same seat (seeds 404-443)', () => {
  for (const seed of SEEDS) {
    const bots = makeCast(seed, CASTS.layer4);
    for (const k of [1, 4, mostModelSeats(seed, CASTS.models)]) {
      const cast = makeCast(seed, { ...CASTS.models, models: k });
      assert.equal(cast.filter(c => c.model).length, k);
      assert.deepEqual(cast.map(({ model, ...c }) => c), bots, `${seed}, ${k} model seats`);
    }
  }
});

// R4-11, built (R2-9): each model season pairs with the bot season on its seed and rule, seat for seat, and the model
// wins when its mean haul across the paired seats beats the bots'.
test('§27 local-model agents, the comparison: one seed played with the bots and with the model in two of its seats', () => {
  const cast = models => [seat('a01', 'scout'), seat('a02', 'dealer'), seat('a03', 'turtle'), seat('a04', 'smuggler')].map(c => ({ ...c, model: models.includes(c.id) }));
  // With the bots, a01 and a02 have 2 and 4. With the model in a01 and a02, they have 4 and 3, while the bots in a03 and
  // a04 have 8. Paired: the model's mean, 3.5, beats the bots' 3 in the same seats, so the model wins. Against every
  // bot in its own season (8), or a02's model against a03's bot, it would lose.
  const bots = season({ seed: 1, cast: cast([]), log: [mint('a01', 2), mint('a02', 4), mint('a03', 6), mint('a04', 6)] });
  const model = season({ seed: 1, cast: cast(['a01', 'a02']), log: [mint('a01', 4), mint('a02', 3), mint('a03', 8), mint('a04', 8)] });
  const row = summarize([bots, model]).rows.find(r => /local-model|scripted bots/i.test(r.label));
  assert.ok(row, 'the summary reports the bar');
  assert.equal(row.cells[row.cells.length - 1].pass, 1, 'the model wins on the one seed played both ways');
});

// --- runner calls inside the ceiling ----------------------------------------------------------------------------------
// §27: "Runner calls stay inside the ceiling (§18)." §18: "The runner's ceiling is 14 calls per agent per day ... Past
// the ceiling, standing orders answer." The orchestrator's Q1 (docs/briefs/R2-agents.md): every request counts, the
// retry too.
const IN_PROCESS = `http://fake.invalid${CHAT_PATH}`;
const turn = () => new Promise(resolve => setImmediate(resolve));
const OK = { json: { actions: [] } };
// One seat on the fake, on a manual clock, briefed with the reply format and the day: the ceiling counts requests, not
// what they say. `point(round)` is one call point by day; while the fake holds a request with no reply (a hang), the
// clock moves on to the end of its window.
function seatOnFake(script) {
  const g = new Game({ n: 2 });
  const clock = manualClock(0);
  const fake = fakeModel({ script: { a01: script }, clock });
  const brief = r => [{ role: 'system', content: replyFormat('seat') }, { role: 'user', content: JSON.stringify({ day: r.view.day }) }];
  const s = makeSeat({ id: 'a01', url: IN_PROCESS, fetch: fake.fetch, secret: 'a per-season secret', brief, clock });
  const apply = e => {
    const r = g.errand('a01', e.kind, e);
    return { ok: r.ok, why: r.why };
  };
  const point = async round => {
    let done = false;
    const p = s.call({ view: g.view('a01'), round, apply });
    p.then(() => { done = true; }, () => { done = true; });
    while (!done) {
      if (fake.calls.some(c => c.outcome === 'pending')) await clock.advance(N['gap.window'] * 1000);
      else await turn();
    }
    return p;
  };
  return { seat: s, fake, point };
}
const requestsOn = (s, day) => s.record.filter(r => r.day === day).flatMap(r => r.attempts).filter(a => a.call !== null).length;

test('§27 runner calls inside the ceiling, plain: a seat called once past the ceiling in a day sends N.callCeiling requests and answers the last call point without calling', async () => {
  const { seat: s, fake, point } = seatOnFake(Array.from({ length: N.callCeiling + 1 }, () => OK));
  const outs = [];
  for (let i = 0; i <= N.callCeiling; i++) outs.push(await point(1 + (i % 3)));
  assert.deepEqual([fake.calls.length, requestsOn(s, 1)], [N.callCeiling, N.callCeiling]);
  assert.deepEqual([outs[outs.length - 1].calls, outs[outs.length - 1].outcome], [0, 'ceiling']);
  await fake.close();
});

// "every request counts, the retry too": a call point that times out and retries spends two.
test('§27 runner calls inside the ceiling, adversarial: a retry counts against the ceiling, so it is reached a call point early', async () => {
  // The second request hangs past its window and is retried.
  const { seat: s, fake, point } = seatOnFake(Array.from({ length: N.callCeiling + 1 }, (_, i) => (i === 1 ? { fault: 'hang' } : OK)));
  const outs = [];
  for (let i = 0; i < N.callCeiling; i++) outs.push(await point(1 + (i % 3)));
  assert.deepEqual([fake.calls.length, requestsOn(s, 1)], [N.callCeiling, N.callCeiling]);
  assert.deepEqual(outs[1].calls, 2, 'the timed-out call point and its retry');
  assert.deepEqual([outs[outs.length - 1].calls, outs[outs.length - 1].outcome], [0, 'ceiling']);
  await fake.close();
});

// R4-11, built (R2-9): the runner hands the model seats' records to the bars, which read each seat-day's requests
// against N.callCeiling.
test('§27 runner calls inside the ceiling, the verdict: a season\'s report reads its seats\' calls against the ceiling', () => {
  // The seat's record (agents/seat.mjs:43) of day 3, each request numbered on from the season's earlier calls: call
  // points by day and at the lock, one by day and the lock's timing out and retrying, one request more than the ceiling.
  let call = 30;
  const point = (round, tries) => ({ day: 3, round, origin: 'model', attempts: Array.from({ length: tries }, (_, i) => ({ call: ++call, outcome: i < tries - 1 ? 'timeout' : 'reply' })) });
  const record = [...Array.from({ length: N.callCeiling - 3 }, (_, i) => point(1 + (i % 3), 1)), point(2, 2), point('lock', 2)];
  assert.equal(record.flatMap(r => r.attempts).length, N.callCeiling + 1);
  const cast = [seat('a01', 'scout', { model: true }), seat('a02', 'hustle', { model: false })];
  const m = seasonMetrics(blank(cast), [], { seed: 1, rule: 'A', midseason: 'payday', nights: [], models: { seats: { a01: { record } } } }, cast);
  assert.doesNotMatch(seasonReport(m), /Waiting for R2[^\n]*ceiling/, 'the report gives the bar');
  assert.match(seasonReport(m), /ceiling[^\n]*FAIL/);
});

// --- invalid plays ----------------------------------------------------------------------------------------------------
// §27: "Invalid plays are typed, logged and replaced by the default play, and the report gives the rate per model.
// There's no bar: it's a hygiene number, and choices are never hidden to lower it (§33)."
test('§27 invalid plays, plain: a hit on itself is typed, logged and replaced by the default play, and the report counts it against its seat\'s plays', () => {
  const g = new Game({ n: 2 });
  const instead = defaultPlay(g.s, 'a01', 1);
  g.night({ a01: { kind: 'hit', target: 'a01', place: 'strip' }, a02: { kind: 'hustle', place: 'docks' } }, { exact: true });
  const [bad] = g.events('invalid');
  assert.deepEqual([bad.agent, typeof bad.why, ['not-yet', 'never'].includes(bad.kind), bad.instead], ['a01', 'string', true, instead]);
  const [played] = g.events('play', e => e.agent === 'a01');
  assert.deepEqual({ kind: played.kind, place: played.place }, instead, 'the default play is played');
  const m = seasonMetrics(g.s, g.log, { seed: 404, rule: 'A', midseason: 'blackout', nights: [] }, [seat('a01', 'scout'), seat('a02', 'hustle')]);
  assert.deepEqual([m.bars.invalid.scout, m.bars.invalid.hustle], [{ plays: 1, invalid: 1, rate: 1 }, { plays: 1, invalid: 0, rate: 0 }]);
});

// "Invalid plays": a play forced by a crash (rules/night.mjs:61-74: "typed as forced, never invalid") and an errand
// refused by day are not invalid plays.
test('§27 invalid plays, adversarial: a forced play and a refused errand are no invalid plays', () => {
  const cast = [seat('a01', 'scout'), seat('a02', 'hustle')];
  const laylow = { kind: 'laylow', place: 'suburbs' };
  const log = [
    { type: 'invalid', agent: 'a02', errand: 'offer', why: 'not enough cash', kind: 'not-yet' },
    { type: 'forced', agent: 'a01', play: { kind: 'hit', place: 'strip', target: 'a02' }, why: 'crash', instead: laylow },
    { type: 'play', agent: 'a01', ...laylow, reason: '' }, { type: 'play', agent: 'a02', kind: 'hustle', place: 'docks', reason: '' },
  ];
  const m = season({ cast, log });
  assert.deepEqual([m.bars.invalid.scout, m.bars.invalid.hustle], [{ plays: 1, invalid: 0, rate: 0 }, { plays: 1, invalid: 0, rate: 0 }]);
  assert.equal(m.errandsInvalid.total, 1);
});

// R4-11, built (R2-9): the bots' rows are the bots' alone, and each model has a row of its own (`invalidByModel`).
test('§27 invalid plays, the rate per model: a model seat\'s invalid plays apart from its bot type\'s', () => {
  const cast = [seat('a01', 'scout', { model: true }), seat('a02', 'scout', { model: false })];
  const laylow = { kind: 'laylow', place: 'suburbs' };
  const log = [
    { type: 'season', agents: [{ id: 'a01', driver: 'fake' }, { id: 'a02', driver: 'bot' }] },
    { type: 'invalid', agent: 'a01', play: { kind: 'unknown' }, why: 'unknown play kind', kind: 'never', instead: laylow },
    { type: 'play', agent: 'a01', ...laylow, reason: '' }, { type: 'play', agent: 'a01', kind: 'hustle', place: 'docks', reason: '' },
    { type: 'play', agent: 'a02', kind: 'hustle', place: 'docks', reason: '' }, { type: 'play', agent: 'a02', kind: 'hustle', place: 'docks', reason: '' },
  ];
  assert.deepEqual(season({ cast, log }).bars.invalid.scout, { plays: 2, invalid: 0, rate: 0 });
});

// --- across seasons ---------------------------------------------------------------------------------------------------
// §27's thresholds across seasons: buy-late and turtle "in at least 90% of seasons", the Cop and the Gunrunner "in at
// least 30% of seasons", the vault "in at least half of seasons". The summary carries each as `need` beside the count.
test('§27 across seasons: the summary carries each bar\'s share of seasons as §27 words it, and nine of ten seasons is at least 90%', () => {
  const cast = [seat('b1', 'buylate'), seat('t1', 'turtle'), seat('s1', 'hustle'), seat('g1', 'gunrunner'), seat('c1', 'cop')].map(c => ({ ...c, score: true, ...L2 }));
  // Ten seeds: the buy-late bot below the median haul on nine, above it on the tenth.
  const results = SEEDS.slice(0, 10).map((seed, i) => season({ seed, cast, log: [mint('b1', i === 9 ? 9 : 1), mint('t1', 1), mint('s1', 2 + i), mint('g1', 3), mint('c1', 4)] }));
  const sum = summarize(results);
  const need = Object.fromEntries(sum.rows.filter(r => r.need != null).map(r => [r.key, r.need]));
  assert.deepEqual(need, { buyLate: 0.9, turtle: 0.9, copGunrunner: 0.3, vault: 0.5 });
  const row = sum.rows.find(r => r.key === 'buyLate');
  const all = row.cells[row.cells.length - 1];
  assert.deepEqual([all.pass, all.n, all.count.distinct, all.count.of, all.rate >= row.need], [9, 10, 9, 10, true]);
});

// "in at least half of seasons", when rules A and B play one season on a seed (§41, 10-17: "rules A and B often play
// the same season").
// R4-11, reading 8 (the orchestrator's call, 10-17): the 90%, 30% and half thresholds count distinct seasons.
test('§27 across seasons, A and B playing the same season: seed 1 plays one season under both rules, with a vault job; seed 2 plays two without one', () => {
  const job = { log: [], nights: [night(5, { fights: [JOB] })] };
  const quiet = n => ({ log: [{ type: 'arrest', night: n, agent: 's1', why: 'heat' }], nights: [night(5)] });
  const results = [[1, 'A', job], [1, 'B', job], [2, 'A', quiet(3)], [2, 'B', quiet(4)]].map(([seed, rule, x]) => season({ seed, rule, cast: VAULT_CAST, ...x }));
  const row = summarize(results).rows.find(r => r.key === 'vault');
  const all = row.cells[row.cells.length - 1];
  assert.deepEqual([all.pass, all.n, all.count.distinct, all.count.of], [2, 4, 1, 3]);
  assert.equal(all.rate, all.count.distinct / all.count.of, "the bar's share of seasons is its share of distinct seasons");
});
