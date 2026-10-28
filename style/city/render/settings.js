// RENDER SETTINGS CONTRACT (render pass, 2026-09-28): one live settings object drives every render and lighting setting.
// Modules REGISTER their controls here; the panel is generated from what is registered; a preset is a plain JSON diff of the values.
// Keep this API stable. The pipeline agent owns the post stack, the panel and preset I/O; the lighting agent owns lights, sky, clouds,
// fog and night. Each registers its own sections from its own module, so nobody edits another's fields.
//
//   register(section, fields, apply, meta?)   fields: { key: spec }, where a spec is one of
//       { v: 1.0, min: 0, max: 4, step: .01 }        a number (slider)
//       { v: true }                                  a toggle
//       { v: 'neutral', options: ['neutral', …] }    a choice
//       { v: '#fff2dc', color: true }                a colour
//     plus an optional `label` and `hint`. apply(values) runs once on register and after every change to that section.
//     meta: { title, group: 'post' | 'light', order } (the panel's grouping; `order` sorts the post stack).
//   get(section)                 the section's live values (a plain object: read, don't mutate)
//   set(section, key, value)     change one value → apply(section) and listeners
//   load(values, { reset })      apply a preset's { section: { key: value } } (reset: every other value back to its default first)
//   snapshot()                   every current value that differs from its default: what a preset file stores
//   defaults()                   the whole default state (the default IS today's look; see below)
//   on(fn)                       listen to every change: fn(section, key, value)
//
// THE DEFAULT IS TODAY'S LOOK. With no preset loaded, the city must render exactly as it did before this pass (Neutral tone mapping,
// the current sun, fill, fog and sky, the static CSS grain). Every new effect registers switched off or at a neutral value.
//
// Pipeline-pass extensions (the API above is unchanged):
//   · a field named `on` ({ v: false }) is the section's on/off switch: the panel shows it in the section header, not the body
//   · a spec may carry `hidden: true` (kept in presets, not shown), and meta may carry `hidden` (no panel box) and `fixed` (a post
//     section that is not part of the reorderable stack)
//   · load() keeps the values of sections that have not registered yet and hands them over when they do (PENDING), so a preset or
//     ?preset= loaded early still reaches a module that registers late; with { reset } the pending set is replaced, otherwise merged
const REG = new Map(), LIS = new Set(); let PENDING = {};
export function register(section, fields, apply = () => {}, meta = {}) {
  const values = {}; for (const [k, s] of Object.entries(fields)) values[k] = s.v;
  const want = PENDING[section]; if (want) { for (const k of Object.keys(want)) if (k in fields) values[k] = want[k]; delete PENDING[section]; }
  REG.set(section, { fields, apply, meta, values }); try { apply(values); } catch (e) { console.warn('render settings: apply', section, e); }
  if (want) for (const fn of LIS) fn(section, null, null);
  return values;
}
export const sections = () => [...REG.entries()].map(([name, r]) => ({ name, fields: r.fields, meta: r.meta, values: r.values }));
export const get = section => REG.get(section)?.values;
export function set(section, key, value) {
  const r = REG.get(section); if (!r || !(key in r.fields)) return false;
  r.values[key] = value; try { r.apply(r.values); } catch (e) { console.warn('render settings: apply', section, e); }
  for (const fn of LIS) fn(section, key, value); return true;
}
export function load(values = {}, { reset = true } = {}) {
  if (reset) PENDING = {}; for (const [name, v] of Object.entries(values || {})) if (!REG.has(name) && v && typeof v === 'object') PENDING[name] = { ...(PENDING[name] || {}), ...v };
  for (const [name, r] of REG) {
    const want = values[name] || {}; let changed = false;
    for (const [k, s] of Object.entries(r.fields)) { const v = k in want ? want[k] : reset ? s.v : r.values[k]; if (r.values[k] !== v) { r.values[k] = v; changed = true; } }
    if (changed) { try { r.apply(r.values); } catch (e) { console.warn('render settings: apply', name, e); } }
  }
  for (const fn of LIS) fn(null, null, null);
}
export function snapshot() {
  const out = {}; for (const [name, r] of REG) for (const [k, s] of Object.entries(r.fields)) if (r.values[k] !== s.v) (out[name] ??= {})[k] = r.values[k];
  return out;
}
export function defaults() { const out = {}; for (const [name, r] of REG) { out[name] = {}; for (const [k, s] of Object.entries(r.fields)) out[name][k] = s.v; } return out; }
export const on = fn => { LIS.add(fn); return () => LIS.delete(fn); };
