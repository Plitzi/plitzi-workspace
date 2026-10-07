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
  /**
   * The field of each item that names it — `'slug'`, `'sku'` — so a row stays with its item when the items are
   * filtered or reordered, and mounts again when its item changes. Left out: the item's `id`, else its position.
   */
  itemKey?: string;
  /** What a screen reader calls the list — a group of options, a set of results — said before its rows. */
  label?: string;
};

const List = ({
  ref,
  className = '',
  subType = 'ul',
  children,
  items = [],
  source = 'none',
  itemKey,
  label = ''
}: ListProps) => {
  switch (source) {
    case 'controlled':
      return (
        <ListControlled ref={ref} className={className} subType={subType} items={items} itemKey={itemKey} label={label}>
          {children}
        </ListControlled>
      );

    case 'none':
    default:
      return (
        <ListBasic ref={ref} className={className} subType={subType} label={label}>
          {children}
        </ListBasic>
      );
  }
};

export default withElement(List);

export { List };
