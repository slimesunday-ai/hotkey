// AI CITY · THE MAINLAND RELAY v1 (2026-10-06) · "humans should be able to chat here and hang out". A tiny standalone Node server the
// Mainland page connects to over WebSocket: it relays PRESENCE (where everyone walking is, ~10 Hz, batched into one message a tick) and
// CHAT (lines, emotes, handle changes) between everyone in the same room (the Mainland is one room). Nothing is stored; a restart forgets.
//   node style/city/mainland/relay.mjs [--port 5460] [--host 127.0.0.1] [--bots N] [--bots-at x,z] [--origin <origin,…>|any]
//   --port      default 5460 (or RELAY_PORT)
//   --host      the interface: 127.0.0.1 (this machine only, the default) · 0.0.0.0 (the LAN / tailnet: also pass --origin)
//   --bots N    dev: N fake players walking the streets near --bots-at (default the ferry terminal), chatting and emoting now and then
//   --origin    the page origins allowed to connect, comma separated; default any http(s) origin on localhost / 127.0.0.1; 'any' allows all
// ZERO DEPENDENCIES: Node 22 has a WebSocket client but no server, so this is a minimal RFC 6455 server: the upgrade handshake, masked
// client frames (text only, continuation frames joined), unmasked server frames, ping / pong (a silent connection is dropped after 40 s),
// close. No extensions (no permessage-deflate), no binary.
// GUARDRAILS (v1, chatrules.mjs, shared with the page): a 1 KB message cap, a per-connection message budget (30 a second, sustained, or
// the connection is closed), a chat bucket (4 lines, one more every 1.5 s), 140 characters a line, a basic word filter, sanitised
// handles, 8 connections an address, 64 a room. NOT MODERATION: no accounts, no auth, no reports or bans. Before this is public it needs
// real moderation and auth (README).
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { RULES, cleanText, cleanName, bucket } from './chatrules.mjs';

const ARGS = (() => { const a = process.argv.slice(2), o = {}; for (let k = 0; k < a.length; k++) { const m = /^--([\w-]+)(?:=(.*))?$/.exec(a[k]); if (!m) { o._ = a[k]; continue; }
  o[m[1]] = m[2] ?? (a[k + 1] && !a[k + 1].startsWith('--') ? a[++k] : true); } return o; })();
const PORT = +(ARGS.port ?? ARGS._ ?? process.env.RELAY_PORT ?? 5460), HOST = String(ARGS.host ?? '127.0.0.1');
const ORIGINS = ARGS.origin === 'any' || ARGS.origin === true ? 'any' : new Set(String(ARGS.origin || '').split(',').filter(Boolean));
const PER_IP = 8, ROOM_MAX = 64, TICK = 1000 / RULES.stateHz, SILENT = 40e3, PING = 15e3, HISTORY = 12, QUIET = !!ARGS.quiet;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const log = (...a) => { if (!QUIET) console.log(new Date().toISOString().slice(11, 19), ...a); };

