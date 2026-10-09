/** Static declaration for FontAwesome: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { FontAwesomeProps } from './FontAwesome';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type FontAwesomeAttributes = AuthorableAttributes<FontAwesomeProps>;

const declaration = elementDeclaration<FontAwesomeAttributes>()({
  type: 'fontAwesome',
  content: {
    attributes: {
      icon: 'fas fa-flag',
      size: 'fa-1x',
      iconAnimation: ''
    },
    definition: {
      label: 'Font Awesome',
      description: 'Renders a Font Awesome icon by its icon name.'
    },
    market: {
      category: 'media',
      icon: 'fa-solid fa-font-awesome'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            display: 'inline-block',
            'font-size': '16px'
          }
        }
      }
    }
  }
});

export default declaration;
