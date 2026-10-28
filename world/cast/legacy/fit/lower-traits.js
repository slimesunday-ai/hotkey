// FIT STREET · lower capsule. Paint lives on the approved leg forms: a garment
// cannot add a voxel, remove a clearance cut, or reach into the separate shoe grid.
// Colourways are flat rows so every existing catalogue can show their swatches.
import { PANTS_COLLECTION } from './pants-collection.js';
import { resolveSocks } from './socks.js';
import { DROP_BOTTOMS } from './drop-collection.js';
import { OPUS_PANTS } from './opus-pants/index.js';
import { OPUS2_PANTS } from './opus-pants-2/index.js';   // Opus 2 pants (world/fit/opus-pants-2/)
export const BOTTOM_TRAITS = {
  drain_denim: { name: 'Afterhours denim', form: 'slim', tier: 'common',
    cw: [['washed black', 0x292b31, 0x15171d, 0x666b78, 0xbbbdc5], ['ink rinse', 0x25374f, 0x152133, 0x526f91, 0xd8aa6d], ['dust grey', 0x737479, 0x42444b, 0xa4a5a7, 0xd6d4cd]],
    why: 'Narrow denim, rubbed knees and a small silver side zip.' },
  pool_denim: { name: 'Pool jeans', form: 'baggy', tier: 'rare',
    cw: [['bleach blue', 0x7898bf, 0x344f76, 0xb4c9dc, 0xdfbe82], ['raw indigo', 0x2a426b, 0x18263f, 0x6684a8, 0xbf8c50], ['coal wash', 0x494a50, 0x24252b, 0x929398, 0xc9b8a0]],
    why: 'Wide washed legs, a heavy dark hem and uneven fading.' },
  duck_carpenter: { name: 'Yard carpenters', form: 'straight', tier: 'common',
    cw: [['duck brown', 0x9d713f, 0x715031, 0xcda575, 0x452f22], ['washed moss', 0x62714d, 0x414e37, 0x929d71, 0x252d22], ['chalk / ink', 0xd6d0bb, 0xaaa28b, 0xefe7d2, 0x363635]],
    why: 'Broad double-knee panels, reinforced edges and a rear work tab.' },
  snap_track: { name: 'Breakaway tracks', form: 'straight', tier: 'rare',
    cw: [['ink / chalk', 0x20222a, 0x11131a, 0xeee7d8, 0xd73539], ['oxblood / pink', 0x611e34, 0x381523, 0xf29aa9, 0xe8cbd0], ['royal / butter', 0x264ba0, 0x172b60, 0xf4d985, 0xf3eee0]],
    why: 'A bold outside stripe, metal snaps and a contrast cuff.' },
  court_mesh: { name: 'Courtside shorts', form: 'shorts', tier: 'common', sock: 'crew',
    cw: [['forest / bone', 0x185846, 0x103b31, 0xf0ead9, 0xdd643b], ['royal / red', 0x2c4f9b, 0x182b5c, 0xf2eee4, 0xd9343f], ['plum / gold', 0x542c62, 0x351b42, 0xeac45f, 0xf0e6d4]],
    why: 'Boxy court mesh, thick binding and striped tube socks.' },
  field_cutoff: { name: 'Field cutoffs', form: 'shorts', tier: 'epic', sock: 'ankle',
    cw: [['olive / orange', 0x65704b, 0x3c472f, 0x9fa581, 0xff6a27], ['city camo', 0x7e8288, 0x333942, 0xc1c3bf, 0xee553e], ['leopard', 0xc99749, 0x30241c, 0xe0b973, 0x9b652e]],
    why: 'Flat utility pockets, an orange tab or oversized leopard spots.' },
};
export const BOTTOM_IDS = Object.keys(BOTTOM_TRAITS);
const pick = (rows, cw) => rows[(((cw | 0) % rows.length) + rows.length) % rows.length];
const mix = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };

