// Render pipeline pass · LOOKS (presets). A look is a plain JSON diff of the render settings, { section: { key: value } } — exactly
// settings.snapshot() — so an empty object is today's look ("current"). Built-ins live in render/presets/<name>.json and are listed in
// render/presets/index.json ({ "presets": [{ "name", "label" }] }); keys starting with "_" (notes) are ignored. Custom looks are saved
// in this browser's localStorage. ?preset=<name> loads one at start (a built-in first, then a custom one of that name).
import * as S from './settings.js';

// THE DEFAULT LOOK (film emulation pass, 2026-10-05): what a viewer sees with no ?preset — slime's own Camcorder '98. Shots, bakes, hashes,
// audits, benches and nodyn tool runs stay on `current` (main.js), so the pixel regression checks don't move. ?preset=current: today's plain render.
export const DEFAULT_LOOK = 'camcorder-98';
const BASE = new URL('./presets/', import.meta.url), KEY = 'city.render.looks';
const clean = v => { const out = {}; for (const [k, x] of Object.entries(v || {})) if (!k.startsWith('_') && x && typeof x === 'object' && !Array.isArray(x)) out[k] = x; return out; };
export async function builtins() {
  try { const r = await fetch(new URL('index.json', BASE), { cache: 'no-store' }); return r.ok ? ((await r.json()).presets || []) : []; } catch { return []; }
}
export function customs() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } }
export function saveCustom(name, values) { const c = customs(); c[name] = clean(values); try { localStorage.setItem(KEY, JSON.stringify(c)); return true; } catch { return false; } }
export function deleteCustom(name) { const c = customs(); delete c[name]; try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} }
// (a built-in's file is fetched only when index.json lists it — or when the index can't be read — so a look saved in another browser, or a
// typo, costs no 404; null: no look of that name, and the caller keeps its own default)
export async function fetchLook(name) {
  if (!name || name === 'current') return {};
  const b = await builtins();
  if (!b.length || b.some(p => p.name === name)) try { const r = await fetch(new URL(encodeURIComponent(name) + '.json', BASE), { cache: 'no-store' }); if (r.ok) return clean(await r.json()); } catch {}
  const c = customs(); if (c[name]) return clean(c[name]);
  console.info(`render look "${name}": no built-in (render/presets/index.json) or look saved in this browser by that name`); return null;
}
// A look that names no light section (time, light, sky, fog, clouds, contact, night: meta.group 'light') is a post-only look: it keeps the
// page's current light, so a film look on the night build stays night (a bundled look still resets the light it doesn't list to day).
export async function applyLook(name) { const v = await fetchLook(name); if (!v) return v;
  const light = S.sections().filter(s => s.meta?.group === 'light').map(s => s.name), out = { ...v };
  if (name !== 'current' && !Object.keys(v).some(k => light.includes(k))) { const snap = S.snapshot(); for (const k of light) if (snap[k]) out[k] = snap[k]; }
  S.load(out, { reset: true }); return v; }
export const parseLook = text => clean(JSON.parse(text));
