// An errand: (state, errand) -> (state, events). GAME.md §10, §12, §14; layer 1 only (§24).
// Errands happen by day, cost no play, fight no one and need no place, so an agent in jail can run them too (§5).
// Typed sit-down messages are day inputs, so they come through here as well.
import { N } from '../numbers.mjs';
import { MEMORY_ERRANDS, applyMemory, clearMemory } from './memory.mjs';
import {
  clone, emit, toAll, toFew, cashOut, crewPieces, moveCopy, messageLimit, listLeft, wears, byId, DISTRICTS,
  GOODS, DRUGS, addGoods, moveGoods, holdsGoods, bookGoods, sortGoods, CRATE, VAULT, holdingsOf, walkOf, agentIds, rarest,
  unwornOf, tookToday, rehome, drugsAsDoses, toFewUntil, DAY15, own, offBoatFrom,
} from './state.mjs';
import { runOf, marketItems, priceOf } from './market.mjs';
import { newDeal, hold, putUp, copyHalf, listingOf, fenceBoard } from './fence.mjs';
import { checkPlay, lockOf, onRecord, legalPlays } from './plays.mjs';
import { stateDeal, noteHandover, endDeals, cashForDeal, openOffer } from './deals.mjs';

export const ERRANDS = [
  'dress', 'offer', 'give', 'pay', 'bail', 'rent',
  'crew_form', 'crew_invite', 'crew_join', 'crew_leave', 'stash_put', 'stash_take',
  'ask', 'answer', 'say', 'close', 'listen', 'shop', 'sell',
  'fence_list', 'fence_unlist', 'fence_buy', 'fence_swap', 'fence_accept', 'tip', 'bribe', 'bounty', 'lookout', 'take',
  'write', 'chat', 'outloud', ...MEMORY_ERRANDS,
];
// The typed lists each have one owner, here; the tools (agents/tools.mjs) import them.
export const SAY_KINDS = ['offer', 'promise', 'threat', 'answer'];
// What a payment is for, typed (§18: only `line` carries words an agent wrote).
export const PAY_FOR = ['cut', 'debt', 'deal', 'gift'];
// R5-deals (deals.mjs): `trade` buys goods or a piece for cash, its speaker the buyer; `sell` sells them.
export const TERM_WHAT = ['back', 'pay', 'hit', 'trade', 'sell', 'join', 'stay', 'meet'];
// R5-terms: the word players say for a what the record names otherwise. A buy is said `buy`; the record keeps `trade`,
// its first name, so every record, and everything that reads one, stays as it was. The tools show these words, the
// briefing writes them, and the rules read either word as the record's (whatOf).
export const TERM_SAID = { trade: 'buy' };
// A message's what as the record keeps it, from either word; null for any other.
export const whatOf = w => (TERM_WHAT.includes(w) ? w : Object.keys(TERM_SAID).find(k => TERM_SAID[k] === w) || null);
// The payments a deal counts (deals.mjs): one for a debt or a deal, or for nothing named; never a cut or a gift.
const FOR_DEALS = [null, 'debt', 'deal'];
// R5-deals: the sit-down a give or a pay names, so it counts against that sit-down's deal (deals.mjs), or null. Only a
// sit-down id's shape is read; one that names no deal of the two leaves the hand-over to the deal its terms match.
const dealSitdown = e => (typeof e.sitdown === 'string' && /^s\d+$/.test(e.sitdown) ? e.sitdown : null);
// R5-deals: cash that names no sit-down, exactly what an unsettled promise to pay its payee still wants (§12), is that
// promise's (notePayment counts it there), so no deal counts it as well. Read before notePayment adds it.
const forPromise = (s, from, to, cash, sitdown) => !sitdown && cash > 0
  && s.promises.some(p => p.by === from && p.to === to && p.what === 'pay' && !p.settled && p.cash - p.paid === cash);
// Choose the cash book once, before either book changes. The whole cash transfer has one attribution: excess on a
// goods deal cannot quietly pay a separate promise. With no goods deal, ordinary partial promise payments still count.
const cashBook = (s, from, to, cash, sitdown, purpose = null) => {
  if (!FOR_DEALS.includes(purpose) || forPromise(s, from, to, cash, sitdown)) return 'promise';
  return cashForDeal(s, from, to, sitdown) ? 'deal' : 'promise';
};
// §14: what's said out loud is a threat, a boast or an offer.
export const LOUD_KINDS = ['threat', 'boast', 'offer'];

// R10b (§17: "which AI won" stays honest): an errand a seat's trade orders sent (the trusted runner's context, `origin:
// 'orders'`, never an action's own field) goes on the record with one more event, the seat's own until it goes public
// as its play does: which errand it was, whether the rules took it, and the events it made.
const ORDERS = 'orders';
const fromOrders = context => !!context && typeof context === 'object' && context.origin === ORDERS;
function markOrders(s, e, ok, out) {
  emit(s, out, 'orders', { agent: e.by, errand: ERRANDS.includes(e.kind) ? e.kind : 'unknown', origin: ORDERS, ok, of: out.map(x => x.n) }, toFew(s, [e.by]));
}

export function applyErrand(s0, e, context = {}) {
  if (!e || !own(s0.agents, e.by)) throw new Error(`errand from unknown agent ${e && e.by}`);
  const quote = e.kind === 'shop' || e.kind === 'sell' ? { quote: marketQuote(s0, e.by, e) } : {};
  const s = clone(s0);
  const out = [];
  let why = null;
  if (s.over) why = ['the season is over', 'never'];
  else if (s.clock % 2 !== 0) why = ['errands happen by day', 'not-yet'];
  else if (MEMORY_ERRANDS.includes(e.kind)) why = applyMemory(s, e, out, context);
  else if (!own(HANDLERS, e.kind)) why = ['unknown errand', 'never'];
  else why = HANDLERS[e.kind](s, s.agents[e.by], e, out);
  // §11, TRUTH: from the take until dawn the lock plays the locked play, so no errand of its taker's may change that:
  // handing away, selling, stashing or swapping what it needs, or taking the last dose a deal needs (GAP gap.truth).
  const a = s.agents[e.by];
  if (!why && a.locked && !lockOf(s, a.id, a.locked, s.day).ok) why = ['that would break the play locked tonight', 'not-yet'];
  if (!why) {
    // Receipt facts come from the executed events, including whether any attached invitation words were delivered.
    const receipt = e.kind === 'answer' || e.kind === 'say' ? { receipt: {
      kind: e.kind, sitdown: e.sitdown, state: s.sitdowns[e.sitdown].state,
      speechSent: out.some(v => v.type === 'say' || (v.type === 'decline' && !!v.line)),
    } } : {};
    if (fromOrders(context)) markOrders(s, e, true, out);
    return { state: s, events: out, ok: true, ...quote, ...receipt, actions: actionState(s, e.by), legal: legalPlays(s, e.by) };
  }
  // A failed errand changes nothing; it only goes on the owner's record (§33: typed, written back to the agent). One
  // that tells a fake is the agent's own until then (`until`: day 15, GAP gap.fakes).
  const [reason, kind, until] = Array.isArray(why) ? why : [why, 'never'];
  const f = clone(s0);
  const fo = [];
  emit(f, fo, 'invalid', { agent: e.by, errand: ERRANDS.includes(e.kind) ? e.kind : 'unknown', why: reason, kind }, until ? toFewUntil([e.by], until) : toFew(f, [e.by]));
  if (fromOrders(context)) markOrders(f, e, false, fo);
  return { state: f, events: fo, ok: false, why: reason, ...quote, actions: actionState(f, e.by), legal: legalPlays(f, e.by) };
}

