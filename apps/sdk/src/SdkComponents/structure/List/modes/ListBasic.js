// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import RootElement from '@modules/Element/RootElement';

// Relative
import { emptyObject } from '../../../../helpers/utils';

const ListBasic = forwardRef((props, ref) => {
  const { className = '', subType = 'ul', internalProps = emptyObject, children } = props;

  return (
    <RootElement
      ref={ref}
      tag={subType}
      internalProps={internalProps}
      className={classNames('plitzi-component__list', className)}
    >
      {children}
    </RootElement>
  );
});

ListBasic.propTypes = {
  internalProps: PropTypes.object,
  children: PropTypes.node,
  subType: PropTypes.oneOf(['ul', 'ol']),
  className: PropTypes.string
};

export default ListBasic;
