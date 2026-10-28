// Layer 4's fakes and who can tell (GAME.md §4, §9, §15, §19, §38; brief R1-layer4-score.md, task L4-2, its fills and
// calls 1 and 2), with the rows in core/numbers.mjs (build, gap.fakes). Every expected value was worked out from GAME.md,
// the brief and those rows before the code ran, and every amount is read from N (or from the state the test set up), so
// tuning a number never breaks a test here. A fake's copy id is a stop-gap (call 1: before R2 it takes the id of the
// real copy it imitates), so no test here reads its form.
// Who can tell a fake (§19): an agent wearing shades, about the pieces other agents wear; the fence; its maker; and
// everyone at the ferry. Each audience has its canary below, and the last test sweeps every view for a tell before then.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, tierCopy, abilityCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkPlay } from '../rules/plays.mjs';
import { checkLedger, ledgerProblems } from '../rules/ledger.mjs';
import { DAY15, addGoods, moveCopy } from '../rules/state.mjs';
import { withOverrides } from '../bench/runner.mjs';
import { N } from '../numbers.mjs';

// A view that tells a fake has a `fake` field somewhere (a piece marked, or a play naming the trait it faked); and the
// fence's refusal (GAP gap.fakes). A craft's count, `fakes`, isn't one.
const MARK = '"fake":';
const REFUSED = 'the fence takes no fakes';
const has = (v, secret) => JSON.stringify(v).includes(secret);
const label = v => `${v.audience}${v.me ? ` (${v.me.id})` : ''}`;
const of = (r, type, pred = () => true) => r.newEvents.filter(e => e.type === type && pred(e));
// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the helpers' filler is a hustle at the Mall now; a test whose hit finds a filler at the docks passes this one.
const DOCKS = { filler: { kind: 'hustle', place: 'docks' } };

