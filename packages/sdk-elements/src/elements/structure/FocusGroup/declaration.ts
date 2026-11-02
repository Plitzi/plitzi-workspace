/** Static declaration for FocusGroup: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring';

import type { FocusGroupProps } from './FocusGroup';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type FocusGroupAttributes = AuthorableAttributes<FocusGroupProps>;

const declaration = elementDeclaration<FocusGroupAttributes>()({
  type: 'focusGroup',
  attributeValues: {
    subType: valuesOf<NonNullable<FocusGroupProps['subType']>>()(['div', 'nav', 'section'])
  },
  content: {
    attributes: {
      subType: 'div'
    },
    definition: {
      label: 'Focus Group',
      description:
        'A box whose controls the arrow keys move through: up and down between them, left and right to the first of ' +
        'the next or previous list, down from a text field inside into them. For a search palette, a menu, a set of ' +
        'options — what someone goes through with the keyboard, which Tab alone took a stop at a time.',
      items: []
    },
    market: {
      category: 'structure',
      icon: 'fa-solid fa-arrows-up-down'
    },
    defaultStyle: {
      style: { base: { default: {} } },
      subTypes: {}
    }
  }
});

export default declaration;
