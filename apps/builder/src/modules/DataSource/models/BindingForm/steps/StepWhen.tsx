import Form from '@plitzi/plitzi-ui/Form';
import Heading from '@plitzi/plitzi-ui/Heading';
import QueryBuilder from '@plitzi/plitzi-ui/QueryBuilder';
import { useMemo } from 'react';

import type { Field, RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { SourceField } from '@plitzi/sdk-shared';

export type StepWhenProps = {
  dataSourceFields?: Record<string, SourceField[]>;
};

const StepWhen = ({ dataSourceFields }: StepWhenProps) => {
  const fieldsDataSource = useMemo<Record<string, Field>>(() => {
    if (!dataSourceFields) {
      return {};
    }

    return Object.keys(dataSourceFields).reduce(
      (acum1, source) => ({
        ...acum1,
        ...dataSourceFields[source].reduce(
          (acum2, { path, inputType, values }) => ({
            ...acum2,
            [`${source}.${path}`]: {
              name: `${source}.${path}`,
              label: path,
              placeholder: `Enter ${path}`,
              group: `Data Source - ${source}`,
              inputType: inputType,
              options: values
            }
          }),
          {}
        )
      }),
      {}
    );
  }, [dataSourceFields]);

  return (
    <Form.Custom
      name="when"
      render={({ field: { ref, value, onChange } }) => (
        <div className="flex flex-col gap-2" ref={ref}>
          <Heading as="h5" className="mb-4">
            When Happens
          </Heading>
          <div className="flex flex-col">
            <QueryBuilder
              direction="vertical"
              className="w-full"
              query={value as RuleGroup}
              fields={fieldsDataSource}
              onChange={onChange}
              showBranches
            />
          </div>
        </div>
      )}
    />
  );
};

export default StepWhen;
