/* eslint-disable react-refresh/only-export-components */

import ListBasic from './modes/ListBasic';
import ListControlled from './modes/ListControlled';
import withElement from '../../../Element/hocs/withElement';

import type { ReactNode, RefObject } from 'react';

export type ListProps<T = unknown> = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  subType?: 'ul' | 'ol';
  children?: ReactNode;
  items?: T[];
  source?: 'none' | 'controlled';
};

const List = ({ ref, className = '', subType = 'ul', children, items = [], source = 'none' }: ListProps) => {
  switch (source) {
    case 'controlled':
      return (
        <ListControlled ref={ref} className={className} items={items}>
          {children}
        </ListControlled>
      );

    case 'none':
    default:
      return (
        <ListBasic ref={ref} className={className} subType={subType}>
          {children}
        </ListBasic>
      );
  }
};

export default withElement(List);

export { List };
