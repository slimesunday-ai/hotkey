// R2-1, talk on the record (GAME.md §14, §17, §18, §19, §38; brief R2-agents.md, task 1; the orchestrator's Q6 and Q7):
// out loud, crew chat, and who made a play.
// - Out loud: a typed kind (a threat, a boast or an offer), a sit-down's terms and one line, N.outLoud a day each,
//   public at once and on the board for the day.
// - Crew chat: a sit-down's message (its kind, its terms and one line) to the whole crew, one of the day's messages. The
//   crew and its owners read it now, everyone 24 hours later.
// - A line is free text: no owner's AI reads one, live, 24 hours later or on day 15, though each gets the typed part.
// - A play may carry its origin (the seat's model, its standing orders or its default play), kept only when it's sent
//   and valid, so a bot's play carries none.
// Every check has a positive control. Amounts come from N, and no switch's value is pinned. The tools and the rules'
// exported lists are imported inside the tests that use them, so each test fails on its own before they exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, tierCopy } from './helpers.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { settleNight } from '../rules/night.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, DAY15 } from '../rules/state.mjs';
import { N, ROWS } from '../numbers.mjs';

const tools = () => import('../agents/tools.mjs');
const rules = () => import('../rules/errand.mjs');
const SEED = 404;
const COPY_ID = /\bk\d+\b/;
// An ordinary id that names nothing: an inherited name must do exactly what it does.
const UNKNOWN = 'zz-unknown';
const INHERITED = ['__proto__', 'constructor'];
const json = x => JSON.stringify(x);
const has = (x, word) => json(x).includes(word);
const KINDS = ['not-yet', 'never'];
const typedFailure = r => r && r.ok === false && typeof r.why === 'string' && KINDS.includes(r.kind) && typeof r.code === 'string';

// Every view of the game: each agent's own, its owner's (the same) and its owner's AI's, then the public's and the
// record's.
function views(g) {
  const ids = Object.keys(g.s.agents).sort();
  return [
    ...ids.flatMap(id => ['agent', 'owner', 'ownerAI'].map(audience => ({ who: id, audience, v: g.view(id, audience) }))),
    { who: null, audience: 'public', v: g.view(null, 'public') },
    { who: null, audience: 'record', v: g.view(null, 'record') },
  ];
}
const nameOf = x => `${x.audience}${x.who ? ` (${x.who})` : ''}`;

// A crew of the agents named, the first its founder.
function crewOf(g, ids) {
  assert.equal(g.errand(ids[0], 'crew_form', { name: 'the crew' }).ok, true, 'control: the crew forms');
  const c = g.s.agents[ids[0]].crew;
  for (const id of ids.slice(1)) {
    assert.equal(g.errand(ids[0], 'crew_invite', { agent: id }).ok, true, `control: ${id} is invited`);
    assert.equal(g.errand(id, 'crew_join', { crew: c }).ok, true, `control: ${id} joins`);
  }
  return c;
}
// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
// What a caller holds for one agent (as tools.test.mjs builds it): a briefing read now, for a seat or its owner's AI,
// and an `apply` that sends an errand through the rules; `sent` is every errand that reached them.
async function caller(g, id, { audience = 'seat' } = {}) {
  const { read } = await tools();
  const { deal, result } = read(g.view(id, audience === 'ownerAI' ? 'ownerAI' : 'agent'), { audience, seed: SEED });
  const sent = [];
  const apply = e => {
    sent.push(e);
    const r = g.errand(id, e.kind, e);
    const bad = r.events.find(x => x.type === 'invalid');
    return { ok: r.ok, why: r.why, kind: bad ? bad.kind : undefined };
  };
  return { deal, result, sent, ctx: { deal, apply, tries: {} } };
}

