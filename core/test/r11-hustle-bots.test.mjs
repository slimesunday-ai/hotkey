// R11, the bots and hustles (docs/briefs/R11-hustles.md, "The bots"): the hustler bot hustles every night where the take
// it can see is best, from public facts only (tonight's levels on the board, everyone's heat on the board, the record's
// latest public hustles and hits); it takes no star that would make it wanted, and after a night it was robbed it
// hustles somewhere else. Every other bot that took a shift takes a hustle by the same choice, and with any star at all
// takes one that adds none. Bots see only what a player may see (trunk CLAUDE.md). Nothing here calls a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { rng } from '../rng.mjs';
import { N } from '../numbers.mjs';
import { DISTRICTS, hustleTake, hustleStar } from '../rules/state.mjs';

const bots = () => import('../bench/bots.mjs');
const LAY = { kind: 'laylow', place: 'suburbs' };
const hustle = place => ({ kind: 'hustle', place });
const housed = g => Object.keys(g.s.agents).forEach(id => g.grant(id, 2 * N.nights * N.rent));
const nightOf = (bot, g, id) => bot.night(g.view(id), { seed: 404, day: g.s.day, round: 'night', rng: rng(404, 'bot', id, g.s.day, 'night') });
// The view's public parts the choice may read, and nothing else: the agent's own id and heat, tonight's levels and the
// board's agents (heat, jail, boarded), the day, the midseason event, and the events the view holds.
const publicOnly = v => ({
  day: v.day, midseason: v.midseason, events: v.events,
  me: { id: v.me.id, heat: v.me.heat },
  board: { tonight: v.board.tonight, police: v.board.police, agents: v.board.agents.map(a => ({ id: a.id, heat: a.heat, jailed: a.jailed, boarded: a.boarded })) },
});

test('the choice reads only public facts: the same place and take from the view\'s public parts alone, whatever the hidden state', async () => {
  const { hustleChoice } = await bots();
  const g = new Game({ n: 8 });
  housed(g);
  g.night({ a01: hustle('downtown'), a02: hustle('downtown'), a03: hustle('downtown'), a04: hustle('strip'), a05: hustle('mall') }, { filler: LAY });
  const full = g.view('a06');
  const want = hustleChoice(full);
  assert.deepEqual(hustleChoice(publicOnly(full)), want, 'nothing outside the public parts moves it');
  // Hidden state: another agent's cash and goods, and a private errand's record, change nothing the choice reads.
  g.grant('a02', 5000);
  g.s.agents.a03.goods.chems = 9;
  assert.deepEqual(hustleChoice(g.view('a06')), want);
  assert.ok(DISTRICTS.includes(want.place));
  assert.equal(want.level, full.board.tonight[want.place]);
});

test('it spreads: last night\'s crowd in Glasswall, every reader of the same facts takes a share of the districts', async () => {
  const { hustleChoice } = await bots();
  const g = new Game({ n: 12 });
  housed(g);
  const all = Object.fromEntries(Object.keys(g.s.agents).map(id => [id, hustle('downtown')]));
  g.night(all, { exact: true });
  const picks = Object.keys(g.s.agents).map(id => hustleChoice(g.view(id), N.wantedAt - 1).place);
  const by = picks.reduce((m, p) => ({ ...m, [p]: (m[p] || 0) + 1 }), {});
  assert.ok(Object.keys(by).length >= 4, `twelve hustlers across at least four districts: ${JSON.stringify(by)}`);
  assert.ok(Math.max(...Object.values(by)) < picks.length, 'not one district for all');
  // Each one's take counts the others it places with it, as the night will.
  for (const id of Object.keys(g.s.agents)) {
    const h = hustleChoice(g.view(id), N.wantedAt - 1);
    assert.equal(h.take, hustleTake(h.level, by[h.place] - 1), `${id} at ${h.place}`);
  }
});

test('before any hustle is on the record (night 1), it places everyone on the board, so night 1 doesn\'t pile into one district', async () => {
  const { hustleChoice } = await bots();
  const g = new Game({ n: 16 });
  const picks = Object.keys(g.s.agents).map(id => hustleChoice(g.view(id)).place);
  assert.ok(new Set(picks).size >= 5, JSON.stringify(picks));
});

