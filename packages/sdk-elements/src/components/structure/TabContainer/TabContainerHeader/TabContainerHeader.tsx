/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import React from 'react';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';

type InternalPropsSubProps = {
  tabSelected?: number;
  onSelect?: Dispatch<SetStateAction<number>>;
};

export type TabContainerHeaderProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  internalProps: InternalProps<InternalPropsSubProps>;
  children: ReactNode;
};

const TabContainerHeader = ({
  ref,
  className = '',
  internalProps = emptyObject as InternalProps<InternalPropsSubProps>,
  children
}: TabContainerHeaderProps) => {
  const { onSelect, tabSelected } = internalProps;

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__tab-container-header', className)}
    >
      {Array.isArray(children) &&
        children.map((child, i) =>
          React.cloneElement(child, {
            ...child.props,
            internalProps: { isHeader: true, onSelect, tabSelected, tabIndex: i }
          })
        )}
    </RootElement>
  );
};

export default withElement(TabContainerHeader);

export { TabContainerHeader };
