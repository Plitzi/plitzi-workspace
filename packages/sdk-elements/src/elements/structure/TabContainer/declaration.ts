/** Static declaration for TabContainer: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../authoring/declare';

import type { TabContainerProps } from './TabContainer';
import type { AuthorableAttributes } from '../../../authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type TabContainerAttributes = AuthorableAttributes<TabContainerProps>;

const declaration = elementDeclaration<TabContainerAttributes>()({
  type: 'tabContainer',
  content: {
    attributes: {},
    definition: {
      label: 'Tab Container',
      type: 'tabContainer',
      description: 'A tabbed container that switches between panels; composed of header/body/item parts.',
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
      itemsAllowed: ['tabContainerHeader', 'tabContainerBody'],
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
      name: 'Tab Container',
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
  initialItems: ['tabContainerHeader', 'tabContainerBody']
});

export default declaration;
