// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';
import ErrorBoundary from '@plitzi/plitzi-ui-components/ErrorBoundary';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject, getDisplayName } from '@plitzi/sdk-shared/utils';

// Relatives
import useElementController from '../hooks/useElementController';

const withElement = WrappedComponent => {
  /**
   * @param {{
   *   plitziJsxSkipHOC?: boolean;
   *   plitziCustomComponent?: boolean;
   *   internalProps: object;
   *   className: string;
   *   children: React.ReactNode;
   * }} props
   * @returns {React.ReactElement}
   */
  const WithElementComponent = props => {
    const {
      plitziJsxSkipHOC = false, // Props from JSX
      plitziCustomComponent = false // Props from JSX
    } = props;
    let { internalProps = emptyObject, className = '', children } = props;
    if (plitziJsxSkipHOC) {
      return useMemo(() => <WrappedComponent {...props} />, [props]);
    }

    ({ internalProps, children, className } = useElementController(internalProps, {
      plitziCustomComponent,
      children,
      className
    }));
    const { id, rootId, definition } = internalProps;

    const {
      settings: { previewMode }
    } = usePlitziServiceContext();

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
      [previewMode]
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

  WithElementComponent.displayName = `withElement(${getDisplayName(WrappedComponent)})`;

  return WithElementComponent;
};

export default withElement;
