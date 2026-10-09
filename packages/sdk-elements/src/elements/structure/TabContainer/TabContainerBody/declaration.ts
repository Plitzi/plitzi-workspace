/** Static declaration for TabContainerBody: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { TabContainerBodyProps } from './TabContainerBody';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type TabContainerBodyAttributes = AuthorableAttributes<TabContainerBodyProps>;

const declaration = elementDeclaration<TabContainerBodyAttributes>()({
  type: 'tabContainerBody',
  ancestorType: 'tabContainer',
  content: {
    attributes: {},
    definition: {
      label: 'Tab Container Body',
      description: 'The panel area inside a tabContainer that shows the active tab item.',
      items: []
    },
    builder: {
      canDelete: false,
      canDragDrop: false,
      canMove: false,
      canSnippet: false,
      itemsAllowed: ['tabContainerItem']
    },
    market: {
      category: 'structure',
      icon: 'fa-solid fa-table-columns'
    },
    defaultStyle: {
      style: {
        base: {
          default: {}
        }
      },
      subTypes: {}
    }
  },
  initialItems: ['tabContainerItem', 'tabContainerItem', 'tabContainerItem']
});

export default declaration;
