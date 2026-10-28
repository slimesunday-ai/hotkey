// THE CITY'S CAST (2026-10-02, cast/fresh-traits) · every character the city shows is built from the fresh character system
// (world/cast/: ai-city-fresh's construction, registry and fit rules, copied by tools/sync-cast.mjs) and dressed from the CAST:
// every trait in the fresh registry that slime did not KILL (keep and undecided ship alike: "i already removed what doesnt work").
// The kills and slime's RANKS are read when this module loads, from the curation snapshot the sync copied (world/cast/curation.js),
// so a re-sync after new kills, ranks or traits changes the city with no edit here (walkers roll at load; the baked block cast
// follows on the next tools/bake.mjs: this file is in the bake's source hash).
// Every trait is worn in its base colours (one colour scheme per trait).
//
// This module is the city's one door to characters. It keeps the old world/chars.js API the city was written against
// (S, MATS, build, pose, compose, look, LOOKS, rollLook), so walkers (pedbake.js), the block cast (castspec.js / charbake.js),
// roof dancers, set pieces and giants, signage figures (signage/art.js), interiors, the Mainland and the live sim's agents all come
// through here. The old monolith (world/chars.js) stays for the trait pages, the old studio and the old anim lab only.
// Worker-safe (no DOM); `three` is only reached through world/cast/chars.js.
//
// TWO POOLS (2026-10-07, NPC integration). slime: "rooftop dancers, drop lines and set-piece crowds should wear the current agent trait
// system to keep some vibes" · "random walkers should get NPC stuff". So a viewer tells a background civilian from a real agent at a
// glance. rollLook(seed, { pool }) dresses a person from one pool:
//   'agent' (the default)  the agents' traits (registry REG: hype streetwear, chains, grills, fine-detail logos) by SLOT_P and the tiers
//   'npc'                  the NPC pool (registry NPC_REG, world/cast/fresh/npc/: plain, muted, all common) by NPC_SLOT_P: never an
//                          agent-only slot (face ink, ears, accessories have no NPC traits), never an agent skin, eyes or mouth (grills)
// Kills and slime's ranks apply to both (the curation keys an NPC trait '<slot>/npc_<id>'). Who wears which:
//   npc    the random street walkers (pedbake.js, the walker pool) · shop clerks and the people in shop interiors and at windows
//          (castspec.js: act 'clerk' / 'window', A.clerk, A.shops)
//   agent  everything else: roof dancers, the DROP line and every named handle, set-piece and hero crowds, corners, giants, the live
//          and replay sim agents, the Mainland (residents, peers, you), a home's own resident (the owner's agent), signage figures
import { REG, SLOTS, mulberry32 } from '../../world/cast/chars.js';
import { NPC_REG } from '../../world/cast/fresh/index.js';   // (the NPC pool: the same registry module chars.js reads, its second pool)
import CURATION from '../../world/cast/curation.js';
export { S, MATS, build, pose, compose, dispose, look, mannequin, faceGrid, traitOr, skinOf, Grid, Vox, voxGeo, shade, lerpHex, hash3, mulberry32, SLOTS, REG, PROBLEMS } from '../../world/cast/chars.js';

// ── the cast: slot → [entry] (registry order), killed traits left out
export const KILLED = new Set(Object.entries(CURATION.traits || {}).filter(([, e]) => e && e.status === 'kill').map(([k]) => k));
export const CAST = Object.fromEntries(SLOTS.map(s => [s, Object.values(REG[s] || {}).filter(t => !KILLED.has(t.key))]));
// the NPC pool's cast, same shape (an empty slot, e.g. face ink, rolls nothing)
export const NPC_CAST = Object.fromEntries(SLOTS.map(s => [s, Object.values(NPC_REG[s] || {}).filter(t => !KILLED.has(t.key))]));
// slime's RANK per trait (the Trait Studio's ranking mode: common | rare | epic | grail). It overrides the designer's tier below.
export const RANKS = new Map(Object.entries(CURATION.traits || {}).filter(([, e]) => e && ['common', 'rare', 'epic', 'grail'].includes(e.rank)).map(([k, e]) => [k, e.rank]));
const inCast = (slot, id) => !!id && (CAST[slot]?.some(t => t.id === id) || NPC_CAST[slot]?.some(t => t.id === id));   // (either pool: ids never overlap)

