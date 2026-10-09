/** Static declaration for NotFound: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { NotFoundProps } from './NotFound';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type NotFoundAttributes = AuthorableAttributes<NotFoundProps>;

const declaration = elementDeclaration<NotFoundAttributes>()({
  type: 'notFound',
  content: {
    attributes: {},
    definition: {
      label: 'Not Found',
      description: 'The 404 screen shown when no route matches.'
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
          default: {
            display: 'flex',
            'justify-content': 'center',
            'align-items': 'center'
          }
        }
      }
    }
  }
});

export default declaration;
