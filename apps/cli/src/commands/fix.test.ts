import { describe, expect, it } from 'vitest';

import { nothingToWrite } from './fix';

describe('space fix with nothing to write', () => {
  it('says nothing is left only when nothing is', () => {
    expect(nothingToWrite({ problems: [], suggestions: [], fixes: [] })).toContain('Nothing to fix.');
  });

  /** encore-3: a suggestion with no one fix read "Nothing to fix", and the agent guessed a smaller shape to get by. */
  it('lists what is left for the author, and how a suggestion written so on purpose is quieted', () => {
    const said = nothingToWrite({
      problems: [],
      fixes: [],
      suggestions: [
        {
          code: 'repeated-shape',
          message: '3 containers of 4 elements share one structure.',
          elementIds: ['a', 'b', 'c'],
          saves: 8,
          at: 'src/space/pages/home.ts:12'
        }
      ]
    });

    expect(said).not.toContain('Nothing to fix');
    expect(said).toContain('1 left for you');
    expect(said).toContain(
      'src/space/pages/home.ts:12 [repeated-shape] 3 containers of 4 elements share one structure.'
    );
    expect(said).toContain("`quiet: ['repeated-shape']`");
  });
});
