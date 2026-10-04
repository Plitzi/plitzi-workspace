import { afterEach, describe, expect, it, vi } from 'vitest';

import { markWrittenAt, writtenAt } from './writtenAt';

describe('writtenAt', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads a spec in a browser bundle whose `process` shim has no `cwd`', () => {
    // Vite's shim carries `env` and nothing else, and the desktop app authors its rail in the renderer: asking the
    // shim for a working directory took the whole window down.
    vi.stubGlobal('process', { env: {} });
    const spec = markWrittenAt({});

    expect(() => writtenAt(spec)).not.toThrow();
  });

  it('answers nothing for a spec no factory marked', () => {
    expect(writtenAt({})).toBeUndefined();
  });
});
