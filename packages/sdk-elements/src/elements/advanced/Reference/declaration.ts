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
      referenceId: ''
    },
    definition: {
      label: 'Reference',
      description: 'Places one of the components of the space, or renders another of its elements by id, in place.',
      items: []
    },
    market: {
      category: 'advanced',
      icon: 'fa-solid fa-asterisk'
    },
    defaultStyle: {
      name: 'Reference Element',
      style: {
        base: {
          default: {}
        }
      }
    }
  }
});

export default declaration;
