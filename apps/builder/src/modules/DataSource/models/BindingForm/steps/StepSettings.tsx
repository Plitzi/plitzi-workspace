import Form from '@plitzi/plitzi-ui/Form';
import { useMemo } from 'react';

import type { SourceField } from '@plitzi/sdk-shared';

export type StepSettingsProps = {
  source: string;
  fields: SourceField[];
  attributes?: { label: string; path: string }[];
};

const StepSettings = ({ source, fields, attributes }: StepSettingsProps) => {
  const pathOptions = useMemo(
    () =>
      fields.reduce<{ label: string; value: string }[]>(
        (acum, field) => [...acum, { label: `${field.name} [${field.path}]`, value: field.path }],
        []
      ),
    [fields]
  );

  const toOptions = useMemo(
    () =>
      attributes?.reduce<{ label: string; value: string }[]>(
        (acum, field) => [...acum, { label: `${field.label} [${field.path}]`, value: field.path }],
        []
      ),
    [attributes]
  );

  return (
    <>
      {source && (
        <Form.Select2
          name="path"
          placeholder="Select Path"
          allowCreateOptions
          options={pathOptions}
          size="xs"
          valueAsString
        />
      )}
      <Form.Select2 name="to" placeholder="Attribute" allowCreateOptions options={toOptions} size="xs" valueAsString />
    </>
  );
};

export default StepSettings;