// A season whose agents have the trades named, in id order (the helpers' cast is all Smugglers).
function withTrades(trades) {
  const g = new Game({ n: 1 });
  const agents = trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' }));
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
// Test-only goods, in through a named source (out, when n is below 0), so the books still balance.
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
// The rent for a whole season and more, so nobody named is evicted.
const housed = (g, ids = Object.keys(g.s.agents)) => ids.forEach(id => g.grant(id, 2 * N.nights * N.rent));
// The drop's traits of a tier with no ability, in id order; and the trait with an ability.
const plain = (g, tier, pred = () => true) => Object.values(g.s.traits).filter(t => t.tier === tier && !t.ability && pred(t)).sort((x, y) => (x.id < y.id ? -1 : 1));
const withAbility = (g, ability) => Object.values(g.s.traits).find(t => t.ability === ability);
// A fake of `trait`, built at home tonight by the Gunrunner `maker` (everyone else as `plays` says, or a shift).
// Returns its copy, from its maker's own record of it.
function forge(g, maker, trait, plays = {}) {
  stock(g, maker, 'parts', N.build.fakes);
  const r = g.night({ ...plays, [maker]: { kind: 'build', fake: trait } });
  const made = of(r, 'fake', e => e.act === 'made' && e.agent === maker);
  assert.equal(made.length, 1, `control: ${maker} made a fake of ${trait}`);
  return made[0].copy;
}
// Every audience's view: each agent's own and its owner's AI's, the public view and the 24-hour record.
const allViews = g => [...Object.keys(g.s.agents).sort().flatMap(id => [g.view(id), g.view(id, 'ownerAI')]), g.view(null, 'public'), g.view(null, 'record')];
const fitOf = (v, id) => v.board.agents.find(a => a.id === id).fit || [];
const marked = (v, id) => fitOf(v, id).filter(p => p.fake).map(p => p.copy);

// --- building a fake (§9, §38) --------------------------------------------------------------------------------------

test("a Gunrunner builds a fake of any trait at home, an optional field of build that the legal plays never list: build.fakes parts, one a night, inside its parts a night; it's a new copy outside its trait's copies, unworn in its maker's stash (§4, §9, §38; GAP gap.fakes)", () => {
  const g = withTrades(['gunrunner', 'gunrunner', 'smuggler']);
  housed(g);
  // Any trait: a grail, though grails aren't on the list yet.
  const T = plain(g, 'grail')[0];
  assert.ok(T.opens > g.s.day, 'control: not open on the list tonight');
  const drop = new Set(Object.keys(g.s.copies));
  const traitCopies = () => Object.fromEntries(Object.values(g.s.traits).map(t => [t.id, [...t.copies]]));
  const before = traitCopies();
  const parts = id => g.s.agents[id].goods.parts || 0;
  stock(g, 'a01', 'parts', N.build.fakes);
  stock(g, 'a02', 'parts', N.build.guns);
  const kept = parts('a01') - N.build.fakes;
  assert.ok(g.view('a01').legal.some(p => p.kind === 'build'), 'control: it can build tonight');
  assert.ok(g.view('a01').legal.every(p => !('fake' in p)), 'the legal plays list no fake');
  const r = g.night({ a01: { kind: 'build', fake: T.id }, a02: { kind: 'build', guns: 1 }, a03: { kind: 'build', fake: T.id } });
  const made = of(r, 'fake');
  assert.equal(made.length, 1, 'one fake');
  const k = made[0].copy;
  assert.deepEqual([made[0].act, made[0].agent, made[0].trait, made[0].tier], ['made', 'a01', T.id, T.tier]);
  assert.deepEqual([made[0].vis.to, made[0].vis.pub], [['a01'], DAY15], "which piece it is: its maker's own until day 15");
  assert.ok(!drop.has(k), 'a new copy, none of the drop');
  assert.deepEqual(traitCopies(), before, "outside its trait's copies: every trait's copies are as they were");
  const c = g.s.copies[k];
  assert.deepEqual([c.trait, c.slot, c.tier, c.holder], [T.id, T.slot, T.tier, { k: 'agent', id: 'a01' }], "a piece of its trait, in its maker's stash");
  assert.ok(!Object.values(g.s.agents.a01.outfit).includes(k), 'unworn');
  assert.equal(parts('a01'), kept, `from ${N.build.fakes} parts`);
  assert.equal(r.fights.where.a01.at, 'home', 'built at home');
  const craft = of(r, 'craft', e => e.agent === 'a01')[0];
  assert.deepEqual([craft.fakes, craft.guns, craft.lockpicks, craft.parts], [1, 0, 0, N.build.fakes], 'a build, as any is');
  assert.ok(!('fakes' in of(r, 'craft', e => e.agent === 'a02')[0]), 'no fakes on a craft that made none');
  assert.ok(!('fake' in of(r, 'play', e => e.agent === 'a01')[0]), "the play on the record doesn't name the trait it faked");
  assert.equal(of(r, 'invalid', e => e.agent === 'a03')[0].kind, 'never', 'only a Gunrunner builds');

  // A trait that isn't the drop's, or more than one: never, and the name never reaches the record.
  stock(g, 'a01', 'parts', N.build.fakes);
  const r2 = g.night({ a01: { kind: 'build', fake: 'CANARY-TRAIT' }, a02: { kind: 'build', fake: [T.id, T.id] } });
  for (const id of ['a01', 'a02']) assert.equal(of(r2, 'invalid', e => e.agent === id)[0].kind, 'never', `${id}: refused for good`);
  assert.ok(!has(g.log, 'CANARY-TRAIT'), 'an unknown trait never reaches the record');
  assert.deepEqual(of(r2, 'fake'), [], 'no fake');
  // Inside its parts a night: a fake and as many guns as push it past them, never. Short of parts: not yet.
  const over = Math.floor((N.build.parts - N.build.fakes) / N.build.guns) + 1;
  stock(g, 'a01', 'parts', over * N.build.guns);
  const past = checkPlay(g.s, 'a01', { kind: 'build', fake: T.id, guns: over }, g.s.day);
  assert.deepEqual([past.ok, past.kind], [false, 'never']);
  stock(g, 'a01', 'parts', N.build.fakes - 1 - parts('a01'));
  const short = checkPlay(g.s, 'a01', { kind: 'build', fake: T.id }, g.s.day);
  assert.deepEqual([short.ok, short.kind], [false, 'not-yet']);
  // One a night: with a cap of parts that would fit two, a build still makes one.
  withOverrides({ 'build.parts': 2 * N.build.fakes }, () => {
    stock(g, 'a01', 'parts', 2 * N.build.fakes - parts('a01'));
    const r3 = g.night({ a01: { kind: 'build', fake: T.id } });
    assert.equal(of(r3, 'fake').length, 1, 'one fake');
    assert.equal(parts('a01'), N.build.fakes, 'from the parts for one');
  });
});

test("the ledger knows a fake: outside its trait's copies, and only ever with an agent or a crew until it's gone (§23; GAP gap.fakes)", () => {
  const g = withTrades(['gunrunner', 'smuggler']);
  housed(g);
  const k = forge(g, 'a01', plain(g, 'rare')[0].id);
  assert.deepEqual(ledgerProblems(g.s), [], 'positive control: a clean state');
  const plant = fn => {
    const s = structuredClone(g.s);
    fn(s);
    return ledgerProblems(s);
  };
  assert.ok(plant(s => s.traits[s.copies[k].trait].copies.push(k)).some(p => p.includes(k)), "a fake among its trait's copies");
  for (const holder of [{ k: 'list' }, { k: 'vault' }, { k: 'minted', id: 'a01' }, { k: 'rollover' }]) {
    assert.ok(plant(s => moveCopy(s, k, holder, 'test')).some(p => p.includes(k)), `a fake held by the ${holder.k}`);
  }
  assert.deepEqual(plant(s => moveCopy(s, k, { k: 'agent', id: 'a02' }, 'test')), [], 'control: with another agent');
});

// --- what a fake can't do (§4, §7, §10, §13, §15) -------------------------------------------------------------------

test('no take or arrest ever counts a fake as the rarest piece: a hit and a break-in take the rarest real one, a want naming the fake changes nothing, an arrest seizes a real one, and a bounty on a fake never pays (§4, §7, §10, §13; GAP gap.fakes)', () => {
  const g = withTrades(['gunrunner', ...Array(5).fill('smuggler')]);
  housed(g);
  const G = plain(g, 'grail')[0];
  const E = plain(g, 'epic')[0];
  const fg = forge(g, 'a01', G.id);
  const fe = forge(g, 'a01', E.id);
  // a02 wears the fake grail and a real common; a04 keeps the fake epic and a real rare in its stash.
  g.errand('a01', 'give', { to: 'a02', copy: fg });
  g.errand('a01', 'give', { to: 'a04', copy: fe });
  const rc = g.hand('a02', tierCopy(g.s, 'common', t => t.slot !== G.slot));
  g.errand('a02', 'dress', { fit: { [G.slot]: fg, [g.s.copies[rc].slot]: rc } });
  const rr = g.hand('a04', tierCopy(g.s, 'rare'));
  // The robbers are armed: 2 beats one agent at the docks, and a home's lock with nobody home (§8).
  stock(g, 'a03', 'guns', 1);
  stock(g, 'a05', 'guns', 1);
  assert.equal(g.errand('a06', 'bounty', { copy: fg, amount: 77 }).ok, true, 'a bounty on the fake goes up, as on any piece');
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a02 is a filler the hits find at the docks, so these nights pass the docks filler.
  const r = g.night({ a03: { kind: 'hit', target: 'a02', place: 'docks', want: fg }, a05: { kind: 'breakin', target: 'a04' } }, DOCKS);
  assert.deepEqual(of(r, 'rob').map(e => [e.leader, e.copy]), [['a03', rc]], 'the hit takes the real common, though it named the fake grail');
  assert.deepEqual(of(r, 'burgle').map(e => [e.leader, e.copy]), [['a05', rr]], 'the break-in takes the real rare over the fake epic');
  assert.deepEqual([g.s.copies[fg].holder, g.s.copies[fe].holder], [{ k: 'agent', id: 'a02' }, { k: 'agent', id: 'a04' }], 'both fakes stay put');
  // With only the fake on, a won hit takes no piece.
  const r2 = g.night({ a03: { kind: 'hit', target: 'a02', place: 'docks' } }, DOCKS);
  assert.equal(of(r2, 'fight', e => e.target === 'a02')[0].won, true, 'control: it won again');
  assert.equal(of(r2, 'rob')[0].copy, null, 'and took no piece');
  // An arrest seizes the rarest real piece on you: a02, in the fake grail and a real common, loses a hit in Glasswall
  // (heavy: 1 against 1 and the city's cop, §6, §8).
  const rc2 = g.hand('a02', tierCopy(g.s, 'common', t => t.slot !== G.slot));
  g.errand('a02', 'dress', { fit: { [G.slot]: fg, [g.s.copies[rc2].slot]: rc2 } });
  const r3 = g.night({ a02: { kind: 'hit', target: 'a06', place: 'downtown' }, a06: { kind: 'hustle', place: 'downtown' } });
  assert.ok(g.s.agents.a02.jail, 'control: arrested');
  assert.equal(of(r3, 'seized', e => e.agent === 'a02')[0].copy, rc2, 'the real common goes to the vault');
  assert.deepEqual(g.s.copies[fg].holder, { k: 'agent', id: 'a02' }, 'the fake stays on it');
  // No fight took the bounty's piece, so it never paid; it's gone with the ferry.
  assert.equal(g.events('bounty', e => e.act === 'paid' || e.act === 'collected').length, 0, 'never paid');
  g.advanceTo(14);
  g.night();
  assert.equal(g.events('bounty', e => e.act === 'gone' && e.copy === fg).length, 1, 'gone with the ferry');
});

test('the landlord at the dock takes the rarest real piece it carries, never a fake; with only a fake it takes nothing and the tab is cleared (§15, gap.rentTab; GAP gap.fakes)', () => {
  withOverrides({ 'gap.rentTab': 'dock' }, () => {
    for (const real of [true, false]) {
      const g = withTrades(['smuggler', 'gunrunner', 'smuggler']);
      housed(g, ['a02', 'a03']);
      const G = plain(g, 'grail')[0];
      // a01 has no cash on night 1, so it's evicted at dawn and runs up a tab (§10).
      const fg = forge(g, 'a02', G.id, { a01: { kind: 'laylow' } });
      assert.equal(g.s.agents.a01.evicted, true, 'control: evicted');
      g.errand('a02', 'give', { to: 'a01', copy: fg });
      const rr = real ? g.hand('a01', tierCopy(g.s, 'rare', t => t.slot !== G.slot)) : null;
      g.advanceTo(14);
      assert.ok(g.s.agents.a01.tab > 0, 'control: a tab');
      g.errand('a01', 'pay', { to: 'a03', amount: g.s.agents.a01.cash });
      const r = g.night();
      const tab = of(r, 'tab', e => e.agent === 'a01')[0];
      assert.equal(tab.paid, 0, 'no cash to pay it with');
      assert.equal(tab.copy, rr, real ? 'the real rare, though the fake is a grail' : 'no piece: the only one it carries is a fake');
      assert.equal(g.s.agents.a01.tab, 0, 'and the tab is cleared');
      assert.deepEqual(g.s.copies[fg].holder, { k: 'gone' }, 'the fake boarded with it, and went at the ferry');
    }
  });
});

test('a fake has no ability and earns no flex: fake knuckles add nothing to a hit, fake shades hide no walk, and a fake worn to work pays nothing (§4; call 2; GAP gap.fakes, gap.flex)', () => {
  const g = withTrades(['gunrunner', ...Array(8).fill('smuggler')]);
  housed(g);
  const R = plain(g, 'rare')[0];
  const fk = forge(g, 'a01', withAbility(g, 'knuckles').id);
  const fs = forge(g, 'a01', withAbility(g, 'shades').id);
  const fr = forge(g, 'a01', R.id);
  // a02 wears the fake knuckles, a03 the fake shades and a04 the fake rare; a05, a06 and a07 the real ones.
  for (const [k, to] of [[fk, 'a02'], [fs, 'a03'], [fr, 'a04']]) {
    g.errand('a01', 'give', { to, copy: k });
    g.errand(to, 'dress', { fit: { [g.s.copies[k].slot]: k } });
  }
  g.hand('a05', abilityCopy(g.s, 'knuckles'), { wear: true });
  g.hand('a06', abilityCopy(g.s, 'shades'), { wear: true });
  g.hand('a07', R.copies[0], { wear: true });
  // Shades: both take TEMP, which walks wired (§11); real shades hide it, fake ones don't.
  for (const id of ['a03', 'a06']) {
    stock(g, id, 'temp', 1);
    assert.equal(g.errand(id, 'take', { drug: 'temp' }).ok, true);
  }
  const walk = id => g.view(null, 'public').board.agents.find(a => a.id === id).walk;
  assert.deepEqual([walk('a03'), walk('a06')], [N.walks.temp, null]);
  // Knuckles: each hits an agent on a shift at the docks; only the real ones add 1 attacking (§8).
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a08 and a09 are fillers the hits find at the docks, so this night passes the docks filler.
  const r = g.night({ a02: { kind: 'hit', target: 'a08', place: 'docks' }, a05: { kind: 'hit', target: 'a09', place: 'docks' } }, DOCKS);
  const side = target => of(r, 'fight', e => e.target === target)[0].sides[0].strength;
  assert.deepEqual([side('a08'), side('a09')], [1, 2], 'fake knuckles: 1; real ones: 2');
  // Flex: a04 and a07 work a shift, each in a rare (§4).
  const flex = id => of(r, 'flex', e => e.agent === id).map(e => e.pay);
  assert.deepEqual(flex('a07'), [N.flex[R.tier]], 'control: the real rare pays its flex');
  assert.deepEqual(flex('a04'), [], 'the fake pays none');
});

// --- who can tell (§19) ---------------------------------------------------------------------------------------------

test("who can tell, the fence (§9, §19): it takes no fake, listed or put up in a swap, and says so only to the agent that put it up, until day 15; a swap asking for one is checked only when it's put up (GAP gap.fakes, gap.fence)", () => {
  const g = withTrades(['gunrunner', 'smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const T = plain(g, 'rare')[0];
  const f = forge(g, 'a01', T.id);
  g.errand('a01', 'give', { to: 'a02', copy: f });
  const real = g.hand('a02', tierCopy(g.s, 'rare', t => t.slot !== T.slot));
  const refusal = res => {
    assert.deepEqual([res.ok, res.why], [false, REFUSED]);
    const e = res.events[0];
    assert.deepEqual([e.type, e.agent, e.kind, e.vis.to, e.vis.pub], ['invalid', 'a02', 'never', ['a02'], DAY15], 'refused for good, and told only to the agent that put it up, until day 15');
  };
  refusal(g.errand('a02', 'fence_list', { copy: f, price: 300 }));
  assert.equal(g.errand('a02', 'fence_list', { copy: real, price: 300 }).ok, true, 'control: a real piece lists');
  refusal(g.errand('a02', 'fence_swap', { to: 'a03', give: { pieces: [f] }, get: { cash: 1 } }));
  // a03 asks for it: an offer can't learn what another agent holds, so nothing is checked until a02 puts it up.
  const ask = g.errand('a03', 'fence_swap', { to: 'a02', give: { cash: 50 }, get: { pieces: [f] } });
  assert.equal(ask.ok, true, 'the offer goes up');
  refusal(g.errand('a02', 'fence_accept', { deal: ask.events.find(e => e.type === 'fence').deal }));
  assert.deepEqual(g.s.copies[f].holder, { k: 'agent', id: 'a02' }, 'the fake never left a02');
  // Who reads the refusals: a02 and its owner's AI now; nobody else, its maker included, the next day or on day 14.
  const refused = v => v.events.filter(e => e.why === REFUSED).length;
  const others = () => [g.view('a01'), g.view('a03'), g.view('a03', 'ownerAI'), g.view('a04'), g.view(null, 'public'), g.view(null, 'record')];
  for (const v of [g.view('a02'), g.view('a02', 'ownerAI')]) assert.equal(refused(v), 3, `${label(v)}: its three refusals`);
  for (const v of others()) assert.equal(refused(v), 0, `${label(v)}: none`);
  g.night();
  for (const v of others()) assert.equal(refused(v), 0, `${label(v)}: none 24 hours later`);
  g.advanceTo(14);
  assert.equal(refused(g.view(null, 'record')), 0, 'none on the record on day 14');
  g.night();
  assert.equal(refused(g.view(null, 'record')), 3, 'on the record on day 15');
});

test('who can tell, shades (§4, §19): an agent in shades sees which pieces other agents wear are fakes, judged when its view is built; not what it wears itself, not through fake shades, and nobody else does (GAP gap.fakes)', () => {
  const g = withTrades(['gunrunner', 'smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const eye = withAbility(g, 'shades').slot;
  const T = plain(g, 'rare', t => t.slot !== eye)[0];
  const f = forge(g, 'a01', T.id);
  const fs = forge(g, 'a01', withAbility(g, 'shades').id);
  g.errand('a01', 'give', { to: 'a02', copy: f });
  const real = g.hand('a02', tierCopy(g.s, 'common', t => ![T.slot, eye].includes(t.slot)));
  const fit = { [T.slot]: f, [g.s.copies[real].slot]: real };
  g.errand('a02', 'dress', { fit });
  const shades = g.hand('a03', abilityCopy(g.s, 'shades'), { wear: true });
  for (const v of [g.view('a03'), g.view('a03', 'ownerAI')]) {
    assert.deepEqual(fitOf(v, 'a02').map(p => p.copy).sort(), [f, real].sort(), `${label(v)}: control: a02's fit`);
    assert.deepEqual(marked(v, 'a02'), [f], `${label(v)}: in shades, the fake a02 wears shows as one, and only it`);
  }
  for (const v of [g.view('a02'), g.view('a04'), g.view('a04', 'ownerAI'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(fitOf(v, 'a02').some(p => p.copy === f), `${label(v)}: control: the fake is on the board`);
    assert.ok(!has(v, MARK), `${label(v)}: as a real piece`);
  }
  // Not what it wears itself: a02 puts on real shades too, and still can't tell its own.
  const own = g.hand('a02', abilityCopy(g.s, 'shades'));
  g.errand('a02', 'dress', { fit: { ...fit, [eye]: own } });
  assert.deepEqual(marked(g.view('a02'), 'a02'), [], "a02 can't tell what it wears itself");
  assert.deepEqual(marked(g.view('a03'), 'a02'), [f], 'control: a03 still can');
  // When the view is built: shades off, a03 can't tell; in the fake shades, it still can't; in real ones again, it can.
  g.errand('a03', 'dress', { fit: {} });
  assert.deepEqual(marked(g.view('a03'), 'a02'), [], 'shades off');
  g.errand('a01', 'give', { to: 'a03', copy: fs });
  g.errand('a03', 'dress', { fit: { [eye]: fs } });
  assert.deepEqual(marked(g.view('a03'), 'a02'), [], 'fake shades tell nothing');
  g.errand('a03', 'dress', { fit: { [eye]: shades } });
  assert.deepEqual(marked(g.view('a03'), 'a02'), [f], 'control: real ones again');
  // And once a02 takes the fake off, there's nothing worn to tell.
  g.errand('a02', 'dress', { fit: { [eye]: own } });
  assert.ok(!has(g.view('a03'), MARK), 'off the board');
});

test("who can tell, its maker (§19): its record names each fake it made, its own until day 15, and its view marks one in its stash and wherever another agent wears it; whoever else holds one reads a real piece: its pieces, the hand-over, a look and its holdings (GAP gap.fakes)", () => {
  const g = withTrades(['gunrunner', 'smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const T = plain(g, 'epic')[0];
  const f = forge(g, 'a01', T.id);
  const made = v => v.events.filter(e => e.type === 'fake' && e.copy === f);
  for (const v of [g.view('a01'), g.view('a01', 'ownerAI')]) {
    assert.deepEqual(made(v).map(e => [e.act, e.trait, e.tier]), [['made', T.id, T.tier]], `${label(v)}: its record of it`);
    assert.equal(v.me.pieces.find(p => p.copy === f).fake, true, `${label(v)}: marked in its pieces`);
  }
  for (const v of [g.view('a02'), g.view('a03', 'ownerAI'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(!has(v, f) && !has(v, MARK), `${label(v)}: nothing`);
  }
  // a02 gets it, and a real piece of the same trait: the two read alike but for the copy.
  const r0 = g.hand('a02', T.copies[0]);
  g.errand('a01', 'give', { to: 'a02', copy: f });
  const alike = (xs, what) => {
    const [x, y] = [f, r0].map(k => xs.find(p => p.copy === k));
    assert.ok(x && y, `control: ${what} lists both`);
    assert.deepEqual({ ...x, copy: null }, { ...y, copy: null }, `${what}: the fake reads as the real piece`);
  };
  alike(g.view('a02').me.pieces, "a02's pieces");
  alike(g.view('a02', 'ownerAI').me.pieces, "its owner's AI's");
  const give = g.view('a02').events.find(e => e.type === 'give' && e.copy === f);
  assert.deepEqual([give.from, give.trait, 'fake' in give], ['a01', T.id, false], 'the hand-over, as any');
  g.errand('a03', 'lookout', { agent: 'a02' });
  alike(g.view('a03').events.find(e => e.type === 'look').pieces, "a03's look");
  g.night();
  alike(g.events('holdings', e => e.agent === 'a02').at(-1).pieces, "a02's holdings record");
  assert.ok(!has(g.view('a02'), MARK) && !has(g.view('a03'), MARK), 'nobody else tells it');
  // Worn by a02, its maker tells it on the board; nobody else does.
  g.errand('a02', 'dress', { fit: { [T.slot]: f } });
  assert.deepEqual(marked(g.view('a01'), 'a02'), [f], 'its maker, on the board');
  for (const v of [g.view('a02'), g.view('a03'), g.view(null, 'public')]) assert.deepEqual(marked(v, 'a02'), [], `${label(v)}: not marked`);
  // A bounty on it: the board lists it, marked for its maker alone.
  assert.equal(g.errand('a03', 'bounty', { copy: f, amount: 40 }).ok, true);
  const row = v => v.board.bounties.find(b => b.copy === f);
  assert.equal(row(g.view('a01')).fake, true, 'its maker, on the bounty');
  for (const v of [g.view('a02'), g.view('a03'), g.view(null, 'public')]) assert.ok(!('fake' in row(v)), `${label(v)}: as real`);
  assert.ok(!has(g.view('a03').me.bounties, MARK), "nor on its poster's own list");
  // Its record stays its own past the 24-hour record.
  g.night();
  for (const v of [g.view('a02'), g.view('a03'), g.view(null, 'public'), g.view(null, 'record')]) assert.equal(made(v).length, 0, `${label(v)}: not the maker's record`);
});

test('who can tell, everyone at the ferry (§15, §19): aboard, every fake is exposed to everyone and gone, and never mints; one with an agent that misses the boat is gone with the rest; on day 15 the record names every fake (GAP gap.fakes)', () => {
  const g = withTrades(['gunrunner', 'smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const T = plain(g, 'rare')[0];
  const f = forge(g, 'a01', T.id);
  const h = forge(g, 'a01', plain(g, 'epic')[0].id);
  g.errand('a01', 'give', { to: 'a02', copy: f });
  g.errand('a01', 'give', { to: 'a03', copy: h });
  const real = g.hand('a02', tierCopy(g.s, 'common', t => t.slot !== T.slot));
  g.errand('a02', 'dress', { fit: { [T.slot]: f } });
  g.advanceTo(14);
  // a03 reaches the dock at 5 stars, so the city cops waiting there arrest it and it misses the boat (§15): it starts the
  // last night a star short, and its hit on a04 along the waterfront adds the last. Jail from an earlier night ends at
  // dawn on day 14 (GAP gap.ferryJail).
  g.s.agents.a03.heat = N.maxHeat - 1;
  const exposed = v => v.events.filter(e => e.type === 'fake' && e.act === 'exposed');
  for (const v of allViews(g)) assert.equal(exposed(v).length, 0, `${label(v)}: nothing exposed before the ferry`);
  const r = g.night({ a03: { kind: 'hit', target: 'a04', place: 'junkyard' }, a04: { kind: 'board', place: 'junkyard' } });
  assert.equal(of(r, 'arrest', e => e.agent === 'a03' && e.why === 'dock').length, 1, 'control: arrested at the dock, in jail when the ferry leaves');
  assert.deepEqual(of(r, 'fake', e => e.act === 'exposed').map(e => [e.agent, e.copy, e.trait, e.tier, e.vis.to]), [['a02', f, T.id, T.tier, 'all']], 'aboard, exposed to everyone');
  assert.deepEqual(g.s.copies[f].holder, { k: 'gone' }, 'and gone');
  assert.deepEqual(of(r, 'mint', e => e.agent === 'a02')[0].cards.map(c => c.copy), [real], 'it never mints; the real piece does');
  assert.ok(of(r, 'missed', e => e.agent === 'a03')[0].copies.includes(h), 'a03 missed the boat, and its fake is gone with the rest');
  assert.deepEqual(g.s.copies[h].holder, { k: 'gone' });
  for (const v of allViews(g)) assert.deepEqual(exposed(v).map(e => e.copy), [f], `${label(v)}: day 15, the exposure`);
  const rec = g.view(null, 'record').events.filter(e => e.type === 'fake' && e.act === 'made');
  assert.deepEqual(rec.map(e => [e.agent, e.copy]), [['a01', f], ['a01', h]], "the record names every fake and its maker");
});

test("no view tells a fake before the ferry (§19): moved, worn, bountied, named in a sit-down, looked at, refused at the fence and kept in a crew stash, it reads as a real piece to everyone but its maker, and the refusal only to the agent that put it up (GAP gap.fakes)", () => {
  const g = withTrades(['gunrunner', ...Array(5).fill('smuggler')]);
  housed(g);
  const T = plain(g, 'rare')[0];
  const f = forge(g, 'a01', T.id);
  // Every view but its maker's: no piece marked a fake, no fake on the record, and no refusal but to the agent refused.
  const sweep = (when, shown = true) => {
    for (const v of allViews(g)) {
      const id = v.me ? v.me.id : null;
      if (shown) assert.ok(has(v, f), `${when}, ${label(v)}: control: the piece is in view`);
      if (id === 'a01') continue;
      assert.ok(!has(v, MARK), `${when}, ${label(v)}: no piece marked a fake`);
      assert.ok(!v.events.some(e => e.type === 'fake'), `${when}, ${label(v)}: no fake on the record`);
      if (id !== 'a02') assert.ok(!has(v, REFUSED), `${when}, ${label(v)}: no refusal`);
    }
  };
  sweep('day 2, in its maker\'s stash', false);
  // Day 2: a01 hands it to a02, who wears it; a03 posts a bounty on it; a04 names it in a sit-down with a02.
  g.errand('a01', 'give', { to: 'a02', copy: f });
  g.errand('a02', 'dress', { fit: { [T.slot]: f } });
  g.errand('a03', 'bounty', { copy: f, amount: 50 });
  g.errand('a04', 'ask', { to: 'a02' });
  const sd = Object.keys(g.s.sitdowns)[0];
  g.errand('a02', 'answer', { sitdown: sd, accept: true });
  g.errand('a04', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', piece: f, cash: 100 } });
  assert.deepEqual(marked(g.view('a01'), 'a02'), [f], 'control: its maker tells it');
  sweep('day 2, worn');
  g.night();
  // Day 3: a02 is refused at the fence, takes it off, and a05 hires a lookout on a02.
  assert.equal(g.errand('a02', 'fence_list', { copy: f, price: 400 }).why, REFUSED);
  g.errand('a02', 'dress', { fit: {} });
  g.errand('a05', 'lookout', { agent: 'a02' });
  assert.ok(has(g.view('a02'), REFUSED), "control: a02 reads its own refusal");
  sweep('day 3');
  g.night();
  // Day 4: a02 forms a crew and keeps it in the stash.
  g.errand('a02', 'crew_form', { name: 'c' });
  g.errand('a02', 'stash_put', { copy: f });
  sweep('day 4');
  while (g.s.day < 14) {
    g.night();
    sweep(`day ${g.s.day}`);
  }
  g.night();
  for (const v of [g.view('a05'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.ok(v.events.some(e => e.type === 'fake' && e.act === 'exposed' && e.copy === f), `${label(v)}: told at the ferry`);
  }
});
