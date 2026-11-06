// C2, the drawn half · FOLLOW THIS AGENT on the record path. The card's Follow (F) puts the camera rig in follow mode on one agent's
// walker (camera/follow.js). The rig already re-finds a walker the record swapped for a new one under the same id (pedsim drop: gone),
// and a ride's stand-in under its id (a cab, the subway: simstate/movement.js); since C2-follow it never swaps an agent for whoever is
// nearest (it holds where the agent was last), so the case below is a page from before that or a viewer's own pick. This
// keeper puts the rig back on the agent the viewer chose as soon as their walker is drawn again, and carries the choice through the
// day / night reload (?follow=<id>, put back once their walker is placed). It lets go the moment the viewer does: the rig leaves follow
// (1, Esc, the map), or the viewer picks someone else while the chosen agent is on the street (Tab, G, a click on a person).
// It never moves the camera itself: the angle and the zoom stay the rig's and the viewer's.
// (C2-lock) The same for the card's Lock (camera/lock.js): the mode it keeps the rig in is 'follow' or 'lock' (?lock=1 beside
// ?follow=<id>; not ?cam=, which is the camera's own pose), whichever the viewer is in on that agent now — 3 and 6 switch between them and the keeper goes along; after the reload
// the lock comes back at the viewer's kept angle and distance (lock.js restore).
const MODES = ['follow', 'lock'];
export function createFollowKeeper({ api, Q }) {
  const rig = api.cam ?? null;
  let want = null, pending = false, tries = 0, mode = Q.get('lock') === '1' ? 'lock' : 'follow';
  if (Q.get('follow')) { want = Q.get('follow'); pending = true; }
  function keepUrl() {
    const u = new URL(location.href);
    if (want) u.searchParams.set('follow', want); else u.searchParams.delete('follow');
    if (want && mode === 'lock') u.searchParams.set('lock', '1'); else u.searchParams.delete('lock');
    if (u.href !== location.href) history.replaceState(history.state, '', u);
  }
  function frame() {
    if (!rig || !want) return;
    const s = rig.subject, w = rig.people?.byAid(want) ?? null, on = MODES.includes(rig.mode) && !!s?.agent && s.aid === want;
    // (after the reload: once their walker is placed; a page with nobody drawn under that id lets go after a while)
    if (pending) { if (w) { rig.setMode(mode, { subject: w, restore: true }); pending = false; } else if (++tries > 900) { pending = false; want = null; keepUrl(); } return; }
    if (on) { if (rig.mode !== mode) { mode = rig.mode; keepUrl(); } return; }
    if (!MODES.includes(rig.mode)) { want = null; keepUrl(); return; }
    // following someone else: the viewer's pick while the agent is on the street → let go; the rig's own pick while they were hidden →
    // back on them now that they are drawn again
    // (the rig only picks someone itself after the subject has been gone a while: a different subject the frame after we were on
    // them, with their walker drawn, is the viewer's own pick)
    if (s && lastOn) { want = null; keepUrl(); return; }
    if (w) rig.setMode(mode, { subject: w });
  }
  let lastOn = false;
  const tick = () => { const s = rig?.subject; lastOn = !!want && MODES.includes(rig?.mode) && !!s?.agent && s.aid === want && !!rig.people?.byAid(want); };
  return {
    frame() { frame(); tick(); },
    // the card's Follow (id) or its stop (null); a restore (the tape's Back) passes the id it put the rig back on
    want(id, m = 'follow') { want = id || null; mode = m === 'lock' ? 'lock' : 'follow'; pending = false; tries = 0; keepUrl(); tick(); },
    // the tape's Back across the reload: follow this agent once the new page has placed them
    after(id, m = 'follow') { want = id || null; mode = m === 'lock' ? 'lock' : 'follow'; pending = !!id; tries = 0; keepUrl(); },
    get wanted() { return want; }, get mode() { return mode; },
  };
}
