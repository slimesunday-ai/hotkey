// Palette order: cloth, shadow panel, statement panel, binding.
// Eight knee-length cuts and two compact sport cuts; socks remain independent.
export const DESIGNS = [
  {
    id: 'drop_short_express_lane', name: 'Express Lane', category: 'shorts', form: 'longshorts', tier: 'rare',
    why: 'A long running short with a broad outside racing panel and a clean contrasting lower edge.',
    cw: [
      ['Signal Red', 0xe63c31, 0x25252b, 0xf1e9d9, 0x9b191f],
      ['Track Blue', 0x185bea, 0x171f3b, 0xc7ec3b, 0xf0efdf],
      ['Violet Heat', 0x763be6, 0x25202d, 0xff862f, 0xeae7ef],
    ],
    paint(q, [C, D, A, T]) {
      if (!q.covered) return [q.c, q.l];
      if (q.u >= 2 && q.z <= 0) return [A, 0];
      if (q.y === 6 && q.z >= 0) return [T, 0];
      if (q.z < -1) return [D, 0];
      return [C, 0];
    },
  },
  {
    id: 'drop_short_away_fixture', name: 'Away Fixture', category: 'shorts', form: 'longshorts', tier: 'common',
    why: 'Oversized football proportions with opposing solid legs and a shared high waist panel.',
    cw: [
      ['Royal / Chalk', 0x235fe2, 0xede9de, 0xef4538, 0x222733],
      ['Orange / Ink', 0xfa7627, 0x242739, 0xe6e8eb, 0x995233],
      ['Lime / Grape', 0xcde532, 0x5633a5, 0xeae6ee, 0x272331],
    ],
    paint(q, [C, D, A, T]) {
      if (!q.covered) return [q.c, q.l];
      if (q.y >= 8) return [T, 0];
      if (q.u === 3 && q.z <= 0) return [A, 0];
      return [q.side < 0 ? C : D, 0];
    },
  },
  {
    id: 'drop_short_heat_ledger', name: 'Heat Ledger', category: 'shorts', form: 'longshorts', tier: 'epic',
    why: 'An editorial three-level wrap: bright upper cloth, dark middle belt and an oversized electric hem.',
    cw: [
      ['Hot Coral', 0xf5554a, 0x252530, 0xbdef31, 0xf0ede5],
      ['Cobalt Sun', 0x295ee7, 0x1c2340, 0xffc829, 0xe7e9ed],
      ['Lilac Circuit', 0xc49ef2, 0x443358, 0xff6329, 0xf1e9dd],
    ],
    paint(q, [C, D, A, T]) {
      if (!q.covered) return [q.c, q.l];
      if (q.y === 6) return [A, 0];
      if (q.y === 7) return [D, 0];
      if (q.u === 3 && q.z <= -1) return [T, 0];
      return [C, 0];
    },
  },
  {
    id: 'drop_short_curb_relay', name: 'Curb Relay', category: 'shorts', form: 'longshorts', tier: 'rare',
    why: 'A wide diagonal wedge climbs each long leg, like a relay jersey cut into shorts.',
    cw: [
      ['Taxi Relay', 0xf2c72d, 0x24262c, 0xefe8da, 0xe5522c],
      ['Race Green', 0x149568, 0x173c39, 0xf3e7d3, 0xf45b3d],
      ['Pool Relay', 0x30c7e5, 0x233250, 0xeeeddf, 0xfd4c79],
    ],
    paint(q, [C, D, A, T]) {
      if (!q.covered) return [q.c, q.l];
      const rise = q.y - 6;
      if (q.z >= 0 && q.u >= rise + 1) return [A, 0];
      if (q.z < 0 && q.u >= 2) return [D, 0];
      if (q.y === 6 && q.u === 0) return [T, 0];
      return [C, 0];
    },
  },
  {
    id: 'drop_short_half_court', name: 'Half Court', category: 'shorts', form: 'longshorts', tier: 'rare',
    why: 'Deep basketball shorts with a connected L-shaped contrast frame enclosing a saturated front.',
    cw: [
      ['Flame Court', 0xef582e, 0x30272b, 0xf0e7d3, 0x864233],
      ['Violet Court', 0x7d43d5, 0x302540, 0xf1cb34, 0xe9e3e7],
      ['Sky Court', 0x4da6eb, 0x1b2b4a, 0xe7efdf, 0xff7549],
    ],
    paint(q, [C, D, A, T]) {
      if (!q.covered) return [q.c, q.l];
      if ((q.u >= 2 && q.z <= 0) || q.y === 6) return [A, 0];
      if (q.z < -1) return [D, 0];
      if (q.y >= 8 && q.u === 0 && q.z >= 1) return [T, 0];
      return [C, 0];
    },
  },
  {
    id: 'drop_short_pit_crew', name: 'Pit Crew', category: 'shorts', form: 'longshorts', tier: 'epic',
    why: 'A motorsport uniform translated into a broad front bib, dark back and one sharply colored outside rail.',
    cw: [
      ['Acid Garage', 0xd3ef38, 0x292a31, 0xf4f0df, 0xf05b32],
      ['Red Garage', 0xe6353c, 0x232937, 0xe9e9dd, 0x79cdeb],
      ['Blue Garage', 0x277ce9, 0x202533, 0xf0d132, 0xebe7e1],
    ],
    paint(q, [C, D, A, T]) {
      if (!q.covered) return [q.c, q.l];
      if (q.u === 3) return [T, 0];
      if (q.z < 0) return [D, 0];
      if (q.u <= 1 && q.y >= 7) return [A, 0];
      return [C, 0];
    },
  },
  {
    id: 'drop_short_crossfade', name: 'Crossfade', category: 'shorts', form: 'longshorts', tier: 'epic',
    why: 'One loud wraparound leg meets a quiet leg with a single low block, a deliberately asymmetric editorial cut.',
    cw: [
      ['Pink Broadcast', 0xed51a1, 0x302837, 0xbadb3d, 0xede5df],
      ['Orange Broadcast', 0xfa772d, 0x2c354a, 0x639ff0, 0xf0e8dc],
      ['Green Broadcast', 0x29b779, 0x212e37, 0xf6c532, 0xe9e6dd],
    ],
    paint(q, [C, D, A, T]) {
      if (!q.covered) return [q.c, q.l];
      if (q.side < 0) return [q.y === 8 ? T : C, 0];
      if (q.y === 6 && q.z >= 0) return [A, 0];
      if (q.u === 3 && q.z < 0) return [T, 0];
      return [D, 0];
    },
  },
  {
    id: 'drop_short_dock_ticket', name: 'Dock Ticket', category: 'shorts', form: 'longshorts', tier: 'rare',
    why: 'Long utility shorts use large two-row cargo faces and contrasting flap tops; the scale reads as clothing, not noise.',
    cw: [
      ['Work Orange', 0xf17c31, 0x2c3542, 0xe7e2d3, 0x56657a],
      ['Work Cobalt', 0x345ada, 0x26304a, 0xe5c53b, 0xe8e5db],
      ['Work Raspberry', 0xd74177, 0x342733, 0xe6a875, 0xece7dc],
    ],
    paint(q, [C, D, A, T]) {
      if (!q.covered) return [q.c, q.l];
      if (q.u >= 1 && q.z >= 1 && q.y >= 7) return [q.y === 8 ? A : D, 0];
      if (q.z <= -1 && q.y === 7) return [T, 0];
      return [C, 0];
    },
  },
  {
    id: 'drop_short_sprint_club', name: 'Sprint Club', category: 'shorts', form: 'shorts', tier: 'common',
    why: 'A compact running cut with sweeping outside contrast panels and a thin-looking lower binding.',
    cw: [
      ['Sprinter Red', 0xe83842, 0x8f252e, 0xf3e9d7, 0x253246],
      ['Sprinter Green', 0x30b77e, 0x196b5d, 0xe8eecc, 0x383249],
      ['Sprinter Blue', 0x315ae5, 0x25337b, 0xf6b631, 0xece8df],
    ],
    paint(q, [C, D, A, T]) {
      if (!q.covered) return [q.c, q.l];
      if (q.u >= 2) return [A, 0];
      if (q.y === 7 && q.z >= 1) return [T, 0];
      if (q.z < 0) return [D, 0];
      return [C, 0];
    },
  },
  {
    id: 'drop_short_pool_service', name: 'Pool Service', category: 'shorts', form: 'shorts', tier: 'rare',
    why: 'Short resort-sport trunks with a two-tone front, solid dark back and one bold waistband-like upper wrap.',
    cw: [
      ['Peach Pool', 0xff8b66, 0x26394f, 0x49c7d9, 0xe9e9d8],
      ['Pink Pool', 0xf166a7, 0x34304c, 0xf0ca3e, 0xe9e6dc],
      ['Blue Pool', 0x3c83df, 0x20334e, 0xf26c36, 0xe6eedb],
    ],
    paint(q, [C, D, A, T]) {
      if (!q.covered) return [q.c, q.l];
      if (q.z < 0) return [D, 0];
      if (q.y >= 8 && q.u >= 2) return [T, 0];
      return [q.side < 0 ? C : A, 0];
    },
  },
];
