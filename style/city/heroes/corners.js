// THE DEALING CORNERS · owner: the corners agent (LOCATIONS.md). Four sim places on intersections (32,−32), (−32,−32), (−32,32), (32,32);
// the crew's props are stamped into whichever block they land in, under the group `corner` (ids i_j·corner·kind·n).
import { Vol, Bank, meshVol, stamp, stampA, meshed, rasterMask, textMask } from '../vox.js';
import { frame, win, bays, mass, shopFront, stoop, fireEscape, AIR, TOD } from '../kit.js';
import { PAL, CV, SIDE, hash, shade, rng } from '../style.js';
import { buildLot, subdivide, specify, massPlan, heightOf } from '../gen.js';
import { neutralCap } from '../roofs.js';
import { tank, billboard, giantObject, bench, tree, lampPost, car, copCar, taxi, phoneBooth, newsstand, hydrant, bags, milkCrate, acBox, dish, antenna, skylight, solar, vent, pigeons, potPlant } from '../props.js';
import { REG } from '../audit.js';
import { heroVol, wx, wz, tm, interior, PRODUCTS, shelves, planParts } from './common.js';
import { hwX, hwZ, rwX, rwZ } from '../plan.js';
import { unmap } from '../../../world/city.js';
// SPREAD · a corner's crew keeps to its kerbs: 1 m in from each street's own kerb (hwX / hwZ of the two lines it stands between, never a
// 2 m road read off one), its zone from 0.7 m off the kerbs to 2.2 m past the lot lines (rw), the bags' look from today's crossing (unmap)

// ═════════════════════════ dealing corners: life on four sidewalk corners (the sim places sit on the intersections)
// the zone each corner's crew and props may use (world boxes), for jobs.js to reserve before the block is built
export function cornerZones(places, P) { const out = [];
  for (const p of places) { if (p.kind !== 'corner') continue; const qx = p.x > 0 ? -1 : 1, qz = p.z > 0 ? -1 : 1, Lx = Math.round(p.x / P), Lz = Math.round(p.z / P);
    const x0 = p.x + qx * (hwX(Lx) + .7), z0 = p.z + qz * (hwZ(Lz) + .7), x1 = p.x + qx * (rwX(Lx) + 2.2), z1 = p.z + qz * (rwZ(Lz) + 2.0);
    out.push({ i: Math.floor((p.x + qx * (hwX(Lx) + 1)) / P), j: Math.floor((p.z + qz * (hwZ(Lz) + 1)) / P), box: [Math.min(x0, x1), SIDE, Math.min(z0, z1), Math.max(x0, x1), SIDE + 2.6, Math.max(z0, z1)] }); }
  return out; }
export function corners(bankOf, A, places, P, groundAt = null) {
  A.corners = [];
  for (const p of places) { if (p.kind !== 'corner') continue;
    const sx = p.z > 0 ? -1 : 1, qx = p.x > 0 ? -1 : 1, qz = p.z > 0 ? -1 : 1;   // pick the quadrant inside the section, toward the centre
    const hx = hwX(Math.round(p.x / P)), hz = hwZ(Math.round(p.z / P)), bank = bankOf(Math.floor((p.x + qx * (hx + 1)) / P), Math.floor((p.z + qz * (hz + 1)) / P)), [ux, uz] = unmap(p.x, p.z);
    // pass 1d: the booth, crates and bags go down as one cluster, clear of facades, doors and street furniture — nudged in along the
    // diagonal (up to 0.9 m) until it fits; the crew (castspec.js) stands relative to the same cx, cz, so nobody sits on air
    const kit = (cx, cz) => [[phoneBooth(), qz > 0 ? 0 : 2, cx + qx * 1.2, cz + qz * .2], [milkCrate(PAL.red), 0, cx + qx * .1, cz + qz * 1.3], [milkCrate(0x2f5bff), 1, cx + qx * .65, cz + qz * 1.35], [bags(ux * 3 + uz | 0), qx > 0 ? 1 : 3, cx + qx * .9, cz + qz * 2.2]];
    const crew = (cx, cz) => [[cx, cz], [cx - qx * .2, cz + qz * 2.2], [cx + qx * 1.9, cz - qz * .6]];   // the standing crew (castspec.js); the sitter sits on the red crate
    let cx = p.x + qx * (hx + 1), cz = p.z + qz * (hz + 1);
    const onSlab = e => !groundAt || [[e[0] + .05, e[2] + .05], [e[3] - .05, e[2] + .05], [e[0] + .05, e[5] - .05], [e[3] - .05, e[5] - .05]].every(([gx, gz]) => groundAt(gx, gz) > .1);
    for (const t of [0, .3, -.3, .6, -.6, .9]) { const x = p.x + qx * (hx + 1 + t), z = p.z + qz * (hz + 1 + t);
      if (kit(x, z).every(([b, r, bx, bz]) => { const e = REG.boxOf(b, r, bx, SIDE, bz); return onSlab(e) && REG.fits(e, { ignore: 'corner-zone' }); }) && crew(x, z).every(([px, pz]) => REG.fitsPerson(px, pz, SIDE, { items: false, ignore: ['plinth', 'corner-zone'] }))) { cx = x; cz = z; break; } }
    for (const [b, r, bx, bz] of kit(cx, cz)) stamp(b, bank, r, bx, SIDE, bz);
    A.corners.push({ p, cx, cz, qx, qz });
  }
}
