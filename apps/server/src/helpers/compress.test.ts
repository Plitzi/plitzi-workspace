import { gunzipSync, brotliDecompressSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { compressBody, resolveCompression, selectEncoding } from './compress';

const body = 'x'.repeat(4096);

describe('choosing an encoding', () => {
  it('prefers Brotli, then gzip, when the deployment says nothing', () => {
    expect(selectEncoding('gzip, deflate, br')).toBe('br');
    expect(selectEncoding('gzip, deflate')).toBe('gzip');
    expect(selectEncoding('deflate')).toBe('identity');
    expect(selectEncoding(undefined)).toBe('identity');
  });

  /**
   * `q=0` is the one way a client can say "not this one" — a proxy that mangles Brotli, a client that decodes it
   * wrongly. Matching the header by substring honoured the offer and missed the refusal, which is precisely how a
   * server ends up sending a body the caller cannot read.
   */
  it('treats q=0 as a refusal rather than an offer', () => {
    expect(selectEncoding('br;q=0, gzip')).toBe('gzip');
    expect(selectEncoding('br;q=0, gzip;q=0')).toBe('identity');
    expect(selectEncoding('br;q=0.5, gzip')).toBe('br');
  });

  it('takes a wildcard as accepting whatever the server prefers', () => {
    expect(selectEncoding('*')).toBe('br');
  });

  it('follows the order the deployment asked for', () => {
    const gzipOnly = resolveCompression({ encodings: ['gzip'] });

    expect(selectEncoding('gzip, br', gzipOnly)).toBe('gzip');
  });

  it('compresses nothing when the deployment turned it off', () => {
    expect(selectEncoding('gzip, br', resolveCompression(false))).toBe('identity');
    expect(selectEncoding('gzip, br', resolveCompression({ encodings: [] }))).toBe('identity');
  });
});

describe('compressing a body', () => {
  it('produces something the client can actually decode', () => {
    const brotli = compressBody(body, 'br') as Buffer;
    const gzip = compressBody(body, 'gzip') as Buffer;

    expect(brotliDecompressSync(brotli).toString()).toBe(body);
    expect(gunzipSync(gzip).toString()).toBe(body);
  });

  // Below the threshold the compressed body plus its headers is no smaller, and the CPU is spent for nothing.
  it('leaves a small body alone, at whatever threshold the deployment set', () => {
    expect(compressBody('tiny', 'br')).toBe('tiny');
    expect(compressBody(body, 'br', resolveCompression({ threshold: 1_000_000 }))).toBe(body);
  });

  it('honours the effort the deployment asked for', () => {
    const cheap = compressBody(body, 'br', resolveCompression({ brotliQuality: 0 })) as Buffer;
    const dear = compressBody(body, 'br', resolveCompression({ brotliQuality: 11 })) as Buffer;

    expect(brotliDecompressSync(cheap).toString()).toBe(body);
    expect(dear.length).toBeLessThanOrEqual(cheap.length);
  });
});

describe('resolving the policy', () => {
  it('fills in only what the deployment left out', () => {
    expect(resolveCompression({ gzipLevel: 9 })).toEqual({
      encodings: ['br', 'gzip'],
      threshold: 1024,
      brotliQuality: 4,
      gzipLevel: 9
    });
  });

  // `false` becomes an empty list rather than a second shape to re-test at every use.
  it('expresses "never compress" the same way an empty list does', () => {
    expect(resolveCompression(false).encodings).toEqual([]);
  });
});
