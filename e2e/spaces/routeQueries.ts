import type { Element, ElementInteraction, OfflineDataRaw } from '@plitzi/sdk-shared';

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

const element = (
  id: string,
  rootId: string,
  type: string,
  attributes: Record<string, unknown>,
  extra: Partial<Element['definition']> = {}
): Element => ({
  id,
  attributes,
  definition: {
    label: type,
    type,
    rootId,
    parentId: rootId,
    styleSelectors: { base: id },
    initialState: { visibility: true },
    ...extra
  }
});

const node = (flowId: string, id: string, overrides: Partial<ElementInteraction>): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId,
  enabled: true,
  ...overrides
});

/** What a detail page does with the record it just loaded: remember which one is being looked at. */
const rememberOrder: Record<string, ElementInteraction> = {
  trigger: node('remember', 'trigger', {
    type: 'trigger',
    action: 'onApiSuccess',
    elementId: ROUTE_QUERY_IDS.provider,
    afterNode: 'step'
  }),
  step: node('remember', 'step', {
    type: 'globalCallback',
    action: 'setState',
    elementId: 'state',
    params: { key: 'lastOrder', type: 'text', value: '{{ navigation.routeParams.orderId }}' },
    beforeNode: 'trigger'
  })
};

const link = (id: string, rootId: string, href: string, label: string): Record<string, Element> => ({
  [id]: element(id, rootId, 'link', { href, mode: 'internal', target: 'self' }, { items: [`${id}-label`] }),
  [`${id}-label`]: element(`${id}-label`, rootId, 'text', { content: label }, { parentId: id })
});

const pageAttributes = (slug: string, isDefault: boolean, name: string) => ({
  slug,
  default: isDefault,
  name,
  layout: ROUTE_QUERY_IDS.shell,
  layoutContainer: ROUTE_QUERY_IDS.slot
});

export const routeQuerySpace = (): OfflineDataRaw =>
  ({
    schema: {
      definition: { name: 'route queries', permanentUrl: '' },
      variables: [],
      settings: { customCss: '' },
      pages: [ROUTE_QUERY_IDS.home, ROUTE_QUERY_IDS.order],
      pageFolders: {},
      flat: {
        /**
         * A shell both pages sit in. With no layout the page is swapped in the same commit that writes the new route
         * params and the outgoing one is simply gone; a shell stays mounted across the navigation and hands its slot
         * the new body afterwards, which is the window this is about. Every dashboard is built this way.
         */
        [ROUTE_QUERY_IDS.shell]: element(
          ROUTE_QUERY_IDS.shell,
          ROUTE_QUERY_IDS.shell,
          'layoutContainer',
          { subType: 'div' },
          { parentId: undefined, items: [ROUTE_QUERY_IDS.slot] }
        ),
        [ROUTE_QUERY_IDS.slot]: element(
          ROUTE_QUERY_IDS.slot,
          ROUTE_QUERY_IDS.shell,
          'container',
          { subType: 'div' },
          { parentId: ROUTE_QUERY_IDS.shell, items: [] }
        ),
        [ROUTE_QUERY_IDS.home]: element(
          ROUTE_QUERY_IDS.home,
          ROUTE_QUERY_IDS.home,
          'page',
          pageAttributes('', true, 'Home'),
          { parentId: undefined, items: [ROUTE_QUERY_IDS.toOrder, ROUTE_QUERY_IDS.seen] }
        ),
        ...link(ROUTE_QUERY_IDS.toOrder, ROUTE_QUERY_IDS.home, `/orders/${ROUTE_ORDER_ID}`, 'Open the order'),
        [ROUTE_QUERY_IDS.seen]: element(
          ROUTE_QUERY_IDS.seen,
          ROUTE_QUERY_IDS.home,
          'paragraph',
          { content: '' },
          { bindings: { attributes: [{ id: 'seen-1', source: 'state.lastOrder', to: 'content', transformers: [] }] } }
        ),
        [ROUTE_QUERY_IDS.order]: element(
          ROUTE_QUERY_IDS.order,
          ROUTE_QUERY_IDS.order,
          'page',
          pageAttributes('orders/:orderId', false, 'Order'),
          { parentId: undefined, items: [ROUTE_QUERY_IDS.provider, ROUTE_QUERY_IDS.toHome] }
        ),
        [ROUTE_QUERY_IDS.provider]: element(
          ROUTE_QUERY_IDS.provider,
          ROUTE_QUERY_IDS.order,
          'apiContainer',
          { query: `${ROUTE_ORDER_PATH}/{{orderId}}`, method: 'get', subType: 'section' },
          { items: [ROUTE_QUERY_IDS.title], interactions: rememberOrder }
        ),
        [ROUTE_QUERY_IDS.title]: element(
          ROUTE_QUERY_IDS.title,
          ROUTE_QUERY_IDS.order,
          'paragraph',
          { content: '' },
          {
            parentId: ROUTE_QUERY_IDS.provider,
            bindings: {
              attributes: [
                {
                  id: 'title-1',
                  source: `apiContainer_${ROUTE_QUERY_IDS.provider}.data.title`,
                  to: 'content',
                  transformers: []
                }
              ]
            }
          }
        ),
        ...link(ROUTE_QUERY_IDS.toHome, ROUTE_QUERY_IDS.order, '/', 'Back home')
      }
    },
    style: { cache: '' }
  }) as unknown as OfflineDataRaw;
