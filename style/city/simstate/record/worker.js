import { parseFeed } from './adapter.js';

// One public file; no directory discovery, private-log fallback, polling or owner endpoints.
export async function readFeed(url, fetcher = fetch) {
  const path = decodeURIComponent(new URL(url).pathname);
  if (/(?:^|\/)(?:events\.jsonl|checkpoint\.json|result\.json|report\.md)$/.test(path)) throw new Error('not a public feed URL');
  const response = await fetcher(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`feed: HTTP ${response.status}`);
  return parseFeed(await response.text());
}

if (typeof self !== 'undefined' && typeof self.postMessage === 'function') self.onmessage = async ({ data }) => {
  if (data.type !== 'load') return;
  try { self.postMessage({ type: 'feed', frames: await readFeed(data.url) }); }
  catch (error) { self.postMessage({ type: 'error', error: String(error.message || error) }); }
};
