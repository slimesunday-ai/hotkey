// SUBWAY STATIONS · do the feet land on the treads? A stand-in walker on a station's stairs (the subway module's own flight, the
// stairs_down / stairs_up clips on the movement's gait hook), frozen at a few moments of the flight and shot close up:
//   side   side-on, the near side of the stairwell cut away (a clip plane at the stairs' near edge: the treads' profile, the feet on it)
//   q34    three-quarter, from the street side, looking down the stairwell as a passer-by would
//   feet   the side cut with a long lens on the feet and the treads under them
//   head   the same on the head, where the flight goes under the soffit
//   top    straight down the stairwell
// with --stills, the station alone (street level, the default city camera's angle); with --clip, a short webm of the whole flight down and back up (q34). Live page, ?subway=stairs, no sim, no cars, no UI.
//   node style/city/subway/tools/treads.mjs [--base http://127.0.0.1:5481/style/city/] [--station subway-washington,subway-fit-street]
//        [--out style/city/shots/stations/treads] [--dir down,up] [--at 1.8,3.6] [--views side,q34,top] [--qside 1|-1] [--clip] [--secs 9]
//        [--stills street,city,cityfront,city90] (the station without a walker: across the street, and at the default city camera's angle) [--dir none]
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { open, sleep } from '../../ui/tools/cdp.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5481/style/city/'), OUT = path.resolve(opt('out', 'style/city/shots/stations/treads')), W = +opt('w', 960), H = +opt('h', 600);
const STATIONS = opt('station', 'subway-washington,subway-fit-street').split(','), DIRS = opt('dir', 'down,up').split(','), VIEWS = opt('views', 'side,q34').split(',');
const STILLS = opt('stills', '').split(',').filter(Boolean), QS = +opt('qside', 1), SECS = +opt('secs', 9), ATS = opt('at', '').split(',').filter(Boolean).map(Number), CLIP = args.includes('--clip'), LOOK = +opt('look', 5);
const Wd = JSON.parse(await fs.readFile(new URL('../../../../world/export/world.json', import.meta.url), 'utf8'));
await fs.mkdir(OUT, { recursive: true });
const jpg = async (S, f) => { const p = f.replace(/\.jpg$/, '.png'); await S.shot(p); execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '84', p, '--out', f], { stdio: 'ignore' }); await fs.rm(p); return f; };

// in the page: the well, a stand-in walker posed at flight time tau (s) going `dir`, the cameras, the cut
const PAGE = /* js */`(() => { if (window.__treads) return 1; const C = __city, T = C.THREE;
  const st = { w: null, who: null, L: null };
  window.__treads = {
    well: id => C.subway.well(id),
    // the flight's draw at tau (s into a stairs leg of SECS s)
    draw(id, dir, tau, secs) { const L = { kind: 'stairs', from: id, to: id, dep: 0, arr: secs / 2.5, dir }; return C.subway.under(L, tau / 2.5, [L], { id: 'treads-' + dir }); },
    pose(id, dir, tau, secs, look) { const d = this.draw(id, dir, tau, secs), sim = C.peds.sim;
      if (!d) { if (st.w) { sim.removeAgent('treads'); st.w = null; } return null; }
      if (!st.w) st.w = sim.putAgent({ id: 'treads', look, fix: [d.x, d.y, d.z, d.yaw] });
      const w = st.w; w.fix = [d.x, d.y, d.z, d.yaw]; w.vc = d.vc || 0; if (d.vc) w.ph += .05; w.mv = d.clip ? { clip: d.clip, clipT: d.clipT, stand: true } : null; return d; },
    clear() { if (st.w) { C.peds.sim.removeAgent('treads'); st.w = null; } },
    cam(p, t, fov = 50) { C.camera.position.set(p[0], p[1], p[2]); C.camera.fov = fov; C.camera.updateProjectionMatrix(); C.controls.target.set(t[0], t[1], t[2]); C.camera.lookAt(C.controls.target); C.controls.update(); },
    // the cutaway: keep what is on the inner side of each plane [nx, nz, x, z] (through (x, z), (nx, nz) pointing at what stays)
    cut(planes = []) { C.renderer.clippingPlanes = planes.map(([nx, nz, x, z]) => new T.Plane(new T.Vector3(nx, 0, nz), -(nx * x + nz * z))); },
    calm() { C.peds.setDemand(new Proxy({}, { get: () => 0 })); },   // (no new passers-by: they walk through close-up cameras)
  }; return 1; })()`;

