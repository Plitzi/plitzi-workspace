/** Static declaration for Carousel: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { CarouselProps } from './Carousel';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type CarouselAttributes = AuthorableAttributes<CarouselProps>;

const declaration = elementDeclaration<CarouselAttributes>()({
  type: 'carousel',
  sourceType: 'carousel',
  triggers: {
    onChange: {
      action: 'onChange',
      title: 'On Slide Change',
      type: 'trigger',
      params: {},
      preview: { index: '0', item: {} }
    }
  },
  callbacks: {
    next: { action: 'next', title: 'Next Slide', type: 'callback', params: {}, preview: {} },
    previous: { action: 'previous', title: 'Previous Slide', type: 'callback', params: {}, preview: {} },
    goTo: {
      action: 'goTo',
      title: 'Go To Slide',
      type: 'callback',
      params: { index: { type: 'text', label: 'Index (from 0)', defaultValue: '0', canBind: true } },
      preview: {}
    },
    play: { action: 'play', title: 'Play', type: 'callback', params: {}, preview: {} },
    pause: { action: 'pause', title: 'Pause', type: 'callback', params: {}, preview: {} }
  },
  content: {
    attributes: {
      items: [],
      mode: 'slide',
      autoplay: 0,
      pauseOnHover: true,
      loop: true,
      transition: 'slide',
      speed: 30,
      label: ''
    },
    definition: {
      label: 'Carousel',
      description:
        'Items shown one at a time, scrolled past as a marquee, or swiped as a row — with controls of its own inside.',
      items: []
    },
    market: {
      category: 'structure',
      icon: 'fa-solid fa-images'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            position: 'relative'
          }
        }
      }
    }
  },
  initialItems: ['carouselTrack']
});

export default declaration;
