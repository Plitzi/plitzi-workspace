import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import type { PageFolder } from '@plitzi/sdk-shared';

const pageFormSchema = z.object({
  name: z.string().min(3, { message: 'Too Short' }).max(20, { message: 'Too Long' }),
  pageFolder: z.string().optional()
});

export type PageFormProps = {
  name?: string;
  pageFolder?: string;
  pageFolders?: PageFolder[];
  onClose?: () => void;
  onSubmit?: (values: z.infer<typeof pageFormSchema>) => void;
};

const PageForm = ({ name = 'New Page', pageFolder = '', pageFolders, onClose, onSubmit }: PageFormProps) => {
  const form = useForm({ initialValues: { name, pageFolder }, config: { schema: pageFormSchema } });

  const handleSubmitInternal = useCallback((values: z.infer<typeof pageFormSchema>) => onSubmit?.(values), [onSubmit]);

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="Folder Name" size="sm" />
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

export default PageForm;
