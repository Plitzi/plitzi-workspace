/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import React, { useCallback } from 'react';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { Dispatch, RefObject, SetStateAction } from 'react';

type InternalPropsSubProps = {
  tabSelected?: number;
  tabIndex?: number;
  isHeader?: boolean;
  onSelect?: Dispatch<SetStateAction<number>>;
};

export type TabContainerItemProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  internalProps: InternalPropsSTG2<InternalPropsSubProps>;
  children: React.ReactNode;
};

const TabContainerItem = ({ className = '', internalProps, children, ref }: TabContainerItemProps) => {
  const { tabSelected, tabIndex = 0, isHeader, onSelect } = internalProps;

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
