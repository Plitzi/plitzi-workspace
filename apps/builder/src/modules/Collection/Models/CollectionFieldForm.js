// Packages
import React, { useCallback } from 'react';
import noop from 'lodash/noop';
import snakeCase from 'lodash/snakeCase';
import { useForm, Controller } from 'react-hook-form';
import Button from '@plitzi/plitzi-ui-components/Button';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Icon from '@plitzi/plitzi-ui/Icon';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import { fieldTypes } from '../CollectionsConstants';

/**
 * @param {{
 *   isNewField?: boolean;
 *   name?: string;
 *   machineName?: string;
 *   type?: string;
 *   params?: object;
 *   onSubmit?: (values: object) => void;
 *   onValidate?: (values: object) => { key: string; message: string } | null;
 * }} props
 * @returns {React.ReactElement}
 */
const CollectionFieldForm = props => {
  const {
    name = '',
    type = 'text',
    machineName = '',
    params = emptyObject,
    onSubmit = noop,
    onValidate = noop
  } = props;
  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { dirtyFields }
  } = useForm({
    defaultValues: { name, machineName, params, type }
  });

  const handleSubmitInternal = useCallback(
    values => {
      const error = onValidate(values);
      if (error) {
        setError(error.key, { message: error.message });

        return;
      }

      onSubmit(values);
      reset();
    },
    [onSubmit, reset, onValidate, setError]
  );

  const handleResetInternal = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <form
      onSubmit={handleSubmit(handleSubmitInternal)}
      onReset={handleResetInternal}
      className="justify-between gap-10 flex"
    >
      <div className="flex items-start grow basis-0 text-md">
        <Controller
          control={control}
          rules={{ required: true }}
          name="name"
          render={({ field: { onChange, value, name }, fieldState: { error } }) => (
            <FormControl
              type="text"
              name={name}
              size="md"
              placeholder="Field Name"
              className="grow basis-0"
              inputClassName="rounded"
              errorClassName="text-xs"
              onChange={e => {
                onChange(e.target.value);
                if (!dirtyFields.machineName) {
                  setValue('machineName', snakeCase(e.target.value));
                }
              }}
              value={value}
              error={error}
            />
          )}
        />
      </div>
      <div className="flex items-start grow basis-0 text-md">
        <Controller
          control={control}
          rules={{ required: true }}
          name="machineName"
          render={({ field: { onChange, value, name }, fieldState: { error } }) => (
            <FormControl
              type="text"
              name={name}
              size="md"
              placeholder="Unique Identifier"
              className="grow basis-0"
              inputClassName="rounded"
              errorClassName="text-xs"
              onChange={e => onChange(e.target.value)}
              value={value}
              error={error}
            />
          )}
        />
      </div>
      <div className="flex items-start grow basis-0">
        <Controller
          control={control}
          rules={{ required: false }}
          name="type"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <Dropdown width={200} height={300} showIcon={false} className="flex w-full border border-gray-300 rounded">
              <Dropdown.Content className="flex items-center w-full h-full px-4 py-2">
                {type && (
                  <span className="text-sm">
                    <i className={`${fieldTypes[value].icon} mr-1`} />
                    {fieldTypes[value].label}
                  </span>
                )}
                {error && <div className="text-red-500 mt-1 text-sm">{error?.message ?? error}</div>}
              </Dropdown.Content>
              <Dropdown.Container className="h-[300px] w-[200px] select-none">
                <ul className="overflow-y-auto h-full">
                  {Object.keys(fieldTypes).map((typeKey, i) => {
                    const fieldType = fieldTypes[typeKey];

                    return (
                      <li
                        key={i}
                        className="px-4 py-2 hover:bg-blue-300 hover:text-white not-last:border-b border-gray-300 flex items-center justify-between cursor-pointer"
                        onClick={() => onChange(typeKey)}
                      >
                        <div className="flex">
                          <i className={`${fieldType.icon} mr-2`} />
                          <div className="text-xs mt-1 text-center">{fieldType.label}</div>
                        </div>
                        {value === typeKey && <i className="fa-solid fa-check text-blue-400 text-xs" />}
                      </li>
                    );
                  })}
                </ul>
              </Dropdown.Container>
            </Dropdown>
          )}
        />
      </div>
      <div className="flex items-center justify-center w-[100px] text-xl">
        <Controller
          control={control}
          rules={{ required: false }}
          name="params.required"
          render={({ field: { onChange, value, name }, fieldState: { error } }) => (
            <FormControl
              type="checkbox"
              name={name}
              size="lg"
              placeholder=""
              className="justify-center items-center"
              errorClassName="text-xs"
              onChange={e => onChange(e.target.checked)}
              inputProps={{ checked: value }}
              error={error}
            />
          )}
        />
      </div>
      <div className="flex items-center justify-center w-[100px] text-xl">
        <Controller
          control={control}
          rules={{ required: false }}
          name="params.primary"
          render={({ field: { onChange, value, name }, fieldState: { error } }) => (
            <FormControl
              type="checkbox"
              name={name}
              size="lg"
              placeholder=""
              className="justify-center items-center"
              errorClassName="text-xs"
              onChange={e => onChange(e.target.checked)}
              inputProps={{ checked: value }}
              error={error}
              isFirstField
            />
          )}
        />
      </div>
      <div className="flex gap-4 items-center justify-center w-[150px]">
        <Button intent="custom" size="custom" type="reset" title="Cancel">
          <Icon icon="fas fa-trash" intent="danger" className="p-1 cursor-pointer" />
        </Button>
        <Button intent="custom" size="custom" type="submit" title="Save">
          <Icon icon="fa-solid fa-check" intent="success" />
        </Button>
      </div>
    </form>
  );
};

export default CollectionFieldForm;
