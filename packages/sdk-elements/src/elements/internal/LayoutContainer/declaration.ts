/** Static declaration for LayoutContainer: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../authoring/declare';

import type { LayoutContainerProps } from './LayoutContainer';
import type { AuthorableAttributes } from '../../../authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type LayoutContainerAttributes = AuthorableAttributes<LayoutContainerProps>;

const declaration = elementDeclaration<LayoutContainerAttributes>()({
  type: 'layoutContainer',
  content: {
    attributes: {
      subType: 'div'
    },
    definition: {
      label: 'Layout Container',
      type: 'layoutContainer',
      description: 'A reusable layout shell (header/footer chrome) shared across pages.',
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
      canDragDrop: false,
      canMove: true,
      canTemplate: true,
      itemsAllowed: [],
      itemsNotAllowed: []
    },
    market: {
      category: 'internal',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-border-all'
    },
    defaultStyle: {
      name: 'Layout Container',
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
