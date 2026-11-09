import { afterEach, describe, expect, it, vi } from 'vitest';

import { onAuthFailure } from '@plitzi/sdk-shared/auth';

import { askSpace } from './askSpace';

import type { AskSpaceOptions } from './askSpace';

/**
 * A page that renders the space itself asks the page server for it (`/_plitzi/space.json`): what it asks with, what it
 * makes of the answer, and every way it can fail said in words a visitor can act on.
 */

const space = { schema: { flat: {}, pages: [] }, style: { cache: '', cacheHref: '/_plitzi/style/abc.css' } };
const options: AskSpaceOptions = {
  ssrServer: 'https://ssr.example.com',
  webKey: 'render-key',
  environment: 'production',
  revision: 0,
  carryStyle: false
};

const answering = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

const askedWith = (spy: ReturnType<typeof answering>): { url: URL; init: RequestInit | undefined } => {
  const [url, init] = spy.mock.calls[0];

  return { url: new URL(url instanceof Request ? url.url : url), init };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('asking the page server for the space', () => {
  it('names the environment and the revision with the credential, which chooses them', async () => {
    const spy = answering(200, { space, visit: {} });
    await askSpace({ ...options, revision: 7 });
    const { url, init } = askedWith(spy);

    expect(url.origin + url.pathname).toBe('https://ssr.example.com/_plitzi/space.json');
    expect(Object.fromEntries(url.searchParams)).toEqual({ environment: 'production', revision: '7' });
    expect(init?.headers).toEqual({ authorization: 'Bearer render-key' });
    expect(init?.credentials).toBe('include');
  });

  // The host decides then — a custom domain serves its own environment — and this page's default is not its answer.
  it('names neither without the credential, and asks for the stylesheet carried where it cannot link one', async () => {
    const spy = answering(200, { space, visit: {} });
    await askSpace({ ...options, webKey: '', carryStyle: true });
    const { url, init } = askedWith(spy);

    expect(Object.fromEntries(url.searchParams)).toEqual({ style: 'carried' });
    expect(init?.headers).toEqual({});
  });

  it('takes the space and the visit, its stylesheet the page server’s wherever the page is', async () => {
    answering(200, {
      space,
      visit: { badge: { madeWith: 'https://plitzi.test', report: 'https://plitzi.test/report-abuse' } }
    });

    const answer = await askSpace(options);

    expect(answer).toEqual({
      ok: true,
      space: { ...space, style: { cache: '', cacheHref: 'https://ssr.example.com/_plitzi/style/abc.css' } },
      visit: { badge: { madeWith: 'https://plitzi.test', report: 'https://plitzi.test/report-abuse' } }
    });
  });
});

describe('a space the page server does not hand over', () => {
  it('says the space is not there, and where to publish it', async () => {
    answering(404, { error: 'no data', reason: 'not_found' });

    expect(await askSpace(options)).toEqual({
      ok: false,
      message: 'Space not found: publish it to the production environment'
    });
  });

  it('says a refused credential is not authorized, and tells the auth-failure channel', async () => {
    const heard: unknown[] = [];
    const stop = onAuthFailure(failure => {
      heard.push(failure);
    });
    answering(401, { error: 'Unauthorized', reason: 'revoked' });

    expect(await askSpace(options)).toEqual({ ok: false, message: 'Access not authorized' });
    expect(heard).toHaveLength(1);
    stop();

    vi.restoreAllMocks();
    answering(403, 'Access Not Authorized');
    expect(await askSpace(options)).toEqual({ ok: false, message: 'Access not authorized' });
  });

  it('says what the page server said, or its status, and names a network that is not there', async () => {
    answering(503, { error: 'This site is paused.', reason: 'unavailable' });
    expect(await askSpace(options)).toEqual({ ok: false, message: 'This site is paused.' });

    vi.restoreAllMocks();
    answering(502, 'bad gateway');
    expect(await askSpace(options)).toEqual({ ok: false, message: 'The space could not be loaded (502)' });

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await askSpace(options)).toEqual({ ok: false, message: 'Service not available' });
  });

  it('refuses an answer that is not a space rather than drawing nothing', async () => {
    answering(200, { space: { style: {} }, visit: {} });

    expect(await askSpace(options)).toEqual({
      ok: false,
      message: 'The page server answered something that is not a space'
    });
  });
});
