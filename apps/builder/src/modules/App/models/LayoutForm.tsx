import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

const layoutFormSchema = z.object({
  name: z.string().min(3, { message: 'Too Short' }).max(20, { message: 'Too Long' })
});

export type LayoutFormProps = {
  name?: string;
  onClose?: () => void;
  onSubmit?: (values: z.infer<typeof layoutFormSchema>) => void;
};

const LayoutForm = ({ name = 'New Layout', onClose, onSubmit }: LayoutFormProps) => {
  const form = useForm({ defaultValues: { name }, config: { schema: layoutFormSchema } });

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof layoutFormSchema>) => onSubmit?.(values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="Layout Name" size="sm" />
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

export default LayoutForm;
