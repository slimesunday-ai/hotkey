// Read-only, no-store static server for the style corner. Usage: node style/serve.mjs [port]  (root = this worktree)
// Writes: POST /api/curation (the trait studio, style/city/studio/) replaces world/traits-curation.json; POST /api/stylelab (the UI style lab,
// style/city/ui/stylelab/) replaces style/city/ui/stylelab/picks.json. Nothing else is writable.
import http from 'node:http'; import fs from 'node:fs/promises'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)), port = Number(process.argv[2] || 5320);
const mime = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.md':'text/plain', '.woff2':'font/woff2' };
// ── the trait studio's keep / kill file: JSON only, 512 KB cap, this machine only (loopback socket, Host and Origin checked, so
// neither another site in the browser nor a rebound DNS name can write it), validated shape, written atomically
const CURATION = path.join(root, 'world/traits-curation.json'), CUR_MAX = 512 * 1024, STATUS = new Set(['keep', 'kill', 'undecided']);
const local = h => { try { const u = new URL('http://' + h); return (u.hostname === '127.0.0.1' || u.hostname === 'localhost') && Number(u.port || 80) === port; } catch { return false; } };
const okEntry = e => e && typeof e === 'object' && !Array.isArray(e) && STATUS.has(e.status) && (e.note === undefined || (typeof e.note === 'string' && e.note.length <= 500))
  && (e.at === undefined || typeof e.at === 'string' && e.at.length <= 40);
function validCuration(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.version !== 1 || !d.traits || typeof d.traits !== 'object' || Array.isArray(d.traits)) return 'expected { version: 1, traits: {…} }';
  const keys = Object.keys(d.traits); if (keys.length > 5000) return 'too many traits';
  for (const k of keys) { const e = d.traits[k]; if (!/^[a-z]{2,8}\/[A-Za-z0-9_]{1,32}$/.test(k)) return 'bad trait key ' + k.slice(0, 40); if (!okEntry(e)) return 'bad entry ' + k;
    if (e.cw !== undefined) { if (!e.cw || typeof e.cw !== 'object' || Array.isArray(e.cw)) return 'bad cw ' + k; for (const [i, c] of Object.entries(e.cw)) if (!/^\d{1,2}$/.test(i) || !okEntry(c)) return 'bad cw ' + k + '#' + i; }
    for (const f of Object.keys(e)) if (!['status', 'note', 'at', 'cw'].includes(f)) return 'unknown field ' + f; }
  for (const f of Object.keys(d)) if (!['version', 'about', 'updated', 'counts', 'traits'].includes(f)) return 'unknown field ' + f;
  return null;
}
async function postCuration(req, res) {
  const addr = req.socket.remoteAddress, json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(addr) || !local(req.headers.host || '') || (req.headers.origin && !local(req.headers.origin.replace(/^https?:\/\//, ''))))
    return json(403, { error: 'local only' });
  if (!/^application\/json\b/.test(req.headers['content-type'] || '')) return json(415, { error: 'application/json only' });
  if (Number(req.headers['content-length'] || 0) > CUR_MAX) return json(413, { error: 'too large' });
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > CUR_MAX) return json(413, { error: 'too large' }); chunks.push(c); }
  let d; try { d = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(400, { error: 'not JSON' }); }
  const bad = validCuration(d); if (bad) return json(422, { error: bad });
  const tmp = CURATION + '.tmp'; await fs.writeFile(tmp, JSON.stringify(d, null, 1) + '\n'); await fs.rename(tmp, CURATION);
  json(200, { ok: true, traits: Object.keys(d.traits).length, bytes: n });
}
// ── the UI style lab's keep / kill / maybe file (style/city/ui/stylelab/): the same rules as the curation file, this one file only
const PICKS = path.join(root, 'style/city/ui/stylelab/picks.json'), PICKS_MAX = 64 * 1024, PICK = new Set(['keep', 'kill', 'maybe', 'undecided']);
function validPicks(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.version !== 1 || !d.styles || typeof d.styles !== 'object' || Array.isArray(d.styles)) return 'expected { version: 1, styles: {…} }';
  const keys = Object.keys(d.styles); if (keys.length > 200) return 'too many styles';
  for (const k of keys) { const e = d.styles[k]; if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(k)) return 'bad style key ' + k.slice(0, 40);
    if (!e || typeof e !== 'object' || Array.isArray(e) || !PICK.has(e.status)) return 'bad entry ' + k;
    if (e.note !== undefined && (typeof e.note !== 'string' || e.note.length > 1000)) return 'bad note ' + k;
    if (e.name !== undefined && (typeof e.name !== 'string' || e.name.length > 60)) return 'bad name ' + k;
    if (e.at !== undefined && (typeof e.at !== 'string' || e.at.length > 40)) return 'bad at ' + k;
    for (const f of Object.keys(e)) if (!['status', 'note', 'name', 'at'].includes(f)) return 'unknown field ' + f; }
  for (const f of Object.keys(d)) if (!['version', 'about', 'updated', 'counts', 'styles'].includes(f)) return 'unknown field ' + f;
  return null;
}
async function postPicks(req, res) {
  const addr = req.socket.remoteAddress, json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(addr) || !local(req.headers.host || '') || (req.headers.origin && !local(req.headers.origin.replace(/^https?:\/\//, ''))))
    return json(403, { error: 'local only' });
  if (!/^application\/json\b/.test(req.headers['content-type'] || '')) return json(415, { error: 'application/json only' });
  if (Number(req.headers['content-length'] || 0) > PICKS_MAX) return json(413, { error: 'too large' });
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > PICKS_MAX) return json(413, { error: 'too large' }); chunks.push(c); }
  let d; try { d = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(400, { error: 'not JSON' }); }
  const bad = validPicks(d); if (bad) return json(422, { error: bad });
  const tmp = PICKS + '.tmp'; await fs.writeFile(tmp, JSON.stringify(d, null, 1) + '\n'); await fs.rename(tmp, PICKS);
  json(200, { ok: true, styles: Object.keys(d.styles).length, bytes: n });
}
http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/curation') { try { return await postCuration(req, res); } catch { res.writeHead(500); return res.end(); } }
  if (req.method === 'POST' && req.url === '/api/stylelab') { try { return await postPicks(req, res); } catch { res.writeHead(500); return res.end(); } }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  try { let name = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (name.endsWith('/')) name += 'index.html';
    const f = path.resolve(root, '.' + name); if (!f.startsWith(root) || name.split('/').some(p => p.startsWith('.'))) { res.writeHead(403); return res.end(); }
    const body = await fs.readFile(f); res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`style corner: http://127.0.0.1:${port}/style/`));
