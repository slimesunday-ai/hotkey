// R4-2, the bots and the agents under acceptance (trunk docs/briefs/R4-astra-fixes.md, task 2; GAME.md §8, §12, §33;
// GAP gap.accept). A back joins a group only if its leader accepted it before the lock: with no list, its crewmates.
// - Bots, from their own view (`viewFor(..., 'agent')`): a leader accepts its crew and whoever it arranged a back with
//   tonight: the agents that promised it in a sit-down (hired muscle, a crew's mates), the Cops its police plan puts in a
//   collar it leads, and a taker it wrote a SUDO play for; its crewmates first, then the rest in the order the
//   arrangements were made; and a play names its list only when someone outside its crew is on it. Nobody accepts a
//   turn it never arranged.
// - The tools: any play but a back may carry `accept`, a list of agents on the board, typed like a hit's want.
// - The briefing and the menu say the rule in plain rules text, with no advice.
// Each test imports what it needs itself, so each fails on its own before the rule exists. Amounts come from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { rng } from '../rng.mjs';
import { N } from '../numbers.mjs';

const bots = () => import('../bench/bots.mjs');
const tools = () => import('../agents/tools.mjs');
const YARDS = 'industrial';
function stock(g, id, kind, n = 1) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
// a02 promises a01, in a sit-down a01 asked for, to back it tonight.
function promise(g, by, to) {
  assert.equal(g.errand(to, 'ask', { to: by }).ok, true);
  const sd = g.events('ask').at(-1).sitdown;
  assert.equal(g.errand(by, 'answer', { sitdown: sd, accept: true }).ok, true);
  assert.equal(g.errand(by, 'say', { sitdown: sd, say: 'promise', terms: { what: 'back', who: to, night: g.s.day } }).ok, true);
}
const crew = (g, founder, ...members) => {
  g.errand(founder, 'crew_form', { name: founder });
  for (const m of members) {
    g.errand(founder, 'crew_invite', { agent: m });
    g.errand(m, 'crew_join', { crew: g.s.agents[founder].crew });
  }
};

test("a leader accepts, from its own view, the agents that promised to back it tonight, after its crewmates; a play that needs only its crew names no list, and nobody's turn it never arranged is on it", async () => {
  const { acceptFor } = await bots();
  const hit = { kind: 'hit', target: 'a05', place: YARDS };
  let g = new Game({ n: 5 });
  promise(g, 'a02', 'a01');
  assert.deepEqual(acceptFor(g.view('a01'), {}, hit), { ...hit, accept: ['a02'] }, 'hired: the muscle that promised');
  g = new Game({ n: 5 });
  crew(g, 'a01', 'a03');
  assert.deepEqual(acceptFor(g.view('a01'), {}, hit), hit, 'its crew alone: no list, the default accepts them');
  promise(g, 'a03', 'a01');
  assert.deepEqual(acceptFor(g.view('a01'), {}, hit), hit, 'a crewmate that promised: still no list');
  promise(g, 'a04', 'a01');
  promise(g, 'a02', 'a01');
  assert.deepEqual(acceptFor(g.view('a01'), {}, hit).accept, ['a03', 'a04', 'a02'], 'its crewmate first, then the hired, in the order they promised');
  // The target of a turn: a04 promised a01 and backs a05 instead; a05 arranged nothing with it.
  const shift = { kind: 'hustle', place: YARDS };
  assert.deepEqual(acceptFor(g.view('a05'), {}, shift), shift, 'the target names nobody');
  assert.deepEqual(acceptFor(g.view('a02'), {}, { kind: 'back', target: 'a01' }), { kind: 'back', target: 'a01' }, 'a back names no list');
});

test('a robber whose crash forces the default play tonight sends that play, naming the muscle it hired, so the muscle guards it at home (§11)', async () => {
  const { acceptFor } = await bots();
  const g = new Game({ n: 4 });
  g.grant('a01', 3 * N.rent);
  stock(g, 'a01', 'temp');
  assert.equal(g.errand('a01', 'take', { drug: 'temp' }).ok, true);
  g.night({ a01: { kind: 'laylow' } });
  promise(g, 'a02', 'a01');
  const v = g.view('a01');
  assert.deepEqual([v.me.crash, v.legal], [true, [{ kind: 'laylow', place: 'suburbs' }]], 'control: its menu holds the default alone');
  const play = acceptFor(v, {}, { kind: 'hit', target: 'a03', place: YARDS });
  assert.deepEqual(play, { kind: 'laylow', place: 'suburbs', accept: ['a02'] });
  const r = g.night({ a01: play, a02: { kind: 'back', target: 'a01' } });
  assert.deepEqual([r.fights.groups.a01, r.fights.where.a02], [['a01', 'a02'], { at: 'home', home: 'a01' }]);
});

