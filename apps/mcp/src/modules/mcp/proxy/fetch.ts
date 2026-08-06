import { isPublicHost } from './guard';

import type { ProxyKind } from './types';

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 4;

// What the endpoint will pass on, per kind. Anything else is a sign the URL does not answer with what the widget
// asked for — an HTML error page where a picture was expected — and passing it through would turn a widget loader
// into a general-purpose web proxy.
const ALLOWED_TYPES: Record<ProxyKind, string[]> = {
  asset: ['image/', 'video/', 'audio/', 'font/', 'application/font', 'application/octet-stream'],
  data: ['application/json', 'application/ld+json', 'application/xml', 'text/plain', 'text/csv', 'text/xml']
};

// Plenty of services answer a bare Node fetch with a block page or a 403; a browser-shaped request is what they
// expect. No Referer is sent on purpose: an empty one passes most hotlink rules, a wrong one fails them. Nothing
// from the incoming request is forwarded — no cookies, no credentials, no client headers.
const REQUEST_HEADERS: Record<ProxyKind, Record<string, string>> = {
  asset: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  },
  data: {
    'User-Agent': 'PlitziWidget/1.0 (+https://plitzi.com)',
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8'
  }
};

export type FetchFailure = { ok: false; status: number; reason: string };
export type FetchSuccess = { ok: true; contentType: string; contentLength?: number; body: Response['body'] };
export type FetchResult = FetchFailure | FetchSuccess;

const failure = (status: number, reason: string): FetchFailure => ({ ok: false, status, reason });

const parseTarget = (target: string): URL | undefined => {
  try {
    const url = new URL(target);

    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
};

/** Fetch a remote resource on the widget's behalf. Redirects are followed by hand rather than by fetch, because
 *  each hop is a new host that has to pass the same guard — an allowed URL that redirects into the private network
 *  would otherwise walk straight through it. (It is also what makes the redirect-based image services work at
 *  all: the sandbox loses the redirect, this does not.) */
export const fetchResource = async (target: string, kind: ProxyKind, maxBytes: number): Promise<FetchResult> => {
  let url = parseTarget(target);
  if (!url) {
    return failure(400, 'Only http(s) URLs can be fetched.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      if (!(await isPublicHost(url.hostname))) {
        return failure(403, 'That host is not reachable from here.');
      }

      const response = await fetch(url, {
        headers: REQUEST_HEADERS[kind],
        redirect: 'manual',
        signal: controller.signal
      });

      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        const next = parseTarget(new URL(location, url).toString());
        if (!next) {
          return failure(502, 'It redirected somewhere that is not an http(s) URL.');
        }

        url = next;
        continue;
      }

      if (!response.ok) {
        return failure(502, `It could not be fetched (upstream ${response.status}).`);
      }

      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
      if (!ALLOWED_TYPES[kind].some(allowed => contentType.startsWith(allowed))) {
        return failure(
          415,
          `That URL answered with ${contentType || 'no content type'}, which is not ${kind === 'asset' ? 'an image or media file' : 'data'}.`
        );
      }

      const declared = Number(response.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > maxBytes) {
        return failure(413, 'That response is too large to load in a widget.');
      }

      return {
        ok: true,
        contentType,
        contentLength: Number.isFinite(declared) && declared > 0 ? declared : undefined,
        body: response.body
      };
    }

    return failure(502, 'It redirected too many times.');
  } catch (error) {
    return failure(504, error instanceof Error && error.name === 'AbortError' ? 'It timed out.' : 'unreachable');
  } finally {
    clearTimeout(timer);
  }
};