const S = await open({ w: W, h: H });
const made = [];
try {
  for (const id of STATIONS) {
    const s = Wd.transit.stations.find(q => q.id === id); if (!s) { console.log('no station', id); continue; }
    const f = s.face === '-z' ? 1 : -1;
    await S.go(`${BASE}?subway=stairs&sim=0&cars=0&rig=0&ui=0&nodyn=1&loadin=0&cam=${s.x.toFixed(1)},14,${(s.z - f * 16).toFixed(1)}&look=${s.x.toFixed(1)},0,${s.z.toFixed(1)}`,
      { until: `window.__city && __city.marks.first && __city.subway && __city.peds && __city.peds.ready && __city.subway.well(${JSON.stringify(id)}) && __city.subway.well(${JSON.stringify(id)}).door`, ms: 400000 });
    await S.ev("(document.body.classList.add('shot'), document.querySelectorAll('.ui,.hint,#bench,#rpanel,#simbadge').forEach(e => e.style.display = 'none'), 1)");
    await S.ev("import('./simstate/movement.js').then(M => { window.__treadsMove ??= M.createMovement({ peds: __city.peds }); return 1; })");
    await S.ev(PAGE); await S.ev('__treads.calm()'); await sleep(4000);
    const well = await S.ev(`__treads.well(${JSON.stringify(id)})`); console.log(id, JSON.stringify(well));
    const [tx, tz] = well.top, [dx, dz] = well.dir, [px, pz] = [-dz, dx], half = (well.w ?? 4) / 2, y0 = well.y ?? .2, open_ = well.entry === 'stairs';
    // stills of the station itself: from across the street (10 m out, 2.2 m up), and at the default city camera's angle (main.js
    // VIEWS.overview: from (18, 152, 125) off its target, fov 44) brought in to 45 m — 'city' on its own heading (from the south-east),
    // 'cityfront' the same pitch turned to look at the station's street side
    for (const v of STILLS) { const mx = tx + dx * 2.2, mz = tz + dz * 2.2;
      if (v === 'street') await S.ev(`__treads.cam([${tx - dx * 10 + px * QS * 2.5}, 2.2, ${tz - dz * 10 + pz * QS * 2.5}], [${mx}, ${y0 + .9}, ${mz}], 50)`);
      else { const D = v === 'city90' ? 90 : 45, o = [18, 152, 125], L = Math.hypot(...o), h = Math.hypot(o[0], o[2]), oo = v === 'cityfront' ? [-dx * h + px * 18 / h * h * .14, o[1], -dz * h + pz * 18 / h * h * .14] : o, LL = Math.hypot(...oo);
        await S.ev(`__treads.cam([${mx + oo[0] / LL * D}, ${oo[1] / LL * D}, ${mz + oo[2] / LL * D}], [${mx}, 0, ${mz}], 44)`); }
      await sleep(1500); const file = path.join(OUT, `${id.replace(/^subway-/, '')}-${v}.jpg`); await jpg(S, file); made.push(file); console.log('shot', file); }
    for (const dir of DIRS) { if (dir === 'none') continue;
      const ats = ATS.length ? ATS : dir === 'down' ? [1.8, 3.6, 5.8] : [1.4, 3.4, 5.4];
      for (const at of ats) {
        const d = await S.ev(`__treads.pose(${JSON.stringify(id)}, '${dir}', ${at}, ${SECS}, ${LOOK})`); if (!d) { console.log(id, dir, at, 'out of view'); continue; }
        for (let k = 0; k < 24; k++) { await S.ev(`__treads.pose(${JSON.stringify(id)}, '${dir}', ${at}, ${SECS}, ${LOOK})`); await sleep(40); }   // (the clip blends in, the pose settles)
        const mid = [d.x, d.y + .75, d.z];
        for (const v of VIEWS) {
          // side: square on, from 7 m with a long lens (little perspective), the eye at shin height: the treads' profile against the far wall
          // (cut 0.62 m beside the walker's line, so the treads' section runs right past its feet; and in front of the stairs and behind the well)
          if (v === 'side') { await S.ev(`__treads.cut([[${-px}, ${-pz}, ${tx + px * .62}, ${tz + pz * .62}], [${dx}, ${dz}, ${tx - dx * 1.2}, ${tz - dz * 1.2}], [${-dx}, ${-dz}, ${tx + dx * 5.9}, ${tz + dz * 5.9}]])`); await S.ev(`__treads.cam([${d.x + px * 7.5}, ${d.y + .45}, ${d.z + pz * 7.5}], [${d.x}, ${d.y + .45}, ${d.z}], 22)`); }
          // feet: the same cut, a long lens on the feet and the treads under them
          else if (v === 'feet') { await S.ev(`__treads.cut([[${-px}, ${-pz}, ${tx + px * .62}, ${tz + pz * .62}], [${dx}, ${dz}, ${tx - dx * 1.2}, ${tz - dz * 1.2}], [${-dx}, ${-dz}, ${tx + dx * 5.9}, ${tz + dz * 5.9}]])`); await S.ev(`__treads.cam([${d.x + px * 7.5}, ${d.y + .12}, ${d.z + pz * 7.5}], [${d.x}, ${d.y + .12}, ${d.z}], 9)`); }
          // head: the same cut, a long lens on the head (where the flight goes under the soffit: does it clear?)
          else if (v === 'head') { await S.ev(`__treads.cut([[${-px}, ${-pz}, ${tx + px * .62}, ${tz + pz * .62}], [${dx}, ${dz}, ${tx - dx * 1.2}, ${tz - dz * 1.2}], [${-dx}, ${-dz}, ${tx + dx * 5.9}, ${tz + dz * 5.9}]])`); await S.ev(`__treads.cam([${d.x + px * 7.5}, ${d.y + 1.55}, ${d.z + pz * 7.5}], [${d.x}, ${d.y + 1.55}, ${d.z}], 10)`); }
          // q34: standing at the mouth of the stairs, a little to one side, under the kiosk's lintel, looking down at the walker
          // (an open entrance: from the sidewalk outside its front corner, over the railing)
          else if (v === 'q34') { await S.ev('__treads.cut([])'); const [qa, qu, qh] = open_ ? [2.5, .6, 3.0] : [.25, 1.45, 2.2]; await S.ev(`__treads.cam([${tx - dx * qa + px * QS * qu}, ${y0 + qh}, ${tz - dz * qa + pz * QS * qu}], [${d.x}, ${d.y + .45}, ${d.z}], 56)`); }
          else if (v === 'top') { await S.ev('__treads.cut([])'); await S.ev(`__treads.cam([${d.x - dx * .6}, ${y0 + 4.2}, ${d.z - dz * .6}], [${d.x + dx * .05}, ${d.y}, ${d.z + dz * .05}], 50)`); }
          await sleep(350); const file = path.join(OUT, `${id.replace(/^subway-/, '')}-${dir}-${at.toFixed(1)}s-${v}.jpg`); await jpg(S, file); made.push(file); console.log('shot', file); }
      }
      await S.ev('__treads.cut([])'); await S.ev('__treads.clear()');
    }
    if (CLIP) {   // the whole flight, down then up, at 1x, from the street side
      { const [qa, qu, qh] = open_ ? [2.4, .35, 3.9] : [.3, 1.45, 2.3]; await S.ev(`__treads.cam([${tx - dx * qa + px * QS * qu}, ${y0 + qh}, ${tz - dz * qa + pz * QS * qu}], [${tx + dx * 2.4}, ${y0 - 1.1}, ${tz + dz * 2.4}], 60)`); } await sleep(800);
      const dirF = path.join(OUT, '.frames-' + id); await fs.rm(dirF, { recursive: true, force: true }); await fs.mkdir(dirF, { recursive: true });
      await S.cast(true, { quality: 78 });
      for (const dir of ['down', 'up']) { const t0 = Date.now(); while (Date.now() - t0 < SECS * 1000) { await S.ev(`__treads.pose(${JSON.stringify(id)}, '${dir}', ${(Date.now() - t0) / 1000}, ${SECS}, ${LOOK})`); await sleep(16); } await S.ev('__treads.clear()'); await sleep(400); }
      await S.cast(false); await sleep(300);
      const F = S.frames.slice(); let list = '';
      for (let k = 0; k < F.length; k++) { const fp = path.join(dirF, String(k).padStart(5, '0') + '.jpg'); await fs.writeFile(fp, Buffer.from(F[k].data, 'base64')); const du = k + 1 < F.length ? Math.max(.01, F[k + 1].t - F[k].t) : .04; list += `file '${fp}'\nduration ${du.toFixed(3)}\n`; }
      await fs.writeFile(path.join(dirF, 'list.txt'), list); const out = path.join(OUT, `${id.replace(/^subway-/, '')}-down-up.webm`);
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dirF, 'list.txt'), '-vf', `scale=${W}:-2,fps=24`, '-c:v', 'libvpx-vp9', '-b:v', '1200k', '-deadline', 'realtime', '-cpu-used', '8', out]);
      await fs.rm(dirF, { recursive: true, force: true }); made.push(out); console.log('clip', out, F.length, 'frames');
    }
  }
  if (S.errs.length) console.log('page errors:', S.errs.slice(0, 5));
} finally { await S.close(); }
console.log(made.length, 'files');
