// Packages
import React from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';

/**
 * @param {{
 *   className?: string;
 *   value?: string | number;
 *   type?: string;
 *   onChange?: (value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const GroupInput = props => {
  const { className = '', value = '', type = 'number', onChange = noop, ...otherProps } = props;

  return (
    <Input
      className={classNames('flex basis-0 grow min-h-0', className)}
      inputClassName="rounded px-1 py-0 m-0 text-xs border-none"
      size="custom"
      type={type}
      value={value}
      onChange={onChange}
      {...otherProps}
    />
  );
};

export default GroupInput;
