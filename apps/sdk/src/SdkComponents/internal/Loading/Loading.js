// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relative
import { emptyObject } from '../../../helpers/utils';

const Loading = forwardRef((props, ref) => {
  const { className = '', internalProps = emptyObject } = props;
  const {
    definition: { label }
  } = internalProps;

  return (
    <RootElement ref={ref} internalProps={internalProps} className={classNames('plitzi-component__loading', className)}>
      <span>
        <b>{label}</b> Loading...
      </span>
    </RootElement>
  );
});

Loading.propTypes = {
  internalProps: PropTypes.object,
  className: PropTypes.string
};

export default withElement(Loading);
