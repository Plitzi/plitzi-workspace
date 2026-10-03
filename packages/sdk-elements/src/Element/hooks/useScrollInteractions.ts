import { useEffect, useMemo } from 'react';

import { toInteractionCallbacks } from '@plitzi/sdk-shared/authoring/builder';
import { SCROLL_CALLBACKS } from '@plitzi/sdk-shared/authoring/elementCallbacks';
import {
  SCROLL_BEHAVIORS,
  SCROLL_POSITIONS,
  SCROLL_TRIGGER,
  scrollDistance,
  scrollPosition,
  scrollState
} from '@plitzi/sdk-shared/helpers/scroll';

import type { InteractionsManager } from '@plitzi/sdk-interactions';
import type { ElementInteraction, InteractionCallback } from '@plitzi/sdk-shared';
import type { ScrollStepBehavior, ScrollStepPosition, ScrollTriggerPayload } from '@plitzi/sdk-shared/helpers/scroll';
import type { RefObject } from 'react';

export type UseScrollInteractionsProps = {
  id: string;
  label: string;
  nodeRef: RefObject<HTMLElement | null>;
  interactions?: Record<string, ElementInteraction>;
  previewMode: boolean;
  interactionsManager: InteractionsManager;
};

type ScrollParams = { x?: unknown; y?: unknown; behavior?: unknown };

type IntoViewParams = { block?: unknown; inline?: unknown; behavior?: unknown };

const behaviorOf = (value: unknown): ScrollStepBehavior =>
  SCROLL_BEHAVIORS.find(behavior => behavior === value) ?? 'smooth';

const positionOf = (value: unknown, fallback: ScrollStepPosition): ScrollStepPosition =>
  SCROLL_POSITIONS.find(position => position === value) ?? fallback;

/**
 * The element's scroll steps, and its `onScroll` trigger.
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

  return callbacks;
};

export default useScrollInteractions;
