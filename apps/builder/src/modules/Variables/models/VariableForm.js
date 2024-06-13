// Packages
import React from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import { useForm, Controller } from 'react-hook-form';
import Button from '@plitzi/plitzi-ui-components/Button';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';

/**
 * @param {{
 *   className?: string;
 *   name?: string;
 *   category?: string;
 *   value?: string;
 *   type?: string;
 *   when?: object;
 *   onClose?: () => void;
 *   onSubmit?: (values: { name: string; category: string; value: string; type: string; when: object }) => void;
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
    when,
    onSubmit = noop,
    onClose = noop
  } = props;

  const { control, handleSubmit, watch, resetField } = useForm({
    defaultValues: { name, category, value, type, when }
  });
  const currentType = watch('type');

  const handleSubmitInternal = values => onSubmit(values);

  return (
    <form className={classNames('flex flex-col p-3 gap-4', className)} onSubmit={handleSubmit(handleSubmitInternal)}>
      <div className="flex gap-4">
        <Controller
          control={control}
          rules={{ required: true }}
          name="name"
          render={({ field: { onChange, value, name }, fieldState: { error } }) => (
            <FormControl
              type="text"
              name={name}
              label="Name"
              placeholder="Name"
              className="w-full"
              inputClassName="rounded"
              onChange={e => onChange(e.target.value)}
              value={value}
              error={error}
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
              inputClassName="rounded"
              onChange={option => {
                onChange(option?.value ?? 'text');
                resetField('value', '');
              }}
              value={value}
              error={error}
            />
          )}
        />
      </div>
      <Controller
        control={control}
        rules={{ required: false }}
        name="value"
        render={({ field: { onChange, value, name }, fieldState: { error } }) => {
          return (
            <FormControl
              type={currentType}
              name={name}
              label="Value"
              placeholder="Value"
              className="w-full"
              inputClassName="rounded"
              onChange={e => {
                switch (currentType) {
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
      <div className="flex justify-end">
        <Button onClick={onClose} className="mr-3 rounded-md">
          Cancel
        </Button>
        <Button type="submit" className="rounded-md">
          Submit
        </Button>
      </div>
    </form>
  );
};

export default VariableForm;
