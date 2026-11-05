// AI City · C2-indoors (2026-10-31) · THE RECORD VIEWER'S HOMES. slime (GAME.md §41, 10-30): "if the agent goes into a house, we should
// watch them enter the house, then be inside the house with the agent. any room the agent enters we should see". The record's drawing
// (simstate/record/draw.js) draws an agent at home inside its home on its own walker (interiors/city/plan.js); this opens the room it is
// in, and opens and shuts the front door it goes through.
//   which room   the followed agent's home while it is inside or on its way in or out (its walker within REACH of the house), else,
//                with nobody followed, the home nearest what the camera looks at with its agent inside (within NEAR of it). One room
//                is open at a time (gpu.js CUT holds one cutaway); the homes runtime (index.js, record mode) builds it in place, keeps the
//                last three built, never frames the camera (the follow cam follows the walker; the angle and zoom are the viewer's).
//   the room     its dealt layout in its skin (assign.js recordRooms, plan.js's pick), its slots filled from what the record has
//                disclosed only (fill.js recordFills: the last disclosed holdings receipt, panel-data.js tapeAt, as the card's Pockets),
//                read once per change of the presented record; a seek shuts a room whose fills it no longer discloses on the same call
//   the door     a door leaf on the house's front door swings open as the agent comes to it and shuts behind it (plan.js poseAt's
//                door), and the doorway behind it is dark while it is open (the house's own door is part of its baked wall)
//   ?homes=0 leaves all of it off (the walker is still drawn inside, behind the house's walls)
import { createHomes } from './index.js';
import { skinned } from './assign.js';
import { recordFills } from './fill.js';
import { tapeAt } from '../../simstate/record/panel-data.js';