// ── who may connect: a page served from this machine (any port), or the --origin list
function originOk(o) { if (ORIGINS === 'any') return true; if (!o) return true;   // (no Origin: not a browser page; tools, the bots' tests)
  if (ORIGINS.has(o)) return true; try { const u = new URL(o); return /^https?:$/.test(u.protocol) && (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]'); } catch { return false; } }

// ── rooms: Map name → { conns: Set, hist: [] }; a connection (or a bot) is a peer { sid, pid, n, l, st, dirty, room }
const rooms = new Map(), byIp = new Map();
let nextSid = 1;
const roomOf = name => rooms.get(name) ?? rooms.set(name, { name, conns: new Set(), hist: [] }).get(name);
const peerInfo = p => ({ i: p.sid, pid: p.pid, n: p.n, l: p.l, s: p.st || null, bot: p.bot ? 1 : undefined });
function broadcast(room, obj, except = null) { const s = JSON.stringify(obj); for (const p of room.conns) if (p !== except && p.send) p.send(s); }

// ── the WebSocket server
const server = http.createServer((req, res) => {
  const n = [...rooms.values()].map(r => `${r.name}: ${r.conns.size} (${[...r.conns].filter(p => p.bot).length} bots)`).join(' · ') || 'nobody';
  if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify({ ok: true, rooms: [...rooms.values()].map(r => ({ room: r.name, n: r.conns.size })) })); return; }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }); res.end(`AI City · Mainland relay (WebSocket, ws://host:${PORT}/mainland)\n${n}\n`);
});
server.on('upgrade', (req, sock, head) => {
  const fail = (code, why) => { try { sock.end(`HTTP/1.1 ${code} ${why}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); } catch {} sock.destroy(); };
  const key = req.headers['sec-websocket-key'];
  if (String(req.headers.upgrade).toLowerCase() !== 'websocket' || !key || !/^[A-Za-z0-9+/]{22}==$/.test(key) || req.headers['sec-websocket-version'] !== '13') return fail(400, 'Bad Request');
  if (!originOk(req.headers.origin)) { log('refused origin', req.headers.origin); return fail(403, 'Forbidden'); }
  const name = new URL(req.url, 'http://x').pathname.replace(/^\/+|\/+$/g, '') || 'mainland';
  if (!/^[a-z0-9-]{1,32}$/.test(name)) return fail(404, 'Not Found');
  const ip = sock.remoteAddress || '?'; if ((byIp.get(ip) || 0) >= PER_IP) return fail(429, 'Too Many Requests');
  const room = roomOf(name); if (room.conns.size >= ROOM_MAX) return fail(503, 'Room Full');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${crypto.createHash('sha1').update(key + GUID).digest('base64')}\r\n\r\n`);
  sock.setNoDelay(true); byIp.set(ip, (byIp.get(ip) || 0) + 1);
  const c = wsConn(sock, room, ip); if (head && head.length) c.feed(head);
});

function frame(op, payload) { const n = payload.length, h = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | op; b[1] = 127; b.writeUInt32BE(0, 2); b.writeUInt32BE(n, 6); return b; })();
  return Buffer.concat([h, payload]); }

function wsConn(sock, room, ip) {
  let buf = Buffer.alloc(0), frag = null, done = false;
  const p = { sid: String(nextSid++), pid: '', n: '', l: null, st: null, dirty: false, room, joined: false, heard: Date.now(),
    msgs: bucket(RULES.msgPerSec * 2, 1 / RULES.msgPerSec), drops: bucket(RULES.msgPerSec * 2, .2), chat: bucket(RULES.chatBurst, RULES.chatEvery), emote: bucket(3, 2), rename: bucket(2, 10) };
  p.send = s => { if (done) return; if (sock.writableLength > 512 * 1024) return close(1008, 'too slow'); sock.write(frame(1, Buffer.from(s))); };
  p.ping = () => { if (!done) sock.write(frame(9, Buffer.alloc(0))); };
  function close(code = 1000, why = '') { if (done) return; done = true; const b = Buffer.alloc(2 + Buffer.byteLength(why)); b.writeUInt16BE(code, 0); b.write(why, 2);
    try { sock.end(frame(8, b)); } catch {} setTimeout(() => sock.destroy(), 1000).unref(); leave(); }
  function leave() { if (p.left) return; p.left = true; byIp.set(ip, Math.max(0, (byIp.get(ip) || 1) - 1)); if (!byIp.get(ip)) byIp.delete(ip);
    room.conns.delete(p); if (p.joined) { broadcast(room, { t: 'l', i: p.sid }); log(`leave ${p.n} (${room.name}: ${room.conns.size})`); } }
  p.close = close;
  sock.on('close', () => { done = true; leave(); }); sock.on('error', () => { done = true; leave(); sock.destroy(); });
  sock.on('data', d => p.feed(d)); sock.setTimeout(0);
  p.feed = d => {
    if (done) return; buf = buf.length ? Buffer.concat([buf, d]) : d; p.heard = Date.now();
    for (;;) {
      if (buf.length < 2) return;
      const b0 = buf[0], b1 = buf[1], fin = !!(b0 & 0x80), op = b0 & 15; let len = b1 & 127, off = 2;
      if (b0 & 0x70) return close(1002, 'no extensions'); if (!(b1 & 0x80)) return close(1002, 'unmasked');
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; if (buf.readUInt32BE(2)) return close(1009, 'too big'); len = buf.readUInt32BE(6); off = 10; }
      if (len > RULES.frameMax) return close(1009, 'too big');
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4), data = Buffer.from(buf.subarray(off + 4, off + 4 + len)); for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (op >= 8) { if (!fin || len > 125) return close(1002, 'bad control');
        if (op === 8) { const code = data.length >= 2 ? data.readUInt16BE(0) : 1000; return close(code >= 1000 && code < 5000 && code !== 1005 && code !== 1006 ? code : 1000); }
        if (op === 9) { sock.write(frame(10, data)); continue; } if (op === 10) continue; return close(1002, 'bad opcode'); }
      if (op === 2) return close(1003, 'text only');
      if (op === 1) { if (frag) return close(1002, 'bad continuation'); if (fin) onText(p, data.toString('utf8')); else frag = [data]; }
      else if (op === 0) { if (!frag) return close(1002, 'bad continuation'); frag.push(data); const total = frag.reduce((s, b) => s + b.length, 0); if (total > RULES.frameMax) return close(1009, 'too big');
        if (fin) { const all = Buffer.concat(frag); frag = null; onText(p, all.toString('utf8')); } }
      else return close(1002, 'bad opcode');
      if (done) return;
    }
  };
  return p;
}

