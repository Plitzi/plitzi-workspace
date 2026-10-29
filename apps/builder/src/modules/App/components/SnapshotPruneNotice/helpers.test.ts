import { describe, expect, it } from 'vitest';

import { pruneSentence } from './helpers';

// RFC 0029 §6.1: the snapshot dialog says what the next snapshot removes, before it is taken.
describe('pruneSentence', () => {
  it('names each snapshot the next one removes and how many the plan keeps', () => {
    const sentence = pruneSentence({
      keep: 10,
      removes: [{ environment: 'production', revision: 2, publishedAt: '2026-10-02T12:00:00Z' }]
    });

    expect(sentence).toMatch(
      /^This space's plan keeps 10 unpublished snapshots: taking this one removes production:2 \(/
    );
    expect(sentence).toContain('A snapshot a domain serves is always kept.');
  });

  it('says nothing when the next snapshot removes none', () => {
    expect(pruneSentence({ keep: 10, removes: [] })).toBe('');
  });
});
