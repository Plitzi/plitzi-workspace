/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { ReactNode, RefObject } from 'react';

export type ListItemProps = {
  id: string;
  ref: RefObject<HTMLElement>;
  className: string;
  children: ReactNode;
};

const ListItem = ({ id, ref, className = '', children }: ListItemProps) => {
  return (
    <RootElement id={id} tag="li" ref={ref} className={clsx('plitzi-component__list-item', className)}>
      {children}
    </RootElement>
  );
};

export default withElement(ListItem);

export { ListItem };
