// The tools (GAME.md §17, §18, §24, §33, §34; brief R2-agents.md, task R2-5): one table of typed actions, the one place
// they're defined. A seat reads the agent's view and answers each call with one JSON reply; an owner's AI reads the
// owner's-AI view and calls read, play and memory one at a time, with no free-text slot (§17, §18). The caller fixes
// the audience when it reads, never the model. Pieces are named by handle (handles.mjs), never by copy id.
// The rules decide everything: a reply only becomes the errands and the play the rules already take, through `apply`,
// the caller's way into the rules, and every failure comes back typed, never as a crash (§33). Few tools (§33): read;
// play; money (money and goods); market (the list and the fence); crew; talk; tricks; outloud; memory. The game-held
// memory waits for R2-2: its rows are here, refused as not built yet.
// What a player reads (a result) is always presented through the deal; the caller alone gets the play the rules take.
import { N } from '../numbers.mjs';
import { formatReply } from './reply-format.mjs';
import { DISTRICTS, DRUGS, GOODS, CRATE, VAULT } from '../rules/state.mjs';
import { PLAY_KINDS, acceptWhy } from '../rules/plays.mjs';
import { MEMORY_ROUTES, ORDER_KINDS, memoryScope, checkMemory, orderLimit } from '../rules/memory.mjs';
import { marketItems } from '../rules/market.mjs';
// The rules' own lists (one owner per fact): a message's kinds, a payment's reasons, the terms' whats, out loud's kinds.
import { SAY_KINDS, PAY_FOR, TERM_WHAT, TERM_SAID, whatOf, LOUD_KINDS } from '../rules/errand.mjs';
import { dealHandles, copyOf, present } from './handles.mjs';
import { dealOf, offeredBack } from '../rules/deals.mjs';

const CORNERS = Object.keys(N.corners).sort();
// Words an agent wrote (§18), never part of what makes two actions the same.
const FREE_TEXT = ['line', 'reason', 'name'];

const fail = (why, code = 'field', kind = 'never') => ({ ok: false, why, kind, code });
const ok = value => ({ ok: true, value });
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const whole = (v, min) => Number.isInteger(v) && v >= min;
const has = (v, f) => Object.hasOwn(v, f) && v[f] !== undefined && v[f] !== null;
const base = spec => spec.replace('?', '');
const oneOf = values => ({ show: values.join('|'), values, read: v => (values.includes(v) ? ok(v) : fail(`one of ${values.join(', ')}`)) });
const inSet = (key, show, why) => ({ show, read: (v, c) => (typeof v === 'string' && c[key].has(v) ? ok(v) : fail(why)) });
// A piece by its handle in this briefing; one from an older briefing could work once the agent reads again (not yet).
function handle(v, c) {
  const r = copyOf(c.deal, v);
  return r.ok ? ok(r.copy) : fail(r.why, 'handle', r.kind);
}
// R9d: a slot a fit empties: null, or "none" or "null" written as text (the check season's models wrote "none", and
// the tool's own description says none empties it).
const emptySlot = h => h === null || (typeof h === 'string' && /^(none|null)$/i.test(h.trim()));
// Each field the spec names that the object gives, read by its type; nothing else gets through.
function fieldsOf(v, spec, c) {
  const out = {};
  for (const [f, t] of Object.entries(spec)) {
    if (!has(v, f)) {
      if (!t.endsWith('?')) return fail(`${f}: missing`);
      continue;
    }
    if (TYPES[base(t)].free && c.deal.audience !== 'seat') continue;
    const r = TYPES[base(t)].read(v[f], c);
    if (!r.ok) return { ...r, why: `${f}: ${r.why}` };
    out[f] = r.value;
  }
  return ok(out);
}
const shape = spec => `{${Object.entries(spec).map(([f, t]) => `"${f}"${t.endsWith('?') ? '?' : ''}: ${base(t)}`).join(', ')}}`;
// `spec` and `of` say a type's shape to the native tool definitions (tool-calls.mjs), which are generated from here.
const objectOf = spec => ({ show: shape(spec), spec, uses: Object.values(spec).map(base), read: (v, c) => (isObj(v) ? fieldsOf(v, spec, c) : fail(`an object: ${shape(spec)}`)) });
const listOf = (type, show) => ({
  show,
  of: type,
  uses: [type],
  read(v, c) {
    if (!Array.isArray(v)) return fail(`a list: ${show}`);
    const out = [];
    for (const x of v) {
      const r = TYPES[type].read(x, c);
      if (!r.ok) return r;
      out.push(r.value);
    }
    return ok(out);
  },
});

