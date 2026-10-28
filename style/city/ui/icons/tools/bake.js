// HUMAN LAYER · ITEM ICONS · the bake page (driven headless by bake-icons.mjs; open it in a browser to look at the set).
// Every model (../models.js) and every worn trait (./traits.js) is meshed with the city's corner AO, lit with the city's light (STYLE.md §3:
// sun #FFF2DC 3.0, hemisphere #D6ECFF / #E0CFB0 1.05, a sky-gradient environment, NeutralToneMapping), rendered at a 3/4 angle on
// transparent, cropped to its pixels, fitted to its cell, and given an ink outline. → window.__icons = { json, png1, png2, done }
//   ?only=key,key  bake a few (the page shows them; nothing is written)   ?big=1  show the 2× cells
import * as THREE from 'three';
import { MODELS } from '../models.js';
import { TRAITS, traitCells, traitName } from './traits.js';

const Q = new URLSearchParams(location.search);
export const CELL = 64, PAD = 4, OUT1 = 2, HALO1 = 1, COLS = 12, SS = 512;   // 1× cell, padding inside a cell, the 1× outline (px), atlas columns, the supersampled render
const INK = '#17171b', AOV = [0.55, 0.72, 0.87, 1];
const AZ = 34 * Math.PI / 180, EL = 30 * Math.PI / 180;            // the 3/4 view: 34° round from the front (+z) toward +x, 30° down

const TRAIT_SRC = { watch: 'new (the cast draws it as a 4-voxel band)', crossbody: 'new (the cast draws it as a strap across the chest)', duffel: 'new, after world/cast/fresh/held.js cash_duffel', grill: 'new (a dental grill)', gold: 'new (a dental grill)', iced: 'new (a dental grill)' };
// ── the entries, in atlas order
const GROUPS = ['cash', 'ingredient', 'part', 'product', 'crafted', 'tool', 'gear', 'security', 'mark', 'trait', 'fallback'];
const entries = [];
for (const [key, m] of Object.entries(MODELS)) if (m.group !== 'trait') entries.push({ key, name: m.name, group: m.group, what: m.what, src: m.src, cells: () => m.build().cells });
for (const [id, [slot, tier]] of Object.entries(TRAITS)) {
  const m = MODELS[id]; if (m && m.group === 'trait') { entries.push({ key: id, name: m.name, group: 'trait', slot, tier, what: m.what, src: TRAIT_SRC[id] || 'new', cells: () => m.build().cells }); continue; }
  entries.push({ key: id, name: traitName(id), group: 'trait', slot, tier, what: `${slot} · ${tier}`, view: slot === 'hat' || slot === 'eyes' ? [26, 12] : null, src: 'reused: cut from the cast (world/chars.js compose)', cells: () => traitCells(id) || [] });
}
entries.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
const only = Q.get('only') ? new Set(Q.get('only').split(',')) : null;
const list = only ? entries.filter(e => only.has(e.key)) : entries;

