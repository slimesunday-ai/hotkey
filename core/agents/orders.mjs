// GAME §17/Q8: deterministic standing directives from the permitted view. Core legal plays supply all choices;
// protective orders only constrain them. No target's hidden current location or unpromised backer is inferred.
import { HOMES } from '../rules/state.mjs';
import { tradeRoutine } from '../bench/bots.mjs';
import { USED_BY } from '../rules/setup.mjs';
import { SOLD_BY } from '../rules/memory.mjs';

export function standingOrders(view, { defaultPlay = null } = {}) {
  const me = view.me;
  const orders = me.memory?.orders || [];
  const legal = view.legal || [];
  const verified = target => me.sitdowns.find(sd => sd.with === target && sd.verified)?.verified;
  const location = p => p.place || (p.kind === 'back' ? verified(p.target)?.place : null);
  const protects = p => {
    if (orders.some(o => o.kind === 'avoid_lawless')) {
      const place = location(p);
      if (!place || (view.board.tonight || view.board.police)[place] === 'lawless') return false;
    }
    if (orders.some(o => o.kind === 'protect_grail') && me.pieces.some(p => p.worn && p.tier === 'grail')) {
      const home = ['laylow', 'cook', 'build'].includes(p.kind) && p.place === HOMES;
      const leader = p.kind === 'back' && verified(p.target);
      const accepted = leader && leader.kind !== 'back' && leader.accept?.includes(me.id);
      if (!home && !accepted) return false;
    }
    return true;
  };
  for (const order of orders) {
    let candidate = null;
    if (order.kind === 'laylow' && me.heat >= order.stars) candidate = legal.find(p => p.kind === 'laylow');
    if (order.kind === 'back') candidate = legal.find(p => p.kind === 'back' && p.target === order.agent);
    if (order.kind === 'retaliate') {
      const robbed = [...view.events].reverse().find(e => e.type === 'robbed' && e.agent === me.id && e.day === view.day - 1 && e.by);
      if (robbed) {
        const sighting = [...(view.sightings[robbed.by] || [])].filter(s => s.night === view.day - 1).at(-1);
        const line = sighting && legal.find(p => p.kind === 'hit' && p.target === robbed.by && (p.place === sighting.place || p.places?.includes(sighting.place)));
        if (line) { const { places, ...play } = line; candidate = { ...play, place: sighting.place }; }
      }
    }
    if (candidate && protects(candidate)) return { play: { ...candidate }, reason: `Standing order: ${order.kind}${order.kind === 'retaliate' ? '; uses the target\'s dated last-night sighting' : ''}` };
  }
  const protective = orders.some(o => o.kind === 'avoid_lawless' || o.kind === 'protect_grail' && me.pieces.some(p => p.worn && p.tier === 'grail'));
  if (!protective) return null;
  const defaults = [defaultPlay, ...legal.filter(p => p.kind === 'laylow'), ...legal.filter(p => p.kind === 'board'), ...legal.filter(p => p.kind === 'hustle')].filter(Boolean);
  const candidate = defaults.find(p => protects(p) && legal.some(l => l.kind === p.kind && l.place === p.place));
  if (candidate) return { play: { ...candidate }, reason: 'Standing protective orders: compliant legal default' };
  return { play: null, unfulfilled: true, reason: 'No legal default, laylow, hustle or ferry route satisfies the protective orders; core default required' };
}

// --- R10b: standing orders for trade (slime, 10-20: "Standing orders for trade"; GAME.md §17, §33) -------------------
// The seat's trade orders (rules/memory.mjs TRADE_ORDER_KINDS), as the trade routine's limits (bench/bots.mjs
// tradeRoutine): its buy order, its sell orders' least price by item, and whether it pays; null when it has none.
export function tradeLimits(view) {
  const orders = (view && view.me && view.me.memory && view.me.memory.orders) || [];
  const buy = orders.find(o => o.kind === 'buy');
  const sell = Object.fromEntries(orders.filter(o => o.kind === 'sell').map(o => [o.item, o.min]));
  const pay = orders.some(o => o.kind === 'pay');
  if (!buy && !Object.keys(sell).length && !pay) return null;
  return { buy: buy ? { item: buy.item, units: buy.units, max: buy.max } : null, sell, pay };
}

