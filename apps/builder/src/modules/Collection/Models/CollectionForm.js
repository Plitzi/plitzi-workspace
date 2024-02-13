// Packages
import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import { useForm, Controller } from 'react-hook-form';
import Button from '@plitzi/plitzi-ui-components/Button';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';

// Relatives
import CollectionFieldForm from './CollectionFieldForm';
import CollectionField from '../components/CollectionField';
import { emptyObject } from '../../../helpers/utils';

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
    <div className="h-full flex flex-col grow basis-0 overflow-y-auto">
      <div className="p-4 border-b border-gray-300">
        <Heading type="h3">{id ? namePlural : 'New Collection'}</Heading>
      </div>
      <form className="flex flex-col p-3" onSubmit={handleSubmit(handleSubmitInternal)}>
        <div className="flex mb-3 justify-end">
          <div className="flex">
            {id && (
              <Button onClick={handleCancel} className="mr-3 rounded-md">
                Cancel
              </Button>
            )}
            <Button type="submit" className="rounded-md">
              {!id ? 'Create Collection' : 'Update Collection'}
            </Button>
          </div>
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
                inputClassName="rounded"
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
                inputClassName="rounded"
                onChange={e => onChange(e.target.value)}
                value={value}
                error={error}
              />
            )}
          />
        </div>
        <div className="mt-4">
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
                inputClassName="rounded"
                onChange={e => onChange(e.target.value)}
                value={value}
                error={error}
              />
            )}
          />
        </div>
        <div className="mt-4">
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
                inputClassName="rounded"
                onChange={e => onChange(e.target.value)}
                value={value}
                error={error}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </FormControl>
            )}
          />
        </div>
      </form>
      <div className="flex flex-col px-3 pb-3">
        <div className="flex justify-between items-center">
          <Heading type="h4">Schema</Heading>
        </div>
        <div className="flex flex-col w-full">
          <div className="flex gap-10 font-bold px-10 py-2 border-b border-gray-300">
            <div className="flex grow basis-0">Name</div>
            <div className="flex grow basis-0">Identifier</div>
            <div className="flex grow basis-0">Type</div>
            <div className="flex justify-center items-center w-[100px]">Required</div>
            <div className="flex justify-center items-center w-[100px]">Primary</div>
            <div className="flex justify-center items-center w-[150px]">Actions</div>
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

CollectionForm.propTypes = {
  id: PropTypes.string,
  name: PropTypes.string,
  namePlural: PropTypes.string,
  description: PropTypes.string,
  privacy: PropTypes.oneOf(['public', 'private']),
  fields: PropTypes.object,
  onCancel: PropTypes.func,
  onSubmit: PropTypes.func
};

export default CollectionForm;
