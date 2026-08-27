/** Static declaration for ApiContainer: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../authoring/declare';

import type { ApiContainerProps } from './ApiContainer';
import type { AuthorableAttributes } from '../../../authoring/declare';

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
  sourceType: 'apiContainer',
  content: {
    attributes: {
      query: '',
      method: 'get',
      accessToken: '',
      mockData: '{}',
      subType: 'div',
      credentials: 'same-origin',
      connector: '',
      resource: '',
      limit: '10',
      singleRecord: false,
      filters: [],
      pagination: 'none',
      pageParam: 'page',
      renderWhileLoading: false
    },
    definition: {
      label: 'Api Container',
      type: 'apiContainer',
      description:
        'Fetches data from a backend HTTP API (its `query`/`method`/`credentials`) and exposes the response as a data ' +
        'source ITS DESCENDANTS bind to (source `apiContainer_<idRef>.data`; only elements inside it can consume it). ' +
        'This is how you get backend data into the frontend. Its `mockData` prop is builder-only sample data — the ' +
        'published runtime fetches the real `query`, so always set a real query for production.',
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