// Every field's type: what the reply format says it is, and how a reply's value reaches the rules.
export const TYPES = {
  agent: inSet('agents', 'board agent id', 'no such agent on the board'),
  handle: { show: 'current piece handle (P3)', read: handle },
  piece: { show: 'handle or trait id', read: (v, c) => (typeof v === 'string' && c.traits.has(v) ? ok(v) : handle(v, c)) },
  trait: inSet('traits', 'list trait id', 'no such trait on the list'),
  sitdown: inSet('sitdowns', 'sit-down id', 'no such sit-down in this briefing'),
  deal: inSet('deals', "fence deal id", 'no such deal in this briefing'),
  crew: inSet('crews', "crew id", 'no such crew in this briefing'),
  dollars: { show: 'integer dollars >=1', json: 'integer', read: v => (whole(v, 1) ? ok(v) : fail('integer dollars >=1')) },
  count: { show: 'integer >=1', json: 'integer', read: v => (whole(v, 1) ? ok(v) : fail('integer >=1')) },
  number: { show: 'integer >=0', json: 'integer', read: v => (whole(v, 0) ? ok(v) : fail('integer >=0')) },
  lookupSection: oneOf(['deals', 'transactions', 'speech', 'conversations', 'history', 'citizens', 'state']),
  lookupMode: oneOf(['scheduled', 'inspect']),
  yes: { show: 'true or false', json: 'boolean', read: v => (typeof v === 'boolean' ? ok(v) : fail('true or false')) },
  text: { show: 'one line of words', free: true, read: v => (typeof v === 'string' ? ok(v) : fail('one line of words')) },
  // R5-deals: "doses" reads as temp, the dose the rules mean when none is named (§11: a cook that names no drug, and a
  // sale of doses to the city's buyer, are TEMP), counted with any temp beside it.
  goods: {
    show: `{"kind": count}, kinds ${GOODS.join(', ')} ("doses" reads as temp)`,
    read: v => {
      const bad = fail(`goods are {"kind": count}, kinds ${GOODS.join(', ')} ("doses" reads as temp)`);
      if (!isObj(v) || !Object.keys(v).length) return bad;
      const out = {};
      for (const [k, n] of Object.entries(v)) {
        const kind = k === 'doses' ? 'temp' : k;
        if (!GOODS.includes(kind) || !whole(n, 1)) return bad;
        out[kind] = (out[kind] || 0) + n;
      }
      return ok(out);
    },
  },
  drug: oneOf(DRUGS),
  payFor: oneOf(PAY_FOR),
  sayKind: oneOf(SAY_KINDS),
  // R5-terms: the rules' whats, shown in the words players say (a buy is `buy`); either word reads as the rules read it.
  termWhat: (() => {
    const shown = TERM_WHAT.map(w => TERM_SAID[w] || w).join('|');
    return { show: shown, values: TERM_WHAT, read: v => (whatOf(v) ? ok(v) : fail(`one of ${shown.split('|').join(', ')}`)) };
  })(),
  loudKind: oneOf(LOUD_KINDS),
  shopItem: oneOf(marketItems('shop')),
  buyerItem: oneOf(marketItems('buyer')),
  place: oneOf(DISTRICTS),
  corner: oneOf(CORNERS),
  kind: oneOf(PLAY_KINDS),
  tipTarget: {
    show: `an agent id, "${CRATE}" or "${VAULT}"`,
    read: (v, c) => (c.agents.has(v) || [CRATE, VAULT].includes(v) ? ok(v) : fail(`an agent, "${CRATE}" or "${VAULT}"`)),
  },
  fight: {
    show: `fight target: agent, "${CRATE}", "${VAULT}" or corner`,
    read: (v, c) => (c.agents.has(v) || [CRATE, VAULT, ...CORNERS].includes(v) ? ok(v) : fail('an agent, the crate, the vault or a corner')),
  },
  fit: {
    show: '{"slot": a handle, or null}, a slot for each piece',
    uses: ['handle'],
    read(v, c) {
      if (!isObj(v)) return fail('{"slot": a handle, or null}');
      const out = [];
      for (const [slot, h] of Object.entries(v)) {
        if (!c.slots.has(slot)) return fail('no such slot');
        const r = emptySlot(h) ? ok(null) : handle(h, c);
        if (!r.ok) return r;
        out.push([slot, r.value]);
      }
      return ok(Object.fromEntries(out));
    },
  },
  handles: listOf('handle', 'a list of handles'),
  agents: listOf('agent', 'agent ids'),
  half: objectOf({ pieces: 'handles?', goods: 'goods?', cash: 'number?' }),
  terms: objectOf({ what: 'termWhat?', who: 'agent?', piece: 'piece?', cash: 'number?', night: 'count?', where: 'place?', goods: 'goods?' }),
  lie: {
    show: '{"kind": "cash" | "stash" | "tip", "agent": agent, "value": a number for cash, a handle or null for stash, an agent for tip}',
    uses: ['agent', 'number', 'handle'],
    // A lie's kinds and the type of each one's value (the native tools give each value a field of its own).
    kinds: { cash: 'number', stash: 'handle', tip: 'agent' },
    read(v, c) {
      const LIES = { cash: TYPES.number, stash: { read: x => (x === null ? ok(null) : handle(x, c)) }, tip: TYPES.agent };
      if (!isObj(v) || !Object.hasOwn(LIES, v.kind)) return fail('a lie: {"kind": "cash" | "stash" | "tip", "agent", "value"}');
      const [a, x] = [TYPES.agent.read(v.agent, c), LIES[v.kind].read(v.value, c)];
      return !a.ok ? a : !x.ok ? x : ok({ kind: v.kind, agent: a.value, value: x.value });
    },
  },
  lies: listOf('lie', 'a list of lies, two or more'),
  // A play inside another action has the play row's fields (`spec`, a getter: they're defined below).
  myplay: { show: "own play without reason", uses: ['play'], get spec() { return PLAY_FIELDS; }, read: (v, c) => ownPlay(v, c) },
  play: { show: 'explicit {"kind":kind,...fields}', uses: ['kind'], get spec() { return PLAY_FIELDS; }, read: (v, c) => writtenPlay(v, c) },
  memoryPlan: { show: `[{trait:trait,routes:[2–3 unique ${MEMORY_ROUTES.join('|')}]}], max3 unique traits`, uses: ['trait'], read: (v,c) => memoryValue('plan','traits',v,c) },
  // R10b: the trade kinds (buy, sell, pay), which the game carries out every day round (agents/orders.mjs).
  memoryOrders: { show: `[{kind:${ORDER_KINDS.join('|')}}], max${orderLimit()}, one a kind (buy/sell: a kind an item); laylow adds stars:3; back adds agent:agent; buy adds item, units (a day), max ($ a unit); sell adds item, min ($ a unit)`, uses: ['agent'], read: (v,c) => memoryValue('orders','orders',v,c) },
  list: { show: 'a list', read: v => (Array.isArray(v) ? ok(v) : fail('a list')) },
};

