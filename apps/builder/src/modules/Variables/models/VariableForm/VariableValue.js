// Packages
import React from 'react';
import { Controller } from 'react-hook-form';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';

// Relatives
import VariableSubValueActions from './VariableSubValueActions';

/**
 * @param {{
 *   control: import('react-hook-form').UseFormMethods;
 *   valueType?: string;
 *   hasSubValues?: boolean;
 *   name?: string;
 *   index?: number;
 *   indexLimit?: number;
 *   onClickRemove?: () => void;
 *   onClickUp?: () => void;
 *   onClickDown?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const VariableValue = props => {
  const {
    control,
    valueType = 'text',
    hasSubValues = false,
    name = 'value',
    isSubValue = false,
    index,
    indexLimit,
    onClickRemove,
    onClickUp,
    onClickDown
  } = props;

  return (
    <div className="flex items-end gap-2">
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
              className="min-w-0 w-full"
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
      {isSubValue && (
        <VariableSubValueActions
          index={index}
          indexLimit={indexLimit}
          onClickRemove={onClickRemove}
          onClickUp={onClickUp}
          onClickDown={onClickDown}
        />
      )}
    </div>
  );
};

export default VariableValue;
