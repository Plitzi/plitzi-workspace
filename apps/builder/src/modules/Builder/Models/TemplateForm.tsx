import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import type { MouseEvent } from 'react';

const templateFormSchema = z.object({
  name: z.string().min(3).max(20),
  description: z.string().max(200).optional(),
  cdnIdentifier: z.string().min(1)
});

export type TemplateFormProps = {
  name?: string;
  description?: string;
  cdnIdentifier?: string;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: z.infer<typeof templateFormSchema>) => void;
};

const TemplateForm = ({
  name = 'New Template',
  description = '',
  cdnIdentifier = '',
  onSubmit,
  onClose
}: TemplateFormProps) => {
  const form = useForm({ defaultValues: { name, description, cdnIdentifier }, config: { schema: templateFormSchema } });
  const { data, isLoading } = useGraphQL('SpaceCdns', data => data?.SpaceCdns.edges);

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof templateFormSchema>) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="Template Name" placeholder="Template Name" />
        <Form.TextArea name="description" label="Template Description" placeholder="Template Description" />
        <Form.Select loading={isLoading} name="cdnIdentifier" placeholder="Select a provider" label="CDN Provider">
          {data?.map(cdn => (
            <option key={cdn.identifier} value={cdn.identifier}>
              {cdn.name}
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
