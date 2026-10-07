import { afterEach, describe, expect, it, vi } from 'vitest';

import copyToClipboard from './copyToClipboard';

// "Copied" is never said of what was not: a browser with no clipboard fails the step, and its flow's onFailure runs.
// Declared optional on every interaction callback; copyToClipboard always has one.
const copy = (params: { text: string }): Promise<unknown> => {
  if (!copyToClipboard.callback) {
    throw new Error('copyToClipboard has no callback');
  }

  return Promise.resolve(copyToClipboard.callback(params));
};

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the text to the clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await copy({ text: 'https://inkwell.test/p/one' });

    expect(writeText).toHaveBeenCalledWith('https://inkwell.test/p/one');
  });

  it('fails where there is no clipboard to write to', async () => {
    vi.stubGlobal('navigator', {});

    await expect(copy({ text: 'x' })).rejects.toThrow('no clipboard');
  });
});
