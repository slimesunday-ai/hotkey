// R8d: --set reaches a number inside a row whose own name holds dots, such as the briefing's character cap
// (`gap.briefing.chars`), and puts it back afterwards; a name N doesn't have still refuses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { N } from '../numbers.mjs';
import { withOverrides, parseSet } from '../bench/runner.mjs';

test('--set gap.briefing.chars=21000 sets the cap inside gap.briefing, then restores it', () => {
  const before = N['gap.briefing'].chars;
  const seen = withOverrides(parseSet(['gap.briefing.chars=21000']), () => N['gap.briefing'].chars);
  assert.equal(seen, 21000);
  assert.equal(N['gap.briefing'].chars, before);
  assert.equal(N['gap.briefing'].notes, 6, 'the row\'s other values are untouched');
});

test('a dotted name N lacks still refuses', () => {
  assert.throws(() => withOverrides(parseSet(['gap.briefing.nope=1']), () => 0), /no number called gap\.briefing\.nope/);
  assert.throws(() => withOverrides(parseSet(['nothing.here.chars=1']), () => 0), /no number called nothing\.here\.chars/);
});
