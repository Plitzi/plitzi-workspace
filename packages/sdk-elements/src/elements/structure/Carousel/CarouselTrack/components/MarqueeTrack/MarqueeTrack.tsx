import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import CarouselSlide from '../CarouselSlide';

import type { CSSProperties, ReactNode } from 'react';

export type MarqueeTrackProps = {
  source: string;
  items: unknown[];
  keys: readonly (string | number)[];
  /** Pixels per second. */
  speed: number;
  pauseOnHover: boolean;
  /** In the builder it stands still, one copy of the items. */
  live: boolean;
  children?: ReactNode;
};

type MarqueeStyle = CSSProperties & Record<'--plitzi-marquee-duration', string>;

/**
 * The items scrolling past for ever: drawn twice, the second copy out of reach of readers and the keyboard, so the
 * track moves half its length and starts again with no jump.
 */
const MarqueeTrack = ({ source, items, keys, speed, pauseOnHover, live, children }: MarqueeTrackProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [seconds, setSeconds] = useState<number | undefined>(undefined);

  // Moving at a speed, one lap takes as long as the items are: measured once drawn, and again when they resize.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || speed <= 0) {
      return;
    }

    const measure = () => setSeconds(track.scrollWidth / 2 / speed);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);

    return () => observer.disconnect();
  }, [speed, items.length]);

  const style: MarqueeStyle = { '--plitzi-marquee-duration': `${String(seconds ?? 0)}s` };

  return (
    <div
      ref={trackRef}
      className={clsx('carousel__marquee', {
        'carousel__marquee--running': live && seconds !== undefined,
        'carousel__marquee--pause-on-hover': pauseOnHover
      })}
      style={style}
    >
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
      {live &&
        items.map((item, position) => (
          <CarouselSlide
            key={`copy:${String(keys[position])}`}
            source={source}
            item={item}
            position={position}
            count={items.length}
            copy
          >
            {children}
          </CarouselSlide>
        ))}
    </div>
  );
};

export default MarqueeTrack;
