// Packages
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';
import { useForm, Controller } from 'react-hook-form';
import Button from '@plitzi/plitzi-ui-components/Button';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Alert from '@plitzi/plitzi-ui-components/Alert';

const PublishForm = props => {
  const { className = '', environment = 'development', description = '', onClose = noop, onSubmit = noop } = props;

  const { control, handleSubmit } = useForm({ defaultValues: { environment, description } });

  const handleSubmitInternal = values => {
    onSubmit(values);
  };

  return (
    <form className={classNames('flex flex-col p-3', className)} onSubmit={handleSubmit(handleSubmitInternal)}>
      <Alert className="text-white mb-4" intent="info">
        Make a snapshot and save it into an environment to later publish it
      </Alert>
      <Controller
        control={control}
        rules={{ required: true }}
        name="environment"
        render={({ field: { onChange, value, name }, fieldState: { error } }) => (
          <FormControl
            type="select"
            name={name}
            size="md"
            label="Environment"
            className="w-full"
            inputClassName="rounded"
            onChange={e => onChange(e.target.value)}
            value={value}
            error={error}
          >
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="live">Live</option>
          </FormControl>
        )}
      />
      <Controller
        control={control}
        rules={{ required: true }}
        name="description"
        render={({ field: { onChange, value, name }, fieldState: { error } }) => (
          <FormControl
            type="textarea"
            name={name}
            size="md"
            label="Description"
            placeholder="Brief description changes..."
            className="w-full mt-4"
            inputClassName="rounded"
            onChange={e => onChange(e.target.value)}
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
          Snapshot!
        </Button>
      </div>
    </form>
  );
};

PublishForm.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  environment: PropTypes.string,
  description: PropTypes.string,
  onClose: PropTypes.func,
  onSubmit: PropTypes.func
};

export default PublishForm;
