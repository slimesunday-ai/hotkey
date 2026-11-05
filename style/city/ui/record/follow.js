// C2, the drawn half · FOLLOW THIS AGENT on the record path. The card's Follow (F) puts the camera rig in follow mode on one agent's
// walker (camera/follow.js). The rig already re-finds a walker the record swapped for a new one under the same id (pedsim drop: gone),
// and a ride's stand-in under its id (a cab, the subway: simstate/movement.js); since C2-follow it never swaps an agent for whoever is
// nearest (it holds where the agent was last), so the case below is a page from before that or a viewer's own pick. This
// keeper puts the rig back on the agent the viewer chose as soon as their walker is drawn again, and carries the choice through the
// day / night reload (?follow=<id>, put back once their walker is placed). It lets go the moment the viewer does: the rig leaves follow
// (1, Esc, the map), or the viewer picks someone else while the chosen agent is on the street (Tab, G, a click on a person).
// It never moves the camera itself: the angle and the zoom stay the rig's and the viewer's.
export function createFollowKeeper({ api, Q }) {
  const rig = api.cam ?? null;
  let want = null, pending = false, tries = 0;
  if (Q.get('follow')) { want = Q.get('follow'); pending = true; }
  function keepUrl() {
    const u = new URL(location.href);
    if (want) u.searchParams.set('follow', want); else u.searchParams.delete('follow');
    if (u.href !== location.href) history.replaceState(history.state, '', u);
  }
  function frame() {
    if (!rig || !want) return;
    const s = rig.subject, w = rig.people?.byAid(want) ?? null, on = rig.mode === 'follow' && !!s?.agent && s.aid === want;
    // (after the reload: once their walker is placed; a page with nobody drawn under that id lets go after a while)
    if (pending) { if (w) { rig.setMode('follow', { subject: w }); pending = false; } else if (++tries > 900) { pending = false; want = null; keepUrl(); } return; }
    if (on) return;
    if (rig.mode !== 'follow') { want = null; keepUrl(); return; }
    // following someone else: the viewer's pick while the agent is on the street → let go; the rig's own pick while they were hidden →
    // back on them now that they are drawn again
    // (the rig only picks someone itself after the subject has been gone a while: a different subject the frame after we were on
    // them, with their walker drawn, is the viewer's own pick)
    if (s && lastOn) { want = null; keepUrl(); return; }
    if (w) rig.setMode('follow', { subject: w });
  }
  let lastOn = false;
  const tick = () => { const s = rig?.subject; lastOn = !!want && rig?.mode === 'follow' && !!s?.agent && s.aid === want && !!rig.people?.byAid(want); };
  return {
    frame() { frame(); tick(); },
    // the card's Follow (id) or its stop (null); a restore (the tape's Back) passes the id it put the rig back on
    want(id) { want = id || null; pending = false; tries = 0; keepUrl(); tick(); },
    // the tape's Back across the reload: follow this agent once the new page has placed them
    after(id) { want = id || null; pending = !!id; tries = 0; keepUrl(); },
    get wanted() { return want; },
  };
}
