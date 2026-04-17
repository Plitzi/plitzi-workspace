import type { Http2ServerRequest } from 'node:http2';
import type { IncomingMessage } from 'node:http';
import type { SSRRequest, SSRHeaders } from '../types';

/**
 * Parse an incoming HTTP/1 or HTTP/2 request into a normalised SSRRequest.
 *
 * HTTP/2 uses pseudo-headers (`:authority`, `:path`, `:scheme`, `:method`)
 * instead of the HTTP/1 `Host` header and request-line. We handle both so
 * the rest of the codebase never needs to know which protocol was used.
 */
export const parseRequest = (raw: Http2ServerRequest | IncomingMessage): SSRRequest => {
  const headers = raw.headers as SSRHeaders;

  // ── Authority / hostname ────────────────────────────────────────────────
  // HTTP/2 uses :authority; HTTP/1 uses the Host header.
  const authorityRaw = (headers[':authority'] ?? headers['host'] ?? '') as string;
  const hostname = authorityRaw.split(':')[0] ?? '';

  // ── Protocol ───────────────────────────────────────────────────────────
  // For HTTP/2 the :scheme pseudo-header is reliable.
  // For HTTP/1 we check the x-forwarded-proto header set by a proxy.
  const scheme = headers[':scheme'] ?? headers['x-forwarded-proto'] ?? 'http';
  const protocol: 'http' | 'https' = scheme === 'https' ? 'https' : 'http';

  // ── URL / path / search ────────────────────────────────────────────────
  const rawUrl = headers[':path'] ?? raw.url ?? '/';
  const qIndex = rawUrl.indexOf('?');
  const path = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
  const search = qIndex === -1 ? '' : rawUrl.slice(qIndex);

  // ── Query params ───────────────────────────────────────────────────────
  const query: Record<string, string> = {};
  if (search) {
    const sp = new URLSearchParams(search.slice(1)); // remove leading '?'
    for (const [k, v] of sp.entries()) {
      query[k] = v;
    }
  }

  // ── Method ─────────────────────────────────────────────────────────────
  const method = (headers[':method'] ?? raw.method ?? 'GET').toUpperCase();

  return {
    method,
    path,
    search,
    url: rawUrl,
    hostname,
    protocol,
    headers,
    query,
    // Http2ServerRequest exposes a `stream` property; IncomingMessage does not.
    stream: 'stream' in raw ? (raw as Http2ServerRequest).stream : undefined
  };
};
