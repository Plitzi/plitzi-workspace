import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, use, useMemo, useRef, useEffect } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';
import { pConsole } from '@plitzi/sdk-shared/devTools/utils/PlitziConsole';
import ElementContext from '@plitzi/sdk-shared/elements/ElementContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { interactionBasicTriggers, nativeEventsList } from './helpers/elementConstants';
import parseStyle from './helpers/parseStyle';
import useElementInteractions from './hooks/useElementInteractions';
import useInternalClassName from './hooks/useInternalClassName';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { CommonState, ElementContextValue, InteractionCallback } from '@plitzi/sdk-shared';
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

type ElementTag = FC<{ [key: string]: unknown }>;

type DebugParams = Record<string, string | undefined | boolean>;

type ResolvedProps = {
  elementContext: ElementContextValue;
  Tag: ElementTag;
  refProp?: RefObject<HTMLElement | null>;
  styleParsed?: CSSProperties;
  className: string;
  interactionTriggers?: Record<string, InteractionCallback>;
  interactionCallbacks?: Record<string, InteractionCallback>;
  otherProps: Record<string, unknown>;
  children?: ReactNode;
};

type InteractiveProps = ResolvedProps & {
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
  Tag,
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
}: InteractiveProps) => {
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
            processEvent(e, id, node.action, otherProps[node.action] as (e: MouseEvent) => unknown, propagateEvent)
        };
      }, {});
  }, [id, interactions, otherProps, previewMode, processEvent]);

  // Interactions can reference any source by name at runtime, so when present (or in debug) we hand the rule
  // engine the whole `runtime.sources` slice; otherwise the dataSource is unused, so we skip the subscription.
  const needsDataSource = debugMode || !!(interactions && Object.keys(interactions).length);
  const { useStore } = createStoreHook<CommonState>();
  const [runtimeSources = emptyObject] = useStore('runtime.sources', { enabled: needsDataSource });
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
    <Tag
      ref={refProp}
      style={{ ...style, ...styleParsed }}
      className={clsx(classNameInternalProp, classNameInternal)}
      {...otherProps}
      {...params}
      {...eventsAttached}
      {...serverMarker}
    >
      {children}
    </Tag>
  );
};

// Post-render phase: reads the service context, computes debug params + the server marker, then renders either the
// static tag (no interactions) or the interactive variant.
const RootElementResolved = (props: ResolvedProps) => {
  const { elementContext, Tag, refProp, styleParsed, className, otherProps, children } = props;
  const plitziContextData = usePlitziServiceContext();
  const previewMode = get(plitziContextData, 'settings.previewMode', true);
  const debugMode = get(plitziContextData, 'settings.debugMode', false) as boolean;
  const baseElementId = get(plitziContextData, 'root.baseElementId');

  const {
    id,
    rootId,
    definition: { type, label, runtime },
    style
  } = elementContext;
  const serverMarker = runtime === 'server' ? { 'data-rsc-id': id } : undefined;
  const params = useMemo<DebugParams>(() => {
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
      <Tag
        ref={refProp}
        style={{ ...style, ...styleParsed }}
        className={className}
        {...otherProps}
        {...params}
        {...serverMarker}
      >
        {children}
      </Tag>
    );
  }

  return (
    <RootElementInteractive
      {...props}
      InteractionsContext={InteractionsContext}
      previewMode={previewMode}
      debugMode={debugMode}
      baseElementId={baseElementId}
      params={params}
      serverMarker={serverMarker}
    />
  );
};

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
  const Tag = tag as unknown as ElementTag | undefined;
  const elementContext = use(ElementContext);
  if (!(elementContext as ElementContextValue | undefined)) {
    throw new Error('This element can be rendered only under withElement HOC or inside ElementContext');
  }

  const { id } = elementContext;
  if (!Tag) {
    throw new Error(`One of these parameters [tag] is missing in elementId: ${id}`);
  }

  if (elementContext.plitziJsxSkipHOC) {
    return (
      <Tag ref={ref} style={styleParsed} className={className} {...otherProps}>
        {children}
      </Tag>
    );
  }

  return (
    <RootElementResolved
      elementContext={elementContext}
      Tag={Tag}
      refProp={ref}
      styleParsed={styleParsed}
      className={className}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
      otherProps={otherProps}
    >
      {children}
    </RootElementResolved>
  );
};

export default RootElement;

export { RootElement };