// ── the mesher: one geometry per material layer, exposed faces only, chars.js corner AO
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] }];
function meshCells(cells) {
  const K = (x, y, z) => `${x},${y},${z}`, occ = new Set(cells.map(c => K(c[0], c[1], c[2]))), has = (x, y, z) => occ.has(K(x, y, z));
  const per = [0, 1, 2, 3].map(() => ({ P: [], N: [], C: [], I: [], v: 0 })), col = new THREE.Color();
  for (const [x, y, z, hex, l] of cells) { const L = per[l] || per[0]; col.setHex(hex).convertSRGBToLinear();
    for (const d of DIRS) { const [nx, ny, nz] = d.n; if (has(x + nx, y + ny, z + nz)) continue; const ax = x + nx, ay = y + ny, az = z + nz, a4 = [];
      for (const c of d.c) { const t = [nx ? 0 : (c[0] ? 1 : -1), ny ? 0 : (c[1] ? 1 : -1), nz ? 0 : (c[2] ? 1 : -1)], e = [];
        if (t[0]) e.push([t[0], 0, 0]); if (t[1]) e.push([0, t[1], 0]); if (t[2]) e.push([0, 0, t[2]]);
        const s1 = has(ax + e[0][0], ay + e[0][1], az + e[0][2]), s2 = has(ax + e[1][0], ay + e[1][1], az + e[1][2]), cr = has(ax + t[0], ay + t[1], az + t[2]);
        a4.push(l === 3 ? 3 : (s1 && s2 ? 0 : 3 - (s1 + s2 + cr))); }
      for (let q = 0; q < 4; q++) { const c = d.c[q]; L.P.push(x + c[0], y + c[1], z + c[2]); L.N.push(nx, ny, nz); const a = AOV[a4[q]]; L.C.push(col.r * a, col.g * a, col.b * a); }
      const v = L.v; if (a4[0] + a4[2] < a4[1] + a4[3]) L.I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else L.I.push(v, v + 1, v + 2, v, v + 2, v + 3); L.v += 4; } }
  return per.map(L => { if (!L.v) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(L.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(L.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(L.C, 3)); g.setIndex(L.I); return g; });
}

// ── the stage: the city's light (STYLE.md §3), no fog, no shadows (the corner AO carries the form)
const R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
R.setPixelRatio(1); R.setSize(SS, SS, false); R.setClearColor(0x000000, 0); R.toneMapping = THREE.NeutralToneMapping; R.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
{ const sky = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { top: { value: new THREE.Color(0x2f9bff) }, hor: { value: new THREE.Color(0x9fdcff) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top, hor; varying vec3 vD; void main(){ float h = vD.y; gl_FragColor = vec4(h > 0. ? mix(hor, top, pow(clamp(h,0.,1.), .5)) : hor, 1.);\n#include <colorspace_fragment>\n}' });
  const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), sky)); const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(es, .02).texture; scene.environmentIntensity = .55; }
const cam = new THREE.PerspectiveCamera(18, 1, .1, 4000);
const viewOf = (az = AZ, el = EL) => new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
const sun = new THREE.DirectionalLight(0xfff2dc, 3.0); scene.add(sun, sun.target);   // the key: high, from the viewer's left
const sunDir = new THREE.Vector3(-0.55, 0.85, 0.62).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), AZ * .5);
scene.add(new THREE.HemisphereLight(0xd6ecff, 0xe0cfb0, 1.05));
const MATS = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .1 }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .34, metalness: .5 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];

// render one entry → a SS×SS canvas (transparent), cropped later
function renderEntry(cells, v = null) {
  const view = v ? viewOf(v[0] * Math.PI / 180, v[1] * Math.PI / 180) : viewOf();
  const geos = meshCells(cells), grp = new THREE.Group(); geos.forEach((g, l) => { if (g) grp.add(new THREE.Mesh(g, MATS[l])); }); scene.add(grp);
  const box = new THREE.Box3().setFromObject(grp), c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
  cam.position.copy(c).addScaledVector(view, r / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.02); cam.lookAt(c); cam.updateProjectionMatrix();
  sun.position.copy(c).addScaledVector(sunDir, r * 4); sun.target.position.copy(c);
  R.render(scene, cam); scene.remove(grp); geos.forEach(g => g?.dispose());
  const out = document.createElement('canvas'); out.width = out.height = SS; out.getContext('2d').drawImage(R.domElement, 0, 0); return out;
}
// crop to the pixels, fit into a cell of `size` (PAD + outline inside), outline in ink
function cellOf(src, size, scale) {
  const g = src.getContext('2d'), d = g.getImageData(0, 0, SS, SS).data; let x0 = SS, y0 = SS, x1 = -1, y1 = -1;
  for (let y = 0; y < SS; y++) for (let x = 0; x < SS; x++) if (d[(y * SS + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const cv = document.createElement('canvas'); cv.width = cv.height = size; if (x1 < 0) return cv;
  const ol = OUT1 * scale, room = size - 2 * (PAD * scale) - 2 * HALO1 * scale, w = x1 - x0 + 1, h = y1 - y0 + 1, k = Math.min(room / w, room / h), dw = w * k, dh = h * k;
  // downscale in halving steps (clean minification), then place centred (bottom-weighted a touch: things sit)
  let s = document.createElement('canvas'); s.width = w; s.height = h; s.getContext('2d').drawImage(src, x0, y0, w, h, 0, 0, w, h);
  while (s.width / 2 > dw) { const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(s.width / 2)); t.height = Math.max(1, Math.round(s.height / 2)); const tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(s, 0, 0, t.width, t.height); s = t; }
  const body = document.createElement('canvas'); body.width = body.height = size; const bg = body.getContext('2d'); bg.imageSmoothingQuality = 'high';
  const ox = (size - dw) / 2, oy = (size - dh) / 2 + Math.min(PAD * scale * .4, (room - dh) / 2); bg.drawImage(s, ox, oy, dw, dh);
  // the outline: the body's alpha dilated by a disc of radius ol, filled ink, under the body
  const bd = bg.getImageData(0, 0, size, size), A = new Float32Array(size * size); for (let i = 0; i < A.length; i++) A[i] = bd.data[i * 4 + 3] / 255;
  const D = new Float32Array(size * size), offs = []; for (let dy = -Math.ceil(ol); dy <= Math.ceil(ol); dy++) for (let dx = -Math.ceil(ol); dx <= Math.ceil(ol); dx++) { const dd = Math.hypot(dx, dy); if (dd <= ol + .5) offs.push([dx, dy, Math.min(1, ol + .5 - dd)]); }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { let m = 0; for (const [dx, dy, wgt] of offs) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue; const a = A[yy * size + xx] * wgt; if (a > m) { m = a; if (m >= 1) break; } } D[y * size + x] = m; }
  const ink = bg.createImageData(size, size), [ir, ig, ib] = [0x17, 0x17, 0x1b]; for (let i = 0; i < D.length; i++) { ink.data[i * 4] = ir; ink.data[i * 4 + 1] = ig; ink.data[i * 4 + 2] = ib; ink.data[i * 4 + 3] = Math.round(Math.min(1, D[i] * 1.15) * 255); }
  // the halo: the outline dilated once more, cream at 55% (on a light panel it all but vanishes; on a dark one it keeps the edge)
  const hr = HALO1 * scale, H = new Float32Array(size * size), hoffs = []; for (let dy = -Math.ceil(hr); dy <= Math.ceil(hr); dy++) for (let dx = -Math.ceil(hr); dx <= Math.ceil(hr); dx++) { const dd = Math.hypot(dx, dy); if (dd <= hr + .5) hoffs.push([dx, dy, Math.min(1, hr + .5 - dd)]); }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { let m = 0; for (const [dx, dy, wgt] of hoffs) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue; const a = D[yy * size + xx] * wgt; if (a > m) m = a; } H[y * size + x] = m; }
  const halo = bg.createImageData(size, size); for (let i = 0; i < H.length; i++) { halo.data[i * 4] = 0xff; halo.data[i * 4 + 1] = 0xf0; halo.data[i * 4 + 2] = 0xd0; halo.data[i * 4 + 3] = Math.round(Math.min(1, H[i]) * .55 * 255); }
  const og = cv.getContext('2d'); const ic = document.createElement('canvas'); ic.width = ic.height = size; ic.getContext('2d').putImageData(ink, 0, 0);
  const hc = document.createElement('canvas'); hc.width = hc.height = size; hc.getContext('2d').putImageData(halo, 0, 0);
  og.drawImage(hc, 0, 0); og.drawImage(ic, 0, 0); og.drawImage(body, 0, 0); return cv;
}

