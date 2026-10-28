// WHO MATTERS · WM5 · THE LEGIBILITY GATE (CDP, headless Chrome, your own replay). Every piece of UI text on the page, in every skin, at
// 1280 × 720, 1440 × 900 and 1920 × 1080, in eight states (idle · People · the dossier · City · News (CH 9) · the Action card · TAPE ·
// the map; --states settings adds the Settings popover), measured as it is drawn:
//   size      the text's computed font-size ≥ 12.5 px
//   contrast  ≥ 4.5 : 1 against what is ACTUALLY behind it (3 : 1 for ≥ 24 px, or ≥ 18.66 px bold). "Behind it" is a second screenshot
//             of the same frame with every glyph made transparent (-webkit-text-fill-color, shadows and underlines off, nothing else
//             touched; captured in bands: one PNG over ~1.5 Mpx never comes back over the DevTools socket), so panels, see-through
//             glass, gradients, the 3D scene and the grain are all in it. The text colour is its computed colour × its opacity (its own
//             and every ancestor's), composited over each background pixel; the gate is the 10th percentile of the per-pixel contrast over
//             the text's glyph band (the middle 56 % of its box: leading and a border hugging the box are not behind the glyphs; a 1-px
//             grid line or a halftone dot is not the background, 10 % of the band on a bad colour is). Inactive controls ([disabled],
//             aria-disabled) and text another opaque element covers are reported, not gated (WCAG 1.4.3).
//   plate     text over the 3D scene sits on a plate: walking down the paint stack from the text to the city's canvas, the
//             backgrounds composite to an alpha ≥ 0.85 (a text-shadow is not a plate)
// Canvas-drawn text (the paper map, the CH 9 picture, the transport's track) is REPORTED, not gated: fillText/strokeText are watched
// from the page's first script, and each canvas in the UI lists its smallest text in CSS px.
// Also kept per text box, for before/after: its line count and its block's (a wrap; a kbd cap a pixel lower is the same line), how
// many px of it are cut sideways (an ellipsis, a clip) and how far it spills out of its key or chip unclipped. --compare lists what
// newly wraps, is cut or spills against a baseline run (same replay time, the sim paused; the ticker's crawl is left out: it moves,
// so where it is cut is where the marquee happens to be), and with --verbose what already did and does more.
// --css-rev <rev> measures the page with the UI's CSS as it was at <rev> (swapped in place in the page; the JS is this tree's): the
// baseline of a CSS change on the same page, replay and tool.
// While a frame is measured the city's loop and every animation (the crawl included) are paused, so the two screenshots are one frame.
//   node style/city/tools/legibility.mjs [--base http://127.0.0.1:5320/style/city/] [--replay http://127.0.0.1:5262] [--at "D3 09:00"]
//        [--skins zte,clean,98,zine] [--vps 1280x720,1440x900,1920x1080] [--states idle,people,dossier,city,news,action,tape,map]
//        [--out legibility.json] [--compare baseline.json] [--css-rev <git rev>] [--shots <dir>] [--verbose] [--dump <dir>] [--debug]
//   --shots   also a frame per skin at 1280 and 1920 with People and the dossier open (the before / after contact sheets)
// First gated on the replay of 2026-10-10T06-46-58-592Z-dry at D3 09:00 (WM5). Exit 1 when any gated text fails. The replay is left
// paused (speed 0) at --at.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { open, sleep } from '../ui/tools/cdp.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; }, flag = k => args.includes('--' + k);
const BASE = opt('base', 'http://127.0.0.1:5320/style/city/'), REPLAY = opt('replay', 'http://127.0.0.1:5262'), AT = opt('at', 'D3 09:00');
const SKINS = opt('skins', 'zte,clean,98,zine').split(','), VPS = opt('vps', '1280x720,1440x900,1920x1080').split(',').map(s => s.split('x').map(Number));
const STATES = opt('states', 'idle,people,dossier,city,news,action,tape,map').split(','), OUT = opt('out', null), CMP = opt('compare', null), SHOTS = opt('shots', null);
const DBG = flag('debug') ? (...m) => console.log('  ·', ...m) : () => {};
const VERBOSE = flag('verbose'), DUMP = opt('dump', null);   // (--dump <dir>: the bare frames, for looking at the method)
const R = p => fetch(REPLAY + p).then(r => r.json()).catch(() => null);
// --css-rev <rev>: measure the page with the UI's CSS as it was at <rev> (every stylesheet below and hud.js's style swapped in place, in the
// page; the JS is this tree's): the baseline of a CSS change, on the same page, replay and tool
const REV = opt('css-rev', null), CSSF = ['ui/kit.css', 'ui/menu/menu.css', 'ui/people/people.css', 'ui/settings/settings.css', 'ui/city-info/city-info.css', 'ui/map/map.css', 'ui/tape/tape.css', 'ui/tape/trails.css', 'ui/diary.css'];
let SWAP = null;
if (REV) { const git = f => execFileSync('git', ['-C', path.dirname(fileURLToPath(import.meta.url)), 'show', `${REV}:style/city/${f}`], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const old = Object.fromEntries(CSSF.map(f => [f, git(f)])), hud = git('camera/hud.js').match(/const CSS = `([\s\S]*?)`;/)[1];
  SWAP = `window.__cssrev = (() => { const OLD = ${JSON.stringify(old)}, HUD = ${JSON.stringify(hud)};
    return { apply() { let n = 0; for (const l of document.querySelectorAll('link[rel="stylesheet"]')) { if (l.dataset.rev) continue; const f = Object.keys(OLD).find(k => l.href.split('?')[0].endsWith('/style/city/' + k)); if (!f) continue;
        const s = document.createElement('style'); s.dataset.revOf = f; s.textContent = OLD[f]; l.after(s); l.disabled = true; l.dataset.rev = '1'; n++; }
      const hs = [...document.querySelectorAll('style')].find(s => !s.dataset.revOf && s.textContent.includes('#camhud {')); if (hs && !hs.dataset.rev) { hs.textContent = HUD; hs.dataset.rev = '1'; n++; } return n; } }; })(); 1`; }

// ── in the page from its first script: the canvas text watch
const EARLY = `(() => { const W = new WeakMap(); window.__legCanvas = W; const P = CanvasRenderingContext2D.prototype;
  for (const f of ['fillText', 'strokeText']) { const o = P[f]; P[f] = function (t, ...r) { try { const c = this.canvas; let L = W.get(c); if (!L) W.set(c, L = []);
    const m = /([\\d.]+)px/.exec(this.font), tr = this.getTransform(); L.push({ px: m ? +m[1] * Math.hypot(tr.a, tr.b) : null, t: String(t).slice(0, 24), at: performance.now() }); if (L.length > 4000) L.splice(0, 2000); } catch {}
    return o.call(this, t, ...r); }; }
  const cr = P.clearRect; P.clearRect = function (x, y, w, h) { try { const c = this.canvas; if (w >= c.width - 1 && h >= c.height - 1) W.set(c, []); } catch {} return cr.call(this, x, y, w, h); }; })();`;

// ── in the page: collect every visible text box, then (after the bare screenshot) sample what is behind each
const LIB = `window.__leg = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true }), CC = new Map();
  const col = s => { if (CC.has(s)) return CC.get(s); cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data;
    const c = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; if (s === 'transparent' || /rgba\\([^)]*,\\s*0\\)$/.test(s)) c.a = 0; CC.set(s, c); return c; };
  const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }, Lum = (r, g, b) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
  const opacityOf = el => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
  const label = el => { const p = []; for (let e = el, k = 0; e && e.id !== 'k' && e !== document.body && k < 4; e = e.parentElement, k++) p.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 2).map(c => '.' + c).join('')); return p.join(' > '); };
  let items = [];
  function clipOf(el) { let x0 = -1e9, x1 = 1e9, y0 = -1e9, y1 = 1e9, mx0 = -1e9, mx1 = 1e9;
    for (let a = el; a && a.nodeType === 1 && a !== document.documentElement; a = a.parentElement) { const s = getComputedStyle(a), r = a.getBoundingClientRect(), cp = /paint|strict|content/.test(s.contain);
      const px0 = r.left + a.clientLeft, px1 = a.clientWidth ? px0 + a.clientWidth : r.right, py0 = r.top + a.clientTop, py1 = a.clientHeight ? py0 + a.clientHeight : r.bottom;
      if (cp || s.overflowX !== 'visible') { x0 = Math.max(x0, px0); x1 = Math.min(x1, px1); }
      if (cp || s.overflowY !== 'visible') { y0 = Math.max(y0, py0); y1 = Math.min(y1, py1); }
      if (s.maskImage && s.maskImage !== 'none' || s.webkitMaskImage && s.webkitMaskImage !== 'none') { mx0 = Math.max(mx0, r.left + 22); mx1 = Math.min(mx1, r.right - 22); } }   // (the crawl's faded edges)
    return { x0: Math.max(x0, 0, mx0), x1: Math.min(x1, innerWidth, mx1), y0: Math.max(y0, 0), y1: Math.min(y1, innerHeight), sx0: x0, sx1: x1 }; }
  const isScene = e => e.tagName === 'CANVAS' && !!e.closest('#stage');
  const lineCount = rs => { let n = 0, bot = -1e9; for (const r of rs.slice().sort((a, b) => a.top - b.top)) { if ((r.top + r.bottom) / 2 > bot - 1) { n++; bot = r.bottom; } else bot = Math.max(bot, r.bottom); } return n; };   // (a kbd cap a pixel lower is the same line)
  function collect() {
    items = []; const out = [], seen = new Map();
    const add = (el, rects, kind, colorStr) => {
      const s = getComputedStyle(el); if (s.visibility !== 'visible') return; const size = parseFloat(s.fontSize); if (!(size > 0)) return;
      const op = opacityOf(el); if (op < .05) return;
      const c = clipOf(el), vis = []; let w = 0, wx = 0; const lines = { size: lineCount([...rects].filter(r => r.width >= .5 && r.height >= .5)) };
      for (const r of rects) { if (r.width < .5 || r.height < .5) continue; w += r.width; wx += Math.max(0, Math.min(r.right, c.sx1) - Math.max(r.left, c.sx0));
        const v = { x0: Math.max(r.left, c.x0), x1: Math.min(r.right, c.x1), y0: Math.max(r.top, c.y0), y1: Math.min(r.bottom, c.y1) }; if (v.x1 - v.x0 >= 1.5 && v.y1 - v.y0 >= 1.5) vis.push(v); }
      if (!vis.length || w < 1) return;
      const fill = s.webkitTextFillColor && s.webkitTextFillColor !== s.color ? s.webkitTextFillColor : s.color, tc = col(colorStr || fill);
      const text = (kind === 'text' ? rects.text : rects.text || '').replace(/\\s+/g, ' ').trim().slice(0, 48), lab = label(el);
      let key = lab + ' | ' + text; const n = (seen.get(key) || 0) + 1; seen.set(key, n); if (n > 1) key += ' #' + n;
      const weight = parseInt(s.fontWeight) || 400, large = size >= 24 || (size >= 18.66 && weight >= 700);
      const it = { key, label: lab, text, kind, size: +size.toFixed(2), weight, family: s.fontFamily.split(',')[0].replace(/"/g, ''), large, bar: large ? 3 : 4.5, tc: { r: tc.r, g: tc.g, b: tc.b, a: tc.a * op },
        inactive: !!el.closest('[disabled], [aria-disabled="true"]'), moving: !!el.closest('.ci-crawl'), lines: lines.size, hfrac: +(wx / w).toFixed(3), cut: +(w - wx).toFixed(1), vis, el, rects: rects.filter(r => r.width >= .5) };
      const box = el.closest('button, .k-chip, .k-lens, .k-tab') || el; it.ovf = Math.max(0, box.scrollWidth - box.clientWidth);   // (spills out of its key, unclipped)
      let blk = el; while (blk && blk !== document.body && /^(inline|contents)/.test(getComputedStyle(blk).display)) blk = blk.parentElement; it.blk = blk;
      items.push(it); };
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => /\\S/.test(n.nodeValue) && !n.parentElement.closest('script, style, noscript, template, option, #loadin') ? 1 : 2 });
    const range = document.createRange();
    for (let n = tw.nextNode(); n; n = tw.nextNode()) { range.selectNodeContents(n); const rs = [...range.getClientRects()]; rs.text = n.nodeValue; add(n.parentElement, rs, 'text'); }
    for (const el of document.querySelectorAll('select, input:not([type]), input[type="text"], input[type="search"]')) {   // (a select shows its option; an input its value or placeholder)
      const s = getComputedStyle(el); if (el.offsetWidth < 2) continue; const r = el.getBoundingClientRect(), pl = parseFloat(s.paddingLeft), pr = parseFloat(s.paddingRight);
      const box = { left: r.left + pl, right: r.right - pr, top: r.top + r.height / 2 - parseFloat(s.fontSize) * .6, bottom: r.top + r.height / 2 + parseFloat(s.fontSize) * .6 }; box.width = box.right - box.left; box.height = box.bottom - box.top;
      const rs = [box]; if (el.tagName === 'SELECT') { rs.text = el.options[el.selectedIndex]?.text || ''; add(el, rs, 'select'); }
      else { const ph = !el.value; rs.text = el.value || el.placeholder || ''; if (rs.text) add(el, rs, ph ? 'placeholder' : 'input', ph ? getComputedStyle(el, '::placeholder').color : null); } }
    // a block's lines: the distinct line tops of all its text (a word moved whole onto a new line is a wrap a text node's own count misses)
    const BL = new Map(); for (const it of items) { const L = BL.get(it.blk) || []; BL.set(it.blk, L); L.push(...it.rects); }
    const BN = new Map([...BL].map(([b, L]) => [b, lineCount(L)])); for (const it of items) { it.blines = BN.get(it.blk); it.bkey = label(it.blk); delete it.rects; }
    // what is on top of each box, and what it sits on (every element hit-tested for this, then back as it was)
    const st = document.createElement('style'); st.textContent = '* { pointer-events: auto !important; }'; document.head.append(st);
    for (const it of items) {
      const v = it.vis.reduce((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) > (a.x1 - a.x0) * (a.y1 - a.y0) ? b : a), y = (v.y0 + v.y1) / 2;
      let plate = 1, over = false, occ = null;
      for (const x of [(v.x0 + v.x1) / 2, Math.min(v.x1 - 2, v.x0 + 3), Math.max(v.x0 + 2, v.x1 - 3)]) {
        const S = document.elementsFromPoint(x, y), i = S.findIndex(e => e === it.el || e.contains(it.el));
        if (i < 0) continue;
        for (let k = 0; k < i && !occ; k++) { const e = S[k]; if (it.el.contains(e)) continue; const o = opacityOf(e); if (o < .05) continue;
          if (e.tagName === 'CANVAS' || e.tagName === 'IMG' || col(getComputedStyle(e).backgroundColor).a * o > .5) occ = label(e); }
        let acc = 0, scene = false;
        for (let k = i; k < S.length; k++) { const e = S[k]; if (isScene(e)) { scene = true; break; } if (/^(CANVAS|IMG|VIDEO)$/.test(e.tagName)) { acc = 1; break; }
          const a = col(getComputedStyle(e).backgroundColor).a * opacityOf(e); acc = 1 - (1 - acc) * (1 - a); }
        if (scene) { over = true; plate = Math.min(plate, acc); } }
      it.occ = occ; it.scene = over; it.plate = over ? +plate.toFixed(3) : null; }
    st.remove();
    return items.length; }
  // the bare frame (every glyph transparent) → per box: the text's colour over each pixel behind it, and the contrast
  let oc = null;
  async function tile(y, b64) { const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    if (!oc || oc.width !== innerWidth || oc.height !== innerHeight) oc = new OffscreenCanvas(innerWidth, innerHeight); oc.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, y); return 1; }
  async function sample() {
    const W = oc.width, H = oc.height, D = oc.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const res = [];
    for (const it of items) {
      const { r, g: gg, b, a } = it.tc, cs = [];
      for (const v0 of it.vis.slice(0, 6)) { const hh = v0.y1 - v0.y0, v = { x0: v0.x0 + 1, x1: v0.x1 - 1, y0: v0.y0 + hh * .22, y1: v0.y1 - hh * .22 };   // (the glyph band: the box's middle, not the leading or a border hugging it)
        const sx = Math.max(1, (v.x1 - v.x0) / 48), sy = Math.max(1, (v.y1 - v.y0) / 8);
        for (let y = v.y0 + sy / 2; y < v.y1; y += sy) for (let x = v.x0 + sx / 2; x < v.x1; x += sx) { const xi = Math.min(W - 1, x | 0), yi = Math.min(H - 1, y | 0), p = (yi * W + xi) * 4;
          const br = D[p], bg = D[p + 1], bb = D[p + 2], tr = r * a + br * (1 - a), tg = gg * a + bg * (1 - a), tb = b * a + bb * (1 - a);
          const L1 = Lum(tr, tg, tb), L2 = Lum(br, bg, bb); cs.push((Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05)); } }
      cs.sort((p, q) => p - q); const q = f => cs.length ? +cs[Math.min(cs.length - 1, Math.floor(cs.length * f))].toFixed(2) : null;
      const { el, vis, blk, ...rest } = it, v0 = vis[0]; res.push({ ...rest, box: [v0.x0, v0.y0, v0.x1, v0.y1].map(Math.round), c10: q(.1), cMed: q(.5), cMin: q(0), n: cs.length }); }
    return res; }
  // canvases in the UI: their smallest text (CSS px), from the last redraw
  function canvases() { const W = window.__legCanvas, out = []; if (!W) return out;
    for (const c of document.querySelectorAll('#k canvas, #camhud canvas')) { const L = W.get(c); if (!L || !L.length) continue; const r = c.getBoundingClientRect(); if (r.width < 2 || getComputedStyle(c).visibility !== 'visible' || opacityOf(c) < .05) continue;
      const t1 = L[L.length - 1].at, last = L.filter(e => e.at >= t1 - 60 && e.px), k = r.width / c.width, px = last.map(e => e.px * k);
      if (!px.length) continue; out.push({ canvas: label(c), n: px.length, min: +Math.min(...px).toFixed(1), under: px.filter(p => p < 12.5).length, sample: last.filter(e => e.px * k < 12.5).slice(0, 4).map(e => e.t + ' ' + (e.px * k).toFixed(1)) }); }
    return out; }
  return { collect, tile, sample, canvases };
})(); 1`;

// ── the hidden-glyph style (the bare frame)
const BARE = `(() => { const s = document.createElement('style'); s.id = 'leg-bare'; s.textContent = '*, *::before, *::after { -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; caret-color: transparent !important; } *::placeholder { -webkit-text-fill-color: transparent !important; color: transparent !important; }'; document.head.append(s); return 1; })()`;
const UNBARE = `(document.getElementById('leg-bare')?.remove(), 1)`;

// ── the states
const RESET = `(async () => { const u = __ui; try { if (u.tape.active) u.tape.close(); } catch {} try { u.map.isOpen && u.map.close(); } catch {} try { u.info.open && u.info.close(); } catch {}
  for (const k of ['action', 'settings', 'people']) try { u.menu[k].isOpen && u.menu[k].close(); } catch {} try { u.dossier.isOpen && u.dossier.close(); } catch {}
  document.querySelector('.k-chooser')?.remove(); for (const t of document.querySelectorAll('.k-toast')) t.remove(); document.activeElement?.blur?.(); return 1; })()`;
const OPEN = {
  idle: () => '1',
  people: () => `(__ui.menu.people.open({ focus: false }), 1)`,
  dossier: H => `(__ui.dossier.open(${JSON.stringify(H)}), 1)`,
  city: () => `(__ui.info.show('city'), 1)`,
  news: () => `(__ui.info.show('tv'), 1)`,
  action: () => `(__ui.menu.action.open(), 1)`,
  tape: () => `(async () => { __ui.tape.open({}); for (let i = 0; i < 60 && __tape.time() === null; i++) await new Promise(r => setTimeout(r, 250)); return __tape.time() !== null; })()`,
  map: () => `(__ui.map.open(), 1)`,
  settings: () => `(__ui.menu.settings.open(), document.activeElement?.blur?.(), 1)`,   // (extra, not in the default eight: --states settings)
};
const SETTLE = { idle: 500, people: 900, dossier: 1400, city: 1200, news: 1600, action: 900, tape: 2200, map: 1800, settings: 700 };

async function setSkin(S, sk) { await S.ev(`(async () => { for (let k = 0; k < 4 && __ui.skin() !== ${JSON.stringify(sk)}; k++) __ui.nextSkin(); await document.fonts.ready; return __ui.skin(); })()`); await sleep(500);
  await S.ev(`document.fonts.ready.then(() => 1)`); }
async function measure(S, tag) {
  if (SWAP) DBG('swapped', await S.ev(`__cssrev.apply()`));
  DBG('pause'); await S.ev(`(__city.pauseLoop?.(true), 1)`); await S.send('Animation.setPlaybackRate', { playbackRate: 0 }); await sleep(120);
  try {
    DBG('collect'); await S.ev(`__leg.collect()`);
    DBG('bare'); await S.ev(BARE); await sleep(140); DBG('capture');
    // in bands: a full-frame PNG over ~1.5 Mpx never comes back over the DevTools socket (it hung the page at 1680 × 1050 and up)
    const [W, H] = await S.ev('[innerWidth, innerHeight]'), band = Math.max(1, Math.floor(700000 / W)), tiles = [];
    for (let y = 0; y < H; y += band) tiles.push({ y, data: (await capture({ format: 'png', clip: { x: 0, y, width: W, height: Math.min(band, H - y), scale: 1 } })).result.data });
    DBG('unbare'); await S.ev(UNBARE);
    for (const t of tiles) await S.ev(`__leg.tile(${t.y}, ${JSON.stringify(t.data)})`);
    if (DUMP) { await fs.mkdir(DUMP, { recursive: true }); for (const t of tiles) await fs.writeFile(path.join(DUMP, `bare-${tag}-y${t.y}.png`), Buffer.from(t.data, 'base64')); }
    DBG('sample'); const items = await S.ev(`__leg.sample()`), canv = await S.ev(`__leg.canvases()`);
    return { items, canv };
  } finally { await S.send('Animation.setPlaybackRate', { playbackRate: 1 }); await S.ev(`(__city.pauseLoop?.(false), 1)`); }
}
const verdict = it => ({ small: it.size < 12.5, low: !it.inactive && !it.occ && it.c10 !== null && it.c10 < it.bar, bare: !it.occ && it.scene && it.plate < .85 });

// ── run
await R('/speed?x=0'); await R('/seek?t=' + encodeURIComponent(AT));
const [w0, h0] = VPS[0], S = await open({ w: Math.max(...VPS.map(v => v[0])) + 64, h: Math.max(...VPS.map(v => v[1])) + 160 });   // (a window larger than every viewport: an override the window's own size hung the capture)
const capture = async (o, ms = 30000) => { const r = await Promise.race([S.send('Page.captureScreenshot', o), sleep(ms).then(() => null)]); if (!r?.result?.data) throw new Error('screenshot timed out'); return r; };
const report = { when: new Date().toISOString(), base: BASE, at: AT, rows: [], canvases: [] };
try {
  await S.send('Page.addScriptToEvaluateOnNewDocument', { source: EARLY }); await S.send('Animation.enable');
  await S.send('Emulation.setDeviceMetricsOverride', { width: w0, height: h0, deviceScaleFactor: 1, mobile: false });
  const port = new URL(REPLAY).port;
  await S.go(`${BASE}?sim=live&simport=${port}&delay=0`, { until: 'window.__city && __city.marks.full && window.__ui && __ui.sim.agents().length && !__city.loading && window.__tape', ms: 240000 });
  await S.ev(LIB); if (SWAP) { await S.ev(SWAP); await S.ev(`__cssrev.apply()`); console.log(`the UI's CSS as at ${REV}`); }
  await S.ev(`(document.querySelector('[data-view="avenue"]')?.click(), 1)`); await sleep(4000);
  const H = await S.ev(`__ui.sim.agents().filter(a => !a.retired && !a.npc).map(a => a.handle).sort((a, b) => b.length - a.length || (a < b ? -1 : 1))[0]`);
  report.agent = H; console.log(`page up · agent @${H} · replay at ${AT} (paused)`);
  for (const [w, h] of VPS) {
    DBG('viewport', w, h); await S.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await sleep(1500); DBG('viewport is', await S.ev('innerWidth + "x" + innerHeight'));
    for (const sk of SKINS) {
      await S.ev(RESET); await setSkin(S, sk);
      for (const st of STATES) {
        await S.ev(RESET); await sleep(350); if (SWAP) await S.ev(`__cssrev.apply()`); const ok = await S.ev(OPEN[st](H)); await sleep(SETTLE[st]);
        const { items, canv } = await measure(S, `${sk}-${w}-${st}`);
        const row = { skin: sk, vp: `${w}x${h}`, state: st, opened: ok !== false, n: items.length, small: 0, low: 0, bare: 0, fails: [], items };
        for (const it of items) { const v = verdict(it); if (v.small) row.small++; if (v.low) row.low++; if (v.bare) row.bare++;
          if (v.small || v.low || v.bare) row.fails.push({ key: it.key, size: it.size, c10: it.c10, bar: it.bar, plate: it.plate, why: Object.keys(v).filter(k => v[k]) }); }
        for (const c of canv) report.canvases.push({ skin: sk, vp: `${w}x${h}`, state: st, ...c });
        report.rows.push(row);
        console.log(`${sk.padEnd(5)} ${(w + 'x' + h).padEnd(9)} ${st.padEnd(7)} texts ${String(items.length).padStart(3)} · small ${String(row.small).padStart(3)} · contrast ${String(row.low).padStart(3)} · unplated ${String(row.bare).padStart(2)}${ok === false ? ' · (did not open)' : ''}`);
        if (VERBOSE) for (const f of row.fails.slice(0, 40)) console.log('    ', f.why.join('+').padEnd(10), String(f.size).padStart(5), 'px', String(f.c10).padStart(5), '/', f.bar, f.plate !== null ? 'plate ' + f.plate : '', f.key.slice(0, 140));
      }
      if (SHOTS && (w === 1280 || w === 1920)) {
        await S.ev(RESET); await sleep(300); await S.ev(OPEN.people()); await sleep(500); await S.ev(OPEN.dossier(H)); await sleep(1800); await S.ev(`document.activeElement?.blur?.(), 1`);
        const r = await capture({ format: 'jpeg', quality: 88 }); await fs.mkdir(SHOTS, { recursive: true });
        await fs.writeFile(path.join(SHOTS, `${sk}-${w}.jpg`), Buffer.from(r.result.data, 'base64')); }
    }
  }
  await S.ev(RESET);
  if (S.errs.length) report.pageErrors = S.errs.slice(0, 20);
} finally { await S.close(); }

// ── the summary: failures per skin and viewport (gated), the canvases (reported), and against a baseline
const tab = {}; for (const r of report.rows) { const k = r.skin + ' ' + r.vp; const t = tab[k] ??= { small: 0, low: 0, bare: 0, n: 0 }; t.small += r.small; t.low += r.low; t.bare += r.bare; t.n += r.n; }
console.log('\nfailures (gated) per skin × viewport, summed over the states: small < 12.5 px · contrast under the bar · unplated over the scene');
for (const [k, t] of Object.entries(tab)) console.log('  ' + k.padEnd(16), `small ${String(t.small).padStart(4)} · contrast ${String(t.low).padStart(4)} · unplated ${String(t.bare).padStart(3)} · of ${t.n} text boxes`);
const total = Object.values(tab).reduce((a, t) => a + t.small + t.low + t.bare, 0); report.total = total; report.table = tab;
const cmin = {}; for (const c of report.canvases) { const k = c.canvas.split(' > ').pop(); const m = cmin[k] ??= { min: 1e9, under: 0, where: '' }; if (c.min < m.min) { m.min = c.min; m.where = `${c.skin} ${c.vp} ${c.state}`; } m.under = Math.max(m.under, c.under); }
console.log('\ncanvas text (reported, not gated): the smallest text per canvas, CSS px');
for (const [k, m] of Object.entries(cmin)) console.log('  ' + k.padEnd(28), `min ${m.min} px (${m.where}) · up to ${m.under} texts under 12.5 px in one frame`);
if (CMP) {
  const base = JSON.parse(await fs.readFile(CMP, 'utf8')), idx = new Map();
  for (const r of base.rows) for (const it of r.items) idx.set(`${r.skin}|${r.vp}|${r.state}|${it.key}`, it);
  const news = [], more = [], seenB = new Set();   // NEW: one line → two or more, or whole → cut; MORE: already wrapped / cut, now a line more or cut further (reflow)
  for (const r of report.rows) for (const it of r.items) { const b = idx.get(`${r.skin}|${r.vp}|${r.state}|${it.key}`); if (!b || it.moving || /ci-crawl|ci-track/.test(it.key)) continue; const w = `${r.skin} ${r.vp} ${r.state}`;
    if (it.lines > b.lines) (b.lines === 1 ? news : more).push(`${w} · wraps ${b.lines} → ${it.lines} lines · ${it.key.slice(0, 120)}`);
    if (b.blines !== undefined && it.blines > b.blines && !seenB.has(w + it.bkey)) { seenB.add(w + it.bkey); (b.blines === 1 ? news : more).push(`${w} · its block wraps ${b.blines} → ${it.blines} lines · ${it.bkey.slice(0, 80)} | ${it.text.slice(0, 30)}`); }
    const bc = b.cut ?? (1 - b.hfrac) * 1e3, ic = it.cut ?? (1 - it.hfrac) * 1e3;
    if (ic >= .5 && ic > bc + .5) (bc < .5 ? news : more).push(`${w} · cut ${bc.toFixed(1)} → ${ic.toFixed(1)} px · ${it.key.slice(0, 120)}`);
    if (b.ovf !== undefined && it.ovf > 1 && it.ovf > b.ovf + 1) (b.ovf <= 1 ? news : more).push(`${w} · spills out of its box ${b.ovf} → ${it.ovf} px · ${it.key.slice(0, 120)}`); }
  report.newWrapsCuts = news; report.moreWrapsCuts = more;
  for (const vp of VPS.map(v => v.join('x'))) { const n = news.filter(l => l.includes(' ' + vp + ' ')), m = more.filter(l => l.includes(' ' + vp + ' '));
    console.log(`\nagainst ${path.basename(CMP)} at ${vp}: ${n.length} text boxes newly wrap or are cut · ${m.length} that already did wrap a line more or are cut further`); for (const l of n.slice(0, 60)) console.log('  NEW  ' + l); if (VERBOSE) for (const l of m.slice(0, 60)) console.log('  more ' + l); }
}
if (OUT) { for (const r of report.rows) for (const it of r.items) delete it.tc; await fs.writeFile(OUT, JSON.stringify(report, null, 1)); console.log('\n→', OUT); }
console.log(`\n${total ? 'FAIL' : 'PASS'}: ${total} gated failures`);
process.exit(total ? 1 : 0);
