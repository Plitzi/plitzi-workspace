import { useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import parseStyle from './helpers/parseStyle';
import renderStaticTag from './helpers/renderStaticTag';
import useElement from './hooks/useElement';
import useRootElementInteractions from './hooks/useRootElementInteractions';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { Context, CSSProperties, JSX, ReactNode, RefObject } from 'react';

export type RootElementProps<T extends keyof JSX.IntrinsicElements> = {
  ref?: RefObject<HTMLElement | null>;
  children?: ReactNode;
  tag?: T;
  className?: string;
  interactionTriggers?: Record<string, InteractionCallback>;
  interactionCallbacks?: Record<string, InteractionCallback>;
  style?: string | CSSProperties;
} & Omit<Partial<JSX.IntrinsicElements[T]>, 'ref' | 'style' | 'id'>;

export type DebugParams = Record<string, string | undefined | boolean>;

// Three branches, all rendering the same host tag via renderStaticTag:
//   1. skipHOC  → identity-only static descendant (no element data resolved).
//   2. no interactions context (SSR / tests) → static tag + debug params.
//   3. interactive runtime → useRootElementInteractions wires events + class names.
// Kept as a single component (the interactions hook is called only in branch 3) to avoid an extra wrapper level in the
// React DevTools tree for every element. Branch selection is invariant per mounted element, so the conditional hook
// call is safe; the eslint-disable below is scoped to that single call.
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
  const elementContext = useElement();
  const serviceContext = usePlitziServiceContext();
  const previewMode = serviceContext.settings.previewMode ?? true;
  const debugMode = Boolean(serviceContext.settings.debugMode);

  if (elementContext.plitziJsxSkipHOC) {
    return renderStaticTag({ tag, refProp: ref, style: styleParsed, className, otherProps, children });
  }

  const {
    root: { baseElementId },
    contexts
  } = serviceContext;
  // The service-context type declares InteractionsContext as required, but interaction-less trees (SSR, tests) omit
  // it, so we narrow to nullable to keep the static-tag fallback below.
  const InteractionsContext = contexts.InteractionsContext as Context<InteractionsContextValue> | undefined;
  const {
    id,
    rootId,
    style,
    definition: { type, label, runtime }
  } = elementContext;
  const serverMarker = runtime === 'server' ? { 'data-rsc-id': id } : undefined;
  const params: DebugParams =
    !debugMode && (previewMode || !type || rootId !== baseElementId)
      ? {}
      : {
          'data-id': id,
          'data-name': label || type || 'unknown',
          'data-root-id': rootId,
          'data-type': type || 'unknown',
          'data-root-render-element': true
        };

  if (!InteractionsContext) {
    return renderStaticTag({
      tag,
      refProp: ref,
      style: { ...style, ...styleParsed },
      className,
      otherProps,
      params,
      serverMarker,
      children
    });
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { className: classNameResolved, events } = useRootElementInteractions({
    elementContext,
    InteractionsContext,
    previewMode,
    debugMode,
    baseElementId,
    className,
    interactionTriggers,
    interactionCallbacks,
    otherProps
  });

  return renderStaticTag({
    tag,
    refProp: ref,
    style: { ...style, ...styleParsed },
    className: classNameResolved,
    otherProps,
    params,
    serverMarker,
    events,
    children
  });
};

export default RootElement;

export { RootElement };
