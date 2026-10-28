// AI City · HOME BUILDER v1 (2026-10-06) · "A/C": Animal Crossing-simple placement with a Habbo-style meaning layer, inside the home
// cutaway (no separate build world). index.js loads this module when a home opens, never before; nothing here runs while no home is open.
//   EDIT (the owner)   createEditor(ctx).enter(): the room re-drawn piece by piece over its shell. Click a piece to pick it up, click to put
//                      it down (or press, drag, release); R turns it (90° steps), Delete sends it to the inventory, Ctrl/⌘+Z undo, ⇧ redo,
//                      Esc drops what you hold / leaves. Valid spots light up on the right layer (floor · wall · surface top · ceiling) on
//                      the 0.25 m grid; an invalid spot never lights and the held piece never goes there (no fail state). The live test is
//                      the homes check itself (interiors/home/rules.js: overlaps, support, walls, the door and its swing, the walk path, room
//                      for the sim's safe and dog), run on the whole layout for every candidate cell when a piece is picked up or turned.
//                      Base pieces go anywhere valid; gear, collectibles and trophies go into the layout's slots (`fits`), as FORMAT.md says.
//   INVENTORY          a tray of the owner's pieces: PLACEHOLDER — the tier's catalogue plus the slots' demos, one of each, until the sim has
//                      real inventories. Each card shows rarity and kind (the game block); gear says its buff, this season's gear only.
//   SAVE               every change saves the layout per home id in localStorage (saved.js; the assembly format plus each slot's `fill`),
//                      undo/redo, Export / Import JSON; an unchanged home stores nothing (the default stays the assembly). saved.js REMOTE
//                      is the marked hook for saving to the sim or a server later.
//   CLEAR ROOM         (2026-10-06) one button: every placed piece and every slot's piece back to the inventory in one undoable step, the
//                      room shell left. The fixed fixtures stay by default (the kitchen and the bath: toilet, sink, tub, counter, stove,
//                      fridge), and so do the building's own (door, windows, radiator) and any piece holding a slot (a built-in shelf);
//                      CLEAR ALL takes the fixtures too. No confirm: undo is the safety. A cleared room fails the tier's minimums (no bed,
//                      no seat) and that is allowed; placement stays valid (nothing moves, pieces only leave).
//   VISIT (C)          decorate(): someone else's home is read-only; the stash, safes and stash spots show closed with a LOCKED badge (never
//                      openable); trophies and displayed wardrobe pieces get a showcase bracket; flexOf(): the crib value and rarest pieces.
import * as THREE from 'three';
import * as HO from '../home/index.js';
import { makeRules, fitsSlot, C4, CATALOGUE } from '../home/rules.js';
import { Bank, meshVol } from '../../vox.js';
import { geoOf } from '../../glue.js';
import * as SV from './saved.js';

