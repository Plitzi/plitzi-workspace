// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relative
import { emptyObject } from '../../../helpers/utils';

const Text = forwardRef((props, ref) => {
  const { content = 'Text', className = '', internalProps = emptyObject } = props;

  return (
    <RootElement ref={ref} internalProps={internalProps} className={classNames('plitzi-component__text', className)}>
      {content || 'Text'}
    </RootElement>
  );
});

Text.propTypes = {
  internalProps: PropTypes.object,
  className: PropTypes.string,
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};

export default withElement(Text);

export { Text };
