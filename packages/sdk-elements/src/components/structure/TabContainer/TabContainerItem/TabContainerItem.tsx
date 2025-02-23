/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import React, { useCallback } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
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
  internalProps: InternalProps<InternalPropsSubProps>;
  children: React.ReactNode;
};

const TabContainerItem = ({
  className = '',
  internalProps = emptyObject as InternalProps<InternalPropsSubProps>,
  children,
  ref
}: TabContainerItemProps) => {
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
      internalProps={internalProps}
      onClick={handleClick}
      className={classNames('plitzi-component__tab-container-item', className, {
        active: tabSelected === tabIndex
      })}
    >
      {children}
    </RootElement>
  );
};

export default withElement(TabContainerItem);

export { TabContainerItem };
