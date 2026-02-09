/* eslint-disable react-hooks/rules-of-hooks */

import get from 'lodash-es/get.js';
import { useCallback, use, useMemo, useRef, useEffect } from 'react';

import { pConsole } from '@plitzi/sdk-dev-tools/utils/PlitziConsole';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { interactionBasicTriggers, nativeEventsList } from './helpers/elementConstants';
import parseStyle from './helpers/parseStyle';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionBaseCallback, InternalPropsSTG2, DataSourceContextValue } from '@plitzi/sdk-shared';
import type { Context, CSSProperties, FC, JSX, ReactNode, RefObject } from 'react';

export type RootElementProps<T extends keyof JSX.IntrinsicElements> = {
  ref?: RefObject<HTMLElement | null>;
  children?: ReactNode;
  tag?: T;
  className?: string;
  interactionTriggers?: Record<string, InteractionBaseCallback>;
  interactionCallbacks?: Record<string, InteractionBaseCallback>;
  internalProps?: InternalPropsSTG2;
  style?: string | CSSProperties;
} & Omit<Partial<JSX.IntrinsicElements[T]>, 'ref' | 'style'>;

const RootElement = <T extends keyof JSX.IntrinsicElements = 'div'>({
  ref,
  children,
  tag = 'div' as T,
  className = '',
  interactionTriggers,
  interactionCallbacks,
  internalProps,
  style: styleProp,
  ...otherProps
}: RootElementProps<T>) => {
  const styleParsed = useMemo(() => parseStyle(styleProp), [styleProp]);
  const Tag = tag as unknown as FC<{ [key: string]: unknown }> | undefined;
  if (!Tag || !internalProps) {
    throw new Error(`One of these parameters [tag, internalProps] is missing in elementId: ${internalProps?.id}`);
  }

  if (internalProps.plitziJsxSkipHOC) {
    return (
      <Tag ref={ref} style={styleParsed} className={className} {...otherProps}>
        {children}
      </Tag>
    );
  }

  const plitziContextData = usePlitziServiceContext();
  const previewMode = get(plitziContextData, 'settings.previewMode', true);
  const debugMode = get(plitziContextData, 'settings.debugMode', false);
  const baseElementId = get(plitziContextData, 'root.baseElementId');
  const { id, rootId, style, definition, interactions, interactionsBasicCallbacks } = internalProps;
  const params = useMemo<Record<string, string | undefined | boolean>>(() => {
    if (!debugMode && (previewMode || !definition.type || rootId !== baseElementId)) {
      return {} as Record<string, string>;
    }

    return {
      'data-id': id,
      'data-name': definition.label ? definition.label : definition.type ? definition.type : 'unknown',
      'data-root-id': rootId,
      'data-type': definition.type ? definition.type : 'unknown',
      'data-root-render-element': true
    };
  }, [id, debugMode, previewMode, definition.type, definition.label, rootId, baseElementId]);

  const InteractionsContext = get(plitziContextData, 'contexts.InteractionsContext');
  const DataSourceContext = get(plitziContextData, 'contexts.DataSourceContext');
  if (!InteractionsContext || !DataSourceContext) {
    return (
      <Tag ref={ref} style={{ ...style, ...styleParsed }} className={className} {...otherProps} {...params}>
        {children}
      </Tag>
    );
  }

  const { interactionsManager, useInteractions } = use(InteractionsContext as Context<InteractionsContextValue>);
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

  const { useDataSource } = use(DataSourceContext as Context<DataSourceContextValue>);
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
    triggers: interactionTriggersMemo,
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
    <Tag
      ref={ref}
      style={{ ...style, ...styleParsed }}
      className={className}
      {...otherProps}
      {...params}
      {...eventsAttached}
    >
      {children}
    </Tag>
  );
};

export default RootElement;

export { RootElement };