function memoryValue(kind, field, value, c) {
  const checked = checkMemory(memoryScope(c.deal.view), { kind, by: c.deal.view.me.id, [field]: value });
  return checked.ok ? ok(structuredClone(value)) : fail(checked.why, 'field', checked.kind);
}

// A play's fields (§7, §8, §9, §11, §33): which line of tonight's menu, or its kind, then what its line leaves open, and
// the optional fields the legal plays leave out: a hit's want, a cook's drug and HALLU's lies, a build's warrants and
// fake, and (R4-2, GAP gap.accept) any play's accept but a back's: the agents whose backs it accepts, in its order.
const PLAY_FIELDS = {
  menu: 'count?', kind: 'kind?', target: 'agent?', place: 'place?', corner: 'corner?', batches: 'count?', guns: 'number?',
  lockpicks: 'number?', want: 'piece?', drug: 'drug?', lies: 'lies?', warrants: 'number?', fake: 'trait?', accept: 'agents?',
};
export const KIND_FIELDS = Object.fromEntries(PLAY_KINDS.map(kind => [kind, new Set([
  ...({ hit: ['target', 'place', 'want'], breakin: ['target', 'place', 'want'], back: ['target'], collar: ['target', 'place'],
    cook: ['place', 'batches', 'drug', 'lies'], build: ['place', 'guns', 'lockpicks', 'warrants', 'fake'],
    deal: ['corner', 'place'] }[kind] || ['place']), ...(kind === 'back' ? [] : ['accept']),
])]));
const LINE_FIELDS = new Set(['target', 'place', 'corner', 'batches', 'guns', 'lockpicks']);
const OPTIONAL = Object.fromEntries(PLAY_KINDS.map(kind => [kind, [...KIND_FIELDS[kind]].filter(f => !LINE_FIELDS.has(f))]));
function fieldWhy(v, kind) {
  const extra = Object.keys(v).filter(f => has(v, f) && !['act', 'kind', 'menu', 'reason'].includes(f) && !KIND_FIELDS[kind]?.has(f));
  if (extra.length) return `${kind}: inapplicable fields ${extra.map(f => Object.hasOwn(PLAY_FIELDS, f) ? f : 'unknown').join(', ')}${extra.includes('drug') ? '; a dose requires the daytime take action' : ''}`;
  if (has(v, 'lies') && v.drug !== 'hallu') return 'lies: only a HALLU cook uses lies';
  return null;
}
const typedPlay = (v, c) => fieldsOf(v, Object.fromEntries(Object.entries(PLAY_FIELDS).filter(([f]) => f !== 'menu' && f !== 'kind')), c);

// §33: tonight's menu, every legal play numbered with its place; hits, break-ins, backs and collars fold into one line
// each, with their targets and places (GAP gap.reply).
const FOLD = ['hit', 'breakin', 'back', 'collar'];
export function menuOf(view) {
  const lines = [];
  for (const p of view.legal || []) {
    const folded = FOLD.includes(p.kind) && lines.find(x => x.kind === p.kind);
    if (folded) folded.targets.push(p.target);
    else if (FOLD.includes(p.kind)) {
      const { target, ...rest } = p;
      lines.push({ ...rest, targets: [target] });
    } else lines.push({ ...p });
  }
  return lines.map((x, i) => ({ n: i + 1, ...x }));
}

