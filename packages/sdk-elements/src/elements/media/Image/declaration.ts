/** Static declaration for Image: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { ImageProps } from './Image';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ImageAttributes = AuthorableAttributes<ImageProps>;

const declaration = elementDeclaration<ImageAttributes>()({
  type: 'image',
  attributeValues: {
    fetchPriority: valuesOf<NonNullable<ImageProps['fetchPriority']>>()(['high', 'low', 'auto']),
    loadMode: valuesOf<NonNullable<ImageProps['loadMode']>>()(['auto', 'eager', 'lazy'])
  },
  content: {
    attributes: {
      src: '',
      alt: '',
      decorative: false,
      fetchPriority: 'auto',
      loadMode: 'auto'
    },
    definition: {
      label: 'Image',
      description:
        'Displays an image from a URL. It starts 140px wide and as tall as the picture is for that width (`height: ' +
        'auto`, never wider than where it sits): a class that sets only a `width` or an `aspect-ratio` is obeyed, and ' +
        '`object-fit` decides how the picture fills a box that sets both.'
    },
    market: {
      category: 'media',
      icon: 'fa-solid fa-image'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            display: 'block',
            width: '140px',
            height: 'auto',
            'max-width': '100%'
          }
        }
      }
    }
  }
});

export default declaration;
