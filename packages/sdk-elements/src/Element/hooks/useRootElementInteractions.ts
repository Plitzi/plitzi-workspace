import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { use, useCallback, useContext, useEffect, useMemo } from 'react';

import { StoreContext } from '@plitzi/nexus/react';
import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import useElementInteractions from './useElementInteractions';
import useInternalClassName from './useInternalClassName';
import { interactionBasicTriggers, nativeEventsList } from '../helpers/elementConstants';

import type { ElementContextValue } from '../ElementContext';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { Context } from 'react';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * The events an element's trigger has already answered without propagating it.
 *
 * `propagateEvent` is about the INTERACTION, not the DOM: an element whose trigger does not propagate answers the event
 * for its ancestors too, so a click on a button inside a clickable card runs the button's flow and not the card's as
 * well. The DOM event is left alone on purpose — a dropdown that opens from a click inside it, the dev tools' element
 * picker and every component's own `onClick` still see it — so this is recorded beside the event rather than done with
 * `stopPropagation`.
 *
 * Keyed by the native event: React hands every handler on the path the same one, and a WeakSet lets it go with the
 * event.
 */
const answeredEvents = new WeakSet<object>();

const nativeOf = (event: object): object =>
  'nativeEvent' in event && isRecord(event.nativeEvent) ? event.nativeEvent : event;

export type UseRootElementInteractionsProps = {
  elementContext: ElementContextValue;
  InteractionsContext: Context<InteractionsContextValue>;
  previewMode: boolean;
  debugMode: boolean;
  baseElementId?: string;
  className: string;
  interactionTriggers?: Record<string, InteractionCallback>;
  interactionCallbacks?: Record<string, InteractionCallback>;
  otherProps: Record<string, unknown>;
};

export type RootElementInteractions = {
  className: string;
  events: Record<string, unknown>;
};

// Interactions branch of RootElement, wires native events + the interaction rule engine and computes the element's
// internal class names. Extracted as a hook so RootElement stays a single flat component (custom hooks add no level to
// the React DevTools tree); only called when an InteractionsContext is present, so its hooks run as if unconditional.
const useRootElementInteractions = ({
  elementContext,
  InteractionsContext,
  previewMode,
  debugMode,
  baseElementId,
  className,
  interactionTriggers,
  interactionCallbacks,
  otherProps
}: UseRootElementInteractionsProps): RootElementInteractions => {
  const {
    id,
    className: classNameInternalProp,
    attributes,
    definition,
    definition: { interactions },
    plitziElementLayout,
    elementState,
    setElementState
  } = elementContext;
  const { interactionsManager, useInteractions } = use(InteractionsContext);

  const processEvent = useCallback(
    (
      e: MouseEvent,
      id: string,
      actionName: string,
      originalCallback?: (e: MouseEvent) => unknown,
      propagateEvent = false
    ) => {
      if (!propagateEvent) {
        e.preventDefault();
      }

      if (originalCallback) {
        // If otherProps contains the same event, hook it
        originalCallback(e);
      }

      const native = nativeOf(e);
      // An element inside this one already answered the event and did not let it go further.
      if (answeredEvents.has(native)) {
        return;
      }

      if (!propagateEvent) {
        answeredEvents.add(native);
      }

      void interactionsManager.interactionTrigger(id, actionName, { event: e });
    },
    [interactionsManager]
  );

  const events = useMemo(() => {
    if (!previewMode || !interactions) {
      return {};
    }

    return Object.values(interactions)
      .filter(node => node.type === 'trigger' && node.action && nativeEventsList.includes(node.action) && node.enabled)
      .reduce((acum, node) => {
        const propagateEvent = get(node, 'params.propagateEvent', false) as boolean;

        return {
          ...acum,
          [node.action]: (e: MouseEvent) =>
            processEvent(e, id, node.action, otherProps[node.action] as (e: MouseEvent) => unknown, propagateEvent)
        };
      }, {});
  }, [id, interactions, otherProps, previewMode, processEvent]);

  /**
   * The sources, read when a flow runs — never subscribed.
   *
   * A flow can name any source, so it is handed the whole `runtime.sources` slice; but it only needs it at the moment
   * it fires. Subscribed, every element with an interaction rendered again whenever any source anywhere changed —
   * a route param, a provider answering, a row publishing — for a value nothing on screen reads.
   */
  const store = useContext(StoreContext);
  const readSources = useCallback((): Record<string, unknown> => {
    const sources: unknown = store?.getPath('runtime.sources');

    return isRecord(sources) ? sources : emptyObject;
  }, [store]);

  const getAdditionalParams = useCallback(() => ({ dataSource: readSources() }), [readSources]);

  const triggers = useMemo(() => ({ ...interactionBasicTriggers, ...interactionTriggers }), [interactionTriggers]);
  const basicCallbacks = useElementInteractions({ attributes, definition, setElementState });
  const callbacks = useMemo(
    () => ({ ...interactionCallbacks, ...basicCallbacks }),
    [interactionCallbacks, basicCallbacks]
  );

  useInteractions({ id, interactions, triggers, callbacks, getAdditionalParams });

  // Deferred past the commit for the reason `onPageLoad` is (see Page): the global sources register their callbacks
  // from effects ABOVE this element, which React runs after this one, so a synchronous trigger on the first mount
  // ran a flow whose `state.setState` did not exist yet — and a page's `onLoad` did nothing on the load it is for.
  useEffect(() => {
    if (!previewMode || !interactions || !Object.keys(interactions).length) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      void interactionsManager.interactionTrigger(id, 'onLoad', {});
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!debugMode) {
      return;
    }

    pConsole.addProviderMethod(`getElementDataSource-${id}`, readSources);

    return () => {
      pConsole.removeProviderMethod(`getElementDataSource-${id}`);
    };
  }, [debugMode, readSources, id]);

  const classNameInternal = useInternalClassName({
    id,
    className,
    previewMode,
    baseElementId,
    definition,
    elementState,
    plitziElementLayout
  });

  return { className: clsx(classNameInternalProp, classNameInternal), events };
};

export default useRootElementInteractions;
