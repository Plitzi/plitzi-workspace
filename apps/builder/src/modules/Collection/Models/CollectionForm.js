// Packages
import React, { useCallback, useState } from 'react';
import noop from 'lodash/noop';
import { useForm, Controller } from 'react-hook-form';
import Button from '@plitzi/plitzi-ui/Button';
import Heading from '@plitzi/plitzi-ui/Heading';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import { useToast } from '@plitzi/plitzi-ui/Toast';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

// Relatives
import CollectionFieldForm from './CollectionFieldForm';
import CollectionField from '../components/CollectionField';

/**
 * @param {{
 *   id?: string;
 *   name?: string;
 *   namePlural?: string;
 *   description?: string;
 *   privacy?: 'public' | 'private';
 *   fields?: object;
 *   onCancel?: () => void;
 *   onSubmit?: (values: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const CollectionForm = props => {
  const {
    id = '',
    name = '',
    description = '',
    privacy = 'public',
    namePlural = '',
    fields: fieldsProp = emptyObject,
    onCancel = noop,
    onSubmit = noop
  } = props;
  const { addToast } = useToast();
  const [fields, setFields] = useState(() => Object.values(fieldsProp));

  const { control, handleSubmit } = useForm({ defaultValues: { name, namePlural, description, privacy } });

  const handleClickAddField = useCallback(
    field => {
      setFields(state => {
        let newState = state;
        if (field?.params.primary) {
          newState = newState.map(f => ({ ...f, params: { ...f.params, primary: false } }));
        }

        newState = [...newState, field];

        return newState;
      });
    },
    [setFields]
  );

  const handleValidateField = useCallback(
    newField => {
      const fieldIdentifiers = fields.map(field => field.machineName);
      if (fieldIdentifiers.includes(newField.machineName)) {
        return { key: 'machineName', message: 'This identifier is duplicated' };
      }

      return undefined;
    },
    [fields]
  );

  const handleClickRemoveField = index => () => {
    setFields(state => {
      const newState = [...state];
      newState.splice(index, 1);

      return newState;
    });
  };

  const handleSubmitInternal = async values => {
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

    const objectFields = {};
    fields.forEach(field => {
      objectFields[field.machineName] = field;
    });

    onSubmit({
      id,
      name: values.name,
      namePlural: values.namePlural,
      description: values.description,
      privacy: values.privacy,
      fields: objectFields
    });
  };

  const handleCancel = useCallback(() => onCancel(), [onCancel]);

  return (
    <div className="mx-4 my-2 flex h-full grow basis-0 flex-col gap-8 overflow-y-auto">
      <div className="flex flex-col gap-2">
        <div className="border-b border-gray-300 pb-2">
          <Heading as="h6">{id ? namePlural : 'New Collection'}</Heading>
        </div>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(handleSubmitInternal)}>
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
          <div className="grid grid-cols-2 gap-4">
            <Controller
              control={control}
              rules={{ required: true }}
              name="name"
              render={({ field: { onChange, value, name }, fieldState: { error } }) => (
                <FormControl
                  type="text"
                  name={name}
                  size="md"
                  label="Name Singular"
                  placeholder="Example: Post"
                  className="w-full"
                  inputClassName="rounded-sm"
                  onChange={e => onChange(e.target.value)}
                  value={value}
                  error={error}
                />
              )}
            />
            <Controller
              control={control}
              rules={{ required: true }}
              name="namePlural"
              render={({ field: { onChange, value, name }, fieldState: { error } }) => (
                <FormControl
                  type="text"
                  name={name}
                  size="md"
                  label="Name Plural"
                  placeholder="Example: Posts"
                  className="w-full"
                  inputClassName="rounded-sm"
                  onChange={e => onChange(e.target.value)}
                  value={value}
                  error={error}
                />
              )}
            />
          </div>
          <Controller
            control={control}
            rules={{ required: false }}
            name="description"
            render={({ field: { onChange, value, name }, fieldState: { error } }) => (
              <FormControl
                type="textarea"
                name={name}
                size="md"
                label="Collection Description"
                placeholder=""
                className="w-full"
                inputClassName="rounded-sm"
                onChange={e => onChange(e.target.value)}
                value={value}
                error={error}
              />
            )}
          />
          <Controller
            control={control}
            rules={{ required: true }}
            name="privacy"
            render={({ field: { onChange, value, name }, fieldState: { error } }) => (
              <FormControl
                type="select"
                name={name}
                size="md"
                label="Privacy"
                placeholder=""
                className="w-full"
                inputClassName="rounded-sm"
                onChange={e => onChange(e.target.value)}
                value={value}
                error={error}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </FormControl>
            )}
          />
        </form>
      </div>
      <div className="flex flex-col">
        <Heading as="h6">Schema</Heading>
        <div className="flex w-full flex-col gap-2">
          <div className="flex gap-10 border-b border-gray-300 pb-2 font-bold">
            <div className="flex grow basis-0">Name</div>
            <div className="flex grow basis-0">Identifier</div>
            <div className="flex grow basis-0">Type</div>
            <div className="flex w-[100px] items-center justify-center">Required</div>
            <div className="flex w-[100px] items-center justify-center">Primary</div>
            <div className="flex w-[150px] items-center justify-center">Actions</div>
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
