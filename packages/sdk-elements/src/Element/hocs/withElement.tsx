/* eslint-disable react-hooks/rules-of-hooks */
import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import { Profiler, use, useMemo, useRef } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { useCommonStore } from '@plitzi/sdk-shared/store';
import { tracingCollector } from '@plitzi/sdk-shared/store/tracing';

import ElementContext from '../ElementContext';
import { omitKeys } from '../helpers/omitKeys';
import useElementInternal from '../hooks/useElementInternal';

import type { ElementContextValue } from '../ElementContext';
import type { Element, InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { FC, ReactNode } from 'react';

export type WithElementProps<T> = {
  plitziJsxSkipHOC?: boolean;
  internalProps: InternalPropsSTG1;
  className?: string;
  children?: ReactNode;
  extraProps?: Record<string, unknown>;
} & T;

// Single component on purpose: under `plitziJsxSkipHOC` it returns the lightweight identity-only branch before the
// heavy resolution hooks, which is a conditional-hooks pattern (hence the file-level rules-of-hooks disable). It is
// safe because `plitziJsxSkipHOC` is invariant for a given mounted element, so hook order never changes across its
// re-renders. Splitting the two branches into separate components would only add a wrapper level to the React DevTools
// tree for every element.
const withElement = <T extends object>(WrappedComponent: FC<T>) => {
  const name = WrappedComponent.displayName || WrappedComponent.name;

  const WithElementComponent = (props: WithElementProps<T>) => {
    const ref = useRef<HTMLElement>(undefined);
    const { id, rootId } = props.internalProps;
    const skipEntry = useMemo<ElementContextValue<'skipHOC'>>(
      () => ({ id, rootId, plitziJsxSkipHOC: true }),
      [id, rootId]
    );

    if (props.plitziJsxSkipHOC) {
      return (
        <ElementContext value={skipEntry}>
          <WrappedComponent {...props} />
        </ElementContext>
      );
    }

    // The enclosing element context is this element's real render-tree parent (nests across schemas/rootIds).
    const parentElement = use(ElementContext) as ElementContextValue | undefined;
    const {
      settings: { previewMode, debugMode },
      root: { baseElementId }
    } = usePlitziServiceContext();
    const [element] = useCommonStore(`schema.flat.${id}`);
    if (!(element as Element | undefined)) {
      throw new Error(`Element ${id} not found, Page ${baseElementId}`);
    }

    const { internalProps, customProps, children } = useElementInternal({
      element,
      internalProps: props.internalProps,
      children: props.children,
      previewMode
    });

    const { attributes, definition, style, plitziElementLayout, elementState, setElementState } = internalProps;
    const eventCallbacks = useMemo(() => ({ [`${id}_setState`]: setElementState }), [id, setElementState]);
    useEventBridge('element', eventCallbacks);

    // `elementData` and `content` are deliberately separate memos: `elementData` (the context value) has narrow deps so
    // consumers re-render only when element data changes, while `content` excludes those deps so the WrappedComponent is
    // not re-rendered when only element data (style, elementState…) changes. Merging them would regress both.
    const elementData = useMemo<ElementContextValue>(
      () => ({ id, rootId, attributes, definition, plitziElementLayout, style, elementState, setElementState }),
      [attributes, definition, elementState, id, plitziElementLayout, rootId, style, setElementState]
    );

    const content = useMemo(() => {
      let wrappedProps = {
        ...internalProps.attributes,
        ...props.extraProps,
        ...customProps,
        // Props injected via other elements
        ...omitKeys(props, ['plitziJsxSkipHOC', 'internalProps', 'className', 'children', 'extraProps'])
      } as T;
      if (children) {
        wrappedProps = { ...wrappedProps, children };
      }

      return (
        <ErrorBoundary>
          <WrappedComponent {...wrappedProps} ref={ref} />
        </ErrorBoundary>
      );
    }, [internalProps.attributes, props, customProps, children]);

    const tree = <ElementContext value={elementData}>{content}</ElementContext>;

    if (debugMode) {
      // Registers the real render-tree parent so the collector/flamegraph nest correctly across schemas. Whether the
      // element rendered itself vs only a descendant did is derived later from self time, not flagged here.
      tracingCollector.linkParent(id, parentElement?.id);

      return (
        <Profiler id={id} onRender={tracingCollector.onRender}>
          {tree}
        </Profiler>
      );
    }

    return tree;
  };

  WithElementComponent.displayName = `withElement(${name})`;

  return WithElementComponent;
};

export default withElement;
