import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, use, useMemo, useRef, useEffect } from 'react';

import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import { interactionBasicTriggers, nativeEventsList } from './helpers/elementConstants';
import useElementInteractions from './hooks/useElementInteractions';
import useInternalClassName from './hooks/useInternalClassName';
import StaticTag from './StaticTag';

import type { ElementContextValue } from './ElementContext';
import type { DebugParams } from './RootElement';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { Context, CSSProperties, JSX, ReactNode, RefObject } from 'react';

export type ResolvedProps = {
  elementContext: ElementContextValue;
  tag: keyof JSX.IntrinsicElements;
  refProp?: RefObject<HTMLElement | null>;
  styleParsed?: CSSProperties;
  className: string;
  interactionTriggers?: Record<string, InteractionCallback>;
  interactionCallbacks?: Record<string, InteractionCallback>;
  otherProps: Record<string, unknown>;
  children?: ReactNode;
};

export type RootElementInteractiveProps = ResolvedProps & {
  InteractionsContext: Context<InteractionsContextValue>;
  previewMode: boolean;
  debugMode: boolean;
  baseElementId?: string;
  params: DebugParams;
  serverMarker?: { 'data-rsc-id': string };
};

// Post-render phase, interactions branch: wires native events + the interaction rule engine and computes the
// element's internal class names. Only mounted when an InteractionsContext is present so its hooks run unconditionally.
const RootElementInteractive = ({
  elementContext,
  tag,
  refProp,
  styleParsed,
  className,
  interactionTriggers,
  interactionCallbacks,
  otherProps,
  children,
  InteractionsContext,
  previewMode,
  debugMode,
  baseElementId,
  params,
  serverMarker
}: RootElementInteractiveProps) => {
  const {
    id,
    className: classNameInternalProp,
    attributes,
    definition,
    definition: { interactions },
    plitziElementLayout,
    style,
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

  const eventsAttached = useMemo(() => {
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

  // Interactions can reference any source by name at runtime, so when present (or in debug) we hand the rule
  // engine the whole `runtime.sources` slice; otherwise the dataSource is unused, so we skip the subscription.
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

  useInteractions({ id, interactions, triggers, callbacks, getAdditionalParams });

  useEffect(() => {
    if (!previewMode || !interactions || !Object.keys(interactions).length) {
      return;
    }

    void interactionsManager.interactionTrigger(id, 'onLoad', {});
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

  return (
    <StaticTag
      tag={tag}
      refProp={refProp}
      style={{ ...style, ...styleParsed }}
      className={clsx(classNameInternalProp, classNameInternal)}
      otherProps={otherProps}
      params={params}
      serverMarker={serverMarker}
      events={eventsAttached}
    >
      {children}
    </StaticTag>
  );
};

export default RootElementInteractive;
