import { publicAt } from './placement.js';

// Only the safe card projection is a picture's input. Never spread its enclosing
// receipt: after disclosure that receipt can name a ski-masked robber.
// The enclosing feed id survives card-only -> full-receipt form replacement.
export function cardsAt(snapshot, night = snapshot.day == null ? null : snapshot.day - 1, minute = snapshot.minute) {
  const events = publicAt(snapshot, minute);
  if (night == null || minute < (night + 1) * 1440 + 360) return [];
  return events.filter(e => e.card?.night === night && e.minute <= minute).map(e => {
    const c = e.card;
    return { night: c.night, rank: c.rank, kind: c.kind,
      subjects: { agent: c.subjects.agent, others: [...c.subjects.others] }, masked: c.masked,
      pieces: c.pieces.map(p => ({ ...p })), place: c.place,
      cash: c.cash, pieceValue: c.pieceValue, value: c.value, valueBasis: c.valueBasis,
      replay: { night: c.night, eventId: e.id },
      source: { eventId: e.id, path: 'card' } };
  }).sort((a, b) => a.rank - b.rank);
}
