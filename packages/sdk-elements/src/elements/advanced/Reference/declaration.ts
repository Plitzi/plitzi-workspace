/** Static declaration for Reference: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { ReferenceProps } from './Reference';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ReferenceAttributes = AuthorableAttributes<ReferenceProps>;

const declaration = elementDeclaration<ReferenceAttributes>()({
  type: 'reference',
  content: {
    attributes: {
      referenceType: 'element',
      referenceId: '',
      referenceContainer: ''
    },
    definition: {
      label: 'Reference',
      type: 'reference',
      description: 'Reuses another element or template by id, rendering it in place.',
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
      itemsNotAllowed: []
    },
    market: {
      category: 'advanced',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-asterisk'
    },
    defaultStyle: {
      name: 'Reference Element',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      }
    },
    settings: {}
  }
});

export default declaration;
