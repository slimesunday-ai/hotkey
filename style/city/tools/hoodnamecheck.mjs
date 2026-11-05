// GAME §41, 2026-11-03: a name never locates an unfollowed hooded body.
// Headless Chrome, the drawing's own mask windows, real People / Go there / F input.
//   node style/city/tools/hoodnamecheck.mjs --port 5986 --seed 404
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PORT, arg, sleep, open, serve, chrome, centre, press, key, CAM, report, writeResult } from './c2lib.mjs';

const SEED = +arg('seed', 404), OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-checks/hoodname')));
if (!PORT) throw new Error('usage: node style/city/tools/hoodnamecheck.mjs --port <port> --seed 404');
if (!fs.existsSync(path.join(ROOT, `core/runs/${SEED}-A/feed.jsonl`))) throw new Error('recorded feed required; this check never runs a model or generates a season');
const steps = [], result = { seed: SEED, samples: [] };
const step = (name, ok, detail) => steps.push({ name, ok, detail });
const q = value => JSON.stringify(value);
let server, B;

// Put the body in view to inspect the actual InstancedMesh and pin DOM. This
// diagnostic framing is independent of every product action being checked.
async function aim(id) {
  const drawn = await B.ev(`(() => { const c = window.__city, a = window.__record.draw.agents.map.get(${q(id)}), w = a?.w;
    if (!w || w.gone) return false;
    if (c.cam.mode !== 'orbit') c.cam.toOrbit({ instant: true });
    c.controls.target.set(w.p[0], w.p[1] + .6, w.p[2]); c.camera.position.set(w.p[0] + 7, w.p[1] + 9, w.p[2] + 11); c.controls.update(); return true; })()`);
  await B.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
  await sleep(400);
  return drawn;
}
async function markers(id) {
  return B.ev(`(() => { const U = window.__recordUI, c = window.__city, a = window.__record.draw.agents.map.get(${q(id)}), w = a?.w;
    if (!w || w.gone) return { drawn: false };
    const rings = c.scene.getObjectByName('ui-rings'), M = new c.THREE.Matrix4(); let n = 0;
    for (let i = 0; i < rings.count; i++) { rings.getMatrixAt(i, M); const e = M.elements;
      if (Math.hypot(e[12] - w.p[0], e[13] - w.p[1] - .045, e[14] - w.p[2]) < .08) n++; }
    const p = U.city.screenOf(${q(id)}), clustered = U.city.clusters().some(c => c.handles.includes(${q(id)}));
    const pin = p && [...document.querySelectorAll('.k-pin:not(.is-off)')].some(el => {
      const m = new DOMMatrixReadOnly(el.style.transform); return Math.hypot(m.m41 - p.x, m.m42 - (p.y - 8)) < 1.5; });
    return { drawn: true, onScreen: !!p, rings: n, pin: !!pin || clustered, hidden: U.sim.record().identity.hidden(${q(id)}) }; })()`);
}
async function actions() {
  return B.ev(`(() => { const el = window.__recordUI.dossier.el; return {
    buttons: [...el.querySelectorAll('.r-actions button')].map(b => ({ text: b.textContent, hidden: b.hidden, style: b.getAttribute('style'), tip: b.dataset.tip, disabled: b.getAttribute('aria-disabled') })),
    sections: [...el.querySelectorAll('.r-sec > h3')].map(n => n.textContent),
    named: !!el.querySelector('[data-k="card.name"]'), face: !el.querySelector('.r-face').hidden }; })()`);
}
async function go() {
  const p = await centre(B, `[...document.querySelectorAll('#r-dossier button')].find(b => b.textContent === 'Go there')`);
  if (!p) return false;
  await press(B, p); await sleep(700); return true;
}
async function openPeople(id) {
  await B.ev('window.__recordUI.dossier.close(); window.__recordUI.people.open()');
  const p = await centre(B, `(() => { const n = document.querySelector('#r-people [data-agent="${id}"]'); n?.scrollIntoView({block:'center'}); return n; })()`);
  if (!p) return false;
  await press(B, p); await B.ev('window.__recordUI.people.close()'); await sleep(200);
  return await B.ev(`window.__recordUI.dossier.current === ${q(id)}`);
}
// Compare every label, field, button and attribute against the same public
// card rendered without a hood selector, at this exact minute. Using identical
// board data catches omissions that differing rap sheets could otherwise hide.
// A separate, genuinely unhooded agent below checks the ordinary action path.
async function ordinaryMarkup(id) {
  return B.ev(`(async () => { const U = window.__recordUI, s = U.sim.record(), { createDossier } = await import('/style/city/ui/record/dossier.js');
    const { identityOf } = await import('/style/city/ui/record/identity.js');
    const control = { ...s, identityKey: '', identity: { of: (board, id) => identityOf(board, id), hidden: () => false, resolve: id => id } };
    const root = document.createElement('div'), card = createDossier({ api: window.__city, sim: { record: () => control }, root,
      city: { select() {} }, where: () => null, portraits: { player: () => ({ show() {}, stop() {} }) } });
    const html = el => { const copy = el.cloneNode(true); copy.removeAttribute('style');
      copy.querySelector('canvas')?.removeAttribute('data-state'); return copy.innerHTML; };
    const actual = html(U.dossier.el); card.open(${q(id)}); const expected = html(card.el); card.close(); U.dossier.open(${q(id)});
    return { equal: actual === expected, actualLength: actual.length, expectedLength: expected.length,
      firstDifference: actual === expected ? null : [...actual].findIndex((c, i) => c !== expected[i]) }; })()`);
}

