import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import type { MouseEvent } from 'react';

const spaceCredentialFormSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('s3'),
    name: z.string().min(2),
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1)
  }),
  z.object({
    provider: z.literal('r2'),
    name: z.string().min(2),
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1)
  })
]);

export type SpaceCredentialFormProps = {
  className?: string;
  name?: string;
  provider?: 's3' | 'r2';
  accessKeyId?: string;
  secretAccessKey?: string;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: z.infer<typeof spaceCredentialFormSchema>) => void;
};

const SpaceCredentialForm = ({
  name = 'New Credential',
  provider = 's3',
  accessKeyId = '',
  secretAccessKey = '',
  onSubmit,
  onClose
}: SpaceCredentialFormProps) => {
  const form = useForm({
    defaultValues: { name, provider, accessKeyId, secretAccessKey },
    config: { schema: spaceCredentialFormSchema }
  });

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof spaceCredentialFormSchema>) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="Name" size="xs" />
        <Form.Select name="provider" label="Provider" size="xs">
          <option value="s3">AWS S3</option>
          <option value="r2">Cloudflare R2</option>
        </Form.Select>
        <Form.Input name="accessKeyId" label="Access Key ID" size="xs" />
        <Form.Input name="secretAccessKey" label="Access Key ID" size="xs" />
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

export default SpaceCredentialForm;