test("an out-loud line: every agent, its owner, the public and the record read it at once, and no owner's AI ever does, live, 24 hours later or on day 15, though each gets its kind and terms (§14, §18, §19; Q7)", () => {
  const g = new Game({ n: 4 });
  const terms = { what: 'hit', who: 'a02', night: g.s.day, where: 'docks' };
  const r = g.errand('a01', 'outloud', { say: 'threat', terms, line: 'CANARY-LOUD-1' });
  assert.equal(r.ok, true, `control: it went through (${r.why})`);
  const check = (word, when) => {
    for (const x of views(g)) {
      const reads = x.audience !== 'ownerAI';
      assert.equal(has(x.v, word), reads, `${when}: ${nameOf(x)} ${reads ? 'reads' : 'never reads'} ${word}`);
    }
  };
  check('CANARY-LOUD-1', 'live');
  // The typed part reaches every owner's AI (positive control), on the record and on the board.
  for (const id of Object.keys(g.s.agents)) {
    const v = g.view(id, 'ownerAI');
    const e = v.events.find(x => x.type === 'outloud');
    assert.deepEqual([e.agent, e.say, e.terms, 'line' in e], ['a01', 'threat', terms, false], `${id}'s owner's AI: the kind and the terms, no line`);
    assert.deepEqual(v.board.outloud, [{ agent: 'a01', say: 'threat', terms }], `${id}'s owner's AI: the board's line, typed`);
  }
  g.night();
  check('CANARY-LOUD-1', '24 hours later');
  assert.ok(g.view('a03', 'ownerAI').events.some(e => e.type === 'outloud' && e.say === 'threat'), '24 hours later: the typed part is still there');
  g.advanceTo(N.nights);
  assert.equal(g.errand('a02', 'outloud', { say: 'boast', line: 'CANARY-LOUD-14' }).ok, true, 'control: the last day');
  g.night();
  assert.equal(g.s.clock, DAY15);
  check('CANARY-LOUD-14', 'day 15');
  for (const x of views(g)) if (x.audience === 'ownerAI') assert.ok(!has(x.v, 'CANARY-LOUD-1'), `day 15: ${nameOf(x)}`);
  assert.ok(has(g.view(null, 'record'), 'CANARY-LOUD-1'), "day 15: positive control: the record keeps day 1's line");
});

test("crew chat: the crew and its owners read the line now and everyone 24 hours later; no owner's AI ever does, though the crew's get the kind and the terms now and everyone's 24 hours later (§14, §18, §19; Q6)", () => {
  const g = new Game({ n: 4 });
  crewOf(g, ['a01', 'a02']);
  const crew = new Set(['a01', 'a02']);
  const terms = { what: 'meet', where: 'docks' };
  const r = g.errand('a02', 'chat', { say: 'offer', terms, line: 'CANARY-CHAT-1' });
  assert.equal(r.ok, true, `control: it went through (${r.why})`);
  for (const x of views(g)) {
    const reads = x.audience !== 'ownerAI' && crew.has(x.who);
    assert.equal(has(x.v, 'CANARY-CHAT-1'), reads, `live: ${nameOf(x)} ${reads ? 'reads' : "doesn't read"} the line`);
  }
  const typed = id => g.view(id, 'ownerAI').events.filter(e => e.type === 'chat').map(e => [e.from, e.say, e.terms, 'line' in e]);
  for (const id of crew) assert.deepEqual(typed(id), [['a02', 'offer', terms, false]], `live: ${id}'s owner's AI gets the typed part`);
  for (const id of ['a03', 'a04']) assert.deepEqual(typed(id), [], `live: ${id}'s owner's AI gets none of it`);
  g.night();
  for (const x of views(g)) {
    const reads = x.audience !== 'ownerAI';
    assert.equal(has(x.v, 'CANARY-CHAT-1'), reads, `24 hours later: ${nameOf(x)} ${reads ? 'reads' : 'never reads'} the line`);
  }
  for (const id of ['a03', 'a04']) assert.deepEqual(typed(id), [['a02', 'offer', terms, false]], `24 hours later: ${id}'s owner's AI gets the typed part`);
  g.advanceTo(N.nights);
  assert.equal(g.errand('a01', 'chat', { say: 'answer', line: 'CANARY-CHAT-14' }).ok, true, 'control: the last day');
  assert.ok(!has(g.view('a03'), 'CANARY-CHAT-14'), 'control: the last day, only the crew');
  g.night();
  assert.equal(g.s.clock, DAY15);
  for (const x of views(g)) {
    const reads = x.audience !== 'ownerAI';
    assert.equal(has(x.v, 'CANARY-CHAT-14'), reads, `day 15: ${nameOf(x)} ${reads ? 'reads' : 'never reads'} the line`);
    if (!reads) assert.ok(!has(x.v, 'CANARY-CHAT-1'), `day 15: ${nameOf(x)}, day 1's either`);
  }
});

