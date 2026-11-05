// GAME §41, 2026-11-03: a named card cannot identify a hooded body by a missing ring.
// Headless Chrome on the record page, real People / body input, the rendered mesh and pin DOM.
//   node style/city/tools/hoodringcheck.mjs --port 5986 --seed 404
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PORT, arg, sleep, open, serve, chrome, centre, press, report, writeResult } from './c2lib.mjs';

const SEED = +arg('seed', 404), OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-checks/hoodring')));
if (!PORT) throw new Error('usage: node style/city/tools/hoodringcheck.mjs --port <port> --seed 404');
if (!fs.existsSync(path.join(ROOT, `core/runs/${SEED}-A/feed.jsonl`))) throw new Error('recorded feed required; this check never generates a season');
const q = JSON.stringify, steps = [], result = { seed: SEED };
const step = (name, ok, detail) => steps.push({ name, ok: !!ok, detail });
let server, B;

async function clearHover() {
  await B.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
  await sleep(400);
}
async function markers(ids) {
  return B.ev(`(() => { const U = window.__recordUI, c = window.__city, R = window.__record;
    const rings = c.scene.getObjectByName('ui-rings'), M = new c.THREE.Matrix4();
    return { minute: R.player.minute, pins: U.city.pins, visiblePins: document.querySelectorAll('.k-pin:not(.is-off)').length,
      clusters: U.city.clusters().length, totalRings: rings.count, hot: U.city.hot, mode: c.cam.mode, followed: U.follow.wanted,
      card: U.dossier.current, named: !!U.dossier.el.querySelector('[data-k="card.name"]'),
      bodies: ${q(ids)}.map(id => { const a = R.draw.agents.map.get(id), w = a?.w, p = U.city.screenOf(id); let n = 0;
        if (w) for (let i = 0; i < rings.count; i++) { rings.getMatrixAt(i, M); const e = M.elements;
          if (Math.hypot(e[12] - w.p[0], e[13] - w.p[1] - .045, e[14] - w.p[2]) < .08) n++; }
        return { id, drawn: !!w && !w.gone, hooded: R.draw.hoodedAt(id, R.player.minute),
          onScreen: !!p && p.x > 0 && p.x < innerWidth && p.y > 0 && p.fy < innerHeight, rings: n }; }) }; })()`);
}
async function byPeople(id) {
  // Open the actual menu and roster row. Closing People leaves the named card open.
  const menu = await centre(B, `[...document.querySelectorAll('#r-menu button')].find(b => b.querySelector('.k-btn-label')?.textContent === 'People')`);
  if (!menu) throw new Error('no People menu button');
  await press(B, menu);
  const p = await centre(B, `(() => { const n = document.querySelector('#r-people [data-agent="${id}"]'); n?.scrollIntoView({ block: 'center' }); return n; })()`);
  if (!p) throw new Error('no People row for ' + id);
  await press(B, p);
  const close = await centre(B, `document.querySelector('#r-people .r-x')`);
  if (!close) throw new Error('no People close control');
  await press(B, close); await clearHover();
}
function unmarked(s) {
  return !s.pins && !s.visiblePins && !s.clusters && !s.totalRings && !s.hot && s.mode === 'orbit' && !s.followed
    && s.bodies.every(b => b.drawn && b.onScreen && !b.rings);
}

