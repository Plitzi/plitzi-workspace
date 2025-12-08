import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import type { PageFolder } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

const pageFormSchema = z.object({
  name: z.string().min(3, { message: 'Too Short' }).max(20, { message: 'Too Long' }),
  slug: z.string().regex(/^[a-z0-9-]+$/i),
  pageFolder: z.string().optional()
});

export type PageFormProps = {
  name?: string;
  slug?: string;
  pageFolder?: string;
  pageFolders?: PageFolder[];
  onClose?: (e: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: z.infer<typeof pageFormSchema>) => void;
};

const PageForm = ({
  name = 'New Page',
  slug = 'new-page',
  pageFolder = '',
  pageFolders,
  onClose,
  onSubmit
}: PageFormProps) => {
  const form = useForm({ defaultValues: { name, slug, pageFolder }, config: { schema: pageFormSchema } });

  const handleChangeName = useCallback(
    (value: string) => {
      form.formMethods.setValue(
        'slug',
        value
          .replaceAll(' ', '-')
          .toLowerCase()
          .replaceAll(/([^a-z0-9-]+)/gi, '')
      );
    },
    [form.formMethods]
  );

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof pageFormSchema>) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" onChange={handleChangeName} label="Folder Name" size="sm" />
        <Form.Input name="slug" label="Slug / Path" size="sm" />
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
