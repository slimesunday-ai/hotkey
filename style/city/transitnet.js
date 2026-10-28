// MOVEMENT W2 · THE TRANSIT NETWORK (MOVEMENT.md §5): the lines, their stops in order, colours and headways, plus the subway stations
// the network needs beyond the three reserved kiosks (PROPOSED slots: listed here, not yet built; the kits are untouched this pass).
// Pure data (one import: world/city.js remap, SPREAD): tools/export-world.mjs builds the export from it (world/export/world.json: transit), and the paper map's
// transit layer (ui/map/transit.js) reads the export it makes. Stop ids are the reserved slot ids (simstate/reserved.json); a station
// or stop id is never re-keyed.
//
// The network, in one breath: two subway lines cross at WASHINGTON. The TIDE line runs north–south from Low Tide Docks through the Yards
// (Market Av) and Glasswall (1st St, Washington) to Pleasantview Park; the NEON line runs west–east from Sunny Acres and the mall gate
// past Fit Street and under Neon Row to St. Mercy. Two LOCALS (SUBWAY PLAN, 2026-10-09: they took the buses' riders) run at the buses' own
// pace — 8 m/s, every 10 game min, 1 cr: the HARBOR under the old 4, from Low Tide by Main St (the Heap), Elm St and Sunny Acres to
// Blackpine, and the UNION under the old 22, from Route 9 (Motel 9) by Pleasantview and Gatehill to Elm St, where the two meet. Taxis:
// three stands, and a kerb hail anywhere.
// BUSES OUT (2026-10-09, slime: the bus timetable held the lights so long that pedestrians never got WALK at 11–19 junctions, and it fought
// every other vehicle): the 4, the 14 and the 22 are gone, the subway takes their riders. Their shelters stay as street furniture, NO SVC
// on the board (the stops keep their ids: the export's attach nodes).
//
// Colours are the city's own (STYLE.md §2 walls, §12 signs); names are invented. No real transit brand, line letter scheme or colour map.

import { remap, SPREAD } from '../../world/city.js';
import { kerbX, kerbZ } from './districts/frame.js';   // (a station whose slot is on a street's sidewalk: the kits' own kerb carry)
// SPREAD · every x, z here is today's metres through remap (a station marks its block's lot: the block's shift; a via point in a street
// stays on its side of the line). (The one import: the plan's geometry; the rest is data.)
const rm = (x, z) => { const [X, Z] = remap(x, z); return { x: X, z: Z }; };
// ST(today's, the spread's): today's at SPREAD 0, byte for byte.
const ST = (a, b) => SPREAD ? b : a;

export const TRANSIT_VERSION = 1;

// the mode numbers the network is timed with (MOVEMENT.md §2's first guess; the sim's dry-run bench tunes them): REAL seconds and metres
// (W3b, 2026-10-07: baked to the sim's MOVE table, sim2/rules.mjs on sim/movement — the sim is authoritative for these numbers, the map for
// the geometry; the taxi hail 20 → 10 s, and back to 20 with CAB TRAFFIC, 2026-10-10: the cab is no longer meant to be fast). A line with its own clock (LINES: speed, dwell) runs at that, not at subwaySpeed / subwayDwell.
export const TIMING = {
  subwaySpeed: 16, subwayDwell: 8,       // m/s between stations; s at every intermediate station (a line without its own clock)
  stairs: 15,                            // s down from the street to the platform (and the same back up): ~30 s a ride
  transfer: 20,                          // s to change lines inside a station (WASHINGTON), plus the wait for the other line
  taxiStandWait: 5, taxiHailWait: 20,    // s for a cab: at a stand (a short wait) or hailed at the kerb
};

