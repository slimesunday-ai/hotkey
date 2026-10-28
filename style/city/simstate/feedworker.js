// SIM LIVE pass · the feed (feed.js) in a module worker: polling, JSON parsing and adapting stay off the main thread. The page
// (live.js) sends { type: 'start', opt } once, may ask { type: 'poll', id } for an immediate poll (shots, tests), and gets back
// { type: 'diff', d } per snapshot and { type: 'status', s } per poll outcome.
import { createFeed } from './feed.js';
let feed = null;
onmessage = e => { const m = e.data || {};
  if (m.type === 'start' && !feed) { feed = createFeed({ ...m.opt, onDiff: d => postMessage({ type: 'diff', d }), onStatus: s => postMessage({ type: 'status', s }) }); feed.start(); }
  else if (m.type === 'poll') (feed ? feed.pollNow() : Promise.resolve()).then(() => postMessage({ type: 'polled', id: m.id }));
  else if (m.type === 'stop') feed?.stop();
};