const isCash = (v, max) => Number.isInteger(v) && v > 0 && v <= max;
const ownCopy = (s, a, k) => !!own(s.copies, k) && s.copies[k].holder.k === 'agent' && s.copies[k].holder.id === a.id;
const isAgent = (s, id) => !!own(s.agents, id);
// A listed piece stays with its seller, who can't wear it, hand it over or put it up anywhere else until it's unlisted
// (GAP gap.listed).
const LISTED = ['that piece is listed at the fence', 'not-yet'];
// §11, FIREWALL: until dawn no sit-down with the agent, and no hand-over, pay, swap or crew invite to it, gets through;
// the reason never names the drug (GAP gap.firewall).
const walled = (s, ...ids) => ids.some(id => s.agents[id].high.includes('firewall'));
const UNREACHABLE = ['not reachable until dawn', 'not-yet'];
// §9, §19 (layer 4): the fence takes no fakes, and tells only the agent that put one up, until the ferry (GAP gap.fakes).
const NO_FAKES = ['the fence takes no fakes', 'never', DAY15];
// Why an agent can't wear or move this piece now, or null.
const pieceWhy = (s, a, k) => (!ownCopy(s, a, k) ? "you don't hold that piece" : listingOf(s, k) ? LISTED : null);
const line = v => (typeof v === 'string' ? v.slice(0, N['gap.lineLength']) : '');
// Goods an agent names: whole counts above 0 of known kinds, in GOODS order. Anything else isn't goods at all, so
// nothing an agent types into it can reach the record (§18).
function goodsOf(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const keys = Object.keys(raw);
  if (!keys.length || !keys.every(k => GOODS.includes(k) && Number.isInteger(raw[k]) && raw[k] > 0)) return null;
  return Object.fromEntries(GOODS.filter(k => keys.includes(k)).map(k => [k, raw[k]]));
}
const BAD_GOODS = `goods are whole counts of ${GOODS.join(', ')}`;
const withGoods = goods => (goods ? { goods } : {});
// §14: a message's terms, typed: what, who, which piece or how much, which night, where, and goods. Whatever the rules
// can't read is dropped, so nothing an agent types into them reaches the record (§18). A sit-down's, crew chat's and
// out loud's are the same (Q6, Q7).
function termsOf(s, t) {
  const raw = t || {};
  const terms = {};
  const what = whatOf(raw.what);
  if (what) terms.what = what;
  if (own(s.agents, raw.who)) terms.who = raw.who;
  if (own(s.traits, raw.piece) || own(s.copies, raw.piece)) terms.piece = raw.piece;
  if (Number.isInteger(raw.cash) && raw.cash >= 0) terms.cash = raw.cash;
  if (Number.isInteger(raw.night) && raw.night >= s.day && raw.night <= N.nights) terms.night = raw.night;
  if (DISTRICTS.includes(raw.where)) terms.where = raw.where;
  const goods = goodsOf(raw.goods);
  if (goods) terms.goods = goods;
  return terms;
}

// A fence deal by its id, or null.
const dealOf = (s, id) => own(s.fence.deals, id);
// A half of a swap (§9): pieces (copy ids), goods and cash, typed; null if it's malformed or holds nothing.
function halfOf(s, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const [pieces, goods, cash] = [raw.pieces ?? [], raw.goods == null ? {} : goodsOf(raw.goods), raw.cash ?? 0];
  if (!Array.isArray(pieces) || !pieces.every(k => own(s.copies, k)) || new Set(pieces).size !== pieces.length) return null;
  if (!goods || !Number.isInteger(cash) || cash < 0 || !(pieces.length || Object.keys(goods).length || cash)) return null;
  return { pieces: [...pieces].sort(byId), goods, cash };
}
// Whether an agent holds a half to put up, now.
function canPut(s, a, h) {
  if (!h.pieces.every(k => ownCopy(s, a, k))) return ["you don't hold that piece", 'not-yet'];
  if (h.pieces.some(k => listingOf(s, k))) return LISTED;
  if (h.pieces.some(k => s.copies[k].fake)) return NO_FAKES;
  if (!holdsGoods(a, h.goods)) return ['not that many goods', 'not-yet'];
  return h.cash > a.cash ? ['not enough cash', 'not-yet'] : null;
}

// A promise of cash counts what the promiser has paid since (for the walk, §12).
function notePayment(s, from, to, cash) {
  for (const p of s.promises) if (p.by === from && p.to === to && p.what === 'pay' && !p.settled) p.paid += cash;
}

// What a member has put into the crew stash minus what it took out, by kind of goods (for the rug, §12).
function notePut(c, id, goods, sign) {
  const net = (c.putGoods[id] ||= {});
  for (const [k, n] of Object.entries(goods)) net[k] = (net[k] || 0) + sign * n;
}

// §11, call 2: SUDO handed over arrives as TEMP, carrying the giver's mark, one a dose; it's booked out as SUDO and in as
// TEMP, the `disguise` (GAP gap.sudo).
function handOver(s, a, to, goods) {
  const { sudo, ...rest } = goods;
  moveGoods(a, to, rest);
  if (!sudo) return;
  addGoods(a, 'sudo', -sudo);
  addGoods(to, 'temp', sudo);
  bookGoods(s, 'out', 'disguise', 'sudo', sudo);
  bookGoods(s, 'in', 'disguise', 'temp', sudo);
  to.marks = [...(to.marks || []), ...Array(sudo).fill(a.id)];
}

// §11, HALLU: a lead's fact is its kind and its agent; one an agent has had, from a true lead or a lookout, is never news
// to it again (GAP gap.hallu).
const lead = (kind, agent, value) => ({ kind, agent, value });
const learn = (a, leads) => (a.known = [...new Set([...(a.known || []), ...leads.map(l => `${l.kind}:${l.agent}`)])]);
// What a look shows of an agent, as leads: its cash, and the rarest piece it keeps unworn (§4's tie rule) or none.
const factsOf = (s, id) => [lead('cash', id, s.agents[id].cash), lead('stash', id, rarest(s, unwornOf(s, id), null))];
// Three leads, sorted as text so their order says nothing: the dose's two lies (the next two of its lot's pool), and the
// first fact the taker hasn't had: tonight's tips naming it, by tipper, then each other agent's cash and stash, richest
// first (cash, then id).
function leadsFor(s, a, lots) {
  const known = new Set(a.known || []);
  const facts = [
    ...s.tips.filter(t => t.agent === a.id).sort((x, y) => byId(x.by, y.by)).map(t => lead('tip', t.by, a.id)),
    ...agentIds(s).filter(x => x !== a.id).sort((x, y) => s.agents[y].cash - s.agents[x].cash || byId(x, y)).flatMap(x => factsOf(s, x)),
  ];
  const truth = [facts.find(f => !known.has(`${f.kind}:${f.agent}`)) || facts[0]].filter(Boolean);
  learn(a, truth);
  return [...truth, ...(lots.length ? lots[0].lies.slice(0, 2) : [])].map(l => [JSON.stringify(l), l]).sort((x, y) => byId(x[0], y[0])).map(x => x[1]);
}

