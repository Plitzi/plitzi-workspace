import { describe, expect, it, vi } from 'vitest';

import { startBrowser } from '.';

const launch = vi.fn<(options: { channel?: string }) => Promise<{ close: () => Promise<void> }>>();

vi.mock('playwright-core', () => ({ chromium: { launch } }));

const browser = { close: () => Promise.resolve() };

// The CLI's own driver opens pages in the Chromium `plitzi browser install` downloaded, else the machine's Chrome.
describe('the browser a page is opened in', () => {
  it('is the downloaded Chromium first, else Chrome, and says which', async () => {
    launch.mockResolvedValueOnce(browser);
    expect(await startBrowser()).toMatchObject({ said: 'Chromium, downloaded by plitzi browser install' });

    launch
      .mockRejectedValueOnce(new Error("Executable doesn't exist at /cache/chromium\nmore"))
      .mockResolvedValueOnce(browser);
    expect(await startBrowser()).toMatchObject({ said: 'Chrome, installed on this machine' });
    expect(launch).toHaveBeenLastCalledWith(expect.objectContaining({ channel: 'chrome' }));
  });

  it('says why none started, and the two ways to have one', async () => {
    launch
      .mockRejectedValueOnce(new Error("Executable doesn't exist at /cache/chromium"))
      .mockRejectedValueOnce(new Error("Chromium distribution 'chrome' is not found"));

    expect(await startBrowser()).toEqual({
      problem:
        "No browser to open pages with (Chromium, downloaded by plitzi browser install: Executable doesn't exist at /cache/chromium; Chrome, installed on this machine: Chromium distribution 'chrome' is not found): plitzi browser install downloads Chromium once, or install Chrome"
    });
  });
});
