import { describe, expect, it } from 'vitest';

import { isCallToolResult } from './callToolResult';

describe('isCallToolResult', () => {
  it('recognizes a result carrying a content array', () => {
    expect(isCallToolResult({ content: [{ type: 'text', text: 'x' }] })).toBe(true);
  });

  it('rejects plain JSON values a tool returns', () => {
    expect(isCallToolResult({ id: '1', name: 'Test' })).toBe(false);
    expect(isCallToolResult(null)).toBe(false);
    expect(isCallToolResult('string')).toBe(false);
  });
});
