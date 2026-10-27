import { describe, expect, it } from 'vitest';

import { otherPageAt } from './remote';

// Five commands worked the other side's address out each its own way; one rule, said once.
describe('the other side of --compare', () => {
  it('answers each of our paths at the same path of a site named by its root', () => {
    expect(otherPageAt('/pricing', 'https://example.com')).toBe('https://example.com/pricing');
    expect(otherPageAt('/pricing', 'https://example.com/')).toBe('https://example.com/pricing');
  });

  it('is the page named, whatever ours is, when the address has a path of its own', () => {
    expect(otherPageAt('/pricing', 'https://example.com/plans?b=1')).toBe('https://example.com/plans?b=1');
  });
});
