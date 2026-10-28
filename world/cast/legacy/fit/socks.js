// Optional independent socks for the authored leg forms. Omit L.socks to retain
// a garment's original styling; explicit { id: 'none' } exposes the selected skin.
// These painters receive one existing uncovered cell and cannot change geometry,
// garment coverage or the separate shoe grid. Colours are optional 24-bit values.
import { DROP_SOCKS, colorway } from './drop-collection.js';
export const SOCK_STYLES = Object.freeze({
  none: 'No socks', ankle: 'Ankle', crew: 'Crew', stripe: 'Striped crew',
});

export function resolveSocks(socks) {
  if (socks == null) return null;
  const trait = DROP_SOCKS[socks.id];
  if (trait) { const row=colorway(trait,socks.cw); return { sock:trait.height, sockColor:row[1], sockPaint:q=>trait.paint(q,row.slice(1),trait.cw.indexOf(row)) }; }
  const id = Object.hasOwn(SOCK_STYLES, socks.id) ? socks.id : 'none';
  const c = socks.c ?? 0xe4e0d5, a = socks.a ?? 0x25262b;
  return {
    sock: id === 'stripe' ? 'crew' : id,
    sockColor: c,
    sockPaint: ({ y }) => [id === 'stripe' && y === 5 ? a : c, 0],
  };
}
