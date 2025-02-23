/* eslint-disable react-hooks/rules-of-hooks */

import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import classNames from 'classnames';
import { useMemo, useRef } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import useElement from '../hooks/useElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { FC, ReactNode } from 'react';

export type WithElementProps<T> = {
  plitziJsxSkipHOC?: boolean;
  plitziCustomComponent?: boolean;
  internalProps?: InternalProps;
  className?: string;
  children?: ReactNode;
} & T;

const withElement = <T extends object>(WrappedComponent: FC<T>) => {
  const WithElementComponent = (props: WithElementProps<T>) => {
    const ref = useRef<HTMLElement>(undefined);
    const { plitziJsxSkipHOC = false, plitziCustomComponent = false } = props; // Props from JSX
    let { internalProps = emptyObject as InternalProps, className = '', children } = props;
    if (plitziJsxSkipHOC) {
      return useMemo(() => <WrappedComponent {...props} />, [props]);
    }

    ({ internalProps, children, className } = useElement(internalProps, {
      plitziCustomComponent,
      children,
      className
    }));
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
