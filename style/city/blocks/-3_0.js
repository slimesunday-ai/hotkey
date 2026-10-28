// Block -3,0 (x -96…-64, z 0…32) · Fit Street (DROP) · owner: the fitstreet location agent (LOCATIONS.md).
// Hand-crafting on top of generation: remove / move / replace generated items by id, tune lot specs, add one-offs, place people.
// Ids and coordinates come from ?audit=1 (red boxes) and audit.json. Format and examples: blocks/index.js. Empty = pure generation.
// Pass 1e (the refinement pass). The hero itself (heroes/fitstreet.js) carries the geometry fixes; this file only tidies the street
// and the people around it. People ids follow the cast order: the queue 0–6, bouncer 7, deli door 8, fruit 9, the roof party 10–13,
// stoop 14, walk-up door 15, bail.money 16, then the lots' life (17–23: fe, carry, carry, clerk, phone, lean, phone) and the hero's
// roof life (24 DJ, 25–26 dancers, 27 couch).
import { kerbX, kerbZ } from '../districts/frame.js';   // SPREAD: the x, z here are today's metres, carried by kerbX / kerbZ (the block's shift; a kerb
// thing kept to its kerb, a shopfront thing to the shopfront: style/city/SPREAD.md)

export default {
  // the street tree stood on the rope line in the middle of the DROP queue (the rope ran through its trunk)
  remove: ['-3_0·street·street-tree·0'],
  // the Hazel St taxi was parked in the east lane, where a walker (main.js) paces x = −94.8 straight through it: into the west lane,
  // facing south like that lane's traffic
  move: { '-3_0·traffic·taxi·0': { to: [kerbX(-97), 0, kerbZ(11.9)], rot: 0 } },   // (1 m off the west kerb)
  replace: {},
  lots: {},
  // add({ bank, stamp, A, SIDE, P, i, j }) { },
  people: {
    remove: [],
    move: {
      // the queue: 1.25 m apart instead of 1.15 (the big heads touched), still ending short of the rope's last post
      '-3_0·char·1': [-.1, 0, 0], '-3_0·char·2': [-.2, 0, 0], '-3_0·char·3': [-.3, 0, 0], '-3_0·char·4': [-.4, 0, 0], '-3_0·char·5': [-.5, 0, 0], '-3_0·char·6': [-.6, 0, 0],
      '-3_0·char·7': [0, 0, 0, 2.4],           // the bouncer faced the shop wall: now he watches the avenue and the corner
      '-3_0·char·12': [1.9, 0, -.1],           // the roof party spreads over the floor (the four were a huddle by the tank)
      '-3_0·char·13': [-.4, 0, .7, 0],         // … and one turns to the DJ, arms out
      // the walk-up's fire-escape sitter sat 0.3 m from the platform's end, so his head poked out through the end railing (and the
      // first flight starts 0.6 m in): he moves 3.9 m along the platform, where the stair above is 0.7 m clear of his head, and 0.15 m in, so his feet stop short of the front bars
      '-3_0·char·17': [-3.9, 0, .15],
      '-3_0·char·18': [0, 0, -1.1],            // FRESH CUTZ: the carrier stood inside the man at the barber's door, now passes by the curb (cleanup pass: right at the kerb, off the walkers' path)
      '-3_0·char·21': [.95, 0, .05],           // HOT SLICE: the caller stood inside the leaner at the door
    },
    // the queue gets an eighth, on her phone at the end of the rope (in front of the walk-up; clear of its sandwich board)
    add: [{ x: kerbX(-87.15), z: kerbZ(5.25), ry: Math.PI / 2 + .2, act: 'phone', seed: 0xd70b }],
  },
};
