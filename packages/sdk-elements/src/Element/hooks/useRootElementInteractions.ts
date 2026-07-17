import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { use, useCallback, useEffect, useMemo, useRef } from 'react';

import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import useElementInteractions from './useElementInteractions';
import useInternalClassName from './useInternalClassName';
import { interactionBasicTriggers, nativeEventsList } from '../helpers/elementConstants';

import type { ElementContextValue } from '../ElementContext';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { Context } from 'react';

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
    idRef,
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

      void interactionsManager.interactionTrigger(id, actionName, { event: e });
    },
    [interactionsManager]
  );

  const events = useMemo(() => {
    if (!previewMode || !interactions || !idRef) {
      return {};
    }

    return Object.values(interactions)
      .filter(node => node.type === 'trigger' && node.action && nativeEventsList.includes(node.action) && node.enabled)
      .reduce((acum, node) => {
        const propagateEvent = get(node, 'params.propagateEvent', false) as boolean;

        return {
          ...acum,
          [node.action]: (e: MouseEvent) =>
            processEvent(e, idRef, node.action, otherProps[node.action] as (e: MouseEvent) => unknown, propagateEvent)
        };
      }, {});
  }, [idRef, interactions, otherProps, previewMode, processEvent]);

  // Interactions can reference any source by name at runtime, so when present (or in debug) we hand the rule engine the
  // whole `runtime.sources` slice; otherwise the dataSource is unused, so we skip the subscription.
  const needsDataSource = debugMode || !!(interactions && Object.keys(interactions).length);
  const [runtimeSources = emptyObject] = useCommonStore('runtime.sources', { enabled: needsDataSource });
  const dataSourceRef = useRef<Record<string, unknown>>({});
  dataSourceRef.current = runtimeSources;

  const getAdditionalParams = useCallback(() => ({ dataSource: dataSourceRef.current }), [dataSourceRef]);

  const triggers = useMemo(() => ({ ...interactionBasicTriggers, ...interactionTriggers }), [interactionTriggers]);
  const basicCallbacks = useElementInteractions({ attributes, definition, setElementState });
  const callbacks = useMemo(
    () => ({ ...interactionCallbacks, ...basicCallbacks }),
    [interactionCallbacks, basicCallbacks]
  );

  useInteractions({ id: idRef, interactions, triggers, callbacks, getAdditionalParams });

  useEffect(() => {
    if (!previewMode || !idRef || !interactions || !Object.keys(interactions).length) {
      return;
    }

    void interactionsManager.interactionTrigger(idRef, 'onLoad', {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!debugMode) {
      return;
    }

    pConsole.addProviderMethod(`getElementDataSource-${id}`, () => dataSourceRef.current);

    return () => {
      pConsole.removeProviderMethod(`getElementDataSource-${id}`);
    };
  }, [debugMode, dataSourceRef, id]);

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
