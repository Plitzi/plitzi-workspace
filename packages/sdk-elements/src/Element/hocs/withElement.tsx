/* eslint-disable react-hooks/rules-of-hooks */

import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import { useMemo, useRef } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import ElementContext from '../ElementContext';
import useElementInternal from '../hooks/useElementInternal';

import type { ElementContextValue } from '../ElementContext';
import type { InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { FC, ReactNode } from 'react';

export type WithElementProps<T> = {
  plitziJsxSkipHOC?: boolean;
  internalProps: InternalPropsSTG1;
  className?: string;
  children?: ReactNode;
  extraProps?: Record<string, unknown>;
} & T;

const withElement = <T extends object>(WrappedComponent: FC<T>) => {
  const WithElementComponent = (props: WithElementProps<T>) => {
    const ref = useRef<HTMLElement>(undefined);
    const { id, rootId } = props.internalProps;
    const contextValueSkipHOC = useMemo<ElementContextValue<'skipHOC'>>(
      () => ({ id, rootId, plitziJsxSkipHOC: true }),
      [id, rootId]
    );
    if (props.plitziJsxSkipHOC) {
      return useMemo(
        () => (
          <ElementContext value={contextValueSkipHOC}>
            <WrappedComponent {...props} internalProps={props.internalProps} />
          </ElementContext>
        ),
        [contextValueSkipHOC, props]
      );
    }

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
    useEventBridge('element', eventCallbacks, {});

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
      let wrappedProps = { ...internalProps.attributes, ...props.extraProps, ...customProps } as T;
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
    }, [internalProps.attributes, props.extraProps, customProps, children, contextValue]);
  };

  WithElementComponent.displayName = WrappedComponent.displayName || WrappedComponent.name;

  return WithElementComponent;
};

export default withElement;
