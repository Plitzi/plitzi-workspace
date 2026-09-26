import {
  apiContainer,
  authorSpace,
  button,
  container,
  invalidateQueries,
  onClick,
  paragraph,
  singlePageSpace,
  toggleState
} from '@plitzi/sdk-authoring';

import type { AuthoredSpace } from '@plitzi/sdk-authoring';

/**
 * A browser-side provider behind a panel that opens and closes, and a button that says the data behind it changed.
 *
 * The panel is the shape tabs and steps are built with: a hidden provider stays mounted and stops asking, and
 * showing it again is exactly the moment it used to ask the API again. The request goes to a path the spec answers
 * itself, so it can count them.
 */

export const QUERY_IDS = {
  page: 'queries-page',
  toggle: 'queries-toggle',
  invalidate: 'queries-invalidate',
  panel: 'queries-panel',
  provider: 'queries-provider',
  title: 'queries-title'
};

/** Where the provider asks. Relative, so it goes to whatever origin the page is served from. */
export const ORDERS_PATH = '/__e2e/orders';

export type QuerySpaceOptions = {
  /** Whether the provider keeps its answers in the query cache. Off, as a provider is unless its author opts in. */
  cache?: boolean;
  /** Seconds an answer is fresh, as the builder stores them. */
  staleTime?: number | string;
};

export const querySpace = ({ cache = false, staleTime = 30 }: QuerySpaceOptions = {}): AuthoredSpace =>
  authorSpace(
    singlePageSpace(
      [
        button({
          id: QUERY_IDS.toggle,
          content: 'Toggle orders',
          flows: [[onClick(), toggleState({ key: 'showOrders' })]]
        }),
        button({
          id: QUERY_IDS.invalidate,
          content: 'Orders changed',
          // By the container's id: the way a flow names a request whose URL is a template.
          flows: [[onClick(), invalidateQueries({ elements: [QUERY_IDS.provider] })]]
        }),
        // Starts hidden, like a panel nobody has opened: it is shown only once the state says so.
        container({
          id: QUERY_IDS.panel,
          visible: 'state.showOrders',
          children: [
            apiContainer({
              id: QUERY_IDS.provider,
              query: ORDERS_PATH,
              method: 'get',
              subType: 'section',
              cache,
              staleTime,
              children: [paragraph('', { id: QUERY_IDS.title, bind: { content: `${QUERY_IDS.provider}.data.title` } })]
            })
          ]
        })
      ],
      { name: 'queries', permanentUrl: 'queries', page: { id: QUERY_IDS.page, name: 'Queries' } }
    )
  );
