/* eslint-disable react-hooks/rules-of-hooks */

import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, use, useMemo, useRef, useEffect } from 'react';

import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import ElementContext from '@plitzi/sdk-shared/elements/ElementContext';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { interactionBasicTriggers, nativeEventsList } from './helpers/elementConstants';
import parseStyle from './helpers/parseStyle';
import useElementDataSource from './hooks/useElementDataSource';
import useElementInteractions from './hooks/useElementInteractions';
import useInternalClassName from './hooks/useInternalClassName';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { ElementContextValue, InteractionCallback } from '@plitzi/sdk-shared';
import type { Context, CSSProperties, FC, JSX, ReactNode, RefObject } from 'react';

export type RootElementProps<T extends keyof JSX.IntrinsicElements> = {
  ref?: RefObject<HTMLElement | null>;
  children?: ReactNode;
  tag?: T;
  className?: string;
  interactionTriggers?: Record<string, InteractionCallback>;
  interactionCallbacks?: Record<string, InteractionCallback>;
  style?: string | CSSProperties;
} & Omit<Partial<JSX.IntrinsicElements[T]>, 'ref' | 'style'>;

const RootElement = <T extends keyof JSX.IntrinsicElements = 'div'>({
  ref,
  children,
  tag = 'div' as T,
  className = '',
  interactionTriggers,
  interactionCallbacks,
  style: styleProp,
  ...otherProps
}: RootElementProps<T>) => {
  const styleParsed = useMemo(() => parseStyle(styleProp), [styleProp]);
  const Tag = tag as unknown as FC<{ [key: string]: unknown }> | undefined;
  const elementContext = use(ElementContext);
  if (!(elementContext as ElementContextValue | undefined)) {
    throw new Error('This element can be rendered only under withElement HOC or inside ElementContext');
  }

  const { id, rootId } = elementContext;
  if (!Tag) {
    throw new Error(`One of these parameters [tag] is missing in elementId: ${id}`);
  }

  if (!(elementContext as ElementContextValue | undefined)) {
    throw new Error('This element can be rendered only under withElement HOC');
  }

  if (elementContext.plitziJsxSkipHOC) {
    return (
      <Tag ref={ref} style={styleParsed} className={className} {...otherProps}>
        {children}
      </Tag>
    );
  }

  const plitziContextData = usePlitziServiceContext();
  const previewMode = get(plitziContextData, 'settings.previewMode', true);
  const debugMode = get(plitziContextData, 'settings.debugMode', false) as boolean;
  const baseElementId = get(plitziContextData, 'root.baseElementId');

  const {
    className: classNameInternalProp,
    attributes,
    definition,
    definition: { interactions, type, label },
    plitziElementLayout,
    style,
    elementState,
    setElementState
  } = elementContext;
  const params = useMemo<Record<string, string | undefined | boolean>>(() => {
    if (!debugMode && (previewMode || !type || rootId !== baseElementId)) {
      return {};
    }

    return {
      'data-id': id,
      'data-name': label ? label : type ? type : 'unknown',
      'data-root-id': rootId,
      'data-type': type ? type : 'unknown',
      'data-root-render-element': true
    };
  }, [debugMode, previewMode, rootId, baseElementId, id, label, type]);

  const InteractionsContext = get(plitziContextData, 'contexts.InteractionsContext') as
    | Context<InteractionsContextValue>
    | undefined;
  if (!InteractionsContext) {
    return (
      <Tag ref={ref} style={{ ...style, ...styleParsed }} className={className} {...otherProps} {...params}>
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

  const filterMode = useMemo(
    () => (!debugMode && (!interactions || !Object.keys(interactions).length) ? 'hard' : 'soft'),
    [debugMode, interactions]
  );
  const dataSourceRef = useRef({});
  dataSourceRef.current = useElementDataSource({
    id,
    bindings: definition.bindings,
    filterMode,
    sources: filterMode === 'hard' ? ['variables'] : []
  });

  const getAdditionalParams = useCallback(() => ({ dataSource: dataSourceRef.current }), [dataSourceRef]);

  const triggers = useMemo(() => ({ ...interactionBasicTriggers, ...interactionTriggers }), [interactionTriggers]);
  const basicCallbacks = useElementInteractions({ attributes, definition, setElementState });
  const callbacks = useMemo(
    () => ({ ...interactionCallbacks, ...basicCallbacks }),
    [interactionCallbacks, basicCallbacks]
  );

  useInteractions({ id, interactions, triggers, callbacks, getAdditionalParams });

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
    <Tag
      ref={ref}
      style={{ ...style, ...styleParsed }}
      className={clsx(classNameInternalProp, classNameInternal)}
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
