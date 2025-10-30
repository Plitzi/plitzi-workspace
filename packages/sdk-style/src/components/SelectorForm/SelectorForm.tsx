import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

import type { MouseEvent } from 'react';

export type SelectorFormProps = {
  className?: string;
  onClose?: (e?: MouseEvent) => void | Promise<void>;
  onSubmit?: (e: MouseEvent | undefined, values: { name: string }) => void | Promise<void>;
};

const SelectorForm = ({ className = '', onClose, onSubmit }: SelectorFormProps) => {
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(3, { message: 'Too Short' }).max(20, { message: 'Too Long' })
      }),
    []
  );
  const form = useForm({ defaultValues: { name: '' }, config: { schema } });

  const handleClickCancel = useCallback((e: MouseEvent) => void onClose?.(e), [onClose]);

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof schema>) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  // const validateName = (value: string) => {
  //   const regex = /^([a-zA-Z.#]{1}([a-zA-Z0-9\-_.#: ]+)?)$/i;
  //   if (value.match(regex)) {
  //     return true;
  //   }

  //   return 'Invalid Selector';
  // };

  // rules={{ required: true, validate: { validateName } }}

  return (
    <Form className={className} form={form} onSubmit={handleSubmitInternal}>
      <Form.Body>
        <Form.Input name="name" label="Name" placeholder="Name" />
        <Flex gap={3} justify="end">
          <Button onClick={handleClickCancel} size="sm">
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

export default SelectorForm;
