import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { isAllowedImageHost } from './allowlist';
import { createImageProxy } from './imageProxy';

import type { ImageTransform } from './transform';

const PUBLIC = () => Promise.resolve([{ address: '93.184.216.34' }]);

const dirs: string[] = [];
const cacheDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plitzi-images-'));
  dirs.push(dir);

  return dir;
};

afterEach(() => {
  dirs.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true }));
});

const picture = (type = 'image/jpeg', body = 'JPEGBYTES'): Response =>
  new Response(body, { status: 200, headers: { 'content-type': type } });

const proxyWith = (fetch: typeof globalThis.fetch, transform?: ImageTransform) =>
  createImageProxy({
    domains: ['images.example.com', '*.cdn.example.com'],
    cacheDir: cacheDir(),
    fetch,
    transform,
    lookup: PUBLIC
  });

describe('the image endpoint', () => {
  it('takes pictures only from the hosts it is given', () => {
    expect(isAllowedImageHost(['images.example.com'], 'images.example.com')).toBe(true);
    expect(isAllowedImageHost(['*.example.com'], 'a.b.example.com')).toBe(true);
    expect(isAllowedImageHost(['*.example.com'], 'example.com')).toBe(false);
    expect(isAllowedImageHost(['images.example.com'], 'images.example.com.evil.test')).toBe(false);
  });

  it('resizes to the width asked, in the best format the browser takes, and keeps it', async () => {
    const fetch = vi.fn(() => Promise.resolve(picture()));
    const transform = vi.fn<ImageTransform>((_input, width, format) =>
      Promise.resolve(Buffer.from(`${format}@${String(width)}`))
    );
    const serve = proxyWith(fetch, transform);
    const request = { url: 'https://images.example.com/a.jpg', width: '640', accept: 'image/avif,image/webp,*/*' };

    const first = await serve(request);
    const second = await serve(request);

    expect(first.status).toBe(200);
    expect(first.headers['Content-Type']).toBe('image/avif');
    expect(first.headers.Vary).toBe('Accept');
    expect(String(first.body)).toBe('avif@640');
    expect(String(second.body)).toBe('avif@640');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await serve({ ...request, accept: 'image/webp' })).headers['Content-Type']).toBe('image/webp');
  });

  it('passes the picture through, still kept, where nothing resizes it', async () => {
    const answer = await proxyWith(() => Promise.resolve(picture('image/png', 'PNG')))({
      url: 'https://x.cdn.example.com/p.png',
      width: '320',
      accept: 'image/avif'
    });

    expect(answer.headers['Content-Type']).toBe('image/png');
    expect(String(answer.body)).toBe('PNG');
  });

  it('refuses what it should not fetch or serve', async () => {
    const fetch = vi.fn(() => Promise.resolve(picture()));
    const serve = proxyWith(fetch);

    expect((await serve({ url: 'https://evil.test/a.jpg', width: '640' })).status).toBe(403);
    expect((await serve({ url: 'https://images.example.com/a.jpg', width: '641' })).status).toBe(400);
    expect((await serve({ url: 'file:///etc/passwd', width: '640' })).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();

    const svg = await proxyWith(() => Promise.resolve(picture('image/svg+xml', '<svg onload="x()"/>')))({
      url: 'https://images.example.com/a.svg',
      width: '640'
    });

    expect(svg.status).toBe(502);
  });

  it('holds a redirect to the allowlist as it holds the first request', async () => {
    const fetch = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        new URL(input instanceof Request ? input.url : input).hostname === 'images.example.com'
          ? new Response(null, { status: 302, headers: { location: 'https://evil.test/a.jpg' } })
          : picture()
      )
    );
    const answer = await proxyWith(fetch)({ url: 'https://images.example.com/a.jpg', width: '640' });

    expect(answer.status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  describe('what it keeps', () => {
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const request = (width: string, accept = 'image/avif') => ({
      url: 'https://images.example.com/a.jpg',
      width,
      accept
    });

    const setup = (respond: (init?: RequestInit) => Response) => {
      let clock = 0;
      const fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(respond(init)));
      const transform = vi.fn<ImageTransform>((_input, width, format) =>
        Promise.resolve(Buffer.from(`${format}@${String(width)}`))
      );
      const serve = createImageProxy({
        domains: ['images.example.com'],
        cacheDir: cacheDir(),
        fetch,
        transform,
        lookup: PUBLIC,
        now: () => clock
      });

      return { fetch, transform, serve, advance: (ms: number) => (clock += ms) };
    };

    const tagged = (body = 'JPEG') =>
      new Response(body, { status: 200, headers: { 'content-type': 'image/jpeg', etag: '"v1"' } });

    it('fetches an original once for every size made from it, and makes each size once', async () => {
      const { fetch, transform, serve } = setup(() => tagged());

      await serve(request('320'));
      await serve(request('640'));
      await serve(request('640', 'image/webp'));
      await serve(request('640'));

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(transform).toHaveBeenCalledTimes(3);
    });

    it('a week on, answers at once and asks whether the original changed — unchanged, it resizes nothing', async () => {
      const { fetch, transform, serve, advance } = setup(init =>
        new Headers(init?.headers).get('if-none-match') === '"v1"' ? new Response(null, { status: 304 }) : tagged()
      );

      await serve(request('640'));
      advance(WEEK + 1);
      const later = await serve(request('640'));
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

      expect(String(later.body)).toBe('avif@640');
      expect(new Headers(fetch.mock.calls[1][1]?.headers).get('if-none-match')).toBe('"v1"');

      await serve(request('640'));

      expect(transform).toHaveBeenCalledTimes(1);
    });

    it('makes its sizes again once the original changed', async () => {
      let body = 'JPEG';
      const { transform, serve, advance } = setup(() => tagged(body));

      await serve(request('640'));
      body = 'NEWJPEG';
      advance(WEEK + 1);
      await serve(request('640'));
      await vi.waitFor(async () => {
        await serve(request('640'));
        expect(transform).toHaveBeenCalledTimes(2);
      });
    });

    it('does not ask again for a while for a picture it could not fetch', async () => {
      const { fetch, serve, advance } = setup(() => new Response(null, { status: 404 }));

      expect((await serve(request('640'))).status).toBe(502);
      expect((await serve(request('640'))).status).toBe(502);
      expect(fetch).toHaveBeenCalledTimes(1);

      advance(5 * 60 * 1000 + 1);
      await serve(request('640'));

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
