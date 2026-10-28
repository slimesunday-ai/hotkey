// R2-3, no copy id reaches a player (GAME.md §3, §4, §19; brief R2-agents.md, task 3, which replaces call 1 of
// R1-layer4-score.md). A fake's copy id continues the drop's numbering, and every list sale shows its copy, so a player
// that read copy ids could spot a fake. A seat and an owner's AI read pieces by trait, tier and slot under a handle
// (`P3`), good for one briefing, dealt by holder, then trait, with ties shuffled from the season's seed, the seat and
// the day; a handle in a reply maps back to the copy that briefing's view held. What's left is the honest tell (§3):
// more pieces of a trait in view than its posted count, and the tells the rules keep (shades, its maker, the fence).
// Each test imports the handles itself, so each fails on its own before they exist. Amounts come from N or the state a
// test set up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game, ITEMS, idOf, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { settleNight } from '../rules/night.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { viewFor } from '../rules/view.mjs';
import { addGoods } from '../rules/state.mjs';
import { N } from '../numbers.mjs';
import { rng, shuffle } from '../rng.mjs';

const handles = () => import('../agents/handles.mjs');
const core = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-handles-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
// The canary (brief, R2-3): a copy id anywhere in what a seat or an owner's AI reads.
const COPY_ID = /\bk\d+\b/;
const showsId = x => COPY_ID.test(JSON.stringify(x));
const SEED = 404;
const label = v => `${v.audience}${v.me ? ` (${v.me.id})` : ''}`;

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
const housed = g => Object.keys(g.s.agents).forEach(id => g.grant(id, 2 * N.nights * N.rent));
const plainRare = g => Object.values(g.s.traits).filter(t => t.tier === 'rare' && !t.ability).sort((x, y) => (x.id < y.id ? -1 : 1))[0];
// A fake of `trait`, built at home tonight by the Gunrunner `maker`, from its maker's own record of it.
function forge(g, maker, trait) {
  stock(g, maker, 'parts', N.build.fakes);
  const r = g.night({ [maker]: { kind: 'build', fake: trait } });
  const made = r.newEvents.filter(e => e.type === 'fake' && e.act === 'made' && e.agent === maker);
  assert.equal(made.length, 1, `control: ${maker} made a fake of ${trait}`);
  return made[0].copy;
}
// Every seat's view and its owner's AI's.
const seatViews = g => Object.keys(g.s.agents).sort().flatMap(id => [g.view(id), g.view(id, 'ownerAI')]);

