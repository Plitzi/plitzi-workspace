import { grantingProxy } from './config';
import { fetchResource } from './fetch';
import { PROXY_PARAM, readGrant } from './grant';
import { rewritablePayload, rewritePayload } from './payload';

import type { ProxyKind, ResourceProxySettings } from './types';
import type { SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';

// An asset is immutable for as long as the grant lasts (the URL names one target and is signed), so the host's
// browser should ask for each picture once. An API answer is the opposite: it is fetched because it changes, and
// a cached one would leave the widget showing yesterday's data.
const CACHE_CONTROL: Record<ProxyKind, string> = {
  asset: 'public, max-age=86400, immutable',
  data: 'no-store'
};

/** Read a response whole, or undefined once it is past the limit. Only a rewritable answer is read this way: it has
 *  to be complete before a URL inside it can be swapped, and an API answer is small — which is exactly why the
 *  streaming path below stays the rule for everything else. */
const readAll = async (body: ReadableStream<Uint8Array>, maxBytes: number): Promise<Buffer | undefined> => {
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let written = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    written += value.byteLength;
    if (written > maxBytes) {
      await reader.cancel();

      return undefined;
    }

    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks);
};

const fail = (res: SSRResponseHelpers, status: number, reason: string): void => {
  res.setStatus(status);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(reason);
};

/** Serve one external resource on behalf of a widget: check the grant this server signed, fetch the target, and
 *  stream it back under this origin — the one the CSP declares. Read-only, credential-free and CORS-open, because
 *  it answers the host's sandboxed iframe: a browser that has no origin of its own and can present nothing. The
 *  grant is what stands in for a caller identity — it is unforgeable, it names one target (or one host, for a
 *  templated API URL), it names the kind, it expires, and it carries the connection that minted it. */
export const handleProxyRequest = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  settings: ResourceProxySettings
): Promise<void> => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (req.method === 'OPTIONS') {
    // A widget's data fetch is a cross-origin XHR, so the browser asks first.
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setStatus(204);
    res.end();

    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fail(res, 405, 'Only GET is served here.');

    return;
  }

  const grant = readGrant(req.query[PROXY_PARAM], settings.secret);
  if (!grant) {
    fail(res, 403, 'This URL is missing a grant, or the one it carries was not issued here or has expired.');

    return;
  }

  const result = await fetchResource(grant.target, grant.kind, settings.maxBytes);
  if (!result.ok) {
    fail(res, result.status, result.reason);

    return;
  }

  res.setStatus(200);
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Cache-Control', CACHE_CONTROL[grant.kind]);
  // Deliberately no Content-Length. The upstream one measures the body as it travelled — gzip'd, most of the time
  // for an API — while what is streamed below is what fetch already decoded, so forwarding it TRUNCATES the
  // response at the compressed size and the widget receives half a JSON document. Chunked instead; the length
  // upstream declared is still used, before this, to reject something too large without reading it.

  if (req.method === 'HEAD' || !result.body) {
    res.end();

    return;
  }

  // An API answer is the one body whose CONTENT is loaded further: the widget binds the URLs inside it into image
  // srcs, and those would be fetched straight from the API's CDN — the origin the host CSP does not declare. So it
  // is read whole and its asset URLs are granted through here too, on the same connection that was granted this
  // response. Everything else streams.
  const rewrites = grant.kind === 'data' && rewritablePayload(result.contentType);
  const payloadProxy = rewrites ? grantingProxy(settings, req, grant.identity) : undefined;
  if (payloadProxy) {
    const body = await readAll(result.body, settings.maxBytes);
    if (!body) {
      fail(res, 413, 'That response is too large to load in a widget.');

      return;
    }

    res.send(rewritePayload(body.toString('utf8'), payloadProxy));

    return;
  }

  const reader = result.body.getReader();
  let written = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      written += value.byteLength;
      // The declared length can be absent or a lie; this is the limit that actually holds, and cutting the stream
      // is the only answer left once bytes are already on the wire.
      if (written > settings.maxBytes) {
        await reader.cancel();
        break;
      }

      res.write(Buffer.from(value));
    }
  } finally {
    res.end();
  }
};
