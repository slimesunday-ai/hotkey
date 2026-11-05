// C2 · shared by the record viewer's card and timeline checks (followcheck, pocketscheck, backcheck, dotscheck): the season read
// in node (the feed played forward, each event's first publication, a snapshot at any minute) and real input on the page (CDP).
// The harness is recordscenario.mjs's (chrome, ready, serve: this checkout on --port unless the port already answers).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, serve, choose, click, clickText } from './recordscenario.mjs';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
export const PORT = +arg('port', 0), BASE = `http://127.0.0.1:${PORT}`, DAY = 1440;
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const FEED = s => `/core/runs/${s}-A/feed.jsonl`;
export { chrome, ready, serve, choose, click, clickText };
const { createShowPlayer, createShowPlanner } = await import('../simstate/record/show-plan.js');
const { revealAt } = await import('../simstate/record/player.js');
const { createTapeReader } = await import('../simstate/record/tape-data.js');
const { CITY_PLACES, HOUSE_LOTS } = await import('../simstate/record/places.js');
// (camera/director.js placeXZ, without three)
export const placeXZ = p => { if (!p) return null; const q = HOUSE_LOTS.find(l => l.id === p.cityPlace) ?? CITY_PLACES[p.standPlace] ?? CITY_PLACES[p.cityPlace]; return q ? { x: q.x, z: q.z } : null; };
export const tod = m => { const r = ((m % DAY) + DAY) % DAY; return r >= 360 && r < 1200 ? 'day' : 'night'; };

// the season in node: frames, the tape reader, a snapshot at any minute (the store's, without the stager's plan), first publications
export function season(seed) {
  const file = path.join(ROOT, FEED(seed).slice(1));
  if (!fss.existsSync(file)) { const r = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(seed), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); }
  const frames = fss.readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l)), planner = createShowPlanner(frames), reader = createTapeReader(frames);
  const P = createShowPlayer(frames, { speed: 60 }), first = new Map(), firstForm = new Map();
  const note = s => { for (const e of s.events) { if (!first.has(e.id)) first.set(e.id, s.minute); const k = e.id + ':' + e.type; if (!firstForm.has(k)) firstForm.set(k, s.minute); } };
  P.on(note); note(P.snapshot());
  const nights = frames.filter(f => f.step.kind === 'night').map(f => f.day), cues = new Set(frames.map(revealAt));
  for (const n of nights) { const p = planner.night(n); cues.add(p.start); cues.add(p.end); for (const s of p.scenes) cues.add(s.end); }
  P.play();
  for (const c of [...cues].sort((a, b) => a - b)) { if (c <= P.minute) continue; if (!P.running) P.play(); P.advance(c - P.minute + 1e-6); }
  const stateAt = m => { const { show, ...s } = createShowPlayer(frames).seek(m); return s; };
  return { seed, frames, planner, reader, first, firstAs: (id, type) => firstForm.get(id + ':' + type), stateAt, bounds: P.bounds, nights };
}

// ── the page
export async function open(B, seed, q) {
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED(seed)}&${q}` });
  await sleep(400); await ready(B); await uiReady(B);
}
export async function uiReady(B, timeout = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await B.ev('!!window.__recordUI && !!window.__record?.draw', false).catch(() => false)) return; await sleep(200); }
  throw new Error('the record UI did not mount');
}
export const centre = (B, js) => B.ev(`(() => { const n = ${js}; if (!n) return null; const r = n.getBoundingClientRect(); return r.width && r.height ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; })()`);
export async function press(B, p) { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 }); }
export async function key(B, k, code, vk) { for (const type of ['keyDown', 'keyUp']) await B.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }); }
// the camera onto a walker, then a real click on it (between its feet and its head) → the dossier's agent (panelscenario's way)
export async function clickAgent(B, id) {
  const p = await B.ev(`(() => { const a = window.__record.draw.agents?.map.get(${JSON.stringify(id)}); return a?.w && !a.w.gone ? [a.w.p[0], a.w.p[2]] : null; })()`);
  if (!p) return null;
  await B.ev(`(() => { const c = window.__city; if (c.cam && c.cam.mode !== 'orbit') c.cam.toOrbit({ instant: true }); c.controls.target.set(${p[0]}, 0.6, ${p[1]}); c.camera.position.set(${p[0] + 7}, 9, ${p[1] + 11}); c.controls.update?.(); return true; })()`);
  for (let k = 0; k < 20; k++) { await sleep(150); const sp = await B.ev(`window.__recordUI.city.screenOf(${JSON.stringify(id)})`); if (sp) {
    await press(B, { x: sp.x + (sp.fx - sp.x) * .5, y: sp.y + (sp.fy - sp.y) * .5 });
    await sleep(300); return B.ev('window.__recordUI.dossier.current'); } }
  return null;
}
// a drawn agent at the page's minute (a walker, not gone), preferring the given ids
export async function drawnAgent(B, prefer = []) {
  return B.ev(`(() => { const m = window.__record.draw.agents?.map; if (!m) return null; const ok = id => { const a = m.get(id); return !!(a?.w && !a.w.gone); };
    for (const id of ${JSON.stringify(prefer)}) if (ok(id)) return id; for (const id of m.keys()) if (ok(id)) return id; return null; })()`);
}
export const CAM = `(() => { const c = window.__city.cam, s = c?.subject; return { mode: c?.mode ?? null, aid: s?.agent ? s.aid : null }; })()`;
export function report(name, steps, out) {
  const ok = steps.length > 0 && steps.every(s => s.ok);
  for (const s of steps) console.log(`${s.ok ? 'PASS' : 'FAIL'} ${s.name} ${JSON.stringify(s.detail)}`);
  console.log(`${ok ? name.toUpperCase() + ' PASS' : name.toUpperCase() + ' FAIL'}${out ? ' · ' + path.relative(ROOT, out) : ''}`);
  return ok;
}
export async function writeResult(dir, obj) { await fs.mkdir(dir, { recursive: true }); const f = path.join(dir, 'result.json'); await fs.writeFile(f, JSON.stringify(obj, null, 1)); return f; }