// Pure preconditions shared by execution and the owner action contract. No handler is run to discover legality.
const ACTION_CHECKS = {
  rent(s, a) {
    if (!a.evicted) return 'you have a home';
    if (a.cash < N.rent) return ['not enough cash', 'not-yet'];
    return null;
  },
  answer(s, a, e) {
    const sd = own(s.sitdowns, e.sitdown);
    if (!sd) return 'no such sit-down';
    if (sd.b !== a.id) return 'not yours to answer';
    if (sd.state !== 'asked') return sd.state === 'open' ? `already open; use say with sitdown ${sd.id}` : 'already answered';
    if (walled(s, sd.a, sd.b)) return UNREACHABLE;
    if (a.msgs >= messageLimit(s, a.id)) return ['no messages left today', 'not-yet'];
    return null;
  },
  say(s, a, e) {
    const sd = own(s.sitdowns, e.sitdown);
    if (!sd || sd.state !== 'open') return 'no open sit-down';
    if (sd.a !== a.id && sd.b !== a.id) return 'not your sit-down';
    if (walled(s, sd.a, sd.b)) return UNREACHABLE;
    // R9: `agree` offers the other side's open offer back from the seat's own side (deals.mjs openOffer): an offer whose terms
    // are the deal's, so it names no terms of its own.
    if (e.agree === true && e.say != null && e.say !== 'offer') return 'agree sends an offer';
    if (e.agree === true && e.terms != null) return 'agree takes no terms: it sends their open offer back';
    if (e.agree !== true && !SAY_KINDS.includes(e.say)) return `a message is one of ${SAY_KINDS.join(', ')}`;
    if (a.msgs >= messageLimit(s, a.id)) return ['no messages left today', 'not-yet'];
    const o = e.agree === true ? openOffer(s, sd.id, a.id) : null;
    if (o && o.why) return [o.why, o.kind];
    return null;
  },
  offer(s, a, e) {
    const t = own(s.traits, e.trait);
    const night = s.day;
    if (!t) return 'no such trait';
    if (night > N.listLastNight) return 'the list is closed';
    if (t.opens > night) return [`${t.tier}s open on night ${t.opens}`, 'not-yet'];
    if (listLeft(s, t.id) === 0) return 'none left on the list';
    if (!Number.isInteger(e.amount) || e.amount < t.price) return `offer at least today's price, $${t.price}`;
    if (s.offers.some(o => o.by === a.id && o.trait === t.id)) return ['one offer per trait per night', 'not-yet'];
    if (a.cash < e.amount) return ['not enough cash', 'not-yet'];
    return null;
  },
  fence_buy(s, a, e) {
    const d = dealOf(s, e.deal);
    if (s.day >= N.nights) return 'the fence is closed on the last day';
    if (!d || d.kind !== 'listing') return 'no such listing';
    if (d.seller === a.id) return 'your own listing';
    if (d.buyer) return 'already bought';
    if (a.cash < d.price) return ['not enough cash', 'not-yet'];
    return null;
  },
  shop: (s, a, e) => orderWhy(s, a, e, 'shop'),
  sell: (s, a, e) => orderWhy(s, a, e, 'buyer'),
};

function orderWhy(s, a, e, side) {
  const items = marketItems(side);
  if (!items.includes(e.item)) return `the city's ${side} trades only ${items.join(', ')}`;
  const units = e.units == null ? 1 : e.units;
  if (!Number.isInteger(units) || units < 1) return 'at least one whole unit';
  const kind = e.item !== 'doses' ? e.item : e.drug == null ? 'temp' : e.drug;
  if (e.item === 'doses' && !DRUGS.includes(kind)) return `a dose is one of the drugs: ${DRUGS.join(', ')}`;
  if (side === 'shop') {
    const alone = runOf(side, e.item, s.market[side][e.item], units);
    if (!Number.isInteger(e.max)) return `name the most you pay, max: at least $${alone}, the price of ${units} alone today`;
    if (e.max < alone) return [`max at least $${alone}, the price of ${units} alone today`, 'not-yet'];
    if (a.cash < e.max) return ['not enough cash', 'not-yet'];
  } else {
    if ((a.goods[kind] || 0) < units) return ['not that many', 'not-yet'];
  }
  return null;
}

