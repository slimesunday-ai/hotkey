// C2 (b) · THE CARD'S POCKETS ARE THE LAST DISCLOSED HOLDINGS RECEIPT, exactly (ui/record/dossier.js Pockets, from panel-data.js's
// tapeAt holdings): headless Chrome on ?sim=record, read against the feed in node.
//   node style/city/tools/pocketscheck.mjs --port 5962 [--seed 404] [--out <dir>]
// Cases, picked from the feed: for Nico (a10), an agent with a crew stash and an agent holding pieces, the moment one minute before a
// receipt whose values differ from the one before it (Pockets must still show the older one: never newer than the disclosure), one
// minute after it (the new one), and a minute before the agent's first receipt (nothing disclosed: no values at all).
// At each, the card's Pockets ([data-pockets]) must show exactly the receipt's typed fields: its id (data-receipt), its minute
// (data-asof, at or before the playhead), cash, each piece (copy + trait), each good with a count, and the crew stash's cash, pieces
// and goods; nothing more, nothing less; under the TAPE lens badge with an "as of" stamp; the cash printed as $n.
import path from 'node:path';
import { ROOT, PORT, arg, sleep, season, open, serve, chrome, tod, report, writeResult } from './c2lib.mjs';

const SEED = +arg('seed', 404), OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-checks/pockets')));
if (!PORT) { console.error('usage: node style/city/tools/pocketscheck.mjs --port <port>'); process.exit(2); }
const S = season(SEED), steps = [], result = { seed: SEED, cases: [] };
const receipts = id => S.frames.flatMap(f => f.events).filter(e => e.type === 'holdings' && e.agent === id);
// the receipt's values as "path=value" lines (the order-free comparison the DOM is held to)
function want(r) {
  if (!r) return [];
  const out = [`cash=${r.cash}`];
  for (const p of r.pieces ?? []) out.push(`piece=${p.copy}:${p.trait}`);
  for (const [k, n] of Object.entries(r.goods ?? {})) if (n) out.push(`goods.${k}=${n}`);
  if (r.crew) { out.push(`crew.cash=${r.crew.cash}`);
    for (const p of r.crew.pieces ?? []) out.push(`crew.piece=${p.copy}:${p.trait}`);
    for (const [k, n] of Object.entries(r.crew.goods ?? {})) if (n) out.push(`crew.goods.${k}=${n}`); }
  return out.sort();
}
const sig = r => JSON.stringify(want(r));
function casesFor(id) {
  const rs = receipts(id), out = [];
  if (!rs.length) return out;
  out.push({ agent: id, minute: rs[0].minute - 1, expect: null });
  const k = rs.findIndex((r, i) => i > 0 && sig(r) !== sig(rs[i - 1]) && r.minute - rs[i - 1].minute >= 2);
  if (k > 0) { out.push({ agent: id, minute: rs[k].minute - 1, expect: rs[k - 1] }); out.push({ agent: id, minute: rs[k].minute + 1, expect: rs[k] }); }
  return out;
}
const all = S.frames.flatMap(f => f.events).filter(e => e.type === 'holdings');
const crewAgent = all.find(e => e.crew && (e.crew.cash || e.crew.pieces.length || Object.values(e.crew.goods).some(Boolean)))?.agent;
const pieceAgent = all.find(e => e.pieces.length && e.agent !== 'a10' && e.agent !== crewAgent)?.agent;
const CASES = [...casesFor('a10'), ...(crewAgent ? casesFor(crewAgent) : []), ...(pieceAgent ? casesFor(pieceAgent) : [])]
  // (Nico on night 12, the night a13 mugs him: the brief's case; and the first receipt whose crew stash holds something)
  .concat([{ agent: 'a10', minute: 18600, expect: receipts('a10').filter(r => r.minute <= 18600).at(-1) ?? null }])
  .concat(crewAgent ? (r => [{ agent: r.agent, minute: r.minute + 1, expect: r }])(all.find(e => e.agent === crewAgent && e.crew && (e.crew.cash || e.crew.pieces.length || Object.values(e.crew.goods).some(Boolean)))) : []);
const DUMP = `(() => { const box = document.querySelector('#r-dossier [data-pockets]'); if (!box) return null;
  const lines = [...box.querySelectorAll('[data-pk]')].map(n => n.dataset.pk === 'piece' || n.dataset.pk === 'crew.piece' ? n.dataset.pk + '=' + n.dataset.copy + ':' + n.dataset.trait : n.dataset.pk + '=' + n.dataset.n).sort();
  const badge = box.querySelector('.k-lens[data-lens=tape]'), cash = box.querySelector('[data-pk=cash]');
  return { receipt: box.dataset.receipt || null, asOf: box.dataset.asof ? +box.dataset.asof : null, lines, badge: badge ? badge.textContent : null,
    cashText: cash?.textContent ?? null, minute: window.__record.player.minute, current: window.__recordUI.dossier.current }; })()`;
const server = await serve(), B = await chrome();
try {
  for (const c of CASES) {
    await open(B, SEED, `recordAt=${c.minute}&recordPaused=1&tod=${tod(c.minute)}&simtod=0&tv=0&dossier=${c.agent}`); await sleep(800);
    const d = await B.ev(DUMP), w = want(c.expect), errs = [];
    if (!d) errs.push('no Pockets on the card');
    else {
      if (d.current !== c.agent) errs.push('card not open on ' + c.agent);
      if ((d.receipt === null ? null : +d.receipt) !== (c.expect?.id ?? null)) errs.push(`receipt ${d.receipt} ≠ ${c.expect?.id ?? null}`);
      if (c.expect && d.asOf !== c.expect.minute) errs.push(`as of ${d.asOf} ≠ ${c.expect.minute}`);
      if (d.asOf !== null && d.asOf > d.minute) errs.push('as of after the playhead');
      if (JSON.stringify(d.lines) !== JSON.stringify(w)) errs.push({ shown: d.lines, want: w });
      if (c.expect && !(d.badge && /TAPE/.test(d.badge) && /as of/.test(d.badge))) errs.push('no TAPE "as of" badge: ' + d.badge);
      if (c.expect && !(d.cashText ?? '').includes('$' + c.expect.cash)) errs.push('cash printed ' + d.cashText);
    }
    const o = { ...c, expect: c.expect?.id ?? null, ok: !errs.length, errs }; result.cases.push(o);
    steps.push({ name: `pockets ${c.agent} @${c.minute}`, ok: o.ok, detail: { receipt: o.expect, errs: errs.slice(0, 4) } });
  }
} catch (e) { result.error = String(e.stack || e); steps.push({ name: 'run', ok: false, detail: { error: String(e.message || e) } }); }
await B.close(); server?.kill();
result.ok = report('pocketscheck', steps, await writeResult(OUT, result));
process.exitCode = result.ok ? 0 : 1;