// ── ROLL WEIGHTS (tunable). A believable crowd, not a costume party: everyday pieces dominate, loud pieces are seasoning.
// TIER_W: a trait's weight by its EFFECTIVE tier: slime's rank (RANKS) when he has ranked it, else the designer's (the registry's
// `tier`; a fresh skin states it at the head of `why`; an imported trait without a tier counts as common unless TIER_OF says
// otherwise). Per slot that makes common ≈ 70–80 % of picks, grail well under 1 %.
export const TIER_W = { common: 1, rare: .3, epic: .08, grail: .02 };
// novelty skins the registry leaves untiered (a toon, a vinyl toy, a gold-plated body): rare in a street crowd
export const TIER_OF = { 'skin/old_alien': 'epic', 'skin/old_opus_vinyl': 'epic', 'skin/old_opus_gold': 'grail' };
// SLOT_P: the share of people wearing something in each slot. Skin, eyes, mouth, bottom and shoes: always (the base kit has no
// mouth, so every face gets one from the cast); a top nearly always; hair most of the time; the rest some of the time.
// held: about 1 in 10 carries something (a thing in the hand reads as rare on the street), then the tier weights pick which.
// (The held slot only rolls once the synced registry has it: world/cast/fresh/index.js SLOTS. Until a re-sync it isn't there.)
export const SLOT_P = { skin: 1, eyes: 1, mouth: 1, bottom: 1, shoes: 1, top: .94, hair: .82, hat: .3, eyewear: .2, ears: .22, mark: .12, acc: .16, held: .1 };
// NPC_SLOT_P: the NPC pool's own chances. Everybody is dressed (hair, top, bottom, shoes always: a civilian is never bare-headed or
// shirtless by roll); a hat, glasses or something in the hand now and then; the agent-only slots never (and they have no NPC traits).
export const NPC_SLOT_P = { skin: 1, eyes: 1, mouth: 1, hair: 1, top: 1, bottom: 1, shoes: 1, hat: .15, eyewear: .15, held: .1, ears: 0, mark: 0, acc: 0 };
const TIERS = new Set(Object.keys(TIER_W));
export const designerTierOf = t => { if (TIERS.has(t.tier)) return t.tier; if (TIER_OF[t.key]) return TIER_OF[t.key]; const m = /^\s*(common|rare|epic|grail)\b/i.exec(t.why || ''); return m ? m[1].toLowerCase() : 'common'; };
export const tierOf = t => RANKS.get(t.key) || designerTierOf(t);   // the effective tier: slime's rank, else the designer's
const tableOf = C => Object.fromEntries(SLOTS.map(s => { const list = C[s], cum = []; let sum = 0; for (const t of list) { sum += TIER_W[tierOf(t)]; cum.push(sum); } return [s, { list, cum, sum }]; }));
const TABLE = tableOf(CAST), NPC_TABLE = tableOf(NPC_CAST);   // (every NPC trait is common, so its picks are even unless slime ranks one)
const pickIn = (slot, r, tables = TABLE) => { const T = tables[slot]; if (!T.list.length) return null; const u = r() * T.sum; let lo = 0, hi = T.cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (T.cum[m] > u) hi = m; else lo = m + 1; } return T.list[lo].id; };
const STRING = new Set(['skin', 'eyes', 'mouth', 'mark']);
const put = (L, slot, id) => { L[slot] = STRING.has(slot) ? (id || (slot === 'mark' ? 'none' : 'base')) : { id: id || 'none' }; };

