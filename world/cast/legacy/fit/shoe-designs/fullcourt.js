// Surface treatments only: the approved Fullcourt geometry is untouched.
// Colorway slots: name, upper, secondary, accent, sole, detail.
export const DESIGNS = [
  {
    id: 'fullcourt_backboard',
    name: 'Backboard',
    shape: 'fullcourt',
    tier: 'common',
    why: 'Athletic color frames a pale toe box and quarter, while a compact darker heel makes the broad court shape feel grounded.',
    cw: [
      ['Home Red', '#F3E8D8', '#C34B3C', '#463637', '#E9E1D1', '#FFF3DF'],
      ['Away Royal', '#E8E6DA', '#3458A4', '#CDB35E', '#DAD5C6', '#FFF4DE'],
      ['Varsity Green', '#EFE9D7', '#397766', '#B99B66', '#E2D6BD', '#FFF3DF'],
    ],
    paint(q, colors) {
      const [, upper, secondary, accent, sole, detail] = colors;
      if (q.region === 0) return [sole, 0];
      if (q.z === -2 || (q.y === 3 && q.z === -1)) return [accent, 0];
      // The side and front frame encloses a clean pale forefoot insert.
      if (q.y === 1 && (q.z >= 2 || q.u === 3)) return [secondary, 0];
      if (q.y === 2 && (q.u === 3 || (q.u === 0 && q.z >= 2))) return [secondary, 0];
      if (q.top && q.u === 1 && q.z >= 0 && q.z <= 1) return [detail, 0];
      return [upper, 0];
    },
  },
  {
    id: 'fullcourt_paintbox',
    name: 'Paintbox',
    shape: 'fullcourt',
    tier: 'common',
    why: 'A bright broad toe rests on a deeper tonal lower panel, with a contrasting collar and heel creating three deliberate horizontal masses.',
    cw: [
      ['Apricot / Ink', '#F0AA6D', '#353E60', '#D7784F', '#EADBC3', '#F8ECCF'],
      ['Celery / Lilac', '#DCE19D', '#9387B6', '#A7AF70', '#E8DCC5', '#F5ECD6'],
      ['Pool / Mandarin', '#73B3B5', '#CF7645', '#3F888F', '#E5DEC7', '#F7ECCC'],
    ],
    paint(q, colors) {
      const [, upper, secondary, accent, sole, detail] = colors;
      if (q.region === 0) return [sole, 0];
      if (q.top && q.y === 3 && q.u === 1 && q.z >= 0) return [detail, 0];
      // The rear and highest plane form one continuous contrasting collar.
      if (q.z === -2 || q.y === 3) return [secondary, 0];
      // Tonal lower volume supports the vivid upper without extra small marks.
      if (q.y === 1) return [accent, 0];
      return [upper, 0];
    },
  },
  {
    id: 'fullcourt_crossfade',
    name: 'Crossfade',
    shape: 'fullcourt',
    tier: 'common',
    why: 'Two large color fields meet along a single stepped diagonal, giving the fuller forefoot an editorial direction with a restrained heel accent.',
    cw: [
      ['Ultramarine / Sand', '#365C92', '#DCCA9A', '#DC9B50', '#E9E1CF', '#F9EFDD'],
      ['Tomato / Sky', '#C65944', '#B4CBD6', '#4B656F', '#E4D9C7', '#F7EACD'],
      ['Plum / Pistachio', '#75526D', '#C9D49E', '#C285A2', '#D9CCB8', '#F5E8D1'],
    ],
    paint(q, colors) {
      const [, upper, secondary, accent, sole, detail] = colors;
      if (q.region === 0) return [sole, 0];
      if (q.y === 3 && q.z === -1) return [accent, 0];
      if (q.top && q.u === 1 && q.z >= 0 && q.z <= 1) return [detail, 0];
      // A single connected diagonal division spans the full upper volume.
      if (q.z + q.u >= 3) return [secondary, 0];
      return [upper, 0];
    },
  },
];
