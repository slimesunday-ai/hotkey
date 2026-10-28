// AI CITY world v2 — the city plan: districts on a block grid, the road network, terrain, lots and addresses,
// plus the overrides store every structure writes into (OV / chunk buckets for blocks, props and signs).
import { B } from './tiles.js';
import { NAMES } from './names.js';

// SPREAD (2026-10-08) · THE GRID PITCH. P = P0 + SPREAD: every block's interior keeps today's size and all the new width goes to the
// streets (style/city/SPREAD.md). SPREAD is read from ?spread=<m> in a page (and a worker started with it: SPREAD_Q) or SPREAD=<m> in
// node. THE DEFAULT IS 4 (pass 5b, 2026-10-08: the city on the wider grid); ?spread=0 / SPREAD=0 is today's city, byte for byte, with
// today's data (sdata). HS: what each side of each street line gains.
const qp = k => { let m = null; try { m = typeof location !== 'undefined' && location.search ? new RegExp('[?&]' + k + '=(\\d+)').exec(location.search) : null; } catch { m = null; }
  if (m) return +m[1]; const e = typeof process !== 'undefined' ? process.env?.[k.toUpperCase()] : undefined; return e !== undefined && e !== '' ? +e : null; };
export const P0 = 32, SPREAD_DEFAULT = 4, SPREAD = qp('spread') ?? SPREAD_DEFAULT, HS = SPREAD / 2, SPREAD_Q = SPREAD !== SPREAD_DEFAULT ? '?spread=' + SPREAD : '';   // P0: today's pitch · SPREAD_Q: a worker URL's query
// SPREAD · THE DATA a spread reads (pass 5b): the generated data (the export, the sim's places, the simstate tables) is made at one spread.
// The default spread's files have their own names; another spread's sit beside them as <name>.s<m>.<ext>, so a page at ?spread=<m> (or
// node at SPREAD=<m>) reads and writes its own. sdata('sim2/places.json') → the file this SPREAD reads.
export const sdata = f => SPREAD === SPREAD_DEFAULT ? f : f.replace(/(\.[A-Za-z0-9]+)$/, '.s' + SPREAD + '$1');
export const SEED = 0x51CE, CH = 16, RG = 96, P = P0 + SPREAD, G = 10, WATER = 7;
// the grid's lines as functions (the spread is uniform: line i at i·P) and back: the block a coordinate lies in, the nearest line
export const X = i => i * P, Z = j => j * P, blockOf = v => Math.floor(v / P), lineOf = v => Math.round(v / P);
export function hash3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 2147483647 + SEED * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash3(xi, yi, 7), b = hash3(xi + 1, yi, 7), c = hash3(xi, yi + 1, 7), d = hash3(xi + 1, yi + 1, 7); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, y, o = 5) { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); n += a; a *= .5; f *= 2.03; } return s / n; }
export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const mod = (a, n) => ((a % n) + n) % n;

// ───────────────────────── districts (one kind per 32×32 city block; north is −z)
// kinds: . forest · ~ sea · D tower · d downtown fringe · L parking · B bank · C courthouse · S police · N nightlife · P plaza
//        s suburb · p park · r big lots · T trailer park · I industrial · Q docks · J junkyard · K jail · H hospital · G gas · M motel
const DN = NAMES.district;
export const DIST = {
  forest: { name: DN.forest, col: '#3f7a43' }, sea: { name: DN.sea, col: '#3f86b8' }, downtown: { name: DN.downtown, col: '#c9a26b' }, strip: { name: DN.strip, col: '#b0567a' },
  suburbs: { name: DN.suburbs, col: '#8fc46f' }, estates: { name: DN.estates, col: '#a6d48a' }, trailer: { name: DN.trailer, col: '#c7b27a' }, industrial: { name: DN.industrial, col: '#8d8f96' },
  docks: { name: DN.docks, col: '#6c7f94' }, junkyard: { name: DN.junkyard, col: '#8a6a4a' }, jail: { name: DN.jail, col: '#5b5d63' },
  hospital: { name: DN.hospital, col: '#e8e6e0' }, highway: { name: DN.highway, col: '#5a5b61' }, bridge: { name: DN.bridge, col: '#5a5b61' }, mall: { name: DN.mall, col: '#b9a37e' },
};
const KD = { '.': 'forest', '~': 'sea', D: 'downtown', d: 'downtown', L: 'downtown', B: 'downtown', C: 'downtown', S: 'downtown', N: 'strip', P: 'downtown', W: 'downtown',
  s: 'suburbs', p: 'suburbs', r: 'estates', T: 'trailer', I: 'industrial', Q: 'docks', J: 'junkyard', K: 'jail', H: 'hospital', G: 'highway', M: 'highway', A: 'mall' };
