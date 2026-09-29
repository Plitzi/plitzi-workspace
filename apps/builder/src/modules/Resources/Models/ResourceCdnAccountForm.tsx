import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import CdnAccountFields from './CdnAccountFields';
import { cdnAccountShape, checkCdnAccount } from './cdnSchemas';

import type { MouseEvent } from 'react';

const resourceCdnAccountFormSchema = z.object(cdnAccountShape).superRefine(checkCdnAccount);

export type ResourceCdnAccountFormValues = z.infer<typeof resourceCdnAccountFormSchema>;

export type ResourceCdnAccountFormProps = {
  name: string;
  provider: 's3' | 'r2';
  endpoint?: string;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: ResourceCdnAccountFormValues) => void;
};

/** A CDN's account — its name, provider and endpoint. Its buckets are changed one by one. */
const ResourceCdnAccountForm = ({ name, provider, endpoint = '', onSubmit, onClose }: ResourceCdnAccountFormProps) => {
  const form = useForm({
    defaultValues: { name, provider, endpoint },
    config: { schema: resourceCdnAccountFormSchema }
  });
  const watchProvider = useFormWatch(form.formMethods, 'provider');

  const handleChangeProvider = useCallback(() => form.formMethods.setValue('endpoint', ''), [form.formMethods]);

  const handleSubmitInternal = useCallback(
    (values: ResourceCdnAccountFormValues) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <CdnAccountFields provider={watchProvider} onChangeProvider={handleChangeProvider} />
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

export default ResourceCdnAccountForm;
