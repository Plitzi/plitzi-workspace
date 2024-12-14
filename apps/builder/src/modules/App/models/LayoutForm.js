// Packages
import React from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import { useForm, Controller } from 'react-hook-form';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Button from '@plitzi/plitzi-ui-components/Button';

/**
 * @param {{
 *   className?: string;
 *   onClose?: () => void;
 *   onSubmit?: (values: { name: string }) => void;
 * }} props
 * @returns {React.ReactElement}
 */

const LayoutForm = props => {
  const { className = '', onClose = noop, onSubmit = noop } = props;

  const { control, handleSubmit } = useForm({ defaultValues: { name: 'New Layout' } });

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
            label="Layout Name"
            placeholder="Layout Name"
            className="w-full"
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

export default LayoutForm;
