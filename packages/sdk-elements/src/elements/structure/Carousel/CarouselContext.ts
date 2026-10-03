import { createContext } from 'react';

import type { CarouselDirection } from './carouselIndex';
import type { RefObject } from 'react';

export type CarouselMode = 'slide' | 'marquee' | 'scroll';
export type CarouselTransition = 'slide' | 'fade' | 'none';

/** What a carousel hands the track inside it: the items, where it is, and how it moves. */
export type CarouselContextValue = {
  /** The source the carousel publishes — `carousel_<id>` — which each slide publishes its own item under too. */
  source: string;
  items: unknown[];
  keys: readonly (string | number)[];
  index: number;
  direction: CarouselDirection;
  /** Whether it has moved yet: the slide a page opens on does not animate in. */
  moved: boolean;
  mode: CarouselMode;
  transition: CarouselTransition;
  /** Pixels per second, for a marquee. */
  speed: number;
  pauseOnHover: boolean;
  /** Whether it moves at all: never in the builder, which shows the first slide. */
  live: boolean;
  /** The box a `scroll` carousel scrolls, which `next` and `previous` move. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** A `scroll` carousel reports the slide it scrolled to. */
  onScrolledTo: (index: number) => void;
};

/** Absent outside a carousel: a track on its own renders its children as they are. */
const CarouselContext = createContext<CarouselContextValue | undefined>(undefined);
CarouselContext.displayName = 'CarouselContext';

export default CarouselContext;
