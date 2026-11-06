// NPC POOL · hats (slot 'hat'). A few plain city hats: a flat cap, an unbranded ball cap, a white hard hat, a plain knit, a beige
// tourist bucket. No logos, no stickers, no patches, matte. Built like hats.js (copied into kit.js): every crown a closed solid on the
// hair shell with its rim on it, so the auto cover keeps hair whole; nothing below y 29 at the front. README § The NPC pool and § Hats.
import { solid, rowsOf, ring, inFoot, shade } from './kit.js';
// the Cleaners' hood (npc_cleaner_hood_*): the shell round the head, the rim round the face opening
const HOOD = 0xe6e7e2, VISOR = 0x1d2229, RUBBER = 0x3a3d42, LENS = 0x5f7180, FILTER = 0x9a8f62;
function cleanerHood(H) { const inH = (x, y, z) => x >= -8 && x <= 7 && y >= 19 && y <= 33 && z >= -7 && z <= 7, face = (x, y, z) => z >= 8 && x >= -7 && x <= 6 && y >= 19 && y <= 31;
  for (let x = -10; x <= 9; x++) for (let y = 18; y <= 35; y++) for (let z = -9; z <= 8; z++) { if (inH(x, y, z) || face(x, y, z)) continue;
    const ex = x < -9 ? -9 - x : x > 8 ? x - 8 : 0, ez = z < -8 ? 1 : 0, ey = y > 34 ? 1 : 0; if (ex + ez + ey > 1 || (ex && (y < 21 || y > 31)) || (y === 18 && (x < -8 || x > 7 || z < -7))) continue;
    H.set(x, y, z, (y === 34 || y === 35) && (x === -1 || x === 0) ? shade(HOOD, .9) : HOOD); }
  for (let x = -8; x <= 7; x++) for (const y of [32, 33]) H.set(x, y, 9, shade(HOOD, .94));   // the rim over the brow, one proud
  for (let y = 18; y <= 31; y++) for (const x of [-9, -8, 7, 8]) H.set(x, y, 9, shade(HOOD, .94)); }
