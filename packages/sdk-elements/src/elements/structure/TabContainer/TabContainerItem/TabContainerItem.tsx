/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback } from 'react';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { Dispatch, RefObject, SetStateAction, ReactNode } from 'react';

export type TabContainerItemProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  children: ReactNode;
  // Custom Props
  tabSelected?: number;
  tabIndex?: number;
  isHeader?: boolean;
  onSelect?: Dispatch<SetStateAction<number>>;
};

const TabContainerItem = ({
  className = '',
  children,
  ref,
  tabSelected,
  tabIndex = 0,
  isHeader,
  onSelect
}: TabContainerItemProps) => {
  const handleClick = useCallback(() => {
    if (!isHeader || tabSelected === tabIndex) {
      return;
    }

    onSelect?.(tabIndex);
  }, [isHeader, tabSelected, tabIndex, onSelect]);

  return (
    <RootElement
      ref={ref}
      onClick={handleClick}
      className={clsx('plitzi-component__tab-container-item', className, {
        active: tabSelected === tabIndex
      })}
    >
      {children}
    </RootElement>
  );
};

export default withElement(TabContainerItem);

export { TabContainerItem };
