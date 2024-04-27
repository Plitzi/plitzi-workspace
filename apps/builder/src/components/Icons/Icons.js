// Packages
import React, { lazy, Suspense, useMemo } from 'react';

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

export default Icons;
