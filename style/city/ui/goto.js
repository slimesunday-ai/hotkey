// HUMAN LAYER · GO THERE: one small helper every screen uses to send the camera to a place, so the ticker, City TV, the boards (3a) and
// the paper street map (3b) all move the camera the same way. Shared on purpose: use it, don't copy it.
//   import { places, flyTo } from './goto.js'
//   await places()                         → { get(id), dist(d), name(id), distName(d), centre(d) } (sim2/places.json, fetched once)
//   flyTo(api, { place: 'corner-1_-1' })   a place id (corners, the Heap, a lot …)
//   flyTo(api, { dist: 'downtown' })       a district: the middle of its places
//   flyTo(api, { handle: 'www.girl' })     where an agent is now (sim.where: its walker, or the place it is in; rule 5: at someone else's
//                                          lot LIVE knows only the district — the camera frames the district, wide, never the lot)
//   flyTo(api, { x, z, label })            a world point
//   followAgent(api, { sim, handle, open, say })   follow them + open the dossier (the People row's click; below)
// TV plan A2 (2026-10-09): the camera moves by the one shot grammar (camera/shots.js). A place is an establishing shot (about 26 m out,
// the lowest angle that sees it), a person on the street a shot of them (8–14 m, 25–35° down), a district wide (120 m). Near (≤ 300 m):
// a 0.8–1.4 s flight; far: the cut behind the load-in's gate (the streets are built before you see them), then a 0.8 s settle.
// Returns true when the camera moves. Nothing here runs per frame.
import { sdata } from '../../../world/city.js';   // (SPREAD: the data this spread reads)
import { shotsFor } from '../camera/shots.js';
let book = null, loading = null;
export function places() {
  if (book) return Promise.resolve(book);
  loading ??= fetch(new URL(sdata('../../../sim2/places.json'), import.meta.url)).then(r => r.json()).catch(() => ({ places: [], lots: [], districts: {} })).then(pj => {
    const byId = new Map([...(pj.places || []), ...(pj.lots || [])].map(p => [p.id, p])), byDist = new Map();
    for (const p of byId.values()) if (p.dist) { let L = byDist.get(p.dist); if (!L) byDist.set(p.dist, L = []); L.push(p); }
    const centres = new Map(); for (const [d, L] of byDist) { const S = L.filter(p => p.kind !== 'lot').length ? L.filter(p => p.kind !== 'lot') : L; centres.set(d, { x: S.reduce((s, p) => s + p.x, 0) / S.length, z: S.reduce((s, p) => s + p.z, 0) / S.length }); }
    const names = pj.districts || {};
    const D = d => String(d || '').replace(/^dist:/, '');   // (rule 5: a public `at` may be only a district, 'dist:<district>')
    book = { get: id => byId.get(id) || null, dist: d => byDist.get(D(d)) || [], centre: d => centres.get(D(d)) || null,
      name: id => byId.get(id)?.name?.replace(/\s*\(DROP\)$/, '') || (names[D(id)] ?? null), distName: d => names[D(d)] || (d ? D(d)[0].toUpperCase() + D(d).slice(1) : '') };
    return book; });
  return loading;
}
export const placesNow = () => book;   // (null until places() resolved: synchronous readers fall back to the raw id)

// where a target is: { x, z, label } | null
export function resolve(target, sim = window.__simstore) {
  if (!target) return null; const B = book;
  if (typeof target.x === 'number' && typeof target.z === 'number') return { x: target.x, z: target.z, label: target.label || '' };
  // an agent: where it is. Rule 5 (coarse): at someone else's lot LIVE shows only the district — go to the district, framed wide
  if (target.handle && sim) { const w = sim.where(target.handle); if (w) { if (w.coarse) { const d = sim.agent?.(target.handle)?.live?.district; return { x: w.x, z: w.z, label: d ? B?.distName(d) || d : '', coarse: true }; } return { x: w.x, z: w.z, label: '@' + target.handle }; } }
  if (target.place && /^dist:/.test(target.place) && B) { const c = B.centre(target.place); if (c) return { ...c, label: B.distName(target.place), coarse: true }; }
  if (target.place && B) { const p = B.get(target.place === 'jail' ? 'jail' : target.place); if (p) return { x: p.x, z: p.z, label: B.name(p.id) || p.id }; const c = B.centre(target.place); if (c) return { ...c, label: B.distName(target.place) }; }
  if (target.dist && B) { const c = B.centre(target.dist); if (c) return { ...c, label: B.distName(target.dist), coarse: true }; }
  return null;
}
// can the camera go there? (for a button's disabled state)
export const canGo = target => !!resolve(target);

