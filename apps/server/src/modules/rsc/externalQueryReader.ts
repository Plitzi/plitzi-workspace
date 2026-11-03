import http from 'node:http';
import https from 'node:https';

import { cappedResponse, fetchOutbound } from '../../helpers/outboundGuard';

import type { OutboundOptions } from '../../helpers/outboundGuard';
import type { Environment, SSRRequest, SSRVisitorCredentialsConfig } from '@plitzi/sdk-shared';
import type { ServerQuery } from '@plitzi/sdk-shared/schema';

/** What one answer of another site may carry into a page: the same ceiling an action's response has by default. */
export const EXTERNAL_QUERY_MAX_BYTES = 5_000_000;

/** Who asks: the page request a provider asking as the visitor carries the cookies of, and the space it is for. */
export type ExternalQueryAsker = { req: SSRRequest; spaceId: number; environment: Environment };

/** Reads one server provider's query that is another site's address: `{ status, data }`, or why not. */
export type ExternalQueryReader = (
  query: Extract<ServerQuery, { kind: 'url' }>,
  signal: AbortSignal,
  asker: ExternalQueryAsker
) => Promise<{ status: number; data: unknown }>;

/** The deployment's `rsc.visitorCredentials`, refused at boot when an origin is not one rather than at every visit. */
type VisitorCredentials = {
  origins: ReadonlySet<string>;
  via: ReadonlyMap<string, URL>;
  cookies?: ReadonlySet<string>;
  spaces?: SSRVisitorCredentialsConfig['spaces'];
};

const originOf = (value: string, field: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`rsc.visitorCredentials.${field}: "${value}" is not an origin — write it as https://host:port`);
  }

  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.origin !== value.replace(/\/$/, '')) {
    throw new Error(`rsc.visitorCredentials.${field}: "${value}" is not an origin — write it as https://host, no path`);
  }

  return url.origin;
};

export const visitorCredentialsOf = (
  config: SSRVisitorCredentialsConfig | undefined
): VisitorCredentials | undefined => {
  if (!config) {
    return undefined;
  }

  const origins = new Set(config.origins.map(origin => originOf(origin, 'origins')));
  const via = new Map(
    Object.entries(config.via ?? {}).map(([from, to]) => {
      const origin = originOf(from, 'via');
      if (!origins.has(origin)) {
        throw new Error(`rsc.visitorCredentials.via: "${from}" is not one of its origins — name it there first`);
      }

      return [origin, new URL(originOf(to, 'via'))] as const;
    })
  );

  return { origins, via, ...(config.cookies ? { cookies: new Set(config.cookies) } : {}), spaces: config.spaces };
};

/**
 * A request to the deployment's API where this server reaches it (`via`), addressed as the public edge delivers it: to
 * its public host, `https`, from the visitor's address — what the API reads the session's name and the visit from.
 * `fetch` sends the host it connects to whatever `Host` it is given, so the hop is made with `node:http`.
 */
const throughFetch =
  (publicUrl: URL, visitorIp: string | undefined): typeof fetch =>
  (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const headers: http.OutgoingHttpHeaders = Object.fromEntries(new Headers(init.headers).entries());
    headers.host = publicUrl.host;
    headers['x-forwarded-host'] = publicUrl.host;
    headers['x-forwarded-proto'] = publicUrl.protocol.slice(0, -1);
    if (visitorIp) {
      headers['x-forwarded-for'] = visitorIp;
    }

    return new Promise<Response>((resolve, reject) => {
      const request = (url.protocol === 'https:' ? https : http).request(
        url,
        { method: init.method ?? 'GET', headers, ...(init.signal ? { signal: init.signal } : {}) },
        answer => {
          const status = answer.statusCode ?? 502;
          const answered = new Headers();
          Object.entries(answer.headers).forEach(([name, value]) => {
            (Array.isArray(value) ? value : value === undefined ? [] : [value]).forEach(one => {
              answered.append(name, one);
            });
          });
          // A status that carries no body is answered with none: `Response` refuses one. Read as it streams, so the
          // reader's ceiling (`cappedResponse`) cuts an answer off rather than one held whole first.
          const body =
            status === 204 || status === 304
              ? null
              : new ReadableStream<Uint8Array>({
                  start: controller => {
                    answer.on('data', (chunk: Buffer) => {
                      controller.enqueue(new Uint8Array(chunk));
                    });
                    answer.on('end', () => {
                      controller.close();
                    });
                    answer.on('error', error => {
                      controller.error(error);
                    });
                  },
                  cancel: () => {
                    answer.destroy();
                  }
                });
          resolve(new Response(body, { status, headers: answered }));
        }
      );
      request.on('error', reject);
      request.end();
    });
  };