test('it takes no star that would make it wanted: at N.wantedAt - 1 stars the hustler picks a district that adds none', async () => {
  const { hustleChoice, makeBot } = await bots();
  const g = new Game({ n: 3 });
  housed(g);
  g.s.agents.a01.heat = N.wantedAt - 1;
  const h = hustleChoice(g.view('a01'), N.wantedAt - 1);
  assert.equal(hustleStar(h.level), 0, `${h.place} is ${h.level}`);
  const cool = hustleChoice(g.view('a02'), N.wantedAt - 1);
  assert.equal(cool.place, 'downtown', 'with no star yet, heavy Glasswall takes the most');
  // The hustler bot plays its choice, every night, with its reason.
  const bot = makeBot({ id: 'a01', type: 'hustle', trade: 'cop', fav: 'docks', route: 'downtown' }, {});
  const p = nightOf(bot, g, 'a01');
  assert.deepEqual(p.play, hustle(h.place));
  assert.ok(p.reason.startsWith('a hustle always pays'), p.reason);
});

test('every other bot takes its hustle by the same choice, and with any star at all takes one that adds none', async () => {
  const { makeBot, hustleChoice } = await bots();
  const g = new Game({ n: 4 });
  housed(g);
  g.s.agents.a01.heat = 1;
  g.s.agents.a02.heat = 1;
  const hustler = makeBot({ id: 'a01', type: 'hustle', trade: 'cop', fav: 'docks', route: 'downtown' }, {});
  const turtle = makeBot({ id: 'a02', type: 'turtle', trade: 'cop', fav: 'docks', route: 'downtown' }, {});
  const h = nightOf(hustler, g, 'a01').play;
  const t = nightOf(turtle, g, 'a02').play;
  assert.equal(hustleStar(g.s.districts[h.place].level), N.workHeat, 'the hustler at 1 star still takes a starred district');
  assert.equal(t.kind, 'hustle');
  assert.equal(hustleStar(g.s.districts[t.place].level), 0, 'the turtle at 1 star takes one that adds none');
  assert.deepEqual(t, hustle(hustleChoice(g.view('a02'), 1).place));
});

test('after a night it was robbed, it hustles somewhere else', async () => {
  const { hustleChoice } = await bots();
  // A lone hustler in the lawless Mall loses the tie to a hit (gap.jump 'alone'), on the public record as a won fight.
  const m = new Game({ n: 3 });
  housed(m);
  m.night({ a01: hustle('mall'), a02: { kind: 'hit', target: 'a01', place: 'mall' } }, { filler: LAY });
  assert.ok(m.events('fight').at(-1).won);
  // Lawless districts only (N.wantedAt - 1 stars), and the Mall was a01's: it takes another lawless one.
  m.s.agents.a01.heat = N.wantedAt - 1;
  const after = hustleChoice(m.view('a01'));
  const bystander = hustleChoice(m.view('a03'), N.wantedAt - 1);
  assert.equal(bystander.place, 'downtown', 'a03 was not robbed, and its choice is its own');
  assert.notEqual(after.place, 'mall', 'not the Mall again');
  assert.equal(hustleStar(after.level), 0, 'and still no star at N.wantedAt - 1');
});

test('the take it weighs its trade against is the hustle it would take, doubled on Payday as the night will', async () => {
  const { hustleChoice } = await bots();
  const agents = Array.from({ length: 3 }, (_, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: 'smuggler', driver: 'test' }));
  const g = new Game({ n: 1 });
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'payday', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  housed(g);
  for (let n = 1; n < 7; n++) g.night({}, { filler: LAY });
  // Nobody has hustled yet, so each places all three; each plays its own choice, and the night pays what each read.
  const ids = Object.keys(g.s.agents);
  const read = Object.fromEntries(ids.map(id => [id, hustleChoice(g.view(id))]));
  const at = place => ids.filter(id => read[id].place === place).length;
  for (const id of ids) assert.equal(read[id].take, hustleTake(read[id].level, at(read[id].place) - 1, true), `${id}: night 7 is Payday`);
  const night = g.night(Object.fromEntries(ids.map(id => [id, hustle(read[id].place)])), { exact: true });
  for (const id of ids) assert.equal(night.newEvents.find(e => e.type === 'hustle' && e.agent === id).take, read[id].take, `${id}: paid what it read`);
});
