// Paint only. All fit, occupied cells, clearance, and mirroring stay with the parent.
// Colorways: name, cloth, waistband, panel, accent.
export const DESIGNS = [
  {
    id: 'pressed_club_trouser',
    name: 'Pressed',
    form: 'slim',
    tier: 'rare',
    sock: 'none',
    why: 'A quiet slim trouser with an uninterrupted tuxedo side panel and a short tonal pocket welt at the hip.',
    cw: [
      ['Graphite / Sage', 0x454B50, 0x252D32, 0x74847B, 0xA0AEA5],
      ['Night / Mulberry', 0x292F41, 0x1C2231, 0x776071, 0xA18A95],
      ['Putty / Ink', 0xBBB6A9, 0x4B5359, 0x56656D, 0x8D9B9B],
    ],
    paint(q, colors, index) {
      if (!q.covered && !q.socks) return [q.c, q.l];
      const [, base, shadow, panel, accent] = colors;
      if (q.socks) return [shadow, 0];
      if (q.y >= 10) return [shadow, 0];
      // A short connected welt sits directly below the waistband.
      if (q.y === 9 && q.z === q.z1 && q.u >= 2) return [accent, 0];
      // The side panel follows the supplied width through the hip taper.
      if (q.u === q.width - 1) return [panel, 0];
      return [base, 0];
    },
  },
  {
    id: 'tide_panel_board_short',
    name: 'Tide Panel',
    form: 'shorts',
    tier: 'epic',
    sock: 'crew',
    why: 'A board short with a broad lower block that rises toward the outside and one calm vertical side seam.',
    cw: [
      ['Marine / Coral', 0x35616D, 0x193E4A, 0xD37A58, 0xE4DBC6],
      ['Ink / Acid', 0x2C3D49, 0x182B35, 0x8FAD75, 0xDDE7B3],
      ['Lagoon / Chalk', 0x528E89, 0x2C5D5D, 0xD0D6C9, 0xBCE8D3],
    ],
    paint(q, colors, index) {
      if (!q.covered && !q.socks) return [q.c, q.l];
      const [, base, shadow, panel, accent] = colors;
      if (q.socks) return [0xDCDDD3, 0];
      if (q.y >= 10) return [shadow, 0];
      // This connected side seam stays behind the front clearance cut.
      if (q.u === q.width - 1 && q.z === 0) return [accent, 0];
      // One solid lower panel; the upper boundary steps up at the outer half.
      if (q.y === 7 || (q.y === 8 && q.u >= 2)) return [panel, 0];
      return [base, 0];
    },
  },
  {
    id: 'studio_patch_short',
    name: 'Studio Patch',
    form: 'shorts',
    tier: 'common',
    sock: 'ankle',
    why: 'A softly tailored casual short with broad tonal patch pockets, lighter pocket flaps, and an unbroken quiet hem.',
    cw: [
      ['Sand / Chalk', 0xA99D7D, 0x5C5C4C, 0xC6BDA4, 0xDDD6C4],
      ['Juniper / Stone', 0x5C736A, 0x354B44, 0x8A9A8C, 0xB4BCAA],
      ['Dusk / Tobacco', 0x69606B, 0x403D46, 0x9A867A, 0xB9A899],
    ],
    paint(q, colors, index) {
      if (!q.covered && !q.socks) return [q.c, q.l];
      const [, base, shadow, panel, accent] = colors;
      if (q.socks) return [0xD7D2C5, 0];
      if (q.y >= 10) return [shadow, 0];
      // Generous front pockets wrap onto the side; they survive corner cuts.
      const pocket = q.y >= 8 && q.u >= 1 &&
        (q.z === q.z1 || (q.u === q.width - 1 && q.z >= 0));
      if (pocket) return [q.y === 9 ? accent : panel, 0];
      return [base, 0];
    },
  },
];
