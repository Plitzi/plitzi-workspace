/* eslint-disable quotes -- a CSP quotes its keywords, which reads best in the other quotes */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { IMAGE_WIDTHS, isImageWidth } from '@plitzi/sdk-shared/helpers/images';

import { isAllowedImageHost } from './allowlist';
import { writeFileAtomic } from '../../helpers/atomicFile';
import { fetchOutbound } from '../../helpers/outboundGuard';

import type { ImageFormat, ImageTransform } from './transform';
import type { HostLookup } from '../../helpers/outboundGuard';

/** What a request for a picture asked: the picture, the width, and what the browser takes (its `Accept`). */
export type ImageRequest = { url?: string; width?: string; accept?: string };

export type ImageAnswer = { status: number; headers: Record<string, string>; body: Buffer | string };

export type ImageProxyOptions = {
  domains: readonly string[];
  cacheDir: string;
  /** The transport every hop goes through. */
  fetch: typeof fetch;
  /** `sharp`'s, when it is installed; without one a picture is passed through, cached. */
  transform?: ImageTransform;
  lookup?: HostLookup;
  now?: () => number;
};

/** The formats a picture may arrive in, as the file extension it is kept under. SVG is not one: served from this
 *  origin, an SVG is a document that can run script. */
const SOURCE_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif'
};

const TYPE_OF_EXTENSION: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SOURCE_TYPES).map(([type, extension]) => [extension, type])
);

/** The largest picture fetched, and how long fetching it may take. */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * How long a kept original answers without asking the other site again. Past it the kept files still answer — at once —
 * while the original is asked for with its `ETag` / `Last-Modified`: unchanged, nothing is fetched or resized again.
 */
const FRESH_MS = 7 * 24 * 60 * 60 * 1000;

/** How long a picture that could not be fetched is not asked for again: a broken address is not a reason to keep asking. */
const FAILED_MS = 5 * 60 * 1000;

const CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=604800';

class HostNotAllowed extends Error {}

const answer = (status: number, message: string): ImageAnswer => ({
  status,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  body: message
});

/** What a request is answered with when it gets no picture, carried up from wherever it was decided. */
class Refusal extends Error {
  constructor(readonly answer: ImageAnswer) {
    super(String(answer.body));
  }
}

const refuse = (status: number, message: string): Refusal => new Refusal(answer(status, message));

/**
 * A vector picture is sent back to where it is: there is no size of it to make, and an SVG served from this origin is a
 * document that can run script. The browser loads it from its own host, as it would without this endpoint.
 */
const toOriginal = (source: URL): Refusal =>
  new Refusal({
    status: 307,
    headers: { Location: source.href, 'Cache-Control': CACHE_CONTROL },
    body: ''
  });

const isVector = (pathname: string): boolean => /\.svgz?$/i.test(pathname);

/** One of each at a time: a second request for what is being made waits for the first. */
const oneAtATime = <T>(): ((key: string, make: () => Promise<T>) => Promise<T>) => {
  const running = new Map<string, Promise<T>>();

  return (key, make) => {
    const known = running.get(key);
    if (known) {
      return known;
    }

    const made = make().finally(() => running.delete(key));
    running.set(key, made);

    return made;
  };
};

/** What the browser takes, best first; `original` when it takes neither modern format. */
const negotiate = (accept: string): ImageFormat => {
  if (accept.includes('image/avif')) {
    return 'avif';
  }

  return accept.includes('image/webp') ? 'webp' : 'original';
};

const FORMATS: readonly ImageFormat[] = ['avif', 'webp', 'original'];

/** What is kept beside an original: its type, how to ask whether it changed, when it was last asked, and its version. */
type OriginalMeta = { type: string; etag?: string; lastModified?: string; checkedAt: number; version: string };

const isOriginalMeta = (value: unknown): value is OriginalMeta =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  typeof value.type === 'string' &&
  'checkedAt' in value &&
  typeof value.checkedAt === 'number' &&
  'version' in value &&
  typeof value.version === 'string';

const sha = (text: string | Buffer): string => createHash('sha256').update(text).digest('hex');

/** An original as it was answered: new bytes, or the word that the kept ones still stand. */
type Fetched = { changed: true; body: Buffer; meta: OriginalMeta } | { changed: false };

/**
 * Another site's picture, at a width this server makes, in the best format the browser takes.
 *
 * Each original is fetched once and kept, and each size of it is made once from the kept original and kept too: a page
 * asking for eight widths in two formats costs one download and sixteen resizes, ever — not one of each per request,
 * nor again a week later. Past a week the kept files still answer at once while the other site is asked, with the
 * original's `ETag` / `Last-Modified`, whether it changed; only a changed original makes its sizes again.
 *
 * Only from the hosts the deployment allows, with every hop (redirects included) held to the allowlist and to the
 * rule every outbound request is: a picture endpoint that fetched anything would be a way to make this server read
 * its own network.
 */