const HANDLERS = {
  // §10: choose what your agent wears tonight. The rest stays in your stash.
  dress(s, a, e, out) {
    const next = {};
    for (const [slot, k] of Object.entries(e.fit || {})) {
      if (k == null) continue;
      const why = pieceWhy(s, a, k);
      if (why) return why;
      if (s.copies[k].slot !== slot) return "that piece doesn't go in that slot";
      next[slot] = k;
    }
    a.outfit = next;
    const fit = Object.fromEntries(Object.keys(next).sort(byId).map(slot => [slot, s.copies[next[slot]].trait]));
    emit(s, out, 'wear', { agent: a.id, fit }, toFew(s, [a.id]));
    return null;
  },

  // §3: offer at or above today's price; the cash is held until the lock. One offer per trait per night.
  offer(s, a, e, out) {
    const why = ACTION_CHECKS.offer(s, a, e);
    if (why) return why;
    const t = own(s.traits, e.trait);
    a.cash -= e.amount;
    s.offers.push({ by: a.id, trait: t.id, amount: e.amount });
    emit(s, out, 'bid', { agent: a.id, trait: t.id, amount: e.amount }, toFew(s, [a.id]));
    return null;
  },

  // §10: hand over a piece, goods or cash to anyone, any time, with no protection.
  give(s, a, e, out) {
    const to = own(s.agents, e.to);
    if (!to || to.id === a.id) return 'no such agent';
    if (walled(s, to.id)) return UNREACHABLE;
    const goods = goodsOf(e.goods);
    if (!e.copy && e.cash == null && e.goods == null) return 'nothing to give';
    if (e.goods != null && !goods) return BAD_GOODS;
    const why = e.copy ? pieceWhy(s, a, e.copy) : null;
    if (why) return why;
    if (e.cash != null && !isCash(e.cash, a.cash)) return ['not that much cash', 'not-yet'];
    if (goods && !holdsGoods(a, goods)) return ['not that many goods', 'not-yet'];
    if (e.copy) moveCopy(s, e.copy, { k: 'agent', id: to.id }, 'give', { from: a.id });
    const sd = dealSitdown(e);
    const book = cashBook(s, a.id, to.id, e.cash || 0, sd);
    if (e.cash) {
      a.cash -= e.cash;
      to.cash += e.cash;
      if (book === 'promise') notePayment(s, a.id, to.id, e.cash);
    }
    if (goods) handOver(s, a, to, goods);
    // R5-deals: what it hands over against their deals, the one its sit-down names first; a promised cut is the
    // promise's.
    noteHandover(s, a.id, to.id, { goods, copy: e.copy || null, cash: book === 'deal' ? e.cash || 0 : 0, sitdown: sd });
    emit(s, out, 'give', {
      from: a.id, to: to.id, copy: e.copy || null, trait: e.copy ? s.copies[e.copy].trait : null, cash: e.cash || 0,
      ...withGoods(goods), ...(sd ? { sitdown: sd } : {}),
    }, toFew(s, [a.id, to.id]));
    return null;
  },

  // §10: pay anyone anything (a crew cut, a deal).
  pay(s, a, e, out) {
    const to = own(s.agents, e.to);
    if (!to || to.id === a.id) return 'no such agent';
    if (walled(s, to.id)) return UNREACHABLE;
    if (!isCash(e.amount, a.cash)) return ['not that much cash', 'not-yet'];
    const sd = dealSitdown(e);
    const why = PAY_FOR.includes(e.for) ? e.for : null;
    const book = cashBook(s, a.id, to.id, e.amount, sd, why);
    a.cash -= e.amount;
    to.cash += e.amount;
    if (book === 'promise') notePayment(s, a.id, to.id, e.amount);
    // R5-deals: a pay for a debt, a deal or nothing named counts against their deals, the one its sit-down names first;
    // a promised cut is the promise's.
    if (book === 'deal') noteHandover(s, a.id, to.id, { cash: e.amount, sitdown: sd });
    emit(s, out, 'pay', { from: a.id, to: to.id, amount: e.amount, for: why, ...(sd ? { sitdown: sd } : {}) }, toFew(s, [a.id, to.id]));
    return null;
  },

  // §13: anyone can pay bail, $100 a star, to get an agent out the next morning.
  bail(s, a, e, out) {
    const j = own(s.agents, e.agent);
    if (!j || !j.jail) return 'not in jail';
    const price = N.bailPerStar * j.jail.stars;
    if (a.cash < price) return ['not enough cash', 'not-yet'];
    a.cash -= price;
    cashOut(s, 'bail', price);
    j.jail = null;
    emit(s, out, 'bail', { by: a.id, agent: j.id, amount: price }, toFew(s, [a.id, j.id]));
    emit(s, out, 'release', { agent: j.id, why: 'bail' }, toAll(s));
    return null;
  },

  // §10: evicted until you pay. A crew stash with no home goes to the one it has now (GAP gap.crewStash).
  rent(s, a, e, out) {
    const why = ACTION_CHECKS.rent(s, a, e);
    if (why) return why;
    a.cash -= N.rent;
    cashOut(s, 'rent', N.rent);
    a.evicted = false;
    if (a.crew) rehome(s, s.crews[a.crew]);
    emit(s, out, 'rent', { agent: a.id, amount: N.rent }, toFew(s, [a.id]));
    emit(s, out, 'evicted', { agent: a.id, on: false }, toAll(s));
    return null;
  },

  // §12: crews of up to 4, with a name and a shared stash kept at one member's home (GAP: how crews form).
  crew_form(s, a, e, out) {
    if (a.crew) return 'already in a crew';
    const id = `c${s.nextId.crew++}`;
    const name = (typeof e.name === 'string' && e.name.trim() ? e.name.trim() : id).slice(0, 40);
    s.crews[id] = { id, name, members: [a.id], keeper: a.id, cash: 0, goods: {}, invites: [], put: {}, putGoods: {}, took: {} };
    a.crew = id;
    emit(s, out, 'crew', { act: 'form', crew: id, name, agent: a.id }, toAll(s));
    return null;
  },
  crew_invite(s, a, e, out) {
    const c = s.crews[a.crew];
    const t = own(s.agents, e.agent);
    if (!c) return 'not in a crew';
    if (!t || t.id === a.id) return 'no such agent';
    if (walled(s, t.id)) return UNREACHABLE;
    if (t.crew) return ['already in a crew', 'not-yet'];
    if (c.members.length >= N.crewMax) return ['the crew is full', 'not-yet'];
    if (!c.invites.includes(t.id)) c.invites.push(t.id);
    emit(s, out, 'crew', { act: 'invite', crew: c.id, agent: t.id, by: a.id }, toFew(s, [...c.members, t.id]));
    return null;
  },
  crew_join(s, a, e, out) {
    const c = own(s.crews, e.crew);
    if (a.crew) return 'already in a crew';
    if (!c) return 'no such crew';
    if (!c.invites.includes(a.id)) return ['not invited', 'not-yet'];
    if (c.members.length >= N.crewMax) return ['the crew is full', 'not-yet'];
    c.invites = c.invites.filter(x => x !== a.id);
    c.members = [...c.members, a.id].sort(byId);
    a.crew = c.id;
    rehome(s, c);
    emit(s, out, 'crew', { act: 'join', crew: c.id, agent: a.id }, toAll(s));
    return null;
  },
  crew_leave(s, a, e, out) {
    const c = s.crews[a.crew];
    if (!c) return 'not in a crew';
    c.members = c.members.filter(x => x !== a.id);
    a.crew = null;
    emit(s, out, 'crew', { act: 'leave', crew: c.id, agent: a.id }, toAll(s));
    if (!c.members.length) {
      // The last one out takes what's left.
      for (const k of crewPieces(s, c.id)) moveCopy(s, k, { k: 'agent', id: a.id }, 'stash_take', { crew: c.id });
      a.cash += c.cash;
      moveGoods(c, a, { ...c.goods });
      delete s.crews[c.id];
      emit(s, out, 'crew', { act: 'dissolve', crew: c.id, agent: a.id }, toAll(s));
    } else {
      rehome(s, c);
    }
    return null;
  },

  // §10, §12: the crew stash: put in or take out. Anyone in the crew can take from it.
  stash_put(s, a, e, out) {
    const c = s.crews[a.crew];
    if (!c) return 'not in a crew';
    const goods = goodsOf(e.goods);
    if (!e.copy && e.cash == null && e.goods == null) return 'nothing to put in';
    if (e.goods != null && !goods) return BAD_GOODS;
    const why = e.copy ? pieceWhy(s, a, e.copy) : null;
    if (why) return why;
    if (e.cash != null && !isCash(e.cash, a.cash)) return ['not that much cash', 'not-yet'];
    if (goods && !holdsGoods(a, goods)) return ['not that many goods', 'not-yet'];
    if (e.copy) moveCopy(s, e.copy, { k: 'crew', id: c.id }, 'stash_put', { by: a.id });
    if (e.cash) {
      a.cash -= e.cash;
      c.cash += e.cash;
      c.put[a.id] = (c.put[a.id] || 0) + e.cash;
    }
    if (goods) {
      moveGoods(a, c, goods);
      notePut(c, a.id, goods, 1);
    }
    emit(s, out, 'stash', { act: 'put', crew: c.id, agent: a.id, copy: e.copy || null, trait: e.copy ? s.copies[e.copy].trait : null, cash: e.cash || 0, ...withGoods(goods) }, toFew(s, c.members));
    return null;
  },
  stash_take(s, a, e, out) {
    const c = s.crews[a.crew];
    if (!c) return 'not in a crew';
    const goods = goodsOf(e.goods);
    if (!e.copy && e.cash == null && e.goods == null) return 'nothing to take';
    if (e.goods != null && !goods) return BAD_GOODS;
    if (e.copy && !(own(s.copies, e.copy) && s.copies[e.copy].holder.k === 'crew' && s.copies[e.copy].holder.id === c.id)) return "that piece isn't in the crew stash";
    if (e.cash != null && !isCash(e.cash, c.cash)) return ['not that much cash in the stash', 'not-yet'];
    if (goods && !holdsGoods(c, goods)) return ['not that many goods in the stash', 'not-yet'];
    const took = (c.took[a.id] ||= { copies: [], cash: 0, goods: {} });
    if (e.copy) {
      const putBy = [...s.copies[e.copy].hist].reverse().find(h => h.what === 'stash_put');
      took.copies.push({ copy: e.copy, putBy: putBy ? putBy.by : null });
      moveCopy(s, e.copy, { k: 'agent', id: a.id }, 'stash_take', { crew: c.id });
    }
    if (e.cash) {
      c.cash -= e.cash;
      a.cash += e.cash;
      c.put[a.id] = (c.put[a.id] || 0) - e.cash;
      took.cash += e.cash;
    }
    if (goods) {
      moveGoods(c, a, goods);
      notePut(c, a.id, goods, -1);
      for (const [k, n] of Object.entries(goods)) addGoods(took, k, n);
    }
    emit(s, out, 'stash', { act: 'take', crew: c.id, agent: a.id, copy: e.copy || null, trait: e.copy ? s.copies[e.copy].trait : null, cash: e.cash || 0, ...withGoods(goods) }, toFew(s, c.members));
    // §12 rug (GAP, typed): today's takes empty the stash and include another member's piece, or more cash (or more
    // of a kind of goods) than the taker ever put in.
    const empty = c.cash === 0 && crewPieces(s, c.id).length === 0 && !Object.keys(c.goods).length;
    const others = took.copies.filter(x => x.putBy && x.putBy !== a.id);
    const overGoods = Object.values(c.putGoods[a.id] || {}).some(n => n < 0);
    if (empty && c.members.length > 1 && (others.length || (c.put[a.id] || 0) < 0 || overGoods)) {
      const victims = c.members.filter(m => m !== a.id);
      emit(s, out, 'betray', {
        kind: 'rug', by: a.id, victims, crew: c.id, copies: took.copies.map(x => x.copy), cash: took.cash,
        ...withGoods(Object.keys(took.goods).length ? sortGoods(took.goods) : null),
      }, toFew(s, [a.id, ...victims]));
    }
    return null;
  },

  // §14: sit-downs. Asking uses one of the day's messages; the other can say no. R4-3 (sitdownDays): a sit-down stays
  // open sitdownDays days, counting the day it's asked, unless either side closes it first, so two owners who look in at
  // different hours can finish a deal across the days; a pair has one at a time.
  ask(s, a, e, out) {
    const b = own(s.agents, e.to);
    if (!b || b.id === a.id) return 'no such agent';
    if (walled(s, a.id, b.id)) return UNREACHABLE;
    if (a.msgs >= messageLimit(s, a.id)) return ['no messages left today', 'not-yet'];
    const already = Object.values(s.sitdowns).some(sd => sd.state !== 'declined'
      && ((sd.a === a.id && sd.b === b.id) || (sd.a === b.id && sd.b === a.id)));
    if (already) return ['you already have a sit-down with them', 'not-yet'];
    const id = `s${s.nextId.sitdown++}`;
    s.sitdowns[id] = { id, a: a.id, b: b.id, day: s.day, until: s.day + N.sitdownDays - 1, state: 'asked', listeners: [], said: [], met: null, acted: { day: s.day, ids: [a.id] } };
    a.msgs += 1;
    emit(s, out, 'ask', { sitdown: id, from: a.id, to: b.id, line: line(e.line) }, toFew(s, [a.id, b.id]));
    return null;
  },
  answer(s, a, e, out) {
    const why = ACTION_CHECKS.answer(s, a, e);
    if (why) return why;
    const sd = own(s.sitdowns, e.sitdown);
    a.msgs += 1;
    sd.state = e.accept ? 'open' : 'declined';
    if (e.accept) {
      if (line(e.line)) speak(s, sd, a.id, 'answer', {}, e.line, out);
      else act(s, sd, a.id, out);
    } else {
      emit(s, out, 'decline', { sitdown: sd.id, from: a.id, to: sd.a, line: line(e.line) }, toFew(s, [sd.a, sd.b]));
    }
    return null;
  },
  // Every message is typed (ask, offer, promise, threat or answer, with its terms), plus one line of free text.
  // Talk binds nobody (§14); a promise is only remembered, so a broken one can be a betrayal (§12).
  say(s, a, e, out) {
    const why = ACTION_CHECKS.say(s, a, e);
    if (why) return why;
    const sd = own(s.sitdowns, e.sitdown);
    // R9: agree is an offer of the other side's open offer, from the seat's side; everything after is any say's.
    const say = e.agree === true ? 'offer' : e.say;
    const terms = termsOf(s, e.agree === true ? openOffer(s, sd.id, a.id).terms : e.terms);
    a.msgs += 1;
    const other = sd.a === a.id ? sd.b : sd.a;
    speak(s, sd, a.id, say, terms, e.line, out);
    // R5-deals: an offer of a trade states the sit-down's deal (deals.mjs).
    if (say === 'offer') stateDeal(s, sd, a.id, terms);
    if (say === 'promise' && terms.what && terms.night) {
      s.promises.push({
        id: `p${s.nextId.promise++}`, by: a.id, to: other, what: terms.what, who: terms.who || other, night: terms.night,
        cash: terms.cash || 0, paid: 0, due: null, settled: false, day: s.day,
        // R5-terms: the message that made it, its sit-down and its place there, so a view reads that message's state
        // from the promise itself (view.mjs).
        sitdown: sd.id, message: sd.said.length - 1,
      });
    }
    return null;
  },
  // §14 (R4-3): either side can close a sit-down, asked or open, any time, and it uses no message. The two of them, and
  // anyone listening, are told now, and everyone 24 hours later, as its words are (§19).
  close(s, a, e, out) {
    const sd = own(s.sitdowns, e.sitdown);
    if (!sd || sd.state === 'declined') return 'no such sit-down';
    if (sd.a !== a.id && sd.b !== a.id) return 'not your sit-down';
    delete s.sitdowns[sd.id];
    // R5-deals: its deals go on only where one side owes the other.
    endDeals(s, sd.id);
    emit(s, out, 'close', { sitdown: sd.id, a: sd.a, b: sd.b, by: a.id, why: 'closed' }, toFew(s, [sd.a, sd.b, ...sd.listeners]));
    return null;
  },
  // §4 placeholder, the earpiece: once a day, read one sit-down between other agents live, not 24 hours later. It hears
  // that sit-down until dawn (R4-3: a sit-down lasts, the earpiece's day doesn't).
  listen(s, a, e, out) {
    const sd = own(s.sitdowns, e.sitdown);
    if (!wears(s, a.id, 'earpiece')) return 'that takes the earpiece';
    if (a.listening === s.day) return ['once a day', 'not-yet'];
    if (!sd || sd.state !== 'open') return 'no open sit-down';
    if (sd.a === a.id || sd.b === a.id) return 'you are in that one';
    sd.listeners.push(a.id);
    a.listening = s.day;
    emit(s, out, 'overheard', { sitdown: sd.id, agent: a.id, a: sd.a, b: sd.b, said: sd.said.map(m => ({ ...m })) }, toFew(s, [a.id]));
    return null;
  },
  // §14, §19 (Q6): crew chat, a sit-down's message (its kind, its terms and one line) to the whole crew, one of the
  // day's messages. The crew and its owners read it now, everyone 24 hours later; a member on FIREWALL isn't reached
  // until then, though what it sends still goes. Talk binds nobody: a promise here records none (GAP gap.chat).
  chat(s, a, e, out) {
    const c = s.crews[a.crew];
    if (!c) return 'not in a crew';
    if (!SAY_KINDS.includes(e.say)) return `a message is one of ${SAY_KINDS.join(', ')}`;
    if (a.msgs >= messageLimit(s, a.id)) return ['no messages left today', 'not-yet'];
    a.msgs += 1;
    const reached = c.members.filter(m => m === a.id || !walled(s, m));
    emit(s, out, 'chat', { crew: c.id, from: a.id, say: e.say, terms: termsOf(s, e.terms), line: line(e.line) }, toFew(s, reached));
    return null;
  },
  // §14, §19 (Q7): out loud, a line for everyone: its kind (a threat, a boast or an offer), a sit-down's terms and
  // one line, outLoud a day each, apart from the day's messages. Public at once and on the board for the day (GAP
  // gap.outloud).
  outloud(s, a, e, out) {
    if (!LOUD_KINDS.includes(e.say)) return `out loud is one of ${LOUD_KINDS.join(', ')}`;
    if ((a.outLoud || 0) >= N.outLoud) return ['no out-loud lines left today', 'not-yet'];
    a.outLoud = (a.outLoud || 0) + 1;
    emit(s, out, 'outloud', { agent: a.id, say: e.say, terms: termsOf(s, e.terms), line: line(e.line) }, toAll(s));
    return null;
  },

  // §9, §10: the fence. A listing puts a piece up at a price, on the board without its seller; the first buyer gets it,
  // its cash held until the lock, and a bought listing is final. The piece comes off the outfit and stays with its seller
  // until it sells (GAP gap.listed). No new deals on the last day (GAP gap.fence).
  fence_list(s, a, e, out) {
    if (s.day >= N.nights) return 'the fence is closed on the last day';
    const why = pieceWhy(s, a, e.copy);
    if (why) return why;
    if (s.copies[e.copy].fake) return NO_FAKES;
    if (!Number.isInteger(e.price) || e.price < 1) return 'a price is whole dollars';
    const d = newDeal(s, { kind: 'listing', seller: a.id, copy: e.copy, price: e.price, buyer: null });
    const slot = s.copies[e.copy].slot;
    if (a.outfit[slot] === e.copy) delete a.outfit[slot];
    emit(s, out, 'fence', { act: 'list', deal: d.id, agent: a.id, copy: e.copy, trait: s.copies[e.copy].trait, price: e.price }, toFew(s, [a.id]));
    return null;
  },
  // Unlisting ends the listing; the piece never left.
  fence_unlist(s, a, e, out) {
    const d = dealOf(s, e.deal);
    if (!d || d.kind !== 'listing' || d.seller !== a.id) return 'not your listing';
    if (d.buyer) return 'already bought';
    delete s.fence.deals[d.id];
    emit(s, out, 'fence', { act: 'unlist', deal: d.id, agent: a.id, copy: d.copy, trait: s.copies[d.copy].trait }, toFew(s, [a.id]));
    return null;
  },
  fence_buy(s, a, e, out) {
    const why = ACTION_CHECKS.fence_buy(s, a, e);
    if (why) return why;
    const d = dealOf(s, e.deal);
    d.buyer = a.id;
    hold(s, a, d.id, d.price);
    emit(s, out, 'fence', { act: 'buy', deal: d.id, agent: a.id, trait: s.copies[d.copy].trait, price: d.price }, toFew(s, [a.id]));
    return null;
  },
  // A swap: one agent puts its half up for a named agent's, who accepts by putting up the half asked for. What a half
  // asks for is checked only when it's put up, so an offer can't learn what another agent holds.
  fence_swap(s, a, e, out) {
    if (s.day >= N.nights) return 'the fence is closed on the last day';
    const b = own(s.agents, e.to);
    if (!b || b.id === a.id) return 'no such agent';
    if (walled(s, b.id)) return UNREACHABLE;
    const [give, get] = [halfOf(s, e.give), halfOf(s, e.get)];
    if (!give || !get) return `each half holds something: pieces, cash, or ${BAD_GOODS}`;
    // §11: HALLU's lots stay with their holders, so the fence takes none (GAP gap.hallu).
    if (give.goods.hallu || get.goods.hallu) return 'the fence takes no HALLU';
    if (give.pieces.some(k => get.pieces.includes(k))) return 'a piece on both sides';
    const why = canPut(s, a, give);
    if (why) return why;
    const d = newDeal(s, { kind: 'swap', a: a.id, b: b.id, give, get, accepted: false });
    putUp(s, a, d.id, give);
    emit(s, out, 'fence', { act: 'swap', deal: d.id, a: a.id, b: b.id, give: copyHalf(give), get: copyHalf(get) }, toFew(s, [a.id, b.id]));
    return null;
  },
  fence_accept(s, a, e, out) {
    const d = dealOf(s, e.deal);
    if (!d || d.kind !== 'swap' || d.b !== a.id) return 'no such swap for you';
    if (d.accepted) return 'already accepted';
    const why = canPut(s, a, d.get);
    if (why) return why;
    d.accepted = true;
    putUp(s, a, d.id, d.get);
    emit(s, out, 'fence', { act: 'accept', deal: d.id, a: d.a, b: d.b }, toFew(s, [d.a, d.b]));
    return null;
  },

  // §9, §10: buy chems, parts or guns from the city's shop, or sell chems, parts or doses to its buyer; R4-3: as orders,
  // filled at the lock.
  shop: (s, a, e, out) => cityOrder(s, a, e, out, 'shop'),
  sell: (s, a, e, out) => cityOrder(s, a, e, out, 'buyer'),

  // §13: tip the cops, once a day: name another agent and the target of its play tonight, an agent, the crate or (layer
  // 4, call 6) the vault (corners and collars can't be tipped). The tipper's own now, everyone's 24 hours later (§19); it
  // lasts until dawn (GAP gap.tip).
  tip(s, a, e, out) {
    if (s.tips.some(t => t.by === a.id)) return ['one tip a day', 'not-yet'];
    if (!isAgent(s, e.agent) || e.agent === a.id) return 'no such agent';
    if (![CRATE, VAULT].includes(e.target) && (!isAgent(s, e.target) || e.target === e.agent)) return 'name its target: an agent, the crate or the vault';
    s.tips.push({ by: a.id, agent: e.agent, target: e.target });
    emit(s, out, 'tip', { by: a.id, agent: e.agent, target: e.target }, toFew(s, [a.id]));
    return null;
  },
  // §13, §38: a bribe keeps the city cops out of one fight tonight, named by its target (an agent, the crate, the vault or
  // a corner), at the price for the briber's stars; nothing buys off 5. It covers only a fight the briber is in, and the
  // cash leaves the island, with no refunds (GAP gap.bribe).
  bribe(s, a, e, out) {
    const price = N.bribe[a.heat];
    const fight = [CRATE, VAULT].includes(e.target) || isAgent(s, e.target) || !!own(N.corners, e.target);
    if (!fight) return 'name a fight: an agent, the crate, the vault or a corner';
    if (price == null) return ['nothing buys off 5 stars', 'not-yet'];
    if (s.bribes.some(b => b.by === a.id && b.target === e.target)) return ['you already bribed for that fight', 'not-yet'];
    if (a.cash < price) return ['not enough cash', 'not-yet'];
    a.cash -= price;
    cashOut(s, 'bribe', price);
    s.bribes.push({ by: a.id, target: e.target });
    emit(s, out, 'bribe', { by: a.id, target: e.target, stars: a.heat, price }, toFew(s, [a.id]));
    return null;
  },

  // §10: post a bounty: cash on one piece (a copy, wherever it is) or another agent, on the board at once and never
  // withdrawn. The fence holds the cash where the list holds offers (§22) until a fight earns it or night 14 (GAP
  // gap.bounty). The posting is the poster's own now and everyone's 24 hours later (§19).
  bounty(s, a, e, out) {
    const on = e.copy != null ? { copy: e.copy } : { agent: e.agent };
    const named = on.copy != null ? !!own(s.copies, on.copy) && e.agent == null : isAgent(s, on.agent) && on.agent !== a.id;
    if (!named) return 'name one piece or another agent';
    if (!Number.isInteger(e.amount) || e.amount < 1) return 'a bounty is whole dollars';
    if (a.cash < e.amount) return ['not enough cash', 'not-yet'];
    const b = { id: `b${s.nextId.bounty++}`, by: a.id, on, amount: e.amount };
    a.cash -= b.amount;
    s.offers.push({ by: a.id, bounty: b.id, amount: b.amount });
    s.bounties.push(b);
    emit(s, out, 'bounty', { act: 'post', bounty: b.id, by: a.id, ...on, amount: b.amount }, toFew(s, [a.id]));
    return null;
  },
  // §10, §38: hire a lookout: another agent's stash and cash now, as its holdings record would show them, for the
  // hirer alone, and its target isn't told; everyone sees it 24 hours later (§19). Its drugs show only as doses (§11:
  // a drug's name never shows live). The price leaves the island (GAP gap.lookout).
  lookout(s, a, e, out) {
    if (!isAgent(s, e.agent) || e.agent === a.id) return 'no such agent';
    if (a.cash < N.lookout) return ['not enough cash', 'not-yet'];
    a.cash -= N.lookout;
    cashOut(s, 'lookout', N.lookout);
    const h = holdingsOf(s, e.agent);
    const crew = h.crew && { ...h.crew, goods: drugsAsDoses(h.crew.goods) };
    emit(s, out, 'look', { by: a.id, ...h, goods: drugsAsDoses(h.goods), crew }, toFew(s, [a.id]));
    // §11: what a look showed is never news to a HALLU lead (GAP gap.hallu).
    learn(a, factsOf(s, e.agent));
    return null;
  },

  // §11: take a dose of a drug you hold, one of each drug a day, in jail too; it leaves the island's goods as `taken`.
  // The take is the agent's own now and everyone's 24 hours later; a walk it changes on the board is public at once; and
  // CLEAR wipes what the agent learned before it (GAP gap.take, gap.high, gap.clear).
  // §11's mind drugs: TRUTH locks the play the take names, one of tonight's legal plays once the dose is taken (GAP
  // gap.truth); HALLU brings its leads, the taker's own now and everyone's 24 hours later (GAP gap.hallu); nobody takes
  // SUDO on purpose, but a TEMP taken while the agent carries a mark is SUDO, written by the oldest mark's giver, who
  // sees the take at once (GAP gap.sudo).
  take(s, a, e, out) {
    if (!DRUGS.includes(e.drug)) return `name a drug: ${DRUGS.join(', ')}`;
    if (e.drug === 'sudo') return 'nobody takes SUDO on purpose';
    if (tookToday(a, e.drug)) return ['one dose of each drug a day', 'not-yet'];
    if (!a.goods[e.drug]) return ['no dose of that drug', 'not-yet'];
    const walk = walkOf(s, a.id);
    const writer = e.drug === 'temp' && a.marks ? a.marks.shift() : null;
    const drug = writer ? 'sudo' : e.drug;
    const lots = addGoods(a, e.drug, -1);
    bookGoods(s, 'out', 'taken', e.drug, 1);
    a.high = DRUGS.filter(d => d === drug || a.high.includes(d));
    const lock = e.drug === 'truth' ? lockOf(s, a.id, e.play, s.day) : null;
    if (lock && !lock.ok) return [lock.why, lock.kind];
    if (lock) a.locked = lock.play;
    if (writer) a.writer = writer;
    const more = { ...(writer ? { writer } : {}), ...(drug === 'hallu' ? { leads: leadsFor(s, a, lots) } : {}) };
    const took = emit(s, out, 'take', { agent: a.id, drug, ...more }, toFew(s, [a.id, ...(writer ? [writer] : [])]));
    if (e.drug === 'clear') clearMemory(s, a.id, out);
    if (e.drug === 'clear') a.wiped = { n: took.n, day: s.day, said: Object.fromEntries(Object.values(s.sitdowns).map(sd => [sd.id, sd.said.length])) };
    if (walkOf(s, a.id) && walkOf(s, a.id) !== walk) emit(s, out, 'high', { agent: a.id, walk: walkOf(s, a.id) }, toAll(s));
    return null;
  },
  // §11, SUDO: the mark's giver writes its taker's play tonight, checked as the taker's play now and again at the lock;
  // the last one written stands. SUDO can't keep anyone off the ferry, so no write goes through on a night whose arrest
  // would still hold its taker when the ferry leaves (R4-4, GAP gap.ferryJail): under 'released' night 14 alone, under
  // 'missed' from day nights − jailNights on. The write is the writer's own until tonight's plays go public, and it goes
  // through even to a taker on FIREWALL, whose lock ignores it (GAP gap.sudo).
  write(s, a, e, out) {
    const t = own(s.agents, e.agent);
    if (!t) return 'no such agent';
    if (t.writer !== a.id) return ['not yours to write', 'not-yet'];
    if (s.day >= offBoatFrom()) return "SUDO can't keep anyone off the ferry";
    const r = checkPlay(s, t.id, e.play, s.day);
    if (!r.ok) return [r.why, r.kind];
    t.written = r.play;
    emit(s, out, 'write', { by: a.id, agent: t.id, play: onRecord(r.play) }, toFew(s, [a.id], 3));
    return null;
  },
};

