/** Static declaration for Pagination: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { PaginationProps } from './Pagination';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type PaginationAttributes = AuthorableAttributes<PaginationProps>;

const declaration = elementDeclaration<PaginationAttributes>()({
  type: 'pagination',
  content: {
    attributes: {
      pageInfo: {},
      mode: 'pages',
      target: 'url',
      pageParam: 'page',
      windowSize: 5,
      previousLabel: 'Previous',
      nextLabel: 'Next',
      loadMoreLabel: 'Load more'
    },
    definition: {
      label: 'Pagination',
      type: 'pagination',
      description:
        'Pages through a list. Bind it to a provider page info: in URL mode it writes the page into the address bar so the result stays shareable and indexable, and in load-more mode it announces the next page for the provider to append.',
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
      category: 'structure',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-ellipsis'
    },
    defaultStyle: {
      name: 'Pagination',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            display: 'flex',
            'align-items': 'center',
            // Longhands: the builder's style vocabulary holds no shorthands, so a `gap` here is a default the
            // style editor cannot read back.
            'row-gap': '8px',
            'column-gap': '8px'
          }
        }
      },
      subTypes: {}
    },
    settings: {}
  }
});

export default declaration;
