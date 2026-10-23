import { useCallback, useEffect, useRef } from 'react';

import { rowEdges, slideStep } from '../../../carouselIndex';
import CarouselSlide from '../CarouselSlide';

import type { CarouselEdges } from '../../../carouselIndex';
import type { ReactNode, RefObject } from 'react';

export type ScrollTrackProps = {
  source: string;
  items: unknown[];
  keys: readonly (string | number)[];
  scrollerRef: RefObject<HTMLDivElement | null>;
  onScrolledTo: (index: number, edges: CarouselEdges) => void;
  children?: ReactNode;
};

/**
 * A row a visitor swipes, snapping to each slide; it tells the carousel which slide it is showing and where the row
 * stands — at an end, how many slides it shows — as it scrolls, as it opens and as its box changes size.
 */
const ScrollTrack = ({ source, items, keys, scrollerRef, onScrolledTo, children }: ScrollTrackProps) => {
  const frame = useRef(0);

  // Read once per frame: a scroll fires far more often than a slide can change.
  const handleScroll = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      const step = scroller ? slideStep(scroller) : 0;
      if (scroller && step > 0) {
        onScrolledTo(Math.round(scroller.scrollLeft / step), rowEdges(scroller));
      }
    });
  }, [scrollerRef, onScrolledTo]);

  // Before any scroll: a row that fits whole is at both ends, one wider than its box only at its start.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return undefined;
    }

    handleScroll();
    const observer = new ResizeObserver(handleScroll);
    observer.observe(scroller);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [scrollerRef, handleScroll, items.length]);

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
