// Packages
import React from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import { useForm, Controller } from 'react-hook-form';
import Button from '@plitzi/plitzi-ui-components/Button';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';

/**
 * @param {{
 *   className?: string;
 *   identifier?: string;
 *   name?: string;
 *   description?: string;
 *   onClose?: () => void;
 *   onSubmit?: (values: { identifier: string; name: string; description: string }) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const SegmentForm = props => {
  const {
    className = '',
    identifier = 'new-segment',
    name = 'New Segment',
    description = '',
    onSubmit = noop,
    onClose = noop
  } = props;

  const { control, handleSubmit } = useForm({ defaultValues: { identifier, name, description } });

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
            label="Segment Name"
            placeholder="Segment Name"
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
        name="description"
        render={({ field: { onChange, value, name }, fieldState: { error } }) => (
          <FormControl
            type="textarea"
            name={name}
            size="md"
            label="Segment Description"
            placeholder="Segment Description"
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
          Submit
        </Button>
      </div>
    </form>
  );
};

export default SegmentForm;