const KN = 64, KO = 32, KIND = new Uint8Array(KN * KN).fill(46);   // '.'
const setK = (i0, i1, j0, j1, ch) => { for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) KIND[(i + KO) * KN + (j + KO)] = ch.charCodeAt(0); };
setK(-32, 31, -32, -9, '~');
setK(-2, 6, -8, -5, 'I'); setK(0, 4, -8, -8, 'Q'); setK(-2, -1, -7, -6, 'J');
setK(-5, 6, -4, 2, 'd'); setK(-2, 1, -2, 1, 'D');
setK(-1, -1, -1, -1, 'B'); setK(0, 0, -1, -1, 'P'); setK(0, 0, -2, -2, 'C'); setK(1, 1, -1, -1, 'S'); setK(-2, -1, 1, 1, 'N'); setK(1, 1, 1, 1, 'L');
setK(-4, -4, 0, 0, 'L'); setK(-3, -3, 0, 0, 'W'); setK(2, 2, -4, -4, 'L'); setK(3, 3, 1, 1, 'N'); setK(6, 6, 0, 0, 'L'); setK(-5, -5, -2, -2, 'N');
setK(4, 5, -2, -1, 'H'); setK(4, 5, 0, 0, 'L');
setK(-8, -6, -3, -1, 'T');
setK(-5, 6, 3, 8, 's'); setK(-1, -1, 5, 5, 'p'); setK(3, 3, 7, 7, 'p'); setK(-9, -6, 4, 7, 'r');
setK(7, 7, 4, 4, 'G'); setK(7, 7, 5, 5, 'M'); setK(7, 8, -12, -10, 'K'); setK(-8, -6, 0, 2, 'A');   // the jail sits alone on Iron Island in the bay; the dead mall out west
export const kindAt = (i, j) => (i < -KO || i >= KO || j < -KO || j >= KO) ? (j <= -9 ? '~' : '.') : String.fromCharCode(KIND[(i + KO) * KN + (j + KO)]);
export const distOf = k => KD[k] || 'forest';
const MERGE = new Set(['H', 'T', 'J', 'K', 'A']);
export const urban = k => k !== '.' && k !== '~';
// compounds: merged multi-block sites, built once from their anchor (min i, min j)
export const COMPOUNDS = [{ k: 'H', i0: 4, i1: 5, j0: -2, j1: -1 }, { k: 'T', i0: -8, i1: -6, j0: -3, j1: -1 }, { k: 'J', i0: -2, i1: -1, j0: -7, j1: -6 }, { k: 'K', i0: 7, i1: 8, j0: -12, j1: -10 }, { k: 'A', i0: -8, i1: -6, j0: 0, j1: 2 }];
export const compoundAt = (i, j) => COMPOUNDS.find(c => i >= c.i0 && i <= c.i1 && j >= c.j0 && j <= c.j1) || null;

// ───────────────────────── roads: lines between blocks; avenues and the highway are wider
export const HWY = 7;   // x line of Route 9
const XAVE = new Set([-4, 0, 4]), ZAVE = new Set([-7, -4, 0, 4]);
// SPREAD · a street line's cross-section, four things that used to be one number (the half-width hw was also the class):
//   rw  the RIGHT-OF-WAY half-width, centre line to lot line (today hw + 2; + HS each side with the spread)
//   hw  the road's half-width, centre line to kerb (side street 2 → 3 at SPREAD 4, avenue 4, Route 9 7)
//   sw  the sidewalk, kerb to lot line (rw − hw: side street 2 → 3, avenue and Route 9 2 → 4)
//   ave the CLASS: an avenue (aveX / aveZ); Route 9 is L === HWY on the x lines; everything else a side street (one-way)
const rw0X = L => L === HWY ? 9 : XAVE.has(L) ? 6 : 4, rw0Z = L => ZAVE.has(L) ? 6 : 4;   // today's right-of-way (the remap's street bands)
export const rwX = L => rw0X(L) + HS, rwZ = L => rw0Z(L) + HS;
export const hwX = L => L === HWY ? 7 : XAVE.has(L) ? 4 : 2 + SPREAD / 4, hwZ = L => ZAVE.has(L) ? 4 : 2 + SPREAD / 4;
export const swX = L => rwX(L) - hwX(L), swZ = L => rwZ(L) - hwZ(L);
export const aveX = L => XAVE.has(L), aveZ = L => ZAVE.has(L);
function edge(ka, kb) { if (ka === '~' || kb === '~') return false; if (!urban(ka) && !urban(kb)) return false; if (ka === kb && MERGE.has(ka)) return false; return true; }
export function segX(L, j) { if (L === HWY) return j >= -9; return edge(kindAt(L - 1, j), kindAt(L, j)); }   // N–S road on x = L·P beside block row j
export function segZ(L, i) { if ((L === -7 && i === HWY) || (L === -9 && (i === 7 || i === 8))) return true; return edge(kindAt(i, L - 1), kindAt(i, L)); }     // E–W road on z = L·P beside block column i
const nsAt = (L, z, Lz, dz) => (Math.abs(dz) < rwZ(Lz) ? segX(L, Lz - 1) || segX(L, Lz) : segX(L, Math.floor(z / P)));
const ewAt = (L, x, Lx, dx) => (Math.abs(dx) < rwX(Lx) ? segZ(L, Lx - 1) || segZ(L, Lx) : segZ(L, Math.floor(x / P)));
export const XNAME = { [-9]: 'Quarry Rd', [-8]: 'Birch St', [-7]: 'Cedar St', [-6]: 'Dogwood St', [-5]: 'Elm St', [-4]: 'Grand Ave', [-3]: 'Hazel St', [-2]: 'Ivy St', [-1]: 'Jay St', 0: 'Main St', 1: 'Kent St', 2: 'Linden St', 3: 'Maple St', 4: 'Bishop Ave', 5: 'Nash St', 6: 'Orchard St', 7: 'Route 9', 8: 'Pike Rd', 9: 'Ridge Rd', 10: 'Tower Rd' };
export const ZNAME = { [-8]: 'Harbor Rd', [-7]: 'Dock St', [-6]: 'Foundry St', [-5]: 'Mill St', [-4]: 'Market Ave', [-3]: '3rd St', [-2]: '2nd St', [-1]: '1st St', 0: 'Central Ave', 1: 'Washington St', 2: 'Lincoln St', 3: 'Jackson St', 4: 'Union Ave', 5: 'Oak St', 6: 'Pine St', 7: 'Willow St', 8: 'Aspen St', 9: 'Fox Run' };

