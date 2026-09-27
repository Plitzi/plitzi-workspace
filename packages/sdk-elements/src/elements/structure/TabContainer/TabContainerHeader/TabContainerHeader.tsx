/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { Children, cloneElement, isValidElement, use, useMemo } from 'react';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';
import TabContainerContext from '../TabContainerContext';

import type { ReactElement, ReactNode, RefObject } from 'react';

export type TabContainerHeaderProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  children: ReactNode;
};

const TabContainerHeader = ({ ref, className = '', children }: TabContainerHeaderProps) => {
  const { baseId, tabSelected, onSelect } = use(TabContainerContext);

  const { childrenParsed } = useMemo(() => {
    const components: { childrenParsed: ReactNode[] } = { childrenParsed: [] };
    const tabCount = Children.toArray(children).filter(isValidElement).length;
    Children.forEach(children, (child, i: number) => {
      if (!isValidElement(child)) {
        return;
      }

      const childProps = child.props as Record<string, unknown>;
      components.childrenParsed.push(
        cloneElement<Record<string, unknown>>(child as ReactElement<Record<string, unknown>>, {
          ...childProps,
          internalProps: {
            ...(childProps.internalProps as Record<string, unknown>),
            isHeader: true,
            baseId,
            onSelect,
            tabSelected,
            tabIndex: i,
            tabCount
          }
        })
      );
    });

    return components;
  }, [baseId, children, onSelect, tabSelected]);

  return (
    <RootElement ref={ref} role="tablist" className={clsx('plitzi-component__tab-container-header', className)}>
      {childrenParsed}
    </RootElement>
  );
};

export default withElement(TabContainerHeader);

export { TabContainerHeader };
