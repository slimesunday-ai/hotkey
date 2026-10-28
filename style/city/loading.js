// LOADING SCREEN (2026-10-05) · the load-in, designed. #loadin (index.html) is a painted roll-down gate on Springfield Street:
// the AI CITY throw-up, a street corner that builds itself cube by cube from the REAL load, the cast's walkers stepping onto its
// sidewalk as their looks bake, a green street sign naming the stage, and a city-news crawl. When the view has settled main.js adds
// .off and the gate rolls up over the live city; a Go-to drops it again and a new corner builds.
//   progress · main.js `city:loading` events (detail.progress 0–1 over: the code → the baked city's regions fetched → the blocks
//     streamed at their wanted tier; detail.walkers = the walker looks baked). The corner shows exactly that share of its cubes
//     (eased, never ahead of the load); the bar is the same number.
//   cost · one small 2D canvas, redrawn at ≤ 30 fps only while the gate is down; the crawl and the roll are CSS transforms; nothing
//     runs once the gate is up. It never runs in ?shot, ?bake, ?hash, ?audit&report or ?loadin=0 (the gate is hidden at once).
const Q = new URLSearchParams(location.search), AUDIT = Q.has('audit') && Q.get('audit') !== '0', el = document.getElementById('loadin');
const SKIP = !el || Q.has('shot') || Q.has('bake') || Q.has('hash') || (AUDIT && Q.has('report')) || Q.get('loadin') === '0';

// STYLE.md §2: one flat colour per building, the toon walls, ink, glass, ground, sign colours (sky blue is the gate's, so no blue walls)
const WALLS = ['#EF4A2A', '#FF4FA3', '#7A3CFF', '#FF7A1A', '#25B84C', '#12B3A0', '#8C52FF', '#E83B5B', '#FF8A1F', '#FFC21A'];
const C = { ink: '#17171B', glass: '#1B2A55', glint: '#EAF6FF', lit: '#FFC766', white: '#F4F1EA', pale: '#D3D4D7', brick: '#9B4F3A', trim: '#FFF0D0',
  asph: '#5D5E6B', walk: '#CDC5B8', curb: '#ECE8DF', lane: '#FFC41F', zebra: '#F4F3EE', green: '#14A83B', red: '#E8232A', yellow: '#FFE23A', cyan: '#2DE2E6' };
const SKIN = ['#F2C9A0', '#C98B5B', '#8A5A3C', '#FFD9B8', '#5E3B2A'], PANTS = ['#17171B', '#2F5BFF', '#5D5E6B', '#9B4F3A', '#25B84C'];
// the crawl: the city's own news (its places, its invented trades) and a few tips for the keys
const NEWS = ['Precinct 9 says crime is down · crime says otherwise', 'Low Tide Docks: second fog advisory this week, nobody saw anything',
  'St. Mercy now taking cash, cards and favours', 'Millennium Mall ruins grand re-opening postponed, 9th year running', 'Fit Street drop sold out in 4 seconds · the line is still there',
  'Iron Island changes visiting hours again', 'The Heap reports a record high (the heap)', 'Blackpine Woods: hikers advised to keep hiking',
  'Sunny Acres votes on a new lawn flamingo', 'Motel 9 says room 9 is still not available', 'Hall of Justice elevator out · justice takes the stairs',
  'Glasswall Plaza adds a 40th floor nobody asked for', 'Eddie Bail Bonds: we never close, neither should you', 'Local bodega cat promoted to manager',
  'Junior Check Cashing opens a second window', 'Bay Ferry running late · the bay says it was early', 'Got warrants? the billboards on Kent St would like a word'];
const TIPS = ['Tip · click a home to look inside', 'Tip · press 3 to tail a walker, Tab for the next one', 'Tip · press 4 for the photo camera',
  'Tip · Go to… jumps across the island', 'Tip · ? shows every key', 'Tip · WASD walks the block, shift runs'];
const K = Math.cos(Math.PI / 6), FPS_MS = 33, DROP_MS = 240;

