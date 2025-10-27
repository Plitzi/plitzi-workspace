import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

const resourceCdnFormSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('s3'),
    name: z.string().min(2),
    domain: z.string().min(2),
    region: z.string().min(2),
    endpoint: z.string().optional(),
    bucketName: z.string().min(2).max(255)
  }),
  z.object({
    provider: z.literal('r2'),
    name: z.string().min(2),
    domain: z.string().min(2),
    region: z.string().default('auto'),
    endpoint: z.string().min(2),
    bucketName: z.string().min(2).max(255)
  })
]);

export type ResourceCdnFormProps = {
  className?: string;
  name?: string;
  domain?: string;
  provider?: 's3' | 'r2';
  region?: string;
  endpoint?: string;
  bucketName?: string;
  onClose?: () => void;
  onSubmit?: (values: z.infer<typeof resourceCdnFormSchema>) => void;
};

const ResourceCdnForm = ({
  name = 'New CDN',
  domain = '',
  provider = 's3',
  region = '',
  endpoint = '',
  bucketName = '',
  onSubmit,
  onClose
}: ResourceCdnFormProps) => {
  const form = useForm({
    defaultValues: { name, domain, provider, region, endpoint, bucketName },
    config: { schema: resourceCdnFormSchema }
  });

  const handleChangeProvider = useCallback(
    (value: string) => {
      form.formMethods.setValue('endpoint', '');
      if (value === 'r2') {
        form.formMethods.setValue('region', 'auto');
      } else {
        form.formMethods.setValue('region', '');
      }
    },
    [form.formMethods]
  );

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof resourceCdnFormSchema>) => onSubmit?.(values),
    [onSubmit]
  );

  const watchProvider = useFormWatch(form.formMethods, 'provider');

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="CDN Name" size="xs" />
        <Form.Input name="domain" label="CDN Domain" size="xs" />
        <Form.Select name="provider" label="CDN Provider" size="xs" onChange={handleChangeProvider}>
          <option value="s3">AWS S3</option>
          <option value="r2">Cloudflare R2</option>
        </Form.Select>
        {watchProvider === 's3' && <Form.Input name="region" label="CDN Region" size="xs" />}
        {watchProvider !== 's3' && <Form.Input name="endpoint" label="CDN Endpoint" size="xs" />}
        <Form.Input name="bucketName" label="CDN Bucket Name" size="xs" />
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

export default ResourceCdnForm;