const RULES = makeRules(HO);
export const RANK = { common: 0, event: 1, rare: 1, epic: 2, grail: 3, legendary: 4, '1of1': 5 };
const RCOL = { common: '#c9c9d1', rare: '#4f9dff', event: '#ff8a1a', epic: '#b24bff', grail: '#ffc21a', legendary: '#ff4fa3', '1of1': '#6cff4a' };
const FIXED = new Set(['door-front', 'window', 'ac-window', 'radiator', 'wall-panelling']);   // the building's own: the street sees the same unit
const NOT_OWNED = new Set(['sign-rent', 'door-front', 'window', 'ac-window', 'radiator', 'wall-panelling']);   // never in an owner's tray
const WARDROBE = new Set(['streetwear-rack', 'sneaker-wall', 'sneaker-rack', 'sneaker-boxes', 'cap-wall', 'chain-bust', 'watch-box', 'jersey-frame', 'mirror-lean']);
export const isLocked = o => !!o && (o.sim === 'safe' || o.sim === 'stash' || o.cat === 'stash');
export const isShowcase = o => !!o && (o.game?.kind === 'trophy' || WARDROBE.has(o.id));
const stakes = o => !!o?.game && o.game.kind !== 'base';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rname = r => r === '1of1' ? '1 of 1' : r;
const norm = list => list.map(e => e.replace(/#\d+/g, '#').replace(/slot \d+/g, 'slot'));
const normN = list => norm(list).map(e => e.replace(/\d+(\.\d+)?/g, 'n'));   // (counts too: a room already short of rugs may lose another)
const KEEP_CATS = new Set(['kitchen', 'bath']);   // CLEAR ROOM keeps these by default: the fixed fixtures (toilet, sink, tub, counter, stove, fridge)
const BUFF = { burgleOdds: 'burgle odds', safeTake: 'safe take', stashTake: 'stash take', heatDecay: 'heat decay ×', crib: 'crib +', cook: 'cooks:', secure: '' };
const buffText = b => !b ? '' : Object.entries(b).filter(([k]) => k !== 'secure').map(([k, v]) => `${BUFF[k] ?? k} ${typeof v === 'number' && k !== 'heatDecay' && k !== 'crib' ? (v > 0 ? '+' : '') + (Math.abs(v) < 1 ? Math.round(v * 100) + '%' : v + '%') : v}`).join(' · ');
const lockSvg = '<svg viewBox="0 0 12 14" width="10" height="12" aria-hidden="true"><path d="M3 6V4a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="1" y="6" width="10" height="8" fill="currentColor"/></svg>';

// ── the shared look (the homes overlay's: ink panel, yellow and pink hard shadows, Arial Black)
let cssDone = false;
function css() { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = `
.hb-lock { position: fixed; z-index: 5; pointer-events: none; transform: translate(-50%, -100%); display: flex; gap: 4px; align-items: center; background: #17171b; color: #ffc21a; padding: 3px 6px 2px; font: 800 9px/1 "Arial Black", Impact, sans-serif; letter-spacing: .06em; box-shadow: 2px 2px 0 #e8232a; white-space: nowrap; }
.hb-lock[hidden], .hb-lab[hidden] { display: none; }
.hb-lab { position: fixed; z-index: 6; pointer-events: none; transform: translate(-50%, -50%); background: rgba(23,23,27,.86); color: #ffc21a; padding: 3px 6px 2px; font: 800 9px/1.1 "Arial Black", Impact, sans-serif; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; border: 1px solid #ffc21a; }
.hb-lab.on { background: #ffc21a; color: #17171b; } .hb-lab.off { opacity: .35; }
#hb-bar, #hb-tray { position: fixed; z-index: 7; background: #17171b; color: #f7f7f2; font: 600 12px/1.3 "Arial Black", Impact, sans-serif; }
#hb-bar { top: 12px; left: 50%; transform: translateX(-50%); width: max-content; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 10px; box-shadow: 4px 4px 0 #ffc21a; max-width: calc(100vw - 32px); box-sizing: border-box; }
#hb-bar .t { color: #ffc21a; font: 800 13px/1.1 "Arial Black", Impact, sans-serif; text-transform: uppercase; margin-right: 4px; white-space: nowrap; }
#hb-bar .t small { display: block; color: #9fdcff; font-size: 9px; letter-spacing: .05em; }
#hb-bar .sep { width: 1px; align-self: stretch; background: #34343c; margin: 0 2px; }
#hb-bar .st { color: #6cff4a; font-size: 10px; text-transform: uppercase; min-width: 52px; }
#hb-bar .flex { font-size: 10px; text-transform: uppercase; color: #9a9aa6; } #hb-bar .flex b { color: #ffc21a; }
.hb-b { font: 800 11px/1 "Arial Black", sans-serif; text-transform: uppercase; border: 0; background: #f7f7f2; color: #17171b; padding: 8px 9px 7px; min-height: 32px; cursor: pointer; box-shadow: 2px 2px 0 #ff4fa3; touch-action: manipulation; }
.hb-b:hover { background: #ffc21a; } .hb-b:focus-visible { outline: 3px solid #ff4fa3; outline-offset: 2px; } .hb-b:disabled { opacity: .3; cursor: default; background: #f7f7f2; }
.hb-b.go { background: #6cff4a; } .hb-b.k kbd { font: inherit; color: #7a5a00; margin-left: 4px; }
.hb-split { display: inline-flex; gap: 0; } .hb-split .hb-b:first-child { box-shadow: 2px 2px 0 #e8232a; } .hb-b.sub { background: #34343c; color: #f7f7f2; padding-left: 7px; padding-right: 7px; box-shadow: 2px 2px 0 #e8232a; margin-left: 2px; } .hb-b.sub:hover { background: #e8232a; }
#hb-tray { left: 12px; right: 12px; bottom: 12px; padding: 8px 10px 10px; box-shadow: 5px 5px 0 #ff4fa3; }
#hb-tray .tabs { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 7px; }
#hb-tray .tab { font: 800 10px/1 "Arial Black", sans-serif; text-transform: uppercase; border: 0; background: #34343c; color: #c9c9d1; padding: 7px 8px 6px; cursor: pointer; touch-action: manipulation; }
#hb-tray .tab.on { background: #ffc21a; color: #17171b; } #hb-tray .tab i { font-style: normal; color: #9a9aa6; margin-left: 3px; } #hb-tray .tab.on i { color: #7a5a00; }
#hb-tray .hb-hint { margin-left: auto; color: #9a9aa6; font-size: 10px; text-transform: uppercase; }
#hb-tray .cards { display: flex; gap: 8px; overflow-x: auto; padding: 2px 4px 6px 2px; scroll-snap-type: x proximity; scrollbar-width: thin; }
.hb-c { flex: none; width: 108px; background: #f7f7f2; color: #17171b; border: 0; padding: 5px 5px 6px; text-align: left; cursor: pointer; box-shadow: 2px 2px 0 #34343c; scroll-snap-align: start; position: relative; touch-action: manipulation; font: inherit; }
.hb-c:hover { box-shadow: 2px 2px 0 #ff4fa3; } .hb-c.sel { outline: 3px solid #ffc21a; outline-offset: 1px; } .hb-c.na { opacity: .38; }
.hb-c canvas { display: block; width: 98px; height: 64px; background: #e9e5da; }
.hb-c .n { display: block; font: 800 10px/1.15 "Arial Black", sans-serif; text-transform: uppercase; margin: 4px 0 3px; height: 23px; overflow: hidden; }
.hb-c .r { display: inline-block; font: 800 8px/1 "Arial Black", sans-serif; text-transform: uppercase; padding: 2px 4px 1px; color: #17171b; margin-right: 3px; }
.hb-c .k { font: 700 8px/1 Arial, sans-serif; text-transform: uppercase; color: #55555f; }
.hb-c .q { position: absolute; right: 4px; top: 4px; background: #17171b; color: #f7f7f2; font: 800 9px/1 "Arial Black", sans-serif; padding: 2px 4px 1px; }
#hb-toast { position: fixed; z-index: 8; left: 50%; bottom: 196px; transform: translateX(-50%); background: #ffc21a; color: #17171b; font: 800 12px/1.2 "Arial Black", Impact, sans-serif; text-transform: uppercase; padding: 8px 12px 7px; box-shadow: 3px 3px 0 #17171b; pointer-events: none; max-width: calc(100vw - 40px); text-align: center; transition: opacity .25s; }
#hb-tip { position: fixed; z-index: 8; pointer-events: none; background: #17171b; color: #f7f7f2; font: 700 10px/1.25 Arial, sans-serif; padding: 5px 7px; box-shadow: 2px 2px 0 #ffc21a; transform: translate(14px, 14px); max-width: 240px; }
#hb-tip b { font: 800 11px/1.2 "Arial Black", sans-serif; text-transform: uppercase; color: #ffc21a; display: block; }
#hb-toast[hidden], #hb-tip[hidden] { display: none; }
@media (max-width: 640px) { #hb-bar { top: 8px; gap: 4px; padding: 6px; } #hb-bar .t { width: 100%; } .hb-b { padding: 8px 7px 7px; min-height: 36px; } .hb-b.k kbd { display: none; } #hb-tray { left: 8px; right: 8px; bottom: 8px; } #hb-tray .hb-hint { display: none; } #hb-toast { bottom: 178px; } }
@media (prefers-reduced-motion: reduce) { #hb-toast { transition: none; } }
body.hb-editing .ui, body.hb-editing .hint, body.hb-editing #camhud { visibility: hidden; }`; document.head.appendChild(s); }

// ── the meaning layer: crib value (the collectibles' buff.crib) and the rarest pieces in the home
export function flexOf(ids) { let crib = 0; const seen = new Set(), rare = [];
  for (const id of ids) { const o = HO.byId.get(id); if (!o?.game) continue; crib += o.game.buff?.crib ?? 0; if (o.game.kind !== 'base' && !seen.has(id)) { seen.add(id); rare.push(o); } }
  rare.sort((a, b) => (RANK[b.game.rarity] ?? 0) - (RANK[a.game.rarity] ?? 0) || (b.game.buff?.crib ?? 0) - (a.game.buff?.crib ?? 0));
  return { crib, rarest: rare.slice(0, 3) }; }
export const flexHTML = f => `<b class="g">crib ${f.crib}</b>` + f.rarest.map(o => `<b style="background:${RCOL[o.game.rarity] ?? '#f7f7f2'}">${esc(o.name)} <span>${esc(rname(o.game.rarity))}</span></b>`).join('');

// ── VISIT decor: showcase brackets on trophies and displayed wardrobe (both views), LOCKED badges on the stash and safes (visitors only)
export function decorate({ e, camera, renderer, visitor }) {
  css(); const g = e.g, badges = [], pos = [], plates = [], W = e.res.W, glow = new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: .35, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), PL = new THREE.PlaneGeometry(1, 1);
  for (const p of e.res.pieces ?? []) { const o = HO.byId.get(p.id); if (!o) continue; const [x0, y0, z0, x1, y1, z1] = p.box;
    if (isShowcase(o)) { const m = .04, a = [x0 - m, y0, z0 - m], b = [x1 + m, y1 + m, z1 + m], L = [.12, .12, .12].map((l, k) => Math.min(l, (b[k] - a[k]) * .35));
      for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) { const c = [cx ? b[0] : a[0], cy ? b[1] : a[1], cz ? b[2] : a[2]], d = [cx ? -1 : 1, cy ? -1 : 1, cz ? -1 : 1];
        for (let k = 0; k < 3; k++) { const q = [...c]; q[k] += d[k] * L[k]; pos.push(...c, ...q); } }
      // a gold plate: behind a wall piece, under anything else (the showcase's spotlight)
      const m2 = new THREE.Mesh(PL, glow); m2.renderOrder = 2; if (z0 < .02 && z1 - z0 < .4) { m2.position.set((x0 + x1) / 2, (y0 + y1) / 2, .012); m2.scale.set(x1 - x0 + .16, y1 - y0 + .16, 1); }
      else if (x1 > W - .02 && x1 - x0 < .4) { m2.position.set(W - .012, (y0 + y1) / 2, (z0 + z1) / 2); m2.rotation.y = Math.PI / 2; m2.scale.set(z1 - z0 + .16, y1 - y0 + .16, 1); }
      else { m2.position.set((x0 + x1) / 2, y0 + .008, (z0 + z1) / 2); m2.rotation.x = -Math.PI / 2; m2.scale.set(x1 - x0 + .18, z1 - z0 + .18, 1); } g.add(m2); plates.push(m2); }
    if (visitor && isLocked(o)) { const el = document.createElement('div'); el.className = 'hb-lock'; el.innerHTML = lockSvg + 'LOCKED'; el.title = o.name + ' · closed to visitors'; el.hidden = true; document.body.appendChild(el);
      badges.push({ el, at: new THREE.Vector3((x0 + x1) / 2, y1 + .08, (z0 + z1) / 2) }); } }
  let lines = null;
  if (pos.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffc21a, transparent: true, opacity: .95, depthWrite: false })); lines.renderOrder = 3; g.add(lines); }
  const v = new THREE.Vector3();
  return { badges: badges.length, show: pos.length / 144,
    update(t = performance.now()) { if (lines) lines.material.opacity = .62 + .33 * Math.sin(t / 380); glow.opacity = .46 + .16 * Math.sin(t / 380);
      if (!badges.length) return !!plates.length; const r = renderer.domElement.getBoundingClientRect();
      for (const b of badges) { v.copy(b.at).applyMatrix4(g.matrixWorld).project(camera); b.el.hidden = v.z > 1 || !g.parent; b.el.style.left = (r.left + (v.x + 1) / 2 * r.width) + 'px'; b.el.style.top = (r.top + (1 - v.y) / 2 * r.height) + 'px'; }
      return true; },
    hide(on) { for (const b of badges) b.el.style.visibility = on ? 'hidden' : ''; if (lines) lines.visible = !on; for (const m of plates) m.visible = !on; },
    dispose() { for (const b of badges) b.el.remove(); if (lines) { lines.removeFromParent(); lines.geometry.dispose(); lines.material.dispose(); } for (const m of plates) m.removeFromParent(); PL.dispose(); glow.dispose(); } };
}

// ── a tiny synthesized foley (no assets): the placement thunk, a pick-up tick, a turn click, a whoosh into the inventory
let AC = null, muted = false; try { muted = globalThis.localStorage?.getItem('aicity.builder.mute') === '1'; } catch {}
function sfx(kind) { if (muted) return; try { AC ??= new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  const P = { thunk: [150, 62, .16, .32], pick: [520, 760, .07, .12], turn: [880, 660, .05, .08], store: [420, 140, .18, .14], nope: [190, 170, .09, .1] }[kind] ?? [300, 300, .05, .05];
  o.type = kind === 'thunk' ? 'sine' : 'triangle'; o.frequency.setValueAtTime(P[0], t); o.frequency.exponentialRampToValueAtTime(P[1], t + P[2]);
  g.gain.setValueAtTime(P[3], t); g.gain.exponentialRampToValueAtTime(.0001, t + P[2] + .05); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + P[2] + .06);
  if (kind === 'thunk') { const n = AC.createBufferSource(), b = AC.createBuffer(1, 2200, AC.sampleRate), d = b.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length) ** 3;
    const f = AC.createBiquadFilter(), ng = AC.createGain(); f.type = 'lowpass'; f.frequency.value = 900; ng.gain.value = .22; n.buffer = b; n.connect(f).connect(ng).connect(AC.destination); n.start(t); } } catch {} }