// §14, §19: who meets whom is public at once (the city shows the meeting). R4-3: a pair sits down on a day both of them
// act in the sit-down, the ask and its answer, or a word each in one that lasts, and that day's meeting is public when
// the second of them acts. One side alone makes no meeting (R4-3's review: an old partner's one word showed it the
// other's hidden fit and its TRUTH play).
function act(s, sd, id, out) {
  if (!sd.acted || sd.acted.day !== s.day) sd.acted = { day: s.day, ids: [] };
  if (!sd.acted.ids.includes(id)) sd.acted.ids.push(id);
  if (sd.state !== 'open' || sd.met === s.day || ![sd.a, sd.b].every(x => sd.acted.ids.includes(x))) return;
  sd.met = s.day;
  emit(s, out, 'meet', { sitdown: sd.id, a: sd.a, b: sd.b }, toAll(s));
}

// §9 (R4-3): shop and sell are orders by day, and the day's orders on each of the city's curves fill together at the
// lock, every unit moving the price one step and every order paying or getting the same price a unit (night.mjs,
// clearMarket). A sell order hands its goods over now. A shop order names the most it pays, at least its units' price
// alone at today's step, and that cash is held until the lock, as an offer on the list is (§3). An order is final until
// the lock, and its agent's own now and everyone's 24 hours later (GAP gap.marketOrder, gap.marketSeen). Doses are one
// curve: a sale names its drug, or sells TEMP (GAP gap.doses).
function cityOrder(s, a, e, out, side) {
  const why = orderWhy(s, a, e, side);
  if (why) return why;
  const units = e.units == null ? 1 : e.units;
  const kind = e.item !== 'doses' ? e.item : e.drug == null ? 'temp' : e.drug;
  const cash = side === 'shop' ? e.max : 0;
  if (side === 'shop') a.cash -= cash;
  else addGoods(a, kind, -units);
  const drug = e.item === 'doses' && e.drug != null ? { drug: kind } : {};
  const o = { id: `o${s.nextId.order++}`, by: a.id, side, item: e.item, kind, units, cash, day: s.day, ...drug };
  s.orders.push(o);
  emit(s, out, 'order', { act: 'place', order: o.id, agent: a.id, side, item: e.item, units, ...(side === 'shop' ? { max: cash } : {}), ...drug }, toFew(s, [a.id]));
  return null;
}

