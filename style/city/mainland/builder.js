// AI City · THE MAINLAND · HOUSE BUILDER v1 (2026-10-06). Homes matter here: Mainland lots don't reset with the season. The city's
// home builder (interiors/city/builder.js) is the reference for the feel; this is its outdoor twin, on the lot's own 0.5 m ground grid.
//   PLOT MODE   click a plot: its card (address, size, prime, status, owner). The owner gets BUILD (dev switch ?owner=<plot id>[,<id>…]
//               or ?owner=all, as the city's ?owner=<lot>; later the sim or the mint decides); everyone gets VISIT.
//   HOUSE KIT   (BUILD · House) the eight styles (yard.js KIT), each with its options: wall (sherbet), roof, accent, garage (door, glass,
//               carport, none), porch, dormers, hoop, pool, the showpiece on the roof, the show car. A style or option that breaks the
//               setbacks on this lot (front 2 m, sides 1 m, back 1 m, the lot's real corners, pie lots included) is greyed out with
//               why; the live preview is the real house, built in a worker. Drag the house (or ← →) along the frontage within its band.
//   YARD        (BUILD · Yard) fences and hedges on the six edge runs, paths and the driveway painted on the grid, and the yard pieces
//               from the tray. Click a piece to pick it up, click to put it down; valid spots light up and the held piece only ever goes
//               to one (nothing outside the lot, on the house, the paths, the driveway (a car may park on it) or the door's patch);
//               R turns it, C its colour, Delete back to the tray, Ctrl/⌘+Z undo, ⇧ redo, Esc drops it / leaves.
//   SAVE        every change saves the lot per plot (saved.js: localStorage + REMOTE hook), Export / Import JSON; an unedited plot stores
//               nothing and keeps its generated look. Done rebuilds the lot for the page from the saved spec (the same build a reload does).
//   GO INSIDE   enterHouse(plotId, houseSpec) below: THE HOOK for the Mainland interiors (another agent's API in interiors/, wired later).
//   VISIT       anyone else's plot: read-only, the address, the owner (a placeholder until the sim says) and the flex readout.
import * as THREE from 'three';
import { Bank, meshVol, unpackInto } from '../vox.js';
import { geoOf } from '../glue.js';
import { hash } from '../style.js';
import { LOOKS } from '../cast.js';
import * as Y from './yard.js';
import { LV, drawPaths, drawEdges } from './houses.js';
import * as SV from './saved.js';

