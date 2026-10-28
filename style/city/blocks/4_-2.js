// ST. MERCY · block 4,−2 (the ER bay) · owner: the St. Mercy / Route 9 agent. The block is built by heroes/hospital-er.js; this file only
// swaps the traffic car the core stamps in Bishop Ave's near lane, in front of the ER camera, for one whose cabin is closed (the core
// car's side windows open onto a hollow cabin: requested of the systems agent in PASS-hospital-highway.md). Same colour, same place.
import { sedan } from '../districts/hospital/props.js';

export default {
  replace: { '4_-2·traffic·car·0': () => sedan(0x8a3cff) },
};