// A menu line and what the reply gives, as one play, or null if they don't fit, or what the reply must still name. A
// line's fixed place or number stands in for one the reply leaves out (GAP gap.reply).
function fitLine(line, t) {
  const p = { kind: line.kind };
  for (const f of ['target', 'place', 'corner']) {
    const [one, many] = [line[f], line[`${f}s`]];
    if (one === undefined && !many) continue;
    const x = t[f] !== undefined ? t[f] : one;
    if (x === undefined) return { missing: f };
    if (one !== undefined ? x !== one : !many.includes(x)) return null;
    p[f] = x;
  }
  for (const f of ['batches', 'guns', 'lockpicks']) if (line[f] !== undefined) p[f] = t[f] !== undefined ? t[f] : line[f];
  for (const f of OPTIONAL[line.kind] || []) if (t[f] !== undefined) p[f] = t[f];
  return p;
}
// The agent's own play: a number on tonight's menu, or a play written out that fits one of its lines (§33).
function ownPlay(v, c) {
  if (!isObj(v)) return fail('a play: {"menu": a number} or {"kind": ...}');
  const t = typedPlay(v, c);
  if (!t.ok) return t;
  let lines;
  if (has(v, 'menu')) {
    if (!whole(v.menu, 1)) return fail('menu: integer >=1');
    if (!c.menu[v.menu - 1]) return fail("that number isn't on tonight's menu", 'off-menu');
    lines = [c.menu[v.menu - 1]];
    if (has(v, 'kind') && v.kind !== lines[0].kind) return fail('kind conflicts with the original numbered menu');
  } else {
    if (!PLAY_KINDS.includes(v.kind)) return fail(`kind: one of ${PLAY_KINDS.join(', ')}, or a number from the menu`);
    lines = (c.currentLegal ? menuOf({ legal: c.currentLegal }) : c.menu).filter(x => x.kind === v.kind);
    if (!lines.length) return fail(`no ${v.kind} on tonight's menu`, 'off-menu');
  }
  const badFields = fieldWhy(v, lines[0].kind);
  if (badFields) return fail(badFields);
  const fits = lines.map(line => fitLine(line, t.value));
  const p = fits.find(x => x && !x.missing);
  // §8 (GAP gap.accept): a list the rules would refuse at the lock is refused now, typed, by the rules' own check.
  const why = p && p.accept !== undefined ? acceptWhy(p.accept, c.deal.view.me.id, x => c.agents.has(x)) : null;
  if (why) return fail(`accept: ${why}`);
  if (p && c.validatePlay) {
    const checked = c.validatePlay(p);
    return checked.ok ? ok(checked.play) : fail(checked.why, 'rules', checked.kind);
  }
  if (p) return ok(p);
  const short = fits.find(x => x && x.missing);
  return short ? fail(`${lines[0].kind}: name its ${short.missing}`) : fail("that play isn't on tonight's menu", 'off-menu');
}
// Another agent's play, written out (SUDO's write): typed here, checked by the rules as that agent's play.
function writtenPlay(v, c) {
  if (!isObj(v) || !PLAY_KINDS.includes(v.kind)) return fail(`a play written out, its kind one of ${PLAY_KINDS.join(', ')}`);
  const why = fieldWhy(v, v.kind);
  if (why) return fail(why);
  const t = typedPlay(v, c);
  return t.ok ? ok({ kind: v.kind, ...t.value }) : t;
}

const SEAT = ['seat'];
const BOTH = ['seat', 'ownerAI'];
// An errand's row: its name is the rules' errand kind; `as` renames a reply's field to the rules' (a piece is a copy).
const errand = (act, tool, about, fields, as = {}) => ({ act, tool, who: SEAT, about, fields, errand: act, as, built: true });
// A row whose rules aren't built yet: `built` names the task that builds them.
const waits = (act, tool, task, about, fields, who = SEAT) => ({ act, tool, who, about, fields, built: task });
const COPY = { piece: 'copy' };

