// Packages
import React, { useMemo } from 'react';
import { Controller, UseFormMethods } from 'react-hook-form';
import QueryBuilder from '@plitzi/plitzi-ui-components/QueryBuilder';

// Monorepo
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/utils';
import VariableValue from './VariableValue';

/**
 * @param {{
 *   index?: number;
 *   control: UseFormMethods;
 *   valueType?: string;
 *   whenData?: object;
 * }} props
 * @returns {React.ReactElement}
 */
const VariableSubValue = props => {
  const { index = 0, control, valueType = 'text', whenData = emptyObject } = props;

  const fieldsDataSource = useMemo(
    () =>
      getPathsFromObeject(whenData).reduce(
        (acum, path) => ({ ...acum, [path]: { name: path, label: path, placeholder: `Enter ${path}` } }),
        {}
      ),
    [whenData]
  );

  return (
    <div className="border border-gray-300 rounded p-2 flex flex-col gap-2 grow">
      <VariableValue valueType={valueType} control={control} name={`subValues.${index}.value`} />
      <Controller
        control={control}
        rules={{
          required: true,
          validate: value => (value?.rules?.length > 0 ? true : 'This field is required')
        }}
        name={`subValues.${index}.when`}
        render={({ field: { onChange, value }, fieldState: { error } }) => {
          let errorMessage = '';
          if (error?.type === 'required' || error?.type === 'validate') {
            errorMessage = error?.message || 'This field is required';
          }

          return (
            <div className="flex flex-col">
              <label className="mb-1 font-medium text-gray-500 text-xs">When</label>
              <QueryBuilder
                ruleDirection="vertical"
                className="w-full"
                query={value}
                fields={fieldsDataSource}
                onChange={query => onChange(query)}
                showBranches
                hasError={!!errorMessage}
              />
              {errorMessage && <div className="text-red-500 mt-1 text-sm">{errorMessage}</div>}
            </div>
          );
        }}
      />
    </div>
  );
};

export default VariableSubValue;
