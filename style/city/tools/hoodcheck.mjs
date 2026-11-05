// Hood ownership and UI naming, using the drawing's own cast and mask windows.
// --root can point at e807ca3; --feeds keeps both runs on the same public feeds.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';
import { Node, installDOM, visibleText } from './hood-dom.mjs';
import { surfaceProbe } from './hood-surfaces.mjs';
// Morning-card portraits use a supplied renderer. No WebGL is run in node.
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n) { if (s === 'three') return {url:'data:text/javascript,export default {};',shortCircuit:true}; return n(s,c); }`));
const arg = k => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null;
const root = path.resolve(arg('--root') ?? fileURLToPath(new URL('../../../', import.meta.url)));
const feeds = path.resolve(arg('--feeds') ?? path.join(root, 'core/runs'));
const mod = p => import(pathToFileURL(path.join(root, 'style/city', p)).href);
const [{ parseFeed }, { createShowPlanner, createShowPlayer }, { createRoutinePlanner }, { createTrips }, { addressesFor }, { DISTRICTS }, continuity, { who }, { rowEl }, { createTv }] = await Promise.all([
  mod('simstate/record/adapter.js'), mod('simstate/record/show-plan.js'), mod('simstate/record/routines.js'), mod('simstate/record/trips.js'),
  mod('simstate/record/addresses.js'), mod('simstate/record/places.js'), mod('simstate/record/continuity.js'), mod('ui/record/board.js'), mod('ui/record/parts.js'), mod('ui/record/tv.js'),
]);
installDOM();
const { createDossier } = await mod('ui/record/dossier.js');
const identityFile = path.join(root, 'style/city/ui/record/identity.js');
const identityModule = fs.existsSync(identityFile) ? await mod('ui/record/identity.js') : null;
// The old tape kept words() inside its DOM constructor. Probe that exact source
// for the before count; the corrected tape exports the same formatter it uses.
async function tapeFormatter() {
  if (fs.existsSync(path.join(root, 'style/city/ui/record/tape-format.js'))) return (await mod('ui/record/tape-format.js')).tapeWords;
  const source = fs.readFileSync(path.join(root, 'style/city/ui/record/tape.js'), 'utf8');
  const url = p => JSON.stringify(pathToFileURL(path.join(root, 'style/city', p)).href);
  const constants = ['KIND', 'BETRAY', 'clockOf'].map(k => source.match(new RegExp(`^const ${k} = .+;$`, 'm'))[0]).join('\n');
  const names = identityModule ? `import {nameOf as viewerName} from ${url('ui/record/identity.js')};` : '';
  const code = `import {islandClock} from ${url('simstate/record/adapter.js')}; import {actionOf,placeOf} from ${url('ui/record/tv.js')};
    ${names} ${constants} let snapshot; const sim={record:()=>snapshot}, retained=null, byId=new Map();
    ${source.slice(source.indexOf('  const board = ()'), source.indexOf('  // ── the markers:'))}
    export const probe=(m,e,s)=>{snapshot=s;return words(m,e);};`;
  return (await import('data:text/javascript,' + encodeURIComponent(code))).probe;
}
const formatTape = await tapeFormatter();
const { createTapeReader } = await mod('simstate/record/tape-data.js');
let failed = false;
const all = { masked: 0, unresolved: 0, castTwice: 0, wrongFight: 0, receiptContinuations: 0, missingMaskWindows: 0, samples: 0, bodyLeaks: 0, selectorLeaks: 0, dossierLeaks: 0, namedActionFailures: 0, disclosedCaptionFailures: 0, nameComparisons: 0, nameChanges: 0 };
for (const seed of [404, 405, 406]) {
  const frames = parseFeed(fs.readFileSync(path.join(feeds, `${seed}-A/feed.jsonl`), 'utf8'));
  const planner = createShowPlanner(frames), routines = createRoutinePlanner(frames), timeline = continuity.buildTimeline(frames, routines, planner);
  const rule = continuity.createTripRule({ timeline, planner, trips: createTrips() }), book = addressesFor(frames[0].board.agents.map(a => a.id));
  const count = Object.fromEntries(Object.keys(all).map(k => [k, 0])), problems = [], missingWindows = [], masks = new Map(), casts = new Map();
  for (const frame of frames.filter(f => f.step.kind === 'night')) {
    const plan = planner.night(frame.day), cast = continuity.maskedCast(frame, plan, book, DISTRICTS);
    casts.set(frame.day, cast);
    for (const [id, at] of Object.entries(cast.masked)) {
      count.masked++;
      // Arrest/ferry receipts keep the same walker, but are not masked plays.
      const allScenes = (cast.byAgent.get(id) ?? []).map(s => plan.scenes.find(sc => sc.id === s));
      const scenes = allScenes.filter(sc => sc.beat === 'fight' || sc.kind === 'hooded').map(sc => sc.id);
      count.receiptContinuations += allScenes.length - scenes.length;
      if (!scenes.length) count.unresolved++;
      if (scenes.length > 1) count.castTwice++;
      if (at.fight != null && scenes.some(s => plan.scenes.find(sc => sc.id === s)?.eventId !== at.fight)) count.wrongFight++;
      if (scenes.length !== 1 || at.fight != null && plan.scenes.find(sc => sc.id === scenes[0])?.eventId !== at.fight) problems.push({ night: frame.day, id, fight: at.fight ?? null, scenes });
    }
    const windows = continuity.maskWindows(timeline, rule, plan, cast, book, DISTRICTS);
    for (const id of Object.keys(cast.masked)) if (!windows.has(id)) { count.missingMaskWindows++; missingWindows.push({ night: frame.day, id }); }
    for (const [id, w] of windows) (masks.get(id) ?? masks.set(id, []).get(id)).push(w);
  }
  const draw = { masks, casts, planner, hoodedAt: (id, m) => !!masks.get(id)?.some(w => w.on <= m && m < w.off) };
  let followed = null;
  const identity = identityModule?.createIdentity({ draw: () => draw, following: () => followed });
  const tv = createTv({ root: new Node(), onToggle() {}, snapshot: () => namingSnapshot });
  const names = await surfaceProbe(mod, formatTape), viewer = createShowPlayer(frames), tapeReader = createTapeReader(frames);
  let namingSnapshot = null;
  for (const [id, windows] of masks) for (const w of windows) {
    for (const minute of [w.on, w.on + .001, Number.isFinite(w.off) ? (w.on + w.off) / 2 : w.on + 1, Number.isFinite(w.off) ? w.off - .001 : w.on + 2, ...(seed === 406 && w.night === 4 && id === 'a24' ? [7032] : [])]) {
      if (!draw.hoodedAt(id, minute)) continue;
      const snapshot = viewer.seek(minute), board = snapshot.board, s = { ...snapshot, ...(identity ? identity.at(minute) : {}) }, name = board.agents.find(a => a.id === id).name;
      namingSnapshot = s;
      const sceneId = casts.get(w.night).byAgent.get(id).find(sid => { const sc = planner.night(w.night).scenes.find(sc => sc.id === sid); return sc.beat === 'fight' || sc.kind === 'hooded'; });
      const eventId = planner.night(w.night).scenes.find(sc => sc.id === sceneId).eventId;
      const row = { id: eventId, type: 'fight', scope: 'public', minute, parts: [{ text: `${name} (@${id})`, source: { eventId, path: 'agent' }, nameSource: { agent: id } }] };
      const texts = [rowEl(row, { snapshot: s, scene: true }).textContent,
        tv.caption({ subjects: [{ id, name, driver: 'private driver' }], kind: 'arrest', place: 'docks' })];
      count.samples++;
      count.bodyLeaks += texts.filter(text => text.includes(id) || text.includes(name)).length;
      // replayCut alone authorizes this overlay, after its age/disclosure gate.
      if (!tv.caption({ subjects: [{ id, name }], recordEventId: 1, kind: 'hit', place: 'docks' }).includes(name)) count.disclosedCaptionFailures++;
      names.compare(s, id, [...tapeReader.markersAt(s), ...tapeReader.betrayalsAt(s)]);
      if (identity) {
        const c = s.identity.of(board, id), label = s.identity.walker({ id, handle: id, name, cls: 'secret trade', crew: 'secret crew', wanted: true });
        const ref = s.identity.ref(id);
        if (c.id != null || c.portrait != null || c.name !== 'Hooded figure' || label.name !== 'Hooded figure' || label.sub || label.wanted || ref.includes(id) || s.identity.resolve(ref) !== id) count.selectorLeaks++;
        if (s.identity.sceneHidden?.(id, -1)) count.selectorLeaks++;
        // Following never unmasks the walker's tag. Its card retains today's follower view.
        followed = id;
        const f = identity.at(minute).identity;
        if (f.of(board, id).id !== id || f.walker({ id, handle: id }).name !== 'Hooded figure') count.selectorLeaks++;
        followed = null;
        for (const m of [w.on - .001, ...(Number.isFinite(w.off) ? [w.off] : [])]) {
          const u = identity.at(m).identity.of(board, id);
          if (!draw.hoodedAt(id, m) && u.id !== id) count.selectorLeaks++;
        }
      }
    }
  }
  // Actual dossier rendering: mask transitions within the same minute/board,
  // an anonymous click, Follow after mask-up, stopping, and hood-off restoration.
  const [aid, windows] = masks.entries().next().value, w = windows[0], player = createShowPlayer(frames);
  let minute = w.on, shows = 0, went = null;
  const walker = { aid, agent: true }, rig = { mode: 'orbit', subject: null, people: { byAid: () => walker }, setMode(mode, o) { this.mode = mode; this.subject = o?.subject ?? null; followed = mode === 'follow' ? aid : null; } };
  const sim = { record: () => ({ ...player.seek(minute), ...(identity ? identity.at(minute) : {}) }) };
  const card = createDossier({ api: { cam: rig, goTo: (x, z, id) => { went = id; } }, sim, root: new Node(), city: { select() {} }, where: () => ({ x: 1, z: 2 }),
    portraits: { player: () => ({ show() { shows++; }, stop() {} }) } });
  const name = frames[0].board.agents.find(a => a.id === aid).name;
  const leaks = () => { const text = visibleText(card.el); return text.includes(aid) || text.includes(name) || text.includes('Go there') || !card.el.querySelector('.r-face')?.hidden; };
  card.open(aid, { from: 'body' });
  if (leaks() || shows) count.dossierLeaks++;
  if (identity) {
    card.toggleFollow(); card.update();
    if (!visibleText(card.el).includes(name) || shows !== 1) count.dossierLeaks++;
    card.toggleFollow(); card.update();
    if (leaks()) count.dossierLeaks++;
    minute = w.on - .001; card.update();
    if (!visibleText(card.el).includes(name)) count.dossierLeaks++;
    minute = w.on; card.update();
    if (leaks()) count.dossierLeaks++;
    card.open(card.reference);
    if (leaks()) count.dossierLeaks++;
    if (Number.isFinite(w.off)) { minute = w.off; card.update(); if (!visibleText(card.el).includes(name)) count.dossierLeaks++; }
    // A by-name card stays named. While its owner's body is hooded, "Go there" follows it and never flies to it (slime, 11-03,
    // GAME.md §41, asked "What do you think we do", then: "Ok go wit your recommendations on the ones I asked you for your
    // recommendations": nothing outside following points at the hooded body; "Go there" follows it instead)
    minute = w.on; card.open(aid);
    const go = card.el.querySelectorAll('button').find(b => b.textContent.includes('Go there'));
    if (!visibleText(card.el).includes(name) || go.hidden || card.reference !== aid) count.namedActionFailures++;
    go.events.click[0](); card.update();
    if (went === aid || rig.mode !== 'follow' || rig.subject?.aid !== aid || !visibleText(card.el).includes(name)) count.namedActionFailures++;
    card.toggleFollow(); card.update();
    if (rig.mode === 'follow' || !visibleText(card.el).includes(name)) count.namedActionFailures++;
  }
  card.close();
  count.nameComparisons = Object.values(names.counts).reduce((a, n) => a + n, 0);
  count.nameChanges = Object.values(names.changes).reduce((a, n) => a + n, 0);
  console.log(`  name surfaces ${JSON.stringify({ comparisons: names.counts, changes: names.changes, examples: names.examples })}`);
  if (!identity) console.log(`seed ${seed}: shared UI identity selector absent (board renderer still probed)`);
  console.log(`seed ${seed}: ${JSON.stringify(count)}`);
  if (problems.length) console.log(`  casts ${JSON.stringify(problems)}`);
  if (missingWindows.length) console.log(`  drawing coverage gap (outside naming/casting scope): ${JSON.stringify(missingWindows)}`);
  for (const k of Object.keys(all)) all[k] += count[k];
  failed ||= ['unresolved', 'castTwice', 'wrongFight', 'bodyLeaks', 'selectorLeaks', 'dossierLeaks', 'namedActionFailures', 'disclosedCaptionFailures', 'nameChanges'].some(k => count[k]);
}
console.log(`HOODCHECK ${failed ? 'FAIL' : 'PASS'} ${JSON.stringify(all)}`);
console.log('Browser still required: picking/cluster positioning, portrait removal, held panels and tooltips across mask/follow/seek transitions, actual walker/stage appearance.');
process.exitCode = failed ? 1 : 0;
