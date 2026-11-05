// A tape marker is an event, not a lookup of who wears a hood NOW. Only a
// marker tied to that person's own masked scene may hide its subject label.
import { islandClock } from '../../simstate/record/adapter.js';
import { actionOf, placeOf } from './tv.js';
import { sceneHidden, HOODED } from './identity.js';
export const KIND = { show: 'The show', fight: 'Fight', arrest: 'Arrest', turf: 'Corner', sale: 'Dawn sale', ferry: 'Ferry', betray: 'Betrayal' };
export const clockOf = m => { const c = islandClock(m); return `day ${c.day} ${c.hhmm}`; };
const BETRAY = { walk: 'walks out on a promise', rat: 'rats to the police', rug: 'rugs the crew stash' };
export const tapeName = (s, id, eventId) => !id ? null : sceneHidden(s, id, eventId) ? HOODED : s.board?.agents?.find(a => a.id === id)?.name ?? id;
export function tapeWords(m, ev, s) {
  const who = tapeName(s, m.subjects?.agent, m.id), place = m.place ? placeOf(m.place.corePlace ?? m.place.cityPlace) : null;
  let what = KIND[m.kind] ?? m.kind;
  if (m.kind === 'show') what = `The show · night ${ev?.night ?? ''}`.trim();
  else if (m.kind === 'fight') what = actionOf({ kind: ev?.kind ?? 'fight' });
  else if (m.kind === 'arrest') what = 'an arrest';
  else if (m.kind === 'turf') what = 'a corner changes hands';
  else if (m.kind === 'sale') what = 'a sale at dawn';
  else if (m.kind === 'ferry') what = ev?.type === 'board' ? 'boards the ferry' : 'the ferry drops everyone at the docks';
  else if (m.kind === 'betray') what = BETRAY[m.betray] ? `turns: ${BETRAY[m.betray]}` : 'turns';
  what = what.charAt(0).toUpperCase() + what.slice(1);
  return { what, who, place, line: [who, place, clockOf(m.minute)].filter(Boolean).join(' · ') };
}