test("junk in a typed field of out loud or crew chat, or in a play's origin, reaches no view: a kind the rules don't know is refused, typed never, and terms or an origin they can't read are dropped (§18, §23)", () => {
  const g = new Game({ n: 4 });
  crewOf(g, ['a01', 'a02']);
  const junk = n => ({
    what: `CANARY-WHAT-${n}`, who: `CANARY-WHO-${n}`, piece: `CANARY-PIECE-${n}`, cash: `CANARY-CASH-${n}`,
    night: `CANARY-NIGHT-${n}`, where: `CANARY-WHERE-${n}`, goods: { [`CANARY-GOODS-${n}`]: 1 }, extra: `CANARY-EXTRA-${n}`,
  });
  for (const r of [g.errand('a01', 'outloud', { say: 'CANARY-SAY-1', line: 'plain' }), g.errand('a02', 'chat', { say: 'CANARY-SAY-2', line: 'plain' })]) {
    assert.deepEqual([r.ok, r.events.map(e => [e.type, e.kind])], [false, [['invalid', 'never']]], 'control: an unknown kind is refused, typed never');
  }
  const kept = [
    g.errand('a01', 'outloud', { say: 'boast', terms: { ...junk(3), where: 'docks' }, note: 'CANARY-NOTE-3', line: 'plain' }),
    g.errand('a02', 'chat', { say: 'offer', terms: { ...junk(4), who: 'a01' }, note: 'CANARY-NOTE-4', line: 'plain' }),
    g.errand('a03', 'outloud', { say: 'offer', terms: 'CANARY-TERMS-5', line: 'plain' }),
  ];
  assert.ok(kept.every(r => r.ok), `control: each went through (${kept.map(r => r.why)})`);
  assert.deepEqual(g.events('outloud').map(e => e.terms), [{ where: 'docks' }, {}], 'control: a valid place is kept, and nothing else');
  assert.deepEqual(g.events('chat').map(e => e.terms), [{ who: 'a01' }], 'control: a valid agent is kept, and nothing else');
  g.night({ a01: { kind: 'hustle', place: 'docks', origin: 'CANARY-ORIGIN-6' }, a02: { kind: 'CANARY-KIND-7', origin: 'CANARY-ORIGIN-7' } });
  const shift = g.events('play', e => e.agent === 'a01');
  assert.deepEqual([shift.length, shift[0].kind, 'origin' in shift[0]], [1, 'hustle', false], 'control: the shift went in, without its origin');
  const bad = g.events('invalid', e => e.agent === 'a02' && e.t === 3);
  assert.deepEqual([bad.length, bad[0].play.kind, 'origin' in bad[0].play], [1, 'unknown', false], 'control: the bad play is typed and logged, without its origin');
  for (const when of ['the morning after', 'two days later']) {
    for (const x of views(g)) assert.ok(!has(x.v, 'CANARY'), `${when}: no canary in ${nameOf(x)}`);
    g.night();
    g.night();
  }
});

