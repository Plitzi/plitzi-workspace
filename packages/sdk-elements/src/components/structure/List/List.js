// Packages
import React from 'react';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import withElement from '../../../Element/hocs/withElement.js';
import ListBasic from './modes/ListBasic.js';
import ListControlled from './modes/ListControlled/index.js';

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
