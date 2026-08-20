import { renderTaskParams } from './helpers';

import type { ActionTask } from '../types';

const BODYLESS = ['GET', 'HEAD'];

/**
 * Hosts a server action may never call.
 *
 * The endpoint runs inside the cluster, so an authored URL is a request issued from a trusted network position:
 * without this, `http://169.254.169.254/` reads the instance's cloud credentials and `http://localhost:6379`
 * talks to Redis. Literal forms are what an authored document can hold, and they are what this refuses.
 *
 * What it does NOT stop is a hostname that RESOLVES to a private address — that needs resolve-then-connect, which
 * belongs in the transport and not in a string check. Stated rather than implied, so nobody reads this as complete.
 */
const isBlockedHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host === '::1') {
    return true;
  }

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) {
    // Unique-local IPv6 (fc00::/7) and link-local (fe80::/10).
    return /^f[cd]/.test(host) || host.startsWith('fe8') || host.startsWith('fe9') || /^fe[ab]/.test(host);
  }

  const [a = 0, b = 0] = ipv4.slice(1).map(part => Number.parseInt(part, 10));

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
};

const parseJsonParam = (value: unknown, label: string): Record<string, unknown> => {
  if (value === undefined || value === '') {
    return {};
  }

  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== 'string') {
    throw new Error(`${label} is not valid JSON`);
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
};

type HttpRequestParams = {
  url: string;
  method: string;
  headers: string;
  body: string;
  /** Identifier of the credential whose values this call may interpolate as `{{credential.<key>}}`. */
  credential: string;
};

/**
 * An outbound HTTP call with credentials resolved server-side.
 *
 * The successor to the `webHook` interaction utility, which runs this in the BROWSER with a token that — when it
 * is typed rather than bound — was persisted in the schema and shipped to every visitor (RFC 0008 §4.3.1).
 *
 * Here the token never leaves the server, and it never leaves this STEP either: `credential` names it, and its
 * values are in scope only while these params render. Nothing else in the flow can see it.
 */
const request: ActionTask<HttpRequestParams> = {
  namespace: 'http',
  action: 'request',
  title: 'HTTP Request',
  // The params carry `{{credential.*}}` tokens that only this task can resolve, so it renders them itself.
  rawParams: true,
  params: {
    credential: { type: 'text', canBind: true, defaultValue: '', label: 'Credential' },
    url: { type: 'text', canBind: true, defaultValue: '', label: 'URL' },
    method: {
      type: 'select',
      defaultValue: 'GET',
      label: 'Method',
      options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'PATCH', value: 'PATCH' },
        { label: 'DELETE', value: 'DELETE' }
      ]
    },
    headers: { type: 'codemirror-json', canBind: true, defaultValue: '{}', label: 'Headers' },
    body: {
      type: 'codemirror-json',
      canBind: true,
      defaultValue: '',
      label: 'Body',
      when: params => params.method !== 'GET'
    }
  },
  run: async (raw, ctx) => {
    // Rendered here, not by the runner: `{{credential.*}}` only exists inside this step's own scope.
    const params = await renderTaskParams(raw, ctx, raw.credential || undefined);
    const method = (params.method || 'GET').toUpperCase();
    let url: URL;
    try {
      url = new URL(params.url);
    } catch {
      throw new Error('Request URL is not a valid absolute URL');
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error(`Request protocol "${url.protocol}" is not allowed`);
    }

    if (isBlockedHost(url.hostname)) {
      throw new Error('Request host is not allowed');
    }

    const headers = Object.entries(parseJsonParam(params.headers, 'Headers')).reduce<Record<string, string>>(
      (acum, [key, value]) => {
        acum[key] = typeof value === 'string' ? value : JSON.stringify(value);

        return acum;
      },
      {}
    );

    const hasBody = !BODYLESS.includes(method) && params.body !== '';
    if (hasBody && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await ctx.fetch(url.toString(), {
      method,
      headers,
      body: hasBody ? JSON.stringify(parseJsonParam(params.body, 'Body')) : undefined,
      signal: ctx.signal
    });

    const text = await response.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      // A non-JSON body is a legitimate answer; the raw text stays available to later nodes.
    }

    return { status: response.status, ok: response.ok, data };
  }
};

export const httpTasks = [request] as ActionTask<Record<string, unknown>>[];
export { isBlockedHost };
