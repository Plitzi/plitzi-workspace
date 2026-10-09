/** Static declaration for CarouselTrack: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { CarouselTrackProps } from './CarouselTrack';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type CarouselTrackAttributes = AuthorableAttributes<CarouselTrackProps>;

const declaration = elementDeclaration<CarouselTrackAttributes>()({
  type: 'carouselTrack',
  ancestorType: 'carousel',
  content: {
    attributes: {},
    definition: {
      label: 'Carousel Track',
      description: 'Where a carousel shows its slides: what is inside is one slide, rendered once per item.',
      items: []
    },
    builder: {
      canSnippet: false
    },
    market: {
      category: 'structure',
      icon: 'fa-solid fa-film'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            position: 'relative',
            overflow: 'hidden'
          }
        }
      }
    }
  }
});

export default declaration;
