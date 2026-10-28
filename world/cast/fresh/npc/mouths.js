// NPC POOL · mouths (slot 'mouth'). A plain line in the mouth zone, drawn from the worn skin's own mouth colour: voxels only, no fine
// paint, no teeth, no grills, no lip colour. README § The NPC pool and § Mouth (the zone). The only import allowed is './kit.js'.
import { lerpHex } from './kit.js';
const tone = (ctx, x, y) => lerpHex(ctx.sk.c(x, y, 7), ctx.sk.mouth ?? 0x4a2a26, .5);
export default {
  npc_mouth_line: { name: 'Civilian · flat line', tier: 'common', why: 'a short flat mouth: minding their own business',
    draw(H, ctx) { for (let x = -2; x <= 1; x++) H.set(x, 20, 7, tone(ctx, x, 20), ctx.sk.layer || 0); } },
  npc_mouth_smile: { name: 'Civilian · polite smile', tier: 'common', why: 'the small smile for the barista and the doorman',
    draw(H, ctx) { for (let x = -2; x <= 1; x++) H.set(x, 20, 7, tone(ctx, x, 20), ctx.sk.layer || 0);
      for (const x of [-3, 2]) H.set(x, 21, 7, tone(ctx, x, 21), ctx.sk.layer || 0); } },
};
