// Pass 2 · regression hashes: one FNV-1a hash per built tier of a block job result (full layers, mid, far, character tiers), so a
// refactor of the generator can be proven to change nothing (tools/audit.mjs hash <label> → runs/<label>.hash.json, then diff).
const fnv = (h, a) => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let k = 0; k < u.length; k++) { h ^= u[k]; h = Math.imul(h, 16777619); } return h >>> 0; };
const tierHash = t => { if (!t) return 0; let h = 0x811c9dc5; for (const a of [t.P, t.N, t.C, t.F]) h = fnv(h, a); return h >>> 0; };
export function hashJob(res) {
  const out = { full: (res.full || []).map(tierHash), mid: tierHash(res.mid), far: tierHash(res.far) };
  if (res.chars) { out.cmid = tierHash(res.chars.mid); out.cfar = res.chars.far ? fnv(0x811c9dc5, res.chars.far) : 0; out.people = res.chars.n; }
  return out;
}
