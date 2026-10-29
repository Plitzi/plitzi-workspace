import { serverQueryOf } from '@plitzi/sdk-shared/schema';

import { cappedResponse, fetchOutbound } from '../../helpers/outboundGuard';

import type { RscElementResolver } from './resolveRscData';
import type { HostLookup } from '../../helpers/outboundGuard';

/** What one answer of another site may carry into a page: the same ceiling an action's response has by default. */
export const EXTERNAL_QUERY_MAX_BYTES = 5_000_000;

/**
 * A server provider whose `query` is another site's address, asked by the page server while the page is built — so
 * the page arrives with it, as it does with a connector's or an action's answer, rather than drawing empty and
 * filling in once the browser has asked.
 *
 * Asked as the browser would have asked it — GET, the headers the provider declares — and never with what the browser
 * would have added: no cookie, no credential of the visitor's. Every hop is judged by the rule every authored request
 * is (`fetchOutbound`: no private network, every redirect checked), the answer is held to a ceiling, and the
 * element's own budget aborts it. Answered as a browser request publishes, `{ status, data }`; an answer that is not
 * a success, or not JSON, is the provider's error state — as it is in the browser — with why said.
 */
export const externalQueryResolver = ({
  base = fetch,
  maxBytes = EXTERNAL_QUERY_MAX_BYTES,
  lookup
}: { base?: typeof fetch; maxBytes?: number; lookup?: HostLookup } = {}): RscElementResolver => {
  return async ({ element, signal }) => {
    const query = serverQueryOf(element);
    if (query?.kind !== 'url') {
      return undefined;
    }

    const response = await fetchOutbound(
      base,
      query.url,
      { method: 'GET', headers: { Accept: 'application/json', ...query.headers }, credentials: 'omit', signal },
      lookup
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
