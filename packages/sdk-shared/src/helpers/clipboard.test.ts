import { afterEach, describe, expect, it, vi } from 'vitest';

import { clipboardWriter, copyText } from './clipboard';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the clipboard', () => {
  it('is not there on a page with none — an insecure origin', async () => {
    vi.stubGlobal('navigator', {});

    expect(clipboardWriter()).toBeUndefined();
    expect(await copyText('a')).toBe(false);
  });

  it('copies where the browser offers it, and says when it refused', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValueOnce(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    expect(await copyText('a')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('a');

    writeText.mockRejectedValueOnce(new Error('NotAllowedError'));
    expect(await copyText('b')).toBe(false);
  });
});
