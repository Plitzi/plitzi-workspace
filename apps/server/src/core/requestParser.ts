import type { SSRRequest, SSRHeaders } from '../types';
import type { IncomingMessage } from 'node:http';

export const parseRequest = (raw: IncomingMessage): SSRRequest => {
  const headers = raw.headers as SSRHeaders;

  const authorityRaw = headers[':authority'] ?? headers['host'] ?? '';
  const hostname = authorityRaw.split(':')[0] ?? '';

  const scheme = headers[':scheme'];
  const forwarded = headers['x-forwarded-proto'] as string | undefined;
  const encrypted =
    !scheme && !forwarded && 'encrypted' in raw.socket && (raw.socket as { encrypted?: boolean }).encrypted === true;
  const protocol: 'http' | 'https' = scheme === 'https' || forwarded === 'https' || encrypted ? 'https' : 'http';

  const rawUrl = headers[':path'] ?? raw.url ?? '/';
  const qIndex = rawUrl.indexOf('?');
  const path = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
  const search = qIndex === -1 ? '' : rawUrl.slice(qIndex);

  const query: Record<string, string> = {};
  if (search) {
    const sp = new URLSearchParams(search.slice(1));
    for (const [k, v] of sp.entries()) {
      query[k] = v;
    }
  }

  const method = (headers[':method'] ?? raw.method ?? 'GET').toUpperCase();

  return { method, path, search, url: rawUrl, hostname, protocol, headers, query };
};
