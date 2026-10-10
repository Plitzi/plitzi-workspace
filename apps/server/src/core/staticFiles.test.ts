import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { serveStatic } from './staticFiles';
import { buildResponseHelpers } from '../helpers/buildResponseHelpers';

import type { StaticCachePolicy } from './mimeTypes';
import type { RawResponse } from '../helpers/buildResponseHelpers';
import type { SSRRequest } from '@plitzi/sdk-shared';

const script = `export const answer = ${JSON.stringify('x'.repeat(8192))};`;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'static-files-'));
  writeFileSync(path.join(dir, 'app.js'), script);
  writeFileSync(path.join(dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe]));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const serve = (file: string, acceptEncoding = 'br, gzip', cache?: StaticCachePolicy) => {
  const headers: Record<string, string | number | readonly string[]> = {};
  const sent: { body?: string | Buffer } = {};
  const raw: RawResponse = {
    headersSent: false,
    statusCode: 200,
    setHeader: (name, value) => (headers[name.toLowerCase()] = value),
    getHeaders: () => headers,
    writeHead: () => undefined,
    write: () => undefined,
    end: chunk => (sent.body = chunk)
  };
  // Only the path and headers matter to a static file; the rest of a request is not read.
  const req = { path: `/${file}`, headers: { 'accept-encoding': acceptEncoding } } as unknown as SSRRequest;
  serveStatic(req, buildResponseHelpers(raw, acceptEncoding), dir, cache);

  return { headers, body: sent.body };
};

describe('serveStatic', () => {
  it('sends a script compressed, the way a browser asks for it', () => {
    const { headers, body } = serve('app.js');

    expect(headers['content-encoding']).toBe('br');
    expect(brotliDecompressSync(body as Buffer).toString()).toBe(script);
  });

  it('sends an image as the bytes on disk', () => {
    const { headers, body } = serve('logo.png');

    expect(headers['content-encoding']).toBeUndefined();
    expect(body).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe]));
  });

  it('compresses a changed file anew rather than serving the forms of the old one', () => {
    serve('app.js');
    const edited = `${script}\nexport const more = 1;`;
    writeFileSync(path.join(dir, 'app.js'), edited);
    const later = new Date(Date.now() + 5000);
    utimesSync(path.join(dir, 'app.js'), later, later);

    expect(brotliDecompressSync(serve('app.js').body as Buffer).toString()).toBe(edited);
  });

  it('keeps a script under a versioned URL for a year', () => {
    expect(serve('app.js').headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('asks again for a file a project keeps by name, answered by its ETag', () => {
    const { headers } = serve('app.js', 'br, gzip', 'revalidate');

    expect(headers['cache-control']).toBe('no-cache');
    expect(headers.etag).toBeDefined();
  });
});
