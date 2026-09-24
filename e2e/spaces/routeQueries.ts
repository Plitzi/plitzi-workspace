import { apiContainer, authorSpace, container, link, on, paragraph, setState, text } from '@plitzi/sdk-authoring';

import type { AuthoredSpace } from '@plitzi/sdk-authoring';

/**
 * A detail page inside a shell, and a way back out of it — the shape a dashboard has.
 *
 * What it is built to catch happens in the commit BETWEEN the two pages: a navigation writes the destination's route
 * params before the outgoing page is replaced, so this provider renders once with `orderId` gone. Attributes keep a
 * token nothing answered, so its URL reads `/__e2e/order/{{orderId}}` for that one render — and both things that can
 * go wrong there are visible from outside: it asks for that URL, and it reports it a success, which runs
 * `onApiSuccess` again against the route it no longer has. The flow writes the order id the way a real one writes the
 * current workspace, so an emptied `lastOrder` back on the home page is that bug and nothing else.
 */

export const ROUTE_QUERY_IDS = {
  shell: 'rq-shell',
  slot: 'rq-slot',
  home: 'rq-home',
  order: 'rq-order',
  toOrder: 'rq-to-order',
  toHome: 'rq-to-home',
  provider: 'rq-provider',
  title: 'rq-title',
  seen: 'rq-seen'
};

/** Where the provider asks, with the order id on the end. Relative, so it goes to whatever origin serves the page. */
export const ROUTE_ORDER_PATH = '/__e2e/route-order';

export const ROUTE_ORDER_ID = '7';

const linkTo = (id: string, href: string, label: string) =>
  link({ id, href, mode: 'internal', target: 'self', children: [text(label, { id: `${id}-label` })] });

/**
 * A shell both pages sit in. With no layout the page is swapped in the same commit that writes the new route params
 * and the outgoing one is simply gone; a shell stays mounted across the navigation and hands its slot the new body
 * afterwards, which is the window this is about. Every dashboard is built this way.
 */
const shell = { id: ROUTE_QUERY_IDS.shell, slot: ROUTE_QUERY_IDS.slot };

export const routeQuerySpace = (): AuthoredSpace =>
  authorSpace({
    name: 'route queries',
    permanentUrl: 'route-queries',
    layouts: [{ id: ROUTE_QUERY_IDS.shell, body: [container({ id: ROUTE_QUERY_IDS.slot })] }],
    pages: [
      {
        id: ROUTE_QUERY_IDS.home,
        name: 'Home',
        slug: '',
        isDefault: true,
        layout: shell,
        body: [
          linkTo(ROUTE_QUERY_IDS.toOrder, `/orders/${ROUTE_ORDER_ID}`, 'Open the order'),
          paragraph('', { id: ROUTE_QUERY_IDS.seen, bind: { content: 'state.lastOrder' } })
        ]
      },
      {
        id: ROUTE_QUERY_IDS.order,
        name: 'Order',
        slug: 'orders/{{orderId}}',
        layout: shell,
        body: [
          apiContainer({
            id: ROUTE_QUERY_IDS.provider,
            query: `${ROUTE_ORDER_PATH}/{{orderId}}`,
            method: 'get',
            subType: 'section',
            // What a detail page does with the record it just loaded: remember which one is being looked at.
            flows: [
              [
                on('onApiSuccess'),
                setState({ key: 'lastOrder', type: 'text', value: '{{ navigation.routeParams.orderId }}' })
              ]
            ],
            children: [
              paragraph('', { id: ROUTE_QUERY_IDS.title, bind: { content: `${ROUTE_QUERY_IDS.provider}.data.title` } })
            ]
          }),
          linkTo(ROUTE_QUERY_IDS.toHome, '/', 'Back home')
        ]
      }
    ]
  });
