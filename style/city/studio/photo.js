// TRAIT STUDIO · the photo booth: the fit check's studio (seamless sweep, direct flash, NeutralToneMapping) on its own offscreen
// renderer, for the catalogue thumbnails and the PFP. Framings are the fit check's (bust = its pfp, full = its full body) and the
// trait board's per-slot close-ups (style/city/traits/index.html CAM / VIEW). The static chars.js build(), as the fit check draws it.
// Thumbnails are cached: in memory, and in IndexedDB under a hash of the trait sources (chars.js + the passes), so an edit to any
// trait's drawing invalidates every cached thumbnail by itself.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { build, dispose, look } from '../../../world/chars.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(1024, 1024, false);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.autoClear = false;
const scene = new THREE.Scene(); const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .45;
const sweepMat = new THREE.MeshStandardMaterial({ color: 0xe4e4e4, roughness: .95 });
{ const prof = []; for (let z = 8; z > -0.8; z -= .4) prof.push([z, 0]); for (let a = 0; a <= 90; a += 6) { const r = .9, t = THREE.MathUtils.degToRad(a); prof.push([-0.8 - r * Math.sin(t), r - r * Math.cos(t)]); } for (let y = 1.2; y < 9; y += .6) prof.push([-1.7, y]);
  const pos = [], idx = []; prof.forEach(([z, y], i) => { pos.push(-12, y, z, 12, y, z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const sweep = new THREE.Mesh(g, sweepMat); sweep.receiveShadow = true; scene.add(sweep); }
scene.add(new THREE.HemisphereLight(0xffffff, 0x999999, .7));
const flash = new THREE.DirectionalLight(0xffffff, 2.7); flash.castShadow = true; flash.shadow.mapSize.set(2048, 2048); flash.shadow.bias = -0.0005; flash.shadow.normalBias = .01;
Object.assign(flash.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: .5, far: 20 }); scene.add(flash, flash.target); flash.target.position.set(0, 1, 0);
const cam = (pos, at, fov = 24, aspect = 1) => { const c = new THREE.PerspectiveCamera(fov, aspect, .1, 50); c.position.set(...pos); c.lookAt(...at); return c; };
export const CAM = {
  bust: cam([.4, 1.5, 3.2], [0, 1.4, 0]), full: cam([.55, 1.32, 5.6], [0, 1.03, 0], 26, 4 / 5), face: cam([.3, 1.44, 2.95], [0, 1.37, 0]),   // the fit check's pfp, full body, face tiles
  head: cam([.55, 1.6, 3.95], [0, 1.45, 0]), mouth: cam([.3, 1.2, 2.37], [0, 1.12, 0]), earL: cam([-2.1, 1.3, 1.55], [0, 1.22, 0]),                 // the trait board's close-ups
  chest: cam([.3, .98, 2.0], [0, .76, 0]), upper: cam([.5, .98, 3.2], [0, .72, 0]), hands: cam([.35, .72, 2.6], [0, .56, 0]), held: cam([.7, .64, 3.1], [.15, .46, 0]),
  legs: cam([.75, .52, 2.5], [0, .3, 0]), feet: cam([1.25, .45, 1.8], [0, .2, 0], 20) };
const VIEW = { skin: ['bust', .42], eyes: ['face', .22], mark: ['face', .22], mouth: ['mouth', .22], ears: ['earL', 0], hat: ['head', .42], hair: ['head', .55], eyewear: ['head', .3], neck: ['chest', .3],
  top: ['upper', .42], acc: ['hands', 0], held: ['held', -.45], bottom: ['legs', .42], shoes: ['feet', .5] };
const VIEW_ID = { 'acc/bandana': ['legs', Math.PI - .55], 'acc/crossbody': ['upper', .42], 'acc/sling': ['upper', .42], 'acc/monitor': ['feet', .5], 'mouth/septum': ['face', .22] };

// the thumbnail model: one neutral base (the trait board's first), wearing the one trait
export const BASE = look({ skin: 'deep', hair: { id: 'buzz', c: 0x2a1c14 }, eyes: 'bored', mouth: 'flat', top: { id: 'tee', c: 0xf2f2f2, print: 'star' }, bottom: { id: 'baggy', c: 0x2b3f66 }, shoes: { id: 'dad' } });
export function wearOne(base, e, cw) { const L = structuredClone(base);
  if (e.slot === 'skin' || e.slot === 'eyes' || e.slot === 'mouth' || e.slot === 'mark') L[e.slot] = e.id; else L[e.slot] = e.cws ? { id: e.id, cw: cw | 0 } : { id: e.id };
  if (e.slot === 'hair') L.hat = { id: 'none' }; if (e.slot === 'hat' && L.hair.id === 'long') L.hair = { id: 'buzz', c: 0x151214 };
  return L; }

function shoot(bg, c, w, h, ctx) {
  sweepMat.color.set(bg); flash.position.copy(c.position).add(new THREE.Vector3(-1.5, 1.3, .2));
  renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h); renderer.setScissorTest(true); renderer.clear(); renderer.render(scene, c);
  ctx.drawImage(renderer.domElement, 0, 1024 - h, w, h, 0, 0, ctx.canvas.width, ctx.canvas.height); }
export function snap(L, bg, camName, ry, w, h, ctx) { const o = build(L); o.rotation.y = ry; scene.add(o); try { shoot(bg, CAM[camName], w, h, ctx); } finally { scene.remove(o); dispose(o); } }
// the PFP: exactly the fit check's avatar (bust camera, the look's background, the body turned .42)
export function pfp(L, ctx, bg) { snap(L, bg || L.bg || '#ff4fa3', 'bust', .42, 256, 256, ctx); }

// ── thumbnails: lazy, cached
const TW = 224, tcv = document.createElement('canvas'); tcv.width = tcv.height = TW; const tctx = tcv.getContext('2d');
const mem = new Map(); let VER = 'v0', db = null;
export async function initCache(sources, o = {}) {
  let h = 0x811c9dc5; const txt = (await Promise.all(sources.map(u => fetch(u).then(r => r.text()).catch(() => '')))).join('\u0001') + '|thumb-v3';
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 0x01000193); } VER = (h >>> 0).toString(16);
  // (never wait on IndexedDB for long: a private window can stall it, and headless shots' virtual time doesn't see it at all)
  if (o.idb !== false) try { db = await Promise.race([new Promise((res, rej) => { const r = indexedDB.open('trait-studio', 1); r.onupgradeneeded = () => r.result.createObjectStore('thumbs'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
    new Promise(res => setTimeout(() => res(null), 1500))]); } catch { db = null; }
  if (db) try { const st = db.transaction('thumbs', 'readwrite').objectStore('thumbs'), keys = await new Promise(r => { const q = st.getAllKeys(); q.onsuccess = () => r(q.result); q.onerror = () => r([]); });
    for (const k of keys) if (!String(k).startsWith(VER + '|')) st.delete(k); } catch {}   // (drop thumbnails of older trait sources)
  return VER; }
const idbGet = k => db ? new Promise(r => { try { const q = db.transaction('thumbs').objectStore('thumbs').get(k); q.onsuccess = () => r(q.result || null); q.onerror = () => r(null); } catch { r(null); } }) : Promise.resolve(null);
const idbPut = (k, v) => { if (db) try { db.transaction('thumbs', 'readwrite').objectStore('thumbs').put(v, k); } catch {} };
export const thumbStats = { rendered: 0, fromDisk: 0, ms: 0 };
// url for (entry, cw), or a promise of it; render() is called by the page's frame loop with a time budget
const want = new Map();   // key → { e, cw, cbs: [] }
export function thumb(e, cw, cb) { const k = VER + '|' + e.key + '#' + (cw | 0); const u = mem.get(k); if (u) return cb(u);
  let w = want.get(k); if (w) { w.cbs.push(cb); w.t = performance.now(); return; } want.set(k, w = { e, cw: cw | 0, cbs: [cb], t: performance.now(), disk: false });
  idbGet(k).then(b => { if (!b || !want.has(k)) { w.disk = true; return; } const url = URL.createObjectURL(b); mem.set(k, url); thumbStats.fromDisk++; want.delete(k); for (const f of w.cbs) f(url); }); }
export function cancelThumb(e, cw) { const k = VER + '|' + e.key + '#' + (cw | 0), w = want.get(k); if (w && !w.busy) want.delete(k); }
export function renderThumbs(budgetMs = 8) { const t0 = performance.now(); let n = 0;
  while (performance.now() - t0 < budgetMs) {
    let best = null, bk = null; for (const [k, w] of want) if (w.disk && !w.busy && (!best || w.t > best.t)) { best = w; bk = k; }   // newest request first (what's on screen now)
    if (!best) break; best.busy = true; const { e, cw } = best, [cn, ry] = VIEW_ID[e.key] || VIEW[e.slot], t1 = performance.now();
    snap(wearOne(BASE, e, cw), '#e4e4e4', cn, ry, TW, TW, tctx); thumbStats.ms += performance.now() - t1; thumbStats.rendered++; n++;
    const url = tcv.toDataURL('image/webp', .9); mem.set(bk, url); want.delete(bk); for (const f of best.cbs) f(url);
    fetch(url).then(r => r.blob()).then(b => idbPut(bk, b)).catch(() => {}); }
  return n; }
export const pending = () => want.size;
export { renderer as photoRenderer };