// The routine's record of what it did itself (memo.said), from the events its own errands made (noteOrders): the
// sit-downs it asked for and those it answered, by id; how many messages it said in each; and the event numbers of its
// own hand-overs. A sit-down is the routine's only if it asked for it or answered it, and stays its own until the seat
// speaks there itself: says more there than the routine did, or hands goods or cash over to the other side itself
// (§17's dial: "Plays you picked and messages you wrote are marked in the record"; the model's own act takes the
// sit-down over).
const saidBy = memo => {
  memo.said ||= {};
  for (const k of ['asked', 'answered', 'says']) memo.said[k] ||= {};
  memo.said.handed ||= [];
  return memo.said;
};
const routineHolds = (memo, sd) => !!saidBy(memo).asked[sd.id] || !!saidBy(memo).answered[sd.id];
// The seat's own hand-over to the other side of `sd` (a give or a pay, not one of the routine's), since the sit-down was
// asked: one naming the sit-down, or naming none.
const handedItself = (view, memo, sd) => (view.me.transactions || []).some(t => t.from === view.me.id && t.to === sd.with
  && !saidBy(memo).handed.includes(t.n) && (t.sitdown ? t.sitdown === sd.id : t.day >= sd.day));
export function spokeIn(view, memo, sd) {
  const m = saidBy(memo);
  if (sd.asked === 'me' && !m.asked[sd.id]) return true;
  if (sd.asked === 'them' && sd.state !== 'asked' && !m.answered[sd.id]) return true;
  if (sd.said.filter(x => x.from === view.me.id).length > (m.says[sd.id] || 0)) return true;
  return handedItself(view, memo, sd);
}
// An ask to the seat that its trade orders cover, by §9's table and the asker's trade (an ask's words are free text):
// from a trade that buys an item a sell order sells, or from the trade that sells the item its buy order buys. Every
// other ask is the seat's.
function coveredAsk(view, lim, sd) {
  const trade = ((view.board.agents || []).find(a => a.id === sd.with) || {}).trade;
  if (!trade) return false;
  const sells = Object.keys(lim.sell || {}).some(k => USED_BY[k] === trade);
  const buys = !!lim.buy && SOLD_BY[lim.buy.item] === trade;
  return sells || buys;
}
// The sit-downs the routine may act in: its own, until the seat has spoken there itself; and an ask to the seat its
// orders cover, that nobody has answered yet.
const mayAct = (view, memo, lim) => sd => (routineHolds(memo, sd) && !spokeIn(view, memo, sd))
  || (sd.asked === 'them' && sd.state === 'asked' && coveredAsk(view, lim, sd));

// A routine hand-over is never more than its deal still has due: the deal's units less what has been handed over
// against it (rules/deals.mjs, read off the seat's view), counting the routine's own earlier hand-overs this round. One
// with no such deal in a sit-down the routine may act in doesn't go.
function capGives(view, errands, held) {
  const sent = new Map();
  return errands.flatMap(e => {
    if (e.kind !== 'give' || !e.goods) return [e];
    const sd = held.find(x => x.with === e.to && (!e.sitdown || x.id === e.sitdown));
    const d = sd && (view.me.deals || []).filter(x => x.sitdown === sd.id && x.role === 'seller' && x.goods).at(-1);
    if (!d) return [];
    const done = sent.get(d.id) || {};
    const goods = {};
    for (const [k, n] of Object.entries(e.goods)) {
      const due = (d.goods[k] || 0) - ((d.given || {})[k] || 0) - (done[k] || 0);
      if (Math.min(n, due) > 0) goods[k] = Math.min(n, due);
    }
    if (!Object.keys(goods).length) return [];
    for (const [k, n] of Object.entries(goods)) done[k] = (done[k] || 0) + n;
    sent.set(d.id, done);
    return [{ ...e, goods }];
  });
}