// The table (§33: few tools), in the reply format's order. Every one of the rules' errand kinds has its row, and the
// play row takes every play kind.
export const ACTIONS = [
  { act: 'read', tool: 'read', who: BOTH, built: true, about: "briefing", fields: {} },
  { act: 'lookup', tool: 'read', who: SEAT, built: true, about: 'read-only page, newest first; default scheduled returns next call; inspect must be the only action and requests evidence before acting within the existing retry/call budget',
    fields: { section: 'lookupSection', mode: 'lookupMode?', with: 'agent?', sitdown: 'sitdown?', offset: 'number?' } },
  {
    act: 'play', tool: 'play', who: BOTH, built: true, kinds: PLAY_KINDS, fields: { ...PLAY_FIELDS, reason: 'text?' },
    about: "menu + open fields, or kind + applicable fields",
  },
  errand('dress', 'money', 'dress slots; rest stashed', { fit: 'fit' }),
  errand('give', 'money', 'voluntary transfer', { to: 'agent', piece: 'handle?', goods: 'goods?', cash: 'dollars?', sitdown: 'sitdown?' }, COPY),
  errand('pay', 'money', 'transfer cash', { to: 'agent', amount: 'dollars', for: 'payFor?', sitdown: 'sitdown?' }),
  errand('bail', 'money', "bail: release next dawn", { agent: 'agent' }),
  errand('rent', 'money', 'compute: regain home only', {}),
  errand('shop', 'money', "shop order; total max cap", { item: 'shopItem', units: 'count?', max: 'dollars' }),
  errand('sell', 'money', "sale order; doses need drug", { item: 'buyerItem', units: 'count?', drug: 'drug?' }),
  errand('offer', 'market', 'list bid; cash reserved', { trait: 'trait', amount: 'dollars' }),
  errand('fence_list', 'market', 'fence listing', { piece: 'handle', price: 'dollars' }, COPY),
  errand('fence_unlist', 'market', 'remove your listing', { deal: 'deal' }),
  errand('fence_buy', 'market', 'buy a fence listing', { deal: 'deal' }),
  errand('fence_swap', 'market', 'fence swap: give for get', { to: 'agent', give: 'half', get: 'half' }),
  errand('fence_accept', 'market', 'accept swap; reserve your half', { deal: 'deal' }),
  errand('crew_form', 'crew', 'start a crew', { name: 'text?' }),
  errand('crew_invite', 'crew', 'invite an agent into your crew', { agent: 'agent' }),
  errand('crew_join', 'crew', 'join a crew that invited you', { crew: 'crew' }),
  errand('crew_leave', 'crew', 'leave your crew', {}),
  errand('stash_put', 'crew', "put into crew stash", { piece: 'handle?', goods: 'goods?', cash: 'dollars?' }, COPY),
  errand('stash_take', 'crew', "take from crew stash", { piece: 'handle?', goods: 'goods?', cash: 'dollars?' }, COPY),
  errand('ask', 'talk', 'invite to sit-down', { to: 'agent', line: 'text?' }),
  errand('answer', 'talk', 'accept/decline invitation once; sends words', { sitdown: 'sitdown', accept: 'yes', line: 'text?' }),
  errand('say', 'talk', 'message open sit-down', { sitdown: 'sitdown', say: 'sayKind', terms: 'terms?', line: 'text?' }),
  // R9: one step to take the other side's open offer: the rules' say, an offer of those terms from the seat's side (errand.mjs, deals.mjs
  // openOffer), so it counts, shows and is refused as any say is. `via` names the errand and the fields it fixes.
  { act: 'agree', tool: 'talk', who: SEAT, built: true, about: 'agrees their open offer: its terms, your side', fields: { sitdown: 'sitdown', line: 'text?' },
    via: { errand: 'say', fixed: { say: 'offer', agree: true } } },
  errand('close', 'talk', 'end a sit-down', { sitdown: 'sitdown' }),
  errand('chat', 'talk', 'message whole crew', { say: 'sayKind', terms: 'terms?', line: 'text?' }),
  errand('outloud', 'outloud', 'public speech', { say: 'loudKind', terms: 'terms?', line: 'text' }),
  errand('listen', 'tricks', 'earpiece: overhear another pair', { sitdown: 'sitdown' }),
  errand('tip', 'tricks', "tip cops: agent and its target tonight", { agent: 'agent', target: 'tipTarget' }),
  errand('bribe', 'tricks', 'bribe cops off target', { target: 'fight' }),
  errand('bounty', 'tricks', 'bounty on piece or agent', { piece: 'handle?', agent: 'agent?', amount: 'dollars' }, COPY),
  errand('lookout', 'tricks', "lookout: stash and cash now", { agent: 'agent' }),
  errand('take', 'tricks', 'Dose effects require daytime take. TRUTH locks play', { drug: 'drug', play: 'myplay?' }),
  errand('write', 'tricks', "write play for your SUDO taker", { agent: 'agent', play: 'play' }),
  { ...errand('plan', 'memory', 'replace; [] clears', { traits: 'memoryPlan' }), who: BOTH },
  { ...errand('orders', 'memory', 'replace; [] clears; buy, sell, pay run your trade every round', { orders: 'memoryOrders' }), who: BOTH },
  errand('note', 'memory', 'append dated note; one/call', { line: 'text' }),
];
// Every errand kind and play kind maps through the table; none is left out.
export const LEFT_OUT = { creed: 'Creed is set only through a trusted human controller context, never a model or ownerAI tool' };
const BY_ACT = new Map(ACTIONS.map(a => [a.act, a]));
// The rules' errand an action sends: its own, or (R9's agree) the one it goes `via`.
const errandOf = row => row.errand || row.via?.errand || null;
// The tools (§33: few), each a heading in the reply format; the errands come in groups (brief R2-5).
export const TOOLS = {
  read: 'read', play: "tonight's play", money: 'money and goods', market: 'the list and the fence', crew: 'the crew', talk: 'talk',
  outloud: 'out loud', tricks: 'the tricks', memory: 'memory',
};
// The views each audience reads (view.mjs): a seat its agent's (the owner's is the same), an owner's AI its own.
const VIEWS = { seat: ['agent', 'owner'], ownerAI: ['ownerAI'] };

// What a briefing lets a reply name, from its view alone.
function scopeOf(deal) {
  const v = deal.view;
  const me = v.me || {};
  return {
    deal, menu: deal.menu,
    agents: new Set(v.board.agents.map(a => a.id)),
    traits: new Set(v.board.list.map(t => t.trait)),
    slots: new Set(v.board.list.map(t => t.slot)),
    sitdowns: new Set([...(me.sitdowns || []).map(x => x.id), ...v.events.filter(e => e.type === 'meet').map(e => e.sitdown), ...(me.deals || []).map(d => d.sitdown), ...[...(me.transactions || []), ...(me.speech || [])].map(e => e.sitdown).filter(Boolean)]),
    deals: new Set([...(me.fence || []).map(d => d.deal), ...v.board.fence.map(d => d.deal)]),
    crews: new Set([...v.board.crews.map(x => x.id), ...(me.invitedTo || [])]),
  };
}

