/** Static declaration for LayoutContainer: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { LayoutContainerProps } from './LayoutContainer';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type LayoutContainerAttributes = AuthorableAttributes<LayoutContainerProps>;

const declaration = elementDeclaration<LayoutContainerAttributes>()({
  type: 'layoutContainer',
  attributeValues: {
    subType: valuesOf<NonNullable<LayoutContainerProps['subType']>>()([
      'div',
      'header',
      'footer',
      'nav',
      'main',
      'section',
      'article',
      'aside',
      'address',
      'figure'
    ])
  },
  content: {
    attributes: {
      subType: 'div'
    },
    definition: {
      label: 'Layout Container',
      description: 'A reusable layout shell (header/footer chrome) shared across pages.',
      items: []
    },
    builder: {
      canDragDrop: false
    },
    market: {
      category: 'internal',
      icon: 'fa-solid fa-border-all'
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
