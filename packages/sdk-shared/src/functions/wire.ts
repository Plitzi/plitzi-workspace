import { isRecord } from '../helpers/isRecord';

import type { WireBody, WireRequest, WireResponse } from './protocol';

const TEXTUAL = /^(text\/|application\/([\w.+-]*\+)?(json|xml|javascript|x-www-form-urlencoded))/i;

/** A body as the wire carries it: as text when its type says it is text, base64 otherwise. */
export const wireBodyOf = async (body: Body, contentType: string | null): Promise<WireBody | null> => {
  const bytes = Buffer.from(await body.arrayBuffer());
  if (!bytes.length) {
    return null;
  }

  return contentType && TEXTUAL.test(contentType)
    ? { text: bytes.toString('utf8') }
    : { base64: bytes.toString('base64') };
};

export const bodyOf = (body: WireBody | null): string | Uint8Array<ArrayBuffer> | null => {
  if (!body) {
    return null;
  }

  return 'text' in body ? body.text : new Uint8Array(Buffer.from(body.base64, 'base64'));
};

export const wireResponseOf = async (response: Response): Promise<WireResponse> => ({
  status: response.status,
  statusText: response.statusText,
  headers: [...response.headers],
  body: await wireBodyOf(response, response.headers.get('content-type'))
});

export const wireRequestOf = async (request: Request): Promise<WireRequest> => ({
  method: request.method,
  url: request.url,
  headers: [...request.headers],
  body: await wireBodyOf(request, request.headers.get('content-type'))
});

export const responseOf = ({ status, statusText, headers, body }: WireResponse): Response =>
  new Response(bodyOf(body), { status, statusText, headers });

const headerPairsOf = (value: unknown): [string, string][] =>
  Array.isArray(value)
    ? value.flatMap((pair: unknown) =>
        Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string'
          ? [[pair[0], pair[1]] satisfies [string, string]]
          : []
      )
    : [];

const wireBodyFrom = (value: unknown): WireBody | null => {
  const body = isRecord(value) ? value : undefined;

  return body && typeof body.text === 'string'
    ? { text: body.text }
    : body && typeof body.base64 === 'string'
      ? { base64: body.base64 }
      : null;
};

/** An answer that crossed a boundary as a wire response — from a space's code, or from the platform — read, not trusted. */
export const wireResponseFrom = (value: unknown): WireResponse => {
  const answer = isRecord(value) ? value : {};

  return {
    status: typeof answer.status === 'number' && answer.status >= 200 && answer.status <= 599 ? answer.status : 500,
    statusText: typeof answer.statusText === 'string' ? answer.statusText : '',
    headers: headerPairsOf(answer.headers),
    body: wireBodyFrom(answer.body)
  };
};

/** A request that crossed as a wire request, as a web `Request` again — what a route handler outside the sandbox takes. */
export const requestFromWire = (value: unknown): Request => {
  const wire = isRecord(value) ? value : {};
  const method = typeof wire.method === 'string' ? wire.method : 'GET';

  return new Request(typeof wire.url === 'string' ? wire.url : 'http://runtime.invalid/', {
    method,
    headers: headerPairsOf(wire.headers),
    body: method === 'GET' || method === 'HEAD' ? null : bodyOf(wireBodyFrom(wire.body))
  });
};