// road cell → top block (or null if not a road/sidewalk cell)
function roadTop(x, z) {
  const Lx = Math.round((x + .5) / P), dx = x + .5 - Lx * P, Lz = Math.round((z + .5) / P), dz = z + .5 - Lz * P, ax = Math.abs(dx), az = Math.abs(dz);
  const hx = hwX(Lx), hz = hwZ(Lz), ns = ax < rwX(Lx) && nsAt(Lx, z, Lz, dz), ew = az < rwZ(Lz) && ewAt(Lz, x, Lx, dx);
  const inNS = ns && ax < hx, inEW = ew && az < hz, hwy = Lx === HWY;
  if (inNS && inEW) return { top: B.ASPH };
  if (inNS) { const cross = ewAt(Lz, x, Lx, dx) || segZ(Lz, Lx - 1) || segZ(Lz, Lx);
    if (az < hz + 2 && cross && az >= hz && !hwy) return { top: B.ZEBRAZ };   // (the zebra: 2 m wide from the kerb, whatever the sidewalk)
    if (az < hz + 2 && cross) return { top: B.ASPH };
    const dash = mod(z, 6) < 3, pos = dx > 0;
    if (hwy) { if (ax < 1) return { top: B.BARRIER, h: G + 1, sub: B.ASPH }; if (ax < 2) return { top: pos ? B.ASPHYL : B.ASPHYR };
      if (ax > 6) return { top: pos ? B.ASPHWR : B.ASPHWL }; if ((ax > 2 && ax < 3) || (ax > 4 && ax < 5)) return { top: dash ? (pos ? B.ASPHWR : B.ASPHWL) : B.ASPH }; return { top: B.ASPH }; }
    if (ax < 1) return { top: aveX(Lx) ? (pos ? B.ASPHYL : B.ASPHYR) : (dash ? (pos ? B.ASPHYL : B.ASPHYR) : B.ASPH) };
    if (aveX(Lx) && ax > 1 && ax < 2 && dash) return { top: pos ? B.ASPHWR : B.ASPHWL };
    return { top: B.ASPH }; }
  if (inEW) { const cross = nsAt(Lx, z, Lz, dz) || segX(Lx, Lz - 1) || segX(Lx, Lz);
    if (ax < hx + 2 && cross && ax >= hx && Lx !== HWY) return { top: B.ZEBRAX };
    if (ax < hx + 2 && cross) return { top: B.ASPH };
    const dash = mod(x, 6) < 3, pos = dz > 0;
    if (az < 1) return { top: aveZ(Lz) ? (pos ? B.ASPHYT : B.ASPHYB) : (dash ? (pos ? B.ASPHYT : B.ASPHYB) : B.ASPH) };
    if (aveZ(Lz) && az > 1 && az < 2 && dash) return { top: pos ? B.ASPHWB : B.ASPHWT };
    return { top: B.ASPH }; }
  if (ns && hwy) { if (ew) return { top: B.WALK }; const rail = ax < hx + 1; return rail ? { top: B.RAILZ, h: G + 1, sub: B.GRAVEL } : { top: B.GRAVEL }; }
  if (ns || ew) return { top: B.WALK };
  return null;
}

