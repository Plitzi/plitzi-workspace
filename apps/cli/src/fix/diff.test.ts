import { describe, expect, it } from 'vitest';

import { unifiedDiff } from './diff';

describe('unifiedDiff', () => {
  it('shows what changed, the old line first, with the lines around it', () => {
    const before = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].join('\n');
    const after = ['a', 'b', 'c', 'D', 'e', 'f', 'g'].join('\n');

    expect(unifiedDiff('space.ts', before, after)).toBe(
      ['--- space.ts', '+++ space.ts', '@@ line 2 @@', ' b', ' c', '-d', '+D', ' e', ' f'].join('\n')
    );
  });

  it('says nothing of a file that did not change', () => {
    expect(unifiedDiff('space.ts', 'a\nb', 'a\nb')).toBe('');
  });
});
