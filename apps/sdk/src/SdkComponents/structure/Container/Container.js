// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

const Container = forwardRef((props, ref) => {
  const { className = '', subType = 'div', internalProps = emptyObject, children } = props;

  return (
    <RootElement
      ref={ref}
      tag={subType}
      internalProps={internalProps}
      className={classNames('plitzi-component__container', className)}
    >
      {children}
    </RootElement>
  );
});

Container.propTypes = {
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

export default withElement(Container);

export { Container };
