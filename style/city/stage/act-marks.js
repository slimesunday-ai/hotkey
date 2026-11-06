// C2 · THE ACTS' MARKS ON THE RECORD PATH (stage/acts.js: the clips are the walkers' own, through the loops' plan). Here only what goes
// round them, each a function of the island minute and the cue, so seeking there equals playing there:
//   tag      over the actor's head while its act plays: who it is with (the counterpart: an agent's name, the keeper's, "P9", "the
//            Fence", "a lookout", "crew", "earpiece"). Never the words, an item, an amount, a drug, a target or a reason (§41, 10-31:
//            "Who and where show")
//   floor    a stash's own floorboard (the studio's acts-props.js: the patch and its loose board, its open state neutral: the gap and
//            the plain parcel, the clip's prop), posed in the actor's frame by its floorboard clip's clock; the fence's stand-in counter
//            while haggle_counter plays (the booth's shelf is above the cast's shoulders: acts.md)
//   indoors  HOME_ACTS 'inside' (draw.js indoors): an act at the agent's own home plays in its room. The room's stay walks it to the
//            room's spot for the act (the dress or stash spot, else the clear floor) and holds it there for the act's minimum, or, when it
//            arrived for the act, just inside the door (interiors/city/plan.js stayOf, slime 10-31); here its clips while it holds there
//   aliases  act_pass / act_take: bribe_pass / bribe_take's own track on the walker, the envelope's bills hidden (a plain parcel)
import * as THREE from 'three';
import { CLIP } from '../anim/cast/clips/index.js';
import { errandsGeometry } from '../anim/cast/clips/errands-props.js';
import { ACT_STAGING, PARCEL, HOME_ACTS, registerAliases, setOf, actAt, roleOf } from './acts.js';

const CSS = `.rec-acts{position:fixed;inset:0;pointer-events:none;z-index:39;overflow:hidden}
.rec-act{position:absolute;left:0;top:0;padding:3px 8px;border-radius:9px;background:rgba(20,22,28,.82);color:#f5f1e6;
font:600 12px/1.2 system-ui,-apple-system,sans-serif;white-space:nowrap;transform:translate(-50%,-100%);letter-spacing:.02em}`;
const HEAD = 2.35, TOP = 84, BOTTOM = 170, EDGE = 70;
// the counterpart, as the live act names it (the core's typed counterpart): who, never what
export function counterpartLabel(cp, nameOf) {
  if (!cp) return null;
  if (cp.kind === 'agent' || cp.kind === 'keeper') return nameOf(cp.id);
  return { cops: 'P9', fence: 'the Fence', lookout: 'a lookout', crew: 'crew', earpiece: 'earpiece' }[cp.kind] ?? null;
}
const GLYPH = { call: '☏', listen: '☏', message: '☏', handover: '⇄', fence: '⇄', precinct: '⇄', stash: '⌂' };
// the tag's text for a cue: a glyph for the form (a call, a hand-over) and who; null when there's nobody to name (dress, an order)
export function tagText(cue, nameOf) {
  const set = setOf(cue.kind), who = counterpartLabel(cue.counterpart, nameOf);
  if (cue.counterpart?.kind === 'keeper' && cue.counterpart.id === cue.agent) return null;
  return who ? `${GLYPH[set] ?? ''} ${who}`.trim() : null;
}

