// R2-5, the tools (GAME.md §17, §18, §24, §33, §34; brief R2-agents.md, task R2-5): one table of typed actions, the one
// place they're defined. A seat reads the agent's view and answers with one JSON reply a call; an owner's AI reads the
// owner's-AI view and calls read, play and memory one at a time, with no free-text slot. The caller fixes the audience,
// never the model. Pieces are named by R2-3's handles. Failures come back typed, never as a crash, and the same failed
// action is refused once it has failed gap.tries times in a day. The game-held memory waits for R2-2: its rows are in
// the table, refused as not built yet. Each test imports the tools itself, so each
// fails on its own before they exist. Amounts come from N or the state a test set up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, tierCopy, abilityCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { ERRANDS } from '../rules/errand.mjs';
import { PLAY_KINDS, checkPlay } from '../rules/plays.mjs';
import { addGoods } from '../rules/state.mjs';
import { N, ROWS } from '../numbers.mjs';
import { rng } from '../rng.mjs';

const tools = () => import('../agents/tools.mjs');
const SEED = 404;
const COPY_ID = /\bk\d+\b/;
const has = (x, secret) => JSON.stringify(x).includes(secret);
const KINDS = ['not-yet', 'never'];
const typedFailure = r => r && r.ok === false && typeof r.why === 'string' && KINDS.includes(r.kind) && typeof r.code === 'string';

