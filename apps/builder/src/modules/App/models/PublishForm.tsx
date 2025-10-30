import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import type { MouseEvent } from 'react';

const publishFormSchema = z.object({
  environment: z.enum(['development', 'staging', 'live']),
  description: z.string().max(200, { message: 'Description must be less than 200 characters' })
});

export type PublishFormProps = {
  className?: string;
  environment?: 'development' | 'staging' | 'live';
  description?: string;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: z.infer<typeof publishFormSchema>) => void;
};

const PublishForm = ({ environment = 'development', description = '', onClose, onSubmit }: PublishFormProps) => {
  const form = useForm({ defaultValues: { environment, description }, config: { schema: publishFormSchema } });

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof publishFormSchema>) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Alert className="mb-4 text-white" intent="info">
          Make a snapshot and save it into an environment to later publish it
        </Alert>
        <Form.Select name="environment" label="Environment" size="sm">
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="live">Live</option>
        </Form.Select>
        <Form.TextArea name="description" label="Description" placeholder="Brief description changes..." size="sm" />
      </Form.Body>
      <Form.Footer justify="end">
        <Button onClick={onClose} size="sm">
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Snapshot
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default PublishForm;
