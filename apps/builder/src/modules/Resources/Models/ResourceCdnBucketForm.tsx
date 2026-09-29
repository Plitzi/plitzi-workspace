import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

import CdnBucketFields from './CdnBucketFields';
import { cdnBucketShape, checkCdnBucket } from './cdnSchemas';

import type { CdnVisibility } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

const bucketFormSchemaFor = (provider: 's3' | 'r2') =>
  z
    .object({ name: z.string().optional(), ...cdnBucketShape })
    .superRefine((values, ctx) => checkCdnBucket(provider, values, ctx));

export type ResourceCdnBucketFormValues = z.infer<ReturnType<typeof bucketFormSchemaFor>>;

export type ResourceCdnBucketFormProps = {
  /** The provider of the CDN it belongs to: an S3 bucket has a region of its own. */
  provider: 's3' | 'r2';
  name?: string;
  bucketName?: string;
  region?: string;
  visibility?: CdnVisibility;
  domain?: string;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: ResourceCdnBucketFormValues) => void;
};

/** A bucket of a CDN, added or changed: what the builder calls it, and its configuration. */
const ResourceCdnBucketForm = ({
  provider,
  name = '',
  bucketName = '',
  region = '',
  visibility = 'public',
  domain = '',
  onSubmit,
  onClose
}: ResourceCdnBucketFormProps) => {
  const schema = useMemo(() => bucketFormSchemaFor(provider), [provider]);
  const form = useForm({ defaultValues: { name, bucketName, region, visibility, domain }, config: { schema } });
  const watchVisibility = useFormWatch(form.formMethods, 'visibility');

  const handleSubmitInternal = useCallback(
    (values: ResourceCdnBucketFormValues) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="Name (defaults to the bucket’s)" size="xs" />
        <CdnBucketFields provider={provider} visibility={watchVisibility} />
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

export default ResourceCdnBucketForm;
