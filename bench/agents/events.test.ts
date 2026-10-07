import { describe, expect, it } from 'vitest';

import { fromClaudeCode, fromOpenCode } from './events';
import { measureRun } from './metrics';

const line = (value: unknown): string => JSON.stringify(value);

// Shaped as Claude Code's `-p --output-format stream-json --verbose` writes a run: one message in two events, a tool
// call refused for a name that does not exist, the turn that corrected it, and the result.
const claudeRun = [
  line({ type: 'system', subtype: 'init' }),
  line({
    type: 'assistant',
    message: { id: 'm1', usage: { input_tokens: 10, cache_read_input_tokens: 30000, output_tokens: 50 }, content: [] }
  }),
  line({
    type: 'assistant',
    message: {
      id: 'm1',
      usage: { input_tokens: 10, cache_read_input_tokens: 30000, output_tokens: 50 },
      content: [{ type: 'tool_use', id: 't1', name: 'mcp__plitzi__plitzi_apply' }]
    }
  }),
  line({
    type: 'user',
    message: {
      content: [
        {
          type: 'tool_result',
          tool_use_id: 't1',
          is_error: true,
          content: 'There is no "upsertElemnt" operation — did you mean "upsertElement"?'
        }
      ]
    }
  }),
  line({
    type: 'assistant',
    message: { id: 'm2', usage: { input_tokens: 5, cache_read_input_tokens: 30500, output_tokens: 80 }, content: [] }
  }),
  line({ type: 'result', result: 'Done.' })
];

// Shaped as `opencode run --format json` writes one: a step with a tool, its tokens, then a step that answers.
const openCodeRun = [
  line({ type: 'step_start', part: { type: 'step-start' } }),
  line({
    type: 'tool_use',
    part: {
      type: 'tool',
      tool: 'bash',
      state: { status: 'completed', output: 'x has no field "prop" (did you mean "props"?)' }
    }
  }),
  line({
    type: 'step_finish',
    part: { type: 'step-finish', tokens: { input: 9000, output: 40, reasoning: 10, cache: { read: 0, write: 0 } } }
  }),
  line({ type: 'text', part: { type: 'text', text: 'ok' } }),
  line({
    type: 'step_finish',
    part: { type: 'step-finish', tokens: { input: 9100, output: 5, reasoning: 0, cache: { read: 0, write: 0 } } }
  })
];

describe('a run, read whichever harness made it', () => {
  it('reads Claude Code: one turn per message, the refused call, the turn that corrected it', () => {
    const record = fromClaudeCode(claudeRun);

    expect(record.turns).toEqual([
      { input: 30010, output: 50, afterRefusal: false },
      { input: 30505, output: 80, afterRefusal: true }
    ]);
    expect(record.tools).toMatchObject([{ tool: 'mcp__plitzi__plitzi_apply', refused: true, hallucinated: true }]);
    expect(record.final).toBe('Done.');
  });

  it('reads OpenCode: a turn per step, a refusal by its words even when the tool says it completed', () => {
    const record = fromOpenCode(openCodeRun);

    expect(record.turns).toEqual([
      { input: 9000, output: 50, afterRefusal: false },
      { input: 9100, output: 5, afterRefusal: true }
    ]);
    expect(record.tools).toMatchObject([{ tool: 'bash', refused: true, hallucinated: true }]);
    expect(record.final).toBe('ok');
  });
});

describe('a run, measured', () => {
  it('counts what the harness loads before the task as its own, and the turns after a refusal as waste', () => {
    const metrics = measureRun({
      record: fromClaudeCode(claudeRun),
      check: { ok: true },
      overhead: 30000,
      ceiling: Number.POSITIVE_INFINITY
    });

    expect(metrics).toMatchObject({ success: true, netTokens: 645, turns: 2, refusals: 1, hallucinations: 1 });
    expect(metrics.wasteShare).toBeCloseTo(585 / 645);
  });

  it('fails a run past its ceiling, however it ended', () => {
    const metrics = measureRun({ record: fromOpenCode(openCodeRun), check: { ok: true }, overhead: 0, ceiling: 100 });

    expect(metrics).toMatchObject({
      success: false,
      ceilingHit: true,
      failedBecause: 'over the ceiling of 100 tokens'
    });
  });
});
