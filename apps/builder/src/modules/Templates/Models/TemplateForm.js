// Packages
import React, { useCallback, useMemo } from 'react';
import Button from '@plitzi/plitzi-ui/Button';
import Form from '@plitzi/plitzi-ui/Form';
import Flex from '@plitzi/plitzi-ui/Flex';
import { z } from 'zod';
import { useForm } from '@plitzi/plitzi-ui';

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

  const form = useForm({ initialValues, config: { schema } });

  const handleSubmitInternal = useCallback(values => onSubmit?.(values), [onSubmit]);

  return (
    <Form className="p-3" form={form} onSubmit={handleSubmitInternal}>
      <Form.Body>
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
      </Form.Body>
    </Form>
  );
};

export default TemplateForm;