// The scene: a01, a Gunrunner, fakes a rare trait T and hands the fake to a02, which also holds a real copy of T; a03
// wears a real copy of T; a04 posts a bounty on a02's real copy; a05 names the fake in a sit-down with a02, with a line
// and a crew name that quote copy ids; a06 hires a lookout on a02 and buys a common on the list.
function scene() {
  const g = withTrades(['gunrunner', 'smuggler', 'smuggler', 'smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const T = plainRare(g);
  const fake = forge(g, 'a01', T.id);
  const real = g.hand('a02', T.copies[0]);
  const worn = g.hand('a03', T.copies[1], { wear: true });
  g.errand('a01', 'give', { to: 'a02', copy: fake });
  assert.equal(g.errand('a04', 'bounty', { copy: real, amount: N.rent }).ok, true, 'control: the bounty');
  g.errand('a05', 'ask', { to: 'a02', line: `ask ${real}` });
  const sd = Object.keys(g.s.sitdowns)[0];
  g.errand('a02', 'answer', { sitdown: sd, accept: true });
  assert.equal(g.errand('a05', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', piece: fake, cash: N.rent }, line: `I want ${fake}` }).ok, true, 'control: the sit-down');
  g.errand('a05', 'crew_form', { name: `${worn} crew` });
  assert.equal(g.errand('a06', 'lookout', { agent: 'a02' }).ok, true, 'control: the lookout');
  const common = Object.values(g.s.traits).filter(t => t.tier === 'common' && t.opens <= g.s.day).sort((x, y) => (x.id < y.id ? -1 : 1))[0];
  assert.equal(g.errand('a06', 'offer', { trait: common.id, amount: common.price }).ok, true, 'control: the offer');
  return { g, T, fake, real, worn, common };
}

test('no copy id reaches a seat or an owner\'s AI: every piece, event, bounty, sit-down term and quoted line shows a handle or nothing, live and 24 hours later, though every raw view holds copy ids (canary, §19; brief R2-3)', async () => {
  const { dealHandles } = await handles();
  const { g, worn } = scene();
  const sweep = when => {
    for (const v of seatViews(g)) {
      assert.ok(showsId(v), `${when}, ${label(v)}: positive control: the raw view holds copy ids`);
      const d = dealHandles(v, { seed: SEED });
      assert.ok(!showsId(d.view), `${when}, ${label(v)}: no copy id`);
      assert.ok(Object.keys(d.byHandle).length > 0, `${when}, ${label(v)}: positive control: it dealt handles`);
    }
  };
  sweep('day 2');
  // Night 2: a04 hits a03 for the real copy it wears, naming it, so the play's `want` reaches the record.
  g.night({ a04: { kind: 'hit', target: 'a03', place: 'docks', want: worn } });
  sweep('day 3');
  g.night();
  sweep('day 4');
  const a04 = g.view('a04');
  assert.ok(a04.events.some(e => e.type === 'play' && e.want === worn), 'positive control: the want is on the record');
});

test('free text keeps its words but never a copy id: a sit-down line and a crew name that quote one show a mask, for the agents who read them live and everyone 24 hours later (§18, §19)', async () => {
  const { dealHandles } = await handles();
  const { g, fake, worn } = scene();
  const said = v => v.events.filter(e => e.type === 'say').map(e => e.line);
  const crew = v => v.board.crews.map(c => c.name);
  const raw = g.view('a02');
  assert.deepEqual([said(raw), crew(raw)], [[`I want ${fake}`], [`${worn} crew`]], 'positive control: the raw view quotes the ids');
  const d = dealHandles(raw, { seed: SEED });
  const [line] = said(d.view);
  const [name] = crew(d.view);
  assert.ok(line.startsWith('I want ') && name.endsWith(' crew'), 'the words stay');
  assert.ok(!COPY_ID.test(line) && !COPY_ID.test(name), 'the ids go');
  assert.ok(!Object.values(d.byCopy).some(h => line.includes(h) || name.includes(h)), "and no handle stands in for an id another agent wrote");
});

test('a planted fake and a real copy of its trait read alike but for the handle: its holder\'s pieces and its owner\'s AI\'s, a lookout\'s look, the holdings record, and two fits on the board (§4, §19; brief R2-3)', async () => {
  const { dealHandles } = await handles();
  const { g, T, fake, real, worn } = scene();
  const alike = (xs, hs, what) => {
    const [x, y] = hs.map(h => xs.find(p => p.copy === h));
    assert.ok(x && y, `control: ${what} lists both`);
    assert.notEqual(x.copy, y.copy, `${what}: two handles`);
    assert.deepEqual({ ...x, copy: null }, { ...y, copy: null }, `${what}: the fake reads as the real copy`);
  };
  for (const v of [g.view('a02'), g.view('a02', 'ownerAI')]) {
    const d = dealHandles(v, { seed: SEED });
    alike(d.view.me.pieces, [fake, real].map(k => d.byCopy[k]), `${label(v)}: its pieces`);
  }
  const look = dealHandles(g.view('a06'), { seed: SEED });
  alike(look.view.events.find(e => e.type === 'look').pieces, [fake, real].map(k => look.byCopy[k]), "a06's look");
  g.night();
  const own = dealHandles(g.view('a02'), { seed: SEED });
  alike(own.view.events.filter(e => e.type === 'holdings' && e.agent === 'a02').at(-1).pieces, [fake, real].map(k => own.byCopy[k]), "a02's holdings record");
  // a02 puts the fake on; a03 still wears a real copy of T: on the board they read alike, but for the handle.
  g.errand('a02', 'dress', { fit: { [T.slot]: fake } });
  for (const v of [g.view('a04'), g.view('a04', 'ownerAI'), g.view('a02')]) {
    const d = dealHandles(v, { seed: SEED });
    const fit = id => d.view.board.agents.find(a => a.id === id).fit;
    assert.deepEqual({ ...fit('a02')[0], copy: null }, { ...fit('a03')[0], copy: null }, `${label(v)}: the two fits`);
    assert.deepEqual([fit('a02')[0].copy, fit('a03')[0].copy], [d.byCopy[fake], d.byCopy[worn]], `${label(v)}: control: each by its handle`);
  }
  // The rules' own tells stay: its maker's view still marks it (§19).
  const maker = dealHandles(g.view('a01'), { seed: SEED });
  assert.equal(maker.view.board.agents.find(a => a.id === 'a02').fit[0].fake, true, 'its maker still tells it');
});

test('a list sale shows who, what and how much, never its copy: the board\'s sales and the buy events carry no handle, so no piece can be matched to a sale (§3, §19; brief R2-3)', async () => {
  const { dealHandles } = await handles();
  const { g, common } = scene();
  g.night();
  for (const v of [g.view('a06'), g.view('a02'), g.view('a03', 'ownerAI')]) {
    const sale = v.board.sales.find(x => x.trait === common.id);
    const buy = v.events.find(e => e.type === 'buy' && e.trait === common.id);
    assert.ok(sale && !('copy' in sale) && buy && !('copy' in buy), `${label(v)}: the raw sale and buy name no copy either: the view owns §19's rule (R6 sale copy)`);
    const d = dealHandles(v, { seed: SEED });
    const hsale = d.view.board.sales.find(x => x.trait === common.id);
    const hbuy = d.view.events.find(e => e.type === 'buy' && e.trait === common.id);
    assert.deepEqual(hsale, { night: sale.night, agent: sale.agent, trait: sale.trait, price: sale.price }, `${label(v)}: who, what and how much`);
    assert.ok(!('copy' in hbuy) && hbuy.agent === buy.agent && hbuy.price === buy.price, `${label(v)}: the buy event too`);
  }
  // The buyer still holds the piece, by its handle.
  const d = dealHandles(g.view('a06'), { seed: SEED });
  assert.equal(d.view.me.pieces.filter(p => p.trait === common.id).length, 1, 'control: a06 holds it');
});

test('handles are dealt by holder, then trait, never from the copy id: the seat\'s own pieces first, then each fit on the board by agent, the trait\'s order within; across seeds a fake lands anywhere among the copies of its trait (brief R2-3)', async () => {
  const { dealHandles } = await handles();
  const g = withTrades(['gunrunner', 'smuggler', 'smuggler', 'smuggler']);
  housed(g);
  const T = plainRare(g);
  const fake = forge(g, 'a01', T.id);
  g.errand('a01', 'give', { to: 'a02', copy: fake });
  for (const k of T.copies) g.hand('a02', k);
  const other = g.hand('a02', tierCopy(g.s, 'common', t => t.slot !== T.slot));
  g.hand('a03', tierCopy(g.s, 'common', t => t.slot !== T.slot, 1), { wear: true });
  g.hand('a04', tierCopy(g.s, 'common', t => t.slot !== T.slot, 2), { wear: true });
  const v = g.view('a02');
  assert.equal(v.me.pieces.at(-1).copy, fake, "positive control: the raw view lists the fake last, by its copy id");
  const n = h => Number(h.slice(1));
  const places = new Set();
  for (let seed = SEED; seed < SEED + 100; seed++) {
    const d = dealHandles(v, { seed });
    const mine = d.view.me.pieces;
    assert.deepEqual(mine.map(p => n(p.copy)), mine.map(p => n(p.copy)).slice().sort((x, y) => x - y), `seed ${seed}: its pieces in handle order`);
    assert.deepEqual(mine.map(p => p.trait), mine.map(p => p.trait).slice().sort(), `seed ${seed}: by trait`);
    const fits = ['a03', 'a04'].map(id => n(d.view.board.agents.find(a => a.id === id).fit[0].copy));
    assert.ok(Math.max(...mine.map(p => n(p.copy))) < fits[0] && fits[0] < fits[1], `seed ${seed}: its own pieces first, then each fit by agent`);
    const ofT = mine.filter(p => p.trait === T.id);
    assert.equal(ofT.length, T.copies.length + 1, `seed ${seed}: control: the real copies and the fake`);
    places.add(ofT.findIndex(p => p.copy === d.byCopy[fake]));
    assert.ok(mine.some(p => p.copy === d.byCopy[other]), `seed ${seed}: control: the other piece`);
  }
  assert.deepEqual([...places].sort(), [...Array(T.copies.length + 1).keys()], 'the fake lands in every place among its trait\'s copies');
});

test('every handle round-trips: dress, a hand-over and a hit\'s want named by handle reach the copy that briefing\'s view held (brief R2-3)', async () => {
  const { dealHandles, copyOf, handleOf } = await handles();
  const { g, T, fake, real, worn } = scene();
  const d = dealHandles(g.view('a02'), { seed: SEED });
  for (const [h, k] of Object.entries(d.byHandle)) {
    assert.deepEqual(copyOf(d, h), { ok: true, copy: k }, `${h} maps back`);
    assert.equal(handleOf(d, k), h, `and ${h} is its handle`);
  }
  const [hf, hr] = [fake, real].map(k => handleOf(d, k));
  assert.ok(hf && hr && hf !== hr, 'control: a handle each');
  const back = h => copyOf(d, h).copy;
  assert.equal(g.errand('a02', 'dress', { fit: { [T.slot]: back(hf) } }).ok, true, 'dress');
  assert.equal(g.s.agents.a02.outfit[T.slot], fake, 'it wears the piece the handle named');
  assert.equal(g.errand('a02', 'give', { to: 'a03', copy: back(hr) }).ok, true, 'give');
  assert.deepEqual(g.s.copies[real].holder, { k: 'agent', id: 'a03' }, 'the piece the handle named went over');
  const d4 = dealHandles(g.view('a04'), { seed: SEED });
  const want = copyOf(d4, d4.view.board.agents.find(a => a.id === 'a03').fit[0].copy).copy;
  assert.equal(want, worn, 'control: the handle of the piece a03 wears');
  g.night({ a04: { kind: 'hit', target: 'a03', place: 'docks', want } });
  assert.equal(g.events('play', e => e.agent === 'a04').at(-1).want, worn, "the hit's want is that piece");
});

test('a handle is good for one briefing: one from an older briefing is refused as not yet, and one never dealt, a copy id or junk as never (§33; brief R2-3)', async () => {
  const { dealHandles, copyOf } = await handles();
  const { g, real } = scene();
  const first = dealHandles(g.view('a02'), { seed: SEED });
  assert.equal(first.from, 1, 'control: the first briefing deals from P1');
  const old = Object.keys(first.byHandle)[0];
  const next = dealHandles(g.view('a02'), { seed: SEED, from: first.next });
  assert.ok(next.from > Number(old.slice(1)), 'control: the next briefing deals on from where it stopped');
  assert.deepEqual(Object.values(next.byHandle).sort(), Object.values(first.byHandle).sort(), 'control: the same pieces');
  const stale = copyOf(next, old);
  assert.deepEqual([stale.ok, stale.kind], [false, 'not-yet'], 'from an older briefing: not yet');
  assert.match(stale.why, /older briefing/);
  for (const junk of [`P${next.next}`, 'P0', real, 'CANARY', '', null, 7, { h: 'P1' }]) {
    const r = copyOf(next, junk);
    assert.deepEqual([r.ok, r.kind], [false, 'never'], `${JSON.stringify(junk)}: never`);
    assert.ok(!COPY_ID.test(r.why), 'the refusal names no copy');
  }
  assert.equal(copyOf(next, ` ${Object.keys(next.byHandle)[0].toLowerCase()} `).ok, true, 'a handle in lower case, or padded, still reads');
});

test('dealing is pure: the same view, seed and first number give the same deal, and the view it read is unchanged (§23)', async () => {
  const { dealHandles } = await handles();
  const { g } = scene();
  const v = g.view('a05');
  const before = JSON.stringify(v);
  const a = dealHandles(v, { seed: SEED, from: 5 });
  assert.equal(JSON.stringify(v), before, 'the view is unchanged');
  assert.deepEqual(dealHandles(v, { seed: SEED, from: 5 }), a, 'the same deal');
  assert.equal(a.from, 5);
  assert.equal(a.next, 5 + Object.keys(a.byHandle).length, 'numbered on from the first number');
  assert.deepEqual(a.view.legal, v.legal, 'the legal plays, which name no copy, are as they were');
});

test('the rules never import the agents\' code (§23: the rules decide, the agents read)', () => {
  const rules = fs.readdirSync(path.join(core, 'rules')).filter(f => f.endsWith('.mjs'));
  assert.ok(rules.includes('view.mjs'), 'control: the scan sees the rules');
  assert.ok(fs.existsSync(path.join(core, 'agents', 'handles.mjs')), "control: there's agents' code to keep out");
  const bad = rules.filter(f => /from\s*['"][^'"]*agents\//.test(fs.readFileSync(path.join(core, 'rules', f), 'utf8')));
  assert.deepEqual(bad, []);
});

// A layer4 season played as the runner plays it (bench/runner.mjs), with every seat's view and its owner's AI's dealt
// at every call point: no handled view ever shows a copy id, though fakes are made, worn and sold.
test('a whole layer4 season: at every call point, no seat\'s or owner\'s AI\'s handled view shows a copy id; the season is the runner\'s, event for event (canary, brief R2-3)', async () => {
  const { dealHandles } = await handles();
  const { makeCast, makeBot, CASTS } = await import('../bench/bots.mjs');
  const { runSeason, MIDSEASON_ROTATION } = await import('../bench/runner.mjs');
  // R4-3's review: the season is the first of 404-443 whose runner season makes a fake (a fake reaches a deal once it's
  // made: its maker's own view lists it), so a change that moves the fakes to other seeds needs no re-pin here.
  const [rule, rounds] = ['A', 3];
  let seed = null;
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): no layer4 season in 404-443 makes a fake under rule A now (trunk's first was 415), so the search runs on to 503: the first is 457.
  for (let k = 404; k <= 503 && seed === null; k++) {
    const scan = runSeason({ seed: k, rule, rounds, outDir: path.join(tmp, 'scan'), mix: CASTS.layer4 });
    const made = fs.readFileSync(path.join(scan.dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    if (made.some(e => e.type === 'craft' && e.fakes)) seed = k;
  }
  assert.ok(seed !== null, 'control: a season in 404-503 makes a fake');
  const midseason = MIDSEASON_ROTATION[seed % MIDSEASON_ROTATION.length];
  const cast = makeCast(seed, CASTS.layer4);
  const r = newSeason({ seed, rule, midseason, items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  let s = r.state;
  const log = [...r.events];
  const memos = {};
  const every = cast.some(c => c.works);
  const bots = Object.fromEntries(cast.map(c => [c.id, makeBot(every ? { ...c, every } : c, (memos[c.id] ||= {}))]));
  const ids = Object.keys(s.agents).sort();
  const seen = { deals: 0, raw: 0, fakes: 0 };
  const check = (view, id) => {
    for (const v of [view, viewFor(s, log, id, 'ownerAI')]) {
      if (showsId(v)) seen.raw += 1;
      const d = dealHandles(v, { seed });
      seen.deals += 1;
      if (Object.keys(d.byCopy).some(k => s.copies[k].fake)) seen.fakes += 1;
      assert.ok(!showsId(d.view), `day ${s.day}, ${label(v)}: no copy id`);
    }
  };
  while (!s.over) {
    const day = s.day;
    for (let round = 1; round <= rounds; round++) {
      for (const id of shuffle(rng(seed, 'order', day, round), ids)) {
        const view = viewFor(s, log, id, 'agent');
        check(view, id);
        for (const e of bots[id].day(view, { seed, day, round, rounds, rng: rng(seed, 'bot', id, day, round) })) {
          const res = applyErrand(s, { ...e, by: id });
          s = res.state;
          log.push(...res.events);
        }
      }
    }
    const plays = {};
    for (const id of ids) {
      if (s.agents[id].jail) continue;
      const view = viewFor(s, log, id, 'agent');
      check(view, id);
      const { play, reason } = bots[id].night(view, { seed, day, round: 'night', rng: rng(seed, 'bot', id, day, 'night') });
      plays[id] = { ...play, reason };
    }
    const night = settleNight(s, plays);
    s = night.state;
    log.push(...night.events);
  }
  assert.ok(seen.raw > 0 && seen.fakes > 0, `positive control: raw views held copy ids (${seen.raw}) and deals held fakes (${seen.fakes})`);
  const { dir } = runSeason({ seed, rule, rounds, outDir: tmp, mix: CASTS.layer4 });
  const ran = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean);
  assert.equal(log.length, ran.length, 'control: as many events as the runner\'s season');
  assert.ok(log.every((e, i) => JSON.stringify(e) === ran[i]), 'control: the runner\'s season, event for event');
});
