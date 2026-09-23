/** Static declaration for ApiContainer: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { ApiContainerProps } from './ApiContainer';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ApiContainerAttributes = AuthorableAttributes<ApiContainerProps> & {
  /**
   * What this element asks of the action it names, on top of the page's own route and query params.
   *
   * Not a component prop, and it never will be: the action runs on the server, so this is read there and the
   * element only ever sees what came back.
   */
  input?: Record<string, unknown>;
};

const declaration = elementDeclaration<ApiContainerAttributes>()({
  type: 'apiContainer',
  attributeValues: {
    subType: valuesOf<NonNullable<ApiContainerProps['subType']>>()([
      '',
      'div',
      'header',
      'footer',
      'nav',
      'main',
      'section',
      'article',
      'aside',
      'address',
      'figure'
    ]),
    method: valuesOf<NonNullable<ApiContainerProps['method']>>()(['get', 'post', 'put', 'delete', 'patch']),
    credentials: valuesOf<NonNullable<ApiContainerProps['credentials']>>()(['include', 'omit', 'same-origin']),
    pagination: valuesOf<NonNullable<ApiContainerProps['pagination']>>()(['none', 'url', 'append'])
  },
  sourceType: 'apiContainer',
  triggers: {
    onApiError: {
      action: 'onApiError',
      title: 'On Api Error',
      type: 'trigger',
      params: {},
      preview: { url: '', method: '', status: '', data: '' }
    },
    onApiSuccess: {
      action: 'onApiSuccess',
      title: 'On Api Success',
      type: 'trigger',
      params: {},
      preview: { url: '', method: '', status: '', data: '' }
    }
  },
  callbacks: {
    performQuery: { action: 'performQuery', title: 'Perform Query', type: 'callback', preview: {}, params: {} },
    loadMore: { action: 'loadMore', title: 'Load More', type: 'callback', preview: {}, params: {} },
    goToPage: {
      action: 'goToPage',
      title: 'Go To Page',
      type: 'callback',
      preview: {},
      params: { page: { label: 'Page', defaultValue: '1', type: 'text' } }
    },
    // Registered only by a server-driven provider: writes go through the server, which owns the credential.
    writeRecord: {
      action: 'writeRecord',
      title: 'Write Record',
      type: 'callback',
      preview: { action: 'create' },
      params: {
        action: { label: 'Endpoint', defaultValue: 'create', type: 'text' },
        recordId: { label: 'Record Id', defaultValue: '', type: 'text' }
      }
    }
  },
  content: {
    attributes: {
      query: '',
      method: 'get',
      accessToken: '',
      mockData: '{}',
      subType: '',
      credentials: 'same-origin',
      connector: '',
      resource: '',
      limit: '10',
      singleRecord: false,
      filters: [],
      pagination: 'none',
      pageParam: 'page',
      renderWhileLoading: false,
      cache: false,
      staleTime: 30,
      gcTime: 300
    },
    definition: {
      label: 'Api Container',
      type: 'apiContainer',
      description:
        'Fetches data from a backend HTTP API (its `query`/`method`/`credentials`) and exposes the response as a data ' +
        'source ITS DESCENDANTS bind to (source `apiContainer_<id>.data`; only elements inside it can consume it). ' +
        'This is how you get backend data into the frontend. Its `mockData` prop is builder-only sample data — the ' +
        'published runtime fetches the real `query`, so always set a real query for production. With `cache: true` a ' +
        'browser request is kept for `staleTime` seconds (default 30) and shared with every provider asking the same ' +
        'thing; it is off unless set. A flow refreshes it with `performQuery` or the global `invalidateQueries` step, ' +
        'and `refreshSeconds` makes it ask again on its own every N seconds (either runtime; paused while the tab is ' +
        'hidden) — the way to keep a queue, feed or status board current without a plugin. ' +
        'Its `subType` (container tag) is empty by default, and then it renders NO element of its own: its children ' +
        'lay out directly in its parent, and any class, variant or style binding on it applies to nothing. To style ' +
        'the provider itself give it a tag (`subType: "div"`, `section`, …); otherwise style its parent or a child.',
      items: [],
      bindings: {},
      styleSelectors: {
        base: ''
      },
      initialState: {
        visibility: true
      }
    },
    builder: {
      canDelete: true,
      canSelect: true,
      canDragDrop: true,
      canMove: true,
      canTemplate: true,
      itemsAllowed: [],
      itemsNotAllowed: []
    },
    market: {
      category: 'provider',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-server'
    },
    defaultStyle: {
      name: 'Api Container',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      },
      subTypes: {}
    },
    settings: {}
  }
});

export default declaration;
