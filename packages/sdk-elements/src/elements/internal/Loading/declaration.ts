/** Static declaration for Loading: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { LoadingProps } from './Loading';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type LoadingAttributes = AuthorableAttributes<LoadingProps>;

const declaration = elementDeclaration<LoadingAttributes>()({
  type: 'loading',
  content: {
    attributes: {},
    definition: {
      label: 'Loading',
      description: 'A loading placeholder shown while data or a suspense boundary resolves.'
    },
    builder: {
      canDragDrop: false
    },
    market: {
      category: 'internal',
      icon: 'https://cdn.plitzi.com/resources/img/favicon.svg'
    },
    defaultStyle: {
      style: {
        base: {
          default: {}
        }
      }
    }
  }
});

export default declaration;