const REACH = 14, NEAR = 12, EVERY = 6;
export function createRecordHomes(api, { Q, NIGHT = false, SHOT = false, page }) {
  const D = page.draw, I = D?.indoors; if (!I) return null;
  const THREE = api.THREE, byLot = () => { const m = new Map(); for (const [id, p] of I.plans) m.set(p.lot, p); return m; };
  const S = { opens: 0, wanted: null, open: null, key: null, lastMs: 0, buildMs: 0, tris: 0, frames: 0, gen: 0, reads: 0, readMs: 0, shut: 0, dropped: 0 };
  // ── C2-indoors2 · what the rooms are filled from: the presented record, one snapshot per change the player publishes (player.on: a
  // frame consumed, a seek), each agent's holdings receipt read from it once (panel-data.js caches its rows by snapshot), never once
  // per room check. Each publish is a new generation: a seek shuts the open room on the very call if its fills no longer match what
  // is presented (a rewind before a disclosure never shows it, not even for a frame), and a room built under an older generation is
  // never shown (index.js open's `still`)
  let snap = page.player.snapshot(), dirty = true; const held = new Map();
  page.player.on((s, meta) => { snap = s; S.gen++; held.clear(); dirty = true; if (meta?.reset) recheck(); });
  function receipt(id) { if (held.has(id)) return held.get(id); const t0 = performance.now(); let r = null;
    try { r = tapeAt(snap, id, snap.minute).holdings ?? null; } catch { r = null; }
    held.set(id, r); S.reads++; S.readMs += performance.now() - t0; return r; }
  function roomOf(h) { const p = byLot().get(h.id); if (!p) return null; const held = receipt(p.agent), fills = recordFills(p.A, held);
    return { name: p.name, A: skinned(p.A, p.skin), fills, owner: p.agent, wealth: .5, held: held ? { id: held.id, minute: held.minute } : null, key: p.name + '|' + JSON.stringify(p.skin) + '|' + JSON.stringify(fills) }; }
  const H = createHomes(api, { Q, NIGHT, SHOT, record: { roomOf } });
  // (a seek: the open room is shut at once unless its fills are what the new minute's record fills it with)
  function recheck() { const c = H.current; if (!c) return; const h = H.index().get(c.id), key = h ? roomOf(h)?.key : null;
    if (key !== S.key) { H.close({ instant: true }); S.open = null; S.key = null; S.shut++; } }
  // ── which room: the followed agent's, else the nearest occupied one to the camera's target
  function wanted() {
    const rig = api.cam, f = rig?.mode === 'follow' && rig.subject?.agent ? rig.subject.aid : null;
    if (f) { const p = I.planOf(f), a = D.agents?.map.get(f); if (p && (I.inside.has(f) || (a?.w && Math.hypot(a.w.p[0] - p.h.cx, a.w.p[2] - p.h.cz) < REACH))) return p; return null; }
    const t = api.controls.target; let best = null, bd = NEAR;
    for (const id of I.inside.keys()) { const p = I.plans.get(id); if (!p) continue; const d = Math.hypot(t.x - p.h.cx, t.z - p.h.cz); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  let busy = false;
  async function sync() {
    const p = wanted(); S.wanted = p?.lot ?? null;
    if (!p) { if (H.current) H.close({ instant: true }); S.open = null; S.key = null; return; }
    const h = H.index().get(p.lot); if (!h) return;
    const key = roomOf(h)?.key; if (H.current?.id === p.lot && key === S.key) return;
    const g = S.gen; busy = true; const t0 = performance.now();
    try { if (await H.open(h, { instant: true, still: () => g === S.gen })) { S.opens++; S.open = p.lot; S.key = key; S.lastMs = Math.round(performance.now() - t0); S.buildMs = H.stats.buildMs; S.tris = H.stats.last?.tris ?? 0; }
      else if (g !== S.gen) { S.dropped++; dirty = true; } }
    finally { busy = false; }
  }
  // ── the doors: a leaf hinged on the doorway's side, swinging in as it opens (seen in the open room; from the street the doorway goes dark)
  const doors = new Map(), leafG = new THREE.BoxGeometry(1.1, 2.3, .07), holeG = new THREE.PlaneGeometry(1.15, 2.35);
  const leafM = new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: .7 }), holeM = new THREE.MeshBasicMaterial({ color: 0x120e0b });
  function doorOf(p) { let d = doors.get(p.lot); if (d) return d;
    const f = p.door.face, g = new THREE.Group(), hinge = new THREE.Group(), leaf = new THREE.Mesh(leafG, leafM), hole = new THREE.Mesh(holeG, holeM);
    // (on the house's front wall at the door: the room's front edge there, plan.js's sill; a porch puts the anchor's door point further out)
    const fx = f[0], fz = f[1], wx = p.door.sill[0], wz = p.door.sill[1], y0 = .5;
    g.position.set(wx, y0, wz); g.rotation.y = Math.atan2(fx, fz);
    hinge.position.set(-.55, 0, .04); leaf.position.set(.55, 1.15, 0); hinge.add(leaf); hole.position.set(0, 1.175, .015); g.add(hinge, hole); g.visible = false;
    api.scene.add(g); d = { g, hinge, hole }; doors.set(p.lot, d); return d; }
  function doorsFrame() {
    const open = new Set();
    for (const [id, P] of I.inside) { if (!(P.door > 0)) continue; const p = I.plans.get(id); if (!p) continue; open.add(p.lot); const d = doorOf(p);
      d.g.visible = true; d.hinge.rotation.y = P.door * 1.75; d.hole.visible = S.open !== p.lot; }
    for (const [lot, d] of doors) if (!open.has(lot)) d.g.visible = false;
  }
  // (every EVERY frames which room is wanted; at once after the presented record changes)
  // (chained onto the indoor frame's hook, never in place of what is there: draw.js runs its addFrame list, then indoors.onFrame)
  const frame = () => { S.frames++; doorsFrame(); if (!busy && (dirty || S.frames % EVERY === 0)) { dirty = false; sync().catch(e => console.warn('record homes:', e)); } };
  { const prev = I.onFrame; I.onFrame = m => { prev?.(m); frame(); }; }
  // (C2-camera: for the follow cam's cutaway, GAME.md §41, slime 10-31 "Rise to the cutaway": whether the agent is inside its home now
  // and its door's opening (draw.js's indoor plan), its room's framing (index.js frameOf, a function: made only when asked) once that room is the one open, and its house's
  // volume in its lot frame (index.js: the cut-open house, which the camera may pass over)
  function cutaway(aid) { const P = I.inside.get(aid), p = P && I.planOf(aid); if (!p) return null;
    const h = H.index().get(p.lot), on = S.open === p.lot && H.current?.id === p.lot;
    return { inside: !!P.inside, door: P.door ?? 0, room: p.lot, frame: on ? H.frame : null, house: h ? { cx: h.cx, cz: h.cz, th: h.th, vol: h.vol } : null }; }
  return { H, stats: S, sync, roomOf, doors, cutaway, get open() { return S.open; } };
}
