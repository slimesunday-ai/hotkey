// The ledger check (GAME.md §23): every trait copy has exactly one holder at every moment, no copy is made or lost,
// and cash and goods are conserved except at the named sources and sinks (§9). The runner calls it after every errand
// and every night; it throws, loudly, on the first thing wrong.
import { byId, GOODS, DRUGS } from './state.mjs';
import { fenceProblems } from './fence.mjs';
import { marketItems } from './market.mjs';

const HOLDERS = new Set(['list', 'agent', 'crew', 'vault', 'fence', 'minted', 'gone', 'rollover']);

export function ledgerProblems(s) {
  const bad = [];
  const copyIds = Object.keys(s.copies);
  const fromTraits = Object.values(s.traits).flatMap(t => t.copies);
  // Layer 4: a fake is a copy outside its trait's copies, and only an agent or a crew holds one until it's gone (GAP
  // gap.fakes).
  const fakes = copyIds.filter(k => s.copies[k].fake).length;
  if (fromTraits.length + fakes !== copyIds.length || new Set(fromTraits).size !== fromTraits.length) {
    bad.push(`copies: the traits list ${fromTraits.length} (${new Set(fromTraits).size} distinct) and there are ${fakes} fakes, the ledger has ${copyIds.length}`);
  }
  for (const id of copyIds) {
    const c = s.copies[id];
    if (!s.traits[c.trait] || s.traits[c.trait].copies.includes(id) !== !c.fake) bad.push(`${id}: ${c.fake ? 'a fake among' : 'not one of'} ${c.trait}'s copies`);
    if (c.fake && !['agent', 'crew', 'gone'].includes((c.holder || {}).k)) bad.push(`${id}: a fake held by ${(c.holder || {}).k}`);
    if (!c.holder || !HOLDERS.has(c.holder.k)) bad.push(`${id}: no valid holder`);
    else if (c.holder.k === 'agent' && !s.agents[c.holder.id]) bad.push(`${id}: held by unknown agent ${c.holder.id}`);
    else if (c.holder.k === 'crew' && !s.crews[c.holder.id]) bad.push(`${id}: held by unknown crew ${c.holder.id}`);
    else if (c.holder.k === 'minted' && !s.agents[c.holder.id]) bad.push(`${id}: minted to unknown agent ${c.holder.id}`);
    const last = c.hist[c.hist.length - 1];
    const label = c.holder.id ? `${c.holder.k}:${c.holder.id}` : c.holder.k;
    if (!last || last.to !== label) bad.push(`${id}: history ends at ${last && last.to}, holder is ${label}`);
  }
  // An outfit or a bag only ever points at the agent's own pieces, one piece a slot.
  for (const a of Object.values(s.agents)) {
    for (const [slot, k] of Object.entries(a.outfit)) {
      const c = s.copies[k];
      if (!c || c.holder.k !== 'agent' || c.holder.id !== a.id) bad.push(`${a.id} wears ${k}, which it doesn't hold`);
      else if (c.slot !== slot) bad.push(`${a.id} wears ${k} (${c.slot}) in its ${slot} slot`);
    }
    const worn = Object.values(a.outfit);
    if (new Set(worn).size !== worn.length) bad.push(`${a.id} wears one copy twice`);
    for (const k of a.carry) {
      const c = s.copies[k];
      if (!c || c.holder.k !== 'agent' || c.holder.id !== a.id) bad.push(`${a.id} carries ${k}, which it doesn't hold`);
    }
    if (!Number.isInteger(a.cash) || a.cash < 0) bad.push(`${a.id} has cash ${a.cash}`);
    if (!Number.isInteger(a.tab) || a.tab < 0) bad.push(`${a.id} has a rent tab of ${a.tab}`);
  }
  for (const p of s.pending) {
    if (s.copies[p.copy].holder.k !== 'list') bad.push(`${p.copy} is waiting for dawn but isn't at the list`);
  }
  if (new Set(s.pending.map(p => p.copy)).size !== s.pending.length) bad.push('a copy is sold twice tonight');

  // §9 (R4-3): the day's orders at the city's shop and buyer, a shop order's cash and a sell order's goods held for the
  // island until the lock, and none outliving its day (GAP gap.marketOrder).
  const orders = s.orders || [];
  for (const o of orders) {
    const items = o.side === 'shop' || o.side === 'buyer' ? marketItems(o.side) : [];
    const kind = o.item === 'doses' ? DRUGS.includes(o.kind) : o.kind === o.item;
    if (!s.agents[o.by] || !items.includes(o.item) || !kind) bad.push(`order ${o.id}: ${o.by}'s ${o.side} order of ${o.item} as ${o.kind}`);
    if (!Number.isInteger(o.units) || o.units < 1) bad.push(`order ${o.id}: ${o.units} units`);
    if (!Number.isInteger(o.cash) || o.cash < 0 || (o.side === 'buyer' && o.cash !== 0)) bad.push(`order ${o.id}: holds $${o.cash}`);
    if (o.day !== s.day || s.clock % 2 !== 0) bad.push(`order ${o.id}: from day ${o.day}, past its lock`);
  }
  // Cash: what the island holds equals what came in minus what went out.
  const held = Object.values(s.agents).reduce((t, a) => t + a.cash, 0)
    + Object.values(s.crews).reduce((t, c) => t + c.cash, 0)
    + s.vault.cash
    + s.offers.reduce((t, o) => t + o.amount, 0)
    + orders.reduce((t, o) => t + (o.side === 'shop' && Number.isInteger(o.cash) ? o.cash : 0), 0);
  const inflow = Object.values(s.money.in).reduce((t, v) => t + v, 0);
  const outflow = Object.values(s.money.out).reduce((t, v) => t + v, 0);
  if (held !== inflow - outflow) bad.push(`cash: the island holds ${held}, but ${inflow} came in and ${outflow} went out`);
  // Bounties (layer 3): the cash held for them sits in the offers exactly as the open bounties say (GAP gap.bounty).
  const bountyHeld = s.offers.filter(o => o.bounty).map(o => `${o.by} ${o.bounty} $${o.amount}`).sort(byId).join(', ');
  const bountyOpen = s.bounties.map(b => `${b.by} ${b.id} $${b.amount}`).sort(byId).join(', ');
  if (bountyHeld !== bountyOpen) bad.push(`bounties: the offers hold ${bountyHeld || 'nothing'}, the open bounties say ${bountyOpen || 'nothing'}`);
  for (const b of s.bounties) if (!Number.isInteger(b.amount) || b.amount < 1) bad.push(`bounty ${b.id}: $${b.amount}`);
  for (const c of Object.values(s.crews)) {
    if (!Number.isInteger(c.cash) || c.cash < 0) bad.push(`crew ${c.id} has cash ${c.cash}`);
    for (const m of c.members) if (!s.agents[m] || s.agents[m].crew !== c.id) bad.push(`crew ${c.id} lists ${m}, who isn't in it`);
  }
  for (const a of Object.values(s.agents)) {
    if (a.crew && (!s.crews[a.crew] || !s.crews[a.crew].members.includes(a.id))) bad.push(`${a.id} says it's in crew ${a.crew}`);
  }
  if (!Number.isInteger(s.vault.cash) || s.vault.cash < 0) bad.push(`vault cash ${s.vault.cash}`);

  // Goods: what agents and crew stashes hold of each kind equals what came in minus what went out (§9).
  const goodsHeld = {};
  for (const h of [...Object.values(s.agents), ...Object.values(s.crews)]) {
    for (const [k, n] of Object.entries(h.goods)) {
      if (!GOODS.includes(k) || !Number.isInteger(n) || n < 1) bad.push(`${h.id} holds ${n} ${k}`);
      goodsHeld[k] = (goodsHeld[k] || 0) + n;
    }
    // §11 (layer 3): HALLU's lots and SUDO's marks never outnumber the doses they ride on, nor (layer 4) the warrants'
    // makers the warrants (GAP gap.hallu, gap.sudo, gap.warrants).
    const lotted = key => (h[key] || []).reduce((t, l) => t + (Number.isInteger(l.n) && l.n > 0 ? l.n : Infinity), 0);
    if (lotted('lots') > (h.goods.hallu || 0)) bad.push(`${h.id} holds ${h.goods.hallu || 0} HALLU, ${lotted('lots')} of it in lots`);
    if ((h.marks || []).length > (h.goods.temp || 0)) bad.push(`${h.id} carries ${h.marks.length} marks on ${h.goods.temp || 0} TEMP`);
    if (lotted('makers') > (h.goods.warrants || 0)) bad.push(`${h.id} holds ${h.goods.warrants || 0} warrants, ${lotted('makers')} of them marked`);
  }
  // The fence (layer 2): what it holds matches its deals, and its goods are still the island's.
  const fence = fenceProblems(s);
  bad.push(...fence.bad);
  for (const [k, n] of Object.entries(fence.goods)) goodsHeld[k] = (goodsHeld[k] || 0) + n;
  for (const o of orders) if (o.side === 'buyer' && Number.isInteger(o.units)) goodsHeld[o.kind] = (goodsHeld[o.kind] || 0) + o.units;
  const book = side => {
    const t = {};
    for (const g of Object.values(s.goods[side])) for (const [k, n] of Object.entries(g)) t[k] = (t[k] || 0) + n;
    return t;
  };
  const [gin, gout] = [book('in'), book('out')];
  for (const k of GOODS) {
    const [h, i, o] = [goodsHeld[k] || 0, gin[k] || 0, gout[k] || 0];
    if (h !== i - o) bad.push(`goods: the island holds ${h} ${k}, but ${i} came in and ${o} went out`);
  }
  for (const [side, steps] of Object.entries(s.market)) {
    for (const [k, n] of Object.entries(steps)) if (!Number.isInteger(n) || n < 0) bad.push(`market: the ${side}'s ${k} at step ${n}`);
  }
  return bad.sort(byId);
}

export function checkLedger(s, where = '') {
  const bad = ledgerProblems(s);
  if (bad.length) {
    const err = new Error(`LEDGER CHECK FAILED ${where}: ${bad.length} problem(s)\n  ${bad.join('\n  ')}`);
    err.problems = bad;
    throw err;
  }
  return true;
}