// A season whose agents have the trades named, in id order (the helpers' cast is all Smugglers).
function withTrades(trades, seed = SEED) {
  const g = new Game({ n: 1 });
  const agents = trades.map((trade, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade, driver: 'test' }));
  const r = newSeason({ seed, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
// The rent for a whole season and more, so nobody named is evicted.
const housed = (g, ids = Object.keys(g.s.agents)) => ids.forEach(id => g.grant(id, 2 * N.nights * N.rent));

// What a caller holds for one agent: a briefing read now, for a seat or its owner's AI, and an `apply` that sends an
// errand through the rules (ledger checked) and says how it went; `sent` is every errand that reached the rules.
async function caller(g, id, { audience = 'seat', tries = {}, from = 1 } = {}) {
  const { read } = await tools();
  const { deal, result } = read(g.view(id, audience === 'ownerAI' ? 'ownerAI' : 'agent'), { audience, seed: SEED, from });
  const sent = [];
  const apply = e => {
    sent.push(e);
    const r = g.errand(id, e.kind, e);
    const bad = r.events.find(x => x.type === 'invalid');
    return { ok: r.ok, why: r.why, kind: bad ? bad.kind : undefined };
  };
  return { deal, result, sent, tries, ctx: { deal, apply, tries } };
}

test('the table is the one place the actions are defined: every one of the rules\' errand kinds has its row, or is left out with a reason, and the play row takes every play kind (§33, §34; brief R2-5)', async () => {
  const { ACTIONS, LEFT_OUT } = await tools();
  const names = ACTIONS.map(a => a.act);
  assert.equal(new Set(names).size, names.length, 'one row an action');
  for (const kind of ERRANDS) {
    const rows = ACTIONS.filter(a => a.errand === kind);
    assert.ok(rows.length === 1 || (LEFT_OUT[kind] && LEFT_OUT[kind].length > 0), `${kind}: one row, or left out with its reason`);
  }
  for (const a of ACTIONS) if (a.errand) assert.ok(ERRANDS.includes(a.errand), `${a.act}: names an errand the rules have`);
  const play = ACTIONS.find(a => a.act === 'play');
  assert.ok(play, 'a play row');
  assert.deepEqual([...play.kinds].sort(), [...PLAY_KINDS].sort(), 'it takes every play kind');
  assert.deepEqual(ACTIONS.filter(a => a.built !== true).map(a => a.act).sort(), [], 'all listed operations are built; trusted owner Creed is explicitly excluded');
});

test('every errand kind reaches the rules through the table: each of the 32, sent by a seat with its pieces named by handle, is the errand the rules accept (§10, §12, §13, §14, §33; brief R2-5)', async () => {
  const { act } = await tools();
  const g = withTrades(['gunrunner', 'chemist', 'smuggler', 'cop', 'dealer', 'smuggler', 'smuggler']);
  housed(g, ['a01', 'a02', 'a03', 'a04', 'a05', 'a06']);
  // Night 1: a06 loses a hit in Glasswall and is arrested (heavy: 1 against 1 and the city's cop, §6, §8); a07, with no
  // cash, lays low and is evicted at dawn (§10).
  g.night({ a06: { kind: 'hit', target: 'a04', place: 'downtown' }, a04: { kind: 'hustle', place: 'downtown' }, a07: { kind: 'laylow' } });
  assert.ok(g.s.agents.a06.jail && g.s.agents.a07.evicted, 'control: one in jail, one evicted');
  const A = g.hand('a01', tierCopy(g.s, 'common'));
  const B = g.hand('a01', tierCopy(g.s, 'common'));
  const C = g.hand('a02', tierCopy(g.s, 'common'));
  const D = g.hand('a03', tierCopy(g.s, 'common'));
  const F = g.hand('a03', tierCopy(g.s, 'common', t => t.slot !== g.s.copies[D].slot));
  g.hand('a06', abilityCopy(g.s, 'earpiece'), { wear: true });
  stock(g, 'a02', 'sudo', 1);
  stock(g, 'a03', 'truth', 1);
  g.grant('a07', N.rent);
  const reached = new Set();
  const send = async (id, make) => {
    const c = await caller(g, id);
    const action = make(c);
    const r = act(action, c.ctx);
    assert.equal(r.ok, true, `${id} ${action.act}: ${r.why}`);
    assert.equal(c.sent.length, 1, `${id} ${action.act}: one errand reached the rules`);
    assert.equal(c.sent[0].kind, action.act, `${id} ${action.act}: the errand of its name`);
    reached.add(c.sent[0].kind);
    return c.sent[0];
  };
  const slot = k => g.s.copies[k].slot;
  const deal = (id, pred) => g.view(id).me.fence.find(pred).deal;
  assert.equal((await send('a01', c => ({ act: 'dress', fit: { [slot(A)]: c.deal.byCopy[A] } }))).fit[slot(A)], A, 'dress: by handle');
  const open = g.view('a01').board.list.find(t => t.opens <= g.s.day && t.left > 0);
  await send('a01', () => ({ act: 'offer', trait: open.trait, amount: open.price }));
  assert.equal((await send('a01', c => ({ act: 'give', to: 'a02', piece: c.deal.byCopy[B] }))).copy, B, 'give: by handle');
  await send('a01', () => ({ act: 'pay', to: 'a02', amount: 1, for: 'gift' }));
  await send('a01', () => ({ act: 'bail', agent: 'a06' }));
  await send('a07', () => ({ act: 'rent' }));
  await send('a02', () => ({ act: 'shop', item: 'chems', units: 1, max: N.shopPrice.chems }));
  await send('a02', () => ({ act: 'sell', item: 'chems', units: 1 }));
  assert.equal((await send('a01', c => ({ act: 'fence_list', piece: c.deal.byCopy[A], price: open.price }))).copy, A, 'fence_list: by handle');
  await send('a01', () => ({ act: 'fence_unlist', deal: deal('a01', d => d.kind === 'listing') }));
  await send('a01', c => ({ act: 'fence_list', piece: c.deal.byCopy[A], price: open.price }));
  await send('a02', c => ({ act: 'fence_buy', deal: c.result.view.board.fence[0].deal }));
  await send('a03', c => ({ act: 'dress', fit: { [slot(D)]: c.deal.byCopy[D] } }));
  const swap = await send('a01', c => ({ act: 'fence_swap', to: 'a03', give: { cash: 1 }, get: { pieces: [c.deal.byCopy[D]] } }));
  assert.deepEqual(swap.get.pieces, [D], 'fence_swap: the half it asks for, by handle');
  await send('a03', () => ({ act: 'fence_accept', deal: deal('a03', d => d.kind === 'swap') }));
  await send('a01', () => ({ act: 'crew_form', name: 'the crew' }));
  await send('a01', () => ({ act: 'crew_invite', agent: 'a03' }));
  await send('a03', c => ({ act: 'crew_join', crew: c.result.view.me.invitedTo[0] }));
  assert.equal((await send('a03', c => ({ act: 'stash_put', piece: c.deal.byCopy[F], cash: 10 }))).copy, F, 'stash_put: by handle');
  await send('a01', c => ({ act: 'stash_take', piece: c.deal.byCopy[F] }));
  assert.deepEqual(g.s.copies[F].holder, { k: 'agent', id: 'a01' }, 'stash_take: the piece the handle named');
  await send('a03', () => ({ act: 'crew_leave' }));
  await send('a02', () => ({ act: 'ask', to: 'a05', line: 'a word' }));
  const sd = c => c.result.view.me.sitdowns[0].id;
  await send('a05', c => ({ act: 'answer', sitdown: sd(c), accept: true }));
  const said = await send('a02', c => ({ act: 'say', sitdown: sd(c), say: 'offer', terms: { what: 'trade', piece: c.deal.byCopy[C], cash: 10 }, line: 'yours?' }));
  assert.equal(said.terms.piece, C, "say: the terms' piece, by handle");
  await send('a06', c => ({ act: 'listen', sitdown: c.result.view.events.find(e => e.type === 'meet').sitdown }));
  await send('a05', c => ({ act: 'close', sitdown: sd(c) }));
  await send('a04', () => ({ act: 'tip', agent: 'a01', target: 'a02' }));
  await send('a01', () => ({ act: 'bribe', target: 'a02' }));
  assert.equal((await send('a02', c => ({ act: 'bounty', piece: c.deal.byCopy[C], amount: 10 }))).copy, C, 'bounty: by handle');
  await send('a03', () => ({ act: 'lookout', agent: 'a01' }));
  await send('a05', () => ({ act: 'take', drug: 'temp' }));
  await send('a02', () => ({ act: 'give', to: 'a07', goods: { sudo: 1 } }));
  await send('a07', () => ({ act: 'take', drug: 'temp' }));
  assert.equal(g.s.agents.a07.writer, 'a02', 'control: the TEMP was SUDO, and a02 writes');
  await send('a02', () => ({ act: 'write', agent: 'a07', play: { kind: 'hustle', place: 'docks' } }));
  const truth = await send('a03', c => ({ act: 'take', drug: 'truth', play: { menu: c.result.menu.find(e => e.kind === 'laylow').n } }));
  assert.equal(truth.play.kind, 'laylow', "take: TRUTH locks the menu's play");
  await send('a01', () => ({ act: 'chat', say: 'offer', terms: { what: 'meet' }, line: 'a word' }));
  await send('a04', () => ({ act: 'outloud', say: 'boast', line: 'a word' }));
  await send('a01', () => ({ act: 'plan', traits: [] }));
  await send('a01', () => ({ act: 'orders', orders: [] }));
  await send('a01', () => ({ act: 'note', line: 'a dated note' }));
  const { LEFT_OUT } = await tools();
  assert.deepEqual([...reached].sort(), ERRANDS.filter(kind => !LEFT_OUT[kind]).sort(), 'all 32 previous errands plus three memory tools reached the rules; trusted Creed is explicitly excluded');
  assert.ok(LEFT_OUT.creed);
});

test('every legal play is reachable through the table: a menu number with what its line leaves open, or the play written out, gives the legal play the rules accept; and the optional fields reach it too (§7, §9, §11, §15, §33; brief R2-5)', async () => {
  const { reply } = await tools();
  // The play the rules will take, which the caller alone gets, and the result the seat reads.
  const play = (c, action) => {
    const out = reply({ actions: [action] }, c.ctx);
    return { ...out.results[0], play: out.play, shown: out.results[0].play };
  };
  const g = withTrades(['smuggler', 'chemist', 'dealer', 'gunrunner', 'cop', 'smuggler', 'smuggler']);
  housed(g);
  g.night();
  // Day 2: night 2's crate is up (§9); a06 is wanted, so the Cop can collar it (test-only heat, as the collar tests
  // set it); a07 holds a forged warrant, so it can job the vault; a04 holds a night's parts; a06 wears a piece.
  g.s.agents.a06.heat = N.wantedAt;
  stock(g, 'a07', 'warrants', 1);
  stock(g, 'a04', 'parts', N.build.parts);
  const worn = g.hand('a06', tierCopy(g.s, 'rare'), { wear: true });
  const reached = new Set();
  const sweep = async () => {
    for (const id of Object.keys(g.s.agents).sort()) {
      const c = await caller(g, id);
      const legal = g.view(id).legal;
      for (const L of legal) {
        const entry = c.result.menu.find(e => e.kind === L.kind && (e.targets ? e.targets.includes(L.target) : ['place', 'corner', 'batches', 'guns', 'lockpicks'].every(f => e[f] === L[f])));
        assert.ok(entry, `${id}: ${JSON.stringify(L)} has its menu line`);
        const place = L.places ? L.places[L.places.length - 1] : L.place;
        const open = { ...(entry.targets ? { target: L.target } : {}), ...(entry.places ? { place } : {}) };
        const byMenu = play(c, { act: 'play', menu: entry.n, ...open });
        const written = play(c, { act: 'play', ...L, places: undefined, place });
        for (const r of [byMenu, written]) {
          assert.equal(r.ok, true, `${id} ${L.kind}: ${r.why}`);
          const { places, ...want } = { ...L, place };
          assert.deepEqual(r.play, want.place === undefined ? (({ place: _, ...x }) => x)(want) : want, `${id} ${L.kind}: the legal play`);
          assert.equal(checkPlay(g.s, id, r.play, g.s.day).ok, true, `${id} ${L.kind}: the rules accept it`);
        }
        reached.add(L.kind);
      }
    }
  };
  await sweep();
  // The optional fields: a hit's want by handle, a cook's drug and HALLU's lies (one naming a piece by handle), a
  // build's warrants and a fake of one trait.
  const a01 = await caller(g, 'a01');
  const hit = play(a01, { act: 'play', kind: 'hit', target: 'a06', place: 'docks', want: a01.deal.byCopy[worn] });
  assert.equal(hit.play.want, worn, "a hit's want, by handle, reaches the rules as its copy");
  assert.equal(hit.shown.want, a01.deal.byCopy[worn], 'and the seat reads it back by handle');
  const a02 = await caller(g, 'a02');
  const lies = [{ kind: 'cash', agent: 'a01', value: 5 }, { kind: 'stash', agent: 'a06', value: a02.deal.byCopy[worn] }, { kind: 'tip', agent: 'a03', value: 'a04' }];
  const cook = play(a02, { act: 'play', kind: 'cook', place: 'suburbs', batches: 1, drug: 'hallu', lies });
  assert.deepEqual([cook.play.drug, cook.play.lies[1].value], ['hallu', worn], "a cook's drug and its lies, a piece by handle");
  const a04 = await caller(g, 'a04');
  const T = Object.values(g.s.traits).find(t => t.tier === 'epic');
  const fake = play(a04, { act: 'play', kind: 'build', guns: 0, lockpicks: 0, fake: T.id });
  const warrant = play(a04, { act: 'play', menu: a04.result.menu.find(e => e.kind === 'build').n, guns: 0, lockpicks: 0, warrants: 1 });
  assert.deepEqual([fake.play.fake, warrant.play.warrants], [T.id, 1], "a build's fake and warrants");
  for (const [id, r] of [['a01', hit], ['a02', cook], ['a04', fake], ['a04', warrant]]) {
    assert.equal(checkPlay(g.s, id, r.play, g.s.day).ok, true, `${id}: the rules accept ${JSON.stringify(r.play)}`);
  }
  g.advanceTo(N.nights);
  await sweep();
  assert.deepEqual([...reached].sort(), [...PLAY_KINDS].sort(), 'every play kind was legal for someone, and reached');
});

test("no owner's-AI result carries free text or a copy id: its read, its play and its refusals, live and 24 hours later, though the seat reads the words (canaries, §18, §19; brief R2-5)", async () => {
  const { act, reply } = await tools();
  const g = withTrades(['smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const worn = g.hand('a03', tierCopy(g.s, 'rare'), { wear: true });
  g.errand('a01', 'crew_form', { name: 'CANARY-CREW' });
  g.errand('a01', 'ask', { to: 'a02', line: 'CANARY-ASK' });
  g.errand('a02', 'answer', { sitdown: Object.keys(g.s.sitdowns)[0], accept: true });
  g.errand('a02', 'say', { sitdown: Object.keys(g.s.sitdowns)[0], say: 'offer', terms: { what: 'trade', piece: worn, cash: 5 }, line: 'CANARY-SAY' });
  const words = ['CANARY-CREW', 'CANARY-ASK', 'CANARY-SAY', 'CANARY-REASON', 'CANARY-OWNER', 'CANARY-ACT', 'CANARY-FIELD'];
  const clean = (x, what) => {
    for (const w of words) assert.ok(!has(x, w), `${what}: no ${w}`);
    assert.ok(!COPY_ID.test(JSON.stringify(x)), `${what}: no copy id`);
  };
  const sweep = async when => {
    for (const id of Object.keys(g.s.agents).sort()) {
      const c = await caller(g, id, { audience: 'ownerAI' });
      assert.ok(COPY_ID.test(JSON.stringify(g.view(id, 'ownerAI'))), `${when}, ${id}: positive control: the raw view holds copy ids`);
      clean(c.result, `${when}, ${id}'s owner's AI reads`);
      const ignored = act({ act: 'play', menu: 1, reason: 'CANARY-OWNER', note: 'CANARY-FIELD' }, c.ctx);
      assert.equal(ignored.ok, false, 'unknown fields are refused instead of silently dropped');
      clean(ignored, `${when}, ${id}: refused fields reveal no free text`);
      const play = act({ act: 'play', menu: 1, reason: 'CANARY-OWNER' }, c.ctx);
      assert.equal(play.ok, true, `${when}, ${id}: control: its play`);
      assert.ok(!('reason' in play.play), `${when}, ${id}: its play carries no words`);
      clean(play, `${when}, ${id}'s play`);
      if (id !== 'a03') {
        const hit = reply({ act: 'play', kind: 'hit', target: 'a03', place: 'docks', want: c.deal.byCopy[worn] }, c.ctx);
        assert.equal(hit.play.want, worn, `${when}, ${id}: control: the caller's play names the piece by copy`);
        assert.equal(hit.results[0].play.want, c.deal.byCopy[worn], `${when}, ${id}: its AI reads the want by handle`);
        clean(hit.results, `${when}, ${id}'s hit`);
      }
      const out = reply({ actions: [{ act: 'give', to: 'a02', cash: 1 }, { act: 'CANARY-ACT' }, { act: 'play', kind: 'CANARY-FIELD' }, { act: 'plan' }] }, c.ctx);
      assert.ok(out.results.every(typedFailure), `${when}, ${id}: control: each refused, typed`);
      assert.equal(out.results[0].code, 'audience', `${when}, ${id}: an errand isn't its to send`);
      clean(out, `${when}, ${id}'s refusals`);
      assert.equal(c.sent.length, 0, `${when}, ${id}: nothing reached the rules`);
    }
  };
  await sweep('live');
  const seat = await caller(g, 'a02');
  assert.ok(has(seat.result, 'CANARY-SAY') && has(seat.result, 'CANARY-CREW'), "positive control: the seat reads the words live");
  g.night({ a04: { kind: 'hustle', place: 'docks', reason: 'CANARY-REASON' } });
  g.night();
  assert.ok(has(g.view('a01'), 'CANARY-REASON'), 'positive control: the reason is on the record');
  await sweep('two days later');
});

test("the caller fixes the audience: an owner's AI gets only read, play and memory, with no free-text slot; a seat everything but read, which its briefing is (§17, §18; brief R2-5)", async () => {
  const { ACTIONS, act, read } = await tools();
  const owner = ACTIONS.filter(a => a.who.includes('ownerAI')).map(a => a.act).sort();
  assert.deepEqual(owner, ['orders', 'plan', 'play', 'read'], 'read, play, and the typed memory');
  assert.ok(ACTIONS.filter(x => x.who.includes('ownerAI') && x.act !== 'play').every(a => !Object.values(a.fields).some(t => t.replace('?', '') === 'text')), "no free text in the owner's AI's rows; the play's reason is the seat's alone (the format test)");
  const g = withTrades(['smuggler', 'smuggler']);
  housed(g);
  const c = await caller(g, 'a01', { audience: 'ownerAI' });
  for (const a of ACTIONS.filter(x => !x.who.includes('ownerAI'))) {
    const r = act({ act: a.act }, c.ctx);
    assert.deepEqual([r.ok, r.code], [false, 'audience'], `${a.act}: not the owner's AI's`);
  }
  assert.equal(c.sent.length, 0, 'nothing reached the rules');
  assert.throws(() => read(g.view('a01'), { audience: 'ownerAI', seed: SEED }), /audience/, "an owner's AI is never handed the agent's view");
  assert.throws(() => read(g.view('a01', 'ownerAI'), { audience: 'seat', seed: SEED }), /audience/, "nor a seat the owner's AI's");
  const s = await caller(g, 'a01');
  const r = act({ act: 'read' }, s.ctx);
  assert.deepEqual([r.ok, r.code], [false, 'audience'], "a seat's briefing is its read");
});

test('a malformed or off-menu reply gives a typed failure, never a crash: broken JSON, the wrong shapes, unknown actions, fields of the wrong type, handles never dealt, numbers off the menu and plays it doesn\'t list; and a fuzz of random replies (§33; brief R2-5)', async () => {
  const { reply, ACTIONS } = await tools();
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const c = await caller(g, 'a01');
  const stub = [];
  const ctx = { ...c.ctx, apply: e => (stub.push(e), { ok: false, why: 'stub', kind: 'never' }) };
  const n = c.result.menu.length;
  const whole = ['not json', '{"actions": [', '', 'null', '42', '"words"', '{}', '{"actions": 5}', '{"actions": "x"}', 7, null, true];
  for (const raw of whole) {
    const out = reply(raw, ctx);
    assert.equal(out.results.length, 1, `${JSON.stringify(raw)}: one failure`);
    assert.ok(typedFailure(out.results[0]) && out.results[0].code === 'malformed', `${JSON.stringify(raw)}: malformed, typed`);
    assert.equal(out.play, null);
  }
  const parts = [
    null, 5, 'x', [], {}, { act: 5 }, { act: 'CANARY' }, { act: '__proto__' }, { act: 'constructor' }, { act: 'toString' },
    { act: 'give' }, { act: 'give', to: 'nobody' }, { act: 'give', to: 'a02', cash: 'lots' }, { act: 'give', to: 'a02', cash: -3 },
    { act: 'give', to: 'a02', piece: 'P999' }, { act: 'give', to: 'a02', piece: 'k001' }, { act: 'give', to: 'a02', goods: { gold: 1 } },
    { act: 'dress', fit: 'P1' }, { act: 'dress', fit: { CANARY: 'P1' } }, { act: 'dress', fit: JSON.parse('{"__proto__": "P1"}') },
    { act: 'say', sitdown: 's1', say: 'CANARY' }, { act: 'offer', trait: 'CANARY', amount: 5 }, { act: 'take', drug: 'CANARY' },
    { act: 'fence_swap', to: 'a02', give: 'all', get: { pieces: 'P1' } }, { act: 'tip', agent: 'a02', target: 'CANARY' },
    { act: 'play', menu: 0 }, { act: 'play', menu: n + 1 }, { act: 'play', menu: 1.5 }, { act: 'play', menu: '1' }, { act: 'play', menu: -1 },
    { act: 'play', kind: 'CANARY' }, { act: 'play', kind: 'collar', target: 'a02', place: 'docks' }, { act: 'play', kind: 'hit', target: 'a01', place: 'docks' },
    { act: 'play', kind: 'hit', target: 'a02' }, { act: 'play', kind: 'hit', target: 'a02', place: 'CANARY' }, { act: 'play', kind: 'board', place: 'downtown' },
    { act: 'play', kind: 'hit', target: 'a02', place: 'docks', want: 'P999' }, { act: 'play' }, { act: 'write', agent: 'a02', play: 'hustle' },
    // Ids the rules would look up on a plain object, where some crash them (an R1 finding, handed back): never let through.
    { act: 'give', to: '__proto__', cash: 1 }, { act: 'pay', to: 'constructor', amount: 1 }, { act: 'crew_join', crew: '__proto__' },
    { act: 'offer', trait: '__proto__', amount: 1 }, { act: 'say', sitdown: '__proto__', say: 'offer' },
    { act: 'play', kind: 'hit', target: '__proto__', place: 'docks' }, { act: 'play', kind: 'hit', target: 'a02', place: 'docks', want: '__proto__' },
  ];
  const out = reply({ actions: parts }, ctx);
  assert.equal(out.results.length, parts.length, 'a result for each action');
  out.results.forEach((r, i) => assert.ok(typedFailure(r), `${JSON.stringify(parts[i])}: typed, ${JSON.stringify(r)}`));
  assert.ok(!has(out, 'CANARY'), 'no failure echoes what the reply wrote');
  assert.equal(stub.length, 0, 'nothing malformed reached the rules');
  assert.equal(out.play, null, 'no play');
  assert.equal(reply('{"actions": []}', ctx).results.length, 0, 'control: an empty reply is no failure');
  const fine = reply(JSON.stringify({ actions: [{ act: 'play', menu: 1 }] }), ctx);
  assert.equal(fine.results[0].ok, true, 'control: a reply as JSON text');
  assert.equal(fine.play.kind, c.result.menu[0].kind);
  // A fuzz: random values, shaped like replies or not, never throw, and every failure is typed.
  const r = rng(SEED, 'tools-fuzz');
  const acts = ACTIONS.map(a => a.act);
  const fields = [...new Set(ACTIONS.flatMap(a => Object.keys(a.fields))), 'menu', 'kind', 'target', 'place', 'want', 'pieces'];
  const junk = depth => {
    const x = r();
    if (depth > 3 || x < 0.25) return [null, true, -1, 0, 1, 2.5, 1e12, '', 'P1', 'P2', 'a02', 'k001', 'docks', '__proto__'][Math.floor(r() * 14)];
    if (x < 0.5) return Array.from({ length: Math.floor(r() * 4) }, () => junk(depth + 1));
    if (x < 0.75) return { act: acts[Math.floor(r() * acts.length)], ...Object.fromEntries(Array.from({ length: Math.floor(r() * 4) }, () => [fields[Math.floor(r() * fields.length)], junk(depth + 1)])) };
    return Object.fromEntries(Array.from({ length: Math.floor(r() * 3) }, () => [fields[Math.floor(r() * fields.length)], junk(depth + 1)]));
  };
  for (let i = 0; i < 500; i++) {
    const raw = r() < 0.5 ? { actions: Array.from({ length: Math.floor(r() * 5) }, () => junk(0)) } : junk(0);
    const res = reply(r() < 0.3 ? JSON.stringify(raw) : raw, ctx);
    assert.ok(Array.isArray(res.results), `fuzz ${i}: results`);
    for (const x of res.results) assert.ok(x.ok === true || typedFailure(x), `fuzz ${i}: ${JSON.stringify(x)}`);
  }
});

test('one play a reply: a later play in the same reply is refused, typed, and the first stands; the actions run in the order written (gap.reply; brief R2-5)', async () => {
  const { reply } = await tools();
  const g = withTrades(['smuggler', 'smuggler']);
  housed(g);
  const c = await caller(g, 'a01');
  const [first, second] = c.result.menu;
  const out = reply({ actions: [{ act: 'play', menu: first.n }, { act: 'pay', to: 'a02', amount: 1 }, { act: 'play', menu: second.n }, { act: 'pay', to: 'a02', amount: 2 }] }, c.ctx);
  assert.deepEqual(out.results.map(r => r.ok), [true, true, false, true]);
  assert.equal(out.results[2].code, 'one-play');
  assert.equal(out.play.kind, first.kind, 'the first play stands');
  assert.deepEqual(c.sent.map(e => e.amount), [1, 2], 'in the order written');
});

test("the briefing's reply format is generated from the table: a seat's lists every action it may send, each with its fields, and nothing not built; an owner's AI's lists read and play, and no free-text field (§33; brief R2-5)", async () => {
  const { ACTIONS, replyFormat } = await tools();
  const seat = replyFormat('seat');
  const owner = replyFormat('ownerAI');
  for (const a of ACTIONS) {
    const inSeat = seat.includes(`"act": "${a.act}"`);
    const inOwner = owner.includes(`"act": "${a.act}"`);
    assert.equal(inSeat, a.built === true && a.who.includes('seat') && a.act !== 'read', `${a.act}: in the seat's format only when it can send it`);
    assert.equal(inOwner, a.built === true && a.who.includes('ownerAI'), `${a.act}: in the owner's AI's only when it can call it`);
    if (inSeat) {
      for (const f of Object.keys(a.fields)) assert.ok(seat.includes(`"${f}"`), `${a.act}: its field ${f}`);
      assert.ok(seat.includes(a.about), `${a.act}: what it does, from the table`);
    }
  }
  for (const f of ['"reason"', '"line"', '"name"', '"note"']) assert.ok(!owner.includes(f), `no ${f} for the owner's AI`);
  assert.ok(seat.includes('"reason"'), "control: a seat's play has its reason");
  assert.equal(replyFormat('seat'), seat, 'the same table, the same text');
});

test('the same failed action is refused once it has failed gap.tries times in a day, untried, its pieces matched by copy across briefings and its words aside; a different action, a success or a new day is tried (§33: "cap repeats"; gap.tries)', async () => {
  const { act } = await tools();
  const g = withTrades(['smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const tries = {};
  const k = g.hand('a01', tierCopy(g.s, 'rare'));
  g.errand('a01', 'fence_list', { copy: k, price: 100 });
  const tryGive = async from => {
    const c = await caller(g, 'a01', { tries, from });
    return { c, r: act({ act: 'give', to: 'a02', piece: c.deal.byCopy[k] }, c.ctx) };
  };
  let from = 1;
  for (let i = 0; i < N['gap.tries']; i++) {
    const { c, r } = await tryGive(from);
    assert.deepEqual([r.ok, r.code, c.sent.length], [false, 'rules', 1], `try ${i + 1}: tried, and the rules refuse it (it's listed)`);
    from = c.deal.next;
  }
  const { c: last, r: refused } = await tryGive(from);
  assert.deepEqual([refused.ok, refused.code, refused.kind, last.sent.length], [false, 'repeat', 'not-yet', 0], 'then refused untried, under its new handle');
  // Words aside: an ask to nobody, with a new line each time.
  const c = await caller(g, 'a01', { tries });
  for (let i = 0; i < N['gap.tries']; i++) assert.equal(act({ act: 'ask', to: 'a99', line: `try ${i}` }, c.ctx).code, 'field', `ask ${i + 1}: refused by the tools`);
  assert.equal(act({ act: 'ask', to: 'a99', line: 'once more' }, c.ctx).code, 'repeat', 'the same ask, new words: refused as a repeat');
  // A different action is tried; a success is never capped.
  assert.equal(act({ act: 'give', to: 'a03', piece: c.deal.byCopy[k] }, c.ctx).code, 'rules', 'another agent: a different action, tried');
  for (let i = 0; i <= N['gap.tries']; i++) assert.equal(act({ act: 'pay', to: 'a02', amount: 1 }, c.ctx).ok, true, `pay ${i + 1}: a success`);
  // A new day tries it again.
  g.night();
  const { c: next, r: again } = await tryGive(1);
  assert.deepEqual([again.code, next.sent.length], ['rules', 1], 'the next day it is tried');
});

test('built game-held plan, orders and journal tools preserve their audience and typed validation boundaries', async () => {
  const { ACTIONS, act } = await tools();
  const g = withTrades(['smuggler', 'smuggler']);
  const seat = await caller(g, 'a01');
  const owner = await caller(g, 'a01', { audience: 'ownerAI' });
  for (const name of ['plan', 'orders', 'note']) {
    const row = ACTIONS.find(a => a.act === name);
    assert.deepEqual([row.built, row.tool], [true, 'memory']);
    for (const c of row.who.includes('ownerAI') ? [seat, owner] : [seat]) {
      const invalid = act({ act: name }, c.ctx);
      assert.deepEqual([invalid.ok, invalid.code], [false, 'field'], `${name}: malformed input never reaches core`);
      const valid = name === 'note' ? { line: 'a dated note' } : name === 'plan' ? { traits: [] } : { orders: [] };
      assert.equal(act({ act: name, ...valid }, c.ctx).ok, true, `${name}: real core memory operation`);
    }
  }
  assert.equal(act({ act: 'note', line: 'private words' }, owner.ctx).code, 'audience');
  assert.equal(seat.sent.length + owner.sent.length, 5, 'three seat operations and two typed ownerAI operations reach core');
});

test('handles through the tools: a stale handle is refused as not yet and never reaches the rules; a fake and a real copy of its trait, handed over, come back alike (brief R2-3, R2-5)', async () => {
  const { act } = await tools();
  const g = withTrades(['gunrunner', 'smuggler', 'smuggler']);
  housed(g);
  const T = Object.values(g.s.traits).filter(t => t.tier === 'rare' && !t.ability).sort((x, y) => (x.id < y.id ? -1 : 1))[0];
  stock(g, 'a01', 'parts', N.build.fakes);
  g.night({ a01: { kind: 'build', fake: T.id } });
  const fake = g.events('fake', e => e.act === 'made')[0].copy;
  const real = g.hand('a01', T.copies[0]);
  const old = await caller(g, 'a01');
  const now = await caller(g, 'a01', { from: old.deal.next });
  const stale = act({ act: 'give', to: 'a02', piece: old.deal.byCopy[real] }, now.ctx);
  assert.deepEqual([stale.ok, stale.code, stale.kind, now.sent.length], [false, 'handle', 'not-yet', 0], 'stale: not yet, untried');
  const gave = [fake, real].map(k => act({ act: 'give', to: 'a02', piece: now.deal.byCopy[k] }, now.ctx));
  assert.deepEqual(gave.map(({ action, ...receipt }) => receipt)[0], gave.map(({ action, ...receipt }) => receipt)[1], 'the two hand-overs have identical status, with no fake disclosure');
  assert.deepEqual(gave.map(r => r.action.copy), [now.deal.byCopy[fake], now.deal.byCopy[real]], 'applied-action receipts identify the chosen handles without disclosing authenticity');
  assert.deepEqual(now.sent.map(e => e.copy), [fake, real], 'control: each reached the rules as its copy');
});

test("the tools' lists of a message's kinds, a payment's reasons and the terms' whats are the rules' own: each one the tools take, the rules keep (§14, §18)", async () => {
  const { TYPES } = await tools();
  const g = withTrades(['smuggler', 'smuggler']);
  housed(g);
  for (const why of TYPES.payFor.values) {
    g.errand('a01', 'pay', { to: 'a02', amount: 1, for: why });
    assert.equal(g.events('pay').at(-1).for, why, `pay for ${why}: kept`);
  }
  g.errand('a01', 'ask', { to: 'a02' });
  const sd = Object.keys(g.s.sitdowns)[0];
  g.errand('a02', 'answer', { sitdown: sd, accept: true });
  // Test-only: the day's message count put back before each message, as the collar tests set heat, so every pair fits.
  const before = g.s.agents.a01.msgs;
  for (const say of TYPES.sayKind.values) {
    for (const what of TYPES.termWhat.values) {
      g.s.agents.a01.msgs = before;
      assert.equal(g.errand('a01', 'say', { sitdown: sd, say, terms: { what } }).ok, true, `say ${say}: kept`);
      assert.equal(g.events('say').at(-1).terms.what, what, `terms' what ${what}: kept`);
    }
  }
});

test('the new GAP rows are in the numbers table: gap.tries a whole number of tries, and gap.reply the reply\'s shape (brief R2-5; numbers.mjs)', () => {
  for (const key of ['gap.tries', 'gap.reply']) {
    const row = ROWS.find(r => r.key === key);
    assert.ok(row, `${key}: a row`);
    assert.equal(row.status, 'GAP', `${key}: a GAP row`);
    assert.ok(row.ref.includes('§33') && row.note.length > 0, `${key}: its reference and note`);
  }
  assert.ok(Number.isInteger(N['gap.tries']) && N['gap.tries'] >= 1, 'a whole number of tries');
});
