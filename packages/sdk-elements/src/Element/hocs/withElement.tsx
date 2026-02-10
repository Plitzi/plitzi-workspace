/* eslint-disable react-hooks/rules-of-hooks */

import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import { useMemo, useRef } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';

import ElementProvider from '../ElementProvider';
import useElement from '../hooks/useElement';

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
    const internalPropsProp = useValueMemo(props.internalProps);
    const ref = useRef<HTMLElement>(undefined);
    const { id, rootId } = internalPropsProp;
    if (props.plitziJsxSkipHOC) {
      return useMemo(
        () => (
          <ElementProvider id={id} rootId={rootId} plitziJsxSkipHOC>
            <WrappedComponent {...props} internalProps={internalPropsProp} />
          </ElementProvider>
        ),
        [id, internalPropsProp, props, rootId]
      );
    }

    const { internalProps, children } = useElement(internalPropsProp, { children: props.children });
    const eventCallbacks = useMemo(
      () => ({ [`${internalProps.id}_setState`]: internalProps.setElementState }),
      [internalProps.id, internalProps.setElementState]
    );
    useEventBridge('element', eventCallbacks, {});

    return useMemo(
      () => (
        <ErrorBoundary>
          <ElementProvider
            id={internalPropsProp.id}
            rootId={internalPropsProp.rootId}
            className={props.className}
            attributes={internalProps.attributes}
            definition={internalProps.definition}
            elementState={internalProps.elementState}
            setElementState={internalProps.setElementState}
          >
            <WrappedComponent
              {...(internalProps.attributes as T)}
              {...(props.extraProps as T)}
              children={children}
              // Plitzi
              ref={ref}
              internalProps={internalProps}
            />
          </ElementProvider>
        </ErrorBoundary>
      ),
      [internalPropsProp.id, internalPropsProp.rootId, props.className, props.extraProps, internalProps, children]
    );
  };

  WithElementComponent.displayName = WrappedComponent.displayName || WrappedComponent.name;

  return WithElementComponent;
};

export default withElement;
