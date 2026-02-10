/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useState, cloneElement, Children, useMemo, isValidElement } from 'react';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { ReactElement, ReactNode, RefObject } from 'react';

export type TabContainerProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
};

const TabContainer = ({ ref, className = '', children }: TabContainerProps) => {
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
          internalProps: { onSelect: setTabSelected, tabSelected }
        })
      );
    });

    return components;
  }, [children, tabSelected]);

  return (
    <RootElement ref={ref} className={clsx('plitzi-component__tab-container', className)}>
      {childrenParsed}
    </RootElement>
  );
};

export default withElement(TabContainer);

export { TabContainer };
