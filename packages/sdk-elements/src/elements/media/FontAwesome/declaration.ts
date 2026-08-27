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
      type: 'fontAwesome',
      description: 'Renders a Font Awesome icon by its icon name.',
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
      category: 'media',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-font-awesome'
    },
    defaultStyle: {
      name: 'Font Awesome',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            display: 'inline-block',
            'font-size': '16px'
          }
        }
      }
    },
    settings: {}
  }
});

export default declaration;
