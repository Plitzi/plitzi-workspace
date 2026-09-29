import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import type { CdnVisibility } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

const resourceCdnFormSchema = z
  .discriminatedUnion('provider', [
    z.object({
      provider: z.literal('s3'),
      name: z.string().min(2),
      visibility: z.enum(['public', 'private']),
      domain: z.string(),
      region: z.string().min(2),
      endpoint: z.string().optional(),
      bucketName: z.string().min(2).max(255)
    }),
    z.object({
      provider: z.literal('r2'),
      name: z.string().min(2),
      visibility: z.enum(['public', 'private']),
      domain: z.string(),
      region: z.string().default('auto'),
      endpoint: z.string().min(2),
      bucketName: z.string().min(2).max(255)
    })
  ])
  // A public CDN is read at its domain; a private one has none — only the platform reads it, with the credential.
  .superRefine((values, ctx) => {
    if (values.visibility === 'public' && values.domain.trim().length < 2) {
      ctx.addIssue({ code: 'custom', path: ['domain'], message: 'A public CDN needs its domain' });
    }
  });

export type ResourceCdnFormProps = {
  className?: string;
  name?: string;
  domain?: string;
  visibility?: CdnVisibility;
  provider?: 's3' | 'r2';
  region?: string;
  endpoint?: string;
  bucketName?: string;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: z.infer<typeof resourceCdnFormSchema>) => void;
};

const ResourceCdnForm = ({
  name = 'New CDN',
  domain = '',
  visibility = 'public',
  provider = 's3',
  region = '',
  endpoint = '',
  bucketName = '',
  onSubmit,
  onClose
}: ResourceCdnFormProps) => {
  const form = useForm({
    defaultValues: { name, visibility, domain, provider, region, endpoint, bucketName },
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
    (values: z.infer<typeof resourceCdnFormSchema>) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  const watchProvider = useFormWatch(form.formMethods, 'provider');
  const watchVisibility = useFormWatch(form.formMethods, 'visibility');

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="CDN Name" size="xs" />
        <Form.Select name="visibility" label="Visibility" size="xs">
          <option value="public">Public — plugins, images and templates, served at its domain</option>
          <option value="private">Private — the space’s server code, read only by Plitzi</option>
        </Form.Select>
        {watchVisibility === 'private' && (
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Use a bucket with no public access: Plitzi reads it with the credential, and keeps the space’s functions and
            runtime there.
          </p>
        )}
        {watchVisibility !== 'private' && <Form.Input name="domain" label="CDN Domain" size="xs" />}
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