// ── HOOK · GO INSIDE. The Mainland interiors (being built in interiors/ by another agent) set INTERIOR.open = (plotId, houseSpec) → bool
// (true when it opened). houseSpec: the lot's house ({ style, wall, roof, accent, garage, porch, dormers, hoop, pool, show, car, hx, hz })
// plus { plot, address, rect, poly }. Until then the button says "interior coming".
export const INTERIOR = { open: null };
export function enterHouse(plotId, houseSpec) {
  try { if (INTERIOR.open) return !!INTERIOR.open(plotId, houseSpec); } catch (e) { console.warn('enterHouse failed', e); }
  UI?.toast('interior coming · the inside of this house is being built'); return false;
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
const clone = o => JSON.parse(JSON.stringify(o));
const snap = v => Math.round(v / Y.CELL) * Y.CELL, r2 = v => +v.toFixed(2);
const cap = s => s.replace(/(^|\s)\S/g, c => c.toUpperCase());
let ML = null, UI = null;

// ── the look (the city home builder's: ink panels, yellow and pink hard shadows, Arial Black)
function css() { const s = document.createElement('style'); s.textContent = `
#mb-card, #mb-bar, #mb-tray { position: fixed; z-index: 7; background: #17171b; color: #f7f7f2; font: 600 12px/1.3 "Arial Black", Impact, sans-serif; }
#mb-card { left: 14px; bottom: 14px; width: 300px; padding: 12px 14px 12px; box-shadow: 5px 5px 0 #ffc21a; box-sizing: border-box; max-width: calc(100vw - 32px); }
#mb-card[hidden], #mb-bar[hidden], #mb-tray[hidden], #mb-toast[hidden], #mb-tip[hidden] { display: none; }
#mb-card .ad { color: #ffc21a; font: 800 17px/1.05 "Arial Black", Impact, sans-serif; text-transform: uppercase; }
#mb-card .id { color: #9fdcff; font-size: 9px; letter-spacing: .08em; margin: 3px 0 9px; text-transform: uppercase; }
#mb-card dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; margin: 0 0 10px; font: 700 11px/1.3 Arial, sans-serif; }
#mb-card dt { color: #9a9aa6; text-transform: uppercase; font: 800 9px/1.6 "Arial Black", sans-serif; letter-spacing: .04em; }
#mb-card dd { margin: 0; } #mb-card dd b { color: #ffc21a; font-weight: 800; }
#mb-card .flex { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 10px; } #mb-card .flex b { background: #f7f7f2; color: #17171b; padding: 3px 6px 2px; font: 800 9px/1 "Arial Black", sans-serif; text-transform: uppercase; }
#mb-card .flex b.g { background: #ffc21a; } #mb-card .note { color: #9a9aa6; font: 700 10px/1.3 Arial, sans-serif; margin: -4px 0 10px; }
#mb-card .row { display: flex; gap: 6px; flex-wrap: wrap; } #mb-card .x { position: absolute; right: 8px; top: 6px; background: none; border: 0; color: #9a9aa6; font: 800 16px/1 Arial; cursor: pointer; }
.mb-b { font: 800 11px/1 "Arial Black", sans-serif; text-transform: uppercase; border: 0; background: #f7f7f2; color: #17171b; padding: 8px 9px 7px; min-height: 32px; cursor: pointer; box-shadow: 2px 2px 0 #ff4fa3; touch-action: manipulation; }
.mb-b:hover { background: #ffc21a; } .mb-b:focus-visible { outline: 3px solid #ff4fa3; outline-offset: 2px; } .mb-b:disabled { opacity: .3; cursor: default; background: #f7f7f2; }
.mb-b.go { background: #6cff4a; } .mb-b.big { font-size: 13px; padding: 10px 14px 9px; } .mb-b.on { background: #ffc21a; box-shadow: 2px 2px 0 #f7f7f2; } .mb-b kbd { font: inherit; color: #7a5a00; margin-left: 4px; }
#mb-bar { top: 12px; left: 50%; transform: translateX(-50%); display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 10px; box-shadow: 4px 4px 0 #ffc21a; max-width: calc(100vw - 32px); box-sizing: border-box; }
#mb-bar .t { color: #ffc21a; font: 800 13px/1.1 "Arial Black", Impact, sans-serif; text-transform: uppercase; margin-right: 4px; white-space: nowrap; } #mb-bar .t small { display: block; color: #9fdcff; font-size: 9px; letter-spacing: .05em; }
#mb-bar .sep { width: 1px; align-self: stretch; background: #34343c; margin: 0 2px; } #mb-bar .st { color: #6cff4a; font-size: 10px; text-transform: uppercase; min-width: 60px; }
#mb-tray { left: 12px; right: 12px; bottom: 12px; padding: 8px 10px 10px; box-shadow: 5px 5px 0 #ff4fa3; }
#mb-tray .tabs { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 7px; }
#mb-tray .tab { font: 800 10px/1 "Arial Black", sans-serif; text-transform: uppercase; border: 0; background: #34343c; color: #c9c9d1; padding: 7px 8px 6px; cursor: pointer; }
#mb-tray .tab.on { background: #ffc21a; color: #17171b; } #mb-tray .hint { margin-left: auto; color: #9a9aa6; font-size: 10px; text-transform: uppercase; }
#mb-tray .cards { display: flex; gap: 8px; overflow-x: auto; padding: 2px 4px 6px 2px; scrollbar-width: thin; }
.mb-c { flex: none; width: 112px; background: #f7f7f2; color: #17171b; border: 0; padding: 5px 5px 6px; text-align: left; cursor: pointer; box-shadow: 2px 2px 0 #34343c; position: relative; font: inherit; }
.mb-c:hover { box-shadow: 2px 2px 0 #ff4fa3; } .mb-c.sel { outline: 3px solid #ffc21a; outline-offset: 1px; } .mb-c.na { opacity: .35; cursor: not-allowed; }
.mb-c canvas, .mb-c svg { display: block; width: 102px; height: 64px; background: #dff1ff; } .mb-c .sw { display: block; width: 102px; height: 64px; }
.mb-c .n { display: block; font: 800 10px/1.15 "Arial Black", sans-serif; text-transform: uppercase; margin: 4px 0 2px; } .mb-c .k { display: block; font: 700 8.5px/1.2 Arial, sans-serif; color: #55555f; min-height: 20px; }
.mb-c .why { position: absolute; left: 5px; right: 5px; top: 30px; background: #17171b; color: #ffc21a; font: 800 8px/1.15 "Arial Black", sans-serif; text-transform: uppercase; padding: 3px 4px; text-align: center; }
#mb-tray .opts { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; align-items: center; }
#mb-tray .og { display: flex; align-items: center; gap: 4px; } #mb-tray .og > span { color: #9a9aa6; font: 800 9px/1 "Arial Black", sans-serif; text-transform: uppercase; margin-right: 2px; }
.mb-sw { width: 22px; height: 22px; border: 2px solid #17171b; box-shadow: 0 0 0 1px #55555f; cursor: pointer; padding: 0; } .mb-sw.on { box-shadow: 0 0 0 3px #ffc21a; } .mb-sw:disabled { opacity: .25; cursor: not-allowed; }
.mb-ch { font: 800 9.5px/1 "Arial Black", sans-serif; text-transform: uppercase; border: 0; background: #34343c; color: #e9e9ee; padding: 6px 7px 5px; cursor: pointer; } .mb-ch.on { background: #ffc21a; color: #17171b; } .mb-ch:disabled { opacity: .3; cursor: not-allowed; }
#mb-toast { position: fixed; z-index: 8; left: 50%; bottom: 236px; transform: translateX(-50%); background: #ffc21a; color: #17171b; font: 800 12px/1.2 "Arial Black", Impact, sans-serif; text-transform: uppercase; padding: 8px 12px 7px; box-shadow: 3px 3px 0 #17171b; pointer-events: none; max-width: calc(100vw - 40px); text-align: center; transition: opacity .25s; }
#mb-tip { position: fixed; z-index: 8; pointer-events: none; background: #17171b; color: #f7f7f2; font: 700 10px/1.25 Arial, sans-serif; padding: 5px 7px; box-shadow: 2px 2px 0 #ffc21a; transform: translate(14px, 14px); max-width: 240px; }
#mb-tip b { font: 800 11px/1.2 "Arial Black", sans-serif; text-transform: uppercase; color: #ffc21a; display: block; }
#mb-hint { position: fixed; z-index: 6; right: 14px; top: 14px; background: #17171b; color: #ffc21a; font: 800 10px/1.2 "Arial Black", sans-serif; text-transform: uppercase; padding: 7px 9px 6px; box-shadow: 3px 3px 0 #ff4fa3; pointer-events: none; }
body.mb-building .ui, body.mb-building #mb-hint { visibility: hidden; } body.shot #mb-hint { display: none; }
@media (max-width: 640px) { #mb-card { width: auto; right: 14px; } #mb-bar { top: 8px; gap: 4px; padding: 6px; } #mb-bar .t { width: 100%; } .mb-b kbd { display: none; } #mb-tray { left: 8px; right: 8px; bottom: 8px; } #mb-tray .hint { display: none; } #mb-toast { bottom: 250px; } }
@media (prefers-reduced-motion: reduce) { #mb-toast { transition: none; } }`; document.head.appendChild(s); }

// ── the house cards' little drawings (a handmade silhouette per style, in the style's own colours)
function houseSvg(style, H) { const K = Y.KIT[style], w = hex(Y.WALLS[H?.style === style ? H.wall : K.wall] ?? 0xf4f1ea), r = hex(Y.ROOFS[H?.style === style && H.roof ? H.roof : K.roof] ?? 0x8f8e96), a = hex(Y.ACCENTS[K.accent] ?? 0x2f5bff), I = '#17171b';
  const S = { springfield: `<path d="M5 19 19 8 33 19Z" fill="${r}"/><rect x="7" y="19" width="24" height="15" fill="${w}"/><path d="M33 24 42 17 51 24Z" fill="${r}"/><rect x="34" y="24" width="16" height="10" fill="${w}"/><rect x="37" y="26" width="10" height="8" fill="#fffaf0"/><rect x="10" y="22" width="6" height="5" fill="#9fdcff"/><rect x="20" y="25" width="4" height="9" fill="#7a3cff"/>`,
    trophy: `<rect x="10" y="20" width="36" height="14" fill="${w}"/><rect x="6" y="11" width="32" height="10" fill="${a}"/><rect x="8" y="14" width="28" height="4" fill="#9fdcff"/><path d="M19 4h6v3h-1v3h-4V7h-1z" fill="#e7bd4a"/><rect x="12" y="23" width="10" height="9" fill="#9fdcff"/>`,
    cape: `<path d="M8 21 28 9 48 21Z" fill="${r}"/><rect x="11" y="21" width="34" height="13" fill="${w}"/><path d="M18 15 21 12 24 15Z M32 15 35 12 38 15Z" fill="${r}"/><rect x="26" y="25" width="4" height="9" fill="${a}"/><rect x="15" y="24" width="5" height="5" fill="#9fdcff"/><rect x="36" y="24" width="5" height="5" fill="#9fdcff"/>`,
    porch: `<path d="M14 15 27 4 40 15Z" fill="${r}"/><rect x="16" y="15" width="22" height="19" fill="${w}"/><rect x="12" y="24" width="30" height="2" fill="#fffaf0"/><rect x="25" y="27" width="4" height="7" fill="#e8232a"/><rect x="19" y="17" width="5" height="5" fill="#9fdcff"/><rect x="30" y="17" width="5" height="5" fill="#9fdcff"/>`,
    ranch: `<path d="M4 22 12 16H40l8 6Z" fill="${r}"/><rect x="6" y="22" width="30" height="12" fill="${w}"/><rect x="36" y="20" width="16" height="2" fill="${r}"/><rect x="37" y="22" width="1" height="12" fill="#fffaf0"/><rect x="50" y="22" width="1" height="12" fill="#fffaf0"/><rect x="10" y="25" width="12" height="5" fill="#9fdcff"/>`,
    gambrel: `<path d="M16 22 19 12 28 7 37 12 40 22Z" fill="${r}"/><rect x="18" y="22" width="20" height="12" fill="${w}"/><path d="M4 25 10 20H18v5Z" fill="${r}"/><rect x="5" y="25" width="13" height="9" fill="${w}"/><rect x="7" y="27" width="9" height="7" fill="#fffaf0"/><rect x="26" y="26" width="4" height="8" fill="#fff"/>`,
    slab: `<rect x="4" y="16" width="50" height="3" fill="#d3d4d7"/><rect x="6" y="19" width="16" height="15" fill="#9fdcff"/><rect x="22" y="19" width="30" height="15" fill="${w}"/><rect x="32" y="21" width="18" height="11" fill="#9fdcff"/><rect x="25" y="23" width="4" height="11" fill="${a}"/>`,
    butterfly: `<path d="M5 13 28 18 51 13 51 16 28 21 5 16Z" fill="#d3d4d7"/><rect x="7" y="19" width="14" height="15" fill="#9fdcff"/><rect x="21" y="20" width="29" height="14" fill="${w}"/><rect x="34" y="22" width="14" height="10" fill="#9fdcff"/><rect x="26" y="24" width="4" height="10" fill="${a}"/>` };
  return `<svg viewBox="0 0 56 36" aria-hidden="true"><rect y="34" width="56" height="2" fill="#57ae45"/>${S[style]}</svg>`; }

export function init(ml) {
  ML = ml; css();
  const { scene, camera, renderer, PLAN, Q, MAT, LAWN } = ML, canvas = renderer.domElement;
  const owners = new Set((Q.get('owner') || '').split(',').map(s => s.trim()).filter(Boolean)), isOwner = P => owners.has(P.id) || owners.has('all');
  const PL = new Map(PLAN.plots.map(P => [P.id, { P, poly: Y.lotPoly(P.rect, P.corners) }]));
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LAWN), V = new THREE.Vector3();
  const lots = new Map();   // plot id → the lot as it stands (saved, or seeded from the generated look)
  for (const [id, r] of ML.SAVED) lots.set(id, r.lot);
  let sel = null, hov = null, E = null, mode = 'browse';

  // ── geometry helpers: the ground under the pointer, a plot there, the lot frame
  function ground(ev) { const r = canvas.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, V) ? V.clone() : null; }
  const plotAt = p => { for (const q of PL.values()) { const [lx, lz] = ML.toL(q.P.rect, p.x, p.z); if (Y.inPoly(q.poly, lx, lz)) return q; } return null; };
  const W = (P, lx, lz) => ML.toW(P.rect, lx, lz);
  function screenOf(P, lx, ly, lz) { const [x, z] = W(P, lx, lz), p = new THREE.Vector3(x, LAWN + ly, z).project(camera), r = canvas.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; }
  // a flat ribbon along a polyline (the plot outlines, the edge run under the pointer): chunky, readable from the map
  function ribbon(pts, w, color, closed = true, y = .07) { const P = [], n = pts.length, segs = closed ? n : n - 1;
    for (let k = 0; k < segs; k++) { const [ax, az] = pts[k], [bx, bz] = pts[(k + 1) % n], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2, ex = dx / l * w / 2, ez = dz / l * w / 2;
      const a = [ax - ex + nx, az - ez + nz], b = [bx + ex + nx, bz + ez + nz], c = [bx + ex - nx, bz + ez - nz], d = [ax - ex - nx, az - ez - nz]; for (const q of [a, b, c, a, c, d]) P.push(q[0], y, q[1]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); m.renderOrder = 3; m.frustumCulled = false; return m; }
  const outline = (P, color, w) => { const m = ribbon(P.corners.map(([x, z]) => [x, z]), w, color, true, LAWN + .09); return m; };
  let hovLine = null, selLine = null;
  function setHover(q) { if (hov === q) return; hov = q; hovLine?.removeFromParent(); hovLine?.geometry.dispose(); hovLine = null; if (q && q !== sel) { hovLine = outline(q.P, 0xff4fa3, .35); scene.add(hovLine); } }
  function setSelLine(q) { selLine?.removeFromParent(); selLine?.geometry.dispose(); selLine = null; if (q) { selLine = outline(q.P, 0xffc21a, .55); scene.add(selLine); } }

  // ── the lot as it stands: saved, else seeded from the generated look (the house as built, its yard pass, its dressing)
  function seedLot(P) { const q = PL.get(P.id), A = ML.lotA.get(P.id), J = ML.lotJobs.find(j => j.P.id === P.id && !j.spec.custom);
    if (P.status !== 'built' || !A || !J) return { house: null, yard: { edges: {}, paths: [], items: [] } };
    const s = J.spec, H = Y.defaultHouse(P.style, { wall: P.wall, glass: s.glass, car: s.car ? [s.car.id, s.car.v] : null, hx: Y.KIT[P.style] ? STYLE_DX[P.style] : 0 });
    if (!Y.fits(q.poly, H)) H.legacy = true;   // built before the setback rules: it stands as it is until its owner changes it
    const e = A.edges ?? { side: 'board', front: 'none', back: 'board', fcol: 0xd9c7a4 };
    const edges = { LB: { k: e.side === 'hedge' ? 'hedge' : 'board', c: e.fcol }, RB: { k: e.side === 'hedge' ? 'hedge' : 'board', c: e.fcol }, LF: { k: e.front === 'hedge' ? 'low' : e.front, c: e.fcol }, RF: { k: e.front === 'hedge' ? 'low' : e.front, c: e.fcol },
      B: { k: e.back === 'hedge' ? 'tall' : 'board', c: e.fcol }, F: { k: P.style === 'cape' ? 'picket' : 'none' } };
    const items = (A.dress ?? []).map(d => Y.itemFrom(d.id, d.args, d.x, d.z, d.rot)).filter(Boolean);
    return { house: H, yard: { edges, paths: Y.autoPaths(q.poly, H), items } }; }
  const STYLE_DX = { springfield: 0, trophy: .3, cape: -1.6, porch: -1.6, ranch: 0, gambrel: 1.3, slab: 0, butterfly: 0 };
  const lotOf = P => lots.get(P.id) ?? seedLot(P);
  const ownerOf = P => isOwner(P) ? 'you' : P.status === 'built' || lots.has(P.id) ? '@' + (LOOKS[(hash(P.address.number * 13 + 7, P.street.length * 3) * LOOKS.length) | 0]?.handle ?? 'neighbour') : null;
  const addr = P => `${P.address.number} ${cap(P.address.street.toLowerCase())}`;
  const sizeOf = q => { const [FL, FR, BR, BL] = q.poly, a = Math.abs((FL[0] * FR[1] - FR[0] * FL[1]) + (FR[0] * BR[1] - BR[0] * FR[1]) + (BR[0] * BL[1] - BL[0] * BR[1]) + (BL[0] * FL[1] - FL[0] * BL[1])) / 2;
    const fw = Math.hypot(FR[0] - FL[0], FR[1] - FL[1]), bw = Math.hypot(BR[0] - BL[0], BR[1] - BL[1]), d = Math.max(-BR[1], -BL[1]); return { fw, bw, d, a, pie: Math.abs(fw - bw) > 1.5 }; };

  // ── the camera: eased moves (the orbit target and the eye together), then the page's shadow box and fade follow
  let tween = null;
  function fly(eye, look, ms = 750) { const c = ML.ctl; if (!c) { camera.position.set(...eye); camera.lookAt(...look); ML.fit(); return; }
    tween = { t0: performance.now(), ms, e0: camera.position.clone(), l0: c.target.clone(), e1: new THREE.Vector3(...eye), l1: new THREE.Vector3(...look) }; }
  function frameLot(P, kind) { const q = PL.get(P.id), s = sizeOf(q), d = Math.max(s.fw, s.bw, s.d), [cx, cz] = W(P, 0, -s.d * .45);
    if (kind === 'street') { const [ex, ez] = W(P, -2, 11), [lx, lz] = W(P, 0, -9); return fly([ex, 3.4, ez], [lx, 3.0, lz]); }
    if (kind === 'build') { const [ex, ez] = W(P, d * .12, d * .32); return fly([ex, d * 1.5 + 6, ez], [cx, 0, cz]); }   // steep: the back yard shows over the roof
    const [ex, ez] = W(P, d * .32, d * .95 + 6); fly([ex, d * 1.05 + 6, ez], [cx, 1.5, cz]); }
  ML.FRAME.push(t => { if (tween) { const u = Math.min(1, (performance.now() - tween.t0) / tween.ms), k = u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      camera.position.lerpVectors(tween.e0, tween.e1, k); ML.ctl.target.lerpVectors(tween.l0, tween.l1, k); if (u >= 1) { tween = null; ML.fit(); } }
    if (E) editFrame(t); });

  // ── UI: the card, the hint, the toast, the tip
  const card = document.createElement('div'); card.id = 'mb-card'; card.hidden = true; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Plot');
  const hint = document.createElement('div'); hint.id = 'mb-hint'; hint.textContent = 'click a plot · homes stay here between seasons';
  const toastEl = document.createElement('div'); toastEl.id = 'mb-toast'; toastEl.hidden = true; toastEl.setAttribute('role', 'status');
  const tip = document.createElement('div'); tip.id = 'mb-tip'; tip.hidden = true;
  const fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = '.json,application/json'; fileIn.hidden = true;
  document.body.append(card, hint, toastEl, tip, fileIn);
  let toastT = 0; const toast = s => { toastEl.textContent = s; toastEl.hidden = false; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.opacity = 0; toastT = setTimeout(() => { toastEl.hidden = true; }, 260); }, 2400); };
  UI = { toast };
  function showCard(q) { const P = q.P, s = sizeOf(q), lot = lotOf(P), H = lot.house, own = isOwner(P), who = ownerOf(P), built = !!H, f = built ? Y.flexRead(lot) : null;
    const prime = P.prime ? `<b>prime</b> · ${esc(P.primeWhy || 'prime')}` : 'standard';
    card.innerHTML = `<button class="x" data-a="close" aria-label="Close">×</button><div class="ad">${esc(addr(P))}</div><div class="id">${esc(P.id)} · the mainland${P.waterfront ? ' · waterfront' : ''}</div>
<dl><dt>Size</dt><dd>${s.pie ? `${s.fw.toFixed(1)} m front, ${s.bw.toFixed(1)} m back` : `${s.fw.toFixed(1)} × ${s.d.toFixed(1)} m`} · ${Math.round(s.a)} m²${s.pie ? ' · pie lot' : ''}</dd>
<dt>Prime</dt><dd>${prime}</dd><dt>Status</dt><dd>${built ? `<b>built</b> · ${esc(Y.KIT[H.style].name)}${lots.has(P.id) ? ' (owner-built)' : ''}` : 'available · staked'}</dd>
<dt>Owner</dt><dd>${who ? esc(who) + (own ? ' <b>(dev ?owner)</b>' : '') : 'unclaimed'}</dd></dl>
${f ? `<div class="flex"><b class="g">curb appeal ${f.pts}</b><b>${f.pieces} yard pieces</b>${f.show ? `<b>${esc(f.show)}</b>` : ''}${f.ride ? `<b>rides: ${esc(f.ride)}</b>` : ''}${f.best ? `<b>best: ${esc(f.best)}</b>` : ''}</div>` : ''}
${!built && !own ? '<div class="note">Free plots go to minted characters; premium plots are cosmetic. A home here stays when the season resets.</div>' : ''}
<div class="row">${own ? `<button class="mb-b go big" data-a="build">${built ? 'Build' : 'Build here'}</button>` : ''}${built ? `<button class="mb-b" data-a="visit">Visit</button><button class="mb-b" data-a="inside" title="enterHouse(plotId, houseSpec)">Go inside</button>` : ''}</div>`;
    card.hidden = false; }
  card.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b || !sel) return; const a = b.dataset.a;
    if (a === 'close') select(null); else if (a === 'build') startBuild(sel.P); else if (a === 'visit') visit(sel.P); else if (a === 'inside') goInside(sel.P); });
  function goInside(P) { const lot = lotOf(P), q = PL.get(P.id); if (!lot.house) return toast('nothing built here yet'); enterHouse(P.id, { ...clone(lot.house), plot: P.id, address: addr(P), rect: P.rect, poly: q.poly }); }
  function select(q, fit = true) { sel = q; setSelLine(q); setHover(null); if (!q) { card.hidden = true; mode = 'browse'; return; } showCard(q); if (fit) frameLot(q.P); }
  function visit(P) { mode = 'visit'; frameLot(P, 'street'); toast(`visiting ${addr(P)} · read-only`); }

  // ── browse: hover outlines, click a plot (a click, not an orbit drag)
  let down = null;
  canvas.addEventListener('pointerdown', ev => { if (E) return; down = { x: ev.clientX, y: ev.clientY }; });
  canvas.addEventListener('pointermove', ev => { if (E || ev.buttons) return; const p = ground(ev); setHover(p ? plotAt(p) : null); canvas.style.cursor = hov ? 'pointer' : ''; });
  canvas.addEventListener('pointerup', ev => { if (E || !down) return; const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5; down = null; if (moved || ev.button !== 0) return;
    const p = ground(ev), q = p ? plotAt(p) : null; select(q); });

  // ═══════════════════════════════ BUILD ═══════════════════════════════
  const MATS = MAT, geoCache = new Map(), thumbs = new Map(), thumbQ = [];
  let G = null, houseG = null, pathM = [], edgeM = [], pieceG = new Map(), tiles = null, foot = null, bandM = null, runM = null, cellM = null, houseReq = 0, saveT = 0, bar = null, tray = null;
  const meshesOf = (bank, mats = MATS) => bank.L.map((O, li) => { if (!O.v) return null; const m = new THREE.Mesh(geoOf(O), mats[li]); m.castShadow = li !== 3; m.receiveShadow = true; return m; }).filter(Boolean);
  function pieceGeo(it) { const k = Y.keyOf(it); let L = geoCache.get(k); if (!L) { const b = Y.bankOf(it); L = b.L.map((O, li) => O.v ? { g: geoOf(O), li } : null).filter(Boolean); geoCache.set(k, L); } return L; }
  function pieceGroup(it) { const g = new THREE.Group(); for (const { g: geo, li } of pieceGeo(it)) { const m = new THREE.Mesh(geo, MATS[li]); m.castShadow = li !== 3; m.receiveShadow = true; g.add(m); }
    const [tx, tz] = Y.stampAt(it); g.position.set(tx, 0, tz); g.rotation.y = it.r ?? 0; return g; }
  const rects = () => E.lot.house ? Y.houseRects(E.lot.house) : [], door = () => E.lot.house ? Y.doorZone(E.lot.house) : null;
  const hf = () => E.lot.house ? Y.houseFront(E.lot.house) : -6;

  function startBuild(P) { if (!isOwner(P)) return toast('only the owner builds here'); const q = PL.get(P.id);
    const base = seedLot(P), lot = clone(lots.get(P.id) ?? base);
    E = { P, q, poly: q.poly, lot, base: JSON.stringify(base), tab: lot.house ? 'yard' : 'house', ytab: 'fences', tool: null, held: null, hist: [], redo: [], drag: null, paint: null };
    if (!lot.house) E.tab = 'house'; mode = 'build'; card.hidden = true; document.body.classList.add('mb-building');
    ML.lotGroups.get(P.id)?.traverse(m => { m.visible = m.isMesh ? false : m.visible; }); ML.hideFrontier(P.id, true);
    G = new THREE.Group(); G.name = 'builder:' + P.id; G.position.set(P.rect.x, LAWN, P.rect.z); G.rotation.y = P.rect.rot; scene.add(G);
    houseG = new THREE.Group(); G.add(houseG);
    tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6cff4a, transparent: true, opacity: .35, depthWrite: false, toneMapped: false }), 4096); tiles.count = 0; tiles.frustumCulled = false; tiles.renderOrder = 2; G.add(tiles);
    foot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: .55, depthWrite: false, toneMapped: false })); foot.visible = false; foot.renderOrder = 2; G.add(foot);
    cellM = new THREE.Mesh(new THREE.PlaneGeometry(Y.CELL * .92, Y.CELL * .92).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: .7, depthWrite: false, toneMapped: false })); cellM.visible = false; cellM.renderOrder = 3; G.add(cellM);
    G.add(ribbon(q.poly, .18, 0xffc21a, true, .06));
    buildUI(); refreshAll(null); frameLot(P, 'build'); addEventListener('keydown', onKey, true);
    canvas.addEventListener('pointerdown', onDown, true); canvas.addEventListener('pointermove', onMove, true); canvas.addEventListener('pointerup', onUp, true);
    toast(lot.house ? (lot.house.legacy ? 'built before the setback rules · it stands as it is until you change it' : 'build mode · House or Yard up top') : 'an empty plot · pick a house from the kit'); }

  // ── the house: built in a worker (the real build, bare: the yard is drawn here), swapped in when it lands; moved by its group
  async function rebuildHouse() { const id = ++houseReq, H = E.lot.house; for (const m of [...houseG.children]) { if (m.userData.keepWhileBuilding) continue; }
    if (!H) { clearGroup(houseG); return; } status('building the house…');
    const r = await ML.run('house', { spec: { style: H.style, seed: 1, W: E.P.rect.w, D: E.P.rect.d, poly: E.poly, custom: { house: H, yard: { edges: {}, paths: [], items: [] } } } }, 10);
    if (id !== houseReq || !E) return; clearGroup(houseG); const b = new Bank(true); unpackInto(r.P, b); for (const m of meshesOf(b)) houseG.add(m);
    const panes = (r.extra?.panes ?? []).map(([x0, y0, z0, x1, y1, z1]) => [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, Math.max(.04, z1 - z0)]);
    if (panes.length) { const PANE = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: ML.NIGHT ? .08 : .22, roughness: .05, metalness: .1, depthWrite: false });
      for (const [x, y, z, sx, sy, sz] of panes) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), PANE); m.position.set(x, y, z); m.renderOrder = 2; houseG.add(m); } }
    houseG.userData.sig = houseSig(H); renderer.shadowMap.needsUpdate = true; status(saveState()); }
  const houseSig = H => H ? JSON.stringify({ ...H, hx: 0 }) : '';
  function clearGroup(g) { for (const m of [...g.children]) { m.removeFromParent(); if (m.geometry && !m.userData.shared) m.geometry.dispose(); } }
  // the yard's voxel layers (the same drawing code the page's lot build uses): the paths, the fences and hedges
  function layer(draw, h) { const xs = E.poly.map(p => p[0]), zs = E.poly.map(p => p[1]), L = new LV(Math.min(...xs) - .6, Math.min(...zs) - .6, Math.max(...xs) + .6, 1.6, h); draw(L); const b = new Bank(true); meshVol(L.V, b); return meshesOf(b); }
  function redrawPaths() { for (const m of pathM) { m.removeFromParent(); m.geometry.dispose(); } pathM = layer(L => drawPaths(L, E.lot.yard.paths, rects()), .3); for (const m of pathM) { m.castShadow = false; G.add(m); } }
  function redrawEdges() { for (const m of edgeM) { m.removeFromParent(); m.geometry.dispose(); } edgeM = layer(L => drawEdges(L, E.lot.yard.edges, E.poly, hf(), E.lot.yard.paths), 1.8); for (const m of edgeM) G.add(m); }
  function syncPieces() { for (const g of pieceG.values()) g.removeFromParent(); pieceG.clear();
    E.lot.yard.items.forEach((it, i) => { if (E.held?.src === 'yard' && E.held.i === i) return; const g = pieceGroup(it); g.userData.i = i; g.traverse(m => { m.userData.piece = i; }); G.add(g); pieceG.set(i, g); }); }
  function drawBand() { bandM?.removeFromParent(); bandM?.traverse(m => m.geometry?.dispose()); bandM = null; const H = E.lot.house; if (!H || E.tab !== 'house') return;
    const b = H.legacy ? null : Y.fitBand(E.poly, H), R0 = Y.houseRects({ ...H, hx: b ? b.lo : H.hx }), R1 = Y.houseRects({ ...H, hx: b ? b.hi : H.hx });
    const x0 = Math.min(...R0.map(r => r[0])), x1 = Math.max(...R1.map(r => r[2])), z0 = Math.min(...R0.map(r => r[1])), z1 = Math.max(...R0.map(r => r[3]));
    const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: H.legacy ? 0xff4fa3 : 0x6cff4a, transparent: true, opacity: .22, depthWrite: false, toneMapped: false }));
    m.position.set((x0 + x1) / 2, .14, (z0 + z1) / 2); m.renderOrder = 2; g.add(m); for (const r of Y.houseRects(H)) g.add(ribbon([[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]], .14, 0xffc21a, true, .16));
    bandM = g; G.add(g); }
  function refreshAll(prev) { const H = E.lot.house; if (houseSig(H) !== houseG.userData.sig) rebuildHouse(); houseG.position.x = H ? H.hx : 0;
    redrawPaths(); redrawEdges(); syncPieces(); drawBand(); drawTiles(); refreshBar(); refreshTray(); renderer.shadowMap.needsUpdate = true; }

  // ── history and save (the city builder's pattern: a linear stack of before/after states; every change saves a beat later)
  function commit(name, next) { const before = clone(E.lot); E.hist.push({ name, before, after: clone(next) }); E.redo.length = 0; if (E.hist.length > 200) E.hist.shift(); E.lot = clone(next); refreshAll(before); autosave(); }
  function undo() { if (E.held) cancel(); const c = E.hist.pop(); if (!c) return toast('nothing to undo'); E.redo.push(c); E.lot = clone(c.before); refreshAll(null); autosave(); toast('undo · ' + c.name); }
  function redo() { if (E.held) cancel(); const c = E.redo.pop(); if (!c) return; E.hist.push(c); E.lot = clone(c.after); refreshAll(null); autosave(); toast('redo · ' + c.name); }
  const unedited = () => JSON.stringify(E.lot) === E.base;
  function saveState() { return unedited() ? 'generated look' : lots.has(E.P.id) ? 'saved' : 'unsaved'; }
  function autosave(now) { clearTimeout(saveT); const go = () => { if (!E) return; let rec = null; if (unedited()) { SV.clear(E.P.id); lots.delete(E.P.id); } else { rec = SV.save(E.P.id, clone(E.lot)); lots.set(E.P.id, clone(E.lot)); }
      status(rec && rec.local === false ? 'not saved (storage off)' : saveState()); return rec; }; if (now) return go(); saveT = setTimeout(go, 350); }
  function exportJSON() { const rec = { v: 1, plot: E.P.id, address: addr(E.P), rev: Date.now(), lot: E.lot }, a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(rec, null, 1) + '\n'], { type: 'application/json' })); a.download = `mainland-${E.P.id}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('exported · ' + a.download); }
  function importJSON(text) { let r; try { r = JSON.parse(text); } catch { return toast('not JSON'); } if (!SV.valid(r)) return toast('not a Mainland lot (saved.js format)');
    const L = clone(r.lot); if (!Y.KIT[L.house.style]) return toast('unknown house style');
    if (r.plot !== E.P.id) { const f = Y.fitStyle(E.poly, { ...L.house, legacy: undefined }); if (!f) return toast(`that house doesn't fit ${addr(E.P)}`); L.house = f.H;
      L.yard.paths = L.yard.paths.filter(([x, z]) => Y.cellOnLot(E.poly, x, z, .1)); const R = Y.houseRects(L.house), keep = []; for (const it of L.yard.items) if (Y.okAt(L, E.poly, it, keep, R, Y.doorZone(L.house))) keep.push(it); L.yard.items = keep; }
    commit('import', L); toast(r.plot === E.P.id ? 'imported' : `imported from ${r.plot} · refitted to this lot`); }
  function reset() { commit('reset', JSON.parse(E.base)); toast('back to the generated look · undo to get yours back'); }

  // ── the house kit: change the house (it refits: the shallowest depth where it fits, the nearest place along its band); the drive and
  // the front walk follow it; pieces now on the house, the drive or the door's patch go back to the tray
  function setHouse(nextH, name) { const L = clone(E.lot), prevH = L.house; delete nextH.legacy; L.house = nextH;
    if (prevH) { const old = new Set(Y.autoPaths(E.poly, prevH).map(c => c.join(','))); L.yard.paths = L.yard.paths.filter(c => !old.has(c.join(','))); }
    const have = new Set(L.yard.paths.map(([x, z]) => x + ',' + z)); for (const c of Y.autoPaths(E.poly, nextH)) if (!have.has(c[0] + ',' + c[1])) L.yard.paths.push(c);
    const R = Y.houseRects(nextH), on = (x, z, r, m = 0) => x < r[2] + m && x + Y.CELL > r[0] - m && z < r[3] + m && z + Y.CELL > r[1] - m; L.yard.paths = L.yard.paths.filter(([x, z]) => !R.some(r => on(x, z, r)));
    const dz = Y.doorZone(nextH), pc = new Map(L.yard.paths.map(([x, z, m]) => [x + ',' + z, m])); let gone = 0;
    L.yard.items = L.yard.items.filter(it => { const bad = Y.cellsOf(it).some(([x, z]) => R.some(r => on(x, z, r, .2)) || (dz && on(x, z, dz)) || (pc.has(x + ',' + z) && !(pc.get(x + ',' + z) === 'drive' && Y.YARD[it.id]?.drive))); if (bad) gone++; return !bad; });
    commit(name, L); if (gone) toast(`${gone} piece${gone > 1 ? 's' : ''} back to the tray (in the new house's way)`); }
  function pickStyle(style) { const cur = E.lot.house, base = Y.defaultHouse(style, { wall: cur?.wall ?? Y.KIT[style].wall, hx: STYLE_DX[style] }); if (cur?.show && cur.show !== 'none' && style !== 'trophy') base.show = cur.show;
    const f = Y.fitStyle(E.poly, base); if (!f) return toast(`${Y.KIT[style].name} doesn't fit this lot`); setHouse(f.H, Y.KIT[style].name);
    if (f.H.garage !== base.garage || f.H.pool !== base.pool) toast(`${Y.KIT[style].name}: ${f.H.garage === 'none' ? 'no garage' : 'no pool'} to fit this lot`); }
  function setOpt(k, v) { const H = E.lot.house; if (!H) return; const T = { ...H, [k]: v }; delete T.legacy; const b = Y.fitBand(E.poly, T); if (!b) return toast("that doesn't fit this lot");
    T.hz = b.hz; T.hx = Math.max(b.lo, Math.min(b.hi, T.hx)); setHouse(T, k); }
  function nudge(d) { const H = E.lot.house; if (!H) return; if (H.legacy) return toast('built before the setback rules · change the style or an option first'); const b = Y.fitBand(E.poly, H); const hx = Math.max(b.lo, Math.min(b.hi, H.hx + d));
    if (hx === H.hx) return toast(d > 0 ? 'as far right as the setbacks allow' : 'as far left as the setbacks allow'); setHouse({ ...H, hx }, 'move'); }

  // ── the yard: what's held, where it can go (every valid block on the grid, lit), the nearest one to the pointer
  function candidates(it) { const others = E.lot.yard.items.filter((o, i) => !(E.held?.src === 'yard' && E.held.i === i)), R = rects(), dz = door(), b = Y.boxOf(it), xs = E.poly.map(p => p[0]), zs = E.poly.map(p => p[1]), out = [];
    const x0 = Math.floor(Math.min(...xs) / Y.CELL) * Y.CELL, x1 = Math.max(...xs), z0 = Math.floor(Math.min(...zs) / Y.CELL) * Y.CELL, z1 = Y.YARD[it.id]?.curb ? 1 : 0;
    for (let x = x0; x + b.cw * Y.CELL <= x1 + 1e-6; x += Y.CELL) for (let z = z0; z + b.cd * Y.CELL <= z1 + 1e-6; z += Y.CELL) { const c = { ...it, x: r2(x), z: r2(z) }; if (Y.okAt(E.lot, E.poly, c, others, R, dz)) out.push(c); }
    return out; }
  function hold(H) { E.held = H; H.cands = candidates(H.it); H.cur = null; H.ghost = pieceGroup(H.it); H.ghost.visible = false; G.add(H.ghost); syncPieces(); drawTiles(); refreshBar(); refreshTray();
    if (!H.cands.length) toast('no spot fits it on this lot right now'); }
  function fromTray(id, v = 0) { if (E.held) cancel(); E.tool = null; hold({ src: 'tray', it: { id, v, r: 0 } }); if (E.held?.cands.length) toast('click a lit spot to put it down · R turns it · C colour'); }
  function pickUp(i) { const it = E.lot.yard.items[i]; hold({ src: 'yard', i, it: clone(it), orig: clone(it) }); const c = E.held.cands.find(q => q.x === it.x && q.z === it.z); if (c) { E.held.cur = c; preview(); } }
  function aimAt(lx, lz) { const H = E.held; if (!H) return; let best = null, bd = 1e9; const b = Y.boxOf(H.it);
    for (const c of H.cands) { const d = Math.hypot(c.x + b.cw * Y.CELL / 2 - lx, c.z + b.cd * Y.CELL / 2 - lz) - (c === H.cur ? .15 : 0); if (d < bd) { bd = d; best = c; } }
    if (best && bd < 3 && best !== H.cur) { H.cur = best; preview(); } else if (!best || bd >= 3) { H.cur = null; H.ghost.visible = false; foot.visible = false; } }
  function preview() { const H = E.held, c = H.cur; if (!c) return; const b = Y.boxOf(c), [tx, tz] = Y.stampAt(c); H.ghost.visible = true; H.ghost.userData.to = [tx, tz]; if (!H.ghost.userData.at) { H.ghost.position.set(tx, 0, tz); H.ghost.userData.at = 1; } H.ghost.rotation.y = c.r ?? 0;
    foot.visible = true; foot.position.set(c.x + b.cw * Y.CELL / 2, .15, c.z + b.cd * Y.CELL / 2); foot.scale.set(b.cw * Y.CELL, 1, b.cd * Y.CELL); }
  function drop() { const H = E.held; if (!H) return; if (!H.cur) return toast('move onto a lit spot first'); const L = clone(E.lot), it = { ...H.cur }; delete it.cands;
    if (H.src === 'yard') L.yard.items[H.i] = it; else L.yard.items.push(it); endHold(); commit(H.src === 'yard' ? 'move ' + Y.YARD[it.id].name : 'add ' + Y.YARD[it.id].name, L); thunk(); }
  function endHold() { const H = E.held; if (!H) return; H.ghost.removeFromParent(); E.held = null; foot.visible = false; syncPieces(); drawTiles(); refreshBar(); refreshTray(); }
  function cancel() { endHold(); }
  function turn() { const H = E.held; if (!H) return toast('pick a piece up first, then R turns it'); const was = H.it.r ?? 0;
    for (let k = 1; k <= 3; k++) { H.it.r = +((Math.round(was / (Math.PI / 2)) + k) * Math.PI / 2 % (Math.PI * 2)).toFixed(3); const C = candidates(H.it); if (C.length) { H.cands = C; const at = H.cur; H.cur = null; H.ghost.removeFromParent(); H.ghost = pieceGroup(H.it); G.add(H.ghost); drawTiles(); if (at) aimAt(at.x + .5, at.z + .5); return; } }
    H.it.r = was; toast('no spot fits it turned'); }
  function recolour() { const H = E.held; if (!H) return toast('pick a piece up first, then C changes its colour'); const n = Y.YARD[H.it.id].variants.length; if (n < 2) return toast('it comes one way');
    delete H.it.a; H.it.v = ((H.it.v | 0) + 1) % n; const C = candidates(H.it); H.cands = C; const at = H.cur; H.cur = null; H.ghost.removeFromParent(); H.ghost = pieceGroup(H.it); G.add(H.ghost); drawTiles(); if (at) aimAt(at.x + .5, at.z + .5); refreshTray(); }
  function remove(i) { if (i === undefined && E.held) { if (E.held.src === 'tray') return cancel(); i = E.held.i; endHold(); } if (i === undefined) return toast('point at a piece, or pick it up, to put it away');
    const L = clone(E.lot), [it] = L.yard.items.splice(i, 1); commit('remove ' + Y.YARD[it.id].name, L); toast(Y.YARD[it.id].name + ' → back to the tray'); }
  // paths and the drive, painted cell by cell (one undo step per stroke); fences and hedges, one run at a time
  function paintable(x, z) { if (z >= 0 || !Y.cellOnLot(E.poly, x, z, .1)) return false; if (rects().some(r => x < r[2] && x + Y.CELL > r[0] && z < r[3] && z + Y.CELL > r[1])) return false;
    for (const it of E.lot.yard.items) for (const [cx, cz] of Y.cellsOf(it)) if (cx === x && cz === z) return false; return true; }
  function paintAt(lx, lz) { const x = r2(Math.floor(lx / Y.CELL) * Y.CELL), z = r2(Math.floor(lz / Y.CELL) * Y.CELL), m = E.tool.m, P = E.paint.lot.yard.paths, k = P.findIndex(c => c[0] === x && c[1] === z);
    if (m === 'erase') { if (k >= 0) { P.splice(k, 1); E.paint.n++; } } else if (paintable(x, z)) { if (k >= 0) { if (P[k][2] !== m) { P[k][2] = m; E.paint.n++; } } else { P.push([x, z, m]); E.paint.n++; } } else return;
    const keep = E.lot; E.lot = E.paint.lot; redrawPaths(); E.lot = keep; }
  function runAt(lx, lz) { const R = Y.runsOf(E.poly, hf()); let best = null, bd = 1e9;
    for (const [k, [a, b]] of Object.entries(R)) { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((lx - a[0]) * dx + (lz - a[1]) * dz) / (dx * dx + dz * dz || 1))), d = Math.hypot(lx - a[0] - t * dx, lz - a[1] - t * dz); if (d < bd) { bd = d; best = k; } }
    return bd < 2.2 ? best : null; }
  function showRun(k) { runM?.removeFromParent(); runM?.geometry.dispose(); runM = null; if (!k) return; const R = Y.runsOf(E.poly, hf())[k]; runM = ribbon(R, .5, 0xffc21a, false, .2); G.add(runM); }
  function setRun(k) { const t = E.tool, L = clone(E.lot); L.yard.edges[k] = t.k === 'none' ? { k: 'none' } : { k: t.k, ...(Y.EDGES[t.k].cols ? { c: t.c ?? Y.EDGES[t.k].cols[0] } : {}) }; commit(`${Y.EDGES[t.k].name} on ${Y.RUN_NAMES[k]}`, L); thunk(); }
  // the lit spots: every cell a valid placement covers (held piece), or every paintable cell (path tool)
  function drawTiles() { if (!tiles) return; const T = [], seen = new Set();
    if (E.held) { const b = Y.boxOf(E.held.it); for (const c of E.held.cands) for (let i = 0; i < b.cw; i++) for (let j = 0; j < b.cd; j++) { const x = r2(c.x + i * Y.CELL), z = r2(c.z + j * Y.CELL), k = x + ',' + z; if (!seen.has(k)) { seen.add(k); T.push([x, z]); } } }
    else if (E.tool?.kind === 'path' && E.tool.m !== 'erase') { const xs = E.poly.map(p => p[0]), zs = E.poly.map(p => p[1]); for (let x = Math.floor(Math.min(...xs) / Y.CELL) * Y.CELL; x < Math.max(...xs); x += Y.CELL) for (let z = Math.floor(Math.min(...zs) / Y.CELL) * Y.CELL; z < 0; z += Y.CELL) if (paintable(r2(x), r2(z))) T.push([r2(x), r2(z)]); }
    const M4 = new THREE.Matrix4(); tiles.count = Math.min(T.length, 4096); for (let k = 0; k < tiles.count; k++) tiles.setMatrixAt(k, M4.compose(new THREE.Vector3(T[k][0] + Y.CELL / 2, .13, T[k][1] + Y.CELL / 2), new THREE.Quaternion(), new THREE.Vector3(Y.CELL * .84, 1, Y.CELL * .84)));
    tiles.instanceMatrix.needsUpdate = true; tiles.visible = tiles.count > 0; tiles.material.color.set(E.tool?.kind === 'path' ? 0x9fdcff : 0xfff27a); }
  let thunkT = 0; const thunk = () => { thunkT = performance.now(); };
  function editFrame(t) { const H = E.held; if (H?.ghost?.visible && H.ghost.userData.to) { const [tx, tz] = H.ghost.userData.to, k = .35; H.ghost.position.x += (tx - H.ghost.position.x) * k; H.ghost.position.z += (tz - H.ghost.position.z) * k; H.ghost.position.y = .1 + Math.sin(t / 160) * .03; }
    if (tiles?.visible) tiles.material.opacity = .42 + Math.sin(t / 300) * .1; if (foot?.visible) foot.material.opacity = .62 + Math.sin(t / 200) * .12;
    const u = (performance.now() - thunkT) / 230; if (u < 1 && G) { const s = u < .45 ? 1 - Math.sin(u / .45 * Math.PI) * .03 : 1; G.scale.set(1, s, 1); } else if (G && G.scale.y !== 1) G.scale.set(1, 1, 1);
    pumpThumbs(); }
  // ── pointer (capture phase on the canvas: a press on a piece, the house or with something held never orbits the camera)
  const consume = ev => { ev.stopImmediatePropagation(); ev.preventDefault(); };
  const local = ev => { const p = ground(ev); return p ? ML.toL(E.P.rect, p.x, p.z) : null; };
  function pieceUnder(ev) { const r = canvas.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...pieceG.values()], true); return hits.length ? hits[0].object.userData.piece : undefined; }
  function houseUnder(ev) { const r = canvas.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObject(houseG, true).length > 0; }
  let press = null, hoverPiece;
  function onDown(ev) { if (!E || ev.button !== 0) return; const L = local(ev); press = { x: ev.clientX, y: ev.clientY };
    if (E.held) { consume(ev); press.kind = 'place'; if (L) aimAt(L[0], L[1]); return; }
    if (E.tab === 'house' && E.lot.house && houseUnder(ev)) { consume(ev); if (E.lot.house.legacy) { toast('built before the setback rules · change the style or an option first'); press = null; return; }
      E.drag = { x0: L[0], hx0: E.lot.house.hx, band: Y.fitBand(E.poly, E.lot.house), hx: E.lot.house.hx }; try { canvas.setPointerCapture(ev.pointerId); } catch {} return; }
    if (E.tab !== 'yard') return;
    if (E.tool?.kind === 'path' && L) { consume(ev); E.paint = { lot: clone(E.lot), n: 0 }; paintAt(L[0], L[1]); try { canvas.setPointerCapture(ev.pointerId); } catch {} return; }
    if (E.tool?.kind === 'edge' && L) { const k = runAt(L[0], L[1]); if (k) { consume(ev); press.kind = 'edge'; press.run = k; } return; }
    const i = pieceUnder(ev); if (i !== undefined) { consume(ev); pickUp(i); press.kind = 'grab'; try { canvas.setPointerCapture(ev.pointerId); } catch {} } }
  function onMove(ev) { if (!E) return; const L = local(ev); if (!L) return;
    if (E.drag) { consume(ev); const D = E.drag, b = D.band; D.hx = Math.max(b.lo, Math.min(b.hi, snap(D.hx0 + L[0] - D.x0))); houseG.position.x = D.hx; return; }
    if (E.held) { aimAt(L[0], L[1]); if (press) consume(ev); tip.hidden = true; return; }
    if (E.paint) { consume(ev); paintAt(L[0], L[1]); return; }
    if (E.tab === 'yard' && E.tool?.kind === 'edge') { showRun(runAt(L[0], L[1])); canvas.style.cursor = runM ? 'pointer' : ''; return; }
    if (E.tab === 'yard' && E.tool?.kind === 'path') { const x = Math.floor(L[0] / Y.CELL) * Y.CELL, z = Math.floor(L[1] / Y.CELL) * Y.CELL; cellM.visible = E.tool.m === 'erase' || paintable(r2(x), r2(z)); cellM.position.set(x + Y.CELL / 2, .17, z + Y.CELL / 2); cellM.material.color.set(E.tool.m === 'erase' ? 0xff4fa3 : 0xffc21a); return; }
    if (E.tab === 'yard' && !ev.buttons && ev.pointerType === 'mouse') { const i = pieceUnder(ev); hoverPiece = i; if (i !== undefined) { const it = E.lot.yard.items[i]; tip.hidden = false; tip.innerHTML = `<b>${esc(Y.YARD[it.id]?.name)}</b>click to move · Del to the tray`; tip.style.left = ev.clientX + 'px'; tip.style.top = ev.clientY + 'px'; canvas.style.cursor = 'grab'; } else { tip.hidden = true; canvas.style.cursor = ''; } }
    if (E.tab === 'house' && !ev.buttons) canvas.style.cursor = E.lot.house && houseUnder(ev) ? (E.lot.house.legacy ? 'not-allowed' : 'ew-resize') : ''; }
  function onUp(ev) { if (!E) return; try { canvas.releasePointerCapture(ev.pointerId); } catch {}
    if (E.drag) { consume(ev); const D = E.drag; E.drag = null; if (D.hx !== E.lot.house.hx) setHouse({ ...E.lot.house, hx: D.hx }, 'move the house'); return; }
    if (E.paint) { consume(ev); const p = E.paint; E.paint = null; if (p.n) commit(E.tool.m === 'erase' ? 'erase path' : Y.PATHS[E.tool.m].name, p.lot); else redrawPaths(); return; }
    const p = press; press = null; if (!p) return; const moved = Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > 6;
    if (p.kind === 'edge') { consume(ev); if (!moved) setRun(p.run); return; }
    if (p.kind === 'grab') { consume(ev); if (!moved) return; const L = local(ev); if (L) aimAt(L[0], L[1]); drop(); return; }
    if (p.kind === 'place') { consume(ev); const L = local(ev); if (L) aimAt(L[0], L[1]); drop(); } }
  function onKey(ev) { if (!E || /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target?.tagName || '')) return; const k = ev.key, mod = ev.metaKey || ev.ctrlKey; let used = true;
    if (mod && (k === 'z' || k === 'Z')) ev.shiftKey ? redo() : undo(); else if (mod && (k === 'y' || k === 'Y')) redo(); else if (mod && (k === 's' || k === 'S')) { autosave(true); toast('saved'); }
    else if (mod || ev.altKey) used = false; else if (k === 'r' || k === 'R') turn(); else if (k === 'c' || k === 'C') recolour();
    else if (k === 'Delete' || k === 'Backspace') remove(E.held ? undefined : hoverPiece);
    else if (k === 'ArrowLeft' && E.tab === 'house') nudge(-Y.CELL); else if (k === 'ArrowRight' && E.tab === 'house') nudge(Y.CELL);
    else if (k === 'Escape') { if (E.held) cancel(); else if (E.tool) { E.tool = null; showRun(null); cellM.visible = false; drawTiles(); refreshTray(); } else done(); } else used = false;
    if (used) { ev.preventDefault(); ev.stopImmediatePropagation(); } }

  // ── done: the lot for the page, from the saved spec (exactly what a reload builds), or back to the generated look
  async function done() { if (!E) return; if (E.held) cancel(); autosave(true); clearTimeout(saveT); const S = E, P = S.P, lot = lots.get(P.id) ?? null;
    removeEventListener('keydown', onKey, true); canvas.removeEventListener('pointerdown', onDown, true); canvas.removeEventListener('pointermove', onMove, true); canvas.removeEventListener('pointerup', onUp, true);
    bar?.remove(); tray?.remove(); bar = tray = null; tip.hidden = true; canvas.style.cursor = ''; document.body.classList.remove('mb-building'); mode = 'browse'; E = null;
    const J = ML.lotJobs.find(j => j.P.id === P.id), gen = J && !J.spec.custom ? J.spec : null, gone = () => { G?.removeFromParent(); G = null; renderer.shadowMap.needsUpdate = true; };
    if (lot) { const spec = { style: lot.house?.style ?? 'cape', seed: gen?.seed ?? 1, W: P.rect.w, D: P.rect.d, poly: S.poly, custom: lot };
      if (!lot.house) spec.custom = { ...lot, house: null };
      const r = await ML.run('lot', { spec, x: P.rect.x, z: P.rect.z, rot: P.rect.rot }, 9); ML.setLot(P, r, J?.k ?? -1, lot.house ? lot : null); ML.hideFrontier(P.id, true); }
    else if (P.status === 'built' && J) { const r = await ML.run('lot', { spec: J.spec.custom ? (() => { const s = { ...J.spec }; delete s.custom; return s; })() : J.spec, x: P.rect.x, z: P.rect.z, rot: P.rect.rot }, 9); ML.setLot(P, r, J.k, null); }
    else { const g = ML.lotGroups.get(P.id); if (g) { g.removeFromParent(); ML.lotGroups.delete(P.id); } ML.hideFrontier(P.id, false); }
    gone(); select(PL.get(P.id), false); toast(lot ? 'saved · your home stays here between seasons' : 'the generated look stands'); }

  // ── the bar and the tray
  function buildUI() { bar = document.createElement('div'); bar.id = 'mb-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Build');
    bar.innerHTML = `<div class="t">Build<small>${esc(addr(E.P))} · ${esc(E.P.id)}</small></div><button class="mb-b" data-a="tab-house">House</button><button class="mb-b" data-a="tab-yard">Yard</button><span class="sep"></span>
<button class="mb-b" data-a="undo" title="Undo (Ctrl/⌘+Z)">↶ Undo</button><button class="mb-b" data-a="redo" title="Redo (Ctrl/⌘+⇧+Z)">↷ Redo</button>
<button class="mb-b" data-a="turn" title="Turn what you hold (R)">⟳ Turn<kbd>R</kbd></button><button class="mb-b" data-a="col" title="Next colour (C)">Colour<kbd>C</kbd></button><button class="mb-b" data-a="del" title="Back to the tray (Delete)">Remove<kbd>Del</kbd></button>
<span class="sep"></span><button class="mb-b" data-a="exp">Export</button><button class="mb-b" data-a="imp">Import</button><button class="mb-b" data-a="reset" title="Back to the generated look (undoable)">Reset</button>
<button class="mb-b" data-a="inside" title="enterHouse(plotId, houseSpec)">Go inside</button><span class="sep"></span><span class="st" aria-live="polite"></span><button class="mb-b go" data-a="done" title="Done (Esc)">Done</button>`;
    bar.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b || !E) return; const a = b.dataset.a;
      ({ 'tab-house': () => setTab('house'), 'tab-yard': () => setTab('yard'), undo, redo, turn, col: recolour, del: () => remove(E.held ? undefined : undefined), exp: exportJSON, imp: () => fileIn.click(), reset, inside: () => goInside(E.P), done })[a]?.(); });
    tray = document.createElement('div'); tray.id = 'mb-tray'; tray.setAttribute('aria-label', 'Kit');
    tray.addEventListener('click', ev => { if (!E) return; const t = ev.target.closest('[data-t]'), c = ev.target.closest('[data-c]'), o = ev.target.closest('[data-o]');
      if (t) { E.ytab = t.dataset.t; E.tool = null; if (E.held) cancel(); showRun(null); refreshTray(); drawTiles(); return; }
      if (o) { if (o.disabled) return; const [k, v] = [o.dataset.o, JSON.parse(o.dataset.v)]; if (k === 'nudge') return nudge(v); if (k === 'edgecol') { E.tool = { ...E.tool, c: v }; refreshTray(); return; } setOpt(k, v); return; }
      if (c) { const [kind, val] = c.dataset.c.split(':'); if (c.classList.contains('na')) return toast(c.dataset.why || 'not on this lot');
        if (kind === 'style') pickStyle(val); else if (kind === 'piece') fromTray(val); else if (kind === 'edge') { E.tool = { kind: 'edge', k: val, c: Y.EDGES[val].cols?.[0] }; if (E.held) cancel(); refreshTray(); toast('click a fence line round the lot'); }
        else if (kind === 'path') { E.tool = { kind: 'path', m: val }; if (E.held) cancel(); drawTiles(); refreshTray(); toast(val === 'erase' ? 'click or drag over a path to lift it' : 'click or drag to paint · Esc stops'); } } });
    fileIn.onchange = () => { const f = fileIn.files?.[0]; if (f) f.text().then(importJSON); fileIn.value = ''; };
    document.body.append(bar, tray); }
  function setTab(t) { if (E.held) cancel(); E.tab = t; E.tool = null; showRun(null); cellM.visible = false; drawBand(); drawTiles(); refreshBar(); refreshTray(); }
  function status(s) { const el = bar?.querySelector('.st'); if (el) el.textContent = s; }
  function refreshBar() { if (!bar || !E) return; const q = s => bar.querySelector(`[data-a="${s}"]`); q('tab-house').classList.toggle('on', E.tab === 'house'); q('tab-yard').classList.toggle('on', E.tab === 'yard');
    q('undo').disabled = !E.hist.length; q('redo').disabled = !E.redo.length; q('turn').disabled = q('col').disabled = !E.held; q('del').disabled = !E.held; q('inside').disabled = !E.lot.house; status(saveState()); }
  function chip(k, v, label, on, dis, why) { return `<button class="mb-ch${on ? ' on' : ''}" data-o="${k}" data-v='${JSON.stringify(v)}'${dis ? ` disabled title="${esc(why || "doesn't fit this lot")}"` : ''}>${esc(label)}</button>`; }
  function sw(k, v, col, on, label) { return `<button class="mb-sw${on ? ' on' : ''}" data-o="${k}" data-v='${JSON.stringify(v)}' style="background:${hex(col)}" title="${esc(label)}" aria-label="${esc(label)}"></button>`; }
  function refreshTray() { if (!tray || !E) return; const H = E.lot.house, K = H ? Y.KIT[H.style] : null;
    if (E.tab === 'house') {
      const cards = Y.STYLES.map(st => { const f = Y.fitStyle(E.poly, Y.defaultHouse(st, { hx: STYLE_DX[st] })), why = f ? '' : 'too big for this lot';
        return `<button class="mb-c${H?.style === st ? ' sel' : ''}${f ? '' : ' na'}" data-c="style:${st}" data-why="${why}">${houseSvg(st, H)}${f ? '' : `<span class="why">${why}</span>`}<span class="n">${esc(Y.KIT[st].name)}</span><span class="k">${esc(Y.KIT[st].blurb)}</span></button>`; }).join('');
      let opts = '';
      if (H) { const fitsWith = (k, v) => !!Y.fitBand(E.poly, { ...H, [k]: v, legacy: undefined });
        opts += `<span class="og"><span>Walls</span>${Object.entries(Y.WALLS).map(([n, c]) => sw('wall', n, c, H.wall === n, n)).join('')}</span>`;
        if (K.roof) opts += `<span class="og"><span>Roof</span>${Object.entries(Y.ROOFS).map(([n, c]) => sw('roof', n, c, H.roof === n, n)).join('')}</span>`;
        if (K.accent) opts += `<span class="og"><span>${H.style === 'trophy' ? 'Upstairs' : H.style === 'cape' ? 'Shutters' : 'Accent'}</span>${Object.entries(Y.ACCENTS).map(([n, c]) => sw('accent', n, c, H.accent === n, n)).join('')}</span>`;
        if (K.garage) opts += `<span class="og"><span>Garage</span>${K.garage.map(g => chip('garage', g, g === 'glass' ? 'glass showroom' : g === 'door' ? 'garage door' : g === 'carport' ? 'carport' : 'none', H.garage === g, !fitsWith('garage', g), 'needs a wider lot')).join('')}</span>`;
        if (K.porch) opts += `<span class="og"><span>${esc(K.porch)}</span>${chip('porch', true, 'on', H.porch !== false, !fitsWith('porch', true))}${chip('porch', false, 'off', H.porch === false)}</span>`;
        if (K.dormers) opts += `<span class="og"><span>Dormers</span>${K.dormers.map(d => chip('dormers', d, H.style === 'gambrel' ? (d ? 'shed dormer' : 'none') : String(d), H.dormers === d)).join('')}</span>`;
        if (K.hoop && H.garage === 'door') opts += `<span class="og"><span>Hoop</span>${chip('hoop', true, 'on', H.hoop !== false)}${chip('hoop', false, 'off', H.hoop === false)}</span>`;
        if (K.pool) opts += `<span class="og"><span>Pool</span>${chip('pool', true, 'on', H.pool !== false, !fitsWith('pool', true), 'needs a wider lot')}${chip('pool', false, 'off', H.pool === false)}</span>`;
        opts += `<span class="og"><span>On the roof</span>${Object.entries(Y.SHOWS).map(([n, l]) => chip('show', n, l, (H.show ?? 'none') === n)).join('')}</span>`;
        if (Y.takesCar(H)) { const list = H.garage === 'carport' ? Y.CARS : Y.SHOWCARS; opts += `<span class="og"><span>${H.garage === 'carport' ? 'Carport' : 'Show car'}</span>${list.map(c => chip('car', c, c[0] + ' ' + c[1], JSON.stringify(H.car) === JSON.stringify(c))).join('')}</span>`; }
        opts += `<span class="og"><span>Frontage</span>${chip('nudge', -Y.CELL, '◀ left', false, !!H.legacy, 'built before the setback rules')}${chip('nudge', Y.CELL, 'right ▶', false, !!H.legacy, 'built before the setback rules')}</span>`; }
      tray.innerHTML = `<div class="tabs"><b style="color:#ffc21a;font:800 11px/1 'Arial Black'">THE HOUSE KIT</b><span class="hint">${H ? (H.legacy ? 'built before the setback rules · change anything and it refits' : 'drag the house along its green band · ← → nudge') : 'pick a house · greyed ones need a bigger lot'}</span></div><div class="cards">${cards}</div>${H ? `<div class="opts">${opts}</div>` : ''}`;
      return; }
    const tabs = [['fences', 'Fences'], ['paths', 'Paths'], ...Y.TAGS];
    let cards = '';
    if (E.ytab === 'fences') { cards = Object.entries(Y.EDGES).map(([k, e]) => `<button class="mb-c${E.tool?.kind === 'edge' && E.tool.k === k ? ' sel' : ''}" data-c="edge:${k}">${edgeSvg(k, E.tool?.k === k ? E.tool.c : undefined)}<span class="n">${esc(e.name)}</span><span class="k">${e.h ? e.h + ' m · click a run' : 'take a run away'}</span></button>`).join('');
      if (E.tool?.kind === 'edge' && Y.EDGES[E.tool.k].cols) cards += `<span class="og" style="align-self:center;display:flex;gap:4px;margin-left:6px"><span style="color:#9a9aa6;font:800 9px/1 'Arial Black'">PAINT</span>${Y.EDGES[E.tool.k].cols.map(c => sw('edgecol', c, c, E.tool.c === c, 'paint')).join('')}</span>`; }
    else if (E.ytab === 'paths') cards = [...Object.entries(Y.PATHS), ['erase', { name: 'Lift path', c: 0x57ae45 }]].map(([k, p]) => `<button class="mb-c${E.tool?.kind === 'path' && E.tool.m === k ? ' sel' : ''}" data-c="path:${k}"><span class="sw" style="background:${hex(p.c)};background-image:repeating-linear-gradient(90deg,transparent 0 22px,rgba(0,0,0,.12) 22px 25px)"></span><span class="n">${esc(p.name)}</span><span class="k">${k === 'drive' ? 'a car may park on it' : k === 'erase' ? 'back to lawn' : 'paint on the grid'}</span></button>`).join('');
    else cards = Object.entries(Y.YARD).filter(([, y]) => y.tag === E.ytab).map(([id, y]) => `<button class="mb-c${E.held?.it.id === id ? ' sel' : ''}" data-c="piece:${id}" title="${esc(y.name)} · curb appeal +${y.flex}${y.variants.length > 1 ? ` · ${y.variants.length} colours (C)` : ''}"><canvas width="204" height="128" data-th="${id}"></canvas><span class="n">${esc(y.name)}</span><span class="k">+${y.flex} curb appeal${y.variants.length > 1 ? ` · ${y.variants.length} looks` : ''}</span></button>`).join('');
    tray.innerHTML = `<div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button class="tab${E.ytab === k ? ' on' : ''}" data-t="${k}">${esc(n)}</button>`).join('')}<span class="hint">${E.held ? 'green: where it fits · R turn · C colour · Esc drop' : E.tool?.kind === 'edge' ? 'click a run round the lot' : E.tool?.kind === 'path' ? 'click or drag on the lawn · Esc stops' : 'click a piece in the yard to move it · or pick one here'}</span></div><div class="cards">${cards}</div>`;
    thumbQ.length = 0; for (const cv of tray.querySelectorAll('canvas[data-th]')) { const c = thumbs.get(cv.dataset.th); if (c) cv.getContext('2d').drawImage(c, 0, 0); else thumbQ.push({ id: cv.dataset.th, cv }); } }
  function edgeSvg(k, c) { const E2 = Y.EDGES[k], col = hex(c ?? E2.cols?.[0] ?? 0xfffaf0), h = 8 + E2.h * 22;
    const body = k === 'none' ? `<path d="M8 50h88" stroke="#9a9aa6" stroke-dasharray="4 4" stroke-width="2"/>` : E2.draw === 'hedge' ? `<rect x="6" y="${54 - h}" width="92" height="${h}" rx="6" fill="#2fa84f"/><rect x="6" y="${54 - h}" width="92" height="5" rx="3" fill="#3cbc5a"/>`
      : E2.draw === 'picket' ? Array.from({ length: 12 }, (_, i) => `<path d="M${10 + i * 7.6} 54v-${h - 3}l2.5-3 2.5 3v${h - 3}z" fill="#fffaf0" stroke="#c9c3b6"/>`).join('') + `<rect x="8" y="${54 - h * .7}" width="88" height="2.5" fill="#fffaf0"/>`
      : `<rect x="6" y="${54 - h}" width="92" height="${h}" fill="${col}"/>` + Array.from({ length: 11 }, (_, i) => `<rect x="${12 + i * 8}" y="${54 - h}" width="1.5" height="${h}" fill="rgba(0,0,0,.14)"/>`).join('');
    return `<svg viewBox="0 0 104 64" aria-hidden="true"><rect y="54" width="104" height="10" fill="#57ae45"/>${body}</svg>`; }
  // the tray's thumbnails: each piece drawn once with the page's renderer into a small target (two a frame), as the city builder does
  let th = null;
  function pumpThumbs() { if (!thumbQ.length) return; th ??= (() => { const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8070, 2.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 4, 3); sc.add(dl);
      const rt = new THREE.WebGLRenderTarget(204, 128); rt.texture.colorSpace = THREE.SRGBColorSpace; return { sc, rt, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 80), buf: new Uint8Array(204 * 128 * 4), img: new ImageData(204, 128) }; })();
    const keep = { rt: renderer.getRenderTarget(), cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha(), nu: renderer.shadowMap.needsUpdate };
    try { renderer.setClearColor(0xdff1ff, 1);
      for (let n = 0; n < 2 && thumbQ.length; n++) { const { id, cv } = thumbQ.shift(); if (!cv.isConnected) continue; const g = pieceGroup({ id, v: 0, r: 0 }); g.position.set(0, 0, 0); th.sc.add(g);
        const bx = new THREE.Box3().setFromObject(g), c = bx.getCenter(new THREE.Vector3()), sz = bx.getSize(new THREE.Vector3()), R0 = Math.max(sz.x, sz.y, sz.z) * .62 + .02;
        th.cam.left = -R0 * 1.6; th.cam.right = R0 * 1.6; th.cam.top = R0; th.cam.bottom = -R0; th.cam.position.copy(c).add(new THREE.Vector3(1.6, 1.3, 2.2).multiplyScalar(R0 * 4)); th.cam.lookAt(c); th.cam.far = R0 * 30; th.cam.updateProjectionMatrix();
        renderer.setRenderTarget(th.rt); renderer.render(th.sc, th.cam); renderer.readRenderTargetPixels(th.rt, 0, 0, 204, 128, th.buf); g.removeFromParent();
        for (let y = 0; y < 128; y++) th.img.data.set(th.buf.subarray((127 - y) * 204 * 4, (128 - y) * 204 * 4), y * 204 * 4); cv.getContext('2d').putImageData(th.img, 0, 0);
        const kc = document.createElement('canvas'); kc.width = 204; kc.height = 128; kc.getContext('2d').putImageData(th.img, 0, 0); thumbs.set(id, kc); } }
    finally { renderer.setRenderTarget(keep.rt); renderer.setClearColor(keep.cc, keep.ca); renderer.shadowMap.needsUpdate = keep.nu; } }

  // ── the URL: ?plot=<id> selects it, &build=1 opens the builder (the owner), &visit=1 the street view
  { const id = Q.get('plot'), q = id && PL.get(id); if (q) { select(q, !Q.has('build') && !Q.has('visit')); if (Q.has('build') && isOwner(q.P)) startBuild(q.P); else if (Q.has('visit')) visit(q.P); } }

  // (debug and shots: tools drive the builder through this; nothing in the page calls it)
  const api = {
    get mode() { return mode; }, get sel() { return sel?.P.id ?? null; }, lot: () => E ? clone(E.lot) : sel ? clone(lotOf(sel.P)) : null, saved: () => SV.ids(),
    select: id => select(PL.get(id) ?? null), build: () => sel && startBuild(sel.P), visit: id => { const q = PL.get(id); select(q, false); visit(q.P); }, done: () => done(), tab: setTab, ytab: t => { E.ytab = t; refreshTray(); },
    style: pickStyle, opt: setOpt, nudge, moveHouse: hx => { const H = E.lot.house, b = Y.fitBand(E.poly, H); setHouse({ ...H, hx: Math.max(b.lo, Math.min(b.hi, hx)) }, 'move the house'); }, band: () => E?.lot.house && Y.fitBand(E.poly, E.lot.house),
    edgeTool: (k, c) => { E.ytab = 'fences'; E.tool = { kind: 'edge', k, c: c ?? Y.EDGES[k].cols?.[0] }; refreshTray(); }, setRun, pathTool: m => { E.ytab = 'paths'; E.tool = { kind: 'path', m }; drawTiles(); refreshTray(); },
    paint: cells => { E.paint = { lot: clone(E.lot), n: 0 }; for (const [x, z] of cells) paintAt(x + .25, z + .25); const p = E.paint; E.paint = null; if (p.n) commit(E.tool.m === 'erase' ? 'erase path' : Y.PATHS[E.tool.m].name, p.lot); return p.n; },
    hold: (id, v) => fromTray(id, v), held: () => E?.held ? { id: E.held.it.id, cands: E.held.cands.length, cur: E.held.cur && { x: E.held.cur.x, z: E.held.cur.z } } : null, aim: (x, z) => aimAt(x, z), drop, turn, recolour, remove, undo, redo, cancel,
    save: () => autosave(true), exportJSON, importJSON, reset, inside: () => goInside((E ?? sel).P),
    screen: (lx, ly, lz) => { const P = (E ?? sel).P; return screenOf(P, lx, ly, lz); }, runPoint: k => { const [a, b] = Y.runsOf(E.poly, hf())[k]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; },
    // (walk mode, walk.js: a house's front door in world metres, the way out, and going in by the same hook as the card's Go inside)
    doorOf: id => { const q = PL.get(id); if (!q) return null; const H = lotOf(q.P).house; if (!H) return null; const dz = Y.doorZone(H);
      const f = Y.houseRects(H).reduce((a, r) => r[3] > a[3] ? r : a), lx = dz ? (dz[0] + dz[2]) / 2 : (f[0] + f[2]) / 2, lz = dz ? dz[1] : f[3], [x, z] = W(q.P, lx, lz), [ox, oz] = W(q.P, lx, lz + 1);
      return { id, x, z, out: [ox - x, oz - z], addr: addr(q.P), owner: ownerOf(q.P), mine: isOwner(q.P) }; },
    enter: id => { const q = PL.get(id); if (q) goInside(q.P); },
    cands: () => E?.held ? E.held.cands.map(c => [c.x, c.z]) : [], houseReady: () => !!E && houseG.children.length > 0 && houseG.userData.sig === houseSig(E.lot.house), flex: id => Y.flexRead(lotOf(PL.get(id).P)) };
  window.__mlb = api; return api;
}