test('through the night: the hired muscle the robber accepted is in its group, and an uninvited agent backing the same robber stays home', async () => {
  const { acceptFor } = await bots();
  const g = new Game({ n: 4 });
  stock(g, 'a02', 'guns');
  promise(g, 'a02', 'a01');
  const play = acceptFor(g.view('a01'), {}, { kind: 'hit', target: 'a03', place: YARDS });
  const r = g.night({ a01: play, a02: { kind: 'back', target: 'a01' }, a04: { kind: 'back', target: 'a01' }, a03: { kind: 'hustle', place: YARDS } });
  const f = r.fights.fights.find(x => x.target === 'a03');
  assert.deepEqual([f.attackers[0].members, f.attackers[0].strength, f.winner, r.fights.unaccepted], [['a01', 'a02'], 3, 'a01', ['a04']]);
});

// The collars test's street (collars.test.mjs): two seats that work the Cop trade, the Cop seat, a Dealer that turns
// wanted on night 2, a shift worker that's a Cop on paper and a Smuggler; every Cop patrolled night 1.
async function street() {
  const { makeBot } = await bots();
  const cfgs = [
    { type: 'buylate', trade: 'cop', works: true, every: true }, { type: 'buylate', trade: 'cop', works: true, every: true },
    { type: 'cop', trade: 'cop', driver: 'bot:cop', every: true }, { type: 'dealer', trade: 'dealer', every: true },
    { type: 'hustle', trade: 'cop', every: true }, { type: 'smuggler', trade: 'smuggler', every: true },
  ];
  const agents = cfgs.map((c, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: c.trade, driver: c.driver || 'test' }));
  const g = new Game({ n: 1 });
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  for (let i = 1; i <= 6; i++) g.grant(idOf(i), 100);
  stock(g, 'a04', 'guns');
  const patrol = { kind: 'patrol', place: 'docks' };
  g.night({ a01: patrol, a02: patrol, a03: patrol, a04: { kind: 'laylow' } });
  g.s.agents.a04.heat = N.wantedAt - 1;
  g.night({ a01: patrol, a02: patrol, a03: patrol, a04: { kind: 'deal', corner: 'strip-1' } });
  assert.equal(g.s.agents.a04.heat, N.wantedAt, 'the hot corner made a04 wanted');
  const cfg = Object.fromEntries(agents.map((a, i) => [a.id, { id: a.id, fav: 'industrial', route: 'downtown', layer: 2, ...cfgs[i] }]));
  const play = id => makeBot(cfg[id], {}).night(g.view(id), { seed: 404, day: g.s.day, round: 'night', rng: rng(404, 'bot', id, g.s.day, 'night') }).play;
  return { g, play };
}

test("the Cop seat leading a collar accepts the Cops its police plan puts in the group, read off public facts as they read it, and they're its group", async () => {
  const { policePlan } = await bots();
  const { g, play } = await street();
  const plan = policePlan(g.view('a03'), false);
  assert.deepEqual([plan.lead, plan.group], ['a03', ['a03', 'a01', 'a02']], 'control: one plan, the Cop seat leading');
  const plays = Object.fromEntries(['a01', 'a02', 'a03'].map(id => [id, play(id)]));
  assert.deepEqual(plays.a03, { kind: 'collar', target: 'a04', place: 'suburbs', accept: ['a01', 'a02'] });
  assert.deepEqual([plays.a01, plays.a02], [{ kind: 'back', target: 'a03' }, { kind: 'back', target: 'a03' }]);
  const r = g.night({ ...plays, a04: { kind: 'laylow' } });
  const f = r.fights.fights.find(x => x.kind === 'collar');
  assert.deepEqual([f.attackers[0].members, f.winner, r.fights.unaccepted], [['a03', 'a01', 'a02'], 'a03', []]);
});