// block interior bounds (inclusive min, exclusive max): the part of a block not taken by roads or sidewalks. SPREAD: today's interior
// (interior0, the P0 grid) moved by the block's shift, so its size never changes: a side with a road starts at the lot line (rw), a side
// without one keeps an HS margin, and a compound's blocks all move with the compound (anchored at its centre: the extra is margin).
export function interior0(i, j) {
  const x0 = i * P0 + (segX(i, j) ? rw0X(i) : 0), x1 = (i + 1) * P0 - (segX(i + 1, j) ? rw0X(i + 1) : 0);
  const z0 = j * P0 + (segZ(j, i) ? rw0Z(j) : 0), z1 = (j + 1) * P0 - (segZ(j + 1, i) ? rw0Z(j + 1) : 0);
  return { x0, x1, z0, z1 };
}
export function interior(i, j) { const R = interior0(i, j); if (!SPREAD) return R; const [sx, sz] = shiftOf(i, j); return { x0: R.x0 + sx, x1: R.x1 + sx, z0: R.z0 + sz, z1: R.z1 + sz }; }
export function compoundInterior(c) { const a = interior(c.i0, c.j0), b = interior(c.i1, c.j1); return { x0: a.x0, z0: a.z0, x1: b.x1, z1: b.z1 }; }
// SPREAD · how far a block's content moves (today's world → the spread one): a block by SPREAD·i + HS, a compound's blocks all by the
// compound's (its centre's: SPREAD·(i0 + i1 + 1) / 2)
export function shiftOf(i, j) { if (!SPREAD) return [0, 0]; const c = compoundAt(i, j); return c ? [SPREAD * (c.i0 + c.i1 + 1) / 2, SPREAD * (c.j0 + c.j1 + 1) / 2] : [SPREAD * i + HS, SPREAD * j + HS]; }
// SPREAD · THE REMAP: a point of today's world → the spread world. In a block's interior (or a compound's): the block's shift. Within
// today's right-of-way of a street line that carries a road there (a street band: rw0 either side, as roadTop reads the bands): stretched
// about the line, so the street stays continuous; a line with no road (the sea's edge, the woods) opens HS of margin either side instead.
// unmap is its exact inverse. unshift (spread → today) is for a point of a block's content: it takes off the shift of the block it is in.
// frameOf(i, j): the block's own frame, today's corner (i·P0, j·P0) moved with its content (offsets from it keep their place).
const nsBand0 = (x, z, q) => { const L = Math.round(x / q.P), d = x - L * q.P; if (Math.abs(d) > rw0X(L) + q.H) return null; const Lz = Math.round(z / q.P), dz = z - Lz * q.P;
  return (Math.abs(dz) < rw0Z(Lz) + q.H ? segX(L, Lz - 1) || segX(L, Lz) : segX(L, Math.floor(z / q.P))) ? [L, d, rw0X(L)] : null; };
const ewBand0 = (x, z, q) => { const L = Math.round(z / q.P), d = z - L * q.P; if (Math.abs(d) > rw0Z(L) + q.H) return null; const Lx = Math.round(x / q.P), dx = x - Lx * q.P;
  return (Math.abs(dx) < rw0X(Lx) + q.H ? segZ(L, Lx - 1) || segZ(L, Lx) : segZ(L, Math.floor(x / q.P))) ? [L, d, rw0Z(L)] : null; };
const TODAY = { P: P0, H: 0 }, NOW = { P, H: HS };
export function remap(x, z) { if (!SPREAD) return [x, z]; const c = compoundAt(Math.floor(x / P0), Math.floor(z / P0));
  if (c) { const a = interior0(c.i0, c.j0), b = interior0(c.i1, c.j1); if (x >= a.x0 && x <= b.x1 && z >= a.z0 && z <= b.z1) { const [sx, sz] = shiftOf(c.i0, c.j0); return [x + sx, z + sz]; } }
  const bx = nsBand0(x, z, TODAY), bz = ewBand0(x, z, TODAY);
  return [bx ? bx[0] * P + bx[1] * (bx[2] + HS) / bx[2] : x + SPREAD * Math.floor(x / P0) + HS, bz ? bz[0] * P + bz[1] * (bz[2] + HS) / bz[2] : z + SPREAD * Math.floor(z / P0) + HS]; }
export function unmap(x, z) { if (!SPREAD) return [x, z]; const c = compoundAt(Math.floor(x / P), Math.floor(z / P));
  if (c) { const R = compoundInterior(c); if (x >= R.x0 && x <= R.x1 && z >= R.z0 && z <= R.z1) { const [sx, sz] = shiftOf(c.i0, c.j0); return [x - sx, z - sz]; } }
  const bx = nsBand0(x, z, NOW), bz = ewBand0(x, z, NOW);
  return [bx ? bx[0] * P0 + bx[1] * bx[2] / (bx[2] + HS) : x - SPREAD * Math.floor(x / P) - HS, bz ? bz[0] * P0 + bz[1] * bz[2] / (bz[2] + HS) : z - SPREAD * Math.floor(z / P) - HS]; }
