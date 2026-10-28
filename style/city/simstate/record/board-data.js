import { islandClock } from './adapter.js';
import { publicAt } from './placement.js';
import { cardsAt } from './cards.js';

// Source paths describe the presented projection, including retained boards.
// frame is the as-of frame, not a claim that it contains a new board.
export const BOARD_SOURCES = Object.freeze({
  list: 'board.list', sales: 'board.sales', fits: 'board.agents[].{id,fit,fitHidden}',
  grails: 'board.list[tier=grail]; board.agents[].fit; board.sales (join by trait only)',
  corners: 'board.corners', police: 'board.police', tonight: 'board.tonight',
  wanted: 'board.agents[wanted].{id,heat,wanted}', bounties: 'board.bounties',
  vault: 'board.vault', crate: 'board.crate', nextShipment: 'board.nextShipment',
  clock: 'player.minute -> adapter.islandClock (civil US Eastern)',
  lock: 'island clock: today at 21:00, clamped at zero; frame.over ends the countdown',
  ferry: 'frame.nightsLeft', cards: 'event.card; enclosing event.id (Replay)',
});

// Input: sim.record() / player.snapshot(), never the compatibility sim.events().
// No archive, frame array, private receipt or rule module is consulted.
export function boardAt(snapshot, minute = snapshot.minute) {
  publicAt(snapshot, minute);
  const b = snapshot.board, clock = islandClock(minute);
  const list = b?.list ?? [], sales = b?.sales ?? [], agents = b?.agents ?? [];
  const fits = agents.map(a => ({ agent: a.id, fit: a.fit, fitHidden: a.fitHidden }));
  const grails = list.filter(t => t.tier === 'grail').map(t => ({ ...t,
    wearers: fits.flatMap(a => (a.fit ?? []).filter(p => p.trait === t.trait)
      .map(piece => ({ agent: a.agent, piece }))),
    buyers: sales.filter(s => s.trait === t.trait),
  }));
  const lockAt = b && !snapshot.over ? clock.day * 1440 + 1260 : null;
  return { frame: snapshot.frame, minute, clock,
    list, sales, fits, grails, corners: b?.corners ?? [],
    police: b?.police ?? null, tonight: b?.tonight ?? null,
    wanted: agents.filter(a => a.wanted).map(a => ({ agent: a.id, heat: a.heat, wanted: a.wanted })),
    // Target-only allow-list. A disclosed bounty receipt must never supply this row.
    bounties: (b?.bounties ?? []).map(b => Object.fromEntries(
      ['bounty', 'copy', 'trait', 'slot', 'tier', 'agent', 'amount'].filter(k => Object.hasOwn(b, k)).map(k => [k, b[k]]))),
    vault: b?.vault ?? null, crate: b?.crate ?? null,
    nextShipment: b?.nextShipment ?? null,
    countdowns: { lock: lockAt == null ? null : { at: lockAt, minutes: Math.max(0, lockAt - minute) },
      ferry: { nightsLeft: snapshot.nightsLeft } },
    cards: cardsAt(snapshot, undefined, minute), sources: BOARD_SOURCES };
}
