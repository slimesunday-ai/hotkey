import { CITY_PLACES, STANDS, SITES, DISTRICTS } from './places.js';
import { idHash } from './addresses.js';

// Scene anchors only. The drawing owns roof access, the booth and the parked car.
// Use the exported SKYLOT rooftop, with a measured exterior in its own district.
const roof = CITY_PLACES['downtown.fringe-garage'];
const exterior = Object.values(CITY_PLACES).filter(p => p.dist === roof.dist && STANDS[p.id]?.length)
  .sort((a, b) => Math.hypot(a.x - roof.x, a.z - roof.z) - Math.hypot(b.x - roof.x, b.z - roof.z)
    || a.id.localeCompare(b.id))[0];
export const MEETING_PLACES = Object.freeze({
  diner: SITES.diner,
  rooftop: Object.freeze({ corePlace: 'sitdown-rooftop', cityPlace: roof.id, district: roof.dist,
    standPlace: exterior.id, note: 'SKYLOT roof scene; travel uses its measured district exterior.' }),
  car: Object.freeze({ ...DISTRICTS.suburbs, corePlace: 'sitdown-car',
    note: 'Parked-car scene at the public Pleasantview park anchor; no private destination.' }),
});

export function meetingPlace(a, b) {
  const pair = [a, b].sort();
  const venue = ['diner', 'rooftop', 'car'][idHash(JSON.stringify(pair)) % 3];
  return { venue, place: MEETING_PLACES[venue] };
}
