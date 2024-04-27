// Packages
import React from 'react';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';

// Relatives
import ListBasic from './modes/ListBasic';
import ListControlled from './modes/ListControlled';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   className: string;
 *   subType: 'ul' | 'ol';
 *   internalProps: object;
 *   children: React.ReactNode;
 *   items: object[];
 *   source: 'none' | 'controlled';
 * }} props
 * @returns {React.ReactElement}
 */
const List = props => {
  const {
    ref,
    className = '',
    subType = 'ul',
    internalProps = emptyObject,
    children,
    items = [],
    source = 'none'
  } = props;
  switch (source) {
    case 'controlled':
      return (
        <ListControlled ref={ref} className={className} internalProps={internalProps} items={items}>
          {children}
        </ListControlled>
      );

    case 'none':
    default:
      return (
        <ListBasic ref={ref} className={className} internalProps={internalProps} subType={subType}>
          {children}
        </ListBasic>
      );
  }
};

export default withElement(List);

export { List };