const rib = (c, k = .9) => (x, y, z) => ((x + z) & 1) ? c : shade(c, k);
export default {
  npc_hat_flat_cap: { name: 'Civilian · flat cap', tier: 'common', why: 'a grey wool flat cap: the retiree on the bench feeding pigeons',
    draw(H) { const c = 0x6f6c66;
      solid(H, { ...rowsOf(30, 32, [-9, 8, -8, 8, 2]), 33: [-8, 7, -7, 9, 3] }, c);
      solid(H, { 30: [-8, 7, 9, 11, 2] }, shade(c, .9)); } },
  npc_hat_ball_cap: { name: 'Civilian · plain ball cap', tier: 'common', why: 'navy, no logo, curved bill: dad at the ballfield',
    draw(H) { const c = 0x2d3546;
      solid(H, { ...rowsOf(30, 32, [-9, 8, -8, 8, 2]), 33: [-9, 8, -8, 8, 3], 34: [-7, 6, -6, 6, 3] }, c);
      solid(H, { 30: [-7, 6, 9, 13, 2], 29: [-8, 7, 9, 12, 2] }, (x, y) => y === 29 && Math.abs(x + .5) < 6 ? null : shade(c, .92)); } },
  npc_hat_hard_hat: { name: 'Civilian · hard hat', tier: 'common', why: 'a scuffed white hard hat: the site foreman on his lunch',
    draw(H) { const c = 0xd9d6cc;
      ring(H, 30, [-11, 10, -10, 12, 3], [-9, 8, -8, 8], shade(c, .92));
      solid(H, { ...rowsOf(30, 33, [-9, 8, -8, 8, 2]), 34: [-8, 7, -7, 7, 2], 35: [-6, 5, -5, 5, 2] }, (x, y, z) => x >= -1 && x <= 0 && y >= 33 ? shade(c, .9) : c); } },
  npc_hat_knit: { name: 'Civilian · plain knit', tier: 'common', why: 'a charcoal knit hat, no tag: January on the subway platform',
    draw(H) { const c = 0x3c3f45, yb = z => z >= 3 ? 30 : 29;
      for (let x = -10; x <= 9; x++) for (let z = -9; z <= 9; z++) if (inFoot(x, z, [-10, 9, -9, 9, 2])) for (let y = yb(z); y <= yb(z) + 2; y++) H.set(x, y, z, rib(shade(c, .95), .86)(x, y, z));
      for (let x = -9; x <= 8; x++) for (let z = -8; z <= 8; z++) if (inFoot(x, z, [-9, 8, -8, 8, 1])) for (let y = yb(z) + 3; y <= 35; y++) H.set(x, y, z, rib(c)(x, y, z));
      solid(H, { 36: [-8, 7, -7, 7, 2], 37: [-5, 4, -4, 4, 2] }, rib(c)); } },
  npc_hat_bucket_beige: { name: 'Civilian · tourist bucket', tier: 'common', why: 'a beige cotton bucket hat bought at the ferry kiosk',
    draw(H) { const c = 0xcbbf9f, b = shade(c, .92);
      solid(H, { ...rowsOf(30, 34, [-9, 8, -8, 8, 2]), 35: [-8, 7, -7, 7, 2] }, c);
      ring(H, 30, [-11, 10, -10, 10, 4], [-9, 8, -8, 8], b); ring(H, 29, [-12, 11, -11, 11, 5], [-10, 9, -9, 9], b); } },

  // ───────────────────────── THE CLEANERS' HOODS (uniform: true: never rolled; style/city/cast.js OUTFITS cleaner_visor / cleaner_mask).
  // A white hazmat hood round the whole head (x −10..9, y 18..35, z −9..8: two voxels out at the ears, one elsewhere), its rim one proud
  // round the face opening (z 9), and the face panel in the opening (z 8, one proud of the face plane): every face cell is covered.
  npc_cleaner_hood_visor: { name: 'Cleaner · hood, dark visor', tier: 'common', uniform: true, cover: 'all', coversEars: true,
    why: 'the Cleaners, variant A: white hazmat hood, a faceless dark visor from the brow to the chin',
    draw(H) { cleanerHood(H); for (let x = -7; x <= 6; x++) for (let y = 19; y <= 31; y++) { const vis = y >= 21 && y <= 30 && !((x === -7 || x === 6) && (y === 21 || y === 30));
      H.set(x, y, 8, vis ? VISOR : y < 21 ? shade(HOOD, .9) : HOOD, vis ? 1 : 0); } } },
  npc_cleaner_hood_mask: { name: 'Cleaner · hood, respirator', tier: 'common', uniform: true, cover: 'all', coversEars: true,
    why: 'the Cleaners, variant B: white hazmat hood, a full-face respirator: two round lenses, the snout and two filters',
    draw(H) { cleanerHood(H); const lens = (x, y) => y >= 23 && y <= 27 && ((x >= -6 && x <= -3) || (x >= 2 && x <= 5)) && !((x === -6 || x === -3 || x === 2 || x === 5) && (y === 23 || y === 27));
      for (let x = -7; x <= 6; x++) for (let y = 19; y <= 31; y++) H.set(x, y, 8, lens(x, y) ? LENS : y >= 30 ? HOOD : RUBBER, lens(x, y) ? 1 : 0);
      for (let x = -2; x <= 1; x++) for (let y = 19; y <= 22; y++) { H.set(x, y, 9, RUBBER); if (y <= 21) H.set(x, y, 10, shade(RUBBER, .85)); }   // the snout
      for (const x0 of [-6, 3]) for (let x = x0; x <= x0 + 2; x++) for (let y = 19; y <= 21; y++) for (let z = 9; z <= 10; z++) H.set(x, y, z, z === 10 && x === x0 + 1 && y === 20 ? shade(FILTER, .7) : FILTER); } },
};
