import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

const selectorFormSchema = z.object({
  name: z
    .string()
    .min(3)
    .regex(/^([a-zA-Z.#]{1}([a-zA-Z0-9\-_.#: ]+)?)$/i, {
      message: 'Name only can be letters, numbers and _ -'
    })
});

export type SelectorFormProps = {
  name?: string;
  onClose?: () => void;
  onSubmit?: (values: { name: string }) => void;
};

const SelectorForm = ({ name = '', onClose, onSubmit }: SelectorFormProps) => {
  const form = useForm({ initialValues: { name }, config: { schema: selectorFormSchema } });

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof selectorFormSchema>) => onSubmit?.(values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="Folder Name" size="sm" />
      </Form.Body>
      <Form.Footer justify="end">
        <Button onClick={onClose} size="sm">
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Submit
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default SelectorForm;
