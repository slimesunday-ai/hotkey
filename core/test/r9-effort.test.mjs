// R9, change 5 (brief R9-agents-work-their-trade): a Claude thinking seat asks for effort high; a plain seat is as it
// was (Sonnet 5.5 between_tools, Haiku 5.5 disabled, Opus 5.5 and an unnamed model adaptive at low). Whether the API
// takes `high` is settled by the next paid call, which is slime's go. Nothing here calls a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claudeFields, CLAUDE_THINKING } from '../agents/anthropic.mjs';

test('a thinking seat asks for adaptive thinking at effort high, for every Claude model; plain seats are unchanged', () => {
  for (const model of ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-unnamed']) {
    assert.deepEqual(claudeFields({ thinking: true, model }), { thinking: { type: 'adaptive' }, output_config: { effort: 'high' }, max_tokens: 6000 }, model);
  }
  assert.deepEqual(claudeFields({ thinking: false, model: 'claude-sonnet-5-5' }), { thinking: { type: 'between_tools' }, max_tokens: 2000 });
  assert.deepEqual(claudeFields({ thinking: false, model: 'claude-haiku-5-5' }), { thinking: { type: 'disabled' }, max_tokens: 2000 });
  assert.deepEqual(claudeFields({ thinking: false, model: 'claude-opus-5-5' }), { thinking: { type: 'adaptive' }, output_config: { effort: 'low' }, max_tokens: 2000 });
  assert.equal(CLAUDE_THINKING.on.output_config.effort, 'high');
});
