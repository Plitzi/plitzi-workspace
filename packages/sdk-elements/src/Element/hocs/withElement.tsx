/* eslint-disable react-hooks/rules-of-hooks */

import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import { useMemo, useRef } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import ElementProvider from '../ElementProvider';
import useElementInternal from '../hooks/useElementInternal';

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
    if (props.plitziJsxSkipHOC) {
      return useMemo(
        () => (
          <ElementProvider id={id} rootId={rootId} plitziJsxSkipHOC>
            <WrappedComponent {...props} internalProps={props.internalProps} />
          </ElementProvider>
        ),
        [id, props, rootId]
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

    return useMemo(() => {
      let wrappedProps = { ...internalProps.attributes, ...props.extraProps, ...customProps } as T;
      if (children) {
        wrappedProps = { ...wrappedProps, children };
      }

      return (
        <ErrorBoundary>
          <ElementProvider
            id={id}
            rootId={rootId}
            className={props.className}
            attributes={internalProps.attributes}
            definition={internalProps.definition}
            elementState={internalProps.elementState}
            setElementState={internalProps.setElementState}
          >
            <WrappedComponent {...wrappedProps} ref={ref} />
          </ElementProvider>
        </ErrorBoundary>
      );
    }, [
      id,
      rootId,
      props.className,
      props.extraProps,
      internalProps.attributes,
      internalProps.definition,
      internalProps.elementState,
      internalProps.setElementState,
      customProps,
      children
    ]);
  };

  WithElementComponent.displayName = WrappedComponent.displayName || WrappedComponent.name;

  return WithElementComponent;
};

export default withElement;
