// SIGNAGE · what counts as the same GAG, and how far a gag reads (owner: the signage agent). Shared by the census (census.mjs) and the
// swap table's tool (tools/signswap.mjs); browser-safe, no node APIs.
//   · a gag is a design CATEGORY, not an exact string: every lottery board is the same gag whatever its game or jackpot, every union
//     ad is the union gag. Ghost signs: the heritage trade (KESSLER & SONS FURS and FURS · STORED are both the FURS gag). Neon words,
//     throw-up words, shop names, the bodega's utility band and the parking-lot price sign: the words themselves.
//   · a repeat is a second copy of a gag in the same family within the family's VIEW distance: roof boards read from about 250 m
//     (the overheads), everything at street level from about 100 m.
//   · the census and the swap cover what the shared signage system letters. A district kit's own words (fam 'kit', names a kit writes
//     itself, a kit's own wall lines), hero lettering, set-piece sculptures and regulatory plates are not the signage system's.
export const VIEW = { roof: 250, wall: 100, ghost: 100, paste: 100, transit: 100, neon: 100, throw: 100, name: 100, util: 100, park: 100 };
export const FAMS = Object.keys(VIEW);
// section 1 (blocks i −3…2, j −3…0) keeps every sign it has, repeat or not
export const inSection1 = (i, j) => i >= -3 && i <= 2 && j >= -3 && j <= 0;
// a sign record (the sign log: fam, key, was = the allocator's own pick when the swap table replaced it, own, cat) → its gag, or null
// when the sign is not the signage system's. `lookup(key)` → the design (designs.js byKey, the live pools and the reserve).
export function gagOf(rec, lookup) {
  const fam = rec.fam, key = String(rec.key);
  if (!VIEW[fam] || rec.own === 'kit') return null;
  if (fam === 'name' || fam === 'neon' || fam === 'throw' || fam === 'util' || fam === 'park') return fam + ':' + key;
  const d = lookup(key); if (!d) return null;                                      // (a kit's own wall lines: painted as written)
  return fam === 'ghost' ? 'ghost:' + (d.gag || d.top || d.big) : 'cat:' + (d.gag || d.cat);
}
