import { describe, expect, it } from 'vitest';

import { leftInTmpText } from './strays';

describe('what appeared in the project’s tmp/', () => {
  // A designer read the message as blaming it for a file another left: it went to every agent, and did not say so.
  it('is said as told to every agent, and leaves the one it is not theirs nothing to do', () => {
    const text = leftInTmpText(['tmp/probe-warm.mjs']);

    expect(text.startsWith('Told to every agent, as nobody can tell whose it is: tmp/probe-warm.mjs appeared')).toBe(
      true
    );
    expect(text.endsWith('If it is yours, move it there; if not, nothing to do')).toBe(true);
  });
});
