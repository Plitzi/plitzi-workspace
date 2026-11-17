import { describe, expect, it } from 'vitest';

import { pruneSentence } from './helpers';

// The Save version dialog says what saving the next version removes, before it is saved.
describe('pruneSentence', () => {
  it('names each version the next one removes and how many the plan keeps', () => {
    const sentence = pruneSentence({
      keep: 10,
      removes: [{ environment: 'production', revision: 2, publishedAt: '2026-10-02T12:00:00Z' }]
    });

    expect(sentence).toMatch(/^This space's plan keeps 10 unpublished versions: saving this one removes version 2 \(/);
    expect(sentence).toContain('A version a domain shows is always kept.');
  });

  it('says nothing when the next version removes none', () => {
    expect(pruneSentence({ keep: 10, removes: [] })).toBe('');
  });
});
