import type { Element, ElementInteraction, OfflineDataRaw } from '@plitzi/sdk-shared';

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

const PAGE_ID = 'uq-page';

export const UNASKED_IDS = {
  page: PAGE_ID,
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

const element = (
  id: string,
  type: string,
  attributes: Record<string, unknown>,
  extra: Partial<Element['definition']> = {}
): Element => ({
  id,
  attributes,
  definition: {
    label: type,
    type,
    rootId: PAGE_ID,
    parentId: PAGE_ID,
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

/** One click, one global step. */
const clickRuns = (
  buttonId: string,
  step: Pick<ElementInteraction, 'action' | 'elementId' | 'params'>
): Record<string, ElementInteraction> => ({
  trigger: node(buttonId, 'trigger', { type: 'trigger', action: 'onClick', elementId: buttonId, afterNode: 'step' }),
  step: node(buttonId, 'step', { type: 'globalCallback', beforeNode: 'trigger', ...step })
});

/** What a detail view does with the record it just loaded: remember which one is being looked at. */
const rememberOrder: Record<string, ElementInteraction> = {
  trigger: node('remember', 'trigger', {
    type: 'trigger',
    action: 'onApiSuccess',
    elementId: UNASKED_IDS.bound,
    afterNode: 'step'
  }),
  step: node('remember', 'step', {
    type: 'globalCallback',
    action: 'setState',
    elementId: 'state',
    params: { key: 'lastOrder', type: 'text', value: '{{ state.orderId }}' },
    beforeNode: 'trigger'
  })
};

const setOrderId = (buttonId: string, value: string) =>
  clickRuns(buttonId, { action: 'setState', elementId: 'state', params: { key: 'orderId', type: 'text', value } });

export const unaskedQuerySpace = (): OfflineDataRaw =>
  ({
    schema: {
      definition: { name: 'unasked queries', permanentUrl: '' },
      variables: [],
      settings: { customCss: '' },
      pages: [PAGE_ID],
      pageFolders: {},
      flat: {
        [PAGE_ID]: element(
          PAGE_ID,
          'page',
          { slug: '', default: true, name: 'Orders' },
          {
            parentId: undefined,
            items: [UNASKED_IDS.load, UNASKED_IDS.clear, UNASKED_IDS.unresolved, UNASKED_IDS.bound, UNASKED_IDS.seen]
          }
        ),
        [UNASKED_IDS.load]: element(
          UNASKED_IDS.load,
          'button',
          { subType: 'button', content: 'Load the order' },
          { interactions: setOrderId(UNASKED_IDS.load, ORDER_ID) }
        ),
        [UNASKED_IDS.clear]: element(
          UNASKED_IDS.clear,
          'button',
          { subType: 'button', content: 'Leave it' },
          { interactions: setOrderId(UNASKED_IDS.clear, '') }
        ),
        [UNASKED_IDS.unresolved]: element(UNASKED_IDS.unresolved, 'apiContainer', {
          query: `${ORDER_PATH}/{{orderId}}`,
          method: 'get',
          subType: 'section'
        }),
        [UNASKED_IDS.bound]: element(
          UNASKED_IDS.bound,
          'apiContainer',
          { query: '', method: 'get', subType: 'section' },
          {
            items: [UNASKED_IDS.title],
            interactions: rememberOrder,
            bindings: {
              attributes: [
                {
                  id: 'bound-url',
                  source: 'state.orderId',
                  to: 'query',
                  transformers: [
                    { action: 'twigTemplate', params: { template: `{{ source ? '${ORDER_PATH}/' ~ source : '' }}` } }
                  ]
                }
              ]
            }
          }
        ),
        [UNASKED_IDS.title]: element(
          UNASKED_IDS.title,
          'paragraph',
          { content: '' },
          {
            parentId: UNASKED_IDS.bound,
            bindings: {
              attributes: [
                {
                  id: 'title-1',
                  source: `apiContainer_${UNASKED_IDS.bound}.data.title`,
                  to: 'content',
                  transformers: []
                }
              ]
            }
          }
        ),
        [UNASKED_IDS.seen]: element(
          UNASKED_IDS.seen,
          'paragraph',
          { content: '' },
          { bindings: { attributes: [{ id: 'seen-1', source: 'state.lastOrder', to: 'content', transformers: [] }] } }
        )
      }
    },
    style: { cache: '' }
  }) as unknown as OfflineDataRaw;
