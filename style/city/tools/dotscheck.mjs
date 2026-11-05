// C2 (d) · LEGIBLE DOTS ON THE RECORD BAR (ui/record/tape.js): every marker kind, betrayals included, drawn as its kind, a folded pip
// showing what is inside it, and a click landing where tapescenario's clicks land. Headless Chrome, real clicks, read against the
// feed in node (tape-data.js's reader on a snapshot at the same minute; the betrayals straight from the snapshot's events).
//   node style/city/tools/dotscheck.mjs --port 5962 [--seeds 404,405,406] [--out <dir>]
// 1 kinds   at the season's end and at day 12 21:00 (paused): every pip of one marker wears its kind (data-kind, class is-<kind>) and that
//           kind's glyph ([data-glyph=<kind>]); every folded pip lists its contents (data-kinds "kind:n,…", equal to its ids' kinds) and
//           shows one inside mark per kind it holds (.r-tape-in-k[data-kind]); all six public kinds appear on the bar
// 2 betray  the betrayal dots (.r-tape-bt, data-ids) are exactly the snapshot's disclosed betray receipts (type 'betray'), at the
//           season's end and one minute before and after the first and the last disclosure (never one before its receipt), and each
//           wears the betrayal glyph; seed 404 has 8
// 3 clicks  one marker of each kind and one betrayal (one with a place, one without when the seed has it), each on a fresh page just after
//           its publication, a real click on its pip (a folded one: then its row): the visit starts at its replayStart (±0.01), the
//           camera's target lands within 2 m of its place (when it has one), and the record then plays
import path from 'node:path';
import { ROOT, PORT, arg, sleep, season, open, serve, chrome, centre, press, placeXZ, tod, report, writeResult, DAY } from './c2lib.mjs';

const SEEDS = arg('seeds', '404,405,406').split(',').map(Number), OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-checks/dots')));
if (!PORT) { console.error('usage: node style/city/tools/dotscheck.mjs --port <port>'); process.exit(2); }
const steps = [], result = { seeds: SEEDS, kinds: [], betray: [], clicks: [] };
const KINDS = ['show', 'fight', 'arrest', 'turf', 'sale', 'ferry'];
const DOM = `(() => { const one = b => ({ ids: (b.dataset.ids || '').split(',').filter(Boolean).map(Number), kind: b.dataset.kind ?? null, cls: [...b.classList].filter(c => c.startsWith('is-')),
    glyph: [...b.querySelectorAll(':scope > [data-glyph]')].map(g => g.dataset.glyph), kinds: b.dataset.kinds ?? null, inside: [...b.querySelectorAll('.r-tape-in-k')].map(n => n.dataset.kind) });
  return { pips: [...document.querySelectorAll('#record-player .r-tape-mk')].map(one), bt: [...document.querySelectorAll('#record-player .r-tape-bt')].map(one), minute: window.__record.player.minute }; })()`;
