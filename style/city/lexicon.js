// The city's voice (pass 3 · signage): invented shop trades and names, delis, corps, plaques, ghost signs, painted ads, tags, sandwich
// boards and rooftop billboard colourways. Crime city × NYC × bodegas × Hypebeast × Dazed × collector culture; internet winks are
// kept to a few (STYLE.md §12). No real brands. The lists live in signage/lexicon.js (the shared signage system owns them) and keep
// pass 2's lengths, index-aligned, because gen.js deals them per block from its seeded rng: the words change, the layout does not.
// Every list is long on purpose: names are drawn without replacement per block, and the signage system allocates billboards, wall
// ads, ghost signs and shop names so the same one never shows twice within ~3 blocks (signage/alloc.js).
export { SHOPS, DELIS, CORPS, PLAQUES, GHOSTS, ADS, TAGS, BOARDS, BILLBOARDS } from './signage/lexicon.js';
// wall colours for sheds, fences, yard stuff (never grey)
export const YARD = [0xe8232a, 0x2f5bff, 0x25b84c, 0xffc21a, 0xff4fa3, 0x12b3a0, 0xff7a1a, 0x7a3cff];
// roof membranes: roofs are coloured too (lighter than walls, never plain grey)
// roof membranes (pass 1c): NEUTRALS only — white, light greys, warm concrete, gravel, two tar roofs. Colour lives in the set pieces.
// LOOK round (2026-10-06, art review item 6) · VALUE STRUCTURE FROM ABOVE: the twelve were ten whites / light greys and two tars, so the
// overview read as confetti (every block the same value). Now weighted to tar and gravel: four tars, five gravel / concrete greys,
// one light gravel, one warm concrete, one white membrane (the sun lifts a top face a lot: these read mid-grey from the overview), so the walls and the set pieces carry the colour against a darker roofscape.
// (length stays 12: roofColor picks by hash, so every building keeps its slot; far.js reads the same function, so tiers never change.)
export const ROOFS = [0x3a3940, 0x4e4c52, 0x55545b, 0x635e57, 0x6f7178, 0x77726a, 0x434147, 0xe6e2d8, 0x5d5a55, 0x85827c, 0x8f877a, 0x323137];
export const CALM = [0xc98a4b, 0xf7f7f2, 0xb9b4aa, 0x9a5a2a, 0xdcd8cf, 0x8f9a8c];   // neutral fences, sheds, tables
