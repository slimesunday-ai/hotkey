// AI City · MAINLAND INTERIORS (2026-10-06) · "go inside" for a Mainland house: openMainlandInterior() opens the house's own floor plan
// (interiors/home/assemblies/mainland-<style>.json, sized to the house kit's footprint) in an interior view over the Mainland page, with
// the SAME home builder as the city (builder.js): EDIT for the owner, a read-only VISIT for anyone else. Saves per plot through saved.js
// under the key mainland:<plotId>. Main thread (three + DOM); room.js builds the room as it does for a city home.
//   Why an overlay and not a cutaway in place: the Mainland bakes every house into merged banks with plain materials (no gpu.js CUT), so
//   one house's roof and front wall can't be cut away without touching the Mainland's code. The interior gets its own canvas, scene,
//   camera and orbit controls over the page; the page keeps its scene (pause your own loop in onOpen if you like, resume in onClose).
//   openMainlandInterior({ plotId, houseSpec, owner, container, night, title, wealth, sec, onOpen, onClose }) → Promise<handle>
//     plotId     the plot's id (plots.json): the save key is `mainland:<plotId>`
//     houseSpec  the lot's spec as mainland/main.js builds it: { style, wall, car: { id, v }, seed, glass … } (style picks the layout;
//                wall tints the walls; car parks in the garage's bay)
//     owner      true (the viewer owns it: EDIT), false (VISIT), or { handle, you } (the handle shown; you → EDIT)
//     container  where the view mounts (default document.body); it covers the viewport (position: fixed)
//     resident   (HOME LIFE, 2026-10-06) true (default): the house's agent lives in it (life.js: a cast look seeded by the plot, or `look`,
//                the owner's character), going about its day between the furniture; asleep at night; re-plans round every edit
//   handle: { plotId, key, mode ('visit' | 'edit'), ready, edit(), close(), layout(), builder (debug, while editing), view (scene, camera,
//            renderer, controls), life (the resident's debug API: state(), go(act), setNight(on)), pause(on) / advance(s) (shots: a still loop
//            stepped by hand) }
import * as THREE from 'three';
import * as SV from './saved.js';
import { mainlandLayout } from './assign.js';

const C4 = .25, Z = 4;   // a cell (m) · the view's z-index (under the builder's bar and tray, over the page)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hex = n => (typeof n === 'number' ? n : parseInt(String(n ?? '').replace('#', ''), 16) || 0).toString(16).padStart(6, '0');
const seedOf = id => (String(id).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) & 0xffff) || 1;
const STYLE_NAME = { springfield: 'the Springfield', trophy: 'the Trophy House', cape: 'the Cape', porch: 'the Gable-Front', ranch: 'the Ranch', gambrel: 'the Gambrel', slab: 'the Slab', butterfly: 'the Butterfly' };
const asm = new Map();
let mods = null, cssDone = false;

async function load() { if (mods) return mods; const [R, F, G, B, V, VW] = await Promise.all([import('./room.js'), import('./fill.js'), import('../../glue.js'), import('./builder.js'), import('../../vehicles/index.js'), import('./view.js')]);
  const MATS = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .1 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .85 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];
  return mods = { R, F, G, B, V, VW, MATS }; }
const layoutOf = async name => { if (!asm.has(name)) asm.set(name, await fetch(new URL(`../home/assemblies/${name}.json`, import.meta.url)).then(r => { if (!r.ok) throw new Error(`mainland interior: no layout ${name}`); return r.json(); })); return structuredClone(asm.get(name)); };

function css() { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = `
.mli { position: fixed; inset: 0; z-index: ${Z}; background: #9fdcff; }
.mli canvas { display: block; width: 100%; height: 100%; touch-action: none; }
.mli-ov { position: absolute; left: 14px; bottom: 14px; width: min(360px, calc(100vw - 28px)); box-sizing: border-box; background: #17171b; color: #f7f7f2; box-shadow: 5px 5px 0 #ffc21a; font: 600 12px/1.35 "Arial Black", Impact, sans-serif; padding: 12px 14px; }
.mli-ov h3 { margin: 0 30px 4px 0; font: 800 17px/1.1 "Arial Black", Impact, sans-serif; color: #ffc21a; text-transform: uppercase; letter-spacing: .02em; }
.mli-ov .t { color: #9fdcff; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; } .mli-ov .o { margin: 8px 0 4px; font-size: 14px; } .mli-ov .o i { font-style: normal; color: #6cff4a; }
.mli-ov .row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; } .mli-ov .row b { background: #f7f7f2; color: #17171b; padding: 3px 6px 2px; font: 800 10px/1.2 "Arial Black", sans-serif; text-transform: uppercase; }
.mli-ov .row b span { color: #7a5a00; } .mli-ov .row b.g { background: #ffc21a; } .mli-ov .row b.v { background: #2f5bff; color: #fff; } .mli-ov .k { color: #9a9aa6; font-size: 10px; text-transform: uppercase; margin-top: 8px; }
.mli-ov .nav { display: flex; gap: 6px; margin-top: 10px; } .mli-ov button { font: 800 11px/1 "Arial Black", sans-serif; text-transform: uppercase; border: 0; background: #f7f7f2; color: #17171b; padding: 8px 10px 7px; min-height: 32px; cursor: pointer; box-shadow: 2px 2px 0 #ff4fa3; touch-action: manipulation; }
.mli-ov button:hover { background: #ffc21a; } .mli-ov button:focus-visible { outline: 3px solid #ff4fa3; outline-offset: 2px; } .mli-ov .x { position: absolute; right: 10px; top: 10px; box-shadow: none; padding: 6px 8px 5px; min-height: 0; }
.mli-ov button.go { background: #6cff4a; }
body.hb-editing .mli-ov { visibility: hidden; }
@media (max-width: 640px) { .mli-ov { left: 8px; bottom: 8px; width: calc(100vw - 16px); } }`; document.head.appendChild(s); }

