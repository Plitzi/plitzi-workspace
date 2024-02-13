// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';
import { useForm, Controller } from 'react-hook-form';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Button from '@plitzi/plitzi-ui-components/Button';

const pageFoldersDefault = [];

const PageForm = props => {
  const { className = '', pageFolders = pageFoldersDefault, onClose = noop, onSubmit = noop } = props;

  const { control, handleSubmit } = useForm({ defaultValues: { name: 'New Page', pageFolder: '' } });

  const pageFolderprops = useMemo(
    () => ({
      options: [
        { value: '', label: 'None' },
        ...pageFolders.map(({ id, name: folderName }) => ({ value: id, label: folderName }))
      ]
    }),
    [pageFolders]
  );

  const handleSubmitInternal = values => onSubmit(values);

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
            label="Page Name"
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
        rules={{ required: false }}
        name="pageFolder"
        render={({ field: { onChange, value, name }, fieldState: { error } }) => (
          <FormControl
            type="select2"
            name={name}
            inputProps={pageFolderprops}
            size="md"
            label="Page Folder"
            placeholder="Page Folder"
            className="w-full mt-4"
            inputClassName="rounded"
            onChange={option => onChange(option?.value ?? '')}
            value={value}
            error={error}
          />
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

PageForm.propTypes = {
  className: PropTypes.string,
  pageFolders: PropTypes.array,
  onClose: PropTypes.func,
  onSubmit: PropTypes.func
};

export default PageForm;
