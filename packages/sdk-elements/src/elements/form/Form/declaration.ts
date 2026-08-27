/** Static declaration for Form: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { FormProps } from './Form';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type FormAttributes = AuthorableAttributes<FormProps>;

const declaration = elementDeclaration<FormAttributes>()({
  type: 'form',
  // Not `form`: what a form offers its descendants is a record like any other provider's, so it registers under
  // the same source kind and a binding reads `apiContainer_<id>.values`.
  sourceType: 'apiContainer',
  content: {
    attributes: {
      method: 'get',
      actionUrl: '',
      managedByInteractions: false,
      errors: {},
      values: {}
    },
    definition: {
      label: 'Form',
      type: 'form',
      description:
        'A <form> that groups form controls and handles submission; wire its submit through an interaction flow.',
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
      category: 'form',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee'
    },
    defaultStyle: {
      name: 'Form',
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
