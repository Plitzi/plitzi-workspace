/* eslint-disable react-refresh/only-export-components */
import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import { useCallback, useState } from 'react';
import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import type { StyleThemeValue, StyleVariableValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

const nameSchema = z
  .string()
  .min(3, 'Too Short')
  .max(20, 'Too Long')
  .regex(/^(?:\w+\s+|)([a-zA-Z_][a-zA-Z0-9_-]+)$/i, 'Invalid Name');

export const styleVariableFormSchema = z.discriminatedUnion('category', [
  z.object({
    name: nameSchema,
    category: z.literal(StyleVariableCategory.COLOR),
    value: z.object({
      light: z.string().min(1),
      dark: z.string().min(1),
      default: z.string().min(1)
    })
  }),
  z.object({
    name: nameSchema,
    category: z.literal(StyleVariableCategory.SHADOW),
    value: z.string().min(1)
  }),
  z.object({
    name: nameSchema,
    category: z.literal(StyleVariableCategory.SPACING),
    value: z
      .string()
      .trim()
      .refine(value => {
        if (value === '0' || value === 'auto') {
          return true;
        }

        // CSS Units
        if (/^-?\d*\.?\d+(px|rem|em|%|vh|vw|vmin|vmax|dvh|svh|lvh|ch|ex|cm|mm|in|pt|pc)$/i.test(value)) {
          return true;
        }

        // CSS Functions
        if (/^(calc|min|max|clamp)\(.+\)$/i.test(value)) {
          return true;
        }

        return false;
      }, 'Invalid CSS value')
  }),
  z.object({
    name: nameSchema,
    category: z.literal(StyleVariableCategory.CUSTOM),
    value: z.string().min(1)
  })
]);

const normalizeValue = (category: StyleVariableCategory, name: string, value?: StyleVariableValue) => {
  switch (category) {
    case StyleVariableCategory.COLOR: {
      const { default: defaultValue = '', light = '', dark = '' } = value as StyleThemeValue;
      return { name, category, value: { light, dark, default: defaultValue } };
    }

    case StyleVariableCategory.SPACING:
    case StyleVariableCategory.SHADOW:
    case StyleVariableCategory.CUSTOM:
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
  category = StyleVariableCategory.COLOR,
  value,
  isNewRecord = false,
  onClose,
  onSubmit
}: StyleVariableFormProps) => {
  const [defaultValues, setDefaultValues] = useState(normalizeValue(category, name, value));
  const form = useForm({ defaultValues, config: { schema: styleVariableFormSchema } });
  const watchCategory = useFormWatch(form.formMethods, 'category');

  const handleChangeValue = useCallback(
    (value: string) => {
      form.formMethods.setValue(
        'value',
        (value as StyleVariableCategory) === StyleVariableCategory.COLOR ? { default: '', light: '', dark: '' } : ''
      );
      setDefaultValues(normalizeValue(value as StyleVariableCategory, name, value));
    },
    [form.formMethods, name]
  );

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
        <Form.Select name="category" size="xs" onChange={handleChangeValue}>
          <option value={StyleVariableCategory.COLOR}>Colors</option>
          <option value={StyleVariableCategory.SPACING}>Spacing</option>
          <option value={StyleVariableCategory.SHADOW}>Shadow</option>
          <option value={StyleVariableCategory.CUSTOM}>Custom</option>
        </Form.Select>
        {watchCategory === StyleVariableCategory.COLOR && (
          <div className="flex w-full gap-2">
            <Form.Color
              name="value.default"
              placeholder="Default Value"
              size="xs"
              allowVariables
              className="min-w-0 grow basis-0"
            />
            <Form.Color
              name="value.light"
              placeholder="Light Value"
              size="xs"
              allowVariables
              className="min-w-0 grow basis-0"
            />
            <Form.Color
              name="value.dark"
              placeholder="Dark Value"
              size="xs"
              allowVariables
              className="min-w-0 grow basis-0"
            />
          </div>
        )}
        {watchCategory !== StyleVariableCategory.COLOR && (
          <Form.Input name="value" placeholder="Value" size="xs" className="grow basis-0" />
        )}
      </Form.Body>
      <Form.Footer>
        <Button onClick={onClose} size="xs" className="grow basis-0">
          Cancel
        </Button>
        <Button type="submit" size="xs" className="grow basis-0">
          {isNewRecord ? 'Add' : 'Update'}
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default StyleVariableForm;
