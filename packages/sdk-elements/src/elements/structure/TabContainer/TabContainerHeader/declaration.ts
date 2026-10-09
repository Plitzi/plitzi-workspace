/** Static declaration for TabContainerHeader: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { TabContainerHeaderProps } from './TabContainerHeader';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type TabContainerHeaderAttributes = AuthorableAttributes<TabContainerHeaderProps>;

const declaration = elementDeclaration<TabContainerHeaderAttributes>()({
  type: 'tabContainerHeader',
  ancestorType: 'tabContainer',
  content: {
    attributes: {},
    definition: {
      label: 'Tab Container Header',
      description: 'The row of tab triggers inside a tabContainer.',
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