export const frameOf = (i, j) => { const [sx, sz] = shiftOf(i, j); return [i * P0 + sx, j * P0 + sz]; };
export function unshift(x, z) { if (!SPREAD) return [x, z]; const [sx, sz] = shiftOf(Math.floor(x / P), Math.floor(z / P)); return [x - sx, z - sz]; }

// ───────────────────────── terrain outside the city: distance-to-city field → hills, lakes, the coast
const FC = 8, FN = 256, FO = FN / 2, UD = new Float32Array(FN * FN).fill(1e9), LD = new Float32Array(FN * FN).fill(1e9);
function bfs(F, seed) { const q = [];
  for (let a = 0; a < FN; a++) for (let b = 0; b < FN; b++) { const x = (a - FO) * FC + 4, z = (b - FO) * FC + 4; if (seed(x, z, kindAt(Math.floor(x / P), Math.floor(z / P)))) { F[a * FN + b] = 0; q.push(a * FN + b); } }
  for (let h = 0; h < q.length; h++) { const c = q[h], a = (c / FN) | 0, b = c % FN, d = F[c];
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const na = a + da, nb = b + db; if (na < 0 || nb < 0 || na >= FN || nb >= FN) continue; const n = na * FN + nb; if (F[n] > d + 1) { F[n] = d + 1; q.push(n); } } } }
const R9_SEED = remap(HWY * P0, -240)[1];   // (SPREAD: today's −240 on Route 9, remapped: the strip south of the coast)
bfs(UD, (x, z, k) => urban(k) || (Math.abs(x - HWY * P) < 12 && z > R9_SEED));
bfs(LD, (x, z, k) => urban(k) && k !== 'K');
const sample = (F, x, z, cap) => { const fx = x / FC + FO - .5, fz = z / FC + FO - .5, a = Math.max(0, Math.min(FN - 2, Math.floor(fx))), b = Math.max(0, Math.min(FN - 2, Math.floor(fz))), u = Math.min(1, Math.max(0, fx - a)), v = Math.min(1, Math.max(0, fz - b));
  const g = (i, k) => Math.min(F[i * FN + k], cap); return ((g(a, b) * (1 - u) + g(a + 1, b) * u) * (1 - v) + (g(a, b + 1) * (1 - u) + g(a + 1, b + 1) * u) * v) * FC; };
export const landDist = (x, z) => sample(LD, x, z, 60);
// SPREAD · the terrain's hand-placed constants are today's, carried into the spread world: Iron Island moves with the jail compound K
// (shiftOf) to the island road's line, the lake with its woods block (remap), the coast with the city's rows (remap of today's coast at
// today's x; its noise reads today's x, so the shoreline keeps its shape)
export const JAIL_RECT = (() => { const [kx, kz] = shiftOf(7, -12); return [224 + kx, -384 + kz, 288 + kx, remap(256, -288)[1]]; })();
const rectDist = (x, z, [x0, z0, x1, z1]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
export function urbanDist(x, z) { return sample(UD, x, z, 60); }
const coastZ0 = x => { const dock = sstep(-120, -60, x) * (1 - sstep(250, 330, x)); return -256 - 6 - (fbm(x * .008 + 3, 3.3, 3) - .35) * 70 * (1 - dock); };
export function coastZ(x) { if (!SPREAD) return coastZ0(x); const [ux] = unmap(x, -8.5 * P); return remap(ux, coastZ0(ux))[1]; }
export const LAKE = (() => { const [x, z] = remap(-390, 20); return { x, z, r: 48 }; })();
const LKS = [LAKE.x + 390, LAKE.z - 20];   // (SPREAD: the lake's noise reads its own frame, so its shoreline keeps today's shape: forest/land.js lakeOf)
function terrain(x, z) {
  const du = urbanDist(x, z), ramp = sstep(6, 90, du);
  let h = G + ramp * ((fbm(x * .011 + 3, z * .011 - 2, 4) - .40) * 36 + (fbm(x * .05, z * .05 + 9, 2) - .5) * 4);
  const ld = Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.3) / (LAKE.r * (.8 + fbm((x - LKS[0]) * .03, (z - LKS[1]) * .03, 2) * .45));
  if (ld < 1.25) h = Math.min(h, G - 1 + (ld - 1) * 18);
  const cz = coastZ(x); if (z < cz + 24) { const t = sstep(cz - 30, cz + 24, z); h = Math.min(h, (WATER - 4) * (1 - t) + h * t); }
  const dl = landDist(x, z), shore = 115 + fbm(x * .006 + 7, z * .006 - 3, 3) * 95, sea = sstep(shore - 45, shore + 5, dl);   // the mainland is an island
  if (sea > 0) h = h * (1 - sea) + (WATER - 5 - sstep(shore, shore + 80, dl) * 5) * sea;
  const jd = rectDist(x, z, JAIL_RECT); if (jd < 22) { const t = sstep(8, 22, jd); h = Math.max(h, G * (1 - t) + (WATER - 4) * t); }   // Iron Island
  return Math.max(1, Math.round(h));
}
function trail(x, z) { const n = fbm(x * .0075 + 40, z * .0075 - 13, 3); return Math.abs(n - .5) < .011; }

