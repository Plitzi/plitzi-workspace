/** Static declaration for Image: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { ImageProps } from './Image';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ImageAttributes = AuthorableAttributes<ImageProps>;

const declaration = elementDeclaration<ImageAttributes>()({
  type: 'image',
  content: {
    attributes: {
      src: 'https://cdn.plitzi.com/resources/img/placeholder-img.svg',
      alt: '',
      fetchPriority: 'auto',
      loadMode: 'auto'
    },
    definition: {
      label: 'Image',
      type: 'image',
      description: 'Displays an image from a URL.',
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
      icon: 'fa-solid fa-image'
    },
    defaultStyle: {
      name: 'Image',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            display: 'block',
            width: '140px',
            height: '140px'
          }
        }
      }
    },
    settings: {}
  }
});

export default declaration;
