// HUMAN LAYER · SECTION 2a · THE CITY ON TAPE: while TAPE is open, the sim layer (homes, lights, piles, corners) and the sim's walkers
// are driven by the tape at the scrub time instead of the live poll.
// How, without touching the live path (simstate/live.js): the live layer's applyDiff and the walkers' setAgents / setClock are wrapped
// once (mount). In LIVE they pass straight through (and the last live agent list and clock are remembered). In TAPE the live diffs are
// kept aside (merged into `shadow`: the live model as it stands), and the tape's frames are drawn instead. Back to LIVE redraws exactly
// what differs between the tape's picture and the live model, re-places the walkers where the live sim has them and gives the clock back:
// the city is the live city again, as if TAPE had never been open.
//   snap      a seek places every walker outright (agents.js setAgents { snap: 'all' }); 16× and 60× place the ones that moved
//             ({ snap: 'changed' }: nobody can walk that fast); 1× and 4× walk
export function createTapeMap({ api, live }) {
  const layer = live.layer, agents = live.agents, peds = () => api.peds;
  const orig = { applyDiff: layer.applyDiff, setAgents: agents?.setAgents, setClock: agents?.setClock };
  let on = false, lastLive = null, lastClock = null, liveRate = null;
  // (STATION COPS, simstate/stationcops.js: wrapped the same way — in TAPE the tape's rota at the scrub time, the live one kept aside)
  const cops = live.cops, copsSet = cops?.set; let lastCops;
  if (cops) cops.set = sc => { lastCops = sc; if (!on) return copsSet(sc); };
  const shadow = { homes: new Map(), piles: new Map(), corners: new Map(), extra: {} };
  const S = { frames: 0, applyMs: 0, applyMax: 0, liveHeld: 0 };
  const take = d => { for (const h of d.homes || []) shadow.homes.set(h.id, h); for (const p of d.piles || []) shadow.piles.set(p.id, p); for (const c of d.corners || []) shadow.corners.set(c.id, c);
    for (const k of ['patrols', 'crowd', 'rush', 'clock']) if (d[k] !== undefined) shadow.extra[k] = d[k]; };
  layer.applyDiff = d => { if (!on) return orig.applyDiff(d); take(d); S.liveHeld++; };
  if (agents) {
    agents.setAgents = (list, opt) => { lastLive = list; if (!on) return orig.setAgents(list, opt); };
    agents.setClock = (t, pageT, running) => { lastClock = { t, running }; if (!on) { const r = orig.setClock(t, pageT, running); liveRate = agents.clock.rate; return r; } };
  }
  // the live model as the layer holds it now (homes with Sets) → plain entries, the shape applyDiff takes
  const plainHome = st => ({ id: st.id, tier: st.tier, owner: st.owner, vacant: st.vacant, forRent: !!st.forRent, lit: st.lit, asleep: st.asleep, away: st.away, sec: [...(st.sec || [])], scars: [...(st.scars || [])] });
  const sigHome = h => `${h.tier}|${h.owner ? 1 : 0}|${h.forRent ? 1 : 0}|${[...h.sec].sort().join(',')}|${[...h.scars].sort().join(',')}|${h.lit ? 1 : 0}${h.asleep ? 1 : 0}${h.away ? 1 : 0}`;
  const sigPile = p => `${Math.round(p.level)}|${p.spill ? 1 : 0}|${p.level}`, sigCorner = c => `${c.rush ? 1 : 0}|${(+c.heat).toFixed(3)}`;
  function liveModel() { const m = layer.model; if (!m) return { homes: [], piles: [], corners: [] };
    return { homes: [...m.homes.values()].map(plainHome), piles: [...m.piles.values()].map(p => ({ ...p })), corners: [...m.corners.values()].map(c => ({ ...c })) }; }
  return {
    get on() { return on; }, stats: () => ({ ...S, on }),
    // into TAPE: from now on the live diffs are held. → the live model as drawn (to seed the tape's diffing)
    enter() { if (on) return null; const m = liveModel(); shadow.homes.clear(); shadow.piles.clear(); shadow.corners.clear(); shadow.extra = { patrols: layer.model?.patrols, crowd: layer.model?.crowd, rush: layer.model?.rush ?? null, clock: layer.model?.clock };
      for (const h of m.homes) shadow.homes.set(h.id, h); for (const p of m.piles) shadow.piles.set(p.id, p); for (const c of m.corners) shadow.corners.set(c.id, c);
      if (agents) liveRate = agents.clock.rate; on = true; return m; },
    // one tape frame: draw it (snap: 'all' on a seek, 'changed' at 16× and over)
    apply(diff, snap = false) { if (!on || !diff) return; const t0 = performance.now();
      orig.applyDiff({ homes: diff.homes, piles: diff.piles, corners: diff.corners, patrols: diff.patrols, crowd: diff.crowd, rush: diff.rush, clock: diff.clock });
      if (diff.crowd) peds()?.setDemand?.(diff.crowd, null);
      if (agents) orig.setAgents(diff.agents || [], snap ? { snap } : undefined);
      if (cops && diff.stationCops !== undefined) copsSet(diff.stationCops);
      const ms = performance.now() - t0; S.frames++; S.applyMs += (ms - S.applyMs) * .1; S.applyMax = Math.max(S.applyMax, ms); },
    // the walkers' clock at the tape time (every frame): t, game minutes per page second, playing
    clock(t, rate, running) { if (!on || !agents || t === null) return; const c = agents.clock; c.t = t; c.at = c.pageT; c.rate = rate; c.running = running; },
    // back to LIVE: redraw what differs from the live model, the walkers where the live sim has them, the live clock
    exit() { if (!on) return; on = false; const t0 = performance.now(), m = layer.model;
      const homes = [], piles = [], corners = [];
      if (m) { for (const [id, h] of shadow.homes) { const cur = m.homes.get(id); if (!cur || sigHome(cur) !== sigHome({ ...h, sec: new Set(h.sec), scars: new Set(h.scars) })) homes.push(h); }
        for (const [id, p] of shadow.piles) { const cur = m.piles.get(id); if (!cur || sigPile(cur) !== sigPile(p)) piles.push(p); }
        for (const [id, c] of shadow.corners) { const cur = m.corners.get(id); if (!cur || sigCorner(cur) !== sigCorner(c)) corners.push(c); } }
      orig.applyDiff({ homes, piles, corners, ...shadow.extra });
      if (shadow.extra.crowd) peds()?.setDemand?.(shadow.extra.crowd, null);
      if (agents) { const c = agents.clock; if (lastClock && typeof lastClock.t === 'number') { c.t = lastClock.t; c.at = c.pageT; c.running = !!lastClock.running; c.rate = lastClock.running === false ? 0 : (liveRate ?? c.rate); }
        if (lastLive) orig.setAgents(lastLive, { snap: 'all' }); }
      if (cops && lastCops !== undefined) copsSet(lastCops);
      S.exitMs = +(performance.now() - t0).toFixed(2); S.exitRedraw = { homes: homes.length, piles: piles.length, corners: corners.length }; },
  };
}