test("the day's caps: N.outLoud out-loud lines each, then not yet until the next day, and none of the day's messages; crew chat is one of the day's N.messages, which sit-downs share, then not yet (§14, §38)", () => {
  const g = new Game({ n: 3 });
  crewOf(g, ['a01', 'a02']);
  const loud = id => g.errand(id, 'outloud', { say: 'boast', line: 'look at me' });
  for (let i = 0; i < N.outLoud; i++) assert.equal(loud('a01').ok, true, `line ${i + 1}`);
  const over = loud('a01');
  assert.deepEqual([over.ok, over.events.map(e => [e.type, e.kind])], [false, [['invalid', 'not-yet']]], 'one more: not yet');
  assert.equal(g.events('outloud').length, N.outLoud, 'control: the lines said');
  assert.equal(g.view('a01').me.outLoudLeft, 0, 'its view says none left');
  assert.equal(g.view('a02').me.outLoudLeft, N.outLoud, "control: each agent's own count");
  assert.equal(g.view('a01').me.messagesLeft, N.messages, "out loud uses none of the day's messages");
  assert.equal(loud('a02').ok, true, 'control: another agent still speaks');
  assert.equal(g.errand('a01', 'ask', { to: 'a03' }).ok, true, 'control: a sit-down asked');
  for (let i = 1; i < N.messages; i++) assert.equal(g.errand('a01', 'chat', { say: 'offer', line: `${i}` }).ok, true, `message ${i + 1}`);
  assert.equal(g.view('a01').me.messagesLeft, 0, 'the ask and the chats used every message');
  for (const [kind, fields] of [['chat', { say: 'offer' }], ['ask', { to: 'a02' }]]) {
    const r = g.errand('a01', kind, fields);
    assert.deepEqual([r.ok, r.events.map(e => [e.type, e.kind])], [false, [['invalid', 'not-yet']]], `${kind}: none left, not yet`);
  }
  g.night();
  assert.equal(loud('a01').ok, true, 'the next day: out loud again');
  assert.equal(g.view('a01').me.outLoudLeft, N.outLoud - 1, 'one line used of the new day');
  assert.equal(g.errand('a01', 'chat', { say: 'answer', line: 'w'.repeat(N['gap.lineLength'] + 1) }).ok, true, 'and crew chat');
  assert.equal(g.events('chat').at(-1).line.length, N['gap.lineLength'], "a chat's line is cut to gap.lineLength too");
  const lone = g.errand('a03', 'chat', { say: 'offer' });
  assert.deepEqual([lone.ok, lone.events.map(e => [e.type, e.kind])], [false, [['invalid', 'never']]], 'no crew, no crew chat');
});

test("inherited names in every new field: __proto__ or constructor as out loud's or crew chat's kind is refused, typed never, exactly as an unknown kind; in their terms or in a play's origin it's dropped, exactly as an unknown id; nothing throws (§23, §33)", () => {
  const g = new Game({ n: 3 });
  crewOf(g, ['a01', 'a02']);
  const before = json(g.s);
  const run = e => {
    try {
      const r = applyErrand(g.s, e);
      return { r, json: json([r.ok, r.why, r.events, r.state]) };
    } catch (err) {
      return { threw: err.message };
    }
  };
  const terms = { what: 'trade', who: 'a02', piece: Object.keys(g.s.traits).sort()[0], cash: 5, night: g.s.day, where: 'docks', goods: { chems: 1 } };
  for (const kind of ['outloud', 'chat']) {
    const base = { by: 'a01', kind, say: 'offer', terms, line: 'a word' };
    const ok = run(base);
    assert.ok(ok.r && ok.r.ok, `control: ${kind}'s baseline goes through`);
    for (const bad of INHERITED) {
      const [o, ctrl] = [run({ ...base, say: bad }), run({ ...base, say: UNKNOWN })];
      assert.ok(!o.threw, `${kind} say ${bad}: ${o.threw}`);
      assert.equal(o.json, ctrl.json, `${kind} say ${bad}: as an unknown kind`);
      assert.deepEqual([o.r.ok, o.r.events.map(e => [e.type, e.kind])], [false, [['invalid', 'never']]], `${kind} say ${bad}: refused, typed never`);
      for (const f of ['what', 'who', 'piece', 'where']) {
        const [x, c] = [run({ ...base, terms: { ...terms, [f]: bad } }), run({ ...base, terms: { ...terms, [f]: UNKNOWN } })];
        assert.ok(!x.threw, `${kind} terms.${f} ${bad}: ${x.threw}`);
        assert.equal(x.json, c.json, `${kind} terms.${f} ${bad}: as an unknown id`);
        assert.ok(x.r.ok && !(f in x.r.events[0].terms), `${kind} terms.${f} ${bad}: dropped`);
      }
      const [x, c] = [run({ ...base, terms: { ...terms, goods: JSON.parse(`{"${bad}": 1}`) } }), run({ ...base, terms: { ...terms, goods: { [UNKNOWN]: 1 } } })];
      assert.ok(!x.threw && x.json === c.json && !('goods' in x.r.events[0].terms), `${kind} terms.goods naming ${bad}: dropped as unknown goods`);
    }
  }
  // A play's origin, on a play that goes through and on one that doesn't, beside every other agent's shift.
  for (const play of [{ kind: 'hustle', place: 'docks' }, { kind: 'hustle', place: 'suburbs' }]) {
    const night = origin => {
      try {
        const r = settleNight(g.s, { a01: { ...play, origin }, a02: { kind: 'hustle', place: 'docks' }, a03: { kind: 'hustle', place: 'docks' } });
        return json([r.events, r.state, r.fights, r.plays]);
      } catch (err) {
        return `threw ${err.message}`;
      }
    };
    for (const bad of INHERITED) assert.equal(night(bad), night(UNKNOWN), `origin ${bad} on ${json(play)}: as an unknown origin`);
    assert.ok(night('model').includes('"origin":"model"'), `control: a valid origin on ${json(play)} is kept`);
  }
  assert.equal(json(g.s), before, 'control: nothing changed the game');
});

