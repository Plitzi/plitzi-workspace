import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import type { PageFolder } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

const layoutFormSchema = z.object({
  name: z.string().min(3, { message: 'Too Short' }).max(20, { message: 'Too Long' }),
  pageFolder: z.string().optional()
});

export type LayoutFormProps = {
  name?: string;
  pageFolder?: string;
  pageFolders?: PageFolder[];
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: z.infer<typeof layoutFormSchema>) => void;
};

const LayoutForm = ({ name = 'New Layout', pageFolder = '', pageFolders, onClose, onSubmit }: LayoutFormProps) => {
  const form = useForm({ defaultValues: { name, pageFolder }, config: { schema: layoutFormSchema } });

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof layoutFormSchema>) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="Layout Name" size="sm" />
        <Form.Select name="pageFolder" label="Page Folder" placeholder="None" size="sm">
          {pageFolders &&
            Object.values(pageFolders).map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
        </Form.Select>
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

export default LayoutForm;
