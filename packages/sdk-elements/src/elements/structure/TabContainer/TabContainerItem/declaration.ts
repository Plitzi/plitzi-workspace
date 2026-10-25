/** Static declaration for TabContainerItem: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';

import type { TabContainerItemProps } from './TabContainerItem';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type TabContainerItemAttributes = AuthorableAttributes<
  TabContainerItemProps,
  'baseId' | 'tabSelected' | 'tabIndex' | 'tabCount' | 'isHeader' | 'onSelect'
>;

const declaration = elementDeclaration<TabContainerItemAttributes>()({
  type: 'tabContainerItem',
  marks: {
    'role="tab"':
      'in the header, with `aria-controls` its panel; in the body it is `role="tabpanel"`, `hidden` while not on show',
    'aria-selected':
      'on the open tab — what a class’s `current` state lights (`states: { current: { … } }`); `active` is the press, never the open tab',
    '.active': 'on the open tab too, the class the component adds',
    tabindex: 'roving: 0 on the open tab, -1 on the rest — the arrow keys move between them'
  },
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
