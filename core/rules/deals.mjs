// R5-deals: a sit-down's deal (GAME.md §10, §14), a typed fact the core owns, so each side reads where the deal stands
// from the rules, never from words or its own memory.
// - An `offer` whose typed terms trade goods (or a piece) for cash offers a deal: `what: 'trade'` (said `buy`, R5-terms;
//   errand.mjs TERM_SAID) to buy them, its speaker the buyer; `what: 'sell'` to sell them. The latest offer in a
//   sit-down stands.
// - A deal needs both sides (Claude's call, under slime's go of 10-17): an offer is agreed once the other side offers the
//   same terms back, or hands over its own half against them (the goods, when the terms make it the seller; the cash,
//   when they make it the buyer). Words alone agree nothing: an `answer` with the same terms is only words.
// - R5-terms (the orchestrator's call, 10-18): the same terms back are either form. The other side of them (a sell
//   against a buy) agrees, and so does the very same terms repeated word for word (an echo, a buy against a buy). Either
//   way the deal agreed is the offer as its offerer made it, never the one the echo's own words would make. Only an
//   open offer the other side made in this sit-down, before any night it names is played, can be agreed so. An agreed
//   deal nothing was handed over against, offered again on its own terms in either form, stays as it stands.
// - The core counts what each side hands the other against a deal, by the `give` and `pay` errands: the goods or the
//   piece one way, the cash the other, and a return of either back again. A hand-over goes to the deal its `sitdown`
//   names; else to the one whose terms it matches (what is still due, exactly), else the newest that can take it. A pay
//   for a crew's cut or a gift counts for nothing, and so does cash that is exactly a promised cut still unpaid, naming
//   no sit-down (§12 counts it against the promise; errand.mjs `forPromise`); a SUDO counts as the TEMP it arrives as
//   (§11).
// - Only an agreed deal is owed. What an offerer hands over against its own offer, unagreed, is its own risk (§10: pay
//   first and they can walk): nobody owes it, and the other side reads it as a plain receipt for the day.
// - The first hand-over against an unagreed offer can read its terms the other way round: goods or a piece it names,
//   handed over by the side the terms make the buyer (an offer to sell written as `trade`), make that side the seller.
//   Cash never turns a deal round, and handing over against one's own offer never agrees it.
// - Nothing moves by itself: every give and pay stays an errand either side can skip, and no term binds anyone (§14:
//   talk binds nobody). The deal only counts.
// - An agreed deal stays on the record until it settles: both halves handed over in full, or, once its sit-down is
//   over, each side's half in step with the other's (the cash due for the goods given, and the goods due for the cash
//   paid, in whole units and dollars). An unagreed offer, and an agreed deal nothing was handed over against, end with
//   their sit-down. Once anything is handed over against an agreed deal, its terms stand: a new offer in that sit-down
//   makes a new deal.
// - §11, CLEAR keeps a deal, as it keeps a promise (gap.clear): its taker's view still holds it, and only what the deal
//   itself holds (its terms, its counts, when they last moved), never the give and pay events CLEAR wiped.
// Pure, as the rest of the rules: the deals live in the state (`s.deals`, made when the first is offered).
import { sortGoods } from './state.mjs';

// The terms that offer a deal (errand.mjs's TERM_WHAT holds them): the speaker buys, or sells.
export const DEAL_WHAT = ['trade', 'sell'];

