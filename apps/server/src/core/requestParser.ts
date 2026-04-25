import type { SSRRequest, SSRHeaders } from '@plitzi/sdk-shared';
import type { IncomingMessage } from 'node:http';

// Only allow valid hostname characters — prevents header injection via Host header.
const HOSTNAME_RE = /^[a-zA-Z0-9.-]{1,253}$/u;

export const parseRequest = (raw: IncomingMessage): SSRRequest => {
  const headers = raw.headers as SSRHeaders;

  const authorityRaw = headers[':authority'] ?? headers['host'] ?? '';
  const rawHostname = authorityRaw.split(':')[0] ?? '';
  const hostname = HOSTNAME_RE.test(rawHostname) ? rawHostname : '';

  const scheme = headers[':scheme'];
  const forwarded = headers['x-forwarded-proto'] as string | undefined;
  const encrypted =
    !scheme && !forwarded && 'encrypted' in raw.socket && (raw.socket as { encrypted?: boolean }).encrypted === true;
  const protocol: 'http' | 'https' = scheme === 'https' || forwarded === 'https' || encrypted ? 'https' : 'http';

  const rawUrl = headers[':path'] ?? raw.url ?? '/';
  const qIndex = rawUrl.indexOf('?');
  const rawPath = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
  // Null bytes in the path are never valid — flag the request so the handler can reject it.
  const path = rawPath.includes('\0') ? '\0' : rawPath;
  const search = qIndex === -1 ? '' : rawUrl.slice(qIndex);

  const query: Record<string, string> = {};
  if (search) {
    const sp = new URLSearchParams(search.slice(1));
    for (const [k, v] of sp.entries()) {
      query[k] = v;
    }
  }

  const method = (headers[':method'] ?? raw.method ?? 'GET').toUpperCase();

  return { method, path, search, url: rawUrl, hostname, protocol, headers, query, ctx: {} };
};
