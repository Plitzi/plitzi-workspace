import { useEffect, useMemo } from 'react';

import { toInteractionCallbacks, SCROLL_CALLBACKS } from '@plitzi/sdk-shared/authoring';
import {
  SCROLL_BEHAVIORS,
  SCROLL_POSITIONS,
  SCROLL_TRIGGER,
  VIEW_TRIGGER,
  scrollDistance,
  scrollPosition,
  scrollState
} from '@plitzi/sdk-shared/helpers';

import type { InteractionsManagerApi, ElementInteraction, InteractionCallback } from '@plitzi/sdk-shared';
import type {
  ScrollStepBehavior,
  ScrollStepPosition,
  ScrollTriggerPayload,
  ViewTriggerPayload
} from '@plitzi/sdk-shared/helpers';
import type { RefObject } from 'react';

export type UseScrollInteractionsProps = {
  id: string;
  label: string;
  nodeRef: RefObject<HTMLElement | null>;
  interactions?: Record<string, ElementInteraction>;
  previewMode: boolean;
  interactionsManager: InteractionsManagerApi;
};

type ScrollParams = { x?: unknown; y?: unknown; behavior?: unknown };

type IntoViewParams = { block?: unknown; inline?: unknown; behavior?: unknown };

const behaviorOf = (value: unknown): ScrollStepBehavior =>
  SCROLL_BEHAVIORS.find(behavior => behavior === value) ?? 'smooth';

const positionOf = (value: unknown, fallback: ScrollStepPosition): ScrollStepPosition =>
  SCROLL_POSITIONS.find(position => position === value) ?? fallback;

/**
 * The element's scroll steps, its `onScroll` trigger, and its `onView` trigger.
 *
 * The steps move the element's own box — a row of cards with `overflow: auto` — or, `scrollIntoView`, the page to it;
 * the node is read when a step runs, so one rendered after the flow was wired is still the one moved. `onScroll` fires
 * at most once a frame, and once on mount so a flow can hide an arrow before anybody has scrolled.
 */
const useScrollInteractions = ({
  id,
  label,
  nodeRef,
  interactions,
  previewMode,
  interactionsManager
}: UseScrollInteractionsProps): Record<string, InteractionCallback> => {
  const callbacks = useMemo(
    () =>
      toInteractionCallbacks(
        SCROLL_CALLBACKS,
        {
          scrollBy: (params: ScrollParams) => {
            const node = nodeRef.current;
            node?.scrollBy({
              left: scrollDistance(params.x, node.clientWidth) ?? 0,
              top: scrollDistance(params.y, node.clientHeight) ?? 0,
              behavior: behaviorOf(params.behavior)
            });
          },
          scrollTo: (params: ScrollParams) => {
            const node = nodeRef.current;
            if (!node) {
              return;
            }

            node.scrollTo({
              left: scrollPosition(params.x, node.scrollWidth, node.clientWidth) ?? node.scrollLeft,
              top: scrollPosition(params.y, node.scrollHeight, node.clientHeight) ?? node.scrollTop,
              behavior: behaviorOf(params.behavior)
            });
          },
          scrollIntoView: (params: IntoViewParams) => {
            nodeRef.current?.scrollIntoView({
              block: positionOf(params.block, 'start'),
              inline: positionOf(params.inline, 'nearest'),
              behavior: behaviorOf(params.behavior)
            });
          }
        },
        {
          scrollBy: { title: `Scroll ${label} by` },
          scrollTo: { title: `Scroll ${label} to` },
          scrollIntoView: { title: `Scroll to ${label}` }
        }
      ),
    [label, nodeRef]
  );

  const listens = useMemo(
    () =>
      Object.values(interactions ?? {}).some(
        node => node.type === 'trigger' && node.action === SCROLL_TRIGGER && node.enabled
      ),
    [interactions]
  );

  useEffect(() => {
    const node = nodeRef.current;
    if (!previewMode || !listens || !node || typeof window === 'undefined') {
      return undefined;
    }

    let frame = 0;
    const fire = () => {
      frame = 0;
      const payload: ScrollTriggerPayload = scrollState(node);
      void interactionsManager.interactionTrigger(id, SCROLL_TRIGGER, payload);
    };
    const onScroll = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(fire);
      }
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    frame = window.requestAnimationFrame(fire);

    return () => {
      node.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [id, interactionsManager, listens, nodeRef, previewMode]);

  // `onView`: the element coming into the visitor's view and leaving it — the margin of the first trigger that asks one.
  const viewMargin = useMemo(() => {
    const trigger = Object.values(interactions ?? {}).find(
      node => node.type === 'trigger' && node.action === VIEW_TRIGGER && node.enabled
    );
    if (!trigger) {
      return undefined;
    }

    const margin = Number((trigger.params as Record<string, unknown> | undefined)?.margin ?? 0);

    return Number.isFinite(margin) ? margin : 0;
  }, [interactions]);

  useEffect(() => {
    const node = nodeRef.current;
    if (
      !previewMode ||
      viewMargin === undefined ||
      !node ||
      typeof window === 'undefined' ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return undefined;
    }

    let seen: boolean | undefined;
    const observer = new IntersectionObserver(
      entries => {
        const inView = entries.some(entry => entry.isIntersecting);
        // Said when it changes — not again for each threshold the browser reports while it stays the same.
        if (inView === seen) {
          return;
        }

        seen = inView;
        const payload: ViewTriggerPayload = { inView };
        void interactionsManager.interactionTrigger(id, VIEW_TRIGGER, payload);
      },
      { rootMargin: `${String(viewMargin)}px` }
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [id, interactionsManager, nodeRef, previewMode, viewMargin]);

  return callbacks;
};

export default useScrollInteractions;