// a look from a seed: the same seed always gives the same person. o.pool: 'agent' (default) | 'npc' (TWO POOLS, above).
// o.wear: slot → cast id laid over the roll (an outfit). An agent roll is exactly what it was before the NPC pool (same seed, same look).
export function rollLook(seed, o = {}) {
  const npc = o.pool === 'npc', s = (seed >>> 0) & 0xffffffff, r = mulberry32(s ^ (npc ? 0x6e70c1a5 : 0x9e3779b9)), P = npc ? NPC_SLOT_P : SLOT_P, T = npc ? NPC_TABLE : TABLE;
  const L = { handle: (npc ? 'npc_' : 'roll_') + (s & 0xffffff).toString(16).padStart(4, '0') };
  for (const slot of SLOTS) { const p = P[slot] ?? 0, on = p >= 1 || r() < p, id = pickIn(slot, r, T); put(L, slot, on ? id : null); }   // (always draw both numbers: one slot's odds never shift another's pick)
  if (o.wear) wear(L, o.wear);
  return L;
}
// lay cast traits over a look (an outfit, a set piece's uniform); an id that isn't in the cast (killed, or gone upstream) is skipped
export function wear(L, w) { for (const [slot, id] of Object.entries(w || {})) if (SLOTS.includes(slot) && (id === 'none' || inCast(slot, id))) put(L, slot, id === 'none' ? null : id); return L; }
// OUTFITS: uniforms set pieces ask for by name (A.life entries carry `outfit`, castspec.js lays it over the person's roll)
export const OUTFITS = {
  county: { top: 'iron_island', bottom: 'iron_island_issue' },   // Iron Island issue: the county orange (jail yard, sally port, the sim's jailed agents)
  officer: { top: 'precinct_blues', hat: 'precinct_cap' },        // a corrections / precinct officer
  // C1-3: a hooded attacker's stand-in on the record path (stage/record.js), one anonymous look; ids not in the cast are skipped
  hooded: { top: 'hoodie', hat: 'beanie', eyewear: 'none', held: 'none' },
};

