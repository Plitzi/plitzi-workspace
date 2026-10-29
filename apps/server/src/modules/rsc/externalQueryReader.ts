import { cappedResponse, fetchOutbound } from '../../helpers/outboundGuard';

import type { OutboundOptions } from '../../helpers/outboundGuard';
import type { ServerQuery } from '@plitzi/sdk-shared/schema';

/** What one answer of another site may carry into a page: the same ceiling an action's response has by default. */
export const EXTERNAL_QUERY_MAX_BYTES = 5_000_000;

/** Reads one server provider's query that is another site's address: `{ status, data }`, or why not. */
export type ExternalQueryReader = (
  query: Extract<ServerQuery, { kind: 'url' }>,
  signal: AbortSignal
) => Promise<{ status: number; data: unknown }>;

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
 */
export const externalQueryReader = ({
  base = fetch,
  maxBytes = EXTERNAL_QUERY_MAX_BYTES,
  outbound
}: { base?: typeof fetch; maxBytes?: number; outbound?: OutboundOptions } = {}): ExternalQueryReader => {
  return async (query, signal) => {
    const response = await fetchOutbound(
      base,
      query.url,
      { method: 'GET', headers: { Accept: 'application/json', ...query.headers }, credentials: 'omit', signal },
      outbound
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
