/** Static declaration for Embed: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { EmbedProps } from './Embed';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type EmbedAttributes = AuthorableAttributes<EmbedProps>;

const declaration = elementDeclaration<EmbedAttributes>()({
  type: 'embed',
  content: {
    attributes: {
      src: '',
      title: '',
      loading: 'lazy'
    },
    definition: {
      label: 'Embed',
      type: 'embed',
      description: 'Another page inside this one — a map, a video player, a form — in a frame.',
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
      canSnippet: true,
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
      icon: 'fa-solid fa-window-maximize'
    },
    defaultStyle: {
      name: 'Embed',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            display: 'block',
            width: '100%',
            'aspect-ratio': '16 / 9',
            'border-top-width': '0px',
            'border-right-width': '0px',
            'border-bottom-width': '0px',
            'border-left-width': '0px'
          }
        }
      }
    },
    settings: {}
  }
});

export default declaration;
