// R2-2/Q8/Q9: durable memory belongs to the game, with the same visibility and controller-independent erasure rules.
import { N } from '../numbers.mjs';
import { own, clone, emit, toFew, byId } from './state.mjs';
import { USED_BY } from './setup.mjs';

export const MEMORY_ROUTES = ['buy', 'hit', 'trade', 'vault'];
// §17: the standing orders that pick a night play when nobody answers.
export const NIGHT_ORDER_KINDS = ['retaliate', 'laylow', 'protect_grail', 'back', 'avoid_lawless'];
// R10b (slime, 10-20: "Standing orders for trade"): the trade's standing orders, carried out every day round by the
// game (agents/orders.mjs tradeOrders): buy an item the seat's trade buys, up to `units` a day at no more than `max` a
// unit; sell an item its trade sells at no less than `min` a unit; pay what it owes on agreed deals for goods.
export const TRADE_ORDER_KINDS = ['buy', 'sell', 'pay'];
export const ORDER_KINDS = [...NIGHT_ORDER_KINDS, ...TRADE_ORDER_KINDS];
// §9's table, the sellers' side for goods: what each trade sells to the trade that works it (the buyers' side is
// setup.mjs's USED_BY). Doses are the street's (TEMP), as the trades move them. Guns are the seat's own (the
// orchestrator's call on the R10b review, 10-20): anyone may buy one, so no table tells a gun ask from a crew's or
// muscle's, and trade orders sell goods only.
export const SOLD_BY = { chems: 'smuggler', parts: 'smuggler', doses: 'chemist' };
// The items a trade's buy and sell orders may name (read when called: setup.mjs imports this file).
export const tradeItems = trade => ({
  buy: Object.keys(USED_BY).filter(k => USED_BY[k] === trade),
  sell: Object.keys(SOLD_BY).filter(k => SOLD_BY[k] === trade),
});
// The most standing orders a seat holds: one of each night kind, and one trade order a kind and item for the trade
// with the most (a pay, and a buy or sell for each item its trade buys or sells).
export const orderLimit = () => NIGHT_ORDER_KINDS.length
  + Math.max(...['smuggler', 'chemist', 'dealer', 'gunrunner'].map(t => tradeItems(t).buy.length + tradeItems(t).sell.length + 1));
// Bounds on a trade order's whole numbers: units a day, and dollars a unit.
export const TRADE_ORDER_MAX = { units: 100, price: 10000 };
const isWhole = (x, max) => Number.isInteger(x) && x >= 1 && x <= max;
export const MEMORY_ERRANDS = ['plan', 'orders', 'note', 'creed'];
export const emptyMemory = () => ({ plan: [], orders: [], creed: [], journal: [] });
// Reading an old checkpoint neither mutates it nor invents past events.
export function memoryOf(s, id) {
  const stored = s.agents[id].memory;
  return Object.fromEntries(Object.keys(emptyMemory()).map(key => [key, clone(stored && Array.isArray(stored[key]) ? stored[key] : [])]));
}
// Identity adapter for the very same shape validator at the tool boundary; no private state or mechanical simulation.
export function memoryScope(view) {
  return {
    // R10b: the seat's own trade, which its trade orders are checked against.
    agents: Object.fromEntries([...(view.board.agents || []).map(a => a.id), view.me.id].map(id => [id, id === view.me.id ? { trade: view.me.trade } : {}])),
    traits: Object.fromEntries((view.board.list || []).map(t => [t.trait, {}])),
  };
}
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const keysAre = (v, keys) => Object.keys(v).every(k => keys.includes(k));
const cut = text => text.slice(0, N['gap.lineLength']);
const no = why => ({ ok: false, why, kind: 'never' });
// R9b: the runner's trusted context for the dawn journal entry (agents/journal.mjs DAWN_CONTEXT).
const dawnNote = context => record(context) && Object.hasOwn(context, 'source') && context.source === 'dawn';