// subway stations: the kiosks (kit-built, districts/downtown.js) + the ones this network proposed, built since (subway stations agent,
// 2026-10-08) as open stair entrances on the lots behind the sidewalk (entry: 'stairs' in their kits: districts/industrial.js, suburbs.js,
// mall.js; transit.js), centred on the slot along the street — each (x, z) is its kit's slot (simstate/reserved.json), facing its street
export const STATIONS = [
  { id: 'subway-market-kent', name: 'MARKET AV', ...rm(47.5, -120.5), face: '-z', built: true },
  { id: 'subway-1st-kent', name: '1ST ST', ...rm(51.5, -39.5), face: '+z', built: true },
  { id: 'subway-washington', name: 'WASHINGTON', ...rm(44.5, 24.5), face: '+z', built: true },
  { id: 'subway-low-tide', name: 'LOW TIDE', ...rm(72.5, -216.5), face: '-z', built: true, kit: 'industrial', block: [2, -7],
    why: 'the docks have no station: on Dock St across from the shift office (the docks place is 24 m away), the Yards\' lot row (W3b: declared in districts/industrial.js; stations agent: open stairs set into the truck court\'s fence, west of its gate — x 79.5 was the gate)' },
  { id: 'subway-pleasantview', name: 'PLEASANTVIEW', ...rm(-15, 166.5), face: '-z', built: true, kit: 'suburbs', block: [-1, 5],
    why: 'the suburbs are all plan lots (ids are law), so the stairs go down in the park on Oak St (stations agent: on the lawn between the north path and the playground — x −9.5 was the playground)' },
  { id: 'subway-sunny-acres', name: 'SUNNY ACRES', ...rm(-188, 7.5), face: '-z', built: true, kit: 'mall', block: [-6, 0],
    why: 'the spawn: on the dead mall\'s lot frontage on Central Ave, across from the trailer park (60 m to its middle, 47 m to the mall\'s; stations agent: open stairs inside one parking stall)' },
  { id: 'subway-fit-street', name: 'FIT ST', ...rm(-79.5, -7.5), face: '+z', built: true, kit: 'downtown', block: [-3, -1],
    why: 'across Central Ave from Fit Street (the morning DROP) and a block from Neon Row\'s Grand Ave end (W3b: on L7, the 3-storey brownstone; W2\'s spot 4 m east was L3, a walk-up with 5 registry apartments)' },
  { id: 'subway-st-mercy', name: 'ST MERCY', ...rm(109.5, -7.5), face: '+z', built: true, kit: 'downtown', block: [3, -1],
    why: 'the hospital side: the east-medical fringe on Central Ave, across Bishop Ave from the ER\'s bus stop and taxi stand (W3b: on L5, a one-storey shop; W2\'s spot 7 m east was a 6-storey office)' },
  // SUBWAY PLAN (2026-10-09, slime: the subway replaces the buses; the analyst's spec-5): five open stair entrances on the lots at the old
  // bus stops (entry: 'stairs' in their kits), each (x, z) its kit's slot — the spec's place at +4 through remap
  { id: 'subway-blackpine', name: 'BLACKPINE', x: kerbX(-248.5), z: kerbZ(29.4), face: '-x', built: true, kit: 'mall', block: [-8, 0],
    why: 'the woods\' trailhead and the mall: on the dead mall\'s north lot, its Birch St frontage, across Birch St from the old BLACKPINE shelter' },
  { id: 'subway-elm', name: 'ELM ST', x: kerbX(-167.5), z: kerbZ(-35.3), face: '+x', built: true, kit: 'trailer', block: [-6, -2],
    why: 'Sunny Acres\' Elm St gate, where the HARBOR and the UNION meet: inside the park on its Elm St frontage, 7 m north of the gate (the old SUNNY ACRES shelter), clear of the park office\'s north wall' },
  { id: 'subway-heap', name: 'MAIN ST', ...rm(7.5, -175.55), face: '-x', built: true, kit: 'industrial', block: [0, -6],
    why: 'the Heap: on the Yards\' Main St lot across Main St from the Heap\'s gate, 11 m north of the old MAIN ST shelter, set into the yard\'s fence between its gate and the shed' },
  { id: 'subway-motel', name: 'ROUTE 9', ...rm(234.5, 179), face: '-x', built: true, kit: 'highway', block: [7, 5],
    why: 'Motel 9 on Route 9: on the motel\'s Route 9 frontage at the court\'s mouth, under the pole sign (the analyst\'s fallback z 202, 1 m north of it, clear of the pool\'s fence: the spec\'s z 190 was the office)' },
  { id: 'subway-gatehill', name: 'GATEHILL', x: kerbX(-166.75), z: kerbZ(122.5), face: '+z', built: true, kit: 'forest', block: [-6, 3],
    why: 'Gatehill: across Union Ave from OFFSHORE, on the woods\' lawn behind the hedge (the spec\'s site in OFFSHORE\'s showroom window was not clean: the same x, 17 m north)' },
];