// CLEAR (§11) wipes the seat's day from its view; the routine's memory goes back to the day's start with it, as a bot's
// does (bench/bots.mjs dawnMemo, forgetDay), so it never acts on a day its seat has forgotten. The count of what its buy
// order ordered today (memo.bought) is kept: it is the order's limit, not something the seat learned.
function dawnOf(view, memo) {
  if (!memo.dawn || memo.dawn.day !== view.day) {
    const { dawn, ...rest } = memo;
    memo.dawn = { day: view.day, memo: JSON.parse(JSON.stringify(rest)) };
  }
  const take = (view.events || []).filter(e => e.type === 'take' && e.agent === view.me.id && e.drug === 'clear').reduce((n, e) => Math.max(n, e.n), -1);
  if (take > (memo.cleared ?? -1)) {
    const { dawn, bought } = memo;
    for (const k of Object.keys(memo)) delete memo[k];
    Object.assign(memo, JSON.parse(JSON.stringify(dawn.memo)), { dawn, ...(bought ? { bought } : {}), cleared: take });
  }
}

// The trade routine's errands this round for a model seat with trade orders, read from its own view alone: the bots'
// trade (tradeRoutine), as the canny trade bot of its trade runs it, held to its orders, in the sit-downs it may act in
// (mayAct); it closes only its own, and hands over no more than a deal has due. `cfg`: the seat's cast entry (its trade
// and the cast's flags); `memo`: the routine's own memory, which the runner keeps in its checkpoint. [] with no trade
// orders.
export function tradeOrders(view, ctx, cfg, memo) {
  if (!view || view.over || !view.me) return [];
  const lim = tradeLimits(view);
  if (!lim) return [];
  dawnOf(view, memo);
  const m = saidBy(memo);
  // Forget sit-downs gone from the view.
  for (const k of ['asked', 'answered', 'says']) for (const id of Object.keys(m[k])) if (!view.me.sitdowns.some(sd => sd.id === id)) delete m[k][id];
  const keep = mayAct(view, memo, lim);
  const held = view.me.sitdowns.filter(keep);
  const own = new Set(view.me.sitdowns.filter(sd => routineHolds(memo, sd)).map(sd => sd.id));
  const out = tradeRoutine(view, ctx, { ...cfg, canny: true }, memo, lim, keep).filter(e => e.kind !== 'close' || own.has(e.sitdown));
  return capGives(view, out, held);
}

// What the rules did with one of the routine's errands, from the events it made (`res.events`): an ask's sit-down, an
// answer's, a message, and its hand-overs go in its record of what it did itself.
export function noteOrders(view, memo, e, res) {
  if (!res || !res.ok) return;
  const m = saidBy(memo);
  const events = res.events || [];
  if (e.kind === 'ask') for (const x of events.filter(x => x.type === 'ask')) m.asked[x.sitdown] = true;
  else if (e.kind === 'answer') m.answered[e.sitdown] = true;
  else if (e.kind === 'say') m.says[e.sitdown] = (m.says[e.sitdown] || 0) + 1;
  for (const x of events) if (x.type === 'give' || x.type === 'pay') m.handed.push(x.n);
}

// One round of a seat's trade orders, as the runner plays it (bench/runner.mjs): each errand into the rules through
// `apply` (the runner's, with origin 'orders', returning the rules' result with the events it made), and what the rules
// did with it back to the routine's memory.
export function runTradeOrders(view, ctx, cfg, memo, apply) {
  for (const e of tradeOrders(view, ctx, cfg, memo)) noteOrders(view, memo, e, apply(e));
}
