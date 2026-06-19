import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import { omit } from '@plitzi/plitzi-ui/helpers/lodash';
import { useMemo, useRef } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import ElementContext from '@plitzi/sdk-shared/elements/ElementContext';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import useElementInternal from '../hooks/useElementInternal';

import type { ElementContextValue, InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { FC, ReactNode } from 'react';

export type WithElementProps<T> = {
  plitziJsxSkipHOC?: boolean;
  internalProps: InternalPropsSTG1;
  className?: string;
  children?: ReactNode;
  extraProps?: Record<string, unknown>;
} & T;

const withElement = <T extends object>(WrappedComponent: FC<T>) => {
  // Manual-render path (JSX manager): skips the heavy resolution pipeline and only exposes element identity.
  const SkipHocElement = (props: WithElementProps<T>) => {
    const { id, rootId } = props.internalProps;
    const contextValue = useMemo<ElementContextValue<'skipHOC'>>(
      () => ({ id, rootId, plitziJsxSkipHOC: true }),
      [id, rootId]
    );

    return useMemo(
      () => (
        <ElementContext value={contextValue}>
          <WrappedComponent {...props} internalProps={props.internalProps} />
        </ElementContext>
      ),
      [contextValue, props]
    );
  };

  // Pre-render phase: resolve the element's data (schema, bindings, state, styleSelectors) and inject it as the
  // element context the wrapped component consumes.
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

    const contextValue = useMemo(
      () => ({
        id,
        rootId,
        attributes,
        definition,
        plitziElementLayout,
        style,
        elementState,
        setElementState
      }),
      [attributes, definition, elementState, id, plitziElementLayout, rootId, style, setElementState]
    );

    return useMemo(() => {
      let wrappedProps = {
        ...internalProps.attributes,
        ...props.extraProps,
        ...customProps,
        // Props injected via other elements
        ...omit(props, ['plitziJsxSkipHOC', 'internalProps', 'className', 'children', 'extraProps'])
      } as T;
      if (children) {
        wrappedProps = { ...wrappedProps, children };
      }

      return (
        <ErrorBoundary>
          <ElementContext value={contextValue}>
            <WrappedComponent {...wrappedProps} ref={ref} />
          </ElementContext>
        </ErrorBoundary>
      );
    }, [internalProps.attributes, props, customProps, children, contextValue]);
  };

  const WithElementComponent = (props: WithElementProps<T>) =>
    props.plitziJsxSkipHOC ? <SkipHocElement {...props} /> : <FullElement {...props} />;

  WithElementComponent.displayName = `withElement(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithElementComponent;
};

export default withElement;
