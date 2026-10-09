import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { use, useCallback, useContext, useEffect, useEffectEvent, useMemo, useRef } from 'react';

import { StoreContext } from '@plitzi/nexus/react';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import { liveSources } from '@plitzi/sdk-shared/dataSource';
import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import useElementInteractions from './useElementInteractions';
import useInternalClassName from './useInternalClassName';
import useIntervalTriggers from './useIntervalTriggers';
import useKeyTriggers from './useKeyTriggers';
import useScrollInteractions from './useScrollInteractions';
import { interactionBasicTriggers, nativeEventsList } from '../helpers/elementConstants';

import type { ElementContextValue } from '../ElementContext';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

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
  previewMode: boolean;
  debugMode: boolean;
  baseElementId?: string;
  className: string;
  interactionTriggers?: Record<string, InteractionCallback>;
  interactionCallbacks?: Record<string, InteractionCallback>;
  otherProps: Record<string, unknown>;
  /** The component's own ref to its root node, when it keeps one; the scroll steps read the same node. */
  ref?: RefObject<HTMLElement | null>;
};

export type RootElementInteractions = {
  className: string;
  events: Record<string, unknown>;
  /** The ref the root node is rendered with: the component's, or one of the element's own. */
  nodeRef: RefObject<HTMLElement | null>;
};

// Interactions branch of RootElement, wires native events + the interaction rule engine and computes the element's
// internal class names. Extracted as a hook so RootElement stays a single flat component (custom hooks add no level to
// the React DevTools tree); only called under an interactions provider, so its hooks run as if unconditional.
const useRootElementInteractions = ({
  elementContext,
  previewMode,
  debugMode,
  baseElementId,
  className,
  interactionTriggers,
  interactionCallbacks,
  otherProps,
  ref
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
   * The sources, read when a flow's step runs — never subscribed.
   *
   * A flow can name any source, so it is handed the whole `runtime.sources` slice; but it only needs it at the moment
   * each step runs. Subscribed, every element with an interaction rendered again whenever any source anywhere changed
   * — a route param, a provider answering, a row publishing — for a value nothing on screen reads. `state` and
   * `computed` are read live rather than as the last render copied them, so a step sees what the steps before it wrote.
   */
  const store = useContext(StoreContext);
  const readSources = useCallback((): Record<string, unknown> => {
    const sources: unknown = store?.getPath('runtime.sources');

    return liveSources(
      isRecord(sources) ? sources : emptyObject,
      store?.getPath('runtime.state'),
      store?.getPath('schema.settings.computed')
    );
  }, [store]);

  const getAdditionalParams = useCallback(() => ({ dataSource: readSources() }), [readSources]);

  const triggers = useMemo(() => ({ ...interactionBasicTriggers, ...interactionTriggers }), [interactionTriggers]);
  const ownRef = useRef<HTMLElement | null>(null);
  const nodeRef = ref ?? ownRef;
  const basicCallbacks = useElementInteractions({ attributes, definition, setElementState });
  const scrollCallbacks = useScrollInteractions({
    id,
    label: definition.label,
    nodeRef,
    interactions,
    previewMode,
    interactionsManager
  });
  const callbacks = useMemo(
    () => ({ ...interactionCallbacks, ...scrollCallbacks, ...basicCallbacks }),
    [interactionCallbacks, scrollCallbacks, basicCallbacks]
  );

  useInteractions({ id, interactions, triggers, callbacks, getAdditionalParams });
  useKeyTriggers({ id, interactions, previewMode, interactionsManager });
  useIntervalTriggers({ id, interactions, previewMode, interactionsManager });

  // Deferred past the commit for the reason `onPageLoad` is (see Page): the global sources register their callbacks
  // from effects ABOVE this element, which React runs after this one, so a synchronous trigger on the first mount
  // ran a flow whose `state.setState` did not exist yet — and a page's `onLoad` did nothing on the load it is for.
  // Once, on the element's first mount — read as the element is then, not re-run as it changes.
  const fireLoad = useEffectEvent(() => {
    if (!previewMode || !interactions || !Object.keys(interactions).length) {
      return undefined;
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
  });

  useEffect(() => fireLoad(), []);

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

  return { className: clsx(classNameInternalProp, classNameInternal), events, nodeRef };
};

export default useRootElementInteractions;
