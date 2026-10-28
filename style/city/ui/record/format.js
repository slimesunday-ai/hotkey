// C1-11, the drawn half · HOW A PANEL VALUE PRINTS. Pure and shared: the record's panels (ui/record/) print every value through
// fmt(), and tools/panelscenario.mjs prints panel-data.js's values through the same fmt() to compare them with the page's DOM.
// Formatting only: no value is computed, joined or inferred here. A value with no source (null / undefined) prints nothing, and its
// element is left out (never a zero).
export const DRUGS = Object.freeze(['temp', 'hallu', 'sudo', 'truth', 'clear', 'firewall']);
const FLAGS = { wanted: ['WANTED', 'not wanted'], jailed: ['in jail', 'free'], evicted: ['evicted', 'housed'], boarded: ['boarded', 'on the island'],
  fitHidden: ['hidden', 'shown'], hot: ['hot', 'quiet'] };
const MONEY = new Set(['bail', 'tab', 'amount', 'cash']);
export const has = v => v !== null && v !== undefined;
export function fmt(key, v) {
  if (!has(v)) return null;
  if (Object.hasOwn(FLAGS, key)) return FLAGS[key][v ? 0 : 1];
  if (MONEY.has(key)) return '$' + v;
  if (key === 'id' || key === 'agent' || key === 'holder') return '@' + v;
  if (key === 'fit') return v.length ? v.map(p => p.trait).join(', ') : 'nothing';
  if (key === 'lastSay') return v.line ?? v.say ?? null;
  if (key === 'members') return String(v.length);
  if (key === 'routes') return v.join(' → ');
  if (key === 'asOf' || key === 'minute') return clock(v);
  return String(v);
}
// an island minute as the record player prints it: Day d hh:mm (day 0 from midnight)
export function clock(m) {
  const d = Math.floor(m / 1440), r = Math.floor(m - d * 1440);
  return `Day ${d} ${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
}
// a dotted path into a panel value: 'card.home.address.name', 'tape.memory.creed.0'
export const at = (o, path) => path.split('.').reduce((x, k) => x?.[k], o);
