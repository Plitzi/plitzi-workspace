/** Static declaration for ListItem: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { ListItemProps } from './ListItem';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ListItemAttributes = AuthorableAttributes<ListItemProps>;

const declaration = elementDeclaration<ListItemAttributes>()({
  type: 'listItem',
  content: {
    attributes: {},
    definition: {
      label: 'List Item',
      description:
        'The List Item element lets you add more items to existing List elements. You can then add any content you would like to them, including links, images, etc.',
      items: []
    },
    builder: {
      itemsNotAllowed: ['listItem']
    },
    market: {
      category: 'structure',
      icon: 'fa-solid fa-grip-lines'
    },
    defaultStyle: {
      style: {
        base: {
          default: {}
        }
      }
    }
  }
});

export default declaration;
