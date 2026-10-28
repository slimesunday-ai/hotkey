// MAINLAND v1 · the build worker. The page hands it the job module graph as sources (pool.js bundleOf) and plots.json once; each module
// becomes a Blob URL with `three` pointed at the CDN (the city's worker does the same), then jobs run: a ground tile, a lot (a house
// stamped at its plot), the built scene, the far tier. Each job answers with its bank packed into typed arrays (transferred, not copied).
import { THREE_URL, ADDONS_URL, FROM_RE } from '../srcmap.js';

function maker(bundle) {
  const src = new Map(bundle), blob = new Map(), stack = new Set();
  const make = url => { if (blob.has(url)) return blob.get(url); if (stack.has(url)) throw new Error('import cycle at ' + url); stack.add(url);
    try { const code = src.get(url); if (code === undefined) throw new Error('missing source ' + url);
      const out = code.replace(FROM_RE, (m, pre, q, spec) => pre + q + (spec === 'three' ? THREE_URL : spec.startsWith('three/addons/') ? ADDONS_URL + spec.slice(13) : spec.startsWith('.') ? make(new URL(spec, url).href) : spec) + q);
      const b = URL.createObjectURL(new Blob([out], { type: 'text/javascript' })); blob.set(url, b); return b; } finally { stack.delete(url); } };
  return make;
}
let plan = null, M = null;
onmessage = async e => {
  const d = e.data;
  try {
    if (d.init) { plan = d.init; M = await import(maker(d.bundle)(d.entry)); M.TOD.night = !!d.night; postMessage({ ready: true }); return; }
    const t0 = performance.now(); let bank, extra = null;
    if (d.task === 'ground') { bank = M.buildGround(plan, d.arg); extra = bank.lawn; }
    else if (d.task === 'lot') { const P = d.arg, { bank: lb, A } = M.buildLot(P.spec); bank = new M.Bank(true); M.stampA(lb, bank, P.rot, P.x, .2, P.z); extra = A; }
    else if (d.task === 'house') { const { bank: lb, A } = M.buildLot({ ...d.arg.spec, houseOnly: true }); bank = lb; extra = A; }   // (the house builder's preview: lot frame, unshifted)
    else if (d.task === 'scene') { bank = M.buildScene(plan); extra = { trees: bank.trees || [] }; }
    else if (d.task === 'far') bank = M.buildFar(d.arg);
    const P = M.pack(bank), tr = []; for (const O of P) if (O.v) tr.push(O.P.buffer, O.N.buffer, O.C.buffer, O.I.buffer);
    for (const L of [extra, extra?.lawn]) if (L?.tex) tr.push(L.tex.buffer, L.mask.buffer);   // (the lawn maps: transferred, not copied)
    postMessage({ id: d.id, P, extra, ms: performance.now() - t0 }, tr);
  } catch (err) { postMessage({ id: d.id, err: String(err && (err.stack || err.message) || err) }); }
};
