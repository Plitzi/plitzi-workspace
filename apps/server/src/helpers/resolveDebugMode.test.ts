import { describe, it, expect } from 'vitest';

import { resolveDebugMode } from './resolveDebugMode';

describe('who may see a debug render', () => {
  it('never on a page that did not authorize it, whatever the visitor sends', () => {
    expect(resolveDebugMode(false, 'true')).toBe(false);
    expect(resolveDebugMode(undefined, 'true')).toBe(false);
    expect(resolveDebugMode(false, undefined)).toBe(false);
  });

  it('yes on a page that authorized it', () => {
    expect(resolveDebugMode(true, undefined)).toBe(true);
    expect(resolveDebugMode(true, 'true')).toBe(true);
  });

  it('lets the visitor turn it off for themselves', () => {
    expect(resolveDebugMode(true, 'false')).toBe(false);
  });
});
