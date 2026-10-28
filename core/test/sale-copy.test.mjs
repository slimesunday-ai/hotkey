// R6 sale copy (GAME.md §19; docs/redesign/privacy-20261018.md): a list sale shows who bought, what and how much, never
// which copy. The view owns that rule, so no path a player or a bot reads can name a sale's copy: the raw view for every
// audience, a seat's and an owner's AI's read, and every lookup section, scheduled and inspect, with and without
// currentView, page by page. The scene makes the leak matter: each buyer wears what it bought, so a sale that named its
// copy would match a worn piece's handle and say that piece is real and what it cost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { read, act, reply } from '../agents/tools.mjs';
import { leadValues } from '../bench/bots.mjs';
import { addGoods } from '../rules/state.mjs';

const SEED = 404;
const SECTIONS = ['deals', 'transactions', 'speech', 'conversations', 'history', 'citizens', 'state'];
const AUDIENCES = ['agent', 'owner', 'ownerAI', 'public', 'record'];

// Every place in x where a list sale names its copy: a board sale row with a copy, a buy event with a copy, or a lookup
// fragment of a buy event whose path goes through its copy.
function saleCopies(x, at = '$', out = []) {
  if (Array.isArray(x)) {
    x.forEach((y, i) => saleCopies(y, `${at}[${i}]`, out));
    return out;
  }
  if (!x || typeof x !== 'object') return out;
  if (/\.sales\[\d+\]$/.test(at) && Object.hasOwn(x, 'copy')) out.push(`${at}.copy`);
  if (x.type === 'buy' && Object.hasOwn(x, 'copy')) out.push(`${at}.copy`);
  if (x.type === 'buy' && Array.isArray(x.fragment) && x.fragment.includes('copy')) out.push(`${at}.fragment`);
  for (const k of Object.keys(x)) saleCopies(x[k], `${at}.${k}`, out);
  return out;
}

// Three agents buy a common each on night 1 and wear it; a fourth (a04) buys nothing and watches. A second night puts
// the sales into everyone's 24-hour record too.
function scene() {
  const g = new Game({ n: 4, seed: SEED });
  for (const id of ['a01', 'a02', 'a03', 'a04']) g.grant(id, 10000);
  const open = g.view('a04').board.list.filter(t => t.opens <= g.s.day && t.left > 0 && t.tier === 'common');
  const bought = {};
  for (const [i, id] of ['a01', 'a02', 'a03'].entries()) {
    const t = open[i];
    assert.equal(g.errand(id, 'offer', { trait: t.trait, amount: t.price }).ok, true, `control: ${id}'s offer`);
  }
  g.night();
  for (const id of ['a01', 'a02', 'a03']) {
    const [buy] = g.events('buy', e => e.agent === id);
    assert.ok(buy && /^k\d+$/.test(buy.copy), `control: the ledger records ${id}'s sale by its copy`);
    bought[id] = buy.copy;
    assert.equal(g.errand(id, 'dress', { fit: { [g.s.copies[buy.copy].slot]: buy.copy } }).ok, true, `control: ${id} wears it`);
  }
  return { g, bought };
}

const views = g => [
  ...['a01', 'a04'].flatMap(id => ['agent', 'owner', 'ownerAI'].map(aud => [`${aud} (${id})`, g.view(id, aud)])),
  ...['public', 'record'].map(aud => [aud, g.view(null, aud)]),
];

// Every lookup page a seat can reach, each mode, with and without currentView, unfiltered and filtered to a buyer.
function lookups(g, id) {
  const out = [];
  const rd = read(g.view(id, 'agent'), { audience: 'seat', seed: SEED });
  for (const current of [false, true]) {
    for (const mode of [undefined, 'scheduled', 'inspect']) {
      for (const section of SECTIONS) {
        for (const filter of [{}, { with: 'a02' }]) {
          const ctx = { deal: rd.deal, tries: {}, ...(current ? { currentView: () => g.view(id, 'agent') } : {}) };
          let offset = 0;
          for (let page = 0; offset !== null; page++) {
            assert.ok(page < 500, 'control: the pages end');
            const res = act({ act: 'lookup', section, ...(mode ? { mode } : {}), ...filter, offset }, ctx);
            assert.equal(res.ok, true, `control: ${section} ${mode || 'default'} reads (${res.why || ''})`);
            out.push([`lookup ${section} ${mode || 'default'}${current ? ' currentView' : ''}${filter.with ? ' with a02' : ''} @${offset}`, res]);
            offset = res.lookup.nextOffset;
          }
        }
      }
      // The reply path a seat's inspection takes: one lookup alone in the reply.
      const ctx = { deal: rd.deal, tries: {}, ...(current ? { currentView: () => g.view(id, 'agent') } : {}) };
      const r = reply({ actions: [{ act: 'lookup', section: 'history', ...(mode ? { mode } : {}) }] }, ctx);
      out.push([`reply lookup history ${mode || 'default'}${current ? ' currentView' : ''}`, r.results]);
    }
  }
  return out;
}

