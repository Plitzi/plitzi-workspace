// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';
import { useForm, Controller } from 'react-hook-form';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Button from '@plitzi/plitzi-ui-components/Button';

const pageFoldersDefault = [];

const PageFolderForm = props => {
  const {
    className = '',
    name = '',
    slug = '',
    parentId = '',
    pageFolders = pageFoldersDefault,
    onClose = noop,
    onSubmit = noop
  } = props;

  const { control, handleSubmit } = useForm({
    defaultValues: { name: name ?? 'New Folder', slug, parentId }
  });

  const handleSubmitInternal = values => onSubmit(values);

  const pageFolderOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...Object.values(pageFolders).map(({ id, name: folderName }) => ({
        value: id,
        label: folderName
      }))
    ],
    [pageFolders]
  );

  return (
    <form className={classNames('flex flex-col p-3', className)} onSubmit={handleSubmit(handleSubmitInternal)}>
      <Controller
        control={control}
        rules={{ required: true }}
        name="name"
        render={({ field: { onChange, value, name }, fieldState: { error } }) => (
          <FormControl
            type="text"
            name={name}
            size="md"
            label="Folder Name"
            placeholder="Page Name"
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
        name="parentId"
        render={({ field: { onChange, value, name }, fieldState: { error } }) => (
          <div className="mt-4">
            <FormControl
              type="select2"
              name={name}
              size="md"
              label="Parent Folder"
              placeholder="Parent Folder"
              className="w-full"
              inputClassName="rounded"
              inputProps={{ options: pageFolderOptions }}
              onChange={option => onChange(option?.value ?? '')}
              value={value}
              error={error}
            />
          </div>
        )}
      />
      <Controller
        control={control}
        rules={{
          required: true,
          validate: value => {
            const pattern = /^[a-zA-Z0-9_-]{2,}$/gim;

            return pattern.test(value) ? true : 'Slug only can be letters, numbers and _ - with minimum 2 characters';
          }
        }}
        name="slug"
        render={({ field: { onChange, value, name }, fieldState: { error } }) => (
          <div className="mt-4">
            <FormControl
              type="text"
              name={name}
              size="md"
              label="Folder Slug / Path"
              placeholder="Page Slug / Path"
              className="w-full"
              inputClassName="rounded"
              onChange={e => onChange(e.target.value)}
              value={value}
              error={error}
            />
          </div>
        )}
      />
      <div className="flex justify-end mt-4">
        <Button onClick={onClose} className="mr-3 rounded-md">
          Cancel
        </Button>
        <Button type="submit" className="rounded-md">
          Submit
        </Button>
      </div>
    </form>
  );
};

PageFolderForm.propTypes = {
  className: PropTypes.string,
  name: PropTypes.string,
  slug: PropTypes.string,
  parentId: PropTypes.string,
  pageFolders: PropTypes.array,
  onClose: PropTypes.func,
  onSubmit: PropTypes.func
};

export default PageFolderForm;
