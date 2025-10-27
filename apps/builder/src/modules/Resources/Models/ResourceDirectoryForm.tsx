import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

const resourceCdnFormSchema = (directories: { name: string }[] = []) =>
  z.object({
    name: z
      .string()
      .min(6)
      .max(50)
      .regex(/^[a-zA-Z0-9 _-]+$/, {
        message: 'Only letters, numbers, spaces, hyphens, and underscores are allowed'
      })
      .refine(val => !directories.some(d => d.name.toLowerCase() === val.toLowerCase()), {
        message: 'This name already exists'
      })
  });

export type ResourceDirectoryFormProps = {
  className?: string;
  name?: string;
  directories?: { name: string; items: unknown[] }[];
  onClose?: () => void;
  onSubmit?: (values: { name: string }) => void;
};

const ResourceDirectoryForm = ({
  name = 'New Directory',
  directories,
  onSubmit,
  onClose
}: ResourceDirectoryFormProps) => {
  const schema = useMemo(() => resourceCdnFormSchema(directories), [directories]);
  const form = useForm({
    defaultValues: { name },
    config: { schema }
  });

  const handleSubmitInternal = useCallback((values: z.infer<typeof schema>) => onSubmit?.(values), [onSubmit]);

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="Directory Name" size="xs" />
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

export default ResourceDirectoryForm;
