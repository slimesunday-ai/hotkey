// Reproduce the $0 before/after parity audit; no rules or feed files are changed.
import fs from 'node:fs';
// slime, 10-31, on the slimmer feed (readers carry unchanged sightings forward): "Slim"; the parser restores dense frames for this comparison.
import { parseFeed } from '../simstate/record/adapter.js';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual as equal } from 'node:util';
const option = name => process.argv[process.argv.indexOf(name) + 1];
if (!process.argv.includes('--before') || !process.argv.includes('--after')) {
  throw new Error('usage: node continuityparity.mjs --before <run root> --after <run root>');
}
const before = path.resolve(option('--before')), after = path.resolve(option('--after'));
const lines = file => fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
function strip(value) {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !(value.type === 'show' && key === 'masked')).map(([key, v]) => [key, strip(v)]));
  return value;
}
function changes(a, b, at = '') {
  if (equal(a, b)) return [];
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return [at];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => changes(a[k], b[k], `${at}/${k}`));
}
let bad = false;
for (const seed of [404, 405, 406]) {
  const file = (side, name) => path.join(side, `${seed}-A`, name);
  const a = parseFeed(fs.readFileSync(file(before, 'feed.jsonl'), 'utf8')), b = parseFeed(fs.readFileSync(file(after, 'feed.jsonl'), 'utf8'));
  const eventsBefore = lines(file(before, 'events.jsonl')), eventsAfter = lines(file(after, 'events.jsonl'));
  const plays = rows => rows.filter(e => e.type === 'play');
  const resultA = JSON.parse(fs.readFileSync(file(before, 'result.json'), 'utf8'));
  const resultB = JSON.parse(fs.readFileSync(file(after, 'result.json'), 'utf8'));
  const metadata = changes(resultA, resultB);
  const permittedMetadata = ['/seasonKey', '/provenance/source/core', '/provenance/source/rules'];
  const stateA = JSON.parse(fs.readFileSync(file(before, 'checkpoint.json'), 'utf8')).state;
  const stateB = JSON.parse(fs.readFileSync(file(after, 'checkpoint.json'), 'utf8')).state;
  const stateDiff = changes(stateA, stateB);
  const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const resultDiff = metadata.filter(k => !permittedMetadata.includes(k));
  const feedDiff = changes(a, strip(b)), eventDiff = changes(eventsBefore, strip(eventsAfter));
  const playDiff = changes(plays(eventsBefore), plays(eventsAfter));
  bad ||= feedDiff.length + eventDiff.length + playDiff.length + resultDiff.length + stateDiff.length > 0;
  const shows = b.flatMap(f => f.events).filter(e => e.type === 'show');
  console.log(`seed ${seed}: ${a.length} frames, ${eventsBefore.length} events, ${plays(eventsBefore).length} plays; ${shows.length} show forms add masked (${shows.reduce((n,e)=>n+Object.keys(e.masked??{}).length,0)} anchors); other feed/event/play/result/state differences ${feedDiff.length}/${eventDiff.length}/${playDiff.length}/${resultDiff.length}/${stateDiff.length}`);
  console.log(`  old outcome digest ${digest([stateA, eventsBefore])}; stripping masked reproduces it: ${digest([stateA, eventsBefore]) === digest([stateB, strip(eventsAfter)])}`);
  console.log(`  changed result metadata: ${metadata.join(', ')}`);
  if (feedDiff.length + eventDiff.length + playDiff.length + resultDiff.length + stateDiff.length) console.log(JSON.stringify({ feedDiff, eventDiff, playDiff, resultDiff, stateDiff }));
}
console.log(`CONTINUITY PARITY ${bad ? 'FAIL' : 'PASS'}`);
process.exitCode = bad ? 1 : 0;
