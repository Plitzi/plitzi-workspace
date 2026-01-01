import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import type { StyleVariableCategory, StyleVariableValues } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

const variableFormSchema = z.object({
  name: z
    .string()
    .min(3, { message: 'Too Short' })
    .max(20, { message: 'Too Long' })
    .regex(/^(?:\w+\s+|)([a-zA-Z_][a-zA-Z0-9_]+)$/i),
  category: z.enum(['color', 'shadow', 'spacing']),
  values: z.object({
    light: z.string().min(1, { message: 'Too Short' }),
    dark: z.string().min(1, { message: 'Too Short' }),
    default: z.string().min(1, { message: 'Too Short' })
  })
});

export type VariableFormProps = {
  name?: string;
  category?: StyleVariableCategory;
  values?: StyleVariableValues;
  onClose?: (e: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: z.infer<typeof variableFormSchema>) => void;
};

const VariableForm = ({ name = 'New Page', category = 'color', values, onClose, onSubmit }: VariableFormProps) => {
  const form = useForm({ defaultValues: { name, category, values }, config: { schema: variableFormSchema } });

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof variableFormSchema>) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  return (
    <Form
      form={form}
      onSubmit={handleSubmitInternal}
      className="w-full gap-4 rounded border border-gray-300 bg-slate-100 p-2"
    >
      <Form.Body gap={2}>
        <Form.Input name="name" placeholder="Name" size="xs" />
        <Form.Select name="category" size="xs">
          <option value="color">Colors</option>
          <option value="spacing">Spacing</option>
          <option value="shadow">Shadow</option>
        </Form.Select>
        <div className="flex w-full gap-2">
          <Form.Input name="values.default" placeholder="Default Value" size="xs" className="grow basis-0" />
          <Form.Input name="values.light" placeholder="Light Value" size="xs" className="grow basis-0" />
          <Form.Input name="values.dark" placeholder="Dark Value" size="xs" className="grow basis-0" />
        </div>
      </Form.Body>
      <Form.Footer>
        <Button onClick={onClose} size="xs" className="grow basis-0">
          Cancel
        </Button>
        <Button type="submit" size="xs" className="grow basis-0">
          Add
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default VariableForm;
