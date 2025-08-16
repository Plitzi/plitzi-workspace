import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import snakeCase from 'lodash/snakeCase';
import { useCallback } from 'react';
import { z } from 'zod';

import { fieldTypesOptions } from '../CollectionsConstants';

import type { fieldTypes } from '../CollectionsConstants';

const collectionFieldFormSchema = z.object({
  type: z.enum([
    'text',
    'richText',
    'image',
    'multiImage',
    'video',
    'link',
    'email',
    'phone',
    'number',
    'date',
    'switch',
    'color',
    'option',
    'file'
  ]),
  name: z.string().min(5),
  machineName: z.string().min(5),
  params: z.object({
    required: z.boolean(),
    primary: z.boolean()
  })
});

export type CollectionFieldFormProps = {
  isNewField?: boolean;
  name?: string;
  machineName?: string;
  type?: keyof typeof fieldTypes;
  params?: object;
  onSubmit?: (values: object) => void;
  onValidate?: (
    values: object
  ) => { key: 'name' | 'machineName' | 'type' | 'params.required' | 'params.primary'; message: string } | null;
};

const CollectionFieldForm = ({
  name = '',
  type = 'text',
  machineName = '',
  params,
  onSubmit,
  onValidate
}: CollectionFieldFormProps) => {
  const form = useForm({
    initialValues: { name, machineName, params, type },
    config: { schema: collectionFieldFormSchema }
  });

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof collectionFieldFormSchema>) => {
      const error = onValidate?.(values);
      if (error) {
        form.formMethods.setError(error.key, { message: error.message });

        return;
      }

      onSubmit?.(values);
      form.formMethods.reset();
    },
    [onValidate, onSubmit, form.formMethods]
  );

  const handleChangeName = useCallback(
    (name: string) => {
      if (!form.formMethods.formState.dirtyFields.machineName) {
        form.formMethods.setValue('machineName', snakeCase(name));
      }
    },
    [form.formMethods]
  );

  const handleResetInternal = useCallback(() => {
    form.formMethods.reset();
  }, [form.formMethods]);

  return (
    <Form form={form} onSubmit={handleSubmitInternal} onReset={handleResetInternal}>
      <Form.Body className="flex flex-row justify-between gap-10">
        <div className="flex grow basis-0 items-start">
          <Form.Input name="name" onChange={handleChangeName} size="xs" className="w-full" />
        </div>
        <div className="flex grow basis-0 items-start">
          <Form.Input name="machineName" size="xs" className="w-full" />
        </div>
        <div className="flex grow basis-0 items-start">
          <Form.Select2 name="type" size="xs" className="w-auto" options={fieldTypesOptions} />
        </div>
        <div className="flex w-[100px] items-center justify-center text-xl">
          <Form.Checkbox name="params.required" />
        </div>
        <div className="flex w-[100px] items-center justify-center text-xl">
          <Form.Checkbox name="params.primary" />
        </div>
        <div className="flex w-[150px] items-center justify-center gap-4">
          <Button type="reset" size="sm">
            <Button.Icon icon="fas fa-trash" intent="danger" className="cursor-pointer p-1" />
          </Button>
          <Button type="submit" size="sm">
            <Button.Icon icon="fa-solid fa-check" intent="success" />
          </Button>
        </div>
      </Form.Body>
    </Form>
  );
};

export default CollectionFieldForm;
