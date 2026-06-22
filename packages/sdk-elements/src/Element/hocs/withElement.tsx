import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import { omit } from '@plitzi/plitzi-ui/helpers/lodash';
import { useMemo, useRef } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { usePublishElement } from '../ElementStore';
import useElementInternal from '../hooks/useElementInternal';

import type { ElementStoreEntry } from '../ElementStore';
import type { InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { FC, ReactNode } from 'react';

// `id` is injected by the HOC from `internalProps`, so callers never pass it: omit it from the wrapped props.
export type WithElementProps<T> = {
  plitziJsxSkipHOC?: boolean;
  internalProps: InternalPropsSTG1;
  className?: string;
  children?: ReactNode;
  extraProps?: Record<string, unknown>;
} & Omit<T, 'id'>;

const withElement = <T extends object>(WrappedComponent: FC<T>) => {
  // Manual-render path (JSX manager): publishes only element identity to the store and injects `id`, no resolution.
  const SkipHocElement = (props: WithElementProps<T>) => {
    const { id, rootId } = props.internalProps;
    const entry = useMemo<ElementStoreEntry>(() => ({ id, rootId, plitziJsxSkipHOC: true }), [id, rootId]);
    usePublishElement(entry);

    return useMemo(() => {
      const wrappedProps = { ...props, id } as unknown as T;

      return <WrappedComponent {...wrappedProps} />;
    }, [id, props]);
  };

  // Pre-render phase: resolve the element's data and publish it to the element store keyed by id. The wrapped component
  // receives the resolved attributes as props (plugin contract) plus its `id`; it reads the rest by id from the store.
  // Publishing happens in render so a descendant's `useElementData(id)` reads it on first paint; on mount nobody is
  // subscribed yet, on update the subscriber wakes and re-renders.
  const FullElement = (props: WithElementProps<T>) => {
    const ref = useRef<HTMLElement>(undefined);
    const { id, rootId } = props.internalProps;
    const {
      settings: { previewMode },
      root: { baseElementId }
    } = usePlitziServiceContext();

    const { internalProps, customProps, children } = useElementInternal({
      internalProps: props.internalProps,
      children: props.children,
      previewMode,
      baseElementId
    });

    const { attributes, definition, style, plitziElementLayout, elementState, setElementState } = internalProps;
    const eventCallbacks = useMemo(() => ({ [`${id}_setState`]: setElementState }), [id, setElementState]);
    useEventBridge('element', eventCallbacks);

    const elementData = useMemo<ElementStoreEntry>(
      () => ({ id, rootId, attributes, definition, plitziElementLayout, style, elementState, setElementState }),
      [attributes, definition, elementState, id, plitziElementLayout, rootId, style, setElementState]
    );

    usePublishElement(elementData);

    return useMemo(() => {
      let wrappedProps = {
        ...internalProps.attributes,
        ...props.extraProps,
        ...customProps,
        // Props injected via other elements
        ...omit(props, ['plitziJsxSkipHOC', 'internalProps', 'className', 'children', 'extraProps']),
        id
      } as T;
      if (children) {
        wrappedProps = { ...wrappedProps, children };
      }

      return (
        <ErrorBoundary>
          <WrappedComponent {...wrappedProps} ref={ref} />
        </ErrorBoundary>
      );
    }, [internalProps.attributes, props, customProps, children, id]);
  };

  const WithElementComponent = (props: WithElementProps<T>) =>
    props.plitziJsxSkipHOC ? <SkipHocElement {...props} /> : <FullElement {...props} />;

  WithElementComponent.displayName = `withElement(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithElementComponent;
};

export default withElement;
