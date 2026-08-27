import { renderTaskParams } from './helpers';
import { assertOutboundAllowed } from '../../../helpers/outboundGuard';

import type { ActionTask } from '../types';

const BODYLESS = ['GET', 'HEAD'];

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
 * is typed rather than bound — was persisted in the schema and shipped to every visitor.
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

    // Protocol, literal address and what the NAME resolves to — one rule, shared with the connector engine, which
    // reaches the outside world on a manifest's say-so exactly as this does on a flow's.
    await assertOutboundAllowed(url);

    const headers = Object.entries(parseJsonParam(params.headers, 'Headers')).reduce<Record<string, string>>(
      (acum, [key, value]) => {
        acum[key] = typeof value === 'string' ? value : JSON.stringify(value);

        return acum;
      },
      {}
    );

    const hasBody = !BODYLESS.includes(method) && params.body !== '';
    // Header names are case-insensitive but this is a plain object, so an author who wrote `content-type` would
    // otherwise get a second one added beside theirs — and which of the two the peer honours is nobody's guess.
    const declaresContentType = Object.keys(headers).some(name => name.toLowerCase() === 'content-type');
    if (hasBody && !declaresContentType) {
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
