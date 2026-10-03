import { useCallback, useRef } from 'react';

import { slideStep } from '../../../carouselIndex';
import CarouselSlide from '../CarouselSlide';

import type { ReactNode, RefObject } from 'react';

export type ScrollTrackProps = {
  source: string;
  items: unknown[];
  keys: readonly (string | number)[];
  scrollerRef: RefObject<HTMLDivElement | null>;
  onScrolledTo: (index: number) => void;
  children?: ReactNode;
};

/** A row a visitor swipes, snapping to each slide; it tells the carousel which slide it is showing. */
const ScrollTrack = ({ source, items, keys, scrollerRef, onScrolledTo, children }: ScrollTrackProps) => {
  const frame = useRef(0);

  // Read once per frame: a scroll fires far more often than a slide can change.
  const handleScroll = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      const step = scroller ? slideStep(scroller) : 0;
      if (scroller && step > 0) {
        onScrolledTo(Math.round(scroller.scrollLeft / step));
      }
    });
  }, [scrollerRef, onScrolledTo]);

  return (
    <div ref={scrollerRef} className="carousel__scroller" onScroll={handleScroll}>
      {items.map((item, position) => (
        <CarouselSlide
          key={String(keys[position])}
          source={source}
          item={item}
          position={position}
          count={items.length}
        >
          {children}
        </CarouselSlide>
      ))}
    </div>
  );
};

export default ScrollTrack;