export const createImageProxy = (options: ImageProxyOptions): ((request: ImageRequest) => Promise<ImageAnswer>) => {
  const { domains, cacheDir, transform, lookup, now = Date.now } = options;
  const failedUntil = new Map<string, number>();
  const revalidating = oneAtATime<undefined>();
  const fetchingOriginal = oneAtATime<{ body: Buffer; meta: OriginalMeta }>();
  const resizing = oneAtATime<{ body: Buffer; type: string }>();

  // Every hop is the caller's transport, behind the allowlist: a redirect off the allowed hosts is refused like a
  // first request to one.
  const allowedFetch: typeof fetch = (input, init) => {
    const target = new URL(input instanceof Request ? input.url : String(input));
    if (!isAllowedImageHost(domains, target.hostname)) {
      return Promise.reject(new HostNotAllowed(target.hostname));
    }

    return options.fetch(input, init);
  };

  const originalFile = (urlKey: string, extension: string): string =>
    path.join(cacheDir, 'originals', urlKey.slice(0, 2), `${urlKey}.${extension}`);
  const variantKey = (urlKey: string, version: string, width: number, format: ImageFormat): string =>
    sha(`${urlKey}\n${version}\n${String(width)}\n${format}`);
  const variantFile = (key: string, extension: string): string =>
    path.join(cacheDir, key.slice(0, 2), `${key}.${extension}`);

  const write = async (file: string, data: string | Buffer): Promise<void> => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await writeFileAtomic(file, data);
  };

  const readMeta = async (urlKey: string): Promise<OriginalMeta | undefined> => {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(originalFile(urlKey, 'json'), 'utf-8'));

      return isOriginalMeta(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  };

  const readFile = async (file: string): Promise<Buffer | undefined> => {
    try {
      return await fs.readFile(file);
    } catch {
      return undefined;
    }
  };

  /** A size already made, in whichever type it came out as. */
  const keptVariant = async (key: string): Promise<{ body: Buffer; type: string } | undefined> => {
    for (const [extension, type] of Object.entries(TYPE_OF_EXTENSION)) {
      const body = await readFile(variantFile(key, extension));
      if (body) {
        return { body, type };
      }
    }

    return undefined;
  };

  /** The original from the other site — asked conditionally when one is kept. Throws an answer to give back. */
  const fetchOriginal = async (source: URL, kept?: OriginalMeta): Promise<Fetched> => {
    const headers: Record<string, string> = { accept: 'image/avif,image/webp,image/*' };
    if (kept?.etag) {
      headers['if-none-match'] = kept.etag;
    }

    if (kept?.lastModified) {
      headers['if-modified-since'] = kept.lastModified;
    }

    let response: Response;
    try {
      response = await fetchOutbound(
        allowedFetch,
        source,
        { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
        lookup
      );
    } catch (error) {
      throw error instanceof HostNotAllowed
        ? refuse(403, `The picture moved to ${error.message}, which is not an allowed host.`)
        : refuse(502, 'The picture could not be fetched.');
    }

    if (kept && response.status === 304) {
      await response.body?.cancel();

      return { changed: false };
    }

    const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (response.ok && type === 'image/svg+xml') {
      await response.body?.cancel();
      throw toOriginal(source);
    }

    if (!response.ok || !Object.hasOwn(SOURCE_TYPES, type)) {
      await response.body?.cancel();
      throw refuse(
        502,
        response.ok ? `Not a picture this endpoint serves (${type || 'no type'}).` : 'The picture could not be fetched.'
      );
    }

    if (Number(response.headers.get('content-length') ?? 0) > MAX_SOURCE_BYTES) {
      await response.body?.cancel();
      throw refuse(413, 'The picture is too large.');
    }

    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > MAX_SOURCE_BYTES) {
      throw refuse(413, 'The picture is too large.');
    }

    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');

    return {
      changed: true,
      body,
      meta: {
        type,
        ...(etag ? { etag } : {}),
        ...(lastModified ? { lastModified } : {}),
        checkedAt: now(),
        version: sha(body).slice(0, 16)
      }
    };
  };

  /** Keeps a new original and its meta, and drops the sizes made from the one it replaces. */
  const keepOriginal = async (
    urlKey: string,
    fetched: { body: Buffer; meta: OriginalMeta },
    previous?: OriginalMeta
  ) => {
    await write(originalFile(urlKey, SOURCE_TYPES[fetched.meta.type]), fetched.body);
    await write(originalFile(urlKey, 'json'), JSON.stringify(fetched.meta));
    if (!previous || previous.version === fetched.meta.version) {
      return;
    }

    if (previous.type !== fetched.meta.type) {
      await fs.rm(originalFile(urlKey, SOURCE_TYPES[previous.type]), { force: true });
    }

    const stale = IMAGE_WIDTHS.flatMap(width =>
      FORMATS.flatMap(format => {
        const key = variantKey(urlKey, previous.version, width, format);

        return Object.keys(TYPE_OF_EXTENSION).map(extension => variantFile(key, extension));
      })
    );
    await Promise.all(stale.map(file => fs.rm(file, { force: true })));
  };

  /** Asks the other site whether a kept original changed: unchanged costs a header, changed makes new sizes later. */
  const revalidate = (urlKey: string, source: URL, meta: OriginalMeta): Promise<undefined> =>
    revalidating(urlKey, async () => {
      try {
        const fetched = await fetchOriginal(source, meta);
        if (fetched.changed) {
          await keepOriginal(urlKey, fetched, meta);
        } else {
          await write(originalFile(urlKey, 'json'), JSON.stringify({ ...meta, checkedAt: now() }));
        }
      } catch {
        // The kept files keep answering; it is asked again on a later request.
      }

      return undefined;
    });

  /** The original, kept or fetched: its bytes and its meta. Throws an answer to give back. */
  const original = async (urlKey: string, source: URL): Promise<{ body: Buffer; meta: OriginalMeta }> => {
    const meta = await readMeta(urlKey);
    const body = meta && (await readFile(originalFile(urlKey, SOURCE_TYPES[meta.type])));
    if (meta && body) {
      return { body, meta };
    }

    if ((failedUntil.get(urlKey) ?? 0) > now()) {
      throw refuse(502, 'The picture could not be fetched a moment ago; it is asked for again in a few minutes.');
    }

    return fetchingOriginal(urlKey, async () => {
      try {
        const fetched = await fetchOriginal(source);
        // A first request is never conditional, so it always brings bytes.
        if (!fetched.changed) {
          throw refuse(502, 'The picture could not be fetched.');
        }

        await keepOriginal(urlKey, fetched, meta);

        return fetched;
      } catch (error) {
        // A vector picture sent back to where it is did not fail: it is simply not this endpoint's to serve.
        if (!(error instanceof Refusal && error.answer.status === 307)) {
          failedUntil.set(urlKey, now() + FAILED_MS);
        }

        throw error;
      }
    });
  };

  /** One size of the original, made once and kept. A GIF is passed through: resizing one keeps its first frame. */
  const makeVariant = (key: string, source: { body: Buffer; meta: OriginalMeta }, width: number, format: ImageFormat) =>
    resizing(key, async () => {
      let body = source.body;
      let type = source.meta.type;
      if (transform && type !== 'image/gif') {
        try {
          body = await transform(source.body, width, format);
          type = format === 'original' ? type : `image/${format}`;
        } catch {
          body = source.body;
          type = source.meta.type;
        }
      }

      await write(variantFile(key, SOURCE_TYPES[type]), body);

      return { body, type };
    });

  return async ({ url, width, accept = '' }) => {
    let source: URL;
    try {
      source = new URL(url ?? '');
    } catch {
      return answer(400, '`url` is the picture’s address.');
    }

    if (source.protocol !== 'https:' && source.protocol !== 'http:') {
      return answer(400, '`url` is the picture’s web address.');
    }

    const requested = Number(width);
    if (!isImageWidth(requested)) {
      return answer(400, `\`w\` is one of ${IMAGE_WIDTHS.join(', ')}.`);
    }

    if (!isAllowedImageHost(domains, source.hostname)) {
      return answer(403, `${source.hostname} is not one of the hosts this server takes pictures from.`);
    }

    if (isVector(source.pathname)) {
      return toOriginal(source).answer;
    }

    const format = transform ? negotiate(accept) : 'original';
    const urlKey = sha(source.href);
    try {
      const kept = await readMeta(urlKey);
      if (kept && now() - kept.checkedAt >= FRESH_MS) {
        void revalidate(urlKey, source, kept);
      }

      const made = kept && (await keptVariant(variantKey(urlKey, kept.version, requested, format)));
      if (made) {
        return { status: 200, headers: headersOf(made.type), body: made.body };
      }

      const from = await original(urlKey, source);
      const variant = await makeVariant(
        variantKey(urlKey, from.meta.version, requested, format),
        from,
        requested,
        format
      );

      return { status: 200, headers: headersOf(variant.type), body: variant.body };
    } catch (error) {
      if (error instanceof Refusal) {
        return error.answer;
      }

      throw error;
    }
  };
};

const headersOf = (type: string): Record<string, string> => ({
  'Content-Type': type,
  'Cache-Control': CACHE_CONTROL,
  Vary: 'Accept',
  'X-Content-Type-Options': 'nosniff',
  // A picture is never a document: if a browser were made to render one as such, it could run nothing.
  'Content-Security-Policy': "default-src 'none'; sandbox"
});
