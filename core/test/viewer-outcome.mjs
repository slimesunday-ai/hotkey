// §41, 10-31: "Who and where show" adds only follower records. Keep the
// pre-existing outcome pins exact for every game receipt, state and play.
export function withoutFollowerActs(log) {
  return log.filter(e => e.type !== 'viewer-act').map(source => {
    const e = structuredClone(source);
    delete e.live;
    if (e.type === 'show') for (const at of Object.values(e.masked ?? {})) delete at.fight;
    return e;
  });
}