test('through the tools, a seat naming __proto__ or constructor in any id field of out loud or crew chat is refused, typed never, and nothing reaches the rules (§23, §33; brief R2-5)', async () => {
  const { act } = await tools();
  const g = new Game({ n: 3 });
  crewOf(g, ['a01', 'a02']);
  const c = await caller(g, 'a01');
  const fine = act({ act: 'outloud', say: 'boast', terms: { who: 'a02' }, line: 'x' }, c.ctx);
  assert.equal(fine.ok, true, `control: a seat speaks out loud (${fine.why})`);
  const before = c.sent.length;
  for (const bad of INHERITED) {
    for (const name of ['outloud', 'chat']) {
      for (const fields of [
        { say: bad }, { say: 'offer', terms: { who: bad } }, { say: 'offer', terms: { piece: bad } },
        { say: 'offer', terms: { where: bad } }, { say: 'offer', terms: { what: bad } }, { say: 'offer', terms: { goods: JSON.parse(`{"${bad}": 1}`) } },
      ]) {
        const r = act({ act: name, ...fields, line: 'x' }, c.ctx);
        assert.ok(typedFailure(r) && r.kind === 'never', `${name} ${json(fields)}: refused, typed never (${json(r)})`);
      }
    }
  }
  assert.equal(c.sent.length, before, 'nothing reached the rules');
});