test('the SUDO seller accepts the taker whose play it wrote (a back on itself, a bodyguard), from its own record of the write, and the bodyguard defends it', async () => {
  const { acceptFor } = await bots();
  const g = new Game({ n: 3 });
  stock(g, 'a01', 'sudo');
  stock(g, 'a03', 'guns');
  assert.equal(g.errand('a01', 'give', { to: 'a02', goods: { sudo: 1 } }).ok, true);
  assert.equal(g.errand('a02', 'take', { drug: 'temp' }).ok, true);
  assert.equal(g.errand('a01', 'write', { agent: 'a02', play: { kind: 'back', target: 'a01' } }).ok, true);
  const shift = { kind: 'hustle', place: YARDS };
  const mine = acceptFor(g.view('a01'), {}, shift);
  assert.deepEqual(mine, { ...shift, accept: ['a02'] });
  const r = g.night({ a01: mine, a02: { kind: 'laylow' }, a03: { kind: 'hit', target: 'a01', place: YARDS } });
  assert.equal(r.newEvents.find(e => e.type === 'forced' && e.agent === 'a02').why, 'sudo', "control: the written play is a02's");
  const f = r.fights.fights.find(x => x.target === 'a01');
  // a01 and its bodyguard, 1 each, against a03 and its gun: a tie, a01 holds. Alone it would lose 1 to 2.
  assert.deepEqual([f.defenders, f.defence, f.attackers[0].strength, f.winner, f.backingDecided], [['a01', 'a02'], 2, 2, null, true]);
});

test('the tools: any play but a back may carry accept, a list of agents on the board, kept through the reply as the rules take it; one naming an agent off the board is refused, typed; the reply format names the field', async () => {
  const { read, reply, replyFormat } = await tools();
  const g = new Game({ n: 4 });
  const { deal, result } = read(g.view('a01'), { audience: 'seat', seed: 'secret' });
  const line = kind => result.menu.find(m => m.kind === kind).n;
  const send = action => reply({ actions: [{ act: 'play', ...action }] }, { deal, apply: () => ({ ok: true }), tries: {} });
  let out = send({ menu: line('hit'), target: 'a02', place: YARDS, accept: ['a03', 'a04'] });
  assert.deepEqual(out.play, { kind: 'hit', target: 'a02', place: YARDS, accept: ['a03', 'a04'] });
  out = send({ menu: line('hustle'), accept: [] });
  assert.deepEqual(out.play.accept, [], 'an empty list: nobody');
  out = send({ menu: line('back'), target: 'a02', accept: ['a03'] });
  assert.equal(out.play, null, 'inapplicable back accept is refused rather than silently dropped');
  assert.equal(out.results[0].ok, false); assert.match(out.results[0].why, /inapplicable fields accept/);
  out = send({ menu: line('back'), target: 'a02' });
  assert.deepEqual(out.play, { kind: 'back', target: 'a02' }, 'valid back still reaches the rules');
  out = send({ menu: line('hit'), target: 'a02', place: YARDS, accept: ['a99'] });
  assert.deepEqual([out.play, out.results[0].ok, out.results[0].kind], [null, false, 'never']);
  assert.match(out.results[0].why, /^accept: /);
  const format = replyFormat('seat');
  assert.ok(/"accept"\?\s*:\s*agents/.test(format), 'the play action names the field');
  assert.ok(format.includes('- agents: agent ids'), 'and its type');
});

test('the briefing says the rule once, in rules text: a group is an agent and its backers, its crew or only its "accept" list, in order; the menu doesn\'t repeat it; no advice', async () => {
  const { read } = await tools();
  const { briefing } = await import('../agents/briefing.mjs');
  const g = new Game({ n: 4 });
  g.hand('a02', tierCopy(g.s, 'rare'), { wear: true });
  const msgs = briefing(read(g.view('a01'), { audience: 'seat', seed: 'secret' }).result);
  const [system, user] = msgs.map(m => m.content);
  const rule = `a group is an agent and its backers, ${N.groupMax} at most: its crew, or only its "accept" list, in order.`;
  assert.ok(system.includes(rule), 'the fights');
  assert.equal(system.split(rule).length - 1, 1, 'said once, in the rules');
  assert.ok(/"accept"\?\s*:\s*agents/.test(system) && !user.includes('"accept"'), "the reply format names the field, and the day and its menu don't say it again");
  assert.ok(!/\b(you should|recommend|advice|consider|try to|make sure|worth it)\b/i.test(`${system}\n${user}`), 'no advice');
  assert.ok(system.length + user.length <= N['gap.briefing'].chars, 'it keeps its budget');
});
