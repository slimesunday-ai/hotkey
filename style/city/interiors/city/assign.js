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
