// Actual name-based renderers, run twice at the same snapshot: masks on/off.
// Canvas and portrait drawing are stubbed by hood-dom; their names/alt text and
// portrait requests are still checked. No browser-layout claim is made here.
import { Node, visibleText } from './hood-dom.mjs';
export async function surfaceProbe(mod, tapeWords) {
  const [{ createPeople }, { createBoard }, { createMap }, { createCards }, { createTicker, createCh9 }, { createDossier }, { windowAt }, { rowEl }, { createMissed }] = await Promise.all([
    mod('ui/record/people.js'), mod('ui/record/board.js'), mod('ui/record/map.js'), mod('ui/record/morning.js'), mod('ui/record/news.js'), mod('ui/record/dossier.js'), mod('ui/record/view.js'), mod('ui/record/parts.js'), mod('ui/record/missed.js'),
  ]);
  const portraits = { thumbNow: id => 'portrait:' + id, thumb: async id => 'portrait:' + id, player: () => ({ show() {}, stop() {} }) };
  const instances = [true, false].map(masks => {
    let state, started = false, now = 0;
    const root = new Node(), sim = { record: () => state }, rig = { mode: 'orbit', people: { byAid: () => ({ agent: true }) } };
    const people = createPeople({ root, sim, dossier: { open() {} } }), board = createBoard({ root, sim }), map = createMap({ root, sim });
    const cards = createCards({ root, sim, portraits, sceneOf: () => null, onReplay() {} });
    const ticker = createTicker({ root, sim }), ch9 = createCh9({ root, sim, showOf: () => state.show });
    const dossier = createDossier({ api: { cam: rig }, root, sim, city: { select() {} }, where: () => null, portraits });
    const missed = createMissed({ root, onReplay() {}, words: m => tapeWords(m, state.events.find(e => e.id === m.id), state) });
    const text = el => JSON.stringify([visibleText(el), el.querySelectorAll('[alt]').map(n => n.getAttribute('alt'))]);
    return { render(s, id, markers) {
      state = masks ? s : { ...s, identity: undefined, identityKey: undefined };
      if (!started) { started = true; people.open(); board.open(); map.open(); cards.open(); ch9.open(); }
      const out = {};
      for (const tab of ['roster', 'heat', 'crews']) { people.select(tab); people.update(false, state); out['people.' + tab] = text(people.el); }
      for (const tab of ['b-street', 'b-list', 'b-fits', 'b-vault']) { board.select(tab); board.update(false, state); out['board.' + tab] = text(board.el); }
      map.update(false, state); out.map = text(map.el);
      cards.update(false, state); out.cards = text(cards.el);
      const window = windowAt(state, id);
      ticker.update(false, window); out.ticker = text(ticker.el);
      ch9.update(false, window);
      // CH9 rows for a current masked scene are body-linked. Other rows must
      // keep their text; compare them individually, including retained history.
      out.ch9History = JSON.stringify(ch9.el.querySelectorAll('[data-ev]').filter(n => !s.board.agents.some(a => s.identity?.sceneHidden?.(a.id, Number(n.dataset.ev)))).map(text));
      dossier.open(id); out.namedDossier = text(dossier.el); out.namedDossierRef = dossier.reference ?? id;
      // Standalone history rows exercise typed person parts even if that story
      // has scrolled off today's small ticker/CH9 display windows.
      const row = { id: -1, type: 'meet', scope: 'public', minute: s.minute - 700, parts: [{ text: `${s.board.agents.find(a => a.id === id).name} (@${id})`, source: { eventId: -1, path: 'a' }, nameSource: { agent: id } }, ' sits down.'] };
      out.oldStory = rowEl(row, { snapshot: state }).textContent;
      const history = markers.filter(m => !s.identity?.sceneHidden?.(m.subjects?.agent, m.id));
      out.tapeHistory = JSON.stringify(history.map(m => tapeWords(m, state.events.find(e => e.id === m.id), state)));
      out.missedHistory = JSON.stringify(history.filter(m => ['fight', 'arrest'].includes(m.kind)).map(m => {
        missed.clear(); now += 21000; const words = tapeWords(m, state.events.find(e => e.id === m.id), state);
        missed.push({ paper: m, ...words }, now); return text(missed.el);
      }));
      return out;
    } };
  });
  const counts = {}, changes = {}, examples = [];
  return { counts, changes, examples, compare(s, id, markers) {
    const [masked, clear] = instances.map(p => p.render(s, id, markers));
    for (const k of Object.keys(clear)) {
      counts[k] = (counts[k] ?? 0) + 1;
      if (masked[k] !== clear[k]) {
        changes[k] = (changes[k] ?? 0) + 1;
        if (examples.length < 8) examples.push({ surface: k, minute: s.minute, id });
      }
    }
  } };
}
