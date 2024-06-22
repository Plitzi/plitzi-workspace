// Packages
import React from 'react';
import { Controller, UseFormMethods } from 'react-hook-form';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';

/**
 * @param {{
 *   control: UseFormMethods;
 *   valueType?: string;
 *   hasSubValues?: boolean;
 *   name?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const VariableValue = props => {
  const { control, valueType = 'text', hasSubValues = false, name = 'value' } = props;

  return (
    <Controller
      control={control}
      rules={{ required: true }}
      name={name}
      render={({ field: { onChange, value, name }, fieldState: { error } }) => {
        return (
          <FormControl
            type={valueType}
            name={name}
            label={hasSubValues ? 'Fallback Value' : 'Value'}
            placeholder={hasSubValues ? 'Fallback Value' : 'Value'}
            className="w-full"
            inputClassName="rounded"
            size="sm"
            onChange={e => {
              switch (valueType) {
                case 'color':
                  onChange(e);
                  break;

                case 'number':
                  onChange(parseFloat(e.target.value));
                  break;

                case 'checkbox':
                  onChange(e.target.checked);
                  break;

                default:
                  onChange(e.target.value);
              }
            }}
            value={value}
            error={error}
          />
        );
      }}
    />
  );
};

export default VariableValue;
