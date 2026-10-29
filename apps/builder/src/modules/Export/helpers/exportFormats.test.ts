import { describe, expect, it } from 'vitest';

import { exportLocked } from './exportFormats';

// RFC 0029 §8: a free workspace can always take its work — its documents as JSON; the code is a paid plan's.
describe('what an export is held back by', () => {
  it('holds the code back on the free plan or when the server refuses it, never the JSON', () => {
    expect(exportLocked('json', true, false)).toBe(false);
    expect(exportLocked('json', false, true)).toBe(false);
    expect(exportLocked('authoring', true, false)).toBe(true);
    expect(exportLocked('authoring-split', false, true)).toBe(true);
    expect(exportLocked('authoring', false, false)).toBe(false);
  });
});
