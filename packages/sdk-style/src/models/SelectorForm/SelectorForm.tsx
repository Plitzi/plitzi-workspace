import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import { capitalize } from '@plitzi/plitzi-ui/helpers/lodash';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

import type { ComponentPluginWithHOC } from '@plitzi/sdk-shared';

const selectorFormSchema = z.discriminatedUnion('mode', [
  z.object({
    name: z
      .string()
      .min(3)
      .regex(/^([a-zA-Z.#]{1}([a-zA-Z0-9\-_.#: ]+)?)$/i, {
        message: 'Name only can be letters, numbers and _ -'
      }),
    mode: z.literal('default')
  }),
  z.object({
    mode: z.literal('element'),
    componentType: z.string()
  })
]);

export type SelectorFormValues = z.infer<typeof selectorFormSchema>;

export type SelectorFormProps = {
  name?: string;
  mode?: 'default' | 'element';
  componentType?: string;
  components: Record<string, ComponentPluginWithHOC>;
  componentsNotAvailables?: string[];
  onClose?: () => void | Promise<void>;
  onSubmit?: (e: MouseEvent | undefined, values: SelectorFormValues) => void | Promise<void>;
};

const SelectorForm = ({
  name = '',
  mode = 'default',
  componentType = '',
  components,
  componentsNotAvailables,
  onClose,
  onSubmit
}: SelectorFormProps) => {
  const form = useForm({
    defaultValues: { name, mode, componentType },
    config: { schema: selectorFormSchema }
  });
  const watchMode = useFormWatch(form.formMethods, 'mode');
  const componentOptions = useMemo(
    () =>
      Object.keys(components).map(componentType => (
        <option key={componentType} value={componentType} disabled={componentsNotAvailables?.includes(componentType)}>
          {capitalize(componentType.replace(/([a-z0-9])([A-Z])/g, '$1 $2'))}
        </option>
      )),
    [components, componentsNotAvailables]
  );

  const handleChangeMode = useCallback(
    (mode: string) => {
      if (mode === 'element') {
        form.formMethods.setValue('componentType', Object.keys(components)[0]);
      } else {
        form.formMethods.setValue('componentType', '');
      }
    },
    [components, form.formMethods]
  );

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof selectorFormSchema>) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Select name="mode" label="Mode" onChange={handleChangeMode} size="xs">
          <option value="default">Default</option>
          <option value="element">Element</option>
        </Form.Select>
        {watchMode === 'default' && <Form.Input name="name" label="Name" size="xs" />}
        {watchMode === 'element' && (
          <Form.Select name="componentType" label="Element Type" size="xs">
            {componentOptions}
          </Form.Select>
        )}
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

export default SelectorForm;
