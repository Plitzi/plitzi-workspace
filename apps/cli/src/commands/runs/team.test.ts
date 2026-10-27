import { describe, expect, it } from 'vitest';

import { movesBounds } from './team';

// encore-14's lead raised the scouts from one to three on its own: the team's size is the person's to set (Carlos).
describe('a change to the team made by an agent', () => {
  it('moves its bounds when it adds an entry, raises its most, or changes how many start', () => {
    const scouts = { count: 1 };

    expect(movesBounds(scouts, { count: 3 })).toBe(true);
    expect(movesBounds(scouts, { min: 0 })).toBe(true);
    expect(movesBounds(undefined, { roles: ['scout'] })).toBe(true);
    // Fewer, or the model alone: within what the person allowed.
    expect(movesBounds({ count: 3, min: 1 }, { count: 2 })).toBe(false);
    expect(movesBounds(scouts, { model: 'claude-opus-5-5' })).toBe(false);
    expect(movesBounds({ count: 2, min: 1 }, { min: 1 })).toBe(false);
  });
});