// Coordinates belong to a single occupied cell. Only [colour, material] comes
// back; giving painters no Grid reference keeps clothing clearances structural.
function paint(id, cw, C, D, A, T, q) {
  const { y, z, u, side, width, z1, covered, socks, c, l } = q;
  if (socks) {
    if (id === 'court_mesh') return [y === 5 ? C : 0xeeeadd, 0];
    if (id === 'field_cutoff') return [0x25262b, 0];
    return [c, l];
  }
  if (!covered) return [c, l];
  const front = z === z1, back = z === -1, outside = u === width - 1;
  let col = C, mat = 0;
  if (id === 'drain_denim') {
    if (outside && z <= 0) col = D;
    if (front && u <= 1 && (y === 6 || (y === 7 && side < 0))) col = y === 6 ? A : mix(C, A, .45);
    if (y === 4) col = D;
    if (outside && z === 0 && y === 8) { col = 0xc1c6ce; mat = 2; }
    if (back && y === 8 && u === 1) col = T;
  } else if (id === 'pool_denim') {
    if (y === 4 || (outside && z <= 0)) col = D;
    if (front && u <= 2 && y >= 6 && y <= (side < 0 ? 8 : 7)) col = y === 6 ? A : mix(C, A, .6);
    if (front && u === 0 && y === 5) col = mix(C, A, .35);
    if (y === 4 && z === 1 && u <= 2) col = mix(D, C, .4);
    if (back && y === 8 && u >= 1 && u <= 2) col = D;
    if (back && y === 8 && u === 2 && side > 0) col = T;
  } else if (id === 'duck_carpenter') {
    if (front && y >= 5 && y <= 7 && u >= 1 && u <= 2) col = D;
    if (front && y === 7 && u >= 1 && u <= 2) col = A;
    if (front && y === 5 && u === 1) col = A;
    if (outside && z === 0) col = mix(C, D, .55);
    if (back && y === 7 && u >= 1) col = D;
    if (back && side > 0 && y === 8 && u === 2) col = T;
    if (y === 4) col = mix(C, D, .4);
  } else if (id === 'snap_track') {
    mat = 1;
    if (outside && z <= 0) col = A;
    if (outside && z === -1 && (y === 5 || y === 7)) { col = 0xd9dde3; mat = 2; }
    if (y === 4) col = D;
    if (outside && y === 4 && z === 0) col = T;
    if (front && u === 0) col = mix(C, D, .45);
  } else if (id === 'court_mesh') {
    if (outside || y === 7) col = A;
    else if (front && ((u === 0 && y === 8) || (u === 2 && y === 9))) col = D;
    if (front && y === 8 && u === 1 && side > 0) col = T;
    if (outside && z === 0) col = T;
  } else if (id === 'field_cutoff') {
    if (cw === 2) {
      // Offset clusters on the two visible rows; spots turn around corners
      // instead of wrapping a whole column into a stripe. No random speckle.
      const spot = front ? (y === 8 && u === (side < 0 ? 0 : 2)) || (y === 7 && u === (side < 0 ? 2 : 0))
        : outside ? (y === 8 && z === 0) || (y === 7 && z === -1)
        : back && ((y === 8 && u === 1) || (y === 7 && u === 2));
      col = spot ? D : front && u === 1 ? T : C;
    } else {
      if (cw === 1) col = (u >= 2 && y >= 8) || (u === 0 && y === 7) ? D : (y === 9 && u <= 1 ? A : C);
      if (front && y === 8 && u >= 1) col = D;
      if (front && y === 7 && u >= 1) col = mix(C, A, .5);
      if (outside && y === 8 && z === 0 && side > 0) col = T;
    }
  }
  return [col, mat];
}

export function resolveBottom(p, socks) {
  const independent = resolveSocks(socks);
  const t = BOTTOM_TRAITS[p.id] || PANTS_COLLECTION[p.id] || DROP_BOTTOMS[p.id] || OPUS_PANTS[p.id] || OPUS2_PANTS[p.id]; if (!t) return independent ? { ...p, ...independent } : p;
  const row = pick(t.cw, p.cw), index = t.cw.indexOf(row), [, C, D, A, T] = row;
  return { ...p, form: t.form, c: C, waistC: D, sock: p.sock ?? t.sock ?? 'ankle',
    paint: q => t.paint ? t.paint(q, t.collection === 'drop02' ? row.slice(1) : row, index) : paint(p.id, index, C, D, A, T, q), ...independent };
}

export function installBottomTraits({ NEWT, NEWI, NAMES }) {
  for (const [id, t] of Object.entries({ ...BOTTOM_TRAITS, ...PANTS_COLLECTION, ...DROP_BOTTOMS, ...OPUS_PANTS, ...OPUS2_PANTS })) {
    NEWT.bottom[id] = [t.name, t.tier, t.cw, t.why];
    NEWI[id] = { id, slot: 'bottom', ...t, new: true, origin: 'lower' };
    NAMES.bottom[id] = t.name;
  }
}

const PAIRS = ['welt_derby', 'curb_skate', 'yard_moc', 'relay_runner', 'plinth_court', 'liquid_split'];
export function lowerTraitLooks(makeLook) {
  return BOTTOM_IDS.map((id, i) => makeLook({
    handle: BOTTOM_TRAITS[id].name, skin: 'tan', hair: { id: 'buzz', c: 0x302a26 },
    top: { id: 'tank', c: 0x333a42 }, bottom: { id, cw: 0 }, shoes: { id: PAIRS[i], cw: 0 },
  }));
}