const sum = g => Object.values(g || {}).reduce((t, n) => t + n, 0);
// A deal's units: its goods, or its one piece; and those handed over so far.
const unitsOf = d => (d.piece ? 1 : sum(d.goods));
const givenOf = d => (d.piece ? (d.gave ? 1 : 0) : sum(d.given));
// The cash due for the goods given, and the goods due for the cash paid, at the deal's terms, rounded down.
const cashDue = d => Math.floor((d.cash * givenOf(d)) / unitsOf(d));
const goodsDue = d => Math.floor((unitsOf(d) * Math.min(d.paid, d.cash)) / d.cash);
// Who owes the other on an agreed deal now: 'buyer' (goods came, their cash didn't), 'seller' (cash came, its goods
// didn't), or null; an unagreed offer is owed by nobody.
const owedBy = d => (!d.agreed ? null : d.paid < cashDue(d) ? 'buyer' : givenOf(d) < goodsDue(d) ? 'seller' : null);
const complete = d => givenOf(d) >= unitsOf(d) && d.paid >= d.cash;
const handed = d => givenOf(d) > 0 || d.paid > 0;
// What stays on the record: an agreed deal until it settles; an unagreed offer while its sit-down is open.
const live = d => (d.agreed ? !complete(d) && (d.open || owedBy(d) !== null) : d.open);
// R9 (the dealings line): an agreed deal leaves the live record when it settles or its sit-down ends, and keeps its
// final counts in `s.dealsDone`, with the day it ended and how: 'settled' (both halves in full), 'in step' (its
// sit-down over with each half in step with the other, short of full) or 'lapsed' (nothing handed over). It only
// records: nothing reads it to decide anything.
const settle = s => {
  if (!s.deals) return;
  const done = s.deals.filter(d => d.agreed && !live(d));
  if (done.length) (s.dealsDone ||= []).push(...done.map(d => ({ ...d, endedDay: s.day, how: complete(d) ? 'settled' : handed(d) ? 'in step' : 'lapsed' })));
  s.deals = s.deals.filter(live);
};
const sameGoods = (x, y) => JSON.stringify(sortGoods(x || {})) === JSON.stringify(sortGoods(y || {}));
const sameTerms = (d, t) => d.seller === t.seller && d.buyer === t.buyer && d.cash === t.cash
  && d.night === t.night
  && (d.piece ? d.piece === t.piece : !!t.goods && sameGoods(d.goods, t.goods));
// R5-terms: terms offered back on a deal's own goods (or piece), cash and night, in either form: the deal as the other
// side states it (a sell for a buy), or the very same words (an echo), whose own reading turns the deal round.
// R10a: exported, so the tools judge an agree's own terms against the open offer by this same test (tools.mjs).
export const offeredBack = (d, t) => sameTerms(d, t) || sameTerms(d, { ...t, seller: t.buyer, buyer: t.seller });
const expired = (s, d) => Number.isInteger(d.night) && s.clock > 2 * d.night;

// The deal typed terms offer, from `from` to `to`: who sells and who buys, the goods or the piece, and the cash; or null
// when the terms offer none (not a trade, no goods or piece, or no cash).
export function dealOf(terms, from, to) {
  if (!terms || !DEAL_WHAT.includes(terms.what) || !(Number.isInteger(terms.cash) && terms.cash >= 1)) return null;
  const goods = terms.goods && Object.keys(terms.goods).length ? terms.goods : null;
  const piece = !goods && typeof terms.piece === 'string' ? terms.piece : null;
  if (!goods && !piece) return null;
  const [seller, buyer] = terms.what === 'sell' ? [from, to] : [to, from];
  return { seller, buyer, ...(goods ? { goods: { ...goods } } : { piece }), cash: terms.cash,
    ...(Number.isInteger(terms.night) ? { night: terms.night } : {}) };
}

// R9 (brief R9-agents-work-their-trade, change 1; the orchestrator's review, 10-19): the open offer the other side made
// in a sit-down, which `id` agrees in one step by offering the same terms back from its own side (a sell for a buy, a
// buy for a sell), the form R5-terms agrees as the offer was made, and the form the bots' sellers read as a buyer's
// words (bots.mjs isBuy; the echo, a buy repeated by the seller, left a buyer's goods undelivered). Its terms come
// from the deal itself (the seat's own side of it, its goods or piece, cash and night), never from words.
// Or why not, typed: no offer, one already agreed, the seat's own, or one whose night has been played.
export function openOffer(s, sitdown, id) {
  const d = (s.deals || []).find(x => x.sitdown === sitdown && !x.sealed);
  if (!d) return { why: 'no open offer in this sit-down', kind: 'not-yet' };
  if (d.agreed) return { why: `already agreed day ${d.agreedDay}`, kind: 'never' };
  if (d.by === id) return { why: 'the open offer is your own', kind: 'not-yet' };
  if (expired(s, d)) return { why: `that offer expired after night ${d.night}`, kind: 'never' };
  const terms = { what: d.seller === id ? 'sell' : 'trade', ...(d.piece ? { piece: d.piece } : { goods: { ...d.goods } }), cash: d.cash,
    ...(Number.isInteger(d.night) ? { night: d.night } : {}) };
  return { deal: d.id, terms };
}