test("a play's origin (the seat's model, its standing orders or its default play) is kept, typed, on the record of the play it came with: the owner and its AI read it now, everyone 24 hours later; a play sent without one carries none, and a model can't write its own (§17, §18, §19, §27)", async () => {
  const g = new Game({ n: 5 });
  stock(g, 'a05', 'temp', 1);
  assert.equal(g.errand('a05', 'take', { drug: 'temp' }).ok, true, 'control: a05 takes TEMP, and crashes tomorrow night');
  g.night({
    a01: { kind: 'hustle', place: 'docks', origin: 'model' },
    a02: { kind: 'hustle', place: 'industrial', origin: 'orders', reason: 'standing order' },
    a03: { kind: 'laylow', place: 'suburbs', origin: 'default' },
    a04: { kind: 'hustle', place: 'docks' },
  });
  const played = id => g.events('play', e => e.agent === id).at(-1);
  assert.deepEqual(['a01', 'a02', 'a03'].map(id => played(id).origin), ['model', 'orders', 'default'], 'each origin, on its play');
  assert.ok(!('origin' in played('a04')) && !('origin' in played('a05')), 'a play sent without one carries none, as a bot\'s');
  // Night 1's plays, day 2: the owner's now, everyone's 24 hours later.
  const night1 = (v, id) => v.events.find(e => e.type === 'play' && e.agent === id && e.t === 3);
  for (const audience of ['agent', 'owner', 'ownerAI']) assert.equal(night1(g.view('a01', audience), 'a01').origin, 'model', `the owner reads it now: ${audience}`);
  const typed = night1(g.view('a02', 'ownerAI'), 'a02');
  assert.deepEqual([typed.origin, 'reason' in typed], ['orders', false], "its owner's AI: the origin, without the reason");
  for (const v of [g.view('a02'), g.view(null, 'public')]) assert.equal(night1(v, 'a01'), undefined, `not yet ${v.audience}'s`);
  // An origin stays with the play it came with: the record of an invalid play, or of one a crash replaced, keeps it,
  // and the play the lock played instead carries none.
  g.night({ a01: { kind: 'hit', target: 'a01', place: 'docks', origin: 'model' }, a05: { kind: 'hustle', place: 'docks', origin: 'model' } });
  const invalid = g.events('invalid', e => e.agent === 'a01').at(-1);
  assert.deepEqual([invalid.play.kind, invalid.play.origin, 'origin' in played('a01')], ['hit', 'model', false], "the invalid play's record keeps its origin, and the default play carries none");
  const forced = g.events('forced', e => e.agent === 'a05').at(-1);
  assert.deepEqual([forced.why, forced.play.origin, 'origin' in played('a05')], ['crash', 'model', false], "the crash's record keeps the play sent with its origin, and the forced play carries none");
  for (const x of [g.view('a02'), g.view('a02', 'ownerAI'), g.view(null, 'public'), g.view(null, 'record')]) {
    assert.equal(night1(x, 'a01').origin, 'model', `24 hours later: ${x.audience}`);
  }
  // The caller marks the origin, never the model: a reply's own origin doesn't reach the play the caller takes.
  const { reply } = await tools();
  const c = await caller(g, 'a04');
  const out = reply({ actions: [{ act: 'play', menu: 1, origin: 'orders' }] }, c.ctx);
  assert.equal(out.results[0].ok, false, 'forged origin is refused instead of silently dropped');
  assert.equal(out.play, null); assert.equal(out.results[0].code, 'field');
  const valid = reply({ actions: [{ act: 'play', menu: 1 }] }, c.ctx);
  assert.equal(valid.results[0].ok, true, 'valid unmarked play still works');
  assert.ok(!('origin' in valid.play), 'only the trusted caller stamps provenance');
});

test('out loud is on the board for the day, in the order said, and off it the next day while the record keeps it; live, a drug in its terms is a dose to everyone but its speaker (§11, §14, §19, §20)', () => {
  const g = new Game({ n: 3 });
  const terms = { what: 'trade', cash: 50, goods: { truth: 2 } };
  assert.equal(g.errand('a01', 'outloud', { say: 'offer', terms, line: 'two for fifty' }).ok, true, 'control: an offer');
  assert.equal(g.errand('a02', 'outloud', { say: 'boast', line: 'untouchable' }).ok, true, 'control: a boast');
  const board = v => v.board.outloud.map(x => [x.agent, x.say, x.line]);
  const both = [['a01', 'offer', 'two for fifty'], ['a02', 'boast', 'untouchable']];
  for (const v of [g.view('a01'), g.view('a03'), g.view(null, 'public'), g.view(null, 'record')]) assert.deepEqual(board(v), both, `${v.audience}: both, in the order said`);
  assert.deepEqual(g.view('a01').board.outloud[0].terms, terms, 'the speaker reads its own drug');
  for (const v of [g.view('a02'), g.view('a03'), g.view(null, 'public'), g.view(null, 'record'), g.view('a03', 'ownerAI')]) {
    assert.deepEqual(v.board.outloud[0].terms.goods, { doses: 2 }, `${v.audience}: a dose on the board`);
    assert.deepEqual(v.events.find(e => e.type === 'outloud' && e.agent === 'a01').terms.goods, { doses: 2 }, `${v.audience}: and on the record`);
  }
  // One line of free text: a longer one is cut to gap.lineLength characters, on the board and on the record.
  const long = 'w'.repeat(N['gap.lineLength'] + 50);
  assert.equal(g.errand('a03', 'outloud', { say: 'threat', line: long }).ok, true, 'control: a long line');
  assert.deepEqual([g.view('a01').board.outloud[2].line, g.events('outloud').at(-1).line], [long.slice(0, N['gap.lineLength']), long.slice(0, N['gap.lineLength'])], 'cut to gap.lineLength');
  g.night();
  assert.deepEqual(g.view('a03').board.outloud, [], 'the next day, off the board');
  const later = g.view('a03').events.find(e => e.type === 'outloud' && e.agent === 'a01');
  assert.deepEqual([later.line, later.terms.goods], ['two for fifty', { truth: 2 }], 'the record keeps it, and 24 hours on names the drug');
});

