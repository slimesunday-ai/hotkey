// §19/20: public projections of typed plays and receipts. The private ledger is unchanged.
import { byId } from './state.mjs';

const ATTACKS = new Set(['hit', 'breakin', 'collar', 'grab', 'vault']);
const KINDS = ['Took', 'Turned', 'Booked', 'Bought', 'Outbid'];

export function showPlays(show, log) {
  const plays = new Map(log.filter(e => e.type === 'play' && e.t === show.t).map(e => [e.agent, e]));
  return Object.fromEntries(Object.keys(show.seen).sort(byId).flatMap(id => {
    const p = plays.get(id);
    if (!p) return [];
    const target = plays.get(p.target);
    return [[id, { kind: p.kind, place: show.seen[id],
      ...(p.kind === 'deal' ? { corner: p.corner } : {}),
      ...(p.kind === 'back' && target && Object.hasOwn(show.seen, p.target) && !ATTACKS.has(target.kind) ? { target: p.target } : {}),
    }]];
  }));
}

// A card lives on its receipt: its enclosing n becomes the feed-local id, also the replay anchor. A private receipt
// first has only a card form; disclosure restores its full form with the same card and identity. No nested event ids.
export function morningCards(log, T) {
  const nights = new Map();
  const paid = new Map();
  const shows = new Map();
  const traits = new Map();
  for (const e of log) {
    if (e.t > T) continue;
    if (e.copy && e.trait) traits.set(e.copy, e.trait);
    if (e.type === 'show') shows.set(e.night, e);
  }
  for (const e of log) {
    if (e.t > T) continue;
    if (e.type === 'buy' && !paid.has(e.copy)) paid.set(e.copy, e.price);
    let kind, night;
    if (e.type === 'rob' || e.type === 'burgle') { kind = 'Took'; night = e.night; }
    else if (e.type === 'betray') { kind = 'Turned'; night = e.kind === 'walk' ? e.day - 1 : e.day; }
    else if (e.type === 'arrest') { kind = 'Booked'; night = e.night; }
    else if (e.type === 'buy') { kind = 'Bought'; night = e.night; }
    else if (e.type === 'refund' && e.trait) { kind = 'Outbid'; night = e.day; }
    else continue;
    if (!shows.has(night) || T < 2 * (night + 1)) continue;
    const copies = e.copy ? [e.copy] : e.copies || [];
    const pieces = kind === 'Bought' ? [{ trait: e.trait }] : copies.map(copy => ({ copy, trait: traits.get(copy) ?? null }));
    // Arrest's public receipt and its dawn seizure are separate typed facts; join by agent and night, never text.
    const seizure = kind === 'Booked' ? log.find(x => x.type === 'seized' && x.night === night && x.agent === e.agent) : null;
    if (seizure?.copy) pieces.push({ copy: seizure.copy, trait: seizure.trait });
    if (e.copy && e.trait && kind !== 'Bought') pieces[0].trait = e.trait;
    if (kind === 'Outbid') pieces.push({ trait: e.trait });
    const cash = kind === 'Bought' ? e.price : kind === 'Booked' ? seizure?.fine || 0 : e.cash || 0;
    const pieceValue = kind === 'Bought' || kind === 'Outbid' ? 0
      : e.pieceValue ?? pieces.reduce((sum, p) => sum + (paid.get(p.copy) || 0), 0);
    // §19: only a ski mask hides a card's robber. The victim's typed receipt already owns that decision; the show's
    // hooded attackers do not constrain card names. Match the attack kind because a victim can lose to both kinds.
    const robbed = kind === 'Took' ? log.find(x => x.type === 'robbed' && x.t <= T && x.night === night
      && x.agent === e.target && x.kind === (e.type === 'rob' ? 'hit' : 'breakin')) : null;
    const actor = kind === 'Took' ? robbed?.by ?? null : e.by ?? e.agent ?? null;
    const others = kind === 'Took' ? [e.target] : kind === 'Turned' ? e.victims || [] : [];
    const card = { night, kind, subjects: { agent: actor, others: [...others] },
      masked: kind === 'Took' && robbed?.by === null,
      pieces, place: e.place ?? null, cash, pieceValue, value: cash + pieceValue, valueBasis: 'copy-paid',
    };
    // An unsuccessful offer moves no value; its amount stays private. An unsold piece has no paid value.
    (nights.get(night) || nights.set(night, []).get(night)).push({ n: e.n, card });
  }
  const selected = new Map();
  for (const candidates of nights.values()) {
    const sorted = candidates.slice().sort((a, b) => b.card.value - a.card.value || a.n - b.n);
    const picks = KINDS.flatMap(kind => {
      const first = sorted.find(x => x.card.kind === kind);
      return first ? [first] : [];
    });
    for (const x of sorted) if (picks.length < 5 && !picks.includes(x)) picks.push(x);
    picks.forEach((x, rank) => selected.set(x.n, { ...x.card, rank: rank + 1 }));
  }
  return selected;
}