// A precondition receipt for the operations covered by this contract. applyErrand remains the final authority for
// the post-operation TRUTH invariant, including rollback. Unsupported operations are explicit, never assumed legal.
export function checkAction(s, e) {
  let why;
  if (!e || !own(s.agents, e.by)) why = 'no such agent';
  else if (s.over) why = ['the season is over', 'never'];
  else if (s.clock % 2 !== 0) why = ['errands happen by day', 'not-yet'];
  else if (!own(ACTION_CHECKS, e.kind)) why = ['no action-state contract for this errand', 'unsupported'];
  else why = ACTION_CHECKS[e.kind](s, s.agents[e.by], e);
  if (!why) return { scope: 'preconditions', ok: true };
  const [reason, kind] = Array.isArray(why) ? why : [why, 'never'];
  return { scope: 'preconditions', ok: false, why: reason, kind };
}

// Standalone quantity quote at the published curve step. Other agents' pending orders never enter this quote.
// `max` is an explicit whole-order cash cap, held now; the eventual common clearing price can move beyond it.
export function marketQuote(s, id, e) {
  const side = e.kind === 'shop' ? 'shop' : e.kind === 'sell' ? 'buyer' : null;
  const item = side && marketItems(side).includes(e.item) ? e.item : null;
  const requested = e.units == null ? 1 : e.units;
  const units = Number.isInteger(requested) && requested > 0 ? requested : null;
  const valid = item !== null && units !== null;
  const total = valid ? runOf(side, item, s.market[side][item], units) : null;
  return {
    side, item, quantity: units, total, steps: valid ? s.market[side][item] : null,
    unit: valid ? priceOf(side, item, s.market[side][item]) : null,
    cashRequired: side === 'shop' ? e.max == null ? total : Number.isInteger(e.max) ? e.max : null : 0,
    check: checkAction(s, { by: id, kind: e.kind, item: e.item, units: e.units, max: e.max, drug: e.drug }), settles: 'lock', clearingMayChange: true,
  };
}

