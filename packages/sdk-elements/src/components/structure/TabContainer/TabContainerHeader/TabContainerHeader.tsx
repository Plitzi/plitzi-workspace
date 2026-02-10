/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { Children, cloneElement, isValidElement, useMemo } from 'react';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { Dispatch, ReactElement, ReactNode, RefObject, SetStateAction } from 'react';

export type TabContainerHeaderProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  children: ReactNode;
  // Custom Props
  tabSelected?: number;
  onSelect?: Dispatch<SetStateAction<number>>;
};

const TabContainerHeader = ({ ref, className = '', tabSelected, children, onSelect }: TabContainerHeaderProps) => {
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
          internalProps: { isHeader: true, onSelect, tabSelected, tabIndex: i }
        })
      );
    });

    return components;
  }, [children, onSelect, tabSelected]);

  return (
    <RootElement ref={ref} className={clsx('plitzi-component__tab-container-header', className)}>
      {childrenParsed}
    </RootElement>
  );
};

export default withElement(TabContainerHeader);

export { TabContainerHeader };
