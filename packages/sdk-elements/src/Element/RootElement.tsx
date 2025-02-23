/* eslint-disable react-hooks/rules-of-hooks */

import get from 'lodash/get';
import { useCallback, use, useMemo, useRef, useEffect } from 'react';

import { pConsole } from '@plitzi/sdk-dev-tools/PlitziConsole';
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import { nativeEventsList } from './helpers/elementUtils';

import type { DataSourceContextValue } from '@plitzi/sdk-data-source';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback, InternalProps } from '@plitzi/sdk-shared';
import type { Context, FC, JSX, ReactNode, RefObject } from 'react';

const interactionBasicTriggers: Record<string, Partial<InteractionCallback>> = {
  onClick: {
    title: 'On Click',
    preview: { propagateEvent: '' },
    params: { propagateEvent: { canBind: false, defaultValue: false, type: 'boolean', label: 'Propagate Event' } }
  },
  onMouseEnter: {
    title: 'On Mouse Enter',
    preview: { propagateEvent: '' },
    params: { propagateEvent: { canBind: false, defaultValue: false, type: 'boolean', label: 'Propagate Event' } }
  },
  onMouseLeave: {
    title: 'On Mouse Leave',
    preview: { propagateEvent: '' },
    params: { propagateEvent: { canBind: false, defaultValue: false, type: 'boolean', label: 'Propagate Event' } }
  },
  onHover: {
    title: 'On Hover',
    preview: { propagateEvent: '' },
    params: { propagateEvent: { canBind: false, defaultValue: false, type: 'boolean', label: 'Propagate Event' } }
  }
};

export type RootElementProps<T extends keyof JSX.IntrinsicElements> = {
  ref?: RefObject<HTMLElement>;
  children?: ReactNode;
  tag?: T;
  className?: string;
  interactionTriggers?: Record<string, InteractionCallback>;
  interactionCallbacks?: Record<string, InteractionCallback>;
  internalProps?: InternalProps;
} & Omit<Partial<JSX.IntrinsicElements[T]>, 'ref'>;

const RootElement = <T extends keyof JSX.IntrinsicElements = 'div'>({
  ref,
  children,
  tag = 'div' as T,
  className = '',
  interactionTriggers = emptyObject,
  interactionCallbacks = emptyObject,
  internalProps,
  ...otherProps
}: RootElementProps<T>) => {
  const Tag = tag as unknown as FC<{ [key: string]: unknown }> | undefined;
  if (!Tag || !internalProps) {
    console.error('One of these parameters [tag, ref, internalProps] are missing', Tag, ref, internalProps);

    return undefined;
  }

  const { id, rootId, style, definition, interactions, interactionsBasicCallbacks } = internalProps;
  const plitziContextData = usePlitziServiceContext();
  const previewMode = get(plitziContextData, 'settings.previewMode', true);
  const debugMode = get(plitziContextData, 'settings.debugMode', false);
  const InteractionsContext = get(plitziContextData, 'contexts.InteractionsContext') as
    | Context<InteractionsContextValue>
    | undefined;
  const DataSourceContext = get(plitziContextData, 'contexts.DataSourceContext') as
    | Context<DataSourceContextValue>
    | undefined;
  const baseElementId = get(plitziContextData, 'root.baseElementId');

  const params = useMemo<Record<string, string | undefined | boolean>>(() => {
    if (!debugMode && (previewMode || !definition.type || rootId !== baseElementId)) {
      return {} as Record<string, string>;
    }

    return {
      'data-id': id,
      'data-name': definition.label ? definition.label : definition.type ? definition.type : 'unknown',
      'data-root-id': rootId,
      'data-type': !definition.type ? definition.type : 'unknown',
      'data-root-render-element': true
    };
  }, [id, rootId, definition, previewMode, baseElementId, debugMode]);

  if (!InteractionsContext || !DataSourceContext) {
    return (
      <Tag ref={ref} style={style} className={className} {...otherProps} {...params}>
        {children}
      </Tag>
    );
  }

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

      // Interactions Code here
      if (!propagateEvent) {
        e.preventDefault();
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
            processEvent(
              e,
              id,
              node.action,
              (otherProps as Record<string, unknown>)[node.action] as (e: MouseEvent) => unknown,
              propagateEvent
            )
        };
      }, {});
  }, [id, interactions, otherProps, previewMode, processEvent]);

  const { useDataSource } = use(DataSourceContext);
  const filterMode = useMemo(() => {
    if (!debugMode && (!definition.interactions || !Object.keys(definition.interactions).length)) {
      return 'hard';
    }

    return 'soft';
  }, [debugMode, definition.interactions]);
  const dataSource = useDataSource({ id, mode: 'read', filterMode });
  const dataSourceContextRef = useRef({});
  dataSourceContextRef.current = dataSource;

  const getAdditionalParams = useCallback(() => ({ dataSource: dataSourceContextRef.current }), [dataSourceContextRef]);

  const interactionTriggersMemo = useMemo(
    () => ({ ...interactionBasicTriggers, ...interactionTriggers }),
    [interactionTriggers]
  );

  const interactionCallbacksMemo = useMemo(
    () => ({ ...interactionCallbacks, ...interactionsBasicCallbacks }),
    [interactionCallbacks, interactionsBasicCallbacks]
  );

  useInteractions({
    id,
    interactions: internalProps.interactions,
    triggers: interactionTriggersMemo as Record<string, InteractionCallback>,
    callbacks: interactionCallbacksMemo,
    getAdditionalParams
  });

  useEffect(() => {
    if (!debugMode) {
      return () => {};
    }

    pConsole.addProviderMethod(`getElementDataSource-${id}`, () => dataSourceContextRef.current);

    return () => {
      pConsole.removeProviderMethod(`getElementDataSource-${id}`);
    };
  }, [debugMode, dataSourceContextRef, id]);

  return (
    <Tag ref={ref} style={style} className={className} {...otherProps} {...params} {...eventsAttached}>
      {children}
    </Tag>
  );
};

export default RootElement;

export { RootElement };