// §14: an offer in an open sit-down, by `from`, with its typed terms (errand.mjs's termsOf). The other side's offer
// offered back on the same terms, in either form, is agreed as that side made it; any other offer is now the
// sit-down's, unagreed, and an agreed deal that something was handed over against keeps its own terms beside it.
export function stateDeal(s, sd, from, terms) {
  const t = dealOf(terms, from, sd.a === from ? sd.b : sd.a);
  if (!t) return;
  const deals = (s.deals ||= []);
  const i = deals.findIndex(d => d.sitdown === sd.id && !d.sealed);
  const cur = i >= 0 ? deals[i] : null;
  if (cur && !cur.agreed && !expired(s, cur) && cur.by !== from && offeredBack(cur, t)) {
    Object.assign(cur, { agreed: true, agreedDay: s.day });
    return;
  }
  // R5-terms: the agreed deal's own terms again, from either side, before anything is handed over: it stands.
  if (cur && cur.agreed && !handed(cur) && offeredBack(cur, t)) return;
  const fresh = {
    id: `${sd.id}@${s.seq}`, sitdown: sd.id, ...t, by: from, day: s.day, agreed: false, agreedDay: null, given: {}, gave: null,
    paid: 0, open: true, givenAt: null, givenDay: null, paidAt: null, paidDay: null, lastDay: null, incoming: {},
  };
  if (cur && cur.agreed && handed(cur)) {
    cur.sealed = true;
    deals.push(fresh);
  } else if (cur) deals[i] = fresh;
  else deals.push(fresh);
}

// The side handing over its own half agrees an offer the other side made; the offerer's own hand-over never does.
const consent = (s, d, from) => {
  if (!d.agreed && !expired(s, d) && d.by !== from) Object.assign(d, { agreed: true, agreedDay: s.day });
};
// A kind handed over, as a deal counts it: a SUDO is the TEMP a deal names.
const kindIn = (d, k) => (k === 'sudo' && d.goods.temp && !d.goods.sudo ? 'temp' : k);
// The best of `deals` for `amount` of something: one where it is exactly what `room` says is left, else the newest.
const pick = (deals, room, amount) => deals.find(d => room(d) === amount) || deals.at(-1) || null;
const scopedDeals = (s, from, to, sitdown) => {
  const pair = (s.deals || []).filter(d => (d.seller === from && d.buyer === to) || (d.seller === to && d.buyer === from));
  const named = pair.filter(d => d.sitdown === sitdown);
  return named.length ? named : pair;
};
const eligible = (s, d) => d.agreed || !expired(s, d);
// The same scope and eligibility used by noteHandover choose cash attribution before either book changes. Naming an
// existing goods deal makes the whole cash transfer its own, even if expired or already paid up; unnamed cash with
// no possible deal allocation can still repay a separate promise.
export function cashForDeal(s, from, to, sitdown = null) {
  const pool = scopedDeals(s, from, to, sitdown);
  return pool.some(d => d.sitdown === sitdown) || pool.some(d => eligible(s, d)
    && ((d.buyer === from && d.paid < d.cash) || (d.seller === from && d.paid > 0)));
}

