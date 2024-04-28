// Packages
import React from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';
import Select from '@plitzi/plitzi-ui-components/Select';

/**
 * @param {{
 *   className?: string;
 *   children?: React.ReactNode;
 *   value?: string | number;
 *   onChange?: (value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const GroupSelect = props => {
  const { className = '', children, value = '', onChange = noop, ...otherProps } = props;

  return (
    <Select
      className={classNames('rounded-md basis-0 grow border-0 rounded-none text-xs px-2 py-0 m-0', className)}
      value={value}
      size="custom"
      onChange={onChange}
      {...otherProps}
    >
      {children}
    </Select>
  );
};

export default GroupSelect;