function start() {
  const cv = el.querySelector('canvas'), g = cv?.getContext('2d'), title = el.querySelector('.sign b'), msg = el.querySelector('.sign span'),
    bar = el.querySelector('.bar i'), peeps = el.querySelector('.peeps'), crawl = el.querySelector('.crawl');
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the crawl: shuffled news with a tip every third item, written twice so the CSS loop (translateX 0 → −50%) is seamless
  if (crawl) { const n = shuffle(NEWS.slice()), t = shuffle(TIPS.slice()), items = []; n.forEach((s, k) => { items.push(s); if (k % 3 === 2 && t.length) items.push(t.pop()); });
    const line = items.map(s => `<span${s.startsWith('Tip') ? ' class="tip"' : ''}>${s}</span>`).join('<i>●</i>'); crawl.innerHTML = `<div>${line}<i>●</i>${line}<i>●</i></div>`; }
  let S = null, target = 0, shown = 0, walkers = [0, 48], raf = 0, last = 0, up = false, holds = 0, intro = performance.now();
  const build = () => { S = corner(Math.random); target = shown = 0; intro = performance.now(); };
  build();
  // ── the events (main.js loadEvent). A new hold after the gate went up (a Go-to) builds a fresh corner from nothing.
  const onLoad = d => {
    if (d.phase === 'done') { target = 1; up = true; setText(d); const h = ++holds; setTimeout(() => { if (h === holds && up && raf) { cancelAnimationFrame(raf); raf = 0; } }, 1600); return; }   // (the stop, should transitionend never come)
    if (up) { up = false; holds++; build(); }
    target = Math.max(target, Math.min(1, +d.progress || 0)); if (d.walkers?.total) walkers = [d.walkers.done | 0, d.walkers.total | 0]; setText(d); go(); };
  addEventListener('city:loading', e => onLoad(e.detail || {}));
  if (window.__city?.loading) onLoad(window.__city.loading);
  let lastT = '', lastM = '';
  function setText(d) {
    const t = d.kind === 'goto' ? 'Going to ' + (d.label || 'the place') : d.phase === 'data' ? 'Trucking in the city' : d.phase === 'view' ? 'Raising the blocks' : d.phase === 'done' ? 'Doors open' : 'Waking the city';
    const m = d.phase === 'data' ? `baked city · ${d.done} / ${d.total} regions in` : d.phase === 'view' ? `blocks · ${d.done} / ${d.total} on their feet` : d.phase === 'done' ? 'the city is up' : (d.label || 'loading the code');
    if (t !== lastT && title) title.textContent = lastT = t; if (m !== lastM && msg) msg.textContent = lastM = m; }
  // ── the loop: only while the gate is down (or still rolling up); stops when it is fully up
  function go() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }
  el.addEventListener('transitionend', e => { if (e.target === el && el.classList.contains('off')) { cancelAnimationFrame(raf); raf = 0; } });
  function tick(now) {
    raf = requestAnimationFrame(tick); if (last && now - last < FPS_MS) return;
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
    shown += (target - shown) * Math.min(1, dt * (up ? 9 : 4)); if (target - shown < .003) shown = target;
    if (bar) bar.style.transform = `scaleX(${shown.toFixed(4)})`;
    if (peeps) { const s = `walkers · ${walkers[0]} / ${walkers[1]} looks`; if (peeps.textContent !== s) peeps.textContent = s; }
    if (g && S) draw(g, cv, S, shown, walkers[1] ? walkers[0] / walkers[1] : 0, now, intro, RM);
  }
  go();
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── the corner: a ground slab (shown from the start), then every cube of the buildings and their details, ranked bottom-up with a
// little jitter so the block rises in courses (the billboard goes up with the bodega's roof, the tower tops out last); each lettered
// face is painted once its own cubes are down. Unit cubes on the grid cull the faces they share.
function corner(rnd) {
  const pick = (list, not = []) => { const l = list.filter(c => !not.includes(c)); return l[(rnd() * l.length) | 0]; };
  const wA = pick(WALLS), wB = pick(WALLS, [wA]), tower = rnd() < .5 ? C.white : C.pale, awn = pick([C.green, C.red, C.ink]);
  const ground = [], cubes = [], detail = [], text = [];
  const box = (L, x0, x1, y0, y1, z0, z1, col, e = 1) => { for (let x = x0; x <= x1; x += e) for (let y = y0; y <= y1; y += e) for (let z = z0; z <= z1; z += e) L.push({ x, y, z, e, c: typeof col === 'function' ? col(x, y, z) : col }); };
  // ground: the avenue in front (z 9–11), the side street on the right (x 13–15), sidewalks and curbs, lane dashes, a crosswalk
  box(ground, 0, 15, -1, -1, -6, 11, (x, y, z) => x >= 13 ? (z >= 3 && z <= 7 && z % 2 ? C.zebra : C.asph) : z >= 9 ? (z === 10 && x % 3 !== 2 ? C.lane : C.asph)
    : z === 8 || x === 12 ? C.curb : C.walk);
  // the tower behind (neutral, glass bands), the walk-up (wall A, three storeys), the corner bodega (wall B, two storeys)
  box(cubes, 0, 7, 0, 13, -6, -3, (x, y, z) => (z === -3 || x === 7) && y % 3 !== 0 && y > 0 && (z === -3 ? x % 2 : z % 2) ? C.glass : tower);
  box(cubes, 0, 3, 0, 8, -1, 4, (x, y, z) => {
    if (z === 4 && y >= 3 && y % 3 !== 0 && (x === 1 || x === 3)) return C.glass;      // two windows a floor
    if (z === 4 && y < 2 && x === 2) return C.ink;                                      // the door
    if (z === 4 && y === 1 && x === 0) return C.glass;
    return y === 8 ? C.trim : wA; });                                                   // a cornice course
  box(cubes, 4, 9, 0, 4, -1, 4, (x, y, z) => {
    const front = z === 4, side = x === 9; if (!front && !side) return wB;
    if (y === 2) return C.ink;                                                          // the sign band (lettered below)
    if (y < 2) return front && x === 5 ? C.ink : C.glass;                               // shop glass and the door
    return y === 3 && (front ? x % 2 : z % 2) ? C.glass : wB; });
  // fire escape on the walk-up (ink half cubes), awning over the bodega's front, the billboard on its roof, lamp, hydrant, cab, crates
  for (const y of [3, 6]) { box(detail, 0, 3.5, y - .5, y - .5, 5, 5.5, C.ink, .5); box(detail, 3.5, 3.5, y - 3, y - 1, 5.5, 5.5, C.ink, .5); }
  box(detail, 4, 9.5, 1.5, 1.5, 5, 5.5, (x) => (x * 2) % 2 ? awn : C.zebra, .5);
  box(detail, 5, 5, 5, 6, 1, 1, C.ink); box(detail, 8, 8, 5, 6, 1, 1, C.ink);
  const board = detail.length; box(detail, 4, 9, 7, 9, 1, 1, C.white);
  text.push({ x: 4, y: 10, z: 2, w: 6, h: 3, bg: C.yellow, of: detail.slice(board), lines: [['EDDIE', .95, C.ink], ['BAIL BONDS', 1.05, C.red], ['24/7 · NO JUDGEMENT', .52, C.ink]] });
  text.push({ x: 4, y: 3, z: 5, w: 6, h: 1, of: cubes.filter(c => c.y === 2 && c.z === 4 && c.x >= 4), lines: [[pick(['EL PRIMO DELI 24', 'SAL\'S BODEGA', 'KENT ST DELI']), .62, C.yellow]] });
  box(detail, 11.5, 11.5, 0, 6.5, 0.5, 0.5, C.ink, .5); box(detail, 12, 12.5, 6.5, 6.5, 0.5, 0.5, C.ink, .5); box(detail, 12.5, 12.5, 6, 6, 0.5, 0.5, C.lit, .5);
  box(detail, 10.5, 10.5, 0, .5, 7.5, 7.5, C.red, .5);
  box(detail, 2, 5.5, 0, .5, 9, 10, C.yellow, .5); box(detail, 3, 4.5, 1, 1, 9, 10, C.glass, .5); box(detail, 3, 4.5, 1.5, 1.5, 9.5, 9.5, C.ink, .5);
  box(detail, 0, .5, 0, .5, 5, 5.5, C.brick, .5); box(detail, 8.5, 9, 0, .5, 5.5, 5.5, C.cyan, .5);
  ground.forEach(c => { c.r = -1; });
  // rank: courses bottom-up, jittered; the details after the buildings
  const built = [...cubes, ...detail]; built.forEach(c => { c.k = c.y + rnd() * 1.6; }); built.sort((a, b) => a.k - b.k); built.forEach((c, k) => { c.r = k; });
  for (const t of text) t.last = Math.max(...t.of.map(c => c.r));
  const all = [...ground, ...built], at = new Map();
  for (const c of all) { c.d = c.x + c.y + c.z + 1.5 * c.e; if (c.e === 1) at.set(c.x + ',' + c.y + ',' + c.z, c); c.f = faces(c.c); }
  for (const c of all) if (c.e === 1) { c.nx = at.get((c.x + 1) + ',' + c.y + ',' + c.z); c.ny = at.get(c.x + ',' + (c.y + 1) + ',' + c.z); c.nz = at.get(c.x + ',' + c.y + ',' + (c.z + 1)); }
  all.sort((a, b) => a.d - b.d);
  const people = Array.from({ length: 6 }, (_, k) => ({ lane: k % 2 ? 7.1 : 6.2, dir: k % 2 ? -1 : 1, off: rnd() * 14, v: .9 + rnd() * .5, ph: rnd() * 6,
    F: { shirt: faces(pick(WALLS)), pants: faces(pick(PANTS)), head: (sk => [shade(pick([C.ink, C.brick, C.yellow, C.ink, '#5E3B2A']), 1), sk[1], sk[2]])(faces(pick(SKIN))) } }));   // (the head's top is its hair)
  return { all, n: built.length, text, people, born: new Float64Array(built.length).fill(-1) };
}
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) * f | 0},${(n >> 8 & 255) * f | 0},${(n & 255) * f | 0})`; };
const faces = hex => [shade(hex, 1), shade(hex, .8), shade(hex, .64)];   // top · left (+z, the light side) · right (+x)

// ── drawing: painter's order along the view axis (x + y + z); a just-placed cube drops into its course; the walkers merge into the order
function draw(g, cv, S, p, walk, now, intro, RM) {
  const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  // the corner spans screen x (x − z)·K ∈ [−12K, 22K] and screen y (x + z)/2 − y ∈ [−17, 15] (in cubes): fit and centre it
  const s = Math.min(cv.width / (34 * K + 1), cv.height / 33), ox = cv.width / 2 - 5 * K * s, oy = cv.height / 2 + s;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.lineJoin = 'round'; g.lineWidth = 1;
  const n = Math.floor(p * S.n + 1e-6), introK = RM ? 1 : Math.min(1, (now - intro) / 450);
  const landed = c => !!c && (c.r < 0 || (c.r < n && S.born[c.r] >= 0 && now - S.born[c.r] >= DROP_MS));
  const quad = (bx, by, ax, ay, cx, cy, col) => { g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + ax, by + ay); g.lineTo(bx + ax + cx, by + ay + cy); g.lineTo(bx + cx, by + cy); g.closePath();
    g.fillStyle = col; g.fill(); g.strokeStyle = col; g.stroke(); };   // (the same-colour stroke closes the anti-aliasing seams: no outlines)
  const cube = (x, y, z, e, f, c) => {   // c: the grid cube whose landed neighbours hide its faces (null: draw all three)
    const bx = ox + (x - z) * K * s, by = oy + (x + z) * .5 * s - y * s, X0 = K * s * e, X1 = .5 * s * e, Y1 = -s * e;
    if (!c || !landed(c.ny)) quad(bx, by + Y1, X0, X1, -X0, X1, f[0]);              // top
    if (!c || !landed(c.nz)) quad(bx - X0, by + X1, X0, X1, 0, Y1, f[1]);            // +z face
    if (!c || !landed(c.nx)) quad(bx + X0, by + X1, -X0, X1, 0, Y1, f[2]); };        // +x face
  // the walkers (a share of six, as their looks bake): big-head bodies of small cubes, sorted into the cubes by depth
  const pp = [], T = now / 1000, np = Math.round(walk * S.people.length);
  const add = (x, y, z, e, f) => pp.push({ x, y, z, e, f, d: x + y + z + 1.5 * e });
  for (let k = 0; k < np; k++) { const q = S.people[k], u = ((q.off + T * q.v) % 13 + 13) % 13, x = q.dir > 0 ? -.5 + u : 12.5 - u, z = q.lane;
    const ph = RM ? 0 : Math.sin(T * 9 * q.v + q.ph), L = ph * .16 * q.dir, bob = Math.abs(ph) * .06;
    add(x - .15 + L, 0, z, .3, q.F.pants); add(x - .15 - L, 0, z + .34, .3, q.F.pants); add(x - .15 + L, .3, z, .3, q.F.pants); add(x - .15 - L, .3, z + .34, .3, q.F.pants);
    add(x - .2, .6 + bob, z - .03, .7, q.F.shirt); add(x - .26, 1.3 + bob, z - .09, .82, q.F.head); }
  pp.sort((a, b) => a.d - b.d);
  let j = 0;
  for (const c of S.all) {
    while (j < pp.length && pp[j].d <= c.d) { const o = pp[j++]; cube(o.x, o.y, o.z, o.e, o.f, null); }
    let y = c.y, falling = false;
    if (c.r >= 0) { if (c.r >= n) continue; if (S.born[c.r] < 0) S.born[c.r] = now; const t = Math.min(1, (now - S.born[c.r]) / DROP_MS); if (t < 1 && !RM) { y += (1 - t) * (1 - t) * 2.2; falling = true; } }
    else if (introK < 1) { const t = Math.max(0, Math.min(1, introK * 1.6 - (c.x + c.z + 6) / 30)); if (t <= 0) continue; y -= (1 - t) * (1 - t) * 1.5; falling = t < 1; }
    cube(c.x, y, c.z, c.e, c.f, c.e === 1 && !falling ? c : null);
  }
  while (j < pp.length) { const o = pp[j++]; cube(o.x, o.y, o.z, o.e, o.f, null); }
  // lettering, painted on its +z face once every cube is down: the face's own axes (x → right-down, y → down) carry the text
  for (const t of S.text) { if (t.last >= n || now - S.born[t.last] < DROP_MS) continue;
    g.setTransform(K * s, .5 * s, 0, s, ox + (t.x - t.z) * K * s, oy + (t.x + t.z) * .5 * s - t.y * s);
    if (t.bg) { g.fillStyle = t.bg; g.fillRect(.15, .15, t.w - .3, t.h - .3); }
    const lh = t.h / t.lines.length; g.textAlign = 'center'; g.textBaseline = 'middle';
    t.lines.forEach(([str, size, col], k) => { g.font = `900 ${size}px "Arial Black", Impact, sans-serif`; g.fillStyle = col; const m = g.measureText(str).width, sx = Math.min(1, (t.w - .5) / m);
      g.save(); g.translate(t.w / 2, lh * (k + .5)); g.scale(sx, 1); g.fillText(str, 0, .04); g.restore(); });
    g.setTransform(1, 0, 0, 1, 0, 0); }
}

if (el && SKIP) el.classList.add('off', 'skip');
else if (el) start();