// A briefing: the view for the audience the caller fixes, with its pieces under handles (numbered on from `from`, where
// the last briefing stopped) and tonight's menu. The deal stays with the caller; `result` is what the player reads.
export function read(view, { audience, seed, from = 1 } = {}) {
  if (!Object.hasOwn(VIEWS, audience) || !VIEWS[audience].includes(view.audience)) {
    throw new Error(`the ${audience} audience can't read the ${view.audience} view (the caller fixes the audience)`);
  }
  const d = dealHandles(view, { seed, from });
  const deal = { ...d, audience, menu: menuOf(d.view) };
  return { deal, result: { act: 'read', ok: true, view: deal.view, menu: deal.menu } };
}

// Two actions are the same when their typed fields are, pieces by copy (so across briefings), words aside.
function sameAs(name, x) {
  try {
    const typed = isObj(x) ? Object.fromEntries(Object.entries(x).filter(([k]) => !FREE_TEXT.includes(k) && k !== 'act')) : x;
    return JSON.stringify([name, typed], (k, y) => (isObj(y) ? Object.fromEntries(Object.keys(y).sort().map(key => [key, y[key]])) : y));
  } catch {
    return JSON.stringify([name]);
  }
}
// §33, "cap repeats": the day's failed tries, by action (GAP gap.tries). The caller keeps the record.
function triesOn(tries, day) {
  const t = tries || {};
  if (t.day !== day) Object.assign(t, { day, failed: {} });
  return t;
}

// Only player-visible mechanical state travels with a receipt; never a second view or hidden core state.
const receiptState = a => ({ cash: a.cash, orders: a.orders, rent: a.rent });

// A bounded page from the already filtered, handled player view. No core mutation or model request; a numeric offset
// names only a place in this view, never a trusted cursor carrying state. Full rows stay available on later pages.
export const LOOKUP_CHARS = 1800;
const evidenceSize = value => JSON.stringify(value).replace(/[^\x20-\x7e]|[<>]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).length;
function lookup(fields, view) {
  const history = () => {
    const speech = view.me.speech || [];
    const speechEvents = new Set(speech.map(e => e.n));
    return [...new Map([...(view.me.history || view.events).filter(e => !speechEvents.has(e.n)), ...(view.me.transactions || []), ...speech]
      .map(e => [e.speechId || `event:${e.n}`, e])).values()].sort((a, b) => a.n - b.n);
  };
  const conversations = () => {
    const rows = new Map((view.me.sitdowns || []).map(({ said, id, ...sd }) => [id, { ...sd, sitdown: id, messages: 0 }]));
    for (const e of view.me.speech || []) if (e.sitdown) {
      const row = rows.get(e.sitdown) || { sitdown: e.sitdown, ...(e.from && e.to ? { participants: [e.from, e.to] } : {}), messages: 0 };
      row.messages += 1;
      row.lastDay = e.day;
      row.lastEvent = e.n;
      rows.set(e.sitdown, row);
    }
    return [...rows.values()].sort((a, b) => (a.lastEvent ?? -1) - (b.lastEvent ?? -1));
  };
  const { history: archive, speech: words, ...state } = view.me;
  const source = fields.section === 'history' ? history() : fields.section === 'conversations' ? conversations()
    : fields.section === 'citizens' ? view.board.agents : fields.section === 'state' ? [state] : view.me[fields.section] || [];
  const filtered = source.filter(row => (!fields.with || row.id === fields.with || row.with === fields.with || row.from === fields.with || row.to === fields.with
    || row.agent === fields.with || row.by === fields.with || row.a === fields.with || row.b === fields.with || row.participants?.includes(fields.with)) && (!fields.sitdown || row.sitdown === fields.sitdown)).slice().reverse();
  // Large nested evidence (holdings or an overheard conversation) must not create an empty, terminal page.
  // These lossless field fragments retain source identity and a path; no fact or quotation is summarized.
  const fragments = row => {
    if (evidenceSize(row) <= LOOKUP_CHARS - 500) return [row];
    const parts = [];
    const walk = (value, path = [], words = null) => {
      if (value && typeof value === 'object' && Object.keys(value).length) {
        for (const [k, v] of Object.entries(value)) walk(v, [...path, Array.isArray(value) ? Number(k) : k], words || (['line', 'reason', 'name', 'creed'].includes(k) ? k : null));
      } else {
        parts.push({ n: row.n, day: row.day, type: row.type, ...(row.sitdown ? { sitdown: row.sitdown } : {}),
          fragment: path, ...(words ? { [words]: value } : { value }) });
      }
    };
    walk(row);
    return parts;
  };
  const all = ['speech', 'conversations', 'history', 'citizens', 'state'].includes(fields.section) ? filtered.flatMap(fragments) : filtered;
  const offset = Math.min(fields.offset || 0, all.length);
  const page = { ...fields, offset, total: all.length, shown: 0, omitted: all.length, nextOffset: null, rows: [] };
  for (const row of all.slice(offset, offset + 4)) {
    const candidate = { ...page, rows: [...page.rows, row] };
    candidate.shown = candidate.rows.length;
    candidate.omitted = all.length - candidate.shown;
    candidate.nextOffset = offset + candidate.shown < all.length ? offset + candidate.shown : null;
    // Quoting free text also escapes angles and Unicode in the briefing. Account for that representation here so
    // one successful evidence page can actually fit, including its exact words, in the next request.
    if (evidenceSize({ act: 'lookup', ok: true, source: 'tools', day: view.day, lookup: candidate }) > LOOKUP_CHARS) break;
    Object.assign(page, candidate);
  }
  return page;
}

