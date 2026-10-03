import clsx from 'clsx';
import { Children } from 'react';

import ListControlledItem from '../../../../List/modes/ListControlled/ListControlledItem';

import type { ReactNode } from 'react';

export type CarouselSlideProps = {
  /** The source the slide publishes its item under: the carousel's own. */
  source: string;
  item: unknown;
  position: number;
  count: number;
  /** A marquee's second copy: there to close the loop, not read twice. */
  copy?: boolean;
  className?: string;
  children?: ReactNode;
};

/** One slide: a group a screen reader announces as "3 of 11", reading its item as a list row does. */
const CarouselSlide = ({
  source,
  item,
  position,
  count,
  copy = false,
  className = '',
  children
}: CarouselSlideProps) => {
  const empty = Children.count(children) === 0;

  return (
    <div
      className={clsx('carousel__slide', className)}
      role="group"
      aria-roledescription="slide"
      aria-label={`${String(position + 1)} of ${String(count)}`}
      aria-hidden={copy || undefined}
      inert={copy || undefined}
    >
      {empty && <div className="carousel__slide--empty">{`Slide ${String(position + 1)}`}</div>}
      {!empty && (
        <ListControlledItem index={position} isTemplate={false} record={item} source={source}>
          {children}
        </ListControlledItem>
      )}
    </div>
  );
};

export default CarouselSlide;