// lines: stops in order (both directions run), headway in GAME minutes, offset = the first departure from the first stop after midnight
// (game minutes; then every headway, all day and night); `offsets: { fwd, rev }` gives each direction its own (game min; else rev runs half
// a headway after fwd). A line's own clock (SUBWAY PLAN 2026-10-09): `speed` m/s between stations, `dwell` s at each intermediate one and
// `fare` cr; without them the line runs at TIMING.subwaySpeed / subwayDwell and costs the mode's fare (the export's modes.subway).
// The runs are straight tunnels between consecutive stations (tools/export-world.mjs): arr = the previous dep + metres / speed.
export const LINES = [
  { id: 'tide', kind: 'subway', name: 'TIDE LINE', bullet: 'T', colour: '#2F5BFF', headwayMin: 6, offsetMin: 0,
    stops: ['subway-low-tide', 'subway-market-kent', 'subway-1st-kent', 'subway-washington', 'subway-pleasantview'],
    blurb: 'Low Tide Docks · the Yards · Glasswall · Pleasantview Park' },
  { id: 'neon', kind: 'subway', name: 'NEON LINE', bullet: 'N', colour: '#FF4FA3', headwayMin: 6, offsetMin: 3,
    stops: ['subway-sunny-acres', 'subway-fit-street', 'subway-washington', 'subway-st-mercy'],
    blurb: 'Sunny Acres + the mall · Fit Street · Glasswall · St. Mercy' },
  // SUBWAY PLAN (2026-10-09) · the two locals, on the buses' own clock (the analyst's spec-5: 8 m/s, every 10 game min, 10 s at each station,
  // 1 cr; the UNION's offsets set so its main change at ELM ST — toward Elm St, then the HARBOR toward Blackpine — waits half a headway)
  { id: 'harbor', kind: 'subway', name: 'HARBOR LINE', bullet: 'H', colour: '#FF7A1A', headwayMin: 10, offsetMin: 0, offsets: { fwd: 0, rev: 5 }, speed: 8, dwell: 10, fare: 1,
    stops: ['subway-low-tide', 'subway-heap', 'subway-elm', 'subway-sunny-acres', 'subway-blackpine'],
    blurb: 'the local under the old 4: Low Tide · Main St (the Heap) · Elm St (Sunny Acres) · the mall · Blackpine' },
  { id: 'union', kind: 'subway', name: 'UNION LINE', bullet: 'U', colour: '#25B84C', headwayMin: 10, offsetMin: 1.26, offsets: { fwd: 1.26, rev: 1.15 }, speed: 8, dwell: 10, fare: 1,
    stops: ['subway-motel', 'subway-pleasantview', 'subway-gatehill', 'subway-elm'],
    blurb: 'the local under the old 22: Route 9 (Motel 9) · Pleasantview · Gatehill · Elm St' },
];
export const TAXI_STANDS = ['taxi-jay', 'taxi-union', 'taxi-st-mercy'];
// HOW A TAXI RIDE IS BOOKED, per spread: 'flat' (11 m/s door to door, MOVEMENT.md §2's first design) or 'traffic' (CAB TRAFFIC,
// 2026-10-10, slime: "cabs can arrive when they arrive like normal traffic"; it replaces the TAXI CLOCK's 'drive', 2026-10-09): the cab is
// an ordinary car of the city's traffic, so a ride is booked as that car drives it alone from its departure second — its speed, its
// corners, and the red lights it meets on the fixed signal clock (world/export/travel.mjs carDrive; the export carries the lights and the
// car: tools/export-world.mjs) — + out s to get out at the kerb, + pull s for a cab that pulls back out of a stand's kerb slot. With no
// departure second (the menus, the dense table) a ride is the mean over `phases` departures across the 44 s cycle. What the booking can't
// know — cars queued ahead, walkers still in the road — makes a cab late or early on screen (the residual: tools/cabresidual.mjs).
// The cab is not meant to be fast: its one advantage is that a WANTED rider skips the station cops (sim2/rules.mjs).
export const TAXI_BOOK = ST('flat', 'traffic');
export const TAXI_DRIVE = { out: 3, pull: 1.6, step: .1, phases: 8 };   // (the car itself is traffic/sim.js CAR's: the export writes it in)
// THE STANDS' KERB (CAB TRAFFIC, 2026-10-10; the pilot's step 1, the step-1 kerb pilot; a local archive, not in this repository): at ST MERCY the stand
// point was inside its own sign post, the cab's kerb point in Central's only westbound lane 1.1 m short of 5,0's stop line, and a second
// cab was put down inside the first; the kerb lane beside the stand is free from x 186.7 to 210.5 (the forecourt's own taxi stands west of
// it): room for 4. Per stand: `wait` — where its riders stand (the export's point for the stand: clear of the sign, the hydrant and the
// lanes; at ST MERCY a spot stands.js's own rules pass), `slots` — kerb-lane bays [x, z] (the body's centre) a cab pulls into out of the
// travel lane, nearest the stand first (traffic/cabs.js; street.js keeps parked cars off them). JAY ST's sign is on the travel lane's side
// of a one-way (no kerb lane there): its cab stands in the lane, 6 m short of the line, as at a kerb hail.
export const TAXI_KERB = ST({}, {
  'taxi-st-mercy': { wait: [190.2, -4.75], slots: [[189.6, -3], [195.6, -3], [201.6, -3], [207.6, -3]] },
  'taxi-union': { wait: [-242.1, 148.75], slots: [[-241.5, 147], [-235.5, 147], [-229.5, 147]] },
  'taxi-jay': { wait: [-32.55, 57.9], slots: [] },
});
