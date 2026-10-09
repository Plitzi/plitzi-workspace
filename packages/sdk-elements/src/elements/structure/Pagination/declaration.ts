/** Static declaration for Pagination: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { PaginationProps } from './Pagination';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type PaginationAttributes = AuthorableAttributes<PaginationProps>;

const declaration = elementDeclaration<PaginationAttributes>()({
  type: 'pagination',
  attributeValues: {
    mode: valuesOf<NonNullable<PaginationProps['mode']>>()(['pages', 'loadMore']),
    target: valuesOf<NonNullable<PaginationProps['target']>>()(['url', 'interaction'])
  },
  triggers: {
    onPageChange: {
      action: 'onPageChange',
      title: 'On Page Change',
      type: 'trigger',
      params: {},
      preview: { page: '1' }
    }
  },
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
      description:
        'Pages through a list. Bind it to a provider page info: in URL mode it writes the page into the address bar so ' +
        'the result stays shareable and indexable, and in load-more mode it announces the next page for the provider ' +
        'to append. Its buttons take a class through their slots: `previous`, `page` (each numbered one — the page ' +
        'shown carries `aria-current="page"`, so the class\'s `current` state dresses it), `next` and `loadMore`; one ' +
        'with nowhere to go is disabled, the `disabled` state.',
      items: [],
      styleSelectors: {
        previous: '',
        page: '',
        next: '',
        loadMore: ''
      }
    },
    market: {
      category: 'structure',
      icon: 'fa-solid fa-ellipsis'
    },
    defaultStyle: {
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
    }
  }
});

export default declaration;
