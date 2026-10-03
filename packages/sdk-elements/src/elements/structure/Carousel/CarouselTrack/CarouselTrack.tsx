/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { use } from 'react';

import CarouselSlide from './components/CarouselSlide';
import MarqueeTrack from './components/MarqueeTrack';
import ScrollTrack from './components/ScrollTrack';
import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';
import CarouselContext from '../CarouselContext';

import type { ReactNode, RefObject } from 'react';

export type CarouselTrackProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  /** What one slide is: rendered once per item, reading the item as `carousel_<id>.item` — as a list row does. */
  children?: ReactNode;
};

/** Where a carousel's slides are, inside it beside its controls: one at a time, a row, or a marquee. */
const CarouselTrack = ({ ref, className = '', children }: CarouselTrackProps) => {
  const carousel = use(CarouselContext);
  const items = carousel?.items ?? [];
  const mode = carousel?.mode;
  const hasItems = items.length > 0;

  return (
    <RootElement ref={ref} className={clsx('plitzi-component__carousel-track', className)}>
      {!carousel && children}
      {carousel && !hasItems && !carousel.live && (
        <div className="carousel__slide--empty">This carousel has no items</div>
      )}
      {carousel && hasItems && mode === 'slide' && (
        <CarouselSlide
          key={String(carousel.keys[carousel.index])}
          source={carousel.source}
          item={items[carousel.index]}
          position={carousel.index}
          count={items.length}
          className={clsx(
            carousel.live && carousel.moved && `carousel__slide--${carousel.transition}-${carousel.direction}`
          )}
        >
          {children}
        </CarouselSlide>
      )}
      {carousel && hasItems && mode === 'scroll' && (
        <ScrollTrack
          source={carousel.source}
          items={items}
          keys={carousel.keys}
          scrollerRef={carousel.scrollerRef}
          onScrolledTo={carousel.onScrolledTo}
        >
          {children}
        </ScrollTrack>
      )}
      {carousel && hasItems && mode === 'marquee' && (
        <MarqueeTrack
          source={carousel.source}
          items={items}
          keys={carousel.keys}
          speed={carousel.speed}
          pauseOnHover={carousel.pauseOnHover}
          live={carousel.live}
        >
          {children}
        </MarqueeTrack>
      )}
    </RootElement>
  );
};

export default withElement(CarouselTrack);

export { CarouselTrack };
