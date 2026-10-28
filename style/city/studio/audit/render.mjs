// CHARACTER AUDIT · a small software renderer for the board: the look's segments (with their joint slabs), posed by the real
// shader transforms (poses.json), drawn as voxel faces with a z-buffer; highlighted voxels are painted magenta. → PNG.
import zlib from 'node:zlib';
import { S, N6, vk, slabCells } from './lib.mjs';
const CORN = [[[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]];
const mul = (T, p) => [T[0] * p[0] + T[1] * p[1] + T[2] * p[2] + T[9], T[3] * p[0] + T[4] * p[1] + T[5] * p[2] + T[10], T[6] * p[0] + T[7] * p[1] + T[8] * p[2] + T[11]];
const rot = (T, n) => [T[0] * n[0] + T[1] * n[1] + T[2] * n[2], T[3] * n[0] + T[4] * n[1] + T[5] * n[2], T[6] * n[0] + T[7] * n[1] + T[8] * n[2]];
export function posedCentre(m, P, pose, grip, keys) { const T = P.T[pose][grip], ks = new Set(keys); let c = [0, 0, 0], n = 0;
  for (const v of m.V.values()) if (ks.has(v.k)) { const p = mul(T[v.part], [(v.x + .5) * S, (v.y + .5) * S, (v.z + .5) * S]); c = c.map((a, i) => a + p[i]); n++; } return n ? c.map(a => a / n) : [0, 1, 0]; }
export function render(m, P, pose, grip, { eye, target, fov = 30, W = 360, H = 440, hl = new Set(), bg = [212, 212, 207] }) {
  const T = P.T[pose][grip], img = new Uint8Array(W * H * 3), zb = new Float32Array(W * H).fill(Infinity);
  for (let i = 0; i < W * H; i++) img.set(bg, i * 3);
  const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]], fl = Math.hypot(...f); f.forEach((a, i) => f[i] = a / fl);
  let r = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; const rl = Math.hypot(...r); r = r.map(a => a / rl); const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const foc = H / 2 / Math.tan(fov * Math.PI / 360), proj = p => { const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]], z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; return [W / 2 + (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / z * foc, H / 2 - (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / z * foc, z]; };
  const sun = [-.52, .74, .42], sl = Math.hypot(...sun); sun.forEach((a, i) => sun[i] = a / sl);
  const all = [...m.V.values(), ...slabCells(m)], byPart = Array.from({ length: 13 }, () => new Set()); for (const v of all) byPart[v.part].add(v.k);
  const tri = (a, b, c, col) => { const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0]))), y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-9) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const px = x + .5, py = y + .5, w0 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den, w1 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue; const z = w0 * a[2] + w1 * b[2] + w2 * c[2], i = y * W + x; if (z >= zb[i]) continue; zb[i] = z; img[i * 3] = col[0]; img[i * 3 + 1] = col[1]; img[i * 3 + 2] = col[2]; } };
  for (const v of all) { const TP = T[v.part], own = byPart[v.part], lit = hl.has(v.k);
    for (let i = 0; i < 6; i++) { const d = N6[i]; if (own.has(vk(v.x + d[0], v.y + d[1], v.z + d[2]))) continue;
      const n = rot(TP, d), view = [eye[0] - TP[9], eye[1] - TP[10], eye[2] - TP[11]]; if (n[0] * view[0] + n[1] * view[1] + n[2] * view[2] < -3) continue;
      const q = CORN[i].map(c => proj(mul(TP, [(v.x + c[0]) * S, (v.y + c[1]) * S, (v.z + c[2]) * S]))); if (q.some(p => p[2] < .05)) continue;
      const sh = .55 + .45 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]) + .08 * n[1];
      let c = [(v.c >> 16) & 255, (v.c >> 8) & 255, v.c & 255]; if (lit) c = [255 * .8 + c[0] * .2, 43 * .8 + c[1] * .2, 214 * .8 + c[2] * .2];
      c = c.map(a => Math.max(0, Math.min(255, Math.round(a * sh)))); tri(q[0], q[1], q[2], c); tri(q[0], q[2], q[3], c); } }
  return { W, H, img };
}
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
export function png({ W, H, img }) { const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const hdr = Buffer.alloc(13); hdr.writeUInt32BE(W, 0); hdr.writeUInt32BE(H, 4); hdr[8] = 8; hdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); }
