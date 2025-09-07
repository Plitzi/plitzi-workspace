import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

const templateFormSchema = z.object({
  name: z.string().min(3).max(20),
  description: z.string().max(200).optional()
});

export type TemplateFormProps = {
  name?: string;
  description?: string;
  onClose?: () => void;
  onSubmit?: (values: z.infer<typeof templateFormSchema>) => void;
};

const TemplateForm = ({ name = 'New Template', description = '', onSubmit, onClose }: TemplateFormProps) => {
  const form = useForm({ initialValues: { name, description }, config: { schema: templateFormSchema } });

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof templateFormSchema>) => onSubmit?.(values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="Template Name" placeholder="Template Name" />
        <Form.TextArea name="description" label="Template Description" placeholder="Template Description" />
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

export default TemplateForm;