export async function openMainlandInterior({ plotId, houseSpec = {}, owner = false, container = document.body, night = false, title, wealth = .85, sec = [], onOpen, onClose, resident = true, look = null } = {}) {
  if (plotId == null) throw new Error('openMainlandInterior: plotId is required');
  const M = await load(), style = houseSpec.style ?? 'springfield', name = mainlandLayout(style), key = 'mainland:' + plotId, tier = 'mainland';
  const mine = owner === true || !!owner?.you, handle0 = typeof owner === 'object' && owner ? owner.handle : null, seed = (houseSpec.seed ?? seedOf(key)) & 0xffff || 1;
  css();
  // ── the view: its own canvas over the page. (INTERIOR VIEW ART PASS, 2026-10-06: view.js dresses it as a game's home view — the house's
  // real lot round the cutaway, the neighbours and the street, the city's sky, light, shadows and post stack, a lower three-quarter camera)
  const root = document.createElement('div'); root.className = 'mli'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Inside the house'); container.appendChild(root);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.toneMapping = THREE.NeutralToneMapping;
  root.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .1, 420);
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js'), controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .1; controls.screenSpacePanning = true;
  const stage = M.VW.createStage({ renderer, scene, camera, controls, night, plotId, houseSpec, MATS: M.MATS, geoOf: M.G.geoOf });
  const size = () => { const r = root.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size(); const ro = new ResizeObserver(size); ro.observe(root);
  // ── the house: its layout (saved, else the style's preset), its slots filled, the car in the bay
  const A0 = await layoutOf(name), wallHex = houseSpec.wall != null ? hex(houseSpec.wall) : null;
  if (wallHex) { A0.room.walls = { ...A0.room.walls, E: 'paint:#' + wallHex }; for (const b of A0.room.built ?? []) if (b.kind === 'wall' && !b.paint) b.paint = '#' + wallHex; }   // (the house's own colour inside)
  const car = houseSpec.car ? M.V.vehicleProp(houseSpec.car.id, { variant: houseSpec.car.v | 0, kind: 'car' }) : null;
  const auto = M.F.fillsFor(A0, { tier, wealth, sec: new Set(sec), seed });
  let cur = null, decor = null, editor = null, raf = 0, closed = false, life = null, lastT = 0, paused = false;
  const fillsOf = L => (L.slots ?? []).map((s, i) => s.fill !== undefined ? s.fill : auto[i] ?? null);
  function build() {
    const rec = SV.load(key, tier), A = rec?.layout ? { ...rec.layout, room: A0.room } : A0, fills = rec ? A.slots.map((s, i) => s.fill !== undefined ? s.fill : auto[i] ?? null) : auto;
    const S = { W: A.room.w * C4, D: A.room.d * C4, H: A.room.h ?? 2.8, band: .2, ceiling: false, night, lightsOn: night, sec: [...sec], scars: [], fills, bare: false, forRent: false, asleep: false, seed, tier, car,
      art: { siding: wallHex ? parseInt(wallHex, 16) : null, stub: .45 } };   // (art pass: two-sided walls, room finishes, windows, the cut-down front)
    const res = M.R.buildRoom(A, S), g = new THREE.Group(); g.name = 'mainland-interior'; g.position.set(-res.W / 2, 0, -res.D / 2);
    res.bank.L.forEach((O, li) => { if (O.v) { const m = new THREE.Mesh(M.G.geoOf(O), M.MATS[li]); m.castShadow = li !== 3; m.receiveShadow = true; g.add(m); } });
    return { A, A0, fills, auto, S, res, g, rec, st: { owner: handle0 } }; }
  function frame() { stage.frame(cur); }
  function show() { if (cur) { cur.g.removeFromParent(); cur.g.traverse(m => m.geometry?.dispose()); }
    cur = build(); scene.add(cur.g); stage.setRoom(cur);   // (art pass: the lot, contacts, pools and lamps follow the room)
    cur.g.updateMatrixWorld(true); decor?.dispose(); decor = M.B.decorate({ e: cur, camera, renderer, visitor: !mine });   // (home life: this sat inside the comment above, so visits had no LOCKED badges or showcase brackets)
    life?.setLayout(cur.A, cur.fills, cur.res, cur.g.position);
    cur.flex = M.B.flexOf([...cur.A.items.map(it => it.id), ...cur.fills.filter(Boolean).map(f => f.id)]); overlay(); }
  // ── the overlay: whose house, the style, the flex; EDIT HOME for the owner, × to leave
  const ov = document.createElement('div'); ov.className = 'mli-ov'; root.appendChild(ov);
  function overlay() { const t = title ?? (houseSpec.address ? `${houseSpec.address.number} ${houseSpec.address.street}` : `Plot ${plotId}`);
    const who = mine ? `<i>${handle0 ? '@' + esc(handle0) : 'you'}</i> · home` : handle0 ? `<i>@${esc(handle0)}</i>` : '<i>a collector</i>';
    ov.innerHTML = `<button class="x" data-a="x" aria-label="Leave the house">×</button><h3>${esc(t)}</h3><div class="t">the mainland · ${esc(STYLE_NAME[style] ?? style)}</div><div class="o">${who}</div>
<div class="row">${mine ? `<b class="g">your home</b>${cur.rec ? '<b>edited</b>' : ''}` : `<b class="v">visiting · read-only</b>${decor?.badges ? '<b>stash + safe locked</b>' : ''}`}</div>
<div class="k">flex</div><div class="row">${M.B.flexHTML(cur.flex)}</div><div class="nav">${mine ? '<button class="go" data-a="edit">edit home</button>' : ''}<button data-a="x">leave the house</button></div>`; }
  ov.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; ev.stopPropagation(); if (b.dataset.a === 'edit') edit(); else close(); });
  function edit() { if (!mine || editor?.active || closed) return false; decor?.hide(true);
    editor = M.B.createEditor({ api: { scene, camera, renderer, controls }, h: { id: key, tier }, e: cur, mods: { R: M.R, MATS: M.MATS }, title: (ov.querySelector('h3')?.textContent || key) + ' · the mainland',
      preset: { A: A0, fills: auto }, onExit: () => { if (!closed) show(); }, onChange: () => { if (life && editor?.active) { const L = editor.debug.layout(); life.setLayout(L, fillsOf(L)); } } });
    editor.enter(); H.builder = editor.debug; return true; }
  const onKey = ev => { if (ev.key === 'Escape' && !editor?.active && !closed) { ev.preventDefault(); close(); } };
  addEventListener('keydown', onKey);
  function tick(dt, t) { controls.update(); if (decor && !editor?.active) decor.update(t); if (life) { life.held(editor?.active ? editor.debug.held?.id ?? null : null); life.update(dt); } stage.tick(dt, life, !!editor?.active); stage.render(t); }
  function loop(t) { raf = requestAnimationFrame(loop); const dt = lastT ? (t - lastT) / 1000 : 0; lastT = t; if (!paused) tick(dt, t); }
  function close() { if (closed) return; if (editor?.active) editor.exit(); closed = true; cancelAnimationFrame(raf); removeEventListener('keydown', onKey); ro.disconnect(); decor?.dispose(); life?.dispose(); life = null; controls.dispose(); stage.dispose();
    scene.traverse(m => { m.geometry?.dispose(); }); renderer.dispose(); renderer.forceContextLoss?.(); root.remove(); onClose?.(); }
  show(); frame(); onOpen?.(); raf = requestAnimationFrame(loop);
  // ── HOME LIFE: the resident, loaded after the room shows (one look baked on the main thread, ~0.1 s)
  const lifeReady = !resident ? Promise.resolve(null) : import('./life.js').then(({ createLife }) => closed ? null : createLife({ parent: scene, origin: cur.g.position, A: cur.A, fills: cur.fills, room: cur.res,
      seed: seedOf(key), look, night, dom: root, camera, renderer })).then(l => { if (!l) return null; if (closed) { l.dispose(); return null; } life = l; return l; }).catch(e => { console.error('home life:', e); return null; });
  const H = { plotId, key, style, layoutName: name, get mode() { return editor?.active ? 'edit' : 'visit'; }, get mine() { return mine; }, edit, close, layout: () => editor?.active ? editor.debug.layout() : cur.A,
    builder: null, view: { scene, camera, renderer, controls, root, stage }, get ready() { return stage.ready; }, stats: () => ({ tris: cur.res.bank.tris?.(), pieces: cur.res.pieces.length, W: cur.res.W, D: cur.res.D, view: stage.stats(), calls: renderer.info.render.calls, frameTris: renderer.info.render.triangles }),
    get life() { return life; }, lifeReady, pause: on => { paused = !!on; }, advance: (sec, step = 1 / 60) => { for (let s = 0; s < sec - 1e-6; s += step) { if (life) { life.held(editor?.active ? editor.debug.held?.id ?? null : null); life.update(Math.min(step, sec - s)); } } tick(0, performance.now()); } };
  return H;
}
