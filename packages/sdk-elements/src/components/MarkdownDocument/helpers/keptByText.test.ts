import { describe, expect, it } from 'vitest';

import { keptByText } from './keptByText';

describe('keptByText', () => {
  it('hands back what it keeps, by its text', () => {
    const kept = keptByText<number>(100);
    kept.set('abc', 1);

    expect(kept.get('abc')).toBe(1);
    expect(kept.get('abd')).toBeUndefined();
  });

  it('drops the least recently asked once the texts it keeps weigh more than it may hold', () => {
    const kept = keptByText<number>(6);
    kept.set('aa', 1);
    kept.set('bb', 2);
    kept.set('cc', 3);
    // Asked for, `aa` is the most recent: `bb` is the one that goes for `dd`.
    kept.get('aa');
    kept.set('dd', 4);

    expect([kept.get('aa'), kept.get('bb'), kept.get('cc'), kept.get('dd')]).toEqual([1, undefined, 3, 4]);
  });

  it('keeps nothing heavier than all it may hold, and counts a text set again once', () => {
    const kept = keptByText<number>(4);
    kept.set('abcde', 1);
    kept.set('ab', 2);
    kept.set('ab', 3);
    kept.set('cd', 4);

    expect([kept.get('abcde'), kept.get('ab'), kept.get('cd')]).toEqual([undefined, 3, 4]);
  });
});
