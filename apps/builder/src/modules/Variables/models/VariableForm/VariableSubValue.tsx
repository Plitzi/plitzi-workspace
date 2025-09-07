import Form from '@plitzi/plitzi-ui/Form';
import Heading from '@plitzi/plitzi-ui/Heading';
import QueryBuilder from '@plitzi/plitzi-ui/QueryBuilder';
import { useMemo } from 'react';

import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';

import VariableValue from './VariableValue';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { QueryParams, RouteParams, SchemaVariable, ServerEnvironment } from '@plitzi/sdk-shared';

export type VariableSubValueProps = {
  valueType?: SchemaVariable['type'];
  whenData?: {
    routeParams: RouteParams;
    queryParams: QueryParams;
    hostname?: string;
    environment: ServerEnvironment;
  };
  index?: number;
  indexLimit?: number;
  onClickRemove?: () => void;
  onClickUp?: () => void;
  onClickDown?: () => void;
};

const VariableSubValue = ({
  index = 0,
  valueType = 'text',
  whenData,
  indexLimit,
  onClickRemove,
  onClickUp,
  onClickDown
}: VariableSubValueProps) => {
  const fieldsDataSource = useMemo(
    () =>
      getPathsFromObeject(whenData).reduce(
        (acum, path) => ({ ...acum, [path]: { name: path, label: path, placeholder: `Enter ${path}` } }),
        {}
      ),
    [whenData]
  );

  return (
    <div className="flex min-w-0 grow basis-0 flex-col gap-2 rounded-sm border border-gray-300 p-2">
      <VariableValue
        valueType={valueType}
        name={`subValues.${index}.value`}
        isSubValue
        index={index}
        indexLimit={indexLimit}
        onClickRemove={onClickRemove}
        onClickUp={onClickUp}
        onClickDown={onClickDown}
      />
      <Form.Custom
        name={`subValues.${index}.when`}
        render={({ field: { ref, value, onChange }, fieldState: { error } }) => (
          <div className="flex flex-col gap-2" ref={ref}>
            <Heading as="h5" className="mb-4">
              When Happens
            </Heading>
            <div className="flex flex-col">
              <QueryBuilder
                direction="vertical"
                intent="gray"
                className="w-full"
                query={value as RuleGroup}
                fields={fieldsDataSource}
                onChange={onChange}
                showBranches
                error={!!error?.message}
              />
            </div>
          </div>
        )}
      />
    </div>
  );
};

export default VariableSubValue;
