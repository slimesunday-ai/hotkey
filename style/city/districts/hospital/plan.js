// ST. MERCY · the plan (pure data, world metres). The compound (4…5, −2…−1; x 128…192, z −64…0; interior x 134…188, z −60…−6) on
// Bishop Ave (W, an avenue), Central Ave (S, an avenue), 2nd St (N) and Orchard St (E). The sim's hospital (161, −33) is the middle of
// the compound, where its four blocks meet: the tower stands on it, so every block builds a quarter of the tower (lib.js slice).
//   NW (4,−2) the ER: the ambulance court off Bishop Ave under the EMERGENCY canopy, the ER wing, the oxygen yard
//   NE (5,−2) the back of house: the parking garage on Orchard St, the old 1889 wing (the morgue), the loading dock
//   SW (4,−1) the garden and the west half of the forecourt: the smokers' corner, the vending machines, the saint with the cone
//   SE (5,−1) the main entrance on Central Ave and the Medical Arts annex (MERCY RX, gifts, the injury doctor upstairs)
import { P as PITCH } from '../../../../world/city.js';
export const P = PITCH;   // (SPREAD: the plan's pitch)
export const IN = { x0: 134, z0: -60, x1: 188, z1: -6 };
export const PLACE = { x: 161, z: -33 };
// the tower: a two-storey podium (0.1 cubes) and a six-storey shaft (0.2 cubes) with the helipad on it, centred on the sim's place
export const TOWER = { rect: [151, -42, 171, -24], shaft: [152, -41, 170, -25], pod: 7.8, fl: 3.2, floors: 6 };
TOWER.top = 0.2 + TOWER.pod + TOWER.fl * TOWER.floors;                     // the shaft's roof (world y)
export const PAD = { rect: [154, -39, 168, -27], h: .4, cx: 161, cz: -33 };   // the helipad deck on the shaft roof
export const ER = { rect: [141, -56, 151, -36], h: 7.8, doors: [-46.2, -41.6] };       // the ER wing (its doors on the court side)
export const COURT = { rect: [134, -58, 141, -34] };                       // the ambulance court, open to Bishop Ave
export const CANOPY = { rect: [134.6, -52.4, 141, -37.6], y: 4.6 };         // the EMERGENCY canopy over the court
export const LOBBY = { rect: [148, -24, 174, -17.4], h: 4.6, door: 161 };   // the glass lobby on the forecourt
export const MARQUEE = { rect: [154, -17.3, 168, -12.8], y: 3.8 };         // the entrance canopy (clear of the lobby's fascia)
export const ANNEX = { rect: [176, -28, 188, -6], h: 10.8 };               // the Medical Arts building on Central Ave & Orchard St
export const GARAGE = { rect: [174, -60, 188, -34], lh: 3.0, levels: 3 };   // decks at 0, 3, 6; the roof deck at 9 m
export const OLD = { rect: [160, -58, 170, -48], h: 7.6 };                 // the 1889 wing: pathology and the morgue now
export const O2 = { x: 155.4, z: -52.6 };                                  // the liquid-oxygen tank in its fenced yard
// the ground (world rects): asphalt drives and yards, the garden, the forecourt's pavers
export const GROUND = {
  asph: [[134, -58, 141, -34], [151, -60, 174, -42], [171, -42, 174, -28], [174, -34, 188, -28]],
  grass: [[134, -60, 141, -58], [141, -60, 151, -56], [141, -36, 151, -34], [134, -34, 151, -24], [134, -24, 148, -17.4]],
  pave: [[134, -17.4, 176, -6], [171, -28, 174, -24], [174, -28, 176, -17.4]],
};
export const BUILDINGS = [TOWER.rect, ER.rect, LOBBY.rect, ANNEX.rect, GARAGE.rect, OLD.rect];
