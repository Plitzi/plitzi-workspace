import type { Element, ElementInteraction, OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * A browser-side provider behind a panel that opens and closes, and a button that says the data behind it changed.
 *
 * The panel is the shape tabs and steps are built with: a hidden provider stays mounted and stops asking, and
 * showing it again is exactly the moment it used to ask the API again. The request goes to a path the spec answers
 * itself, so it can count them.
 */

const PAGE_ID = 'queries-page';

export const QUERY_IDS = {
  page: PAGE_ID,
  toggle: 'queries-toggle',
  invalidate: 'queries-invalidate',
  panel: 'queries-panel',
  provider: 'queries-provider',
  title: 'queries-title'
};

/** Where the provider asks. Relative, so it goes to whatever origin the page is served from. */
export const ORDERS_PATH = '/__e2e/orders';

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

export type QuerySpaceOptions = {
  /** Whether the provider keeps its answers in the query cache. Off, as a provider is unless its author opts in. */
  cache?: boolean;
  /** Seconds an answer is fresh, as the builder stores them. */
  staleTime?: number | string;
};

export const querySpace = ({ cache = false, staleTime = 30 }: QuerySpaceOptions = {}): OfflineDataRaw =>
  ({
    schema: {
      definition: { name: 'queries', permanentUrl: '' },
      variables: [],
      settings: { customCss: '' },
      pages: [PAGE_ID],
      pageFolders: {},
      flat: {
        [PAGE_ID]: element(
          PAGE_ID,
          'page',
          { slug: '', default: true, name: 'Queries' },
          { parentId: undefined, items: [QUERY_IDS.toggle, QUERY_IDS.invalidate, QUERY_IDS.panel] }
        ),
        [QUERY_IDS.toggle]: element(
          QUERY_IDS.toggle,
          'button',
          { subType: 'button', content: 'Toggle orders' },
          {
            interactions: clickRuns(QUERY_IDS.toggle, {
              action: 'toggleState',
              elementId: 'state',
              params: { key: 'showOrders' }
            })
          }
        ),
        [QUERY_IDS.invalidate]: element(
          QUERY_IDS.invalidate,
          'button',
          { subType: 'button', content: 'Orders changed' },
          {
            interactions: clickRuns(QUERY_IDS.invalidate, {
              action: 'invalidateQueries',
              elementId: 'queries',
              params: { url: ORDERS_PATH }
            })
          }
        ),
        [QUERY_IDS.panel]: element(
          QUERY_IDS.panel,
          'container',
          {},
          {
            items: [QUERY_IDS.provider],
            // Starts hidden, like a panel nobody has opened: an absent condition would read as visible.
            initialState: { visibility: false },
            bindings: {
              initialState: [{ id: 'initialState-1', source: 'state.showOrders', to: 'visibility', transformers: [] }]
            }
          }
        ),
        [QUERY_IDS.provider]: element(
          QUERY_IDS.provider,
          'apiContainer',
          { query: ORDERS_PATH, method: 'get', subType: 'section', cache, staleTime },
          { parentId: QUERY_IDS.panel, items: [QUERY_IDS.title] }
        ),
        [QUERY_IDS.title]: element(
          QUERY_IDS.title,
          'paragraph',
          { content: '' },
          {
            parentId: QUERY_IDS.provider,
            bindings: {
              attributes: [
                {
                  id: 'attributes-1',
                  source: `apiContainer_${QUERY_IDS.provider}.data.title`,
                  to: 'content',
                  transformers: []
                }
              ]
            }
          }
        )
      }
    },
    style: { cache: '' }
  }) as unknown as OfflineDataRaw;
