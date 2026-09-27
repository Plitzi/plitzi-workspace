import { describe, expect, it } from 'vitest';

import { storedMode } from './whileRunning';

describe('storedMode', () => {
  it('stores a mode, and nothing for skip or anything it does not know', () => {
    expect(storedMode('queue')).toBe('queue');
    expect(storedMode('parallel')).toBe('parallel');
    expect(storedMode('skip')).toBeUndefined();
    expect(storedMode('later')).toBeUndefined();
    expect(storedMode(undefined)).toBeUndefined();
  });
});
