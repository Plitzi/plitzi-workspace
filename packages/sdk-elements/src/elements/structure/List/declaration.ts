/** Static declaration for List: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { ListProps } from './List';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ListAttributes = AuthorableAttributes<ListProps>;

const declaration = elementDeclaration<ListAttributes>()({
  type: 'list',
  sourceType: 'list',
  content: {
    attributes: {
      items: [],
      source: 'none',
      subType: 'ul'
    },
    definition: {
      label: 'List',
      type: 'list',
      description:
        'Repeats a template (its listItem/link child) once per entry of a data array — the way to render a dynamic ' +
        'collection. Bind its items to a data source (e.g. an apiContainer response).',
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
      icon: 'fa-solid fa-list'
    },
    defaultStyle: {
      name: 'List',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      subTypes: {
        ul: {
          name: 'List UL',
          displayMode: 'desktop',
          style: {
            base: {
              default: {
                'margin-top': '0px',
                'margin-bottom': '10px',
                'padding-left': '40px'
              }
            }
          }
        },
        ol: {
          name: 'List OL',
          displayMode: 'desktop',
          style: {
            base: {
              default: {
                'margin-top': '0px',
                'margin-bottom': '10px',
                'padding-left': '40px'
              }
            }
          }
        }
      }
    },
    settings: {}
  },
  initialItems: ['listItem', 'listItem', 'listItem']
});

export default declaration;