// ── the protocol (JSON text frames). Page → relay:
//   {t:'hello', v:1, pid, name, look:{seed}|{handle}}       first, once
//   {t:'s', k, x, y, z, r, m, g, j, a, d?, h?}               presence: k the sender's clock (ms), r the body's yaw, m 0 browsing · 1 street ·
//                                                             2 inside (d the door [x, z], h its address), g on the ground, j jumping, a away
//   {t:'c', m}  a chat line · {t:'e', e} an emote · {t:'n', n} a new handle
// Relay → page: {t:'welcome', you, room, peers:[…], hist:[…], rules} · {t:'j', …peer} joined · {t:'l', i} left · {t:'S', a:[{i, …state}]}
// presence, batched each tick · {t:'c', i, n, m, k} chat · {t:'e', i, e} · {t:'n', i, n} · {t:'w', m} a warning to you alone
const num = (v, lim = 4000) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim;
function onText(p, s) {
  if (!p.msgs.take()) { if (!p.drops.take()) p.close(1008, 'too many messages'); return; }   // (over budget: dropped; 60 drops, refilled 5 a second, then closed)
  let m; try { m = JSON.parse(s); } catch { return; } if (!m || typeof m !== 'object' || Array.isArray(m)) return;
  const room = p.room;
  if (!p.joined) { if (m.t !== 'hello') return p.close(1008, 'hello first');
    p.pid = typeof m.pid === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(m.pid) ? m.pid : 'anon-' + p.sid;
    p.n = cleanName(m.name) || 'guest-' + p.sid;
    const L = m.look || {}; p.l = Number.isInteger(L.seed) && L.seed >= 0 && L.seed < 2 ** 32 ? { seed: L.seed } : typeof L.handle === 'string' && /^[\w.-]{1,32}$/.test(L.handle) ? { handle: L.handle } : { seed: 7 };
    p.joined = true; room.conns.add(p);
    p.send(JSON.stringify({ t: 'welcome', you: p.sid, room: room.name, name: p.n, peers: [...room.conns].filter(q => q !== p && q.joined).map(peerInfo), hist: room.hist, rules: { msgMax: RULES.msgMax, stateHz: RULES.stateHz } }));
    broadcast(room, { t: 'j', ...peerInfo(p) }, p); log(`join ${p.n} (${room.name}: ${room.conns.size})`); return; }
  if (m.t === 's') { const mode = m.m === 1 || m.m === 2 ? m.m : 0;
    if (mode === 1 && !(num(m.x) && num(m.z) && num(m.r, 1e4) && (m.y === null || num(m.y, 500)))) return;
    const st = { k: num(m.k, 1e13) ? Math.round(m.k) : 0, m: mode };
    if (mode === 1) Object.assign(st, { x: +m.x.toFixed(3), y: m.y === null ? null : +m.y.toFixed(3), z: +m.z.toFixed(3), r: +m.r.toFixed(3), g: m.g ? 1 : 0, j: m.j ? 1 : 0 });
    if (m.a) st.a = 1;
    if (mode === 2 && Array.isArray(m.d) && num(m.d[0]) && num(m.d[1])) { st.d = [+m.d[0].toFixed(2), +m.d[1].toFixed(2)]; if (typeof m.h === 'string') st.h = cleanText(m.h).slice(0, 40); }
    p.st = st; p.dirty = true; return; }
  if (m.t === 'c') { if (!p.chat.take()) return p.send(JSON.stringify({ t: 'w', m: 'slow down: one line every couple of seconds' }));
    const text = cleanText(m.m); if (!text) return;
    const line = { t: 'c', i: p.sid, n: p.n, m: text, k: Date.now() }; room.hist.push(line); if (room.hist.length > HISTORY) room.hist.shift(); broadcast(room, line); return; }
  if (m.t === 'e') { if (!RULES.emotes.includes(m.e) || !p.emote.take()) return; broadcast(room, { t: 'e', i: p.sid, e: m.e }); return; }
  if (m.t === 'n') { if (!p.rename.take()) return p.send(JSON.stringify({ t: 'w', m: 'one handle change every few seconds' })); const n = cleanName(m.n);
    if (!n) return p.send(JSON.stringify({ t: 'w', m: 'that handle won\'t work' })); if (n === p.n) return; log(`rename ${p.n} → ${n}`); p.n = n; broadcast(room, { t: 'n', i: p.sid, n }); return; }
}