// acts: withActs(...).acts (draw.js's hook); camera: the city's (window.__city.camera when not given)
export function createActMarks({ acts, agents, scene, player, nameOf = id => id, camera = null, root = typeof document !== 'undefined' ? document.body : null }) {
  registerAliases(CLIP);
  const all = acts.index.all, starts = all.map(c => c.minute), cam = () => camera ?? window.__city?.camera ?? null;
  let layer = null, els = new Map();
  if (root) { const st = document.createElement('style'); st.textContent = CSS; document.head.append(st); layer = document.createElement('div'); layer.className = 'rec-acts'; root.append(layer); }
  const parcels = [], mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
  // the act's own sets, posed in the walker's frame by its playing clip (the studio's: anim/cast/clips/acts.js, acts.md): the stash's
  // floorboard patch and its loose board (CLIP.floorboard_*.board, by the clip's clock), the fence's stand-in counter (haggle_counter's
  // set) while haggle_counter plays
  const sets = { floor: [], board: [], counter: [] }, M4 = new THREE.Matrix4(), W4 = new THREE.Matrix4(), Y = new THREE.Vector3(0, 1, 0), Qy = new THREE.Quaternion(), P3 = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
  const GEOS = { floor: () => CLIP.floorboard_lift?.board?.floor(THREE), board: () => CLIP.floorboard_lift?.board?.geometry(THREE), counter: () => CLIP.haggle_counter?.set?.geometry(THREE) };
  const setMesh = (k, n) => { const L = sets[k]; while (L.length <= n) { const g = GEOS[k](); if (!g) return null; const m = new THREE.Mesh(g, mat); m.name = 'acts:' + k; m.matrixAutoUpdate = false; m.castShadow = m.receiveShadow = true; scene.add(m); L.push(m); } L[n].visible = true; return L[n]; };
  const walkerM = w => { Qy.setFromAxisAngle(Y, w.yawS ?? w.p[3]); P3.set(w.p[0], w.p[1], w.p[2]); return W4.compose(P3, Qy, S1); };
  function drawSets(w, used) { const s = w?.g?.clip, c = s?.c; if (!c || s.w < .6) return;
    if (c.board) { const f = setMesh('floor', used.floor++), b = setMesh('board', used.board++); if (f) f.matrix.copy(walkerM(w)).multiply(c.board.floorMatrix(THREE, M4)); if (b) b.matrix.copy(walkerM(w)).multiply(c.board.matrix(THREE, s.t, M4)); }
    else if (c.name === 'haggle_counter' && c.set) { const m = setMesh('counter', used.counter++); if (m) m.matrix.copy(walkerM(w)); } }
  const parcelMesh = () => { let m = parcels.find(p => !p.visible); if (!m) { m = new THREE.Mesh(errandsGeometry(THREE, 'envelope', PARCEL), mat); m.scale.setScalar(1.6); scene.add(m); parcels.push(m); } m.visible = true; return m; };
  // the cues playing at minute m: cue.minute ≤ m < cue.minute + cue.minimum (minimum ≤ 5: a short look back is enough)
  function active(m = player.minute) {
    let lo = 0, hi = starts.length; while (lo < hi) { const mid = (lo + hi) >>> 1; if (starts[mid] <= m) lo = mid + 1; else hi = mid; }
    const out = []; for (let i = lo - 1; i >= 0 && starts[i] > m - 10; i--) if (m < all[i].minute + all[i].minimum) out.push(all[i]);
    return out.reverse();
  }
  // ── indoors (C2-indoors2: the room's own stay walks the agent to the act's spot and holds it there for the act, plan.js stayOf, so a
  // seek and playing share it and its exit starts from there): here only the act's clips while it holds there (draw.js indoors.inside:
  // the pose's cue and the second it got there), after the room's own frame (draw.js indoors.addFrame)
  const IA = acts.indoors?.() ?? null, roomNow = new Map();
  // the act's clips from Tb on: its first beats once, then its fill again and again (island seconds) → { clip, t }
  function beatAt(cue, id, Tb, T) {
    const S = ACT_STAGING[setOf(cue.kind)], partner = roleOf(cue, id) === 'partner', dur = c => CLIP[c]?.dur ?? 1;
    let t = Tb; for (const [c, n] of (partner ? S.partnerFirst ?? S.first : S.first) ?? []) { if (!CLIP[c]) continue; const d = dur(c) * n; if (T < t + d) return { clip: c, t: (T - t) % dur(c) }; t += d; }
    const fill = (partner ? S.partnerFill ?? S.fill : S.fill).filter(([c]) => CLIP[c]); if (!fill.length) return { clip: null, t: 0 };
    // (the last beats, in the room: on the last fill wrap that lets them end by the act's minimum, where the room's hold ends; past
    // their end the last one holds its final pose)
    const last = (S.last ?? []).filter(([c]) => CLIP[c]);
    if (last.length) { const T1 = (cue.minute + cue.minimum) * 60, dl = last.reduce((a, [c, n]) => a + dur(c) * n, 0); let tl = t;
      for (let k = 0; k < 400; k++) { const [c, n] = fill[k % fill.length], d = dur(c) * n; if (tl + d + dl > T1) break; tl += d; }
      if (T >= tl) { let u = tl; for (const [c, n] of last) { const d = dur(c) * n; if (T < u + d) return { clip: c, t: (T - u) % dur(c) }; u += d; }
        const [c] = last[last.length - 1]; return { clip: c, t: dur(c) - 1e-3 }; } }
    const cyc = fill.reduce((a, [c, n]) => a + dur(c) * n, 0); let u = (T - t) % cyc;
    for (const [c, n] of fill) { const d = dur(c) * n; if (u < d) return { clip: c, t: u % dur(c) }; u -= d; }
    return { clip: fill[0][0], t: 0 };
  }
  function indoor(m) {
    roomNow.clear(); if (HOME_ACTS !== 'inside' || !IA) return;
    const T = m * 60;
    for (const [id, P] of IA.inside) {
      const cue = P.cue, a = agents.map.get(id), w = a?.w; if (!cue || !w) continue;
      const b = beatAt(cue, id, P.cueFrom ?? T, T), st = IA.current?.get(id) ?? null;
      if (b.clip && st) { const mv = st.actMv ?? (st.actMv = { stand: true, indoor: true, act: true }); mv.clip = b.clip; mv.clipT = b.t; w.mv = mv; }
      roomNow.set(id, { eventId: cue.eventId, clip: b.clip, door: false, tight: !!P.tight });
    }
  }
  if (IA) { if (IA.addFrame) IA.addFrame(m => { try { indoor(m); } catch (e) { indoorErr = String(e && e.stack || e); } });
    else { const other = IA.onFrame; IA.onFrame = m => { other?.(m); try { indoor(m); } catch (e) { indoorErr = String(e && e.stack || e); } }; } }
  let indoorErr = null;
  // (the cues begun by m and not over for `slack` minutes past their minimum: a room act walks back after it)
  function around(m, slack) {
    let lo = 0, hi = starts.length; while (lo < hi) { const mid = (lo + hi) >>> 1; if (starts[mid] <= m) lo = mid + 1; else hi = mid; }
    const out = []; for (let i = lo - 1; i >= 0 && starts[i] > m - 15; i--) if (m < all[i].minute + all[i].minimum + slack) out.push(all[i]);
    return out.reverse();
  }
  // WHO SEES THE TAG (GAME.md §41, slime 10-31: "A follower sees the act, who it's with and where, live"). Every act here is a private,
  // viewer-only act: its counterpart is shown only to a viewer following its agent (a hand-over: either of the pair), and only while the
  // walker plays this very act. Everyone else sees the act play with no tag. §19's release (the receipt public at the next dawn) never
  // falls inside an act's window (its minimum, before the 21:00 lock), so no tag shows to non-followers live; the tape carries it after
  const followed = () => { const c = typeof window !== 'undefined' ? window.__city?.cam : null; return c?.watched?.agent ? c.watched.aid ?? null : null; };   // (the person watched: camera/rig.js watched)
  const seenBy = (cue, id) => !!id && (setOf(cue.kind) === 'handover' ? cue.participants.includes(id) : cue.agent === id);
  const V = new THREE.Vector3(), shown = [];
  function frame() {
    const m = player.minute, up = active(m), keep = new Set(), C = cam(), follow = followed(); shown.length = 0;
    for (const p of parcels) p.visible = false;
    for (const L of Object.values(sets)) for (const m of L) m.visible = false;
    const used = { floor: 0, board: 0, counter: 0 };
    const W = typeof innerWidth === 'number' ? innerWidth : 0, H = typeof innerHeight === 'number' ? innerHeight : 0;
    for (const cue of up) {
      const a = agents.map.get(cue.agent), w = a?.w && !a.w.gone ? a.w : null, fig = acts.figures.get(cue.agent), mine = fig?.eventId === cue.eventId;
      const set = setOf(cue.kind), text = mine && seenBy(cue, follow) ? tagText(cue, nameOf) : null;
      // (the stash's parcel: at the actor's feet, ahead of it, while it plays its own act)
      if ((ACT_STAGING[set]?.floor || set === 'fence') && w) drawSets(w, used);
      if (ACT_STAGING[set]?.parcel && w && mine) { const P = parcelMesh(), ry = w.yawS ?? w.p[3]; P.position.set(w.p[0] + Math.sin(ry) * .45, w.p[1] + .03, w.p[2] + Math.cos(ry) * .45); P.rotation.set(-Math.PI / 2, 0, ry); }
      let vis = false, sx = 0, sy = 0;
      // (only a follower ever has a tag, and the follow rig frames its subject as it likes, close and low or overhead: a head past the
      // frame's edge keeps its tag on screen at the nearest edge, clear of the page's top bar and the player below)
      if (text && layer && w && C) { V.set(w.p[0], w.p[1] + HEAD, w.p[2]).project(C); vis = V.z < 1 && V.z > -1;
        sx = Math.min(W - EDGE, Math.max(EDGE, (V.x + 1) / 2 * W)); sy = Math.min(H - BOTTOM, Math.max(TOP, (1 - V.y) / 2 * H)); }
      if (text && layer) { keep.add(cue.eventId); let el = els.get(cue.eventId);
        if (!el) { el = document.createElement('div'); el.className = 'rec-act'; el.dataset.agent = cue.agent; el.dataset.event = cue.eventId; el.textContent = text; layer.append(el); els.set(cue.eventId, el); }
        el.style.display = vis ? '' : 'none'; if (vis) el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`; }
      shown.push({ eventId: cue.eventId, agent: cue.agent, kind: cue.kind, set, tag: text, onScreen: vis, ndc: text && w && C ? [+V.x.toFixed(3), +V.y.toFixed(3), +V.z.toFixed(4)] : null, staged: mine, participants: cue.participants });
    }
    for (const [id, el] of els) if (!keep.has(id)) { el.remove(); els.delete(id); }
  }
  // what is staged now, for tools/actcheck.mjs: each playing cue, its figures (the walkers whose plan stages it) and the props in view
  function state() {
    const m = player.minute, out = [];
    for (const cue of active(m)) {
      const figs = [...acts.figures].filter(([, f]) => f.eventId === cue.eventId && m >= f.from && m < f.to).map(([id, f]) => {
        const a = agents.map.get(id), w = a?.w; return { id, role: f.role, mark: f.mark, mode: a?.mode ?? null, x: w ? +w.p[0].toFixed(2) : null, z: w ? +w.p[2].toFixed(2) : null,
          clip: w?.mv?.clip ?? null, prop: w?.mv?.clip ? CLIP[w.mv.clip]?.prop?.id ?? null : null, at: a?.rec?.at ?? null, where: roomNow.get(id)?.eventId === cue.eventId ? (roomNow.get(id).door ? 'step' : 'room') : 'spot' }; });
      out.push({ eventId: cue.eventId, kind: cue.kind, set: setOf(cue.kind), agent: cue.agent, participants: cue.participants, place: cue.place.cityPlace,
        tag: els.get(cue.eventId)?.textContent ?? null, figures: figs, parcel: !!ACT_STAGING[setOf(cue.kind)]?.parcel && figs.length > 0, floor: !!ACT_STAGING[setOf(cue.kind)]?.floor && figs.length > 0 });
    }
    return out;
  }
  return { frame, active, state, get indoorErr() { return indoorErr; }, roomNow, IA,
    explain: (m, id) => around(m, 3).filter(c => c.participants.includes(id)).map(cue => { const P = IA?.inside.get(id);
      return { e: cue.eventId, set: setOf(cue.kind), inside: IA?.inside.has(id), st: !!IA?.current?.get(id), plan: !!IA?.planOf(id), P: P ? { x: P.x, z: P.z, cue: P.cue?.eventId ?? null, tight: !!P.tight } : 'x', H: HOME_ACTS }; }), shown: () => shown.slice(), actAt: (id, m) => actAt(acts.index, id, m), tags: () => [...els.values()].map(e => e.textContent) };
}
