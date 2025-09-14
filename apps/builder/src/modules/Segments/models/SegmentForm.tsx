import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

const segmentFormSchema = z.object({
  identifier: z.string(),
  name: z.string().min(2),
  description: z.string()
});

export type SegmentFormProps = {
  className?: string;
  identifier?: string;
  name?: string;
  description?: string;
  onClose?: () => void;
  onSubmit?: (values: z.infer<typeof segmentFormSchema>) => void;
};

const SegmentForm = ({
  identifier = 'new-segment',
  name = 'New Segment',
  description = '',
  onSubmit,
  onClose
}: SegmentFormProps) => {
  const form = useForm({ defaultValues: { name, description, identifier }, config: { schema: segmentFormSchema } });

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof segmentFormSchema>) => onSubmit?.(values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="Segment Name" size="xs" />
        <Form.TextArea name="description" label="Segment Description" size="xs" />
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

export default SegmentForm;