// ── THE NAMED CAST (the city's handles: the DROP queue, door, deli, roof dancers, plaza, giants, sim agents, signage). The old looks
// are translated slot by slot: an old trait that survives in the cast (imported as old_<id>, or a fresh trait of the same id) is
// kept; any other slot the old look filled gets a cast trait rolled from the handle; a look with no mouth gets one. A few are set by
// hand where the old look was the point (NAMED_FIX). Order = the old LOOKS order (the sim's `look` index used it).
const OLD = [
  ['xXbadvibesXx', { skin: 'terracotta', hair: 'dreads', eyes: 'bored', mouth: 'pout', mark: '404', top: 'hoodie', bottom: 'baggy', shoes: 'dad', ears: 'studs' }],
  ['rawr_means_404', { skin: 'pale', hair: 'swoop', eyes: 'crying', mouth: 'frown', top: 'tee', bottom: 'track', shoes: 'checker' }],
  ['56kballer', { skin: 'tan', hair: 'spikes', eyewear: 'wrap', mouth: 'gold', top: 'jersey', bottom: 'shorts', shoes: 'hightop' }],
  ['anon_inc', { skin: 'brown', hat: 'balaclava', eyes: 'mean', top: 'puffer', bottom: 'cargo', shoes: 'foam' }],
  ['bluescreen.bucket', { skin: 'deep', hat: 'bucket', eyewear: 'shutter', mouth: 'grill', top: 'varsity', bottom: 'track', shoes: 'slides' }],
  ['dealwithit.mp3', { skin: 'emoji', hair: 'buzz', eyewear: 'dwi', mouth: 'smirk', ears: 'phones', top: 'hoodie', bottom: 'shorts', shoes: 'dad' }],
  ['missing_texture', { skin: 'missing', hair: 'buzz', eyes: 'sleepy', mouth: 'tongue', top: 'tank', bottom: 'cargo', shoes: 'foam' }],
  ['www.girl', { skin: 'pale', hair: 'long', hat: 'trucker', eyes: 'wink', mouth: 'gum', mark: 'blush', top: 'babytee', bottom: 'flares', shoes: 'checker' }],
  ['macpaint.artist', { skin: 'happymac', hat: 'beret', top: 'track', bottom: 'cargo', shoes: 'platinum' }],
  ['fatal.exception', { skin: 'bsod', eyes: 'side', mouth: 'flat', eyewear: 'cursorshades', top: 'desktop', bottom: 'track', shoes: 'button' }],
  ['cmd_q', { skin: 'chrome', hat: 'halo', eyes: 'sparkle', mouth: 'o', top: 'tee', bottom: 'baggy', shoes: 'platinum' }],
  ['dialog.box', { skin: 'dialog', hat: 'cursorclip', eyes: 'shook', mouth: 'grimace', eyewear: 'anaglyph', top: 'tee', bottom: 'cargo', shoes: 'button' }],
  ['bail.money', { skin: 'deep', hat: 'fitted', eyes: 'mean', mouth: 'iced', top: 'velour', bottom: 'track', shoes: 'boots' }],
  ['county.blues', { skin: 'tan', hair: 'buzz', eyes: 'bored', mouth: 'flat', mark: 'barcode', top: 'jumpsuit', bottom: 'jumpsuit', shoes: 'slides' }],
  ['tag.crew', { skin: 'pale', hat: 'bandana', eyes: 'side', mouth: 'smirk', mark: 'scar', top: 'flannel', bottom: 'camo', shoes: 'hightop' }],
  ['late.night', { skin: 'brown', hat: 'fitted', eyes: 'sleepy', mouth: 'gold', ears: 'hoops', top: 'puffer', bottom: 'sweats', shoes: 'foam' }],
];
// by hand: the county jumpsuit stays county issue; cmd_q (Lady Justice's figure on the Hall of Justice) is the gilded one in the halo
// (the chrome skin was killed); dealwithit.mp3 keeps its shades
export const NAMED_FIX = {
  'county.blues': { ...OUTFITS.county },
  'cmd_q': { skin: 'dipped', hat: 'old_halo', eyes: 'old_sparkle', eyewear: 'old_dwi' },
  // 'justice' is not a handle in LOOKS: the Hall of Justice's 4× statue (castspec.js giants), blindfolded in the dark shades
  'justice': { skin: 'dipped', hat: 'none', hair: 'none', eyes: 'old_sparkle', eyewear: 'old_dwi', top: 'neon_row_silk' },
};
const hashS = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
export function namedLook(handle) {
  const old = (OLD.find(o => o[0] === handle) || [handle, null])[1], roll = rollLook(hashS(handle)), L = { handle };
  if (!old) return wear(Object.assign(roll, { handle }), NAMED_FIX[handle]);   // (a handle with no old look: its own roll)
  for (const slot of SLOTS) { const v = old && old[slot], id = v && (inCast(slot, 'old_' + v) ? 'old_' + v : inCast(slot, v) ? v : null);
    const rolled = STRING.has(slot) ? (slot === 'mark' ? (roll.mark !== 'none' ? roll.mark : null) : roll[slot]) : roll[slot].id !== 'none' ? roll[slot].id : null;
    put(L, slot, id || (v || ['skin', 'eyes', 'mouth', 'bottom', 'shoes', 'top'].includes(slot) ? (rolled || pickIn(slot, mulberry32(hashS(handle + slot)))) : null)); }
  if (NAMED_FIX[handle]) wear(L, NAMED_FIX[handle]);
  return L;
}
export const LOOKS = OLD.map(([h]) => namedLook(h));

// what's in the cast, per slot (the report line; ?castinfo prints it)
export const castInfo = () => ({ kills: KILLED.size, ranks: RANKS.size, perSlot: Object.fromEntries(SLOTS.map(s => [s, CAST[s].length])), total: SLOTS.reduce((n, s) => n + CAST[s].length, 0), SLOT_P, TIER_W,
  npc: { perSlot: Object.fromEntries(SLOTS.map(s => [s, NPC_CAST[s].length])), total: SLOTS.reduce((n, s) => n + NPC_CAST[s].length, 0), SLOT_P: NPC_SLOT_P },
  tiers: Object.fromEntries(SLOTS.map(s => [s, CAST[s].reduce((o, t) => (o[tierOf(t)] = (o[tierOf(t)] || 0) + 1, o), {})])) });