// Context is supplied by a trusted controller, never copied from an action's fields. It is needed only for the Creed.
export function checkMemory(s, e, context = {}) {
  if (!e || !own(s.agents, e.by)) return no('no such agent');
  if (e.kind === 'plan') {
    if (!Array.isArray(e.traits) || e.traits.length > 3) return no('a plan has up to three traits');
    const ids = [];
    for (const p of e.traits) {
      if (!record(p) || !keysAre(p, ['trait', 'routes']) || !own(s.traits, p.trait)) return no('a plan names traits on the list');
      if (!Array.isArray(p.routes) || p.routes.length < 2 || p.routes.length > 3
        || !p.routes.every(r => MEMORY_ROUTES.includes(r)) || new Set(p.routes).size !== p.routes.length) {
        return no('each trait has two or three different routes: buy, hit, trade or vault');
      }
      if (ids.includes(p.trait)) return no('each trait appears once in a plan');
      ids.push(p.trait);
    }
  } else if (e.kind === 'orders') {
    if (!Array.isArray(e.orders) || e.orders.length > orderLimit()) return no(`up to ${orderLimit()} standing orders`);
    const kinds = [];
    for (const o of e.orders) {
      if (!record(o) || !ORDER_KINDS.includes(o.kind)) return no('each standing order has a kind from the list');
      // R10b: one trade order a kind and item; one of each other kind.
      const key = ['buy', 'sell'].includes(o.kind) ? `${o.kind} ${o.item}` : o.kind;
      if (kinds.includes(key)) return no('one standing order of each kind, and one trade order of each kind and item');
      const keys = o.kind === 'laylow' ? ['kind', 'stars'] : o.kind === 'back' ? ['kind', 'agent']
        : o.kind === 'buy' ? ['kind', 'item', 'units', 'max'] : o.kind === 'sell' ? ['kind', 'item', 'min'] : ['kind'];
      if (!keysAre(o, keys)) return no('a standing order contains only its listed fields');
      if (o.kind === 'laylow' && o.stars !== 3) return no('the laylow order starts at three stars');
      if (o.kind === 'back' && (!own(s.agents, o.agent) || o.agent === e.by)) return no('a back order names another agent');
      if (TRADE_ORDER_KINDS.includes(o.kind)) {
        const trade = s.agents[e.by].trade;
        if (trade === 'cop') return no('a Cop has no trade orders');
        const items = tradeItems(trade)[o.kind];
        if (o.kind === 'sell' && o.item === 'guns') return no('trade orders sell goods only (chems, parts, doses): a gun is sold by the seat itself');
        if (o.kind === 'pay') {
          if (!tradeItems(trade).buy.length && !tradeItems(trade).sell.length) return no('a pay order is for a trade in goods');
        } else if (!items.includes(o.item)) {
          return no(items.length ? `a ${trade} ${o.kind === 'buy' ? 'buys' : 'sells'} ${items.join(' or ')}` : `a ${trade} ${o.kind === 'buy' ? 'buys' : 'sells'} no goods from the other trades`);
        }
        if (o.kind === 'buy' && !isWhole(o.units, TRADE_ORDER_MAX.units)) return no(`a buy order's units are a whole number a day, 1 to ${TRADE_ORDER_MAX.units}`);
        if (o.kind === 'buy' && !isWhole(o.max, TRADE_ORDER_MAX.price)) return no(`a buy order's max is whole dollars a unit, 1 to ${TRADE_ORDER_MAX.price}`);
        if (o.kind === 'sell' && !isWhole(o.min, TRADE_ORDER_MAX.price)) return no(`a sell order's min is whole dollars a unit, 1 to ${TRADE_ORDER_MAX.price}`);
      }
      kinds.push(key);
    }
  } else if (e.kind === 'note') {
    if (typeof e.line !== 'string' || !e.line.length) return no('a note is one nonempty line');
    // R9b: the dawn journal entry the game asked for (runner.mjs, agents/journal.mjs) comes through the trusted dawn
    // context, never an action's fields: one a day, up to gap.journalEntry's characters.
    if (dawnNote(context) && e.line.length > N['gap.journalEntry'].chars) return no(`a dawn entry is up to ${N['gap.journalEntry'].chars} characters`);
  } else if (e.kind === 'creed') {
    if (!record(context) || !Object.hasOwn(context, 'source') || context.source !== 'owner') return no('only a trusted owner may set the Creed');
    // R8b (§17, slime 10-19): the owner's own words, `text`, up to N.creed characters, new lines and all; empty words
    // clear it. The three-line form (`lines`) stays as it was.
    if (Object.hasOwn(e, 'text')) {
      if (Object.hasOwn(e, 'lines')) return no("a Creed is the owner's words or its lines, not both");
      if (typeof e.text !== 'string' || e.text.length > N.creed) return no(`a Creed is the owner's words, up to ${N.creed} characters`);
    } else if (!Array.isArray(e.lines) || e.lines.length > 3 || !e.lines.every(x => typeof x === 'string' && !/[\r\n]/.test(x))) return no('a Creed has up to three lines');
  } else return no('no such memory operation');
  return { ok: true };
}

