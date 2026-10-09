/** Static declaration for TabContainer: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { TabContainerProps } from './TabContainer';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type TabContainerAttributes = AuthorableAttributes<TabContainerProps>;

const declaration = elementDeclaration<TabContainerAttributes>()({
  type: 'tabContainer',
  content: {
    attributes: {},
    definition: {
      label: 'Tab Container',
      description: 'A tabbed container that switches between panels; composed of header/body/item parts.',
      items: []
    },
    builder: {
      itemsAllowed: ['tabContainerHeader', 'tabContainerBody']
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
  initialItems: ['tabContainerHeader', 'tabContainerBody']
});

export default declaration;
