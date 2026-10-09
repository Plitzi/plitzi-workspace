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
      description: 'Another page inside this one — a map, a video player, a form — in a frame.'
    },
    market: {
      category: 'media',
      icon: 'fa-solid fa-window-maximize'
    },
    defaultStyle: {
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
    }
  }
});

export default declaration;
