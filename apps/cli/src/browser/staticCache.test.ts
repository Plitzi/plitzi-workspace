import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { keepStatic, staticCacheDir } from './staticCache';

import type { BrowserPage, PageRoute } from './index';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-static-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

/** What a route was answered with: fulfilled from where, or let on. */
type Answered = { fulfilled: { status: number; headers?: Record<string, string>; body: string } } | 'fallback';

/**
 * A page that hands every request to the handler `keepStatic` registers, and a route of one request — what the site
 * answers it with, and how many times it was asked.
 */
const harness = async (own?: string) => {
  let handler: ((route: PageRoute) => Promise<void>) | undefined;
  let matcher: ((url: URL) => boolean) | undefined;
  // A stand-in of a page: the one call keepStatic makes of it.
  const page = {
    route: (match: (url: URL) => boolean, handle: (route: PageRoute) => Promise<void>) => {
      matcher = match;
      handler = handle;

      return Promise.resolve();
    }
  } as unknown as BrowserPage;
  await keepStatic(page, dir, own);
  let fetched = 0;
  const ask = async (
    url: string,
    { type = 'image', method = 'GET', status = 200 }: { type?: string; method?: string; status?: number } = {}
  ): Promise<Answered | 'not routed'> => {
    if (!matcher?.(new URL(url)) || !handler) {
      return 'not routed';
    }

    let answered: Answered = 'fallback';
    await handler({
      request: () => ({
        url: () => url,
        resourceType: () => type,
        method: () => method,
        postData: () => null,
        headers: () => ({})
      }),
      fulfill: response => {
        answered = {
          fulfilled: {
            status: response.status ?? 200,
            ...(response.headers ? { headers: response.headers } : {}),
            body: Buffer.from(response.body).toString('utf-8')
          }
        };

        return Promise.resolve();
      },
      continue: () => Promise.resolve(),
      abort: () => Promise.resolve(),
      fallback: () => Promise.resolve(),
      fetch: () => {
        fetched += 1;

        return Promise.resolve({
          status: () => status,
          headers: () => ({
            'content-type': 'image/webp',
            'content-encoding': 'br',
            'access-control-allow-origin': '*'
          }),
          body: () => Promise.resolve(Buffer.from(`picture ${String(fetched)}`))
        });
      }
    });

    return answered;
  };

  return { ask, fetched: () => fetched };
};

// A run's home asked a CDN, YouTube and Google Fonts for 63 files on each of a check's loads: 1.25 s cold, 0.27 s warm.
describe('what pages ask other sites for, kept', () => {
  it('fetches a picture once and answers it from disk after — decoded, its CORS kept, for the next browser too', async () => {
    const first = await harness('http://127.0.0.1:8080');
    const answered = await first.ask('https://cdn.example.com/hero.webp');
    expect(answered).toEqual({
      fulfilled: {
        status: 200,
        headers: { 'content-type': 'image/webp', 'access-control-allow-origin': '*' },
        body: 'picture 1'
      }
    });

    const next = await harness('http://127.0.0.1:8080');
    expect(await next.ask('https://cdn.example.com/hero.webp')).toEqual(answered);
    expect(next.fetched()).toBe(0);
  });

  it('keeps nothing of the project’s own server, of a page or an API, of what is not a GET, nor of a failure', async () => {
    const page = await harness('http://127.0.0.1:8080');

    expect(await page.ask('http://127.0.0.1:8080/hero.webp')).toBe('not routed');
    expect(await page.ask('https://api.example.com/fights', { type: 'fetch' })).toBe('fallback');
    expect(await page.ask('https://www.example.com/', { type: 'document' })).toBe('fallback');
    expect(await page.ask('https://cdn.example.com/upload', { method: 'POST' })).toBe('fallback');

    await page.ask('https://cdn.example.com/busy.webp', { status: 429 });
    await page.ask('https://cdn.example.com/busy.webp', { status: 429 });
    expect(page.fetched()).toBe(2);
  });

  it('is the project’s, also from a task’s copy: every task reads what another fetched', () => {
    const copy = path.join('/p/acme', 'tmp', 'plitzi-runs', 'r', 'tasks', 't-a', 'cache', 'work');

    expect(staticCacheDir(copy)).toBe(path.join('/p/acme', 'tmp', 'plitzi-cache', 'http'));
    expect(staticCacheDir('/p/acme')).toBe(path.join('/p/acme', 'tmp', 'plitzi-cache', 'http'));
  });
});
