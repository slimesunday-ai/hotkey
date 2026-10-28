// Home objects · SET DRESSING pass (2026-09-29) · the one piece the preset rooms were missing: a gallery plinth, so a display zone has
// somewhere for the owner's figure, bust or trophy to stand at eye level (a surface slot on its top) instead of on the floor.
// Base = no stakes: never stolen, no buff (the layouts use it; what stands on it comes through a slot).
import { def, K, pick, shade, hash } from './lib.js';
import { base } from './bits.js';

export const plinth = def({ id: 'plinth', name: 'Plinth', cat: 'decor', place: 'floor', foot: [3, 3], h: 0.9, tops: [0.9],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['gallery', 'display', 'plinth', 'kit'], variants: 3, vnames: ['white cube', 'black lacquer', 'marble'], far: true,
  game: base(),
  build(V, { variant = 0 } = {}) {
    const c = pick([K.white, 0x1f1f24, 0xece8df], variant), l = variant === 1 ? 1 : 0;
    const face = variant === 2 ? (x, y, z) => { const v = hash(x + y, z - y, 9); return v > .93 ? 0x9a9aa6 : v > .86 ? 0xc9ced6 : c; } : c;   // marble: a few grey veins
    V.box(1, 0, 1, 14, 1, 14, shade(c, variant === 1 ? 1.6 : .72));                                                       // a shadow-gap foot
    V.box(0, 1, 0, 15, 17, 15, face, l);                                                                                  // the block
    V.box(0, 17, 0, 15, 18, 15, shade(c, variant === 1 ? 1.25 : .94), l);                                                   // the top, a shade apart
  } });

export const DRESS = [plinth];