test('the detector catches a sale that names its copy (control)', () => {
  assert.deepEqual(saleCopies({ board: { sales: [{ agent: 'a01', copy: 'P1' }] } }), ['$.board.sales[0].copy']);
  assert.deepEqual(saleCopies({ events: [{ type: 'buy', copy: 'k3' }] }), ['$.events[0].copy']);
  assert.deepEqual(saleCopies({ rows: [{ type: 'buy', fragment: ['copy'], value: 'P2' }] }), ['$.rows[0].fragment']);
  assert.deepEqual(saleCopies({ events: [{ type: 'buy', agent: 'a01', trait: 't', price: 1 }], board: { sales: [{ agent: 'a01' }] } }), []);
});

test('no path names a list sale\'s copy: every audience\'s raw view, a seat\'s and an owner\'s AI\'s read, and every lookup section and mode, with and without currentView, the day after the sale and a day later (§19)', () => {
  const { g, bought } = scene();
  for (const when of ['the day after', 'a day later']) {
    if (when === 'a day later') g.night();
    // Controls: the sales are on every board and in the events, and the buyers' fits show the very pieces sold.
    const raw = g.view('a04');
    assert.equal(raw.board.sales.length, 3, `${when}: control: three sales on the board`);
    assert.ok(raw.events.some(e => e.type === 'buy') || when === 'a day later', `${when}: control: buy events in view`);
    for (const id of ['a02', 'a03']) {
      assert.ok(raw.board.agents.find(a => a.id === id).fit.some(p => p.copy === bought[id]), `${when}: control: ${id} wears what it bought`);
    }
    const leaks = [];
    const check = (label, x) => leaks.push(...saleCopies(x).map(p => `${when}: ${label}: ${p}`));
    for (const [label, v] of views(g)) {
      check(`raw ${label}`, v);
      if (v.me) check(`raw ${label} archive`, { history: v.me.history, speech: v.me.speech, transactions: v.me.transactions });
    }
    for (const id of ['a01', 'a04']) {
      check(`seat read (${id})`, read(g.view(id, 'agent'), { audience: 'seat', seed: SEED }).result);
      check(`owner AI read (${id})`, read(g.view(id, 'ownerAI'), { audience: 'ownerAI', seed: SEED }).result);
      for (const [label, res] of lookups(g, id)) check(`${label} (${id})`, res);
    }
    // Grouped by path, without page offsets and row numbers, so a failure says which paths leak.
    const paths = {};
    for (const p of leaks) {
      const k = p.replace(/ @\d+/, '').replace(/\[\d+\]/g, '[]').replace(/(: (?:lookup|reply) .*\(a\d+\)): .*\.(copy|fragment)$/, '$1: $2');
      paths[k] = (paths[k] || 0) + 1;
    }
    assert.deepEqual(paths, {}, `${when}: ${leaks.length} places name a sale's copy`);
  }
});

// a02 buys a common on night 1 and keeps it unworn, the richest agent; a01 already knows everyone's cash, so a HALLU dose
// it takes on `day` brings the true lead on a02's stash: that piece, by its copy (§11; rules/errand.mjs leadsFor).
function staked(day) {
  const g = new Game({ n: 3, seed: SEED });
  g.grant('a02', 10000);
  const t = g.view('a02').board.list.find(x => x.opens <= g.s.day && x.left > 0 && x.tier === 'common');
  assert.equal(g.errand('a02', 'offer', { trait: t.trait, amount: t.price }).ok, true, 'control: the offer');
  g.advanceTo(day);
  const [buy] = g.events('buy', e => e.agent === 'a02');
  addGoods(g.s.agents.a01, 'hallu', 1);
  const book = (g.s.goods.in.test ||= {});
  book.hallu = (book.hallu || 0) + 1;
  g.s.agents.a01.known = ['cash:a02', 'cash:a03'];
  assert.equal(g.errand('a01', 'take', { drug: 'hallu' }).ok, true, 'control: the take');
  const [take] = g.events('take', e => e.agent === 'a01');
  assert.deepEqual(take.leads.filter(l => l.kind === 'stash'), [{ kind: 'stash', agent: 'a02', value: buy.copy }], 'control: the true lead names the piece a02 bought');
  return { g, piece: buy.copy, trait: t };
}

test('a bot values a HALLU stash lead only from a piece its view shows with its trait, never from a list sale (§11, §19; bench/bots.mjs leadValues)', () => {
  // The day after the sale: a02's holdings record isn't public yet, and the sale names no copy, so nothing a player sees
  // says what the piece is. Before the view owned §19's rule, the sale's copy told the bot (and only the bot).
  const early = staked(2);
  const v = early.g.view('a01');
  assert.ok(v.board.sales.some(x => x.agent === 'a02' && x.trait === early.trait.trait), 'control: the sale is on the board');
  assert.deepEqual(leadValues(v), {}, 'nothing a player sees names the piece, so the lead brings nothing');
  // A day on: a02's holdings record from the dawn after the sale is public, and lists the piece with its trait.
  const later = staked(3);
  const w = later.g.view('a01');
  assert.ok(w.events.some(e => e.type === 'holdings' && e.agent === 'a02' && e.pieces.some(p => p.copy === later.piece && p.trait === later.trait.trait)), 'control: the public holdings record shows it');
  const worth = w.board.list.find(x => x.trait === later.trait.trait);
  assert.deepEqual(leadValues(w), { a02: worth.last || worth.price }, 'the piece is worth what its trait last sold for');
});
