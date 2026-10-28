// Standalone hosiery: upper rows are cuffs, y=3 is the ankle, never a toe.
export const DESIGNS = [
  {
    id: 'drop_sock_rally_ring', name: 'Rally Ring', category: 'socks', height: 'crew', tier: 'common',
    why: 'A clean light athletic body with a thick saturated cuff and dark ankle grounding.',
    cw: [
      ['Red Rally', 0xedeadd, 0x31303a, 0xef4340, 0xcdd4df],
      ['Blue Rally', 0xf0eadb, 0x293951, 0x326fe7, 0xc8d3e4],
      ['Green Rally', 0xe9ecd8, 0x2a3d39, 0x28af76, 0xc3d5c7],
    ],
    paint(q, [C, D, A]) { return [q.y === 5 ? A : q.y === 3 ? D : C, 0]; },
  },
  {
    id: 'drop_sock_sidecar', name: 'Sidecar', category: 'socks', height: 'crew', tier: 'rare',
    why: 'A single bold outside racing stripe runs from cuff through ankle on a dark sport sock.',
    cw: [
      ['Lime Sidecar', 0x2d3037, 0x161c27, 0xd4eb3c, 0xefeddf],
      ['Orange Sidecar', 0x26354a, 0x1b2232, 0xf87932, 0xe7e9dd],
      ['Pink Sidecar', 0x3e2c4d, 0x292237, 0xef63b1, 0xeee7e0],
    ],
    paint(q, [C, D, A, T]) {
      if (q.u === 2) return [A, 0];
      if (q.y === 5 && q.z < 0) return [T, 0];
      return [q.z < 0 ? D : C, 0];
    },
  },
  {
    id: 'drop_sock_frontline', name: 'Frontline', category: 'socks', height: 'crew', tier: 'rare',
    why: 'A saturated front shield meets a light back, divided into two large readable halves.',
    cw: [
      ['Cobalt Front', 0xeee9dc, 0x2c3448, 0x2e66e2, 0xf2bf3c],
      ['Coral Front', 0xece6d9, 0x48323a, 0xf06a55, 0x9c60d6],
      ['Violet Front', 0xe9e5e2, 0x302c43, 0x9a66d9, 0xd5e741],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 3 && q.z < 0) return [D, 0];
      if (q.y === 5 && q.u === 2) return [T, 0];
      return [q.z >= 0 ? A : C, 0];
    },
  },
  {
    id: 'drop_sock_duplex', name: 'Duplex', category: 'socks', height: 'crew', tier: 'epic',
    why: 'A deliberately mismatched pair: one saturated leg and one pale leg linked by identical dark cuffs.',
    cw: [
      ['Electric Pair', 0x3b70eb, 0x282d3b, 0xeae9da, 0xf8ba2c],
      ['Punch Pair', 0xef578f, 0x342b41, 0xebe8df, 0x8c64d9],
      ['Citrus Pair', 0xc8df35, 0x2c343c, 0xe6e9e4, 0xf7763b],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 5) return [D, 0];
      if (q.y === 3 && q.u === 2) return [T, 0];
      return [q.side < 0 ? C : A, 0];
    },
  },
  {
    id: 'drop_sock_centre_rail', name: 'Centre Rail', category: 'socks', height: 'crew', tier: 'rare',
    why: 'A vertical front rail breaks a vivid solid sock, with a separate dark rear ankle.',
    cw: [
      ['Orange Rail', 0xf07d34, 0x463134, 0xeee9dc, 0x3c69c8],
      ['Blue Rail', 0x3473df, 0x243553, 0xe8e4d9, 0xf3c12f],
      ['Mint Rail', 0x49c5a6, 0x254940, 0xeff0df, 0xe96b69],
    ],
    paint(q, [C, D, A, T]) {
      if (q.z >= 1 && q.u === 1) return [A, 0];
      if (q.z < 0 && q.y === 3) return [D, 0];
      if (q.y === 5 && q.z < 0) return [T, 0];
      return [C, 0];
    },
  },
  {
    id: 'drop_sock_step_wave', name: 'Step Wave', category: 'socks', height: 'crew', tier: 'epic',
    why: 'One connected stepped wave climbs from the inner ankle to the outer cuff, a large graphic across three rows.',
    cw: [
      ['Pink Wave', 0xef729f, 0x66324c, 0xf1e7d9, 0xf2bf38],
      ['Blue Wave', 0x4391e3, 0x244b7d, 0xf0ebde, 0xf67b37],
      ['Green Wave', 0x33b785, 0x215c4c, 0xe4efd5, 0xb794e8],
    ],
    paint(q, [C, D, A, T]) {
      if (q.z >= 0 && q.u >= q.y - 3) return [A, 0];
      if (q.z < 0) return [D, 0];
      if (q.y === 5 && q.u === 0) return [T, 0];
      return [C, 0];
    },
  },
  {
    id: 'drop_sock_midtown_band', name: 'Midtown Band', category: 'socks', height: 'crew', tier: 'common',
    why: 'A wide contrasting middle band is framed by saturated cuff and ankle for a strong rugby-style read.',
    cw: [
      ['Red Midtown', 0xe74b45, 0x343644, 0xe9e5d8, 0x6c6e80],
      ['Purple Midtown', 0x8152cf, 0x322a47, 0xe7dcf0, 0xf4c83e],
      ['Green Midtown', 0x1eaa74, 0x284b44, 0xe8efd2, 0xeaa448],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 4) return [A, 0];
      if (q.z < 0 && q.y === 3) return [D, 0];
      if (q.u === 2 && q.y === 5) return [T, 0];
      return [C, 0];
    },
  },
  {
    id: 'drop_sock_low_signal', name: 'Low Signal', category: 'socks', height: 'ankle', tier: 'common',
    why: 'A low sport sock puts its entire color statement into a saturated cuff over a quiet ankle.',
    cw: [
      ['Acid Signal', 0xe6e8df, 0x303741, 0xd5ed39, 0x60848d],
      ['Coral Signal', 0xebe6dd, 0x40303c, 0xf66f57, 0x776b93],
      ['Blue Signal', 0xe7e9e6, 0x2c344a, 0x326fe5, 0x80a9c5],
    ],
    paint(q, [C, D, A]) { return [q.y === 4 ? A : q.z < 0 ? D : C, 0]; },
  },
  {
    id: 'drop_sock_rear_tab', name: 'Rear Tab', category: 'socks', height: 'ankle', tier: 'rare',
    why: 'A dark low sock carries one broad bright rear tab that runs continuously down the back of the ankle.',
    cw: [
      ['Flame Tab', 0x2b3344, 0x1e2635, 0xfb7135, 0xe7e5da],
      ['Lilac Tab', 0x342c45, 0x251f33, 0xbb95ef, 0xeae5dc],
      ['Sky Tab', 0x263f43, 0x1b2b32, 0x4dbede, 0xe4ebdc],
    ],
    paint(q, [C, D, A, T]) {
      if (q.z < 0) return [A, 0];
      if (q.y === 4 && q.u === 2) return [T, 0];
      return [q.y === 3 ? D : C, 0];
    },
  },
  {
    id: 'drop_sock_half_time', name: 'Half Time', category: 'socks', height: 'ankle', tier: 'rare',
    why: 'Two broad vertical halves wrap a low sock, with a dark ankle edge anchoring the high-contrast pairing.',
    cw: [
      ['Royal / Sun', 0x2e69de, 0x263447, 0xf3c739, 0xece8dc],
      ['Rose / Cream', 0xea5e9a, 0x413142, 0xf0e5d3, 0xa882d8],
      ['Green / Sky', 0x20a67d, 0x28433e, 0x77c8ed, 0xedead8],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 3 && q.z < 0) return [D, 0];
      if (q.y === 4 && q.u === 1 && q.z < 0) return [T, 0];
      return [q.u >= 1 ? A : C, 0];
    },
  },
];