// ── the editor's model: items with stable uids (a piece on a top points at its parent's uid, not an index), slots, fills, and back
let UID = 0;
function toModel(A, fills = []) {
  const uids = A.items.map(() => ++UID);
  const items = A.items.map((it, k) => { const m = { uid: uids[k], id: it.id, x: it.x, z: it.z, rot: it.rot ?? 0, variant: it.variant ?? 0 };
    if (it.on && it.on.top !== undefined) m.parent = uids[it.on.top]; else m.on = it.on ?? 'floor';
    for (const f of ['y', 'state', 'seed']) if (it[f] !== undefined) m[f] = it[f]; return m; });
  const slots = A.slots.map(s => { const { fill, ...d } = s, m = structuredClone(d); if (s.place === 'surface') { m.parent = uids[s.on]; delete m.on; } return m; });
  return { items, slots, fills: A.slots.map((s, i) => { const f = fills[i]; return f ? { id: f.id, variant: f.variant ?? 0, ...(f.state ? { state: f.state } : {}) } : null; }) };
}
function toAsm(base, M, withFills = true) {
  const idx = new Map(M.items.map((m, k) => [m.uid, k]));
  const items = M.items.map(m => { const it = { id: m.id, x: m.x, z: m.z, rot: m.rot, variant: m.variant, on: m.parent != null ? { top: idx.get(m.parent) } : m.on };
    for (const f of ['y', 'state', 'seed']) if (m[f] !== undefined) it[f] = m[f]; return it; });
  const slots = M.slots.map((s, i) => { const { parent, ...d } = s, o = { ...d }; if (parent != null) o.on = idx.get(parent); if (withFills) o.fill = M.fills[i] ?? null; return o; });
  return { ...base, items, slots };
}
const cloneM = M => ({ items: M.items.map(m => ({ ...m })), slots: M.slots.map(s => ({ ...s })), fills: M.fills.map(f => f && { ...f }) });
const rdims = (foot, rot) => (((rot ?? 0) / 90) & 3) & 1 ? [foot[1], foot[0]] : [foot[0], foot[1]];
// a piece on a parent (or a slot on it) follows the parent: its centre in the parent's own frame, put back with the parent's new pose
function carry(cx, cz, cfoot, crot, P0, P1, pfoot) {
  const [cw0, cd0] = rdims(cfoot, crot), [w, d] = pfoot, r0 = ((P0.rot / 90) & 3), r1 = ((P1.rot / 90) & 3), p0 = cx - P0.x + cw0 / 2, q0 = cz - P0.z + cd0 / 2;
  const [u, v] = [[p0, q0], [w - q0, p0], [w - p0, d - q0], [q0, d - p0]][r0];
  const [p, q] = [[u, v], [v, w - u], [w - u, d - v], [d - v, u]][r1];
  const rot = (((crot ?? 0) + (r1 - r0) * 90) % 360 + 360) % 360, [cw1, cd1] = rdims(cfoot, rot);
  return { x: Math.round(P1.x + p - cw1 / 2), z: Math.round(P1.z + q - cd1 / 2), rot };
}

