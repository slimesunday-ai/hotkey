// Copies the game's items out of ai-city-fresh into core/data/items.json, so the core never reads another repo.
// GAME.md §4: the curated agent traits (kills out, keep and undecided in) plus the held items. Skins are chosen and the
// `mark` slot's marks are earned, so they're kept here for the record but never go in a drop.
// Usage: node core/tools/snapshot-items.mjs [path to ai-city-fresh]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const fresh = path.resolve(process.argv[2] || process.env.HOTKEY_CAST_SOURCE || path.join(os.homedir(), 'Desktop', 'ai-city', 'repos', 'ai-city-fresh'));
const F = await import(pathToFileURL(path.join(fresh, 'world/fresh/index.js')).href);
const curation = JSON.parse(fs.readFileSync(path.join(fresh, 'world/fresh-curation.json'), 'utf8')).traits;

const items = [];
for (const slot of F.SLOTS) {
  for (const t of F.list(slot) || []) {
    const status = (curation[`${slot}/${t.id}`] || {}).status || 'undecided';
    if (status === 'kill') continue;
    const kind = slot === 'skin' ? 'chosen' : slot === 'mark' ? 'earned' : 'item';
    items.push({ id: `${slot}/${t.id}`, slot, name: t.name || t.id, kind, curation: status });
  }
}
items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const count = k => items.filter(i => i.kind === k).length;
const out = {
  about: 'Snapshot of the game items (GAME.md §4) from ai-city-fresh: world/fresh/ minus kills in world/fresh-curation.json.',
  source: 'ai-city-fresh world/fresh/index.js list(slot) + world/fresh-curation.json',
  counts: {
    wearable: items.filter(i => i.slot !== 'skin' && i.slot !== 'held').length,
    held: items.filter(i => i.slot === 'held').length,
    skins: count('chosen'),
    marks: count('earned'),
    inDrops: count('item'),
  },
  items,
};
const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'items.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
console.log(dest, JSON.stringify(out.counts));
