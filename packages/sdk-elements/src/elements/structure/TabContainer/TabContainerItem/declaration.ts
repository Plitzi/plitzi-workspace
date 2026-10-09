/** Static declaration for TabContainerItem: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { TabContainerItemProps } from './TabContainerItem';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type TabContainerItemAttributes = AuthorableAttributes<
  TabContainerItemProps,
  'baseId' | 'tabSelected' | 'tabIndex' | 'tabCount' | 'isHeader' | 'onSelect'
>;

const declaration = elementDeclaration<TabContainerItemAttributes>()({
  type: 'tabContainerItem',
  content: {
    attributes: {},
    definition: {
      label: 'Tab Container Item',
      description: 'One selectable tab (trigger + panel) inside a tabContainer.',
      items: []
    },
    builder: {
      itemsNotAllowed: ['tabContainerItem', 'tabContainerHeader', 'tabContainerBody']
    },
    market: {
      category: 'structure',
      icon: 'fa-regular fa-folder'
    },
    defaultStyle: {
      style: {
        base: {
          default: {}
        }
      },
      subTypes: {}
    }
  }
});

export default declaration;
