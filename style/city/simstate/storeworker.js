// HUMAN LAYER · the store's feed (storefeed.js) in a module worker: polling, the lens and the derivations stay off the main thread.
// The page (store.js) sends { type: 'start', opt } once; { type: 'poll' } / { type: 'director' } ask for one now; it gets back the feed's
// { type: 'state' } and { type: 'status' } messages.
import { createStoreFeed } from './storefeed.js';
let feed = null;
onmessage = e => { const m = e.data || {};
  if (m.type === 'start' && !feed) { feed = createStoreFeed({ ...m.opt, onMsg: msg => postMessage(msg) }); feed.start(); }
  else if (m.type === 'poll') feed?.pollNow(); else if (m.type === 'director') feed?.directorNow(); else if (m.type === 'stop') feed?.stop();
};
