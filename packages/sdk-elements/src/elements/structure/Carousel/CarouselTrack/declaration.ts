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
      type: 'carouselTrack',
      description: 'Where a carousel shows its slides: what is inside is one slide, rendered once per item.',
      items: [],
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
      canSnippet: false,
      itemsAllowed: [],
      itemsNotAllowed: []
    },
    market: {
      category: 'structure',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-film'
    },
    defaultStyle: {
      name: 'Carousel Track',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      }
    },
    settings: {}
  }
});

export default declaration;
