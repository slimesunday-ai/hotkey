// Paint-only denim and utility treatments. All geometry belongs to the parent.
// Palette: name, cloth base, waistband shadow, main panel, secondary fabric.
export const DESIGNS = [
  {
    id: 'denim_turnup',
    name: 'Turnup Denim',
    form: 'baggy',
    tier: 'common',
    sock: 'none',
    why: 'A broad pale turn-up anchors relaxed denim, with a quieter washed side panel running above it.',
    cw: [
      ['Indigo / Natural', 0x3F5973, 0x2C3D51, 0x71899B, 0xCFBFA2],
      ['Black / Chalk', 0x4F5357, 0x33373B, 0x73797C, 0xD6CDBD],
      ['Tobacco / Bone', 0x937251, 0x654D3D, 0xBA9870, 0xE0D0B4],
    ],
    paint(q, colors, index) {
      if (!q.covered && !q.socks) return [q.c, q.l];
      const [, base, shadow, panel, accent] = colors;
      if (q.socks) return [accent, 0];
      if (q.y >= 10) return [shadow, 0];
      // One complete turned-up row gives the wide hem a material identity.
      if (q.y === 4) return [accent, 0];
      if (q.u === q.width - 1) return [panel, 0];
      return [base, 0];
    },
  },
  {
    id: 'denim_deck_cargo',
    name: 'Deck Cargo',
    form: 'baggy',
    tier: 'rare',
    sock: 'none',
    why: 'Large front reinforcement panels and connected outside cargo pockets give soft utility colors a clear workwear structure.',
    cw: [
      ['Sage / Canvas', 0x89947A, 0x4E5A48, 0xBCC0A0, 0x5E715C],
      ['Cinder / Ochre', 0x666A66, 0x414642, 0x929586, 0xB19351],
      ['Dust / Navy', 0xC3AC90, 0x887663, 0xE2CFB3, 0x4B6578],
    ],
    paint(q, colors, index) {
      if (!q.covered && !q.socks) return [q.c, q.l];
      const [, base, shadow, panel, accent] = colors;
      if (q.socks) return [panel, 0];
      if (q.y >= 10) return [shadow, 0];
      // Side pockets are broad two-row fabric blocks, not outlined details.
      if (q.u === q.width - 1 && q.y >= 7 && q.y <= 8 && q.z >= 0) return [accent, 0];
      // The front work panel runs continuously from shin through knee.
      if (q.z === q.z1 && q.y >= 5 && q.y <= 7 && q.u <= 2) return [panel, 0];
      return [base, 0];
    },
  },
  {
    id: 'denim_cutline',
    name: 'Cutline Jean',
    form: 'straight',
    tier: 'epic',
    sock: 'none',
    why: 'Two long fabric fields divide each straight leg vertically, with quiet rear pockets keeping the construction grounded in denim.',
    cw: [
      ['Blue / Tar', 0x6688A0, 0x354452, 0x2E4558, 0xADC0C7],
      ['Ecru / Army', 0xD3CAB3, 0x767762, 0x79846B, 0xA7B192],
      ['Graphite / Mauve', 0x686A72, 0x444752, 0x93838D, 0xBFB4B9],
    ],
    paint(q, colors, index) {
      if (!q.covered && !q.socks) return [q.c, q.l];
      const [, base, shadow, panel, accent] = colors;
      if (q.socks) return [base, 0];
      if (q.y >= 10) return [shadow, 0];
      // Each back pocket is one connected two-by-two fabric patch.
      if (q.z === -1 && q.y >= 7 && q.y <= 8 && q.u >= 1 && q.u <= 2) return [accent, 0];
      // A full-height outer half is the signature; both legs mirror cleanly.
      if (q.u >= 2) return [panel, 0];
      return [base, 0];
    },
  },
];