test("crew chat and the mind drugs: a member on FIREWALL isn't reached until it goes public at dawn, though what it sends still goes; CLEAR wipes the chat its taker read before it until then (§11, §19; gap.firewall, gap.clear)", () => {
  const g = new Game({ n: 4 });
  crewOf(g, ['a01', 'a02', 'a03']);
  stock(g, 'a02', 'firewall', 1);
  stock(g, 'a03', 'clear', 1);
  assert.equal(g.errand('a01', 'chat', { say: 'offer', line: 'CANARY-BEFORE' }).ok, true);
  assert.ok(has(g.view('a03'), 'CANARY-BEFORE'), 'control: a03 read it');
  assert.equal(g.errand('a02', 'take', { drug: 'firewall' }).ok, true, 'control: FIREWALL');
  assert.equal(g.errand('a03', 'take', { drug: 'clear' }).ok, true, 'control: CLEAR');
  assert.ok(!has(g.view('a03'), 'CANARY-BEFORE'), 'CLEAR: its taker forgets it');
  assert.ok(has(g.view('a01'), 'CANARY-BEFORE') && has(g.view('a02'), 'CANARY-BEFORE'), 'control: the rest of the crew keeps it');
  assert.equal(g.errand('a01', 'chat', { say: 'threat', line: 'CANARY-WALLED' }).ok, true, 'control: it goes');
  for (const audience of ['agent', 'owner']) assert.ok(!has(g.view('a02', audience), 'CANARY-WALLED'), `FIREWALL: not reached (${audience})`);
  assert.ok(has(g.view('a03'), 'CANARY-WALLED'), 'control: the rest of the crew is');
  assert.equal(g.errand('a02', 'chat', { say: 'answer', line: 'CANARY-SENT' }).ok, true, 'what it sends still goes');
  for (const id of ['a01', 'a02', 'a03']) assert.ok(has(g.view(id), 'CANARY-SENT'), `${id} reads it`);
  // Out loud is sent to nobody in particular: FIREWALL's taker still speaks, and reads the board's lines.
  assert.equal(g.errand('a02', 'outloud', { say: 'boast', line: 'CANARY-WALL-LOUD' }).ok, true, 'out loud: its taker speaks');
  assert.equal(g.errand('a01', 'outloud', { say: 'threat', line: 'CANARY-AT-WALL' }).ok, true, 'control: a line said to all');
  assert.ok(g.view('a02').board.outloud.some(x => x.line === 'CANARY-AT-WALL'), "and its taker reads it on the board");
  g.night();
  assert.ok(has(g.view('a02'), 'CANARY-WALLED'), 'at dawn it is public, and the walled member reads it with everyone');
  assert.ok(has(g.view('a03'), 'CANARY-BEFORE'), 'and so does CLEAR\'s taker');
});

