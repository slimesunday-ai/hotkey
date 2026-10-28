// THE LONG BRIDGE · hero · the island end (block 7,−9) · owner: the water-side agent (batch 5).
// The bridge's towers, span, deck and checkpoint come from districts/jail/bridge.js; this block adds its people: a man fishing off the
// span's east rail (rod, line, bucket, cooler: people fish off every bridge in this city, even this one), a woman waiting at the LONG
// BRIDGE bus stop with her phone, and gulls sitting on the south tower's girder.
import { kitNow } from '../gen.js';
import { heroBlock } from '../districts/jail/build.js';
import { C, CV, SIDE, wv, later, person, pv, prop, memo, inBlock, put, unmp } from '../districts/jail/lib.js';
import { TOWERS, GIRDER, DECK } from '../districts/jail/plan.js';

export function longBridge(bank, b, A) { heroBlock(bank, b, A, kitNow(), content); }
const SEEDS = { fisher: 1101, bus: 1102 };
const bucket = () => memo('bucket', () => { const V = pv(4, 4, 4); V.box(0, 0, 0, 4, 4, 4, 0xff7a1a); V.box(1, 3, 1, 3, 4, 3, 0x2f86d8); return prop(V, 'bucket'); });
const cooler = () => memo('cooler', () => { const V = pv(6, 4, 4); V.box(0, 0, 0, 6, 4, 4, 0x2f5bff); V.box(0, 3, 0, 6, 4, 4, C.chalk); V.box(2, 4, 1, 4, 4, 3, C.chalk); return prop(V, 'cooler'); });

function content(ctx) {
  ctx.group('fishing'); const y = DECK.walk;
  // the man fishing: at the east rail of the lift span, facing the water; the rod over the rail, the line down to the bay
  const fx = 232.3, fz = -271.8; person(ctx, fx, y, fz, Math.PI / 2, 'arms', SEEDS.fisher);
  put(ctx, bucket(), 232.6, -270.6, { y, reach: .3, slide: [0, 1] }); put(ctx, cooler(), 232.5, -273.1, { y, rot: 1, reach: .3, slide: [0, 1] });
  const R = wv(ctx, [fx + .3, fz - .2, 236.2, fz + .2], 0, 2.9, { s: CV, out: 1 }); if (R) { const tip = [235.9, 2.8];
    for (let s = 0; s <= 60; s++) { const t = s / 60, x = fx + .45 + (tip[0] - fx - .45) * t, yy = y + 1.05 + (tip[1] - y - 1.05) * t; R.set(x, yy, fz, t < .15 ? C.ink : C.steelD); }
    for (let yy = .02; yy < tip[1]; yy += .1) R.set(tip[0] + .02, yy, fz, 0xe6e6e6);
    later(ctx, R); }
  // waiting on the LONG BRIDGE stop's bench (the kit's shelter, facing the road: its bench 0.4 m in from its back glass, seat top 0.6 up)
  const stop = (ctx.A.transit || []).find(s => s.t.id === 'bus-long-bridge');
  if (stop) { const [px0, pz0] = unmp(ctx, stop.x + .1, stop.z + .5); person(ctx, px0, y + .15, pz0, -Math.PI / 2, 'sit', SEEDS.bus, { seatY: .45 }); }   // (SPREAD: the shelter stands in the spread world)
  // gulls on the south tower's girder (their own little volume: they sit on it, one piece each)
  ctx.group('gulls-girder'); const T = TOWERS.S;
  for (const [gx, gz] of [[230.5, T.z0 + .7], [233.9, T.z1 - .6]]) { if (!inBlock(ctx, gx, gz)) continue; const G = wv(ctx, [gx - .2, gz - .3, gx + .2, gz + .3], GIRDER[1], GIRDER[1] + .5, { s: CV });
    if (!G) continue; G.box(gx - .1, GIRDER[1], gz - .2, gx + .1, GIRDER[1] + .3, gz + .2, 0xf5f6f4); G.box(gx - .1, GIRDER[1] + .2, gz - .2, gx + .1, GIRDER[1] + .3, gz + .1, 0xb4bcc6); G.box(gx - .05, GIRDER[1] + .3, gz + .1, gx + .05, GIRDER[1] + .45, gz + .2, 0xf5f6f4); G.set(gx, GIRDER[1] + .35, gz + .25, 0xffc21a); later(ctx, G); }
}
