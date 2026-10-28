import { HOUSE_LOTS } from './places.js';

// FNV-1a over UTF-16 id code units. No seed, display name, roster order or RNG.
export function idHash(id) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return hash >>> 0;
}

// Deal once from the complete public roster. Sorted-id linear probing resolves
// collisions, making every address distinct and repeatable across seeds/order.
// The same roster keeps the same book. Changing the roster can move colliding ids;
// an arbitrary unbounded id namespace cannot inject into 280 lots independently.
export function addressesFor(ids) {
  const sorted = [...new Set(ids)].sort();
  if (sorted.some(id => typeof id !== 'string' || !id.length)) throw new TypeError('addresses need nonempty string ids');
  if (sorted.length > HOUSE_LOTS.length) throw new RangeError('Pleasantview has too few house lots for this roster');
  const taken = new Set(), book = Object.create(null);
  for (const agent of sorted) {
    let index = idHash(agent) % HOUSE_LOTS.length;
    while (taken.has(index)) index = (index + 1) % HOUSE_LOTS.length;
    taken.add(index);
    const lot = HOUSE_LOTS[index];
    book[agent] = Object.freeze({ agent, home: lot.id, cityPlace: lot.id, lot: lot.lot,
      district: lot.dist, name: lot.name, x: lot.x, z: lot.z });
  }
  return Object.freeze(book);
}
