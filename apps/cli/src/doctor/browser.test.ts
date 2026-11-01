import { describe, expect, it, vi } from 'vitest';

import { checkBrowser } from './browser';

import type { DoctorContext } from './types';

const inUse = vi.fn<() => Promise<{ said: string } | { problem: string }>>();

vi.mock('../commands/browser/browser', () => ({ browserInUse: () => inUse() }));

describe('the doctor’s browser', () => {
  it('says which browser opens pages, and warns with the way to have one when none does', async () => {
    const context = {} as DoctorContext;

    inUse.mockResolvedValueOnce({ said: 'Chrome, installed on this machine' });
    expect(await checkBrowser(context)).toEqual([
      {
        area: 'browser',
        severity: 'info',
        code: 'browser-in-use',
        message: 'Pages open in Chrome, installed on this machine.'
      }
    ]);

    inUse.mockResolvedValueOnce({ problem: 'No browser to open pages with' });
    expect(await checkBrowser(context)).toEqual([
      {
        area: 'browser',
        severity: 'warning',
        code: 'browser-none',
        message: 'No browser to open pages with',
        fix: 'plitzi browser install'
      }
    ]);
  });
});
