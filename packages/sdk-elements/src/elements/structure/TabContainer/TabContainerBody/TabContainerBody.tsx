/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { Children, cloneElement, isValidElement, use, useMemo } from 'react';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';
import TabContainerContext from '../TabContainerContext';

import type { ReactElement, ReactNode, RefObject } from 'react';

export type TabContainerBodyProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  children: ReactNode;
};

const TabContainerBody = ({ ref, className = '', children }: TabContainerBodyProps) => {
  const { baseId, tabSelected, onSelect } = use(TabContainerContext);

  const { childrenParsed } = useMemo(() => {
    const components: { childrenParsed: ReactNode[] } = { childrenParsed: [] };
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
            baseId,
            onSelect,
            tabSelected,
            tabIndex: i
          }
        })
      );
    });

    return components;
  }, [baseId, children, onSelect, tabSelected]);

  return (
    <RootElement ref={ref} className={clsx('plitzi-component__tab-container-body', className)}>
      {childrenParsed}
    </RootElement>
  );
};

export default withElement(TabContainerBody);

export { TabContainerBody };
