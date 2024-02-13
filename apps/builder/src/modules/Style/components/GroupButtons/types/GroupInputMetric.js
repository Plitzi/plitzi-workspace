// Packages
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';
import InputMetric from '@plitzi/plitzi-ui-components/InputMetric';

const GroupInputMetric = props => {
  const { className = '', value = '', onChange = noop, ...otherProps } = props;

  return (
    <InputMetric
      value={value}
      onChange={onChange}
      size="custom"
      emptyValue="auto"
      className={classNames('flex basis-0 grow min-h-0 !min-w-0 border-0', className)}
      inputClassName="rounded px-2 py-0 m-0 text-xs"
      unitClassName="text-xs pr-2"
      {...otherProps}
    />
  );
};

GroupInputMetric.propTypes = {
  className: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func
};

export default GroupInputMetric;
