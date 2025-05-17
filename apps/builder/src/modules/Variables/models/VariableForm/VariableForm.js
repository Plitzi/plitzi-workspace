// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import Button from '@plitzi/plitzi-ui/Button';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Alert from '@plitzi/plitzi-ui-components/Alert';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import VariableSubValue from './VariableSubValue';
import VariableValue from './VariableValue';

const subValuesDefault = [];

/**
 * @param {{
 *   className?: string;
 *   name?: string;
 *   category?: string;
 *   value?: string;
 *   type?: string;
 *   subValues?: [object];
 *   whenData?: object;
 *   isNewRecord?: boolean;
 *   onClose?: () => void;
 *   onSubmit?: (values: { name: string; category: string; value: string; type: string; subValues: [object] }) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const VariableForm = props => {
  const {
    className = '',
    name = 'variable',
    category = '',
    value = '',
    type = 'text',
    subValues = subValuesDefault,
    whenData = emptyObject,
    isNewRecord = false,
    onSubmit = noop,
    onClose = noop
  } = props;

  const { control, handleSubmit, watch, setValue } = useForm({
    defaultValues: { name, category, value, type, subValues }
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: 'subValues', rules: { minLength: 0 } });
  const currentType = watch('type');
  const currentSubValues = watch('subValues');

  const handleSubmitInternal = values => onSubmit(values);

  const hasSubValues = currentSubValues && currentSubValues?.length > 0;

  const handleClickFieldAppend = useCallback(() => append({ value: '', when: undefined }), [append]);

  const handleClickFieldUp = useCallback(
    index => () => {
      if (index > 0) {
        move(index, index - 1);
      }
    },
    [move]
  );

  const handleClickFieldDown = useCallback(
    index => () => {
      if (index < fields.length - 1) {
        move(index, index + 1);
      }
    },
    [fields, move]
  );

  const handleClickFieldRemove = useCallback(index => () => remove(index), [remove]);

  return (
    <form className={classNames('flex flex-col gap-2', className)} onSubmit={handleSubmit(handleSubmitInternal)}>
      <div className="flex gap-2">
        <Controller
          control={control}
          rules={{
            required: true,
            pattern: {
              value: /^(?:\w+\s+|)([a-zA-Z_][a-zA-Z0-9_]+)$/i,
              message: 'Invalid variable name'
            }
          }}
          name="name"
          render={({ field: { onChange, value, name }, fieldState: { error } }) => (
            <FormControl
              type="text"
              name={name}
              label="Name"
              size="sm"
              placeholder="Name"
              className="w-full"
              inputClassName="rounded-sm"
              onChange={e => onChange(e.target.value)}
              value={value}
              error={error}
              disabled={!isNewRecord}
            />
          )}
        />
        <Controller
          control={control}
          rules={{ required: false }}
          name="type"
          render={({ field: { onChange, value, name }, fieldState: { error } }) => (
            <FormControl
              type="select2"
              size="sm"
              inputProps={{
                options: [
                  { value: 'text', label: 'Text' },
                  { value: 'number', label: 'Number' },
                  { value: 'email', label: 'Email' },
                  { value: 'password', label: 'Password' },
                  { value: 'select', label: 'Select' },
                  { value: 'select2', label: 'Select2' },
                  { value: 'checkbox', label: 'Checkbox' },
                  { value: 'textarea', label: 'Textarea' },
                  { value: 'color', label: 'Color' },
                  { value: 'switch', label: 'Switch' }
                ]
              }}
              name={name}
              label="Type"
              placeholder="Type"
              className="w-full"
              inputClassName="rounded-sm"
              onChange={option => {
                onChange(option?.value ?? 'text');
                setValue('value', '');
                setValue('whenSuccessValue', '');
                setValue('whenFailValue', '');
              }}
              value={value}
              error={error}
            />
          )}
        />
      </div>
      <VariableValue valueType={currentType} control={control} hasSubValues={hasSubValues} name="value" />
      {hasSubValues && (
        <Alert intent="info" className="text-white text-xs" containerClassName="items-center">
          Based on the logic the variable will take one of these values from top to down
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <VariableSubValue
                whenData={whenData}
                control={control}
                valueType={currentType}
                index={index}
                indexLimit={fields.length - 1}
                onClickRemove={handleClickFieldRemove(index)}
                onClickUp={handleClickFieldUp(index)}
                onClickDown={handleClickFieldDown(index)}
              />
            </div>
          ))}
        </div>
        <Button size="xs" title="Down" onClick={handleClickFieldAppend}>
          + Conditional Value
        </Button>
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={onClose} size="sm">
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Submit
        </Button>
      </div>
    </form>
  );
};

export default VariableForm;