// ───────────────────────── column: ground height + top block at (x, z), cached per chunk
const cnum = (cx, cz) => (cx + 4096) * 8192 + (cz + 4096);
const COLC = new Map(); let lastColK = NaN, lastColA = null;
export function column(x, z) {
  if (!Number.isInteger(x)) x = Math.floor(x); if (!Number.isInteger(z)) z = Math.floor(z);
  const k = cnum(x >> 4, z >> 4); let a;
  if (k === lastColK) a = lastColA; else { a = COLC.get(k); if (!a) { if (COLC.size > 8000) COLC.clear(); a = new Array(256); COLC.set(k, a); } lastColK = k; lastColA = a; }
  const i = ((x & 15) << 4) | (z & 15); return a[i] || (a[i] = computeColumn(x, z));
}
function computeColumn(x, z) {
  const i = Math.floor(x / P), j = Math.floor(z / P), kd = kindAt(i, j), dist = distOf(kd);
  let h = G, top = null, sub = null, kind = kd;
  const r = roadTop(x, z);
  let bridge = false, th = 0, pier = false;
  if (r) { top = r.top; if (r.h) { h = r.h; sub = r.sub; } kind = 'road';
    th = terrain(x, z); if (th < WATER) { bridge = true; if (sub === B.GRAVEL) sub = B.CONC;   // a road over water is a bridge deck on piers
      const Lx = Math.round((x + .5) / P), nsBand = Math.abs(x + .5 - Lx * P) < rwX(Lx); pier = nsBand ? mod(z, 28) < 2 : mod(x, 28) < 2; } }
  else if (urban(kd)) { top = GROUND[kd] || B.CONC; }
  else { h = terrain(x, z); const du = urbanDist(x, z);
    if (h <= WATER + 1 && h >= WATER - 1 && du > 3) top = B.SAND; else if (h < WATER - 1) top = B.SAND;
    else if (du > 5 && trail(x, z)) top = B.DIRT; else if (h > G + 17 && hash3(x, 3, z) < .6) top = B.ROCK; }
  return { h, top, sub, kind, dist, i, j, bridge, th, pier };
}
const GROUND = { D: B.PAVER, d: B.WALK, W: B.WALK, L: B.ASPH, B: B.PAVER, C: B.PAVER, S: B.WALK, N: B.WALK, P: B.PAVER, s: B.GRASS, p: B.GRASS, r: B.GRASS,
  T: B.GRAVEL, I: B.STAIN, Q: B.CONC, J: B.MUD, K: B.GRASS, H: B.GRASS, G: B.ASPH, M: B.ASPH, A: B.ASPHOLD };
export function stratum(c, x, y, z) {
  if (c.bridge && y < c.h - 1 && !(y === c.h - 2 && c.sub)) return y < c.th ? (y === c.th - 1 ? B.SAND : B.ROCK) : c.pier ? B.CONCDK : 0;
  if (y === c.h - 1) return c.top || B.GRASS;
  if (y === c.h - 2 && c.sub) return c.sub;
  if (c.kind === 'road' || urban(c.kind)) return (c.dist === 'docks' || c.dist === 'industrial') ? B.CONCDK : B.DIRT;
  if (c.top === B.SAND) return y > c.h - 4 ? B.SAND : B.ROCK;
  return y > c.h - 4 ? B.DIRT : B.ROCK;
}

// ───────────────────────── overrides: every structure writes here, stored per chunk with small integer keys
// local key = ((lx·16 + lz)·512 + y). 0 = carved air. Props, signs and lamps are bucketed per chunk too.
export const OVC = new Map(), chunkProps = new Map(), chunkSigns = new Map(), chunkLamps = new Map(); export const OVSTAT = { n: 0 };
let lastOK = NaN, lastOM = null;
function ovChunk(cx, cz, make) { const k = cnum(cx, cz); if (k === lastOK && (lastOM || !make)) return lastOM; let m = OVC.get(k); if (!m && make) { m = new Map(); OVC.set(k, m); } lastOK = k; lastOM = m || null; return lastOM; }
export const ovMap = (cx, cz) => ovChunk(cx, cz, false);
// hollows: sealed building interiors. Faces that point into one are never visible, so the mesher skips them.
const HOL = new Map();
export function hollow(x0, y0, z0, x1, y1, z1) { if (x1 <= x0 || y1 <= y0 || z1 <= z0) return; const h = [x0, y0, z0, x1, y1, z1];
  for (let cx = x0 >> 4; cx <= (x1 - 1) >> 4; cx++) for (let cz = z0 >> 4; cz <= (z1 - 1) >> 4; cz++) { const k = cnum(cx, cz); let l = HOL.get(k); if (!l) HOL.set(k, l = []); l.push(h); } }
