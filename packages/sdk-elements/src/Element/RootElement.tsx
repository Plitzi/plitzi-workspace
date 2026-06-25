import { useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import parseStyle from './helpers/parseStyle';
import useElement from './hooks/useElement';
import RootElementInteractive from './RootElementInteractive';
import StaticTag from './StaticTag';

import type { ElementContextValue } from './ElementContext';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { Context, CSSProperties, FC, JSX, ReactNode, RefObject } from 'react';

export type RootElementProps<T extends keyof JSX.IntrinsicElements> = {
  ref?: RefObject<HTMLElement | null>;
  children?: ReactNode;
  tag?: T;
  className?: string;
  interactionTriggers?: Record<string, InteractionCallback>;
  interactionCallbacks?: Record<string, InteractionCallback>;
  style?: string | CSSProperties;
} & Omit<Partial<JSX.IntrinsicElements[T]>, 'ref' | 'style' | 'id'>;

export type ElementTag = FC<{ [key: string]: unknown }>;

export type DebugParams = Record<string, string | undefined | boolean>;

export type ResolvedProps = {
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

export type InteractiveProps = ResolvedProps & {
  InteractionsContext: Context<InteractionsContextValue>;
  previewMode: boolean;
  debugMode: boolean;
  baseElementId?: string;
  params: DebugParams;
  serverMarker?: { 'data-rsc-id': string };
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
  const elementContext = useElement();
  const serviceContext = usePlitziServiceContext();

  const params = useMemo<DebugParams>(() => {
    if (elementContext.plitziJsxSkipHOC) {
      return {};
    }

    const {
      id: elementId,
      rootId,
      definition: { type, label }
    } = elementContext;
    const previewMode = serviceContext.settings.previewMode ?? true;
    const debugMode = Boolean(serviceContext.settings.debugMode);
    if (!debugMode && (previewMode || !type || rootId !== serviceContext.root.baseElementId)) {
      return {};
    }

    return {
      'data-id': elementId,
      'data-name': label ? label : type ? type : 'unknown',
      'data-root-id': rootId,
      'data-type': type ? type : 'unknown',
      'data-root-render-element': true
    };
  }, [elementContext, serviceContext]);

  if (!Tag) {
    throw new Error(`One of these parameters [tag] is missing in elementId: ${elementContext.id}`);
  }

  if (elementContext.plitziJsxSkipHOC) {
    return (
      <StaticTag Tag={Tag} refProp={ref} style={styleParsed} className={className} otherProps={otherProps}>
        {children}
      </StaticTag>
    );
  }

  const {
    settings,
    root: { baseElementId },
    contexts
  } = serviceContext;
  const previewMode = settings.previewMode ?? true;
  const debugMode = Boolean(settings.debugMode);
  // The service-context type declares InteractionsContext as required, but interaction-less trees (SSR, tests) omit
  // it, so we narrow to nullable to keep the static-tag fallback below.
  const InteractionsContext = contexts.InteractionsContext as Context<InteractionsContextValue> | undefined;
  const {
    definition: { runtime },
    style
  } = elementContext;
  const serverMarker = runtime === 'server' ? { 'data-rsc-id': elementContext.id } : undefined;

  if (!InteractionsContext) {
    return (
      <StaticTag
        Tag={Tag}
        refProp={ref}
        style={{ ...style, ...styleParsed }}
        className={className}
        otherProps={otherProps}
        params={params}
        serverMarker={serverMarker}
      >
        {children}
      </StaticTag>
    );
  }

  return (
    <RootElementInteractive
      elementContext={elementContext}
      Tag={Tag}
      refProp={ref}
      styleParsed={styleParsed}
      className={className}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
      otherProps={otherProps}
      InteractionsContext={InteractionsContext}
      previewMode={previewMode}
      debugMode={debugMode}
      baseElementId={baseElementId}
      params={params}
      serverMarker={serverMarker}
    >
      {children}
    </RootElementInteractive>
  );
};

export default RootElement;

export { RootElement };