const NEAR = 600;   // (followAgent: further than this, the walker is reached through the load-in first)
// the shot of a target: a district or a coarse whereabouts wide (rule 5: never a spot), an agent drawn on the street framed as a person,
// anything else as a place
export function shotOf(target, r, sim = window.__simstore) {
  if (r.coarse) return { kind: 'wide', at: r, label: r.label };
  const w = target.handle && sim ? sim.where(target.handle) : null;
  if (w?.drawn && !w.coarse) return { kind: 'two', at: r, actors: [{ x: w.x, y: w.y, z: w.z, h: target.handle }], label: r.label };
  return { kind: 'establishing', at: r, label: r.label };
}
export function flyTo(api, target) {
  const r = resolve(target); if (!r || !api?.camera) return false;
  const rig = api.cam;
  if (rig && (rig.mode === 'photo' || document.body.classList.contains('cam-photo'))) return false;   // (photo mode keeps its frame)
  if (!rig) { api.goTo ? api.goTo(r.x, r.z, r.label) : api.nav?.goTo(r.x, r.z); return true; }
  shotsFor(api).go(shotOf(target, r)); return true;
}

// FOLLOW AN AGENT: the People row's one click, shared (People rows, its Leaderboards, the City boards' ladders): the camera follows them
// (a far one: through the load-in first) and the dossier opens. Inside a building: the camera goes to the building. Rule 5 (coarse: at a
// lot that isn't theirs): the camera goes to the district and says so, never to a precise spot. Out of sight: the dossier only, and a note.
//   followAgent(api, { sim, handle, open: h => dossier.open(h), say: toast })   → true when the camera moved
export function followAgent(api, { sim = window.__simstore, handle: hh, open = null, say = null } = {}) {
  const note = (t, ms) => { if (say) say(t, ms); };
  const c = sim?.agents().find(x => x.handle === hh); if (!c) { note(`@${hh} isn’t in the city`); return false; }
  const rig = api.cam, w = sim.where(hh), P2 = placesNow(); let msg = null, moved = false;
  if (rig && (rig.mode === 'photo' || document.body.classList.contains('cam-photo'))) { open?.(hh); return false; }   // (photo mode keeps its frame)
  const walker = w?.drawn && rig?.people?.byAid ? rig.people.byAid(hh) : null;
  const gone = c.retired || c.status === 'dead';
  if (walker) {
    const T = api.controls.target, far = Math.hypot(T.x - w.x, T.z - w.z) > NEAR;
    if (!far) rig.setMode('follow', { subject: walker });
    else shotsFor(api).go({ kind: 'establishing', at: { x: w.x, z: w.z }, label: '@' + hh }, { settle: false }).done.then(ok => { if (ok) followAfterLoad(api, hh); });   // (far: through the load-in, then follow takes over at the viewer's own zoom: no settle)
    moved = true;
  } else if (w && !w.coarse) { moved = flyTo(api, { x: w.x, z: w.z, label: c.placeName || '@' + hh }); msg = c.status === 'jail' ? `@${hh} is in the yard on Iron Island` : `@${hh} is inside${c.placeName ? ': ' + c.placeName : ''}`; }
  else if (w?.coarse && c.district) { if (rig?.mode === 'follow') rig.setMode('orbit'); moved = flyTo(api, { dist: c.district }); msg = `@${hh} is somewhere in ${P2?.distName(c.district) || c.district}: only the district is public`; }
  else msg = gone ? `@${hh} is ${c.retired ? 'retired' : 'dead'}` : `@${hh} is out of sight right now`;
  open?.(hh); if (msg) note(msg, 2800); return moved;
}
function followAfterLoad(api, hh) { const t0 = performance.now(); const tick = () => { if (performance.now() - t0 > 14000) return; if (api.loading) return setTimeout(tick, 200);
  const w2 = api.cam?.people?.byAid(hh); if (w2 && !document.body.classList.contains('cam-photo')) api.cam.setMode('follow', { subject: w2 }); }; setTimeout(tick, 250); }
places();
