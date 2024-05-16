// Packages
import React, { useMemo } from 'react';

// Relatives
import svgIcons from './svg';

/**
 * @param {{
 *   width?: number;
 *   height?: number;
 *   type: string;
 *   className?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const Icons = props => {
  const { width = 20, height = 20, type, className = '', ...otherProps } = props;
  const Icon = useMemo(() => svgIcons[type], [type]);
  if (!Icon) {
    return undefined;
  }

  return <Icon className={className} width={width} height={height} {...otherProps} />;
};

export default Icons;
