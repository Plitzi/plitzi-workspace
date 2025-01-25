// Packages
import React, { useMemo } from 'react';
import Button from '@plitzi/plitzi-ui/Button';
import Form from '@plitzi/plitzi-ui/Form';
import Flex from '@plitzi/plitzi-ui/Flex';
import { z } from 'zod';

/**
 * @param {{
 *   name?: string;
 *   description?: string;
 *   onClose?: () => void;
 *   onSubmit?: (values: { name: string; description: string }) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const TemplateForm = props => {
  const { name = 'New Template', description = '', onSubmit, onClose } = props;

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(3, { message: 'Too Short' }).max(20, { message: 'Too Long' }),
        description: z.string().max(200, { message: 'Too Long' }).optional()
      }),
    []
  );

  const initialValues = useMemo(() => ({ name, description }), [name, description]);

  const handleSubmitInternal = values => onSubmit?.(values);

  return (
    <Form className="p-3" initialValues={initialValues} schema={schema} onSubmit={handleSubmitInternal}>
      <Form.Input name="name" label="Template Name" placeholder="Template Name" />
      <Form.TextArea name="description" label="Template Description" placeholder="Template Description" />
      <Flex gap={3} justify="end">
        <Button onClick={onClose} size="sm">
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Submit
        </Button>
      </Flex>
    </Form>
  );
};

export default TemplateForm;
