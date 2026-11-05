// AI City · HOMES pass (2026-09-28) · WHICH PRESET LAYOUT A HOME GETS. Every in-game home is one of its tier's 3–4 assemblies
// (interiors/home/assemblies/<tier>-<name>.json), picked by a hash of its lot id: the same home always gets the same layout, and it only
// changes when the home's tier changes. Pure (no DOM, no three): the future builder and the sim can call it too.
export const LAYOUTS = {
  trailer: ['trailer-fresh-start', 'trailer-trap', 'trailer-nans-place'],
  apartment: ['apartment-first-place', 'apartment-collector', 'apartment-trap', 'apartment-laying-low'],
  house: ['house-family', 'house-cook', 'house-come-up'],
  penthouse: ['penthouse-flex', 'penthouse-gallery', 'penthouse-kingpin', 'penthouse-afterparty'],
};
export const TIER_OF = { estate: 'penthouse', penthouse: 'penthouse', house: 'house', trailer: 'trailer', apartment: 'apartment' };
// FNV-1a over the id (ids carry '·' and signs: hash the UTF-16 units)
export function idHash(id) { let h = 0x811c9dc5; for (let k = 0; k < id.length; k++) { h ^= id.charCodeAt(k); h = Math.imul(h, 0x01000193); } return h >>> 0; }
// MAINLAND (2026-10-06): a Mainland house's layout is its style's (assemblies/mainland-<style>.json), not a hash: the house kit's
// eight styles each have their own floor plan, sized to the style's footprint (mainland/houses.js STYLE, modern.js)
export const MAINLAND = ['springfield', 'trophy', 'cape', 'porch', 'ranch', 'gambrel', 'slab', 'butterfly'];
export const mainlandLayout = style => 'mainland-' + (MAINLAND.includes(style) ? style : 'springfield');
export function layoutFor(id, tier) { const L = LAYOUTS[TIER_OF[tier] ?? tier] ?? LAYOUTS.house; return L[idHash(id + '|' + (TIER_OF[tier] ?? tier)) % L.length]; }

// C2-indoors (2026-10-31) · THE RECORD'S HOMES, VARIED. Every record home is a Pleasantview house lot (tier 'house': three layouts), so
// the record viewer deals each agent's home a layout from every tier's presets that suits its trade, and a skin (walls and floor),
// slime 10-31 (GAME.md §41): "One room is fine as long as there is variety". Pure and deterministic: the same roster always gets the
// same rooms (as addresses.js deals the same addresses), dealt in lot order so that no home repeats a layout of the nearest homes
// already dealt, and no layout is dealt more than CAP times.
//   recordRooms(book, tradeOf, fit) → { [agent]: { name, skin: { N, E, floor } } }   fit(agent, name): the layout's room fits inside
//   that agent's house (plan.js fits, on the lot's frame from its block's anchors); a home none of its trade's layouts fit takes any
//   layout that fits, else the smallest
export const TRADE_ROOMS = {
  chemist: ['house-cook', 'trailer-trap', 'apartment-trap', 'apartment-laying-low', 'trailer-fresh-start', 'house-come-up'],
  dealer: ['apartment-trap', 'house-come-up', 'trailer-trap', 'apartment-collector', 'penthouse-afterparty', 'apartment-first-place'],
  gunrunner: ['house-come-up', 'penthouse-kingpin', 'trailer-nans-place', 'apartment-laying-low', 'trailer-trap', 'house-family'],
  smuggler: ['apartment-laying-low', 'penthouse-gallery', 'apartment-collector', 'house-family', 'trailer-nans-place', 'penthouse-flex'],
  cop: ['house-family', 'apartment-first-place', 'trailer-fresh-start', 'penthouse-flex', 'house-cook', 'apartment-collector'],
};
const ALL_ROOMS = [...new Set(Object.values(TRADE_ROOMS).flat())];
export const RECORD_LAYOUTS = ALL_ROOMS;
export const SKIN_WALLS = ['paint:#f4f1ea', 'paint:#e7bd4a', 'paint:#25b84c', 'paint:#2f5bff', 'paint:#ff4fa3', 'paint:#7a3cff', 'paint:#17171b', 'brick', 'rose',
  'panelling:honey', 'panelling:dark', 'paint:#9b4f3a', 'paint:#58b7f7', 'paint:#ffd23f', 'paint:#12b3a0', 'paint:#ff7a1a', 'paint:#a7a9b1', 'paint:#6cff4a'];
export const SKIN_FLOORS = ['oak', 'planks', 'linoleum', 'stone', 'checker', 'tile', 'carpet:#6d707a', 'carpet:#b3202a', 'carpet:#c98a4b', 'carpet:#2f4f7a', 'carpet:#3c6b3a', 'concrete'];
const CAP = 3, NEAR = 4;
export function recordRooms(book, tradeOf = () => null, fit = () => true) {
  const homes = Object.values(book).sort((a, b) => a.home < b.home ? -1 : a.home > b.home ? 1 : 0), out = {}, count = new Map(), dealt = [];
  for (const b of homes) {
    const h = idHash(b.home + '|' + b.agent), base0 = (TRADE_ROOMS[tradeOf(b.agent)] ?? ALL_ROOMS).filter(n => fit(b.agent, n));
    const base = base0.length ? base0 : ALL_ROOMS.filter(n => fit(b.agent, n)).length ? ALL_ROOMS.filter(n => fit(b.agent, n)) : ['trailer-fresh-start'], k = h % base.length, prefs = [...base.slice(k), ...base.slice(0, k)];
    const near = dealt.map(d => [Math.hypot(d.x - b.x, d.z - b.z), d.name]).sort((p, q) => p[0] - q[0]).slice(0, NEAR).map(p => p[1]);
    const name = prefs.find(n => !near.includes(n) && (count.get(n) ?? 0) < CAP) ?? prefs.slice().sort((p, q) => (count.get(p) ?? 0) - (count.get(q) ?? 0))[0];
    count.set(name, (count.get(name) ?? 0) + 1); dealt.push({ x: b.x, z: b.z, name });
    // the skin: two walls apart, a floor; a second home on the same layout never gets the first one's skin
    const used = new Set(Object.values(out).filter(o => o.name === name).map(o => o.skin.N + o.skin.floor));
    let n = h >>> 3, N, E, F; for (let t = 0; t < 12; t++, n = idHash(String(n))) { N = SKIN_WALLS[n % SKIN_WALLS.length]; E = SKIN_WALLS[(n >>> 7) % SKIN_WALLS.length]; F = SKIN_FLOORS[(n >>> 13) % SKIN_FLOORS.length]; if (E !== N && !used.has(N + F)) break; }
    out[b.agent] = { name, skin: { N, E, floor: F } };
  }
  return out;
}
// the layout in its skin (a copy: the preset stays as it is)
export function skinned(A, skin) { if (!skin) return A; return { ...A, room: { ...A.room, floor: skin.floor, walls: { ...A.room.walls, N: skin.N, E: skin.E, W: skin.E } } }; }
