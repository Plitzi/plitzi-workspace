/** Static declaration for ListItem: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../../authoring/declare';

import type { ListItemProps } from './ListItem';
import type { AuthorableAttributes } from '../../../../authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ListItemAttributes = AuthorableAttributes<ListItemProps>;

const declaration = elementDeclaration<ListItemAttributes>()({
  type: 'listItem',
  content: {
    attributes: {},
    definition: {
      label: 'List Item',
      type: 'listItem',
      description:
        'The List Item element lets you add more items to existing List elements. You can then add any content you would like to them, including links, images, etc.',
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
      itemsNotAllowed: ['listItem']
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
      name: 'List Item',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      }
    },
    settings: {}
  }
});

export default declaration;
