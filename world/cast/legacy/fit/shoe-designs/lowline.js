// Lowline surface studies. The supplied cell geometry is never changed.
// Colorway columns: name, upper, secondary, accent, sole, detail.
export const DESIGNS = [
  {
    id: 'lowline_contour',
    name: 'Contour',
    shape: 'lowline',
    tier: 'common',
    why: 'A stepped rear saddle flows into a clean light forefoot, with a compact heel flash and an inset tongue.',
    cw: [
      ['Chalk / Volt', '#D7D9D2', '#7D8C89', '#D7F25B', '#C7CAC2', '#273538'],
      ['Ash / Ember', '#4A5054', '#282F36', '#EC764D', '#A8AAA5', '#171E24'],
      ['Mist / Lake', '#B7C8C8', '#56757F', '#EAEECE', '#D2D9D2', '#2A4752'],
    ],
    paint(q, colors) {
      const [, upper, secondary, accent, sole, detail] = colors;
      if (q.region === 0) return [sole, 0];
      // One unbroken heel tab, immediately above the rear counter.
      if (q.y === 2 && q.z === -2) return [accent, 0];
      if (q.y === 3 && q.u === 1) return [detail, 0];
      // Broad cross-foot panels create a stepped, forward-moving boundary.
      if ((q.y === 1 && q.z <= 1) ||
          (q.y === 2 && q.z <= 0) ||
          (q.y === 3 && q.z === -1)) return [secondary, 0];
      return [upper, 0];
    },
  },
  {
    id: 'lowline_shell',
    name: 'Shell',
    shape: 'lowline',
    tier: 'common',
    why: 'A continuous dark toe wrap grounds a tonal technical upper, with one short signal panel on the outer quarter.',
    cw: [
      ['Carbon / Clay', '#404A4F', '#273137', '#C67E5A', '#171F24', '#677477'],
      ['Moss / Signal', '#677466', '#465547', '#DBEA73', '#293830', '#8A9684'],
      ['Plum / Frost', '#655B6A', '#443D4D', '#BBDADB', '#282530', '#8D8194'],
    ],
    paint(q, colors) {
      const [, upper, secondary, accent, sole, detail] = colors;
      if (q.region === 0) return [sole, 0];
      // A single connected two-cell insert; the only gloss in the collection.
      if (q.u === 2 && q.y === 2 && q.z >= 0 && q.z <= 1) return [accent, 1];
      if (q.y === 3 && q.u === 1) return [detail, 0];
      if (q.y === 1 || (q.y === 2 && q.z === 2)) return [secondary, 0];
      return [upper, 0];
    },
  },
  {
    id: 'lowline_relay',
    name: 'Relay',
    shape: 'lowline',
    tier: 'common',
    why: 'A centered contrast lane lengthens the upper while a small tongue block and full-width toe bumper give it a precise sport read.',
    cw: [
      ['Bone / Petrol', '#DED8CB', '#325464', '#DE744E', '#C4C0B4', '#B1B3A9'],
      ['Ink / Ice', '#273441', '#9DB5B7', '#C9E869', '#BAC4BD', '#42525F'],
      ['Ochre / Marine', '#BDAB86', '#425F64', '#E7DDD0', '#DDD5C6', '#8B927D'],
    ],
    paint(q, colors) {
      const [, upper, secondary, accent, sole, detail] = colors;
      if (q.region === 0) return [q.z === 5 ? secondary : sole, 0];
      // A compact tongue panel sits inside the continuous center treatment.
      if (q.u === 1 && q.y === 3 && q.z >= 0) return [accent, 0];
      if (q.u === 1 && q.top && q.z >= -2 && q.z <= 3) return [secondary, 0];
      if (q.y === 3) return [detail, 0];
      return [upper, 0];
    },
  },
];