// ── bake
const rows = Math.ceil(list.length / COLS), A1 = document.createElement('canvas'), A2 = document.createElement('canvas');
A1.width = COLS * CELL; A1.height = rows * CELL; A2.width = COLS * CELL * 2; A2.height = rows * CELL * 2;
const g1 = A1.getContext('2d'), g2 = A2.getContext('2d'), icons = {}, missing = [], out = document.getElementById('out');
for (let i = 0; i < list.length; i++) {
  const e = list[i]; let cells = []; try { cells = e.cells(); } catch (err) { console.warn('[icons]', e.key, err); }
  if (!cells.length) { missing.push(e.key); continue; }
  const big = renderEntry(cells, e.view), c1 = cellOf(big, CELL, 1), c2 = cellOf(big, CELL * 2, 2), x = (i % COLS) * CELL, y = Math.floor(i / COLS) * CELL;
  g1.drawImage(c1, x, y); g2.drawImage(c2, x * 2, y * 2);
  icons[e.key] = { i, x, y, name: e.name, group: e.group, ...(e.slot ? { slot: e.slot, tier: e.tier } : {}), what: e.what, src: e.src, voxels: cells.length };
  if (only || Q.has('show')) { const im = new Image(); im.src = (Q.has('big') ? c2 : c1).toDataURL(); im.title = e.key; out.append(im); }
  if (i % 6 === 5) await new Promise(r => requestAnimationFrame(r));
}
const json = { version: 1, about: 'AI City item icons: ui/icons/tools/bake-icons.mjs renders ui/icons/models.js + tools/traits.js; see CATALOG.md', cell: CELL, cols: COLS, rows,
  scales: { 1: 'icons.png', 2: 'icons@2x.png' }, view: { azimuth: 34, elevation: 30 }, outline: { px1x: OUT1, colour: INK, halo1x: HALO1, haloColour: '#fff0d0 at 55%' }, count: Object.keys(icons).length, missing, groups: GROUPS, icons };
window.__icons = { json, png1: A1.toDataURL('image/png'), png2: A2.toDataURL('image/png'), done: true };
document.title = 'icons-ready';
