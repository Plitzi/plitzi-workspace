/** Static declaration for TabContainerBody: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { TabContainerBodyProps } from './TabContainerBody';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type TabContainerBodyAttributes = AuthorableAttributes<TabContainerBodyProps>;

const declaration = elementDeclaration<TabContainerBodyAttributes>()({
  type: 'tabContainerBody',
  content: {
    attributes: {},
    definition: {
      label: 'Tab Container Body',
      type: 'tabContainerBody',
      description: 'The panel area inside a tabContainer that shows the active tab item.',
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
      name: 'Tab Container Body',
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
