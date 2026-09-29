import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import CdnAccountFields from './CdnAccountFields';
import CdnBucketFields from './CdnBucketFields';
import { cdnAccountShape, cdnBucketShape, checkCdnAccount, checkCdnBucket } from './cdnSchemas';

import type { MouseEvent } from 'react';

/** A new CDN: the customer's storage account and its first bucket — more are added to it afterwards. */
const resourceCdnFormSchema = z.object({ ...cdnAccountShape, ...cdnBucketShape }).superRefine((values, ctx) => {
  checkCdnAccount(values, ctx);
  checkCdnBucket(values.provider, values, ctx);
});

export type ResourceCdnFormValues = z.infer<typeof resourceCdnFormSchema>;

export type ResourceCdnFormProps = {
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: ResourceCdnFormValues) => void;
};

const ResourceCdnForm = ({ onSubmit, onClose }: ResourceCdnFormProps) => {
  const form = useForm({
    defaultValues: {
      name: 'New CDN',
      provider: 's3' as const,
      endpoint: '',
      bucketName: '',
      region: '',
      visibility: 'public' as const,
      domain: ''
    },
    config: { schema: resourceCdnFormSchema }
  });
  const provider = useFormWatch(form.formMethods, 'provider');
  const visibility = useFormWatch(form.formMethods, 'visibility');

  const handleChangeProvider = useCallback(() => {
    form.formMethods.setValue('endpoint', '');
    form.formMethods.setValue('region', '');
  }, [form.formMethods]);

  const handleSubmitInternal = useCallback(
    (values: ResourceCdnFormValues) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <CdnAccountFields provider={provider} onChangeProvider={handleChangeProvider} />
        <p className="text-xs font-semibold text-gray-600 dark:text-zinc-300">Its first bucket</p>
        <CdnBucketFields provider={provider} visibility={visibility} />
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