// R10b: who set a seat's standing orders, from the trusted controller's context: the owner (--orders-baseline's
// `source: 'owner'`) or the seat's model (the runner's `origin: 'model'` on a model seat's own errands); none for any
// other caller, so a bot's record is as it was.
const ordersOrigin = context => (!record(context) ? null : context.source === 'owner' ? 'owner' : context.origin === 'model' ? 'model' : null);
// Its standing orders' record carries that origin (rules/plays.mjs ORIGINS); every other part's is as it was.
function publish(s, out, id, part, origin = null) {
  emit(s, out, 'memory', { agent: id, part, memory: memoryOf(s, id), ...(origin ? { origin } : {}) }, toFew(s, [id]));
}
export function applyMemory(s, e, out, context = {}) {
  const check = checkMemory(s, e, context);
  if (!check.ok) return [check.why, check.kind];
  const m = memoryOf(s, e.by);
  if (e.kind === 'plan') m.plan = e.traits.map(p => ({ trait: p.trait, routes: [...p.routes] }));
  else if (e.kind === 'orders') m.orders = e.orders.map(o => o.kind === 'back' ? { kind: o.kind, agent: o.agent }
    : o.kind === 'laylow' ? { kind: o.kind, stars: 3 } : o.kind === 'buy' ? { kind: o.kind, item: o.item, units: o.units, max: o.max }
      : o.kind === 'sell' ? { kind: o.kind, item: o.item, min: o.min } : { kind: o.kind });
  else if (e.kind === 'creed') m.creed = Object.hasOwn(e, 'text') ? (e.text ? [e.text] : []) : e.lines.map(cut);
  else m.journal = [...m.journal, { day: s.day, line: dawnNote(context) ? e.line : cut(e.line) }].slice(-N['gap.journal']);
  s.agents[e.by].memory = m;
  // R9b: the event names a dawn entry's part 'dawn', the note an agent wrote 'note'; the stored note is the same.
  publish(s, out, e.by, e.kind === 'note' && dawnNote(context) ? 'dawn' : e.kind, e.kind === 'orders' ? ordersOrigin(context) : null);
  return null;
}

// CLEAR forgets active state, never historical public records. Current-day notes are the pre-take private notes:
// prior-day notes have already reached their disclosure time. Later notes are appended after this operation.
export function clearMemory(s, id, out) {
  const m = memoryOf(s, id);
  const journal = m.journal.filter(n => n.day < s.day);
  if (!m.plan.length && journal.length === m.journal.length) return;
  m.plan = [];
  m.journal = journal;
  s.agents[id].memory = m;
  publish(s, out, id, 'clear');
}

// The latest fully disclosed snapshot per agent, retained beyond view.events' recent window. Never read a rival's
// current memory here: today's replacement may still be private. Empty defaults create no phantom public history.
export function publicMemories(log, clock) {
  const latest = new Map();
  for (const e of log) if (e.type === 'memory' && e.vis.pub <= clock) latest.set(e.agent, e);
  return [...latest].sort(([a], [b]) => byId(a, b)).map(([agent, e]) => ({ agent, asOfDay: e.day, asOfClock: e.t, ...clone(e.memory) }));
}
