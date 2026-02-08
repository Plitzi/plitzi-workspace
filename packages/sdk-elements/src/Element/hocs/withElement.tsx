/* eslint-disable react-hooks/rules-of-hooks */

import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import clsx from 'clsx';
import { useMemo, useRef } from 'react';

import useElement from '../hooks/useElement';

import type { InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { FC, ReactNode } from 'react';

export type WithElementProps<T> = {
  plitziJsxSkipHOC?: boolean;
  plitziCustomComponent?: boolean;
  internalProps: InternalPropsSTG1;
  className?: string;
  children?: ReactNode;
  extraProps?: Record<string, unknown>;
} & T;

const withElement = <T extends object>(WrappedComponent: FC<T>) => {
  const WithElementComponent = (props: WithElementProps<T>) => {
    const internalPropsProp = useValueMemo(props.internalProps);
    const ref = useRef<HTMLElement>(undefined);
    if (props.plitziJsxSkipHOC) {
      return useMemo(
        () => <WrappedComponent {...props} internalProps={{ plitziJsxSkipHOC: true, ...internalPropsProp }} />,
        [internalPropsProp, props]
      );
    }

    const { internalProps, children, className } = useElement(internalPropsProp, {
      plitziCustomComponent: props.plitziCustomComponent,
      children: props.children,
      className: props.className
    });

    const { definition } = internalProps;

    return useMemo(
      () => (
        <ErrorBoundary>
          <WrappedComponent
            {...(internalProps.attributes as T)}
            {...(props.extraProps as T)}
            className={clsx(className, definition.styleSelectors.base)}
            // Plitzi
            ref={ref}
            internalProps={internalProps}
          >
            {children}
          </WrappedComponent>
        </ErrorBoundary>
      ),
      [internalProps, className, definition.styleSelectors.base, children, props.extraProps]
    );
  };

  WithElementComponent.displayName = WrappedComponent.displayName || WrappedComponent.name;

  return WithElementComponent;
};

export default withElement;
