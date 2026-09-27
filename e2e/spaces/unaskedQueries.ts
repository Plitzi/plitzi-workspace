import {
  apiContainer,
  authorSpace,
  bindTemplate,
  button,
  on,
  onClick,
  paragraph,
  setState,
  singlePageSpace
} from '@plitzi/sdk-authoring';

import type { AuthoredSpace } from '@plitzi/sdk-authoring';

/**
 * Two providers with nothing to ask, which is a state every provider passes through.
 *
 * A URL is a question, and until it resolves there is no question. Attributes are interpolated with the tokens KEPT
 * when nothing answers them, so a URL naming something absent arrives here as the literal `/__e2e/order/{{orderId}}` —
 * and a URL built by a binding arrives empty. Neither is a request, and neither is an answer:
 *
 * - **`unresolved`** names a route param no page here has. It must never be asked for. On the dashboard this was the
 *   commit between two pages — the new route's params are written before the outgoing page is replaced — and the
 *   404s it made were for a page the visitor had already left.
 * - **`bound`** takes its URL from `state.orderId`, so a button empties it while the provider stays mounted. Its last
 *   answer stays on screen, which is what keeps a page from flickering; what must NOT happen is the provider calling
 *   that a success. `onApiSuccess` fires on the URL as much as on the answer, so a second firing runs the flow again
 *   with the state already cleared — and that flow writes the id the rest of the page is keyed by.
 */

export const UNASKED_IDS = {
  page: 'uq-page',
  load: 'uq-load',
  clear: 'uq-clear',
  unresolved: 'uq-unresolved',
  bound: 'uq-bound',
  title: 'uq-title',
  seen: 'uq-seen'
};

/** Where a provider asks, with the order id on the end. Relative, so it goes to whatever origin serves the page. */
export const ORDER_PATH = '/__e2e/order';

export const ORDER_ID = '7';

const setOrderId = (id: string, content: string, value: string) =>
  button({ id, content, flows: [[onClick(), setState({ key: 'orderId', type: 'text', value })]] });

export const unaskedQuerySpace = (): AuthoredSpace =>
  authorSpace(
    singlePageSpace(
      [
        setOrderId(UNASKED_IDS.load, 'Load the order', ORDER_ID),
        setOrderId(UNASKED_IDS.clear, 'Leave it', ''),
        apiContainer({
          id: UNASKED_IDS.unresolved,
          query: `${ORDER_PATH}/{{orderId}}`,
          method: 'get',
          subType: 'section'
        }),
        apiContainer({
          id: UNASKED_IDS.bound,
          method: 'get',
          subType: 'section',
          bind: [bindTemplate('query', 'state.orderId', `{{ source ? '${ORDER_PATH}/' ~ source : '' }}`)],
          // What a detail view does with the record it just loaded: remember which one is being looked at.
          flows: [[on('onApiSuccess'), setState({ key: 'lastOrder', type: 'text', value: '{{ state.orderId }}' })]],
          children: [paragraph('', { id: UNASKED_IDS.title, bind: { content: `${UNASKED_IDS.bound}.data.title` } })]
        }),
        paragraph('', { id: UNASKED_IDS.seen, bind: { content: 'state.lastOrder' } })
      ],
      { name: 'unasked queries', permanentUrl: 'unasked-queries', page: { id: UNASKED_IDS.page, name: 'Orders' } }
    ),
    {
      allow: [
        {
          code: 'template-unknown-name',
          element: UNASKED_IDS.unresolved,
          why: 'the subject: a URL whose token nothing answers must never be asked for'
        }
      ]
    }
  );