// ── EDIT
// ctx: { api, h, e (the open home: A, fills, S, res, g), mods (room.js as R, MATS), title, preset: { A, fills }, onExit(changed), onChange() (after every
// change, undo and redo: home life re-plans round the moved furniture) }
export function createEditor(ctx) {
  const { api, h, e, mods, title, preset, onExit } = ctx, { scene, camera, renderer, controls } = api, canvas = renderer.domElement, tier = h.tier;
  const base = { ...e.A }; delete base.items; delete base.slots; delete base.fill;
  const seed0 = e.S?.seed ?? 1, R = e.A.room;
  let M = null, inv = null, held = null, hover = null, press = null, active = false, eg = null, D3 = null, raf = 0, last = 0, dirty = false, saveT = 0;
  const views = new Map(), geo = new Map(), anims = [], hist = { undos: [], redos: [] }, ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), V = new THREE.Vector3();
  const presetKey = () => JSON.stringify(toAsm(base, toModel(preset.A, preset.fills)));
  let ui = null, tiles = null, foot = null, slotTiles = null, slotLabs = [], tab = 'furniture', toastT = 0, ptr = null;
  const byUid = uid => M.items.find(m => m.uid === uid);
  const seedOf = m => m.seed ?? seed0 * 31 + (m.x ?? 0);
  // ── poses (room metres, as room.js stamps them): group position + turn, and the box
  function poseOf(m, o, MM = M) {
    const w = o.foot[0] * C4, d = o.foot[1] * C4, t = Math.max(.04, o.h);
    if (m.on && m.on.wall) { const y = m.y ?? o.mount, a = m.x * C4, hh = o.foot[1] * C4;
      return m.on.wall === 'N' ? { p: [D3.ox + a, y, 0], ry: 0, box: [D3.ox + a, y, 0, D3.ox + a + w, y + hh, t], c: [D3.ox + a + w / 2, y + hh / 2, .02], n: 'N' }
        : { p: [D3.W, y, a], ry: Math.PI * 1.5, box: [D3.W - t, y, a, D3.W, y + hh, a + w], c: [D3.W - .02, y + hh / 2, a + w / 2], n: 'E' }; }
    const r = ((m.rot ?? 0) / 90) & 3, X = D3.ox + m.x * C4, Z = m.z * C4, [rw, rd] = r & 1 ? [d, w] : [w, d];
    let y = 0; if (m.parent != null) { const P = MM.items.find(q => q.uid === m.parent); y = (P && HO.byId.get(P.id)?.tops?.[0]) ?? .5; } else if (m.on === 'ceiling') y = D3.H;
    const T = [[X, Z], [X, Z + w], [X + w, Z + d], [X + d, Z]][r], y0 = m.on === 'ceiling' ? D3.H - o.h : y;
    return { p: [T[0], y, T[1]], ry: r * Math.PI / 2, box: [X, y0, Z, X + rw, y0 + o.h, Z + rd], c: [X + rw / 2, m.on === 'ceiling' ? D3.H : y, Z + rd / 2], n: m.on === 'ceiling' ? 'C' : 'F' };
  }
  // a slot's piece sits centred in the slot, as room.js puts it
  function slotItem(s, o) { const [sw, sd] = s.foot, [ow, od] = o.foot, dx = s.place !== 'ceiling' ? Math.max(0, Math.floor((sw - ow) / 2)) : 0, dz = s.place === 'floor' || s.place === 'surface' ? Math.max(0, Math.floor((sd - od) / 2)) : 0;
    return { x: s.x + dx, z: s.z + dz, rot: s.rot ?? 0, y: s.y, on: s.place === 'wall' ? { wall: s.wall } : s.place === 'ceiling' ? 'ceiling' : 'floor', parent: s.place === 'surface' ? s.parent : undefined }; }
  // ── meshes: one geometry per look, shared by every copy
  function meshes(id, variant, state, seed) { const k = `${id}|${variant}|${state ?? ''}|${seed}`; let L = geo.get(k);
    if (!L) { const o = HO.byId.get(id), Vb = HO.buildObject(o, { variant, seed, state }), b = new Bank(true); meshVol(Vb, b); L = b.L.map((O, li) => O.v ? { g: geoOf(O), li } : null).filter(Boolean); geo.set(k, L); } return L; }
  function groupFor(id, variant, state, seed) { const G = new THREE.Group(); for (const { g, li } of meshes(id, variant, state, seed)) G.add(new THREE.Mesh(g, mods.MATS[li])); return G; }
  function setPose(v, P, snap) { v.to = P; if (snap || !v.at) { v.grp.position.set(...P.p); v.grp.rotation.y = P.ry; v.at = true; } }
  function sync(snapAll = true) {
    const keep = new Map(), put = (k, ref, id, variant, state, seed, P) => { let v = views.get(k); const sig = `${id}|${variant}|${state ?? ''}|${seed}`;
      if (!v || v.sig !== sig) { if (v) v.grp.removeFromParent(); v = { grp: groupFor(id, variant, state, seed), sig, ref }; v.grp.traverse(m => { m.userData.view = v; }); eg.add(v.grp); }
      v.ref = ref; v.box = P.box; v.o = HO.byId.get(id); setPose(v, P, snapAll); v.grp.visible = true; keep.set(k, v); };
    for (const m of M.items) { const o = HO.byId.get(m.id); if (o) put('i:' + m.uid, { t: 'item', uid: m.uid }, m.id, m.variant, m.state, seedOf(m), poseOf(m, o)); }
    M.fills.forEach((f, i) => { const o = f && HO.byId.get(f.id); if (o) put('s:' + i, { t: 'slot', i }, f.id, f.variant ?? 0, f.state, seed0 * 31 + 40 + i, poseOf(slotItem(M.slots[i], o), o)); });
    for (const [k, v] of views) if (!keep.has(k)) v.grp.removeFromParent();
    views.clear(); for (const [k, v] of keep) views.set(k, v);
    drawSlots(); }
  // ── the live validity test: the homes check's own rules on the whole layout, plus two the check leaves to the builder (ceiling pieces
  // and rugs don't overlap their own kind)
  function errsOf(A) { const g = RULES.geometry(A); RULES.simSpots(A, g); const E = g.E;
    const ceil = [], rugs = []; A.items.forEach((it, k) => { const o = HO.byId.get(it.id); if (!o) return; const [w, d] = rdims(o.foot, it.rot), rc = [it.x, it.z, w, d];
      const L = it.on === 'ceiling' ? ceil : o.cat === 'rugs' && (it.on === 'floor' || !it.on) ? rugs : null; if (!L) return;
      if (it.on === 'ceiling' && (it.x < 0 || it.z < 0 || it.x + w > A.room.w || it.z + d > A.room.d)) E.push(`#${k} ${it.id}: off the ceiling`);
      for (const q of L) if (rc[0] < q.rc[0] + q.rc[2] && rc[0] + rc[2] > q.rc[0] && rc[1] < q.rc[1] + q.rc[3] && rc[1] + rc[3] > q.rc[1]) E.push(`#${k} ${it.id} overlaps #${q.k} ${q.id}`);
      L.push({ k, id: it.id, rc }); });
    return E; }
  // the model with the held piece (and what rides on it) put at placement P
  function placed(M0, H, P) {
    const M1 = { items: M0.items, slots: M0.slots, fills: M0.fills };
    if (P.slot !== undefined) { M1.fills = M0.fills.slice(); M1.fills[P.slot] = { id: H.id, variant: H.variant, ...(H.state ? { state: H.state } : {}) }; return M1; }
    const m = { uid: H.uid ?? H.newUid, id: H.id, x: P.x, z: P.z, rot: H.rot, variant: H.variant, seed: H.seed };
    if (H.state !== undefined) m.state = H.state; if (P.parent != null) m.parent = P.parent; else m.on = P.on; if (P.y !== undefined) m.y = P.y;
    M1.items = [...M0.items, m];
    if (H.kids.length || H.kslots.length) { const P0 = H.orig, P1 = { x: P.x, z: P.z, rot: H.rot }, pf = H.o.foot;
      for (const k of H.kids) { const c = carry(k.x, k.z, HO.byId.get(k.id).foot, k.rot, P0, P1, pf); M1.items.push({ ...k, ...c }); }
      if (H.kslots.length) { M1.slots = M0.slots.slice(); for (const i of H.kslots) { const s = H.slotsAt[i], c = carry(s.x, s.z, s.foot, s.rot, P0, P1, pf); M1.slots[i] = { ...s, x: c.x, z: c.z, rot: c.rot }; } } }
    return M1; }
  // every valid placement for what is held, at its current turn: free spots (base pieces) and the slots it fits
  function candidates(H) {
    const t0 = performance.now(), o = H.o, out = [], M0 = H.M0, A0 = toAsm(base, M0, false), base0 = new Set(H.baseErr), [rw, rd] = rdims(o.foot, H.rot);
    const ok = P => { const M1 = placed(M0, H, P); return norm(errsOf(toAsm(base, M1, false))).every(x => base0.has(x)) ? M1 : null; };
    const push = (P, M1) => { const it = M1.items.find(m => m.uid === (H.uid ?? H.newUid)), Pz = poseOf(it, o, M1); out.push({ P, M1, c: Pz.c, n: Pz.n, box: Pz.box }); };
    if (!stakes(o)) {
      const g0 = RULES.geometry(A0), occ = new Set(), wall = [];
      for (const p of g0.solid) if (p.id !== 'lamp-arc') for (const [x, z, over] of p.cells) if (!over) occ.add(x + ',' + z);
      const blocks = [...g0.floorSlots.map(q => q.rc), ...(g0.doorRect ? [g0.doorRect] : [])];
      A0.items.forEach(it => { if (it.on?.wall && it.id !== 'wall-panelling') { const q = HO.byId.get(it.id); if (q) wall.push([it.on.wall, it.x, it.x + q.foot[0], it.y ?? q.mount, (it.y ?? q.mount) + q.foot[1] * C4]); } });
      const free = (x, z) => { if (o.cat === 'rugs' || o.id === 'lamp-arc') return true; for (let a = 0; a < rw; a++) for (let b = 0; b < rd; b++) if (occ.has((x + a) + ',' + (z + b))) return false;
        return !blocks.some(q => x < q[0] + q[2] && x + rw > q[0] && z < q[1] + q[3] && z + rd > q[1]); };
      if (o.place === 'floor') for (let z = 0; z + rd <= R.d; z++) for (let x = 0; x + rw <= R.w; x++) { if (!free(x, z)) continue; const P = { on: 'floor', x, z }, M1 = ok(P); if (M1) push(P, M1); }
      if (o.place === 'ceiling') for (let z = 0; z + rd <= R.d; z++) for (let x = 0; x + rw <= R.w; x++) { const P = { on: 'ceiling', x, z }, M1 = ok(P); if (M1) push(P, M1); }
      if (o.place === 'surface') for (const Pm of M0.items) { const po = HO.byId.get(Pm.id); if (!po?.tops?.length || Pm.parent != null || Pm.on?.wall || Pm.on === 'ceiling') continue;
        const [pw, pd] = rdims(po.foot, Pm.rot); for (let z = Pm.z; z + rd <= Pm.z + pd; z++) for (let x = Pm.x; x + rw <= Pm.x + pw; x++) { const P = { parent: Pm.uid, x, z }, M1 = ok(P); if (M1) push(P, M1); } }
      if (o.place === 'wall') { const hh = o.foot[1] * C4, H0 = R.h ?? 2.8, y0 = H.src === 'room' ? (H.orig.y ?? o.mount) : o.mount;   // (the grid steps from the piece's own height)
        for (const side of ['N', 'E']) { const len = side === 'N' ? R.w : R.d; for (let a = 0; a + o.foot[0] <= len; a++) for (let k = -12; k <= 12; k++) { const y = +(y0 + k * C4).toFixed(3); if (y < .05 || y + hh > H0 + 1e-6) continue;
          if (wall.some(q => q[0] === side && a < q[2] && a + o.foot[0] > q[1] && y < q[4] && y + hh > q[3])) continue; const P = { on: { wall: side }, x: a, z: 0, y }, M1 = ok(P); if (M1) push(P, M1); } } } }
    M0.slots.forEach((s, i) => { if (!fitsSlot(o, s) || H.kslots.includes(i)) return;
      const M1 = placed(M0, H, { slot: i }), Pz = poseOf(slotItem(s, o), o, M1); out.push({ P: { slot: i }, M1, c: Pz.c, n: s.place === 'wall' ? s.wall : 'S', box: Pz.box, slot: i }); });
    H.ms = performance.now() - t0; return out; }
  // ── pick up, aim, put down
  function startHold(H) { held = H; H.kids = H.kids ?? []; H.kslots = H.kslots ?? []; H.cands = candidates(H); H.cur = null;
    if (H.src === 'inv') { H.ghost = groupFor(H.id, H.variant, H.state, H.seed); H.ghost.visible = false; eg.add(H.ghost); }
    for (const v of heldViews()) v.lift = 1; drawTiles(); drawSlots(); setHover(null); refreshBar(); }
  function heldViews() { if (!held) return []; if (held.src === 'inv') return held.ghost ? [{ grp: held.ghost, ghost: true }] : [];
    const L = held.src === 'slot' ? [views.get('s:' + held.slot)] : [views.get('i:' + held.uid), ...held.kids.map(k => views.get('i:' + k.uid)), ...held.kslots.map(i => views.get('s:' + i))]; return L.filter(Boolean); }
  function pickUp(ref, ev) {
    if (ref.t === 'item') { const m = byUid(ref.uid), o = HO.byId.get(m.id); if (FIXED.has(m.id)) { toast(`${o.name}: part of the building`); sfx('nope'); return false; }
      const kids = M.items.filter(q => q.parent === m.uid), kslots = M.slots.map((s, i) => s.parent === m.uid ? i : -1).filter(i => i >= 0);
      const M0 = { items: M.items.filter(q => q.uid !== m.uid && q.parent !== m.uid), slots: M.slots, fills: M.fills };
      startHold({ src: 'room', uid: m.uid, id: m.id, o, variant: m.variant, state: m.state, seed: seedOf(m), rot: m.rot ?? 0, orig: { x: m.x, z: m.z, rot: m.rot ?? 0, on: m.on, parent: m.parent, y: m.y },
        kids: kids.map(k => ({ ...k })), kslots, slotsAt: M.slots, M0, baseErr: norm(errsOf(toAsm(base, M, false))) }); }
    else { const f = M.fills[ref.i], o = HO.byId.get(f.id), M0 = { items: M.items, slots: M.slots, fills: M.fills.slice() }; M0.fills[ref.i] = null;
      startHold({ src: 'slot', slot: ref.i, id: f.id, o, variant: f.variant ?? 0, state: f.state, seed: seed0 * 31 + 40 + ref.i, rot: M.slots[ref.i].rot ?? 0, M0, baseErr: norm(errsOf(toAsm(base, M, false))) }); }
    sfx('pick'); const cc = held.cands.find(q => sameSpot(q)); held.off = [0, 0];
    if (cc) { held.cur = cc; if (ev) { const c = screenOf(local(cc.c)); held.off = [c[0] - ev.clientX, c[1] - ev.clientY]; } }
    if (!held.cands.length) toast('no other spot fits it right now · Esc puts it back');
    return true; }
  const sameSpot = q => held.src === 'room' ? q.P.slot === undefined && q.P.x === held.orig.x && q.P.z === held.orig.z && held.rot === held.orig.rot && (q.P.parent ?? null) === (held.orig.parent ?? null)
    && JSON.stringify(q.P.on ?? null) === JSON.stringify(held.orig.parent != null ? null : held.orig.on ?? null) && (!q.P.on?.wall || Math.abs(q.P.y - (held.orig.y ?? held.o.mount)) < 1e-6) : held.src === 'slot' && q.P.slot === held.slot;
  function fromInventory(id) { const o = HO.byId.get(id); if (!o) return; if (held) cancel();
    const H = { src: 'inv', id, o, variant: 0, state: o.states?.[0], seed: seed0 * 31 + 500 + (++UID % 97), rot: 0, newUid: ++UID, M0: M, baseErr: norm(errsOf(toAsm(base, M, false))), off: [0, 0] };
    startHold(H); if (!H.cands.length) { const why = stakes(o) ? `no slot here takes a ${o.game.kind === 'trophy' ? 'trophy' : o.cat}` : 'no room for it right now'; cancel(); toast(why); sfx('nope'); return; }
    sfx('pick'); toast(stakes(o) ? 'gold spots take it · click one' : 'click a lit spot to put it down · R turns it'); refreshTray(); }
  const local = c => V.set(c[0], c[1], c[2]).applyMatrix4(eg.matrixWorld).clone();
  function screenOf(world) { const r = canvas.getBoundingClientRect(), p = world.clone().project(camera); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height, p.z]; }
  function aim() { if (!held || !ptr) return; const tx = ptr[0] + (held.off?.[0] ?? 0), ty = ptr[1] + (held.off?.[1] ?? 0); let best = null, bd = 1e9;
    for (const q of held.cands) { const s = screenOf(local(q.c)); if (s[2] > 1) continue; const d = Math.hypot(s[0] - tx, s[1] - ty) - (q === held.cur ? 6 : 0); if (d < bd) { bd = d; best = q; } }
    if (best && bd < 120 && best !== held.cur) { held.cur = best; preview(); } }
  function preview() { const q = held?.cur; if (!q) return; foot.visible = true; tileAt(foot, q, true);
    if (held.src === 'inv') { held.ghost.visible = true; const it = q.P.slot !== undefined ? slotItem(q.M1.slots[q.P.slot], held.o) : q.M1.items.find(m => m.uid === held.newUid), P = poseOf(it, held.o, q.M1); setPose(held.vg ??= { grp: held.ghost }, P, !held.vg.at); held.vg.lift = 1; return; }
    // a piece from the room: it and what rides on it go where the candidate puts them
    const M1 = q.M1, it = q.P.slot !== undefined ? slotItem(M1.slots[q.P.slot], held.o) : M1.items.find(m => m.uid === held.uid);
    const v = views.get(held.src === 'slot' ? 's:' + held.slot : 'i:' + held.uid); if (v) setPose(v, poseOf(it, held.o, M1));
    for (const k of held.kids) { const kv = views.get('i:' + k.uid), km = M1.items.find(m => m.uid === k.uid); if (kv && km) setPose(kv, poseOf(km, HO.byId.get(k.id), M1)); }
    for (const i of held.kslots) { const sv = views.get('s:' + i), f = M1.fills[i]; if (sv && f) setPose(sv, poseOf(slotItem(M1.slots[i], HO.byId.get(f.id)), HO.byId.get(f.id), M1)); } }
  function drop() { if (!held) return; const q = held.cur;
    if (!q) { if (held.src === 'inv') return toast('move onto a lit spot first'); return cancel(); }
    if (held.src !== 'inv' && sameSpot(q)) { const H = held; cancel(); return H; }
    const next = cloneM(q.M1), nInv = new Map(inv);
    if (held.src === 'inv') nInv.set(held.id, Math.max(0, (nInv.get(held.id) ?? 1) - 1));
    if (q.P.slot !== undefined) { const was = M.fills[q.P.slot]; if (was && !(held.src === 'slot' && held.slot === q.P.slot)) { nInv.set(was.id, (nInv.get(was.id) ?? 0) + 1); toast(`${HO.byId.get(was.id)?.name ?? was.id} back to the inventory`); } }
    const key = q.P.slot !== undefined ? 's:' + q.P.slot : 'i:' + (held.uid ?? held.newUid), H = held; endHold();
    commit(H.src === 'inv' ? 'add' : 'move', next, nInv); const v = views.get(key); if (v) thunk(v); sfx('thunk'); }
  function endHold() { if (!held) return; if (held.ghost) held.ghost.removeFromParent(); held = null; foot.visible = false; drawTiles(); drawSlots(); refreshBar(); refreshTray(); }
  function cancel() { if (!held) return; const src = held.src; endHold(); if (src !== 'inv') sync(false); }
  function rotate() {
    if (!held) { toast('pick a piece up first, then R turns it'); return; }
    if (held.o.place === 'wall') { toast('wall pieces always face the room'); sfx('nope'); return; }
    const was = held.rot, at = held.cur ? screenOf(local(held.cur.c)) : null;
    for (let k = 1; k <= 3; k++) { held.rot = (was + 90 * k) % 360; const C = candidates(held); if (C.length) { held.cands = C; held.cur = null;
      if (at) { let best = null, bd = 1e9; for (const q of C) { const s = screenOf(local(q.c)); const d = Math.hypot(s[0] - at[0], s[1] - at[1]); if (d < bd) { bd = d; best = q; } } held.cur = best; }
      drawTiles(); drawSlots(); preview(); sfx('turn'); return; } }
    held.rot = was; toast('no spot fits it turned'); sfx('nope'); }
  // the inventory: a piece (and what rides on it) leaves the room — unless the home check would then fail (the last bed, the last seat…)
  function store(ref) {
    let next = cloneM(M), nInv = new Map(inv), name = '';
    const r = ref ?? (held ? (held.src === 'room' ? { t: 'item', uid: held.uid } : held.src === 'slot' ? { t: 'slot', i: held.slot } : null) : hover?.ref);
    if (!r) { if (held?.src === 'inv') { cancel(); return; } toast('point at a piece to put it away'); return; }
    if (r.t === 'slot') { const f = M.fills[r.i]; if (!f) return; next.fills[r.i] = null; nInv.set(f.id, (nInv.get(f.id) ?? 0) + 1); name = HO.byId.get(f.id)?.name; }
    else { const m = byUid(r.uid), o = HO.byId.get(m.id); name = o?.name;
      if (FIXED.has(m.id)) { toast(`${name}: part of the building`); sfx('nope'); return; }
      if (M.slots.some(s => s.parent === m.uid)) { toast(`${name} holds a slot · move it instead`); sfx('nope'); return; }
      const gone = new Set([m.uid, ...M.items.filter(q => q.parent === m.uid).map(q => q.uid)]);
      for (const q of M.items) if (gone.has(q.uid)) nInv.set(q.id, (nInv.get(q.id) ?? 0) + 1); next.items = next.items.filter(q => !gone.has(q.uid));
      const before = new Set(normN(RULES.check(toAsm(base, M, false)).E)), after = normN(RULES.check(toAsm(base, next, false)).E).filter(x => !before.has(x));
      if (after.length) { toast(`keeps it: ${after[0].replace(/^#\s?/, '').replace(/^dressing: /, '')}`); sfx('nope'); return; } }
    endHold(); commit('store', next, nInv); sfx('store'); toast(`${name} → inventory`); }
  // ── CLEAR ROOM: what goes (every placed piece and slot piece) and what stays (the building, any slot's holder, and by default the
  // kitchen and bath); a piece riding on one that goes, goes with it
  function clearPlan(all) { const holds = new Set(M.slots.map(s => s.parent).filter(u => u != null));
    const stays = m => { const o = HO.byId.get(m.id); return FIXED.has(m.id) || holds.has(m.uid) || (!all && !!o && KEEP_CATS.has(o.cat)); };
    const next = cloneM(M), nInv = new Map(inv); let n = 0;
    next.items = next.items.filter(m => { const P = m.parent != null ? byUid(m.parent) : null, keep = stays(m) && (!P || stays(P)); if (!keep) { nInv.set(m.id, (nInv.get(m.id) ?? 0) + 1); n++; } return keep; });
    next.fills = next.fills.map(f => { if (f) { nInv.set(f.id, (nInv.get(f.id) ?? 0) + 1); n++; } return null; });
    const kept = next.items.filter(m => !FIXED.has(m.id) && !holds.has(m.uid)).length;
    return { next, nInv, n, kept }; }
  function clearRoom(all = false) { if (held) cancel(); const C = clearPlan(all);
    if (!C.n) { toast(all ? 'nothing left to clear' : 'nothing to clear · Clear all takes the kitchen and bath too'); sfx('nope'); return 0; }
    commit(all ? 'clear all' : 'clear room', C.next, C.nInv); sfx('store');
    toast(`${C.n} piece${C.n === 1 ? '' : 's'} → inventory${!all && C.kept ? ' · kept the kitchen + bath (Clear all takes them)' : ''} · undo brings ${C.n === 1 ? 'it' : 'them'} back`); return C.n; }
  // ── history (three.js editor pattern: small commands with execute / undo on a linear stack; each holds the state before and after)
  const snap = () => ({ M: cloneM(M), inv: [...inv] });
  function apply(S) { M = cloneM(S.M); inv = new Map(S.inv); if (held) endHold(); sync(false); refreshTray(); refreshBar(); dirty = true; autosave(); ctx.onChange?.(); }   // (onChange: home life re-plans)
  function commit(name, nextM, nextInv) { const before = snap(), after = { M: cloneM(nextM), inv: [...nextInv] };
    const cmd = { name, execute: () => apply(after), undo: () => apply(before) }; cmd.execute(); hist.undos.push(cmd); hist.redos.length = 0; if (hist.undos.length > 200) hist.undos.shift(); refreshBar(); }
  function undo() { if (held) cancel(); const c = hist.undos.pop(); if (!c) return; c.undo(); hist.redos.push(c); sfx('turn'); toast('undo · ' + c.name); refreshBar(); }
  function redo() { if (held) cancel(); const c = hist.redos.pop(); if (!c) return; c.execute(); hist.undos.push(c); sfx('turn'); toast('redo · ' + c.name); refreshBar(); }
  // ── save: every change (a beat later); an unchanged home stores nothing, so the preset assembly stays its default
  const layout = () => toAsm(base, M, true);
  const invObj = () => Object.fromEntries([...inv].filter(([, n]) => n > 0));
  function autosave(now) { clearTimeout(saveT); const go = () => { const L = layout(); let rec = null;
      if (JSON.stringify(toAsm(base, M)) === presetKey() && JSON.stringify(invObj()) === JSON.stringify(Object.fromEntries([...defaultInv()].filter(([, n]) => n > 0)))) SV.clear(h.id);
      else rec = SV.save(h.id, L, invObj());
      dirty = false; status(rec && rec.local === false ? 'not saved (storage off)' : rec ? 'saved' : 'preset'); return rec; };
    if (now) return go(); saveT = setTimeout(go, 350); }
  function saveNow() { if (held) cancel(); const rec = autosave(true), C = RULES.check(layout());
    toast(C.E.length ? `saved · the home check says: ${C.E[0]}` : `saved · passes the home check${rec?.local === false ? ' (this browser keeps nothing)' : ''}`); sfx('thunk'); }
  function exportJSON() { const L = layout(), blob = new Blob([JSON.stringify(L, null, 1) + '\n'], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `home-${h.id.replace(/[^a-z0-9]+/gi, '_')}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('exported · ' + a.download); }
  function importJSON(text) { let A; try { A = JSON.parse(text); } catch { return toast('not JSON'); }
    if (!A || !Array.isArray(A.items) || !Array.isArray(A.slots) || !A.room) return toast('not a home layout (FORMAT.md Assemblies)');
    if (A.tier !== tier) return toast(`that layout is for a ${A.tier}, this is a ${tier}`);
    const C = RULES.check(A); if (C.E.length) return toast(`doesn't pass the home check: ${C.E[0]}`);
    if (A.room.w !== R.w || A.room.d !== R.d) return toast(`that room is ${A.room.w}×${A.room.d} cells, this one ${R.w}×${R.d}`);
    const fills = A.slots.map(s => s.fill ?? null); commit('import', toModel(A, fills), inv); toast('imported · passes the home check'); }
  function reset() { if (held) cancel(); commit('reset', toModel(preset.A, preset.fills), defaultInv()); toast('back to the preset layout · undo to get yours back'); }
  // ── PLACEHOLDER INVENTORY: the tier's catalogue plus the slots' demos, one of each (the sim has no inventories yet)
  function defaultInv() { const m = new Map(), T = CATALOGUE[tier] ?? [tier]; for (const o of HO.OBJECTS) if (o.tiers.some(t => T.includes(t)) && !NOT_OWNED.has(o.id)) m.set(o.id, 1);   // (a Mainland house: the house and penthouse catalogues)
    for (const s of preset.A.slots) if (HO.byId.get(s.demo)) m.set(s.demo, 1); return m; }
  // ── visuals: lit spots (one tile per valid placement, at its centre cell, on its own layer), the slots, the held piece's footprint
  const TILE = new THREE.PlaneGeometry(1, 1), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3(), MX = new THREE.Matrix4(), CL = new THREE.Color();
  const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), EAST = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0));
  function tileXf(q, full) { const b = q.box, n = q.n, s = full ? 1 : 0;
    if (n === 'N') return [[(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, .015], new THREE.Quaternion(), [full ? b[3] - b[0] : C4 * .62, full ? b[4] - b[1] : C4 * .62, 1]];
    if (n === 'E') return [[D3.W - .015, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2], EAST, [full ? b[5] - b[2] : C4 * .62, full ? b[4] - b[1] : C4 * .62, 1]];
    const y = n === 'C' ? D3.H - .015 : q.c[1] + .014; return [[(b[0] + b[3]) / 2, y, (b[2] + b[5]) / 2], FLAT, [full ? b[3] - b[0] - .02 * s : C4 * .62, full ? b[5] - b[2] - .02 * s : C4 * .62, 1]]; }
  function tileAt(mesh, q, full) { const [p, qq, s] = tileXf(q, full); mesh.position.set(...p); mesh.quaternion.copy(qq); mesh.scale.set(...s); }
  // every cell some valid placement covers, on its layer: the area the held piece can sit in (the centres alone hide under the piece)
  function drawTiles() { if (!tiles) return; const C = held ? held.cands.filter(q => q.slot === undefined) : [], seen = new Set(), T = [], o = held?.o, ID = new THREE.Quaternion();
    for (const q of C) { if (q.n === 'N' || q.n === 'E') { for (let a = q.P.x; a < q.P.x + o.foot[0]; a++) for (let j = 0; j < o.foot[1]; j++) { const y = q.P.y + (j + .5) * C4, k = q.n + a + '|' + y.toFixed(3);
          if (!seen.has(k)) { seen.add(k); T.push(q.n === 'N' ? [D3.ox + (a + .5) * C4, y, .015, ID] : [D3.W - .015, y, (a + .5) * C4, EAST]); } } continue; }
      const [rw, rd] = rdims(o.foot, held.rot), y = q.n === 'C' ? D3.H - .015 : q.c[1] + .014;
      for (let x = q.P.x; x < q.P.x + rw; x++) for (let z = q.P.z; z < q.P.z + rd; z++) { const k = x + '|' + z + '|' + y.toFixed(3); if (!seen.has(k)) { seen.add(k); T.push([D3.ox + (x + .5) * C4, y, (z + .5) * C4, FLAT]); } } }
    tiles.count = Math.min(T.length, tiles.instanceMatrix.count);
    for (let k = 0; k < tiles.count; k++) { const t = T[k]; MX.compose(P3.set(t[0], t[1], t[2]), Q.copy(t[3]), S3.set(C4 * .84, C4 * .84, 1)); tiles.setMatrixAt(k, MX); }
    tiles.instanceMatrix.needsUpdate = true; tiles.visible = tiles.count > 0; }
  function slotRectQ(s) { const fw = s.foot[0] * C4, fh = s.foot[1] * C4;   // the slot's own rect, on its layer
    if (s.place === 'wall') { const y = s.y ?? HO.byId.get(s.demo)?.mount ?? 1, a = s.x * C4;
      return s.wall === 'N' ? { n: 'N', box: [D3.ox + a, y, 0, D3.ox + a + fw, y + fh, .02], c: [0, 0, 0] } : { n: 'E', box: [D3.W - .02, y, a, D3.W, y + fh, a + fw], c: [0, 0, 0] }; }
    const [w, d] = rdims(s.foot, s.rot); let y = 0; if (s.place === 'surface') { const P = M.items.find(q => q.uid === s.parent); y = (P && HO.byId.get(P.id)?.tops?.[0]) ?? .5; } else if (s.place === 'ceiling') y = D3.H;
    const X = D3.ox + s.x * C4, Z = s.z * C4; return { n: s.place === 'ceiling' ? 'C' : 'F', box: [X, y, Z, X + w * C4, y, Z + d * C4], c: [0, y, 0] }; }
  function drawSlots() { if (!slotTiles) return; const fit = held ? new Set(held.cands.filter(q => q.slot !== undefined).map(q => q.slot)) : null;
    M.slots.forEach((s, i) => { const T = slotTiles[i]; if (!T) return; tileAt(T, slotRectQ(s), true); const on = fit?.has(i); T.material.opacity = held ? (on ? .55 : .08) : .22; T.material.color.set(on ? 0xffc21a : 0xffd95a);
      const L = slotLabs[i]; if (L) { L.className = 'hb-lab' + (on ? ' on' : held ? ' off' : ''); L.textContent = s.label + (M.fills[i] ? '' : ' · empty'); } }); }
  function thunk(v) { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; anims.push({ v, t0: performance.now(), dur: 230 }); }
  // ── hover (mouse): an outline and a tip
  let hoverBox = null;
  function setHover(v) { hover = v; refreshBar(); if (!hoverBox) return; hoverBox.visible = !!v && !held;
    if (v) { const b = v.box; hoverBox.position.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2); hoverBox.scale.set(b[3] - b[0] + .05, b[4] - b[1] + .05, b[5] - b[2] + .05); } }
  function pickAt(ev) { const r = canvas.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const L = []; for (const v of views.values()) if (v.grp.visible) L.push(v.grp); const hits = ray.intersectObjects(L, true);
    for (const x of hits) { const v = x.object.userData.view; if (v) return v; } return null; }
  function tipFor(o, extra = '') { const g = o.game ?? { kind: 'base', rarity: 'common' }, b = g.kind === 'gear' ? buffText(g.buff) : g.buff?.crib ? 'crib +' + g.buff.crib : '';
    return `<b>${esc(o.name)}</b>${esc(g.kind)} · ${esc(rname(g.rarity))}${g.source ? ' · ' + esc(g.source) : ''}${b ? `<br>${esc(b)}${g.kind === 'gear' ? ' (this season’s gear only; past seasons: looks only)' : ''}` : ''}${extra ? '<br>' + extra : ''}`; }
  // ── pointer: capture phase on the canvas, so a press on a piece never pans the camera and a click never opens another home or follows a
  // walker; a press on empty floor still pans (MapControls), the wheel still zooms
  const consume = ev => { ev.stopImmediatePropagation(); ev.preventDefault(); };
  function onDown(ev) { if (!active || ev.button !== 0 || !ev.isPrimary) return; ptr = [ev.clientX, ev.clientY];
    if (held) { press = { x: ev.clientX, y: ev.clientY, t: performance.now(), kind: 'place' }; consume(ev); return; }
    const v = pickAt(ev); if (!v) return;
    consume(ev); if (pickUp(v.ref, ev)) { press = { x: ev.clientX, y: ev.clientY, t: performance.now(), kind: 'grab' }; try { canvas.setPointerCapture(ev.pointerId); } catch {} } }
  function onMove(ev) { if (!active) return; ptr = [ev.clientX, ev.clientY];
    if (held) { aim(); if (press) consume(ev); tip.hidden = true; return; }
    if (ev.pointerType !== 'mouse' || ev.buttons) return; const v = pickAt(ev); if (v !== hover) setHover(v);
    if (v) { tip.hidden = false; tip.innerHTML = tipFor(v.o, FIXED.has(v.o.id) ? 'part of the building' : 'click to move · Del to inventory'); tip.style.left = ev.clientX + 'px'; tip.style.top = ev.clientY + 'px'; canvas.style.cursor = FIXED.has(v.o.id) ? 'not-allowed' : 'grab'; }
    else { tip.hidden = true; canvas.style.cursor = ''; } }
  function onUp(ev) { if (!active || ev.button !== 0) return; const p = press; press = null; if (!p) return; consume(ev); try { canvas.releasePointerCapture(ev.pointerId); } catch {}
    ptr = [ev.clientX, ev.clientY]; const moved = Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > 6;
    if (p.kind === 'grab' && !moved) return;   // a click picked it up: it follows the pointer until the next click
    if (ev.pointerType !== 'mouse' || p.kind === 'grab') aim(); drop(); }
  function onKey(ev) { if (!active || /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target?.tagName || '')) return; const k = ev.key, mod = ev.metaKey || ev.ctrlKey; let used = true;
    if (mod && (k === 'z' || k === 'Z')) ev.shiftKey ? redo() : undo(); else if (mod && (k === 'y' || k === 'Y')) redo(); else if (mod && (k === 's' || k === 'S')) saveNow();
    else if (mod || ev.altKey) used = false; else if (k === 'r' || k === 'R') rotate(); else if (k === 'Delete' || k === 'Backspace') store();
    else if (k === 'Escape') { if (held) cancel(); else exit(); } else used = false;
    if (used) ev.preventDefault(); if (!mod) ev.stopImmediatePropagation(); }   // (nothing else hears keys while editing: the rig's 1–5 would leave the map)
  // ── the loop: eased moves, the lifted held piece, the drop thunk, labels, thumbnails (only while editing)
  function loop(t) { raf = active ? requestAnimationFrame(loop) : 0; const dt = Math.min(.05, (t - (last || t)) / 1000); last = t; const k = 1 - Math.exp(-dt * 26);
    for (const v of views.values()) { if (!v.to) continue; const lift = held && heldViews().includes(v) ? .08 + Math.sin(t / 160) * .015 : 0; v.grp.position.x += (v.to.p[0] - v.grp.position.x) * k; v.grp.position.y += (v.to.p[1] + lift - v.grp.position.y) * k; v.grp.position.z += (v.to.p[2] - v.grp.position.z) * k;
      let dr = v.to.ry - v.grp.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); v.grp.rotation.y += dr * k; }
    if (held?.vg?.to) { const g = held.vg.grp, P = held.vg.to; g.position.x += (P.p[0] - g.position.x) * k; g.position.y += (P.p[1] + .08 + Math.sin(t / 160) * .015 - g.position.y) * k; g.position.z += (P.p[2] - g.position.z) * k; let dr = P.ry - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * k; }
    for (let i = anims.length - 1; i >= 0; i--) { const a = anims[i], u = Math.min(1, (t - a.t0) / a.dur), s = u < .45 ? 1 - Math.sin(u / .45 * Math.PI) * .14 : 1 + Math.sin((u - .45) / .55 * Math.PI) * .05;
      a.v.grp.scale.set(1 + (1 - s) * .5, s, 1 + (1 - s) * .5); if (u >= 1) { a.v.grp.scale.set(1, 1, 1); anims.splice(i, 1); } }
    if (tiles?.visible) tiles.material.opacity = .26 + Math.sin(t / 300) * .07; if (foot.visible) foot.material.opacity = .5 + Math.sin(t / 200) * .12;
    const r = canvas.getBoundingClientRect(); M.slots.forEach((s, i) => { const L = slotLabs[i]; if (!L) return; const q = slotRectQ(s), b = q.box, p = local([(b[0] + b[3]) / 2, b[4] + .05, (b[2] + b[5]) / 2]).project(camera);
      L.hidden = p.z > 1; L.style.left = (r.left + (p.x + 1) / 2 * r.width) + 'px'; L.style.top = (r.top + (1 - p.y) / 2 * r.height) + 'px'; });
    pumpThumbs(); }
  // ── thumbnails for the tray: each piece drawn once into a small render target with the page's own renderer (a few per frame)
  let th = null; const thumbQ = [], thumbs = new Map();   // (id → a drawn canvas: the tray re-renders often, each piece is drawn once)
  function pumpThumbs() { if (!thumbQ.length) return; th ??= (() => { const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8070, 2.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 4, 3); sc.add(dl);
      const rt = new THREE.WebGLRenderTarget(196, 128); rt.texture.colorSpace = THREE.SRGBColorSpace; return { sc, rt, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 50), buf: new Uint8Array(196 * 128 * 4), img: new ImageData(196, 128) }; })();
    const keep = { rt: renderer.getRenderTarget(), ac: renderer.autoClear, cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha(), au: renderer.shadowMap.autoUpdate, nu: renderer.shadowMap.needsUpdate };
    try { renderer.shadowMap.autoUpdate = false; renderer.autoClear = true; renderer.setClearColor(0xe9e5da, 1);
      for (let n = 0; n < 2 && thumbQ.length; n++) { const { id, cv } = thumbQ.shift(); if (!cv.isConnected) continue; const o = HO.byId.get(id); const G = groupFor(id, 0, o.states?.[0], 7); th.sc.add(G);
        const bx = new THREE.Box3().setFromObject(G), c = bx.getCenter(new THREE.Vector3()), sz = bx.getSize(new THREE.Vector3()), R0 = Math.max(sz.x, sz.y, sz.z) * .62 + .02;
        th.cam.left = -R0 * 1.53; th.cam.right = R0 * 1.53; th.cam.top = R0; th.cam.bottom = -R0; th.cam.position.copy(c).add(new THREE.Vector3(o.place === 'wall' ? .5 : 1.6, o.place === 'wall' ? .5 : 1.3, 2.2).multiplyScalar(R0 * 4)); th.cam.lookAt(c); th.cam.near = .01; th.cam.far = R0 * 30; th.cam.updateProjectionMatrix();
        renderer.setRenderTarget(th.rt); renderer.render(th.sc, th.cam); renderer.readRenderTargetPixels(th.rt, 0, 0, 196, 128, th.buf); G.removeFromParent();
        for (let y = 0; y < 128; y++) th.img.data.set(th.buf.subarray((127 - y) * 196 * 4, (128 - y) * 196 * 4), y * 196 * 4); cv.getContext('2d').putImageData(th.img, 0, 0);
        const keepC = document.createElement('canvas'); keepC.width = 196; keepC.height = 128; keepC.getContext('2d').putImageData(th.img, 0, 0); thumbs.set(id, keepC); } }
    finally { renderer.setRenderTarget(keep.rt); renderer.autoClear = keep.ac; renderer.setClearColor(keep.cc, keep.ca); renderer.shadowMap.autoUpdate = keep.au; renderer.shadowMap.needsUpdate = keep.nu; } }
  // ── the UI: the bar (title, undo / redo / turn / to inventory, save / export / import / reset, done) and the tray
  let tip = null, bar = null, tray = null, toastEl = null, fileIn = null;
  const TABS = [['furniture', 'Furniture', o => !stakes(o) && o.place !== 'wall'], ['wall', 'Wall', o => !stakes(o) && o.place === 'wall'], ['gear', 'Gear', o => o.game?.kind === 'gear'], ['collectible', 'Collectibles', o => o.game?.kind === 'collectible'], ['trophy', 'Trophies', o => o.game?.kind === 'trophy']];
  function buildUI() { css();
    bar = document.createElement('div'); bar.id = 'hb-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Edit home');
    bar.innerHTML = `<div class="t">Edit home<small>${esc(title)}</small></div>
<button class="hb-b k" data-a="undo" title="Undo (Ctrl/⌘+Z)">↶ Undo</button><button class="hb-b k" data-a="redo" title="Redo (Ctrl/⌘+⇧+Z)">↷ Redo</button>
<button class="hb-b k" data-a="rot" title="Turn what you hold (R)">⟳ Turn<kbd>R</kbd></button><button class="hb-b k" data-a="store" title="Back to the inventory (Delete)">To inventory<kbd>Del</kbd></button>
<span class="sep"></span><span class="hb-split"><button class="hb-b" data-a="clear" title="Every placed piece back to the inventory; the kitchen, the bath and the building stay (undo brings it all back)">Clear room</button><button class="hb-b sub" data-a="clearall" title="Clear everything: the kitchen and bath too (the door and windows are the building's)">all</button></span>
<span class="sep"></span><button class="hb-b" data-a="save" title="Save now (Ctrl/⌘+S); every change saves anyway">Save</button><button class="hb-b" data-a="exp">Export</button><button class="hb-b" data-a="imp">Import</button><button class="hb-b" data-a="reset" title="Back to the preset layout (undoable)">Reset</button>
<button class="hb-b" data-a="mute" aria-pressed="${muted}">${muted ? 'Sound off' : 'Sound on'}</button><span class="sep"></span><span class="st" aria-live="polite"></span><span class="flex"></span><button class="hb-b go" data-a="done" title="Done (Esc)">Done</button>`;
    bar.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; const a = b.dataset.a;
      ({ undo, redo, rot: rotate, store: () => store(), clear: () => clearRoom(false), clearall: () => clearRoom(true), save: saveNow, exp: exportJSON, imp: () => fileIn.click(), reset, done: () => exit(), mute: () => { muted = !muted; try { localStorage.setItem('aicity.builder.mute', muted ? '1' : '0'); } catch {} b.textContent = muted ? 'Sound off' : 'Sound on'; b.setAttribute('aria-pressed', String(muted)); } })[a]?.(); });
    tray = document.createElement('div'); tray.id = 'hb-tray'; tray.setAttribute('aria-label', 'Inventory');
    tray.addEventListener('click', ev => { const t = ev.target.closest('.tab'); if (t) { tab = t.dataset.t; refreshTray(); return; } const c = ev.target.closest('.hb-c'); if (c) fromInventory(c.dataset.id); });
    tip = document.createElement('div'); tip.id = 'hb-tip'; tip.hidden = true; toastEl = document.createElement('div'); toastEl.id = 'hb-toast'; toastEl.hidden = true; toastEl.setAttribute('role', 'status');
    fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = '.json,application/json'; fileIn.hidden = true; fileIn.onchange = () => { const f = fileIn.files?.[0]; if (f) f.text().then(importJSON); fileIn.value = ''; };
    document.body.append(bar, tray, tip, toastEl, fileIn);
    slotLabs = M.slots.map(() => { const L = document.createElement('div'); L.className = 'hb-lab'; document.body.appendChild(L); return L; }); }
  function refreshBar() { if (!bar) return; const q = s => bar.querySelector(`[data-a="${s}"]`);
    q('undo').disabled = !hist.undos.length; q('redo').disabled = !hist.redos.length; q('rot').disabled = !held || held.o.place === 'wall'; q('store').disabled = !held && !hover;
    if (!held) { q('clear').disabled = !clearPlan(false).n; q('clearall').disabled = !clearPlan(true).n; }
    const f = flexOf([...M.items.map(m => m.id), ...M.fills.filter(Boolean).map(x => x.id)]); bar.querySelector('.flex').innerHTML = `crib <b>${f.crib}</b>${f.rarest[0] ? ` · rarest <b>${esc(f.rarest[0].name)}</b>` : ''}`; }
  function status(s) { const el = bar?.querySelector('.st'); if (el) el.textContent = s; }
  function toast(s) { if (!toastEl) return; toastEl.textContent = s; toastEl.hidden = false; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.opacity = 0; toastT = setTimeout(() => { toastEl.hidden = true; }, 260); }, 2200); }
  function refreshTray() { if (!tray) return; const list = [...inv].filter(([, n]) => n > 0).map(([id, n]) => [HO.byId.get(id), n]).filter(([o]) => o);
    const counts = TABS.map(([k, , f]) => list.filter(([o]) => f(o)).length), T = TABS.find(t => t[0] === tab) ?? TABS[0];
    const cards = list.filter(([o]) => T[2](o)).sort((a, b) => (RANK[b[0].game?.rarity] ?? 0) - (RANK[a[0].game?.rarity] ?? 0) || a[0].cat.localeCompare(b[0].cat) || a[0].name.localeCompare(b[0].name));
    const fits = o => !stakes(o) || M.slots.some(s => fitsSlot(o, s));
    tray.innerHTML = `<div class="tabs" role="tablist">${TABS.map(([k, n], i) => `<button class="tab${k === T[0] ? ' on' : ''}" role="tab" aria-selected="${k === T[0]}" data-t="${k}">${n}<i>${counts[i]}</i></button>`).join('')}<span class="hb-hint">${held ? (stakes(held.o) ? 'gold: slots it fits' : 'green: where it fits') + ' · R turn · Esc drop' : 'click a piece in the room to pick it up · or pick one here'}</span></div>
<div class="cards">${cards.map(([o, n]) => { const g = o.game ?? { kind: 'base', rarity: 'common' }; return `<button class="hb-c${held?.src === 'inv' && held.id === o.id ? ' sel' : ''}${fits(o) ? '' : ' na'}" data-id="${esc(o.id)}" title="${esc(tipFor(o).replace(/<[^>]+>/g, ' · ').replace(/^ · /, ''))}${fits(o) ? '' : ' · no slot in this home takes it'}"><canvas width="196" height="128" data-th="${esc(o.id)}"></canvas><span class="n">${esc(o.name)}</span><span class="r" style="background:${RCOL[g.rarity] ?? '#ddd'}">${esc(rname(g.rarity))}</span><span class="k">${esc(g.kind === 'base' ? o.cat : g.kind)}</span>${n > 1 ? `<span class="q">×${n}</span>` : ''}</button>`; }).join('') || '<span style="color:#9a9aa6;font-size:11px;padding:20px 4px">nothing here: put pieces away with Del</span>'}</div>`;
    thumbQ.length = 0; for (const cv of tray.querySelectorAll('canvas[data-th]')) { const c = thumbs.get(cv.dataset.th); if (c) cv.getContext('2d').drawImage(c, 0, 0); else thumbQ.push({ id: cv.dataset.th, cv }); } }
  // ── enter / exit
  function enter() { if (active) return; active = true;
    const shellA = { ...e.A, items: [], slots: [], vacant: null }, sh = mods.R.buildRoom(shellA, { ...e.S, bare: true, sec: [], scars: [], fills: [], forRent: false, asleep: false });
    D3 = { W: sh.W, D: sh.D, H: sh.H, ox: sh.ox ?? sh.W - R.w * C4 };
    eg = new THREE.Group(); eg.position.copy(e.g.position); eg.quaternion.copy(e.g.quaternion); eg.name = 'home-builder';
    sh.bank.L.forEach((O, li) => { if (O.v) { const m = new THREE.Mesh(geoOf(O), mods.MATS[li]); m.userData.shell = true; eg.add(m); } });
    tiles = new THREE.InstancedMesh(TILE, new THREE.MeshBasicMaterial({ color: 0x6cff4a, transparent: true, opacity: .4, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), 2048); tiles.count = 0; tiles.frustumCulled = false; tiles.renderOrder = 2; eg.add(tiles);
    foot = new THREE.Mesh(TILE, new THREE.MeshBasicMaterial({ color: 0x6cff4a, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); foot.visible = false; foot.renderOrder = 2; eg.add(foot);
    hoverBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xffc21a, depthTest: false, transparent: true })); hoverBox.visible = false; hoverBox.renderOrder = 4; eg.add(hoverBox);
    const saved = SV.load(h.id, tier); M = toModel(e.A, e.fills); inv = saved?.inv ? new Map(Object.entries(saved.inv)) : defaultInv();
    slotTiles = M.slots.map(() => { const T = new THREE.Mesh(TILE, new THREE.MeshBasicMaterial({ color: 0xffd95a, transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); T.renderOrder = 1; eg.add(T); return T; });
    e.g.visible = false; scene.add(eg); eg.updateMatrixWorld(true);
    buildUI(); document.body.classList.add('hb-editing'); sync(true); refreshTray(); refreshBar(); status(saved ? 'saved' : 'preset');
    canvas.addEventListener('pointerdown', onDown, true); canvas.addEventListener('pointermove', onMove, true); canvas.addEventListener('pointerup', onUp, true); addEventListener('keydown', onKey, true);
    last = 0; raf = requestAnimationFrame(loop); toast('edit mode · click a piece to pick it up'); }
  function exit() { if (!active) return; if (held) cancel(); if (dirty) autosave(true); clearTimeout(saveT); active = false; cancelAnimationFrame(raf); raf = 0;
    canvas.removeEventListener('pointerdown', onDown, true); canvas.removeEventListener('pointermove', onMove, true); canvas.removeEventListener('pointerup', onUp, true); removeEventListener('keydown', onKey, true);
    canvas.style.cursor = ''; document.body.classList.remove('hb-editing'); for (const el of [bar, tray, tip, toastEl, fileIn, ...slotLabs]) el?.remove(); bar = tray = null; slotLabs = [];
    eg.removeFromParent(); eg.traverse(m => { if (m.userData.shell) m.geometry.dispose(); }); for (const L of geo.values()) for (const { g } of L) g.dispose(); geo.clear(); views.clear();
    tiles.material.dispose(); foot.material.dispose(); TILE.dispose(); thumbs.clear(); hoverBox.geometry.dispose(); hoverBox.material.dispose(); for (const T of slotTiles) T.material.dispose(); th?.rt.dispose(); th = null;
    e.g.visible = true; onExit?.(hist.undos.length > 0); }
  // (debug and shots: tools drive the builder through this; nothing in the page calls it)
  const debug = { get held() { return held && { id: held.id, src: held.src, rot: held.rot, cands: held.cands.length, ms: +(held.ms ?? 0).toFixed(1), cur: held.cur?.P ?? null } ; },
    model: () => M && toAsm(base, M), layout, inv: () => invObj(), views: () => [...views.entries()].map(([k, v]) => ({ k, id: v.o?.id, box: v.box, screen: screenOf(local([(v.box[0] + v.box[3]) / 2, (v.box[1] + v.box[4]) / 2, (v.box[2] + v.box[5]) / 2])) })),
    cands: () => held ? held.cands.map(q => ({ P: q.P, n: q.n, screen: screenOf(local(q.c)) })) : [], pickUp: k => { const v = views.get(k); return v ? pickUp(v.ref) : false; }, fromInventory, rotate, store, clearRoom, undo, redo, drop, cancel, saveNow, exportJSON, importJSON, reset, hist: () => ({ undos: hist.undos.map(c => c.name), redos: hist.redos.map(c => c.name) }),
    aimAt: (x, y) => { ptr = [x, y]; if (held) held.off = [0, 0]; aim(); }, setTab: t => { tab = t; refreshTray(); }, toast, D3: () => D3 };
  return { enter, exit, get active() { return active; }, debug };
}
