import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import type { PageFolder } from '@plitzi/sdk-shared';

const pageFolderFormSchema = z.object({
  name: z.string().min(3, { message: 'Too Short' }).max(20, { message: 'Too Long' }),
  slug: z
    .string()
    .min(2, { message: 'Slug must have at least 2 characters' })
    .regex(/^[a-z][a-z0-9_-]+$/gim, {
      message: 'Slug only can be letters, numbers and _ -'
    }),
  parentId: z.string().optional()
});

export type PageFolderFormProps = {
  name?: string;
  slug?: string;
  parentId?: string;
  pageFolders?: PageFolder[];
  onClose?: () => void;
  onSubmit?: (values: z.infer<typeof pageFolderFormSchema>) => void;
};

const PageFolderForm = ({
  name = 'New Folder',
  slug = '',
  parentId = '',
  pageFolders,
  onClose,
  onSubmit
}: PageFolderFormProps) => {
  const form = useForm({ defaultValues: { name, slug, parentId }, config: { schema: pageFolderFormSchema } });

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof pageFolderFormSchema>) => onSubmit?.(values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="Folder Name" size="sm" />
        <Form.Input name="slug" label="Folder Slug / Path" placeholder="Page Slug / Path" size="sm" />
        <Form.Select name="parentId" label="Parent Folder" placeholder="None" size="sm">
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

export default PageFolderForm;
