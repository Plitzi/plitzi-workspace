import Button from '@plitzi/plitzi-ui/Button';
import Form from '@plitzi/plitzi-ui/Form';
import classNames from 'classnames';
import { useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';

export type SelectorFormProps = {
  className?: string;
  onClose?: () => void;
  onSubmit?: (values: { name: string }) => void;
};

const SelectorForm = ({ className = '', onClose, onSubmit }: SelectorFormProps) => {
  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm({
    defaultValues: { name: '' }
  });

  const validateName = (value: string) => {
    const regex = /^([a-zA-Z.#]{1}([a-zA-Z0-9\-_.#: ]+)?)$/i;
    if (value.match(regex)) {
      return true;
    }

    return 'Invalid Selector';
  };

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(3, { message: 'Too Short' }).max(20, { message: 'Too Long' }),
        description: z.string().max(200, { message: 'Too Long' }).optional()
      }),
    []
  );

  const handleSubmitInternal = useCallback((values: Record<string, unknown>) => onSubmit?.(values), [onSubmit]);

  return (
    <form className={classNames('flex flex-col p-3', className)} onSubmit={void handleSubmit(handleSubmitInternal)}>
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
            inputClassName="rounded-sm"
            onChange={e => onChange(e.target.value)}
            value={value}
            error={errors.name}
          />
        )}
      />
      <div className="flex justify-end mt-3">
        <Button onClick={onClose} className="mr-3 rounded-sm">
          Cancel
        </Button>
        <Button type="submit" className="rounded-sm">
          Submit
        </Button>
      </div>
    </form>
  );
};

export default SelectorForm;
