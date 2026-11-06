// C2-GAPS (2026-11-05) · THE BIRDS' MODELS for traffic/birds.js (slime, 11-05: "birds (pigeons and gulls)"). One voxel model per bird
// and pose, meshed for an InstancedMesh (vertex colours, one face per exposed cell side), every bird facing −z with its feet at y 0:
//   gull    the jail kit's herring gull (districts/jail/lib.js gull(v, fly)): perched; in flight its M (flyA) and the same wings drooped
//           on the downstroke (flyB: each wing cell past the shoulder lowered by half its distance out)
//   pigeon  one bird of the props' flock (props.js pigeons: its connected cells — body, neck, the green-sheened head, the bill), turned
//           to face −z; in flight (new here, in the same cells and colours): wings out level (flyA) and down (flyB)
// No three at the top level: birds.js passes THREE in.
import { gull } from '../districts/jail/lib.js';
import { pigeons } from '../props.js';

const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// a Vol's cells → [[x, y, z, hex]] in cells (its palette's colours)
const cellsOf = V => { const out = []; for (let y = 0; y < V.ny; y++) for (let z = 0; z < V.nz; z++) for (let x = 0; x < V.nx; x++) { const v = V.d[x + z * V.nx + y * V.sxz]; if (v) out.push([x, y, z, V.pal[v]]); } return out; };
// connected components (6-neighbour) of a cell list
function parts(cells) { const key = c => c[0] + ',' + c[1] + ',' + c[2], M = new Map(cells.map(c => [key(c), c])), seen = new Set(), out = [];
  for (const c of cells) { if (seen.has(key(c))) continue; const comp = [], q = [c]; seen.add(key(c));
    while (q.length) { const a = q.pop(); comp.push(a); for (const [dx, dy, dz] of DIRS) { const k = (a[0] + dx) + ',' + (a[1] + dy) + ',' + (a[2] + dz); if (M.has(k) && !seen.has(k)) { seen.add(k); q.push(M.get(k)); } } }
    out.push(comp); }
  return out; }
// cells (in cells of s m) → a BufferGeometry: centred on x and z (of the body's cells: cx, cz), feet at y 0
function mesh(THREE, cells, s, cx, cz) { const has = new Set(cells.map(c => c[0] + ',' + c[1] + ',' + c[2])), P = [], N = [], C = [], I = [], col = new THREE.Color(); let v = 0, y0 = Infinity;
  for (const c of cells) y0 = Math.min(y0, c[1]);
  for (const [x, y, z, hex] of cells) for (const [nx, ny, nz] of DIRS) { if (has.has((x + nx) + ',' + (y + ny) + ',' + (z + nz))) continue;
    // the face's four corners (a unit cube's side), shaded a little by its facing (the city's flat toon light does the rest)
    const ax = nx ? [0, 1, 0] : [1, 0, 0], bx = nz ? [0, 1, 0] : ny ? [0, 0, 1] : [0, 0, 1], o = [x + (nx > 0 ? 1 : 0), y + (ny > 0 ? 1 : 0), z + (nz > 0 ? 1 : 0)];
    const quad = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([a, b]) => [o[0] + ax[0] * a + bx[0] * b, o[1] + ax[1] * a + bx[1] * b, o[2] + ax[2] * a + bx[2] * b]);
    col.setHex(hex); const k = ny > 0 ? 1 : ny < 0 ? .72 : nx ? .9 : .84;
    for (const p of quad) { P.push((p[0] - cx) * s, (p[1] - y0) * s, (p[2] - cz) * s); N.push(nx, ny, nz); C.push(col.r * k, col.g * k, col.b * k); }
    // (wound so the face's normal points out)
    const cr = (ax[1] * bx[2] - ax[2] * bx[1]) * nx + (ax[2] * bx[0] - ax[0] * bx[2]) * ny + (ax[0] * bx[1] - ax[1] * bx[0]) * nz;
    if (cr > 0) I.push(v, v + 1, v + 2, v, v + 2, v + 3); else I.push(v, v + 2, v + 1, v, v + 3, v + 2); v += 4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); return g; }
const box = cells => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const c of cells) { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0] + 1); z0 = Math.min(z0, c[2]); z1 = Math.max(z1, c[2] + 1); } return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 }; };

// the gull: perched faces −z already (its bill at z 0); in flight too
function gullCells(v, fly, down) { const V = gull(v, fly).vol, c = cellsOf(V); if (!down) return { cells: c, s: V.s };
  const cx = (V.nx - 1) / 2; return { cells: c.map(([x, y, z, h]) => { const d = Math.abs(x - cx); return d > 2 ? [x, y - Math.round((d - 2) / 2) - 1, z, h] : [x, y, z, h]; }), s: V.s }; }
// one pigeon of the props' flock (variant 0's first bird), turned to face −z (its bill — the flock's 0xffb400 — leads)
function pigeonCells() { const V = pigeons(0).vol, all = parts(cellsOf(V)), p = all.sort((a, b) => b.length - a.length)[0], bill = p.find(c => c[3] === 0xffb400), mid = box(p);
  // (its bill on +x or −x: x → −z)
  const sg = bill && bill[0] > mid.cx ? 1 : -1; return { cells: p.map(([x, y, z, h]) => [z * sg, y, -x * sg, h]), s: V.s }; }
// the pigeon in flight: the flock's colours, body along z (head at −z), wings out across x
function pigeonFly(down) { const B = 0x8a93b8, D = 0x6f7aa8, T = 0x4b527a, out = [], add = (x, y, z, h) => out.push([x, y, z, h]);
  for (let z = 0; z < 4; z++) for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) add(x, y, z, B);
  add(0, 1, -1, 0x2fbf8f); add(1, 1, -1, 0x2fbf8f); add(0, 2, -1, B); add(1, 2, -1, B); add(0, 2, -2, 0xffb400);
  for (let x = 0; x < 2; x++) add(x, 1, 4, D);
  for (let k = 1; k <= 4; k++) for (const sd of [-1, 1]) { const x = sd < 0 ? -k : 1 + k, y = 1 + (down ? -Math.ceil(k / 2) : k > 2 ? 1 : 0); for (let z = 1; z < 3; z++) add(x, y, z, k >= 4 ? T : k >= 3 ? D : B); }
  return { cells: out, s: .1 }; }

const GEO = new Map();
// kind 'gull' | 'pigeon' · pose 'stand' | 'flyA' | 'flyB' · v the gull's mantle (0 … 2)
export function birdGeometry(THREE, kind, pose, v = 0) { const k = kind + pose + v; if (GEO.has(k)) return GEO.get(k);
  const m = kind === 'gull' ? gullCells(v, pose !== 'stand', pose === 'flyB') : pose === 'stand' ? pigeonCells() : pigeonFly(pose === 'flyB'), b = box(m.cells);
  const g = mesh(THREE, m.cells, m.s, b.cx, b.cz); GEO.set(k, g); return g; }
// a bird's size (m): its length nose to tail and its height perched (birds.js keeps them clear of cars and props by these)
export const BIRD_SIZE = { gull: { len: .7, h: .5, span: 1.7 }, pigeon: { len: .4, h: .35, span: .9 } };
