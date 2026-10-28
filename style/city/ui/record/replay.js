// C1-10, the drawn half · A MORNING CARD'S REPLAY, in this one place. C1-9 (ui/record/tape.js replayCard) now plays it: the card's
// scene from its start (a card with no scene of its own, a dawn sale, a refund, a crew's receipt: that night's show from its opening),
// at 10×, the director framing the card's victim (tape-data's paper.framing), a lower third, and the playhead and the camera back where
// the viewer was once the scene is over. The card's typed replay {night, eventId} names its scene: the scene of that night's show plan
// whose event is replay.eventId (the page's own planner, the one record/draw.js stages from).
export function sceneOf(page, replay) {
  try { return page.draw?.planner?.night(replay.night)?.scenes.find(s => s.eventId === replay.eventId) ?? null; } catch { return null; }
}
export function replayCard(page, replay, { tape = null } = {}) {
  if (tape) return tape.replayCard(replay);
  const scene = sceneOf(page, replay);
  if (scene) page.player.seek(scene.start); else page.player.jumpShow(replay.night);
  page.player.play();
  return { night: replay.night, eventId: replay.eventId, scene: scene?.id ?? null, place: scene?.place.cityPlace ?? null, minute: page.player.minute };
}