// §10: what a give or a pay from `from` to `to` hands over against their deals: goods ({ kind: n }) and a piece (a
// copy) one way, cash the other, a return of either back again. `sitdown`, when the errand names one, picks that
// sit-down's deals first; else the deal whose terms the hand-over matches. `at` is the hand-over's event number, which
// the runner's wake reads (runner.mjs).
export function noteHandover(s, from, to, { goods = null, copy = null, cash = 0, sitdown = null } = {}) {
  if (!s.deals || !s.deals.length) return;
  const at = s.seq;
  const pool = scopedDeals(s, from, to, sitdown).filter(d => eligible(s, d));
  if (!pool.length) return;
  const turn = d => Object.assign(d, { seller: d.buyer, buyer: d.seller });
  // A qualifying incoming movement belongs to its actual recipient, including a refund or a return. Keep only its
  // number and day in the deal itself, so CLEAR need not recover any forgotten event to wake the seat.
  const forward = d => {
    d.lastDay = s.day;
    if (d.incoming === undefined) d.incoming = {
      [d.buyer]: { at: d.givenAt, day: d.givenDay }, [d.seller]: { at: d.paidAt, day: d.paidDay },
    };
    const role = d.seller === to ? 'seller' : 'buyer';
    if (owedBy(d) === role) d.incoming[to] = { at, day: s.day };
    return d;
  };
  if (goods) {
    for (const [k, n0] of Object.entries(goods)) {
      let n = n0;
      while (n > 0) {
        const room = d => (d.goods[kindIn(d, k)] || 0) - (d.given[kindIn(d, k)] || 0);
        const back = d => d.given[kindIn(d, k)] || 0;
        const out = pool.filter(d => d.goods && d.seller === from && room(d) > 0);
        const ret = pool.filter(d => d.goods && d.buyer === from && back(d) > 0);
        const own = pool.filter(d => d.goods && d.buyer === from && !d.agreed && d.by === from && !handed(d) && (d.goods[kindIn(d, k)] || 0) > 0);
        let d = pick(out, room, n);
        if (!d && (d = pick(ret, back, n))) {
          const x = Math.min(n, back(d));
          d.given = sortGoods({ ...d.given, [kindIn(d, k)]: back(d) - x });
          forward(d);
          n -= x;
          continue;
        }
        if (!d && own.length) d = turn(own.at(-1));
        if (!d) break;
        const x = Math.min(n, room(d));
        consent(s, d, from);
        d.given = sortGoods({ ...d.given, [kindIn(d, k)]: (d.given[kindIn(d, k)] || 0) + x });
        Object.assign(forward(d), { givenAt: at, givenDay: s.day });
        n -= x;
      }
    }
  }
  if (copy) {
    const trait = s.copies[copy] ? s.copies[copy].trait : null;
    const fits = x => x.piece && (x.piece === copy || x.piece === trait);
    let d = pool.find(x => x.seller === from && fits(x) && !x.gave);
    const back = pool.find(x => x.buyer === from && x.gave === copy);
    if (!d && back) Object.assign(forward(back), { gave: null });
    else {
      if (!d) d = pool.find(x => x.buyer === from && fits(x) && !x.agreed && x.by === from && !handed(x));
      if (d) {
        if (d.buyer === from) turn(d);
        consent(s, d, from);
        Object.assign(forward(d), { gave: copy, givenAt: at, givenDay: s.day });
      }
    }
  }
  let left = Number.isInteger(cash) && cash > 0 ? cash : 0;
  while (left > 0) {
    // Outstanding debt comes before optional advances, within the named scope. In each class keep the documented
    // exact-match then newest choice, and fill only that class's room before choosing again.
    const debt = d => (d.agreed ? Math.max(0, cashDue(d) - d.paid) : 0);
    const advance = d => d.cash - d.paid;
    const out = pool.filter(d => d.buyer === from && d.cash - d.paid > 0);
    const ret = pool.filter(d => d.seller === from && d.paid > 0);
    const outstanding = out.filter(d => debt(d) > 0);
    const room = outstanding.length ? debt : advance;
    let d = pick(outstanding.length ? outstanding : out, room, left);
    if (d) {
      const x = Math.min(left, room(d));
      consent(s, d, from);
      d.paid += x;
      Object.assign(forward(d), { paidAt: at, paidDay: s.day });
      left -= x;
      continue;
    }
    d = pick(ret, x => x.paid, left);
    if (!d) break;
    const x = Math.min(left, d.paid);
    d.paid -= x;
    forward(d);
    left -= x;
  }
  settle(s);
}

// §14: a sit-down closed, or past its last day. Its agreed deals go on only where one side owes the other; its offers
// nobody agreed to end.
export function endDeals(s, sitdown) {
  if (!s.deals) return;
  for (const d of s.deals) if (d.sitdown === sitdown) d.open = false;
  settle(s);
}

