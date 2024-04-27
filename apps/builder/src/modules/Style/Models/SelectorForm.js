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
 *   onClose?: () => void;
 *   onSubmit?: (values: { name: string }) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const SelectorForm = props => {
  const { className = '', onClose = noop, onSubmit = noop } = props;

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm({
    defaultValues: { name: '' }
  });

  const validateName = value => {
    const regex = /^([a-zA-Z.#]{1}([a-zA-Z0-9\-_.#: ]+)?)$/i;
    if (value.match(regex)) {
      return true;
    }

    return 'Invalid Selector';
  };

  const handleSubmitInternal = values => onSubmit(values);

  return (
    <form className={classNames('flex flex-col p-3', className)} onSubmit={handleSubmit(handleSubmitInternal)}>
      <Controller
        control={control}
        rules={{ required: true, validate: { validateName } }}
        name="name"
        render={({ field: { onChange, value } }) => (
          <FormControl
            type="text"
            name="name"
            label="Name"
            placeholder="Name"
            className="w-full"
            inputClassName="rounded"
            onChange={e => onChange(e.target.value)}
            value={value}
            error={errors.name}
          />
        )}
      />
      <div className="flex justify-end mt-3">
        <Button onClick={onClose} className="mr-3 rounded">
          Cancel
        </Button>
        <Button type="submit" className="rounded">
          Submit
        </Button>
      </div>
    </form>
  );
};

export default SelectorForm;
