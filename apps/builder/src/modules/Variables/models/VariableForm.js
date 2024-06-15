// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import { useForm, Controller } from 'react-hook-form';
import Button from '@plitzi/plitzi-ui-components/Button';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import QueryBuilder from '@plitzi/plitzi-ui-components/QueryBuilder';
import Alert from '@plitzi/plitzi-ui-components/Alert';

// Monorepo
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/utils';

/**
 * @param {{
 *   className?: string;
 *   name?: string;
 *   category?: string;
 *   value?: string;
 *   type?: string;
 *   when?: object;
 *   whenSuccessValue?: string;
 *   whenFailValue?: string;
 *   routeParams?: object;
 *   queryParams?: object;
 *   hostname?: string;
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
    whenSuccessValue = '',
    whenFailValue = '',
    routeParams = emptyObject,
    queryParams = emptyObject,
    hostname = '',
    onSubmit = noop,
    onClose = noop
  } = props;

  const { control, handleSubmit, watch, resetField } = useForm({
    defaultValues: { name, category, value, type, when, whenSuccessValue, whenFailValue }
  });
  const currentType = watch('type');
  const currentWhen = watch('when');

  const handleSubmitInternal = values => onSubmit(values);

  const fieldsDataSource = useMemo(
    () =>
      getPathsFromObeject({ routeParams, queryParams, hostname }).reduce(
        (acum, path) => ({ ...acum, [path]: { name: path, label: path, placeholder: `Enter ${path}` } }),
        {}
      ),
    [routeParams, queryParams, hostname]
  );

  const hasWhen = currentWhen && currentWhen?.rules.length > 0;

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
                resetField('whenSuccessValue', '');
                resetField('whenFailValue', '');
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
              label={hasWhen ? 'Default Value' : 'Value'}
              placeholder={hasWhen ? 'Default Value' : 'Value'}
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
      <Controller
        control={control}
        rules={{ required: false }}
        name="when"
        render={({ field: { onChange, value } }) => {
          return (
            <div>
              <label className="mb-1 font-medium text-gray-500 text-sm">When</label>
              <QueryBuilder
                ruleDirection="vertical"
                className="w-full"
                query={value}
                fields={fieldsDataSource}
                onChange={query => onChange(query)}
                showBranches
              />
            </div>
          );
        }}
      />
      {hasWhen && (
        <Alert intent="info" className="text-white text-sm" containerClassName="items-center">
          Based on the logic the variable will take one of these 2 values
        </Alert>
      )}
      {hasWhen && (
        <div className="flex gap-4">
          <Controller
            control={control}
            rules={{ required: false }}
            name="whenSuccessValue"
            render={({ field: { onChange, value, name }, fieldState: { error } }) => {
              return (
                <FormControl
                  type={currentType}
                  name={name}
                  label="When logic success"
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
          <Controller
            control={control}
            rules={{ required: false }}
            name="whenFailValue"
            render={({ field: { onChange, value, name }, fieldState: { error } }) => {
              return (
                <FormControl
                  type={currentType}
                  name={name}
                  label="When logic fail"
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
        </div>
      )}

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
