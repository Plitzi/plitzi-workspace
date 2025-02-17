/* eslint-disable react-hooks/rules-of-hooks */

import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import classNames from 'classnames';
import { useMemo } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import useElement from '../hooks/useElement';

import type { InternalProps } from '../../types/ElementTypes';
import type { FC, ReactNode } from 'react';

export type WithElementProps<T> = {
  plitziJsxSkipHOC?: boolean;
  plitziCustomComponent?: boolean;
  internalProps: InternalProps;
  className?: string;
  children?: ReactNode;
} & T;

const withElement = <T extends object>(WrappedComponent: FC<T>) => {
  const WithElementComponent = (props: WithElementProps<T>) => {
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
    const { id, rootId, definition } = internalProps;

    const refProxy = useMemo(
      () =>
        new Proxy(
          { current: null },
          {
            get(target, prop) {
              if (!target) {
                return undefined;
              }

              return target[prop];
            },
            set(target, prop, newValue) {
              target[prop] = newValue;
              // Do other process if are required like datasets

              return true;
            }
          }
        ),
      []
    );

    return useMemo(
      () => (
        <ErrorBoundary>
          <WrappedComponent
            {...internalProps.attributes}
            className={classNames(className, definition?.styleSelectors?.base)}
            // Plitzi
            ref={refProxy}
            internalProps={internalProps}
          >
            {children}
          </WrappedComponent>
        </ErrorBoundary>
      ),
      [internalProps, id, rootId, refProxy, children, className]
    );
  };

  WithElementComponent.displayName = WrappedComponent.displayName || WrappedComponent.name;

  return WithElementComponent;
};

export default withElement;
