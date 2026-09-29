import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import type { Cdn } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

const templateFormSchema = z.object({
  name: z.string().min(3).max(20),
  description: z.string().max(200).optional(),
  target: z.string().min(1)
});

/** What the form answers: the template, and the public bucket of which CDN it goes in. */
export type TemplateFormValues = {
  name: string;
  description?: string;
  cdnIdentifier: string;
  bucketIdentifier: string;
};

export type TemplateFormProps = {
  name?: string;
  description?: string;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: TemplateFormValues) => void;
};

/** A template's place, as the select carries it: the CDN and the bucket, which no identifier contains the separator of. */
const SEPARATOR = '::';

/** Where a template can go: every public bucket of the space's CDNs — a private one keeps server code and serves nothing. */
const targetsOf = (cdns: Cdn[]) =>
  cdns.flatMap(cdn =>
    cdn.buckets
      .filter(bucket => bucket.visibility === 'public')
      .map(bucket => ({
        value: `${cdn.identifier}${SEPARATOR}${bucket.identifier}`,
        label: cdn.buckets.length > 1 ? `${cdn.name} — ${bucket.name}` : cdn.name
      }))
  );

const TemplateForm = ({ name = 'New Template', description = '', onSubmit, onClose }: TemplateFormProps) => {
  const form = useForm({ defaultValues: { name, description, target: '' }, config: { schema: templateFormSchema } });
  const { data, isLoading } = useGraphQL('SpaceCdns', data => data?.SpaceCdns.edges);
  const targets = useMemo(() => targetsOf(data ?? []), [data]);

  const handleSubmitInternal = useCallback(
    ({ target, ...values }: z.infer<typeof templateFormSchema>) => {
      const [cdnIdentifier, bucketIdentifier] = target.split(SEPARATOR);
      onSubmit?.(undefined, { ...values, cdnIdentifier, bucketIdentifier });
    },
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="Template Name" placeholder="Template Name" />
        <Form.TextArea name="description" label="Template Description" placeholder="Template Description" />
        <Form.Select loading={isLoading} name="target" placeholder="Select a bucket" label="CDN Bucket">
          {targets.map(target => (
            <option key={target.value} value={target.value}>
              {target.label}
            </option>
          ))}
        </Form.Select>
      </Form.Body>
      <Form.Footer justify="end">
        <Button onClick={onClose} size="sm">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} size="sm">
          Submit
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default TemplateForm;
