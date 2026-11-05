// Body/scene identity only. Names and public history stay on the board even
// while their owner wears a hood. Call this selector only when attaching an
// identity to a body, or to a scene that the body's own cast actually plays.
export const HOODED = 'Hooded figure';
export function identityOf(board, id, { hooded = false, following = false } = {}) {
  if (hooded && !following) return { id: null, name: HOODED, portrait: null, anonymous: true, hooded };
  return { id, name: board?.agents?.find(a => a.id === id)?.name ?? id, portrait: id, anonymous: false, hooded };
}
export function createIdentity({ draw, following }) {
  let lastDraw, lastMinute, lastFollow, cached;
  function at(minute) {
    const d = draw(), followed = following();
    if (cached && d === lastDraw && minute === lastMinute && followed === lastFollow) return cached;
    lastDraw = d; lastMinute = minute; lastFollow = followed;
    const ids = [...(d?.masks?.keys() ?? [])], hooded = new Set(ids.filter(id => d.hoodedAt(id, minute)));
    const of = (board, id) => identityOf(board, id, { hooded: hooded.has(id), following: followed === id });
    const hidden = id => hooded.has(id) && followed !== id;
    const sceneHidden = (id, eventId) => {
      if (!hidden(id) || eventId == null) return false;
      const w = d.masks.get(id).find(w => w.on <= minute && minute < w.off), cast = d.casts?.get(w.night);
      return !!d.planner?.night(w.night).scenes.some(sc => cast?.byScene.get(sc.id)?.includes(id)
        && (sc.eventId === eventId || sc.revealIds?.includes(eventId)));
    };
    return cached = { identityKey: `${followed ?? ''}|${[...hooded].sort().join(',')}`, identity: {
      of, hidden, sceneHidden,
      // Reload locators keep an anonymous card's real id out of ?dossier=.
      ref: id => hooded.has(id) && followed !== id ? `hooded:${ids.indexOf(id)}` : id,
      resolve: ref => /^hooded:\d+$/.test(ref ?? '') ? ids[Number(ref.slice(7))] ?? null : ref?.startsWith('body:') ? ref.slice(5) : ref,
      // The walker keeps its hooded tag even for a follower who knows its identity.
      walker: c => hooded.has(c.handle ?? c.id) ? { name: HOODED, sub: '', wanted: false } : {
        name: '@' + (c.handle ?? c.id), sub: [c.cls, c.crew && !c.npc ? c.crew : null, c.now].filter(Boolean).join(' · '), wanted: !!c.wanted },
    } };
  }
  return { at };
}
// Snapshots without a viewer (node selectors, the old live path) keep their
// existing board view. Record UI snapshots always carry the viewer's identity.
export const bodyOf = (s, id) => s.identity?.of(s.board, id) ?? identityOf(s.board, id);
export const bodyHidden = (s, id) => !!s.identity?.hidden(id);
export const sceneHidden = (s, id, eventId) => !!s.identity?.sceneHidden?.(id, eventId);
