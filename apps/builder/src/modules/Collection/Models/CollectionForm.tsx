import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import Heading from '@plitzi/plitzi-ui/Heading';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, useState } from 'react';
import { z } from 'zod';

import CollectionFieldForm, { collectionFieldSchema } from './CollectionFieldForm';
import CollectionField from '../components/CollectionField';

import type { Collection, CollectionField as TCollectionField } from '@plitzi/sdk-shared';

const collectionSchema = z.object({
  id: z.string(),
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
  name: z
    .string()
    .min(5)
    .regex(/^[a-zA-Z _-]+$/),
  namePlural: z
    .string()
    .min(5)
    .regex(/^[a-zA-Z _-]+$/),
  description: z.string(),
  privacy: z.enum(['public', 'private']),
  fields: z.record(z.string(), collectionFieldSchema)
});

export type CollectionFormProps = {
  id?: string;
  name?: string;
  namePlural?: string;
  description?: string;
  privacy?: Collection['privacy'];
  fields?: Collection['fields'];
  onCancel?: () => void;
  onSubmit?: (values: Omit<Collection, 'records'>) => void;
};

const CollectionForm = ({
  id = '',
  name = '',
  description = '',
  privacy = 'public',
  namePlural = '',
  fields: fieldsProp,
  onCancel,
  onSubmit
}: CollectionFormProps) => {
  const { addToast } = useToast();
  const [fields, setFields] = useState(() => Object.values(fieldsProp ?? {}));

  const form = useForm({
    defaultValues: { name, namePlural, description, privacy },
    config: { schema: collectionSchema }
  });

  const handleClickAddField = useCallback(
    (field: TCollectionField) => {
      setFields(state => {
        let newState = state;
        if (field.params.primary) {
          newState = newState.map(f => ({ ...f, params: { ...f.params, primary: false } }));
        }

        newState = [...newState, field];

        return newState;
      });
    },
    [setFields]
  );

  const handleValidateField = useCallback(
    (newField: TCollectionField) => {
      const fieldIdentifiers = fields.map(field => field.machineName);
      if (fieldIdentifiers.includes(newField.machineName)) {
        return { key: 'machineName' as const, message: 'This identifier is duplicated' };
      }

      return undefined;
    },
    [fields]
  );

  const handleClickRemoveField = (index: number) => () => {
    setFields(state => {
      const newState = [...state];
      newState.splice(index, 1);

      return newState;
    });
  };

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof collectionSchema>) => {
      if (fields.length === 0) {
        addToast('Add at least one field', {
          appeareance: 'info',
          autoDismiss: true,
          placement: 'top-right'
        });

        return;
      }

      if (!fields.find(field => field.params.primary)) {
        addToast('Add at least one primary field', {
          appeareance: 'info',
          autoDismiss: true,
          placement: 'top-right'
        });

        return;
      }

      const objectFields: Collection['fields'] = {};
      fields.forEach(field => {
        objectFields[field.machineName] = field;
      });

      onSubmit?.({
        id,
        name: values.name,
        namePlural: values.namePlural,
        description: values.description,
        privacy: values.privacy,
        fields: objectFields
      });
    },
    [addToast, fields, id, onSubmit]
  );

  const handleCancel = useCallback(() => onCancel?.(), [onCancel]);

  return (
    <div className="mx-4 my-2 flex h-full grow basis-0 flex-col gap-8 overflow-y-auto">
      <div className="flex flex-col gap-2">
        <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
          <Form.Header className="flex w-full">
            <div className="flex w-full justify-between border-b border-gray-300 pb-2 dark:border-zinc-700">
              <Heading as="h6">{id ? namePlural : 'New Collection'}</Heading>
              <div className="flex justify-end gap-3">
                {id && (
                  <Button onClick={handleCancel} size="sm">
                    Cancel
                  </Button>
                )}
                <Button type="submit" size="sm">
                  {!id ? 'Create Collection' : 'Update Collection'}
                </Button>
              </div>
            </div>
          </Form.Header>
          <Form.Body className="grid grid-cols-2 gap-4">
            <Form.Input name="name" label="Name Singular" placeholder="Example: Post" />
            <Form.Input name="namePlural" label="Name Plural" placeholder="Example: Posts" />
            <div className="col-span-2 flex flex-col gap-4">
              <Form.TextArea name="description" label="Collection Description" />
              <Form.Select name="privacy" label="Privacy">
                <option value="public">Public</option>
                <option value="private">Private</option>
              </Form.Select>
            </div>
          </Form.Body>
        </Form>
      </div>
      <div className="flex flex-col">
        <Heading as="h6">Schema</Heading>
        <div className="flex w-full flex-col gap-2">
          <div className="flex gap-10 border-b border-gray-300 pb-2 font-bold dark:border-zinc-700">
            <div className="flex grow basis-0">Name</div>
            <div className="flex grow basis-0">Identifier</div>
            <div className="flex grow basis-0">Type</div>
            <div className="flex w-25 items-center justify-center">Required</div>
            <div className="flex w-25 items-center justify-center">Primary</div>
            <div className="flex w-37.5 items-center justify-center">Actions</div>
          </div>
          {fields.map((field, i) => (
            <CollectionField key={i} {...field} onRemove={handleClickRemoveField(i)} />
          ))}
          <CollectionFieldForm
            onSubmit={handleClickAddField}
            onValidate={handleValidateField}
            params={{ required: false, primary: false }}
          />
        </div>
      </div>
    </div>
  );
};

export default CollectionForm;
