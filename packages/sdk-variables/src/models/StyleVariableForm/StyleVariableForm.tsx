/* eslint-disable react-refresh/only-export-components */
import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import type { StyleThemeValue, StyleVariableCategory, StyleVariableValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

const nameSchema = z
  .string()
  .min(3, 'Too Short')
  .max(20, 'Too Long')
  .regex(/^(?:\w+\s+|)([a-zA-Z_][a-zA-Z0-9_]+)$/i);

export const styleVariableFormSchema = z.discriminatedUnion('category', [
  z.object({
    name: nameSchema,
    category: z.literal('color'),
    value: z.object({
      light: z.string().min(1),
      dark: z.string().min(1),
      default: z.string().min(1)
    })
  }),
  z.object({
    name: nameSchema,
    category: z.literal('shadow'),
    value: z.string().min(1)
  }),
  z.object({
    name: nameSchema,
    category: z.literal('spacing'),
    value: z.number().min(0)
  })
]);

const normalizeValue = (category: StyleVariableCategory, name: string, value?: StyleVariableValue) => {
  switch (category) {
    case 'color': {
      const { default: defaultValue = '', light = '', dark = '' } = value as StyleThemeValue;
      return { name, category, value: { light, dark, default: defaultValue } };
    }

    case 'spacing':
      return { name, category, value: typeof value === 'number' ? value : Number(value) || 0 };

    case 'shadow':
    default:
      return { name, category, value: typeof value === 'string' ? value : '' };
  }
};

export type StyleVariableFormProps = {
  name?: string;
  category?: StyleVariableCategory;
  value?: StyleVariableValue;
  isNewRecord?: boolean;
  onClose?: (e: MouseEvent) => void;
  onSubmit?: (values: z.infer<typeof styleVariableFormSchema>) => void;
};

const StyleVariableForm = ({
  name = 'New Page',
  category = 'color',
  value,
  isNewRecord = false,
  onClose,
  onSubmit
}: StyleVariableFormProps) => {
  const form = useForm({
    defaultValues: normalizeValue(category, name, value),
    config: { schema: styleVariableFormSchema }
  });

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof styleVariableFormSchema>) => onSubmit?.(values),
    [onSubmit]
  );

  return (
    <Form
      form={form}
      onSubmit={handleSubmitInternal}
      className="w-full gap-4 rounded border border-gray-300 bg-slate-100 p-2"
    >
      <Form.Body gap={2}>
        <Form.Input name="name" placeholder="Name" size="xs" disabled={!isNewRecord} />
        <Form.Select name="category" size="xs">
          <option value="color">Colors</option>
          <option value="spacing">Spacing</option>
          <option value="shadow">Shadow</option>
        </Form.Select>
        <div className="flex w-full gap-2">
          <Form.Input name="value.default" placeholder="Default Value" size="xs" className="grow basis-0" />
          <Form.Input name="value.light" placeholder="Light Value" size="xs" className="grow basis-0" />
          <Form.Input name="value.dark" placeholder="Dark Value" size="xs" className="grow basis-0" />
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

export default StyleVariableForm;
