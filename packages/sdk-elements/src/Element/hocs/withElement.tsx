/* eslint-disable react-hooks/rules-of-hooks */

import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import classNames from 'classnames';
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
} & T;

const withElement = <T extends object>(WrappedComponent: FC<T>) => {
  const WithElementComponent = (props: WithElementProps<T>) => {
    const ref = useRef<HTMLElement>(undefined);
    const { plitziJsxSkipHOC = false, plitziCustomComponent = false } = props; // Props from JSX
    if (plitziJsxSkipHOC) {
      return useMemo(
        () => <WrappedComponent {...props} internalProps={{ plitziJsxSkipHOC: true, ...props.internalProps }} />,
        [props]
      );
    }

    const { internalProps, children, className } = useElement(props.internalProps, {
      plitziCustomComponent,
      children: props.children,
      className: props.className
    });

    const { definition } = internalProps;

    return useMemo(
      () => (
        <ErrorBoundary>
          <WrappedComponent
            {...(internalProps.attributes as T)}
            className={classNames(className, definition.styleSelectors.base)}
            // Plitzi
            ref={ref}
            internalProps={internalProps}
          >
            {children}
          </WrappedComponent>
        </ErrorBoundary>
      ),
      [internalProps, className, definition.styleSelectors.base, children]
    );
  };

  WithElementComponent.displayName = WrappedComponent.displayName || WrappedComponent.name;

  return WithElementComponent;
};

export default withElement;
