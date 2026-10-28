// SPREAD · THE FRAME of a hand-authored kit (the compounds, set pieces and terrain: style/city/SPREAD.md). A kit that authors in today's
// world metres authors in the FRAME of the block that builds it — a compound's blocks share the compound's frame, anchored at its centre.
// off(ctx) is how far that frame sits in the spread world (world/city.js shiftOf: [0, 0] at SPREAD 0, so today's city is byte for byte);
// at / atR / atB carry a point, a rect [x0, z0, x1, z1] or a box [x0, y0, z0, x1, y1, z1] from frame metres into the spread world, where
// the engine, the registry, the bank and the people live. inFrame / frameCell: a block's own part of a compound authored once is its
// frame cell (today's grid, P0), so every piece keeps the block it had. A thing in the street band keeps to its kerb instead: kerbX /
// kerbZ carry today's coordinate across a street line (in the road or the curb half of today's 2 m walk: the same distance from the kerb;
// at the shopfront: from the lot line). Worker-safe.
// A kit's own marks (pass 2c): stopAt carries a transit stop to its kerb; camAt carries a camera's point so its framing still frames
// what it did.
import { P0, P, HS, SPREAD, shiftOf, hwX, hwZ, rwX, rwZ, compoundAt, interior0, remap } from '../../../world/city.js';

export const off = ctx => shiftOf(ctx.i, ctx.j);
export const at = (ctx, x, z) => { const [sx, sz] = off(ctx); return [x + sx, z + sz]; };
export const atR = (ctx, r) => { const [sx, sz] = off(ctx); return [r[0] + sx, r[1] + sz, r[2] + sx, r[3] + sz]; };
export const atB = (ctx, b) => { const [sx, sz] = off(ctx); return [b[0] + sx, b[1], b[2] + sz, b[3] + sx, b[4], b[5] + sz]; };
export const life = (ctx, A, p) => { const [x, z] = at(ctx, p.x, p.z); A.life.push({ ...p, x, z }); };
export const frameCell = ctx => [ctx.i * P0, ctx.j * P0, ctx.i * P0 + P0, ctx.j * P0 + P0];
export const inFrame = (ctx, x, z) => Math.floor(x / P0) === ctx.i && Math.floor(z / P0) === ctx.j;
const kerb = (v, rw, hw) => { const L = Math.round(v / P0), d = v - L * P0, a = Math.abs(d), s = d < 0 ? -1 : 1, rw0 = rw(L) - HS, hw0 = rw0 - 2;
  return L * P + s * (a <= hw0 + 1 ? hw(L) - (hw0 - a) : rw(L) - (rw0 - a)); };
export const kerbX = x => HS ? kerb(x, rwX, hwX) : x, kerbZ = z => HS ? kerb(z, rwZ, hwZ) : z;
// a bus or taxi stop (a kit's transit entry in today's metres; rot & 1: it slides along z) → the spread world: across its street at the
// kerb (kerbX / kerbZ); along it with its block — a compound's stop with the compound's shift, so it stays at the door it serves
export const stopAt = t => { if (!HS) return t; const c = compoundAt(Math.floor(t.x / P0), Math.floor(t.z / P0)), [sx, sz] = c ? shiftOf(c.i0, c.j0) : [0, 0], al = (t.rot ?? 0) & 1 ? 'z' : 'x';
  return { ...t, x: c && al === 'x' ? t.x + sx : kerbX(t.x), z: c && al === 'z' ? t.z + sz : kerbZ(t.z) }; };
// a camera's point in today's metres (pos, tgt or a shadow centre) → the spread world. s: the shift of what it frames. Inside a street's
// right-of-way the coordinate across the street stretches with it (remap); along a street and off the streets it moves with s, so the
// view onto what it frames keeps its line. A camera that stands somewhere of its own (a corner, a street's end) goes through remap whole.
const grid = v => v + SPREAD * Math.floor(v / P0) + HS;   // (remap off every street band: the block's own shift)
export const camAt = (x, z, s) => { if (!HS) return [x, z]; const c = compoundAt(Math.floor(x / P0), Math.floor(z / P0));
  if (c) { const a = interior0(c.i0, c.j0), b = interior0(c.i1, c.j1); if (x >= a.x0 && x <= b.x1 && z >= a.z0 && z <= b.z1) return [x + s[0], z + s[1]]; }
  const [rx, rz] = remap(x, z); return [rx !== grid(x) ? rx : x + s[0], rz !== grid(z) ? rz : z + s[1]]; };
// a kit camera { pos, tgt, sh? } through camAt (s: what it frames). pos: 'cam' (camAt, the default), 'place' (a spot of its own: a corner,
// a street's end, the span: remap) or 'frame' (it stands in the framed thing's frame: rigidly by s)
export const camera = (c, s, pos = 'cam') => { if (!HS) return c; const v = ([x, y, z], m) => { const [X, Z] = m === 'place' ? remap(x, z) : m === 'frame' ? [x + s[0], z + s[1]] : camAt(x, z, s); return [X, y, Z]; };
  return { ...c, pos: v(c.pos, pos), tgt: v(c.tgt), ...(c.sh ? { sh: [...camAt(c.sh[0], c.sh[1], s), c.sh[2]] } : {}) }; };
