// NPC POOL · hats (slot 'hat'). A few plain city hats: a flat cap, an unbranded ball cap, a white hard hat, a plain knit, a beige
// tourist bucket. No logos, no stickers, no patches, matte. Built like hats.js (copied into kit.js): every crown a closed solid on the
// hair shell with its rim on it, so the auto cover keeps hair whole; nothing below y 29 at the front. README § The NPC pool and § Hats.
import { solid, rowsOf, ring, inFoot, shade } from './kit.js';
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
};
