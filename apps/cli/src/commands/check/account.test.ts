import { afterEach, describe, expect, it, vi } from 'vitest';

import { signInWhereSent } from './account';

import type { BrowserPage } from '../../browser';

const opened = vi.hoisted(() => [] as string[]);

vi.mock('@plitzi/sdk-authoring', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-authoring')>()),
  openPage: (_page: unknown, url: string) => {
    opened.push(url);

    return Promise.resolve({});
  }
}));

/** A page that landed at `landed`, signing in answering `status` — only what a sign-in where sent meets of a page. */
const pageAt = (landed: string, status = 200) => {
  const posted: unknown[] = [];
  const page = {
    url: () => `http://127.0.0.1:8080${landed}`,
    request: {
      post: (url: string, options: unknown) => {
        posted.push({ url, options });

        return Promise.resolve({ ok: () => status < 400, status: () => status, text: () => Promise.resolve('no') });
      }
    }
  };

  // The fake answers the url and the sign-in request; the rest of a page is none of this test's.
  return { page: page as unknown as BrowserPage, posted };
};

const dax = { username: 'dax', password: 'secret' };

// Seven page commands in ten of two runs said `--as`, and one that forgot read the sign-in panel as the page.
describe('a page that sends a guest away', () => {
  afterEach(() => {
    opened.length = 0;
  });

  it('is read again signed in as the project’s account, said with where it sent the guest', async () => {
    const { page, posted } = pageAt('/sign-in');

    expect(await signInWhereSent(page, 'http://127.0.0.1:8080', '/settings', dax)).toEqual({
      as: 'dax',
      from: '/sign-in'
    });
    expect(posted).toHaveLength(1);
    expect(opened).toEqual(['http://127.0.0.1:8080/settings']);
  });

  it('is left as it is when it stayed, or the project names no account — and says a sign-in refused', async () => {
    expect(await signInWhereSent(pageAt('/settings').page, 'http://127.0.0.1:8080', '/settings', dax)).toBeUndefined();
    expect(await signInWhereSent(pageAt('/sign-in').page, 'http://127.0.0.1:8080', '/settings', undefined)).toBe(
      undefined
    );
    const refused = await signInWhereSent(pageAt('/sign-in', 401).page, 'http://127.0.0.1:8080', '/settings', dax);
    expect(refused && 'problem' in refused ? refused.problem : '').toMatch(
      /^\/settings sends a guest to \/sign-in, and dax was not signed in \(401\)/
    );
    expect(opened).toEqual([]);
  });
});