/** The page request's cookies a provider carries: the ones named, or every one when none are. */
const cookieOf = (header: string | undefined, names: ReadonlySet<string> | undefined): string | undefined => {
  if (!header) {
    return undefined;
  }

  if (!names) {
    return header;
  }

  const kept = header
    .split(';')
    .map(pair => pair.trim())
    .filter(pair => names.has(pair.slice(0, pair.indexOf('=') === -1 ? pair.length : pair.indexOf('='))));

  return kept.length > 0 ? kept.join('; ') : undefined;
};

/**
 * A server provider whose `query` is another site's address, asked by the page server while the page is built — so
 * the page arrives with it, as it does with a connector's or an action's answer, rather than drawing empty and
 * filling in once the browser has asked.
 *
 * Asked as the browser would have asked it — GET, the headers the provider declares — and never with what the browser
 * would have added: no cookie, no credential of the visitor's. Every hop is judged by the rule every authored request
 * is (`fetchOutbound`: no private network but the origins the deployment names as its own, every redirect checked),
 * the answer is held to a ceiling, and the element's own budget aborts it. Answered as a browser request publishes,
 * `{ status, data }`; an answer that is not a success, or not JSON, is the provider's error state — as it is in the
 * browser — with why said.
 *
 * But one that says `credentials: 'include'` is asked as the visitor, with their cookies, where the deployment allows
 * it (`visitor`): an API it names, from a space it trusts, reached where it says — and the response is marked as read
 * so (`ctx.readAsVisitor`), which keeps it from every cache. A redirect away from that origin drops the cookies, as
 * the Fetch standard drops them. Anywhere else it is refused with what to change, never asked as a stranger: the
 * answer a stranger gets is not the one the page was written for.
 */
export const externalQueryReader = ({
  base = fetch,
  maxBytes = EXTERNAL_QUERY_MAX_BYTES,
  outbound,
  visitor
}: {
  base?: typeof fetch;
  maxBytes?: number;
  outbound?: OutboundOptions;
  visitor?: VisitorCredentials;
} = {}): ExternalQueryReader => {
  const asVisitor = async (
    query: Extract<ServerQuery, { kind: 'url' }>,
    { req, spaceId, environment }: ExternalQueryAsker
  ) => {
    const origin = query.url.origin;
    if (!visitor?.origins.has(origin)) {
      throw new Error(
        `${origin} is not an API this server asks as the visitor (credentials: 'include') — name it in ` +
          "rsc.visitorCredentials.origins, or ask it from the browser (runtime: 'client')"
      );
    }

    if (visitor.spaces && !(await visitor.spaces({ spaceId, environment }))) {
      throw new Error(
        `this space may not ask ${origin} as the visitor (credentials: 'include') — the server does not trust it to ` +
          "(rsc.visitorCredentials.spaces); ask it from the browser (runtime: 'client')"
      );
    }

    const through = visitor.via.get(origin);
    const url = through ? new URL(`${query.url.pathname}${query.url.search}`, through) : query.url;
    const cookie = cookieOf(req.headers.cookie, visitor.cookies);
    // Read as the visitor whether or not they have a session: what a stranger is answered is theirs alone too.
    req.ctx.readAsVisitor = true;

    return {
      url,
      base: through ? throughFetch(query.url, req.ip) : base,
      headers: { ...(cookie ? { Cookie: cookie } : {}) },
      // The deployment named where it reaches its own API: that origin is open to this request alone.
      outbound: through
        ? { ...outbound, privateOrigins: [...(outbound?.privateOrigins ?? []), through.origin] }
        : outbound
    };
  };

  return async (query, signal, asker) => {
    const visit = query.asVisitor ? await asVisitor(query, asker) : undefined;
    const response = await fetchOutbound(
      visit?.base ?? base,
      visit?.url ?? query.url,
      {
        method: 'GET',
        headers: { Accept: 'application/json', ...query.headers, ...visit?.headers },
        credentials: 'omit',
        signal
      },
      visit?.outbound ?? outbound
    );
    const text = await cappedResponse(response, maxBytes, message => new Error(`${query.url.href}: ${message}`)).text();
    if (!response.ok) {
      throw new Error(`${query.url.href} answered ${String(response.status)}`);
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`${query.url.href} did not answer JSON`);
    }

    return { status: response.status, data };
  };
};
