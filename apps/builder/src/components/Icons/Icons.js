// Packages
import React, { lazy, Suspense, useMemo } from 'react';
import PropTypes from 'prop-types';

const Icons = props => {
  const { width = 20, height = 20, type, className = '', ...otherProps } = props;

  const Icon = useMemo(
    () => lazy(() => import(`./svg/${type}`).catch(() => ({ default: () => <div>Not found</div> }))),
    [type]
  );

  return (
    <Suspense>
      <Icon className={className} width={width} height={height} {...otherProps} />
    </Suspense>
  );
};

Icons.propTypes = {
  className: PropTypes.string,
  type: PropTypes.string,
  width: PropTypes.number,
  height: PropTypes.number
};

export default Icons;
