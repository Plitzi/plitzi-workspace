/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type ListItemProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  internalProps: InternalPropsSTG2;
  children: ReactNode;
};

const ListItem = ({ ref, className = '', internalProps, children }: ListItemProps) => {
  return (
    <RootElement
      tag="li"
      ref={ref}
      internalProps={internalProps}
      className={clsx('plitzi-component__list-item', className)}
    >
      {children}
    </RootElement>
  );
};

export default withElement(ListItem);

export { ListItem };