const betrayIds = (S, m) => S.stateAt(m).events.filter(e => e.type === 'betray' && e.minute <= m).map(e => e.id).sort((a, b) => a - b);
const VISIT = `(() => { const t = window.__recordUI.tape; return { v: t.visit, log: t.log.visits.at(-1) ?? null, minute: window.__record.player.minute, running: window.__record.player.running }; })()`;
async function untilPlay(B, timeout = 20000) {
  const t0 = Date.now(); let s = null;
  while (Date.now() - t0 < timeout) { s = await B.ev(VISIT); if (s.log && (s.log.landed || s.log.cancelled) && (!s.v || s.v.phase === 'play')) return s; await sleep(250); }
  return s;
}
const server = await serve(), B = await chrome();
try {
  for (const seed of SEEDS) {
    const S = season(seed), END = S.bounds.to, kindOf = new Map(S.reader.markersAt(S.stateAt(END)).map(m => [m.id, m.kind]));
    // 1 · kinds
    for (const m of [END, 12 * DAY + 1260]) {
      await open(B, seed, `recordAt=${m}&recordPaused=1&tod=${tod(m)}&simtod=0&tv=0`); await sleep(800);
      const d = await B.ev(DOM), errs = [], seen = new Set();
      for (const p of d.pips) {
        const ks = p.ids.map(id => kindOf.get(id));
        for (const k of ks) seen.add(k);
        if (p.ids.length === 1) { if (p.kind !== ks[0] || !p.cls.includes('is-' + ks[0]) || !p.glyph.includes(ks[0])) errs.push({ id: p.ids[0], want: ks[0], kind: p.kind, glyph: p.glyph }); }
        else {
          const n = {}; for (const k of ks) n[k] = (n[k] || 0) + 1;
          const want = Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, c]) => `${k}:${c}`);
          const shown = (p.kinds || '').split(',').filter(Boolean);
          if (JSON.stringify([...shown].sort()) !== JSON.stringify([...want].sort()) || JSON.stringify([...new Set(p.inside)].sort()) !== JSON.stringify(Object.keys(n).sort())) errs.push({ ids: p.ids.slice(0, 6), want, kinds: p.kinds, inside: p.inside });
        }
      }
      const o = { seed, minute: m, pips: d.pips.length, folded: d.pips.filter(p => p.ids.length > 1).length, kinds: [...seen], errs: errs.slice(0, 5), ok: !errs.length && d.pips.length > 0 && (m !== END || KINDS.every(k => seen.has(k))) };
      result.kinds.push(o); steps.push({ name: `kinds ${seed} @${m}`, ok: o.ok, detail: { pips: o.pips, folded: o.folded, kinds: o.kinds, errs: o.errs } });
    }
    // 2 · betrayals: exactly the disclosed receipts, never before
    const all = betrayIds(S, END), firstOf = id => S.firstAs(id, 'betray'), times = [...new Set(all.map(firstOf))].sort((a, b) => a - b);
    const moments = [END, ...(times.length ? [times[0] - 1, times[0] + 1, times.at(-1) - 1, times.at(-1) + 1] : [])];
    for (const m of moments) {
      await open(B, seed, `recordAt=${m}&recordPaused=1&tod=${tod(m)}&simtod=0&tv=0`); await sleep(800);
      const d = await B.ev(DOM), shown = [...new Set(d.bt.flatMap(b => b.ids))].sort((a, b) => a - b), want = betrayIds(S, m);
      const glyphless = d.bt.filter(b => !b.glyph.includes('betray')).length;
      const o = { seed, minute: m, shown: shown.length, want: want.length, extra: shown.filter(i => !want.includes(i)), missing: want.filter(i => !shown.includes(i)), glyphless,
        ok: JSON.stringify(shown) === JSON.stringify(want) && !glyphless && (m !== END || seed !== 404 || want.length === 8) };
      result.betray.push(o); steps.push({ name: `betray ${seed} @${m}`, ok: o.ok, detail: { shown: o.shown, want: o.want, extra: o.extra, missing: o.missing, glyphless } });
    }
    // 3 · clicks
    const markers = S.reader.markersAt(S.stateAt(END)), bts = S.reader.betrayalsAt ? S.reader.betrayalsAt(S.stateAt(END)) : [];
    const pick = [...KINDS.map(k => k === 'fight' ? markers.find(m => m.kind === k && m.place && m.subjects.agent) ?? markers.find(m => m.kind === k) : k === 'ferry' ? markers.find(m => m.kind === k && m.subjects.agent) ?? markers.find(m => m.kind === k) : markers.find(m => m.kind === k)),
      bts.find(b => b.place), bts.find(b => !b.place)].filter(Boolean);
    if (all.length && !bts.length) steps.push({ name: `clicks ${seed} betray`, ok: false, detail: { why: 'no betrayal reader (tape-data betrayalsAt)' } });
    for (const m of pick) {
      const at = (m.kind === 'betray' ? S.firstAs(m.id, 'betray') : S.first.get(m.id)) + 5, sel = m.kind === 'betray' ? '.r-tape-bt' : '.r-tape-mk';
      await open(B, seed, `recordAt=${at}&recordPaused=1&recordSpeed=10&tod=${tod(at)}&simtod=0&tv=0`); await sleep(600);
      const pip = `[...document.querySelectorAll('#record-player ${sel}')].find(b => b.dataset.ids.split(',').includes('${m.id}'))`;
      const p = await centre(B, pip); let ok = !!p, n = 0;
      if (p) { await press(B, p); await sleep(400); n = await B.ev(`(${pip})?.dataset.ids.split(',').length ?? 0`);
        if (n > 1) { const q = await centre(B, `document.querySelector('#r-tape-pop [data-marker="${m.id}"]')`); if (q) await press(B, q); else ok = false; } }
      const s = ok ? await untilPlay(B) : null, place = placeXZ(m.place);
      const visited = !!s?.log && s.log.id === m.id && s.log.kind === 'marker';
      const off = place && s?.log?.landed ? +Math.hypot(s.log.landed.x - place.x, s.log.landed.z - place.z).toFixed(2) : null;
      const o = { seed, id: m.id, kind: m.kind, pip: n, replayStart: +m.replayStart.toFixed(3), sought: s?.log?.sought ?? null, off, playing: s?.running ?? false,
        ok: ok && visited && Math.abs(s.log.sought - m.replayStart) <= .01 && (!place || (off !== null && off <= 2)) && !!s?.running };
      result.clicks.push(o); steps.push({ name: `click ${seed} ${m.kind} ${m.id}`, ok: o.ok, detail: { pip: n, sought: o.sought, replayStart: o.replayStart, off, playing: o.playing } });
    }
  }
} catch (e) { result.error = String(e.stack || e); steps.push({ name: 'run', ok: false, detail: { error: String(e.message || e) } }); }
await B.close(); server?.kill();
result.ok = report('dotscheck', steps, await writeResult(OUT, result));
process.exitCode = result.ok ? 0 : 1;
