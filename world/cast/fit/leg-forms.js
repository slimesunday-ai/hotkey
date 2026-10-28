// Authored lower-body silhouettes. Shared motion lives in anim/walk2.js; these are
// rest-space voxel sections, built once per look. No per-frame cloth simulation.
// Rows run ankle -> hip (y4..9). Width grows OUTWARDS from the two-voxel inner gap; the gap closes at the seat (y8..9, drawSeat below).
// Each section is [width, back z, front z], inclusive. The hidden 3x3 ankle socket
// remains filled even when the visible hem is wider. Shoe geometry is independent.
import { COLLECTION_FORMS } from './collection-forms.js';
export const LEG_FORMS = Object.freeze([
  { id: 'slim', name: 'Slim', hem: 4, rows: [[3, -1, 1], [3, -1, 1], [3, -1, 1], [3, -1, 1], [4, -1, 1], [4, -1, 1]] },
  { id: 'straight', name: 'Straight', hem: 4, rows: [[4, -1, 1], [4, -1, 1], [4, -1, 1], [4, -1, 1], [4, -1, 1], [4, -1, 1]], cuts: [[5, 3, 1], [6, 3, 1], [7, 3, 1]] },
  { id: 'baggy', name: 'Baggy', hem: 4, rows: [[5, -1, 1], [4, -1, 2], [4, -1, 2], [4, -1, 2], [4, -1, 2], [4, -1, 1]], cuts: [[4, 4, 1], [5, 3, 1], [5, 3, 2], [6, 3, 1], [6, 3, 2], [7, 3, 1], [7, 3, 2], [8, 3, 2]] },
  { id: 'shorts', name: 'Shorts', hem: 7, rows: [[3, -1, 1], [3, -1, 1], [3, -1, 1], [4, -1, 2], [4, -1, 2], [4, -1, 1]], cuts: [[7, 3, 1], [7, 3, 2], [8, 3, 2]] },
]);
export const legForm = id => LEG_FORMS.find(f => f.id === id) || COLLECTION_FORMS[id];

// Build a single occupied surface: fabric, exposed skin and socks meet at real
// silhouette steps. There is no duplicate skin shell hidden under the garment.
// The caller applies the shared waistband clearance, but never the legacy cuff or
// depth clamp: these profiles already declare their final shape and hand clearance.
export function drawLegForm(B, p, skin) {
  const form = p.formSpec ?? legForm(p.form); if (!form) return false;
  const cloth = p.c ?? 0x607b91, sock = p.sock ?? 'ankle', sockTop = sock === 'crew' ? 6 : sock === 'ankle' ? 5 : 4;
  for (const side of [-1, 1]) for (let y = 4; y < 10; y++) {
    const [width, z0, z1] = form.rows[y - 4], covered = y >= form.hem;
    for (let u = 0; u < width; u++) for (let z = z0; z <= z1; z++) {
      const x = side < 0 ? -2 - u : 1 + u;
      if (form.cuts?.some(([cy, cu, cz]) => y === cy && u === cu && z === cz)) continue;
      // Keep-outs apply to FINAL geometry (including the thumb), not to a wider
      // source that might later be compressed back into a hand's resting volume.
      // Posed clearance is checked separately; the inherited pockets idle reaches
      // into even the bare leg and is reported as a remaining hand-fit limitation.
      if (y >= 6 && (x <= -6 || x >= 5) && z >= -2 && z <= 2) continue;
      const socks = !covered && y < sockTop;
      const c = covered ? cloth : socks ? (p.sockColor ?? 0xe4e0d5) : skin.c(x, y, z), l = covered || socks ? 0 : skin.layer;
      const paint = socks && p.sockPaint ? p.sockPaint : p.paint;
      const painted = (covered || socks) && paint ? paint({ x, y, z, u, side, width, z0, z1, covered, socks, c, l }) : [c, l];
      B.set(x, y, z, painted[0], painted[1]);
    }
  }
  B.box(-5, 10, -2, 5, 11, 3, p.waistC ?? cloth);
  return true;
}

// THE SEAT (2026-10-01). Trousers are ONE garment at the hips. Above, the legs stood apart on the two-voxel inner gap all the way up to
// the waistband, and from behind they read as two rounded blocks under the hem ("his cheeks are hanging out"). So the gap closes for
// the top SEAT rows (y 8..9; a form may set its own `seat`): the seat and the crotch run unbroken from the waistband down to the top
// of the thigh, and the legs split below it (y 4..7), where real trousers do. Each leg grows inwards by the gap's column on its own
// side (u −1: x −1 on the x<0 leg, x 0 on the x>0 leg), in that row's [back z, front z], so the two halves meet on the midline,
// flush with the legs at the back, the front and underneath. The bottom's own paint colours it with q.u = −1, so a pattern
// (a check, a camo, a two-tone) runs on across the seat. lower.js draws it after the waist clearance and gives each half to its
// own thigh; the walk (style/city/anim/walk2.js) keeps the two halves on the hips' midplane, so they meet there and never cross.
export const SEAT = 2;
export function drawSeat(B, p) {
  const form = p.formSpec ?? legForm(p.form); if (!form) return;
  const cloth = p.c ?? 0x607b91, rows = form.seat ?? SEAT, u = -1;
  for (const side of [-1, 1]) for (let y = 10 - rows; y < 10; y++) {
    const [width, z0, z1] = form.rows[y - 4], x = side < 0 ? -1 : 0; if (y < form.hem) continue;   // (covered rows only)
    for (let z = z0; z <= z1; z++) {
      const painted = p.paint ? p.paint({ x, y, z, u, side, width, z0, z1, covered: true, socks: false, c: cloth, l: 0 }) : [cloth, 0];
      B.set(x, y, z, painted[0], painted[1]);
    }
  }
}
