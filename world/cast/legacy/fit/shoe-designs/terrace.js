// Paint-only treatments for the approved Terrace cells.
// Colorway slots: name, upper, secondary, accent, sole, detail.
export const DESIGNS = [
  {
    id: 'terrace_clubline',
    name: 'Clubline',
    shape: 'terrace',
    tier: 'common',
    why: 'A pale court upper sits inside a tonal toe frame, with a compact colored quarter panel and matching heel tab.',
    cw: [
      ['Chalk / Ivy', '#F0EADB', '#CEC7B7', '#294E42', '#D7C6A5', '#FFF8E9'],
      ['Porcelain / Oxblood', '#F2E9DB', '#D6C6AF', '#773B42', '#DBCAB2', '#FFF7EA'],
      ['Paper / Cobalt', '#E6E6DD', '#BCC5C6', '#2B557A', '#DCD7C9', '#F8F2E7'],
    ],
    paint(q, colors) {
      const [, upper, secondary, accent, sole, detail] = colors;
      if (q.region === 0) return [sole, 0];
      // The small rear tab pairs with the quiet outside quarter rectangle.
      if (q.y === 3 && q.z === -1) return [accent, 0];
      if (q.outer && q.y === 2 && q.z >= 0 && q.z <= 1) return [accent, 0];
      // A broad front overlay makes the low, square toe feel intentional.
      if (q.z === -2 || (q.y === 1 && (q.z >= 3 || q.u === 3))) return [secondary, 0];
      // Two connected light cells suggest a lace bed without drawn-on marks.
      if (q.top && q.u === 1 && q.z >= 0 && q.z <= 1) return [detail, 0];
      return [upper, 0];
    },
  },
  {
    id: 'terrace_saddle',
    name: 'Saddle',
    shape: 'terrace',
    tier: 'common',
    why: 'A dark continuous saddle crosses the warm forefoot and sidewalls, balanced by an earthy heel and a solid gum sole.',
    cw: [
      ['Malt / Espresso', '#C6A781', '#6A493A', '#B8633D', '#B99B6E', '#EAE1CE'],
      ['Clay / Moss', '#C89A82', '#68735A', '#E5CEAC', '#AFA58A', '#F0E6CE'],
      ['Stone / Aubergine', '#BAB4A7', '#66505F', '#BD857B', '#CBBBA3', '#E9E3D5'],
    ],
    paint(q, colors) {
      const [, upper, secondary, accent, sole, detail] = colors;
      if (q.region === 0) return [sole, 0];
      // This band wraps the complete shoe width rather than tracing an icon.
      if (q.z >= 0 && q.z <= 1) {
        if (q.top && q.u === 1) return [detail, 0];
        return [secondary, 0];
      }
      if (q.z === -2 || (q.y === 3 && q.z === -1)) return [accent, 0];
      return [upper, 0];
    },
  },
  {
    id: 'terrace_split_court',
    name: 'Split Court',
    shape: 'terrace',
    tier: 'common',
    why: 'A pale uninterrupted forefoot cuts across a washed-color rear body, with a small glazed heel tab as the only polished accent.',
    cw: [
      ['Faded Indigo', '#62778A', '#E4DDCC', '#B76545', '#BCAE90', '#F4EDD8'],
      ['Washed Cherry', '#A85A59', '#E9CEB4', '#754A4E', '#CBB590', '#F4E7D5'],
      ['Acid Olive', '#747B50', '#E0DFC3', '#C4D264', '#C0AD88', '#F1EBCD'],
    ],
    paint(q, colors) {
      const [, upper, secondary, accent, sole, detail] = colors;
      if (q.region === 0) return [sole, 0];
      // Every forefoot cell participates in the same clean two-block division.
      if (q.z >= 2) return [secondary, 0];
      if (q.y === 3 && q.z === -1) return [accent, 1];
      if (q.top && q.u === 1 && q.z >= 0 && q.z <= 1) return [detail, 0];
      return [upper, 0];
    },
  },
];
