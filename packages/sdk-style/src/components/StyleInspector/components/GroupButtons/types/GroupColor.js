// Packages
import React from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';
import ColorPicker from '@plitzi/plitzi-ui-components/ColorPicker';

/**
 * @param {{
 *   className?: string;
 *   value?: string | number;
 *   onChange?: (value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const GroupColor = props => {
  const { className = '', value = '', onChange = noop, ...otherProps } = props;

  return (
    <ColorPicker
      value={value}
      onChange={onChange}
      className={classNames('w-full grow rounded-md border-0 px-0.5 py-0 text-xs', className)}
      inputClassName="px-1 py-0"
      size="sm"
      {...otherProps}
    />
  );
};

export default GroupColor;