export function inHollow(x, y, z) { const l = HOL.get(cnum(x >> 4, z >> 4)); if (!l) return false; for (const h of l) if (x >= h[0] && x < h[3] && y >= h[1] && y < h[4] && z >= h[2] && z < h[5]) return true; return false; }
const ck = (x, z) => Math.floor(x / CH) + ',' + Math.floor(z / CH);
export function put(x, y, z, id) { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (y < 0 || y > 500) return; const m = ovChunk(x >> 4, z >> 4, true), k = ((((x & 15) << 4) | (z & 15)) << 9) | y; if (!m.has(k)) OVSTAT.n++; m.set(k, id); }
export function blockAt(x, y, z) { const m = ovChunk(x >> 4, z >> 4, false); if (m) { const o = m.get(((((x & 15) << 4) | (z & 15)) << 9) | y); if (o !== undefined) return o; } const c = column(x, z); if (y < c.h) return stratum(c, x, y, z); return 0; }
// cars wait until their region is built, then keep only those whose footprint is clear of blocks and other cars
const pendingCars = [];
export function flushCars() {
  const taken = new Set();
  for (const c of pendingCars) { const al = c.rot % 2 === 0 ? [0, 1] : [1, 0], L = /:box|ambulance/.test(c.type) ? 2.3 : 2.15, cells = []; let ok = true;
    for (let a = -L; a <= L + 1e-6 && ok; a += .5) for (const b of [-.85, 0, .85]) { const px = Math.floor(c.x + al[0] * a + al[1] * b), pz = Math.floor(c.z + al[1] * a + al[0] * b), y = Math.round(c.y);
      if (blockAt(px, y, pz) || blockAt(px, y + 1, pz) || taken.has(px + ',' + pz)) { ok = false; break; } cells.push(px + ',' + pz); }
    if (ok) { for (const k of cells) taken.add(k); place(c.type, c.x, c.y, c.z, c.rot); } }
  pendingCars.length = 0;
}
export function prop(type, x, y, z, rot = 0) { if (type.startsWith('car:')) { pendingCars.push({ type, x, y, z, rot }); return; } place(type, x, y, z, rot); }
function place(type, x, y, z, rot) { const c = ck(x, z); let l = chunkProps.get(c); if (!l) chunkProps.set(c, l = []); l.push({ type, x, y, z, rot });
  if (type === 'streetlight') { const [ox, oz] = [[0, 1.4], [1.4, 0], [0, -1.4], [-1.4, 0]][rot]; lamp(x + ox, z + oz, y); } }
export function lamp(x, z, y = G, r = 5, col = 0xffd9a0) { const c = ck(x, z); let l = chunkLamps.get(c); if (!l) chunkLamps.set(c, l = []); l.push({ x, z, y, r, col }); }
// sign: a plane on a wall face. (x, y, z) = centre of the plane, n = facing (0 +z · 1 +x · 2 −z · 3 −x)
// signs are bucketed with the wall they hang on, so they never stream in before it
export function sign(x, y, z, n, w, h, text, style = 'box', fg = '#ffffff', bg = '#2f5b9a') { const c = n < 4 ? ck(x - [0, 1, 0, -1][n] * .6, z - [1, 0, -1, 0][n] * .6) : ck(x, z); let l = chunkSigns.get(c); if (!l) chunkSigns.set(c, l = []); l.push({ x, y, z, n, w, h, text, style, fg, bg }); }
export function clearArea(x0, z0, x1, z1, y0 = G - 1, y1 = G + 60) {   // inclusive rect; removes blocks, props, signs, lamps
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const m = ovChunk(x >> 4, z >> 4, false); if (m) for (let y = y0; y < y1; y++) if (m.delete(((((x & 15) << 4) | (z & 15)) << 9) | y)) OVSTAT.n--; }
  const inR = o => o.x >= x0 && o.x < x1 + 1 && o.z >= z0 && o.z < z1 + 1;
  for (const [k, l] of HOL) HOL.set(k, l.filter(h => h[3] <= x0 || h[0] > x1 || h[5] <= z0 || h[2] > z1));
  for (const M of [chunkProps, chunkSigns, chunkLamps]) for (const [k, l] of M) { const f = l.filter(o => !inR(o)); if (f.length !== l.length) M.set(k, f); }
}

