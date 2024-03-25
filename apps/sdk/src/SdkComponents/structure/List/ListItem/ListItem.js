// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

const ListItem = forwardRef((props, ref) => {
  const { className = '', internalProps = emptyObject, children } = props;

  return (
    <RootElement
      tag="li"
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__list-item', className)}
    >
      {children}
    </RootElement>
  );
});

ListItem.propTypes = {
  internalProps: PropTypes.object,
  children: PropTypes.node,
  className: PropTypes.string
};

export default withElement(ListItem);

export { ListItem };
