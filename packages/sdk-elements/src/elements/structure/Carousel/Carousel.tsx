/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import usePlitzi from '@plitzi/sdk-shared/hooks/usePlitzi';

import CarouselContext from './CarouselContext';
import { clampIndex, directionOf, slideStep, stepIndex } from './carouselIndex';
import declaration from './declaration';
import useAutoplay from './useAutoplay';
import pathFields from '../../../dataSource/pathFields';
import sourceStore from '../../../dataSource/sourceStore';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';
import { rowKeys } from '../List/modes/ListControlled/rowKeys';

import type { CarouselContextValue, CarouselMode, CarouselTransition } from './CarouselContext';
import type { CarouselDirection } from './carouselIndex';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback, InteractionCallbackParamValues } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type CarouselProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  /** What it shows, one slide each — its own, or bound from a source as a list's are. */
  items?: unknown[];
  /** `slide` shows one at a time; `marquee` scrolls them past for ever; `scroll` is a row a visitor swipes. */
  mode?: CarouselMode;
  /** Milliseconds between slides on its own; 0 is none. `slide` only. */
  autoplay?: number;
  /** Holds still under the pointer, for autoplay and a marquee alike. */
  pauseOnHover?: boolean;
  /** After the last slide the first, and before the first the last. */
  loop?: boolean;
  /** How a `slide` carousel changes slide; back enters from the left. */
  transition?: CarouselTransition;
  /** Pixels per second, for a marquee. */
  speed?: number;
  /** The field of each item that names it, as a list's `itemKey`. */
  itemKey?: string;
  /** What the carousel is, for a screen reader: "Featured products". */
  label?: string;
};

const Carousel = ({
  ref,
  className = '',
  children,
  items = [],
  mode = 'slide',
  autoplay = 0,
  pauseOnHover = true,
  loop = true,
  transition = 'slide',
  speed = 30,
  itemKey,
  label = ''
}: CarouselProps) => {
  const {
    id,
    definition: { label: elementLabel = 'Carousel' }
  } = useElement();
  const source = getSourceName(declaration.sourceType, id);
  const {
    settings: { previewMode }
  } = usePlitzi();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  const list = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const keys = useMemo(() => rowKeys(list, itemKey), [list, itemKey]);
  const count = list.length;
  const live = Boolean(previewMode);

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<CarouselDirection>('next');
  const [moved, setMoved] = useState(false);
  const [playing, setPlaying] = useState(autoplay > 0);
  // The node the element renders: the one `withElement` hands down, or one of its own outside it.
  const ownRef = useRef<HTMLElement>(null);
  const rootRef = ref ?? ownRef;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const current = clampIndex(index, count);

  // A carousel whose items shrank under it shows the last one there is rather than nothing.
  useEffect(() => {
    if (index !== current) {
      setIndex(current);
    }
  }, [index, current]);

  const moveTo = useCallback(
    (target: number, towards: CarouselDirection) => {
      if (count === 0 || target === current) {
        return;
      }

      setDirection(towards);
      setMoved(true);
      setIndex(target);
      void interactionsManager.interactionTrigger(id, 'onChange', { index: target, item: list[target] });
    },
    [count, current, id, interactionsManager, list]
  );

  /** A `scroll` carousel moves its box by whole slides, gap included; its index follows what the box shows. */
  const scrollBySlide = useCallback((delta: number) => {
    const scroller = scrollerRef.current;
    const step = scroller ? slideStep(scroller) : 0;
    if (scroller && step > 0) {
      scroller.scrollBy({ left: delta * step, behavior: 'smooth' });
    }
  }, []);

  const next = useCallback(() => {
    if (mode === 'scroll') {
      scrollBySlide(1);

      return;
    }

    moveTo(stepIndex(current, count, 1, loop), 'next');
  }, [count, current, loop, mode, moveTo, scrollBySlide]);

  const previous = useCallback(() => {
    if (mode === 'scroll') {
      scrollBySlide(-1);

      return;
    }

    moveTo(stepIndex(current, count, -1, loop), 'previous');
  }, [count, current, loop, mode, moveTo, scrollBySlide]);

  const goTo = useCallback(
    (params: InteractionCallbackParamValues<{ index?: unknown }>) => {
      const target = clampIndex(params.index, count);
      if (mode === 'scroll') {
        scrollBySlide(target - current);

        return;
      }

      moveTo(target, directionOf(current, target));
    },
    [count, current, mode, moveTo, scrollBySlide]
  );

  const onScrolledTo = useCallback(
    (target: number) => {
      if (target !== current) {
        moveTo(target, directionOf(current, target));
      }
    },
    [current, moveTo]
  );

  useAutoplay({
    delay: mode === 'slide' ? autoplay : 0,
    active: live && playing && count > 1,
    rootRef,
    pauseOnHover,
    position: current,
    onTick: next
  });

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(
    () => ({
      next: { ...declaration.callbacks.next, callback: next },
      previous: { ...declaration.callbacks.previous, callback: previous },
      goTo: { ...declaration.callbacks.goTo, callback: goTo },
      play: { ...declaration.callbacks.play, callback: () => setPlaying(true) },
      pause: { ...declaration.callbacks.pause, callback: () => setPlaying(false) }
    }),
    [goTo, next, previous]
  );

  const published = useMemo(
    () => ({ items: list, count, index: current, item: list[current], playing: playing && autoplay > 0 }),
    [autoplay, count, current, list, playing]
  );
  const sourceFields = useCallback(() => pathFields(published), [published]);
  useRegisterSource({ id, source, name: elementLabel || `Carousel - ${id}`, fields: sourceFields });

  const storeContextValue = useMemo(() => sourceStore(source, published), [source, published]);

  const context = useMemo<CarouselContextValue>(
    () => ({
      source,
      items: list,
      keys,
      index: current,
      direction,
      moved,
      mode,
      transition,
      speed,
      pauseOnHover,
      live,
      scrollerRef,
      onScrolledTo
    }),
    [current, direction, keys, list, live, mode, moved, onScrolledTo, pauseOnHover, source, speed, transition]
  );

  return (
    <RootElement
      ref={rootRef}
      className={clsx('plitzi-component__carousel', `carousel--${mode}`, className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={label || undefined}
      interactionTriggers={declaration.triggers}
      interactionCallbacks={interactionCallbacks}
    >
      <StoreProvider inherit="live" name={`Carousel:${id}`} value={storeContextValue}>
        <CarouselContext value={context}>{children}</CarouselContext>
      </StoreProvider>
    </RootElement>
  );
};

export default withElement(Carousel);

export { Carousel };
