/** Static declaration for TabContainerHeader: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../../authoring/declare';

import type { TabContainerHeaderProps } from './TabContainerHeader';
import type { AuthorableAttributes } from '../../../../authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type TabContainerHeaderAttributes = AuthorableAttributes<TabContainerHeaderProps>;

const declaration = elementDeclaration<TabContainerHeaderAttributes>()({
  type: 'tabContainerHeader',
  content: {
    attributes: {},
    definition: {
      label: 'Tab Container Header',
      type: 'tabContainerHeader',
      description: 'The row of tab triggers inside a tabContainer.',
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
      canDelete: false,
      canSelect: true,
      canDragDrop: false,
      canMove: false,
      canTemplate: false,
      itemsAllowed: ['tabContainerItem'],
      itemsNotAllowed: []
    },
    market: {
      category: 'structure',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-table-columns'
    },
    defaultStyle: {
      name: 'Tab Container Header',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      },
      subTypes: {}
    },
    settings: {}
  },
  initialItems: ['tabContainerItem', 'tabContainerItem', 'tabContainerItem']
});

export default declaration;
