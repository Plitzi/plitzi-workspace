// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import { emptyObject } from '../../../helpers/utils';

const Paragraph = forwardRef((props, ref) => {
  const { content = 'Paragraph', className = '', internalProps = emptyObject } = props;

  return (
    <RootElement
      ref={ref}
      tag="p"
      internalProps={internalProps}
      className={classNames('plitzi-component__paragraph', className)}
    >
      {content || 'Paragraph'}
    </RootElement>
  );
});

Paragraph.propTypes = {
  className: PropTypes.string,
  internalProps: PropTypes.object,
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};

export default withElement(Paragraph);

export { Paragraph };
