import Form from '@plitzi/plitzi-ui/Form';
import { useMemo } from 'react';

import type { SourceField } from '@plitzi/sdk-shared';

export type StepSettingsProps = {
  source: string;
  fields: SourceField[];
  attributes?: { label: string; path: string }[];
};

const StepSettings = ({ source, fields, attributes }: StepSettingsProps) => {
  const fromPathOptions = useMemo(
    () =>
      fields.reduce<{ label: string; value: string }[]>(
        (acum, field) => [...acum, { label: `${field.name} [${field.path}]`, value: field.path }],
        []
      ),
    [fields]
  );

  const toPathOptions = useMemo(
    () =>
      attributes?.reduce<{ label: string; value: string }[]>(
        (acum, field) => [...acum, { label: `${field.label} [${field.path}]`, value: field.path }],
        []
      ),
    [attributes]
  );

  return (
    <>
      <Form.Select2
        name="toPath"
        placeholder="Attribute"
        allowCreateOptions
        options={toPathOptions}
        size="xs"
        valueAsString
      />
      {source && (
        <Form.Select2
          name="fromPath"
          placeholder="Select Path"
          allowCreateOptions
          options={fromPathOptions}
          size="xs"
          valueAsString
        />
      )}
    </>
  );
};

export default StepSettings;
