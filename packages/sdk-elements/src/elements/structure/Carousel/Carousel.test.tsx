import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { Carousel } from './Carousel';
import { CarouselTrack } from './CarouselTrack/CarouselTrack';
import useElementDataSource from '../../../Element/hooks/useElementDataSource';

import type { CarouselProps } from './Carousel';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

// What the carousel hands its root: the callbacks a flow calls, kept so a test can call them as a flow would.
const handed = vi.hoisted((): { callbacks: Record<string, InteractionCallback> } => ({ callbacks: {} }));
const { interactionTrigger } = vi.hoisted(() => ({ interactionTrigger: vi.fn() }));
const preview = vi.hoisted(() => ({ on: true }));

vi.mock('../../../Element/RootElement', () => ({
  default: ({
    children,
    interactionCallbacks
  }: {
    children?: ReactNode;
    interactionCallbacks?: Record<string, InteractionCallback>;
  }) => {
    if (interactionCallbacks) {
      handed.callbacks = interactionCallbacks;
    }

    return <div>{children}</div>;
  }
}));

vi.mock('../../../Element/hooks/useElement', () => ({
  default: () => ({ id: 'hero', definition: { label: 'Hero' } })
}));

vi.mock('@plitzi/sdk-shared/dataSource/hooks/useRegisterSource', () => ({ default: () => undefined }));

vi.mock('@plitzi/sdk-shared/hooks/usePlitzi', () => ({ default: () => ({ settings: { previewMode: preview.on } }) }));

vi.mock('@plitzi/sdk-interactions/InteractionsContext', async () => {
  const { createContext } = await import('react');
  const manager = { createChildManager: () => manager, removeChildManager: () => undefined, interactionTrigger };

  return { default: createContext({ interactionsManager: manager }) };
});

// jsdom has no layout, and so no `ResizeObserver`: the marquee measures nothing here, which is all these tests need.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  }
);

type Slide = { id: string; title: string };

const SLIDES: Slide[] = [
  { id: 'a', title: 'First' },
  { id: 'b', title: 'Second' },
  { id: 'c', title: 'Third' }
];

/** What one slide shows: its own item, read as `carousel_hero.item`, as a binding would. */
const SlideTitle = () => {
  const sources = useElementDataSource({ sources: ['carousel_hero'] });
  const slide = sources.carousel_hero as { item?: Slide } | undefined;

  return <span data-testid="slide">{slide?.item?.title}</span>;
};

/** What a control outside the track reads: where the carousel is. */
const Position = () => {
  const sources = useElementDataSource({ sources: ['carousel_hero'] });
  const carousel = sources.carousel_hero as { index?: number; count?: number } | undefined;

  return (
    <span data-testid="position">{`${String((carousel?.index ?? 0) + 1)} of ${String(carousel?.count ?? 0)}`}</span>
  );
};

const renderCarousel = (props: Partial<CarouselProps> = {}) =>
  render(
    <StoreProvider value={{}}>
      <Carousel items={SLIDES} {...props}>
        <CarouselTrack>
          <SlideTitle />
        </CarouselTrack>
        <Position />
      </Carousel>
    </StoreProvider>
  );

const call = (name: string, params: Record<string, unknown> = {}) =>
  act(() => {
    void handed.callbacks[name].callback?.(params, {});
  });

describe('Carousel', () => {
  it('shows one slide, says where it is, and moves on, back and to a slide — round the ends', () => {
    const { getByTestId, container } = renderCarousel();

    expect(getByTestId('slide').textContent).toBe('First');
    expect(getByTestId('position').textContent).toBe('1 of 3');
    // The slide a page opens on does not animate in.
    expect(container.querySelector('.carousel__slide')?.className).toBe('carousel__slide');

    call('next');

    expect(getByTestId('slide').textContent).toBe('Second');
    expect(container.querySelector('.carousel__slide')?.className).toContain('carousel__slide--slide-next');
    expect(interactionTrigger).toHaveBeenLastCalledWith('hero', 'onChange', { index: 1, item: SLIDES[1] });

    call('previous');
    call('previous');

    expect(getByTestId('slide').textContent).toBe('Third');
    expect(container.querySelector('.carousel__slide')?.className).toContain('carousel__slide--slide-previous');

    call('goTo', { index: '1' });

    expect(getByTestId('position').textContent).toBe('2 of 3');
    expect(container.querySelector('[aria-roledescription="slide"]')?.getAttribute('aria-label')).toBe('2 of 3');
  });

  it('stops at the ends when it does not loop', () => {
    const { getByTestId } = renderCarousel({ loop: false });

    call('previous');

    expect(getByTestId('slide').textContent).toBe('First');
  });

  it('moves on by itself, and not while paused', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const { getByTestId } = renderCarousel({ autoplay: 1000 });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(getByTestId('slide').textContent).toBe('Second');

    call('pause');
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(getByTestId('slide').textContent).toBe('Second');
    vi.useRealTimers();
  });

  it('draws a marquee twice, the copy out of reach of readers and the keyboard', () => {
    const { container } = renderCarousel({ mode: 'marquee' });
    const slides = container.querySelectorAll('.carousel__slide');

    expect(slides).toHaveLength(6);
    expect(slides[3].getAttribute('aria-hidden')).toBe('true');
    expect(slides[3].hasAttribute('inert')).toBe(true);
  });

  it('stands still in the builder, on its first slide', () => {
    preview.on = false;
    const { container } = renderCarousel({ mode: 'marquee', autoplay: 1000 });

    expect(container.querySelectorAll('.carousel__slide')).toHaveLength(3);
    expect(container.querySelector('.carousel__marquee--running')).toBeNull();
    preview.on = true;
  });
});
