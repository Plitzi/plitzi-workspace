import Form from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';

import ValuesInput from './components/ValuesInput';

import type { ControllerFieldState, ControllerRenderProps, FieldValues } from 'react-hook-form';

/** The values of an open credential, each read by the name its author gives it (`{{credential.token}}`). */
const NamedValues = () => {
  const render = useCallback(
    ({
      field,
      fieldState
    }: {
      field: ControllerRenderProps<FieldValues, 'data'>;
      fieldState: ControllerFieldState;
    }) => (
      <ValuesInput
        value={field.value as Record<string, string>} // The form's `data` is a record of strings (its schema).
        error={fieldState.error?.message}
        onChange={field.onChange}
      />
    ),
    []
  );

  return <Form.Custom name="data" render={render} />;
};

export default NamedValues;
