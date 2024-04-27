// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import upperFirst from 'lodash/upperFirst';
import Input from '@plitzi/plitzi-ui-components/Input';
import Select2 from '@plitzi/plitzi-ui-components/Select2';

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

  const handleChange = useCallback(
    e => {
      if (type === 'text') {
        onChange(id, e.target.value);
      } else if (type === 'select') {
        onChange(id, e.value);
      }
    },
    [id, onChange]
  );

  return (
    <div className={classNames('flex flex-col w-full not-first:mt-4', className)}>
      <label htmlFor={id}>{upperFirst(id)}</label>
      {type === 'text' && (
        <Input className="w-full" inputClassName="rounded" id={id} value={value} onChange={handleChange} />
      )}
      {type === 'select' && (
        <Select2
          className="rounded w-full"
          size="sm"
          placeholder={`Select a ${upperFirst(id)}`}
          value={value}
          onChange={handleChange}
          options={options}
        />
      )}
    </div>
  );
};

export default NodeBodyParam;