// One action: its result, as the rules left it (not yet presented), and for a play the play the rules will take.
function run(action, ctx) {
  const { deal } = ctx;
  const row = isObj(action) && typeof action.act === 'string' && BY_ACT.has(action.act) ? BY_ACT.get(action.act) : null;
  const name = row ? row.act : null;
  const c = row ? { ...scopeOf(deal), currentLegal: ctx.legal, validatePlay: ctx.validatePlay } : null;
  let applied = null, sent = null;
  let r;
  if (!row) r = fail('an action is {"act": its name, then its fields}, its name from the reply format', 'action');
  else if (!row.who.includes(deal.audience) || (row.act === 'read' && deal.audience === 'seat')) {
    r = fail(deal.audience === 'seat' ? 'your briefing is your read' : "your AI can read, set tonight's play and the memory", 'audience');
  } else if (row.built !== true) r = fail('not built yet', 'not-built');
  else if (row.act === 'lookup' && Object.hasOwn(action, 'mode') && !TYPES.lookupMode.values.includes(action.mode)) r = fail('mode: one of scheduled, inspect');
  else if (row.act === 'read') r = ok(null);
  else if (row.act === 'play') {
    r = ownPlay(action, c);
    if (r.ok && deal.audience === 'seat' && has(action, 'reason')) {
      r = typeof action.reason === 'string' ? ok({ ...r.value, reason: action.reason }) : fail('reason: one line of words');
    }
  } else {
    const extra = Object.keys(action).some(f => has(action, f) && f !== 'act' && !Object.hasOwn(row.fields, f));
    r = extra ? fail(`inapplicable fields: ${name} takes ${Object.keys(row.fields).join(', ') || 'no fields'}`) : fieldsOf(action, row.fields, c);
    if (r.ok && row.act !== 'lookup') r = ok({ kind: errandOf(row), ...(row.via?.fixed || {}), ...Object.fromEntries(Object.entries(r.value).map(([f, x]) => [row.as?.[f] || f, x])) });
  }
  const tries = triesOn(ctx.tries, deal.day);
  const same = sameAs(name, r.ok ? r.value : action);
  if ((tries.failed[same] || 0) >= N['gap.tries']) return { result: { act: name, status: 'refused', source: 'tools', ...fail(`refused untried: it failed ${N['gap.tries']} times today`, 'repeat', 'not-yet') } };
  if (r.ok && errandOf(row)) {
    sent = r.value;
    const a = applied = ctx.apply(sent) || {};
    if (a.legal) ctx.legal = a.legal;
    if (a.actions) ctx.actions = a.actions;
    r = a.ok ? ok(null) : fail(typeof a.why === 'string' ? a.why : 'the rules refused it', a.source === 'tools' ? a.code || 'field' : 'rules', ['not-yet', 'never'].includes(a.kind) ? a.kind : 'never');
  }
  if (!r.ok) {
    tries.failed[same] = (tries.failed[same] || 0) + 1;
    return { result: { act: name, ...r, status: 'refused', source: applied?.source || (r.code === 'rules' ? 'core' : 'tools'), ...(sent ? { action: Object.fromEntries(Object.entries(sent).filter(([k]) => !FREE_TEXT.includes(k))) } : {}), ...(applied?.quote ? { quote: applied.quote } : {}), ...(ctx.actions ? { state: receiptState(ctx.actions) } : {}) } };
  }
  if (row.act === 'read') return { result: { act: name, ok: true, view: deal.view, menu: deal.menu } };
  if (row.act === 'lookup') return { result: { act: name, ok: true, source: 'tools', day: deal.day,
    lookup: lookup(r.value, ctx.currentView ? present(deal, ctx.currentView()) : deal.view) } };
  if (row.act === 'play') return { result: { act: name, ok: true, status: 'selected', source: 'tools', play: r.value }, play: r.value };
  return { result: { act: name, ok: true, source: 'core', day: deal.day, status: ['shop', 'sell', 'offer', 'fence_buy', 'fence_accept'].includes(name) ? 'placed' : 'applied',
    ...(sent ? { action: Object.fromEntries(Object.entries(sent).filter(([k]) => !FREE_TEXT.includes(k))) } : {}), ...(applied?.receipt ? { receipt: applied.receipt } : {}),
    ...(applied?.quote ? { quote: applied.quote } : {}), ...(ctx.actions ? { state: receiptState(ctx.actions) } : {}) } };

}

// One action, as an owner's AI calls a tool: its result, as the player reads it. ctx: { deal, apply, tries }, where
// `apply(errand)` forwards the core's { ok, why, kind, actions, legal, quote, receipt }; `validatePlay` checks the decoded
// play against the runner's current core state. Original menu numbers and handles stay fixed. `tries` is the record the
// caller keeps for the day.
export const act = (action, ctx) => present(ctx.deal, run(action, ctx).result);