// R9d (slime, 10-20: "Yes, show it"): street prices, what agents paid each other for goods, by kind, as a public fact
// with no party named. From the settled record (`dealsDone`) alone, as it stood when the view was built (`done`, `day`):
// - Settled: an agreed goods deal that has left the live record with goods and cash both handed over: 'settled' (both
//   halves in full) or 'in step' (its sit-down over, each half in step with the other: a part delivery paid pro rata).
//   A lapsed deal (nothing handed over), a deal still live, and a deal for a piece never count.
// - What it counts: the units handed over (its final count, after any return) and the cash paid for them.
// - One kind a deal: a deal whose goods are more than one kind has no price for each, so it doesn't count. A drug is
//   its own kind (a deal for TEMP that a SUDO filled counts as the TEMP it names).
// - The last 3 days: a deal counts on the day it ended (`endedDay`: its last hand-over for one settled in full; its
//   sit-down's close or expiry for a part delivery, which may come days after its last hand-over), and the window is
//   the 3 days before today, today not one of them. A hand-over, and a sit-down's close, are their agents' own until
//   the next dawn (§19's 24 hours), so by today everything the window counts is on everyone's record, and the line
//   stays the same all day. On day 1 the window holds no day of play.
// - The unit price: the cash paid over the units handed over, to the nearest dollar, a half rounding down (as the
//   city's market rounds, gap.marketRounding).
// Each kind: the units, the number of deals, and the lowest and highest unit price (one price when they're equal), in
// the goods' order.
export function streetPrices(done, day) {
  const from = Math.max(1, day - 3);
  const kinds = {};
  for (const d of done) {
    if (d.piece || !d.goods || !['settled', 'in step'].includes(d.how) || !(d.endedDay >= from && d.endedDay < day)) continue;
    const held = Object.entries(d.given || {}).filter(([, n]) => n > 0);
    if (Object.keys(d.goods).length !== 1 || held.length !== 1 || !(d.paid >= 1)) continue;
    const [kind, units] = held[0];
    const q = Math.floor(d.paid / units);
    const price = 2 * (d.paid - q * units) > units ? q + 1 : q;
    const k = (kinds[kind] ||= { kind, units: 0, deals: 0, low: price, high: price });
    Object.assign(k, { units: k.units + units, deals: k.deals + 1, low: Math.min(k.low, price), high: Math.max(k.high, price) });
  }
  return { from, to: day - 1, kinds: Object.keys(sortGoods(Object.fromEntries(Object.keys(kinds).map(k => [k, 1])))).map(k => kinds[k]) };
}

// The deals an agent is in, as its own view shows them (view.mjs), oldest first: its id, the sit-down, its role, who
// it's with, whose offer it was and when, whether it's agreed and when, the terms, what each side has handed over and
// when it last did (`givenAt`, `paidAt`: the hand-over's event number), the cash due for the goods given, whether the
// sit-down is still open, and who owes the other now ('me', 'them' or null; null on an offer nobody agreed to).
export function dealsFor(s, id) {
  return (s.deals || []).filter(d => d.seller === id || d.buyer === id).map(rowFor(s, id));
}
// R9: the agreed deals an agent was in that have left the live record, oldest first: each as dealsFor shows a deal,
// with the day it ended and how (settle).
export function dealtFor(s, id) {
  return (s.dealsDone || []).filter(d => d.seller === id || d.buyer === id).map(d => ({ ...rowFor(s, id)(d), endedDay: d.endedDay, how: d.how }));
}
function rowFor(s, id) {
  return d => {
    const role = d.seller === id ? 'seller' : 'buyer';
    const owes = owedBy(d);
    // Older saved deals predate recipient markers; their existing forward timestamps remain the canonical incoming
    // fact until a new qualifying movement records the recipient explicitly.
    const incoming = d.incoming === undefined
      ? { at: role === 'buyer' ? d.givenAt : d.paidAt, day: role === 'buyer' ? d.givenDay : d.paidDay }
      : d.incoming[id];
    return {
      id: d.id, sitdown: d.sitdown, with: role === 'seller' ? d.buyer : d.seller, role, stated: d.by === id ? 'me' : 'them', day: d.day,
      agreed: d.agreed, agreedDay: d.agreedDay,
      ...(Number.isInteger(d.night) ? { night: d.night } : {}), expired: expired(s, d),
      ...(d.piece ? { piece: d.piece, gave: !!d.gave } : { goods: sortGoods({ ...d.goods }), given: sortGoods({ ...d.given }) }),
      cash: d.cash, paid: d.paid, due: cashDue(d), open: d.open, owes: owes === null ? null : owes === role ? 'me' : 'them',
      givenAt: d.givenAt, givenDay: d.givenDay, paidAt: d.paidAt, paidDay: d.paidDay, lastDay: d.lastDay,
      incomingAt: incoming?.at ?? null, incomingDay: incoming?.day ?? null,
    };
  };
}
