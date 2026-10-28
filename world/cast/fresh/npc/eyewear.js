// NPC POOL · eyewear (slot 'eyewear'). Plain frames in matte greys and browns, no logos, no colour, no chrome. Built like eyewear.js:
// the front at z 8 in the eye band (y 22..26), a 9-wide row mirrored about the face's centre, the arms at x −9 / 8 from z 7 back to
// z 3 (short of the ear). Cells already taken (hair, a hat) are left alone. README § The NPC pool and § Eyewear. Only import: './kit.js'.
const FZ = 8, MX = x => -1 - x;
function build({ top, front, side = [], pal }) {
  return H => {
    const put = (x, y, z, ch) => { const p = pal[ch]; if (p && !H.has(x, y, z)) H.set(x, y, z, p[0], p[1] ?? 0); };
    front.forEach((r, j) => { const y = top - j; for (let i = 0; i < r.length; i++) { put(-9 + i, y, FZ, r[i]); put(MX(-9 + i), y, FZ, r[i]); } });
    side.forEach((r, j) => { const y = top - j; for (let i = 0; i < r.length; i++) { put(-9, y, 7 - i, r[i]); put(8, y, 7 - i, r[i]); } });
  };
}
export default {
  npc_glasses_office: { name: 'Civilian · office frames', tier: 'common', why: 'black rectangles from the mall optician: accounts payable',
    draw: build({ top: 26, pal: { F: [0x26272b, 0] }, front: ['FFFFFFFFF', '.F.....F.', '.F.....F.', '.FFFFFFF.'], side: ['FFFFF'] }) },
  npc_glasses_wire: { name: 'Civilian · thin grey frames', tier: 'common', why: 'thin grey frames, slipped down a little: the retiree with the crossword',
    draw: build({ top: 25, pal: { F: [0x7e8188, 0] }, front: ['FFFFFFFFF', '.F.....F.', '.FFFFFFF.'], side: ['FFFFF'] }) },
  npc_sunglasses_tourist: { name: 'Civilian · drugstore shades', tier: 'common', why: 'brown drugstore sunglasses, still on the tourist at the ferry',
    draw: build({ top: 26, pal: { F: [0x5b4838, 0], L: [0x3c3f45, 0] }, front: ['FFFFFFFFF', '.FLLLLLF.', '.FLLLLLF.', '..FFFFF..'], side: ['FFFFF'] }) },
};
