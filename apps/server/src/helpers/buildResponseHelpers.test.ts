import { gunzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { buildResponseHelpers } from './buildResponseHelpers';
import { resolveCompression } from './compress';

import type { RawResponse } from './buildResponseHelpers';

const rawResponse = () => {
  const headers: Record<string, string | number | readonly string[]> = {};
  const state = { body: undefined as string | Buffer | undefined, status: 0 };

  const raw: RawResponse = {
    headersSent: false,
    statusCode: 200,
    setHeader: (name, value) => (headers[name.toLowerCase()] = value),
    getHeaders: () => headers,
    writeHead: status => (state.status = status),
    write: () => undefined,
    end: chunk => (state.body = chunk)
  };

  return { raw, headers, state };
};

const body = 'x'.repeat(4096);

describe('sending a response', () => {
  it('compresses a large body and says so', () => {
    const { raw, headers, state } = rawResponse();

    buildResponseHelpers(raw, 'gzip').send(body);

    expect(headers['content-encoding']).toBe('gzip');
    expect(headers.vary).toBe('Accept-Encoding');
    expect(gunzipSync(state.body as Buffer).toString()).toBe(body);
  });

  /**
   * The rule the OAuth token endpoint depends on. It sets `no-transform` because its body carries a credential
   * beside a value the caller chose, and compressing the two together is the shape a BREACH-style attack needs —
   * so the header has to actually stop this server, not only the CDN in front of it.
   */
  it('leaves a body alone when the stage said no-transform', () => {
    const { raw, headers, state } = rawResponse();
    const res = buildResponseHelpers(raw, 'gzip');

    res.setHeader('Cache-Control', 'no-store, no-transform');
    res.send(body);

    expect(headers['content-encoding']).toBeUndefined();
    expect(state.body).toBe(body);
  });

  it('still compresses a response that only asked not to be cached', () => {
    const { raw, headers } = rawResponse();
    const res = buildResponseHelpers(raw, 'gzip');

    res.setHeader('Cache-Control', 'no-store');
    res.send(body);

    expect(headers['content-encoding']).toBe('gzip');
  });

  it('sends plainly when the deployment turned compression off', () => {
    const { raw, headers, state } = rawResponse();

    buildResponseHelpers(raw, 'gzip, br', resolveCompression(false)).send(body);

    expect(headers['content-encoding']).toBeUndefined();
    expect(state.body).toBe(body);
  });

  it('reports the length of what actually went out', () => {
    const { raw, headers, state } = rawResponse();

    buildResponseHelpers(raw, 'gzip').send(body);

    expect(headers['content-length']).toBe(String(Buffer.byteLength(state.body as Buffer)));
  });
});

describe('sending bytes', () => {
  /** Bytes that are not valid UTF-8 — the woff2 signature and a few of the ones a round trip destroys. */
  const binary = Buffer.from([0x77, 0x4f, 0x46, 0x32, 0x00, 0xff, 0xfe, 0x80, 0x81]);

  it('sends a Buffer through untouched, which is the only way a font arrives whole', () => {
    const { raw, state } = rawResponse();

    buildResponseHelpers(raw, 'gzip').send(binary);

    expect(Buffer.isBuffer(state.body)).toBe(true);
    expect(state.body).toEqual(binary);
  });

  it('never compresses one: what a Buffer holds is compressed already', () => {
    const { raw, headers } = rawResponse();

    buildResponseHelpers(raw, 'gzip').send(Buffer.alloc(8192, 0xff));

    expect(headers['content-encoding']).toBeUndefined();
  });

  it('reports the byte length, not the character count', () => {
    const { raw, headers } = rawResponse();

    buildResponseHelpers(raw).send(binary);

    expect(headers['content-length']).toBe(String(binary.byteLength));
  });

  /** A cached page is the same body every time; compressing it on every hit was nearly all the CPU a hit cost. */
  it('compresses a kept body once per encoding, and sends the kept bytes after that', () => {
    const compressed = {};
    const first = rawResponse();
    buildResponseHelpers(first.raw, 'gzip').send(body, { compressed });

    const kept = (compressed as { gzip?: Buffer }).gzip;
    expect(kept).toBeInstanceOf(Buffer);

    const second = rawResponse();
    buildResponseHelpers(second.raw, 'gzip').send(body, { compressed });

    expect(second.state.body).toBe(kept);
    expect(second.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(second.state.body as Buffer).toString()).toBe(body);
  });

  it('keeps nothing for a body it did not compress', () => {
    const compressed = {};
    buildResponseHelpers(rawResponse().raw, undefined).send(body, { compressed });
    buildResponseHelpers(rawResponse().raw, 'gzip').send('small', { compressed });

    expect(compressed).toEqual({});
  });
});
