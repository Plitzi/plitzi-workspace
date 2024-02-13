// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relative
import { emptyObject } from '../../../helpers/utils';

const LayoutContainer = forwardRef((props, ref) => {
  const { className = '', internalProps = emptyObject, children, subType = 'div' } = props;

  return (
    <RootElement
      ref={ref}
      tag={subType}
      internalProps={internalProps}
      className={classNames('plitzi-component__layout-container', className)}
    >
      {children}
    </RootElement>
  );
});

LayoutContainer.propTypes = {
  className: PropTypes.string,
  internalProps: PropTypes.object,
  children: PropTypes.node,
  subType: PropTypes.oneOf([
    'div',
    'header',
    'footer',
    'nav',
    'main',
    'section',
    'article',
    'aside',
    'address',
    'figure'
  ])
};

export default withElement(LayoutContainer);

export { LayoutContainer };
