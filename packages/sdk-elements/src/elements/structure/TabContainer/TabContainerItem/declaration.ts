/** Static declaration for TabContainerItem: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../../authoring/declare';

import type { TabContainerItemProps } from './TabContainerItem';
import type { AuthorableAttributes } from '../../../../authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type TabContainerItemAttributes = AuthorableAttributes<
  TabContainerItemProps,
  'tabSelected' | 'tabIndex' | 'isHeader' | 'onSelect'
>;

const declaration = elementDeclaration<TabContainerItemAttributes>()({
  type: 'tabContainerItem',
  content: {
    attributes: {},
    definition: {
      label: 'Tab Container Item',
      type: 'tabContainerItem',
      description: 'One selectable tab (trigger + panel) inside a tabContainer.',
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
      itemsNotAllowed: ['tabContainerItem', 'tabContainerHeader', 'tabContainerBody']
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
      name: 'Tab Container Item',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      },
      subTypes: {}
    },
    settings: {}
  }
});

export default declaration;
