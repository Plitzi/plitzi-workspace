// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import upperFirst from 'lodash/upperFirst';
import Input from '@plitzi/plitzi-ui/Input';
import Select2 from '@plitzi/plitzi-ui/Select2';

const optionsDefault = [];

/**
 * @param {{
 *   className?: string;
 *   id?: string;
 *   value?: string;
 *   type?: 'text' | 'select';
 *   options?: any[];
 *   onChange?: (id: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const NodeBodyParam = props => {
  const { className = '', id = '', value = '', type = 'text', options = optionsDefault, onChange = noop } = props;

  const handleChange = useCallback(value => onChange(id, value), [id, onChange]);

  const handleChangeSelect = useCallback(option => onChange(id, option?.value ?? ''), [id, onChange]);

  return (
    <div className={classNames('flex w-full flex-col [&:not(:first-child)]:mt-4', className)}>
      <label htmlFor={id}>{upperFirst(id)}</label>
      {type === 'text' && <Input className="w-full" id={id} value={value} onChange={handleChange} />}
      {type === 'select' && (
        <Select2
          className="w-full"
          size="sm"
          placeholder={`Select a ${upperFirst(id)}`}
          value={value}
          onChange={handleChangeSelect}
          options={options}
        />
      )}
    </div>
  );
};

export default NodeBodyParam;
