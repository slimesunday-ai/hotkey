import { DESIGNS as DENIM } from './pants-designs/denim.js';
import { DESIGNS as SPORT } from './pants-designs/sport.js';

// Painters only return color/material. The approved forms own all geometry.
export const PANTS_COLLECTION = Object.fromEntries([...DENIM, ...SPORT].map(d => [d.id, d]));
