// HUMAN LAYER · SECTION 2b · THE VOYEUR TOYS, MOUNTED: trails (ui/tape/trails.js), the heat map (ui/tape/heat.js), the diary room
// (ui/diary.js) and clips (ui/clip.js), on top of the tape (ui/tape/state.js, section 2a: optional — without it everything works on
// the live city and on sim.tape.get). The dossier (ui/dossier.js) loads this once and hands over its "more" row:
//   dossier   Where they went (the open agent's trail on/off, its colour when on) · Diary (TAPE / YOURS / ARCHIVE)
//   ⋯         (in the dossier's row) shows the compact tools: Heat: Presence · Crimes · Deals · the ramp, and Clip · length · OSD ·
//             Save cut (tape in/out). One group at the left under the dev bar (it steps aside when the dossier docks left), shown only
//             while asked for or in use (a trail, the heat map, a recording), so nothing sits on the city's or the tape's chrome.
//   keys      M heat (off → presence → crimes → deals → off) · K clip · J the open agent's diary · I / O in and out marks (tape open)
// window.__toys in the console: { trails, heat, diary, clips, stats() }.
import { h, set, attr, button, toast, getRoot } from './kit.js';
import { createTrails } from './tape/trails.js';
import { createHeat } from './tape/heat.js';
import { createDiary } from './diary.js';
import { createClips } from './clip.js';

export async function mountToys({ api, sim, portraits, dossier }) {
  if (!document.querySelector('link[data-diary-css]')) document.head.append(h('link', { rel: 'stylesheet', href: new URL('./diary.css', import.meta.url).href, 'data-diary-css': '' }));
  const root = getRoot();
  let tape = null; try { tape = (await import('./tape/state.js')).tape; } catch { tape = null; }   // (section 2a; optional)
  const trails = createTrails({ api, sim, tape }), heat = createHeat({ api, sim, tape }), diary = createDiary({ sim, portraits }), clips = createClips({ api, sim, tape });
  const tools = h('div', { class: 's2-tools', hidden: true }, heat.el, clips.el), bar = h('div', { class: 's2-bar' }, tools); root.append(bar);
  let asked = false; const syncTools = () => { tools.hidden = !(asked || heat.mode || clips.recording); attr(toolsB, 'aria-pressed', String(!tools.hidden)); toolsB.classList.toggle('is-on', !tools.hidden); };
  // ── the dossier's entry points
  const trailB = button('Where they went', { tip: 'Their trail on the map (public: live)', onclick: () => { const c = dossier.current; if (!c) return; trails.toggle(c); sync(); } });
  const sw = h('i', { class: 'dm-sw' }); trailB.prepend(sw);
  const lensTag = h('span', { class: 'dm-lens' });
  const diaryB = button('Diary', { tip: 'Their day, confessed: thoughts and what they said (TAPE: a game day late)', onclick: () => { const c = dossier.current; if (c) diary.show(c); } }); diaryB.append(lensTag);
  const toolsB = button('⋯', { tip: 'Heat map and clips (M heat · K clip)', cls: 'dm-tools', onclick: () => { asked = !asked; syncTools(); } });
  dossier.more.append(trailB, diaryB, toolsB); setInterval(() => { if (!tools.hidden !== !!(asked || heat.mode || clips.recording)) syncTools(); }, 500);
  function sync() {
    const c = dossier.current; if (!c) return; const on = trails.has(c), col = trails.colourOf(c);
    trailB.classList.toggle('is-on', on); set(trailB.querySelector('.k-btn-label'), on ? 'Hide trail' : 'Where they went'); sw.style.setProperty('--tr', col || 'currentColor'); sw.hidden = !on;
    const L = diary.lensOf(c); set(lensTag, L.toUpperCase()); diaryB.classList.toggle('is-yours', L === 'yours'); diaryB.classList.toggle('is-archive', L === 'archive');
    attr(diaryB, 'data-tip', L === 'yours' ? 'Your agent’s day, live: its thoughts and what it said' : L === 'archive' ? 'Their day, confessed (the whole season is open)' : 'Their day, confessed: thoughts and what they said (TAPE: a game day late)');
  }
  dossier.onAgent = () => sync(); trails.onChange = () => sync(); sync();
  // ── the tape's timeline: the clip's in/out as a range
  const origMark = clips.mark; clips.mark = which => { origMark(which); const m = clips.marks; if (tape?.timeline) tape.timeline.range('clip', m.in != null && m.out != null ? { from: Math.min(m.in, m.out), to: Math.max(m.in, m.out), label: 'clip', color: '--d-rec' } : m.in != null ? { from: m.in, to: m.in, label: 'in', color: '--d-rec' } : null); };
  // ── keys (capture; never while typing, never while the diary has the keys)
  const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  addEventListener('keydown', e => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey || diary.isOpen || document.body.classList.contains('cam-photo')) return; const k = e.code; let used = true;
    if (k === 'KeyM' && !e.shiftKey) { const m = heat.cycle(); syncTools(); toast(m ? `Heat: ${m}` : 'Heat off'); }
    else if (k === 'KeyK') { clips.recording ? clips.stop() : clips.start(); }
    else if (k === 'KeyJ' && dossier.current) diary.show(dossier.current);
    else if ((k === 'KeyI' || k === 'KeyO') && tape?.active) clips.mark(k === 'KeyI' ? 'in' : 'out');
    else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  const toys = { trails, heat, diary, clips, tape, bar, tools: on => { asked = on ?? !asked; syncTools(); }, stats: () => ({ trails: trails.stats(), heat: heat.stats(), diary: { open: diary.isOpen, handle: diary.handle, day: diary.day, state: diary.entry?.state, lines: diary.entry?.lines?.length }, clip: { recording: clips.recording, last: clips.last && { name: clips.last.name, bytes: clips.last.bytes, secs: clips.last.secs } } }) };
  window.__toys = toys; if (api.ui) api.ui.toys = toys;
  return toys;
}
