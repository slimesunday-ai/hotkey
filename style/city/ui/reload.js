// HUMAN LAYER · THE DAY / NIGHT RELOAD KEEPS THE VIEWER'S PLACE (review 10-09 #2). The page is built for day or night, so at 20:00 and
// 06:00 simstate/live.js reloads it into the sim's (every 5–7 min at the default pace), and the viewer lost everything: the dossier, the
// follow, the open panel, the heat map. live.js now fires 'simlive:reload' on window just before it goes; this saves the UI's state in
// sessionStorage (this tab only), and the new page puts it back once the store's first state is in:
//   dossier  the open agent · follow  the sim agent the camera follows (once its walker is placed again; the camera's own zoom and pitch
//   are already kept: CAM.follow.viewerDist / viewerPitch in localStorage city.camera) · panel  City, TV, the map or People (and its
//   search) · heat  the heat map's mode · tape  TAPE (its agent, time, speed, playing; TAPE holds live.js's reload off while open, so it
//   comes through ui/light.js's reload to light; a dossier or follow taken in TAPE beyond the tape's own agent comes back with it)
// One use: the saved state is read once and dropped, and only within RELOAD.ms of the reload (a later reload of the tab is a fresh page).
// Nothing else is kept, and nothing private: handles, a mode, a minute.
export const RELOAD = { key: 'aicity.ui.reload', ms: 180000, followMs: 20000 };

export function keepAcrossReload({ api, sim, dossier, city, menu, refs, tape }) {
  const rig = api.cam;
  function save() {
    const r = refs(), toys = window.__toys, panel = r.map?.isOpen ? 'map' : r.info?.open || (menu.people.isOpen ? 'people' : null);
    const follow = rig?.mode === 'follow' && rig.subject?.agent ? rig.subject.aid : null;
    const q = panel === 'people' ? (menu.people.el.querySelector('.pp-q')?.value || '') : '';
    const s = { v: 1, at: Date.now(), dossier: dossier.isOpen ? dossier.current : null, follow, panel, query: q || null, heat: toys?.heat?.mode || null,
      tape: tape.active && tape.time() !== null ? { handle: tape.handle, t: Math.floor(tape.time()), speed: tape.speed, playing: tape.playing } : null };
    try { sessionStorage.setItem(RELOAD.key, JSON.stringify(s)); } catch {}
    return s;
  }
  addEventListener('simlive:reload', save);
  let s = null; try { s = JSON.parse(sessionStorage.getItem(RELOAD.key) || 'null'); sessionStorage.removeItem(RELOAD.key); } catch { s = null; }
  const out = { save, restored: null };
  if (!s || s.v !== 1 || !(Date.now() - s.at < RELOAD.ms)) return out;
  out.restored = { ...s, done: [] };
  const done = what => out.restored.done.push(what);
  sim.ready.then(() => {
    const r = refs();
    if (s.panel === 'map' && r.map) { r.map.open(); done('map'); }
    else if ((s.panel === 'city' || s.panel === 'tv') && r.info) { r.info.show(s.panel); done(s.panel); }
    else if (s.panel === 'people') { menu.people.open({ focus: false, query: s.query }); done('people'); }
    if (s.dossier && !s.tape) { dossier.open(s.dossier); done('dossier'); }
    if (s.heat) { const t0 = performance.now(), wait = () => { if (window.__toys?.heat) { window.__toys.heat.set(s.heat); window.__toys.tools?.(false); done('heat'); } else if (performance.now() - t0 < 15000) setTimeout(wait, 250); }; wait(); }
    // the follow: once the walkers are placed again (in TAPE: the tape's walkers); not if the viewer took the camera meanwhile
    const follow = inTape => { if (!s.follow || !rig) return; const t0 = performance.now(), wait = () => { if (rig.mode !== 'orbit' || tape.active !== inTape) return; const w = rig.people.byAid(s.follow);
      if (w) { rig.setMode('follow', { subject: w }); city.follow(s.follow); done('follow'); return; } if (performance.now() - t0 < RELOAD.followMs) setTimeout(wait, 250); }; setTimeout(wait, 250); };
    // TAPE: the tape follows its own agent; a dossier or follow the viewer took in TAPE beyond it comes back too (TAPE's light reload,
    // ui/light.js, goes with TAPE open)
    if (s.tape && r.tape) { const off = tape.on('seek', () => { off(); if (s.tape.playing) tape.play(); done('tape');
        if (s.dossier && s.dossier !== s.tape.handle) { dossier.open(s.dossier); done('dossier'); } if (s.follow !== s.tape.handle) follow(true); });
      tape.setSpeed(s.tape.speed); r.tape.open({ handle: s.tape.handle, at: s.tape.t }); return; }
    follow(false);
  });
  return out;
}
