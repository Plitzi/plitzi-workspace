import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch, useFieldArray } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import VariableSubValue from './VariableSubValue';
import VariableValue from './VariableValue';

import type { QueryParams, RouteParams, SchemaVariable, ServerEnvironment } from '@plitzi/sdk-shared';

const variableFormSchema = z.object({
  name: z
    .string()
    .min(4)
    .regex(/^(?:\w+\s+|)([a-zA-Z_][a-zA-Z0-9_]+)$/i, {
      message: 'Name only can be letters, numbers and _ -'
    }),
  // category: z.string().min(4),
  type: z.enum(['text', 'number', 'email', 'password', 'select', 'select2', 'checkbox', 'textarea', 'color', 'switch']),
  value: z.string().min(3),
  subValues: z.array(z.record(z.string(), z.any())).optional()
});

export type VariableFormProps = {
  name?: SchemaVariable['name'];
  // category?: SchemaVariable['category'];
  value?: SchemaVariable['value'];
  type?: SchemaVariable['type'];
  subValues?: SchemaVariable['subValues'];
  whenData?: {
    routeParams: RouteParams;
    queryParams: QueryParams;
    hostname?: string;
    environment: ServerEnvironment;
  };
  isNewRecord?: boolean;
  onClose?: () => void;
  onSubmit?: (values: SchemaVariable) => void;
};

const VariableForm = ({
  name = 'variable',
  // category = '',
  value = '',
  type = 'text',
  subValues,
  whenData,
  isNewRecord = false,
  onSubmit,
  onClose
}: VariableFormProps) => {
  const form = useForm({
    defaultValues: { name, value, type, subValues },
    config: { schema: variableFormSchema }
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.formMethods.control,
    name: 'subValues',
    rules: { minLength: 0 }
  });
  const watchType = useFormWatch(form.formMethods, 'type');
  const watchSubValues = useFormWatch(form.formMethods, 'subValues');

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof variableFormSchema>) => onSubmit?.(values as SchemaVariable),
    [onSubmit]
  );

  const hasSubValues = watchSubValues && watchSubValues.length > 0;

  const handleClickFieldAppend = useCallback(() => append({ value: '', when: undefined }), [append]);

  const handleClickFieldUp = useCallback(
    (index: number) => () => {
      if (index > 0) {
        move(index, index - 1);
      }
    },
    [move]
  );

  const handleClickFieldDown = useCallback(
    (index: number) => () => {
      if (index < fields.length - 1) {
        move(index, index + 1);
      }
    },
    [fields, move]
  );

  const handleClickFieldRemove = useCallback((index: number) => () => remove(index), [remove]);

  const handleChangeType = useCallback(() => {
    form.formMethods.setValue('value', '');
  }, [form]);

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <div className="flex gap-2">
          <Form.Input name="name" label="Name" size="sm" disabled={!isNewRecord} className="w-full grow basis-0" />
          <Form.Select name="type" label="Type" size="sm" onChange={handleChangeType} className="w-full grow basis-0">
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="email">Email</option>
            <option value="password">Password</option>
            <option value="select">Select</option>
            <option value="select2">Select2</option>
            <option value="checkbox">Checkbox</option>
            <option value="switch">Switch</option>
            <option value="textarea">Text Area</option>
            <option value="color">Color</option>
          </Form.Select>
        </div>
        <VariableValue valueType={watchType} hasSubValues={hasSubValues} name="value" />
        {hasSubValues && (
          <Alert intent="info" className="text-xs text-white" containerClassName="items-center">
            Based on the logic the variable will take one of these values from top to down
          </Alert>
        )}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <VariableSubValue
                  whenData={whenData}
                  valueType={watchType}
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
      </Form.Body>
      <Form.Footer justify="end">
        <Button onClick={onClose} size="sm">
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Submit
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default VariableForm;
