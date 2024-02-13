// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import ListBasic from './modes/ListBasic';
import ListControlled from './modes/ListControlled';
import { emptyObject } from '../../../helpers/utils';

const List = forwardRef((props, ref) => {
  const { className = '', subType = 'ul', internalProps = emptyObject, children, items = [], source = 'none' } = props;
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
});

List.propTypes = {
  className: PropTypes.string,
  internalProps: PropTypes.object,
  children: PropTypes.node,
  subType: PropTypes.oneOf(['ul', 'ol']),
  items: PropTypes.array,
  source: PropTypes.oneOf(['none', 'controlled'])
};

export default withElement(List);

export { List };