try {
  server = await serve(); B = await chrome();
  await open(B, SEED, 'recordAt=2706&recordPaused=1&tod=night&simtod=0&tv=0');
  const windows = await B.ev(`(() => { const out = []; for (const [id, ws] of window.__record.draw.masks)
    for (const w of ws) if (Number.isFinite(w.off) && w.off - w.on > .1) out.push({ id, on: w.on, off: w.off, night: w.night }); return out; })()`);
  const selected = [], ids = new Set();
  for (const w of windows.sort((a, b) => a.night - b.night)) if (!ids.has(w.id)) { selected.push(w); ids.add(w.id); if (selected.length === 4) break; }
  step('drawing mask sample', selected.length === 4, { windows: windows.length, agents: selected.map(w => w.id) });
  for (const w of selected) {
    const minute = (w.on + w.off) / 2, sample = { ...w, minute };
    result.samples.push(sample);
    await open(B, SEED, `recordAt=${minute}&recordPaused=1&tod=night&simtod=0&tv=0&dossier=${w.id}`);
    const drawn = await aim(w.id);
    const urlCard = await B.ev(`window.__recordUI.dossier.current === ${q(w.id)} && window.__city.cam.mode === 'orbit'`);
    const byPeople = await openPeople(w.id);
    sample.orbit = await markers(w.id); sample.markup = await ordinaryMarkup(w.id); sample.actions = await actions();
    step(`${w.id} name card in orbit`, drawn && urlCard && byPeople && sample.orbit.hidden && sample.orbit.onScreen
      && sample.orbit.rings === 0 && !sample.orbit.pin, { minute, urlCard, byPeople, ...sample.orbit });
    step(`${w.id} no omission or swap`, sample.markup.equal && sample.actions.named && sample.actions.face, sample.markup);
    sample.goClicked = await go(); sample.afterGo = await B.ev(CAM);
    sample.kept = await B.ev(`({ wanted: window.__recordUI.follow.wanted, url: new URL(location.href).searchParams.get('follow') })`);
    sample.followed = await markers(w.id);
    step(`${w.id} Go there follows through keeper`, sample.goClicked && sample.afterGo.mode === 'follow' && sample.afterGo.aid === w.id
      && sample.kept.wanted === w.id && sample.kept.url === w.id && !sample.followed.hidden, { ...sample.afterGo, ...sample.kept, hidden: sample.followed.hidden });
    // Stop through the ordinary mode key: retained selection must cease marking
    // the hooded body without closing the named card. F must authorize it again.
    await key(B, '1', 'Digit1', 49); await aim(w.id);
    sample.stopped = await markers(w.id);
    await key(B, 'f', 'KeyF', 70); await sleep(400); sample.afterF = await B.ev(CAM);
    step(`${w.id} stop and F`, sample.stopped.hidden && sample.stopped.rings === 0 && !sample.stopped.pin
      && sample.afterF.mode === 'follow' && sample.afterF.aid === w.id, { stopped: sample.stopped, afterF: sample.afterF });
    // The same minute's real unhooded control keeps Go there's existing orbit
    // fly and has identical named-card actions and section labels.
    await key(B, '1', 'Digit1', 49); await sleep(200);
    const control = await B.ev(`(() => { const U = window.__recordUI, R = window.__record;
      return U.sim.record().board.agents.find(a => !U.sim.record().identity.hidden(a.id) && R.draw.agents.map.get(a.id)?.w && !R.draw.agents.map.get(a.id).w.gone)?.id; })()`);
    await B.ev(`window.__recordUI.dossier.open(${q(control)})`);
    const controlActions = await actions(), clicked = await go(), cam = await B.ev(CAM);
    step(`${w.id} unhooded control`, !!control && clicked && cam.mode === 'orbit'
      && JSON.stringify(controlActions.buttons) === JSON.stringify(sample.actions.buttons)
      && JSON.stringify(controlActions.sections) === JSON.stringify(sample.actions.sections), { control, cam, sameActions: JSON.stringify(controlActions) === JSON.stringify(sample.actions) });
    // A selection held across both mask edges is gated by the presented minute.
    await B.ev(`window.__recordUI.dossier.open(${q(w.id)}); window.__record.player.seek(${w.off})`); await aim(w.id);
    sample.off = await markers(w.id);
    await B.ev(`window.__record.player.seek(${minute})`); await aim(w.id); sample.back = await markers(w.id);
    // slime, 11-03, GAME.md §41: "Ok go wit your recommendations on the ones I asked you for your recommendations".
    // A name-opened card adds no ring at hood-off: only an enabled pin may supply one.
    step(`${w.id} mask edge / seek`, !sample.off.hidden && (sample.off.rings > 0) === sample.off.pin && sample.back.hidden && sample.back.rings === 0 && !sample.back.pin, { off: sample.off, back: sample.back });
  }
  step('browser errors', !B.errors.length, B.errors);
} catch (e) { result.error = String(e.stack || e); step('run', false, { error: result.error }); }
finally { await B?.close(); server?.kill(); }
result.ok = steps.length > 0 && steps.every(s => s.ok); result.steps = steps;
report('hoodnamecheck', steps, await writeResult(OUT, result));
process.exitCode = result.ok ? 0 : 1;