// Typed owner facts only. Own escrow is already removed from spendable cash; tab is a separate dock obligation.
// No words, counterpart inventory, pending bids/orders or concealed fence seller appear in this allow-list.
export function actionState(s, id) {
  const a = own(s.agents, id);
  if (!a) throw new Error(`no agent ${id}`);
  const orders = (s.orders || []).filter(o => o.by === id).map(o => ({
    order: o.id, side: o.side, item: o.item, units: o.units, reservedCash: o.cash,
    reservedGoods: o.side === 'buyer' ? { [o.kind]: o.units } : {}, settles: 'lock', status: 'placed',
  }));
  const reserved = orders.reduce((n, o) => n + o.reservedCash, 0)
    + s.offers.filter(o => o.by === id).reduce((n, o) => n + o.amount, 0);
  return {
    scope: 'preconditions', constraints: { lockedPlay: a.locked ? clone(onRecord(a.locked)) : null },
    cash: { spendable: a.cash, reserved, dueAtDock: a.tab },
    rent: { housed: !a.evicted, restore: { ...checkAction(s, { by: id, kind: 'rent' }), cost: N.rent },
      automaticDawn: N.rent, jailedExempt: true, tab: a.tab },
    invitations: Object.values(s.sitdowns).filter(sd => sd.a === id || sd.b === id).sort((x, y) => byId(x.id, y.id)).map(sd => ({
      sitdown: sd.id, state: sd.state,
      answer: checkAction(s, { by: id, kind: 'answer', sitdown: sd.id }),
      say: checkAction(s, { by: id, kind: 'say', sitdown: sd.id, say: 'answer' }),
      // R9: the one-step accept of the other side's open offer, the same contract a human's app shows as its button.
      agree: checkAction(s, { by: id, kind: 'say', sitdown: sd.id, agree: true }),
    })),
    market: Object.fromEntries(['shop', 'buyer'].map(side => [side, Object.fromEntries(marketItems(side).map(item => {
      const total = runOf(side, item, s.market[side][item], 1);
      const kind = side === 'shop' ? 'shop' : 'sell';
      const quote = marketQuote(s, id, { kind, item, units: 1, ...(side === 'shop' ? { max: total } : {}) });
      const two = runOf(side, item, s.market[side][item], 2);
      return [item, { ...quote, quotes: [marketQuote(s, id, { kind, item, units: 2, ...(side === 'shop' ? { max: two } : {}) })] }];
    }))])),
    orders,
    offers: Object.values(s.traits).sort((x, y) => byId(x.id, y.id)).map(t => ({
      trait: t.id, minimum: t.price, held: s.offers.find(o => o.by === id && o.trait === t.id)?.amount || 0,
      available: checkAction(s, { by: id, kind: 'offer', trait: t.id, amount: t.price }),
    })),
    fence: { open: !s.over && s.clock % 2 === 0 && s.day < N.nights,
      buy: fenceBoard(s).map(d => ({ deal: d.deal, price: d.price, ...checkAction(s, { by: id, kind: 'fence_buy', deal: d.deal }) })) },
  };
}

// Record one already-charged speech message. Acceptance uses precisely this same storage, visibility and meeting path
// as say, but its words carry no commercial terms and consume no second message.
function speak(s, sd, from, say, terms, words, out) {
  const other = sd.a === from ? sd.b : sd.a;
  const msg = { from, say, terms, line: line(words) };
  sd.said.push({ ...msg, day: s.day });
  act(s, sd, from, out);
  emit(s, out, 'say', { sitdown: sd.id, to: other, ...msg }, toFew(s, [from, other, ...sd.listeners]));
}
