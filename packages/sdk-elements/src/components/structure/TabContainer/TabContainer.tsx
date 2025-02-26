/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import { useState, cloneElement, Children, useMemo, isValidElement } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { ReactElement, ReactNode, RefObject } from 'react';

export type TabContainerProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  internalProps?: InternalProps;
  children?: ReactNode;
};

const TabContainer = ({
  ref,
  className = '',
  internalProps = emptyObject as InternalProps,
  children
}: TabContainerProps) => {
  const [tabSelected, setTabSelected] = useState(0);

  const { childrenParsed } = useMemo(() => {
    const components: { childrenParsed: ReactNode[] } = { childrenParsed: [] };
    Children.forEach(children, child => {
      if (!isValidElement(child)) {
        return;
      }

      const childProps = child.props as Record<string, unknown>;
      components.childrenParsed.push(
        cloneElement<Record<string, unknown>>(child as ReactElement<Record<string, unknown>>, {
          ...childProps,
          internalProps: { ...(childProps.internalProps as InternalProps), onSelect: setTabSelected, tabSelected }
        })
      );
    });

    return components;
  }, [children, tabSelected]);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__tab-container', className)}
    >
      {childrenParsed}
    </RootElement>
  );
};

export default withElement(TabContainer);

export { TabContainer };