try {
  server = await serve(); B = await chrome();
  await open(B, SEED, 'recordAt=2706&recordPaused=1&tod=night&simtod=0&tv=0');
  await B.send('Page.bringToFront');
  await B.ev('window.__recordUI.city.setPins(false)');
  const windows = await B.ev(`(() => { const out = []; for (const [id, ws] of window.__record.draw.masks)
    for (const w of ws) if (Number.isFinite(w.off) && w.off - w.on > .1) out.push({ id, minute: (w.on + w.off) / 2 }); return out; })()`);
  let pair = null;
  for (const w of windows) {
    // Only diagnostic setup uses the drawing/camera API. Every selection under test is real input.
    await B.ev(`window.__record.player.seek(${w.minute})`); await sleep(300);
    pair = await B.ev(`(() => { const R = window.__record, c = window.__city, h = R.draw.agents.map.get(${q(w.id)})?.w;
      if (!h || h.gone || !R.draw.hoodedAt(${q(w.id)}, R.player.minute)) return null;
      const controls = [...R.draw.agents.map].filter(([id, a]) => a.w && !a.w.gone && !R.draw.hoodedAt(id, R.player.minute))
        .map(([id, a]) => ({ id, w: a.w, d: Math.hypot(a.w.p[0] - h.p[0], a.w.p[2] - h.p[2]) }))
        .filter(a => a.d > 2 && a.d < 35).sort((a, b) => a.d - b.d);
      if (!controls.length) return null; const a = controls[0], x = (h.p[0] + a.w.p[0]) / 2, z = (h.p[2] + a.w.p[2]) / 2;
      c.cam.toOrbit({ instant: true }); c.controls.target.set(x, .6, z);
      c.camera.position.set(x + 7, Math.max(18, a.d * 1.4), z + Math.max(22, a.d * 1.8)); c.controls.update();
      return { hooded: ${q(w.id)}, control: a.id, minute: R.player.minute, distance: a.d }; })()`);
    if (pair) { await clearHover(); const s = await markers([pair.hooded, pair.control]); if (s.bodies.every(b => b.drawn && b.onScreen)) break; pair = null; }
  }
  if (!pair) throw new Error('no simultaneously drawn, on-screen hooded/control pair');
  result.pair = pair;
  const ids = [pair.hooded, pair.control], baseline = await markers(ids);
  step('same-minute visible hooded/control pair; pins off, nobody followed', unmarked(baseline)
    && baseline.bodies[0].hooded && !baseline.bodies[1].hooded, { pair, baseline });
  await byPeople(pair.hooded); result.hooded = await markers(ids);
  await byPeople(pair.control); result.control = await markers(ids);
  step('People hooded: named card, no body marker', result.hooded.card === pair.hooded && result.hooded.named && unmarked(result.hooded), result.hooded);
  step('People control: named card, identical absence of rings and pins', result.control.card === pair.control && result.control.named
    && unmarked(result.control) && result.control.minute === result.hooded.minute, result.control);

  // Click the already-selected control, then leave the body: a hover ring cannot satisfy selection.
  const p = await B.ev(`window.__recordUI.city.screenOf(${q(pair.control)})`);
  const body = { x: (p.x + p.fx) / 2, y: (p.y + p.fy) / 2 };
  const pick = await B.ev(`window.__recordUI.city.pickAt(${body.x}, ${body.y})`);
  const canvas = await B.ev(`document.elementFromPoint(${body.x}, ${body.y}) === window.__city.renderer.domElement`);
  await press(B, body); await clearHover(); result.clicked = await markers(ids);
  step('body click retains control ring after pointer leaves', canvas && pick?.h === pair.control
    && result.clicked.card === pair.control && !result.clicked.hot && result.clicked.totalRings === 1
    && result.clicked.bodies[0].rings === 0 && result.clicked.bodies[1].rings === 1
    && !result.clicked.pins && !result.clicked.visiblePins && result.clicked.mode === 'orbit' && !result.clicked.followed, result.clicked);
  await byPeople(pair.control); result.reopened = await markers(ids);
  step('People clears a previous body selection ring', result.reopened.card === pair.control && unmarked(result.reopened), result.reopened);
  await B.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...body }); await sleep(400);
  result.hovered = await markers(ids);
  step('control hover still rings', result.hovered.hot === pair.control && result.hovered.bodies[1].rings === 1, result.hovered);
  step('browser errors', !B.errors.length, B.errors);
} catch (e) { result.error = String(e.stack || e); step('run', false, { error: result.error }); }
finally { await B?.close(); server?.kill(); }
result.ok = steps.length > 0 && steps.every(s => s.ok); result.steps = steps;
report('hoodringcheck', steps, await writeResult(OUT, result));
process.exitCode = result.ok ? 0 : 1;
