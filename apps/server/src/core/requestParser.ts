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

// Same guard as HOSTNAME_RE, keeping the port — an origin built from a forged Host header must stay inert in the
// URLs and HTML attributes it ends up in.
const AUTHORITY_RE = /^[a-zA-Z0-9.-]{1,253}(?::\d{1,5})?$/u;

/** The public origin the request was addressed to (proxy-aware via x-forwarded-proto, port included), or an empty
 *  string when the request carries no usable authority. */
export const requestOrigin = (req: SSRRequest): string => {
  const authority = req.headers[':authority'] ?? req.headers['host'] ?? '';

  return AUTHORITY_RE.test(authority) ? `${req.protocol}://${authority}` : '';
};

const headerValue = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? '';

// Node reports IPv4 peers of a dual-stack socket in the IPv4-mapped form; the plain address is what an operator
// greps for.
const unmapIpv4 = (address: string): string =>
  address.startsWith('::ffff:') && address.includes('.') ? address.slice(7) : address;

/** The address the request came from, seen through the proxies a deployment sits behind: Cloudflare states the
 *  peer it accepted in `cf-connecting-ip`, the ingress in `x-real-ip`, and `x-forwarded-for` lists the chain with
 *  the original client first. All three are plain headers a direct client can forge, so this is log/diagnostic
 *  material — never an authorisation input. Falls back to the socket peer, which no client controls. */
export const clientIp = (raw: IncomingMessage, req: SSRRequest): string => {
  const forwardedFor = headerValue(req.headers['x-forwarded-for']).split(',')[0] ?? '';
  const address =
    headerValue(req.headers['cf-connecting-ip']) ||
    headerValue(req.headers['x-real-ip']) ||
    forwardedFor.trim() ||
    raw.socket.remoteAddress ||
    '';

  return unmapIpv4(address);
};

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB — login/logout payloads are tiny; cap guards against abuse.

export const readRawBody = (raw: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    raw.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));

        return;
      }

      chunks.push(chunk);
    });
    raw.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    raw.on('error', reject);
  });
