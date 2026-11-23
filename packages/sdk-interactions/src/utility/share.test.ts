import { afterEach, describe, expect, it, vi } from 'vitest';

import share from './share';

// Declared optional on every interaction callback; share always has one.
const shared = (params: { url?: string; title?: string; text?: string }): Promise<unknown> => {
  if (!share.callback) {
    throw new Error('share has no callback');
  }

  return Promise.resolve(share.callback(params));
};

describe('share', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shares through the device’s sheet, this page’s address when it names none', async () => {
    const sheet = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { share: sheet });

    await expect(shared({ title: 'Our launch' })).resolves.toEqual({ shared: true, copied: false });
    expect(sheet).toHaveBeenCalledWith({ url: window.location.href, title: 'Our launch' });
  });

  it('is no failure when the visitor closes the sheet', async () => {
    vi.stubGlobal('navigator', { share: () => Promise.reject(new DOMException('closed', 'AbortError')) });

    await expect(shared({ url: 'https://site.test/a' })).resolves.toEqual({ shared: false, copied: false });
  });

  it('copies the address where the browser has no sheet, and says so', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(shared({ url: 'https://site.test/a' })).resolves.toEqual({ shared: false, copied: true });
    expect(writeText).toHaveBeenCalledWith('https://site.test/a');
  });

  it('fails where it can neither share nor copy', async () => {
    vi.stubGlobal('navigator', {});

    await expect(shared({ url: 'https://site.test/a' })).rejects.toThrow('neither share nor copy');
  });
});