// R10a (the 10-20 audit, §2.3; slime, 10-20: "Stop our tool code from throwing away trade terms. That's a plain bug."):
// what the native tool calls' reader (tool-calls.mjs) read but couldn't send with its action, as an entry of its own in
// the reply's list, in that action's place: `unsent(act, why)`. The reply refuses it, typed (code 'unsent'), so the
// model reads why on its next call, and nothing reaches the rules. The mark is a symbol, so no reply's text can make one.
// `offer`, for an agree's terms ({ sitdown, terms }): no refusal when they are the open offer the agree takes, as the
// seat's briefing showed it (its deals: the other side's, open, unagreed, unexpired), in either form, by the rules' own
// test (deals.mjs offeredBack); the reader can't see the offer, the reply can.
const UNSENT = Symbol('unsent');
export const unsent = (act, why, offer = null) => ({ act, [UNSENT]: { why, offer } });
function theOpenOffer(deal, { sitdown, terms }) {
  const me = deal.view.me;
  const d = (me.deals || []).find(x => x.sitdown === sitdown && x.open && !x.agreed && !x.expired && x.stated === 'them');
  if (!d) return false;
  // Only what makes a deal is judged (deals.mjs dealOf): its what, goods or piece, cash and night; not who or where.
  const r = TYPES.terms.read(Object.fromEntries(Object.entries(terms).filter(([f]) => ['what', 'goods', 'piece', 'cash', 'night'].includes(f))), scopeOf(deal));
  if (!r.ok) return false;
  // Either form agrees (a sell for a buy, or the same words), so terms that name no what read as a buy.
  const t = dealOf({ ...r.value, what: r.value.what === undefined ? 'trade' : whatOf(r.value.what) }, me.id, d.with);
  const piece = d.piece && copyOf(deal, d.piece).ok ? copyOf(deal, d.piece).copy : d.piece;
  const [seller, buyer] = d.role === 'seller' ? [me.id, d.with] : [d.with, me.id];
  return !!t && offeredBack({ seller, buyer, ...(d.piece ? { piece } : { goods: d.goods }), cash: d.cash, night: d.night }, t);
}

// A seat's reply (§18: one JSON reply a call), as JSON text or parsed: {"actions": [...]}, a list of actions, or one
// action. The actions run in the order written, and the first play stands (GAP gap.reply). `results` are what the
// player reads next; `play` is the play the rules will take, for the caller alone (it names pieces by copy).
export function reply(raw, ctx) {
  let x = raw;
  if (typeof raw === 'string') {
    try {
      x = JSON.parse(raw);
    } catch {
      x = undefined;
    }
  }
  const list = Array.isArray(x) ? x : isObj(x) && Array.isArray(x.actions) ? x.actions : isObj(x) && typeof x.act === 'string' ? [x] : null;
  if (!list) return { results: [present(ctx.deal, { act: null, ...fail('a reply is one JSON object: {"actions": [...]}', 'malformed') })], play: null };
  // Inspect is an atomic read-before-act boundary. Validate the whole batch before even the first mutation, including
  // a malformed inspection mode; action order cannot bypass this guard.
  const inspecting = list.some(a => isObj(a) && a.act === 'lookup' && Object.hasOwn(a, 'mode') && a.mode !== 'scheduled');
  if (inspecting && list.length !== 1) return { results: [present(ctx.deal, { act: 'lookup', status: 'refused', source: 'tools',
    ...fail('inspection must be the only action; no actions in this reply ran', 'mixed-inspection') })], play: null, inspection: { ok: false } };
  let play = null, forgetBefore = null, noted = false, looked = false;
  const results = [];
  for (const a of list) {
    if (isObj(a) && Object.hasOwn(a, UNSENT)) {
      const { why, offer } = a[UNSENT];
      if (!offer || !theOpenOffer(ctx.deal, offer)) results.push(present(ctx.deal, { act: a.act, status: 'refused', source: 'tools', ...fail(why, 'unsent') }));
      continue;
    }
    if (looked && isObj(a) && a.act === 'lookup') {
      results.push(present(ctx.deal, { act: 'lookup', status: 'refused', source: 'tools', ...fail('one lookup per reply', 'one-lookup') }));
      continue;
    }
    if (play && isObj(a) && a.act === 'play') {
      results.push(present(ctx.deal, { act: 'play', status: 'refused', source: 'tools', ...fail('one play a reply: the first stands', 'one-play') }));
      continue;
    }
    if (noted && isObj(a) && a.act === 'note') {
      results.push(present(ctx.deal, { act: 'note', status: 'refused', source: 'tools', ...fail('one journal note per reply', 'one-note') }));
      continue;
    }
    const r = run(a, ctx);
    if (a?.act === 'lookup' && r.result.ok) looked = true;
    if (a?.act === 'note' && r.result.ok) noted = true;
    if (r.play) play = r.play;
    results.push(present(ctx.deal, r.result));
    // The seat observes the core's current view, never infers a successful drug effect from the submitted action.
    if (ctx.afterAction?.()) { play = null; forgetBefore = results.length; }
  }
  return { results, play, ...(inspecting ? { inspection: { ok: results.length === 1 && results[0].ok === true } } : {}),
    ...(forgetBefore === null ? {} : { forgetBefore }) };
}

// The reply format, generated from the table: the actions the audience may send, each with its fields, then what each
// kind of field is. An owner's AI gets no free-text field (§18).
export function replyFormat(audience) {
  return formatReply({ audience, actions: ACTIONS, types: TYPES, tools: TOOLS });
}
