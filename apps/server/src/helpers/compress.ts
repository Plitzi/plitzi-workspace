import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

import type { SSRCompressionConfig } from '@plitzi/sdk-shared';

export type ContentEncoding = 'br' | 'gzip' | 'identity';

/** What the server does when the deployment says nothing: Brotli where the client takes it, gzip otherwise. */
export const DEFAULT_COMPRESSION = {
  encodings: ['br', 'gzip'] as ('br' | 'gzip')[],
  // Below about a KB the compressed body plus its headers is no smaller, and the CPU is spent for nothing.
  threshold: 1024,
  brotliQuality: 4,
  gzipLevel: 6
};

export type ResolvedCompression = typeof DEFAULT_COMPRESSION;

/**
 * The deployment's compression policy, with the gaps filled in. `false` means never compress, and is expressed as
 * an empty encoding list so there is one shape downstream rather than a boolean to re-test at every use.
 */
export const resolveCompression = (config?: SSRCompressionConfig | false): ResolvedCompression => {
  if (config === false) {
    return { ...DEFAULT_COMPRESSION, encodings: [] };
  }

  return { ...DEFAULT_COMPRESSION, ...config };
};

/**
 * What the client will accept, as a set of tokens it did NOT refuse.
 *
 * `q=0` is a refusal, and the header is the one place a client can say "not Brotli" — a proxy that mangles it, an
 * old client that decodes it wrongly. Matching on substrings alone honoured the offer and ignored the refusal,
 * which is the one way this can produce a body the caller cannot read.
 */
const acceptedEncodings = (acceptEncoding: string): Set<string> => {
  const accepted = new Set<string>();

  for (const part of acceptEncoding.split(',')) {
    const [token, ...params] = part.trim().split(';');
    const quality = params.map(param => /^\s*q=([\d.]+)\s*$/iu.exec(param)).find(match => match !== null)?.[1];

    if (quality === undefined || Number(quality) > 0) {
      accepted.add(token.trim().toLowerCase());
    }
  }

  return accepted;
};

/** The first encoding this server prefers that the client actually takes. `*` counts as taking anything. */
export const selectEncoding = (
  acceptEncoding: string | undefined,
  compression: ResolvedCompression = DEFAULT_COMPRESSION
): ContentEncoding => {
  if (!acceptEncoding || compression.encodings.length === 0) {
    return 'identity';
  }

  const accepted = acceptedEncodings(acceptEncoding);

  return compression.encodings.find(encoding => accepted.has(encoding) || accepted.has('*')) ?? 'identity';
};

export const compressBody = (
  body: string,
  encoding: ContentEncoding,
  compression: ResolvedCompression = DEFAULT_COMPRESSION
): Buffer | string => {
  if (encoding === 'identity' || body.length < compression.threshold) {
    return body;
  }

  const buf = Buffer.from(body, 'utf-8');
  if (encoding === 'br') {
    return brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: compression.brotliQuality } });
  }

  return gzipSync(buf, { level: compression.gzipLevel });
};
