// NPC POOL · held (slot 'held'). The small everyday carry: a briefcase, a coffee, a canvas tote, a folded newspaper, a paper grocery
// bag. Plain, matte, unbranded, under the grip rules (README § Held: through the closed fist, inside the pose's envelope, nothing in
// the fist outside the channel). Built with held.js's own helpers (copied into kit.js). README § The NPC pool. Only import: './kit.js'.
import { bx, grip, hangers, RING2, sq3, plus, shade, CIV } from './kit.js';
export default {
  npc_held_briefcase: { name: 'Civilian · briefcase', tier: 'common', pose: 'down', why: 'office · a brown leather briefcase on the way to Glasswall',
    draw(G, ctx) { const L = CIV.brown, H = CIV.darkbrown; bx(G, 6, 7, 2, 5, -4, 3, L); for (const z of [-4, 3]) G.set(7, 5, z, H); hangers(G, H); grip(G, ctx, H); } },
  npc_held_coffee: { name: 'Civilian · coffee to go', tier: 'common', pose: 'raised', why: 'everyday · a paper cup of deli coffee, lid on',
    draw(G, ctx) { const W = CIV.white, K = CIV.tan, LID = CIV.charcoal;
      grip(G, ctx, W); for (const [x, y] of RING2) G.set(x, y, 2, K); G.set(6, 7, 2, K); sq3(G, 3, W); sq3(G, 4, LID); } },
  npc_held_tote: { name: 'Civilian · canvas tote', tier: 'common', pose: 'down', why: 'everyday · a plain canvas tote: lunch, a library book, a cardigan',
    draw(G, ctx) { const C = CIV.beige; bx(G, 6, 7, 2, 5, -3, 2, C); hangers(G, shade(C, .85)); grip(G, ctx, shade(C, .85)); } },
  npc_held_newspaper: { name: 'Civilian · folded newspaper', tier: 'common', pose: 'forward', why: 'everyday · the morning paper, folded in four, read on the ferry',
    draw(G, ctx) { const P = 0xd6d4ce, D = 0xb9b7b0;
      G.set(6, 7, -3, P); grip(G, ctx, P); for (const [x, y] of RING2) G.set(x, y, 2, D); G.set(6, 7, 2, P); sq3(G, 3, P); plus(G, 4, D); } },
  npc_held_groceries: { name: 'Civilian · grocery bag', tier: 'common', pose: 'both', why: 'everyday · a paper grocery bag in both arms, celery and a loaf up out of it',
    draw(G, ctx) { const K = CIV.tan, B = 0xc9b48f, V = CIV.sage;
      grip(G, ctx, K); bx(G, -4, 3, 5, 8, -1, 1, K); G.set(4, 7, -1, K); G.set(-5, 7, -1, K);   // the bag, joined to both fists' channels
      for (let x = -3; x <= -1; x++) G.set(x, 7, 2, B); G.set(1, 6, 2, V); G.set(1, 7, 2, V); G.set(2, 7, 2, V); } },
};
