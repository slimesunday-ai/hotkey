// A departure is a fact of the record, not of the frames that happened to play.
// docs/redesign/stage-20261104.md. Distances are metres; all times are island minutes.
export const BACK_V = 1.3, TARGET_GO = 3, SET_GO = 5.5;
export function departureOf(P, g) {
  if (P.kind === 'hooded' && P.beat === 'ambient') return P.start + (P.end - P.start) * .6;
  if (g.role === 'target') return P.end + TARGET_GO / 60;
  if (g.role === 'grabber') return P.end + SET_GO / 60;
  if (P.kind === 'grab' && P.sc.beats?.length) {
    if (g.role === 'lead') return P.sc.beats.find(b => b.name === 'carry')?.start ?? P.end + 3 / 60;
    return P.end + (g.role === 'rival' || g.role === 'cop' ? SET_GO : 3) / 60;
  }
  if (g.id || g.role === 'partner') return P.end;
  return P.end + (g.side === 0 && !['grab', 'collar'].includes(P.kind) ? 0 : 4) / 60;
}
export function backRow({ key, id = null, from, to, start, speed = BACK_V, clip = null, walkPath }) {
  const a = [from.x, from.z], b = [to.x, to.z], planned = walkPath?.(a, b);
  const path = [a];
  for (const p of [...(planned ?? []), b]) if (Math.hypot(p[0] - path.at(-1)[0], p[1] - path.at(-1)[1]) > 1e-8) path.push([p[0], p[1]]);
  const lengths = [0]; for (let k = 1; k < path.length; k++) lengths.push(lengths[k - 1] + Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]));
  const length = lengths.at(-1);
  const point = p => ({ x: p.x, z: p.z, ...(Number.isFinite(p.y) ? { y: p.y } : {}), ...(Number.isFinite(p.ry) ? { ry: p.ry } : {}) });
  return { key, id, from: point(from), to: point(to), start, speed, clip, path, lengths, length, end: start + length / speed / 60 };
}
export function backAt(row, minute) {
  const distance = Math.max(0, Math.min(row.length, (minute - row.start) * 60 * row.speed));
  let k = 1; while (k < row.path.length - 1 && row.lengths[k] < distance) k++;
  const a = row.path[k - 1] ?? row.path[0], b = row.path[k] ?? a, L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = L ? Math.max(0, Math.min(1, (distance - row.lengths[k - 1]) / L)) : 1;
  return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, ry: L ? Math.atan2(b[0] - a[0], b[1] - a[1]) : row.to.ry ?? row.from.ry ?? 0, distance, arrived: minute >= row.end };
}
export function createBackPlan({ cplan, walkPath, spotAt, homeOf = () => null }) {
  const cache = new WeakMap();
  function scene(sc, minute = Infinity) {
    const published = cplan.published(sc.night); if (published === null || minute < published) return [];
    const N = cplan.night(sc.night); if (!N) return [];
    const P = N.scenes.get(sc.id); if (!P) return [];
    const saved = cache.get(P) ?? new Map(); cache.set(P, saved);
    return P.figures.filter(g => g.mark && departureOf(P, g) <= minute).map(g => {
      if (saved.has(g)) return saved.get(g);
      const start = departureOf(P, g), from = g.mark;
      const spot = g.id ? spotAt?.(g.id, P.key, start) : null, home = g.id ? homeOf(g.id, start, P) : null;
      // Stand-ins walk out along the world's fixed graph, away from the scene. No camera, crowd or streamed lanes enter the plan.
      const dx = from.x - (P.anchor ?? P.spot ?? from).x, dz = from.z - (P.anchor ?? P.spot ?? from).z, d = Math.hypot(dx, dz), ux = d > .1 ? dx / d : Math.sin(from.ry ?? 0), uz = d > .1 ? dz / d : Math.cos(from.ry ?? 0);
      const to = g.id ? spot && !spot.plan ? spot : home ?? from : { x: from.x + ux * 80, z: from.z + uz * 80 };
      const speed = g.id ? BACK_V : g.role === 'lead' ? 2.2 : 1.8;
      const clip = g.id ? null : g.role === 'lead' ? 'crate_run' : P.kind === 'hooded' || ['hit', 'breakin'].includes(P.kind) ? 'run_getaway' : null;
      const row = backRow({ key: g.id ?? g.key, id: g.id, from, to, start, speed, clip, walkPath });
      saved.set(g, row); return row;
    });
  }
  // A following trip waits for the same return on play and seek. Before the target's release, only its already-published
  // hold timer is needed; the destination is queried causally once the return starts. No future stand state is read.
  function forTrip(id, dep, minute) {
    const n = Math.floor(minute / 1440), published = cplan.published(n); if (published === null || minute < published) return null;
    const N = cplan.night(n); if (!N) return null; let out = null;
    for (const P of N.scenes.values()) {
      if (P.end > dep + 1e-7 || P.end > minute) continue;
      const g = P.figures.find(g => g.id === id); if (!g?.mark) continue;
      const start = departureOf(P, g);
      const row = minute < start ? { end: start, to: g.mark } : scene(P.sc, minute).find(r => r.id === id);
      if (row && row.end > dep && (!out || row.end > out.end)) out = { end: row.end, to: row.to };
    }
    return out;
  }
  return { scene, forTrip };
}
