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

const withElement = <T extends object>(WrappedComponent: FC<T>) => {
  const SkipHocElement = (props: WithElementProps<T>) => {
    const { id, rootId } = props.internalProps;
    const entry = useMemo<ElementContextValue<'skipHOC'>>(() => ({ id, rootId, plitziJsxSkipHOC: true }), [id, rootId]);

    return (
      <ElementContext value={entry}>
        <WrappedComponent {...props} />
      </ElementContext>
    );
  };

  const FullElement = (props: WithElementProps<T>) => {
    const ref = useRef<HTMLElement>(undefined);
    const { id, rootId } = props.internalProps;
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

    if (debugMode) {
      // Registers the real render-tree parent so the collector/flamegraph nest correctly across schemas.
      tracingCollector.linkParent(id, parentElement?.id);

      return (
        <Profiler id={id} onRender={tracingCollector.onRender}>
          <ElementContext value={elementData}>{content}</ElementContext>
        </Profiler>
      );
    }

    return <ElementContext value={elementData}>{content}</ElementContext>;
  };

  const WithElementComponent = (props: WithElementProps<T>) =>
    props.plitziJsxSkipHOC ? <SkipHocElement {...props} /> : <FullElement {...props} />;

  WithElementComponent.displayName = `withElement(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithElementComponent;
};

export default withElement;
