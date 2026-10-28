// HUMAN LAYER · THE DOSSIER PORTRAIT: the agent in its real look, turning. Frames rendered ONCE when the dossier opens, never per frame:
//   the look      the same spec the city draws (simstate/looks.js specOf: the cast roll seeded by the handle; the county jumpsuit on
//                 Iron Island), built with cast.js (CH.build), standing
//   the render    a small WebGL context of its own (nothing shared with the city's renderer, its state, shadows or post stack): 16 turns
//                 of the figure into a sprite sheet, a few per animation frame, after the panel's slide-in has finished
//   the playback  a 2D canvas showing one cell every 110 ms while the dossier is open (reduced motion: the front view only)
// Sheets are cached per look (the last 12). The build (5–20 ms, cast.js) is the one main-thread cost, paid once per look, after the
// panel has opened; the renderer is warmed at idle after the page loads, so the first click doesn't compile shaders.
const N = 16, CW = 208, CH_ = 256, CACHE = 12;
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };   // (looks.js hash)

export function createPortraits({ THREE }) {
  let CH = null, R = null, scene = null, cam = null, warm = null;
  const cache = new Map(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let busy = 0;   // (a sprite sheet is mid-render across animation frames: a thumbnail waits for it, never shares the scene with it)
  async function init() {
    if (R) return; CH = await import('../cast.js');
    const c = document.createElement('canvas'); c.width = CW; c.height = CH_;
    R = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    R.setPixelRatio(1); R.setSize(CW, CH_, false); R.setClearColor(0x000000, 0); R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdfeeff, 0x6b5a48, 1.6));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.6); key.position.set(2.2, 3.4, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fc8ff, 1.3); rim.position.set(-3, 2, -2.5); scene.add(rim);
    cam = new THREE.PerspectiveCamera(24, CW / CH_, .1, 50); cam.position.set(0, 1.25, 5.6); cam.lookAt(0, .9, 0);
    // warm the shader programs for the cast's four materials (no figure: a cube per material)
    const g = new THREE.BoxGeometry(.01, .01, .01); g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3));
    const tmp = CH.MATS.map(m => new THREE.Mesh(g, m)); tmp.forEach(m => scene.add(m)); R.compile(scene, cam); R.render(scene, cam); tmp.forEach(m => scene.remove(m)); g.dispose();
  }
  const prewarm = () => { warm ??= init().catch(e => { console.warn('[ui] portrait renderer:', e); }); return warm; };
  function specOf(handle, jailed) { const L = CH.rollLook(fnv(handle) & 0xffffff); if (jailed) CH.wear(L, CH.OUTFITS.county); return L; }
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  // the sprite sheet for an agent: a canvas N cells wide (cached)
  async function sheet(handle, jailed = false) {
    const key = handle + (jailed ? '|jail' : ''); if (cache.has(key)) { const s = cache.get(key); cache.delete(key); cache.set(key, s); return s; }
    await prewarm(); if (!R) return null;
    const o = CH.build(specOf(handle, jailed)); if (o.userData.open) { o.userData.open.visible = true; o.userData.shut.visible = false; } CH.pose(o, 0, 0);
    const box = new THREE.Box3().setFromObject(o), hgt = Math.max(.5, box.max.y - box.min.y); o.position.y = -box.min.y; const pivot = new THREE.Group(); pivot.add(o); scene.add(pivot); busy++;
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2; o.position.x = -cx; o.position.z = -cz;
    cam.position.set(0, hgt * .62, hgt * 3.05); cam.lookAt(0, hgt * .5, 0);
    const sh = document.createElement('canvas'); sh.width = CW * N; sh.height = CH_; const g = sh.getContext('2d');
    for (let k = 0; k < N; k++) { pivot.rotation.y = -.5 + k / N * Math.PI * 2; R.render(scene, cam); g.drawImage(R.domElement, k * CW, 0); if (k % 4 === 3) await nextFrame(); }
    scene.remove(pivot); busy--; CH.dispose(o);
    cache.set(key, sh); while (cache.size > CACHE) cache.delete(cache.keys().next().value);
    return sh;
  }
  // a roster thumbnail (section 4, ui/people): one head-and-shoulders frame of the same look, as a data URL, cached for the page's life
  // (one per handle, a few KB each). The render is synchronous once the renderer is warm, so it never interleaves with a sheet; it waits
  // while a sheet is mid-render. ui/people asks for them one at a time, only for the rows on screen, only while People is open.
  const thumbs = new Map(), TW = 88, TH = 104;
  async function thumb(handle, jailed = false) {
    const key = handle + (jailed ? '|jail' : ''); if (thumbs.has(key)) return thumbs.get(key);
    await prewarm(); if (!R) return null; while (busy) await nextFrame(); if (thumbs.has(key)) return thumbs.get(key);
    const o = CH.build(specOf(handle, jailed)); if (o.userData.open) { o.userData.open.visible = true; o.userData.shut.visible = false; } CH.pose(o, 0, 0);
    const box = new THREE.Box3().setFromObject(o), hgt = Math.max(.5, box.max.y - box.min.y); o.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const pivot = new THREE.Group(); pivot.add(o); pivot.rotation.y = -.42; scene.add(pivot);
    cam.position.set(0, hgt * .8, hgt * 1.55); cam.lookAt(0, hgt * .74, 0); R.render(scene, cam);
    const c = document.createElement('canvas'); c.width = TW; c.height = TH; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    const sw = CW, sh = CW * TH / TW; g.drawImage(R.domElement, 0, (CH_ - sh) / 2, sw, sh, 0, 0, TW, TH);
    scene.remove(pivot); CH.dispose(o);
    const url = c.toDataURL('image/png'); thumbs.set(key, url); return url;
  }
  const thumbNow = (handle, jailed = false) => thumbs.get(handle + (jailed ? '|jail' : '')) || null;
  // a player bound to one <canvas>: show(handle) → frames when ready; stop() when the dossier closes
  function player(view) {
    const g = view.getContext('2d'); view.width = CW; view.height = CH_; let sh = null, k = 0, timer = 0, want = null;
    const draw = () => { if (!sh) return; g.clearRect(0, 0, CW, CH_); g.drawImage(sh, k * CW, 0, CW, CH_, 0, 0, CW, CH_); };
    const tick = () => { k = (k + 1) % N; draw(); };
    return {
      async show(handle, jailed, { delay = 0 } = {}) { want = handle + (jailed ? '|j' : ''); const my = want; sh = null; g.clearRect(0, 0, CW, CH_); view.dataset.state = 'wait';
        if (delay) await new Promise(r => setTimeout(r, delay)); if (want !== my) return;
        const s = await sheet(handle, jailed); if (want !== my || !s) return; sh = s; k = 0; draw(); view.dataset.state = 'ok'; clearInterval(timer); if (!reduced) timer = setInterval(tick, 110); },
      stop() { want = null; clearInterval(timer); timer = 0; },
      get playing() { return !!timer; },
    };
  }
  return { prewarm, sheet, player, thumb, thumbNow, stats: () => ({ cached: cache.size, thumbs: thumbs.size, ready: !!R }) };
}
