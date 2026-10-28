// C1-3 · the show's drawn timing, in island minutes after 9:05 p.m. (presentation only; no rule reads it). Shared by draw.js and
// stage/record.js: the show's trips arrive (or cut to their arrival) by SETTLE, its scenes play from SETTLE to the show's end, and
// a won collar's arrest hands its target to Iron Island by ARREST_END. Any other trip cuts to its arrival after MAX_TRIP.
export const SETTLE = 5;
export const ARREST_END = 9;
export const MAX_TRIP = 90;
