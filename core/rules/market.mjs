// The money curves (GAME.md §9, §26, §34, §38) as pure functions of the numbers: the city's shop and buyer, a corner's
// street price, and a drop's split. Prices come from a step count, never from compounding a rounded price, and the
// arithmetic is exact (whole numbers), so no float decides a dollar (GAP gap.marketRounding).
import { N } from '../numbers.mjs';
import { byId } from './state.mjs';

// To the nearest whole number, a half rounding down, for num / den in whole numbers.
function nearest(num, den) {
  const q = num / den;
  return Number(2n * (num % den) > den ? q + 1n : q);
}

// side: 'shop' (it sells: each unit bought raises the price) or 'buyer' (it buys: each unit sold lowers it).
const curveOf = side => (side === 'shop' ? [N.shopPrice, N.shopRise] : [N.buyerPrice, -N.buyerFall]);
export const marketItems = side => Object.keys(curveOf(side)[0]).sort(byId);

// The next unit's price with `steps` units already moved along the curve: base × (1 ± p%)^steps. Past 400 steps the
// buyer pays $0 and the shop asks more than the island will ever hold, so the arithmetic stops there.
export function priceOf(side, item, steps) {
  const [base, pct] = curveOf(side);
  const k = BigInt(Math.min(steps, 400));
  return nearest(BigInt(base[item]) * BigInt(100 + pct) ** k, 100n ** k);
}

// A run of `units` from `steps` on, each at its own price; null as soon as the total passes `budget`, so an order can
// be refused whole without walking the rest of the curve.
export function runOf(side, item, steps, units, budget = Infinity) {
  let total = 0;
  for (let i = 0; i < units; i++) {
    total += priceOf(side, item, steps + i);
    if (total > budget) return null;
  }
  return total;
}

// §9: a corner's street price starts at $36 a dose ($54 on a hot corner) and drops 10% with each dose sold there
// tonight. The night's takings for `doses` round once: base × (1 − f^d) / (1 − f), with f = 0.9.
export function cornerTakings(doses, hot) {
  if (!doses) return 0;
  const base = BigInt(hot ? N.corner.hot : N.corner.price);
  const f = BigInt(100 - N.corner.fall);
  const d = BigInt(doses);
  return nearest(base * (100n ** d - f ** d), 100n ** (d - 1n) * (100n - f));
}

// §9: a drop's units split evenly among the Smugglers there, on night `night`. Every share is the same, so the
// leftovers go round, never by chance (GAP gap.trades): one each, to the Smugglers there in id order, starting at the
// (night mod k)-th of the k there, so the start moves one place along each night and no id keeps the extra unit.
export function dropSplit(ids, night, units = N.dropUnits) {
  if (!Number.isInteger(night)) throw new Error(`dropSplit: which night? ${JSON.stringify(night)}`);
  const sorted = [...ids].sort(byId);
  const k = sorted.length;
  if (!k) return {};
  const each = Math.floor(units / k);
  const extra = units - each * k;
  return Object.fromEntries(sorted.map((id, i) => [id, each + ((i - night % k + k) % k < extra ? 1 : 0)]));
}

// §4, §9: what a Smuggler gathers at a drop: its share of the split (dropSplit), and N.workboots more when it wears work
// boots. One count for the night (night.mjs workOut) and the run numbers a seat's view shows (view.mjs runNumbersOf).
export const gathers = (share, workboots) => share + (workboots ? N.workboots : 0);

// §9 (R4-3): the day's orders on one of the city's curves, filled together at the lock (GAP gap.marketOrder). Each unit
// still moves the price one step, and every filled order pays or gets the same price a unit: the curve's total over the
// day's units, shared out by units in whole dollars. The odd dollars go one each to the orders with a part-dollar left
// over, in agent id order from the (night mod k)-th of the k of them, so the start moves one place along each night, as
// a drop's leftovers do (dropSplit): never by chance, and no id keeps them. Every sell order fills. A shop order holds the
// most it pays (`cash`): the orders go in by that limit a unit, highest first, equal limits together, each limit level
// filling if it covers the average price the day's units make with it in. A level that can't is passed over and comes
// back, and the levels below still get their turn (R4-3's review: stopping there let one order bounce every lower one
// for nothing). So who came first decides nothing.
// orders: [{ id, by, units, cash }], one side and one item. Returns { fills: [[order, dollars]], back: [order], units,
// total }, each list in the order given.
export function clearingOf(side, item, steps, orders, night) {
  if (!Number.isInteger(night)) throw new Error(`clearingOf: which night? ${JSON.stringify(night)}`);
  let group = orders;
  if (side === 'shop') {
    // x's limit a unit against y's, in whole numbers: positive when x pays more a unit.
    const over = (x, y) => x.cash * y.units - y.cash * x.units;
    const sorted = [...orders].sort((x, y) => over(y, x));
    group = [];
    for (let i = 0; i < sorted.length;) {
      let j = i;
      while (j < sorted.length && over(sorted[j], sorted[i]) === 0) j += 1;
      const next = [...group, ...sorted.slice(i, j)];
      const u = next.reduce((t, o) => t + o.units, 0);
      // The level fills if its limit covers the average price, runOf(u) / u, of the day's units with it in. Every level
      // already in has a higher limit, so it's covered too.
      if (runOf(side, item, steps, u) * sorted[i].units <= sorted[i].cash * u) group = next;
      i = j;
    }
  }
  const units = group.reduce((t, o) => t + o.units, 0);
  const total = units ? runOf(side, item, steps, units) : 0;
  const share = new Map(group.map(o => [o, Math.floor((o.units * total) / units)]));
  const odd = group.filter(o => (o.units * total) % units !== 0).sort((x, y) => byId(x.by, y.by) || byId(x.id, y.id));
  const left = total - [...share.values()].reduce((t, x) => t + x, 0);
  const k = odd.length;
  odd.forEach((o, i) => {
    if ((i - (night % k) + k) % k < left) share.set(o, share.get(o) + 1);
  });
  return { fills: orders.filter(o => share.has(o)).map(o => [o, share.get(o)]), back: orders.filter(o => !share.has(o)), units, total };
}