// ── the tick: every changed presence in one message to the room; pings; the silent dropped
setInterval(() => { for (const room of rooms.values()) { const a = []; for (const p of room.conns) if (p.dirty && p.st) { p.dirty = false; a.push({ i: p.sid, ...p.st }); }
  if (a.length) broadcast(room, { t: 'S', a }); } }, TICK);
setInterval(() => { const now = Date.now(); for (const room of rooms.values()) for (const p of room.conns) { if (p.bot) continue; if (now - p.heard > SILENT) p.close(1001, 'silent'); else p.ping(); } }, PING);

// ── DEV BOTS (--bots N): fake players on the streets near --bots-at (default the ferry terminal): they walk the street centrelines
// (a little off them, both ways), stop and idle, sometimes run, say something now and then and emote. y null: the page grounds them.
const BOT_NAMES = ['dollarstore_dan', 'lil_cul_de_sac', 'mortgage_maxi', 'hoa_hank', 'porch_pirate', 'lawn_gnome', 'sprinkler_sam', 'gazebo_gus', 'mailbox_mo',
  'two_car_tina', 'cul_de_saint', 'picket_pete', 'zoning_zoe', 'grill_bill', 'flip_flop_fran', 'open_house_olu'];
const BOT_LINES = ['anyone else smell fresh cut grass', 'who owns the gold statue', 'new in the neighbourhood', 'this lawn is immaculate', 'gm mainland',
  'the ferry was late again', 'is the gazebo free saturday', 'lowkey want the corner lot', 'sprinklers on at noon, bold', 'hoa meeting at 7',
  'nice house', 'come see my porch', 'whose car is that', 'brb mowing', 'property values only go up'];
