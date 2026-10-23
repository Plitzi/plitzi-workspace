/** Static declaration for Carousel: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';

import type { CarouselProps } from './Carousel';
import type { InteractionCallbackParam } from '@plitzi/sdk-shared';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type CarouselAttributes = AuthorableAttributes<CarouselProps>;

/**
 * How far a press moves a `scroll` carousel: one slide, or a page — as many as its row shows whole, the way a shop's
 * arrows move a row of cards (lx-controls: one slide a press could not be made a group).
 */
const BY: InteractionCallbackParam = {
  type: 'select',
  label: 'How far',
  defaultValue: 'slide',
  options: [
    { label: 'One slide', value: 'slide' },
    { label: 'A page — as many as it shows', value: 'page' }
  ]
};

const declaration = elementDeclaration<CarouselAttributes>()({
  type: 'carousel',
  sourceType: 'carousel',
  publishes: {
    items: 'Every item it shows, one slide each',
    count: 'How many items it has',
    index: 'The slide it stands at, from 0 (a `scroll` row: the first in view)',
    item: 'The item of that slide',
    playing: 'Whether it moves on by itself now (autoplay, not paused)',
    atStart: 'At its first slide — a `scroll` row at the start of its box; one that loops never is',
    atEnd: 'At its last — a `scroll` row at the end of its box, however many it shows; one that loops never is',
    shown: 'How many slides it shows whole (1 but for a `scroll` row)'
  },
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
    next: { action: 'next', title: 'Next Slide', type: 'callback', params: { by: BY }, preview: {} },
    previous: { action: 'previous', title: 'Previous Slide', type: 'callback', params: { by: BY }, preview: {} },
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