// ───────────────────────── lots: claimable land (suburbs, big lots, trailer pads) + premium downtown parcels
// a lot: {id, x0, z0, sx, sz (world rect), face ('z' | '-z' | 'x' | '-x' = the street side), W (frontage), D (depth), kind, addr}
export const LOTS = [], LOT_BY_ID = new Map();
// SPREAD · FROZEN IDS AND ADDRESSES (permanent, whatever the spread): a lot's id and its house number are today's, computed from the
// lot's corner in today's world (frozen: its block's shift taken off). The sim, the export, the saves and every hero key on them; never
// build a lot id from a world coordinate (use l.id, or LOT_BY_ID.get('<today's x0>,<today's z0>')).
export const frozen = (x, z) => SPREAD ? unshift(x + .5, z + .5).map(v => v - .5) : [x, z];   // (+ .5: the corner's own block, not the one before it)
function addLot(l) { const [ox, oz] = frozen(l.x0, l.z0); l.id = `${ox},${oz}`; LOTS.push(l); LOT_BY_ID.set(l.id, l); return l; }
function addr(l, streetLine, axis) { const [ox, oz] = frozen(l.x0, l.z0), along = axis === 'z' ? ox + l.sx / 2 : oz + l.sz / 2, even = (l.face === 'z' || l.face === 'x') ? 0 : 1;
  return `${100 + Math.round((along + 400) / 8) * 2 + even} ${axis === 'z' ? ZNAME[streetLine] || 'Cty Rd' : XNAME[streetLine] || 'Cty Rd'}`; }
for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) { const k = kindAt(i, j); if (k !== 's' && k !== 'r') continue;
  const R = interior(i, j), W = R.x1 - R.x0, Dp = R.z1 - R.z0;
  if (k === 's') for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const sx = W >> 1, sz = Dp >> 1, l = addLot({ x0: R.x0 + a * sx, z0: R.z0 + b * sz, sx, sz: b ? Dp - sz : sz, face: b ? 'z' : '-z', kind: 'house', dist: 'suburbs', i, j });
    l.addr = addr(l, b ? j + 1 : j, 'z'); }
  else for (const b of [0, 1]) { const sz = Dp >> 1, l = addLot({ x0: R.x0, z0: R.z0 + b * sz, sx: W, sz: b ? Dp - sz : sz, face: b ? 'z' : '-z', kind: 'estate', dist: 'estates', i, j }); l.addr = addr(l, b ? j + 1 : j, 'z'); }
}
// trailer pads: lanes run east–west inside the park; pads face the lane
export const TRAILER = (() => { const c = COMPOUNDS.find(q => q.k === 'T'), R = compoundInterior(c), lanes = [], pads = [];
  for (let z = R.z0 + 15; z < R.z1 - 8; z += 26) { lanes.push(z); for (let x = R.x0 + 4; x + 8 <= R.x1 - 3; x += 9) { pads.push({ x0: x, z0: z - 13, sx: 8, sz: 12, face: 'z' }); if (z + 3 + 12 <= R.z1 - 2) pads.push({ x0: x, z0: z + 3, sx: 8, sz: 12, face: '-z' }); } }
  for (const p of pads) { const l = addLot({ ...p, kind: 'trailer', dist: 'trailer' }); l.addr = `Pad ${LOTS.filter(q => q.kind === 'trailer').length} Sunny Acres`; }
  return { R, lanes }; })();
export function lotFrame(l) { const W = (l.face === 'z' || l.face === '-z') ? l.sx : l.sz, D = (l.face === 'z' || l.face === '-z') ? l.sz : l.sx; return frame(l.x0, l.z0, W, D, l.face); }
// frame: local (u along the front, v from back to front) → world. The front row is v = D − 1.
export function frame(ox, oz, W, D, face) {
  const f = face === 'z' ? (u, v) => [ox + u, oz + v] : face === '-z' ? (u, v) => [ox + W - 1 - u, oz + D - 1 - v] : face === 'x' ? (u, v) => [ox + v, oz + W - 1 - u] : (u, v) => [ox + D - 1 - v, oz + u];
  const rot = { z: 0, x: 1, '-z': 2, '-x': 3 }[face];
  return { at: f, W, D, rot, face, alongX: face === 'z' || face === '-z' };
}
// address lookup for any point (HUD)
export function addressAt(x, z) {
  const i = Math.floor(x / P), j = Math.floor(z / P), k = kindAt(i, j), Lx = Math.round(x / P), Lz = Math.round(z / P), dx = Math.abs(x - Lx * P), dz = Math.abs(z - Lz * P);
  if (dx < rwX(Lx) && (segX(Lx, j))) return XNAME[Lx] || 'County Road';
  if (dz < rwZ(Lz) && segZ(Lz, i)) return ZNAME[Lz] || 'County Road';
  const l = LOTS.find(q => x >= q.x0 && x < q.x0 + q.sx && z >= q.z0 && z < q.z0 + q.sz); if (l) return l.addr;
  if (!urban(k)) return ''; const n = 100 + Math.round((unmap(x, z)[0] + 400) / 8) * 2; return `${n} ${ZNAME[Lz] || XNAME[Lx] || ''}`;   // (frozen: today's number)
}