function startBots(n, at) {
  const plan = JSON.parse(fs.readFileSync(new URL('./plots.json', import.meta.url)));
  const near = 60, segs = [];
  for (const s of plan.streets) if (s.pts) for (let k = 1; k < s.pts.length; k++) { let [a, b] = [s.pts[k - 1], s.pts[k]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < .5) continue;   // (long straight streets: split into ~20 m pieces so a bot's patch stays near)
    const parts = Math.max(1, Math.round(L / 20)); for (let q = 0; q < parts; q++) { const t0 = q / parts, t1 = (q + 1) / parts, A = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], B = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      if (Math.hypot((A[0] + B[0]) / 2 - at[0], (A[1] + B[1]) / 2 - at[1]) < near) segs.push([A, B]); } }
  if (!segs.length) { console.warn('bots: no street within', near, 'm of', at); return; }
  // the street graph: a segment's ends link to the segments that share them
  const key = ([x, z]) => `${Math.round(x * 2)},${Math.round(z * 2)}`, at_ = new Map(); segs.forEach((s, i) => { for (const e of [0, 1]) (at_.get(key(s[e])) ?? at_.set(key(s[e]), []).get(key(s[e]))).push([i, e]); });
  const room = roomOf('mainland'), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0], dt = TICK / 1000;
  const bots = [];
  for (let k = 0; k < n; k++) { const seg = (Math.random() * segs.length) | 0;
    const b = { sid: 'b' + (k + 1), pid: 'bot-' + (k + 1), n: BOT_NAMES[k % BOT_NAMES.length] + (k >= BOT_NAMES.length ? '_' + k : ''), l: { seed: 0xb07 * 7919 + k * 104729 }, bot: true, joined: true, room,
      seg, t: Math.random(), dir: Math.random() < .5 ? 1 : -1, side: rnd(-2.6, 2.6), speed: 1.45, pause: rnd(0, 3), say: rnd(4, 20), emo: rnd(20, 60), yaw: 0, st: null, dirty: false };
    bots.push(b); room.conns.add(b); broadcast(room, { t: 'j', ...peerInfo(b) }, b); }
  setInterval(() => { const now = performance.now();
    for (const b of bots) {
      if (b.pause > 0) { b.pause -= dt; } else {
        const [A, B] = segs[b.seg], L = Math.hypot(B[0] - A[0], B[1] - A[1]); b.t += b.dir * b.speed * dt / L;
        if (b.t > 1 || b.t < 0) { const end = b.t > 1 ? 1 : 0, nx = (at_.get(key(segs[b.seg][end])) || []).filter(([i]) => i !== b.seg);
          if (nx.length && Math.random() < .85) { const [i, e] = pick(nx); b.seg = i; b.t = e === 0 ? 0 : 1; b.dir = e === 0 ? 1 : -1; } else { b.dir = -b.dir; b.t = end; }
          if (Math.random() < .3) b.pause = rnd(1.5, 6); b.speed = Math.random() < .2 ? 3.4 : 1.45; } }
      const [A, B] = segs[b.seg], L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, tx = (B[0] - A[0]) / L, tz = (B[1] - A[1]) / L, t = Math.max(0, Math.min(1, b.t));
      const x = A[0] + (B[0] - A[0]) * t - tz * b.side, z = A[1] + (B[1] - A[1]) * t + tx * b.side;
      if (b.pause <= 0) b.yaw = Math.atan2(tx * b.dir, tz * b.dir);
      b.st = { k: Math.round(now), m: 1, x: +x.toFixed(3), y: null, z: +z.toFixed(3), r: +b.yaw.toFixed(3), g: 1, j: 0 }; b.dirty = true;
      if ((b.say -= dt) < 0) { b.say = rnd(15, 45); const line = { t: 'c', i: b.sid, n: b.n, m: pick(BOT_LINES), k: Date.now() }; room.hist.push(line); if (room.hist.length > HISTORY) room.hist.shift(); broadcast(room, line); }
      if ((b.emo -= dt) < 0) { b.emo = rnd(30, 90); b.pause = Math.max(b.pause, 3); broadcast(room, { t: 'e', i: b.sid, e: pick(RULES.emotes) }); }
    } }, TICK);
  log(`${n} bots on ${segs.length} street pieces near ${at.join(',')}`);
}

server.listen(PORT, HOST, () => {
  log(`AI City Mainland relay · ws://${HOST}:${PORT}/mainland · origins ${ORIGINS === 'any' ? 'any' : ['localhost', '127.0.0.1', ...ORIGINS].join(', ')}`);
  const nb = Math.max(0, Math.min(ROOM_MAX - 1, +(ARGS.bots === true ? 10 : ARGS.bots || 0)));
  if (nb) startBots(nb, String(ARGS['bots-at'] || '5,-20').split(',').map(Number));
});
server.on('error', e => { console.error('relay:', e.message); process.exit(1); });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { for (const r of rooms.values()) for (const p of r.conns) p.close?.(1001, 'relay stopping'); setTimeout(() => process.exit(0), 200); });