test('the tools switch on out loud and crew chat with their real fields: a seat sends both through the table, and they reach the rules as the errands of their names, a piece in the terms by its handle; an owner\'s AI sends neither; the tools take the rules\' own lists (§14, §17, §18; brief R2-1, R2-5)', async () => {
  const { ACTIONS, TYPES, act, replyFormat } = await tools();
  const { SAY_KINDS, PAY_FOR, TERM_WHAT, LOUD_KINDS } = await rules();
  for (const [type, list] of [['sayKind', SAY_KINDS], ['payFor', PAY_FOR], ['termWhat', TERM_WHAT], ['loudKind', LOUD_KINDS]]) {
    assert.ok(Array.isArray(list) && list.length > 0, `the rules export ${type}'s list`);
    assert.equal(TYPES[type].values, list, `${type}: the tools take the rules' own list, not a copy`);
  }
  for (const name of ['outloud', 'chat']) {
    const row = ACTIONS.find(a => a.act === name);
    assert.deepEqual([row.built, row.errand, row.who], [true, name, ['seat']], `${name}: built, the errand of its name, the seat's alone`);
    assert.ok(new RegExp(`\\{"act":\\s*"${name}"\\}.*"say":\\s*${row.fields.say}`).test(replyFormat('seat')), `${name}: in the seat's reply format, with its kind`);
    assert.ok(!new RegExp(`"act"\\s*:\\s*"${name}"`).test(replyFormat('ownerAI')), `${name}: not in the owner's AI's`);
  }
  const g = new Game({ n: 3 });
  crewOf(g, ['a01', 'a02']);
  const k = g.hand('a01', tierCopy(g.s, 'rare'));
  const c = await caller(g, 'a01');
  const loud = act({ act: 'outloud', say: 'offer', terms: { what: 'trade', piece: c.deal.byCopy[k], cash: 10 }, line: 'yours for ten' }, c.ctx);
  const chat = act({ act: 'chat', say: 'promise', terms: { what: 'back', who: 'a02', night: g.s.day }, line: 'got you' }, c.ctx);
  assert.deepEqual([loud.ok, chat.ok], [true, true], `${json(loud)} ${json(chat)}`);
  assert.deepEqual(c.sent.map(e => e.kind), ['outloud', 'chat'], 'each reached the rules as its errand');
  assert.equal(c.sent[0].terms.piece, k, "the terms' piece, by handle, reaches the rules as its copy");
  assert.equal(g.events('outloud')[0].terms.piece, k, 'control: and the record keeps the copy');
  assert.deepEqual(g.events('chat').map(e => [e.from, e.say, e.terms.who, e.line]), [['a01', 'promise', 'a02', 'got you']], 'the crew chat');
  const other = await caller(g, 'a03');
  const row = other.result.view.board.outloud[0];
  assert.deepEqual([row.agent, row.say, row.line], ['a01', 'offer', 'yours for ten'], 'another seat reads the line on the board');
  assert.equal(row.terms.piece, other.deal.byCopy[k], 'and the piece by its own handle');
  assert.ok(!COPY_ID.test(json(other.result)), 'no copy id in what it reads');
  const owner = await caller(g, 'a01', { audience: 'ownerAI' });
  for (const name of ['outloud', 'chat']) assert.equal(act({ act: name, say: 'offer', line: 'x' }, owner.ctx).code, 'audience', `${name}: not the owner's AI's to send`);
  assert.equal(owner.sent.length, 0, 'nothing reached the rules');
});

test("the new rows are in the numbers table: outLoud a GUESS from §38's Talk row, and GAP rows for out loud, crew chat and a play's origin; gap.fakes's note matches R2-3 (brief R2-1; numbers.mjs)", () => {
  const row = key => ROWS.find(r => r.key === key);
  assert.ok(row('outLoud'), 'outLoud: a row');
  assert.deepEqual([row('outLoud').status, row('outLoud').ref.includes('§38')], ['GUESS', true], "outLoud: a GUESS, from §38's Talk row");
  assert.ok(Number.isInteger(N.outLoud) && N.outLoud >= 1, 'a whole number of lines');
  for (const key of ['gap.outloud', 'gap.chat', 'gap.origin']) {
    assert.ok(row(key), `${key}: a row`);
    assert.equal(row(key).status, 'GAP', `${key}: a GAP row`);
    assert.ok(row(key).ref.includes('§') && row(key).note.length > 0, `${key}: its reference and note`);
  }
  const fakes = row('gap.fakes').note;
  assert.ok(fakes.includes('no player reads a copy id') && fakes.includes('core/agents/handles.mjs'), "gap.fakes: R2-3's handles");
  assert.ok(!fakes.includes('takes the id of the real copy it imitates'), 'gap.fakes: not the call R2-3 replaced');
});
